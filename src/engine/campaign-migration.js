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

import { cloneJsonData, equalJsonData } from "../gameplay/kernel/json-data.js";
import {
  isLegacyCombatBuild,
  isCombatBuild,
  migrateLegacyCombatBuild,
} from "../gameplay/combat/build.js";
import {
  compileRewardOffer,
  isDeterministicRewardOffer,
} from "../gameplay/combat/rewards.js";
import { COMBAT_RULESET_ID } from "../gameplay/combat/ruleset.js";

export const CAMPAIGN_SCHEMA_V12 = "v12";
export const CAMPAIGN_SCHEMA_V13 = "v13";

/** Every version a reader accepts, oldest first. */
export const READABLE_CAMPAIGN_SCHEMAS = Object.freeze([CAMPAIGN_SCHEMA_V12, CAMPAIGN_SCHEMA_V13]);

/** The version new writes carry. */
export const CURRENT_CAMPAIGN_SCHEMA = CAMPAIGN_SCHEMA_V13;

/** The sidecar's own version, independent of the campaign row's. */
export const MECHANICS_SIDECAR_VERSION = 1;

// Save-field aliases from the two immediately preceding clients. Keep these at
// the persistence boundary only; all live state uses `mechanics.combat`.
const LEGACY_COMBAT_SLOT_KEY = ["t", "o", "w"].join("");
const BROKEN_RECOVERY_SLOT_KEY = "archetype";

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

function persistedCombatSlot(sidecar) {
  if (owns(sidecar, "combat")) return { key: "combat", value: sidecar.combat };
  if (owns(sidecar, BROKEN_RECOVERY_SLOT_KEY)) {
    return { key: BROKEN_RECOVERY_SLOT_KEY, value: sidecar[BROKEN_RECOVERY_SLOT_KEY] };
  }
  if (owns(sidecar, LEGACY_COMBAT_SLOT_KEY)) {
    return { key: LEGACY_COMBAT_SLOT_KEY, value: sidecar[LEGACY_COMBAT_SLOT_KEY] };
  }
  return { key: null, value: undefined };
}

function hasVictorySettlementReceipt(state, sourceReceiptId) {
  return Array.isArray(state?.combatSettlementReceipts)
    && state.combatSettlementReceipts.some((receipt) => (
      isPlainRecord(receipt)
      && receipt.sessionId === sourceReceiptId
      && receipt.outcome === "victory"
    ));
}

function hasValidCurrentPendingReward(state) {
  if (!owns(state, "pendingReward") || state.pendingReward === null) return true;
  return isCombatBuild(state.mechanics?.build)
    && isDeterministicRewardOffer(state.mechanics.build, state.pendingReward)
    && state.pendingReward.claimedId === null
    && hasVictorySettlementReceipt(state, state.pendingReward.sourceReceiptId);
}

function migrateRetiredPendingReward(pendingReward, build, state) {
  if (!isPlainRecord(pendingReward)) {
    return { ok: false, reason: "invalid-current-pending-reward", reward: null };
  }
  if (pendingReward.rulesetId === COMBAT_RULESET_ID) {
    if (!isDeterministicRewardOffer(build, pendingReward) || pendingReward.claimedId !== null) {
      return { ok: false, reason: "invalid-current-pending-reward", reward: null };
    }
    return hasVictorySettlementReceipt(state, pendingReward.sourceReceiptId)
      ? { ok: true, reason: null, reward: pendingReward }
      : { ok: false, reason: "unearned-pending-reward", reward: null };
  }
  if (pendingReward.rulesetId !== "solitaire-combat-v1.2") {
    return { ok: false, reason: "unsupported-pending-reward-ruleset", reward: null };
  }
  if (!isCombatBuild(build)
    || typeof pendingReward.sourceReceiptId !== "string"
    || typeof pendingReward.seed !== "string"
    || !Number.isSafeInteger(pendingReward.rerollsRemaining)
    || pendingReward.rerollsRemaining < 0
    || pendingReward.rerollsRemaining > 4
    || pendingReward.claimedId !== null) {
    return { ok: false, reason: "invalid-retired-pending-reward", reward: null };
  }
  if (!hasVictorySettlementReceipt(state, pendingReward.sourceReceiptId)) {
    return { ok: false, reason: "unearned-pending-reward", reward: null };
  }
  const compiled = compileRewardOffer(build, {
    sourceReceiptId: pendingReward.sourceReceiptId,
    seed: pendingReward.seed,
    rerolls: pendingReward.rerollsRemaining,
  });
  if (!compiled.ok) {
    return { ok: false, reason: "invalid-retired-pending-reward", reward: null };
  }
  return {
    ok: true,
    reason: null,
    reward: compiled.offer,
  };
}

function validSavedFormation(value) {
  return isPlainRecord(value)
    && value.version === 1
    && Array.isArray(value.cells)
    && value.cells.length === 9
    && value.cells.every((cell) => cell === null || typeof cell === "string");
}

// Cheap, non-mutating write-time check. Hydration performs the expensive clone +
// read-back proof once; autosave only needs to prove that the required current
// sidecar shape is present before stamping the database schema version.
export function hasCurrentMechanicsState(state) {
  const sidecar = state?.mechanics;
  const combat = sidecar?.combat;
  return isPlainRecord(sidecar)
    && sidecar.version === MECHANICS_SIDECAR_VERSION
    && owns(sidecar, "bootstrapId")
    && (sidecar.bootstrapId === null || typeof sidecar.bootstrapId === "string")
    && owns(sidecar, "build")
    && (sidecar.build === null || isCombatBuild(sidecar.build))
    && isPlainRecord(combat)
    && owns(combat, "activeCombat")
    && (combat.activeCombat === null || isPlainRecord(combat.activeCombat))
    && isPlainRecord(combat.readiness)
    && isPlainRecord(combat.companionReadiness)
    && validSavedFormation(combat.formation)
    && hasValidCurrentPendingReward(state);
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
    next.mechanics = {
      bootstrapId: null,
      build: null,
      ...next.mechanics,
      combat: {
        ...defaults,
        ...suppliedCombat,
      },
    };
    delete next.mechanics[BROKEN_RECOVERY_SLOT_KEY];
    delete next.mechanics[LEGACY_COMBAT_SLOT_KEY];
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
    const originalCombatSlot = persistedCombatSlot(original_);
    if (originalCombatSlot.key === null) {
      delete comparable.combat;
    } else {
      for (const key of Object.keys(emptyCombatMechanics())) {
        if (!owns(originalCombatSlot.value, key)) delete comparable.combat[key];
      }
    }
    for (const key of ["bootstrapId", "build"]) {
      if (!owns(original_, key)) delete comparable[key];
    }
    let expectedOriginal = original_;
    if (originalCombatSlot.key !== null && originalCombatSlot.key !== "combat") {
      expectedOriginal = { ...expectedOriginal, combat: originalCombatSlot.value };
      delete expectedOriginal[originalCombatSlot.key];
    }
    if (isLegacyCombatBuild(original_.build)) {
      const migratedBuild = migrateLegacyCombatBuild(original_.build);
      if (!migratedBuild) return { ok: false, reason: "invalid-legacy-combat-build" };
      expectedOriginal = { ...original_, build: migratedBuild };
      if (originalCombatSlot.key !== null && originalCombatSlot.key !== "combat") {
        expectedOriginal.combat = originalCombatSlot.value;
        delete expectedOriginal[originalCombatSlot.key];
      }
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
    return { ok: false, reason: "invalid-current-mechanics-state", state, writable: false };
  }
  return { ok: true, reason: null, state: migrated.state, writable: true };
}
