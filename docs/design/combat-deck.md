# Deck-combat design

Status: **canonical combat direction**

Combat uses a mechanics-first, single-player deck system inspired by the readable
turn structure of modern deck-building roguelikes. It is not a copy of another
game's cards, encounters, progression, balance, or visual language.

Implementation status: v1 has a serializable seeded pile shuffle and stored
enemy intents, but hit, critical, morale, escape, intent tie-breaking, and loot
still pass through the legacy random path. Full named-stream replay is a target
contract below, not a shipped claim, until those remaining rolls are migrated.

## Combat promise

Every turn presents a compact hand, a known energy budget, visible enemy intents,
and meaningful trade-offs. Campaign preparation shapes the deck; combat tests
how well the player reads intent, manages tempo, and accepts persistent cost.

## Zones and resources

- **Draw pile:** shuffled with a named seeded random stream at encounter start.
- **Hand:** the cards currently available to play. Default target: five cards.
- **Discard pile:** receives played and unplayed cards at end of turn unless a
  card says otherwise. It becomes the next draw pile when needed.
- **Exhaust pile:** cards removed for the encounter. Exhaust is explicit and
  never silently behaves like discard.
- **Energy:** refreshed at the start of the player turn. Default target: three.
  Unspent energy expires unless a rule says it is retained.
- **Health and wounds:** health persists across an expedition. Wounds may add
  burden cards or alter draw until treated.

All cards state cost, targets, tags, effects, and destination after play.

## Card families

- **Attack:** weapon use, offensive spells, and committed maneuvers.
- **Guard:** blocks, evasions, cover, counters, and protective magic.
- **Skill:** positioning, tools, medicine, observation, and party coordination.
- **Stance:** a persistent approach that changes later card behavior.
- **Burden:** injury, fear, exposure, damaged equipment, or another campaign
  consequence. Burdens are problems to manage, not filler added at random.

Equipment grants or modifies a small number of cards and passive rules. A spear,
shield, bow, grimoire, or field kit changes verbs and sequencing, not merely a
damage coefficient. Cards remain grounded in what the character carries, knows,
and can physically or magically perform.

## Turn sequence

1. Resolve start-of-turn statuses and telegraphed consequences.
2. Refresh energy and draw to the hand target.
3. The player plays cards or ends the turn.
4. Resolve enemy intents in a stable, displayed order.
5. Apply end-of-turn statuses and discard eligible cards.
6. Emit canonical events and begin the next turn. Once full replay support is
   implemented, also update the replay hash.

An action preview must show deterministic values and bounded random ranges before
the player commits. Enemy intent can hide detail when a specific authored rule
creates uncertainty, but the uncertainty itself must be legible.

## Status rules

Statuses use a shared schema: id, source, magnitude or stacks, duration, timing,
and stacking rule. Initial vocabulary should stay small:

- **Guard:** absorbs incoming harm and normally expires at the next player turn.
- **Vulnerable:** increases specified incoming damage for a stated duration.
- **Weak:** reduces specified outgoing damage for a stated duration.
- **Bleed/Burn:** typed damage at a named timing window.
- **Focus:** improves a magical or precision action, then is consumed if stated.
- **Stagger:** interferes with the next intent without becoming an unrestricted
  skip-turn loop.

New statuses require counterplay, a timing test, and an interaction table.

## Enemies and encounters

Enemies choose from authored behavior profiles and project their next intent
before the player acts. The current heuristic uses the legacy random path for
some ties; the target is deterministic utility scoring with seeded tie-breaking.
Encounter identity comes from intent sequences, reactions, allies,
environment cards, and reward pressure rather than inflated health alone.

Bosses use authored phases and transition rules. A language model may write a
bark after the engine selects an event; it cannot choose or alter an intent.

## Campaign bridge

- Starting decks come from discipline, background, and equipped items.
- Training adds or upgrades a narrow set of cards through explicit choices.
- Equipment changes cards only while equipped; removing it cannot strand an
  invalid deck.
- Rest sites, healers, workshops, and mentors remove burdens or reshape decks.
- Routes can apply weather, fatigue, supplies, or faction modifiers before an
  encounter.
- Rewards are selections from authored pools. The player may add,
  upgrade, transform, or decline a card; endless automatic deck growth is not a
  reward.
- Defeat produces an authored campaign consequence such as retreat, injury,
  capture, lost supplies, or a failed objective. Permanent death is mode- or
  story-specific, never an unexplained default.

## Target mechanical contract

Combat accepts commands and emits events. Rendering never changes combat state.
The completed architecture will draw random results only from named seeded
streams, so a replay from the same snapshot plus commands produces the same
events and state hash. V1 does not yet meet this final replay guarantee.

The first vertical slice needs one player discipline, three enemy profiles, one
elite, one boss, roughly 25 player cards, ten statuses, and a three-encounter
expedition. Expansion waits until that slice is readable, replayable, and fun.
