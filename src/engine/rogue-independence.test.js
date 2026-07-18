import { describe, expect, it } from "vitest";
import {
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
  "rogue-assess-mark",
  "rogue-testing-cut",
  "rogue-slip-the-line",
  "rogue-false-opening",
  "rogue-exploit-guard",
  "rogue-sap-blow",
  "rogue-concealed-shift",
  "rogue-hamstring",
  "rogue-switchback-feint",
  "rogue-kidney-shot",
  "rogue-finishing-angle",
  "rogue-perfect-opportunity",
]);

const BRANCH_IDS = Object.freeze([
  "rogue-silent-entry",
  "rogue-brazen-feint",
  "rogue-killing-measure",
  "rogue-fault-finder",
  "rogue-high-window",
  "rogue-crowd-ghost",
  "rogue-confidence-play",
  "rogue-dirty-trick",
  "rogue-first-strike",
  "rogue-venom-work",
  "rogue-master-key",
  "rogue-planned-collapse",
]);

const ALL_IDS = Object.freeze([...GENERAL_IDS, ...BRANCH_IDS]);

const BUILDER_IDS = Object.freeze([
  "rogue-assess-mark",
  "rogue-testing-cut",
  "rogue-false-opening",
  "rogue-concealed-shift",
  "rogue-switchback-feint",
  "rogue-silent-entry",
  "rogue-brazen-feint",
  "rogue-killing-measure",
  "rogue-fault-finder",
]);

const EXPLOIT_IDS = Object.freeze([
  "rogue-exploit-guard",
  "rogue-sap-blow",
  "rogue-hamstring",
  "rogue-kidney-shot",
  "rogue-finishing-angle",
  "rogue-perfect-opportunity",
  "rogue-high-window",
  "rogue-crowd-ghost",
  "rogue-confidence-play",
  "rogue-dirty-trick",
  "rogue-first-strike",
  "rogue-venom-work",
  "rogue-master-key",
  "rogue-planned-collapse",
]);

const DAMAGE_IDS = Object.freeze([
  "rogue-testing-cut",
  "rogue-exploit-guard",
  "rogue-sap-blow",
  "rogue-hamstring",
  "rogue-kidney-shot",
  "rogue-finishing-angle",
  "rogue-perfect-opportunity",
  "rogue-high-window",
  "rogue-crowd-ghost",
  "rogue-dirty-trick",
  "rogue-first-strike",
  "rogue-venom-work",
]);

const TARGET_EFFECT_BY_ID = Object.freeze({
  "rogue-assess-mark": ["enemy", "rogueAssessMark"],
  "rogue-testing-cut": ["enemy", null],
  "rogue-slip-the-line": ["self", "rogueSlipLine"],
  "rogue-false-opening": ["enemy", "rogueFalseOpening"],
  "rogue-exploit-guard": ["enemy", "rogueExploitGuard"],
  "rogue-sap-blow": ["enemy", "rogueSapBlow"],
  "rogue-concealed-shift": ["enemy", "rogueConcealedShift"],
  "rogue-hamstring": ["enemy", "rogueHamstring"],
  "rogue-switchback-feint": ["enemy", "rogueSwitchbackFeint"],
  "rogue-kidney-shot": ["enemy", "rogueKidneyShot"],
  "rogue-finishing-angle": ["enemy", "rogueFinishingAngle"],
  "rogue-perfect-opportunity": ["enemy", null],
  "rogue-silent-entry": ["enemy", "rogueSilentEntry"],
  "rogue-brazen-feint": ["enemy", "rogueBrazenFeint"],
  "rogue-killing-measure": ["enemy", "rogueKillingMeasure"],
  "rogue-fault-finder": ["enemy", "rogueFaultFinder"],
  "rogue-high-window": ["enemy", "rogueHighWindow"],
  "rogue-crowd-ghost": ["enemy", null],
  "rogue-confidence-play": ["enemy", "rogueConfidencePlay"],
  "rogue-dirty-trick": ["enemy", "rogueDirtyTrick"],
  "rogue-first-strike": ["enemy", "rogueFirstStrike"],
  "rogue-venom-work": ["enemy", "rogueVenomWork"],
  "rogue-master-key": ["enemy", "rogueMasterKey"],
  "rogue-planned-collapse": ["enemy", "roguePlannedCollapse"],
});

describe("Rogue subterfuge independence", () => {
  it("defines exactly twelve general and twelve specialization-owned native cards", () => {
    const definitions = ABILITY_LIBRARY.filter(({ id }) => id.startsWith("rogue-"));
    expect(definitions.map(({ id }) => id)).toEqual(ALL_IDS);
    expect(new Set(definitions.map(({ id }) => id)).size).toBe(24);
    expect(GENERAL_IDS.every((id) => !getAbilityDef(id).branchExclusive)).toBe(true);
    expect(BRANCH_IDS.every((id) => getAbilityDef(id).branchExclusive === true)).toBe(true);
  });

  it("classifies every native card as subterfuge, never spell, magic, martial, or another profession category", () => {
    expect(ABILITY_CATEGORIES.subterfuge).toMatchObject({ id: "subterfuge", label: "Subterfuge" });
    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      expect(definition, id).toMatchObject({
        professionId: "rogue",
        progressionExclusive: true,
        school: "subterfuge",
        resolveCost: 0,
      });
      expect(definition.innate, id).toBeFalsy();
      expect(definition.magicSchool, id).toBeUndefined();
      expect(abilityCategoryOf(definition), id).toBe("subterfuge");
      expect(abilityCategoryIdOf(definition), id).toBe("subterfuge");
      expect(magicSchoolIdOf(definition), id).toBeNull();
      expect(abilityTaxonomy(definition), id).toMatchObject({
        categoryId: "subterfuge",
        category: ABILITY_CATEGORIES.subterfuge,
        magicSchoolId: null,
        magicSchool: null,
        iconKey: "category:subterfuge",
      });
    }
  });

  it("uses only armour-respecting weapon damage or non-damaging subterfuge", () => {
    const foreignMetadata = /^(?:warrior|monk|barbarian|bard|ranger|sorcerer|wizard|cleric|paladin|artificer|druid)/i;
    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      expect(Object.keys(definition).filter((key) => foreignMetadata.test(key)), id).toEqual([]);
      expect([null, "physical"], id).toContain(definition.damageType);
      if (DAMAGE_IDS.includes(id)) {
        expect(definition, id).toMatchObject({ damageType: "physical", scaling: "weapon", dmg: null });
        expect(definition.weaponReq?.length, id).toBeGreaterThan(0);
        expect(definition.damageMult, id).toBeGreaterThan(0);
      } else {
        expect(definition, id).toMatchObject({ damageType: null, scaling: "none", dmg: null });
      }
      expect(definition).not.toHaveProperty("ignoreArmor");
      expect(definition).not.toHaveProperty("metamagic");
      expect(definition.effect?.type || "", id).not.toMatch(/spell|magic|charm|compuls|invis|instantKill/i);
    }
  });

  it("locks the exact source-specific two-turn Opportunity Window builder and exploit map", () => {
    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      const builder = BUILDER_IDS.includes(id);
      const exploit = EXPLOIT_IDS.includes(id);
      expect(Boolean(definition.rogueOpeningBuild), id).toBe(builder);
      expect(Boolean(definition.rogueOpeningExploit), id).toBe(exploit);
      expect(Boolean(definition.rogueRequiresOpening), id).toBe(exploit);
      expect(definition.rogueOpeningDuration, id).toBe(builder ? 2 : undefined);
      expect(builder && exploit, id).toBe(false);

      const line = abilityStatLine(definition, definition.minTier || "common");
      expect(line, id).not.toContain("resolve");
      if (builder) expect(line, id).toContain("creates your 2t Opportunity Window on target after successful");
      if (exploit) expect(line, id).toContain("exploits and consumes your Opportunity Window once");
    }
    expect(getAbilityDef("rogue-slip-the-line").rogueOpeningBuild).toBeUndefined();
    expect(getAbilityDef("rogue-slip-the-line").rogueOpeningExploit).toBeUndefined();
  });

  it("keeps every hostile action single-target and the sole neutral action self-targeted", () => {
    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      expect(definition.target, id).toBe(id === "rogue-slip-the-line" ? "self" : "enemy");
      expect([definition.target, definition.effect?.type || null], id).toEqual(TARGET_EFFECT_BY_ID[id]);
    }
    expect(getAbilityDef("rogue-perfect-opportunity").hits).toBe(3);
    expect(EXPLOIT_IDS.filter((id) => (getAbilityDef(id).hits || 1) > 1)).toEqual(["rogue-perfect-opportunity"]);
    expect(getAbilityDef("rogue-crowd-ghost").selfEffect?.type).toBe("rogueCrowdGhost");
  });

  it("keeps semantic pressure soft and physical concealment honest", () => {
    const semanticIds = ALL_IDS.filter((id) => getAbilityDef(id).audible || getAbilityDef(id).requiresUnderstanding);
    expect(semanticIds).toEqual(["rogue-brazen-feint", "rogue-confidence-play"]);
    for (const id of semanticIds) {
      const definition = getAbilityDef(id);
      expect(definition).toMatchObject({ audible: true, requiresAwareness: true, requiresUnderstanding: true });
      expect(definition.effect).toHaveProperty("attention");
      expect(definition.effect).toHaveProperty("morale");
      expect(definition.effect).not.toHaveProperty("charm");
      expect(definition.effect).not.toHaveProperty("compulsion");
      expect(abilityReqLine(definition), id).toContain("target must understand");
    }

    expect(getAbilityDef("rogue-concealed-shift").requiresCover).toBe(true);
    expect(getAbilityDef("rogue-silent-entry").requiresCover).toBe(true);
    expect(getAbilityDef("rogue-crowd-ghost").requiresCrowdOrCover).toBe(true);
    for (const id of ["rogue-concealed-shift", "rogue-silent-entry", "rogue-crowd-ghost"]) {
      const definition = getAbilityDef(id);
      expect(definition.effect?.type || definition.selfEffect?.type, id).not.toMatch(/invis/i);
      expect(definition).not.toHaveProperty("invisible");
    }
  });

  it("requires real toxins, equipment faults, and assessed ordinary structure", () => {
    const venom = getAbilityDef("rogue-venom-work");
    expect(venom).toMatchObject({
      roguePhysicalToxin: true,
      requiresCarriedPhysicalToxin: true,
      effect: { type: "rogueVenomWork", lethal: false, maxStacks: 2 },
    });
    expect(venom.effect.type).not.toMatch(/instant/i);
    expect(abilityReqLine(venom)).toContain("needs a carried mundane toxin");

    const masterKey = getAbilityDef("rogue-master-key");
    expect(masterKey).toMatchObject({ requiresAccessibleEquipment: true, effect: { type: "rogueMasterKey" } });
    expect(abilityReqLine(masterKey)).toContain("needs accessible equipment or access point");
    expect(abilityReqLine(masterKey)).toContain("needs lockpicks or suitable hand tools");

    const collapse = getAbilityDef("rogue-planned-collapse");
    expect(collapse).toMatchObject({
      requiresAssessedStructure: true,
      terrainReq: "assessed ordinary structure or footing",
      effect: { type: "roguePlannedCollapse", bossScale: 0.35, terrainDestruction: false },
    });
    expect(collapse.effect).not.toHaveProperty("construction");
    expect(abilityReqLine(collapse)).toContain("structure or footing must be previously assessed");
  });
});
