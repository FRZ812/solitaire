# Map And Exploration Rework Notes

The current hex map is useful for wilderness travel, regional distance, sight,
encounter risk, rivers, roads, and broad geography. It is less successful at
representing expressive locations: large markets, castles, city walls, dense
districts, interiors, alleys, courtyards, and structures whose meaningful shape
does not fit a single outdoor hex.

This document records the design concern before implementation begins.

## Current Constraint

The current world model treats the map as one axial hex grid. A tile can have:

- terrain
- a `poi`
- a `doors` list for allowed neighboring hexes
- sight and visited state
- travel cost

This works well for roads, fields, forests, rivers, and scattered landmarks. It
strains when a "place" should have internal scale or a different spatial logic.

Examples:

- A grand market should not be one icon on one hex. It should sprawl across
  several connected vantages: grain square, butcher rows, cloth awnings, night
  alleys, wells, watch post.
- A castle should not have to pretend every room is a 250-meter outdoor hex.
- A city wall should not be modeled only by blocked hex edges if the player
  should experience gates, towers, wall walks, sally ports, stairs, and breach
  points.
- A single building does not always deserve one whole world hex, but a dense
  block of buildings may deserve many local exploration nodes.
- Cramming everything into one grid makes locations feel either too small or too
  spatially inflated.

## Near-Term Rule: Major POIs Use Footprints

Before a deeper mechanics rewrite, major POIs should occupy multiple handcrafted
hexes. The important shift is vocabulary:

- A `poi` is not always a single tile.
- A major place has a **footprint**.
- Each tile in that footprint is a **vantage** within the place.
- The landmark name may refer to the whole footprint, while individual tile
  names refer to subareas.

Examples:

- Grand Market: 4-6 tiles.
- Chain Market: 3-5 tiles.
- Crown Gate complex: 3-5 tiles.
- Castle/citadel: 10-25 tiles.
- Great cathedral: 5-12 tiles.
- Docks: 5-10 tiles.
- Sewers/underworks: separate connected submap or 5-20 local nodes.

This avoids shrinking important places into one tile while staying compatible
with the current engine.

## Footprinted POIs, Not Menus Inside A Tile

The clarified rule: a sectioned building is not a world tile with a little
submenu inside it. If a building, compound, market, gate, or other POI has
meaningful internal parts, those parts should occupy real adjacent hexes on the
map. The map should literally say: these several hexes are the same building or
POI.

Use `parent` only for that actual shared POI footprint. Do not use `parent` for
loose city districts or whole settlement clusters. Districts belong in
`district`; cities/regions belong in `area`.

### Merged Hexes

A merged hex is not literally one larger mathematical hex. It is a footprint:
several normal hexes that the map outlines, labels, and treats as parts of one
place. The player still stands on a specific hex, but every member hex is a
named part of the same POI.

Example:

- Area: The Grand Market
- Member hexes: Grain Square, Butchers' Row, Cloth Awnings, Coin Scales, Night
  Market

Use merged footprints for:

- large markets
- docks
- castle grounds
- citadel wards
- graveyards
- large temples
- noble estates
- large camps
- battlefield ruins

This lets important places sprawl without hiding the spatial logic in a modal or
button row.

### Building Footprints

Any building or compound with multiple rooms, floors, service counters, cells,
work areas, or an attached yard should become a footprint by default. Each member
hex gets a `part` / `partName` and a description of what that part does.

Use building footprints for:

- inns
- shops
- gatehouses
- towers
- prisons
- warehouses
- ships
- shrines
- small keeps
- individual noble houses
- sewer chambers

The member hexes do not need to represent every closet. They should represent
the parts of the building that change what the player can do, who can see them,
what authority applies, and what risks follow.

Required footprint part candidates:

- public-facing rooms: common rooms, counters, toll halls, petition desks
- controlled work areas: kitchens, workshops, counting rooms, tack rooms
- watched or violent thresholds: guard rooms, intake desks, holding cells
- vertical routes: wall stairs, lofts, roof access, cellar doors
- hidden/restricted routes: archive doors, sewer grates, private yards
- attached yards: stable yards, work yards, holding yards, wagon yards, courts

Only keep a building as one hex for disposable huts, flavor-only stalls,
ordinary single-room houses, and shrines that truly function as one room. Mark
such exceptions explicitly in data with `singleRoom: true` once they matter.

Movement between member hexes can remain ordinary map movement for now. Later it
may get local movement timing, guard response, stealth pressure, light,
pursuit, or lock rules.

### Combined Model

A large place can use both:

1. **World hex:** Whitemarch, Crown Gate Ward.
2. **POI footprint:** Crown Gate Complex.
3. **Member hex:** Toll Hall, Inspection Yard, Guard Room, Wall Stair.
4. **Future local map:** only if a footprint later needs finer-than-hex detail.

That model avoids two bad extremes:

- every building becomes a whole regional hex;
- every large district becomes a single icon with no spatial life.

The map should render footprint outlines, shared labels, and member-hex labels
first. A future local-map mode is optional and should not replace the footprint
when the footprint itself is important to navigation.

## Footprint Metadata Proposal

Future handcrafted tiles may need shared footprint metadata:

```js
{
  terrain: "settlement",
  poi: {
    type: "market",
    name: "The Grand Market",
    part: "grain-square",
    partName: "Grain Square",
    area: "whitemarch",
    areaName: "Whitemarch",
    parent: "whitemarch-grand-market",
    parentName: "The Grand Market",
    district: "grand-market",
    role: "grain-square",
    description: "..."
  }
}
```

Useful fields:

- `parent`: stable id of the larger POI.
- `parentName`: display name of the larger POI.
- `area` / `areaName`: larger city or region containing the footprint.
- `district`: district id.
- `part` / `partName`: the member hex inside the shared POI.
- `access`: public, guarded, restricted, hidden, sealed.
- `interior`: true/false if it should behave as an interior.
- `localMap`: optional id for future local exploration map.

The UI should show:

- POI: "The Grand Market"
- Hex: "Grain Square"
- Area/District: "Whitemarch / Grand Market"

Example:

```js
{
  terrain: "settlement",
  poi: {
    type: "gate",
    name: "Crown Gate Complex",
    parent: "whitemarch-crown-gate",
    parentName: "Crown Gate Complex",
    part: "toll-hall",
    partName: "Toll Hall",
    district: "crown-gate-ward",
    access: "guarded",
    description: "A stone throat of chained ledgers, stamp blocks, and pikes."
  }
}
```

## Why `doors` Are Not Enough

The current `doors` system is useful and should not be discarded. It handles
blocked edges, sealed interiors, and route legality. But it is a low-level
movement permission tool, not a full location model.

`doors` can say:

- You cannot cross this wall edge.
- You can enter this hall only from this gate.
- This interior route connects to that one.

`doors` cannot comfortably express:

- A wall as a visible structure with towers, stairs, battlements, patrol routes,
  controlled gates, and breach options.
- A district with many small alleys where one world hex should contain several
  local choices.
- A castle where some rooms are meters apart while world hexes are hundreds of
  meters apart.
- A market crowd where navigation is social and local, not regional travel.
- A multi-floor building.

So `doors` remains useful for world-hex edges, but a richer exploration model
will likely need another layer.

## Proposed Long-Term Model: Two-Scale Exploration

Use two related map scales:

### 1. Regional Hex Map

Purpose:

- Wilderness travel.
- Roads and rivers.
- Inter-settlement distance.
- Weather and survival.
- Encounter risk.
- Strategic geography.
- Major POI footprints.

Scale:

- Hexes remain broad outdoor vantages, roughly current scale.

Good for:

- "Travel from the Drowned Inn to Whitemarch."
- "Take the north road toward the frost passes."
- "Skirt the marsh instead of following the causeway."

### 2. Local Exploration Map

Purpose:

- City districts.
- Large markets.
- Castles.
- Dungeons.
- Keeps.
- Ships.
- Sewers.
- Dense interiors.

Scale:

- Node graph, room graph, street graph, or small tactical map.
- Nodes do not need to represent equal physical distance.

Good for:

- "Move from the Grain Square to Butchers' Row."
- "Climb from the gatehouse to the wall walk."
- "Enter the keep's inner court."
- "Take the sewer tunnel under the Chain Ward."
- "Find the back stairs of a noble house."

## Local Map Shape

A local map can be a graph of vantages:

```js
{
  id: "whitemarch-grand-market",
  name: "The Grand Market",
  parentTile: { x: 12, y: -4 },
  nodes: {
    "grain-square": {
      name: "Grain Square",
      kind: "market",
      exits: ["butchers-row", "cloth-awnings", "market-watch-post"],
      description: "..."
    },
    "butchers-row": {
      name: "Butchers' Row",
      exits: ["grain-square", "night-market-alley"],
      description: "..."
    }
  }
}
```

This would let a castle, market, or wall have expressive geometry without
pretending each room is a regional hex.

## UI Direction

The map UI may eventually need mode switching:

- **World Map:** broad hex map, roads, regions, travel.
- **Local Map:** current POI/district/structure graph, rooms, alleys, gates,
  stairs, walls, and restricted routes.

When standing inside a major POI, the map panel could show:

- a city/district mini-map first,
- a "World" toggle to zoom back out,
- breadcrumbs like `Whitemarch > Grand Market > Grain Square`.

Before full local maps exist, the current map can still improve by showing:

- footprint outlines around hexes that share a `poi.parent`;
- POI, member-hex, area, and district text in the selected-tile panel;
- labels centered on multi-hex footprints rather than only on individual tiles.

The player should always know whether they are moving locally or traveling
regionally.

## City Wall Direction

Walls should become placeable map features, not only blocked edges.

Near-term:

- Use `doors` to block non-gate edges.
- Add wall/tower/gate/walk tiles as actual vantages.
- Render blocked edges as wall segments.
- Make gates explicit tiles with public or restricted access.

Long-term:

- Treat walls as district boundary geometry.
- Allow wall-walk local maps.
- Allow gates, towers, posterns, breaches, ladders, sewer entries, and sally
  ports as distinct access nodes.

## Whitemarch Implications

Whitemarch should not be implemented as one city icon plus shop buttons. It
should be a city footprint with district clusters.

Minimum footprint examples:

- Crown Gate complex: approach, toll hall, inspection yard, wall walk,
  dragon-watch tower.
- Grand Market: grain square, butchers' row, cloth awnings, coin scales/night
  market.
- Chain Ward: sale steps, viewing yard, registry hall, holding cells, drain gate.
- River Docks: high quay, customs house, warehouse row, smuggler stairs.
- Citadel: inner gate, muster court, council hall, hostage tower, war room.

This can be done in the current hex system first, then migrated into local maps
later if the engine changes.

## Implementation Phases

### Phase 1: Planning And Data Discipline

- Mark which POIs require multi-hex footprints.
- Stop treating "one named place" as "one tile."
- Add `parent`/`district` planning to tile docs.
- Redraft Whitemarch first-pass layout so the Grand Market and other major
  districts sprawl.

### Phase 2: Current-Engine Multi-Hex Footprints

- Implement Whitemarch as many handcrafted hexes.
- Use shared `parent` ids in POI metadata.
- Give each member hex a `part` / `partName`.
- Use `doors` only where access control matters.
- Use labels/icons carefully so multiple tiles can read as one larger place.

### Phase 3: UI Improvements For Footprints

- Show area/district/POI/member-hex names in the map detail panel.
- Add landmark outlines or district shading.
- Make major POIs visually read as clusters instead of isolated icons.
- Improve wall rendering so boundaries feel structural.
- Display member-hex labels for buildings with rooms, yards, counters, cells,
  and work areas.

### Phase 4: Local Exploration Layer

- Add local maps for huge/dense POIs.
- Let a world tile open into a local node graph.
- Track player position as either world coordinate or local node.
- Connect local exits back to world coordinates.
- Let narrator context include both world location and local sublocation.

## Open Questions

- Should local maps be graph-only, mini-grid, or SVG layouts?
- Should every district get a local map, or only dense structures?
- How does random encounter risk work inside local maps?
- How should time cost differ between local movement and regional travel?
- How should fog-of-war work inside cities and buildings?
- Can the same narrator beat handle local movement, or should local movement
  sometimes be instant/UI-only?
- How should scrying or character positions represent someone inside a local
  map?

## Current Recommendation

Do not rewrite the map engine before the central region is settled. First,
design Whitemarch as a multi-hex footprint under current rules. This will expose
which problems are content-layout problems and which are truly engine problems.

But plan the data with future local maps in mind: use parent ids, districts,
roles, access notes, and explicit subareas now so the migration path stays open.
