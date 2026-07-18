import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BASIC_ATTACK, getAbilityDef } from "../data/abilities.js";
import { recomputeResolveMax, recomputeVitalityMax } from "./attributes.js";
import { chooseAction } from "./combat-ai.js";
import {
  abilityUsable,
  endPlayerTurn,
  initCombat,
  playerAct,
  weaponReqMet,
} from "./combat.js";

const CODEX = { characters: { wanderer: { id: "wanderer", worn: [] } }, items: {} };

function barbarianTrack(levels = 70, branchChoices = {}) {
  return { professionId: "barbarian", levels, branchChoices, choices: {} };
}

function makeCharacter({ levels = 70, branchChoices = {}, professionId = "barbarian" } = {}) {
  const character = {
    id: "wanderer",
    name: "Barbarian Tester",
    race: "human",
    weight: 80,
    attributes: { body: 30, reflex: 24, vigor: 30, mind: 6, wit: 18, presence: 18 },
    abilities: [],
    proficiencies: {},
    conditions: [],
    progression: {
      version: 2,
      professions: professionId === "barbarian"
        ? [barbarianTrack(levels, branchChoices)]
        : [{ professionId, levels, branchChoices: {}, choices: {} }],
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
    accuracy: 1000,
    critChance: 0,
    critMult: 1.5,
    speed: 2,
    resolve: 100,
    resolveMax: 100,
    will: 2,
    weight: 90,
    size: "medium",
    weapon: { name: "Club", min: 12, max: 12, type: "physical", pen: 0, category: "mace", reach: 1 },
    abilities: [],
    statuses: [],
    cooldowns: {},
    demeanor: "fanatic",
    morale: 100,
    moraleMax: 100,
    canHear: true,
    canTalk: true,
    actionsPerTurn: 1,
    ...overrides,
  };
}

function readyState(character = makeCharacter(), enemies = [foe()], opts = {}) {
  const state = initCombat(character, CODEX, enemies, { seed: 42, ...opts });
  state.player.weapon = { name: "Training Axe", min: 20, max: 20, type: "physical", pen: 0, category: "axe", reach: 1 };
  state.player.weight = 80;
  state.player.armor = 0;
  state.player.accuracy = 1000;
  state.player.critChance = 0;
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

function forceEnemyIntent(state, abilityId, mode = "single", targetUid = "p") {
  const def = getAbilityDef(abilityId);
  const intent = {
    id: `forced-${abilityId}`,
    abilityId,
    tier: "common",
    mode,
    targetUid,
    name: def.name,
    kind: mode === "self" ? "buff" : "attack",
  };
  state.enemies[0].intent = intent;
  state.enemies[0].intents = [intent];
  return state;
}

function damageDealt(stateBefore, stateAfter, targetIndex = 0) {
  return stateBefore.enemies[targetIndex].health - stateAfter.enemies[targetIndex].health;
}

describe("Barbarian physical Fury runtime", () => {
  beforeEach(() => vi.spyOn(Math, "random").mockReturnValue(0.5));
  afterEach(() => vi.restoreAllMocks());

  it("resets Fury each combat, caps it at five, and grants once per hostile multi-hit action", () => {
    const character = makeCharacter();
    character.barbarianFury = 5;
    let state = readyState(character, [foe({
      abilities: [{ id: "rapid-jabs", tier: "common" }],
      weapon: { name: "Twin Knives", min: 20, max: 20, type: "physical", pen: 0, category: "dagger", reach: 1 },
    })]);
    expect(state.player.barbarianFury).toBe(0);

    forceEnemyIntent(state, "rapid-jabs");
    state = endPlayerTurn(state);
    expect(state.player.barbarianFury).toBe(1);
    expect(state.log.filter((entry) => entry.text?.includes("gains Fury from the damaging hostile action"))).toHaveLength(1);

    state.player.barbarianFury = 4;
    forceEnemyIntent(state, "rapid-jabs");
    state = endPlayerTurn(state);
    expect(state.player.barbarianFury).toBe(5);

    forceEnemyIntent(state, "rapid-jabs");
    state = endPlayerTurn(state);
    expect(state.player.barbarianFury).toBe(5);

    state.enemies[0].accuracy = -1000;
    forceEnemyIntent(state, BASIC_ATTACK.id);
    state = endPlayerTurn(state);
    expect(state.player.barbarianFury).toBe(5);
  });

  it("does not build Fury by attacking, missing, or dealing zero health damage into full absorption", () => {
    let attacking = readyState();
    attacking = playerAct(attacking, "barbarian-brutal-swing", 0);
    expect(attacking.player.barbarianFury).toBe(0);

    let missed = readyState(makeCharacter(), [foe({ accuracy: -1000 })]);
    forceEnemyIntent(missed, BASIC_ATTACK.id);
    missed = endPlayerTurn(missed);
    expect(missed.player.barbarianFury).toBe(0);

    let absorbed = readyState();
    absorbed.player.block = 5000;
    const healthBefore = absorbed.player.health;
    forceEnemyIntent(absorbed, BASIC_ATTACK.id);
    absorbed = endPlayerTurn(absorbed);
    expect(absorbed.player.health).toBe(healthBefore);
    expect(absorbed.player.barbarianFury).toBe(0);
  });

  it("lets Bait the Blow provoke one Fury while making the next physical hit hurt more", () => {
    const hardHit = foe({ weapon: { name: "Maul", min: 60, max: 60, type: "physical", pen: 0, category: "mace", reach: 1 } });
    let baseline = readyState(makeCharacter(), [hardHit]);
    const baselineHealth = baseline.player.health;
    forceEnemyIntent(baseline, BASIC_ATTACK.id);
    baseline = endPlayerTurn(baseline);
    const baselineLoss = baselineHealth - baseline.player.health;

    let baited = readyState(makeCharacter(), [hardHit]);
    baited = playerAct(baited, "barbarian-bait-the-blow", null);
    expect(baited.player.barbarianFury).toBe(1);
    expect(baited.player.statuses).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "barbarianExposedGuard", value: 8 }),
    ]));
    const baitedHealth = baited.player.health;
    forceEnemyIntent(baited, BASIC_ATTACK.id);
    baited = endPlayerTurn(baited);

    expect(baitedHealth - baited.player.health).toBeGreaterThan(baselineLoss);
    expect(baited.player.barbarianFury).toBe(2);
  });

  it("gates Fury spenders and charges one cost for an entire AoE or multi-hit action", () => {
    let single = readyState();
    expect(abilityUsable(single, "barbarian-fury-hewn-strike")).toBe(false);
    single.player.barbarianFury = 1;
    expect(abilityUsable(single, "barbarian-fury-hewn-strike")).toBe(true);
    single = playerAct(single, "barbarian-fury-hewn-strike", 0);
    expect(single.player.barbarianFury).toBe(0);

    let aoe = readyState(makeCharacter(), [foe({ id: "one" }), foe({ id: "two", name: "Second Foe" })]);
    aoe.player.barbarianFury = 3;
    aoe = playerAct(aoe, "barbarian-great-arc", null);
    expect(aoe.player.barbarianFury).toBe(0);
    expect(aoe.enemies.every((enemy) => enemy.health < enemy.maxHealth)).toBe(true);
    expect(aoe.log.filter((entry) => entry.text?.includes("spends 3 Fury"))).toHaveLength(1);

    let multi = readyState();
    multi.player.barbarianFury = 4;
    multi = playerAct(multi, "barbarian-unrelenting-assault", 0);
    expect(multi.player.barbarianFury).toBe(0);
    expect(multi.log.filter((entry) => entry.text?.includes("spends 4 Fury"))).toHaveLength(1);
    expect(multi.log.filter((entry) => entry.text?.includes("hits Training Foe for"))).toHaveLength(4);
  });

  it("uses a fresh hostile wound for bounded Reprisal and Pain Eater bonuses, then consumes it", () => {
    let plain = readyState();
    plain.player.barbarianFury = 1;
    const plainBefore = structuredClone(plain);
    plain = playerAct(plain, "barbarian-savage-reprisal", 0);
    const plainDamage = damageDealt(plainBefore, plain);

    let reprisal = readyState();
    forceEnemyIntent(reprisal, BASIC_ATTACK.id);
    reprisal = endPlayerTurn(reprisal);
    expect(reprisal.player.barbarianFury).toBe(1);
    expect(reprisal.player.statuses.some((status) => status.type === "barbarianRecentDamage")).toBe(true);
    refresh(reprisal, "barbarian-savage-reprisal");
    const reprisalBefore = structuredClone(reprisal);
    reprisal = playerAct(reprisal, "barbarian-savage-reprisal", 0);
    const reprisalDamage = damageDealt(reprisalBefore, reprisal);
    expect(reprisalDamage).toBeGreaterThan(plainDamage);
    expect(reprisalDamage).toBeLessThanOrEqual(Math.ceil(plainDamage * 1.35) + 1);
    expect(reprisal.player.statuses.some((status) => status.type === "barbarianRecentDamage")).toBe(false);

    const painEaterCharacter = makeCharacter({
      levels: 30,
      branchChoices: { "barbarian-fury-path": "berserker", "berserker-method": "pain-eater" },
    });
    let plainPain = readyState(painEaterCharacter);
    plainPain.player.barbarianFury = 2;
    const plainPainBefore = structuredClone(plainPain);
    plainPain = playerAct(plainPain, "barbarian-pain-eater", 0);
    const plainPainDamage = damageDealt(plainPainBefore, plainPain);

    let primedPain = readyState(painEaterCharacter);
    primedPain.player.barbarianFury = 1;
    forceEnemyIntent(primedPain, BASIC_ATTACK.id);
    primedPain = endPlayerTurn(primedPain);
    refresh(primedPain, "barbarian-pain-eater");
    const primedPainBefore = structuredClone(primedPain);
    primedPain = playerAct(primedPain, "barbarian-pain-eater", 0);
    const primedPainDamage = damageDealt(primedPainBefore, primedPain);
    expect(primedPainDamage).toBeGreaterThan(plainPainDamage);
    expect(primedPainDamage - plainPainDamage).toBeLessThanOrEqual(Math.ceil(plainPainDamage * 0.5) + 1);
    expect(primedPain.player.statuses.some((status) => status.type === "barbarianRecentDamage")).toBe(false);
  });

  it("stagger-displaces ordinary bodies but only disrupts bosses and overwhelming mass", () => {
    const ordinary = foe({ health: 240, maxHealth: 240, weight: 90 });
    let state = readyState(makeCharacter(), [ordinary]);
    state.player.barbarianFury = 3;
    state = playerAct(state, "barbarian-ruinous-collision", 0);
    expect(state.enemies[0].distance).toBe(1);
    expect(state.enemies[0].statuses.some((status) => status.type === "barbarianActionStaggered")).toBe(true);

    for (const target of [
      foe({ health: 240, maxHealth: 240, weight: 90, boss: true }),
      foe({ health: 240, maxHealth: 240, weight: 300 }),
    ]) {
      let bounded = readyState(makeCharacter(), [target]);
      bounded.player.barbarianFury = 3;
      bounded = playerAct(bounded, "barbarian-ruinous-collision", 0);
      expect(bounded.enemies[0].distance).toBe(0);
      expect(bounded.enemies[0].statuses.some((status) => status.type === "barbarianActionStaggered")).toBe(false);
      expect(bounded.enemies[0].statuses.some((status) => status.type === "barbarianGuardDisrupted")).toBe(true);
    }
  });

  it("enforces native weapon, armour, and free-movement rules without trapping Bait behind a weapon", () => {
    const brutal = getAbilityDef("barbarian-brutal-swing");
    expect(weaponReqMet(brutal, { category: "axe" })).toBe(true);
    expect(weaponReqMet(brutal, { category: "unarmed" })).toBe(true);
    expect(weaponReqMet(brutal, { category: "sword" })).toBe(true);
    expect(weaponReqMet(brutal, { category: "spear" })).toBe(true);
    expect(weaponReqMet(brutal, { category: "dagger" })).toBe(false);
    expect(weaponReqMet(brutal, { category: "bow" })).toBe(false);

    const state = readyState();
    state.player.barbarianFury = 2;
    state.player.weapon = { name: "Bow", min: 5, max: 5, type: "physical", pen: 0, category: "bow", reach: 5 };
    expect(abilityUsable(state, "barbarian-crashing-advance")).toBe(false);
    expect(abilityUsable(state, "barbarian-bait-the-blow")).toBe(true);

    state.player.weapon = { name: "Axe", min: 5, max: 5, type: "physical", pen: 0, category: "axe", reach: 1 };
    expect(abilityUsable(state, "barbarian-crashing-advance")).toBe(true);
    state.player.movementLocked = true;
    expect(abilityUsable(state, "barbarian-crashing-advance")).toBe(false);
    state.player.movementLocked = false;
    state.player.armorClass = "medium";
    expect(abilityUsable(state, "barbarian-crashing-advance")).toBe(false);
    state.player.armorClass = "heavy";
    expect(abilityUsable(state, "barbarian-crashing-advance")).toBe(true);
  });

  it("limits War Cry to living hearing allies and restores morale only to its authored bound", () => {
    const character = makeCharacter({
      levels: 30,
      branchChoices: { "barbarian-fury-path": "clan-champion", "clan-champion-method": "war-cry" },
    });
    let state = readyState(character, [foe()], {
      allies: [
        foe({ id: "ally", name: "Hearing Ally", health: 100, maxHealth: 100, morale: 70, moraleMax: 100 }),
        foe({ id: "deaf-ally", name: "Deaf Ally", health: 100, maxHealth: 100, morale: 70, moraleMax: 100, deaf: true }),
        foe({ id: "mindless-ally", name: "Mindless Ally", health: 100, maxHealth: 100, morale: 70, moraleMax: 100, demeanor: "mindless" }),
      ],
    });
    state.player.barbarianFury = 2;
    state = playerAct(state, "barbarian-war-cry", null);

    const hearing = state.allies.find((ally) => ally.name === "Hearing Ally");
    const deaf = state.allies.find((ally) => ally.name === "Deaf Ally");
    const mindless = state.allies.find((ally) => ally.name === "Mindless Ally");
    expect(state.player.barbarianFury).toBe(0);
    expect(hearing.morale).toBe(90);
    expect(hearing.statuses).toEqual(expect.arrayContaining([expect.objectContaining({ type: "barbarianWarCry", value: 10 })]));
    expect(deaf.morale).toBe(70);
    expect(deaf.statuses.some((status) => status.type === "barbarianWarCry")).toBe(false);
    expect(mindless.morale).toBe(70);
    expect(mindless.statuses.some((status) => status.type === "barbarianWarCry")).toBe(false);
  });

  it("uses the same Fury gain and one-time spend rules for NPC Barbarians", () => {
    const npc = foe({
      name: "Enemy Barbarian",
      abilities: [
        { id: "barbarian-bait-the-blow", tier: "common" },
        { id: "barbarian-fury-hewn-strike", tier: "common" },
      ],
      weapon: { name: "Axe", min: 20, max: 20, type: "physical", pen: 0, category: "axe", reach: 1 },
    });
    let state = readyState(makeCharacter({ professionId: "cleric", levels: 1 }), [npc]);
    state = playerAct(state, BASIC_ATTACK.id, 0);
    expect(state.enemies[0].barbarianFury).toBe(1);

    refresh(state, BASIC_ATTACK.id);
    const playerHealth = state.player.health;
    forceEnemyIntent(state, "barbarian-fury-hewn-strike");
    state = endPlayerTurn(state);
    expect(state.enemies[0].barbarianFury).toBe(0);
    expect(state.player.health).toBeLessThan(playerHealth);
    expect(state.log.filter((entry) => entry.text?.includes("Enemy Barbarian spends 1 Fury"))).toHaveLength(1);
  });

  it("has unforced AI choose Bait while starved and a weapon-scaled Fury spender once affordable", () => {
    const actor = foe({
      name: "Thinking Barbarian",
      health: 100,
      maxHealth: 100,
      barbarianFury: 0,
      weapon: { name: "Axe", min: 20, max: 20, type: "physical", pen: 0, category: "axe", reach: 1 },
    });
    const target = foe({ id: "target", health: 200, maxHealth: 200 });
    const candidate = (id) => ({ id, tier: "common", def: getAbilityDef(id) });

    const starved = chooseAction(actor, [target], [
      candidate("barbarian-bait-the-blow"),
      candidate("barbarian-fury-hewn-strike"),
    ], { allies: [actor] });
    expect(starved.ability.id).toBe("barbarian-bait-the-blow");

    actor.barbarianFury = 2;
    const affordable = chooseAction(actor, [target], [
      candidate("barbarian-bait-the-blow"),
      candidate("barbarian-fury-hewn-strike"),
    ], { allies: [actor] });
    expect(affordable.ability.id).toBe("barbarian-fury-hewn-strike");
  });
});
