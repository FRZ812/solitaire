import React, { useState, useRef, useMemo, useEffect } from "react";
import { HANDCRAFTED } from "../data/handcrafted-tiles.js";
import { SEALED_STRUCTURES } from "../data/sealed-structures.js";
import { TERRAINS } from "../data/terrains.js";
import { useZoomPan } from "./useZoomPan.js";

// ============================================================
// MAP EDITOR — handcrafted-map authoring tool, mounted at `#/edit`.
//
// Loads the current HANDCRAFTED tile map + the Whitemarch sealed
// structure (streets / buildings / gates) into local React state,
// renders the same isometric tilt as the in-game MapView, and exposes:
//
//   - Click-to-select a hex; right panel shows terrain, POI fields,
//     and adjacent-neighbour door toggles.
//   - "Move" tool: select source then click destination to relocate
//     a tile's data (terrain + poi + doors, preserving everything
//     except coordinates).
//   - "Paint" tool: stamp a terrain onto empty hexes (or repaint).
//   - "Delete" tool: clear a hex (returns it to procedural generation).
//   - Streets / buildings membership toggle (sealed-structures side).
//   - Local-storage persistence so reload doesn't lose work; "Reset
//     to source" reverts to the original module contents.
//   - Export pane: emits paste-back JS text for the tile authoring
//     section of handcrafted-tiles.js and the streets/buildings
//     arrays of sealed-structures.js. The user manually pastes the
//     emitted text back into the source files in their editor.
//
// Intentionally NOT in this MVP (follow-ups):
//   - Drag-and-drop relocation (the Move tool is two-step for now).
//   - Visual door editor for the gate complex (uses authored doors;
//     edit them by hand in the textarea for now).
//   - Citadel / Underworks structure editing (only Great Wall's
//     streets+buildings list is exposed; the rest stays as authored).
// ============================================================

const HEX_SIZE = 22;
const HSPACING = Math.sqrt(3) * HEX_SIZE;
const VSPACING = 1.5 * HEX_SIZE;
const SVG_SIZE = 12000;
const SVG_CENTER = SVG_SIZE / 2;
const HEX_DIRS = [
  { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: -1 },
  { x: -1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: 1 },
];

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

// True 3D extrusion — see MapView.jsx hexPrismParts() for the full doc.
// Emits ONE south-wrap side polygon (top[1] → top[2] → top[3] →
// gnd[3] → gnd[2] → gnd[1]) plus the top hex polygon. One combined
// polygon avoids the lit/dark seam down the front of the wall that
// two separate facets would produce; the left/right vertical edges
// of a pointy-top hex are degenerate anyway, and the rear edges are
// hidden by the top hex.
function hexPrismParts(cx, cy, lift) {
  const topCorners = [];
  const gndCorners = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const dx = HEX_SIZE * Math.cos(angle);
    const dy = HEX_SIZE * Math.sin(angle);
    topCorners.push({ x: cx + dx, y: cy - lift + dy });
    gndCorners.push({ x: cx + dx, y: cy + dy });
  }
  const topPoints = topCorners.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const wrapPoints = [topCorners[1], topCorners[2], topCorners[3], gndCorners[3], gndCorners[2], gndCorners[1]]
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
  return { topPoints, sidePoints: wrapPoints };
}

const SIDE_SHADE = "rgb(46, 36, 26)";

const LS_KEY = "solitaire-mapeditor-draft-v1";

const TERRAIN_OPTIONS = Object.keys(TERRAINS);
const POI_TYPE_OPTIONS = [
  "", "plaza", "hall", "market", "stair", "gate", "tower", "barracks",
  "dock", "yard", "court", "prison", "smithy", "temple", "town",
  "river", "sewer", "slavemarket", "hidden", "site", "bldg",
];
const POI_ACCESS_OPTIONS = ["", "public", "restricted", "conditional", "hidden"];

// Find the Whitemarch sealed structure (the one with streets + buildings).
// Other structures (Citadel / Underworks) stay read-only in this MVP.
function findWhitemarchStructure(structures) {
  return structures.find((s) => s.streets && s.buildings) || null;
}

function cloneInitial() {
  const tiles = {};
  for (const [k, v] of Object.entries(HANDCRAFTED)) {
    tiles[k] = JSON.parse(JSON.stringify(v));
  }
  const whitemarch = findWhitemarchStructure(SEALED_STRUCTURES);
  const streets = whitemarch ? whitemarch.streets.map((c) => ({ ...c })) : [];
  const buildings = whitemarch ? whitemarch.buildings.map((b) => JSON.parse(JSON.stringify(b))) : [];
  const gates = whitemarch ? whitemarch.gates.map((pair) => pair.map((c) => ({ ...c }))) : [];
  return { tiles, streets, buildings, gates };
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.tiles) return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

function saveDraft(state) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch (e) {
    // best-effort; quota etc.
  }
}

function clearDraft() {
  try { localStorage.removeItem(LS_KEY); } catch (e) {}
}

// ============================================================
// EDGE MODEL — the door graph in the engine is per-tile (each tile lists
// its allowed neighbours), but for authoring and rendering it's much
// cleaner to think of the edge BETWEEN two adjacent hexes as the unit
// of state. Closed/open is a property of the shared boundary, not of
// either tile in isolation. These helpers project the per-tile doors
// data into an edge-keyed view, and the toggle helper writes the new
// edge state back into BOTH adjacent tiles' doors arrays atomically.
//
// Edge state semantics:
//   "open"    — both sides' doors arrays include the other, OR neither
//               side has an explicit doors array (default-open). Edges
//               between tiles where neither has a doors array are kept
//               in the "default" bucket below to distinguish.
//   "closed"  — at least one side blocks the other (the doors array
//               exists but doesn't include the neighbour).
//   "default" — neither side has an explicit doors array (wilderness /
//               unauthored). The toggle materialises both sides' doors
//               before flipping so the new state is explicit.
// ============================================================
function canonicalEdgeKey(ax, ay, bx, by) {
  if (ax < bx || (ax === bx && ay < by)) return `${ax},${ay}|${bx},${by}`;
  return `${bx},${by}|${ax},${ay}`;
}

function tilePermitsEdge(tile, nx, ny) {
  if (!tile) return true;
  if (!Array.isArray(tile.doors)) return true;
  return tile.doors.some((d) => d.x === nx && d.y === ny);
}

function getEdgeState(tiles, ax, ay, bx, by) {
  const ta = tiles[`${ax},${ay}`];
  const tb = tiles[`${bx},${by}`];
  if (!ta || !tb) return "missing";
  const aArr = Array.isArray(ta.doors);
  const bArr = Array.isArray(tb.doors);
  const aPermits = !aArr || ta.doors.some((d) => d.x === bx && d.y === by);
  const bPermits = !bArr || tb.doors.some((d) => d.x === ax && d.y === ay);
  if (!aPermits || !bPermits) return "closed";
  if (!aArr && !bArr) return "default";
  return "open";
}

// Toggle the edge between (ax,ay) and (bx,by) in `tiles` and return a
// NEW tiles object (immutable update). Modifies both adjacent tiles'
// doors arrays atomically so the engine's bidirectional edgeAllowed()
// stays consistent.
//
// If either side is "default-open" (no doors array) we materialise its
// doors by listing every adjacent neighbour the engine currently
// permits — that way "close this one edge" doesn't accidentally close
// every other adjacent edge by setting doors:[] on a wide-open tile.
function materialiseDoors(tiles, x, y) {
  const t = tiles[`${x},${y}`];
  if (!t || Array.isArray(t.doors)) return t;
  const next = { ...t, doors: [] };
  for (const d of HEX_DIRS) {
    const nx = x + d.x, ny = y + d.y;
    const nt = tiles[`${nx},${ny}`];
    if (!nt) continue;
    // Default-open A is open to B iff B permits A.
    if (tilePermitsEdge(nt, x, y)) next.doors.push({ x: nx, y: ny });
  }
  return next;
}

function toggleEdge(tiles, ax, ay, bx, by) {
  const state = getEdgeState(tiles, ax, ay, bx, by);
  if (state === "missing") return tiles;
  const aKey = `${ax},${ay}`, bKey = `${bx},${by}`;
  const next = { ...tiles };
  next[aKey] = materialiseDoors(tiles, ax, ay);
  next[bKey] = materialiseDoors(tiles, bx, by);
  if (state === "closed") {
    // → open: ensure both sides include the other
    if (!next[aKey].doors.some((d) => d.x === bx && d.y === by)) {
      next[aKey] = { ...next[aKey], doors: [...next[aKey].doors, { x: bx, y: by }] };
    }
    if (!next[bKey].doors.some((d) => d.x === ax && d.y === ay)) {
      next[bKey] = { ...next[bKey], doors: [...next[bKey].doors, { x: ax, y: ay }] };
    }
  } else {
    // → closed: remove from both sides
    next[aKey] = { ...next[aKey], doors: next[aKey].doors.filter((d) => !(d.x === bx && d.y === by)) };
    next[bKey] = { ...next[bKey], doors: next[bKey].doors.filter((d) => !(d.x === ax && d.y === ay)) };
  }
  return next;
}

// Pretty-print a tile object as a single line. Order keys deterministically.
function tileToJs(tile) {
  const out = {};
  if (tile.terrain !== undefined) out.terrain = tile.terrain;
  if (Array.isArray(tile.doors)) out.doors = tile.doors;
  if (tile.intramural) out.intramural = true;
  if (tile.perimeter) out.perimeter = true;
  if (tile.wallside) out.wallside = true;
  if (tile.poi !== undefined) out.poi = tile.poi;
  return JSON.stringify(out);
}

function exportTilesText(tiles) {
  // Sort keys by (x then y) so the diff stays stable across edits.
  const keys = Object.keys(tiles).sort((a, b) => {
    const [ax, ay] = a.split(",").map(Number);
    const [bx, by] = b.split(",").map(Number);
    return ax - bx || ay - by;
  });
  const lines = ["export const HANDCRAFTED = {"];
  for (const k of keys) {
    lines.push(`  "${k}": ${tileToJs(tiles[k])},`);
  }
  lines.push("};");
  return lines.join("\n");
}

function exportStructuresText({ streets, buildings, gates }) {
  const streetText = streets
    .slice()
    .sort((a, b) => a.x - b.x || a.y - b.y)
    .map((c) => `  { x: ${c.x}, y: ${c.y} },`)
    .join("\n");
  const buildingText = buildings
    .slice()
    .sort((a, b) => a.x - b.x || a.y - b.y)
    .map((b) => {
      const parts = [`x: ${b.x}`, `y: ${b.y}`];
      if (b.door) parts.push(`door: { x: ${b.door.x}, y: ${b.door.y} }`);
      if (Array.isArray(b.doors)) {
        const ds = b.doors.map((d) => `{ x: ${d.x}, y: ${d.y} }`).join(", ");
        parts.push(`doors: [${ds}]`);
      }
      return `  { ${parts.join(", ")} },`;
    })
    .join("\n");
  const gateText = gates
    .map((pair) => `  [{ x: ${pair[0].x}, y: ${pair[0].y} }, { x: ${pair[1].x}, y: ${pair[1].y} }],`)
    .join("\n");
  return [
    `const WHITEMARCH_STREETS = [\n${streetText}\n];`,
    "",
    `const WHITEMARCH_BUILDINGS = [\n${buildingText}\n];`,
    "",
    `// gates field on The Great Wall sealed structure:`,
    `gates: [\n${gateText}\n],`,
  ].join("\n");
}

const PALETTE = {
  bg: "#0c1111",
  panel: "rgba(20, 26, 24, 0.95)",
  border: "rgba(215, 167, 111, 0.18)",
  text: "#f5dcb8",
  textDim: "rgba(245, 220, 184, 0.65)",
  accent: "#d7a76f",
  accentDim: "rgba(215, 167, 111, 0.45)",
  danger: "#e58a7a",
  ok: "#7fe3b0",
};

export function MapEditor({ onExit }) {
  const initial = useMemo(() => loadDraft() || cloneInitial(), []);
  const [tiles, setTiles] = useState(initial.tiles);
  const [streets, setStreets] = useState(initial.streets);
  const [buildings, setBuildings] = useState(initial.buildings);
  const [gates, setGates] = useState(initial.gates);

  const [selected, setSelected] = useState(null); // {x,y}
  const [tool, setTool] = useState("select"); // select | move | paint | delete | edges
  const [paintTerrain, setPaintTerrain] = useState("settlement");
  const [moveSource, setMoveSource] = useState(null); // {x,y} during move op
  const [showExport, setShowExport] = useState(false);

  // Persist on every change.
  useEffect(() => {
    saveDraft({ tiles, streets, buildings, gates });
  }, [tiles, streets, buildings, gates]);

  const containerRef = useRef(null);
  const { transformRef, lastWasDragRef, mouseHandlers, reset } = useZoomPan(containerRef);

  // Compute the bbox of all known content so we render a comfortable
  // window around the city. The editor shows ALL handcrafted hexes
  // (no fog of war), plus an empty margin so you can add new hexes
  // beyond the existing footprint.
  const renderCoords = useMemo(() => {
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const key of Object.keys(tiles)) {
      const [x, y] = key.split(",").map(Number);
      if (x < xmin) xmin = x;
      if (x > xmax) xmax = x;
      if (y < ymin) ymin = y;
      if (y > ymax) ymax = y;
    }
    if (xmin === Infinity) { xmin = -6; xmax = 6; ymin = -6; ymax = 8; }
    xmin -= 4; xmax += 4; ymin -= 4; ymax += 4;
    const out = [];
    for (let y = ymin; y <= ymax; y++) {
      for (let x = xmin; x <= xmax; x++) {
        out.push({ x, y });
      }
    }
    return out;
  }, [tiles]);

  const selectedKey = selected ? `${selected.x},${selected.y}` : null;
  const selectedTile = selectedKey ? tiles[selectedKey] : null;
  const selectedStreetIdx = selected ? streets.findIndex((c) => c.x === selected.x && c.y === selected.y) : -1;
  const selectedBuildingIdx = selected ? buildings.findIndex((b) => b.x === selected.x && b.y === selected.y) : -1;

  function onHexClick(x, y) {
    if (lastWasDragRef.current) { lastWasDragRef.current = false; return; }
    const key = `${x},${y}`;
    if (tool === "move") {
      if (!moveSource) {
        if (!tiles[key]) return; // can only move existing tiles
        setMoveSource({ x, y });
        setSelected({ x, y });
      } else {
        if (key === `${moveSource.x},${moveSource.y}`) {
          setMoveSource(null);
          return;
        }
        if (tiles[key]) {
          if (!confirm(`(${x},${y}) already has a tile. Overwrite?`)) return;
        }
        // Move the tile data
        const sourceKey = `${moveSource.x},${moveSource.y}`;
        const moving = tiles[sourceKey];
        const newTiles = { ...tiles };
        delete newTiles[sourceKey];
        newTiles[key] = moving;
        setTiles(newTiles);
        // Update streets/buildings membership coords
        setStreets((s) => s.map((c) => (c.x === moveSource.x && c.y === moveSource.y) ? { x, y } : c));
        setBuildings((b) => b.map((bd) => {
          if (bd.x === moveSource.x && bd.y === moveSource.y) return { ...bd, x, y };
          return bd;
        }));
        setMoveSource(null);
        setSelected({ x, y });
      }
      return;
    }
    if (tool === "paint") {
      const next = { ...tiles, [key]: { ...(tiles[key] || {}), terrain: paintTerrain, poi: tiles[key]?.poi ?? null } };
      setTiles(next);
      setSelected({ x, y });
      return;
    }
    if (tool === "delete") {
      if (!tiles[key]) return;
      if (!confirm(`Delete tile at (${x},${y})? Returns the hex to procedural generation.`)) return;
      const next = { ...tiles }; delete next[key]; setTiles(next);
      setStreets((s) => s.filter((c) => !(c.x === x && c.y === y)));
      setBuildings((b) => b.filter((bd) => !(bd.x === x && bd.y === y)));
      if (selected && selected.x === x && selected.y === y) setSelected(null);
      return;
    }
    // select
    setSelected({ x, y });
  }

  function patchSelectedTile(patch) {
    if (!selectedKey) return;
    const cur = tiles[selectedKey] || {};
    const next = { ...tiles, [selectedKey]: { ...cur, ...patch } };
    setTiles(next);
  }

  function patchSelectedPoi(patch) {
    if (!selectedKey) return;
    const cur = tiles[selectedKey] || {};
    const poi = cur.poi ? { ...cur.poi, ...patch } : { ...patch };
    // Clean empty strings on type/name/access/description so the export
    // doesn't carry blank fields.
    for (const k of ["type", "name", "access", "description", "partName", "part", "parent", "parentName", "area", "areaName"]) {
      if (poi[k] === "" || poi[k] == null) delete poi[k];
    }
    const hasAny = Object.keys(poi).length > 0;
    const next = { ...tiles, [selectedKey]: { ...cur, poi: hasAny ? poi : null } };
    setTiles(next);
  }

  function toggleDoor(nx, ny) {
    if (!selected) return;
    // Edge-level toggle: flips the shared boundary between the selected
    // hex and ({nx, ny}) and writes both sides' doors arrays atomically
    // so the engine's bidirectional edgeAllowed() stays consistent.
    setTiles((t) => toggleEdge(t, selected.x, selected.y, nx, ny));
  }

  function clearDoorsOverride() {
    if (!selectedKey || !selectedTile) return;
    const next = { ...tiles[selectedKey] };
    delete next.doors;
    setTiles({ ...tiles, [selectedKey]: next });
  }

  function toggleStreetMembership() {
    if (!selected) return;
    if (selectedStreetIdx >= 0) {
      setStreets((s) => s.filter((_, i) => i !== selectedStreetIdx));
    } else {
      setStreets((s) => [...s, { x: selected.x, y: selected.y }]);
      // Remove from buildings if also there (can't be both)
      if (selectedBuildingIdx >= 0) setBuildings((b) => b.filter((_, i) => i !== selectedBuildingIdx));
    }
  }

  function toggleBuildingMembership() {
    if (!selected) return;
    if (selectedBuildingIdx >= 0) {
      setBuildings((b) => b.filter((_, i) => i !== selectedBuildingIdx));
    } else {
      setBuildings((b) => [...b, { x: selected.x, y: selected.y }]);
      if (selectedStreetIdx >= 0) setStreets((s) => s.filter((_, i) => i !== selectedStreetIdx));
    }
  }

  function setBuildingDoor(door) {
    if (selectedBuildingIdx < 0) return;
    const next = [...buildings];
    if (!door) {
      const { door: _, ...rest } = next[selectedBuildingIdx];
      next[selectedBuildingIdx] = rest;
    } else {
      next[selectedBuildingIdx] = { ...next[selectedBuildingIdx], door };
    }
    setBuildings(next);
  }

  function resetToSource() {
    if (!confirm("Discard all edits and reload from source files?")) return;
    clearDraft();
    const fresh = cloneInitial();
    setTiles(fresh.tiles);
    setStreets(fresh.streets);
    setBuildings(fresh.buildings);
    setGates(fresh.gates);
    setSelected(null);
    setMoveSource(null);
    reset();
  }

  const streetSet = useMemo(() => new Set(streets.map((c) => `${c.x},${c.y}`)), [streets]);
  const buildingSet = useMemo(() => new Set(buildings.map((b) => `${b.x},${b.y}`)), [buildings]);

  return (
    <div style={{
      position: "fixed", inset: 0, backgroundColor: PALETTE.bg, color: PALETTE.text,
      fontFamily: "'Inter', sans-serif", fontSize: "13px",
      display: "grid", gridTemplateColumns: "1fr 340px", gridTemplateRows: "44px 1fr",
    }}>
      {/* Top toolbar */}
      <div style={{
        gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "8px", padding: "0 12px",
        borderBottom: `1px solid ${PALETTE.border}`, backgroundColor: "#161d1c",
      }}>
        <button onClick={onExit} style={btn()}>← Back</button>
        <strong style={{ marginRight: "12px", color: PALETTE.accent, letterSpacing: "0.06em" }}>MAP EDITOR</strong>
        <ToolBtn label="Select" active={tool === "select"} onClick={() => { setTool("select"); setMoveSource(null); }} />
        <ToolBtn label={moveSource ? "Move → click dest" : "Move"} active={tool === "move"} onClick={() => { setTool("move"); }} />
        <ToolBtn label="Paint" active={tool === "paint"} onClick={() => { setTool("paint"); setMoveSource(null); }} />
        <ToolBtn label="Delete" active={tool === "delete"} onClick={() => { setTool("delete"); setMoveSource(null); }} />
        <ToolBtn label="Edges" active={tool === "edges"} onClick={() => { setTool("edges"); setMoveSource(null); }} />
        {tool === "paint" && (
          <select value={paintTerrain} onChange={(e) => setPaintTerrain(e.target.value)} style={input()}>
            {TERRAIN_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ color: PALETTE.textDim, fontSize: "11px" }}>
          {Object.keys(tiles).length} tiles · {streets.length} streets · {buildings.length} buildings
        </span>
        <button onClick={resetToSource} style={btn({ color: PALETTE.danger })}>Reset to source</button>
        <button onClick={() => setShowExport(true)} style={btn({ color: PALETTE.ok })}>Export</button>
      </div>

      {/* Map area */}
      <div
        ref={containerRef}
        {...mouseHandlers}
        style={{
          overflow: "hidden", backgroundColor: PALETTE.bg, touchAction: "none",
          position: "relative", cursor: tool === "select" ? "grab" : "crosshair",
          userSelect: "none", perspective: "2400px", perspectiveOrigin: "center center",
        }}
      >
        <div ref={transformRef} style={{
          position: "absolute", top: "50%", left: "50%",
          transformOrigin: "center center", willChange: "transform",
          transformStyle: "preserve-3d",
        }}>
          <div style={{
            transform: "rotateX(52deg)", transformOrigin: "center center",
            transformStyle: "preserve-3d",
            filter: "drop-shadow(0 28px 36px rgba(0,0,0,0.55))",
          }}>
            <svg width={SVG_SIZE} height={SVG_SIZE} style={{ display: "block" }}>
              {/* Render north-first so south-facing hex side faces paint
                  over anything behind them — matches the in-game MapView. */}
              {renderCoords
                .slice()
                .sort((a, b) => a.y - b.y)
                .map(({ x, y }) => {
                const key = `${x},${y}`;
                const tile = tiles[key];
                const px = SVG_CENTER + HSPACING * (x + y / 2);
                const py = SVG_CENTER + VSPACING * y;
                const isSel = selected && selected.x === x && selected.y === y;
                const isMoveSrc = moveSource && moveSource.x === x && moveSource.y === y;
                const isStreet = streetSet.has(key);
                const isBuilding = buildingSet.has(key);
                let fill, stroke = "rgba(215,167,111,0.10)", strokeWidth = 1;
                let lift = 0;
                if (!tile) {
                  fill = "rgba(60, 56, 48, 0.18)"; // empty / procedural
                } else {
                  const T = TERRAINS[tile.terrain];
                  fill = T?.color || "#555";
                  if (tile.terrain === "wall_top") lift = 22;
                  else if (tile.terrain === "indoor") lift = 10;
                  else if (tile.poi?.parent) lift = 8;
                }
                // Elevated hex top loses its default border so adjacent
                // prisms read as one continuous structure (the wall ring,
                // a building block). Selection/move/membership markers
                // still set their bright override below.
                if (lift > 0) stroke = "transparent";
                if (isBuilding) stroke = "rgba(231, 161, 110, 0.5)";
                if (isStreet)   stroke = "rgba(255, 240, 195, 0.5)";
                if (isMoveSrc) { stroke = "#7fe3b0"; strokeWidth = 3; }
                if (isSel)     { stroke = "#f5dcb8"; strokeWidth = 3; }
                const prism = lift > 0 ? hexPrismParts(px, py, lift) : null;
                return (
                  <g key={key} onClick={() => onHexClick(x, y)} style={{ cursor: "pointer" }}>
                    {prism && (
                      <polygon
                        points={prism.sidePoints}
                        fill={SIDE_SHADE}
                        stroke="none"
                        pointerEvents="none"
                      />
                    )}
                    <polygon
                      points={prism ? prism.topPoints : hexCornerPoints(px, py)}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      strokeLinejoin="round"
                    />
                    {tile?.poi?.name && (
                      <text
                        x={px} y={py + 3 - lift}
                        textAnchor="middle"
                        fontSize="6"
                        fontFamily="'Inter', sans-serif"
                        fontWeight="700"
                        fill="#0c1111"
                        stroke="#f5dcb8"
                        strokeWidth="0.4"
                        paintOrder="stroke"
                        pointerEvents="none"
                      >
                        {tile.poi.name}
                      </text>
                    )}
                  </g>
                );
              })}
              {/* Edge widgets — small clickable bars at the midpoint of each
                  shared hex boundary, colour-coded by state. Rendered when
                  the Edges tool is active (always), or when any hex is
                  selected (only the edges around the selected hex). Click
                  toggles the shared edge state, writing both adjacent
                  tiles' doors atomically. */}
              {(tool === "edges" || selected) && (() => {
                const seen = new Set();
                const widgets = [];
                const coords = tool === "edges" ? renderCoords : (selected ? [selected] : []);
                for (const c of coords) {
                  for (let d = 0; d < HEX_DIRS.length; d++) {
                    const dir = HEX_DIRS[d];
                    const nx = c.x + dir.x, ny = c.y + dir.y;
                    const key = canonicalEdgeKey(c.x, c.y, nx, ny);
                    if (seen.has(key)) continue;
                    seen.add(key);
                    const ta = tiles[`${c.x},${c.y}`];
                    const tb = tiles[`${nx},${ny}`];
                    if (!ta && !tb) continue;
                    const state = getEdgeState(tiles, c.x, c.y, nx, ny);
                    if (state === "missing") continue;
                    const px = SVG_CENTER + HSPACING * (c.x + c.y / 2);
                    const py = SVG_CENTER + VSPACING * c.y;
                    const npx = SVG_CENTER + HSPACING * (nx + ny / 2);
                    const npy = SVG_CENTER + VSPACING * ny;
                    // Lift to whichever side is taller so the widget sits
                    // on top of the extruded structure, not buried in it.
                    let lift = 0;
                    if (ta) {
                      if (ta.terrain === "wall_top") lift = Math.max(lift, 22);
                      else if (ta.terrain === "indoor") lift = Math.max(lift, 10);
                      else if (ta.poi?.parent) lift = Math.max(lift, 8);
                    }
                    if (tb) {
                      if (tb.terrain === "wall_top") lift = Math.max(lift, 22);
                      else if (tb.terrain === "indoor") lift = Math.max(lift, 10);
                      else if (tb.poi?.parent) lift = Math.max(lift, 8);
                    }
                    const mx = (px + npx) / 2;
                    const my = (py + npy) / 2 - lift;
                    const color = state === "open" ? "#7fe3b0" : state === "closed" ? "#e58a7a" : "rgba(245,220,184,0.5)";
                    widgets.push(
                      <g key={key} onClick={() => setTiles((t) => toggleEdge(t, c.x, c.y, nx, ny))} style={{ cursor: "pointer" }}>
                        <circle cx={mx} cy={my} r="9" fill="rgba(12,17,17,0.65)" stroke="none" />
                        <circle cx={mx} cy={my} r="6" fill={color} stroke="#0c1111" strokeWidth="1.5" />
                      </g>
                    );
                  }
                }
                return widgets;
              })()}
            </svg>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={{
        overflowY: "auto", padding: "12px 14px", borderLeft: `1px solid ${PALETTE.border}`,
        backgroundColor: PALETTE.panel,
      }}>
        {selected ? (
          <EditPanel
            tile={selectedTile}
            x={selected.x}
            y={selected.y}
            isStreet={selectedStreetIdx >= 0}
            isBuilding={selectedBuildingIdx >= 0}
            buildingEntry={selectedBuildingIdx >= 0 ? buildings[selectedBuildingIdx] : null}
            onTilePatch={patchSelectedTile}
            onPoiPatch={patchSelectedPoi}
            onToggleDoor={toggleDoor}
            onEdgeState={(nx, ny) => getEdgeState(tiles, selected.x, selected.y, nx, ny)}
            onClearDoorsOverride={clearDoorsOverride}
            onToggleStreet={toggleStreetMembership}
            onToggleBuilding={toggleBuildingMembership}
            onSetBuildingDoor={setBuildingDoor}
            tilesAt={(nx, ny) => tiles[`${nx},${ny}`]}
            isStreetAt={(nx, ny) => streetSet.has(`${nx},${ny}`)}
          />
        ) : (
          <div style={{ color: PALETTE.textDim, lineHeight: 1.5 }}>
            <p><strong style={{ color: PALETTE.accent }}>Click a hex</strong> to inspect or edit it.</p>
            <p>Tools (top bar):</p>
            <ul style={{ paddingLeft: "18px", margin: "6px 0" }}>
              <li><strong>Select</strong> — open the edit panel for any tile.</li>
              <li><strong>Move</strong> — click source then click destination to relocate a tile (and its streets/buildings entry).</li>
              <li><strong>Paint</strong> — stamp a terrain onto empty hexes (or repaint).</li>
              <li><strong>Delete</strong> — clear a tile (back to procedural).</li>
            </ul>
            <p>Edits auto-save to localStorage. <strong>Reset to source</strong> reverts. <strong>Export</strong> emits paste-back JS for the source files.</p>
          </div>
        )}
      </div>

      {showExport && (
        <ExportDialog
          tiles={tiles}
          streets={streets}
          buildings={buildings}
          gates={gates}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}

function EditPanel({
  tile, x, y, isStreet, isBuilding, buildingEntry,
  onTilePatch, onPoiPatch, onToggleDoor, onEdgeState, onClearDoorsOverride,
  onToggleStreet, onToggleBuilding, onSetBuildingDoor,
  tilesAt, isStreetAt,
}) {
  const poi = tile?.poi || {};
  const adjacents = HEX_DIRS.map((d) => ({ x: x + d.x, y: y + d.y }));
  return (
    <div>
      <div style={{ marginBottom: "10px" }}>
        <strong style={{ color: PALETTE.accent, fontSize: "14px" }}>
          ({x}, {y})
        </strong>
        <div style={{ color: PALETTE.textDim, fontSize: "11px" }}>
          {tile ? "Authored tile" : "Empty (procedural)"}
        </div>
      </div>

      {/* Terrain */}
      <Section label="Terrain">
        <select
          value={tile?.terrain || ""}
          onChange={(e) => onTilePatch({ terrain: e.target.value || undefined })}
          style={input()}
        >
          <option value="">(none — empty)</option>
          {TERRAIN_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Section>

      {/* Flags */}
      {tile && (
        <Section label="Flags">
          <Checkbox
            label="intramural (legacy)"
            checked={!!tile.intramural}
            onChange={(v) => onTilePatch({ intramural: v || undefined })}
          />
          <Checkbox
            label="perimeter (auto-gen perimeter street)"
            checked={!!tile.perimeter}
            onChange={(v) => onTilePatch({ perimeter: v || undefined })}
          />
          <Checkbox
            label="wallside (excluded from wall-distance interior)"
            checked={!!tile.wallside}
            onChange={(v) => onTilePatch({ wallside: v || undefined })}
          />
        </Section>
      )}

      {/* POI */}
      {tile && (
        <Section label="POI">
          <Field label="Type">
            <select value={poi.type || ""} onChange={(e) => onPoiPatch({ type: e.target.value })} style={input()}>
              {POI_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t || "(none)"}</option>)}
            </select>
          </Field>
          <Field label="Name">
            <input
              type="text" value={poi.name || ""}
              onChange={(e) => onPoiPatch({ name: e.target.value })}
              style={input()}
            />
          </Field>
          <Field label="Access">
            <select value={poi.access || ""} onChange={(e) => onPoiPatch({ access: e.target.value })} style={input()}>
              {POI_ACCESS_OPTIONS.map((a) => <option key={a} value={a}>{a || "(none)"}</option>)}
            </select>
          </Field>
          <Field label="Description">
            <textarea
              value={poi.description || ""}
              onChange={(e) => onPoiPatch({ description: e.target.value })}
              rows={6}
              style={{ ...input(), resize: "vertical", fontFamily: "'Instrument Serif', serif", lineHeight: 1.4 }}
            />
          </Field>
          <div style={{ fontSize: "11px", color: PALETTE.textDim, marginTop: "4px" }}>
            Footprint parent: <code>{poi.parent || "(none)"}</code>
            {poi.parent && (
              <button
                onClick={() => onPoiPatch({ parent: "", parentName: "", part: "", partName: "" })}
                style={{ ...btn({ color: PALETTE.danger }), marginLeft: "6px", padding: "2px 6px" }}
              >Clear</button>
            )}
          </div>
        </Section>
      )}

      {/* Membership in The Great Wall sealed structure */}
      {tile && (
        <Section label="Sealed-structure membership">
          <Checkbox label="Listed as a street" checked={isStreet} onChange={onToggleStreet} />
          <Checkbox label="Listed as a building" checked={isBuilding} onChange={onToggleBuilding} />
          {isBuilding && buildingEntry && (
            <div style={{ marginTop: "6px", padding: "8px", border: `1px solid ${PALETTE.border}`, borderRadius: "4px" }}>
              <div style={{ fontSize: "11px", color: PALETTE.textDim, marginBottom: "4px" }}>
                Building door (single street the building opens onto)
              </div>
              <select
                value={buildingEntry.door ? `${buildingEntry.door.x},${buildingEntry.door.y}` : ""}
                onChange={(e) => {
                  if (!e.target.value) { onSetBuildingDoor(null); return; }
                  const [dx, dy] = e.target.value.split(",").map(Number);
                  onSetBuildingDoor({ x: dx, y: dy });
                }}
                style={input()}
              >
                <option value="">(multi-door — opens to all adjacent streets)</option>
                {adjacents.filter((a) => isStreetAt(a.x, a.y)).map((a) => (
                  <option key={`${a.x},${a.y}`} value={`${a.x},${a.y}`}>({a.x}, {a.y})</option>
                ))}
              </select>
            </div>
          )}
        </Section>
      )}

      {/* Edges (shared boundaries) */}
      {tile && (
        <Section label="Edges to neighbours (shared)">
          <div style={{ fontSize: "10px", color: PALETTE.textDim, marginBottom: "5px", lineHeight: 1.4 }}>
            Toggling an edge writes BOTH sides' doors lists at once — it's the
            shared boundary between this hex and its neighbour, not a per-hex
            flag.
          </div>
          {adjacents.map((a) => {
            const nk = `${a.x},${a.y}`;
            const nt = tilesAt(a.x, a.y);
            const state = onEdgeState(a.x, a.y);
            const stateBadge = state === "open" ? "● open" : state === "closed" ? "✕ closed" : state === "missing" ? "—" : "○ default";
            const stateColor = state === "open" ? PALETTE.ok : state === "closed" ? PALETTE.danger : PALETTE.textDim;
            const label = nt ? `${stateBadge}  (${a.x}, ${a.y}) ${nt.poi?.name || nt.terrain}` : `${stateBadge}  (${a.x}, ${a.y}) [empty]`;
            return (
              <label
                key={nk}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "2px 0", cursor: nt ? "pointer" : "default", fontSize: "12px", color: nt ? PALETTE.text : PALETTE.textDim }}
                onClick={() => nt && onToggleDoor(a.x, a.y)}
              >
                <span style={{ color: stateColor, width: "60px", flexShrink: 0, fontSize: "11px" }}>{stateBadge}</span>
                <span style={{ flex: 1 }}>{nt ? `(${a.x}, ${a.y}) ${nt.poi?.name || nt.terrain}` : `(${a.x}, ${a.y}) [empty]`}</span>
              </label>
            );
          })}
          {Array.isArray(tile.doors) && (
            <button onClick={onClearDoorsOverride} style={{ ...btn({ color: PALETTE.danger }), marginTop: "6px" }}>
              Clear this hex's doors override (revert to default-open)
            </button>
          )}
        </Section>
      )}
    </div>
  );
}

function ExportDialog({ tiles, streets, buildings, gates, onClose }) {
  const tilesText = useMemo(() => exportTilesText(tiles), [tiles]);
  const structText = useMemo(() => exportStructuresText({ streets, buildings, gates }), [streets, buildings, gates]);
  const [view, setView] = useState("tiles");

  function copyToClipboard(text) {
    navigator.clipboard?.writeText(text);
  }
  function downloadAs(filename, text) {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  const text = view === "tiles" ? tilesText : structText;
  const filename = view === "tiles" ? "handcrafted-tiles.export.js" : "sealed-structures.export.js";

  return (
    <div style={{
      position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }}>
      <div style={{
        width: "min(900px, 92vw)", height: "min(700px, 88vh)", backgroundColor: "#181f1e",
        border: `1px solid ${PALETTE.border}`, borderRadius: "6px",
        display: "flex", flexDirection: "column", padding: "14px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
          <strong style={{ color: PALETTE.accent, letterSpacing: "0.06em" }}>EXPORT</strong>
          <ToolBtn label="Tiles (handcrafted-tiles.js)" active={view === "tiles"} onClick={() => setView("tiles")} />
          <ToolBtn label="Structures (sealed-structures.js)" active={view === "structures"} onClick={() => setView("structures")} />
          <div style={{ flex: 1 }} />
          <button onClick={() => copyToClipboard(text)} style={btn()}>Copy to clipboard</button>
          <button onClick={() => downloadAs(filename, text)} style={btn()}>Download .js</button>
          <button onClick={onClose} style={btn({ color: PALETTE.danger })}>Close</button>
        </div>
        <textarea
          value={text}
          readOnly
          style={{
            flex: 1, width: "100%", boxSizing: "border-box", padding: "10px",
            fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", lineHeight: 1.4,
            backgroundColor: "#0d1413", color: PALETTE.text,
            border: `1px solid ${PALETTE.border}`, borderRadius: "4px",
            whiteSpace: "pre", overflow: "auto", resize: "none",
          }}
        />
        <p style={{ color: PALETTE.textDim, fontSize: "11px", marginTop: "8px" }}>
          {view === "tiles"
            ? "Replace the HANDCRAFTED object literal in src/data/handcrafted-tiles.js with this text. The wall generator, sealed-structures wiring, and the file's comments stay as-is."
            : "Replace the WHITEMARCH_STREETS and WHITEMARCH_BUILDINGS arrays in src/data/sealed-structures.js with these, and the `gates:` line on \"The Great Wall of Whitemarch\" with the gates snippet."}
        </p>
      </div>
    </div>
  );
}

// ---- Tiny style helpers ----
function btn(extra = {}) {
  return {
    padding: "4px 10px",
    backgroundColor: "rgba(215, 167, 111, 0.08)",
    color: PALETTE.text,
    border: `1px solid ${PALETTE.border}`,
    borderRadius: "3px",
    cursor: "pointer",
    fontSize: "12px",
    ...extra,
  };
}
function input() {
  return {
    width: "100%", boxSizing: "border-box", padding: "5px 7px",
    backgroundColor: "#0d1413", color: PALETTE.text,
    border: `1px solid ${PALETTE.border}`, borderRadius: "3px",
    fontFamily: "'Inter', sans-serif", fontSize: "12px",
  };
}
function ToolBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...btn(),
        backgroundColor: active ? PALETTE.accent : "rgba(215, 167, 111, 0.08)",
        color: active ? "#0c1111" : PALETTE.text,
        fontWeight: active ? 700 : 500,
      }}
    >{label}</button>
  );
}
function Section({ label, children }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{
        fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase",
        color: PALETTE.accentDim, marginBottom: "5px",
      }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: "6px" }}>
      <div style={{ fontSize: "10px", color: PALETTE.textDim, marginBottom: "2px" }}>{label}</div>
      {children}
    </div>
  );
}
function Checkbox({ label, checked, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "6px", padding: "2px 0", cursor: "pointer", fontSize: "12px" }}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
