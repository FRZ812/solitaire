import { describe, expect, it } from "vitest";
import { statusTypes } from "../../gameplay/kernel/status-stack.js";
import { towStatusPresentation } from "./tow-combat-status.js";

describe("combat status presentation", () => {
  it("explains the original Initiative conversion instead of showing a bare count", () => {
    expect(towStatusPresentation({ type: "initiative", count: 37 })).toMatchObject({
      name: "Initiative",
      countLabel: "37 stacks",
      tone: "boon",
      effect: expect.stringContaining("100 Initiative converts into 1 Priority"),
    });
  });

  it("describes observed stack lifecycles in player-facing language", () => {
    expect(towStatusPresentation({ type: "protection", count: 4 }).lifecycle)
      .toBe("Persists between turns; loses 1 stack when hit.");
    expect(towStatusPresentation({ type: "overload", count: 8 }).lifecycle)
      .toBe("Removed at the end of the turn.");
  });

  it("states exact control, Priority, and Vulnerable strategy rules", () => {
    expect(towStatusPresentation({ type: "stun", count: 1 })).toMatchObject({
      effect: expect.stringContaining("forfeits one command window per stack"),
      lifecycle: expect.stringContaining("only when it automatically forfeits"),
    });
    expect(towStatusPresentation({ type: "sleep", count: 3 }).lifecycle)
      .toContain("any landed hit removes the entire stack");
    expect(towStatusPresentation({ type: "priority", count: 4 })).toMatchObject({
      effect: expect.stringContaining("Each net stack grants one extra action"),
      lifecycle: expect.stringContaining("spent by each extra action"),
    });
    expect(towStatusPresentation({ type: "vulnerable", count: 12 }).effect)
      .toContain("50%");
    expect(towStatusPresentation({ type: "lethargy-atk", count: 5 }).effect)
      .toContain("every landed hit");
    expect(towStatusPresentation({ type: "berserk", count: 100 }).lifecycle)
      .toContain("entire stack is spent");
  });

  it("gives every kernel status readable copy, raster VFX, and dedicated generated icon cells", () => {
    const icons = [];
    for (const type of statusTypes()) {
      const detail = towStatusPresentation({ type, count: 1 });
      expect(detail.name.length, type).toBeGreaterThan(0);
      expect(detail.effect.length, type).toBeGreaterThan(20);
      expect(detail.lifecycle.length, type).toBeGreaterThan(10);
      expect(detail.visual.asset, type).toMatch(/\.png$/);
      expect(detail.visual.iconAsset, type).toMatch(/\.png$/);
      expect(detail.visual.iconPosition, type).toMatch(/^(?:0|100)% (?:0|100)%$/);
      expect(detail.visual.asset, type).not.toContain("svg");
      icons.push(`${detail.visual.iconAsset}#${detail.visual.iconPosition}`);
    }
    expect(new Set(icons).size).toBe(icons.length);
  });
});
