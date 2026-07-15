---
name: map-creation
description: Design and edit Solitaire region-atlas locations and node-graph places using the canonical two-scale, browser-native map model. Use for routes, settlements, dungeons, districts, rooms, exits, access rules, services, encounter links, and map-content validation.
---

# Map creation

Read `docs/MAP_REBUILD_V3.md`, `docs/WORLDBUILDING.md`, and
`docs/architecture/runtime.md` before changing map content.

## Model

- Region scale owns travel, terrain, weather, routes, supplies, and encounter
  checks.
- Place scale owns meaningful locations connected by explicit exits.
- Combat opens the deck encounter; it is not a mandatory tactical grid.
- Stable ids and serializable data own location truth. Rendered geometry,
  database rows, and generated prose do not.

Do not add new content to the retired dense-city-hex, sealed-structure, door
compiler, blob/relational dual-map, iframe, or Godot workflows.

## Workflow

1. Identify the region and whether the location belongs on the atlas or inside a
   place graph.
2. Choose stable ids before display names or artwork.
3. Define exits, access, services, encounters, description keys, and world-return
   links with existing references where possible.
4. Check the location against regional material culture and travel scale.
5. Validate references, reachability, required exits, and save migration impact.
6. Verify that every selectable location remains available through accessible
   browser controls, independent of visual rendering.
7. Run relevant tests and `npm run build`.

If production code does not yet expose the canonical schema, stop and describe
the missing adapter instead of extending a retired authoring pipeline.

See `reference/place-schema.md` for the target content shape.
