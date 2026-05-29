#!/usr/bin/env node
// One-shot consolidating UPDATE for the handcrafted_map row.
// Merges every district-*.js tile dict into the row's existing tiles,
// and REPLACES sealed_structures with a deduped (by name) array
// containing the 2 original entries (High Wall, Underworks) + every
// module's STRUCTURES entries, first-occurrence-wins.
//
// Use this when the row has been wiped/scrambled by stale-tab autosaves
// and you want to restore the full SAT-4 + SAT-5 state in one atomic
// UPDATE without leaving structure duplicates behind.

import { readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const DISTRICTS_DIR = join(__dirname, "..", "src", "data", "whitemarch-districts");

const files = readdirSync(DISTRICTS_DIR).filter((f) => /^district-.+\.js$/.test(f)).sort();

const mergedTiles = {};
const structuresByName = new Map();

// Seed sealed_structures with the two non-module entries that pre-existed
// the SAT work. Without these, the consolidating UPDATE would wipe them.
structuresByName.set("The High Wall (Citadel Ward)", {
  name: "The High Wall (Citadel Ward)",
  entry: { x: 0, y: 5 },
  links: [[{ x: 0, y: 5 }, { x: 0, y: 6 }]],
  outside: { x: 0, y: 4 },
});
structuresByName.set("The Underworks", {
  name: "The Underworks",
  gates: [[{ x: 3, y: 6 }, { x: 4, y: 5 }]],
  interior: [
    { x: 3, y: 6 }, { x: 3, y: 7 }, { x: 2, y: 7 },
    { x: 1, y: 8 }, { x: 2, y: 8 },
  ],
});

for (const f of files) {
  const mod = await import(pathToFileURL(join(DISTRICTS_DIR, f)).href);
  for (const [k, v] of Object.entries(mod.TILES || {})) mergedTiles[k] = v;
  for (const s of (mod.STRUCTURES || [])) {
    if (!structuresByName.has(s.name)) structuresByName.set(s.name, s);
  }
}

const structuresArr = [...structuresByName.values()];

console.error(`[consolidate] ${files.length} module(s), ${Object.keys(mergedTiles).length} tile keys, ${structuresArr.length} sealed_structures (deduped by name)`);

const tilesJson = JSON.stringify(mergedTiles);
const structJson = JSON.stringify(structuresArr);
console.error(`[consolidate] tiles payload: ${tilesJson.length} bytes; structures payload: ${structJson.length} bytes`);

const TAG = "$wmcons$";
console.log(`-- Whitemarch consolidating UPDATE`);
console.log(`-- Merges all district modules' tiles into the existing tiles JSONB`);
console.log(`-- and REPLACES sealed_structures with a deduped (by name) array.`);
console.log(``);
console.log(`update public.handcrafted_map`);
console.log(`set tiles = tiles || ${TAG}${tilesJson}${TAG}::jsonb,`);
console.log(`    sealed_structures = ${TAG}${structJson}${TAG}::jsonb`);
console.log(`where id = 'whitemarch';`);
