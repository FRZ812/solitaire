import { describe, expect, it } from "vitest";
import {
  dispatchTowCommand,
  towCommandEvents,
  towSessionEvents,
  validateTowCommand,
} from "./commands.js";
import { createTowSession } from "./session.js";

function open(overrides = {}) {
  const opened = createTowSession({
    sessionId: "combat-1",
    rootSeed: "seed-1",
    player: {
      id: "wanderer",
      name: "Wanderer",
      maxHp: 170,
      stats: { attack: 12, defense: 13, critRate: 0, dodgeRate: 0 },
    },
    enemies: overrides.enemies || [{
      id: "foe-0",
      name: "Bandit",
      maxHp: 400,
      stats: { attack: 3, defense: 0, critRate: 0, dodgeRate: 0 },
      attacks: [{ id: "jab", name: "Jab", hits: 1, damage: 3 }],
    }],
    build: { traits: {}, skills: ["strike", "block"], ...overrides.build },
    context: overrides.context,
  });
  if (!opened.ok) throw new Error(opened.reason);
  return opened.session;
}

function strike(session, id = "cmd-1", targetId = "foe-0") {
  return dispatchTowCommand(session, {
    id,
    expectedRevision: session.revision,
    type: "use-skill",
    actorId: "wanderer",
    skillId: "strike",
    targetId,
  });
}

function endTurn(session, id) {
  return dispatchTowCommand(session, {
    id,
    expectedRevision: session.revision,
    type: "end-turn",
    actorId: "wanderer",
  });
}

describe("accepting a command", () => {
  it("appends it, bumps the revision, and reseals", () => {
    const session = open();
    const result = strike(session);
    expect(result.ok).toBe(true);
    expect(result.session.revision).toBe(1);
    expect(result.session.commands).toHaveLength(1);
    expect(result.session.commands[0]).toMatchObject({ id: "cmd-1", seq: 0, expectedRevision: 0 });
    expect(result.session.checksum).not.toBe(session.checksum);
  });

  it("records the range of events it produced", () => {
    const session = open();
    const result = strike(session);
    const accepted = result.session.commands[0];
    expect(accepted.eventsFrom).toBe(session.encounter.sequence);
    expect(accepted.eventsTo).toBe(result.session.encounter.sequence);
    expect(result.events.every((event) => event.commandId === "cmd-1")).toBe(true);
  });

  it("records only the streams that actually moved", () => {
    const session = open();
    const damaging = strike(session).session.commands[0];
    expect(Object.keys(damaging.streams)).toEqual(["combat"]);
  });

  it("leaves the caller's session object untouched", () => {
    const session = open();
    const before = JSON.stringify(session);
    strike(session);
    expect(JSON.stringify(session)).toBe(before);
  });
});

describe("exactly-once dispatch", () => {
  it("treats a repeated command ID as a no-op that already succeeded", () => {
    const session = open();
    const first = strike(session);
    // The same click arriving twice — from a double tap, a retry, or a resumed save.
    const again = dispatchTowCommand(first.session, {
      id: "cmd-1",
      expectedRevision: 0,
      type: "use-skill",
      actorId: "wanderer",
      skillId: "strike",
      targetId: "foe-0",
    });
    expect(again.ok).toBe(true);
    expect(again.duplicate).toBe(true);
    expect(again.session).toBe(first.session);
    expect(again.events).toEqual(first.events);
    expect(again.session.revision).toBe(1);
  });

  it("refuses a command aimed at a revision that has moved on", () => {
    const session = open();
    const first = strike(session);
    const stale = dispatchTowCommand(first.session, {
      id: "cmd-2",
      expectedRevision: 0,
      type: "use-skill",
      actorId: "wanderer",
      skillId: "strike",
      targetId: "foe-0",
    });
    expect(stale.ok).toBe(false);
    expect(stale.reason).toBe("stale-revision");
    expect(stale.session).toBe(first.session);
  });
});

describe("structured refusals", () => {
  it("refuses a skill the player does not hold", () => {
    const session = open();
    const result = dispatchTowCommand(session, {
      id: "cmd-1",
      expectedRevision: 0,
      type: "use-skill",
      actorId: "wanderer",
      skillId: "meteor",
      targetId: "foe-0",
    });
    expect(result).toMatchObject({ ok: false, reason: "skill-not-held" });
  });

  it("refuses a command for an actor the session has no model of", () => {
    const session = open();
    const result = dispatchTowCommand(session, {
      id: "cmd-1",
      expectedRevision: 0,
      type: "use-skill",
      actorId: "hired-sword",
      skillId: "strike",
      targetId: "foe-0",
    });
    expect(result).toMatchObject({ ok: false, reason: "unknown-actor" });
  });

  it("refuses a malformed command outright", () => {
    const session = open();
    expect(dispatchTowCommand(session, { id: "", expectedRevision: 0, type: "end-turn" }).reason)
      .toBe("invalid-command");
    expect(dispatchTowCommand(session, { id: "c", expectedRevision: 0, type: "dance" }).reason)
      .toBe("invalid-command");
  });

  it("names retreat and surrender rather than letting them vanish", () => {
    const session = open();
    expect(dispatchTowCommand(session, {
      id: "cmd-r",
      expectedRevision: 0,
      type: "attempt-retreat",
      actorId: "wanderer",
    })).toMatchObject({ ok: false, reason: "retreat-not-admitted" });

    expect(dispatchTowCommand(session, {
      id: "cmd-s",
      expectedRevision: 0,
      type: "accept-surrender",
      actorId: "wanderer",
    })).toMatchObject({ ok: false, reason: "no-surrender-offered" });
  });

  it("says retreat is unsupported rather than forbidden once it is admitted", () => {
    // Fail-closed either way, but the reason has to be the true one: an admitted retreat
    // that no rule can resolve yet is a missing rule, not a denied permission.
    const session = open({ context: { retreatPolicy: "allowed" } });
    expect(dispatchTowCommand(session, {
      id: "cmd-r",
      expectedRevision: 0,
      type: "attempt-retreat",
      actorId: "wanderer",
    })).toMatchObject({ ok: false, reason: "unsupported-command-type" });
  });

  it("costs no randomness when it refuses", () => {
    const session = open();
    const refused = dispatchTowCommand(session, {
      id: "cmd-1",
      expectedRevision: 0,
      type: "use-skill",
      actorId: "wanderer",
      skillId: "meteor",
      targetId: "foe-0",
    });
    expect(refused.session.encounter.rng).toEqual(session.encounter.rng);
  });

  it("refuses every command once the fight is over", () => {
    const session = open({
      enemies: [{
        id: "foe-0",
        name: "Straw dummy",
        maxHp: 1,
        stats: { attack: 0, defense: 0, critRate: 0, dodgeRate: 0 },
        attacks: [{ id: "none", name: "None", hits: 1, damage: 0 }],
      }],
    });
    const won = strike(session);
    expect(won.session.encounter.phase).toBe("victory");
    expect(won.session.status).toBe("terminal");
    expect(endTurn(won.session, "cmd-2")).toMatchObject({ ok: false, reason: "encounter-over" });
  });

  it("refuses a command against a settled session", () => {
    const session = open();
    const settled = { ...session, status: "settled" };
    expect(validateTowCommand(settled, {
      id: "cmd-1",
      expectedRevision: 0,
      type: "end-turn",
      actorId: null,
      skillId: null,
      targetId: null,
    })).toMatchObject({ ok: false, reason: "session-settled" });
  });
});

describe("the event log", () => {
  it("attributes every event to the command that caused it", () => {
    let session = open();
    session = strike(session, "cmd-1").session;
    session = endTurn(session, "cmd-2").session;

    const events = towSessionEvents(session);
    expect(events).toHaveLength(session.encounter.sequence);
    expect(events.every((event) => event.rulesetId === session.rulesetId)).toBe(true);
    const attributed = new Set(events.map((event) => event.commandId));
    expect(attributed.has("cmd-1")).toBe(true);
    expect(attributed.has("cmd-2")).toBe(true);
  });

  it("reports opening events as belonging to no command", () => {
    // Combat-start traits fire before the player has done anything; claiming a command
    // caused them would be a lie replay could not reproduce.
    const session = open({ build: { traits: { ironclad: 7 } } });
    const opening = towSessionEvents(session);
    expect(opening.length).toBeGreaterThan(0);
    expect(opening.every((event) => event.commandId === null)).toBe(true);
  });

  it("slices exactly one command's events", () => {
    let session = open();
    session = strike(session, "cmd-1").session;
    const second = endTurn(session, "cmd-2");
    const events = towCommandEvents(second.session, second.session.commands[1]);
    expect(events.length).toBe(second.session.encounter.sequence - session.encounter.sequence);
    expect(events.every((event) => event.commandId === "cmd-2")).toBe(true);
  });
});
