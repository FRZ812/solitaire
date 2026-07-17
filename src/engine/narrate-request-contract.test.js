import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT } from "../system-prompt.js";

const edgeSource = readFileSync(
  new URL("../../supabase/functions/narrate/index.ts", import.meta.url),
  "utf8",
);

function numericConstant(name) {
  const match = edgeSource.match(new RegExp(`const\\s+${name}\\s*=\\s*([\\d_]+)`));
  expect(match, `${name} must be declared in the narrator Edge function`).not.toBeNull();
  return Number(match[1].replaceAll("_", ""));
}

describe("narrator request size contract", () => {
  it("accepts the checked-in system prompt without relaxing every request field", () => {
    const genericFieldLimit = numericConstant("MAX_FIELD_LENGTH");
    const systemPromptLimit = numericConstant("MAX_SYSTEM_PROMPT_LENGTH");

    expect(SYSTEM_PROMPT.length).toBeGreaterThan(genericFieldLimit);
    expect(SYSTEM_PROMPT.length).toBeLessThanOrEqual(systemPromptLimit);
  });

  it("applies the dedicated limit to the system_prompt field", () => {
    expect(edgeSource).toMatch(
      /stringField\(payload\.system_prompt,\s*"system_prompt",\s*MAX_SYSTEM_PROMPT_LENGTH\)/,
    );
  });
});

describe("narrator memory tool contract", () => {
  it("supports manual opt-out, parallel calls, and server-side duplicate suppression", () => {
    expect(edgeSource).toContain('const toolsEnabled = opts.memoryMode !== "manual"');
    expect(edgeSource).toContain('parallel_tool_calls: true');
    expect(edgeSource).toContain('"ignored: already recorded"');
    expect(edgeSource).toContain("existing_memories");
  });
});

describe("narrator party-removal contract", () => {
  it("exposes a structured removal action for story-only companion deaths", () => {
    expect(SYSTEM_PROMPT).toContain('party_removals:[{"id":"<their listed id>","reason":"dead"}]');
    expect(SYSTEM_PROMPT).toContain('"party_removals": null OR [{"id":"current-party-member-id","reason":"dead|left"}]');
    expect(SYSTEM_PROMPT).toContain("repair that stale roster with the same removal");
  });
});

describe("narrator progression contract", () => {
  it("uses numeric racial and profession allocation without character-tier labels", () => {
    expect(SYSTEM_PROMPT).toContain("racial_levels");
    expect(SYSTEM_PROMPT).toContain("profession_plan");
    expect(SYSTEM_PROMPT).toContain('"progression_focus": null OR "racial"');
    expect(SYSTEM_PROMPT).toContain("up to 30 RACIAL EVOLUTION levels plus up to 70 combined PROFESSION levels");
    expect(SYSTEM_PROMPT).toContain("Never invent or emit durable path ids/ranks");
    expect(SYSTEM_PROMPT).not.toContain("WORLD POWER BANDS");
    expect(SYSTEM_PROMPT).not.toContain("STANDARD: levels 1–20");
  });

  it("keeps rarity tiers for items and abilities distinct from character level", () => {
    expect(SYSTEM_PROMPT).toContain("Item and ability rarity tiers remain separate");
    expect(SYSTEM_PROMPT).toContain("TIER SCALES AN ABILITY");
    expect(SYSTEM_PROMPT).toContain('("tier":"common".."divine")');
  });

  it("defines distinct caster and non-combat profession identities", () => {
    expect(SYSTEM_PROMPT).toContain("Wizard progression favors the widest arcane spellbook");
    expect(SYSTEM_PROMPT).toContain("Sorcerer progression favors a small number of signature spells enhanced by metamagic");
    expect(SYSTEM_PROMPT).toContain("Social, service, scholarship, and craft professions gain abilities useful in their own work");
  });

  it("leaves player specialization branches to the engine while allowing validated NPC hints", () => {
    expect(SYSTEM_PROMPT).toContain("A player's branch is an engine-owned choice");
    expect(SYSTEM_PROMPT).toContain("NEVER choose, infer, or silently change specializationPath or branchChoices for the player");
    expect(SYSTEM_PROMPT).toContain("Generated NPCs may include engine-validated specializationPath and branchChoices");
    expect(SYSTEM_PROMPT).toContain("Necromancy may later layer into Undead Lord, or into Death Magic");
  });
});
