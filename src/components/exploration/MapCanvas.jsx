import React, { useEffect, useRef, useState } from "react";
import mapAtlasUrl from "../../assets/generated/map-material-atlas.png";
import tradePoiAtlasUrl from "../../assets/generated/icon-atlases/trade-poi-atlas-v1.png";
import cityPoiAtlasUrl from "../../assets/generated/icon-atlases/city-poi-atlas-v1.png";
import wildernessPoiAtlasUrl from "../../assets/generated/icon-atlases/wilderness-poi-atlas-v1.png";
import { POI_ATLAS_CELL, poiIconMeta } from "../../data/poi-icons.js";
import { marketPriceTierVisual } from "../../data/town.js";
import {
  ATLAS_CELLS,
  buildMapLayout,
  buildRouteSegments,
  findInteractiveEntry,
} from "./mapGeometry.js";

const MATERIAL_FALLBACKS = {
  plains: "#79a64a", forest: "#214f3d", hills: "#aa793f", mountains: "#7d8082",
  road: "#a98b5b", water: "#247a9c", marsh: "#496e5b", impassable: "#252a2b",
  settlement: "#a29175", street: "#ada08d", wall: "#8e8c84", indoor: "#6e5847",
  plaza: "#b8aa91", avenue: "#c5b89d", river: "#296c8c", roof: "#526d8d",
};
const RELIEF_MATERIALS = new Set(["mountains", "wall", "settlement", "roof", "indoor"]);
const POI_ATLAS_URLS = Object.freeze({
  trade: tradePoiAtlasUrl,
  city: cityPoiAtlasUrl,
  wilderness: wildernessPoiAtlasUrl,
});

function tracePolygon(context, polygon) {
  if (!polygon.length) return;
  context.beginPath();
  context.moveTo(polygon[0].x, polygon[0].y);
  for (let index = 1; index < polygon.length; index += 1) context.lineTo(polygon[index].x, polygon[index].y);
  context.closePath();
}

function traceRoundedRect(context, x, y, width, height, radius) {
  const corner = Math.min(radius, width * 0.5, height * 0.5);
  context.beginPath();
  context.moveTo(x + corner, y);
  context.lineTo(x + width - corner, y);
  context.quadraticCurveTo(x + width, y, x + width, y + corner);
  context.lineTo(x + width, y + height - corner);
  context.quadraticCurveTo(x + width, y + height, x + width - corner, y + height);
  context.lineTo(x + corner, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - corner);
  context.lineTo(x, y + corner);
  context.quadraticCurveTo(x, y, x + corner, y);
  context.closePath();
}

function materialFor(scene, cell) {
  return scene.mode === "city" ? (cell.surface || "roof") : (cell.terrain || "impassable");
}

function drawTerrain(context, scene, entries, atlas) {
  const night = !!scene.night;
  for (const entry of entries) {
    const material = materialFor(scene, entry.cell);
    if (RELIEF_MATERIALS.has(material)) {
      context.save();
      context.translate(0, entry.size * 0.11);
      tracePolygon(context, entry.polygon);
      context.fillStyle = "rgba(2, 6, 13, .46)";
      context.fill();
      context.restore();
    }

    context.save();
    tracePolygon(context, entry.polygon);
    context.clip();
    const [atlasColumn, atlasRow] = ATLAS_CELLS[material] || ATLAS_CELLS.impassable;
    if (atlas?.naturalWidth && atlas?.naturalHeight) {
      const sourceWidth = atlas.naturalWidth / 4;
      const sourceHeight = atlas.naturalHeight / 4;
      const inset = Math.min(sourceWidth, sourceHeight) * 0.018;
      context.drawImage(
        atlas,
        atlasColumn * sourceWidth + inset,
        atlasRow * sourceHeight + inset,
        sourceWidth - inset * 2,
        sourceHeight - inset * 2,
        entry.bounds.minX,
        entry.bounds.minY,
        entry.bounds.width,
        entry.bounds.height,
      );
    } else {
      context.fillStyle = MATERIAL_FALLBACKS[material] || MATERIAL_FALLBACKS.impassable;
      context.fillRect(entry.bounds.minX, entry.bounds.minY, entry.bounds.width, entry.bounds.height);
    }
    if (night) {
      context.fillStyle = "rgba(12, 27, 66, .42)";
      context.fillRect(entry.bounds.minX, entry.bounds.minY, entry.bounds.width, entry.bounds.height);
    }
    if (entry.cell.explored !== false) {
      context.fillStyle = entry.cell.visited ? "rgba(255, 230, 146, .035)" : "rgba(28, 112, 122, .075)";
      context.fillRect(entry.bounds.minX, entry.bounds.minY, entry.bounds.width, entry.bounds.height);
    }
    context.restore();

    tracePolygon(context, entry.polygon);
    context.strokeStyle = scene.mode === "city" ? "rgba(24, 28, 38, .3)" : "rgba(7, 24, 41, .42)";
    context.lineWidth = Math.max(0.7, entry.size * 0.025);
    context.stroke();
  }
}

function strokeRoute(context, segments, width) {
  const draw = (lineWidth, color) => {
    context.lineWidth = lineWidth;
    context.strokeStyle = color;
    context.lineJoin = "round";
    context.lineCap = "round";
    for (const points of segments) {
      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      for (let index = 1; index < points.length; index += 1) context.lineTo(points[index].x, points[index].y);
      context.stroke();
    }
  };
  draw(Math.max(8, width * 2.15), "rgba(4, 8, 19, .86)");
  draw(width, "#ffe47c");
  draw(Math.max(1, width * 0.2), "rgba(255, 252, 211, .82)");
}

function drawSelection(context, entry) {
  if (!entry) return;
  tracePolygon(context, entry.polygon);
  context.strokeStyle = "rgba(255, 199, 64, .22)";
  context.lineWidth = Math.max(9, entry.size * 0.22);
  context.stroke();
  tracePolygon(context, entry.polygon);
  context.strokeStyle = "#fff09b";
  context.lineWidth = Math.max(3, entry.size * 0.075);
  context.stroke();
}

function drawLabel(context, text, x, y, scaleHint) {
  const display = text.length > 24 ? `${text.slice(0, 22)}…` : text;
  const fontSize = Math.max(10, Math.min(13, scaleHint * 0.24));
  context.font = `700 ${fontSize}px Alegreya, Georgia, serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const width = Math.max(64, Math.min(158, context.measureText(display).width + 18));
  const height = fontSize + 10;
  context.fillStyle = "rgba(4, 15, 38, .9)";
  context.strokeStyle = "rgba(238, 192, 89, .8)";
  context.lineWidth = 1;
  traceRoundedRect(context, x - width * 0.5, y, width, height, 3);
  context.fill();
  context.stroke();
  context.fillStyle = "#fff3c4";
  context.shadowColor = "rgba(0, 0, 0, .9)";
  context.shadowBlur = 3;
  context.fillText(display, x, y + height * 0.52);
  context.shadowBlur = 0;
}

function drawPoiTierMarker(context, x, y, markerRadius, marketTier) {
  const tier = marketPriceTierVisual(marketTier);
  if (!tier) return;
  const ringRadius = Math.max(5, markerRadius * 0.88);
  const badgeRadius = Math.max(4.5, markerRadius * 0.31);
  const badgeX = x + markerRadius * 0.68;
  const badgeY = y + markerRadius * 0.68;

  context.save();
  context.strokeStyle = tier.color;
  context.lineWidth = Math.max(1.5, markerRadius * 0.12);
  context.shadowColor = tier.color;
  context.shadowBlur = Math.max(4, markerRadius * 0.4);
  context.beginPath();
  context.arc(x, y, ringRadius, 0, Math.PI * 2);
  context.stroke();

  context.shadowBlur = 2;
  context.fillStyle = "rgba(7, 13, 16, .96)";
  context.beginPath();
  context.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = tier.color;
  context.strokeStyle = "rgba(7, 13, 16, .96)";
  context.lineWidth = 2;
  context.font = `900 ${Math.max(7, badgeRadius * 1.28)}px sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.strokeText(tier.marker, badgeX, badgeY + 0.4);
  context.fillText(tier.marker, badgeX, badgeY + 0.4);
  context.restore();
}

function drawPoi(context, entry, poiAtlases) {
  const size = Math.max(8, Math.min(19, entry.size * 0.33));
  const { x, y } = entry.center;
  const diamond = (offsetX, offsetY, radius, color) => {
    context.beginPath();
    context.moveTo(x + offsetX, y + offsetY - radius);
    context.lineTo(x + offsetX + radius, y + offsetY);
    context.lineTo(x + offsetX, y + offsetY + radius);
    context.lineTo(x + offsetX - radius, y + offsetY);
    context.closePath();
    context.fillStyle = color;
    context.fill();
  };
  const icon = poiIconMeta(entry.cell.poi_icon);
  const poiAtlas = icon ? poiAtlases?.[icon.atlas] : null;
  let markerRadius = size;
  if (icon && poiAtlas?.naturalWidth) {
    const iconSize = Math.max(27, Math.min(48, entry.size * 0.82));
    markerRadius = iconSize * 0.5;
    context.save();
    context.shadowColor = "rgba(1, 6, 16, .9)";
    context.shadowBlur = Math.max(4, iconSize * 0.16);
    context.shadowOffsetY = Math.max(2, iconSize * 0.08);
    context.drawImage(
      poiAtlas,
      icon.col * POI_ATLAS_CELL,
      icon.row * POI_ATLAS_CELL,
      POI_ATLAS_CELL,
      POI_ATLAS_CELL,
      x - iconSize * 0.5,
      y - iconSize * 0.5,
      iconSize,
      iconSize,
    );
    context.restore();
  } else {
    diamond(2, 4, size, "rgba(1, 6, 16, .78)");
    diamond(0, 0, size, entry.cell.marker_color || "#efb957");
    diamond(0, 0, size * 0.42, "#fff0b0");
  }
  drawPoiTierMarker(context, x, y, markerRadius, entry.cell.poi_market_tier);
  if (entry.cell.quest) {
    context.font = `800 ${Math.max(11, Math.min(16, entry.size * 0.28))}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#fff28a";
    context.strokeStyle = "rgba(5, 12, 26, .95)";
    context.lineWidth = 3;
    context.strokeText("!", x + markerRadius * 0.72, y - markerRadius * 1.05);
    context.fillText("!", x + markerRadius * 0.72, y - markerRadius * 1.05);
  }
}

function drawMarkers(context, scene, entries, poiAtlases) {
  for (const entry of entries) {
    if (entry.cell.explored === false) continue;
    if (entry.cell.poi_name && entry.key !== String(scene.current_key || "")) {
      drawPoi(context, entry, poiAtlases);
    }
  }
}

function drawFog(context, scene, entries) {
  if (scene.mode !== "world") return;
  // Three explicit states: visible terrain is clear, remembered terrain keeps
  // its map detail beneath a dark fog layer, and unknown geography stays black.
  // Per-cell fog keeps accumulated exploration authoritative as the camera
  // moves instead of re-covering remembered edge cells with a full-screen mask.
  for (const entry of entries) {
    if (entry.cell.visible) continue;
    tracePolygon(context, entry.polygon);
    if (entry.cell.explored) {
      context.fillStyle = scene.night ? "rgba(2, 7, 28, .68)" : "rgba(3, 13, 25, .54)";
    } else {
      context.fillStyle = scene.night ? "rgba(2, 7, 28, .98)" : "rgba(3, 13, 25, .94)";
    }
    context.fill();
  }
}

function drawPlayer(context, entry) {
  if (!entry) return;
  const radius = Math.max(10, Math.min(21, entry.size * 0.35));
  const x = entry.center.x;
  const y = entry.center.y - entry.size * 0.05;
  context.save();
  context.translate(x, y);
  context.fillStyle = "rgba(1, 5, 12, .64)";
  context.beginPath();
  context.ellipse(0, radius * 0.92, radius * 1.08, radius * 0.4, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#168ba0";
  context.strokeStyle = "rgba(255, 224, 125, .9)";
  context.lineWidth = Math.max(1.5, radius * 0.1);
  context.beginPath();
  context.moveTo(0, -radius * 1.55);
  context.lineTo(radius * 0.78, -radius * 0.32);
  context.lineTo(radius * 0.64, radius);
  context.lineTo(0, radius * 1.26);
  context.lineTo(-radius * 0.64, radius);
  context.lineTo(-radius * 0.78, -radius * 0.32);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = "#27bdd0";
  context.beginPath();
  context.ellipse(0, -radius * 0.62, radius * 0.72, radius * 0.62, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#07162a";
  context.beginPath();
  context.ellipse(0, -radius * 0.5, radius * 0.43, radius * 0.31, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#f0b84f";
  context.beginPath();
  context.arc(0, radius * 0.08, radius * 0.18, 0, Math.PI * 2);
  context.fill();
  context.restore();
  drawLabel(context, "YOU", x, y + radius * 1.36, entry.size);
}

function drawHover(context, entry) {
  if (!entry) return;
  tracePolygon(context, entry.polygon);
  context.strokeStyle = "rgba(132, 238, 225, .9)";
  context.lineWidth = Math.max(2, entry.size * 0.05);
  context.stroke();
}

export function renderMap(context, scene, layout, atlas, poiAtlases, hoverKey, width, height) {
  context.clearRect(0, 0, width, height);
  const background = context.createRadialGradient(width * 0.5, height * 0.42, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.72);
  background.addColorStop(0, scene.night ? "#142d52" : "#255875");
  background.addColorStop(1, "#06152f");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  drawTerrain(context, scene, layout.entries, atlas);
  const routeWidth = scene.mode === "world"
    ? Math.max(4, layout.worldRadius * 0.13)
    : Math.max(4, layout.cityCellSize * 0.1);
  strokeRoute(context, buildRouteSegments(scene.route, layout.centerByKey), routeWidth);
  drawMarkers(context, scene, layout.entries, poiAtlases);
  drawFog(context, scene, layout.entries);
  drawSelection(context, layout.entries.find((entry) => entry.key === String(scene.selected_key || "")));
  drawPlayer(context, layout.entries.find((entry) => entry.key === String(scene.current_key || "")));
  drawHover(context, layout.entries.find((entry) => entry.key === hoverKey));

  const vignette = context.createRadialGradient(width * 0.5, height * 0.46, Math.min(width, height) * 0.2, width * 0.5, height * 0.5, Math.max(width, height) * 0.7);
  vignette.addColorStop(0, "rgba(1, 6, 18, 0)");
  vignette.addColorStop(1, "rgba(1, 6, 18, .48)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);
}

function eventPoint(event, canvas) {
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return { x: -1, y: -1 };
  return {
    x: (event.clientX - bounds.left) * (canvas.clientWidth / bounds.width),
    y: (event.clientY - bounds.top) * (canvas.clientHeight / bounds.height),
  };
}

export function MapCanvas({ scene, onSelect, label, choices = [], selectedKey = "" }) {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const atlasRef = useRef(null);
  const poiAtlasesRef = useRef({});
  const layoutRef = useRef({ entries: [], centerByKey: new Map(), worldRadius: 0, cityCellSize: 0 });
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const [atlasReady, setAtlasReady] = useState(false);
  const [poiAtlasesReady, setPoiAtlasesReady] = useState(0);
  const [hoverKey, setHoverKey] = useState("");

  useEffect(() => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      atlasRef.current = image;
      setAtlasReady(true);
    };
    image.onerror = () => {
      atlasRef.current = null;
      setAtlasReady(false);
    };
    image.src = mapAtlasUrl;
    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const images = [];
    for (const [atlasId, url] of Object.entries(POI_ATLAS_URLS)) {
      const image = new Image();
      images.push(image);
      image.decoding = "async";
      image.onload = () => {
        if (!active) return;
        poiAtlasesRef.current = { ...poiAtlasesRef.current, [atlasId]: image };
        setPoiAtlasesReady((count) => count + 1);
      };
      image.onerror = () => {
        if (!active) return;
        setPoiAtlasesReady((count) => count + 1);
      };
      image.src = url;
    }
    return () => {
      active = false;
      for (const image of images) {
        image.onload = null;
        image.onerror = null;
      }
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const measure = () => {
      const bounds = host.getBoundingClientRect();
      const width = Math.max(1, Math.round(bounds.width));
      const height = Math.max(1, Math.round(bounds.height));
      setViewport((current) => current.width === width && current.height === height ? current : { width, height });
    };
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(measure);
      observer.observe(host);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !scene) return;
    const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.max(1, Math.round(viewport.width * ratio));
    canvas.height = Math.max(1, Math.round(viewport.height * ratio));
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    const context = canvas.getContext("2d", { alpha: false });
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    const layout = buildMapLayout(scene, viewport.width, viewport.height);
    layoutRef.current = layout;
    renderMap(context, scene, layout, atlasRef.current, poiAtlasesRef.current, hoverKey, viewport.width, viewport.height);
  }, [scene, viewport, atlasReady, poiAtlasesReady, hoverKey]);

  function entryAt(event) {
    const canvas = canvasRef.current;
    return canvas ? findInteractiveEntry(layoutRef.current.entries, eventPoint(event, canvas)) : null;
  }

  function updateHover(event) {
    const nextKey = entryAt(event)?.key || "";
    setHoverKey((current) => current === nextKey ? current : nextKey);
  }

  function pick(event) {
    const entry = entryAt(event);
    if (entry) onSelect?.(entry.key);
  }

  return (
    <div ref={hostRef} className={`map-canvas-frame ${atlasReady ? "is-atlas-ready" : ""}`} role="group" aria-label={label}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        onClick={pick}
        onPointerMove={updateHover}
        onPointerLeave={() => setHoverKey("")}
        style={{ cursor: hoverKey ? "pointer" : "default" }}
      />
      {choices.length > 0 && (
        <div className="map-canvas-accessibility" aria-label={`${label} destinations`}>
          <span>Map destinations</span>
          {choices.map((choice) => (
            <button key={choice.key} onClick={() => onSelect?.(choice.key)} aria-pressed={choice.key === selectedKey}>{choice.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
