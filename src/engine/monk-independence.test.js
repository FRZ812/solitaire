import { describe, expect, it } from "vitest";
import { ABILITY_LIBRARY, abilityCategoryOf, getAbilityDef } from "../data/abilities.js";
import { magicSchoolIdOf } from "../data/ability-taxonomy.js";
import { professionBranchChoices } from "../data/profession-branches.js";
import { PROFESSION_PROFILES } from "../data/profession-progressions.js";
import { progressionCombatEntitlements } from "./progression-abilities.js";

const GENERAL_IDS = Object.freeze([...PROFESSION_PROFILES.monk.abilities]);
const BRANCH_IDS = Object.freeze([...new Set(
  professionBranchChoices("monk")
    .flatMap((choice) => choice.options)
    .flatMap((option) => option.grants || [])
    .filter((grant) => grant.type === "ability")
    .map((grant) => grant.id),
)]);
const ALL_IDS = Object.freeze([...GENERAL_IDS, ...BRANCH_IDS]);
const TEMPLE_ARMS_IDS = new Set([
  "monk-kata-entry",
  "monk-staff-circuit",
  "monk-temple-blade-arc",
]);

const track = (professionId, levels, branchChoices = {}) => ({
  professionId,
  levels,
  branchChoices,
  choices: {},
});

const character = (professions, abilities = []) => ({
  name: "Audit Character",
  race: "human",
  attributes: {},
  abilities,
  progression: { version: 2, professions, racial: null },
});

const entitledIds = (entry) => progressionCombatEntitlements(entry).abilities.map((ability) => ability.id);

describe("Monk profession independence", () => {
  it("owns exactly 24 nonmagical physical cards with one bounded weapon discipline", () => {
    expect(GENERAL_IDS).toHaveLength(12);
    expect(BRANCH_IDS).toHaveLength(12);
    expect(new Set(ALL_IDS).size).toBe(24);
    expect(ABILITY_LIBRARY.filter((ability) => ability.id.startsWith("monk-")).map((ability) => ability.id).sort())
      .toEqual([...ALL_IDS].sort());

    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      expect(definition, id).toMatchObject({
        professionId: "monk",
        progressionExclusive: true,
        school: "martial",
      });
      expect(definition.innate, id).not.toBe(true);
      expect(abilityCategoryOf(definition), id).toBe("martial");
      expect(magicSchoolIdOf(definition), id).toBeNull();
      expect([null, "physical"], id).toContain(definition.damageType);
      expect(definition.damageType, id).not.toBe("true");
      expect(JSON.stringify(definition.effect || {}), id).not.toMatch(/teleport|invisib|ethereal|incorporeal|phase/i);
      expect(Object.keys(definition).some((key) => /warrior|tempo/i.test(key)), id).toBe(false);
    }

    expect(GENERAL_IDS.every((id) => getAbilityDef(id).weaponReq?.length === 1
      && getAbilityDef(id).weaponReq[0] === "unarmed")).toBe(true);
    expect(BRANCH_IDS.filter((id) => !TEMPLE_ARMS_IDS.has(id)).every((id) => (
      getAbilityDef(id).weaponReq?.length === 1 && getAbilityDef(id).weaponReq[0] === "unarmed"
    ))).toBe(true);
    expect(Object.fromEntries([...TEMPLE_ARMS_IDS].map((id) => [id, getAbilityDef(id).weaponReq]))).toEqual({
      "monk-kata-entry": ["staff", "spear", "sword"],
      "monk-staff-circuit": ["staff", "spear"],
      "monk-temple-blade-arc": ["sword"],
    });
    expect(GENERAL_IDS.every((id) => !getAbilityDef(id).branchExclusive)).toBe(true);
    expect(BRANCH_IDS.every((id) => getAbilityDef(id).branchExclusive)).toBe(true);

    const root = professionBranchChoices("monk").find((choice) => !choice.parentChoiceId);
    expect(root.options.filter((option) => option.grants.some((grant) => grant.weaponPermitted)).map((option) => option.id))
      .toEqual(["temple-arms"]);

    const foreignProfileIds = new Set(Object.entries(PROFESSION_PROFILES)
      .filter(([professionId]) => professionId !== "monk")
      .flatMap(([, profile]) => profile.abilities || []));
    const foreignBranchIds = new Set(Object.keys(PROFESSION_PROFILES)
      .filter((professionId) => professionId !== "monk")
      .flatMap((professionId) => professionBranchChoices(professionId))
      .flatMap((choice) => choice.options)
      .flatMap((option) => option.grants || [])
      .filter((grant) => grant.type === "ability")
      .map((grant) => grant.id));
    expect(ALL_IDS.filter((id) => foreignProfileIds.has(id) || foreignBranchIds.has(id))).toEqual([]);
  });

  it("rejects injected Monk cards while honoring earned multiclass and branch entitlements", () => {
    const injected = character(
      [track("cleric", 4)],
      ALL_IDS.map((id) => ({ id, tier: "divine" })),
    );
    expect(entitledIds(injected)).not.toEqual(expect.arrayContaining(ALL_IDS));

    const multiclass = character([track("cleric", 4), track("monk", 6)]);
    expect(entitledIds(multiclass)).toEqual(expect.arrayContaining([
      "heal",
      "monk-measured-palm",
      "monk-three-beat-strike",
    ]));
    expect(entitledIds(multiclass)).not.toContain("monk-yielding-guard");

    const unchosenBranch = character(
      [track("monk", 10)],
      [{ id: "monk-open-hand-parry", tier: "divine" }],
    );
    expect(entitledIds(unchosenBranch)).not.toContain("monk-open-hand-parry");

    const chosenBranch = character([track("monk", 10, { "monk-discipline": "open-hand" })]);
    expect(entitledIds(chosenBranch)).toContain("monk-open-hand-parry");
    expect(entitledIds(chosenBranch)).not.toContain("monk-iron-body-brace");
  });
});
