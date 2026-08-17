import { describe, expect, it } from "vitest";
import {
  progressionAbilityEntries,
  progressionCombatEntitlements,
  progressionNarrativeProjection,
  progressionPassiveEntries,
  signatureMetamagicFor,
} from "./progression-abilities.js";

function contaminatedSorcerer() {
  return {
    race: "human",
    abilities: [
      { id: "firebolt", tier: "rare" },
      { id: "blood-siphon", tier: "rare" },
      { id: "haste", tier: "rare" },
      { id: "gate", tier: "legendary" },
    ],
    metamagic: ["quickened-signature"],
    progression: {
      professions: [{
        professionId: "sorcerer",
        paths: { "stale-sorcerer-track": 20 },
        choices: { signatureSpellId: "firebolt" },
        metamagic: ["quickened-signature"],
      }],
      racial: { raceId: "human", paths: { "stale-human-track": 6 } },
    },
  };
}

describe("Tower runtime progression authority", () => {
  it("projects the existing legacy Sorcerer ledger for non-Tower characters", () => {
    const entitlements = progressionCombatEntitlements(contaminatedSorcerer());

    expect(entitlements.abilities.map(({ id }) => id)).toEqual(expect.arrayContaining([
      "firebolt",
      "blood-siphon",
    ]));
    expect(entitlements.passives).toContainEqual(expect.objectContaining({ id: "adaptable" }));
    expect(entitlements.signatureSpellIds).toEqual(["firebolt"]);
    expect(entitlements.metamagicIds).toContain("quickened-signature");
    expect(entitlements.progressionCapabilities.length).toBeGreaterThan(0);
  });

  it("returns a completely empty combat and narrative projection for a contaminated Tower character", () => {
    const tower = { ...contaminatedSorcerer(), progressionModel: "tow-archetype" };
    const entitlements = progressionCombatEntitlements(tower);

    expect(entitlements).toEqual({
      abilities: [],
      passives: [],
      signatureSpellIds: [],
      metamagicIds: [],
      metamagicByAbilityId: {},
      progressionCapabilities: [],
      branchCapabilities: [],
      progressionAbilityIds: [],
      selectedBranchAbilityIds: [],
    });
    expect(progressionAbilityEntries(tower)).toEqual([]);
    expect(progressionPassiveEntries(tower)).toEqual([]);
    expect(signatureMetamagicFor(tower)).toEqual({
      signatureSpellIds: [],
      metamagicIds: [],
      metamagicByAbilityId: {},
    });
    expect(progressionNarrativeProjection(tower)).toEqual({
      abilities: [],
      metamagicProfiles: [],
      progressionCapabilities: [],
      branchCapabilities: [],
    });
  });

  it("does not reinterpret Tower world Haste or Gate grants as combat abilities", () => {
    const tower = {
      progressionModel: "tow-archetype",
      abilities: [
        { id: "haste", tier: "rare" },
        { id: "gate", tier: "legendary" },
      ],
    };

    expect(progressionCombatEntitlements(tower).abilities).toEqual([]);
  });
});
