#!/usr/bin/env node
// Render the Whitemarch handcrafted map (or any region/ward of it) to
// monospace ASCII, with a correct on-screen compass. This is the shared,
// phone-readable picture: it uses the SAME projection the game/editor use,
// so "up" here is "up" there.
//
// ORIENTATION (must match src/components/MapView.jsx):
//   screen_x = x + y/2     (larger -> EAST / right)
//   screen_y = y           (larger -> SOUTH / down; smaller/negative -> NORTH/up)
// Pointy-top hexes shear horizontally as y grows, which is exactly why
// reading raw (x,y) lies about compass direction. We render in screen space
// so the text map cannot disagree with the editor.
//
// Column convention: col = 2*x + y (keeps integers; ~2 chars per hex, and
// each row is shifted by its y so the hex offset is visible). Row = y.
//
// USAGE
//   node scripts/whitemarch-ascii.mjs --in <snapshot.json> [opts]
//   node scripts/whitemarch-ascii.mjs --from-db [opts]      # needs SUPABASE_URL + SUPABASE_SERVICE_KEY
// OPTIONS
//   --region xmin,xmax,ymin,ymax   clip to a tile-coord box
//   --ward <substr>                clip to tiles whose parentName matches (case-insensitive)
//   --cols N                       max output width; auto-downsamples to fit (default 100)
//   --no-water                     drop water tiles (river) so walls read clearly
//   --legend                       list named POIs under the map
//   --no-compass                   omit the compass frame
//
// A snapshot.json may be either { tiles: { "x,y": {...} }, ... } or a bare
// { "x,y": {...} } map.

import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (name, def = null) => {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : def;
};
const flag = (name) => args.includes(name);

// ---- load tiles -----------------------------------------------------------
async function loadTiles() {
  const inFile = opt("--in");
  if (inFile) {
    const raw = JSON.parse(readFileSync(inFile, "utf8"));
    return raw.tiles ? raw.tiles : raw;
  }
  if (flag("--from-db")) {
    const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) throw new Error("--from-db needs SUPABASE_URL + SUPABASE_SERVICE_KEY");
    const res = await fetch(`${url}/rest/v1/handcrafted_map?id=eq.whitemarch&select=tiles`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`DB read failed: ${res.status} ${await res.text()}`);
    return (await res.json())[0].tiles;
  }
  throw new Error("provide --in <file.json> or --from-db");
}

// ---- terrain -> glyph (priority order also used when downsampling) --------
// Higher priority wins when several tiles collapse into one character.
const GLYPHS = [
  ["wall",   "#", (t) => t.terrain === "wall"],
  ["gate",   "+", (t) => t.poi?.type === "gate" || t.__gate],
  ["water",  "~", (t) => t.terrain === "water"],
  ["indoor", "o", (t) => t.terrain === "indoor"],
  ["bldg",   "%", (t) => t.terrain === "settlement"],
  ["road",   ":", (t) => t.terrain === "road"],
  ["street", ".", (t) => t.terrain === "street"],
];
function glyphFor(t) {
  for (const [, g, test] of GLYPHS) if (test(t)) return g;
  return " ";
}
function priority(g) {
  const order = ["#", "+", "~", "o", "%", ":", ".", " "];
  const i = order.indexOf(g);
  return i < 0 ? 999 : i;
}

const HEX_DIRS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];

async function main() {
  const tiles = await loadTiles();
  const cells = new Map();              // "x,y" -> tile
  for (const [k, v] of Object.entries(tiles)) {
    const [x, y] = k.split(",").map(Number);
    cells.set(`${x},${y}`, { x, y, ...v });
  }
  // Mark checkpoint gates (passable tile touching >=2 walls) so they render as '+'.
  const isWall = (x, y) => cells.get(`${x},${y}`)?.terrain === "wall";
  for (const c of cells.values()) {
    if (c.terrain === "wall" || c.terrain === "water") continue;
    let w = 0; for (const [dx, dy] of HEX_DIRS) if (isWall(c.x + dx, c.y + dy)) w++;
    if (w >= 2) c.__gate = true;
  }

  // ---- selection ----------------------------------------------------------
  let sel = [...cells.values()];
  if (flag("--no-water")) sel = sel.filter((c) => c.terrain !== "water");
  const region = opt("--region");
  if (region) {
    const [xmin, xmax, ymin, ymax] = region.split(",").map(Number);
    sel = sel.filter((c) => c.x >= xmin && c.x <= xmax && c.y >= ymin && c.y <= ymax);
  }
  const ward = opt("--ward");
  if (ward) {
    const q = ward.toLowerCase();
    const keep = sel.filter((c) => (c.poi?.parentName || "").toLowerCase().includes(q));
    if (!keep.length) throw new Error(`no tiles with parentName matching "${ward}"`);
    const xs = keep.map((c) => c.x), ys = keep.map((c) => c.y);
    const pad = 2;
    const [xmin, xmax, ymin, ymax] = [Math.min(...xs)-pad, Math.max(...xs)+pad, Math.min(...ys)-pad, Math.max(...ys)+pad];
    sel = sel.filter((c) => c.x >= xmin && c.x <= xmax && c.y >= ymin && c.y <= ymax);
  }
  if (!sel.length) { console.log("(no tiles in selection)"); return; }

  // ---- project to screen-space integer grid: col = 2x+y, row = y ---------
  for (const c of sel) { c.col = 2 * c.x + c.y; c.row = c.y; }
  const colMin = Math.min(...sel.map((c) => c.col));
  const colMax = Math.max(...sel.map((c) => c.col));
  const rowMin = Math.min(...sel.map((c) => c.row));
  const rowMax = Math.max(...sel.map((c) => c.row));
  const rawW = colMax - colMin + 1;

  // ---- downsample factor so width fits --cols ----------------------------
  const maxCols = Number(opt("--cols", "100"));
  const step = Math.max(1, Math.ceil(rawW / maxCols));
  const W = Math.ceil(rawW / step);
  const H = Math.ceil((rowMax - rowMin + 1) / step);
  const grid = Array.from({ length: H }, () => Array(W).fill(" "));
  for (const c of sel) {
    const gx = Math.floor((c.col - colMin) / step);
    const gy = Math.floor((c.row - rowMin) / step);
    const g = glyphFor(c);
    if (priority(g) < priority(grid[gy][gx])) grid[gy][gx] = g;
  }

  // ---- frame + compass ----------------------------------------------------
  const compass = !flag("--no-compass");
  const lines = grid.map((r) => r.join(""));
  const out = [];
  out.push(`Whitemarch — screen-space ASCII  (N=up, E=right; screen_x=x+y/2)`);
  out.push(`region cols[${colMin}..${colMax}] rows[${rowMin}..${rowMax}]  tiles=${sel.length}  scale=1 char per ${step}x${step}`);
  out.push(`legend: # wall  + gate  ~ water  o indoor  % building  : road  . street`);
  if (compass) {
    const top = "N".padStart(Math.floor(W / 2) + 1);
    out.push(top);
    out.push("   +" + "-".repeat(W) + "+");
    lines.forEach((ln, i) => {
      const mid = i === Math.floor(H / 2);
      out.push(`${mid ? "W -" : "   "}|${ln.padEnd(W)}|${mid ? "- E" : ""}`);
    });
    out.push("   +" + "-".repeat(W) + "+");
    out.push("S".padStart(Math.floor(W / 2) + 5));
  } else {
    lines.forEach((ln) => out.push(ln));
  }

  // ---- optional legend of named POIs -------------------------------------
  if (flag("--legend")) {
    const named = sel.filter((c) => c.poi?.name)
      .sort((a, b) => a.row - b.row || a.col - b.col);
    out.push("");
    out.push(`named POIs (${named.length}):`);
    for (const c of named) {
      out.push(`  (${c.x},${c.y}) ${c.poi.name}${c.poi.parentName ? `  [${c.poi.parentName}]` : ""}`);
    }
  }
  console.log(out.join("\n"));
}

main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
