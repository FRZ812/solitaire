import React, { useState, useRef } from "react";
import { Icon } from "./Icon.jsx";
import { iconButtonStyle } from "./primitives.jsx";
import { MAP_VIEW_RADIUS, MAX_TRAVEL_HEXES, FLY_TRAVEL_HEXES, FLY_MIN_PER_HEX } from "../config.js";
import { TERRAINS } from "../data/terrains.js";
import { getRumored, RUMORED } from "../data/rumored.js";
import { FABLED, FABLED_BY_COORD } from "../data/fabled.js";
import { RIVERS } from "../data/rivers.js";
import { getBiome } from "../data/biomes.js";
import {
  getTile, isSeen, isVisited,
  currentLocationName, hexDistance,
  findPath, pathMinutes, isTeleportAnchor,
  HEX_DIRECTIONS, edgeAllowed, isPassable,
} from "../engine/world.js";
import { knownTravelSpells } from "../data/travel-spells.js";
import { flyMulticastPlan, assignmentCost, assignmentValid } from "../engine/fly.js";
import { playerFlightMount } from "../engine/riding.js";
import { describeEncounterPotential, pathRiskPercent } from "../engine/encounters.js";
import { formatTime, formatDate } from "../engine/time.js";
import { formatCopper } from "../engine/economy.js";
import { compassDir } from "../engine/api.js";
import { useZoomPan } from "./useZoomPan.js";
import { poiFootprintName, poiMeta, poiPlaceName, titleFromId } from "../engine/location.js";

const QUEST_TYPE_LABEL = { errand: "Errand", delivery: "Delivery", hunt: "Hunt", bounty: "Bounty" };

// Pointy-top hex geometry.
const HEX_SIZE = 22;
const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;      // ≈ 38.1
const HEX_HEIGHT = 2 * HEX_SIZE;                // 44
const HSPACING = HEX_WIDTH;
const VSPACING = 1.5 * HEX_SIZE;

// The SVG canvas needs to fit the player's view hex plus every landmark patch
// (some of which sit 140 hexes from origin). 12000×12000 leaves headroom for
// any fabled coord and a generous margin without blowing memory.
const SVG_SIZE = 12000;
const SVG_CENTER = SVG_SIZE / 2;

const LANDMARK_REVEAL_RADIUS_RUMORED = 2;
const LANDMARK_REVEAL_RADIUS_FABLED = 3;

function hexCornerPoints(cx, cy) {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const x = cx + HEX_SIZE * Math.cos(angle);
    const y = cy + HEX_SIZE * Math.sin(angle);
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return points.join(" ");
}

// For each HEX_DIRECTIONS index, which two of the six hex corners form
// the edge shared with that neighbour. Hex corners are indexed by the
// angle 60·i − 30 in degrees (i = 0..5).
//
// Verified geometry: the neighbour in direction d sits on the side of
// the current hex bounded by the two adjacent corners listed below.
const EDGE_CORNERS = [
  [0, 1], // E
  [5, 0], // NE
  [4, 5], // NW
  [3, 4], // W
  [2, 3], // SW
  [1, 2], // SE
];

function hexCorner(cx, cy, i) {
  const angle = (Math.PI / 180) * (60 * i - 30);
  return {
    x: cx + HEX_SIZE * Math.cos(angle),
    y: cy + HEX_SIZE * Math.sin(angle),
  };
}

// ==================== CUSTOM VECTOR LANDMARKS & MAP ART ====================
const MAP_ASSETS = {
  // bldg (Building, inn, tavern, shop, stable, mill): Cozy hand-timbered cottage
  bldg: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
      <path d="M3 21h18M3 10l9-7 9 7v11H3V10z" fill="rgba(215, 167, 111, 0.1)" />
      <path d="M9 21v-8h6v8M9 10h6" />
    </svg>
  ),
  // healer / apothecary: A remedy flask marked with a cross
  healer: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
      <path d="M10 3h4M11 3v5l-3 6.5A3.5 3.5 0 0 0 11.2 20h1.6A3.5 3.5 0 0 0 16 14.5L13 8V3" fill="rgba(215, 167, 111, 0.1)" />
      <path d="M12 12v4M10 14h4" />
    </svg>
  ),
  // market: A market stall with a striped awning over a counter
  market: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
      <path d="M3 9l2-5h14l2 5z" fill="rgba(215, 167, 111, 0.12)" />
      <path d="M5 9v11M19 9v11M4 20h16M9 4l-1 5M14 4l1 5" />
    </svg>
  ),
  // gaol: A barred cell window
  gaol: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
      <path d="M4 5h16v16H4z" fill="rgba(215, 167, 111, 0.1)" />
      <path d="M8 5v16M12 5v16M16 5v16M4 11h16" />
    </svg>
  ),
  // slavemarket: A pair of shackles joined by a chain — the auction-block
  slavemarket: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
      <circle cx="6" cy="8" r="3.2" fill="rgba(215, 167, 111, 0.1)" />
      <circle cx="18" cy="8" r="3.2" fill="rgba(215, 167, 111, 0.1)" />
      <path d="M9 9.5c1.5 1.5 4.5 1.5 6 0" />
      <path d="M6 11.2v6M18 11.2v6M4 19h4M16 19h4" />
    </svg>
  ),
  // smithy: Crossed blacksmith hammers with a small anvil
  smithy: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
      <path d="M18 10h-2V7l2-3M6 10h2V7L6 4" />
      <path d="M7 10h10v6a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4v-6z" fill="rgba(215, 167, 111, 0.1)" />
      <path d="M12 10v10M9 13h6" />
    </svg>
  ),
  // temple / shrine / cathedral: A gothic cathedral spire with a runic star
  temple: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
      <path d="M12 2v20M5 12h14" />
      <path d="M12 2L6 8h12L12 2zM8 12v9h8v-9" fill="rgba(215, 167, 111, 0.1)" />
      <circle cx="12" cy="15" r="1.5" />
    </svg>
  ),
  // town / hall / square: A mini walled stone keep
  town: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
      <path d="M4 21h16M5 21V8l3-3 4 3 4-3 3 3v13H5z" fill="rgba(215, 167, 111, 0.1)" />
      <path d="M10 21v-5h4v5M9 12h6" />
    </svg>
  ),
  // gate: A classical stone archway with portcullis bars
  gate: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
      <path d="M4 21V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v15" fill="rgba(215, 167, 111, 0.1)" />
      <path d="M8 8h8M8 12h8M8 16h8M9 4v17M15 4v17" />
    </svg>
  ),
  // site / camp / landmark: Ancient standing stone / monolith with runic engravings
  site: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
      <path d="M8 22l2-16 2-4 2 4 2 16H8z" fill="rgba(215, 167, 111, 0.1)" />
      <path d="M12 6v10M10 12h4" />
    </svg>
  ),
  // unknown / hidden: Shrouded mystery emblem — glowing eye inside a diamond seal
  unknown: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 4px rgba(239, 68, 68, 0.4))" }}>
      <path d="M12 2L2 12l10 10 10-10L12 2z" fill="rgba(215, 167, 111, 0.05)" />
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="0.75" fill={color} />
    </svg>
  ),
  // city / palace / mint: Grand royal fortress with three high towers
  city: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
      <path d="M3 21h18" />
      <path d="M5 21V10h4V7h6v3h4v11H5z" fill="rgba(215, 167, 111, 0.1)" />
      <path d="M11 21v-4h2v4M8 13h8" />
    </svg>
  ),
  // river: Double wavy flowing stream lines
  river: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
      <path d="M2 8c4-3 6 3 10 0s6 3 10 0M2 16c4-3 6 3 10 0s6 3 10 0" />
    </svg>
  ),
  // mountains: Three overlapping mountain peaks with cross-hatch shading
  mtns: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
      <path d="M4 22L12 5l8 17H4z" fill="rgba(215, 167, 111, 0.05)" />
      <path d="M2 22l6-11 4 7.5M10 22l4-7.5" />
    </svg>
  ),
  // ruin: Crumbling, cracked stone tower
  ruin: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
      <path d="M6 21V8l6-4v4h6v13H6z" fill="rgba(215, 167, 111, 0.1)" />
      <path d="M6 12h6M12 16h6" />
      <path d="M9 8v4M15 12v4" />
      <path d="M12 4v4" />
      <path d="M10 12l2 2" stroke={color} strokeWidth="1.2" />
    </svg>
  ),
  // lake: Wavy, fluid organic shoreline with ripples
  lake: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="rgba(46, 74, 110, 0.25)" />
      <path d="M8 12c2-1 4 1 6 0s2-1 2-1" />
    </svg>
  ),
};

function assetKeyForTile(tile) {
  if (!tile.poi) return null;
  const t = tile.poi.type;
  if (t === "hidden") return "unknown";
  if (t === "slavemarket") return "slavemarket";
  if (tile.terrain === "indoor") {
    if (t === "gaol" || t === "prison") return "gaol";
    if (t === "healer" || t === "apothecary") return "healer";
    if (t === "inn" || t === "tavern" || t === "stable" || t === "mill" || t === "shop") return "bldg";
    if (t === "smithy") return "smithy";
    if (t === "temple" || t === "shrine" || t === "cathedral") return "temple";
    return "bldg";
  }
  if (t === "market") return "market";
  if (t === "town" || t === "hall" || t === "square" || t === "garden" || t === "yard") return "town";
  if (t === "gate") return "gate";
  if (t === "landmark" || t === "camp") return "site";
  if (t === "shrine" || t === "cathedral" || t === "fortress") return "temple";
  if (t === "palace" || t === "mint" || t === "city") return "city";
  if (t === "village") return "town";
  if (t === "lake") return "lake";
  if (t === "mountains") return "mtns";
  if (t === "ruin") return "ruin";
  if (t === "river") return "river";
  return "site";
}

function MapLegend() {
  const items = [
    { key: "bldg", label: "bldg" }, { key: "smithy", label: "smithy" },
    { key: "healer", label: "healer" }, { key: "market", label: "market" },
    { key: "gaol", label: "gaol" }, { key: "slavemarket", label: "auction" },
    { key: "temple", label: "temple" }, { key: "town", label: "town" },
    { key: "gate", label: "gate" }, { key: "site", label: "site" },
    { key: "unknown", label: "unknown" }, { key: "city", label: "city" },
    { key: "river", label: "river" }, { key: "mtns", label: "mtns" },
    { key: "ruin", label: "ruin" }, { key: "lake", label: "lake" },
  ];
  // Floats over the map (above the Legend toggle) rather than taking layout
  // space — toggling it never resizes or shifts the map. Swallows pointer-downs
  // so reading the legend can't start a map pan.
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      style={{
        position: "absolute", left: "12px", right: "12px", bottom: "52px", zIndex: 6,
        display: "flex",
        flexWrap: "wrap",
        gap: "8px 12px",
        padding: "10px 12px",
        maxHeight: "45%", overflowY: "auto",
        borderRadius: "14px",
        border: "1px solid rgba(215, 167, 111, 0.22)",
        backgroundColor: "rgba(12, 17, 17, 0.95)",
        backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        boxShadow: "0 12px 32px rgba(0,0,0,0.55)",
        fontSize: "11px",
        color: "rgba(237, 228, 208, 0.72)",
        justifyContent: "center",
      }}>
      {items.map((it) => (
        <span key={it.key + it.label} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span style={{ display: "inline-flex", width: "16px", height: "16px", alignItems: "center", justifyContent: "center" }}>
            {MAP_ASSETS[it.key] && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d7a76f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {MAP_ASSETS[it.key]("#d7a76f").props.children}
              </svg>
            )}
          </span>
          <span style={{ letterSpacing: "0.06em" }}>{it.label}</span>
        </span>
      ))}
    </div>
  );
}

// Build the list of axial coords to render: the player's view radius plus
// pre-revealed patches around every named landmark. Returns each as
// { x, y, px, py } where (px, py) is the SVG pixel position.
function collectHexes(cur) {
  const set = new Set();
  const out = [];

  function add(centerX_axial, centerY_axial, R) {
    for (let dq = -R; dq <= R; dq++) {
      const drLow = Math.max(-R, -dq - R);
      const drHigh = Math.min(R, -dq + R);
      for (let dr = drLow; dr <= drHigh; dr++) {
        const x = centerX_axial + dq;
        const y = centerY_axial + dr;
        const key = `${x},${y}`;
        if (set.has(key)) continue;
        set.add(key);
        const dpq = x - cur.x;
        const dpr = y - cur.y;
        const px = SVG_CENTER + HSPACING * (dpq + dpr / 2);
        const py = SVG_CENTER + VSPACING * dpr;
        out.push({ x, y, px, py });
      }
    }
  }

  add(cur.x, cur.y, MAP_VIEW_RADIUS);
  for (const r of RIVERS) {
    for (const p of r.path) {
      add(p.x, p.y, 1);
    }
  }
  for (const k of Object.keys(RUMORED)) {
    const [rx, ry] = k.split(",").map(Number);
    add(rx, ry, LANDMARK_REVEAL_RADIUS_RUMORED);
  }
  for (const f of Object.values(FABLED)) {
    add(f.coord.x, f.coord.y, LANDMARK_REVEAL_RADIUS_FABLED);
  }
  return out;
}

export function MapView({ state, onClose, onTravel, onFly, onTeleport, onSeekCombat, loading }) {
  const [selected, setSelected] = useState(null);
  const [flyPanelDest, setFlyPanelDest] = useState(null); // tile being assigned for a party fly
  const [journalOpen, setJournalOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false); // legend hidden by default to free map space
  // Accepted quests, and those with a known place to put a marker on the map.
  const activeQuests = (state.world.quests || []).filter((q) => q.status === "active");
  const questMarks = activeQuests.filter((q) => q.loc);
  const containerRef = useRef(null);
  const { zoom, transformRef, reset, lastWasDragRef, mouseHandlers } = useZoomPan(containerRef);
  const cur = state.world.currentTile;

  const hexes = collectHexes(cur);

  // Wall segments — render along edges between two seen, passable hexes
  // where the doors graph forbids the crossing. Visualises access control
  // (a city's outer wall, a fortress curtain, a sealed inner sanctum).
  // Drawn from the hex of lower (x,y) so each wall appears once.
  const wallSet = new Set();
  const wallSegments = [];
  for (const h of hexes) {
    if (!isSeen(state, h.x, h.y)) continue;
    const tile = getTile(state, h.x, h.y);
    if (!isPassable(tile)) continue;
    for (let dir = 0; dir < HEX_DIRECTIONS.length; dir++) {
      const d = HEX_DIRECTIONS[dir];
      const nx = h.x + d.x;
      const ny = h.y + d.y;
      if (!isSeen(state, nx, ny)) continue;
      const nTile = getTile(state, nx, ny);
      if (!isPassable(nTile)) continue;
      if (edgeAllowed(tile, h.x, h.y, nTile, nx, ny)) continue;
      // Skip a footprint's outer perimeter — the golden footprint outline
      // already draws it. Keep dark walls only for interior partitions (both
      // hexes in a footprint) and plain access walls (neither in one).
      const aMember = !!tile.poi?.parent && tile.poi?.type !== "hidden";
      const bMember = !!nTile.poi?.parent && nTile.poi?.type !== "hidden";
      if (aMember !== bMember) continue;
      const key = (h.x < nx || (h.x === nx && h.y < ny))
        ? `${h.x},${h.y}|${nx},${ny}`
        : `${nx},${ny}|${h.x},${h.y}`;
      if (wallSet.has(key)) continue;
      wallSet.add(key);
      const [ca, cb] = EDGE_CORNERS[dir];
      const a = hexCorner(h.px, h.py, ca);
      const b = hexCorner(h.px, h.py, cb);
      wallSegments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
  }

  // Optional compound-POI footprint outlines. Tiles that share `poi.parent`
  // render as one larger place (market, dock, citadel ward, castle grounds)
  // while still preserving individual hex/vantage movement.
  const footprintGroups = new Map();
  for (const h of hexes) {
    if (!isSeen(state, h.x, h.y)) continue;
    const tile = getTile(state, h.x, h.y);
    const parent = tile.poi?.parent;
    if (!parent || tile.poi?.type === "hidden") continue;
    if (!footprintGroups.has(parent)) {
      footprintGroups.set(parent, {
        id: parent,
        name: poiFootprintName(tile.poi) || titleFromId(parent) || parent,
        iconKey: assetKeyForTile(tile),
        tiles: [],
        keys: new Set(),
      });
    }
    const group = footprintGroups.get(parent);
    group.tiles.push(h);
    group.keys.add(`${h.x},${h.y}`);
  }

  // A footprint reads as one building: a golden perimeter outline (broken at the
  // entry door, where the graph lets you cross into a reachable neighbour) and a
  // single icon at the centroid. The building name shows only while one of its
  // hexes is selected; sub-area names live in the detail panel.
  const selectedKey = selected ? `${selected.x},${selected.y}` : null;
  const footprintSegments = [];
  const footprintLabels = [];
  const footprintIcons = [];
  for (const group of footprintGroups.values()) {
    if (group.tiles.length < 2) continue;
    let sx = 0;
    let sy = 0;
    for (const h of group.tiles) {
      sx += h.px;
      sy += h.py;
      const tile = getTile(state, h.x, h.y);
      for (let dir = 0; dir < HEX_DIRECTIONS.length; dir++) {
        const d = HEX_DIRECTIONS[dir];
        const nx = h.x + d.x;
        const ny = h.y + d.y;
        if (group.keys.has(`${nx},${ny}`)) continue;
        // Leave a gap at the doorway: an external edge the door graph lets you
        // cross into a reachable neighbour is the way in, not a wall.
        if (isSeen(state, nx, ny)) {
          const nTile = getTile(state, nx, ny);
          if (isPassable(nTile) && edgeAllowed(tile, h.x, h.y, nTile, nx, ny)) continue;
        }
        const [ca, cb] = EDGE_CORNERS[dir];
        const a = hexCorner(h.px, h.py, ca);
        const b = hexCorner(h.px, h.py, cb);
        footprintSegments.push({
          key: `foot-${group.id}-${h.x},${h.y}-${dir}`,
          x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        });
      }
    }
    const cx = sx / group.tiles.length;
    const cy = sy / group.tiles.length;
    // Anchor the icon on the most "interior" member hex — the one with the most
    // in-group neighbours — breaking ties by nearest to the centroid. The icon
    // stays firmly ON the building (never floating between hexes or in the
    // missing notch of an L-shaped / concave footprint) while reading as centred.
    let anchor = group.tiles[0], bestNbrs = -1, bestDist = Infinity;
    for (const h of group.tiles) {
      let nbrs = 0;
      for (const d of HEX_DIRECTIONS) if (group.keys.has(`${h.x + d.x},${h.y + d.y}`)) nbrs++;
      const dist = (h.px - cx) ** 2 + (h.py - cy) ** 2;
      if (nbrs > bestNbrs || (nbrs === bestNbrs && dist < bestDist)) {
        bestNbrs = nbrs; bestDist = dist; anchor = h;
      }
    }
    if (group.iconKey && MAP_ASSETS[group.iconKey]) {
      footprintIcons.push({ key: `foot-icon-${group.id}`, x: anchor.px, y: anchor.py, iconKey: group.iconKey });
    }
    if (selectedKey && group.keys.has(selectedKey)) {
      footprintLabels.push({
        key: `foot-label-${group.id}`,
        x: anchor.px,
        y: anchor.py + 20,
        name: group.name,
      });
    }
  }

  // Place names are otherwise hidden — show one label only for the selected hex
  // (a non-footprint named POI: landmark, river, signpost, etc.). Footprint
  // buildings get their name via footprintLabels above; sub-area and terrain
  // detail live in the panel. This keeps the map text-free until you tap.
  const labels = [];
  if (selected && isSeen(state, selected.x, selected.y)) {
    const st = getTile(state, selected.x, selected.y);
    if (!st.poi?.parent && st.poi?.type !== "hidden" && st.poi?.name) {
      const dq = selected.x - cur.x;
      const dr = selected.y - cur.y;
      const px = SVG_CENTER + HSPACING * (dq + dr / 2);
      const py = SVG_CENTER + VSPACING * dr;
      labels.push({ key: "lbl-selected", x: px, y: py - 22, name: st.poi.name, fill: "#f5dcb8" });
    }
  }

  const selTile = selected ? getTile(state, selected.x, selected.y) : null;
  const selRumored = selected ? getRumored(selected.x, selected.y) : null;
  const selSeen = selected ? isSeen(state, selected.x, selected.y) : false;
  const isSelf = selected && selected.x === cur.x && selected.y === cur.y;
  const curTile = getTile(state, cur.x, cur.y);
  const path = (selected && selSeen && !isSelf) ? findPath(state, cur, selected) : null;
  const canTravel = !!path && path.length > 1 && !loading;
  // A single action covers at most one leg; time/risk shown are for that leg.
  const legPath = path ? path.slice(0, Math.min(path.length, MAX_TRAVEL_HEXES + 1)) : null;
  const totalHexes = path ? path.length - 1 : 0;
  const legHexes = legPath ? legPath.length - 1 : 0;
  const multiLeg = totalHexes > legHexes;
  const totalMins = canTravel ? pathMinutes(state, legPath) : 0;
  const riskPct = canTravel ? pathRiskPercent(state, legPath) : 0;

  // Travel-magic modes available for the selected tile (engine/data/travel-spells).
  // Teleport is the player's own working; Fly can be a PARTY multicast (engine/fly.js).
  const resolve = state.character.resolve ?? 0;
  const playerSpells = knownTravelSpells(state.character);
  const teleSpells = playerSpells.filter((s) => s.mode === "teleport");
  const flyPlan = flyMulticastPlan(state);
  const flightMount = playerFlightMount(state); // a ridden flyer enables air travel without the spell
  const dist = selected ? hexDistance(cur, selected) : 0;
  // Fly may aim at ANY tile (you navigate from the air, revealing as you go) — not
  // just ones already in sight. One cast covers an hour of flight (FLY_TRAVEL_HEXES).
  const canFly = (flyPlan.casters.length > 0 || flightMount) && selected && !isSelf && !loading;
  const flyLeg = Math.min(dist, FLY_TRAVEL_HEXES);
  const flyMins = flyLeg * FLY_MIN_PER_HEX;
  const teleOption = (selected && !isSelf && !loading)
    ? teleSpells.find((s) => (isFinite(s.range) ? (selSeen && dist <= s.range) : isTeleportAnchor(state, selected.x, selected.y)))
    : null;

  let bottomLabel = "Tap a tile to inspect. Drag to pan, pinch or wheel to zoom.";
  let bottomDetail = currentLocationName(state) + " · You are here.";
  let biomeLabel = null;
  let encounterHint = null;
  let areaLabel = null;
  let districtLabel = null;
  let accessLabel = null;
  let footprintLabel = null;
  let partLabel = null;
  if (selected) {
    if (selRumored && !selSeen) {
      bottomLabel = `${selRumored.name} · ${selRumored.kind}`;
      bottomDetail = `Known by reputation, never visited. ${selRumored.description}`;
    } else if (!selSeen) {
      bottomLabel = `Unknown (${selected.x},${selected.y})`;
      bottomDetail = "Beyond your sight. Step closer to learn what's there.";
    } else {
      const T = TERRAINS[selTile.terrain];
      let name = poiPlaceName(selTile.poi) || T?.label || "Wilderness";
      if (selTile.poi?.type === "hidden") name = `? · ${T?.label}`;
      bottomLabel = `${name} (${selected.x},${selected.y})`;
      const meta = poiMeta(selTile, name);
      areaLabel = meta.area;
      districtLabel = meta.district;
      accessLabel = meta.access;
      footprintLabel = meta.footprint;
      partLabel = meta.part;
      if (selTile.poi?.description) bottomDetail = selTile.poi.description;
      else if (selTile.poi?.type === "hidden") bottomDetail = "Something here, not yet known.";
      else bottomDetail = T?.flavor || "";
      biomeLabel = getBiome(selected.x, selected.y).name;
      encounterHint = describeEncounterPotential(selTile, selected.x, selected.y);
      // If the tile is seen and passable but the door graph forbids any
      // approach, surface that. The player can still attempt entry via
      // freeform action (scaling, breaching, magic) — the narrator handles
      // the roll and may use tile_move to relocate on success.
      if (!isSelf && !path && isPassable(selTile)) {
        bottomDetail += "  · No open approach. Scaling, breaching, or magic only.";
      }
    }
  } else {
    biomeLabel = getBiome(cur.x, cur.y).name;
    encounterHint = describeEncounterPotential(curTile, cur.x, cur.y);
    const meta = poiMeta(curTile, currentLocationName(state));
    areaLabel = meta.area;
    districtLabel = meta.district;
    accessLabel = meta.access;
    footprintLabel = meta.footprint;
    partLabel = meta.part;
  }

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      backgroundColor: "#0d1312",
      zIndex: 30,
      display: "flex",
      flexDirection: "column",
      maxWidth: "480px",
      margin: "0 auto",
      borderLeft: "1px solid rgba(215, 167, 111, 0.12)",
      borderRight: "1px solid rgba(215, 167, 111, 0.12)",
      boxShadow: "0 0 50px rgba(0,0,0,0.9)",
    }}>
      <div style={{
        padding: "calc(env(safe-area-inset-top, 0px) + 14px) 16px 12px 16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid rgba(215, 167, 111, 0.15)",
        backgroundColor: "rgba(20, 29, 29, 0.95)"
      }}>
        <button
          onClick={onClose}
          style={{
            ...iconButtonStyle,
            backgroundColor: "rgba(215, 167, 111, 0.08)",
            border: "1px solid rgba(215, 167, 111, 0.2)",
            borderRadius: "50%",
            width: "30px",
            height: "30px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer"
          }}
        >
          <Icon name="arrowLeft" size={13} color="#e6b98c" strokeWidth={2} />
        </button>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          textAlign: "center", lineHeight: 1.15, minWidth: 0, padding: "0 6px",
        }}>
          <div style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: "22px",
            fontStyle: "italic",
            color: "#f5dcb8",
            textShadow: "0 1px 6px rgba(0,0,0,0.4)",
            whiteSpace: "nowrap",
          }}>
            World Map{zoom !== 1 ? ` · ${(zoom * 100).toFixed(0)}%` : ""}
          </div>
          {/* Full date + time lives here — the header chip in the game view
              is kept tight, so this is where the player sees the long form. */}
          <div style={{
            fontSize: "10px", letterSpacing: "0.14em",
            textTransform: "uppercase", fontWeight: 600,
            color: "rgba(215, 167, 111, 0.78)", marginTop: "3px",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            maxWidth: "240px",
          }}>
            {formatDate(state.time)} · {formatTime(state.time)}
          </div>
        </div>
        {/* Map controls (journal, seek-combat, recenter, legend) moved to a
            floating overlay on the map below — this spacer balances the back
            button so the title stays centered. */}
        <div style={{ width: "30px", flexShrink: 0 }} />
      </div>

      <div
        ref={containerRef}
        {...mouseHandlers}
        style={{
          flex: 1,
          overflow: "hidden",
          backgroundColor: "#111716",
          touchAction: "none",
          position: "relative",
          cursor: "grab",
          userSelect: "none",
          perspective: "2400px",
          perspectiveOrigin: "center center",
        }}
      >
        <div ref={transformRef} style={{
          position: "absolute",
          top: "50%", left: "50%",
          transformOrigin: "center center",
          willChange: "transform",
          transformStyle: "preserve-3d",
        }}>
          {/* Semi-3D isometric tilt — rotated as a child of transformRef so
              the zoom/pan transform (written imperatively by useZoomPan in
              screen space) composes cleanly with the tilt. The container
              supplies the perspective; transformRef preserves 3D so this
              child's rotateX isn't flattened by the 2D parent. */}
          <div style={{
            transform: "rotateX(52deg)",
            transformOrigin: "center center",
            transformStyle: "preserve-3d",
            filter: "drop-shadow(0 28px 36px rgba(0,0,0,0.55))",
          }}>
          <svg width={SVG_SIZE} height={SVG_SIZE} style={{ display: "block" }}>
            {hexes.map(({ x, y, px, py }) => {
              const tile = getTile(state, x, y);
              const seen = isSeen(state, x, y);
              const visited = isVisited(state, x, y);
              const isCurrent = x === cur.x && y === cur.y;
              const isSel = selected && selected.x === x && selected.y === y;
              const T = TERRAINS[tile.terrain];
              const isFootprintMember = !!tile.poi?.parent && tile.poi?.type !== "hidden";

              // Color mapping adjustments for premium dark theme:
              // Make light terrains darker & high contrast
              let fill = T?.color || "#222";
              // Tone down high saturation and map to dark fantasy tones
              if (tile.terrain === "plains") fill = "rgba(42, 64, 52, 0.55)";
              else if (tile.terrain === "forest") fill = "rgba(24, 46, 32, 0.75)";
              else if (tile.terrain === "hills") fill = "rgba(58, 64, 46, 0.7)";
              else if (tile.terrain === "mountains") fill = "rgba(68, 54, 48, 0.75)";
              else if (tile.terrain === "sand" || tile.terrain === "desert") fill = "rgba(79, 68, 48, 0.6)";
              else if (tile.terrain === "swamp" || tile.terrain === "water") fill = "rgba(22, 42, 54, 0.65)";
              else if (tile.terrain === "indoor") fill = "rgba(36, 42, 42, 0.85)";
              if (isFootprintMember) fill = "rgba(74, 60, 43, 0.9)";

              let textColor = "#f5dcb8";
              let assetKey = null;
              let opacity;
              // Footprint members drop their per-hex outline so the group reads
              // as one merged building; the golden perimeter + interior walls
              // carry the edges. The current/selected highlight still applies.
              let stroke = isFootprintMember ? "transparent" : "rgba(215, 167, 111, 0.08)";
              let strokeWidth = 1;

              if (seen) {
                opacity = visited ? 1 : 0.8;
                assetKey = isFootprintMember ? null : assetKeyForTile(tile);
              } else {
                opacity = 0.22;
              }

              if (isCurrent) {
                stroke = "#d7a76f";
                strokeWidth = 2.5;
                opacity = 1;
              } else if (isSel) {
                stroke = "#f5dcb8";
                strokeWidth = 2;
                opacity = Math.max(opacity, 0.75);
              }

              // Elevation in the isometric tilt — walls + buildings sit
              // visually higher than ground tiles. We layer a darker
              // "base" hex offset down by `lift` SVG pixels and draw the
              // main hex on top; after the rotateX(52deg) tilt at the
              // container level, the darker base reads as the vertical
              // face of a stone extrusion (the part of the wall below
              // the walk, or the lower storey of a building). Ground
              // tiles (plains, streets, water) skip this. Walls tower
              // over buildings — three-storey city wall vs one-to-two
              // storey halls.
              const lift = (
                tile.terrain === "wall_top" ? 20 :
                tile.terrain === "indoor"   ? 8 :
                isFootprintMember           ? 6 :
                0
              );
              const baseFill = lift > 0 ? "rgba(8, 6, 4, 0.7)" : null;

              return (
                <g
                   key={`${x},${y}`}
                   onClick={() => {
                     if (lastWasDragRef.current) {
                       lastWasDragRef.current = false;
                       return;
                     }
                     setSelected({ x, y });
                   }}
                   style={{ cursor: "pointer", opacity }}
                >
                  {lift > 0 && (
                    <polygon
                      points={hexCornerPoints(px, py + lift)}
                      fill={baseFill}
                      stroke="none"
                      pointerEvents="none"
                    />
                  )}
                  <polygon
                    points={hexCornerPoints(px, py - (lift > 0 ? lift * 0.25 : 0))}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeLinejoin="round"
                  />
                  {assetKey && MAP_ASSETS[assetKey] && (
                    <g transform={`translate(${px - 11}, ${py - 11 - (lift > 0 ? lift * 0.25 : 0)})`} pointerEvents="none">
                      {MAP_ASSETS[assetKey](textColor)}
                    </g>
                  )}
                </g>
              );
            })}
            {footprintSegments.map((s) => (
              <line
                key={s.key}
                x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                stroke="#d7a76f"
                strokeWidth={3.25}
                strokeOpacity={0.78}
                strokeLinecap="round"
                pointerEvents="none"
              />
            ))}
            {wallSegments.map((s, i) => (
              <line
                key={`wall-${i}`}
                x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                stroke="#443525"
                strokeWidth={3}
                strokeOpacity={0.75}
                strokeLinecap="butt"
                pointerEvents="none"
              />
            ))}
            {path && path.length > 1 && (
              <polyline
                points={path.map(p => {
                  const dq = p.x - cur.x;
                  const dr = p.y - cur.y;
                  const ppx = SVG_CENTER + HSPACING * (dq + dr / 2);
                  const ppy = SVG_CENTER + VSPACING * dr;
                  return `${ppx.toFixed(2)},${ppy.toFixed(2)}`;
                }).join(" ")}
                fill="none"
                stroke="#d7a76f"
                strokeWidth={3.5}
                strokeOpacity={0.95}
                strokeLinejoin="round"
                strokeLinecap="round"
                pointerEvents="none"
                style={{ filter: "drop-shadow(0 0 6px rgba(215, 167, 111, 0.6))" }}
              />
            )}
            {footprintIcons.map((ic) => (
              <g key={ic.key} transform={`translate(${ic.x - 11}, ${ic.y - 11})`} pointerEvents="none">
                {MAP_ASSETS[ic.iconKey]("#f5dcb8")}
              </g>
            ))}
            {footprintLabels.map((l) => (
              <g key={l.key} pointerEvents="none">
                <text
                  x={l.x} y={l.y}
                  textAnchor="middle"
                  fontFamily="'Inter', sans-serif"
                  fontSize="9"
                  fontWeight="900"
                  letterSpacing="1.2"
                  fill="none"
                  stroke="#111716"
                  strokeWidth="4"
                  strokeOpacity={0.9}
                  paintOrder="stroke"
                >
                  {l.name.toUpperCase()}
                </text>
                <text
                  x={l.x} y={l.y}
                  textAnchor="middle"
                  fontFamily="'Inter', sans-serif"
                  fontSize="9"
                  fontWeight="900"
                  letterSpacing="1.2"
                  fill="#d7a76f"
                  fillOpacity="0.78"
                >
                  {l.name.toUpperCase()}
                </text>
              </g>
            ))}
            {labels.map((l) => (
              <g key={l.key} pointerEvents="none">
                <text
                  x={l.x} y={l.y}
                  textAnchor="middle"
                  fontFamily="'Instrument Serif', serif"
                  fontStyle="italic"
                  fontSize="16"
                  fontWeight="700"
                  fill="none"
                  stroke="#111716"
                  strokeWidth="5"
                  strokeOpacity={0.92}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                >
                  {l.name}
                </text>
                <text
                  x={l.x} y={l.y}
                  textAnchor="middle"
                  fontFamily="'Instrument Serif', serif"
                  fontStyle="italic"
                  fontSize="16"
                  fontWeight="700"
                  fill="#f5dcb8"
                >
                  {l.name}
                </text>
              </g>
            ))}
            {/* Quest markers — an objective ring + label at each accepted quest's place */}
            {questMarks.map((q) => {
              const qx = SVG_CENTER + HSPACING * ((q.loc.x - cur.x) + (q.loc.y - cur.y) / 2);
              const qy = SVG_CENTER + VSPACING * (q.loc.y - cur.y);
              return (
                <g key={`q-${q.id}`} pointerEvents="none">
                  <circle cx={qx} cy={qy} r="15" fill="none" stroke="#f5d76e" strokeWidth="2.5" strokeOpacity="0.95" style={{ filter: "drop-shadow(0 0 5px rgba(245,215,110,0.7))" }} />
                  <path d={`M${qx} ${qy - 9} L${qx + 5} ${qy} L${qx} ${qy + 9} L${qx - 5} ${qy} Z`} fill="#f5d76e" stroke="#111716" strokeWidth="1" />
                  <text x={qx} y={qy + 27} textAnchor="middle" fontFamily="'Instrument Serif', serif" fontStyle="italic" fontSize="13" fontWeight="700" fill="none" stroke="#111716" strokeWidth="4" strokeOpacity="0.92" paintOrder="stroke">{q.locName || q.title}</text>
                  <text x={qx} y={qy + 27} textAnchor="middle" fontFamily="'Instrument Serif', serif" fontStyle="italic" fontSize="13" fontWeight="700" fill="#f5d76e">{q.locName || q.title}</text>
                </g>
              );
            })}
          </svg>
          </div>
        </div>
        {/* Legend toggle — bottom-center of the map. Lives inside the map area
            so it always clears the location panel below; stops the press from
            starting a map pan. */}
        <button
          onClick={() => setLegendOpen((v) => !v)}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          aria-label="Toggle map legend" title="Map legend"
          style={{
            position: "absolute", bottom: "12px", left: "50%", transform: "translateX(-50%)",
            zIndex: 7, display: "flex", alignItems: "center", gap: "6px",
            height: "32px", padding: "0 14px", borderRadius: "999px",
            backgroundColor: legendOpen ? "rgba(215, 167, 111, 0.28)" : "rgba(20, 29, 29, 0.78)",
            border: "1px solid rgba(215, 167, 111, 0.28)", cursor: "pointer",
            backdropFilter: "blur(8px)", boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
          }}
        >
          <Icon name="map" size={15} color="#e6b98c" strokeWidth={2} />
          <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", color: "#e6b98c" }}>{legendOpen ? "Hide" : "Legend"}</span>
        </button>
        {/* Floating overlay anchored to the map area — never reflows the map. */}
        {legendOpen && <MapLegend />}
      </div>

      {journalOpen && (
        <div style={{
          position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 104px)", left: "12px", right: "12px",
          maxHeight: "55%", overflowY: "auto", zIndex: 6,
          backgroundColor: "rgba(12, 17, 17, 0.97)", backdropFilter: "blur(12px)",
          border: "1px solid rgba(215, 167, 111, 0.3)", borderRadius: "14px",
          padding: "14px 16px", boxShadow: "0 18px 44px rgba(0,0,0,0.6)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "19px", color: "#f5dcb8" }}>Quest Journal</div>
            <button onClick={() => setJournalOpen(false)} style={{ ...iconButtonStyle, width: "26px", height: "26px" }}><Icon name="x" size={12} color="#e6b98c" strokeWidth={2} /></button>
          </div>
          {activeQuests.length === 0 ? (
            <div style={{ fontSize: "12px", fontStyle: "italic", color: "rgba(237,228,208,0.5)", padding: "8px 0" }}>No quests taken. Read the boards at the tavern and the gaol.</div>
          ) : activeQuests.map((q) => {
            const dist = q.loc ? hexDistance(cur, q.loc) : null;
            return (
              <div key={q.id} style={{ padding: "9px 0", borderTop: "1px solid rgba(215,167,111,0.12)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "baseline" }}>
                  <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "15px", color: "#f5dcb8" }}>{q.title}</span>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#d7a76f", flexShrink: 0 }}>
                    {q.type === "bounty" ? `${formatCopper(q.rewardCp)} / ${formatCopper(q.rewardDeadCp || 0)} dead` : formatCopper(q.rewardCp || 0)}
                  </span>
                </div>
                <div style={{ fontSize: "8px", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(215,167,111,0.7)", margin: "2px 0 3px" }}>
                  {QUEST_TYPE_LABEL[q.type] || "Task"} · {q.giver}{q.loc ? ` · ${q.locName} (${dist} hex${dist === 1 ? "" : "es"} ${compassDir(cur, q.loc)})` : ""}
                </div>
                <div style={{ fontSize: "12px", color: "rgba(237,228,208,0.8)", lineHeight: 1.4 }}>{q.desc}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating map controls — lifted off the header and onto the map to
          declutter the header. Anchored to the outer (positioned) container,
          just below the header, top-right. */}
      <div style={{
        position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 64px)", right: "16px",
        zIndex: 7, display: "flex", gap: "8px",
      }}>
        {/* order left→right: look-for-fights, journal, recenter — so recenter
            sits at the very top-right corner. */}
        {onSeekCombat && (
          <button
            onClick={onSeekCombat} disabled={loading}
            aria-label="Look for a fight" title="Look for trouble in this area"
            style={{
              ...iconButtonStyle,
              backgroundColor: "rgba(239, 68, 68, 0.14)",
              border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "50%",
              width: "34px", height: "34px", display: "flex", alignItems: "center",
              justifyContent: "center", cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.5 : 1, backdropFilter: "blur(8px)",
            }}
          >
            <Icon name="swords" size={15} color="#fca5a5" strokeWidth={2} />
          </button>
        )}
        <button
          onClick={() => setJournalOpen((v) => !v)}
          aria-label="Quest journal" title="Quest journal"
          style={{
            ...iconButtonStyle, position: "relative",
            backgroundColor: journalOpen ? "rgba(215, 167, 111, 0.28)" : "rgba(20, 29, 29, 0.72)",
            border: "1px solid rgba(215, 167, 111, 0.3)", borderRadius: "50%",
            width: "34px", height: "34px", display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "pointer", backdropFilter: "blur(8px)",
          }}
        >
          <Icon name="book" size={15} color="#e6b98c" strokeWidth={2} />
          {activeQuests.length > 0 && (
            <span style={{ position: "absolute", top: "-4px", right: "-4px", minWidth: "15px", height: "15px", padding: "0 3px", borderRadius: "999px", backgroundColor: "#d7a76f", color: "#111716", fontSize: "8px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{activeQuests.length}</span>
          )}
        </button>
        <button
          onClick={reset}
          aria-label="Recenter on player" title="Recenter on player"
          style={{
            ...iconButtonStyle,
            backgroundColor: "rgba(20, 29, 29, 0.72)",
            border: "1px solid rgba(215, 167, 111, 0.2)", borderRadius: "50%",
            width: "34px", height: "34px", display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "pointer", backdropFilter: "blur(8px)",
          }}
        >
          <Icon name="crosshair" size={14} color="#e6b98c" strokeWidth={2} />
        </button>
      </div>

      <div
        className="slide-up"
        style={{ 
          padding: "16px 20px calc(env(safe-area-inset-bottom, 0px) + 20px) 20px", 
          backgroundColor: "rgba(20, 29, 29, 0.95)", 
          backdropFilter: "blur(12px)",
          borderTop: "1px solid rgba(215, 167, 111, 0.22)", 
          boxShadow: "0 -16px 48px rgba(0,0,0,0.5)" 
        }}
      >
        <div style={{ fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#e6b98c", marginBottom: "4px", fontWeight: 800 }}>
          {selected ? "Selected" : "Here"}
        </div>
        <div style={{ 
          fontFamily: "'Instrument Serif', serif", 
          fontStyle: "italic", 
          fontSize: "18px", 
          color: "#f5dcb8", 
          lineHeight: "1.3" 
        }}>
          {bottomLabel}
        </div>
        <div style={{ fontSize: "13px", color: "rgba(237, 228, 208, 0.85)", lineHeight: "1.45", marginTop: "4px" }}>{bottomDetail}</div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "6px" }}>
          {areaLabel && (
            <div style={{ fontSize: "10px", color: "rgba(215, 167, 111, 0.78)", letterSpacing: "0.06em", fontStyle: "italic" }}>Area: {areaLabel}</div>
          )}
          {districtLabel && (
            <div style={{ fontSize: "10px", color: "rgba(215, 167, 111, 0.7)", letterSpacing: "0.06em", fontStyle: "italic" }}>District: {districtLabel}</div>
          )}
          {accessLabel && (
            <div style={{ fontSize: "10px", color: "rgba(215, 167, 111, 0.64)", letterSpacing: "0.06em", fontStyle: "italic" }}>Access: {accessLabel}</div>
          )}
          {footprintLabel && (
            <div style={{ fontSize: "10px", color: "rgba(215, 167, 111, 0.74)", letterSpacing: "0.06em", fontStyle: "italic" }}>POI: {footprintLabel}</div>
          )}
          {partLabel && (
            <div style={{ fontSize: "10px", color: "rgba(237, 228, 208, 0.66)", letterSpacing: "0.06em", fontStyle: "italic" }}>Hex: {partLabel}</div>
          )}
          {biomeLabel && (
            <div style={{ fontSize: "10px", color: "rgba(215, 167, 111, 0.7)", letterSpacing: "0.08em", fontStyle: "italic" }}>Region: {biomeLabel}</div>
          )}
          {encounterHint && (
            <div style={{ fontSize: "10px", color: "rgba(239, 68, 68, 0.85)", letterSpacing: "0.06em", fontWeight: 800 }}>{encounterHint}</div>
          )}
        </div>
        <div style={{ marginBottom: "10px" }} />
        {(canFly || teleOption) && (
          <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            {canFly && (() => {
              const timeStr = flyMins >= 60 ? "~1h" : `~${flyMins}m`;
              const legStr = dist > FLY_TRAVEL_HEXES ? `first ${flyLeg} of ${dist} · ` : "";
              // A ridden flying mount is preferred — free of resolve, paid in the
              // beast's stamina (engine handles the fed/rested gate on click).
              if (flightMount) {
                return (
                  <button onClick={() => onFly(selected)} style={{
                    flex: 1, height: "40px", borderRadius: "20px", fontFamily: "inherit", fontWeight: 800, fontSize: "12px",
                    border: "1px solid rgba(127,199,224,0.55)", backgroundColor: "rgba(127,199,224,0.16)", color: "#bfe3f2", cursor: "pointer",
                  }}>{`Fly · ${legStr}${timeStr} · on ${flightMount.name}`}</button>
                );
              }
              const party = flyPlan.casts > 1;
              const ok = flyPlan.feasible;
              const cost = party ? flyPlan.totalCost : flyPlan.flyCost;
              return (
                <button onClick={() => { if (!ok) return; party ? setFlyPanelDest(selected) : onFly(selected); }} disabled={!ok} style={{
                  flex: 1, height: "40px", borderRadius: "20px", fontFamily: "inherit", fontWeight: 800, fontSize: "12px",
                  border: `1px solid ${ok ? "rgba(127,199,224,0.55)" : "rgba(127,199,224,0.18)"}`,
                  backgroundColor: ok ? "rgba(127,199,224,0.16)" : "rgba(127,199,224,0.06)",
                  color: ok ? "#bfe3f2" : "rgba(127,199,224,0.4)", cursor: ok ? "pointer" : "not-allowed",
                }}>{`${party ? "Fly party" : "Fly"} · ${legStr}${timeStr} · ${cost} resolve`}</button>
              );
            })()}
            {teleOption && (() => {
              const ok = resolve >= teleOption.resolveCost;
              return (
                <button onClick={() => ok && onTeleport(selected, teleOption.id)} disabled={!ok} style={{
                  flex: 1, height: "40px", borderRadius: "20px", fontFamily: "inherit", fontWeight: 800, fontSize: "12px",
                  border: `1px solid ${ok ? "rgba(176,114,230,0.55)" : "rgba(176,114,230,0.18)"}`,
                  backgroundColor: ok ? "rgba(176,114,230,0.16)" : "rgba(176,114,230,0.06)",
                  color: ok ? "#d9c2f2" : "rgba(176,114,230,0.4)", cursor: ok ? "pointer" : "not-allowed",
                }}>{teleOption.name} · {teleOption.resolveCost} resolve</button>
              );
            })()}
          </div>
        )}
        <button
          onClick={() => canTravel && onTravel(selected, path)} disabled={!canTravel}
          style={{
            width: "100%", 
            height: "44px", 
            borderRadius: "22px", 
            border: canTravel ? "none" : "1px solid rgba(215, 167, 111, 0.15)",
            backgroundColor: canTravel ? "#d7a76f" : "rgba(215, 167, 111, 0.08)",
            color: canTravel ? "#111716" : "rgba(215, 167, 111, 0.35)",
            fontSize: "13px", 
            fontWeight: 800,
            cursor: canTravel ? "pointer" : "not-allowed",
            transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow: canTravel ? "0 4px 12px rgba(215, 167, 111, 0.2)" : "none"
          }}
          onMouseOver={(e) => {
            if (canTravel) {
              e.currentTarget.style.backgroundColor = "#e6b98c";
              e.currentTarget.style.boxShadow = "0 4px 20px rgba(215, 167, 111, 0.4)";
            }
          }}
          onMouseOut={(e) => {
            if (canTravel) {
              e.currentTarget.style.backgroundColor = "#d7a76f";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(215, 167, 111, 0.2)";
            }
          }}
        >
          {!selected ? "Choose a destination" :
            isSelf ? "You're here" :
            selRumored && !selSeen ? `Too distant · ${hexDistance(cur, selected)} hexes by rumor` :
            !selSeen ? "Beyond vision" :
            !canTravel ? "No passable path" :
            multiLeg ? `Travel · first ${legHexes} of ${totalHexes} hexes · ~${totalMins} min · risk ${riskPct}%`
            : `Travel · ${legHexes} hex${legHexes === 1 ? "" : "es"} · ~${totalMins} min · risk ${riskPct}%`}
        </button>
      </div>
      {flyPanelDest && (
        <FlyPanel
          plan={flyPlan}
          destName={poiPlaceName(getTile(state, flyPanelDest.x, flyPanelDest.y).poi) || `${TERRAINS[getTile(state, flyPanelDest.x, flyPanelDest.y).terrain]?.label} (${flyPanelDest.x},${flyPanelDest.y})`}
          onCancel={() => setFlyPanelDest(null)}
          onConfirm={(assign) => { const d = flyPanelDest; setFlyPanelDest(null); onFly(d, assign); }}
        />
      )}
    </div>
  );
}

// Party fly-multicast assignment: one casting of Fly per head, the resolve toll
// split across the casters who know it. Defaults to an even auto-balance; the
// player can reassign each passenger and see every caster's resolve before/after.
function FlyPanel({ plan, destName, onConfirm, onCancel }) {
  const [assign, setAssign] = useState(plan.autoAssign);
  const cost = assignmentCost(assign, plan.flyCost);
  const valid = assignmentValid(assign, plan.casters, plan.flyCost);
  const row = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", padding: "6px 0" };
  const sel = {
    fontFamily: "inherit", fontSize: "12px", color: "#bfe3f2", background: "rgba(127,199,224,0.10)",
    border: "1px solid rgba(127,199,224,0.4)", borderRadius: "8px", padding: "5px 8px",
  };
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 8, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", background: "rgba(6,9,9,0.6)" }}
         onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: "420px", maxHeight: "82%", overflowY: "auto",
        backgroundColor: "rgba(12,17,17,0.98)", backdropFilter: "blur(12px)",
        border: "1px solid rgba(127,199,224,0.35)", borderRadius: "16px",
        padding: "16px 18px", boxShadow: "0 22px 54px rgba(0,0,0,0.7)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "20px", color: "#bfe3f2" }}>Fly the party</div>
          <button onClick={onCancel} style={{ ...iconButtonStyle, width: "26px", height: "26px" }}><Icon name="x" size={12} color="#bfe3f2" strokeWidth={2} /></button>
        </div>
        <div style={{ fontSize: "12px", color: "rgba(237,228,208,0.65)", marginBottom: "10px" }}>
          To {destName}. One casting per soul — <b>{plan.casts}</b> in all, <b>{plan.flyCost}</b> resolve each. Choose who carries whom.
        </div>

        <div style={{ fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(127,199,224,0.6)", marginBottom: "2px" }}>Passengers</div>
        {plan.passengers.map((p) => (
          <div key={p.id} style={row}>
            <span style={{ fontSize: "13px", color: "#f5e9d2" }}>{p.name}{p.kind === "player" ? " (you)" : ""}</span>
            <select value={assign[p.id] ?? ""} onChange={(e) => setAssign({ ...assign, [p.id]: e.target.value })} style={sel}>
              {plan.casters.map((c) => <option key={c.id} value={c.id} style={{ color: "#111" }}>flown by {c.name}</option>)}
            </select>
          </div>
        ))}

        <div style={{ fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(127,199,224,0.6)", margin: "12px 0 2px" }}>Casters' resolve</div>
        {plan.casters.map((c) => {
          const after = c.resolve - (cost[c.id] || 0);
          const over = after < 0;
          return (
            <div key={c.id} style={row}>
              <span style={{ fontSize: "13px", color: "#f5e9d2" }}>{c.name} <span style={{ color: "rgba(237,228,208,0.45)" }}>×{(cost[c.id] || 0) / plan.flyCost}</span></span>
              <span style={{ fontSize: "13px", fontWeight: 800, color: over ? "#e08a8a" : "#9fdcc0" }}>{c.resolve} → {after} <span style={{ color: "rgba(237,228,208,0.4)", fontWeight: 400 }}>/ {c.resolveMax}</span></span>
            </div>
          );
        })}

        <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
          <button onClick={() => setAssign(plan.autoAssign)} style={{
            flex: "0 0 auto", height: "40px", padding: "0 14px", borderRadius: "20px", fontFamily: "inherit", fontWeight: 700, fontSize: "12px",
            border: "1px solid rgba(215,167,111,0.4)", background: "rgba(215,167,111,0.08)", color: "#e6b98c", cursor: "pointer",
          }}>Auto-balance</button>
          <button onClick={() => valid && onConfirm(assign)} disabled={!valid} style={{
            flex: 1, height: "40px", borderRadius: "20px", fontFamily: "inherit", fontWeight: 800, fontSize: "13px",
            border: "none", background: valid ? "#7fc7e0" : "rgba(127,199,224,0.12)",
            color: valid ? "#08171c" : "rgba(127,199,224,0.4)", cursor: valid ? "pointer" : "not-allowed",
          }}>{valid ? `Take wing · ${plan.totalCost} resolve` : "Not enough resolve"}</button>
        </div>
      </div>
    </div>
  );
}
