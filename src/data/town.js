// Town building registry — the "ruleset" half of the town system.
//
// A building is wired to a tile by giving that tile's poi a `service` id
// (see handcrafted-tiles.js, e.g. The Healer's House carries service:"healer").
// BUILDINGS[service] then describes what kind of place it is, how it renders on
// the map, and — for traders — the weighted stock table its inventory is rolled
// from (engine/town-gen.js). This keeps services opt-in per tile, so not every
// smithy or inn in the world silently becomes a shop.

export const RESTOCK_DAYS = 4; // a trader's stock refreshes every 4 game-days

export const BUILDINGS = {
  healer: {
    id: "healer",
    kind: "trader",            // a standard buy/sell trader menu
    label: "The Healer's House",
    keeper: "the healer",      // used to flavor the "speak with…" narrator hook
    icon: "healer",            // MapView MAP_ASSETS key
    blurb: "Bundles of drying herbs hang from the rafters; the air is thick with comfrey, tallow, and woodsmoke.",
    sellRate: 0.4,             // buy-back at 40% of an item's value
    // Weighted stock: `chance` it appears this restock, `qty` range [min,max],
    // `priceMult` against the good's base value (goods.js).
    stock: [
      { id: "healing-salve",   chance: 1.0, qty: [2, 5], priceMult: 1.2 },
      { id: "blood-staunch",   chance: 1.0, qty: [2, 4], priceMult: 1.2 },
      { id: "willow-bark",     chance: 1.0, qty: [3, 6], priceMult: 1.2 },
      { id: "poultice",        chance: 0.85, qty: [2, 4], priceMult: 1.2 },
      { id: "splint",          chance: 0.8, qty: [1, 3], priceMult: 1.2 },
      { id: "fever-tonic",     chance: 0.7, qty: [1, 3], priceMult: 1.25 },
      { id: "antivenom",       chance: 0.6, qty: [1, 2], priceMult: 1.3 },
      { id: "healing-draught", chance: 0.5, qty: [1, 2], priceMult: 1.3 },
    ],
  },
};

export function buildingForService(service) {
  return service ? BUILDINGS[service] || null : null;
}

export function buildingForTile(tile) {
  return buildingForService(tile?.poi?.service);
}
