import { describe, expect, it } from "vitest";
import { makeInitialState } from "../../data/initial-state.js";
import { buildWorldMapScene } from "./mapSceneModel.js";

const state = makeInitialState();

describe("browser exploration scene contract", () => {
  it("shows base terrain from the start without disclosing an unknown POI", () => {
    const model = {
      origin: { x: 0, y: 0 },
      current: { key: "0,0" },
      viewport: [
        { key: "0,0", x: 0, y: 0, col: 0, row: 0, seen: true, visible: true, visited: true, passable: true, current: true, tile: { terrain: "road" } },
        { key: "1,0", x: 1, y: 0, col: 1, row: 0, seen: false, visible: false, visited: false, passable: true, current: false, tile: { terrain: "water", poi: { name: "Secret Port" } } },
      ],
    };
    const scene = buildWorldMapScene({ model, selection: null, journey: null });
    expect(scene.cells[0]).toMatchObject({ explored: true, visible: true, visibility: "visible" });
    expect(scene.cells[1]).toMatchObject({ terrain: "water", explored: false, seen: false, visible: false, visibility: "unknown", interactive: false, poi_name: "", poi_icon: "", poi_market_tier: "" });
  });

  it("serializes render-only overscan without expanding the decision viewport", () => {
    const visible = { key: "0,0", x: 0, y: 0, col: 3, row: 3, seen: true, visible: true, visited: true, passable: true, current: true, tile: { terrain: "road" } };
    const overscan = { key: "-3,-3", x: -2, y: -3, col: 0, row: 0, seen: false, visible: false, visited: false, passable: true, current: false, overscan: true, tile: { terrain: "forest" } };
    const model = {
      origin: { x: 0, y: 0 },
      current: { key: "0,0" },
      viewport: [visible],
      renderViewport: [visible, overscan],
    };

    const scene = buildWorldMapScene({ model, selection: null, journey: null });

    expect(model.viewport).toHaveLength(1);
    expect(scene.cells).toHaveLength(2);
    expect(scene.cells[1]).toMatchObject({ key: "-3,-3", terrain: "forest", overscan: true, poi_name: "" });
  });

  it("renders mapped overscan POIs without making render-only cells selectable", () => {
    const visible = { key: "0,0", x: 0, y: 0, col: 3, row: 3, seen: true, visible: true, visited: true, passable: true, current: true, tile: { terrain: "road" } };
    const overscan = {
      key: "-3,-3", x: -2, y: -3, col: 0, row: 0,
      seen: true, visible: false, visited: true, passable: true, current: false, overscan: true,
      tile: { terrain: "forest", poi: { name: "Old Watchtower", type: "watchtower" } },
    };
    const scene = buildWorldMapScene({
      model: {
        origin: { x: 0, y: 0 },
        current: { key: "0,0" },
        viewport: [visible],
        renderViewport: [visible, overscan],
      },
      selection: null,
      journey: null,
    });

    expect(scene.cells[1]).toMatchObject({
      key: "-3,-3",
      overscan: true,
      poi_name: "Old Watchtower",
      interactive: false,
    });
  });

  it("serializes explicit service and wilderness marker identities for Canvas rendering", () => {
    const model = {
      origin: { x: 0, y: 0 },
      current: { key: "0,0" },
      viewport: [
        { key: "0,0", x: 0, y: 0, col: 0, row: 0, seen: true, visible: true, visited: true, passable: true, current: true, tile: { terrain: "settlement", poi: { name: "Great Stable", type: "stable", service: "stable", marketTier: "standard" } } },
        { key: "1,0", x: 1, y: 0, col: 1, row: 0, seen: true, visible: false, visited: false, passable: true, current: false, tile: { terrain: "forest", poi: { name: "Knifetooth Camp", type: "bandit-camp" } } },
      ],
    };
    const scene = buildWorldMapScene({ model, selection: null, journey: null });
    expect(scene.cells[0]).toMatchObject({ poi_name: "Great Stable", poi_icon: "trade-stable", poi_market_tier: "standard" });
    expect(scene.cells[1]).toMatchObject({ poi_name: "Knifetooth Camp", poi_icon: "wild-bandit-camp", poi_market_tier: "", visibility: "remembered" });
  });

  it("keeps a visited hex mapped even when an older sight record is incomplete", () => {
    const model = {
      origin: { x: 0, y: 0 },
      current: { key: "0,0" },
      viewport: [
        {
          key: "-1,0", x: -1, y: 0, col: 0, row: 0,
          seen: false, visible: false, visited: true, passable: true, current: false,
          tile: { terrain: "road", poi: { name: "Old Milepost", type: "landmark" } },
        },
      ],
    };

    const scene = buildWorldMapScene({ model, selection: null, journey: null });

    expect(scene.cells[0]).toMatchObject({
      terrain: "road",
      explored: true,
      seen: false,
      visible: false,
      visibility: "remembered",
      visited: true,
      interactive: true,
      poi_name: "Old Milepost",
    });
  });

  it("grades a generated site by how much of it the party can honestly claim", () => {
    const hidden = (key, x, distance, archetypeId, sighting) => ({
      key, x, y: 0, col: x, row: 0,
      seen: false, visible: false, visited: false, passable: true, current: false, distance,
      tile: {
        terrain: "plains",
        poi: { type: "hidden", name: null, generated: { name: "Falford", archetypeId, sighting } },
      },
    });
    const named = { range: 6, named: true, secret: false, mapIcon: "wild-village" };
    const unnamed = { range: 5, named: false, secret: false, mapIcon: "wild-ruin" };
    const secret = { range: 1, named: false, secret: true, mapIcon: "wild-bandit-camp" };
    const model = {
      origin: { x: 0, y: 0 },
      current: { key: "0,0" },
      viewport: [
        hidden("1,0", 1, 3, "settlement", named),
        hidden("2,0", 2, 3, "ruin", unnamed),
        hidden("3,0", 3, 9, "ruin", unnamed),
        hidden("4,0", 4, 1, "bandit-camp", secret),
      ],
    };

    const scene = buildWorldMapScene({ model, selection: null, journey: null });

    expect(scene.cells[0]).toMatchObject({ poi_knowledge: "rumoured", poi_name: "Falford", poi_icon: "wild-village" });
    // A shape at range is drawn but stays anonymous.
    expect(scene.cells[1]).toMatchObject({ poi_knowledge: "silhouette", poi_name: "", poi_icon: "wild-ruin" });
    expect(scene.cells[2]).toMatchObject({ poi_knowledge: "", poi_name: "", poi_icon: "" });
    expect(scene.cells[3]).toMatchObject({ poi_knowledge: "", poi_name: "", poi_icon: "" });
  });

  it("reports ambient scenery only for ground the party has mapped", () => {
    const cell = (key, seen) => ({
      key, x: 0, y: 0, col: 0, row: 0,
      seen, visible: false, visited: false, passable: true, current: false,
      tile: { terrain: "plains", scenery: [{ id: "s", kind: "hay-barn", label: "a hay barn", detail: "", tags: [] }] },
    });
    const scene = buildWorldMapScene({
      model: { origin: { x: 0, y: 0 }, current: { key: "0,0" }, viewport: [cell("1,0", true), cell("2,0", false)] },
      selection: null,
      journey: null,
    });

    expect(scene.cells[0].scenery).toEqual(["a hay barn"]);
    expect(scene.cells[1].scenery).toEqual([]);
  });

  it("never serializes an unknown route coordinate into the Canvas scene", () => {
    const model = {
      origin: { x: 0, y: 0 },
      current: { key: "0,0" },
      viewport: [
        { key: "0,0", x: 0, y: 0, seen: true, visible: true, visited: true, explored: true, tile: { terrain: "road" } },
        { key: "1,0", x: 1, y: 0, seen: true, visible: false, visited: false, explored: true, tile: { terrain: "road" } },
        { key: "2,0", x: 2, y: 0, seen: false, visible: false, visited: false, explored: false, tile: { terrain: "marsh" } },
      ],
    };
    const journey = { legPath: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] };

    const scene = buildWorldMapScene({ model, selection: null, journey });

    expect(scene.route).toEqual(["0,0", "1,0", null]);
    expect(JSON.stringify(scene.route)).not.toContain("2,0");
  });

  it("carries an in-flight party frame without changing the authoritative current hex", () => {
    const model = {
      origin: { x: 0, y: 0 },
      current: { key: "0,0" },
      viewport: [
        { key: "0,0", x: 0, y: 0, col: 0, row: 0, seen: true, visible: true, visited: true, passable: true, current: true, tile: { terrain: "road" } },
        { key: "1,0", x: 1, y: 0, col: 1, row: 0, seen: true, visible: true, visited: false, passable: true, current: false, tile: { terrain: "road" } },
      ],
    };
    const marchFrame = { fromKey: "0,0", toKey: "1,0", mix: 0.4, coord: { x: 0.4, y: 0 } };

    const scene = buildWorldMapScene({ model, selection: null, journey: null, marchFrame });

    expect(scene.current_key).toBe("0,0");
    expect(scene.party_march).toEqual(marchFrame);
  });

  it("carries only the public tracked-character lead into the renderer", () => {
    const model = {
      origin: { x: 0, y: 0 },
      current: { key: "0,0" },
      viewport: [],
    };
    const trackedCharacter = {
      id: "envoy",
      name: "Nadira",
      pos: { x: 4, y: -2, exact: false },
      character: { secret: "must not enter render data" },
    };

    const scene = buildWorldMapScene({ model, selection: null, journey: null, trackedCharacter });

    expect(scene.tracked_character).toEqual({
      id: "envoy",
      name: "Nadira",
      pos: { x: 4, y: -2 },
      exact: false,
      uncertainty_radius: expect.any(Number),
    });
    expect(scene.tracked_character.uncertainty_radius).toBeGreaterThanOrEqual(2);
    expect(scene.tracked_character.character).toBeUndefined();
  });

  it("does not draw an exact tracked position through unknown fog", () => {
    const model = {
      origin: { x: 0, y: 0 },
      current: { key: "0,0" },
      viewport: [
        { key: "4,-2", x: 4, y: -2, seen: false, visible: false, visited: false, explored: false, tile: { terrain: "forest" } },
      ],
    };

    const scene = buildWorldMapScene({
      model,
      selection: null,
      journey: null,
      trackedCharacter: { id: "envoy", name: "Nadira", pos: { x: 4, y: -2, exact: true } },
    });

    expect(scene.tracked_character).toBeNull();
  });
});

describe("scene layers across the zoom tiers", () => {
  const model = (stride) => ({
    origin: { x: 0, y: 0 },
    current: { key: "0,0" },
    stride,
    viewport: [
      { key: "0,0", x: 0, y: 0, col: 0, row: 0, seen: true, visible: true, visited: true, passable: true, current: true, tile: { terrain: "road" } },
    ],
  });

  it("reports the sampling stride and tier the renderer has to honour", () => {
    expect(buildWorldMapScene({ state, model: model(1), selection: null, journey: null }))
      .toMatchObject({ stride: 1, tier: "local" });
    expect(buildWorldMapScene({ state, model: model(2), selection: null, journey: null }))
      .toMatchObject({ stride: 2, tier: "region" });
    expect(buildWorldMapScene({ state, model: model(28), selection: null, journey: null }))
      .toMatchObject({ stride: 28, tier: "continent" });
  });

  it("swaps sampled hexes for authored geography once a road would break into dashes", () => {
    const local = buildWorldMapScene({ state, model: model(1), selection: null, journey: null });
    expect(local.ribbons).toEqual([]);
    expect(local.places).toEqual([]);

    const far = buildWorldMapScene({ state, model: model(28), selection: null, journey: null });
    expect(far.ribbons.length).toBeGreaterThan(0);
    expect(far.places.length).toBeGreaterThan(0);
    // Only the places that give the continent its shape survive this far out.
    expect(far.places.every((place) => place.major)).toBe(true);
    const region = buildWorldMapScene({ state, model: model(2), selection: null, journey: null });
    expect(region.places.length).toBeGreaterThan(far.places.length);
  });

  it("draws no authored places without a state to grade their knowledge against", () => {
    // Grading is what keeps an unvisited place from being presented as charted,
    // so a scene with nothing to grade against carries no places at all.
    const scene = buildWorldMapScene({ model: model(28), selection: null, journey: null });
    expect(scene.places).toEqual([]);
    expect(scene.ribbons.length).toBeGreaterThan(0);
  });
});
