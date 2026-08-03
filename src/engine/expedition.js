// Splits a route into the legs a journey is actually made of.
//
// A leg ends where a journey is really interrupted: at the destination, or when
// the packs run dry. A ford, a border stone, a change of country, a shrine, the
// fall of night — those are things a traveller walks past or sleeps through, so
// they are collected as passage rather than allowed to cut the leg. Stopping the
// party at each of them turned a fortnight on the road into a dozen prompts
// about nothing, which is exactly the tedium travel is supposed to compress.
//
// Bounded: it reads tiles through `getTile` and plans at most a few legs ahead,
// so a continent-spanning route never generates the whole path.

import { TERRAINS } from "../data/terrains.js";
import { getNeedConditions } from "./needs.js";
import { sustain } from "./upkeep.js";
import { getTile, travelMinutes } from "./world.js";
import { siteKnowledgeGrade } from "./world-sighting.js";

// Eight hours of walking. Past this the party makes camp and goes on in the
// morning — the day is a rhythm inside a leg, not the end of one.
export const DAY_MARCH_MINUTES = 480;
const FULL_DAY_MINUTES = 1440;
// What a night in a bedroll gives back, matching the explicit rest in tools.js.
const CAMP_SLEEP_PER_HOUR = 12;

// A march of `marchMinutes` at this pace: the nights camped along the way, what
// they cost the clock, and the sleep they give back. The party marches its day,
// sleeps, and marches again, so a five-day leg is five days of world time rather
// than forty hours with the nights quietly skipped.
export function legCamps(marchMinutes, dayMinutes = DAY_MARCH_MINUTES) {
  const day = Math.max(60, Number(dayMinutes) || DAY_MARCH_MINUTES);
  const march = Math.max(0, Number(marchMinutes) || 0);
  const nights = Math.max(0, Math.ceil(march / day) - 1);
  const restMinutes = nights * Math.max(0, FULL_DAY_MINUTES - day);
  return {
    nights,
    restMinutes,
    elapsedMinutes: march + restMinutes,
    sleepGain: Math.round(CAMP_SLEEP_PER_HOUR * (restMinutes / 60)),
  };
}

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
// like. Crossing into or out of one of these is worth remarking on.
const HARD_GOING = new Set(["mountains", "marsh", "swamp", "jungle", "desert"]);

export const LEG_BOUNDARIES = Object.freeze({
  destination: Object.freeze({ rank: 0, label: "Arrival" }),
  encounter: Object.freeze({ rank: 1, label: "Something on the road" }),
  "road-event": Object.freeze({ rank: 1, label: "The road is held" }),
  supplies: Object.freeze({ rank: 2, label: "The packs run dry" }),
  limit: Object.freeze({ rank: 3, label: "As far as one march is planned" }),
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

// Scenery, landmarks and sighted sites the party went past. This is what a leg
// reports, and on most legs it is the whole of what happened.
const PASSAGE_LIMIT = 10;
const LANDMARK_KINDS = new Set(["waypoint", "crossing", "border", "going"]);

function notePassed(passed, kind, label, detail) {
  if (!label) return;
  const landmark = LANDMARK_KINDS.has(kind);
  // Scenery repeats — a hundred hay barns are one hay barn — so it dedupes by
  // kind. A named ford is not the next named ford, so landmarks dedupe by label.
  if (passed.some((seen) => (landmark ? seen.label === label : seen.kind === kind))) return;
  if (passed.length >= PASSAGE_LIMIT) {
    if (!landmark) return;
    // For the one line this becomes, a named place outranks ambient scenery.
    const ambient = passed.findIndex((seen) => !LANDMARK_KINDS.has(seen.kind));
    if (ambient < 0) return;
    passed.splice(ambient, 1);
  }
  passed.push(detail ? { kind, label, detail } : { kind, label });
}

function collectPassed(passed, tile, previousTile) {
  notePassed(passed, "waypoint", waypointName(tile));
  if (isCrossing(tile) && !isCrossing(previousTile)) {
    notePassed(passed, "crossing", tile.waterway?.name || "a crossing");
  }
  if (tile.regionId && previousTile?.regionId && tile.regionId !== previousTile.regionId) {
    notePassed(passed, "border", tile.area?.name || tile.province?.name || "new country");
  }
  if (HARD_GOING.has(tile.terrain) !== HARD_GOING.has(previousTile?.terrain)) {
    notePassed(passed, "going", TERRAINS[tile.terrain]?.label || tile.terrain);
  }
  for (const entry of tile?.scenery || []) {
    notePassed(passed, entry.kind, entry.label, entry.detail);
  }
}

// The pack, carried forward with the party: rations and water go down hex by hex
// as they eat and drink. A larder is a mutable cursor, so consecutive legs of one
// expedition share a single pack rather than each setting out fully provisioned.
export function openLarder(state) {
  const needs = state?.character?.needs;
  if (!needs) return null;
  return {
    inventory: state.character.inventory,
    needs: { ...needs },
    codexItems: state.world?.codex?.items,
    spent: new Set(getNeedConditions(needs)),
  };
}

// The one thing the ground itself cannot argue with. Returns the need that just
// gave out, or null while the party is still provisioned.
//
// Only the CROSSING counts. A party that set out already starving has made that
// choice, and halting them every hex over it would be the tedium this replaces.
// Sleep is not consulted here — nights are camped, not rationed.
const RUNS_DRY = Object.freeze([
  Object.freeze({ condition: "Starving", need: "hunger", label: "Rations" }),
  Object.freeze({ condition: "Parched", need: "thirst", label: "Water" }),
]);

function eatAlong(larder, minutes) {
  if (!larder) return null;
  const fed = sustain({
    inventory: larder.inventory,
    needs: larder.needs,
    minutes,
    codexItems: larder.codexItems,
  });
  larder.inventory = fed.inventory;
  larder.needs = fed.needs;
  const now = getNeedConditions(larder.needs);
  for (const entry of RUNS_DRY) {
    if (larder.spent.has(entry.condition) || !now.includes(entry.condition)) continue;
    larder.spent.add(entry.condition);
    return { kind: "supplies", need: entry.need, label: entry.label };
  }
  return null;
}

// Plans the next leg only. `from` is the index in `path` the party starts at.
export function planLeg(state, path, from = 0, { maxSteps = 48, pace = "steady", larder } = {}) {
  if (!Array.isArray(path) || from >= path.length - 1) return null;
  const pack = larder === undefined ? openLarder(state) : larder;
  const startTile = getTile(state, path[from].x, path[from].y);
  const passed = [];
  let previousTile = startTile;
  let minutes = 0;
  // The last index always yields a destination boundary, so the scan is
  // guaranteed to settle on or before it.
  let to = path.length - 1;
  let boundary = null;

  for (let i = from + 1; i < path.length && !boundary; i++) {
    const tile = getTile(state, path[i].x, path[i].y);
    const hexMinutes = travelMinutes(previousTile, tile);
    minutes += hexMinutes;
    collectPassed(passed, tile, previousTile);
    const dry = eatAlong(pack, hexMinutes);

    boundary = i === path.length - 1
      ? { kind: "destination", label: waypointName(tile) || TERRAINS[tile.terrain]?.label || "the destination" }
      : dry
        || (i - from >= maxSteps ? { kind: "limit", label: TERRAINS[tile.terrain]?.label || "open ground" } : null);
    if (boundary) to = i;
    previousTile = tile;
  }

  return {
    from,
    to,
    path: path.slice(from, to + 1),
    end: { x: path[to].x, y: path[to].y },
    steps: to - from,
    minutes,
    nights: legCamps(minutes, travelPace(pace).dayMinutes).nights,
    boundary,
    arrived: to === path.length - 1,
    passed,
  };
}

// Up to `maxLegs` legs ahead, for previewing a journey without walking the whole
// continent through the tile generator.
export function planExpedition(state, path, { maxSteps = 48, maxLegs = 4, pace = "steady" } = {}) {
  const legs = [];
  const larder = openLarder(state);
  let cursor = 0;
  while (legs.length < maxLegs) {
    const leg = planLeg(state, path, cursor, { maxSteps, pace, larder });
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
  if (boundary?.kind === "supplies") {
    return boundary.need === "thirst"
      ? "where the last of the water goes and the party will not press on dry"
      : "where the last of the rations go and the party will not press on empty";
  }
  return "as far as this march was planned to carry them — the rest of the way still lies ahead";
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

// `describeLegStop` above is a fragment the narrator brief drops mid-sentence;
// the halt card needs a standalone line, which is a different grammar rather
// than a different wording of the same one.
function haltReason(leg, arrived, encounter, roadEvent) {
  if (arrived) return "";
  if (encounter) return "Something on the road stops the party here.";
  if (roadEvent?.stops) return `The way on is held by ${roadEvent.label}.`;
  const boundary = leg?.boundary;
  if (boundary?.kind === "supplies") {
    return boundary.need === "thirst"
      ? "The waterskins are empty. Going on from here means going on dry."
      : "The rations are gone. Going on from here means going on hungry.";
  }
  if (boundary?.kind === "limit") return "This is as far as one march was planned to carry the party.";
  return "The party halts here for now.";
}

// What the map shows once a leg is walked: where the party is standing, why the
// leg ended there, and what is still ahead. Travel used to close the map on
// arrival, so a leg that stopped short read as being dumped at a random hex.
// Nothing here is new knowledge — every field describes ground already crossed.
export function travelHaltSummary({
  leg,
  legPath,
  fullPathLength,
  arrived,
  where,
  destination,
  hexes,
  minutes,
  nights = 0,
  encounter = null,
  met = [],
  roadEvent = null,
  intendedDest = null,
} = {}) {
  const walked = Array.isArray(legPath) ? legPath.length : 0;
  // An encounter cuts the leg short of its boundary, so the scenery the planned
  // leg would have passed is ground the party never actually walked.
  const walkedWholeLeg = !Array.isArray(leg?.path) || walked >= leg.path.length;
  return {
    arrived: !!arrived,
    where: where || "the road",
    destination: arrived ? null : destination || null,
    hexes: Math.max(0, Number(hexes) || 0),
    minutes: Math.max(0, Number(minutes) || 0),
    nights: Math.max(0, Math.round(Number(nights) || 0)),
    remaining: arrived ? 0 : Math.max(0, (Number(fullPathLength) || walked) - walked),
    boundaryKind: arrived ? "destination"
      : encounter ? "encounter"
        : roadEvent?.stops ? "road-event"
          : leg?.boundary?.kind || "",
    reason: haltReason(leg, arrived, encounter, roadEvent),
    passed: walkedWholeLeg ? (leg?.passed || []).map((entry) => entry.label).filter(Boolean) : [],
    posture: encounter?.posture || null,
    // Who else was on this road. Unlike `met`, this is not a near miss — it is
    // an open offer, and the card names it so the player can act on it in the
    // story rather than only reading about it after the fact.
    roadEvent: roadEvent?.label
      ? { label: roadEvent.label, offer: roadEvent.offer || "news", stops: !!roadEvent.stops }
      : null,
    // What the leg met and did not stop for. A near miss the player never hears
    // about is a near miss that did not happen, and on a quiet leg the wolves
    // that were shaken off are the most interesting thing there is to report.
    met: (Array.isArray(met) ? met : [])
      .filter((hit) => hit?.encounter?.kind)
      .map((hit) => ({ kind: hit.encounter.kind, outcome: hit.outcome || "passed" })),
    intendedDest: arrived ? null : intendedDest,
  };
}
