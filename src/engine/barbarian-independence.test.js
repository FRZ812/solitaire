import { describe, expect, it } from "vitest";
import { ABILITY_LIBRARY, abilityCategoryOf, getAbilityDef } from "../data/abilities.js";
import { magicSchoolIdOf } from "../data/ability-taxonomy.js";
import { professionBranchChoices } from "../data/profession-branches.js";
import { PROFESSION_PROFILES } from "../data/profession-progressions.js";
import { RACIAL_BRANCHES } from "../data/racial-branches.js";
import { RACIAL_PROFILES } from "../data/racial-progressions.js";
import {
  compileProfessionTrack,
  professionContentStatus,
} from "../data/progression-paths.js";
import { progressionCombatEntitlements } from "./progression-abilities.js";

const GENERAL_IDS = Object.freeze([...PROFESSION_PROFILES.barbarian.abilities]);
const BARBARIAN_CHOICES = Object.freeze([...professionBranchChoices("barbarian")]);
const BRANCH_IDS = Object.freeze([...new Set(
  BARBARIAN_CHOICES
    .flatMap((choice) => choice.options)
    .flatMap((option) => option.grants || [])
    .filter((grant) => grant.type === "ability")
    .map((grant) => grant.id),
)]);
const ALL_IDS = Object.freeze([...GENERAL_IDS, ...BRANCH_IDS]);

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

const abilityGrantIds = (choices) => choices
  .flatMap((choice) => choice.options)
  .flatMap((option) => option.grants || [])
  .filter((grant) => grant.type === "ability")
  .map((grant) => grant.id);

function nestedKeys(value) {
  if (Array.isArray(value)) return value.flatMap(nestedKeys);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, nested]) => [key, ...nestedKeys(nested)]);
}

describe("Barbarian profession independence", () => {
  it("authors seventy distinct levels and an exact 4 -> 8 -> 16 branch tree", () => {
    const compiled = compileProfessionTrack("barbarian");
    expect(professionContentStatus("barbarian")).toBe("complete");
    expect(compiled.levels).toHaveLength(70);
    expect(compiled.levels.every((level) => level.authoredContent)).toBe(true);
    expect(new Set(compiled.levels.map((level) => level.feature)).size).toBe(70);

    const root = BARBARIAN_CHOICES.filter((choice) => choice.threshold === 10);
    const methods = BARBARIAN_CHOICES.filter((choice) => choice.threshold === 30);
    const apexes = BARBARIAN_CHOICES.filter((choice) => choice.threshold === 50);
    expect(BARBARIAN_CHOICES).toHaveLength(13);
    expect(root).toHaveLength(1);
    expect(root[0].options.map((option) => option.name)).toEqual([
      "Reaver",
      "Berserker",
      "Juggernaut",
      "Clan Champion",
    ]);
    expect(methods).toHaveLength(4);
    expect(methods.flatMap((choice) => choice.options)).toHaveLength(8);
    expect(apexes).toHaveLength(8);
    expect(apexes.flatMap((choice) => choice.options)).toHaveLength(16);

    expect(new Set(methods.map((choice) => choice.parentChoiceId))).toEqual(new Set([root[0].id]));
    expect(new Set(methods.map((choice) => choice.parentOptionId)))
      .toEqual(new Set(root[0].options.map((option) => option.id)));
    for (const method of methods) {
      for (const option of method.options) {
        expect(apexes.filter((choice) => (
          choice.parentChoiceId === method.id && choice.parentOptionId === option.id
        )), `${method.id}:${option.id}`).toHaveLength(1);
      }
    }
  });

  it("owns exactly 24 physical martial cards and a closed five-point Fury economy", () => {
    expect(GENERAL_IDS).toHaveLength(12);
    expect(BRANCH_IDS).toHaveLength(12);
    expect(new Set(ALL_IDS).size).toBe(24);
    expect(ABILITY_LIBRARY.filter((ability) => ability.id.startsWith("barbarian-")).map((ability) => ability.id).sort())
      .toEqual([...ALL_IDS].sort());

    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      expect(definition, id).toMatchObject({
        professionId: "barbarian",
        progressionExclusive: true,
        school: "martial",
        armorReq: ["none", "light", "heavy"],
      });
      expect(definition.innate, id).not.toBe(true);
      expect(abilityCategoryOf(definition), id).toBe("martial");
      expect(magicSchoolIdOf(definition), id).toBeNull();
      expect([null, "physical"], id).toContain(definition.damageType);
      expect(definition.damageType, id).not.toBe("true");
      expect([
        definition.effect?.type,
        definition.selfEffect?.type,
      ].filter(Boolean).join(" "), id).not.toMatch(/teleport|invisib|ethereal|incorporeal|phase|arcane|divine|primal|pact|spell/i);
      expect(nestedKeys({
        fields: Object.fromEntries(Object.entries(definition).filter(([key]) => !["name", "desc"].includes(key))),
      }).filter((key) => /warrior|tempo|monk|posture/i.test(key)), id).toEqual([]);

      if (definition.scaling === "weapon") {
        expect(definition.weaponReq, id).toEqual(["axe", "mace", "sword", "spear", "unarmed"]);
      } else {
        expect(definition.weaponReq, id).toBeNull();
      }
    }

    expect(GENERAL_IDS.every((id) => !getAbilityDef(id).branchExclusive)).toBe(true);
    expect(BRANCH_IDS.every((id) => getAbilityDef(id).branchExclusive)).toBe(true);
    expect(ALL_IDS.filter((id) => getAbilityDef(id).barbarianFuryBuild)).toEqual(["barbarian-bait-the-blow"]);
    expect(getAbilityDef("barbarian-bait-the-blow")).toMatchObject({
      target: "self",
      barbarianFuryBuild: 1,
      effect: { type: "barbarianBaitBlow", fury: 1 },
    });
    expect(getAbilityDef("barbarian-bait-the-blow").effect.exposure).toBeGreaterThan(0);
    expect(ALL_IDS.filter((id) => id !== "barbarian-brutal-swing" && id !== "barbarian-bait-the-blow")
      .every((id) => Number.isInteger(getAbilityDef(id).barbarianFuryCost)
        && getAbilityDef(id).barbarianFuryCost >= 1
        && getAbilityDef(id).barbarianFuryCost <= 5)).toBe(true);

    expect(BARBARIAN_CHOICES
      .flatMap((choice) => choice.options)
      .flatMap((option) => option.grants || [])
      .every((grant) => grant.id.startsWith("barbarian-") || grant.id.startsWith("barbarian:"))).toBe(true);

    const foreignProfessionIds = new Set(Object.entries(PROFESSION_PROFILES)
      .filter(([professionId]) => professionId !== "barbarian")
      .flatMap(([professionId, profile]) => [
        ...(profile.abilities || []),
        ...abilityGrantIds(professionBranchChoices(professionId)),
      ]));
    const racialIds = new Set([
      ...Object.values(RACIAL_PROFILES).flatMap((profile) => profile.abilities || []),
      ...Object.values(RACIAL_BRANCHES).flatMap(abilityGrantIds),
    ]);
    expect(ALL_IDS.filter((id) => foreignProfessionIds.has(id) || racialIds.has(id))).toEqual([]);
  });

  it("rejects injected cards while honoring real multiclass and branch entitlements", () => {
    const injected = character(
      [track("cleric", 4)],
      ALL_IDS.map((id) => ({ id, tier: "divine" })),
    );
    expect(entitledIds(injected)).not.toEqual(expect.arrayContaining(ALL_IDS));

    const multiclass = character([track("cleric", 4), track("barbarian", 6)]);
    expect(entitledIds(multiclass)).toEqual(expect.arrayContaining([
      "heal",
      "barbarian-brutal-swing",
      "barbarian-bait-the-blow",
    ]));
    expect(entitledIds(multiclass)).not.toContain("barbarian-fury-hewn-strike");

    const unchosenBranch = character(
      [track("barbarian", 10)],
      [{ id: "barbarian-reaver-sweep", tier: "divine" }],
    );
    expect(entitledIds(unchosenBranch)).not.toContain("barbarian-reaver-sweep");

    const chosenBranch = character([track("barbarian", 10, { "barbarian-fury-path": "reaver" })]);
    expect(entitledIds(chosenBranch)).toContain("barbarian-reaver-sweep");
    expect(entitledIds(chosenBranch)).not.toContain("barbarian-berserker-abandon");
  });
});
