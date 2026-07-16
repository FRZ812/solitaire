// Narrator model + thinking-effort registry and persisted selection (web
// build).
//
// The `narrate` Supabase edge function routes every provider through OpenRouter; this
// file is the single source of truth for which models/efforts the UI offers
// and which ones are active. The choices are read by src/engine/api-supabase.js
// on every narrator call and written by the picker beside the composer
// (src/components/primitives.jsx · NarratorPicker). The edge function validates
// both against its own allowlists and falls back to a default if it doesn't
// recognise them, so the client and server lists only need to agree loosely.

// Thinking-effort levels exposed for models with a compatible OpenRouter
// reasoning control. The edge function maps `max` to OpenRouter's `xhigh`.
export const NARRATOR_EFFORTS = [
  { id: "high", label: "High" },
  { id: "max",  label: "Max" },
];

export const NARRATOR_MODELS = [
  { id: "deepseek/deepseek-v4-flash",      label: "DeepSeek V4 Flash",    note: "fast reasoning",  provider: "OpenRouter", efforts: ["high", "max"] },
  { id: "deepseek/deepseek-v4-pro",        label: "DeepSeek V4 Pro",      note: "deep reasoning",  provider: "OpenRouter", efforts: ["high", "max"] },
  { id: "z-ai/glm-5.2",                     label: "GLM 5.2",             note: "Z.ai reasoning",  provider: "OpenRouter", efforts: ["high", "max"] },
  { id: "openai/gpt-5.6-luna",              label: "GPT-5.6 Luna",        note: "OpenAI",          provider: "OpenRouter", efforts: null },
  { id: "google/gemini-3.1-pro-preview",   label: "Gemini 3.1 Pro",       note: "Google",          provider: "OpenRouter", efforts: null },
];

// Label for a model id, for display in the "Behind the veil" thinking drawer
// on committed beats — falls back to the raw id for models dropped from the
// picker after a beat was written with them.
export function narratorModelLabel(id) {
  return NARRATOR_MODELS.find((m) => m.id === id)?.label || id || null;
}

export const DEFAULT_NARRATOR_MODEL = "deepseek/deepseek-v4-pro";
export const DEFAULT_NARRATOR_EFFORT = "max";

const MODEL_KEY  = "solitaire-narrator-model-v1";
const EFFORT_KEY = "solitaire-narrator-effort-v1";

// Sync reads so callNarrator can drop them straight into the request body
// without an extra await. Each falls back to its default for an unknown value,
// a missing preference, or blocked storage.
export function getNarratorModel() {
  try {
    const v = localStorage.getItem(MODEL_KEY);
    if (v && NARRATOR_MODELS.some((m) => m.id === v)) return v;
  } catch {}
  return DEFAULT_NARRATOR_MODEL;
}

export function setNarratorModel(id) {
  try { localStorage.setItem(MODEL_KEY, id); } catch {}
}

export function getNarratorEffort() {
  try {
    const v = localStorage.getItem(EFFORT_KEY);
    if (v && NARRATOR_EFFORTS.some((e) => e.id === v)) return v;
  } catch {}
  return DEFAULT_NARRATOR_EFFORT;
}

export function setNarratorEffort(id) {
  try { localStorage.setItem(EFFORT_KEY, id); } catch {}
}
