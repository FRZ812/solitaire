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
  "artificer-snapfire-capsule", "artificer-field-refit", "artificer-guard-projector", "artificer-tangle-line",
  "artificer-arc-node", "artificer-countermeasure", "artificer-relay-bolt", "artificer-repeating-engine",
  "artificer-adaptive-plating", "artificer-collapse-charge", "artificer-masterwork-array", "artificer-grand-invention",
]);

const BRANCH_ABILITIES = Object.freeze([
  "artificer-inscribed-ward", "artificer-flash-phial", "artificer-clockwork-sentinel", "artificer-deployable-barricade",
  "artificer-layered-seal", "artificer-runic-edge", "artificer-restorative-aerosol", "artificer-fracture-compound",
  "artificer-interception-automaton", "artificer-overclock-servo", "artificer-shaped-demolition", "artificer-bulwark-frame",
]);

describe("focused Artificer progression", () => {
  it("authors 70 unique concrete levels around finite prepared Device Charges", () => {
    const artificer = compileProfessionTrack("artificer");
    expect(artificer.levels).toHaveLength(70);
    expect(new Set(artificer.levels.map((entry) => entry.feature)).size).toBe(70);
    expect(artificer.levels.every((entry) => entry.authoredContent && entry.featureDescription)).toBe(true);
    expect(artificer.levels.every((entry) => entry.generalGrants.some((grant) => grant.noncombatBenefit === true))).toBe(true);

    const abilities = artificer.levels.flatMap((entry) => entry.generalGrants)
      .filter((grant) => grant.type === "ability").map((grant) => grant.id);
    expect(abilities).toEqual(GENERAL_ABILITIES);
    expect(artificer.levels[0].generalGrants).toContainEqual(expect.objectContaining({
      id: "artificer:prepared-device-charges",
      selfSide: true,
      min: 0,
      max: 5,
      resetEachFight: 5,
      spendOnCommitEvenIfMissed: true,
      multiHitSpendsOnce: true,
      cardAndNpcParity: true,
      fieldRefitBounded: true,
      foreignActionsAffect: false,
    }));
    expect(artificer.levels[69].feature).toBe("Grand Invention");
    expect(PROFESSION_PROFILES.artificer).toMatchObject({
      name: "Artificer",
      domain: "devicecraft",
      abilities: GENERAL_ABILITIES,
    });
    expect(professionContentStatus("artificer")).toBe("complete");
  });

  it("gives four workshops two L30 methods each and every method two card-free L50 masteries", () => {
    const branches = professionBranchChoices("artificer");
    const root = branches.find((entry) => entry.id === "artificer-workshop");
    expect(root.options.map((option) => option.id)).toEqual(["runesmith", "alchemist", "mechanist", "siegewright"]);
    expect(branches).toHaveLength(13);
    expect(branches.reduce((sum, entry) => sum + entry.options.length, 0)).toBe(28);
    expect(branches.filter((entry) => entry.threshold === 10)).toHaveLength(1);
    expect(branches.filter((entry) => entry.threshold === 30)).toHaveLength(4);
    expect(branches.filter((entry) => entry.threshold === 50)).toHaveLength(8);
    expect(Object.fromEntries(branches.filter((entry) => entry.threshold === 30)
      .map((entry) => [entry.id, entry.options.map((option) => option.id)]))).toEqual({
      "artificer-runesmith-method": ["wardwright", "edgewright"],
      "artificer-alchemist-method": ["catalyst-brewer", "volatile-compounder"],
      "artificer-mechanist-method": ["sentinel-smith", "servo-engineer"],
      "artificer-siegewright-method": ["breach-engineer", "bulwark-architect"],
    });

    for (const specialization of root.options) {
      const method = branches.find((entry) => entry.threshold === 30
        && entry.parentChoiceId === root.id && entry.parentOptionId === specialization.id);
      expect(method, specialization.id).toBeTruthy();
      expect(method.options, specialization.id).toHaveLength(2);
      for (const option of method.options) {
        const mastery = branches.find((entry) => entry.threshold === 50
          && entry.parentChoiceId === method.id && entry.parentOptionId === option.id);
        expect(mastery, `${specialization.id}/${option.id}`).toBeTruthy();
        expect(mastery.options, `${specialization.id}/${option.id}`).toHaveLength(2);
        expect(mastery.options.flatMap((entry) => entry.grants)
          .some((grant) => grant.type === "ability"), mastery.id).toBe(false);
      }
    }

    const branchAbilities = branches.flatMap((entry) => entry.options)
      .flatMap((option) => option.grants).filter((grant) => grant.type === "ability")
      .map((grant) => grant.id);
    expect(branchAbilities).toEqual(BRANCH_ABILITIES);
    expect(new Set(branchAbilities).size).toBe(12);
    expect(branchAbilities.some((id) => GENERAL_ABILITIES.includes(id))).toBe(false);
  });

  it("gates workshop routes in sequence", () => {
    expect(pendingProfessionChoices({ professionId: "artificer", levels: 10, branchChoices: {} })
      .map((entry) => entry.id)).toEqual(["artificer-workshop"]);
    expect(pendingProfessionChoices({ professionId: "artificer", levels: 30, branchChoices: {
      "artificer-workshop": "mechanist",
    } }).map((entry) => entry.id)).toEqual(["artificer-mechanist-method"]);
    expect(pendingProfessionChoices({ professionId: "artificer", levels: 50, branchChoices: {
      "artificer-workshop": "mechanist",
      "artificer-mechanist-method": "servo-engineer",
    } }).map((entry) => entry.id)).toEqual(["artificer-servo-engineer-apex"]);

    expect(PROFESSION_PROFILES.artificer.abilities).not.toEqual(expect.arrayContaining([
      "arcane-bolt", "mana-shield", "dispel", "haste", "summon-undead",
    ]));
  });

  it("surfaces exact workshop identities as specializations of broad Artificer", () => {
    expect(PROFESSIONS.artificer).toMatchObject({ id: "artificer", name: "Artificer", role: "Devicecraft" });
    expect(PROFESSIONS.artificer.specializations.map((entry) => entry.id)).toEqual([
      "runesmith", "alchemist", "mechanist", "siegewright",
    ]);
    expect(PROFESSION_ALIASES).toMatchObject({
      runesmith: "artificer",
      alchemist: "artificer",
      mechanist: "artificer",
      siegewright: "artificer",
    });
  });
});
