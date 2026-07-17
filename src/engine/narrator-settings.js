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

export const DEFAULT_NARRATOR_SETTINGS = Object.freeze({
  instructions: "",
  memoryMode: "balanced",
});

const MEMORY_MODE_IDS = new Set(NARRATOR_MEMORY_MODES.map((mode) => mode.id));

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
  };
}

export function buildNarratorSteering(settings) {
  const normalized = normalizeNarratorSettings(settings);
  const sections = [];
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
