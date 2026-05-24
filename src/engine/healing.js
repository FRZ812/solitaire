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

export function passiveHealVitality(vitality, vitalityMax, conditions, minutes, bonusPerHour = 0) {
  if (!canHeal(conditions)) return vitality;
  const rate = 1 + bonusPerHour; // base 1 HP/hour + Mending-style passives
  return Math.min(vitalityMax, vitality + rate * (minutes / 60));
}
