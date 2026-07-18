import { describe, expect, it } from "vitest";
import {
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

const GENERAL_IDS = Object.freeze([
  "bard-clarion-note",
  "bard-steady-beat",
  "bard-cutting-verse",
  "bard-rising-tempo",
  "bard-dissonant-chord",
  "bard-call-and-response",
  "bard-stinging-refrain",
  "bard-crescendo",
  "bard-syncopated-break",
  "bard-heartening-chorus",
  "bard-counter-melody",
  "bard-grand-finale",
]);

const BRANCH_IDS = Object.freeze([
  "bard-war-drum",
  "bard-pointed-satire",
  "bard-resonant-pulse",
  "bard-lore-callout",
  "bard-marching-cadence",
  "bard-defiant-anthem",
  "bard-hecklers-hook",
  "bard-chorus-of-scorn",
  "bard-shattertone",
  "bard-harmonic-weave",
  "bard-old-ballad",
  "bard-battle-chronicle",
]);

const ALL_IDS = Object.freeze([...GENERAL_IDS, ...BRANCH_IDS]);

const MOTIF_BY_ID = Object.freeze({
  "bard-clarion-note": "voice",
  "bard-steady-beat": "rhythm",
  "bard-cutting-verse": "story",
  "bard-rising-tempo": "rhythm",
  "bard-dissonant-chord": "harmony",
  "bard-call-and-response": "voice",
  "bard-stinging-refrain": "story",
  "bard-crescendo": "harmony",
  "bard-syncopated-break": "rhythm",
  "bard-heartening-chorus": "harmony",
  "bard-counter-melody": "harmony",
  "bard-grand-finale": "story",
  "bard-war-drum": "rhythm",
  "bard-pointed-satire": "story",
  "bard-resonant-pulse": "harmony",
  "bard-lore-callout": "story",
  "bard-marching-cadence": "rhythm",
  "bard-defiant-anthem": "voice",
  "bard-hecklers-hook": "voice",
  "bard-chorus-of-scorn": "harmony",
  "bard-shattertone": "voice",
  "bard-harmonic-weave": "harmony",
  "bard-old-ballad": "story",
  "bard-battle-chronicle": "story",
});

const BUILDERS = Object.freeze([
  "bard-clarion-note",
  "bard-steady-beat",
  "bard-cutting-verse",
  "bard-rising-tempo",
  "bard-dissonant-chord",
  "bard-call-and-response",
  "bard-war-drum",
  "bard-pointed-satire",
  "bard-resonant-pulse",
  "bard-lore-callout",
]);

const COST_BY_ID = Object.freeze({
  "bard-stinging-refrain": 1,
  "bard-crescendo": 2,
  "bard-syncopated-break": 2,
  "bard-heartening-chorus": 3,
  "bard-counter-melody": 3,
  "bard-grand-finale": 4,
  "bard-marching-cadence": 2,
  "bard-defiant-anthem": 2,
  "bard-hecklers-hook": 2,
  "bard-chorus-of-scorn": 2,
  "bard-shattertone": 2,
  "bard-harmonic-weave": 2,
  "bard-old-ballad": 2,
  "bard-battle-chronicle": 2,
});

const UNDERSTANDING_IDS = Object.freeze([
  "bard-cutting-verse",
  "bard-stinging-refrain",
  "bard-pointed-satire",
  "bard-hecklers-hook",
  "bard-chorus-of-scorn",
]);

const TARGET_EFFECT_BY_ID = Object.freeze({
  "bard-clarion-note": ["enemy", null],
  "bard-steady-beat": ["all-allies", "bardSteadyBeat"],
  "bard-cutting-verse": ["enemy", "bardCuttingVerse"],
  "bard-rising-tempo": ["all-allies", "bardRisingTempo"],
  "bard-dissonant-chord": ["enemy", "bardDissonance"],
  "bard-call-and-response": ["all-allies", "bardCallResponse"],
  "bard-stinging-refrain": ["enemy", "bardStingingRefrain"],
  "bard-crescendo": ["all-enemies", null],
  "bard-syncopated-break": ["enemy", "bardSyncopation"],
  "bard-heartening-chorus": ["all-allies", "bardHearteningChorus"],
  "bard-counter-melody": ["enemy", "bardCounterMelody"],
  "bard-grand-finale": ["all-enemies", "bardGrandFinale"],
  "bard-war-drum": ["all-allies", "bardWarDrum"],
  "bard-pointed-satire": ["enemy", "bardPointedSatire"],
  "bard-resonant-pulse": ["all-enemies", null],
  "bard-lore-callout": ["all-allies", "bardLoreCallout"],
  "bard-marching-cadence": ["all-allies", "bardMarchingCadence"],
  "bard-defiant-anthem": ["all-allies", "bardDefiantAnthem"],
  "bard-hecklers-hook": ["enemy", "bardHecklersHook"],
  "bard-chorus-of-scorn": ["all-enemies", "bardChorusScorn"],
  "bard-shattertone": ["enemy", "bardSonicFracture"],
  "bard-harmonic-weave": ["all-enemies", "bardHarmonicWeave"],
  "bard-old-ballad": ["all-allies", "bardOldBallad"],
  "bard-battle-chronicle": ["all-allies", "bardBattleChronicle"],
});

const SONIC_DAMAGE_BY_ID = Object.freeze({
  "bard-clarion-note": [2, 4],
  "bard-dissonant-chord": [3, 5],
  "bard-crescendo": [4, 7],
  "bard-syncopated-break": [3, 5],
  "bard-grand-finale": [7, 11],
  "bard-resonant-pulse": [3, 5],
  "bard-shattertone": [6, 9],
  "bard-harmonic-weave": [2, 4],
});

describe("Bard performance independence", () => {
  it("defines exactly twelve general and twelve specialization-owned cards", () => {
    const bardDefinitions = ABILITY_LIBRARY.filter(({ id }) => id.startsWith("bard-"));
    expect(bardDefinitions.map(({ id }) => id)).toEqual(ALL_IDS);
    expect(new Set(bardDefinitions.map(({ id }) => id)).size).toBe(24);
    expect(GENERAL_IDS.every((id) => !getAbilityDef(id).branchExclusive)).toBe(true);
    expect(BRANCH_IDS.every((id) => getAbilityDef(id).branchExclusive === true)).toBe(true);
  });

  it("classifies every Bard card as performance, never spell, martial, or innate", () => {
    expect(ABILITY_CATEGORIES.performance).toMatchObject({ id: "performance", label: "Performance" });
    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      expect(definition, id).toMatchObject({
        professionId: "bard",
        progressionExclusive: true,
        school: "performance",
        resolveCost: 0,
        audible: true,
        bardCadenceMax: 4,
      });
      expect(definition.innate, id).toBeFalsy();
      expect(definition.magicSchool, id).toBeUndefined();
      expect(abilityCategoryOf(definition), id).toBe("performance");
      expect(abilityCategoryIdOf(definition), id).toBe("performance");
      expect(magicSchoolIdOf(definition), id).toBeNull();
      expect(abilityTaxonomy(definition), id).toMatchObject({
        categoryId: "performance",
        category: ABILITY_CATEGORIES.performance,
        magicSchoolId: null,
        magicSchool: null,
        iconKey: "category:performance",
      });
    }
  });

  it("uses only native audible effects and sonic pressure, without borrowed combat semantics", () => {
    const foreignMetadata = /^(?:warrior|monk|barbarian|sorcerer|wizard|cleric|paladin|ranger|rogue|artificer|druid)/i;
    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      expect([null, "sonic"], id).toContain(definition.damageType);
      expect(definition.scaling, id).toBe(definition.damageType === "sonic" ? "performance" : "none");
      expect(definition.weaponReq, id).toBeNull();
      expect(["presence", "wit"], id).toContain(definition.statReq.attr);
      expect(Object.keys(definition).filter((key) => foreignMetadata.test(key)), id).toEqual([]);
      for (const effect of [definition.effect, definition.selfEffect].filter(Boolean)) {
        expect(effect.type, id).toMatch(/^bard[A-Z]/);
      }
      expect(JSON.stringify(definition), id).not.toMatch(/"(?:damageType|school)":"(?:magical|physical|true|weapon|arcane|divine|shadow)"/);
    }
  });

  it("keeps the exact native target, effect, and sonic-damage profiles", () => {
    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      expect([definition.target, definition.effect?.type || null], id).toEqual(TARGET_EFFECT_BY_ID[id]);
      expect(definition.dmg, id).toEqual(SONIC_DAMAGE_BY_ID[id] || null);
    }
    expect(getAbilityDef("bard-harmonic-weave").hits).toBe(2);
    for (const id of Object.keys(SONIC_DAMAGE_BY_ID)) {
      expect(getAbilityDef(id).damageType, id).toBe("sonic");
    }
  });

  it("authors the exact alternating-motif builder and Cadence-spender contract", () => {
    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      expect(definition.bardMotif, id).toBe(MOTIF_BY_ID[id]);
      expect(definition.bardCadenceBuild, id).toBe(BUILDERS.includes(id) ? 1 : undefined);
      expect(definition.bardCadenceCost, id).toBe(COST_BY_ID[id]);
      expect(Boolean(definition.bardCadenceBuild) && Boolean(definition.bardCadenceCost), id).toBe(false);

      const statLine = abilityStatLine(definition, definition.minTier || "common");
      expect(statLine, id).toContain(`${MOTIF_BY_ID[id]} motif`);
      expect(statLine, id).toContain("audible");
      expect(statLine, id).not.toContain("resolve");
      if (BUILDERS.includes(id)) expect(statLine, id).toContain("builds 1 Cadence on motif change (max 4)");
      if (COST_BY_ID[id]) expect(statLine, id).toContain(`cost ${COST_BY_ID[id]} Cadence`);
    }
    expect(new Set(Object.values(MOTIF_BY_ID))).toEqual(new Set(["voice", "rhythm", "harmony", "story"]));
  });

  it("gates only semantic performances on shared understanding", () => {
    for (const id of ALL_IDS) {
      const definition = getAbilityDef(id);
      const required = UNDERSTANDING_IDS.includes(id);
      expect(Boolean(definition.requiresUnderstanding), id).toBe(required);
      expect(Boolean(definition.bardRequiresUnderstanding), id).toBe(required);
      if (required) expect(abilityStatLine(definition), id).toContain("requires understanding");
      else expect(abilityStatLine(definition), id).not.toContain("requires understanding");
    }
  });
});
