// Passive vitality regen at 1 HP/hour while alive, blocked by any of these
// conditions until the narrator removes them.

export const HEALING_BLOCKERS = new Set([
  "Bleeding", "Severed Limb", "Festering Wound", "Infected",
  "Poisoned", "Cursed", "Starving", "Parched", "Exhausted",
]);

export function canHeal(conditions) {
  for (const c of conditions || []) {
    if (HEALING_BLOCKERS.has(c)) return false;
  }
  return true;
}

export function passiveHealVitality(vitality, vitalityMax, conditions, minutes, bonusPerHour = 0) {
  if (!canHeal(conditions)) return vitality;
  const rate = 1 + bonusPerHour; // base 1 HP/hour + Mending-style passives
  return Math.min(vitalityMax, vitality + rate * (minutes / 60));
}
