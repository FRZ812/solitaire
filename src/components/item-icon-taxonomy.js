import { ALL_ITEMS } from "../data/catalog.js";
import { isFusionRune } from "../data/passives.js";
import { armorClass, equipSlot, weaponCategory } from "../engine/combat-stats.js";

const equipmentCell = (key, label, column, row) => Object.freeze({
  atlas: "equipment",
  key,
  label,
  column,
  row,
  columns: 4,
  rows: 4,
});

const itemCell = (key, label, column, row) => Object.freeze({
  atlas: "items",
  key,
  label,
  column,
  row,
  columns: 3,
  rows: 3,
});

const EQUIPMENT_CELLS = Object.freeze({
  dagger: equipmentCell("dagger", "Dagger", 0, 0),
  sword: equipmentCell("sword", "Sword", 1, 0),
  axe: equipmentCell("axe", "Axe", 2, 0),
  mace: equipmentCell("mace", "Mace", 3, 0),
  spear: equipmentCell("spear", "Spear", 0, 1),
  bow: equipmentCell("bow", "Bow", 1, 1),
  crossbow: equipmentCell("crossbow", "Crossbow", 2, 1),
  arcane: equipmentCell("arcane", "Arcane focus", 3, 1),
  shield: equipmentCell("shield", "Shield", 0, 2),
  "armor-light": equipmentCell("armor-light", "Light armour", 1, 2),
  "armor-heavy": equipmentCell("armor-heavy", "Heavy armour", 2, 2),
  head: equipmentCell("head", "Headwear", 3, 2),
  hands: equipmentCell("hands", "Handwear", 0, 3),
  feet: equipmentCell("feet", "Footwear", 1, 3),
  "back-or-cloak": equipmentCell("back-or-cloak", "Cloak or clothing", 2, 3),
  trinket: equipmentCell("trinket", "Trinket", 3, 3),
});

const ITEM_CELLS = Object.freeze({
  remedy: itemCell("remedy", "Remedy", 0, 0),
  food: itemCell("food", "Food", 1, 0),
  drink: itemCell("drink", "Drink", 2, 0),
  tool: itemCell("tool", "Tool", 0, 1),
  light: itemCell("light", "Light source", 1, 1),
  camp: itemCell("camp", "Camp gear", 2, 1),
  material: itemCell("material", "Material", 0, 2),
  rune: itemCell("rune", "Fusion rune", 1, 2),
  "key-item": itemCell("key-item", "Key item", 2, 2),
});

const WEAPON_KEYS = new Set(["dagger", "sword", "axe", "mace", "spear", "bow", "crossbow", "arcane"]);
const LIGHT_USES = new Set(["light", "fire", "fuel"]);
const CAMP_USES = new Set(["camp", "rest", "cook"]);
const KEY_ITEM_KINDS = new Set(["key", "key-item", "quest", "quest-item", "document", "token"]);

function resolvedItem(item, itemId) {
  const id = itemId || item?.id || "";
  const catalogItem = id ? ALL_ITEMS[id] : null;
  if (!catalogItem) return item ? { ...item, id } : { id };
  return item ? { ...catalogItem, ...item, id } : catalogItem;
}

function toolCell(item) {
  const uses = new Set((item.tool?.uses || []).map((use) => String(use).toLowerCase()));
  if ([...uses].some((use) => LIGHT_USES.has(use))) return ITEM_CELLS.light;
  if ([...uses].some((use) => CAMP_USES.has(use))) return ITEM_CELLS.camp;
  return ITEM_CELLS.tool;
}

function clothingCell(item) {
  const slot = equipSlot(item);
  if (slot === "head") return EQUIPMENT_CELLS.head;
  if (slot === "hands") return EQUIPMENT_CELLS.hands;
  if (slot === "feet") return EQUIPMENT_CELLS.feet;
  if (slot === "neck" || slot === "ring") return EQUIPMENT_CELLS.trinket;
  return EQUIPMENT_CELLS["back-or-cloak"];
}

/**
 * Resolve an item to one semantic atlas cell. Coordinates are zero-based and
 * keys describe categories/types, never individual item identities.
 */
export function itemIconTaxonomy(item, itemId) {
  const definition = resolvedItem(item, itemId);
  const kind = String(definition.kind || "").toLowerCase();

  if (kind === "weapon") {
    const category = weaponCategory(definition);
    return EQUIPMENT_CELLS[WEAPON_KEYS.has(category) ? category : "sword"];
  }
  if (kind === "shield") return EQUIPMENT_CELLS.shield;
  if (kind === "armor" || kind === "armour") {
    return EQUIPMENT_CELLS[armorClass({ ...definition, kind: "armor" }) === "heavy" ? "armor-heavy" : "armor-light"];
  }
  if (kind === "clothing") return clothingCell(definition);
  if (kind === "trinket") return EQUIPMENT_CELLS.trinket;

  if (kind === "remedy") return ITEM_CELLS.remedy;
  if (kind === "food" || kind === "feed") return ITEM_CELLS.food;
  if (kind === "drink") return ITEM_CELLS.drink;
  if (kind === "tool") return toolCell(definition);
  if (kind === "light" || kind === "light-source") return ITEM_CELLS.light;
  if (kind === "camp" || kind === "camp-gear") return ITEM_CELLS.camp;
  if (kind === "material") return isFusionRune(definition.id) ? ITEM_CELLS.rune : ITEM_CELLS.material;
  if (kind === "rune") return ITEM_CELLS.rune;
  if (KEY_ITEM_KINDS.has(kind)) return ITEM_CELLS["key-item"];

  return ITEM_CELLS["key-item"];
}
