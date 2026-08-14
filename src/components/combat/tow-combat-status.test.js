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

  it("gives every kernel status readable copy and a transparent visual family", () => {
    for (const type of statusTypes()) {
      const detail = towStatusPresentation({ type, count: 1 });
      expect(detail.name.length, type).toBeGreaterThan(0);
      expect(detail.effect.length, type).toBeGreaterThan(20);
      expect(detail.lifecycle.length, type).toBeGreaterThan(10);
      expect(detail.visual.asset, type).toMatch(/^(?:data:image\/svg\+xml|.*\.svg(?:$|\?))/);
    }
  });
});
