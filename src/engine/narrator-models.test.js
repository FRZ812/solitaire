import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_NARRATOR_EFFORT,
  DEFAULT_NARRATOR_MODEL,
  NARRATOR_MODELS,
  getNarratorModel,
  normalizeNarratorEffort,
} from "./narrator-models.js";

afterEach(() => vi.unstubAllGlobals());

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

  it("keeps the free primary IDs and their paid fallbacks", () => {
    expect(NARRATOR_MODELS.slice(0, 2).map((model) => [model.id, model.fallback || null])).toEqual([
      ["poolside/laguna-s-2.1:free", "poolside/laguna-s-2.1"],
      ["tencent/hy3:free", "tencent/hy3"],
    ]);
  });

  it("exposes the provider-supported reasoning levels with High as the default", () => {
    const byId = Object.fromEntries(NARRATOR_MODELS.map((model) => [model.id, model]));
    expect(byId["poolside/laguna-s-2.1:free"].efforts).toBeNull();
    expect(byId["tencent/hy3:free"].efforts).toEqual(["low", "high"]);
    expect(byId["x-ai/grok-4.5"].efforts).toEqual(["low", "medium", "high"]);
    expect(byId["moonshotai/kimi-k3"].efforts).toEqual(["low", "high", "max"]);
    expect(byId["minimax/minimax-m3"].efforts).toBeNull();
    expect(DEFAULT_NARRATOR_EFFORT).toBe("high");
    expect(normalizeNarratorEffort("x-ai/grok-4.5", "max")).toBe("high");
    expect(normalizeNarratorEffort("moonshotai/kimi-k3", "max")).toBe("max");
  });

  it("does not put pricing in narrator labels", () => {
    expect(NARRATOR_MODELS.map((model) => model.label)).not.toContain("Free");
    expect(NARRATOR_MODELS[0].label).toBe("Laguna S 2.1");
    expect(NARRATOR_MODELS[1].label).toBe("Hy3");
  });

  it("keeps the free Hy3 selection as the active primary model", () => {
    vi.stubGlobal("localStorage", { getItem: () => "tencent/hy3:free" });
    expect(getNarratorModel()).toBe("tencent/hy3:free");
  });

  it("migrates a previously saved paid Hy3 selection to the free primary", () => {
    vi.stubGlobal("localStorage", { getItem: () => "tencent/hy3" });
    expect(getNarratorModel()).toBe("tencent/hy3:free");
  });

  it("defaults to a selectable OpenRouter model", () => {
    expect(NARRATOR_MODELS.some((model) => model.id === DEFAULT_NARRATOR_MODEL)).toBe(true);
  });
});
