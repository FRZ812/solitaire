import { describe, expect, it } from "vitest";
import { DEFAULT_NARRATOR_MODEL, NARRATOR_MODELS } from "./narrator-models.js";

describe("OpenRouter narrator registry", () => {
  it("uses fully qualified OpenRouter model ids", () => {
    for (const model of NARRATOR_MODELS) expect(model.id).toMatch(/^[^/]+\/.+$/);
  });

  it("includes the configured cross-provider choices", () => {
    expect(NARRATOR_MODELS.map((model) => model.id)).toEqual(expect.arrayContaining([
      "xiaomi/mimo-v2.5",
      "z-ai/glm-5.2",
      "openai/gpt-5.6-luna",
    ]));
  });

  it("defaults to a selectable OpenRouter model", () => {
    expect(NARRATOR_MODELS.some((model) => model.id === DEFAULT_NARRATOR_MODEL)).toBe(true);
  });
});
