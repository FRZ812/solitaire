import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChatContextPreview } from "./ChatContextPreview.jsx";

const preview = {
  total: 14_200,
  deferredTokens: 38_700,
  availableSkills: [
    { id: "world-and-travel", label: "World & travel", trigger: "Travel, geography, regions, and destinations.", tokens: 6_200 },
  ],
  sections: [
    { id: "system", label: "Core prompt", description: "Compact narrator contract", content: "Core rules", tokens: 2_000, percent: 14, color: "#b667d8" },
    { id: "game", label: "Game context", description: "Location, party, quests, and discoveries", content: "Game state", tokens: 8_000, percent: 56, color: "#36b985" },
    { id: "history", label: "Recent story", description: "Recent player and narrator turns", content: "History", tokens: 4_200, percent: 30, color: "#d65c67" },
  ],
};

describe("ChatContextPreview", () => {
  it("renders a compact inline region and separates deferred skills from base context", () => {
    const html = renderToStaticMarkup(
      <ChatContextPreview preview={preview} activeModel="DeepSeek V4 Pro" onClose={() => {}} />,
    );

    expect(html).toContain("Narrator context");
    expect(html).toContain("Next turn context");
    expect(html).toContain("14.2k");
    expect(html).toContain("38.7k kept out of base context");
    expect(html).toContain("World &amp; travel");
    expect(html).toContain("DeepSeek V4 Pro");
    expect(html).toContain('id="chat-context-inspector"');
    expect(html).toContain('role="region"');
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('aria-modal="true"');
    expect(html).not.toContain("chat-context-preview-backdrop");
    expect(html).toContain("Core prompt");
    expect(html).toContain("Game context");
    expect(html).toContain("Recent story");

    expect(html).not.toContain("Pinned Files");
    expect(html).not.toContain("Partial Files");
    expect(html).not.toContain("Settings");
    expect(html).not.toContain("chat-context-preview__tabs");
  });
});
