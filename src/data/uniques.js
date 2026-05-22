// Named / unique items and abilities. Unlike random loot (which the engine
// generates with a tier-prefixed name), these are hand-authored, fixed-stat,
// fixed-tier rewards with their own lore. They drop ONLY from specific foe kinds
// and/or deep-enough regions, never from the random generator, and never twice
// for the same character. Each carries a `drop` block:
//   dropFrom  — foe kinds that can drop it (optional)
//   minRegion — only in difficulty bands >= this (optional)
//   chance    — independent per-victory roll
//
// Unique ITEMS are codex item entries (+ a `combat` block). Unique ABILITIES
// are full ability defs (same schema as data/abilities.js) flagged `unique` so
// the random ability pool never offers them.

export const UNIQUE_ITEMS = [
  {
    drop: { dropFrom: ["ogre", "lone-troll", "stone-troll"], minRegion: 3, chance: 0.12 },
    entry: {
      id: "skullcleaver", name: "Skullcleaver", kind: "weapon", tier: "legendary",
      appearance: "A slab of black iron on a haft of bound sinew, far too heavy for any but the strongest to swing.",
      description: "The maul of some long-dead giant-killer, taken back from the things it was meant to kill.",
      combat: { damage: { min: 14, max: 22, type: "physical", pen: 6 }, weaponType: "mace" },
      passives: [{ id: "savage", tier: "legendary" }, { id: "piercing", tier: "epic" }, { id: "vampiric", tier: "rare" }],
    },
  },
  {
    drop: { dropFrom: ["wargs", "wolves"], minRegion: 3, chance: 0.1 },
    entry: {
      id: "wargfang", name: "Wargfang", kind: "weapon", tier: "epic",
      appearance: "A curved blade set with a great grey fang along the spine, still warm to the touch.",
      description: "Carried by the warg-rider whose pack you broke. It hungers a little.",
      combat: { damage: { min: 8, max: 13, type: "physical", pen: 3 }, weaponType: "sword" },
      passives: [{ id: "keen-edge", tier: "epic" }, { id: "vampiric", tier: "rare" }],
    },
  },
  {
    drop: { dropFrom: ["giant-spider"], minRegion: 2, chance: 0.12 },
    entry: {
      id: "venomweave", name: "Venomweave Shroud", kind: "armor", tier: "epic",
      appearance: "A cloak woven from pale, impossibly strong silk that turns a blade and shrugs off poison.",
      description: "Spun from the silk of the brood-mother. Light as breath, hard as horn.",
      combat: { armor: 8, ward: 4, dodge: 6 },
      passives: [{ id: "evasion", tier: "epic" }, { id: "enduring", tier: "rare" }],
    },
  },
  {
    drop: { dropFrom: ["bog-skeleton", "carrion-thrall"], minRegion: 4, chance: 0.1 },
    entry: {
      id: "pale-shroud", name: "Pale-Hand Shroud", kind: "armor", tier: "epic",
      appearance: "Grave-linen stiffened with bog-salt, marked with the Pale Hand's nine sigils.",
      description: "Taken off the walking dead of the Bonemarsh. It wards the mind as much as the body.",
      combat: { armor: 6, ward: 10 },
      passives: [{ id: "aegis", tier: "epic" }, { id: "mending", tier: "rare" }],
    },
  },
  {
    drop: { dropFrom: ["goblin-raiders", "orc-raiders", "orc-warband"], minRegion: 5, chance: 0.06 },
    entry: {
      id: "broken-ring-crown", name: "The Broken Ring", kind: "trinket", tier: "legendary",
      appearance: "A circlet of cold iron, snapped and re-welded, stamped with the Sundered Crown's broken ring.",
      description: "A warlord's badge from the Sundered Wastes. Those who wear it find others slower to defy them.",
      combat: { ward: 8, dodge: 8 },
      passives: [{ id: "evasion", tier: "legendary" }, { id: "fortunate", tier: "epic" }, { id: "precise", tier: "rare" }],
    },
  },
  {
    drop: { dropFrom: ["drakeling", "drake-wyrmling", "wyvern-passage", "wyrm-shadow"], minRegion: 5, chance: 0.07 },
    entry: {
      id: "drakeheart-ember", name: "Drakeheart Ember", kind: "trinket", tier: "mythical",
      appearance: "A coal that never cools, caged in gold melted around it.",
      description: "Cut from the breast of a wyrm of the Drakeholt. It drinks magic meant for you.",
      combat: { ward: 16, armor: 4 },
      passives: [{ id: "aegis", tier: "mythical" }, { id: "clearmind", tier: "epic" }, { id: "savage", tier: "rare" }],
    },
  },
];

export const UNIQUE_ABILITIES = [
  {
    id: "dragonbreath", name: "Dragonbreath", school: "arcane", icon: "flame", tier: "mythical",
    target: "all-enemies", damageType: "magical", scaleAttr: "mind",
    dmg: [10, 16], pen: 6, critBonus: 5, cost: 4, cooldown: 4, effect: null, unique: true,
    drop: { dropFrom: ["drakeling", "drake-wyrmling", "wyvern-passage", "wyrm-shadow"], minRegion: 5, chance: 0.05 },
    desc: "A cone of wyrm-fire that scorches every foe, biting through ward.",
  },
  {
    id: "kingsbane", name: "Kingsbane", school: "martial", icon: "swords", tier: "legendary",
    target: "enemy", damageType: "true", scaleAttr: "body",
    dmg: [12, 18], pen: 0, critBonus: 20, cost: 4, cooldown: 4, effect: { type: "bleed", value: 5, duration: 3, target: "enemy" }, unique: true,
    drop: { dropFrom: ["orc-raiders", "goblin-raiders", "orc-warband"], minRegion: 5, chance: 0.04 },
    desc: "A warlord-killing stroke that ignores all defence and leaves a deep wound.",
  },
  {
    id: "wraithstep", name: "Wraithstep", school: "shadow", icon: "moon", tier: "epic",
    target: "self", damageType: null, scaleAttr: "reflex",
    dmg: null, pen: 0, critBonus: 0, cost: 2, cooldown: 3,
    effect: { type: "focus", value: 60, duration: 2, target: "self" }, unique: true,
    drop: { dropFrom: ["carrion-thrall", "bog-skeleton"], minRegion: 4, chance: 0.05 },
    desc: "Step half into the grave-dark; your next strikes land with deadly certainty.",
  },
];

const ITEM_BY_ID = Object.fromEntries(UNIQUE_ITEMS.map((u) => [u.entry.id, u]));
const ABILITY_BY_ID = Object.fromEntries(UNIQUE_ABILITIES.map((a) => [a.id, a]));
export function uniqueItem(id) { return ITEM_BY_ID[id] || null; }
export function uniqueAbility(id) { return ABILITY_BY_ID[id] || null; }

function matches(drop, kinds, region) {
  if (drop.minRegion && region < drop.minRegion) return false;
  if (drop.dropFrom && drop.dropFrom.length) {
    if (!drop.dropFrom.some((k) => kinds.includes(k))) return false;
  }
  return true;
}

// Roll the unique drops for one victory. `kinds` = defeated foe kinds, `region`
// = difficulty band level, `owned` = ids the character already holds (no dupes),
// `mult` = global chance multiplier. Returns at most one item and one ability.
export function rollUniques({ kinds = [], region = 1, owned = new Set(), mult = 1 } = {}) {
  const item = pickOne(UNIQUE_ITEMS.filter((u) => !owned.has(u.entry.id) && matches(u.drop, kinds, region)), (u) => u.drop.chance * mult);
  const ability = pickOne(UNIQUE_ABILITIES.filter((a) => !owned.has(a.id) && matches(a.drop, kinds, region)), (a) => a.drop.chance * mult);
  return {
    item: item ? { itemId: item.entry.id, entry: stripDropMeta(item.entry), quantity: 1 } : null,
    ability: ability ? { id: ability.id, tier: ability.tier || "legendary", name: ability.name } : null,
  };
}

function pickOne(candidates, chanceOf) {
  // Independent rolls; if several hit, take a random winner.
  const hits = candidates.filter((c) => Math.random() < chanceOf(c));
  if (hits.length === 0) return null;
  return hits[Math.floor(Math.random() * hits.length)];
}
function stripDropMeta(entry) { const { ...rest } = entry; return rest; }
