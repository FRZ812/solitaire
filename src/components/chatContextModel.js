import { SYSTEM_PROMPT } from "../system-prompt.js";
import { buildStateContext } from "../engine/api.js";

const TOKEN_CHARS = 4;

export function estimateTokens(value) {
  if (value == null || value === "") return 0;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text ? Math.max(1, Math.ceil(text.length / TOKEN_CHARS)) : 0;
}

export function formatTokenCount(value) {
  const tokens = Math.max(0, Math.round(Number(value) || 0));
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return String(tokens);
}

function safeStateContext(state) {
  try {
    return state ? buildStateContext(state) : "";
  } catch {
    return "";
  }
}

function beatText(beats) {
  return (Array.isArray(beats) ? beats : []).map((beat) => {
    if (!beat) return "";
    if (beat.type === "dialogue") return `${beat.name || "Speaking"}: ${beat.line || ""}`;
    if (Array.isArray(beat.lines)) return beat.lines.join("\n");
    return beat.content || beat.text || "";
  }).filter(Boolean).join("\n\n");
}

export function buildChatContextSections({ state, beats = [], history = [] } = {}) {
  const stateContext = safeStateContext(state);
  const conversation = [
    ...(Array.isArray(history) ? history : []).map((entry) => `${entry?.role || "message"}: ${entry?.content || ""}`),
    beatText(beats),
  ].filter(Boolean).join("\n\n");
  const instructions = [
    state?.narratorSettings?.instructions,
    ...(Array.isArray(state?.memories) ? state.memories : []),
  ].filter(Boolean).join("\n");
  const stateTail = state ? {
    time: state.time,
    currentTile: state.world?.currentTile,
    party: state.party,
    pendingChoices: state.pendingProgression,
  } : null;

  const sections = [
    {
      id: "system-prompt",
      label: "SYSTEM PROMPT",
      color: "#c93e70",
      description: "Narrator rules and world contracts",
      content: SYSTEM_PROMPT,
    },
    {
      id: "game-context",
      label: "GAME CONTEXT",
      color: "#14a6df",
      description: "Current place, character, codex, and authored world context",
      content: stateContext,
    },
    {
      id: "conversation",
      label: `CONVERSATION (${Array.isArray(beats) ? beats.length : 0} MESSAGES)`,
      color: "#d64e72",
      description: "Recent player and narrator turns",
      content: conversation,
    },
    {
      id: "instructions",
      label: "INSTRUCTIONS",
      color: "#bd79df",
      description: "Campaign direction and durable memories",
      content: instructions,
    },
    {
      id: "game-state",
      label: "GAME STATE (PER-TURN TAIL)",
      color: "#8f928d",
      description: "Small live-state slice used for this preview",
      content: JSON.stringify(stateTail),
    },
  ].map((section) => ({
    ...section,
    tokens: estimateTokens(section.content),
  }));

  const total = sections.reduce((sum, section) => sum + section.tokens, 0);
  return {
    total,
    sections: sections.map((section) => ({
      ...section,
      percent: total ? Math.round((section.tokens / total) * 1000) / 10 : 0,
    })),
  };
}
