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

describe("focused Innkeeper progression", () => {
  it("authors 70 unique non-combat hospitality levels", () => {
    const innkeeper = compileProfessionTrack("innkeeper");
    expect(innkeeper.levels).toHaveLength(70);
    expect(new Set(innkeeper.levels.map((entry) => entry.feature)).size).toBe(70);
    expect(innkeeper.levels.every((entry) => entry.authoredContent && entry.featureDescription)).toBe(true);
    expect(innkeeper.levels.every((entry) => entry.generalGrants.some((grant) => grant.noncombatBenefit === true))).toBe(true);
    expect(innkeeper.levels.flatMap((entry) => entry.grants).some((grant) => grant.type === "ability")).toBe(false);
    expect(innkeeper.levels[0].feature).toBe("Open the House");
    expect(innkeeper.levels[69].feature).toBe("Great House");
    expect(PROFESSION_PROFILES.innkeeper).toMatchObject({
      name: "Innkeeper",
      domain: "hospitality",
      abilities: [],
    });
    expect(professionContentStatus("innkeeper")).toBe("complete");
  });

  it("gives four callings two L30 methods and every method two L50 masteries", () => {
    const branches = professionBranchChoices("innkeeper");
    const root = branches.find((entry) => entry.id === "innkeeper-calling");
    expect(root.options.map((option) => option.id)).toEqual([
      "hearthkeeper", "publican", "provisioner", "wayhouse-broker",
    ]);
    expect(branches).toHaveLength(13);
    expect(branches.reduce((sum, entry) => sum + entry.options.length, 0)).toBe(28);
    expect(branches.filter((entry) => entry.threshold === 10)).toHaveLength(1);
    expect(branches.filter((entry) => entry.threshold === 30)).toHaveLength(4);
    expect(branches.filter((entry) => entry.threshold === 50)).toHaveLength(8);
    expect(Object.fromEntries(branches.filter((entry) => entry.threshold === 30)
      .map((entry) => [entry.id, entry.options.map((option) => option.id)]))).toEqual({
      "innkeeper-hearthkeeper-method": ["sanctuary-warden", "resthouse-steward"],
      "innkeeper-publican-method": ["taproom-host", "community-keeper"],
      "innkeeper-provisioner-method": ["cellar-master", "feast-steward"],
      "innkeeper-wayhouse-broker-method": ["rumour-broker", "caravan-host"],
    });

    for (const calling of root.options) {
      const method = branches.find((entry) => entry.threshold === 30
        && entry.parentChoiceId === root.id && entry.parentOptionId === calling.id);
      expect(method, calling.id).toBeTruthy();
      expect(method.options, calling.id).toHaveLength(2);
      for (const option of method.options) {
        const mastery = branches.find((entry) => entry.threshold === 50
          && entry.parentChoiceId === method.id && entry.parentOptionId === option.id);
        expect(mastery, `${calling.id}/${option.id}`).toBeTruthy();
        expect(mastery.options, `${calling.id}/${option.id}`).toHaveLength(2);
      }
    }

    expect(branches.flatMap((entry) => entry.options)
      .flatMap((option) => option.grants).some((grant) => grant.type === "ability")).toBe(false);
  });

  it("gates its calling, method, and mastery choices in sequence", () => {
    expect(pendingProfessionChoices({ professionId: "innkeeper", levels: 10, branchChoices: {} })
      .map((entry) => entry.id)).toEqual(["innkeeper-calling"]);
    expect(pendingProfessionChoices({ professionId: "innkeeper", levels: 30, branchChoices: {
      "innkeeper-calling": "provisioner",
    } }).map((entry) => entry.id)).toEqual(["innkeeper-provisioner-method"]);
    expect(pendingProfessionChoices({ professionId: "innkeeper", levels: 50, branchChoices: {
      "innkeeper-calling": "provisioner",
      "innkeeper-provisioner-method": "feast-steward",
    } }).map((entry) => entry.id)).toEqual(["innkeeper-feast-steward-mastery"]);
  });

  it("surfaces exact hospitality identities as specializations of broad Innkeeper", () => {
    expect(PROFESSIONS.innkeeper).toMatchObject({ id: "innkeeper", name: "Innkeeper", role: "Hospitality" });
    expect(PROFESSIONS.innkeeper.specializations.map((entry) => entry.id)).toEqual([
      "hearthkeeper", "publican", "provisioner", "wayhouse-broker",
    ]);
    expect(PROFESSION_ALIASES).toMatchObject({
      hearthkeeper: "innkeeper",
      publican: "innkeeper",
      provisioner: "innkeeper",
      "wayhouse-broker": "innkeeper",
    });
  });
});
