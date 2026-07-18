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
  "paladin-oathguard",
  "paladin-vowed-strike",
  "paladin-stand-fast",
  "paladin-challenge-of-witness",
  "paladin-bear-the-blow",
  "paladin-steadfast-word",
  "paladin-judgment-stroke",
  "paladin-hold-the-line",
  "paladin-merciful-arrest",
  "paladin-oathfire-edge",
  "paladin-last-witness",
  "paladin-oath-incarnate",
]);

const BRANCH_IDS = Object.freeze([
  "paladin-shield-covenant",
  "paladin-call-to-account",
  "paladin-offer-quarter",
  "paladin-beacon-stance",
  "paladin-rampart-exchange",
  "paladin-threshold-blow",
  "paladin-verdict-edge",
  "paladin-peace-command",
  "paladin-redeeming-intercession",
  "paladin-burden-taken",
  "paladin-sunward-cut",
  "paladin-pilgrim-aegis",
]);

const ALL_IDS = Object.freeze([...GENERAL_IDS, ...BRANCH_IDS]);

const DAMAGE_IDS = Object.freeze([
  "paladin-vowed-strike",
  "paladin-judgment-stroke",
  "paladin-merciful-arrest",
  "paladin-oathfire-edge",
  "paladin-threshold-blow",
  "paladin-verdict-edge",
  "paladin-sunward-cut",
]);

const SPEND_COST_BY_ID = Object.freeze({
  "paladin-bear-the-blow": 1,
  "paladin-judgment-stroke": 2,
  "paladin-hold-the-line": 2,
  "paladin-merciful-arrest": 2,
  "paladin-oathfire-edge": 3,
  "paladin-last-witness": 4,
  "paladin-oath-incarnate": 5,
  "paladin-rampart-exchange": 2,
  "paladin-threshold-blow": 1,
  "paladin-verdict-edge": 2,
  "paladin-peace-command": 1,
  "paladin-redeeming-intercession": 2,
  "paladin-burden-taken": 1,
  "paladin-sunward-cut": 2,
  "paladin-pilgrim-aegis": 2,
});

const TARGET_EFFECT_BY_ID = Object.freeze({
  "paladin-oathguard": ["all-allies", "paladinOathguard"],
  "paladin-vowed-strike": ["enemy", null],
  "paladin-stand-fast": ["self", "paladinStandFast"],
  "paladin-challenge-of-witness": ["enemy", "paladinWitnessChallenge"],
  "paladin-bear-the-blow": ["all-allies", "paladinBearTheBlow"],
  "paladin-steadfast-word": ["all-allies", "paladinSteadfastWord"],
  "paladin-judgment-stroke": ["enemy", "paladinJudgmentStroke"],
  "paladin-hold-the-line": ["all-allies", "paladinHoldTheLine"],
  "paladin-merciful-arrest": ["enemy", "paladinMercifulArrest"],
  "paladin-oathfire-edge": ["enemy", null],
  "paladin-last-witness": ["all-allies", "paladinLastWitness"],
  "paladin-oath-incarnate": ["all-allies", "paladinOathIncarnate"],
  "paladin-shield-covenant": ["all-allies", "paladinShieldCovenant"],
  "paladin-call-to-account": ["enemy", "paladinCallToAccount"],
  "paladin-offer-quarter": ["enemy", "paladinOfferQuarter"],
  "paladin-beacon-stance": ["all-allies", "paladinBeaconStance"],
  "paladin-rampart-exchange": ["all-allies", "paladinRampartExchange"],
  "paladin-threshold-blow": ["enemy", "paladinThresholdBlow"],
  "paladin-verdict-edge": ["enemy", "paladinVerdictEdge"],
  "paladin-peace-command": ["enemy", "paladinPeaceCommand"],
  "paladin-redeeming-intercession": ["all-allies", "paladinRedeemingIntercession"],
  "paladin-burden-taken": ["self", "paladinBurdenTaken"],
  "paladin-sunward-cut": ["enemy", null],
  "paladin-pilgrim-aegis": ["all-allies", "paladinPilgrimAegis"],
});

describe("Paladin oathcraft independence", () => {
  it("defines exactly twelve general and twelve specialization-owned native cards", () => {
    const definitions = ABILITY_LIBRARY.filter(({ id }) => id.startsWith("paladin-"));
    expect(definitions.map(({ id }) => id)).toEqual(ALL_IDS);
    expect(new Set(definitions.map(({ id }) => id)).size).toBe(24);
    expect(GENERAL_IDS.every((id) => !getAbilityDef(id).branchExclusive)).toBe(true);
    expect(BRANCH_IDS.every((id) => getAbilityDef(id).branchExclusive === true)).toBe(true);
  });

  it("classifies every native card as non-spell oathcraft with its own bounded resource", () => {
    expect(ABILITY_CATEGORIES.oathcraft).toMatchObject({ id: "oathcraft", label: "Oathcraft" });
    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      expect(definition, id).toMatchObject({
        professionId: "paladin",
        progressionExclusive: true,
        school: "oathcraft",
        resolveCost: 0,
        paladinConvictionMax: 5,
      });
      expect(definition.innate, id).toBeFalsy();
      expect(definition.magicSchool, id).toBeUndefined();
      expect(abilityCategoryOf(definition), id).toBe("oathcraft");
      expect(abilityCategoryIdOf(definition), id).toBe("oathcraft");
      expect(magicSchoolIdOf(definition), id).toBeNull();
      expect(abilityTaxonomy(definition), id).toMatchObject({
        categoryId: "oathcraft",
        category: ABILITY_CATEGORIES.oathcraft,
        magicSchoolId: null,
        magicSchool: null,
        iconKey: "category:oathcraft",
      });
    }
  });

  it("uses only armour-respecting weapon damage or non-damaging oathcraft", () => {
    const foreignMetadata = /^(?:warrior|monk|barbarian|bard|ranger|rogue|sorcerer|wizard|cleric|artificer|druid)/i;
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
      expect(definition).not.toHaveProperty("spellFocus");
      expect(definition.effect?.type || "", id).not.toMatch(/spell|magic|prayer|heal|regen|invuln|charm|compuls|allegiance|instantKill/i);
      expect(Object.keys(definition.effect || {}), id).not.toEqual(expect.arrayContaining(["heal", "healing", "regen", "invulnerable", "charm", "compulsion", "allegiance"]));
    }
  });

  it("earns Conviction only from actual interception or absorption and commits every spend once", () => {
    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      expect(definition, id).not.toHaveProperty("paladinConvictionBuild");
      expect(definition.paladinConvictionOnIntercept, id).toBe(id === "paladin-oathguard" ? 1 : undefined);
      expect(definition.paladinConvictionOnAbsorb, id).toBe(id === "paladin-stand-fast" ? 1 : undefined);

      const cost = SPEND_COST_BY_ID[id];
      expect(definition.paladinConvictionCost, id).toBe(cost);
      expect(definition.paladinConvictionCommitSpend, id).toBe(cost ? true : undefined);

      const line = abilityStatLine(definition, definition.minTier || "common");
      expect(line, id).not.toContain("resolve");
      if (id === "paladin-oathguard") expect(line).toContain("only after ally damage is actually intercepted");
      if (id === "paladin-stand-fast") expect(line).toContain("only after a real hit consumes Block");
      if (cost) expect(line, id).toContain(`cost ${cost} Conviction (committed once)`);
    }
    expect(Object.keys(SPEND_COST_BY_ID)).toHaveLength(15);
  });

  it("locks Paladin-owned effect identities and the required target shapes", () => {
    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      expect([definition.target, definition.effect?.type || null], id).toEqual(TARGET_EFFECT_BY_ID[id]);
      if (definition.effect?.type) expect(definition.effect.type, id).toMatch(/^paladin[A-Z]/);
      if (definition.target === "all-allies") expect(definition.effect?.target, id).toBe("ally");
    }
  });

  it("bounds every guard, stand, and redirected-damage exchange without immunity or restoration", () => {
    expect(getAbilityDef("paladin-oathguard").effect).toMatchObject({ share: 0.30, cap: 0.15, duration: 3 });
    expect(getAbilityDef("paladin-bear-the-blow").effect).toMatchObject({ share: 0.40, cap: 0.18, duration: 2 });
    expect(getAbilityDef("paladin-last-witness").effect).toMatchObject({ share: 0.55, cap: 0.22, duration: 2 });
    expect(getAbilityDef("paladin-oath-incarnate").effect).toMatchObject({ share: 0.65, cap: 0.25, duration: 2 });
    expect(getAbilityDef("paladin-shield-covenant").effect).toMatchObject({ share: 0.35, cap: 0.16, duration: 3 });
    expect(getAbilityDef("paladin-rampart-exchange").effect).toMatchObject({ share: 0.50, cap: 0.20, block: 10, physicalOnly: true });
    expect(getAbilityDef("paladin-redeeming-intercession").effect).toMatchObject({ share: 0.40, cap: 0.18, clearFear: true });
    expect(getAbilityDef("paladin-pilgrim-aegis").effect).toMatchObject({ share: 0.40, cap: 0.18, forcedMoveResistance: 25, fearSteadiness: 20 });
    expect(getAbilityDef("paladin-stand-fast").effect).toMatchObject({ block: 10, physicalOnly: true, duration: 2 });
    expect(getAbilityDef("paladin-hold-the-line").effect).toMatchObject({ block: 12, physicalOnly: true, duration: 2 });
    expect(getAbilityDef("paladin-burden-taken").effect).toMatchObject({ redirectedDamageReduction: 0.30, cap: 0.12, duration: 2 });

    for (const id of ALL_IDS) {
      const effect = getAbilityDef(id).effect || {};
      expect(effect, id).not.toHaveProperty("invulnerable");
      expect(effect, id).not.toHaveProperty("heal");
      expect(effect, id).not.toHaveProperty("regen");
    }
  });

  it("keeps public challenge, mercy, and command voluntary and semantically honest", () => {
    const audibleIds = ALL_IDS.filter((id) => getAbilityDef(id).audible);
    expect(audibleIds).toEqual([
      "paladin-challenge-of-witness",
      "paladin-steadfast-word",
      "paladin-call-to-account",
      "paladin-offer-quarter",
      "paladin-peace-command",
    ]);
    for (const id of ["paladin-challenge-of-witness", "paladin-call-to-account", "paladin-offer-quarter", "paladin-peace-command"]) {
      const definition = getAbilityDef(id);
      expect(definition, id).toMatchObject({ audible: true, requiresAwareness: true, requiresUnderstanding: true });
      expect(definition.effect, id).toMatchObject({ soft: true });
      expect(abilityReqLine(definition), id).toContain("target must understand");
    }
    expect(getAbilityDef("paladin-offer-quarter").effect.voluntary).toBe(true);
    expect(getAbilityDef("paladin-peace-command").effect.voluntary).toBe(true);
    expect(getAbilityDef("paladin-steadfast-word")).toMatchObject({ audible: true, requiresWillingHearingAllies: true });
    expect(abilityReqLine(getAbilityDef("paladin-steadfast-word"))).toContain("allies must willingly hear and understand");
    expect(abilityReqLine(getAbilityDef("paladin-beacon-stance"))).toContain("allies must be able to see the Paladin");
  });

  it("limits sacred radiant riders to profane targets and makes ward apply", () => {
    const riderIds = ALL_IDS.filter((id) => getAbilityDef(id).paladinRadiantRider);
    expect(riderIds).toEqual(["paladin-oathfire-edge", "paladin-sunward-cut"]);
    for (const id of riderIds) {
      const definition = getAbilityDef(id);
      expect(definition).toMatchObject({ damageType: "physical", scaling: "weapon", profaneOnly: true });
      expect(definition.paladinRadiantRider).toMatchObject({ respectsWard: true });
      expect(definition.paladinRadiantRider.value).toBeGreaterThan(0);
      expect(definition.paladinRadiantRider.cap).toBeGreaterThan(0);
      expect(abilityStatLine(definition, definition.minTier || "common"), id).toContain("bounded radiant rider vs profane (ward applies");
      expect(abilityReqLine(definition), id).toContain("radiant rider applies only to a profane target");
    }
  });

  it("surfaces physical equipment, positioning, and actor-owned verdict requirements", () => {
    expect(abilityReqLine(getAbilityDef("paladin-oathguard"))).toContain("reachable physical interception line");
    expect(abilityReqLine(getAbilityDef("paladin-stand-fast"))).toContain("defensible physical footing");
    expect(abilityReqLine(getAbilityDef("paladin-shield-covenant"))).toContain("shield or guarding weapon");
    expect(abilityReqLine(getAbilityDef("paladin-rampart-exchange"))).toContain("shield or guarding weapon");
    expect(abilityReqLine(getAbilityDef("paladin-threshold-blow"))).toContain("physical melee reach");
    expect(abilityReqLine(getAbilityDef("paladin-verdict-edge"))).toContain("your active Call to Account on this target");
    expect(getAbilityDef("paladin-verdict-edge").paladinRequiresOwnCallToAccount).toBe(true);
    expect(getAbilityDef("paladin-call-to-account").effect.sourceOwned).toBe(true);
  });
});
