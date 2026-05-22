// Universal quality tiers. Everything that can be graded — abilities, weapons,
// armour, enemies, loot — carries a tier id from this ladder. `mult` is the
// power multiplier applied to a base stat block to scale it to the tier;
// `weight` drives random drops (rarer tiers are exponentially less common).

export const TIERS = [
  { id: "common",    label: "Common",    order: 0, color: "#b8b0a0", mult: 1.0,  weight: 1000 },
  { id: "uncommon",  label: "Uncommon",  order: 1, color: "#74c66b", mult: 1.3,  weight: 460 },
  { id: "rare",      label: "Rare",      order: 2, color: "#5aa9e6", mult: 1.7,  weight: 200 },
  { id: "very-rare", label: "Very Rare", order: 3, color: "#b072e6", mult: 2.2,  weight: 84 },
  { id: "epic",      label: "Epic",      order: 4, color: "#e0913a", mult: 2.9,  weight: 34 },
  { id: "legendary", label: "Legendary", order: 5, color: "#f5d76e", mult: 3.8,  weight: 13 },
  { id: "mythical",  label: "Mythical",  order: 6, color: "#ff6f91", mult: 5.0,  weight: 4 },
  { id: "divine",    label: "Divine",    order: 7, color: "#fbf5e3", mult: 6.5,  weight: 1 },
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
