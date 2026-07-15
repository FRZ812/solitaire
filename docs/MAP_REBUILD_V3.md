# World and place model

Status: **canonical spatial model**

The world uses two authored scales. Both are plain serializable data rendered by
the browser runtime; neither depends on Godot or another embedded engine.

## Region scale

The regional atlas represents wilderness travel, roads, rivers, settlements,
weather, faction influence, supplies, and route risk. A cell or route step is a
travel decision, not a room-sized combat square.

Travel proceeds through deterministic steps. Each step advances time, applies
terrain and weather rules, consumes supplies, and evaluates authored encounter
eligibility with a named random stream. An encounter pauses travel and opens the
deck-combat scene; combat does not require a tactical grid.

Minor landmarks can live directly on the atlas. A capital, town, dungeon, fort,
or similarly dense site links to a place id.

## Place scale

A place is a graph of meaningful locations: districts, streets, courtyards,
rooms, gates, paths, or chambers. Nodes are authored for decisions and activity,
not forced into equal physical dimensions.

```js
{
  id: "whitemarch",
  name: "Whitemarch",
  regionId: "whitemarch-basin",
  entryNode: "crown-gate",
  nodes: {
    "crown-gate": {
      name: "Crown Gate",
      kind: "gate",
      exits: ["market-road", "outer-road"],
      services: [],
      access: "public",
      descriptionKey: "place.whitemarch.crown-gate"
    }
  }
}
```

Exits are validated and normalized when content loads. A node can expose
services, encounter pools, access requirements, scene art, characters, and
interactions. Returning through a world exit restores the linked atlas location.

## State

Campaign location has one explicit shape:

```js
{ scale: "region", regionId, locationId }
{ scale: "place", regionId, placeId, nodeId }
```

Movement commands validate a destination against the current scale and emit
time, resource, discovery, and location events. Presentation reads this state;
it never keeps a second authoritative position inside a renderer.

## Content authority

Version-controlled region and place definitions are the base content authority.
A backend may store campaign state or deliver a validated content overlay, but a
database row, generated scene, or rendered geometry is not a competing map model.

Stable ids are required for saves and replays. Display names, descriptions, and
art may change without changing ids. Structural changes require a content version
and migration.

## Browser presentation

The atlas and place views use React plus a purpose-built DOM/canvas renderer.
The renderer may add parallax, depth layers, lighting, weather, and painterly
raster assets, but all selectable locations and legal exits remain available as
accessible controls.

Scene data passed to the renderer is a projection of canonical map state. It is
not a second simulation protocol and does not use iframe messaging.

## First production region

Whitemarch Basin is the only region that must be complete before expansion. Its
first production slice needs:

- the capital and nearby road/ferry communities;
- a small set of legible routes and weather pressures;
- distinct market, workshop, civic, shrine, and recovery locations;
- three factions with conflicting but understandable interests;
- encounter pools connected to terrain, route, faction, and campaign state;
- stable exits between atlas and place scales.

Additional regions remain concepts until this slice proves travel, place
navigation, deck encounters, saves, and replay.

## Retired approaches

The following are historical experiments, not active authoring instructions:

- modeling a city as hundreds of wilderness-scale hexes;
- using per-hex door meshes and sealed-structure compilation for interiors;
- maintaining blob and relational map models in parallel;
- treating rendered Godot geometry as the interactive authority;
- storing region plans across overlapping draft documents.

Git history preserves those designs. New documentation and tooling must refer to
this model only.

## Validation

Content validation must reject:

- duplicate or missing ids;
- exits whose destination does not exist;
- unreachable required nodes or missing world exits;
- invalid service, encounter, art, faction, or region references;
- overlapping region authority without an explicit precedence rule;
- location changes that lack a migration for persisted campaigns.
