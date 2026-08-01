// Narrator model + thinking-effort registry and persisted selection (web
// build).
//
// The `narrate` Supabase edge function routes every provider through OpenRouter; this
// file is the single source of truth for which models/efforts the UI offers
// and which ones are active. The choices are read by src/engine/api-supabase.js
// on every narrator call and written by the picker beside the composer
// (src/components/primitives.jsx · NarratorPicker). The edge function validates
// both against their own allowlists. Unknown values fall back to the server
// default, so the client and server registries must stay synchronized.

// One universal player-facing effort scale. The edge function maps each tier
// to the nearest value supported by the selected model/provider.
export const NARRATOR_EFFORTS = [
  { id: "low",    label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "xhigh", label: "XHigh" },
  { id: "max",  label: "Max" },
];

// Prices are the exact OpenRouter floor-route input/output/cached-input rates
// in USD per 1M tokens, refreshed 2026-08-01. The edge function sorts by price,
// requires tool/reasoning compatibility, disables provider fallback, and caps
// prompt/completion prices at these values. Intelligence is OpenRouter's
// Artificial Analysis Intelligence Index snapshot from the same refresh.
export const NARRATOR_MODELS = [
  { id: "poolside/laguna-s-2.1:free", label: "Laguna S 2.1", note: "Poolside", provider: "OpenRouter floor", fallback: "poolside/laguna-s-2.1", price: { input: 0, output: 0, cachedInput: null }, fallbackPrice: { input: 0.09, output: 0.18, cachedInput: 0.009 }, intelligence: null },
  { id: "minimax/minimax-m3", label: "MiniMax M3", note: "MiniMax reasoning", provider: "OpenRouter floor", price: { input: 0.3, output: 1.2, cachedInput: 0.06 }, intelligence: 44.4 },
  { id: "deepseek/deepseek-v4-flash-0731", label: "DeepSeek V4 Flash", note: "DeepSeek", provider: "OpenRouter floor", price: { input: 0.09, output: 0.18, cachedInput: 0.018 }, intelligence: 49.9 },
  { id: "z-ai/glm-5.2", label: "GLM 5.2", note: "Z.ai reasoning", provider: "OpenRouter floor", price: { input: 0.72, output: 1.8, cachedInput: 0.12 }, intelligence: 51.1 },
  { id: "openai/gpt-5.6-luna", label: "GPT-5.6 Luna", note: "OpenAI", provider: "OpenRouter floor", price: { input: 0.05, output: 0.3, cachedInput: 0.005, cacheWrite: 0.0625, overrides: [{ minInputTokens: 272000, input: 0.1, output: 0.45, cachedInput: 0.01, cacheWrite: 0.125 }] }, intelligence: 51.2 },
  { id: "x-ai/grok-4.5", label: "Grok 4.5", note: "xAI", provider: "OpenRouter floor", price: { input: 2, output: 6, cachedInput: 0.3, overrides: [{ minInputTokens: 200000, input: 4, output: 12, cachedInput: 0.6 }] }, intelligence: 53.8 },
  { id: "openai/gpt-5.6-terra", label: "GPT-5.6 Terra", note: "OpenAI", provider: "OpenRouter floor", price: { input: 0.5, output: 3, cachedInput: 0.05, cacheWrite: 0.625, overrides: [{ minInputTokens: 272000, input: 1, output: 4.5, cachedInput: 0.1, cacheWrite: 1.25 }] }, intelligence: 55.0 },
  { id: "moonshotai/kimi-k3", label: "Kimi K3", note: "Moonshot AI", provider: "OpenRouter floor", price: { input: 2.9, output: 14, cachedInput: 0.29 }, intelligence: 57.1 },
];

function formatPricePerMillion(value) {
  return Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export function narratorModelPriceLabel(model) {
  if (!model?.price) return "Unavailable";
  if (model.price.input === 0 && model.price.output === 0) {
    if (!model.fallbackPrice) return "Free";
    return `Free primary · $${formatPricePerMillion(model.fallbackPrice.input)} / $${formatPricePerMillion(model.fallbackPrice.output)} fallback`;
  }
  return `$${formatPricePerMillion(model.price.input)} / $${formatPricePerMillion(model.price.output)}`;
}

export function narratorModelCachePriceLabel(model) {
  if (!model?.price || !Number.isFinite(model.price.cachedInput)) return "Cache unavailable";
  if (model.price.cachedInput === 0) return "Free cached input";
  return `$${formatPricePerMillion(model.price.cachedInput)} cached input`;
}

export function narratorModelPricingNote(model) {
  if (!model?.price) return "Pricing unavailable";
  const parts = [narratorModelCachePriceLabel(model)];
  if (Number.isFinite(model.price.cacheWrite)) {
    parts.push(`$${formatPricePerMillion(model.price.cacheWrite)} cache write`);
  }
  for (const override of model.price.overrides || []) {
    let label = `${Math.round(override.minInputTokens / 1000)}K+ $${formatPricePerMillion(override.input)} / $${formatPricePerMillion(override.output)}`;
    if (Number.isFinite(override.cachedInput)) label += ` · $${formatPricePerMillion(override.cachedInput)} cached input`;
    if (Number.isFinite(override.cacheWrite)) label += ` · $${formatPricePerMillion(override.cacheWrite)} cache write`;
    parts.push(label);
  }
  return parts.join(" · ");
}

export function narratorModelIntelligenceLabel(model) {
  if (Number.isFinite(model?.intelligence)) return model.intelligence.toFixed(1);
  return model?.intelligenceGuidance || "Unrated";
}

export function narratorModelIntelligenceSourceLabel(model) {
  if (Number.isFinite(model?.intelligence)) return "AA index";
  return model?.intelligenceGuidance ? "Product guidance" : "No score";
}

// Label for a model id, for display in the "Behind the veil" thinking drawer
// on committed beats — falls back to the raw id for models dropped from the
// picker after a beat was written with them.
export function narratorModelLabel(id) {
  return NARRATOR_MODELS.find((m) => m.id === id)?.label || id || null;
}

export const DEFAULT_NARRATOR_MODEL = "deepseek/deepseek-v4-flash-0731";
export const DEFAULT_NARRATOR_EFFORT = "max";

// Semantic effort remains stable in player preferences. This mirror of the
// edge transport mapping exists only so the picker can disclose when the
// selected backend receives a nearest-supported value instead.
const MODEL_TRANSPORT_EFFORTS = {
  "deepseek/deepseek-v4-flash-0731": { low: "low", medium: "high", high: "high", xhigh: "max", max: "max" },
  "z-ai/glm-5.2": { low: "high", medium: "high", high: "high", xhigh: "xhigh", max: "xhigh" },
  "x-ai/grok-4.5": { low: "low", medium: "medium", high: "high", xhigh: "high", max: "high" },
  "moonshotai/kimi-k3": { low: "low", medium: "high", high: "high", xhigh: "max", max: "max" },
};

function narratorEffortLabel(effort) {
  return NARRATOR_EFFORTS.find((entry) => entry.id === effort)?.label || effort;
}

export function narratorTransportEffort(modelId, effort) {
  const semantic = normalizeNarratorEffort(modelId, effort);
  return MODEL_TRANSPORT_EFFORTS[modelId]?.[semantic] || semantic;
}

export function narratorEffortDisplayLabel(modelId, effort) {
  const semantic = normalizeNarratorEffort(modelId, effort);
  const transport = narratorTransportEffort(modelId, semantic);
  const semanticLabel = narratorEffortLabel(semantic);
  return transport === semantic ? semanticLabel : `${semanticLabel} → ${narratorEffortLabel(transport)}`;
}

const MODEL_KEY  = "solitaire-narrator-model-v1";
const EFFORT_KEY = "solitaire-narrator-effort-v3";
// Retired selections migrate to the sole current DeepSeek V4 Flash release.
const NARRATOR_MODEL_ALIASES = {
  "deepseek/deepseek-v4-flash": DEFAULT_NARRATOR_MODEL,
  "deepseek/deepseek-v4-pro": DEFAULT_NARRATOR_MODEL,
  "qwen/qwen3.7-flash": DEFAULT_NARRATOR_MODEL,
  "tencent/hy3": DEFAULT_NARRATOR_MODEL,
  "tencent/hy3:free": DEFAULT_NARRATOR_MODEL,
};
export function normalizeNarratorEffort(modelId, effort) {
  void modelId;
  return NARRATOR_EFFORTS.some((entry) => entry.id === effort) ? effort : DEFAULT_NARRATOR_EFFORT;
}

// Sync reads so callNarrator can drop them straight into the request body
// without an extra await. Each falls back to its default for an unknown value,
// a missing preference, or blocked storage.
export function getNarratorModel() {
  try {
    const v = localStorage.getItem(MODEL_KEY);
    const migrated = NARRATOR_MODEL_ALIASES[v] || v;
    if (migrated && NARRATOR_MODELS.some((m) => m.id === migrated)) return migrated;
  } catch {}
  return DEFAULT_NARRATOR_MODEL;
}

export function setNarratorModel(id) {
  try { localStorage.setItem(MODEL_KEY, id); } catch {}
}

export function getNarratorEffort(modelId = getNarratorModel()) {
  try {
    const v = localStorage.getItem(EFFORT_KEY);
    if (v && NARRATOR_EFFORTS.some((e) => e.id === v)) return normalizeNarratorEffort(modelId, v);
  } catch {}
  return DEFAULT_NARRATOR_EFFORT;
}

export function setNarratorEffort(id) {
  try { localStorage.setItem(EFFORT_KEY, id); } catch {}
}
