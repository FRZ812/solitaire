import { describe, expect, it } from "vitest";
import {
  attrDescriptor,
  attributeLadder,
  attributeThresholdMods,
  mechanicalAttributeValue,
} from "./attribute-tiers.js";

const ATTR_KEYS = ["body", "reflex", "vigor", "mind", "wit", "presence"];

describe("expanded attribute mechanics", () => {
  it("preserves scores through 30 and diminishes the 31-90 combat range", () => {
    expect(mechanicalAttributeValue(0)).toBe(0);
    expect(mechanicalAttributeValue(12)).toBe(12);
    expect(mechanicalAttributeValue(30)).toBe(30);
    expect(mechanicalAttributeValue(45)).toBeCloseTo(38.5714, 4);
    expect(mechanicalAttributeValue(60)).toBe(42);
    expect(mechanicalAttributeValue(75)).toBeCloseTo(43.8462, 4);
    expect(mechanicalAttributeValue(90)).toBe(45);
    expect(mechanicalAttributeValue(900)).toBe(45); // raw values clamp at the authored cap
    expect(mechanicalAttributeValue(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("keeps the apex monotonic, finite, and mechanically bounded", () => {
    const values = [0, 5, 10, 20, 30, 45, 60, 75, 90].map(mechanicalAttributeValue);
    expect(values.every(Number.isFinite)).toBe(true);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]);
    expect(values.at(-1)).toBeLessThanOrEqual(45);
  });

  it("exposes authored epic through divine descriptors and unlocks", () => {
    expect(attrDescriptor("body", 45)).toBe("epic");
    expect(attrDescriptor("mind", 75)).toBe("mythical");
    expect(attrDescriptor("presence", 90)).toBe("divine");
    for (const key of ATTR_KEYS) {
      const apexSteps = attributeLadder(key, 90).filter((step) => step.at >= 45);
      expect(apexSteps.map((step) => step.at)).toEqual([45, 60, 75, 90]);
      expect(apexSteps.every((step) => step.reached && step.text)).toBe(true);
    }
  });

  it("bounds old quadratic smooth bonuses while retaining an apex advantage", () => {
    const oldCap = attributeThresholdMods({ body: 30 }).statMods.damageMult;
    const apex = attributeThresholdMods({ body: 90 }).statMods.damageMult;
    expect(apex).toBeGreaterThan(oldCap);
    expect(apex).toBeLessThan(oldCap * 3);
    expect(attributeThresholdMods({ vigor: 90 }).triggers.reviveOnce).toBe(0.2);
  });

  it("reserves former apex powers for mythical or divine scores", () => {
    const mortal = attributeThresholdMods({ body: 30, reflex: 30, mind: 30, wit: 30, presence: 30 });
    const divine = attributeThresholdMods({ body: 90, reflex: 90, mind: 90, wit: 90, presence: 90 });

    expect(mortal.statMods.execute).toBeUndefined();
    expect(mortal.statMods.phaseChance).toBeUndefined();
    expect(mortal.statMods.spellSurge).toBeUndefined();
    expect(mortal.statMods.abilityCrit).toBeUndefined();
    expect(mortal.triggers.lastStand).toBeUndefined();
    expect(divine.statMods).toMatchObject({ execute: 0.2, phaseChance: 0.25, spellSurge: 1, abilityCrit: 1 });
    expect(divine.triggers.lastStand).toBe(1);
  });
});
