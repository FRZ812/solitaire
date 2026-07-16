// Applies inventory_changes from the AI: added/removed items and coin deltas.
// Clamps coins at zero; collapses zero-quantity entries. `day` (the current
// campaign day) stamps freshUntil on any perishable food added, so narrator-
// granted food (foraging, gifts, loot) spoils like bought food.

import { goodDef } from "../data/goods.js";
import { itemTemplate } from "../data/catalog.js";
import { stampFreshUntil } from "./spoilage.js";
import { equipSlot, slotCapacity, weaponHands } from "./combat-stats.js";
import { itemWeight, loadOf } from "./weight.js";

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

// Resolve the two inventory shapes used by the save model. The wanderer's pack
// lives on state.character; companions and mounts keep theirs on their codex
// entry. Only current party members are valid hand-off targets.
function inventoryOwner(state, charId) {
  const codex = state.world?.codex;
  const character = codex?.characters?.[charId];
  if (!character) return null;
  if (charId === "wanderer") {
    if (!state.character?.inventory) return null;
    return {
      id: charId,
      character,
      inventory: state.character.inventory,
      capacity: state.character.carryCapacityMax ?? Infinity,
      isPlayer: true,
    };
  }
  if (!(state.party || []).includes(charId) || !character.inventory) return null;
  return {
    id: charId,
    character,
    inventory: character.inventory,
    capacity: character.carryCapacityMax ?? Infinity,
    isPlayer: false,
  };
}

function replaceOwnerInventory(state, owner, inventory, overburdened) {
  if (owner.isPlayer) {
    return {
      ...state,
      character: { ...state.character, inventory, overburdened },
    };
  }
  const codex = state.world.codex;
  const current = codex.characters[owner.id];
  return {
    ...state,
    world: {
      ...state.world,
      codex: {
        ...codex,
        characters: {
          ...codex.characters,
          [owner.id]: { ...current, inventory, overburdened },
        },
      },
    },
  };
}

function earliestFreshUntil(a, b) {
  if (a == null) return b;
  if (b == null) return a;
  return Math.min(a, b);
}

// Move a stack (or part of one) between the wanderer and any current party
// member. The engine repeats the UI's carry-capacity check so stale dialogs or
// direct callers cannot overfill a destination. Stack metadata such as
// freshUntil travels with the item; when two perishable stacks merge, the
// earliest expiry wins so a hand-off can never make food fresher.
export function transferItem(state, fromCharId, toCharId, itemId, quantity = 1) {
  if (!itemId || fromCharId === toCharId) return { ok: false, state, reason: "Choose another character." };
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty <= 0) return { ok: false, state, reason: "Choose a valid quantity." };

  const source = inventoryOwner(state, fromCharId);
  const destination = inventoryOwner(state, toCharId);
  if (!source || !destination) return { ok: false, state, reason: "That character cannot receive items." };

  const sourceStack = (source.inventory.carried || []).find((entry) => entry.itemId === itemId);
  if (!sourceStack || (sourceStack.quantity || 0) < qty) {
    return { ok: false, state, reason: "There are not enough items in that pack." };
  }

  const codexItems = state.world.codex.items;
  const item = codexItems?.[itemId] || itemTemplate(itemId);
  const transferWeight = itemWeight(item) * qty;
  const destinationLoad = loadOf(destination.character, destination.inventory, codexItems);
  if (destinationLoad + transferWeight > destination.capacity) {
    return { ok: false, state, reason: "That character cannot carry the transfer." };
  }

  const sourceCarried = (source.inventory.carried || []).map((entry) => ({ ...entry }));
  const sourceIndex = sourceCarried.findIndex((entry) => entry.itemId === itemId);
  sourceCarried[sourceIndex].quantity -= qty;
  if (sourceCarried[sourceIndex].quantity <= 0) sourceCarried.splice(sourceIndex, 1);

  const destinationCarried = (destination.inventory.carried || []).map((entry) => ({ ...entry }));
  const destinationIndex = destinationCarried.findIndex((entry) => entry.itemId === itemId);
  if (destinationIndex >= 0) {
    const targetStack = destinationCarried[destinationIndex];
    targetStack.quantity += qty;
    const freshUntil = earliestFreshUntil(targetStack.freshUntil, sourceStack.freshUntil);
    if (freshUntil != null) targetStack.freshUntil = freshUntil;
  } else {
    destinationCarried.push({ ...sourceStack, quantity: qty });
  }

  const sourceInventory = { ...source.inventory, carried: sourceCarried };
  const destinationInventory = { ...destination.inventory, carried: destinationCarried };
  const sourceOverburdened = loadOf(source.character, sourceInventory, codexItems) > source.capacity;
  const destinationOverburdened = loadOf(destination.character, destinationInventory, codexItems) > destination.capacity;

  let next = replaceOwnerInventory(state, source, sourceInventory, sourceOverburdened);
  next = replaceOwnerInventory(next, destination, destinationInventory, destinationOverburdened);
  return { ok: true, state: next };
}

function equipPartyItem(state, charId, itemId) {
  const owner = inventoryOwner(state, charId);
  if (!owner || owner.isPlayer || owner.character.kind === "mount") return state;
  const codex = state.world.codex;
  const item = codex.items?.[itemId] || itemTemplate(itemId);
  if (!item || !EQUIPPABLE.has(item.kind)) return state;
  const worn = [...(owner.character.worn || [])];
  if (worn.includes(itemId)) return state;
  const carried = (owner.inventory.carried || []).map((entry) => ({ ...entry }));
  const carriedIndex = carried.findIndex((entry) => entry.itemId === itemId);
  if (carriedIndex < 0) return state;
  carried[carriedIndex].quantity -= 1;

  const defOf = (id) => codex.items?.[id] || itemTemplate(id);
  const toPack = (id) => {
    const index = carried.findIndex((entry) => entry.itemId === id);
    if (index >= 0) carried[index].quantity += 1;
    else carried.push({ itemId: id, quantity: 1 });
  };
  const slot = equipSlot(item);
  const displaced = new Set();
  if (slot) {
    const inSlot = worn.filter((id) => equipSlot(defOf(id)) === slot);
    const capacity = slotCapacity(slot);
    for (let i = 0; inSlot.length - displaced.size >= capacity && i < inSlot.length; i++) displaced.add(inSlot[i]);
  }
  if (item.kind === "weapon" && weaponHands(item) === 2) {
    for (const id of worn) if (equipSlot(defOf(id)) === "offhand") displaced.add(id);
  } else if (item.kind === "shield") {
    for (const id of worn) {
      const definition = defOf(id);
      if (definition?.kind === "weapon" && weaponHands(definition) === 2) displaced.add(id);
    }
  }
  for (const id of displaced) toPack(id);
  const nextWorn = [...worn.filter((id) => !displaced.has(id)), itemId];
  const inventory = { ...owner.inventory, carried: carried.filter((entry) => entry.quantity > 0) };
  const character = { ...owner.character, worn: nextWorn };
  const overburdened = loadOf(character, inventory, codex.items) > owner.capacity;
  const withInventory = replaceOwnerInventory(state, owner, inventory, overburdened);
  return {
    ...withInventory,
    world: {
      ...withInventory.world,
      codex: {
        ...withInventory.world.codex,
        characters: {
          ...withInventory.world.codex.characters,
          [charId]: { ...withInventory.world.codex.characters[charId], worn: nextWorn },
        },
      },
    },
  };
}

function unequipPartyItem(state, charId, itemId) {
  const owner = inventoryOwner(state, charId);
  if (!owner || owner.isPlayer || owner.character.kind === "mount") return state;
  const worn = owner.character.worn || [];
  if (!worn.includes(itemId)) return state;
  const carried = (owner.inventory.carried || []).map((entry) => ({ ...entry }));
  const carriedIndex = carried.findIndex((entry) => entry.itemId === itemId);
  if (carriedIndex >= 0) carried[carriedIndex].quantity += 1;
  else carried.push({ itemId, quantity: 1 });
  const nextWorn = worn.filter((id) => id !== itemId);
  const inventory = { ...owner.inventory, carried };
  const character = { ...owner.character, worn: nextWorn };
  const overburdened = loadOf(character, inventory, state.world.codex.items) > owner.capacity;
  const withInventory = replaceOwnerInventory(state, owner, inventory, overburdened);
  return {
    ...withInventory,
    world: {
      ...withInventory.world,
      codex: {
        ...withInventory.world.codex,
        characters: {
          ...withInventory.world.codex.characters,
          [charId]: { ...withInventory.world.codex.characters[charId], worn: nextWorn },
        },
      },
    },
  };
}

// Move a carried item onto the wanderer's worn list (codex), enforcing equipment
// SLOTS so combat effects can't be stacked: one item per slot (two rings), a
// two-handed weapon and a shield are mutually exclusive (a 2H weapon needs both
// hands). Equipping into a full slot displaces the current occupant to the pack.
export function equipItem(state, itemId, charId = "wanderer") {
  if (charId !== "wanderer") return equipPartyItem(state, charId, itemId);
  const codex = state.world.codex;
  const item = codex.items?.[itemId] || itemTemplate(itemId);
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
export function unequipItem(state, itemId, charId = "wanderer") {
  if (charId !== "wanderer") return unequipPartyItem(state, charId, itemId);
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
