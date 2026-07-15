# Unified world map

Status: **canonical spatial model**

The game has one canonical map, one coordinate system, and one authoritative
party position. `PlaceView`, place graphs, and a second city-navigation state
are deprecated. Capitals, streets, wilderness, routes, rivers, dungeons, and
continental landmarks all resolve through the same pointy-top axial world map.

The [Avarra generation contract](CONTINENT_GENERATION.md) governs the finite
continent. This document governs how dense authored areas coexist with its lazy
regional generation.

## One coordinate graph

Campaign location has one shape:

```js
{ currentTile: { x, y } }
```

Movement, route planning, discovery, services, quests, narration, and rendering
all read that coordinate. A UI may show a close city camera or a continent-wide
atlas, but those are projections of the same tiles and routes. Opening or closing
a view never moves the party or switches simulation models.

Outside dense authored areas, adjacent centers represent approximately 6 km of
regional travel. Dense sites use authored local-resolution cells in the same
graph. Those cells declare their city, district, access, and local travel
metadata, while reviewed road mouths connect them to the surrounding generated
regional cells. This is a deliberate resolution transition, not a second map.

## Continental generation

Avarra occupies the inclusive generation envelope `x [-540, 540]`,
`y [-400, 410]`. Base geography is evaluated lazily in deterministic 24 by 24
chunks. Request order, viewport order, and cache state may not change a result.

Continental data resolves in layers: landform, hydrology, ecology, cultural
region, named area, routes and sites, dense authored overlays, then campaign
deltas. Cultural regions and ecologies remain separate authorities. Authored
macro routes, waterways, and landmarks anchor the continent; reviewed site
archetypes supply stable generated content.

Dense authored overlays win only within their declared bounds and content
version. They must expose explicit route mouths to the generated road network.
Old database blobs without the active unified-map version are archival data,
not runtime authority.

## Whitemarch capital

Whitemarch is the initial dense authored area centered on Grain Square at
`{ x: 0, y: 0 }`. Its wall, gates, avenues, lanes, districts, services, river,
bridges, civic sites, and outer works are ordinary world tiles with capital
metadata. The city is large enough to support exploration and route choices,
while its named road mouths join Avarra's continental routes.

Each capital tile may declare:

```js
{
  terrain: "street",
  cityId: "whitemarch",
  districtId: "grand-market",
  districtName: "The Grand Market",
  regionId: "whitemarch",
  mapVersion: 2,
  poi: {
    type: "market",
    part: "grain-square",
    partName: "Grain Square",
    service: "market",
    access: "public",
    description: "..."
  }
}
```

Street and plaza cells form the public route graph. Indoor service cells expose
only reviewed entrances. Wall cells remain sealed except at declared gates and
stairs. Water remains impassable except at authored bridges, ferries, or other
mechanically supported crossings.

## State and persistence

Version-controlled manifests and deterministic generators are base authority.
Saves persist seed and content versions plus discoveries and dynamic deltas;
they do not replace generated geography with full snapshots. Authored tiles may
persist complete local state where required, but map updates remain authoritative
over stale saved copies.

Stable ids are required for cities, districts, POIs, routes, sites, and services.
Display text and art may change without changing those ids. Structural changes
require a content version and migration. Saves from the deprecated place graph
migrate one way onto matching unified-map POIs.

## Browser presentation

The React/canvas explorer renders both a close local camera and the continent
atlas from the same world state. It may add painterly materials, lighting,
weather, labels, fog, and district treatments, but every selectable destination
and legal route remains available through accessible controls.

The continent atlas collapses a dense capital to one major landmark marker.
Internal wards and services remain visible in the local camera rather than
flooding the continental landmark list.

## First production region

Whitemarch Basin is the first production-complete region. It requires:

- an expansive, fully connected capital on the unified map;
- distinct gates, markets, workshops, civic halls, shrines, recovery services,
  docks, gardens, housing, and controlled or hidden spaces;
- stable road mouths between city streets and continental routes;
- the Whitewend and its crossings as continuous hydrology;
- nearby road, farm, market, shrine, ferry, and frontier communities;
- factions and encounters conditioned by district, route, terrain, time,
  weather, and campaign state;
- save, replay, discovery, service, and migration coverage.

The outer regions remain traversable lower-density macro geography until each
receives its own production review.

## Retired approaches

The following are historical experiments, not active authoring instructions:

- `PlaceView` and any separate place-navigation screen;
- `world.place`, place-node coordinates, or switching map scale in campaign
  state;
- maintaining a city graph and world hex map as competing authorities;
- accepting the disconnected 921-cell Supabase export as canonical merely
  because it is large;
- treating rendered geometry or a database row as the map model;
- allowing narration to invent persistent geography or mechanics.

## Validation

Content validation must reject:

- duplicate coordinates, ids, POI parts, or service anchors;
- dense tiles missing city, district, region, or map-version metadata;
- public POIs unreachable from the initial position;
- non-reciprocal doors, doors to missing cells, or wall crossings outside gates;
- route mouths that do not join generated continental routes;
- invalid service, encounter, art, faction, ecology, or region references;
- more than one capital marker in the continent atlas;
- chunk-order-dependent geography, hydrology, routes, landmarks, or sites;
- saves that reintroduce place state or replace deterministic geography with
  stale full generated snapshots;
- location changes without a persisted-campaign migration.
