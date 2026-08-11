import { describe, expect, it } from "vitest";
import { makeInitialState, migrateCodex } from "./initial-state.js";

describe("production combat campaign migration", () => {
  it("initializes durable production-combat ownership fields", () => {
    const state = makeInitialState();

    expect(state.activeCombatSession).toBe(null);
    expect(state.pendingCombatDirective).toBe(null);
    expect(state.pendingTravelCombat).toBe(null);
    expect(state.productionCombatSequence).toBe(0);
    expect(state.combatSettlementReceipts).toEqual([]);
  });

  it("backfills old saves without discarding an existing serialized session", () => {
    const old = makeInitialState();
    delete old.activeCombatSession;
    delete old.pendingCombatDirective;
    delete old.pendingTravelCombat;
    delete old.productionCombatSequence;
    delete old.combatSettlementReceipts;

    expect(migrateCodex(old)).toMatchObject({
      activeCombatSession: null,
      pendingCombatDirective: null,
      pendingTravelCombat: null,
      productionCombatSequence: 0,
      combatSettlementReceipts: [],
    });

    old.activeCombatSession = { version: 1, sessionId: "preserve-for-authoritative-read" };
    const migrated = migrateCodex(old);
    expect(migrated.activeCombatSession).toEqual(old.activeCombatSession);
  });
});
