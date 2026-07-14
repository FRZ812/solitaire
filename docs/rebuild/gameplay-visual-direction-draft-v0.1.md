# Solitaire — Gameplay & Visual Direction Draft v0.1

**Status:** Pre-implementation concept draft
**Date:** 2026-07-14
**Purpose:** Define how the rebuilt game should feel, play, and look before an engine spike or production implementation begins.
**Approval rule:** No rebuild implementation should start until the core direction and the decisions in Section 16 are accepted or revised.

---

## 1. The promise

**Solitaire is a harsh, portrait-first, party survival RPG set in the existing mature fantasy canon, rebuilt on a new world map and presented as a hybrid-2.5D tactical diorama.**

The player prepares an expedition, travels through a world that does not scale itself around them, explores dangerous local maps, fights or negotiates through deterministic systems, and lives with wounds, hunger, weather, death, loss, faction consequences, and a changing economy. The game is mechanically complete solo and offline. An optional hosted world lets invited players inhabit the same persistent campaign in a Minecraft-like session. AI gives characters more responsive voices and the world more narrative variety, but it cannot decide rolls, rewards, damage, movement, survival, quest completion, or canon.

The desired first impression is:

> **A dangerous illustrated world in the palm of your hand—beautiful enough to linger over, legible enough to play one-handed, and severe enough that leaving town feels like a decision.**

## 2. Reference blend

The direction combines principles rather than copying surfaces:

- **Stoneshard:** expedition preparation, tile-readable danger, wounds, survival pressure, hostile travel, and the feeling that bad positioning can end a character.
- **Fire Emblem:** portrait-first tactical readability, expressive character portraits, strong party identities, relationship stakes, and clear forecast-before-commit interactions.
- **Final Fantasy:** memorable silhouettes, controlled visual spectacle, distinct job/discipline fantasy, emotionally heightened bosses, and a world that can be grim without becoming visually monotonous.
- **World of Warcraft treatment:** complete regional identities, factions, professions, dungeons, bosses, collecting, long progression arcs, and regular content—not MMO scale or MMO combat.
- **Minecraft session model:** a persistent world owned/hosted by a player, private invites, drop-in/drop-out participation, world-bound characters, and an optional always-on hosted version.

## 3. Experience pillars

### 3.1 Preparation is play

Choosing a route, food, water, medicine, light, tools, ammunition, camp equipment, party composition, formation, and fallback plan should matter as much as choosing attacks. Preparation is not a checklist of chores; it is the act of deciding which risks the company can survive.

### 3.2 The world does not protect the player

Regions, creatures, factions, weather, and dungeons have fixed identities and believable power. Danger is telegraphed through tracks, rumors, maps, corpses, weather forecasts, scout reports, and visible enemy behavior—not hidden level scaling.

### 3.3 Punishment is mandatory, legible, and persistent

A bad expedition can permanently kill a character, cripple a companion, lose rare equipment, create debt, strand the party, empower a hostile faction, or force a rescue operation. The game must show what made the situation dangerous and give the player chances to turn back. Severity should come from consequences, not surprise rules or unreadable dice.

### 3.4 Every important outcome is mechanical

Rules resolve movement, stealth, combat, wounds, disease, crafting, trade, social leverage, quests, reputation, and world change. Prose explains accepted events; prose never substitutes for them.

### 3.5 One canon, newly mapped

The lore, cosmology, history, factions, cultures, named figures, themes, and mature tone remain valuable. Geography is rebuilt from first principles so rivers, roads, borders, resources, settlements, travel times, dungeons, and encounter ecologies support the game.

### 3.6 A living party, not a disposable loadout

Characters have disciplines, injuries, loyalties, relationships, beliefs, knowledge, debts, and histories. Permanent loss matters because a person and a mechanical role disappear together.

### 3.7 AI deepens expression, never privilege

A more expensive model may produce richer dialogue, better scene continuity, or more nuanced prose. It may never improve a roll, reveal hidden mechanical information, create better loot, alter prices, make a quest easier, or provide exclusive gameplay power.

## 4. What a normal expedition feels like

### 4.1 In town

The player begins at the company hall or rented room. The morning board shows:

- Weather now and forecast along known routes.
- Food, water, medicine, ammunition, light, and carry capacity.
- Party wounds, fatigue, morale, relationships, and obligations.
- Faction notices, wanted notices, rumors, contracts, and personal requests.
- Market movements and shortages.
- Known danger by route and site, with the source and age of that information.

The player chooses a purpose, not merely a quest marker: hunt, trade, investigate, escort, rescue, gather, explore, negotiate, raid, or pursue a personal lead. The route planner previews estimated time, supply use, weather exposure, known threats, escape options, and uncertainty.

### 4.2 On the region map

Travel occurs between authored route segments and wilderness entry points on a relief atlas. Roads are safer and faster but controlled, taxed, watched, or blocked. Cross-country travel saves distance but consumes more supplies, increases injury/weather exposure, and may require navigation checks or specialized gear.

The atlas never resolves into a sequence of chat prompts. Mechanical travel events produce choices such as:

- Shelter now or push through the storm.
- Detour around a patrol or risk inspection.
- Follow tracks into an unknown local site.
- Spend medicine on a companion now or preserve it.
- Abandon cargo to increase speed.
- Camp in a defensible but exposed place or a hidden but unhealthy place.

### 4.3 On a local map

The world becomes a fixed-angle 2.5D tactical diorama. The player moves across readable cells with height, cover, doors, fire, water, mud, darkness, traps, noise, and line of sight.

A tap selects. A second tap or explicit confirm commits. Before commitment the UI shows:

- Path and action-point/time cost.
- Cells exposed to enemy vision or reactions.
- Noise and light changes.
- Known hazards.
- Forecasted attack range and likely consequences.

Exploration is deliberately tense. Opening a door, climbing a ledge, lighting a torch, dragging a body, harvesting a plant, making noise, or waiting advances the simulation. The exact co-op timing model is a prototype decision, but solo play retains step-readable causality.

### 4.4 In combat

Combat takes place on the same local map whenever possible. There is no abstract jump to a card-only arena.

The player reads:

- Initiative/turn order.
- Action points and movement.
- Reach, range, line of sight, cover, elevation, and reactions.
- Enemy telegraphs and visible intent where the character has enough awareness.
- Hit and effect forecast as a range/confidence, not false certainty.
- Body condition, pain, bleeding, stability, morale, and escape paths.

Weapon families have tactical identity:

- Spears control approach lanes.
- Shields protect arcs and allies.
- Axes damage guard and objects.
- Swords offer flexible counters.
- Bows demand sight lines, ammunition, and space.
- Crossbows trade reload time for penetration.
- Magic creates powerful positional effects with preparation, risk, exposure, or corruption costs.

Enemies use coherent behaviors: wolves isolate, soldiers hold formations, bandits threaten and flee, undead ignore morale but respond to light or sanctity, and bosses reshape the field through authored phases.

### 4.5 After the fight

Victory is not a full reset. The player must:

- Stop bleeding and stabilize wounds.
- Decide who carries whom and what loot is abandoned.
- Treat infection and pain with limited supplies.
- Repair or improvise equipment.
- Choose whether to press deeper, camp, withdraw, or call for rescue.
- Deal with prisoners, surrendered foes, witnesses, corpses, and faction consequences.

The return trip remains dangerous. A victorious party can still die by greed, exposure, pursuit, or poor triage.

### 4.6 Back at the company

The campaign converts consequences into long-term play:

- Injured characters occupy beds and need treatment or time.
- New scars, traumas, loyalties, feuds, and memories persist.
- The market reacts to delivered or lost goods.
- Factions react to witnesses and verified outcomes, not omniscience.
- The company invests in an infirmary, smithy, storehouse, library, stable, scouts, defenses, and guest rooms.
- A dead member leaves an empty role, unfinished relationships, inheritance, debts, and perhaps a recovery quest.

## 5. Survival and death contract — recommended draft

This is intentionally severe. It should be tested for fairness, not softened into a cosmetic meter system.

### 5.1 Core survival pressures

- Hunger and hydration.
- Fatigue and sleep debt.
- Body temperature and wetness.
- Disease, infection, poison, and contamination.
- Pain, bleeding, fractures, burns, and location-specific wounds.
- Light, darkness, visibility, and fuel.
- Carry weight, bulk, and mobility.
- Equipment durability and repair materials.
- Morale, fear, stress, and party trust.
- Weather, terrain, shelter, and camp quality.

Each pressure has visible stages, causes, countermeasures, and forecasted consequences. Meters do not tick merely to demand taps: they alter routes, tactics, senses, rest quality, combat reliability, and social choices.

### 5.2 Saves and commitment

Recommended standard-world rule:

- One canonical world timeline with automatic saves at command/turn boundaries.
- No ordinary reload-to-reroll.
- Quitting or disconnecting never rewinds accepted events.
- A separate explicitly labelled sandbox/admin world may exist for testing or accessibility, but the primary survival rules are mandatory and the world records its rule set.

### 5.3 Downed, rescue, capture, and death

Recommended flow:

1. At zero stability, a character becomes **downed**, not automatically safe.
2. Bleeding, fire, poison, enemies, and time continue to act.
3. An ally may stabilize, carry, drag, bargain for, or abandon the character.
4. Some enemies capture rather than kill; capture creates a mechanical rescue/escape state.
5. If death conditions are met, the character is permanently dead in that world.
6. Carried equipment remains on the body, captor, or loss site according to the event; it is not magically returned.
7. A body or cache may be recovered while the world continues to simulate.
8. The **company and world persist**. The player continues through another company member, recruit, heir, or rescued survivor.

This makes death severe without making every death delete the entire world. Campaign-ending conditions should be rare and explicit—for example, no living company members, no viable succession, and an unrecoverable company collapse.

### 5.4 Fairness rules

High punishment is acceptable only when:

- Danger is discoverable before commitment.
- Important formulas and status effects are inspectable.
- The UI distinguishes known, estimated, and unknown information.
- Enemies follow the same visible spatial rules unless an authored boss exception is telegraphed.
- Disconnects, UI ambiguity, model outages, or server errors cannot cause canonical death.
- Premium narration never supplies mechanically superior warnings.

## 6. Character and company progression

### 6.1 The character

A character is defined by:

- Bounded attributes with visible breakpoints.
- Weapon and practical masteries improved through meaningful use and training.
- One primary discipline and a limited secondary specialization.
- Equipment, wounds, scars, traits, beliefs, loyalties, relationships, and known facts.
- A personal history and unfinished goals that can outlive them through the company.

### 6.2 The company

The company is the campaign's durable identity and solves the contradiction between permanent death and long-form progression.

Company progression unlocks capabilities rather than raw universal power:

- Infirmary: advanced treatment and recovery capacity.
- Workshop/smithy: repair, salvage, modification, and crafting.
- Library/cartography room: lore, maps, research, and better uncertainty estimates.
- Storehouse: protected supplies and expedition kits.
- Stable/yard: mounts, transport, and cargo.
- Scouts/network: current route and faction information.
- Guest rooms: recruits, envoys, and relationship events.
- Defenses: response to raids, feuds, and regional instability.

### 6.3 Build philosophy

Rarity should widen build choices more than it multiplies numbers. A rare item may offer an unusual reach profile, reaction, status conversion, socket, social identity, or drawback—not simply twelve times the damage.

## 7. Solo and Minecraft-like hosted worlds

### 7.1 World ownership

- A solo campaign is a local persistent world.
- The same world can be promoted to an invite-only hosted session.
- The owner controls world rules, content-pack set, pause policy, PvP policy, and narration budget.
- Characters and inventory are **world-bound** by default. Players do not import endgame items into a new host's world.
- An optional subscription feature can keep a world online without the owner's device acting as host.

### 7.2 Recommended party/session size

Draft recommendation: **one to four human players**.

- Solo: one player directly commands up to four company members.
- Co-op: each human normally controls one primary character; empty tactical roles may be filled by host-approved companions.
- Large retinues remain strategic/company assets rather than adding ten units to every combat.

This is small enough for tactical clarity and mobile communication while still feeling like a shared persistent world.

### 7.3 Joining and leaving

- Invite code or private friend list; no global MMO shard.
- New players create a world-bound recruit through the host's available cultures/origins.
- The recruit enters at a safe company location, not beside the party in a dungeon.
- Disconnect during danger triggers a deterministic grace state: guard/hold position, then host-approved AI control or retreat when legal. A disconnect cannot be treated as a voluntary risky action.
- Reconnect restores from the host's canonical state and verifies a state hash/content-pack manifest.

### 7.4 Co-op decisions

Recommended policy:

- The acting player controls their character's tactical action.
- Travel destination, camp break, dungeon entry, major faction alignment, and irreversible company spending use host confirmation or an optional vote rule.
- Trades are explicit atomic commands.
- PvP and theft are off by default and must be a world-level opt-in.
- Adult themes do not relax player-to-player harassment, consent, privacy, or moderation controls.

### 7.5 Tactical timing question

Two timing models should be compared in the engine/network spike:

1. **Shared turns:** all human players plan within a threat phase; the host resolves actions in initiative order. Strong causal clarity, potentially slower.
2. **Deterministic pulses outside combat + shared turns in danger:** travel/local movement feels fluid, while combat slows into explicit rounds. Better co-op flow, more synchronization complexity.

Draft recommendation: prototype option 2, but keep solo exploration fully step-readable.

## 8. New world mapping while preserving canon

### 8.1 What remains canon

Preserve unless deliberately revised:

- Cosmology, religions, gods, metaphysics, and supernatural rules.
- Major historical events and political relationships.
- Cultures, peoples, languages, factions, and institutions.
- Named figures and their established roles.
- Whitemarch and other important places as identities.
- The grounded, morally difficult, mature tone.

### 8.2 What is rebuilt

- Continental silhouette and scale.
- Mountain chains, watersheds, rivers, coasts, climate, and biomes.
- Political borders and defensible frontiers.
- Settlement location and hierarchy.
- Roads, river routes, passes, ports, trade corridors, and travel times.
- Resource distribution and resulting economies.
- Dungeon/site locations and enemy ecologies.
- Regional atlas topology and every local tactical map.

### 8.3 Mapping method

Build the new map in this order:

1. Create a **canon ledger**: immutable facts, revisable facts, rumors, contradictions, and obsolete geography.
2. Define physical geography: plates/ranges, watersheds, prevailing weather, coast, soil, and resources.
3. Place cultures and powers according to food, water, defense, trade, and history.
4. Place capitals and towns at believable river crossings, ports, mines, passes, and agricultural basins.
5. Draw roads and borders from those pressures.
6. Assign each region a distinct survival mechanic, economy, enemy ecology, faction conflict, traversal tool, dungeon language, and visual palette.
7. Build the first playable region around one expedition loop before filling the whole continent with sites.

The LLM may help reconcile lore notes or draft regional flavor, but runtime generation does not decide canonical geography.

### 8.4 First-region working concept

Use **Whitemarch and the Whitewend basin** as a working skin because they preserve familiar lore without preserving the current map.

The region should contrast:

- Dense iron capital and regulated roads.
- Floodplain farms and river trade.
- Cold marsh/fen routes with disease and visibility pressure.
- Old military roads, wall remnants, abandoned mines, and contested passes.
- Faction control over tolls, medicine, iron, food, and burial.

Names and exact topology remain draft until the canon ledger and world-map pass.

## 9. Visual direction — hybrid 2.5D

### 9.1 Camera and world

Recommended camera:

- Orthographic three-quarter/isometric view, approximately 35–45° downward.
- Fixed primary rotation for encounter readability; optional 90° rotation where occlusion demands it.
- Portrait viewport designed around a readable local field approximately 7 cells wide and 9–11 cells deep at default zoom.
- Smooth focus shifts and restrained zoom, never a continuously wandering cinematic camera during tactical decisions.

The environment is three-dimensional:

- Terrain height, stairs, bridges, roofs, walls, trees, water, doors, and props have real depth.
- Hand-painted low-poly materials avoid photorealism and keep mobile performance predictable.
- Lighting, fog, weather, fire, shadow, and interior/exterior transitions create atmosphere and mechanical visibility.

Characters and creatures are authored two-dimensional elements:

- Directional sprites or carefully lit billboard rigs.
- Strong silhouettes and readable equipment layers.
- Limited but expressive animation sets: idle, move, ready, attack families, hit, downed, interact, cast, carry/drag.
- High-detail illustrated portraits for dialogue, relationships, injuries, and major story beats.

### 9.2 Visual mood

- Grounded materials: iron, wet stone, dark timber, linen, leather, bone, ash, mud, wax, old paper.
- Restrained regional palettes with one or two high-saturation accents.
- Magic is visually exceptional: concentrated color, altered shadows, geometric or organic signatures, and environmental aftereffects.
- Violence can be mature and consequential, but readability comes before gore density.
- Beauty should survive the grimness: dawn fog, lamplight, sacred mosaics, river reflections, snowfall, banners, and human warmth make danger worth protecting something from.

### 9.3 Character presentation

- Overworld sprites prioritize silhouette, role, weapon reach, and current condition.
- Portraits carry Final-Fantasy/Fire-Emblem-like emotional clarity without copying either style.
- Wounds, exhaustion, wetness, blood, soot, disease, and gear damage appear visually in bounded layers.
- Named characters get memorable color and shape motifs that remain recognizable at phone scale.

### 9.4 Interface material language

The UI should feel like an expedition instrument rather than a generic fantasy website:

- Dark iron/charcoal structure.
- Warm parchment or bone text surfaces only where reading benefits.
- Brass, wax-red, frost-blue, and faction colors as controlled accents.
- Sharp rectangular geometry with clipped corners; modest ornament at section boundaries.
- Clear modern typography and spacing; no faux-medieval font for body text.
- Icons paired with numbers/labels until learned.
- Motion is short and functional: confirm, impact, danger, resource loss, state change.

## 10. Portrait-first screen system

### 10.1 Expedition field — primary screen

Recommended allocation:

- **Top strip:** time/weather, local danger state, connection/host state, pause.
- **Upper 55–65%:** 2.5D tactical field.
- **Context rail:** selected actor/enemy, turn order, immediate conditions.
- **Lower 25–35%:** thumb action tray with move/attack/abilities/item/stance/end-turn.
- **Bottom navigation:** field, atlas, party, pack, journal; hidden or reduced during danger.
- **Narration:** a short event caption over the field plus an expandable chronicle—not a permanent chat column.

The core action is select → inspect forecast → commit. Typing is never required.

### 10.2 Atlas

- Relief map with known routes, weather fronts, faction control, danger uncertainty, camps, and discovered sites.
- Route comparison as cards: time, supplies, exposure, tolls, known threats, escape points.
- Fog represents knowledge, not merely pixels the player has not walked over.

### 10.3 Party and inventory

- Paper-doll/equipment view with body condition visible alongside gear.
- Drag/drop may be offered, but tap-select/tap-destination is the reliable mobile path.
- Loadout comparison shows weight, noise, warmth, protection, reach, and expedition duration—not only damage-per-second.

### 10.4 Dialogue

- Scene remains visible behind portraits.
- Authored/mechanical choices are buttons with known costs or risks where appropriate.
- Optional free text lives behind a deliberate “Say something else” control.
- Model-quality indicator is subtle; a premium request shows estimated credits before sending if it exceeds the player's default budget.

### 10.5 Company hall

- A compact diorama/plan of the company site doubles as navigation.
- Rooms show occupants, queues, repairs, treatments, production, visitors, and alerts.
- Long-term progression is spatially visible instead of hidden in a spreadsheet.

### 10.6 Death and recovery

- No instant “reload” button in the standard world.
- Show the exact final events and known causes.
- Offer legal next actions: stabilize another member, retreat, negotiate, begin rescue, recover remains, choose successor, or continue as another member.
- The presentation should be solemn and specific rather than punitive spectacle.

## 11. LLM experience and paid model tiers

### 11.1 What higher-tier models improve

- Dialogue nuance and continuity.
- Scene prose quality.
- NPC voice fidelity.
- Recaps and journals.
- Interpretation of optional free-text intentions.
- Personal letters, rumors, and low-stakes flavor generated within validated content slots.

### 11.2 What higher-tier models never improve

- Hit chance, damage, loot, prices, crafting quality, survival information, hidden-trap detection, quest rewards, encounter difficulty, faction gain, or progression speed.
- Access to main quests, dungeons, classes, regions, or mechanically superior contracts.
- The right to change canon or bypass content policy.

### 11.3 Subscription and credit presentation

Recommended product behavior:

- Every subscription tier receives the same mechanical game and deterministic fallback narration.
- Tiers may differ in cloud save/world slots, always-on hosting, monthly included narration allowance, history depth used for prose, and default narrative-quality tier.
- Credit top-ups fund optional premium-model calls.
- The client shows a monthly budget, remaining credits, estimated cost for an exceptional request, and a hard cap.
- No surprise auto-top-up by default.
- If credits are exhausted, the game silently/clearly falls back to the included model or deterministic text and continues.
- In a hosted world, the owner chooses the shared scene-narration tier and pays for shared calls; private optional interactions use the initiating player's allowance. Exact charging must be finalized before implementation.

### 11.4 Transitional note about the current prototype

The current narrator prompt is 152,226 characters. The Edge function previously rejected any individual field over 120,000 characters. The source repair raises only the `system_prompt` allowance to 200,000 while retaining the generic field limit and adds a regression test.

This is a compatibility repair, not the rebuild architecture. The rebuilt service must use server-owned, task-scoped prompts and compact scene projections; it should not repeatedly send a 152k-character universal prompt or let clients choose arbitrary prompt content.

## 12. Audio direction

- Sparse regional ambience with weather and settlement layers.
- Tactile close sounds: gear, breath, mud, doors, cloth, fire, blood loss heartbeat, distant threats.
- Distinct weapon impact families communicate armor interaction.
- Music enters selectively for danger escalation, boss phases, sanctuary, and irreversible choices.
- Character voice is primarily text/effort sounds initially; full generated voice is not assumed and requires separate consent, cost, quality, and performer-rights review.

## 13. First playable slice shown by this draft

The first slice should demonstrate the whole promise without pretending to be the whole world:

1. Create a company founder and two potential recruits.
2. Prepare in a newly mapped Whitemarch district/company hall.
3. Compare two routes to a frontier hamlet.
4. Survive one weather event and one supply decision.
5. Explore a local 2.5D ruin/fen map.
6. Resolve a stealth opportunity and a tactical combat encounter.
7. Suffer at least one persistent wound.
8. Choose between pressing to the objective or extracting.
9. Return with consequences that affect a faction, market stock, relationship, and company capability.
10. Repeat once with a different build/route and obtain a meaningfully different mechanical result.
11. Complete all of the above with LLM narration disabled.
12. Run a separate hosted-session proof in which a second player joins the world, controls a world-bound recruit, disconnects safely, and rejoins the canonical state.

## 14. What this draft deliberately rejects

- Chat as the permanent primary game screen.
- LLM-authored damage, rewards, quests, movement, relationships, or world state.
- Giant maps with shallow location treatment.
- Mandatory typing.
- Cosmetic survival meters that cannot kill or derail an expedition.
- Hidden adaptive level scaling that erases geography and preparation.
- Premium-model mechanical advantage.
- Imported multiplayer characters/items that break a host world's progression.
- Photorealistic visuals that overwhelm mobile performance and authored style.
- “Adult” as an excuse to omit consent, age, privacy, provider, or legal boundaries.

## 15. Recommended direction

Proceed with a **field-first portrait design**:

- The tactical diorama is always the hero.
- Narrative appears as short event captions and an expandable chronicle.
- The action tray is reachable and mechanical forecasts are explicit.
- The interface uses iron, parchment, brass, restrained color, and highly legible modern type.
- The company provides long-term continuity through mandatory character loss.
- Solo play is the reference behavior; hosted worlds reuse the same deterministic simulation behind a host-authority interface.
- Premium narration is visibly optional and mechanically neutral.

A chronicle-heavier alternative can be retained as a comparison sketch, but it should not pull the rebuild back toward a chat-led product.

## 16. Approval questions before implementation

Please approve or revise these concrete draft choices:

1. **Party/session size:** recommend one to four players; solo controls up to four company members, co-op normally one character per human.
2. **Death:** recommend permanent character death, recoverable body/gear where world events permit, and company succession rather than automatic campaign deletion.
3. **Save rule:** recommend one canonical autosaving timeline in standard worlds, with a separately labelled sandbox/admin world if desired.
4. **Combat view:** recommend fixed three-quarter/isometric hybrid 2.5D with approximately seven cells of portrait width.
5. **Co-op timing:** recommend deterministic pulses outside danger and shared tactical turns during danger, subject to a network/input spike.
6. **Hosted worlds:** recommend listen-server hosting for ordinary subscribers and optional paid always-on hosting; world-bound characters and content packs.
7. **Premium narration:** recommend host-funded shared narration and player-funded private premium requests, both with cost preview and hard caps.
8. **First map focus:** recommend remapping Whitemarch and the Whitewend basin first while preserving their lore identities.
9. **UI stance:** recommend the field-first sketch over the chronicle-first alternative.

Once these are accepted, the next artifact should be a **world-map/canon ledger draft and engine/input/network spike specification**, not production gameplay code.
