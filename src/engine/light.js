// Light & darkness — a load-bearing survival system.
//
// A PLACE is ambiently dark when it's a lightless interior/underground, or it's
// night out in the open (towns and tended interiors keep ambient light; gloomy
// terrain darkens earlier).
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

// Exported because the map's day/night grade has to agree with them: a sky that
// looks like dusk while `isNight` says the party is blind is a lie about a
// mechanic (see engine/daylight.js).
export const NIGHT_START = 20, NIGHT_END = 6; // open ground: night is 20:00–05:59
const GLOOM_START = 18, GLOOM_END = 7; // under canopy / in the crags it comes earlier

// Adventure interiors that are dark at any hour. Generic halls and throne
// rooms are deliberately absent: inhabited interiors are lit unless their
// authored type says they are genuinely lightless.
export const INTERIOR_POIS = new Set([
  "cellar", "dungeon", "vault", "warren", "den",
  "cave", "cavern", "crypt", "tomb", "catacomb", "sewer", "mine", "burrow", "pit",
]);
// Built places that keep some ambient light through the night.
export const SETTLEMENT_POIS = new Set(["city", "town", "village", "fortress", "camp", "inn", "market", "square"]);

export function isNight(time, gloomy = false) {
  const h = time?.hour ?? 12;
  return gloomy ? (h < GLOOM_END || h >= GLOOM_START) : (h < NIGHT_END || h >= NIGHT_START);
}

export function isSettlement(tile) {
  if (!tile) return false;
  return !!tile.cityId
    || tile.terrain === "settlement"
    || !!(tile.poi?.type && SETTLEMENT_POIS.has(tile.poi.type));
}

export function hasDarkvision(character) { return !!character?.darkvision; }

const DAYLIGHT = { dark: false, source: "daylight", label: "Daylight", text: "daylight" };
const DARKNESS = { dark: true, source: null, label: "Darkness", text: "in darkness" };

// The location's own illumination, ignoring carried light and darkvision.
// Keeping this structured prevents a lit settlement or tended interior from
// being flattened into the misleading narrator/UI label "daylight" at night.
export function locationLightStatus(state) {
  const cur = state?.world?.currentTile;
  if (!cur) return DAYLIGHT;
  const tile = getTile(state, cur.x, cur.y);
  if (!tile) return DAYLIGHT;
  const poiType = tile.poi?.type;
  if (poiType && INTERIOR_POIS.has(poiType)) return DARKNESS;

  // A tended building has its own light source regardless of the hour.
  if (tile.terrain === "indoor") {
    return { dark: false, source: "interior-lamps", label: "Hearth & lamps", text: "hearth and lamp light" };
  }

  // Outdoor built places keep visible ambient light through the night, but it
  // comes from the location rather than from the sun.
  if (isSettlement(tile)) {
    if (!isNight(state.time)) return DAYLIGHT;
    if (poiType === "camp") {
      return { dark: false, source: "campfires", label: "Campfires", text: "campfire light" };
    }
    if (poiType === "fortress") {
      return { dark: false, source: "watch-fires", label: "Watch fires", text: "watch-fire light" };
    }
    if (tile.cityId) {
      return { dark: false, source: "city-lamps", label: "City lamps", text: "city lamp light" };
    }
    return { dark: false, source: "street-lamps", label: "Street lamps", text: "street-lamp light" };
  }

  return isNight(state.time, !!TERRAINS[tile.terrain]?.dark) ? DARKNESS : DAYLIGHT;
}

// Ambient darkness of the player's tile, ignoring carried light or darkvision.
function ambientDark(state) {
  return locationLightStatus(state).dark;
}

// ---- carried light ----
// Minutes of light left (back-compat with the old {torchMinutes} shape).
export function lightMinutes(state) {
  const l = state?.character?.light;
  if (l?.hooded) return 0;
  return Math.max(0, Number(l?.minutes ?? l?.torchMinutes) || 0);
}
export function lightSource(state) {
  if (lightMinutes(state) <= 0) return null;
  return state?.character?.light?.source || "torch";
}
export function isLit(state) { return lightMinutes(state) > 0; }

// Is it dark for THIS character right now? Carried light and darkvision both
// count, matching the combat/navigation interpretation below.
export function isDarkHere(state) { return ambientDark(state) && !isLit(state) && !hasDarkvision(state.character); }

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
  const ambient = locationLightStatus(state);
  const m = lightMinutes(state);
  const source = lightSource(state);
  if (m > 0) {
    const carried = `lit ${source || "flame"} (~${m}m left)`;
    return {
      lit: true,
      dark: false,
      source,
      minutes: m,
      locationSource: ambient.source,
      text: ambient.dark ? `lit by ${source || "a flame"} (~${m}m left)` : `${ambient.text}; carrying a ${carried}`,
    };
  }
  if (ambient.dark && hasDarkvision(state.character)) {
    return { lit: false, dark: false, darkvision: true, locationSource: null, text: "in darkness, but you see by darkvision" };
  }
  return { lit: false, dark: ambient.dark, locationSource: ambient.source, text: ambient.text };
}

// Stealth-facing interpretation of the same light rules. This is intentionally
// distinct from lightStatus: the HUD should answer "can they see me?", while
// the inventory/menu still needs to answer "what is lighting this place?".
export function visibilityStatus(state) {
  const ambient = locationLightStatus(state);
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
      detail: "Darkness · sight impaired",
      icon: "visibilityClosed",
      canExtinguish: false,
    };
  }

  return {
    obscurity: "clear",
    label: "Visible",
    detail: minutes > 0 ? `${ambient.label} · ${sourceName} ${minutes}m` : ambient.label,
    icon: "visibilityOpen",
    canExtinguish: minutes > 0,
  };
}
