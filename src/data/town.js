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
    label: "The Drowned Rat",
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
    label: "The Roadside Smithy",
    keeper: "the smith",
    icon: "smithy",
    hours: { open: 7, close: 19 },
    trains: ["mastery-mace"],  // an expert: drills you on the arms they make
    buys: ["weapon", "armor", "shield", "clothing", "material", "tool"],
    blurb: "A banked forge throws orange light up the soot-black walls; a wall of tongs, a barrel of quench-water, the ring of a hammer on cooling iron.",
    stock: [
      // Raw forge-stock — the materials the player needs to craft.
      { id: "iron-ingot",      chance: 1.0,  qty: [4, 9], priceMult: 1.3 },
      { id: "hardwood-haft",   chance: 1.0,  qty: [3, 6], priceMult: 1.3 },
      { id: "leather-hide",    chance: 1.0,  qty: [2, 5], priceMult: 1.3 },
      { id: "steel-ingot",     chance: 0.7,  qty: [1, 4], priceMult: 1.35 },
      { id: "thick-hide",      chance: 0.4,  qty: [1, 2], priceMult: 1.35 },
      { id: "whetstone-grit",  chance: 0.6,  qty: [2, 5], priceMult: 1.3 },
      // Finished melee arms on the rack — buy outright, or forge your own.
      { id: "iron-dagger",     chance: 0.9,  qty: [1, 3], priceMult: 1.25 },
      { id: "steel-dagger",    chance: 0.4,  qty: [1, 1], priceMult: 1.3 },
      { id: "arming-sword",    chance: 0.8,  qty: [1, 2], priceMult: 1.25 },
      { id: "iron-shortsword", chance: 0.7,  qty: [1, 2], priceMult: 1.25 },
      { id: "iron-longsword",  chance: 0.5,  qty: [1, 1], priceMult: 1.25 },
      { id: "steel-longsword", chance: 0.25, qty: [1, 1], priceMult: 1.3 },
      { id: "hand-axe",        chance: 0.8,  qty: [1, 3], priceMult: 1.25 },
      { id: "battle-axe",      chance: 0.5,  qty: [1, 1], priceMult: 1.25 },
      { id: "iron-mace",       chance: 0.6,  qty: [1, 1], priceMult: 1.25 },
      { id: "war-hammer",      chance: 0.4,  qty: [1, 1], priceMult: 1.25 },
      { id: "iron-spear",      chance: 0.8,  qty: [1, 3], priceMult: 1.25 },
      { id: "boar-spear",      chance: 0.5,  qty: [1, 2], priceMult: 1.25 },
      // Crossbows (metalwork) — the smith's ranged line.
      { id: "light-crossbow",  chance: 0.4,  qty: [1, 1], priceMult: 1.3 },
      // Armour & shields.
      { id: "padded-gambeson", chance: 0.7,  qty: [1, 2], priceMult: 1.25 },
      { id: "leather-jerkin",  chance: 0.7,  qty: [1, 2], priceMult: 1.25 },
      { id: "studded-leather", chance: 0.4,  qty: [1, 1], priceMult: 1.3 },
      { id: "chain-shirt",     chance: 0.3,  qty: [1, 1], priceMult: 1.3 },
      { id: "iron-helm",       chance: 0.7,  qty: [1, 2], priceMult: 1.25 },
      { id: "steel-helm",      chance: 0.3,  qty: [1, 1], priceMult: 1.3 },
      { id: "leather-bracers", chance: 0.6,  qty: [1, 2], priceMult: 1.25 },
      { id: "buckler",         chance: 0.6,  qty: [1, 2], priceMult: 1.25 },
      { id: "round-shield",    chance: 0.6,  qty: [1, 2], priceMult: 1.25 },
      { id: "kite-shield",     chance: 0.3,  qty: [1, 1], priceMult: 1.3 },
      // Metal tools the smith hammers out.
      { id: "pitons",          chance: 0.6,  qty: [1, 3], priceMult: 1.25 },
      { id: "crowbar",         chance: 0.6,  qty: [1, 2], priceMult: 1.25 },
      { id: "crampons",        chance: 0.4,  qty: [1, 2], priceMult: 1.25 },
      { id: "manacles",        chance: 0.4,  qty: [1, 2], priceMult: 1.25 },
      { id: "whetstone",       chance: 0.8,  qty: [1, 3], priceMult: 1.25 },
      { id: "repair-kit",      chance: 0.5,  qty: [1, 2], priceMult: 1.25 },
      { id: "grappling-hook",  chance: 0.5,  qty: [1, 2], priceMult: 1.25 },
    ],
  },

  prison: {
    id: "prison",
    kind: "gaol",              // the warden: a wanted board + cells
    label: "Mirecross Gaol",
    keeper: "the warden",
    icon: "gaol",
    hours: { open: 6, close: 22 },
    blurb: "A squat blockhouse of damp stone — a wanted board by the door, a smell of straw and iron, and the warden watching from a stool worn smooth.",
  },

  // The Block: Crowsmoor's auction-yard — the slave market. A grimmer counterpart
  // to the lawful gaol, deliberately kept in a rougher town, not in Mirecross. The
  // auctioneer holds people for sale; buying a bond is a coin deal, the rest is
  // played in the world (free them, press them to service, ransom or resell).
  slavemarket: {
    id: "slavemarket",
    kind: "slavemarket",       // the auctioneer: a roster of captives whose bonds are for sale
    label: "The Block",
    keeper: "the auctioneer",
    icon: "slavemarket",
    hours: { open: 8, close: 17 },
    blurb: "A fenced yard hard against the stockyards — a raised auction-block of weathered oak, a row of the bonded chained to a rail in its shade, and an auctioneer with a tally-stick and a flat, appraising eye.",
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
    buys: ["food", "drink", "tool", "supply", "material"],
    blurb: "Plank stalls under oiled canvas — a butcher's block, baskets of fruit, crates of root-vegetables, a pedlar's bench of rope and tin, sellers crying over one another.",
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
      // Preserved travel rations — the provisioner's keep-anywhere staples.
      { id: "hardtack",     chance: 0.9,  qty: [3, 8], priceMult: 1.25 },
      { id: "jerky",        chance: 0.8,  qty: [2, 5], priceMult: 1.3 },
      { id: "salt-pork",    chance: 0.7,  qty: [1, 4], priceMult: 1.3 },
      { id: "trail-rations",chance: 0.8,  qty: [2, 6], priceMult: 1.25 },
      // Drinks.
      { id: "ale",          chance: 0.9,  qty: [3, 8], priceMult: 1.2 },
      { id: "wine",         chance: 0.7,  qty: [2, 5], priceMult: 1.25 },
      { id: "spirits",      chance: 0.4,  qty: [1, 3], priceMult: 1.3 },
      // The pedlar's bench — general adventuring tools.
      { id: "rope-hemp",          chance: 0.9,  qty: [2, 5], priceMult: 1.2 },
      { id: "torch",              chance: 1.0,  qty: [3, 9], priceMult: 1.2 },
      { id: "lantern",            chance: 0.5,  qty: [1, 2], priceMult: 1.25 },
      { id: "lamp-oil",           chance: 0.8,  qty: [2, 6], priceMult: 1.2 },
      { id: "tinderbox",          chance: 0.8,  qty: [1, 4], priceMult: 1.2 },
      { id: "bedroll",            chance: 0.8,  qty: [1, 4], priceMult: 1.2 },
      { id: "waterskin",          chance: 0.9,  qty: [2, 5], priceMult: 1.2 },
      { id: "cook-pot",           chance: 0.5,  qty: [1, 2], priceMult: 1.25 },
      { id: "fishing-kit",        chance: 0.6,  qty: [1, 3], priceMult: 1.2 },
      { id: "snare-wire",         chance: 0.5,  qty: [1, 3], priceMult: 1.2 },
      { id: "shovel",             chance: 0.5,  qty: [1, 2], priceMult: 1.2 },
      { id: "chalk-and-charcoal", chance: 0.6,  qty: [1, 4], priceMult: 1.2 },
      { id: "traveling-cloak",    chance: 0.6,  qty: [1, 3], priceMult: 1.25 },
      { id: "lockpicks",          chance: 0.3,  qty: [1, 1], priceMult: 1.35 },
      // The wood-line — a fletcher's stall keeps bows.
      { id: "hunting-bow",        chance: 0.5,  qty: [1, 2], priceMult: 1.25 },
      { id: "short-bow",          chance: 0.5,  qty: [1, 2], priceMult: 1.25 },
    ],
  },

  // The Stable: sells MUNDANE mounts and the feed to keep them. A bought mount
  // joins the party as a kind:"mount" character (haggled via beat.buy_mount), not a
  // pack item. The mount SELECTION is region-gated — resolved per tile from
  // STABLE_STOCK_BY_BIOME / stableStockFor (data/mounts.js) or a poi.mounts
  // override, then seed-rolled by rollStableMounts (engine/town-gen.js) and passed
  // to StableView by App. Only the feed `stock` below is rolled here.
  stable: {
    id: "stable",
    kind: "stable",
    label: "The Stable",
    keeper: "the stabler",
    icon: "bldg",
    hours: { open: 6, close: 20 },
    buys: ["feed", "tool"],
    blurb: "Stalls of warm straw and the steady sound of feeding; tack on pegs, a stabler with hay in his sleeves, and the smell of horse and leather.",
    stock: [
      { id: "fodder",   chance: 1.0, qty: [4, 10], priceMult: 1.15 },
      { id: "raw-meat", chance: 0.5, qty: [1, 3],  priceMult: 1.2 },
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
