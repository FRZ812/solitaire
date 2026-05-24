import { SPAWN_TABLES, AERIAL_SPAWNS } from "../data/spawn-tables.js";
import { getBiome } from "../data/biomes.js";
import { regionDifficulty } from "../data/regions.js";
import { getTile } from "./world.js";
import { TERRAINS } from "../data/terrains.js";
import { isNight } from "./light.js";
import { AERIAL_MIN_LEVEL, AERIAL_CHANCE_PER_LEVEL } from "../config.js";

// More things prowl after dark — night (and gloomy ground) raises the odds.
export const NIGHT_ENCOUNTER_MULT = 1.4;

// Combine the terrain's base spawn table with any biome-specific extras for
// this coord. Chance comes from the terrain table; entries are concatenated.
function effectiveTable(tile, x, y) {
  const base = SPAWN_TABLES[tile.terrain];
  if (!base) return null;
  const biome = getBiome(x, y);
  const extras = biome.extraSpawns?.[tile.terrain] || [];
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

// Walk the path (excluding the starting tile), roll each tile's encounter
// independently, return the first hit. One beat per journey means at most one
// encounter even if multiple rolls would have fired.
export function rollPathEncounter(state, path) {
  if (!path || path.length < 2) return null;
  for (let i = 1; i < path.length; i++) {
    const p = path[i];
    const tile = getTile(state, p.x, p.y);
    // Gloomy terrain darkens earlier, so its night window (and danger) is wider.
    const gloomy = !!TERRAINS[tile.terrain]?.dark;
    const mult = isNight(state.time, gloomy) ? NIGHT_ENCOUNTER_MULT : 1;
    const enc = rollEncounter(tile, p.x, p.y, mult);
    if (enc) return { encounter: enc, atTile: p, atIndex: i };
  }
  return null;
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
    const level = regionDifficulty(p.x, p.y).level || 0;
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
