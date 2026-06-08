# World map data model v2 — relational

Status: **reads cut over to v2** (game boots from the relational model; blob
retained as the editor's write surface + backup). This document is the design for
replacing the single-JSONB-blob map with a normalized, relational model that is
legible, deduplicated, drift-proof, and partially updatable — keeping the runtime
engine unchanged.

**Proof:** `scripts/map-v2-parity.mjs` decompiles the live blob into the v2 layers,
compiles them back, and asserts equality — **0 terrain + 0 door-graph mismatches**:
921 cells, 21 places, prose extracted out of geometry, the whole door graph in
**190 gate + 18 cut** edges (vs 174 hand-meshed door lists in v1).

**The tables are live, seeded, and now read by the game.** Schema in
`supabase/migrations/20260607130000_map_v2_schema.sql` (relational layers) +
`20260608000000_map_v2_compile.sql` (lossless columns, the `compile_map_v2()` SQL
compiler, and the blob→`map_compiled` sync trigger); data in
`supabase/seed_map_v2.sql`. `hydrateMap()` reads `map_compiled` (the compiled
blob), with a fallback to the authored blob.

**Two parity gates:** `scripts/map-v2-db-parity.mjs` proves the relational
**door graph + terrain** reproduce the blob (0/0); `scripts/map-v2-compiled-parity.mjs`
proves the **whole compiled tile payload** reproduces it — 0 payload diffs, 0
door-*set* diffs, and running the real `buildHandcrafted` pipeline on either
source yields an identical 921-tile map. (Door element *order* differs on 63
tiles; it is semantically inert — `world.js hasDoorTo` reads doors as a set.)

> **Losslessness note.** The terrain+door parity that gated the seed did NOT
> cover the full tile payload. `material` (165), `wallside` (3), `poi.area` (268),
> `poi.partName` (311) and `poi.parentName` were never captured, and poi presence
> is three-way (object/explicit-null/absent). `20260608000000` adds first-class
> columns for all of these (+ `map_place.poi_anchor`) and `seed_map_v2.sql`
> backfills them from the blob — which is why the compiled parity is now exact.

### Remaining (write-path phase)
1. Move `MapEditor` writes to per-cell / per-place against the relational tables;
   add owner-scoped write RLS. Then flip the read source of truth fully onto the
   relational model.
2. Switch the sync so `map_compiled` is refreshed by `compile_map_v2()` on
   relational edits, and retire the blob→`map_compiled` mirror trigger.
3. Optional: **hierarchy-aware connectivity** (child-place cells connect to their
   parent's adjacent cells implicitly) to collapse much of the 190 gate edges.
4. Retire (or keep as a generated export) the monolithic blob.

Until step 1 lands, the blob remains the edit surface: the `trg_sync_map_compiled`
trigger mirrors any blob edit into `map_compiled` so reads never go stale.

### Place hierarchy (seeded)
Curated in `supabase/seed_map_v2.sql`. Every cell belongs to a place under
a top-level **Whitemarch** (city): the **City Core** district (87 controlled hexes),
**The Whitewend** (river, 336), **Whitemarch Walls** (22), the **Caravanserai /
Outer Works / Caravan Yard** compounds (51), **Noble Rise** estate (29), the
**Grand Market / Chain Market** (8), **Crown / Prison** gates, the **Citadel**, and
the **Low Wards** buildings (Leaning Tankard, Bonepicker's Chapel, Almshouse
Overflow).

## 1. Why the current model fights us

The map is one row, `public.handcrafted_map` id=`whitemarch`: a `tiles` JSONB
dict (`"x,y" → { terrain, poi{…10 fields + a prose paragraph}, doors:[…] }`) plus
a parallel `sealed_structures` JSONB array. Measured on the live row (921 tiles):

| Problem | Evidence |
|---|---|
| **Prose fused into geometry** | ~440 tiles inline a multi-sentence `description`; reading the map = reading 440 paragraphs with no spatial sense. |
| **Two sources of truth that drift** | 5 of 6 `sealed_structures` were stale; 2 were ghosts (0 tiles), the Caravanserai pointed at `x[-14..-9]` while its tiles live at `x[-28..-36]`. |
| **Doors over-specified & asymmetric** | doors stored as explicit bidirectional open-edge lists → 33 asymmetric edges; the loader must reconcile them. |
| **Footprint fields duplicated per hex** | `parent/parentName/area/district/access` repeated on every member tile. |
| **Opaque blob** | any edit rewrites all 921 tiles; one whole-map optimistic lock; no partial update, no spatial query, not diffable. |

## 2. Design principles

1. **Geometry, prose, and structure are separate layers.** Reading geometry must
   never drag in narrative text.
2. **One source of truth for membership.** A hex belongs to a place via a single
   foreign key — not a hex tag *and* a parallel array.
3. **Doors are implicit; store only the exceptions.** Adjacent cells in the same
   open area connect by default; a sealed place connects internally and seals its
   perimeter except gates. Store only **gates** (perimeter openings) and **cuts**
   (internal walls). Symmetry becomes structural — asymmetry is impossible.
4. **The runtime contract is unchanged.** The engine consumes an in-memory
   `"x,y" → { terrain, poi, doors }` dict (`HANDCRAFTED`, read by
   `world.js getTile()`). v2 changes only how that dict is *produced*, not its
   shape — so `world.js`, `beat.js`, `MapView`, etc. are untouched.

## 3. Schema (DDL sketch)

```sql
-- A named place: the city, a district, a building, a gate complex, a market,
-- a wall, a river. First-class and hierarchical.
create table map_place (
  id            text primary key,              -- 'whitemarch-caravanserai'
  name          text not null,                 -- 'The Caravanserai'
  kind          text not null,                 -- city|district|building|gate|market|wall|river|feature
  parent_place  text references map_place(id), -- caravanserai → whitemarch
  sealed        boolean not null default true, -- interior (perimeter-sealed) vs open
  access_default text default 'public',        -- public|guarded|conditional|restricted|hidden
  prose_id      text references map_prose(id), -- place-level description
  meta          jsonb default '{}'
);

-- One hex. The geometry layer. Membership lives HERE (single source of truth).
create table map_cell (
  x        integer not null,
  y        integer not null,
  terrain  text not null,                      -- data/terrains.js id
  place_id text references map_place(id),      -- null = open wilderness/road
  poi_type text,                               -- gate|hall|plaza|vault|… (icon/mood)
  name     text,                               -- the cell's own name (part)
  part     text,                               -- sub-area slug within the place
  service  text,                               -- shop/service id (data/town.js)
  access   text,                               -- overrides place access_default
  role     text,                               -- gate|threshold|sanctum|yard… (door-derivation hint)
  prose_id text references map_prose(id),
  flags    jsonb default '{}',                 -- wallside, vista, singleRoom…
  primary key (x, y)
);
create index on map_cell (place_id);

-- ONLY the door-graph exceptions. Default connectivity is computed; this table
-- holds gates (open across a boundary) and cuts (sealed internal edge).
create table map_edge (
  ax integer not null, ay integer not null,
  bx integer not null, by integer not null,    -- must be hex-adjacent
  kind text not null,                           -- 'gate' | 'cut'
  primary key (ax, ay, bx, by)
);

-- Narrative text, pulled OUT of geometry. Read by id, on demand.
create table map_prose (
  id   text primary key,
  body text not null
);

-- Runtime cache: the compiled "x,y" → {terrain,poi,doors} dict, refreshed by a
-- trigger when cells/places/edges/prose change. Lets boot stay a SINGLE fetch.
create table map_compiled (
  id         text primary key default 'whitemarch',
  tiles      jsonb not null,
  updated_at timestamptz not null default now()
);
```

Biomes, factions, regions, difficulty (the *lore/systemic* layer) stay in
`src/data/*.js` — they're already clean and don't belong in per-hex storage.

## 4. The compiler (DB-side or loader-side)

`compileMap()` turns the normalized tables into the `tiles` dict:

- **poi** = `{ type: poi_type, name, service, access: access ?? place.access_default,
  parent: place_id, parentName: place.name, part, district/area: from place chain,
  description: prose_id ? lookup : undefined }`.
- **doors** = derived, fully symmetric:
  1. start from adjacency within each `sealed` place → all internal neighbours open;
  2. apply `map_edge` `cut`s → remove those internal edges;
  3. apply `map_edge` `gate`s → open those boundary edges;
  4. open areas (`place_id is null` or `sealed=false`) stay default-open (omit `doors`).
- Runs as a Postgres function writing `map_compiled.tiles` on change (trigger), **or**
  client-side in `hydrateMap()`. Recommended: the trigger + `map_compiled` cache, so
  the runtime keeps doing exactly one row fetch (`select tiles from map_compiled`).

This is the same door logic as today's `handcrafted-pipeline.js`, just sourced
from the normalized model instead of hand-entered per-tile lists.

## 5. Runtime impact: ~none

`hydrateMap()` reads `map_compiled.tiles` (one fetch, same as today) → same
`HANDCRAFTED` dict → `world.js` unchanged. The optimistic-concurrency `STALE_MAP`
guard moves to `map_compiled.updated_at`. The "paste `dist/index.html` into a
Claude artifact" build still works (anon read of `map_compiled`).

## 6. Migration path (staged, parity-gated, reversible)

1. ✅ **Add tables + compiler.** No behaviour change; blob stayed authoritative.
2. ✅ **Decompile** the blob → seed `map_cell` (one row/tile), `map_place` (from
   `poi.parent` groups + standalone), `map_prose` (every `description`),
   `map_edge` (gates/cuts from the door graph), + the lossless payload backfill.
3. ✅ **Parity:** `map-v2-db-parity.mjs` (door graph + terrain) and
   `map-v2-compiled-parity.mjs` (whole tile payload, incl. the real pipeline) both
   green against the blob.
4. ✅ **Cut over** `hydrateMap` to `map_compiled` (revert-safe, blob fallback).
   Blob kept as the edit surface + backup, mirrored into `map_compiled` by trigger.
5. ⬜ **MapEditor** writes per-cell / per-place (partial updates) instead of the blob.
6. ⬜ **Retire** the monolithic `tiles` blob (or keep it as a generated export only).

Each step is independently shippable; the cutover is one block in `hydrateMap` and
reverts cleanly to the blob.

## 7. What this buys (problem → fix)

| v1 problem | v2 fix |
|---|---|
| wall-of-text reads | geometry is rows + `render-map.mjs`; prose in `map_prose`, read on demand |
| duplication | place fields stored once; cells carry a FK |
| structure/tile drift, ghosts | membership = `map_cell.place_id`; a place with no cells is just empty, never a ghost |
| asymmetric / bloated doors | doors implicit; store only gates + cuts; symmetric by construction |
| whole-blob rewrites & lock | per-cell / per-place updates; spatial SQL; indexed |
| not diffable | rows + migrations; PRs show real diffs |

## 8. Open questions for sign-off

- **Compile location:** Postgres trigger writing `map_compiled` (keeps boot at one
  fetch — recommended) vs. client-side compile in `hydrateMap` (simpler, slightly
  more boot work).
- **Prose:** `map_prose` table (queryable, in-DB) vs. version-controlled
  `prose/*.md` files referenced by id (git-diffable, but a second store). Recommend
  the table for now; it can export to files later.
- **Edge model:** store `cut`s + `gate`s (recommended — sparsest) vs. store every
  open `door` (closer to today, more rows).

The renderer (`render-map.mjs`) and auditor (`audit-map.mjs`) are the read/verify
harness for every step above and already work against either representation.
