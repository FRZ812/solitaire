import {
  COASTAL_FEATURES,
  CONTINENT,
  CONTINENT_HOT_SPRINGS,
  CONTINENT_LAKES,
  CONTINENT_ROUTES,
  CONTINENT_SEA_LANES,
  CONTINENT_WATERWAYS,
  LANDMARK_DESTINATION_SERVICES,
  LANDMARKS,
  MOUNTAIN_SPINE,
  NORTHERN_RIDGES,
  PROVINCES,
  RARE_TRADE_HOUSES,
  REALM_FACTIONS,
  REALMS,
} from "../../data/continent.js";
import { buildingForTile } from "../../data/town.js";
import { getTile } from "../../engine/world.js";

const SQRT_3_OVER_2 = Math.sqrt(3) / 2;
const MAP_PADDING = 46;
const MIN_OVERVIEW_ZOOM = 1;
const MAX_OVERVIEW_ZOOM = 4.5;

export const WORLD_OVERVIEW_VIEWBOX = Object.freeze({
  x: 0,
  y: 0,
  width: 1200,
  height: 780,
});

const REALM_VISUALS = Object.freeze({
  central: Object.freeze({ fill: "#8e956c", accent: "#e5c171", glyph: "♜" }),
  north: Object.freeze({ fill: "#7895aa", accent: "#cfe9ff", glyph: "✦" }),
  east: Object.freeze({ fill: "#5f9a78", accent: "#9ce0b0", glyph: "◇" }),
  south: Object.freeze({ fill: "#b8824d", accent: "#ffd38a", glyph: "☼" }),
  west: Object.freeze({ fill: "#416f55", accent: "#a8daa8", glyph: "❧" }),
});

const SACRED_KINDS = new Set(["monastery", "sanctuary", "shrine", "temple"]);
const SETTLEMENT_KINDS = new Set(["city", "town", "village", "port"]);
const MYSTERY_KINDS = new Set(["ruin", "wonder", "lake", "tower"]);

function axialProjection(coord) {
  return {
    x: coord.x + coord.y / 2,
    y: coord.y * SQRT_3_OVER_2,
  };
}

const projectedCoastline = CONTINENT.coastline.map(axialProjection);
const rawBounds = projectedCoastline.reduce((bounds, point) => ({
  minX: Math.min(bounds.minX, point.x),
  maxX: Math.max(bounds.maxX, point.x),
  minY: Math.min(bounds.minY, point.y),
  maxY: Math.max(bounds.maxY, point.y),
}), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
const rawCenter = {
  x: (rawBounds.minX + rawBounds.maxX) / 2,
  y: (rawBounds.minY + rawBounds.maxY) / 2,
};
const projectionScale = Math.min(
  (WORLD_OVERVIEW_VIEWBOX.width - MAP_PADDING * 2) / (rawBounds.maxX - rawBounds.minX),
  (WORLD_OVERVIEW_VIEWBOX.height - MAP_PADDING * 2) / (rawBounds.maxY - rawBounds.minY),
);

export function projectWorldOverviewCoord(coord) {
  const raw = axialProjection(coord);
  return {
    x: WORLD_OVERVIEW_VIEWBOX.width / 2 + (raw.x - rawCenter.x) * projectionScale,
    y: WORLD_OVERVIEW_VIEWBOX.height / 2 + (raw.y - rawCenter.y) * projectionScale,
  };
}

function projectPath(points = []) {
  return points.map(projectWorldOverviewCoord);
}

function coordKey(coord) {
  return `${coord.x},${coord.y}`;
}

function hexDistance(a, b) {
  const x = a.x - b.x;
  const y = a.y - b.y;
  return (Math.abs(x) + Math.abs(y) + Math.abs(x + y)) / 2;
}

function placeCategory(place) {
  if (SETTLEMENT_KINDS.has(place.kind)) return "settlements";
  if (place.kind === "fortress") return "strongholds";
  if (SACRED_KINDS.has(place.kind)) return "sacred";
  if (MYSTERY_KINDS.has(place.kind)) return "mysteries";
  return "wilds";
}

function resolvedServiceInterests(state, place) {
  const service = LANDMARK_DESTINATION_SERVICES[place.id] || RARE_TRADE_HOUSES[place.id];
  if (!service || !place.coord) return [];
  const tile = getTile(state, place.coord.x, place.coord.y);
  const building = buildingForTile(tile);
  const resolvesDeclaredService = tile?.poi?.landmarkId === place.id
    && tile.poi.service === service.service
    && building?.locationId === service.id;
  if (!resolvesDeclaredService) return [];
  if (service.activities) return [...service.activities];
  return [
    service.marketTier === "mastercraft" ? "Legendary craft" : "Royal trade",
    "Rare equipment",
  ];
}

function placeFacts(place) {
  if (place.kind === "hot-spring") return ["Thermal pools", "Mineral terraces", "Remote wilderness"];
  if (place.kind === "port") return ["Coastal settlement", "Sea-lane terminus", "Harbor authority"];
  if (place.kind === "city") return ["Regional capital", "Faction seat", "Road nexus"];
  if (place.kind === "town") return ["Larger settlement", "Local authority", "Built approaches"];
  if (place.kind === "village") return ["Small settlement", "Rural district", "Local authority"];
  if (place.kind === "fortress") return ["Fortified site", "Military authority", "Border position"];
  if (place.kind === "ruin") return ["Ancient ruins", "Abandoned works", "Unsettled ground"];
  if (place.kind === "wonder") return ["Natural wonder", "Regional landmark", "Unsettled ground"];
  if (place.kind === "tower") return ["Standing tower", "Elevated landmark", "Authored site"];
  if (place.kind === "lake") return ["Inland water", "Natural landmark", "Remote shore"];
  if (SACRED_KINDS.has(place.kind)) return ["Sacred site", "Regional faith", "Religious authority"];
  return ["Named landmark", "Regional feature"];
}

function placeInterests(state, place) {
  return [...new Set([
    ...resolvedServiceInterests(state, place),
    ...placeFacts(place),
  ])].slice(0, 4);
}

function publicWhitemarchPlace() {
  const central = REALMS.find((realm) => realm.id === "central");
  return {
    id: "whitemarch",
    name: central.capital.name,
    knowledge: "charted",
    kind: "city",
    role: "realm-capital",
    coord: { ...central.capital.coord },
    realmId: central.id,
    provinceId: "crown-basin",
    factionId: central.faction.id,
    routeIds: CONTINENT_ROUTES
      .filter((route) => route.waypoints.some((waypoint) => coordKey(waypoint) === coordKey(central.capital.coord)))
      .map((route) => route.id),
    capitalOfRealmId: central.id,
    description: "Avarra's inland crossroads and the party's current city: a walled capital of markets, wards, quays, temples, guilds, and six outward roads.",
  };
}

function mappedKnowledge(state, coord) {
  const key = coordKey(coord);
  const current = state.world?.currentTile;
  const here = current?.x === coord.x && current?.y === coord.y;
  return {
    charted: here || state.world?.seen?.[key] === true || !!state.world?.tiles?.[key],
    visited: here || !!state.world?.tiles?.[key],
    current: here,
  };
}

function placeEntry(state, place, routeById, provinceById, factionById, realmById) {
  const knowledge = mappedKnowledge(state, place.coord);
  const realm = realmById.get(place.realmId) || null;
  const province = provinceById.get(place.provinceId)
    || PROVINCES.find((entry) => entry.seatLandmarkId === place.id)
    || null;
  const factionId = place.factionId
    || place.controllingFactionId
    || province?.authorityFactionId
    || realm?.faction?.id;
  const faction = factionById.get(factionId) || null;
  const routeIds = place.routeIds || CONTINENT_ROUTES
    .filter((route) => route.waypoints.some((waypoint) => coordKey(waypoint) === coordKey(place.coord)))
    .map((route) => route.id);
  const party = state.world?.currentTile || CONTINENT.start.coord;
  const distanceHexes = hexDistance(party, place.coord);
  return {
    ...place,
    point: projectWorldOverviewCoord(place.coord),
    category: placeCategory(place),
    interests: placeInterests(state, place),
    capital: !!place.capitalOfRealmId,
    major: !!place.capitalOfRealmId
      || place.kind === "port"
      || place.kind === "wonder"
      || place.role === "provincial-seat"
      || place.role === "faction-seat",
    charted: knowledge.charted,
    visited: knowledge.visited,
    current: knowledge.current,
    knownBy: knowledge.charted
      ? "charted"
      : place.knowledge === "rumor" ? "reputation" : "legend",
    realmName: realm?.shortName || realm?.name || null,
    provinceName: province?.name || null,
    factionName: faction?.name || realm?.faction?.name || null,
    routeNames: routeIds.map((id) => routeById.get(id)?.name).filter(Boolean),
    distanceHexes,
    distanceKilometers: distanceHexes * (CONTINENT.hexKilometers || 6),
    visual: REALM_VISUALS[place.realmId] || REALM_VISUALS.central,
  };
}

export function buildWorldOverviewModel(state) {
  const routeById = new Map(CONTINENT_ROUTES.map((route) => [route.id, route]));
  const provinceById = new Map(PROVINCES.map((province) => [province.id, province]));
  const factionById = new Map(REALM_FACTIONS.map((faction) => [faction.id, faction]));
  const realmById = new Map(REALMS.map((realm) => [realm.id, realm]));
  const hotSpringPlaces = CONTINENT_HOT_SPRINGS.map((spring) => ({
    ...spring,
    coord: spring.center,
    kind: "hot-spring",
    role: "natural-destination",
    knowledge: "fabled",
    realmId: "east",
    provinceId: spring.id === "jade-springs" ? "starfall-uplands" : "tellmar-delta",
  }));
  const places = [publicWhitemarchPlace(), ...LANDMARKS, ...hotSpringPlaces]
    .filter((place, index, all) => all.findIndex((candidate) => candidate.id === place.id) === index)
    .map((place) => placeEntry(state, place, routeById, provinceById, factionById, realmById));

  return {
    bounds: WORLD_OVERVIEW_VIEWBOX,
    coastline: projectPath(CONTINENT.coastline),
    realms: REALMS.map((realm) => ({
      ...realm,
      point: projectWorldOverviewCoord(realm.center),
      radiusX: realm.influence.scaleX * projectionScale,
      radiusY: realm.influence.scaleY * SQRT_3_OVER_2 * projectionScale,
      visual: REALM_VISUALS[realm.id],
      placeCount: places.filter((place) => place.realmId === realm.id).length,
      chartedCount: places.filter((place) => place.realmId === realm.id && place.charted).length,
    })),
    provinces: PROVINCES.map((province) => ({
      ...province,
      point: projectWorldOverviewCoord(province.anchor),
    })),
    routes: CONTINENT_ROUTES.map((route) => ({ ...route, points: projectPath(route.waypoints) })),
    waterways: CONTINENT_WATERWAYS.map((waterway) => ({ ...waterway, points: projectPath(waterway.waypoints) })),
    lakes: CONTINENT_LAKES.map((lake) => ({
      ...lake,
      point: projectWorldOverviewCoord(lake.center),
      radius: Math.max(2.5, lake.radius * projectionScale),
    })),
    hotSprings: CONTINENT_HOT_SPRINGS.map((spring) => ({
      ...spring,
      point: projectWorldOverviewCoord(spring.center),
    })),
    coastalFeatures: COASTAL_FEATURES.map((feature) => ({
      ...feature,
      point: projectWorldOverviewCoord(feature.coord),
    })),
    seaLanes: CONTINENT_SEA_LANES.map((lane) => ({ ...lane, points: projectPath(lane.waypoints) })),
    mountainSpine: { ...MOUNTAIN_SPINE, points: projectPath(MOUNTAIN_SPINE.waypoints) },
    northernRidges: NORTHERN_RIDGES.map((ridge) => ({ ...ridge, points: projectPath(ridge.waypoints) })),
    places,
    party: {
      coord: { ...(state.world?.currentTile || CONTINENT.start.coord) },
      point: projectWorldOverviewCoord(state.world?.currentTile || CONTINENT.start.coord),
    },
  };
}

export function overviewDestinationTarget(place) {
  if (!place?.coord || !Number.isFinite(place.coord.x) || !Number.isFinite(place.coord.y)) return null;
  if (!["legend", "reputation", "charted"].includes(place.knownBy)) return null;
  return {
    x: place.coord.x,
    y: place.coord.y,
    name: place.name,
    knownBy: place.knownBy,
    landmarkId: place.id,
  };
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function clampWorldOverviewCamera(camera = {}) {
  const zoom = clamp(Number(camera.zoom) || 1, MIN_OVERVIEW_ZOOM, MAX_OVERVIEW_ZOOM);
  const halfWidth = WORLD_OVERVIEW_VIEWBOX.width / (zoom * 2);
  const halfHeight = WORLD_OVERVIEW_VIEWBOX.height / (zoom * 2);
  return {
    x: clamp(Number(camera.x) || WORLD_OVERVIEW_VIEWBOX.width / 2, halfWidth, WORLD_OVERVIEW_VIEWBOX.width - halfWidth),
    y: clamp(Number(camera.y) || WORLD_OVERVIEW_VIEWBOX.height / 2, halfHeight, WORLD_OVERVIEW_VIEWBOX.height - halfHeight),
    zoom,
  };
}

export function overviewCameraViewBox(camera = {}) {
  const next = clampWorldOverviewCamera(camera);
  const width = WORLD_OVERVIEW_VIEWBOX.width / next.zoom;
  const height = WORLD_OVERVIEW_VIEWBOX.height / next.zoom;
  return {
    x: next.x - width / 2,
    y: next.y - height / 2,
    width,
    height,
  };
}

export function overviewCameraForRealm(realm) {
  return clampWorldOverviewCamera({
    x: realm?.point?.x ?? WORLD_OVERVIEW_VIEWBOX.width / 2,
    y: realm?.point?.y ?? WORLD_OVERVIEW_VIEWBOX.height / 2,
    zoom: 2.15,
  });
}

export function zoomWorldOverviewCamera(camera, factor) {
  const current = clampWorldOverviewCamera(camera);
  return clampWorldOverviewCamera({
    ...current,
    zoom: current.zoom * (Number.isFinite(factor) && factor > 0 ? factor : 1),
  });
}

export function panWorldOverviewCamera(camera, delta = {}) {
  const current = clampWorldOverviewCamera(camera);
  return clampWorldOverviewCamera({
    ...current,
    x: current.x + (Number(delta.x) || 0),
    y: current.y + (Number(delta.y) || 0),
  });
}
