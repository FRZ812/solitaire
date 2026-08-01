import { describe, expect, it } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import { SYSTEM_PROMPT } from "../system-prompt.js";
import { NARRATOR_SKILLS } from "../narrator-instructions.js";
import { buildChatContextSections, estimateTokens, formatTokenCount } from "./chatContextModel.js";

describe("chat context preview model", () => {
  it("estimates tokens from content without returning empty negative values", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens(null)).toBe(0);
    expect(formatTokenCount(52900)).toBe("52.9k");
  });

  it("counts the real next-turn request once and keeps detailed skills deferred", () => {
    const state = makeInitialState();
    state.created = true;
    state.memories = ["The north gate captain knows the party."];
    state.apiHistory = [{ role: "user", content: "I wait by the gate." }];
    const preview = buildChatContextSections({
      state,
      draft: "I raise the lantern.",
    });

    expect(preview.sections.map((section) => section.id)).toEqual([
      "system",
      "tools",
      "game",
      "history",
      "action",
    ]);
    expect(preview.sections[0].content).toBe(SYSTEM_PROMPT);
    expect(preview.sections[0].tokens).toBeLessThanOrEqual(3_000);
    expect(preview.sections[1].content).toContain("load_narrator_skills");
    expect(preview.sections[2].content).toContain("[STATE —");
    expect(preview.sections[3].content).toContain("I wait by the gate.");
    expect(preview.sections[4].content).toContain("[PLAYER ACTION] I raise the lantern.");
    expect(preview.sections.map((section) => section.content).join("\n").match(/north gate captain/g)).toHaveLength(1);
    expect(preview.sections.every((section) => section.tokens >= 0)).toBe(true);
    expect(preview.total).toBe(preview.sections.reduce((sum, section) => sum + section.tokens, 0));
    expect(preview.availableSkills.map((skill) => skill.id)).toEqual(NARRATOR_SKILLS.map((skill) => skill.id));
    expect(preview.deferredTokens).toBe(
      preview.availableSkills.reduce((sum, skill) => sum + skill.tokens, 0),
    );
    expect(preview.deferredTokens).toBeGreaterThan(0);
  });
});
