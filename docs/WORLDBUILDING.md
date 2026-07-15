# Worldbuilding authority

Status: **canonical setting and content direction**

This document governs tone, cultures, characters, objects, and magic. The
[product vision](product/vision.md) governs the overall experience, the
[deck-combat design](design/combat-deck.md) governs combat, and the
[unified world-map model](MAP_REBUILD_V3.md) governs spatial data. The
[Avarra generation contract](CONTINENT_GENERATION.md) governs continental scale,
deterministic generation, and generated content boundaries.

## Tone

Solitaire is light high fantasy: adventurous, humane, colorful, and capable of
serious consequences without treating misery as its identity. Danger, injury,
scarcity, political conflict, and loss can matter. They should be contrasted by
friendship, craft, hospitality, festivals, curiosity, recovery, and wonder.

Avoid grimdark defaults. Slavery, sexual violence, racial essentialism, graphic
gore, and cruelty as decoration are not setting pillars. If a difficult subject
is necessary to a specific story, establish its purpose, affected viewpoint,
content boundary, and path for player agency before authoring it.

## Historical and regional grounding

Each culture begins with a coherent material and social reference rather than a
bag of generic medieval symbols. A regional brief identifies:

- climate, terrain, staple foods, and seasonal pressures;
- available fibers, timber, stone, clay, metals, dyes, and fuels;
- construction, transport, agriculture, warfare, trade, and household craft;
- institutions, occupations, family structures, celebrations, and obligations;
- the historical sources used and the deliberate departures from them.

Do not copy a real people under a fantasy name or flatten multiple cultures into
an aesthetic collage. Transform sources, document the transformation, and give
each society internal disagreement, class variation, neighboring influence, and
change over time.

Fantasy peoples are not moral monocultures. Biology may affect physical needs or
senses when a rule defines it; culture, profession, allegiance, and experience
shape behavior.

Avarra's named cultural regions and its ecologies are separate layers. A climate
or biome does not imply one culture, faction, or moral character; one cultural
region may contain several ecologies, and an ecology may cross political borders.

## Characters

A character should be drawable and understandable from concrete facts:

- home region and present community;
- occupation, training, household, and obligations;
- age, build, movement, and weather-appropriate clothing;
- tools, weapons, armor, and belongings they can plausibly obtain and maintain;
- beliefs, habits, relationships, wants, fears, and one meaningful contradiction;
- magical knowledge, if any, expressed through a named rule and practice.

Silhouettes and equipment must match those facts. Rank is conveyed through
material, cut, repair, attendants, heraldry, and behavior rather than arbitrary
glowing ornament.

## Items and material culture

Every item specifies a region or trade route, materials, construction, maker or
manufacturing context, purpose, upkeep, and visible wear. Weapons and armor obey
handling, reach, weight, protection, and repair logic before balance abstraction.

Rarity is social and material: difficult labor, scarce input, restricted guild
knowledge, provenance, or magical treatment. It is not a universal color ladder
that makes one iron object many times stronger than another.

The generated [item catalogue](ITEMS.md) records legacy source content only.
Current mechanical effects belong to versioned item and card definitions and
must satisfy the deck-combat contract.

## Rule-bound magic

Every magical tradition answers the same questions:

1. What source or relationship permits the effect?
2. What training, tool, preparation, or condition is required?
3. What does it cost immediately and over time?
4. What can it affect, at what range, and for how long?
5. What sensory tell makes it observable?
6. What resists, interrupts, contains, or reverses it?
7. What evidence and social consequences does its use leave behind?

Magic cannot invent a new exception during resolution. A spell, relic, creature,
or site uses authored effects and statuses. Mystery may hide a rule from the
player temporarily; the underlying rule must still exist and remain consistent.

Magical items begin as believable objects. Enchantment changes a bounded
property through a stated process and usually introduces upkeep, limitation, or
trade-off.

## Starting region: Whitemarch Basin

Whitemarch Basin is the first dense production region. Its fortified
river-and-road capital, Whitemarch, serves farms, market towns, workshops,
shrines, ferry communities, and frontier paths. Its identity comes from pale
stone, whitewashed timber, ironwork, wool, river trade, public gardens, craft
guilds, seasonal fairs, and old protective wards.

The city is useful rather than benevolent: tolls, guild access, water rights,
and competing charters create friction. Its conflicts should offer negotiation,
investigation, service, competition, and reform as often as violence.

Whitemarch itself is a dense radius-twelve authored capital on the same map as
the continent. Grain Square anchors twelve distinct districts: the Grand
Market, Temple Steps, Low Wards, Chain Ward, Guild Court, River Docks, Crown
Gate Ward, Iron Quarter, Noble Rise, Citadel Ward, Caravan Ward, and Outer
Works. Six defended gates continue onto the Crown, Alder, Sheep, Hedge, Salt,
and Smoke roads. The Whitewend bends through the eastern wards, passes beneath
three bridge alignments, and joins the generated river at both edges of the
authored city. These are traversable geography and civic boundaries, not a
separate place graph.

Whitemarch is not the entire world. The surrounding continent of Avarra exists
as finite, lower-density macro geography with named cultural regions, ecologies,
waterways, routes, landmarks, and sites placed from reviewed archetypes. That
breadth does not make every region production-complete: complete Whitemarch
Basin's communities, professions, factions, encounter ecology, and regional arc
before promoting another region to the same density.

## Content authority

- Version-controlled content definitions establish canonical ids and rules.
- Deterministic generation may arrange approved geography and instantiate
  reviewed site archetypes with stable ids; it may not invent unreviewed canon.
- Mechanical state and events establish what happened in a campaign.
- Authored lore establishes public facts and beliefs.
- Characters know only facts available through observation, testimony, memory,
  or an explicit magical rule.
- Generated narration may phrase known facts but may not create canon, mechanics,
  inventory, relationships, or historical events.

## Review checklist

Before content lands, verify:

- the tone supports adventurous high fantasy rather than grimdark shorthand;
- historical sources and transformations are recorded;
- cultural regions and ecologies are related without being conflated;
- clothing, objects, architecture, and travel fit region and season;
- magical content declares costs, limits, tells, and counterplay;
- generated sites use reviewed archetypes and stable canonical ids;
- the content uses existing mechanical ids or adds reviewed definitions;
- player-facing consequences are legible before commitment;
- generated raster assets follow the painterly high-definition art direction.
