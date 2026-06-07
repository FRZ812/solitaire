# World canon (current state)

The world was deliberately reset to **Whitemarch and its immediate Vale**; the
wider continent is unwritten procedural country, named only by biome boxes,
distant factions, and (when restored) rumored/fabled landmarks. Keep new content
consistent with what's below. Sources: `data/biomes.js`, `data/factions.js`,
`data/regions.js`, `docs/WORLDBUILDING.md`, `docs/region-planning/*`.

## The center: Whitemarch

A walled capital-fortress at the origin `(0,0)` and the player's starting
ground — the iron-trading city-state where the iron-shilling is minted.
Black-and-white gate-towers over a Great Wall ringing wards of market, dock,
chain (slave market), court, and citadel; the Whitewend river runs brown beneath
the quays. Difficulty band 2. Biome box `x[-8..9], y[-10..10]`, listed **first**
so it wins its seam. The full city lives in the handcrafted map (Supabase row);
districts were authored as `src/data/whitemarch-districts/*` packages.
Design intent (`docs/region-planning/WHITEMARCH_CITY.md`): nested enclosures —
Outer Works, the Great Wall, Ward Walls, the High Wall (Court Hill/Citadel), and
the Underwall (drains/posterns). Major POIs are **footprints, not single hexes**.

## Regions (biome → faction → difficulty band)

**Vale core & frontier**
- **The Mire** (`mire`, Crowsmoor Wardens, band 1) — reed-beds and peat around the
  east-west road; the Vale's wet heart.
- **Crowsmoor Reach** (`crowsmoor-reach`, Crowsmoor Wardens, band 1) — open grass
  and wagon-tracks east toward Crowsmoor's walls.
- **The Tannic Wood** (`tannic-wood`, Wood-Cult, band 2) — twilight birch/alder
  wood north of the Mire.
- **Whitemarch March** (`whitemarch-march`, Whitemarch Iron, band 2) — patrolled
  chalk-down border country on the road to the city.
- **Bramblewych Reach** (`bramblewych-reach`, Bramble Witches, band 2) — half-wild
  briar country south of the Mire; Greenshaw small-folk live here.

**The wilds (band 3)**
- **Spine Foothills** (`spine-foothills`, Spine Confederation) — broken country
  toward the Spine; the Stonebrook dwarven hold and the Heron Tower stand here.
- **Iron Plateau** (`iron-plateau`, Marches of the Iron Plateau) — high cavalry
  tableland east of Whitemarch.
- **Tellmar Road** (`tellmar-road`, Hundred Banners of Tellmar) — the long eastern
  trade-march.
- **Witchwood Deep** (`witchwood-deep`, Bramble Witches) — old hungry wood west of
  Bramblewych; the Selenyan (elves) keep an edge-outpost near it.

**The cursed marches (band 4)**
- **Hollow Coast** (`hollow-coast`, The Tideless) — salt fens and grey beaches far
  south; the dead are weighed and walked into the surf.
- **The Bonemarsh** (`bonemarsh`, The Pale Hand) — necromancer bog north of Black
  Tarn; the dead don't stay buried.
- **Pale Steppe** (`pale-steppe`, Free Folk) — bone-grass steppe west; once the
  Witch-Queens', now only nomads.

**The far reaches (band 5)**
- **Sundered Wastes** (`sundered-wastes`, The Sundered Crown) — orc/goblin warband
  badlands under the Goblin King at Brokenhold.
- **The Drakeholt** (`drakeholt-peaks`, The Vyrgun) — snow-burned drake-blooded
  peaks (Vyrnholt) with tribute-towns and great wyrms.

**Beyond the named world (band 6)**
- **The Far Wild** (`far-wild`, Free Folk) — the catch-all; everything outside
  every named box. Must stay last in `BIOMES`.

## Factions at a glance (`data/factions.js`)

**Vale powers:** Crowsmoor Wardens, Whitemarch Iron, the Wood-Cult, Spine
Confederation, Bramble Witches, Free Folk.

**Distant (rumored reach):** Reeve's Levy, **Sundered Crown** (Goblin King /
Brokenhold), **Pale Hand** (necromancers), **Burning Order** (dragon-hunters),
the Tideless, Free Companies (Bronze Glove, Long Spurs), Marches of the Iron
Plateau.

**Legendary (fabled):** Court of the Demon King (Northstar Castle), the **Vyrgun**
(Drakeholt), Star-Forge Pilgrims, Witch-Queens of the Bone Citadel, Hundred
Banners of **Tellmar**, the Drowned Choir (the Sunken Crown).

**Peaceful peoples / civic:** **Stonebrook Holds** (working dwarves), **Greenshaw
Folk** (small folk), **Selenyan Court** (elves; Caer Selenya far west), **Halfborn
Free Hold** (half-orc free town, elected matriarchy, anti-slaver), **Asalan
Crown** (southern kingdom past the Hollow Coast), **Heron School** (sorcerer
lineage, herald-birds), **Servants of the Pale God** (silent-god shrine order).

When you add a region, pick or add a faction whose posture fits the band and the
grimdark canon (who they raid/enslave/trade with, how they treat outsiders).

## Races & tone (from `docs/WORLDBUILDING.md` + `data/races.js`)

Peoples openly distrust each other (bigotry portrayed, not endorsed): human/elf
grievances, elf/dwarf contempt, orcs & goblins feared, half-bloods belong to
neither parent's people, fae untrusted, demon-blooded shunned/hunted. **Drow** are
a matriarchal *sub-elf* subculture, not a standalone race. Gender/power is
culture-specific — most patriarchal, some matriarchal (drow, Halfborn Hold,
witch-courts). **Slavery** exists with varying legality (Whitemarch's Chain Ward
trades; the Halfborn outlaw it). Mature content (vulgarity, gore, frank intimacy)
is in scope in a restrained literary voice; sexual content **only between
consenting adults** — minors/non-consent-as-titillation are refused.

## Landmarks: empty by design

`data/rumored.js` (`RUMORED`), `data/fabled.js` (`FABLED`), and `data/rivers.js`
(`RIVERS`) are **currently empty** — the reset stripped the wider map to
Whitemarch alone. Whitemarch's own river (the Whitewend) is authored as
handcrafted water tiles, not a global river path. To expand outward, re-seed
these (the original Mirecross set + legends live in git history) and author any
sprawling landmark's footprint on the handcrafted map (map-creation skill) so
geography and tiles agree.
