# Worldbuilding data model — files, schemas, how to add each

| File | Owns |
|---|---|
| `src/data/biomes.js` | Regional identity: bounded `BIOMES` (rect, faction, description, terrainWeights, poiChance, extraSpawns), `getBiome(x,y)`. |
| `src/data/factions.js` | Faction metadata referenced by `biome.faction`. |
| `src/data/regions.js` | `BIOME_DIFFICULTY` biome-id → band (1–6) + `regionDifficulty(x,y)`. |
| `src/data/balance.js` | Difficulty band definitions (tier ceiling + rollTier luck), drop odds. |
| `src/data/tiers.js` | The universal tier ladder (common→divine) + power/drop-weight curve. |
| `src/data/spawn-tables.js` | Base `SPAWN_TABLES` per terrain. `extraSpawns` is appended on top. |
| `src/data/rumored.js` | Near, known landmarks (`RUMORED`, currently `{}`). |
| `src/data/fabled.js` | Far, legendary landmarks (`FABLED`, currently empty). |
| `src/data/rivers.js` | Named rivers as water-tile paths (`RIVERS`, currently `[]`). |
| `src/data/races.js`, `src/system-prompt.js` | Race lore + the narrator's voice/rulings. |

## Biome entry (data/biomes.js)

```js
{
  id: "tannic-wood",                 // slug; used by BIOME_DIFFICULTY and getBiomeById
  name: "The Tannic Wood",
  faction: "wood-cult",              // must exist in data/factions.js
  description: "…",                  // narrator context; pure prose
  ...rect({ xmin:-25, xmax:10, ymin:-40, ymax:-3 }),   // bounds + auto-derived match()
  terrainWeights: { forest:0.55, hills:0.18, plains:0.10, marsh:0.08, mountains:0.05, water:0.04 },  // ≈1.0
  poiChance: 0.04,                   // chance a procedural tile carries a hidden POI
  extraSpawns: {                     // appended to SPAWN_TABLES[terrain]
    forest: [ { kind:"wood-acolyte", weight:8, posture:"neutral", desc:"…" }, … ],
  },
}
```

Rules:
- **Order matters** — `BIOMES` is scanned top-to-bottom, first `match` wins,
  `far-wild` (the `match:()=>true` catch-all) must stay **last**. The Whitemarch
  capital box is listed **first** so it wins its seam over the regional biomes.
- **No overlapping sibling boxes** (Ruling 5). Touch edges, don't intersect. The
  audit's `--biomes` check lists every overlap so you can confirm intent.
- `terrainWeights` keys are terrain ids (`data/terrains.js`); water only appears
  if weighted (procedural never invents water otherwise — rivers/lakes are
  explicit).
- `extraSpawns[terrain]` entries: `{ kind, weight, posture: "friendly"|"neutral"|
  "hostile", desc }`. Add only region-characteristic foes/NPCs; don't duplicate
  base table entries (Ruling 6).

Layout convention for bounds (axial; +x east, +y south): Vale core ≈
`x[-30..60], y[-40..40]`; far north `y<-40`; far east `x>60`; far south `y>40`;
far west `x<-30`; everything else falls to Far Wild.

## Difficulty wiring (data/regions.js + data/balance.js)

```js
// data/regions.js
export const BIOME_DIFFICULTY = { whitemarch:2, mire:1, "tannic-wood":2, …, "far-wild":6 };
```
Bands (see `docs/WORLDBUILDING.md` "Balance mapping"): 1 Settled (Uncommon cap) →
2 Borderlands (Rare) → 3 Wilds (Very Rare) → 4 Marches (Epic) → 5 Far Reaches
(Legendary) → 6 Fabled (Divine). The band caps the region's foe/loot tier and
sets `rollTier` luck. No level scaling — power comes from slow attribute growth
(proficiencies) and the **tier** of gear/abilities. A new biome **must** get a
band here or it defaults to 2.

## Faction entry (data/factions.js)

Add an id and metadata, then reference it from the biome's `faction`. Keep the
faction's posture consistent with the grimdark canon (who they enslave/raid/
trade with, how they treat outsiders). See `reference/canon.md` for the current
roster.

## Landmarks (rumored / fabled)

```js
// data/rumored.js  — within ~30 hexes; walkable; [GEOGRAPHY KNOWN BY REPUTATION]
RUMORED["12,-30"] = { name:"Crowsmoor", kind:"village", description:"…" };
// data/fabled.js   — |x| or |y| ≥ 60; [GEOGRAPHY KNOWN BY LEGEND]
FABLED["bone-citadel"] = { name:"The Bone Citadel", kind:"fortress",
  direction:"far north-west", coord:{x:-80,y:-70}, description:"…" };
```
`kind` drives the forced terrain when the landmark becomes a real tile
(`city/village/fortress → settlement`, `lake/river → water`, `mountains →
mountains`, else procedural terrain is kept). For a sprawling landmark, also
author its full footprint on the handcrafted map (map-creation skill) — the
rumored/fabled entry just feeds geography context; the handcrafted tiles are what
the player walks.

Both tables are intentionally empty right now (world reset to Whitemarch-only).
The git history holds the original Mirecross/legend set if you want to restore it.

## Verify

```bash
node .claude/skills/map-audit/audit-map.mjs --live --biomes   # biome overlaps + weight sums
npm run build                                                  # data-shape sanity
```
