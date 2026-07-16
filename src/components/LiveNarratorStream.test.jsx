import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LiveNarratorStream } from "./LiveNarratorStream.jsx";

describe("LiveNarratorStream", () => {
  it("shows reasoning and the player-facing answer at the same time", () => {
    const html = renderToStaticMarkup(
      <LiveNarratorStream
        thinking="Consider the consequence."
        story={[
          { type: "beat", text: "The market falls quiet." },
          { type: "dialogue", name: "Mira", line: "Stay close." },
          { type: "beat", text: "A shutter closes across the square." },
        ]}
      />,
    );

    expect(html).toContain("Thinking");
    expect(html).toContain("Consider the consequence.");
    expect(html).toContain("The market falls quiet.");
    expect(html).toContain("Mira · live");
    expect(html).toContain("Stay close.");
    expect(html).toContain("A shutter closes across the square.");
    expect(html.indexOf("The market falls quiet.")).toBeLessThan(html.indexOf("Stay close."));
    expect(html.indexOf("Stay close.")).toBeLessThan(html.indexOf("A shutter closes across the square."));
  });
});
