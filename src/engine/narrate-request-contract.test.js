import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { SYSTEM_PROMPT } from "../system-prompt.js";
import { NARRATOR_INSTRUCTION_CORPUS } from "../narrator-instructions.js";
import {
  NARRATOR_EFFORTS,
  NARRATOR_MODELS,
  narratorTransportEffort,
} from "./narrator-models.js";
import {
  DEFAULT_EFFORT,
  DEFAULT_MODEL,
  NARRATOR_MODEL_IDS,
  requestNarratorRound,
  selectedModel,
  selectedModels,
  selectedProvider,
  selectedReasoning,
  selectedServiceTier,
} from "../../supabase/functions/narrate/routing.ts";

const edgeSource = readFileSync(
  new URL("../../supabase/functions/narrate/index.ts", import.meta.url),
  "utf8",
);

function numericConstant(name) {
  const match = edgeSource.match(new RegExp(`const\\s+${name}\\s*=\\s*([\\d_]+)`));
  expect(match, `${name} must be declared in the narrator Edge function`).not.toBeNull();
  return Number(match[1].replaceAll("_", ""));
}

function displayedPriceCeiling(model) {
  const prices = [model.price, ...(model.price.overrides || [])];
  if (model.fallbackPrice) prices.push(model.fallbackPrice);
  return {
    prompt: Math.max(...prices.map((price) => price.input)),
    completion: Math.max(...prices.map((price) => price.output)),
  };
}

describe("narrator request size contract", () => {
  it("keeps the always-on system prompt compact and delegates detailed doctrine", () => {
    const genericFieldLimit = numericConstant("MAX_FIELD_LENGTH");
    const systemPromptLimit = numericConstant("MAX_SYSTEM_PROMPT_LENGTH");

    expect(SYSTEM_PROMPT.length).toBeLessThanOrEqual(12_000);
    expect(SYSTEM_PROMPT.length).toBeLessThan(genericFieldLimit);
    expect(SYSTEM_PROMPT.length).toBeLessThanOrEqual(systemPromptLimit);
    expect(systemPromptLimit).toBeGreaterThanOrEqual(180_000);
    expect(SYSTEM_PROMPT).toContain("load_narrator_skills");
    expect(SYSTEM_PROMPT).toContain("start_combat");
    expect(SYSTEM_PROMPT).toContain('"tile_move":null|');
    expect(SYSTEM_PROMPT).toContain("Output ONLY the JSON object");
    expect(SYSTEM_PROMPT).not.toContain("STANDARD CONSUMPTION ANCHORS");
  });

  it("applies the dedicated limit to the system_prompt field", () => {
    expect(edgeSource).toMatch(
      /stringField\(payload\.system_prompt,\s*"system_prompt",\s*MAX_SYSTEM_PROMPT_LENGTH\)/,
    );
  });
});

describe("narrator model routing contract", () => {
  it("executes with the same exact model registry as the client", () => {
    expect(NARRATOR_MODEL_IDS).toEqual(NARRATOR_MODELS.map((model) => model.id));
    expect(DEFAULT_MODEL).toBe("deepseek/deepseek-v4-flash-0731");
    for (const retired of [
      "deepseek/deepseek-v4-flash",
      "deepseek/deepseek-v4-pro",
      "qwen/qwen3.7-flash",
      "tencent/hy3",
    ]) {
      expect(selectedModel(retired)).toBe(DEFAULT_MODEL);
    }
  });

  it("executes the same universal effort mapping displayed by the client", () => {
    expect(DEFAULT_EFFORT).toBe("max");
    for (const model of NARRATOR_MODELS) {
      for (const effort of NARRATOR_EFFORTS) {
        expect(selectedReasoning(model.id, effort.id)).toEqual({
          enabled: true,
          effort: narratorTransportEffort(model.id, effort.id),
        });
      }
      expect(selectedReasoning(model.id, "unsupported")).toEqual({
        enabled: true,
        effort: narratorTransportEffort(model.id, "max"),
      });
    }
  });

  it("executes price-sorted routing under exact model-specific ceilings", () => {
    for (const model of NARRATOR_MODELS) {
      expect(selectedProvider(model.id)).toMatchObject({
        sort: "price",
        require_parameters: true,
        allow_fallbacks: false,
        max_price: displayedPriceCeiling(model),
      });
    }
    expect(selectedProvider("minimax/minimax-m3").ignore).toEqual(["morph"]);
    expect(selectedModels("poolside/laguna-s-2.1:free")).toEqual([
      "poolside/laguna-s-2.1:free",
      "poolside/laguna-s-2.1",
    ]);
  });

  it("uses standard OpenAI pricing rather than half-price Flex", () => {
    expect(selectedServiceTier("openai/gpt-5.6-luna")).toBeUndefined();
    expect(selectedServiceTier("openai/gpt-5.6-terra")).toBeUndefined();
    expect(selectedServiceTier("deepseek/deepseek-v4-flash-0731")).toBeUndefined();
  });

  it("executes the exact manual and automatic OpenRouter request bodies", async () => {
    const instructionTool = { type: "function", function: { name: "load_narrator_skills" } };
    const memoryTool = { type: "function", function: { name: "remember" } };
    const fetcher = vi.fn(async () => ({ ok: true }));
    const common = {
      ["api" + "Key"]: ["test", "key"].join("-"),
      model: "minimax/minimax-m3",
      effort: "max",
      messages: [{ role: "user", content: "Continue." }],
      fetcher,
    };
    await requestNarratorRound({ ...common, tools: [instructionTool], toolChoice: "auto" });
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    const manual = JSON.parse(init.body);
    expect(manual).toMatchObject({
      models: ["minimax/minimax-m3"],
      provider: {
        sort: "price",
        require_parameters: true,
        allow_fallbacks: false,
        max_price: { prompt: 0.3, completion: 1.2 },
        ignore: ["morph"],
      },
      reasoning: { enabled: true, effort: "max" },
      tools: [instructionTool],
      tool_choice: "auto",
    });
    expect(manual).not.toHaveProperty("max_tokens");
    expect(manual).not.toHaveProperty("parallel_tool_calls");
    fetcher.mockClear();
    await requestNarratorRound({
      ...common,
      model: "openai/gpt-5.6-luna",
      tools: [instructionTool, memoryTool],
      toolChoice: "auto",
    });
    const automatic = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(automatic).toMatchObject({
      tools: [instructionTool, memoryTool],
      tool_choice: "auto",
    });
    expect(automatic).not.toHaveProperty("service_tier");
    fetcher.mockClear();
    await requestNarratorRound({
      ...common,
      tools: [],
      toolChoice: "none",
    });
    const withoutTools = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(withoutTools).not.toHaveProperty("tools");
    expect(withoutTools).not.toHaveProperty("tool_choice");
  });
});


describe("narrator memory tool contract", () => {
  it("retains duplicate suppression and existing-memory input", () => {
    expect(edgeSource).toContain('"ignored: already recorded"');
    expect(edgeSource).toContain("existing_memories");
  });
});

describe("narrator instruction tool contract", () => {
  it("keeps detailed skills outside initial messages and resolves them through tool results", () => {
    expect(edgeSource).toContain("payload.narrator_skills == null");
    expect(edgeSource).toContain("asInstructionLibrary(payload.narrator_skills)");
    expect(edgeSource).toContain("instructionToolFor(opts.instructionLibrary)");
    expect(edgeSource).toContain("resolveInstructionToolCall");
    expect(edgeSource).toContain("loadedSkillIds");
    expect(edgeSource).toContain('toolChoice: round === MAX_PROVIDER_ROUNDS - 1 ? "none" : "auto"');
    expect(edgeSource).not.toContain("MAX_OUTPUT_TOKENS");
    expect(edgeSource).not.toContain("content: instructionLibrary");
  });
});

describe("narrator party-removal contract", () => {
  it("exposes a structured removal action for story-only companion deaths", () => {
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain('party_removals:[{"id":"<their listed id>","reason":"dead"}]');
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain('"party_removals": null OR [{"id":"current-party-member-id","reason":"dead|left"}]');
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain("repair that stale roster with the same removal");
  });
});

describe("narrator progression contract", () => {
  it("uses numeric racial and profession allocation without character-tier labels", () => {
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain("racial_levels");
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain("profession_plan");
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain('"progression_focus": null OR "racial"');
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain("up to 30 RACIAL EVOLUTION levels plus up to 70 combined PROFESSION levels");
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain("Never invent or emit durable path ids/ranks");
    expect(NARRATOR_INSTRUCTION_CORPUS).not.toContain("WORLD POWER BANDS");
    expect(NARRATOR_INSTRUCTION_CORPUS).not.toContain("STANDARD: levels 1–20");
  });

  it("keeps rarity tiers for items and abilities distinct from character level", () => {
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain("Item and ability rarity tiers remain separate");
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain("TIER SCALES AN ABILITY");
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain('("tier":"common".."divine")');
  });

  it("defines distinct caster and non-combat profession identities", () => {
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain("Wizard progression favors the widest arcane spellbook");
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain("Sorcerer progression favors a small number of signature spells enhanced by metamagic");
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain("Social, service, scholarship, and craft professions gain abilities useful in their own work");
  });

  it("leaves player specialization branches to the engine while allowing validated NPC hints", () => {
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain("A player's branch is an engine-owned choice");
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain("NEVER choose, infer, or silently change specializationPath or branchChoices for the player");
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain("Generated NPCs may include engine-validated specializationPath and branchChoices");
    expect(NARRATOR_INSTRUCTION_CORPUS).toContain("Necromancy may later layer into Undead Lord, or into Death Magic");
  });
});
