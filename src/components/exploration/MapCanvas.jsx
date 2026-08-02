import React, { useEffect, useRef, useState } from "react";
import { POI_ATLAS_CELL, poiIconMeta } from "../../data/poi-icons.js";
import { marketPriceTierVisual } from "../../data/town.js";
import { getCachedMapCanvasImages, preloadMapCanvasImages } from "./renderingPreload.js";
import {
  ATLAS_CELLS,
  buildMapLayout,
  buildRouteSegments,
  findAtlasPlace,
  findInteractiveEntry,
  layoutAtlasPlaces,
  layoutAtlasRibbons,
  mapFogOpacity,
  mapPoiIconSize,
  mapMarkerShowsTierDetail,
  mapPartyEntry,
  mapTrackedEntry,
  selectMapMarkerEntries,
} from "./mapGeometry.js";
import { lodFogScale, lodShowsHexOutlines, lodShowsScenery } from "./mapLod.js";
import { dragPreviewOffset, pinchDistance, pinchZoomFactor } from "./mapGestures.js";
import { rebaseTravelMapDrag } from "./travelMapModel.js";

const MATERIAL_FALLBACKS = {
  plains: "#79a64a", reedfield: "#9da34f", forest: "#214f3d", hills: "#aa793f", mountains: "#7d8082",
  road: "#a98b5b", water: "#247a9c", marsh: "#496e5b", impassable: "#252a2b",
  settlement: "#a29175", street: "#ada08d", wall: "#8e8c84", indoor: "#6e5847",
  plaza: "#b8aa91", avenue: "#c5b89d", river: "#296c8c", roof: "#526d8d",
};
const RELIEF_MATERIALS = new Set(["mountains", "wall", "settlement", "roof", "indoor"]);
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
  // A hex outline drawn around a 28-hex sample is a lie about what the map
  // knows. Dropping it lets terrain read as continuous masses, which is what a
  // map at that scale should look like.
  const outlines = lodShowsHexOutlines(scene.tier || "local");
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
    if (material === "reedfield") {
      context.fillStyle = "rgba(184, 158, 52, .18)";
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

    if (!outlines) continue;
    tracePolygon(context, entry.polygon);
    context.strokeStyle = scene.mode === "city" ? "rgba(24, 28, 38, .3)" : "rgba(7, 24, 41, .42)";
    context.lineWidth = Math.max(0.7, entry.size * 0.025);
    context.stroke();
  }
}

// Ambient landscape the party can see from the road — a barn, a milestone, a
// wayside shrine. Deliberately unlabelled marks, not markers: they say the
// country is lived in without pretending every one is a place to visit.
function drawScenery(context, scene, entries) {
  if (!lodShowsScenery(scene.tier || "local") || scene.mode !== "world") return;
  for (const entry of entries) {
    const count = entry.cell.scenery?.length || 0;
    if (!count || !entry.cell.explored) continue;
    const radius = Math.max(1.1, entry.size * 0.055);
    const spread = entry.size * 0.36;
    context.save();
    context.fillStyle = "rgba(24, 18, 9, .5)";
    context.strokeStyle = "rgba(247, 233, 191, .72)";
    context.lineWidth = Math.max(0.6, radius * 0.5);
    for (let index = 0; index < Math.min(3, count); index += 1) {
      // Fixed offsets keyed off the hex, so a mark never jitters between frames.
      const angle = ((entry.cell.x * 7 + entry.cell.y * 13 + index * 5) % 6) * (Math.PI / 3);
      const x = entry.center.x + Math.cos(angle) * spread;
      const y = entry.center.y + Math.sin(angle) * spread * 0.7;
      context.beginPath();
      context.moveTo(x, y - radius);
      context.lineTo(x + radius, y);
      context.lineTo(x, y + radius);
      context.lineTo(x - radius, y);
      context.closePath();
      context.fill();
      context.stroke();
    }
    context.restore();
  }
}

const RIBBON_STYLE = {
  road: { core: "rgba(214, 178, 116, .92)", edge: "rgba(38, 26, 12, .55)", scale: 0.16 },
  river: { core: "rgba(96, 168, 205, .9)", edge: "rgba(9, 34, 52, .5)", scale: 0.2 },
  wall: { core: "rgba(228, 222, 208, .95)", edge: "rgba(18, 16, 12, .62)", scale: 0.13 },
};

function ribbonSpan(ribbon) {
  const xs = ribbon.points.map((point) => point.x);
  const ys = ribbon.points.map((point) => point.y);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 0.5;
}

// Roads and rivers as continuous ribbons. A route is one hex wide, so under
// sampling it would break into dashes; drawing the authored polyline instead
// keeps it whole and reads better than a hex-by-hex road ever did.
function drawRibbons(context, ribbons, radius) {
  if (!ribbons.length) return;
  context.save();
  context.lineJoin = "round";
  context.lineCap = "round";
  for (const pass of ["edge", "core"]) {
    for (const ribbon of ribbons) {
      const style = RIBBON_STYLE[ribbon.kind] || RIBBON_STYLE.road;
      const core = Math.max(1.1, radius * style.scale * ribbon.width);
      // A wall encloses ground rather than leading somewhere, so it needs an
      // inside to read as a wall. Once the ring is barely wider than the stroke
      // drawing it, it is a blot, and the place marker carries the seat instead.
      if (ribbon.kind === "wall" && ribbonSpan(ribbon) < core * 6) continue;
      context.lineWidth = pass === "edge" ? core + Math.max(1, radius * 0.06) : core;
      context.strokeStyle = style[pass];
      context.beginPath();
      context.moveTo(ribbon.points[0].x, ribbon.points[0].y);
      for (let index = 1; index < ribbon.points.length; index += 1) {
        context.lineTo(ribbon.points[index].x, ribbon.points[index].y);
      }
      context.stroke();
    }
  }
  context.restore();
}

const PLACE_KNOWLEDGE_ALPHA = { charted: 1, reputation: 0.66, legend: 0.42 };

// Authored places, which is what the map has left to say once individual hexes
// are too small to read. Reputation and legend are drawn faint but remain
// selectable, so the party can still set out for somewhere it has never seen.
function drawAtlasPlaces(context, places, radius) {
  if (!places.length) return;
  const size = Math.max(4.5, Math.min(11, radius * 0.42));
  for (const place of places) {
    const { x, y } = place.point;
    const ink = place.knowledge === "charted" ? "#f3c96a" : "rgba(226, 214, 186, .9)";
    const dot = place.major ? size : size * 0.72;
    // Whitemarch's walls are drawn to scale with the rest of the ribbons, but a
    // city is a few hexes wide and the continent is a thousand — past a certain
    // remove no true-scale wall is legible. The ring is the symbol that carries
    // "this place is held" once the wall itself is smaller than its own stroke.
    const ring = place.fortified ? dot * 1.75 : 0;
    context.save();
    context.globalAlpha = PLACE_KNOWLEDGE_ALPHA[place.knowledge] ?? 0.5;
    context.strokeStyle = "rgba(6, 14, 28, .92)";
    if (ring) {
      context.beginPath();
      context.arc(x, y, ring, 0, Math.PI * 2);
      context.lineWidth = Math.max(2.4, size * 0.5);
      context.stroke();
      context.strokeStyle = ink;
      context.lineWidth = Math.max(1, size * 0.22);
      context.stroke();
      context.strokeStyle = "rgba(6, 14, 28, .92)";
    }
    context.beginPath();
    context.arc(x, y, dot, 0, Math.PI * 2);
    context.fillStyle = ink;
    context.lineWidth = Math.max(1.2, size * 0.28);
    context.fill();
    context.stroke();
    if (place.major || place.knowledge === "charted") {
      drawLabel(context, place.name, x, y + Math.max(size * 1.5, ring + size), Math.max(38, radius));
    }
    context.restore();
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

const POI_KNOWLEDGE_ALPHA = { rumoured: 0.72, silhouette: 0.48 };

function drawPoi(context, entry, poiAtlases, mode) {
  const knowledge = entry.cell.poi_knowledge;
  const alpha = POI_KNOWLEDGE_ALPHA[knowledge];
  if (alpha) {
    // A place known only by its outline is drawn faint, so the map distinguishes
    // what the party has stood in from what it has merely spotted.
    context.save();
    context.globalAlpha = alpha;
    drawPoiMark(context, entry, poiAtlases, mode);
    context.restore();
    return;
  }
  drawPoiMark(context, entry, poiAtlases, mode);
}

function drawPoiMark(context, entry, poiAtlases, mode) {
  const iconSize = mapPoiIconSize(entry.size, mode);
  const size = iconSize * 0.44;
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
  let markerRadius = iconSize * 0.5;
  if (icon && poiAtlas?.naturalWidth) {
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
  if (!POI_KNOWLEDGE_ALPHA[entry.cell.poi_knowledge] && mapMarkerShowsTierDetail(entry.size, mode)) {
    drawPoiTierMarker(context, x, y, markerRadius, entry.cell.poi_market_tier);
  }
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

function drawMarkers(context, scene, layout, poiAtlases, width) {
  const visibleMarkers = selectMapMarkerEntries(scene, layout.entries, {
    width,
    worldRadius: layout.worldRadius,
  });
  for (const entry of visibleMarkers) drawPoi(context, entry, poiAtlases, scene.mode);
}

function drawFog(context, scene, entries) {
  if (scene.mode !== "world") return;
  // Three explicit states: visible terrain is clear, remembered terrain is
  // lightly muted, and unknown terrain stays readable beneath a darker veil.
  // Per-cell fog keeps accumulated exploration authoritative as the camera
  // moves instead of re-covering remembered edge cells with a full-screen mask.
  //
  // The veil thins as the map pulls back. Personal sight is the wrong lens for
  // a continent: base geography is public, so far out this marks where the
  // party has walked rather than hiding everywhere it has not.
  const fogScale = lodFogScale(scene.tier || "local");
  for (const entry of entries) {
    const opacity = mapFogOpacity(entry.cell, scene.night, fogScale);
    if (opacity <= 0) continue;
    tracePolygon(context, entry.polygon);
    context.fillStyle = scene.night
      ? `rgba(2, 7, 28, ${opacity})`
      : `rgba(3, 13, 25, ${opacity})`;
    context.fill();
  }
}

function drawTrackedCharacter(context, entry) {
  if (!entry) return;
  const { x, y } = entry.center;
  if (!entry.tracked.exact) {
    const uncertainty = Math.max(2, entry.tracked.uncertainty_radius || 4);
    const radius = Math.max(26, Math.min(86, entry.size * uncertainty * 0.72));
    context.save();
    context.translate(x, y);
    context.fillStyle = "rgba(72, 33, 91, .13)";
    context.strokeStyle = "rgba(216, 139, 255, .88)";
    context.lineWidth = Math.max(2, entry.size * 0.06);
    context.setLineDash([Math.max(5, entry.size * 0.2), Math.max(4, entry.size * 0.14)]);
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = "#f4d8ff";
    context.font = `700 ${Math.max(14, Math.min(22, entry.size * 0.44))}px Georgia, serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("?", 0, 0);
    context.restore();
    drawLabel(context, `${entry.tracked.name} · approximate area`, x, y + radius + entry.size * 0.3, entry.size);
    return;
  }

  const radius = Math.max(9, Math.min(18, entry.size * 0.31));
  context.save();
  context.translate(x, y);
  context.fillStyle = "rgba(4, 12, 29, .82)";
  context.strokeStyle = "#d88bff";
  context.lineWidth = Math.max(2, radius * 0.13);
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.strokeStyle = "rgba(240, 190, 255, .92)";
  context.beginPath();
  context.moveTo(-radius * 1.5, 0);
  context.lineTo(-radius * 0.55, 0);
  context.moveTo(radius * 0.55, 0);
  context.lineTo(radius * 1.5, 0);
  context.moveTo(0, -radius * 1.5);
  context.lineTo(0, -radius * 0.55);
  context.moveTo(0, radius * 0.55);
  context.lineTo(0, radius * 1.5);
  context.stroke();
  context.fillStyle = "#f4d8ff";
  context.beginPath();
  context.moveTo(0, -radius * 0.48);
  context.lineTo(radius * 0.48, 0);
  context.lineTo(0, radius * 0.48);
  context.lineTo(-radius * 0.48, 0);
  context.closePath();
  context.fill();
  context.restore();
  drawLabel(context, entry.tracked.name, x, y + radius * 1.75, entry.size);
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

export function renderMap(context, scene, layout, atlas, poiAtlases, hoverKey, width, height, dragPreview = { x: 0, y: 0 }) {
  context.clearRect(0, 0, width, height);
  const background = context.createRadialGradient(width * 0.5, height * 0.42, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.72);
  background.addColorStop(0, scene.night ? "#142d52" : "#255875");
  background.addColorStop(1, "#06152f");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  context.save();
  context.translate(Number(dragPreview.x) || 0, Number(dragPreview.y) || 0);
  drawTerrain(context, scene, layout.entries, atlas);
  drawScenery(context, scene, layout.entries);
  drawRibbons(context, layoutAtlasRibbons(layout, scene.ribbons, width, height), layout.worldRadius);
  const routeWidth = scene.mode === "world"
    ? Math.max(4, layout.worldRadius * 0.13)
    : Math.max(4, layout.cityCellSize * 0.1);
  strokeRoute(context, buildRouteSegments(scene.route, layout.centerByKey), routeWidth);
  drawMarkers(context, scene, layout, poiAtlases, width);
  drawFog(context, scene, layout.entries);
  drawAtlasPlaces(context, layoutAtlasPlaces(layout, scene.places), layout.worldRadius);
  drawSelection(context, layout.entries.find((entry) => entry.key === String(scene.selected_key || "")));
  drawTrackedCharacter(context, mapTrackedEntry(layout, scene.tracked_character));
  drawPlayer(context, mapPartyEntry(layout, scene.current_key, scene.party_march));
  drawHover(context, layout.entries.find((entry) => entry.key === hoverKey));
  context.restore();

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

export function MapCanvas({ scene, onSelect, onSelectPlace, onPan, onZoom, onViewportChange, label, choices = [], selectedKey = "" }) {
  const initialImagesRef = useRef(null);
  if (!initialImagesRef.current) initialImagesRef.current = getCachedMapCanvasImages();
  const initialImages = initialImagesRef.current;
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const atlasRef = useRef(initialImages.material);
  const poiAtlasesRef = useRef(initialImages.poi);
  const layoutRef = useRef({ entries: [], centerByKey: new Map(), worldRadius: 0, cityCellSize: 0 });
  const placesRef = useRef([]);
  const dragRef = useRef(null);
  const pointerPointsRef = useRef(new Map());
  const pinchRef = useRef(null);
  const suppressClickUntilRef = useRef(0);
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const [atlasReady, setAtlasReady] = useState(Boolean(initialImages.material));
  const [poiAtlasesReady, setPoiAtlasesReady] = useState(() => Object.values(initialImages.poi).filter(Boolean).length);
  const [hoverKey, setHoverKey] = useState("");
  const [dragging, setDragging] = useState(false);
  const [dragPreview, setDragPreview] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let active = true;
    preloadMapCanvasImages().then((images) => {
      if (!active) return;
      atlasRef.current = images.material;
      poiAtlasesRef.current = images.poi;
      setAtlasReady(Boolean(images.material));
      setPoiAtlasesReady(Object.values(images.poi).filter(Boolean).length);
    });
    return () => {
      active = false;
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
      onViewportChange?.({ width, height });
    };
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(measure);
      observer.observe(host);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [onViewportChange]);

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
    placesRef.current = layoutAtlasPlaces(layout, scene.places);
    renderMap(context, scene, layout, atlasRef.current, poiAtlasesRef.current, hoverKey, viewport.width, viewport.height, dragPreview);
  }, [scene, viewport, atlasReady, poiAtlasesReady, hoverKey, dragPreview]);

  function entryAt(event) {
    const canvas = canvasRef.current;
    return canvas ? findInteractiveEntry(layoutRef.current.entries, eventPoint(event, canvas)) : null;
  }

  // Atlas places sit above the hexes and are the only thing worth clicking once
  // a hex covers many kilometres, so they win the hit test.
  function placeAt(event) {
    const canvas = canvasRef.current;
    if (!canvas || !placesRef.current.length) return null;
    return findAtlasPlace(
      placesRef.current,
      eventPoint(event, canvas),
      Math.max(14, layoutRef.current.worldRadius * 0.7),
    );
  }

  function updateHover(event) {
    if (dragRef.current) return;
    const nextKey = entryAt(event)?.key || "";
    setHoverKey((current) => current === nextKey ? current : nextKey);
  }

  function beginPan(event) {
    const point = eventPoint(event, event.currentTarget);
    pointerPointsRef.current.set(event.pointerId, point);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (pointerPointsRef.current.size >= 2 && onZoom) {
      pinchRef.current = { distance: pinchDistance([...pointerPointsRef.current.values()]) };
      dragRef.current = null;
      suppressClickUntilRef.current = Date.now() + 350;
      setHoverKey("");
      setDragging(false);
      setDragPreview({ x: 0, y: 0 });
      event.preventDefault();
      return;
    }
    if (!onPan) return;
    dragRef.current = { pointerId: event.pointerId, start: point, last: point, moved: false };
    setHoverKey("");
    setDragging(true);
    setDragPreview({ x: 0, y: 0 });
  }

  function movePointer(event) {
    const point = eventPoint(event, event.currentTarget);
    if (pointerPointsRef.current.has(event.pointerId)) {
      pointerPointsRef.current.set(event.pointerId, point);
    }
    if (pinchRef.current) {
      const distance = pinchDistance([...pointerPointsRef.current.values()]);
      if (distance != null) {
        const factor = pinchZoomFactor(pinchRef.current.distance, distance);
        if (Math.abs(factor - 1) > 0.005) onZoom?.(factor);
        pinchRef.current.distance = distance;
      }
      suppressClickUntilRef.current = Date.now() + 350;
      event.preventDefault();
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      updateHover(event);
      return;
    }
    drag.last = point;
    if (Math.hypot(point.x - drag.start.x, point.y - drag.start.y) > 6) drag.moved = true;
    if (drag.moved) {
      const preview = dragPreviewOffset(drag.start, point);
      const { commit, residual } = rebaseTravelMapDrag(preview, layoutRef.current.worldRadius);
      if (commit.x !== 0 || commit.y !== 0) {
        drag.start = { x: point.x - residual.x, y: point.y - residual.y };
        onPan?.(commit, layoutRef.current.worldRadius);
      }
      setDragPreview(residual);
    }
  }

  function finishPan(event) {
    if (pinchRef.current) {
      pointerPointsRef.current.delete(event.pointerId);
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      suppressClickUntilRef.current = Date.now() + 350;
      dragRef.current = null;
      if (pointerPointsRef.current.size === 0) pinchRef.current = null;
      setDragging(false);
      setDragPreview({ x: 0, y: 0 });
      return;
    }

    const drag = dragRef.current;
    pointerPointsRef.current.delete(event.pointerId);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = eventPoint(event, event.currentTarget);
    const moved = drag.moved || Math.hypot(point.x - drag.start.x, point.y - drag.start.y) > 6;
    if (moved) {
      const { commit } = rebaseTravelMapDrag(dragPreviewOffset(drag.start, point), layoutRef.current.worldRadius);
      if (commit.x !== 0 || commit.y !== 0) onPan?.(commit, layoutRef.current.worldRadius);
      suppressClickUntilRef.current = Date.now() + 350;
    }
    dragRef.current = null;
    setDragging(false);
    setDragPreview({ x: 0, y: 0 });
  }

  function cancelPan(event) {
    pointerPointsRef.current.delete(event.pointerId);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (pinchRef.current) {
      suppressClickUntilRef.current = Date.now() + 350;
      if (pointerPointsRef.current.size === 0) pinchRef.current = null;
      dragRef.current = null;
      setDragging(false);
      setDragPreview({ x: 0, y: 0 });
      return;
    }
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    setDragPreview({ x: 0, y: 0 });
  }

  function pick(event) {
    if (Date.now() < suppressClickUntilRef.current) return;
    const place = placeAt(event);
    if (place) {
      onSelectPlace?.(place);
      return;
    }
    const entry = entryAt(event);
    if (entry) onSelect?.(entry.key);
  }

  function zoom(event) {
    if (!onZoom) return;
    event.preventDefault();
    onZoom(event.deltaY > 0 ? 0.84 : 1.19);
  }

  return (
    <div ref={hostRef} className={`map-canvas-frame ${atlasReady ? "is-atlas-ready" : ""}`} role="group" aria-label={label}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        onClick={pick}
        onPointerDown={beginPan}
        onPointerMove={movePointer}
        onPointerUp={finishPan}
        onPointerCancel={cancelPan}
        onPointerLeave={(event) => {
          if (!dragRef.current) setHoverKey("");
          else movePointer(event);
        }}
        onWheel={zoom}
        style={{ cursor: dragging ? "grabbing" : (onPan ? "grab" : (hoverKey ? "pointer" : "default")), touchAction: onPan ? "none" : "auto" }}
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
