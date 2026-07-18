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
  "warlock-tithe-bolt", "warlock-debt-mark", "warlock-favors-rebuke", "warlock-open-covenant",
  "warlock-owed-ward", "warlock-covenant-lash", "warlock-creditors-gaze", "warlock-claim-due",
  "warlock-ruinous-terms", "warlock-fivefold-collection", "warlock-black-bargain", "warlock-pact-apotheosis",
]);

const BRANCH_ABILITIES = Object.freeze([
  "warlock-hellfire-covenant", "warlock-witch-mark", "warlock-pact-chain", "warlock-whispered-terms",
  "warlock-infernal-volley", "warlock-devils-due", "warlock-layered-hex", "warlock-sympathetic-token",
  "warlock-binding-links", "warlock-shared-burden", "warlock-secret-leverage", "warlock-open-bargain",
]);

describe("focused Warlock progression", () => {
  it("authors 70 unique concrete rows around paid Pact Price and fight-bound Favor", () => {
    const warlock = compileProfessionTrack("warlock");
    expect(warlock.levels).toHaveLength(70);
    expect(new Set(warlock.levels.map((entry) => entry.feature)).size).toBe(70);
    expect(warlock.levels.every((entry) => entry.authoredContent && entry.featureDescription)).toBe(true);
    expect(warlock.levels.every((entry) => entry.generalGrants.some((grant) => grant.noncombatBenefit === true))).toBe(true);

    const abilities = warlock.levels.flatMap((entry) => entry.generalGrants)
      .filter((grant) => grant.type === "ability").map((grant) => grant.id);
    expect(abilities).toEqual(GENERAL_ABILITIES);
    expect(warlock.levels[0].generalGrants).toContainEqual(expect.objectContaining({
      id: "warlock:pact-favor",
      selfSide: true,
      min: 0,
      max: 5,
      resetEachFight: true,
      earnedOnlyAfterAuthoredPricePaid: true,
      mereCastingBuilds: false,
      cancelledActionsBuild: false,
      foreignActionsBuild: false,
      spendOnCommitEvenIfMissed: true,
      multiHitSpendsOnce: true,
      cardAndNpcParity: true,
    }));
    expect(warlock.levels[69].feature).toBe("Pact Apotheosis");
    expect(PROFESSION_PROFILES.warlock).toMatchObject({
      name: "Warlock",
      domain: "pactcraft",
      abilities: GENERAL_ABILITIES,
    });
    expect(professionContentStatus("warlock")).toBe("complete");
  });

  it("gives four pact roots two L30 methods each and every method two card-free L50 masteries", () => {
    const branches = professionBranchChoices("warlock");
    const root = branches.find((entry) => entry.id === "warlock-pact");
    expect(root.options.map((option) => option.id)).toEqual([
      "demon-warlock", "witch", "chainbinder", "whisper-broker",
    ]);
    expect(branches).toHaveLength(13);
    expect(branches.reduce((sum, entry) => sum + entry.options.length, 0)).toBe(28);
    expect(branches.filter((entry) => entry.threshold === 10)).toHaveLength(1);
    expect(branches.filter((entry) => entry.threshold === 30)).toHaveLength(4);
    expect(branches.filter((entry) => entry.threshold === 50)).toHaveLength(8);
    expect(Object.fromEntries(branches.filter((entry) => entry.threshold === 30)
      .map((entry) => [entry.id, entry.options.map((option) => option.id)]))).toEqual({
      "warlock-demon-method": ["hellfire-adept", "contract-keeper"],
      "warlock-witch-method": ["hexweaver", "token-witch"],
      "warlock-chainbinder-method": ["fetterer", "burden-bearer"],
      "warlock-whisper-method": ["secretmonger", "pact-merchant"],
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

  it("gates each pact route in sequence without exposing unrelated choices", () => {
    expect(pendingProfessionChoices({ professionId: "warlock", levels: 10, branchChoices: {} })
      .map((entry) => entry.id)).toEqual(["warlock-pact"]);
    expect(pendingProfessionChoices({ professionId: "warlock", levels: 30, branchChoices: {
      "warlock-pact": "witch",
    } }).map((entry) => entry.id)).toEqual(["warlock-witch-method"]);
    expect(pendingProfessionChoices({ professionId: "warlock", levels: 50, branchChoices: {
      "warlock-pact": "witch",
      "warlock-witch-method": "token-witch",
    } }).map((entry) => entry.id)).toEqual(["warlock-token-witch-mastery"]);

    expect(PROFESSION_PROFILES.warlock.abilities).not.toEqual(expect.arrayContaining([
      "shadow-bolt", "life-drain", "summon-undead", "dominate",
    ]));
  });

  it("surfaces exact Warlock identities as specializations of the broad profession", () => {
    expect(PROFESSIONS.warlock).toMatchObject({ id: "warlock", name: "Warlock", role: "Pact caster" });
    expect(PROFESSIONS.warlock.specializations.map((entry) => entry.id)).toEqual([
      "demon-warlock", "witch", "chainbinder", "whisper-broker",
    ]);
    expect(PROFESSION_ALIASES).toMatchObject({
      "demon-warlock": "warlock",
      witch: "warlock",
      chainbinder: "warlock",
      "whisper-broker": "warlock",
    });
  });
});
