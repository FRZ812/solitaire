#!/usr/bin/env node
// Map v2 (relational model) — decompile / compile / parity proof.
//
// Legacy migration check for the normalized model retained in the Supabase
// migrations. It proves that model can losslessly represent the current
// single-blob map: it DECOMPILES the live `tiles` blob into the v2
// layers (places, cells, prose, edges), COMPILES them back to a `tiles` dict,
// and asserts the door graph + terrain are identical. Run before seeding the
// real tables, and in CI during the migration, so a model/loader change can't
// silently diverge from the map the game ships today.
//
// USAGE
//   node scripts/map-v2-parity.mjs --live              # read live row over REST (.env)
//   node scripts/map-v2-parity.mjs dump.json           # a { tiles } / { tiles, sealed_structures } dump
//   node scripts/map-v2-parity.mjs --live --emit seed.json   # also write the v2 seed rows
//
// Exit code: non-zero on any parity mismatch.

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const K = (x, y) => `${x},${y}`;
const P = (k) => k.split(",").map(Number);

function parseDotEnv() {
  const o = {}; const p = join(REPO, ".env");
  if (!existsSync(p)) return o;
  for (const l of readFileSync(p, "utf8").split("\n")) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !l.trim().startsWith("#")) o[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return o;
}
async function loadLive() {
  const e = { ...parseDotEnv(), ...process.env };
  const url = e.SUPABASE_URL || e.VITE_SUPABASE_URL, key = e.SUPABASE_SERVICE_KEY || e.VITE_SUPABASE_ANON_KEY;
  const r = await fetch(`${url}/rest/v1/handcrafted_map?id=eq.whitemarch&select=tiles`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error(`live read ${r.status}`);
  return (await r.json())[0];
}

// --------------------------------------------------------------------------
// DECOMPILE: blob tiles -> { places, cells, prose, edges:{gates,cuts} }
// Default connectivity rule (mirrored by compile): adjacent cells that share a
// non-null place_id are connected; everything else is sealed. `gate` edges open
// a normally-sealed boundary; `cut` edges seal a normally-open in-place edge.
// A cell is `open` (default-open, no doors) iff the blob stored no doors list.
// --------------------------------------------------------------------------
export function decompile(tiles) {
  const adj = (k) => { const [x, y] = P(k); return DIRS.map(([dx, dy]) => K(x + dx, y + dy)); };
  const parentOf = {}; for (const k in tiles) parentOf[k] = tiles[k].poi?.parent || null;

  // Group door-connected, parent-less cells into synthesized places so their
  // internal adjacency is implicit (not 500 explicit gates).
  const uf = {}; const find = (a) => { while (uf[a] && uf[a] !== a) a = uf[a] = uf[uf[a]]; return a; };
  const hasD = (k) => Array.isArray(tiles[k]?.doors);
  const conn = (a, b) => (tiles[a]?.doors || []).some((d) => K(d.x, d.y) === b) || (tiles[b]?.doors || []).some((d) => K(d.x, d.y) === a);
  for (const k in tiles) {
    if (parentOf[k] || !hasD(k)) continue;
    uf[k] = uf[k] || k;
    for (const n of adj(k)) if (tiles[n] && !parentOf[n] && hasD(n) && conn(k, n)) { uf[n] = uf[n] || n; uf[find(k)] = find(n); }
  }
  const placeId = (k) => { const t = tiles[k]; if (!t) return null; return parentOf[k] || (uf[k] ? "grp:" + find(k) : null); };

  const cells = {}, prose = {}, places = {}, gates = new Set(), cuts = new Set();
  for (const k in tiles) {
    const t = tiles[k], pid = placeId(k);
    if (t.poi?.description) prose["cell:" + k] = t.poi.description;
    if (pid) { (places[pid] ??= { id: pid, names: new Set(), cells: 0 }); places[pid].cells++; if (t.poi?.parentName) places[pid].names.add(t.poi.parentName); }
    const open = !Array.isArray(t.doors);
    cells[k] = {
      x: P(k)[0], y: P(k)[1], terrain: t.terrain, place_id: pid, open,
      poi_type: t.poi?.type ?? null, name: t.poi?.name ?? null, part: t.poi?.part ?? null,
      service: t.poi?.service ?? null, access: t.poi?.access ?? null, prose_id: t.poi?.description ? "cell:" + k : null,
    };
    if (!open) {
      const blob = new Set((t.doors || []).map((d) => K(d.x, d.y)));
      const base = adj(k).filter((n) => placeId(n) && placeId(n) === pid);
      for (const d of blob) if (!base.includes(d)) gates.add(`${k}->${d}`);
      for (const n of base) if (!blob.has(n)) cuts.add(`${k}->${n}`);
    }
  }
  return { cells, prose, places, gates, cuts, placeId };
}

// COMPILE: v2 layers -> { "x,y": { terrain, doors? } } (door graph + terrain only).
export function compileDoors(model) {
  const { cells, gates, cuts, placeId } = model;
  const adj = (k) => { const [x, y] = P(k); return DIRS.map(([dx, dy]) => K(x + dx, y + dy)); };
  const gateOut = {}, cutOut = {};
  for (const g of gates) { const [a, b] = g.split("->"); (gateOut[a] ??= []).push(b); }
  for (const c of cuts) { const [a, b] = c.split("->"); (cutOut[a] ??= []).push(b); }
  const out = {};
  for (const k in cells) {
    const c = cells[k]; const o = { terrain: c.terrain };
    if (!c.open) {
      const base = c.place_id ? adj(k).filter((n) => placeId(n) === c.place_id) : [];
      const set = new Set(base);
      for (const g of gateOut[k] || []) set.add(g);
      for (const cu of cutOut[k] || []) set.delete(cu);
      o.doors = [...set].map((s) => { const [x, y] = P(s); return { x, y }; });
    }
    out[k] = o;
  }
  return out;
}

function parity(tiles, comp) {
  const norm = (a) => (a ? [...a].map((d) => K(d.x, d.y)).sort().join(",") : "(open)");
  let term = 0, door = 0; const ex = [];
  for (const k in tiles) {
    if (tiles[k].terrain !== comp[k].terrain) term++;
    if (norm(tiles[k].doors) !== norm(comp[k].doors)) { door++; if (ex.length < 15) ex.push(`${k}: v1[${norm(tiles[k].doors)}] != v2[${norm(comp[k].doors)}]`); }
  }
  return { term, door, ex };
}

async function main() {
  const args = process.argv.slice(2);
  const emitIdx = args.indexOf("--emit");
  const emitVal = emitIdx >= 0 ? args[emitIdx + 1] : null;
  const fileArg = args.find((a) => !a.startsWith("--") && a !== emitVal);
  let raw = args.includes("--live") ? await loadLive() : JSON.parse(readFileSync(resolve(fileArg), "utf8"));
  if (Array.isArray(raw)) raw = raw[0];
  const tiles = raw.tiles || raw;

  const model = decompile(tiles);
  const comp = compileDoors(model);
  const { term, door, ex } = parity(tiles, comp);

  console.log(`cells=${Object.keys(model.cells).length}  places=${Object.keys(model.places).length}  prose=${Object.keys(model.prose).length}  gates=${model.gates.size}  cuts=${model.cuts.size}`);
  console.log(`PARITY: terrain mismatches=${term}  door-graph mismatches=${door}`);
  for (const e of ex) console.log("  " + e);

  if (emitVal) {
    const seed = {
      places: Object.values(model.places).map((p) => ({ id: p.id, name: [...p.names][0] || p.id, cells: p.cells })),
      cells: Object.values(model.cells),
      prose: Object.entries(model.prose).map(([id, body]) => ({ id, body })),
      edges: [...[...model.gates].map((g) => ({ kind: "gate", e: g })), ...[...model.cuts].map((c) => ({ kind: "cut", e: c }))],
    };
    writeFileSync(resolve(emitVal), JSON.stringify(seed, null, 0));
    console.log(`emitted seed: ${seed.places.length} places, ${seed.cells.length} cells, ${seed.prose.length} prose, ${seed.edges.length} edges -> ${emitVal}`);
  }
  process.exit(term + door > 0 ? 1 : 0);
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error("FATAL:", e.message); process.exit(2); });
