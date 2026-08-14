# Tower of Winter character-roster adaptation ledger

Captured 2026-08-14 for the fixed four-action character templates.

This is deliberately separate from `TOW_EVIDENCE.md`: the reference game uses replaceable
attack/defence skills plus a five-slot skill inventory, not MOBA-style ability categories.
The requested **Basic Attack / Defensive / Special / Ultimate** kits are therefore a remake
contract. Names and documented mechanics stay literal where evidence exists; `adapted`
entries preserve the sourced combat identity with kernel-native values where the source
available to this project does not publish a coefficient.

## Sources

- `namu:characters` — <https://namu.wiki/w/%EA%B2%A8%EC%9A%B8%EC%9D%98%20%ED%83%91/%EC%BA%90%EB%A6%AD%ED%84%B0>
- `namu:characters-mirror` — <https://www.namu.moe/w/%EA%B2%A8%EC%9A%B8%EC%9D%98%20%ED%83%91/%EC%BA%90%EB%A6%AD%ED%84%B0>
- `fandom:roster` — <https://towerofwinter.fandom.com/wiki/TowerofWinter_%28By_Tailormade_Games%29_Wiki>
- `fandom:arctic` — <https://towerofwinter.fandom.com/wiki/Arctic_Knight>
- `fandom:clocktower` — <https://towerofwinter.fandom.com/wiki/Owner_of_Clocktower>
- `fandom:skills` — <https://towerofwinter.fandom.com/wiki/Skills>
- `fandom:statuses` — <https://towerofwinter.fandom.com/wiki/Statuses>
- `official:changelog` — <https://apps.apple.com/sg/app/tower-of-winter/id6449329520>
- `historical:values` — <https://gall.dcinside.com/mgallery/board/view/?id=tow&no=2268>

Fidelity labels: `direct` = name and implemented numbers documented; `normalized` =
behavior or identity is documented but the coefficient is fitted to this kernel.

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

## Four-action remake matrix

| Character | Basic Attack | Defensive | Special | Ultimate |
|---|---|---|---|---|
| Arctic Knight | Strike — 100% ATK (`direct`) | Block — 250% DEF ward, 30/act (`direct`) | Deliberate Blow — 110% ATK + 110% DEF ward, 10/act (`direct`) | Incineration — 110% ATK + 110% ATK Burn + self Paralyze 2, 1/act (`direct`) |
| Demon Slayer | Shoot — 100% ATK (`direct`) | Evasion — Evade 1 + 220% DEF ward, 10/act (`direct`) | Kick — 50% ATK + Stun 1, 7/act (`direct`, historical table) | Arrow Rain — four-hit Poison barrage (`normalized`; multi-hit/Venom behavior documented) |
| Owner of Clocktower | Fire — 100% ATK (`direct`) | Suppressive Shot — 125% DEF Lethargy, 24/act (`direct`) | Missile Support — 200% ATK, swift, 2/act (`direct`) | Redesign — 40% ATK Tenacity + 40% DEF Strength, 1/act (`direct`) |
| Old King of Northland | Cleave — 100% ATK (`direct`) | Vitality — heal 185% DEF (`direct`) | Whirlwind — three-hit Lethargy attack (`normalized`; per-hit Valiancy behavior documented) | Earthquake — 400% ATK + 400% DEF Lethargy, 1/act (`direct`, historical table) |
| Sleepless One | Flame Strike — attack + Burn (`normalized`) | Flame Curtain — ward + recurring Burn (`normalized`) | Entangling Roots — Paralyze + Poison (`normalized`; heavy-attack denial documented) | High-Speed Flight — Priority 4 (`direct`) |
| Last Assassin | Flurry — native two-hit basic (`direct`) | Deflect — 175% DEF ward, 25/act (`direct`, historical table) | Flash Bomb — control + exposure (`normalized`) | Execution — direct hit + 45% missing-enemy-health payoff (`normalized`; finishing/Crumble identity documented) |
| Witch of Eternity | Skull Throw — 100% ATK (`normalized`) | Bone Shield — ward + Skeletons (`normalized`) | Skeleton Summon — swift Skeleton gain (`normalized`) | All-Out Attack — army burst + Doom (`normalized`) |
| Tenacious Mage | Magic Arrow — 100% ATK (`normalized`) | Barrier — 200% DEF ward + Protection 4, 20/act (`direct`, historical table) | Flame Storm — three-hit Burn spell (`normalized`) | Amplification — swift Strength equal to 50% ATK, 1/act (`direct`, historical table) |
| Exiled Priestess | Crush — attack + Judgment (`normalized`) | Holy Shield — fixed max-HP ward (`normalized`; non-DEF/HP-cost identity documented) | Wrath of Heaven — own missing health as damage (`direct`) | Doom — Burn/Poison/Bleed become 160%, 3/act (`direct`, historical table) |
| Wandering Blade | Slash — attack + Initiative (`normalized`) | Blade Barrier — ward (`normalized`; sourced name) | Chi Liberation — swift Priority + Strength (`normalized`; sourced signature buff) | One Flash — high single strike + Priority (`normalized`; sourced red capstone) |
| Desolate Vampire | Claw — 100% ATK, Bloodsuck synergy (`normalized`) | Blood Thirst — dual ATK/DEF healing (`normalized`; both-stat scaling documented) | Heart Destroyer — heavy strike + Bleed (`normalized`; blood-rune synergy documented) | Rampage — four hits + Lifesteal (`normalized`; red capstone/max-HP identity documented) |
| Forsaken Automaton | Bombardment — 100% ATK (`normalized`) | Repair — missing-health recovery + ward (`normalized`) | Emergency Cooling — vent Limp + Solidity (`normalized`; Overheat management documented) | Fate Manipulator — swift Priority/Overload with self-Limp (`normalized`; sourced red capstone) |

Every normalized decision is also stored on its runtime skill as `source.fidelity =
"adapted"` and a concise `source.detail`; selection and combat read the same definition.
