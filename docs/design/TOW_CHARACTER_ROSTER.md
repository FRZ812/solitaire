# Tower of Winter character-roster adaptation ledger

Captured 2026-08-14 for the five-active-ability character templates.

The reference game supports a five-slot skill inventory and lets later acquisitions
replace equipped skills. This implementation makes that rule explicit:

1. Slot 1 is the character's protected Basic Attack.
2. Slot 2 is the character's protected Defensive ability.
3. Slots 3–5 are flexible and begin with three character-exclusive abilities.
4. A General ability can later replace only one of slots 3–5.
5. No starting archetype begins with a General ability.

This is deliberately separate from `TOW_EVIDENCE.md`. Names and documented mechanics
stay literal where evidence exists; `adapted` entries preserve the sourced combat
identity with kernel-native values where the accessible source does not publish a
coefficient.

## Sources

- `namu:characters` — <https://namu.wiki/w/%EA%B2%A8%EC%9A%B8%EC%9D%98%20%ED%83%91/%EC%BA%90%EB%A6%AD%ED%84%B0>
- `namu:characters-mirror` — <https://www.namu.moe/w/%EA%B2%A8%EC%9A%B8%EC%9D%98%20%ED%83%91/%EC%BA%90%EB%A6%AD%ED%84%B0>
- `namu:general-abilities` — <https://namu.wiki/w/%EA%B2%A8%EC%9A%B8%EC%9D%98%20%ED%83%91#s-11.1>
- `fandom:roster` — <https://towerofwinter.fandom.com/wiki/TowerofWinter_%28By_Tailormade_Games%29_Wiki>
- `fandom:arctic` — <https://towerofwinter.fandom.com/wiki/Arctic_Knight>
- `fandom:clocktower` — <https://towerofwinter.fandom.com/wiki/Owner_of_Clocktower>
- `fandom:skills` — <https://towerofwinter.fandom.com/wiki/Skills>
- `fandom:statuses` — <https://towerofwinter.fandom.com/wiki/Statuses>
- `official:changelog` — <https://apps.apple.com/sg/app/tower-of-winter/id6449329520>
- `historical:values` — <https://gall.dcinside.com/mgallery/board/view/?id=tow&no=2268>

Fidelity labels: `direct` means the implemented name and numbers are documented;
`adapted` means the documented identity or behavior is retained while its values are
fitted to this combat kernel.

## Complete roster and source chassis

| # | Character | HP | ATK | DEF | Crit | Dodge | Starting mechanic |
|---:|---|---:|---:|---:|---:|---:|---|
| 1 | Arctic Knight / 극지의 기사 | 170 | 12 | 13 | 9% | 4% | Ironclad 3 |
| 2 | Demon Slayer / 악마 살육자 | 160 | 13 | 12 | 9% | 5% | Quickness 3 |
| 3 | Owner of Clocktower / 시계탑의 주인 | 150 | 14 | 14 | 9% | 4% | Innovation 3 |
| 4 | Old King of Northland / 북부의 옛 왕 | 160 | 14 | 13 | 6% | 4% | Valiancy 3 |
| 5 | Sleepless One / 잠 못드는 자 | 190 | 12 | 15 | 3% | 3% | Ignition 3 |
| 6 | Last Assassin / 최후의 암살자 | 160 | 14 | 11 | 12% | 5% | Combo 3 |
| 7 | Witch of Eternity / 영겁의 마녀 | 150 | 10 | 15 | 12% | 5% | Necromancy 3 |
| 8 | Tenacious Mage / 집념의 마도사 | 150 | 15 | 12 | 6% | 5% | Charge 3 |
| 9 | Exiled Priestess / 추방된 성녀 | 144 | 11 | 16 | 6% | 4% | Judgment 3 |
| 10 | Wandering Blade / 방랑하는 검 | 160 | 14 | 12 | 9% | 5% | Gale 3 |
| 11 | Desolate Vampire / 비탄의 흡혈귀 | 170 | 13 | 13 | 9% | 4% | Bloodsuck 3 |
| 12 | Forsaken Automaton / 남겨진 자동인형 | 200 | 15 | 10 | 6% | 3% | Overheat 3 |

## Five-active-ability starting matrix

| Character | Fixed Basic Attack | Fixed Defensive | Flexible exclusive 1 | Flexible exclusive 2 | Flexible exclusive 3 |
|---|---|---|---|---|---|
| Arctic Knight | Strike — 100% ATK (`direct`) | Block — 250% DEF ward (`direct`) | Deliberate Blow — 110% ATK + 110% DEF ward (`direct`) | Incineration — damage, Burn, self-Paralyze (`direct`) | Mortal Blow — 210% ATK, self-Paralyze (`direct`) |
| Demon Slayer | Shoot — 100% ATK (`direct`) | Evasion — Evade + 220% DEF ward (`direct`) | Kick — damage + Stun (`direct`) | Arrow Rain — four-hit Poison barrage (`adapted`) | Tracker's Net — bind + exposure (`adapted`) |
| Owner of Clocktower | Fire — 100% ATK (`direct`) | Suppressive Shot — DEF-scaled Lethargy (`direct`) | Missile Support — swift 200% ATK (`direct`) | Redesign — Tenacity + Strength (`direct`) | Improvement — swift Strength + Tenacity (`direct`) |
| Old King of Northland | Cleave — 100% ATK (`direct`) | Vitality — heal 185% DEF (`direct`) | Whirlwind — three-hit Lethargy pressure (`adapted`) | Earthquake — damage + Lethargy shockwave (`direct`) | Neutralizing Blow — DEF damage + Lethargy (`adapted`) |
| Sleepless One | Flame Strike — attack + Burn (`adapted`) | Flame Curtain — ward + Burn (`adapted`) | Entangling Roots — bind + Poison (`adapted`) | High-Speed Flight — Priority 4 (`direct`) | Fire Essence — swift Strength + Overload (`adapted`) |
| Last Assassin | Flurry — native two-hit attack (`direct`) | Deflect — 175% DEF ward (`direct`) | Flash Bomb — control + exposure (`adapted`) | Execution — missing-health finisher (`adapted`) | Storm of Knives — four hits + Bleed (`adapted`) |
| Witch of Eternity | Skull Throw — 100% ATK (`adapted`) | Bone Shield — ward + Skeletons (`adapted`) | Skeleton Summon — swift Skeleton gain (`adapted`) | All-Out Attack — army burst + Doom (`adapted`) | Mirror Image — Evade + Skeleton preservation (`adapted`) |
| Tenacious Mage | Magic Arrow — 100% ATK (`adapted`) | Barrier — ward + Protection (`direct`) | Flame Storm — three-hit Burn spell (`adapted`) | Amplification — swift ATK-scaled Strength (`direct`) | God-Slaying Spear — 360% ATK, self-Paralyze (`adapted`) |
| Exiled Priestess | Crush — attack + Judgment (`adapted`) | Holy Shield — maximum-HP ward (`adapted`) | Wrath of Heaven — own missing HP as damage (`direct`) | Doom — amplifies Burn, Poison, and Bleed (`direct`) | Immediate Judgment — DEF damage + Doom (`adapted`) |
| Wandering Blade | Slash — attack + Initiative (`adapted`) | Blade Barrier — ward + Guard (`adapted`) | Chi Liberation — swift Priority + Strength (`adapted`) | One Flash — decisive strike + Priority (`adapted`) | Katana Dance — three hits + Initiative (`adapted`) |
| Desolate Vampire | Claw — attack with Bloodsuck synergy (`adapted`) | Blood Thirst — ATK/DEF healing (`adapted`) | Heart Destroyer — heavy strike + Bleed (`adapted`) | Rampage — four hits + Lifesteal (`adapted`) | Bloodflow Absorption — damage + recovery (`adapted`) |
| Forsaken Automaton | Bombardment — 100% ATK (`adapted`) | Repair — lost-HP heal + ward (`adapted`) | Emergency Cooling — vent Limp + Solidity (`adapted`) | Fate Manipulator — Priority + Overload + self-Limp (`adapted`) | Final Counter — equal DEF ward and damage (`adapted`) |

## General active ability replacement pool

All 18 abilities in the current Namu section 11.1 pool are registered as `general`.
They never appear in a starting loadout. When one is awarded to a full five-skill build,
the reward requires the player to choose one of the three flexible slots to replace;
the Basic Attack and Defensive ability cannot be selected.

| General ability | Runtime mechanic |
|---|---|
| Penetration | 180% ATK special damage |
| Rapid Cooling | Paralyze 2 + Solidity 1; cooldown 3 |
| Urgent Guard | Swift 100% DEF ward |
| Stone Skin Elixir | Swift Tenacity 6 |
| Protection Scroll | Swift Protection 9 |
| Elixir of Wrath | Swift Strength 6 |
| First Aid | Heal 24% lost HP; reduce Bleed, Burn, and Poison |
| Emergency Evasion | Swift Evade 1 |
| Sudden Blow | Swift 80% ATK damage |
| Unbendable Will | Swift Unstoppable 4 |
| Killing Instinct | Swift Focus 25 |
| Sleep Grenade Toss | Sleep 3; breaks on hit |
| Blade of Curse | 140% ATK + ATK-scaled Doom |
| Beastification | Swift Strength 8 + Lifesteal 14 |
| Judge of Fate | Swift missing-enemy-HP Misfortune |
| Super Speed | Swift Haste 2 |
| Transcendence | Strength 8 + Tenacity 8 + Focus 20 |
| Peace Declaration | Paralyze 1 + DEF-scaled Lethargy |

Every adaptation decision is stored on its runtime skill as `source.fidelity =
"adapted"` with a concise `source.detail`. Character selection, its complete detail
drawer, reward replacement, arsenal presentation, and combat all read those same
definitions.
