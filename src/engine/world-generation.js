// Deterministic, lazy continental generation for Avarra.
//
// Every result is a pure function of (world seed, generator version, x, y).
// Query order is irrelevant and no generated chunk is written into campaign
// state. Authored and discovered overlays remain the responsibility of
// engine/world.js.

import { hexDist, hexLine } from "../data/hex-math.js";
import {
  CONTINENT,
  CONTINENT_LAKES,
  CONTINENT_ROUTES,
  CONTINENT_WATERWAYS,
  DEFAULT_WORLD_SEED,
  ECOLOGIES,
  LANDMARKS,
  REGION_DEFINITIONS,
  SITE_ARCHETYPES,
  WORLD_GENERATOR_VERSION,
  ecologyDefinition,
  regionDefinition,
} from "../data/continent.js";

const SQRT_3_OVER_2 = Math.sqrt(3) / 2;
const UINT32 = 4294967296;

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function roundMetric(value) {
  return Math.round(value * 10000) / 10000;
}

function hashString(value) {
  let h = 2166136261 >>> 0;
  const str = String(value);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

function mixCoordinate(seedHash, x, y, streamHash) {
  let h = seedHash ^ streamHash;
  h ^= Math.imul(x | 0, 0x45d9f3b);
  h ^= Math.imul(y | 0, 0x119de1f3);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

// Public keyed draw for tests and adjacent world systems. Callers name their
// stream and stable identity rather than consuming a shared mutable RNG.
export function worldRandom(seed = DEFAULT_WORLD_SEED, stream = "world", ...identity) {
  const seedHash = hashString(`${seed}:${WORLD_GENERATOR_VERSION}:${stream}`);
  const idHash = hashString(identity.join(":"));
  return mixCoordinate(seedHash, idHash, identity.length, hashString(stream)) / UINT32;
}

function coordRandom(seed, stream, x, y) {
  return mixCoordinate(hashString(seed), x, y, hashString(`${WORLD_GENERATOR_VERSION}:${stream}`)) / UINT32;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise(x, y, seed, stream) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smoothstep(x - x0);
  const fy = smoothstep(y - y0);
  const a = coordRandom(seed, stream, x0, y0);
  const b = coordRandom(seed, stream, x0 + 1, y0);
  const c = coordRandom(seed, stream, x0, y0 + 1);
  const d = coordRandom(seed, stream, x0 + 1, y0 + 1);
  const north = a + (b - a) * fx;
  const south = c + (d - c) * fx;
  return north + (south - north) * fy;
}

function fbm(x, y, seed, stream, octaves = 4) {
  let total = 0;
  let amplitude = 1;
  let frequency = 1;
  let maximum = 0;
  for (let octave = 0; octave < octaves; octave++) {
    total += valueNoise(x * frequency, y * frequency, seed, `${stream}:${octave}`) * amplitude;
    maximum += amplitude;
    frequency *= 2;
    amplitude *= 0.5;
  }
  return total / maximum;
}

function axialProjection(x, y) {
  return { x: x + y / 2, y: y * SQRT_3_OVER_2 };
}

function authoredLandBoost(x, y) {
  let boost = 0;
  for (const landmark of LANDMARKS) {
    const distance = hexDist({ x, y }, landmark.coord);
    if (distance < 20) boost = Math.max(boost, (1 - distance / 20) * 0.16);
  }
  return boost;
}

// Positive is land, zero is shoreline, negative is ocean. The broad ellipse
// guarantees one principal landmass; low-frequency named noise cuts bays and
// peninsulas without making query-order-dependent flood-fill decisions.
export function continentValueAt(x, y, seed = DEFAULT_WORLD_SEED) {
  const p = axialProjection(x - 6, y - 8);
  const radial = Math.sqrt((p.x / 535) ** 2 + (p.y / 345) ** 2);
  const broad = (fbm(x * 0.0042, y * 0.0042, seed, "world:landform:broad", 4) - 0.5) * 0.34;
  const bays = (fbm(x * 0.0105, y * 0.0105, seed, "world:landform:bays", 3) - 0.5) * 0.12;
  return roundMetric(1 - radial + broad + bays + authoredLandBoost(x, y));
}

export function isInsideContinent(x, y, seed = DEFAULT_WORLD_SEED) {
  const { xmin, xmax, ymin, ymax } = CONTINENT.bounds;
  if (x < xmin || x > xmax || y < ymin || y > ymax) return false;
  return continentValueAt(x, y, seed) > 0;
}

function inCityBounds(x, y, bounds) {
  return bounds && x >= bounds.xmin && x <= bounds.xmax && y >= bounds.ymin && y <= bounds.ymax;
}

// Named regions are warped Voronoi-like influence fields. Each definition may
// have several sites, allowing a frontier region to arc along the coast rather
// than behaving like a rectangle.
export function regionIdAt(x, y, seed = DEFAULT_WORLD_SEED) {
  const capital = REGION_DEFINITIONS.whitemarch;
  if (inCityBounds(x, y, capital.cityBounds)) return "whitemarch";

  const warpX = (fbm(x * 0.007, y * 0.007, seed, "world:regions:x", 3) - 0.5) * 46;
  const warpY = (fbm(x * 0.007, y * 0.007, seed, "world:regions:y", 3) - 0.5) * 46;
  const wx = x + warpX;
  const wy = y + warpY;
  let winner = "far-wild";
  let best = Infinity;
  for (const region of Object.values(REGION_DEFINITIONS)) {
    if (region.id === "whitemarch") continue;
    for (const site of region.sites) {
      const dx = (wx - site.x) / site.scaleX;
      const dy = (wy - site.y) / site.scaleY;
      const base = Math.sqrt(dx * dx + dy * dy);
      const roughness = 0.94 + valueNoise(x * 0.018, y * 0.018, seed, `world:region-edge:${region.id}`) * 0.12;
      const score = base * roughness;
      if (score < best) {
        best = score;
        winner = region.id;
      }
    }
  }
  return winner;
}

function climateAt(x, y, regionId, seed) {
  const p = axialProjection(x, y);
  const region = regionDefinition(regionId);
  const elevationNoise = fbm(x * 0.012, y * 0.012, seed, "world:elevation", 5);
  const ruggedness = fbm(x * 0.031, y * 0.031, seed, "world:ruggedness", 3);
  const moistureNoise = fbm(x * 0.009, y * 0.009, seed, "world:moisture", 4);
  const temperatureNoise = fbm(x * 0.006, y * 0.006, seed, "world:temperature", 3);
  const elevation = clamp(0.42 + (elevationNoise - 0.5) * 0.78 + (ruggedness - 0.5) * 0.16 + (region.climate.elevation || 0));
  const coastMoisture = clamp(0.12 - Math.max(0, continentValueAt(x, y, seed)), 0, 0.12);
  const moisture = clamp(0.50 + (moistureNoise - 0.5) * 0.74 + coastMoisture + (region.climate.moisture || 0) - elevation * 0.08);
  const temperature = clamp(0.56 + (p.y / 345) * 0.25 + (temperatureNoise - 0.5) * 0.16 + (region.climate.temperature || 0) - elevation * 0.08);
  return { elevation, moisture, temperature, ruggedness };
}

function ecologyIdFor({ landValue, elevation, moisture, temperature, ruggedness }, region) {
  if (landValue <= 0) return "open-sea";
  if (landValue < 0.065) return "tidal-coast";

  const terrain = region.terrain || {};
  const highland = elevation + (terrain.hills || 0) * 0.55;
  const wetness = moisture - elevation * 0.32 + (terrain.marsh || 0);
  const woodland = moisture + (terrain.forest || 0);

  if (highland > 0.78 || (temperature < 0.17 && highland > 0.60)) return "alpine";
  if (temperature < 0.18) return "tundra";
  if (wetness > 0.68 && elevation < 0.58) return "wetland";
  if (moisture < 0.30 && highland > 0.52) return "badlands";
  if (woodland > 0.82 && ruggedness > 0.42) return "oldgrowth";
  if (woodland > 0.61) return "woodland";
  if (moisture + (terrain.forest || 0) < 0.31) return "steppe";
  if (highland > 0.56) return "upland";
  return "grassland";
}

function terrainForEcology(ecologyId, climate, region, seed, x, y) {
  const ecology = ecologyDefinition(ecologyId);
  if (ecologyId === "open-sea") return "water";
  const detail = coordRandom(seed, "world:terrain-detail", x, y);
  const highland = climate.elevation + (region.terrain?.hills || 0) * 0.55;
  const wetness = climate.moisture - climate.elevation * 0.32 + (region.terrain?.marsh || 0);
  const woodland = climate.moisture + (region.terrain?.forest || 0);

  if (ecologyId === "tidal-coast") return detail < 0.18 ? "water" : (detail < 0.67 ? "marsh" : "plains");
  if (ecologyId === "alpine") return detail < 0.76 ? "mountains" : "hills";
  if (ecologyId === "upland" || ecologyId === "badlands") return detail < 0.72 ? "hills" : (highland > 0.76 ? "mountains" : "plains");
  if (ecologyId === "wetland") return detail < 0.78 ? "marsh" : (detail < 0.90 ? "forest" : "plains");
  if (ecologyId === "woodland" || ecologyId === "oldgrowth") return detail < 0.80 ? "forest" : (highland > 0.62 ? "hills" : "plains");
  if (ecologyId === "tundra") return highland > 0.68 && detail < 0.46 ? "hills" : "plains";
  if (ecologyId === "steppe") return highland > 0.64 && detail < 0.42 ? "hills" : "plains";
  if (wetness > 0.72 && detail < 0.20) return "marsh";
  if (woodland > 0.66 && detail < 0.22) return "forest";
  if (highland > 0.64 && detail < 0.34) return "hills";
  return ecology.terrain;
}

function titleFromSlug(value) {
  return String(value)
    .split("-")
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(" ");
}

function pick(values, unit) {
  if (!values?.length) return null;
  return values[Math.min(values.length - 1, Math.floor(unit * values.length))];
}

export function worldAreaAt(x, y, regionId = null, seed = DEFAULT_WORLD_SEED) {
  const resolvedRegionId = regionId || regionIdAt(x, y, seed);
  const size = CONTINENT.chunkSize;
  const chunkX = Math.floor(x / size);
  const chunkY = Math.floor(y / size);
  const region = regionDefinition(resolvedRegionId);
  const prefix = pick(region.areas.prefixes, worldRandom(seed, "world:area-prefix", resolvedRegionId, chunkX, chunkY));
  const noun = pick(region.areas.nouns, worldRandom(seed, "world:area-noun", resolvedRegionId, chunkX, chunkY));
  return {
    id: `${resolvedRegionId}:${chunkX}:${chunkY}`,
    name: `${prefix} ${noun}`,
    chunk: { x: chunkX, y: chunkY },
    regionId: resolvedRegionId,
  };
}

function featureFamily(kind) {
  if (/village|town|freehold|settlement/.test(kind)) return "settlement";
  if (/camp|lodge|relay|jetty|caravanserai|inn/.test(kind)) return "camp";
  if (/shrine|grove|chapel|witch-stone|standing-stones|memory-tree|waystone/.test(kind)) return "shrine";
  if (/ruin|barrow|cairn|burial|abandoned|drowned|wreck|lost|unknown/.test(kind)) return "ruin";
  if (/mine|quarry|saltworks|apiary|well|field|spring|peat/.test(kind)) return "resource";
  if (/ferry|ford|crossing|milestone/.test(kind)) return "crossing";
  if (/fort|watch|tower|war-camp|tribute|manor|signal/.test(kind)) return "fortification";
  return "wonder";
}

function winsGeneratedSiteSpacing(seed, x, y, roll, radius = 2) {
  for (let dq = -radius; dq <= radius; dq++) {
    const drLow = Math.max(-radius, -dq - radius);
    const drHigh = Math.min(radius, -dq + radius);
    for (let dr = drLow; dr <= drHigh; dr++) {
      if (dq === 0 && dr === 0) continue;
      const nearbyRoll = coordRandom(seed, "world:sites:presence", x + dq, y + dr);
      if (nearbyRoll < roll) return false;
    }
  }
  return true;
}

function generatedSiteAt({ x, y, seed, region, ecology, area, terrain, route }) {
  if (terrain === "water" || region.poiChance <= 0) return null;
  const chance = region.poiChance * (route ? 1.35 : 1);
  const roll = coordRandom(seed, "world:sites:presence", x, y);
  if (roll >= chance) return null;
  const pool = [...new Set([...(region.features || []), ...(ecology.features || [])])];
  const kind = pick(pool, coordRandom(seed, "world:sites:kind", x, y)) || "waystone";
  const family = featureFamily(kind);
  const archetype = SITE_ARCHETYPES[family] || SITE_ARCHETYPES.wonder;
  if (!winsGeneratedSiteSpacing(seed, x, y, roll, archetype.minimumSpacingHexes - 1)) return null;
  const siteId = `site:${WORLD_GENERATOR_VERSION}:${region.id}:${x}:${y}`;
  const areaWord = area.name.split(" ")[0];
  const name = `${areaWord} ${titleFromSlug(kind)}`;
  return {
    id: siteId,
    kind,
    archetypeId: family,
    poiType: archetype.poiType,
    name,
    description: archetype.description,
    tags: [...archetype.tags, ...ecology.tags],
  };
}

function buildLineIndex(items, entryFor) {
  const index = new Map();
  for (const item of items) {
    for (let waypoint = 1; waypoint < item.waypoints.length; waypoint++) {
      const line = hexLine(item.waypoints[waypoint - 1], item.waypoints[waypoint]);
      for (const coord of line) {
        const key = `${coord.x},${coord.y}`;
        if (!index.has(key)) index.set(key, entryFor(item));
      }
    }
  }
  return index;
}

const ROUTE_INDEX = buildLineIndex(CONTINENT_ROUTES, (route) => ({ id: route.id, name: route.name }));
const WATERWAY_INDEX = buildLineIndex(CONTINENT_WATERWAYS, (river) => ({ id: river.id, name: river.name, description: river.description }));

// Sparse authored travel spine used by the continent-scale route planner. It is
// intentionally just the macro-road raster, not every generated tile.
export const CONTINENT_ROUTE_CELLS = Object.freeze(
  [...ROUTE_INDEX.keys()].map((key) => {
    const [x, y] = key.split(",").map(Number);
    return Object.freeze({ x, y });
  }),
);

export function routeAt(x, y) {
  return ROUTE_INDEX.get(`${x},${y}`) || null;
}

export function waterwayAt(x, y) {
  const river = WATERWAY_INDEX.get(`${x},${y}`);
  if (river) return { ...river, kind: "river" };
  for (const lake of CONTINENT_LAKES) {
    if (hexDist({ x, y }, lake.center) <= lake.radius) {
      return { id: lake.id, name: lake.name, description: lake.description, kind: "lake" };
    }
  }
  return null;
}

export function landmarkAt(x, y) {
  return LANDMARKS.find((landmark) => landmark.coord.x === x && landmark.coord.y === y) || null;
}

// Full physical/cultural sample used by the tile generator and continent atlas.
export function sampleContinent(x, y, seed = DEFAULT_WORLD_SEED) {
  const rawLandValue = continentValueAt(x, y, seed);
  const { xmin, xmax, ymin, ymax } = CONTINENT.bounds;
  const withinEnvelope = x >= xmin && x <= xmax && y >= ymin && y <= ymax;
  const landValue = withinEnvelope && rawLandValue > 0 ? rawLandValue : Math.min(rawLandValue, -0.0001);
  const regionId = regionIdAt(x, y, seed);
  const region = regionDefinition(regionId);
  const climate = climateAt(x, y, regionId, seed);
  const ecologyId = ecologyIdFor({ landValue, ...climate }, region);
  const ecology = ecologyDefinition(ecologyId);
  const area = worldAreaAt(x, y, regionId, seed);
  const route = routeAt(x, y);
  const waterway = waterwayAt(x, y);
  let terrain = terrainForEcology(ecologyId, climate, region, seed, x, y);
  let crossing = null;
  if (waterway) terrain = "water";
  if (route && landValue > 0) {
    crossing = waterway ? waterway.kind : null;
    terrain = "road";
  }
  const site = generatedSiteAt({ x, y, seed, region, ecology, area, terrain, route });
  return {
    generatorVersion: WORLD_GENERATOR_VERSION,
    seed,
    continentId: CONTINENT.id,
    land: landValue > 0,
    coast: landValue > 0 && landValue < 0.065,
    landValue,
    regionId,
    ecologyId,
    area,
    elevation: roundMetric(climate.elevation),
    moisture: roundMetric(climate.moisture),
    temperature: roundMetric(climate.temperature),
    ruggedness: roundMetric(climate.ruggedness),
    terrain,
    route,
    waterway,
    crossing,
    resources: [...ecology.resources],
    tags: [...ecology.tags],
    site,
  };
}

export function generateWorldTile({ x, y, seed = DEFAULT_WORLD_SEED } = {}) {
  const sample = sampleContinent(x, y, seed);
  const poi = sample.site ? {
    type: "hidden",
    name: null,
    description: null,
    generated: {
      id: sample.site.id,
      featureKind: sample.site.kind,
      archetypeId: sample.site.archetypeId,
      poiType: sample.site.poiType,
      name: sample.site.name,
      description: sample.site.description,
      tags: sample.site.tags,
    },
  } : null;
  return {
    terrain: sample.terrain,
    poi,
    procedural: true,
    regionId: sample.regionId,
    ecology: sample.ecologyId,
    area: sample.area,
    route: sample.route,
    waterway: sample.waterway,
    crossing: sample.crossing,
    resources: sample.resources,
    worldgen: {
      version: sample.generatorVersion,
      continentId: sample.continentId,
      elevation: sample.elevation,
      moisture: sample.moisture,
      temperature: sample.temperature,
      ruggedness: sample.ruggedness,
      coast: sample.coast,
      tags: sample.tags,
    },
  };
}

export function ecologyAt(x, y, seed = DEFAULT_WORLD_SEED) {
  const sample = sampleContinent(x, y, seed);
  return ECOLOGIES[sample.ecologyId];
}
