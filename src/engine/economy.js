// Coin economy + shop transactions.
//
// The world's coin model (system-prompt COIN ECONOMY): 1sp = 10cp, 1gp = 100cp.
// Copper is the base unit; we do all arithmetic in copper and re-express as
// gold/silver/copper for display and storage. The character's purse stays a
// { copper, silver, gold } object (the shape inventory.js already clamps).

import { getTile } from "./world.js";
import { stampFreshUntil } from "./spoilage.js";
import { itemWeight, loadOf } from "./weight.js";
import { MOUNTS, mountCodexEntry } from "../data/mounts.js";

export const CP_PER_SP = 10;
export const CP_PER_GP = 100;

export function coinsToCopper(coins) {
  if (!coins) return 0;
  return (coins.copper || 0) + (coins.silver || 0) * CP_PER_SP + (coins.gold || 0) * CP_PER_GP;
}

// Greedy re-expression of a copper total into the largest denominations.
export function copperToCoins(n) {
  let c = Math.max(0, Math.floor(n));
  const gold = Math.floor(c / CP_PER_GP); c -= gold * CP_PER_GP;
  const silver = Math.floor(c / CP_PER_SP); c -= silver * CP_PER_SP;
  return { gold, silver, copper: c };
}

export function canAfford(coins, priceCp) {
  return coinsToCopper(coins) >= priceCp;
}

// "1gp 2sp 3cp" — drops empty denominations, but always shows at least 0cp.
export function formatCopper(cp) {
  const { gold, silver, copper } = copperToCoins(cp);
  const parts = [];
  if (gold) parts.push(`${gold}gp`);
  if (silver) parts.push(`${silver}sp`);
  if (copper || parts.length === 0) parts.push(`${copper}cp`);
  return parts.join(" ");
}

export function formatCoins(coins) {
  return formatCopper(coinsToCopper(coins));
}

// Item kinds that a trader will buy back (and that aren't worn equipment).
export const SELLABLE_KINDS = new Set(["remedy", "food", "drink", "material", "supply", "trinket", "tool", "feed"]);

// Used-goods buy-back as a fraction of an item's value. A merchant gives a fair
// (not fleecing) price for second-hand goods. A piece you JUST bought and
// haven't carried out of the shop is refunded in full instead (see App receipts).
export const DEFAULT_RESALE_RATE = 0.65;

export function usedSellPrice(value, rate = DEFAULT_RESALE_RATE) {
  return Math.max(1, Math.round((value || 0) * rate));
}

// Strip any runtime-only fields before an item template is filed into the codex.
function cleanDef(def) {
  const { _granted, ...rest } = def;
  return rest;
}

// Read/refresh the per-tile shop record (which units have been bought this
// restock window). A record from a stale bucket is treated as empty.
function shopFor(tile, bucket) {
  if (tile?.shop && tile.shop.bucket === bucket) {
    return { bucket, sold: { ...tile.shop.sold } };
  }
  return { bucket, sold: {} };
}

// Buy `qty` of an item from the trader at `tileKey`. Deducts coin (making
// change across denominations), files the item template into the codex if it's
// new, drops it in the pack, and records the sale against this restock window
// so the stock depletes. Returns { state, ok, reason }.
export function buyGood(state, { tileKey, bucket, itemDef, priceCp, qty = 1 }) {
  const total = priceCp * qty;
  const inv = state.character.inventory;
  if (!canAfford(inv.coins, total)) return { state, ok: false, reason: "Not enough coin." };

  // Hard weight cap: you can't buy what you can't carry (engine/weight.js).
  const wanderer = state.world.codex.characters?.wanderer;
  const cap = state.character.carryCapacityMax ?? Infinity;
  const projected = loadOf(wanderer, inv, state.world.codex.items) + itemWeight(itemDef) * qty;
  if (projected > cap) return { state, ok: false, reason: "You can't carry that much — too heavy." };

  const coins = copperToCoins(coinsToCopper(inv.coins) - total);
  const carried = inv.carried.map((c) => ({ ...c }));
  const day = state.time?.day || 0;
  const ex = carried.find((c) => c.itemId === itemDef.id);
  if (ex) { ex.quantity += qty; stampFreshUntil(ex, itemDef, day); }
  else { const stack = { itemId: itemDef.id, quantity: qty }; stampFreshUntil(stack, itemDef, day); carried.push(stack); }

  const items = { ...state.world.codex.items };
  if (!items[itemDef.id]) items[itemDef.id] = cleanDef(itemDef);

  const [tx, ty] = tileKey.split(",").map(Number);
  const tiles = { ...state.world.tiles };
  const tile = tiles[tileKey] || getTile(state, tx, ty);
  const shop = shopFor(tile, bucket);
  shop.sold[itemDef.id] = (shop.sold[itemDef.id] || 0) + qty;
  tiles[tileKey] = { ...tile, shop };

  return {
    ok: true,
    state: {
      ...state,
      character: { ...state.character, inventory: { ...inv, coins, carried } },
      world: { ...state.world, tiles, codex: { ...state.world.codex, items } },
    },
  };
}

// Buy a mundane mount from a stable: pay the price, file the full mount as a
// kind:"mount" codex character, and add it to the party (it travels, eats, and
// fights like a companion). Exotic mounts aren't sold — they're earned in play
// (beat.grant_mount). Returns { state, ok, reason }.
export function buyMount(state, { mountId, priceCp }) {
  const tmpl = MOUNTS[mountId];
  if (!tmpl) return { state, ok: false, reason: "No such mount." };
  if ((state.party || []).includes(mountId)) return { state, ok: false, reason: "You already have one." };
  const inv = state.character.inventory;
  const price = priceCp != null ? priceCp : (tmpl.priceCp || 0);
  if (!canAfford(inv.coins, price)) return { state, ok: false, reason: "Not enough coin." };
  const coins = copperToCoins(coinsToCopper(inv.coins) - price);
  const entry = mountCodexEntry(tmpl);
  return {
    ok: true,
    state: {
      ...state,
      party: [...(state.party || []), mountId],
      character: { ...state.character, inventory: { ...inv, coins } },
      world: { ...state.world, codex: { ...state.world.codex, characters: { ...state.world.codex.characters, [mountId]: entry } } },
    },
  };
}

// Sell `qty` of a carried item for `priceCp` each. Returns { state, ok, reason }.
export function sellGood(state, { itemId, priceCp, qty = 1 }) {
  const inv = state.character.inventory;
  const carried = inv.carried.map((c) => ({ ...c }));
  const idx = carried.findIndex((c) => c.itemId === itemId);
  if (idx < 0 || carried[idx].quantity < qty) return { state, ok: false, reason: "You don't have that." };
  carried[idx].quantity -= qty;
  if (carried[idx].quantity <= 0) carried.splice(idx, 1);
  const coins = copperToCoins(coinsToCopper(inv.coins) + priceCp * qty);
  return {
    ok: true,
    state: { ...state, character: { ...state.character, inventory: { ...inv, coins, carried } } },
  };
}
