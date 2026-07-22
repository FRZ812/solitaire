import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { makeInitialState } from "../../data/initial-state.js";
import { AdventureFolio, DestinationPanel, MapLegend, WorldExploration, nameForDestination } from "./WorldExploration.jsx";

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
    expect(html.match(/aria-label="Open region selector"/g)).toHaveLength(1);
    expect(html).not.toContain('aria-label="Open world atlas"');
    expect(html).toContain('aria-label="Open quest journal"');
    expect(html).not.toContain('class="rpg-quickbar"');
    expect(html).toContain("Whitemarch · unified city map");
    expect(html).toContain(">Grain Square</h1>");
    expect(html).not.toContain("Whitemarch —");
    expect(html).toContain('class="rpg-map-corner-controls"');
    expect(html).toContain('class="rpg-map-camera-controls"');
    expect(html).toContain('data-travel-map-zoom="1.00"');
    expect(html).toContain('aria-label="Zoom travel map in"');
    expect(html).toContain('aria-label="Zoom travel map out"');
    expect(html).toContain('aria-label="Return map camera to party"');
    expect(html).toContain('aria-label="Open map legend"');
    expect(html).not.toContain('class="rpg-city-district-chip"');
    expect(html).not.toContain('class="rpg-poi-tier-legend"');
    expect(html).not.toContain("Map cursor controls");
    expect(html).not.toContain("Choose a destination");
    expect(html).not.toContain("rpg-trail-choices");
  });

  it("locks dismissal and navigation layers while the canonical travel gate is active", () => {
    const state = makeInitialState();
    const html = renderToStaticMarkup(
      <WorldExploration
        state={state}
        onClose={vi.fn()}
        onTravel={vi.fn()}
        travelMarch={{
          id: "travel-lock-contract",
          path: [state.world.currentTile, { x: state.world.currentTile.x + 1, y: state.world.currentTile.y }],
          minutes: 8,
          visualDone: false,
        }}
        onTravelMarchFinish={vi.fn()}
        onFly={vi.fn()}
        onTeleport={vi.fn()}
        onSeekCombat={vi.fn()}
        loading={false}
      />,
    );

    expect(html).toContain('data-travel-locked="true"');
    expect(html).toContain('aria-label="Return to story unavailable while travel is in progress"');
    expect(html).toContain('aria-label="Quest journal unavailable while travel is in progress"');
    expect(html).toContain('aria-label="Region selector unavailable while travel is in progress"');
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(4);
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

  it("keeps the quest journal as the only folio overlay", () => {
    const state = makeInitialState();
    const html = renderToStaticMarkup(
      <AdventureFolio
        quests={[]}
        origin={state.world.currentTile}
        onClose={vi.fn()}
        onPick={vi.fn()}
      />,
    );

    expect(html).toContain('class="rpg-folio-hero rpg-folio-hero--quests"');
    expect(html).toContain('aria-label="Close quest journal"');
    expect(html).toContain("Quest Journal");
    expect(html).toContain("quest-journal-folio-hero-v1.png");
    expect(html).not.toContain("world-atlas");
    expect(html).not.toContain("World Atlas");
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain("atlas-folio-hero-v1.png");
  });

  it("does not derive an unseen destination name from canonical POI or terrain data", () => {
    const origin = { x: 0, y: 0 };
    const destination = {
      x: 8,
      y: -3,
      seen: false,
      visited: false,
      quest: { title: "The Missing Courier" },
      tile: { terrain: "marsh", poi: { name: "Secret Mire Temple", type: "temple" } },
    };

    expect(nameForDestination(destination, origin)).toBe("The Missing Courier");
    expect(nameForDestination({ ...destination, quest: null }, origin)).toBe("Uncharted destination");
  });

  it("does not render hidden endpoint or route metrics in the destination panel", () => {
    const state = makeInitialState();
    const origin = state.world.currentTile;
    const selection = {
      x: origin.x + 8,
      y: origin.y - 3,
      seen: false,
      visited: false,
      quest: { title: "The Missing Courier", rewardCp: 120 },
      tile: {
        terrain: "marsh",
        poi: { name: "Secret Mire Temple", description: "SECRET CANONICAL DESCRIPTION", marketTier: "S" },
      },
    };
    const html = renderToStaticMarkup(
      <DestinationPanel
        state={state}
        model={{ origin, current: { tile: state.world.tiles[`${origin.x},${origin.y}`] } }}
        selection={selection}
        selectedName="The Missing Courier"
        journey={{ legPath: [origin], legSteps: 0, totalSteps: null, arrived: false, terrainLabels: [], routeFullyMapped: false }}
        canGroundTravel
        routeMinutes={9_999}
        risk={99}
        focusBiome={{ name: "Whitemarch" }}
        focusVisual={{ image: "safe-current-biome.webp", accent: "#fff", mood: "Known map view" }}
        onClear={vi.fn()}
        onTravel={vi.fn()}
        canFly={false}
        teleOption={null}
        onFly={vi.fn()}
        onTeleport={vi.fn()}
        flightMount={null}
        flyPlan={{ totalCost: 0 }}
        resolve={10}
        loading={false}
      />,
    );

    expect(html).toContain("The mapped trail ends here");
    expect(html).toContain("uncharted route");
    expect(html).not.toContain("Secret Mire Temple");
    expect(html).not.toContain("SECRET CANONICAL DESCRIPTION");
    expect(html).not.toContain("Marsh");
    expect(html).not.toContain("99%");
    expect(html).not.toContain("6 d");
    expect(html).not.toContain("Shop tier");
  });

});
