// Weight & carrying capacity — the single home for all load math, the way
// combat-stats.js owns combat inference and attributes.js owns HP/resolve.
//
// We do NOT hand-weight every item. An item's weight is INFERRED from its kind +
// name (reusing the same keyword families combat-stats.js reads for damage/armour),
// and an explicit `weight` on a template always wins for outliers (a colossal
// shield, a featherlight unique vest). Tools and a few odd goods carry their own
// explicit `weight` since they don't follow a family curve.
//
// Units are abstract "stone" — a coin weighs ~nothing, a hauberk a great deal.
// Living creatures carry a `bodyWeight` (their own mass) which is what they weigh
// as CARGO when they ride a mount (engine/riding.js).

import { weaponCategory, armorClass } from "./combat-stats.js";
import { itemTemplate } from "../data/catalog.js";

// Base weight by item kind — the fallback when nothing more specific applies.
export const WEIGHT_BY_KIND = {
  remedy: 1, drink: 1, food: 2, material: 3, supply: 2, tool: 3,
  trinket: 1, clothing: 2, shield: 7, weapon: 3, armor: 14, other: 2,
};

// Per weapon-family base (a maul is not a dagger). Heft keywords nudge from here.
const WEAPON_WEIGHT = { dagger: 1, sword: 3, axe: 4, mace: 5, spear: 4, bow: 2, crossbow: 5, arcane: 2, unarmed: 1 };
const HEAVY_WEAPON = ["great", "greater", "two-handed", "twohanded", "maul", "halberd", "glaive", "poleaxe", "bardiche", "partisan", "pike", "zweihander", "claymore", "executioner", "warhammer", "war hammer", "war-hammer", "heavy", "arbalest", "battle", "lance"];
const LIGHT_WEAPON = ["short", "hand axe", "hand-axe", "throwing", "light", "stiletto", "main-gauche", "hatchet", "needle"];

// A coin or two is nothing; a war-chest is a burden. This many coins (in copper) = 1 stone.
export const COIN_PER_STONE = 500;

// Default body mass by race (for the cargo a creature is when it rides). Mounts
// author their own bodyWeight in data/mounts.js; this covers people.
export const BODY_WEIGHT_BY_RACE = {
  human: 14, halfling: 8, gnome: 8, goblin: 7, dwarf: 13, elf: 12, "half-elf": 13,
  orc: 18, "half-orc": 17, drakeborn: 16, beastfolk: 14, demon: 22, ogre: 40, troll: 45, giant: 90,
};
export const DEFAULT_BODY_WEIGHT = 14;

export function bodyWeightForRace(race) {
  return BODY_WEIGHT_BY_RACE[race] ?? DEFAULT_BODY_WEIGHT;
}

const lc = (item) => `${item?.name || ""} ${item?.id || ""}`.toLowerCase();
const hasWord = (name, words) => words.some((w) => name.includes(w));

// The weight of one unit of an item template.
export function itemWeight(item) {
  if (!item) return 0;
  if (typeof item.weight === "number") return item.weight; // explicit override wins
  const name = lc(item);

  if (item.kind === "weapon" || weaponCategory(item)) {
    const cat = weaponCategory(item) || "sword";
    let w = WEAPON_WEIGHT[cat] ?? WEIGHT_BY_KIND.weapon;
    if (hasWord(name, HEAVY_WEAPON)) w = Math.round(w * 1.5);
    else if (hasWord(name, LIGHT_WEAPON)) w = Math.max(1, Math.round(w * 0.6));
    return w;
  }

  if (item.kind === "shield") {
    if (hasWord(name, ["tower", "colossal", "wall"])) return 16;
    if (hasWord(name, ["buckler"])) return 3;
    return WEIGHT_BY_KIND.shield;
  }

  if (item.kind === "armor") {
    return armorClass(item) === "heavy" ? 24 : 10;
  }

  if (item.kind === "clothing") {
    if (hasWord(name, ["greave", "gauntlet", "vambrace", "pauldron"])) return 3;
    if (hasWord(name, ["helm", "helmet", "cap", "coif", "bracer", "boot", "shoe", "glove"])) return 1;
    return WEIGHT_BY_KIND.clothing; // cloaks, robes, coats
  }

  let w = WEIGHT_BY_KIND[item.kind] ?? WEIGHT_BY_KIND.other;
  if (hasWord(name, ["sack", "barrel", "keg", "anvil", "ingot", "bar of", "crate"])) w = Math.round(w * 2);
  return w;
}

// Resolve a template the way upkeep.js does: codex copy first, then the catalog.
function defOf(codexItems, id) {
  return codexItems?.[id] || itemTemplate(id);
}

export function coinWeight(coins) {
  const cp = (coins?.copper || 0) + (coins?.silver || 0) * 10 + (coins?.gold || 0) * 100;
  return Math.floor(cp / COIN_PER_STONE);
}

// Weight of a {carried:[{itemId,quantity}], coins} inventory.
export function carriedWeight(inventory, codexItems) {
  if (!inventory) return 0;
  let w = 0;
  for (const c of inventory.carried || []) {
    w += itemWeight(defOf(codexItems, c.itemId)) * (c.quantity || 0);
  }
  return w + coinWeight(inventory.coins);
}

// Weight of everything a character wears (their worn list lives on the codex entry).
export function wornWeight(character, codexItems) {
  let w = 0;
  for (const id of character?.worn || []) w += itemWeight(defOf(codexItems, id));
  return w;
}

// Total carried + worn for a character. The player also bears the pack inventory.
export function loadOf(character, inventory, codexItems) {
  return wornWeight(character, codexItems) + (inventory ? carriedWeight(inventory, codexItems) : 0);
}

export function capacityOf(character) {
  return character?.carryCapacityMax ?? Infinity;
}

export function isOverCapacity(character, inventory, codexItems) {
  return loadOf(character, inventory, codexItems) > capacityOf(character);
}

export function remainingCapacity(character, inventory, codexItems) {
  return capacityOf(character) - loadOf(character, inventory, codexItems);
}
