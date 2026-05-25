# Worldbuilding rulings

How the world data is shaped so the engine + narrator produce a real, walkable
fantasy. These are the rules content additions must follow.

## Tone & mature content (adult)

The game is **grimdark fantasy for an adult audience** — harsh, unjust,
unsentimental. The narrator prompt (`src/system-prompt.js`) sets the rulings;
content data (codex races, factions) grounds them:

- **Race relations** — peoples openly distrust and disdain each other. Humans/
  elves carry old grievances; elves and dwarves hold mutual contempt; orcs &
  goblins are feared/hated; half-bloods belong to neither parent's people; the
  fae are untrusted; the demon-blooded shunned or hunted. A character's race
  changes how strangers treat them (stares, slurs, refused service, worse). It's
  bigotry portrayed, not endorsed.
- **Drow** are a **matriarchal sub-elf** (a subculture of elvenkind, like human
  cardinal ethnicities — not a standalone race); surface elves and drow loathe
  each other.
- **Gender & power** — culture-specific. Most peoples are patriarchies (male
  leadership default; women hold power informally/against resistance); some are
  matriarchies (drow, the Halfborn Hold, witch-courts). Render each order, not a
  single modern norm.
- **Slavery** exists and its legality varies — the Sundered Crown and some
  southern/eastern powers trade or keep slaves; freer holds (the Halfborn) and
  many northern towns outlaw it. Treated with grim weight, never titillation.
- **Mature content** — vulgarity in dialogue, visceral/consequential gore in
  combat, and frank (not cut-to-black) intimacy are all in scope, but kept in
  the engine's restrained literary voice. Sexual content is **only between
  consenting adults**; anything involving minors or non-consent-as-titillation
  is refused and steered elsewhere.

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
- **dodge%** = `reflex*2` + gear + Evasion (cap 70; **light armour adds, heavy armour crushes it to a fifth**). **accuracy** = `reflex+wit` (offsets dodge).
- **critChance%** = `wit*1.5 + reflex` (cap 60); **critMult** 1.5.
- **weapon damage** = equipped weapon (or unarmed) range × `attrFactor(gov)` where
  gov = body for physical, mind for magical; **penetration** = weapon pen + `floor(body/4)`.
- **action points** per turn = `1` + swift affixes (cap +3) + a speed-driven "act-again" chance; **heavy armour −1**. There is NO stamina — action points gate everything.
- **initiative (speed)** = `reflex + floor(wit/2)` + weapon speed + armour band (light +, heavy −); high speed acts first each round.
- **resolve** is the only ability resource (persists out of fight): spells cost `resolveCost`; martial techniques are gated by action points + cooldown only. Regens a little each turn (+light armour, Clear-Mind).
- **armour bands:** body armour is **light** (low armour, +dodge/+speed/+resolve, no penalty) or **heavy** (high armour + health + aegis + damage, but −dodge/−speed/−action and a Body requirement).
- **distance/reach:** each foe carries an engagement `distance`; a weapon strikes within its **reach** (melee) or **range** (ranged). Out of range you close in (charge the last step) or kite via Withdraw.

Items get combat values from an explicit `combat` block on the codex item, else
inferred from kind/name keywords (`itemCombatStats`).

### Weapon vs caster, requirements, passives

**Scaling style** (`data/abilities.js`):
- **Weapon techniques** (martial) — `scaling:"weapon"`. Damage = equipped weapon ×
  a tier-mult `+ a stat modifier` (governing attribute, grows with ability tier).
  Require a weapon category. Gated by an action point + cooldown (no resolve).
- **Spells** — `scaling:"stat"`. Damage = base × tier × `attrFactor(Mind/Presence)`;
  an arcane focus adds a small flat bonus. **Drain Resolve** (regens a little in
  combat now, slowly, and persists after) — so casters burst hard then run dry,
  while fighters stay steady on the action economy.

**Requirements:** each ability has a `weaponReq` (categories) and `statReq`
(`base + tier_order×2`). The **stat** requirement is soft — under-stat scales the
ability down by `playerStat/required` (floor 20%). The **weapon** requirement is
a HARD gate (`weaponReqMet`/`abilityUsable`): a melee technique is unusable
without a matching weapon in hand — you can't Power Strike with a grimoire or
bare fists (in a brawl you must Draw Weapon first). Items carry a stat
requirement (by tier); an under-req item still works at reduced base stats but
**its passives switch off**.

**Passives** (`data/passives.js`): slot count by item tier — Common/Uncommon 0 ·
Rare/Very-Rare 1 · Epic 2 · Legendary/Mythical 3 · Divine 4. Each passive carries
its own tier (magnitude scales with it) and can't exceed the item's tier, so a
divine-grade passive only appears on a divine item. Scope is `combat` (stat mods +
triggers: lifesteal, thornmail, regen, resolve-regen, initiative/act-again,
revive-once) or `world` (slower
need decay, faster travel, out-of-combat regen, extra coin). Passives only apply
on equipped, requirement-met gear. To rebalance, edit the magnitude table in
`passives.js`.

Scaling rule (so no affix goes dead at high grade): the game's power curve is
**geometric** (tier mult 1.0→12.0), so flat affixes scaled linearly with tier
order fall off. Sustain/shields (`turnRegen`, `shieldGen`, `magicShieldGen`, and
Lifeward's burst) are therefore stored as a **fraction of max health** and the
engine multiplies by the wearer's pool — they stay relevant at every tier. Raw
flat-power affixes (flat health, flat weapon damage, flat armour/penetration —
Stalwart/Colossus/Juggernaut, Honed, Bulwark/Aegis, Piercing/Sundering) use the
`geo(base, n)` helper to track the same geometric curve. Percentage affixes
(lifesteal, thorns, damage %, crit, dodge, swift, drPct, fortify) already scale
and are the benchmark. Snowball-prone stats stay clamped in `PASSIVE_CAPS`.

### Proficiencies — the "get better by doing" pillar

No levels. Besides loot, the ONLY progression is use-based proficiencies
(`data/proficiencies.js`), stored on the character as `{ id: xp }`:

- **Per-weapon mastery** (Swordsmanship, Archery, Bludgeon…), **Ambush**,
  **Evasion**, **Awareness**, **Spellcasting**, **Endurance**, **Command**.
- Every combat action trains the matching proficiency a little (XP). Rating
  climbs with √XP (6→1, 24→2, 54→3…). Ratings give small direct bonuses:
  mastery → weapon damage/accuracy, Evasion → dodge, Awareness → accuracy +
  spotting ambushes, Spellcasting → spell power + cheaper Resolve, Endurance →
  Vigor (toughness), Command → Talk, Ambush → surprise odds.
- **Attributes grow ONLY from this.** Each proficiency feeds its governing
  attribute (e.g. sword/dagger/bow/Ambush/Evasion → Reflex; Spellcasting →
  Mind; Endurance → Vigor; Command → Presence). An attribute's growth = the sum
  of its proficiencies' XP on a slow √ curve (+1 at 40 total, +2 at 160 …).
  `effectiveAttributes()` = base + growth; everything (combat, the [STATE] line)
  uses the effective value. The narrator no longer grants attribute increases —
  the prompt reserves `attribute_changes` for rare supernatural events only.

`applyCombatResult` writes the fight's XP back and surfaces rating-ups and
attribute gains as growth beats. Old saves without `proficiencies` read as `{}`.

**UI:** the character panel shows only a tier-sorted preview of abilities and
the top proficiencies; "All N …" opens the dedicated **Arsenal** panel
(`ArsenalView.jsx`) with the full lists sorted highest-tier/rating first. In
combat, learned abilities sort by tier and live in a bounded scroll area, with
Strike / Brace / Talk pinned as a core row — so neither cluttering as the kit grows.

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

### Turn structure — initiative + distance

Combatants act in **initiative order** each round (by speed). On your turn you
spend **action points** on clickable abilities (a swift build gets several; heavy
armour fewer), reposition (**Advance**/**Withdraw**), or **End Turn** → the engine
resolves every other combatant in speed order until it's your turn again. There is
no stamina; cooldowns and the action economy gate the kit, and spells drain
Resolve. **Distance** matters: each foe has an engagement distance; melee strikes
within its weapon's **reach** (charge the last step in), ranged within its
**range** (and can kite). **Flee** chance scales with speed.

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
beasts run at low HP, fanatics/undead never break. **Fleeing requires a real
chance to get away** — a foe can only flee if it's at least as fast as you AND
you aren't dominating (`powerRatio < 1.4`); otherwise it's cornered and **yields
instead** (you can't outrun someone who's already beaten you). So overpowering a
foe — e.g. with magic — leaves them at your mercy, not cleanly escaped.

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

**Lethality** — `start_combat.lethal` decides the fight's nature. A **brawl**
(`lethal:false` — barfights, "teach him a lesson", guards subduing) stows both
sides' weapons and is fought bare-knuckle (`fistsProfile`, ~half damage); a foe
at 0 HP is **knocked out** (alive), not killed. It **auto-escalates to lethal**
the moment anyone commits a killing act: casting a spell or using a real weapon
technique (`escalateToLethal`), or the explicit **Draw Weapon** button. Once
lethal, real steel, real death, worse aftermath. Wilderness/monster/assassin
fights start `lethal:true`. Casting also sets `cs.magicCast`, and the
[COMBAT REPORT] flags it — **magic is rare and dreaded**, so working it in front
of common folk draws panic/terror/cries of witchcraft far beyond mere violence
(see the prompt's MAGIC IS RARE AND DREADED note).

**Item grants (on-equip spells).** An item may carry a `grants` block (combat
`abilities`, narrative `spells`, a `magicKnows` line). `equipItem` applies it and
records exactly what was NEWLY added on the item as `_granted`; `unequipItem`
revokes precisely that — so taking off a teaching item (e.g. the dev
`grimoire-firstflame`) disables the magic it gave, while spells you already knew
by other means are left untouched. **Claiming:** if you later acquire a granted
spell through regular means (the narrator emits it in `discoveries.spells`),
`mergeDiscoveries` untags it from `_granted`, so it stays with you when the item
comes off. Spell power still scales with Mind/Spellcasting.

**Loot is never automatic.** Only actual corpses (lethal kills) carry spoils;
yielded / fled / knocked-out foes give nothing. `applyCombatResult` stashes the
spoils as `pendingLoot` instead of granting them — the player must choose to
**Search the fallen**, which (a) grants the items via `applyLoot` and (b) fires a
`[LOOTED]` narrator beat that narrates it and adjudicates the fallout (rifling a
corpse in a public, lawful place draws horror/the watch; in the wilds nobody
cares). So a surrender no longer mysteriously pays coin, and you can't strip a
dead man's whole rig in a crowded tavern without consequence.

The narrator names and counts the foes in `start_combat.foes` (`name`, `count`),
and the engine honours them exactly (`generateEnemyGroup`) so the roster matches
the fiction — one laborer fought is one foe, not the template's range. The
`[COMBAT REPORT]` states the exact roster + fates and the prompt treats it as
authoritative, so the narrator can't invent extra bodies afterward.

**Aftermath** — every fight appends a `[COMBAT REPORT]` to `apiHistory` (outcome,
each foe's fate, ending HP, a blow-by-blow). The story ALWAYS continues from the
result: `handleResolveCombat` follows every outcome with a narrator call —
`[COMBAT OVER]` for win/stand-down/flee (narrate the aftermath strictly from the
report, name the actual beaten foe, leave room to react) or `[DEFEATED]` for a
loss. **Defeat is not game-over:** the narrator picks a non-lethal consequence
fitting the victor and place — robbed, jailed, thrown out, or captured and moved
(`tile_move`) — and the player wakes to face it. Actual death is reserved for
cold killers. The prompt forbids substituting a different character for the
beaten foe's role (the Karn→Silas bug).

**Environment** (`data/environment.js`, `playerUseEnvironment`): each fight rolls
1–3 single-use battlefield features from the terrain — flip a table for cover,
hurl a stool, topple a log, kick over a brazier (area fire), shove a boulder.
Each costs an action point and does something distinct (cover / throw+stagger /
topple+stun / area burn / heavy shove), so combat isn't only attack-vs-defend.

### Entry & outcome

Three ways in:
1. **Narrator-flagged** — the only way combat starts from the fiction. The
   narrator emits `start_combat` (system-prompt.js) ONLY on an *explicit* strike
   (the player or an NPC actually attacks), never on threats/standoffs. It names
   the foe(s) — a codex `npc_id` (built via `enemyFromNPC` from their real
   attributes + gear; their HP/status **persists** on `character.combatState`, so
   a foe you left wounded re-engages wounded, and one who yielded/died stays so —
   no full-HP reset) or a spawn `kind` — plus `initiator` and `surprise`. A foe
   that has already yielded is at the player's mercy (spare/kill/rob/capture,
   narrated directly) — the prompt forbids re-fighting or re-surrender loops.
   A `start_combat` never drops you straight into the tactical screen — it raises
   an **engage prompt** (`pendingEngage`: "To arms / Engage", or "Under attack /
   Defend") so the player consents to / navigates into combat after reading the
   opening; `App.startCombatFromDirective` then builds the foes. **Ambush:**
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

## Mounts & weight

Mounts are **companions you ride** — a `kind:"mount"` codex character in
`state.party`, built from `data/mounts.js` via `mountCodexEntry` (the same shape
as a recruited companion, plus a mount block). The ladder runs common→divine:
pony / horse / mule / camel (stable), warhorse / dire-wolf (rare),
griffon (epic), wyvern (legendary), drake (mythical), dragon (divine).

- **Weight, not headcount.** Every item has an *inferred* weight
  (`engine/weight.js`, `itemWeight` — by `kind` + name keyword, mirroring
  `combat-stats` inference; an explicit `weight` on a template wins; tools are
  hand-weighted). A character's carry cap is `carryCapacityFor` (Body + Vigor,
  back-loaded like HP). It's a **hard cap** at player-initiated points (shop buy,
  `economy.buyGood`); narrator-granted loot may still land but flags
  `overburdened` (slower travel).
- **Ride capacity** is the same currency: a mount bears riders up to
  `rideCapacity`, where a rider costs its `effectiveLoad` (body + worn + pack +
  everyone riding *it*, recursively — `engine/riding.js`). So a dragon carries a
  horse and its riders; a horse cannot carry a dragon. Seating is cycle-checked.
- **Travel.** A ridden **flying** mount (griffon→dragon) is air-travel reusing the
  Fly plumbing (`App.handleFly`) — no resolve, paid in the mount's own needs
  (must be fed/rested), same aerial-ambush risk and `[SEEN FLYING]` settlement
  reaction (emphasised for a dragon). A **ground** mount quickens a leg by its
  `moveProfile.ground`, over terrain it handles. Mounts eat their own `feed`
  (fodder / meat / livestock) from the pack (`engine/upkeep.autoConsumeMount`).
- **Combat.** A mount fights as an ally (`bestiary.allyFromCompanion` consumes its
  `naturalWeapon`/`naturalArmor`/`innatePassives`/`health`), and a ridden rider
  gets the mount's `mountedBonus` charge. A slain mount throws its riders.
- **Acquisition.** Mundane mounts are **haggled for** at a stable — a narrated
  dealing like recruiting a companion: the player approaches (`StableView` "Haggle"
  → `App.handleApproachMount` → `[APPROACH MOUNT]`), the stabler shows the beast and
  names a price, and the sale closes only when the narrator sets
  `buy_mount:{id, priceCp}` (`beat.js` clamps the agreed price to a sane band of the
  list and takes the coin). Exotic/flying mounts are **earned** via `beat.grant_mount`
  (`ground-drake` is earned, not sold). Either way the beast joins as a full
  `kind:"mount"` codex character (race + breed + combat kit).
- **Naming.** A mount arrives **already named** — no forced prompt. The name comes
  from the fiction: the **stabler** names a bought beast (`buy_mount.name`), and the
  narrator/player names a **tamed** one (`grant_mount.name` — a tamed beast has no
  trader to name it). When the narrator gives no name, the engine falls back to
  `generateMountName(race)` (racial name pools in `data/mounts.js`). The player can
  **rename** anytime from the Codex (per-mount Rename button → `handleRenameMount`).
- **Ride capacity is by weight, realistically.** A person is ~14 stone, so a
  `rideCapacity` is sized for **1–2 riders + gear**, not a crowd — a Swamp Nag (36)
  bears two adults but not three; only large beasts (stag, lizard, drake, dragon)
  carry more. `bodyWeight` is the creature's own mass (a horse ~70, a dragon ~1500)
  for nesting (`engine/riding.js`).
- **Region-gated stable stock.** A stable sells **region-appropriate** mounts: the
  selection is resolved per tile from `STABLE_STOCK_BY_BIOME` / `stableStockFor(biomeId)`
  (`data/mounts.js`, keyed by `getBiome(x,y).id`) — or a handcrafted `poi.mounts`
  override (the hook for a future great human capital) — then **seed-rolled** per
  tile per restock window by `rollStableMounts` (`town-gen.js`, mirroring
  `rollShopStock`): the `signature` mount is always in stock, the rest rotate by
  chance. So the swamp Mire sells nags, the steppe sells camels/axe-beaks, the
  Drakeholt sells ridge-ponies, human lands carry the premium Courser, etc. The
  expanded roster adds fantasy GROUND mounts (war-stag, ram, axe-beak, dire-boar,
  Saddle Basilisk) that bridge horse → earned flyer; camel is now an arid/steppe
  beast (the dead "desert" terrain is gone).
- **Per-mount endurance** (`needsDecayMult`, default 1; `data/mounts.js`): scales how
  fast a mount's needs drain in `companionUpkeep` and its flight stamina in
  `App.handleFly` (a courser/camel is thrifty <1; a hungry carnivore >1). A courser
  is *faster + needs-thriftier*; a war-stag *fights harder + carries more*.

- **Transient buffs & graceful degradation.** Capacity is *derived*, never a
  bare number a buff should overwrite. A temporary lift is an additive bonus the
  formula reads: `character.carryBonus` (folded into `carryCapacityFor`) and
  `mount.rideCapacityBonus` (folded into `rideCapacityOf`). Set the field when the
  buff lands, clear it when it lapses. Because the player's `carryCapacityMax` is
  recomputed every beat and a mount's load is checked live (`isOverloaded`), when
  a buff lapses and the bearer is now over its standard limit it is simply flagged
  — `overburdened` (slower travel) for the player, overloaded for a mount (can't
  fly, no speed bonus) — with **nothing dropped and no rider thrown**; it clears
  itself the moment weight comes down or the buff returns. Never write
  `carryCapacityMax` directly (the recompute would wipe it).

- **Boon spells & haste.** Buffs are timed conditions (`data/conditions.js`) laid
  by **boon spells** (`data/buff-spells.js` — `haste`, `bear-strength`), learned
  like travel spells (folded into `getAbilityDef`, flagged `noncombat`) and cast
  from the character sheet (`App.handleCastBuff` spends Resolve, lays the timed
  condition). A condition's engine-wired fields (`travelSpeedMult`, `carryBonus`,
  `rideCapacityBonus`) drive effects via `engine/buffs.js`, which `beat.js` reads
  each beat — so a strength boon lifts the player's carry cap and the **ridden**
  mount's `rideCapacityBonus`, and both fall back gracefully on expiry.
  - **Haste covers mounts** (ground + flight) and is **drain-safe by construction**:
    needs and mount-flight stamina are purely *time*-based, so haste only ever
    shortens time-per-distance — ground legs take fewer minutes, flight legs reach
    further within ~the same hour (`hastedGroundMinutes`/`hastedFlightHexes`/
    `hastedFlightMinutes`). A faster journey therefore costs the same upkeep or
    less, never more.

Verify with `node scripts/mount-weight-sim.mjs` (weight math, nesting + ancestor
capacity, pack/overload edge cases, transient-buff expiry, speed-buff drain-safety,
mounted combat, flying gate) plus the build below.

## Character positions & scrying

Every codex character carries a **hidden, mechanically-tracked location** —
`at:{x,y,day}` plus a `home` — owned by `engine/positions.js`. It is **never shown
in the normal UI**; the player only learns a whereabouts by **scrying**.

- **Lazy drift.** `characterPosition(state, id)` resolves the player and anyone in
  the party to the player's current tile (exact); everyone else **drifts** — a slow,
  homeward-biased random walk — but it's computed *on demand* from `at` + days
  elapsed (seeded, deterministic), so tracking "everyone" costs nothing per beat.
- **Stamping.** A parted companion / loosed mount is stamped at the hex you left
  them (`beat.js` `part_ways`), so they linger and drift from there. The narrator
  places/moves NPCs by setting `discoveries.characters:[{id, at:{x,y}}]`
  (`mergeDiscoveries` merges it). A few anchors are seeded in `initial-state.js`
  (e.g. the Vale-King at Asalan); unplaced characters read as "whereabouts unknown"
  until staged.
- **Scrying** is the one reveal (`positions.canScry` — knows Farsight, carries a
  scrying focus, or stands at a scrying basin/observatory). `App.handleScry`
  (a Scry button on each character in the Codex) computes `scryResult`, marks the
  hex seen, and feeds the narrator a `[SCRY]` directive with the hex + nearest
  place; doctrine forbids the narrator from revealing a location any other way.

## Quick smoke test

After data edits, run:

```bash
npm run build && npm run build:web
```

The build is sensitive to syntax and module shape. If it passes both targets,
the data layer is internally consistent. Also see `/tmp/smoke.mjs` (ad-hoc;
not checked in) for a deeper invariant check — overlapping biomes, missing
faction ids, river/handcrafted conflicts.
