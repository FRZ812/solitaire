import { describe, expect, it } from "vitest";
import { DEFAULT_WORLD_SEED, WORLD_GENERATOR_VERSION } from "../data/continent.js";
import { findWorldRoute } from "./world.js";
import {
  DAY_MARCH_MINUTES,
  MIN_LEG_STEPS,
  TRAVEL_PACES,
  describePassage,
  legTooShort,
  planExpedition,
  planLeg,
  travelHaltSummary,
} from "./expedition.js";

// Far outside the handcrafted map, so a stored fixture tile is what `getTile`
// returns rather than an authored town or a named river.
const OX = 4000;
const OY = 4000;

function worldAt(x, y) {
  return {
    world: {
      seed: DEFAULT_WORLD_SEED,
      generatorVersion: WORLD_GENERATOR_VERSION,
      currentTile: { x, y },
      tiles: {},
      seen: {},
      quests: [],
    },
    character: { inventory: [] },
    time: { day: 1, minutes: 600 },
  };
}

// A straight run of `length` hexes, with `tileAt(index)` deciding the ground.
function straightPath(length, tileAt) {
  const path = [];
  const tiles = {};
  for (let i = 0; i < length; i++) {
    path.push({ x: OX + i, y: OY });
    tiles[`${OX + i},${OY}`] = tileAt(i);
  }
  const state = {
    world: {
      seed: 1,
      generatorVersion: WORLD_GENERATOR_VERSION,
      currentTile: { x: OX, y: OY },
      tiles,
      seen: {},
    },
  };
  return { state, path };
}

function named(name) {
  return {
    terrain: "plains",
    regionId: "r",
    poi: { type: "hidden", generated: { name, sighting: { range: 6, named: true, secret: false } } },
  };
}

const plain = { terrain: "plains", regionId: "r" };

describe("expedition legs", () => {
  it("ends a leg at a place travellers name rather than at a hex count", () => {
    const { state, path } = straightPath(12, (i) => (i === 7 ? named("Falford") : plain));

    const leg = planLeg(state, path, 0, { maxSteps: 48 });
    expect(leg.boundary.kind).toBe("waypoint");
    expect(leg.boundary.label).toBe("Falford");
    expect(leg.steps).toBe(7);
  });

  it("absorbs a boundary that falls inside the minimum leg length", () => {
    // Two named places: one too close to be a stage, one at a sensible distance.
    const { state, path } = straightPath(12, (i) => {
      if (i === 1) return named("Near Croft");
      if (i === 6) return named("Farhollow");
      return plain;
    });

    const leg = planLeg(state, path, 0, { maxSteps: 48 });
    expect(MIN_LEG_STEPS).toBe(3);
    expect(leg.boundary.label).toBe("Farhollow");
    expect(leg.steps).toBe(6);
  });

  it("measures a too-short leg by both step count and clock, since a hex is not one size", () => {
    // A city hex is a street corner: a couple of them is a stumble, not a stage.
    expect(legTooShort(1, 12, DAY_MARCH_MINUTES)).toBe(true);
    expect(legTooShort(2, 24, DAY_MARCH_MINUTES)).toBe(true);
    expect(legTooShort(MIN_LEG_STEPS, 36, DAY_MARCH_MINUTES)).toBe(false);

    // A continental hex is six kilometres and most of a morning. One of them is
    // already a stage, so boundaries out here are never absorbed by step count.
    expect(legTooShort(1, 144, DAY_MARCH_MINUTES)).toBe(false);
    expect(legTooShort(2, 288, DAY_MARCH_MINUTES)).toBe(false);
  });

  it("always cuts at the hard caps regardless of the minimum", () => {
    const { state, path } = straightPath(3, () => plain);

    const short = planLeg(state, path, 0, { maxSteps: 48 });
    expect(short.boundary.kind).toBe("destination");
    expect(short.arrived).toBe(true);
    expect(short.steps).toBe(2);

    const capped = planLeg(state, path, 0, { maxSteps: 1 });
    expect(capped.boundary.kind).toBe("limit");
    expect(capped.steps).toBe(1);
    expect(capped.arrived).toBe(false);
  });

  it("stops at a change of country and at a change of going", () => {
    const { state, path } = straightPath(14, (i) => {
      if (i >= 8) return { terrain: "plains", regionId: "east", area: { name: "Wind Vale" } };
      if (i >= 4) return { terrain: "mountains", regionId: "west" };
      return { terrain: "plains", regionId: "west" };
    });

    const first = planLeg(state, path, 0, { maxSteps: 48 });
    expect(first.boundary).toMatchObject({ kind: "going", label: "Mountains" });
    expect(first.end).toEqual({ x: OX + 4, y: OY });

    const second = planLeg(state, path, first.to, { maxSteps: 48 });
    expect(second.boundary).toMatchObject({ kind: "border", label: "Wind Vale" });
    expect(second.end).toEqual({ x: OX + 8, y: OY });
  });

  it("reports what the party went past, without repeating a kind", () => {
    const { state, path } = straightPath(6, (i) => ({
      terrain: "plains",
      regionId: "r",
      scenery: i === 3
        ? [{ kind: "field-shrine", label: "a field shrine", detail: "" }]
        : [{ kind: "hay-barn", label: "a hay barn", detail: "" }],
    }));

    const leg = planLeg(state, path, 0, { maxSteps: 48 });
    expect(leg.passed.map((entry) => entry.kind)).toEqual(["hay-barn", "field-shrine"]);
    expect(describePassage(leg)).toBe("a hay barn and a field shrine");
  });

  it("lets pace decide how long the party stays on its feet, not how fast it walks", () => {
    // Long enough that nightfall, not the destination, ends the leg.
    const { state, path } = straightPath(200, () => ({ terrain: "mountains", regionId: "r" }));

    const careful = planLeg(state, path, 0, { maxSteps: 999, pace: "careful" });
    const steady = planLeg(state, path, 0, { maxSteps: 999, pace: "steady" });
    const forced = planLeg(state, path, 0, { maxSteps: 999, pace: "forced" });

    for (const leg of [careful, steady, forced]) expect(leg.boundary.kind).toBe("nightfall");
    expect(careful.steps).toBeLessThan(steady.steps);
    expect(forced.steps).toBeGreaterThan(steady.steps);
    // Same ground costs the same time however it is walked.
    expect(steady.minutes / steady.steps).toBeCloseTo(careful.minutes / careful.steps, 5);
    expect(TRAVEL_PACES.forced.riskMult).toBeGreaterThan(TRAVEL_PACES.careful.riskMult);
  });

  it("plans a real continental route into staged legs that reach the destination", () => {
    const state = worldAt(-30, 10);
    const path = findWorldRoute(state, { x: -30, y: 10 }, { x: -18, y: 4 });
    expect(path.length).toBeGreaterThan(4);

    const plan = planExpedition(state, path, { maxSteps: 48, maxLegs: 6 });
    expect(plan.legs.length).toBeGreaterThan(0);
    expect(plan.totalSteps).toBe(path.length - 1);
    // Legs are contiguous and never overlap or skip ground.
    let cursor = 0;
    for (const leg of plan.legs) {
      expect(leg.from).toBe(cursor);
      expect(leg.to).toBeGreaterThan(leg.from);
      cursor = leg.to;
    }
    expect(plan.complete).toBe(true);
    expect(plan.legs[plan.legs.length - 1].end).toEqual({ x: -18, y: 4 });
  });
});

describe("halt summary", () => {
  const legAt = (kind, label) => ({
    path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
    boundary: { kind, label },
    passed: [{ kind: "bridge", label: "a plank bridge" }, { kind: "shrine", label: "a wayside shrine" }],
  });

  it("says why the leg ended and how much of the route is still ahead", () => {
    const leg = legAt("nightfall", "Camp in the plains");
    const halt = travelHaltSummary({
      leg,
      legPath: leg.path,
      fullPathLength: 9,
      arrived: false,
      where: "an open field",
      destination: "Falford",
      hexes: 2,
      minutes: 240,
      intendedDest: { x: 8, y: 0 },
    });

    expect(halt.reason).toMatch(/light goes/i);
    // 9 hexes of route, 3 of them walked (the start plus two steps).
    expect(halt.remaining).toBe(6);
    expect(halt.destination).toBe("Falford");
    expect(halt.passed).toEqual(["a plank bridge", "a wayside shrine"]);
  });

  it("drops the destination and the remaining distance once the party arrives", () => {
    const leg = legAt("destination", "Falford");
    const halt = travelHaltSummary({
      leg,
      legPath: leg.path,
      fullPathLength: 3,
      arrived: true,
      where: "Falford",
      destination: "Falford",
      hexes: 2,
      minutes: 90,
      intendedDest: { x: 2, y: 0 },
    });

    expect(halt.arrived).toBe(true);
    expect(halt.reason).toBe("");
    expect(halt.remaining).toBe(0);
    expect(halt.destination).toBeNull();
    expect(halt.intendedDest).toBeNull();
  });

  it("claims no scenery from ground an encounter kept the party from walking", () => {
    const leg = legAt("waypoint", "Falford");
    const halt = travelHaltSummary({
      leg,
      // The encounter halted them one hex into a three-hex leg.
      legPath: leg.path.slice(0, 2),
      fullPathLength: 9,
      arrived: false,
      where: "a stand of birches",
      destination: "Falford",
      hexes: 1,
      minutes: 60,
      encounter: { kind: "road-bandits", posture: "hostile" },
    });

    expect(halt.passed).toEqual([]);
    expect(halt.boundaryKind).toBe("encounter");
    expect(halt.reason).toMatch(/stops the party/i);
    expect(halt.posture).toBe("hostile");
  });
});
