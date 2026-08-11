import { describe, expect, it } from "vitest";
import {
  createPendingCombatHandoff,
  readPendingCombatDirective,
  readPendingCombatHandoff,
} from "./pending-directive.js";

function directive() {
  return {
    initiator: "player",
    surprise: false,
    lethal: true,
    foes: [{
      npc_id: "road-brigand",
      kind: "bandit",
      name: "Road brigand",
      tier: "common",
      count: 1,
    }],
    note: "A brigand draws steel across the road.",
  };
}

function campaignState() {
  return {
    character: { name: "Arctic Knight", vitality: 20, vitalityMax: 20, abilities: [], conditions: [] },
    party: [],
    pendingLoot: null,
    productionCombatSequence: 4,
    world: {
      seed: "winter",
      currentTile: { x: 2, y: 3 },
      codex: { characters: {} },
    },
    time: { day: 1, hour: 8, minute: 15 },
    turns: [{ k: "turn-1" }],
    beats: [{ id: "beat-1" }],
  };
}

describe("pending production-combat directive boundary", () => {
  it("owns, normalizes, freezes, and JSON-restores the advertised narrator directive", () => {
    const input = directive();
    const opened = readPendingCombatDirective(input);

    expect(opened).toMatchObject({ ok: true, directive: input });
    expect(opened.directive).not.toBe(input);
    expect(Object.isFrozen(opened.directive)).toBe(true);
    expect(Object.isFrozen(opened.directive.foes)).toBe(true);
    expect(Object.isFrozen(opened.directive.foes[0])).toBe(true);
    expect(readPendingCombatDirective(JSON.parse(JSON.stringify(opened.directive))))
      .toEqual(opened);
  });

  it("normalizes historically omitted optional narrator fields explicitly", () => {
    expect(readPendingCombatDirective({
      foes: [{ kind: "brawler" }],
    })).toMatchObject({
      ok: true,
      directive: {
        initiator: "player",
        surprise: false,
        lethal: true,
        foes: [{ npc_id: null, kind: "brawler", name: null, tier: null, count: 1 }],
        note: "Blades are about to be drawn.",
      },
    });
  });

  it.each([
    ["unknown directive semantics", { ...directive(), future_rule: true }, "invalid-directive-shape"],
    ["unknown foe semantics", { ...directive(), foes: [{ ...directive().foes[0], future_rule: true }] }, "invalid-foe-shape"],
    ["too many foes", { ...directive(), foes: Array.from({ length: 17 }, () => directive().foes[0]) }, "invalid-foes"],
    ["oversized note", { ...directive(), note: "x".repeat(2_001) }, "invalid-note"],
    ["invalid tier", { ...directive(), foes: [{ ...directive().foes[0], tier: "impossible" }] }, "invalid-foe-tier"],
  ])("rejects %s", (_label, input, reason) => {
    expect(readPendingCombatDirective(input)).toEqual({
      ok: false,
      reason,
      directive: null,
    });
  });

  it("does not invoke accessor-backed input", () => {
    let calls = 0;
    const value = {};
    Object.defineProperty(value, "foes", {
      enumerable: true,
      get() {
        calls += 1;
        return [];
      },
    });

    expect(readPendingCombatDirective(value).ok).toBe(false);
    expect(calls).toBe(0);
  });

  it("binds a persisted handoff to campaign and combat-relevant source state", () => {
    const state = campaignState();
    const created = createPendingCombatHandoff({
      campaignId: "campaign-1",
      state,
      directive: directive(),
    });

    expect(created.ok).toBe(true);
    const restored = readPendingCombatHandoff(
      JSON.parse(JSON.stringify(created.handoff)),
      { campaignId: "campaign-1", state: JSON.parse(JSON.stringify(state)) },
    );
    expect(restored.ok).toBe(true);
    expect(Object.isFrozen(restored.handoff)).toBe(true);
    expect(Object.isFrozen(restored.handoff.directive.foes[0])).toBe(true);

    const changed = JSON.parse(JSON.stringify(state));
    changed.character.vitality -= 1;
    expect(readPendingCombatHandoff(created.handoff, {
      campaignId: "campaign-1",
      state: changed,
    })).toEqual({
      ok: false,
      reason: "pending-combat-context-mismatch",
      handoff: null,
    });
    expect(readPendingCombatHandoff(created.handoff, {
      campaignId: "campaign-2",
      state,
    })).toEqual({
      ok: false,
      reason: "pending-combat-campaign-mismatch",
      handoff: null,
    });
  });
});
