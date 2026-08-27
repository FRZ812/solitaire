// Replay-safe active items for Archetype combat.
//
// Ownership stays in the campaign inventory. A fight snapshots only the quantities carried
// when it opens, then records every use as an encounter event; settlement spends those exact
// quantities from the real pack. Practice uses the same reducer but owns no campaign state,
// so its keepsake can be tried without being consumed outside the disposable session.

import { itemTemplate } from "../../data/catalog.js";

export const COMBAT_COMBAT_ITEM_VERSION = 1;
export const MAX_COMBAT_ITEM_QUANTITY = 99;

function combatItem(id, effect) {
  const item = itemTemplate(id);
  if (!item) throw new TypeError(`unknown-combat-item:${id}`);
  return Object.freeze({
    id,
    name: item.name,
    description: item.description,
    consumesTurn: true,
    effect: Object.freeze({ ...effect }),
  });
}

export const STARTING_COMBAT_ITEMS = Object.freeze([
  combatItem("crimson-vial", { type: "heal-max-percent", percent: 25, target: "self" }),
  combatItem("lucid-tonic", {
    type: "restore-resolve",
    amount: 3,
    regenMinimum: 2,
    target: "self",
  }),
  combatItem("warding-ash", { type: "shield-defense-percent", percent: 150, target: "self" }),
  combatItem("fire-pot", { type: "damage-attack-percent", percent: 150, target: "enemy" }),
]);

const COMBAT_ITEM_BY_ID = new Map(STARTING_COMBAT_ITEMS.map((entry) => [entry.id, entry]));

export function getCombatItem(id) {
  return typeof id === "string" ? COMBAT_ITEM_BY_ID.get(id) || null : null;
}

export function isStartingCombatItem(id) {
  return Boolean(getCombatItem(id));
}

export function normalizeCombatItems(input = []) {
  if (!Array.isArray(input)) return [];
  const quantities = new Map();
  for (const entry of input) {
    const id = typeof entry === "string" ? entry : entry?.id;
    const quantity = typeof entry === "string" ? 1 : entry?.quantity;
    if (!getCombatItem(id) || !Number.isSafeInteger(quantity) || quantity <= 0) continue;
    quantities.set(id, Math.min(
      MAX_COMBAT_ITEM_QUANTITY,
      (quantities.get(id) || 0) + quantity,
    ));
  }
  return [...quantities].map(([id, quantity]) => ({ id, quantity }));
}

/** Every combat-usable consumable currently carried by one inventory. */
export function combatItemsFromInventory(inventory = {}) {
  return normalizeCombatItems((inventory.carried || []).map((entry) => ({
    id: entry?.itemId,
    quantity: entry?.quantity,
  })));
}

/** Item quantities spent by one actor in one authoritative encounter log. */
export function spentCombatItems(encounter, actorId = encounter?.playerId) {
  const spent = {};
  for (const event of encounter?.events || []) {
    if (event.type !== "combat-item-used" || event.actorId !== actorId) continue;
    spent[event.itemId] = (spent[event.itemId] || 0) + 1;
  }
  return spent;
}

/** Remove already-resolved combat consumables from the durable pack. */
export function settleCombatItems(inventory = {}, spent = {}) {
  if (!inventory || !Array.isArray(inventory.carried)) return inventory;
  let changed = false;
  const remainingSpend = Object.fromEntries(Object.entries(spent).map(([id, quantity]) => [
    id,
    Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 0,
  ]));
  const carried = inventory.carried.flatMap((entry) => {
    const requested = remainingSpend[entry.itemId] || 0;
    if (requested <= 0) return [entry];
    const available = Math.max(0, Number.isSafeInteger(entry.quantity) ? entry.quantity : 0);
    const quantity = Math.min(available, requested);
    if (quantity <= 0) return [entry];
    changed = true;
    remainingSpend[entry.itemId] = requested - quantity;
    const remaining = available - quantity;
    return remaining > 0 ? [{ ...entry, quantity: remaining }] : [];
  });
  return changed ? { ...inventory, carried } : inventory;
}

export function describeCombatItemEffect(itemOrId) {
  const item = typeof itemOrId === "string" ? getCombatItem(itemOrId) : itemOrId;
  const effect = item?.effect;
  if (!effect) return "No combat effect";
  if (effect.type === "heal-max-percent") return `Restore ${effect.percent}% max HP`;
  if (effect.type === "restore-resolve") {
    const recovery = effect.regenMinimum
      ? ` · raise recovery to ${effect.regenMinimum} Resolve/round`
      : "";
    return `Restore ${effect.amount} Resolve${recovery}`;
  }
  if (effect.type === "shield-defense-percent") return `Raise ${effect.percent}% DEF ward`;
  if (effect.type === "damage-attack-percent") return `Strike for ${effect.percent}% ATK`;
  return "Unknown combat effect";
}
