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
