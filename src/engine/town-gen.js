// Deterministic generation of a trader's stock from its ruleset table.
//
// Stock is rolled from a seed of (tileKey + building + restock-bucket), so a
// shop shows the SAME wares every visit within a restock window, then rolls
// fresh once RESTOCK_DAYS have passed. Generation is pure: the rolled list is
// recomputed on demand and never stored. Only what the player has BOUGHT this
// window is persisted (tile.shop.sold), and the trader view subtracts that to
// show remaining quantity. Mirrors the encounters.js weighted-table approach,
// but seeded for stability instead of fresh per call.

import { RESTOCK_DAYS } from "../data/town.js";
import { itemTemplate } from "../data/catalog.js";

function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32 — small, fast, well-distributed seeded PRNG returning 0..1.
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function bucketForDay(day) {
  return Math.floor((day || 0) / RESTOCK_DAYS);
}

// Seeded PRNG from an arbitrary string — shared by other generators (quests).
export function makeRng(seedStr) {
  return mulberry32(hashStr(seedStr));
}

// Roll the building's current stock for the day. Returns
// { bucket, restockDay, items: [{ itemId, def, qty, price }] }.
export function rollShopStock(building, tileKey, day) {
  const bucket = bucketForDay(day);
  const items = [];
  if (building?.stock?.length) {
    const rng = mulberry32(hashStr(`${tileKey}:${building.id}:${bucket}`));
    for (const entry of building.stock) {
      const chance = entry.chance ?? 1;
      if (rng() > chance) continue;
      const def = itemTemplate(entry.id);
      if (!def) continue;
      const [qmin, qmax] = entry.qty || [1, 1];
      const qty = qmin + Math.floor(rng() * (qmax - qmin + 1));
      if (qty <= 0) continue;
      const variance = 0.9 + rng() * 0.3; // 0.9..1.2 — keeps prices from being uniform
      const price = Math.max(1, Math.round(def.value * (entry.priceMult ?? 1) * variance));
      items.push({ itemId: def.id, def, qty, price });
    }
  }
  return { bucket, restockDay: (bucket + 1) * RESTOCK_DAYS, items };
}

// Roll a stable's mount selection for the current restock window (data/mounts.js
// stableStockFor / poi.mounts override). Mirrors rollShopStock but with a distinct
// `:mounts:` seed so it doesn't correlate with the feed roll at the same tile. The
// signature mount is ALWAYS in stock; the rest appear by their chance and rotate
// across restock windows. Returns [{ id }] — exactly what StableView maps over.
export function rollStableMounts(stockEntry, tileKey, day) {
  if (!stockEntry?.stock?.length) return [];
  const bucket = bucketForDay(day);
  const rng = mulberry32(hashStr(`${tileKey}:mounts:${bucket}`));
  const out = [];
  for (const entry of stockEntry.stock) {
    const chance = entry.chance ?? 1;
    const forced = entry.id === stockEntry.signature || chance >= 1;
    if (!forced && rng() > chance) continue;
    out.push({ id: entry.id });
  }
  return out;
}
