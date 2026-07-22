import { describe, expect, it } from "vitest";
import { pinchDistance, pinchZoomFactor } from "./mapGestures.js";

describe("travel map pointer gestures", () => {
  it("measures the distance between two active pointers", () => {
    expect(pinchDistance([{ x: 10, y: 20 }, { x: 40, y: 60 }])).toBe(50);
    expect(pinchDistance([{ x: 10, y: 20 }])).toBeNull();
  });

  it("converts expanding and contracting pinches into incremental zoom factors", () => {
    expect(pinchZoomFactor(100, 120)).toBeCloseTo(1.2);
    expect(pinchZoomFactor(100, 84)).toBeCloseTo(0.84);
  });

  it("clamps noisy jumps and ignores invalid distances", () => {
    expect(pinchZoomFactor(100, 300)).toBe(1.25);
    expect(pinchZoomFactor(100, 10)).toBe(0.8);
    expect(pinchZoomFactor(0, 100)).toBe(1);
    expect(pinchZoomFactor(100, Number.NaN)).toBe(1);
  });
});
