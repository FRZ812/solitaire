// Pure presentation model for the parchment atlas. The application keeps one
// camera whose x/y values are axial world coordinates; this module converts
// that shared camera to worldAtlasModel's projected affine space internally.

import {
  CONTINENT,
  CONTINENT_ROUTES,
  CONTINENT_WATERWAYS,
  REALMS,
} from "../../data/continent.js";
import {
  ATLAS_LANDMARK_GLYPHS,
  PROJECTED_BOUNDS,
  atlasFitZoom,
  atlasMarkerVisible,
  atlasScreenToWorld,
  atlasWorldToScreen,
  axialRound,
  centerAtlasCamera,
  clampAtlasCamera,
  panAtlasCamera,
  projectAxial,
  unprojectAxial,
  zoomAtlasCamera,
} from "./worldAtlasModel.js";

export const ATLAS_PAPER_BASE_WIDTH = 2048;
export const ATLAS_PAPER_BASE_HEIGHT = 1536;

export const ATLAS_PAPER_PALETTE = Object.freeze({
  parchment: "#d6bd87",
  parchmentLight: "#ead8aa",
  parchmentDark: "#a9824f",
  ocean: "#496d73",
  oceanDeep: "#1d414a",
  oceanInk: "#253f42",
  ink: "#392e21",
  inkSoft: "rgba(57, 46, 33, 0.48)",
  route: "#855b34",
  routeHighlight: "#c49a5b",
  river: "#426f78",
  riverHighlight: "#82a7a5",
  journey: "#f2c45f",
  journeyContinuation: "rgba(75, 53, 34, 0.72)",
  selection: "#fff0a0",
  party: "#248f98",
  partyLight: "#76d2c6",
  quest: "#f2d469",
  realms: Object.freeze({
    central: "rgba(139, 143, 82, 0.34)",
    north: "rgba(151, 171, 172, 0.38)",
    east: "rgba(96, 139, 94, 0.34)",
    south: "rgba(190, 132, 70, 0.38)",
    west: "rgba(64, 105, 65, 0.42)",
  }),
});

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeViewport(viewport) {
  return {
    width: Math.max(1, finite(viewport?.width, 1)),
    height: Math.max(1, finite(viewport?.height, 1)),
  };
}

export function normalizeAtlasPaperPixelRatio(pixelRatio = 1) {
  return Math.round(Math.max(1, Math.min(2, finite(pixelRatio, 1))) * 100) / 100;
}

export function atlasPaperBaseKey(seed = CONTINENT.seed, pixelRatio = 1) {
  return `${String(seed || CONTINENT.seed)}|${normalizeAtlasPaperPixelRatio(pixelRatio).toFixed(2)}`;
}

// worldAtlasModel's affine helpers expect x/y to already be projected. This is
// the boundary that lets WorldAtlas retain one axial-center camera in both 3D
// and paper modes.
export function atlasPaperProjectedCamera(camera) {
  const center = projectAxial(finite(camera?.x), finite(camera?.y));
  return {
    ...camera,
    x: center.x,
    y: center.y,
    zoom: Math.max(0.0001, finite(camera?.zoom, 1)),
  };
}

export function atlasPaperAxialCamera(projectedCamera) {
  const center = unprojectAxial(finite(projectedCamera?.x), finite(projectedCamera?.y));
  return {
    ...projectedCamera,
    x: center.x,
    y: center.y,
    zoom: Math.max(0.0001, finite(projectedCamera?.zoom, 1)),
  };
}

export function clampAtlasPaperCamera(camera, viewport) {
  return atlasPaperAxialCamera(clampAtlasCamera(
    atlasPaperProjectedCamera(camera),
    normalizeViewport(viewport),
  ));
}

export function panAtlasPaperCamera(camera, viewport, dxPx, dyPx) {
  return atlasPaperAxialCamera(panAtlasCamera(
    atlasPaperProjectedCamera(camera),
    normalizeViewport(viewport),
    dxPx,
    dyPx,
  ));
}

export function zoomAtlasPaperCamera(camera, viewport, factor, anchor = null) {
  return atlasPaperAxialCamera(zoomAtlasCamera(
    atlasPaperProjectedCamera(camera),
    normalizeViewport(viewport),
    factor,
    anchor,
  ));
}

export function centerAtlasPaperCamera(camera, viewport, coord, zoom = null) {
  return atlasPaperAxialCamera(centerAtlasCamera(
    atlasPaperProjectedCamera(camera),
    normalizeViewport(viewport),
    coord,
    zoom,
  ));
}

export function fitAtlasPaperCamera(camera, viewport) {
  const safeViewport = normalizeViewport(viewport);
  const projected = clampAtlasCamera({
    ...atlasPaperProjectedCamera(camera),
    x: (PROJECTED_BOUNDS.xmin + PROJECTED_BOUNDS.xmax) / 2,
    y: (PROJECTED_BOUNDS.ymin + PROJECTED_BOUNDS.ymax) / 2,
    zoom: atlasFitZoom(safeViewport),
  }, safeViewport);
  return atlasPaperAxialCamera(projected);
}

export function atlasPaperWorldToScreen(camera, viewport, coord) {
  return atlasWorldToScreen(
    atlasPaperProjectedCamera(camera),
    normalizeViewport(viewport),
    coord,
  );
}

export function atlasPaperPickFractional(camera, viewport, point) {
  return atlasScreenToWorld(
    atlasPaperProjectedCamera(camera),
    normalizeViewport(viewport),
    point,
  );
}

export function atlasPaperPick(camera, viewport, point) {
  const coord = atlasPaperPickFractional(camera, viewport, point);
  return axialRound(coord.x, coord.y);
}

export function atlasPaperBaseLayout(
  width = ATLAS_PAPER_BASE_WIDTH,
  height = ATLAS_PAPER_BASE_HEIGHT,
) {
  const safeWidth = Math.max(1, Math.round(finite(width, ATLAS_PAPER_BASE_WIDTH)));
  const safeHeight = Math.max(1, Math.round(finite(height, ATLAS_PAPER_BASE_HEIGHT)));
  const padding = Math.min(safeWidth, safeHeight) * 0.055;
  const projectedWidth = PROJECTED_BOUNDS.xmax - PROJECTED_BOUNDS.xmin;
  const projectedHeight = PROJECTED_BOUNDS.ymax - PROJECTED_BOUNDS.ymin;
  const scale = Math.min(
    (safeWidth - padding * 2) / projectedWidth,
    (safeHeight - padding * 2) / projectedHeight,
  );
  return Object.freeze({
    width: safeWidth,
    height: safeHeight,
    scale,
    offsetX: (safeWidth - projectedWidth * scale) / 2,
    offsetY: (safeHeight - projectedHeight * scale) / 2,
    projectedBounds: PROJECTED_BOUNDS,
  });
}

export function atlasPaperBasePoint(coord, layout = atlasPaperBaseLayout()) {
  const projected = projectAxial(coord.x, coord.y);
  return {
    x: layout.offsetX + (projected.x - PROJECTED_BOUNDS.xmin) * layout.scale,
    y: layout.offsetY + (projected.y - PROJECTED_BOUNDS.ymin) * layout.scale,
  };
}

function hashSeed(value) {
  const text = String(value || CONTINENT.seed);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicStream(seed) {
  let state = hashSeed(seed) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function mapPath(path, layout) {
  return (path || []).map((coord) => atlasPaperBasePoint(coord, layout));
}

export function buildAtlasPaperBaseModel(seed = CONTINENT.seed, {
  width = ATLAS_PAPER_BASE_WIDTH,
  height = ATLAS_PAPER_BASE_HEIGHT,
  pixelRatio = 1,
} = {}) {
  const layout = atlasPaperBaseLayout(width, height);
  const random = deterministicStream(`${seed}|paper-wash|${normalizeAtlasPaperPixelRatio(pixelRatio)}`);
  const washCount = Math.max(180, Math.round(layout.width * layout.height / 5200));
  const fiberCount = Math.max(72, Math.round(layout.width / 10));
  const wash = Array.from({ length: washCount }, (_, index) => ({
    x: random() * layout.width,
    y: random() * layout.height,
    radiusX: 3 + random() * 25,
    radiusY: 1 + random() * 8,
    rotation: random() * Math.PI,
    alpha: 0.012 + random() * 0.034,
    light: index % 3 === 0,
  }));
  const fibers = Array.from({ length: fiberCount }, () => {
    const x = random() * layout.width;
    const y = random() * layout.height;
    return {
      x,
      y,
      dx: 18 + random() * 90,
      dy: (random() - 0.5) * 8,
      alpha: 0.018 + random() * 0.028,
    };
  });
  const realms = REALMS.map((realm) => {
    const center = atlasPaperBasePoint(realm.center, layout);
    const xEdge = atlasPaperBasePoint({
      x: realm.center.x + realm.influence.scaleX,
      y: realm.center.y,
    }, layout);
    const yEdge = atlasPaperBasePoint({
      x: realm.center.x,
      y: realm.center.y + realm.influence.scaleY,
    }, layout);
    return {
      id: realm.id,
      name: realm.shortName || realm.name,
      center,
      radius: Math.max(
        Math.hypot(xEdge.x - center.x, xEdge.y - center.y),
        Math.hypot(yEdge.x - center.x, yEdge.y - center.y),
      ) * 1.15,
      color: ATLAS_PAPER_PALETTE.realms[realm.id] || ATLAS_PAPER_PALETTE.realms.central,
    };
  });

  return {
    key: atlasPaperBaseKey(seed, pixelRatio),
    seed,
    pixelRatio: normalizeAtlasPaperPixelRatio(pixelRatio),
    layout,
    wash,
    fibers,
    coastline: mapPath(CONTINENT.coastline, layout),
    realms,
    routes: CONTINENT_ROUTES.map((route) => ({
      id: route.id,
      regional: route.kind === "regional-road",
      points: mapPath(route.waypoints, layout),
    })),
    waterways: CONTINENT_WATERWAYS.map((waterway) => ({
      id: waterway.id,
      points: mapPath(waterway.waypoints, layout),
      widthStart: waterway.widthStart || 1,
      widthEnd: waterway.widthEnd || waterway.widthStart || 1,
    })),
    labels: realms.map((realm) => ({
      id: realm.id,
      text: realm.name,
      point: realm.center,
    })),
  };
}

export function atlasPaperBasePlacement(baseModel, camera, viewport) {
  const safeViewport = normalizeViewport(viewport);
  const projectedCamera = atlasPaperProjectedCamera(camera);
  const layout = baseModel.layout;
  const center = {
    x: layout.offsetX + (projectedCamera.x - PROJECTED_BOUNDS.xmin) * layout.scale,
    y: layout.offsetY + (projectedCamera.y - PROJECTED_BOUNDS.ymin) * layout.scale,
  };
  const scale = projectedCamera.zoom / layout.scale;
  return {
    x: safeViewport.width / 2 - center.x * scale,
    y: safeViewport.height / 2 - center.y * scale,
    width: layout.width * scale,
    height: layout.height * scale,
    scale,
  };
}

function selectionCoord(selection, landmarks) {
  if (!selection) return null;
  if (selection.coord) return selection.coord;
  if (selection.kind === "landmark") {
    return landmarks.find((landmark) => landmark.id === selection.id)?.coord || null;
  }
  if (Number.isFinite(selection.x) && Number.isFinite(selection.y)) {
    return { x: selection.x, y: selection.y };
  }
  return null;
}

export function sampleAtlasPaperPath(path, cap = 900) {
  if (!Array.isArray(path) || path.length === 0) return [];
  const safeCap = Math.max(2, Math.floor(cap));
  if (path.length <= safeCap) return path.map((coord) => ({ x: coord.x, y: coord.y }));
  const sampled = [];
  for (let index = 0; index < safeCap; index += 1) {
    const sourceIndex = Math.round(index * (path.length - 1) / (safeCap - 1));
    const coord = path[sourceIndex];
    const previous = sampled[sampled.length - 1];
    if (!previous || previous.x !== coord.x || previous.y !== coord.y) {
      sampled.push({ x: coord.x, y: coord.y });
    }
  }
  return sampled;
}

export function atlasPaperMarkerVisible(landmark, {
  zoomRatio,
  viewportWidth,
  visibleLayers = null,
  focusedRealmId = null,
  selectedLandmarkId = null,
} = {}) {
  const selected = landmark?.id === selectedLandmarkId;
  const priorityMarker = !!(
    landmark?.capitalOfRealmId
    || landmark?.kind === "port"
    || landmark?.role === "border-checkpoint"
    || landmark?.quest
    || selected
  );
  const compactDeclutter = Number(viewportWidth) < 560 && Number(zoomRatio) < 2.8;
  return (atlasMarkerVisible(landmark, {
    zoomRatio,
    visibleLayers,
    focusedRealmId,
    selectedLandmarkId,
  }) && (!compactDeclutter || priorityMarker)) || !!landmark?.quest;
}

function screenPath(path, camera, viewport) {
  return sampleAtlasPaperPath(path).map((coord) => atlasPaperWorldToScreen(camera, viewport, coord));
}

export function buildAtlasPaperDynamicModel({
  camera,
  viewport,
  landmarks = [],
  partyCoord = null,
  journey = null,
  journeyBreaks = [],
  selection = null,
  questMarkers = [],
  visibleLayers = null,
  focusedRealmId = null,
} = {}) {
  const safeViewport = normalizeViewport(viewport);
  const safeCamera = camera || fitAtlasPaperCamera({ x: 0, y: 0, zoom: 1 }, safeViewport);
  const selectedLandmarkId = selection?.kind === "landmark" ? selection.id : null;
  const selectedCoord = selectionCoord(selection, landmarks);
  const zoomRatio = safeCamera.zoom / atlasFitZoom(safeViewport);
  const markerModels = landmarks
    .filter((landmark) => landmark?.coord)
    .filter((landmark) => !partyCoord
      || landmark.coord.x !== partyCoord.x
      || landmark.coord.y !== partyCoord.y)
    .filter((landmark) => atlasPaperMarkerVisible(landmark, {
      zoomRatio,
      viewportWidth: safeViewport.width,
      visibleLayers,
      focusedRealmId,
      selectedLandmarkId,
    }))
    .map((landmark) => ({
      id: landmark.id,
      kind: landmark.kind || "landmark",
      glyph: ATLAS_LANDMARK_GLYPHS[landmark.kind] || ATLAS_LANDMARK_GLYPHS.landmark,
      point: atlasPaperWorldToScreen(safeCamera, safeViewport, landmark.coord),
      selected: landmark.id === selectedLandmarkId,
      quest: !!landmark.quest,
      muted: !!focusedRealmId && landmark.realmId !== focusedRealmId,
      knowledgeTier: landmark.knowledgeTier || landmark.knowledge || "reputation",
    }));

  return {
    viewport: safeViewport,
    zoomRatio,
    markers: markerModels,
    party: partyCoord ? {
      coord: partyCoord,
      point: atlasPaperWorldToScreen(safeCamera, safeViewport, partyCoord),
    } : null,
    selection: selectedCoord ? {
      coord: selectedCoord,
      point: atlasPaperWorldToScreen(safeCamera, safeViewport, selectedCoord),
    } : null,
    quests: questMarkers.filter((quest) => quest?.coord).map((quest) => ({
      id: quest.id,
      title: quest.title,
      point: atlasPaperWorldToScreen(safeCamera, safeViewport, quest.coord),
    })),
    journey: journey ? {
      continuation: screenPath(journey.fullPath || [], safeCamera, safeViewport),
      currentLeg: screenPath(journey.legPath || [], safeCamera, safeViewport),
      breaks: journeyBreaks.map((coord) => ({
        ...coord,
        point: atlasPaperWorldToScreen(safeCamera, safeViewport, coord),
      })),
    } : null,
  };
}
