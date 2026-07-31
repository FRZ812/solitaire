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

export const NARRATOR_MODELS = [
  { id: "poolside/laguna-s-2.1:free", label: "Laguna S 2.1", note: "Poolside", provider: "OpenRouter", efforts: null, fallback: "poolside/laguna-s-2.1" },
  { id: "qwen/qwen3.7-flash",         label: "Qwen 3.7 Flash", note: "Qwen reasoning", provider: "OpenRouter", efforts: ["low", "high"] },
  { id: "tencent/hy3",                label: "Hy3",         note: "Tencent", provider: "OpenRouter", efforts: ["low", "high"] },
  { id: "deepseek/deepseek-v4-flash",   label: "DeepSeek V4 Flash", note: "fast reasoning", provider: "OpenRouter", efforts: ["high", "max"] },
  { id: "deepseek/deepseek-v4-pro",     label: "DeepSeek V4 Pro",   note: "deep reasoning", provider: "OpenRouter", efforts: ["high", "max"] },
  { id: "minimax/minimax-m3",           label: "MiniMax M3",         note: "MiniMax reasoning", provider: "OpenRouter", efforts: null },
  { id: "z-ai/glm-5.2",                 label: "GLM 5.2",             note: "Z.ai reasoning", provider: "OpenRouter", efforts: ["high", "max"] },
  { id: "x-ai/grok-4.5",                label: "Grok 4.5",            note: "xAI", provider: "OpenRouter", efforts: ["low", "medium", "high"] },
  { id: "openai/gpt-5.6-luna",          label: "GPT-5.6 Luna",         note: "OpenAI", provider: "OpenAI", efforts: ["low", "medium", "high", "max"] },
  { id: "openai/gpt-5.6-terra",         label: "GPT-5.6 Terra",        note: "OpenAI", provider: "OpenAI", efforts: ["low", "medium", "high", "max"] },
  { id: "moonshotai/kimi-k3",           label: "Kimi K3",             note: "Moonshot AI", provider: "OpenRouter", efforts: ["low", "high", "max"] },
];

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
