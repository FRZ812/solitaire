// Pure model for the interactive world atlas: projection and camera math,
// landmark knowledge tiers, marker decluttering, and journey summaries.
//
// The atlas is a camera over the same axial world every travel tile uses.
// Nothing here mutates campaign state; the component renders these results and
// dispatches the same onPick/travel commands as the close-range map.

import {
  CONTINENT,
  CONTINENT_ROUTES,
  LANDMARKS,
  RARE_TRADE_HOUSES,
  REALMS,
} from "../../data/continent.js";
import { WORLD_MARCH_LIMIT } from "../../config.js";
import { WHITEMARCH_CAPITAL } from "../../data/whitemarch-capital.js";
import { checkpointAt, landmarkAt } from "../../engine/world-generation.js";
import { hexDistance, isSeen, isVisited, pathMinutes } from "../../engine/world.js";
import { pathRiskPercent } from "../../engine/encounters.js";
import { planAtlasJourney } from "./atlasModel.js";

export const SQRT_THREE_OVER_TWO = Math.sqrt(3) / 2;
// Compress the axial plane vertically into a continental oblique view. Keeping
// this in the projection itself means camera math and pointer picking share the
// exact same pitch.
export const ATLAS_OBLIQUE_PITCH = 0.76;

const CENTRAL_REALM = REALMS.find((realm) => realm.id === "central") || REALMS[0];

// One marker per authored continental landmark, plus the capital collapsed to a
// single entry. Whitemarch's internal wards stay in the close camera.
export const ATLAS_LANDMARKS = Object.freeze([
  Object.freeze({
    id: WHITEMARCH_CAPITAL.id,
    name: WHITEMARCH_CAPITAL.name,
    knowledge: "rumor",
    kind: "city",
    coord: WHITEMARCH_CAPITAL.center || WHITEMARCH_CAPITAL.start,
    regionId: "whitemarch",
    realmId: "central",
    capitalOfRealmId: "central",
    routeIds: ["crown-road-east", "tannic-road", "spine-road", "bramble-road", "south-road", "north-road"],
    description: CENTRAL_REALM?.description || "The walled capital at Avarra's inland crossroads.",
  }),
  ...LANDMARKS.map((landmark) => {
    const tradeHouse = RARE_TRADE_HOUSES[landmark.id];
    return tradeHouse
      ? Object.freeze({ ...landmark, marketTier: tradeHouse.marketTier, tradeHouseId: tradeHouse.id })
      : landmark;
  }),
]);

export const ATLAS_LAYERS = Object.freeze([
  Object.freeze({ id: "capitals", label: "Capitals", glyph: "♜" }),
  Object.freeze({ id: "settlements", label: "Towns", glyph: "⌂" }),
  Object.freeze({ id: "ports", label: "Ports", glyph: "⚓" }),
  Object.freeze({ id: "strongholds", label: "Forts", glyph: "▣" }),
  Object.freeze({ id: "sanctuaries", label: "Shrines", glyph: "✦" }),
  Object.freeze({ id: "lore", label: "Lore", glyph: "⌁" }),
]);

export const ATLAS_LANDMARK_GLYPHS = Object.freeze({
  city: "♜", fortress: "♜", fort: "♜", castle: "♜", checkpoint: "▣",
  town: "⌂", village: "⌂", tower: "△", temple: "✦", shrine: "✦",
  sanctuary: "✦", monastery: "✦", ruin: "⌁", wonder: "✧", landmark: "◆",
  lake: "◉", mountain: "▲", port: "⚓", road: "◇",
});

const LANDMARK_KIND_LABELS = Object.freeze({
  city: "City", fortress: "Fortress", fort: "Fort", castle: "Castle",
  checkpoint: "Military checkpoint", town: "Town", village: "Village",
  settlement: "Settlement", temple: "Temple", shrine: "Shrine",
  sanctuary: "Sanctuary", monastery: "Monastery", ruin: "Ruin",
  landmark: "Landmark", tower: "Tower", bridge: "Bridge", lake: "Lake",
  river: "River crossing", mountain: "Mountain", port: "Port",
  road: "Road waypoint", wonder: "Wonder",
});

export function atlasLandmarkLayer(landmark) {
  if (landmark.capitalOfRealmId) return "capitals";
  if (landmark.kind === "port") return "ports";
  if (landmark.role === "border-checkpoint" || ["fortress", "fort", "castle", "checkpoint"].includes(landmark.kind)) return "strongholds";
  if (["city", "town", "village", "settlement"].includes(landmark.kind)) return "settlements";
  if (["temple", "shrine", "sanctuary", "monastery"].includes(landmark.kind)) return "sanctuaries";
  return "lore";
}

export function atlasLandmarkTypeLabel(landmark) {
  if (!landmark) return "Unknown place";
  if (landmark.role === "border-checkpoint") return "Guarded border checkpoint";
  if (landmark.capitalOfRealmId) return "Realm capital";
  return LANDMARK_KIND_LABELS[landmark.kind] || "Point of interest";
}

export function atlasRoutesForLandmark(landmark) {
  const declaredRouteIds = new Set(landmark.routeIds || []);
  return CONTINENT_ROUTES.filter((route) => (
    declaredRouteIds.has(route.id)
    || route.checkpointIds?.includes(landmark.id)
    || route.waypoints?.some((waypoint) => (
      waypoint.x === landmark.coord.x && waypoint.y === landmark.coord.y
    ))
  ));
}

// ---- Projection and camera ----
//
// Pointy-top axial coordinates project onto a plane where adjacent hex centers
// are exactly one unit apart, so camera zoom reads as "pixels per travel hex".

export function projectAxial(x, y) {
  return { x: x + y * 0.5, y: y * SQRT_THREE_OVER_TWO * ATLAS_OBLIQUE_PITCH };
}

export function unprojectAxial(px, py) {
  const y = py / (SQRT_THREE_OVER_TWO * ATLAS_OBLIQUE_PITCH);
  return { x: px - y * 0.5, y };
}

export function axialRound(x, y) {
  const z = -x - y;
  let rx = Math.round(x);
  let ry = Math.round(y);
  const rz = Math.round(z);
  const dx = Math.abs(rx - x);
  const dy = Math.abs(ry - y);
  const dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  return { x: rx, y: ry };
}

const PROJECTED_CORNERS = [
  projectAxial(CONTINENT.bounds.xmin, CONTINENT.bounds.ymin),
  projectAxial(CONTINENT.bounds.xmin, CONTINENT.bounds.ymax),
  projectAxial(CONTINENT.bounds.xmax, CONTINENT.bounds.ymin),
  projectAxial(CONTINENT.bounds.xmax, CONTINENT.bounds.ymax),
];

export const PROJECTED_BOUNDS = Object.freeze({
  xmin: Math.min(...PROJECTED_CORNERS.map((corner) => corner.x)),
  xmax: Math.max(...PROJECTED_CORNERS.map((corner) => corner.x)),
  ymin: Math.min(...PROJECTED_CORNERS.map((corner) => corner.y)),
  ymax: Math.max(...PROJECTED_CORNERS.map((corner) => corner.y)),
});

export const ATLAS_MAX_ZOOM = 26;

// The smallest zoom keeps the whole charted continent inside the viewport.
export function atlasFitZoom(viewport) {
  const width = Math.max(1, viewport?.width || 1);
  const height = Math.max(1, viewport?.height || 1);
  return Math.min(
    width / (PROJECTED_BOUNDS.xmax - PROJECTED_BOUNDS.xmin),
    height / (PROJECTED_BOUNDS.ymax - PROJECTED_BOUNDS.ymin),
  );
}

function clampAxis(center, viewLength, min, max) {
  if (max - min <= viewLength) return (min + max) / 2;
  const half = viewLength / 2;
  return Math.min(max - half, Math.max(min + half, center));
}

export function clampAtlasCamera(camera, viewport) {
  const fit = atlasFitZoom(viewport);
  const zoom = Math.min(ATLAS_MAX_ZOOM, Math.max(fit, camera.zoom));
  return {
    zoom,
    x: clampAxis(camera.x, viewport.width / zoom, PROJECTED_BOUNDS.xmin, PROJECTED_BOUNDS.xmax),
    y: clampAxis(camera.y, viewport.height / zoom, PROJECTED_BOUNDS.ymin, PROJECTED_BOUNDS.ymax),
  };
}

export function atlasWorldToScreen(camera, viewport, coord) {
  const projected = projectAxial(coord.x, coord.y);
  return {
    x: (projected.x - camera.x) * camera.zoom + viewport.width / 2,
    y: (projected.y - camera.y) * camera.zoom + viewport.height / 2,
  };
}

// Returns fractional axial coordinates; round with axialRound for a tile.
export function atlasScreenToWorld(camera, viewport, point) {
  const projected = {
    x: (point.x - viewport.width / 2) / camera.zoom + camera.x,
    y: (point.y - viewport.height / 2) / camera.zoom + camera.y,
  };
  return unprojectAxial(projected.x, projected.y);
}

export function panAtlasCamera(camera, viewport, dxPx, dyPx) {
  return clampAtlasCamera({
    ...camera,
    x: camera.x - dxPx / camera.zoom,
    y: camera.y - dyPx / camera.zoom,
  }, viewport);
}

// Zoom toward an anchor point in screen space so the ground under the cursor
// (or pinch midpoint) stays put.
export function zoomAtlasCamera(camera, viewport, factor, anchor = null) {
  const fit = atlasFitZoom(viewport);
  const zoom = Math.min(ATLAS_MAX_ZOOM, Math.max(fit, camera.zoom * factor));
  if (zoom === camera.zoom) return clampAtlasCamera(camera, viewport);
  const point = anchor || { x: viewport.width / 2, y: viewport.height / 2 };
  const before = {
    x: (point.x - viewport.width / 2) / camera.zoom + camera.x,
    y: (point.y - viewport.height / 2) / camera.zoom + camera.y,
  };
  const after = {
    x: (point.x - viewport.width / 2) / zoom + camera.x,
    y: (point.y - viewport.height / 2) / zoom + camera.y,
  };
  return clampAtlasCamera({
    zoom,
    x: camera.x + before.x - after.x,
    y: camera.y + before.y - after.y,
  }, viewport);
}

export function centerAtlasCamera(camera, viewport, coord, zoom = null) {
  const projected = projectAxial(coord.x, coord.y);
  return clampAtlasCamera({
    x: projected.x,
    y: projected.y,
    zoom: zoom ?? camera.zoom,
  }, viewport);
}

// ---- Marker decluttering ----
//
// Zoomed to the whole continent only the campaign-scale anchors show; regional
// zoom reveals towns and forts; local zoom reveals shrines, ruins, and lore.
// This replaces the old fixed-pixel marker nudges.

export function markerZoomTier(landmark) {
  const layer = atlasLandmarkLayer(landmark);
  if (layer === "capitals" || layer === "ports" || landmark.role === "border-checkpoint") return 0;
  if (layer === "settlements" || layer === "strongholds") return 1;
  return 2;
}

export function atlasMarkerVisible(landmark, {
  zoomRatio,
  visibleLayers,
  focusedRealmId,
  selectedLandmarkId,
}) {
  if (landmark.id === selectedLandmarkId) return true;
  const layer = atlasLandmarkLayer(landmark);
  if (visibleLayers && !visibleLayers.has(layer)) return false;
  if (focusedRealmId && landmark.realmId !== focusedRealmId && markerZoomTier(landmark) > 0) return false;
  const tier = markerZoomTier(landmark);
  if (tier === 1) return zoomRatio >= 1.5;
  if (tier === 2) return zoomRatio >= 2.8;
  return true;
}

// ---- Campaign knowledge ----
//
// Landmarks are lore-known (reputation or legend) before travel, but the atlas
// distinguishes what the party has actually reached or sighted.

export function landmarkKnowledge(state, landmark) {
  if (state && isVisited(state, landmark.coord.x, landmark.coord.y)) return "charted";
  if (state && isSeen(state, landmark.coord.x, landmark.coord.y)) return "sighted";
  return landmark.knowledge === "legend" ? "legend" : "reputation";
}

export const ATLAS_KNOWLEDGE_LABELS = Object.freeze({
  charted: "Charted — the party has stood here",
  sighted: "Sighted from the road",
  reputation: "Known by reputation",
  legend: "Known from legend",
});

export function buildAtlasLandmarks(state, origin) {
  const quests = (state?.world?.quests || []).filter((quest) => quest.status === "active" && quest.loc);
  return ATLAS_LANDMARKS.map((landmark) => {
    const knowledge = landmarkKnowledge(state, landmark);
    const quest = quests.find((entry) => entry.loc.x === landmark.coord.x && entry.loc.y === landmark.coord.y) || null;
    return {
      ...landmark,
      knowledgeTier: knowledge,
      quest,
      distance: origin ? hexDistance(origin, landmark.coord) : null,
    };
  });
}

export function atlasQuestMarkers(state) {
  const landmarkKeys = new Set(ATLAS_LANDMARKS.map((landmark) => `${landmark.coord.x},${landmark.coord.y}`));
  return (state?.world?.quests || [])
    .filter((quest) => quest.status === "active" && quest.loc)
    .filter((quest) => !landmarkKeys.has(`${quest.loc.x},${quest.loc.y}`))
    .map((quest) => ({ id: quest.id, title: quest.title, coord: { x: quest.loc.x, y: quest.loc.y } }));
}

export function initialAtlasSelection(coord, landmarks = ATLAS_LANDMARKS) {
  const landmark = landmarks.find((entry) => (
    entry.coord.x === coord.x && entry.coord.y === coord.y
  ));
  if (landmark) return { kind: "landmark", id: landmark.id };
  return { kind: "point", x: coord.x, y: coord.y };
}

// ---- Journey summaries ----

export function formatTravelDuration(minutes) {
  const total = Math.max(0, Math.round(minutes || 0));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours < 24) return rest ? `${hours} h ${rest} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  const dayRest = hours % 24;
  return dayRest ? `${days} d ${dayRest} h` : `${days} d`;
}

// Named places the route passes through, from authored data lookups only —
// no tile generation, so this stays cheap even for thousand-hex journeys.
export function journeyWaypoints(path, { cap = 5, skipEndpoints = true } = {}) {
  if (!path || path.length < 2) return [];
  const names = [];
  const seenIds = new Set();
  const start = skipEndpoints ? 1 : 0;
  const end = skipEndpoints ? path.length - 1 : path.length;
  for (let index = start; index < end; index++) {
    const cell = path[index];
    const landmark = landmarkAt(cell.x, cell.y);
    if (!landmark || seenIds.has(landmark.id)) continue;
    seenIds.add(landmark.id);
    names.push({ id: landmark.id, name: landmark.name, kind: landmark.kind, index });
    if (names.length >= cap) break;
  }
  return names;
}

export function journeyCheckpoints(path) {
  if (!path || path.length < 2) return [];
  const seenIds = new Set();
  const out = [];
  for (const cell of path) {
    const checkpoint = checkpointAt(cell.x, cell.y);
    if (!checkpoint || seenIds.has(checkpoint.id)) continue;
    seenIds.add(checkpoint.id);
    out.push({ id: checkpoint.id, name: checkpoint.name });
  }
  return out;
}

// Interior endpoints where the party pauses and reassesses a long route.
// Excluding the final destination keeps single-leg routes marker-free and
// avoids stacking a break marker under the destination pin.
export function journeyLegBreaks(path, legSteps, cap = 8) {
  if (!path || path.length < 2 || !Number.isFinite(legSteps) || legSteps <= 0) return [];
  const step = Math.floor(legSteps);
  if (step < 1) return [];
  const limit = Math.max(0, Math.floor(cap));
  const breaks = [];
  for (let index = step; index < path.length - 1 && breaks.length < limit; index += step) {
    const coord = path[index];
    breaks.push({ x: coord.x, y: coord.y, index });
  }
  return breaks;
}

// One summary object for the atlas detail panel. Uses the same route planner
// as actual travel, so the preview and the march never disagree. The march
// itself still resolves in legs with per-step encounter rolls.
export function summarizeAtlasJourney(state, destination, maxLeg = WORLD_MARCH_LIMIT) {
  if (!state || !destination) return null;
  const origin = state.world.currentTile;
  if (origin.x === destination.x && origin.y === destination.y) return null;
  const journey = planAtlasJourney(state, destination, maxLeg);
  if (!journey) return null;
  const legMinutes = pathMinutes(state, journey.legPath);
  const estimatedMinutes = pathMinutes(state, journey.fullPath);
  return {
    ...journey,
    origin,
    legMinutes,
    estimatedMinutes,
    duration: formatTravelDuration(estimatedMinutes),
    legDuration: formatTravelDuration(legMinutes),
    kilometers: journey.totalSteps * (CONTINENT.hexKilometers || 6),
    risk: pathRiskPercent(state, journey.legPath),
    waypoints: journeyWaypoints(journey.fullPath),
    checkpoints: journeyCheckpoints(journey.fullPath),
  };
}
