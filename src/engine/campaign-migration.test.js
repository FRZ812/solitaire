import { describe, expect, it } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import {
  compileCharacterBootstrap,
  applyCharacterBootstrap,
} from "../gameplay/tow/character-bootstrap.js";
import {
  CAMPAIGN_SCHEMA_V12,
  CAMPAIGN_SCHEMA_V13,
  CURRENT_CAMPAIGN_SCHEMA,
  emptyMechanicsSidecar,
  hasMechanicsSidecar,
  hasCurrentMechanicsState,
  isReadableCampaignSchema,
  migrateCampaignState,
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

  it("never reports writable without a verified sidecar", () => {
    const upgraded = upgradeCampaignPayload(legacyCampaign());
    expect(upgraded.writable).toBe(hasMechanicsSidecar(upgraded.state));
  });
});
