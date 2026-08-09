import { describe, expect, it } from "vitest";
import { createEncounter, isEncounterState } from "./model.js";
import { resolveCommand } from "./resolve.js";

function input() {
  return {
    seed: 104729,
    player: {
      id: "player",
      name: "Arctic Knight",
      hp: 24,
      maxHp: 24,
      stats: { attack: 4, defense: 2 },
      actions: ["basic-attack", "basic-defense"],
      skills: ["emergency-evasion"],
    },
    enemy: {
      id: "gatekeeper",
      name: "The Gatekeeper",
      hp: 18,
      maxHp: 18,
      stats: { attack: 3, defense: 0 },
      intent: {
        id: "gatekeeper-strike",
        type: "attack",
        targetId: "player",
        damage: { min: 8, max: 8 },
      },
    },
  };
}

const attack = Object.freeze({
  type: "use-action",
  actorId: "player",
  actionId: "basic-attack",
  targetId: "gatekeeper",
});

describe("encounter model boundary", () => {
  it("recognizes created and JSON-restored encounter state", () => {
    const state = createEncounter(input());

    expect(isEncounterState(state)).toBe(true);
    expect(isEncounterState(JSON.parse(JSON.stringify(state)))).toBe(true);
  });

  it("rejects semantically forged state before command resolution", () => {
    const state = createEncounter(input());
    const invalid = { ...state, rng: { algorithm: "mulberry32", state: -1 } };

    expect(isEncounterState(invalid)).toBe(false);
    expect(resolveCommand(invalid, attack)).toEqual({
      ok: false,
      reason: "invalid-encounter-state",
      state: null,
      events: [],
    });
  });

  it("rejects actor key/id mismatches before a prototype key can be written", () => {
    const invalid = JSON.parse(JSON.stringify(createEncounter(input())));
    invalid.actors.gatekeeper.id = "__proto__";

    try {
      expect(isEncounterState(invalid)).toBe(false);
      expect(resolveCommand(invalid, attack)).toEqual({
        ok: false,
        reason: "invalid-encounter-state",
        state: null,
        events: [],
      });
      expect(Object.prototype.hp).toBeUndefined();
      expect(Object.prototype.guard).toBeUndefined();
    } finally {
      delete Object.prototype.hp;
      delete Object.prototype.guard;
    }
  });

  it("rejects accessor-backed construction input without executing the getter", () => {
    const value = input();
    let getterCalls = 0;
    Object.defineProperty(value, "player", {
      enumerable: true,
      get: () => { getterCalls += 1; return input().player; },
    });

    expect(() => createEncounter(value)).toThrow("invalid-encounter-input");
    expect(getterCalls).toBe(0);
  });

  it("rejects executable nested content without invoking toJSON", () => {
    const value = input();
    let callbackCalls = 0;
    value.enemy.statuses = [{
      type: "sleep",
      toJSON: () => { callbackCalls += 1; return { type: "sleep" }; },
    }];

    expect(() => createEncounter(value)).toThrow("invalid-encounter-input");
    expect(callbackCalls).toBe(0);
  });

  it.each([
    ["hp-over-max", (state) => { state.actors.player.hp = state.actors.player.maxHp + 1; }],
    ["negative-guard", (state) => { state.actors.player.guard = -1; }],
    ["missing-enemy", (state) => { delete state.actors.gatekeeper; }],
    ["forged-unlimited-use-counter", (state) => {
      state.actors.player.skills.push({
        id: "sleep-bomb",
        usesRemaining: 0,
        cooldownRemaining: 0,
        cooldownSetRound: null,
      });
    }],
    ["event-sequence-drift", (state) => { state.sequence = 99; }],
  ])("detects %s corruption after a JSON round-trip", (_label, corrupt) => {
    const state = JSON.parse(JSON.stringify(createEncounter(input())));
    corrupt(state);

    expect(isEncounterState(state)).toBe(false);
  });
});
