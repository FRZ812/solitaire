#!/usr/bin/env node
// Spatial reader for the Whitemarch handcrafted map.
//
// Turns the `{ tiles, sealed_structures }` payload into something you can READ
// AS A MAP — an ASCII hex grid, a compact named-place index, and per-structure
// footprint views — instead of scrolling hundreds of inlined prose paragraphs.
//
// USAGE
//   node .claude/skills/map-audit/render-map.mjs --live                 # overview ASCII map + legend
//   node .claude/skills/map-audit/render-map.mjs dump.json --crop -10 12 -12 12
//   node .claude/skills/map-audit/render-map.mjs --live --places        # named places grouped by structure
//   node .claude/skills/map-audit/render-map.mjs --live --structures    # structure footprints + entrances
//   node .claude/skills/map-audit/render-map.mjs --live --parent whitemarch-caravanserai   # one footprint, labelled
//
// Projection: pointy-top axial → screen. col = 2*x + y, row = y. So E/W
// neighbours sit 2 cols apart on the same row and the 4 diagonals land one row
// up/down and one col left/right — a normal staggered hex layout.

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";

function findRepoRoot() {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, "src", "data", "handcrafted-pipeline.js"))) return dir;
    const up = dirname(dir); if (up === dir) break; dir = up;
  }
  throw new Error("repo root not found");
}
const REPO = findRepoRoot();
const impt = (rel) => import(pathToFileURL(join(REPO, rel)).href);
const key = (x, y) => `${x},${y}`;
const parseKey = (k) => { const [x, y] = k.split(",").map(Number); return { x, y }; };

// One glyph per terrain. Picked so the dense city reads at a glance.
const GLYPH = {
  water: "~", wall: "#", street: ".", road: "=", settlement: "+",
  indoor: "o", plains: ",", hills: "^", forest: "T", marsh: "u", mountains: "M",
};
const glyphFor = (t) => (t && GLYPH[t.terrain]) || (t ? "?" : " ");

function parseDotEnv() {
  const out = {}; const p = join(REPO, ".env");
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
  const k = env.SUPABASE_SERVICE_KEY || env.VITE_SUPABASE_ANON_KEY;
  const res = await fetch(`${url}/rest/v1/handcrafted_map?id=eq.whitemarch&select=tiles,sealed_structures`, {
    headers: { apikey: k, Authorization: `Bearer ${k}` } });
  if (!res.ok) throw new Error(`live read ${res.status}`);
  return (await res.json())[0];
}

function renderGrid(coordSet, glyphOf, { crop, labels } = {}) {
  let pts = [...coordSet].map(parseKey);
  if (crop) { const [x0, x1, y0, y1] = crop; pts = pts.filter(p => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1); }
  if (!pts.length) return "(no tiles in range)";
  const col = (p) => 2 * p.x + p.y, row = (p) => p.y;
  let cMin = Infinity, cMax = -Infinity, rMin = Infinity, rMax = -Infinity;
  for (const p of pts) { cMin = Math.min(cMin, col(p)); cMax = Math.max(cMax, col(p)); rMin = Math.min(rMin, row(p)); rMax = Math.max(rMax, row(p)); }
  const W = cMax - cMin + 1, H = rMax - rMin + 1;
  const canvas = Array.from({ length: H }, () => new Array(W).fill(" "));
  for (const p of pts) {
    const ch = labels ? (labels.get(key(p.x, p.y)) || glyphOf(p)) : glyphOf(p);
    canvas[row(p) - rMin][col(p) - cMin] = ch;
  }
  const lines = canvas.map((r, i) => `${String(rMin + i).padStart(4)} |${r.join("")}`);
  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (n) => args.includes(n);
  const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  const fileArg = args.find(a => !a.startsWith("--") && !/^-?\d+$/.test(a));

  let raw = flag("--live") ? await loadLive() : JSON.parse(readFileSync(resolve(fileArg), "utf8"));
  if (Array.isArray(raw)) raw = raw[0];
  if (raw?.result) raw = Array.isArray(raw.result) ? raw.result[0] : raw.result;
  const tiles = raw.tiles || {};
  const sealed = raw.sealed_structures || raw.sealedStructures || [];

  const { buildHandcrafted } = await impt("src/data/handcrafted-pipeline.js");
  let eff = tiles; try { eff = buildHandcrafted({ tiles, sealedStructures: sealed }); } catch {}

  let crop = null;
  if (flag("--crop")) { const i = args.indexOf("--crop"); crop = args.slice(i + 1, i + 5).map(Number); }

  // --- named-place index, grouped by parent footprint then standalone ---
  if (flag("--places")) {
    const byParent = new Map(); const standalone = [];
    for (const [k, t] of Object.entries(tiles)) {
      const name = t?.poi?.name; if (!name) continue;
      const p = t?.poi?.parent;
      if (p) { if (!byParent.has(p)) byParent.set(p, { name: t.poi.parentName || p, members: [] }); byParent.get(p).members.push({ k, part: t.poi.partName || t.poi.part || t.poi.name }); }
      else standalone.push({ k, name, type: t.poi.type });
    }
    console.log(`# Footprints (${byParent.size})`);
    for (const [slug, g] of [...byParent].sort((a, b) => b[1].members.length - a[1].members.length)) {
      console.log(`\n${g.name}  [${slug}]  ${g.members.length} hexes`);
      console.log("  " + g.members.map(m => `${m.k}:${m.part}`).join("  "));
    }
    console.log(`\n# Standalone named tiles (${standalone.length})`);
    for (const s of standalone.sort((a, b) => a.k.localeCompare(b.k))) console.log(`  ${s.k}  ${s.type ? `(${s.type}) ` : ""}${s.name}`);
    return;
  }

  // --- structure footprint summary ---
  if (flag("--structures")) {
    console.log(`# Sealed structures (${sealed.length})`);
    for (const s of sealed) {
      const members = [];
      for (const c of s.streets || []) members.push(c);
      for (const b of s.buildings || []) members.push(b);
      for (const c of s.interior || []) members.push(c);
      for (const c of s.threshold || []) members.push(c);
      if (s.links) for (const [a, b] of s.links) { members.push(a); members.push(b); }
      if (s.entry) members.push(s.entry);
      const exist = members.filter(c => tiles[key(c.x, c.y)]).length;
      const xs = members.map(c => c.x), ys = members.map(c => c.y);
      const bbox = members.length ? `x[${Math.min(...xs)}..${Math.max(...xs)}] y[${Math.min(...ys)}..${Math.max(...ys)}]` : "(empty)";
      const gates = (s.gates || []).map(([i, o]) => `${i.x},${i.y}→${o.x},${o.y}`).join(" ") || (s.entry ? `${s.entry.x},${s.entry.y}→${s.outside?.x},${s.outside?.y}` : "none");
      const ghost = exist === 0 ? "  *** GHOST: no member tiles exist ***" : exist < members.length ? `  (!! ${members.length - exist} member tiles MISSING)` : "";
      console.log(`\n${s.name}\n  members=${members.length} exist=${exist}  ${bbox}\n  gates: ${gates}${ghost}`);
    }
    return;
  }

  // --- one footprint, labelled by part letter ---
  const parent = val("--parent");
  if (parent) {
    const members = Object.entries(tiles).filter(([, t]) => t?.poi?.parent === parent);
    if (!members.length) { console.log(`no tiles with parent="${parent}"`); return; }
    const labels = new Map(); const legend = [];
    let i = 0; const alpha = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    for (const [k, t] of members.sort((a, b) => a[0].localeCompare(b[0]))) {
      const ch = alpha[i++] || "*"; labels.set(k, ch);
      legend.push(`  ${ch}  ${k.padEnd(8)} ${t.poi.partName || t.poi.part || ""}  (${t.terrain}${t.poi.type ? "/" + t.poi.type : ""})`);
    }
    console.log(`# ${members[0][1].poi.parentName || parent}  (${members.length} hexes)\n`);
    console.log(renderGrid(new Set(members.map(([k]) => k)), () => "·", { labels }));
    console.log("\nlegend:\n" + legend.join("\n"));
    return;
  }

  // --- default: overview ASCII map ---
  console.log(renderGrid(new Set(Object.keys(eff)), (p) => glyphFor(eff[key(p.x, p.y)]), { crop }));
  console.log("\nlegend: ~water #wall .street =road +settlement o(indoor) ,plains ^hills T forest u marsh M mountains   (col = 2x+y, row = y)");
  console.log(`tiles=${Object.keys(tiles).length}  structures=${sealed.length}  — use --places / --structures / --parent <slug> / --crop x0 x1 y0 y1`);
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(2); });
