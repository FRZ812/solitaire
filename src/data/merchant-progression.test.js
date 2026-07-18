import { describe, expect, it } from "vitest";
import { PROFESSIONS } from "./professions.js";
import {
  PROFESSION_ALIASES, PROFESSION_PROFILES, compileProfessionTrack,
  pendingProfessionChoices, professionBranchChoices, professionContentStatus,
} from "./progression-paths.js";

describe("focused Merchant progression", () => {
  it("authors 70 unique non-combat trade levels", () => {
    const merchant = compileProfessionTrack("merchant");
    expect(merchant.levels).toHaveLength(70);
    expect(new Set(merchant.levels.map((entry) => entry.feature)).size).toBe(70);
    expect(merchant.levels.every((entry) => entry.authoredContent && entry.featureDescription)).toBe(true);
    expect(merchant.levels.every((entry) => entry.generalGrants.some((grant) => grant.noncombatBenefit === true))).toBe(true);
    expect(merchant.levels.flatMap((entry) => entry.grants).some((grant) => grant.type === "ability")).toBe(false);
    expect(merchant.levels[0].feature).toBe("Honest Trade");
    expect(merchant.levels[69].feature).toBe("Great Exchange");
    expect(PROFESSION_PROFILES.merchant).toMatchObject({ name: "Merchant", domain: "trade", abilities: [] });
    expect(professionContentStatus("merchant")).toBe("complete");
  });

  it("gives four practices two L30 methods and every method two L50 masteries", () => {
    const branches = professionBranchChoices("merchant");
    const root = branches.find((entry) => entry.id === "merchant-practice");
    expect(root.options.map((option) => option.id)).toEqual(["peddler", "caravan-factor", "guild-broker", "credit-steward"]);
    expect(branches).toHaveLength(13);
    expect(branches.reduce((sum, entry) => sum + entry.options.length, 0)).toBe(28);
    expect(branches.filter((entry) => entry.threshold === 10)).toHaveLength(1);
    expect(branches.filter((entry) => entry.threshold === 30)).toHaveLength(4);
    expect(branches.filter((entry) => entry.threshold === 50)).toHaveLength(8);
    expect(Object.fromEntries(branches.filter((entry) => entry.threshold === 30)
      .map((entry) => [entry.id, entry.options.map((option) => option.id)]))).toEqual({
      "merchant-peddler-method": ["stallholder", "itinerant-trader"],
      "merchant-caravan-factor-method": ["route-factor", "cargo-steward"],
      "merchant-guild-broker-method": ["contract-broker", "supply-agent"],
      "merchant-credit-steward-method": ["ledger-banker", "risk-underwriter"],
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
    expect(branches.flatMap((entry) => entry.options).flatMap((option) => option.grants)
      .some((grant) => grant.type === "ability")).toBe(false);
  });

  it("gates practice, method, and mastery choices in sequence", () => {
    expect(pendingProfessionChoices({ professionId: "merchant", levels: 10, branchChoices: {} })
      .map((entry) => entry.id)).toEqual(["merchant-practice"]);
    expect(pendingProfessionChoices({ professionId: "merchant", levels: 30, branchChoices: {
      "merchant-practice": "credit-steward",
    } }).map((entry) => entry.id)).toEqual(["merchant-credit-steward-method"]);
    expect(pendingProfessionChoices({ professionId: "merchant", levels: 50, branchChoices: {
      "merchant-practice": "credit-steward",
      "merchant-credit-steward-method": "risk-underwriter",
    } }).map((entry) => entry.id)).toEqual(["merchant-risk-underwriter-mastery"]);
  });

  it("surfaces exact trade identities as specializations of broad Merchant", () => {
    expect(PROFESSIONS.merchant).toMatchObject({ id: "merchant", name: "Merchant", role: "Trade" });
    expect(PROFESSIONS.merchant.specializations.map((entry) => entry.id)).toEqual([
      "peddler", "caravan-factor", "guild-broker", "credit-steward",
    ]);
    expect(PROFESSION_ALIASES).toMatchObject({
      peddler: "merchant", "caravan-factor": "merchant", "guild-broker": "merchant", "credit-steward": "merchant",
    });
  });
});
