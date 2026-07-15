# Repository skills

These skills must follow the current design authorities, in order:

1. `docs/product/vision.md`
2. `docs/WORLDBUILDING.md`
3. `docs/MAP_REBUILD_V3.md`
4. `docs/design/combat-deck.md`
5. `docs/architecture/runtime.md`

| Skill | Use it for |
|---|---|
| `worldbuilding` | Regions, cultures, factions, characters, material culture, magic, and lore consistency |
| `map-creation` | Region-atlas locations and node-graph places in the canonical two-scale model |

Retired guidance must not be restored from old files or Git history. In
particular, do not default to grimdark tone, dense city hexes, sealed-structure
door compilation, a Supabase map blob as content authority, or a Godot renderer.

When implementation still contains a legacy path, treat it as a migration
constraint. New content should use stable ids and serializable definitions that
can move into the canonical browser runtime without reinterpretation.
