import { describe, it, expect } from "vitest";
import {
  BASE_VITALITY, HP_PER_VIGOR, vigorHealthBonus, maxVitalityFor,
  recomputeVitalityMax, BASE_RESOLVE, resolvePoolForMind, recomputeResolveMax,
  BASE_CARRY, carryCapacityFor, recomputeCarryCapacity, applyAttributeChanges,
} from "./attributes.js";

const ATTRS = (over = {}) => ({ body: 4, reflex: 4, vigor: 4, mind: 4, wit: 4, presence: 4, ...over });

describe("vigor → vitality formula", () => {
  it("matches the documented back-loaded curve", () => {
    expect(BASE_VITALITY).toBe(20);
    expect(HP_PER_VIGOR).toBe(5);
    // round(v*5 + max(0, v*v-16)*0.95)
    expect(vigorHealthBonus(0)).toBe(0);
    expect(vigorHealthBonus(2)).toBe(10);  // 10 + max(0,-12)*.95 = 10
    expect(vigorHealthBonus(4)).toBe(20);  // 20 + max(0,0)*.95   = 20
    expect(vigorHealthBonus(30)).toBe(990); // 150 + 884*.95 = 989.8 → 990
  });

  it("maxVitalityFor adds the bonus to the base for a plain character", () => {
    expect(maxVitalityFor({ attributes: ATTRS({ vigor: 2 }) })).toBe(BASE_VITALITY + vigorHealthBonus(2));
    expect(maxVitalityFor({ attributes: ATTRS({ vigor: 30 }) })).toBe(1010);
  });
});

describe("recomputeVitalityMax (heal-by-delta, clamp)", () => {
  it("fills to max when starting empty", () => {
    const c = { attributes: ATTRS({ vigor: 4 }) };
    recomputeVitalityMax(c);
    expect(c.vitalityMax).toBe(maxVitalityFor(c));
    expect(c.vitality).toBe(c.vitalityMax);
  });

  it("a vigor gain heals by exactly the max delta, never overhealing", () => {
    const c = { attributes: ATTRS({ vigor: 4 }), vitalityMax: 30, vitality: 10 };
    recomputeVitalityMax(c);
    expect(c.vitality - 10).toBe(c.vitalityMax - 30); // healed by the delta
    expect(c.vitality).toBeLessThanOrEqual(c.vitalityMax);
  });

  it("a max drop clamps current vitality down", () => {
    const c = { attributes: ATTRS({ vigor: 1 }), vitalityMax: 1000, vitality: 1000 };
    recomputeVitalityMax(c);
    expect(c.vitality).toBe(c.vitalityMax);
  });
});

describe("mind → resolve & body → carry formulas", () => {
  it("resolvePoolForMind matches the curve", () => {
    expect(BASE_RESOLVE).toBe(6);
    expect(resolvePoolForMind(0)).toBe(6);                 // 6 + 0 + 0
    expect(resolvePoolForMind(4)).toBe(10);                // 6 + 4 + round(0)
    expect(resolvePoolForMind(30)).toBe(6 + 30 + 44);      // curve round(884*.05)=44 → 80
  });

  it("carryCapacityFor applies carryBonus additively", () => {
    expect(BASE_CARRY).toBe(40);
    const base = carryCapacityFor({ attributes: ATTRS({ body: 4, vigor: 2 }) });
    const buffed = carryCapacityFor({ attributes: ATTRS({ body: 4, vigor: 2 }), carryBonus: 50 });
    expect(buffed - base).toBe(50);
  });

  it("recomputeResolveMax / recomputeCarryCapacity store derived maxes", () => {
    const c = { attributes: ATTRS({ mind: 10, body: 10 }) };
    recomputeResolveMax(c);
    recomputeCarryCapacity(c);
    expect(c.resolveMax).toBeGreaterThan(BASE_RESOLVE);
    expect(c.carryCapacityMax).toBeGreaterThan(BASE_CARRY);
  });
});

describe("applyAttributeChanges", () => {
  it("applies a positive growth and reports the line", () => {
    const { next, growthLines } = applyAttributeChanges(ATTRS({ body: 5 }), { body: 2 });
    expect(next.body).toBe(7);
    expect(growthLines).toEqual(["Body 5 → 7"]);
  });

  it("clamps at 0 and ignores no-op / null changes", () => {
    expect(applyAttributeChanges(ATTRS({ body: 1 }), { body: -5 }).next.body).toBe(0);
    expect(applyAttributeChanges(ATTRS(), null)).toEqual({ next: ATTRS(), growthLines: [] });
    expect(applyAttributeChanges(ATTRS({ body: 5 }), { body: 0 }).growthLines).toEqual([]);
  });

  // KNOWN BUG (review finding, slated for the refactor's attribute-cap fix):
  // the in-play clamp is min(25,…) while creation allows up to 30, so a POSITIVE
  // grant to a stat already above 25 silently LOWERS it. Characterized here so
  // the fix (25 → 30) is a deliberate, visible change to this expectation.
  it("CURRENTLY caps in-play growth at 25, lowering an above-25 stat on a positive grant", () => {
    const { next } = applyAttributeChanges(ATTRS({ body: 28 }), { body: 1 });
    expect(next.body).toBe(25);
  });
});
