import { describe, expect, it } from "vitest";
import { createEncounter } from "./model.js";
import {
  CHECKSUM_ALGORITHM,
  MAX_REPLAY_COMMANDS,
  REPLAY_RECEIPT_VERSION,
  gameplayChecksum,
  replayEncounter,
} from "./replay.js";

function encounter(seed = 31337) {
  return createEncounter({
    seed,
    player: {
      id: "player",
      name: "Arctic Knight",
      hp: 24,
      maxHp: 24,
      stats: { attack: 4, defense: 2 },
      actions: ["basic-attack", "basic-defense"],
      skills: ["emergency-evasion"],
    },
    enemy: {
      id: "gatekeeper",
      name: "The Gatekeeper",
      hp: 18,
      maxHp: 18,
      stats: { attack: 3, defense: 0 },
      intent: {
        id: "gatekeeper-strike",
        type: "attack",
        targetId: "player",
        damage: { min: 8, max: 8 },
      },
    },
  });
}

const commands = Object.freeze([
  Object.freeze({
    type: "use-skill",
    actorId: "player",
    skillId: "emergency-evasion",
    targetId: "player",
  }),
  Object.freeze({
    type: "use-action",
    actorId: "player",
    actionId: "basic-attack",
    targetId: "gatekeeper",
  }),
]);

describe("reference encounter replay", () => {
  it("reproduces a byte-stable state, event trace, and checksum from the same input", () => {
    const initial = encounter();
    const before = JSON.parse(JSON.stringify(initial));

    const first = replayEncounter(initial, commands);
    const repeated = replayEncounter(encounter(), commands);

    expect(first).toEqual(repeated);
    expect(first.ok).toBe(true);
    expect(first).toMatchObject({
      receiptVersion: REPLAY_RECEIPT_VERSION,
      baselineVersion: initial.baselineVersion,
      checksumAlgorithm: CHECKSUM_ALGORITHM,
      commandCount: commands.length,
    });
    expect(first.initialStateChecksum).toBe("a7d10c5312bf4543");
    expect(first.commandsChecksum).toBe("f4126bed83187c1d");
    expect(first.checksum).toBe("f24fe7aaa3dd8b8f");
    expect(first.state.rng.state).toBe(4169244090);
    expect(first.state.actors.gatekeeper.hp).toBe(12);
    expect(first.state.events).toHaveLength(first.events.length);
    expect(initial).toEqual(before);
    expect(commands[0].skillId).toBe("emergency-evasion");
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.state)).toBe(true);
  });

  it("stops atomically at a rejected command with a reproducible receipt", () => {
    const initial = encounter();
    const rejected = replayEncounter(initial, [
      { type: "invalid-command", actorId: "player" },
      commands[1],
    ]);

    expect(rejected).toMatchObject({
      ok: false,
      reason: "invalid-command",
      rejectedCommandIndex: 0,
      state: initial,
      events: [],
    });
    expect(rejected.checksum).toMatch(/^[0-9a-f]{16}$/);
    expect(replayEncounter(encounter(), [
      { type: "invalid-command", actorId: "player" },
      commands[1],
    ])).toEqual(rejected);
  });

  it("binds distinct rejected command streams to distinct receipts", () => {
    const first = replayEncounter(encounter(), [{ type: "bad-a", actorId: "player" }]);
    const second = replayEncounter(encounter(), [{ type: "bad-b", actorId: "player" }]);

    expect(first.commandsChecksum).not.toBe(second.commandsChecksum);
    expect(first.checksum).not.toBe(second.checksum);
  });

  it("retains successful prefix events and identifies the rejected command index", () => {
    const result = replayEncounter(encounter(), [
      commands[0],
      { type: "invalid-command", actorId: "player" },
      commands[1],
    ]);

    expect(result).toMatchObject({
      ok: false,
      reason: "invalid-command",
      rejectedCommandIndex: 1,
      commandCount: 3,
    });
    expect(result.events.map((event) => event.type)).toEqual([
      "skill-used",
      "skill-use-spent",
      "status-applied",
    ]);
  });

  it("rejects JSON-shaped data that is not a valid encounter snapshot", () => {
    expect(() => replayEncounter({}, [])).toThrow("invalid-replay-input");
    expect(() => replayEncounter([], [])).toThrow("invalid-replay-input");
  });

  it("caps replay command streams before resolving any command", () => {
    const oversized = Array.from(
      { length: MAX_REPLAY_COMMANDS + 1 },
      () => ({ type: "invalid-command", actorId: "player" }),
    );

    expect(() => replayEncounter(encounter(), oversized)).toThrow("replay-command-limit-exceeded");
  });

  it("rejects accessor-backed replay input without executing the getter", () => {
    const initial = JSON.parse(JSON.stringify(encounter()));
    let getterCalls = 0;
    Object.defineProperty(initial, "phase", {
      enumerable: true,
      get: () => { getterCalls += 1; return "input"; },
    });

    expect(() => replayEncounter(initial, commands)).toThrow("invalid-replay-input");
    expect(getterCalls).toBe(0);
  });

  it("rejects non-JSON checksum input without executing toJSON", () => {
    let callbackCalls = 0;
    const value = { toJSON: () => { callbackCalls += 1; return {}; } };

    expect(() => gameplayChecksum(value)).toThrow("invalid-json-data");
    expect(callbackCalls).toBe(0);
    expect(() => gameplayChecksum({ unsupported: undefined })).toThrow("invalid-json-data");
  });

  it("does not collapse a known 32-bit checksum collision", () => {
    expect(gameplayChecksum({ probe: "1c5jp4sbuwlrp" })).not.toBe(
      gameplayChecksum({ probe: "1j7i0hq1qbocxp" }),
    );
  });
});
