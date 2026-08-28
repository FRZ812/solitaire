// Shared POI icon taxonomy for the local hex map, canvas exploration map, and
// continental atlas. Each entry points at a cell in one ImageGen-authored 4x4
// atlas; renderers decide whether to crop it through SVG or Canvas.

export const POI_ATLAS_SIZE = 1254;
export const POI_ATLAS_GRID = 4;
export const POI_ATLAS_CELL = POI_ATLAS_SIZE / POI_ATLAS_GRID;

function icon(key, label, atlas, col, row) {
  return Object.freeze({ key, label, atlas, col, row });
}

export const TRADE_POI_ICONS = Object.freeze({
  "trade-general": icon("trade-general", "General goods", "trade", 0, 0),
  "trade-provisions": icon("trade-provisions", "Provisions", "trade", 1, 0),
  "trade-equipment": icon("trade-equipment", "Equipment", "trade", 2, 0),
  "trade-stable": icon("trade-stable", "Horses & mounts", "trade", 3, 0),
  "trade-magic": icon("trade-magic", "Magic shop", "trade", 0, 1),
  "trade-herbalist": icon("trade-herbalist", "Herbalist", "trade", 1, 1),
  "trade-alchemist": icon("trade-alchemist", "Alchemist", "trade", 2, 1),
  "trade-priest": icon("trade-priest", "Priest & shrine", "trade", 3, 1),
  "trade-healer": icon("trade-healer", "Healer", "trade", 0, 2),
  "trade-smith": icon("trade-smith", "Smith & forge", "trade", 1, 2),
  "trade-transport": icon("trade-transport", "Carts & transport", "trade", 2, 2),
  "trade-money": icon("trade-money", "Money exchange", "trade", 3, 2),
  "trade-tavern": icon("trade-tavern", "Tavern", "trade", 0, 3),
  "trade-fish": icon("trade-fish", "Fishmonger", "trade", 1, 3),
  "trade-chandler": icon("trade-chandler", "Chandler", "trade", 2, 3),
  "trade-foreign": icon("trade-foreign", "Foreign goods", "trade", 3, 3),
});

export const CITY_POI_ICONS = Object.freeze({
  "poi-palace": icon("poi-palace", "Palace", "city", 0, 0),
  "poi-prison": icon("poi-prison", "Prison & gaol", "city", 1, 0),
  "poi-slave-market": icon("poi-slave-market", "Slave market", "city", 2, 0),
  "poi-inn": icon("poi-inn", "Inn & lodging", "city", 3, 0),
  "poi-restaurant": icon("poi-restaurant", "Restaurant", "city", 0, 1),
  "poi-park": icon("poi-park", "Park & garden", "city", 1, 1),
  "poi-brothel": icon("poi-brothel", "Brothel", "city", 2, 1),
  "poi-bathhouse": icon("poi-bathhouse", "Bathhouse", "city", 3, 1),
  "poi-courthouse": icon("poi-courthouse", "Court & registry", "city", 0, 2),
  "poi-guildhall": icon("poi-guildhall", "Guildhall", "city", 1, 2),
  "poi-library": icon("poi-library", "Library & archive", "city", 2, 2),
  "poi-barracks": icon("poi-barracks", "Barracks & guard", "city", 3, 2),
  "poi-docks": icon("poi-docks", "Docks & harbor", "city", 0, 3),
  "poi-warehouse": icon("poi-warehouse", "Warehouse", "city", 1, 3),
  "poi-theatre": icon("poi-theatre", "Theatre & arena", "city", 2, 3),
  "poi-cemetery": icon("poi-cemetery", "Cemetery", "city", 3, 3),
});

export const WILDERNESS_POI_ICONS = Object.freeze({
  "wild-shrine": icon("wild-shrine", "Wayside shrine", "wilderness", 0, 0),
  "wild-monster-den": icon("wild-monster-den", "Monster den", "wilderness", 1, 0),
  "wild-bandit-camp": icon("wild-bandit-camp", "Bandit camp", "wilderness", 2, 0),
  "wild-merchant": icon("wild-merchant", "Wandering merchant", "wilderness", 3, 0),
  "wild-caravan": icon("wild-caravan", "Traveling caravan", "wilderness", 0, 1),
  "wild-cave": icon("wild-cave", "Cave", "wilderness", 1, 1),
  "wild-dungeon": icon("wild-dungeon", "Dungeon", "wilderness", 2, 1),
  "wild-checkpoint": icon("wild-checkpoint", "Military checkpoint", "wilderness", 3, 1),
  "wild-ruin": icon("wild-ruin", "Ruins", "wilderness", 0, 2),
  "wild-fortress": icon("wild-fortress", "Fortress", "wilderness", 1, 2),
  "wild-manor": icon("wild-manor", "Manor & estate", "wilderness", 2, 2),
  "wild-watchpost": icon("wild-watchpost", "Watchpost", "wilderness", 3, 2),
  "wild-village": icon("wild-village", "Village & hamlet", "wilderness", 0, 3),
  "wild-mine": icon("wild-mine", "Mine & quarry", "wilderness", 1, 3),
  "wild-campsite": icon("wild-campsite", "Campsite", "wilderness", 2, 3),
  "wild-bridge": icon("wild-bridge", "Bridge & ford", "wilderness", 3, 3),
});

export const POI_ICONS = Object.freeze({
  ...TRADE_POI_ICONS,
  ...CITY_POI_ICONS,
  ...WILDERNESS_POI_ICONS,
});

export const POI_LEGEND_GROUPS = Object.freeze([
  Object.freeze({ id: "trade", label: "Goods & services", items: Object.freeze(Object.values(TRADE_POI_ICONS)) }),
  Object.freeze({ id: "city", label: "City venues", items: Object.freeze(Object.values(CITY_POI_ICONS)) }),
  Object.freeze({ id: "wilderness", label: "Wilderness", items: Object.freeze(Object.values(WILDERNESS_POI_ICONS)) }),
]);

export const POI_LEGEND_ITEMS = Object.freeze(POI_LEGEND_GROUPS.flatMap(({ items }) => items));
export const TRADE_POI_LEGEND_ITEMS = Object.freeze(Object.values(TRADE_POI_ICONS));

export function isPoiIcon(iconKey) {
  return !!POI_ICONS[iconKey];
}

export function isTradePoiIcon(iconKey) {
  return !!TRADE_POI_ICONS[iconKey];
}

export function poiIconMeta(iconKey) {
  return POI_ICONS[iconKey] || null;
}

const TYPE_ICON = Object.freeze({
  palace: "poi-palace", capital: "poi-palace", city: "poi-palace", mint: "poi-palace",
  prison: "poi-prison", gaol: "poi-prison", jail: "poi-prison",
  slavemarket: "poi-slave-market", "slave-market": "poi-slave-market", auction: "poi-slave-market",
  inn: "poi-inn", hostel: "poi-inn", lodging: "poi-inn",
  restaurant: "poi-restaurant", cookshop: "poi-restaurant", eatery: "poi-restaurant",
  park: "poi-park", garden: "poi-park", grove: "poi-park",
  brothel: "poi-brothel", "pleasure-house": "poi-brothel",
  bathhouse: "poi-bathhouse", baths: "poi-bathhouse", "hot-spring": "poi-bathhouse",
  court: "poi-courthouse", courthouse: "poi-courthouse", registry: "poi-courthouse", civic: "poi-courthouse",
  guildhall: "poi-guildhall", guild: "poi-guildhall",
  library: "poi-library", archive: "poi-library", scriptorium: "poi-library",
  barracks: "poi-barracks", "guard-post": "poi-barracks", watchpost: "poi-barracks",
  dock: "poi-docks", docks: "poi-docks", port: "poi-docks", harbor: "poi-docks", harbour: "poi-docks", quay: "poi-docks",
  warehouse: "poi-warehouse", storehouse: "poi-warehouse",
  theatre: "poi-theatre", theater: "poi-theatre", arena: "poi-theatre",
  cemetery: "poi-cemetery", graveyard: "poi-cemetery", tomb: "poi-cemetery",
  den: "wild-monster-den", lair: "wild-monster-den", nest: "wild-monster-den", "monster-den": "wild-monster-den",
  "bandit-camp": "wild-bandit-camp", "outlaw-camp": "wild-bandit-camp",
  "wandering-merchant": "wild-merchant", peddler: "wild-merchant", pedlar: "wild-merchant",
  caravan: "wild-caravan", "traveling-caravan": "wild-caravan", "travelling-caravan": "wild-caravan",
  cave: "wild-cave", cavern: "wild-cave", grotto: "wild-cave",
  dungeon: "wild-dungeon", vault: "wild-dungeon", warren: "wild-dungeon", cellar: "wild-dungeon",
  checkpoint: "wild-checkpoint", "military-checkpoint": "wild-checkpoint", border: "wild-checkpoint",
  ruin: "wild-ruin", ruins: "wild-ruin",
  fortress: "wild-fortress", fort: "wild-fortress", castle: "wild-fortress", stronghold: "wild-fortress",
  manor: "wild-manor", estate: "wild-manor",
  spire: "wild-watchpost", watchpost: "wild-watchpost",
  village: "wild-village", town: "wild-village", settlement: "wild-village", hamlet: "wild-village",
  mine: "wild-mine", quarry: "wild-mine",
  camp: "wild-campsite", campsite: "wild-campsite",
  bridge: "wild-bridge", ford: "wild-bridge",
  stable: "trade-stable", healer: "trade-healer", apothecary: "trade-alchemist", alchemist: "trade-alchemist",
  herbalist: "trade-herbalist", "magic-shop": "trade-magic", "arcane-shop": "trade-magic",
  smithy: "trade-smith", tavern: "trade-tavern",
});

const WILD_SHRINE_TYPES = new Set(["temple", "shrine", "sanctuary", "monastery", "wayward-shrine", "wayside-shrine"]);

export function poiIconKeyForTile(tile, serviceIcon = null) {
  const poi = tile?.poi;
  if (!poi || poi.type === "hidden" || tile.terrain === "wall") return null;
  if (isPoiIcon(poi.mapIcon)) return poi.mapIcon;
  if (isPoiIcon(serviceIcon)) return serviceIcon;
  const type = `${poi.type || ""}`.toLowerCase();
  if (WILD_SHRINE_TYPES.has(type)) {
    const urban = !!tile.cityId || ["settlement", "street", "indoor", "plaza", "avenue", "roof"].includes(tile.terrain);
    return urban ? "trade-priest" : "wild-shrine";
  }
  return TYPE_ICON[type] || null;
}

export function poiIconKeyForLandmark(landmark) {
  if (!landmark) return null;
  if (isPoiIcon(landmark.mapIcon)) return landmark.mapIcon;
  if (landmark.capitalOfRealmId) return "poi-palace";
  const kind = `${landmark.kind || landmark.type || ""}`.toLowerCase();
  if (WILD_SHRINE_TYPES.has(kind)) return "wild-shrine";
  return TYPE_ICON[kind] || (landmark.role === "border-checkpoint" ? "wild-checkpoint" : null);
}
