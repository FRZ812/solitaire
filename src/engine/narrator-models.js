// Narrator model registry + persisted selection (web build).
//
// The `narrate` Supabase edge function can route to multiple providers; this
// file is the single source of truth for which models the UI offers and which
// one is active. The choice is read by src/engine/api-supabase.js on every
// narrator call and written by the picker in the Character menu
// (src/components/MenuSheet.jsx). The edge function validates the id against
// its own allowlist and falls back to its default if it doesn't recognise it,
// so the client and server lists only need to agree loosely.

export const NARRATOR_MODELS = [
  { id: "deepseek-v4-pro",        label: "DeepSeek v4 Pro",   note: "max thinking" },
  { id: "deepseek-v4-flash",      label: "DeepSeek v4 Flash", note: "faster" },
  { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro",    note: "Google" },
];

export const DEFAULT_NARRATOR_MODEL = "deepseek-v4-pro";

const PREF_KEY = "solitaire-narrator-model-v1";

// Sync read so callNarrator can drop it straight into the request body without
// an extra await. Falls back to the default for an unknown id, a missing
// preference, or blocked storage.
export function getNarratorModel() {
  try {
    const v = localStorage.getItem(PREF_KEY);
    if (v && NARRATOR_MODELS.some((m) => m.id === v)) return v;
  } catch {}
  return DEFAULT_NARRATOR_MODEL;
}

export function setNarratorModel(id) {
  try { localStorage.setItem(PREF_KEY, id); } catch {}
}
