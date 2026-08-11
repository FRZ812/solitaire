export const INSTRUCTION_TOOL_NAME = "load_narrator_skills";

const MAX_SKILLS = 16;
const MAX_SKILL_CONTENT_LENGTH = 50_000;
const MAX_LIBRARY_CONTENT_LENGTH = 180_000;
const MAX_SKILLS_PER_CALL = 4;
const SKILL_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type RawInstructionSkill = {
  id?: unknown;
  label?: unknown;
  trigger?: unknown;
  content?: unknown;
};

export type InstructionSkill = {
  id: string;
  label: string;
  trigger: string;
  content: string;
};

type NarratorToolCall = {
  id?: string;
  name?: string;
  arguments?: string;
};

function requiredText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`invalid narrator skill ${label}`);
  }
  if (value.length > maxLength) {
    throw new Error(`narrator skill ${label} is too large`);
  }
  return value.trim();
}

export function asInstructionLibrary(value: unknown): InstructionSkill[] {
  if (!Array.isArray(value) || value.length < 1) {
    throw new Error("invalid narrator skill library");
  }
  if (value.length > MAX_SKILLS) throw new Error("too many narrator skills");

  const seen = new Set<string>();
  let totalContentLength = 0;
  return value.map((rawValue) => {
    const raw = (rawValue || {}) as RawInstructionSkill;
    const id = requiredText(raw.id, "id", 64);
    if (!SKILL_ID.test(id)) throw new Error("invalid narrator skill id");
    if (seen.has(id)) throw new Error("duplicate narrator skill id");
    seen.add(id);

    const content = requiredText(raw.content, "content", MAX_SKILL_CONTENT_LENGTH);
    totalContentLength += content.length;
    if (totalContentLength > MAX_LIBRARY_CONTENT_LENGTH) {
      throw new Error("narrator skill library is too large");
    }

    return {
      id,
      label: requiredText(raw.label, "label", 120),
      trigger: requiredText(raw.trigger, "trigger", 600),
      content,
    };
  });
}

// Server-first rolling deployments must continue serving older clients, whose
// monolithic system prompt predates the separate narrator_skills field.
export function asOptionalInstructionLibrary(value: unknown): InstructionSkill[] {
  return value == null ? [] : asInstructionLibrary(value);
}

function asRouteSkillIds(value: unknown, label: string) {
  if (value == null) return null;
  if (!Array.isArray(value) || value.length > MAX_SKILLS) {
    throw new Error(`invalid ${label}`);
  }
  const ids = [...new Set(value.map((id) => (
    typeof id === "string" && SKILL_ID.test(id) ? id : ""
  )))];
  if (ids.includes("")) throw new Error(`invalid ${label}`);
  return ids;
}

function renderInstructionSkill(skill: InstructionSkill) {
  return `<narrator-skill id="${skill.id}">\n${skill.content}\n</narrator-skill>`;
}

export function prepareInstructionRouting(
  library: InstructionSkill[],
  allowedValue: unknown,
  requiredValue: unknown,
) {
  const byId = new Map(library.map((skill) => [skill.id, skill]));
  const allowedIds = asRouteSkillIds(allowedValue, "allowed narrator skills");
  const requiredIds = asRouteSkillIds(requiredValue, "required narrator skills") || [];
  const instructionLibrary = allowedIds == null
    ? library
    : allowedIds.map((id) => byId.get(id)).filter((skill): skill is InstructionSkill => !!skill);
  const allowedSet = new Set(instructionLibrary.map(({ id }) => id));
  const preloaded = requiredIds.map((id) => {
    const skill = byId.get(id);
    if (!skill || !allowedSet.has(id)) throw new Error("required narrator skill is unavailable");
    return skill;
  });
  return {
    instructionLibrary,
    preloadedSkillIds: preloaded.map(({ id }) => id),
    preloadedContent: preloaded.map(renderInstructionSkill).join("\n\n"),
  };
}

export function instructionToolFor(library: InstructionSkill[]) {
  return {
    type: "function",
    function: {
      name: INSTRUCTION_TOOL_NAME,
      description: "Load detailed narrator rules before deciding a specialized turn. Use the skill catalog in the system prompt, request all relevant ids together, and load only what this turn needs.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          skill_ids: {
            type: "array",
            minItems: 1,
            maxItems: MAX_SKILLS_PER_CALL,
            uniqueItems: true,
            items: {
              type: "string",
              enum: library.map((skill) => skill.id),
            },
            description: "Detailed rule modules needed for this turn.",
          },
        },
        required: ["skill_ids"],
      },
    },
  };
}

function parseSkillIds(rawArguments: string | undefined) {
  try {
    const parsed = JSON.parse(rawArguments || "{}");
    if (!Array.isArray(parsed?.skill_ids)) return [];
    return [...new Set(parsed.skill_ids.filter((id: unknown) => (
      typeof id === "string" && SKILL_ID.test(id)
    )))]
      .slice(0, MAX_SKILLS_PER_CALL) as string[];
  } catch {
    return [];
  }
}

export function resolveInstructionToolCall(
  toolCall: NarratorToolCall,
  library: InstructionSkill[],
  loadedSkillIds: Set<string>,
) {
  if (toolCall?.name !== INSTRUCTION_TOOL_NAME) {
    return { recognized: false, result: "Unsupported narrator tool." };
  }

  const requestedIds = parseSkillIds(toolCall.arguments);
  if (requestedIds.length === 0) {
    return {
      recognized: true,
      result: "No valid skill_ids were supplied. Call the tool again with one or more catalog ids.",
    };
  }

  const byId = new Map(library.map((skill) => [skill.id, skill]));
  const results: string[] = [];
  for (const id of requestedIds) {
    const skill = byId.get(id);
    if (!skill) {
      results.push(`Skill ${id} is unavailable.`);
      continue;
    }
    if (loadedSkillIds.has(id)) {
      results.push(`Skill ${id} was already loaded this turn; continue using the earlier result.`);
      continue;
    }
    loadedSkillIds.add(id);
    results.push(renderInstructionSkill(skill));
  }

  return {
    recognized: true,
    result: results.join("\n\n"),
  };
}
