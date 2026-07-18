import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  atlasFitZoom,
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
  zoomAtlasCamera,
} from "./worldAtlasModel.js";

const useAtlasLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

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
const ATLAS_ACTIVE_RASTER_REFRESH = 180;
const ATLAS_WHEEL_IGNORE_SELECTOR = "[data-atlas-wheel-ignore]";
const ATLAS_RASTER_MIN_OVERSCAN = 128;
const ATLAS_RASTER_MAX_OVERSCAN = 180;
const ATLAS_RASTER_COVERAGE_RESERVE = 48;

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

// Pointer capture keeps delivering a marker's synthetic click after the map
// has been dragged. Keyboard activation has detail === 0 and must continue to
// work, while pointer clicks are ignored until the next clean pointerdown.
export function atlasSelectionClickAllowed(event, gesture) {
  return event?.detail === 0 || !gesture?.suppressClick;
}

export function atlasKeyboardShortcutAllowed(target) {
  const element = target?.nodeType === 1 ? target : target?.parentElement || target;
  return !element?.closest?.("button, a, input, select, textarea, [contenteditable='true']");
}

// While a new detailed raster is painted offscreen, keep the last completed
// terrain frame aligned with the live vector layer. This is the same visual
// continuity users expect from a maps app: movement transforms existing map
// detail instead of replacing it with a coarse placeholder on every frame.
export function atlasRasterTransform(camera, renderedCamera, viewport) {
  if (!camera || !renderedCamera || !viewport) return "none";
  const scale = camera.zoom / renderedCamera.zoom;
  const x = viewport.width / 2 * (1 - scale) + (renderedCamera.x - camera.x) * camera.zoom;
  const y = viewport.height / 2 * (1 - scale) + (renderedCamera.y - camera.y) * camera.zoom;
  return `matrix(${scale}, 0, 0, ${scale}, ${x}, ${y})`;
}

export function atlasRasterCoversViewport(
  camera,
  renderedCamera,
  rasterViewport,
  planeViewport,
  overscan,
  reserve = 0,
) {
  if (!camera || !renderedCamera || !rasterViewport || !planeViewport) return false;
  const scale = camera.zoom / renderedCamera.zoom;
  const x = rasterViewport.width / 2 * (1 - scale) + (renderedCamera.x - camera.x) * camera.zoom;
  const y = rasterViewport.height / 2 * (1 - scale) + (renderedCamera.y - camera.y) * camera.zoom;
  // CSS left/top place the canvas outside its transform, so that layout
  // offset stays fixed while only the canvas box itself scales.
  const left = -overscan + x;
  const top = -overscan + y;
  const right = left + rasterViewport.width * scale;
  const bottom = top + rasterViewport.height * scale;
  return left <= -reserve
    && top <= -reserve
    && right >= planeViewport.width + reserve
    && bottom >= planeViewport.height + reserve;
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
function paintAtlas({
  canvas,
  camera,
  viewport,
  seed,
  seenKeys,
  token,
  buffer: suppliedBuffer,
  presentPreview = true,
  presentPartials = true,
  onPreview,
  onDetailed,
}) {
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
  const buffer = suppliedBuffer || canvas.ownerDocument?.createElement?.("canvas") || canvas;
  if (buffer.width !== pixelWidth) buffer.width = pixelWidth;
  if (buffer.height !== pixelHeight) buffer.height = pixelHeight;
  const context = buffer.getContext("2d", { alpha: false });
  if (!displayContext || !context) return false;
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

  // Only the first frame (or a resized canvas) needs a coarse fallback. Once a
  // detailed raster exists, camera gestures skip this work entirely and keep
  // transforming the completed frame until the new detailed buffer is ready.
  if (presentPreview) {
    const previewGrid = gridFor(step * 4);
    for (let previewRow = 0; previewRow < previewGrid.rows; previewRow += 1) {
      const y = previewGrid.ymin + previewRow * previewGrid.step;
      for (let column = 0; column < previewGrid.columns; column += 1) {
        paintCell(previewGrid, previewGrid.xmin + column * previewGrid.step, y, false);
      }
    }
    present();
    if (!token.cancelled) onPreview?.();
  }

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
      if (presentPartials && now - lastPresent > 120) {
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
    if (!token.cancelled) onDetailed?.();
  };
  token.frame = requestAnimationFrame(paintChunk);
  return true;
}

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

const AtlasPlaceCard = memo(function AtlasPlaceCard({ entry, onChart }) {
  const [expanded, setExpanded] = useState(false);
  const {
    areaName,
    culture,
    cultureSummary,
    economy,
    faction,
    journey,
    knowledge,
    landmark,
    leader,
    province,
    realm,
    region,
    routeSummary,
    routes,
    seaLaneSummary,
    selectionIsParty,
    title,
    trackedDescription,
    tradeSummary,
    typeLabel,
  } = entry;

  return (
    <aside
      id="world-atlas-detail"
      className={`world-atlas__placecard${expanded ? " is-expanded" : ""}${journey && journey.risk >= 40 ? " is-danger" : ""}`}
      data-atlas-selection-key={entry.selectionKey}
      aria-live="polite"
      aria-label={`Atlas entry for ${title}`}
      onPointerDown={stopStagePointer}
    >
      <header className="world-atlas__placecard-head">
        <div className="world-atlas__placecard-copy">
          <small>
            {typeLabel}
            {knowledge ? ` · ${ATLAS_KNOWLEDGE_LABELS[knowledge]}` : ""}
            {areaName ? ` · ${areaName}` : ""}
          </small>
          <h4>{title}</h4>
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
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            aria-controls="world-atlas-detail-body"
          >
            {expanded ? "Hide details" : "Details"}
          </button>
          {!selectionIsParty && journey && (
            <button type="button" className="world-atlas__chart" onClick={onChart}>
              <span>Set destination</span>
            </button>
          )}
        </div>
      </header>

      <div id="world-atlas-detail-body" className="world-atlas__placecard-body" hidden={!expanded}>
        <p>{trackedDescription || landmark?.description || realm?.description || "Unsurveyed ground."}</p>
        <dl>
          <div><dt>Site type</dt><dd>{typeLabel}</dd></div>
          <div><dt>Province</dt><dd title={province?.description}>{province?.name || region?.label || "Uncharted province"}</dd></div>
          <div><dt>Realm</dt><dd>{realm?.name || "Unclaimed frontier"}</dd></div>
          <div><dt>Authority</dt><dd title={faction?.description}>{faction?.name || realm?.faction?.name || "Independent"}</dd></div>
          <div><dt>Leader</dt><dd>{leader ? `${leader.name}${leader.title ? ` · ${leader.title}` : ""}` : "No single ruler"}</dd></div>
          <div><dt>Culture</dt><dd title={culture?.description}>{cultureSummary || "Mixed frontier traditions"}</dd></div>
          <div><dt>Trade</dt><dd title={economy?.tradeNotes}>{tradeSummary || "Local exchange"}</dd></div>
          {landmark?.marketTier && <div><dt>Trade house</dt><dd><PoiTierMarker marketTier={landmark.marketTier} size={15} showLabel /></dd></div>}
          {landmark?.garrison && <div><dt>Garrison</dt><dd>{landmark.garrison}</dd></div>}
          <div className="is-wide"><dt>Connected routes</dt><dd title={routes.map((route) => route.name).join(", ")}>{routeSummary}</dd></div>
          {seaLaneSummary && <div className="is-wide"><dt>Sea passages</dt><dd>{seaLaneSummary}</dd></div>}
        </dl>

        {journey && (
          <div className="world-atlas__journey-plan" aria-label={`Journey plan to ${title}`}>
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
  );
});

export function WorldAtlas({ state, origin, onPick, initialSelection = null, toolbarActions = null }) {
  const seed = state?.world?.seed || CONTINENT.seed;
  const partyCoord = origin || state?.world?.currentTile || CONTINENT.start.coord;
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const searchInputRef = useRef(null);
  const gestureRef = useRef({
    pointers: new Map(),
    moved: false,
    dragDistance: 0,
    suppressClick: false,
    startedOnInteractive: false,
    hadMultiplePointers: false,
    lastAt: null,
  });
  const cameraFrameRef = useRef({ frame: 0, operations: [] });
  const rasterBufferRef = useRef(null);
  const rasterFrameRef = useRef(null);
  const rasterSchedulerRef = useRef({
    timer: 0,
    active: null,
    latest: null,
    generation: "",
    lastCompletedAt: 0,
    disposed: false,
  });
  const wheelRef = useRef({ frame: 0, deltaY: 0, anchor: null, lastAt: null });
  const didInitialFitRef = useRef(false);
  const [viewport, setViewport] = useState(INITIAL_ATLAS_VIEWPORT);
  const [stageMeasured, setStageMeasured] = useState(false);
  // The atlas is a focused 2D chart. A single plane keeps the terrain, routes,
  // labels, pointer math, and accessibility controls in the same coordinate
  // system instead of offering a decorative perspective mode.
  const planeViewport = viewport;
  const rasterOverscan = Math.max(
    ATLAS_RASTER_MIN_OVERSCAN,
    Math.min(ATLAS_RASTER_MAX_OVERSCAN, Math.round(Math.min(planeViewport.width, planeViewport.height) * 0.22)),
  );
  const rasterViewport = useMemo(() => ({
    width: planeViewport.width + rasterOverscan * 2,
    height: planeViewport.height + rasterOverscan * 2,
  }), [planeViewport.width, planeViewport.height, rasterOverscan]);
  const [camera, setCamera] = useState(() => {
    const plane = INITIAL_ATLAS_VIEWPORT;
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
  const [rasterFrame, setRasterFrame] = useState(null);

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
  // while merely keeping it legal on later resizes.
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

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  // Paint the raster whenever the camera, plane, seed, or discoveries change.
  const seenSignature = Object.keys(state?.world?.seen || {}).join("|");
  const seenKeys = useMemo(
    () => (seenSignature ? seenSignature.split("|") : []),
    [seenSignature],
  );
  const rasterPixelRatio = typeof window !== "undefined"
    ? Math.max(1, Math.min(2, window.devicePixelRatio || 1))
    : 1;
  const rasterGeneration = `${rasterViewport.width}x${rasterViewport.height}@${rasterPixelRatio}|${seed}|${seenSignature}`;
  const rasterFrameMatchesViewport = !!(
    rasterFrame
    && rasterFrame.generation === rasterGeneration
    && rasterFrame.width === rasterViewport.width
    && rasterFrame.height === rasterViewport.height
  );

  function cancelRasterToken(token) {
    if (!token) return;
    token.cancelled = true;
    if (token.frame && typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(token.frame);
    token.frame = 0;
  }

  function stopRasterScheduler() {
    const scheduler = rasterSchedulerRef.current;
    if (scheduler.timer) clearTimeout(scheduler.timer);
    scheduler.timer = 0;
    cancelRasterToken(scheduler.active?.token);
    scheduler.active = null;
    scheduler.latest = null;
  }

  function scheduleRasterPaint() {
    const scheduler = rasterSchedulerRef.current;
    const latest = scheduler.latest;
    if (scheduler.disposed || scheduler.active || !latest) return;
    if (scheduler.timer) clearTimeout(scheduler.timer);
    scheduler.timer = 0;

    const frame = rasterFrameRef.current;
    const frameMatches = !!(
      frame
      && frame.generation === latest.generation
      && frame.width === latest.viewport.width
      && frame.height === latest.viewport.height
    );
    const needsPaint = !frameMatches || !frame.detailed || !sameCamera(frame.camera, latest.camera);
    if (!needsPaint) return;

    const now = Date.now();
    const wheelIdleFor = wheelRef.current.lastAt == null ? Infinity : now - wheelRef.current.lastAt;
    const pointerIdleFor = gestureRef.current.lastAt == null ? Infinity : now - gestureRef.current.lastAt;
    const interactionIdleFor = Math.min(wheelIdleFor, pointerIdleFor);
    const idleDelay = Math.max(0, ATLAS_WHEEL_REFINE_DELAY - interactionIdleFor);
    const refreshDelay = Math.max(0, ATLAS_ACTIVE_RASTER_REFRESH - (now - scheduler.lastCompletedAt));

    // The first or resized frame paints immediately. During continuous input,
    // refresh the overscanned raster at a bounded cadence; otherwise wait for
    // the short idle window so pointer traffic cannot restart terrain work.
    if (!frameMatches || latest.urgent || idleDelay === 0 || refreshDelay === 0) {
      startRasterPaint();
      return;
    }
    scheduler.timer = setTimeout(startRasterPaint, Math.min(idleDelay, refreshDelay));
  }

  function startRasterPaint() {
    const scheduler = rasterSchedulerRef.current;
    if (scheduler.disposed || scheduler.active || !scheduler.latest) return;
    if (scheduler.timer) clearTimeout(scheduler.timer);
    scheduler.timer = 0;

    const job = scheduler.latest;
    const existingFrame = rasterFrameRef.current;
    const hasUsableFrame = !!(
      existingFrame
      && existingFrame.generation === job.generation
      && existingFrame.width === job.viewport.width
      && existingFrame.height === job.viewport.height
    );
    const token = { cancelled: false, frame: 0 };
    scheduler.active = {
      token,
      generation: job.generation,
      camera: job.camera,
      viewport: job.viewport,
    };
    const beginPaint = () => {
      token.frame = 0;
      if (token.cancelled || scheduler.disposed || scheduler.active?.token !== token) return;
      if (!rasterBufferRef.current) {
        rasterBufferRef.current = job.canvas.ownerDocument?.createElement?.("canvas") || null;
      }

      const publishFrame = (detailed) => {
        if (token.cancelled || scheduler.disposed || scheduler.active?.token !== token) return;
        const latest = scheduler.latest;
        if (!latest || latest.generation !== job.generation) return;
        const frame = {
          camera: job.camera,
          width: job.viewport.width,
          height: job.viewport.height,
          generation: job.generation,
          detailed,
        };
        // Pair the newly presented pixels with their render camera in the same
        // browser task. If input advanced while painting, immediately align
        // those pixels to the newest camera before React's next paint.
        job.canvas.style.transform = atlasRasterTransform(latest.camera, job.camera, job.viewport);
        rasterFrameRef.current = frame;
        latest.urgent = !atlasRasterCoversViewport(
          latest.camera,
          job.camera,
          job.viewport,
          latest.planeViewport,
          latest.overscan,
          ATLAS_RASTER_COVERAGE_RESERVE,
        );
        latest.forcePreview = !atlasRasterCoversViewport(
          latest.camera,
          job.camera,
          job.viewport,
          latest.planeViewport,
          latest.overscan,
        );
        setRasterFrame(frame);
      };

      const started = paintAtlas({
        canvas: job.canvas,
        camera: job.camera,
        viewport: job.viewport,
        seed: job.seed,
        seenKeys: job.seenKeys,
        token,
        buffer: rasterBufferRef.current,
        presentPreview: !hasUsableFrame || job.forcePreview,
        presentPartials: !hasUsableFrame,
        onPreview: () => publishFrame(false),
        onDetailed: () => {
          publishFrame(true);
          if (scheduler.active?.token !== token) return;
          scheduler.active = null;
          scheduler.lastCompletedAt = Date.now();
          scheduleRasterPaint();
        },
      });
      if (!started && scheduler.active?.token === token) {
        scheduler.active = null;
      }
    };
    if (job.forcePreview) beginPaint();
    else token.frame = requestAnimationFrame(beginPaint);
  }

  useAtlasLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!stageMeasured || !canvas || typeof requestAnimationFrame === "undefined") return undefined;
    const scheduler = rasterSchedulerRef.current;
    scheduler.disposed = false;
    if (scheduler.generation !== rasterGeneration) {
      if (scheduler.timer) clearTimeout(scheduler.timer);
      scheduler.timer = 0;
      cancelRasterToken(scheduler.active?.token);
      scheduler.active = null;
      scheduler.generation = rasterGeneration;
      scheduler.lastCompletedAt = 0;
    }
    const frame = rasterFrameRef.current;
    const frameMatches = !!(
      frame
      && frame.generation === rasterGeneration
      && frame.width === rasterViewport.width
      && frame.height === rasterViewport.height
    );
    const needsCoverageRefresh = frameMatches && !atlasRasterCoversViewport(
      camera,
      frame.camera,
      rasterViewport,
      planeViewport,
      rasterOverscan,
      ATLAS_RASTER_COVERAGE_RESERVE,
    );
    const frameIsUncovered = frameMatches && !atlasRasterCoversViewport(
      camera,
      frame.camera,
      rasterViewport,
      planeViewport,
      rasterOverscan,
    );
    scheduler.latest = {
      canvas,
      camera,
      viewport: rasterViewport,
      planeViewport,
      overscan: rasterOverscan,
      seed,
      seenKeys,
      generation: rasterGeneration,
      urgent: needsCoverageRefresh,
      forcePreview: frameIsUncovered,
    };
    if (needsCoverageRefresh && scheduler.active) {
      const active = scheduler.active;
      const activeWillCover = active.generation === rasterGeneration && atlasRasterCoversViewport(
        camera,
        active.camera,
        active.viewport,
        planeViewport,
        rasterOverscan,
        ATLAS_RASTER_COVERAGE_RESERVE,
      );
      if (frameIsUncovered || !activeWillCover) {
        cancelRasterToken(active.token);
        scheduler.active = null;
      }
    }
    scheduleRasterPaint();
    // Camera-only renders normally leave the active painter alone. Coverage
    // pressure is the exception: preempt a stale job before its retained frame
    // reaches an edge, and synchronously promote a coarse emergency fallback
    // only if a single large input delta already uncovered the stage.
    return undefined;
  }, [camera, planeViewport, rasterGeneration, rasterOverscan, rasterViewport, seed, seenKeys, stageMeasured]);

  useAtlasLayoutEffect(() => {
    const scheduler = rasterSchedulerRef.current;
    scheduler.disposed = false;
    return () => {
      scheduler.disposed = true;
      stopRasterScheduler();
    };
  }, []);

  // Wheel zoom needs a non-passive listener so the chart, rather than the page,
  // owns a wheel gesture made over open map terrain.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const onWheel = (event) => {
      if (!atlasWheelZoomAllowed(event.target) || event.deltaY === 0) return;
      event.preventDefault();
      const bounds = stage.getBoundingClientRect();
      const anchor = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
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
  }, [viewport, planeViewport]);

  // Coalesce pointer camera updates to one React render per animation frame.
  // Raw mobile pointermove streams can be much faster than the display.
  function queueCameraOperations(operations) {
    const pending = cameraFrameRef.current;
    pending.operations.push(...operations);
    if (pending.frame || typeof requestAnimationFrame === "undefined") return;
    pending.frame = requestAnimationFrame(() => {
      pending.frame = 0;
      const queued = pending.operations.splice(0);
      setCamera((current) => {
        let next = current;
        for (const operation of queued) {
          if (operation.type === "zoom") {
            next = zoomAtlasCamera(next, planeViewport, operation.factor, operation.anchor);
          } else if (operation.dx || operation.dy) {
            next = panAtlasCamera(next, planeViewport, operation.dx, operation.dy);
          }
        }
        return sameCamera(current, next) ? current : next;
      });
    });
  }

  function cancelQueuedCameraOperations() {
    const pending = cameraFrameRef.current;
    if (pending.frame) cancelAnimationFrame(pending.frame);
    pending.frame = 0;
    pending.operations.length = 0;
  }

  useEffect(() => () => cancelQueuedCameraOperations(), []);

  function planePoint(event) {
    const bounds = stageRef.current.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }

  function handlePointerDown(event) {
    const gesture = gestureRef.current;
    gesture.pointers.set(event.pointerId, planePoint(event));
    if (gesture.pointers.size === 1) {
      gesture.suppressClick = false;
      gesture.moved = false;
      gesture.dragDistance = 0;
      gesture.startedOnInteractive = !!event.target.closest?.("button, a, input, select, textarea");
      gesture.hadMultiplePointers = false;
    }
    if (gesture.pointers.size > 1) {
      gesture.hadMultiplePointers = true;
      gesture.moved = true;
      gesture.suppressClick = true;
    }
    stageRef.current.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event) {
    const gesture = gestureRef.current;
    if (!gesture.pointers.has(event.pointerId)) return;
    const point = planePoint(event);
    const previous = gesture.pointers.get(event.pointerId);

    if (gesture.pointers.size === 2) {
      const [beforeA, beforeB] = [...gesture.pointers.values()];
      const beforeDistance = Math.hypot(beforeA.x - beforeB.x, beforeA.y - beforeB.y);
      const beforeMidpoint = { x: (beforeA.x + beforeB.x) / 2, y: (beforeA.y + beforeB.y) / 2 };
      gesture.pointers.set(event.pointerId, point);
      const [afterA, afterB] = [...gesture.pointers.values()];
      const distance = Math.hypot(afterA.x - afterB.x, afterA.y - afterB.y);
      const midpoint = { x: (afterA.x + afterB.x) / 2, y: (afterA.y + afterB.y) / 2 };
      const dx = midpoint.x - beforeMidpoint.x;
      const dy = midpoint.y - beforeMidpoint.y;
      const factor = beforeDistance > 0 ? distance / beforeDistance : 1;
      if (Math.hypot(dx, dy) > 0.25 || Math.abs(distance - beforeDistance) > 0.5) {
        gesture.moved = true;
        gesture.suppressClick = true;
        gesture.lastAt = Date.now();
        const operations = [];
        if (dx || dy) operations.push({ type: "pan", dx, dy });
        if (factor !== 1) operations.push({ type: "zoom", factor, anchor: midpoint });
        queueCameraOperations(operations);
      }
      return;
    }
    gesture.pointers.set(event.pointerId, point);
    if (gesture.pointers.size > 2) return;

    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    gesture.dragDistance += Math.hypot(dx, dy);
    if (!gesture.moved && gesture.dragDistance < 4) return;
    gesture.moved = true;
    gesture.suppressClick = true;
    gesture.lastAt = Date.now();
    queueCameraOperations([{ type: "pan", dx, dy }]);
  }

  function handlePointerUp(event) {
    const gesture = gestureRef.current;
    const hadPointer = gesture.pointers.delete(event.pointerId);
    stageRef.current?.releasePointerCapture?.(event.pointerId);
    if (!hadPointer) return;
    if (gesture.moved || gesture.hadMultiplePointers) {
      gesture.suppressClick = true;
      return;
    }
    if (gesture.pointers.size > 0) return;
    if (gesture.startedOnInteractive || event.target.closest?.("button, a, input, select, textarea")) return;
    // A clean tap on open ground charts that coordinate.
    const fractional = atlasScreenToWorld(camera, planeViewport, planePoint(event));
    const coord = axialRound(fractional.x, fractional.y);
    const sample = cachedSurvey(coord.x, coord.y, seed);
    if (!sample.land) return;
    setSelection({ kind: "point", x: coord.x, y: coord.y });
  }

  function handlePointerCancel(event) {
    const gesture = gestureRef.current;
    const hadPointer = gesture.pointers.delete(event.pointerId);
    stageRef.current?.releasePointerCapture?.(event.pointerId);
    if (!hadPointer) return;
    cancelQueuedCameraOperations();
    gesture.moved = true;
    gesture.suppressClick = true;
  }

  function handleKeyDown(event) {
    if (!atlasKeyboardShortcutAllowed(event.target)) {
      if (event.key === "Escape" && (searchOpen || filtersOpen)) {
        setSearchOpen(false);
        setFiltersOpen(false);
        event.preventDefault();
      }
      return;
    }
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

  // The dossier deliberately excludes camera state. React.memo can therefore
  // leave the expanded card and its scroll position untouched while a drag or
  // wheel gesture updates the map behind it.
  const detailEntry = useMemo(() => {
    if (!selectedCoord) return null;
    const realm = REALM_BY_ID[selectedLandmark?.realmId || selectedSurvey?.realmId] || null;
    const region = REGION_DEFINITIONS[selectedLandmark?.regionId || selectedSurvey?.regionId] || null;
    const province = (selectedLandmark?.provinceId && PROVINCE_BY_ID[selectedLandmark.provinceId])
      || PROVINCES.find((item) => item.seatLandmarkId === selectedLandmark?.id)
      || null;
    const factionId = selectedLandmark?.factionId
      || selectedLandmark?.controllingFactionId
      || province?.authorityFactionId
      || realm?.faction?.id;
    const faction = FACTION_BY_ID[factionId] || null;
    const culture = CULTURE_BY_REALM_ID[realm?.id] || null;
    const economy = ECONOMY_BY_REALM_ID[realm?.id] || null;
    const leader = faction?.leader || province?.governor || realm?.ruler;
    const routes = selectedLandmark ? atlasRoutesForLandmark(selectedLandmark) : [];
    const seaLanes = selectedLandmark?.kind === "port"
      ? CONTINENT_SEA_LANES.filter((lane) => lane.portIds?.includes(selectedLandmark.id))
      : [];
    const typeLabel = trackedAtSelection
      ? "Tracked playable character"
      : selectedLandmark
      ? atlasLandmarkTypeLabel(selectedLandmark)
      : (selectedSurvey ? (TERRAINS[selectedSurvey.terrain]?.label || "Open country") : "Unknown ground");
    const title = (trackedAtSelection ? trackedCharacter.name : null)
      || selectedLandmark?.name
      || (selectedSurvey ? `${TERRAINS[selectedSurvey.terrain]?.label || "Open country"} (${selectedCoord.x}, ${selectedCoord.y})` : "Uncharted");
    const cultureSummary = culture
      ? [culture.demonym, compactList(culture.languages, 2)].filter(Boolean).join(" · ")
      : realm?.biomeName;
    const tradeSummary = compactList(economy?.exports)
      || economy?.tradeNotes
      || compactList(region?.features);
    return {
      selectionKey,
      coord: { x: selectedCoord.x, y: selectedCoord.y },
      landmark: selectedLandmark,
      realm,
      region,
      province,
      faction,
      culture,
      economy,
      leader,
      routes,
      typeLabel,
      title,
      journey,
      knowledge: selectedLandmark ? landmarkKnowledge(state, selectedLandmark) : null,
      areaName: province?.name || region?.label || realm?.shortName || "Uncharted lands",
      cultureSummary,
      tradeSummary,
      routeSummary: compactList(routes.map((route) => route.name), 4) || "No charted road",
      seaLaneSummary: compactList(seaLanes.map((lane) => lane.name), 3),
      selectionIsParty: selectedCoord.x === partyCoord.x && selectedCoord.y === partyCoord.y,
      trackedDescription: trackedAtSelection
        ? `The Codex trail currently points toward ${trackedCharacter.name} here. It is a moving lead, not a guarantee; scrying can provide a clearer live reading.`
        : null,
    };
  }, [
    journey,
    partyCoord.x,
    partyCoord.y,
    selectedCoord?.x,
    selectedCoord?.y,
    selectedLandmark,
    selectedSurvey,
    selectionKey,
    state,
    trackedAtSelection,
    trackedCharacter,
  ]);

  const chartSelection = useCallback(() => {
    if (!detailEntry) return;
    const { coord, landmark } = detailEntry;
    const tile = getTile(state, coord.x, coord.y);
    onPick({
      x: coord.x,
      y: coord.y,
      key: `${coord.x},${coord.y}`,
      tile,
      name: landmark?.name || (trackedAtSelection ? trackedCharacter.name : null),
      knownBy: landmark ? landmarkKnowledge(state, landmark) : null,
    });
  }, [detailEntry, onPick, state, trackedAtSelection, trackedCharacter]);

  const activeFilterCount = (focusedRealmId ? 1 : 0) + (ATLAS_LAYERS.length - visibleLayers.size);

  return (
    <section
      className="world-atlas"
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
        onPointerCancel={handlePointerCancel}
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
            <canvas
              ref={canvasRef}
              className="world-atlas__canvas"
              style={{
                width: `${rasterViewport.width}px`,
                height: `${rasterViewport.height}px`,
                left: `${-rasterOverscan}px`,
                top: `${-rasterOverscan}px`,
                right: "auto",
                bottom: "auto",
                transform: atlasRasterTransform(
                  camera,
                  rasterFrameMatchesViewport ? rasterFrame.camera : null,
                  rasterViewport,
                ),
                transformOrigin: "0 0",
              }}
              aria-hidden="true"
            />

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
                    onClick={(event) => {
                      if (atlasSelectionClickAllowed(event, gestureRef.current)) inspectLandmark(landmark);
                    }}
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
                    onClick={(event) => {
                      if (atlasSelectionClickAllowed(event, gestureRef.current)) {
                        setSelection({ kind: "point", x: quest.coord.x, y: quest.coord.y });
                      }
                    }}
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
                    onClick={(event) => {
                      if (atlasSelectionClickAllowed(event, gestureRef.current)) centerOnTrackedCharacter();
                    }}
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
            {toolbarActions && <div className="world-atlas__toolbar-actions">{toolbarActions}</div>}
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

        {detailEntry && <AtlasPlaceCard key={detailEntry.selectionKey} entry={detailEntry} onChart={chartSelection} />}
        </div>
      </div>
    </section>
  );
}
