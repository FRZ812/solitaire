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
    // Resale uses the fair default (economy.DEFAULT_RESALE_RATE); a just-bought
    // item is refunded in full while you're still in the shop.
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

  blacksmith: {
    id: "blacksmith",
    kind: "smith",             // a trader counter PLUS a forge
    forge: true,
    label: "Mirecross Smithy",
    keeper: "the smith",
    icon: "smithy",
    blurb: "A banked forge throws orange light up the soot-black walls; a wall of tongs, a barrel of quench-water, the ring of a hammer on cooling iron.",
    // What the smith will buy back: gear and raw stock (not the player's potions).
    buys: ["weapon", "armor", "shield", "clothing", "material"],
    stock: [
      // Raw forge-stock — the materials the player needs to craft.
      { id: "iron-ingot",      chance: 1.0,  qty: [4, 9], priceMult: 1.3 },
      { id: "hardwood-haft",   chance: 1.0,  qty: [3, 6], priceMult: 1.3 },
      { id: "leather-hide",    chance: 1.0,  qty: [2, 5], priceMult: 1.3 },
      { id: "steel-ingot",     chance: 0.7,  qty: [1, 4], priceMult: 1.35 },
      // Finished gear on the rack — buy outright, or forge your own.
      { id: "iron-dagger",     chance: 0.9,  qty: [1, 2], priceMult: 1.25 },
      { id: "iron-shortsword", chance: 0.7,  qty: [1, 1], priceMult: 1.25 },
      { id: "leather-jerkin",  chance: 0.7,  qty: [1, 1], priceMult: 1.25 },
      { id: "iron-helm",       chance: 0.6,  qty: [1, 2], priceMult: 1.25 },
      { id: "round-shield",    chance: 0.6,  qty: [1, 1], priceMult: 1.25 },
    ],
  },

  // ---- The Wet Market: three separate merchants, each its own stall ----
  butcher: {
    id: "butcher", kind: "trader",
    label: "The Butcher's Stall", keeper: "the butcher", icon: "market",
    blurb: "A scarred block, a row of hooks, and the iron smell of the day's slaughter.",
    buys: ["food"],
    stock: [
      { id: "fresh-meat",   chance: 1.0,  qty: [3, 8], priceMult: 1.2 },
      { id: "sausage-links",chance: 0.9,  qty: [2, 6], priceMult: 1.2 },
      { id: "soup-bones",   chance: 1.0,  qty: [4, 10], priceMult: 1.2 },
      { id: "dressed-fowl", chance: 0.8,  qty: [1, 4], priceMult: 1.25 },
      { id: "smoked-ham",   chance: 0.6,  qty: [1, 3], priceMult: 1.3 },
    ],
  },
  fruit: {
    id: "fruit", kind: "trader",
    label: "The Fruit-Peddler's Cart", keeper: "the fruit-peddler", icon: "market",
    blurb: "A handcart heaped with the season's fruit, a wasp or two circling the sweetest of it.",
    buys: ["food"],
    stock: [
      { id: "apples",     chance: 1.0,  qty: [4, 10], priceMult: 1.2 },
      { id: "pears",      chance: 0.9,  qty: [3, 8], priceMult: 1.2 },
      { id: "berries",    chance: 0.8,  qty: [2, 6], priceMult: 1.25 },
      { id: "dried-figs", chance: 0.7,  qty: [2, 5], priceMult: 1.3 },
    ],
  },
  greengrocer: {
    id: "greengrocer", kind: "trader",
    label: "The Greengrocer", keeper: "the greengrocer", icon: "market",
    blurb: "Crates and baskets of root-vegetables and greens, still cool and damp from the morning.",
    buys: ["food"],
    stock: [
      { id: "turnips",     chance: 1.0,  qty: [4, 10], priceMult: 1.2 },
      { id: "onions",      chance: 1.0,  qty: [3, 8], priceMult: 1.2 },
      { id: "carrots",     chance: 0.9,  qty: [3, 8], priceMult: 1.2 },
      { id: "cabbage",     chance: 0.8,  qty: [2, 5], priceMult: 1.2 },
      { id: "dried-beans", chance: 0.7,  qty: [2, 5], priceMult: 1.25 },
    ],
  },
};

export function buildingForService(service) {
  return service ? BUILDINGS[service] || null : null;
}

export function buildingForTile(tile) {
  return buildingForService(tile?.poi?.service);
}
