// Universal quality tiers. Everything that can be graded — abilities, weapons,
// armour, enemies, loot — carries a tier id from this ladder. `mult` is the
// power multiplier applied to a base stat block to scale it to the tier;
// `weight` drives random drops (rarer tiers are exponentially less common).

// Retuned curve: a clean geometric ramp for a level-less game where the only
// progression is gear/ability tier + slow attribute growth. The early/mid steps
// (~+34%) are kept stable for balance; the TOP END accelerates so each high tier
// is an immediately-noticeable leap — legendary, mythical, and a DIVINE spike
// (≈ ×12, godhood). Drop weights ×~0.4 per step so the top stays genuinely rare.
// These multipliers + weights are the single source of truth for tier power and
// rarity (see docs/WORLDBUILDING.md › Balance).
export const TIERS = [
  { id: "common",    label: "Common",    order: 0, color: "#b8b0a0", mult: 1.0, weight: 1000 },
  { id: "uncommon",  label: "Uncommon",  order: 1, color: "#74c66b", mult: 1.35, weight: 420 },
  { id: "rare",      label: "Rare",      order: 2, color: "#5aa9e6", mult: 1.8, weight: 170 },
  { id: "very-rare", label: "Very Rare", order: 3, color: "#b072e6", mult: 2.4, weight: 64 },
  { id: "epic",      label: "Epic",      order: 4, color: "#e0913a", mult: 3.2, weight: 24 },
  { id: "legendary", label: "Legendary", order: 5, color: "#f5d76e", mult: 5.2, weight: 8 },
  { id: "mythical",  label: "Mythical",  order: 6, color: "#ff6f91", mult: 7.6, weight: 2.4 },
  { id: "divine",    label: "Divine",    order: 7, color: "#fbf5e3", mult: 12.0, weight: 0.5 },
];

export const TIER_BY_ID = Object.fromEntries(TIERS.map((t) => [t.id, t]));
const DEFAULT_TIER = TIERS[0];

export function tier(id)      { return TIER_BY_ID[id] || DEFAULT_TIER; }
export function tierColor(id) { return tier(id).color; }
export function tierLabel(id) { return tier(id).label; }
export function tierMult(id)  { return tier(id).mult; }
export function tierOrder(id) { return tier(id).order; }

// Weighted random tier, capped at maxTierId (inclusive). `luck` (0..1) nudges
// the roll toward rarer tiers by inflating the high-end weights.
export function rollTier(maxTierId = "legendary", luck = 0) {
  const cap = tierOrder(maxTierId);
  const pool = TIERS.filter((t) => t.order <= cap);
  const weights = pool.map((t) => t.weight * (1 + luck * t.order * 0.6));
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i].id;
  }
  return pool[pool.length - 1].id;
}

// One step up the ladder (for upgrade effects), clamped at divine.
export function nextTier(id) {
  const o = tierOrder(id);
  return (TIERS[o + 1] || TIERS[o]).id;
}
