import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { makeInitialState } from "../../data/initial-state.js";
import { AdventureFolio, WorldExploration } from "./WorldExploration.jsx";
import { buildExplorationModel } from "./atlasModel.js";

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
    expect(html).toContain('class="rpg-map-corner-controls"');
    expect(html).toContain('class="rpg-city-district-chip"');
    expect(html).not.toContain("Map cursor controls");
    expect(html).not.toContain("Choose a destination");
    expect(html).not.toContain("rpg-trail-choices");
  });

  it("gives the atlas a dedicated scrolling panel and only one parchment map background", () => {
    const state = makeInitialState();
    const model = buildExplorationModel(state);
    const html = renderToStaticMarkup(
      <AdventureFolio
        state={state}
        page="atlas"
        quests={[]}
        landmarks={model.landmarks}
        origin={state.world.currentTile}
        onPage={vi.fn()}
        onClose={vi.fn()}
        onPick={vi.fn()}
      />,
    );

    expect(html).toContain('class="rpg-folio-body rpg-folio-body--atlas"');
    expect(html.match(/world-atlas-spread-v1\.jpg/g)).toHaveLength(1);
    expect(html).toContain("atlas-folio-hero-v1.png");
    expect(html).not.toContain("quest-journal-folio-hero-v1.png");
    expect(html).not.toContain("--folio-art");
  });

  it("uses separate generated art for the quest journal folio", () => {
    const state = makeInitialState();
    const model = buildExplorationModel(state);
    const html = renderToStaticMarkup(
      <AdventureFolio
        state={state}
        page="quests"
        quests={[]}
        landmarks={model.landmarks}
        origin={state.world.currentTile}
        onPage={vi.fn()}
        onClose={vi.fn()}
        onPick={vi.fn()}
      />,
    );

    expect(html).toContain('class="rpg-folio-hero rpg-folio-hero--quests"');
    expect(html).toContain("quest-journal-folio-hero-v1.png");
    expect(html).not.toContain("atlas-folio-hero-v1.png");
    expect(html).not.toContain("world-atlas-spread-v1.jpg");
  });

});
