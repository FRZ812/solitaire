// Attractiveness — a numeric 1–10 hard-ruled field, not a freeform descriptor.
// Every character carries an integer; the narrator READS it instead of re-inferring
// per call. Pricing logic (slave market desirability) reads it directly too.
//
// Scale anchors are the world-canon bands the narrator's prose should land in.
// Use `descriptorFor` for UI fallbacks and `clampAttractiveness` to keep
// out-of-range author/discovery values inside [1, 10].

export const ATTRACTIVENESS_ANCHORS = [
  { min: 1, max: 2, label: "grotesque",  examples: "the Hag, a leper, a wyrm-burned ruin" },
  { min: 3, max: 4, label: "marked",     examples: "Old Pieter, a war-veteran" },
  { min: 5, max: 6, label: "plain",      examples: "Garran, Tomkin, Loff the Debtor" },
  { min: 7, max: 8, label: "comely",     examples: "Lis, Tama, Voss" },
  { min: 9, max: 10, label: "breathtaking", examples: "Lirilin, a demonborn courtier" },
];

export function descriptorFor(n) {
  if (typeof n !== "number" || !isFinite(n)) return null;
  const k = Math.max(1, Math.min(10, Math.round(n)));
  for (const a of ATTRACTIVENESS_ANCHORS) if (k >= a.min && k <= a.max) return a.label;
  return null;
}

export function clampAttractiveness(n) {
  if (typeof n !== "number" || !isFinite(n)) return null;
  return Math.max(1, Math.min(10, Math.round(n)));
}
