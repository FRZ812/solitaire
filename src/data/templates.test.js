import { describe, expect, it } from "vitest";
import { CHARACTER_TEMPLATES } from "./templates.js";
import { PROFESSIONS } from "./professions.js";
import { RACES } from "./races.js";
import { itemTemplate } from "./catalog.js";
import { getAbilityDef } from "./abilities.js";
import { CHARACTER_PORTRAITS } from "../components/character-portrait-assets.js";
import { characterArchetype } from "./character-archetypes.js";
import { ratingFromXp } from "./proficiencies.js";
import { STARTING_LEVEL_BY_POWER_TIER, progressionAtLevel } from "./progression-paths.js";
import { progressionLevel } from "../engine/progression.js";

describe("authored character templates", () => {
  it("keeps every ready-made character unique and fully authored", () => {
    expect(CHARACTER_TEMPLATES).toHaveLength(27);
    expect(new Set(CHARACTER_TEMPLATES.map((template) => template.id)).size).toBe(27);
    expect(new Set(CHARACTER_TEMPLATES.map((template) => template.setup.name)).size).toBe(27);
    expect(new Set(CHARACTER_TEMPLATES.map((template) => template.portraitKey)).size).toBe(27);
    for (const template of CHARACTER_TEMPLATES) {
      expect(template.voice, `${template.id} voice`).toBeTruthy();
      expect(template.complication, `${template.id} complication`).toBeTruthy();
      expect(template.signature, `${template.id} signature`).toBeTruthy();
      expect(template.portraitKey).toBe(`template:${template.id}`);
      expect(template).not.toHaveProperty("opening");
      expect(template).not.toHaveProperty("icon");
    }
  });

  it("references canonical races, professions, abilities, and gear", () => {
    for (const template of CHARACTER_TEMPLATES) {
      expect(RACES[template.setup.race], `${template.id} race`).toBeTruthy();
      expect(PROFESSIONS[template.setup.profession], `${template.id} profession`).toBeTruthy();
      for (const ability of template.setup.abilities || []) {
        expect(getAbilityDef(ability.id), `${template.id} ability ${ability.id}`).toBeTruthy();
      }
      for (const item of template.setup.items || []) {
        expect(itemTemplate(item.itemId), `${template.id} item ${item.itemId}`).toBeTruthy();
      }
    }
  });

  it("persists a specialized archetype separately from the broad profession", () => {
    const shadowblade = CHARACTER_TEMPLATES.find((template) => template.id === "shadowblade");
    expect(shadowblade.setup).toMatchObject({ profession: "assassin", archetype: "shadowblade" });
    expect(characterArchetype({ templateId: "shadowblade", profession: "assassin" }))
      .toMatchObject({ id: "shadowblade", label: "Shadowblade" });
    for (const template of CHARACTER_TEMPLATES) {
      expect(template.setup).not.toHaveProperty("subclass");
      expect(template.setup.archetype, `${template.id} archetype`).toBeTruthy();
    }
  });

  it("anchors every campaign power tier to the new 100-level scale", () => {
    expect(STARTING_LEVEL_BY_POWER_TIER).toEqual({
      standard: 10,
      mid: 25,
      epic: 45,
      legendary: 65,
      mythical: 85,
      divine: 100,
    });
    for (const template of CHARACTER_TEMPLATES) {
      expect(progressionLevel(template.setup), `${template.id} starting level`)
        .toBe(STARTING_LEVEL_BY_POWER_TIER[template.tier]);
    }
  });

  it("starts every ready-made sheet at its route's exact cumulative attributes", () => {
    for (const template of CHARACTER_TEMPLATES) {
      const level = STARTING_LEVEL_BY_POWER_TIER[template.tier];
      const route = progressionAtLevel(template.setup.profession, level, {
        sidePath: template.setup.progression.sidePath,
        archetypeId: template.setup.progression.archetypeId,
      });
      expect(template.setup.attributes, `${template.id} route attributes`).toEqual(route.attributes);
    }
  });

  it("gives trained caster templates power-appropriate spellcasting mastery", () => {
    const devout = CHARACTER_TEMPLATES.find((template) => template.id === "devout");
    const hedgeMage = CHARACTER_TEMPLATES.find((template) => template.id === "hedge-mage");
    const korvane = CHARACTER_TEMPLATES.find((template) => template.id === "enchanter-tyrant");
    const sellsword = CHARACTER_TEMPLATES.find((template) => template.id === "sellsword");

    expect(ratingFromXp(devout.setup.proficiencies.spellcasting)).toBe(1);
    expect(ratingFromXp(hedgeMage.setup.proficiencies.spellcasting)).toBe(3);
    expect(ratingFromXp(korvane.setup.proficiencies.spellcasting)).toBe(15);
    expect(sellsword.setup.proficiencies?.spellcasting).toBeUndefined();
  });

  it("never aliases one generated portrait to a different authored character", () => {
    const generated = Object.values(CHARACTER_PORTRAITS);
    expect(generated).toHaveLength(27);
    expect(new Set(generated).size).toBe(generated.length);
    expect(CHARACTER_PORTRAITS["dragon-hunter"]).toContain("dragon-hunter-grounded-v3.webp");
    expect(CHARACTER_PORTRAITS["high-sorcerer"]).toContain("high-sorcerer-grounded-v3.webp");
    expect(CHARACTER_PORTRAITS["court-envoy"]).toContain("court-envoy-grounded-v3.webp");
    expect(CHARACTER_PORTRAITS["confidence-artist"]).toContain("confidence-artist-grounded-v3.webp");
    expect(CHARACTER_PORTRAITS["guild-advocate"]).toContain("guild-advocate-grounded-v3.webp");
    expect(CHARACTER_PORTRAITS["velvet-courtier"]).toContain("velvet-courtier-grounded-v3.webp");
  });
});
