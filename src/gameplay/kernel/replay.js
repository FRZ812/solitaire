import { canonicalJsonData, cloneJsonData } from "./json-data.js";
import { isEncounterState } from "./model.js";
import { resolveCommand } from "./resolve.js";

export const CHECKSUM_ALGORITHM = "fnv1a64-utf16-v1";
export const REPLAY_RECEIPT_VERSION = 1;
export const MAX_REPLAY_COMMANDS = 4096;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return value;
}

export function gameplayChecksum(value) {
  const json = canonicalJsonData(value);
  let high = 0xcbf29ce4;
  let low = 0x84222325;
  for (let index = 0; index < json.length; index += 1) {
    low = (low ^ json.charCodeAt(index)) >>> 0;
    const lowProduct = low * 0x1b3;
    const carry = Math.floor(lowProduct / 0x1_0000_0000);
    high = (high * 0x1b3 + low * 0x100 + carry) >>> 0;
    low = lowProduct >>> 0;
  }
  return high.toString(16).padStart(8, "0") + low.toString(16).padStart(8, "0");
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
