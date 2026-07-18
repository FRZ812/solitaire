import { describe, expect, it } from "vitest";
import {
  ABILITY_CATALOG,
  ABILITY_LIBRARY,
  abilityCategoryOf,
  abilityStatLine,
  getAbilityDef,
} from "../data/abilities.js";
import {
  ABILITY_CATEGORIES,
  abilityCategoryIdOf,
  abilityTaxonomy,
  magicSchoolIdOf,
} from "../data/ability-taxonomy.js";
import { cardDefinition } from "../data/combat-cards.js";

const GENERAL_IDS = Object.freeze([
  "artificer-snapfire-capsule", "artificer-field-refit", "artificer-guard-projector", "artificer-tangle-line",
  "artificer-arc-node", "artificer-countermeasure", "artificer-relay-bolt", "artificer-repeating-engine",
  "artificer-adaptive-plating", "artificer-collapse-charge", "artificer-masterwork-array", "artificer-grand-invention",
]);

const BRANCH_IDS = Object.freeze([
  "artificer-inscribed-ward", "artificer-flash-phial", "artificer-clockwork-sentinel", "artificer-deployable-barricade",
  "artificer-layered-seal", "artificer-runic-edge", "artificer-restorative-aerosol", "artificer-fracture-compound",
  "artificer-interception-automaton", "artificer-overclock-servo", "artificer-shaped-demolition", "artificer-bulwark-frame",
]);

const ALL_IDS = Object.freeze([...GENERAL_IDS, ...BRANCH_IDS]);

const COST_BY_ID = Object.freeze({
  "artificer-snapfire-capsule": 1,
  "artificer-field-refit": 0,
  "artificer-guard-projector": 1,
  "artificer-tangle-line": 1,
  "artificer-arc-node": 1,
  "artificer-countermeasure": 1,
  "artificer-relay-bolt": 2,
  "artificer-repeating-engine": 2,
  "artificer-adaptive-plating": 2,
  "artificer-collapse-charge": 3,
  "artificer-masterwork-array": 4,
  "artificer-grand-invention": 5,
  "artificer-inscribed-ward": 1,
  "artificer-flash-phial": 1,
  "artificer-clockwork-sentinel": 1,
  "artificer-deployable-barricade": 1,
  "artificer-layered-seal": 2,
  "artificer-runic-edge": 2,
  "artificer-restorative-aerosol": 2,
  "artificer-fracture-compound": 2,
  "artificer-interception-automaton": 2,
  "artificer-overclock-servo": 2,
  "artificer-shaped-demolition": 2,
  "artificer-bulwark-frame": 2,
});

describe("Artificer devicecraft independence", () => {
  it("defines exactly twelve general and twelve specialization-owned native devices", () => {
    const definitions = ABILITY_LIBRARY.filter(({ id }) => id.startsWith("artificer-"));
    expect(definitions.map(({ id }) => id)).toEqual(ALL_IDS);
    expect(new Set(definitions.map(({ id }) => id)).size).toBe(24);
    expect(GENERAL_IDS.every((id) => !getAbilityDef(id).branchExclusive)).toBe(true);
    expect(BRANCH_IDS.every((id) => getAbilityDef(id).branchExclusive === true)).toBe(true);
    expect(ABILITY_CATALOG.filter(({ id }) => ALL_IDS.includes(id)).map(({ id }) => id)).toEqual(ALL_IDS);
  });

  it("classifies every native device as first-class non-spell Devicecraft", () => {
    expect(ABILITY_CATEGORIES.devicecraft).toMatchObject({ id: "devicecraft", label: "Devicecraft", mark: "T" });
    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      expect(definition, id).toMatchObject({
        professionId: "artificer",
        progressionExclusive: true,
        school: "devicecraft",
        artificerDeviceChargeMax: 5,
        resolveCost: 0,
      });
      expect(definition.innate, id).toBeFalsy();
      expect(definition.magicSchool, id).toBeUndefined();
      expect(abilityCategoryOf(definition), id).toBe("devicecraft");
      expect(abilityCategoryIdOf(definition), id).toBe("devicecraft");
      expect(magicSchoolIdOf(definition), id).toBeNull();
      expect(abilityTaxonomy(definition), id).toMatchObject({
        categoryId: "devicecraft",
        category: ABILITY_CATEGORIES.devicecraft,
        magicSchoolId: null,
        magicSchool: null,
        iconKey: "category:devicecraft",
      });
      expect(cardDefinition(id, definition.minTier || "common"), id).toMatchObject({
        category: "devicecraft",
        categoryLabel: "Devicecraft",
        magicSchool: null,
        tradition: "devicecraft",
        resolveCost: 0,
      });
    }
  });

  it("commits each authored Charge cost exactly once and bounds Field Refit", () => {
    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      const cost = COST_BY_ID[id];
      expect(definition.artificerChargeCost || 0, id).toBe(cost);
      expect(definition.artificerChargeCommitSpend || false, id).toBe(cost > 0);
      const line = abilityStatLine(definition, definition.minTier || "common");
      if (cost > 0) expect(line, id).toContain(`cost ${cost} Device Charge${cost === 1 ? "" : "s"} (committed once)`);
    }
    expect(getAbilityDef("artificer-field-refit")).toMatchObject({
      artificerRefit: true,
      effect: { type: "artificerFieldRefit", restoreCharges: 2, chargeCap: 5 },
    });
    expect(abilityStatLine(getAbilityDef("artificer-field-refit"), "common"))
      .toContain("restores 2 Device Charges (cap 5)");
    expect(getAbilityDef("artificer-repeating-engine")).toMatchObject({ hits: 3, artificerChargeCost: 2 });
  });

  it("keeps every damaging device armour- or ward-respecting with no spell scaling", () => {
    const damaging = ALL_IDS.map(getAbilityDef).filter((definition) => definition.dmg);
    expect(damaging.length).toBeGreaterThan(0);
    for (const definition of damaging) {
      expect(definition.scaling, definition.id).toBe("fieldcraft");
      expect(["physical", "magical"], definition.id).toContain(definition.damageType);
      expect(definition.damageType, definition.id).not.toBe("true");
      expect(definition, definition.id).not.toHaveProperty("ignoreArmor");
      expect(definition, definition.id).not.toHaveProperty("ignoreWard");
      expect(definition, definition.id).not.toHaveProperty("trueDamage");
    }
  });

  it("keeps each workshop inside fabricated physical constraints", () => {
    expect(getAbilityDef("artificer-layered-seal")).toMatchObject({
      effect: { type: "artificerLayeredSeal", ward: 12, pressureResistance: 15 },
    });
    expect(getAbilityDef("artificer-restorative-aerosol")).toMatchObject({
      effect: { type: "artificerRestorativeAerosol", removeHarmfulStatuses: 1 },
      damageType: null,
    });
    expect(getAbilityDef("artificer-restorative-aerosol").effect).not.toHaveProperty("heal");
    expect(getAbilityDef("artificer-interception-automaton")).toMatchObject({
      effect: { type: "artificerInterceptionAutomaton", share: 0.20, cap: 0.08 },
    });
    expect(getAbilityDef("artificer-overclock-servo").effect).not.toHaveProperty("bonusAction");
    expect(getAbilityDef("artificer-shaped-demolition")).toMatchObject({
      damageType: "physical",
      effect: { type: "artificerShapedDemolition", bossScale: 0.35 },
    });
  });

  it("never borrows foreign resources, spell identities, or autonomous creature shortcuts", () => {
    const foreignMetadata = /^(?:warrior|monk|barbarian|bard|ranger|rogue|sorcerer|wizard|cleric|paladin|druid|warlock)/i;
    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      expect(Object.keys(definition).filter((key) => foreignMetadata.test(key)), id).toEqual([]);
      const mechanical = { ...definition, desc: undefined };
      expect(JSON.stringify(mechanical), id).not.toMatch(/summon|independentTurn|autonomousCreature|instantKill|trueDamage/i);
      expect(definition, id).not.toHaveProperty("metamagic");
      expect(definition, id).not.toHaveProperty("signatureSpell");
      expect(definition, id).not.toHaveProperty("channelDivinity");
      expect(definition, id).not.toHaveProperty("druidSeason");
      expect(definition, id).not.toHaveProperty("warlockFavorCost");
      expect(definition.resolveCost, id).toBe(0);
    }
  });
});
