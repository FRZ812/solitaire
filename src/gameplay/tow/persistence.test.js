import { describe, expect, it } from "vitest";
import { dispatchTowCommand } from "./commands.js";
import { sealTowTerminalReceipt } from "./outcomes.js";
import { decodeTowSession, encodeTowSession, isStoredTowSession } from "./persistence.js";
import { createTowSession, markTowSessionSettled, sealTowSession } from "./session.js";

function open(context = {}, { current = false, combatItems = [] } = {}) {
  const opened = createTowSession({
    sessionId: "combat-1",
    rootSeed: "seed-1",
    player: {
      id: "wanderer",
      name: "Wanderer",
      maxHp: 170,
      ...(current ? { resolve: 8, resolveMax: 8 } : {}),
      stats: { attack: 12, defense: 13, critRate: 0, dodgeRate: 0 },
    },
    enemies: [{
      id: "foe-0",
      name: "Bandit",
      maxHp: 60,
      stats: { attack: 5, defense: 0, critRate: 0, dodgeRate: 0 },
      attacks: [{ id: "jab", name: "Jab", hits: 1, damage: 4 }],
    }],
    build: { traits: {}, skills: ["strike", "block"], ...(combatItems.length ? { combatItems } : {}) },
    context,
  });
  if (!opened.ok) throw new Error(opened.reason);
  return opened.session;
}

function play(session, rounds) {
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

/** Round-trip through JSON, the way a real save actually travels. */
function stored(session) {
  return JSON.parse(JSON.stringify(session));
}

describe("the reload gates", () => {
  it("reads back a session admitted but not yet commanded", () => {
    const decoded = decodeTowSession(stored(open()));
    expect(decoded.ok).toBe(true);
    expect(decoded.session.revision).toBe(0);
    expect(decoded.session.status).toBe("active");
  });

  it("reads back an active session mid-fight", () => {
    const session = play(open(), 2);
    const decoded = decodeTowSession(stored(session));
    expect(decoded.ok).toBe(true);
    expect(decoded.session.encounter).toEqual(session.encounter);
    expect(decoded.session.commands).toHaveLength(session.commands.length);
  });

  it("round-trips a current item command with its exact snapshotted spend", () => {
    const session = open({}, {
      current: true,
      combatItems: [{ id: "fire-pot", quantity: 1 }],
    });
    const used = dispatchTowCommand(session, {
      id: "throw-fire-pot",
      expectedRevision: 0,
      type: "use-item",
      actorId: "wanderer",
      itemId: "fire-pot",
      skillId: null,
      targetId: "foe-0",
    });
    expect(used.ok).toBe(true);
    const decoded = decodeTowSession(stored(used.session));
    expect(decoded.ok).toBe(true);
    expect(decoded.session.commands[0]).toMatchObject({
      type: "use-item",
      itemId: "fire-pot",
    });
    expect(decoded.session.encounter.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "combat-item-used", itemId: "fire-pot" }),
    ]));
  });

  it("continues to read v1 command rows written before itemId existed", () => {
    const legacy = stored(play(open(), 1));
    legacy.commands.forEach((command) => delete command.itemId);
    const decoded = decodeTowSession(sealTowSession({ ...legacy, checksum: null }));
    expect(decoded.ok).toBe(true);
  });

  it("reads back a terminal session before settlement", () => {
    const session = sealTowTerminalReceipt(play(open({ lethalPolicy: "lethal" }), 40)).session;
    const decoded = decodeTowSession(stored(session));
    expect(decoded.ok).toBe(true);
    expect(decoded.session.status).toBe("terminal");
    expect(decoded.session.terminalReceipt.reason).toBe("victory");
  });

  it("reads back a settled session with its aftermath still pending", () => {
    const terminal = sealTowTerminalReceipt(play(open({ lethalPolicy: "lethal" }), 40)).session;
    const settled = markTowSessionSettled(terminal, "settle-1").session;
    const decoded = decodeTowSession(stored(settled));
    expect(decoded.ok).toBe(true);
    expect(decoded.session.status).toBe("settled");
    expect(decoded.session.settlementId).toBe("settle-1");
  });

  it("encodes only what it would agree to decode", () => {
    const session = play(open(), 2);
    expect(encodeTowSession(session).ok).toBe(true);
    expect(encodeTowSession({ ...session, revision: 99 })).toMatchObject({
      ok: false,
      payload: null,
    });
  });
});

describe("refusing a payload it cannot trust", () => {
  it("rejects a tampered encounter through the checksum", () => {
    const session = stored(play(open(), 2));
    session.encounter.actors["foe-0"].hp = 1;
    expect(decodeTowSession(session).reason).toBe("tow-session-checksum-mismatch");
  });

  it("rejects a foreign or future version and ruleset", () => {
    const session = stored(open());
    expect(decodeTowSession({ ...session, version: 2 }).reason).toBe("unsupported-tow-session-version");
    expect(decodeTowSession({ ...session, rulesetId: "solitaire-tow-v2" }).reason)
      .toBe("unsupported-tow-ruleset");
  });

  it("rejects anything that is not JSON data at all", () => {
    expect(decodeTowSession(undefined).reason).toBe("invalid-tow-session-payload");
    expect(decodeTowSession({ nested: { bad: Number.POSITIVE_INFINITY } }).reason)
      .toBe("invalid-tow-session-payload");
    const cyclic = { a: 1 };
    cyclic.self = cyclic;
    expect(decodeTowSession(cyclic).reason).toBe("invalid-tow-session-payload");
  });

  it("does not let a payload smuggle in a prototype", () => {
    const session = play(open(), 2);
    const payload = JSON.parse(`{"__proto__":{"polluted":true},${JSON.stringify(session).slice(1)}`);
    const decoded = decodeTowSession(payload);
    expect(decoded.ok).toBe(false);
    expect({}.polluted).toBe(undefined);
  });

  it("rejects a command log with a gap, a reorder, or a repeated id", () => {
    const base = play(open(), 3);

    const gapped = stored(base);
    gapped.commands.splice(1, 1);
    gapped.revision -= 1;
    expect(decodeTowSession(sealTowSession({ ...gapped, checksum: null })).reason)
      .toBe("command-sequence-gap");

    const repeated = stored(base);
    repeated.commands[1].id = repeated.commands[0].id;
    expect(decodeTowSession(sealTowSession({ ...repeated, checksum: null })).reason)
      .toBe("duplicate-command-id");

    const reordered = stored(base);
    reordered.commands[1].expectedRevision = 0;
    expect(decodeTowSession(sealTowSession({ ...reordered, checksum: null })).reason)
      .toBe("command-revision-mismatch");
  });

  it("rejects an event range that leaves events unaccounted for", () => {
    const base = stored(play(open(), 2));
    base.commands[base.commands.length - 1].eventsTo -= 1;
    expect(decodeTowSession(sealTowSession({ ...base, checksum: null })).reason)
      .toBe("event-range-discontinuity");
  });

  it("rejects an unknown randomness stream on a command", () => {
    const base = stored(play(open(), 2));
    base.commands[0].streams.weather = { algorithm: "mulberry32", state: 4 };
    expect(decodeTowSession(sealTowSession({ ...base, checksum: null })).reason)
      .toBe("unknown-command-stream");
  });

  it("rejects a hand-edited player death the admission never authorized", () => {
    // The last line of defence for the rule that matters most: permanent death is only
    // reachable from an admission that said so, and a save file cannot introduce one.
    const terminal = sealTowTerminalReceipt(play(open({ lethalPolicy: "lethal" }), 40)).session;
    const forged = stored(terminal);
    const player = forged.terminalReceipt.participants.find((o) => o.participantId === "wanderer");
    player.combatState = "dead";
    player.worldFate = "dead";
    forged.terminalReceipt.playerWorldFate = "dead";
    expect(decodeTowSession(sealTowSession({ ...forged, checksum: null })).reason)
      .toBe("unauthorized-player-death");
  });

  it("rejects a receipt that contradicts itself", () => {
    const terminal = sealTowTerminalReceipt(play(open({ lethalPolicy: "lethal" }), 40)).session;
    const forged = stored(terminal);
    const foe = forged.terminalReceipt.participants.find((o) => o.participantId === "foe-0");
    foe.combatState = "standing";
    foe.worldFate = "dead";
    expect(decodeTowSession(sealTowSession({ ...forged, checksum: null })).reason)
      .toBe("contradictory-participant-outcome");
  });

  it("rejects a receipt that skips a participant", () => {
    const terminal = sealTowTerminalReceipt(play(open({ lethalPolicy: "lethal" }), 40)).session;
    const forged = stored(terminal);
    forged.terminalReceipt.participants = forged.terminalReceipt.participants
      .filter((outcome) => outcome.participantId === "wanderer");
    expect(decodeTowSession(sealTowSession({ ...forged, checksum: null })).reason)
      .toBe("incomplete-terminal-receipt");
  });

  it("rejects a receipt belonging to another fight", () => {
    const terminal = sealTowTerminalReceipt(play(open({ lethalPolicy: "lethal" }), 40)).session;
    const forged = stored(terminal);
    forged.terminalReceipt.sessionId = "combat-2";
    expect(decodeTowSession(sealTowSession({ ...forged, checksum: null })).reason)
      .toBe("terminal-receipt-session-mismatch");
  });
});

describe("isStoredTowSession", () => {
  it("answers without unpacking anything", () => {
    expect(isStoredTowSession(stored(play(open(), 2)))).toBe(true);
    expect(isStoredTowSession(null)).toBe(false);
    expect(isStoredTowSession({ version: 1 })).toBe(false);
  });
});
