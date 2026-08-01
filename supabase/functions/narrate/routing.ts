export const DEFAULT_MODEL = "deepseek/deepseek-v4-flash-0731";
export const DEFAULT_EFFORT = "max";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export const NARRATOR_MODEL_IDS = [
  "poolside/laguna-s-2.1:free",
  "minimax/minimax-m3",
  "deepseek/deepseek-v4-flash-0731",
  "z-ai/glm-5.2",
  "openai/gpt-5.6-luna",
  "x-ai/grok-4.5",
  "openai/gpt-5.6-terra",
  "moonshotai/kimi-k3",
] as const;

const ALLOWED_MODELS = new Set<string>(NARRATOR_MODEL_IDS);
const MODEL_FALLBACKS = new Map<string, string[]>([
  ["poolside/laguna-s-2.1:free", ["poolside/laguna-s-2.1"]],
]);

// OpenRouter floor-route ceilings in USD per million tokens, including the
// published long-context overrides where applicable. Laguna's ceiling covers
// its explicitly disclosed paid model fallback.
const MODEL_PRICE_CEILINGS = new Map<string, { prompt: number; completion: number }>([
  ["poolside/laguna-s-2.1:free", { prompt: 0.09, completion: 0.18 }],
  ["minimax/minimax-m3", { prompt: 0.3, completion: 1.2 }],
  ["deepseek/deepseek-v4-flash-0731", { prompt: 0.09, completion: 0.18 }],
  ["z-ai/glm-5.2", { prompt: 0.72, completion: 1.8 }],
  ["openai/gpt-5.6-luna", { prompt: 0.1, completion: 0.45 }],
  ["x-ai/grok-4.5", { prompt: 4, completion: 12 }],
  ["openai/gpt-5.6-terra", { prompt: 1, completion: 4.5 }],
  ["moonshotai/kimi-k3", { prompt: 2.9, completion: 14 }],
]);

// Morph ties the compatible MiniMax floor but publishes no cache-read rate.
const MODEL_PROVIDER_IGNORES = new Map<string, string[]>([
  ["minimax/minimax-m3", ["morph"]],
]);

const FLEX_SERVICE_MODELS = new Set([
  "openai/gpt-5.6-luna",
  "openai/gpt-5.6-terra",
]);

const UNIVERSAL_EFFORTS = new Set(["low", "medium", "high", "xhigh", "max"]);
const MODEL_EFFORT_VALUES = new Map<string, Record<string, string>>([
  // OpenRouter translates effort percentages into token budgets for endpoints
  // that expose reasoning.max_tokens rather than a native effort enum.
  ["poolside/laguna-s-2.1:free", { low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" }],
  ["minimax/minimax-m3", { low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" }],
  ["deepseek/deepseek-v4-flash-0731", { low: "low", medium: "high", high: "high", xhigh: "max", max: "max" }],
  ["z-ai/glm-5.2", { low: "high", medium: "high", high: "high", xhigh: "xhigh", max: "xhigh" }],
  ["x-ai/grok-4.5", { low: "low", medium: "medium", high: "high", xhigh: "high", max: "high" }],
  ["openai/gpt-5.6-luna", { low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" }],
  ["openai/gpt-5.6-terra", { low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" }],
  ["moonshotai/kimi-k3", { low: "low", medium: "high", high: "high", xhigh: "max", max: "max" }],
]);

export type ReasoningOptions = { enabled: boolean; effort?: string };

export function selectedModel(value: unknown) {
  return typeof value === "string" && ALLOWED_MODELS.has(value) ? value : DEFAULT_MODEL;
}

export function selectedModels(model: string) {
  return [model, ...(MODEL_FALLBACKS.get(model) || [])];
}

export function selectedProvider(model: string) {
  const ignore = MODEL_PROVIDER_IGNORES.get(model);
  return {
    sort: "price",
    require_parameters: true,
    allow_fallbacks: false,
    max_price: MODEL_PRICE_CEILINGS.get(model),
    ...(ignore ? { ignore } : {}),
  };
}

export function selectedReasoning(model: string, effort: unknown): ReasoningOptions | undefined {
  const values = MODEL_EFFORT_VALUES.get(model);
  if (!values) return undefined;
  const selected = typeof effort === "string" && UNIVERSAL_EFFORTS.has(effort) ? effort : DEFAULT_EFFORT;
  return { enabled: true, effort: values[selected] || values[DEFAULT_EFFORT] };
}

export function selectedServiceTier(model: string) {
  return FLEX_SERVICE_MODELS.has(model) ? "flex" : undefined;
}

type NarratorRequestOptions = {
  model: string;
  effort: unknown;
  messages: Array<Record<string, unknown>>;
  memoryTool: Record<string, unknown>;
  toolsEnabled: boolean;
  maxTokens: number;
};

export function buildNarratorRequest(opts: NarratorRequestOptions) {
  const model = selectedModel(opts.model);
  const serviceTier = selectedServiceTier(model);
  return {
    models: selectedModels(model),
    provider: selectedProvider(model),
    ...(serviceTier ? { service_tier: serviceTier } : {}),
    stream: true,
    max_tokens: opts.maxTokens,
    messages: opts.messages,
    tools: [opts.memoryTool],
    tool_choice: opts.toolsEnabled ? "auto" : "none",
    reasoning: selectedReasoning(model, opts.effort),
  };
}

export function requestNarratorRound(opts: NarratorRequestOptions & {
  apiKey: string;
  fetcher?: typeof fetch;
}) {
  const fetcher = opts.fetcher || fetch;
  return fetcher(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "Solitaire",
    },
    body: JSON.stringify(buildNarratorRequest(opts)),
  });
}
