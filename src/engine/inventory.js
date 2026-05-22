// Applies inventory_changes from the AI: added/removed items and coin deltas.
// Clamps coins at zero; collapses zero-quantity entries.

export function applyInventoryChanges(inv, changes) {
  if (!changes) return inv;
  const next = {
    carried: inv.carried.map(c => ({ ...c })),
    coins: { ...inv.coins },
  };
  for (const add of (changes.added || [])) {
    if (!add?.itemId) continue;
    const existing = next.carried.find(c => c.itemId === add.itemId);
    if (existing) existing.quantity += add.quantity || 1;
    else next.carried.push({ itemId: add.itemId, quantity: add.quantity || 1 });
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

// Kinds that occupy a single slot — equipping one displaces the worn item of
// the same kind back to the pack. Clothing and others stack freely.
const SINGLE_SLOT = { weapon: "weapon", armor: "armor", trinket: "trinket", shield: "armor" };
export const EQUIPPABLE = new Set(["weapon", "armor", "clothing", "trinket", "shield"]);

// Move a carried item onto the wanderer's worn list (codex), displacing the
// current item in that slot back to the pack. Returns a new state.
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

  let newWorn = worn;
  const slot = SINGLE_SLOT[item.kind];
  if (slot) {
    const displaced = worn.find((id) => SINGLE_SLOT[codex.items?.[id]?.kind] === slot);
    if (displaced) {
      newWorn = worn.filter((id) => id !== displaced);
      const dIdx = carried.findIndex((c) => c.itemId === displaced);
      if (dIdx >= 0) carried[dIdx].quantity += 1;
      else carried.push({ itemId: displaced, quantity: 1 });
    }
  }
  newWorn = [...newWorn, itemId];

  return {
    ...state,
    character: { ...state.character, inventory: { ...state.character.inventory, carried: carried.filter((c) => c.quantity > 0) } },
    world: { ...state.world, codex: { ...codex, characters: { ...codex.characters, wanderer: { ...wanderer, worn: newWorn } } } },
  };
}

// Move a worn item back into the pack. Returns a new state.
export function unequipItem(state, itemId) {
  const codex = state.world.codex;
  const wanderer = codex.characters?.wanderer;
  if (!wanderer || !(wanderer.worn || []).includes(itemId)) return state;
  const newWorn = (wanderer.worn || []).filter((id) => id !== itemId);
  const carried = state.character.inventory.carried.map((c) => ({ ...c }));
  const idx = carried.findIndex((c) => c.itemId === itemId);
  if (idx >= 0) carried[idx].quantity += 1;
  else carried.push({ itemId, quantity: 1 });
  return {
    ...state,
    character: { ...state.character, inventory: { ...state.character.inventory, carried } },
    world: { ...state.world, codex: { ...codex, characters: { ...codex.characters, wanderer: { ...wanderer, worn: newWorn } } } },
  };
}
