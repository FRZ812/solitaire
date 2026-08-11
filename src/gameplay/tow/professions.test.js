import { describe, expect, it } from "vitest";
import { PROFESSIONS } from "../../data/professions.js";
import { getSkill, SKILL_SLOTS } from "./skills.js";
import { getTrait } from "./traits.js";
import {
  FALLBACK_PROFESSION_ID,
  mappedProfessionIds,
  towBuildForCharacter,
  towPackageForProfession,
  traitRankForLevel,
} from "./professions.js";

describe("every profession has a package", () => {
  it("covers the whole canonical profession list", () => {
    const canonical = Object.keys(PROFESSIONS);
    expect(canonical.length).toBeGreaterThan(0);
    for (const id of canonical) {
      expect(mappedProfessionIds(), `missing package for ${id}`).toContain(id);
    }
  });

  it("names only traits and skills the catalogues actually hold", () => {
    for (const id of mappedProfessionIds()) {
      const definition = towPackageForProfession(id);
      expect(getTrait(definition.traitId), `unknown trait for ${id}`).not.toBeNull();
      for (const skillId of definition.skills) {
        expect(getSkill(skillId), `unknown skill ${skillId} for ${id}`).not.toBeNull();
      }
    }
  });

  it("opens every package with an attack slot and a defence slot", () => {
    for (const id of mappedProfessionIds()) {
      expect(towPackageForProfession(id).skills.slice(0, 2)).toEqual(["strike", "block"]);
    }
  });

  it("never exceeds the five-slot loadout", () => {
    for (const id of mappedProfessionIds()) {
      expect(towPackageForProfession(id).skills.length).toBeLessThanOrEqual(SKILL_SLOTS);
    }
  });

  it("keeps professions mechanically distinct rather than all-Strike-and-Block", () => {
    const signatures = new Set(mappedProfessionIds().map((id) => {
      const definition = towPackageForProfession(id);
      return `${definition.traitId}:${definition.skills.join(",")}`;
    }));
    // Civilian professions deliberately share shapes, but the martial and caster
    // packages must not collapse into one another.
    expect(signatures.size).toBeGreaterThanOrEqual(20);
  });

  it("falls back rather than throwing for an unknown profession", () => {
    expect(towPackageForProfession("not-a-profession"))
      .toEqual(towPackageForProfession(FALLBACK_PROFESSION_ID));
    expect(towPackageForProfession(undefined)).toEqual(towPackageForProfession(FALLBACK_PROFESSION_ID));
  });
});

describe("trait rank rises with level", () => {
  it("starts at one and caps at seven", () => {
    expect(traitRankForLevel(1)).toBe(1);
    expect(traitRankForLevel(0)).toBe(1);
    expect(traitRankForLevel(100)).toBe(7);
    expect(traitRankForLevel(61)).toBe(7);
  });

  it("never decreases as level rises", () => {
    let previous = 0;
    for (let level = 1; level <= 100; level += 1) {
      const rank = traitRankForLevel(level);
      expect(rank).toBeGreaterThanOrEqual(previous);
      previous = rank;
    }
  });

  it("survives a missing level", () => {
    expect(traitRankForLevel(undefined)).toBe(1);
    expect(traitRankForLevel(NaN)).toBe(1);
  });
});

describe("building a character's combat kit", () => {
  it("gives a warrior Ironclad and a warrior's answers", () => {
    const build = towBuildForCharacter({ profession: "fighter", level: 1 });
    expect(build.traits).toEqual({ ironclad: 1 });
    expect(build.skills).toEqual(["strike", "block", "warcry", "deliberate-blow"]);
  });

  it("scales the trait with the character's level", () => {
    expect(towBuildForCharacter({ profession: "fighter", level: 50 }).traits.ironclad).toBe(6);
    expect(towBuildForCharacter({ profession: "fighter", level: 100 }).traits.ironclad).toBe(7);
  });

  it("reads a level held on the progression record", () => {
    expect(towBuildForCharacter({ profession: "fighter", progression: { level: 100 } }).traits.ironclad)
      .toBe(7);
  });

  it("produces a usable build for a bare character", () => {
    const build = towBuildForCharacter({});
    expect(build.skills).toContain("strike");
    expect(build.skills).toContain("block");
    expect(Object.keys(build.traits)).toHaveLength(1);
    expect(build.runes).toEqual([]);
  });
});
