import { describe, expect, it } from "vitest";
import { pinStoryToBottom, storyDistanceFromBottom, storyShouldFollow } from "./storyScroll.js";

describe("story stream scrolling", () => {
  it("follows output only while the reader is near the bottom", () => {
    expect(storyShouldFollow({ scrollHeight: 1000, clientHeight: 400, scrollTop: 600 })).toBe(true);
    expect(storyShouldFollow({ scrollHeight: 1000, clientHeight: 400, scrollTop: 540 })).toBe(true);
    expect(storyShouldFollow({ scrollHeight: 1000, clientHeight: 400, scrollTop: 300 })).toBe(false);
  });

  it("handles browser overscroll without reporting a negative distance", () => {
    expect(storyDistanceFromBottom({ scrollHeight: 800, clientHeight: 400, scrollTop: 430 })).toBe(0);
  });

  it("pins explicitly when the reader asks for the latest output", () => {
    const element = { scrollHeight: 1200, clientHeight: 400, scrollTop: 120 };
    pinStoryToBottom(element);
    expect(element.scrollTop).toBe(1200);
  });
});
