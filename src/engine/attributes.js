import { ATTR_KEYS, ATTR_LABELS } from "../config.js";
import { effectiveAttributes } from "../data/proficiencies.js";

// The player's max HP is derived from VIGOR (so toughness is a real, investable
// stat — mirroring how NPCs get HP from vigor). A linear floor keeps early builds
// near the legacy baseline (vigor ≈ 2 → ~30), plus a back-loaded curve that pays
// off the grind: vigor 30 → ~+840 on top, so a maxed build reads ~1010 max HP.
// (This is the ONE home for vigor's HP — combat reads vitalityMax, and the
// attribute-threshold table no longer adds vigor maxHealth, to avoid double-count.)
export const BASE_VITALITY = 20;
export const HP_PER_VIGOR = 5;

export function maxVitalityFor(character) {
  const vigor = effectiveAttributes(character).vigor || 0;
  const curve = Math.round(Math.max(0, vigor * vigor - 16) * 0.95); // ~0 at vigor ≤4, ~+840 at 30
  return Math.round(BASE_VITALITY + vigor * HP_PER_VIGOR + curve);
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
