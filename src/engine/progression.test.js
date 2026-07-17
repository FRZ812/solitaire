import { describe, expect, it } from "vitest";
import {
  AUTHORED_APEX_LEVELS,
  AUTHORED_WORLD_LEVELS,
  LIVING_WORLD_LEVEL_CAP,
  advanceProgression,
  attributeCeilingForLevel,
  createProgression,
  inferProgressionLevel,
  migrateProgressionState,
  normalizeCharacterProgression,
  progressionLevel,
  progressionLevelFromXp,
} from "./progression.js";
import { progressionAtLevel, progressionXpForLevel } from "../data/progression-paths.js";

describe("character progression migration", () => {
  it("converts legacy attributes and specialized identity once, then stays idempotent", () => {
    const state = {
      character: {
        id: "wanderer",
        name: "Nyx",
        race: "human",
        profession: "assassin",
        subclass: "shadowblade",
        level: 25,
        attributes: { body: 5, reflex: 20, vigor: 10, mind: 5, wit: 10, presence: 5 },
      },
      world: {
        codex: {
          characters: {
            wanderer: {
              id: "wanderer",
              profession: "assassin",
              subclass: "shadowblade",
              attributes: { body: 5, reflex: 20, vigor: 10, mind: 5, wit: 10, presence: 5 },
            },
          },
        },
      },
      turns: [],
    };

    migrateProgressionState(state);
    expect(state.progressionVersion).toBe(1);
    expect(state.character).toMatchObject({
      profession: "assassin",
      archetype: "shadowblade",
    });
    expect(state.character.attributes.reflex).toBe(Math.max(...Object.values(state.character.attributes)));
    expect(Math.max(...Object.values(state.character.attributes))).toBeLessThanOrEqual(attributeCeilingForLevel(25));
    expect(state.character).not.toHaveProperty("subclass");
    expect(state.character).not.toHaveProperty("level");
    expect(progressionLevel(state.character)).toBe(25);
    expect(state.world.codex.characters.wanderer.progression).toEqual(state.character.progression);

    const once = structuredClone(state);
    migrateProgressionState(state);
    expect(state).toEqual(once);
  });

  it("derives level from allocated ranks, never from a drifting loose total", () => {
    const progression = createProgression({ professionId: "farmer", level: 45, sidePath: "utility" });
    expect(progressionLevel(progression)).toBe(45);
    expect(progressionLevelFromXp(progressionXpForLevel(45))).toBe(45);
    expect(progression).not.toHaveProperty("level");
  });

  it("canonicalizes an exact vocation while preserving it as the specialized archetype", () => {
    const progression = createProgression({ professionId: "blacksmith", level: 30 });
    const porter = normalizeCharacterProgression({
      id: "road-porter",
      profession: "porter",
      attributes: { body: 2, reflex: 2, vigor: 3, mind: 2, wit: 2, presence: 2 },
    });

    expect(progression).toMatchObject({ professionId: "artisan", archetypeId: "blacksmith" });
    expect(porter).toMatchObject({ profession: "labourer", archetype: "porter" });
    expect(porter.progression.professionId).toBe("labourer");
  });

  it("does not turn display-case formatting into a redundant custom archetype", () => {
    const soldier = normalizeCharacterProgression({
      profession: "Soldier",
      level: 10,
      attributes: { body: 3, reflex: 3, vigor: 4, mind: 1, wit: 2, presence: 1 },
    });

    expect(soldier).toMatchObject({ profession: "soldier", archetype: "soldier-line-veteran" });
    expect(soldier.progression.archetypeId).toBe("soldier-line-veteran");
  });

  it("gives an underspecified adult professional an ordinary working level", () => {
    expect(inferProgressionLevel({
      id: "field-hand",
      age: 30,
      profession: "farmer",
      attributes: { body: 2, reflex: 3, vigor: 2, mind: 2, wit: 4, presence: 1 },
    })).toBe(10);
    expect(inferProgressionLevel({ id: "field-hand", age: 30, profession: "farmer" })).toBe(10);
    expect(inferProgressionLevel({
      id: "young-attendant",
      age: 8,
      profession: "attendant",
      attributes: { body: 1, reflex: 1, vigor: 1, mind: 1, wit: 1, presence: 1 },
    })).toBeLessThanOrEqual(5);
  });

  it("bounds an old maximum attribute to the migrated character's chosen level", () => {
    const state = {
      character: {
        id: "wanderer",
        kind: "player",
        profession: "sellsword",
        attributes: { body: 30, reflex: 1, vigor: 1, mind: 1, wit: 1, presence: 1 },
      },
      world: { codex: { characters: {} } },
      turns: [],
    };
    migrateProgressionState(state);
    const level = progressionLevel(state.character);
    const route = progressionAtLevel("sellsword", level, {
      sidePath: state.character.progression.sidePath,
      archetypeId: state.character.progression.archetypeId,
    }).attributes;
    const routeTotal = Object.values(route).reduce((sum, value) => sum + value, 0);
    const actualTotal = Object.values(state.character.attributes).reduce((sum, value) => sum + value, 0);

    expect(level).toBe(45);
    expect(Math.max(...Object.values(state.character.attributes))).toBeLessThanOrEqual(attributeCeilingForLevel(level));
    expect(actualTotal).toBeGreaterThanOrEqual(Math.round(routeTotal * 0.85));
  });
});

describe("world power ceilings", () => {
  it("caps even generously-authored ordinary world figures at the living-legend ceiling", () => {
    const character = normalizeCharacterProgression({
      id: "village-swordmaster",
      name: "Master Ilyan",
      profession: "sellsword",
      level: 99,
      attributes: { body: 90, reflex: 90, vigor: 90, mind: 40, wit: 50, presence: 30 },
    });

    expect(LIVING_WORLD_LEVEL_CAP).toBe(60);
    expect(progressionLevel(character)).toBe(60);
    expect(character).not.toHaveProperty("level");
  });

  it("permits only authored apex ids to cross level 60 without a playable template", () => {
    for (const [id, level] of Object.entries(AUTHORED_APEX_LEVELS)) {
      const character = normalizeCharacterProgression({ id, profession: "wanderer", level: 1 });
      expect(progressionLevel(character), id).toBe(level);
    }
    expect(AUTHORED_APEX_LEVELS["demon-king"]).toBeGreaterThan(60);
    expect(AUTHORED_APEX_LEVELS["great-wyrm"]).toBeGreaterThan(60);
    expect(AUTHORED_APEX_LEVELS["witch-queen"]).toBeGreaterThan(60);
  });

  it("calibrates authored rulers, masters, heirs, and apprentices deliberately", () => {
    expect(AUTHORED_WORLD_LEVELS).toMatchObject({
      "glass-spire-master": 60,
      "cinder-chapter-master": 50,
      "crowsmoor-baron": 34,
      "crowsmoor-baron-heir": 28,
      "heron-master-apprentice": 24,
    });
    expect(Object.entries(AUTHORED_WORLD_LEVELS)
      .filter(([id]) => !Object.hasOwn(AUTHORED_APEX_LEVELS, id))
      .every(([, level]) => level <= LIVING_WORLD_LEVEL_CAP)).toBe(true);
  });

  it("gives the authored great wyrm a racial-dominant apex route", () => {
    const wyrm = normalizeCharacterProgression({ id: "great-wyrm", race: "wyrm", profession: null });
    const racialRanks = Object.entries(wyrm.progression.paths)
      .filter(([pathId]) => pathId.includes("dragon-ascendant") || pathId === "awakened-lineage")
      .reduce((sum, [, rank]) => sum + rank, 0);

    expect(wyrm).toMatchObject({ profession: "dragon-ascendant" });
    expect(progressionLevel(wyrm)).toBe(100);
    expect(racialRanks).toBeGreaterThanOrEqual(80);
  });
});

describe("advancement", () => {
  it("adds the next compiled path rank and its attribute gains when XP crosses a level", () => {
    const character = {
      profession: "farmer",
      race: "human",
      attributes: { body: 6, reflex: 3, vigor: 7, mind: 4, wit: 5, presence: 3 },
      progression: createProgression({ professionId: "farmer", level: 10, sidePath: "utility" }),
    };
    const before = structuredClone(character.attributes);
    const result = advanceProgression(character, progressionXpForLevel(11) - progressionXpForLevel(10));

    expect(result.beforeLevel).toBe(10);
    expect(result.afterLevel).toBe(11);
    expect(result.gained).toHaveLength(1);
    expect(result.gained[0]).toMatchObject({ level: 11, professionId: "farmer", rank: 11 });
    expect(Object.keys(result.gained[0].attributeGains).some((key) => character.attributes[key] > before[key])).toBe(true);
  });

  it("cannot advance a custom route beyond its legal per-level attribute ceiling", () => {
    const route = progressionAtLevel("courtier", 83, { sidePath: "utility", archetypeId: "confidence-artist" });
    const character = {
      profession: "courtier",
      archetype: "confidence-artist",
      attributes: { ...route.attributes },
      progression: createProgression({ professionId: "courtier", archetypeId: "confidence-artist", level: 83, sidePath: "utility" }),
    };

    const result = advanceProgression(character, progressionXpForLevel(84) - progressionXpForLevel(83));

    expect(result.afterLevel).toBe(84);
    expect(Math.max(...Object.values(character.attributes))).toBeLessThanOrEqual(attributeCeilingForLevel(84));
  });
});
