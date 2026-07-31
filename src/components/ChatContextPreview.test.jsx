import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChatContextPreview } from "./ChatContextPreview.jsx";

const preview = {
  total: 52_900,
  sections: [
    { id: "instructions", label: "World & narrator rules", description: "Narrator behavior and world rules", tokens: 26_000, percent: 49, color: "#5ca8e8" },
    { id: "campaign", label: "Campaign state", description: "Location, party, quests, and discoveries", tokens: 17_400, percent: 33, color: "#5fb88e" },
    { id: "history", label: "Recent story", description: "Recent player and narrator turns", tokens: 9_500, percent: 18, color: "#d65c67" },
  ],
};

describe("ChatContextPreview", () => {
  it("presents one focused context summary instead of dead settings and file tabs", () => {
    const html = renderToStaticMarkup(
      <ChatContextPreview preview={preview} activeModel="DeepSeek V4 Pro" onClose={() => {}} />,
    );

    expect(html).toContain("Narrator context");
    expect(html).toContain("What the narrator sees");
    expect(html).toContain("52.9k");
    expect(html).toContain("DeepSeek V4 Pro");
    expect(html).toContain('aria-label="Close context preview"');
    expect(html).toContain("World &amp; narrator rules");
    expect(html).toContain("Campaign state");
    expect(html).toContain("Recent story");

    expect(html).not.toContain("Pinned Files");
    expect(html).not.toContain("Partial Files");
    expect(html).not.toContain("Settings");
    expect(html).not.toContain("chat-context-preview__tabs");
  });
});
