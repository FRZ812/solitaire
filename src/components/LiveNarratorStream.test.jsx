import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LiveNarratorStream } from "./LiveNarratorStream.jsx";

describe("LiveNarratorStream", () => {
  it("shows reasoning and the player-facing answer at the same time", () => {
    const html = renderToStaticMarkup(
      <LiveNarratorStream
        thinking="Consider the consequence."
        narration="The market falls quiet."
        dialogues={[{ name: "Mira", line: "Stay close." }]}
      />,
    );

    expect(html).toContain("Thinking");
    expect(html).toContain("Consider the consequence.");
    expect(html).toContain("The market falls quiet.");
    expect(html).toContain("Mira · live");
    expect(html).toContain("Stay close.");
  });
});
