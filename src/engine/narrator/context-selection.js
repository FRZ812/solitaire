// Choosing what the narrator gets to see.
//
// Context has been one block: everything the engine knew, appended to every request, on
// every route. That has two costs and they pull in opposite directions. It is enormous, so
// the things that actually matter to this turn are buried among the things that do not; and
// it is fixed, so a scene about one person in one room arrives with the same undifferentiated
// wall as a march across a continent.
//
// The fix is not summarisation — a summary is a lossy rewrite nobody can audit. It is
// selection: bounded factual records, ranked against what this turn is actually about, and
// packed whole into a budget.
//
// Two rules make this safe rather than merely smaller.
//
// **Selection is not authority.** The compiler's projection — valid entity ids, permission
// facts, funds, party membership, the state revision — is a separate object and is never
// budgeted. Trimming it would not save tokens the model reads; it would weaken the gate that
// decides which of the model's claims are allowed. What is budgeted here is only the
// *prose-facing* material: things it is useful for the narrator to know, none of which grant
// it permission to do anything.
//
// **Records are packed whole or not at all.** A record truncated mid-fact is worse than an
// absent one, because half a sentence about someone's death reads as a complete sentence
// about something else. Anything that does not fit is dropped, and the count is recorded.

export const NARRATOR_CONTEXT_VERSION = 1;

export const CONTEXT_TYPES = Object.freeze([
  "player",
  "place",
  "person",
  "quest",
  "condition",
  "memory",
  "chronicle",
  "world-fact",
]);

/**
 * Records that are never ranked and never dropped.
 *
 * Not a priority tier — a separate class. Who the player is, where they are, when it is, and
 * which route this is are the frame every other record is read against; a scene missing them
 * is not a leaner scene, it is an incoherent one.
 */
export const ALWAYS_INCLUDED_TYPES = Object.freeze(["player", "place"]);

/** Rank contributions, highest first. Exact matches beat topical ones, deliberately. */
export const RANK_WEIGHTS = Object.freeze({
  /** This record is about someone or something the turn explicitly names. */
  subjectMatch: 1000,
  /** This record's own tags include the active route. */
  routeMatch: 250,
  /** The record's authored importance, 0..100. */
  priority: 1,
  /** Newer facts edge out older ones at equal relevance. */
  recency: 10,
});

function boundedText(value, limit = 2_000) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > limit ? text.slice(0, limit) : text;
}

/**
 * Build one candidate record.
 *
 * `chars` is measured here rather than trusted from the caller, because the budget is only
 * meaningful if the number it packs against is the number that will actually be sent.
 */
export function contextRecord({
  id,
  type,
  text,
  subjectIds = [],
  routeTags = [],
  priority = 0,
  sourceRevision = 0,
}) {
  if (!id || !CONTEXT_TYPES.includes(type)) return null;
  const body = boundedText(text);
  if (!body) return null;
  return Object.freeze({
    version: NARRATOR_CONTEXT_VERSION,
    id,
    type,
    subjectIds: Object.freeze([...subjectIds].filter(Boolean)),
    routeTags: Object.freeze([...routeTags].filter(Boolean)),
    priority: Number.isFinite(priority) ? Math.max(0, Math.min(100, priority)) : 0,
    text: body,
    chars: body.length,
    sourceRevision: Number.isSafeInteger(sourceRevision) ? sourceRevision : 0,
  });
}

/**
 * How relevant this record is to this turn.
 *
 * Exact identity beats topic, and both beat authored importance. That order is the whole
 * ranking: a scene about Hale wants everything about Hale before it wants the most important
 * thing in the world, because the most important thing in the world is not in the room.
 */
export function scoreRecord(record, { subjectIds = [], route = null, revision = 0 } = {}) {
  const subjects = new Set(subjectIds);
  let score = 0;
  if (record.subjectIds.some((id) => subjects.has(id))) score += RANK_WEIGHTS.subjectMatch;
  if (route && record.routeTags.includes(route)) score += RANK_WEIGHTS.routeMatch;
  score += record.priority * RANK_WEIGHTS.priority;
  // Recency is bounded so an old but exactly-relevant fact still beats a new irrelevant one.
  const age = Math.max(0, revision - record.sourceRevision);
  score += Math.max(0, RANK_WEIGHTS.recency - age);
  return score;
}

/**
 * Rank and pack.
 *
 * Deterministic end to end: equal scores break on record id, so the same state and the same
 * turn always produce the same context. A selector that reordered under identical inputs
 * would make every narrator comparison meaningless — including the evaluation the plan wants
 * to run against it.
 *
 * @param {Array} candidates records from `buildNarratorContextCandidates`
 * @param {{budgetChars: number, route?: string, subjectIds?: string[], revision?: number}} options
 */
export function selectNarratorContext(candidates, {
  budgetChars = 12_000,
  route = null,
  subjectIds = [],
  revision = 0,
} = {}) {
  const valid = (candidates || []).filter(Boolean);
  const always = valid.filter((record) => ALWAYS_INCLUDED_TYPES.includes(record.type));
  const rankable = valid.filter((record) => !ALWAYS_INCLUDED_TYPES.includes(record.type));

  const scored = rankable
    .map((record) => ({ record, score: scoreRecord(record, { subjectIds, route, revision }) }))
    .sort((first, second) => (
      second.score - first.score || first.record.id.localeCompare(second.record.id)
    ));

  const selected = [...always];
  let used = always.reduce((total, record) => total + record.chars, 0);
  const dropped = [];

  for (const { record } of scored) {
    // Whole or not at all. Half a fact reads as a complete fact about something else.
    if (used + record.chars > budgetChars) {
      dropped.push(record);
      continue;
    }
    selected.push(record);
    used += record.chars;
  }

  return {
    version: NARRATOR_CONTEXT_VERSION,
    route,
    selected,
    // Diagnostics, because a context that silently lost the thing the turn was about is a
    // bug nobody can see from the prose it produced.
    selectedIds: selected.map((record) => record.id),
    droppedIds: dropped.map((record) => record.id),
    droppedCount: dropped.length,
    usedChars: used,
    budgetChars,
    // An always-included record that alone exceeds the budget is reported rather than cut:
    // the answer is a bigger budget or a smaller frame, not a severed sentence.
    overBudget: used > budgetChars,
  };
}

/** Render the selection for a prompt, in a stable order with its records intact. */
export function renderSelectedContext(selection) {
  return selection.selected
    .map((record) => `[${record.type.toUpperCase()}] ${record.text}`)
    .join("\n\n");
}

/**
 * Everything the turn is explicitly about.
 *
 * Drawn from what the engine already decided — the speakers it put in the room, the target
 * it issued for a specialized route — rather than from anything the narrator said. A model
 * that could nominate its own subjects could pull whatever context it liked into view.
 */
export function turnSubjectIds({ speakerIds = [], targetIds = [], playerId = null } = {}) {
  return [...new Set([playerId, ...speakerIds, ...targetIds].filter(Boolean))];
}
