# World content ownership

| Concern | Authority |
|---|---|
| Product and tone | `docs/product/vision.md`, `docs/WORLDBUILDING.md` |
| Region/place structure | `docs/MAP_REBUILD_V3.md` |
| Combat and campaign effects | `docs/design/combat-deck.md` plus versioned definitions under `src/data/` |
| Runtime state changes | deterministic commands and events under `src/engine/` |
| Presentation | React components and raster assets under `src/components/` and `src/assets/` |
| Campaign persistence | versioned snapshots and events; Supabase is storage, not content authority |

## Content definition rules

- Use stable, unique ids and explicit schema versions.
- Reference existing ids for factions, places, encounters, cards, statuses,
  items, art, and text.
- Put mechanical values in data definitions, never descriptive prose.
- Record regional material and historical references with generated assets.
- Validate references, enum values, numeric bounds, and migration impact.
- Treat language-model output as a proposal until validated and reviewed.

The old rectangular-biome difficulty ladder, dense handcrafted-city map,
sealed-structure pipeline, and rumored/fabled distance conventions are legacy
implementation details. Do not extend them as new worldbuilding authority.
