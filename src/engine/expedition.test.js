import { describe, expect, it } from "vitest";
import { DEFAULT_WORLD_SEED, WORLD_GENERATOR_VERSION } from "../data/continent.js";
import { findWorldRoute } from "./world.js";
import {
  DAY_MARCH_MINUTES,
  describeLegStop,
  describePassage,
  legCamps,
  openLarder,
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
  it("walks past a place travellers name instead of halting the party there", () => {
    const { state, path } = straightPath(12, (i) => (i === 7 ? named("Falford") : plain));

    const leg = planLeg(state, path, 0, { maxSteps: 48 });
    expect(leg.boundary.kind).toBe("destination");
    expect(leg.steps).toBe(11);
    // Falford is something the party went past and can mention, not a reason to stop.
    expect(leg.passed).toContainEqual({ kind: "waypoint", label: "Falford" });
  });

  it("always cuts at the hard caps", () => {
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

  it("notes a change of country and a change of going without stopping for either", () => {
    const { state, path } = straightPath(14, (i) => {
      if (i >= 8) return { terrain: "plains", regionId: "east", area: { name: "Wind Vale" } };
      if (i >= 4) return { terrain: "mountains", regionId: "west" };
      return { terrain: "plains", regionId: "west" };
    });

    const leg = planLeg(state, path, 0, { maxSteps: 48 });
    expect(leg.boundary.kind).toBe("destination");
    expect(leg.end).toEqual({ x: OX + 13, y: OY });
    expect(leg.passed).toContainEqual({ kind: "going", label: "Mountains" });
    expect(leg.passed).toContainEqual({ kind: "border", label: "Wind Vale" });
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

  it("counts a night for every marching day the leg spans", () => {
    // Days of mountain ground, so the march is camped through several times.
    const { state, path } = straightPath(200, () => ({ terrain: "mountains", regionId: "r" }));
    // Provisioned well enough that the ground, not the packs, decides the leg.
    state.character = { needs: { hunger: 100, thirst: 100, sleep: 100 }, inventory: { carried: [] } };

    const leg = planLeg(state, path, 0, { maxSteps: 999 });
    expect(leg.nights).toBe(Math.max(0, Math.ceil(leg.minutes / DAY_MARCH_MINUTES) - 1));
    expect(leg.nights).toBeGreaterThan(0);
  });

  it("halts a long march on the party's own strength, not on a clock", () => {
    // Nothing is eaten, drunk or slept back on the road, so a march long enough
    // runs somebody out of something. That is the only thing bounding a leg.
    const { state, path } = straightPath(400, () => ({ terrain: "mountains", regionId: "r" }));
    state.character = { needs: { hunger: 100, thirst: 100, sleep: 100 }, inventory: { carried: [] } };

    const leg = planLeg(state, path, 0, { maxSteps: 999 });
    expect(leg.boundary.kind).toBe("supplies");
    expect(leg.arrived).toBe(false);
  });

  it("marches a hardier party further before anything gives out", () => {
    // "Enduring" slows hunger, thirst and fatigue. Since the leg ends when one of
    // the three gives out, that boon buys ground rather than a bigger number on a
    // sheet — the whole of what the retired pace control was reaching for.
    const ground = () => straightPath(400, () => ({ terrain: "mountains", regionId: "r" }));
    const green = ground();
    green.state.character = { needs: { hunger: 100, thirst: 100, sleep: 100 }, inventory: { carried: [] } };
    const seasoned = ground();
    seasoned.state.character = { needs: { hunger: 100, thirst: 100, sleep: 100 }, inventory: { carried: [] } };

    const greenLeg = planLeg(green.state, green.path, 0, { maxSteps: 999 });
    const seasonedLeg = planLeg(seasoned.state, seasoned.path, 0, {
      maxSteps: 999,
      larder: { ...openLarder(seasoned.state), decayMult: 0.5 },
    });
    expect(seasonedLeg.steps).toBeGreaterThan(greenLeg.steps);
  });

  it("ends a leg when the party has nothing left to walk on", () => {
    // Sleep is never given back by travelling, so it runs out like anything else
    // in the packs — and when it does, the leg is over and the halt is where the
    // player gets to decide to lie down.
    const { state, path } = straightPath(200, () => ({ terrain: "mountains", regionId: "r" }));
    state.character = { needs: { hunger: 100, thirst: 100, sleep: 12 }, inventory: { carried: [] } };

    const leg = planLeg(state, path, 0, { maxSteps: 999 });
    expect(leg.boundary).toMatchObject({ kind: "supplies", need: "sleep" });
    expect(leg.arrived).toBe(false);
    expect(describeLegStop(leg)).toContain("days on the road");
  });

  it("stops for real when the packs run dry", () => {
    // A mountain hex is half an hour, so hunger falls a point per hex walked.
    const { state, path } = straightPath(30, () => ({ terrain: "mountains", regionId: "r" }));
    state.character = { needs: { hunger: 14, thirst: 100, sleep: 100 }, inventory: { carried: [] } };

    const leg = planLeg(state, path, 0, { maxSteps: 999 });
    expect(leg.boundary).toMatchObject({ kind: "supplies", need: "hunger" });
    expect(leg.steps).toBe(4);
    expect(leg.arrived).toBe(false);
  });

  it("does not halt a party that set out hungry over the same empty pack", () => {
    // Crossing into Starving is the interruption. Already being there is a choice
    // the player made, and stopping them for it every hex is the tedium we removed.
    // Inside a single marching day, so hunger is the only thing under test.
    const { state, path } = straightPath(15, () => ({ terrain: "mountains", regionId: "r" }));
    state.character = { needs: { hunger: 4, thirst: 100, sleep: 100 }, inventory: { carried: [] } };

    const leg = planLeg(state, path, 0, { maxSteps: 999 });
    expect(leg.boundary.kind).toBe("destination");
    expect(leg.arrived).toBe(true);
  });

  it("carries one pack across the legs of an expedition instead of restocking each time", () => {
    const { state, path } = straightPath(30, () => ({ terrain: "mountains", regionId: "r" }));
    state.character = { needs: { hunger: 14, thirst: 100, sleep: 100 }, inventory: { carried: [] } };

    // Capped legs, so the supplies boundary has to survive a leg change to fire.
    const plan = planExpedition(state, path, { maxSteps: 2, maxLegs: 4 });
    expect(plan.legs[0].boundary.kind).toBe("limit");
    expect(plan.legs[1].boundary).toMatchObject({ kind: "supplies", need: "hunger" });
  });

  it("counts the nights a march is camped through and gives nothing back for them", () => {
    expect(legCamps(DAY_MARCH_MINUTES)).toMatchObject({ nights: 0, restMinutes: 0, elapsedMinutes: 480 });
    // One minute past a day's march is a second day, so one night in between.
    expect(legCamps(DAY_MARCH_MINUTES + 1)).toMatchObject({ nights: 1, elapsedMinutes: 1441 });
    expect(legCamps(DAY_MARCH_MINUTES * 3).nights).toBe(2);
    expect(legCamps(0)).toMatchObject({ nights: 0, elapsedMinutes: 0 });
    // A night passed on the road is a night passed, not a night slept. Anything
    // handed back here would make rest a refund instead of a decision.
    for (const march of [0, DAY_MARCH_MINUTES + 1, DAY_MARCH_MINUTES * 5]) {
      expect(legCamps(march).sleepGain).toBeUndefined();
    }
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
    const leg = legAt("limit", "Plains");
    const halt = travelHaltSummary({
      leg,
      legPath: leg.path,
      fullPathLength: 9,
      arrived: false,
      where: "an open field",
      destination: "Falford",
      hexes: 2,
      minutes: 240,
      nights: 2,
      intendedDest: { x: 8, y: 0 },
    });

    expect(halt.reason).toMatch(/as far as one march/i);
    // 9 hexes of route, 3 of them walked (the start plus two steps).
    expect(halt.remaining).toBe(6);
    expect(halt.destination).toBe("Falford");
    expect(halt.nights).toBe(2);
    expect(halt.passed).toEqual(["a plank bridge", "a wayside shrine"]);
  });

  it("names the need that gave out when the packs ended the march", () => {
    const leg = { ...legAt("supplies", "Water"), boundary: { kind: "supplies", need: "thirst", label: "Water" } };
    const halt = travelHaltSummary({
      leg, legPath: leg.path, fullPathLength: 9, arrived: false, where: "a dry ridge", hexes: 2, minutes: 240,
    });

    expect(halt.boundaryKind).toBe("supplies");
    expect(halt.reason).toMatch(/waterskins are empty/i);
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
    const leg = legAt("limit", "Plains");
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

  it("reports the near misses, which on a quiet leg are the whole of what happened", () => {
    const leg = legAt("destination", "Falford");
    const halt = travelHaltSummary({
      leg,
      legPath: leg.path,
      fullPathLength: 3,
      arrived: true,
      where: "Falford",
      hexes: 2,
      minutes: 90,
      met: [
        { encounter: { kind: "hunter", posture: "friendly" }, outcome: "passed" },
        { encounter: { kind: "wolves", posture: "hostile" }, outcome: "evaded" },
        { encounter: null, outcome: "passed" },
      ],
    });

    expect(halt.met).toEqual([
      { kind: "hunter", outcome: "passed" },
      { kind: "wolves", outcome: "evaded" },
    ]);
  });

  it("reports nothing met when the leg met nothing", () => {
    const leg = legAt("destination", "Falford");
    const quiet = travelHaltSummary({ leg, legPath: leg.path, fullPathLength: 3, arrived: true, where: "Falford", hexes: 2, minutes: 90 });
    expect(quiet.met).toEqual([]);
  });
});
