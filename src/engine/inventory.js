// Applies inventory_changes from the AI: added/removed items and coin deltas.
// Clamps coins at zero; collapses zero-quantity entries. `day` (the current
// campaign day) stamps freshUntil on any perishable food added, so narrator-
// granted food (foraging, gifts, loot) spoils like bought food.

import { goodDef } from "../data/goods.js";
import { stampFreshUntil } from "./spoilage.js";
import { equipSlot, slotCapacity, weaponHands } from "./combat-stats.js";

export function applyInventoryChanges(inv, changes, day = 0) {
  if (!changes) return inv;
  const next = {
    carried: inv.carried.map(c => ({ ...c })),
    coins: { ...inv.coins },
  };
  for (const add of (changes.added || [])) {
    if (!add?.itemId) continue;
    const existing = next.carried.find(c => c.itemId === add.itemId);
    if (existing) { existing.quantity += add.quantity || 1; stampFreshUntil(existing, goodDef(add.itemId), day); }
    else { const stack = { itemId: add.itemId, quantity: add.quantity || 1 }; stampFreshUntil(stack, goodDef(add.itemId), day); next.carried.push(stack); }
  }
  for (const rem of (changes.removed || [])) {
    if (!rem?.itemId) continue;
    const idx = next.carried.findIndex(c => c.itemId === rem.itemId);
    if (idx >= 0) {
      next.carried[idx].quantity -= rem.quantity || 1;
      if (next.carried[idx].quantity <= 0) next.carried.splice(idx, 1);
    }
  }
  if (changes.coins) {
    next.coins.copper = Math.max(0, next.coins.copper + (changes.coins.copper || 0));
    next.coins.silver = Math.max(0, next.coins.silver + (changes.coins.silver || 0));
    next.coins.gold   = Math.max(0, next.coins.gold   + (changes.coins.gold   || 0));
  }
  return next;
}

export const EQUIPPABLE = new Set(["weapon", "armor", "clothing", "trinket", "shield"]);

// Move a carried item onto the wanderer's worn list (codex), enforcing equipment
// SLOTS so combat effects can't be stacked: one item per slot (two rings), a
// two-handed weapon and a shield are mutually exclusive (a 2H weapon needs both
// hands). Equipping into a full slot displaces the current occupant to the pack.
export function equipItem(state, itemId) {
  const codex = state.world.codex;
  const item = codex.items?.[itemId];
  const wanderer = codex.characters?.wanderer;
  if (!item || !wanderer) return state;
  const worn = [...(wanderer.worn || [])];
  if (worn.includes(itemId)) return state;
  const carried = state.character.inventory.carried.map((c) => ({ ...c }));
  const idx = carried.findIndex((c) => c.itemId === itemId);
  if (idx < 0) return state;
  carried[idx].quantity -= 1;

  const defOf = (id) => codex.items?.[id];
  const toPack = (id) => { const i = carried.findIndex((c) => c.itemId === id); if (i >= 0) carried[i].quantity += 1; else carried.push({ itemId: id, quantity: 1 }); };

  const slot = equipSlot(item);
  // Items that fill a slot displace the slot's current occupant(s) past capacity.
  const displaced = new Set();
  if (slot) {
    const inSlot = worn.filter((id) => equipSlot(defOf(id)) === slot);
    const cap = slotCapacity(slot);
    // Drop the oldest until there's room for the newcomer.
    for (let i = 0; inSlot.length - displaced.size >= cap && i < inSlot.length; i++) displaced.add(inSlot[i]);
  }
  // A two-handed weapon clears the shield (offhand); a shield clears a 2H weapon.
  if (item.kind === "weapon" && weaponHands(item) === 2) {
    for (const id of worn) if (equipSlot(defOf(id)) === "offhand") displaced.add(id);
  } else if (item.kind === "shield") {
    for (const id of worn) { const d = defOf(id); if (d?.kind === "weapon" && weaponHands(d) === 2) displaced.add(id); }
  }
  for (const id of displaced) toPack(id);
  let newWorn = worn.filter((id) => !displaced.has(id));
  newWorn = [...newWorn, itemId];

  // On-equip grants (e.g. a grimoire that awakens magic + teaches spells). Only
  // what's NEWLY granted is recorded on the item as `_granted`, so unequip can
  // revoke exactly that and leave anything obtained by other (regular) means.
  let abilities = state.character.abilities;
  let spells = codex.spells;
  let knows = wanderer.knows;
  let itemEntry = item;
  if (item.grants) {
    const g = item.grants;
    const idOf = (a) => (typeof a === "string" ? a : a.id);
    const addedAbilities = [];
    const addedSpells = [];
    abilities = Array.isArray(abilities) ? [...abilities] : [];
    for (const ga of (g.abilities || [])) {
      if (!abilities.some((a) => idOf(a) === ga.id)) { abilities.push({ id: ga.id, tier: ga.tier || "common" }); addedAbilities.push(ga.id); }
    }
    spells = { ...(codex.spells || {}) };
    for (const sp of (g.spells || [])) {
      if (!spells[sp.id]) { spells[sp.id] = { ...sp }; addedSpells.push(sp.id); }
    }
    let addedKnows = null;
    if (g.magicKnows) {
      const k = wanderer.knows || [];
      if (!k.includes(g.magicKnows)) { knows = [...k, g.magicKnows]; addedKnows = g.magicKnows; }
    }
    itemEntry = { ...item, _granted: { abilities: addedAbilities, spells: addedSpells, knows: addedKnows } };
  }

  return {
    ...state,
    character: { ...state.character, abilities, inventory: { ...state.character.inventory, carried: carried.filter((c) => c.quantity > 0) } },
    world: { ...state.world, codex: { ...codex, items: { ...codex.items, [itemId]: itemEntry }, spells, characters: { ...codex.characters, wanderer: { ...wanderer, worn: newWorn, knows } } } },
  };
}

// Move a worn item back into the pack. Returns a new state. Revokes anything the
// item granted on equip (its `_granted` record) — so taking off a grimoire
// disables the magic it gave, while spells learned by other means persist.
export function unequipItem(state, itemId) {
  const codex = state.world.codex;
  const wanderer = codex.characters?.wanderer;
  if (!wanderer || !(wanderer.worn || []).includes(itemId)) return state;
  const newWorn = (wanderer.worn || []).filter((id) => id !== itemId);
  const carried = state.character.inventory.carried.map((c) => ({ ...c }));
  const idx = carried.findIndex((c) => c.itemId === itemId);
  if (idx >= 0) carried[idx].quantity += 1;
  else carried.push({ itemId, quantity: 1 });

  const item = codex.items?.[itemId];
  const g = item?._granted;
  let abilities = state.character.abilities;
  let spells = codex.spells;
  let knows = wanderer.knows;
  let items = codex.items;
  if (g) {
    const idOf = (a) => (typeof a === "string" ? a : a.id);
    if (g.abilities?.length) abilities = (abilities || []).filter((a) => !g.abilities.includes(idOf(a)));
    if (g.spells?.length) { spells = { ...(codex.spells || {}) }; for (const id of g.spells) delete spells[id]; }
    if (g.knows) knows = (wanderer.knows || []).filter((f) => f !== g.knows);
    const { _granted, ...clean } = item;
    items = { ...codex.items, [itemId]: clean };
  }

  return {
    ...state,
    character: { ...state.character, abilities, inventory: { ...state.character.inventory, carried } },
    world: { ...state.world, codex: { ...codex, items, spells, characters: { ...codex.characters, wanderer: { ...wanderer, worn: newWorn, knows } } } },
  };
}
