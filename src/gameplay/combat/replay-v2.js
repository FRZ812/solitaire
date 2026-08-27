// Fail-closed replay verification for solitaire-combat-v2 sessions.

import { cloneJsonData, equalJsonData } from "../kernel/json-data.js";
import {
  globalizeCombatCommandEventsV2,
  validateCombatCommandLogV2,
} from "./commands-v2.js";
import { createCombatEncounterGenesisV2 } from "./encounter-state-v2.js";
import { reduceCombatEncounterV2 } from "./encounter-v2.js";
import {
  terminalCombatSessionReceiptV2,
  combatEncounterStateChecksumV2,
  combatGenesisChecksumV2,
  validateCombatSessionV2,
} from "./session-v2.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function bytes(value) {
  return JSON.stringify(value);
}

export function firstCombatReplayDifferenceV2(expected, actual, path = "") {
  if (expected === actual) return null;
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) return { path, expected, actual };
    if (expected.length !== actual.length) {
      return { path: `${path}.length`, expected: expected.length, actual: actual.length };
    }
    for (let index = 0; index < expected.length; index += 1) {
      const difference = firstCombatReplayDifferenceV2(expected[index], actual[index], `${path}[${index}]`);
      if (difference) return difference;
    }
    return null;
  }
  if (expected && actual && typeof expected === "object" && typeof actual === "object") {
    const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
    for (const key of keys) {
      const difference = firstCombatReplayDifferenceV2(
        expected[key],
        actual[key],
        path ? `${path}.${key}` : key,
      );
      if (difference) return difference;
    }
    return null;
  }
  return { path, expected, actual };
}

function failure(reason, encounter, events, replayedCommands, divergence = null) {
  return deepFreeze({ ok: false, reason, encounter, events, replayedCommands, divergence });
}

function divergence(index, record, path, expected, actual) {
  return {
    commandIndex: index,
    commandId: record?.commandId ?? null,
    path,
    expected,
    actual,
  };
}

/** Rebuild a full session from exact genesis and verify every derived byte. */
export function replayCombatSessionV2(session) {
  let snapshot;
  try {
    snapshot = cloneJsonData(session, "invalid-combat-session-v2-replay-input");
  } catch {
    return failure("invalid-combat-session-v2-replay-input", null, [], 0);
  }
  const valid = validateCombatSessionV2(snapshot);
  if (!valid.ok) return failure(valid.reason, null, [], 0);
  const log = validateCombatCommandLogV2(snapshot);
  if (!log.ok) return failure(log.reason, null, [], 0);
  if (snapshot.genesisChecksum !== combatGenesisChecksumV2(snapshot.genesis)) {
    return failure("combat-replay-v2-genesis-checksum-mismatch", null, [], 0);
  }
  const opening = createCombatEncounterGenesisV2(snapshot.genesis);
  if (!opening.ok) return failure(opening.reason, null, [], 0);

  let encounter = opening.state;
  const events = [];
  for (let index = 0; index < snapshot.commands.length; index += 1) {
    const record = snapshot.commands[index];
    const beforeChecksum = combatEncounterStateChecksumV2(encounter);
    if (record.stateBeforeChecksum !== beforeChecksum) {
      return failure(
        "combat-replay-v2-before-state-divergence",
        encounter,
        events,
        index,
        divergence(index, record, "stateBeforeChecksum", record.stateBeforeChecksum, beforeChecksum),
      );
    }
    if (record.eventsFrom !== events.length) {
      return failure(
        "combat-replay-v2-event-range-divergence",
        encounter,
        events,
        index,
        divergence(index, record, "eventsFrom", record.eventsFrom, events.length),
      );
    }
    const resolved = reduceCombatEncounterV2(encounter, record.command);
    if (!resolved.ok) {
      return failure(
        "combat-replay-v2-command-refused",
        encounter,
        events,
        index,
        divergence(index, record, "command", "accepted", resolved.reason),
      );
    }
    const replayedEvents = globalizeCombatCommandEventsV2(
      resolved.events,
      record.commandId,
      record.eventsFrom,
    );
    const expectedEvents = snapshot.events.slice(record.eventsFrom, record.eventsTo);
    if (record.eventsTo !== record.eventsFrom + replayedEvents.length
      || bytes(expectedEvents) !== bytes(replayedEvents)
      || !equalJsonData(expectedEvents, replayedEvents)) {
      const difference = firstCombatReplayDifferenceV2(expectedEvents, replayedEvents, "events");
      return failure(
        "combat-replay-v2-event-divergence",
        resolved.state,
        events,
        index,
        divergence(
          index,
          record,
          difference?.path ?? "eventsTo",
          difference?.expected ?? record.eventsTo,
          difference?.actual ?? record.eventsFrom + replayedEvents.length,
        ),
      );
    }
    if (bytes(record.transaction) !== bytes(resolved.transaction)
      || !equalJsonData(record.transaction, resolved.transaction)) {
      const difference = firstCombatReplayDifferenceV2(record.transaction, resolved.transaction, "transaction");
      return failure(
        "combat-replay-v2-transaction-divergence",
        resolved.state,
        events,
        index,
        divergence(index, record, difference?.path ?? "transaction", difference?.expected, difference?.actual),
      );
    }
    const afterChecksum = combatEncounterStateChecksumV2(resolved.state);
    if (record.stateAfterChecksum !== afterChecksum) {
      return failure(
        "combat-replay-v2-after-state-divergence",
        resolved.state,
        events,
        index,
        divergence(index, record, "stateAfterChecksum", record.stateAfterChecksum, afterChecksum),
      );
    }
    encounter = resolved.state;
    for (const event of replayedEvents) events.push(event);
  }

  if (bytes(encounter) !== bytes(snapshot.encounter)
    || !equalJsonData(encounter, snapshot.encounter)) {
    const difference = firstCombatReplayDifferenceV2(snapshot.encounter, encounter, "encounter");
    return failure(
      "combat-replay-v2-final-state-divergence",
      encounter,
      events,
      snapshot.commands.length,
      divergence(
        snapshot.commands.length - 1,
        snapshot.commands.at(-1),
        difference?.path ?? "encounter",
        difference?.expected,
        difference?.actual,
      ),
    );
  }
  if (bytes(events) !== bytes(snapshot.events) || !equalJsonData(events, snapshot.events)) {
    return failure(
      "combat-replay-v2-final-event-divergence",
      encounter,
      events,
      snapshot.commands.length,
    );
  }
  const terminal = terminalCombatSessionReceiptV2(encounter, snapshot.revision);
  if (bytes(terminal) !== bytes(snapshot.terminal) || !equalJsonData(terminal, snapshot.terminal)) {
    return failure(
      "combat-replay-v2-terminal-divergence",
      encounter,
      events,
      snapshot.commands.length,
    );
  }
  return deepFreeze({
    ok: true,
    reason: null,
    encounter,
    events,
    replayedCommands: snapshot.commands.length,
    divergence: null,
  });
}

export function verifyCombatSessionReplayV2(session) {
  const replayed = replayCombatSessionV2(session);
  return deepFreeze({ ok: replayed.ok, reason: replayed.reason, divergence: replayed.divergence });
}
