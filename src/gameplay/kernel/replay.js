import { resolveCommand } from "./resolve.js";
import { assertJsonData, cloneJsonData } from "./json-data.js";

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function gameplayChecksum(value) {
  assertJsonData(value);
  const text = JSON.stringify(canonicalize(value));
  let hash = 14695981039346656037n;
  const mask = 0xFFFFFFFFFFFFFFFFn;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = (hash * 1099511628211n) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}

export function replayEncounter(initialState, commands = []) {
  if (!initialState || typeof initialState !== "object" || !Array.isArray(commands)) {
    throw new TypeError("invalid-replay-input");
  }
  assertJsonData(initialState, "invalid-replay-input");
  assertJsonData(commands, "invalid-replay-input");
  let state = cloneJsonData(initialState, "invalid-replay-input");
  const events = [];
  for (const command of commands) {
    const result = resolveCommand(state, command);
    if (!result.ok) {
      const rejected = {
        ok: false,
        reason: result.reason,
        state,
        events,
      };
      return { ...rejected, checksum: gameplayChecksum(rejected) };
    }
    state = result.state;
    events.push(...result.events.map((event) => cloneJsonData(event, "invalid-replay-event")));
  }
  const replay = { ok: true, state, events };
  return { ...replay, checksum: gameplayChecksum(replay) };
}
