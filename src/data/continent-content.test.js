import { describe, expect, it } from "vitest";
import * as ContinentData from "./continent.js";

const {
  BORDER_CHECKPOINTS,
  CAMPAIGN_MINOR_SITE_FEATURES,
  COASTAL_FEATURES,
  CONTINENT,
  CONTINENT_HOT_SPRINGS,
  CONTINENT_LAKES,
  CONTINENT_ROUTES,
  CONTINENT_WATERWAYS,
  LANDMARKS,
  NORTHERN_RIDGES,
  PROVINCES,
  RARE_TRADE_HOUSES,
  REALMS,
  REALM_FACTIONS,
  REGION_DEFINITIONS,
} = ContinentData;

const CONTINENT_SEA_LANES = ContinentData.CONTINENT_SEA_LANES || [];

const coordKey = ({ x, y }) => `${x},${y}`;
const hasFiniteCoord = (value) =>
  value && Number.isFinite(value.x) && Number.isFinite(value.y);
const distanceBetween = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

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

  it("anchors multiple cities and faction territories in every realm", () => {
    const cityKinds = new Set(["capital", "city", "town"]);
    for (const realm of REALMS) {
      const cities = LANDMARKS.filter((landmark) => (
        landmark.realmId === realm.id
        && (landmark.capitalOfRealmId === realm.id || cityKinds.has(landmark.kind))
      ));
      const factions = REALM_FACTIONS.filter((faction) => faction.realmId === realm.id);
      const territoryFactionIds = new Set(
        PROVINCES.filter((province) => province.realmId === realm.id)
          .map((province) => province.authorityFactionId),
      );

      expect(cities.length, `${realm.id} cities`).toBeGreaterThanOrEqual(2);
      expect(factions.length, `${realm.id} factions`).toBeGreaterThanOrEqual(2);
      expect(territoryFactionIds.size, `${realm.id} faction territories`).toBeGreaterThanOrEqual(2);
    }
  });

  it("reviews the campaign-variable minor-site families carried by the atlas", () => {
    const kinds = new Set(CAMPAIGN_MINOR_SITE_FEATURES.map((feature) => feature.kind));
    expect([...kinds]).toEqual(expect.arrayContaining([
      "woodland-clearing",
      "monster-den",
      "bandit-camp",
      "roadside-inn",
      "wayward-shrine",
      "forgotten-ruin",
      "frontier-fort",
    ]));
  });

  it("assigns every biome region to an authored macro-realm boundary", () => {
    const realmIds = new Set(REALMS.map((realm) => realm.id));
    for (const region of Object.values(REGION_DEFINITIONS)) {
      expect(region.parentRealmIds?.length, region.id).toBeGreaterThan(0);
      expect(region.parentRealmIds.every((realmId) => realmIds.has(realmId)), region.id).toBe(true);
    }
    expect(REGION_DEFINITIONS["far-wild"].parentRealmIds).toEqual(["north", "east", "south", "west"]);
  });

  it("keeps authored landmarks and province regions inside their declared realm boundaries", () => {
    for (const landmark of LANDMARKS.filter((entry) => entry.realmId && entry.regionId)) {
      expect(REGION_DEFINITIONS[landmark.regionId].parentRealmIds, landmark.id).toContain(landmark.realmId);
    }
    for (const province of PROVINCES) {
      for (const regionId of province.regionIds || []) {
        expect(REGION_DEFINITIONS[regionId].parentRealmIds, `${province.id}:${regionId}`).toContain(province.realmId);
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
      expect(route.waypoints.length, route.id).toBeGreaterThanOrEqual(12);
      expect(route.waypoints.length, route.id).toBeLessThanOrEqual(20);
      expect(route.waypoints.every(hasFiniteCoord), route.id).toBe(true);
      expect(Array.isArray(route.checkpointIds), route.id).toBe(true);
      if (route.kind === "regional-road") {
        expect(route.width, route.id).toBe(1.2);
      } else {
        expect(route.kind, `${route.id} must retain the implicit great-road contract`).toBeUndefined();
        expect(route.width, route.id).toBe(1.9);
      }
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

  it("curves the four signature roads around water, passes, and river valleys", () => {
    const routeById = new Map(CONTINENT_ROUTES.map((route) => [route.id, route]));
    const waterwayById = new Map(CONTINENT_WATERWAYS.map((waterway) => [waterway.id, waterway]));
    const lakeById = new Map(CONTINENT_LAKES.map((lake) => [lake.id, lake]));

    const crownRoad = routeById.get("crown-road-east");
    expect(Math.min(...crownRoad.waypoints.map((point) => distanceBetween(point, lakeById.get("mirror-lake").center))))
      .toBeLessThanOrEqual(8);

    const smokeRoadKeys = new Set(routeById.get("north-road").waypoints.map(coordKey));
    const sharedWhitewendValleyPoints = waterwayById.get("whitewend").waypoints
      .filter((point) => smokeRoadKeys.has(coordKey(point)));
    expect(sharedWhitewendValleyPoints).toHaveLength(0);
    for (const riverPoint of waterwayById.get("whitewend").waypoints.filter((point) => point.y <= -24)) {
      const nearestRoadDistance = Math.min(...routeById.get("north-road").waypoints
        .map((roadPoint) => distanceBetween(roadPoint, riverPoint)));
      expect(nearestRoadDistance).toBeGreaterThanOrEqual(6);
      expect(nearestRoadDistance).toBeLessThanOrEqual(16);
    }

    const saltRoad = routeById.get("south-road");
    expect(Math.min(...saltRoad.waypoints.map((point) => distanceBetween(point, lakeById.get("heronmere").center))))
      .toBeLessThanOrEqual(21);
    expect(Math.min(...saltRoad.waypoints.map((point) => distanceBetween(point, lakeById.get("moonwell").center))))
      .toBeLessThanOrEqual(7);

    const sheepway = routeById.get("spine-road");
    const northReedFinger = waterwayById.get("reed-fingers-north");
    expect(Math.min(...sheepway.waypoints.flatMap((roadPoint) =>
      northReedFinger.waypoints.map((riverPoint) => distanceBetween(roadPoint, riverPoint)))))
      .toBeLessThanOrEqual(13);
  });

  it("authors ten source-to-mouth rivers, twelve lakes, and the eastern hot springs", () => {
    expect(CONTINENT_WATERWAYS).toHaveLength(10);
    expect(CONTINENT_LAKES).toHaveLength(12);
    expect(CONTINENT_HOT_SPRINGS).toHaveLength(2);

    expect(new Set(CONTINENT_WATERWAYS.map((waterway) => waterway.id)).size).toBe(10);
    for (const waterway of CONTINENT_WATERWAYS) {
      expect(waterway.waypoints.length, waterway.id).toBeGreaterThanOrEqual(4);
      expect(waterway.waypoints.every(hasFiniteCoord), waterway.id).toBe(true);
      expect(waterway.widthStart, waterway.id).toBe(1.4);
      expect(waterway.widthEnd, waterway.id).toBe(2.6);
      expect(waterway.widthEnd, waterway.id).toBeGreaterThan(waterway.widthStart);
    }

    const lakeNames = new Set(CONTINENT_LAKES.map((lake) => lake.name));
    for (const name of [
      "Frostmirror", "Ashpool", "Heronmere", "Tannic Sump", "Greenwater",
      "Lotuspool", "Jadepond", "Shimmer Flats", "Moonwell", "Oasis al-Thar",
    ]) {
      expect(lakeNames, name).toContain(name);
    }
    for (const lake of CONTINENT_LAKES) {
      expect(hasFiniteCoord(lake.center), lake.id).toBe(true);
      expect(lake.radius, lake.id).toBeGreaterThan(0);
    }

    expect(CONTINENT_HOT_SPRINGS.map((spring) => spring.name))
      .toEqual(["Jade Springs", "Misty Caldron"]);
    for (const spring of CONTINENT_HOT_SPRINGS) {
      expect(hasFiniteCoord(spring.center), spring.id).toBe(true);
      expect(spring.center.x, spring.id).toBeGreaterThan(300);
      expect(spring.radius, spring.id).toBeGreaterThan(0);
    }
  });

  it("defines two lower Frostcrown ridges feeding the new northern rivers", () => {
    expect(NORTHERN_RIDGES).toHaveLength(2);
    expect(NORTHERN_RIDGES.map((ridge) => ridge.id))
      .toEqual(["glasswater-ridge", "iceflow-ridge"]);
    for (const ridge of NORTHERN_RIDGES) {
      expect(ridge.elevationBoost, ridge.id).toBe(0.18);
      expect(ridge.width, ridge.id).toBeGreaterThan(0);
      expect(ridge.waypoints.length, ridge.id).toBeGreaterThanOrEqual(4);
      expect(ridge.waypoints.every(hasFiniteCoord), ridge.id).toBe(true);
      expect(ridge.waypoints.every((point) => point.y <= -220), ridge.id).toBe(true);
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

  it("keeps rare trade-house tiers in their canonical destination registry", () => {
    expect(RARE_TRADE_HOUSES["northstar-castle"])
      .toMatchObject({ id: "aurora-armoury", marketTier: "royal" });
    expect(RARE_TRADE_HOUSES["star-forge"])
      .toMatchObject({ id: "falling-star-forge", marketTier: "mastercraft" });
    expect(RARE_TRADE_HOUSES.whitemarch).toBeUndefined();
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

  it("binds every authored site motif to an archetype and keeps the catalog reachable", () => {
    const {
      SITE_MOTIFS, SITE_ARCHETYPES, REGION_DEFINITIONS, ECOLOGIES, CAMPAIGN_MINOR_SITE_FEATURES,
    } = ContinentData;
    const fallbackKinds = new Set(CAMPAIGN_MINOR_SITE_FEATURES.map((feature) => feature.kind));
    const named = new Set();
    for (const region of Object.values(REGION_DEFINITIONS)) {
      for (const slug of region.features || []) named.add(slug);
    }
    for (const ecology of Object.values(ECOLOGIES)) {
      for (const slug of ecology.features || []) named.add(slug);
    }

    // A motif nothing names is dead content; a named slug with no motif silently
    // falls back to generic sites. Both failure modes shipped once already.
    for (const [slug, motif] of Object.entries(SITE_MOTIFS)) {
      expect(SITE_ARCHETYPES[motif.family], slug).toBeTruthy();
      expect(named.has(slug), `${slug} is not named by any region or ecology`).toBe(true);
    }
    for (const slug of named) {
      expect(
        SITE_MOTIFS[slug] || fallbackKinds.has(slug),
        `${slug} is named but has no motif binding`,
      ).toBeTruthy();
    }
  });
});
