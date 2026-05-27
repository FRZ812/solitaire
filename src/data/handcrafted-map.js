// Handcrafted-map loader. The map lives in Supabase (public.handcrafted_map,
// id='whitemarch') and is fetched at app boot. Consumers (engine/world.js,
// data/initial-state.js, components/MapEditor.jsx) import the mutable
// HANDCRAFTED and SEALED_STRUCTURES singletons exported here and read them
// AFTER main.jsx has awaited hydrateMap() — which it does before mounting
// any UI.
//
// Why mutable singletons rather than a fetch-returning function?
//   The rest of the codebase grew up around `import { HANDCRAFTED } from
//   ...` and treated it as a static dict. Re-plumbing every consumer to
//   await a getter would be a sweeping refactor with no behavioural win
//   (the map is fetched once at boot, never re-fetched). Keeping the same
//   import surface lets the rest of the code be unchanged.
//
// Edits to the map (from #/edit) call saveMap() which UPDATEs the row and
// also re-runs the pipeline locally so the editor's in-memory state and
// the running game's HANDCRAFTED stay in sync within the same tab. Other
// tabs see the change on next reload (the user chose reload-on-load over
// realtime push during planning).

import { supabase } from "../engine/supabase-client.js";
import { buildHandcrafted } from "./handcrafted-pipeline.js";

const MAP_ID = "whitemarch";

// Mutable singletons. Populated by hydrateMap(). Treated as the same
// reference for the life of the page; we mutate in place so existing
// imports keep working.
export const HANDCRAFTED = {};
export const SEALED_STRUCTURES = [];

let hydratePromise = null;

// Awaitable boot-step. Idempotent: subsequent calls return the same promise.
// Throws if Supabase is unreachable or the row is missing — main.jsx
// surfaces that to the user as a load failure rather than a blank game.
export async function hydrateMap() {
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    const { data, error } = await supabase
      .from("handcrafted_map")
      .select("tiles, sealed_structures")
      .eq("id", MAP_ID)
      .single();
    if (error) {
      hydratePromise = null; // let the caller retry on next mount
      throw new Error(`Failed to load handcrafted map: ${error.message}`);
    }
    applyMapData(data.tiles, data.sealed_structures);
  })();
  return hydratePromise;
}

// Persist authored map state. Only the row owner (RLS-enforced) can do
// this. After a successful write we also re-run the pipeline locally so
// HANDCRAFTED reflects the new state immediately for the current tab —
// other open tabs see the change on their next reload.
//
// IMPORTANT: PostgREST returns 204 (no error) when an UPDATE matches no
// rows because of RLS. That's indistinguishable from "row doesn't exist"
// at the JS layer. So we chain `.select()` to make the response carry
// the actual updated row, then verify at least one came back. Without
// this guard the editor's "saved" badge happily lies whenever the signed-
// in user isn't the row's owner.
export async function saveMap({ tiles, sealedStructures }) {
  // Migrate before upload so the row in Supabase never receives stale
  // schema (a browser running the pre-rename bundle would otherwise
  // resurrect old terrain names every autosave).
  tiles = migrateTiles(tiles);
  const { data, error } = await supabase
    .from("handcrafted_map")
    .update({ tiles, sealed_structures: sealedStructures })
    .eq("id", MAP_ID)
    .select("id");
  if (error) throw new Error(`Failed to save handcrafted map: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error(
      "Save returned 0 rows — likely RLS rejected the update. Confirm you're signed in as the owner of the handcrafted_map row (check owner_id in Supabase against auth.uid())."
    );
  }
  applyMapData(tiles, sealedStructures);
}

// Backwards-compat tile migrations. Runs on every load + save so the
// in-memory state, the editor's local state, and the Supabase row all
// converge on the canonical terrain names regardless of which bundle
// version produced the data. Add new migrations here as the schema
// evolves — keep them cheap (O(n) over tiles).
function migrateTiles(tiles) {
  if (!tiles) return tiles;
  const out = {};
  for (const [k, t] of Object.entries(tiles)) {
    // wall_top → wall (the old name for the mountable fortress wall).
    if (t && t.terrain === "wall_top") {
      out[k] = { ...t, terrain: "wall" };
    } else {
      out[k] = t;
    }
  }
  return out;
}

// Refresh the singletons from passed-in authored data. Used internally
// after fetch, after save, and after realtime UPDATE events. Also
// exported for the MapEditor so it can preview pipeline output before
// saving.
export function applyMapData(tiles, sealedStructures) {
  tiles = migrateTiles(tiles);
  const built = buildHandcrafted({ tiles, sealedStructures });
  // Drop every key in HANDCRAFTED that's no longer in the build, then
  // copy the new values in. Same reference, fresh contents — consumers
  // that already grabbed Object.keys(HANDCRAFTED) on this tab won't see
  // ghost tiles after a save that deleted some.
  for (const k of Object.keys(HANDCRAFTED)) delete HANDCRAFTED[k];
  for (const [k, v] of Object.entries(built)) HANDCRAFTED[k] = v;
  SEALED_STRUCTURES.length = 0;
  for (const s of sealedStructures) SEALED_STRUCTURES.push(s);
  // Notify subscribers (the game's <MapView> re-render hook, mostly) so
  // they can refresh when realtime pushes new map data.
  for (const cb of mapUpdateListeners) {
    try { cb(); } catch (e) { console.error("[handcrafted-map] listener error:", e); }
  }
}

// Per-tab listeners notified after applyMapData runs. The React layer
// uses these to force a re-render when the map changes from another
// tab (realtime) or after a save in this tab.
const mapUpdateListeners = new Set();
export function onMapUpdate(cb) {
  mapUpdateListeners.add(cb);
  return () => mapUpdateListeners.delete(cb);
}

// Subscribe to realtime UPDATE events on the handcrafted_map row.
// Returns an unsubscribe function. Idempotent at the channel level —
// supabase-js dedupes channel names, so multiple calls return the same
// underlying channel but each unsubscribe still works.
//
// We treat the realtime event as authoritative: the payload's `new` row
// holds the freshly-saved tiles + sealed_structures, so we don't need
// a follow-up fetch. If the row gets deleted (shouldn't happen — we
// only have UPDATE policies) the channel surfaces a DELETE event which
// we ignore; the next hydrateMap retry will surface the missing row.
export function subscribeToMapUpdates() {
  const channel = supabase
    .channel(`handcrafted_map:${MAP_ID}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "handcrafted_map", filter: `id=eq.${MAP_ID}` },
      (payload) => {
        if (!payload?.new) return;
        applyMapData(payload.new.tiles, payload.new.sealed_structures);
      }
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
