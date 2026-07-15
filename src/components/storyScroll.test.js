import { describe, expect, it } from "vitest";
import { pinStoryToBottom, storyDistanceFromBottom, storyIsAtBottom, touchRequestsOlder, wheelRequestsOlder } from "./storyScroll.js";

describe("story stream scrolling", () => {
  it("detects wheel and touch gestures toward older output without a dead zone", () => {
    expect(wheelRequestsOlder(-1)).toBe(true);
    expect(wheelRequestsOlder(1)).toBe(false);
    expect(touchRequestsOlder(100, 101)).toBe(true);
    expect(touchRequestsOlder(101, 100)).toBe(false);
  });

  it("handles browser overscroll without reporting a negative distance", () => {
    expect(storyDistanceFromBottom({ scrollHeight: 800, clientHeight: 400, scrollTop: 430 })).toBe(0);
  });

  it("recognizes the bottom independently of the follow lock", () => {
    expect(storyIsAtBottom({ scrollHeight: 800, clientHeight: 400, scrollTop: 400 })).toBe(true);
    expect(storyIsAtBottom({ scrollHeight: 800, clientHeight: 400, scrollTop: 398 })).toBe(false);
  });

  it("pins explicitly when the reader asks for the latest output", () => {
    const element = { scrollHeight: 1200, clientHeight: 400, scrollTop: 120 };
    expect(pinStoryToBottom(element)).toBe(1200);
    expect(element.scrollTop).toBe(1200);
  });
});
