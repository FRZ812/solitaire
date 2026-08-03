// Where the sun is, and what that does to the look of the map.
//
// Travel used to be lit by a single boolean — `hour < 6 || hour >= 20` — so the
// world had two appearances, 19:59 looked like noon, and 20:00 arrived as a hard
// cut. Time was something you read off the clock rather than something you saw.
//
// This is the whole of the colour decision, kept pure so it can be tested: the
// renderer asks for a grade and draws it, and makes no palette choices of its own.

import { NIGHT_END, NIGHT_START } from "./light.js";

export const DAY_MINUTES = 1440;
export const DAWN_MINUTE = NIGHT_END * 60;
export const DUSK_MINUTE = NIGHT_START * 60;

const DAY_SPAN = DUSK_MINUTE - DAWN_MINUTE;
const NIGHT_SPAN = DAY_MINUTES - DAY_SPAN;
const clamp01 = (value) => Math.max(0, Math.min(1, value));

export function minuteOfDay(time) {
  const hour = Number(time?.hour) || 0;
  const minute = Number(time?.minute) || 0;
  return wrapDay(hour * 60 + minute);
}

export function wrapDay(minutes) {
  const value = Number(minutes) || 0;
  return ((value % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
}

// -1 (deepest night) to +1 (noon), crossing zero exactly at the civil boundaries
// the survival layer uses. Sunrise and sunset are therefore the same instants for
// the eye and for the rules.
//
// The sign is geometry, not the night predicate: the curve touches zero at both
// ends of the day and JS cannot order -0 against 0. `isNight` remains the one
// authority on whether it is dark.
export function sunAltitude(minutes) {
  const m = wrapDay(minutes);
  if (m >= DAWN_MINUTE && m < DUSK_MINUTE) {
    return Math.sin(Math.PI * ((m - DAWN_MINUTE) / DAY_SPAN));
  }
  const intoNight = m < DAWN_MINUTE ? m + (DAY_MINUTES - DUSK_MINUTE) : m - DUSK_MINUTE;
  return -Math.sin(Math.PI * (intoNight / NIGHT_SPAN));
}

const SOLAR_NOON = DAWN_MINUTE + DAY_SPAN / 2;
const SOLAR_MIDNIGHT = wrapDay(DUSK_MINUTE + NIGHT_SPAN / 2);

// Altitude alone cannot tell a sunrise from a sunset — the curve is symmetric —
// so the low raking light needs this to know which side of the map to fall on.
export function sunRising(minutes) {
  const m = wrapDay(minutes);
  return m >= SOLAR_MIDNIGHT && m < SOLAR_NOON;
}

// Above this the sun is simply up and nothing is drawn over the map at all, so
// the common case — daylight — costs nothing.
const FULL_DAY = 0.35;
// Below this it is as dark as it gets; there is no point deepening past midnight.
const DEEP_NIGHT = -0.6;

// The palette, as stops down the altitude axis. `shade` is what the world is
// darkened toward, `warm` is the light laid back over it.
const SKY_STOPS = [
  { at: FULL_DAY,   shade: [74, 52, 38], warm: [255, 214, 148], warmth: 0,    horizon: 0,   lamps: 0 },
  { at: 0,          shade: [72, 44, 52], warm: [255, 168, 96],  warmth: 1,    horizon: 1,   lamps: 0.35 },
  { at: -0.25,      shade: [40, 32, 74], warm: [214, 126, 128], warmth: 0.55, horizon: 0.6, lamps: 0.8 },
  { at: DEEP_NIGHT, shade: [10, 22, 58], warm: [120, 150, 210], warmth: 0.12, horizon: 0,   lamps: 1 },
];

const mix = (from, to, t) => from + (to - from) * t;
const mixRgb = (from, to, t) => [
  Math.round(mix(from[0], to[0], t)),
  Math.round(mix(from[1], to[1], t)),
  Math.round(mix(from[2], to[2], t)),
];

export const rgba = ([r, g, b], alpha) => `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(3))})`;

function stopsAround(altitude) {
  for (let i = 0; i < SKY_STOPS.length - 1; i += 1) {
    const upper = SKY_STOPS[i];
    const lower = SKY_STOPS[i + 1];
    if (altitude >= lower.at) {
      return { upper, lower, t: clamp01((upper.at - altitude) / (upper.at - lower.at)) };
    }
  }
  const last = SKY_STOPS[SKY_STOPS.length - 1];
  return { upper: last, lower: last, t: 0 };
}

// How much of the shade colour is laid over the world at all. Separate from the
// stop table because it keeps falling below DEEP_NIGHT's colour, and because the
// renderer wants a single number to decide whether to draw anything.
const SHADE_AT_NIGHT = 0.66;

export function skyGrade(altitude) {
  const above = Math.min(1, Math.max(-1, Number(altitude) || 0));
  const { upper, lower, t } = stopsAround(above);
  const shade = above >= FULL_DAY
    ? 0
    : clamp01((FULL_DAY - above) / (FULL_DAY - DEEP_NIGHT)) * SHADE_AT_NIGHT;
  const warmth = mix(upper.warmth, lower.warmth, t);
  const horizon = mix(upper.horizon, lower.horizon, t);
  const warmRgb = mixRgb(upper.warm, lower.warm, t);
  return {
    altitude: above,
    shade,
    warmth,
    horizon,
    rising: false,
    lamps: mix(upper.lamps, lower.lamps, t),
    warmRgb,
    shadeColor: rgba(mixRgb(upper.shade, lower.shade, t), shade),
    warmColor: rgba(warmRgb, warmth * 0.3),
    horizonColor: rgba(warmRgb, horizon * 0.34),
  };
}

export function skyAt(minutes) {
  return { ...skyGrade(sunAltitude(minutes)), rising: sunRising(minutes) };
}

// How far the sky is allowed to turn while a march animates.
//
// The march runs before the travel beat settles, so the clock is frozen for its
// whole duration and has to be projected. Projecting it linearly is right up to a
// day; past that a fortnight's leg would put fourteen sunrises through a four
// second animation, which is a strobe rather than a sense of time.
//
// So: over a day, sweep exactly one full cycle plus the remainder. The player
// always sees at least one dusk and one dawn — the honest signal that more than a
// day went by — never more than two, and it still lands on the hour the party
// really arrives at.
export function marchSweepMinutes(elapsedMinutes) {
  const elapsed = Math.max(0, Number(elapsedMinutes) || 0);
  return elapsed <= DAY_MINUTES ? elapsed : DAY_MINUTES + wrapDay(elapsed);
}

// The clock to light the map by: the party's own time, or where it will stand
// once the leg in progress finishes.
export function marchClockMinutes(time, elapsedMinutes, progress) {
  const depart = minuteOfDay(time);
  return wrapDay(depart + marchSweepMinutes(elapsedMinutes) * clamp01(Number(progress) || 0));
}
