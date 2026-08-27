// The memory wire, in one place so it can be tested.
//
// The Edge entry point is a Deno server: importing it runs it. Everything about how a
// remembered fact is described, validated, projected and streamed lives here instead — the
// same reason routing and the instruction tools have their own modules. The parts worth
// testing should not require standing up a server to reach.
//
// What changed here is the shape of a memory. It used to be a bare string: `{fact}` in,
// `{fact}` out. A string is not about anyone, so nothing downstream could recall it when the
// person it concerned walked back into the room, recognise that a rephrasing was the same
// memory, or tell a character's belief apart from something that actually happened.
//
// So the tool takes a typed proposal, and the line that matters most is truth. A belief or a
// grudge is explicitly one character's view and rests on nothing. An event claims something
// happened, so it has to name the receipt it happened in — otherwise a narrator's guess about
// someone's motives returns next turn as established fact and is never questioned again.

export const MAX_MEMORY_FACT_LENGTH = 600;
export const MAX_MEMORY_SUBJECTS = 8;
export const MAX_MEMORY_EVIDENCE = 8;

export const MEMORY_KINDS = [
  "person",
  "place",
  "promise",
  "grudge",
  "belief",
  "relationship",
  "event",
] as const;

export const MEMORY_EVIDENCE_KINDS = ["turn", "dialogue", "receipt"] as const;

/** Kinds that must point at something outside their own assertion. */
const EVIDENCE_REQUIRED = new Set(["promise", "relationship", "event"]);

/** The exact wire vocabulary. Anything else is an older shape leaking back in. */
const MEMORY_PROPOSAL_KEYS = new Set([
  "kind",
  "subject_ids",
  "scope_ids",
  "text",
  "evidence_refs",
]);

export function normalizeMemoryFact(value: unknown) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, MAX_MEMORY_FACT_LENGTH)
    : "";
}

export function memoryFingerprint(value: unknown) {
  return normalizeMemoryFact(value).normalize("NFKC").toLocaleLowerCase().replace(/[.!?]+$/g, "");
}

function boundedIdList(value: unknown, limit: number) {
  if (!Array.isArray(value) || value.length > limit) return null;
  const ids: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") return null;
    const id = entry.trim();
    if (!id || id.length > 128) return null;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * Read the tool's arguments as a typed proposal, or say why not.
 *
 * Keys are checked rather than coerced: a stray `fact` or `content` is a previous vocabulary
 * arriving late, and accepting it quietly is how two shapes end up on one wire with nobody
 * sure which is authoritative. The projection to camelCase happens here and only here, so
 * the browser never has to know the wire's spelling.
 *
 * Every refusal is a sentence the model reads back as its tool result. "Invalid" teaches it
 * nothing; naming the field it got wrong lets it fix the call on the next round.
 */
export function asMemoryProposal(
  raw: unknown,
): { proposal?: Record<string, unknown>; error?: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "ignored: arguments were not an object" };
  }

  const stray = Object.keys(raw).filter((key) => !MEMORY_PROPOSAL_KEYS.has(key));
  if (stray.length > 0) {
    return {
      error: `ignored: unknown field ${stray[0]}; use kind, subject_ids, scope_ids, text, evidence_refs`,
    };
  }

  const source = raw as Record<string, unknown>;
  const kind = typeof source.kind === "string" ? source.kind : "";
  if (!(MEMORY_KINDS as readonly string[]).includes(kind)) {
    return { error: `ignored: kind must be one of ${MEMORY_KINDS.join(", ")}` };
  }

  const text = normalizeMemoryFact(source.text);
  if (!text) return { error: "ignored: no text given" };

  const subjectIds = boundedIdList(source.subject_ids, MAX_MEMORY_SUBJECTS);
  if (!subjectIds || subjectIds.length === 0) {
    return { error: "ignored: subject_ids must name at least one person or place" };
  }

  const scopeIds = source.scope_ids === undefined
    ? ["campaign"]
    : boundedIdList(source.scope_ids, MAX_MEMORY_SUBJECTS);
  if (!scopeIds) return { error: "ignored: scope_ids must be a list of ids" };

  const rawEvidence = source.evidence_refs === undefined ? [] : source.evidence_refs;
  if (!Array.isArray(rawEvidence) || rawEvidence.length > MAX_MEMORY_EVIDENCE) {
    return { error: "ignored: evidence_refs must be a short list" };
  }
  const evidence: Array<{ kind: string; id: string }> = [];
  for (const entry of rawEvidence) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return { error: "ignored: each evidence ref needs a kind and an id" };
    }
    const ref = entry as { kind?: unknown; id?: unknown };
    if (!(MEMORY_EVIDENCE_KINDS as readonly string[]).includes(ref.kind as string)) {
      return {
        error: `ignored: evidence kind must be one of ${MEMORY_EVIDENCE_KINDS.join(", ")}`,
      };
    }
    if (typeof ref.id !== "string" || !ref.id.trim() || ref.id.length > 128) {
      return { error: "ignored: evidence id must be a short string" };
    }
    evidence.push({ kind: ref.kind as string, id: ref.id.trim() });
  }

  // An event is the only kind that reads as something that happened, so it is the only kind
  // anchored to a receipt the engine issued.
  if (kind === "event" && !evidence.some((ref) => ref.kind === "receipt")) {
    return { error: "ignored: an event must cite a receipt in evidence_refs" };
  }
  if (EVIDENCE_REQUIRED.has(kind) && evidence.length === 0) {
    return { error: `ignored: a ${kind} must cite the turn it was made in` };
  }

  return { proposal: { kind, subjectIds, scopeIds, text, evidence } };
}

export const MEMORY_TOOL = {
  type: "function",
  function: {
    name: "remember",
    description: "Permanently record a durable fact worth recalling long after this turn scrolls out of the conversation window — a promise made, a secret learned, an unresolved thread, a plot-critical detail. Call this whenever something happens that the story will need much later. Keep it short, self-contained, and in third person. Say who it is about with subject_ids, so it can be recalled when they next appear. Don't call it for anything trivial, already recorded, or already tracked elsewhere (inventory, quests, relationships).",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        kind: {
          type: "string",
          enum: [...MEMORY_KINDS],
          description: "What sort of memory this is. Use belief or grudge for a character's own view of things; use event only for something that actually happened, and cite the receipt for it.",
        },
        subject_ids: {
          type: "array",
          minItems: 1,
          maxItems: MAX_MEMORY_SUBJECTS,
          uniqueItems: true,
          items: { type: "string" },
          description: "The ids of the people or places this is about. A memory about nobody cannot be recalled when it matters.",
        },
        scope_ids: {
          type: "array",
          maxItems: MAX_MEMORY_SUBJECTS,
          uniqueItems: true,
          items: { type: "string" },
          description: "Where this holds. Defaults to the whole campaign.",
        },
        text: {
          type: "string",
          description: "A concise, self-contained statement of the fact to remember (one or two sentences).",
        },
        evidence_refs: {
          type: "array",
          maxItems: MAX_MEMORY_EVIDENCE,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              kind: { type: "string", enum: [...MEMORY_EVIDENCE_KINDS] },
              id: { type: "string" },
            },
            required: ["kind", "id"],
          },
          description: "What this rests on. Required for a promise, a relationship, or an event.",
        },
      },
      required: ["kind", "subject_ids", "text"],
    },
  },
};

/**
 * The event a recorded memory streams as.
 *
 * `fact` rides alongside the typed proposal for the length of a server-first rollout: the
 * Edge deploys before the clients do, and an older client reads only `fact`. It is the
 * proposal's own text, so the two can never disagree, and it is the field to delete once no
 * old client remains.
 */
export function toMemoryEvent(proposal: Record<string, unknown>) {
  const body = { type: "memory_delta", fact: proposal.text, proposal };
  return `data: ${JSON.stringify(body)}\n\n`;
}
