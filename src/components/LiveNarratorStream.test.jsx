import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LiveNarratorStream } from "./LiveNarratorStream.jsx";

describe("LiveNarratorStream", () => {
  it("never renders uncompiled provider reasoning or partial story", () => {
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

    expect(html).toContain("The narrator is composing a validated response…");
    expect(html).not.toContain("Consider the consequence.");
    expect(html).not.toContain("The market falls quiet.");
    expect(html).not.toContain("Mira");
    expect(html).not.toContain("Stay close.");
    expect(html).not.toContain("A shutter closes across the square.");
  });
});
