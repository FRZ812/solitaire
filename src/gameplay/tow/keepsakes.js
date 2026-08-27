// The authored starting-keepsake catalogue.
//
// Relics are permanent: the chosen id is stored on the character profile and its TOW item
// grant is folded into every encounter without occupying a normal equipment slot. Supplies
// are the four replay-safe one-use combat items. Powerful relics already carry stable
// achievement requirements, even though the campaign achievement ledger is not wired yet;
// the selector can accept those ids later without changing this data shape.

import { itemTemplate } from "../../data/catalog.js";
import { describeCombatItemEffect, getCombatItem } from "./combat-items.js";

export const KEEPSAKE_FAMILIES = Object.freeze({
  relic: "Permanent relics",
  supply: "Emergency supplies",
});

function achievement(id, name, requirement) {
  return Object.freeze({ type: "achievement", id, name, requirement });
}

function relic(id, rarity, effect, {
  stats = {},
  traits = {},
  skills = [],
  fusions = [],
  unlock = null,
} = {}) {
  const item = itemTemplate(id);
  if (!item) throw new TypeError(`unknown-keepsake-item:${id}`);
  return Object.freeze({
    id,
    itemId: id,
    name: item.name,
    description: item.description,
    rarity,
    family: "relic",
    permanent: true,
    effect,
    stats: Object.freeze({ ...stats }),
    traits: Object.freeze({ ...traits }),
    skills: Object.freeze([...skills]),
    fusions: Object.freeze([...fusions]),
    unlock,
  });
}

function supply(id, rarity) {
  const item = getCombatItem(id);
  if (!item) throw new TypeError(`unknown-keepsake-supply:${id}`);
  return Object.freeze({
    id,
    itemId: id,
    name: item.name,
    description: item.description,
    rarity,
    family: "supply",
    permanent: false,
    effect: `${describeCombatItemEffect(item)} · one use`,
    stats: Object.freeze({}),
    traits: Object.freeze({}),
    skills: Object.freeze([]),
    fusions: Object.freeze([]),
    unlock: null,
  });
}

export const PERMANENT_STARTING_KEEPSAKES = Object.freeze([
  relic("threadbare-war-ribbon", "common", "+4 max HP", {
    stats: { maxHp: 4 },
  }),
  relic("frostglass-bead", "uncommon", "+2 DEF · +4 max HP", {
    stats: { defense: 2, maxHp: 4 },
  }),
  relic("red-wolf-token", "rare", "+3 ATK · +3% Critical", {
    stats: { attack: 3, critRate: 3 },
  }),
  relic("saints-broken-halo", "epic", "+4 DEF · +10 max HP · Aegis I", {
    stats: { defense: 4, maxHp: 10 },
    traits: { aegis: 1 },
    unlock: achievement(
      "hold-the-line",
      "Hold the Line",
      "Win after surviving a hit below 20% health.",
    ),
  }),
  relic("crownless-coin", "legendary", "+5 ATK · +5 DEF · +5% Critical · +5% Dodge", {
    stats: { attack: 5, defense: 5, critRate: 5, dodgeRate: 5 },
    unlock: achievement(
      "tower-conqueror",
      "Tower Conqueror",
      "Defeat the Tower's final guardian.",
    ),
  }),
  relic("heart-of-still-winter", "mythical", "+8 ATK · +8 DEF · +20 max HP · +6 max Resolve · +2 Resolve/round · +8% Critical · +8% Dodge", {
    stats: {
      attack: 8,
      defense: 8,
      maxHp: 20,
      resolveMax: 6,
      resolveRegen: 2,
      critRate: 8,
      dodgeRate: 8,
    },
    unlock: achievement(
      "winter-without-end",
      "Winter Without End",
      "Conquer the Tower with every combat archetype.",
    ),
  }),
]);

export const STARTING_KEEPSAKES = Object.freeze([
  ...PERMANENT_STARTING_KEEPSAKES,
  supply("crimson-vial", "common"),
  supply("lucid-tonic", "uncommon"),
  supply("warding-ash", "uncommon"),
  supply("fire-pot", "common"),
]);

export const DEFAULT_STARTING_KEEPSAKE_ID = PERMANENT_STARTING_KEEPSAKES[0].id;

const KEEPSAKE_BY_ID = new Map(STARTING_KEEPSAKES.map((entry) => [entry.id, entry]));

export function getStartingKeepsake(id) {
  return typeof id === "string" ? KEEPSAKE_BY_ID.get(id) || null : null;
}

export function isStartingKeepsake(id) {
  return Boolean(getStartingKeepsake(id));
}

export function startingKeepsakesForFamily(family) {
  return STARTING_KEEPSAKES.filter((entry) => entry.family === family);
}

export function isKeepsakeUnlocked(itemOrId, achievementIds = []) {
  const keepsake = typeof itemOrId === "string" ? getStartingKeepsake(itemOrId) : itemOrId;
  if (!keepsake) return false;
  if (!keepsake.unlock) return true;
  const earned = achievementIds instanceof Set ? achievementIds : new Set(achievementIds || []);
  return earned.has(keepsake.unlock.id);
}

export function describeStartingKeepsakeEffect(itemOrId) {
  const keepsake = typeof itemOrId === "string" ? getStartingKeepsake(itemOrId) : itemOrId;
  return keepsake?.effect || "No keepsake effect";
}

export function permanentItemIdForKeepsake(id) {
  const keepsake = getStartingKeepsake(id);
  return keepsake?.permanent ? keepsake.itemId : null;
}

export function combatItemIdForKeepsake(id) {
  const keepsake = getStartingKeepsake(id);
  return keepsake && !keepsake.permanent ? keepsake.itemId : null;
}
