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
    label: "The Iron Tankard",
    keeper: "the innkeeper",
    icon: "bldg",
    hours: { open: 6, close: 1 }, // wraps past midnight — last call at 1am
    blurb: "The common room hums — low talk, a peat fire, and a board by the door thick with curling notices held on by knives and nails.",
  },

  healer: {
    id: "healer",
    kind: "trader",            // a standard buy/sell trader menu
    label: "The Hospital Cloister",
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
    label: "Public Smith Row",
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

  // Renamed from `prison` to `gaol` so the BUILDINGS key matches the
  // `service: "gaol"` field on the Prison Gate Intake Desk tile at (-3,7).
  // The engine's [INSPECT RIGHTS] flow (App.jsx, engine/beat.js
  // purchase_rights) gates on building.kind === "gaol", which this entry
  // already declared; the orphaned key meant the lookup never hit this
  // row. SAT-2 validation caught the dangling reference.
  gaol: {
    id: "gaol",
    kind: "gaol",              // the warden: a wanted board + cells
    label: "Prison Gate",
    keeper: "the gaoler",
    icon: "gaol",
    hours: { open: 6, close: 22 },
    blurb: "A threshold of old stone scarred by nails — an intake desk under a lantern that burns all day, a wanted-board by the door, the smell of straw and iron, and a work-gang's side-arch barred until dawn.",
  },

  // Chain Market Steps: Whitemarch's public slave-sale, in the Chain Ward at the
  // heart of the city — the trade as civic routine. The platform opens at dawn
  // with the lot-bell and shuts at dusk; high-tier lots rotate daily, lower
  // lots linger across days (see engine/slaves.js). Buying a bond is a coin
  // deal; the custody scene (keep / ransom / sell on / force-release) is the
  // narrator's, governed by THE BLOCK in src/system-prompt.js.
  slavemarket: {
    id: "slavemarket",
    kind: "slavemarket",       // the Chain Factor: a roster of captives whose bonds are for sale
    label: "Chain Market Steps",
    keeper: "the Chain Factor",
    icon: "slavemarket",
    hours: { open: 7, close: 19 },
    blurb: "Pale stone steps washed between bells so the stains do not show — a raised platform where status-criers call the lots, buyers waiting under awnings, the bonded chained at a viewing-rail, and a Chain Factor with a tally-stick and a flat, appraising eye.",
  },

  // The Wet Market: a single open-air stall, not a building — the butcher,
  // fruit-peddler, and greengrocer all cry their wares from the same square.
  // A plain seller (no training).
  market: {
    id: "market",
    kind: "trader",
    label: "The Grand Market",
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
    label: "Caravan Yard & Stable",
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

  // ===========================================================================
  // Whitemarch satellites + Ring-1 complement (Wave 3 S1)
  //
  // 18 service entries the four Wave-SAT-1 district modules reference:
  //   - Ring-1 complement (in-city street stalls): apothecary, chandler,
  //     fishmonger, general-store, leather-worker.
  //   - Outer Works (north satellite): courier, oath-priest, wall-sergeant.
  //   - Caravanserai (west satellite): caravanserai-warden, dock-customs-
  //     officer, embassy-interpreter, money-changer, farrier.
  //     (dock-customs-officer and embassy-interpreter are authored once here
  //     and reused by both the Caravanserai surfaces and the originally-
  //     planned in-city High Quay / Embassy Lane wirings — same id, same
  //     entry serves both.)
  //   - Noble Rise (west inner ward): chapel-priest, house-steward,
  //     marriage-clerk, noble-gate-guard, patron-salon.
  //
  // Alphabetised by key. Trade counters carry `kind:"trader"`, modest
  // `buys`/`stock`, and trader hours; keeper-only/permit/shrine surfaces
  // carry their own `kind` ("clerk", "gate", "shrine", "salon", "steward",
  // "warden") and no stock.
  // ===========================================================================

  apothecary: {
    id: "apothecary",
    kind: "trader",
    label: "Apothecary's Window",
    keeper: "the apothecary",
    icon: "healer",
    hours: { open: 7, close: 19 },
    buys: ["supply", "material"],
    blurb: "A hinged shutter onto the lane — jars of rue, valerian, comfrey, wormwood on a careful shelf; a locked drawer below labelled in no hand at all; a brass scale on a thong at her wrist.",
    stock: [
      { id: "willow-bark",   chance: 1.0, qty: [3, 6], priceMult: 1.25 },
      { id: "healing-salve", chance: 0.9, qty: [1, 3], priceMult: 1.3 },
      { id: "poultice",      chance: 0.8, qty: [1, 3], priceMult: 1.25 },
      { id: "fever-tonic",   chance: 0.7, qty: [1, 2], priceMult: 1.3 },
      { id: "blood-staunch", chance: 0.7, qty: [1, 3], priceMult: 1.3 },
      { id: "antivenom",     chance: 0.5, qty: [1, 2], priceMult: 1.35 },
    ],
  },

  "caravanserai-warden": {
    id: "caravanserai-warden",
    kind: "warden",
    label: "Caravan Master's House",
    keeper: "the caravan-warden",
    icon: "bldg",
    hours: { open: 6, close: 20 },
    blurb: "A square stone house against the west wall — a map-table, a strongbox under the desk, a back room where caravan-masters take tea while she works through their toll. She does not see drovers, only the masters and the city's customs men.",
  },

  chandler: {
    id: "chandler",
    kind: "trader",
    label: "Chandler's Stall",
    keeper: "the chandler",
    icon: "bldg",
    hours: { open: 6, close: 19 },
    buys: ["supply", "material"],
    blurb: "A timber stall on the customs corridor — dipped tallow tapers on twine, beeswax pillars under a separate awning, coils of cotton wick on pegs, a small lamp burning all day to show the brightness of the oil.",
    stock: [
      { id: "torch",     chance: 1.0, qty: [4, 10], priceMult: 1.2 },
      { id: "lamp-oil",  chance: 1.0, qty: [3, 8],  priceMult: 1.2 },
      { id: "lantern",   chance: 0.7, qty: [1, 3],  priceMult: 1.25 },
      { id: "tinderbox", chance: 0.8, qty: [1, 4],  priceMult: 1.2 },
    ],
  },

  "chapel-priest": {
    id: "chapel-priest",
    kind: "shrine",
    label: "Private Chapel",
    keeper: "the chapel priest",
    icon: "bldg",
    hours: { open: 6, close: 21 },
    blurb: "A small barrel-vaulted chapel in the south wing — six wooden pews carved with the Drelan wreath, a pale stone altar, a single rose-window of plain leaded glass. The resident priest hears marriages, baptisms, and the quiet funerals that have no public mourners.",
  },

  courier: {
    id: "courier",
    kind: "clerk",
    label: "Couriers' Post",
    keeper: "the dispatcher",
    icon: "bldg",
    hours: { open: 5, close: 22 },
    blurb: "A small slate-roofed room hard against the inner wall — a sorted wall of cubby-holes for sealed dispatches, a bench where road-couriers sleep in their boots between runs. She takes a letter for any waypoint between here and the next bridge fort, for a fee, with a counter-seal, only if the destination is on her route-list.",
  },

  "dock-customs-officer": {
    id: "dock-customs-officer",
    kind: "clerk",
    label: "Customs Back-Office",
    keeper: "the customs officer",
    icon: "bldg",
    hours: { open: 6, close: 20 },
    blurb: "A stone-floored office of the city's customs staff — manifests stamped, lead seals crimped onto crates, a brass-bound ledger fattening on every wagon-load. Two officers in city livery sit behind a long counter with a scale, a pot of ink, and the patience of men who know every smuggler's first try.",
  },

  "embassy-interpreter": {
    id: "embassy-interpreter",
    kind: "clerk",
    label: "Interpreters' Bench",
    keeper: "the interpreter on duty",
    icon: "bldg",
    hours: { open: 7, close: 19 },
    blurb: "An awning-bench where the interpreters sit and trade work — each with a slate listing the tongues they will swear to: eastern steppe-cant, southern beast-folk pidgin, the three western dialects, a half-dozen merchant creoles. Flat fee, same rates posted on Embassy Lane in the city.",
  },

  farrier: {
    id: "farrier",
    kind: "trader",
    label: "Smith's Lean-To",
    keeper: "the farrier",
    icon: "smithy",
    hours: { open: 6, close: 19 },
    buys: ["feed", "tool", "material"],
    blurb: "A lean-to forge against the west yard-wall, blue with the smoke of burning hoof and loud with the ring of the shoeing-hammer — a wheel-jack and a tongue-and-groove bench, a beast cross-tied with one hind hoof up in his lap. Wagon-repair and shoeing both.",
    stock: [
      { id: "iron-ingot",     chance: 0.9, qty: [2, 5], priceMult: 1.3 },
      { id: "hardwood-haft",  chance: 0.8, qty: [2, 4], priceMult: 1.25 },
      { id: "whetstone",      chance: 0.7, qty: [1, 3], priceMult: 1.25 },
      { id: "repair-kit",     chance: 0.6, qty: [1, 2], priceMult: 1.3 },
      { id: "leather-bracers",chance: 0.4, qty: [1, 1], priceMult: 1.3 },
    ],
  },

  fishmonger: {
    id: "fishmonger",
    kind: "trader",
    label: "Fishmonger's Bench",
    keeper: "the fishmonger",
    icon: "market",
    hours: { open: 5, close: 16 },
    buys: ["food"],
    blurb: "A long slate bench under a canvas slope, sluiced down with quay-water every bell so the blood does not crust — today's catch laid in fern, river-trout, eel cut in lengths, a half-bushel of small silver fish. A wood-mallet within reach for the eels, a tin cup for change, cats waiting at a polite distance.",
    stock: [
      { id: "fresh-meat",   chance: 1.0, qty: [2, 6], priceMult: 1.2 },
      { id: "soup-bones",   chance: 0.7, qty: [2, 5], priceMult: 1.2 },
      { id: "smoked-ham",   chance: 0.3, qty: [1, 2], priceMult: 1.3 },
    ],
  },

  "general-store": {
    id: "general-store",
    kind: "trader",
    label: "Dry-Goods Counter",
    keeper: "the dry-goods keeper",
    icon: "market",
    hours: { open: 6, close: 20 },
    buys: ["supply", "food", "tool", "material"],
    blurb: "A narrow shop wedged into a block-corner — sacks of flour, beans, lentils, salt mouth-open on the floor under chalked prices; the upper shelves with jars of pickle, twine on spools, fire-lighters, soap-bars, paper screws of tea. A brass bell over the door, a slate by the till tracking who is owed credit and who is owing.",
    stock: [
      { id: "hardtack",           chance: 1.0, qty: [3, 8], priceMult: 1.2 },
      { id: "trail-rations",      chance: 0.9, qty: [2, 6], priceMult: 1.25 },
      { id: "rope-hemp",          chance: 0.9, qty: [2, 5], priceMult: 1.2 },
      { id: "torch",              chance: 0.9, qty: [3, 8], priceMult: 1.2 },
      { id: "lamp-oil",           chance: 0.8, qty: [2, 6], priceMult: 1.2 },
      { id: "tinderbox",          chance: 0.8, qty: [1, 4], priceMult: 1.2 },
      { id: "waterskin",          chance: 0.8, qty: [2, 5], priceMult: 1.2 },
      { id: "bedroll",            chance: 0.7, qty: [1, 3], priceMult: 1.2 },
      { id: "chalk-and-charcoal", chance: 0.6, qty: [1, 4], priceMult: 1.2 },
      { id: "cook-pot",           chance: 0.4, qty: [1, 2], priceMult: 1.25 },
    ],
  },

  "house-steward": {
    id: "house-steward",
    kind: "steward",
    label: "Servants' Lane",
    keeper: "the house steward",
    icon: "bldg",
    hours: { open: 5, close: 23 },
    blurb: "A flagged service lane along the inside of the west wall, just wide enough for two yoked porters to pass — coal-sacks, ice-baskets, laundry-bundles, quiet errands. The steward sits on a stool at the lane-mouth with a slate, marking who came in and what they carried, and which of them left again.",
  },

  "leather-worker": {
    id: "leather-worker",
    kind: "trader",
    label: "Leatherworker's Shop",
    keeper: "the leatherworker",
    icon: "bldg",
    hours: { open: 7, close: 19 },
    buys: ["material", "armor", "clothing"],
    blurb: "A low-beamed shop smelling of oak-bark tan and neat's-foot oil — belts, satchels, harness-strap, and rolled hide on the front-room wall, an awl-board behind the counter with two dozen tools by their handles. A guild-tag in beaten copper hangs over the till.",
    stock: [
      { id: "leather-hide",    chance: 1.0, qty: [2, 5], priceMult: 1.25 },
      { id: "thick-hide",      chance: 0.5, qty: [1, 2], priceMult: 1.3 },
      { id: "leather-jerkin",  chance: 0.8, qty: [1, 2], priceMult: 1.25 },
      { id: "leather-bracers", chance: 0.8, qty: [1, 3], priceMult: 1.25 },
      { id: "studded-leather", chance: 0.4, qty: [1, 1], priceMult: 1.3 },
      { id: "traveling-cloak", chance: 0.6, qty: [1, 2], priceMult: 1.25 },
    ],
  },

  "marriage-clerk": {
    id: "marriage-clerk",
    kind: "clerk",
    label: "Marriage Hall",
    keeper: "the marriage clerk",
    icon: "bldg",
    hours: { open: 8, close: 17 },
    blurb: "A square room panelled in lighter wood — a long table down the centre for the two families, a sloped desk by the window for the clerk. A sworn officer of the city's marriage registry, retained on annual stipend; banns, dowry-receipts, marriage articles, the appended pages of an heir's settlement, all sealed in russet wax with the Drelan hound.",
  },

  "money-changer": {
    id: "money-changer",
    kind: "trader",
    label: "Money-Changer's Counter",
    keeper: "the money-changer",
    icon: "bldg",
    hours: { open: 6, close: 20 },
    buys: ["material"],
    blurb: "A narrow shop with a brass-grilled counter — a balance-scale, a touchstone in a felt-lined box, a rack of clipping-shears for testing foreign coin. He sits half a step above the floor and reads each coin by weight and acid before he names a rate.",
    stock: [
      { id: "iron-ingot",  chance: 0.5, qty: [1, 3], priceMult: 1.4 },
      { id: "steel-ingot", chance: 0.3, qty: [1, 2], priceMult: 1.4 },
    ],
  },

  "noble-gate-guard": {
    id: "noble-gate-guard",
    kind: "gate",
    label: "Noble Gate",
    keeper: "the gate clerk",
    icon: "bldg",
    hours: { open: 6, close: 22 },
    blurb: "A double-leaf iron gate hung between two pillars of pale ashlar set in the city's inner ring wall, the bars wrought into the linked-hounds device of House Drelan — the only public way into Noble Rise. Two house-guards in iron-and-russet livery stand under the arch with halberds at rest; a clerk on a stool keeps the day's ledger of expected callers, names crossed off in pencil, and sends tradesmen round to the service lane.",
  },

  "oath-priest": {
    id: "oath-priest",
    kind: "shrine",
    label: "Wall-Watch Chapel",
    keeper: "the oath-priest",
    icon: "bldg",
    hours: { open: 5, close: 22 },
    blurb: "A narrow stone chapel built into the inner skin of the wall — two oath-stones, a saint of soldiers' deaths, a board nailed with the names of the patrols that did not come back. The oath-priest hears watch-oaths at the change of every shift; a private oath from a stranger costs a fee the chapel will not write down.",
  },

  "patron-salon": {
    id: "patron-salon",
    kind: "salon",
    label: "Patron's Salon",
    keeper: "the Drelan Patroness",
    icon: "bldg",
    hours: { open: 10, close: 18 },
    blurb: "A long room panelled in dark wood, lit by tall windows over the clipped east lawn — chairs in pairs, never in rows, a silver tea-service on a side-table, a lutenist by the window playing something old enough no one need listen. The Patroness receives in the far chair, a small ledger open on her knee.",
  },

  "wall-sergeant": {
    id: "wall-sergeant",
    kind: "gate",
    label: "Gate Watchpost",
    keeper: "the wall sergeant",
    icon: "bldg",
    hours: { open: 0, close: 24 },
    blurb: "A low thick-faced watchpost set into the southern wall of the Outer Works, a single iron-shod gate through it. The sergeant on duty keeps a chalked board of who has passed today and where they were said to be going; a pole-mounted bell hangs for the alarm and a smaller hand-bell for traffic.",
  },

  // ===========================================================================
  // Whitemarch satellite outer-rings (SAT-5 patch)
  //
  // 10 service entries the outer-ring patches and Noble Rise reference:
  //   - Outer Works patch (north satellite annulus): cartwright, sutler.
  //   - Caravanserai patch (west satellite annulus): cartwright, cooper,
  //     foreign-trader.
  //   - Noble Rise (House Drelan's west inner ward, formerly the south estate):
  //     almoner, carriage-wright, estate-steward, master-gardener,
  //     orangery-keeper, tenant-row.
  //
  // `cartwright` is declared by BOTH the Outer Works patch (a road-fort
  // repair-yard for military and Crown Road wagons) and the Caravanserai
  // patch (a drover's yard for caravan-wagons coming off the long roads).
  // Authored once below; the blurb bridges both surfaces.
  //
  // Alphabetised by key. Trade counters carry `kind:"trader"`, modest
  // `buys`/`stock`, and trader hours; keeper-only surfaces carry their own
  // `kind` ("clerk", "keeper", "steward", "warden") and no stock.
  // ===========================================================================

  "carriage-wright": {
    id: "carriage-wright",
    kind: "trader",
    label: "Carriage House",
    keeper: "the carriage-wright",
    icon: "bldg",
    hours: { open: 7, close: 19 },
    buys: ["material", "tool"],
    blurb: "A broad timber shop at the back of the estate's carriage-house, the painted boxes of the family kept on flagged stone in front. Spare wheels stacked by gauge, a long bench of draw-knives and gouges, a tin of axle-grease on every shelf. Minor repairs and re-axle work for travellers who reach the outer gate, if the steward signs the chit.",
    stock: [
      { id: "hardwood-haft", chance: 0.9, qty: [2, 5], priceMult: 1.25 },
      { id: "iron-ingot",    chance: 0.6, qty: [1, 3], priceMult: 1.3 },
      { id: "leather-hide",  chance: 0.7, qty: [1, 3], priceMult: 1.25 },
      { id: "repair-kit",    chance: 0.7, qty: [1, 2], priceMult: 1.3 },
    ],
  },

  cartwright: {
    id: "cartwright",
    kind: "trader",
    label: "Cartwright Yard",
    keeper: "the cartwright",
    icon: "bldg",
    hours: { open: 6, close: 19 },
    buys: ["material", "tool"],
    blurb: "An open-fronted timber shed with two pits sunk into the floor for working under wagons — road-wagons up from the Crown Road one day, caravan-wagons in off the long west road the next. Spare wheels sorted by gauge against the back wall, coopered iron tyres on pegs above, a bench buried under chisels and draw-knives, a long ash-pole for prying axles straight. Sound wheels walked out within the day; broken ones within the week.",
    stock: [
      { id: "hardwood-haft", chance: 1.0, qty: [3, 6], priceMult: 1.25 },
      { id: "iron-ingot",    chance: 0.7, qty: [1, 3], priceMult: 1.3 },
      { id: "leather-hide",  chance: 0.6, qty: [1, 3], priceMult: 1.25 },
      { id: "repair-kit",    chance: 0.7, qty: [1, 2], priceMult: 1.3 },
      { id: "rope-hemp",     chance: 0.7, qty: [2, 5], priceMult: 1.2 },
    ],
  },

  cooper: {
    id: "cooper",
    kind: "trader",
    label: "Coopers' Row",
    keeper: "the cooper",
    icon: "bldg",
    hours: { open: 6, close: 19 },
    buys: ["material"],
    blurb: "A long shed of stave-wood with three benches working in line, a stack of seasoned oak running the length of the back wall. New casks for caravans setting out, repairs for casks coming in, char-fired barrels for wine and oil, hooped tubs for grain and salt-pork. The yard smells of green oak and old wine-lees; the coopers themselves thick-armed, taciturn, and paid by the barrel.",
    stock: [
      { id: "waterskin",  chance: 0.8, qty: [2, 5], priceMult: 1.2 },
      { id: "cook-pot",   chance: 0.5, qty: [1, 2], priceMult: 1.25 },
      { id: "rope-hemp",  chance: 0.7, qty: [2, 5], priceMult: 1.2 },
    ],
  },

  "estate-steward": {
    id: "estate-steward",
    kind: "steward",
    label: "Steward's Lodge",
    keeper: "the estate steward",
    icon: "bldg",
    hours: { open: 6, close: 20 },
    blurb: "A two-storey timber lodge west of the avenue, the working office of the estate's full steward — a separate officer from the house-steward who runs the Servants' Lane inside the inner compound. A high desk by the window, a wall of pigeon-holes for rent-rolls and seed-bills, a small fire that burns through the working months. He audits the house rents and the Townhouse Row leases the first week of every quarter, and squares the ward's tradesmen accounts at midsummer and midwinter.",
  },

  "foreign-trader": {
    id: "foreign-trader",
    kind: "trader",
    label: "Foreign Merchants' Row",
    keeper: "the foreign traders",
    icon: "market",
    hours: { open: 7, close: 19 },
    buys: ["supply", "material", "food"],
    blurb: "A double row of awning-stalls along the south annulus, each one rented by a drover who has unhitched his wagon for a few days and is selling what he hauled. Spice in twists of waxed paper, southern cloth, eastern brass-work, dried fruit by the string, knives in three patterns no smith in the city would forge. Six languages between them; prices change every hour, in any of three currencies.",
    stock: [
      { id: "dried-figs",      chance: 0.9, qty: [2, 5], priceMult: 1.35 },
      { id: "spirits",         chance: 0.7, qty: [1, 3], priceMult: 1.4 },
      { id: "wine",            chance: 0.7, qty: [2, 4], priceMult: 1.35 },
      { id: "traveling-cloak", chance: 0.5, qty: [1, 2], priceMult: 1.4 },
      { id: "antivenom",       chance: 0.4, qty: [1, 2], priceMult: 1.4 },
    ],
  },

  "master-gardener": {
    id: "master-gardener",
    kind: "keeper",
    label: "Master Gardener's Cottage",
    keeper: "the master gardener",
    icon: "bldg",
    hours: { open: 5, close: 20 },
    blurb: "A small stone cottage west of the avenue, set apart from Townhouse Row by a clipped hedge of box. A tiled hearth in the kitchen, a glassed window the row does not have, a key-ring at the gardener's belt that opens the orangery, the Walled Garden's side-gate, and the seed-store. Behind the cottage a low shed of working tools and the rolled canvas covers for the citrus.",
  },

  "orangery-keeper": {
    id: "orangery-keeper",
    kind: "keeper",
    label: "Greenhouse / Orangery",
    keeper: "the orangery-keeper",
    icon: "bldg",
    hours: { open: 6, close: 19 },
    blurb: "A heated glass-house south of the steward's lodge, the panes set in a frame of pale wood and braced against the wind. Small orange-trees in glazed pots, a lemon trained against the back wall, hyacinths and tulips forced out of season for the Marriage Hall's table, a thread of jasmine that scents the whole room in early summer. A stove in the corner burns low through the cold months; the room is locked at dusk and the key kept on the gardener's belt.",
  },

  sutler: {
    id: "sutler",
    kind: "trader",
    label: "Sutlers' Row",
    keeper: "the sutlers",
    icon: "market",
    hours: { open: 5, close: 21 },
    buys: ["supply", "food", "material"],
    blurb: "A line of canvas-roofed stalls leaning against the inside of the outer wall, selling everything a marching man might buy without thinking: dried meat, salt, hard cheese, lamp-oil, candles by the dozen, thread, sewing-needles, copper buckles, sharpening-stones, and the kind of cheap brandy that travels well. Licensed by the wall-sergeant; prices fixed by a chalked board no one is allowed to wipe but the duty officer.",
    stock: [
      { id: "hardtack",      chance: 1.0, qty: [3, 8], priceMult: 1.2 },
      { id: "jerky",         chance: 0.9, qty: [2, 5], priceMult: 1.25 },
      { id: "salt-pork",     chance: 0.7, qty: [1, 4], priceMult: 1.3 },
      { id: "rope-hemp",     chance: 0.9, qty: [2, 5], priceMult: 1.2 },
      { id: "lamp-oil",      chance: 1.0, qty: [3, 8], priceMult: 1.2 },
      { id: "torch",         chance: 1.0, qty: [3, 9], priceMult: 1.2 },
      { id: "tinderbox",     chance: 0.8, qty: [1, 4], priceMult: 1.2 },
      { id: "traveling-cloak", chance: 0.6, qty: [1, 2], priceMult: 1.25 },
      { id: "whetstone",     chance: 0.7, qty: [1, 3], priceMult: 1.25 },
      { id: "spirits",       chance: 0.6, qty: [1, 3], priceMult: 1.3 },
    ],
  },

  "tenant-row": {
    id: "tenant-row",
    kind: "keeper",
    label: "Townhouse Row",
    keeper: "the row headman",
    icon: "bldg",
    hours: { open: 5, close: 22 },
    blurb: "A terrace of tall narrow townhouses on the south side of the Noble Walk, let to the lesser gentry and the households of Drelan retainers — the family physician, the estate's factors, the marriage-clerk, and the senior servants who do not sleep in the Great House. Each with a railed step to the street and a small walled yard behind. The headman keeps the row's rota and stands first at the steward's door for its disputes.",
  },

  almoner: {
    id: "almoner",
    kind: "keeper",
    label: "Almoner's Hall",
    keeper: "the almoner",
    icon: "bldg",
    hours: { open: 7, close: 16 },
    blurb: "A plain hall near the Noble Gate where House Drelan gives out bread, coin, and cast-off cloth to the deserving poor on the appointed days. A lay-brother of the Oath keeps the alms-roll at a high desk; petitioners queue along the Noble Walk under the eye of the gate-guard, and are seen one at a time.",
  },

  "commons-gate": {
    id: "commons-gate",
    kind: "gate",
    label: "Commons Gate",
    keeper: "the gate beadle",
    icon: "bldg",
    hours: { open: 5, close: 21 },
    blurb: "A plain stone gate-arch where the Low Wards open onto the Citadel Approach — no portcullis, only a barred night-door and the beadle's lodge. By day the poor spill out to the processional road to beg, hawk, and watch the carriages climb to the Citadel; at the curfew bell the beadle bars the door and the ward is shut in until dawn.",
  },

  tavern: {
    id: "tavern",
    kind: "tavern",
    label: "The Leaning Tankard",
    keeper: "the landlord",
    icon: "bldg",
    hours: { open: 6, close: 1 },
    blurb: "A low smoke-blackened tap-room sinking on its north side, the benches worn to a shine and the floor sloping enough to roll a dropped coin to the wall. Thin ale by the jack, a pot of something grey on the fire, a back room let by the hour, and a landlord who hears everything the wards say and sells the better half of it.",
    blurb_short: "Thin ale, a sloping floor, a landlord who listens.",
    icon_glyph: "tavern",
    hms: null,
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
