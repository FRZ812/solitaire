import { describe, expect, it } from "vitest";
import { PROGRESSION_VERSION, attributeCeilingForLevel, progressionLevel } from "./progression.js";
import { progressionAtLevel } from "../data/progression-paths.js";
import { mergeDiscoveries } from "./discoveries.js";

describe("generated Codex character progression", () => {
  it("normalizes every discovered person into paths and caps narrator-proposed world levels at 60", () => {
    const { codex } = mergeDiscoveries({ characters: {} }, {
      characters: [{
        id: "old-bridge-warden",
        name: "The Old Bridge Warden",
        profession: "warden",
        archetype: "river-sentinel",
        level: 97,
        attributes: {
          body: 90,
          agility: 90,
          mind: 90,
          spirit: 90,
          presence: 90,
          luck: 90,
        },
      }],
    });

    const warden = codex.characters["old-bridge-warden"];
    expect(progressionLevel(warden)).toBe(60);
    expect(warden.progression).toMatchObject({ version: PROGRESSION_VERSION, professionId: "ranger", archetypeId: "river-sentinel" });
    expect(Math.max(...Object.values(warden.attributes))).toBeLessThanOrEqual(attributeCeilingForLevel(60));
    expect(warden).not.toHaveProperty("level");
  });

  it("uses authored apex levels for exceptional end-game figures", () => {
    const { codex } = mergeDiscoveries({ characters: {} }, {
      characters: [
        { id: "demon-king", name: "The Demon King", profession: "warlock", level: 20 },
        { id: "witch-queen", name: "The Witch Queen", profession: "witch", level: 20 },
      ],
    });

    expect(progressionLevel(codex.characters["demon-king"])).toBe(100);
    expect(progressionLevel(codex.characters["witch-queen"])).toBe(78);
  });

  it("raises an underspecified high-level sheet to the budget earned by its ranks", () => {
    const { codex } = mergeDiscoveries({ characters: {} }, {
      characters: [{
        id: "schema-soldier",
        name: "Schema Soldier",
        age: 30,
        profession: "soldier",
        archetype: "gate-veteran",
        level: 100,
        attributes: { body: 2, reflex: 3, vigor: 2, mind: 2, wit: 4, presence: 1 },
      }],
    });
    const soldier = codex.characters["schema-soldier"];
    const route = progressionAtLevel("soldier", 60, {
      sidePath: soldier.progression.sidePath,
      archetypeId: soldier.progression.archetypeId,
    }).attributes;
    const routeTotal = Object.values(route).reduce((sum, value) => sum + value, 0);
    const actualTotal = Object.values(soldier.attributes).reduce((sum, value) => sum + value, 0);

    expect(progressionLevel(soldier)).toBe(60);
    expect(actualTotal).toBeGreaterThanOrEqual(Math.round(routeTotal * 0.85));
    expect(soldier.attributes.vigor).toBeGreaterThan(soldier.attributes.presence);
  });

  it("does not let a later narrator discovery restat a progression-owned person", () => {
    const created = mergeDiscoveries({ characters: {} }, {
      characters: [{
        id: "gate-soldier",
        name: "Gate Soldier",
        profession: "soldier",
        archetype: "watch-corporal",
        level: 10,
        attributes: { body: 4, reflex: 3, vigor: 5, mind: 1, wit: 2, presence: 1 },
      }],
    }).codex;
    const before = { ...created.characters["gate-soldier"].attributes };
    const updated = mergeDiscoveries(created, {
      characters: [{
        id: "gate-soldier",
        description: "The same corporal, newly encountered at another gate.",
        templateId: "dragon-ascendant",
        progression: { version: 1, professionId: "soldier", paths: { fake: 100 } },
        attributes: { body: 90, reflex: 90, vigor: 90, mind: 90, wit: 90, presence: 90 },
      }],
    }).codex.characters["gate-soldier"];

    expect(updated.attributes).toEqual(before);
    expect(updated.description).toContain("another gate");
    expect(progressionLevel(updated)).toBe(10);
    expect(updated).not.toHaveProperty("templateId");
    expect(updated.progression.paths).not.toHaveProperty("fake");

    const afterNulls = mergeDiscoveries({ characters: { "gate-soldier": updated } }, {
      characters: [{ id: "gate-soldier", level: 5, progression: null, templateId: null, attributes: null }],
    }).codex.characters["gate-soldier"];
    expect(progressionLevel(afterNulls)).toBe(10);
    expect(afterNulls.attributes).toEqual(before);
  });

  it("keeps the engine-owned profession catalog closed to dynamic discoveries", () => {
    const existing = { characters: {}, professions: { soldier: { id: "soldier", name: "Soldier" } } };
    const { codex, newlyDiscovered } = mergeDiscoveries(existing, {
      professions: [{ id: "marsh-spearman", name: "Marsh Spearman" }],
      classes: [{ id: "legacy-knight", name: "Legacy Knight" }],
    });

    expect(codex.professions).toEqual(existing.professions);
    expect(newlyDiscovered).toEqual([]);
  });

  it("rejects narrator-supplied ranks and playable-template identity", () => {
    const { codex } = mergeDiscoveries({ characters: {} }, {
      characters: [{
        id: "random-boss",
        name: "Random Boss",
        profession: "warlord",
        archetype: "road-tyrant",
        level: 100,
        templateId: "dragon-ascendant",
        progression: {
          version: 1,
          professionId: "warlord",
          archetypeId: "road-tyrant",
          sidePath: "racial",
          xp: 99999999,
          paths: { fake: 100 },
        },
        attributes: { body: 90, reflex: 90, vigor: 90, mind: 90, wit: 90, presence: 90 },
      }],
    });
    const boss = codex.characters["random-boss"];

    expect(progressionLevel(boss)).toBe(60);
    expect(boss).not.toHaveProperty("templateId");
    expect(boss.progression.paths).not.toHaveProperty("fake");
  });
});
