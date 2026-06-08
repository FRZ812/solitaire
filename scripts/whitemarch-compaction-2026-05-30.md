# Whitemarch map compaction + recentre (2026-05-30)

Reshaped the live `handcrafted_map` row (`id='whitemarch'`) in Supabase: the city
wards were sprawled across a large, mostly-empty coordinate span. This operation
**packs the wards into one compact blob, wraps them in a single continuous wall,
and recentres so the player-start tile sits at `0,0`** — without changing any
building, door target, river tile, or POI text.

Produced by `scripts/whitemarch-compact.py` (packing + morphological-close wall +
door rewrite + sealed-structure remap), then applied to the DB and verified by
re-reading the row and comparing per-tile hashes.

## Before → after

| | before | after |
|---|---|---|
| tiles | 921 | 836 |
| content (buildings) | 397 | **397 (preserved)** |
| wall | 187 | 102 (one ring) |
| water (river) | 337 | 337 (unchanged shape) |
| city bbox (screen W×H) | 62×65 | ~40×40 |
| doors | valid | 418, **0 broken** |
| `sealed_structures` | 6 | 2 |
| tile at `0,0` | *(empty)* | **Grain Square** (player start) |

## Notable decisions

- **Single iconic wall**: the wall is the outer shell of a morphological *closing*
  of the in-wall wards (gaps between wards filled into one hull). A few interior
  hexes between wards are intentionally left as open plazas.
- **Recentre anchor**: `0,0` is pinned to the Grand Market **Grain Square** tile so
  it matches `src/data/initial-state.js` `currentTile {0,0}` and the opening
  narration ("…and where you stand now"). In the *old* map `0,0` was an empty tile
  — the start was already misaligned; this fixes it.
- **`sealed_structures`**: the two functional *Outer Works* structures were remapped
  to the new coordinates. Four structures (The High Wall, The Underworks, The
  Caravanserai, Caravanserai Outer Ring) referenced tiles that no longer existed
  (already stale/inert) and were dropped — no functional change.
- Satellites (Outer Works, Caravanserai) and the river were kept as rigid clusters
  outside the wall.

## Verification (live DB after apply)

- tiles: 836 — per-tile top-hash `d16e3a1a6eb89da1c0d184f0a28b24c8`
- `sealed_structures` md5 `e579ec56ff3021c11a7aa37c28a2deac`

## Snapshots

Generated under `scripts/whitemarch-backups/` (gitignored per repo convention, so
NOT committed — and the cloud container is ephemeral):

- `whitemarch-PREcompact-20260530-235213.json` — `{tiles, sealed_structures}` before (revert source)
- `whitemarch-POSTcompact-20260530-235213.json` — `{tiles, sealed_structures}` after (== live)

The PRE snapshot was also sent to the repo owner directly so an exact revert
artifact survives off-container.

## To revert

**Exact** — write the PRE snapshot back to the row:

```sql
-- load whitemarch-PREcompact-20260530-235213.json as :pre
UPDATE handcrafted_map
SET tiles = :pre->'tiles', sealed_structures = :pre->'sealed_structures'
WHERE id = 'whitemarch';
```

**Approximate** — the old layout is also regenerable from the tracked
`src/data/whitemarch-districts/*.js` source files via the authoring pipeline
(may differ slightly from the exact pre-edit DB state).

## Known follow-ups (not done here)

- `src/data/handcrafted-pipeline.js` hard-codes `runGatehouseWallTopBridge(tiles,
  ["0,-5","1,-5"])`. Those coords no longer hit the Crown Gate gatehouse (now at
  `~6,-13`); the call safely no-ops. Re-point if the wall-walk-over-gate is wanted.
- NPC `home`/`at` coords (e.g. Halen `{0,4}`) are approximate lazy-drift anchors
  (`src/engine/positions.js`), not precise building pointers — left as-is.
- The `src/data/whitemarch-districts/*.js` **source** files still describe the old
  layout. Re-running that authoring pipeline would overwrite this DB change.
- `biomes.js` whitemarch city bounds `x:[-8,9] y:[-10,10]` remain an approximate
  region (they never tightly matched the handcrafted extent).
