import { describe, expect, it } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import { gameplayChecksum } from "../gameplay/kernel/replay.js";
import {
  compileCharacterBootstrap,
  applyCharacterBootstrap,
} from "../gameplay/tow/character-bootstrap.js";
import { isTowBuild } from "../gameplay/tow/build.js";
import { dispatchTowCommand } from "../gameplay/tow/commands.js";
import { sealTowTerminalReceipt } from "../gameplay/tow/outcomes.js";
import {
  claimReward,
  compileRewardOffer,
  rerollRewardOffer,
  rewardSeedFor,
} from "../gameplay/tow/rewards.js";
import {
  MAX_TOW_COMMANDS,
  TOW_RULESET_ID,
  createTowSession,
  markTowSessionSettled,
  towSessionChecksum,
} from "../gameplay/tow/session.js";
import { settleTowEncounter } from "../gameplay/tow/settlement.js";
import v13ResolveCadenceSession from "../gameplay/tow/fixtures/v13-resolve-cadence-session.json";
import v12AuthenticRewardCampaign from "../gameplay/tow/fixtures/v12-authentic-reward-campaign.json";
import { towSessionChecksum as frozenTowV12SessionChecksum } from "../gameplay/tow/session-v12.js";
import {
  CAMPAIGN_SCHEMA_V12,
  CAMPAIGN_SCHEMA_V13,
  canCommitTowSession,
  CURRENT_CAMPAIGN_SCHEMA,
  emptyMechanicsSidecar,
  hasMechanicsSidecar,
  hasCurrentMechanicsState,
  isWritableTowActiveCombat,
  isReadableCampaignSchema,
  migrateCampaignState,
  MAX_RETIRED_TOW_SESSION_ENCODED_BYTES,
  READABLE_CAMPAIGN_SCHEMAS,
  upgradeCampaignPayload,
  verifyMigrationReadBack,
} from "./campaign-migration.js";

// A campaign saved before the sidecar existed. A fresh initial state now ships with one,
// so the fixture has to strip it back off to be the thing the migration is written for.
function legacyCampaign() {
  const state = makeInitialState();
  state.created = true;
  delete state.mechanics;
  return JSON.parse(JSON.stringify(state));
}

function settledRewardCampaign({ retired = false, rerolls = 0 } = {}) {
  const bootstrap = compileCharacterBootstrap({ professionId: "fighter" }).receipt;
  let state = migrateCampaignState(legacyCampaign()).state;
  state.mechanics = applyCharacterBootstrap(state.mechanics, bootstrap).mechanics;
  const sessionId = "settled-reward-fight";
  const opened = createTowSession({
    sessionId,
    rootSeed: "settled-reward-root",
    player: {
      id: "wanderer",
      name: "Wanderer",
      maxHp: 80,
      resolve: 8,
      resolveMax: 8,
      resolveRegen: 1,
      stats: { attack: 250, defense: 5, critRate: 0, dodgeRate: 0 },
    },
    enemies: [{
      id: "brigand",
      name: "Brigand",
      maxHp: 10,
      stats: { attack: 2, defense: 0, critRate: 0, dodgeRate: 0 },
      attacks: [{ id: "jab", name: "Jab", hits: 1, damage: 2 }],
    }],
    build: { traits: {}, skills: ["strike"] },
    context: { rewardPolicy: { rerolls } },
  });
  const terminal = dispatchTowCommand(opened.session, {
    id: "settled-reward-finisher",
    expectedRevision: 0,
    type: "use-skill",
    actorId: "wanderer",
    skillId: "strike",
    targetId: "brigand",
  }).session;
  state = settleTowEncounter(state, terminal.encounter, { encounterId: sessionId }).state;
  const sealed = sealTowTerminalReceipt(terminal).session;
  const marked = markTowSessionSettled(sealed, sessionId).session;
  const sourceSession = JSON.parse(JSON.stringify(marked));
  if (retired) {
    sourceSession.rulesetId = "solitaire-tow-v1.2";
    sourceSession.terminalReceipt.rulesetId = "solitaire-tow-v1.2";
    sourceSession.checksum = towSessionChecksum(sourceSession);
  }
  state.mechanics.tow.activeCombat = sourceSession;
  const seed = rewardSeedFor(sessionId, sourceSession.streams.rewards);
  const compiled = compileRewardOffer(state.mechanics.build, {
    sourceReceiptId: sessionId,
    seed,
    rerolls,
  }).offer;
  if (retired) {
    const { checksum: _checksum, replacedSkill: _replacedSkill, ...legacyOffer } = compiled;
    state.pendingReward = { ...legacyOffer, rulesetId: "solitaire-tow-v1.2" };
  } else {
    state.pendingReward = compiled;
  }
  return { seed, state };
}

function v13RewardCampaign() {
  const bootstrap = compileCharacterBootstrap({ professionId: "fighter" }).receipt;
  let state = migrateCampaignState(legacyCampaign()).state;
  state.mechanics = applyCharacterBootstrap(state.mechanics, bootstrap).mechanics;
  const source = JSON.parse(JSON.stringify(v13ResolveCadenceSession));
  const settlement = settleTowEncounter(state, source.encounter, {
    encounterId: source.sessionId,
  });
  if (!settlement.ok) throw new Error(settlement.reason);
  state = settlement.state;
  state.mechanics.tow.activeCombat = source;
  const seed = rewardSeedFor(
    source.sessionId,
    source.terminalReceipt.streamEndpoints.rewards,
  );
  const compiled = compileRewardOffer(state.mechanics.build, {
    sourceReceiptId: source.sessionId,
    seed,
  });
  if (!compiled.ok) throw new Error(compiled.reason);
  const retired = { ...compiled.offer, rulesetId: "solitaire-tow-v1.3", checksum: null };
  const { checksum: _checksum, ...payload } = retired;
  retired.checksum = gameplayChecksum(payload);
  state.pendingReward = retired;
  return state;
}

describe("readers accept every known schema", () => {
  it("reads the old version as well as the new one", () => {
    // A bump that only reads the new version does not corrupt old saves — it makes them
    // invisible, which looks like data loss.
    expect(isReadableCampaignSchema(CAMPAIGN_SCHEMA_V12)).toBe(true);
    expect(isReadableCampaignSchema(CAMPAIGN_SCHEMA_V13)).toBe(true);
    expect(READABLE_CAMPAIGN_SCHEMAS).toContain(CURRENT_CAMPAIGN_SCHEMA);
  });

  it("rejects a version it does not know", () => {
    expect(isReadableCampaignSchema("v11")).toBe(false);
    expect(isReadableCampaignSchema("v99")).toBe(false);
    expect(isReadableCampaignSchema(null)).toBe(false);
  });
});

describe("migration is pure and idempotent", () => {
  it("adds the sidecar to a legacy campaign", () => {
    const legacy = legacyCampaign();
    expect(hasMechanicsSidecar(legacy)).toBe(false);
    const migrated = migrateCampaignState(legacy);
    expect(migrated.ok).toBe(true);
    expect(hasMechanicsSidecar(migrated.state)).toBe(true);
    expect(migrated.state.mechanics).toEqual(emptyMechanicsSidecar());
    expect(hasCurrentMechanicsState(migrated.state)).toBe(true);
  });

  it("distinguishes a complete current sidecar from partial or malformed state cheaply", () => {
    const current = migrateCampaignState(legacyCampaign()).state;
    expect(hasCurrentMechanicsState(current)).toBe(true);

    const partial = JSON.parse(JSON.stringify(current));
    delete partial.mechanics.tow.formation;
    expect(hasCurrentMechanicsState(partial)).toBe(false);

    const malformed = JSON.parse(JSON.stringify(current));
    malformed.mechanics.tow.readiness = [];
    expect(hasCurrentMechanicsState(malformed)).toBe(false);

    const malformedBuild = JSON.parse(JSON.stringify(current));
    malformedBuild.mechanics.build = "forged";
    expect(hasCurrentMechanicsState(malformedBuild)).toBe(false);

    const emptyBuild = JSON.parse(JSON.stringify(current));
    emptyBuild.mechanics.build = {};
    expect(hasCurrentMechanicsState(emptyBuild)).toBe(false);

    const invalidRank = JSON.parse(JSON.stringify(current));
    invalidRank.mechanics.build = compileCharacterBootstrap({ professionId: "fighter" }).receipt.build;
    invalidRank.mechanics.build.skills[0].rank = 999;
    expect(hasCurrentMechanicsState(invalidRank)).toBe(false);
    expect(upgradeCampaignPayload(invalidRank))
      .toMatchObject({ ok: false, writable: false, state: invalidRank });
  });

  it("does not mutate the payload it migrates", () => {
    const legacy = legacyCampaign();
    const before = JSON.stringify(legacy);
    migrateCampaignState(legacy);
    expect(JSON.stringify(legacy)).toBe(before);
  });

  it("is idempotent, so a warm resume cannot double-write", () => {
    const once = migrateCampaignState(legacyCampaign()).state;
    const twice = migrateCampaignState(once).state;
    expect(twice).toEqual(once);
  });

  it("leaves an already-bootstrapped sidecar alone", () => {
    const receipt = compileCharacterBootstrap({ professionId: "fighter" }).receipt;
    const state = migrateCampaignState(legacyCampaign()).state;
    state.mechanics = applyCharacterBootstrap(state.mechanics, receipt).mechanics;

    const again = migrateCampaignState(state).state;
    expect(again.mechanics.bootstrapId).toBe(receipt.id);
    expect(again.mechanics.build).toEqual(receipt.build);
  });

  it("migrates a legacy ID-only Tower build to durable rank-one entries", () => {
    const state = migrateCampaignState(legacyCampaign()).state;
    state.mechanics.bootstrapId = "legacy-build";
    state.mechanics.bootstrapOrigin = "template";
    state.mechanics.build = {
      version: 1,
      professionId: "fighter",
      traits: { ironclad: 2 },
      skills: ["strike", "block", "warcry"],
      runes: ["rune-of-ash"],
    };
    const before = JSON.parse(JSON.stringify(state));
    const upgraded = upgradeCampaignPayload(state);

    expect(upgraded).toMatchObject({ ok: true, writable: true });
    expect(isTowBuild(upgraded.state.mechanics.build)).toBe(true);
    expect(upgraded.state.mechanics.build.skills).toEqual([
      { id: "strike", rank: 1 },
      { id: "block", rank: 1 },
      { id: "warcry", rank: 1 },
    ]);
    expect(upgraded.state.mechanics.build.runes).toEqual(["rune-of-ash"]);
    expect(state).toEqual(before);
  });

  it("preserves and refuses a legacy-shaped build with an unknown extension", () => {
    const state = migrateCampaignState(legacyCampaign()).state;
    state.mechanics.build = {
      version: 1,
      professionId: "fighter",
      traits: { ironclad: 2 },
      skills: ["strike", "block", "warcry"],
      runes: ["rune-of-ash"],
      futureOwnedReward: { id: "must-survive" },
    };
    const before = JSON.parse(JSON.stringify(state));

    const upgraded = upgradeCampaignPayload(state);

    expect(upgraded).toMatchObject({ ok: false, writable: false });
    expect(upgraded.state).toEqual(before);
    expect(upgraded.state.mechanics.build.futureOwnedReward)
      .toEqual({ id: "must-survive" });
  });

  it("refuses a malformed current-ruleset pending reward", () => {
    const receipt = compileCharacterBootstrap({ professionId: "fighter" }).receipt;
    const state = migrateCampaignState(legacyCampaign()).state;
    state.mechanics = applyCharacterBootstrap(state.mechanics, receipt).mechanics;
    state.combatSettlementReceipts = [{
      version: 1,
      sessionId: "settled-current-fight",
      outcome: "victory",
    }];
    const offer = compileRewardOffer(state.mechanics.build, {
      sourceReceiptId: "settled-current-fight",
      seed: "current-reward-seed",
    }).offer;
    state.pendingReward = { ...offer, candidates: null };
    const before = JSON.parse(JSON.stringify(state));

    expect(upgradeCampaignPayload(state)).toMatchObject({
      ok: false,
      reason: "invalid-current-pending-reward",
      state: before,
      writable: false,
    });
  });

  it("refuses a retired pending reward without its recorded victory", () => {
    const receipt = compileCharacterBootstrap({ professionId: "fighter" }).receipt;
    const state = migrateCampaignState(legacyCampaign()).state;
    state.mechanics = applyCharacterBootstrap(state.mechanics, receipt).mechanics;
    const compiledOldOffer = compileRewardOffer(state.mechanics.build, {
      sourceReceiptId: "invented-v12-fight",
      seed: "caller-chosen-seed",
    }).offer;
    const { checksum: _checksum, replacedSkill: _replacedSkill, ...oldOffer } = compiledOldOffer;
    state.pendingReward = { ...oldOffer, rulesetId: "solitaire-tow-v1.2" };
    const before = JSON.parse(JSON.stringify(state));

    expect(upgradeCampaignPayload(state)).toMatchObject({
      ok: false,
      reason: "unearned-pending-reward",
      state: before,
      writable: false,
    });
  });

  it("refuses a retired pending reward backed only by a receipt stub", () => {
    const receipt = compileCharacterBootstrap({ professionId: "fighter" }).receipt;
    const state = migrateCampaignState(legacyCampaign()).state;
    state.mechanics = applyCharacterBootstrap(state.mechanics, receipt).mechanics;
    state.combatSettlementReceipts = [{
      sessionId: "stubbed-v12-fight",
      outcome: "victory",
    }];
    const compiledOldOffer = compileRewardOffer(state.mechanics.build, {
      sourceReceiptId: "stubbed-v12-fight",
      seed: "caller-chosen-seed",
    }).offer;
    const { checksum: _checksum, replacedSkill: _replacedSkill, ...oldOffer } = compiledOldOffer;
    state.pendingReward = { ...oldOffer, rulesetId: "solitaire-tow-v1.2" };
    const before = JSON.parse(JSON.stringify(state));

    expect(upgradeCampaignPayload(state)).toMatchObject({
      ok: false,
      reason: "unearned-pending-reward",
      state: before,
      writable: false,
    });
  });

  it("refuses current semantics relabeled as a v1.2 entitlement", () => {
    const { state } = settledRewardCampaign({ retired: true });
    const before = JSON.parse(JSON.stringify(state));

    expect(upgradeCampaignPayload(state)).toMatchObject({
      ok: false,
      reason: "unearned-pending-reward",
      state: before,
      writable: false,
    });
  });

  it("rejects retired-session accessors without executing them", () => {
    const state = JSON.parse(JSON.stringify(v12AuthenticRewardCampaign));
    const session = state.mechanics.tow.activeCombat;
    let reads = 0;
    Object.defineProperty(session, "rulesetId", {
      enumerable: true,
      configurable: true,
      get() {
        reads += 1;
        return "solitaire-tow-v1.2";
      },
    });

    const upgraded = upgradeCampaignPayload(state);

    expect(reads).toBe(0);
    expect(upgraded.ok).toBe(false);
    expect(upgraded.reason).toBe("invalid-retired-active-combat");
    expect(upgraded.writable).toBe(false);
  });

  it("migrates an authentic deployed-v1.2 owed reward", () => {
    const state = JSON.parse(JSON.stringify(v12AuthenticRewardCampaign));
    const source = state.mechanics.tow.activeCombat;
    expect(source).toMatchObject({
      version: 1,
      rulesetId: "solitaire-tow-v1.2",
      mode: "campaign",
      status: "settled",
      checksum: "integrity-v1:0b6880aa59763eaf",
    });
    expect(source.commands).toHaveLength(1);
    expect(state.pendingReward).toMatchObject({
      rulesetId: "solitaire-tow-v1.2",
      sourceReceiptId: source.sessionId,
      claimedId: null,
    });

    const upgraded = upgradeCampaignPayload(state);

    expect(upgraded).toMatchObject({ ok: true, writable: true });
    expect(upgraded.state.mechanics.build.version).toBe(2);
    expect(upgraded.state.pendingReward).toMatchObject({
      rulesetId: TOW_RULESET_ID,
      sourceReceiptId: source.sessionId,
      seed: state.pendingReward.seed,
      claimedId: null,
    });
    expect(claimReward(
      upgraded.state.mechanics.build,
      upgraded.state.pendingReward,
      upgraded.state.pendingReward.candidates[0].id,
    ).ok).toBe(true);
  });

  it.each([
    ["four unspent rerolls", 4, false, ""],
    ["one spent reroll", 3, true, "::reroll::4"],
    ["maximum-depth reroll", 0, true, "::reroll::4::reroll::3::reroll::2::reroll::1"],
  ])("migrates an authentic v1.2 reward with %s", (_label, remaining, rerolled, suffix) => {
    const state = JSON.parse(JSON.stringify(v12AuthenticRewardCampaign));
    const baseSeed = state.pendingReward.seed;
    state.pendingReward.seed = `${baseSeed}${suffix}`;
    state.pendingReward.rerollsRemaining = remaining;
    state.pendingReward.rerolled = rerolled;

    const upgraded = upgradeCampaignPayload(state);

    expect(upgraded).toMatchObject({ ok: true, writable: true });
    expect(upgraded.state.pendingReward).toMatchObject({
      rulesetId: TOW_RULESET_ID,
      sourceReceiptId: state.pendingReward.sourceReceiptId,
      seed: `${baseSeed}${suffix}`,
      rerollsRemaining: remaining,
      rerolled,
      claimedId: null,
    });
  });

  it("keeps an exact verified v1.2 source writable without a pending reward", () => {
    const state = JSON.parse(JSON.stringify(v12AuthenticRewardCampaign));
    state.pendingReward = null;

    expect(isWritableTowActiveCombat(state.mechanics.tow.activeCombat)).toBe(true);
    expect(upgradeCampaignPayload(state)).toMatchObject({
      ok: true,
      writable: true,
      recoverable: false,
    });
  });

  it.each([
    ["unknown field", (session) => { session.futureAuthority = { accepted: true }; }],
    ["unknown command field", (session) => { session.commands[0].futureAuthority = true; }],
    ["replay divergence", (session) => { session.encounter.actors.wanderer.hp -= 1; }],
  ])("quarantines a rechecksummed v1.2 %s without a pending reward", (_label, mutate) => {
    const state = JSON.parse(JSON.stringify(v12AuthenticRewardCampaign));
    state.pendingReward = null;
    const session = state.mechanics.tow.activeCombat;
    mutate(session);
    session.checksum = frozenTowV12SessionChecksum(session);

    expect(isWritableTowActiveCombat(session)).toBe(false);
    expect(upgradeCampaignPayload(state)).toMatchObject({
      ok: true,
      reason: "unwritable-active-combat",
      writable: false,
      recoverable: true,
    });
  });

  it("keeps an exact verified v1.3 source writable without a pending reward", () => {
    const state = v13RewardCampaign();
    state.pendingReward = null;

    expect(isWritableTowActiveCombat(state.mechanics.tow.activeCombat)).toBe(true);
    expect(upgradeCampaignPayload(state)).toMatchObject({
      ok: true,
      writable: true,
      recoverable: false,
    });
  });

  it.each([
    ["unknown field", (session) => { session.futureAuthority = { accepted: true }; }],
    ["unknown command field", (session) => { session.commands[0].futureAuthority = true; }],
    ["replay divergence", (session) => { session.encounter.actors.wanderer.hp -= 1; }],
  ])("quarantines a rechecksummed v1.3 %s without a pending reward", (_label, mutate) => {
    const state = v13RewardCampaign();
    state.pendingReward = null;
    const session = state.mechanics.tow.activeCombat;
    mutate(session);
    session.checksum = towSessionChecksum(session);

    expect(isWritableTowActiveCombat(session)).toBe(false);
    expect(upgradeCampaignPayload(state)).toMatchObject({
      ok: true,
      reason: "unwritable-active-combat",
      writable: false,
      recoverable: true,
    });
  });

  it("quarantines a v1.3 source whose original checksum is invalid", () => {
    const state = v13RewardCampaign();
    state.pendingReward = null;
    const session = state.mechanics.tow.activeCombat;
    session.checksum = "integrity-v1:0000000000000000";

    expect(isWritableTowActiveCombat(session)).toBe(false);
    expect(upgradeCampaignPayload(state)).toMatchObject({
      ok: true,
      reason: "unwritable-active-combat",
      writable: false,
      recoverable: true,
    });
  });

  it("rejects a rechecksummed current session with an unknown command field", () => {
    const { state } = settledRewardCampaign();
    state.pendingReward = null;
    const session = state.mechanics.tow.activeCombat;
    session.commands[0].futureAuthority = true;
    session.checksum = towSessionChecksum(session);
    const before = JSON.parse(JSON.stringify(state));

    expect(isWritableTowActiveCombat(session)).toBe(false);
    expect(upgradeCampaignPayload(state)).toMatchObject({
      ok: false,
      state: before,
      writable: false,
    });
  });

  it("migrates an owed v1.3 reward through the pinned historical cadence", () => {
    const state = v13RewardCampaign();

    const upgraded = upgradeCampaignPayload(state);

    expect(TOW_RULESET_ID).toBe("solitaire-tow-v1.4");
    expect(upgraded).toMatchObject({ ok: true, writable: true });
    expect(upgraded.state.pendingReward).toMatchObject({
      sourceReceiptId: v13ResolveCadenceSession.sessionId,
      rulesetId: TOW_RULESET_ID,
      claimedId: null,
    });
    expect(claimReward(
      upgraded.state.mechanics.build,
      upgraded.state.pendingReward,
      upgraded.state.pendingReward.candidates[0].id,
    ).ok).toBe(true);
  });

  it("rejects historical events relabeled as a current writable session", () => {
    const disguised = JSON.parse(JSON.stringify(v13ResolveCadenceSession));
    disguised.rulesetId = TOW_RULESET_ID;
    disguised.terminalReceipt.rulesetId = TOW_RULESET_ID;
    disguised.checksum = towSessionChecksum(disguised);
    const state = migrateCampaignState(legacyCampaign()).state;
    state.mechanics.tow.activeCombat = disguised;
    const before = JSON.parse(JSON.stringify(state));

    expect(isWritableTowActiveCombat(disguised)).toBe(false);
    expect(upgradeCampaignPayload(state)).toMatchObject({
      ok: false,
      state: before,
      writable: false,
    });
  });

  it("rejects a current reward whose source session is practice", () => {
    const { state } = settledRewardCampaign();
    const forged = JSON.parse(JSON.stringify(state));
    const session = forged.mechanics.tow.activeCombat;
    session.mode = "practice";
    session.checksum = towSessionChecksum(session);
    const before = JSON.parse(JSON.stringify(forged));

    expect(upgradeCampaignPayload(forged)).toMatchObject({
      ok: false,
      reason: "unearned-pending-reward",
      state: before,
      writable: false,
    });
  });

  it.each([
    ["fallen count", (receipt) => { receipt.fallen = 1000; }],
    ["combat item spend", (receipt) => { receipt.combatItemsSpent = { "fire-pot": 999 }; }],
    ["proficiency gain", (receipt) => { receipt.proficiencyGains = { "mastery-sword": 999999 }; }],
  ])("rejects a current reward whose settlement %s was forged", (_label, mutate) => {
    const { state } = settledRewardCampaign();
    const forged = JSON.parse(JSON.stringify(state));
    const receipt = forged.combatSettlementReceipts.find((entry) => (
      entry.sessionId === forged.pendingReward.sourceReceiptId
    ));
    mutate(receipt);
    const before = JSON.parse(JSON.stringify(forged));

    expect(upgradeCampaignPayload(forged)).toMatchObject({
      ok: false,
      reason: "unearned-pending-reward",
      state: before,
      writable: false,
    });
  });

  it.each([
    ["malformed unrelated receipt", (receipts) => {
      receipts.push({ sessionId: "invented", outcome: "victory" });
    }],
    ["duplicate receipt ID", (receipts) => {
      receipts.push(JSON.parse(JSON.stringify(receipts[0])));
    }],
  ])("rejects a settlement ledger with a %s", (_label, mutate) => {
    const { state } = settledRewardCampaign();
    const forged = JSON.parse(JSON.stringify(state));
    mutate(forged.combatSettlementReceipts);
    const before = JSON.parse(JSON.stringify(forged));

    expect(upgradeCampaignPayload(forged)).toMatchObject({
      ok: false,
      state: before,
      writable: false,
    });
  });

  it("rejects a checksum-valid reroll budget not granted by admission", () => {
    const { seed, state } = settledRewardCampaign();
    state.pendingReward = compileRewardOffer(state.mechanics.build, {
      sourceReceiptId: state.pendingReward.sourceReceiptId,
      seed,
      rerolls: 4,
    }).offer;
    const before = JSON.parse(JSON.stringify(state));

    expect(upgradeCampaignPayload(state)).toMatchObject({
      ok: false,
      reason: "unearned-pending-reward",
      state: before,
      writable: false,
    });
  });

  it("rejects a new offer after the source receipt was durably consumed", () => {
    const { state } = settledRewardCampaign();
    const offer = state.pendingReward;
    state.mechanics.tow.rewardClaims = [{
      sourceReceiptId: offer.sourceReceiptId,
      offerId: offer.id,
      claimedId: offer.candidates[0].id,
    }];
    const before = JSON.parse(JSON.stringify(state));

    expect(upgradeCampaignPayload(state)).toMatchObject({
      ok: false,
      reason: "unearned-pending-reward",
      state: before,
      writable: false,
    });
  });

  it("blocks replacing the sole source session of an unclaimed reward", () => {
    const { state } = settledRewardCampaign();
    const source = state.mechanics.tow.activeCombat;
    const replacement = createTowSession({
      sessionId: "different-fight",
      rootSeed: "different-root",
      player: source.genesis.playerSnapshot,
      enemies: source.genesis.enemySnapshots,
      build: source.genesis.effectiveBuild,
    }).session;

    expect(canCommitTowSession(state, source)).toBe(true);
    expect(canCommitTowSession(state, replacement)).toBe(false);
  });

  it("preserves a valid endpoint-derived rerolled reward", () => {
    const { seed, state } = settledRewardCampaign({ rerolls: 1 });
    const initial = compileRewardOffer(state.mechanics.build, {
      sourceReceiptId: state.pendingReward.sourceReceiptId,
      seed,
      rerolls: 1,
    });
    expect(initial.ok).toBe(true);
    const rerolled = rerollRewardOffer(state.mechanics.build, initial.offer);
    expect(rerolled.ok).toBe(true);
    state.pendingReward = rerolled.offer;

    const upgraded = upgradeCampaignPayload(state);

    expect(upgraded).toMatchObject({ ok: true, writable: true });
    expect(upgraded.state.pendingReward).toMatchObject({
      seed: `${seed}::reroll::1`,
      rerolled: true,
      rerollsRemaining: 0,
    });
    expect(claimReward(
      upgraded.state.mechanics.build,
      upgraded.state.pendingReward,
      upgraded.state.pendingReward.candidates[0].id,
    ).ok).toBe(true);
  });

  it("preserves the complete bounded reroll seed chain", () => {
    const { seed, state } = settledRewardCampaign({ rerolls: 4 });
    const initial = compileRewardOffer(state.mechanics.build, {
      sourceReceiptId: state.pendingReward.sourceReceiptId,
      seed,
      rerolls: 4,
    });
    expect(initial.ok).toBe(true);
    let offer = initial.offer;
    for (let remaining = 4; remaining > 0; remaining -= 1) {
      const rerolled = rerollRewardOffer(state.mechanics.build, offer);
      expect(rerolled.ok).toBe(true);
      offer = rerolled.offer;
    }
    state.pendingReward = offer;

    const upgraded = upgradeCampaignPayload(state);

    expect(upgraded).toMatchObject({ ok: true, writable: true });
    expect(upgraded.state.pendingReward).toMatchObject({
      rerolled: true,
      rerollsRemaining: 0,
    });
  });

  it("refuses a current reward whose source session diverges from replay", () => {
    const { state } = settledRewardCampaign();
    const forged = JSON.parse(JSON.stringify(state));
    const session = forged.mechanics.tow.activeCombat;
    session.encounter.actors.wanderer.resolve -= 1;
    session.checksum = towSessionChecksum(session);
    const receipt = forged.combatSettlementReceipts.find((entry) => (
      entry.sessionId === session.sessionId
    ));
    receipt.playerResolve = session.encounter.actors.wanderer.resolve;
    const before = JSON.parse(JSON.stringify(forged));

    expect(upgradeCampaignPayload(forged)).toMatchObject({
      ok: false,
      reason: "unearned-pending-reward",
      state: before,
      writable: false,
    });
  });

  it("refuses a retired reward whose source endpoint diverges from replay", () => {
    const { state } = settledRewardCampaign({ retired: true });
    const forged = JSON.parse(JSON.stringify(state));
    const session = forged.mechanics.tow.activeCombat;
    session.encounter.actors.wanderer.resolve -= 1;
    session.checksum = towSessionChecksum(session);
    const receipt = forged.combatSettlementReceipts.find((entry) => (
      entry.sessionId === session.sessionId
    ));
    receipt.playerResolve = session.encounter.actors.wanderer.resolve;
    const before = JSON.parse(JSON.stringify(forged));

    expect(upgradeCampaignPayload(forged)).toMatchObject({
      ok: false,
      reason: "unearned-pending-reward",
      state: before,
      writable: false,
    });
  });

  it("refuses a retired reward with a substituted reward-stream endpoint", () => {
    const { state } = settledRewardCampaign({ retired: true });
    const forged = JSON.parse(JSON.stringify(state));
    const session = forged.mechanics.tow.activeCombat;
    session.streams.rewards.state = (session.streams.rewards.state + 1) >>> 0;
    session.checksum = towSessionChecksum(session);
    const seed = rewardSeedFor(session.sessionId, session.streams.rewards);
    const compiled = compileRewardOffer(forged.mechanics.build, {
      sourceReceiptId: session.sessionId,
      seed,
    }).offer;
    const { checksum: _checksum, replacedSkill: _replacedSkill, ...legacyOffer } = compiled;
    forged.pendingReward = { ...legacyOffer, rulesetId: "solitaire-tow-v1.2" };
    const before = JSON.parse(JSON.stringify(forged));

    expect(upgradeCampaignPayload(forged)).toMatchObject({
      ok: false,
      reason: "unearned-pending-reward",
      state: before,
      writable: false,
    });
  });

  it("refuses a retired reward whose settled source lacks its terminal receipt", () => {
    const { state } = settledRewardCampaign({ retired: true });
    const forged = JSON.parse(JSON.stringify(state));
    const session = forged.mechanics.tow.activeCombat;
    session.terminalReceipt = null;
    session.checksum = towSessionChecksum(session);
    const before = JSON.parse(JSON.stringify(forged));

    expect(upgradeCampaignPayload(forged)).toMatchObject({
      ok: false,
      reason: "unearned-pending-reward",
      state: before,
      writable: false,
    });
  });

  it("refuses a retired reward whose source session has an unknown structural field", () => {
    const { state } = settledRewardCampaign({ retired: true });
    const forged = JSON.parse(JSON.stringify(state));
    const session = forged.mechanics.tow.activeCombat;
    session.unverifiedExtension = { authority: "forged" };
    session.checksum = towSessionChecksum(session);
    const before = JSON.parse(JSON.stringify(forged));

    expect(upgradeCampaignPayload(forged)).toMatchObject({
      ok: false,
      reason: "unearned-pending-reward",
      state: before,
      writable: false,
    });
  });

  it("rejects an oversized retired command log before migration cloning", () => {
    const { state } = settledRewardCampaign({ retired: true });
    state.mechanics.tow.activeCombat.commands = Array(MAX_TOW_COMMANDS + 1).fill(null);
    state.mechanics.tow.activeCombat.revision = MAX_TOW_COMMANDS + 1;

    expect(upgradeCampaignPayload(state)).toMatchObject({
      ok: false,
      reason: "invalid-retired-active-combat",
      state,
      writable: false,
    });
  });

  it("rejects an oversized retired payload before checksum or migration cloning", () => {
    const { state } = settledRewardCampaign({ retired: true });
    state.mechanics.tow.activeCombat.context.source.note = "x"
      .repeat(MAX_RETIRED_TOW_SESSION_ENCODED_BYTES + 1);

    expect(upgradeCampaignPayload(state)).toMatchObject({
      ok: false,
      reason: "invalid-retired-active-combat",
      state,
      writable: false,
    });
  });

  it("adds only absent Tower defaults to a partial v1 sidecar", () => {
    const state = legacyCampaign();
    state.mechanics = {
      version: 1,
      bootstrapId: "0123456789abcdef",
      build: { version: 1, marker: "keep-build" },
      futureKey: { marker: "keep-extension" },
      tow: {
        activeCombat: { sessionId: "keep-combat" },
        readiness: { strike: 2 },
      },
    };

    const migrated = migrateCampaignState(state);

    expect(migrated.ok).toBe(true);
    expect(migrated.state.mechanics).toMatchObject({
      bootstrapId: "0123456789abcdef",
      build: { version: 1, marker: "keep-build" },
      futureKey: { marker: "keep-extension" },
      tow: {
        activeCombat: { sessionId: "keep-combat" },
        readiness: { strike: 2 },
        companionReadiness: {},
        formation: emptyMechanicsSidecar().tow.formation,
      },
    });
    expect(verifyMigrationReadBack(state, migrated.state)).toEqual({ ok: true, reason: null });
  });

  it("fails closed instead of replacing an unknown mechanics version", () => {
    const state = legacyCampaign();
    const futureMechanics = {
      version: 2,
      bootstrapId: "future-build",
      build: { version: 2 },
      tow: { activeCombat: { sessionId: "future-combat" } },
    };
    state.mechanics = futureMechanics;

    expect(migrateCampaignState(state)).toMatchObject({
      ok: false,
      reason: "unsupported-mechanics-sidecar",
      state: null,
    });
    const upgraded = upgradeCampaignPayload(state);
    expect(upgraded).toMatchObject({ ok: false, writable: false, state });
    expect(state.mechanics).toEqual(futureMechanics);
  });

  it("fails closed instead of replacing an invalid existing Tower slot or formation", () => {
    const invalidTow = legacyCampaign();
    invalidTow.mechanics = { ...emptyMechanicsSidecar(), tow: "future-slot" };
    expect(migrateCampaignState(invalidTow)).toMatchObject({
      ok: false,
      reason: "invalid-tow-mechanics",
    });

    const invalidFormation = legacyCampaign();
    invalidFormation.mechanics = emptyMechanicsSidecar();
    invalidFormation.mechanics.tow.formation = { version: 2, cells: Array(9).fill(null) };
    expect(migrateCampaignState(invalidFormation)).toMatchObject({
      ok: false,
      reason: "unsupported-saved-formation",
    });

    const invalidBuild = legacyCampaign();
    invalidBuild.mechanics = { ...emptyMechanicsSidecar(), build: "forged" };
    expect(migrateCampaignState(invalidBuild)).toMatchObject({
      ok: false,
      reason: "invalid-build-mechanics",
    });
  });

  it("quarantines a legacy active session rather than converting or discarding it", () => {
    const legacy = legacyCampaign();
    legacy.activeCombatSession = { domain: "solitaire-production-combat", sequence: 2 };
    const migrated = migrateCampaignState(legacy).state;
    expect(migrated.activeCombatSession).toEqual(legacy.activeCombatSession);
  });

  it("refuses a payload that is not a campaign", () => {
    for (const bad of [null, undefined, [], "state", 7]) {
      expect(migrateCampaignState(bad)).toMatchObject({ ok: false, state: null });
    }
  });
});

describe("read-back verification", () => {
  it("passes a clean migration", () => {
    const legacy = legacyCampaign();
    const migrated = migrateCampaignState(legacy).state;
    expect(verifyMigrationReadBack(legacy, migrated)).toEqual({ ok: true, reason: null });
  });

  it("catches a migration that altered existing state", () => {
    const legacy = legacyCampaign();
    const tampered = migrateCampaignState(legacy).state;
    tampered.character.vitality -= 1;
    expect(verifyMigrationReadBack(legacy, tampered))
      .toMatchObject({ ok: false, reason: "migration-altered-existing-state" });
  });

  it("catches a migration that forgot the sidecar", () => {
    const legacy = legacyCampaign();
    expect(verifyMigrationReadBack(legacy, legacy))
      .toMatchObject({ ok: false, reason: "sidecar-missing" });
  });

  it("catches a migration that invented a character", () => {
    const legacy = legacyCampaign();
    const invented = migrateCampaignState(legacy).state;
    invented.mechanics.bootstrapId = "0123456789abcdef";
    expect(verifyMigrationReadBack(legacy, invented))
      .toMatchObject({ ok: false, reason: "migration-invented-a-build" });
  });

  it("catches a migration that altered an existing build or active combat", () => {
    const original = migrateCampaignState(legacyCampaign()).state;
    original.mechanics.tow.activeCombat = { sessionId: "combat-1" };
    const tampered = JSON.parse(JSON.stringify(original));
    tampered.mechanics.build = { forged: true };
    tampered.mechanics.tow.activeCombat.sessionId = "combat-2";

    expect(verifyMigrationReadBack(original, tampered)).toMatchObject({
      ok: false,
      reason: "migration-altered-existing-mechanics",
    });
  });

  it("refuses a missing payload rather than assuming success", () => {
    expect(verifyMigrationReadBack(null, {})).toMatchObject({ ok: false, reason: "missing-payload" });
    expect(verifyMigrationReadBack({}, null)).toMatchObject({ ok: false, reason: "missing-payload" });
  });
});

describe("the safe upgrade path", () => {
  it("returns a writable payload when migration and verification both pass", () => {
    const upgraded = upgradeCampaignPayload(legacyCampaign());
    expect(upgraded).toMatchObject({ ok: true, writable: true });
    expect(hasMechanicsSidecar(upgraded.state)).toBe(true);
  });

  it("hands back the original, unwritable, when the payload is not a campaign", () => {
    const bad = "not-a-campaign";
    const upgraded = upgradeCampaignPayload(bad);
    // Preserve evidence for diagnostics/recovery, but never authorize hydration or a write.
    expect(upgraded).toMatchObject({ ok: false, writable: false });
    expect(upgraded.state).toBe(bad);
  });

  it("hydrates a bounded unreadable fight for explicit recovery without authorizing a write", () => {
    const state = migrateCampaignState(legacyCampaign()).state;
    state.mechanics.tow.activeCombat = {
      version: 1,
      rulesetId: "solitaire-tow-v1",
      sessionId: "old-fight",
      commands: [],
    };

    const upgraded = upgradeCampaignPayload(state);

    expect(upgraded).toMatchObject({
      ok: true,
      reason: "unwritable-active-combat",
      state,
      writable: false,
      recoverable: true,
    });
  });

  it("never reports writable without a verified sidecar", () => {
    const upgraded = upgradeCampaignPayload(legacyCampaign());
    expect(upgraded.writable).toBe(hasMechanicsSidecar(upgraded.state));
  });
});
