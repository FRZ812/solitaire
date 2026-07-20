import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";
import { CONTINENT } from "../../data/continent.js";
import {
  ATLAS_PAPER_PALETTE,
  atlasPaperBaseKey,
  atlasPaperBasePlacement,
  atlasPaperPick,
  atlasPaperPickFractional,
  buildAtlasPaperBaseModel,
  buildAtlasPaperDynamicModel,
  normalizeAtlasPaperPixelRatio,
} from "./atlasPaperMapModel.js";

const useAtlasPaperLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
const PAPER_BASE_CACHE = new Map();

function tracePoints(context, points, close = false) {
  if (!points?.length) return false;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x, points[index].y);
  }
  if (close) context.closePath();
  return true;
}

function strokePath(context, points, { color, width, dash = [] }) {
  if (!tracePoints(context, points)) return;
  context.strokeStyle = color;
  context.lineWidth = width;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.setLineDash(dash);
  context.stroke();
  context.setLineDash([]);
}

export function renderAtlasPaperBase(context, model) {
  const { width, height } = model.layout;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);

  const sea = context.createRadialGradient(
    width * 0.48,
    height * 0.45,
    Math.min(width, height) * 0.08,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.7,
  );
  sea.addColorStop(0, ATLAS_PAPER_PALETTE.ocean);
  sea.addColorStop(1, ATLAS_PAPER_PALETTE.oceanDeep);
  context.fillStyle = sea;
  context.fillRect(0, 0, width, height);

  for (const mark of model.wash) {
    context.save();
    context.translate(mark.x, mark.y);
    context.rotate(mark.rotation);
    context.fillStyle = mark.light
      ? `rgba(234, 216, 170, ${mark.alpha})`
      : `rgba(27, 47, 48, ${mark.alpha})`;
    context.beginPath();
    context.ellipse(0, 0, mark.radiusX, mark.radiusY, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  context.save();
  context.translate(0, 10);
  if (tracePoints(context, model.coastline, true)) {
    context.fillStyle = "rgba(24, 37, 34, 0.36)";
    context.fill();
  }
  context.restore();

  context.save();
  tracePoints(context, model.coastline, true);
  context.clip();
  const land = context.createLinearGradient(0, 0, width, height);
  land.addColorStop(0, ATLAS_PAPER_PALETTE.parchmentLight);
  land.addColorStop(0.52, ATLAS_PAPER_PALETTE.parchment);
  land.addColorStop(1, ATLAS_PAPER_PALETTE.parchmentDark);
  context.fillStyle = land;
  context.fillRect(0, 0, width, height);

  for (const realm of model.realms) {
    const tint = context.createRadialGradient(
      realm.center.x,
      realm.center.y,
      0,
      realm.center.x,
      realm.center.y,
      Math.max(1, realm.radius),
    );
    tint.addColorStop(0, realm.color);
    tint.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = tint;
    context.fillRect(
      realm.center.x - realm.radius,
      realm.center.y - realm.radius,
      realm.radius * 2,
      realm.radius * 2,
    );
  }

  for (const fiber of model.fibers) {
    context.strokeStyle = `rgba(71, 50, 30, ${fiber.alpha})`;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(fiber.x, fiber.y);
    context.lineTo(fiber.x + fiber.dx, fiber.y + fiber.dy);
    context.stroke();
  }
  context.restore();

  for (const waterway of model.waterways) {
    strokePath(context, waterway.points, {
      color: "rgba(38, 59, 58, 0.54)",
      width: 8,
    });
    strokePath(context, waterway.points, {
      color: ATLAS_PAPER_PALETTE.river,
      width: 4.2,
    });
    strokePath(context, waterway.points, {
      color: ATLAS_PAPER_PALETTE.riverHighlight,
      width: 1.15,
    });
  }

  for (const route of model.routes) {
    strokePath(context, route.points, {
      color: "rgba(57, 39, 24, 0.5)",
      width: route.regional ? 4.4 : 6.4,
    });
    strokePath(context, route.points, {
      color: ATLAS_PAPER_PALETTE.route,
      width: route.regional ? 2.4 : 3.4,
      dash: route.regional ? [9, 6] : [],
    });
    if (!route.regional) {
      strokePath(context, route.points, {
        color: ATLAS_PAPER_PALETTE.routeHighlight,
        width: 0.85,
      });
    }
  }

  strokePath(context, model.coastline, {
    color: "rgba(240, 214, 157, 0.38)",
    width: 10,
  });
  if (tracePoints(context, model.coastline, true)) {
    context.strokeStyle = ATLAS_PAPER_PALETTE.ink;
    context.lineWidth = 4;
    context.lineJoin = "round";
    context.stroke();
  }
  if (tracePoints(context, model.coastline, true)) {
    context.strokeStyle = "rgba(238, 215, 166, 0.58)";
    context.lineWidth = 1.1;
    context.stroke();
  }

  context.textAlign = "center";
  context.textBaseline = "middle";
  for (const label of model.labels) {
    const fontSize = label.id === "central" ? 31 : 27;
    context.font = `700 ${fontSize}px Alegreya, Georgia, serif`;
    context.lineWidth = 5;
    context.strokeStyle = "rgba(222, 198, 143, 0.68)";
    context.strokeText(label.text.toUpperCase(), label.point.x, label.point.y);
    context.fillStyle = "rgba(57, 46, 33, 0.8)";
    context.fillText(label.text.toUpperCase(), label.point.x, label.point.y);
  }
}

function createBaseCanvas(model) {
  let canvas = null;
  if (typeof OffscreenCanvas !== "undefined") {
    canvas = new OffscreenCanvas(model.layout.width, model.layout.height);
  } else if (typeof document !== "undefined") {
    canvas = document.createElement("canvas");
    canvas.width = model.layout.width;
    canvas.height = model.layout.height;
  }
  if (!canvas) return null;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return null;
  renderAtlasPaperBase(context, model);
  return canvas;
}

function paperBase(seed, pixelRatio) {
  const key = atlasPaperBaseKey(seed, pixelRatio);
  if (PAPER_BASE_CACHE.has(key)) return PAPER_BASE_CACHE.get(key);
  const model = buildAtlasPaperBaseModel(seed, { pixelRatio });
  const canvas = createBaseCanvas(model);
  const value = canvas ? { key, canvas, model } : null;
  if (value) PAPER_BASE_CACHE.set(key, value);
  // A world seed normally owns one entry. Bound development seed/DPR churn.
  if (PAPER_BASE_CACHE.size > 6) PAPER_BASE_CACHE.delete(PAPER_BASE_CACHE.keys().next().value);
  return value;
}

export function clearAtlasPaperBaseCache() {
  PAPER_BASE_CACHE.clear();
}

function onStage(point, viewport, margin = 24) {
  return point.x >= -margin
    && point.y >= -margin
    && point.x <= viewport.width + margin
    && point.y <= viewport.height + margin;
}

function drawMarker(context, marker, size) {
  const { x, y } = marker.point;
  context.save();
  context.globalAlpha = marker.muted ? 0.4 : 1;
  context.shadowColor = "rgba(22, 17, 12, 0.52)";
  context.shadowBlur = 4;
  context.shadowOffsetY = 2;
  context.fillStyle = marker.selected
    ? "rgba(255, 240, 160, 0.95)"
    : "rgba(235, 216, 169, 0.91)";
  context.strokeStyle = marker.selected ? ATLAS_PAPER_PALETTE.selection : ATLAS_PAPER_PALETTE.ink;
  context.lineWidth = marker.selected ? 2.4 : 1.5;
  context.beginPath();
  context.arc(x, y, size, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = ATLAS_PAPER_PALETTE.ink;
  context.font = `700 ${Math.max(11, size * 1.34)}px Alegreya, Georgia, serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(marker.glyph, x, y + 0.5);
  if (marker.quest) {
    context.fillStyle = ATLAS_PAPER_PALETTE.quest;
    context.strokeStyle = ATLAS_PAPER_PALETTE.ink;
    context.lineWidth = 2.5;
    context.font = `800 ${Math.max(11, size)}px sans-serif`;
    context.strokeText("!", x + size * 0.78, y - size * 0.82);
    context.fillText("!", x + size * 0.78, y - size * 0.82);
  }
  context.restore();
}

function drawParty(context, party, size) {
  const { x, y } = party.point;
  context.save();
  context.translate(x, y);
  context.shadowColor = "rgba(22, 17, 12, 0.68)";
  context.shadowBlur = 6;
  context.shadowOffsetY = 3;
  context.fillStyle = ATLAS_PAPER_PALETTE.party;
  context.strokeStyle = ATLAS_PAPER_PALETTE.selection;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(0, -size * 1.35);
  context.lineTo(size * 0.82, -size * 0.2);
  context.lineTo(size * 0.58, size * 0.86);
  context.lineTo(0, size * 1.18);
  context.lineTo(-size * 0.58, size * 0.86);
  context.lineTo(-size * 0.82, -size * 0.2);
  context.closePath();
  context.fill();
  context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = ATLAS_PAPER_PALETTE.partyLight;
  context.beginPath();
  context.arc(0, -size * 0.45, size * 0.34, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

export function renderAtlasPaperDynamic(context, model) {
  const markerSize = Math.max(7, Math.min(12, 6.5 + model.zoomRatio * 0.9));
  if (model.journey) {
    strokePath(context, model.journey.continuation, {
      color: "rgba(32, 24, 18, 0.52)",
      width: 7,
      dash: [8, 7],
    });
    strokePath(context, model.journey.continuation, {
      color: ATLAS_PAPER_PALETTE.journeyContinuation,
      width: 3,
      dash: [8, 7],
    });
    strokePath(context, model.journey.currentLeg, {
      color: "rgba(39, 28, 17, 0.72)",
      width: 8,
    });
    strokePath(context, model.journey.currentLeg, {
      color: ATLAS_PAPER_PALETTE.journey,
      width: 3.5,
    });
    for (const stop of model.journey.breaks) {
      if (!onStage(stop.point, model.viewport)) continue;
      context.fillStyle = ATLAS_PAPER_PALETTE.parchmentLight;
      context.strokeStyle = ATLAS_PAPER_PALETTE.ink;
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(stop.point.x, stop.point.y, 4.5, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
  }

  for (const marker of model.markers) {
    if (onStage(marker.point, model.viewport, markerSize * 2)) drawMarker(context, marker, markerSize);
  }

  for (const quest of model.quests) {
    if (!onStage(quest.point, model.viewport)) continue;
    context.fillStyle = ATLAS_PAPER_PALETTE.quest;
    context.strokeStyle = ATLAS_PAPER_PALETTE.ink;
    context.lineWidth = 3;
    context.font = "800 17px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.strokeText("!", quest.point.x, quest.point.y);
    context.fillText("!", quest.point.x, quest.point.y);
  }

  if (model.selection && onStage(model.selection.point, model.viewport)) {
    const radius = markerSize * 1.5;
    context.strokeStyle = ATLAS_PAPER_PALETTE.selection;
    context.lineWidth = 2;
    context.setLineDash([4, 3]);
    context.beginPath();
    context.arc(model.selection.point.x, model.selection.point.y, radius, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
  }

  if (model.party && onStage(model.party.point, model.viewport, markerSize * 2)) {
    drawParty(context, model.party, markerSize * 1.08);
  }
}

export const AtlasPaperMap = forwardRef(function AtlasPaperMap({
  active = true,
  camera,
  viewport,
  seed = CONTINENT.seed,
  landmarks = [],
  partyCoord = null,
  journey = null,
  journeyBreaks = [],
  selection = null,
  questMarkers = [],
  visibleLayers = null,
  focusedRealmId = null,
  className = "",
  style = null,
  onReady,
}, ref) {
  const canvasRef = useRef(null);
  const cameraRef = useRef(camera);
  const viewportRef = useRef(viewport);
  const readyKeyRef = useRef("");
  cameraRef.current = camera;
  viewportRef.current = viewport;

  useImperativeHandle(ref, () => ({
    pick(point, modelCamera = null) {
      return atlasPaperPick(
        modelCamera || cameraRef.current,
        viewportRef.current,
        point,
      );
    },
    pickFractional(point, modelCamera = null) {
      return atlasPaperPickFractional(
        modelCamera || cameraRef.current,
        viewportRef.current,
        point,
      );
    },
  }), []);

  useAtlasPaperLayoutEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas || !camera || !viewport) return;
    const width = Math.max(1, Math.round(viewport.width || 1));
    const height = Math.max(1, Math.round(viewport.height || 1));
    const pixelRatio = normalizeAtlasPaperPixelRatio(
      typeof window !== "undefined" ? window.devicePixelRatio : 1,
    );
    const base = paperBase(seed, pixelRatio);
    if (!base) return;
    const physicalWidth = Math.max(1, Math.round(width * pixelRatio));
    const physicalHeight = Math.max(1, Math.round(height * pixelRatio));
    if (canvas.width !== physicalWidth) canvas.width = physicalWidth;
    if (canvas.height !== physicalHeight) canvas.height = physicalHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.dataset.atlasPaperBase = base.key;
    canvas.dataset.atlasPaperMode = "paper";

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.fillStyle = ATLAS_PAPER_PALETTE.oceanDeep;
    context.fillRect(0, 0, width, height);
    const placement = atlasPaperBasePlacement(base.model, camera, { width, height });
    context.drawImage(
      base.canvas,
      placement.x,
      placement.y,
      placement.width,
      placement.height,
    );

    const dynamic = buildAtlasPaperDynamicModel({
      camera,
      viewport: { width, height },
      landmarks,
      partyCoord,
      journey,
      journeyBreaks,
      selection,
      questMarkers,
      visibleLayers,
      focusedRealmId,
    });
    renderAtlasPaperDynamic(context, dynamic);

    const vignette = context.createRadialGradient(
      width * 0.5,
      height * 0.46,
      Math.min(width, height) * 0.2,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.72,
    );
    vignette.addColorStop(0, "rgba(24, 32, 27, 0)");
    vignette.addColorStop(1, "rgba(18, 20, 16, 0.46)");
    context.fillStyle = vignette;
    context.fillRect(0, 0, width, height);

    const readyKey = `${base.key}|${width}x${height}`;
    if (readyKeyRef.current !== readyKey) {
      readyKeyRef.current = readyKey;
      onReady?.();
    }
  }, [
    active,
    camera,
    focusedRealmId,
    journey,
    journeyBreaks,
    landmarks,
    onReady,
    partyCoord,
    questMarkers,
    seed,
    selection,
    viewport,
    visibleLayers,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className={`world-atlas__paper-map${className ? ` ${className}` : ""}`}
      aria-hidden="true"
      data-atlas-active={active ? "true" : "false"}
      style={style || undefined}
    />
  );
});
