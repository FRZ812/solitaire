import { describe, it, expect } from "vitest";
import {
  NEEDS_DRAIN, getNeedConditions, depleteNeeds, applyNeedsChanges, mergeConditions,
} from "./needs.js";
import { tickConditions, normalizeConditions, condNames } from "../data/conditions.js";

describe("getNeedConditions thresholds", () => {
  it("maps hunger/thirst/sleep to the right tier at the boundaries", () => {
    expect(getNeedConditions({ hunger: 31, thirst: 100, sleep: 100 })).toEqual([]);
    expect(getNeedConditions({ hunger: 30, thirst: 100, sleep: 100 })).toEqual(["Hungry"]);
    expect(getNeedConditions({ hunger: 10, thirst: 100, sleep: 100 })).toEqual(["Starving"]);
    expect(getNeedConditions({ hunger: 5, thirst: 8, sleep: 9 })).toEqual(["Starving", "Parched", "Exhausted"]);
    expect(getNeedConditions({ hunger: 25, thirst: 25, sleep: 25 })).toEqual(["Hungry", "Thirsty", "Tired"]);
  });
});

describe("depleteNeeds / applyNeedsChanges", () => {
  it("drains by NEEDS_DRAIN × hours, clamped to 0", () => {
    expect(NEEDS_DRAIN).toEqual({ hunger: 2, thirst: 3, sleep: 2.5 });
    const r = depleteNeeds({ hunger: 100, thirst: 100, sleep: 100 }, 60); // 1 hour
    expect(r).toEqual({ hunger: 98, thirst: 97, sleep: 97.5 });
    const floored = depleteNeeds({ hunger: 1, thirst: 1, sleep: 1 }, 6000);
    expect(floored).toEqual({ hunger: 0, thirst: 0, sleep: 0 });
  });

  it("decayMult < 1 slows the drain", () => {
    const slow = depleteNeeds({ hunger: 100, thirst: 100, sleep: 100 }, 60, 0.5);
    expect(slow.hunger).toBe(99); // 2 × 0.5
  });

  it("applyNeedsChanges adds and clamps to [0,100]", () => {
    expect(applyNeedsChanges({ hunger: 50, thirst: 50, sleep: 50 }, { hunger: 60 }).hunger).toBe(100);
    expect(applyNeedsChanges({ hunger: 50, thirst: 50, sleep: 50 }, { hunger: -60 }).hunger).toBe(0);
    expect(applyNeedsChanges({ hunger: 50, thirst: 50, sleep: 50 }, null)).toEqual({ hunger: 50, thirst: 50, sleep: 50 });
  });
});

describe("mergeConditions", () => {
  it("keeps prior indefinite wounds when the narrator list is null", () => {
    const out = mergeConditions(null, [], [{ name: "Bleeding", remaining: null }]);
    expect(condNames(out)).toContain("Bleeding");
  });

  it("always derives need conditions and de-dupes them from prior", () => {
    const out = mergeConditions(null, ["Hungry"], [{ name: "Hungry", remaining: null }, { name: "Bleeding", remaining: null }]);
    const names = condNames(out);
    expect(names).toContain("Bleeding");
    expect(names.filter((n) => n === "Hungry")).toHaveLength(1); // need comes from needsConditions, not duplicated
  });

  it("a non-null narrator list replaces prior indefinite wounds", () => {
    const out = mergeConditions(["Infected"], [], [{ name: "Bleeding", remaining: null }]);
    const names = condNames(out);
    expect(names).toContain("Infected");
    expect(names).not.toContain("Bleeding"); // replaced
  });
});

// conditions.js tick/normalize are core to applyBeat's ordering — cover them here.
describe("tickConditions / normalizeConditions", () => {
  it("normalizes strings and objects to { name, remaining }", () => {
    expect(normalizeConditions(["Bleeding"])).toEqual([{ name: "Bleeding", remaining: null }]);
    expect(normalizeConditions([{ name: "Stunned", remaining: 2 }])).toEqual([{ name: "Stunned", remaining: 2 }]);
    expect(normalizeConditions(["Bleeding", "Bleeding"])).toHaveLength(1); // de-dupes
  });

  it("counts timed conditions down, drops the expired, leaves indefinite alone", () => {
    const a = tickConditions([{ name: "Stunned", remaining: 2 }], 1);
    expect(a.conditions).toEqual([{ name: "Stunned", remaining: 1 }]);
    expect(a.expired).toEqual([]);

    const b = tickConditions([{ name: "Stunned", remaining: 2 }], 3);
    expect(b.conditions).toEqual([]);
    expect(b.expired).toEqual(["Stunned"]);

    const c = tickConditions([{ name: "Bleeding", remaining: null }], 1000);
    expect(c.conditions).toEqual([{ name: "Bleeding", remaining: null }]); // indefinite untouched
  });
});
