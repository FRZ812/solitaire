import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

const moduleUrl = new URL("./narrator-instructions.js", import.meta.url);

const EXPECTED_SKILL_IDS = [
  "narrative-craft",
  "identity-and-kindreds",
  "world-and-travel",
  "progression-and-professions",
  "magic-and-mounts",
  "economy-and-survival",
  "codex-and-npcs",
  "relationships-and-party",
  "inventory-and-light",
  "combat-and-consequences",
];

describe("narrator instruction library", () => {
  it("keeps detailed rules in deterministic on-demand skill modules", async () => {
    expect(existsSync(moduleUrl), "the on-demand narrator instruction module must exist").toBe(true);

    const {
      NARRATOR_INSTRUCTION_CORPUS,
      NARRATOR_SKILL_CATALOG,
      NARRATOR_SKILL_LIBRARY,
      NARRATOR_SKILLS,
    } = await import("./narrator-instructions.js");

    expect(NARRATOR_SKILLS.map((skill) => skill.id)).toEqual(EXPECTED_SKILL_IDS);
    expect(Object.keys(NARRATOR_SKILL_LIBRARY)).toEqual(EXPECTED_SKILL_IDS);
    expect(NARRATOR_SKILLS.every((skill) => skill.content.length > 200)).toBe(true);
    expect(NARRATOR_SKILLS.length).toBeLessThanOrEqual(16);
    expect(NARRATOR_SKILLS.every((skill) => skill.content.length <= 50_000)).toBe(true);
    expect(NARRATOR_SKILLS.reduce((sum, skill) => sum + skill.content.length, 0)).toBeLessThanOrEqual(180_000);
    expect(NARRATOR_SKILL_CATALOG.length).toBeLessThan(3_000);

    expect(NARRATOR_INSTRUCTION_CORPUS).toContain("THE NARRATIVE PHILOSOPHY");
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain("TIER SCALES AN ABILITY");
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain("NARRATIVE PARTY REMOVAL");
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain("OUTPUT — STRICT JSON, NOTHING ELSE");

    const normalize = (value) => value.replace(/\s+/g, " ").trim();
    const detailedDoctrine = NARRATOR_INSTRUCTION_CORPUS
      .slice(0, NARRATOR_INSTRUCTION_CORPUS.indexOf("OUTPUT — STRICT JSON, NOTHING ELSE"));
    expect(normalize(NARRATOR_SKILLS.map(({ content }) => content).join("\n")))
      .toBe(normalize(detailedDoctrine));

    const creation = NARRATOR_SKILLS.find(({ id }) => id === "narrative-craft");
    expect(creation.trigger).toContain("character creation");
    expect(creation.content).toContain("CHARACTER CREATION — the opening interview");

    const world = NARRATOR_SKILLS.find(({ id }) => id === "world-and-travel");
    const progression = NARRATOR_SKILLS.find(({ id }) => id === "progression-and-professions");
    expect(world.content).toContain("GEOGRAPHY KNOWN BY LEGEND");
    expect(progression.content.startsWith("PROGRESSION — engine-owned")).toBe(true);
  });
});
