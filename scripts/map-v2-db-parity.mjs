#!/usr/bin/env node
// Map v2 — END-TO-END parity: the SEEDED relational tables vs the live blob.
//
// Reads map_cell + map_edge back from the database (anon REST), compiles the
// door graph from the relational model, and asserts it equals the live
// public.handcrafted_map blob. This is the check that proves the database
// content (not just an in-memory computation) reproduces the shipping map; run
// it after every seed/edit during the migration and in CI before cutover.
//
// USAGE: node scripts/map-v2-db-parity.mjs        (reads VITE_SUPABASE_* from .env)
// Exit code: non-zero on any mismatch.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const K = (x, y) => `${x},${y}`;
const P = (k) => k.split(",").map(Number);

const env = (() => {
  const o = {}; const p = join(REPO, ".env");
  if (existsSync(p)) for (const l of readFileSync(p, "utf8").split("\n")) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !l.trim().startsWith("#")) o[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return { ...o, ...process.env };
})();
const H = { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` };
const get = async (q) => { const r = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${q}`, { headers: H }); if (!r.ok) throw new Error(`${q} ${r.status}`); return r.json(); };

const cells = await get("map_cell?select=x,y,terrain,place_id,door_controlled&limit=5000");
const edges = await get("map_edge?select=ax,ay,bx,by,kind&limit=5000");
const blob = (await get("handcrafted_map?id=eq.whitemarch&select=tiles"))[0].tiles;

const placeOf = {}, ctrl = {}, terr = {};
for (const c of cells) { const k = K(c.x, c.y); placeOf[k] = c.place_id; ctrl[k] = c.door_controlled; terr[k] = c.terrain; }
const gateOut = {}, cutOut = {};
for (const e of edges) { const a = K(e.ax, e.ay), b = K(e.bx, e.by); ((e.kind === "gate" ? gateOut : cutOut)[a] ??= []).push(b); }

function doorsFor(k) {
  if (!ctrl[k]) return null;
  const [x, y] = P(k); const pid = placeOf[k]; const set = new Set();
  if (pid) for (const [dx, dy] of DIRS) { const n = K(x + dx, y + dy); if (placeOf[n] === pid) set.add(n); }
  for (const g of gateOut[k] || []) set.add(g);
  for (const c of cutOut[k] || []) set.delete(c);
  return [...set];
}
const norm = (a) => (a ? [...a].map((d) => (typeof d === "string" ? d : K(d.x, d.y))).sort().join(",") : "(open)");
let termMis = 0, doorMis = 0; const ex = [];
for (const c of cells) {
  const k = K(c.x, c.y);
  if (terr[k] !== blob[k]?.terrain) termMis++;
  if (norm(blob[k]?.doors) !== norm(doorsFor(k))) { doorMis++; if (ex.length < 15) ex.push(`${k}: blob[${norm(blob[k]?.doors)}] != db[${norm(doorsFor(k))}]`); }
}
console.log(`DB: ${cells.length} cells, ${edges.length} edges`);
console.log(`END-TO-END PARITY: terrain mismatches=${termMis}  door-graph mismatches=${doorMis}`);
for (const x of ex) console.log("  " + x);
process.exit(termMis + doorMis > 0 ? 1 : 0);
