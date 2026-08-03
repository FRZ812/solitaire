import { roadEventsWhere } from "../data/road-events.js";
import { getTile } from "./world.js";
import { nearestInhabitedLandmark } from "./world-generation.js";

// Where a road event can happen, and how often.
//
// Encounters roll per hex because they answer "who is out here". A road event
// answers "what happened on this journey", so the leg gets one roll however long
// it is -- per-hex would hand a fortnight's march a dozen tinkers.
//
// The chance rises with the ground covered and then stops. A short errand
// usually has no story in it; a long march usually does; and even at the ceiling
// some marches are nothing but landscape, which is honest.
export const ROAD_EVENT_BASE = 0.1;
export const ROAD_EVENT_PER_HEX = 0.02;
export const ROAD_EVENT_CEIL = 0.55;

// How close a town has to be for the road to be working its country.
export const SETTLED_RADIUS = 4;

// A route is mostly ordinary paving -- eighty-odd percent of the hexes on a real
// journey classify as `road` -- so drawing the spot uniformly would bury the
// bridges and borders under the miles between them. These weight the draw toward
// the ground worth recounting, which is also how anyone actually tells the story
// of a journey: the crossing gets a sentence, the twelfth mile of road does not.
const WHERE_WEIGHT = Object.freeze({ crossing: 4, border: 4, settled: 2, wild: 2, road: 1 });

export function roadEventChance(hexes) {
  return Math.min(ROAD_EVENT_CEIL, ROAD_EVENT_BASE + Math.max(0, hexes) * ROAD_EVENT_PER_HEX);
}

// Which table this hex belongs to, from facts the tile already carries. Pure in
// the tile, so the same hex is always eligible for the same kind of thing --
// only whether it is drawn is rolled.
export function roadEventWhere(tile, previousTile, x, y) {
  if (!tile) return null;
  // A staffed customs fort is authored ground that is also a site, so it is
  // asked about before the exclusions below.
  if (tile.checkpoint) return "checkpoint";
  // Ground that narrates itself: a city's own handcrafted streets, or any site
  // the party arrives at. A road event is what is met between places.
  if (!tile.procedural || tile.terrain === "water" || tile.poi) return null;
  if (tile.route && (tile.waterway || tile.crossing)) return "crossing";
  // One authority handing over to another, which is only legible on a road.
  if (tile.route && previousTile?.regionId && tile.regionId !== previousTile.regionId) return "border";
  if (nearestInhabitedLandmark(x, y, SETTLED_RADIUS)) return "settled";
  if (tile.route) return "road";
  return "wild";
}

// A staffed customs fort is authored ground with a named garrison on it. It is
// checked rather than rolled for, and it is the one road event that has always
// been in the data and never been read by travel.
function checkpointEvent(post) {
  return {
    id: `checkpoint:${post.id}`,
    where: "checkpoint",
    offer: "search",
    label: `the gate at ${post.name}`,
    detail: `${post.name} stands astride the road, held by ${post.garrison}. ${post.description} The gate stays shut until the party has been looked over and written into the book.`,
    stops: true,
  };
}

// One event for the leg, or none. The last hex is never eligible: that is where
// the party stops anyway, and a road event is a thing met on the way to
// somewhere rather than a second reason for having arrived.
export function rollRoadEvent(state, path) {
  if (!Array.isArray(path) || path.length < 3) return null;
  const eligible = [];
  let previousTile = getTile(state, path[0].x, path[0].y);
  for (let i = 1; i < path.length - 1; i++) {
    const p = path[i];
    const tile = getTile(state, p.x, p.y);
    const where = roadEventWhere(tile, previousTile, p.x, p.y);
    previousTile = tile;
    if (!where) continue;
    if (where === "checkpoint") return { event: checkpointEvent(tile.checkpoint), atTile: p, atIndex: i };
    eligible.push({ where, atTile: p, atIndex: i });
  }
  if (!eligible.length) return null;
  if (Math.random() >= roadEventChance(path.length - 1)) return null;

  const spot = drawSpot(eligible);
  const options = roadEventsWhere(spot.where);
  if (!options.length) return null;
  const event = options[Math.floor(Math.random() * options.length) % options.length];
  return { event, atTile: spot.atTile, atIndex: spot.atIndex };
}

function drawSpot(eligible) {
  const total = eligible.reduce((sum, spot) => sum + (WHERE_WEIGHT[spot.where] || 1), 0);
  let roll = Math.random() * total;
  for (const spot of eligible) {
    roll -= WHERE_WEIGHT[spot.where] || 1;
    if (roll <= 0) return spot;
  }
  return eligible[eligible.length - 1];
}
