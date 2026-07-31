import { describe, expect, it } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import { buildChatContextSections, estimateTokens, formatTokenCount } from "./chatContextModel.js";

describe("chat context preview model", () => {
  it("estimates tokens from content without returning empty negative values", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens(null)).toBe(0);
    expect(formatTokenCount(52900)).toBe("52.9k");
  });

  it("keeps preview sections ordered and reports a matching total", () => {
    const state = makeInitialState();
    state.memories = ["The north gate captain knows the party."];
    const preview = buildChatContextSections({
      state,
      beats: [
        { type: "player", content: "I wait by the gate." },
        { type: "narration", content: "The bells answer." },
      ],
      history: [{ role: "user", content: "I wait by the gate." }],
    });

    expect(preview.sections.map((section) => section.id)).toEqual([
      "system-prompt",
      "game-context",
      "conversation",
      "instructions",
      "game-state",
    ]);
    expect(preview.sections.every((section) => section.tokens >= 0)).toBe(true);
    expect(preview.total).toBe(preview.sections.reduce((sum, section) => sum + section.tokens, 0));
    expect(preview.sections.find((section) => section.id === "conversation").tokens).toBeGreaterThan(0);
  });
});
