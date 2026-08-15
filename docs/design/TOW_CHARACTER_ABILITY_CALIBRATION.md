# Tower of Winter character-ability calibration

## Audit boundary

This calibration covers the complete playable roster from the shipped Tower of Winter
1.4.16 data: 12 characters and 276 abilities, exactly 23 abilities per character.
The Namu character page is retained as the readable cross-check, while the shipped
character, skill, and status tables are the numeric source of truth.

For every ability, the runtime imports and tests the source identifier, Korean and
English names, grade, family, turn cost, use count, use increment, cooldown, target,
scaling stat, base factor, per-rank factor, status identifier, and status-scaling input.
The existing Solitaire IDs remain only as stable compatibility keys for saves, loadouts,
and authored VFX.

## Roster coverage

| Character | Source abilities | Starting trait | Starting stats (HP / ATK / DEF / Crit / Dodge) |
|---|---:|---|---|
| Arctic Knight | 23 | Ironclad 3 | 170 / 12 / 13 / 9% / 4% |
| Demon Slayer | 23 | Quickness 3 | 160 / 13 / 12 / 9% / 5% |
| Tenacious Mage | 23 | Charge 3 | 160 / 15 / 12 / 6% / 5% |
| Exiled Priestess | 23 | Justice 3 | 170 / 11 / 16 / 6% / 4% |
| Last Assassin | 23 | Assassin 3 | 160 / 14 / 11 / 12% / 5% |
| Old King of Northland | 23 | Valiancy 3 | 180 / 13 / 13 / 6% / 4% |
| Owner of Clocktower | 23 | Innovation 3 | 150 / 14 / 14 / 9% / 4% |
| Witch of Eternity | 23 | Necromancy 3 | 150 / 10 / 16 / 12% / 5% |
| Sleepless One | 23 | Ignition 3 | 190 / 12 / 15 / 3% / 3% |
| Wandering Blade | 23 | Gale 3 | 160 / 14 / 12 / 9% / 5% |
| Desolate Vampire | 23 | Bloodsuck 3 | 170 / 13 / 13 / 9% / 4% |
| Forsaken Automaton | 23 | Overheat 3 | 200 / 15 / 10 / 6% / 3% |
| **Total** | **276** |  |  |

Each character has the same 23-row source distribution: six Common, three Uncommon, six
Rare, six Legendary, and two Mythic abilities. Their advancement spans are also sourced:
Common has six ranks, Uncommon five, Rare four, Legendary two, and Mythic one. The exact
catalogue is compiled rather than hand-authored from prose.

## Status and damage lifecycle

The status table distinguishes turn-boundary events from being attacked. The runtime
therefore resolves each individual hit of a multi-hit ability independently.

| Status | Damage timing | Stack lifecycle |
|---|---|---|
| Bleed | Deals damage equal to its current Count at the holder's turn boundary | Persists; the damage tick does not reduce it |
| Burn | Deals damage equal to its current Count at the holder's turn boundary | Loses one Count for each non-dodged attack hit received, including a hit fully absorbed by Ward |
| Poison | Deals damage equal to its current Count at the holder's turn boundary | Loses one Count after that tick |
| Doom | Deals damage equal to its current Count at the holder's next turn boundary | Clears completely after that single tick |

Burn is therefore hit-reactive, not damage-instance-reactive: a four-hit attack can
remove four Burn, but a dodge does not consume Burn and a non-attack status tick does not
consume it. This also keeps multi-hit VFX, mitigation, critical rolls, Ward absorption,
Thorn, and on-hit statuses aligned per hit instead of collapsing the attack into one
number.

## High-risk source corrections

- Witch of Eternity's Skeleton Wave is five 40% ATK hits and applies no Doom.
- Arctic Knight's Retaliation is a one-turn DEF-scaled Counter Attack.
- Demon Slayer's Tracker's Net applies DEF-scaled Cripple and one Paralyze, with a
  six-turn cooldown.
- Sleepless One's Fire Essence multiplies the user's Overload to 350%.
- Wandering Blade's Chi Liberation multiplies the user's Doom Attack to 160%.
- Forsaken Automaton's Fate Manipulator transfers all of the user's Limp to the enemy,
  then clears the user's Limp.
- Exiled Priestess uses the source starting trait Justice, whose attack applies Doom per
  hit; the old stable trait key remains internal for save compatibility.

## Regression gates

Automated checks assert that all 276 source identifiers are present exactly once; every
character has all 23 entries; every entry is direct-source; rank factors, targets, uses,
cooldowns, and descriptions compile; representative effects execute for all 12
characters; and every ability receives a distinct authored VFX signature. Encounter
tests separately cover per-hit status handling, DoT timing, status amplification and
transfer, delayed damage, use restoration, healing, Ward, critical damage, and legacy
save hydration.

## Sources

- Character reference: <https://namu.wiki/w/%EA%B2%A8%EC%9A%B8%EC%9D%98%20%ED%83%91/%EC%BA%90%EB%A6%AD%ED%84%B0>
- Current guide index: <https://gall.dcinside.com/mgallery/board/view/?id=tow&no=14554>
- Status guide: <https://gall.dcinside.com/mgallery/board/view/?id=tow&no=9531>
- Release listing: <https://apps.apple.com/us/app/tower-of-winter/id6449329520>
