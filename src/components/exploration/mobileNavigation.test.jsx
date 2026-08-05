import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { makeInitialState } from "../../data/initial-state.js";
import { getTile } from "../../engine/world.js";
import { AdventureFolio, DestinationPanel, MapLegend, WorldExploration, mergeOverviewDestination, nameForDestination } from "./WorldExploration.jsx";
import { buildAtlasPlaces } from "./mapAtlasModel.js";

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
    // One map, one camera: the atlas button pulls this map out rather than
    // opening a second, separately drawn one.
    expect(html.match(/aria-label="Pull the map out to the whole continent"/g)).toHaveLength(1);
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain('aria-label="Open world overview"');
    expect(html).not.toContain('aria-label="Open region selector"');
    expect(html).toContain('aria-label="Open quest journal"');
    expect(html).not.toContain('class="rpg-quickbar"');
    expect(html).toContain("Whitemarch · unified city map");
    expect(html).toContain(">Grain Square</h1>");
    expect(html).not.toContain("Whitemarch —");
    expect(html).toContain('class="rpg-map-corner-controls"');
    expect(html.match(/rpg-map-float-control/g)).toHaveLength(2);
    expect(html).toContain('class="rpg-map-float-control rpg-map-camera-control"');
    expect(html).toContain('class="rpg-map-float-control rpg-map-legend-toggle"');
    expect(html).not.toContain('data-travel-map-zoom=');
    expect(html).not.toContain('aria-label="Zoom travel map in"');
    expect(html).not.toContain('aria-label="Zoom travel map out"');
    expect(html).toContain('aria-label="Return map camera to party"');
    expect(html).not.toContain("Center map on tracked lead");
    expect(html).toContain('aria-label="Open map legend"');
    expect(html).not.toContain('class="rpg-city-district-chip"');
    expect(html).not.toContain('class="rpg-poi-tier-legend"');
    expect(html).not.toContain("Map cursor controls");
    expect(html).not.toContain("Choose a destination");
    expect(html).not.toContain("rpg-trail-choices");
  });

  it("keeps fly and teleport actions at least 44 CSS pixels tall", () => {
    const css = readFileSync(new URL("./exploration.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.rpg-magic-actions button\s*\{[^}]*min-height:\s*44px/s);
    expect(css).toMatch(/\.rpg-exploration-shell:not\(\.place-shell\) \.rpg-magic-actions button\s*\{[^}]*min-height:\s*44px/s);
  });

  it("uses mirrored mobile header rails and one shared anchor for map chrome", () => {
    const css = readFileSync(new URL("./exploration.css", import.meta.url), "utf8");

    expect(css).toMatch(/\.rpg-map-float-control\s*\{[^}]*top:\s*var\(--map-chrome-inset\)[^}]*min-height:\s*44px/s);
    expect(css).toMatch(/\.rpg-map-camera-control\s*\{[^}]*left:\s*var\(--map-chrome-inset\)/s);
    expect(css).toMatch(/\.rpg-map-legend-toggle\s*\{[^}]*right:\s*var\(--map-chrome-inset\)/s);
    expect(css).toMatch(/@media \(max-width: 819px\)\s*\{[^}]*\.rpg-exploration-shell:not\(\.place-shell\) > \.rpg-map-header\s*\{[^}]*grid-template-columns:\s*92px minmax\(0,\s*1fr\) 92px/s);
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
    expect(html).toContain('aria-label="World atlas unavailable while travel is in progress"');
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

  it("names a charted place by its name, and open ground by the quest sending you there", () => {
    const origin = { x: 0, y: 0 };
    const destination = {
      x: 8,
      y: -3,
      visited: false,
      quest: { title: "The Missing Courier" },
      tile: { terrain: "marsh", poi: { name: "Mirefoot Temple", type: "temple" } },
    };

    // A place with a name on the chart is called by it. The quest is flagged
    // beside it rather than standing in for where the party is actually going.
    expect(nameForDestination(destination, origin)).toBe("Mirefoot Temple");
    expect(nameForDestination({ ...destination, quest: null }, origin)).toBe("Mirefoot Temple");
    // Bare ground has nothing to be called, so the errand names it instead.
    expect(nameForDestination({ ...destination, tile: { terrain: "marsh" } }, origin))
      .toBe("The Missing Courier");
  });

  it("preserves the validated atlas handoff on the same map without moving the party", () => {
    const state = makeInitialState();
    const before = { ...state.world.currentTile };
    const starForge = buildAtlasPlaces(state).find((place) => place.id === "star-forge");
    // What the canvas hands back when an atlas place is picked at continental zoom.
    const handoff = { x: starForge.x, y: starForge.y, name: starForge.name, knownBy: starForge.knowledge, landmarkId: starForge.id };
    const local = {
      x: handoff.x,
      y: handoff.y,
      seen: false,
      visited: false,
      tile: getTile(state, handoff.x, handoff.y),
    };
    const destination = mergeOverviewDestination(local, handoff);

    expect(destination).toMatchObject({
      name: "The Star-Forge",
      knownBy: "legend",
      landmarkId: "star-forge",
    });
    expect(nameForDestination(destination, before)).toBe("The Star-Forge");
    expect(state.world.currentTile).toEqual(before);
  });

  it("does not derive a mapped hidden destination name from raw POI metadata", () => {
    const origin = { x: 0, y: 0 };
    const destination = {
      x: 2,
      y: 0,
      seen: true,
      visited: false,
      tile: {
        terrain: "forest",
        poi: { type: "hidden", name: "Secret Shrine", description: "SECRET", districtName: "Hidden Ward", marketTier: "royal" },
      },
    };
    expect(nameForDestination(destination, origin)).toBe("East Forest");
  });

  it("rejects malformed atlas disclosure capabilities instead of failing open", () => {
    const origin = { x: 0, y: 0 };
    const raw = {
      x: 90,
      y: 40,
      name: "LEAKED ATLAS NAME",
      knownBy: "raw-poi",
      landmarkId: "hidden-site",
      visited: false,
      tile: { terrain: "forest", poi: { name: "SECRET CANONICAL NAME", type: "hidden" } },
    };

    // An unrecognised disclosure grade buys nothing. A hidden site still gives
    // up neither the handoff's claimed name nor its own canonical one — it is
    // described by where it lies and what it stands on, and nothing more.
    const named = nameForDestination(raw, origin);
    expect(named).not.toContain("LEAKED ATLAS NAME");
    expect(named).not.toContain("SECRET CANONICAL NAME");
    expect(named).toContain("Forest");
    expect(mergeOverviewDestination({ x: raw.x, y: raw.y, tile: raw.tile }, raw))
      .not.toMatchObject({ name: raw.name, knownBy: raw.knownBy, landmarkId: raw.landmarkId });
  });

  it("hides mapped hidden destination details and tier metadata", () => {
    const state = makeInitialState();
    const origin = state.world.currentTile;
    const selection = {
      x: origin.x + 1,
      y: origin.y,
      seen: true,
      visited: true,
      tile: {
        terrain: "forest",
        poi: { type: "hidden", name: "Secret Shrine", description: "SECRET DESCRIPTION", districtName: "Hidden Ward", marketTier: "royal" },
      },
    };
    const html = renderToStaticMarkup(
      <DestinationPanel
        state={state}
        model={{ origin, current: { tile: {} } }}
        selection={selection}
        selectedName={nameForDestination(selection, origin)}
        journey={null}
        canGroundTravel
        routeMinutes={10}
        risk={0}
        focusBiome={{ name: "Whitemarch" }}
        focusVisual={{ image: "safe.webp", accent: "#fff", mood: "Known map view" }}
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
    expect(html).toContain("East Forest");
    expect(html).not.toContain("Secret Shrine");
    expect(html).not.toContain("SECRET DESCRIPTION");
    expect(html).not.toContain("Hidden Ward");
    expect(html).not.toContain("Shop tier");
  });

  it("presents the journey as the stages the march will actually be broken into", () => {
    const state = makeInitialState();
    const origin = state.world.currentTile;
    const selection = { x: origin.x + 6, y: origin.y, visited: true, tile: { terrain: "plains" } };
    const html = renderToStaticMarkup(
      <DestinationPanel
        state={state}
        model={{ origin, current: { tile: {} } }}
        selection={selection}
        selectedName="Farhollow"
        journey={{
          legPath: [origin, selection],
          legSteps: 6,
          totalSteps: 6,
          arrived: true,
          terrainLabels: [],
          legs: [
            { index: 0, steps: 4, minutes: 1200, nights: 2, arrived: false, boundaryKind: "limit", boundaryLabel: "Whitewend Ford", passed: ["a hay barn"] },
            { index: 1, steps: 2, minutes: 60, nights: 0, arrived: true, boundaryKind: "destination", boundaryLabel: "Farhollow", passed: [] },
          ],
        }}
        canGroundTravel
        routeMinutes={180}
        risk={12}
        focusBiome={{ name: "Whitemarch" }}
        focusVisual={{ image: "safe.webp", accent: "#fff", mood: "Known map view" }}
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

    expect(html).toContain("Whitewend Ford");
    expect(html).toContain("As far as one march is planned");
    expect(html).toContain("2 nights camped");
    expect(html).toContain("Passing a hay barn");
    expect(html).toContain('data-boundary="limit"');
    // The retired pace control leaves nothing behind to set. What ends a march
    // is the road and the party's own state, and the panel says so.
    expect(html).not.toContain("rpg-pace-picker");
    expect(html).not.toContain("Forced");
    expect(html).not.toContain("Careful");
    expect(html).toContain("until something real stops them");
  });

  it("keeps a hidden endpoint's own record sealed even with the map fully charted", () => {
    // Position is charted; the record is not. A site the party has never walked
    // into gives up neither its canonical name, its description, nor its trade.
    const state = makeInitialState();
    const origin = state.world.currentTile;
    const selection = {
      x: origin.x + 8,
      y: origin.y - 3,
      visited: false,
      quest: { title: "The Missing Courier", rewardCp: 120 },
      tile: {
        terrain: "marsh",
        poi: {
          type: "hidden",
          name: "Secret Mire Temple",
          description: "SECRET CANONICAL DESCRIPTION",
          marketTier: "S",
        },
      },
    };
    const html = renderToStaticMarkup(
      <DestinationPanel
        state={state}
        model={{ origin, current: { tile: state.world.tiles[`${origin.x},${origin.y}`] } }}
        selection={selection}
        selectedName="The Missing Courier"
        journey={{ legPath: [origin], legSteps: 0, totalSteps: 0, arrived: false, terrainLabels: [], legs: [] }}
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

    expect(html).not.toContain("Secret Mire Temple");
    expect(html).not.toContain("SECRET CANONICAL DESCRIPTION");
    expect(html).not.toContain("Shop tier");
  });

});
