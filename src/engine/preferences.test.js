import { describe, expect, it } from "vitest";
import {
  DEFAULT_STORY_FONT_SCALE,
  STORY_FONT_SCALES,
} from "./preferences.js";

describe("story text size preference", () => {
  it("defaults to Small and exposes the compact three-step range", () => {
    expect(DEFAULT_STORY_FONT_SCALE).toBe("sm");
    expect(STORY_FONT_SCALES.map((scale) => scale.id)).toEqual(["sm", "md", "lg"]);
  });
});
