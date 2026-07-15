import { describe, expect, it } from "vitest";
import {
  CONTINENT,
  CONTINENT_ROUTES,
  CONTINENT_WATERWAYS,
  DEFAULT_WORLD_SEED,
  ECOLOGIES,
  LANDMARKS,
  REGION_DEFINITIONS,
  SITE_ARCHETYPES,
} from "../data/continent.js";
import { hexDist, hexLine } from "../data/hex-math.js";
import {
  continentValueAt,
  generateWorldTile,
  isInsideContinent,
  regionIdAt,
  routeAt,
  sampleContinent,
  waterwayAt,
  worldAreaAt,
} from "./world-generation.js";

const keyOf = ({ x, y }) => `${x},${y}`;

const FIXED_PROBES = [...new Map([
  CONTINENT.start.coord,
  ...Object.values(REGION_DEFINITIONS).flatMap((region) => region.sites),
  { x: -320, y: -210 },
  { x: 230, y: 180 },
  { x: 760, y: 0 },
].map(({ x, y }) => [`${x},${y}`, { x, y }])).values()];

function rasterize(waypoints) {
  const cells = [];
  for (let i = 1; i < waypoints.length; i++) {
    const segment = hexLine(waypoints[i - 1], waypoints[i]);
    cells.push(...(i === 1 ? segment : segment.slice(1)));
  }
  return cells;
}

function signatureFor(seed) {
  return FIXED_PROBES.map(({ x, y }) => {
    const sample = sampleContinent(x, y, seed);
    return [
      x,
      y,
      sample.land,
      sample.regionId,
      sample.ecologyId,
      sample.terrain,
      sample.landValue,
      sample.elevation,
      sample.moisture,
      sample.temperature,
      sample.site?.kind || null,
    ];
  });
}

function findGeneratedSite(center, radius, regionId) {
  for (let y = center.y - radius; y <= center.y + radius; y++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      const sample = sampleContinent(x, y, DEFAULT_WORLD_SEED);
      if (sample.regionId === regionId && sample.site) return { x, y, sample };
    }
  }
  return null;
}

describe("continental world generation", () => {
  it("is deterministic and JSON-stable for the same seed", () => {
    const first = signatureFor(DEFAULT_WORLD_SEED);
    const second = signatureFor(DEFAULT_WORLD_SEED);

    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });

  it("produces a materially different signature for a different seed", () => {
    const baseline = signatureFor(DEFAULT_WORLD_SEED);
    const alternate = signatureFor("avarra-another-age");

    expect(alternate).not.toEqual(baseline);
  });

  it("does not depend on coordinate query order", () => {
    const forward = new Map(FIXED_PROBES.map((point) => [
      keyOf(point),
      sampleContinent(point.x, point.y, DEFAULT_WORLD_SEED),
    ]));

    for (const point of [...FIXED_PROBES].reverse()) {
      expect(sampleContinent(point.x, point.y, DEFAULT_WORLD_SEED), keyOf(point))
        .toEqual(forward.get(keyOf(point)));
    }
  });

  it("has finite land and climate values and becomes ocean outside its declared bounds", () => {
    const { xmin, xmax, ymin, ymax } = CONTINENT.bounds;
    const probes = [
      CONTINENT.start.coord,
      { x: xmin, y: ymin },
      { x: xmax, y: ymax },
      { x: -800, y: 0 },
      { x: 800, y: 0 },
      { x: 0, y: -700 },
      { x: 0, y: 700 },
    ];

    expect(isInsideContinent(CONTINENT.start.coord.x, CONTINENT.start.coord.y)).toBe(true);
    for (const point of probes) {
      const sample = sampleContinent(point.x, point.y, DEFAULT_WORLD_SEED);
      for (const field of ["landValue", "elevation", "moisture", "temperature", "ruggedness"]) {
        expect(Number.isFinite(sample[field]), `${keyOf(point)} ${field}`).toBe(true);
      }
      expect(Number.isFinite(continentValueAt(point.x, point.y, DEFAULT_WORLD_SEED))).toBe(true);
    }

    const outsideEdges = [
      { x: xmin - 1, y: 0 },
      { x: xmax + 1, y: 0 },
      { x: 0, y: ymin - 1 },
      { x: 0, y: ymax + 1 },
    ];
    for (const point of outsideEdges) {
      expect(isInsideContinent(point.x, point.y, DEFAULT_WORLD_SEED), keyOf(point)).toBe(false);
      expect(sampleContinent(point.x, point.y, DEFAULT_WORLD_SEED).land, keyOf(point)).toBe(false);
      expect(generateWorldTile({ ...point, seed: DEFAULT_WORLD_SEED }).terrain, keyOf(point)).toBe("water");
    }
  });

  it("resolves every declared region site to that region and keeps the capital authoritative", () => {
    for (const [regionId, region] of Object.entries(REGION_DEFINITIONS)) {
      if (regionId === CONTINENT.start.regionId) continue;
      for (const site of region.sites) {
        expect(regionIdAt(site.x, site.y, DEFAULT_WORLD_SEED), `${regionId} at ${keyOf(site)}`)
          .toBe(regionId);
        expect(sampleContinent(site.x, site.y, DEFAULT_WORLD_SEED).land, `${regionId} authority site on land`)
          .toBe(true);
      }
    }

    const { coord } = CONTINENT.start;
    expect(regionIdAt(coord.x, coord.y, DEFAULT_WORLD_SEED)).toBe(CONTINENT.start.regionId);
    const { xmin, xmax, ymin, ymax } = REGION_DEFINITIONS.whitemarch.cityBounds;
    for (const point of [{ x: xmin, y: ymin }, { x: xmax, y: ymin }, { x: xmin, y: ymax }, { x: xmax, y: ymax }]) {
      expect(regionIdAt(point.x, point.y, DEFAULT_WORLD_SEED), keyOf(point)).toBe("whitemarch");
    }
    for (const landmark of LANDMARKS) {
      const sample = sampleContinent(landmark.coord.x, landmark.coord.y, DEFAULT_WORLD_SEED);
      expect(sample.land, landmark.id).toBe(true);
      expect(sample.regionId, landmark.id).toBe(landmark.regionId);
    }
  });

  it("rasterizes named routes into adjacent, land-based roads and river bridges", () => {
    for (const route of CONTINENT_ROUTES) {
      const cells = rasterize(route.waypoints);
      expect(cells.length, route.id).toBeGreaterThan(1);
      let cellsOwnedByRoute = 0;

      for (let i = 0; i < cells.length; i++) {
        const point = cells[i];
        const indexedRoute = routeAt(point.x, point.y);
        const sample = sampleContinent(point.x, point.y, DEFAULT_WORLD_SEED);

        if (i > 0) expect(hexDist(cells[i - 1], point), `${route.id} at ${keyOf(point)}`).toBe(1);
        expect(indexedRoute, `${route.id} at ${keyOf(point)}`).toBeTruthy();
        expect(sample.route, `${route.id} at ${keyOf(point)}`).toBeTruthy();
        expect(sample.land, `${route.id} at ${keyOf(point)}`).toBe(true);
        expect(sample.terrain, `${route.id} at ${keyOf(point)}`).toBe("road");
        if (indexedRoute?.id === route.id) cellsOwnedByRoute++;

        if (sample.waterway) expect(sample.crossing, `${route.id} at ${keyOf(point)}`).toBe(sample.waterway.kind);
        else expect(sample.crossing, `${route.id} at ${keyOf(point)}`).toBeNull();
      }

      // Shared junctions use the first indexed road, but every named road must
      // still own at least one unambiguous stretch of its route.
      expect(cellsOwnedByRoute, route.id).toBeGreaterThan(0);
    }
  });

  it("keeps authored waterways continuous, except where an authored road forms a crossing", () => {
    for (const waterway of CONTINENT_WATERWAYS) {
      const cells = rasterize(waterway.waypoints);
      let cellsOwnedByWaterway = 0;

      for (let i = 0; i < cells.length; i++) {
        const point = cells[i];
        const indexedWaterway = waterwayAt(point.x, point.y);
        const sample = sampleContinent(point.x, point.y, DEFAULT_WORLD_SEED);

        if (i > 0) expect(hexDist(cells[i - 1], point), `${waterway.id} at ${keyOf(point)}`).toBe(1);
        expect(indexedWaterway, `${waterway.id} at ${keyOf(point)}`).toBeTruthy();
        expect(sample.waterway, `${waterway.id} at ${keyOf(point)}`).toBeTruthy();
        if (indexedWaterway?.id === waterway.id) cellsOwnedByWaterway++;

        if (routeAt(point.x, point.y)) {
          expect(sample.terrain, `${waterway.id} bridge at ${keyOf(point)}`).toBe("road");
          expect(sample.crossing, `${waterway.id} bridge at ${keyOf(point)}`).toBe(indexedWaterway.kind);
        } else {
          expect(sample.terrain, `${waterway.id} at ${keyOf(point)}`).toBe("water");
          expect(sample.crossing, `${waterway.id} at ${keyOf(point)}`).toBeNull();
        }
      }

      // Confluences may be indexed under the first river, but not the whole run.
      expect(cellsOwnedByWaterway, waterway.id).toBeGreaterThan(0);
    }
  });

  it("exposes regional, ecological, and terrain diversity in a bounded continental sample", () => {
    const regions = new Set();
    const ecologies = new Set();
    const terrains = new Set();
    let landSamples = 0;

    for (let x = CONTINENT.bounds.xmin; x <= CONTINENT.bounds.xmax; x += 36) {
      for (let y = CONTINENT.bounds.ymin; y <= CONTINENT.bounds.ymax; y += 36) {
        const sample = sampleContinent(x, y, DEFAULT_WORLD_SEED);
        if (!isInsideContinent(x, y, DEFAULT_WORLD_SEED) || !sample.land) continue;
        landSamples++;
        regions.add(sample.regionId);
        ecologies.add(sample.ecologyId);
        terrains.add(sample.terrain);
        expect(REGION_DEFINITIONS[sample.regionId], sample.regionId).toBeTruthy();
        expect(ECOLOGIES[sample.ecologyId], sample.ecologyId).toBeTruthy();
      }
    }

    expect(landSamples).toBeGreaterThan(300);
    expect(regions.size).toBeGreaterThanOrEqual(12);
    expect(ecologies.size).toBeGreaterThanOrEqual(7);
    expect(terrains.size).toBeGreaterThanOrEqual(5);
  });

  it("keeps area identity stable within a chunk", () => {
    const first = worldAreaAt(1, 1, "mire", DEFAULT_WORLD_SEED);
    const sameChunk = worldAreaAt(CONTINENT.chunkSize - 1, CONTINENT.chunkSize - 1, "mire", DEFAULT_WORLD_SEED);
    const nextChunk = worldAreaAt(CONTINENT.chunkSize, 1, "mire", DEFAULT_WORLD_SEED);

    expect(sameChunk).toEqual(first);
    expect(first.chunk).toEqual({ x: 0, y: 0 });
    expect(first.regionId).toBe("mire");
    expect(nextChunk.chunk).toEqual({ x: 1, y: 0 });
    expect(nextChunk.id).not.toBe(first.id);
  });

  it("emits reviewed, serializable generated-site data when a bounded scan finds a site", () => {
    const center = REGION_DEFINITIONS.mire.sites[0];
    const found = findGeneratedSite(center, CONTINENT.chunkSize, "mire");
    const repeated = findGeneratedSite(center, CONTINENT.chunkSize, "mire");

    expect(found).toBeTruthy();
    expect(repeated).toEqual(found);
    const { x, y, sample } = found;
    const { site } = sample;
    const archetype = SITE_ARCHETYPES[site.archetypeId];
    const tile = generateWorldTile({ x, y, seed: DEFAULT_WORLD_SEED });

    expect(site.id).toBe(`site:${sample.generatorVersion}:${sample.regionId}:${x}:${y}`);
    expect(site.kind).toBeTruthy();
    expect(archetype).toBeTruthy();
    expect(archetype.id).toBe(site.archetypeId);
    expect(archetype.minimumSpacingHexes).toBeGreaterThanOrEqual(3);
    expect(site.poiType).toBe(archetype.poiType);
    expect(site.name).toBeTruthy();
    expect(site.description).toBe(archetype.description);
    expect(site.tags).toEqual(expect.arrayContaining(archetype.tags));
    expect(tile.poi).toMatchObject({
      type: "hidden",
      name: null,
      description: null,
      generated: {
        id: site.id,
        featureKind: site.kind,
        archetypeId: site.archetypeId,
        poiType: site.poiType,
        name: site.name,
        description: site.description,
      },
    });
    expect(tile.poi.generated.tags).toEqual(site.tags);
    expect(JSON.parse(JSON.stringify(tile))).toEqual(tile);
  });

  it("keeps generated sites at least three hexes apart without generation-order state", () => {
    const center = REGION_DEFINITIONS.mire.sites[0];
    const sites = [];
    for (let y = center.y - 24; y <= center.y + 24; y++) {
      for (let x = center.x - 24; x <= center.x + 24; x++) {
        if (sampleContinent(x, y, DEFAULT_WORLD_SEED).site) sites.push({ x, y });
      }
    }

    expect(sites.length).toBeGreaterThan(5);
    for (let i = 0; i < sites.length; i++) {
      for (let j = i + 1; j < sites.length; j++) {
        expect(hexDist(sites[i], sites[j]), `${keyOf(sites[i])} and ${keyOf(sites[j])}`).toBeGreaterThan(2);
      }
    }
  });

  it("returns fresh, serializable tiles without mutating its request", () => {
    const request = Object.freeze({ x: 82, y: 72, seed: DEFAULT_WORLD_SEED });
    const requestBefore = { ...request };
    const first = generateWorldTile(request);
    const second = generateWorldTile(request);

    expect(request).toEqual(requestBefore);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.resources).not.toBe(second.resources);
    expect(first.worldgen.tags).not.toBe(second.worldgen.tags);
    expect(first.area).not.toBe(second.area);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });
});
