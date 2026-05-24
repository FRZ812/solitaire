// Light & darkness. A place is dark when it's an interior, gloomy by nature
// (forest/marsh/mountains/water), or simply night out in the open. A lit torch
// (struck with a tinderbox) holds the dark back until it burns down. Fighting or
// travelling in the dark UNLIT carries penalties; the narrator is told too.
//
// This reuses the long-unused `terrain.dark` flag (data/terrains.js) and the
// existing day/night clock (time.hour).

import { TERRAINS } from "../data/terrains.js";
import { getTile } from "./world.js";

export const TORCH_MINUTES = 60;        // one torch ≈ an hour of light
export const DARK_ACC_PENALTY = 25;     // accuracy lost fighting blind (tunable)
const NIGHT_START = 20, NIGHT_END = 6;  // 20:00–05:59 counts as night

// Adventure interiors that are dark at any hour (open-air settlements are not).
export const INTERIOR_POIS = new Set(["cellar", "dungeon", "hall", "throne_room", "vault", "warren", "den"]);

export function isNight(time) {
  const h = time?.hour ?? 12;
  return h < NIGHT_END || h >= NIGHT_START;
}

// Is the player's CURRENT tile dark right now (ignoring any torch)?
export function isDarkHere(state) {
  const cur = state?.world?.currentTile;
  if (!cur) return false;
  const tile = getTile(state, cur.x, cur.y);
  if (!tile) return false;
  const poiType = tile.poi?.type;
  if (tile.terrain === "indoor" || (poiType && INTERIOR_POIS.has(poiType))) return true; // interiors: always dark
  if (TERRAINS[tile.terrain]?.dark) return true;  // gloomy by nature, even by day
  return isNight(state.time);                      // open ground: dark only at night
}

export function torchMinutes(state) { return state?.character?.light?.torchMinutes || 0; }
export function isLit(state) { return torchMinutes(state) > 0; }

// The mechanically meaningful state: you're "in the dark" only when it's dark
// AND you have no light burning.
export function inTheDark(state) { return isDarkHere(state) && !isLit(state); }

// A short status for the menu HUD, the glossary, and the narrator context line.
export function lightStatus(state) {
  const m = torchMinutes(state);
  if (m > 0) return { lit: true, dark: false, minutes: m, text: `lit by torch (~${m}m left)` };
  if (isDarkHere(state)) return { lit: false, dark: true, minutes: 0, text: "in darkness" };
  return { lit: false, dark: false, minutes: 0, text: "daylight" };
}
