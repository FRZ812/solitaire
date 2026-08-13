import { SYSTEM_PROMPT } from "../system-prompt.js";
import { buildStateContext } from "../engine/api.js";
import { selectStateContext } from "../engine/narrator/context-sections.js";
import { prepareNarratorHistory } from "../engine/narrator-history.js";
import { normalizeNarratorSettings } from "../engine/narrator-settings.js";
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

// The preview has to show what is actually sent, so it selects the same way the request
// does. A preview that rendered the unselected block would be reassuring and wrong.
function safeStateContext(state) {
  try {
    return state ? selectStateContext(buildStateContext(state)).text : "";
  } catch {
    return "";
  }
}

const MEMORY_TOOL_DESCRIPTION = "Permanently record a durable fact worth recalling long after this turn scrolls out of the conversation window — a promise made, a secret learned, an unresolved thread, a plot-critical detail. Call this whenever something happens that the story will need much later. Keep the fact short, self-contained, and in third person. Don't call it for anything trivial, already recorded, or already tracked elsewhere (inventory, quests, relationships).";

function narratorToolSchemas(state) {
  const tools = [{
    type: "function",
    function: {
      name: "load_narrator_skills",
      description: "Load detailed narrator rules before deciding a specialized turn. Use the skill catalog in the system prompt, request all relevant ids together, and load only what this turn needs.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          skill_ids: {
            type: "array",
            minItems: 1,
            maxItems: 4,
            uniqueItems: true,
            items: { type: "string", enum: NARRATOR_SKILLS.map(({ id }) => id) },
            description: "Detailed rule modules needed for this turn.",
          },
        },
        required: ["skill_ids"],
      },
    },
  }];
  const { memoryMode } = normalizeNarratorSettings(state?.narratorSettings);
  if (memoryMode !== "manual") {
    tools.push({
      type: "function",
      function: {
        name: "remember",
        description: memoryMode === "essential"
          ? `${MEMORY_TOOL_DESCRIPTION} ESSENTIAL-ONLY mode is active: use this only for a fact likely to matter many turns from now, and batch independent facts in parallel.`
          : MEMORY_TOOL_DESCRIPTION,
        parameters: {
          type: "object",
          properties: {
            fact: {
              type: "string",
              description: "A concise, self-contained statement of the fact to remember (one or two sentences).",
            },
          },
          required: ["fact"],
        },
      },
    });
  }
  return tools;
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
  const preparedHistory = prepareNarratorHistory(state?.apiHistory);

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
      label: "TOOL INTERFACES",
      color: "#3f9fd1",
      description: "Exact function schemas sent with the initial provider request; full skill modules are not included",
      content: JSON.stringify(narratorToolSchemas(state)),
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
      content: preparedHistory.length ? JSON.stringify(preparedHistory) : "",
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
