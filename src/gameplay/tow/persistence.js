// The boundary a saved fight has to cross.
//
// Everything that reaches here came off disk or off the network, which means none of it can
// be trusted to be what it claims. A codec that accepts a plausible-looking session and
// lets the reducer find out later fails in the worst possible place: mid-fight, after the
// player has committed to it.
//
// So decoding is strict and fails closed. Every version, every key, every RNG state, every
// command in the log, and the checksum over all of it are checked before the session is
// handed back. A payload that fails is a recoverable objective error with a reason, never a
// half-loaded fight and never a silent reset to "no combat in progress" — that would look
// to the player exactly like the engine eating their encounter.
//
// The fingerprint is an integrity check, not a signature. It catches truncation, corruption
// and partial writes. It does not stop a determined player editing their own save, and
// nothing here pretends otherwise; if server-authoritative saves are ever needed that is a
// different architecture, not a bigger hash.

import { cloneJsonData } from "../kernel/json-data.js";
import { MAX_ENCOUNTER_EVENTS } from "./encounter.js";
import { TOW_COMMAND_TYPES } from "./commands.js";
import {
  MAX_TOW_COMMANDS,
  TOW_RULESET_ID,
  TOW_SESSION_VERSION,
  isTowSession,
  towSessionChecksum,
} from "./session.js";
import { TOW_COMBAT_STATES, TOW_WORLD_FATES } from "./outcomes.js";

/** A fight that has run this long is a loop, not a fight; pausing beats inventing a winner. */
export const MAX_TOW_ROUNDS = 2000;

const LEGACY_COMMAND_KEYS = Object.freeze([
  "actorId",
  "eventsFrom",
  "eventsTo",
  "expectedRevision",
  "id",
  "seq",
  "skillId",
  "stateChecksum",
  "streams",
  "targetId",
  "type",
].sort());
const COMMAND_KEYS = Object.freeze([...LEGACY_COMMAND_KEYS, "itemId"].sort());

const RECEIPT_KEYS = Object.freeze([
  "encounterChecksum",
  "eventCount",
  "loser",
  "participants",
  "playerWorldFate",
  "reason",
  "rounds",
  "rulesetId",
  "sessionId",
  "streamEndpoints",
  "version",
  "winner",
].sort());

const OUTCOME_KEYS = Object.freeze([
  "campaignEntityId",
  "combatState",
  "finalHp",
  "finalStatuses",
  "participantId",
  "sourceEventId",
  "terminalCause",
  "worldFate",
].sort());

function rejected(reason) {
  return { ok: false, reason, session: null };
}

function exactKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const own = Object.keys(value).sort();
  return own.length === keys.length && own.every((key, index) => key === keys[index]);
}

function isRngState(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value)
    && exactKeys(value, ["algorithm", "state"])
    && value.algorithm === "mulberry32"
    && Number.isInteger(value.state)
    && value.state >= 0
    && value.state <= 0xFFFFFFFF;
}

/**
 * The command log, checked as a sequence rather than a bag of records.
 *
 * Contiguity is the property that matters: every event in the encounter belongs to exactly
 * one command or to the opening, with no gaps and no overlaps. A gap would mean events
 * nobody asked for; an overlap would mean two commands claiming the same swing.
 */
function commandLogFailure(session) {
  const { commands, encounter } = session;
  const ids = new Set();
  let cursor = null;

  for (let index = 0; index < commands.length; index += 1) {
    const command = commands[index];
    if (!exactKeys(command, COMMAND_KEYS) && !exactKeys(command, LEGACY_COMMAND_KEYS)) {
      return "invalid-command-record";
    }
    if (typeof command.id !== "string" || command.id.length === 0) return "invalid-command-record";
    if (ids.has(command.id)) return "duplicate-command-id";
    ids.add(command.id);
    if (!TOW_COMMAND_TYPES.includes(command.type)) return "invalid-command-type";
    if (command.seq !== index) return "command-sequence-gap";
    // A command records the revision it was accepted against, and the revision is the count
    // of commands before it. Any other value means the log was reordered or spliced.
    if (command.expectedRevision !== index) return "command-revision-mismatch";
    if (command.actorId !== null && typeof command.actorId !== "string") return "invalid-command-record";
    if (command.itemId != null && typeof command.itemId !== "string") return "invalid-command-record";
    if (command.skillId !== null && typeof command.skillId !== "string") return "invalid-command-record";
    if (command.targetId !== null && typeof command.targetId !== "string") return "invalid-command-record";
    if (typeof command.stateChecksum !== "string") return "invalid-command-record";

    if (!Number.isSafeInteger(command.eventsFrom) || command.eventsFrom < 0) return "invalid-event-range";
    if (!Number.isSafeInteger(command.eventsTo) || command.eventsTo < command.eventsFrom) return "invalid-event-range";
    if (command.eventsTo > encounter.sequence) return "invalid-event-range";
    if (cursor !== null && command.eventsFrom !== cursor) return "event-range-discontinuity";
    cursor = command.eventsTo;

    if (!command.streams || typeof command.streams !== "object" || Array.isArray(command.streams)) {
      return "invalid-command-record";
    }
    for (const [name, endpoint] of Object.entries(command.streams)) {
      if (!["combat", "intent", "loot", "rewards"].includes(name)) return "unknown-command-stream";
      if (!isRngState(endpoint)) return "invalid-command-stream";
    }
  }

  // Every event after the last command's range would be an event no command produced.
  if (cursor !== null && cursor !== encounter.sequence) return "event-range-discontinuity";
  return null;
}

function receiptFailure(session) {
  const receipt = session.terminalReceipt;
  if (receipt === null) return null;
  if (!exactKeys(receipt, RECEIPT_KEYS)) return "invalid-terminal-receipt";
  if (receipt.sessionId !== session.sessionId) return "terminal-receipt-session-mismatch";
  if (receipt.rulesetId !== session.rulesetId) return "terminal-receipt-ruleset-mismatch";
  if (!["victory", "defeat", "retreated"].includes(receipt.reason)) return "invalid-terminal-receipt";
  if (receipt.reason !== session.encounter.phase) return "terminal-receipt-phase-mismatch";
  if (receipt.reason === "retreated" && (receipt.winner !== null || receipt.loser !== null)) {
    return "invalid-terminal-receipt";
  }
  if (!TOW_WORLD_FATES.includes(receipt.playerWorldFate)) return "invalid-terminal-receipt";
  if (!Array.isArray(receipt.participants) || receipt.participants.length === 0) {
    return "invalid-terminal-receipt";
  }

  const actorIds = new Set([
    session.encounter.playerId,
    ...(session.encounter.allyIds || []),
    ...session.encounter.enemyIds,
  ]);
  const seen = new Set();
  for (const outcome of receipt.participants) {
    if (!exactKeys(outcome, OUTCOME_KEYS)) return "invalid-participant-outcome";
    if (!actorIds.has(outcome.participantId)) return "unknown-participant-outcome";
    if (seen.has(outcome.participantId)) return "duplicate-participant-outcome";
    seen.add(outcome.participantId);
    if (!TOW_COMBAT_STATES.includes(outcome.combatState)) return "invalid-participant-outcome";
    if (!TOW_WORLD_FATES.includes(outcome.worldFate)) return "invalid-participant-outcome";
    if (!Number.isSafeInteger(outcome.finalHp) || outcome.finalHp < 0) return "invalid-participant-outcome";
    if (!Array.isArray(outcome.finalStatuses)) return "invalid-participant-outcome";
    // A living participant with a world fate of dead, or a corpse still standing, is the
    // exact confusion this receipt exists to prevent.
    if (outcome.combatState === "standing" && outcome.worldFate !== "alive") {
      return "contradictory-participant-outcome";
    }
    if (outcome.worldFate === "dead" && outcome.combatState !== "dead") {
      return "contradictory-participant-outcome";
    }
  }
  if (seen.size !== actorIds.size) return "incomplete-terminal-receipt";

  const playerOutcome = receipt.participants.find(
    (outcome) => outcome.participantId === session.encounter.playerId,
  );
  if (playerOutcome.worldFate !== receipt.playerWorldFate) return "terminal-receipt-fate-mismatch";
  // Permanent player death is only ever reachable from an admission that authorized it.
  // Checking it here as well as at resolution means a hand-edited save cannot introduce one.
  if (playerOutcome.worldFate === "dead" && session.context.playerStakes !== "lethal") {
    return "unauthorized-player-death";
  }

  if (!exactKeys(receipt.streamEndpoints, ["combat", "intent", "loot", "rewards"])) {
    return "invalid-terminal-receipt";
  }
  if (!Object.values(receipt.streamEndpoints).every(isRngState)) return "invalid-terminal-receipt";
  return null;
}

/**
 * Read a saved session back, or say exactly why it cannot be read.
 *
 * @returns {{ok: boolean, reason: string|null, session: object|null}}
 */
export function decodeTowSession(value) {
  let session;
  try {
    // Rejects prototype pollution, non-finite numbers, cycles, and anything past the depth
    // and size budgets — before a single field is interpreted.
    session = cloneJsonData(value, "invalid-tow-session-payload");
  } catch {
    return rejected("invalid-tow-session-payload");
  }

  if (session?.version !== TOW_SESSION_VERSION) return rejected("unsupported-tow-session-version");
  if (session?.rulesetId !== TOW_RULESET_ID) return rejected("unsupported-tow-ruleset");
  if (!isTowSession(session)) return rejected("invalid-tow-session");

  if (session.encounter.round > MAX_TOW_ROUNDS) return rejected("tow-round-limit-exceeded");
  if (session.encounter.events.length > MAX_ENCOUNTER_EVENTS) return rejected("tow-event-limit-exceeded");
  if (session.commands.length > MAX_TOW_COMMANDS) return rejected("tow-command-limit-exceeded");

  const logFailure = commandLogFailure(session);
  if (logFailure) return rejected(logFailure);

  const receiptProblem = receiptFailure(session);
  if (receiptProblem) return rejected(receiptProblem);

  if (towSessionChecksum(session) !== session.checksum) {
    return rejected("tow-session-checksum-mismatch");
  }
  return { ok: true, reason: null, session };
}

/**
 * Prepare a session for storage.
 *
 * Encoding validates too. A session that cannot be decoded must not be written in the first
 * place — the alternative is discovering it is unreadable on the next load, when the state
 * it was supposed to protect is already gone.
 */
export function encodeTowSession(session) {
  const verified = decodeTowSession(session);
  if (!verified.ok) return { ok: false, reason: verified.reason, payload: null };
  return { ok: true, reason: null, payload: verified.session };
}

/** Whether a stored payload is a readable session, without unpacking it into anything. */
export function isStoredTowSession(value) {
  return decodeTowSession(value).ok;
}
