// Top-level configuration constants.
export const MODEL = "claude-opus-4-7";
export const HISTORY_LIMIT = 100;
export const STORAGE_KEY = "solitaire-state-v10";

// v12 scale: hexes are ~250m so each tile is a single concrete vantage rather
// than a region. Travel base drops accordingly, sight is normally short, and
// the new vista mechanic (see world.js) does the long-range reveal work.
export const SIGHT_RADIUS = 3;
export const MAP_VIEW_RADIUS = 30;
// A single travel action advances the party at most this many hexes toward the
// chosen destination (or until an encounter halts them); farther trips take
// several legs, so the world can't be skipped in one tap. (engine: handleTravel)
export const MAX_TRAVEL_HEXES = 6;
// Flight & teleport travel modes (gated behind learned spells; engine/world.js,
// data/travel-spells.js). Flight covers more ground per leg, ignores terrain, and
// reveals a wider view; teleports jump straight to a target.
export const FLY_MIN_PER_HEX = 4;       // fast, flat air time per hex (ignores terrain)
export const FLY_DURATION_MIN = 60;     // one casting of Fly keeps you aloft for an hour
export const FLY_TRAVEL_HEXES = FLY_DURATION_MIN / FLY_MIN_PER_HEX; // the hour's flight distance (15 hexes)
export const FLY_REVEAL_RADIUS = 5;     // the wide view from the air
export const DIMENSION_DOOR_RANGE = 8;  // short-hop teleport range (seen tiles)
// Aerial ambush: only another flier can reach you aloft, and only over dangerous country.
// No risk below AERIAL_MIN_LEVEL (tamed lands); above it the per-hex chance climbs with the
// region's danger, so crossing the deep wilds by air is a gamble, not a free pass.
export const AERIAL_MIN_LEVEL = 3;            // region difficulty (regions.js) at/above which sky-predators hunt
export const AERIAL_CHANCE_PER_LEVEL = 0.015; // per-hex ambush chance per level above AERIAL_MIN_LEVEL-1
export const AERIAL_SIGHTING_DAYS = 4;        // how long a town keeps talking about a flyover
export const TRAVEL_BASE_MIN = 12;
export const TILE_PX = 38;

export const ATTR_KEYS = ["body", "reflex", "vigor", "mind", "wit", "presence"];
export const ATTR_LABELS = {
  body: "Body",
  reflex: "Reflex",
  vigor: "Vigor",
  mind: "Mind",
  wit: "Wit",
  presence: "Presence",
};

export const ORIGIN_LABEL = {
  north: "Northern",
  east: "Eastern",
  south: "Southern",
  west: "Western",
  central: "Central",
};

export function originLabel(o) {
  if (!o) return null;
  return ORIGIN_LABEL[o] || (o[0].toUpperCase() + o.slice(1));
}
