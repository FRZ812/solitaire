#!/usr/bin/env node
// Whitemarch handcrafted-map auditor.
//
// Validates a `{ tiles, sealed_structures }` map payload against the
// engine's real invariants (docs/WORLDBUILDING.md + src/engine/world.js +
// src/data/handcrafted-pipeline.js). It runs the SAME pipeline the game
// runs at boot (buildHandcrafted) so the checks see the effective,
// post-pipeline door graph — not just the authored tiles.
//
// USAGE
//   node .claude/skills/map-audit/audit-map.mjs <dump.json>
//   node .claude/skills/map-audit/audit-map.mjs --live          # read the live row via REST (anon key)
//   node .claude/skills/map-audit/audit-map.mjs <dump.json> --json
//   node .claude/skills/map-audit/audit-map.mjs <dump.json> --max 40
//   node .claude/skills/map-audit/audit-map.mjs <dump.json> --biomes   # also static-check data/biomes.js
//
// The dump JSON is whatever `select tiles, sealed_structures` returns for
// public.handcrafted_map id='whitemarch' — either { tiles, sealed_structures }
// or { tiles, sealedStructures }. The Supabase MCP `execute_sql` result can be
// saved straight to a file and fed in here.
//
// EXIT CODE: non-zero if any ERROR-severity finding is present, so this can
// gate a pre-write confirmation step or CI.

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Locate the repo root (the dir that holds src/data/handcrafted-pipeline.js)
// by walking up from this script. Lets the skill live anywhere under the repo.
// ---------------------------------------------------------------------------
function findRepoRoot() {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, "src", "data", "handcrafted-pipeline.js"))) return dir;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  throw new Error("Could not locate repo root (no src/data/handcrafted-pipeline.js found above this script).");
}

const REPO = findRepoRoot();
const impt = (rel) => import(pathToFileURL(join(REPO, rel)).href);

const HEX_DIRS = [
  { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: -1 },
  { x: -1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: 1 },
];
const key = (x, y) => `${x},${y}`;
const parseKey = (k) => { const [x, y] = k.split(",").map(Number); return { x, y }; };
const hexDist = (ax, ay, bx, by) => (Math.abs(ax - bx) + Math.abs(ay - by) + Math.abs(ax + ay - bx - by)) / 2;
const isAdjacent = (ax, ay, bx, by) => hexDist(ax, ay, bx, by) === 1;

// ---------------------------------------------------------------------------
// Input loading
// ---------------------------------------------------------------------------
function parseDotEnv() {
  const out = {};
  const p = join(REPO, ".env");
  if (!existsSync(p)) return out;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith("#")) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

async function loadLive() {
  const env = { ...parseDotEnv(), ...process.env };
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key_ = env.SUPABASE_SERVICE_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key_) throw new Error("--live needs SUPABASE_URL/VITE_SUPABASE_URL and a key (VITE_SUPABASE_ANON_KEY works for read).");
  const res = await fetch(`${url}/rest/v1/handcrafted_map?id=eq.whitemarch&select=tiles,sealed_structures`, {
    headers: { apikey: key_, Authorization: `Bearer ${key_}` },
  });
  if (!res.ok) throw new Error(`Live read failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  if (!rows[0]) throw new Error("Row id='whitemarch' not found.");
  return rows[0];
}

function normalize(raw) {
  const tiles = raw.tiles || {};
  const sealed = raw.sealed_structures || raw.sealedStructures || [];
  return { tiles, sealed };
}

// ---------------------------------------------------------------------------
// Findings collector
// ---------------------------------------------------------------------------
const findings = []; // { sev: "ERROR"|"WARN"|"INFO", code, msg, coords: [] }
function add(sev, code, msg, coords = []) { findings.push({ sev, code, msg, coords }); }

// ---------------------------------------------------------------------------
// Sealed-structure member extraction (handles all three authoring shapes)
// ---------------------------------------------------------------------------
function structureMembers(s) {
  const members = new Set();
  const exteriorDoors = new Set(); // coords OUTSIDE the structure a gate/entry opens to
  const addC = (set, c) => set.add(key(c.x, c.y));
  if (s.streets || s.buildings) {
    for (const c of s.streets || []) addC(members, c);
    for (const b of s.buildings || []) addC(members, b);
    for (const [, outside] of s.gates || []) addC(exteriorDoors, outside);
  } else if (s.interior) {
    for (const c of s.interior) addC(members, c);
    for (const c of s.threshold || []) addC(members, c);
    for (const [, outside] of s.gates || []) addC(exteriorDoors, outside);
  } else if (s.links || s.entry) {
    const seen = new Set();
    for (const [a, b] of s.links || []) { addC(seen, a); addC(seen, b); }
    if (s.entry) addC(seen, s.entry);
    const outsideKey = s.outside ? key(s.outside.x, s.outside.y) : null;
    for (const k of seen) { if (k !== outsideKey) members.add(k); }
    if (outsideKey) exteriorDoors.add(outsideKey);
  }
  return { members, exteriorDoors };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const jsonOut = args.includes("--json");
  const doBiomes = args.includes("--biomes");
  const maxIdx = args.indexOf("--max");
  const MAX = maxIdx >= 0 ? Number(args[maxIdx + 1]) : 25;
  const fileArg = args.find((a) => !a.startsWith("--") && a !== String(MAX));

  // 1. Load payload.
  let raw;
  if (args.includes("--live")) {
    raw = await loadLive();
  } else if (fileArg) {
    raw = JSON.parse(readFileSync(resolve(fileArg), "utf8"));
    // Some MCP/REST dumps wrap the row in an array.
    if (Array.isArray(raw)) raw = raw[0];
    if (raw && raw.result) raw = Array.isArray(raw.result) ? raw.result[0] : raw.result;
  } else {
    console.error("Provide a dump.json path or --live. See header for usage.");
    process.exit(2);
  }
  const { tiles, sealed } = normalize(raw);
  const tileCount = Object.keys(tiles).length;

  // 2. Run the real pipeline → effective tiles (post wall-autoseal + structure doors).
  const { buildHandcrafted } = await impt("src/data/handcrafted-pipeline.js");
  const { TERRAINS } = await impt("src/data/terrains.js");
  let effective = tiles;
  let pipelineOk = true;
  try {
    effective = buildHandcrafted({ tiles, sealedStructures: sealed });
  } catch (e) {
    pipelineOk = false;
    add("ERROR", "PIPELINE", `buildHandcrafted threw — the structure list is internally inconsistent: ${e.message}. Door checks below run on RAW authored tiles and may be incomplete.`);
  }

  const defined = (x, y) => Object.prototype.hasOwnProperty.call(effective, key(x, y));

  // --- collect sealed-structure member/exterior sets ---
  const allStructMembers = new Set();
  const structInfos = sealed.map((s, i) => {
    const { members, exteriorDoors } = structureMembers(s);
    for (const m of members) allStructMembers.add(m);
    return { name: s.name || `#${i}`, members, exteriorDoors, raw: s };
  });

  // ===========================================================================
  // CHECK C1 — unknown / legacy terrain
  // ===========================================================================
  {
    const unknown = [], legacy = [];
    for (const [k, t] of Object.entries(tiles)) {
      if (!t || typeof t.terrain !== "string") { unknown.push(k); continue; }
      if (t.terrain === "wall_top") { legacy.push(k); continue; }
      if (!TERRAINS[t.terrain]) unknown.push(k);
    }
    if (unknown.length) add("ERROR", "TERRAIN_UNKNOWN", `${unknown.length} tile(s) have an unknown terrain id (not in data/terrains.js).`, unknown);
    if (legacy.length) add("WARN", "TERRAIN_LEGACY", `${legacy.length} tile(s) still use legacy "wall_top" (auto-migrated to "wall" on load — clean them in the row).`, legacy);
  }

  // ===========================================================================
  // CHECK C2 — interior tiles missing a doors graph (Ruling 7 wilderness walk-in)
  // An indoor tile, OR any sealed-structure interior member, MUST have doors
  // after the pipeline. Without it the player can step in from any adjacency.
  // ===========================================================================
  {
    const offenders = [];
    for (const [k, t] of Object.entries(effective)) {
      if (!t) continue;
      const inStruct = allStructMembers.has(k);
      const isIndoor = t.terrain === "indoor";
      if ((isIndoor || inStruct) && !Array.isArray(t.doors)) {
        // Open settlement tiles inside an open structure are allowed default-open;
        // only flag indoor, or structure members the pipeline failed to seal.
        if (isIndoor || (inStruct && t.terrain !== "settlement" && t.terrain !== "street" && t.terrain !== "road")) {
          offenders.push(k);
        }
      }
    }
    if (offenders.length) add("ERROR", "NO_DOORS", `${offenders.length} interior/indoor tile(s) have NO doors list — the player can walk in from open wilderness (Ruling 7). Each needs an explicit doors array (or membership in a sealed_structure that supplies one).`, offenders);
  }

  // ===========================================================================
  // CHECK C3 — door target validity: adjacency, existence, indoor-leaks
  // CHECK C4 — door symmetry (asymmetric edges; wall holds but likely a slip)
  // ===========================================================================
  {
    const nonAdjacent = [], toProceduralIndoor = [], asymmetric = [];
    for (const [k, t] of Object.entries(effective)) {
      if (!t || !Array.isArray(t.doors)) continue;
      const { x, y } = parseKey(k);
      for (const d of t.doors) {
        if (typeof d?.x !== "number" || typeof d?.y !== "number") { nonAdjacent.push(`${k}→(bad)`); continue; }
        if (!isAdjacent(x, y, d.x, d.y)) { nonAdjacent.push(`${k}→${d.x},${d.y}`); continue; }
        const nk = key(d.x, d.y);
        const nt = effective[nk];
        if (!nt) {
          // Door to a procedural neighbour. Fine for a gate/threshold; a leak for a deep interior.
          if (t.terrain === "indoor") toProceduralIndoor.push(`${k}→${nk}`);
          continue;
        }
        // Symmetry: if the neighbour has a doors list and does NOT point back, the edge is half-open.
        if (Array.isArray(nt.doors) && !nt.doors.some((dd) => dd.x === x && dd.y === y)) {
          asymmetric.push(`${k}→${nk}`);
        }
      }
    }
    if (nonAdjacent.length) add("ERROR", "DOOR_NONADJ", `${nonAdjacent.length} door(s) point to a NON-adjacent hex (a door can only cross one hex edge).`, nonAdjacent);
    if (toProceduralIndoor.length) add("WARN", "DOOR_LEAK", `${toProceduralIndoor.length} indoor tile door(s) open onto a procedural (undefined) hex — an interior leaking straight to wilderness. Confirm each is an intended exit; otherwise drop it.`, toProceduralIndoor);
    if (asymmetric.length) add("WARN", "DOOR_ASYM", `${asymmetric.length} door(s) are asymmetric: A lists B but B (which has its own doors) does not list A. The wall still holds (engine needs BOTH ends), but this is usually an authoring slip — reciprocate or remove.`, asymmetric);
  }

  // ===========================================================================
  // CHECK C5 — sealed_structures reference tiles that don't exist (soft-fail)
  // CHECK C6 — structure connectivity: every member reachable from an entrance
  // ===========================================================================
  {
    const danglers = [];
    for (const info of structInfos) {
      for (const m of info.members) if (!effective[m]) danglers.push(`${info.name}:${m}`);
    }
    if (danglers.length) add("WARN", "STRUCT_DANGLING", `${danglers.length} sealed_structure member coord(s) have no tile in the row (the pipeline silently skips them — the footprint is incomplete).`, danglers);

    // Connectivity per structure over the effective door graph.
    const edgeOpen = (ax, ay, bx, by) => {
      const a = effective[key(ax, ay)], b = effective[key(bx, by)];
      const aOk = !a?.doors || a.doors.some((d) => d.x === bx && d.y === by);
      const bOk = !b?.doors || b.doors.some((d) => d.x === ax && d.y === ay);
      return aOk && bOk;
    };
    for (const info of structInfos) {
      const members = [...info.members].filter((m) => effective[m]);
      if (members.length < 2) continue;
      // Entrances = members with a door (or default-open edge) leaving the member set.
      const memberSet = new Set(members);
      const entrances = members.filter((m) => {
        const { x, y } = parseKey(m);
        const t = effective[m];
        const nbrs = t?.doors ? t.doors : HEX_DIRS.map((d) => ({ x: x + d.x, y: y + d.y }));
        return nbrs.some((n) => !memberSet.has(key(n.x, n.y)) && edgeOpen(x, y, n.x, n.y));
      });
      if (entrances.length === 0) {
        add("ERROR", "STRUCT_NO_ENTRANCE", `Structure "${info.name}" has no entrance — no member opens to a hex outside the footprint. It is unreachable.`, members.slice(0, 8));
        continue;
      }
      // Flood from entrances within the member set.
      const seen = new Set(entrances);
      const stack = [...entrances];
      while (stack.length) {
        const cur = stack.pop();
        const { x, y } = parseKey(cur);
        for (const d of HEX_DIRS) {
          const nk = key(x + d.x, y + d.y);
          if (!memberSet.has(nk) || seen.has(nk)) continue;
          if (edgeOpen(x, y, x + d.x, y + d.y)) { seen.add(nk); stack.push(nk); }
        }
      }
      const stranded = members.filter((m) => !seen.has(m));
      if (stranded.length) add("ERROR", "STRUCT_UNREACHABLE", `Structure "${info.name}": ${stranded.length} member tile(s) are walled off from the structure's entrance(s) by the door graph — the player can never reach them.`, stranded);
    }
  }

  // ===========================================================================
  // CHECK C6b — interior reachability from the open world.
  // Independent of sealed_structures: flood from open-country tiles and any
  // open-country entrance (a tile whose doors include a procedural/void hex),
  // traversing the symmetric door graph. Any `indoor` tile not reached is an
  // orphan room or a "sealed box" (e.g. an empty `doors: []`) the player can
  // never enter — which the NO_DOORS check, by design, does not catch.
  // ===========================================================================
  {
    const OPEN = new Set(["settlement", "street", "road", "plains", "hills", "forest", "marsh", "mountains"]);
    const edgeOpen = (ax, ay, bx, by) => {
      const a = effective[key(ax, ay)], b = effective[key(bx, by)];
      const aOk = !a?.doors || a.doors.some((d) => d.x === bx && d.y === by);
      const bOk = !b?.doors || b.doors.some((d) => d.x === ax && d.y === ay);
      return aOk && bOk;
    };
    const hasVoidDoor = (t) => Array.isArray(t.doors) && t.doors.some((d) => !effective[key(d.x, d.y)]);
    const seeds = [];
    for (const [k, t] of Object.entries(effective)) {
      if (!t) continue;
      if ((OPEN.has(t.terrain) && (!Array.isArray(t.doors) || hasVoidDoor(t))) || hasVoidDoor(t)) seeds.push(k);
    }
    const seen = new Set(seeds); const stack = [...seeds];
    while (stack.length) {
      const { x, y } = parseKey(stack.pop());
      for (const d of HEX_DIRS) {
        const nk = key(x + d.x, y + d.y); const nt = effective[nk];
        if (!nt || seen.has(nk) || nt.terrain === "water") continue;
        if (edgeOpen(x, y, x + d.x, y + d.y)) { seen.add(nk); stack.push(nk); }
      }
    }
    const unreachable = Object.keys(effective).filter((k) => effective[k]?.terrain === "indoor" && !seen.has(k));
    if (unreachable.length) add("ERROR", "UNREACHABLE_INTERIOR", `${unreachable.length} indoor tile(s) cannot be reached from the open world by any door path — orphan rooms or sealed "empty doors" boxes the player can never enter.`, unreachable);
  }

  // ===========================================================================
  // CHECK C7 — POI footprint (parent/part) consistency
  // ===========================================================================
  {
    const byParent = new Map();
    for (const [k, t] of Object.entries(tiles)) {
      const p = t?.poi?.parent;
      if (!p) continue;
      if (!byParent.has(p)) byParent.set(p, []);
      byParent.get(p).push({ k, poi: t.poi });
    }
    const mixedName = [], dupPart = [], missingPart = [];
    for (const [parent, list] of byParent) {
      const names = new Set(list.map((e) => e.poi.parentName).filter(Boolean));
      if (names.size > 1) mixedName.push(`${parent} {${[...names].join(" | ")}}`);
      const parts = new Map();
      for (const e of list) {
        if (!e.poi.part) { missingPart.push(`${parent}:${e.k}`); continue; }
        if (parts.has(e.poi.part)) dupPart.push(`${parent}:${e.poi.part} (${parts.get(e.poi.part)} & ${e.k})`);
        else parts.set(e.poi.part, e.k);
      }
    }
    if (mixedName.length) add("WARN", "POI_PARENT_NAME", `${mixedName.length} footprint(s) have inconsistent parentName across member hexes.`, mixedName);
    if (dupPart.length) add("WARN", "POI_DUP_PART", `${dupPart.length} duplicate (parent, part) pair(s) — two hexes claim the same sub-area slug.`, dupPart);
    if (missingPart.length) add("INFO", "POI_NO_PART", `${missingPart.length} footprint member(s) lack a part/partName (fine for single-tile POIs, sloppy for multi-hex ones).`, missingPart);
  }

  // ===========================================================================
  // CHECK C8 — collisions with rivers / rumored / fabled (authored content wins,
  // but flag so the overlap is intentional). Currently those tables are empty.
  // ===========================================================================
  try {
    const [{ RIVER_BY_COORD }, { RUMORED }, { FABLED_BY_COORD }] = await Promise.all([
      impt("src/data/rivers.js"), impt("src/data/rumored.js"), impt("src/data/fabled.js"),
    ]);
    const coll = [];
    for (const k of Object.keys(tiles)) {
      if (RIVER_BY_COORD[k]) coll.push(`${k} (river)`);
      if (RUMORED[k]) coll.push(`${k} (rumored)`);
      if (FABLED_BY_COORD[k]) coll.push(`${k} (fabled)`);
    }
    if (coll.length) add("INFO", "COORD_COLLISION", `${coll.length} handcrafted tile(s) also have a river/rumored/fabled entry at the same coord (handcrafted wins — confirm intended, e.g. a ford).`, coll);
  } catch { /* tables optional */ }

  // ===========================================================================
  // OPTIONAL — static biome overlap / weight check (data/biomes.js)
  // ===========================================================================
  if (doBiomes) {
    try {
      const { BIOMES } = await impt("src/data/biomes.js");
      const bounded = BIOMES.filter((b) => b.bounds);
      const overlaps = [];
      for (let i = 0; i < bounded.length; i++) {
        for (let j = i + 1; j < bounded.length; j++) {
          const a = bounded[i].bounds, b = bounded[j].bounds;
          if (a.xmin <= b.xmax && b.xmin <= a.xmax && a.ymin <= b.ymax && b.ymin <= a.ymax) {
            // First-match wins: the EARLIER biome (i) shadows the intersection.
            overlaps.push(`${bounded[i].id} ⊃ ${bounded[j].id}`);
          }
        }
      }
      // Reported as INFO — overlaps are resolved by first-match precedence (it's
      // how the Whitemarch capital box is listed first to win its seam). The flag
      // just lets a human confirm each seam is intentional (Ruling 5: touch, don't
      // intersect) and spot the one bug class it can't auto-detect: a smaller,
      // more-specific region listed AFTER a broad one, shadowed so it never renders.
      if (overlaps.length) add("INFO", "BIOME_OVERLAP", `${overlaps.length} bounded-biome overlap(s); the left (earlier-listed) biome wins each intersection by first-match. Confirm each seam is intended (Ruling 5).`, overlaps);
      for (const b of BIOMES) {
        const sum = Object.values(b.terrainWeights || {}).reduce((a, v) => a + v, 0);
        if (b.terrainWeights && Math.abs(sum - 1) > 0.06) add("INFO", "BIOME_WEIGHTS", `Biome "${b.id}" terrainWeights sum to ${sum.toFixed(2)} (≈1.0 expected).`);
      }
    } catch (e) {
      add("INFO", "BIOME_SKIP", `Could not static-check biomes.js: ${e.message}`);
    }
  }

  // ===========================================================================
  // STATS
  // ===========================================================================
  const terrainHist = {}, poiTypeHist = {};
  let withDoors = 0, footprints = new Set();
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  for (const [k, t] of Object.entries(tiles)) {
    if (!t) continue;
    terrainHist[t.terrain] = (terrainHist[t.terrain] || 0) + 1;
    if (t.poi?.type) poiTypeHist[t.poi.type] = (poiTypeHist[t.poi.type] || 0) + 1;
    if (Array.isArray(t.doors)) withDoors++;
    if (t.poi?.parent) footprints.add(t.poi.parent);
    const { x, y } = parseKey(k);
    xmin = Math.min(xmin, x); xmax = Math.max(xmax, x);
    ymin = Math.min(ymin, y); ymax = Math.max(ymax, y);
  }
  const stats = {
    tiles: tileCount,
    effectiveTiles: Object.keys(effective).length,
    structures: sealed.length,
    footprints: footprints.size,
    tilesWithDoors: withDoors,
    boundingBox: tileCount ? { xmin, xmax, ymin, ymax } : null,
    terrain: terrainHist,
    poiTypes: poiTypeHist,
    pipelineOk,
  };

  // ===========================================================================
  // REPORT
  // ===========================================================================
  const order = { ERROR: 0, WARN: 1, INFO: 2 };
  findings.sort((a, b) => order[a.sev] - order[b.sev] || a.code.localeCompare(b.code));
  const counts = findings.reduce((m, f) => ((m[f.sev] = (m[f.sev] || 0) + 1), m), {});

  if (jsonOut) {
    console.log(JSON.stringify({ stats, counts, findings }, null, 2));
  } else {
    const C = { ERROR: "\x1b[31m", WARN: "\x1b[33m", INFO: "\x1b[36m", reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m" };
    console.log(`${C.bold}Whitemarch map audit${C.reset}  ${C.dim}(repo: ${REPO})${C.reset}`);
    console.log(`  tiles=${stats.tiles}  effective=${stats.effectiveTiles}  structures=${stats.structures}  footprints=${stats.footprints}  tilesWithDoors=${stats.tilesWithDoors}`);
    if (stats.boundingBox) console.log(`  bbox  x[${stats.boundingBox.xmin}..${stats.boundingBox.xmax}]  y[${stats.boundingBox.ymin}..${stats.boundingBox.ymax}]`);
    console.log(`  terrain  ${Object.entries(terrainHist).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join("  ")}`);
    console.log(`  pipeline ${pipelineOk ? "OK" : "THREW"}`);
    console.log(`\n${C.bold}Findings${C.reset}  ERROR:${counts.ERROR || 0}  WARN:${counts.WARN || 0}  INFO:${counts.INFO || 0}`);
    for (const f of findings) {
      console.log(`\n${C[f.sev]}● ${f.sev} [${f.code}]${C.reset} ${f.msg}`);
      if (f.coords?.length) {
        const shown = f.coords.slice(0, MAX);
        console.log(`  ${C.dim}${shown.join("  ")}${f.coords.length > MAX ? `  …(+${f.coords.length - MAX} more)` : ""}${C.reset}`);
      }
    }
    console.log("");
  }

  process.exit((counts.ERROR || 0) > 0 ? 1 : 0);
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(2); });
