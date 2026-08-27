import { describe, it, expect } from "vitest";
import {
  BASE_VITALITY, HP_PER_VIGOR, vigorHealthBonus, maxVitalityFor,
  recomputeVitalityMax, BASE_RESOLVE, BASE_RESOLVE_REGEN, resolvePoolForMind,
  resolveRegenForAttributes, recomputeResolveMax,
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

  it("keeps the expanded apex finite and below three old-cap vitality pools", () => {
    const oldCap = maxVitalityFor({ attributes: ATTRS({ vigor: 30 }) });
    const apex = maxVitalityFor({ attributes: ATTRS({ vigor: 90 }) });
    expect(apex).toBe(2810);
    expect(apex).toBeGreaterThan(oldCap);
    expect(apex).toBeLessThanOrEqual(oldCap * 3);
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

  it("gives everyone baseline combat recovery and adds Presence milestones", () => {
    expect(BASE_RESOLVE_REGEN).toBe(1);
    expect(resolveRegenForAttributes(ATTRS({ presence: 4 }))).toBe(1);
    expect(resolveRegenForAttributes(ATTRS({ presence: 5 }))).toBe(2);
    expect(resolveRegenForAttributes(ATTRS({ presence: 15 }))).toBe(3);
  });

  it("carryCapacityFor applies carryBonus additively", () => {
    expect(BASE_CARRY).toBe(40);
    const base = carryCapacityFor({ attributes: ATTRS({ body: 4, vigor: 2 }) });
    const buffed = carryCapacityFor({ attributes: ATTRS({ body: 4, vigor: 2 }), carryBonus: 50 });
    expect(buffed - base).toBe(50);
  });

  it("diminishes resolve and carrying growth above 30 without flattening it", () => {
    const resolve30 = resolvePoolForMind(30);
    const resolve90 = resolvePoolForMind(90);
    expect(resolve90).toBe(212);
    expect(resolve90).toBeGreaterThan(resolve30);
    expect(resolve90).toBeLessThanOrEqual(resolve30 * 3);

    const carry30 = carryCapacityFor({ attributes: ATTRS({ body: 30, vigor: 30 }) });
    const carry90 = carryCapacityFor({ attributes: ATTRS({ body: 90, vigor: 90 }) });
    expect(carry90).toBe(1624);
    expect(carry90).toBeGreaterThan(carry30);
    expect(carry90).toBeLessThanOrEqual(carry30 * 3);
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

  it("grows past the old cap and clamps cleanly at the expanded cap", () => {
    expect(applyAttributeChanges(ATTRS({ body: 28 }), { body: 1 }).next.body).toBe(29);
    expect(applyAttributeChanges(ATTRS({ body: 90 }), { body: 1 }).next.body).toBe(90);
  });
});
