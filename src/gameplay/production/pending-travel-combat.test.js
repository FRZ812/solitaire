import { describe, expect, it } from "vitest";
import {
  createPendingTravelCombat,
  readPendingTravelCombat,
} from "./pending-travel-combat.js";

function state() {
  return {
    character: { name: "Wanderer", vitality: 12, vitalityMax: 12, abilities: [], conditions: [] },
    party: [],
    pendingLoot: null,
    productionCombatSequence: 2,
    activeCombatSession: null,
    world: {
      seed: "road-seed",
      currentTile: { x: 3, y: 4 },
      codex: { characters: {}, items: {} },
    },
    time: { day: 2, hour: 9, minute: 10 },
    turns: [{ k: "turn-2" }],
    beats: [{ id: "travel-halt-2" }],
  };
}

describe("pending travel-combat authority", () => {
  it("owns a bounded hostile descriptor and binds it to campaign context", () => {
    const source = {
      kind: "lone-wolf",
      posture: "hostile",
      desc: "A lone wolf blocks the road.",
      weight: 20,
    };
    const campaign = state();
    const created = createPendingTravelCombat({
      campaignId: "campaign-2",
      state: campaign,
      encounter: source,
    });

    expect(created).toMatchObject({
      ok: true,
      pending: {
        version: 1,
        campaignId: "campaign-2",
        kind: "lone-wolf",
        desc: "A lone wolf blocks the road.",
      },
    });
    expect(created.pending).not.toBe(source);
    expect(Object.isFrozen(created.pending)).toBe(true);
    expect(readPendingTravelCombat(JSON.parse(JSON.stringify(created.pending)), {
      campaignId: "campaign-2",
      state: JSON.parse(JSON.stringify(campaign)),
    })).toEqual(created);

    const changed = JSON.parse(JSON.stringify(campaign));
    changed.character.vitality -= 1;
    expect(readPendingTravelCombat(created.pending, {
      campaignId: "campaign-2",
      state: changed,
    })).toEqual({ ok: false, reason: "pending-combat-context-mismatch", pending: null });
  });

  it.each([
    ["non-hostile", { kind: "merchant", posture: "friendly", desc: "A merchant waves." }],
    ["missing kind", { posture: "hostile", desc: "Something waits." }],
    ["oversized kind", { kind: "x".repeat(129), posture: "hostile", desc: "Something waits." }],
    ["oversized description", { kind: "wolf", posture: "hostile", desc: "x".repeat(2_001) }],
  ])("rejects %s descriptors", (_label, encounter) => {
    expect(createPendingTravelCombat({
      campaignId: "campaign-2",
      state: state(),
      encounter,
    }).ok).toBe(false);
  });
});
