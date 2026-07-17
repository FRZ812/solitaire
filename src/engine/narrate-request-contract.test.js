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
