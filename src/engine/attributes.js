import { ATTR_KEYS, ATTR_LABELS } from "../config.js";
import { effectiveAttributes } from "../data/proficiencies.js";

// The player's max HP is derived from VIGOR (so toughness is a real, investable
// stat — mirroring how NPCs get HP from vigor). Tuned so a starting build
// (effective vigor ≈ 2) ≈ 30, the legacy baseline.
export const BASE_VITALITY = 20;
export const HP_PER_VIGOR = 5;

export function maxVitalityFor(character) {
  const vigor = effectiveAttributes(character).vigor || 0;
  return Math.round(BASE_VITALITY + vigor * HP_PER_VIGOR);
}

// Recompute and store `vitalityMax` from current (effective) vigor — call wherever
// vigor can change (creation, racial kit, attribute growth, on load). A positive
// delta heals you by that much (gaining toughness mends), never overhealing; a
// drop clamps current vitality down. Mutates and returns the character.
export function recomputeVitalityMax(character) {
  if (!character) return character;
  const prevMax = character.vitalityMax ?? 0;
  const nextMax = maxVitalityFor(character);
  const cur = character.vitality ?? nextMax;
  character.vitalityMax = nextMax;
  const delta = nextMax - prevMax;
  character.vitality = Math.max(0, Math.min(nextMax, delta > 0 ? cur + delta : cur));
  return character;
}

export function applyAttributeChanges(attrs, changes) {
  if (!changes) return { next: attrs, growthLines: [] };
  const next = { ...attrs };
  const growthLines = [];
  for (const k of ATTR_KEYS) {
    if (typeof changes[k] === "number" && changes[k] !== 0) {
      const before = next[k] ?? 0;
      next[k] = Math.max(0, Math.min(25, before + changes[k]));
      if (next[k] !== before) growthLines.push(`${ATTR_LABELS[k]} ${before} → ${next[k]}`);
    }
  }
  return { next, growthLines };
}
