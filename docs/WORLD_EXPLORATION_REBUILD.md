# World & Exploration Rebuild

Working plan for the overhaul of world generation, travel, and the atlas.
Reviewable in flight: each workstream states its intent, the files it touches,
the data shapes it introduces, and how it is verified.

Canonical constraints this plan must not contradict:
- `docs/MAP_REBUILD_V3.md` — one map, one coordinate graph. Every view is a
  projection of the same tiles and routes.
- `docs/product/vision.md` — SVG is reserved for technical geometry only, never
  as the game's visual identity. Narration is performance, not authority.

---

## 1. Diagnosis

Three complaints, three separate causes.

**"The world felt shallow and empty."** This is arithmetic, not art. The
continent envelope is roughly 875,000 hexes against 59 authored landmarks —
about 0.007% authored density. The generator filled the gap with a seven-entry
list of generic sites (`monster-den`, `bandit-camp`, `forgotten-ruin`, …), so
the wilderness was empty except for occasional identical mystery boxes.

**"Travel feels uninteresting and unintuitive."** `rollPathEncounter` is
explicitly capped at one beat per journey ("One beat per journey means at most
one encounter even if multiple rolls would have fired"), and the destination
panel presents a march as three numbers: steps, time, danger %. A multi-day
crossing resolves as one dice roll and a progress bar.

**"The world overview is half baked and ugly."** `WorldOverview.jsx` is a
schematic SVG diagram — coloured ellipses per realm, a hand-drawn coastline
polygon, glyph characters for places. It is a second, competing authority for
what the world looks like, which `MAP_REBUILD_V3.md` explicitly retires, and
its SVG identity contradicts `vision.md`.

---

## 2. Decisions taken

These were chosen by the user and are binding.

| Question | Decision |
| --- | --- |
| World scale | **Mass-generate density.** Keep the ~875,000-hex envelope; push the generator to place far more content rather than shrinking the map. |
| Travel model | **Staged expedition.** A journey resolves as a sequence of legs with decisions between them. Arrival is earned. |
| Atlas | **One continuous map.** Delete the SVG overview; zooming out stays in the same canvas renderer with progressive LOD. |

### 2a. The scenery redirect

Density of *interactables* does not fix an empty world — density of *scenery
that plausibly belongs there* does. Most of what a player passes should be
ambient and non-interactive: a bridge, a ford, a lake, a cave mouth, a clearing,
a shrine, a statue, cottages along the road.

Placement must follow world logic derived from facts the generator already
knows, not a flat probability roll:

- a bridge or ford exists **because** a road meets water
- houses, fences, and orchards cluster **because** a settlement is near
- milestones count down **because** the road leads somewhere
- jetties and fish traps sit on shorelines; peat stacks in marsh; cairns on hills

Interactive sites become the rare exception rather than the unit of world
content.

---

## 3. Workstreams

### WS1 — Site vocabulary and ambient scenery  *(complete)*

**1a. Wire up the dead motif data.** `REGION_DEFINITIONS[].features` and
`ECOLOGIES[].features` name ~76 place-specific motifs (`peat-camp`,
`wyrm-roost`, `caravanserai`, `drowned-shrine`, `stilt-village`, …). Grep
confirms nothing ever read them. A comment at `continent.js:514` documents the
intended design — region and ecology choose the concrete motif, the archetype
fixes the mechanical identity — but it was never implemented.

- `src/data/continent.js` — new frozen `SITE_MOTIFS` catalog binding each motif
  slug to `{ family, terrains?, routeOnly? }`. **Done.**
- `src/engine/world-generation.js` — `siteFeaturePool(region, ecology)` composes
  region motifs (weight 4), ecology motifs (weight 2), and the universal
  `CAMPAIGN_MINOR_SITE_FEATURES` fallback (weight 1), deduplicated by kind,
  sorted by kind so pool contents never depend on query order, cached per
  `region:ecology` pair. Selection moves from `pick` to `weightedPick`.
  `ecology` is threaded through `eligibleMinorSiteCandidateAt`.
  `MAX_CAMPAIGN_SITE_SPACING` now spans motifs as well as fallbacks. **Done.**

Region motifs outrank ecology motifs so the Mire reads as the Mire even where
its wetland ecology is shared with the Bonemarsh. The universal fallback stays
available everywhere so lodging and danger never depend on a region happening
to name them.

**1b. Ambient scenery layer.** New module `src/engine/world-scenery.js`
exporting `worldSceneryAt(probe)`. **Done, needs review.**

Scenery has no encounter, no loot, and no state. Entry shape:

```js
{ id, kind, label, detail, tags: [] }
```

`kind` drives the map decal (`bridge`, `ford`, `causeway`, `dwelling`, `field`,
`waymarker`, `shore`, `water`, `grove`, `stone`, `cave`, `pen`, `shrine`,
`vantage`). `label` is the short noun phrase for the travel log; `detail` is the
sentence shown on inspection.

Rules run in priority order, capped at two per tile:

| Rule | Trigger | Example output |
| --- | --- | --- |
| `crossingScenery` | `route && waterway` | stone / timber / piled bridge, ford, lake causeway |
| `roadsideScenery` | `route` and distance to nearest inhabited landmark ≤ 7, in bands of falling density (85% / 55% / 30%) | cottages, walled orchard, wayhouse, smithy → fenced fields, flock, hay barn → charcoal stack, laid hedge, field shrine |
| `waymarkerScenery` | `route`, landmark distance 2–12 and divisible by 3 | milestone / waystone naming the place and its distance in leagues |
| `shoreScenery` | `!route && water neighbour` | duckboards, heron pool, eel traps, plunge pool, spring head, tarn |
| `vantageScenery` | `!route && elevation > 0.7` | a view over the named region |
| `naturalScenery` | terrain table, 38% off-road / 18% on-road | ~9 entries per terrain across forest, plains, hills, mountains, marsh, reedfield, road |

Supporting helpers added to `world-generation.js`:
`nearestInhabitedLandmark(x, y, maxDistance)` (linear scan of the 59 authored
landmarks, filtered to inhabited kinds, ties broken by id for determinism) and
`hasWaterNeighbor(x, y, seed)`. Both are reached through `sceneryProbe`, which
resolves them **lazily** via getters — a road tile never probes its shoreline
and a wilderness tile never asks which town it counts down to.

`scenery` is attached to the sample and to the generated tile, deep-copied on
the way out so tiles stay serialisable.

Verified so far: 72 distinct scenery kinds appear across a 400×300 sample grid;
a transect out of Mirecross produces `a wayhouse + a toll board` → `cottages
along the verge + a heap of road-stone` → `a drover's track` → `wader flats` →
`a sunken statue`.

**Result.** Generated sites now read as their region:

| Region | Generated site kinds |
| --- | --- |
| Mire | drowned shrine ×6, reed village ×5, ferry ×4, peat camp ×3, plus fallbacks |
| Tannic Wood | river ford ×4, root ruin ×4, hidden grove ×3, old grove ×3, hermit cell |
| Crowsmoor Reach | watch post ×14, shepherd camp ×6, fairground ×4, freehold ×4 |

**Decisions taken during WS1:**

- **Scenery is drawn from the geography seed, not the campaign seed.** A bridge
  stands where the road crosses the river in every playthrough. This surfaced as
  a cross-seed determinism failure and the failure was correct: scenery belongs
  to the persistent world layer, alongside roads and coastlines, not to campaign
  deltas. Sites remain campaign-varying.
- **Test fixture re-pinned.** `world-generation.test.js` pinned one coordinate to
  `frontier-fort`; the widened pool yields `woodward-lodge` there. Re-pinned
  rather than loosened, so the file keeps its precise drift detection.
- **Catalog test reframed.** The old test asserted a hand-written coordinate
  fixture for each of the seven fallback kinds and required the fixture keys to
  equal the catalog exactly. With 83 kinds that is unmaintainable, and the
  guarantee worth protecting is not "every kind has a fixture" but "no site is
  generated outside its declared terrain or off-road when route-only." The
  per-sample `terrains` / `routeOnly` assertions are kept, and the fixture block
  is replaced by a check that regional motifs actually reach the world — the
  exact bug that let 76 motifs sit unread.
- **New data-integrity test** in `continent-content.test.js`: every motif must
  bind to a real archetype and be named by some region or ecology, and every
  named slug must resolve to a motif or a fallback kind. Both failure modes —
  dead motifs, and named slugs silently degrading to generic sites — had already
  shipped once.
- **`poiChance` left unchanged** (0.018–0.035) rather than raised to the ~0.067
  derived from day-march spacing. Scenery now carries the felt density, so
  interactive sites should stay rare. Revisit after WS4 makes leg pacing visible.
- **Performance.** The shore rule originally probed its six neighbours before
  rolling, which pushed the world-scan test past its 5s budget. Cheap
  disqualifiers and the presence roll now settle first; the scan went from
  timing out to 1.46s. Full suite: 963 passing.

**Known and accepted:** adjacent tiles roll independently, so a road can show two
road-stone heaps in a row. For road furniture this reads as correct. If it proves
annoying elsewhere the fix is a neighbour-rejection pass, at the cost of six extra
probe evaluations per tile. Concentration within a region (Crowsmoor's 14 watch
posts) is intentional legibility; WS2 toponymy will make them read as distinct
places rather than repeated labels.

### WS2 — Real toponymy  *(complete)*

Sites were named `` `${areaWord} ${titleFromSlug(kind)}` `` — "Tannic Monster
Den" — and described by a three-sentence template keyed only on archetype.

**Names.** `src/data/toponymy.js` holds element banks: head elements per realm
(so the frost north does not sound like the sun south), compounding stems and
standalone nouns per archetype family, inn sign words, and name patterns per
family. `src/engine/toponymy.js` assembles them through an injected
`random(stream)`, so naming stays a pure function of (seed, version, x, y).

Region prefixes from `REGION_DEFINITIONS.areas` are mixed into the head pool and
win 45% of the time, which is what makes a Mire name sound like the Mire.

Sample output: `Langthorpe`, `Old Wendcairn`, `Sedgewell`, `The Blue Hound`,
`The Shrine of the Pale God`, `Rushtower`, `The Alderscar`, `Chalk Ferry`.

Four defects found and fixed by inspecting real output rather than trusting the
generator:

- `The Household Ancestors Rood` — the `{faith} {noun}` pattern reads wrong for
  faiths that are plain noun phrases. Pattern changed to `The {noun} of {faith}`.
- `Birchchapel` — a head whose ending repeats the stem's opening slurs into
  itself. Heads that collide with their stem now take the spaced form, alongside
  the existing rule for heads too long to compound (`Stillwaterhithe`).
- `Chalk Ford` for a **ferry** — family nouns are right for most motifs but flatly
  wrong for a few. `MOTIF_NAME_OVERRIDES` keeps the name honest: a ferry is not a
  ford, a mine is not a quarry, an ice cave is not a hollow.
- Faith names needed `the Pale God` preserved but `river saints` raised to title
  case, without producing `the The Pale God`.

**Descriptions.** Every motif in `SITE_MOTIFS` and every fallback kind in
`CAMPAIGN_MINOR_SITE_FEATURES` now carries a `description` stating what the place
*is*. This is the factual ground narration may phrase but not contradict. Two
template bugs were fixed at the same time:

- `slate market halls marks it as Heartlander work` — culture architecture
  entries are noun phrases of mixed number, so they are now set as an appositive
  (`Heartlander work, slate market halls.`) instead of a subject.
- Every wilderness site closed with the same sentence, because wilderness context
  has one description for the whole continent. Sites now name their area instead.

Result: `The Well of Household Ancestors` — *"A shrine on the crest, walled
against the wind, sited so it can be seen from the whole valley. Heartlander
work, river brick. It stands within Wind Vale."*

Test assertions that pinned descriptions to `archetype.description` were widened
to accept the motif or fallback line, keeping the "opening states what it is"
guarantee.

### WS3 — Legibility on the map  *(complete)*

Generated sites were emitted as `poi: { type: "hidden", name: null }`, so the map
showed nothing until the player stood on them. Travel had no visible
destinations: sites appeared only as arrival events.

**The sighting layer.** `src/engine/world-sighting.js` answers two questions per
site — how far its silhouette carries, and whether anyone names it:

| archetype | range | named | notes |
| --- | --- | --- | --- |
| fortification | 7 | yes | walls on high ground |
| settlement | 6 | yes | roofs and smoke |
| ruin, wonder | 5 | no | seen, not identified |
| roadside-inn, crossing, resource | 4 | yes | road traffic names them |
| shrine | 3 | no | |
| camp, clearing | 2 | no | |
| den, bandit-camp | 1 | no | `secret` — never mapped until entered |

Terrain shifts the range: mountains/desert/tundra +2, hills/plains/steppe +1,
marsh/reedfield −1, forest/jungle −2, floored at 1. A site on a maintained route
earns a name from the traffic that passes it — but `secret` archetypes never do,
so an ambush stays an ambush.

**Three grades.** `siteKnowledgeGrade(sighting, { distance, explored })` returns:

- **silhouette** — in range, or on ground already crossed: icon only, no name
- **rumoured** — the same, for sites travellers name: icon plus the real name
- **discovered** — the poi record is open, which still only happens on arrival

Ground the party has already crossed keeps its sites permanently, so the map
fills in as it is walked rather than only within a sight bubble.

**Presentation.** `publicLocationPresentation(tile, coord, sighting)` gained an
optional third argument. Given one, a hidden site presents as what is visible
from where the party stands — *"Ruins / Broken walls stand clear of the ground
around them."* — and a rumoured one presents under its name. Without it the
function behaves exactly as before, so no existing caller changed meaning.
`nameForDestination` now names a sighted site even on unmapped ground: being
able to see a thing is the whole reason it is a destination.

**Rendering.** `selectMapMarkerEntries` no longer requires a name — a silhouette
is a marker with no name yet — and the explored gate now applies only to named
places, since sighted sites sit on ground the party has not explored. `drawPoi`
draws partial knowledge at reduced alpha (rumoured .72, silhouette .48) and
suppresses the market-tier badge, so the map distinguishes what the party has
stood in from what it has merely spotted. The four archetypes sharing the
generic `landmark` poi type now carry an explicit `mapIcon` through discovery.

**Measured** on a fresh campaign, four sample viewports of 285 cells each:
4–10 generated sites present, of which 1–3 are immediately legible, the rest
earned by walking. Before this workstream the count was zero in every case.

**Decision taken: scenery is exposed but not drawn.** Scene cells now carry
`scenery` labels for explored ground (94–126 of 285 cells hold scenery), which
WS5's travel log consumes. Drawing ambient glyphs at one fixed scale risks
exactly the "half baked and ugly" result this rebuild exists to fix, so ambient
density is tuned per zoom tier in WS6 instead.

### WS4 — Staged expedition travel  *(engine complete)*

A leg used to be `fullPath.slice(0, WORLD_MARCH_LIMIT + 1)` — the party stopped
after 48 hexes of nothing, and the only thing that could interrupt a journey was
an encounter. `src/engine/expedition.js` replaces that with a leg planner.

**Where a leg ends.** `planLeg` scans forward and cuts at the first boundary a
traveller would recognise, in this order of precedence:

| kind | ends the leg at |
| --- | --- |
| `destination` | the route's end |
| `waypoint` | a place travellers name — an open POI, or a generated site graded `rumoured` by WS3's sighting model |
| `crossing` | where a route meets water |
| `border` | a change of `regionId`, labelled with the area entered |
| `going` | crossing into or out of hard country (mountains, marsh, swamp, jungle, desert) |
| `nightfall` | the pace's marching budget runs out |
| `limit` | `WORLD_MARCH_LIMIT`, the safety bound |

`legTooShort(steps, minutes, dayMinutes)` absorbs a boundary that falls too close
to the start, so the party does not stop three times inside one valley. The last
three kinds are hard caps and ignore it.

The rule needs *both* measures, because one hex means two very different things
on the shared graph: a handcrafted city hex is a street corner 12 minutes away, a
continental hex is six kilometres and 144 minutes. A leg is only too short when
it is short by step count (`< MIN_LEG_STEPS`) **and** by clock (`< 25%` of the
day). A step floor alone was the WS4 bug that probing caught — at 144 min/hex a
day's march is ~3.3 hexes, so a 3-step floor swallowed every waypoint, crossing,
border and going boundary on the continent and left nothing but `nightfall`.
In the city, 12-min hexes stay well under the quarter-day, so the original
two-hex absorption still holds there.

**What a leg reports.** `passed` collects up to six distinct kinds of WS1 ambient
scenery along the way, and `describePassage(leg)` renders it as one line. This is
what a leg has to say when nothing happens, which is most legs. `describeLegStop`
phrases *why* the party halted for the narrator brief.

**Pace.** `TRAVEL_PACES` — careful / steady / forced. Pace deliberately does *not*
change how fast ground is crossed; a mile of marsh is a mile of marsh however it
is walked. It changes `dayMinutes` (how long the party stays on its feet before
the `nightfall` cut) and `riskMult`, now a third argument to `rollPathEncounter`.
So a forced march covers more ground per leg and meets more on the way, and the
tradeoff is legible instead of a hidden speed multiplier.

**Wiring.** `handleTravel` reads `state.world.travelPace`, plans one leg, and
rolls the encounter against that leg — an encounter can still cut a leg short of
its boundary, in which case the passage line is suppressed because the party
never walked that ground. `planHexJourney` calls `planExpedition` with the same
pace, so the highlighted route on the map is exactly the ground the engine will
walk, and carries `legs` for the UI to preview. The visual march gate and
`settleTravelLifecycle` are untouched.

### WS5 — Travel UI  *(complete)*

`DestinationPanel` rendered steps / time / danger % as a spreadsheet, plus a
"This march reaches 48 of 112 steps" line that told the player a hex count and
nothing about the journey. It now shows the journey itself.

**The itinerary.** An ordered list of the legs ahead, each row naming the place
the leg ends at, what kind of ending it is (`LEG_BOUNDARIES[kind].label` — "A
crossing", "A change of country"), what the leg passes, and its cost. The first
row is marked `is-next`. The marker square is coloured by `data-boundary`, so the
shape of a journey reads at a glance: a run of `going` and `nightfall` is a hard
crossing, a chain of `waypoint`s is a road between towns. The final row is
labelled with the panel's own fog-safe destination name rather than the engine's
`destination` boundary label, which falls back to a terrain word.

**Fog safety.** A leg's boundary *names a place*, so previewing a leg that runs
into unmapped ground would leak site names the party has never seen.
`knownLegs(state, journey)` in `travelMapModel.js` walks the mapped prefix of the
route and keeps only whole legs with `leg.to < mapped`; the rest are dropped, not
truncated. `travelMapModel.test.js` asserts a fogbound label never reaches the
serialized preview. When the route runs past the mapped prefix the panel says so
in plain words instead of showing a partial itinerary.

**Pace picker.** A three-button group writing `state.world.travelPace` through
`handleSetTravelPace`, which the engine reads on the next leg plan and encounter
roll. Free to change between legs. Each button carries its `note` as a title, and
the active one is `aria-pressed`.

**Preview honesty.** `planHexJourney` runs the same `planExpedition` the engine
will, at the same pace, so the highlighted leg on the map is the exact ground the
party walks. `hexMapModel.test.js` locks `journey.legPath === planLeg(...).path`.

**Verified by** `expedition.test.js` (8), plus new cases in
`travelMapModel.test.js` (fog gate), `mobileNavigation.test.jsx` (rendered
itinerary + pace picker markup) and `hexMapModel.test.js` (preview/engine
agreement). Full suite green at 128 files / 981 tests. Not visually confirmed in
a browser — no browser automation is available in this environment, so the panel
was checked through `vite build` and server-rendered markup only.

#### Deferred to WS6

The between-legs decision surface beyond pace — push on vs. make camp, route
forks — needs the map to show the alternatives, so it lands with the atlas work.

### WS6 — Continuous canvas atlas  *(complete)*

Zooming out past `TRAVEL_MAP_MIN_ZOOM` opened `WorldOverview`, a second renderer
with its own SVG projection, its own camera, its own place model and its own
modal shell. Two maps of one world that agree about nothing. WS6 deletes it and
pushes the same canvas down to continental scale.

#### The constraint that shapes everything

The continent spans **x ∈ [-535, 528], y ∈ [-455, 395]** — about 1063 × 850
hexes, ~875,000 in total. A viewport cannot enumerate that, and `getTile` runs
the generator per hex. So zooming out must not add cells.

**Cell count stays bounded; the stride between sampled hexes grows.** The window
grows with zoom until it hits a ceiling of 31 rows (columns follow the canvas
aspect, up to 45), and everything past that is bought with stride. At stride 28
a 47 × 37 rendered window covers roughly 1,300 × 1,000 hexes — about 1.36 million
hexes of ground for 1,739 `getTile` calls. Each drawn hex stands for an S × S
patch instead of one hex.

To be precise about the cost: a continental frame is not free, it is *bounded*.
It enumerates about 3× the cells of a zoom-1 frame and then stops, rather than
scaling with the ground it shows.

`mapLod.js` derives it from one continuous quantity:

```
coverage = 15 / zoom          // rows of ground the camera wants
rows     = clamp(coverage, 9, 31)
stride   = evenized(coverage / rows)
```

| zoom | coverage | rows | stride | tier | ground |
| --- | --- | --- | --- | --- | --- |
| 1.8 | 8 | 9 | 1 | `local` | a street |
| 0.6 | 25 | 25 | 1 | `local` | a valley |
| 0.24 | 62 | 31 | 2 | `region` | a province |
| 0.06 | 250 | 31 | 8 | `continent` | a realm |
| 0.017 | 882 | 31 | 28 | `continent` | the landmass |

Stride is forced **even** above 1. The viewport enumerates an offset-row
rectangle and converts back to axial with `x = offsetColumn - floor(y / 2)`; only
an even stride makes `floor(y / 2)` advance exactly `S / 2` per row, so the
samples land on a clean sub-lattice instead of wobbling. `buildWorldLayout` then
divides `q` and `r` by stride, which makes sampled hexes tile edge-to-edge at the
same on-screen radius as before.

#### What each tier draws

| | `local` | `region` | `continent` |
| --- | --- | --- | --- |
| hex outlines | yes | no | no |
| ambient scenery glyphs | yes | no | no |
| POI markers | all known | named only | major only |
| place labels | on selection | major | all charted + rumoured |
| authored routes | as road hexes | vector ribbons | vector ribbons |

Outlines stop at stride 1 because a hex boundary drawn around a 28-hex sample is
a lie; without it, terrain reads as continuous masses, which is what a map at
that scale should look like. Roads are one hex wide and would break into dashes
under sampling, so above stride 1 `CONTINENT_ROUTES` and `CONTINENT_WATERWAYS`
are drawn as vector ribbons instead — continuous, and better looking than a
hex-by-hex road.

#### Places are a scene layer, not sampled cells

At stride 28 a sample almost never lands on a landmark, so authored places cannot
come from the viewport. `scene.places` carries `LANDMARKS` + the capital +
hot springs, projected through the same layout transform and hit-tested by
proximity ahead of the cell test.

This is also what preserves a capability the overview owned: it let the player
set a course for a place known only by **reputation** (`RUMORED`) or **legend**
(`FABLED_BY_COORD`) — somewhere never seen. Those places stay selectable on the
canvas at region and continent tiers, drawn faint, so "set out for the fabled
city" survives the deletion of the modal.

#### Fog at continental scale

Per-hex fog at stride 28 would veil a continent the party has barely walked, and
a near-uniform dark wash is exactly the "half baked and ugly" result this
rebuild exists to fix. It is also wrong: the scene model already treats base
geography as public, and the overview was explicitly a public atlas. So fog
weakens with stride — at continent tier unexplored ground is a light wash and
explored ground takes a warm tint, which turns the atlas into a record of where
the party has actually been.

#### Getting there and back

`travelMapZoomStep` loses `openWorldOverview`. The header's overview button stops
opening a modal and jumps the camera to minimum zoom, so the whole-continent view
is still one click away; recenter returns to the party. The wheel and pinch cover
everything in between.

#### The frame cost this exposed

Building the atlas made a pre-existing inefficiency impossible to ignore: a
zoomed-out frame took 400–1000 ms, which is a visible stall every time the camera
moves. Profiling put almost none of it in the new code.

`buildExplorationModel` generated every drawn hex **three times**. It called
`buildRpgViewport` once for the visible window and again for the render window —
though the first is a strict subset of the second — and then the landmark index
looped over the render viewport calling `getTile` on each cell a third time.

Fixed in `hexMapModel.js`:

1. The render window is built once and the visible window is **sliced out of it**
   by col/row band. Both are centred on the same cell and both dimensions are odd,
   so the inset is exact.
2. The landmark index reads tiles from the cells already built instead of
   regenerating them.
3. Above stride 1 the sampled cells are **left out of the landmark index
   entirely**. Their sites are an arbitrary subset of what is out there — the
   authored places layer is what names ground at that scale, which is the same
   argument `selectMapMarkerEntries` already makes for markers.

| frame | before | after |
| --- | --- | --- |
| zoom 1 · local · 567 cells | 94 ms | 24 ms |
| zoom 0.3 · region · 1,739 cells | 1,020 ms | 112 ms |
| zoom 0.017 · continent · 1,739 cells | 366 ms | 110 ms |

Ordinary play got ~4× cheaper too, not just the atlas. `hexMapModel.test.js`
guards the invariant by object identity: every `viewport` cell must be the same
object as its `renderViewport` counterpart, which a second generator pass could
not produce.

#### Deleted

`WorldOverview.jsx`, `WorldOverview.test.jsx`, `WorldOverview.styles.test.js`,
`worldOverviewModel.js`, `worldOverviewModel.test.js`,
`WORLD_OVERVIEW_ZOOM_THRESHOLD`, and the 327-line `.world-overview-*` stylesheet
block.

#### Verification

`mapLod.test.js` walks 400 zooms across the whole range asserting the even-stride
invariant, odd row counts, monotonic coverage, and that minimum zoom actually
spans the continent's 850-hex height. `mapAtlasModel.test.js` covers knowledge
grading (legend / reputation / charted) and that ribbons disclose no site names.
`mapCanvasRender.test.js` drives `renderMap` through a recording 2D context at
both extremes, checking the continental pass emits fewer strokes (no outlines) and
still labels authored places. `mapGeometry.test.js` covers strided layout,
projection of authored coordinates, and place hit-testing.

**Not visually confirmed.** No browser automation is available in this
environment, so the atlas has been verified through tests and `vite build` only —
never looked at. For a workstream whose entire premise is that the old overview
was *"half baked and ugly"*, that is the significant open risk.

#### Panning the strided lattice  *(complete)*

Reported after the first live test: *"panning on the zoomed out rectangle grids
feels clunky like it is moving on steps, like it is trying to auto correct or
align at a certain close distance"*.

`travelMapDragDelta` divided the pixel drag by `worldRadius` — the radius of a
*drawn cell*, which stands for `stride` hexes — and handed the result to
`panTravelMapCamera` as a **hex** delta. So a full cell of drag moved the camera
one hex. WS6's lattice snapping then quantised the camera to whole strides, so
nothing moved until the drag crossed `stride / 2` cells and the window jumped a
whole cell: at stride 28, fourteen cells of dragging per visible step, with the
sub-cell preview resetting to zero at every cell boundary in between. That reset
against a stationary window is the "auto correct" the report describes.

Two things were wrong. The delta needed scaling by `stride`, and it was rounding
onto the wrong lattice: above stride 1 the stride is even, `floor(y / 2)` advances
by exactly `S/2` per row, and the samples land squarely under each other rather
than half-offset — a *rectangular* screen lattice, whose axes round independently.
Cube rounding only applies at stride 1, where a drawn cell really is a hex. The
basis a probe confirmed:

| one drawn cell | camera delta |
| --- | --- |
| right | `(S, 0)` |
| down | `(-S/2, S)` — not `(0, S)`, which moves diagonally |

Both preserve lattice membership exactly, so the camera never needs correcting:
`anchorY` shifts by whole strides, and `offsetColumn` by `S·Σcol` with the `-S/2`
and the `+S/2` from `floor(y/2)` cancelling. `stride` now threads through
`rebaseTravelMapDrag` / `panTravelMapCamera` and both `MapCanvas` drag sites; the
`commit` pixels divide by it, keeping the round-trip exact so `residual` still
supplies sub-cell smoothness. Verified at strides 1/2/4/10/28: one dragged cell
moves the window exactly one cell, with zero residual.

### WS7 — Travel that only stops for a reason  *(planned)*

Live test: *"marching stops after 3 hex with options to stay on the map or go to
chat. nope it should always stay on the map and keep moving unless something
inherently needs to stop i.e fatigue, hunger/thirst, encounter with an npc on
that specific hex that stops the party, a checkpoint etc, just any real
meaningful stop, not a stop every certain distance."*

**The measurement.** Three real routes out of Whitemarch, planned eight legs deep:

```
0,0 -> 20,12  (35 hexes)   leg0 steps=4 waypoint:Bonepicker Chapel
                           leg1 steps=5 crossing:The Whitewend
                           leg2 steps=3 waypoint:Sheep Gate
                           leg3 steps=6 crossing:The Whitewend
                           leg4 steps=2 crossing:The Whitewend
0,0 -> -40,30 (49 hexes)   leg3 steps=3 border:Reed Crossing
                           leg7 steps=1 going:Plains
0,0 -> 60,-45 (73 hexes)   leg6 steps=2 border:Chalk Downs
```

Every named building in the capital, every touch of the river, and every county
line is a full stop — a card, a confirmation, and an LLM narration turn. A 73-hex
journey costs roughly fifteen of them.

Two independent causes. `boundaryAt` treats geography as a reason to halt; and
`legTooShort` cannot absorb those boundaries out on the continent, because at
~100 min/hex a *single* hex already exceeds the 25%-of-a-day half of WS4's
both-measures rule. `leg7 steps=1 min=202` is that failure exactly.

**The decision.** A march runs until something real interrupts it. Camping is not
an interruption — it happens inside the march.

**7a — geography becomes passage.** `waypoint`, `crossing`, `border` and `going`
move out of `boundaryAt` and into `collectPassed`, keeping their labels, so a leg
still reports the chapel, the ford and the county line it went by. That is the
purpose the module already claims. `boundaryAt`, `legTooShort` and
`MIN_LEG_STEPS` are then unused and go.

**7b — nightfall becomes a camp.** `planLeg` keeps scanning past `dayMinutes`,
incrementing `leg.nights` and resetting the day clock at each crossing. `nights`
reaches the narrator brief and the halt card ("four nights on the road").

**7c — the march ends when the party cannot sustain it.** A new `supplies`
boundary. `planLeg` runs the engine's own upkeep forward hex by hex —
`depleteNeeds` + `autoConsume` against a cloned `character.inventory` and
`world.codex.items` — and cuts at the first hex where hunger or thirst would fall
to `Starving`/`Parched` with nothing in the pack to fix it. Reusing the real
functions rather than approximating them is what stops the forecast and the beat
tick disagreeing. `WORLD_MARCH_LIMIT` (48) stays as the bound that keeps the
planner from walking the continent through the tile generator.

> **Prerequisite this exposes.** `applySurvivalTick` drains needs by the beat's
> full `minutes_passed` but runs `autoConsume` **once**. That is survivable for a
> half-day leg and starves the party over a fourteen-day one, no matter how many
> rations they carry. Long marches are not safe to ship until upkeep consumes per
> day across a long beat.

**7d — encounters stop being an automatic halt.** *"a dangerous encounter still
party can attempt to escape and continue the journey with a probability chance
depending on the enemy difficulty against the party. then i.e a traveling
merchant, a option to stay or keep going still but without probably to being
stopped."*

`rollPathEncounter` returns the first hit of **any** posture and
`pathThroughEncounter` truncates the march there — so a doe frozen mid-graze, a
pair of cranes, or city pedestrians end an expedition. The 101 authored entries
already carry `posture`, which is the axis this needs:

| posture | effect on the march |
| --- | --- |
| `friendly` / `neutral` | never truncates. The march carries on; the event is offered as a choice the player may take (trade, talk, join a caravan) or ride past |
| `hostile` | an evasion roll — party against `regionDifficulty(x, y, seed).level`. Evaded, the march continues and the near-miss is narrated; failed, it halts at that hex as now |

Evasion is a balance number, so per project convention it gets a
`scripts/*-sim.mjs` sweep rather than a guessed constant.

**7e — more than danger and merchants.** *"needs multiple encounters that are
interesting however, not just generic danger or merchant."* The content is
already broad; what is thin is the set of *interactions*. Open — needs a
taxonomy of travel events beyond fight/trade before it can be specified.

**7f — the halt card keeps the player on the map.** "Back to the story" comes
off the card; the map's own close already exists for leaving deliberately.

---

## 4. Verification

- `src/engine/world-generation.test.js` — determinism, chunk-order independence,
  geographic validity of every generated site
- `src/data/continent-content.test.js` — authored content integrity
- `src/engine/world-route.test.js` — routing
- Per the project convention, validate through the artifact build before web
  testing.
