export const NARRATOR_INSTRUCTION_LIMIT = 4000;

export const NARRATOR_MEMORY_MODES = Object.freeze([
  {
    id: "balanced",
    label: "Balanced",
    description: "Remember durable plot facts, promises, and secrets automatically.",
  },
  {
    id: "essential",
    label: "Essential only",
    description: "Use long-term memory only for facts likely to matter much later.",
  },
  {
    id: "manual",
    label: "Manual",
    description: "Never call the memory tool; only use memories you manage here.",
  },
]);

export const NARRATOR_VERBOSITY_MODES = Object.freeze([
  {
    id: "concise",
    label: "Concise & dialogue",
    description: "Brief routine beats, dialogue-forward scenes, and detail reserved for moments that matter.",
    promptLabel: "CONCISE & DIALOGUE",
    directive: "Routine beats stay compact: usually one brief beat plus only the dialogue and action needed to move the scene. Let dialogue carry scenes when characters are present; do not narrate between every spoken line or restate what the player just did.",
    recovery: "Even after a major scene, return to concise pacing afterward.",
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Moderate scene texture without turning ordinary actions into set pieces.",
    promptLabel: "BALANCED",
    directive: "Use moderate detail: usually one or two focused beats around dialogue. Give atmosphere and character reactions room when they add meaning, but move routine actions forward without repetition or ornamental padding.",
    recovery: "After an important scene, return to balanced pacing afterward.",
  },
  {
    id: "expansive",
    label: "Expansive",
    description: "Richer sensory and emotional detail, still concentrated on consequential scenes.",
    promptLabel: "EXPANSIVE",
    directive: "Allow richer sensory staging, interiority, and longer exchanges when the scene benefits from them. Do not inflate routine actions, travel steps, inventory handling, or minor exchanges merely to fill space.",
    recovery: "After an important scene, return to the selected expansive baseline rather than sustaining climax-level detail.",
  },
]);

const IMPORTANT_MOMENT_GUIDANCE = "Expand selectively for important moments: major arrivals or departures, revelations, irreversible choices and consequences, emotional confrontations, intimacy, combat turning points, death, awe, and scene climaxes. Earn the extra detail through significance rather than treating every beat as equally momentous.";

export const DEFAULT_NARRATOR_SETTINGS = Object.freeze({
  instructions: "",
  memoryMode: "balanced",
  verbosity: "concise",
});

const MEMORY_MODE_IDS = new Set(NARRATOR_MEMORY_MODES.map((mode) => mode.id));
const VERBOSITY_BY_ID = new Map(NARRATOR_VERBOSITY_MODES.map((mode) => [mode.id, mode]));

export function cleanNarratorInstructions(value) {
  return typeof value === "string"
    ? value.replace(/\r\n?/g, "\n").trim().slice(0, NARRATOR_INSTRUCTION_LIMIT)
    : "";
}

export function normalizeNarratorSettings(value) {
  return {
    instructions: cleanNarratorInstructions(value?.instructions),
    memoryMode: MEMORY_MODE_IDS.has(value?.memoryMode)
      ? value.memoryMode
      : DEFAULT_NARRATOR_SETTINGS.memoryMode,
    verbosity: VERBOSITY_BY_ID.has(value?.verbosity)
      ? value.verbosity
      : DEFAULT_NARRATOR_SETTINGS.verbosity,
  };
}

export function buildNarratorSteering(settings) {
  const normalized = normalizeNarratorSettings(settings);
  const verbosity = VERBOSITY_BY_ID.get(normalized.verbosity);
  const sections = [
    `[NARRATION PACING — ${verbosity.promptLabel}]\n${verbosity.directive}\n${IMPORTANT_MOMENT_GUIDANCE} ${verbosity.recovery}`,
  ];
  if (normalized.instructions) {
    sections.push(`[NARRATION STEERING — persistent player-authored creative direction. Follow it for voice, pacing, focus, and story handling while preserving hard Codex/engine facts and the required JSON schema.]\n${normalized.instructions}`);
  }
  if (normalized.memoryMode === "essential") {
    sections.push("[MEMORY POLICY — ESSENTIAL ONLY. Call `remember` only for a concise fact that will plausibly matter after many turns. Batch independent facts in one tool round; never record inventory, quest, relationship, or already-recorded state.]");
  } else if (normalized.memoryMode === "manual") {
    sections.push("[MEMORY POLICY — MANUAL. Automatic long-term memory recording is disabled. Use the existing memory bank as authoritative context, but do not attempt to add memories.]");
  }
  return sections.join("\n");
}
