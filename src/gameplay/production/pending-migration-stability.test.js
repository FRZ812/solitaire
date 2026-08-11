// A pending combat handoff has to survive the trip through a save file, and that trip
// runs migrateCodex. When the context checksum hashed `character` and `world.codex`
// wholesale, migration's default backfill (lifespanMultiplier, bodyWeight, ridingOn,
// riders, base_appearance across 90+ codex entries) changed the hash every single time,
// so no handoff ever survived a reload — and every future migration would have silently
// broken it again.
//
// These tests pin the property, not the current field list: reload must not invalidate,
// while a change that actually alters the fight must.

import { describe, expect, it } from "vitest";
import { makeInitialState, migrateCodex } from "../../data/initial-state.js";
import { createPendingCombatHandoff, readPendingCombatHandoff } from "./pending-directive.js";
import { createPendingTravelCombat, readPendingTravelCombat } from "./pending-travel-combat.js";

const campaignId = "migration-stability-campaign";

function saved(state) {
  return migrateCodex(JSON.parse(JSON.stringify(state)));
}

function baseState() {
  const state = makeInitialState();
  state.created = true;
  return state;
}

function directive() {
  return {
    initiator: "player",
    surprise: false,
    lethal: true,
    foes: [{ npc_id: null, kind: "bandit", name: "Bandit", tier: null, count: 1 }],
    note: "A bandit blocks the road.",
  };
}

function travelEncounter() {
  return { kind: "pickpocket", posture: "hostile", desc: "A lone cutpurse blocks the road." };
}

describe("pending combat handoffs survive a save/load round trip", () => {
  it("keeps a narrator handoff valid after migrateCodex", () => {
    const state = baseState();
    const created = createPendingCombatHandoff({ campaignId, state, directive: directive() });
    expect(created.ok).toBe(true);

    state.pendingCombatDirective = created.handoff;
    const loaded = saved(state);

    expect(readPendingCombatHandoff(loaded.pendingCombatDirective, {
      campaignId,
      state: loaded,
    }).ok).toBe(true);
  });

  it("keeps a travel handoff valid after migrateCodex", () => {
    const state = baseState();
    const created = createPendingTravelCombat({ campaignId, state, encounter: travelEncounter() });
    expect(created.ok).toBe(true);

    state.pendingTravelCombat = created.pending;
    const loaded = saved(state);

    expect(readPendingTravelCombat(loaded.pendingTravelCombat, {
      campaignId,
      state: loaded,
    }).ok).toBe(true);
  });

  it("survives migration applied more than once", () => {
    const state = baseState();
    const created = createPendingTravelCombat({ campaignId, state, encounter: travelEncounter() });
    state.pendingTravelCombat = created.pending;

    const loaded = saved(saved(state));
    expect(readPendingTravelCombat(loaded.pendingTravelCombat, {
      campaignId,
      state: loaded,
    }).ok).toBe(true);
  });

  it("ignores codex churn that cannot reach the fight", () => {
    // A narrator beat adding an unrelated NPC must not cancel an offered fight.
    const state = baseState();
    const created = createPendingTravelCombat({ campaignId, state, encounter: travelEncounter() });
    state.pendingTravelCombat = created.pending;

    const loaded = saved(state);
    loaded.world.codex.characters["a-passing-drover"] = {
      id: "a-passing-drover",
      name: "A passing drover",
      combatState: { health: 4, maxHealth: 4, status: "ok" },
    };

    expect(readPendingTravelCombat(loaded.pendingTravelCombat, {
      campaignId,
      state: loaded,
    }).ok).toBe(true);
  });
});

describe("but a change that alters the fight still invalidates", () => {
  it.each([
    ["wounded since the offer", (state) => { state.character.vitality -= 1; }],
    ["a companion joined", (state) => { state.party = ["someone"]; }],
    ["a condition took hold", (state) => { state.character.conditions = [{ name: "Exhausted" }]; }],
    ["spoils are unsettled", (state) => { state.pendingLoot = { coins: 5 }; }],
    ["the sequence advanced", (state) => { state.productionCombatSequence += 1; }],
  ])("rejects when %s", (_label, mutate) => {
    const state = baseState();
    const created = createPendingTravelCombat({ campaignId, state, encounter: travelEncounter() });
    state.pendingTravelCombat = created.pending;

    const loaded = saved(state);
    mutate(loaded);

    expect(readPendingTravelCombat(loaded.pendingTravelCombat, {
      campaignId,
      state: loaded,
    })).toEqual({ ok: false, reason: "pending-combat-context-mismatch", pending: null });
  });

  it("still rejects a handoff redeemed against another campaign", () => {
    const state = baseState();
    const created = createPendingTravelCombat({ campaignId, state, encounter: travelEncounter() });

    expect(readPendingTravelCombat(created.pending, {
      campaignId: "a-different-campaign",
      state,
    })).toEqual({ ok: false, reason: "pending-combat-campaign-mismatch", pending: null });
  });
});
