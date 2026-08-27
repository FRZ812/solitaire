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
  isLegacyTowBuild,
  isTowBuild,
  migrateLegacyTowBuild,
} from "../gameplay/tow/build.js";
import {
  compileRewardOffer,
  isDeterministicRewardOffer,
} from "../gameplay/tow/rewards.js";
import { TOW_RULESET_ID } from "../gameplay/tow/ruleset.js";

export const CAMPAIGN_SCHEMA_V12 = "v12";
export const CAMPAIGN_SCHEMA_V13 = "v13";

/** Every version a reader accepts, oldest first. */
export const READABLE_CAMPAIGN_SCHEMAS = Object.freeze([CAMPAIGN_SCHEMA_V12, CAMPAIGN_SCHEMA_V13]);

/** The version new writes carry. */
export const CURRENT_CAMPAIGN_SCHEMA = CAMPAIGN_SCHEMA_V13;

/** The sidecar's own version, independent of the campaign row's. */
export const MECHANICS_SIDECAR_VERSION = 1;

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
  return isTowBuild(state.mechanics?.build)
    && isDeterministicRewardOffer(state.mechanics.build, state.pendingReward)
    && state.pendingReward.claimedId === null
    && hasVictorySettlementReceipt(state, state.pendingReward.sourceReceiptId);
}

function migrateRetiredPendingReward(pendingReward, build, state) {
  if (!isPlainRecord(pendingReward)) {
    return { ok: false, reason: "invalid-current-pending-reward", reward: null };
  }
  if (pendingReward.rulesetId === TOW_RULESET_ID) {
    if (!isDeterministicRewardOffer(build, pendingReward) || pendingReward.claimedId !== null) {
      return { ok: false, reason: "invalid-current-pending-reward", reward: null };
    }
    return hasVictorySettlementReceipt(state, pendingReward.sourceReceiptId)
      ? { ok: true, reason: null, reward: pendingReward }
      : { ok: false, reason: "unearned-pending-reward", reward: null };
  }
  if (pendingReward.rulesetId !== "solitaire-tow-v1.2") {
    return { ok: false, reason: "unsupported-pending-reward-ruleset", reward: null };
  }
  if (!isTowBuild(build)
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
  const tow = sidecar?.tow;
  return isPlainRecord(sidecar)
    && sidecar.version === MECHANICS_SIDECAR_VERSION
    && owns(sidecar, "bootstrapId")
    && (sidecar.bootstrapId === null || typeof sidecar.bootstrapId === "string")
    && owns(sidecar, "build")
    && (sidecar.build === null || isTowBuild(sidecar.build))
    && isPlainRecord(tow)
    && owns(tow, "activeCombat")
    && (tow.activeCombat === null || isPlainRecord(tow.activeCombat))
    && isPlainRecord(tow.readiness)
    && isPlainRecord(tow.companionReadiness)
    && validSavedFormation(tow.formation)
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
    return { ok: false, reason: "invalid-current-mechanics-state", state, writable: false };
  }
  return { ok: true, reason: null, state: migrated.state, writable: true };
}
