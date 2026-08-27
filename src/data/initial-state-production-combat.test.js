import { describe, expect, it } from "vitest";
import { enqueuePresentation } from "../gameplay/campaign/presentation-outbox.js";
import { makeInitialState, migrateCodex } from "./initial-state.js";

describe("production combat campaign migration", () => {
  it("initializes durable production-combat ownership fields", () => {
    const state = makeInitialState();

    expect(state.activeCombatSession).toBe(null);
    expect(state.pendingCombatDirective).toBe(null);
    expect(state.pendingTravelCombat).toBe(null);
    expect(state.productionCombatSequence).toBe(0);
    expect(state.combatSettlementReceipts).toEqual([]);
    expect(state.pendingLoot).toBe(null);
  });

  it("backfills old saves without discarding an existing serialized session", () => {
    const old = makeInitialState();
    delete old.activeCombatSession;
    delete old.pendingCombatDirective;
    delete old.pendingTravelCombat;
    delete old.productionCombatSequence;
    delete old.combatSettlementReceipts;
    delete old.pendingLoot;

    expect(migrateCodex(old)).toMatchObject({
      activeCombatSession: null,
      pendingCombatDirective: null,
      pendingTravelCombat: null,
      productionCombatSequence: 0,
      combatSettlementReceipts: [],
      pendingLoot: null,
    });

    old.activeCombatSession = { version: 1, sessionId: "preserve-for-authoritative-read" };
    const migrated = migrateCodex(old);
    expect(migrated.activeCombatSession).toEqual(old.activeCombatSession);
  });

  it("restores only presentation jobs that pass the exact job codec", () => {
    const old = makeInitialState();
    const valid = enqueuePresentation([], {
      kind: "combat-aftermath",
      route: "combat-aftermath",
      sourceReceiptId: "settlement-1",
      stateRevision: 4,
      payload: { message: "Tell the aftermath." },
    }).job;
    old.presentationJobs = [
      valid,
      { ...valid, id: "wrong-route", route: "character-arrival" },
      { ...valid, id: "unknown-field", futurePolicy: "execute-any-route" },
    ];

    expect(migrateCodex(old).presentationJobs).toEqual([valid]);
  });
});
