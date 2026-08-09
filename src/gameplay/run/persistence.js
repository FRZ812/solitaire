import { cloneJsonData, isJsonData } from "../kernel/json-data.js";
import { gameplayChecksum } from "../kernel/replay.js";
import { REFERENCE_POLICY } from "../reference/policy.js";

const GAMEPLAY_SAVE_VERSION = 1;
const SAVE_KEYS = Object.freeze(["baselineVersion", "checksum", "runState", "version"]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function rejected(reason) {
  return Object.freeze({ ok: false, reason, state: null });
}

function hasExactSaveShape(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === SAVE_KEYS.length && keys.every((key, index) => key === SAVE_KEYS[index]);
}

function payload(version, baselineVersion, runState) {
  return { version, baselineVersion, runState };
}

export function createGameplaySave(runState) {
  if (!isJsonData(runState)) throw new TypeError("invalid-run-state");
  const stableRunState = cloneJsonData(runState, "invalid-run-state");
  const body = payload(GAMEPLAY_SAVE_VERSION, REFERENCE_POLICY.id, stableRunState);
  return deepFreeze({
    ...body,
    checksum: gameplayChecksum(body),
  });
}

export function restoreGameplaySave(value) {
  if (!isJsonData(value) || !hasExactSaveShape(value)) return rejected("invalid-gameplay-save");
  if (value.version !== GAMEPLAY_SAVE_VERSION) return rejected("unsupported-gameplay-save-version");
  if (value.baselineVersion !== REFERENCE_POLICY.id) return rejected("unsupported-gameplay-baseline");
  if (typeof value.checksum !== "string") return rejected("invalid-gameplay-save");

  const body = payload(value.version, value.baselineVersion, value.runState);
  if (gameplayChecksum(body) !== value.checksum) {
    return rejected("gameplay-save-checksum-mismatch");
  }
  return deepFreeze({
    ok: true,
    state: cloneJsonData(value.runState, "invalid-gameplay-save"),
  });
}
