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
  "ranger-quarry-sign",
  "ranger-ranging-shot",
  "ranger-field-dressing",
  "ranger-trail-cut",
  "ranger-pinpoint-volley",
  "ranger-evading-step",
  "ranger-crippling-shot",
  "ranger-pursuit-line",
  "ranger-covering-shot",
  "ranger-kill-window",
  "ranger-relentless-trail",
  "ranger-perfect-hunt",
]);

const BRANCH_IDS = Object.freeze([
  "ranger-patient-aim",
  "ranger-pathfinder-step",
  "ranger-companion-signal",
  "ranger-set-snare",
  "ranger-read-monster",
  "ranger-deadeye-breath",
  "ranger-safe-passage",
  "ranger-running-shot",
  "ranger-pack-command",
  "ranger-falcon-stoop",
  "ranger-layered-snare",
  "ranger-kill-zone",
]);

const ALL_IDS = Object.freeze([...GENERAL_IDS, ...BRANCH_IDS]);

const BUILD_BY_ID = Object.freeze({
  "ranger-quarry-sign": 2,
  "ranger-ranging-shot": 1,
  "ranger-trail-cut": 1,
  "ranger-pursuit-line": 1,
  "ranger-patient-aim": 1,
  "ranger-pathfinder-step": 1,
  "ranger-companion-signal": 1,
  "ranger-set-snare": 1,
});

const BUILD_TRIGGER_BY_ID = Object.freeze({
  "ranger-quarry-sign": "setup",
  "ranger-ranging-shot": "hit",
  "ranger-trail-cut": "setup",
  "ranger-pursuit-line": "hit",
  "ranger-patient-aim": "setup",
  "ranger-pathfinder-step": "setup",
  "ranger-companion-signal": "companion-hit",
  "ranger-set-snare": "setup",
});

const COST_BY_ID = Object.freeze({
  "ranger-pinpoint-volley": 2,
  "ranger-crippling-shot": 2,
  "ranger-covering-shot": 2,
  "ranger-kill-window": 3,
  "ranger-perfect-hunt": 5,
  "ranger-read-monster": 2,
  "ranger-deadeye-breath": 2,
  "ranger-safe-passage": 2,
  "ranger-running-shot": 2,
  "ranger-pack-command": 2,
  "ranger-falcon-stoop": 2,
  "ranger-layered-snare": 2,
  "ranger-kill-zone": 2,
});

const NEUTRAL_IDS = Object.freeze([
  "ranger-field-dressing",
  "ranger-evading-step",
  "ranger-relentless-trail",
]);

const TARGET_EFFECT_BY_ID = Object.freeze({
  "ranger-quarry-sign": ["enemy", "rangerQuarrySign"],
  "ranger-ranging-shot": ["enemy", null],
  "ranger-field-dressing": ["all-allies", "rangerFieldDressing"],
  "ranger-trail-cut": ["enemy", "rangerTrailCut"],
  "ranger-pinpoint-volley": ["enemy", null],
  "ranger-evading-step": ["self", "rangerEvadingStep"],
  "ranger-crippling-shot": ["enemy", "rangerCripplingShot"],
  "ranger-pursuit-line": ["enemy", "rangerPursuitLine"],
  "ranger-covering-shot": ["enemy", "rangerCoveringShot"],
  "ranger-kill-window": ["enemy", null],
  "ranger-relentless-trail": ["enemy", "rangerRelentlessTrail"],
  "ranger-perfect-hunt": ["enemy", null],
  "ranger-patient-aim": ["enemy", "rangerPatientAim"],
  "ranger-pathfinder-step": ["enemy", "rangerPathfinderStep"],
  "ranger-companion-signal": ["enemy", "rangerCompanionSignal"],
  "ranger-set-snare": ["enemy", "rangerSetSnare"],
  "ranger-read-monster": ["enemy", "rangerReadMonster"],
  "ranger-deadeye-breath": ["enemy", null],
  "ranger-safe-passage": ["all-allies", "rangerSafePassage"],
  "ranger-running-shot": ["enemy", "rangerRunningShot"],
  "ranger-pack-command": ["enemy", "rangerPackCommand"],
  "ranger-falcon-stoop": ["enemy", "rangerFalconStoop"],
  "ranger-layered-snare": ["enemy", "rangerLayeredSnare"],
  "ranger-kill-zone": ["all-enemies", "rangerKillZone"],
});

const DAMAGE_FORM_BY_ID = Object.freeze({
  "ranger-ranging-shot": "projectile",
  "ranger-pinpoint-volley": "projectile",
  "ranger-crippling-shot": "piercing",
  "ranger-pursuit-line": "projectile",
  "ranger-covering-shot": "projectile",
  "ranger-kill-window": "piercing",
  "ranger-perfect-hunt": "piercing",
  "ranger-deadeye-breath": "piercing",
  "ranger-running-shot": "projectile",
  "ranger-pack-command": "impact",
  "ranger-falcon-stoop": "piercing",
  "ranger-layered-snare": "impact",
  "ranger-kill-zone": "projectile",
});

describe("Ranger fieldcraft independence", () => {
  it("defines exactly twelve general and twelve specialization-owned native cards", () => {
    const definitions = ABILITY_LIBRARY.filter(({ id }) => id.startsWith("ranger-"));
    expect(definitions.map(({ id }) => id)).toEqual(ALL_IDS);
    expect(new Set(definitions.map(({ id }) => id)).size).toBe(24);
    expect(GENERAL_IDS.every((id) => !getAbilityDef(id).branchExclusive)).toBe(true);
    expect(BRANCH_IDS.every((id) => getAbilityDef(id).branchExclusive === true)).toBe(true);
  });

  it("classifies every native card as fieldcraft, never spell, magic, martial, performance, or innate", () => {
    expect(ABILITY_CATEGORIES.fieldcraft).toMatchObject({ id: "fieldcraft", label: "Fieldcraft" });
    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      expect(definition, id).toMatchObject({
        professionId: "ranger",
        progressionExclusive: true,
        school: "fieldcraft",
        resolveCost: 0,
        rangerQuarryInsightMax: 5,
      });
      expect(definition.innate, id).toBeFalsy();
      expect(definition.magicSchool, id).toBeUndefined();
      expect(abilityCategoryOf(definition), id).toBe("fieldcraft");
      expect(abilityCategoryIdOf(definition), id).toBe("fieldcraft");
      expect(magicSchoolIdOf(definition), id).toBeNull();
      expect(abilityTaxonomy(definition), id).toMatchObject({
        categoryId: "fieldcraft",
        category: ABILITY_CATEGORIES.fieldcraft,
        magicSchoolId: null,
        magicSchool: null,
        iconKey: "category:fieldcraft",
      });
    }
  });

  it("uses only Ranger-owned material effects and physical-or-null damage", () => {
    const foreignMetadata = /^(?:warrior|monk|barbarian|bard|sorcerer|wizard|cleric|paladin|rogue|artificer|druid)/i;
    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      expect([null, "physical"], id).toContain(definition.damageType);
      expect(["none", "weapon", "fieldcraft"], id).toContain(definition.scaling);
      expect(["reflex", "wit", "vigor"], id).toContain(definition.statReq.attr);
      expect(Object.keys(definition).filter((key) => foreignMetadata.test(key)), id).toEqual([]);
      for (const effect of [definition.effect, definition.selfEffect].filter(Boolean)) {
        expect(effect.type, id).toMatch(/^ranger[A-Z]/);
      }
      expect(definition.school, id).not.toMatch(/arcane|divine|primal|shadow|performance|martial/i);
      expect(String(definition.damageType || ""), id).not.toMatch(/magical|sonic|true|weapon/i);
      expect(definition.resolveCost, id).toBe(0);
    }
  });

  it("authors the exact target, native effect, and material damage-form contract", () => {
    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      expect([definition.target, definition.effect?.type || null], id).toEqual(TARGET_EFFECT_BY_ID[id]);
      expect(definition.rangerDamageForm, id).toBe(DAMAGE_FORM_BY_ID[id]);
      expect(Boolean(definition.damageType), id).toBe(Boolean(DAMAGE_FORM_BY_ID[id]));
      if (definition.damageType) expect(definition.damageType, id).toBe("physical");
    }
    expect(getAbilityDef("ranger-pinpoint-volley").hits).toBe(3);
  });

  it("locks target-bound Quarry Insight builders, spenders, and neutral cards", () => {
    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      expect(definition.rangerQuarryInsightBuild, id).toBe(BUILD_BY_ID[id]);
      expect(definition.rangerQuarryBuildTrigger, id).toBe(BUILD_TRIGGER_BY_ID[id]);
      expect(definition.rangerQuarryInsightCost, id).toBe(COST_BY_ID[id]);
      expect(Boolean(definition.rangerQuarryInsightBuild) && Boolean(definition.rangerQuarryInsightCost), id).toBe(false);

      if (COST_BY_ID[id]) {
        expect(definition.rangerRequiresCurrentQuarry, id).toBe(true);
        expect(definition.rangerQuarrySpendOnce, id).toBe(true);
      }
      if (BUILD_BY_ID[id]) expect(definition.rangerRequiresCurrentQuarry, id).toBeUndefined();

      const statLine = abilityStatLine(definition, definition.minTier || "common");
      expect(statLine, id).not.toContain("resolve");
      if (BUILD_BY_ID[id]) expect(statLine, id).toContain(`builds ${BUILD_BY_ID[id]} Quarry Insight on successful`);
      if (COST_BY_ID[id]) expect(statLine, id).toContain(`cost ${COST_BY_ID[id]} Quarry Insight once`);
    }
    expect(getAbilityDef("ranger-quarry-sign").effect.type).toBe("rangerQuarrySign");
    expect(abilityStatLine(getAbilityDef("ranger-quarry-sign"))).toContain("switching resets prior Insight");
    expect(NEUTRAL_IDS.every((id) => !getAbilityDef(id).rangerQuarryInsightBuild && !getAbilityDef(id).rangerQuarryInsightCost)).toBe(true);
    expect(getAbilityDef("ranger-relentless-trail").rangerRequiresCurrentQuarry).toBe(true);
  });

  it("surfaces honest weapon, terrain, sight, and trained-animal prerequisites", () => {
    expect(abilityReqLine(getAbilityDef("ranger-ranging-shot"))).toContain("needs bow/crossbow");
    expect(abilityReqLine(getAbilityDef("ranger-quarry-sign"))).toContain("needs line of sight");
    expect(abilityReqLine(getAbilityDef("ranger-set-snare"))).toContain("needs anchorable ground");
    expect(abilityReqLine(getAbilityDef("ranger-companion-signal"))).toContain("needs a trained beast ally already present");
    expect(abilityReqLine(getAbilityDef("ranger-companion-signal"))).toContain("beast must perceive the signal");
    expect(abilityReqLine(getAbilityDef("ranger-falcon-stoop"))).toContain("needs a trained flying beast ally already present");

    const beastIds = ALL_IDS.filter((id) => getAbilityDef(id).requiresTrainedBeastAlly);
    expect(beastIds).toEqual(["ranger-companion-signal", "ranger-pack-command", "ranger-falcon-stoop"]);
    expect(getAbilityDef("ranger-falcon-stoop").requiresFlyingBeastAlly).toBe(true);
    expect(getAbilityDef("ranger-companion-signal").audible).toBe(true);
    expect(ALL_IDS.filter((id) => getAbilityDef(id).audible)).toEqual(["ranger-companion-signal"]);
  });

  it("keeps Field Dressing mundane and beast cards dependent on existing allies", () => {
    const dressing = getAbilityDef("ranger-field-dressing");
    expect(dressing.effect).toMatchObject({ type: "rangerFieldDressing", stabilize: true, morale: 12 });
    expect(dressing.effect).not.toHaveProperty("heal");
    expect(dressing.effect).not.toHaveProperty("hp");
    expect(dressing.effect).not.toHaveProperty("resolve");
    expect(dressing.dmg).toBeNull();
    expect(dressing.desc).toMatch(/never health, Resolve, or magical vitality/i);

    for (const id of ["ranger-companion-signal", "ranger-pack-command", "ranger-falcon-stoop"]) {
      const definition = getAbilityDef(id);
      expect(definition.requiresTrainedBeastAlly, id).toBe(true);
      expect(definition.effect?.type, id).not.toMatch(/summon|conjure|dominat/i);
    }
  });
});
