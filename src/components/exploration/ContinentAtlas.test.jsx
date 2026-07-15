import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CONTINENT, LANDMARKS, REGION_DEFINITIONS } from "../../data/continent.js";
import { makeInitialState } from "../../data/initial-state.js";
import { buildExplorationModel } from "./atlasModel.js";
import { CONTINENT_ATLAS_LANDMARKS, ContinentAtlas } from "./ContinentAtlas.jsx";

describe("continent atlas", () => {
  it("renders the finite seeded survey and only reviewed known landmark controls", () => {
    const state = makeInitialState();
    const html = renderToStaticMarkup(
      <ContinentAtlas state={state} origin={state.world.currentTile} onPick={vi.fn()} />,
    );

    expect(html).toContain(`>${CONTINENT.name}</h3>`);
    expect(html).toContain(`${CONTINENT.hexKilometers} km / hex`);
    expect(html.match(/class="continent-atlas__cell /g)).toHaveLength(48 * 26);
    expect(html.match(/class="continent-atlas__marker /g)).toHaveLength(CONTINENT_ATLAS_LANDMARKS.length);
    expect(html).toContain("Set compass for Whitemarch, known by reputation");
    expect(html).toContain(`${Object.keys(REGION_DEFINITIONS).length} named regions`);
    for (const landmark of LANDMARKS) expect(html).toContain(landmark.name);

    // Generated-site blueprints are intentionally retained only inside tiles;
    // the continental survey must not reveal their hidden identities.
    expect(html).not.toContain("site:");
    expect(html).not.toContain("HIDDEN AUTHORED SITE");

    const knownLandmarks = buildExplorationModel(state).landmarks.filter((landmark) => landmark.knownBy);
    expect(knownLandmarks).toHaveLength(LANDMARKS.length);
  });
});
