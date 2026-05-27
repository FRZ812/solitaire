// One-off migration. Bakes the streets+buildings auto-application into
// per-tile doors so the Great Wall sealed structure can be dropped from
// the handcrafted_map row.
//
// After this runs:
//   - Authored street tiles carry the mesh-doors applyStreetBuildingDoors
//     would have set every load.
//   - Authored building tiles carry their resolved door list (explicit
//     `door`/`doors` if set, else inherited from tile.doors, else
//     adjacent listed streets).
//   - sealed_structures shrinks to just Citadel + Underworks.
//   - The wall generator + post-pass bridges + Citadel/Underworks
//     auto-applies still run on every load (those are dynamic).
//
// Usage: node scripts/bake-and-drop-streets-buildings.mjs <path-to-input-json> <path-to-output-sql>
//   input JSON is the raw row payload: [{ tiles: '{"…"}', sealed: '[…]' }]
//   output SQL is a single UPDATE statement to apply via Supabase MCP.

import fs from "node:fs";
import { buildHandcrafted } from "../src/data/handcrafted-pipeline.js";

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error("usage: node bake-and-drop-streets-buildings.mjs <in.json> <out.sql>");
  process.exit(1);
}

const raw = fs.readFileSync(inPath, "utf8");
// MCP wraps results as {"result":"Below is...<untrusted-data-XXX>\n[...]\n</untrusted-data-XXX>..."}.
// Extract the JSON array between the untrusted-data markers.
let inner;
try {
  const wrapper = JSON.parse(raw);
  if (typeof wrapper.result === "string") {
    // The wrapper text mentions <untrusted-data-XXX> twice — once in the
    // prose warning, once as the real opening tag of the data block. The
    // real one is followed immediately by a newline + `[` (the JSON
    // array). Match that specifically.
    const m = wrapper.result.match(/<untrusted-data-[^>]+>\s*(\[[\s\S]+?\])\s*<\/untrusted-data-[^>]+>/);
    inner = m ? m[1] : wrapper.result;
  } else {
    inner = raw;
  }
} catch {
  inner = raw;
}
const parsed = JSON.parse(inner);
const row = Array.isArray(parsed) ? parsed[0] : parsed;
const tiles = typeof row.tiles === "string" ? JSON.parse(row.tiles) : row.tiles;
const sealedStructures = typeof row.sealed === "string" ? JSON.parse(row.sealed) : row.sealed;

// Run the full pipeline to compute the door graph including streets+buildings.
const builtTiles = buildHandcrafted({ tiles, sealedStructures });

// Bake the door graph onto AUTHORED tiles only. Wall-generator-produced
// tiles (perimeter d=1 streets, plain wall_top hexes) stay regenerable —
// baking them would mean the wall ring couldn't shrink/grow when the
// city geometry changes.
const baked = {};
for (const [key, originalTile] of Object.entries(tiles)) {
  const built = builtTiles[key];
  if (!built) { baked[key] = originalTile; continue; }
  // Only copy across the resolved `doors`; preserve everything else
  // the author set on this tile (terrain, poi, wallside, etc.).
  if (Array.isArray(built.doors)) {
    baked[key] = { ...originalTile, doors: built.doors };
  } else {
    baked[key] = originalTile;
  }
}

// Drop the Great Wall sealed structure. Citadel + Underworks stay —
// they're still authored as link/mesh structures and aren't redundant
// with per-tile doors.
const newSealed = sealedStructures.filter((s) => !(s.streets || s.buildings));

const tilesSql = JSON.stringify(baked).replace(/'/g, "''");
const sealedSql = JSON.stringify(newSealed).replace(/'/g, "''");

const sql =
  `UPDATE public.handcrafted_map\n` +
  `SET tiles = '${tilesSql}'::jsonb,\n` +
  `    sealed_structures = '${sealedSql}'::jsonb,\n` +
  `    updated_at = now()\n` +
  `WHERE id = 'whitemarch';\n`;

fs.writeFileSync(outPath, sql);

const authoredCount = Object.keys(tiles).length;
const bakedCount = Object.keys(baked).filter((k) => Array.isArray(baked[k].doors)).length;
console.log(
  `Baked ${bakedCount}/${authoredCount} authored tiles. ` +
  `sealed_structures: ${sealedStructures.length} → ${newSealed.length}. ` +
  `SQL written to ${outPath}.`
);
