import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AtlasPaperMap } from "./AtlasPaperMap.jsx";

describe("AtlasPaperMap", () => {
  it("leaves accessibility and pointer interaction to the existing atlas controls", () => {
    const html = renderToStaticMarkup(
      <AtlasPaperMap
        camera={{ x: 12, y: -8, zoom: 2 }}
        viewport={{ width: 960, height: 540 }}
        className="is-crossfading"
      />,
    );

    expect(html).toContain('class="world-atlas__paper-map is-crossfading"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-atlas-active="true"');
    expect(html).not.toContain("tabindex");
    expect(html).not.toContain("role=");
  });

  it("exposes whether its painterly pass is paused behind the 3D surface", () => {
    const html = renderToStaticMarkup(
      <AtlasPaperMap
        active={false}
        camera={{ x: 0, y: 0, zoom: 2 }}
        viewport={{ width: 390, height: 700 }}
      />,
    );

    expect(html).toContain('data-atlas-active="false"');
  });
});
