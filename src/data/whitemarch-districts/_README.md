# Whitemarch District Authoring Packages

Each `district-*.js` module in this directory is one parallel-authored
contribution to the Whitemarch content expansion. The shape is uniform —
the seed script at `scripts/seed-whitemarch-districts.js` imports every
file, merges the contributions, and applies them to Supabase row
`public.handcrafted_map` id=`whitemarch`.

## Module exports (every file)

```js
export const DISTRICT_ID = "noble-rise";          // slug for logging
export const DISTRICT_NAME = "Noble Rise";         // human label
export const BOUNDING_BOX = { xmin, xmax, ymin, ymax };
export const TILES = {                             // ADD or REPLACE
  "x,y": { terrain, poi?, doors? },
  ...
};
export const STRUCTURES = [                        // sealed_structures entries
  { name, ... },
  ...
];
export const SERVICES = [                          // BUILDINGS keys this file references
  "service-id-1",
  ...
];
```

Anything in `TILES` REPLACES the existing tile at that coordinate in the
Supabase row. Anything in `STRUCTURES` is APPENDED to the existing
sealed_structures array. Anything in `SERVICES` is collected for Wave 3
S1's town.js BUILDINGS audit.

## Authoring rules

1. Stay inside your `BOUNDING_BOX`. The seed script rejects out-of-box keys.
2. Do NOT overwrite a named POI you didn't author (Chain Market Steps,
   Citadel, Grand Market, Crown Gate, etc.). Read the existing tile data
   embedded in your agent prompt; rewrite only unnamed streets, single-tile
   POIs you're expanding, or freshly-introduced tiles.
3. When you replace a tile, you OWN its full new shape — terrain, poi,
   doors. The pipeline auto-seals walls, but interior/settlement/street
   tiles need explicit doors lists for the door-graph to work.
4. New walls go in only with doors `undefined` (autoSeal computes). To
   author a gate (Noble Gate, etc.), place a non-wall hex (`terrain:
   "indoor"` or `"settlement"`, `poi.type: "gate"`) with explicit doors
   pointing through the wall ring.
5. Declare every `poi.service` id you reference in `SERVICES`. If the id
   is not already in `src/data/town.js` BUILDINGS, Wave 3 S1 will add it.

## Conventions

- Tile schema: `{ terrain, poi: {type, service?, name?, area?, parent?,
  parentName?, part?, partName?, access?, description?}, doors?: [{x,y}],
  wallside? }`.
- Multi-hex footprints: every member tile carries the same `parent` slug
  and `parentName`, with each tile getting a distinct `part` /
  `partName`. The Chain Market Steps and Grand Market are good
  references.
- Access values: `"public"`, `"guarded"`, `"conditional"`, `"restricted"`,
  `"hidden"`.
- POI types in use: `plaza, hall, market, stair, gate, combat, barracks,
  dock, yard, court, prison, smithy, temple, town, river, sewer,
  slavemarket, hidden, site, bldg, asylum`.

## Regeneration & rendering (round-trip)

The `district-*.js` files in this directory are now **auto-generated** from
the live `handcrafted_map` row and kept in sync with it (the earlier
hand-authored modules drifted to ~12% overlap and are kept under
`_archived-stale-preresync-*/` for lore/history).

- **Resync git from the DB:** `node scripts/whitemarch-export-districts.mjs
  --from-db --out src/data/whitemarch-districts` (or `--in <snapshot.json>`).
  It partitions tiles by `poi.parentName` (unparented → `_core`), verifies a
  byte-exact round-trip, and rewrites every module plus `_MANIFEST.md`.
- **Visualize:** `node scripts/whitemarch-ascii.mjs --from-db --no-water`
  renders the map (or `--ward <name>` / `--region x0,x1,y0,y1`) as
  screen-space ASCII with a N/E compass — the same projection MapView uses.
- **Push edits back:** edit a module (or the MapEditor) then
  `node scripts/seed-whitemarch-districts.js --dry` to validate and
  `--apply` to write. Because the files are a faithful partition,
  re-applying an unchanged export is a no-op.

`_MANIFEST.md` lists every ward with its tile count and bounding box.

