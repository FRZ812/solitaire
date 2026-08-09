import { cloneJsonData } from "./json-data.js";
import { isEncounterState } from "./model.js";
import { resolveCommand } from "./resolve.js";

export const CHECKSUM_ALGORITHM = "fnv1a64-utf16-v1";
export const REPLAY_RECEIPT_VERSION = 1;
export const MAX_REPLAY_COMMANDS = 4096;

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return value;
}

export function gameplayChecksum(value) {
  const json = canonicalize(cloneJsonData(value));
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let index = 0; index < json.length; index += 1) {
    hash ^= BigInt(json.charCodeAt(index));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}

function sealReceipt(body) {
  const receipt = cloneJsonData({
    ...body,
    checksum: gameplayChecksum(body),
  });
  return deepFreeze(receipt);
}

export function replayEncounter(initialState, commands) {
  const initialSnapshot = cloneJsonData(initialState, "invalid-replay-input");
  const commandSnapshot = cloneJsonData(commands, "invalid-replay-input");
  if (!isEncounterState(initialSnapshot) || !Array.isArray(commandSnapshot)) {
    throw new TypeError("invalid-replay-input");
  }
  if (commandSnapshot.length > MAX_REPLAY_COMMANDS) {
    throw new RangeError("replay-command-limit-exceeded");
  }

  const metadata = {
    receiptVersion: REPLAY_RECEIPT_VERSION,
    baselineVersion: initialSnapshot.baselineVersion,
    checksumAlgorithm: CHECKSUM_ALGORITHM,
    initialStateChecksum: gameplayChecksum(initialSnapshot),
    commandsChecksum: gameplayChecksum(commandSnapshot),
    commandCount: commandSnapshot.length,
  };
  let state = initialSnapshot;
  const events = [];

  for (let index = 0; index < commandSnapshot.length; index += 1) {
    const result = resolveCommand(state, commandSnapshot[index]);
    if (!result.ok) {
      return sealReceipt({
        ...metadata,
        ok: false,
        reason: result.reason,
        rejectedCommandIndex: index,
        state,
        events,
      });
    }
    state = result.state;
    events.push(...result.events);
  }

  return sealReceipt({
    ...metadata,
    ok: true,
    state,
    events,
  });
}
