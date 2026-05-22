// Town building registry — the "ruleset" half of the town system.
//
// A building is wired to a tile by giving that tile's poi a `service` id
// (see handcrafted-tiles.js, e.g. The Healer's House carries service:"healer").
// BUILDINGS[service] then describes what kind of place it is, how it renders on
// the map, its open hours, and — for traders — the weighted stock table its
// inventory is rolled from (engine/town-gen.js). Services are opt-in per tile,
// so not every smithy or inn in the world silently becomes a shop.
//
// `trains` marks an EXPERT trader: a list of proficiency ids it will drill for a
// fee + time (engine/training.js), so the player can fast-track a grindy skill.
// Only experts (healer, smith) carry it — the wet-market sellers do not.

export const RESTOCK_DAYS = 4; // a trader's stock refreshes every 4 game-days
export const TRAIN_CAP = 5;    // how far an expert can take a proficiency

export const BUILDINGS = {
  tavern: {
    id: "tavern",
    kind: "tavern",            // a quest board: tasks, folk for hire, day-labour
    label: "The Drowned Inn",
    keeper: "the innkeeper",
    icon: "bldg",
    hours: { open: 6, close: 1 }, // wraps past midnight — last call at 1am
    blurb: "The common room hums — low talk, a peat fire, and a board by the door thick with curling notices held on by knives and nails.",
  },

  healer: {
    id: "healer",
    kind: "trader",            // a standard buy/sell trader menu
    label: "The Healer's House",
    keeper: "the healer",      // used to flavor the "speak with…" narrator hook
    icon: "healer",            // MapView MAP_ASSETS key
    hours: { open: 7, close: 20 },
    trains: ["endurance"],     // an expert: drills resilience / field-hardiness
    blurb: "Bundles of drying herbs hang from the rafters; the air is thick with comfrey, tallow, and woodsmoke.",
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
    hours: { open: 7, close: 19 },
    trains: ["mastery-mace"],  // an expert: drills you on the arms they make
    buys: ["weapon", "armor", "shield", "clothing", "material"],
    blurb: "A banked forge throws orange light up the soot-black walls; a wall of tongs, a barrel of quench-water, the ring of a hammer on cooling iron.",
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

  // The Wet Market: a single open-air stall, not a building — the butcher,
  // fruit-peddler, and greengrocer all cry their wares from the same square.
  // A plain seller (no training).
  market: {
    id: "market",
    kind: "trader",
    label: "The Wet Market",
    keeper: "the market-sellers",
    icon: "market",
    hours: { open: 6, close: 18 },
    buys: ["food"],
    blurb: "Plank stalls under oiled canvas — a butcher's block, baskets of fruit, crates of root-vegetables, three sellers crying over one another.",
    stock: [
      { id: "fresh-meat",   chance: 1.0,  qty: [2, 6], priceMult: 1.2 },
      { id: "sausage-links",chance: 0.9,  qty: [2, 5], priceMult: 1.2 },
      { id: "soup-bones",   chance: 1.0,  qty: [3, 8], priceMult: 1.2 },
      { id: "dressed-fowl", chance: 0.7,  qty: [1, 3], priceMult: 1.25 },
      { id: "smoked-ham",   chance: 0.5,  qty: [1, 2], priceMult: 1.3 },
      { id: "apples",       chance: 1.0,  qty: [3, 8], priceMult: 1.2 },
      { id: "pears",        chance: 0.8,  qty: [2, 6], priceMult: 1.2 },
      { id: "berries",      chance: 0.7,  qty: [2, 5], priceMult: 1.25 },
      { id: "dried-figs",   chance: 0.6,  qty: [2, 4], priceMult: 1.3 },
      { id: "turnips",      chance: 1.0,  qty: [4, 9], priceMult: 1.2 },
      { id: "onions",       chance: 1.0,  qty: [3, 8], priceMult: 1.2 },
      { id: "carrots",      chance: 0.9,  qty: [3, 8], priceMult: 1.2 },
      { id: "cabbage",      chance: 0.7,  qty: [2, 5], priceMult: 1.2 },
      { id: "dried-beans",  chance: 0.6,  qty: [2, 5], priceMult: 1.25 },
    ],
  },
};

const DEFAULT_HOURS_BY_KIND = {
  trader: { open: 7, close: 19 },
  smith: { open: 7, close: 19 },
  tavern: { open: 6, close: 1 },
};

export function buildingHours(building) {
  return building?.hours || DEFAULT_HOURS_BY_KIND[building?.kind] || { open: 7, close: 19 };
}

// Open if the hour falls in [open, close). A close <= open wraps past midnight
// (e.g. a tavern open 6:00 to 01:00).
export function isBuildingOpen(building, hour) {
  const { open, close } = buildingHours(building);
  return close > open ? (hour >= open && hour < close) : (hour >= open || hour < close);
}

export function buildingForService(service) {
  return service ? BUILDINGS[service] || null : null;
}

export function buildingForTile(tile) {
  return buildingForService(tile?.poi?.service);
}
