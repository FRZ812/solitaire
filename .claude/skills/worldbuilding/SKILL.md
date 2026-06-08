---
name: worldbuilding
description: Design and extend the world of Solitaire — regions/biomes, factions, races, difficulty bands, encounter/spawn flavor, named landmarks (rumored & fabled), and the grimdark tone. Use when the user wants to add or change lore, create a new region or faction, set region difficulty, write encounter tables, place known/legendary landmarks, or keep new content consistent with the world's canon and mature tone. Pairs with the map-creation skill (which handles the physical hex tiles).
---

# Worldbuilding

This skill governs the **lore and systemic geography** of Solitaire — the data
that makes the world feel like a real, gated, grimdark fantasy. The physical hex
tiles are the **map-creation** skill's job; this skill is about *which region a
coordinate belongs to, who rules it, how dangerous it is, what wanders there, and
what tone it's all written in.*

**Always read `docs/WORLDBUILDING.md` first** (repo root) — it is the canonical
ruling set. `docs/world-expansion-plan.md` and `docs/region-planning/*` hold the
larger design vision. This skill summarizes the rules and the data model so you
can add content that stays consistent.

## Tone (non-negotiable canon)

Grimdark fantasy **for an adult audience** — harsh, unjust, unsentimental. New
content must hold this register:

- **Race relations are bigoted and mutual** (portrayed, not endorsed): old human/
  elf grievances, elf/dwarf contempt, orcs & goblins feared, half-bloods belong
  to neither parent's people, fae untrusted, demon-blooded shunned/hunted. A
  character's race changes how strangers treat them.
- **Drow** are a matriarchal *sub-elf* (a subculture of elvenkind), not a
  standalone race; surface elves and drow loathe each other.
- **Gender & power are culture-specific** — render each order (most patriarchal,
  some matriarchal: drow, the Halfborn Hold, witch-courts), not one modern norm.
- **Slavery exists**, legality varies (the Sundered Crown and some southern/
  eastern powers trade; freer holds outlaw it). Grim weight, never titillation.
- **Mature content** — vulgarity, visceral gore, frank (not cut-to-black)
  intimacy are in scope but kept in the engine's restrained literary voice.
  Sexual content **only between consenting adults**; anything involving minors or
  non-consent-as-titillation is refused and steered elsewhere.

The narrator's voice is encoded in `src/system-prompt.js`; lore data
(`data/races.js`, `data/factions.js`, biome descriptions) grounds it. Keep them
aligned. See `reference/canon.md` for the current world's regions, factions, and
the Whitemarch core.

## The systemic geography model

A coordinate's identity comes from **biomes**, assigned purely by `(x,y)`
rectangle — independent of the tile's terrain (a `settlement` hex inside The Mire
is still The Mire). Each biome owns:

- a **faction** (`data/factions.js`) — political/cultural ruler of the region,
- a **description** (narrator context),
- **terrainWeights** (procedural terrain mix for unauthored hexes),
- **extraSpawns** (regional encounter flavor appended to base spawn tables),
- a **difficulty band** (`data/regions.js` → `data/balance.js`) capping foe/loot
  tier — the world is gated by **region, not player level**.

Bands run 1 (Settled: Mire, Crowsmoor) → 6 (Fabled: Far Wild). Walk into a high
band early and you're out-classed — intended. See `reference/data-model.md` for
the exact files, schemas, and how to add a region/faction/difficulty wiring.

## Named landmarks: rumored vs fabled

- **Rumored** (`data/rumored.js`) — within ~30 hexes; the player can practically
  walk there. Surfaces as `[GEOGRAPHY KNOWN BY REPUTATION]`; draws a fog-of-war
  marker. If it's a sprawling structure, place its full layout in the handcrafted
  map (map-creation skill).
- **Fabled** (`data/fabled.js`) — far away (`|x|` or `|y|` ≥ 60); plot horizons
  NPCs reference. Surfaces as `[GEOGRAPHY KNOWN BY LEGEND]`.

Both tables are **currently empty** — the world was deliberately wiped and
rebuilt around Whitemarch alone; the wider continent is unwritten procedural
country. The original rich set lives in git history. To re-seed the wider world,
restore/author entries here. Each handcrafted footprint a landmark names should
also exist on the map (map-creation skill), so geography and tiles agree.

## Rulings that keep content consistent

- **Ruling 5 — biome boxes are rectangles, mutually exclusive.** `BIOMES` is
  scanned in order, first match wins, catch-all `far-wild` is last. Don't overlap
  *sibling* regional boxes (the Whitemarch capital box is a deliberate first-match
  override). Touch, don't intersect.
- **Ruling 6 — spawn extras are additive.** `biome.extraSpawns[terrain]` is
  appended to the base `SPAWN_TABLES[terrain]`. Add only what's characteristic of
  the region; don't replicate base entries.
- **Difficulty is region-gated, not leveled.** To rebalance, edit the tier curve
  (`data/tiers.js`), the bands (`data/balance.js`), or the biome→band map
  (`data/regions.js`). Nothing else changes.

## Workflow for adding a region

1. **Concept** — name, ruling faction, tone, what makes it mechanically distinct
   (per `docs/world-expansion-plan.md`'s pillars). Confirm it fits the grimdark
   canon.
2. **Faction** — add/choose an id in `data/factions.js`.
3. **Biome** — add a `rect({xmin,xmax,ymin,ymax})` entry to `BIOMES` in
   `data/biomes.js` that **does not overlap** an existing sibling box; give it a
   description, `terrainWeights` summing ≈1.0, `poiChance`, and `extraSpawns`.
4. **Difficulty** — map the biome id → band in `data/regions.js` `BIOME_DIFFICULTY`.
5. **Landmarks** — add rumored/fabled entries and, for sprawling ones, the
   handcrafted footprint (map-creation skill).
6. **Verify** — `node .claude/skills/map-audit/audit-map.mjs --live --biomes`
   flags biome overlaps and weight sums; then `npm run build`.

## References

- `reference/canon.md` — current world canon: Whitemarch core, the regions, the factions, tone specifics.
- `reference/data-model.md` — exact schemas + file map for biomes, factions, difficulty, spawns; how to add each.
- `../map-creation/` — the physical hex tiles for anything a region/landmark needs to *exist* on the map.
