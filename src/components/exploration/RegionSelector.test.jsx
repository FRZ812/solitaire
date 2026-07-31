import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { makeInitialState } from "../../data/initial-state.js";
import { RegionSelector } from "./RegionSelector.jsx";

describe("Witcher-style world region selector", () => {
  it("renders five large navigation regions without tactical map or POI detail", () => {
    const html = renderToStaticMarkup(
      <RegionSelector
        state={makeInitialState()}
        inspectedCoord={{ x: 0, y: 0 }}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="World region selector"');
    expect(html.match(/data-region-id=/g)).toHaveLength(5);
    expect(html).toContain('data-region-id="central"');
    expect(html).toContain('aria-current="location"');
    expect(html).toContain("Whitemarch Heartlands");
    expect(html).toContain("Current region");
    expect(html).toContain("Uncharted");
    expect(html).not.toContain("Northstar");
    expect(html).not.toContain("world-atlas");
    expect(html).not.toContain("map-canvas");
    expect(html).not.toContain("POI");
  });

  it("shows known macro detail after the realm has mapped knowledge", () => {
    const state = makeInitialState();
    state.world.seen["418,72"] = true;
    const html = renderToStaticMarkup(
      <RegionSelector
        state={state}
        inspectedCoord={{ x: 418, y: 72 }}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain('data-region-id="east"');
    expect(html).toContain("Tellmar");
    expect(html).toContain("The Hundred Banners");
    expect(html).toContain("Inspect Sea of Reeds hex map");
  });

  it("aligns every mobile region card from the same top and bottom anchors", () => {
    const css = readFileSync(new URL("./exploration.css", import.meta.url), "utf8");

    expect(css).toMatch(/\.region-selector__copy\s*\{[^}]*justify-content:\s*flex-start/s);
    expect(css).toMatch(/\.region-selector__header\s*\{[^}]*box-sizing:\s*border-box/s);
    expect(css).toMatch(/\.region-selector__copy\s*\{[^}]*box-sizing:\s*border-box/s);
    expect(css).toMatch(/\.region-selector__footer\s*\{[^}]*box-sizing:\s*border-box/s);
    expect(css).toMatch(/\.region-selector__copy > i\s*\{[^}]*margin-top:\s*auto/s);
    expect(css).toMatch(/\.region-selector__sigil\s*\{[^}]*width:\s*32px[^}]*height:\s*32px[^}]*place-items:\s*center/s);
    expect(css).toMatch(/@media \(max-width: 520px\)\s*\{[^}]*\.region-selector__footer\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
  });
});
