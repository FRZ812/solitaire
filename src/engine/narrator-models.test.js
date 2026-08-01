import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_NARRATOR_EFFORT,
  DEFAULT_NARRATOR_MODEL,
  NARRATOR_EFFORTS,
  NARRATOR_MODELS,
  getNarratorEffort,
  getNarratorModel,
  normalizeNarratorEffort,
  narratorEffortDisplayLabel,
  narratorTransportEffort,
  narratorModelCachePriceLabel,
  narratorModelIntelligenceLabel,
  narratorModelIntelligenceSourceLabel,
  narratorModelPriceLabel,
  narratorModelPricingNote,
} from "./narrator-models.js";

afterEach(() => vi.unstubAllGlobals());

describe("OpenRouter narrator registry", () => {
  it("uses fully qualified OpenRouter model ids", () => {
    for (const model of NARRATOR_MODELS) expect(model.id).toMatch(/^[^/]+\/.+$/);
  });

  it("offers the configured models in picker order", () => {
    expect(NARRATOR_MODELS.map((model) => model.id)).toEqual([
      "poolside/laguna-s-2.1:free",
      "minimax/minimax-m3",
      "deepseek/deepseek-v4-flash-0731",
      "z-ai/glm-5.2",
      "openai/gpt-5.6-luna",
      "x-ai/grok-4.5",
      "openai/gpt-5.6-terra",
      "moonshotai/kimi-k3",
    ]);
  });

  it("keeps every remaining model on the OpenRouter floor route", () => {
    const byId = Object.fromEntries(NARRATOR_MODELS.map((model) => [model.id, model]));
    expect(byId["z-ai/glm-5.2"]).toMatchObject({
      label: "GLM 5.2",
      provider: "OpenRouter floor",
    });
    expect(byId["x-ai/grok-4.5"]).toMatchObject({
      label: "Grok 4.5",
      provider: "OpenRouter floor",
    });
    expect(byId["openai/gpt-5.6-luna"]).toMatchObject({
      label: "GPT-5.6 Luna",
      note: "OpenAI",
      provider: "OpenRouter floor",
    });
    expect(byId["openai/gpt-5.6-terra"]).toMatchObject({
      label: "GPT-5.6 Terra",
      note: "OpenAI",
      provider: "OpenRouter floor",
    });
    expect(byId["openai/gpt-5.6-luna"].fallback).toBeUndefined();
    expect(byId["openai/gpt-5.6-terra"].fallback).toBeUndefined();
  });

  it("keeps the free Laguna S primary and its paid fallback", () => {
    expect(NARRATOR_MODELS[0]).toMatchObject({
      id: "poolside/laguna-s-2.1:free",
      fallback: "poolside/laguna-s-2.1",
      price: { input: 0, output: 0, cachedInput: null },
      fallbackPrice: { input: 0.09, output: 0.18, cachedInput: 0.009 },
    });
  });

  it("makes the recalibrated 0731 release the only DeepSeek V4 Flash", () => {
    const model = NARRATOR_MODELS.find((entry) => entry.id === "deepseek/deepseek-v4-flash-0731");
    expect(model).toMatchObject({
      label: "DeepSeek V4 Flash",
      note: "DeepSeek",
      provider: "OpenRouter floor",
      price: { input: 0.09, output: 0.18, cachedInput: 0.018 },
      intelligence: 49.9,
    });
    expect(narratorModelPriceLabel(model)).toBe("$0.09 / $0.18");
    expect(narratorModelCachePriceLabel(model)).toBe("$0.018 cached input");
    expect(narratorModelIntelligenceLabel(model)).toBe("49.9");
    expect(narratorModelIntelligenceSourceLabel(model)).toBe("AA index");
    expect(NARRATOR_MODELS.some((entry) => entry.id === "deepseek/deepseek-v4-flash")).toBe(false);
    expect(NARRATOR_MODELS.some((entry) => entry.id === "deepseek/deepseek-v4-pro")).toBe(false);
    expect(NARRATOR_MODELS.some((entry) => entry.id === "tencent/hy3")).toBe(false);
    expect(NARRATOR_MODELS.some((entry) => entry.id === "qwen/qwen3.7-flash")).toBe(false);
  });

  it("offers one universal effort scale and defaults every model to Max", () => {
    expect(NARRATOR_EFFORTS.map((entry) => entry.id)).toEqual(["low", "medium", "high", "xhigh", "max"]);
    expect(DEFAULT_NARRATOR_EFFORT).toBe("max");
    expect(normalizeNarratorEffort("poolside/laguna-s-2.1:free", "xhigh")).toBe("xhigh");
    expect(normalizeNarratorEffort("openai/gpt-5.6-luna", "max")).toBe("max");
    expect(normalizeNarratorEffort("moonshotai/kimi-k3", "unsupported")).toBe("max");
  });

  it("exposes semantic-to-transport fallback labels without changing saved semantic effort", () => {
    expect(narratorTransportEffort("x-ai/grok-4.5", "max")).toBe("high");
    expect(narratorEffortDisplayLabel("x-ai/grok-4.5", "max")).toBe("Max → High");
    expect(narratorTransportEffort("z-ai/glm-5.2", "max")).toBe("xhigh");
    expect(narratorEffortDisplayLabel("z-ai/glm-5.2", "max")).toBe("Max → XHigh");
    expect(narratorEffortDisplayLabel("openai/gpt-5.6-luna", "max")).toBe("Max");
    expect(normalizeNarratorEffort("x-ai/grok-4.5", "max")).toBe("max");
  });

  it("does not put pricing in narrator labels", () => {
    expect(NARRATOR_MODELS.map((model) => model.label)).not.toContain("Free");
    expect(NARRATOR_MODELS[0].label).toBe("Laguna S 2.1");
    expect(NARRATOR_MODELS[1].label).toBe("MiniMax M3");
    expect(NARRATOR_MODELS[2].label).toBe("DeepSeek V4 Flash");
  });

  it("exposes sourced price and intelligence information instead of opaque bars", () => {
    for (const model of NARRATOR_MODELS) {
      expect(model.price).toMatchObject({ input: expect.any(Number), output: expect.any(Number) });
      expect(model.price.input).toBeGreaterThanOrEqual(0);
      expect(model.price.output).toBeGreaterThanOrEqual(0);
      expect(model.price.cachedInput === null || Number.isFinite(model.price.cachedInput)).toBe(true);
      expect(model.intelligence == null || Number.isFinite(model.intelligence)).toBe(true);
    }

    const byId = Object.fromEntries(NARRATOR_MODELS.map((model) => [model.id, model]));
    expect(byId["poolside/laguna-s-2.1:free"].fallbackPrice).toEqual({ input: 0.09, output: 0.18, cachedInput: 0.009 });
    expect(Object.fromEntries(NARRATOR_MODELS.map((model) => [model.id, narratorModelPriceLabel(model)]))).toEqual({
      "poolside/laguna-s-2.1:free": "Free primary · $0.09 / $0.18 fallback",
      "minimax/minimax-m3": "$0.30 / $1.20",
      "deepseek/deepseek-v4-flash-0731": "$0.09 / $0.18",
      "z-ai/glm-5.2": "$0.72 / $1.80",
      "x-ai/grok-4.5": "$2.00 / $6.00",
      "openai/gpt-5.6-luna": "$0.05 / $0.30",
      "openai/gpt-5.6-terra": "$0.50 / $3.00",
      "moonshotai/kimi-k3": "$2.90 / $14.00",
    });
    expect(Object.fromEntries(NARRATOR_MODELS.map((model) => [model.id, narratorModelCachePriceLabel(model)]))).toEqual({
      "poolside/laguna-s-2.1:free": "Cache unavailable",
      "minimax/minimax-m3": "$0.06 cached input",
      "deepseek/deepseek-v4-flash-0731": "$0.018 cached input",
      "z-ai/glm-5.2": "$0.12 cached input",
      "x-ai/grok-4.5": "$0.30 cached input",
      "openai/gpt-5.6-luna": "$0.005 cached input",
      "openai/gpt-5.6-terra": "$0.05 cached input",
      "moonshotai/kimi-k3": "$0.29 cached input",
    });
    expect(narratorModelIntelligenceLabel(byId["poolside/laguna-s-2.1:free"])).toBe("Unrated");
    expect(narratorModelIntelligenceLabel(byId["deepseek/deepseek-v4-flash-0731"])).toBe("49.9");
    expect(narratorModelIntelligenceLabel(byId["openai/gpt-5.6-terra"])).toBe("55.0");
    expect(narratorModelIntelligenceLabel(byId["moonshotai/kimi-k3"])).toBe("57.1");
    expect(narratorModelPricingNote(byId["openai/gpt-5.6-luna"])).toBe(
      "$0.005 cached input · $0.0625 cache write · 272K+ $0.10 / $0.45 · $0.01 cached input · $0.125 cache write",
    );
    expect(narratorModelPricingNote(byId["x-ai/grok-4.5"])).toBe(
      "$0.30 cached input · 200K+ $4.00 / $12.00 · $0.60 cached input",
    );
    expect(narratorModelPricingNote(byId["openai/gpt-5.6-terra"])).toBe(
      "$0.05 cached input · $0.625 cache write · 272K+ $1.00 / $4.50 · $0.10 cached input · $1.25 cache write",
    );
  });

  it("defaults to a selectable OpenRouter model", () => {
    expect(DEFAULT_NARRATOR_MODEL).toBe("deepseek/deepseek-v4-flash-0731");
    expect(NARRATOR_MODELS.some((model) => model.id === DEFAULT_NARRATOR_MODEL)).toBe(true);
  });

  it("starts the universal advanced effort control at Max", () => {
    const getItem = vi.fn(() => null);
    vi.stubGlobal("localStorage", { getItem });
    expect(getNarratorEffort()).toBe("max");
    expect(getItem).toHaveBeenCalledWith("solitaire-narrator-effort-v3");
  });

  it("migrates every retired fast narrator selection to the current DeepSeek V4 Flash", () => {
    for (const retired of [
      "deepseek/deepseek-v4-flash",
      "deepseek/deepseek-v4-pro",
      "qwen/qwen3.7-flash",
      "tencent/hy3",
      "tencent/hy3:free",
    ]) {
      vi.stubGlobal("localStorage", { getItem: () => retired });
      expect(getNarratorModel()).toBe("deepseek/deepseek-v4-flash-0731");
    }
  });

  it("keeps saved GLM and Grok selections available", () => {
    vi.stubGlobal("localStorage", { getItem: () => "z-ai/glm-5.2" });
    expect(getNarratorModel()).toBe("z-ai/glm-5.2");

    vi.stubGlobal("localStorage", { getItem: () => "x-ai/grok-4.5" });
    expect(getNarratorModel()).toBe("x-ai/grok-4.5");
  });
});