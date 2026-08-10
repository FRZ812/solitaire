import { cloneJsonData } from "../kernel/json-data.js";
import { CHECKSUM_ALGORITHM, gameplayChecksum } from "../kernel/replay.js";
import { REFERENCE_POLICY } from "../reference/policy.js";
import { isReferenceRunState } from "./state.js";

export const GAMEPLAY_SAVE_VERSION = 2;

const SAVE_KEYS = Object.freeze([
  "baselineVersion",
  "fingerprint",
  "fingerprintAlgorithm",
  "runState",
  "version",
]);

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

function payload(version, baselineVersion, fingerprintAlgorithm, runState) {
  return { version, baselineVersion, fingerprintAlgorithm, runState };
}

export function createGameplaySave(runState) {
  let stableRunState;
  try {
    stableRunState = cloneJsonData(runState, "invalid-run-state");
  } catch {
    throw new TypeError("invalid-run-state");
  }
  if (!isReferenceRunState(stableRunState)) {
    throw new TypeError("invalid-gameplay-run-state");
  }
  const body = payload(
    GAMEPLAY_SAVE_VERSION,
    REFERENCE_POLICY.id,
    CHECKSUM_ALGORITHM,
    stableRunState,
  );
  return deepFreeze({
    ...body,
    fingerprint: gameplayChecksum(body),
  });
}

export function restoreGameplaySave(value) {
  let save;
  try {
    save = cloneJsonData(value, "invalid-gameplay-save");
  } catch {
    return rejected("invalid-gameplay-save");
  }
  if (!hasExactSaveShape(save)) return rejected("invalid-gameplay-save");
  if (save.version !== GAMEPLAY_SAVE_VERSION) {
    return rejected("unsupported-gameplay-save-version");
  }
  if (save.baselineVersion !== REFERENCE_POLICY.id) {
    return rejected("unsupported-gameplay-baseline");
  }
  if (save.fingerprintAlgorithm !== CHECKSUM_ALGORITHM) {
    return rejected("unsupported-gameplay-fingerprint");
  }
  if (typeof save.fingerprint !== "string") return rejected("invalid-gameplay-save");

  const body = payload(
    save.version,
    save.baselineVersion,
    save.fingerprintAlgorithm,
    save.runState,
  );
  if (gameplayChecksum(body) !== save.fingerprint) {
    return rejected("gameplay-save-fingerprint-mismatch");
  }
  if (!isReferenceRunState(save.runState)) {
    return rejected("invalid-gameplay-run-state");
  }
  return deepFreeze({ ok: true, state: save.runState });
}
