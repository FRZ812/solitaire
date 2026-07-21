// Deterministic building layout for the authored Whitemarch capital. Pure and
// cycle-free: it reads only the authored city projection and seeded noise, so
// the worker and the renderer produce identical placements. Everything here is
// presentation-only — it never touches world state, pathfinding, or saves.
import { WHITEMARCH_CAPITAL, WHITEMARCH_GATES, WHITEMARCH_LANDMARKS, whitemarchTileAt } from "../../data/whitemarch-capital.js";
import { atlas3dAxialToScene, coordinateNoise } from "./worldAtlas3dModel.js";

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// Districts that read as dense housing. Gardens, military courts, and market
// plazas stay mostly open so their centerpieces and green space read clearly.
const DISTRICT_HOUSING_DENSITY = Object.freeze({
  "grand-market": 0.35,
  "temple-steps": 0.5,
  "low-wards": 1.0,
  "chain-ward": 0.45,
  "guild-court": 0.7,
  "river-docks": 0.8,
  "crown-gate": 0.6,
  "iron-quarter": 0.9,
  "noble-rise": 0.4,
  "citadel-ward": 0.3,
  "caravan-ward": 0.65,
  "outer-works": 0.3,
});

function houseSalt(seed) {
  return `${seed}|city-house`;
}

// Place 1–3 houses inside one built-up tile, jittered within the hex so wards
// read as organic blocks rather than a stamped grid. count scales with the
// district's density and the quality tier's propDensity multiplier.
export function cityHousesForTile(x, y, districtId, seed, propDensity = 1) {
  const tile = whitemarchTileAt(x, y);
  if (!tile || tile.isWater || tile.isWall || tile.isBridge) return [];
  if (tile.terrain !== "settlement" && tile.terrain !== "plains") return [];
  if (tile.poiType && tile.poiType !== "landmark") return []; // leave POIs open
  const density = (DISTRICT_HOUSING_DENSITY[districtId] ?? 0.5) * propDensity;
  const baseCount = density >= 0.75 ? 3 : density >= 0.45 ? 2 : 1;
  const roll = coordinateNoise(x, y, houseSalt(seed));
  const count = Math.max(roll < density * 0.55 ? baseCount : baseCount - 1, density > 0.2 ? 1 : 0);
  if (count === 0) return [];
  const scene = atlas3dAxialToScene({ x, y });
  const houses = [];
  for (let index = 0; index < count; index += 1) {
    const angle = index * GOLDEN_ANGLE + roll * Math.PI * 2;
    const radius = count === 1 ? 0.05 : 0.34 + coordinateNoise(x, y, `${houseSalt(seed)}|r${index}`) * 0.12;
    houses.push({
      x: scene.x + Math.cos(angle) * radius,
      z: scene.z + Math.sin(angle) * radius,
      rotation: coordinateNoise(x, y, `${houseSalt(seed)}|rot${index}`) * Math.PI * 2,
      scale: 0.8 + coordinateNoise(x, y, `${houseSalt(seed)}|s${index}`) * 0.5,
      districtId,
    });
  }
  return houses;
}

// Wall segments along the radius-10 ring. Each wall tile becomes one crenellated
// segment oriented to the ring tangent (pointing at the next wall tile), so the
// ring reads as a continuous rampart. Gate tiles are skipped — they get gatehouses.
export function cityWallSegments(seed) {
  const segments = [];
  const wallTiles = [];
  for (let x = -12; x <= 12; x += 1) {
    for (let y = -12; y <= 12; y += 1) {
      const tile = whitemarchTileAt(x, y);
      if (tile?.isWall && !tile.isGate) wallTiles.push({ x, y });
    }
  }
  for (const { x, y } of wallTiles) {
    // Orient along the ring: find the average direction to adjacent wall tiles.
    let tangentX = 0;
    let tangentZ = 0;
    for (const other of wallTiles) {
      const dx = other.x - x;
      const dy = other.y - y;
      const distance = (Math.abs(dx) + Math.abs(dy) + Math.abs(dx + dy)) / 2;
      if (distance === 1) {
        const a = atlas3dAxialToScene({ x, y });
        const b = atlas3dAxialToScene(other);
        tangentX += b.x - a.x;
        tangentZ += b.z - a.z;
      }
    }
    const scene = atlas3dAxialToScene({ x, y });
    const rotation = Math.atan2(tangentZ, tangentX);
    segments.push({
      x: scene.x,
      z: scene.z,
      rotation,
      scale: 0.92 + coordinateNoise(x, y, `${seed}|wall`) * 0.16,
    });
  }
  return segments;
}

// The six gatehouses, placed on their authored gate tiles with an outward-facing
// rotation (toward the route mouth, away from the city center).
export function cityGatehouses() {
  return WHITEMARCH_GATES.map((gate) => {
    const scene = atlas3dAxialToScene(gate.coord);
    // Face outward: the gate sits at radius 10, so the outward direction is
    // simply away from the origin.
    const rotation = Math.atan2(scene.z, scene.x);
    return { id: gate.id, kind: "gate", x: scene.x, z: scene.z, rotation, name: gate.name };
  });
}

// Named civic centerpieces that anchor their districts. Coordinates come from
// the authored landmarks; each gets a kind the scene maps to a bespoke build.
const CENTERPIECE_KINDS = Object.freeze({
  "iron-palace": "palace",
  "grain-square": "market",
  "oath-temple": "temple",
  "seven-lamps": "temple",
  "dragon-watch": "watchtower",
  "bridge-fort": "fort",
  "road-fort": "fort",
});

export function cityCenterpieces() {
  const result = [];
  for (const landmark of WHITEMARCH_LANDMARKS) {
    const kind = CENTERPIECE_KINDS[landmark.id];
    if (!kind) continue;
    const scene = atlas3dAxialToScene(landmark.coord);
    result.push({
      id: landmark.id,
      kind,
      x: scene.x,
      z: scene.z,
      rotation: coordinateNoise(landmark.coord.x, landmark.coord.y, `cp|${landmark.id}`) * Math.PI * 2,
      name: landmark.name,
    });
  }
  return result;
}

// Aggregate the full city building layout once. The capital is small (radius
// 12) and entirely static, so the scene builds a single city group at startup
// rather than per-chunk batches — no border duplication, one instanced draw
// for houses and one for walls. propDensity thins houses by quality tier.
export function cityBuildingLayout(seed, options = {}) {
  const propDensity = Number.isFinite(options.propDensity) ? options.propDensity : 1;
  const houses = [];
  for (let x = -12; x <= 12; x += 1) {
    for (let y = -12; y <= 12; y += 1) {
      const tile = whitemarchTileAt(x, y);
      if (!tile) continue;
      for (const house of cityHousesForTile(x, y, tile.districtId, seed, propDensity)) {
        houses.push(house);
      }
    }
  }
  return {
    houses,
    walls: cityWallSegments(seed),
    gatehouses: cityGatehouses(),
    centerpieces: cityCenterpieces(),
    houseCount: houses.length,
  };
}
