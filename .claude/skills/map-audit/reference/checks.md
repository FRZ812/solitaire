# Audit findings — what each code means and how to fix it

Severity: **ERROR** = gameplay-breaking, must fix. **WARN** = almost always an
authoring slip, fix unless you can justify it. **INFO** = stats / confirm-intent.

All fixes are edits to the **authored** `tiles` / `sealed_structures` in the
live row. The pipeline (`buildHandcrafted`) re-derives wall + structure doors on
every load, so author the inputs, not the post-pipeline output.

---

## ERROR · `TERRAIN_UNKNOWN`
A tile's `terrain` is not one of the ids in `src/data/terrains.js`
(`indoor, settlement, street, road, wall, plains, hills, forest, marsh,
mountains, water`). The tile renders/paths wrong.
**Fix:** set a valid terrain id. Typo or a removed terrain (the dead "desert"
was deleted; "wall_top" was renamed to "wall").

## WARN · `TERRAIN_LEGACY`
Tile still uses `wall_top`. The loader auto-migrates it to `wall` in memory, but
the stored row is stale.
**Fix:** rename `wall_top` → `wall` in the row so the persisted data is canonical.

## ERROR · `NO_DOORS` — the wilderness walk-in bug (Ruling 7)
An `indoor` tile, or a sealed-structure interior member, has **no `doors`
array** after the pipeline. Default (no `doors`) means *all six neighbours are
open*, so the player can walk straight into the room from open country.
**Fix (pick one):**
- Add an explicit `doors: [{x,y}, …]` listing only the in-structure neighbours
  (and the threshold) the room should connect to; **or**
- Put the tile in a `sealed_structures` entry so the pipeline computes its doors
  (`applyStreetBuildingDoors` / `applyMeshDoors` / `applyLinkedDoors`).
A boss/sanctum tile should end up with a single door back to its antechamber.

## ERROR · `DOOR_NONADJ`
A `doors` entry points to a hex that is **not adjacent** (hex-distance ≠ 1). A
door can only cross one hex edge.
**Fix:** correct the coordinate. Remember pointy-top axial neighbours are
`(+1,0) (+1,−1) (0,−1) (−1,0) (−1,+1) (0,+1)`.

## ERROR · `STRUCT_NO_ENTRANCE`
A `sealed_structures` entry's footprint has **no member that opens to a hex
outside the footprint** — the whole structure is sealed shut and unreachable.
Common cause: the gate's `inside` hex isn't in the `interior`/`streets`/
`buildings` list, so the mesh pass seals it.
**Fix:** make the threshold/gate hex a member of the structure, and define the
gate pair `[inside, outside]` where `inside` is that member and `outside` is the
exterior approach (a street/road/wilderness hex).

## ERROR · `STRUCT_UNREACHABLE`
Some member tiles are walled off from the structure's entrance(s) by the door
graph — the player can reach the entrance but never those rooms.
**Fix:** add the missing internal `doors` linking the stranded rooms back toward
the entrance, or fix a one-way (asymmetric) door on the path. Re-run to confirm
the flood-fill now reaches every member.

## WARN · `DOOR_LEAK`
An `indoor` tile has a door onto a **procedural (undefined)** hex — an interior
opening straight to wilderness. Fine for a gate/mouth; suspicious for a deep
interior room.
**Fix:** if it's a genuine exit (a cave mouth), leave it and consider making the
tile a `settlement`/`gate` threshold instead of `indoor`. If not, drop the door.

## WARN · `DOOR_ASYM`
Tile A lists B, but B (which has its own `doors`) does **not** list A. The engine
needs *both* ends to permit an edge (`edgeAllowed`), so the wall holds — but a
half-declared door is normally a mistake (often the pipeline overwrote one side).
**Fix:** reciprocate (add A to B's doors) if the edge should be open, or remove
A→B if it shouldn't.

## WARN · `STRUCT_DANGLING`
A `sealed_structures` member coordinate has **no tile** in the row. The pipeline
silently skips it (`setDoors` soft-fails), so the footprint is incomplete.
**Fix:** add the missing tile, or remove the phantom coord from the structure
list. Often a leftover after a tile was deleted.

## WARN · `POI_PARENT_NAME`
Hexes sharing a `poi.parent` slug disagree on `poi.parentName`. The map labels
the footprint from this, so the place shows two names.
**Fix:** make `parentName` identical across all members of the footprint.

## WARN · `POI_DUP_PART`
Two hexes in the same `parent` footprint claim the same `poi.part` slug. Parts
should be unique sub-areas (Toll Hall, Inspection Yard, Wall Stair…).
**Fix:** give each member a distinct `part`/`partName`.

## INFO · `POI_NO_PART`
A footprint member has no `part`/`partName`. Fine for a single-tile POI; for a
multi-hex footprint, every member should name its sub-area.

## INFO · `COORD_COLLISION`
A handcrafted tile shares a coord with a river/rumored/fabled entry. Handcrafted
wins (`getTile` precedence), so this is only worth confirming for fords/bridges.
Both `rivers.js`/`rumored.js`/`fabled.js` are currently empty, so expect none.

## INFO · `BIOME_OVERLAP`
Two bounded biomes in `src/data/biomes.js` overlap; the earlier-listed one wins
the intersection by first-match (`getBiome`). This is how the Whitemarch capital
box is placed first to win its seam. Ruling 5 says regional biomes should *touch,
not intersect* — confirm each seam is intentional. The bug this can't auto-detect:
a smaller, more-specific region listed **after** a broad one, shadowed so it
never fully renders — if you see that pairing, reorder so the specific box is first.

## INFO · `BIOME_WEIGHTS`
A biome's `terrainWeights` don't sum to ≈1.0. They're sampling weights so it's
not fatal, but round them to 1.0 for predictable terrain mixes.

## ERROR · `PIPELINE`
`buildHandcrafted` threw — a `sealed_structures` entry is internally inconsistent
(a gate between non-adjacent hexes, a `links` member unreachable from `entry`, a
building door to a non-member, a coord listed as both street and building). The
message names the structure and reason.
**Fix:** correct the offending structure descriptor. Until it's fixed, the other
door checks ran on raw authored tiles and may be incomplete — re-audit after.

---

## Read / write the live row (Supabase MCP)

Read:
```sql
select tiles, sealed_structures, updated_at
from public.handcrafted_map where id = 'whitemarch';
```

Write (read-modify-write the whole JSON column; preserve everything you didn't
intend to change):
```sql
update public.handcrafted_map
set tiles = $tiles::jsonb, sealed_structures = $sealed::jsonb
where id = 'whitemarch';
```

The row has an auto-touch trigger on `updated_at`. Any write bumps it, which
makes an open game tab's next autosave throw `STALE_MAP` (optimistic concurrency
in `saveMap()`). That's intended — just tell the user to reload open tabs/editor
after a cleanup write. RLS gates writes to the row owner; the MCP service role
bypasses RLS, so MCP writes succeed regardless of who owns the row.

Always re-run the auditor on a fresh dump after writing to confirm the fix landed
and nothing regressed.
