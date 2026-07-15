import { describe, expect, it } from "vitest";
import { DEFAULT_NARRATOR_MODEL, NARRATOR_MODELS } from "./narrator-models.js";

describe("OpenRouter narrator registry", () => {
  it("uses fully qualified OpenRouter model ids", () => {
    for (const model of NARRATOR_MODELS) expect(model.id).toMatch(/^[^/]+\/.+$/);
  });

  it("offers the configured models in picker order", () => {
    expect(NARRATOR_MODELS.map((model) => model.id)).toEqual([
      "deepseek/deepseek-v4-flash",
      "deepseek/deepseek-v4-pro",
      "z-ai/glm-5.2",
      "openai/gpt-5.6-luna",
      "google/gemini-3.1-pro-preview",
    ]);
  });

  it("defaults to a selectable OpenRouter model", () => {
    expect(NARRATOR_MODELS.some((model) => model.id === DEFAULT_NARRATOR_MODEL)).toBe(true);
  });
});
