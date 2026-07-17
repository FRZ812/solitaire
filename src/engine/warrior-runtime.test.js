import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { abilityCategoryOf, getAbilityDef } from "../data/abilities.js";
import { magicSchoolIdOf } from "../data/ability-taxonomy.js";
import { recomputeResolveMax, recomputeVitalityMax } from "./attributes.js";
import { abilityUsable, endPlayerTurn, initCombat, playerAct } from "./combat.js";
import { progressionCombatEntitlements, progressionNarrativeProjection } from "./progression-abilities.js";

const CODEX = { characters: { wanderer: { id: "wanderer", worn: [] } }, items: {} };
const WARRIOR_GENERAL_IDS = [
  "warrior-measured-strike", "warrior-guarded-cut", "warrior-passing-step", "warrior-weapon-bind",
  "warrior-turning-parry", "warrior-sweeping-denial", "warrior-break-guard", "warrior-masterstroke",
  "warrior-iron-sequence", "warrior-adaptive-form", "warrior-veteran-reversal", "warrior-perfect-technique",
];
const WARRIOR_BRANCH_IDS = [
  "warrior-weapon-change", "warrior-riposte-guard", "warrior-braced-advance", "warrior-second-breath",
  "warrior-crosscut-sequence", "warrior-read-opponent", "warrior-stop-thrust", "warrior-seize-tempo",
  "warrior-break-line", "warrior-deny-approach", "warrior-shake-it-off", "warrior-last-stand",
];
const WARRIOR_IDS = [...WARRIOR_GENERAL_IDS, ...WARRIOR_BRANCH_IDS];

function makeCharacter({ tracks = [{ professionId: "fighter", levels: 70, branchChoices: {}, choices: {} }], abilities = [] } = {}) {
  const character = {
    name: "Warrior Tester",
    race: "human",
    attributes: { body: 30, reflex: 30, vigor: 30, mind: 6, wit: 30, presence: 6 },
    abilities,
    proficiencies: {},
    conditions: [],
    progression: { version: 2, professions: tracks, racial: null },
  };
  recomputeVitalityMax(character);
  recomputeResolveMax(character);
  character.vitality = character.vitalityMax;
  character.resolve = character.resolveMax;
  return character;
}

function fighterTrack(levels, branchChoices = {}) {
  return { professionId: "fighter", levels, branchChoices, choices: {} };
}

function foe(overrides = {}) {
  return {
    id: "foe",
    name: "Test Foe",
    kind: "guard",
    race: "human",
    tier: "common",
    health: 2000,
    maxHealth: 2000,
    armor: 0,
    ward: 0,
    dodge: 0,
    accuracy: 5,
    critChance: 0,
    critMult: 1.5,
    speed: 2,
    resolve: 20,
    resolveMax: 20,
    will: 2,
    weapon: { name: "Club", min: 12, max: 12, type: "physical", pen: 0, category: "mace", reach: 1 },
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

function readyState(character, enemies = [foe()]) {
  const state = initCombat(character, CODEX, enemies, { seed: 42 });
  state.player.weapon = { name: "Training Sword", min: 12, max: 12, type: "physical", pen: 0, category: "sword", reach: 1 };
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

describe("Warrior-owned runtime", () => {
  beforeEach(() => vi.spyOn(Math, "random").mockReturnValue(0.5));
  afterEach(() => vi.restoreAllMocks());

  it("registers all 24 cards as explicitly Warrior-owned, nonmagical martial technique", () => {
    for (const id of WARRIOR_IDS) {
      const def = getAbilityDef(id);
      expect(def, id).toBeTruthy();
      expect(def, id).toMatchObject({ professionId: "fighter", progressionExclusive: true, school: "martial" });
      expect(abilityCategoryOf(def), id).toBe("martial");
      expect(magicSchoolIdOf(def), id).toBeNull();
      expect(def.innate, id).not.toBe(true);
      expect([null, "physical"], id).toContain(def.damageType);
      expect(def.damageType, id).not.toBe("true");
    }
    expect(WARRIOR_GENERAL_IDS.every((id) => !getAbilityDef(id).branchExclusive)).toBe(true);
    expect(WARRIOR_BRANCH_IDS.every((id) => getAbilityDef(id).branchExclusive)).toBe(true);
  });

  it("rejects smuggled progression cards but grants earned Warrior cards through a valid multiclass track", () => {
    const smuggled = makeCharacter({
      tracks: [{ professionId: "cleric", levels: 4, branchChoices: {}, choices: {} }],
      abilities: WARRIOR_IDS.map((id) => ({ id, tier: "divine" })),
    });
    expect(progressionCombatEntitlements(smuggled).abilities.map((entry) => entry.id))
      .not.toEqual(expect.arrayContaining(WARRIOR_IDS));

    const multiclass = makeCharacter({
      tracks: [
        { professionId: "cleric", levels: 4, branchChoices: {}, choices: {} },
        fighterTrack(6),
      ],
    });
    const projection = progressionCombatEntitlements(multiclass);
    expect(projection.abilities.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      "heal", "warrior-measured-strike", "warrior-guarded-cut",
    ]));
    expect(projection.progressionAbilityIds).toEqual(expect.arrayContaining([
      "warrior-measured-strike", "warrior-guarded-cut",
    ]));
    expect(projection.abilities.map((entry) => entry.id)).not.toContain("warrior-passing-step");

    const sellsword = progressionCombatEntitlements(makeCharacter({
      tracks: [fighterTrack(10, { "warrior-specialization": "sellsword" })],
    }));
    expect(sellsword.abilities.map((entry) => entry.id)).toContain("warrior-weapon-change");
    expect(sellsword.abilities.map((entry) => entry.id)).not.toEqual(expect.arrayContaining([
      "warrior-riposte-guard", "warrior-braced-advance", "warrior-second-breath",
    ]));
  });

  it("projects authored general capabilities and keeps selected branch capabilities separately scoped", () => {
    const character = makeCharacter({ tracks: [fighterTrack(10, { "warrior-specialization": "sellsword" })] });
    const projection = progressionNarrativeProjection(character);
    const general = projection.progressionCapabilities.filter((entry) => entry.scope === "general").map((entry) => entry.id);
    const branch = projection.branchCapabilities.map((entry) => entry.id);

    expect(general).toEqual(expect.arrayContaining([
      "warrior:martial-foundation", "warrior:weapon-safety", "warrior:assess-fighting-distance",
    ]));
    expect(branch).toContain("warrior:sellsword-adaptation");
    expect(branch).not.toEqual(expect.arrayContaining([
      "warrior:duellists-measure", "warrior:vanguard-mass", "warrior:champions-refusal",
    ]));
  });

  it("builds Tempo only from a different native sequence and makes finishers spend it", () => {
    let state = readyState(makeCharacter({ abilities: [{ id: "power-strike", tier: "epic" }] }));
    expect(state.player.martialTempo).toBe(0);

    state = playerAct(state, "warrior-measured-strike", 0);
    expect(state.player.martialTempo).toBe(1);

    refresh(state, "warrior-measured-strike");
    state = playerAct(state, "warrior-measured-strike", 0);
    expect(state.player.martialTempo).toBe(1);

    refresh(state, "power-strike");
    state = playerAct(state, "power-strike", 0);
    expect(state.player.martialTempo).toBe(1);

    refresh(state, "warrior-guarded-cut");
    state = playerAct(state, "warrior-guarded-cut", 0);
    expect(state.player.martialTempo).toBe(2);

    refresh(state, "warrior-iron-sequence");
    state = playerAct(state, "warrior-iron-sequence", 0);
    expect(state.player.martialTempo).toBe(3);

    refresh(state, "warrior-masterstroke");
    expect(abilityUsable(state, "warrior-masterstroke")).toBe(true);
    state = playerAct(state, "warrior-masterstroke", 0);
    expect(state.player.martialTempo).toBe(0);
    refresh(state, "warrior-perfect-technique");
    expect(abilityUsable(state, "warrior-perfect-technique")).toBe(false);
  });

  it("scales a bounded Masterstroke by spent Tempo without bypassing armour", () => {
    const castAt = (tempo, armor = 0) => {
      const state = readyState(makeCharacter(), [foe({ health: 5000, maxHealth: 5000, armor })]);
      state.player.martialTempo = tempo;
      const after = playerAct(state, "warrior-masterstroke", 0);
      return { damage: 5000 - after.enemies[0].health, after };
    };
    const one = castAt(1);
    const three = castAt(3);
    const armoured = castAt(3, 999);
    expect(three.damage).toBeGreaterThan(one.damage);
    expect(armoured.damage).toBe(0);
    expect(three.after.player.martialTempo).toBe(0);
  });

  it("uses the same native-only, anti-repeat Tempo rules for NPC Warriors", () => {
    const enemyWarrior = foe({
      name: "Enemy Warrior",
      accuracy: 1000,
      abilities: [{ id: "warrior-measured-strike", tier: "common" }],
      weapon: { name: "Enemy Sword", min: 100, max: 100, type: "physical", pen: 999, category: "sword", reach: 1 },
    });
    let state = readyState(makeCharacter(), [enemyWarrior]);
    const forceMeasuredIntent = (combat) => {
      const intent = {
        id: "forced-measure",
        abilityId: "warrior-measured-strike",
        tier: "common",
        mode: "single",
        targetUid: "p",
        name: "Measured Strike",
        kind: "attack",
      };
      combat.enemies[0].intent = intent;
      combat.enemies[0].intents = [intent];
    };
    forceMeasuredIntent(state);
    state = endPlayerTurn(state);
    expect(state.enemies[0].martialTempo).toBe(1);
    forceMeasuredIntent(state);
    state = endPlayerTurn(state);
    expect(state.enemies[0].martialTempo).toBe(1);
  });

  it("makes Weapon Bind suppress one weapon action but never a foreign spell", () => {
    const character = makeCharacter({ tracks: [fighterTrack(18)] });
    const armedFoe = () => foe({
      accuracy: 1000,
      weapon: { name: "Heavy Club", min: 1000, max: 1000, type: "physical", pen: 999, category: "mace", reach: 1 },
    });
    const baseline = endPlayerTurn(readyState(character, [armedFoe()]));
    const baselineLoss = baseline.player.maxHealth - baseline.player.health;
    expect(baselineLoss).toBeGreaterThan(0);

    let bound = readyState(character, [armedFoe()]);
    bound = playerAct(bound, "warrior-weapon-bind", 0);
    const healthBefore = bound.player.health;
    bound = endPlayerTurn(bound);
    expect(bound.player.health).toBe(healthBefore);
    expect(bound.enemies[0].statuses.some((status) => status.type === "warriorWeaponBound")).toBe(false);
    expect(bound.log.some((entry) => entry.text.includes("weapon action is lost"))).toBe(true);

    const mage = foe({
      name: "Mage",
      abilities: [{ id: "firebolt", tier: "rare" }],
      attrs: { mind: 20 },
      accuracy: 1000,
      resolve: 100,
      resolveMax: 100,
      weapon: { name: "Staff", min: 1, max: 1, type: "physical", pen: 0, category: "arcane", reach: 1 },
    });
    let spellState = readyState(character, [mage]);
    spellState = playerAct(spellState, "warrior-weapon-bind", 0);
    const beforeSpell = spellState.player.health;
    spellState = endPlayerTurn(spellState);
    expect(spellState.player.health).toBeLessThan(beforeSpell);
  });

  it("earns defensive Tempo from a true parry and from Deny Approach", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    let parry = readyState(makeCharacter({ tracks: [fighterTrack(24)] }), [foe({ accuracy: 0 })]);
    parry = playerAct(parry, "warrior-turning-parry", null);
    const beforeParry = parry.player.health;
    parry = endPlayerTurn(parry);
    expect(parry.player.health).toBe(beforeParry);
    expect(parry.player.martialTempo).toBe(1);
    expect(parry.log.some((entry) => entry.text.includes("turns the weapon line aside"))).toBe(true);

    const reachKeeper = makeCharacter({ tracks: [fighterTrack(30, {
      "warrior-specialization": "iron-vanguard",
      "vanguard-method": "reach-keeper",
    })] });
    let denial = readyState(reachKeeper, [foe({ accuracy: 100 })]);
    denial.player.weapon = { name: "War Spear", min: 10, max: 10, type: "physical", pen: 0, category: "spear", reach: 2 };
    denial = playerAct(denial, "warrior-deny-approach", null);
    denial.enemies[0].distance = 2;
    const enemyBefore = denial.enemies[0].health;
    const playerBefore = denial.player.health;
    denial = endPlayerTurn(denial);
    expect(denial.player.health).toBe(playerBefore);
    expect(denial.enemies[0].health).toBeLessThan(enemyBefore);
    expect(denial.player.martialTempo).toBe(1);
    expect(denial.log.some((entry) => entry.text.includes("denies the melee approach"))).toBe(true);
  });

  it("keeps Undying recovery finite and its Last Stand a delay rather than healing", () => {
    const champion = makeCharacter({ tracks: [fighterTrack(10, { "warrior-specialization": "undying-champion" })] });
    let breath = readyState(champion);
    breath.player.health = Math.floor(breath.player.maxHealth * 0.5);
    const breathBefore = breath.player.health;
    breath = playerAct(breath, "warrior-second-breath", null);
    expect(breath.player.health).toBeGreaterThan(breathBefore);
    expect(breath.player.health - breathBefore).toBeLessThanOrEqual(Math.ceil(breath.player.maxHealth * 0.15));
    refresh(breath, "warrior-second-breath");
    expect(abilityUsable(breath, "warrior-second-breath")).toBe(false);

    const exemplar = makeCharacter({ tracks: [fighterTrack(30, {
      "warrior-specialization": "undying-champion",
      "undying-champion-method": "last-stand-exemplar",
    })] });
    let stand = readyState(exemplar, [foe({
      health: 10000,
      maxHealth: 10000,
      accuracy: 100,
      weapon: { name: "Siege Maul", min: 10000, max: 10000, type: "physical", pen: 999, category: "mace", reach: 1 },
    })]);
    stand.player.health = Math.floor(stand.player.maxHealth * 0.3);
    const wounded = stand.player.health;
    expect(abilityUsable(stand, "warrior-last-stand")).toBe(true);
    stand = playerAct(stand, "warrior-last-stand", null);
    expect(stand.player.health).toBe(wounded);
    stand = endPlayerTurn(stand);
    expect(stand.player.health).toBe(1);
    expect(stand.phase).toBe("player");
    expect(stand.player._warriorLastStandUsed).toBe(true);
  });
});
