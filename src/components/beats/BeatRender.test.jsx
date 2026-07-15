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
});
