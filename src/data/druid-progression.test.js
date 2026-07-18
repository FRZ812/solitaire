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

const GENERAL_ABILITIES = Object.freeze([
  "druid-verdant-spark",
  "druid-sunlance",
  "druid-leafrot",
  "druid-rimebark",
  "druid-saprise",
  "druid-sirocco",
  "druid-harvest-tide",
  "druid-frostroot",
  "druid-living-canopy",
  "druid-high-summer",
  "druid-return-to-soil",
  "druid-great-year",
]);

const BRANCH_ABILITIES = Object.freeze([
  "druid-grove-awakening",
  "druid-predator-shape",
  "druid-gale-shear",
  "druid-decay-mark",
  "druid-entangling-thicket",
  "druid-ironbark-rise",
  "druid-wolf-aspect",
  "druid-bear-aspect",
  "druid-stormbolt",
  "druid-sunwheel",
  "druid-moldering-wave",
  "druid-reclamation-bloom",
]);

describe("focused Druid progression", () => {
  it("authors 70 unique, concrete rows around an independent four-season cycle", () => {
    const druid = compileProfessionTrack("druid");
    expect(druid.levels).toHaveLength(70);
    expect(new Set(druid.levels.map((entry) => entry.feature)).size).toBe(70);
    expect(druid.levels.every((entry) => entry.authoredContent && entry.featureDescription)).toBe(true);
    expect(druid.levels.every((entry) => entry.generalGrants.some((grant) => grant.noncombatBenefit === true))).toBe(true);

    const abilities = druid.levels.flatMap((entry) => entry.generalGrants)
      .filter((grant) => grant.type === "ability");
    expect(abilities.map((grant) => grant.id)).toEqual(GENERAL_ABILITIES);
    expect(abilities.map((grant) => grant.authoredSeason)).toEqual([
      "spring", "summer", "autumn", "winter",
      "spring", "summer", "autumn", "winter",
      "spring", "summer", "autumn", "winter",
    ]);
    expect(abilities.every((grant) => grant.nativeDruidAction === true)).toBe(true);

    expect(druid.levels[0].generalGrants).toContainEqual(expect.objectContaining({
      id: "druid:four-season-cycle",
      selfSide: true,
      independentDruids: true,
      seasonOrder: ["spring", "summer", "autumn", "winter"],
      resetEachFight: "spring",
      matchingSeasonEmpowered: true,
      advancesOnCommittedNativeAction: true,
      advancesOnMiss: true,
      multiHitAdvancesOnce: true,
      cancelledActionsAdvance: false,
      foreignActionsAdvance: false,
    }));
    expect(druid.levels[69].feature).toBe("Great Year");
    expect(PROFESSION_PROFILES.druid).toMatchObject({
      name: "Druid",
      domain: "primal-seasonal",
      abilities: GENERAL_ABILITIES,
    });
    expect(professionContentStatus("druid")).toBe("complete");
  });

  it("gives four circles two L30 methods each and every method two card-free L50 masteries", () => {
    const branches = professionBranchChoices("druid");
    const root = branches.find((entry) => entry.id === "druid-circle");
    expect(root.options.map((option) => option.id)).toEqual([
      "circle-of-root", "circle-of-fang", "circle-of-sky", "circle-of-cycle",
    ]);
    expect(branches).toHaveLength(13);
    expect(branches.reduce((sum, entry) => sum + entry.options.length, 0)).toBe(28);
    expect(branches.filter((entry) => entry.threshold === 10)).toHaveLength(1);
    expect(branches.filter((entry) => entry.threshold === 30)).toHaveLength(4);
    expect(branches.filter((entry) => entry.threshold === 50)).toHaveLength(8);
    expect(Object.fromEntries(branches.filter((entry) => entry.threshold === 30)
      .map((entry) => [entry.id, entry.options.map((option) => option.id)]))).toEqual({
      "druid-root-method": ["grovekeeper", "heartwood-sage"],
      "druid-fang-method": ["prowler", "greatbeast"],
      "druid-sky-method": ["stormcaller", "sunkeeper"],
      "druid-cycle-method": ["rotwarden", "reclaimer"],
    });

    for (const circle of root.options) {
      const method = branches.find((entry) => entry.threshold === 30
        && entry.parentChoiceId === root.id && entry.parentOptionId === circle.id);
      expect(method, circle.id).toBeTruthy();
      expect(method.options, circle.id).toHaveLength(2);
      for (const option of method.options) {
        const mastery = branches.find((entry) => entry.threshold === 50
          && entry.parentChoiceId === method.id && entry.parentOptionId === option.id);
        expect(mastery, `${circle.id}/${option.id}`).toBeTruthy();
        expect(mastery.options, `${circle.id}/${option.id}`).toHaveLength(2);
        expect(mastery.options.flatMap((entry) => entry.grants).some((grant) => grant.type === "ability"), mastery.id).toBe(false);
      }
    }

    const branchAbilities = branches.flatMap((entry) => entry.options)
      .flatMap((option) => option.grants).filter((grant) => grant.type === "ability");
    expect(branchAbilities.map((grant) => grant.id)).toEqual(BRANCH_ABILITIES);
    expect(branchAbilities.map((grant) => grant.authoredSeason)).toEqual([
      "spring", "summer", "winter", "autumn",
      "spring", "winter", "autumn", "winter",
      "summer", "summer", "autumn", "spring",
    ]);
    expect(new Set(branchAbilities.map((grant) => grant.id)).size).toBe(12);
    expect(new Set(branchAbilities.map((grant) => grant.id).filter((id) => GENERAL_ABILITIES.includes(id))).size).toBe(0);
  });

  it("gates each circle path in sequence and retires the generic two-stage Druid", () => {
    expect(pendingProfessionChoices({ professionId: "druid", levels: 10, branchChoices: {} }).map((entry) => entry.id))
      .toEqual(["druid-circle"]);
    expect(pendingProfessionChoices({ professionId: "druid", levels: 30, branchChoices: {
      "druid-circle": "circle-of-fang",
    } }).map((entry) => entry.id)).toEqual(["druid-fang-method"]);
    expect(pendingProfessionChoices({ professionId: "druid", levels: 50, branchChoices: {
      "druid-circle": "circle-of-fang",
      "druid-fang-method": "greatbeast",
    } }).map((entry) => entry.id)).toEqual(["druid-greatbeast-mastery"]);

    const serialized = JSON.stringify(professionBranchChoices("druid"));
    expect(serialized).not.toMatch(/moon-circle|land-circle|elder mystery|archdruid|worldroot/i);
    expect(PROFESSION_PROFILES.druid.abilities).not.toEqual(expect.arrayContaining([
      "snare", "heal", "frost-nova", "beast-shift", "tempest",
    ]));
  });

  it("surfaces Druid circles as specializations while preserving the broad outward profession", () => {
    expect(PROFESSIONS.druid).toMatchObject({ id: "druid", name: "Druid", role: "Primal caster" });
    expect(PROFESSIONS.druid.specializations.map((entry) => entry.id)).toEqual([
      "circle-of-root", "circle-of-fang", "circle-of-sky", "circle-of-cycle",
    ]);
    expect(PROFESSION_ALIASES).toMatchObject({
      "circle-warden": "druid",
      "circle-of-root": "druid",
      "circle-of-fang": "druid",
      "circle-of-sky": "druid",
      "circle-of-cycle": "druid",
    });
  });
});
