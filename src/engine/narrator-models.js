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

// Thinking-effort levels exposed for models with a compatible OpenRouter
// reasoning control. The edge function maps model-specific aliases such as
// `max` to the provider's accepted value (`xhigh` for DeepSeek/GLM).
export const NARRATOR_EFFORTS = [
  { id: "low",    label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "max",  label: "Max" },
];

// Prices are OpenRouter's public base input/output rates in USD per 1M tokens,
// refreshed 2026-07-31. Intelligence is OpenRouter's Artificial Analysis
// Intelligence Index snapshot; explicitly labeled product guidance is used
// only where the user supplied a comparative placement and no AA score exists.
export const NARRATOR_MODELS = [
  { id: "poolside/laguna-s-2.1:free", label: "Laguna S 2.1", note: "Poolside", provider: "OpenRouter", efforts: null, fallback: "poolside/laguna-s-2.1", price: { input: 0, output: 0 }, fallbackPrice: { input: 0.09, output: 0.18 }, intelligence: null },
  { id: "qwen/qwen3.7-flash",         label: "Qwen 3.7 Flash", note: "Qwen reasoning", provider: "OpenRouter", efforts: ["low", "high"], price: { input: 0.03, output: 0.13 }, intelligence: null },
  { id: "tencent/hy3",                label: "Hy3", note: "Tencent", provider: "OpenRouter", efforts: ["low", "high"], price: { input: 0.132, output: 0.528 }, intelligence: null },
  { id: "deepseek/deepseek-v4-flash", label: "DeepSeek V4 Flash", note: "fast reasoning", provider: "OpenRouter", efforts: ["high", "max"], price: { input: 0.14, output: 0.28 }, intelligence: 40.3 },
  { id: "deepseek/deepseek-v4-pro",   label: "DeepSeek V4 Pro", note: "deep reasoning", provider: "OpenRouter", efforts: ["high", "max"], price: { input: 0.435, output: 0.87 }, intelligence: 44.3 },
  { id: "minimax/minimax-m3",         label: "MiniMax M3", note: "MiniMax reasoning", provider: "OpenRouter", efforts: null, price: { input: 0.3, output: 1.2 }, intelligence: 44.4 },
  { id: "deepseek/deepseek-v4-flash-0731", label: "DeepSeek V4 Flash 0731", note: "DeepSeek", provider: "OpenRouter", efforts: ["high", "max"], price: { input: 0.14, output: 0.28 }, intelligence: null, intelligenceGuidance: "GLM level" },
  { id: "z-ai/glm-5.2",               label: "GLM 5.2", note: "Z.ai reasoning", provider: "OpenRouter", efforts: ["high", "max"], price: { input: 1.232, output: 3.872 }, intelligence: 51.1 },
  { id: "x-ai/grok-4.5",              label: "Grok 4.5", note: "xAI", provider: "OpenRouter", efforts: ["low", "medium", "high"], price: { input: 2, output: 6 }, intelligence: 53.8 },
  { id: "openai/gpt-5.6-luna",        label: "GPT-5.6 Luna", note: "OpenAI", provider: "OpenAI", efforts: ["low", "medium", "high", "max"], price: { input: 0.1, output: 0.6 }, intelligence: 51.2 },
  { id: "openai/gpt-5.6-terra",       label: "GPT-5.6 Terra", note: "OpenAI", provider: "OpenAI", efforts: ["low", "medium", "high", "max"], price: { input: 1, output: 6 }, intelligence: 55.0 },
  { id: "moonshotai/kimi-k3",         label: "Kimi K3", note: "Moonshot AI", provider: "OpenRouter", efforts: ["low", "high", "max"], price: { input: 3, output: 15 }, intelligence: 57.1 },
];

function formatPricePerMillion(value) {
  return Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

export function narratorModelPriceLabel(model) {
  if (!model?.price) return "Unavailable";
  if (model.price.input === 0 && model.price.output === 0) {
    if (!model.fallbackPrice) return "Free";
    return `Free primary · $${formatPricePerMillion(model.fallbackPrice.input)} / $${formatPricePerMillion(model.fallbackPrice.output)} fallback`;
  }
  return `$${formatPricePerMillion(model.price.input)} / $${formatPricePerMillion(model.price.output)}`;
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

export const DEFAULT_NARRATOR_MODEL = "deepseek/deepseek-v4-pro";
export const DEFAULT_NARRATOR_EFFORT = "high";

const MODEL_KEY  = "solitaire-narrator-model-v1";
const EFFORT_KEY = "solitaire-narrator-effort-v2";
// Legacy alias migration. The free Hy3 variant was retired by OpenRouter
// (returns 404 as of 2026-07-29), so users with `tencent/hy3:free` saved
// must now resolve to the paid Hy3 — the picker no longer offers the free
// slot. The reverse direction (paid -> free) is dropped; it would now route
// to a dead id.
const NARRATOR_MODEL_ALIASES = {
  "tencent/hy3:free": "tencent/hy3",
};
export function normalizeNarratorEffort(modelId, effort) {
  const model = NARRATOR_MODELS.find((entry) => entry.id === modelId);
  return model?.efforts?.includes(effort) ? effort : DEFAULT_NARRATOR_EFFORT;
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
