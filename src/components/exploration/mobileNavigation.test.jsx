import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { makeInitialState } from "../../data/initial-state.js";
import { AdventureFolio, MapLegend, WorldExploration } from "./WorldExploration.jsx";
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
    expect(html.match(/aria-label="Open world atlas"/g)).toHaveLength(1);
    expect(html).not.toContain('aria-label="Open quest journal"');
    expect(html).not.toContain('class="rpg-quickbar"');
    expect(html).toContain("Whitemarch · unified city map");
    expect(html).toContain(">Grain Square</h1>");
    expect(html).not.toContain("Whitemarch —");
    expect(html).toContain('class="rpg-map-corner-controls"');
    expect(html).toContain('aria-label="Open map legend"');
    expect(html).not.toContain('class="rpg-city-district-chip"');
    expect(html).not.toContain('class="rpg-poi-tier-legend"');
    expect(html).not.toContain("Map cursor controls");
    expect(html).not.toContain("Choose a destination");
    expect(html).not.toContain("rpg-trail-choices");
  });

  it("puts shop-tier and POI explanations in the browsable map legend", () => {
    const guide = renderToStaticMarkup(<MapLegend onClose={vi.fn()} />);
    const tiers = renderToStaticMarkup(<MapLegend onClose={vi.fn()} initialSection="tiers" />);
    const cityPois = renderToStaticMarkup(<MapLegend onClose={vi.fn()} initialSection="city" />);

    expect(guide).toContain("Choose a destination");
    expect(guide).toContain("cumulative chance of at least one encounter");
    expect(guide).toContain("The encounter button deliberately looks for a fight");
    expect(guide).toContain("Goods markers indicate wares");
    expect(guide).toContain("Services provide help");
    expect(guide).toContain("65%+");
    expect(tiers).toContain("Lettered rings on shop and service icons");
    expect(tiers).toContain("Budget house");
    expect(tiers).toContain("26% below standard");
    expect(tiers).toContain("Mastercraft house");
    expect(cityPois).toContain("Civic, social, and landmark venues");
    expect(cityPois).toContain('data-poi-icon="poi-palace"');
    expect(cityPois).toContain("Palace");
    expect(cityPois).toContain("Court, government offices, petitions, and royal business");
    expect(cityPois).toContain("Authority");
  });

  it("renders the interactive atlas in its dedicated folio panel", () => {
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
    expect(html).toContain('class="world-atlas is-tilted"');
    // The atlas is a full-bleed maps-app page: no hero banner, just floating
    // chrome with the journal switch and the close control.
    expect(html).toContain('class="rpg-folio-map-chrome"');
    expect(html).toContain("Quest journal");
    expect(html).toContain('aria-label="Close world atlas"');
    expect(html).not.toContain("rpg-folio-hero");
    expect(html).not.toContain("atlas-folio-hero-v1.png");
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
  });

});
