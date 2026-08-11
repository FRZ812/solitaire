import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AbilityIcon } from "../components/AbilityIcon.jsx";
import { ABILITY_CATALOG, abilityCategoryOf, getAbilityDef } from "./abilities.js";
import {
  ABILITY_CATEGORIES,
  MAGIC_SCHOOLS,
  abilityTaxonomy,
} from "./ability-taxonomy.js";
import { BUFF_SPELL_LIST, knownBuffSpells } from "./buff-spells.js";
import { TRAVEL_SPELL_LIST, knownTravelSpells } from "./travel-spells.js";

describe("ability taxonomy", () => {
  it("defines the full eight-school magic taxonomy and categorizes every learned spell", () => {
    expect(Object.keys(MAGIC_SCHOOLS)).toEqual([
      "abjuration",
      "conjuration",
      "divination",
      "enchantment",
      "evocation",
      "illusion",
      "necromancy",
      "transmutation",
    ]);

    const learnedSpells = ABILITY_CATALOG.filter((ability) => (
      !ability.innate
      && (abilityCategoryOf(ability) === "spell" || (ability.school === "shadow" && ability.scaling === "stat"))
    ));
    expect(learnedSpells.length).toBeGreaterThan(20);
    for (const ability of learnedSpells) {
      const taxonomy = abilityTaxonomy(ability, ability.minTier || "common");
      expect(taxonomy.categoryId, ability.id).toBe("magic");
      expect(MAGIC_SCHOOLS[taxonomy.magicSchoolId], ability.id).toBeTruthy();
    }

    for (const ability of [...TRAVEL_SPELL_LIST, ...BUFF_SPELL_LIST]) {
      const taxonomy = abilityTaxonomy(ability, ability.minTier || "common");
      expect(taxonomy.categoryId, ability.id).toBe("magic");
      expect(MAGIC_SCHOOLS[taxonomy.magicSchoolId], ability.id).toBeTruthy();
    }
  });

  it("keeps nonmagical abilities in their authored broad categories", () => {
    expect(abilityTaxonomy(getAbilityDef("basic-attack")).category).toBe(ABILITY_CATEGORIES.martial);
    expect(abilityTaxonomy(getAbilityDef("shadowstep"))).toMatchObject({
      category: ABILITY_CATEGORIES.martial,
      magicSchool: null,
      iconKey: "category:martial",
    });
    expect(abilityTaxonomy(getAbilityDef("battle-focus")).category).toBe(ABILITY_CATEGORIES.survival);
    expect(abilityTaxonomy(getAbilityDef("talk")).category).toBe(ABILITY_CATEGORIES.social);
    expect(abilityTaxonomy(getAbilityDef("bard-clarion-note"))).toMatchObject({
      category: ABILITY_CATEGORIES.performance,
      magicSchool: null,
      iconKey: "category:performance",
    });
    expect(abilityTaxonomy(getAbilityDef("ranger-quarry-sign"))).toMatchObject({
      category: ABILITY_CATEGORIES.fieldcraft,
      magicSchool: null,
      iconKey: "category:fieldcraft",
    });
    expect(abilityTaxonomy(getAbilityDef("rogue-assess-mark"))).toMatchObject({
      category: ABILITY_CATEGORIES.subterfuge,
      magicSchool: null,
      iconKey: "category:subterfuge",
    });
    expect(abilityTaxonomy(getAbilityDef("paladin-oathguard"))).toMatchObject({
      category: ABILITY_CATEGORIES.oathcraft,
      magicSchool: null,
      iconKey: "category:oathcraft",
    });
    expect(abilityTaxonomy(getAbilityDef("druid-verdant-spark"))).toMatchObject({
      category: ABILITY_CATEGORIES.primalcraft,
      magicSchool: null,
      iconKey: "category:primalcraft",
    });
    expect(abilityCategoryOf(getAbilityDef("druid-verdant-spark"))).toBe("primalcraft");
    expect(abilityTaxonomy(getAbilityDef("warlock-tithe-bolt"))).toMatchObject({
      category: ABILITY_CATEGORIES.pactcraft,
      magicSchool: null,
      iconKey: "category:pactcraft",
    });
    expect(abilityCategoryOf(getAbilityDef("warlock-tithe-bolt"))).toBe("pactcraft");
    expect(abilityTaxonomy(getAbilityDef("artificer-snapfire-capsule"))).toMatchObject({
      category: ABILITY_CATEGORIES.devicecraft,
      magicSchool: null,
      iconKey: "category:devicecraft",
    });
    expect(abilityCategoryOf(getAbilityDef("artificer-snapfire-capsule"))).toBe("devicecraft");
  });

  it("assigns supernatural grave techniques to necromancy rather than illusion", () => {
    expect(abilityTaxonomy(getAbilityDef("wraithstep"))).toMatchObject({
      categoryId: "magic",
      magicSchool: MAGIC_SCHOOLS.necromancy,
      iconKey: "magic:necromancy:common",
    });
  });

  it("preserves learned utility-spell tiers for the shared school-tier icon", () => {
    const character = { abilities: [
      { id: "haste", tier: "legendary" },
      { id: "dimension-door", tier: "epic" },
    ] };
    expect(knownBuffSpells(character)[0].tier).toBe("legendary");
    expect(knownTravelSpells(character)[0].tier).toBe("epic");
    expect(abilityTaxonomy(knownBuffSpells(character)[0], knownBuffSpells(character)[0].tier).iconKey)
      .toBe("magic:transmutation:legendary");
  });
});
