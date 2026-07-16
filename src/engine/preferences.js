// QoL preferences (web build) — persisted the same way as narrator-models.js:
// sync localStorage get/set pairs, no React state wrapper, safe fallback to a
// default on missing/invalid/blocked storage. Read once at startup and applied
// as a CSS custom property (see applyStoryFontScale) rather than threaded
// through props, since it only affects presentation.

export const STORY_FONT_SCALES = [
  { id: "sm", label: "Small",  value: 0.86 },
  { id: "md", label: "Normal", value: 1 },
  { id: "lg", label: "Large",  value: 1.18 },
  { id: "xl", label: "Extra large", value: 1.34 },
];

export const DEFAULT_STORY_FONT_SCALE = "md";

const FONT_SCALE_KEY = "solitaire-story-font-scale-v1";
const FONT_SCALE_CSS_VAR = "--story-font-scale";

export function getStoryFontScale() {
  try {
    const v = localStorage.getItem(FONT_SCALE_KEY);
    if (v && STORY_FONT_SCALES.some((s) => s.id === v)) return v;
  } catch {}
  return DEFAULT_STORY_FONT_SCALE;
}

export function setStoryFontScale(id) {
  try { localStorage.setItem(FONT_SCALE_KEY, id); } catch {}
  applyStoryFontScale(id);
}

// Writes the scale's numeric multiplier onto :root so every clamp()-based
// story font-size (chat-scene.css) picks it up via calc(). Call once at
// startup (App.jsx) and again whenever the preference changes.
export function applyStoryFontScale(id = getStoryFontScale()) {
  const scale = STORY_FONT_SCALES.find((s) => s.id === id) || STORY_FONT_SCALES.find((s) => s.id === DEFAULT_STORY_FONT_SCALE);
  document.documentElement.style.setProperty(FONT_SCALE_CSS_VAR, String(scale.value));
}
