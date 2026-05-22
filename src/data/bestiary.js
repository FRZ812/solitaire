// Enemy templates keyed by the spawn-table `kind`. Values are the COMMON-tier
// baseline; generateEnemy scales them by the rolled tier. `count` is the group
// size range. Anything not listed falls back to a generic block inferred from
// the kind name, so every hostile spawn can resolve to a fightable foe.

import { tierMult, rollTier } from "./tiers.js";
import { DEMEANOR_CONFIG, defaultDemeanor } from "./combat-flavor.js";

const T = (min, max, type = "physical", pen = 0) => ({ min, max, type, pen });

const GENERIC = {
  name: "Assailant", race: null, health: 12, armor: 1, ward: 0,
  dodge: 8, accuracy: 4, critChance: 5, speed: 4,
  damage: T(2, 5), abilities: [], count: [1, 1], maxLootTier: "uncommon",
};

export const BESTIARY = {
  // --- beasts / packs ---
  wolves:        { name: "Wolf",         race: "wolf",     health: 9,  armor: 0, dodge: 16, accuracy: 6, critChance: 8, speed: 7, damage: T(2, 5), abilities: ["rend"], count: [2, 4], maxLootTier: "uncommon" },
  "bog-hounds":  { name: "Bog-Hound",    race: "hound",    health: 8,  armor: 0, dodge: 14, accuracy: 5, critChance: 6, speed: 6, damage: T(2, 4), abilities: ["rend"], count: [2, 4], maxLootTier: "uncommon" },
  "wild-dogs":   { name: "Wild Dog",     race: "dog",      health: 6,  armor: 0, dodge: 14, accuracy: 5, speed: 6, damage: T(1, 4), abilities: [], count: [2, 5], maxLootTier: "common" },
  wargs:         { name: "Warg",         race: "warg",     health: 18, armor: 1, dodge: 14, accuracy: 7, critChance: 8, speed: 7, damage: T(4, 7), abilities: ["rend", "power-strike"], count: [1, 3], maxLootTier: "rare" },
  bear:          { name: "Brown Bear",   race: "bear",     health: 28, armor: 2, dodge: 4,  accuracy: 5, speed: 4, damage: T(5, 9), abilities: ["power-strike"], count: [1, 1], maxLootTier: "rare" },
  boar:          { name: "Wild Boar",    race: "boar",     health: 16, armor: 1, dodge: 6,  accuracy: 5, speed: 5, damage: T(3, 6, "physical", 2), abilities: [], count: [1, 2], maxLootTier: "uncommon" },
  owlbear:       { name: "Owlbear",      race: "owlbear",  health: 34, armor: 2, dodge: 6,  accuracy: 6, critChance: 8, speed: 5, damage: T(6, 10), abilities: ["power-strike", "rend"], count: [1, 1], maxLootTier: "epic" },
  "giant-spider":{ name: "Giant Spider", race: "spider",   health: 14, armor: 1, dodge: 18, accuracy: 7, speed: 6, damage: T(2, 4), abilities: ["venom-strike"], count: [1, 3], maxLootTier: "rare" },
  "salt-eel":    { name: "Salt-Eel",     race: "eel",      health: 12, armor: 1, dodge: 16, accuracy: 6, speed: 6, damage: T(3, 6), abilities: [], count: [1, 1], maxLootTier: "uncommon" },
  "leech-cloud": { name: "Blood-Leech",  race: "leech",    health: 4,  armor: 0, dodge: 10, accuracy: 4, speed: 5, damage: T(1, 2), abilities: ["venom-strike"], count: [3, 6], maxLootTier: "common" },
  "stirge-flight":{name: "Stirge",       race: "stirge",   health: 5,  armor: 0, dodge: 20, accuracy: 6, speed: 8, damage: T(1, 3), abilities: [], count: [3, 5], maxLootTier: "common" },

  // --- humanoid raiders ---
  bandits:       { name: "Bandit",       race: "human",    health: 14, armor: 2, dodge: 8,  accuracy: 5, critChance: 5, speed: 5, damage: T(3, 6), abilities: ["power-strike"], count: [2, 3], maxLootTier: "rare" },
  brigands:      { name: "Brigand",      race: "human",    health: 15, armor: 2, dodge: 8,  accuracy: 5, speed: 5, damage: T(3, 6), abilities: ["power-strike"], count: [2, 4], maxLootTier: "rare" },
  "lone-bandit": { name: "Cutthroat",    race: "human",    health: 13, armor: 1, dodge: 12, accuracy: 6, critChance: 10, speed: 6, damage: T(3, 6, "physical", 1), abilities: ["piercing-thrust"], count: [1, 1], maxLootTier: "rare" },
  "highway-brigands":{ name: "Highwayman", race: "human",  health: 15, armor: 2, dodge: 10, accuracy: 6, speed: 5, damage: T(3, 7), abilities: ["piercing-thrust", "power-strike"], count: [2, 4], maxLootTier: "rare" },
  "mountain-bandits":{ name: "Mountain Bandit", race: "human", health: 16, armor: 3, dodge: 8, accuracy: 5, speed: 4, damage: T(4, 7), abilities: ["power-strike"], count: [2, 3], maxLootTier: "rare" },
  cutthroats:    { name: "Cutthroat",    race: "human",    health: 13, armor: 1, dodge: 12, accuracy: 6, critChance: 10, speed: 6, damage: T(3, 6, "physical", 1), abilities: ["venom-strike"], count: [2, 2], maxLootTier: "rare" },
  "press-gang":  { name: "Press-Ganger", race: "human",    health: 16, armor: 2, dodge: 6,  accuracy: 4, speed: 4, damage: T(3, 6), abilities: [], count: [2, 3], maxLootTier: "uncommon" },
  pickpocket:    { name: "Pickpocket",   race: "human",    health: 9,  armor: 0, dodge: 22, accuracy: 6, speed: 7, damage: T(1, 3), abilities: [], count: [1, 1], maxLootTier: "uncommon" },

  // --- goblinoids / orcs ---
  goblins:       { name: "Goblin",       race: "goblin",   health: 7,  armor: 1, dodge: 14, accuracy: 5, speed: 6, damage: T(2, 4), abilities: [], count: [2, 4], maxLootTier: "rare" },
  "orc-scout":   { name: "Orc Scout",    race: "orc",      health: 18, armor: 3, dodge: 8,  accuracy: 6, speed: 5, damage: T(4, 7), abilities: ["power-strike"], count: [1, 2], maxLootTier: "rare" },
  "orc-raiders": { name: "Orc Raider",   race: "orc",      health: 20, armor: 4, dodge: 6,  accuracy: 6, critChance: 6, speed: 4, damage: T(5, 8), abilities: ["power-strike", "cleave"], count: [2, 5], maxLootTier: "epic" },

  // --- big & nasty ---
  ogre:          { name: "Ogre",         race: "ogre",     health: 46, armor: 3, dodge: 2,  accuracy: 5, speed: 3, damage: T(8, 14, "physical", 2), abilities: ["power-strike", "cleave"], count: [1, 1], maxLootTier: "epic" },
  "lone-troll":  { name: "Troll",        race: "troll",    health: 50, armor: 2, dodge: 3,  accuracy: 5, speed: 3, damage: T(7, 12), abilities: ["power-strike", "second-wind"], count: [1, 1], maxLootTier: "epic" },
  "stone-troll": { name: "Stone-Troll",  race: "troll",    health: 60, armor: 6, dodge: 1,  accuracy: 5, speed: 2, damage: T(8, 13, "physical", 1), abilities: ["power-strike"], count: [1, 1], maxLootTier: "legendary" },
  drakeling:     { name: "Drakeling",    race: "drakeborn",health: 24, armor: 3, ward: 4, dodge: 12, accuracy: 7, critChance: 8, speed: 6, damage: T(4, 8, "magical", 2), abilities: ["firebolt"], count: [1, 2], maxLootTier: "epic" },
  "wyvern-passage":{ name: "Wyvern",     race: "wyvern",   health: 40, armor: 4, ward: 2, dodge: 16, accuracy: 8, critChance: 10, speed: 8, damage: T(6, 11, "physical", 3), abilities: ["power-strike", "rend"], count: [1, 1], maxLootTier: "legendary" },

  // --- undead / aberrant ---
  "bog-skeleton":{ name: "Bog-Skeleton", race: "undead",   health: 11, armor: 2, dodge: 6, accuracy: 4, speed: 4, damage: T(2, 5), abilities: [], count: [1, 3], maxLootTier: "uncommon" },
  "carrion-thrall":{ name: "Carrion-Thrall", race: "undead", health: 13, armor: 1, dodge: 4, accuracy: 4, speed: 3, damage: T(2, 5), abilities: ["venom-strike"], count: [1, 3], maxLootTier: "uncommon" },
};

// Fallback inference for any hostile kind without an explicit template.
function inferTemplate(kind) {
  const k = (kind || "").toLowerCase();
  const has = (...w) => w.some((s) => k.includes(s));
  const t = { ...GENERIC, name: titleCase(k) };
  if (has("wolf", "hound", "dog", "beast", "boar", "cat", "rat")) { t.dodge = 14; t.speed = 6; t.count = [2, 3]; }
  if (has("bandit", "brigand", "cutthroat", "thief", "robber", "raider")) { t.race = "human"; t.armor = 2; t.damage = T(3, 6); t.count = [2, 3]; t.abilities = ["power-strike"]; t.maxLootTier = "rare"; }
  if (has("goblin")) { t.race = "goblin"; t.health = 7; t.dodge = 14; t.count = [2, 4]; }
  if (has("orc")) { t.race = "orc"; t.health = 18; t.armor = 3; t.damage = T(4, 7); t.abilities = ["power-strike"]; t.maxLootTier = "rare"; }
  if (has("troll", "ogre", "giant")) { t.health = 46; t.armor = 3; t.damage = T(8, 13); t.dodge = 2; t.maxLootTier = "epic"; }
  if (has("skeleton", "thrall", "wight", "ghoul", "undead", "corpse")) { t.race = "undead"; t.armor = 2; }
  return t;
}

function titleCase(s) { return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function randInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
const scale = (v, m) => Math.round((v || 0) * m);

// Build one enemy combatant instance of `kind` at the given tier.
export function generateEnemy(kind, { tierId = "common", index = 0, total = 1 } = {}) {
  const tmpl = BESTIARY[kind] || inferTemplate(kind);
  const m = tierMult(tierId);
  const tierOf = (TIERS_ORDER[tierId] || 0);
  const dmg = tmpl.damage || T(2, 5);
  const name = total > 1 ? `${tmpl.name} ${index + 1}` : tmpl.name;
  const maxHealth = Math.max(1, scale(tmpl.health, m));
  const demeanor = tmpl.demeanor || defaultDemeanor(kind, tmpl.race);
  const dcfg = DEMEANOR_CONFIG[demeanor] || DEMEANOR_CONFIG.wary;
  return {
    id: `enemy-${kind}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    kind, name, race: tmpl.race || null, tier: tierId,
    demeanor, morale: dcfg.morale, moraleMax: dcfg.morale,
    canTalk: !(demeanor === "mindless" || demeanor === "feral"),
    controlPressure: 0, provoked: false, resolved: null, lastFlavorTurn: 0, noFleeUntil: 0,
    maxHealth, health: maxHealth,
    armor: scale(tmpl.armor, m), ward: scale(tmpl.ward, m),
    dodge: Math.min(60, (tmpl.dodge || 0) + tierOf * 2),
    accuracy: (tmpl.accuracy || 4) + tierOf,
    critChance: Math.min(50, (tmpl.critChance || 4) + tierOf * 2),
    critMult: 1.5,
    speed: (tmpl.speed || 4) + Math.floor(tierOf / 2),
    weapon: { min: Math.max(1, scale(dmg.min, m)), max: Math.max(1, scale(dmg.max, m)), type: dmg.type || "physical", pen: scale(dmg.pen, m) },
    abilities: (tmpl.abilities || []).map((id) => ({ id, tier: tierId })),
    maxLootTier: tmpl.maxLootTier || "uncommon",
    statuses: [],
    cooldowns: {},
  };
}

const TIERS_ORDER = { common: 0, uncommon: 1, rare: 2, "very-rare": 3, epic: 4, legendary: 5, mythical: 6, divine: 7 };

// Build a whole hostile group for a spawn kind. `power` (0..1) is the rollTier
// luck (nudge toward the high end); `maxTier` caps the tier (a region's
// enemyTier ceiling). When maxTier is omitted it's derived from power.
export function generateEnemyGroup(kind, { power = 0, maxTier = null } = {}) {
  const tmpl = BESTIARY[kind] || inferTemplate(kind);
  const [lo, hi] = tmpl.count || [1, 1];
  const count = randInt(lo, hi);
  const cap = maxTier || (power >= 0.75 ? "legendary" : power >= 0.5 ? "epic" : power >= 0.25 ? "very-rare" : "rare");
  const enemies = [];
  for (let i = 0; i < count; i++) {
    const tierId = rollTier(cap, power);
    enemies.push(generateEnemy(kind, { tierId, index: i, total: count }));
  }
  return enemies;
}
