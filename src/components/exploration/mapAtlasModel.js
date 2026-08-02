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
import { WHITEMARCH_CAPITAL } from "../../data/whitemarch-capital.js";
import { isSeen, isVisited } from "../../engine/world.js";

// Places that give the continent its shape, kept when everything else is too
// small to read.
const MAJOR_KINDS = new Set(["city", "port", "wonder", "fortress"]);
// Seats with defences, which a map draws as a ring rather than a bare dot.
// Whether the walls are stone, ice, or grown timber is the description's
// business; at atlas scale the mark only has to say the place is held.
const FORTIFIED_KINDS = new Set(["city", "fortress"]);

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
    fortified: FORTIFIED_KINDS.has(place.kind),
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

// The hexes at a fixed hex-distance from a centre form a hexagon, so a city wall
// is exactly six corners and six straight edges — no sampling needed, and none
// wanted: the wall is one hex thick, so every stride above 1 breaks it into a
// dashed circle the same way it once broke the roads.
function wallRing(center, radius) {
  const corners = [
    { x: radius, y: 0 }, { x: radius, y: -radius }, { x: 0, y: -radius },
    { x: -radius, y: 0 }, { x: -radius, y: radius }, { x: 0, y: radius },
  ].map((corner) => Object.freeze({ x: center.x + corner.x, y: center.y + corner.y }));
  return Object.freeze([...corners, corners[0]]);
}

export const ATLAS_WALLS = Object.freeze([Object.freeze({
  id: `${WHITEMARCH_CAPITAL.id}-wall`,
  name: `${WHITEMARCH_CAPITAL.name} Wall`,
  kind: "wall",
  width: 1,
  points: wallRing(WHITEMARCH_CAPITAL.center, WHITEMARCH_CAPITAL.wallRadius),
})]);

export const CONTINENT_HEX_KILOMETERS = CONTINENT.hexKilometers || 6;
