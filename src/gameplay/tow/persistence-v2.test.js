import { describe, expect, it } from "vitest";
import { TOW_ABILITY_RULESET_V2_ID, TOW_ABILITY_RULES_V2_VERSION } from "./ability-rules-v2.js";
import { createTowActorV2 } from "./actor-v2.js";
import { TOW_AI_POLICY_REGISTRY_V2_CHECKSUM } from "./ai-v2.js";
import { dispatchTowCommandV2 } from "./commands-v2.js";
import {
  PINNED_TOW_ABILITY_CATALOG_V2_CHECKSUM,
  TOW_ENCOUNTER_POLICY_V2_ID,
} from "./encounter-state-v2.js";
import {
  MAX_TOW_SESSION_COMMAND_COUNT_V2,
  MAX_TOW_SESSION_ENCODED_BYTES_V2,
  MAX_TOW_SESSION_EVENT_COUNT_V2,
  decodeTowSessionV2,
  encodeTowSessionV2,
  isStoredTowSessionV2,
} from "./persistence-v2.js";
import { createTowSessionV2, sealTowSessionV2 } from "./session-v2.js";

function actor(id, side, speed = 10) {
  const created = createTowActorV2({
    id,
    name: id,
    side,
    controller: side === "player" ? "human" : "ai",
    aiProfile: side === "player" ? null : { id: "knight", version: 1 },
    preferredRow: 0,
    hp: 500,
    maxHp: 500,
    shield: 0,
    stats: { attack: 100, defense: 0, speed, critChanceBps: 0, dodgeChanceBps: 0 },
    loadout: side === "player"
      ? [{ id: "arctic-block", rank: 1 }, { id: "arctic-strike", rank: 1 }]
      : [{ id: "arctic-strike", rank: 1 }],
  });
  if (!created.ok) throw new TypeError(created.reason);
  return created.actor;
}

function opening() {
  const actors = [actor("p:0", "player"), actor("e:0", "enemy")];
  const created = createTowSessionV2({
    sessionId: "persistence:duel",
    genesis: {
      aiPolicyChecksum: TOW_AI_POLICY_REGISTRY_V2_CHECKSUM,
      catalogChecksum: PINNED_TOW_ABILITY_CATALOG_V2_CHECKSUM,
      policyId: TOW_ENCOUNTER_POLICY_V2_ID,
      rosters: { player: ["p:0"], enemy: ["e:0"] },
      actors,
      resolveSeeds: actors.map(({ id }) => ({ id, resolve: id === "p:0" ? 2 : 0, maxResolve: 10 })),
    },
  });
  if (!created.ok) throw new TypeError(created.reason);
  return created.session;
}

function land(session, commandId, type, fields = {}) {
  const result = dispatchTowCommandV2(session, {
    version: TOW_ABILITY_RULES_V2_VERSION,
    rulesetId: TOW_ABILITY_RULESET_V2_ID,
    commandId,
    expectedRevision: session.revision,
    type,
    ...fields,
  });
  if (!result.ok) throw new TypeError(result.reason);
  return result.session;
}

function storedSession() {
  let session = opening();
  session = land(session, "c:round", "round-start");
  session = land(session, "c:turn", "actor-turn-start", { actorId: "p:0" });
  return land(session, "c:arm", "reaction-arm", {
    actorId: "p:0",
    abilityId: "arctic-block",
    anchor: "p:0",
  });
}

function stagedAiSession() {
  const actors = [actor("p:human", "player", 10), actor("e:ai", "enemy", 20)];
  const created = createTowSessionV2({
    sessionId: "persistence:staged-ai",
    genesis: {
      aiPolicyChecksum: TOW_AI_POLICY_REGISTRY_V2_CHECKSUM,
      catalogChecksum: PINNED_TOW_ABILITY_CATALOG_V2_CHECKSUM,
      policyId: TOW_ENCOUNTER_POLICY_V2_ID,
      rosters: { player: ["p:human"], enemy: ["e:ai"] },
      actors,
      resolveSeeds: actors.map(({ id }) => ({ id, resolve: 10, maxResolve: 20 })),
    },
  });
  if (!created.ok) throw new TypeError(created.reason);
  let session = created.session;
  for (let index = 0; index < 3; index += 1) {
    session = land(session, `c:ai:${index + 1}`, "ai-step", {
      randomDraws: [9_999, 9_999, 123, 456],
    });
  }
  return session;
}

describe("v2 bounded persistence", () => {
  it("round-trips a durable AI telegraph and resumes its separately logged execution", () => {
    const declared = stagedAiSession();
    expect(declared.encounter.intents["e:ai"]).toMatchObject({
      abilityId: "arctic-strike",
      declaredSequence: 1,
      policyId: "knight-v1",
    });
    expect(declared.commands.at(-1).transaction.stage).toBe("intent-declared");

    const encoded = encodeTowSessionV2(declared);
    expect(encoded.ok, encoded.reason).toBe(true);
    const decoded = decodeTowSessionV2(encoded.payload);
    expect(decoded.ok, decoded.reason).toBe(true);
    expect(JSON.stringify(decoded.session)).toBe(JSON.stringify(declared));

    const executed = land(decoded.session, "c:ai:4", "ai-step", {
      randomDraws: [9_999, 9_999, 123, 456],
    });
    expect(executed.commands.at(-1).transaction).toMatchObject({
      stage: "action-executed",
      abilityId: "arctic-strike",
      drawsConsumed: 2,
    });
    expect(executed.encounter.intents).toEqual({});
    const resumed = decodeTowSessionV2(encodeTowSessionV2(executed).payload);
    expect(resumed.ok, resumed.reason).toBe(true);
    expect(JSON.stringify(resumed.session)).toBe(JSON.stringify(executed));
  });

  it("round-trips a replay-verified session without changing any byte of derived state", () => {
    const session = storedSession();
    const encoded = encodeTowSessionV2(session);
    expect(encoded).toMatchObject({ ok: true, reason: null, session: null });
    expect(typeof encoded.payload).toBe("string");
    expect(isStoredTowSessionV2(encoded.payload)).toBe(true);

    const decoded = decodeTowSessionV2(encoded.payload);
    expect(decoded).toMatchObject({ ok: true, reason: null, payload: null });
    expect(JSON.stringify(decoded.session)).toBe(JSON.stringify(session));
    expect(Object.isFrozen(decoded.session.encounter.actors["p:0"])).toBe(true);
    expect(decoded.session.commands.at(-1).command.type).toBe("reaction-arm");
  });

  it("rejects checksum tampering and refuses to encode resealed replay divergence", () => {
    const session = storedSession();
    const encoded = encodeTowSessionV2(session);
    const checksumTamper = JSON.parse(encoded.payload);
    checksumTamper.sessionId = "persistence:forged";
    expect(decodeTowSessionV2(JSON.stringify(checksumTamper))).toMatchObject({
      ok: false,
      reason: "tow-session-v2-checksum-mismatch",
    });

    const replayTamper = structuredClone(session);
    replayTamper.events[0].type = "forged-event";
    expect(encodeTowSessionV2(sealTowSessionV2(replayTamper))).toMatchObject({
      ok: false,
      reason: "tow-replay-v2-event-divergence",
    });
  });

  it("enforces encoded byte, JSON depth, command count, and event count caps", () => {
    expect(decodeTowSessionV2("x".repeat(MAX_TOW_SESSION_ENCODED_BYTES_V2 + 1))).toMatchObject({
      ok: false,
      reason: "tow-session-v2-payload-too-large",
    });

    let nested = null;
    for (let index = 0; index < 140; index += 1) nested = [nested];
    expect(decodeTowSessionV2(JSON.stringify(nested))).toMatchObject({
      ok: false,
      reason: "invalid-tow-session-v2-payload",
    });

    const commands = structuredClone(opening());
    commands.commands = Array.from({ length: MAX_TOW_SESSION_COMMAND_COUNT_V2 + 1 }, () => ({}));
    commands.revision = commands.commands.length;
    expect(decodeTowSessionV2(JSON.stringify(commands))).toMatchObject({
      ok: false,
      reason: "tow-session-v2-command-limit-exceeded",
    });

    const events = structuredClone(opening());
    events.events = Array.from({ length: MAX_TOW_SESSION_EVENT_COUNT_V2 + 1 }, () => ({}));
    expect(decodeTowSessionV2(JSON.stringify(events))).toMatchObject({
      ok: false,
      reason: "tow-session-v2-event-limit-exceeded",
    });
  });

  it("validates terminal truth instead of trusting a serialized status flag", () => {
    const forged = structuredClone(opening());
    forged.status = "terminal";
    forged.terminal = {
      result: "victory",
      revision: 0,
      stateChecksum: "state-v2:0000000000000000",
    };
    expect(encodeTowSessionV2(sealTowSessionV2(forged))).toMatchObject({
      ok: false,
      reason: "invalid-tow-session-v2-terminal-state",
    });
  });
});
