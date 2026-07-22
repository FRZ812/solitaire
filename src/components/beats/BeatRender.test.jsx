import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BeatRender } from "./BeatRender.jsx";

describe("BeatRender", () => {
  it("keeps hold-enabled history without rendering a redundant ellipsis button", () => {
    const html = renderToStaticMarkup(
      <BeatRender beat={{ type: "narration", content: "The road bends east." }} onMenu={() => {}} />,
    );

    expect(html).toContain("beat-pressable");
    expect(html).not.toContain("beat-menu");
    expect(html).not.toContain("<button");
  });

  it("renders an explicit travel-halted card for a route encounter", () => {
    const html = renderToStaticMarkup(
      <BeatRender beat={{
        type: "travel_halt",
        location: "Briar Ford",
        encounterKind: "bandits",
        posture: "hostile",
        description: "Crossbows rise from the hedges.",
      }} />,
    );

    expect(html).toContain("Travel halted");
    expect(html).toContain("Briar Ford");
    expect(html).toContain("bandits · hostile");
    expect(html).toContain("Crossbows rise from the hedges.");
    expect(html).toContain("beat-system--danger");
  });
});
