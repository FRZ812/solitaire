# Supabase storage & authoring workflow

## Where the map lives

`public.handcrafted_map`, one row, `id = 'whitemarch'`:

| column | type | meaning |
|---|---|---|
| `id` | text | always `'whitemarch'` |
| `tiles` | jsonb | `{ "x,y": { terrain, poi, doors, … }, … }` |
| `sealed_structures` | jsonb | `[ { name, … }, … ]` |
| `updated_at` | timestamptz | auto-touched on every UPDATE (optimistic-concurrency baseline) |
| `owner_id` | uuid | RLS: only the owner may UPDATE through the client |

The game fetches it once at boot (`hydrateMap()` in
`src/data/handcrafted-map.js`), runs `buildHandcrafted()`, and exposes the result
as the mutable `HANDCRAFTED` / `SEALED_STRUCTURES` singletons that
`src/engine/world.js` reads. The `src/data/whitemarch-districts/*.js` files are
**bootstrap authoring inputs**, not the live data — once seeded, edits flow
through the row, so the row is canonical and may have diverged from those files.

## Three ways to edit

### 1. In-game MapEditor (`#/edit`) — the intended path
`src/components/MapEditor.jsx` writes the row via `saveMap()`. RLS-gated to the
row owner. Best for hand-painting terrain, POIs, and the **Edges** tool (per-tile
`doors`). It re-runs the pipeline locally so the editor preview matches the game.

### 2. Supabase MCP — for scripted/bulk edits & audits
Read:
```sql
select tiles, sealed_structures, updated_at
from public.handcrafted_map where id = 'whitemarch';
```
Write (read-modify-write the whole JSON column — never blind-overwrite, you'd
wipe everything you didn't include):
```sql
update public.handcrafted_map
set tiles = $tiles::jsonb, sealed_structures = $sealed::jsonb
where id = 'whitemarch';
```
The MCP service role bypasses RLS, so writes succeed regardless of `owner_id`.

### 3. Seed script (one-shot bootstrap from district packages)
`scripts/seed-whitemarch-districts.js` merges every `src/data/whitemarch-districts/
district-*.js` and writes the row. Modes: `--dry` (validate + stats), `--print`
(dump merged JSON), `--apply` (write, needs `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`).
It validates bounding boxes and cross-module coord collisions first.

## Optimistic concurrency — the `STALE_MAP` gotcha

`saveMap()` gates its UPDATE on `WHERE updated_at = <value captured at load>`. If
*anyone* (another tab, the MCP, the seed script) wrote since the page loaded, the
filtered UPDATE matches 0 rows and `saveMap` throws `STALE_MAP` instead of
clobbering fresh content. This guard exists because stale tabs repeatedly wiped
this row.

**Implication:** after you write via MCP or a script, every open game tab /
editor is now stale — its next autosave will refuse with `STALE_MAP`. That's
correct behaviour. **Tell the user to reload open tabs after any out-of-band
write** so they pick up the new `updated_at` baseline. There is also a realtime
channel (`subscribeToMapUpdates`) that pushes UPDATEs to open tabs and bumps the
baseline; reloading is the reliable reset.

## District authoring-package format (when adding a big new area)

If you're authoring a sizeable district offline before applying, mirror the
existing package shape (`src/data/whitemarch-districts/_README.md`):

```js
export const DISTRICT_ID   = "noble-rise";
export const DISTRICT_NAME = "Noble Rise";
export const BOUNDING_BOX  = { xmin, xmax, ymin, ymax };   // seed script rejects out-of-box keys
export const TILES = { "x,y": { terrain, poi, doors }, … }; // REPLACE tiles at these coords
export const STRUCTURES = [ { name, … }, … ];               // APPENDED to sealed_structures
export const SERVICES = [ "service-id", … ];                // poi.service ids referenced (town.js audit)
```

Rules: stay inside your box; never overwrite a named POI you didn't author; when
you replace a tile you own its full new shape (terrain + poi + doors); new walls
go in with `doors: undefined`; declare every `poi.service` you reference.

## Always verify before and after

```bash
node .claude/skills/map-audit/audit-map.mjs --live --biomes   # before: snapshot current state
# …make edits…
node .claude/skills/map-audit/audit-map.mjs /tmp/after.json   # after: prove ERRORs dropped, no regressions
npm run build                                                  # data-shape sanity
```
