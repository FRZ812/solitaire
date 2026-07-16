// Deterministic, lazy continental generation for Avarra.
//
// Every result is a pure function of (world seed, generator version, x, y).
// Query order is irrelevant and no generated chunk is written into campaign
// state. Authored and discovered overlays remain the responsibility of
// engine/world.js.

import { hexDist, hexLine } from "../data/hex-math.js";
import * as continentContent from "../data/continent.js";
import {
  BORDER_CHECKPOINTS,
  COASTAL_FEATURES,
  CONTINENT,
  CONTINENT_LAKES,
  CONTINENT_ROUTES,
  CONTINENT_WATERWAYS,
  DEFAULT_WORLD_SEED,
  ECOLOGIES,
  LANDMARKS,
  MOUNTAIN_SPINE,
  REALMS,
  REGION_DEFINITIONS,
  SITE_ARCHETYPES,
  WORLD_GENERATOR_VERSION,
  ecologyDefinition,
  realmDefinition,
  regionDefinition,
} from "../data/continent.js";

const CONTINENT_SEA_LANES = continentContent.CONTINENT_SEA_LANES || [];
const PROVINCES = continentContent.PROVINCES || [];
const PROVINCE_BY_ID = continentContent.PROVINCE_BY_ID || {};
const REALM_CULTURES = continentContent.REALM_CULTURES || [];
const REALM_ECONOMIES = continentContent.REALM_ECONOMIES || [];
const REALM_FACTIONS = continentContent.REALM_FACTIONS || [];

const SQRT_3_OVER_2 = Math.sqrt(3) / 2;
const UINT32 = 4294967296;
const LANDMARK_BUCKET_SIZE = 32;
const CONTINENT_VALUE_CACHE_LIMIT = 32768;
const coordinateKey = (x, y) => `${x},${y}`;
const LANDMARK_BY_COORD = new Map(LANDMARKS.map((landmark) => [coordinateKey(landmark.coord.x, landmark.coord.y), landmark]));
const CHECKPOINT_BY_COORD = new Map(BORDER_CHECKPOINTS.map((checkpoint) => [coordinateKey(checkpoint.coord.x, checkpoint.coord.y), checkpoint]));
const COASTAL_FEATURE_BY_ID = new Map(COASTAL_FEATURES.map((feature) => [feature.id, feature]));
const LANDMARK_BUCKETS = new Map();
const CONTINENT_VALUE_CACHE = new Map();

for (const landmark of LANDMARKS) {
  const bucketX = Math.floor(landmark.coord.x / LANDMARK_BUCKET_SIZE);
  const bucketY = Math.floor(landmark.coord.y / LANDMARK_BUCKET_SIZE);
  const key = coordinateKey(bucketX, bucketY);
  const bucket = LANDMARK_BUCKETS.get(key) || [];
  bucket.push(landmark);
  LANDMARK_BUCKETS.set(key, bucket);
}

function nearbyLandmarks(x, y) {
  const bucketX = Math.floor(x / LANDMARK_BUCKET_SIZE);
  const bucketY = Math.floor(y / LANDMARK_BUCKET_SIZE);
  const nearby = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      nearby.push(...(LANDMARK_BUCKETS.get(coordinateKey(bucketX + dx, bucketY + dy)) || []));
    }
  }
  return nearby;
}

function rememberContinentValue(key, value) {
  if (CONTINENT_VALUE_CACHE.size >= CONTINENT_VALUE_CACHE_LIMIT) {
    CONTINENT_VALUE_CACHE.delete(CONTINENT_VALUE_CACHE.keys().next().value);
  }
  CONTINENT_VALUE_CACHE.set(key, value);
  return value;
}

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
  for (const landmark of nearbyLandmarks(x, y)) {
    const distance = hexDist({ x, y }, landmark.coord);
    // Ports sit on the final dry coastal cell. Do not fatten them into round
    // peninsulas: only the harbor cell receives a small stability nudge, leaving
    // an immediately adjacent sea cell for docks and coastal atlas sampling.
    if (landmark.coastalFeatureId) {
      if (distance === 0) boost = Math.max(boost, 0.18);
      continue;
    }
    if (distance < 20) boost = Math.max(boost, (1 - distance / 20) * 0.16);
  }
  return boost;
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = ((a.y > point.y) !== (b.y > point.y))
      && point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || Number.EPSILON) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared);
  return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
}

const PROJECTED_COASTLINE = CONTINENT.coastline.map(({ x, y }) => axialProjection(x, y));
const PROJECTED_MOUNTAIN_SPINE = MOUNTAIN_SPINE.waypoints.map(({ x, y }) => axialProjection(x, y));

function coastlineDistance(point) {
  let distance = Infinity;
  for (let index = 0; index < PROJECTED_COASTLINE.length; index++) {
    const next = (index + 1) % PROJECTED_COASTLINE.length;
    distance = Math.min(distance, distanceToSegment(point, PROJECTED_COASTLINE[index], PROJECTED_COASTLINE[next]));
  }
  return pointInPolygon(point, PROJECTED_COASTLINE) ? distance : -distance;
}

function coastalCarveAt(x, y) {
  const point = axialProjection(x, y);
  let carve = 0;
  for (const feature of COASTAL_FEATURES) {
    if (!feature.carve) continue;
    const center = axialProjection(feature.coord.x, feature.coord.y);
    const dx = (point.x - center.x) / feature.carve.radiusX;
    const dy = (point.y - center.y) / feature.carve.radiusY;
    const normalized = Math.sqrt(dx * dx + dy * dy);
    if (normalized >= 1) continue;
    carve += feature.carve.strength * (1 - normalized) ** 2;
  }
  return carve;
}

function mountainSpineProfileAt(x, y, seed) {
  const point = axialProjection(x, y);
  let distance = Infinity;
  for (let index = 1; index < PROJECTED_MOUNTAIN_SPINE.length; index++) {
    distance = Math.min(distance, distanceToSegment(point, PROJECTED_MOUNTAIN_SPINE[index - 1], PROJECTED_MOUNTAIN_SPINE[index]));
  }
  if (distance >= MOUNTAIN_SPINE.width) return { boost: 0, distance, pass: null };

  const fracture = fbm(x * 0.021, y * 0.021, seed, "world:mountain-spine:fracture", 3);
  const continuity = fracture < 0.31 ? 0.16 : 0.58 + fracture * 0.42;
  let boost = MOUNTAIN_SPINE.elevationBoost * (1 - distance / MOUNTAIN_SPINE.width) * continuity;
  let activePass = null;
  for (const pass of MOUNTAIN_SPINE.passes) {
    const passDistance = hexDist({ x, y }, pass.coord);
    if (passDistance > pass.radius) continue;
    const relief = 0.12 + 0.88 * (passDistance / pass.radius);
    boost *= relief;
    if (!activePass || passDistance < activePass.distance) activePass = { ...pass, distance: passDistance };
  }
  return { boost, distance, pass: activePass };
}

// Positive is land, zero is shoreline, negative is ocean. A reviewed asymmetric
// polygon establishes one principal landmass; deterministic low-frequency noise
// roughens its headlands and named coves cut non-radial bays into three coasts.
export function continentValueAt(x, y, seed = DEFAULT_WORLD_SEED) {
  const cacheKey = `${seed}|${x}|${y}`;
  if (CONTINENT_VALUE_CACHE.has(cacheKey)) return CONTINENT_VALUE_CACHE.get(cacheKey);
  const point = axialProjection(x, y);
  const signedDistance = coastlineDistance(point) / 118;
  const broad = (fbm(x * 0.0055, y * 0.0055, seed, "world:landform:headlands", 4) - 0.5) * 0.24;
  const edge = (fbm(x * 0.016, y * 0.016, seed, "world:landform:coves", 3) - 0.5) * 0.09;
  return rememberContinentValue(cacheKey, roundMetric(signedDistance + broad + edge - coastalCarveAt(x, y) + authoredLandBoost(x, y)));
}

export function isInsideContinent(x, y, seed = DEFAULT_WORLD_SEED) {
  const { xmin, xmax, ymin, ymax } = CONTINENT.bounds;
  if (x < xmin || x > xmax || y < ymin || y > ymax) return false;
  return continentValueAt(x, y, seed) > 0;
}

function inCityBounds(x, y, bounds) {
  return bounds && x >= bounds.xmin && x <= bounds.xmax && y >= bounds.ymin && y <= bounds.ymax;
}

// The atlas reads exactly five macro realms. Their borders are broad, warped
// influence fields, not cardinal rectangles, so wilderness and roads cross
// natural frontier zones while every coordinate still resolves deterministically.
export function realmIdAt(x, y, seed = DEFAULT_WORLD_SEED) {
  const capital = REGION_DEFINITIONS.whitemarch;
  if (inCityBounds(x, y, capital.cityBounds)) return "central";
  const landmark = LANDMARK_BY_COORD.get(coordinateKey(x, y));
  if (landmark) return landmark.realmId;
  const roadRealm = routeRealmAt(x, y);
  if (roadRealm) return roadRealm;

  const warpX = (fbm(x * 0.005, y * 0.005, seed, "world:realms:x", 3) - 0.5) * 34;
  const warpY = (fbm(x * 0.005, y * 0.005, seed, "world:realms:y", 3) - 0.5) * 34;
  let winner = "central";
  let best = Infinity;
  for (const realm of REALMS) {
    const dx = (x + warpX - realm.center.x) / realm.influence.scaleX;
    const dy = (y + warpY - realm.center.y) / realm.influence.scaleY;
    const score = Math.sqrt(dx * dx + dy * dy);
    if (score < best) {
      best = score;
      winner = realm.id;
    }
  }
  return winner;
}

// Named regions are warped Voronoi-like influence fields. Each definition may
// have several sites, allowing a frontier region to arc along the coast rather
// than behaving like a rectangle.
export function regionIdAt(x, y, seed = DEFAULT_WORLD_SEED) {
  const capital = REGION_DEFINITIONS.whitemarch;
  if (inCityBounds(x, y, capital.cityBounds)) return "whitemarch";
  const landmark = LANDMARK_BY_COORD.get(coordinateKey(x, y));
  if (landmark?.regionId) return landmark.regionId;
  const parentRealmId = realmIdAt(x, y, seed);

  const warpX = (fbm(x * 0.007, y * 0.007, seed, "world:regions:x", 3) - 0.5) * 46;
  const warpY = (fbm(x * 0.007, y * 0.007, seed, "world:regions:y", 3) - 0.5) * 46;
  const wx = x + warpX;
  const wy = y + warpY;
  let winner = "far-wild";
  let best = Infinity;
  for (const region of Object.values(REGION_DEFINITIONS)) {
    if (region.id === "whitemarch") continue;
    // Stable legacy region ids now declare their macro parent. Restricting the
    // Voronoi contest prevents a central biome authority from bleeding across
    // the continent merely because it has a broad historical influence site.
    if (region.parentRealmId && region.parentRealmId !== parentRealmId) continue;
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

function climateAt(x, y, regionId, realmId, seed) {
  const p = axialProjection(x, y);
  const region = regionDefinition(regionId);
  const realm = realmDefinition(realmId);
  const elevationNoise = fbm(x * 0.012, y * 0.012, seed, "world:elevation", 5);
  const ruggedness = fbm(x * 0.031, y * 0.031, seed, "world:ruggedness", 3);
  const moistureNoise = fbm(x * 0.009, y * 0.009, seed, "world:moisture", 4);
  const temperatureNoise = fbm(x * 0.006, y * 0.006, seed, "world:temperature", 3);
  const mountainSpine = mountainSpineProfileAt(x, y, seed);
  const elevation = clamp(0.42 + (elevationNoise - 0.5) * 0.78 + (ruggedness - 0.5) * 0.16 + (region.climate.elevation || 0) * 0.45 + (realm.climate.elevation || 0) + mountainSpine.boost);
  const coastMoisture = clamp(0.12 - Math.max(0, continentValueAt(x, y, seed)), 0, 0.12);
  const moisture = clamp(0.50 + (moistureNoise - 0.5) * 0.74 + coastMoisture + (region.climate.moisture || 0) * 0.35 + (realm.climate.moisture || 0) - elevation * 0.08);
  const temperature = clamp(0.56 + (p.y / 345) * 0.18 + (temperatureNoise - 0.5) * 0.16 + (region.climate.temperature || 0) * 0.35 + (realm.climate.temperature || 0) - elevation * 0.08);
  return { elevation, moisture, temperature, ruggedness, mountainSpine };
}

function ecologyIdFor({ landValue, elevation, moisture, temperature, ruggedness }, region, realm) {
  if (landValue <= 0) return "open-sea";
  if (landValue < 0.065) return "tidal-coast";

  const terrain = {
    forest: (region.terrain?.forest || 0) * 0.35 + (realm.terrain?.forest || 0),
    marsh: (region.terrain?.marsh || 0) * 0.35 + (realm.terrain?.marsh || 0),
    hills: (region.terrain?.hills || 0) * 0.35 + (realm.terrain?.hills || 0),
  };
  const highland = elevation + (terrain.hills || 0) * 0.55;
  const wetness = moisture - elevation * 0.32 + (terrain.marsh || 0);
  const woodland = moisture + (terrain.forest || 0);

  if (realm.id === "north") return highland > 0.72 ? "alpine" : "snowfield";
  if (realm.id === "south") return highland > 0.67 ? "badlands" : "desert";
  if (realm.id === "east" && highland < 0.70 && wetness > 0.48) return "reed-sea";
  if (realm.id === "west") {
    if (highland > 0.72) return "upland";
    return woodland > 0.88 && ruggedness > 0.38 ? "oldgrowth" : "woodland";
  }

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

function terrainForEcology(ecologyId, climate, region, realm, seed, x, y) {
  const ecology = ecologyDefinition(ecologyId);
  if (ecologyId === "open-sea") return "water";
  const detail = coordRandom(seed, "world:terrain-detail", x, y);
  const hillBias = (region.terrain?.hills || 0) * 0.35 + (realm.terrain?.hills || 0);
  const marshBias = (region.terrain?.marsh || 0) * 0.35 + (realm.terrain?.marsh || 0);
  const forestBias = (region.terrain?.forest || 0) * 0.35 + (realm.terrain?.forest || 0);
  const highland = climate.elevation + hillBias * 0.55;
  const wetness = climate.moisture - climate.elevation * 0.32 + marshBias;
  const woodland = climate.moisture + forestBias;

  if (ecologyId === "tidal-coast") return detail < 0.18 ? "water" : (detail < 0.67 ? "marsh" : "plains");
  if (ecologyId === "alpine") return detail < 0.76 ? "mountains" : "hills";
  if (ecologyId === "upland" || ecologyId === "badlands") return detail < 0.72 ? "hills" : (highland > 0.76 ? "mountains" : "plains");
  if (ecologyId === "wetland") return detail < 0.78 ? "marsh" : (detail < 0.90 ? "forest" : "plains");
  if (ecologyId === "woodland" || ecologyId === "oldgrowth") return detail < 0.80 ? "forest" : (highland > 0.62 ? "hills" : "plains");
  if (ecologyId === "tundra") return highland > 0.68 && detail < 0.46 ? "hills" : "plains";
  if (ecologyId === "snowfield") return highland > 0.66 && detail < 0.52 ? "hills" : (detail < 0.10 ? "forest" : "plains");
  if (ecologyId === "desert") return highland > 0.62 && detail < 0.38 ? "hills" : "plains";
  if (ecologyId === "reed-sea") return detail < 0.12 ? "water" : (detail < 0.76 ? "marsh" : "plains");
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

function weightedPick(values, unit) {
  if (!values?.length) return null;
  const total = values.reduce((sum, value) => sum + Math.max(0, Number(value.weight) || 1), 0);
  let cursor = unit * total;
  for (const value of values) {
    cursor -= Math.max(0, Number(value.weight) || 1);
    if (cursor <= 0) return value;
  }
  return values.at(-1);
}

function collectionValues(collection) {
  if (Array.isArray(collection)) return collection;
  return Object.values(collection || {});
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  return value === null || value === undefined ? [] : [value];
}

function entryText(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  return value.description || value.desc || value.name || value.label || value.kind || value.id || null;
}

function uniqueText(values) {
  return [...new Set(values.flatMap(asArray).map(entryText).filter(Boolean))];
}

function slugify(value) {
  return String(value || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function descriptor(kind, value, source) {
  const text = entryText(value) || "unknown";
  return {
    id: `${kind}:${slugify(text)}`,
    label: /^[a-z0-9-]+$/.test(text) ? titleFromSlug(text) : text,
    source,
  };
}

function clonePerson(person) {
  if (!person) return null;
  return { name: person.name || null, title: person.title || null };
}

const CULTURE_BY_REALM = new Map(collectionValues(REALM_CULTURES).map((entry) => [entry.realmId, entry]));
const ECONOMY_BY_REALM = new Map(collectionValues(REALM_ECONOMIES).map((entry) => [entry.realmId, entry]));
const FACTIONS = collectionValues(REALM_FACTIONS);

function factionFor(realmId, factionId = null) {
  return FACTIONS.find((entry) => entry.id === factionId)
    || FACTIONS.find((entry) => entry.realmId === realmId)
    || null;
}

function provinceById(id) {
  if (!id) return null;
  return PROVINCE_BY_ID?.[id] || PROVINCES.find((province) => province.id === id) || null;
}

// Provinces are a cultural and political layer over the stable legacy region
// ids. They can become richer without invalidating biome ids used by saves,
// art, encounters, or the handcrafted capital.
export function provinceAt(x, y, realmId = null, regionId = null, seed = DEFAULT_WORLD_SEED) {
  const resolvedRealmId = realmId || realmIdAt(x, y, seed);
  const resolvedRegionId = regionId || regionIdAt(x, y, seed);
  const landmark = LANDMARK_BY_COORD.get(coordinateKey(x, y));
  const region = regionDefinition(resolvedRegionId);
  const directId = landmark?.provinceId || region.provinceId || region.authority?.provinceId;
  const direct = provinceById(directId);
  if (direct) return direct;

  const realmProvinces = PROVINCES.filter((province) => province.realmId === resolvedRealmId);
  const candidates = realmProvinces;
  if (!candidates.length) return null;

  let winner = candidates[0];
  let best = Infinity;
  for (const province of candidates) {
    const anchor = province.anchor || realmDefinition(resolvedRealmId).center;
    const influence = province.influence || { scaleX: 120, scaleY: 100 };
    const warp = (valueNoise(x * 0.011, y * 0.011, seed, `world:province:${province.id}`) - 0.5) * 14;
    const dx = (x + warp - anchor.x) / (influence.scaleX || 1);
    const dy = (y - warp - anchor.y) / (influence.scaleY || 1);
    // Matching a stable ecology region is useful evidence, but province
    // anchors remain authoritative. This keeps coastal and frontier provinces
    // distinct even where a broad legacy biome (such as Pale Steppe) reaches
    // across the newer cultural boundary.
    const regionPenalty = province.regionIds?.includes(resolvedRegionId) ? 0 : 0.28;
    const score = Math.sqrt(dx * dx + dy * dy) + regionPenalty;
    if (score < best) {
      best = score;
      winner = province;
    }
  }
  return winner;
}

function provinceSnapshot(province) {
  if (!province) return null;
  return {
    id: province.id,
    name: province.name,
    realmId: province.realmId,
    seatLandmarkId: province.seatLandmarkId || null,
    authorityFactionId: province.authorityFactionId || null,
    governor: clonePerson(province.governor),
    description: province.description || null,
    terrainTags: uniqueText(province.terrainTags || []),
    cultureNotes: uniqueText(province.cultureNotes || []),
  };
}

function cultureSnapshot(culture) {
  if (!culture) return null;
  return {
    id: culture.id,
    realmId: culture.realmId,
    demonym: culture.demonym || null,
    languages: uniqueText(culture.languages || []),
    values: uniqueText(culture.values || []),
    architecture: uniqueText(culture.architecture || []),
    customs: uniqueText(culture.customs || []),
    faiths: uniqueText(culture.faiths || []),
    description: culture.description || null,
  };
}

function economySnapshot(economy, tradeGood) {
  if (!economy) return null;
  return {
    id: economy.id,
    realmId: economy.realmId,
    currency: economy.currency || null,
    localTradeGood: tradeGood || null,
    exports: uniqueText(economy.exports || []),
    imports: uniqueText(economy.imports || []),
    tradeNotes: uniqueText(economy.tradeNotes || []),
  };
}

function authoritySnapshot(realm, province, faction) {
  const leader = faction?.leader || realm.ruler;
  return {
    factionId: faction?.id || province?.authorityFactionId || realm.faction.id,
    factionName: faction?.name || realm.faction.name,
    factionType: faction?.type || null,
    leader: clonePerson(leader),
    governor: clonePerson(province?.governor),
    seatLandmarkId: province?.seatLandmarkId || faction?.seatLandmarkId || realm.capital.id,
    agenda: faction?.agenda || null,
    forces: uniqueText(faction?.forces || []),
  };
}

function selectAreaContent({ x, y, seed, region, realm, province, culture, economy, faction, name }) {
  const size = CONTINENT.chunkSize;
  const chunkX = Math.floor(x / size);
  const chunkY = Math.floor(y / size);
  const identity = [realm.id, province?.id || region.id, region.id, chunkX, chunkY];
  const settlementPool = uniqueText([province?.settlementTypes || [], culture?.settlementTypes || []]);
  const encounterPool = uniqueText([province?.encounterTags || [], culture?.encounterThemes || []]);
  const hazardPool = uniqueText([province?.hazards || [], region.hazards || []]);
  const threatPool = uniqueText([
    faction?.rivals || [],
    region.threats || [],
    province?.threats || [],
    hazardPool,
  ]);
  const resourcePool = uniqueText([
    province?.resources || [],
    economy?.resources || [],
    economy?.tradeGoods || [],
    economy?.exports || [],
  ]);
  const settlementType = pick(settlementPool, worldRandom(seed, "world:area:settlement", ...identity)) || "wayside-hamlet";
  const encounterText = pick(encounterPool, worldRandom(seed, "world:area:encounter", ...identity)) || "local travellers";
  const hazardText = pick(hazardPool, worldRandom(seed, "world:area:hazard", ...identity)) || "unmarked wilderness";
  const threatText = pick(threatPool, worldRandom(seed, "world:area:threat", ...identity)) || hazardText;
  const localResource = pick(resourcePool, worldRandom(seed, "world:area:resource", ...identity));
  const tradeGood = pick(uniqueText([economy?.tradeGoods || [], economy?.exports || []]), worldRandom(seed, "world:area:trade", ...identity));
  const authority = authoritySnapshot(realm, province, faction);
  const provinceName = province?.name || region.label || realm.name;
  const authorityName = authority.factionName || "local custom";
  const description = [
    `${name} lies in ${provinceName}, within ${realm.name}, under ${authorityName}.`,
    province?.description || culture?.description || region.description || null,
    `Travellers associate the district with ${settlementType.replace(/-/g, " ")}, ${encounterText}, and ${hazardText}.`,
  ].filter(Boolean).join(" ");
  return {
    settlementType,
    encounter: descriptor("encounter", encounterText, province?.id || culture?.id || realm.id),
    threat: descriptor("threat", threatText, faction?.id || province?.id || realm.id),
    travelHazard: descriptor("hazard", hazardText, province?.id || region.id),
    localResource: localResource || null,
    resources: uniqueText([localResource, tradeGood]),
    authority,
    culture: cultureSnapshot(culture),
    economy: economySnapshot(economy, tradeGood),
    description,
    tags: uniqueText([
      `realm:${realm.id}`,
      `region:${region.id}`,
      province ? `province:${province.id}` : null,
      culture ? `culture:${culture.id}` : null,
      authority.factionId ? `faction:${authority.factionId}` : null,
      province?.terrainTags || [],
      `settlement:${slugify(settlementType)}`,
      `encounter-theme:${slugify(encounterText)}`,
    ]),
  };
}

const AREA_TEMPLATE_CACHE_LIMIT = 4096;
const AREA_TEMPLATE_CACHE = new Map();

function cloneArea(area) {
  return {
    ...area,
    chunk: { ...area.chunk },
    province: area.province ? {
      ...area.province,
      governor: clonePerson(area.province.governor),
      terrainTags: [...area.province.terrainTags],
      cultureNotes: [...area.province.cultureNotes],
    } : null,
    encounter: { ...area.encounter },
    threat: { ...area.threat },
    travelHazard: { ...area.travelHazard },
    resources: [...area.resources],
    authority: {
      ...area.authority,
      leader: clonePerson(area.authority?.leader),
      governor: clonePerson(area.authority?.governor),
      forces: [...(area.authority?.forces || [])],
    },
    culture: area.culture ? {
      ...area.culture,
      languages: [...area.culture.languages],
      values: [...area.culture.values],
      architecture: [...area.culture.architecture],
      customs: [...area.culture.customs],
      faiths: [...area.culture.faiths],
    } : null,
    economy: area.economy ? {
      ...area.economy,
      exports: [...area.economy.exports],
      imports: [...area.economy.imports],
      tradeNotes: [...area.economy.tradeNotes],
    } : null,
    tags: [...area.tags],
  };
}

function rememberAreaTemplate(key, area) {
  if (AREA_TEMPLATE_CACHE.size >= AREA_TEMPLATE_CACHE_LIMIT) {
    AREA_TEMPLATE_CACHE.delete(AREA_TEMPLATE_CACHE.keys().next().value);
  }
  AREA_TEMPLATE_CACHE.set(key, area);
}

export function worldAreaAt(x, y, regionId = null, seed = DEFAULT_WORLD_SEED, realmId = null) {
  const resolvedRegionId = regionId || regionIdAt(x, y, seed);
  const resolvedRealmId = realmId || realmIdAt(x, y, seed);
  const size = CONTINENT.chunkSize;
  const chunkX = Math.floor(x / size);
  const chunkY = Math.floor(y / size);
  const cacheKey = `${seed}|${resolvedRealmId}|${resolvedRegionId}|${chunkX}|${chunkY}`;
  const cached = AREA_TEMPLATE_CACHE.get(cacheKey);
  if (cached) return cloneArea(cached);
  const region = regionDefinition(resolvedRegionId);
  const realm = realmDefinition(resolvedRealmId);
  const province = provinceAt(x, y, resolvedRealmId, resolvedRegionId, seed);
  const culture = CULTURE_BY_REALM.get(resolvedRealmId) || null;
  const economy = ECONOMY_BY_REALM.get(resolvedRealmId) || null;
  const factionId = province?.authorityFactionId || region.authorityFactionId || region.authority?.factionId || realm.faction.id;
  const faction = factionFor(resolvedRealmId, factionId);
  const prefix = pick(region.areas.prefixes, worldRandom(seed, "world:area-prefix", resolvedRegionId, chunkX, chunkY));
  const noun = pick(region.areas.nouns, worldRandom(seed, "world:area-noun", resolvedRegionId, chunkX, chunkY));
  const name = `${prefix} ${noun}`;
  const content = selectAreaContent({ x, y, seed, region, realm, province, culture, economy, faction, name });
  const area = {
    id: `${resolvedRegionId}:${chunkX}:${chunkY}`,
    name,
    chunk: { x: chunkX, y: chunkY },
    regionId: resolvedRegionId,
    realmId: resolvedRealmId,
    province: provinceSnapshot(province),
    ...content,
  };
  rememberAreaTemplate(cacheKey, area);
  return cloneArea(area);
}

function featureFamily(kind) {
  if (/city|village|town|freehold|settlement|hamlet|hold|oasis|harbor|port|stead|court/.test(kind)) return "settlement";
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

function generatedSiteAt({ x, y, seed, region, realm, province, culture, ecology, area, terrain, route, context }) {
  if (terrain === "water" || region.poiChance <= 0) return null;
  const chance = region.poiChance * (route ? 1.35 : 1);
  const roll = coordRandom(seed, "world:sites:presence", x, y);
  if (roll >= chance) return null;
  const culturalSettlements = uniqueText([province?.settlementTypes || [], culture?.settlementTypes || []]);
  const pool = [...new Set([...(region.features || []), ...(ecology.features || []), ...culturalSettlements])];
  const kind = pick(pool, coordRandom(seed, "world:sites:kind", x, y)) || "waystone";
  const family = featureFamily(kind);
  const archetype = SITE_ARCHETYPES[family] || SITE_ARCHETYPES.wonder;
  if (!winsGeneratedSiteSpacing(seed, x, y, roll, archetype.minimumSpacingHexes - 1)) return null;
  const siteId = `site:${WORLD_GENERATOR_VERSION}:${region.id}:${x}:${y}`;
  const areaWord = area.name.split(" ")[0];
  const name = `${areaWord} ${titleFromSlug(kind)}`;
  const architecture = pick(uniqueText(culture?.architecture || []), coordRandom(seed, "world:sites:architecture", x, y));
  const culturalLine = architecture
    ? `${architecture} marks it as ${culture?.demonym || realm.name} work.`
    : `Its customs and upkeep reflect ${province?.name || realm.name}.`;
  const contextLine = context?.description || `It stands within ${area.name}.`;
  return {
    id: siteId,
    kind,
    archetypeId: family,
    poiType: archetype.poiType,
    name,
    description: `${archetype.description} ${culturalLine} ${contextLine}`,
    realmId: realm.id,
    provinceId: province?.id || null,
    settlementType: family === "settlement" ? kind : area.settlementType,
    encounter: { ...area.encounter },
    threat: { ...area.threat },
    travelHazard: { ...area.travelHazard },
    authority: {
      ...area.authority,
      leader: clonePerson(area.authority?.leader),
      governor: clonePerson(area.authority?.governor),
      forces: [...(area.authority?.forces || [])],
    },
    resources: [...area.resources],
    context: context ? { ...context, tags: [...context.tags] } : null,
    tags: uniqueText([
      archetype.tags,
      ecology.tags,
      area.tags,
      context?.tags || [],
      `site-family:${family}`,
    ]),
  };
}

function buildLineIndex(items, entryFor) {
  const index = new Map();
  for (const item of items || []) {
    if (!item.waypoints?.length) continue;
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

const ROUTE_INDEX = buildLineIndex(CONTINENT_ROUTES, (route) => ({
  id: route.id,
  name: route.name,
  kind: route.kind || "great-road",
  realmIds: [...(route.realmIds || [])],
  checkpointIds: [...(route.checkpointIds || [])],
}));
const WATERWAY_INDEX = buildLineIndex(CONTINENT_WATERWAYS, (river) => ({ id: river.id, name: river.name, description: river.description }));
const SEA_LANE_INDEX = buildLineIndex(CONTINENT_SEA_LANES, (lane) => ({
  id: lane.id,
  name: lane.name,
  kind: lane.kind || "sea-lane",
  realmIds: [...(lane.realmIds || [])],
  portIds: [...(lane.portIds || [])],
  hazards: uniqueText(lane.hazards || []),
  description: lane.description || null,
}));

function routeCells(route) {
  const cells = [];
  for (let waypoint = 1; waypoint < route.waypoints.length; waypoint++) {
    const segment = hexLine(route.waypoints[waypoint - 1], route.waypoints[waypoint]);
    cells.push(...(waypoint === 1 ? segment : segment.slice(1)));
  }
  return cells;
}

// Roads cross political borders at their staffed checkpoints, never jittering
// back and forth between realms because of the off-road border warp.
const ROUTE_REALM_INDEX = new Map();
for (const route of CONTINENT_ROUTES) {
  const cells = routeCells(route);
  const destinationRealm = route.realmIds?.at(-1) || null;
  const checkpoint = BORDER_CHECKPOINTS.find((entry) => (
    entry.routeIds.includes(route.id) && entry.realmIds.includes(destinationRealm)
  ));
  const checkpointIndex = checkpoint
    ? cells.findIndex((cell) => cell.x === checkpoint.coord.x && cell.y === checkpoint.coord.y)
    : -1;
  for (let index = 0; index < cells.length; index++) {
    const key = `${cells[index].x},${cells[index].y}`;
    if (ROUTE_REALM_INDEX.has(key)) continue;
    const realmId = route.realmIds?.length === 1
      ? route.realmIds[0]
      : (checkpointIndex >= 0 && index >= checkpointIndex ? destinationRealm : route.realmIds?.[0]);
    if (realmId) ROUTE_REALM_INDEX.set(key, realmId);
  }
}

function routeRealmAt(x, y) {
  return ROUTE_REALM_INDEX.get(`${x},${y}`) || null;
}

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

export function seaLaneAt(x, y) {
  return SEA_LANE_INDEX.get(`${x},${y}`) || null;
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
  return LANDMARK_BY_COORD.get(coordinateKey(x, y)) || null;
}

export function checkpointAt(x, y) {
  return CHECKPOINT_BY_COORD.get(coordinateKey(x, y)) || null;
}

function locationContext({ landmark, route, checkpoint, port, seaLane, coastalFeature, mountainSpine, waterway, coast }) {
  let kind = "wilderness";
  let description = "No maintained route governs the immediate wilderness.";
  let encounter = null;
  let hazard = null;

  if (checkpoint) {
    kind = "guarded-checkpoint";
    description = `${checkpoint.name} controls this border road under the watch of ${checkpoint.garrison}.`;
    encounter = checkpoint.garrison;
    hazard = "military inspection and customs delays";
  } else if (port) {
    kind = "port";
    description = `${port.name} joins the continental road network to ${coastalFeature?.name || "the open sea"}.`;
    encounter = "dockworkers, pilots, merchants, and customs crews";
    hazard = "tides, shoals, and congested harbor traffic";
  } else if (mountainSpine?.pass) {
    kind = "mountain-pass";
    description = `${mountainSpine.pass.name} carries maintained travel through ${MOUNTAIN_SPINE.name}.`;
    encounter = "guides, pack trains, and pass wardens";
    hazard = "rockfall and sudden highland weather";
  } else if (route) {
    kind = ["regional", "regional-road"].includes(route.kind) ? "regional-road" : "great-road";
    description = `${route.name} brings patrols, trade, and news through this district.`;
    encounter = "caravans, couriers, pilgrims, and road patrols";
    hazard = "road tolls, damaged crossings, and opportunistic banditry";
  } else if (seaLane) {
    kind = "sea-lane";
    description = seaLane.description || `${seaLane.name} is a charted passage between distant ports.`;
    encounter = "merchant crews, fishing craft, and coastal pilots";
    hazard = seaLane.hazards[0] || "shoals and changing weather";
  } else if (waterway) {
    kind = waterway.kind;
    description = `${waterway.name} shapes travel, work, and settlement in the surrounding country.`;
    encounter = "ferrymen, fishers, and riverside workers";
    hazard = "floodwater and unreliable crossings";
  } else if (coast) {
    kind = "coast";
    description = `The shore opens toward ${coastalFeature?.name || "one of Avarra's great seas"}.`;
    encounter = "fishers, shore traders, and wreck scavengers";
    hazard = "changing tides and coastal weather";
  } else if (landmark) {
    kind = "landmark";
    description = `${landmark.name} is the best-known point in the surrounding country.`;
  }

  return {
    kind,
    landmarkId: landmark?.id || null,
    routeId: route?.id || null,
    checkpointId: checkpoint?.id || null,
    portId: port?.id || null,
    seaLaneId: seaLane?.id || null,
    coastalFeatureId: coastalFeature?.id || null,
    mountainPassId: mountainSpine?.pass?.id || null,
    waterwayId: waterway?.id || null,
    description,
    encounter,
    hazard,
    tags: uniqueText([
      kind,
      route ? `route:${route.id}` : null,
      checkpoint ? `checkpoint:${checkpoint.id}` : null,
      port ? `port:${port.id}` : null,
      seaLane ? `sea-lane:${seaLane.id}` : null,
      coastalFeature ? `coast:${coastalFeature.id}` : null,
      mountainSpine?.pass ? `mountain-pass:${mountainSpine.pass.id}` : null,
      waterway ? `${waterway.kind}:${waterway.id}` : null,
    ]),
  };
}

function sampleContent(area, ecology, context, land, seed, x, y) {
  const ecologyEncounterSource = weightedPick(
    ecology.encounters || [],
    worldRandom(seed, "world:content:ecology-encounter", ecology.id, x, y),
  );
  const ecologyEncounter = ecologyEncounterSource ? {
    id: `encounter:${slugify(ecologyEncounterSource.kind || ecologyEncounterSource.desc)}`,
    kind: ecologyEncounterSource.kind || null,
    label: ecologyEncounterSource.desc || titleFromSlug(ecologyEncounterSource.kind),
    posture: ecologyEncounterSource.posture || "neutral",
    source: ecology.id,
  } : null;
  const encounter = context.encounter
    ? descriptor("encounter", context.encounter, context.kind)
    : (ecologyEncounter ? { ...ecologyEncounter } : { ...area.encounter });
  const travelHazard = context.hazard
    ? descriptor("hazard", context.hazard, context.kind)
    : { ...area.travelHazard };
  const threat = ecologyEncounter?.posture === "hostile" && context.kind === "wilderness"
    ? descriptor("threat", ecologyEncounter.label, ecology.id)
    : { ...area.threat };
  return {
    settlementType: land ? (context.kind === "port" ? "port-city" : area.settlementType) : null,
    encounter,
    ecologyEncounter,
    threat,
    travelHazard,
    authority: {
      ...area.authority,
      leader: clonePerson(area.authority?.leader),
      governor: clonePerson(area.authority?.governor),
      forces: [...(area.authority?.forces || [])],
    },
    culture: area.culture ? {
      ...area.culture,
      languages: [...area.culture.languages],
      values: [...area.culture.values],
      architecture: [...area.culture.architecture],
      customs: [...area.culture.customs],
      faiths: [...area.culture.faiths],
    } : null,
    economy: area.economy ? {
      ...area.economy,
      exports: [...area.economy.exports],
      imports: [...area.economy.imports],
      tradeNotes: [...area.economy.tradeNotes],
    } : null,
    resources: uniqueText([ecology.resources, area.resources]),
    context: { ...context, tags: [...context.tags] },
    description: `${area.description} ${context.description}`,
    tags: uniqueText([area.tags, ecology.tags, context.tags, `ecology:${ecology.id}`]),
  };
}

// Lightweight physical survey used by the interactive world atlas raster. It
// resolves the same landform, hydrology, ecology, realm, and route layers as
// sampleContinent while skipping province, content, and generated-site
// sampling, so painting thousands of cells stays responsive. Terrain, land,
// coast, and realm results must remain identical to sampleContinent — the
// atlas is a projection of the world, never a second authority. Hidden
// generated sites are deliberately absent from this sample.
export function surveyAtlas(x, y, seed = DEFAULT_WORLD_SEED) {
  const rawLandValue = continentValueAt(x, y, seed);
  const { xmin, xmax, ymin, ymax } = CONTINENT.bounds;
  const withinEnvelope = x >= xmin && x <= xmax && y >= ymin && y <= ymax;
  const landValue = withinEnvelope && rawLandValue > 0
    ? rawLandValue
    : Math.min(rawLandValue, -0.0001);
  const land = landValue > 0;
  const realmId = realmIdAt(x, y, seed);
  const realm = realmDefinition(realmId);
  const regionId = regionIdAt(x, y, seed);
  const region = regionDefinition(regionId);
  const climate = climateAt(x, y, regionId, realmId, seed);
  const ecologyId = ecologyIdFor({ landValue, ...climate }, region, realm);
  let terrain = terrainForEcology(ecologyId, climate, region, realm, seed, x, y);
  const route = routeAt(x, y);
  const waterway = waterwayAt(x, y);
  if (waterway) terrain = "water";
  if (route && land) terrain = "road";
  const authoredLandmark = landmarkAt(x, y);
  const coast = land && (landValue < 0.065 || !!(authoredLandmark?.coastalFeatureId
    && COASTAL_FEATURE_BY_ID.get(authoredLandmark.coastalFeatureId)));
  return {
    land,
    coast,
    terrain,
    elevation: roundMetric(climate.elevation),
    realmId,
    regionId,
    ecologyId,
    routeId: route?.id || null,
    waterwayId: waterway?.id || null,
  };
}

// Full physical/cultural sample used by the tile generator and continent atlas.
export function sampleContinent(x, y, seed = DEFAULT_WORLD_SEED) {
  const rawLandValue = continentValueAt(x, y, seed);
  const { xmin, xmax, ymin, ymax } = CONTINENT.bounds;
  const withinEnvelope = x >= xmin && x <= xmax && y >= ymin && y <= ymax;
  const route = routeAt(x, y);
  const seaLane = seaLaneAt(x, y);
  const authoredLandmark = landmarkAt(x, y);
  const port = authoredLandmark?.kind === "port" ? {
    id: authoredLandmark.id,
    name: authoredLandmark.name,
    provinceId: authoredLandmark.provinceId || null,
    factionId: authoredLandmark.factionId || null,
  } : null;
  const coastalFeature = authoredLandmark?.coastalFeatureId
    ? COASTAL_FEATURE_BY_ID.get(authoredLandmark.coastalFeatureId) || null
    : null;
  const landValue = withinEnvelope && rawLandValue > 0
    ? rawLandValue
    : Math.min(rawLandValue, -0.0001);
  const realmId = realmIdAt(x, y, seed);
  const realm = realmDefinition(realmId);
  const regionId = regionIdAt(x, y, seed);
  const region = regionDefinition(regionId);
  const climate = climateAt(x, y, regionId, realmId, seed);
  const ecologyId = ecologyIdFor({ landValue, ...climate }, region, realm);
  const ecology = ecologyDefinition(ecologyId);
  const area = worldAreaAt(x, y, regionId, seed, realmId);
  const province = provinceById(area.province?.id) || provinceAt(x, y, realmId, regionId, seed);
  const culture = CULTURE_BY_REALM.get(realmId) || null;
  const waterway = waterwayAt(x, y);
  const checkpoint = checkpointAt(x, y);
  let terrain = terrainForEcology(ecologyId, climate, region, realm, seed, x, y);
  let crossing = null;
  if (waterway) terrain = "water";
  if (route && landValue > 0) {
    crossing = waterway ? waterway.kind : null;
    terrain = "road";
  }
  const mountainSpine = climate.mountainSpine.boost > 0 ? {
    id: MOUNTAIN_SPINE.id,
    name: MOUNTAIN_SPINE.name,
    elevationBoost: roundMetric(climate.mountainSpine.boost),
    pass: climate.mountainSpine.pass ? {
      id: climate.mountainSpine.pass.id,
      name: climate.mountainSpine.pass.name,
      routeIds: [...climate.mountainSpine.pass.routeIds],
    } : null,
  } : null;
  const coast = landValue > 0 && (landValue < 0.065 || !!coastalFeature);
  const context = locationContext({
    landmark: authoredLandmark,
    route,
    checkpoint,
    port,
    seaLane,
    coastalFeature,
    mountainSpine,
    waterway,
    coast,
  });
  const content = sampleContent(area, ecology, context, landValue > 0, seed, x, y);
  const site = generatedSiteAt({
    x,
    y,
    seed,
    region,
    realm,
    province,
    culture,
    ecology,
    area,
    terrain,
    route,
    context,
  });
  return {
    generatorVersion: WORLD_GENERATOR_VERSION,
    seed,
    continentId: CONTINENT.id,
    land: landValue > 0,
    coast,
    landValue,
    realmId,
    realm: {
      id: realm.id,
      name: realm.name,
      direction: realm.direction,
      biomeId: realm.biomeId,
      biomeName: realm.biomeName,
      capitalId: realm.capital.id,
      cultureId: content.culture?.id || null,
      economyId: content.economy?.id || null,
      factionId: content.authority.factionId || realm.faction.id,
      ruler: { ...realm.ruler },
    },
    regionId,
    province: area.province ? {
      ...area.province,
      governor: clonePerson(area.province.governor),
      terrainTags: [...area.province.terrainTags],
      cultureNotes: [...area.province.cultureNotes],
    } : null,
    ecologyId,
    area,
    content,
    elevation: roundMetric(climate.elevation),
    moisture: roundMetric(climate.moisture),
    temperature: roundMetric(climate.temperature),
    ruggedness: roundMetric(climate.ruggedness),
    mountainSpine,
    terrain,
    route,
    checkpoint,
    port,
    coastalFeature,
    seaLane,
    waterway,
    crossing,
    resources: [...content.resources],
    tags: [...content.tags],
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
      realmId: sample.site.realmId,
      provinceId: sample.site.provinceId,
      settlementType: sample.site.settlementType,
      encounter: { ...sample.site.encounter },
      threat: { ...sample.site.threat },
      travelHazard: { ...sample.site.travelHazard },
      authority: {
        ...sample.site.authority,
        leader: clonePerson(sample.site.authority?.leader),
        governor: clonePerson(sample.site.authority?.governor),
        forces: [...(sample.site.authority?.forces || [])],
      },
      resources: [...sample.site.resources],
      context: sample.site.context ? { ...sample.site.context, tags: [...sample.site.context.tags] } : null,
      tags: [...sample.site.tags],
    },
  } : null;
  return {
    terrain: sample.terrain,
    poi,
    procedural: true,
    realmId: sample.realmId,
    macroBiome: sample.realm.biomeId,
    regionId: sample.regionId,
    province: sample.province,
    ecology: sample.ecologyId,
    area: sample.area,
    content: sample.content,
    route: sample.route,
    checkpoint: sample.checkpoint,
    port: sample.port,
    coastalFeature: sample.coastalFeature,
    seaLane: sample.seaLane,
    mountainSpine: sample.mountainSpine,
    waterway: sample.waterway,
    crossing: sample.crossing,
    resources: sample.resources,
    worldgen: {
      version: sample.generatorVersion,
      continentId: sample.continentId,
      realm: sample.realm,
      provinceId: sample.province?.id || null,
      authority: sample.content.authority,
      culture: sample.content.culture,
      economy: sample.content.economy,
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
