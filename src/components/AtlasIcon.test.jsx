import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AtlasIcon, atlasBackgroundPosition } from "./AtlasIcon.jsx";

describe("AtlasIcon", () => {
  it("computes exact sprite positions, including single-cell axes", () => {
    expect(atlasBackgroundPosition(0, 1)).toBe("0%");
    expect(atlasBackgroundPosition(0, 3)).toBe("0%");
    expect(atlasBackgroundPosition(1, 3)).toBe("50%");
    expect(atlasBackgroundPosition(2, 3)).toBe("100%");
    expect(atlasBackgroundPosition(99, 3)).toBe("100%");
  });

  it("renders an informative, positioned round sprite", () => {
    const html = renderToStaticMarkup(
      <AtlasIcon
        src="/assets/equipment-atlas.png"
        columns={3}
        rows={2}
        column={2}
        row={1}
        size={48}
        label="Sword equipment"
        shape="round"
        className="equipment-icon"
      />,
    );

    expect(html).toContain('class="atlas-icon atlas-icon--round equipment-icon"');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Sword equipment"');
    expect(html).toContain('data-atlas-column="2"');
    expect(html).toContain('data-atlas-row="1"');
    expect(html).toContain("equipment-atlas.png");
    expect(html).toContain("--atlas-columns:3");
    expect(html).toContain("--atlas-rows:2");
    expect(html).toContain("--atlas-background-width:300%");
    expect(html).toContain("--atlas-background-height:200%");
    expect(html).toContain("--atlas-column-position:100%");
    expect(html).toContain("--atlas-row-position:100%");
    expect(html).toContain("--atlas-size:48px");
  });

  it("supports a decorative 3:4 portrait with a CSS size", () => {
    const html = renderToStaticMarkup(
      <AtlasIcon
        src="/assets/portrait-atlas.png"
        columns={1}
        rows={4}
        row={2}
        size="6rem"
        label="Ignored for decorative art"
        decorative
        shape="portrait"
      />,
    );

    expect(html).toContain('class="atlas-icon atlas-icon--portrait"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('role="img"');
    expect(html).not.toContain("aria-label=");
    expect(html).toContain('data-atlas-column="0"');
    expect(html).toContain('data-atlas-row="2"');
    expect(html).toContain("--atlas-column-position:0%");
    expect(html).toContain("--atlas-row-position:66.66666666666666%");
    expect(html).toContain("--atlas-size:6rem");
  });
});
