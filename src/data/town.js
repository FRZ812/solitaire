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

  // The warden's desk at the Prison Gate Intake. The engine's [INSPECT RIGHTS]
  // flow (App.jsx line ~2058, engine/beat.js purchase_rights) keys off
  // `kind: "gaol"`; the tile at (-3,7) carries `service: "gaol"`, so this
  // entry must be keyed `gaol` for buildingForTile() to resolve it. (Wave-3
  // S1 renamed the legacy BUILDINGS key `prison` → `gaol` to match.)
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

  // ============================================================
  // Whitemarch district services (Wave-1 districts, Wave-3 S1).
  // Each entry is the BUILDINGS-side resolution for a tile that
  // a district module under src/data/whitemarch-districts/ binds
  // via poi.service. Keepers are atmospheric, not stat-blocks;
  // the narrator voices them. Gate-keepers, clerks, and priests
  // carry no `stock` (no trader counter). Cookshop and pawnbroker
  // are the only true trade-counters in this batch.
  // ============================================================

  // Noble Rise — the resident priest of the Vaerwynne family chapel.
  // Restricted to the household: lay sisters and outside petitioners are
  // not admitted (the public oath flow lives at the Great Oath Steps).
  "chapel-priest": {
    id: "chapel-priest",
    kind: "shrine",
    label: "Private Chapel",
    keeper: "Father Edrec",
    icon: "temple",
    hours: { open: 6, close: 20 },
    blurb: "A rose-window throws coloured light onto six carved pews; the priest waits at the rail in a plain stole, the marriage register open behind him on a sloped desk.",
  },

  // Low Wards — the cheap day-labourer cookshop. A trader counter: a few
  // hot staples and cheap drink, nothing more.
  "cookshop-keeper": {
    id: "cookshop-keeper",
    kind: "trader",
    label: "Cheap Cookshop",
    keeper: "Old Vesh",
    icon: "bldg",
    hours: { open: 5, close: 22 },
    buys: ["food", "drink"],
    blurb: "A tin counter, a black-iron range, the smell of fried scraps and onion. Porters eat standing up; the keeper knows every face and almost no one's name.",
    stock: [
      { id: "hardtack",     chance: 1.0, qty: [3, 8], priceMult: 1.0 },
      { id: "soup-bones",   chance: 0.9, qty: [2, 5], priceMult: 1.0 },
      { id: "sausage-links",chance: 0.7, qty: [1, 4], priceMult: 1.05 },
      { id: "turnips",      chance: 0.8, qty: [2, 6], priceMult: 1.0 },
      { id: "ale",          chance: 1.0, qty: [3, 8], priceMult: 1.05 },
    ],
  },

  // Court Hill — the petition-side advocate's bench. Civic clerk: a writer
  // of pleas, depositions, and writs for the court above. No trade.
  "court-advocate": {
    id: "court-advocate",
    kind: "clerk",
    label: "Advocate Cloister",
    keeper: "Magister Vael Sorne",
    icon: "hall",
    hours: { open: 7, close: 18 },
    blurb: "Advocates work at slope-desks under tall windows, a wall of bound rolls behind them; petitioners wait on a polished bench with their charges in hand and a copper ready for the writing-fee.",
  },

  // River Docks — the customs officer at the Quay. A gatekeeper for goods:
  // checks bonds, stamps writs, decides who walks past the rope.
  "dock-customs-officer": {
    id: "dock-customs-officer",
    kind: "gate",
    label: "Customs Awning",
    keeper: "Officer Halt Ranner",
    icon: "dock",
    hours: { open: 5, close: 21 },
    blurb: "A plank counter on two barrels under a chain-weighted awning, two awning-guards leaning on their pikes; entry past the rope is by writ, bond, or the officer's nod, and the nod has been bought before.",
  },

  // Wall Command — the captain of the Dragon-Watch. Restricted; no trade.
  // The captain reads the day-book and the northern shutters and answers to
  // the Wall, not the street.
  "dragon-watch-captain": {
    id: "dragon-watch-captain",
    kind: "gate",
    label: "Dragon-Watch Tower",
    keeper: "Captain Yoran Tasque",
    icon: "tower",
    hours: { open: 0, close: 24 },
    blurb: "Harpoon-frames stand at the embrasures; signal-mirrors under wool covers, the day-book on a lectern weighted by a spent quarrel. The captain rises only for those his sergeant has already vouched for.",
  },

  // Foreign Quarter — the embassy interpreter stalls. A civic clerk service:
  // sworn translators who witness contracts and read foreign writs for a fee.
  "embassy-interpreter": {
    id: "embassy-interpreter",
    kind: "clerk",
    label: "Interpreter Stalls",
    keeper: "Dosha of the Three Tongues",
    icon: "hall",
    hours: { open: 6, close: 22 },
    blurb: "Half a dozen booths under a tile awning, each with its language painted on a wooden shingle. Interpreters work seated, a fee-board chalked above each desk, and witness contracts with a stamp and a quiet word in the right ear.",
  },

  // Great Stable — the farrier's lane. A craftsman service: shoeing, hoof-
  // care, light tack repair. No mounted-rack stock; the smith handles iron.
  "farrier": {
    id: "farrier",
    kind: "smith",
    label: "Farrier Lane",
    keeper: "Marrick the Farrier",
    icon: "smithy",
    hours: { open: 6, close: 19 },
    buys: ["feed", "tool", "material"],
    blurb: "A portable forge glows on the cobbles; an apprentice leans his weight on the bellows. A horse stands cross-tied with one hind hoof in the farrier's lap, the air thick with the smell of singed horn.",
    stock: [
      { id: "iron-ingot",     chance: 0.9, qty: [1, 3], priceMult: 1.3 },
      { id: "whetstone",      chance: 0.7, qty: [1, 2], priceMult: 1.25 },
      { id: "repair-kit",     chance: 0.6, qty: [1, 2], priceMult: 1.25 },
    ],
  },

  // Court Hill — the Guild Court's License Counter. Civic clerk: issues and
  // renews trade-licences, witnesses guild oaths, levies the fees. No trade.
  "guild-court-clerk": {
    id: "guild-court-clerk",
    kind: "clerk",
    label: "Guild Court License Counter",
    keeper: "Clerk-Master Beren Hask",
    icon: "hall",
    hours: { open: 7, close: 17 },
    blurb: "A long counter of dark oak, a brass licence-stamp on its chain, ledgers in cradles to either hand. Tradesmen queue with their dues counted out in advance; the clerk reads each oath aloud before he stamps.",
  },

  // Temple Steps — the lay-sisters of the Hospital Cloister. The cloister is
  // public alms-funded: a sister at the door takes the bowl, finds a cot, and
  // dispenses what the dispensary can spare. Tends, splints, fevers.
  "hospital-sister": {
    id: "hospital-sister",
    kind: "healer",
    label: "Hospital Cloister",
    keeper: "Sister Avelin",
    icon: "healer",
    hours: { open: 5, close: 22 },
    buys: ["material", "food"],
    blurb: "Whitewashed walls, rope-strung cots in pairs, a kettle of vinegar-water steaming on a charcoal brazier; lay-sisters in pale grey move between the rows with linen rolls and small wooden cups of bitter tea.",
    stock: [
      { id: "healing-salve",   chance: 1.0, qty: [1, 3], priceMult: 1.1 },
      { id: "blood-staunch",   chance: 1.0, qty: [1, 3], priceMult: 1.1 },
      { id: "willow-bark",     chance: 1.0, qty: [2, 5], priceMult: 1.1 },
      { id: "poultice",        chance: 0.8, qty: [1, 3], priceMult: 1.15 },
      { id: "fever-tonic",     chance: 0.6, qty: [1, 2], priceMult: 1.2 },
    ],
  },

  // Foreign Quarter — the Matron's Office at the foreign-hostel. A civic
  // keeper: assigns beds, collects bond-coin, vouches for guests to the
  // watch. Conditional: a name must be on the day-book before she opens.
  "hostel-matron": {
    id: "hostel-matron",
    kind: "clerk",
    label: "Matron's Office",
    keeper: "Matron Iselle Caro",
    icon: "hall",
    hours: { open: 6, close: 22 },
    blurb: "A panelled office off the hostel court; a day-book open on a slope-desk, a key-board behind, a sealing-iron warm on the brazier. The matron reads each name twice before she signs a bed against it.",
  },

  // Noble Rise — the marriage clerk's writing-room behind the chapel curtain.
  // Civic clerk service: banns, contracts, dowry-receipts. House-only.
  "marriage-clerk": {
    id: "marriage-clerk",
    kind: "clerk",
    label: "Chapel Writing-Room",
    keeper: "Goodwife Anseth Mar",
    icon: "hall",
    hours: { open: 8, close: 16 },
    blurb: "A side-room behind a heavy curtain, lit by a single lamp at a sloped desk; banns and dowry-receipts in a stack, the small marriage register open under the clerk's careful hand.",
  },

  // Noble Rise — the Noble Gate watch. A pure gatekeeper: house-liveried
  // guards inside the arch, a city sergeant outside, a brass-plate book
  // listing today's expected callers. Refuses unpermitted entry.
  "noble-gate-guard": {
    id: "noble-gate-guard",
    kind: "gate",
    label: "Noble Gate",
    keeper: "Sergeant-of-Gate Drael Vorn",
    icon: "gate",
    hours: { open: 0, close: 24 },
    blurb: "Two house-liveried guards inside the arch, a city watch-sergeant outside, a clerk at the lectern striking off names as the carriages roll through. Commoners climbing the steps look through the bars and do not stand near long.",
  },

  // Temple Steps — the oath-priest at the four altars. Public: takes oaths,
  // reads contracts, marks the wrist (ash, oil, blood, salt). No trade.
  "oath-priest": {
    id: "oath-priest",
    kind: "shrine",
    label: "Great Oath Steps",
    keeper: "Priest of the Mark",
    icon: "temple",
    hours: { open: 5, close: 21 },
    blurb: "Four altars along the back wall — ash, oil, blood, salt — and a priest in a pale robe who touches the chosen mark to the inside of the wrist and reads the contract aloud while a temple scribe writes the witness-line.",
  },

  // Noble Rise — the Patroness's salon. Conditional: a steward announces
  // petitioners, the Patroness grants or refuses. Atmosphere-only for now.
  "patron-salon": {
    id: "patron-salon",
    kind: "salon",
    label: "Patron's Salon",
    keeper: "the Patroness Lady Maerith Vaerwynne",
    icon: "hall",
    hours: { open: 10, close: 18 },
    blurb: "A long dark-panelled room lit by garden windows; chairs in pairs, a silver tea-service on a side-table, the Patroness in the far chair with a small ledger open on her knee.",
  },

  // Low Wards — the Pawn Stair. A trade-counter: small valuables in,
  // copper loans out, tagged pledges on the wall. The watch knows.
  "pawn-broker": {
    id: "pawn-broker",
    kind: "trader",
    label: "Pawn Stair",
    keeper: "Goodman Kerrith Tace",
    icon: "bldg",
    hours: { open: 7, close: 19 },
    buys: ["weapon", "armor", "tool", "clothing", "material", "supply"],
    blurb: "A half-door over a counter, a barred grille, a wall of tagged pledges — a soldier's belt-knife, a wedding hoop, a midwife's lamp. The broker reads loans aloud so the queue can witness them.",
    stock: [
      { id: "iron-dagger",     chance: 0.6, qty: [1, 2], priceMult: 0.9 },
      { id: "leather-jerkin",  chance: 0.4, qty: [1, 1], priceMult: 0.9 },
      { id: "lantern",         chance: 0.5, qty: [1, 1], priceMult: 0.9 },
      { id: "traveling-cloak", chance: 0.4, qty: [1, 1], priceMult: 0.9 },
      { id: "manacles",        chance: 0.3, qty: [1, 1], priceMult: 0.9 },
      { id: "lockpicks",       chance: 0.3, qty: [1, 1], priceMult: 1.0 },
    ],
  },

  // Low Wards — the Back-Court Well elder. Atmosphere-only: presides over
  // the court's unofficial meeting hall, decides whose bucket goes down next.
  "pump-elder": {
    id: "pump-elder",
    kind: "salon",
    label: "Back-Court Well",
    keeper: "Mother Pell",
    icon: "bldg",
    hours: { open: 5, close: 21 },
    blurb: "A round-mouthed stone well with a chipped saint at its lip; the elder sits on the polished bench with the rope across her knees and decides who in the ward is listened to today.",
  },

  // Grain Ward — the Ration Office. Civic clerk: certificates of need,
  // hardship-rations against the city's stores. Conditional access.
  "ration-clerk": {
    id: "ration-clerk",
    kind: "clerk",
    label: "Ration Office",
    keeper: "Clerk Onna Vesk",
    icon: "hall",
    hours: { open: 7, close: 16 },
    blurb: "A counter of pale plank, a stamp-block, a ledger of names against a city tally; petitioners bring their writ of need and leave with a chit for grain, salt, or oil from the storehouse next door.",
  },

  // Great Stable — the Remount Pen officer. Restricted: military beasts,
  // brand-sorted, the officer rejects expensive lies for a living. No trade.
  "remount-pen-officer": {
    id: "remount-pen-officer",
    kind: "gate",
    label: "Remount Pen",
    keeper: "Remount-Master Halric Voss",
    icon: "bldg",
    hours: { open: 5, close: 20 },
    blurb: "A square pen of stout oak rails with a locked gate and a city-crest plate above it; the officer sits at a counter under a tile awning with a stack of ledgers and a brass scale for coin and oats both.",
  },

  // Iron Quarter — the State Foundry foreman at the Work Yard. Restricted
  // access to the foundry itself; the foreman signs for delivered work from
  // the public row and occasionally releases surplus arms to vetted buyers.
  "state-foundry-foreman": {
    id: "state-foundry-foreman",
    kind: "gate",
    label: "Iron Quarter Work Yard",
    keeper: "Foreman Olras Vekt",
    icon: "smithy",
    hours: { open: 6, close: 19 },
    blurb: "A standing-desk under the foundry chimneys, a tally-board, a wooden box of charcoal chits; the foreman signs for delivered work from the public row and refuses to discuss anything beyond it.",
  },

  // Temple Steps — the temple scribe-desk in the cloister side-room. Civic
  // clerk: protection-letters, burial-papers, witness-lines for the oaths.
  "temple-scribe": {
    id: "temple-scribe",
    kind: "clerk",
    label: "Temple Scribe Desk",
    keeper: "Brother Calen",
    icon: "hall",
    hours: { open: 6, close: 20 },
    blurb: "A sloped desk in a curtained alcove, a pot of oak-gall ink and a row of cut quills; the scribe writes the witness-line in a heavy book and draws up protection-letters and burial-papers for those too weak to climb to the plaza.",
  },

  // Foreign Quarter — the Treaty Inn's keeper. The diplomatic inn: longer
  // hours than a common house, sworn-neutral ground, foreign coin accepted.
  "treaty-inn-keeper": {
    id: "treaty-inn-keeper",
    kind: "tavern",
    label: "Treaty Inn",
    keeper: "Goodman Aldric Cael",
    icon: "bldg",
    hours: { open: 6, close: 2 },
    blurb: "A long common room with banners of three crowns hung along the rafters, a board by the door in four languages, and a keeper who sets the right coin against the right ledger without asking which side of which border the trade crossed.",
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
