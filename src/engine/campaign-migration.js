// Campaign schema migration for the mechanics sidecar.
//
// The durable build needs somewhere to live in campaign state. Adding it is a schema
// change, and a schema change is the one failure mode that can cost a player their
// campaign — `listCampaigns` filters on an exact `schema_version`, so a naive bump does
// not corrupt saves, it makes them invisible, which is worse because it looks like data
// loss and invites a support answer of "start again".
//
// So: readers accept every known version, the migration is pure and idempotent, and a
// migrated payload is verified against its original before anything is written back. If
// verification fails the old payload stands.

import { cloneJsonData, equalJsonData } from "../gameplay/kernel/json-data.js";

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
  return { activeCombat: null };
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

function hasTowMechanics(state) {
  const tow = state?.mechanics?.tow;
  return Boolean(tow && typeof tow === "object" && !Array.isArray(tow) && "activeCombat" in tow);
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

  if (!hasMechanicsSidecar(next)) next.mechanics = emptyMechanicsSidecar();
  // Backfilled separately: a campaign already carrying a sidecar from the build migration
  // still predates the combat slot, and would otherwise never gain one.
  if (!hasTowMechanics(next)) next.mechanics = { ...next.mechanics, tow: emptyTowMechanics() };

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

  return { ok: true, reason: null };
}

/**
 * The safe upgrade path: migrate, verify, and only then hand back something writable.
 *
 * On any failure the original payload is returned unchanged, so a bad migration degrades
 * to "campaign still loads on the old shape" rather than to a damaged save.
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
  return { ok: true, reason: null, state: migrated.state, writable: true };
}
