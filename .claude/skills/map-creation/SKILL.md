---
name: map-creation
description: Author and edit the Whitemarch handcrafted hex map — towns, dungeons, fortresses, city districts, multi-tile structures, the doors access graph, and sealed_structures. Use when the user wants to add or change places on the map, build a new structure/POI footprint, lay out a settlement, wire doors/gates, or extend the world's geography. Covers the pointy-top axial coordinate system, the tile/POI schema, terrain types, sizing/layout rules, the door graph, the build pipeline, and the Supabase storage workflow.
---

# Map creation

Author places on the Whitemarch hex map. The map is a Supabase row
(`public.handcrafted_map`, `id='whitemarch'`): `tiles` (`"x,y" → tile`) +
`sealed_structures` (array). The engine reads it via `getTile()` and runs
`buildHandcrafted()` to compute the effective door graph.

**Before authoring, read the repo's `docs/WORLDBUILDING.md`** — it is the source
of the rulings this skill summarizes. After authoring, run the **`map-audit`
skill** to verify the result, and follow the **`worldbuilding` skill** for the
lore/region side.

## Coordinate system (get this right first)

Pointy-top hex, **axial** coords: `x = q` (east +), `y = r` (south +). The six
neighbours of `(x,y)` are:

```
(x+1, y)   (x+1, y-1)   (x, y-1)   (x-1, y)   (x-1, y+1)   (x, y+1)
  E           NE           NW          W          SW           SE
```

Hex distance = `(|dx| + |dy| + |dx+dy|) / 2`. A door may only join hexes at
distance 1. One hex ≈ 250 m of ground. The player starts at `(0,0)`.

## Tile precedence (what wins at a coord)

`getTile` resolves in order: the player's visited snapshot → **`HANDCRAFTED`
(this map, wins over everything below)** → rivers → rumored → fabled →
procedural noise. So to author anything, put it in the handcrafted `tiles`.

## The tile & POI schema

```js
"12,-4": {
  terrain: "settlement",          // see terrain table below
  poi: {
    type: "market",               // icon/mood hint; arbitrary string ok
    name: "Grain Square",         // tile's own name
    service: "grain-factor",      // optional: wires a shop/service (data/town.js BUILDINGS)
    access: "public",             // public | guarded | conditional | restricted | hidden
    parent: "whitemarch-grand-market",   // footprint slug shared by all member hexes
    parentName: "The Grand Market",      // footprint display name (identical across members)
    part: "grain-square",         // this hex's unique sub-area slug
    partName: "Grain Square",     // sub-area display name
    area: "whitemarch",           // larger city/region (NOT for footprints)
    district: "grand-market",     // broad city organization
    description: "…",
  },
  doors: [{ x: 12, y: -5 }, …],   // access graph; omit for default-open wilderness
  wallside: true,                 // optional layout hints used by the pipeline/editor
}
```

Use `parent`/`part` **only** for a real shared POI footprint (a building/market/
gate that occupies several adjacent hexes). Use `district`/`area` for loose city
organization. See `reference/tile-schema.md` for the full field list, the POI
`type` vocabulary, and access semantics.

## Terrain types (and travel speed — lower = faster)

`indoor 1.0` · `settlement 0.7` · `street 0.4` · `road 0.7` · `wall 0.5` ·
`plains 1.0` · `hills 1.4` · `forest 1.5` · `marsh 1.8` · `mountains 2.5` ·
`water 999 (impassable)`. `street` is cheapest so A* routes along city lanes;
`indoor` is dark. Walls are walkable along their length once you reach them via
a stair/gatehouse and the door graph allows it.

## Ruling 1 — one hex is one vantage

A common room, a yard, a stable are **separate tiles**. Don't pack multiple
navigable places into one tile's prose.

## Ruling 2 — sprawl major structures

Dungeons/fortresses/dens/major shrines are **clusters** the player walks room by
room. Sizing guide:

| Structure | Tiles |
|---|---:|
| roadside shrine, charcoal camp | 1 |
| watchpost, ferry, mill | 2–4 |
| village | 5–9 |
| goblin den, hillfort ruin, hermit's tower, manor | 5–12 |
| walled town | 10–20 |
| walled city (Whitemarch) | 20–30 |
| great fortress / legendary stronghold | 15–30+, nested wards |

**Layout pattern:** *threshold* hex (the named, reputation-visible gate/mouth) →
*outer ring* (courtyards/baileys, mostly `settlement`) → *inner ring* (halls/
chambers, mostly `indoor`) → *centre* (throne/hoard/sanctum, `indoor`).
Sentries/traps/gatekeepers at the outer ring. **The boss is never at the
threshold.**

## Ruling 7 — seal interiors with `doors`

Every interior hex of a sealed structure must declare the neighbours it can be
entered from. An interior tile **without** `doors` is a bug — the player walks in
from open wilderness. Omitting `doors` means *all six neighbours open* (correct
only for wilderness and open settlement). The engine requires **both** ends of an
edge to permit it (`edgeAllowed`), so a wall holds even if you only seal one
side — but always author both sides. The sanctum/boss tile gets a single door
back to its antechamber.

You can set per-tile `doors` directly, **or** declare a `sealed_structures` entry
and let the pipeline compute them. See `reference/doors-and-structures.md` for
the door rules, the three sealed-structure authoring shapes, the wall auto-seal
behaviour, and a worked example.

## Authoring workflow

1. **Plan the footprint** on paper-coords: pick the threshold hex (the one that
   will be reputation-visible), the outer ring, the inner ring, the centre.
   Stay within a bounding box; don't collide with existing named POIs.
2. **Write the tiles** — terrain + poi for each hex, sharing `parent`/`parentName`
   across the footprint, each with a distinct `part`/`partName`.
3. **Wire access** — either author each tile's `doors`, or add a
   `sealed_structures` entry (streets+buildings, interior+gates, or links) and
   let `buildHandcrafted` derive them. Put the gate's *inside* hex in the
   footprint and pair it `[inside, outside]` with the exterior approach.
4. **Verify** — dump `{tiles, sealed_structures}` and run the `map-audit` skill's
   `audit-map.mjs`. Fix every ERROR (no-doors, unreachable, non-adjacent door,
   no-entrance) and re-run until clean. Then `npm run build` (the build is
   sensitive to data shape).
5. **Write back to Supabase** — via the in-game editor at `#/edit` (writes the
   row directly, RLS-gated to the owner) or the Supabase MCP. See
   `reference/supabase-workflow.md` for the storage model, the optimistic-
   concurrency `STALE_MAP` gotcha, and the district authoring-package format.

## References

- `reference/tile-schema.md` — full tile/POI schema, terrain table, POI types, access.
- `reference/doors-and-structures.md` — door graph, the 3 sealed-structure shapes, wall auto-seal, worked example.
- `reference/supabase-workflow.md` — storage model, MCP read/write, MapEditor, district packages, optimistic concurrency.
- `../map-audit/` — verify what you author. `../worldbuilding/` — regions, biomes, factions, tone.
