import { SYSTEM_PROMPT } from "../system-prompt.js";
import { buildStateContext } from "../engine/api.js";
import { prepareNarratorHistory } from "../engine/narrator-history.js";
import { narratorMessageForPendingPlayers } from "../engine/timeline.js";
import { NARRATOR_SKILLS } from "../narrator-instructions.js";

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

function toolContext(state) {
  const tools = [{
    name: "load_narrator_skills",
    description: "Load detailed rules only when a specialized turn needs them.",
    allowed_skill_ids: NARRATOR_SKILLS.map(({ id }) => id),
  }];
  if (state?.narratorSettings?.memoryMode !== "manual") {
    tools.push({
      name: "remember",
      description: "Record a durable plot fact that must survive the rolling story window.",
    });
  }
  return JSON.stringify(tools);
}

function nextAction(state, draft) {
  if (!state) return "";
  const content = typeof draft === "string" ? draft.trim() : "";
  if (!content) return narratorMessageForPendingPlayers(state);
  return narratorMessageForPendingPlayers({
    ...state,
    beats: [...(state.beats || []), { type: "player", content }],
  });
}

export function buildChatContextSections({ state, draft = "" } = {}) {
  const stateContext = safeStateContext(state);
  const preparedHistory = JSON.stringify(prepareNarratorHistory(state?.apiHistory));

  const sections = [
    {
      id: "system",
      label: "CORE PROMPT",
      color: "#b667d8",
      description: "Compact rules sent on every narrator request",
      content: SYSTEM_PROMPT,
    },
    {
      id: "tools",
      label: "TOOLS & SKILL INDEX",
      color: "#3f9fd1",
      description: "Function contracts and the lightweight on-demand skill catalog",
      content: toolContext(state),
    },
    {
      id: "game",
      label: "GAME CONTEXT",
      color: "#36b985",
      description: "Current character, place, inventory, codex, memories, and authored world state",
      content: stateContext,
    },
    {
      id: "history",
      label: "RECENT STORY",
      color: "#d45b72",
      description: "The same bounded history prepared for the provider",
      content: preparedHistory,
    },
    {
      id: "action",
      label: "NEXT ACTION",
      color: "#a9a49a",
      description: draft?.trim()
        ? "Projected request if the current draft is queued"
        : "Exact pending or continue-story message for the next run",
      content: nextAction(state, draft),
    },
  ].map((section) => ({
    ...section,
    tokens: estimateTokens(section.content),
  }));

  const total = sections.reduce((sum, section) => sum + section.tokens, 0);
  const availableSkills = NARRATOR_SKILLS.map(({ id, label, trigger, content }) => ({
    id,
    label,
    trigger,
    tokens: estimateTokens(content),
  }));
  return {
    total,
    deferredTokens: availableSkills.reduce((sum, skill) => sum + skill.tokens, 0),
    availableSkills,
    sections: sections.map((section) => ({
      ...section,
      percent: total ? Math.round((section.tokens / total) * 1000) / 10 : 0,
    })),
  };
}
