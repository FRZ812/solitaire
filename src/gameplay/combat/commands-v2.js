// Exactly-once command boundary for solitaire-combat-v2.
//
// Only commands already executable by encounter-v2 are admitted. This module never infers
// ranks, AI choices, reaction triggers, targets, or randomness. Accepted records own one
// contiguous half-open event range and seal both sides of their state transition.

import { cloneJsonData, equalJsonData } from "../kernel/json-data.js";
import { gameplayChecksum } from "../kernel/replay.js";
import {
  COMBAT_ABILITY_RULESET_V2_ID,
  COMBAT_ABILITY_RULES_V2_VERSION,
  abilityRulesV2AtRank,
} from "./ability-rules-v2.js";
import { getCombatAbilityRulesV2 } from "./ability-catalog-v2.js";
import {
  MAX_COMBAT_AI_STEP_RANDOM_DRAWS_V2,
  COMBAT_ENCOUNTER_COMMAND_TYPES_V2,
  reduceCombatEncounterV2,
} from "./encounter-v2.js";
import {
  MAX_COMBAT_SESSION_COMMANDS_V2,
  MAX_COMBAT_SESSION_EVENTS_V2,
  MAX_COMBAT_SESSION_IDENTIFIER_LENGTH_V2,
  sealCombatSessionV2,
  terminalCombatSessionReceiptV2,
  combatEncounterStateChecksumV2,
  validateCombatSessionV2,
} from "./session-v2.js";

export const COMBAT_COMMAND_V2_VERSION = COMBAT_ABILITY_RULES_V2_VERSION;
export const COMBAT_COMMAND_TYPES_V2 = COMBAT_ENCOUNTER_COMMAND_TYPES_V2;
export const COMBAT_UNAVAILABLE_COMMAND_TYPES_V2 = Object.freeze([
  "ai",
  "ai-turn",
  "ai-ability",
]);

const INPUT_KEYS = Object.freeze({
  "round-start": ["commandId", "expectedRevision", "rulesetId", "type", "version"].sort(),
  "actor-turn-start": [
    "actorId", "commandId", "expectedRevision", "rulesetId", "type", "version",
  ].sort(),
  "reaction-arm": [
    "abilityId", "actorId", "anchor", "commandId", "expectedRevision", "rulesetId",
    "type", "version",
  ].sort(),
  ability: [
    "abilityId", "actorId", "anchor", "commandId", "expectedRevision", "randomDraws",
    "rulesetId", "type", "version",
  ].sort(),
  "actor-turn-end": [
    "actorId", "commandId", "expectedRevision", "rulesetId", "type", "version",
  ].sort(),
  "round-end": ["commandId", "expectedRevision", "rulesetId", "type", "version"].sort(),
  "ai-step": [
    "commandId", "expectedRevision", "randomDraws", "rulesetId", "type", "version",
  ].sort(),
});
const REDUCER_KEYS = Object.freeze({
  "round-start": ["rulesetId", "type", "version"].sort(),
  "actor-turn-start": ["actorId", "rulesetId", "type", "version"].sort(),
  "reaction-arm": [
    "abilityId", "actorId", "anchor", "rulesetId", "type", "version",
  ].sort(),
  ability: [
    "abilityId", "actorId", "anchor", "randomDraws", "rulesetId", "type", "version",
  ].sort(),
  "actor-turn-end": ["actorId", "rulesetId", "type", "version"].sort(),
  "round-end": ["rulesetId", "type", "version"].sort(),
  "ai-step": ["randomDraws", "rulesetId", "type", "version"].sort(),
});
const ACCEPTED_KEYS = Object.freeze([
  "command",
  "commandId",
  "eventsFrom",
  "eventsTo",
  "expectedRevision",
  "inputChecksum",
  "revision",
  "stateAfterChecksum",
  "stateBeforeChecksum",
  "transaction",
].sort());

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === expected.length
    && keys.every((key, index) => key === expected[index]);
}

function identifier(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= MAX_COMBAT_SESSION_IDENTIFIER_LENGTH_V2;
}

function stateChecksum(value) {
  return typeof value === "string" && /^state-v2:[0-9a-f]{16}$/.test(value);
}

function jsonObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  try {
    cloneJsonData(value, "invalid-combat-command-v2-json");
    return true;
  } catch {
    return false;
  }
}

function randomDrawVector(value, maximumLength = Number.MAX_SAFE_INTEGER) {
  return Array.isArray(value)
    && value.length <= maximumLength
    && Object.keys(value).length === value.length
    && value.every((draw) => (
      Number.isSafeInteger(draw) && draw >= 0 && draw < 10_000
    ));
}

function reducerCommandShape(value) {
  const expected = REDUCER_KEYS[value?.type];
  if (!expected || !exactKeys(value, expected)
    || value.version !== COMBAT_COMMAND_V2_VERSION
    || value.rulesetId !== COMBAT_ABILITY_RULESET_V2_ID) return false;
  if (["actor-turn-start", "actor-turn-end", "reaction-arm", "ability"].includes(value.type)
    && !identifier(value.actorId)) return false;
  if (["reaction-arm", "ability"].includes(value.type)) {
    if (!identifier(value.abilityId)) return false;
    if (value.type === "ability" && !randomDrawVector(value.randomDraws)) {
      return false;
    }
    try {
      cloneJsonData(value.anchor, "invalid-combat-command-v2-anchor");
    } catch {
      return false;
    }
  }
  if (value.type === "ai-step"
    && !randomDrawVector(value.randomDraws, MAX_COMBAT_AI_STEP_RANDOM_DRAWS_V2)) return false;
  return true;
}

export function isCombatCommandInputV2(value) {
  const expected = INPUT_KEYS[value?.type];
  return Boolean(expected)
    && exactKeys(value, expected)
    && identifier(value.commandId)
    && Number.isSafeInteger(value.expectedRevision)
    && value.expectedRevision >= 0
    && reducerCommandShape(combatReducerCommandV2(value));
}

export function combatReducerCommandV2(input) {
  if (input?.type === "ai-step") {
    return {
      version: input.version,
      rulesetId: input.rulesetId,
      type: input.type,
      randomDraws: input.randomDraws,
    };
  }
  if (input?.type === "ability") {
    return {
      version: input.version,
      rulesetId: input.rulesetId,
      type: input.type,
      actorId: input.actorId,
      abilityId: input.abilityId,
      anchor: input.anchor,
      randomDraws: input.randomDraws,
    };
  }
  if (input?.type === "reaction-arm") {
    return {
      version: input.version,
      rulesetId: input.rulesetId,
      type: input.type,
      actorId: input.actorId,
      abilityId: input.abilityId,
      anchor: input.anchor,
    };
  }
  if (["actor-turn-start", "actor-turn-end"].includes(input?.type)) {
    return {
      version: input.version,
      rulesetId: input.rulesetId,
      type: input.type,
      actorId: input.actorId,
    };
  }
  return {
    version: input?.version,
    rulesetId: input?.rulesetId,
    type: input?.type,
  };
}

export function combatCommandInputChecksumV2(input) {
  return `command-input-v2:${gameplayChecksum(input)}`;
}

function inputFromAccepted(record) {
  return {
    commandId: record.commandId,
    expectedRevision: record.expectedRevision,
    ...record.command,
  };
}

export function validateCombatAcceptedCommandV2(value, index = null) {
  let reason = null;
  if (!exactKeys(value, ACCEPTED_KEYS)) reason = "invalid-combat-command-v2-record";
  else if (!identifier(value.commandId)
    || !Number.isSafeInteger(value.expectedRevision)
    || value.expectedRevision < 0
    || !Number.isSafeInteger(value.revision)
    || value.revision !== value.expectedRevision + 1) reason = "invalid-combat-command-v2-revision";
  else if (index !== null && (value.expectedRevision !== index || value.revision !== index + 1)) {
    reason = "combat-command-v2-revision-discontinuity";
  } else if (!reducerCommandShape(value.command)) reason = "invalid-combat-command-v2-reducer-command";
  else if (value.inputChecksum !== combatCommandInputChecksumV2(inputFromAccepted(value))) {
    reason = "combat-command-v2-input-checksum-mismatch";
  } else if (!Number.isSafeInteger(value.eventsFrom)
    || !Number.isSafeInteger(value.eventsTo)
    || value.eventsFrom < 0
    || value.eventsTo < value.eventsFrom) reason = "invalid-combat-command-v2-event-range";
  else if (!stateChecksum(value.stateBeforeChecksum) || !stateChecksum(value.stateAfterChecksum)) {
    reason = "invalid-combat-command-v2-state-checksum";
  } else if (!jsonObject(value.transaction)) reason = "invalid-combat-command-v2-transaction";
  return Object.freeze({ ok: reason === null, reason });
}

export function validateCombatCommandLogV2(session) {
  if (!session || typeof session !== "object" || !Array.isArray(session.commands)
    || !Array.isArray(session.events)) {
    return Object.freeze({ ok: false, reason: "invalid-combat-command-v2-log" });
  }
  const ids = new Set();
  let cursor = 0;
  for (let index = 0; index < session.commands.length; index += 1) {
    const record = session.commands[index];
    const valid = validateCombatAcceptedCommandV2(record, index);
    if (!valid.ok) return valid;
    if (ids.has(record.commandId)) {
      return Object.freeze({ ok: false, reason: "duplicate-combat-command-v2-id" });
    }
    ids.add(record.commandId);
    if (record.eventsFrom !== cursor || record.eventsTo > session.events.length) {
      return Object.freeze({ ok: false, reason: "combat-command-v2-event-range-discontinuity" });
    }
    for (let eventIndex = record.eventsFrom; eventIndex < record.eventsTo; eventIndex += 1) {
      if (session.events[eventIndex]?.commandId !== record.commandId) {
        return Object.freeze({ ok: false, reason: "combat-command-v2-event-owner-mismatch" });
      }
    }
    cursor = record.eventsTo;
  }
  return Object.freeze({
    ok: cursor === session.events.length,
    reason: cursor === session.events.length ? null : "combat-command-v2-event-range-discontinuity",
  });
}

export function globalizeCombatCommandEventsV2(events, commandId, startOrdinal) {
  return events.map((event, index) => deepFreeze({
    ...cloneJsonData(event, "invalid-combat-command-v2-event"),
    ordinal: startOrdinal + index + 1,
    commandId,
  }));
}

export function combatCommandEventsV2(session, record) {
  return session.events.slice(record.eventsFrom, record.eventsTo);
}

function refused(reason, session) {
  return Object.freeze({
    ok: false,
    reason,
    session,
    command: null,
    events: Object.freeze([]),
    duplicate: false,
  });
}

function unavailableTypeReason(type) {
  if (["ai", "ai-turn", "ai-ability"].includes(type)) return "combat-v2-ai-not-executable";
  return null;
}

function actorCommandReason(session, command) {
  if (!["actor-turn-start", "actor-turn-end", "reaction-arm", "ability"]
    .includes(command.type)) return null;
  const actor = session.encounter.actors[command.actorId];
  if (!actor) return "unknown-encounter-v2-actor";
  if (actor.controller === "ai") return "combat-v2-ai-not-executable";
  if (!["reaction-arm", "ability"].includes(command.type)) return null;
  const loadout = actor.loadout.find(({ id }) => id === command.abilityId);
  if (!loadout) return null;
  const definition = getCombatAbilityRulesV2(command.abilityId);
  if (!definition) return null;
  const ability = abilityRulesV2AtRank(definition, loadout.rank);
  if (command.type === "reaction-arm") {
    return ability.action.lane === "reaction"
      ? null
      : "encounter-v2-reaction-ability-required";
  }
  return ["main", "quick"].includes(ability.action.lane)
    ? null
    : "encounter-v2-reaction-arm-command-required";
}

/** Pure, exactly-once dispatch through the sole executable v2 reducer. */
export function dispatchCombatCommandV2(session, input) {
  const sessionValidation = validateCombatSessionV2(session);
  if (!sessionValidation.ok) return refused(sessionValidation.reason, session);
  const logValidation = validateCombatCommandLogV2(session);
  if (!logValidation.ok) return refused(logValidation.reason, session);

  const unavailable = unavailableTypeReason(input?.type);
  if (unavailable) return refused(unavailable, session);
  let commandInput;
  try {
    commandInput = cloneJsonData(input, "invalid-combat-command-v2-input");
  } catch {
    return refused("invalid-combat-command-v2-input", session);
  }
  if (!isCombatCommandInputV2(commandInput)) return refused("invalid-combat-command-v2-input", session);

  const inputChecksum = combatCommandInputChecksumV2(commandInput);
  const prior = session.commands.find(({ commandId }) => commandId === commandInput.commandId);
  if (prior) {
    if (prior.inputChecksum !== inputChecksum
      || !equalJsonData(inputFromAccepted(prior), commandInput)) {
      return refused("combat-command-v2-id-conflict", session);
    }
    return Object.freeze({
      ok: true,
      reason: null,
      session,
      command: prior,
      events: Object.freeze(combatCommandEventsV2(session, prior)),
      duplicate: true,
    });
  }

  if (session.status === "terminal") return refused("combat-session-v2-terminal", session);
  if (commandInput.expectedRevision !== session.revision) {
    return refused("stale-combat-session-v2-revision", session);
  }
  if (session.commands.length >= MAX_COMBAT_SESSION_COMMANDS_V2) {
    return refused("combat-session-v2-command-limit-exceeded", session);
  }

  const command = combatReducerCommandV2(commandInput);
  const actorReason = actorCommandReason(session, command);
  if (actorReason) return refused(actorReason, session);
  const resolved = reduceCombatEncounterV2(session.encounter, command);
  if (!resolved.ok) return refused(resolved.reason, session);

  const eventsFrom = session.events.length;
  const commandEvents = globalizeCombatCommandEventsV2(
    resolved.events,
    commandInput.commandId,
    eventsFrom,
  );
  const eventsTo = eventsFrom + commandEvents.length;
  if (eventsTo > MAX_COMBAT_SESSION_EVENTS_V2) {
    return refused("combat-session-v2-event-limit-exceeded", session);
  }
  const revision = session.revision + 1;
  const accepted = deepFreeze({
    commandId: commandInput.commandId,
    expectedRevision: commandInput.expectedRevision,
    revision,
    command: cloneJsonData(command),
    inputChecksum,
    eventsFrom,
    eventsTo,
    stateBeforeChecksum: combatEncounterStateChecksumV2(session.encounter),
    stateAfterChecksum: combatEncounterStateChecksumV2(resolved.state),
    transaction: cloneJsonData(resolved.transaction),
  });
  const terminal = terminalCombatSessionReceiptV2(resolved.state, revision);
  const next = sealCombatSessionV2({
    ...session,
    status: terminal === null ? "active" : "terminal",
    revision,
    commands: [...session.commands, accepted],
    events: [...session.events, ...commandEvents],
    encounter: resolved.state,
    terminal,
    checksum: null,
  });
  const nextSession = validateCombatSessionV2(next);
  const nextLog = validateCombatCommandLogV2(next);
  if (!nextSession.ok || !nextLog.ok) {
    return refused(nextSession.reason ?? nextLog.reason ?? "invalid-combat-session-v2", session);
  }
  return Object.freeze({
    ok: true,
    reason: null,
    session: next,
    command: next.commands[next.commands.length - 1],
    events: Object.freeze(combatCommandEventsV2(next, next.commands[next.commands.length - 1])),
    duplicate: false,
  });
}
