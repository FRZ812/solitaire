import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAbilityDef } from "../data/abilities.js";
import { recomputeResolveMax, recomputeVitalityMax } from "./attributes.js";
import {
  abilityUsable,
  endPlayerTurn,
  initCombat,
  monkPostureCapacity,
  playerAct,
  weaponReqMet,
} from "./combat.js";

const CODEX = { characters: { wanderer: { id: "wanderer", worn: [] } }, items: {} };

function monkTrack(levels = 70, branchChoices = {}) {
  return { professionId: "monk", levels, branchChoices, choices: {} };
}

function makeCharacter({ levels = 70, branchChoices = {}, professionId = "monk" } = {}) {
  const character = {
    id: "wanderer",
    name: "Monk Tester",
    race: "human",
    attributes: { body: 30, reflex: 30, vigor: 30, mind: 12, wit: 30, presence: 6 },
    abilities: [],
    proficiencies: {},
    conditions: [],
    progression: {
      version: 2,
      professions: professionId === "monk" ? [monkTrack(levels, branchChoices)] : [{ professionId, levels }],
      racial: null,
    },
  };
  recomputeVitalityMax(character);
  recomputeResolveMax(character);
  character.vitality = character.vitalityMax;
  character.resolve = character.resolveMax;
  return character;
}

function foe(overrides = {}) {
  return {
    id: "foe",
    name: "Training Foe",
    kind: "guard",
    race: "human",
    tier: "common",
    health: 5000,
    maxHealth: 5000,
    armor: 0,
    armorClass: null,
    ward: 0,
    dodge: 0,
    accuracy: 5,
    critChance: 0,
    critMult: 1.5,
    speed: 2,
    resolve: 100,
    resolveMax: 100,
    will: 2,
    weight: 90,
    size: "medium",
    weapon: { name: "Club", min: 2, max: 2, type: "physical", pen: 0, category: "mace", reach: 1 },
    abilities: [],
    statuses: [],
    cooldowns: {},
    demeanor: "fanatic",
    morale: 100,
    moraleMax: 100,
    canTalk: true,
    actionsPerTurn: 1,
    ...overrides,
  };
}

function readyState(character = makeCharacter(), enemies = [foe()]) {
  const state = initCombat(character, CODEX, enemies, { seed: 42 });
  state.player.weapon = { name: "Bare Hands", min: 12, max: 12, type: "physical", pen: 0, category: "unarmed", reach: 1 };
  state.player.weight = 80;
  state.player.accuracy = 1000;
  state.player.resolve = 100;
  state.player.resolveMax = 100;
  state.player.actionsLeft = 3;
  state.player.energy = 3;
  return state;
}

function refresh(state, abilityId) {
  state.phase = "player";
  state.player.actionsLeft = 3;
  state.player.energy = 3;
  state.player.resolve = 100;
  state.player.cooldowns[abilityId] = 0;
  return state;
}

describe("Monk physical Posture runtime", () => {
  beforeEach(() => vi.spyOn(Math, "random").mockReturnValue(0.5));
  afterEach(() => vi.restoreAllMocks());

  it("builds at most one target-side Posture Strain per action and spends it on bounded control", () => {
    let state = readyState();
    state = playerAct(state, "monk-three-beat-strike", 0);
    expect(state.enemies[0].postureStrain).toBe(1);
    expect(state.player.postureStrain).toBe(0);

    refresh(state, "monk-measured-palm");
    state = playerAct(state, "monk-measured-palm", 0);
    expect(state.enemies[0].postureStrain).toBe(2);

    refresh(state, "monk-joint-check");
    expect(abilityUsable(state, "monk-joint-check")).toBe(true);
    state = playerAct(state, "monk-joint-check", 0);
    expect(state.enemies[0].postureStrain).toBe(1);
    expect(state.enemies[0].statuses.some((status) => status.type === "weaken")).toBe(true);

    refresh(state, "monk-posture-break");
    expect(abilityUsable(state, "monk-posture-break")).toBe(false);
  });

  it("caps Posture by anatomy, size, mass, and heavy armour", () => {
    const monk = { weight: 80 };
    expect(monkPostureCapacity(monk, foe())).toBe(3);
    expect(monkPostureCapacity(monk, foe({ armorClass: "heavy" }))).toBe(2);
    expect(monkPostureCapacity(monk, foe({ size: "huge" }))).toBe(1);
    expect(monkPostureCapacity(monk, foe({ weight: 300 }))).toBe(1);
    expect(monkPostureCapacity(monk, foe({ anatomy: "ooze" }))).toBe(0);
  });

  it("lets unrenewed Posture decay on the target's later turns", () => {
    let state = readyState();
    state = playerAct(state, "monk-measured-palm", 0);
    expect(state.enemies[0]).toMatchObject({ postureStrain: 1, postureDecayTurns: 1 });

    state = endPlayerTurn(state);
    expect(state.enemies[0]).toMatchObject({ postureStrain: 1, postureDecayTurns: 0 });
    refresh(state, "monk-measured-palm");
    state = endPlayerTurn(state);
    expect(state.enemies[0].postureStrain).toBe(0);
  });

  it("softens trips against bosses instead of granting impossible hard control", () => {
    let state = readyState(makeCharacter(), [foe({ boss: true, postureStrain: 3 })]);
    refresh(state, "monk-reaping-kick");
    state = playerAct(state, "monk-reaping-kick", 0);
    expect(state.enemies[0].postureStrain).toBe(1);
    expect(state.enemies[0].statuses.some((status) => status.type === "stun")).toBe(false);
    expect(state.enemies[0].statuses.some((status) => status.type === "monkBalanceChecked")).toBe(true);
  });

  it("enforces empty hands, the Temple Arms exception, and heavy-armour mobility limits", () => {
    const yieldingGuard = getAbilityDef("monk-yielding-guard");
    const kataEntry = getAbilityDef("monk-kata-entry");
    expect(weaponReqMet(yieldingGuard, { category: "unarmed" })).toBe(true);
    expect(weaponReqMet(yieldingGuard, { category: "sword" })).toBe(false);
    expect(weaponReqMet(kataEntry, { category: "spear" })).toBe(true);
    expect(weaponReqMet(kataEntry, { category: "sword" })).toBe(true);
    expect(weaponReqMet(kataEntry, { category: "unarmed" })).toBe(false);

    const state = readyState();
    state.player.armorClass = "heavy";
    state.enemies[0].postureStrain = 2;
    expect(abilityUsable(state, "monk-reaping-kick")).toBe(false);
    expect(abilityUsable(state, "monk-joint-check")).toBe(true);
  });

  it("uses the same native Posture builder for NPC Monks", () => {
    const npcMonk = foe({
      name: "Enemy Monk",
      accuracy: 1000,
      abilities: [{ id: "monk-measured-palm", tier: "common" }],
      weapon: { name: "Bare Hands", min: 2, max: 2, type: "physical", pen: 0, category: "unarmed", reach: 1 },
    });
    let state = readyState(makeCharacter({ professionId: "cleric", levels: 1 }), [npcMonk]);
    const intent = {
      id: "forced-measured-palm",
      abilityId: "monk-measured-palm",
      tier: "common",
      mode: "single",
      targetUid: "p",
      name: "Measured Palm",
      kind: "attack",
    };
    state.enemies[0].intent = intent;
    state.enemies[0].intents = [intent];
    state = endPlayerTurn(state);
    expect(state.player.postureStrain).toBe(1);
    expect(state.enemies[0].postureStrain).toBe(0);
  });

  it("turns an earned Open Hand reaction into physical contact against the attacker", () => {
    const character = makeCharacter({ levels: 10, branchChoices: { "monk-discipline": "open-hand" } });
    let state = readyState(character, [foe({ accuracy: 1000 })]);
    expect(abilityUsable(state, "monk-open-hand-parry")).toBe(true);
    state = playerAct(state, "monk-open-hand-parry", 0);
    expect(state.player.statuses.some((status) => status.type === "monkOpenHandParry")).toBe(true);

    state = endPlayerTurn(state);
    expect(state.enemies[0].postureStrain).toBe(1);
    expect(state.player.statuses.some((status) => status.type === "monkOpenHandParry")).toBe(false);
  });
});
