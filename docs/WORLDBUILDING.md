# Worldbuilding rulings

How the world data is shaped so the engine + narrator produce a real, walkable
fantasy. These are the rules content additions must follow.

## Coordinate system

Pointy-top hex, axial coords (`x = q`, `y = r`). +x is east, +y is south.
1 hex ≈ 250 m of ground. The player begins at `(0, 0)` (The Drowned Inn).

## Tile precedence

`world.js getTile(x, y)` resolves in order:

1. `state.world.tiles[k]` — tiles the player has already entered (persistent).
2. `data/handcrafted-tiles.js HANDCRAFTED[k]` — designer-placed.
3. `data/rivers.js RIVER_BY_COORD[k]` — water tiles along named rivers.
4. `data/rumored.js RUMORED[k]` — auto-derived landmark tile.
5. `data/fabled.js FABLED_BY_COORD[k]` — auto-derived legend tile.
6. `generateTile(x, y)` — procedural noise + biome.

So if you want a sprawling structure, **handcrafted wins**. Put every room
there. Rivers run continuously _except_ where handcrafted overrides (used at
fords and bridges).

## What goes where

| File | Purpose |
|---|---|
| `data/terrains.js` | Terrain types (`indoor`, `settlement`, `road`, `plains`, `hills`, `forest`, `marsh`, `mountains`, `water`). Each has a speed cost. |
| `data/biomes.js` | Rectangular biome regions. Each owns a `faction`, a description, terrain weights for procedural generation, and `extraSpawns` appended on top of terrain spawn tables. |
| `data/factions.js` | Faction metadata. Referenced by `biome.faction`. |
| `data/handcrafted-tiles.js` | Designer-placed tiles. The dominant authoring surface. Use for towns, dungeons, fortresses, and any named feature. |
| `data/rumored.js` | Distant landmarks the player knows about as a regional native. Surface in `[GEOGRAPHY KNOWN BY REPUTATION]` even if far. Within `MAP_VIEW_RADIUS = 30` they also draw a marker under fog of war. |
| `data/fabled.js` | Legendary places, hearth-stories. Surface in `[GEOGRAPHY KNOWN BY LEGEND]`. Coords are far (`|x|` or `|y|` ≥ 60) so they never accidentally render on the local map. |
| `data/spawn-tables.js` | Random encounter tables, per terrain. |
| `data/rivers.js` | Named rivers as paths of water tiles. |

## **Ruling 1 — Single-tile vantage**

One hex = one vantage. The Drowned Inn's common room is a tile, its yard is
another, its stable is another. Don't pack multiple vantages into one POI's
description and expect the player to navigate them in prose.

## **Ruling 2 — Sprawl for major structures** (the recent ruling)

Dungeons, fortresses, dens, and major shrines are NEVER one tile. They are
**clusters of handcrafted tiles** the player traverses via the map, room by
room.

### Sizing guide

| Structure type | Tiles |
|---|---:|
| Roadside shrine or charcoal camp | 1 |
| Wayside watchpost, ferry, mill | 2–4 |
| Village | 5–9 |
| Goblin den, hillfort ruin, hermit's tower, abandoned manor | 5–12 |
| Walled town | 10–20 |
| Walled city (Whitemarch) | 20–30 |
| Great fortress / legendary stronghold (Brokenhold, Northstar Castle, Bone Citadel, Drakespire, Lichgate, Mole-Halls) | 15–30+, nested wards |

### Layout pattern

- **Threshold hex** (the named, reputation-visible one): gate, mouth, portcullis,
  bridgehead. Type `settlement` or `road`, depending.
- **Outer ring**: courtyards, baileys, approaches. Mostly `settlement`.
- **Inner ring**: halls, chambers, warrens, vaults. Mostly `indoor`.
- **Centre / deepest tile**: throne room, hoard, sanctum, oracle. `indoor`.
- **Sentries, traps, gatekeepers** at the outer ring. **The boss is never at the
  threshold.**
- Use `poi.type` to suggest icons / mood: `gate`, `yard`, `hall`, `cellar`,
  `throne_room`, `armoury`, `shrine`, `stable`, `warren`, `vault`, `cathedral`,
  `mint`, `palace`, `dungeon`, `crypt`. The engine accepts arbitrary strings.

### What the narrator does

The narrator's job at a multi-tile structure is to **narrate the inhabitants,
atmosphere, and stakes at the hex the player is currently in**, _not_ to push
them through multiple rooms in one beat. If they ask "I check the next room",
prompt them toward the map ("a corridor leads east toward firelight"); the
engine moves the player, not the narrator.

This rule is also encoded in `src/system-prompt.js` (and mirrored to
`supabase/functions/narrate/system-prompt.ts`) under STRUCTURE SPRAWL so the
narrator follows it consistently.

## Ruling 3 — Rumored vs fabled coordinates

- **Rumored** — within roughly 30 hexes of origin. The player can practically
  walk there. If the rumour is also a sprawling structure, place its full
  layout in `handcrafted-tiles.js`; the rumour entry just contributes to the
  geography-by-reputation context.
- **Fabled** — far away (≥ 60 hexes). The player will not normally arrive
  here. Treat fabled coords as plot horizons, not destinations. **However**,
  they SHOULD still get a sprawling handcrafted layout — for two reasons:
  1. NPCs reference them; spatial detail in the world data gives the narrator
     better mental geography.
  2. If a campaign ever does send the player there (artifact, spell, dream,
     long-arc quest), the structure exists.

## Ruling 4 — Avoid coord collisions

- Each `HANDCRAFTED[k]` overrides any river, rumored, or fabled at the same `k`.
- A rumored or fabled at a handcrafted hex still contributes its name to the
  geography context; the tile at that hex is just whatever handcrafted says.
- For rivers, design `path` arrays to skip handcrafted ford/bridge hexes so
  the visible water flows continuously around the crossing.

## Ruling 5 — Biome bounds are rectangles, mutually exclusive

`BIOMES` is scanned in order; first match wins. Catch-all `far-wild` is last.
Don't overlap bounded regions — the smoke-test in `dist/build` flagged the
earlier `pale-steppe`/`sundered-wastes` overlap. Touch but don't intersect.

## Ruling 6 — Spawn extras

`biome.extraSpawns[terrain]` is appended to the base `SPAWN_TABLES[terrain]`.
Use this for regional flavor (e.g. drake-wyrmlings in the Drakeholt, pale
acolytes in the Bonemarsh). Don't replicate base entries; just add what's
characteristic.

## Quick smoke test

After data edits, run:

```bash
npm run build && npm run build:web
```

The build is sensitive to syntax and module shape. If it passes both targets,
the data layer is internally consistent. Also see `/tmp/smoke.mjs` (ad-hoc;
not checked in) for a deeper invariant check — overlapping biomes, missing
faction ids, river/handcrafted conflicts.
