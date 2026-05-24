// Passive vitality regen at 1 HP/hour while alive, blocked by any condition the
// registry flags as blocksHealing (wounds, hexes, and severe needs) until it's
// removed or treated.

import { conditionMeta, condNames } from "../data/conditions.js";

export function canHeal(conditions) {
  for (const name of condNames(conditions)) {
    if (conditionMeta(name).blocksHealing) return false;
  }
  return true;
}

// Sum any recovery bonus from active buffs (Well-Fed, Rested, Regenerating…).
function conditionRegen(conditions) {
  let bonus = 0;
  for (const name of condNames(conditions)) bonus += conditionMeta(name).regenPerHour || 0;
  return bonus;
}

export function passiveHealVitality(vitality, vitalityMax, conditions, minutes, bonusPerHour = 0) {
  if (!canHeal(conditions)) return vitality;
  const rate = 1 + bonusPerHour + conditionRegen(conditions); // base 1 HP/hour + Mending gear + recovery buffs
  return Math.min(vitalityMax, vitality + rate * (minutes / 60));
}
