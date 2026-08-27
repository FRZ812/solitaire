import React, { useState, useRef, useMemo, useEffect } from "react";
import { HANDCRAFTED, SEALED_STRUCTURES, saveMap, hydrateMap, applyMapData, onMapUpdate } from "../data/handcrafted-map.js";
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

// Pull the rendering primitives in from MapView so the editor's hexes are
// pixel-identical to the in-game map. Anything that draws a tile (shape,
// color, lift, icon) goes through these — no parallel implementation.
import { hexLine, hexAStar } from "../data/hex-math.js";
import {
  HEX_SIZE,
  HSPACING,
  VSPACING,
  SVG_SIZE,
  SVG_CENTER,
  WALL_MATERIALS,
  hexCornerPoints,
  hexPrismParts,
  liftForTile,
  tileFill,
  dropStrokeForTile,
  assetKeyForTile,
  MAP_ASSETS,
  SIDE_SHADE,
} from "./MapView.jsx";

const HEX_DIRS = [
  { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: -1 },
  { x: -1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: 1 },
];

const LS_KEY = "solitaire-mapeditor-draft-v1";

const TERRAIN_OPTIONS = Object.keys(TERRAINS);
const POI_TYPE_OPTIONS = [
  "", "plaza", "hall", "market", "stair", "gate", "combat", "barracks",
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
//
// Procedural-neighbour handling depends on the tile's terrain:
//   - Walls SEAL against procedural. The authored rule is "a generated
//     hex never opens a path; handcrafted rulings win." Without this,
//     toggling one wall edge would materialise the other procedural-
//     facing edges as open, since the engine treats both default-open
//     sides as traversable.
//   - Everything else (roads, streets, wilderness) keeps procedural
//     neighbours in the doors list so default-open's permissive
//     semantics survive the materialisation — otherwise toggling one
//     edge of a road would silently seal it against the procedural
//     exterior on every other side.
function materialiseDoors(tiles, x, y) {
  const t = tiles[`${x},${y}`];
  if (!t || Array.isArray(t.doors)) return t;
  const next = { ...t, doors: [] };
  const sealsProcedural = t.terrain === "wall";
  for (const d of HEX_DIRS) {
    const nx = x + d.x, ny = y + d.y;
    const nt = tiles[`${nx},${ny}`];
    if (!nt) {
      if (sealsProcedural) continue;
      next.doors.push({ x: nx, y: ny });
      continue;
    }
    if (tilePermitsEdge(nt, x, y)) next.doors.push({ x: nx, y: ny });
  }
  return next;
}

// A tile authored with `doors: []` is intentionally sealed (Sewer Mouth,
// Iron Palace, etc.) — narrator-only entry. Toggling an edge against
// such a tile would silently unseal it; refuse and surface a hint.
function isAuthoredSeal(tile) {
  return tile && Array.isArray(tile.doors) && tile.doors.length === 0;
}

function toggleEdge(tiles, ax, ay, bx, by) {
  const state = getEdgeState(tiles, ax, ay, bx, by);
  if (state === "missing") return tiles;
  const aKey = `${ax},${ay}`, bKey = `${bx},${by}`;
  // Protect authored seals — `doors: []` is the narrator-only entry
  // invariant for Sewer Mouth + the linked Iron Palace.
  if (isAuthoredSeal(tiles[aKey]) || isAuthoredSeal(tiles[bKey])) {
    if (typeof window !== "undefined" && window.confirm) {
      const ok = window.confirm(
        "One side of this edge is intentionally sealed (doors:[] — narrator-only entry). Unsealing will break the game's gating; continue?"
      );
      if (!ok) return tiles;
    } else {
      return tiles;
    }
  }
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
  if (tile.perimeter) out.perimeter = true;
  if (tile.wallside) out.wallside = true;
  if (tile.poi !== undefined) out.poi = tile.poi;
  return JSON.stringify(out);
}

// Generator-owned tiles (perimeter streets + plain wall_top hexes
// without a stair POI) are produced by the wall generator at module
// load — if we serialise them into the exported source, pasting back
// will pre-populate HANDCRAFTED with the generator's previous output
// and the generator's `if (HANDCRAFTED[key]) continue` will skip
// regeneration. Subsequent layout changes silently won't take effect.
// Skip them in the export; the generator regenerates them on reload.
function isGeneratorOwned(tile) {
  if (!tile) return false;
  if (tile.perimeter) return true;
  if (tile.terrain === "wall" && !(tile.poi && tile.poi.type === "stair")) return true;
  return false;
}

// Save EVERYTHING in the editor's tile state — including tiles the wall
// generator originally placed. Stripping them caused edits on wall_top
// or perimeter hexes (changing their POI, toggling their edges via the
// Edges tool, painting over them) to silently get dropped at save time,
// which the user experienced as "edits don't persist on reload".
//
// The wall generator's `if (tiles[key]) continue` makes it idempotent:
// any tile that already exists in the row gets skipped, so saving the
// generator's output back is harmless — on reload those tiles stay
// exactly as they were saved. The trade-off is that if you later move a
// building, the OLD wall ring is preserved (because Supabase has it) and
// you'd need to manually clear those stale tiles before the generator
// would re-fill the new ring. That's a much rarer problem than "my
// edits vanished".
export function stripGeneratedTiles(tiles) {
  // Identity copy — kept as a function so callers stay future-proof if
  // we add per-tile filtering later (e.g. "only save tiles you've
  // touched since loading").
  return { ...tiles };
}

// The editor used to author a "Great Wall of Whitemarch" streets+buildings
// structure; that's gone now (the per-tile doors graph is the source of
// truth, and streets/buildings membership was just a derived projection).
// We still hand the Citadel + Underworks structures through unchanged —
// those are link/mesh structures whose semantics don't fit per-tile-doors.
export function mergeSealedStructures(_streets, _buildings, _gates) {
  return SEALED_STRUCTURES.filter((s) => !(s.streets || s.buildings));
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
    const tile = tiles[k];
    if (isGeneratorOwned(tile)) continue;
    // Stair-wall_tops are authored, but their `doors` are recomputed
    // every module load by the wall generator. Strip them so the
    // export round-trips cleanly back to the authored source shape.
    const tileForExport = tile.terrain === "wall" && Array.isArray(tile.doors)
      ? { ...tile, doors: undefined }
      : tile;
    lines.push(`  "${k}": ${tileToJs(tileForExport)},`);
  }
  lines.push("};");
  return lines.join("\n");
}

// Mirrors the load-time THROWS in handcrafted-tiles.js' applyStreetBuildingDoors
// so the editor can warn the user BEFORE they paste a fatal export back.
// Returns an array of human-readable strings; empty array means clean.
//
// Only reports issues that WILL actually throw at load. Specifically does
// NOT report:
//   - "orphan" street tiles (terrain:"street" not in WHITEMARCH_STREETS) —
//     those are the wall generator's perimeter ring + any street the
//     author deliberately kept out of the sealed structure. The engine
//     uses per-tile doors directly; the sealed structure is just one
//     authoring shape on top of that.
//   - multi-door buildings with no adjacent listed street — the engine
//     now respects authored tile.doors for multi-door buildings (see
//     applyStreetBuildingDoors), so "the author decides the exit" rather
//     than the structure deriving it.
function validateExport({ tiles, streets, buildings }) {
  const errors = [];
  const streetSet = new Set(streets.map((c) => `${c.x},${c.y}`));
  const buildingSet = new Set(buildings.map((b) => `${b.x},${b.y}`));
  const hexDist = (ax, ay, bx, by) => {
    const dq = ax - bx, dr = ay - by;
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
  };
  // Streets/buildings double-listing — applyStreetBuildingDoors throws on this.
  for (const k of streetSet) {
    if (buildingSet.has(k)) errors.push(`(${k}) is listed as both a street and a building`);
  }
  // Streets/buildings referencing missing tiles — silent soft-fail at load,
  // but always an authoring mistake.
  for (const c of streets) {
    if (!tiles[`${c.x},${c.y}`]) errors.push(`street (${c.x},${c.y}) — no tile at this coord`);
  }
  for (const b of buildings) {
    if (!tiles[`${b.x},${b.y}`]) errors.push(`building (${b.x},${b.y}) — no tile at this coord`);
  }
  // Per-building EXPLICIT door checks — only fires for buildings with
  // door:{} or doors:[]. Multi-door buildings inherit from tile.doors
  // (authored via Edges tool) and aren't checked here.
  for (const b of buildings) {
    const list = Array.isArray(b.doors) ? b.doors : (b.door ? [b.door] : null);
    if (!list) continue;
    for (const door of list) {
      const dk = `${door.x},${door.y}`;
      if (hexDist(door.x, door.y, b.x, b.y) !== 1) {
        errors.push(`building (${b.x},${b.y}) door (${door.x},${door.y}) — NOT ADJACENT (will throw)`);
      } else if (!streetSet.has(dk) && !buildingSet.has(dk)) {
        errors.push(`building (${b.x},${b.y}) door (${door.x},${door.y}) — adjacent but not in streets or buildings list (will throw)`);
      }
    }
  }
  return errors;
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

// Track viewport width so the side panel can collapse to a bottom-sheet
// on phones. Threshold at 720px — below that we lose ~340px to the side
// panel, leaving the map area unusable, so we stack instead.
function useIsMobile(thresholdPx = 720) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < thresholdPx : false
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setIsMobile(window.innerWidth < thresholdPx);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [thresholdPx]);
  return isMobile;
}

export function MapEditor({ onExit }) {
  // ALWAYS load from the hydrated HANDCRAFTED (which came from Supabase
  // at boot). The localStorage draft from previous sessions is
  // deliberately ignored as the load source — when saves succeed,
  // Supabase is the truth. Keeping localStorage as the load source
  // caused: open editor → old draft loads → 800ms autosave uploads
  // the old draft → Supabase overwritten with stale state → edits
  // appear to "not persist" because they were never really the
  // authoritative state to begin with.
  //
  // localStorage still gets written on every change as a crash-recovery
  // cache (see autosave effect below). If a save fails, the draft
  // survives a refresh; we just don't auto-promote it back into the
  // editor without the user asking.
  useEffect(() => { clearDraft(); }, []); // wipe stale draft from old sessions
  const initial = useMemo(() => cloneInitial(), []);
  const [tiles, setTiles] = useState(initial.tiles);
  const [streets, setStreets] = useState(initial.streets);
  const [buildings, setBuildings] = useState(initial.buildings);
  const [gates, setGates] = useState(initial.gates);

  const isMobile = useIsMobile();
  const [selected, setSelected] = useState(null); // {x,y}
  const [tool, setTool] = useState("select"); // select | move | paint | delete | edges | multi | curtain
  const [paintTerrain, setPaintTerrain] = useState("settlement");
  // Multi-select state: set of "x,y" keys currently selected. Tap a hex
  // while the Multi tool is active to add/remove it. The action bar in
  // the bottom sheet exposes bulk paint + bulk delete.
  const [multiSel, setMultiSel] = useState(new Set());
  // Curtain tool state: two-step pick (start → end). Mode toggles
  // between "direct" (straight hex line, ignores existing tiles) and
  // "avoid" (A* that routes around any existing handcrafted tile).
  // Material picks which WALL_MATERIALS color the placed wall hexes get.
  const [curtainStart, setCurtainStart] = useState(null);
  const [curtainMode, setCurtainMode] = useState("avoid");
  const [curtainTerrain, setCurtainTerrain] = useState("wall");
  const [curtainMaterial, setCurtainMaterial] = useState("stone");
  // Drag-select state for the Multi tool. A ref (not state) so the
  // pointerenter handler can read the latest value without restating
  // every hex's onPointerEnter closure on every render.
  const draggingMultiRef = useRef(false);

  // Reset per-tool state when the user switches away. Without this, a
  // multi-selection survives in the background once you leave the Multi
  // tool — confusing because the blue outlines stay on hexes you can no
  // longer act on. Same for the curtain's pending start point.
  useEffect(() => {
    if (tool !== "multi" && multiSel.size > 0) setMultiSel(new Set());
    if (tool !== "curtain" && curtainStart) setCurtainStart(null);
    // Disable map pan in Multi mode so drag-select isn't fighting it.
    panDisabledRef.current = tool === "multi";
  }, [tool]);

  // Global pointerup ends the multi-select drag, even if the pointer is
  // released over an empty area (not a hex). Without this the drag stays
  // armed forever once started.
  useEffect(() => {
    const endDrag = () => { draggingMultiRef.current = false; };
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, []);
  const [moveSource, setMoveSource] = useState(null); // {x,y} during move op
  const [showExport, setShowExport] = useState(false);

  // Save status: "idle" | "dirty" | "saving" | "saved" | { error }
  const [saveStatus, setSaveStatus] = useState("idle");
  const saveTimerRef = useRef(null);

  // Stale-map lock. Flipped to true when either (a) saveMap throws
  // STALE_MAP because someone else touched the row since our last load,
  // or (b) the realtime subscription delivers an external UPDATE while
  // this editor is open. Once true, every subsequent autosave attempt
  // is skipped and the banner prompts the user to reload. This stops
  // the "stale tab autosaves over fresh content" wipe at the source
  // (see handcrafted-map.js for the optimistic-concurrency check).
  const [staleMap, setStaleMap] = useState(null); // null | { reason, serverUpdatedAt?, loadedUpdatedAt? }

  // First-mount guard. The autosave useEffect runs once at mount with
  // the initial state (loaded from HANDCRAFTED) — without this flag
  // we'd write the just-loaded state back to Supabase immediately,
  // which (a) is a no-op write on a healthy row but (b) STOMPS a
  // fresh row whenever the editor's HANDCRAFTED came from a stale
  // cached bundle. Only schedule autosaves AFTER an actual edit lands.
  const hasUserEditedRef = useRef(false);

  // Subscribe to external map updates while this editor is open. If
  // someone else's save lands (another tab, MCP-applied SQL, a
  // colleague), flip staleMap so the next autosave bails before
  // overwriting. We register a fresh listener on mount; the singleton
  // applyMapData mutates HANDCRAFTED in place, but the editor's own
  // React state copy doesn't auto-update — so even with realtime
  // working, the editor must refuse to save its now-stale local state.
  useEffect(() => {
    const off = onMapUpdate(() => {
      // If the user has made local edits AND an external update arrived,
      // we have a real conflict. Lock saves and surface the banner.
      // (If they haven't edited yet, the realtime push has already
      // refreshed HANDCRAFTED — but the editor's React state is still
      // the pre-update copy, so we still refuse saves until reload.)
      setStaleMap((prev) => prev || {
        reason: "External update detected — the handcrafted_map row was modified by another writer while this editor was open. Reload to see the latest state.",
      });
    });
    return off;
  }, []);

  // Autosave to Supabase, debounced 800ms after the last edit. localStorage
  // still gets the latest state on every change as a crash-recovery cache
  // — if the Supabase write fails (offline, RLS, etc.) the draft survives
  // a refresh and the next mount will try to save again.
  useEffect(() => {
    // First-mount no-op: skip the autosave the initial useState seeds.
    if (!hasUserEditedRef.current) {
      hasUserEditedRef.current = true;
      return;
    }
    // Hard refusal once stale: don't even draft to localStorage, since
    // promoting that draft on next mount would just spread the staleness.
    if (staleMap) {
      setSaveStatus({ error: "Refusing autosave: map is stale. Reload to continue editing." });
      return;
    }
    saveDraft({ tiles, streets, buildings, gates });
    setSaveStatus("dirty");
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        // Filter out wall-generator output so we only persist the authored
        // content; the generator re-runs every load.
        const authoredTiles = stripGeneratedTiles(tiles);
        const sealedStructures = mergeSealedStructures(streets, buildings, gates);
        await saveMap({ tiles: authoredTiles, sealedStructures });
        clearDraft(); // Supabase has it; no need to keep the localStorage copy
        setSaveStatus("saved");
      } catch (err) {
        console.error("[map editor] save failed:", err);
        if (err.code === "STALE_MAP" || err.code === "NO_BASELINE") {
          setStaleMap({
            reason: err.message,
            serverUpdatedAt: err.serverUpdatedAt,
            loadedUpdatedAt: err.loadedUpdatedAt,
          });
        }
        setSaveStatus({ error: err.message || String(err) });
      }
    }, 800);
    return () => clearTimeout(saveTimerRef.current);
  }, [tiles, streets, buildings, gates, staleMap]);

  const containerRef = useRef(null);
  // Pan-disable ref. Kept in sync with `tool === "multi"` by the useEffect
  // below — without this, touching a hex to start a drag-select would
  // also engage the map's single-finger pan, sliding the camera under
  // the user's finger and dropping selections everywhere.
  const panDisabledRef = useRef(false);
  const { transformRef, lastWasDragRef, mouseHandlers, reset } = useZoomPan(containerRef, { panDisabledRef });

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
    if (tool === "multi") {
      // Toggle membership in the multi-select set. Selected hexes get a
      // bright stroke (see hex render below) and the bottom sheet shows
      // the bulk-action bar.
      setMultiSel((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
      });
      return;
    }
    if (tool === "curtain") {
      // Two-step: click start, click end. Computes a hex path from
      // start to end and stamps `terrain:"wall"` (with current material)
      // on every coord along the way. "avoid" mode runs A* with
      // infinite cost on existing tiles, so the path detours around
      // anything already authored; "direct" draws a straight hex line
      // and overwrites anything in the way.
      if (!curtainStart) {
        setCurtainStart({ x, y });
        return;
      }
      const end = { x, y };
      let path = null;
      if (curtainMode === "direct") {
        path = hexLine(curtainStart, end);
      } else {
        const costAt = (p) => {
          if (p.x === end.x && p.y === end.y) return 1; // end always allowed
          if (p.x === curtainStart.x && p.y === curtainStart.y) return 1;
          return tiles[`${p.x},${p.y}`] ? Infinity : 1;
        };
        path = hexAStar(curtainStart, end, costAt) || hexLine(curtainStart, end);
      }
      const wantsMaterial = curtainTerrain === "wall" && curtainMaterial;
      setTiles((t) => {
        const next = { ...t };
        for (const p of path) {
          const k = `${p.x},${p.y}`;
          const existing = next[k] || {};
          next[k] = {
            ...existing,
            terrain: curtainTerrain,
            ...(wantsMaterial ? { material: curtainMaterial } : {}),
          };
        }
        return next;
      });
      setCurtainStart(null);
      return;
    }
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
        // Relocate the tile data. The moved tile's `doors` array (and
        // any other tile's doors/door referring to the source coord)
        // pointed at the OLD neighbours — we drop the moved tile's
        // doors entirely so it falls back to default-open at the new
        // location (subsequent edits via the Edges tool re-author as
        // needed). We do NOT chase per-tile doors across the rest of
        // the map; users moving tiles with inbound door references
        // need to re-edit those references manually.
        const sourceKey = `${moveSource.x},${moveSource.y}`;
        const src = moveSource;
        setTiles((t) => {
          const moving = t[sourceKey];
          if (!moving) return t;
          const { doors: _drop, ...rest } = moving;
          const nextT = { ...t };
          delete nextT[sourceKey];
          nextT[key] = rest;
          return nextT;
        });
        // Update streets/buildings membership: replace the source
        // entry with the new coord; if the destination already had
        // an entry, drop it so we don't end up with duplicates.
        setStreets((s) => {
          let movedOver = false;
          const out = [];
          for (const c of s) {
            if (c.x === src.x && c.y === src.y) {
              if (movedOver) continue;
              out.push({ x, y });
              movedOver = true;
            } else if (c.x === x && c.y === y) {
              continue; // destination duplicate dropped
            } else {
              out.push(c);
            }
          }
          return out;
        });
        setBuildings((b) => {
          let movedOver = false;
          const out = [];
          const hexDist = (ax, ay, bx, by) => {
            const dq = ax - bx, dr = ay - by;
            return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
          };
          for (const bd of b) {
            if (bd.x === src.x && bd.y === src.y) {
              if (movedOver) continue;
              // Build the moved entry, but strip any door/doors entries
              // that are no longer adjacent to the new coord. Without
              // this, a moved building keeps its old front-door coord
              // and the next export throws on adjacency validation.
              const moved = { ...bd, x, y };
              if (moved.door && hexDist(moved.door.x, moved.door.y, x, y) !== 1) {
                delete moved.door;
              }
              if (Array.isArray(moved.doors)) {
                moved.doors = moved.doors.filter((dd) => hexDist(dd.x, dd.y, x, y) === 1);
                if (moved.doors.length === 0) delete moved.doors;
              }
              out.push(moved);
              movedOver = true;
            } else if (bd.x === x && bd.y === y) {
              continue; // destination duplicate dropped
            } else {
              out.push(bd);
            }
          }
          return out;
        });
        setMoveSource(null);
        setSelected({ x, y });
      }
      return;
    }
    if (tool === "paint") {
      // Reset `poi` when the painted terrain changes. Keeping a stale
      // poi (e.g. citadel parent) attached to a different terrain
      // would leave the footprint group claiming a hex whose terrain
      // disagrees, which the verifier and renderer would treat as
      // inconsistent.
      setTiles((t) => {
        const cur = t[key];
        const poiKeep = cur && cur.terrain === paintTerrain ? cur.poi ?? null : null;
        return { ...t, [key]: { ...(cur || {}), terrain: paintTerrain, poi: poiKeep } };
      });
      // Auto-sync sealed-structure membership for unambiguous terrains.
      // A "street" tile inside the city walls is always a street in the
      // sealed structure; not auto-adding it produced the orphan-street
      // bug where a painted street was invisible to building-door
      // validation. "settlement" and "indoor" stay user-toggled (they
      // could be either pass-through plazas or destination buildings).
      if (paintTerrain === "street") {
        setStreets((s) => (s.some((c) => c.x === x && c.y === y) ? s : [...s, { x, y }]));
        setBuildings((b) => b.filter((bd) => !(bd.x === x && bd.y === y)));
      }
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

  // All state setters use the functional updater form so a quick burst
  // of edits (typing a description, paint-stamping multiple hexes)
  // never builds the next state off a stale `tiles` closure.
  function patchSelectedTile(patch) {
    if (!selectedKey) return;
    setTiles((t) => {
      const cur = t[selectedKey] || {};
      return { ...t, [selectedKey]: { ...cur, ...patch } };
    });
  }

  function patchSelectedPoi(patch) {
    if (!selectedKey) return;
    setTiles((t) => {
      const cur = t[selectedKey] || {};
      const poi = cur.poi ? { ...cur.poi, ...patch } : { ...patch };
      // Clean empty strings on type/name/access/description so the export
      // doesn't carry blank fields.
      for (const k of ["type", "name", "access", "description", "partName", "part", "parent", "parentName", "area", "areaName"]) {
        if (poi[k] === "" || poi[k] == null) delete poi[k];
      }
      const hasAny = Object.keys(poi).length > 0;
      return { ...t, [selectedKey]: { ...cur, poi: hasAny ? poi : null } };
    });
  }

  // Bulk versions for the multi-edit panel. Same shape as the single-tile
  // patch* helpers but iterate over every key in multiSel. Each field in
  // the MultiEditPanel writes to all selected hexes live.
  function bulkPatchTile(patch) {
    if (multiSel.size === 0) return;
    setTiles((t) => {
      const next = { ...t };
      for (const k of multiSel) {
        const cur = next[k] || {};
        next[k] = { ...cur, ...patch };
      }
      return next;
    });
  }
  function bulkPatchPoi(patch) {
    if (multiSel.size === 0) return;
    setTiles((t) => {
      const next = { ...t };
      for (const k of multiSel) {
        const cur = next[k] || {};
        const poi = cur.poi ? { ...cur.poi, ...patch } : { ...patch };
        for (const kk of ["type", "name", "access", "description", "partName", "part", "parent", "parentName", "area", "areaName"]) {
          if (poi[kk] === "" || poi[kk] == null) delete poi[kk];
        }
        const hasAny = Object.keys(poi).length > 0;
        next[k] = { ...cur, poi: hasAny ? poi : null };
      }
      return next;
    });
  }
  function bulkSetParent(parentId, parentName) {
    if (multiSel.size === 0) return;
    setTiles((t) => {
      const next = { ...t };
      for (const k of multiSel) {
        const cur = next[k];
        if (!cur) continue;
        const poi = { ...(cur.poi || {}) };
        if (parentId) {
          poi.parent = parentId;
          poi.parentName = parentName || parentId;
        } else {
          delete poi.parent;
          delete poi.parentName;
          delete poi.part;
          delete poi.partName;
        }
        const hasAny = Object.keys(poi).length > 0;
        next[k] = { ...cur, poi: hasAny ? poi : null };
      }
      return next;
    });
  }

  function toggleDoor(nx, ny) {
    if (!selected) return;
    // Edge-level toggle: flips the shared boundary between the selected
    // hex and ({nx, ny}) and writes both sides' doors arrays atomically
    // so the engine's bidirectional edgeAllowed() stays consistent.
    setTiles((t) => toggleEdge(t, selected.x, selected.y, nx, ny));
  }

  function clearDoorsOverride() {
    if (!selectedKey) return;
    setTiles((t) => {
      const cur = t[selectedKey];
      if (!cur) return t;
      const { doors: _drop, ...rest } = cur;
      return { ...t, [selectedKey]: rest };
    });
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

  async function resetToSupabase() {
    if (!confirm("Discard the current draft and reload the map from Supabase?")) return;
    clearDraft();
    // Force a re-fetch even though the singleton was already hydrated at
    // boot — the open game tab may have written newer state.
    try {
      // Re-fetch directly: hydrateMap is intentionally memoized for normal app
      // boot, while this editor action is an explicit refresh.
      const { supabase } = await import("../engine/supabase-client.js");
      const { data, error } = await supabase
        .from("handcrafted_map")
        .select("*")
        .eq("id", "whitemarch")
        .single();
      if (error) throw error;
      applyMapData(data.tiles, data.sealed_structures, { explicitVersion: data.map_version });
    } catch (err) {
      alert(`Failed to refetch: ${err.message || err}`);
      return;
    }
    const fresh = cloneInitial();
    setTiles(fresh.tiles);
    setStreets(fresh.streets);
    setBuildings(fresh.buildings);
    setGates(fresh.gates);
    setSelected(null);
    setMoveSource(null);
    setSaveStatus("saved");
    reset();
  }

  async function resetToDefaultMap() {
    if (!confirm("Overwrite the current map with the default starting road network? This will discard your draft. (You must save/wait for autosave to write it to Supabase).")) return;
    clearDraft();
    const { compileDefaultWorldMap } = await import("../data/handcrafted-map.js");
    const defaultTiles = compileDefaultWorldMap();
    setTiles(defaultTiles);
    setStreets([]);
    setBuildings([]);
    setGates([]);
    setSelected(null);
    setMoveSource(null);
    setSaveStatus("edited");
  }

  const streetSet = useMemo(() => new Set(streets.map((c) => `${c.x},${c.y}`)), [streets]);
  // Enumerate every poi.parent / parentName combination currently in use.
  // Powers the right-panel parent picker so the author can group new tiles
  // under existing footprints (e.g. all water tiles under "whitewend") or
  // create a new parent on the fly.
  const parentOptions = useMemo(() => {
    const m = new Map();
    for (const t of Object.values(tiles)) {
      const id = t?.poi?.parent;
      if (!id) continue;
      if (!m.has(id)) m.set(id, t.poi.parentName || id);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [tiles]);

  function setSelectedParent(parentId, parentName) {
    if (!selectedKey) return;
    onPoiPatchHelper(parentId, parentName);
  }
  // Wrapper used by the parent picker — clears parent fields when null,
  // stamps both when set. Kept separate from patchSelectedPoi so we can
  // explicitly DELETE the parent keys instead of writing empty strings
  // (the POI cleanup loop in patchSelectedPoi drops empty strings, which
  // works, but explicit is clearer).
  function onPoiPatchHelper(parentId, parentName) {
    setTiles((t) => {
      const cur = t[selectedKey];
      if (!cur) return t;
      const poi = { ...(cur.poi || {}) };
      if (parentId) {
        poi.parent = parentId;
        poi.parentName = parentName || parentId;
      } else {
        delete poi.parent;
        delete poi.parentName;
        delete poi.part;
        delete poi.partName;
      }
      const hasAny = Object.keys(poi).length > 0;
      return { ...t, [selectedKey]: { ...cur, poi: hasAny ? poi : null } };
    });
  }
  const buildingSet = useMemo(() => new Set(buildings.map((b) => `${b.x},${b.y}`)), [buildings]);

  return (
    <div style={{
      position: "fixed", inset: 0, backgroundColor: PALETTE.bg, color: PALETTE.text,
      fontFamily: "'Inter', sans-serif", fontSize: "13px",
      display: "grid",
      // Desktop: side panel beside the map. Mobile: single column, panel
      // becomes a fixed-position bottom sheet (see "Right panel" below).
      gridTemplateColumns: isMobile ? "1fr" : "1fr 340px",
      gridTemplateRows: isMobile ? "52px 1fr" : "44px 1fr",
    }}>
      {/* Stale-map lock banner. High-visibility full-width strip when the
          row was modified externally (other tab / MCP SQL / stale cache).
          Renders OVER the toolbar via fixed positioning so the user can't
          miss it. Saves are blocked while this is up. */}
      {staleMap && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
          backgroundColor: "#5a1818", color: "#fff7eb",
          padding: "10px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", gap: "12px",
          fontSize: "13px", lineHeight: 1.4,
        }}>
          <strong style={{ fontWeight: 700 }}>⚠ Map is stale — autosave disabled.</strong>
          <span style={{ flex: 1 }}>
            {staleMap.reason || "The handcrafted_map row was modified by another writer since this editor was loaded. Your local edits are NOT being saved to Supabase. Reload to see the current state, then redo your edits."}
            {staleMap.serverUpdatedAt && staleMap.loadedUpdatedAt && (
              <span style={{ display: "block", opacity: 0.7, fontSize: "11px", marginTop: "2px" }}>
                loaded: {staleMap.loadedUpdatedAt} · server: {staleMap.serverUpdatedAt}
              </span>
            )}
          </span>
          <button
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: "#f5dcb8", color: "#0c1111",
              border: "none", borderRadius: "3px", padding: "6px 14px",
              cursor: "pointer", fontSize: "12px", fontWeight: 600,
            }}
          >Reload</button>
        </div>
      )}

      {/* Top toolbar */}
      <div style={{
        gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "6px",
        padding: isMobile ? "0 8px" : "0 12px",
        borderBottom: `1px solid ${PALETTE.border}`, backgroundColor: "#161d1c",
        overflowX: "auto", overflowY: "hidden", whiteSpace: "nowrap",
        WebkitOverflowScrolling: "touch",
      }}>
        <button onClick={onExit} style={btn()}>←</button>
        {!isMobile && (
          <strong style={{ marginRight: "12px", color: PALETTE.accent, letterSpacing: "0.06em" }}>MAP EDITOR</strong>
        )}
        <ToolBtn label={isMobile ? "Sel" : "Select"} active={tool === "select"} onClick={() => { setTool("select"); setMoveSource(null); }} />
        <ToolBtn label={moveSource ? (isMobile ? "→Dst" : "Move → click dest") : "Move"} active={tool === "move"} onClick={() => { setTool("move"); }} />
        <ToolBtn label="Paint" active={tool === "paint"} onClick={() => { setTool("paint"); setMoveSource(null); setCurtainStart(null); }} />
        <ToolBtn label={isMobile ? "Del" : "Delete"} active={tool === "delete"} onClick={() => { setTool("delete"); setMoveSource(null); setCurtainStart(null); }} />
        <ToolBtn label="Edges" active={tool === "edges"} onClick={() => { setTool("edges"); setMoveSource(null); setCurtainStart(null); }} />
        <ToolBtn label={isMobile ? `Multi (${multiSel.size})` : `Multi-select (${multiSel.size})`} active={tool === "multi"} onClick={() => { setTool("multi"); setMoveSource(null); setCurtainStart(null); }} />
        <ToolBtn label={curtainStart ? (isMobile ? "→End" : "Curtain → click end") : "Curtain"} active={tool === "curtain"} onClick={() => { setTool("curtain"); setMoveSource(null); }} />
        {tool === "paint" && (
          <select value={paintTerrain} onChange={(e) => setPaintTerrain(e.target.value)} style={{ ...input(), width: isMobile ? "110px" : "auto" }}>
            {TERRAIN_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {tool === "curtain" && (
          <>
            <select value={curtainTerrain} onChange={(e) => setCurtainTerrain(e.target.value)} style={{ ...input(), width: isMobile ? "100px" : "auto" }}>
              {TERRAIN_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={curtainMode} onChange={(e) => setCurtainMode(e.target.value)} style={{ ...input(), width: isMobile ? "92px" : "auto" }}>
              <option value="avoid">avoid existing</option>
              <option value="direct">direct line</option>
            </select>
            {curtainTerrain === "wall" && (
              <select value={curtainMaterial} onChange={(e) => setCurtainMaterial(e.target.value)} style={{ ...input(), width: isMobile ? "80px" : "auto" }}>
                {Object.entries(WALL_MATERIALS).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            )}
          </>
        )}
        {tool === "multi" && multiSel.size > 0 && (
          <>
            <button
              onClick={() => {
                if (!confirm(`Delete ${multiSel.size} selected hexes?`)) return;
                setTiles((t) => {
                  const next = { ...t };
                  for (const k of multiSel) delete next[k];
                  return next;
                });
                setMultiSel(new Set());
              }}
              style={btn({ color: PALETTE.danger })}
            >Delete sel</button>
            <select
              defaultValue=""
              onChange={(e) => {
                const terrain = e.target.value;
                if (!terrain) return;
                setTiles((t) => {
                  const next = { ...t };
                  for (const k of multiSel) {
                    const existing = next[k] || {};
                    next[k] = { ...existing, terrain };
                  }
                  return next;
                });
                e.target.value = "";
              }}
              style={{ ...input(), width: isMobile ? "100px" : "auto" }}
            >
              <option value="">Paint sel…</option>
              {TERRAIN_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={() => setMultiSel(new Set())} style={btn()}>Clear sel</button>
          </>
        )}
        <div style={{ flex: 1, minWidth: "8px" }} />
        <SaveStatusBadge status={saveStatus} />
        {!isMobile && (
          <span style={{ color: PALETTE.textDim, fontSize: "11px" }}>
            {Object.keys(tiles).length} tiles · {streets.length} streets · {buildings.length} buildings
          </span>
        )}
        <button onClick={resetToDefaultMap} style={btn({ color: PALETTE.danger })} title="Reset to Default Map">
          {isMobile ? "⚙" : "Reset to Default Map"}
        </button>
        <button onClick={resetToSupabase} style={btn({ color: PALETTE.danger })} title="Reset to Supabase">
          {isMobile ? "↺" : "Reset to Supabase"}
        </button>
        <button onClick={() => setShowExport(true)} style={btn()}>
          {isMobile ? "⤓" : "Export…"}
        </button>
      </div>

      {/* Map area */}
      <div
        ref={containerRef}
        {...mouseHandlers}
        style={{
          overflow: "hidden", backgroundColor: PALETTE.bg, touchAction: "none",
          position: "relative", cursor: tool === "select" ? "grab" : "crosshair",
          userSelect: "none",
        }}
      >
        <div ref={transformRef} style={{
          position: "absolute", top: "50%", left: "50%",
          transformOrigin: "center center", willChange: "transform",
        }}>
          {/* 2D scaleY isometric tilt — see MapView.jsx for the full
              note. CSS 3D rotateX breaks SVG hit-testing on the
              polygons inside; 2D scaleY gives the same foreshortened
              look without sacrificing click targeting. */}
          <div style={{
            transform: "scaleY(0.615)", transformOrigin: "center center",
          }}>
            <svg width={SVG_SIZE} height={SVG_SIZE} style={{ display: "block" }}>
              {/* Render north-first so south-facing hex side faces paint
                  over anything behind them — matches the in-game MapView. */}
              {/* Per-hex rendering uses MapView's shared primitives —
                  tileFill, dropStrokeForTile, liftForTile, hexPrismParts,
                  hexCornerPoints, assetKeyForTile, MAP_ASSETS — so every
                  hex looks pixel-identical to how it draws in the live
                  game. Editor-only additions: a bright stroke around the
                  selected / move-source hex, and a cursor: pointer. No
                  per-hex text labels (the game uses the MAP_ASSETS icon
                  glyph; the full POI name shows in the side panel when
                  selected). */}
              {renderCoords
                .slice()
                .sort((a, b) => (SVG_CENTER + VSPACING * a.y) - (SVG_CENTER + VSPACING * b.y))
                .map(({ x, y }) => {
                const key = `${x},${y}`;
                const tile = tiles[key];
                const px = SVG_CENTER + HSPACING * (x + y / 2);
                const py = SVG_CENTER + VSPACING * y;
                const isSel = selected && selected.x === x && selected.y === y;
                const isMoveSrc = moveSource && moveSource.x === x && moveSource.y === y;
                const isMulti = multiSel.has(key);
                const isCurtainStart = curtainStart && curtainStart.x === x && curtainStart.y === y;
                const fill = tileFill(tile);
                const lift = liftForTile(tile);
                const prism = lift > 0 ? hexPrismParts(px, py, lift) : null;
                let stroke = dropStrokeForTile(tile) ? "transparent" : "rgba(215, 167, 111, 0.08)";
                let strokeWidth = 1;
                if (isMulti)        { stroke = "#6fb3e0"; strokeWidth = 3; }
                if (isCurtainStart) { stroke = "#d7a76f"; strokeWidth = 4; }
                if (isMoveSrc)      { stroke = "#7fe3b0"; strokeWidth = 3; }
                if (isSel)          { stroke = "#f5dcb8"; strokeWidth = 3; }
                // Match MapView: tiles inside a building footprint don't
                // get per-hex icons (the parent's centroid icon represents
                // the group). Lore-only groupings (river, wall) are
                // unaffected because we don't classify them as footprint
                // members in the first place.
                const isBuildingFootprintMember = !!tile?.poi?.parent && tile?.poi?.type !== "hidden"
                  && (tile?.terrain === "indoor" || tile?.terrain === "settlement");
                const assetKey = tile && !isBuildingFootprintMember ? assetKeyForTile(tile) : null;
                return (
                  <g
                    key={key}
                    onClick={(e) => {
                      // Defensive: React's onClick should only fire for
                      // the primary button, but some platforms / mouse
                      // drivers leak middle / right clicks through. We
                      // reserve MMB for pan and want it to never select.
                      if (e.button !== 0) return;
                      onHexClick(x, y);
                    }}
                    // Drag-select for the Multi tool. Filter on
                    // e.button === 0 so middle-mouse-button (pan) and
                    // right-click never add a hex to the selection.
                    // releasePointerCapture is what lets pointerenter
                    // fire on neighbouring hexes during a touch drag
                    // — without it the OS routes every pointer event
                    // back to the element that received pointerdown.
                    onPointerDown={tool === "multi" ? (e) => {
                      if (e.button !== 0) return;
                      e.stopPropagation(); // don't trigger the container's pan-drag
                      try { e.target.releasePointerCapture(e.pointerId); } catch {}
                      draggingMultiRef.current = true;
                      setMultiSel((prev) => {
                        const next = new Set(prev);
                        next.add(key);
                        return next;
                      });
                    } : undefined}
                    onPointerEnter={tool === "multi" ? () => {
                      if (!draggingMultiRef.current) return;
                      setMultiSel((prev) => {
                        if (prev.has(key)) return prev;
                        const next = new Set(prev);
                        next.add(key);
                        return next;
                      });
                    } : undefined}
                    style={{ cursor: "pointer", touchAction: "none" }}
                  >
                    {prism && (
                      <polygon
                        points={prism.sidePoints}
                        fill={SIDE_SHADE}
                        stroke="none"
                      />
                    )}
                    <polygon
                      points={prism ? prism.topPoints : hexCornerPoints(px, py)}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      strokeLinejoin="round"
                    />
                    {assetKey && MAP_ASSETS[assetKey] && (
                      <g transform={`translate(${px - 11}, ${py - 11 - lift})`} pointerEvents="none">
                        {MAP_ASSETS[assetKey]("#f5dcb8")}
                      </g>
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
                      if (ta.terrain === "wall") lift = Math.max(lift, 22);
                      else if (ta.terrain === "indoor") lift = Math.max(lift, 10);
                      else if (ta.poi?.parent) lift = Math.max(lift, 8);
                    }
                    if (tb) {
                      if (tb.terrain === "wall") lift = Math.max(lift, 22);
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

      {/* Right panel (desktop) / Bottom sheet (mobile). On mobile we
          only render the panel when a tile is selected OR a multi-select
          is active; tap anywhere to dismiss via the close button at the
          top of the sheet. */}
      {(() => {
        const multiActive = tool === "multi" && multiSel.size > 0;
        const showPanel = !isMobile || selected || multiActive;
        if (!showPanel) return null;
        return (
      <div style={isMobile ? {
        // Bottom sheet: fixed at the bottom, ~55vh tall, slides over the map.
        position: "fixed", left: 0, right: 0, bottom: 0,
        maxHeight: "55vh", overflowY: "auto",
        padding: "10px 12px 14px",
        borderTop: `1px solid ${PALETTE.border}`,
        backgroundColor: PALETTE.panel,
        boxShadow: "0 -8px 24px rgba(0,0,0,0.5)",
        zIndex: 50,
      } : {
        overflowY: "auto", padding: "12px 14px", borderLeft: `1px solid ${PALETTE.border}`,
        backgroundColor: PALETTE.panel,
      }}>
        {isMobile && (selected || multiActive) && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: "8px", paddingBottom: "6px",
            borderBottom: `1px solid ${PALETTE.border}`,
          }}>
            <span style={{ fontSize: "11px", color: PALETTE.textDim }}>
              {multiActive ? `Editing ${multiSel.size} hexes` : `Editing (${selected.x}, ${selected.y})`}
            </span>
            <button
              onClick={() => { if (multiActive) setMultiSel(new Set()); else setSelected(null); }}
              style={{ ...btn(), padding: "4px 12px" }}
              aria-label="Close panel"
            >✕</button>
          </div>
        )}
        {multiActive ? (
          <MultiEditPanel
            count={multiSel.size}
            tiles={tiles}
            keys={multiSel}
            onTilePatch={bulkPatchTile}
            onPoiPatch={bulkPatchPoi}
            onSetParent={bulkSetParent}
            parentOptions={parentOptions}
            onClear={() => setMultiSel(new Set())}
          />
        ) : selected ? (
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
            parentOptions={parentOptions}
            onSetParent={setSelectedParent}
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
            <p>Edits auto-save to Supabase (debounced ~800ms). The badge in the top bar shows the current save state. <strong>Reset to Supabase</strong> discards the local draft and refetches the row. <strong>Export…</strong> is a debug-only download of the JS the source files used to hold; pasting it back is no longer the canonical workflow.</p>
          </div>
        )}
      </div>
        );
      })()}

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

// Bulk-edit panel shown when the Multi tool is active and the selection
// is non-empty. Mirrors EditPanel's "interchangeable" fields — anything
// where setting the same value across many tiles makes sense (terrain +
// wall material, wallside flag, POI type / access, footprint parent).
// Per-tile fields (name, description, edges, doors) are intentionally
// absent because they don't bulk-edit meaningfully.
//
// Each field write goes through the bulk* helpers in MapEditor, so every
// selected hex receives the same patch in a single setTiles call → one
// autosave fires for the whole batch.
function MultiEditPanel({ count, tiles, keys, onTilePatch, onPoiPatch, onSetParent, parentOptions, onClear }) {
  // Compute a "shared value or — mixed —" hint for each field, so the
  // UI shows what the selection currently looks like before the user
  // changes it.
  const sample = (getter) => {
    let first = undefined;
    let mixed = false;
    for (const k of keys) {
      const v = getter(tiles[k]);
      if (first === undefined) first = v;
      else if (v !== first) { mixed = true; break; }
    }
    return { value: mixed ? "" : (first ?? ""), mixed };
  };
  const terrain  = sample((t) => t?.terrain);
  const material = sample((t) => t?.material);
  const wallside = sample((t) => !!t?.wallside);
  const poiType  = sample((t) => t?.poi?.type);
  const poiAcc   = sample((t) => t?.poi?.access);
  const parent   = sample((t) => t?.poi?.parent);
  const showWallMaterial = terrain.value === "wall" && !terrain.mixed;
  const mixedHint = (s) => s.mixed ? <span style={{ color: PALETTE.accentDim, fontSize: "10px", marginLeft: "6px" }}>— mixed —</span> : null;

  return (
    <div>
      <div style={{ marginBottom: "10px" }}>
        <strong style={{ color: PALETTE.accent, fontSize: "14px" }}>{count} hex{count === 1 ? "" : "es"} selected</strong>
        <div style={{ color: PALETTE.textDim, fontSize: "11px", marginTop: "2px" }}>
          Changes here apply to every selected hex. Per-tile fields (name, description, edges) are only editable one tile at a time.
        </div>
      </div>

      <Section label="Terrain">
        <select value={terrain.value} onChange={(e) => onTilePatch({ terrain: e.target.value || undefined })} style={input()}>
          <option value="">{terrain.mixed ? "(mixed — pick to overwrite)" : "(none — empty)"}</option>
          {Object.keys(TERRAINS).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {showWallMaterial && (
          <div style={{ marginTop: "6px" }}>
            <div style={{ fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: PALETTE.accentDim, marginBottom: "4px" }}>
              Material{mixedHint(material)}
            </div>
            <select value={material.value} onChange={(e) => onTilePatch({ material: e.target.value || undefined })} style={input()}>
              <option value="">(default — slate stone)</option>
              {Object.entries(WALL_MATERIALS).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        )}
      </Section>

      <Section label="Flags">
        <Checkbox
          label={`hugs the wall${wallside.mixed ? " (mixed)" : ""}`}
          checked={!wallside.mixed && !!wallside.value}
          onChange={(v) => onTilePatch({ wallside: v || undefined })}
        />
      </Section>

      <Section label="POI">
        <Field label={<>Type{mixedHint(poiType)}</>}>
          <input
            type="text" list="poi-type-suggestions"
            value={poiType.value}
            placeholder={poiType.mixed ? "mixed — type to overwrite" : "market, smithy, combat, river, …"}
            onChange={(e) => onPoiPatch({ type: e.target.value })}
            style={input()}
          />
        </Field>
        <Field label={<>Access{mixedHint(poiAcc)}</>}>
          <input
            type="text" list="poi-access-suggestions"
            value={poiAcc.value}
            placeholder={poiAcc.mixed ? "mixed — type to overwrite" : "public, restricted, …"}
            onChange={(e) => onPoiPatch({ access: e.target.value })}
            style={input()}
          />
        </Field>
        <Field label={<>Footprint parent{mixedHint(parent)}</>}>
          <select
            value={parent.value}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") { onSetParent(null, null); return; }
              if (v === "__new__") {
                const id = (window.prompt("New parent id (slug):", "") || "").trim();
                if (!id) return;
                const name = (window.prompt("Display name:", id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())) || "").trim();
                if (!name) return;
                onSetParent(id, name);
                return;
              }
              const match = (parentOptions || []).find(([id]) => id === v);
              onSetParent(v, match ? match[1] : v);
            }}
            style={input()}
          >
            <option value="">{parent.mixed ? "(mixed — pick to overwrite)" : "(none)"}</option>
            {(parentOptions || []).map(([id, name]) => (
              <option key={id} value={id}>{name} ({id})</option>
            ))}
            <option value="__new__">+ New parent…</option>
          </select>
        </Field>
      </Section>

      <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
        <button onClick={onClear} style={btn()}>Clear selection</button>
      </div>
    </div>
  );
}

function EditPanel({
  tile, x, y, isStreet, isBuilding, buildingEntry,
  onTilePatch, onPoiPatch, onToggleDoor, onEdgeState, onClearDoorsOverride,
  onToggleStreet, onToggleBuilding, onSetBuildingDoor,
  tilesAt, isStreetAt,
  parentOptions, onSetParent,
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
        {tile?.terrain === "wall" && (
          <div style={{ marginTop: "6px" }}>
            <div style={{ fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: PALETTE.accentDim, marginBottom: "4px" }}>
              Material
            </div>
            <select
              value={tile.material || ""}
              onChange={(e) => onTilePatch({ material: e.target.value || undefined })}
              style={input()}
            >
              <option value="">(default — slate stone)</option>
              {Object.entries(WALL_MATERIALS).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        )}
      </Section>

      {/* Flags */}
      {tile && (
        <Section label="Flags">
          <Checkbox
            label="hugs the wall (keeps the wall ring straight around me)"
            checked={!!tile.wallside}
            onChange={(v) => onTilePatch({ wallside: v || undefined })}
          />
          {tile.perimeter && (
            <div style={{ fontSize: "11px", color: PALETTE.textDim, marginTop: "4px" }}>
              <code>perimeter</code> — set by the wall generator; this tile is part of the auto-generated d=1 ring around the city. Read-only.
            </div>
          )}
        </Section>
      )}

      {/* POI */}
      {tile && (
        <Section label="POI">
          <Field label="Type (drives services + map icon)">
            <input
              type="text" list="poi-type-suggestions"
              value={poi.type || ""}
              onChange={(e) => onPoiPatch({ type: e.target.value })}
              placeholder="market, smithy, combat, river, …"
              style={input()}
            />
            <datalist id="poi-type-suggestions">
              {POI_TYPE_OPTIONS.filter(Boolean).map((t) => <option key={t} value={t} />)}
            </datalist>
          </Field>
          <Field label="Name">
            <input
              type="text" value={poi.name || ""}
              onChange={(e) => onPoiPatch({ name: e.target.value })}
              style={input()}
            />
          </Field>
          <Field label="Access (narrator hint — not enforced)">
            <input
              type="text" list="poi-access-suggestions"
              value={poi.access || ""}
              onChange={(e) => onPoiPatch({ access: e.target.value })}
              placeholder="public, restricted, conditional, hidden, …"
              style={input()}
            />
            <datalist id="poi-access-suggestions">
              {POI_ACCESS_OPTIONS.filter(Boolean).map((a) => <option key={a} value={a} />)}
            </datalist>
          </Field>
          <Field label="Description">
            <textarea
              value={poi.description || ""}
              onChange={(e) => onPoiPatch({ description: e.target.value })}
              rows={6}
              style={{ ...input(), resize: "vertical", fontFamily: "'Instrument Serif', serif", lineHeight: 1.4 }}
            />
          </Field>
          <Field label="Footprint parent (groups this tile with others)">
            <select
              value={poi.parent || ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") { onSetParent(null, null); return; }
                if (v === "__new__") {
                  const id = (window.prompt(
                    "New parent id (slug — letters/digits/dashes, e.g. iron-way):",
                    ""
                  ) || "").trim();
                  if (!id) return;
                  const name = (window.prompt(
                    "Display name for this parent:",
                    id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                  ) || "").trim();
                  if (!name) return;
                  onSetParent(id, name);
                  return;
                }
                const match = (parentOptions || []).find(([id]) => id === v);
                onSetParent(v, match ? match[1] : v);
              }}
              style={input()}
            >
              <option value="">(none — standalone tile)</option>
              {(parentOptions || []).map(([id, name]) => (
                <option key={id} value={id}>{name} ({id})</option>
              ))}
              <option value="__new__">+ New parent…</option>
            </select>
            {poi.parent && (
              <div style={{ fontSize: "11px", color: PALETTE.textDim, marginTop: "4px" }}>
                Sharing parent <code>{poi.parent}</code> means clicking any tile in this group shows the same lore card.
              </div>
            )}
          </Field>
        </Section>
      )}

      {/* Sealed-structure street/building membership UI used to live here.
          Dropped — the per-tile doors graph (authored via the Edges section
          below) is now the source of truth. Use Edges to seal or open the
          boundaries between this tile and its neighbours. */}

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
            // Walls auto-seal against procedural neighbours (see
            // runWallAutoSeal in handcrafted-pipeline.js). Surface that
            // in the badge so "—" stops looking like permissive
            // ambiguity on a wall hex — it's a hard seal.
            const wallToProcedural = state === "missing" && tile.terrain === "wall";
            const stateBadge = state === "open"
              ? "● open"
              : state === "closed"
                ? "✕ closed"
                : wallToProcedural
                  ? "✕ sealed"
                  : state === "missing"
                    ? "—"
                    : "○ default";
            const stateColor = state === "open"
              ? PALETTE.ok
              : (state === "closed" || wallToProcedural)
                ? PALETTE.danger
                : PALETTE.textDim;
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
  const validation = useMemo(() => validateExport({ tiles, streets, buildings }), [tiles, streets, buildings]);
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
          <strong style={{ color: PALETTE.accent, letterSpacing: "0.06em" }}>EXPORT (DEBUG)</strong>
          <ToolBtn label="Tiles" active={view === "tiles"} onClick={() => setView("tiles")} />
          <ToolBtn label="Structures" active={view === "structures"} onClick={() => setView("structures")} />
          <div style={{ flex: 1 }} />
          <button onClick={() => copyToClipboard(text)} style={btn()}>Copy to clipboard</button>
          <button onClick={() => downloadAs(filename, text)} style={btn()}>Download .js</button>
          <button onClick={onClose} style={btn({ color: PALETTE.danger })}>Close</button>
        </div>
        {validation.length > 0 && (
          <div style={{
            marginBottom: "10px", padding: "8px 10px", borderRadius: "4px",
            backgroundColor: "rgba(229, 138, 122, 0.08)",
            border: `1px solid ${PALETTE.danger}`,
            color: PALETTE.text, fontSize: "11px", lineHeight: 1.45,
            maxHeight: "180px", overflow: "auto",
          }}>
            <strong style={{ color: PALETTE.danger }}>
              ⚠ Draft has {validation.length} validation {validation.length === 1 ? "issue" : "issues"} that would throw if loaded by the pipeline:
            </strong>
            <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
              {validation.map((e, i) => <li key={i} style={{ marginBottom: "2px" }}>{e}</li>)}
            </ul>
          </div>
        )}
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
          Debug pane — the canonical save path is now Supabase autosave (see the badge in the top bar). This dump is here for diffing, backups, or pasting into a fresh Supabase project's seed migration.
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
function SaveStatusBadge({ status }) {
  let label, color;
  if (status === "idle") return null;
  if (status === "dirty") { label = "● unsaved"; color = PALETTE.textDim; }
  else if (status === "saving") { label = "⟳ saving…"; color = PALETTE.accent; }
  else if (status === "saved") { label = "✓ saved"; color = PALETTE.ok; }
  else if (status && status.error) { label = `⚠ save failed`; color = PALETTE.danger; }
  return (
    <span
      title={status && status.error ? status.error : ""}
      style={{ color, fontSize: "11px", marginRight: "8px", minWidth: "76px", textAlign: "right" }}
    >{label}</span>
  );
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
