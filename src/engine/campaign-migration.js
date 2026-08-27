// Campaign schema migration for the mechanics sidecar.
//
// The durable build needs somewhere to live in campaign state. Adding it is a schema
// change, and a schema change is the one failure mode that can cost a player their
// campaign. Readers therefore enumerate every supported `schema_version`; a naive
// current-only filter would not corrupt old saves, but would make them invisible and
// look lost.
//
// So: readers accept every known version, the migration is pure and idempotent, and a
// migrated payload is verified against its original before anything is written back. If
// verification fails the old payload stands.

import {
  canonicalJsonData,
  cloneJsonData,
  equalJsonData,
} from "../gameplay/kernel/json-data.js";
import {
  isLegacyTowBuild,
  isTowBuild,
  migrateLegacyTowBuild,
} from "../gameplay/tow/build.js";
import {
  isDeterministicRewardOffer,
  MAX_REWARD_REROLLS,
  migrateRewardOfferToCurrentRuleset,
  recompileRetiredRewardOffer,
  rewardOfferIdFor,
  rewardSeedFor,
} from "../gameplay/tow/rewards.js";
import {
  verifyRetiredTowV13Session,
  verifyTowSession,
} from "../gameplay/tow/replay.js";
import { verifyRetiredTowV12Session } from "../gameplay/tow/legacy-v12-verifier.js";
import {
  decodeRetiredTowV13Session,
  decodeTowSession,
} from "../gameplay/tow/persistence.js";
import { TOW_RULESET_ID } from "../gameplay/tow/ruleset.js";
import { deriveTowSettlementReceipt } from "../gameplay/tow/settlement.js";
import {
  MAX_TOW_COMMANDS,
  towSettlementContextForSession,
  towSessionChecksum,
} from "../gameplay/tow/session.js";

export const CAMPAIGN_SCHEMA_V12 = "v12";
export const CAMPAIGN_SCHEMA_V13 = "v13";

/** Every version a reader accepts, oldest first. */
export const READABLE_CAMPAIGN_SCHEMAS = Object.freeze([CAMPAIGN_SCHEMA_V12, CAMPAIGN_SCHEMA_V13]);

/** The version new writes carry. */
export const CURRENT_CAMPAIGN_SCHEMA = CAMPAIGN_SCHEMA_V13;

/** The sidecar's own version, independent of the campaign row's. */
export const MECHANICS_SIDECAR_VERSION = 1;
export const MAX_RETIRED_TOW_SESSION_ENCODED_BYTES = 2_000_000;

export function isReadableCampaignSchema(version) {
  return READABLE_CAMPAIGN_SCHEMAS.includes(version);
}

/** An empty sidecar: present and valid, with no character bootstrapped into it yet. */
export function emptyMechanicsSidecar() {
  return {
    version: MECHANICS_SIDECAR_VERSION,
    bootstrapId: null,
    bootstrapOrigin: null,
    build: null,
    tow: emptyTowMechanics(),
  };
}

/**
 * The Tower of Winter slot inside the sidecar, holding the durable combat session.
 *
 * It starts null and stays null through migration. A fight that was in progress under the
 * old shape genuinely cannot be recovered — the encounter lived in React state and the
 * context in a ref, and neither was ever written anywhere. Initialising this honestly to
 * null is the only truthful option; inventing a session from a half-remembered fight would
 * hand the player a fight that never happened.
 */
export function emptyTowMechanics() {
  return {
    activeCombat: null,
    readiness: {},
    companionReadiness: {},
    rewardClaims: [],
    formation: {
      version: 1,
      cells: [null, "wanderer", null, null, null, null, null, null, null],
    },
  };
}

export function hasMechanicsSidecar(state) {
  const sidecar = state?.mechanics;
  return Boolean(
    sidecar
    && typeof sidecar === "object"
    && !Array.isArray(sidecar)
    && sidecar.version === MECHANICS_SIDECAR_VERSION,
  );
}

function isPlainRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function owns(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function ownDataProperty(value, key) {
  if (!isPlainRecord(value)) return { ok: false, present: false, value: undefined };
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) return { ok: true, present: false, value: undefined };
  if (!("value" in descriptor)) return { ok: false, present: true, value: undefined };
  return { ok: true, present: true, value: descriptor.value };
}

const RETIRED_REWARD_KEYS = Object.freeze([
  "candidates",
  "claimedId",
  "id",
  "ineligible",
  "rerolled",
  "rerollsRemaining",
  "rulesetId",
  "seed",
  "sourceReceiptId",
  "version",
].sort());

const SETTLEMENT_RECEIPT_KEYS = Object.freeze([
  "combatItemsSpent",
  "fallen",
  "outcome",
  "playerHp",
  "playerResolve",
  "proficiencyGains",
  "rounds",
  "sequence",
  "sessionId",
  "version",
].sort());

function exactKeys(value, expected) {
  if (!isPlainRecord(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === expected.length
    && keys.every((key, index) => key === expected[index]);
}

function validRetiredRewardShape(reward) {
  return exactKeys(reward, RETIRED_REWARD_KEYS)
    && reward.version === 1
    && reward.rulesetId === "solitaire-tow-v1.2"
    && typeof reward.id === "string"
    && typeof reward.sourceReceiptId === "string"
    && typeof reward.seed === "string"
    && Array.isArray(reward.candidates)
    && reward.candidates.length > 0
    && reward.candidates.every((candidate) => (
      isPlainRecord(candidate)
      && ["skill", "trait"].includes(candidate.kind)
      && typeof candidate.id === "string"
      && typeof candidate.name === "string"
      && typeof candidate.detail === "string"
      && (candidate.kind === "trait"
        ? exactKeys(candidate, ["detail", "id", "kind", "name"])
        : exactKeys(candidate, ["detail", "id", "kind", "name", "requiresReplacement"])
          && typeof candidate.requiresReplacement === "boolean")
    ))
    && Array.isArray(reward.ineligible)
    && Number.isSafeInteger(reward.rerollsRemaining)
    && reward.rerollsRemaining >= 0
    && reward.rerollsRemaining <= MAX_REWARD_REROLLS
    && typeof reward.rerolled === "boolean"
    && reward.claimedId === null;
}

function validNonnegativeCounters(value) {
  return isPlainRecord(value) && Object.entries(value).every(([id, amount]) => (
    typeof id === "string"
    && id.length > 0
    && Number.isSafeInteger(amount)
    && amount >= 0
  ));
}

function validSettlementReceipt(receipt, sourceReceiptId) {
  return exactKeys(receipt, SETTLEMENT_RECEIPT_KEYS)
    && receipt.version === 1
    && receipt.sessionId === sourceReceiptId
    && receipt.outcome === "victory"
    && Number.isSafeInteger(receipt.rounds)
    && receipt.rounds > 0
    && Number.isSafeInteger(receipt.sequence)
    && receipt.sequence >= 0
    && Number.isFinite(receipt.playerHp)
    && receipt.playerHp >= 0
    && (receipt.playerResolve === null
      || (Number.isFinite(receipt.playerResolve) && receipt.playerResolve >= 0))
    && Number.isSafeInteger(receipt.fallen)
    && receipt.fallen >= 0
    && validNonnegativeCounters(receipt.combatItemsSpent)
    && validNonnegativeCounters(receipt.proficiencyGains);
}

function validSettlementLedger(state) {
  const receipts = state?.combatSettlementReceipts;
  if (receipts === undefined) return true;
  if (!Array.isArray(receipts) || receipts.length > 256) return false;
  const ids = new Set();
  return receipts.every((receipt) => {
    if (!validSettlementReceipt(receipt, receipt?.sessionId)
      || ids.has(receipt.sessionId)) return false;
    ids.add(receipt.sessionId);
    return true;
  });
}

function validRewardClaims(value) {
  if (!Array.isArray(value) || value.length > 256) return false;
  const sourceIds = new Set();
  return value.every((claim) => {
    if (!exactKeys(claim, ["claimedId", "offerId", "sourceReceiptId"])
      || typeof claim.sourceReceiptId !== "string"
      || claim.sourceReceiptId.length === 0
      || typeof claim.offerId !== "string"
      || claim.offerId.length === 0
      || typeof claim.claimedId !== "string"
      || claim.claimedId.length === 0
      || sourceIds.has(claim.sourceReceiptId)) return false;
    sourceIds.add(claim.sourceReceiptId);
    return true;
  });
}

function rewardSourceWasClaimed(state, sourceReceiptId) {
  return (state?.mechanics?.tow?.rewardClaims || []).some(
    (claim) => claim.sourceReceiptId === sourceReceiptId,
  );
}

function verifiesRetiredSessionUnderCurrentRules(session) {
  try {
    if (session?.terminalReceipt !== null
      && (!isPlainRecord(session.terminalReceipt)
        || session.terminalReceipt.rulesetId !== session.rulesetId)) return false;
    if (session.rulesetId === "solitaire-tow-v1.2") {
      return verifyRetiredTowV12Session(session).ok;
    }
    if (session.rulesetId !== "solitaire-tow-v1.3") return false;
    return decodeRetiredTowV13Session(session).ok
      && verifyRetiredTowV13Session(session).ok;
  } catch {
    return false;
  }
}

function rewardSeedDescendsFrom(baseSeed, reward, openingBudget = null) {
  if (Number.isSafeInteger(openingBudget)) {
    if (!reward.rerolled) {
      return reward.seed === baseSeed && reward.rerollsRemaining === openingBudget;
    }
    if (reward.rerollsRemaining < 0 || reward.rerollsRemaining >= openingBudget) return false;
    let derived = baseSeed;
    for (let remaining = openingBudget;
      remaining > reward.rerollsRemaining;
      remaining -= 1) {
      derived = `${derived}::reroll::${remaining}`;
    }
    return reward.seed === derived;
  }
  if (!reward.rerolled) return reward.seed === baseSeed;
  for (let opening = reward.rerollsRemaining + 1;
    opening <= MAX_REWARD_REROLLS;
    opening += 1) {
    let derived = baseSeed;
    for (let remaining = opening; remaining > reward.rerollsRemaining; remaining -= 1) {
      derived = `${derived}::reroll::${remaining}`;
    }
    if (reward.seed === derived) return true;
  }
  return false;
}

function hasRewardProvenance(state, reward, rulesetId) {
  if (rewardSourceWasClaimed(state, reward.sourceReceiptId)) return false;
  const receipt = Array.isArray(state?.combatSettlementReceipts)
    ? state.combatSettlementReceipts.find((entry) => entry?.sessionId === reward.sourceReceiptId)
    : null;
  if (!validSettlementReceipt(receipt, reward.sourceReceiptId)) return false;
  const session = state?.mechanics?.tow?.activeCombat;
  const stream = session?.terminalReceipt?.streamEndpoints?.rewards;
  const encounter = session?.encounter;
  const player = encounter?.actors?.[encounter?.playerId];
  if (!isPlainRecord(session)
    || session.version !== 1
    || session.rulesetId !== rulesetId
    || session.mode !== "campaign"
    || session.sessionId !== reward.sourceReceiptId
    || session.status !== "settled"
    || session.settlementId !== reward.sourceReceiptId
    || !isPlainRecord(stream)
    || stream.algorithm !== "mulberry32"
    || !Number.isSafeInteger(stream.state)
    || stream.state < 0
    || stream.state > 0xffff_ffff
    || reward.id !== rewardOfferIdFor(
      session.sessionId,
      rewardSeedFor(session.sessionId, stream),
    )
    || !rewardSeedDescendsFrom(
      rewardSeedFor(session.sessionId, stream),
      reward,
      rulesetId === TOW_RULESET_ID ? session.context.rewardPolicy.rerolls : null,
    )
    || encounter?.phase !== "victory"
    || encounter.round !== receipt.rounds
    || encounter.sequence !== receipt.sequence
    || player?.hp !== receipt.playerHp
    || (Number.isFinite(player?.resolve) ? player.resolve : null) !== receipt.playerResolve) {
    return false;
  }
  try {
    if (session.checksum !== towSessionChecksum(session)) return false;
    const verified = rulesetId === TOW_RULESET_ID
      ? verifyTowSession(session).ok
      : verifiesRetiredSessionUnderCurrentRules(session);
    if (!verified) return false;
    const expectedReceipt = deriveTowSettlementReceipt(
      state,
      encounter,
      towSettlementContextForSession(session),
    );
    return equalJsonData(receipt, expectedReceipt);
  } catch {
    return false;
  }
}

function hasCurrentRewardProvenance(state, reward) {
  return hasRewardProvenance(state, reward, TOW_RULESET_ID)
    || hasRewardProvenance(state, reward, "solitaire-tow-v1.2")
    || hasRewardProvenance(state, reward, "solitaire-tow-v1.3");
}

function hasValidCurrentPendingReward(state) {
  if (!owns(state, "pendingReward") || state.pendingReward === null) return true;
  return isTowBuild(state.mechanics?.build)
    && isDeterministicRewardOffer(state.mechanics.build, state.pendingReward)
    && state.pendingReward.claimedId === null
    && hasCurrentRewardProvenance(state, state.pendingReward);
}

const RETIRED_RULESET_IDS = new Set([
  "solitaire-tow-v1",
  "solitaire-tow-v1.1",
  "solitaire-tow-v1.2",
  "solitaire-tow-v1.3",
]);

function retiredTowSessionPreflight(session) {
  if (!isPlainRecord(session)) {
    return { ok: true, reason: null };
  }
  const ruleset = ownDataProperty(session, "rulesetId");
  if (!ruleset.ok) return { ok: false, reason: "invalid-retired-active-combat" };
  if (!RETIRED_RULESET_IDS.has(ruleset.value)) return { ok: true, reason: null };
  const commands = ownDataProperty(session, "commands");
  if (!commands.ok
    || !Array.isArray(commands.value)
    || commands.value.length > MAX_TOW_COMMANDS) {
    return { ok: false, reason: "invalid-retired-active-combat" };
  }
  try {
    const serialized = canonicalJsonData(session, "invalid-retired-active-combat");
    if (new TextEncoder().encode(serialized).byteLength
      > MAX_RETIRED_TOW_SESSION_ENCODED_BYTES) {
      return { ok: false, reason: "invalid-retired-active-combat" };
    }
  } catch {
    return { ok: false, reason: "invalid-retired-active-combat" };
  }
  return { ok: true, reason: null };
}

function retiredActiveCombatPreflight(state) {
  if (!isPlainRecord(state)) return { ok: true, reason: null };
  const mechanics = ownDataProperty(state, "mechanics");
  if (!mechanics.ok) return { ok: false, reason: "invalid-retired-active-combat" };
  if (!mechanics.present || !isPlainRecord(mechanics.value)) return { ok: true, reason: null };
  const tow = ownDataProperty(mechanics.value, "tow");
  if (!tow.ok) return { ok: false, reason: "invalid-retired-active-combat" };
  if (!tow.present || !isPlainRecord(tow.value)) return { ok: true, reason: null };
  const activeCombat = ownDataProperty(tow.value, "activeCombat");
  if (!activeCombat.ok) return { ok: false, reason: "invalid-retired-active-combat" };
  return retiredTowSessionPreflight(activeCombat.value);
}

export function isWritableTowActiveCombat(value) {
  if (value === null) return true;
  if (!isPlainRecord(value)) return false;
  const ruleset = ownDataProperty(value, "rulesetId");
  if (!ruleset.ok || !ruleset.present) return false;
  if (ruleset.value === TOW_RULESET_ID) {
    try {
      return decodeTowSession(value).ok
        && verifyTowSession(value).ok;
    } catch {
      return false;
    }
  }
  if (!RETIRED_RULESET_IDS.has(ruleset.value)
    || !retiredTowSessionPreflight(value).ok) return false;
  return verifiesRetiredSessionUnderCurrentRules(value);
}

function migrateRetiredPendingReward(pendingReward, build, state) {
  if (!isPlainRecord(pendingReward)) {
    return { ok: false, reason: "invalid-current-pending-reward", reward: null };
  }
  if (pendingReward.rulesetId === TOW_RULESET_ID) {
    if (!isDeterministicRewardOffer(build, pendingReward) || pendingReward.claimedId !== null) {
      return { ok: false, reason: "invalid-current-pending-reward", reward: null };
    }
    return hasCurrentRewardProvenance(state, pendingReward)
      ? { ok: true, reason: null, reward: pendingReward }
      : { ok: false, reason: "unearned-pending-reward", reward: null };
  }
  if (pendingReward.rulesetId !== "solitaire-tow-v1.2") {
    if (pendingReward.rulesetId !== "solitaire-tow-v1.3") {
      return { ok: false, reason: "unsupported-pending-reward-ruleset", reward: null };
    }
    if (!isTowBuild(build)) {
      return { ok: false, reason: "invalid-retired-pending-reward", reward: null };
    }
    if (!hasRewardProvenance(state, pendingReward, "solitaire-tow-v1.3")) {
      return { ok: false, reason: "unearned-pending-reward", reward: null };
    }
    const migrated = migrateRewardOfferToCurrentRuleset(build, pendingReward);
    return migrated.ok
      ? { ok: true, reason: null, reward: migrated.offer }
      : { ok: false, reason: "invalid-retired-pending-reward", reward: null };
  }
  if (!isTowBuild(build) || !validRetiredRewardShape(pendingReward)) {
    return { ok: false, reason: "invalid-retired-pending-reward", reward: null };
  }
  if (!hasRewardProvenance(state, pendingReward, "solitaire-tow-v1.2")) {
    return { ok: false, reason: "unearned-pending-reward", reward: null };
  }
  const recompiled = recompileRetiredRewardOffer(build, pendingReward);
  return recompiled.ok
    ? { ok: true, reason: null, reward: recompiled.offer }
    : { ok: false, reason: "invalid-retired-pending-reward", reward: null };
}

function validSavedFormation(value) {
  return isPlainRecord(value)
    && value.version === 1
    && Array.isArray(value.cells)
    && value.cells.length === 9
    && value.cells.every((cell) => cell === null || typeof cell === "string");
}

function hasMechanicsStateShape(state, activeCombatIsAccepted) {
  const sidecar = state?.mechanics;
  const tow = sidecar?.tow;
  return isPlainRecord(sidecar)
    && sidecar.version === MECHANICS_SIDECAR_VERSION
    && owns(sidecar, "bootstrapId")
    && (sidecar.bootstrapId === null || typeof sidecar.bootstrapId === "string")
    && owns(sidecar, "build")
    && (sidecar.build === null || isTowBuild(sidecar.build))
    && isPlainRecord(tow)
    && owns(tow, "activeCombat")
    && activeCombatIsAccepted(tow.activeCombat)
    && isPlainRecord(tow.readiness)
    && isPlainRecord(tow.companionReadiness)
    && validRewardClaims(tow.rewardClaims)
    && validSavedFormation(tow.formation)
    && validSettlementLedger(state)
    && hasValidCurrentPendingReward(state);
}

// Cheap, non-mutating write-time check. Hydration performs the expensive clone +
// read-back proof once; autosave only needs to prove that the required current
// sidecar shape is present before stamping the database schema version.
export function hasCurrentMechanicsState(state) {
  return hasMechanicsStateShape(state, isWritableTowActiveCombat);
}

export function canCommitTowSession(state, session) {
  const sourceReceiptId = state?.pendingReward?.sourceReceiptId;
  return typeof sourceReceiptId !== "string"
    || sourceReceiptId.length === 0
    || session?.sessionId === sourceReceiptId;
}

function hasRecoverableMechanicsState(state) {
  return hasMechanicsStateShape(
    state,
    (activeCombat) => {
      if (activeCombat === null) return true;
      if (!isPlainRecord(activeCombat)) return false;
      if (RETIRED_RULESET_IDS.has(activeCombat.rulesetId)) return true;
      if (activeCombat.rulesetId !== TOW_RULESET_ID
        || typeof activeCombat.checksum !== "string") return false;
      try {
        // A damaged current record must remain visible so the player can discard it.
        // A checksum-valid but replay-invalid current record is a semantic forgery, not
        // recoverable legacy data, and stays behind the fail-closed hydration gate.
        return activeCombat.checksum !== towSessionChecksum(activeCombat);
      } catch {
        return false;
      }
    },
  );
}

/**
 * Migrate a campaign state to the current schema.
 *
 * Pure and idempotent: migrating an already-migrated state returns an equal state, so a
 * warm resume that runs the upgrade twice cannot double-write.
 *
 * A legacy `activeCombatSession` is deliberately left untouched. The plan quarantines it
 * rather than converting or discarding it — a fight already in progress under the old
 * session shape stays finishable, and no new one can start.
 */
export function migrateCampaignState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return { ok: false, reason: "invalid-campaign-state", state: null };
  }
  const retiredPreflight = retiredActiveCombatPreflight(state);
  if (!retiredPreflight.ok) {
    return { ok: false, reason: retiredPreflight.reason, state: null };
  }
  let next;
  try {
    next = cloneJsonData(state, "invalid-campaign-state");
  } catch {
    return { ok: false, reason: "invalid-campaign-state", state: null };
  }

  if (!owns(next, "mechanics")) {
    next.mechanics = emptyMechanicsSidecar();
  } else {
    // Never reinterpret or replace a sidecar written by a newer client. Losing a
    // durable build or active combat is worse than refusing to open the campaign.
    if (!isPlainRecord(next.mechanics) || next.mechanics.version !== MECHANICS_SIDECAR_VERSION) {
      return { ok: false, reason: "unsupported-mechanics-sidecar", state: null };
    }
    if ((owns(next.mechanics, "bootstrapId")
      && next.mechanics.bootstrapId !== null
      && typeof next.mechanics.bootstrapId !== "string")
      || (owns(next.mechanics, "build")
        && next.mechanics.build !== null
        && !isPlainRecord(next.mechanics.build))) {
      return { ok: false, reason: "invalid-build-mechanics", state: null };
    }
    if (owns(next.mechanics, "tow") && !isPlainRecord(next.mechanics.tow)) {
      return { ok: false, reason: "invalid-tow-mechanics", state: null };
    }
    const suppliedTow = next.mechanics.tow || {};
    if ((owns(suppliedTow, "activeCombat")
      && suppliedTow.activeCombat !== null
      && !isPlainRecord(suppliedTow.activeCombat))
      || (owns(suppliedTow, "readiness") && !isPlainRecord(suppliedTow.readiness))
      || (owns(suppliedTow, "companionReadiness")
        && !isPlainRecord(suppliedTow.companionReadiness))) {
      return { ok: false, reason: "invalid-tow-mechanics", state: null };
    }
    if (owns(next.mechanics.tow || {}, "formation")
      && !validSavedFormation(next.mechanics.tow.formation)) {
      return { ok: false, reason: "unsupported-saved-formation", state: null };
    }

    if (isLegacyTowBuild(next.mechanics.build)) {
      const migratedBuild = migrateLegacyTowBuild(next.mechanics.build);
      if (!migratedBuild) return { ok: false, reason: "invalid-legacy-tow-build", state: null };
      next.mechanics.build = migratedBuild;
    }

    // Older v1 sidecars may predate one or more Tower fields. Backfill only
    // absent keys; every existing value and every unknown key survives exactly.
    const defaults = emptyTowMechanics();
    const existingTow = next.mechanics.tow || {};
    next.mechanics = {
      bootstrapId: null,
      build: null,
      ...next.mechanics,
      tow: {
        ...defaults,
        ...existingTow,
      },
    };
  }

  if (owns(next, "pendingReward") && next.pendingReward !== null) {
    const migratedReward = migrateRetiredPendingReward(
      next.pendingReward,
      next.mechanics.build,
      next,
    );
    if (!migratedReward.ok) {
      return { ok: false, reason: migratedReward.reason, state: null };
    }
    next.pendingReward = migratedReward.reward;
  }

  return { ok: true, reason: null, state: next };
}

/**
 * Prove a migration added only what it was supposed to.
 *
 * Everything outside the sidecar must survive byte-for-byte. This is what lets the
 * migration be trusted on a real save: it is checked against the original rather than
 * assumed correct.
 */
export function verifyMigrationReadBack(original, migrated) {
  if (!original || !migrated) return { ok: false, reason: "missing-payload" };

  const strippedOriginal = { ...original };
  const strippedMigrated = { ...migrated };
  delete strippedOriginal.mechanics;
  delete strippedMigrated.mechanics;

  if (owns(strippedOriginal, "pendingReward") && strippedOriginal.pendingReward !== null) {
    const expectedReward = migrateRetiredPendingReward(
      strippedOriginal.pendingReward,
      migrated.mechanics?.build,
      original,
    );
    if (!expectedReward.ok) return { ok: false, reason: expectedReward.reason };
    strippedOriginal.pendingReward = expectedReward.reward;
  }

  try {
    if (!equalJsonData(strippedOriginal, strippedMigrated)) {
      return { ok: false, reason: "migration-altered-existing-state" };
    }
  } catch {
    return { ok: false, reason: "unverifiable-payload" };
  }

  if (!hasMechanicsSidecar(migrated)) return { ok: false, reason: "sidecar-missing" };

  // A migration must never invent a bootstrapped character.
  const sidecar = migrated.mechanics;
  const original_ = original.mechanics;
  if (!original_ && (sidecar.bootstrapId !== null || sidecar.build !== null)) {
    return { ok: false, reason: "migration-invented-a-build" };
  }

  if (original_) {
    // Compare the whole pre-existing sidecar after removing only the exact v1
    // defaults this migration is allowed to add. This proves an active combat,
    // build, readiness map, or future extension was not rewritten in transit.
    let comparable;
    try {
      comparable = cloneJsonData(sidecar, "unverifiable-payload");
    } catch {
      return { ok: false, reason: "unverifiable-payload" };
    }
    if (!owns(original_, "tow")) {
      delete comparable.tow;
    } else {
      for (const key of Object.keys(emptyTowMechanics())) {
        if (!owns(original_.tow, key)) delete comparable.tow[key];
      }
    }
    for (const key of ["bootstrapId", "build"]) {
      if (!owns(original_, key)) delete comparable[key];
    }
    let expectedOriginal = original_;
    if (isLegacyTowBuild(original_.build)) {
      const migratedBuild = migrateLegacyTowBuild(original_.build);
      if (!migratedBuild) return { ok: false, reason: "invalid-legacy-tow-build" };
      expectedOriginal = { ...original_, build: migratedBuild };
    }
    try {
      if (!equalJsonData(expectedOriginal, comparable)) {
        return { ok: false, reason: "migration-altered-existing-mechanics" };
      }
    } catch {
      return { ok: false, reason: "unverifiable-payload" };
    }
  }

  return { ok: true, reason: null };
}

/**
 * The safe upgrade path: migrate, verify, and only then hand back something writable.
 *
 * On failure the original payload is returned unchanged only for diagnostics or an
 * explicit recovery/export path. It is never writable or safe to hydrate as current.
 */
export function upgradeCampaignPayload(state) {
  const migrated = migrateCampaignState(state);
  if (!migrated.ok) {
    return { ok: false, reason: migrated.reason, state, writable: false };
  }
  const verified = verifyMigrationReadBack(state, migrated.state);
  if (!verified.ok) {
    return { ok: false, reason: verified.reason, state, writable: false };
  }
  if (!hasCurrentMechanicsState(migrated.state)) {
    if (hasRecoverableMechanicsState(migrated.state)) {
      return {
        ok: true,
        reason: "unwritable-active-combat",
        state: migrated.state,
        writable: false,
        recoverable: true,
      };
    }
    return { ok: false, reason: "invalid-current-mechanics-state", state, writable: false };
  }
  return {
    ok: true,
    reason: null,
    state: migrated.state,
    writable: true,
    recoverable: false,
  };
}
