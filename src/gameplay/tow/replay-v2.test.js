import { describe, expect, it } from "vitest";
import { TOW_ABILITY_RULESET_V2_ID, TOW_ABILITY_RULES_V2_VERSION } from "./ability-rules-v2.js";
import { createTowActorV2 } from "./actor-v2.js";
import { TOW_AI_POLICY_REGISTRY_V2_CHECKSUM } from "./ai-v2.js";
import { dispatchTowCommandV2, towCommandInputChecksumV2 } from "./commands-v2.js";
import {
  PINNED_TOW_ABILITY_CATALOG_V2_CHECKSUM,
  TOW_ENCOUNTER_POLICY_V2_ID,
} from "./encounter-state-v2.js";
import { replayTowSessionV2 } from "./replay-v2.js";
import {
  createTowSessionV2,
  sealTowSessionV2,
  towGenesisChecksumV2,
} from "./session-v2.js";

function actor({
  id,
  side,
  hp = 500,
  preferredRow = 0,
  loadout = [{ id: "arctic-strike", rank: 1 }],
  speed = 10,
}) {
  const created = createTowActorV2({
    id,
    name: id,
    side,
    controller: side === "player" ? "human" : "ai",
    aiProfile: side === "player" ? null : { id: "knight", version: 1 },
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

function opening() {
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
    sessionId: "replay:mixed-3v3",
    genesis: {
      aiPolicyChecksum: TOW_AI_POLICY_REGISTRY_V2_CHECKSUM,
      catalogChecksum: PINNED_TOW_ABILITY_CATALOG_V2_CHECKSUM,
      policyId: TOW_ENCOUNTER_POLICY_V2_ID,
      rosters: { player: players.map(({ id }) => id), enemy: enemies.map(({ id }) => id) },
      actors,
      resolveSeeds: actors.map(({ id }) => ({
        id,
        resolve: id === "p:auto" ? 10 : id === "p:knight" ? 2 : 0,
        maxResolve: 12,
      })),
    },
  });
  if (!created.ok) throw new TypeError(created.reason);
  return created.session;
}

function aiOpening() {
  const player = actor({ id: "p:human", side: "player", speed: 10 });
  const enemy = actor({ id: "e:ai", side: "enemy", speed: 20 });
  const actors = [player, enemy];
  const created = createTowSessionV2({
    sessionId: "replay:staged-ai",
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
  return created.session;
}

function input(session, commandId, type, fields = {}) {
  return {
    version: TOW_ABILITY_RULES_V2_VERSION,
    rulesetId: TOW_ABILITY_RULESET_V2_ID,
    commandId,
    expectedRevision: session.revision,
    type,
    ...fields,
  };
}

function land(session, commandId, type, fields = {}) {
  const result = dispatchTowCommandV2(session, input(session, commandId, type, fields));
  if (!result.ok) throw new TypeError(result.reason);
  return result.session;
}

function activeLog() {
  let session = opening();
  session = land(session, "c:round", "round-start");
  return land(session, "c:turn", "actor-turn-start", { actorId: "p:auto" });
}

function terminalLog() {
  let session = activeLog();
  session = land(session, "c:quick", "ability", {
    actorId: "p:auto",
    abilityId: "automaton-infinite-power",
    anchor: "p:knight",
    randomDraws: [],
  });
  return land(session, "c:main", "ability", {
    actorId: "p:auto",
    abilityId: "automaton-scorched-earth",
    anchor: { side: "enemy", index: 4 },
    randomDraws: [9_999, 9_999, 9_999, 9_999, 9_999, 9_999],
  });
}

function reactionLog() {
  let session = activeLog();
  session = land(session, "c:auto-end", "actor-turn-end", { actorId: "p:auto" });
  session = land(session, "c:knight-turn", "actor-turn-start", { actorId: "p:knight" });
  return land(session, "c:arm", "reaction-arm", {
    actorId: "p:knight",
    abilityId: "arctic-block",
    anchor: "p:auto",
  });
}

describe("v2 exact replay", () => {
  it("replays persisted AI declaration and its separately accepted execution byte-for-byte", () => {
    let session = aiOpening();
    for (let index = 0; index < 4; index += 1) {
      session = land(session, `c:ai:${index + 1}`, "ai-step", {
        randomDraws: [9_999, 9_999, 123, 456],
      });
    }
    expect(session.commands.map(({ transaction }) => transaction.stage)).toEqual([
      "round-started",
      "actor-turn-started",
      "intent-declared",
      "action-executed",
    ]);
    expect(session.events.find(({ type }) => type === "ai-intent-declared"))
      .toMatchObject({ commandId: "c:ai:3", declaredSequence: 1 });
    const replayed = replayTowSessionV2(session);
    expect(replayed).toMatchObject({ ok: true, replayedCommands: 4, divergence: null });
    expect(JSON.stringify(replayed.encounter)).toBe(JSON.stringify(session.encounter));
    expect(JSON.stringify(replayed.events)).toBe(JSON.stringify(session.events));
  });

  it("replays reaction arming atomically and detects a resealed target-lock rewrite", () => {
    const session = reactionLog();
    const replayed = replayTowSessionV2(session);
    expect(replayed).toMatchObject({ ok: true, replayedCommands: 5 });
    expect(replayed.encounter.economy.actors["p:knight"].armedReaction)
      .toMatchObject({ abilityId: "arctic-block", watchedActorId: "p:auto" });

    const tampered = structuredClone(session);
    const arm = tampered.commands.at(-1);
    arm.command.anchor = "p:knight";
    arm.inputChecksum = towCommandInputChecksumV2({
      commandId: arm.commandId,
      expectedRevision: arm.expectedRevision,
      ...arm.command,
    });
    expect(replayTowSessionV2(sealTowSessionV2(tampered))).toMatchObject({
      ok: false,
      reason: "tow-replay-v2-event-divergence",
      divergence: { commandId: "c:arm" },
    });
  });

  it("reconstructs mixed 3v3 state, events, terminal receipt, and bytes from genesis", () => {
    const session = terminalLog();
    const replayed = replayTowSessionV2(session);

    expect(replayed).toMatchObject({
      ok: true,
      reason: null,
      replayedCommands: 4,
      divergence: null,
    });
    expect(JSON.stringify(replayed.encounter)).toBe(JSON.stringify(session.encounter));
    expect(JSON.stringify(replayed.events)).toBe(JSON.stringify(session.events));
  });

  it("localizes resealed event and per-command state tampering", () => {
    const session = terminalLog();
    const eventTamper = structuredClone(session);
    eventTamper.events[0].type = "forged-event";
    const eventResult = replayTowSessionV2(sealTowSessionV2(eventTamper));
    expect(eventResult).toMatchObject({
      ok: false,
      reason: "tow-replay-v2-event-divergence",
      divergence: { commandIndex: 0, commandId: "c:round" },
    });

    const stateTamper = structuredClone(session);
    stateTamper.commands[2].stateAfterChecksum = "state-v2:0000000000000000";
    const stateResult = replayTowSessionV2(sealTowSessionV2(stateTamper));
    expect(stateResult).toMatchObject({
      ok: false,
      reason: "tow-replay-v2-after-state-divergence",
      divergence: { commandIndex: 2, commandId: "c:quick" },
    });
  });

  it("rejects valid-looking derived state, byte ordering, and genesis rewrites", () => {
    const session = activeLog();
    const stateTamper = structuredClone(session);
    stateTamper.encounter.actors["p:auto"].hp -= 1;
    expect(replayTowSessionV2(sealTowSessionV2(stateTamper))).toMatchObject({
      ok: false,
      reason: "tow-replay-v2-final-state-divergence",
    });

    const byteTamper = structuredClone(session);
    byteTamper.encounter = Object.fromEntries(Object.entries(byteTamper.encounter).reverse());
    expect(replayTowSessionV2(sealTowSessionV2(byteTamper))).toMatchObject({
      ok: false,
      reason: "tow-replay-v2-final-state-divergence",
    });

    const genesisTamper = structuredClone(session);
    genesisTamper.genesis.actors[0].stats.attack += 1;
    genesisTamper.genesisChecksum = towGenesisChecksumV2(genesisTamper.genesis);
    const first = genesisTamper.commands[0];
    first.inputChecksum = towCommandInputChecksumV2({
      commandId: first.commandId,
      expectedRevision: first.expectedRevision,
      ...first.command,
    });
    expect(replayTowSessionV2(sealTowSessionV2(genesisTamper))).toMatchObject({
      ok: false,
      reason: "tow-replay-v2-before-state-divergence",
      divergence: { commandIndex: 0 },
    });
  });
});
