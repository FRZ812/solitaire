import { describe, expect, it } from "vitest";
import { CHARACTER_TEMPLATES } from "./templates.js";
import { PROFESSIONS } from "./professions.js";
import { RACES } from "./races.js";
import { itemTemplate } from "./catalog.js";
import { getAbilityDef } from "./abilities.js";
import { CHARACTER_PORTRAITS } from "../components/character-portrait-assets.js";

describe("authored character templates", () => {
  it("keeps every ready-made character unique and fully authored", () => {
    expect(CHARACTER_TEMPLATES).toHaveLength(23);
    expect(new Set(CHARACTER_TEMPLATES.map((template) => template.id)).size).toBe(23);
    expect(new Set(CHARACTER_TEMPLATES.map((template) => template.setup.name)).size).toBe(23);
    expect(new Set(CHARACTER_TEMPLATES.map((template) => template.portraitKey)).size).toBe(23);
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

  it("never aliases one generated portrait to a different authored character", () => {
    const generated = Object.values(CHARACTER_PORTRAITS);
    expect(generated).toHaveLength(21);
    expect(new Set(generated).size).toBe(generated.length);
    expect(CHARACTER_PORTRAITS["dragon-hunter"]).toBeUndefined();
    expect(CHARACTER_PORTRAITS["high-sorcerer"]).toBeUndefined();
  });
});
