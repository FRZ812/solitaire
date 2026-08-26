import { describe, expect, it } from "vitest";
import { TOW_ABILITY_RULESET_V2_ID, TOW_ABILITY_RULES_V2_VERSION } from "./ability-rules-v2.js";
import { createTowActorV2 } from "./actor-v2.js";
import { TOW_AI_POLICY_REGISTRY_V2_CHECKSUM } from "./ai-v2.js";
import { dispatchTowCommandV2, validateTowCommandLogV2 } from "./commands-v2.js";
import {
  PINNED_TOW_ABILITY_CATALOG_V2_CHECKSUM,
  TOW_ENCOUNTER_POLICY_V2_ID,
} from "./encounter-state-v2.js";
import { createTowSessionV2, validateTowSessionV2 } from "./session-v2.js";

function actor({
  id,
  side,
  hp = 500,
  preferredRow = 0,
  loadout = [{ id: "arctic-strike", rank: 1 }],
  controller = side === "player" ? "human" : "ai",
  speed = 10,
}) {
  const created = createTowActorV2({
    id,
    name: id,
    side,
    controller,
    aiProfile: controller === "human" ? null : { id: "knight", version: 1 },
    preferredRow,
    hp,
    maxHp: hp,
    shield: 0,
    stats: { attack: 100, defense: 0, speed, critChanceBps: 0, dodgeChanceBps: 0 },
    loadout,
  });
  if (!created.ok) throw new TypeError(created.reason);
  return created.actor;
}

function session3v3() {
  const players = [
    actor({
      id: "p:auto",
      side: "player",
      loadout: [
        { id: "automaton-infinite-power", rank: 1 },
        { id: "automaton-scorched-earth", rank: 1 },
      ],
    }),
    actor({
      id: "p:knight",
      side: "player",
      preferredRow: 1,
      loadout: [{ id: "arctic-block", rank: 1 }, { id: "arctic-strike", rank: 1 }],
    }),
    actor({ id: "p:paladin", side: "player", preferredRow: 2 }),
  ];
  const enemies = [0, 1, 2].map((index) => actor({
    id: `e:${index}`,
    side: "enemy",
    hp: 100,
    preferredRow: index,
  }));
  const actors = [...players, ...enemies];
  const created = createTowSessionV2({
    sessionId: "commands:mixed-3v3",
    genesis: {
      aiPolicyChecksum: TOW_AI_POLICY_REGISTRY_V2_CHECKSUM,
      catalogChecksum: PINNED_TOW_ABILITY_CATALOG_V2_CHECKSUM,
      policyId: TOW_ENCOUNTER_POLICY_V2_ID,
      rosters: { player: players.map(({ id }) => id), enemy: enemies.map(({ id }) => id) },
      actors,
      resolveSeeds: actors.map(({ id }) => ({
        id,
        resolve: id === "p:auto" ? 10 : id === "p:knight" ? 4 : 0,
        maxResolve: 12,
      })),
    },
  });
  if (!created.ok) throw new TypeError(created.reason);
  return created.session;
}

function command(session, commandId, type, fields = {}, expectedRevision = session.revision) {
  return {
    version: TOW_ABILITY_RULES_V2_VERSION,
    rulesetId: TOW_ABILITY_RULESET_V2_ID,
    commandId,
    expectedRevision,
    type,
    ...fields,
  };
}

function dispatch(session, id, type, fields = {}) {
  const result = dispatchTowCommandV2(session, command(session, id, type, fields));
  if (!result.ok) throw new TypeError(result.reason);
  return result;
}

describe("v2 exactly-once command authority", () => {
  it("records every staged AI transition and its persisted intent as an exact command", () => {
    const player = actor({ id: "p:human", side: "player", speed: 10 });
    const enemy = actor({ id: "e:ai", side: "enemy", speed: 20 });
    const actors = [player, enemy];
    const created = createTowSessionV2({
      sessionId: "commands:staged-ai",
      genesis: {
        aiPolicyChecksum: TOW_AI_POLICY_REGISTRY_V2_CHECKSUM,
        catalogChecksum: PINNED_TOW_ABILITY_CATALOG_V2_CHECKSUM,
        policyId: TOW_ENCOUNTER_POLICY_V2_ID,
        rosters: { player: [player.id], enemy: [enemy.id] },
        actors,
        resolveSeeds: actors.map(({ id }) => ({ id, resolve: 10, maxResolve: 20 })),
      },
    });
    if (!created.ok) throw new TypeError(created.reason);
    const randomDraws = [9_999, 9_999, 123, 456];
    let session = created.session;
    expect(dispatchTowCommandV2(session, command(session, "c:ai:oversized", "ai-step", {
      randomDraws: Array(8_193).fill(0),
    }))).toMatchObject({
      ok: false,
      reason: "invalid-tow-command-v2-input",
      session,
    });
    expect(dispatchTowCommandV2(session, command(session, "c:ai:sparse", "ai-step", {
      randomDraws: Array(2),
    }))).toMatchObject({
      ok: false,
      reason: "invalid-tow-command-v2-input",
      session,
    });
    const stages = [];
    let declarationInput = null;
    for (let index = 0; index < 6; index += 1) {
      const input = command(session, `c:ai:${index + 1}`, "ai-step", { randomDraws });
      const landed = dispatchTowCommandV2(session, input);
      expect(landed.ok, landed.reason).toBe(true);
      session = landed.session;
      stages.push(landed.command.transaction.stage);
      if (landed.command.transaction.stage === "intent-declared") {
        declarationInput = input;
        expect(session.encounter.intents[enemy.id]).toMatchObject({
          abilityId: "arctic-strike",
          declaredSequence: 1,
          policyId: "knight-v1",
        });
      }
    }

    expect(stages).toEqual([
      "round-started",
      "actor-turn-started",
      "intent-declared",
      "action-executed",
      "actor-turn-ended",
      "actor-turn-started",
    ]);
    expect(session).toMatchObject({
      revision: 6,
      status: "active",
      encounter: {
        intents: {},
        intentSequence: 2,
        economy: { phase: "actor-turn", activeActorId: player.id },
      },
    });
    expect(session.commands.every(({ command: accepted }) => accepted.type === "ai-step"))
      .toBe(true);
    expect(session.commands[3].transaction).toMatchObject({
      stage: "action-executed",
      abilityId: "arctic-strike",
      drawsConsumed: 2,
      drawsProvided: randomDraws.length,
    });
    expect(session.events).toContainEqual(expect.objectContaining({
      type: "ai-intent-declared",
      commandId: "c:ai:3",
      declaredSequence: 1,
    }));
    expect(validateTowCommandLogV2(session)).toEqual({ ok: true, reason: null });
    expect(validateTowSessionV2(session)).toEqual({ ok: true, reason: null });

    expect(dispatchTowCommandV2(session, declarationInput)).toMatchObject({
      ok: true,
      duplicate: true,
      session,
      command: { transaction: { stage: "intent-declared" } },
    });
  });

  it("executes the complete authored round and actor-turn command lifecycle", () => {
    const players = [actor({ id: "p:manual", side: "player" })];
    const enemies = [actor({ id: "e:manual", side: "enemy", controller: "human" })];
    const actors = [...players, ...enemies];
    const created = createTowSessionV2({
      sessionId: "commands:manual-round",
      genesis: {
        aiPolicyChecksum: TOW_AI_POLICY_REGISTRY_V2_CHECKSUM,
        catalogChecksum: PINNED_TOW_ABILITY_CATALOG_V2_CHECKSUM,
        policyId: TOW_ENCOUNTER_POLICY_V2_ID,
        rosters: { player: ["p:manual"], enemy: ["e:manual"] },
        actors,
        resolveSeeds: actors.map(({ id }) => ({ id, resolve: 0, maxResolve: 10 })),
      },
    });
    if (!created.ok) throw new TypeError(created.reason);

    let session = dispatch(created.session, "c:round", "round-start").session;
    session = dispatch(session, "c:p-start", "actor-turn-start", { actorId: "p:manual" }).session;
    session = dispatch(session, "c:p-end", "actor-turn-end", { actorId: "p:manual" }).session;
    session = dispatch(session, "c:e-start", "actor-turn-start", { actorId: "e:manual" }).session;
    session = dispatch(session, "c:e-end", "actor-turn-end", { actorId: "e:manual" }).session;
    session = dispatch(session, "c:round-end", "round-end").session;

    expect(session).toMatchObject({ revision: 6, status: "active" });
    expect(session.encounter.economy).toMatchObject({ phase: "between-rounds", round: 1 });
    expect(session.commands.map(({ command }) => command.type)).toEqual([
      "round-start",
      "actor-turn-start",
      "actor-turn-end",
      "actor-turn-start",
      "actor-turn-end",
      "round-end",
    ]);
    expect(validateTowCommandLogV2(session)).toEqual({ ok: true, reason: null });
  });

  it("records contiguous ownership, revisions, and both state checksums through a mixed 3v3 victory", () => {
    let session = session3v3();
    session = dispatch(session, "c:round", "round-start").session;
    session = dispatch(session, "c:turn", "actor-turn-start", { actorId: "p:auto" }).session;
    session = dispatch(session, "c:quick", "ability", {
      actorId: "p:auto",
      abilityId: "automaton-infinite-power",
      anchor: "p:knight",
      randomDraws: [],
    }).session;
    const main = dispatch(session, "c:main", "ability", {
      actorId: "p:auto",
      abilityId: "automaton-scorched-earth",
      anchor: { side: "enemy", index: 4 },
      randomDraws: [9_999, 9_999, 9_999, 9_999, 9_999, 9_999],
    });
    session = main.session;

    expect(session).toMatchObject({ revision: 4, status: "terminal" });
    expect(session.terminal).toMatchObject({ result: "victory", revision: 4 });
    expect(session.commands.map(({ expectedRevision, revision }) => [expectedRevision, revision]))
      .toEqual([[0, 1], [1, 2], [2, 3], [3, 4]]);
    expect(session.commands.map(({ eventsFrom, eventsTo }) => [eventsFrom, eventsTo]))
      .toEqual(session.commands.map((record, index, records) => [
        index === 0 ? 0 : records[index - 1].eventsTo,
        record.eventsTo,
      ]));
    expect(session.commands.every(({ stateBeforeChecksum, stateAfterChecksum }) => (
      /^state-v2:[0-9a-f]{16}$/.test(stateBeforeChecksum)
      && /^state-v2:[0-9a-f]{16}$/.test(stateAfterChecksum)
    ))).toBe(true);
    expect(session.events.every((event) => (
      session.commands.some((record) => record.commandId === event.commandId)
    ))).toBe(true);
    expect(validateTowCommandLogV2(session)).toEqual({ ok: true, reason: null });
    expect(validateTowSessionV2(session)).toEqual({ ok: true, reason: null });
    expect(main.command.transaction).toMatchObject({ lane: "main", combatResult: "victory" });
    expect(dispatchTowCommandV2(session, command(session, "c:after", "round-end")))
      .toMatchObject({ ok: false, reason: "tow-session-v2-terminal" });

    const terminalRetry = command(session, "c:main", "ability", {
      actorId: "p:auto",
      abilityId: "automaton-scorched-earth",
      anchor: { side: "enemy", index: 4 },
      randomDraws: [9_999, 9_999, 9_999, 9_999, 9_999, 9_999],
    }, 3);
    expect(dispatchTowCommandV2(session, terminalRetry))
      .toMatchObject({ ok: true, duplicate: true, session });
  });

  it("makes an identical retry free and rejects conflicting IDs or stale revisions", () => {
    const opening = session3v3();
    const input = command(opening, "c:round", "round-start");
    const first = dispatchTowCommandV2(opening, input);
    expect(first.ok).toBe(true);

    const duplicate = dispatchTowCommandV2(first.session, input);
    expect(duplicate).toMatchObject({ ok: true, duplicate: true, session: first.session });
    expect(duplicate.command).toBe(first.session.commands[0]);

    expect(dispatchTowCommandV2(first.session, command(
      first.session,
      "c:round",
      "round-end",
      {},
      0,
    ))).toMatchObject({ ok: false, reason: "tow-command-v2-id-conflict" });
    expect(dispatchTowCommandV2(first.session, command(
      first.session,
      "c:stale",
      "round-end",
      {},
      0,
    ))).toMatchObject({ ok: false, reason: "stale-tow-session-v2-revision" });
  });

  it("arms reactions durably while rejecting extra keys, AI ownership, and the wrong command lane", () => {
    const opening = session3v3();
    const malformed = {
      ...command(opening, "c:bad", "round-start"),
      inferred: true,
    };
    expect(dispatchTowCommandV2(opening, malformed)).toMatchObject({
      ok: false,
      reason: "invalid-tow-command-v2-input",
      session: opening,
    });

    const round = dispatch(opening, "c:round", "round-start").session;
    expect(dispatchTowCommandV2(round, command(round, "c:ai", "actor-turn-start", {
      actorId: "e:0",
    }))).toMatchObject({ ok: false, reason: "tow-v2-ai-not-executable" });
    expect(dispatchTowCommandV2(round, command(round, "c:ai-arm", "reaction-arm", {
      actorId: "e:0",
      abilityId: "arctic-strike",
      anchor: "e:0",
    }))).toMatchObject({ ok: false, reason: "tow-v2-ai-not-executable" });

    const autoTurn = dispatch(round, "c:auto", "actor-turn-start", {
      actorId: "p:auto",
    }).session;
    const afterAuto = dispatch(autoTurn, "c:auto-end", "actor-turn-end", {
      actorId: "p:auto",
    }).session;
    const knightTurn = dispatch(afterAuto, "c:knight", "actor-turn-start", {
      actorId: "p:knight",
    }).session;
    expect(dispatchTowCommandV2(knightTurn, command(knightTurn, "c:reaction", "ability", {
      actorId: "p:knight",
      abilityId: "arctic-block",
      anchor: "p:knight",
      randomDraws: [],
    }))).toMatchObject({ ok: false, reason: "encounter-v2-reaction-arm-command-required" });
    const armed = dispatchTowCommandV2(knightTurn, command(knightTurn, "c:arm", "reaction-arm", {
      actorId: "p:knight",
      abilityId: "arctic-block",
      anchor: "p:auto",
    }));
    expect(armed).toMatchObject({
      ok: true,
      duplicate: false,
      command: {
        command: { type: "reaction-arm", actorId: "p:knight", abilityId: "arctic-block" },
        transaction: { type: "reaction-arm", committed: true, armedSequence: 1 },
      },
    });
    expect(armed.session.encounter.economy.actors["p:knight"].armedReaction)
      .toMatchObject({ abilityId: "arctic-block", watchedActorId: "p:auto" });
    expect(armed.events).toContainEqual(expect.objectContaining({
      type: "reaction-armed",
      abilityId: "arctic-block",
      armedSequence: 1,
      targetLock: expect.any(Object),
    }));
    expect(dispatchTowCommandV2(armed.session, command(
      knightTurn,
      "c:arm",
      "reaction-arm",
      { actorId: "p:knight", abilityId: "arctic-block", anchor: "p:auto" },
    ))).toMatchObject({ ok: true, duplicate: true, session: armed.session });
    expect(dispatchTowCommandV2(knightTurn, {
      ...command(knightTurn, "c:arm-extra", "reaction-arm", {
        actorId: "p:knight",
        abilityId: "arctic-block",
        anchor: "p:auto",
      }),
      randomDraws: [],
    })).toMatchObject({ ok: false, reason: "invalid-tow-command-v2-input" });
    expect(dispatchTowCommandV2(knightTurn, {
      type: "ai-turn",
    })).toMatchObject({ ok: false, reason: "tow-v2-ai-not-executable" });
  });
});
