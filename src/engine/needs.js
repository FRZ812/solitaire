// Needs deplete with time. Crossing into a worse state surfaces a one-line
// reminder; routine restoration is silent (narrator carries it).

// Halved from v10 (4/6/5) for the wilderness-travel pacing introduced in v11:
// each hex now spans more in-game time, and a hearty meal sustains roughly a
// half-day of travel rather than four hours.
export const NEEDS_DRAIN = { hunger: 2, thirst: 3, sleep: 2.5 };
export const NEEDS_CONDITIONS = new Set(["Hungry", "Starving", "Thirsty", "Parched", "Tired", "Exhausted"]);

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

export function depleteNeeds(needs, minutes) {
  const h = minutes / 60;
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

export function mergeConditions(narratorConditions, needsConditions, prevConditions) {
  const base = (narratorConditions !== null && narratorConditions !== undefined)
    ? narratorConditions.filter(c => !NEEDS_CONDITIONS.has(c))
    : (prevConditions || []).filter(c => !NEEDS_CONDITIONS.has(c));
  const out = [...base];
  for (const c of needsConditions) {
    if (!out.includes(c)) out.push(c);
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
