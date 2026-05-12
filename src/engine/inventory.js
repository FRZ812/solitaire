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
