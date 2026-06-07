# Solitaire skills

Project-committed Claude Code skills for building and maintaining the game world.
Each lives in its own directory with a `SKILL.md` (the entry point) and
`reference/` files loaded on demand.

| Skill | Use it when you're… | Key tool |
|---|---|---|
| **`worldbuilding`** | designing lore — regions/biomes, factions, races, difficulty bands, encounter flavor, named landmarks, keeping the grimdark tone | `data/*.js` schemas in `reference/` |
| **`map-creation`** | authoring the physical hex map — towns, dungeons, fortresses, districts, the doors graph, sealed structures | tile/door/structure references |
| **`map-audit`** | studying, validating, or **cleaning up** the live Supabase map | `map-audit/audit-map.mjs` |

## How they fit together

The world has two layers that must agree:

1. **Lore / systemic geography** — which region a coordinate belongs to, who
   rules it, how dangerous it is, what wanders there (the **worldbuilding**
   skill, editing `src/data/biomes.js`, `factions.js`, `regions.js`, …).
2. **The physical map** — the actual walkable hexes, POIs, and access graph
   stored in Supabase (`public.handcrafted_map`, id=`whitemarch`) (the
   **map-creation** skill).

Anything you author with either skill should be **verified with `map-audit`**
before it lands. The auditor runs the engine's own pipeline (`buildHandcrafted`)
so its verdict matches the running game, and exits non-zero on any
gameplay-breaking error.

## Canonical rulings

These skills summarize `docs/WORLDBUILDING.md` (repo root) — read it for the
authoritative ruling set. Design vision lives in `docs/world-expansion-plan.md`
and `docs/region-planning/*`.

## Quick start: audit the live map

```bash
node .claude/skills/map-audit/audit-map.mjs --live --biomes
```
(or feed a `{tiles, sealed_structures}` JSON dump pulled via the Supabase MCP).
