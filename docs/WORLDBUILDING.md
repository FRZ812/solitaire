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

## **Ruling 7 — Access control with `doors`**

Every interior hex of a sealed structure declares the neighbours it can be entered from or exited to. An interior tile *without* `doors` is a bug — it lets the player walk in from a wilderness adjacency.

### Schema

```js
"-120,-63": {
  terrain: "indoor",
  poi: { type: "throne_room", name: "Goblin King's Throne" },
  doors: [{ x: -120, y: -62 }],   // only from the Imperial Hall
},
```

`doors` is an array of `{x, y}` neighbours. Default (no `doors`): all 6 neighbours are open — what wilderness and open settlements want.

### Symmetric check

The engine refuses a map-move A → B unless BOTH ends permit:

- `A.doors` is unspecified, OR `A.doors` includes B.
- `B.doors` is unspecified, OR `B.doors` includes A.

So if you forget to add A to B's `doors` list, the wall still holds — the asymmetric mistake reads as "no entry" rather than "free entry".

### Layout rules per zone

For each sealed structure:

| Tile role | `doors` |
|---|---|
| Wilderness around the structure | none |
| Threshold (the gate hex named in `rumored.js`) | lists exterior approach hexes + the first interior hex |
| Outer ward / yard | lists only interior neighbours (no wilderness) |
| Inner halls, chambers | lists only interior neighbours |
| Sanctum / boss tile | a single door (back through the antechamber) |

The map renders any blocked edge as a dark wall segment so the player can see the geometry without thinking about coords.

### Extreme entry — when the door graph is wrong

The player can always *attempt* a non-door entry by freeform action. The narrator adjudicates and uses the new `tile_move` beat field on success:

- **Scaling**: roll d20 + Reflex + climbing skill vs DC 16–20. On success, `tile_move` to the interior; condition "Bruised" probable.
- **Breaching**: loud, alerts inhabitants. Vitality cost, time cost, narrative consequences.
- **Magic**: requires the player has acquired the relevant spell via one of the magic paths. Resolve cost, time cost.
- **NPC-granted / secret passage**: narrative, no roll.

The system-prompt section ACCESS CONTROL covers the narrator side. See `src/engine/beat.js` for the `tile_move` handler.

## Combat system (turn-based, client-side)

Combat is resolved entirely in the browser — fast, clickable, lightly random.
The narrator is NOT in the loop during a fight; it only sets the scene before
and can react to the aftermath afterward. Files: `src/engine/combat.js` (turn
engine), `src/engine/combat-stats.js` (attribute → combat-stat derivation),
`src/data/abilities.js`, `src/data/bestiary.js`, `src/data/tiers.js`,
`src/components/combat/CombatView.jsx`.

### Tiers (universal)

Everything gradable carries a tier from one ladder (`src/data/tiers.js`):
**common · uncommon · rare · very rare · epic · legendary · mythical · divine**.
Each tier has a power multiplier (`mult`) applied to base stat blocks and a drop
`weight` (rarer = exponentially less likely). `rollTier(maxTierId, luck)` does
weighted, capped rolls for loot and enemy generation.

### Stats — derived, attributes stay the backbone

The six attributes (body/reflex/vigor/mind/wit/presence) are unchanged. Combat
stats are DERIVED from them plus equipped gear (`deriveCombatStats`):

- **maxHealth** = `vitalityMax` (combat reads/writes `character.vitality`).
- **armor** (physical flat DR) = `floor(body/3)` + worn armour values.
- **ward** (magical flat DR) = `floor(mind/3)` + worn ward values.
- **dodge%** = `reflex*2` + gear (cap 60). **accuracy** = `reflex+wit` (offsets dodge).
- **critChance%** = `wit*1.5 + reflex` (cap 50); **critMult** 1.5.
- **weapon damage** = equipped weapon (or unarmed) range × `attrFactor(gov)` where
  gov = body for physical, mind for magical; **penetration** = weapon pen + `floor(body/4)`.
- **stamina** (per-fight resource) = `4 + floor((vigor+reflex)/3)`, regen `2 + floor(vigor/4)`.

Items get combat values from an explicit `combat` block on the codex item, else
inferred from kind/name keywords (`itemCombatStats`).

### Damage pipeline (one hit)

`dodge check → roll base damage → rally/weaken → crit → vulnerable → mitigate`.
Mitigation: **physical** subtracts `armor − penetration`; **magical** subtracts
`ward − penetration`; **true** ignores both. No AC, no attack d20 — dodge is a
flat % chance.

### Turn structure

Per-fight Stamina gates actions; most abilities also have a cooldown. A turn:
player spends stamina on clickable abilities (multiple per turn), then **End
Turn** → each enemy acts (simple AI: heal when low, else ~60% use an ability) →
new turn regens stamina and ticks cooldowns. **Flee** chance scales with speed.

Status effects: bleed/poison (true damage-over-time), stun (skip), weaken
(−outgoing), vulnerable (+incoming), guard (+armour), rally (+outgoing), regen
(heal-over-time), focus (+crit, consumed on next hit).

### Abilities & enemies (generative, tiered)

Abilities live in `ABILITY_LIBRARY` (martial/arcane/shadow/survival/divine), each
a common-tier baseline scaled by tier × governing attribute. Strike + Brace are
always available; learned abilities are stored on `character.abilities` as
`{ id, tier }`. Enemies come from `BESTIARY` keyed by spawn `kind` (with a
keyword-inferred fallback); `generateEnemyGroup(kind, {power})` rolls group size
and per-enemy tiers, scaling stats by `power` (terrain threat).

### Living foes — morale, surrender, flight

Foes are not stat sheets (`src/data/combat-flavor.js`). Each carries a
**demeanor** (feral · craven · wary · fierce · brutish · honorable · fanatic ·
mindless) and a **morale** pool. Morale erodes from wounds, dropping below HP
thresholds, fallen allies, being stun-/control-locked, and being visibly
out-classed (`powerRatio` lowers starting nerve). As it frays a foe **wavers**,
**pleads**, or — if proud and bullied with control/tricks — **demands a fair
fight** (and digs in). When it breaks, the foe **flees** or **yields** by
demeanor: craven bolt early, the honorable yield with honor when beaten fairly,
beasts run at low HP, fanatics/undead never break.

The player has a third option beyond attack/defend: **Demand Surrender**
(`playerParley`). Yield chance scales with Presence/Wit, the foe's morale and
wounds, fallen allies, how outmatched it is, and whether you fought it with
honor — control-spamming the proud hardens them against you unless you're
overwhelmingly stronger. A fight that ends in surrender/flight resolves as
**"Stood Down"** (non-lethal) rather than a kill; yielded foes still give spoils.

### Entry & outcome

A hostile travel encounter raises a Fight/Avoid banner; the header's swords
button seeks a fight against a hostile drawn from the current tile's spawn table.
`applyCombatResult` folds the fight back into the campaign: HP → `vitality`,
lingering DoT → Bleeding/Poisoned conditions (defeat → Gravely Wounded, min 1 HP),
loot → inventory/codex, a learned ability → `character.abilities` + a codex skill,
and summary beats into the log.

## Quick smoke test

After data edits, run:

```bash
npm run build && npm run build:web
```

The build is sensitive to syntax and module shape. If it passes both targets,
the data layer is internally consistent. Also see `/tmp/smoke.mjs` (ad-hoc;
not checked in) for a deeper invariant check — overlapping biomes, missing
faction ids, river/handcrafted conflicts.
