// Light & darkness — a load-bearing survival system.
//
// A PLACE is ambiently dark when it's an interior/underground, or it's night
// out in the open (towns keep ambient light; gloomy terrain darkens earlier).
// A carried LIGHT (torch or lantern) holds the dark back until it burns down.
// DARKVISION races see in it regardless.
//
// Three player-facing states fall out of this:
//   • inTheDark  — ambiently dark, no light, no darkvision → BLIND: combat
//                  accuracy penalty and sight shrinks to one hex.
//   • isHidden   — ambiently dark and carrying NO light → unseen: easier to
//                  slip past / flee, and foes can't ambush you (darkvision too).
//   • lit beacon — ambiently dark and carrying a LIGHT → you can see and fight,
//                  but the flame marks you (more ambushes, can't slip away).
//
// Reuses the long-unused `terrain.dark` flag and the day/night clock.

import { TERRAINS } from "../data/terrains.js";
import { getTile } from "./world.js";
import { SIGHT_RADIUS } from "../config.js";

export const TORCH_MINUTES = 60;       // a torch ≈ an hour, sight radius 2
export const LANTERN_MINUTES = 240;    // a lantern on one oil ≈ four hours, full sight
export const DARK_ACC_PENALTY = 25;    // accuracy lost fighting blind (tunable)
export const DARK_FLEE_BONUS = 20;     // easier to vanish into the black

const NIGHT_START = 20, NIGHT_END = 6; // open ground: night is 20:00–05:59
const GLOOM_START = 18, GLOOM_END = 7; // under canopy / in the crags it comes earlier

// Adventure interiors that are dark at any hour.
export const INTERIOR_POIS = new Set(["cellar", "dungeon", "hall", "throne_room", "vault", "warren", "den"]);
// Built places that keep some ambient light through the night.
export const SETTLEMENT_POIS = new Set(["city", "town", "village", "fortress", "camp", "inn", "market", "square"]);

export function isNight(time, gloomy = false) {
  const h = time?.hour ?? 12;
  return gloomy ? (h < GLOOM_END || h >= GLOOM_START) : (h < NIGHT_END || h >= NIGHT_START);
}

export function isSettlement(tile) {
  if (!tile) return false;
  return tile.terrain === "settlement" || (tile.poi?.type && SETTLEMENT_POIS.has(tile.poi.type));
}

export function hasDarkvision(character) { return !!character?.darkvision; }

// Ambient darkness of the player's tile, ignoring any carried light or darkvision.
function ambientDark(state) {
  const cur = state?.world?.currentTile;
  if (!cur) return false;
  const tile = getTile(state, cur.x, cur.y);
  if (!tile) return false;
  const poiType = tile.poi?.type;
  if (poiType && INTERIOR_POIS.has(poiType)) return true; // dungeons, cellars, dens: lightless
  if (isSettlement(tile)) return false;                   // towns + civilized interiors (inn, shop, market): kept lit
  if (tile.terrain === "indoor") return false;            // a tended building — hearth, lamps, occupants
  return isNight(state.time, !!TERRAINS[tile.terrain]?.dark); // open wilds: dark at night (sooner if gloomy)
}

// ---- carried light ----
export function lightSource(state) { return state?.character?.light?.source || null; }
// Minutes of light left (back-compat with the old {torchMinutes} shape).
export function lightMinutes(state) {
  const l = state?.character?.light;
  return (l?.minutes ?? l?.torchMinutes) || 0;
}
export function isLit(state) { return lightMinutes(state) > 0; }

// Is it dark for THIS character right now (ambient dark, darkvision sees through)?
export function isDarkHere(state) { return ambientDark(state) && !hasDarkvision(state.character); }

// ---- the three meaningful states ----
// Blind: can't see to fight or navigate.
export function inTheDark(state) { return ambientDark(state) && !isLit(state) && !hasDarkvision(state.character); }
// Hidden: unseen in the dark (no flame) — darkvision folk count too (they just also see).
export function isHidden(state) { return ambientDark(state) && !isLit(state); }
// A flame in the dark — visible to everything out there.
export function isBeacon(state) { return ambientDark(state) && isLit(state); }

// How far the player reveals the map right now.
export function sightRadius(state) {
  if (!ambientDark(state) || hasDarkvision(state.character)) return SIGHT_RADIUS; // daylight / town / darkvision
  const src = lightSource(state);
  if (src === "lantern") return SIGHT_RADIUS; // steady, bright
  if (src === "torch") return 2;              // flickering pool of light
  return 1;                                   // pitch dark: fumble one hex at a time
}

// Short status for the menu HUD, glossary, and narrator context line.
export function lightStatus(state) {
  const m = lightMinutes(state);
  if (m > 0) return { lit: true, dark: false, source: lightSource(state), minutes: m, text: `lit by ${lightSource(state) || "a flame"} (~${m}m left)` };
  if (ambientDark(state) && hasDarkvision(state.character)) return { lit: false, dark: false, darkvision: true, text: "dark, but you see in it" };
  if (ambientDark(state)) return { lit: false, dark: true, text: "in darkness" };
  return { lit: false, dark: false, text: "daylight" };
}

// Stealth-facing interpretation of the same light rules. This is intentionally
// distinct from lightStatus: the HUD should answer "can they see me?", while
// the inventory/menu still needs to answer "what is lighting this place?".
export function visibilityStatus(state) {
  const source = lightSource(state);
  const minutes = lightMinutes(state);
  const sourceName = source ? `${source.charAt(0).toUpperCase()}${source.slice(1)}` : "Flame";

  if (isBeacon(state)) {
    return {
      obscurity: "revealed",
      label: "Revealed",
      detail: `${sourceName} · ${minutes}m`,
      icon: "visibilityOpen",
      canExtinguish: true,
    };
  }

  if (isHidden(state)) {
    if (!inTheDark(state)) {
      return {
        obscurity: "partial",
        label: "Obscured",
        detail: "Darkvision · unseen",
        icon: "visibilityHalf",
        canExtinguish: false,
      };
    }
    return {
      obscurity: "heavy",
      label: "Hidden",
      detail: "Sight impaired",
      icon: "visibilityClosed",
      canExtinguish: false,
    };
  }

  return {
    obscurity: "clear",
    label: "Visible",
    detail: minutes > 0 ? `${sourceName} · ${minutes}m` : "Clear sightlines",
    icon: "visibilityOpen",
    canExtinguish: minutes > 0,
  };
}
