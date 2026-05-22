import React, { useState, useRef } from "react";
import { Icon } from "./Icon.jsx";
import { iconButtonStyle } from "./primitives.jsx";
import { MAP_VIEW_RADIUS } from "../config.js";
import { TERRAINS } from "../data/terrains.js";
import { getRumored, RUMORED } from "../data/rumored.js";
import { FABLED, FABLED_BY_COORD } from "../data/fabled.js";
import { RIVERS } from "../data/rivers.js";
import { getBiome } from "../data/biomes.js";
import {
  getTile, isSeen, isVisited,
  currentLocationName, hexDistance,
  findPath, pathMinutes,
  HEX_DIRECTIONS, edgeAllowed, isPassable,
} from "../engine/world.js";
import { describeEncounterPotential, pathRiskPercent } from "../engine/encounters.js";
import { formatTime, formatDate } from "../engine/time.js";
import { useZoomPan } from "./useZoomPan.js";

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
    { key: "gaol", label: "gaol" },
    { key: "temple", label: "temple" }, { key: "town", label: "town" },
    { key: "gate", label: "gate" }, { key: "site", label: "site" },
    { key: "unknown", label: "unknown" }, { key: "city", label: "city" },
    { key: "river", label: "river" }, { key: "mtns", label: "mtns" },
    { key: "ruin", label: "ruin" }, { key: "lake", label: "lake" },
  ];
  return (
    <div style={{
      display: "flex",
      flexWrap: "wrap",
      gap: "8px 12px",
      padding: "8px 12px",
      borderTop: "1px solid rgba(215, 167, 111, 0.15)",
      borderBottom: "1px solid rgba(215, 167, 111, 0.15)",
      backgroundColor: "rgba(20, 29, 29, 0.95)",
      fontSize: "11px",
      color: "rgba(237, 228, 208, 0.72)",
      justifyContent: "center"
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

export function MapView({ state, onClose, onTravel, onSeekCombat, loading }) {
  const [selected, setSelected] = useState(null);
  const containerRef = useRef(null);
  const { zoom, transformRef, reset, lastWasDragRef, mouseHandlers } = useZoomPan(containerRef);
  const cur = state.world.currentTile;

  const hexes = collectHexes(cur);

  // Road segments connect adjacent seen tiles in the road network. At least
  // one end must be road or settlement, and both must be connectable
  // (road / settlement / indoor). That draws roads between hexes, town squares
  // to their gates, and gates to outer roads — while skipping pairs of
  // adjacent indoor buildings that don't share a street between them.
  function isConnectable(t) {
    return t.terrain === "road" || t.terrain === "settlement" || t.terrain === "indoor";
  }
  function isStreet(t) {
    return t.terrain === "road" || t.terrain === "settlement";
  }
  const segmentSet = new Set();
  const roadSegments = [];
  for (const h of hexes) {
    if (!isSeen(state, h.x, h.y)) continue;
    const tile = getTile(state, h.x, h.y);
    if (!isConnectable(tile)) continue;
    for (const dir of HEX_DIRECTIONS) {
      const nx = h.x + dir.x;
      const ny = h.y + dir.y;
      if (!isSeen(state, nx, ny)) continue;
      const nTile = getTile(state, nx, ny);
      if (!isConnectable(nTile)) continue;
      if (!isStreet(tile) && !isStreet(nTile)) continue;
      const key = (h.x < nx || (h.x === nx && h.y < ny))
        ? `${h.x},${h.y}|${nx},${ny}`
        : `${nx},${ny}|${h.x},${h.y}`;
      if (segmentSet.has(key)) continue;
      segmentSet.add(key);
      const npx = SVG_CENTER + HSPACING * ((nx - cur.x) + (ny - cur.y) / 2);
      const npy = SVG_CENTER + VSPACING * (ny - cur.y);
      roadSegments.push({ x1: h.px, y1: h.py, x2: npx, y2: npy });
    }
  }

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

  // Landmark labels — named places that read at a glance on the map. Built
  // from getTile so handcrafted city/village/town centres surface here, and
  // rumored/fabled coords fall through getTile to the same poi types.
  const LABELABLE_TYPES = new Set(["city", "village", "town", "fortress", "ruin", "mountains", "lake"]);
  const labels = [];
  for (const { x, y, px, py } of hexes) {
    if (!isSeen(state, x, y)) continue;
    const tile = getTile(state, x, y);
    if (!tile.poi || !LABELABLE_TYPES.has(tile.poi.type)) continue;
    labels.push({ key: `lbl-${x},${y}`, x: px, y: py - 22, name: tile.poi.name, fill: "#1A1A1A" });
  }
  // One label per river at its midpoint, painted in a watery hue.
  for (const r of RIVERS) {
    const mid = r.path[Math.floor(r.path.length / 2)];
    if (!isSeen(state, mid.x, mid.y)) continue;
    const mpx = SVG_CENTER + HSPACING * ((mid.x - cur.x) + (mid.y - cur.y) / 2);
    const mpy = SVG_CENTER + VSPACING * (mid.y - cur.y);
    labels.push({ key: `lbl-river-${r.id}`, x: mpx, y: mpy - 14, name: r.name, fill: "#2E4A6E" });
  }

  const selTile = selected ? getTile(state, selected.x, selected.y) : null;
  const selRumored = selected ? getRumored(selected.x, selected.y) : null;
  const selSeen = selected ? isSeen(state, selected.x, selected.y) : false;
  const isSelf = selected && selected.x === cur.x && selected.y === cur.y;
  const curTile = getTile(state, cur.x, cur.y);
  const path = (selected && selSeen && !isSelf) ? findPath(state, cur, selected) : null;
  const canTravel = !!path && path.length > 1 && !loading;
  const totalMins = canTravel ? pathMinutes(state, path) : 0;
  const riskPct = canTravel ? pathRiskPercent(state, path) : 0;

  let bottomLabel = "Tap a tile to inspect. Drag to pan, pinch or wheel to zoom.";
  let bottomDetail = currentLocationName(state) + " · You are here.";
  let biomeLabel = null;
  let encounterHint = null;
  if (selected) {
    if (selRumored && !selSeen) {
      bottomLabel = `${selRumored.name} · ${selRumored.kind}`;
      bottomDetail = `Known by reputation, never visited. ${selRumored.description}`;
    } else if (!selSeen) {
      bottomLabel = `Unknown (${selected.x},${selected.y})`;
      bottomDetail = "Beyond your sight. Step closer to learn what's there.";
    } else {
      const T = TERRAINS[selTile.terrain];
      let name = selTile.poi?.name || T?.label || "Wilderness";
      if (selTile.poi?.type === "hidden") name = `? · ${T?.label}`;
      bottomLabel = `${name} (${selected.x},${selected.y})`;
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
        <div style={{ display: "flex", gap: "8px" }}>
          {onSeekCombat && (
            <button
              onClick={onSeekCombat}
              disabled={loading}
              aria-label="Look for a fight"
              title="Look for trouble in this area"
              style={{
                ...iconButtonStyle,
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "50%", width: "30px", height: "30px",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: loading ? "default" : "pointer", opacity: loading ? 0.5 : 1,
              }}
            >
              <Icon name="swords" size={14} color="#fca5a5" strokeWidth={2} />
            </button>
          )}
          <button
            onClick={reset}
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
            aria-label="Recenter on player"
          >
            <Icon name="crosshair" size={13} color="#e6b98c" strokeWidth={2} />
          </button>
        </div>
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
        }}
      >
        <div ref={transformRef} style={{
          position: "absolute",
          top: "50%", left: "50%",
          transformOrigin: "center center",
          willChange: "transform",
        }}>
          <svg width={SVG_SIZE} height={SVG_SIZE} style={{ display: "block" }}>
            {hexes.map(({ x, y, px, py }) => {
              const tile = getTile(state, x, y);
              const seen = isSeen(state, x, y);
              const visited = isVisited(state, x, y);
              const isCurrent = x === cur.x && y === cur.y;
              const isSel = selected && selected.x === x && selected.y === y;
              const T = TERRAINS[tile.terrain];

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

              let textColor = "#f5dcb8";
              let assetKey = null;
              let opacity;
              let stroke = "rgba(215, 167, 111, 0.08)";
              let strokeWidth = 1;

              if (seen) {
                opacity = visited ? 1 : 0.8;
                assetKey = assetKeyForTile(tile);
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
                  <polygon
                    points={hexCornerPoints(px, py)}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeLinejoin="round"
                  />
                  {assetKey && MAP_ASSETS[assetKey] && (
                    <g transform={`translate(${px - 11}, ${py - 11})`} pointerEvents="none">
                      {MAP_ASSETS[assetKey](textColor)}
                    </g>
                  )}
                </g>
              );
            })}
            {roadSegments.map((s, i) => (
              <line
                key={`road-${i}`}
                x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                stroke="#6B4A2E"
                strokeWidth={3}
                strokeOpacity={0.65}
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
          </svg>
        </div>
      </div>

      <MapLegend />

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
          {biomeLabel && (
            <div style={{ fontSize: "10px", color: "rgba(215, 167, 111, 0.7)", letterSpacing: "0.08em", fontStyle: "italic" }}>Region: {biomeLabel}</div>
          )}
          {biomeLabel && encounterHint && <span style={{ color: "rgba(215, 167, 111, 0.3)", fontSize: "10px" }}>•</span>}
          {encounterHint && (
            <div style={{ fontSize: "10px", color: "rgba(239, 68, 68, 0.85)", letterSpacing: "0.06em", fontWeight: 800 }}>{encounterHint}</div>
          )}
        </div>
        <div style={{ marginBottom: "14px" }} />
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
            `Travel · ${path.length - 1} hex${path.length - 1 === 1 ? "" : "es"} · ~${totalMins} min · risk ${riskPct}%`}
        </button>
      </div>
    </div>
  );
}
