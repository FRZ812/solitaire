// Verifier-only compatibility boundary for sessions produced by deployed Tower v1.2.
// The frozen graph is intentionally not registered as a playable runtime.

import { verifyTowSession as verifyFrozenTowV12Session } from "./replay-v12.js";
import {
  isTowSession as isFrozenTowV12Session,
  towSessionChecksum as frozenTowV12SessionChecksum,
} from "./session-v12.js";
import {
  TOW_RULESET_ID as TOW_V12_RULESET_ID,
  TOW_SESSION_VERSION as TOW_V12_SESSION_VERSION,
} from "./ruleset-v12.js";

const LEGACY_COMMAND_KEYS = Object.freeze([
  "actorId", "eventsFrom", "eventsTo", "expectedRevision", "id", "seq",
  "skillId", "stateChecksum", "streams", "targetId", "type",
].sort());
const COMMAND_KEYS = Object.freeze([...LEGACY_COMMAND_KEYS, "itemId"].sort());
const SPATIAL_COMMAND_KEYS = Object.freeze([...COMMAND_KEYS, "anchorCell"].sort());
const SPATIAL_LEGACY_COMMAND_KEYS = Object.freeze([...LEGACY_COMMAND_KEYS, "anchorCell"].sort());

function exactKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const own = Object.keys(value).sort();
  return own.length === keys.length && own.every((key, index) => key === keys[index]);
}

function hasExactCommandRecords(session) {
  return Array.isArray(session?.commands) && session.commands.every((command) => (
    exactKeys(command, SPATIAL_COMMAND_KEYS)
    || exactKeys(command, SPATIAL_LEGACY_COMMAND_KEYS)
    || exactKeys(command, COMMAND_KEYS)
    || exactKeys(command, LEGACY_COMMAND_KEYS)
  ));
}

function ownDataValue(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !("value" in descriptor)) return null;
  return descriptor.value;
}

export function verifyRetiredTowV12Session(session) {
  if (ownDataValue(session, "version") !== TOW_V12_SESSION_VERSION
    || ownDataValue(session, "rulesetId") !== TOW_V12_RULESET_ID) {
    return { ok: false, reason: "retired-v1.2-session-required", divergence: null };
  }
  try {
    if (!isFrozenTowV12Session(session)) {
      return { ok: false, reason: "invalid-retired-v1.2-session", divergence: null };
    }
    if (!hasExactCommandRecords(session)) {
      return { ok: false, reason: "invalid-command-record", divergence: null };
    }
    if (session.checksum !== frozenTowV12SessionChecksum(session)) {
      return { ok: false, reason: "retired-v1.2-checksum-mismatch", divergence: null };
    }
    return verifyFrozenTowV12Session(session);
  } catch {
    return { ok: false, reason: "invalid-retired-v1.2-session", divergence: null };
  }
}
