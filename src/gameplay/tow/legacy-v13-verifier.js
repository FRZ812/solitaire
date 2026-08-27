// Verifier-only compatibility boundary for sessions produced by deployed Tower v1.3.
// The frozen graph is intentionally not registered as a playable runtime.

import { cloneJsonData } from "../kernel/json-data.js";
import { verifyTowSession as verifyFrozenTowV13Session } from "./replay-v13.js";
import {
  isTowSession as isFrozenTowV13Session,
  towSessionChecksum as frozenTowV13SessionChecksum,
} from "./session-v13.js";
import {
  TOW_RULESET_ID as TOW_V13_RULESET_ID,
  TOW_SESSION_VERSION as TOW_V13_SESSION_VERSION,
} from "./ruleset-v13.js";

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

export function verifyRetiredTowV13Session(value) {
  let session;
  try {
    session = cloneJsonData(value, "invalid-retired-v1.3-session");
  } catch {
    return { ok: false, reason: "invalid-retired-v1.3-session", divergence: null };
  }
  if (ownDataValue(session, "version") !== TOW_V13_SESSION_VERSION
    || ownDataValue(session, "rulesetId") !== TOW_V13_RULESET_ID) {
    return { ok: false, reason: "retired-v1.3-session-required", divergence: null };
  }
  try {
    if (!isFrozenTowV13Session(session)
      || (session.status === "settled" && session.terminalReceipt === null)) {
      return { ok: false, reason: "invalid-retired-v1.3-session", divergence: null };
    }
    if (!hasExactCommandRecords(session)) {
      return { ok: false, reason: "invalid-command-record", divergence: null };
    }
    if (session.checksum !== frozenTowV13SessionChecksum(session)) {
      return { ok: false, reason: "retired-v1.3-checksum-mismatch", divergence: null };
    }
    return verifyFrozenTowV13Session(session);
  } catch {
    return { ok: false, reason: "invalid-retired-v1.3-session", divergence: null };
  }
}
