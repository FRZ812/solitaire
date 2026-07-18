import { describe, expect, it } from "vitest";
import { PROFESSIONS } from "./professions.js";
import {
  PROFESSION_ALIASES,
  PROFESSION_PROFILES,
  compileProfessionTrack,
  pendingProfessionChoices,
  professionBranchChoices,
  professionContentStatus,
} from "./progression-paths.js";

describe("focused Farmer progression", () => {
  it("authors 70 unique non-combat husbandry levels", () => {
    const farmer = compileProfessionTrack("farmer");
    expect(farmer.levels).toHaveLength(70);
    expect(new Set(farmer.levels.map((entry) => entry.feature)).size).toBe(70);
    expect(farmer.levels.every((entry) => entry.authoredContent && entry.featureDescription)).toBe(true);
    expect(farmer.levels.every((entry) => entry.generalGrants.some((grant) => grant.noncombatBenefit === true))).toBe(true);
    expect(farmer.levels.flatMap((entry) => entry.grants).some((grant) => grant.type === "ability")).toBe(false);
    expect(farmer.levels[0].feature).toBe("Farm Year");
    expect(farmer.levels[69].feature).toBe("Living Estate");
    expect(PROFESSION_PROFILES.farmer).toMatchObject({ name: "Farmer", domain: "husbandry", abilities: [] });
    expect(professionContentStatus("farmer")).toBe("complete");
  });

  it("gives four practices two L30 methods and every method two L50 masteries", () => {
    const branches = professionBranchChoices("farmer");
    const root = branches.find((entry) => entry.id === "farmer-practice");
    expect(root.options.map((option) => option.id)).toEqual([
      "field-cultivator", "herd-keeper", "orchard-keeper", "land-reclaimer",
    ]);
    expect(branches).toHaveLength(13);
    expect(branches.reduce((sum, entry) => sum + entry.options.length, 0)).toBe(28);
    expect(branches.filter((entry) => entry.threshold === 10)).toHaveLength(1);
    expect(branches.filter((entry) => entry.threshold === 30)).toHaveLength(4);
    expect(branches.filter((entry) => entry.threshold === 50)).toHaveLength(8);
    expect(Object.fromEntries(branches.filter((entry) => entry.threshold === 30)
      .map((entry) => [entry.id, entry.options.map((option) => option.id)]))).toEqual({
      "farmer-field-cultivator-method": ["seed-steward", "soil-husband"],
      "farmer-herd-keeper-method": ["lineage-breeder", "pasture-warden"],
      "farmer-orchard-keeper-method": ["graftmaster", "grove-steward"],
      "farmer-land-reclaimer-method": ["watershed-keeper", "reclamation-farmer"],
    });

    for (const practice of root.options) {
      const method = branches.find((entry) => entry.threshold === 30
        && entry.parentChoiceId === root.id && entry.parentOptionId === practice.id);
      expect(method, practice.id).toBeTruthy();
      expect(method.options, practice.id).toHaveLength(2);
      for (const option of method.options) {
        const mastery = branches.find((entry) => entry.threshold === 50
          && entry.parentChoiceId === method.id && entry.parentOptionId === option.id);
        expect(mastery, `${practice.id}/${option.id}`).toBeTruthy();
        expect(mastery.options, `${practice.id}/${option.id}`).toHaveLength(2);
      }
    }

    expect(branches.flatMap((entry) => entry.options)
      .flatMap((option) => option.grants).some((grant) => grant.type === "ability")).toBe(false);
  });

  it("gates practice, method, and mastery choices in sequence", () => {
    expect(pendingProfessionChoices({ professionId: "farmer", levels: 10, branchChoices: {} })
      .map((entry) => entry.id)).toEqual(["farmer-practice"]);
    expect(pendingProfessionChoices({ professionId: "farmer", levels: 30, branchChoices: {
      "farmer-practice": "orchard-keeper",
    } }).map((entry) => entry.id)).toEqual(["farmer-orchard-keeper-method"]);
    expect(pendingProfessionChoices({ professionId: "farmer", levels: 50, branchChoices: {
      "farmer-practice": "orchard-keeper",
      "farmer-orchard-keeper-method": "graftmaster",
    } }).map((entry) => entry.id)).toEqual(["farmer-graftmaster-mastery"]);
  });

  it("surfaces exact husbandry identities as specializations of broad Farmer", () => {
    expect(PROFESSIONS.farmer).toMatchObject({ id: "farmer", name: "Farmer", role: "Husbandry" });
    expect(PROFESSIONS.farmer.specializations.map((entry) => entry.id)).toEqual([
      "field-cultivator", "herd-keeper", "orchard-keeper", "land-reclaimer",
    ]);
    expect(PROFESSION_ALIASES).toMatchObject({
      "field-cultivator": "farmer",
      "herd-keeper": "farmer",
      "orchard-keeper": "farmer",
      "land-reclaimer": "farmer",
    });
  });
});
