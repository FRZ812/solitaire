// Proving a saved fight is the fight that was played.
//
// A save that round-trips is not the same as a save that is correct. The encounter could
// load back byte-for-byte and still be a state no sequence of legal commands could have
// produced — because a bug wrote it directly, or because a roll happened somewhere that
// was never recorded. Both are invisible to a codec and both surface the moment someone
// reloads and the fight behaves differently than it did a second ago.
//
// Replay closes that gap by rebuilding from genesis and re-running the recorded commands
// through the production reducer. If the result differs anywhere, the save is not a
// recording of a fight; it is a claim about one. The first divergence is reported with the
// command that produced it and the field path that differs, because "checksums differ" is
// a true statement that helps nobody.
//
// Genesis is mandatory. Verifying a mutable current encounter against its own command log
// proves only that the log is consistent with itself.

import { cloneJsonData } from "../kernel/json-data.js";
import { gameplayChecksum } from "../kernel/replay.js";
import { createRng } from "../kernel/rng.js";
import { resolveTowCommandOnEncounter, towCommand } from "./commands.js";
import { encounterFromGenesis } from "./session.js";
import { resolveTowTerminalReceipt } from "./outcomes.js";

export const MAX_TOW_REPLAY_COMMANDS = 4096;

/**
 * The first place two JSON values differ, as a dotted path.
 *
 * Depth-first in sorted key order so the answer is stable: the same pair of states always
 * reports the same divergence, which is what makes a failure reproducible rather than a
 * lottery over whichever key the engine happened to enumerate first.
 */
export function firstJsonDifference(expected, actual, path = "") {
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) return { path, expected, actual };
    const length = Math.max(expected.length, actual.length);
    for (let index = 0; index < length; index += 1) {
      const diff = firstJsonDifference(expected[index], actual[index], `${path}[${index}]`);
      if (diff) return diff;
    }
    return null;
  }
  const bothObjects = expected && actual
    && typeof expected === "object" && typeof actual === "object";
  if (bothObjects) {
    const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
    for (const key of keys) {
      const next = path ? `${path}.${key}` : key;
      const diff = firstJsonDifference(expected[key], actual[key], next);
      if (diff) return diff;
    }
    return null;
  }
  return expected === actual ? null : { path, expected, actual };
}

function divergence(commandSeq, commandId, path, expected, actual, reason) {
  return { reason, commandSeq, commandId, path, expected, actual };
}

/**
 * Rebuild a fight from its immutable opening and its command log.
 *
 * @param {object} genesis the session's genesis; the only permitted starting point
 * @param {Array<object>} commands accepted commands, in order
 * @returns {{ok: boolean, reason: string|null, encounter: object|null,
 *   divergence: object|null, replayedCommands: number}}
 */
export function replayTowCombatSession(genesis, commands) {
  let log;
  try {
    log = cloneJsonData(commands, "invalid-replay-commands");
  } catch {
    return { ok: false, reason: "invalid-replay-commands", encounter: null, divergence: null, replayedCommands: 0 };
  }
  if (!Array.isArray(log)) {
    return { ok: false, reason: "invalid-replay-commands", encounter: null, divergence: null, replayedCommands: 0 };
  }
  if (log.length > MAX_TOW_REPLAY_COMMANDS) {
    return { ok: false, reason: "replay-command-limit-exceeded", encounter: null, divergence: null, replayedCommands: 0 };
  }

  let encounter;
  try {
    encounter = encounterFromGenesis(cloneJsonData(genesis, "invalid-replay-genesis"));
  } catch (error) {
    return {
      ok: false,
      reason: error?.message || "invalid-replay-genesis",
      encounter: null,
      divergence: null,
      replayedCommands: 0,
    };
  }

  for (let index = 0; index < log.length; index += 1) {
    const command = log[index];
    const eventsFrom = encounter.sequence;
    const resolved = resolveTowCommandOnEncounter(encounter, towCommand(command));
    if (!resolved.ok) {
      // A command the log says was accepted but the reducer now refuses means the rules
      // changed underneath a saved fight. That is a ruleset-pinning failure, not a corrupt
      // save, and it must be reported rather than silently skipped.
      return {
        ok: false,
        reason: "replay-command-refused",
        encounter,
        divergence: divergence(index, command.id ?? null, "command", command.type, resolved.reason, "replay-command-refused"),
        replayedCommands: index,
      };
    }
    encounter = resolved.encounter;

    // The recorded event range and per-command checksum are checked as the replay goes, so
    // a divergence is attributed to the command that caused it instead of to the end state.
    if (Number.isSafeInteger(command.eventsFrom) && command.eventsFrom !== eventsFrom) {
      return {
        ok: false,
        reason: "replay-event-range-mismatch",
        encounter,
        divergence: divergence(index, command.id ?? null, "eventsFrom", command.eventsFrom, eventsFrom, "replay-event-range-mismatch"),
        replayedCommands: index,
      };
    }
    if (Number.isSafeInteger(command.eventsTo) && command.eventsTo !== encounter.sequence) {
      return {
        ok: false,
        reason: "replay-event-range-mismatch",
        encounter,
        divergence: divergence(index, command.id ?? null, "eventsTo", command.eventsTo, encounter.sequence, "replay-event-range-mismatch"),
        replayedCommands: index,
      };
    }
    if (typeof command.stateChecksum === "string") {
      const actual = gameplayChecksum(encounter);
      if (actual !== command.stateChecksum) {
        return {
          ok: false,
          reason: "replay-state-divergence",
          encounter,
          divergence: divergence(index, command.id ?? null, "encounter", command.stateChecksum, actual, "replay-state-divergence"),
          replayedCommands: index,
        };
      }
    }
  }

  return { ok: true, reason: null, encounter, divergence: null, replayedCommands: log.length };
}

/**
 * Verify a live session against a replay of its own genesis and commands.
 *
 * Compares the encounter field by field, every stream endpoint, and the terminal receipt.
 * The saved session is never mutated — verification that could alter what it verifies is
 * not verification.
 */
export function verifyTowSession(session) {
  if (!session || typeof session !== "object") {
    return { ok: false, reason: "invalid-session", divergence: null };
  }

  const replayed = replayTowCombatSession(session.genesis, session.commands);
  if (!replayed.ok) return { ok: false, reason: replayed.reason, divergence: replayed.divergence };

  const lastSeq = session.commands.length - 1;
  const lastId = lastSeq >= 0 ? session.commands[lastSeq].id : null;

  const encounterDiff = firstJsonDifference(session.encounter, replayed.encounter, "encounter");
  if (encounterDiff) {
    return {
      ok: false,
      reason: "replay-state-divergence",
      divergence: {
        reason: "replay-state-divergence",
        commandSeq: lastSeq,
        commandId: lastId,
        ...encounterDiff,
      },
    };
  }

  // The combat and intent streams live on the encounter and have already been compared; the
  // two the session carries are compared independently, which is the point of splitting
  // them. A loot endpoint that moved during a fight would mean something spent the wrong
  // generator — a telegraph draw reaching into the spoils.
  const expectedStreams = { ...session.streams };
  const replayedStreams = {
    // Nothing in a fight spends these, so a faithful replay leaves them at the seeds genesis
    // derived. Deriving rather than copying is deliberate: copying them from the session
    // would make this comparison vacuous.
    loot: seedEndpoint(session, "loot"),
    rewards: seedEndpoint(session, "rewards"),
  };
  const streamDiff = firstJsonDifference(expectedStreams, replayedStreams, "streams");
  if (streamDiff) {
    return {
      ok: false,
      reason: "replay-stream-divergence",
      divergence: { reason: "replay-stream-divergence", commandSeq: lastSeq, commandId: lastId, ...streamDiff },
    };
  }

  const expectedReceipt = session.terminalReceipt;
  if (expectedReceipt) {
    const replayedSession = { ...session, encounter: replayed.encounter };
    const actualReceipt = resolveTowTerminalReceipt(replayedSession);
    const receiptDiff = firstJsonDifference(expectedReceipt, actualReceipt, "terminalReceipt");
    if (receiptDiff) {
      return {
        ok: false,
        reason: "replay-receipt-divergence",
        divergence: { reason: "replay-receipt-divergence", commandSeq: lastSeq, commandId: lastId, ...receiptDiff },
      };
    }
  }

  return { ok: true, reason: null, divergence: null };
}

// Where a stream sits when nothing has spent it: derived from genesis, never copied from
// the session being verified.
function seedEndpoint(session, name) {
  const seed = session.genesis?.seedManifest?.[name];
  if (typeof seed !== "string" && typeof seed !== "number") return null;
  return { ...createRng(seed) };
}
