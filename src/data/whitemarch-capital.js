// Whitemarch's unified local/continental map.
//
// This module is intentionally cycle-free: continent.js imports its metadata,
// so the capital compiler must not import the continent generator in return.
// The six reviewed route seams below were derived from the generator's axial
// route raster and are kept as stable authored coordinates.

export const WHITEMARCH_MAP_VERSION = 3;

const CITY_ID = "whitemarch";
const REGION_ID = "whitemarch";
const CITY_RADIUS = 12;
const WALL_RADIUS = 10;
const SQRT_3_OVER_2 = Math.sqrt(3) / 2;
const WHITEWEND_COLUMNS = new Set([4, 5]);
const WHITEWEND_BRIDGE_ROWS = new Set([-5, 0, 3]);
const WHITEWEND_TAIL_KEYS = new Set([
  // Northern culvert to the generator's Whitewend at 12,-13.
  "4,-9", "5,-9", "6,-10", "7,-10", "8,-11", "9,-11", "10,-11", "11,-12", "12,-12",
  // Eastern quay-channel to the generator's Whitewend at 12,1.
  "5,2", "6,2", "7,1", "8,1", "9,1", "10,1", "11,0", "12,0",
]);

const HEX_DIRECTIONS = Object.freeze([
  Object.freeze({ x: 1, y: 0 }),
  Object.freeze({ x: 1, y: -1 }),
  Object.freeze({ x: 0, y: -1 }),
  Object.freeze({ x: -1, y: 0 }),
  Object.freeze({ x: -1, y: 1 }),
  Object.freeze({ x: 0, y: 1 }),
]);

function coordKey(coord) {
  return `${coord.x},${coord.y}`;
}

function hexDistance(coord) {
  return (Math.abs(coord.x) + Math.abs(coord.y) + Math.abs(coord.x + coord.y)) / 2;
}

function adjacentCoords(coord) {
  return HEX_DIRECTIONS.map((direction) => ({
    x: coord.x + direction.x,
    y: coord.y + direction.y,
  }));
}

export const WHITEMARCH_DISTRICTS = Object.freeze([
  Object.freeze({ id: "grand-market", name: "The Grand Market", band: "inner", description: "The civic and commercial heart around Grain Square." }),
  Object.freeze({ id: "temple-steps", name: "Temple Steps", band: "inner", description: "Hospitals, shrines, almshouses, and oath courts." }),
  Object.freeze({ id: "low-wards", name: "The Low Wards", band: "inner", description: "Crowded tenements, cookshops, pumps, and roof lanes." }),
  Object.freeze({ id: "chain-ward", name: "The Chain Ward", band: "inner", description: "Gaol courts, bond registries, and the public sale steps." }),
  Object.freeze({ id: "guild-court", name: "Guild Court", band: "inner", description: "Charter halls, assay offices, and counting chambers." }),
  Object.freeze({ id: "river-docks", name: "The River Docks", band: "inner", description: "Quays, warehouses, chandlers, and Whitewend stairs." }),
  Object.freeze({ id: "crown-gate", name: "Crown Gate Ward", band: "outer", description: "The eastern gate approaches and customs lanes." }),
  Object.freeze({ id: "iron-quarter", name: "The Iron Quarter", band: "outer", description: "Forges, armourers, leather yards, and wheelwrights." }),
  Object.freeze({ id: "noble-rise", name: "Noble Rise", band: "outer", description: "Garden courts, embassies, and the houses of patrons." }),
  Object.freeze({ id: "citadel-ward", name: "The Citadel Ward", band: "outer", description: "The Iron Palace, arsenal, and royal muster grounds." }),
  Object.freeze({ id: "caravan-ward", name: "The Caravan Ward", band: "outer", description: "Stable courts, hostel yards, and foreign factors." }),
  Object.freeze({ id: "outer-works", name: "The Outer Works", band: "outer", description: "Road forts, watch posts, and the wall's forward yards." }),
]);

const DISTRICT_BY_ID = Object.freeze(Object.fromEntries(
  WHITEMARCH_DISTRICTS.map((district) => [district.id, district]),
));

function districtForCoord(coord) {
  const distance = hexDistance(coord);
  if (distance <= 2) return WHITEMARCH_DISTRICTS[0];
  const px = coord.x + coord.y / 2;
  const py = coord.y * SQRT_3_OVER_2;
  const angle = (Math.atan2(py, px) + Math.PI * 2) % (Math.PI * 2);
  const sector = Math.min(5, Math.floor((angle + Math.PI / 6) / (Math.PI / 3)) % 6);
  return WHITEMARCH_DISTRICTS[(distance <= 6 ? 0 : 6) + sector];
}

const GATE_BLUEPRINTS = Object.freeze([
  Object.freeze({ id: "crown-gate", name: "Crown Gate", routeId: "crown-road-east", coord: Object.freeze({ x: 8, y: 2 }), approach: Object.freeze({ x: 9, y: 2 }), mouth: Object.freeze({ x: 10, y: 2 }), outside: Object.freeze({ x: 11, y: 2 }) }),
  Object.freeze({ id: "alder-gate", name: "Alder Gate", routeId: "tannic-road", coord: Object.freeze({ x: -4, y: -6 }), approach: Object.freeze({ x: -4, y: -7 }), mouth: Object.freeze({ x: -5, y: -7 }), outside: Object.freeze({ x: -6, y: -7 }) }),
  Object.freeze({ id: "sheep-gate", name: "Sheep Gate", routeId: "spine-road", coord: Object.freeze({ x: 7, y: 3 }), approach: Object.freeze({ x: 8, y: 3 }), mouth: Object.freeze({ x: 9, y: 3 }), outside: Object.freeze({ x: 10, y: 3 }) }),
  Object.freeze({ id: "hedge-gate", name: "Hedge Gate", routeId: "bramble-road", coord: Object.freeze({ x: -7, y: 10 }), approach: Object.freeze({ x: -8, y: 11 }), mouth: Object.freeze({ x: -8, y: 12 }), outside: Object.freeze({ x: -8, y: 13 }) }),
  Object.freeze({ id: "salt-gate", name: "Salt Gate", routeId: "south-road", coord: Object.freeze({ x: -2, y: 10 }), approach: Object.freeze({ x: -2, y: 11 }), mouth: Object.freeze({ x: -2, y: 12 }), outside: Object.freeze({ x: -3, y: 13 }) }),
  Object.freeze({ id: "smoke-gate", name: "Smoke Gate", routeId: "north-road", coord: Object.freeze({ x: 3, y: -10 }), approach: Object.freeze({ x: 4, y: -11 }), mouth: Object.freeze({ x: 4, y: -12 }), outside: Object.freeze({ x: 4, y: -13 }) }),
]);

export const WHITEMARCH_GATES = Object.freeze(GATE_BLUEPRINTS.map((gate) => Object.freeze({
  id: gate.id,
  name: gate.name,
  coord: gate.coord,
  routeId: gate.routeId,
  description: `${gate.name} is a defended passage through Whitemarch's great wall.`,
})));

export const WHITEMARCH_ROUTE_MOUTHS = Object.freeze(GATE_BLUEPRINTS.map((gate) => Object.freeze({
  id: `${gate.id}-mouth`,
  name: `${gate.name} Road Mouth`,
  routeId: gate.routeId,
  gateId: gate.id,
  coord: gate.mouth,
  outside: gate.outside,
})));

export const WHITEMARCH_CAPITAL = Object.freeze({
  id: CITY_ID,
  cityId: CITY_ID,
  name: "Whitemarch",
  regionId: REGION_ID,
  mapVersion: WHITEMARCH_MAP_VERSION,
  start: Object.freeze({ x: 0, y: 0, part: "grain-square" }),
  center: Object.freeze({ x: 0, y: 0 }),
  bounds: Object.freeze({ xmin: -CITY_RADIUS, xmax: CITY_RADIUS, ymin: -CITY_RADIUS, ymax: CITY_RADIUS }),
  radius: CITY_RADIUS,
  districts: WHITEMARCH_DISTRICTS,
  gates: WHITEMARCH_GATES,
  routeMouths: WHITEMARCH_ROUTE_MOUTHS,
});

function poi(part, name, districtId, description, options = {}) {
  return Object.freeze({ part, name, districtId, description, ...options });
}

// Eighty-eight civic, commercial, religious, military, and neighbourhood POIs.
// The six gates below bring the named total to ninety-four. Exactly forty-eight of
// these point at BUILDINGS entries whose UI kinds are currently supported.
const POI_SPECS = Object.freeze([
  // Grand Market (7; 5 services)
  poi("grain-square", "Grain Square", "grand-market", "The broad central square where grain bells, public notices, and market cries order the capital's day.", { type: "market", service: "market", marketTier: "standard", coord: { x: 0, y: 0 } }),
  poi("grand-concourse", "The Grand Concourse", "grand-market", "A paved civic avenue carrying petitioners, carts, heralds, and processions across the city's crowded heart."),
  poi("counting-house", "The Counting House", "grand-market", "A severe hall of scales and iron-bound ledgers where the crown's shillings are weighed and recorded.", { type: "courthouse" }),
  poi("market-annex", "Provisioners' Arcade", "grand-market", "A roofed arcade of food stalls and expedition suppliers serving travellers before the road.", { type: "market", service: "market", marketTier: "budget" }),
  poi("money-changer", "The Brass Scales", "grand-market", "A guarded exchange counter where foreign coin is clipped, tested, and traded by posted weight.", { type: "market", service: "money-changer", marketTier: "premium" }),
  poi("cheapjack-row", "Cheapjack Row", "grand-market", "A noisy rank of canvas booths selling end-of-lot rope, dented cook pots, patched packs, yesterday's candles, and tools with one good season left in them.", { type: "market", service: "general-store", marketTier: "budget" }),
  poi("goldcloth-exchange", "Goldcloth Exchange", "grand-market", "A guarded arcade of imported cloth, bottled spirits, eastern brasswork, and foreign luxuries where every counter keeps its own interpreter.", { type: "market", service: "foreign-trader", marketTier: "premium" }),

  // Temple Steps (9; 4 services)
  poi("hospital-cloister", "Hospital Cloister", "temple-steps", "A clean stone cloister where lay healers dress wounds beneath rows of drying herbs.", { type: "healer", service: "healer", marketTier: "standard" }),
  poi("oath-temple", "Temple of the Seven Oaths", "temple-steps", "A many-doored temple where civic, household, military, and funerary vows are witnessed.", { type: "temple" }),
  poi("bonepicker-chapel", "Bonepicker Chapel", "temple-steps", "A soot-dark chapel whose keepers name the unclaimed dead before the city buries them.", { type: "cemetery" }),
  poi("almshouse", "The White Bowl Almshouse", "temple-steps", "A long refectory offering broth, blankets, and a night's bench to people without coin."),
  poi("apothecary-stall", "Apothecary's Window", "temple-steps", "A green-shuttered dispensary selling measured powders, tinctures, poultices, and field remedies.", { type: "healer", service: "apothecary", marketTier: "budget" }),
  poi("greenward-herbarium", "Greenward Herbarium", "temple-steps", "A green-awning herb market where field gatherers sell labelled roots, medicinal leaves, seeds, and freshly ground remedies.", { type: "market", service: "herbalist", marketTier: "budget" }),
  poi("whitewend-baths", "Whitewend Public Baths", "temple-steps", "A civic steamhouse of tiled plunge pools, heated benches, laundry rooms, and attendants who know every ward's gossip.", { type: "bathhouse" }),
  poi("pilgrims-mortar", "The Pilgrim's Mortar", "temple-steps", "A plain dispensary serving road-worn pilgrims with honest tinctures, bundled poultices, and remedies sold in reused brown bottles.", { type: "healer", service: "apothecary", marketTier: "budget" }),
  poi("seven-lamps", "Hall of Seven Lamps", "temple-steps", "A round public shrine where seven oil lamps burn for travellers, debtors, soldiers, mothers, rulers, the dead, and those whose oath has no witness.", { type: "temple" }),

  // Low Wards (11; 5 services)
  poi("low-wards", "Low Wards Commons", "low-wards", "A cramped common court loud with washing lines, cookfires, children, and neighbourhood arguments."),
  poi("leaning-tankard", "The Leaning Tankard", "low-wards", "A warm, crooked tavern where labour crews hire on and old campaigns improve with every telling.", { type: "tavern", service: "tavern" }),
  poi("rat-lane", "Rat Lane", "low-wards", "A narrow service lane of pawn windows, patched roofs, and drains that never quite run clear."),
  poi("public-pump", "The Lion-Head Pump", "low-wards", "A busy public well where water queues double as the ward's fastest exchange of news."),
  poi("ward-store", "Low Ward General Store", "low-wards", "A crowded counter of lamp oil, rope, blankets, cheap tools, and household necessities.", { type: "market", service: "general-store", marketTier: "budget" }),
  poi("copper-ladle", "The Copper Ladle", "low-wards", "A crowded cookshop serving hot stew, roast roots, river fish, and late suppers from a broad open kitchen.", { type: "restaurant" }),
  poi("velvet-lantern", "The Velvet Lantern", "low-wards", "A licensed house of pleasure marked by a shaded red lamp, discreet guards, private parlours, and curtained upper rooms.", { type: "brothel" }),
  poi("rag-and-bone", "Rag-and-Bone Exchange", "low-wards", "A cramped resale counter of salvaged buckles, patched bedrolls, chipped tools, reclaimed rope, and household goods bought by weight rather than beauty.", { type: "market", service: "general-store", marketTier: "budget" }),
  poi("second-bell-forge", "Second-Bell Surplus Forge", "low-wards", "A smoky repair forge selling serviceable blades, mismatched armour, and tools released from watch stores after inspection.", { type: "smithy", service: "blacksmith", marketTier: "budget" }),
  poi("pennyroyal-cart", "Pennyroyal Herb Cart", "low-wards", "A handcart bright with bundled mint, bitter bark, dried flowers, and cheap field dressings measured with a horn spoon.", { type: "market", service: "herbalist", marketTier: "budget" }),
  poi("common-steam", "Common Steam Baths", "low-wards", "A loud brick bathhouse with communal tubs, a laundry furnace, cheap soap, and a copper charge collected at the door.", { type: "bathhouse" }),

  // Chain Ward (6; 3 services)
  poi("chain-steps", "Chain Market Steps", "chain-ward", "Pale sale steps where bond contracts and human captivity are presented as civic routine.", { type: "market", service: "slavemarket" }),
  poi("holding-cells", "Holding Cells", "chain-ward", "A barred intake range for prisoners awaiting hearing, transfer, ransom, or sentence.", { type: "gaol", service: "gaol" }),
  poi("prison-gate", "Prison Gate", "chain-ward", "A nail-scarred threshold watched day and night by gaolers with ringed keys.", { type: "prison" }),
  poi("bond-registry", "Bond Registry", "chain-ward", "A ledger hall where contracts of debt, service, ransom, and manumission are copied.", { type: "registry" }),
  poi("auction-court", "Auction Court", "chain-ward", "A walled court of tally rails, inspection awnings, and hard-eyed licensed factors.", { type: "slave-market" }),
  poi("iron-key-smithy", "Iron Key Smithy", "chain-ward", "A practical forge making locks, hinges, manacles, cell fittings, and inexpensive arms for bailiffs and caravan guards.", { type: "smithy", service: "blacksmith", marketTier: "budget" }),

  // Guild Court (9; 5 services)
  poi("guild-court", "Guild Court", "guild-court", "A formal square fronted by the chartered trades and their painted company signs.", { type: "guildhall" }),
  poi("registry-hall", "Registry Hall", "guild-court", "A dry labyrinth of clerks, petitions, stamped copies, and chained reference books.", { type: "registry" }),
  poi("weigh-hall", "The Public Weigh Hall", "guild-court", "A vaulted hall of beam scales where disputed cargoes are measured before witnesses."),
  poi("charter-archive", "Charter Archive", "guild-court", "A guarded archive preserving guild privileges, civic boundaries, and judgments on trade.", { type: "archive" }),
  poi("foreign-exchange", "Foreign Factors' Hall", "guild-court", "A multilingual trading room where licensed factors broker distant wares and letters of credit.", { type: "market", service: "foreign-trader", marketTier: "premium" }),
  poi("arcane-exchange", "The Gilded Astrolabe", "guild-court", "A licensed arcane factor dealing in assayed spellstaves, chained grimoires, wands, and carefully warded magical foci.", { type: "market", service: "magic-shop", marketTier: "premium" }),
  poi("charter-outfitters", "Charter Outfitters", "guild-court", "A polished expedition house selling sealed provisions, indexed tools, fitted packs, and replacement equipment to chartered companies.", { type: "market", service: "general-store", marketTier: "premium" }),
  poi("guild-apothecary", "College of Physic Dispensary", "guild-court", "A tiled dispensary whose remedies carry assay numbers, measured doses, and the signatures of guild-trained compounders.", { type: "healer", service: "apothecary", marketTier: "premium" }),
  poi("assay-armoury", "Assay Masters' Armoury", "guild-court", "A quiet weapons house where every blade, helm, and mail shirt bears a stamped composition, weight, and guild warranty.", { type: "smithy", service: "blacksmith", marketTier: "premium" }),

  // River Docks (7; 5 services)
  poi("river-stair", "Whitewend Ferry Stair", "river-docks", "Broad wet steps descending to ferries, workboats, and the brown current of the Whitewend.", { type: "dock", coord: { x: 3, y: -4 } }),
  poi("high-quay", "High Quay Fish Market", "river-docks", "A wind-cut quay where fishmongers sell the morning catch under striped canvas.", { type: "market", service: "fishmonger", marketTier: "budget" }),
  poi("warehouse-row", "Warehouse Row", "river-docks", "A canyon of hoists, bonded storehouses, tally doors, and shouting cargo crews.", { type: "warehouse" }),
  poi("chandlery", "The Lamp and Line Chandlery", "river-docks", "A tar-scented shop of cordage, canvas, lamp fuel, hooks, floats, and shipboard tools.", { type: "market", service: "chandler", marketTier: "budget" }),
  poi("cooperage", "Whitewend Cooperage", "river-docks", "A hammering yard where barrels, tubs, and casks are raised from seasoned staves.", { type: "market", service: "cooper", marketTier: "budget" }),
  poi("mud-quay-market", "Mud Quay Provisions", "river-docks", "A dawn market of day-old bread, bruised fruit, coarse rope, lamp ends, and travel food priced to clear before the tide turns.", { type: "market", service: "market", marketTier: "budget" }),
  poi("sailors-rest", "The Sailors' Rest", "river-docks", "A broad dockside inn with rope bunks, locked sea chests, hot chowder, and a taproom that opens before the first ferry bell.", { type: "inn", service: "inn" }),

  // Crown Gate Ward (4; 3 services)
  poi("crown-gate-house", "Crown Gate Customs House", "crown-gate", "A vaulted customs hall where road permits, wagon seals, passenger tallies, and disputed duties are settled beneath the city arms.", { type: "checkpoint" }),
  poi("east-road-outfitters", "East Road Outfitters", "crown-gate", "A busy gateward shop selling practical food, rope, lamp fuel, bedrolls, and weather gear to travellers who have not yet reached the central market.", { type: "market", service: "general-store", marketTier: "budget" }),
  poi("gate-stables", "Crown Gate Horse Exchange", "crown-gate", "A clean public stable with hire pens, remount rails, tack rooms, fodder scales, and an exercise ring beside the east road.", { type: "stable", service: "stable", marketTier: "standard" }),
  poi("crown-road-inn", "The Crown and Mile", "crown-gate", "A respectable gate inn with private rooms, guarded coach bays, a public dining room, and clerks who arrange dawn departures.", { type: "inn", service: "inn" }),

  // Iron Quarter (7; 6 services)
  poi("smith-row", "Public Smith Row", "iron-quarter", "A long forge lane ringing with hammers and lit orange by banked working fires.", { type: "smithy", service: "blacksmith", marketTier: "standard" }),
  poi("forge-yard", "Crown Forge Yard", "iron-quarter", "A soot-black work court for military repairs, wagon iron, and bulk contracts."),
  poi("leather-row", "Leather Row", "iron-quarter", "Tanners and harness makers work beneath awnings sharp with bark, oil, and curing hide.", { type: "market", service: "leather-worker", marketTier: "budget" }),
  poi("cartwright-yard", "Cartwright Yard", "iron-quarter", "A timber yard of hubs, spokes, axles, and half-built working carts.", { type: "market", service: "cartwright", marketTier: "budget" }),
  poi("carriage-works", "Royal Carriage Works", "iron-quarter", "A skilled workshop building sprung coaches, courier traps, and ceremonial wagons.", { type: "market", service: "carriage-wright", marketTier: "premium" }),
  poi("broken-anvil", "The Broken Anvil", "iron-quarter", "A resale forge dealing in repaired campaign gear, rehafted tools, mismatched armour, and blades whose heraldry has been ground away.", { type: "smithy", service: "blacksmith", marketTier: "budget" }),
  poi("masters-row", "Masters' Blade Row", "iron-quarter", "A guild-screened line of master armourers taking fitted commissions and selling warranted weapons from locked walnut racks.", { type: "smithy", service: "blacksmith", marketTier: "premium" }),

  // Noble Rise (10; 5 services)
  poi("garden-court", "Garden Court", "noble-rise", "A quiet court of clipped yew, pale gravel, guarded doors, and discreet servants.", { type: "park" }),
  poi("patron-salon", "Patrons' Hall", "noble-rise", "A reception hall where houses negotiate marriages, commissions, favours, and old grievances."),
  poi("marriage-hall", "Marriage Hall", "noble-rise", "A bright civil chamber for witnessed contracts, settlements, adoptions, and family compacts."),
  poi("rise-provisioner", "Noble Rise Provisioner", "noble-rise", "A precise shop supplying fine travel goods, household stores, and sealed gift baskets.", { type: "market", service: "general-store", marketTier: "noble" }),
  poi("aureate-provisioner", "The Aureate Provisioner", "noble-rise", "A carpeted house of imported preserves, silver travel sets, perfumed lamp oils, matched luggage, and expedition hampers packed by appointment.", { type: "market", service: "general-store", marketTier: "noble" }),
  poi("argent-armoury", "The Argent Armoury", "noble-rise", "A discreet appointment-only armoury fitting house guards and titled duelists with polished steel, heraldic fittings, and private warranties.", { type: "smithy", service: "blacksmith", marketTier: "noble" }),
  poi("ivory-mortar", "The Ivory Mortar", "noble-rise", "A physician's dispensary of crystal vials, rare antidotes, scented restoratives, and compounds prepared for named households rather than walk-in patients.", { type: "healer", service: "apothecary", marketTier: "noble" }),
  poi("starfall-arcana", "Starfall Arcana", "noble-rise", "Whitemarch's sole royal-rank trade house: a crown-licensed salon of epic foci and wards shown only beneath written guarantee.", { type: "market", service: "royal-arcana", marketTier: "royal" }),
  poi("swan-baths", "The Silver Swan Baths", "noble-rise", "A marble bathhouse of private plunge rooms, perfumed steam, heated towels, discreet attendants, and separate carriage entrances.", { type: "bathhouse" }),
  poi("rose-and-hart", "The Rose and Hart", "noble-rise", "A reservation dining house serving many-course suppers on silver plate while musicians play behind a carved screen.", { type: "restaurant" }),

  // Citadel Ward (6; 2 services)
  poi("inner-gate", "Citadel Inner Gate", "citadel-ward", "A steep defended gate where palace warrants are checked beneath murder holes."),
  poi("muster-court", "Royal Muster Court", "citadel-ward", "A broad drill court marked for companies, cavalry files, baggage, and inspection.", { type: "barracks" }),
  poi("iron-palace", "The Iron Palace", "citadel-ward", "The black-and-white seat of Whitemarch's crown, austere above the crowded wards.", { type: "palace" }),
  poi("dragon-watch", "Dragon Watch Tower", "citadel-ward", "A high signal tower maintaining smoke, mirror, bell, and night-fire watches.", { type: "watchtower" }),
  poi("citadel-sutler", "Citadel Sutler", "citadel-ward", "A licensed counter selling campaign necessities to guards, messengers, and departing patrols.", { type: "market", service: "sutler", marketTier: "premium" }),
  poi("royal-armoury-shop", "The King's Warrant Armoury", "citadel-ward", "A palace-contracted armoury selling presentation arms, command-grade armour, and certified field equipment beneath the king's stamped warrant.", { type: "smithy", service: "blacksmith", marketTier: "premium" }),

  // Caravan Ward (6; 4 services)
  poi("caravan-yard", "Caravan Yard", "caravan-ward", "A vast wagon court where incoming companies unhitch, count loads, and await customs.", { type: "caravan" }),
  poi("great-stable", "The Great Stable", "caravan-ward", "Long clean stable ranges with remount pens, tack rooms, fodder lofts, and ostlers.", { type: "stable", service: "stable", marketTier: "standard" }),
  poi("farrier-lane", "Farrier Lane", "caravan-ward", "A hard-paved lane of shoeing stalls and animal doctors serving the road traffic.", { type: "smithy", service: "farrier", marketTier: "budget" }),
  poi("caravan-tavern", "The Six Roads Inn", "caravan-ward", "A large travellers' inn with guarded yards, common tables, and multilingual notices.", { type: "inn", service: "inn" }),
  poi("customs-yard", "Customs Examination Yard", "caravan-ward", "A fenced yard where wagons are opened, assessed, sealed, or turned aside.", { type: "checkpoint" }),
  poi("drovers-market", "Drovers' Market", "caravan-ward", "A broad yard market where caravan leftovers, road food, spare canvas, rope, and camp tools are sold before wagons leave the city empty.", { type: "market", service: "market", marketTier: "budget" }),

  // Outer Works (6; 1 service)
  poi("gate-watchpost", "Gate Watchpost", "outer-works", "A fortified watch station coordinating patrols along the wall and approach roads.", { type: "checkpoint" }),
  poi("road-fort", "Crown Road Fort", "outer-works", "A compact road fort controlling the nearest high ground beyond the main gate.", { type: "fortress" }),
  poi("bridge-fort", "Whitewend Bridge Fort", "outer-works", "A low stone fort covering the bridge approaches, toll barriers, and river traffic.", { type: "fortress" }),
  poi("toll-hall", "Toll Hall", "outer-works", "A busy customs hall of permits, cargo tallies, axle fees, and disputed exemptions.", { type: "checkpoint" }),
  poi("smuggler-stairs", "Smuggler Stairs", "outer-works", "A steep officially condemned stair whose worn stones suggest the prohibition is optimistic."),
  poi("wall-sutlers", "Wallfoot Sutlers", "outer-works", "A rough line of licensed canvas stalls selling marching food, lamp oil, cordage, whetstones, and cheap spirits beside the patrol mustering ground.", { type: "market", service: "sutler", marketTier: "budget" }),
]);

function baseTile(coord) {
  const district = districtForCoord(coord);
  const distance = hexDistance(coord);
  const inWhitewendBand = WHITEWEND_COLUMNS.has(coord.x) && coord.y >= -9 && coord.y <= 4;
  const inWhitewend = inWhitewendBand || WHITEWEND_TAIL_KEYS.has(coordKey(coord));
  const onBridge = inWhitewendBand && WHITEWEND_BRIDGE_ROWS.has(coord.y);
  const isGarden = district.id === "noble-rise" && distance >= 7 && distance <= 9
    && (coord.x + coord.y) % 2 === 0;
  const terrain = onBridge
    ? "road"
    : inWhitewend
      ? "water"
      : distance === WALL_RADIUS
        ? "wall"
        : isGarden || distance > WALL_RADIUS
          ? "plains"
          : "street";
  return {
    terrain,
    poi: null,
    doors: [],
    cityId: CITY_ID,
    districtId: district.id,
    districtName: district.name,
    regionId: REGION_ID,
    mapVersion: WHITEMARCH_MAP_VERSION,
    ...(inWhitewend ? { waterway: { id: "whitewend", name: "The Whitewend", kind: "river" } } : {}),
    ...(onBridge ? { bridge: true, crossing: { id: `whitewend-bridge-${coord.y}`, waterwayId: "whitewend" } } : {}),
    ...(isGarden ? { garden: true, feature: "formal-garden" } : {}),
  };
}

function placementRank(coord) {
  const hash = Math.abs(Math.imul(coord.x + 31, 1103515245) ^ Math.imul(coord.y - 17, 12345));
  return hexDistance(coord) * 1_000_000 + (hash % 1_000_000);
}

function applyPoi(tile, spec) {
  const district = DISTRICT_BY_ID[tile.districtId];
  tile.terrain = spec.terrain || (["tavern", "healer", "gaol"].includes(spec.type) ? "indoor" : "settlement");
  tile.poi = {
    type: spec.type || "landmark",
    name: spec.name,
    description: spec.description,
    access: spec.access || "public",
    area: CITY_ID,
    district: district.id,
    districtName: district.name,
    parent: district.id,
    parentName: district.name,
    part: spec.part,
    partName: spec.name,
    ...(spec.service ? { service: spec.service } : {}),
    ...(spec.marketTier ? { marketTier: spec.marketTier } : {}),
  };
}

function buildCapitalBlueprint() {
  const tiles = {};
  for (let x = -CITY_RADIUS; x <= CITY_RADIUS; x++) {
    for (let y = -CITY_RADIUS; y <= CITY_RADIUS; y++) {
      const coord = { x, y };
      if (hexDistance(coord) <= CITY_RADIUS) tiles[coordKey(coord)] = baseTile(coord);
    }
  }

  const reserved = new Set([
    "0,0",
    ...GATE_BLUEPRINTS.flatMap((gate) => [coordKey(gate.coord), coordKey(gate.approach), coordKey(gate.mouth)]),
    ...POI_SPECS.filter((spec) => spec.coord).map((spec) => coordKey(spec.coord)),
    ...WHITEWEND_TAIL_KEYS,
  ]);

  for (const spec of POI_SPECS) {
    let coord = spec.coord || null;
    if (!coord) {
      const candidates = Object.keys(tiles)
        .filter((key) => !reserved.has(key))
        .map((key) => {
          const [x, y] = key.split(",").map(Number);
          return { key, coord: { x, y }, tile: tiles[key] };
        })
        .filter(({ tile }) => tile.districtId === spec.districtId && !["wall", "water"].includes(tile.terrain))
        .sort((a, b) => placementRank(a.coord) - placementRank(b.coord));
      if (!candidates.length) throw new Error(`Whitemarch has no placement cell for ${spec.part}`);
      coord = candidates[0].coord;
    }
    const key = coordKey(coord);
    if (!tiles[key]) throw new Error(`Whitemarch POI ${spec.part} lies outside the capital at ${key}`);
    reserved.add(key);
    applyPoi(tiles[key], spec);
    if (spec.part === "grain-square") tiles[key].atlasLandmark = true;
  }

  for (const gate of GATE_BLUEPRINTS) {
    const gateKey = coordKey(gate.coord);
    const gateTile = tiles[gateKey];
    applyPoi(gateTile, poi(
      gate.id,
      gate.name,
      gateTile.districtId,
      `${gate.name} is a layered gatehouse of iron-bound doors, watch rooms, toll rails, and signal bells.`,
      { type: "gate" },
    ));
    gateTile.gateId = gate.id;

    const mouthKey = coordKey(gate.mouth);
    const mouthTile = tiles[mouthKey];
    mouthTile.terrain = "road";
    mouthTile.routeMouth = { id: `${gate.id}-mouth`, routeId: gate.routeId, gateId: gate.id };
    mouthTile.route = { id: gate.routeId, name: `${gate.name} Road`, kind: "capital-mouth" };

    const approach = tiles[coordKey(gate.approach)];
    approach.terrain = "road";
    approach.route = { id: gate.routeId, name: `${gate.name} Road`, kind: "capital-approach" };
  }

  const gateKeys = new Set(GATE_BLUEPRINTS.map((gate) => coordKey(gate.coord)));
  const mouthByKey = new Map(GATE_BLUEPRINTS.map((gate) => [coordKey(gate.mouth), gate]));

  // Materialize the complete reciprocal local graph. The wall walk links only
  // to other wall cells and declared gatehouses; ordinary streets cannot cross
  // it. Every route mouth receives one reviewed external edge.
  for (const [key, tile] of Object.entries(tiles)) {
    const [x, y] = key.split(",").map(Number);
    const from = { x, y };
    const isGate = gateKeys.has(key);
    const doors = [];
    if (tile.terrain === "water") {
      tile.doors = doors;
      continue;
    }
    for (const target of adjacentCoords(from)) {
      const targetKey = coordKey(target);
      const targetTile = tiles[targetKey];
      if (!targetTile) continue;
      if (targetTile.terrain === "water") continue;
      const targetIsGate = gateKeys.has(targetKey);
      if (tile.terrain === "wall") {
        if (targetTile.terrain === "wall" || targetIsGate) doors.push(target);
      } else if (targetTile.terrain !== "wall" || isGate) {
        doors.push(target);
      }
    }
    const mouth = mouthByKey.get(key);
    if (mouth) doors.push({ ...mouth.outside });
    tile.doors = doors;
  }

  // Service locations are destinations, not six-way shortcuts. Give each one
  // a single public threshold onto a non-service lane and remove every other
  // reciprocal edge into the building. This preserves full reachability while
  // making the local graph read as streets with entered interiors.
  const serviceKeys = new Set(Object.entries(tiles)
    .filter(([, tile]) => tile.poi?.service)
    .map(([key]) => key));
  for (const key of serviceKeys) {
    const tile = tiles[key];
    const [x, y] = key.split(",").map(Number);
    const candidates = tile.doors
      .filter((door) => {
        const targetKey = coordKey(door);
        const target = tiles[targetKey];
        return target && !serviceKeys.has(targetKey) && !["wall", "water"].includes(target.terrain);
      })
      .sort((a, b) => {
        const aTile = tiles[coordKey(a)];
        const bTile = tiles[coordKey(b)];
        const aStreet = aTile?.terrain === "street" ? 0 : 1;
        const bStreet = bTile?.terrain === "street" ? 0 : 1;
        return aStreet - bStreet || placementRank(a) - placementRank(b);
      });
    const entrance = candidates[0];
    if (!entrance) throw new Error(`Whitemarch service ${tile.poi.service} at ${key} has no public threshold`);
    for (const oldDoor of tile.doors) {
      const target = tiles[coordKey(oldDoor)];
      if (!target || (oldDoor.x === entrance.x && oldDoor.y === entrance.y)) continue;
      target.doors = target.doors.filter((door) => door.x !== x || door.y !== y);
    }
    tile.doors = [{ ...entrance }];
  }

  const named = Object.values(tiles).filter((tile) => tile.poi?.name);
  const services = named.filter((tile) => tile.poi?.service);
  if (Object.keys(tiles).length !== 469 || named.length !== 94 || services.length !== 48) {
    throw new Error(`Whitemarch compile invariant failed: ${Object.keys(tiles).length} tiles, ${named.length} POIs, ${services.length} services`);
  }

  return { tiles, sealedStructures: [] };
}

const CAPITAL_BLUEPRINT = buildCapitalBlueprint();

// A static, seed-independent projection of the authored capital for the 3D
// world atlas. This module is intentionally cycle-free (continent.js imports
// its metadata), so the atlas terrain model and its worker can read the city
// layout without pulling in persistence, Supabase, or the full engine graph.
// Each entry is a minimal frozen view of a compiled tile — never a mutable
// reference into the blueprint.
const CAPITAL_TILE_PROJECTION = new Map(Object.entries(CAPITAL_BLUEPRINT.tiles)
  .map(([key, tile]) => [key, Object.freeze({
    terrain: tile.terrain,
    districtId: tile.districtId,
    poiType: tile.poi?.type || null,
    poiPart: tile.poi?.part || null,
    isGate: tile.gateId != null || tile.poi?.type === "gate",
    isBridge: tile.bridge === true,
    isWater: tile.terrain === "water",
    isWall: tile.terrain === "wall",
  })]));

/**
 * Authored Whitemarch tile at an axial coordinate, or null outside the city.
 * Pure and synchronous; identical in the main thread and the terrain worker.
 */
export function whitemarchTileAt(x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  if (hexDistance({ x, y }) > CITY_RADIUS) return null;
  return CAPITAL_TILE_PROJECTION.get(`${x},${y}`) || null;
}

export const WHITEMARCH_LANDMARKS = Object.freeze(
  Object.entries(CAPITAL_BLUEPRINT.tiles)
    .filter(([, tile]) => tile.poi?.name)
    .map(([key, tile]) => {
      const [x, y] = key.split(",").map(Number);
      return Object.freeze({
        id: tile.poi.part,
        name: tile.poi.name,
        kind: tile.poi.type,
        coord: Object.freeze({ x, y }),
        districtId: tile.districtId,
        districtName: tile.districtName,
        atlasLandmark: tile.atlasLandmark === true,
        ...(tile.poi.service ? { service: tile.poi.service } : {}),
        ...(tile.poi.marketTier ? { marketTier: tile.poi.marketTier } : {}),
      });
    }),
);

export function compileWhitemarchCapital() {
  return JSON.parse(JSON.stringify(CAPITAL_BLUEPRINT));
}
