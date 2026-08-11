import { describe, expect, it } from "vitest";
import { createIntentState, encounterIntentFromState } from "./intent.js";
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
  it("replays a JSON-restored encounter with owned production action and intent rules", () => {
    const intentState = createIntentState({
      seed: "production-encounter",
      pattern: {
        id: "single-hostile-production-v1",
        steps: [{
          id: "pressure",
          options: [{
            id: "hostile-strike",
            type: "attack",
            target: "player",
            damage: { min: 2, max: 2 },
          }],
        }],
      },
    }).state;
    const state = createEncounter({
      seed: "production-encounter",
      rules: {
        version: 1,
        id: "solitaire-production-combat-v1",
        actions: [
          {
            id: "strike",
            name: "Strike",
            consumesTurn: true,
            target: "enemy",
            effect: {
              type: "damage",
              stat: "attack",
              multiplier: 1,
              mitigationStat: "defense",
              variance: { min: 0, max: 0 },
            },
          },
          {
            id: "guard",
            name: "Guard",
            consumesTurn: true,
            target: "self",
            effect: {
              type: "defend",
              stat: "defense",
              base: 2,
              multiplier: 1,
            },
          },
        ],
      },
      player: {
        id: "player",
        name: "Wanderer",
        hp: 20,
        maxHp: 20,
        stats: { attack: 5, defense: 3 },
        actions: ["strike", "guard"],
        skills: [],
      },
      enemy: {
        id: "enemy",
        name: "Roadside brigand",
        hp: 12,
        maxHp: 12,
        stats: { attack: 2, defense: 2 },
        actions: [],
        intentState,
        intent: encounterIntentFromState(intentState, "player"),
      },
    });
    const restored = JSON.parse(JSON.stringify(state));

    expect(restored).toMatchObject({
      version: 2,
      baselineVersion: "solitaire-production-combat-v1",
      rules: { version: 1, id: "solitaire-production-combat-v1" },
    });
    expect(isEncounterState(restored)).toBe(true);
    const resolved = resolveCommand(restored, {
      type: "use-action",
      actorId: "player",
      actionId: "strike",
      targetId: "enemy",
    });
    expect(resolved).toMatchObject({
      ok: true,
      state: { actors: { enemy: { hp: 9 } } },
    });
  });

  it("recognizes created and JSON-restored encounter state", () => {
    const state = createEncounter(input());

    expect(isEncounterState(state)).toBe(true);
    expect(isEncounterState(JSON.parse(JSON.stringify(state)))).toBe(true);
  });

  it("recognizes an authored intent projection after persistence reorders object keys", () => {
    const value = input();
    value.enemy.intentState = createIntentState({
      seed: "reordered",
      patternId: "gatekeeper-reference-v1",
    }).state;
    value.enemy.intent = encounterIntentFromState(value.enemy.intentState, value.player.id);
    const state = JSON.parse(JSON.stringify(createEncounter(value)));
    const intent = state.actors.gatekeeper.intent;
    state.actors.gatekeeper.intent = {
      damage: { max: intent.damage.max, min: intent.damage.min },
      targetId: intent.targetId,
      type: intent.type,
      id: intent.id,
    };

    expect(isEncounterState(state)).toBe(true);
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
    ["multiple-enemy-contract", (state) => {
      state.enemyIds.push("gatekeeper-copy");
      state.actors["gatekeeper-copy"] = { ...state.actors.gatekeeper, id: "gatekeeper-copy" };
    }],
    ["transient-enemy-phase", (state) => { state.phase = "enemy"; }],
    ["unsafe-round", (state) => { state.round = Number.MAX_SAFE_INTEGER + 1; }],
    ["unsafe-guard", (state) => { state.actors.player.guard = Number.MAX_VALUE; }],
    ["live-enemy-victory", (state) => {
      state.phase = "victory";
      state.actors.gatekeeper.intent = null;
      state.actors.gatekeeper.intentState = null;
    }],
    ["living-player-defeat", (state) => {
      state.phase = "defeat";
      state.actors.gatekeeper.intent = null;
      state.actors.gatekeeper.intentState = null;
    }],
    ["dead-player-turn", (state) => { state.actors.player.hp = 0; }],
  ])("detects %s corruption after a JSON round-trip", (_label, corrupt) => {
    const state = JSON.parse(JSON.stringify(createEncounter(input())));
    corrupt(state);

    expect(isEncounterState(state)).toBe(false);
  });
});
