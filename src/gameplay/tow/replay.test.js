import { describe, expect, it } from "vitest";
import { gameplayChecksum } from "../kernel/replay.js";
import { dispatchTowCommand } from "./commands.js";
import { sealTowTerminalReceipt } from "./outcomes.js";
import { firstJsonDifference, replayTowCombatSession, verifyTowSession } from "./replay.js";
import { createTowSession, markTowSessionSettled, spendTowSessionStream } from "./session.js";

function open(context = {}) {
  const opened = createTowSession({
    sessionId: "combat-1",
    rootSeed: "seed-1",
    player: {
      id: "wanderer",
      name: "Wanderer",
      maxHp: 170,
      stats: { attack: 12, defense: 13, critRate: 9, dodgeRate: 4 },
    },
    enemies: [{
      id: "foe-0",
      name: "Bandit",
      maxHp: 90,
      stats: { attack: 9, defense: 2, critRate: 6, dodgeRate: 3 },
      attacks: [
        { id: "jab", name: "Jab", hits: 1, damage: 5 },
        { id: "heavy", name: "Heavy blow", hits: 1, damage: 11 },
      ],
    }],
    build: { traits: { ironclad: 3 }, skills: ["strike", "block"] },
    context,
  });
  if (!opened.ok) throw new Error(opened.reason);
  return opened.session;
}

function play(session, rounds = 3) {
  let current = session;
  for (let round = 0; round < rounds && current.encounter.phase === "player"; round += 1) {
    current = dispatchTowCommand(current, {
      id: `strike-${round}`,
      expectedRevision: current.revision,
      type: "use-skill",
      actorId: "wanderer",
      skillId: "strike",
      targetId: "foe-0",
    }).session;
    if (current.encounter.phase !== "player") break;
    current = dispatchTowCommand(current, {
      id: `end-${round}`,
      expectedRevision: current.revision,
      type: "end-turn",
      actorId: "wanderer",
    }).session;
  }
  return current;
}

function openMoving(version) {
  const opened = createTowSession({
    sessionId: `moving-v${version}`,
    rootSeed: `moving-seed-v${version}`,
    player: {
      id: "wanderer",
      name: "Wanderer",
      maxHp: 500,
      stats: { attack: 12, defense: 13, critRate: 0, dodgeRate: 0 },
    },
    enemies: [{
      id: "foe-0",
      name: "Bandit",
      maxHp: 500,
      stats: { attack: 1, defense: 0, critRate: 0, dodgeRate: 0 },
      attacks: [{ id: "jab", name: "Jab", hits: 1, damage: 1 }],
    }],
    build: { traits: {}, skills: ["clocktower-grenade-toss"], runes: [] },
    formations: {
      version,
      player: ["wanderer", null, null, null, null, null, null, null, null],
      enemy: ["foe-0", null, null, null, null, null, null, null, null],
    },
  });
  if (!opened.ok) throw new Error(opened.reason);
  return opened.session;
}

function advanceMoving(session) {
  const result = dispatchTowCommand(session, {
    id: "end-moving-round",
    expectedRevision: session.revision,
    type: "end-turn",
    actorId: "wanderer",
  });
  if (!result.ok) throw new Error(result.reason);
  return result.session;
}

describe("replaying from genesis", () => {
  it("reproduces the live encounter byte for byte", () => {
    const session = play(open());
    const replayed = replayTowCombatSession(session.genesis, session.commands);
    expect(replayed.ok).toBe(true);
    expect(replayed.encounter).toEqual(session.encounter);
    expect(gameplayChecksum(replayed.encounter)).toBe(gameplayChecksum(session.encounter));
  });

  it("replays a v2 round reflow byte for byte from the authored formation", () => {
    const session = advanceMoving(openMoving(2));
    const replayed = replayTowCombatSession(session.genesis, session.commands);

    expect(session.genesis.formations.player[0]).toBe("wanderer");
    expect(session.encounter.formations.player[3]).toBe("wanderer");
    expect(session.encounter.events.some((event) => event.type === "formation-moved")).toBe(true);
    expect(replayed).toMatchObject({ ok: true, replayedCommands: 1 });
    expect(replayed.encounter).toEqual(session.encounter);
    expect(verifyTowSession(session)).toEqual({ ok: true, reason: null, divergence: null });
  });

  it("keeps the same movement-eligible command byte-static under v1 rules", () => {
    const opened = openMoving(1);
    const session = advanceMoving(opened);
    const replayed = replayTowCombatSession(session.genesis, session.commands);

    expect(session.encounter.formations).toEqual(opened.encounter.formations);
    expect(session.encounter.events.some((event) => event.type === "formation-moved")).toBe(false);
    expect(replayed.ok).toBe(true);
    expect(replayed.encounter).toEqual(session.encounter);
  });

  it("reproduces the terminal receipt too", () => {
    let session = play(open({ lethalPolicy: "lethal" }), 40);
    session = sealTowTerminalReceipt(session).session;
    expect(session.terminalReceipt).not.toBe(null);
    expect(verifyTowSession(session).ok).toBe(true);
  });

  it("reproduces the telegraph sequence and where the intent stream stopped", () => {
    const session = play(open());
    const replayed = replayTowCombatSession(session.genesis, session.commands);
    const declarations = (events) => events
      .filter((event) => event.type === "intent-declared")
      .map((event) => [event.sequence, event.enemyId, event.attackId, event.declarationIndex]);
    expect(declarations(replayed.encounter.events)).toEqual(declarations(session.encounter.events));
    expect(declarations(session.encounter.events).length).toBeGreaterThan(1);
    expect(replayed.encounter.intentRng).toEqual(session.encounter.intentRng);
    expect(replayed.encounter.intents).toEqual(session.encounter.intents);
  });

  it("records the intent stream separately from the combat stream on each command", () => {
    // A command that only ends the turn spends both; one that only strikes spends combat.
    // Recording them apart is what makes "the telegraph did not touch the damage roll"
    // checkable rather than asserted.
    const session = play(open());
    const ended = session.commands.find((command) => command.type === "end-turn");
    const struck = session.commands.find((command) => command.type === "use-skill");
    expect(Object.keys(ended.streams).sort()).toEqual(["combat", "intent"]);
    expect(Object.keys(struck.streams)).toEqual(["combat"]);
  });

  it("needs genesis; a command log alone proves nothing", () => {
    const session = play(open());
    const replayed = replayTowCombatSession({ ...session.genesis, seedManifest: null }, session.commands);
    expect(replayed.ok).toBe(false);
    expect(replayed.encounter).toBe(null);
  });

  it("refuses to replay more commands than it will hold", () => {
    const session = open();
    const tooMany = Array.from({ length: 5000 }, (_, index) => ({ id: `c-${index}` }));
    expect(replayTowCombatSession(session.genesis, tooMany).reason)
      .toBe("replay-command-limit-exceeded");
  });
});

describe("verifying a saved session", () => {
  it("passes on a session that was actually played", () => {
    expect(verifyTowSession(play(open()))).toMatchObject({ ok: true, divergence: null });
  });

  it("does not mutate what it verifies", () => {
    const session = play(open());
    const before = JSON.stringify(session);
    verifyTowSession(session);
    expect(JSON.stringify(session)).toBe(before);
  });

  it("catches an encounter edited behind the command log, with a field path", () => {
    const session = play(open());
    const tampered = JSON.parse(JSON.stringify(session));
    tampered.encounter.actors["foe-0"].hp = 999;
    const verified = verifyTowSession(tampered);
    expect(verified.ok).toBe(false);
    expect(verified.reason).toBe("replay-state-divergence");
    expect(verified.divergence.path).toBe("encounter.actors.foe-0.hp");
    expect(verified.divergence.expected).toBe(999);
  });

  it("localises a divergence to the command that caused it", () => {
    const session = play(open());
    const tampered = JSON.parse(JSON.stringify(session));
    tampered.commands[1].stateChecksum = "0000000000000000";
    const verified = verifyTowSession(tampered);
    expect(verified.ok).toBe(false);
    expect(verified.divergence.commandSeq).toBe(1);
    expect(verified.divergence.commandId).toBe(tampered.commands[1].id);
  });

  it("catches a spliced event range", () => {
    const session = play(open());
    const tampered = JSON.parse(JSON.stringify(session));
    tampered.commands[0].eventsTo += 1;
    const verified = verifyTowSession(tampered);
    expect(verified.ok).toBe(false);
    expect(verified.reason).toBe("replay-event-range-mismatch");
    expect(verified.divergence.commandSeq).toBe(0);
  });

  it("catches a stream endpoint that moved without a fight moving it", () => {
    // Streams are compared independently, which is the point of splitting them: loot must
    // not advance because combat did.
    const session = play(open());
    const tampered = JSON.parse(JSON.stringify(session));
    tampered.streams.loot = { algorithm: "mulberry32", state: 12345 };
    const verified = verifyTowSession(tampered);
    expect(verified.ok).toBe(false);
    expect(verified.reason).toBe("replay-stream-divergence");
    expect(verified.divergence.path).toBe("streams.loot.state");
  });

  it("catches a terminal receipt that does not match the fight", () => {
    let session = play(open({ lethalPolicy: "nonlethal" }), 40);
    session = sealTowTerminalReceipt(session).session;
    const tampered = JSON.parse(JSON.stringify(session));
    const foe = tampered.terminalReceipt.participants.find((o) => o.participantId === "foe-0");
    foe.worldFate = "dead";
    foe.combatState = "dead";
    const verified = verifyTowSession(tampered);
    expect(verified.ok).toBe(false);
    expect(verified.reason).toBe("replay-receipt-divergence");
  });

  it("verifies a sealed receipt after settlement legitimately spends its own streams", () => {
    const terminal = sealTowTerminalReceipt(
      play(open({ lethalPolicy: "nonlethal" }), 40),
    ).session;
    const endpoint = {
      ...terminal.streams.loot,
      state: (terminal.streams.loot.state + 1) >>> 0,
    };
    const spent = spendTowSessionStream(terminal, "loot", endpoint);
    expect(spent.ok).toBe(true);
    const closed = markTowSessionSettled(spent.session, terminal.sessionId);
    expect(closed.ok).toBe(true);
    expect(verifyTowSession(closed.session)).toEqual({
      ok: true,
      reason: null,
      divergence: null,
    });

    const forged = JSON.parse(JSON.stringify(closed.session));
    forged.terminalReceipt.streamEndpoints.loot.state = endpoint.state;
    expect(verifyTowSession(forged)).toMatchObject({
      ok: false,
      reason: "replay-receipt-divergence",
    });
  });

  it("reports a command the current rules would no longer accept", () => {
    const session = play(open());
    const tampered = JSON.parse(JSON.stringify(session));
    tampered.commands[0].skillId = "meteor";
    const verified = verifyTowSession(tampered);
    expect(verified.ok).toBe(false);
    expect(verified.reason).toBe("replay-command-refused");
    expect(verified.divergence.commandSeq).toBe(0);
  });
});

describe("finding the first difference", () => {
  it("returns null for equal values", () => {
    expect(firstJsonDifference({ a: [1, 2], b: null }, { a: [1, 2], b: null })).toBe(null);
  });

  it("walks keys in sorted order so the answer is stable", () => {
    const diff = firstJsonDifference({ b: 1, a: 1 }, { b: 2, a: 2 });
    expect(diff.path).toBe("a");
  });

  it("reports an index for an array difference", () => {
    expect(firstJsonDifference({ hits: [1, 2, 3] }, { hits: [1, 9, 3] }).path).toBe("hits[1]");
  });

  it("reports a missing key rather than skipping it", () => {
    expect(firstJsonDifference({ a: 1 }, {}).path).toBe("a");
    expect(firstJsonDifference({}, { a: 1 }).path).toBe("a");
  });
});
