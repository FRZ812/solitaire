import { describe, expect, it } from "vitest";
import { CONTINENT, DEFAULT_WORLD_SEED, LANDMARKS, REGION_DEFINITIONS } from "../data/continent.js";
import {
  HANDCRAFTED,
  SEALED_STRUCTURES,
  applyMapData,
  compileDefaultWorldMap,
} from "../data/handcrafted-map.js";
import { buildHandcrafted } from "../data/handcrafted-pipeline.js";
import { makeInitialState } from "../data/initial-state.js";
import {
  WHITEMARCH_CAPITAL,
  compileWhitemarchCapital,
} from "../data/whitemarch-capital.js";
import { DEFAULT_NODES } from "../data/world-map-default.js";
import {
  edgeAllowed,
  findWorldRoute,
  getTile,
  HEX_DIRECTIONS,
  isPassable,
  isTeleportAnchor,
  travelMinutes,
  persistedTileDelta,
} from "./world.js";
import { sampleContinent } from "./world-generation.js";

function stateWithTiles(tiles) {
  return {
    world: {
      seed: DEFAULT_WORLD_SEED,
      currentTile: { x: 0, y: 0 },
      tiles,
      seen: Object.fromEntries(Object.keys(tiles).map((key) => [key, true])),
    },
  };
}

function coordKey(coord) {
  return `${coord.x},${coord.y}`;
}

function withCompiledCapital(run) {
  const previousTiles = JSON.parse(JSON.stringify(HANDCRAFTED));
  const previousStructures = JSON.parse(JSON.stringify(SEALED_STRUCTURES));
  const compiled = compileWhitemarchCapital();
  try {
    applyMapData(compiled.tiles, compiled.sealedStructures, { trusted: true });
    return run(compiled);
  } finally {
    applyMapData(previousTiles, previousStructures, { trusted: true });
  }
}

function generatedLandPair() {
  const center = REGION_DEFINITIONS["iron-plateau"].sites[0];
  const radius = 8;
  const { xmin, xmax, ymin, ymax } = CONTINENT.bounds;
  const suitable = (sample) => (
    sample.land
    && sample.terrain !== "water"
    && sample.terrain !== "impassable"
    && !sample.route
    && !sample.waterway
    && !sample.site
  );

  for (let y = Math.max(ymin, center.y - radius); y <= Math.min(ymax, center.y + radius); y++) {
    for (let x = Math.max(xmin, center.x - radius); x <= Math.min(xmax, center.x + radius); x++) {
      const fromSample = sampleContinent(x, y, DEFAULT_WORLD_SEED);
      if (!suitable(fromSample)) continue;
      for (const direction of HEX_DIRECTIONS) {
        const to = { x: x + direction.x, y: y + direction.y };
        if (to.x < xmin || to.x > xmax || to.y < ymin || to.y > ymax) continue;
        const toSample = sampleContinent(to.x, to.y, DEFAULT_WORLD_SEED);
        if (suitable(toSample)) {
          return { from: { x, y }, to, fromSample, toSample };
        }
      }
    }
  }

  throw new Error("Expected a deterministic adjacent generated-land pair near the Iron Plateau.");
}

describe("expedition route planning", () => {
  it("prices generated continental ground at expedition scale without slowing local cells", () => {
    const localRoad = { terrain: "road" };
    const continentalRoad = { terrain: "road", procedural: true };

    expect(travelMinutes(localRoad, localRoad)).toBe(8);
    expect(travelMinutes(continentalRoad, continentalRoad)).toBe(101);
    expect(travelMinutes(localRoad, continentalRoad)).toBe(101);
    expect(CONTINENT.footMinutesPerHex).toBeGreaterThanOrEqual(120);
  });

  it("reaches every named node in the default atlas, including outdoor endpoints", () => {
    const tiles = buildHandcrafted({ tiles: compileDefaultWorldMap(), sealedStructures: [] });
    const state = stateWithTiles(tiles);
    for (const node of DEFAULT_NODES) {
      const route = findWorldRoute(state, { x: 0, y: 0 }, node);
      expect(route, node.name).toBeTruthy();
      expect(route.at(-1)).toEqual({ x: node.x, y: node.y });
    }
  });

  it("follows a dogleg authored trail rather than greedily stalling", () => {
    // Keep this synthetic graph outside the bundled capital's authoritative
    // coordinate footprint so getTile resolves the fixture rather than a live
    // Whitemarch street at the same key.
    const coords = [[1000, 0], [1001, 0], [1001, -1], [1001, -2], [1002, -2], [1003, -2]];
    const tiles = Object.fromEntries(coords.map(([x, y], index) => [`${x},${y}`, {
      terrain: "road",
      doors: [coords[index - 1], coords[index + 1]].filter(Boolean).map(([dx, dy]) => ({ x: dx, y: dy })),
    }]));
    const route = findWorldRoute(stateWithTiles(tiles), { x: 1000, y: 0 }, { x: 1003, y: -2 });
    expect(route).toEqual(coords.map(([x, y]) => ({ x, y })));
  });

  it("does not cross an authored closed edge", () => {
    const tiles = {
      "1000,0": { terrain: "road", doors: [] },
      "1001,0": { terrain: "road", doors: [] },
    };
    expect(findWorldRoute(stateWithTiles(tiles), { x: 1000, y: 0 }, { x: 1001, y: 0 })).toBeNull();
  });

  it("opens a capital seam only on its declared edge and matching continental route", () => {
    const mouth = {
      terrain: "road",
      route: { id: "crown-road-east", kind: "capital-mouth" },
      routeMouth: { id: "east-mouth", routeId: "crown-road-east", gateId: "east-gate" },
      doors: [{ x: 1, y: 0 }],
    };
    const continental = (id) => ({ terrain: "road", procedural: true, route: { id } });

    expect(edgeAllowed(mouth, 0, 0, continental("crown-road-east"), 1, 0)).toBe(true);
    expect(edgeAllowed(mouth, 0, 0, continental("crown-road-east"), 0, 1)).toBe(false);
    expect(edgeAllowed(mouth, 0, 0, continental("south-road"), 1, 0)).toBe(false);
  });
});

describe("generated continent integration", () => {
  it("routes from Grain Square through a declared capital mouth to the continent", () => {
    withCompiledCapital(({ tiles }) => {
      const state = makeInitialState();
      const destination = LANDMARKS.find((landmark) => landmark.id === "mirecross").coord;
      const route = findWorldRoute(state, state.world.currentTile, destination);
      expect(route).toBeTruthy();
      if (!route) return;
      const mouthsByKey = new Map(WHITEMARCH_CAPITAL.routeMouths.map((mouth) => [coordKey(mouth.coord), mouth]));
      const mouthIndex = route.findIndex((point, index) => (
        mouthsByKey.has(coordKey(point))
        && index < route.length - 1
        && !tiles[coordKey(route[index + 1])]
      ));

      expect(state.world.currentTile).toEqual({ x: 0, y: 0 });
      expect(route?.[0]).toEqual(state.world.currentTile);
      expect(route?.at(-1)).toEqual(destination);
      expect(route.length).toBeGreaterThan(2);
      expect(mouthIndex).toBeGreaterThan(0);
      if (mouthIndex <= 0) return;

      const mouth = mouthsByKey.get(coordKey(route[mouthIndex]));
      expect(mouth).toBeTruthy();
      if (!mouth) return;
      const outside = route[mouthIndex + 1];
      expect(sampleContinent(outside.x, outside.y, DEFAULT_WORLD_SEED).route?.id).toBe(mouth.routeId);
      for (const point of route) expect(isPassable(getTile(state, point.x, point.y))).toBe(true);
    });
  });

  it("reaches the authored campaign goals at every continental extreme", () => {
    const state = makeInitialState();
    const destinationIds = [
      "brokenhold",
      "northstar-castle",
      "caer-selenya",
      "tellmar",
      "star-forge",
      "asalan",
      "sunken-crown",
    ];

    for (const id of destinationIds) {
      const destination = LANDMARKS.find((landmark) => landmark.id === id);
      const route = findWorldRoute(state, state.world.currentTile, destination.coord);
      expect(route?.[0], id).toEqual(state.world.currentTile);
      expect(route?.at(-1), id).toEqual(destination.coord);
    }
  });

  it("keeps impassable natural landmarks out of blind teleport anchors", () => {
    const state = makeInitialState();
    const blackTarn = LANDMARKS.find((landmark) => landmark.id === "black-tarn").coord;
    const mirecross = LANDMARKS.find((landmark) => landmark.id === "mirecross").coord;

    expect(isPassable(getTile(state, blackTarn.x, blackTarn.y))).toBe(false);
    expect(isTeleportAnchor(state, blackTarn.x, blackTarn.y)).toBe(false);
    expect(isTeleportAnchor(state, mirecross.x, mirecross.y)).toBe(true);
  });

  it("regenerates authored landmark identity instead of pinning it into save deltas", () => {
    const state = makeInitialState();
    const mirecross = LANDMARKS.find((landmark) => landmark.id === "mirecross");
    const key = `${mirecross.coord.x},${mirecross.coord.y}`;
    const canonical = getTile(state, mirecross.coord.x, mirecross.coord.y);
    const delta = persistedTileDelta(canonical);

    expect(canonical.authoredFeatureId).toBe(mirecross.id);
    expect(delta).not.toHaveProperty("poi");

    const restored = getTile({ ...state, world: { ...state.world, tiles: {
      ...state.world.tiles,
      [key]: { ...delta, poi: { type: "village", name: "Stale Mirecross" } },
    } } }, mirecross.coord.x, mirecross.coord.y);
    expect(restored.poi.name).toBe(mirecross.name);
    expect(restored.poi.landmarkId).toBe(mirecross.id);
  });

  it("treats discovered in-bounds generated land as traversable and routable", () => {
    const { from, to, fromSample, toSample } = generatedLandPair();
    const state = stateWithTiles({});
    const fromTile = getTile(state, from.x, from.y);
    const toTile = getTile(state, to.x, to.y);

    expect(fromSample.land).toBe(true);
    expect(toSample.land).toBe(true);
    expect(fromTile).toMatchObject({
      procedural: true,
      regionId: fromSample.regionId,
      ecology: fromSample.ecologyId,
      area: fromSample.area,
    });
    expect(toTile).toMatchObject({
      procedural: true,
      regionId: toSample.regionId,
      ecology: toSample.ecologyId,
      area: toSample.area,
    });
    expect(isPassable(fromTile)).toBe(true);
    expect(isPassable(toTile)).toBe(true);
    expect(findWorldRoute(state, from, to)).toEqual([from, to]);
  });

  it("rebases a compact persisted delta onto regenerated canonical tile metadata", () => {
    const { from } = generatedLandPair();
    const key = `${from.x},${from.y}`;
    const canonical = getTile(stateWithTiles({}), from.x, from.y);
    const dynamic = {
      status: { condition: "surveyed", note: "A cairn marks the safe descent." },
      shop: { sold: ["rope"], bucket: 3 },
      aerialSighting: { day: 12, kind: "gryphon" },
      cache: { opened: true, contents: [] },
    };
    const delta = persistedTileDelta(canonical, dynamic);

    expect(delta).toEqual({ proceduralDelta: true, visited: true, ...dynamic });
    for (const canonicalField of ["terrain", "regionId", "ecology", "area", "resources", "worldgen"]) {
      expect(delta).not.toHaveProperty(canonicalField);
    }

    const restored = getTile(stateWithTiles({ [key]: delta }), from.x, from.y);
    expect(restored).toMatchObject({ ...dynamic, procedural: true, visited: true });
    for (const canonicalField of [
      "terrain",
      "poi",
      "regionId",
      "ecology",
      "area",
      "route",
      "waterway",
      "crossing",
      "resources",
      "worldgen",
    ]) {
      expect(restored[canonicalField], canonicalField).toEqual(canonical[canonicalField]);
    }
  });

  it("keeps a full authored impassable override ahead of generated land", () => {
    const { from, to, toSample } = generatedLandPair();
    const key = `${to.x},${to.y}`;
    const generated = getTile(stateWithTiles({}), to.x, to.y);
    const authoredOverride = {
      terrain: "impassable",
      authored: true,
      poi: {
        type: "landmark",
        name: "The Sealed Scar",
        description: "An authored barrier over otherwise generated country.",
      },
    };
    const state = stateWithTiles({ [key]: authoredOverride });
    const resolved = getTile(state, to.x, to.y);

    expect(toSample.land).toBe(true);
    expect(generated.procedural).toBe(true);
    expect(isPassable(generated)).toBe(true);
    expect(resolved).toEqual(authoredOverride);
    expect(isPassable(resolved)).toBe(false);
    expect(findWorldRoute(state, from, to)).toBeNull();
  });
});
