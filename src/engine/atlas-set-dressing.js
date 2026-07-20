import {
  CONTINENT,
  CONTINENT_HOT_SPRINGS,
  CONTINENT_LAKES,
  CONTINENT_ROUTES,
  CONTINENT_WATERWAYS,
  LANDMARKS,
} from "../data/continent.js";
import { surveyAtlas } from "./world-generation.js";

const TAU = Math.PI * 2;
const ROUTE_BEAT_KINDS = Object.freeze(["hamlet", "waystation", "camp", "shrine"]);
const WILD_KINDS = Object.freeze(["ruin", "standing-stones", "watchtower", "wild-camp"]);
const STATIC_SEED_CACHE_LIMIT = 4;
const routeBeatCache = new Map();
const bridgeBeatCache = new Map();

function rememberStaticBeats(cache, seed, build) {
  const key = String(seed);
  const cached = cache.get(key);
  if (cached) return cached;
  const entries = Object.freeze(build().map((entry) => Object.freeze(entry)));
  cache.set(key, entries);
  while (cache.size > STATIC_SEED_CACHE_LIMIT) {
    cache.delete(cache.keys().next().value);
  }
  return entries;
}

function hashText(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  hash += hash << 13;
  hash ^= hash >>> 7;
  hash += hash << 3;
  hash ^= hash >>> 17;
  hash += hash << 5;
  return hash >>> 0;
}

function randomFor(seed, stream, ...parts) {
  return hashText(`${seed}|${stream}|${parts.join("|")}`) / 0x100000000;
}

function axialDistance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dx + dy));
}

function pointSegmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const denominator = dx * dx + dy * dy;
  if (denominator <= 0.000001) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / denominator,
  ));
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
}

function pathDistance(point, waypoints) {
  let distance = Infinity;
  for (let index = 1; index < waypoints.length; index += 1) {
    distance = Math.min(distance, pointSegmentDistance(point, waypoints[index - 1], waypoints[index]));
  }
  return distance;
}

function authoredWaterClear(coord, padding = 0) {
  for (const lake of CONTINENT_LAKES) {
    if (axialDistance(coord, lake.center) <= lake.radius + padding) return false;
  }
  for (const spring of CONTINENT_HOT_SPRINGS) {
    if (axialDistance(coord, spring.center) <= spring.radius + padding) return false;
  }
  return true;
}

function landmarkClear(coord, padding = 4) {
  return LANDMARKS.every((landmark) => axialDistance(coord, landmark.coord) >= padding);
}

function chunkOwns(coord, cx, cy, size = CONTINENT.chunkSize) {
  return Math.floor(coord.x / size) === cx && Math.floor(coord.y / size) === cy;
}

function pointAtPathDistance(waypoints, targetDistance) {
  let walked = 0;
  for (let index = 1; index < waypoints.length; index += 1) {
    const start = waypoints[index - 1];
    const end = waypoints[index];
    const segment = axialDistance(start, end);
    if (segment <= 0) continue;
    if (walked + segment >= targetDistance) {
      const progress = (targetDistance - walked) / segment;
      return {
        coord: {
          x: start.x + (end.x - start.x) * progress,
          y: start.y + (end.y - start.y) * progress,
        },
        direction: { x: end.x - start.x, y: end.y - start.y },
      };
    }
    walked += segment;
  }
  return null;
}

function buildRouteBeats(seed) {
  const result = [];
  for (const route of CONTINENT_ROUTES) {
    const totalDistance = route.waypoints.slice(1).reduce((sum, point, index) => (
      sum + axialDistance(route.waypoints[index], point)
    ), 0);
    let beat = 0;
    let distance = 5 + randomFor(seed, "dressing:route:first", route.id) * 6;
    while (distance < totalDistance) {
      const sample = pointAtPathDistance(route.waypoints, distance);
      if (!sample) break;
      const length = Math.max(0.001, Math.hypot(sample.direction.x, sample.direction.y));
      const side = randomFor(seed, "dressing:route:side", route.id, beat) < 0.5 ? -1 : 1;
      const offset = 1 + Math.floor(randomFor(seed, "dressing:route:offset", route.id, beat) * 3);
      const coord = {
        x: sample.coord.x + (-sample.direction.y / length) * offset * side,
        y: sample.coord.y + (sample.direction.x / length) * offset * side,
      };
      if (surveyAtlas(coord.x, coord.y, seed).land
        && authoredWaterClear(coord, 1.5)
        && landmarkClear(coord, 5)) {
        const kindIndex = Math.floor(randomFor(seed, "dressing:route:kind", route.id, beat) * ROUTE_BEAT_KINDS.length);
        const terrain = surveyAtlas(coord.x, coord.y, seed);
        result.push({
          id: `route:${route.id}:${beat}`,
          source: "route",
          kind: ROUTE_BEAT_KINDS[Math.min(ROUTE_BEAT_KINDS.length - 1, kindIndex)],
          routeId: route.id,
          x: coord.x,
          y: coord.y,
          rotation: Math.atan2(sample.direction.y, sample.direction.x),
          scale: 0.82 + randomFor(seed, "dressing:route:scale", route.id, beat) * 0.48,
          realmId: terrain.realmId,
          variantSeed: hashText(`${seed}|route|${route.id}|${beat}`),
        });
      }
      distance += 8 + randomFor(seed, "dressing:route:spacing", route.id, beat) * 7;
      beat += 1;
    }
  }
  return result;
}

function routeBeats(seed, cx, cy) {
  return rememberStaticBeats(routeBeatCache, seed, () => buildRouteBeats(seed))
    .filter((entry) => chunkOwns(entry, cx, cy));
}

function segmentIntersection(a, b, c, d) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const cdx = d.x - c.x;
  const cdy = d.y - c.y;
  const denominator = abx * cdy - aby * cdx;
  if (Math.abs(denominator) < 0.000001) return null;
  const acx = c.x - a.x;
  const acy = c.y - a.y;
  const t = (acx * cdy - acy * cdx) / denominator;
  const u = (acx * aby - acy * abx) / denominator;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a.x + abx * t, y: a.y + aby * t, direction: { x: abx, y: aby } };
}

function buildBridgeBeats(seed) {
  const result = [];
  const occupiedByChunk = new Map();
  for (const route of CONTINENT_ROUTES) {
    for (let routeIndex = 1; routeIndex < route.waypoints.length; routeIndex += 1) {
      const routeStart = route.waypoints[routeIndex - 1];
      const routeEnd = route.waypoints[routeIndex];
      for (const waterway of CONTINENT_WATERWAYS) {
        for (let waterIndex = 1; waterIndex < waterway.waypoints.length; waterIndex += 1) {
          const crossing = segmentIntersection(
            routeStart,
            routeEnd,
            waterway.waypoints[waterIndex - 1],
            waterway.waypoints[waterIndex],
          );
          if (!crossing) continue;
          const ownerKey = `${Math.floor(crossing.x / CONTINENT.chunkSize)},${Math.floor(crossing.y / CONTINENT.chunkSize)}`;
          const occupied = occupiedByChunk.get(ownerKey) || [];
          if (occupied.some((coord) => axialDistance(coord, crossing) < 3)) continue;
          occupied.push(crossing);
          occupiedByChunk.set(ownerKey, occupied);
          const terrain = surveyAtlas(crossing.x, crossing.y, seed);
          result.push({
            id: `bridge:${route.id}:${waterway.id}:${routeIndex}:${waterIndex}`,
            source: "bridge",
            kind: "bridge",
            routeId: route.id,
            waterwayId: waterway.id,
            x: crossing.x,
            y: crossing.y,
            rotation: Math.atan2(crossing.direction.y, crossing.direction.x),
            scale: 0.9 + randomFor(seed, "dressing:bridge:scale", route.id, waterway.id) * 0.32,
            realmId: terrain.realmId,
            variantSeed: hashText(`${seed}|bridge|${route.id}|${waterway.id}|${routeIndex}|${waterIndex}`),
          });
        }
      }
    }
  }
  return result;
}

function bridgeBeats(seed, cx, cy) {
  return rememberStaticBeats(bridgeBeatCache, seed, () => buildBridgeBeats(seed))
    .filter((entry) => chunkOwns(entry, cx, cy));
}

function wildScatter(seed, cx, cy, cap = 8) {
  const size = CONTINENT.chunkSize;
  const step = 8;
  const xmin = cx * size;
  const xmax = xmin + size;
  const ymin = cy * size;
  const ymax = ymin + size;
  const result = [];
  const gx0 = Math.floor((xmin - step) / step);
  const gx1 = Math.ceil((xmax + step) / step);
  const gy0 = Math.floor((ymin - step) / step);
  const gy1 = Math.ceil((ymax + step) / step);
  for (let gy = gy0; gy <= gy1 && result.length < cap; gy += 1) {
    for (let gx = gx0; gx <= gx1 && result.length < cap; gx += 1) {
      const chance = randomFor(seed, "dressing:scatter:chance", gx, gy);
      if (chance > 0.48) continue;
      const coord = {
        x: gx * step + 1 + randomFor(seed, "dressing:scatter:x", gx, gy) * (step - 2),
        y: gy * step + 1 + randomFor(seed, "dressing:scatter:y", gx, gy) * (step - 2),
      };
      if (!chunkOwns(coord, cx, cy)) continue;
      const sample = surveyAtlas(coord.x, coord.y, seed);
      if (!sample.land || sample.terrain === "water" || sample.terrain === "road") continue;
      if (!authoredWaterClear(coord, 2.5) || !landmarkClear(coord, 6)) continue;
      if (CONTINENT_ROUTES.some((route) => pathDistance(coord, route.waypoints) < 3.5)) continue;
      if (CONTINENT_WATERWAYS.some((waterway) => pathDistance(coord, waterway.waypoints) < 3)) continue;
      if (result.some((entry) => axialDistance(coord, entry) < 6)) continue;
      let kindIndex = Math.floor(randomFor(seed, "dressing:scatter:kind", gx, gy) * WILD_KINDS.length);
      if (sample.terrain === "mountains" || sample.terrain === "hills") kindIndex = chance < 0.2 ? 2 : kindIndex;
      result.push({
        id: `scatter:${gx}:${gy}`,
        source: "scatter",
        kind: WILD_KINDS[Math.min(WILD_KINDS.length - 1, kindIndex)],
        x: coord.x,
        y: coord.y,
        rotation: randomFor(seed, "dressing:scatter:rotation", gx, gy) * TAU,
        scale: 0.72 + randomFor(seed, "dressing:scatter:scale", gx, gy) * 0.72,
        realmId: sample.realmId,
        variantSeed: hashText(`${seed}|scatter|${gx}|${gy}`),
      });
    }
  }
  return result;
}

/**
 * Deterministic decorative atlas dressing for one canonical continent chunk.
 * Entries are presentation-only: they never enter world state, pathfinding,
 * picking, or saves.
 */
export function setDressingForChunk(seed = CONTINENT.seed, cx = 0, cy = 0, options = {}) {
  const scatterCap = Number.isFinite(options.scatterCap)
    ? Math.max(0, Math.floor(options.scatterCap))
    : 8;
  return [
    ...bridgeBeats(seed, cx, cy),
    ...routeBeats(seed, cx, cy),
    ...wildScatter(seed, cx, cy, scatterCap),
  ].sort((a, b) => a.id.localeCompare(b.id));
}

export const atlasSetDressingInternals = Object.freeze({
  axialDistance,
  authoredWaterClear,
  chunkOwns,
  pathDistance,
  pointSegmentDistance,
  randomFor,
  segmentIntersection,
});
