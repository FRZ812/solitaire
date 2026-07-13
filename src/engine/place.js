// Place (scale 2) engine. The party is "inside a place" when state.world.place is
// set to { id, node }; otherwise it is on the world hex map. This module owns the
// reducers that move between/within places and the synthetic "standing tile" that
// lets the rest of the engine (location naming, narrator context, town services)
// treat the current node exactly like a world tile.
//
// Dependency-only on data/places to avoid an import cycle with engine/world.js
// (world.js imports this for place-aware currentLocationName).

import { getPlace, getNode, placeIdForTile } from "../data/places/index.js";
import { titleFromId } from "./location.js";

export { getPlace, getNode, placeIdForTile };

export function inPlace(state) {
  return !!state?.world?.place?.id;
}

export function currentPlace(state) {
  return inPlace(state) ? getPlace(state.world.place.id) : null;
}

export function currentNode(state) {
  if (!inPlace(state)) return null;
  return getNode(state.world.place.id, state.world.place.node);
}

// Build a tile-shaped object from a place node so tile consumers (poiPlaceName,
// poiMeta, buildingForTile, buildStateContext) work unchanged inside a place.
export function nodeTile(place, node) {
  if (!place || !node) return null;
  return {
    terrain: node.terrain || "settlement",
    poi: {
      type: node.type || "bldg",
      name: node.name,
      description: node.description,
      service: node.service || undefined,
      access: node.access || undefined,
      parent: place.id,
      parentName: place.name,
      area: place.id,
      areaName: place.name,
      district: node.district || undefined,
      districtName: node.district || undefined,
      part: node.id,
      partName: node.name,
    },
    // Markers so render/engine code can tell a node tile from a hex tile.
    place: place.id,
    node: node.id,
  };
}

// The tile the party is standing on right now: the synthetic node tile inside a
// place, else null (callers fall back to getTile(state, cur.x, cur.y) on the
// world map — kept out of here to avoid a world.js import cycle).
export function standingNodeTile(state) {
  const place = currentPlace(state);
  const node = currentNode(state);
  return nodeTile(place, node);
}

// "Whitemarch — Grain Square" style label for the current node.
export function placeLocationName(state) {
  const place = currentPlace(state);
  const node = currentNode(state);
  if (!place || !node) return null;
  return `${place.name} — ${node.name}`;
}

// The nodes reachable from the current node, as { id, name, district, type,
// access, worldExit } for the UI. Includes a synthetic "@world" exit entry when
// the current node can step out onto the world hex.
export function currentExits(state) {
  const place = currentPlace(state);
  const node = currentNode(state);
  if (!place || !node) return [];
  const out = [];
  for (const exId of node.exits || []) {
    const ex = place.nodes[exId];
    if (!ex) continue;
    out.push({ id: exId, name: ex.name, district: ex.district, type: ex.type, access: ex.access });
  }
  return out;
}

// ---- reducers (pure: return a new state) ----

// Enter a place from the world. Lands at nodeId, or the place's `entry`, or the
// first node. currentTile is left at the world hex so leaving returns there.
export function enterPlace(state, placeId, nodeId = null) {
  const place = getPlace(placeId);
  if (!place) return state;
  const node = nodeId && place.nodes[nodeId] ? nodeId : (place.entry || Object.keys(place.nodes)[0]);
  return { ...state, world: { ...state.world, place: { id: place.id, node } } };
}

// Move to an adjacent node (must be an exit of the current node).
export function moveToNode(state, nodeId) {
  const place = currentPlace(state);
  const node = currentNode(state);
  if (!place || !node) return state;
  if (!node.exits.includes(nodeId) || !place.nodes[nodeId]) return state;
  return { ...state, world: { ...state.world, place: { ...state.world.place, node: nodeId } } };
}

// Walk a complete previewed route atomically. The city UI can plan several
// graph edges at once, but the reducer still validates every authored exit so a
// stale or forged route can never teleport through the place graph.
export function moveAlongPlaceRoute(state, nodeIds) {
  if (!Array.isArray(nodeIds) || nodeIds.length === 0) return state;
  const place = currentPlace(state);
  let cursor = currentNode(state);
  if (!place || !cursor) return state;
  for (const nodeId of nodeIds) {
    if (!cursor.exits.includes(nodeId) || !place.nodes[nodeId]) return state;
    cursor = place.nodes[nodeId];
  }
  return { ...state, world: { ...state.world, place: { ...state.world.place, node: cursor.id } } };
}

// Step back out onto the world hex (only legal from a worldExit node).
export function leavePlace(state) {
  if (!inPlace(state)) return state;
  return { ...state, world: { ...state.world, place: null } };
}

// Can the current node step out to the world?
export function canLeave(state) {
  const node = currentNode(state);
  return !!node?.worldExit;
}

// Is world hex (x,y) the mouth of a place? Returns the place id or null.
export function placeAtTile(tile, x, y) {
  return placeIdForTile(tile, x, y);
}
