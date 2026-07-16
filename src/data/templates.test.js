import { describe, expect, it } from "vitest";
import { CHARACTER_TEMPLATES } from "./templates.js";
import { PROFESSIONS } from "./professions.js";
import { RACES } from "./races.js";
import { itemTemplate } from "./catalog.js";
import { getAbilityDef } from "./abilities.js";
import { CHARACTER_PORTRAITS } from "../components/character-portrait-assets.js";
import { characterSubclass } from "./character-subclasses.js";
import { ratingFromXp } from "./proficiencies.js";

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

  it("persists specific subclasses without repeating the parent profession", () => {
    const shadowblade = CHARACTER_TEMPLATES.find((template) => template.id === "shadowblade");
    expect(shadowblade.setup).toMatchObject({ profession: "assassin", subclass: "shadowblade" });
    expect(characterSubclass({ templateId: "shadowblade", profession: "assassin" }))
      .toEqual({ id: "shadowblade", label: "Shadowblade" });
    for (const template of CHARACTER_TEMPLATES) {
      if (template.setup.subclass) expect(template.setup.subclass).not.toBe(template.setup.profession);
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
