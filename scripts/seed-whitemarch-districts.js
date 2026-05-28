#!/usr/bin/env node
// Merge every src/data/whitemarch-districts/district-*.js module and
// write the result into the Supabase row public.handcrafted_map id='whitemarch'.
//
// Modes:
//   node scripts/seed-whitemarch-districts.js --dry      # validate, print stats, no write
//   node scripts/seed-whitemarch-districts.js --print    # same as --dry but also dumps merged JSON
//   node scripts/seed-whitemarch-districts.js --apply    # write to Supabase (requires env vars below)
//
// Environment for --apply:
//   SUPABASE_URL=...
//   SUPABASE_SERVICE_KEY=...    # service-role key, NOT the publishable key
//
// The script:
//   1. Imports every district-*.js in src/data/whitemarch-districts/.
//   2. Verifies each module's TILES keys all fall inside its BOUNDING_BOX.
//   3. Detects collisions between modules (two modules writing the same coord).
//   4. Pulls the live row from Supabase, overlays the per-module TILES
//      (REPLACE), appends each module's STRUCTURES, computes the union of
//      SERVICES required.
//   5. In --dry: reports stats + any service ids not yet in town.js BUILDINGS.
//   6. In --apply: writes back to the row in a single UPDATE.
//
// Implementation note: this is a one-shot bootstrap. Once applied, the
// modules in src/data/whitemarch-districts/ stay in git as the audit
// trail of what was added; subsequent edits flow through the MapEditor
// at #/edit which writes Supabase directly.

import { readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const DISTRICTS_DIR = join(__dirname, "..", "src", "data", "whitemarch-districts");

const MODE = process.argv.includes("--apply") ? "apply"
           : process.argv.includes("--print") ? "print"
           : "dry";

async function loadDistricts() {
  const files = readdirSync(DISTRICTS_DIR)
    .filter((f) => /^district-.+\.js$/.test(f))
    .sort();
  const districts = [];
  for (const f of files) {
    const url = pathToFileURL(join(DISTRICTS_DIR, f)).href;
    const mod = await import(url);
    districts.push({ file: f, ...mod });
  }
  return districts;
}

function validateBox(d) {
  const errors = [];
  const { xmin, xmax, ymin, ymax } = d.BOUNDING_BOX || {};
  if ([xmin, xmax, ymin, ymax].some((v) => typeof v !== "number")) {
    errors.push(`${d.file}: BOUNDING_BOX missing or malformed`);
    return errors;
  }
  for (const key of Object.keys(d.TILES || {})) {
    const [xs, ys] = key.split(",");
    const x = Number(xs), y = Number(ys);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      errors.push(`${d.file}: tile key "${key}" is not a coordinate`);
      continue;
    }
    if (x < xmin || x > xmax || y < ymin || y > ymax) {
      errors.push(`${d.file}: tile (${x},${y}) is outside its BOUNDING_BOX (${xmin}..${xmax}, ${ymin}..${ymax})`);
    }
  }
  return errors;
}

function detectCollisions(districts) {
  const seen = new Map();   // coord -> first owner
  const collisions = [];
  for (const d of districts) {
    for (const key of Object.keys(d.TILES || {})) {
      if (seen.has(key)) {
        collisions.push(`coord ${key} written by both ${seen.get(key)} and ${d.file}`);
      } else {
        seen.set(key, d.file);
      }
    }
  }
  return collisions;
}

async function readLiveRow() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL + SUPABASE_SERVICE_KEY required");
  const res = await fetch(`${url}/rest/v1/handcrafted_map?id=eq.whitemarch&select=tiles,sealed_structures`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Read failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  if (!rows[0]) throw new Error("Row not found");
  return rows[0];
}

async function writeLiveRow({ tiles, sealed_structures }) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const res = await fetch(`${url}/rest/v1/handcrafted_map?id=eq.whitemarch`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ tiles, sealed_structures }),
  });
  if (!res.ok) throw new Error(`Write failed: ${res.status} ${await res.text()}`);
}

function mergeServices(districts) {
  const set = new Set();
  for (const d of districts) for (const s of (d.SERVICES || [])) set.add(s);
  return [...set].sort();
}

async function main() {
  console.error(`[seed] loading districts from ${DISTRICTS_DIR}`);
  const districts = await loadDistricts();
  console.error(`[seed] ${districts.length} district module(s) loaded: ${districts.map((d) => d.DISTRICT_ID || d.file).join(", ")}`);

  // 1. Box validation.
  const boxErrors = districts.flatMap(validateBox);
  if (boxErrors.length) {
    console.error(`[seed] BOX VIOLATIONS (${boxErrors.length}):`);
    for (const e of boxErrors) console.error("  - " + e);
    process.exit(2);
  }

  // 2. Collisions.
  const collisions = detectCollisions(districts);
  if (collisions.length) {
    console.error(`[seed] TILE COLLISIONS (${collisions.length}):`);
    for (const c of collisions) console.error("  - " + c);
    process.exit(2);
  }

  // 3. Stats.
  let totalTiles = 0, totalStructures = 0;
  for (const d of districts) {
    const t = Object.keys(d.TILES || {}).length;
    const s = (d.STRUCTURES || []).length;
    totalTiles += t;
    totalStructures += s;
    console.error(`[seed]   ${d.DISTRICT_ID || d.file}: ${t} tile(s), ${s} structure(s), ${(d.SERVICES || []).length} service(s)`);
  }
  console.error(`[seed] totals: ${totalTiles} tile keys, ${totalStructures} structures, ${districts.length} modules`);

  // 4. Service audit (read town.js best-effort).
  const services = mergeServices(districts);
  try {
    const townUrl = pathToFileURL(join(__dirname, "..", "src", "data", "town.js")).href;
    const town = await import(townUrl);
    const existing = new Set(Object.keys(town.BUILDINGS || {}));
    const missing = services.filter((s) => !existing.has(s));
    if (missing.length) {
      console.error(`[seed] SERVICES referenced but NOT in town.js BUILDINGS (Wave 3 S1 adds these): ${missing.join(", ")}`);
    } else if (services.length) {
      console.error(`[seed] all ${services.length} declared service(s) already exist in BUILDINGS`);
    }
  } catch (e) {
    console.error(`[seed] WARN: could not audit town.js BUILDINGS (${e.message})`);
  }

  if (MODE === "dry") {
    console.error(`[seed] dry-run OK. Use --apply to write.`);
    return;
  }

  // 5. Apply.
  const live = await readLiveRow();
  const mergedTiles = { ...live.tiles };
  for (const d of districts) for (const [k, v] of Object.entries(d.TILES || {})) mergedTiles[k] = v;
  const mergedStructures = [...(live.sealed_structures || [])];
  for (const d of districts) for (const s of (d.STRUCTURES || [])) mergedStructures.push(s);

  if (MODE === "print") {
    console.log(JSON.stringify({ tiles: mergedTiles, sealed_structures: mergedStructures }, null, 2));
    return;
  }

  // apply
  console.error(`[seed] writing ${Object.keys(mergedTiles).length} tiles + ${mergedStructures.length} structures to Supabase ...`);
  await writeLiveRow({ tiles: mergedTiles, sealed_structures: mergedStructures });
  console.error(`[seed] applied.`);
}

main().catch((e) => {
  console.error(`[seed] FATAL: ${e.message}`);
  console.error(e.stack);
  process.exit(1);
});
