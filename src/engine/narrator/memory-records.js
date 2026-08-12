// Memory the model proposes and the engine owns.
//
// Today a memory is a string in a flat list. That has three consequences worth naming. It
// grows forever, because nothing can recognise that a new memory is about the same thing as
// an old one. It cannot be retrieved by relevance, because a string is not about anyone. And
// everything in it is equally true, because there is nowhere to record that "Hale believes
// the player burned the bridge" is a person's belief rather than a fact about the world.
//
// The split here is between what the model may propose and what the engine decides:
//
//   MemoryDeltaProposal — bounded, typed, about named subjects, citing evidence. This is all
//                         the model gets to say.
//   NarratorMemory      — the record. Its id, salience, status, pinning and revisions are
//                         minted here and are not proposable, because a model that can set
//                         its own salience can make anything the most important thing it
//                         knows, and one that can set `pinned` can make it permanent.
//
// The distinction that matters most is truth. A belief or a grudge is explicitly a
// character's perspective; only an event carrying an authoritative receipt is allowed to
// read as something that actually happened. Without that line, a narrator's guess about
// someone's motives comes back on the next turn as established fact and is never questioned
// again.

import { cleanMemoryText } from "../memory.js";

export const NARRATOR_MEMORY_VERSION = 2;

export const MEMORY_KINDS = Object.freeze([
  "person",
  "place",
  "promise",
  "grudge",
  "belief",
  "relationship",
  "event",
]);

/** Kinds that are one character's view of things rather than a claim about the world. */
export const PERSPECTIVE_KINDS = Object.freeze(["belief", "grudge"]);

/** Kinds that must cite evidence from an accepted turn involving their subjects. */
export const EVIDENCE_REQUIRED_KINDS = Object.freeze(["promise", "relationship", "event"]);

export const EVIDENCE_KINDS = Object.freeze([
  "turn",
  "dialogue",
  "receipt",
  "legacy-canonical",
]);

export const MEMORY_STATUSES = Object.freeze(["active", "resolved", "superseded"]);

export const MAX_MEMORY_TEXT = 600;

/** A route with no policy may write nothing: silence is the safe default for a side channel. */
export const NO_MEMORY_POLICY = Object.freeze({
  allowedKinds: Object.freeze([]),
  allowedSubjectIds: null,
  allowedEvidenceKinds: Object.freeze([]),
  maxWrites: 0,
});

/**
 * What a normal story turn may record.
 *
 * `allowedSubjectIds: null` means any known subject; a specialized route narrows it to the
 * person the engine issued, which is what stops a negotiation about one character quietly
 * filing memories about another.
 */
export const DEFAULT_MEMORY_POLICY = Object.freeze({
  allowedKinds: MEMORY_KINDS,
  allowedSubjectIds: null,
  allowedEvidenceKinds: Object.freeze(["turn", "dialogue", "receipt"]),
  maxWrites: 4,
});

function refuse(reason, detail = {}) {
  return { ok: false, reason, ...detail };
}

function isId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 128;
}

/**
 * Check one proposal against a route's policy.
 *
 * Every refusal names what was wrong rather than dropping the proposal, because a memory
 * that silently failed to save is indistinguishable from one the narrator never made — and
 * the next turn will not know to try again.
 */
export function validateMemoryProposal(proposal, policy = DEFAULT_MEMORY_POLICY, context = {}) {
  if (!proposal || typeof proposal !== "object") return refuse("proposal-not-an-object");
  if (!MEMORY_KINDS.includes(proposal.kind)) return refuse("unknown-memory-kind");
  if (!policy.allowedKinds.includes(proposal.kind)) {
    return refuse("kind-not-allowed-on-route", { kind: proposal.kind });
  }

  // Length is checked against the raw proposal, before cleaning. `cleanMemoryText` truncates
  // to fit, and a truncated memory is the same failure as a truncated context record: half a
  // sentence about what someone promised reads as a whole sentence about something else.
  // Refusing sends the narrator back to say it shorter.
  if (typeof proposal.text === "string" && proposal.text.length > MAX_MEMORY_TEXT) {
    return refuse("memory-text-too-long", { chars: proposal.text.length, limit: MAX_MEMORY_TEXT });
  }
  const text = cleanMemoryText(proposal.text);
  if (!text) return refuse("empty-memory-text");

  const subjectIds = (proposal.subjectIds || []).filter(isId);
  if (subjectIds.length === 0) return refuse("memory-about-nobody");
  if (policy.allowedSubjectIds) {
    const allowed = new Set(policy.allowedSubjectIds);
    const stray = subjectIds.filter((id) => !allowed.has(id));
    if (stray.length > 0) return refuse("subject-not-allowed-on-route", { stray });
  }
  // A subject the world has never heard of is how a hallucinated person acquires a history.
  if (context.knownSubjectIds) {
    const known = new Set(context.knownSubjectIds);
    const strangers = subjectIds.filter((id) => !known.has(id));
    if (strangers.length > 0) return refuse("memory-about-a-stranger", { strangers });
  }

  const evidence = (proposal.evidenceRefs || []).filter((ref) => isId(ref?.id ?? ref));
  if (EVIDENCE_REQUIRED_KINDS.includes(proposal.kind) && evidence.length === 0) {
    // A promise nobody can point at is a promise the narrator invented this turn.
    return refuse("memory-without-evidence", { kind: proposal.kind });
  }
  const evidenceKinds = evidence.map((ref) => ref?.kind ?? "turn");
  const disallowed = evidenceKinds.filter((kind) => !policy.allowedEvidenceKinds.includes(kind));
  if (disallowed.length > 0) return refuse("evidence-kind-not-allowed", { disallowed });

  // An event is the only kind that reads as something that happened, so it is the only kind
  // that has to be anchored to a receipt the engine issued.
  if (proposal.kind === "event" && !evidence.some((ref) => (ref?.kind ?? "turn") === "receipt")) {
    return refuse("canonical-event-without-receipt");
  }

  return {
    ok: true,
    reason: null,
    proposal: {
      kind: proposal.kind,
      subjectIds,
      scopeIds: (proposal.scopeIds || ["campaign"]).filter(isId),
      text,
      evidence: evidence.map((ref) => (
        typeof ref === "string" ? { kind: "turn", id: ref } : { kind: ref.kind ?? "turn", id: ref.id }
      )),
    },
  };
}

/**
 * How much a memory should weigh, decided here rather than proposed.
 *
 * Anchored evidence outweighs assertion, a promise outweighs an observation, and a
 * perspective is worth less than a fact precisely because it is one person's. A model
 * allowed to set this could make its own guesses the loudest thing in its context.
 */
export function deriveSalience(proposal) {
  let salience = 40;
  if (EVIDENCE_REQUIRED_KINDS.includes(proposal.kind)) salience += 20;
  if (proposal.evidence.some((ref) => ref.kind === "receipt")) salience += 25;
  if (PERSPECTIVE_KINDS.includes(proposal.kind)) salience -= 15;
  salience += Math.min(10, proposal.subjectIds.length * 5);
  return Math.max(0, Math.min(100, salience));
}

/**
 * The key two memories have to share to be the same memory.
 *
 * Kind plus subjects: "what sort of thing this is, about whom". Text is deliberately not
 * part of it, because the whole point of deduplication is to recognise that a rephrasing of
 * an existing memory is not a new one.
 */
export function memoryKey(record) {
  return `${record.kind}:${[...record.subjectIds].sort().join(",")}`;
}

/**
 * Mint the engine-owned record.
 *
 * Everything the model does not get to choose is set here: the id, when it was made, how
 * much it weighs, whether it is pinned, and whether it is still live.
 */
export function mintMemory(proposal, { revision = 0, sourceReceiptId = null, sequence = 0 } = {}) {
  return Object.freeze({
    version: NARRATOR_MEMORY_VERSION,
    id: `mem-${revision}-${sequence}-${memoryKey(proposal).replace(/[^a-z0-9]+/gi, "-")}`.slice(0, 128),
    kind: proposal.kind,
    subjectIds: Object.freeze([...proposal.subjectIds]),
    scopeIds: Object.freeze([...proposal.scopeIds]),
    summary: proposal.text,
    evidence: Object.freeze(proposal.evidence.map((ref) => Object.freeze({ ...ref }))),
    salience: deriveSalience(proposal),
    status: "active",
    pinned: false,
    sourceReceiptId,
    createdStateRevision: revision,
    updatedStateRevision: revision,
  });
}

/**
 * Fold a new record into the bank.
 *
 * A matching memory is superseded rather than appended, and the replacement inherits its
 * creation revision and pinning — so a memory the player pinned stays pinned when the
 * narrator restates it, and the bank records when something was first known rather than
 * when it was last mentioned. A flat list that only grows is how a bank ends up with nine
 * near-identical sentences about the same grudge.
 */
export function foldMemory(bank, record) {
  const key = memoryKey(record);
  const existing = (bank || []).find((entry) => memoryKey(entry) === key && entry.status === "active");
  if (!existing) return { bank: [...(bank || []), record], superseded: null };

  const merged = Object.freeze({
    ...record,
    id: existing.id,
    pinned: existing.pinned,
    createdStateRevision: existing.createdStateRevision,
    // Reinforcement: a fact restated with better evidence keeps the better of the two.
    salience: Math.max(existing.salience, record.salience),
  });
  return {
    bank: (bank || []).map((entry) => (entry === existing ? merged : entry)),
    superseded: existing.id,
  };
}

/**
 * Accept a turn's proposals in one step.
 *
 * Nothing is written unless the whole turn was accepted — the caller only reaches here with
 * a candidate that passed — and the per-route write cap is applied before minting, so a turn
 * proposing twenty memories records the first few and reports the rest rather than quietly
 * keeping whichever happened to validate.
 */
export function acceptMemoryProposals(bank, proposals, {
  policy = DEFAULT_MEMORY_POLICY,
  revision = 0,
  sourceReceiptId = null,
  knownSubjectIds = null,
} = {}) {
  const accepted = [];
  const refused = [];
  let next = bank || [];

  for (const proposal of proposals || []) {
    if (accepted.length >= policy.maxWrites) {
      refused.push({ reason: "memory-write-limit", proposal });
      continue;
    }
    const checked = validateMemoryProposal(proposal, policy, { knownSubjectIds });
    if (!checked.ok) {
      refused.push({ reason: checked.reason, proposal });
      continue;
    }
    const record = mintMemory(checked.proposal, {
      revision,
      sourceReceiptId,
      sequence: accepted.length,
    });
    const folded = foldMemory(next, record);
    next = folded.bank;
    accepted.push({ record, superseded: folded.superseded });
  }

  return { bank: next, accepted, refused };
}

/**
 * Bring old string memories into the typed bank without overstating them.
 *
 * They become events scoped to the campaign, with evidence marked `legacy-canonical` — which
 * says exactly what is true of them: they were trusted before there was a way to check, and
 * that is different from having been checked.
 */
export function migrateLegacyMemories(memories, { revision = 0 } = {}) {
  return (memories || [])
    .map((entry) => cleanMemoryText(entry))
    .filter(Boolean)
    .map((text, index) => Object.freeze({
      version: NARRATOR_MEMORY_VERSION,
      id: `mem-legacy-${index}`,
      kind: "event",
      subjectIds: Object.freeze(["campaign"]),
      scopeIds: Object.freeze(["campaign"]),
      summary: text,
      evidence: Object.freeze([Object.freeze({ kind: "legacy-canonical", id: `legacy-${index}` })]),
      salience: 50,
      status: "active",
      pinned: false,
      sourceReceiptId: null,
      createdStateRevision: revision,
      updatedStateRevision: revision,
    }));
}

/**
 * What to show, for a turn that is about particular people in a particular place.
 *
 * Ranked on the same principle as context selection: what this turn is about first, then how
 * much it weighs, then how recent it is. Resolved and superseded memories are left out —
 * they are kept for history, not for prompting.
 */
export function retrieveMemories(bank, {
  subjectIds = [],
  scopeIds = [],
  revision = 0,
  limit = 12,
} = {}) {
  const subjects = new Set(subjectIds);
  const scopes = new Set(scopeIds);
  return (bank || [])
    .filter((entry) => entry.status === "active")
    .map((entry) => {
      let score = entry.salience;
      if (entry.subjectIds.some((id) => subjects.has(id))) score += 1000;
      if (entry.scopeIds.some((id) => scopes.has(id))) score += 100;
      if (entry.pinned) score += 500;
      score += Math.max(0, 20 - (revision - entry.updatedStateRevision));
      return { entry, score };
    })
    .sort((first, second) => second.score - first.score || first.entry.id.localeCompare(second.entry.id))
    .slice(0, limit)
    .map(({ entry }) => entry);
}
