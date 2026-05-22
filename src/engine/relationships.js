// Relationship (bond) tiers + memory bounds, shared by the engine, the narrator
// context, and the audit UIs. A character's `relationship` is points on a
// -100..100 scale; `memories` is their store of shared experiences with the
// player (kept separate from `knows`, which is general knowledge/facts).

export const REL_MIN = -100;
export const REL_MAX = 100;
export const MEMORY_CAP = 40; // keep the most recent N memories per character

export const clampRel = (p) => Math.max(REL_MIN, Math.min(REL_MAX, Math.round(p || 0)));

export function relationshipTier(points = 0) {
  const p = points || 0;
  if (p <= -60) return { label: "Hostile", color: "#fca5a5" };
  if (p <= -25) return { label: "Wary", color: "#e0913a" };
  if (p < 15) return { label: "Acquaintance", color: "#9ab0b0" };
  if (p < 40) return { label: "Friendly", color: "#cbb37a" };
  if (p < 70) return { label: "Trusted", color: "#a7d39a" };
  return { label: "Devoted", color: "#a7f3d0" };
}
