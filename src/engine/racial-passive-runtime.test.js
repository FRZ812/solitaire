import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compileRacialTrack } from "../data/progression-paths.js";
import { recomputeResolveMax, recomputeVitalityMax } from "./attributes.js";
import { deriveCombatStats } from "./combat-stats.js";
import { endPlayerTurn, initCombat, playerAct } from "./combat.js";
import { progressionPassiveEntries } from "./progression-abilities.js";

const CODEX = { characters: { wanderer: { id: "wanderer", worn: [] } }, items: {} };

function allocatedRacialPaths(raceId, levels) {
  const paths = {};
  for (const row of compileRacialTrack(raceId).levels.slice(0, levels)) {
    paths[row.pathId] = (paths[row.pathId] || 0) + 1;
  }
  return paths;
}

function racialCharacter(race, levels, {
  abilities = [],
  attributes = {},
  conditions = [],
  needs = { hunger: 70, thirst: 70, sleep: 70 },
  racialPassives = [],
  wounded = false,
} = {}) {
  const character = {
    name: `${race} tester`,
    race,
    attributes: { body: 6, reflex: 6, vigor: 8, mind: 6, wit: 6, presence: 6, ...attributes },
    abilities,
    conditions,
    needs,
    racialPassives,
    proficiencies: {},
    progression: {
      version: 2,
      professions: [],
      racial: {
        raceId: race,
        paths: allocatedRacialPaths(race, levels),
        branchChoices: {},
      },
    },
  };
  recomputeVitalityMax(character);
  recomputeResolveMax(character);
  character.vitality = wounded ? Math.floor(character.vitalityMax / 2) : character.vitalityMax;
  character.resolve = character.resolveMax;
  return character;
}

function enemy(overrides = {}) {
  return {
    id: "racial-runtime-foe",
    name: "Racial Runtime Foe",
    race: "human",
    tier: "common",
    health: 500,
    maxHealth: 500,
    armor: 0,
    ward: 0,
    dodge: 0,
    accuracy: 100,
    critChance: 0,
    critMult: 1.5,
    speed: 2,
    resolve: 99,
    resolveMax: 99,
    will: 5,
    weapon: { name: "Iron Knife", min: 12, max: 12, type: "physical", pen: 0, category: "dagger", reach: 1 },
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

describe("racial progression passive runtime", () => {
  beforeEach(() => vi.spyOn(Math, "random").mockReturnValue(0.5));
  afterEach(() => vi.restoreAllMocks());

  it("gates progression-only passives on actually allocated racial thresholds", () => {
    const routes = [
      { id: "adaptable", race: "human", before: 3, at: 4, trigger: "adaptable" },
      { id: "dragon-heart", race: "drakeborn", before: 13, at: 14, trigger: "dragonHeart" },
      { id: "regeneration", race: "vampire", before: 3, at: 4, trigger: "racialRegeneration" },
    ];

    for (const route of routes) {
      const forged = racialCharacter(route.race, route.before, {
        racialPassives: [{ id: route.id, tier: "divine" }],
      });
      expect(progressionPassiveEntries(forged).map((entry) => entry.id), route.id).not.toContain(route.id);
      expect(deriveCombatStats(forged, CODEX).triggers[route.trigger], route.id).toBeUndefined();

      const earned = racialCharacter(route.race, route.at);
      expect(progressionPassiveEntries(earned), route.id).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: route.id, tier: "common" }),
      ]));
      expect(deriveCombatStats(earned, CODEX).triggers[route.trigger], route.id).toBeGreaterThan(0);
    }
  });

  it("makes Adaptable accelerate practice and soften an unfamiliar spell's requirement penalty", () => {
    const cast = (levels) => {
      const character = racialCharacter("human", levels, {
        abilities: [{ id: "firebolt", tier: "common" }],
        attributes: { mind: 1, wit: 1, reflex: 1 },
      });
      const state = initCombat(character, CODEX, [enemy({ health: 1000, maxHealth: 1000 })], { seed: 42 });
      return playerAct(state, "firebolt", 0);
    };

    const unfamiliar = cast(3);
    const adaptable = cast(4);
    expect(adaptable.profGains.spellcasting).toBe(4.5);
    expect(unfamiliar.profGains.spellcasting).toBe(3);
    expect(1000 - adaptable.enemies[0].health).toBeGreaterThan(1000 - unfamiliar.enemies[0].health);
  });

  it("makes Dragon Heart increase vitality and blunt both damage and the rider of fear magic", () => {
    const fearMage = enemy({
      name: "Terror Mage",
      abilities: [{ id: "phantasmal-killer", tier: "very-rare" }],
      attrs: { mind: 20, presence: 20 },
      weapon: { name: "Twig", min: 1, max: 1, type: "physical", pen: 0, category: "mace", reach: 1 },
    });
    const ordinary = initCombat(racialCharacter("drakeborn", 13), CODEX, [fearMage], { seed: 42 });
    const heart = initCombat(racialCharacter("drakeborn", 14), CODEX, [fearMage], { seed: 42 });

    expect(heart.player.maxHealth).toBe(Math.round(ordinary.player.maxHealth * 1.1));
    expect(ordinary.enemies[0].intent?.abilityId).toBe("phantasmal-killer");
    expect(heart.enemies[0].intent?.abilityId).toBe("phantasmal-killer");

    const ordinaryBefore = ordinary.player.health;
    const heartBefore = heart.player.health;
    const ordinaryAfter = endPlayerTurn(ordinary);
    const heartAfter = endPlayerTurn(heart);
    const ordinaryFear = ordinaryAfter.player.statuses.find((status) => status.type === "weaken");
    const heartFear = heartAfter.player.statuses.find((status) => status.type === "weaken");

    expect(heartBefore - heartAfter.player.health).toBeLessThan(ordinaryBefore - ordinaryAfter.player.health);
    expect(ordinaryFear?.value).toBe(35);
    expect(heartFear?.value).toBe(18);
    expect(heartFear?.duration).toBeLessThan(ordinaryFear?.duration);
    expect(heartAfter.log.some((entry) => entry.text.includes("dragon heart steadies"))).toBe(true);
  });

  it("regenerates vampire wounds only while fed and out of sunlight or severe curse", () => {
    const recover = (opts = {}, characterOpts = {}) => {
      const character = racialCharacter("vampire", 4, { wounded: true, ...characterOpts });
      const startingHealth = character.vitality;
      return { startingHealth, state: initCombat(character, CODEX, [enemy()], { seed: 42, ...opts }) };
    };

    const healthy = recover();
    const rawRegen = Math.round(healthy.state.player.maxHealth * 0.05);
    const amplifiedRegen = Math.round(rawRegen * (1 + healthy.state.player.healPower));
    expect(healthy.state.player.health - healthy.startingHealth).toBe(amplifiedRegen);
    expect(healthy.state.log.some((entry) => entry.text.includes("flesh regenerates"))).toBe(true);

    const sunlight = recover({ sunlight: true });
    expect(sunlight.state.player.health).toBe(sunlight.startingHealth);
    expect(sunlight.state.log.some((entry) => entry.text.includes("suppressed by sunlight"))).toBe(true);

    const hungry = recover({}, { needs: { hunger: 30, thirst: 70, sleep: 70 } });
    expect(hungry.state.player.health).toBe(hungry.startingHealth);
    expect(hungry.state.log.some((entry) => entry.text.includes("suppressed by blood hunger"))).toBe(true);

    const cursed = recover({}, { conditions: ["Cursed"] });
    expect(cursed.state.player.health).toBe(cursed.startingHealth);
    expect(cursed.state.log.some((entry) => entry.text.includes("suppressed by a severe curse"))).toBe(true);
  });

  it("lets a silvered wound suppress lycanthropic regeneration until the wound expires", () => {
    const ironState = initCombat(racialCharacter("lycanthrope", 4, { wounded: true }), CODEX, [enemy()], { seed: 42 });
    const silverState = initCombat(racialCharacter("lycanthrope", 4, { wounded: true }), CODEX, [enemy({
      weapon: { name: "Silvered Dagger", silvered: true, min: 12, max: 12, type: "physical", pen: 0, category: "dagger", reach: 1 },
    })], { seed: 42 });
    const silverLogStart = silverState.log.length;

    const afterIron = endPlayerTurn(ironState);
    const afterSilver = endPlayerTurn(silverState);
    const newSilverLogs = afterSilver.log.slice(silverLogStart).map((entry) => entry.text);

    expect(afterSilver.player.statuses).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "silverWound" }),
    ]));
    expect(afterSilver.player.health).toBeLessThan(afterIron.player.health);
    expect(newSilverLogs.some((text) => text.includes("wound refuses to close around the silver"))).toBe(true);
    expect(newSilverLogs.some((text) => text.includes("racial regeneration is suppressed by silver"))).toBe(true);
  });
});
