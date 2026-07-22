import { describe, expect, it } from "vitest";
import { dragPreviewOffset, pinchDistance, pinchZoomFactor } from "./mapGestures.js";

describe("travel map pointer gestures", () => {
  it("maps pointer movement one-to-one into a live map preview", () => {
    expect(dragPreviewOffset({ x: 120, y: 80 }, { x: 173, y: 41 })).toEqual({ x: 53, y: -39 });
    expect(dragPreviewOffset(null, { x: 10, y: 20 })).toEqual({ x: 0, y: 0 });
  });

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
