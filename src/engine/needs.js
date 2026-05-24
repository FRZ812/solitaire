// Needs deplete with time. Crossing into a worse state surfaces a one-line
// reminder; routine restoration is silent (narrator carries it).

import { conditionMeta, condName, normalizeConditions } from "../data/conditions.js";

// Halved from v10 (4/6/5) for the wilderness-travel pacing introduced in v11:
// each hex now spans more in-game time, and a hearty meal sustains roughly a
// half-day of travel rather than four hours.
export const NEEDS_DRAIN = { hunger: 2, thirst: 3, sleep: 2.5 };

export function getNeedConditions(needs) {
  const conds = [];
  if (needs.hunger <= 10) conds.push("Starving");
  else if (needs.hunger <= 30) conds.push("Hungry");
  if (needs.thirst <= 10) conds.push("Parched");
  else if (needs.thirst <= 30) conds.push("Thirsty");
  if (needs.sleep <= 10) conds.push("Exhausted");
  else if (needs.sleep <= 30) conds.push("Tired");
  return conds;
}

function clampNeed(v) { return Math.max(0, Math.min(100, v)); }

// decayMult < 1 slows depletion (e.g. an Enduring item passive).
export function depleteNeeds(needs, minutes, decayMult = 1) {
  const h = (minutes / 60) * decayMult;
  return {
    hunger: clampNeed(needs.hunger - NEEDS_DRAIN.hunger * h),
    thirst: clampNeed(needs.thirst - NEEDS_DRAIN.thirst * h),
    sleep:  clampNeed(needs.sleep  - NEEDS_DRAIN.sleep  * h),
  };
}

export function applyNeedsChanges(needs, changes) {
  if (!changes) return needs;
  return {
    hunger: clampNeed(needs.hunger + (changes.hunger || 0)),
    thirst: clampNeed(needs.thirst + (changes.thirst || 0)),
    sleep:  clampNeed(needs.sleep  + (changes.sleep  || 0)),
  };
}

// Fold three sources into the character's final condition list, as { name,
// remaining } objects. `prevConditions` must ALREADY be ticked (see
// tickConditions) — this function does not advance timers, it only merges.
//
//   • narratorConditions (new_conditions): REPLACE-controls the player's
//     INDEFINITE wound conditions. May be null (keep current). Each entry is a
//     string (a lasting wound) or { name, duration_minutes } (a timed effect,
//     which is filed under the engine-owned timed bucket instead).
//   • needsConditions: string names derived from current hunger/thirst/sleep
//     (always indefinite, engine-authoritative).
//   • prevConditions: the character's current conditions, post-tick.
//
// Engine-owned TIMED conditions (buffs/debuffs with a countdown) survive a
// narrator replace untouched — the narrator only re-lists lasting wounds, the
// engine remembers and expires the timers.
export function mergeConditions(narratorConditions, needsConditions, prevConditions) {
  const ticked = normalizeConditions(prevConditions);
  const timed = [];      // engine-owned, has a countdown
  let indefinite = [];   // narrator-owned wounds (remaining == null, non-need)
  for (const c of ticked) {
    if (conditionMeta(c.name).isNeed) continue; // re-derived from needs below
    if (c.remaining != null) timed.push(c);
    else indefinite.push(c);
  }

  if (narratorConditions !== null && narratorConditions !== undefined) {
    indefinite = [];
    for (const entry of narratorConditions) {
      const name = condName(entry);
      if (!name || conditionMeta(name).isNeed) continue; // engine owns need conditions
      const given = (typeof entry === "object" && entry) ? (entry.duration_minutes ?? entry.remaining) : undefined;
      const remaining = (given !== undefined && given !== null) ? given : conditionMeta(name).duration;
      if (remaining != null) {
        if (!timed.some((t) => t.name === name)) timed.push({ name, remaining });
      } else if (!indefinite.some((i) => i.name === name)) {
        indefinite.push({ name, remaining: null });
      }
    }
  }

  const needConds = (needsConditions || []).map((n) => ({ name: condName(n), remaining: null }));
  const out = [];
  const seen = new Set();
  for (const c of [...timed, ...indefinite, ...needConds]) {
    if (!c.name || seen.has(c.name)) continue;
    seen.add(c.name);
    out.push(c);
  }
  return out;
}

export function getNeedAlertText(cond) {
  switch (cond) {
    case "Hungry":    return "Your stomach has begun to complain.";
    case "Starving":  return "You feel hollow. Every step costs more than the last.";
    case "Thirsty":   return "Your mouth is going dry.";
    case "Parched":   return "Your tongue feels swollen. You need water, badly.";
    case "Tired":     return "Your eyelids are heavier than they should be.";
    case "Exhausted": return "You can barely stay upright. Sleep, or you will fall.";
    default: return null;
  }
}
