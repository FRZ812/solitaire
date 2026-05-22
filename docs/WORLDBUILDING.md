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

### Balance mapping (single source of truth)

No level system: power comes only from slow attribute growth and the **tier** of
gear/abilities. The world is gated by **region**, not player level.

**Tier ladder** (`src/data/tiers.js`) — ~+34% power per step, top-heavy rarity:

| Tier | mult | drop weight |
|---|---|---|
| Common | 1.0 | 1000 |
| Uncommon | 1.35 | 420 |
| Rare | 1.8 | 170 |
| Very Rare | 2.4 | 64 |
| Epic | 3.2 | 24 |
| Legendary | 4.3 | 8 |
| Mythical | 5.8 | 2.4 |
| Divine | 8.0 | 0.5 |

**Drop odds per victory** (`src/data/balance.js`): item 55%, ability 22%; tier of
each drop is `rollTier(cap, luck)` where the cap is the region's loot ceiling.

**Region difficulty bands** (`src/data/balance.js` + `src/data/regions.js`) — each
biome is assigned a band that caps its foe/loot tier and sets rollTier luck:

| Band | Regions | tier ceiling | power |
|---|---|---|---|
| 1 Settled | Mire, Crowsmoor Reach | Uncommon | 0.05 |
| 2 Borderlands | Tannic Wood, Whitemarch March, Bramblewych Reach | Rare | 0.15 |
| 3 Wilds | Spine Foothills, Iron Plateau, Tellmar Road, Witchwood Deep | Very Rare | 0.30 |
| 4 Marches | Hollow Coast, Bonemarsh, Pale Steppe | Epic | 0.50 |
| 5 Far Reaches | Sundered Wastes, Drakeholt | Legendary | 0.70 |
| 6 Fabled | Far Wild (beyond the named world) | Divine | 0.90 |

Walk into a high band early and you'll be out-classed — intended. To rebalance,
edit the tier curve in `tiers.js`, the bands in `balance.js`, or biome→band in
`regions.js`. Nothing else needs to change.

### Named / unique items & abilities

`src/data/uniques.js` holds hand-authored, fixed-stat, fixed-tier rewards with
lore (e.g. **Skullcleaver** from ogres/trolls, **Drakeheart Ember** &
**Dragonbreath** from Drakeholt wyrms, **The Broken Ring** from Sundered-Crown
war-bands). They drop ONLY from their `dropFrom` foe kinds and/or `minRegion`
band, never from the random generator, never twice for one character (the
engine passes the player's owned ids in). Unique abilities are registered for
lookup but excluded from the random drop pool.

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

### Weapon vs caster, requirements, passives

**Scaling style** (`data/abilities.js`):
- **Weapon techniques** (martial) — `scaling:"weapon"`. Damage = equipped weapon ×
  a tier-mult `+ a stat modifier` (governing attribute, grows with ability tier).
  Require a weapon category. Cost Stamina. Consistent.
- **Spells** — `scaling:"stat"`. Damage = base × tier × `attrFactor(Mind/Presence)`;
  a staff/wand adds only a small flat bonus. Cost a little Stamina **and drain
  Resolve** (which does NOT regen in combat and persists after) — so casters
  burst hard then run dry, while fighters stay steady.

**Requirements are soft** (`combat-stats.js reqEffectiveness`): each ability has a
`weaponReq` (categories) and `statReq` (`base + tier_order×2`). Under-stat scales
the ability down by `playerStat/required` (floor 20%); off-type weapon techniques
take a 0.6× hit. Items carry the same kind of stat requirement (by tier); an
under-req item still works at reduced base stats but **its passives switch off**.

**Passives** (`data/passives.js`): slot count by item tier — Common/Uncommon 0 ·
Rare 1 · Epic 2 · Legendary+ 3. Each passive carries its own tier (magnitude
scales with it) and can't exceed the item's tier, so a divine-grade passive only
appears on a divine item. Scope is `combat` (stat mods + triggers: lifesteal,
thornmail, regen, resolve-regen, extra stamina, revive-once) or `world` (slower
need decay, faster travel, out-of-combat regen, extra coin). Passives only apply
on equipped, requirement-met gear. To rebalance, edit the magnitude table in
`passives.js`.

### Proficiencies — the "get better by doing" pillar

No levels. Besides loot, the ONLY progression is use-based proficiencies
(`data/proficiencies.js`), stored on the character as `{ id: xp }`:

- **Per-weapon mastery** (Swordsmanship, Archery, Bludgeon…), **Ambush**,
  **Evasion**, **Awareness**, **Spellcasting**, **Endurance**, **Command**.
- Every combat action trains the matching proficiency a little (XP). Rating
  climbs with √XP (6→1, 24→2, 54→3…). Ratings give small direct bonuses:
  mastery → weapon damage/accuracy, Evasion → dodge, Awareness → accuracy +
  spotting ambushes, Spellcasting → spell power + cheaper Resolve, Endurance →
  stamina, Command → Talk, Ambush → surprise odds.
- **Attributes grow ONLY from this.** Each proficiency feeds its governing
  attribute (e.g. sword/dagger/bow/Ambush/Evasion → Reflex; Spellcasting →
  Mind; Endurance → Vigor; Command → Presence). An attribute's growth = the sum
  of its proficiencies' XP on a slow √ curve (+1 at 40 total, +2 at 160 …).
  `effectiveAttributes()` = base + growth; everything (combat, the [STATE] line)
  uses the effective value. The narrator no longer grants attribute increases —
  the prompt reserves `attribute_changes` for rare supernatural events only.

`applyCombatResult` writes the fight's XP back and surfaces rating-ups and
attribute gains as growth beats. Old saves without `proficiencies` read as `{}`.

### Ambush is contested

A `surprise` strike is never automatic. Player ambush rolls your stealth
(Reflex + ½Wit + Ambush rating) vs the foes' awareness (their accuracy +
demeanor alertness, −12% per extra foe); win → they're stunned a turn, lose →
even start. An enemy ambush is contested by your Wit + ½Reflex + Awareness, so a
perceptive character isn't auto-jumped. Both train the relevant proficiency.

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

**Talk** (`playerTalk`) is a third pillar beyond attack/defend, with three
intents — but only on foes that can understand you (`canTalk`; beasts and the
mindless can't be reasoned with):
- **Demand Surrender** — yield chance weighs WHO IS WINNING above all: a foe in
  better shape than you (`enemy HP% − your HP%`) scoffs and won't yield, while a
  foe you've beaten down readily gives up. It also scales with Presence/Wit, the
  foe's morale, fallen allies, and honor — but the "you outclass them" bonus only
  applies when you're not currently losing the exchange (a dying man can't coerce
  a surrender just because he's stronger on paper). Likewise a winning foe never
  flees/yields on its own and shrugs off demoralize.
- **Demoralize** — saps the morale of everyone who can hear, pushing waverers
  toward flight/surrender; it's not just for the near-dead.
- **Provoke** — goads one foe into a reckless fury (vulnerable + rally) and stops
  it fleeing for a couple of turns, so you can bait and finish a runner.

A fight that ends in surrender/flight resolves as **"Stood Down"** (non-lethal)
rather than a kill; yielded foes still give spoils.

**Aftermath** — every fight appends a `[COMBAT REPORT]` to `apiHistory` (outcome,
each foe's fate, ending HP, a blow-by-blow) so the narrator can speak to what
happened. **Defeat is not game-over:** `handleResolveCombat` hands a `[DEFEATED]`
prompt to the narrator, which decides a non-lethal consequence fitting the victor
and place — robbed, jailed, thrown out, or captured and moved (`tile_move`) — and
the player wakes to face it. Actual death is reserved for cold killers.

**Environment** (`data/environment.js`, `playerUseEnvironment`): each fight rolls
1–3 single-use battlefield features from the terrain — flip a table for cover,
hurl a stool, topple a log, kick over a brazier (area fire), shove a boulder.
Each costs a stamina and does something distinct (cover / throw+stagger /
topple+stun / area burn / heavy shove), so combat isn't only attack-vs-defend.

### Entry & outcome

Three ways in:
1. **Narrator-flagged** — the only way combat starts from the fiction. The
   narrator emits `start_combat` (system-prompt.js) ONLY on an *explicit* strike
   (the player or an NPC actually attacks), never on threats/standoffs. It names
   the foe(s) — a codex `npc_id` (built via `enemyFromNPC` from their real
   attributes + gear) or a spawn `kind` — plus `initiator` and `surprise`.
   `App.startCombatFromDirective` builds the foes and opens the fight. **Ambush:**
   `surprise:true` gives the striker a free opening — if the player struck, foes
   are stunned and lose their first turn; if an NPC struck, every foe lands a free
   opening blow. `surprise:false` (both already squared off — heated argument,
   standoff) starts even.
2. **Hostile travel encounter** — raises a Fight/Avoid banner.
3. **"Look for a fight"** (swords button in the map panel) — sends a `[SEEK COMBAT]`
   action to the narrator, which decides what the place holds: a willing foe
   (`start_combat`), nobody interested, or consequences (guards/patrons step in).
   It is NOT a guaranteed fight and there are no endless hordes — a cleared place
   has nothing left, so the player must look elsewhere.

**Location consequences** — player violence persists. The narrator records lasting
changes to the current tile via `location_update` (emptied / razed / tense…),
stored with the game-day; the `[LOCATION STATE]` context line tells it what was
done and how long ago, so an emptied inn stays empty and only recovers slowly
(narrator-paced) over days/weeks. See `applyBeat` (tile `status`) and
`buildStateContext`.

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
