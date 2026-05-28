// Day-rollover age progression, natural death, and successor activation.
//
// Mirrors the spoilage.js pattern: absolute-day comparison, lazy, no per-day
// iteration. `ageState(state)` is safe to call after EVERY time-advance — it
// no-ops when no codex character would cross a year boundary. Yearly ticks
// roll a deterministic death roll seeded on `(id, age)` so a save/reload at
// the same engine state always produces the same outcome.
//
// Aging and mortality are separable axes, gated by per-character `agingMode`:
//   - "mortal"          → year-counter advances; rolls death at racial elder…max+10.
//   - "power-extended"  → same, but `lifespanMultiplier` scales the thresholds.
//   - "ageless"         → year-counter FROZEN; never rolls death.
//   - "out-of-time"     → year-counter frozen; never rolls death.
//
// Dead characters are NOT removed from the codex — the player can still ask
// about them, find the grave, hear it from a survivor. `deathDay` flags them.

import { effectiveRaceLifespan } from "../data/races.js";
import { makeRng } from "./town-gen.js";

export const DAYS_PER_YEAR = 360;

// Whose year-counter does NOT advance. ageless = age frozen at moment of
// turning/binding (vampire turned at 28 stays 28). out-of-time = entity
// outside mortal years entirely (Demon-King, the Hag).
function tickFreezes(ch) {
  return ch.agingMode === "ageless" || ch.agingMode === "out-of-time";
}

// Who is immune to natural death from age. Same set as tickFreezes today,
// but kept distinct for clarity — they answer different engine questions.
function mortalityImmune(ch) {
  return ch.agingMode === "ageless" || ch.agingMode === "out-of-time";
}

// Lifespan after applying the character's per-character multiplier. Returns
// { elder, max } scaled, or null if the race has no biological baseline
// (fae/demon/wyrm — those should ride agingMode: "out-of-time" instead).
export function effectiveLifespan(ch) {
  const ls = effectiveRaceLifespan(ch?.race, ch?.subrace);
  if (!ls) return null;
  const mult = ch.lifespanMultiplier ?? 1.0;
  return { elder: Math.round(ls.elder * mult), max: Math.round(ls.max * mult) };
}

// Per-year probability of natural death. Zero below the elder threshold, a
// 5% floor at exactly elder, and a smooth ramp to 1.0 at max+10. Already-dead
// characters return 0 (no double-death), as do null-age / immune entities.
export function deathOdds(ch) {
  if (!ch || ch.deathDay != null || ch.age == null) return 0;
  if (mortalityImmune(ch)) return 0;
  const ls = effectiveLifespan(ch);
  if (!ls) return 0;
  if (ch.age < ls.elder) return 0;
  const span = (ls.max + 10) - ls.elder;
  if (span <= 0) return 1.0;
  const ramp = (ch.age - ls.elder) / span;
  return Math.min(1.0, 0.05 + 0.95 * Math.max(0, Math.min(1, ramp)));
}

// Roll the per-year death check. Deterministic on (id, age) so the same save
// at the same engine state always rolls the same outcome — load/reload
// safety. Returns the character unchanged on a miss, or stamped with
// deathDay + deathReason on a hit.
export function rollNaturalDeath(ch, day) {
  const odds = deathOdds(ch);
  if (odds <= 0) return ch;
  const rng = makeRng(`death:${ch.id}:${ch.age}`);
  if (rng() < odds) return { ...ch, deathDay: day, deathReason: "natural" };
  return ch;
}

// Advance one character through any years that have elapsed since their last
// tick. `lastAgeTickDay` is engine-managed — if absent (a brand-new entry the
// engine has never aged), treat it as `day` so we don't retro-age them on
// first encounter. Loops year-by-year so a multi-year skip can't overshoot a
// fatal roll.
export function ageOne(ch, day) {
  if (!ch || ch.age == null) return ch;
  if (tickFreezes(ch)) return ch;
  if (ch.deathDay != null) return ch;
  const last = ch.lastAgeTickDay ?? day;
  if (day <= last) {
    // Stamp the day so the next call has a reference, but only if missing.
    if (ch.lastAgeTickDay == null) return { ...ch, lastAgeTickDay: day };
    return ch;
  }
  const yearsToAdd = Math.floor((day - last) / DAYS_PER_YEAR);
  if (yearsToAdd <= 0) {
    // Less than a full year has passed since the last tick — just update the
    // bookkeeping so we keep accumulating against the same anchor.
    return ch.lastAgeTickDay === day ? ch : { ...ch, lastAgeTickDay: ch.lastAgeTickDay ?? day };
  }
  let cur = { ...ch, lastAgeTickDay: day };
  for (let i = 0; i < yearsToAdd; i++) {
    cur = { ...cur, age: (cur.age || 0) + 1 };
    cur = rollNaturalDeath(cur, day);
    if (cur.deathDay != null) break;
  }
  return cur;
}

// When a character with a pre-authored `successor_id` dies, flip the
// successor's `activeAsLeader` to true and stamp `succeededOn`. Idempotent —
// already-active successors are not re-stamped. Lesser NPCs without a
// successor_id are improvised by the narrator on next reference (persisted
// later via discoveries.characters with a `succeeded` link).
export function activateSuccessor(state, deadId) {
  const dead = state.world?.codex?.characters?.[deadId];
  if (!dead?.successor_id) return state;
  const successor = state.world.codex.characters[dead.successor_id];
  if (!successor || successor.activeAsLeader) return state;
  const chars = { ...state.world.codex.characters };
  chars[dead.successor_id] = {
    ...successor,
    activeAsLeader: true,
    succeededOn: state.time?.day ?? 0,
  };
  return {
    ...state,
    world: { ...state.world, codex: { ...state.world.codex, characters: chars } },
  };
}

// Sweep every codex character through ageOne, collect aged + deaths, and
// activate any pre-authored successors as part of building the returned
// state. Safe to call after every time-advance — returns the input state
// unchanged when nothing crossed a year boundary.
//
// Returns { state, aged, deaths } where:
//   aged   = [{ id, from, to }] for characters whose age field changed
//   deaths = [{ id, age }]      for characters that died this sweep
export function ageState(state) {
  const day = state.time?.day || 0;
  const chars = state.world?.codex?.characters || {};
  const out = {};
  const aged = [];
  const deaths = [];
  let changed = false;
  for (const [id, ch] of Object.entries(chars)) {
    const next = ageOne(ch, day);
    if (next !== ch) {
      changed = true;
      if ((next.age ?? null) !== (ch.age ?? null)) aged.push({ id, from: ch.age, to: next.age });
      if (next.deathDay != null && ch.deathDay == null) deaths.push({ id, age: next.age });
    }
    out[id] = next;
  }
  if (!changed) return { state, aged: [], deaths: [] };
  let stateAcc = {
    ...state,
    world: { ...state.world, codex: { ...state.world.codex, characters: out } },
  };
  for (const { id } of deaths) stateAcc = activateSuccessor(stateAcc, id);
  return { state: stateAcc, aged, deaths };
}
