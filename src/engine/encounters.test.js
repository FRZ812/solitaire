import { afterEach, describe, expect, it, vi } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import {
  EVADE_CEIL,
  EVADE_FLOOR,
  MET_LIMIT,
  encounterHalts,
  evasionChance,
  pathThroughEncounter,
  rollPathEncounter,
} from "./encounters.js";

describe("pathThroughEncounter", () => {
  const route = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
  ];

  it("ends the presented and canonical route on the first encounter tile", () => {
    const encounter = {
      atIndex: 2,
      atTile: route[2],
      encounter: { kind: "brigands", posture: "hostile" },
    };

    const leg = pathThroughEncounter(route, encounter);

    expect(leg).toEqual(route.slice(0, 3));
    expect(leg.at(-1)).toEqual(encounter.atTile);
    expect(route).toHaveLength(4);
  });

  it("returns a defensive copy when there is no valid matching encounter", () => {
    const noEncounter = pathThroughEncounter(route, null);
    const staleIndex = pathThroughEncounter(route, { atIndex: route.length });
    const mismatchedTile = pathThroughEncounter(route, { atIndex: 2, atTile: { x: 99, y: 99 } });

    expect(noEncounter).toEqual(route);
    expect(noEncounter).not.toBe(route);
    expect(staleIndex).toEqual(route);
    expect(mismatchedTile).toEqual(route);
  });
});

const HERE = { x: 0, y: 0 };
const wolves = { kind: "wolves", posture: "hostile", desc: "a pack of wolves" };
const doe = { kind: "deer", posture: "neutral", desc: "a doe and her fawn" };
const hunter = { kind: "hunter", posture: "friendly", desc: "a lone hunter" };

function party({ lit = false, night = false, overburdened = false, weary = null } = {}) {
  const state = makeInitialState();
  state.time = { ...state.time, hour: night ? 1 : 12, minute: 0 };
  // Open ground rather than the capital, whose own lamps would answer the
  // light question before the clock got a chance to.
  state.world.currentTile = { x: 0, y: -40 };
  state.character.light = lit ? { minutes: 60, source: "torch" } : null;
  state.character.darkvision = false;
  state.character.overburdened = overburdened;
  state.character.conditions = weary ? [{ name: weary }] : [];
  return state;
}

afterEach(() => { vi.restoreAllMocks(); });

describe("what a march is actually stopped by", () => {
  it("lets the party walk past anything that is not hostile", () => {
    const state = party();
    // Deterministically the worst roll there is; posture is checked first, so it
    // never reaches one.
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    for (const encounter of [doe, hunter]) {
      expect(encounterHalts(state, encounter, HERE)).toEqual({ halts: false, outcome: "passed", chance: 0 });
    }
  });

  it("gives a hostile one roll to be slipped away from", () => {
    const state = party();
    const chance = evasionChance(state, HERE);
    expect(chance).toBeGreaterThan(EVADE_FLOOR);

    vi.spyOn(Math, "random").mockReturnValue((chance - 1) / 100);
    expect(encounterHalts(state, wolves, HERE)).toMatchObject({ halts: false, outcome: "evaded" });
    vi.spyOn(Math, "random").mockReturnValue((chance + 1) / 100);
    expect(encounterHalts(state, wolves, HERE)).toMatchObject({ halts: true, outcome: "blocked" });
  });

  it("reads the region rather than the party's level, because the world has no level scaling", () => {
    const state = party();
    const settled = evasionChance(state, { x: 15, y: 0 });
    const fabled = evasionChance(state, { x: 165, y: 165 });
    expect(settled).toBeGreaterThan(fabled);

    // Levelling up must not make the same ground safer to run from.
    const veteran = party();
    veteran.character.level = 40;
    expect(evasionChance(veteran, { x: 15, y: 0 })).toBe(settled);
  });

  it("pays out the light rules travel has never read", () => {
    const seen = evasionChance(party(), HERE);
    // light.js: unlit in the dark is "easier to slip past"; a flame "can't slip away".
    expect(evasionChance(party({ night: true }), HERE)).toBeGreaterThan(seen);
    expect(evasionChance(party({ night: true, lit: true }), HERE)).toBeLessThan(seen);
  });

  it("costs the party for every circumstance it chose", () => {
    const plain = evasionChance(party(), HERE);
    expect(evasionChance(party(), HERE, { pace: "careful" })).toBeGreaterThan(plain);
    expect(evasionChance(party(), HERE, { pace: "forced" })).toBeLessThan(plain);
    expect(evasionChance(party({ overburdened: true }), HERE)).toBeLessThan(plain);
    expect(evasionChance(party({ weary: "Exhausted" }), HERE))
      .toBeLessThan(evasionChance(party({ weary: "Tired" }), HERE));
  });

  it("never makes escape certain or impossible", () => {
    const best = evasionChance(party({ night: true }), { x: 15, y: 0 }, { pace: "careful" });
    const worst = evasionChance(
      party({ night: true, lit: true, overburdened: true, weary: "Exhausted" }),
      { x: 165, y: 165 },
      { pace: "forced" },
    );
    expect(best).toBe(EVADE_CEIL);
    expect(worst).toBe(EVADE_FLOOR);
  });
});

describe("walking a leg past what is on it", () => {
  const path = Array.from({ length: 30 }, (_, i) => ({ x: i, y: 0 }));

  it("collects what the party got by instead of stopping at the first thing", () => {
    const state = party();
    // Every hex rolls something, and every hostile is slipped: nothing halts.
    vi.spyOn(Math, "random").mockReturnValue(0);

    const { halt, met } = rollPathEncounter(state, path);
    expect(halt).toBeNull();
    expect(met.length).toBeGreaterThan(0);
    expect(met.every((hit) => hit.outcome === "passed" || hit.outcome === "evaded")).toBe(true);
    // A leg through the Wilds meets more than a brief can carry.
    expect(met.length).toBeLessThanOrEqual(MET_LIMIT);
  });

  it("ends the leg at the first hostile it cannot shake, and only there", () => {
    const state = party();
    // Every hex rolls; over enough legs some hostile is certain not to be shaken.
    const halts = [];
    for (let run = 0; run < 200; run += 1) {
      const { halt, met } = rollPathEncounter(state, path, 40);
      expect(met.some((hit) => hit.outcome === "blocked")).toBe(false);
      if (!halt) continue;
      halts.push(halt);
      expect(halt.outcome).toBe("blocked");
      expect(halt.encounter.posture).toBe("hostile");
      // Everything reported as met was met before the halt, so the leg the
      // player actually walks contains all of it.
      expect(met.every((hit) => hit.atIndex < halt.atIndex)).toBe(true);
      expect(pathThroughEncounter(path, halt).at(-1)).toEqual(halt.atTile);
    }
    expect(halts.length).toBeGreaterThan(0);
  });

  it("reports nothing rather than throwing on a route with nowhere to go", () => {
    expect(rollPathEncounter(party(), [])).toEqual({ halt: null, met: [] });
    expect(rollPathEncounter(party(), [{ x: 0, y: 0 }])).toEqual({ halt: null, met: [] });
  });
});
