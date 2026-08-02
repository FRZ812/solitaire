// The authored geography a map shows once individual hexes stop being legible.
//
// Zoomed out, the viewport samples every Nth hex, so a one-hex-wide road breaks
// into dashes and a landmark almost never lands on a sample. Both therefore
// stop being cell properties and become their own scene layers, projected
// through the same transform as the hexes and drawn as continuous shapes.
//
// This is also what preserves a capability the deleted SVG overview owned: it
// let the party set a course for a place known only by reputation or legend.
// Those places are authored, not sampled, so they survive here.

import {
  CONTINENT,
  CONTINENT_HOT_SPRINGS,
  CONTINENT_ROUTES,
  CONTINENT_WATERWAYS,
  LANDMARKS,
  REALMS,
} from "../../data/continent.js";
import { isSeen, isVisited } from "../../engine/world.js";

// Places that give the continent its shape, kept when everything else is too
// small to read.
const MAJOR_KINDS = new Set(["city", "port", "wonder", "fortress"]);

function isMajor(place) {
  return !!place.capitalOfRealmId
    || place.role === "provincial-seat"
    || place.role === "faction-seat"
    || MAJOR_KINDS.has(place.kind);
}

// What the party may claim about a place it has not stood in. `charted` is
// personal knowledge; the other two are things travellers talk about, which is
// why an unvisited place can still be named and set as a destination.
function placeKnowledge(state, place) {
  const here = state.world?.currentTile;
  if ((here?.x === place.coord.x && here?.y === place.coord.y)
    || isSeen(state, place.coord.x, place.coord.y)
    || isVisited(state, place.coord.x, place.coord.y)) return "charted";
  return place.knowledge === "rumor" ? "reputation" : "legend";
}

function capitalPlace() {
  const central = REALMS.find((realm) => realm.id === "central");
  return {
    id: "whitemarch",
    name: central.capital.name,
    kind: "city",
    coord: { ...central.capital.coord },
    capitalOfRealmId: central.id,
  };
}

const ATLAS_PLACES = [
  capitalPlace(),
  ...LANDMARKS,
  ...CONTINENT_HOT_SPRINGS.map((spring) => ({
    id: spring.id, name: spring.name, kind: "hot-spring", knowledge: "fabled", coord: spring.center,
  })),
].filter((place, index, all) => (
  Number.isFinite(place.coord?.x) && all.findIndex((other) => other.id === place.id) === index
));

export function buildAtlasPlaces(state) {
  return ATLAS_PLACES.map((place) => ({
    id: place.id,
    name: place.name,
    kind: place.kind,
    x: place.coord.x,
    y: place.coord.y,
    major: isMajor(place),
    knowledge: placeKnowledge(state, place),
  }));
}

// Authored roads and rivers as polylines. Base geography is public — the same
// rule that already lets unexplored terrain render — so these are not gated on
// exploration. They carry no site names, only their own.
export const ATLAS_ROUTES = Object.freeze(CONTINENT_ROUTES.map((route) => Object.freeze({
  id: route.id,
  name: route.name,
  kind: "road",
  width: route.width || 1.6,
  points: route.waypoints.map((point) => ({ x: point.x, y: point.y })),
})));

export const ATLAS_WATERWAYS = Object.freeze(CONTINENT_WATERWAYS.map((waterway) => Object.freeze({
  id: waterway.id,
  name: waterway.name,
  kind: "river",
  width: waterway.widthEnd || 1.8,
  points: waterway.waypoints.map((point) => ({ x: point.x, y: point.y })),
})));

export const CONTINENT_HEX_KILOMETERS = CONTINENT.hexKilometers || 6;
