import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

const moduleUrl = new URL("../../supabase/functions/narrate/tools.ts", import.meta.url);
const rawLibrary = [
  { id: "world-and-travel", label: "World & travel", trigger: "movement", content: "Detailed movement rules." },
  { id: "combat-and-consequences", label: "Combat", trigger: "an attack", content: "Detailed combat rules." },
];

describe("narrator on-demand instruction tools", () => {
  it("advertises only validated skill ids and loads requested doctrine once", async () => {
    expect(existsSync(moduleUrl), "the edge narrator tool module must exist").toBe(true);
    const {
      asInstructionLibrary,
      instructionToolFor,
      resolveInstructionToolCall,
    } = await import("../../supabase/functions/narrate/tools.ts");

    const library = asInstructionLibrary(rawLibrary);
    const tool = instructionToolFor(library);
    expect(tool.function.name).toBe("load_narrator_skills");
    expect(tool.function.parameters.properties.skill_ids.items.enum).toEqual([
      "world-and-travel",
      "combat-and-consequences",
    ]);

    const loadedSkillIds = new Set();
    const first = resolveInstructionToolCall({
      id: "call-1",
      name: "load_narrator_skills",
      arguments: JSON.stringify({ skill_ids: ["world-and-travel", "world-and-travel"] }),
    }, library, loadedSkillIds);
    expect(first.recognized).toBe(true);
    expect(first.result).toContain('<narrator-skill id="world-and-travel">');
    expect(first.result).toContain("Detailed movement rules.");
    expect(loadedSkillIds).toEqual(new Set(["world-and-travel"]));

    const second = resolveInstructionToolCall({
      id: "call-2",
      name: "load_narrator_skills",
      arguments: JSON.stringify({ skill_ids: ["world-and-travel"] }),
    }, library, loadedSkillIds);
    expect(second.result).toContain("already loaded");
    expect(second.result).not.toContain("Detailed movement rules.");
  });

  it("bounds and rejects malformed client-supplied instruction libraries", async () => {
    expect(existsSync(moduleUrl), "the edge narrator tool module must exist").toBe(true);
    const { asInstructionLibrary } = await import("../../supabase/functions/narrate/tools.ts");

    expect(() => asInstructionLibrary([{ ...rawLibrary[0], id: "BAD ID" }])).toThrow("invalid narrator skill id");
    expect(() => asInstructionLibrary([{ ...rawLibrary[0], content: "" }])).toThrow("invalid narrator skill content");
    expect(() => asInstructionLibrary([...rawLibrary, rawLibrary[0]])).toThrow("duplicate narrator skill id");
    expect(() => asInstructionLibrary(Array.from({ length: 17 }, (_, index) => ({
      ...rawLibrary[0],
      id: `skill-${index}`,
    })))).toThrow("too many narrator skills");
    expect(() => asInstructionLibrary([{ ...rawLibrary[0], content: "x".repeat(50_001) }]))
      .toThrow("narrator skill content is too large");
    expect(() => asInstructionLibrary(Array.from({ length: 4 }, (_, index) => ({
      ...rawLibrary[0],
      id: `skill-${index}`,
      content: "x".repeat(45_001),
    })))).toThrow("narrator skill library is too large");
  });

  it("bounds each tool request and reports unknown ids without reading paths", async () => {
    const { asInstructionLibrary, resolveInstructionToolCall } = await import("../../supabase/functions/narrate/tools.ts");
    const library = asInstructionLibrary(Array.from({ length: 6 }, (_, index) => ({
      id: `skill-${index}`,
      label: `Skill ${index}`,
      trigger: `case ${index}`,
      content: `Rules ${index}`,
    })));

    const result = resolveInstructionToolCall({
      id: "call-bounded",
      name: "load_narrator_skills",
      arguments: JSON.stringify({
        skill_ids: ["skill-0", "skill-1", "skill-2", "skill-3", "skill-4", "../secrets"],
      }),
    }, library, new Set());

    expect(result.result.match(/<narrator-skill /g)).toHaveLength(4);
    expect(result.result).not.toContain("Rules 4");
    expect(result.result).not.toContain("secrets");
  });
});
