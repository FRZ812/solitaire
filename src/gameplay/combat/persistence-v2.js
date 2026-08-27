// Bounded storage codec for fully replay-verified solitaire-combat-v2 sessions.

import { cloneJsonData } from "../kernel/json-data.js";
import { validateCombatCommandLogV2 } from "./commands-v2.js";
import { replayCombatSessionV2 } from "./replay-v2.js";
import {
  MAX_COMBAT_SESSION_COMMANDS_V2,
  MAX_COMBAT_SESSION_EVENTS_V2,
  defineCombatSessionV2,
  validateCombatSessionV2,
} from "./session-v2.js";

export const MAX_COMBAT_SESSION_ENCODED_BYTES_V2 = 2_000_000;
export const MAX_COMBAT_SESSION_COMMAND_COUNT_V2 = MAX_COMBAT_SESSION_COMMANDS_V2;
export const MAX_COMBAT_SESSION_EVENT_COUNT_V2 = MAX_COMBAT_SESSION_EVENTS_V2;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

function rejected(reason) {
  return deepFreeze({ ok: false, reason, session: null, payload: null });
}

function verifySnapshot(session) {
  const valid = validateCombatSessionV2(session);
  if (!valid.ok) return valid;
  const log = validateCombatCommandLogV2(session);
  if (!log.ok) return log;
  const replay = replayCombatSessionV2(session);
  return replay.ok
    ? Object.freeze({ ok: true, reason: null })
    : Object.freeze({ ok: false, reason: replay.reason });
}

/** Encode only sessions whose complete log replays to the exact stored bytes. */
export function encodeCombatSessionV2(session) {
  if (Array.isArray(session?.commands)
    && session.commands.length > MAX_COMBAT_SESSION_COMMAND_COUNT_V2) {
    return rejected("combat-session-v2-command-limit-exceeded");
  }
  if (Array.isArray(session?.events)
    && session.events.length > MAX_COMBAT_SESSION_EVENT_COUNT_V2) {
    return rejected("combat-session-v2-event-limit-exceeded");
  }
  let snapshot;
  try {
    snapshot = cloneJsonData(session, "invalid-combat-session-v2-payload");
  } catch {
    return rejected("invalid-combat-session-v2-payload");
  }
  const verified = verifySnapshot(snapshot);
  if (!verified.ok) return rejected(verified.reason);
  const payload = JSON.stringify(snapshot);
  if (byteLength(payload) > MAX_COMBAT_SESSION_ENCODED_BYTES_V2) {
    return rejected("combat-session-v2-payload-too-large");
  }
  return deepFreeze({ ok: true, reason: null, session: null, payload });
}

/** Decode JSON text under size/node/depth/count caps, then checksum and replay it. */
export function decodeCombatSessionV2(payload) {
  if (typeof payload !== "string" || payload.length === 0) {
    return rejected("invalid-combat-session-v2-payload");
  }
  if (byteLength(payload) > MAX_COMBAT_SESSION_ENCODED_BYTES_V2) {
    return rejected("combat-session-v2-payload-too-large");
  }
  let raw;
  try {
    raw = JSON.parse(payload);
  } catch {
    return rejected("invalid-combat-session-v2-payload");
  }
  if (Array.isArray(raw?.commands)
    && raw.commands.length > MAX_COMBAT_SESSION_COMMAND_COUNT_V2) {
    return rejected("combat-session-v2-command-limit-exceeded");
  }
  if (Array.isArray(raw?.events)
    && raw.events.length > MAX_COMBAT_SESSION_EVENT_COUNT_V2) {
    return rejected("combat-session-v2-event-limit-exceeded");
  }
  let parsed;
  try {
    parsed = cloneJsonData(raw, "invalid-combat-session-v2-payload");
  } catch {
    return rejected("invalid-combat-session-v2-payload");
  }
  const verified = verifySnapshot(parsed);
  if (!verified.ok) return rejected(verified.reason);
  try {
    return deepFreeze({
      ok: true,
      reason: null,
      session: defineCombatSessionV2(parsed),
      payload: null,
    });
  } catch (error) {
    return rejected(error?.message || "invalid-combat-session-v2-payload");
  }
}

export function isStoredCombatSessionV2(payload) {
  return decodeCombatSessionV2(payload).ok;
}
