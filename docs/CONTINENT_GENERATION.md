# Avarra continent generation

Status: **canonical continent-generation and macro-region contract**

This document governs the finite continental atlas, deterministic generation,
regional content layering, and the boundary between generated geography and
authored content. The [worldbuilding authority](WORLDBUILDING.md) governs tone,
cultures, material life, characters, and magic. The
[world and place model](MAP_REBUILD_V3.md) governs travel state and the two map
scales. If an older prototype, code comment, or content table conflicts with
these documents, the canonical documents win.

## World definition

The game's continent is **Avarra**. It is massive but finite. It is not an
endless procedural plane and generation may not extend the playable world by
inventing coordinates beyond its declared bounds.

- The regional atlas uses pointy-top axial coordinates `{ x, y }`.
- Whitemarch is anchored at `{ x: 0, y: 0 }`.
- One move to an adjacent atlas cell represents approximately **6 kilometres**
  of overland progress. A cell is a strategic travel choice, not a room-sized
  combat space.
- The canonical generation envelope is `x [-540, 540]`, `y [-400, 410]`.
  This is a 1,081 by 811 axial sampling envelope, roughly 6,486 by 4,866 kilometres before
  accounting for the axial skew and the irregular coastline.
- A continental land mask defines which cells are land, inland water, coastal
  water, or open sea. Coordinates outside the envelope are outside the world.
- The finite Far Wild is a sparsely surveyed part of Avarra inside that land
  mask. It is not a catch-all for infinite coordinates.
- Generation is evaluated lazily in 24 by 24 coordinate chunks. Chunking is a
  storage and performance detail; it must not alter geography, ids, or random
  results.

Six kilometres is the base physical scale, not a promise of constant travel
time. Terrain, maintained routes, weather, daylight, load, party condition,
mounts, vessels, and other authored rules determine the time and supplies spent
crossing a cell. Ordinary land is traversable unless a physical or authored rule
says otherwise. A tile is never impassable merely because it was generated.

## Production density

Avarra separates continental continuity from production completeness.

### Dense initial slice

**Whitemarch Basin** is the only dense production region required before
expansion. Whitemarch is a dense authored overlay in the same axial map as the
continent. Its streets, districts, buildings, services, walls, riverfront, and
outer works use local-resolution cells, while reviewed road mouths join the
surrounding generated regional routes. There is no separate place graph or
second navigation state.

Capital map version 2 occupies a radius-twelve footprint around Grain Square:
469 cells, twelve districts, sixty named locations, twenty-two service anchors,
and six gate-to-route seams. The authored Whitewend reaches boundary water at
`12,-12` and `12,0`; adjacent generated cells continue the same waterway, so
the dense capital never interrupts continental hydrology.

The initial slice must contain:

- Whitemarch and stable transitions from its city streets to regional routes;
- the Whitewend as continuous authored/generated hydrology;
- nearby farms, market or road communities, workshops, shrines, ferries, and
  frontier paths that support a complete expedition-and-return loop;
- a small, legible network of roads, tracks, river crossings, and travel risks;
- seasonal weather pressures and visible supply consequences;
- at least three factions with conflicting but understandable interests;
- encounter families conditioned by terrain, route, faction, time, weather,
  and campaign state;
- market, workshop, civic, shrine, recovery, and company-preparation services;
- a coherent regional arc that can be advanced through investigation,
  negotiation, service, competition, exploration, and combat;
- save, replay, discovery, and migration coverage for all required content.

### Macro regions

The existing fifteen outer concepts are reserved as lower-density macro
regions. Their names and broad directional identities may guide continental
generation, but old prototype details do not become canon automatically.

- Vale and basin margins: The Mire, Crowsmoor Reach, The Tannic Wood,
  Whitemarch March, The Spine Foothills, and Bramblewych Reach.
- Northern Avarra: The Bonemarsh, The Sundered Wastes, and the Drakeholt Peaks.
- Eastern Avarra: The Iron Plateau and The Tellmar Road.
- Southern Avarra: The Hollow Coast.
- Western Avarra: The Witchwood Deep and The Pale Steppe.
- Peripheral Avarra: The Far Wild.

Macro regions provide finite borders, climate context, an ecological palette,
major landforms, watersheds, travel corridors, distant anchors, and approved
content pools. They may support sparse traversal, encounters, and sites from
reviewed archetypes, but they do not imply dense settlements, bespoke regional
arcs, complete service coverage, or production-ready histories. A macro region
becomes dense only after a regional brief and content review explicitly promote
it.

Each region declares one of these statuses:

```js
status: "concept" | "macro" | "production"
```

Whitemarch Basin is `production`. The fifteen outer regions begin as `macro`.

## Layered authority

Every atlas cell is resolved through the same ordered layers. Each layer owns a
different class of facts and may override only fields its schema explicitly
allows.

1. **Landform** establishes the continental mask, coast, elevation, slope,
   geology, mountain chains, basins, and major barriers.
2. **Hydrology** derives watersheds, rivers, tributaries, lakes, wetlands,
   floodplains, springs, and drainage outlets from landform.
3. **Ecology** combines landform, hydrology, latitude, climate, and season to
   select an ecological biome and local terrain treatment.
4. **Cultural region** establishes jurisdiction, communities, factions,
   material culture, economy, difficulty expectations, public facts, and the
   region's allowed content packs. A cultural border is not automatically an
   ecological seam.
5. **Named area** gives a bounded locality a stable identity and reviewed local
   overrides: a valley, forest, march, coast, estate, battlefield, or similar
   atlas-scale area.
6. **Routes and sites** place roads, tracks, ferries, bridges, settlements,
   ruins, shrines, dungeons, resources, and place mouths from authored anchors
   and archetypes.
7. **Campaign deltas** record discovery and change: damaged bridges, depleted
   resources, cleared sites, faction influence, settlement condition, weather
   consequences, and other mechanical events.

The base world is the result of layers one through six. Campaign deltas never
rewrite the seed result in place; they overlay it. This separation lets the
engine regenerate untouched geography without saving hundreds of thousands of
base cells while preserving everything that happened in play.

Authored route and site footprints take precedence over generated terrain where
their definitions permit it. They may bridge, ford, terrace, pave, drain, or
otherwise transform land through an explicit construction rule. A site may not
silently move a river, erase a mountain chain, or contradict a regional fact.

## Content schemas

The following shapes define responsibilities. Implementations may normalize
them for runtime use, but saved ids and semantic fields remain stable.

### World manifest

```js
{
  id: "avarra",
  seed: "<campaign or canonical launch seed>",
  generatorVersion: 1,
  contentVersion: 1,
  cellScaleKm: 6,
  chunkSize: 24,
  bounds: { xmin: -540, xmax: 540, ymin: -400, ymax: 410 },
  start: {
    regionId: "whitemarch",
    coord: { x: 0, y: 0 },
    poiPartId: "grain-square"
  }
}
```

The shipped initial world uses a reviewed canonical seed. Other seeds may be
offered only as an explicit campaign mode; they use the same content rules and
must pass the same validation.

### Cultural region

```js
{
  id: "whitemarch",
  name: "Whitemarch Basin",
  status: "production",
  area: { kind: "polygon", points: [] },
  precedence: 100,
  difficultyBand: 1,
  climateProfileId: "cool-temperate-river-basin",
  biomePalette: [
    { biomeId: "river-floodplain", weight: 30 },
    { biomeId: "chalk-down", weight: 25 },
    { biomeId: "managed-alderwood", weight: 20 },
    { biomeId: "peat-marsh", weight: 15 },
    { biomeId: "tilled-lowland", weight: 10 }
  ],
  factions: [
    { factionId: "whitemarch-iron", role: "authority", influence: 45 },
    { factionId: "crowsmoor-wardens", role: "neighbour", influence: 30 },
    { factionId: "wood-cult", role: "custodian", influence: 25 }
  ],
  materialCulture: {
    staples: [], fibers: [], timber: [], stone: [], clay: [],
    metals: [], dyes: [], fuels: [], construction: [], transport: []
  },
  economy: { imports: [], exports: [], obligations: [], seasonalPressures: [] },
  content: {
    weatherTableId: "weather.whitemarch",
    encounterPoolId: "encounters.whitemarch",
    settlementPoolId: "settlements.whitemarch",
    sitePoolId: "sites.whitemarch",
    resourcePoolId: "resources.whitemarch",
    arcIds: []
  },
  lore: {
    publicFactIds: [],
    historicalSources: [],
    deliberateDepartures: []
  }
}
```

A region may overlap another only when both definitions declare an explicit
precedence rule and validation proves that every overlapping cell has one
authority. Array order is not a content rule.

### Ecological biome

```js
{
  id: "peat-marsh",
  tags: ["wetland", "freshwater", "lowland"],
  suitability: {
    temperature: [0.25, 0.70],
    moisture: [0.70, 1.00],
    elevation: [0.00, 0.35],
    slopeMax: 0.20,
    distanceToRiverMax: 5
  },
  terrainMix: { marsh: 60, plains: 15, forest: 15, water: 10 },
  transitions: ["river-floodplain", "managed-alderwood"],
  travel: {
    timeMultiplier: 1.5,
    sightMultiplier: 0.75,
    supplyMultiplier: 1.2,
    hazardTableId: "hazards.peat-marsh"
  },
  resourcePoolId: "resources.peat-marsh",
  environmentPoolId: "environment.peat-marsh",
  encounterTags: ["wetland", "mire"],
  visualId: "peat-marsh"
}
```

Biomes are ecological and reusable. They do not own factions, political borders,
or universal moral character. Urban presentation belongs to a place or named
area override, not to a continent-sized city biome.

### Named area

```js
{
  id: "whitewend-lower-ferries",
  name: "The Lower Ferries",
  regionId: "whitemarch",
  area: { kind: "river-corridor", riverId: "whitewend", width: 2 },
  tags: ["river", "ferry-country", "settled"],
  publicFactIds: [],
  contentOverrides: {
    sitePoolIds: [], encounterPoolIds: [], weatherTableId: null
  }
}
```

Every lazy chunk receives a stable survey-area identity so travel, resources,
and narration can refer to the same tract after regeneration. Authored named
areas may override one or more survey areas when a river corridor, historic
district, or other place has stronger boundaries than the storage grid.

### Site archetype

```js
{
  id: "wardstone-shrine",
  kind: "shrine",
  tags: ["civic-ward", "pilgrimage"],
  eligibility: {
    regionIds: ["whitemarch"],
    biomeIds: ["chalk-down", "river-floodplain"],
    terrainIds: ["plains", "hills", "road"],
    nearTags: ["road"],
    forbiddenTags: ["open-sea"],
    stateRequirements: []
  },
  placement: {
    weight: 10,
    minimumSpacingCells: 8,
    regionalQuota: [1, 3],
    unique: false
  },
  footprintTemplateId: "footprint.small-shrine",
  placeTemplateId: "place.small-ward-shrine",
  namingTableId: "names.whitemarch-ward-shrines",
  encounterPoolId: "encounters.wardstone-shrine",
  interactionSetId: "interactions.wardstone-shrine",
  discoveryRuleId: "discovery.visible-from-road",
  visualId: "site.wardstone-shrine"
}
```

Every generated site is an instance of a reviewed archetype. Its id, placement,
name, footprint, services, interactions, encounter pools, and discovery rules
are resolved mechanically from approved data. A language model may describe the
result but may not invent the site, its history, its rewards, or its state.

Generated instance ids must be stable functions of the world id, seed,
generator version, archetype id, and placement anchor. Unique and quota-limited
sites use order-independent continental or super-chunk candidate selection so
opening chunks in a different order cannot move them.

## Landform, water, and ecology rules

- The continent mask is generated or authored once per manifest and always
  yields the same coast for the same seed and generator version.
- Hydrology runs after elevation and before ecology. Rivers follow valid
  drainage, join downstream, and reach a lake, wetland sink, or sea.
- Major named rivers, lakes, ranges, passes, and coasts may use authored anchors,
  but the connections between anchors remain deterministic and validated.
- The Hollow Coast must actually border coastal water. A river region must have
  connected water, not merely a water probability in an unused table.
- Biome selection uses declared suitability and regional palettes. Hard seams
  require a physical or authored cause; ordinary borders use transition bands.
- Roads and settlements respect slope, water, resources, and access. Bridges,
  ferries, passes, and tunnels are explicit route features.
- Generation samples a halo around chunk boundaries or uses continuous global
  fields so rivers, roads, elevations, and biomes do not break at chunk edges.

## Routes, travel, and encounters

Routes are stable atlas content with ids, endpoints, path cells, construction,
condition, access rules, and risk modifiers. Major routes connect authored
anchors; lesser tracks may be selected from regional archetypes. Every required
production settlement must be reachable from the starting place by at least one
legal route or an explicit ferry or other travel service.

Generated land remains available for cross-country travel when terrain permits.
Maintained roads are faster, safer, and easier to provision; they are not the
only traversable generated cells. Deep water, cliffs, glaciers, warded borders,
and similar barriers declare the movement modes or conditions that can cross
them.

Travel evaluates deterministic steps. Each step may apply:

- distance and terrain time;
- weather and daylight;
- food, water, fatigue, load, and mount or vessel costs;
- route condition and faction control;
- hazards, discoveries, and encounter eligibility;
- campaign deltas and current regional state.

Encounter tables are selectors for authored encounter definitions, not loose
descriptions. Eligibility may depend on region, biome, terrain, named area,
route, distance from settlement, season, weather, time, faction influence,
campaign flags, and cooldowns. A hostile result must reference a valid combat
composition; friendly and neutral results must reference valid interactions and
outcomes. All rolls use the named `travel` random stream.

## Determinism, lazy generation, and saves

Base generation is a pure function of approved inputs. At minimum these include:

```txt
world id + world seed + generator version + content version + layer name
+ coordinate or stable anchor + named random stream
```

The same inputs must produce the same Avarra regardless of device, reload,
viewport, route, chunk request order, or whether a neighboring chunk was
generated first.

- Use named streams such as `world:landform`, `world:hydrology`,
  `world:ecology`, `world:routes`, `world:sites`, and `travel:encounter`.
- Do not use ambient `Math.random()` in generation or travel resolution.
- Do not use network state, wall-clock time, database row order, or language
  model output as a generation input.
- A chunk is generated on demand and may be cached, discarded, and regenerated.
- Saves store the world manifest, content/rules versions, discoveries, commands,
  and campaign deltas. They do not need to store every unchanged base cell.
- A campaign remains pinned to its generator version. A new generator version
  requires either continued support for the old version or a tested migration;
  loading a save must never silently reshape its world.
- Content-only changes retain stable ids or provide explicit migrations for
  sites, routes, regions, places, and campaign deltas.

The renderer receives a projection of generated and authored state. It never
becomes a second map authority, and fog of war must not reveal undiscovered
terrain, routes, sites, or hydrology.

## Tone and material-culture guardrails

Generation arranges approved content; it does not excuse generic fantasy filler.

- Every production region has a reviewed regional brief covering climate,
  terrain, staple foods, seasonal pressures, materials, construction,
  transport, agriculture, warfare, trade, households, institutions,
  occupations, celebrations, and obligations.
- Historical sources and deliberate transformations are recorded. A real
  culture is never copied under a fantasy name or reduced to an aesthetic kit.
- Each society contains internal disagreement, class and occupational variety,
  neighboring influence, and change over time. Species does not determine moral
  character, profession, or allegiance.
- Generated buildings, clothing, tools, weapons, food, fuel, and transport use
  materials and techniques available through the region or a declared trade
  route.
- Items and sites declare construction, maker or institution, purpose, upkeep,
  and visible wear where applicable.
- Magic references authored rule ids with source, training or preparation,
  cost, scope, duration, sensory tell, resistance, and aftermath.
- Light high fantasy remains the default. Hospitality, craft, humor, festivals,
  friendship, recovery, curiosity, and civic life counterbalance danger and
  loss.
- Slavery, sexual violence, racial essentialism, graphic gore, and cruelty as
  decoration are not procedural content categories. A difficult subject enters
  an authored story only after its purpose, viewpoint, boundary, consequences,
  and player agency are reviewed.
- Generated names, rumors, histories, and local facts come from reviewed tables
  and definitions. Narration may phrase known facts but cannot add canon.

## Authoring checklist

Before a region, named area, route, or site archetype is added:

- [ ] Assign a stable id, status, content version, and owning region.
- [ ] Record the regional brief and historical sources or link to them.
- [ ] Define climate, seasons, landforms, watersheds, biome palette, and physical
      transitions.
- [ ] Define staple foods, materials, construction, transport, trade, labor,
      institutions, obligations, and internal social variation.
- [ ] Identify faction interests, disagreements, resources, and limits without
      assigning morality by species or culture.
- [ ] Place authored macro anchors and declare which connections may be
      generated.
- [ ] Define site eligibility, spacing, quotas, uniqueness, footprint, naming,
      discovery, interactions, encounters, rewards, and place template.
- [ ] Define route construction, travel modes, crossings, condition, risk, and
      service dependencies.
- [ ] Reference existing mechanical, visual, service, faction, item, enemy,
      encounter, and magic ids or add reviewed definitions.
- [ ] State what is public knowledge, rumor, secret, and campaign-dependent.
- [ ] Review tone, difficult subjects, material plausibility, and player-facing
      consequences.
- [ ] Add content validation, deterministic generation, migration, and
      production-slice tests.

## Validation checklist

Automated validation must reject content or generation that violates any of the
following:

- [ ] World bounds, cell scale, chunk size, seed, and versions are present.
- [ ] Queries outside the finite envelope cannot generate additional land.
- [ ] Every land cell has one resolved cultural authority or an explicitly
      authored unclaimed-region id; overlaps use declared precedence.
- [ ] Region, biome, named-area, faction, route, site, place, service, encounter,
      enemy, item, visual, and rule references resolve to valid ids.
- [ ] No duplicate stable ids or order-dependent generated instance ids exist.
- [ ] Repeated generation with the same manifest is byte-equivalent for the
      validated projection.
- [ ] Chunk and neighbor request permutations produce identical results.
- [ ] Changing the seed changes generation without breaking required anchors or
      the production slice.
- [ ] Rivers do not climb, terminate without a valid sink, or break at chunk
      edges; named coasts and river regions contain the required water.
- [ ] Biome distributions satisfy declared suitability and palette tolerances;
      transitions do not expose accidental rectangular seams.
- [ ] Required settlements, place mouths, roads, ferries, bridges, and world
      exits are reachable by their declared movement modes.
- [ ] Generated land is not rejected solely because it is procedural.
- [ ] Unique sites, minimum spacing, and regional quotas hold independently of
      generation order.
- [ ] Every generated site comes from an authored archetype and every encounter
      can resolve without invented mechanics or generic fallback content.
- [ ] Travel rolls use named deterministic streams and expose time, supply,
      weather, route, and risk consequences before commitment.
- [ ] Campaign deltas survive cache eviction and base regeneration without
      mutating unrelated cells.
- [ ] Old saves remain pinned to their generator version or pass a tested
      migration with stable locations and state.
- [ ] The Whitemarch Basin production slice passes route, district, encounter,
      service, save, replay, accessibility, tone, and material-culture review.

Passing technical generation tests does not promote a macro region to
production. Promotion also requires authored communities, professions,
factions, encounter ecology, services, regional consequences, and a reviewed
arc at the density promised to players.
