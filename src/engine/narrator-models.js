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
// in USD per 1M tokens, refreshed 2026-08-28. The edge function sorts by price,
// requires tool/reasoning compatibility, disables provider fallback, and caps
// prompt/completion prices at these values. Intelligence is OpenRouter's
// Artificial Analysis Intelligence Index snapshot from the same refresh.
export const NARRATOR_MODELS = [
  { id: "poolside/laguna-s-2.1:free", label: "Laguna S 2.1", note: "Poolside", provider: "OpenRouter floor", fallback: "poolside/laguna-s-2.1", price: { input: 0, output: 0, cachedInput: null }, fallbackPrice: { input: 0.09, output: 0.18, cachedInput: 0.009 }, intelligence: null },
  { id: "minimax/minimax-m3", label: "MiniMax M3", note: "MiniMax reasoning", provider: "OpenRouter floor", price: { input: 0.28, output: 1.1, cachedInput: 0.06 }, intelligence: 44.4 },
  { id: "deepseek/deepseek-v4-flash-0731", label: "DeepSeek V4 Flash", note: "DeepSeek", provider: "OpenRouter floor", price: { input: 0.03, output: 0.1, cachedInput: 0.012 }, intelligence: 49.9 },
  { id: "z-ai/glm-5.2", label: "GLM 5.2", note: "Z.ai reasoning", provider: "OpenRouter floor", price: { input: 0.4875, output: 1.56, cachedInput: 0.221 }, intelligence: 51.1 },
  { id: "openai/gpt-5.6-luna", label: "GPT-5.6 Luna", note: "OpenAI", provider: "OpenRouter standard", price: { input: 0.22, output: 1.32, cachedInput: 0.022, cacheWrite: 0.275, overrides: [{ minInputTokens: 272000, input: 0.44, output: 1.98, cachedInput: 0.044, cacheWrite: 0.55 }] }, intelligence: 51.2 },
  { id: "x-ai/grok-4.5", label: "Grok 4.5", note: "xAI", provider: "OpenRouter floor", price: { input: 2, output: 6, cachedInput: 0.3, overrides: [{ minInputTokens: 200000, input: 4, output: 12, cachedInput: 0.6 }] }, intelligence: 53.8 },
  { id: "openai/gpt-5.6-terra", label: "GPT-5.6 Terra", note: "OpenAI", provider: "OpenRouter standard", price: { input: 2, output: 12, cachedInput: 0.2, cacheWrite: 2.5, overrides: [{ minInputTokens: 272000, input: 4, output: 18, cachedInput: 0.4, cacheWrite: 5 }] }, intelligence: 55.0 },
  { id: "z-ai/glm-5.3-flash", label: "GLM 5.3 Flash", note: "Z.ai reasoning", provider: "OpenRouter floor", price: { input: 0.075, output: 0.25, cachedInput: 0.015 }, intelligence: 57.5 },
  { id: "moonshotai/kimi-k3", label: "Kimi K3", note: "Moonshot AI", provider: "OpenRouter active floor", price: { input: 2.6, output: 13, cachedInput: 0.3 }, intelligence: 57.1 },
];

export const NARRATOR_SORT_OPTIONS = [
  { id: "intelligence-asc", label: "Intelligence · low first" },
  { id: "intelligence-desc", label: "Intelligence · high first" },
  { id: "price-asc", label: "Price · low first" },
  { id: "price-desc", label: "Price · high first" },
  { id: "name-asc", label: "Name · A–Z" },
];

export function sortNarratorModels(models, sortId) {
  const sorted = [...models];
  const priceScore = (model) => (model.price?.input || 0) + (model.price?.output || 0);
  if (sortId === "intelligence-desc") {
    return sorted.sort((a, b) => (Number.isFinite(b.intelligence) ? b.intelligence : -Infinity) - (Number.isFinite(a.intelligence) ? a.intelligence : -Infinity));
  }
  if (sortId === "intelligence-asc") {
    return sorted.sort((a, b) => (Number.isFinite(a.intelligence) ? a.intelligence : -Infinity) - (Number.isFinite(b.intelligence) ? b.intelligence : -Infinity));
  }
  if (sortId === "price-asc") return sorted.sort((a, b) => priceScore(a) - priceScore(b));
  if (sortId === "price-desc") return sorted.sort((a, b) => priceScore(b) - priceScore(a));
  if (sortId === "name-asc") return sorted.sort((a, b) => a.label.localeCompare(b.label));
  return sorted;
}

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

export const DEFAULT_NARRATOR_MODEL = "z-ai/glm-5.3-flash";
export const DEFAULT_NARRATOR_EFFORT = "max";

// Semantic effort remains stable in player preferences. This mirror of the
// edge transport mapping exists only so the picker can disclose when the
// selected backend receives a nearest-supported value instead.
const MODEL_TRANSPORT_EFFORTS = {
  "deepseek/deepseek-v4-flash-0731": { low: "low", medium: "high", high: "high", xhigh: "max", max: "max" },
  "z-ai/glm-5.2": { low: "high", medium: "high", high: "high", xhigh: "xhigh", max: "xhigh" },
  "z-ai/glm-5.3-flash": { low: "low", medium: "high", high: "high", xhigh: "max", max: "max" },
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
// Retired selections migrate to the current product default.
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
