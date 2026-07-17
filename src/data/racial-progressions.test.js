import { describe, expect, it } from "vitest";
import { getAbilityDef } from "./abilities.js";
import {
  RACIAL_BRANCHES,
  normalizeRacialBranchChoices,
  pendingRacialBranchChoices,
  racialBranchChoices,
  racialBranchGrantsAtLevel,
  resolveRacialBranchChoice,
} from "./racial-branches.js";
import {
  RACIAL_PROFILES,
  racialProgressionAtLevel,
  racialProgressionRows,
} from "./racial-progressions.js";
import { validateProgressionGrant } from "./progression-features.js";

const EXPECTED_RACES = [
  "human", "elf", "dwarf", "halfling", "half-orc", "orc", "goblin",
  "drakeborn", "beastfolk", "demonborn", "vampire", "lycanthrope",
  "wyrm", "demon", "fae",
];

const grantError = (grant) => validateProgressionGrant(grant, {
  abilityExists: (id) => !!getAbilityDef(id),
});

describe("individually authored racial progression", () => {
  it("defines a distinct, detailed 30-level ladder for every playable and lore ancestry", () => {
    expect(Object.keys(RACIAL_PROFILES)).toEqual(EXPECTED_RACES);
    const progressionReferences = new Set();
    for (const raceId of EXPECTED_RACES) {
      const profile = RACIAL_PROFILES[raceId];
      const rows = racialProgressionRows(raceId);
      expect(rows, raceId).toHaveLength(30);
      expect(progressionReferences.has(rows), `${raceId} reuses another race's progression array`).toBe(false);
      progressionReferences.add(rows);
      expect(rows.map((row) => row.level), raceId).toEqual(Array.from({ length: 30 }, (_, index) => index + 1));
      expect(new Set(rows.map((row) => row.name)).size, `${raceId} repeated row names`).toBe(30);
      for (const row of rows) {
        expect(row.description.length, `${raceId}/L${row.level}`).toBeGreaterThan(35);
        expect(row.grants.length, `${raceId}/L${row.level}`).toBeGreaterThan(0);
        expect(row.grants[0], `${raceId}/L${row.level}`).toEqual(expect.objectContaining({
          type: "proficiency",
          id: `${raceId}:racial-level-${row.level}`,
          name: row.name,
        }));
        for (const grant of row.grants) expect(grantError(grant), `${raceId}/L${row.level}/${grant.id}`).toBeNull();
      }
      expect(racialProgressionAtLevel(raceId, 1)).toBe(rows[0]);
      expect(racialProgressionAtLevel(raceId, 30)).toBe(rows[29]);
      expect(profile.stageLevels).toEqual([1, 16, 26]);
      expect(profile.evolutionStages.map((stage) => stage.name)).toEqual(profile.stages);
      const evolutionRows = rows.filter((row) => row.grants.some((grant) => grant.type === "evolution"));
      expect(evolutionRows.map((row) => row.level), raceId).toEqual([1, 16, 26]);
      expect(evolutionRows.map((row) => row.grants.find((grant) => grant.type === "evolution").name), raceId).toEqual(profile.stages);
    }
  });

  it("makes the required metamorphoses explicit instead of treating race as a static kit", () => {
    expect(RACIAL_PROFILES.vampire.stages).toEqual(["Lesser Vampire", "Vampire", "True Vampire"]);
    expect(racialProgressionAtLevel("vampire", 1).name).toBe("Lesser Vampire");
    expect(racialProgressionAtLevel("vampire", 16).name).toBe("Vampire");
    expect(racialProgressionAtLevel("vampire", 26).name).toBe("True Vampire");

    expect(RACIAL_PROFILES.drakeborn.stages).toEqual(["Drake-Blooded", "Wyrm-Blooded", "Dragon Ascendant"]);
    expect(racialProgressionAtLevel("drakeborn", 26).grants).toContainEqual(expect.objectContaining({
      type: "evolution",
      id: "dragon-ascendant",
    }));
  });

  it("keeps every authored grant mechanically typed and all ability ids resolvable", () => {
    for (const [raceId, profile] of Object.entries(RACIAL_PROFILES)) {
      for (const row of profile.progression) {
        for (const grant of row.grants) expect(grantError(grant), `${raceId}/L${row.level}/${grant.id}`).toBeNull();
      }
      for (const definition of racialBranchChoices(raceId)) {
        for (const branchOption of definition.options) {
          for (const grant of branchOption.grants) expect(grantError(grant), `${raceId}/${branchOption.id}/${grant.id}`).toBeNull();
        }
      }
    }
  });
});

describe("player-selected racial branches", () => {
  it("authors an unresolved level-10 choice and a distinct level-20 child for every root option", () => {
    expect(Object.keys(RACIAL_BRANCHES)).toEqual(EXPECTED_RACES);
    for (const raceId of EXPECTED_RACES) {
      const definitions = racialBranchChoices(raceId);
      const root = definitions.find((definition) => !definition.parentChoiceId);
      expect(root, raceId).toBeTruthy();
      expect(root.threshold, raceId).toBe(10);
      expect(root.options.length, raceId).toBeGreaterThanOrEqual(3);
      for (const rootOption of root.options) {
        const child = definitions.find((definition) => (
          definition.parentChoiceId === root.id && definition.parentOptionId === rootOption.id
        ));
        expect(child, `${raceId}/${rootOption.id}`).toBeTruthy();
        expect(child.threshold, `${raceId}/${rootOption.id}`).toBe(20);
        expect(child.options.length, `${raceId}/${rootOption.id}`).toBeGreaterThanOrEqual(2);
      }
      for (const definition of definitions) {
        for (const branchOption of definition.options) {
          expect(branchOption.description.length, `${raceId}/${branchOption.id}`).toBeGreaterThan(35);
          expect(branchOption.grants.some((grant) => ["ability", "passive", "action", "evolution"].includes(grant.type)), `${raceId}/${branchOption.id}`).toBe(true);
        }
      }
      expect(pendingRacialBranchChoices(raceId, 9, {})).toEqual([]);
      expect(pendingRacialBranchChoices(raceId, 10, {}).map((definition) => definition.id)).toEqual([root.id]);
    }
  });

  it("never silently selects a player branch and only reveals the child reached by the stored parent", () => {
    expect(normalizeRacialBranchChoices("vampire")).toEqual({});
    expect(racialBranchGrantsAtLevel("vampire", 10, {})).toEqual([]);
    expect(pendingRacialBranchChoices("vampire", 10, {}).map((choice) => choice.id)).toEqual(["vampire-dark-legacy"]);

    const sovereign = resolveRacialBranchChoice("vampire", 10, {}, "vampire-dark-legacy", "blood-sovereign");
    expect(sovereign).toEqual({ "vampire-dark-legacy": "blood-sovereign" });
    expect(pendingRacialBranchChoices("vampire", 19, sovereign)).toEqual([]);
    expect(pendingRacialBranchChoices("vampire", 20, sovereign).map((choice) => choice.id)).toEqual(["vampire-sovereign-apotheosis"]);
    expect(pendingRacialBranchChoices("vampire", 20, {
      ...sovereign,
      "vampire-stalker-apotheosis": "mist-reaver",
    }).map((choice) => choice.id)).toEqual(["vampire-sovereign-apotheosis"]);
  });

  it("persists valid selections, rejects premature choices, and grants overlays only at their threshold", () => {
    expect(() => resolveRacialBranchChoice("drakeborn", 9, {}, "drakeborn-breath-line", "storm-line")).toThrow(/not pending/);
    const storm = resolveRacialBranchChoice("drakeborn", 10, {}, "drakeborn-breath-line", "storm-line");
    expect(storm).toEqual({ "drakeborn-breath-line": "storm-line" });
    expect(racialBranchGrantsAtLevel("drakeborn", 9, storm)).toEqual([]);
    expect(racialBranchGrantsAtLevel("drakeborn", 10, storm)).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "ability", id: "electrocute" }),
      expect.objectContaining({ type: "passive", id: "tempest" }),
    ]));
    const skyCoil = resolveRacialBranchChoice("drakeborn", 20, storm, "drakeborn-storm-ascendance", "sky-coil");
    expect(skyCoil).toEqual({
      "drakeborn-breath-line": "storm-line",
      "drakeborn-storm-ascendance": "sky-coil",
    });
    expect(racialBranchGrantsAtLevel("drakeborn", 20, skyCoil)).toContainEqual(expect.objectContaining({
      type: "ability",
      id: "chain-lightning",
    }));
  });
});
