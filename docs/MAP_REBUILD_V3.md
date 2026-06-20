# World map rebuild — v3 (two-scale)

Status: **groundwork landing.** This is the agreed architecture for the world-map
overhaul. It replaces the single all-hex world (where an entire walled city was
authored as ~921 handcrafted hexes with a hand-meshed door graph, sealed
structures, footprints, a compile pipeline, and a Supabase blob ↔ relational
dual model) with a **two-scale model**.

## Why

The renderer (`MapView`) and the systemic geography (`data/biomes.js`,
`factions.js`, `regions.js`, `spawn-tables.js`) were never the problem — they're
clean and good. The pain came from one decision: **representing dense interior
space (a city) at the same hex scale and on the same grid as wilderness travel.**
That single choice spawned the door graph, the sealed-structure compiler, the
wall auto-seal, per-hex footprint metadata, the editable-but-huge Supabase blob,
the brittle single-row optimistic lock, the blob→relational v2 migration, 15 live
+ 19 archived district snapshot files, and ~10 offline map scripts. 27% of all
repo commits touched this subsystem.

## The model

Two scales, each doing what it's good at:

### 1. World scale — the hex map (kept)
Wilderness travel, roads, rivers, distance, biomes, encounters, region
difficulty. Broad outdoor vantages (~250 m/hex). The existing isometric renderer
and `getTile` precedence stay. **Hybrid rule:** minor POIs remain single world
hexes; only *large* places (a capital, a major dungeon/fortress) become a place
(scale 2). A world hex that is the mouth of a place carries `poi.place = "<id>"`.

**Travel rework (go-anywhere march):** you pick a destination *anywhere* (seen or
not). The party marches one hex at a time toward it along a terrain-aware line.
Each hex advances time and rolls an encounter (random) and checks for scripted
ones. Travel **halts** the instant an encounter fires — or on arrival. No more
"must have seen it first" and no 6-hex leg cap; the world is crossable but never
skippable, because every hex is a die-roll against the wilds. See
`engine/world.js hexLineToward` + `App handleTravel`.

### 2. Place scale — node graphs (new)
A city/dungeon/fortress is a **graph of nodes** (vantages/rooms), authored as a
plain data file (`src/data/places/*.js`). A node declares its `exits` by id —
**no coordinates, no door geometry, no compile pipeline, no auditor.** Authoring
is `{ id, name, district, type, terrain, access, service, description, exits }`.
Exits are symmetrised on load, so you author each link once. This is the entire
maintenance win: places are small, declarative, diffable, and trivial to extend.

Moving inside a place is **tap-an-exit** (node → node), cheap in time, no A* over
a fiddly graph. A node with `service` wires the exact same `data/town.js`
BUILDINGS path the world tiles use (trader/tavern/smith/gaol/…). A node flagged
`worldExit` steps you back out onto the world hex the place sits on.

## Live-editability (kept)

Per the design decision, authored content stays **live-editable**. World hexes
keep the Supabase `handcrafted_map` model. Places ship as version-controlled data
(the bundled default — so the game and the "paste `dist/index.html` into a Claude
artifact" flow both work with zero DB dependency) **and** accept a live overlay
from Supabase when present, mirroring the map's hydrate/save pattern. A
place-aware editor is a follow-up.

## State shape

`state.world.place` is the scale switch:
- absent / `null` → the party is on the **world hex map** at `world.currentTile`.
- `{ id, node }` → the party is **inside place `id` at node `node`**;
  `world.currentTile` still holds the world hex the place sits on, so leaving
  returns there.

The rest of the engine consumes a **standing tile** — `getTile(state, x, y)` on
the world map, or a synthetic tile built from the current node inside a place
(`engine/place.js nodeTile`). Because the synthetic tile carries the same
`{ terrain, poi:{ name, type, service, access, parent, district, … } }` shape,
the narrator context, location naming, and service wiring all work unchanged.

## What this supersedes (removal is staged, after the new path is proven)

- `data/handcrafted-pipeline.js` (sealed-structure compiler + wall auto-seal) —
  interiors are node graphs now, so the door graph is no longer load-bearing for
  cities. Kept for now; retire once no world hexes rely on it.
- `data/whitemarch-districts/*` snapshots + the seed/export/parity scripts.
- The blob→relational v2 tables (`map_cell/map_place/map_edge/map_prose/
  map_compiled`) and the compile trigger.
- The dense hex Whitemarch in the Supabase row (the capital is a place now).

## Seed content

The first test slice is **Whitemarch rebuilt as a node-graph place**
(`data/places/whitemarch.js`): the Crown Gate, the Grand Market, the Low Wards,
the River Docks (the Whitewend), the Chain Ward, the Guild Court, the Citadel,
and the Caravanserai — each a cluster of nodes with the canon services wired in.
The player starts inside it.

## Roadmap

1. ✅ Place subsystem (`data/places`, `engine/place.js`) + node-graph Whitemarch.
2. ✅ `PlaceView` renderer + App mounts it inside a place.
3. ✅ World-travel rework (go-anywhere march, halt-on-encounter).
4. ✅ Narrator/location/service integration through the standing tile.
5. ⬜ Place-aware live editor (replace `#/edit`'s city tooling).
6. ⬜ Retire the pipeline, district snapshots, v2 tables, and the dense hex city.
7. ⬜ In-place encounters/danger as a first-class roll (currently narrator-paced).
