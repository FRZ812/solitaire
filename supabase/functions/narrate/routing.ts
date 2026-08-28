export const DEFAULT_MODEL = "z-ai/glm-5.3-flash";
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
  "z-ai/glm-5.3-flash",
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
  ["minimax/minimax-m3", { prompt: 0.28, completion: 1.1 }],
  ["deepseek/deepseek-v4-flash-0731", { prompt: 0.03, completion: 0.1 }],
  ["z-ai/glm-5.2", { prompt: 0.4875, completion: 1.56 }],
  ["openai/gpt-5.6-luna", { prompt: 0.44, completion: 2.64 }],
  ["x-ai/grok-4.5", { prompt: 4, completion: 12 }],
  ["openai/gpt-5.6-terra", { prompt: 4, completion: 24 }],
  ["z-ai/glm-5.3-flash", { prompt: 0.075, completion: 0.25 }],
  ["moonshotai/kimi-k3", { prompt: 2.6, completion: 13 }],
]);

// Morph ties the compatible MiniMax floor but publishes no cache-read rate.
const MODEL_PROVIDER_IGNORES = new Map<string, string[]>([
  ["minimax/minimax-m3", ["morph"]],
]);


const UNIVERSAL_EFFORTS = new Set(["low", "medium", "high", "xhigh", "max"]);
const MODEL_EFFORT_VALUES = new Map<string, Record<string, string>>([
  // OpenRouter translates effort percentages into token budgets for endpoints
  // that expose reasoning.max_tokens rather than a native effort enum.
  ["poolside/laguna-s-2.1:free", { low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" }],
  ["minimax/minimax-m3", { low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" }],
  ["deepseek/deepseek-v4-flash-0731", { low: "low", medium: "high", high: "high", xhigh: "max", max: "max" }],
  ["z-ai/glm-5.2", { low: "high", medium: "high", high: "high", xhigh: "xhigh", max: "xhigh" }],
  ["z-ai/glm-5.3-flash", { low: "low", medium: "high", high: "high", xhigh: "max", max: "max" }],
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
  // Omit service_tier so OpenRouter keeps Luna and Terra on their standard
  // endpoints rather than the separately discounted Flex tier.
  void model;
  return undefined;
}

type NarratorRequestOptions = {
  model: string;
  effort: unknown;
  messages: Array<Record<string, unknown>>;
  tools: Array<Record<string, unknown>>;
  toolChoice: "auto" | "none";
};

export function buildNarratorRequest(opts: NarratorRequestOptions) {
  const model = selectedModel(opts.model);
  const serviceTier = selectedServiceTier(model);
  return {
    models: selectedModels(model),
    provider: selectedProvider(model),
    ...(serviceTier ? { service_tier: serviceTier } : {}),
    stream: true,
    messages: opts.messages,
    ...(opts.tools.length ? { tools: opts.tools, tool_choice: opts.toolChoice } : {}),
    reasoning: selectedReasoning(model, opts.effort),
  };
}

export function requestNarratorRound(opts: NarratorRequestOptions & {
  apiKey: string;
  fetcher?: typeof fetch;
  maxRequestBytes?: number;
  signal?: AbortSignal;
}) {
  const fetcher = opts.fetcher || fetch;
  const body = JSON.stringify(buildNarratorRequest(opts));
  const maxRequestBytes = Number.isFinite(opts.maxRequestBytes)
    ? Math.max(1, Math.trunc(opts.maxRequestBytes as number))
    : 2_000_000;
  if (new TextEncoder().encode(body).byteLength > maxRequestBytes) {
    throw new Error("Provider request exceeded the byte limit.");
  }
  return fetcher(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "Solitaire",
    },
    body,
    signal: opts.signal,
  });
}
