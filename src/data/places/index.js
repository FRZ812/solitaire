// Place registry — the node-graph "places" (scale 2 of the two-scale world).
//
// Places ship as version-controlled data (the bundled default below) so the game
// and the "paste dist/index.html into a Claude artifact" flow both work with zero
// DB dependency. A live Supabase overlay can be layered on top at boot via
// applyPlacesData() (mirrors the handcrafted-map hydrate pattern) so authored
// content stays live-editable.
//
// Authoring contract (see data/places/whitemarch.js):
//   place = { id, name, kind, worldTile:{x,y}, entry, biomeId?, description?, nodes }
//   node  = { name, district?, type?, terrain?, access?, service?, description?,
//             exits:[nodeId...], worldExit? }
// Exits are symmetrised on load: author each link once, both ends get it.

import { whitemarch } from "./whitemarch.js";

const BUNDLED = [whitemarch];

// Mutable singleton, same pattern as HANDCRAFTED. Populated from BUNDLED at module
// load and replaceable by a live overlay. Keyed by place id.
export const PLACES = {};

// World-hex → place id, so a world tile can find the place whose mouth it is.
const placeByWorldKey = {};

function symmetrise(place) {
  // Deep-ish clone the nodes and ensure every exit is bidirectional and valid.
  const nodes = {};
  for (const [id, n] of Object.entries(place.nodes || {})) {
    nodes[id] = { ...n, id, exits: Array.isArray(n.exits) ? [...n.exits] : [] };
  }
  for (const [id, n] of Object.entries(nodes)) {
    for (const ex of n.exits) {
      const target = nodes[ex];
      if (!target) {
        console.warn(`[places] ${place.id}: node "${id}" exits to unknown node "${ex}"`);
        continue;
      }
      if (!target.exits.includes(id)) target.exits.push(id);
    }
  }
  return { ...place, nodes };
}

function indexPlaces(list) {
  for (const k of Object.keys(PLACES)) delete PLACES[k];
  for (const k of Object.keys(placeByWorldKey)) delete placeByWorldKey[k];
  for (const raw of list) {
    if (!raw || !raw.id) continue;
    const place = symmetrise(raw);
    PLACES[place.id] = place;
    if (place.worldTile) placeByWorldKey[`${place.worldTile.x},${place.worldTile.y}`] = place.id;
  }
}

indexPlaces(BUNDLED);

// Replace the live set (e.g. from a Supabase overlay). `list` is an array of raw
// place objects; falls back to the bundled defaults if empty/invalid.
export function applyPlacesData(list) {
  indexPlaces(Array.isArray(list) && list.length ? list : BUNDLED);
}

export function getPlace(id) {
  return id ? PLACES[id] || null : null;
}

export function getNode(placeId, nodeId) {
  const place = getPlace(placeId);
  if (!place) return null;
  return place.nodes[nodeId] || null;
}

// The place whose mouth sits on world hex (x,y), if any. Used to detect that
// arriving at / standing on a hex should offer entry into a place.
export function placeIdForWorldTile(x, y) {
  return placeByWorldKey[`${x},${y}`] || null;
}

// A world hex that is a place-mouth advertises it via poi.place; this lets the
// world map render an "enter" affordance and the engine route into the graph.
export function placeIdForTile(tile, x, y) {
  if (tile?.poi?.place) return tile.poi.place;
  return placeIdForWorldTile(x, y);
}
