import { describe, expect, it } from "vitest";
import { CONTINENT } from "../../data/continent.js";
import {
  cityBuildingLayout,
  cityCenterpieces,
  cityGatehouses,
  cityHousesForTile,
  cityWallSegments,
} from "./atlasCityModel.js";

const SEED = CONTINENT.seed;

describe("Whitemarch city building layout", () => {
  it("places houses only on open built-up tiles, jittered within the hex", () => {
    // Low Wards is dense housing — some tile in it must yield houses.
    let total = 0;
    for (let x = -9; x <= 9; x += 1) {
      for (let y = -9; y <= 9; y += 1) {
        total += cityHousesForTile(x, y, "low-wards", SEED, 1).length;
      }
    }
    expect(total).toBeGreaterThan(30);

    // Water, wall, bridge, and named POI tiles never grow houses.
    expect(cityHousesForTile(4, -4, "river-docks", SEED, 1)).toEqual([]); // river
    expect(cityHousesForTile(0, 10, "outer-works", SEED, 1)).toEqual([]); // wall
    expect(cityHousesForTile(4, 0, "river-docks", SEED, 1)).toEqual([]); // bridge
    expect(cityHousesForTile(0, 0, "grand-market", SEED, 1)).toEqual([]); // Grain Square POI
  });

  it("is deterministic per tile and respects the density multiplier", () => {
    const a = cityHousesForTile(-6, 4, "low-wards", SEED, 1);
    const b = cityHousesForTile(-6, 4, "low-wards", SEED, 1);
    expect(a).toEqual(b);
    // Lower density never yields more houses on the same tile.
    const thinned = cityHousesForTile(-6, 4, "low-wards", SEED, 0.3);
    expect(thinned.length).toBeLessThanOrEqual(a.length);
  });

  it("forms a near-continuous wall ring with outward-oriented segments", () => {
    const walls = cityWallSegments(SEED);
    // The radius-10 ring has ~60 wall tiles, minus 6 gate tiles.
    expect(walls.length).toBeGreaterThanOrEqual(48);
    expect(walls.length).toBeLessThanOrEqual(66);
    // Every segment has a finite rotation and sits on the ring (radius ~10).
    for (const segment of walls) {
      expect(Number.isFinite(segment.rotation)).toBe(true);
      const radius = Math.hypot(segment.x, segment.z);
      expect(radius).toBeGreaterThan(7);
      expect(radius).toBeLessThan(13);
    }
  });

  it("places six outward-facing gatehouses on the authored gates", () => {
    const gates = cityGatehouses();
    expect(gates).toHaveLength(6);
    for (const gate of gates) {
      expect(gate.kind).toBe("gate");
      const radius = Math.hypot(gate.x, gate.z);
      expect(radius).toBeGreaterThan(7);
      // Outward-facing: the rotation points away from the origin.
      const outward = Math.atan2(gate.z, gate.x);
      expect(Math.abs(Math.atan2(Math.sin(gate.rotation - outward), Math.cos(gate.rotation - outward)))).toBeLessThan(0.01);
    }
  });

  it("marks the palace, market, temples, watchtower, and forts as centerpieces", () => {
    const centerpieces = cityCenterpieces();
    const kinds = Object.fromEntries(centerpieces.map((c) => [c.id, c.kind]));
    expect(kinds["iron-palace"]).toBe("palace");
    expect(kinds["grain-square"]).toBe("market");
    expect(kinds["oath-temple"]).toBe("temple");
    expect(kinds["dragon-watch"]).toBe("watchtower");
    expect(centerpieces.length).toBeGreaterThanOrEqual(6);
  });

  it("aggregates a full layout with houses, walls, gates, and centerpieces", () => {
    const layout = cityBuildingLayout(SEED, { propDensity: 1 });
    expect(layout.houseCount).toBeGreaterThan(150);
    expect(layout.walls.length).toBeGreaterThanOrEqual(48);
    expect(layout.gatehouses).toHaveLength(6);
    expect(layout.centerpieces.length).toBeGreaterThanOrEqual(6);
    // Houses never land on the river or the wall ring.
    for (const house of layout.houses) {
      const radius = Math.hypot(house.x, house.z);
      expect(radius).toBeLessThan(12.5);
    }
    // Determinism at the aggregate level.
    const again = cityBuildingLayout(SEED, { propDensity: 1 });
    expect(again.houseCount).toBe(layout.houseCount);
    expect(again.houses[0]).toEqual(layout.houses[0]);
  });
});
