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
  isLegacyCombatBuild,
  isCombatBuild,
  migrateLegacyCombatBuild,
} from "../gameplay/combat/build.js";
import {
  isDeterministicRewardOffer,
  isValidRewardClaimLedger,
  MAX_REWARD_REROLLS,
  migrateRewardOfferToCurrentRuleset,
  recompileRetiredRewardOffer,
  rewardOfferIdFor,
  rewardSeedFor,
} from "../gameplay/combat/rewards.js";
import {
  verifyCombatSession,
} from "../gameplay/combat/replay.js";
import {
  decodeCombatSession,
} from "../gameplay/combat/persistence.js";
import { COMBAT_RULESET_ID } from "../gameplay/combat/ruleset.js";
import { deriveCombatSettlementReceipt } from "../gameplay/combat/settlement.js";
import {
  MAX_COMBAT_COMMANDS,
  combatSettlementContextForSession,
  combatSessionChecksum,
} from "../gameplay/combat/session.js";

export const CAMPAIGN_SCHEMA_V12 = "v12";
export const CAMPAIGN_SCHEMA_V13 = "v13";

/** Every version a reader accepts, oldest first. */
export const READABLE_CAMPAIGN_SCHEMAS = Object.freeze([CAMPAIGN_SCHEMA_V12, CAMPAIGN_SCHEMA_V13]);

/** The version new writes carry. */
export const CURRENT_CAMPAIGN_SCHEMA = CAMPAIGN_SCHEMA_V13;

/** The sidecar's own version, independent of the campaign row's. */
export const MECHANICS_SIDECAR_VERSION = 1;
export const MAX_RETIRED_COMBAT_SESSION_ENCODED_BYTES = 2_000_000;

export function isReadableCampaignSchema(version) {
  return READABLE_CAMPAIGN_SCHEMAS.includes(version);
}

/** An empty sidecar: present and valid, with no character bootstrapped into it yet. */
export function emptyMechanicsSidecar() {
  return {
    version: MECHANICS_SIDECAR_VERSION,
    campaignId: null,
    campaignRevision: 0,
    bootstrapId: null,
    bootstrapOrigin: null,
    bootstrapSetupChecksum: null,
    build: null,
    combat: emptyCombatMechanics(),
  };
}

/**
 * The Solitaire combat slot inside the sidecar, holding the durable combat session.
 *
 * It starts null and stays null through migration. A fight that was in progress under the
 * old shape genuinely cannot be recovered — the encounter lived in React state and the
 * context in a ref, and neither was ever written anywhere. Initialising this honestly to
 * null is the only truthful option; inventing a session from a half-remembered fight would
 * hand the player a fight that never happened.
 */
export function emptyCombatMechanics() {
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

// Read-only aliases from the two broken/intermediate clients. They exist only
// at this migration boundary; every hydrated campaign writes `mechanics.combat`.
const LEGACY_COMBAT_SLOT_KEY = ["t", "o", "w"].join("");
const BROKEN_RECOVERY_SLOT_KEY = "archetype";

function persistedCombatSlot(sidecar) {
  if (!isPlainRecord(sidecar)) return { key: null, value: undefined };
  if (owns(sidecar, "combat")) return { key: "combat", value: sidecar.combat };
  if (owns(sidecar, BROKEN_RECOVERY_SLOT_KEY)) {
    return { key: BROKEN_RECOVERY_SLOT_KEY, value: sidecar[BROKEN_RECOVERY_SLOT_KEY] };
  }
  if (owns(sidecar, LEGACY_COMBAT_SLOT_KEY)) {
    return { key: LEGACY_COMBAT_SLOT_KEY, value: sidecar[LEGACY_COMBAT_SLOT_KEY] };
  }
  return { key: null, value: undefined };
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

const LEGACY_SETTLEMENT_RECEIPT_KEYS = Object.freeze([
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
const SETTLEMENT_RECEIPT_KEYS = Object.freeze([
  ...LEGACY_SETTLEMENT_RECEIPT_KEYS,
  "campaignId",
  "campaignRevision",
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
    && reward.rulesetId === "solitaire-combat-v1.2"
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
  const currentShape = exactKeys(receipt, SETTLEMENT_RECEIPT_KEYS);
  return (currentShape || exactKeys(receipt, LEGACY_SETTLEMENT_RECEIPT_KEYS))
    && (!currentShape || (
      (receipt.campaignId === null
        || (typeof receipt.campaignId === "string" && receipt.campaignId.length > 0))
      && Number.isSafeInteger(receipt.campaignRevision)
      && receipt.campaignRevision >= 0
    ))
    && receipt.version === 1
    && receipt.sessionId === sourceReceiptId
    && ["victory", "defeat", "retreated"].includes(receipt.outcome)
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
    if (exactKeys(receipt, SETTLEMENT_RECEIPT_KEYS)
      && (receipt.campaignId !== state?.mechanics?.campaignId
        || receipt.campaignRevision > state?.mechanics?.campaignRevision)) return false;
    ids.add(receipt.sessionId);
    return true;
  });
}

function validRewardClaims(value, build, receipts) {
  if (!Array.isArray(value) || value.length > 256) return false;
  if (value.length === 0) return true;
  if (!isCombatBuild(build) || !isValidRewardClaimLedger(build, value)) return false;
  const receiptById = new Map((receipts || []).map((receipt) => [receipt?.sessionId, receipt]));
  return value.every((claim) => {
    const receipt = receiptById.get(claim.sourceReceiptId);
    return validSettlementReceipt(receipt, claim.sourceReceiptId)
      && receipt.outcome === "victory";
  });
}

function rewardSourceWasClaimed(state, sourceReceiptId) {
  return (state?.mechanics?.combat?.rewardClaims || []).some(
    (claim) => claim.sourceReceiptId === sourceReceiptId,
  );
}

function verifiesRetiredSessionUnderCurrentRules(session) {
  void session;
  // Retired executors were physically removed. Their records remain readable
  // only long enough for explicit discard/export; they never execute as current.
  return false;
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
  const session = state?.mechanics?.combat?.activeCombat;
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
      rulesetId === COMBAT_RULESET_ID ? session.context.rewardPolicy.rerolls : null,
    )
    || encounter?.phase !== "victory"
    || encounter.round !== receipt.rounds
    || encounter.sequence !== receipt.sequence
    || player?.hp !== receipt.playerHp
    || (Number.isFinite(player?.resolve) ? player.resolve : null) !== receipt.playerResolve) {
    return false;
  }
  try {
    if (session.checksum !== combatSessionChecksum(session)) return false;
    const verified = rulesetId === COMBAT_RULESET_ID
      ? verifyCombatSession(session).ok
      : verifiesRetiredSessionUnderCurrentRules(session);
    if (!verified) return false;
    const expectedReceipt = deriveCombatSettlementReceipt(
      state,
      encounter,
      combatSettlementContextForSession(session),
    );
    if (exactKeys(receipt, LEGACY_SETTLEMENT_RECEIPT_KEYS)) {
      delete expectedReceipt.campaignId;
      delete expectedReceipt.campaignRevision;
    }
    return equalJsonData(receipt, expectedReceipt);
  } catch {
    return false;
  }
}

function hasCurrentRewardProvenance(state, reward) {
  return hasRewardProvenance(state, reward, COMBAT_RULESET_ID)
    || hasRewardProvenance(state, reward, "solitaire-combat-v1.2")
    || hasRewardProvenance(state, reward, "solitaire-combat-v1.3");
}

function hasValidCurrentPendingReward(state) {
  if (!owns(state, "pendingReward") || state.pendingReward === null) return true;
  return isCombatBuild(state.mechanics?.build)
    && isDeterministicRewardOffer(state.mechanics.build, state.pendingReward)
    && state.pendingReward.claimedId === null
    && hasCurrentRewardProvenance(state, state.pendingReward);
}

const RETIRED_RULESET_IDS = new Set([
  "solitaire-combat-v1",
  "solitaire-combat-v1.1",
  "solitaire-combat-v1.2",
  "solitaire-combat-v1.3",
]);

function retiredCombatSessionPreflight(session) {
  if (!isPlainRecord(session)) {
    return { ok: true, reason: null };
  }
  const ruleset = ownDataProperty(session, "rulesetId");
  if (!ruleset.ok) return { ok: false, reason: "invalid-retired-active-combat" };
  if (!RETIRED_RULESET_IDS.has(ruleset.value)) return { ok: true, reason: null };
  const commands = ownDataProperty(session, "commands");
  if (!commands.ok
    || !Array.isArray(commands.value)
    || commands.value.length > MAX_COMBAT_COMMANDS) {
    return { ok: false, reason: "invalid-retired-active-combat" };
  }
  try {
    const serialized = canonicalJsonData(session, "invalid-retired-active-combat");
    if (new TextEncoder().encode(serialized).byteLength
      > MAX_RETIRED_COMBAT_SESSION_ENCODED_BYTES) {
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
  const slot = persistedCombatSlot(mechanics.value);
  if (slot.key === null || !isPlainRecord(slot.value)) return { ok: true, reason: null };
  const activeCombat = ownDataProperty(slot.value, "activeCombat");
  if (!activeCombat.ok) return { ok: false, reason: "invalid-retired-active-combat" };
  return retiredCombatSessionPreflight(activeCombat.value);
}

export function isWritableCombatActiveCombat(value) {
  if (value === null) return true;
  if (!isPlainRecord(value)) return false;
  const ruleset = ownDataProperty(value, "rulesetId");
  if (!ruleset.ok || !ruleset.present) return false;
  if (ruleset.value === COMBAT_RULESET_ID) {
    try {
      return decodeCombatSession(value).ok
        && verifyCombatSession(value).ok;
    } catch {
      return false;
    }
  }
  if (!RETIRED_RULESET_IDS.has(ruleset.value)
    || !retiredCombatSessionPreflight(value).ok) return false;
  return verifiesRetiredSessionUnderCurrentRules(value);
}

function migrateRetiredPendingReward(pendingReward, build, state) {
  if (!isPlainRecord(pendingReward)) {
    return { ok: false, reason: "invalid-current-pending-reward", reward: null };
  }
  if (pendingReward.rulesetId === COMBAT_RULESET_ID) {
    if (!isDeterministicRewardOffer(build, pendingReward) || pendingReward.claimedId !== null) {
      return { ok: false, reason: "invalid-current-pending-reward", reward: null };
    }
    return hasCurrentRewardProvenance(state, pendingReward)
      ? { ok: true, reason: null, reward: pendingReward }
      : { ok: false, reason: "unearned-pending-reward", reward: null };
  }
  if (pendingReward.rulesetId !== "solitaire-combat-v1.2") {
    if (pendingReward.rulesetId !== "solitaire-combat-v1.3") {
      return { ok: false, reason: "unsupported-pending-reward-ruleset", reward: null };
    }
    if (!isCombatBuild(build)) {
      return { ok: false, reason: "invalid-retired-pending-reward", reward: null };
    }
    if (!hasRewardProvenance(state, pendingReward, "solitaire-combat-v1.3")) {
      return { ok: false, reason: "unearned-pending-reward", reward: null };
    }
    const migrated = migrateRewardOfferToCurrentRuleset(build, pendingReward);
    return migrated.ok
      ? { ok: true, reason: null, reward: migrated.offer }
      : { ok: false, reason: "invalid-retired-pending-reward", reward: null };
  }
  if (!isCombatBuild(build) || !validRetiredRewardShape(pendingReward)) {
    return { ok: false, reason: "invalid-retired-pending-reward", reward: null };
  }
  if (!hasRewardProvenance(state, pendingReward, "solitaire-combat-v1.2")) {
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
  const tow = sidecar?.combat;
  return isPlainRecord(sidecar)
    && sidecar.version === MECHANICS_SIDECAR_VERSION
    && owns(sidecar, "campaignId")
    && (sidecar.campaignId === null
      || (typeof sidecar.campaignId === "string" && sidecar.campaignId.length > 0))
    && Number.isSafeInteger(sidecar.campaignRevision)
    && sidecar.campaignRevision >= 0
    && owns(sidecar, "bootstrapId")
    && owns(sidecar, "bootstrapOrigin")
    && owns(sidecar, "bootstrapSetupChecksum")
    && owns(sidecar, "build")
    && ((sidecar.bootstrapId === null
      && sidecar.bootstrapOrigin === null
      && sidecar.bootstrapSetupChecksum === null
      && sidecar.build === null)
      || (typeof sidecar.bootstrapId === "string"
        && sidecar.bootstrapId.length > 0
        && typeof sidecar.bootstrapOrigin === "string"
        && sidecar.bootstrapOrigin.length > 0
        && (sidecar.bootstrapSetupChecksum === null
          || (typeof sidecar.bootstrapSetupChecksum === "string"
            && /^[0-9a-f]{16}$/.test(sidecar.bootstrapSetupChecksum)))
        && isCombatBuild(sidecar.build)))
    && isPlainRecord(tow)
    && owns(tow, "activeCombat")
    && activeCombatIsAccepted(tow.activeCombat)
    && isPlainRecord(tow.readiness)
    && isPlainRecord(tow.companionReadiness)
    && validRewardClaims(
      tow.rewardClaims,
      sidecar.build,
      state.combatSettlementReceipts || [],
    )
    && validSavedFormation(tow.formation)
    && validSettlementLedger(state)
    && Array.isArray(state.lootClaimReceipts || [])
    && (state.lootClaimReceipts || []).every((id) => typeof id === "string" && id.length > 0)
    && new Set(state.lootClaimReceipts || []).size === (state.lootClaimReceipts || []).length
    && hasValidCurrentPendingReward(state);
}

// Cheap, non-mutating write-time check. Hydration performs the expensive clone +
// read-back proof once; autosave only needs to prove that the required current
// sidecar shape is present before stamping the database schema version.
export function hasCurrentMechanicsState(state) {
  return hasMechanicsStateShape(state, isWritableCombatActiveCombat);
}

export function canCommitCombatSession(state, session) {
  if ((state?.mechanics?.campaignId ?? null) !== (session?.context?.campaignId ?? null)
    || state?.mechanics?.campaignRevision !== session?.context?.campaignRevision) return false;
  if (state?.pendingLoot !== null && state?.pendingLoot !== undefined) return false;
  const sourceReceiptId = state?.pendingReward?.sourceReceiptId;
  return typeof sourceReceiptId !== "string" || sourceReceiptId.length === 0;
}

function hasRecoverableMechanicsState(state) {
  return hasMechanicsStateShape(
    state,
    (activeCombat) => {
      if (activeCombat === null) return true;
      if (!isPlainRecord(activeCombat)) return false;
      if (RETIRED_RULESET_IDS.has(activeCombat.rulesetId)) return true;
      if (activeCombat.rulesetId !== COMBAT_RULESET_ID
        || typeof activeCombat.checksum !== "string") return false;
      try {
        // A damaged current record must remain visible so the player can discard it.
        // A checksum-valid but replay-invalid current record is a semantic forgery, not
        // recoverable legacy data, and stays behind the fail-closed hydration gate.
        return activeCombat.checksum !== combatSessionChecksum(activeCombat);
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
    if ((owns(next.mechanics, "campaignId")
      && next.mechanics.campaignId !== null
      && (typeof next.mechanics.campaignId !== "string"
        || next.mechanics.campaignId.length === 0))
      || (owns(next.mechanics, "campaignRevision")
        && (!Number.isSafeInteger(next.mechanics.campaignRevision)
          || next.mechanics.campaignRevision < 0))
      || (owns(next.mechanics, "bootstrapId")
      && next.mechanics.bootstrapId !== null
      && typeof next.mechanics.bootstrapId !== "string")
      || (owns(next.mechanics, "build")
        && next.mechanics.build !== null
        && !isPlainRecord(next.mechanics.build))) {
      return { ok: false, reason: "invalid-build-mechanics", state: null };
    }
    const suppliedSlot = persistedCombatSlot(next.mechanics);
    if (suppliedSlot.key !== null && !isPlainRecord(suppliedSlot.value)) {
      return { ok: false, reason: "invalid-combat-mechanics", state: null };
    }
    const suppliedCombat = suppliedSlot.value || {};
    if ((owns(suppliedCombat, "activeCombat")
      && suppliedCombat.activeCombat !== null
      && !isPlainRecord(suppliedCombat.activeCombat))
      || (owns(suppliedCombat, "readiness") && !isPlainRecord(suppliedCombat.readiness))
      || (owns(suppliedCombat, "companionReadiness")
        && !isPlainRecord(suppliedCombat.companionReadiness))) {
      return { ok: false, reason: "invalid-combat-mechanics", state: null };
    }
    if (owns(suppliedCombat, "formation")
      && !validSavedFormation(suppliedCombat.formation)) {
      return { ok: false, reason: "unsupported-saved-formation", state: null };
    }

    if (isLegacyCombatBuild(next.mechanics.build)) {
      const migratedBuild = migrateLegacyCombatBuild(next.mechanics.build);
      if (!migratedBuild) return { ok: false, reason: "invalid-legacy-combat-build", state: null };
      next.mechanics.build = migratedBuild;
    }

    // Older v1 sidecars may predate one or more combat fields. Backfill only
    // absent keys; every existing value and every unknown key survives exactly.
    const defaults = emptyCombatMechanics();
    const existingCombat = suppliedCombat;
    const normalizedMechanics = { ...next.mechanics };
    delete normalizedMechanics[BROKEN_RECOVERY_SLOT_KEY];
    delete normalizedMechanics[LEGACY_COMBAT_SLOT_KEY];
    next.mechanics = {
      campaignId: null,
      campaignRevision: 0,
      bootstrapId: null,
      bootstrapOrigin: null,
      bootstrapSetupChecksum: null,
      build: null,
      ...normalizedMechanics,
      combat: {
        ...defaults,
        ...existingCombat,
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
    const originalSlot = persistedCombatSlot(original_);
    if (originalSlot.key === null) {
      delete comparable.combat;
    } else {
      for (const key of Object.keys(emptyCombatMechanics())) {
        if (!owns(originalSlot.value, key)) delete comparable.combat[key];
      }
    }
    for (const key of [
      "campaignId",
      "campaignRevision",
      "bootstrapId",
      "build",
    ]) {
      if (!owns(original_, key)) delete comparable[key];
    }
    let expectedOriginal = { ...original_ };
    delete expectedOriginal[BROKEN_RECOVERY_SLOT_KEY];
    delete expectedOriginal[LEGACY_COMBAT_SLOT_KEY];
    if (originalSlot.key !== null) expectedOriginal.combat = originalSlot.value;
    if (isLegacyCombatBuild(original_.build)) {
      const migratedBuild = migrateLegacyCombatBuild(original_.build);
      if (!migratedBuild) return { ok: false, reason: "invalid-legacy-combat-build" };
      expectedOriginal = { ...expectedOriginal, build: migratedBuild };
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
