// Combat balance — the single source of truth for loot odds and the difficulty
// ladder. Tier power/rarity lives in tiers.js; region → difficulty assignment
// lives in regions.js. See docs/WORLDBUILDING.md › Balance for the rationale.
//
// There is NO level system: a character's power comes only from (1) slow,
// narrative attribute growth and (2) the tier of their gear/abilities. So the
// world is gated by REGION, not by player level — each area has a fixed
// difficulty band that sets the tier ceiling of its foes and loot. Walk
// somewhere dangerous early and you will be out-classed; that's intended.

// Per-victory drop rolls.
export const ITEM_DROP_CHANCE = 0.55;     // a generic item drops
export const ABILITY_DROP_CHANCE = 0.22;  // a learnable ability drops
export const UNIQUE_DROP_CHANCE = 1.0;    // gate is per-unique `chance`; this is a global multiplier

// Difficulty bands, easiest (1) to deadliest (6). `power` feeds rollTier's luck
// (nudges toward the high end of the allowed range); `enemyTier` caps the tier
// of generated foes; `lootTier` caps the tier of their drops.
export const DIFFICULTY_BANDS = {
  1: { level: 1, label: "Settled",     power: 0.05, enemyTier: "uncommon",  lootTier: "uncommon" },
  2: { level: 2, label: "Borderlands", power: 0.15, enemyTier: "rare",      lootTier: "rare" },
  3: { level: 3, label: "Wilds",       power: 0.30, enemyTier: "very-rare", lootTier: "very-rare" },
  4: { level: 4, label: "Marches",     power: 0.50, enemyTier: "epic",      lootTier: "epic" },
  5: { level: 5, label: "Far Reaches", power: 0.70, enemyTier: "legendary", lootTier: "legendary" },
  6: { level: 6, label: "Fabled",      power: 0.90, enemyTier: "divine",    lootTier: "divine" },
};

export function difficultyBand(level) {
  return DIFFICULTY_BANDS[level] || DIFFICULTY_BANDS[1];
}
