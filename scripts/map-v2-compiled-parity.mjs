#!/usr/bin/env node
// Map v2 — COMPILED parity. Gates the read cutover.
//
// hydrateMap() now reads public.map_compiled (the SQL compile of the relational
// model: map_cell + map_place + map_edge + map_prose → compile_map_v2()). This
// asserts that compiled blob reproduces the authored public.handcrafted_map
// blob the game shipped on. Three levels:
//   1. tiles: every tile's non-door payload is byte-identical, and every
//      controlled tile's door SET matches. Door element ORDER is allowed to
//      differ — it is semantically inert (src/engine/world.js hasDoorTo reads
//      doors via .some(); the original parity script sorts them too).
//   2. pipeline: running the real buildHandcrafted() on both blobs yields the
//      same passability (door set) and payload for every tile — the truest
//      proof the running game is identical post-cutover.
//
// USAGE: node scripts/map-v2-compiled-parity.mjs   (reads VITE_SUPABASE_* from .env)
// Exit code: non-zero on any payload or door-SET mismatch.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { buildHandcrafted } from "../src/data/handcrafted-pipeline.js";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
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

// Stable, recursive key-sorted JSON so object key order never registers as a diff.
const canon = (v) => Array.isArray(v) ? `[${v.map(canon).join(",")}]`
  : (v && typeof v === "object") ? `{${Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canon(v[k])).join(",")}}`
  : JSON.stringify(v);
const stripDoors = (t) => { if (!t || typeof t !== "object") return t; const { doors, ...rest } = t; return rest; };
const doorSet = (t) => t && Array.isArray(t.doors)
  ? t.doors.map((d) => `${d.x},${d.y}`).sort().join("|")
  : (t && "doors" in t ? "(present-non-array)" : "(none)");
const migrate = (tiles) => { const o = {}; for (const [k, t] of Object.entries(tiles)) o[k] = (t && t.terrain === "wall_top") ? { ...t, terrain: "wall" } : t; return o; };

const blob = (await get("handcrafted_map?id=eq.whitemarch&select=tiles,sealed_structures"))[0];
const compiled = (await get("map_compiled?id=eq.whitemarch&select=tiles"))[0];
if (!compiled?.tiles) { console.error("map_compiled has no tiles — run refresh_map_compiled()"); process.exit(1); }

// --- Level 1: tiles ---
let payloadDiff = 0, setDiff = 0, orderOnly = 0; const ex = [];
const keys = new Set([...Object.keys(blob.tiles), ...Object.keys(compiled.tiles)]);
for (const k of keys) {
  const b = blob.tiles[k], c = compiled.tiles[k];
  if (canon(stripDoors(b)) !== canon(stripDoors(c))) { payloadDiff++; if (ex.length < 12) ex.push(`payload ${k}`); }
  const bs = doorSet(b), cs = doorSet(c);
  if (bs !== cs) { setDiff++; if (ex.length < 12) ex.push(`doorset ${k}: [${bs}] != [${cs}]`); }
  else if (JSON.stringify(b?.doors) !== JSON.stringify(c?.doors)) orderOnly++;
}

// --- Level 2: full pipeline ---
const Hb = buildHandcrafted({ tiles: migrate(blob.tiles), sealedStructures: blob.sealed_structures });
const Hc = buildHandcrafted({ tiles: migrate(compiled.tiles), sealedStructures: blob.sealed_structures });
let pipeDiff = 0;
const allk = new Set([...Object.keys(Hb), ...Object.keys(Hc)]);
for (const k of allk) {
  if (doorSet(Hb[k]) !== doorSet(Hc[k])) { pipeDiff++; if (ex.length < 12) ex.push(`pipe-doorset ${k}`); }
  if (canon(stripDoors(Hb[k])) !== canon(stripDoors(Hc[k]))) { pipeDiff++; if (ex.length < 12) ex.push(`pipe-payload ${k}`); }
}

console.log(`tiles:    payload-diffs=${payloadDiff}  door-set-diffs=${setDiff}  (door-order-only=${orderOnly}, inert)`);
console.log(`pipeline: built ${Object.keys(Hb).length} vs ${Object.keys(Hc).length} tiles, diffs=${pipeDiff}`);
for (const e of ex) console.log("  " + e);
const fail = payloadDiff + setDiff + pipeDiff;
console.log(fail ? `COMPILED PARITY: FAIL (${fail})` : "COMPILED PARITY: OK — map_compiled is a faithful drop-in");
process.exit(fail > 0 ? 1 : 0);
