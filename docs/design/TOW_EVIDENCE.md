# Tower of Winter — mechanical evidence ledger

Harvested 2026-08-11 from the community wiki. This file is the source of truth for the
1:1 port. Anything not recorded here is a gap, and a gap is never filled by inventing a
number — it is either captured or the feature waits.

**Sources**

- `wiki:traits` — <https://towerofwinter.fandom.com/wiki/Category:Trait>
- `wiki:fusions` — <https://towerofwinter.fandom.com/wiki/Fusion_Traits>
- `wiki:statuses` — <https://towerofwinter.fandom.com/wiki/Statuses>
- `wiki:skills` — <https://towerofwinter.fandom.com/wiki/Skills>
- `wiki:arctic-knight` — <https://towerofwinter.fandom.com/wiki/Arctic_Knight>
- `wiki:gatekeeper` — <https://towerofwinter.fandom.com/wiki/The_Gatekeeper>
- `wiki:campaign` — <https://towerofwinter.fandom.com/wiki/Tower_of_Winter_(Campaign)>
- `namu:general-abilities` — <https://namu.wiki/w/%EA%B2%A8%EC%9A%B8%EC%9D%98%20%ED%83%91#s-11.1>
- `namu:traits` — <https://namu.wiki/w/%EA%B2%A8%EC%9A%B8%EC%9D%98%20%ED%83%91/%ED%8A%B9%EC%84%B1>
- `community:english-status-capture` — <https://docs.google.com/spreadsheets/d/13_DI2wHUsqMVt0BsJAyhXIixzUIvTikRNMBBtzgERhw/edit?usp=sharing>

Confidence tags: `observed` (stated outright by a source), `derived` (follows from two or
more observed facts), `gap` (not established — must not be guessed).

## What this replaces

The previous `src/gameplay/reference/` catalogue was built from a Play Store screenshot
and two 2023 dcinside forum posts. Every content value in it is contradicted below. It
is superseded wholesale, not corrected in place.

| Previously implemented | Actual | Source |
|---|---|---|
| Skill loadout capacity 3 | **5** | `wiki:skills` |
| Trait capacity unbounded, cap 7 ranks | **10 traits, 7 ranks** | `wiki:traits` |
| Fusion `steelification` = Ironclad + Force Field at rank 1, no rune, `combatEffect: null` | **Metalize** = Ironclad + Aegis, **both at rank 7**, **Rune of Metal**, grants **40 Steelskin**, and **consumes both components** | `wiki:fusions` |
| Arctic Knight: 24 HP, 8 ATK, 2 DEF | **170 HP, 12 ATK, 13 DEF, 9% crit, 4% dodge** | `wiki:arctic-knight` |
| Arctic Knight starting skills: Emergency Evasion + Sleep Bomb | **Strike + Block**; starting trait **Ironclad** | `wiki:arctic-knight` |
| Gatekeeper: 60 max HP, placeholder 2–4 dmg attacks | **190 HP, 23 ATK, 6% crit, 1% dodge**, Ironclad (+4 Steelskin), six named attacks 11–50 dmg | `wiki:gatekeeper` |
| Skill uses are per-encounter | **Per act** — refilled at the start of each act, and by events, items, meditation | `wiki:skills` |
| "Sleep Bomb", unlimited duration | **Sleep Grenade** — 3 turns Sleep, 4 uses, cooldown 6 | `wiki:skills` |
| Single act, 12-position route, 11 empty steps | **6 acts**, each a named area with its own enemy roster, miniboss and boss | `wiki:campaign` |

## Core model

The single most important structural finding: **Tower of Winter is a status-stack
engine.** Almost every trait grants a *numeric status count* rather than a bespoke
triggered effect. Combat resolution is: apply statuses, resolve hits against them, then
tick them down by well-defined per-turn and per-hit rules.

This is why the current kernel cannot express the game. It models an actor as
`{hp, maxHp, guard, stats:{attack, defense}}` with two hard-coded actions. It has no
status counts, no crit, no dodge, no shield pool, no multi-hit, no action order.

### Actor stats (`observed`, `wiki:arctic-knight`, `wiki:gatekeeper`)

`HP`, `ATK`, `DEF`, `Critical Rate %`, `Dodge Rate %`. Enemies carry the same five.

### Multi-hit is first-class (`observed`, `wiki:gatekeeper`, `wiki:statuses`)

Enemy attacks declare a **Number of Hits**. This is load-bearing, not cosmetic:

- Steelskin reduces damage **per individual hit**.
- Thorn retaliates **once per hit received**.
- DoomAtk inflicts Doom **per individual attack**, stacking within a round.
- Burn stacks are **reduced per individual hit**.

Any engine that collapses an attack into one damage number computes these wrong.

### Shield / armour is a pool separate from HP (`observed`, `wiki:skills`)

`Block` grants shield equal to 250–500% of DEF. `Parry` grants 270–430% of ATK.
`Urgent Guard` grants 100% of DEF. Shield absorbs before HP.

Solitaire lifecycle (`adapted`, user-confirmed): Ward is a brace for the next opposing
command window, not banked health. Multiple ward effects inside one ability combine into
that ability's brace; using another ward ability in the same window refreshes to the larger
pool rather than adding pools. Any remainder expires after the opposing window. Protection
is intentionally different: it persists between turns and loses one stack per landed hit.

### Rarity (`observed`, `wiki:skills`)

Six tiers applying to items, traits and skills:
Common (white), Uncommon (green), Rare (blue), Epic (purple), Legendary (yellow),
Mythical (red). Fusion traits render purple-pink and are always max rank.

## Traits

**Rules** (`observed`, `wiki:traits`)

- Max **7 ranks** per trait; a character holds at most **10 traits**.
- Acquired from: starting character, destiny cards, equippable items, emblems, dungeon events.
- A duplicate raises rank. Values below are quoted **rank 1 – rank 7**.
- Fusions are offered as an *item upgrade* once both components are rank 7 and the
  matching rune is held. Fusing **removes both components** and grants the fusion at
  rank 7, which cannot be improved further.

| Trait | Effect (rank 1 – 7) | Fusion | Pair | Rune | Fusion effect |
|---|---|---|---|---|---|
| Aegis | Gain 3–21 Protection | Metalize | Ironclad + Aegis | Metal | Gain 40 Steelskin |
| Ironclad | Gain 1–13 Steelskin | | | | |
| Agility | Gain 1 Evade/turn, 2–23% chance | Rogue | — `gap` | `gap` | Gain 1 Conceal every 2 turns (Conceal: +80% Dodge) |
| Swift | Gain 1 Haste/turn, 2–18% chance | | | | |
| Destructor | Gain 2–25 DoomAtk (from event outcomes) | Inferno | Ignition + Destructor | Inferno | Inflict 80 Burn at combat start |
| Ignition | Gain 3–25 Burn | | | | |
| Fortitude | Gain 2–25 Unstoppable | Supreme | — `gap` | `gap` | Gain 50 LethargyAtk |
| Valiancy | Gain # LethargyAtk (Old King of Northland only) | | | | |
| Detection | Gain 1–14 Thorn every 4 turns | Extinction | Detection + Reflection | Extinction | Gain 85 Thorn |
| Reflection | Gain 2–28 Thorn | | | | |
| Bloodsuck | Gain 3–18% Lifesteal | Rupture | Bloodsuck + Fury | Rupture | Gain 2 BleedAtk every turn; loses Lifesteal and Fury |
| Fury | Gain 1–10 Strength every 4 turns | | | | |
| Luck | Inflict 18–180 Misfortune, 75% chance | Justice | — `gap` | `gap` | Gain 100 Judgment every 2nd turn (temporary DoomAtk, lost on attack). Exiled Priestess only |
| Decay | Inflict 1–10 Poison every 3 turns | Despair | — `gap` | `gap` | Inflict 7 Cripple every second turn |
| Overwhelm | Inflict 1–13 Cripple | | | | |
| Charge | Gain 100 Charge every 5→2 turns | Tempest | — `gap` | `gap` | Inflict 80 Doom to enemy every turn |
| Shocker | Paralyze the enemy every 7→4 turns | | | | |
| Adaptation | Gain 4–40 Grow every 4 turns | Embiggen | Survival + Adaptation | Embiggen | Gain 30 Grow each turn; loses Survival |
| Survival | Gain 8–80 Grow | | | | |
| Fatality | Gain 4–48 Overload every 4 turns | Berserker | Rage + Fatality | `gap` | Gain 100 Berserk, first turn only |
| Rage | Gain 1–12 Strength | | | | |
| Venom | Gain 1–5 PoisonAtk | Biochem | — `gap` | `gap` | Gain 15 PoisonAtk |
| Innovation | Gain 3–15 ATK or DEF by rank parity (odd → Strength, even → DEF). Owner of Clocktower only | | | | |
| Ambush | Inflict 1–4 Weak | Breakdown | Ambush + Anatomy | `gap` | Inflict 9 Vulnerable at combat start |
| Anatomy | Gain 3–30% Focus | | | | |
| Endurance | Gain 1–10 Solidity | Intangible | Endurance + Guardian | Intangible | Gain 7 Invincible at combat start (no damage from attacks for 7 turns) |
| Guardian | Gain 1–4 Guard every 5 turns (from event outcomes) | | | | |
| Accuracy | Gain 5–50 Sharpen | Shadowcast | — `gap` | `gap` | Gain 15 Eviscerate |
| Assassin | Gain 2–5 Eviscerate (Last Assassin only) | | | | |
| Gale | Gain Initiative on attacking; at 100 Initiative gain 1 Priority | Flash | Quickness + Gale | Flash | Gain 6 Priority at combat start; loses Quickness and Gale |
| Quickness | Gain 0–3 Priority | | | | |
| Necromancy | Gain 1–4 Skeleton each turn | Bone Army | — `gap` | `gap` | Gain 25 Skeleton |
| Overheat | Gain and inflict 2–18 Limp each turn | Stabilization | — `gap` | `gap` | Inflict 10 Limp each turn |

Berserk (`observed`, `wiki:fusions`): 100 at battle start, raises attack damage, and is
**lost once you hit or are hit**.

Priority (`observed`, `wiki:fusions`): act a number of times before the enemy. If the
enemy also has Priority, the two **cancel out**.

## Statuses

Each status carries a **Count**. The wiki table declares four lifecycle flags per
status: *Permanent*, *Removed at end of turn*, *Decrease at end of turn*,
*Decrease when hit*.

Captured 2026-08-11 by reading the table cells directly out of the DOM. Flags below are
`observed` unless noted.

Lifecycle gaps were rechecked 2026-08-14 against the English in-game trait/status capture
linked from the community preservation document. That capture resolves the persistent,
end-of-turn, and per-hit rows recorded below; bespoke contact rules such as Sleep and
Berserk remain explicit because they remove the whole stack rather than one Count.

> **Reading a blank row.** A status with no flags is *undocumented on the wiki*, not
> "has no lifecycle". Treat blanks as `gap` — several are almost certainly
> battle-persistent stats (Lifesteal, Strength, Focus, Sharpen), but that is inference,
> not evidence.

Two entries are worth calling out because they shape the engine:

- **Protection is permanent *and* decreases when hit.** It persists across turns but is
  consumed by incoming hits — a depleting pool, not a flat modifier.
- **Solidity and Guard both decrease at end of turn *and* when hit**, so a percentage
  reduction is spent by whichever comes first.

Lifecycle key: **Perm** = permanent · **EoT-rm** = removed at end of turn ·
**EoT−** = decreases at end of turn · **Hit−** = decreases when hit.

| Status | Source trait | Effect | Lifecycle |
|---|---|---|---|
| Protection | Aegis | Damage received from enemy attacks is reduced | **Perm + Hit−** |
| Steelskin | Ironclad | Reduces Count damage from enemy attacks, **applied to each individual hit** | **Hit−** |
| Evade | Agility | +60% dodge rate for 1 turn | **EoT−** |
| Haste | Swift | Gains an additional action during battle (trait/status activations are not added) | **EoT−** |
| DoomAtk | Destructor | Each individual attack inflicts Count Doom on the enemy; multiple hits in a round stack. Doom bypasses defences but takes effect **after the enemy acts** | **EoT-rm** |
| Burn | Ignition | Deal fixed damage equal to Count | **Hit−** |
| Unstoppable | Fortitude | Ignores action-nullifying debuffs (`wiki:skills`) | **EoT−** |
| Tenacity | Fortitude | Increases DEF by Count; gained every 4 turns | **Perm** |
| Thorn | Detection, Reflection | Damages the attacker when hit, once per hit | **Perm** |
| Lifesteal | Bloodsuck | Recover HP in proportion to damage dealt | **Perm** |
| Strength | Fury, Rage | Raises attack | **Perm** |
| Misfortune | Luck | Deal Count damage at the beginning of the enemy turn | **EoT-rm** |
| Poison | Decay | Fixed boundary damage | **EoT−** |
| Cripple | Overwhelm | Reduces ATK for the encounter | **Perm** |
| Charge | Charge | Empowers the next landed hit | **EoT-rm** |
| Grow | Adaptation, Survival | Accumulating combat growth | **Perm** |
| Overload | Fatality | Gain temporary Count attack power, **lost at end of turn** | **EoT-rm** |
| PoisonAtk | Venom | Inflicts Poison per landed hit | **Perm** |
| Weak | Ambush | Reduces ATK while present | **Hit−** |
| Focus | Anatomy | Raises offensive precision | **Perm** |
| Solidity | Endurance | Reduces damage taken from attacks by **30%** | **EoT− + Hit−** |
| Guard | Guardian | Reduces damage taken from attacks by **50%** | **EoT− + Hit−** |
| Sharpen | Accuracy | Raises offensive accuracy | **Perm** |
| Eviscerate | Assassin | Inflicts Vulnerable per landed hit | **Perm** |
| Priority | Quickness, Gale | Act before the enemy; cancels against enemy Priority | **EoT−**, and spent per extra action |
| Doom | — | Fixed Count damage, **ignores all defences** | **EoT-rm** |
| Invincible | Intangible | Takes no damage from attacks | **EoT−** (7-turn grant observed) |
| Conceal | Rogue | +80% dodge | **EoT−** |
| Sleep | Sleep Grenade | Nullifies actions; loses one per skipped command, but **any landed hit removes all Sleep** | bespoke (`observed`) |
| Paralyze | Rapid Cooling, Mortal Blow | Nullifies actions | `gap` |
| Bleed | Slaughter, Rupture | Damage over time | `gap` |
| Lethargy | Shouting, Valiancy | Reduces ATK; repeated landed hits stack it and can reduce ATK to zero | **Perm** (`adapted`, user-confirmed target behaviour) |
| Vulnerable | Breakdown | +50% damage to the next landed hit | **Hit−** |
| Skeleton | Necromancy | `gap` | `gap` |
| Limp | Overheat | Accumulating impairment for the encounter | **Perm** |
| Berserk | Berserker | Count% attack damage on one landed hit; entire stack is lost on hitting or being hit | bespoke (`observed`) |
| Initiative | Gale | Accumulates on attacking; 100 converts to 1 Priority | **Perm** |

## Skills

**Rules** (`observed`, `wiki:skills`)

- Up to **5 slotted skills**.
- Skills have **uses**, shown as a fraction, and a **limit per act**. Depleted skills grey
  out. They refill **fully at the start of each act**, and partially from events, items and
  meditation — every refill method adds the same amount to *all* skills equally.
- A duplicate acquisition **upgrades** the skill (larger effect or more uses) and refills it.
- Some skills **replace** the basic attack or the basic defence rather than taking a slot.
- **Unslotted skills** are immediate permanent stat increases and consume no slot.
- Some skills **do not consume a turn**; some carry a **cooldown** in turns.

### Arctic Knight basic skills (`observed`, `wiki:arctic-knight`)

Ranked values are quoted rank 1 → max.

| Skill | Rarity | Effect | Limit per act |
|---|---|---|---|
| Strike | Common (starting) | Damage = (100/115/130/145/160/175)% of ATK | Unlimited |
| Shield Bash | Uncommon | Damage = (105/120/135/150/165)% of DEF. **Replaces Strike** | Unlimited |
| Slaughter | Uncommon | Damage = (21/24/27/30/33)% of ATK, plus Bleed of the same | Unlimited |
| Block | Common (starting) | Armour = (250/300/350/400/450/500)% of DEF | 30 |
| Defensive Stance | Uncommon | 3 Defensive Stance (50% damage reduction). **Replaces Block** | 18/21/24/27/30 |
| Parry | Uncommon | Armour = (270/310/350/390/430)% of ATK. **Replaces Block** | 25 |

### Arctic Knight exclusive skills (`observed`, `wiki:arctic-knight`)

| Skill | Rarity | Effect | Limit per act |
|---|---|---|---|
| Threatening Cry | Uncommon | Neutralization = (60/70/80/90/100)% of ATK. No turn cost | 7 |
| Mortal Blow | Uncommon | Damage = (210/240/270/300/330)% of ATK; paralysed until your next turn | 3 |
| Giant's Smash | Rare | Damage = (13/16/19/22)% of max HP; stuns 1 turn | 3 |
| Deliberate Blow | Rare | Damage (110/135/160/185)% of ATK **and** armour (110/135/160/185)% of DEF | 10 |
| Warcry | Rare | 3 Solidity (30% reduction). No turn cost | 4/5/6/7 |
| Fist of Justice | Rare | Damage = (115/140/165/190)% of DEF, inflicts equal Lethargy | 5 |
| Retaliation | Legendary | Counterattack = (160/240)% of DEF | 8 |
| Brutal Slash | Legendary | Deal (36/`gap`)% damage and inflict the same | 3 |
| Incineration | Mythical | Damage = 110% of ATK, ignition = 110% of ATK, gain 2 Paralysis | 1 |

### Legacy Fandom common-skill capture (`observed`, `wiki:skills`)

This table records the earlier Fandom snapshot and remains useful for exact values and
save compatibility. It is not the canonical replacement-pool membership list; that is
the current Namu section 11.1 list immediately below.

| Skill | Effect | Uses | Notes | Rarity |
|---|---|---|---|---|
| Emergency Evasion | Gain 1 Evade | 4 | No turn cost | Rare |
| Elixir of Wrath | Gain 6 Strength | 3 | No turn cost | Uncommon |
| First Aid | Heal 24% of lost HP; reduce Bleed, Burn, Poison stacks to 60% | 5 | | Uncommon |
| Impregnable | 9 rounds of Guard (50% reduction) | 2 | | Legendary |
| Judge of Fate | Inflict 30% of enemy's lost HP as Misfortune | 2 | No turn cost, cooldown 6 | Legendary |
| Penetration | Deal 180% of ATK as Doom | 7 | | Uncommon |
| Rapid Cooling | Inflict 2 Paralyze, gain 1 Solidity | 5 | Cooldown 3 | Uncommon |
| Rising Power | Gain 100 Charged and 15 Overload | 7 | | Uncommon |
| Shouting | Inflict 60% of ATK as Lethargy | 7 | No turn cost | Uncommon |
| Sleep Grenade | Inflict 3 turns Sleep (nullifies actions, negated by a hit) | 4 | Cooldown 6 | Rare |
| Sudden Blow | Deal 80% of ATK | 6 | No turn cost | Rare |
| Thirst for Blood | Gain (16/20) Lifesteal | 4 | No turn cost, cooldown 9 | Rare → Epic |
| Transcendence | Gain 8 ATK, 8 DEF, 20% Focus | 1 | | Legendary |
| Unbendable Will | Unstoppable +4 (ignores action-nullifying debuffs) | 4 | No turn cost | Rare |
| Urgent Guard | Shield = 100% of DEF | 9 | No turn cost | Uncommon |

### General active ability replacement pool (`observed` names, `namu:general-abilities`)

The current Namu section 11.1 lists 18 General active abilities: Penetration, Rapid
Cooling, Urgent Guard, Stone Skin Elixir, Protection Scroll, Elixir of Wrath, First Aid,
Emergency Evasion, Sudden Blow, Unbendable Will, Killing Instinct, Sleep Grenade Toss,
Blade of Curse, Beastification, Judge of Fate, Super Speed, Transcendence, and Peace
Declaration.

All 18 are plumbed as flexible reward abilities. A starting character equips none of
them; a later General acquisition may replace one of the three character-exclusive
slots but cannot replace the protected Basic Attack or Defensive slot. Older shared
skill ids that are absent from this 18-entry source list remain loadable only for save
compatibility and are not offered by the canonical General pool.

### Unslotted skills (`observed`, `wiki:skills`)

Power of Beast (ATK +3, Uncommon) · Bless of Life (max HP +30, Uncommon) ·
Assassin's Skill (crit +8%, Uncommon) · Power of Giant (ATK +5, Rare) ·
Bless of Earth (DEF +5, Rare) · Swift of Gale (dodge +4%, Rare) ·
Limit Breaker (crit +3%, dodge +3%, Rare) · Bless of God (ATK +2, DEF +2, max HP +20, Epic) ·
Protected by God (DEF +7, Legendary) · Infinite Vitality (max HP +70%, Legendary) ·
Crushing Blow (crit +12%, Legendary) · Ascension (ATK +3, DEF +3, crit +3%, dodge +3%, Mythical)

## Characters

### Arctic Knight (`observed`, `wiki:arctic-knight`)

Free, unlocked from the start — the only automatically owned character.

| HP | ATK | DEF | Crit | Dodge | Starting trait | Starting skills |
|---|---|---|---|---|---|---|
| 170 | 12 | 13 | 9% | 4% | Ironclad | Strike, Block |

Its Act 1 is an authored narrative gauntlet: prose nodes with choices that award
`+1 ATK`, `+1 DEF`, `+Item` or `+Skill`, interleaved with named combats (Undead
Crossbowman, Undead Swordsman, Undead Raider, Undead Heavy Armor, Gatekeeper).
There is a named dead ending, *Collapse*.

Other characters named on the wiki, not yet captured: Assassin (Last Assassin),
Old King of Northland, Owner of Clocktower, Exiled Priestess, Demon Slayer,
Brothers in Eternity, Desinity, Undying King, Ancient Almighty, Ancient Sentinel,
Ancient Slayer, Dimension Breaker, Demon Slayer.

## Enemies

### The Gatekeeper (`observed`, `wiki:gatekeeper`)

Act 2 miniboss. Trait: Ironclad (+4 Steelskin) — reduces all incoming damage by 4.

| HP | ATK | Crit | Dodge |
|---|---|---|---|
| 190 | 23 | 6% | 1% |

| Attack | Hits | Damage | Notes |
|---|---|---|---|
| Slash | 1 | 50 | Gains Paralyze (1) after this attack |
| Smack Down | 1 | 37 | |
| Swing | 1 | 33 | |
| Strike Up | 1 | 22 | |
| Thrust | 1 | 15 | |
| Tackle | 1 | 11 | |

Each attack carries flavour text describing the wind-up — this is the telegraph. Whether
the upcoming attack is shown to the player before they commit is still a `gap`.

Enemy roster by act is captured in `wiki:campaign`; individual stat blocks beyond the
Gatekeeper are not yet harvested.

## Campaign structure (`observed`, `wiki:campaign`)

Tower of Winter is the free starting campaign, **6 acts**:

| Act | Area | Boss |
|---|---|---|
| 1 | Gray Forest | Hungry Sacred Tree (miniboss: Monster Bird) |
| 2 | Entering the Tower | Brothers in Eternity (miniboss: The Gatekeeper) |
| 3 | Worship Area | Lunatic Elder Dragon (miniboss: Witch of Abyss) |
| 4 | Research Area | The Stopped King (miniboss: Master of Holy Flame) |
| 5 | `gap` | Dimension Predator |
| 6 | `gap` | Heart of Winter |

Enemy rosters overlap between adjacent acts and escalate — Act 1 is undead, Act 2 adds
zealots, Act 3 is zealot-dominant, Act 4 introduces Ancients.

## Release-blocking gaps

1. **Per-status effect magnitudes** for the 13 statuses whose Effect cell is blank on the
   wiki (Poison, Cripple, Charge, Grow, PoisonAtk, Weak, Focus, Sharpen, Eviscerate,
   Lifesteal, Strength, Unstoppable, Priority). The lifecycle matrix itself is captured.
2. **Turn order and intent visibility.** Whether the player sees the enemy's next attack
   before committing is unestablished, and it decides whether the game is about reading
   or about odds.
3. **Damage formula.** How ATK, DEF, Protection, Steelskin, Solidity, Guard, shield and
   crit compose into a final number. Every individual modifier is known; the order of
   application is not.
4. **Dodge and crit resolution** — roll order, and whether Evade/Conceal add or replace.
5. **Reward offer generation** — pool, count, weighting, refresh rules.
6. **Runes** — how they are acquired, and the rune for 9 of the 18 fusions.
7. **Per-act node topology** — how many encounters, how events and rest are placed.
8. **Remaining stat blocks** — every enemy other than the Gatekeeper.
9. **Remaining characters** — 12 named, 1 captured.
