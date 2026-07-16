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
import { cardDefinition } from "./combat-cards.js";
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
  });

  it("assigns supernatural grave techniques to necromancy rather than illusion", () => {
    expect(abilityTaxonomy(getAbilityDef("wraithstep"))).toMatchObject({
      categoryId: "magic",
      magicSchool: MAGIC_SCHOOLS.necromancy,
      iconKey: "magic:necromancy:common",
    });
  });

  it("uses one stable icon identity per school and tier", () => {
    const firebolt = cardDefinition("fireball", "rare");
    const lightning = cardDefinition("blizzard", "rare");
    const higherFirebolt = cardDefinition("fireball", "epic");
    const ward = cardDefinition("mana-shield", "rare");

    expect(firebolt.iconKey).toBe("magic:evocation:rare");
    expect(lightning.iconKey).toBe(firebolt.iconKey);
    expect(higherFirebolt.iconKey).not.toBe(firebolt.iconKey);
    expect(ward.iconKey).toBe("magic:abjuration:rare");
    expect(ward.iconKey).not.toBe(firebolt.iconKey);

    const html = renderToStaticMarkup(
      <AbilityIcon ability={getAbilityDef("firebolt")} tierId="rare" />,
    );
    expect(html).toContain('data-icon-key="magic:evocation:rare"');
    expect(html).toContain('data-school="evocation"');
    expect(html).toContain('data-tier="rare"');
    expect(html).toContain('aria-label="Evocation magic · Rare"');
    expect(html).not.toContain("ability-icon__tier");
  });

  it("keeps combat Haste canonical while applying its card tempo rules", () => {
    const haste = getAbilityDef("haste");
    const card = cardDefinition("haste", "rare");
    expect(haste.noncombat).not.toBe(true);
    expect(card).toMatchObject({
      abilityId: "haste",
      magicSchool: "transmutation",
      iconKey: "magic:transmutation:very-rare",
      draw: 2,
      exhaust: true,
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
