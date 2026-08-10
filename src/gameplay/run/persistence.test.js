import { describe, expect, it } from "vitest";
import { REFERENCE_POLICY } from "../reference/policy.js";
import { CHECKSUM_ALGORITHM, gameplayChecksum } from "../kernel/replay.js";
import {
  GAMEPLAY_SAVE_VERSION,
  createGameplaySave,
  restoreGameplaySave,
} from "./persistence.js";
import { createArcticKnightGatekeeperRun } from "./state.js";

function runState() {
  return JSON.parse(JSON.stringify(createArcticKnightGatekeeperRun({
    runId: "run-arctic-1",
    seed: "campaign-17:run-1",
  })));
}

describe("gameplay persistence envelope", () => {
  it("round-trips an isolated JSON run state with an accidental-corruption fingerprint", () => {
    const source = runState();
    const save = createGameplaySave(source);
    const restored = restoreGameplaySave(JSON.parse(JSON.stringify(save)));

    expect(save).toMatchObject({
      version: GAMEPLAY_SAVE_VERSION,
      baselineVersion: REFERENCE_POLICY.id,
      fingerprintAlgorithm: CHECKSUM_ALGORITHM,
      runState: source,
    });
    expect(save.fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(restored).toEqual({ ok: true, state: source });
    expect(Object.isFrozen(save)).toBe(true);
    expect(Object.isFrozen(save.runState)).toBe(true);
  });

  it("does not retain input ownership in either direction", () => {
    const source = runState();
    const save = createGameplaySave(source);
    source.build.baseStats.attack = 999;

    expect(save.runState.build.baseStats.attack).toBe(4);

    const input = JSON.parse(JSON.stringify(save));
    const restored = restoreGameplaySave(input);
    input.runState.build.baseStats.attack = 500;

    expect(restored.state.build.baseStats.attack).toBe(4);
    expect(Object.isFrozen(restored.state)).toBe(true);
  });

  it("rejects a tampered run without returning attacker-controlled state", () => {
    const save = JSON.parse(JSON.stringify(createGameplaySave(runState())));
    save.runState.position = 12;

    expect(restoreGameplaySave(save)).toEqual({
      ok: false,
      reason: "gameplay-save-fingerprint-mismatch",
      state: null,
    });
  });

  it("rejects a semantically forged run even when its public fingerprint is recomputed", () => {
    const save = JSON.parse(JSON.stringify(createGameplaySave(runState())));
    save.runState.phase = "reward";
    save.fingerprint = gameplayChecksum({
      version: save.version,
      baselineVersion: save.baselineVersion,
      fingerprintAlgorithm: save.fingerprintAlgorithm,
      runState: save.runState,
    });

    expect(restoreGameplaySave(save)).toEqual({
      ok: false,
      reason: "invalid-gameplay-run-state",
      state: null,
    });
  });

  it.each([
    ["version", GAMEPLAY_SAVE_VERSION + 1, "unsupported-gameplay-save-version"],
    ["baselineVersion", "future-private-balance", "unsupported-gameplay-baseline"],
    ["fingerprintAlgorithm", "unknown", "unsupported-gameplay-fingerprint"],
  ])("rejects unsupported %s explicitly", (field, value, reason) => {
    const save = JSON.parse(JSON.stringify(createGameplaySave(runState())));
    save[field] = value;

    expect(restoreGameplaySave(save)).toEqual({ ok: false, reason, state: null });
  });

  it("rejects executable state and accessor-backed input without executing caller code", () => {
    expect(() => createGameplaySave({ apply: () => "mutate" })).toThrow("invalid-run-state");

    const save = JSON.parse(JSON.stringify(createGameplaySave(runState())));
    let getterCalls = 0;
    Object.defineProperty(save, "runState", {
      enumerable: true,
      get: () => { getterCalls += 1; return runState(); },
    });

    expect(restoreGameplaySave(save)).toEqual({
      ok: false,
      reason: "invalid-gameplay-save",
      state: null,
    });
    expect(getterCalls).toBe(0);
  });
});
