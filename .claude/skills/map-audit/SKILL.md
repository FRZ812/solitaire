---
name: map-audit
description: Study, validate, and clean up the Whitemarch handcrafted map that lives in Supabase (public.handcrafted_map, id='whitemarch'). Use when the user wants to audit the map, find map bugs, do "map cleanup", check the door graph / sealed structures / biomes, or verify the map before/after editing tiles. Runs the same pipeline the game runs at boot and reports door-graph, reachability, terrain, footprint, and biome problems with exact coordinates.
---

# Map audit & cleanup

The live map is a single Supabase row — `public.handcrafted_map`, `id='whitemarch'` —
with two JSON columns: `tiles` (`"x,y" → { terrain, poi, doors, … }`) and
`sealed_structures` (an array). The game fetches it at boot (`hydrateMap()` in
`src/data/handcrafted-map.js`) and runs `buildHandcrafted()` (the pipeline in
`src/data/handcrafted-pipeline.js`) to produce the effective door graph. The
`src/data/whitemarch-districts/*.js` files are **authoring inputs only** — the
live row has diverged from them, so **always audit the live row, never the
district files**.

## The tools

**`render-map.mjs`** — read the map *spatially* instead of as prose. Renders an
ASCII hex grid (one glyph per terrain), a named-place index, per-structure
footprint summaries (flags ghosts), and a single labelled footprint. Use this
FIRST to understand a region; it replaces scrolling hundreds of inlined
descriptions.

```bash
node .claude/skills/map-audit/render-map.mjs --live                       # overview ASCII map
node .claude/skills/map-audit/render-map.mjs --live --crop -12 14 -14 14   # crop to a region
node .claude/skills/map-audit/render-map.mjs --live --structures           # footprints + entrances (flags ghosts)
node .claude/skills/map-audit/render-map.mjs --live --places               # named places grouped by footprint
node .claude/skills/map-audit/render-map.mjs --live --parent <slug>        # one building, each hex labelled
```

**`audit-map.mjs`** runs every engine invariant against a
`{ tiles, sealed_structures }` payload, using the repo's own pipeline + terrain
+ biome data so its verdict matches the running game. It exits non-zero if any
ERROR-severity finding exists.

```bash
# audit a JSON dump (what `select tiles, sealed_structures` returns)
node .claude/skills/map-audit/audit-map.mjs /tmp/map.json --biomes

# or read the live row directly over REST (uses VITE_SUPABASE_* from .env; read-only)
node .claude/skills/map-audit/audit-map.mjs --live --biomes

# machine-readable, or widen the per-finding coordinate list
node .claude/skills/map-audit/audit-map.mjs /tmp/map.json --json
node .claude/skills/map-audit/audit-map.mjs /tmp/map.json --max 100
```

See `reference/checks.md` for what each finding code means and **how to fix it**.

## Workflow — audit, then confirm, then write

This is the live game's map. Default to **non-destructive**: study, report, get a
go-ahead, then write the smallest targeted change.

1. **Fetch the live row via the Supabase MCP.** Prefer reading through the MCP
   (the user asked for it and it carries auth):
   ```sql
   select tiles, sealed_structures, updated_at
   from public.handcrafted_map where id = 'whitemarch';
   ```
   Save the result to a temp file (e.g. `/tmp/whitemarch-map.json`) shaped as
   `{ "tiles": {...}, "sealed_structures": [...] }`. The auditor tolerates the
   row being wrapped in an array or a `{ result: [...] }` envelope.

2. **Run the auditor** on the dump (`--biomes` to also static-check
   `src/data/biomes.js`). Read `reference/checks.md` and turn the output into a
   categorized report for the user: ERRORs (gameplay-breaking), WARNs (likely
   authoring slips), INFO (stats / things to confirm). Group by structure /
   district where it helps.

3. **Propose fixes and confirm before writing.** For each ERROR, state the
   concrete edit (which tile/coord, what `doors`/`terrain`/`poi` change). Do not
   write to Supabase until the user approves. Keep edits minimal — change only
   the offending tiles, preserve every named POI you didn't author (Crown Gate,
   Citadel, Grand Market, Chain Market Steps, etc.).

4. **Apply** the approved change via the MCP. You can patch just the changed
   keys, but `tiles` is one JSON column — read-modify-write the whole object:
   ```sql
   update public.handcrafted_map
   set tiles = $1::jsonb, sealed_structures = $2::jsonb
   where id = 'whitemarch';
   ```
   The row has an auto-touch trigger on `updated_at`; an MCP write **bumps it**,
   which makes any open game tab's next autosave throw `STALE_MAP` by design
   (optimistic concurrency, see `saveMap()`). Tell the user to **reload open
   tabs / the editor** after a write so they don't fight the new baseline.

5. **Re-audit the post-write dump** to prove the ERROR count dropped and nothing
   regressed. A clean run exits 0.

## What "clean" means

Zero ERRORs. Every interior/indoor tile has a `doors` graph (no wilderness
walk-in), every sealed structure is reachable from an entrance with no stranded
rooms, no door crosses more than one hex edge or points at a deleted tile, all
terrain ids are valid, and footprint `parent`/`part` metadata is consistent.
WARNs and INFO are for human judgement, not hard failures.

## Reference

- `reference/checks.md` — every finding code, why it matters, how to fix it, and
  the read/write SQL patterns for the live row.
- `../map-creation/` — the companion skill for *authoring* new tiles/structures
  (tile schema, doors graph, sealed-structure shapes). Cleanup that adds tiles
  should follow those rules.
- `docs/WORLDBUILDING.md` (repo root) — the canonical rulings the auditor encodes.
