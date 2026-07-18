import { describe, expect, it } from "vitest";
import {
  ABILITY_CATALOG,
  ABILITY_LIBRARY,
  abilityCategoryOf,
  abilityReqLine,
  abilityStatLine,
  getAbilityDef,
} from "../data/abilities.js";
import {
  ABILITY_CATEGORIES,
  abilityCategoryIdOf,
  abilityTaxonomy,
  magicSchoolIdOf,
} from "../data/ability-taxonomy.js";

const GENERAL_IDS = Object.freeze([
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

const BRANCH_IDS = Object.freeze([
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

const ALL_IDS = Object.freeze([...GENERAL_IDS, ...BRANCH_IDS]);

const EFFECT_BY_ID = Object.freeze({
  "druid-verdant-spark": "druidVerdantSpark",
  "druid-sunlance": null,
  "druid-leafrot": "druidLeafrot",
  "druid-rimebark": "druidRimebark",
  "druid-saprise": "druidSaprise",
  "druid-sirocco": "druidSirocco",
  "druid-harvest-tide": "druidHarvestTide",
  "druid-frostroot": "druidFrostroot",
  "druid-living-canopy": "druidLivingCanopy",
  "druid-high-summer": "druidHighSummer",
  "druid-return-to-soil": "druidReturnToSoil",
  "druid-great-year": "druidGreatYear",
  "druid-grove-awakening": "druidGroveAwakening",
  "druid-predator-shape": "druidPredatorShape",
  "druid-gale-shear": "druidGaleShear",
  "druid-decay-mark": "druidDecayMark",
  "druid-entangling-thicket": "druidEntanglingThicket",
  "druid-ironbark-rise": "druidIronbarkRise",
  "druid-wolf-aspect": "druidWolfAspect",
  "druid-bear-aspect": "druidBearAspect",
  "druid-stormbolt": "druidStormbolt",
  "druid-sunwheel": "druidSunwheel",
  "druid-moldering-wave": "druidMolderingWave",
  "druid-reclamation-bloom": "druidReclamationBloom",
});

const RESOLVE_BY_ID = Object.freeze({
  "druid-verdant-spark": 3,
  "druid-sunlance": 3,
  "druid-leafrot": 4,
  "druid-rimebark": 4,
  "druid-saprise": 6,
  "druid-sirocco": 6,
  "druid-harvest-tide": 8,
  "druid-frostroot": 8,
  "druid-living-canopy": 10,
  "druid-high-summer": 10,
  "druid-return-to-soil": 15,
  "druid-great-year": 15,
  "druid-grove-awakening": 4,
  "druid-predator-shape": 4,
  "druid-gale-shear": 4,
  "druid-decay-mark": 4,
  "druid-entangling-thicket": 6,
  "druid-ironbark-rise": 6,
  "druid-wolf-aspect": 6,
  "druid-bear-aspect": 6,
  "druid-stormbolt": 6,
  "druid-sunwheel": 6,
  "druid-moldering-wave": 6,
  "druid-reclamation-bloom": 6,
});

const TARGET_BY_ID = Object.freeze({
  "druid-verdant-spark": "enemy",
  "druid-sunlance": "enemy",
  "druid-leafrot": "enemy",
  "druid-rimebark": "self",
  "druid-saprise": "all-allies",
  "druid-sirocco": "all-enemies",
  "druid-harvest-tide": "all-enemies",
  "druid-frostroot": "enemy",
  "druid-living-canopy": "all-allies",
  "druid-high-summer": "all-enemies",
  "druid-return-to-soil": "enemy",
  "druid-great-year": "all-enemies",
  "druid-grove-awakening": "all-enemies",
  "druid-predator-shape": "self",
  "druid-gale-shear": "all-enemies",
  "druid-decay-mark": "enemy",
  "druid-entangling-thicket": "all-enemies",
  "druid-ironbark-rise": "all-allies",
  "druid-wolf-aspect": "self",
  "druid-bear-aspect": "self",
  "druid-stormbolt": "enemy",
  "druid-sunwheel": "all-enemies",
  "druid-moldering-wave": "all-enemies",
  "druid-reclamation-bloom": "all-allies",
});

describe("Druid primalcraft independence", () => {
  it("defines exactly twelve general and twelve specialization-owned native cards", () => {
    const definitions = ABILITY_LIBRARY.filter(({ id }) => id.startsWith("druid-"));
    expect(definitions.map(({ id }) => id)).toEqual(ALL_IDS);
    expect(new Set(definitions.map(({ id }) => id)).size).toBe(24);
    expect(GENERAL_IDS.every((id) => !getAbilityDef(id).branchExclusive)).toBe(true);
    expect(BRANCH_IDS.every((id) => getAbilityDef(id).branchExclusive === true)).toBe(true);
    expect(ABILITY_CATALOG.filter(({ id }) => ALL_IDS.includes(id)).map(({ id }) => id)).toEqual(ALL_IDS);
  });

  it("classifies every native card as first-class primal spellcraft, never an arcane or divine school", () => {
    expect(ABILITY_CATEGORIES.primalcraft).toMatchObject({ id: "primalcraft", label: "Primalcraft", mark: "D" });
    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      expect(definition, id).toMatchObject({
        professionId: "druid",
        progressionExclusive: true,
        school: "primalcraft",
      });
      expect(definition.resolveCost, id).toBe(RESOLVE_BY_ID[id]);
      expect(definition.resolveCost, id).toBeGreaterThan(0);
      expect(definition.innate, id).toBeFalsy();
      expect(definition.magicSchool, id).toBeUndefined();
      expect(abilityCategoryOf(definition), id).toBe("primalcraft");
      expect(abilityCategoryIdOf(definition), id).toBe("primalcraft");
      expect(magicSchoolIdOf(definition), id).toBeNull();
      expect(abilityTaxonomy(definition), id).toMatchObject({
        categoryId: "primalcraft",
        category: ABILITY_CATEGORIES.primalcraft,
        magicSchoolId: null,
        magicSchool: null,
        iconKey: "category:primalcraft",
      });
      expect(definition.school, id).not.toMatch(/arcane|divine|pact|shadow|oathcraft/i);
      expect(abilityStatLine(definition, definition.minTier || "common"), id).toContain(`${definition.resolveCost} resolve`);
    }
  });

  it("authors a balanced four-season atlas with one bounded universal surge contract", () => {
    const seasonCounts = { spring: 0, summer: 0, autumn: 0, winter: 0 };
    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      expect(Object.keys(seasonCounts), id).toContain(definition.druidSeason);
      seasonCounts[definition.druidSeason] += 1;
      expect(definition.druidSeasonSurge, id).toEqual({
        bonus: 0.20,
        cap: 0.25,
        appliesTo: expect.stringMatching(/^(?:damage|effect|damage-and-effect)$/),
      });
      expect(definition.druidSeasonSurge.bonus, id).toBeLessThanOrEqual(definition.druidSeasonSurge.cap);
      expect(abilityStatLine(definition, definition.minTier || "common"), id)
        .toContain(`${definition.druidSeason} season · matching surge +20%`);
    }
    expect(seasonCounts).toEqual({ spring: 6, summer: 6, autumn: 6, winter: 6 });
  });

  it("locks native targets, effect identities, magical ward interaction, and one real multihit action", () => {
    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      expect(definition.target, id).toBe(TARGET_BY_ID[id]);
      expect(definition.effect?.type || null, id).toBe(EFFECT_BY_ID[id]);
      if (definition.effect) expect(definition.effect.type, id).toMatch(/^druid[A-Z]/);
      if (definition.dmg) {
        expect(definition, id).toMatchObject({ damageType: "magical", scaling: "stat" });
        expect(definition.druidSeasonSurge.appliesTo, id).toMatch(/damage/);
      } else {
        expect(definition, id).toMatchObject({ damageType: null, scaling: "none", dmg: null });
        expect(definition.druidSeasonSurge.appliesTo, id).toBe("effect");
      }
      expect(definition, id).not.toHaveProperty("ignoreWard");
      expect(definition, id).not.toHaveProperty("trueDamage");
    }
    expect(ALL_IDS.filter((id) => (getAbilityDef(id).hits || 1) > 1)).toEqual(["druid-sunwheel"]);
    expect(getAbilityDef("druid-sunwheel").hits).toBe(2);
  });

  it("keeps Circle of Root bound to growth and terrain rather than conjuration", () => {
    for (const id of ["druid-grove-awakening", "druid-entangling-thicket", "druid-living-canopy"]) {
      const definition = getAbilityDef(id);
      expect(definition.terrainReq, id).toBe("living growth or seed-bearing ground");
      expect(abilityReqLine(definition), id).toContain("needs living growth or seed-bearing ground");
      expect(definition.effect, id).not.toHaveProperty("summon");
      expect(definition.effect?.type, id).not.toMatch(/summon|conjure|createCreature/i);
    }
    expect(getAbilityDef("druid-grove-awakening").effect).toMatchObject({ terrainGrowth: true, rootPressure: 18 });
    expect(getAbilityDef("druid-entangling-thicket").effect).toMatchObject({ terrainGrowth: true, rootPressure: 28 });
    expect(getAbilityDef("druid-living-canopy").effect).toMatchObject({ requiresPresentGrowth: true, cap: 0.10 });
  });

  it("keeps Circle of Fang to self shapeshifts with no summon, pet, or telepathic companion path", () => {
    const fangIds = ["druid-predator-shape", "druid-wolf-aspect", "druid-bear-aspect"];
    for (const id of fangIds) {
      const definition = getAbilityDef(id);
      expect(definition, id).toMatchObject({ target: "self", selfShapeshift: true });
      expect(definition.effect, id).toMatchObject({ target: "self" });
      expect(JSON.stringify({ ...definition, desc: undefined }), id).not.toMatch(/summon|conjure|companion|telepath|pet/i);
      expect(definition.effect?.type, id).toMatch(/^druid(?:PredatorShape|WolfAspect|BearAspect)$/);
    }
  });

  it("keeps Circle of Sky on weather, wind, lightning, and sunlight with honest gates", () => {
    expect(getAbilityDef("druid-gale-shear").effect).toMatchObject({ pushPressure: 15, bossScale: 0.35 });
    expect(getAbilityDef("druid-stormbolt")).toMatchObject({ requiresOpenSkyOrStorm: true, effect: { type: "druidStormbolt" } });
    expect(abilityReqLine(getAbilityDef("druid-stormbolt"))).toContain("needs open sky or an existing storm");
    expect(getAbilityDef("druid-sunwheel")).toMatchObject({ requiresSunlight: true, effect: { type: "druidSunwheel" } });
    expect(abilityReqLine(getAbilityDef("druid-sunwheel"))).toContain("needs real sunlight");
    for (const id of ["druid-gale-shear", "druid-stormbolt", "druid-sunwheel"]) {
      expect(getAbilityDef(id).damageType, id).toBe("magical");
    }
  });

  it("keeps Circle of Cycle on bounded decay and reclamation without necromancy", () => {
    expect(getAbilityDef("druid-decay-mark").effect).toMatchObject({ decayVulnerability: 18, sourceOwned: true });
    expect(getAbilityDef("druid-moldering-wave").effect).toMatchObject({ decay: 4, duration: 3 });
    expect(getAbilityDef("druid-reclamation-bloom")).toMatchObject({
      requiresReclaimableDecay: true,
      effect: { restoreHealth: 5, healthCap: 0.06, restoreResolve: 2, resolveCap: 3 },
    });
    expect(abilityReqLine(getAbilityDef("druid-reclamation-bloom"))).toContain("needs nearby reclaimable decay");
    for (const id of ["druid-decay-mark", "druid-moldering-wave", "druid-reclamation-bloom"]) {
      const definition = getAbilityDef(id);
      expect(definition.magicSchool, id).toBeUndefined();
      expect(definition.school, id).toBe("primalcraft");
      expect(definition.effect?.type, id).not.toMatch(/necro|soul|instantKill/i);
    }
  });

  it("does not borrow another profession's metadata, resource, or effect identity", () => {
    const foreignMetadata = /^(?:warrior|monk|barbarian|bard|ranger|rogue|sorcerer|wizard|cleric|paladin|warlock|artificer)/i;
    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      expect(Object.keys(definition).filter((key) => foreignMetadata.test(key)), id).toEqual([]);
      expect(definition.effect?.type || "", id).not.toMatch(/^(?:warrior|monk|barbarian|bard|ranger|rogue|sorcerer|wizard|cleric|paladin|warlock|artificer)/i);
      expect(definition, id).not.toHaveProperty("metamagic");
      expect(definition, id).not.toHaveProperty("pact");
      expect(definition, id).not.toHaveProperty("channelDivinity");
    }
  });
});
