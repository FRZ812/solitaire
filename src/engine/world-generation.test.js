import { describe, expect, it } from "vitest";
import * as continentContent from "../data/continent.js";
import {
  BORDER_CHECKPOINTS,
  COASTAL_FEATURES,
  CONTINENT,
  CONTINENT_ROUTES,
  CONTINENT_WATERWAYS,
  DEFAULT_WORLD_SEED,
  ECOLOGIES,
  LANDMARKS,
  MOUNTAIN_SPINE,
  PROVINCES,
  PROVINCE_BY_ID,
  REALM_CULTURES,
  REALM_DEFINITIONS,
  REALM_ECONOMIES,
  REALM_FACTIONS,
  REALMS,
  REGION_DEFINITIONS,
  SITE_ARCHETYPES,
} from "../data/continent.js";
import { hexDist, hexLine } from "../data/hex-math.js";
import {
  checkpointAt,
  continentValueAt,
  generateWorldTile,
  isInsideContinent,
  provinceAt,
  realmIdAt,
  regionIdAt,
  routeAt,
  sampleContinent,
  seaLaneAt,
  waterwayAt,
  worldAreaAt,
} from "./world-generation.js";

const CONTINENT_SEA_LANES = continentContent.CONTINENT_SEA_LANES || [];

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
      sample.realmId,
      sample.province?.id || null,
      sample.regionId,
      sample.ecologyId,
      sample.terrain,
      sample.landValue,
      sample.elevation,
      sample.moisture,
      sample.temperature,
      sample.area.settlementType,
      sample.area.encounter.id,
      sample.area.travelHazard.id,
      sample.content.context.kind,
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

function valuesOf(collection) {
  return Array.isArray(collection) ? collection : Object.values(collection || {});
}

function findGeneratedSiteInRealm(realm, maximumRadius = 90) {
  const center = realm.center;
  for (let radius = 0; radius <= maximumRadius; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const edgePoints = radius === 0
        ? [{ x: center.x, y: center.y }]
        : [
          { x: center.x + dx, y: center.y - radius },
          { x: center.x + dx, y: center.y + radius },
          { x: center.x - radius, y: center.y + dx },
          { x: center.x + radius, y: center.y + dx },
        ];
      for (const point of edgePoints) {
        const sample = sampleContinent(point.x, point.y, DEFAULT_WORLD_SEED);
        if (sample.land && sample.realmId === realm.id && sample.site) return { ...point, sample };
      }
    }
  }
  return null;
}

describe("continental world generation", () => {
  it("defines five far-separated governed realms with distinct macro biomes", () => {
    const expected = {
      central: ["temperate", ["grassland", "woodland", "wetland", "upland"]],
      north: ["snow", ["snowfield", "alpine"]],
      south: ["desert", ["desert", "badlands"]],
      east: ["reed-sea", ["reed-sea"]],
      west: ["woodland", ["woodland", "oldgrowth", "upland"]],
    };

    expect(REALMS).toHaveLength(5);
    expect(Object.keys(REALM_DEFINITIONS)).toEqual(["central", "north", "east", "south", "west"]);
    for (const realm of REALMS) {
      const sample = sampleContinent(realm.center.x, realm.center.y, DEFAULT_WORLD_SEED);
      const [biomeId, ecologies] = expected[realm.id];
      expect(realmIdAt(realm.center.x, realm.center.y, DEFAULT_WORLD_SEED), realm.id).toBe(realm.id);
      expect(sample.realmId, realm.id).toBe(realm.id);
      expect(sample.realm.biomeId, realm.id).toBe(biomeId);
      expect(ecologies, realm.id).toContain(sample.ecologyId);
      expect(sample.land, realm.id).toBe(true);
      expect(realm.capital.name).toBeTruthy();
      expect(realm.faction.id).toBeTruthy();
      expect(realm.faction.name).toBeTruthy();
      expect(realm.ruler.name).toBeTruthy();
      expect(realm.ruler.title).toBeTruthy();
      if (realm.id !== "central") {
        expect(hexDist(CONTINENT.start.coord, realm.center), realm.id).toBeGreaterThan(250);
        expect(LANDMARKS.some((landmark) => landmark.capitalOfRealmId === realm.id && landmark.id === realm.capital.id), realm.id).toBe(true);
      }
    }
  });

  it("projects province, culture, economy, authority, and regional content into every realm", () => {
    const realmIds = new Set(REALMS.map((realm) => realm.id));
    const cultures = valuesOf(REALM_CULTURES);
    const economies = valuesOf(REALM_ECONOMIES);
    const factions = valuesOf(REALM_FACTIONS);
    expect(new Set(cultures.map((entry) => entry.realmId))).toEqual(realmIds);
    expect(new Set(economies.map((entry) => entry.realmId))).toEqual(realmIds);
    expect(new Set(factions.map((entry) => entry.realmId))).toEqual(realmIds);
    expect(PROVINCES.length).toBeGreaterThanOrEqual(REALMS.length);

    const signatures = new Set();
    const settlementTypes = new Set();
    const encounters = new Set();
    const threats = new Set();
    const hazards = new Set();
    const resources = new Set();

    for (const realm of REALMS) {
      const sample = sampleContinent(realm.center.x, realm.center.y, DEFAULT_WORLD_SEED);
      const province = provinceAt(realm.center.x, realm.center.y, realm.id, sample.regionId, DEFAULT_WORLD_SEED);
      expect(province, `${realm.id} province`).toBeTruthy();
      expect(PROVINCE_BY_ID[province.id], province.id).toEqual(province);
      expect(sample.province?.id, realm.id).toBe(province.id);
      expect(sample.province?.realmId, realm.id).toBe(realm.id);
      expect(sample.area.realmId, realm.id).toBe(realm.id);
      expect(sample.area.province?.id, realm.id).toBe(province.id);
      expect(sample.content.culture?.realmId, realm.id).toBe(realm.id);
      expect(sample.content.economy?.realmId, realm.id).toBe(realm.id);
      expect(sample.content.authority.factionId, realm.id).toBeTruthy();
      expect(sample.content.authority.factionName, realm.id).toBeTruthy();
      expect(sample.content.authority.leader?.name, realm.id).toBeTruthy();
      expect(sample.content.settlementType, realm.id).toBeTruthy();
      expect(sample.content.encounter.label, realm.id).toBeTruthy();
      expect(sample.content.ecologyEncounter?.source, realm.id).toBe(sample.ecologyId);
      expect(sample.content.ecologyEncounter?.label, realm.id).toBeTruthy();
      expect(sample.content.threat.label, realm.id).toBeTruthy();
      expect(sample.content.travelHazard.label, realm.id).toBeTruthy();
      expect(sample.content.resources.length, realm.id).toBeGreaterThan(0);
      expect(sample.content.description, realm.id).toContain(realm.name);
      expect(sample.content.description, realm.id).toContain(province.name);
      expect(sample.content.tags, realm.id).toEqual(expect.arrayContaining([
        `realm:${realm.id}`,
        `province:${province.id}`,
      ]));
      expect(JSON.parse(JSON.stringify(sample.content)), realm.id).toEqual(sample.content);

      signatures.add([
        sample.content.culture.id,
        sample.content.economy.id,
        sample.content.authority.factionId,
        sample.province.id,
      ].join("|"));
      settlementTypes.add(sample.content.settlementType);
      encounters.add(sample.area.encounter.label);
      threats.add(sample.area.threat.label);
      hazards.add(sample.area.travelHazard.label);
      for (const resource of sample.content.resources) resources.add(resource);
    }

    expect(signatures.size).toBe(REALMS.length);
    expect(settlementTypes.size).toBeGreaterThanOrEqual(4);
    expect(encounters.size).toBeGreaterThanOrEqual(4);
    expect(threats.size).toBeGreaterThanOrEqual(4);
    expect(hazards.size).toBeGreaterThanOrEqual(4);
    expect(resources.size).toBeGreaterThanOrEqual(8);
  });

  it("keeps every authored province authoritative at its anchor without replacing stable biome ids", () => {
    const factionIds = new Set(valuesOf(REALM_FACTIONS).map((faction) => faction.id));
    for (const province of PROVINCES) {
      const sample = sampleContinent(province.anchor.x, province.anchor.y, DEFAULT_WORLD_SEED);
      const resolved = provinceAt(
        province.anchor.x,
        province.anchor.y,
        province.realmId,
        sample.regionId,
        DEFAULT_WORLD_SEED,
      );
      expect(resolved?.id, province.id).toBe(province.id);
      expect(sample.province?.id, province.id).toBe(province.id);
      expect(sample.realmId, province.id).toBe(province.realmId);
      if (!sample.land) {
        expect(province.terrainTags.join(" "), `${province.id} water anchor is explicitly coastal`)
          .toMatch(/coast|harbor|port|tidal|inlet/);
      }
      expect(REGION_DEFINITIONS[sample.regionId], `${province.id} retains a stable biome region`).toBeTruthy();
      expect(factionIds.has(province.authorityFactionId), province.id).toBe(true);
      expect(sample.content.authority.factionId, province.id).toBe(province.authorityFactionId);
      expect(sample.content.authority.governor, province.id).toEqual(province.governor);
      expect(sample.content.description, province.id).toContain(province.name);
      expect(sample.content.tags, province.id).toContain(`province:${province.id}`);
    }
  });

  it("gives generated sites deterministic realm-specific society and danger metadata", () => {
    const siteSignatures = new Set();
    for (const realm of REALMS) {
      const found = findGeneratedSiteInRealm(realm);
      expect(found, `${realm.id} generated site`).toBeTruthy();
      const { x, y, sample } = found;
      const repeated = sampleContinent(x, y, DEFAULT_WORLD_SEED);
      const site = sample.site;
      const archetype = SITE_ARCHETYPES[site.archetypeId];

      expect(repeated.site, realm.id).toEqual(site);
      expect(site.realmId, realm.id).toBe(realm.id);
      expect(site.provinceId, realm.id).toBe(sample.province?.id);
      expect(site.settlementType, realm.id).toBeTruthy();
      expect(site.encounter.label, realm.id).toBeTruthy();
      expect(site.threat.label, realm.id).toBeTruthy();
      expect(site.travelHazard.label, realm.id).toBeTruthy();
      expect(site.authority.factionId, realm.id).toBe(sample.content.authority.factionId);
      expect(site.resources.length, realm.id).toBeGreaterThan(0);
      expect(site.description.startsWith(archetype.description), realm.id).toBe(true);
      expect(site.description.length, realm.id).toBeGreaterThan(archetype.description.length);
      expect(site.tags, realm.id).toEqual(expect.arrayContaining([
        `realm:${realm.id}`,
        `province:${sample.province.id}`,
        `site-family:${site.archetypeId}`,
      ]));
      siteSignatures.add(`${site.realmId}|${site.provinceId}|${site.encounter.label}|${site.travelHazard.label}`);
    }
    expect(siteSignatures.size).toBe(REALMS.length);
  });

  it("adds road, checkpoint, port, and sea-lane context without turning shipping lanes into land", () => {
    for (const checkpoint of BORDER_CHECKPOINTS) {
      const sample = sampleContinent(checkpoint.coord.x, checkpoint.coord.y, DEFAULT_WORLD_SEED);
      expect(sample.content.context.kind, checkpoint.id).toBe("guarded-checkpoint");
      expect(sample.content.context.checkpointId, checkpoint.id).toBe(checkpoint.id);
      expect(sample.content.encounter.label, checkpoint.id).toContain(checkpoint.garrison);
    }

    for (const port of LANDMARKS.filter((landmark) => landmark.kind === "port")) {
      const sample = sampleContinent(port.coord.x, port.coord.y, DEFAULT_WORLD_SEED);
      expect(sample.port?.id, port.id).toBe(port.id);
      expect(sample.content.context.kind, port.id).toBe("port");
      expect(sample.content.context.portId, port.id).toBe(port.id);
      expect(sample.content.context.routeId, port.id).toBeTruthy();
      expect(sample.content.settlementType, port.id).toBe("port-city");
    }

    const roadCell = CONTINENT_ROUTES.flatMap((route) => rasterize(route.waypoints)).find((cell) => {
      const sample = sampleContinent(cell.x, cell.y, DEFAULT_WORLD_SEED);
      return !sample.checkpoint && !sample.port && !sample.waterway && !sample.mountainSpine?.pass;
    });
    const roadSample = sampleContinent(roadCell.x, roadCell.y, DEFAULT_WORLD_SEED);
    expect(["great-road", "regional-road"]).toContain(roadSample.content.context.kind);
    expect(roadSample.content.context.routeId).toBe(roadSample.route.id);

    for (const lane of CONTINENT_SEA_LANES) {
      const cells = rasterize(lane.waypoints);
      const waterCell = cells.find((cell) => {
        const sample = sampleContinent(cell.x, cell.y, DEFAULT_WORLD_SEED);
        return !sample.land && sample.seaLane?.id === lane.id;
      });
      expect(waterCell, `${lane.id} contains navigable sea`).toBeTruthy();
      for (const cell of cells) {
        const laneSample = sampleContinent(cell.x, cell.y, DEFAULT_WORLD_SEED);
        expect(seaLaneAt(cell.x, cell.y), `${lane.id} at ${keyOf(cell)}`).toBeTruthy();
        if (laneSample.land) expect(laneSample.port, `${lane.id} only lands at an authored port`).toBeTruthy();
      }
      for (const portId of lane.portIds || []) {
        expect(LANDMARKS.some((landmark) => landmark.id === portId && landmark.kind === "port"), `${lane.id}:${portId}`).toBe(true);
      }
      const sample = sampleContinent(waterCell.x, waterCell.y, DEFAULT_WORLD_SEED);
      expect(seaLaneAt(waterCell.x, waterCell.y)?.id, lane.id).toBe(lane.id);
      expect(sample.seaLane?.id, lane.id).toBe(lane.id);
      expect(sample.land, lane.id).toBe(false);
      expect(sample.terrain, lane.id).toBe("water");
      expect(sample.site, lane.id).toBeNull();
      expect(sample.content.context.kind, lane.id).toBe("sea-lane");
    }
  });

  it("keeps every realm road-connected through guarded border checkpoints", () => {
    const checkpointLandmarks = new Map(LANDMARKS.filter((landmark) => landmark.role === "border-checkpoint").map((landmark) => [landmark.id, landmark]));
    expect(BORDER_CHECKPOINTS.length).toBeGreaterThanOrEqual(4);

    for (const checkpoint of BORDER_CHECKPOINTS) {
      const sample = sampleContinent(checkpoint.coord.x, checkpoint.coord.y, DEFAULT_WORLD_SEED);
      const route = routeAt(checkpoint.coord.x, checkpoint.coord.y);
      expect(checkpoint.realmIds[0], checkpoint.id).toBe("central");
      expect(["north", "east", "south", "west"], checkpoint.id).toContain(checkpoint.realmIds[1]);
      expect(checkpoint.routeIds, checkpoint.id).toContain(route?.id);
      expect(checkpointAt(checkpoint.coord.x, checkpoint.coord.y), checkpoint.id).toEqual(checkpoint);
      expect(sample.checkpoint?.garrison, checkpoint.id).toBeTruthy();
      expect(sample.land, checkpoint.id).toBe(true);
      expect(sample.terrain, checkpoint.id).toBe("road");
      expect(checkpointLandmarks.get(checkpoint.id)?.kind, checkpoint.id).toBe("fortress");
    }

    for (const landmark of LANDMARKS.filter((entry) => entry.kind !== "lake")) {
      expect(routeAt(landmark.coord.x, landmark.coord.y), `${landmark.id} connected to continental roads`).toBeTruthy();
    }

    for (const route of CONTINENT_ROUTES) {
      const realms = rasterize(route.waypoints)
        .map((cell) => realmIdAt(cell.x, cell.y, DEFAULT_WORLD_SEED))
        .filter((realmId, index, all) => index === 0 || realmId !== all[index - 1]);
      expect(realms, `${route.id} crosses each declared border once`).toEqual(route.realmIds);
      for (const checkpointId of route.checkpointIds) {
        const checkpoint = BORDER_CHECKPOINTS.find((entry) => entry.id === checkpointId);
        const cells = rasterize(route.waypoints);
        const transitionCells = cells.filter((cell, index) => index > 0 && (
          realmIdAt(cell.x, cell.y, DEFAULT_WORLD_SEED) !== realmIdAt(cells[index - 1].x, cells[index - 1].y, DEFAULT_WORLD_SEED)
        ));
        expect(Math.min(...transitionCells.map((cell) => hexDist(cell, checkpoint.coord))), checkpointId).toBeLessThanOrEqual(2);
      }
    }

    const roadKeys = new Set(CONTINENT_ROUTES.flatMap((route) => rasterize(route.waypoints)).map(keyOf));
    const visited = new Set([keyOf(CONTINENT.start.coord)]);
    const queue = [CONTINENT.start.coord];
    const directions = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
    while (queue.length) {
      const cell = queue.shift();
      for (const [dx, dy] of directions) {
        const next = { x: cell.x + dx, y: cell.y + dy };
        const key = keyOf(next);
        if (!roadKeys.has(key) || visited.has(key)) continue;
        visited.add(key);
        queue.push(next);
      }
    }
    for (const landmark of LANDMARKS.filter((entry) => entry.capitalOfRealmId || entry.kind === "port" || entry.role === "border-checkpoint")) {
      expect(visited.has(keyOf(landmark.coord)), `${landmark.id} joins the Whitemarch road graph`).toBe(true);
    }
  });

  it("uses an irregular authored coast with real west, south, and east ports", () => {
    const ports = LANDMARKS.filter((landmark) => landmark.kind === "port");
    const directions = new Set(ports.map((port) => port.realmId));
    const neighbors = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

    expect(CONTINENT.coastline.length).toBeGreaterThanOrEqual(20);
    expect(COASTAL_FEATURES.some((feature) => feature.kind === "bay")).toBe(true);
    expect(COASTAL_FEATURES.some((feature) => feature.kind === "cove")).toBe(true);
    expect(COASTAL_FEATURES.some((feature) => feature.kind === "inlet")).toBe(true);
    expect(directions).toEqual(new Set(["west", "east", "south"]));
    expect(isInsideContinent(500, -200, DEFAULT_WORLD_SEED)).toBe(false);
    expect(isInsideContinent(430, -200, DEFAULT_WORLD_SEED)).toBe(true);
    expect(isInsideContinent(0, 390, DEFAULT_WORLD_SEED)).toBe(false);
    expect(isInsideContinent(200, 350, DEFAULT_WORLD_SEED)).toBe(true);
    expect(continentValueAt(0, CONTINENT.bounds.ymin, DEFAULT_WORLD_SEED)).toBeGreaterThan(0);
    expect(isInsideContinent(0, CONTINENT.bounds.ymin, DEFAULT_WORLD_SEED)).toBe(true);

    for (const port of ports) {
      const sample = sampleContinent(port.coord.x, port.coord.y, DEFAULT_WORLD_SEED);
      expect(sample.land, port.id).toBe(true);
      expect(sampleContinent(port.coord.x, port.coord.y, "avarra-another-age").land, `${port.id} remains a port under another seed`).toBe(true);
      expect(sample.coast, port.id).toBe(true);
      expect(sample.coastalFeature?.id, port.id).toBe(port.coastalFeatureId);
      expect(neighbors.some(([dx, dy]) => !isInsideContinent(port.coord.x + dx, port.coord.y + dy, DEFAULT_WORLD_SEED)), `${port.id} opens directly onto sea`).toBe(true);
      expect(neighbors.some(([dx, dy]) => isInsideContinent(port.coord.x + dx, port.coord.y + dy, DEFAULT_WORLD_SEED)), `${port.id} has a dry road approach`).toBe(true);
    }
  });

  it("raises a broken central mountain spine while preserving named road passes", () => {
    expect(MOUNTAIN_SPINE.waypoints.length).toBeGreaterThanOrEqual(8);
    expect(MOUNTAIN_SPINE.passes.length).toBeGreaterThanOrEqual(3);

    const ridgeSamples = MOUNTAIN_SPINE.waypoints.map((point) => sampleContinent(point.x, point.y, DEFAULT_WORLD_SEED));
    expect(ridgeSamples.filter((sample) => sample.mountainSpine?.elevationBoost > 0.08).length).toBeGreaterThanOrEqual(4);
    expect(ridgeSamples.some((sample) => ["hills", "mountains", "road"].includes(sample.terrain))).toBe(true);

    for (const pass of MOUNTAIN_SPINE.passes) {
      const sample = sampleContinent(pass.coord.x, pass.coord.y, DEFAULT_WORLD_SEED);
      expect(sample.mountainSpine?.pass?.id, pass.id).toBe(pass.id);
      expect(pass.routeIds, pass.id).toContain(sample.route?.id);
      expect(sample.land, pass.id).toBe(true);
      expect(sample.terrain, pass.id).toBe("road");
    }
  });

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
        expect(continentValueAt(point.x, point.y, DEFAULT_WORLD_SEED), `${route.id} follows natural land at ${keyOf(point)}`).toBeGreaterThan(0);
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
    expect(site.description.startsWith(archetype.description)).toBe(true);
    expect(site.description.length).toBeGreaterThan(archetype.description.length);
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
        realmId: site.realmId,
        provinceId: site.provinceId,
        settlementType: site.settlementType,
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
    expect(first.content).not.toBe(second.content);
    expect(first.content.resources).not.toBe(second.content.resources);
    expect(first.content.authority).not.toBe(second.content.authority);
    expect(first.province).not.toBe(second.province);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });
});
