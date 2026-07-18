import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  COASTAL_FEATURES,
  CONTINENT,
  CONTINENT_LAKES,
  CONTINENT_ROUTES,
  CONTINENT_SEA_LANES,
  CONTINENT_WATERWAYS,
  PROVINCES,
  PROVINCE_BY_ID,
  REALM_CULTURES,
  REALM_ECONOMIES,
  REALM_FACTIONS,
  REALMS,
  REGION_DEFINITIONS,
} from "../../data/continent.js";
import { surveyAtlas } from "../../engine/world-generation.js";
import { getTile } from "../../engine/world.js";
import { trackedCharacterResult } from "../../engine/positions.js";
import { TERRAINS } from "../../data/terrains.js";
import { TERRAIN_INK } from "./atlasModel.js";
import { poiIconKeyForLandmark } from "../../data/poi-icons.js";
import { PoiIcon, PoiTierMarker } from "../PoiIcon.jsx";
import {
  ATLAS_KNOWLEDGE_LABELS,
  ATLAS_LANDMARK_GLYPHS,
  ATLAS_LAYERS,
  ATLAS_MAX_ZOOM,
  ATLAS_TILT,
  atlasFitZoom,
  atlasPlaneViewport,
  atlasLandmarkLayer,
  atlasLandmarkTypeLabel,
  atlasMarkerVisible,
  atlasQuestMarkers,
  atlasRoutesForLandmark,
  atlasScreenToWorld,
  atlasWorldToScreen,
  axialRound,
  buildAtlasLandmarks,
  centerAtlasCamera,
  clampAtlasCamera,
  journeyLegBreaks,
  landmarkKnowledge,
  panAtlasCamera,
  summarizeAtlasJourney,
  tiltScreenToPlane,
  zoomAtlasCamera,
} from "./worldAtlasModel.js";

export {
  atlasLandmarkLayer,
  atlasLandmarkTypeLabel,
  atlasMarkerVisible,
  atlasRoutesForLandmark,
} from "./worldAtlasModel.js";

const REALM_BY_ID = Object.fromEntries(REALMS.map((realm) => [realm.id, realm]));
const CULTURE_BY_REALM_ID = Object.fromEntries(REALM_CULTURES.map((culture) => [culture.realmId, culture]));
const ECONOMY_BY_REALM_ID = Object.fromEntries(REALM_ECONOMIES.map((economy) => [economy.realmId, economy]));
const FACTION_BY_ID = Object.fromEntries(REALM_FACTIONS.map((faction) => [faction.id, faction]));

// Muted inks keep the generated geography legible while making the canvas
// read like a hand-painted relief board rather than a technical heat map.
const ATLAS_TERRAIN_INK = Object.freeze({
  indoor: "#776653",
  settlement: "#8d7758",
  street: "#9b8968",
  road: "#b08a52",
  wall: "#766d61",
  plains: "#78815a",
  hills: "#856b4b",
  forest: "#46634a",
  marsh: "#4f6b63",
  mountains: "#625a53",
  impassable: "#394840",
});
const SEA_INK = "#244b5a";
const SEA_DEEP_INK = "#173442";
const COAST_INK = "#52766f";

const SAMPLE_CACHE = new Map();
const SAMPLE_CACHE_LIMIT = 300000;
const INITIAL_ATLAS_VIEWPORT = Object.freeze({ width: 960, height: 540 });
const ATLAS_OPEN_ZOOM_RATIO = 1.16;
const ATLAS_WHEEL_ZOOM_STEP = 1.22;
const ATLAS_WHEEL_STEP_PIXELS = 100;
const ATLAS_WHEEL_MAX_FRAME_DELTA = 240;
const ATLAS_WHEEL_REFINE_DELAY = 110;
const ATLAS_WHEEL_IGNORE_SELECTOR = "[data-atlas-wheel-ignore]";

function cachedSurvey(x, y, seed) {
  const key = `${seed}|${x},${y}`;
  let sample = SAMPLE_CACHE.get(key);
  if (!sample) {
    const survey = surveyAtlas(x, y, seed);
    sample = {
      land: survey.land,
      coast: survey.coast,
      terrain: survey.terrain,
      elevation: survey.elevation,
    };
    if (SAMPLE_CACHE.size >= SAMPLE_CACHE_LIMIT) SAMPLE_CACHE.clear();
    SAMPLE_CACHE.set(key, sample);
  }
  return sample;
}

function shade(hex, amount) {
  const value = parseInt(hex.slice(1), 16);
  const channel = (offset) => {
    const base = (value >> offset) & 255;
    return Math.max(0, Math.min(255, Math.round(base * (1 + amount))));
  };
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

function cellColor(sample, hillshade = 0) {
  if (!sample.land) return sample.elevation > 0.55 ? SEA_INK : SEA_DEEP_INK;
  const base = ATLAS_TERRAIN_INK[sample.terrain] || TERRAIN_INK[sample.terrain] || ATLAS_TERRAIN_INK.plains;
  const relief = (sample.elevation - 0.45) * 0.24 + hillshade;
  if (sample.coast && sample.terrain !== "road") return shade(COAST_INK, relief * 0.45);
  return shade(base, relief);
}

// Sample step in whole hexes. World-anchoring the lattice stops the terrain
// from crawling under the routes while panning and keeps a repaint compact.
function rasterStep(zoom) {
  let step = 1;
  while (step < 32 && step * zoom < 8) step *= 2;
  return step;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Mouse wheels usually report roughly 100 CSS pixels per notch, while smooth
// trackpads emit a stream of much smaller deltas. Mapping the delta onto the
// old 1.22x wheel step keeps mouse behavior familiar without making every tiny
// trackpad event a full zoom step.
export function atlasWheelZoomFactor(deltaY, deltaMode = 0, pageSize = INITIAL_ATLAS_VIEWPORT.height) {
  const pixels = deltaY * (deltaMode === 1 ? 32 : deltaMode === 2 ? Math.max(1, pageSize) : 1);
  const bounded = clamp(pixels, -ATLAS_WHEEL_MAX_FRAME_DELTA, ATLAS_WHEEL_MAX_FRAME_DELTA);
  return ATLAS_WHEEL_ZOOM_STEP ** (-bounded / ATLAS_WHEEL_STEP_PIXELS);
}

// The search, filters, map key, and place dossier live inside the stage. Their
// wheel events bubble to the stage too, but scrolling map UI must never zoom
// and repaint the terrain underneath it.
export function atlasWheelZoomAllowed(target) {
  const element = target?.nodeType === 1 ? target : target?.parentElement || target;
  return !element?.closest?.(ATLAS_WHEEL_IGNORE_SELECTOR);
}

function sameCamera(a, b) {
  return a.x === b.x && a.y === b.y && a.zoom === b.zoom;
}

function coordinateNoise(x, y) {
  let value = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function traceCell(context, corners, dx = 0, dy = 0) {
  context.beginPath();
  context.moveTo(corners[0].x + dx, corners[0].y + dy);
  for (let index = 1; index < corners.length; index += 1) {
    context.lineTo(corners[index].x + dx, corners[index].y + dy);
  }
  context.closePath();
}

function cellCorners(center, xBasis, yBasis) {
  const raw = [
    { x: center.x - xBasis.x / 2 - yBasis.x / 2, y: center.y - xBasis.y / 2 - yBasis.y / 2 },
    { x: center.x + xBasis.x / 2 - yBasis.x / 2, y: center.y + xBasis.y / 2 - yBasis.y / 2 },
    { x: center.x + xBasis.x / 2 + yBasis.x / 2, y: center.y + xBasis.y / 2 + yBasis.y / 2 },
    { x: center.x - xBasis.x / 2 + yBasis.x / 2, y: center.y - xBasis.y / 2 + yBasis.y / 2 },
  ];
  // A fractional overlap prevents hairline seams between adjacent samples.
  return raw.map((point) => ({
    x: center.x + (point.x - center.x) * 1.025,
    y: center.y + (point.y - center.y) * 1.025,
  }));
}

function reliefStrength(sample) {
  if (!sample?.land) return 0;
  if (sample.terrain === "mountains") return 1;
  if (sample.terrain === "hills") return 0.68;
  if (sample.terrain === "forest") return 0.48;
  if (["wall", "settlement", "indoor"].includes(sample.terrain)) return 0.56;
  return clamp((sample.elevation - 0.35) * 0.45, 0, 0.24);
}

function drawMountain(context, x, y, size, sample, noise) {
  const width = size * (0.56 + noise * 0.18);
  const height = size * (0.48 + clamp(sample.elevation, 0, 1) * 0.35);
  const baseY = y + size * 0.24;
  context.beginPath();
  context.moveTo(x - width / 2, baseY);
  context.lineTo(x + width * 0.04, baseY - height);
  context.lineTo(x + width / 2, baseY);
  context.closePath();
  context.fillStyle = "rgba(44, 41, 39, .82)";
  context.fill();
  context.beginPath();
  context.moveTo(x - width / 2, baseY);
  context.lineTo(x + width * 0.04, baseY - height);
  context.lineTo(x - width * 0.03, baseY - height * 0.35);
  context.lineTo(x + width * 0.12, baseY - height * 0.2);
  context.closePath();
  context.fillStyle = "rgba(205, 196, 174, .68)";
  context.fill();
  context.strokeStyle = "rgba(35, 31, 30, .5)";
  context.lineWidth = Math.max(0.55, size * 0.045);
  context.stroke();
}

function drawForest(context, x, y, size, noise) {
  const count = size > 13 ? 3 : 2;
  for (let index = 0; index < count; index += 1) {
    const offset = (index - (count - 1) / 2) * size * 0.22;
    const treeHeight = size * (0.34 + ((noise + index * 0.23) % 1) * 0.12);
    context.beginPath();
    context.moveTo(x + offset, y - treeHeight * 0.62);
    context.lineTo(x + offset - treeHeight * 0.32, y + treeHeight * 0.3);
    context.lineTo(x + offset + treeHeight * 0.32, y + treeHeight * 0.3);
    context.closePath();
    context.fillStyle = index % 2 ? "rgba(35, 73, 51, .72)" : "rgba(49, 86, 56, .82)";
    context.fill();
    context.strokeStyle = "rgba(23, 46, 34, .55)";
    context.lineWidth = 0.55;
    context.stroke();
  }
}

function drawTerrainRelief(context, center, size, sample, noise) {
  if (size < 7.5) return;
  const density = sample.terrain === "mountains" ? 0.9
    : sample.terrain === "forest" ? 0.68
    : sample.terrain === "hills" ? 0.54
    : sample.terrain === "marsh" ? 0.4
    : !sample.land ? 0.32
    : 0;
  if (noise > density) return;

  if (sample.terrain === "mountains") {
    drawMountain(context, center.x, center.y, size, sample, noise);
    return;
  }
  if (sample.terrain === "forest") {
    drawForest(context, center.x, center.y, size, noise);
    return;
  }
  if (sample.terrain === "hills") {
    context.beginPath();
    context.ellipse(center.x, center.y + size * 0.14, size * 0.34, size * 0.16, -0.16, Math.PI, Math.PI * 2);
    context.strokeStyle = "rgba(62, 47, 34, .48)";
    context.lineWidth = Math.max(0.6, size * 0.055);
    context.stroke();
    context.beginPath();
    context.ellipse(center.x - size * 0.12, center.y + size * 0.1, size * 0.22, size * 0.1, -0.16, Math.PI, Math.PI * 2);
    context.strokeStyle = "rgba(216, 192, 142, .32)";
    context.stroke();
    return;
  }
  if (sample.terrain === "marsh") {
    context.strokeStyle = "rgba(184, 173, 111, .48)";
    context.lineWidth = 0.7;
    for (let index = -1; index <= 1; index += 1) {
      context.beginPath();
      context.moveTo(center.x + index * size * 0.18, center.y + size * 0.22);
      context.lineTo(center.x + index * size * 0.15, center.y - size * 0.14);
      context.stroke();
    }
    return;
  }
  if (!sample.land) {
    context.beginPath();
    context.moveTo(center.x - size * 0.28, center.y);
    context.quadraticCurveTo(center.x - size * 0.08, center.y - size * 0.12, center.x + size * 0.08, center.y);
    context.quadraticCurveTo(center.x + size * 0.22, center.y + size * 0.1, center.x + size * 0.32, center.y);
    context.strokeStyle = "rgba(153, 203, 207, .28)";
    context.lineWidth = 0.65;
    context.stroke();
  }
}

function thinPath(path, maxPoints = 240) {
  if (!path || path.length <= maxPoints) return path || [];
  const stride = Math.ceil(path.length / maxPoints);
  const out = [];
  for (let index = 0; index < path.length; index += stride) out.push(path[index]);
  if (out[out.length - 1] !== path[path.length - 1]) out.push(path[path.length - 1]);
  return out;
}

function compactList(value, limit = 3) {
  const items = Array.isArray(value) ? value : (value ? [value] : []);
  if (!items.length) return null;
  const shown = items.slice(0, limit).map((item) => (
    typeof item === "string" ? item : item?.name || item?.label || String(item)
  ));
  return `${shown.join(", ")}${items.length > limit ? ` +${items.length - limit}` : ""}`;
}

function svgPoints(camera, viewport, waypoints) {
  return waypoints
    .map((point) => {
      const screen = atlasWorldToScreen(camera, viewport, point);
      return `${screen.x.toFixed(1)},${screen.y.toFixed(1)}`;
    })
    .join(" ");
}

// ---- Raster painter ----
//
// Paints a coarse physical survey immediately, then refines it on an offscreen
// canvas in time-budgeted chunks. The visible canvas keeps the last usable map
// until the next preview is ready, so cancelled camera passes never strand the
// player on the deep-sea clear. The party's remembered trail (seen tiles) is
// drawn over the finished raster.
function paintAtlas({ canvas, camera, viewport, seed, seenKeys, token, refineDelay = 0 }) {
  const ratio = typeof window !== "undefined"
    ? Math.max(1, Math.min(2, window.devicePixelRatio || 1))
    : 1;
  const pixelWidth = Math.max(1, Math.round(viewport.width * ratio));
  const pixelHeight = Math.max(1, Math.round(viewport.height * ratio));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  const displayContext = canvas.getContext("2d", { alpha: false });

  // Camera changes paint away from the DOM canvas. Until the preview is
  // presented, the old camera image remains visible instead of flashing sea.
  const buffer = canvas.ownerDocument?.createElement?.("canvas") || canvas;
  buffer.width = pixelWidth;
  buffer.height = pixelHeight;
  const context = buffer.getContext("2d", { alpha: false });
  if (!displayContext || !context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  const step = rasterStep(camera.zoom);
  const gridFor = (sampleStep) => {
    const cellPx = sampleStep * camera.zoom;
    const screenCorners = [
      atlasScreenToWorld(camera, viewport, { x: -cellPx, y: -cellPx }),
      atlasScreenToWorld(camera, viewport, { x: viewport.width + cellPx, y: -cellPx }),
      atlasScreenToWorld(camera, viewport, { x: viewport.width + cellPx, y: viewport.height + cellPx }),
      atlasScreenToWorld(camera, viewport, { x: -cellPx, y: viewport.height + cellPx }),
    ];
    const xmin = Math.floor(Math.min(...screenCorners.map((corner) => corner.x)) / sampleStep) * sampleStep - sampleStep;
    const xmax = Math.ceil(Math.max(...screenCorners.map((corner) => corner.x)) / sampleStep) * sampleStep + sampleStep;
    const ymin = Math.floor(Math.min(...screenCorners.map((corner) => corner.y)) / sampleStep) * sampleStep - sampleStep;
    const ymax = Math.ceil(Math.max(...screenCorners.map((corner) => corner.y)) / sampleStep) * sampleStep + sampleStep;
    const basisOrigin = atlasWorldToScreen(camera, viewport, { x: 0, y: 0 });
    const basisXPoint = atlasWorldToScreen(camera, viewport, { x: sampleStep, y: 0 });
    const basisYPoint = atlasWorldToScreen(camera, viewport, { x: 0, y: sampleStep });
    return {
      step: sampleStep,
      cellPx,
      xmin,
      ymin,
      columns: Math.ceil((xmax - xmin) / sampleStep) + 1,
      rows: Math.ceil((ymax - ymin) / sampleStep) + 1,
      xBasis: { x: basisXPoint.x - basisOrigin.x, y: basisXPoint.y - basisOrigin.y },
      yBasis: { x: basisYPoint.x - basisOrigin.x, y: basisYPoint.y - basisOrigin.y },
    };
  };

  const paintCell = (grid, x, y, detailed) => {
    const sample = cachedSurvey(x, y, seed);
    const hillshade = detailed ? clamp(
      ((sample.elevation - cachedSurvey(x - grid.step, y - grid.step, seed).elevation) * 0.78
        + (sample.elevation - cachedSurvey(x - grid.step, y, seed).elevation) * 0.46) * 0.75,
      -0.18,
      0.18,
    ) : 0;
    const center = atlasWorldToScreen(camera, viewport, { x, y });
    const corners = cellCorners(center, grid.xBasis, grid.yBasis);
    traceCell(context, corners);
    context.fillStyle = cellColor(sample, hillshade);
    context.fill();

    if (!detailed) return;
    const strength = reliefStrength(sample);
    if (grid.cellPx >= 7 && strength > 0.12) {
      context.beginPath();
      context.moveTo(corners[0].x, corners[0].y);
      context.lineTo(corners[1].x, corners[1].y);
      context.strokeStyle = `rgba(244, 222, 169, ${0.08 + strength * 0.18})`;
      context.lineWidth = Math.max(0.45, grid.cellPx * 0.035);
      context.stroke();
      context.beginPath();
      context.moveTo(corners[2].x, corners[2].y);
      context.lineTo(corners[3].x, corners[3].y);
      context.strokeStyle = `rgba(28, 24, 24, ${0.1 + strength * 0.24})`;
      context.lineWidth = Math.max(0.55, grid.cellPx * 0.05);
      context.stroke();
    }
    drawTerrainRelief(context, center, grid.cellPx, sample, coordinateNoise(x, y));
  };

  const present = () => {
    if (buffer === canvas) return;
    displayContext.setTransform(1, 0, 0, 1, 0, 0);
    displayContext.globalCompositeOperation = "source-over";
    displayContext.imageSmoothingEnabled = false;
    displayContext.drawImage(buffer, 0, 0);
  };

  context.fillStyle = SEA_DEEP_INK;
  context.fillRect(0, 0, viewport.width, viewport.height);

  // A 4x coarser world-anchored grid is cheap enough to show in the same task
  // and gives the refinement pass a terrain-colored image to work over.
  const previewGrid = gridFor(step * 4);
  for (let previewRow = 0; previewRow < previewGrid.rows; previewRow += 1) {
    const y = previewGrid.ymin + previewRow * previewGrid.step;
    for (let column = 0; column < previewGrid.columns; column += 1) {
      paintCell(previewGrid, previewGrid.xmin + column * previewGrid.step, y, false);
    }
  }
  present();

  const grid = gridFor(step);
  let row = 0;
  let lastPresent = typeof performance !== "undefined" ? performance.now() : Date.now();
  const paintChunk = () => {
    if (token.cancelled) return;
    const start = typeof performance !== "undefined" ? performance.now() : Date.now();
    while (row < grid.rows) {
      const y = grid.ymin + row * grid.step;
      for (let column = 0; column < grid.columns; column += 1) {
        paintCell(grid, grid.xmin + column * grid.step, y, true);
      }
      row += 1;
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (now - start > 9) break;
    }
    if (row < grid.rows) {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (now - lastPresent > 120) {
        present();
        lastPresent = now;
      }
      token.frame = requestAnimationFrame(paintChunk);
      return;
    }
    // Remembered trail: a faint amber dust over every hex the party has seen.
    context.fillStyle = "rgba(255, 224, 138, .30)";
    const dot = Math.max(1.2, camera.zoom * 0.24);
    for (const key of seenKeys) {
      const comma = key.indexOf(",");
      const x = Number(key.slice(0, comma));
      const y = Number(key.slice(comma + 1));
      const screen = atlasWorldToScreen(camera, viewport, { x, y });
      if (screen.x < -4 || screen.y < -4 || screen.x > viewport.width + 4 || screen.y > viewport.height + 4) continue;
      context.fillRect(screen.x - dot / 2, screen.y - dot / 2, dot, dot);
    }
    // A warm glaze ties the procedural colors and raised marks together like
    // pigment on an aged campaign board.
    context.save();
    context.globalCompositeOperation = "soft-light";
    context.fillStyle = "rgba(225, 189, 118, .12)";
    context.fillRect(0, 0, viewport.width, viewport.height);
    context.restore();
    // Soft vignette keeps the chart readable against the folio.
    const vignette = context.createRadialGradient(
      viewport.width / 2, viewport.height / 2, Math.min(viewport.width, viewport.height) * 0.42,
      viewport.width / 2, viewport.height / 2, Math.max(viewport.width, viewport.height) * 0.78,
    );
    vignette.addColorStop(0, "rgba(2, 10, 22, 0)");
    vignette.addColorStop(1, "rgba(2, 10, 22, .56)");
    context.fillStyle = vignette;
    context.fillRect(0, 0, viewport.width, viewport.height);
    present();
  };
  if (refineDelay > 0 && typeof setTimeout !== "undefined") {
    token.timeout = setTimeout(() => {
      token.timeout = 0;
      if (!token.cancelled) token.frame = requestAnimationFrame(paintChunk);
    }, refineDelay);
  } else {
    token.frame = requestAnimationFrame(paintChunk);
  }
}

const TILT_STORAGE_KEY = "solitaire-atlas-view";
const KNOWLEDGE_SHORT_LABELS = Object.freeze({
  charted: "Charted",
  sighted: "Sighted",
  reputation: "Reputation",
  legend: "Legend",
});

function stopStagePointer(event) {
  // Chrome overlays (search, chips, rail, place card) sit on the map stage;
  // swallowing pointerdown keeps taps and scrolls inside them from panning
  // the table or charting the ground underneath.
  event.stopPropagation();
}

export function WorldAtlas({ state, origin, onPick, initialSelection = null }) {
  const seed = state?.world?.seed || CONTINENT.seed;
  const partyCoord = origin || state?.world?.currentTile || CONTINENT.start.coord;
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const searchInputRef = useRef(null);
  const gestureRef = useRef({ pointers: new Map(), moved: false, dragDistance: 0, pinchDistance: 0 });
  const wheelRef = useRef({ frame: 0, deltaY: 0, anchor: null, lastAt: null });
  const didInitialFitRef = useRef(false);
  const [viewport, setViewport] = useState(INITIAL_ATLAS_VIEWPORT);
  const [stageMeasured, setStageMeasured] = useState(false);
  // The tabletop tilt is the default camera; the choice persists like a maps
  // app remembering 2D/3D mode.
  const [tilted, setTilted] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return window.localStorage.getItem(TILT_STORAGE_KEY) !== "2d";
    } catch {
      return true;
    }
  });
  const tilt = tilted ? ATLAS_TILT : null;
  // Everything on the table — raster, routes, labels, markers — lives on an
  // oversized plane so the rotated top edge still reaches the stage corners.
  const planeViewport = useMemo(() => atlasPlaneViewport(viewport, tilt), [viewport, tilted]);
  const [camera, setCamera] = useState(() => {
    const plane = atlasPlaneViewport(INITIAL_ATLAS_VIEWPORT, tilted ? ATLAS_TILT : null);
    const openingZoom = atlasFitZoom(plane) * ATLAS_OPEN_ZOOM_RATIO;
    return clampAtlasCamera(
      centerAtlasCamera({ x: 0, y: 0, zoom: openingZoom }, plane, partyCoord, openingZoom),
      plane,
    );
  });
  const [visibleLayers, setVisibleLayers] = useState(() => new Set(ATLAS_LAYERS.map((layer) => layer.id)));
  const [focusedRealmId, setFocusedRealmId] = useState(null);
  // The party marker already communicates the opening position. Keep the map
  // clear until the player intentionally asks about a destination.
  const [selection, setSelection] = useState(initialSelection);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [detailExpanded, setDetailExpanded] = useState(false);

  const fit = atlasFitZoom(planeViewport);
  const zoomRatio = camera.zoom / fit;
  const hexKilometers = CONTINENT.hexKilometers || 6;
  const landmarks = useMemo(() => buildAtlasLandmarks(state, partyCoord), [state, partyCoord]);
  const questMarkers = useMemo(() => atlasQuestMarkers(state), [state]);
  const trackedCharacter = useMemo(() => trackedCharacterResult(state), [state]);

  const selectedLandmark = selection?.kind === "landmark"
    ? landmarks.find((landmark) => landmark.id === selection.id) || null
    : null;
  const selectedCoord = selection?.kind === "landmark"
    ? selectedLandmark?.coord || null
    : selection
    ? { x: selection.x, y: selection.y }
    : null;
  const selectedSurvey = useMemo(
    () => (selectedCoord ? surveyAtlas(selectedCoord.x, selectedCoord.y, seed) : null),
    [selectedCoord?.x, selectedCoord?.y, seed],
  );
  const journey = useMemo(
    () => (selectedCoord && state ? summarizeAtlasJourney(state, selectedCoord) : null),
    [state, selectedCoord?.x, selectedCoord?.y],
  );
  const selectionKey = !selection
    ? ""
    : selection.kind === "landmark"
    ? selection.id
    : `${selection.x},${selection.y}`;

  // Measure the stage.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const measure = () => {
      const bounds = stage.getBoundingClientRect();
      const width = Math.max(1, Math.round(bounds.width));
      const height = Math.max(1, Math.round(bounds.height));
      setViewport((current) => (current.width === width && current.height === height ? current : { width, height }));
      setStageMeasured(true);
    };
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(measure);
      observer.observe(stage);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Fit once after the real stage measurement, then preserve the user's view
  // while merely keeping it legal on later resizes and 2D/3D switches.
  useEffect(() => {
    if (!stageMeasured) return;
    setCamera((current) => {
      if (!didInitialFitRef.current) {
        didInitialFitRef.current = true;
        const openingZoom = atlasFitZoom(planeViewport) * ATLAS_OPEN_ZOOM_RATIO;
        return centerAtlasCamera(current, planeViewport, partyCoord, openingZoom);
      }
      return clampAtlasCamera(current, planeViewport);
    });
  }, [stageMeasured, planeViewport.width, planeViewport.height, partyCoord.x, partyCoord.y]);

  // A fresh selection opens as the compact place card.
  useEffect(() => {
    setDetailExpanded(false);
  }, [selectionKey]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  // Paint the raster whenever the camera, plane, seed, or discoveries change.
  const seenSignature = Object.keys(state?.world?.seen || {}).join("|");
  const seenKeys = useMemo(
    () => (seenSignature ? seenSignature.split("|") : []),
    [seenSignature],
  );
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!stageMeasured || !canvas || typeof requestAnimationFrame === "undefined") return undefined;
    const token = { cancelled: false, frame: 0, timeout: 0 };
    const now = Date.now();
    const wheelIdleFor = wheelRef.current.lastAt == null ? Infinity : now - wheelRef.current.lastAt;
    const refineDelay = Math.max(0, ATLAS_WHEEL_REFINE_DELAY - wheelIdleFor);
    // Defer the start one frame so measurement and initial-fit renders can
    // coalesce without clearing or beginning a painter that will be cancelled.
    token.frame = requestAnimationFrame(() => {
      token.frame = 0;
      if (!token.cancelled) paintAtlas({ canvas, camera, viewport: planeViewport, seed, seenKeys, token, refineDelay });
    });
    return () => {
      token.cancelled = true;
      if (token.frame) cancelAnimationFrame(token.frame);
      if (token.timeout) clearTimeout(token.timeout);
    };
  }, [camera, planeViewport, seed, seenKeys, stageMeasured]);

  // Wheel zoom needs a non-passive listener. The anchor converts through the
  // tilt so the ground under the cursor stays put on the leaned table too.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const onWheel = (event) => {
      if (!atlasWheelZoomAllowed(event.target) || event.deltaY === 0) return;
      event.preventDefault();
      const bounds = stage.getBoundingClientRect();
      const anchor = tiltScreenToPlane(
        { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
        viewport,
        planeViewport,
        tilt,
      );
      const wheel = wheelRef.current;
      wheel.deltaY += event.deltaY * (event.deltaMode === 1 ? 32 : event.deltaMode === 2 ? viewport.height : 1);
      wheel.anchor = anchor;
      wheel.lastAt = Date.now();
      if (wheel.frame) return;
      wheel.frame = requestAnimationFrame(() => {
        wheel.frame = 0;
        const deltaY = wheel.deltaY;
        const nextAnchor = wheel.anchor;
        wheel.deltaY = 0;
        wheel.anchor = null;
        if (deltaY === 0) return;
        setCamera((current) => {
          const next = zoomAtlasCamera(current, planeViewport, atlasWheelZoomFactor(deltaY), nextAnchor);
          return sameCamera(current, next) ? current : next;
        });
      });
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      stage.removeEventListener("wheel", onWheel);
      const wheel = wheelRef.current;
      if (wheel.frame) cancelAnimationFrame(wheel.frame);
      wheel.frame = 0;
      wheel.deltaY = 0;
      wheel.anchor = null;
    };
  }, [viewport, planeViewport, tilted]);

  // Pointer math runs in plane coordinates: a stage touch is projected through
  // the tilt first, so drags keep the ground glued to the finger and pinches
  // zoom about the true midpoint between the touch points.
  function planePoint(event) {
    const bounds = stageRef.current.getBoundingClientRect();
    return tiltScreenToPlane(
      { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
      viewport,
      planeViewport,
      tilt,
    );
  }

  function handlePointerDown(event) {
    const gesture = gestureRef.current;
    gesture.pointers.set(event.pointerId, planePoint(event));
    if (gesture.pointers.size === 1) {
      gesture.moved = false;
      gesture.dragDistance = 0;
    }
    if (gesture.pointers.size === 2) {
      const [a, b] = [...gesture.pointers.values()];
      gesture.pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
    }
    stageRef.current.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event) {
    const gesture = gestureRef.current;
    if (!gesture.pointers.has(event.pointerId)) return;
    const point = planePoint(event);
    const previous = gesture.pointers.get(event.pointerId);
    gesture.pointers.set(event.pointerId, point);

    if (gesture.pointers.size === 2) {
      const [a, b] = [...gesture.pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (gesture.pinchDistance > 0 && Math.abs(distance - gesture.pinchDistance) > 1) {
        const factor = distance / gesture.pinchDistance;
        gesture.pinchDistance = distance;
        gesture.moved = true;
        setCamera((current) => zoomAtlasCamera(current, planeViewport, factor, midpoint));
      }
      return;
    }

    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    gesture.dragDistance += Math.hypot(dx, dy);
    if (!gesture.moved && gesture.dragDistance < 4) return;
    gesture.moved = true;
    setCamera((current) => panAtlasCamera(current, planeViewport, dx, dy));
  }

  function handlePointerUp(event) {
    const gesture = gestureRef.current;
    const hadPointer = gesture.pointers.delete(event.pointerId);
    stageRef.current?.releasePointerCapture?.(event.pointerId);
    if (!hadPointer || gesture.moved || gesture.pointers.size > 0) return;
    if (event.target.closest?.("button")) return; // marker buttons select themselves
    // A clean tap on open ground charts that coordinate.
    const fractional = atlasScreenToWorld(camera, planeViewport, planePoint(event));
    const coord = axialRound(fractional.x, fractional.y);
    const sample = cachedSurvey(coord.x, coord.y, seed);
    if (!sample.land) return;
    setSelection({ kind: "point", x: coord.x, y: coord.y });
  }

  function handleKeyDown(event) {
    if (event.target.closest?.("input")) return; // typing in search
    const pan = 72;
    if (event.key === "ArrowLeft") setCamera((current) => panAtlasCamera(current, planeViewport, pan, 0));
    else if (event.key === "ArrowRight") setCamera((current) => panAtlasCamera(current, planeViewport, -pan, 0));
    else if (event.key === "ArrowUp") setCamera((current) => panAtlasCamera(current, planeViewport, 0, pan));
    else if (event.key === "ArrowDown") setCamera((current) => panAtlasCamera(current, planeViewport, 0, -pan));
    else if (event.key === "+" || event.key === "=") setCamera((current) => zoomAtlasCamera(current, planeViewport, 1.25));
    else if (event.key === "-") setCamera((current) => zoomAtlasCamera(current, planeViewport, 1 / 1.25));
    else if (event.key === "0") setCamera((current) => clampAtlasCamera({ ...current, zoom: fit }, planeViewport));
    else if (event.key === "Home") setCamera((current) => centerAtlasCamera(current, planeViewport, partyCoord, Math.max(current.zoom, fit * 3)));
    else if (event.key === "Escape" && (searchOpen || filtersOpen)) {
      setSearchOpen(false);
      setFiltersOpen(false);
    }
    else return;
    event.preventDefault();
  }

  function inspectLandmark(landmark) {
    setSelection({ kind: "landmark", id: landmark.id });
  }

  function inspectRealm(realm) {
    setFocusedRealmId((current) => (current === realm.id ? null : realm.id));
    const capital = landmarks.find((landmark) => landmark.capitalOfRealmId === realm.id || landmark.id === realm.capital.id);
    if (capital) setSelection({ kind: "landmark", id: capital.id });
    setCamera((current) => centerAtlasCamera(current, planeViewport, realm.center, Math.max(fit * 2.1, current.zoom)));
    setFiltersOpen(false);
  }

  function toggleLayer(layerId) {
    setVisibleLayers((current) => {
      const next = new Set(current);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  }

  function toggleTilt() {
    setTilted((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(TILT_STORAGE_KEY, next ? "3d" : "2d");
      } catch {
        // Private browsing: the mode simply won't persist.
      }
      return next;
    });
  }

  function centerOnParty() {
    setCamera((current) => centerAtlasCamera(current, planeViewport, partyCoord, Math.max(current.zoom, fit * 3)));
  }

  function centerOnTrackedCharacter() {
    if (!trackedCharacter) return;
    const { x, y } = trackedCharacter.pos;
    setSelection({ kind: "point", x, y });
    setCamera((current) => centerAtlasCamera(current, planeViewport, { x, y }, Math.max(current.zoom, fit * 3)));
  }

  function pickSearchResult(landmark) {
    setSelection({ kind: "landmark", id: landmark.id });
    setCamera((current) => centerAtlasCamera(current, planeViewport, landmark.coord, Math.max(current.zoom, fit * 3)));
    setSearchOpen(false);
    setQuery("");
  }

  function chartSelection() {
    if (!selectedCoord) return;
    const tile = getTile(state, selectedCoord.x, selectedCoord.y);
    onPick({
      x: selectedCoord.x,
      y: selectedCoord.y,
      key: `${selectedCoord.x},${selectedCoord.y}`,
      tile,
      name: selectedLandmark?.name || (trackedAtSelection ? trackedCharacter.name : null),
      knownBy: selectedLandmark ? landmarkKnowledge(state, selectedLandmark) : null,
    });
  }

  const searchResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = landmarks.filter((landmark) => !needle
      || landmark.name.toLowerCase().includes(needle)
      || atlasLandmarkTypeLabel(landmark).toLowerCase().includes(needle)
      || (REGION_DEFINITIONS[landmark.regionId]?.label || "").toLowerCase().includes(needle)
      || (REALM_BY_ID[landmark.realmId]?.shortName || "").toLowerCase().includes(needle));
    return matches
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
      .slice(0, needle ? 40 : 8);
  }, [landmarks, query]);

  // ---- Derived presentation ----
  const planeOffset = {
    left: (viewport.width - planeViewport.width) / 2,
    top: (viewport.height - planeViewport.height) / 2,
  };
  const partyScreen = atlasWorldToScreen(camera, planeViewport, partyCoord);
  const kmAcross = Math.round((viewport.width / camera.zoom) * hexKilometers);
  const currentLegPoints = journey ? svgPoints(camera, planeViewport, thinPath(journey.legPath)) : "";
  const continuationPath = journey
    ? journey.fullPath.slice(Math.max(0, (journey.legPath?.length || 1) - 1))
    : [];
  const continuationPoints = continuationPath.length > 1
    ? svgPoints(camera, planeViewport, thinPath(continuationPath))
    : "";
  const journeyBreaks = journey ? journeyLegBreaks(journey.fullPath, journey.legSteps) : [];
  const coastPoints = useMemo(() => svgPoints(camera, planeViewport, CONTINENT.coastline), [camera, planeViewport]);
  const showRegionLabels = zoomRatio >= 1.7;
  const showRealmLabels = zoomRatio < 1.7;
  const trackedAtSelection = !!(
    trackedCharacter
    && selectedCoord
    && trackedCharacter.pos.x === selectedCoord.x
    && trackedCharacter.pos.y === selectedCoord.y
  );

  const detailRealm = REALM_BY_ID[selectedLandmark?.realmId || selectedSurvey?.realmId] || null;
  const detailRegion = REGION_DEFINITIONS[selectedLandmark?.regionId || selectedSurvey?.regionId] || null;
  const detailProvince = (selectedLandmark?.provinceId && PROVINCE_BY_ID[selectedLandmark.provinceId])
    || PROVINCES.find((province) => province.seatLandmarkId === selectedLandmark?.id)
    || null;
  const detailFactionId = selectedLandmark?.factionId
    || selectedLandmark?.controllingFactionId
    || detailProvince?.authorityFactionId
    || detailRealm?.faction?.id;
  const detailFaction = FACTION_BY_ID[detailFactionId] || null;
  const detailCulture = CULTURE_BY_REALM_ID[detailRealm?.id] || null;
  const detailEconomy = ECONOMY_BY_REALM_ID[detailRealm?.id] || null;
  const detailLeader = detailFaction?.leader || detailProvince?.governor || detailRealm?.ruler;
  const detailRoutes = selectedLandmark ? atlasRoutesForLandmark(selectedLandmark) : [];
  const detailSeaLanes = selectedLandmark?.kind === "port"
    ? CONTINENT_SEA_LANES.filter((lane) => lane.portIds?.includes(selectedLandmark.id))
    : [];
  const detailTypeLabel = trackedAtSelection
    ? "Tracked playable character"
    : selectedLandmark
    ? atlasLandmarkTypeLabel(selectedLandmark)
    : (selectedSurvey ? (TERRAINS[selectedSurvey.terrain]?.label || "Open country") : "Unknown ground");
  const detailTitle = (trackedAtSelection ? trackedCharacter.name : null)
    || selectedLandmark?.name
    || (selectedSurvey ? `${TERRAINS[selectedSurvey.terrain]?.label || "Open country"} (${selectedCoord.x}, ${selectedCoord.y})` : "Uncharted");
  const detailKnowledge = selectedLandmark ? landmarkKnowledge(state, selectedLandmark) : null;
  const detailAreaName = detailProvince?.name || detailRegion?.label || detailRealm?.shortName || "Uncharted lands";
  const cultureSummary = detailCulture
    ? [detailCulture.demonym, compactList(detailCulture.languages, 2)].filter(Boolean).join(" · ")
    : detailRealm?.biomeName;
  const tradeSummary = compactList(detailEconomy?.exports)
    || detailEconomy?.tradeNotes
    || compactList(detailRegion?.features);
  const routeSummary = compactList(detailRoutes.map((route) => route.name), 4) || "No charted road";
  const seaLaneSummary = compactList(detailSeaLanes.map((lane) => lane.name), 3);
  const selectionIsParty = selectedCoord && selectedCoord.x === partyCoord.x && selectedCoord.y === partyCoord.y;
  const activeFilterCount = (focusedRealmId ? 1 : 0) + (ATLAS_LAYERS.length - visibleLayers.size);

  return (
    <section
      className={`world-atlas${tilted ? " is-tilted" : ""}`}
      style={{ "--atlas-tilt": `${ATLAS_TILT.angleDeg}deg`, "--atlas-perspective": `${ATLAS_TILT.perspective}px` }}
      aria-labelledby="world-atlas-title"
    >
      <div
        ref={stageRef}
        className="world-atlas__stage"
        role="application"
        aria-label={`Interactive map of ${CONTINENT.name}. Arrow keys pan, plus and minus zoom, zero fits the continent, Home returns to the party.`}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        <div className="world-atlas__scene">
          <div
            className="world-atlas__plane"
            style={{
              width: `${planeViewport.width}px`,
              height: `${planeViewport.height}px`,
              left: `${planeOffset.left}px`,
              top: `${planeOffset.top}px`,
            }}
          >
            <canvas ref={canvasRef} className="world-atlas__canvas" aria-hidden="true" />

            <svg className="world-atlas__vector" viewBox={`0 0 ${planeViewport.width} ${planeViewport.height}`} aria-hidden="true">
              <defs>
                <marker id="world-atlas-route-arrow" viewBox="0 0 8 8" refX="6.2" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M 0 0 L 8 4 L 0 8 z" />
                </marker>
              </defs>
              <polygon className="world-atlas__coastline" points={coastPoints} />
              {CONTINENT_WATERWAYS.map((river) => (
                <polyline key={river.id} className="world-atlas__river" points={svgPoints(camera, planeViewport, river.waypoints)}>
                  <title>{river.name}</title>
                </polyline>
              ))}
              {CONTINENT_LAKES.map((lake) => {
                const center = atlasWorldToScreen(camera, planeViewport, lake.center);
                return <circle key={lake.id} className="world-atlas__lake" cx={center.x} cy={center.y} r={Math.max(3, lake.radius * camera.zoom * 0.85)} />;
              })}
              {CONTINENT_SEA_LANES.map((lane) => (
                <polyline
                  key={lane.id}
                  className={`world-atlas__sea-lane ${focusedRealmId && !lane.realmIds?.includes(focusedRealmId) ? "is-muted" : ""}`}
                  points={svgPoints(camera, planeViewport, lane.waypoints)}
                >
                  <title>{lane.name}</title>
                </polyline>
              ))}
              {CONTINENT_ROUTES.map((route) => (
                <polyline
                  key={route.id}
                  className={`world-atlas__route ${route.kind === "regional-road" ? "is-regional" : "is-great"} ${focusedRealmId && !route.realmIds?.includes(focusedRealmId) ? "is-muted" : ""}`}
                  points={svgPoints(camera, planeViewport, route.waypoints)}
                >
                  <title>{route.name}</title>
                </polyline>
              ))}
              {continuationPoints && (
                <>
                  <polyline className="world-atlas__journey-continuation-halo" points={continuationPoints} />
                  <polyline className="world-atlas__journey-continuation" points={continuationPoints} />
                </>
              )}
              {currentLegPoints && (
                <>
                  <polyline className="world-atlas__journey-halo" points={currentLegPoints} />
                  <polyline className="world-atlas__journey" points={currentLegPoints} markerEnd="url(#world-atlas-route-arrow)" />
                </>
              )}
              {journeyBreaks.map((stop, index) => {
                const screen = atlasWorldToScreen(camera, planeViewport, stop);
                return (
                  <g key={`${stop.x},${stop.y}`} className="world-atlas__leg-stop" transform={`translate(${screen.x} ${screen.y})`}>
                    <ellipse cx="2" cy="3" rx="7" ry="3" />
                    <circle r="5.5" />
                    <text y=".5">{index + 1}</text>
                  </g>
                );
              })}
            </svg>

            {showRealmLabels && (
              <div className="world-atlas__realm-labels" aria-hidden="true">
                {REALMS.map((realm) => {
                  const screen = atlasWorldToScreen(camera, planeViewport, realm.center);
                  return (
                    <span key={realm.id} className={`is-${realm.id}`} style={{ left: `${screen.x}px`, top: `${screen.y}px` }}>
                      <b>{realm.shortName}</b>
                      <small>{realm.biomeName}</small>
                    </span>
                  );
                })}
              </div>
            )}

            <div className="world-atlas__water-labels" aria-hidden="true">
              {COASTAL_FEATURES.map((feature) => {
                const screen = atlasWorldToScreen(camera, planeViewport, feature.coord);
                return (
                  <span key={feature.id} className={`is-${feature.kind}`} style={{ left: `${screen.x}px`, top: `${screen.y}px` }}>
                    {feature.name}
                  </span>
                );
              })}
            </div>

            {showRegionLabels && (
              <div className="world-atlas__region-labels" aria-hidden="true">
                {Object.values(REGION_DEFINITIONS).flatMap((region) => region.sites.map((site, index) => {
                  const screen = atlasWorldToScreen(camera, planeViewport, site);
                  return (
                    <span key={`${region.id}:${index}`} style={{ left: `${screen.x}px`, top: `${screen.y}px` }}>
                      {region.label}
                    </span>
                  );
                }))}
              </div>
            )}

            <div className="world-atlas__marker-layer" role="group" aria-label={`${landmarks.length} known landmarks`}>
              {landmarks.map((landmark) => {
                const visible = atlasMarkerVisible(landmark, {
                  zoomRatio,
                  visibleLayers,
                  focusedRealmId,
                  selectedLandmarkId: selection?.kind === "landmark" ? selection.id : null,
                }) || !!landmark.quest;
                const screen = atlasWorldToScreen(camera, planeViewport, landmark.coord);
                const offstage = screen.x < -40 || screen.y < -40 || screen.x > planeViewport.width + 40 || screen.y > planeViewport.height + 40;
                const selected = selection?.kind === "landmark" && selection.id === landmark.id;
                const poiIconKey = poiIconKeyForLandmark(landmark);
                return (
                  <button
                    key={landmark.id}
                    type="button"
                    hidden={!visible || offstage}
                    className={`world-atlas__marker is-${landmark.knowledgeTier} is-category-${atlasLandmarkLayer(landmark)} ${poiIconKey ? "has-poi-icon" : ""} ${selected ? "is-selected" : ""} ${landmark.capitalOfRealmId ? "is-capital" : ""} ${landmark.quest ? "has-quest" : ""}`}
                    style={{ left: `${screen.x}px`, top: `${screen.y}px` }}
                    onClick={() => inspectLandmark(landmark)}
                    aria-label={`Inspect ${landmark.name}, ${atlasLandmarkTypeLabel(landmark)}, ${REGION_DEFINITIONS[landmark.regionId]?.label || REALM_BY_ID[landmark.realmId]?.shortName || "uncharted lands"}, ${ATLAS_KNOWLEDGE_LABELS[landmark.knowledgeTier]}`}
                    aria-pressed={selected}
                    aria-controls="world-atlas-detail"
                  >
                    <span aria-hidden="true">
                      {poiIconKey
                        ? <PoiIcon iconKey={poiIconKey} size={landmark.capitalOfRealmId ? 43 : 35} marketTier={landmark.marketTier} />
                        : (ATLAS_LANDMARK_GLYPHS[landmark.kind] || "◆")}
                    </span>
                    {landmark.quest && <i className="world-atlas__quest-pip" aria-hidden="true">!</i>}
                    {(zoomRatio >= 1.5 || landmark.capitalOfRealmId || selected) && (
                      <b aria-hidden="true">{landmark.name}</b>
                    )}
                  </button>
                );
              })}
              {questMarkers.map((quest) => {
                const screen = atlasWorldToScreen(camera, planeViewport, quest.coord);
                const offstage = screen.x < -40 || screen.y < -40 || screen.x > planeViewport.width + 40 || screen.y > planeViewport.height + 40;
                return (
                  <button
                    key={quest.id}
                    type="button"
                    hidden={offstage}
                    className="world-atlas__marker is-quest"
                    style={{ left: `${screen.x}px`, top: `${screen.y}px` }}
                    onClick={() => setSelection({ kind: "point", x: quest.coord.x, y: quest.coord.y })}
                    aria-label={`Quest objective: ${quest.title}`}
                  >
                    <span aria-hidden="true">✦</span>
                    <b aria-hidden="true">{quest.title}</b>
                  </button>
                );
              })}
              {trackedCharacter && (() => {
                const screen = atlasWorldToScreen(camera, planeViewport, trackedCharacter.pos);
                const offstage = screen.x < -40 || screen.y < -40 || screen.x > planeViewport.width + 40 || screen.y > planeViewport.height + 40;
                return (
                  <button
                    type="button"
                    hidden={offstage}
                    className={`world-atlas__marker is-tracked-character${trackedAtSelection ? " is-selected" : ""}`}
                    style={{ left: `${screen.x}px`, top: `${screen.y}px` }}
                    onClick={centerOnTrackedCharacter}
                    aria-label={`Tracked lead for ${trackedCharacter.name}`}
                    aria-pressed={trackedAtSelection}
                    aria-controls="world-atlas-detail"
                  >
                    <span aria-hidden="true">⌖</span>
                    <b aria-hidden="true">{trackedCharacter.name}</b>
                  </button>
                );
              })()}
            </div>

            {selection?.kind === "point" && (() => {
              const screen = atlasWorldToScreen(camera, planeViewport, selectedCoord);
              return (
                <span className="world-atlas__point-pin" style={{ left: `${screen.x}px`, top: `${screen.y}px` }} aria-hidden="true">
                  <i /><b />
                </span>
              );
            })()}

            <div
              className="world-atlas__party"
              style={{ left: `${partyScreen.x}px`, top: `${partyScreen.y}px` }}
              role="img"
              aria-label={`Your current position on ${CONTINENT.name}`}
            >
              <i aria-hidden="true" />
              <span aria-hidden="true">You</span>
            </div>
          </div>
        </div>

        {tilted && <div className="world-atlas__horizon" aria-hidden="true" />}

        <div className="world-atlas__chrome-top" data-atlas-wheel-ignore="true" onPointerDown={stopStagePointer}>
          <div className="world-atlas__topline">
            <div className="world-atlas__title-chip">
              <small>Wayfinder's survey</small>
              <h3 id="world-atlas-title">{CONTINENT.name}</h3>
            </div>
            <button
              type="button"
              className="world-atlas__search-pill"
              onClick={() => {
                setSearchOpen((open) => !open);
                setFiltersOpen(false);
              }}
              aria-expanded={searchOpen}
              aria-controls="world-atlas-search"
              aria-label={`Search ${landmarks.length} charted places`}
            >
              <i aria-hidden="true">⌕</i>
              <span>Find a place</span>
            </button>
            <button
              type="button"
              className="world-atlas__filter-pill"
              onClick={() => {
                setFiltersOpen((open) => !open);
                setSearchOpen(false);
              }}
              aria-expanded={filtersOpen}
              aria-controls="world-atlas-filters"
              aria-label={activeFilterCount > 0 ? `Map filters, ${activeFilterCount} active` : "Map filters"}
            >
              <i aria-hidden="true">☷</i>
              <span>Map filters</span>
              {activeFilterCount > 0 && <b aria-hidden="true">{activeFilterCount}</b>}
            </button>
          </div>

          {filtersOpen && (
            <aside id="world-atlas-filters" className="world-atlas__filters" aria-label="Map filters">
              <header>
                <span><small>Map display</small><b>Choose what earns attention</b></span>
                <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close map filters">×</button>
              </header>
              <section>
                <h4>Focus a realm</h4>
                <nav className="world-atlas__chips world-atlas__chips--realms" aria-label="Five biome realms">
                  <button
                    type="button"
                    className="is-all-realms"
                    aria-pressed={!focusedRealmId}
                    onClick={() => {
                      setFocusedRealmId(null);
                      setCamera((current) => clampAtlasCamera({ ...current, zoom: fit }, planeViewport));
                      setFiltersOpen(false);
                    }}
                  >
                    <i aria-hidden="true">◎</i><span>Whole continent</span>
                  </button>
                  {REALMS.map((realm) => (
                    <button
                      key={realm.id}
                      type="button"
                      className={`is-${realm.id}`}
                      aria-pressed={focusedRealmId === realm.id}
                      onClick={() => inspectRealm(realm)}
                      aria-label={`Focus ${realm.shortName}`}
                    >
                      <i aria-hidden="true" /><span>{realm.shortName}</span>
                    </button>
                  ))}
                </nav>
              </section>
              <section>
                <h4>Show destinations</h4>
                <div className="world-atlas__chips world-atlas__chips--layers" role="group" aria-label="Atlas marker layers">
                  {ATLAS_LAYERS.map((layer) => (
                    <button key={layer.id} type="button" aria-pressed={visibleLayers.has(layer.id)} onClick={() => toggleLayer(layer.id)}>
                      <i aria-hidden="true">{layer.glyph}</i><span>{layer.label}</span>
                    </button>
                  ))}
                </div>
              </section>
              <section className="world-atlas__map-key">
                <h4>Map key</h4>
                <div>
                  <span><i className="is-road" />Great road</span>
                  <span><i className="is-sea-lane" />Sea passage</span>
                  <span><i className="is-trail" />Travelled trail</span>
                  <span><i className="is-journey" />Next leg</span>
                  <span><i className="is-continuation" />Later legs</span>
                  <span><i className="is-character" />Tracked character</span>
                  <span><PoiTierMarker marketTier="royal" size={12} />Royal shop</span>
                  <span><PoiTierMarker marketTier="mastercraft" size={12} />Mastercraft</span>
                </div>
              </section>
            </aside>
          )}

          {searchOpen && (
            <div id="world-atlas-search" className="world-atlas__search" role="search">
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.key === "Escape" && setSearchOpen(false)}
                placeholder="Find a city, port, fort, or shrine…"
                aria-label={`Search ${CONTINENT.name} landmarks`}
              />
              <ul className="world-atlas__search-results">
                {searchResults.map((landmark) => {
                  const poiIconKey = poiIconKeyForLandmark(landmark);
                  return (
                    <li key={landmark.id}>
                      <button type="button" onClick={() => pickSearchResult(landmark)}>
                        <i aria-hidden="true">
                          {poiIconKey
                            ? <PoiIcon iconKey={poiIconKey} size={26} marketTier={landmark.marketTier} />
                            : (ATLAS_LANDMARK_GLYPHS[landmark.kind] || "◆")}
                        </i>
                        <span>
                          <b>{landmark.name}</b>
                          <small>
                            {atlasLandmarkTypeLabel(landmark)}
                            {" · "}
                            {REGION_DEFINITIONS[landmark.regionId]?.label || REALM_BY_ID[landmark.realmId]?.shortName || "Uncharted lands"}
                            {Number.isFinite(landmark.distance) ? ` · ${(landmark.distance * hexKilometers).toLocaleString()} km` : ""}
                          </small>
                        </span>
                        <em className={`is-${landmark.knowledgeTier}`}>{KNOWLEDGE_SHORT_LABELS[landmark.knowledgeTier]}</em>
                      </button>
                    </li>
                  );
                })}
                {searchResults.length === 0 && <li className="is-empty">No charted place matches that name.</li>}
              </ul>
            </div>
          )}
        </div>

        <div className="world-atlas__map-controls" data-atlas-wheel-ignore="true" onPointerDown={stopStagePointer}>
          <div role="group" aria-label="Map zoom controls">
            <button type="button" onClick={() => setCamera((current) => zoomAtlasCamera(current, planeViewport, 1.4))} disabled={camera.zoom >= ATLAS_MAX_ZOOM * 0.99} aria-label="Zoom map in">+</button>
            <button type="button" onClick={() => setCamera((current) => clampAtlasCamera({ ...current, zoom: fit }, planeViewport))} aria-label="Fit the whole continent">{Math.round(zoomRatio * 100)}%</button>
            <button type="button" onClick={() => setCamera((current) => zoomAtlasCamera(current, planeViewport, 1 / 1.4))} disabled={camera.zoom <= fit * 1.01} aria-label="Zoom map out">−</button>
          </div>
          <button
            type="button"
            className="world-atlas__dimension"
            onClick={toggleTilt}
            aria-pressed={tilted}
            aria-label={tilted ? "Switch to the flat chart view" : "Switch to the tabletop 3D view"}
          >
            {tilted ? "3D" : "2D"}
          </button>
          <button type="button" className="world-atlas__locate" onClick={centerOnParty} aria-label="Center map on the party">
            <i aria-hidden="true">◎</i><span>Party</span>
          </button>
          {trackedCharacter && (
            <button type="button" className="world-atlas__locate" onClick={centerOnTrackedCharacter} aria-label={`Center map on tracked character ${trackedCharacter.name}`} title={trackedCharacter.name}>
              <i aria-hidden="true">⌖</i><span>Track</span>
            </button>
          )}
        </div>

        <div className="world-atlas__chrome-bottom" data-atlas-wheel-ignore="true">
        <div className="world-atlas__foot" onPointerDown={stopStagePointer}>
          <div className="world-atlas__scale" role="img" aria-label={`View spans about ${kmAcross} kilometers; ${hexKilometers} kilometers per travel hex`}>
            <i aria-hidden="true" />
            <span>≈ {kmAcross.toLocaleString()} km across</span>
          </div>
        </div>

        {selectedCoord && (
          <aside
            id="world-atlas-detail"
            className={`world-atlas__placecard${detailExpanded ? " is-expanded" : ""}${journey && journey.risk >= 40 ? " is-danger" : ""}`}
            aria-live="polite"
            aria-label={`Atlas entry for ${detailTitle}`}
            onPointerDown={stopStagePointer}
          >
            <header className="world-atlas__placecard-head">
              <div className="world-atlas__placecard-copy">
                <small>
                  {detailTypeLabel}
                  {detailKnowledge ? ` · ${ATLAS_KNOWLEDGE_LABELS[detailKnowledge]}` : ""}
                  {detailAreaName ? ` · ${detailAreaName}` : ""}
                </small>
                <h4>{detailTitle}</h4>
                {journey ? (
                  <span className="world-atlas__placecard-journey">
                    <small>Route preview</small>
                    <b>{journey.kilometers.toLocaleString()} km · ≈{journey.duration}</b>
                    <em className={journey.risk >= 40 ? "is-danger" : ""}>{journey.risk}% next-leg risk</em>
                  </span>
                ) : (
                  <span className="world-atlas__placecard-journey is-blocked">
                    {selectionIsParty ? "The party is already here." : "No ground route reaches this point from the party's position."}
                  </span>
                )}
              </div>
              <div className="world-atlas__placecard-actions">
                <button
                  type="button"
                  className="world-atlas__more"
                  onClick={() => setDetailExpanded((expanded) => !expanded)}
                  aria-expanded={detailExpanded}
                  aria-controls="world-atlas-detail-body"
                >
                  {detailExpanded ? "Hide details" : "Details"}
                </button>
                {!selectionIsParty && journey && (
                  <button type="button" className="world-atlas__chart" onClick={chartSelection}>
                    <span>Set destination</span>
                  </button>
                )}
              </div>
            </header>

            <div id="world-atlas-detail-body" className="world-atlas__placecard-body" hidden={!detailExpanded}>
              <p>{trackedAtSelection
                ? `The Codex trail currently points toward ${trackedCharacter.name} here. It is a moving lead, not a guarantee; scrying can provide a clearer live reading.`
                : selectedLandmark?.description || detailRealm?.description || "Unsurveyed ground."}</p>
              <dl>
                <div><dt>Site type</dt><dd>{detailTypeLabel}</dd></div>
                <div><dt>Province</dt><dd title={detailProvince?.description}>{detailProvince?.name || detailRegion?.label || "Uncharted province"}</dd></div>
                <div><dt>Realm</dt><dd>{detailRealm?.name || "Unclaimed frontier"}</dd></div>
                <div><dt>Authority</dt><dd title={detailFaction?.description}>{detailFaction?.name || detailRealm?.faction?.name || "Independent"}</dd></div>
                <div><dt>Leader</dt><dd>{detailLeader ? `${detailLeader.name}${detailLeader.title ? ` · ${detailLeader.title}` : ""}` : "No single ruler"}</dd></div>
                <div><dt>Culture</dt><dd title={detailCulture?.description}>{cultureSummary || "Mixed frontier traditions"}</dd></div>
                <div><dt>Trade</dt><dd title={detailEconomy?.tradeNotes}>{tradeSummary || "Local exchange"}</dd></div>
                {selectedLandmark?.marketTier && <div><dt>Trade house</dt><dd><PoiTierMarker marketTier={selectedLandmark.marketTier} size={15} showLabel /></dd></div>}
                {selectedLandmark?.garrison && <div><dt>Garrison</dt><dd>{selectedLandmark.garrison}</dd></div>}
                <div className="is-wide"><dt>Connected routes</dt><dd title={detailRoutes.map((route) => route.name).join(", ")}>{routeSummary}</dd></div>
                {seaLaneSummary && <div className="is-wide"><dt>Sea passages</dt><dd>{seaLaneSummary}</dd></div>}
              </dl>

              {journey && (
                <div className="world-atlas__journey-plan" aria-label={`Journey plan to ${detailTitle}`}>
                  {journey.waypoints.length > 0 && (
                    <p className="world-atlas__journey-via">Via {journey.waypoints.map((waypoint) => waypoint.name).join(" · ")}</p>
                  )}
                  {journey.checkpoints.length > 0 && (
                    <p className="world-atlas__journey-gates">Border checkpoints: {journey.checkpoints.map((checkpoint) => checkpoint.name).join(" · ")}</p>
                  )}
                </div>
              )}
            </div>
          </aside>
        )}
        </div>
      </div>
    </section>
  );
}
