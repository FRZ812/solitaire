// Splits a route into the legs a journey is actually made of.
//
// A march used to end at a fixed hex count, which meant the party stopped in the
// middle of nothing and the only thing that could interrupt a journey was an
// encounter. A leg instead ends where a traveller would stop: at a place worth
// naming, at a river crossing, at a border, where the going changes, or when the
// day runs out. What the party passed on the way is collected as it goes, so a
// leg has something to say even when nothing happens.
//
// Pure and bounded: it reads tiles through `getTile` and plans at most a few
// legs ahead, so a continent-spanning route never generates the whole path.

import { TERRAINS } from "../data/terrains.js";
import { getTile, travelMinutes } from "./world.js";
import { siteKnowledgeGrade } from "./world-sighting.js";

// A leg shorter than this is not a journey stage, it is a stumble. Boundaries
// that fall inside it are absorbed into the leg rather than cutting it.
//
// The step count alone is not enough, because one hex means two very different
// things: a handcrafted city hex is a street corner minutes away, a continental
// hex is six kilometres and most of a morning. A step floor tuned for streets
// would swallow every boundary on the continent and leave nothing but nightfall.
// So a leg is only too short when it is short by BOTH measures.
export const MIN_LEG_STEPS = 3;
const MIN_LEG_DAY_SHARE = 0.25;

export function legTooShort(steps, minutes, dayMinutes) {
  return steps < MIN_LEG_STEPS && minutes < dayMinutes * MIN_LEG_DAY_SHARE;
}
// Eight hours of walking. Past this the party is making camp whatever the ground
// looks like.
export const DAY_MARCH_MINUTES = 480;

// The one steerable decision a leg carries. Pace does not change how fast the
// ground is crossed — a mile of marsh is a mile of marsh — it changes how long
// the party stays on its feet before making camp, and how much they walk into.
export const TRAVEL_PACES = Object.freeze({
  careful: Object.freeze({
    id: "careful", label: "Careful", dayMinutes: 360, riskMult: 0.7,
    note: "Shorter days, eyes up. Less ground, less trouble.",
  }),
  steady: Object.freeze({
    id: "steady", label: "Steady", dayMinutes: DAY_MARCH_MINUTES, riskMult: 1,
    note: "A full day's march and a camp before dark.",
  }),
  forced: Object.freeze({
    id: "forced", label: "Forced", dayMinutes: 600, riskMult: 1.35,
    note: "Walk past the light. More ground, and more of whatever is out there.",
  }),
});

export function travelPace(id) {
  return TRAVEL_PACES[id] || TRAVEL_PACES.steady;
}

// Ground that changes how a journey is walked rather than merely what it looks
// like. Crossing into or out of one of these is worth a stop.
const HARD_GOING = new Set(["mountains", "marsh", "swamp", "jungle", "desert"]);

export const LEG_BOUNDARIES = Object.freeze({
  destination: Object.freeze({ rank: 0, label: "Arrival" }),
  waypoint: Object.freeze({ rank: 1, label: "A place on the way" }),
  crossing: Object.freeze({ rank: 2, label: "A crossing" }),
  border: Object.freeze({ rank: 3, label: "A change of country" }),
  going: Object.freeze({ rank: 4, label: "The going changes" }),
  nightfall: Object.freeze({ rank: 5, label: "The day runs out" }),
  limit: Object.freeze({ rank: 6, label: "As far as the party presses" }),
});

// A place the party would name when it got there. Authored POIs qualify once
// they are not hidden; a generated site qualifies when travellers name it,
// which is the same rule the map uses to show it before arrival.
function waypointName(tile) {
  const poi = tile?.poi;
  if (!poi) return null;
  if (poi.type !== "hidden") return poi.name || poi.partName || null;
  const generated = poi.generated;
  if (!generated) return null;
  // Distance is zero because the party is standing on it by the time this
  // matters; only the `named`/`secret` half of the rule is doing work here.
  return siteKnowledgeGrade(generated.sighting, { distance: 0 }) === "rumoured"
    ? generated.name
    : null;
}

function isCrossing(tile) {
  return !!tile?.crossing || !!(tile?.waterway && tile?.route);
}

function boundaryAt(tile, previousTile, legStart) {
  const name = waypointName(tile);
  if (name) return { kind: "waypoint", label: name };
  if (isCrossing(tile) && !isCrossing(previousTile)) {
    return { kind: "crossing", label: tile.waterway?.name || "a crossing" };
  }
  if (tile.regionId && legStart.regionId && tile.regionId !== legStart.regionId) {
    return { kind: "border", label: tile.area?.name || tile.province?.name || "new country" };
  }
  if (HARD_GOING.has(tile.terrain) !== HARD_GOING.has(legStart.terrain)) {
    return { kind: "going", label: TERRAINS[tile.terrain]?.label || tile.terrain };
  }
  return null;
}

// Scenery and sighted sites the party went past. This is what a leg reports when
// nothing happened, which is most legs.
function collectPassed(passed, tile) {
  for (const entry of tile?.scenery || []) {
    if (passed.length >= 6) return;
    if (!passed.some((seen) => seen.kind === entry.kind)) {
      passed.push({ kind: entry.kind, label: entry.label, detail: entry.detail });
    }
  }
}

// Plans the next leg only. `from` is the index in `path` the party starts at.
export function planLeg(state, path, from = 0, { maxSteps = 48, pace = "steady" } = {}) {
  if (!Array.isArray(path) || from >= path.length - 1) return null;
  const dayMinutes = travelPace(pace).dayMinutes;
  const startTile = getTile(state, path[from].x, path[from].y);
  const passed = [];
  let previousTile = startTile;
  let minutes = 0;
  // The last index always yields a hard-cap boundary, so the scan is guaranteed
  // to settle on or before it.
  let to = path.length - 1;
  let boundary = null;

  for (let i = from + 1; i < path.length && !boundary; i++) {
    const tile = getTile(state, path[i].x, path[i].y);
    const steps = i - from;
    minutes += travelMinutes(previousTile, tile);
    collectPassed(passed, tile);

    const candidate = i === path.length - 1
      ? { kind: "destination", label: waypointName(tile) || TERRAINS[tile.terrain]?.label || "the destination" }
      : minutes >= dayMinutes
        ? { kind: "nightfall", label: `Camp in the ${(TERRAINS[tile.terrain]?.label || "open").toLowerCase()}` }
        : steps >= maxSteps
          ? { kind: "limit", label: TERRAINS[tile.terrain]?.label || "open ground" }
          : boundaryAt(tile, previousTile, startTile);
    const hardCap = candidate
      && (candidate.kind === "destination" || candidate.kind === "nightfall" || candidate.kind === "limit");

    // A boundary inside the minimum is passed over rather than taken, so the
    // party does not stop three times inside one valley.
    if (candidate && (hardCap || !legTooShort(steps, minutes, dayMinutes))) {
      boundary = candidate;
      to = i;
    }
    previousTile = tile;
  }

  return {
    from,
    to,
    path: path.slice(from, to + 1),
    end: { x: path[to].x, y: path[to].y },
    steps: to - from,
    minutes,
    boundary,
    arrived: to === path.length - 1,
    passed,
  };
}

// Up to `maxLegs` legs ahead, for previewing a journey without walking the whole
// continent through the tile generator.
export function planExpedition(state, path, { maxSteps = 48, maxLegs = 4, pace = "steady" } = {}) {
  const legs = [];
  let cursor = 0;
  while (legs.length < maxLegs) {
    const leg = planLeg(state, path, cursor, { maxSteps, pace });
    if (!leg) break;
    legs.push({ ...leg, index: legs.length });
    if (leg.arrived) break;
    cursor = leg.to;
  }
  return {
    legs,
    complete: legs.length > 0 && legs[legs.length - 1].arrived,
    totalSteps: Math.max(0, (path?.length || 1) - 1),
  };
}

// Why the party stopped here rather than pressing on, phrased for the narrator
// brief and the travel log. Only meaningful for a leg that did not arrive.
export function describeLegStop(leg) {
  const boundary = leg?.boundary;
  const label = boundary?.label || "";
  switch (boundary?.kind) {
    case "waypoint": return `where ${label} gives the party a reason to halt`;
    case "crossing": return `at ${label}, where the way meets the water`;
    case "border": return `at the edge of ${label}`;
    case "going": return `where the ground turns to ${label.toLowerCase()}`;
    case "nightfall": return "where the light goes and the party makes camp";
    default: return "as far as the party presses for now — the rest of the way still lies ahead";
  }
}

// One line naming what the leg went past, for the narrator brief and the travel
// log. Returns "" when the leg crossed nothing worth remarking on.
export function describePassage(leg) {
  const labels = (leg?.passed || []).map((entry) => entry.label).filter(Boolean);
  if (!labels.length) return "";
  return labels.length === 1
    ? labels[0]
    : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}
