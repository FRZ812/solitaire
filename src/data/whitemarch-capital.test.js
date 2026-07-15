import { describe, expect, it } from "vitest";
import { BUILDINGS } from "./town.js";
import {
  HANDCRAFTED,
  SEALED_STRUCTURES,
  applyMapData,
} from "./handcrafted-map.js";
import { makeInitialState } from "./initial-state.js";
import { sampleContinent } from "../engine/world-generation.js";
import { currentLocationName } from "../engine/world.js";
import {
  WHITEMARCH_CAPITAL,
  WHITEMARCH_LANDMARKS,
  WHITEMARCH_MAP_VERSION,
  compileWhitemarchCapital,
} from "./whitemarch-capital.js";

const HEX_DIRECTIONS = [
  { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: -1 },
  { x: -1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: 1 },
];

const SUPPORTED_SERVICE_KINDS = new Set([
  "trader", "smith", "tavern", "gaol", "slavemarket", "stable",
]);

const EXPECTED_CAPITAL_COUNTS = Object.freeze({
  tiles: 469,
  namedPois: 60,
  districts: 12,
  serviceTiles: 22,
  gates: 6,
  routeMouths: 6,
});

function coordKey(coord) {
  return `${coord.x},${coord.y}`;
}

function parseCoord(key) {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

function hexDistance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return (Math.abs(dx) + Math.abs(dy) + Math.abs(dx + dy)) / 2;
}

function permits(tile, destination) {
  return !Array.isArray(tile?.doors)
    || tile.doors.some((door) => door.x === destination.x && door.y === destination.y);
}

function isPassable(tile) {
  return !!tile && tile.terrain !== "water" && tile.terrain !== "impassable";
}

function districtId(entry) {
  return typeof entry === "string" ? entry : entry?.id;
}

function districtName(entry) {
  return typeof entry === "string" ? entry : entry?.name;
}

function routeId(entry) {
  return entry?.routeId || entry?.route || entry?.id || null;
}

function atlasLandmark(tile) {
  return tile?.atlasLandmark || tile?.poi?.atlasLandmark || null;
}

function reachableKeys(tiles, start) {
  const startKey = coordKey(start);
  const reached = new Set();
  if (!isPassable(tiles[startKey])) return reached;
  reached.add(startKey);
  const queue = [start];

  while (queue.length) {
    const current = queue.shift();
    const currentKey = coordKey(current);
    const currentTile = tiles[currentKey];
    for (const direction of HEX_DIRECTIONS) {
      const next = { x: current.x + direction.x, y: current.y + direction.y };
      const nextKey = coordKey(next);
      const nextTile = tiles[nextKey];
      if (reached.has(nextKey) || !isPassable(nextTile)) continue;
      if (!permits(currentTile, next) || !permits(nextTile, current)) continue;
      reached.add(nextKey);
      queue.push(next);
    }
  }
  return reached;
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

describe("Whitemarch unified-capital compiler", () => {
  it("is a deterministic versioned compile with independent output objects", () => {
    const first = compileWhitemarchCapital();
    const second = compileWhitemarchCapital();

    expect(WHITEMARCH_MAP_VERSION).toBe(2);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.tiles).not.toBe(second.tiles);
    expect(Array.isArray(first.sealedStructures)).toBe(true);

    first.tiles["0,0"].terrain = "impassable";
    expect(second.tiles["0,0"].terrain).not.toBe("impassable");
  });

  it("ships an expansive, metadata-complete capital instead of a single atlas node", () => {
    const { tiles } = compileWhitemarchCapital();
    const entries = Object.entries(tiles);
    const namedPois = entries.filter(([, tile]) => tile.poi?.name);
    const serviceTiles = entries.filter(([, tile]) => tile.poi?.service);
    const uniqueServices = new Set(serviceTiles.map(([, tile]) => tile.poi.service));
    const districts = new Map((WHITEMARCH_CAPITAL.districts || []).map((entry) => [districtId(entry), districtName(entry)]));
    const { xmin, xmax, ymin, ymax } = WHITEMARCH_CAPITAL.bounds;

    expect(entries).toHaveLength(EXPECTED_CAPITAL_COUNTS.tiles);
    expect(namedPois).toHaveLength(EXPECTED_CAPITAL_COUNTS.namedPois);
    expect(districts.size).toBe(EXPECTED_CAPITAL_COUNTS.districts);
    expect(serviceTiles).toHaveLength(EXPECTED_CAPITAL_COUNTS.serviceTiles);
    expect(uniqueServices.size).toBeGreaterThanOrEqual(6);
    expect(WHITEMARCH_LANDMARKS).toHaveLength(EXPECTED_CAPITAL_COUNTS.namedPois);

    for (const [key, tile] of entries) {
      const coord = parseCoord(key);
      expect(Number.isInteger(coord.x), key).toBe(true);
      expect(Number.isInteger(coord.y), key).toBe(true);
      expect(coord.x, key).toBeGreaterThanOrEqual(xmin);
      expect(coord.x, key).toBeLessThanOrEqual(xmax);
      expect(coord.y, key).toBeGreaterThanOrEqual(ymin);
      expect(coord.y, key).toBeLessThanOrEqual(ymax);
      expect(tile.cityId, key).toBe(WHITEMARCH_CAPITAL.id);
      expect(tile.regionId, key).toBe(WHITEMARCH_CAPITAL.regionId);
      expect(tile.mapVersion, key).toBe(WHITEMARCH_MAP_VERSION);
      expect(districts.has(tile.districtId), `${key}: ${tile.districtId}`).toBe(true);
      expect(tile.districtName, key).toBe(districts.get(tile.districtId));
    }

    for (const [key, tile] of namedPois) {
      expect(tile.poi.description?.trim().length, key).toBeGreaterThan(20);
    }
  });

  it("anchors Grain Square at 0,0 as the sole top-level capital landmark", () => {
    const { tiles } = compileWhitemarchCapital();
    const start = WHITEMARCH_CAPITAL.start;
    const startTile = tiles[coordKey(start)];
    const topLevel = Object.entries(tiles).filter(([, tile]) => atlasLandmark(tile));

    expect(start).toMatchObject({ x: 0, y: 0, part: "grain-square" });
    expect(startTile).toMatchObject({
      cityId: WHITEMARCH_CAPITAL.id,
      terrain: "settlement",
      poi: {
        part: "grain-square",
        service: "market",
      },
    });
    expect(topLevel).toHaveLength(1);
    expect(topLevel[0][0]).toBe("0,0");
  });

  it("wires every service to a building kind the current UI can actually open", () => {
    const { tiles } = compileWhitemarchCapital();
    const serviceTiles = Object.entries(tiles).filter(([, tile]) => tile.poi?.service);

    for (const [key, tile] of serviceTiles) {
      const service = tile.poi.service;
      const building = BUILDINGS[service];
      expect(building, `${key}: missing BUILDINGS.${service}`).toBeTruthy();
      expect(SUPPORTED_SERVICE_KINDS.has(building.kind), `${key}: unsupported ${service}/${building.kind}`).toBe(true);
    }
  });

  it("authors the Whitewend as recognizable water with a named crossing", () => {
    const { tiles } = compileWhitemarchCapital();
    const entries = Object.entries(tiles);
    const water = entries.filter(([, tile]) => tile.terrain === "water");
    const namedWhitewend = water.filter(([, tile]) => (
      /whitewend/i.test(tile.waterway?.name || tile.poi?.name || tile.poi?.description || "")
      || tile.waterway?.id === "whitewend"
    ));
    const namedCrossings = entries.filter(([key, tile]) => {
      if (!tile.poi?.name) return false;
      if (!/bridge|crossing|ferry/i.test(`${tile.poi.type || ""} ${tile.poi.part || ""} ${tile.poi.name}`)) return false;
      const coord = parseCoord(key);
      return !!tile.crossing || HEX_DIRECTIONS.some((direction) => (
        tiles[coordKey({ x: coord.x + direction.x, y: coord.y + direction.y })]?.terrain === "water"
      ));
    });

    expect(water.length).toBeGreaterThanOrEqual(6);
    expect(namedWhitewend.length).toBeGreaterThan(0);
    expect(namedCrossings.length).toBeGreaterThan(0);
  });

  it("joins both authored Whitewend tails to the procedural river", () => {
    const { tiles } = compileWhitemarchCapital();
    const seams = [
      { inside: { x: 12, y: -12 }, outside: { x: 12, y: -13 } },
      { inside: { x: 12, y: 0 }, outside: { x: 12, y: 1 } },
    ];

    for (const { inside, outside } of seams) {
      expect(tiles[coordKey(inside)]).toMatchObject({
        terrain: "water",
        waterway: { id: "whitewend" },
      });
      expect(hexDistance(inside, outside)).toBe(1);
      expect(sampleContinent(outside.x, outside.y).waterway?.id).toBe("whitewend");
      expect(sampleContinent(outside.x, outside.y).terrain).toBe("water");
    }
  });

  it("gives at least one reachable service an authored entrance instead of open-pavement edges", () => {
    withCompiledCapital(() => {
      // Assert against the applied singleton, not merely raw compiler output:
      // the handcrafted pipeline must preserve the authored doorway too.
      const reached = reachableKeys(HANDCRAFTED, WHITEMARCH_CAPITAL.start);
      const serviceEntrances = Object.entries(HANDCRAFTED).filter(([key, tile]) => {
        if (tile.cityId !== WHITEMARCH_CAPITAL.id) return false;
        if (!tile.poi?.service || !reached.has(key) || !Array.isArray(tile.doors)) return false;
        const coord = parseCoord(key);
        const adjacentPassable = HEX_DIRECTIONS
          .map((direction) => ({ x: coord.x + direction.x, y: coord.y + direction.y }))
          .filter((neighbor) => isPassable(HANDCRAFTED[coordKey(neighbor)]));
        return tile.doors.length > 0 && tile.doors.length < adjacentPassable.length;
      });

      expect(serviceEntrances.length).toBeGreaterThan(0);
    });
  });

  it("uses only adjacent reciprocal doors, except declared procedural route seams", () => {
    const { tiles } = compileWhitemarchCapital();
    const mouthsByKey = new Map();
    for (const mouth of WHITEMARCH_CAPITAL.routeMouths || []) {
      expect(mouth.coord, `route mouth ${routeId(mouth)} missing coordinate`).toBeTruthy();
      mouthsByKey.set(coordKey(mouth.coord), mouth);
    }

    for (const [key, tile] of Object.entries(tiles)) {
      expect(Array.isArray(tile.doors), `${key}: authored capital tiles must control their edges`).toBe(true);
      const from = parseCoord(key);
      const unique = new Set();
      for (const door of tile.doors) {
        const targetKey = coordKey(door);
        expect(Number.isInteger(door.x), `${key}>${targetKey}`).toBe(true);
        expect(Number.isInteger(door.y), `${key}>${targetKey}`).toBe(true);
        expect(hexDistance(from, door), `${key}>${targetKey}`).toBe(1);
        expect(unique.has(targetKey), `${key}: duplicate door ${targetKey}`).toBe(false);
        unique.add(targetKey);

        const target = tiles[targetKey];
        if (!target) {
          const mouth = mouthsByKey.get(key);
          expect(mouth, `${key}>${targetKey}: undeclared external edge`).toBeTruthy();
          expect(sampleContinent(door.x, door.y).route?.id, `${key}>${targetKey}`).toBe(mouth.routeId);
          continue;
        }
        expect(permits(target, from), `${key}>${targetKey}: target does not reciprocate`).toBe(true);
      }
    }
  });

  it("seals the wall everywhere except declared gate connections", () => {
    const { tiles } = compileWhitemarchCapital();
    const gateKeys = new Set();
    for (const gate of WHITEMARCH_CAPITAL.gates || []) {
      expect(gate.coord, gate.id).toBeTruthy();
      gateKeys.add(coordKey(gate.coord));
    }

    expect(gateKeys.size).toBe(EXPECTED_CAPITAL_COUNTS.gates);
    for (const [key, tile] of Object.entries(tiles)) {
      if (tile.terrain !== "wall") continue;
      expect(Array.isArray(tile.doors), key).toBe(true);
      for (const door of tile.doors) {
        const targetKey = coordKey(door);
        const target = tiles[targetKey];
        if (!target || target.terrain === "wall") continue;
        const declared = gateKeys.has(key) || gateKeys.has(targetKey);
        expect(declared, `${key}>${targetKey}: undeclared wall breach`).toBe(true);
      }
    }
  });

  it("reaches every public named POI and every service from Grain Square", () => {
    const { tiles } = compileWhitemarchCapital();
    const reached = reachableKeys(tiles, WHITEMARCH_CAPITAL.start);
    const required = Object.entries(tiles).filter(([, tile]) => (
      tile.poi?.service
      || (tile.poi?.name && (tile.poi.access || "public") === "public")
    ));

    expect(reached.size).toBeGreaterThan(EXPECTED_CAPITAL_COUNTS.tiles / 2);
    for (const [key, tile] of required) {
      expect(reached.has(key), `${key}: ${tile.poi.partName || tile.poi.name || tile.poi.service}`).toBe(true);
    }
  });

  it("declares reachable mouths that continue onto generated macro-route cells", () => {
    const { tiles } = compileWhitemarchCapital();
    const reached = reachableKeys(tiles, WHITEMARCH_CAPITAL.start);
    const mouths = WHITEMARCH_CAPITAL.routeMouths || [];
    const gateIds = new Set((WHITEMARCH_CAPITAL.gates || []).map((gate) => gate.id));

    expect(mouths).toHaveLength(EXPECTED_CAPITAL_COUNTS.routeMouths);
    for (const mouth of mouths) {
      const inside = mouth.coord;
      const expectedRouteId = routeId(mouth);
      const insideTile = tiles[coordKey(inside)];
      const externalDoors = insideTile?.doors?.filter((door) => !tiles[coordKey(door)]) || [];

      expect(insideTile, expectedRouteId).toBeTruthy();
      expect(reached.has(coordKey(inside)), expectedRouteId).toBe(true);
      expect(gateIds.has(mouth.gateId), mouth.id).toBe(true);
      expect(insideTile.routeMouth, mouth.id).toMatchObject({
        id: mouth.id,
        routeId: expectedRouteId,
        gateId: mouth.gateId,
      });
      expect(insideTile.route, mouth.id).toMatchObject({ id: expectedRouteId, kind: "capital-mouth" });
      expect(externalDoors.length, `${expectedRouteId}: no external route edge`).toBeGreaterThan(0);
      for (const outside of externalDoors) {
        expect(hexDistance(inside, outside), expectedRouteId).toBe(1);
        expect(sampleContinent(outside.x, outside.y).route?.id, expectedRouteId).toBe(expectedRouteId);
      }
    }
  });

  it("starts a fresh unified campaign at the compiled Grain Square tile", () => {
    withCompiledCapital(() => {
      const state = makeInitialState();
      const startKey = coordKey(WHITEMARCH_CAPITAL.start);

      expect(state.world.currentTile).toEqual({ x: 0, y: 0 });
      expect(state.world).not.toHaveProperty("place");
      expect(state.world.tiles[startKey]).toMatchObject({
        cityId: WHITEMARCH_CAPITAL.id,
        poi: { part: "grain-square", service: "market" },
      });
      expect(state.world.seen[startKey]).toBe(true);
      const location = currentLocationName(state);
      expect(location).toContain("Whitemarch");
      expect(location).toContain(state.world.tiles[startKey].districtName);
      expect(location).toMatch(/Grain Square/i);
    });
  });
});
