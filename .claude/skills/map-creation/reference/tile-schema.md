# Tile & POI schema

A tile is the value at `tiles["x,y"]` in `public.handcrafted_map`. Only `terrain`
is strictly required; everything else is optional.

```js
{
  terrain: "settlement",     // REQUIRED — id from data/terrains.js
  poi: { … } | null,         // the named feature on this hex (see below)
  doors: [{ x, y }, … ],     // access graph; OMIT for default-open (all 6 neighbours)
  wallside: true,            // hint: this hex sits against the city wall (editor/pipeline)
  perimeter: true,           // legacy wall-generator marker (generator is disabled; avoid)
  // runtime-only fields the engine writes; never author these:
  //   status  — narrator location consequence (emptied/razed/tense…)
  //   shop    — generated shop stock for the tile
}
```

## Terrain ids (data/terrains.js) — speed is travel cost, lower = faster

| id | speed | notes |
|---|---|---|
| `indoor` | 1.0 | a building's interior; **dark** |
| `settlement` | 0.7 | built ground — markets, yards, courts |
| `street` | 0.4 | paved city street; cheapest, so A* prefers it |
| `road` | 0.7 | old paving outside the wall |
| `wall` | 0.5 | mountable fortress wall; walkable along its length |
| `plains` | 1.0 | open grass |
| `hills` | 1.4 | rolling slopes |
| `forest` | 1.5 | dense wood; **dark** |
| `marsh` | 1.8 | wet ground; **dark** |
| `mountains` | 2.5 | stark stone; **dark** |
| `water` | 999 | **impassable** (deep water); the only impassable terrain |

There is no separate "impassable wall" terrain — non-mountable barriers come from
`water` or from the door graph refusing the edge. The old `desert` terrain and
the `wall_top` name are **gone** (`wall_top` auto-migrates to `wall`).

## POI object

```js
poi: {
  type: "market",        // icon/mood hint; engine accepts ANY string
  name: "Grain Square",  // this hex's own name (shown in the tile panel)
  service: "grain-factor",   // optional — wires a shop/service via data/town.js BUILDINGS
  access: "public",      // public | guarded | conditional | restricted | hidden
  description: "…",      // prose the narrator/tile panel uses

  // FOOTPRINT metadata — use ONLY for a real multi-hex shared POI:
  parent: "whitemarch-grand-market",  // stable slug shared by every member hex
  parentName: "The Grand Market",     // display name — identical across members
  part: "grain-square",               // THIS hex's unique sub-area slug
  partName: "Grain Square",           // sub-area display name

  // BROAD organization — not a footprint:
  area: "whitemarch",     areaName: "Whitemarch",   // larger city/region
  district: "grand-market",                          // district id
}
```

### `parent`/`part` vs `district`/`area`
- **`parent`** = one physical structure occupying several adjacent hexes (a gate
  complex, a market, a citadel ward, an inn with a yard). All member hexes share
  `parent` + `parentName`; each has its own `part` + `partName`.
- **`district`/`area`** = loose city/region grouping. A whole quarter is a
  district, not a parent. Do **not** use `parent` to lump unrelated buildings.

The map renders footprint outlines and shared labels from `parent`, and the
selected-tile panel shows POI / member-hex / area / district.

### `type` vocabulary in use
`plaza, hall, market, stair, gate, tower, barracks, dock, yard, court, prison,
smithy, temple, town, river, sewer, slavemarket, hidden, site, bldg, asylum,
throne_room, armoury, shrine, stable, warren, vault, cathedral, mint, palace,
dungeon, crypt`. New strings are fine; pick the closest existing one for icon
consistency.

### `access` semantics
`public` (anyone), `guarded` (watched threshold), `conditional` (needs a writ/
appointment), `restricted` (members/owners only), `hidden` (secret — not openly
visible). Access is narrative/permission flavour; the hard movement gate is
`doors`.

## Multi-hex footprint pattern (the important one)

A "place" with internal parts occupies **real adjacent hexes**, not a submenu.
Every member shares `parent`/`parentName`; each member is a `part`. Example —
the Caravanserai (`src/data/whitemarch-districts/district-caravanserai.js`) — a
12-POI walled compound where each hex (East Gate, Wagon Court, Customs
Back-Office, Bunkhouse I/II, Smith's Lean-To…) is one vantage with its own
`part`, sharing `parent: "whitemarch-caravanserai"`.

Keep a building single-hex only for disposable huts, flavour-only stalls,
ordinary one-room houses, and shrines that truly function as one room (mark
`singleRoom: true` if it matters). Anything with rooms, counters, cells, work
areas, or a yard should be a footprint.
