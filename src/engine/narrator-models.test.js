import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_NARRATOR_EFFORT,
  DEFAULT_NARRATOR_MODEL,
  NARRATOR_MODELS,
  getNarratorModel,
  normalizeNarratorEffort,
  narratorModelIntelligenceLabel,
  narratorModelIntelligenceSourceLabel,
  narratorModelPriceLabel,
} from "./narrator-models.js";

afterEach(() => vi.unstubAllGlobals());

describe("OpenRouter narrator registry", () => {
  it("uses fully qualified OpenRouter model ids", () => {
    for (const model of NARRATOR_MODELS) expect(model.id).toMatch(/^[^/]+\/.+$/);
  });

  it("offers the configured models in picker order", () => {
    expect(NARRATOR_MODELS.map((model) => model.id)).toEqual([
      "poolside/laguna-s-2.1:free",
      "qwen/qwen3.7-flash",
      "tencent/hy3",
      "deepseek/deepseek-v4-flash",
      "deepseek/deepseek-v4-pro",
      "minimax/minimax-m3",
      "deepseek/deepseek-v4-flash-0731",
      "z-ai/glm-5.2",
      "x-ai/grok-4.5",
      "openai/gpt-5.6-luna",
      "openai/gpt-5.6-terra",
      "moonshotai/kimi-k3",
    ]);
  });

  it("keeps GLM and Grok while adding OpenAI-only GPT models", () => {
    const byId = Object.fromEntries(NARRATOR_MODELS.map((model) => [model.id, model]));
    expect(byId["z-ai/glm-5.2"]).toMatchObject({
      label: "GLM 5.2",
      provider: "OpenRouter",
      efforts: ["high", "max"],
    });
    expect(byId["x-ai/grok-4.5"]).toMatchObject({
      label: "Grok 4.5",
      provider: "OpenRouter",
      efforts: ["low", "medium", "high"],
    });
    expect(byId["openai/gpt-5.6-luna"]).toMatchObject({
      label: "GPT-5.6 Luna",
      note: "OpenAI",
      provider: "OpenAI",
      efforts: ["low", "medium", "high", "max"],
    });
    expect(byId["openai/gpt-5.6-terra"]).toMatchObject({
      label: "GPT-5.6 Terra",
      note: "OpenAI",
      provider: "OpenAI",
      efforts: ["low", "medium", "high", "max"],
    });
    expect(byId["openai/gpt-5.6-luna"].fallback).toBeUndefined();
    expect(byId["openai/gpt-5.6-terra"].fallback).toBeUndefined();
  });

  it("keeps the free Laguna S primary and its paid fallback", () => {
    // The free Hy3 slot was retired by OpenRouter (404 as of 2026-07-29), so
    // only Laguna S 2.1 retains the free-primary / paid-fallback pairing in
    // the picker. Hy3 (paid) is now its own entry with no free variant.
    expect(NARRATOR_MODELS[0]).toMatchObject({
      id: "poolside/laguna-s-2.1:free",
      fallback: "poolside/laguna-s-2.1",
    });
    const hy3 = NARRATOR_MODELS.find((m) => m.id === "tencent/hy3");
    expect(hy3?.fallback).toBeUndefined();
  });

  it("adds DeepSeek V4 Flash 0731 with exact price and explicitly sourced GLM-level guidance", () => {
    const model = NARRATOR_MODELS.find((entry) => entry.id === "deepseek/deepseek-v4-flash-0731");
    expect(model).toMatchObject({
      label: "DeepSeek V4 Flash 0731",
      note: "DeepSeek",
      provider: "OpenRouter",
      efforts: ["high", "max"],
      price: { input: 0.14, output: 0.28 },
      intelligence: null,
      intelligenceGuidance: "GLM level",
    });
    expect(narratorModelPriceLabel(model)).toBe("$0.14 / $0.28");
    expect(narratorModelIntelligenceLabel(model)).toBe("GLM level");
    expect(narratorModelIntelligenceSourceLabel(model)).toBe("Product guidance");
  });

  it("exposes the provider-supported reasoning levels with High as the default", () => {
    const byId = Object.fromEntries(NARRATOR_MODELS.map((model) => [model.id, model]));
    expect(byId["poolside/laguna-s-2.1:free"].efforts).toBeNull();
    expect(byId["qwen/qwen3.7-flash"].efforts).toEqual(["low", "high"]);
    expect(byId["tencent/hy3"].efforts).toEqual(["low", "high"]);
    expect(byId["openai/gpt-5.6-luna"].efforts).toEqual(["low", "medium", "high", "max"]);
    expect(byId["openai/gpt-5.6-terra"].efforts).toEqual(["low", "medium", "high", "max"]);
    expect(byId["moonshotai/kimi-k3"].efforts).toEqual(["low", "high", "max"]);
    expect(byId["minimax/minimax-m3"].efforts).toBeNull();
    expect(DEFAULT_NARRATOR_EFFORT).toBe("high");
    expect(normalizeNarratorEffort("openai/gpt-5.6-luna", "max")).toBe("max");
    expect(normalizeNarratorEffort("openai/gpt-5.6-terra", "max")).toBe("max");
    expect(normalizeNarratorEffort("moonshotai/kimi-k3", "max")).toBe("max");
  });

  it("does not put pricing in narrator labels", () => {
    expect(NARRATOR_MODELS.map((model) => model.label)).not.toContain("Free");
    expect(NARRATOR_MODELS[0].label).toBe("Laguna S 2.1");
    expect(NARRATOR_MODELS[1].label).toBe("Qwen 3.7 Flash");
    expect(NARRATOR_MODELS[2].label).toBe("Hy3");
  });

  it("exposes sourced price and intelligence information instead of opaque bars", () => {
    for (const model of NARRATOR_MODELS) {
      expect(model.price).toMatchObject({ input: expect.any(Number), output: expect.any(Number) });
      expect(model.price.input).toBeGreaterThanOrEqual(0);
      expect(model.price.output).toBeGreaterThanOrEqual(0);
      expect(model.intelligence == null || Number.isFinite(model.intelligence)).toBe(true);
    }

    const byId = Object.fromEntries(NARRATOR_MODELS.map((model) => [model.id, model]));
    expect(byId["poolside/laguna-s-2.1:free"].fallbackPrice).toEqual({ input: 0.09, output: 0.18 });
    expect(Object.fromEntries(NARRATOR_MODELS.map((model) => [model.id, narratorModelPriceLabel(model)]))).toEqual({
      "poolside/laguna-s-2.1:free": "Free primary · $0.09 / $0.18 fallback",
      "qwen/qwen3.7-flash": "$0.03 / $0.13",
      "tencent/hy3": "$0.132 / $0.528",
      "deepseek/deepseek-v4-flash": "$0.14 / $0.28",
      "deepseek/deepseek-v4-pro": "$0.435 / $0.87",
      "minimax/minimax-m3": "$0.30 / $1.20",
      "deepseek/deepseek-v4-flash-0731": "$0.14 / $0.28",
      "z-ai/glm-5.2": "$1.232 / $3.872",
      "x-ai/grok-4.5": "$2.00 / $6.00",
      "openai/gpt-5.6-luna": "$0.10 / $0.60",
      "openai/gpt-5.6-terra": "$1.00 / $6.00",
      "moonshotai/kimi-k3": "$3.00 / $15.00",
    });
    expect(narratorModelIntelligenceLabel(byId["qwen/qwen3.7-flash"])).toBe("Unrated");
    expect(narratorModelIntelligenceLabel(byId["deepseek/deepseek-v4-flash"])).toBe("40.3");
    expect(narratorModelIntelligenceLabel(byId["openai/gpt-5.6-terra"])).toBe("55.0");
    expect(narratorModelIntelligenceLabel(byId["moonshotai/kimi-k3"])).toBe("57.1");
  });

  it("defaults to a selectable OpenRouter model", () => {
    expect(NARRATOR_MODELS.some((model) => model.id === DEFAULT_NARRATOR_MODEL)).toBe(true);
  });

  // The free Hy3 variant was retired by OpenRouter; users with the legacy
  // `tencent/hy3:free` selection must now resolve to the paid Hy3 rather than
  // routing to a dead id.
  it("migrates a legacy saved free Hy3 selection to the paid Hy3", () => {
    vi.stubGlobal("localStorage", { getItem: () => "tencent/hy3:free" });
    expect(getNarratorModel()).toBe("tencent/hy3");
  });

  it("keeps saved GLM and Grok selections available", () => {
    vi.stubGlobal("localStorage", { getItem: () => "z-ai/glm-5.2" });
    expect(getNarratorModel()).toBe("z-ai/glm-5.2");

    vi.stubGlobal("localStorage", { getItem: () => "x-ai/grok-4.5" });
    expect(getNarratorModel()).toBe("x-ai/grok-4.5");
  });
});