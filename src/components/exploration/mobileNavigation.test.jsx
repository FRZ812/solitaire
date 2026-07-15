import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { makeInitialState } from "../../data/initial-state.js";
import { WorldExploration } from "./WorldExploration.jsx";

describe("mobile map navigation markup", () => {
  it("uses direct map selection and a dedicated encounter action on the world map", () => {
    const html = renderToStaticMarkup(
      <WorldExploration
        state={makeInitialState()}
        onClose={vi.fn()}
        onTravel={vi.fn()}
        onFly={vi.fn()}
        onTeleport={vi.fn()}
        onSeekCombat={vi.fn()}
        loading={false}
      />,
    );

    expect(html).toContain("Choose on the map");
    expect(html).toContain("Tap a tile");
    expect(html).toContain('aria-label="Look for trouble in the city"');
    expect(html).toContain('aria-label="Open world atlas"');
    expect(html).toContain('aria-label="Open quest journal"');
    expect(html).toContain("Whitemarch · unified city map");
    expect(html).not.toContain("Map cursor controls");
    expect(html).not.toContain("Choose a destination");
    expect(html).not.toContain("rpg-trail-choices");
  });

});
