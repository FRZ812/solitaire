import { SPAWN_TABLES, AERIAL_SPAWNS } from "../data/spawn-tables.js";
import { getBiome, getBiomeById } from "../data/biomes.js";
import { ECOLOGIES } from "../data/continent.js";
import { regionDifficulty } from "../data/regions.js";
import { getTile } from "./world.js";
import { TERRAINS } from "../data/terrains.js";
import { DARK_FLEE_BONUS, isBeacon, isHidden, isNight } from "./light.js";
import { isOverloaded, playerGroundMount } from "./riding.js";
import { travelPace } from "./expedition.js";
import { condNames } from "../data/conditions.js";
import { AERIAL_MIN_LEVEL, AERIAL_CHANCE_PER_LEVEL } from "../config.js";

// More things prowl after dark — night (and gloomy ground) raises the odds.
export const NIGHT_ENCOUNTER_MULT = 1.4;

// Combine the terrain's base spawn table with any biome-specific extras for
// this coord. Chance comes from the terrain table; entries are concatenated.
function effectiveTable(tile, x, y) {
  const base = SPAWN_TABLES[tile.terrain];
  if (!base) return null;
  const biome = getBiomeById(tile.regionId) || getBiome(x, y);
  const regional = biome.extraSpawns?.[tile.terrain] || [];
  const ecological = ECOLOGIES[tile.ecology]?.encounters || [];
  const extras = [...regional, ...ecological];
  if (extras.length === 0) return base;
  return {
    chance: base.chance,
    entries: [...base.entries, ...extras],
  };
}

export function rollEncounter(tile, x, y, chanceMult = 1) {
  const table = effectiveTable(tile, x, y);
  if (!table || table.chance <= 0 || table.entries.length === 0) return null;
  const chance = Math.min(1, table.chance * chanceMult);
  if (Math.random() >= chance) return null;
  const total = table.entries.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const e of table.entries) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return null;
}

export function describeEncounterPotential(tile, x, y) {
  const table = effectiveTable(tile, x, y);
  if (!table || table.chance === 0) return null;
  const chancePercent = Math.round(table.chance * 100);
  const sorted = [...table.entries].sort((a, b) => b.weight - a.weight);
  const top3 = sorted.slice(0, 3).map(e => e.kind.replace(/-/g, " "));
  return `Risk ~${chancePercent}% · ${top3.join(", ")}…`;
}

// Danger profile of a hex for the narrator's surroundings awareness: how likely
// an encounter is here and which HOSTILE kinds dominate (so it knows, e.g., that
// goblins are a real threat HERE — only near the den — and not three hexes from
// the tavern).
export function hostileProfile(tile, x, y) {
  const table = effectiveTable(tile, x, y);
  if (!table || table.chance <= 0) return { chancePercent: 0, kinds: [] };
  const hostiles = table.entries.filter((e) => e.posture === "hostile").sort((a, b) => b.weight - a.weight);
  return { chancePercent: Math.round(table.chance * 100), kinds: hostiles.slice(0, 3).map((e) => e.kind.replace(/-/g, " ")) };
}

// ---- getting by what is out there ----
//
// Meeting something on the road is not the same as being stopped by it. Only a
// hostile that cannot be shaken ends a march; a doe, a peddler, or wolves the
// party got clear of are things the leg went past.
//
// The opposition is the REGION, never the party's level: "there is no level
// scaling, so the region you stand in decides how tough its foes and loot are"
// (data/regions.js). The party's side of the roll is circumstance instead —
// light, pace, mount, load, weariness — every one of which the player steers.
//
// Constants swept by scripts/travel-evasion-sim.mjs.
export const EVADE_BASE = 96;
export const EVADE_PER_BAND = 11;
export const EVADE_FLOOR = 10;
export const EVADE_CEIL = 95;
// A ridden mount that actually has the legs for this ground.
export const EVADE_MOUNTED = 12;
export const EVADE_OVERBURDENED = -18;
export const EVADE_EXHAUSTED = -15;
export const EVADE_TIRED = -7;
// Pace already buys ground with risk; here it buys quiet.
const EVADE_BY_PACE = { careful: 10, steady: 0, forced: -12 };

// How many things the party got by are worth reporting. A long leg through the
// Wilds meets a handful, and neither the narrator brief nor the halt card can
// carry a dozen.
export const MET_LIMIT = 3;

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

// Percentage chance of getting clear of this encounter, before the roll.
export function evasionChance(state, atTile, { pace = "steady" } = {}) {
  const band = regionDifficulty(atTile.x, atTile.y, state?.world?.seed);
  let chance = EVADE_BASE - (band.level || 1) * EVADE_PER_BAND;

  // light.js has documented these two since it was written — unlit in the dark
  // is "easier to slip past / flee", a carried flame "can't slip away" — and
  // nothing outside combat has ever read them.
  if (isHidden(state)) chance += DARK_FLEE_BONUS;
  else if (isBeacon(state)) chance -= DARK_FLEE_BONUS;

  chance += EVADE_BY_PACE[travelPace(pace).id] || 0;

  const mount = playerGroundMount(state);
  if (mount && !isOverloaded(mount, state)) chance += EVADE_MOUNTED;
  if (state?.character?.overburdened) chance += EVADE_OVERBURDENED;

  const conds = condNames(state?.character?.conditions);
  if (conds.includes("Exhausted")) chance += EVADE_EXHAUSTED;
  else if (conds.includes("Tired")) chance += EVADE_TIRED;

  return clamp(Math.round(chance), EVADE_FLOOR, EVADE_CEIL);
}

// Does this encounter end the march? Friendly and neutral never do — they are
// hailed, waved past, or never noticed. Hostiles get one roll to slip away.
export function encounterHalts(state, encounter, atTile, options = {}) {
  if (encounter?.posture !== "hostile") {
    return { halts: false, outcome: "passed", chance: 0 };
  }
  const chance = evasionChance(state, atTile, options);
  const evaded = Math.random() * 100 < chance;
  return { halts: !evaded, outcome: evaded ? "evaded" : "blocked", chance };
}

// Walk the path (excluding the starting tile) and roll each tile's encounter
// independently. Everything the party got by is collected; the walk ends at the
// first hostile that would not let them past, which is the only thing here that
// cuts a leg short.
//
// `riskMult` is the party's chosen pace: pressing hard covers ground but walks
// into more, moving carefully costs time and finds less.
export function rollPathEncounter(state, path, riskMult = 1, { pace = "steady" } = {}) {
  const met = [];
  if (!path || path.length < 2) return { halt: null, met };
  for (let i = 1; i < path.length; i++) {
    const p = path[i];
    const tile = getTile(state, p.x, p.y);
    // Gloomy terrain darkens earlier, so its night window (and danger) is wider.
    const gloomy = !!TERRAINS[tile.terrain]?.dark;
    const mult = (isNight(state.time, gloomy) ? NIGHT_ENCOUNTER_MULT : 1) * riskMult;
    const enc = rollEncounter(tile, p.x, p.y, mult);
    if (!enc) continue;
    const verdict = encounterHalts(state, enc, p, { pace });
    const hit = { encounter: enc, atTile: p, atIndex: i, outcome: verdict.outcome };
    if (verdict.halts) return { halt: hit, met };
    if (met.length < MET_LIMIT) met.push(hit);
  }
  return { halt: null, met };
}

// The route roll and every presentation layer share this one truncation rule:
// movement, narration, the visible march, and eventual arrival all stop on the
// first encounter tile. Invalid/stale encounter metadata never shortens a leg.
export function pathThroughEncounter(path, pathEncounter) {
  const route = Array.isArray(path) ? path : [];
  const atIndex = pathEncounter?.atIndex;
  const atTile = pathEncounter?.atTile;
  const indexedTile = route[atIndex];
  if (
    !Number.isInteger(atIndex)
    || atIndex < 1
    || atIndex >= route.length
    || !Number.isFinite(atTile?.x)
    || !Number.isFinite(atTile?.y)
    || indexedTile?.x !== atTile.x
    || indexedTile?.y !== atTile.y
  ) {
    return route.slice();
  }
  return route.slice(0, atIndex + 1);
}

// Pick one aerial predator from the sky-ambush pool (weighted, all hostile).
function pickAerial() {
  const total = AERIAL_SPAWNS.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const e of AERIAL_SPAWNS) { r -= e.weight; if (r <= 0) return e; }
  return AERIAL_SPAWNS[0];
}

// The flying counterpart to rollPathEncounter: only another flier can reach you
// aloft, and only over dangerous country. Walk the flight path (excluding the
// start) and roll a small per-hex chance that scales with the region's danger —
// nothing below AERIAL_MIN_LEVEL (tamed lands are safe skies). Returns the first
// hit in the same { encounter, atTile, atIndex } shape the travel flow expects.
export function rollAerialEncounter(state, path) {
  if (!path || path.length < 2) return null;
  for (let i = 1; i < path.length; i++) {
    const p = path[i];
    const level = regionDifficulty(p.x, p.y, state.world.seed).level || 0;
    if (level < AERIAL_MIN_LEVEL) continue;
    const chance = (level - (AERIAL_MIN_LEVEL - 1)) * AERIAL_CHANCE_PER_LEVEL;
    if (Math.random() < chance) return { encounter: pickAerial(), atTile: p, atIndex: i };
  }
  return null;
}

// Cumulative probability of at least one encounter across the path's enter-rolls,
// expressed as a percent for display. Uses each tile's terrain base chance.
export function pathRiskPercent(state, path) {
  if (!path || path.length < 2) return 0;
  let pNone = 1;
  for (let i = 1; i < path.length; i++) {
    const p = path[i];
    const tile = getTile(state, p.x, p.y);
    const base = SPAWN_TABLES[tile.terrain];
    const c = base?.chance ?? 0;
    pNone *= (1 - c);
  }
  return Math.round((1 - pNone) * 100);
}
