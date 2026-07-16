import { describe, expect, it } from "vitest";
import * as ContinentData from "./continent.js";

const {
  BORDER_CHECKPOINTS,
  COASTAL_FEATURES,
  CONTINENT,
  CONTINENT_ROUTES,
  LANDMARKS,
  PROVINCES,
  REALMS,
  REALM_FACTIONS,
} = ContinentData;

const CONTINENT_SEA_LANES = ContinentData.CONTINENT_SEA_LANES || [];

const coordKey = ({ x, y }) => `${x},${y}`;
const hasFiniteCoord = (value) =>
  value && Number.isFinite(value.x) && Number.isFinite(value.y);

function pointInsidePolygon(point, polygon) {
  let inside = false;

  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const a = polygon[current];
    const b = polygon[previous];
    const crossesRay = (a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crossesRay) inside = !inside;
  }

  return inside;
}

function touchesAuthoredWater(point) {
  if (!pointInsidePolygon(point, CONTINENT.coastline)) return true;

  return COASTAL_FEATURES.some((feature) => {
    if (!feature.carve) return false;
    const horizontal = (point.x - feature.coord.x) / feature.carve.radiusX;
    const vertical = (point.y - feature.coord.y) / feature.carve.radiusY;
    return horizontal * horizontal + vertical * vertical <= 1;
  });
}

function routesContainingPlace(place, routes) {
  return routes.filter((route) =>
    route.waypoints.some((waypoint) => coordKey(waypoint) === coordKey(place.coord))
      || route.checkpointIds.includes(place.id));
}

function connectedRouteIds(routes, origin) {
  const routeCoords = new Map(routes.map((route) => [
    route.id,
    new Set(route.waypoints.map(coordKey)),
  ]));
  const reachable = new Set(
    routes
      .filter((route) => routeCoords.get(route.id).has(coordKey(origin)))
      .map((route) => route.id),
  );

  let foundConnection = true;
  while (foundConnection) {
    foundConnection = false;
    for (const route of routes) {
      if (reachable.has(route.id)) continue;
      const routePoints = routeCoords.get(route.id);
      const touchesReachableRoute = routes.some((candidate) =>
        reachable.has(candidate.id)
          && [...routePoints].some((point) => routeCoords.get(candidate.id).has(point)));
      if (touchesReachableRoute) {
        reachable.add(route.id);
        foundConnection = true;
      }
    }
  }

  return reachable;
}

describe("expanded continent content contract", () => {
  it("defines five realms with four governed provinces apiece", () => {
    expect(REALMS).toHaveLength(5);
    expect(new Set(REALMS.map((realm) => realm.id)).size).toBe(5);

    for (const realm of REALMS) {
      const realmProvinces = PROVINCES.filter((province) => province.realmId === realm.id);
      expect(realmProvinces, realm.id).toHaveLength(4);
      expect(new Set(realmProvinces.map((province) => province.id)).size, realm.id).toBe(4);
      for (const province of realmProvinces) {
        expect(province.governor?.name, province.id).toBeTruthy();
        expect(province.authorityFactionId, province.id).toBeTruthy();
      }
    }
  });

  it("resolves every provincial and faction seat to an authored atlas place", () => {
    const landmarkIds = new Set(LANDMARKS.map((landmark) => landmark.id));
    const capitalIds = new Set(REALMS.map((realm) => realm.capital.id));
    const atlasPlaceIds = new Set([...landmarkIds, ...capitalIds]);

    const seatOwners = [
      ...PROVINCES.map((province) => ({ owner: province.id, seatId: province.seatLandmarkId })),
      ...REALM_FACTIONS.map((faction) => ({ owner: faction.id, seatId: faction.seatLandmarkId })),
    ];

    for (const { owner, seatId } of seatOwners) {
      expect(atlasPlaceIds.has(seatId), `${owner} -> ${seatId}`).toBe(true);
      if (!landmarkIds.has(seatId)) {
        expect(seatId, `${owner} uses an unexpected virtual atlas place`).toBe("whitemarch");
      }
    }
  });

  it("gives every distant biome realm a dense and varied set of named places", () => {
    const outerRealmIds = REALMS.filter((realm) => realm.id !== "central").map((realm) => realm.id);

    for (const realmId of outerRealmIds) {
      const places = LANDMARKS.filter((landmark) => landmark.realmId === realmId);
      const nonCheckpointPlaces = places.filter((landmark) => landmark.role !== "border-checkpoint");

      expect(places.length, `${realmId} named places`).toBeGreaterThanOrEqual(12);
      expect(nonCheckpointPlaces.length, `${realmId} destinations`).toBeGreaterThanOrEqual(10);
      expect(new Set(nonCheckpointPlaces.map((landmark) => landmark.kind)).size, `${realmId} place variety`)
        .toBeGreaterThanOrEqual(5);
      expect(nonCheckpointPlaces.every((landmark) => landmark.name && landmark.description?.length >= 40), realmId)
        .toBe(true);
    }
  });

  it("keeps authored roads well formed and checkpoint references bidirectional", () => {
    const routeIds = new Set(CONTINENT_ROUTES.map((route) => route.id));
    const checkpointById = new Map(BORDER_CHECKPOINTS.map((checkpoint) => [checkpoint.id, checkpoint]));

    expect(routeIds.size).toBe(CONTINENT_ROUTES.length);
    for (const route of CONTINENT_ROUTES) {
      expect(route.waypoints.length, route.id).toBeGreaterThanOrEqual(2);
      expect(route.waypoints.every(hasFiniteCoord), route.id).toBe(true);
      expect(Array.isArray(route.checkpointIds), route.id).toBe(true);
      for (const checkpointId of route.checkpointIds) {
        const checkpoint = checkpointById.get(checkpointId);
        expect(checkpoint, `${route.id} -> ${checkpointId}`).toBeTruthy();
        expect(checkpoint.routeIds, `${checkpointId} -> ${route.id}`).toContain(route.id);
        expect(route.waypoints.map(coordKey), `${route.id} misses ${checkpointId}`).toContain(coordKey(checkpoint.coord));
      }
    }

    for (const checkpoint of BORDER_CHECKPOINTS) {
      expect(checkpoint.routeIds.length, checkpoint.id).toBeGreaterThan(0);
      for (const routeId of checkpoint.routeIds) {
        expect(routeIds.has(routeId), `${checkpoint.id} -> ${routeId}`).toBe(true);
        expect(CONTINENT_ROUTES.find((route) => route.id === routeId)?.checkpointIds, checkpoint.id)
          .toContain(checkpoint.id);
      }
    }
  });

  it("connects every outer capital, port, and military checkpoint to Whitemarch's road network", () => {
    const origin = REALMS.find((realm) => realm.id === "central").capital.coord;
    const reachableRoutes = connectedRouteIds(CONTINENT_ROUTES, origin);
    const importantPlaces = LANDMARKS.filter((landmark) =>
      landmark.realmId !== "central"
        && (landmark.capitalOfRealmId || landmark.kind === "port" || landmark.role === "border-checkpoint"));

    expect(importantPlaces.length).toBeGreaterThanOrEqual(12);
    for (const place of importantPlaces) {
      const containingRoutes = routesContainingPlace(place, CONTINENT_ROUTES);
      expect(containingRoutes.length, `${place.id} has no road`).toBeGreaterThan(0);
      expect(containingRoutes.some((route) => reachableRoutes.has(route.id)), `${place.id} is isolated`)
        .toBe(true);
    }
  });

  it("authors navigable sea lanes between valid ports with offshore geometry", () => {
    const portsById = new Map(
      LANDMARKS.filter((landmark) => landmark.kind === "port").map((port) => [port.id, port]),
    );
    const realmIds = new Set(REALMS.map((realm) => realm.id));

    expect(CONTINENT_SEA_LANES.length).toBeGreaterThanOrEqual(3);
    for (const lane of CONTINENT_SEA_LANES) {
      expect(lane.waypoints.length, lane.id).toBeGreaterThanOrEqual(3);
      expect(lane.waypoints.every(hasFiniteCoord), lane.id).toBe(true);
      expect(lane.portIds.length, lane.id).toBeGreaterThanOrEqual(2);
      expect(lane.realmIds.every((realmId) => realmIds.has(realmId)), lane.id).toBe(true);

      for (const portId of lane.portIds) {
        const port = portsById.get(portId);
        expect(port, `${lane.id} -> ${portId}`).toBeTruthy();
        expect(lane.waypoints.map(coordKey), `${lane.id} does not berth at ${portId}`)
          .toContain(coordKey(port.coord));
      }

      const berthCoords = new Set(lane.portIds.map((portId) => coordKey(portsById.get(portId).coord)));
      const offshoreWaypoints = lane.waypoints.filter((waypoint) => !berthCoords.has(coordKey(waypoint)));
      expect(
        offshoreWaypoints.some(touchesAuthoredWater),
        `${lane.id} has no authored offshore or coastal-water waypoint`,
      ).toBe(true);
    }
  });
});
