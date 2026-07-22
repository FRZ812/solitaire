import { describe, expect, it } from "vitest";
import { DEFAULT_NARRATOR_MODEL, NARRATOR_MODELS } from "./narrator-models.js";

describe("OpenRouter narrator registry", () => {
  it("uses fully qualified OpenRouter model ids", () => {
    for (const model of NARRATOR_MODELS) expect(model.id).toMatch(/^[^/]+\/.+$/);
  });

  it("offers the configured models in picker order", () => {
    expect(NARRATOR_MODELS.map((model) => model.id)).toEqual([
      "poolside/laguna-s-2.1:free",
      "tencent/hy3:free",
      "deepseek/deepseek-v4-flash",
      "deepseek/deepseek-v4-pro",
      "minimax/minimax-m3",
      "z-ai/glm-5.2",
      "x-ai/grok-4.5",
      "moonshotai/kimi-k3",
    ]);
  });

  it("configures free models with their paid fallbacks", () => {
    expect(NARRATOR_MODELS.slice(0, 2).map((model) => [model.id, model.fallback])).toEqual([
      ["poolside/laguna-s-2.1:free", "poolside/laguna-s-2.1"],
      ["tencent/hy3:free", "tencent/hy3"],
    ]);
  });

  it("defaults to a selectable OpenRouter model", () => {
    expect(NARRATOR_MODELS.some((model) => model.id === DEFAULT_NARRATOR_MODEL)).toBe(true);
  });
});
