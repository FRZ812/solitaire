import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ABILITY_LIBRARY, abilityCategoryOf, BASIC_ATTACK, getAbilityDef } from "../data/abilities.js";
import { cardDefinition } from "../data/combat-cards.js";
import { recomputeResolveMax, recomputeVitalityMax } from "./attributes.js";
import { chooseAction } from "./combat-ai.js";
import {
  abilityUsable,
  cardUsable,
  endPlayerTurn,
  initCombat,
  playCard,
  playerAct,
} from "./combat.js";

const CODEX = { characters: { wanderer: { id: "wanderer", worn: [] } }, items: {} };
const SEASONS = ["spring", "summer", "autumn", "winter"];
const NEXT_SEASON = Object.freeze({ spring: "summer", summer: "autumn", autumn: "winter", winter: "spring" });

const DRUID_CARD_META = Object.freeze([
  ["druid-verdant-spark", "spring", 3, "druidVerdantSpark"],
  ["druid-sunlance", "summer", 3, null],
  ["druid-leafrot", "autumn", 4, "druidLeafrot"],
  ["druid-rimebark", "winter", 4, "druidRimebark"],
  ["druid-saprise", "spring", 6, "druidSaprise"],
  ["druid-sirocco", "summer", 6, "druidSirocco"],
  ["druid-harvest-tide", "autumn", 8, "druidHarvestTide"],
  ["druid-frostroot", "winter", 8, "druidFrostroot"],
  ["druid-living-canopy", "spring", 10, "druidLivingCanopy"],
  ["druid-high-summer", "summer", 10, "druidHighSummer"],
  ["druid-return-to-soil", "autumn", 15, "druidReturnToSoil"],
  ["druid-great-year", "winter", 15, "druidGreatYear"],
  ["druid-grove-awakening", "spring", 4, "druidGroveAwakening"],
  ["druid-predator-shape", "summer", 4, "druidPredatorShape"],
  ["druid-gale-shear", "winter", 4, "druidGaleShear"],
  ["druid-decay-mark", "autumn", 4, "druidDecayMark"],
  ["druid-entangling-thicket", "spring", 6, "druidEntanglingThicket"],
  ["druid-ironbark-rise", "winter", 6, "druidIronbarkRise"],
  ["druid-wolf-aspect", "autumn", 6, "druidWolfAspect"],
  ["druid-bear-aspect", "winter", 6, "druidBearAspect"],
  ["druid-stormbolt", "summer", 6, "druidStormbolt"],
  ["druid-sunwheel", "summer", 6, "druidSunwheel"],
  ["druid-moldering-wave", "autumn", 6, "druidMolderingWave"],
  ["druid-reclamation-bloom", "spring", 6, "druidReclamationBloom"],
]);

const DRUID_ABILITY_IDS = DRUID_CARD_META.map(([id]) => id);
const CYCLE_LOG = /primal cycle turns from (spring|summer|autumn|winter) to (spring|summer|autumn|winter)/;

function druidTrack(levels = 70, branchChoices = {}) {
  return { professionId: "druid", levels, branchChoices, choices: {} };
}

function makeCharacter({ levels = 70, branchChoices = {}, professionId = "druid" } = {}) {
  const character = {
    id: "wanderer",
    name: "Druid Tester",
    race: "human",
    weight: 70,
    attributes: { body: 24, reflex: 24, vigor: 30, mind: 30, wit: 26, presence: 30 },
    abilities: [],
    proficiencies: { awareness: 8, spellcasting: 20 },
    conditions: [],
    druidSeason: "winter",
    progression: {
      version: 2,
      professions: professionId === "druid"
        ? [druidTrack(levels, branchChoices)]
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

function combatant(overrides = {}) {
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
    weight: 80,
    size: "medium",
    weapon: { name: "Club", min: 4, max: 4, type: "physical", pen: 0, category: "mace", reach: 1 },
    abilities: [],
    statuses: [],
    cooldowns: {},
    demeanor: "fanatic",
    morale: 100,
    moraleMax: 100,
    conscious: true,
    aware: true,
    canSee: true,
    canHear: true,
    actionsPerTurn: 1,
    druidSeason: "summer",
    ...overrides,
  };
}

function druidCombatant(overrides = {}) {
  return combatant({
    id: "druid-npc",
    name: "NPC Druid",
    professionId: "druid",
    attrs: { body: 20, reflex: 20, vigor: 24, mind: 30, wit: 24, presence: 30 },
    abilities: [{ id: "druid-sunlance", tier: "common" }],
    ...overrides,
  });
}

function prepareEnvironment(state) {
  const natural = {
    livingGrowth: true,
    seedBearingGround: true,
    openSky: true,
    storm: true,
    sunlight: true,
  };
  state.environment = { ...(state.environment || {}), ...natural };
  state.terrain = { ...(state.terrain || {}), ...natural };
  Object.assign(state, natural, {
    hasLivingGrowth: true,
    hasSeedBearingGround: true,
    hasOpenSky: true,
    hasStorm: true,
    hasSunlight: true,
  });
  return state;
}

function readyState(character = makeCharacter(), enemies = [combatant()], opts = {}) {
  const state = initCombat(character, CODEX, enemies, { seed: 42, ...opts });
  state.player.accuracy = 1000;
  state.player.critChance = 0;
  state.player.resolve = 100;
  state.player.resolveMax = 100;
  state.player.actionsLeft = 3;
  state.player.energy = 3;
  return prepareEnvironment(state);
}

function refresh(state, abilityId) {
  state.phase = "player";
  state.player.actionsLeft = 3;
  state.player.energy = 3;
  state.player.cooldowns[abilityId] = 0;
  return state;
}

function grantPlayer(state, abilityId, tier = "common") {
  expect(getAbilityDef(abilityId), `${abilityId} must be authored`).toBeTruthy();
  state.player.abilities = (state.player.abilities || []).filter((entry) => entry.id !== abilityId);
  state.player.abilities.push({ id: abilityId, tier });
  state.player.progressionAbilityIds = [...new Set([...(state.player.progressionAbilityIds || []), abilityId])];
  state.player.progressionBranchAbilityIds = [...new Set([...(state.player.progressionBranchAbilityIds || []), abilityId])];
  return state;
}

function selectTarget(state, targetIndex) {
  if (targetIndex == null) return state;
  state.target = targetIndex;
  state.targetUid = state.enemies[targetIndex]?.uid || null;
  return state;
}

function use(state, abilityId, targetIndex = undefined, tier = "common") {
  grantPlayer(state, abilityId, tier);
  refresh(state, abilityId);
  const def = getAbilityDef(abilityId);
  const index = targetIndex === undefined ? (def.target === "enemy" ? 0 : null) : targetIndex;
  selectTarget(state, index);
  return playerAct(state, abilityId, index);
}

function forceIntoHand(state0, abilityId) {
  const state = structuredClone(state0);
  grantPlayer(state, abilityId);
  let uid = Object.keys(state.deck.cards).find((cardUid) => state.deck.cards[cardUid].abilityId === abilityId);
  if (!uid) {
    uid = `druid-test-${abilityId}`;
    state.deck.cards[uid] = { uid, ...cardDefinition(abilityId, "common") };
  }
  for (const pile of ["draw", "hand", "discard", "exhaust"]) {
    state.deck[pile] = state.deck[pile].filter((cardUid) => cardUid !== uid);
  }
  state.deck.hand.unshift(uid);
  state.phase = "player";
  state.player.energy = 3;
  state.player.actionsLeft = 3;
  return { state, uid };
}

function statusOf(actor, type, sourceUid = null) {
  return (actor.statuses || []).find((status) =>
    status.type === type && (sourceUid == null || status.sourceUid === sourceUid));
}

function forceEnemyIntent(state, enemyIndex, abilityId, targetUid = "p") {
  const enemy = state.enemies[enemyIndex];
  const def = getAbilityDef(abilityId);
  const mode = def.target === "all-enemies" ? "aoe"
    : def.target === "all-allies" ? "all-allies"
      : def.target === "self" ? "self" : "single";
  const intent = {
    id: `forced-${enemyIndex}-${abilityId}`,
    abilityId,
    tier: "common",
    mode,
    targetUid: mode === "single" ? targetUid : null,
    name: def.name,
    kind: def.dmg || def.scaling === "stat" ? "attack" : "buff",
  };
  enemy.intent = intent;
  enemy.intents = [intent];
  enemy.actionsPerTurn = 1;
  enemy.actionsLeft = 1;
  return state;
}

function healthLoss(before, after, index = 0) {
  return before.enemies[index].health - after.enemies[index].health;
}

function cycleLogCount(state) {
  return state.log.filter((entry) => CYCLE_LOG.test(entry.text || "")).length;
}

describe("Druid primalcraft season runtime", () => {
  beforeEach(() => vi.spyOn(Math, "random").mockReturnValue(0.5));
  afterEach(() => vi.restoreAllMocks());

  it("keeps exactly 24 first-class progression-owned primalcraft cards with canonical seasons, costs, and effects", () => {
    const catalogIds = ABILITY_LIBRARY.filter((def) =>
      def.professionId === "druid" && def.school === "primalcraft" && !def.innate).map((def) => def.id);
    expect(catalogIds).toEqual(DRUID_ABILITY_IDS);
    expect(catalogIds).toHaveLength(24);

    const seasonCounts = Object.fromEntries(SEASONS.map((season) => [season, 0]));
    for (const [abilityId, season, resolveCost, effectType] of DRUID_CARD_META) {
      const def = getAbilityDef(abilityId);
      expect(def, abilityId).toMatchObject({
        professionId: "druid",
        progressionExclusive: true,
        school: "primalcraft",
        druidSeason: season,
        resolveCost,
        druidSeasonSurge: {
          bonus: 0.20,
          cap: 0.25,
        },
      });
      expect(abilityCategoryOf(def), abilityId).toBe("primalcraft");
      expect(def.innate, abilityId).not.toBe(true);
      expect(["damage", "effect", "damage-and-effect"], abilityId).toContain(def.druidSeasonSurge.appliesTo);
      expect(def.effect?.type || null, abilityId).toBe(effectType);
      seasonCounts[season] += 1;
    }
    expect(seasonCounts).toEqual({ spring: 6, summer: 6, autumn: 6, winter: 6 });
    expect(getAbilityDef("druid-sunwheel")).toMatchObject({ hits: 2, target: "all-enemies" });
  });

  it("resets the player, allies, and enemies to independent Spring seasons at combat start", () => {
    const character = makeCharacter();
    character.druidSeason = "winter";
    const ally = druidCombatant({ id: "ally-druid", druidSeason: "autumn" });
    const enemy = druidCombatant({ id: "enemy-druid", druidSeason: "summer" });
    const state = readyState(character, [enemy], { allies: [ally] });
    expect(state.player.druidSeason).toBe("spring");
    expect(state.allies[0].druidSeason).toBe("spring");
    expect(state.enemies[0].druidSeason).toBe("spring");
  });

  it("cycles Spring to Summer to Autumn to Winter to Spring once per committed native action", () => {
    let state = readyState();
    const startingResolve = state.player.resolve;
    const sequence = [
      ["druid-verdant-spark", "summer"],
      ["druid-sunlance", "autumn"],
      ["druid-leafrot", "winter"],
      ["druid-rimebark", "spring"],
    ];
    for (const [abilityId, expectedSeason] of sequence) {
      const beforeLogs = cycleLogCount(state);
      state = use(state, abilityId);
      expect(state.player.druidSeason, abilityId).toBe(expectedSeason);
      expect(cycleLogCount(state), abilityId).toBe(beforeLogs + 1);
    }
    expect(state.player.resolve).toBe(startingResolve - 14);
  });

  it("applies the matching-season surge to damage, effects, and mixed payloads without changing fixed fields", () => {
    const cast = (abilityId, season) => {
      let state = readyState();
      state.player.druidSeason = season;
      const before = structuredClone(state);
      state = use(state, abilityId);
      return { before, state, damage: healthLoss(before, state) };
    };

    const solarOff = cast("druid-sunlance", "spring");
    const solarSurge = cast("druid-sunlance", "summer");
    expect(solarSurge.damage).toBeGreaterThan(solarOff.damage);
    expect(solarSurge.state.log.some((entry) => entry.text?.includes("bounded 20% surge"))).toBe(true);
    expect(solarOff.state.log.some((entry) => entry.text?.includes("bounded 20% surge"))).toBe(false);
    expect(solarSurge.state.player.resolve).toBe(solarOff.state.player.resolve);

    const barkOff = cast("druid-rimebark", "spring");
    const barkSurge = cast("druid-rimebark", "winter");
    expect(statusOf(barkOff.state.player, "druidRimebark")).toMatchObject({ ward: 10, duration: 2 });
    expect(statusOf(barkSurge.state.player, "druidRimebark")).toMatchObject({ ward: 12, duration: 2 });

    const rootOff = cast("druid-verdant-spark", "summer");
    const rootSurge = cast("druid-verdant-spark", "spring");
    expect(rootSurge.damage).toBeGreaterThan(rootOff.damage);
    expect(statusOf(rootOff.state.enemies[0], "druidVerdantSpark")).toMatchObject({ rootPressure: 12, duration: 2 });
    expect(statusOf(rootSurge.state.enemies[0], "druidVerdantSpark")).toMatchObject({ rootPressure: 14, duration: 2 });

    const sunwheel = getAbilityDef("druid-sunwheel");
    expect(sunwheel).toMatchObject({ hits: 2, resolveCost: 6, target: "all-enemies" });
    expect(sunwheel.druidSeasonSurge).toMatchObject({ bonus: 0.20, cap: 0.25 });
  });

  it("advances exactly once on a miss, a two-hit AoE, and an all-allies action", () => {
    let missed = readyState();
    missed.player.druidSeason = "summer";
    missed.player.accuracy = -1000;
    const missedHealth = missed.enemies[0].health;
    missed = use(missed, "druid-sunlance", 0);
    expect(missed.enemies[0].health).toBe(missedHealth);
    expect(missed.player).toMatchObject({ druidSeason: "autumn", resolve: 97 });
    expect(cycleLogCount(missed)).toBe(1);

    let multi = readyState(makeCharacter(), [
      combatant({ id: "one" }),
      combatant({ id: "two", name: "Second Foe" }),
    ]);
    multi.player.druidSeason = "summer";
    multi = use(multi, "druid-sunwheel", null);
    expect(multi.player).toMatchObject({ druidSeason: "autumn", resolve: 94 });
    expect(multi.enemies.every((enemy) => enemy.health < enemy.maxHealth)).toBe(true);
    expect(cycleLogCount(multi)).toBe(1);
    expect(multi.log.filter((entry) => /hits (Training Foe|Second Foe) for/.test(entry.text || ""))).toHaveLength(4);

    const ally = combatant({ id: "ally", name: "Living Ally", health: 80, maxHealth: 100, resolve: 20, resolveMax: 30 });
    let party = readyState(makeCharacter(), [combatant()], { allies: [ally] });
    party.player.druidSeason = "spring";
    party = use(party, "druid-saprise", null);
    expect(party.player).toMatchObject({ druidSeason: "summer", resolve: 94 });
    expect(statusOf(party.player, "druidSaprise")).toBeTruthy();
    expect(statusOf(party.allies[0], "druidSaprise")).toBeTruthy();
    expect(cycleLogCount(party)).toBe(1);
  });

  it("cycles and pays Resolve exactly once through card and NPC execution paths", () => {
    let cardState = readyState();
    cardState.player.druidSeason = "summer";
    const forced = forceIntoHand(cardState, "druid-sunlance");
    cardState = forced.state;
    expect(cardUsable(cardState, forced.uid, "e0")).toBe(true);
    cardState = playCard(cardState, forced.uid, "e0");
    expect(cardState.player).toMatchObject({ druidSeason: "autumn", resolve: 97 });
    expect(cycleLogCount(cardState)).toBe(1);

    const enemyDruid = druidCombatant({
      id: "enemy-druid",
      name: "Enemy Druid",
      accuracy: 1000,
      abilities: [{ id: "druid-sunlance", tier: "common" }],
    });
    let npcState = readyState(makeCharacter({ professionId: "cleric", levels: 1 }), [enemyDruid]);
    npcState.enemies[0].druidSeason = "summer";
    npcState.enemies[0].resolve = 100;
    forceEnemyIntent(npcState, 0, "druid-sunlance");
    npcState = endPlayerTurn(npcState);
    expect(npcState.enemies[0]).toMatchObject({ druidSeason: "autumn", resolve: 97 });
    expect(npcState.log.filter((entry) => entry.text?.includes("Enemy Druid's primal cycle turns from summer to autumn"))).toHaveLength(1);
  });

  it("does not advance for basic, foreign, unaffordable, or otherwise uncommitted actions", () => {
    let basic = readyState();
    basic.player.druidSeason = "winter";
    basic = playerAct(basic, BASIC_ATTACK.id, 0);
    expect(basic.player.druidSeason).toBe("winter");

    const starved = readyState();
    starved.player.druidSeason = "autumn";
    starved.player.resolve = 2;
    grantPlayer(starved, "druid-sunlance");
    selectTarget(starved, 0);
    expect(abilityUsable(starved, "druid-sunlance")).toBe(false);
    const beforeActions = starved.player.actionsLeft;
    const rejected = playerAct(starved, "druid-sunlance", 0);
    expect(rejected.player).toMatchObject({ druidSeason: "autumn", resolve: 2, actionsLeft: beforeActions });
    expect(cycleLogCount(rejected)).toBe(0);

    const noDecay = readyState();
    noDecay.player.druidSeason = "winter";
    grantPlayer(noDecay, "druid-reclamation-bloom");
    expect(abilityUsable(noDecay, "druid-reclamation-bloom")).toBe(false);
    const rejectedBloom = playerAct(noDecay, "druid-reclamation-bloom", null);
    expect(rejectedBloom.player.druidSeason).toBe("winter");
    expect(cycleLogCount(rejectedBloom)).toBe(0);
  });

  it("implements Root growth as bounded pressure and cover, never hard control", () => {
    let grove = readyState(makeCharacter(), [combatant({ id: "one" }), combatant({ id: "two", name: "Second Foe" })]);
    grove.player.druidSeason = "summer";
    grove = use(grove, "druid-grove-awakening", null);
    for (const enemy of grove.enemies) {
      expect(statusOf(enemy, "druidGroveAwakening")).toMatchObject({ rootPressure: 18, terrainGrowth: true, duration: 3 });
      expect((enemy.statuses || []).some((status) => ["stun", "rooted", "immobilized"].includes(status.type))).toBe(false);
    }

    let thicket = readyState(makeCharacter(), [combatant({ id: "one" }), combatant({ id: "two", name: "Second Foe" })]);
    thicket.player.druidSeason = "summer";
    thicket = use(thicket, "druid-entangling-thicket", null);
    for (const enemy of thicket.enemies) {
      expect(enemy.health).toBeLessThan(enemy.maxHealth);
      expect(statusOf(enemy, "druidEntanglingThicket")).toMatchObject({ rootPressure: 28, terrainGrowth: true, duration: 3 });
      expect((enemy.statuses || []).some((status) => ["stun", "rooted", "immobilized"].includes(status.type))).toBe(false);
    }

    const ally = combatant({ id: "ally", name: "Canopy Ally", health: 100, maxHealth: 100 });
    let canopy = readyState(makeCharacter(), [combatant()], { allies: [ally] });
    canopy.player.druidSeason = "summer";
    canopy = use(canopy, "druid-living-canopy", null);
    for (const protectedActor of [canopy.player, canopy.allies[0]]) {
      expect(statusOf(protectedActor, "druidLivingCanopy")).toMatchObject({
        projectileReduction: 0.25,
        cap: 0.10,
        duration: 3,
        requiresPresentGrowth: true,
      });
    }
  });

  it("keeps every Fang card a self-aspect that never creates a beast, pet, summon, or second actor", () => {
    const expected = {
      "druid-predator-shape": { type: "druidPredatorShape", bodyBonus: 12, reflexBonus: 12, aspect: "predator", duration: 3 },
      "druid-wolf-aspect": { type: "druidWolfAspect", reflexBonus: 18, critBonus: 8, pursuitBonus: 15, aspect: "wolf", duration: 3 },
      "druid-bear-aspect": { type: "druidBearAspect", bodyBonus: 18, block: 12, forcedMoveResistance: 25, aspect: "bear", duration: 3 },
    };
    for (const [abilityId, payload] of Object.entries(expected)) {
      const def = getAbilityDef(abilityId);
      expect(def).toMatchObject({ target: "self", selfShapeshift: true });
      expect(def).not.toHaveProperty("summon");
      expect(def).not.toHaveProperty("pet");
      let state = readyState();
      state.player.druidSeason = "spring";
      const roster = { allies: state.allies.length, enemies: state.enemies.length };
      state = use(state, abilityId, null);
      expect(statusOf(state.player, payload.type)).toMatchObject(payload);
      expect(state.allies).toHaveLength(roster.allies);
      expect(state.enemies).toHaveLength(roster.enemies);
      expect([...state.allies, ...state.enemies].some((actor) => actor._summoned || actor.pet || actor.animal)).toBe(false);
    }
  });

  it("implements Sky cards as ward-respecting damage plus bounded displacement, charge, or glare pressure", () => {
    let gale = readyState(makeCharacter(), [combatant({ id: "one" }), combatant({ id: "two", name: "Second Foe" })]);
    gale.player.druidSeason = "spring";
    gale = use(gale, "druid-gale-shear", null);
    for (const enemy of gale.enemies) {
      expect(enemy.health).toBeLessThan(enemy.maxHealth);
      expect(statusOf(enemy, "druidGaleShear")).toMatchObject({ pushPressure: 15, bossScale: 0.35, duration: 1 });
      expect((enemy.statuses || []).some((status) => ["stun", "immobilized"].includes(status.type))).toBe(false);
    }

    let storm = readyState();
    storm.player.druidSeason = "spring";
    storm = use(storm, "druid-stormbolt", 0);
    expect(storm.enemies[0].health).toBeLessThan(storm.enemies[0].maxHealth);
    expect(statusOf(storm.enemies[0], "druidStormbolt")).toMatchObject({ stormCharge: 15, duration: 2 });

    let wheel = readyState(makeCharacter(), [combatant({ id: "one" }), combatant({ id: "two", name: "Second Foe" })]);
    wheel.player.druidSeason = "spring";
    wheel = use(wheel, "druid-sunwheel", null);
    for (const enemy of wheel.enemies) {
      expect(enemy.health).toBeLessThan(enemy.maxHealth);
      expect(statusOf(enemy, "druidSunwheel")).toMatchObject({ glarePressure: 18, duration: 2 });
    }
    expect(wheel.log.filter((entry) => /hits (Training Foe|Second Foe) for/.test(entry.text || ""))).toHaveLength(4);
  });

  it("keeps Cycle decay source-owned and reclaims only actual nearby decay into bounded health and Resolve", () => {
    let marked = readyState();
    marked.player.druidSeason = "spring";
    marked = use(marked, "druid-decay-mark", 0);
    expect(statusOf(marked.enemies[0], "druidDecayMark", "p")).toMatchObject({
      decayVulnerability: 18,
      duration: 3,
      sourceOwned: true,
      sourceUid: "p",
    });

    const ally = combatant({ id: "ally", name: "Living Ally", health: 80, maxHealth: 100, resolve: 10, resolveMax: 30 });
    let state = readyState(makeCharacter(), [combatant({ id: "decaying-foe" })], { allies: [ally] });
    state.player.druidSeason = "spring";
    state = use(state, "druid-moldering-wave", null);
    expect(statusOf(state.enemies[0], "druidMolderingWave")).toMatchObject({ decay: 4, duration: 3 });

    state.player.health = state.player.maxHealth - 20;
    state.player.resolve = 20;
    state.allies[0].health = state.allies[0].maxHealth - 20;
    state.allies[0].resolve = 10;
    state.player.druidSeason = "winter";
    const before = {
      playerHealth: state.player.health,
      playerResolve: state.player.resolve,
      allyHealth: state.allies[0].health,
      allyResolve: state.allies[0].resolve,
    };
    state = use(state, "druid-reclamation-bloom", null);
    expect(state.player.health).toBe(before.playerHealth + 5);
    expect(state.player.resolve).toBe(before.playerResolve - 6 + 2);
    expect(state.allies[0].health).toBe(before.allyHealth + 5);
    expect(state.allies[0].resolve).toBe(before.allyResolve + 2);
    expect(state.player.druidSeason).toBe("spring");
  });

  it("has unforced AI prefer a usable card matching its current season", () => {
    const target = combatant({ id: "target", uid: "target", health: 500, maxHealth: 500 });
    const candidates = [
      "druid-verdant-spark",
      "druid-sunlance",
      "druid-leafrot",
      "druid-frostroot",
    ].map((id) => ({ id, tier: "common", def: getAbilityDef(id) }));

    for (const season of SEASONS) {
      const actor = druidCombatant({
        uid: `druid-${season}`,
        druidSeason: season,
        resolve: 100,
        resolveMax: 100,
        health: 300,
        maxHealth: 300,
      });
      const decision = chooseAction(actor, [target], candidates, { allies: [actor] });
      expect(decision.ability.def.druidSeason, season).toBe(season);
    }
  });
});
