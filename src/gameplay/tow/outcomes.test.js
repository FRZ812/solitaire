import { describe, expect, it } from "vitest";
import { dispatchTowCommand } from "./commands.js";
import {
  resolveParticipantOutcomes,
  resolveTowTerminalReceipt,
  sealTowTerminalReceipt,
  worldFatesByParticipant,
} from "./outcomes.js";
import { createTowSession } from "./session.js";

function open(context, overrides = {}) {
  const opened = createTowSession({
    sessionId: "combat-1",
    rootSeed: "seed-1",
    player: {
      id: "wanderer",
      name: "Wanderer",
      maxHp: overrides.playerMaxHp ?? 170,
      stats: { attack: 12, defense: 13, critRate: 0, dodgeRate: 0 },
    },
    enemies: overrides.enemies || [{
      id: "foe-0",
      name: "Bandit",
      maxHp: 1,
      stats: { attack: 0, defense: 0, critRate: 0, dodgeRate: 0 },
      attacks: [{ id: "jab", name: "Jab", hits: 1, damage: 0 }],
    }],
    build: { traits: {}, skills: ["strike", "block"] },
    context,
  });
  if (!opened.ok) throw new Error(opened.reason);
  return opened.session;
}

/** Win by striking until nothing is standing. */
function fightToVictory(session) {
  let current = session;
  for (let round = 0; round < 40 && current.encounter.phase === "player"; round += 1) {
    const hit = dispatchTowCommand(current, {
      id: `strike-${round}`,
      expectedRevision: current.revision,
      type: "use-skill",
      actorId: "wanderer",
      skillId: "strike",
      targetId: current.encounter.enemyIds.find((id) => current.encounter.actors[id].hp > 0),
    });
    current = hit.session;
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

/** Lose by standing still against something that hits far harder than the player heals. */
function fightToDefeat(context) {
  let current = open(context, {
    playerMaxHp: 20,
    enemies: [{
      id: "foe-0",
      name: "Fabled beast",
      maxHp: 9000,
      stats: { attack: 500, defense: 0, critRate: 0, dodgeRate: 0 },
      attacks: [{ id: "maul", name: "Maul", hits: 1, damage: 500 }],
    }],
  });
  for (let round = 0; round < 10 && current.encounter.phase === "player"; round += 1) {
    current = dispatchTowCommand(current, {
      id: `end-${round}`,
      expectedRevision: current.revision,
      type: "end-turn",
      actorId: "wanderer",
    }).session;
  }
  return current;
}

describe("a foe at zero health", () => {
  it("is knocked out, not killed, in a nonlethal fight", () => {
    // The defect this exists to prevent: a foe the player deliberately spared recorded as
    // dead in the codex, which is unrecoverable — that person can never come back.
    const session = fightToVictory(open({ lethalPolicy: "nonlethal" }));
    const [, foe] = resolveParticipantOutcomes(session);
    expect(foe.combatState).toBe("incapacitated");
    expect(foe.worldFate).toBe("alive");
    expect(foe.finalHp).toBe(0);
  });

  it("is dead when the fight was admitted as lethal", () => {
    const session = fightToVictory(open({ lethalPolicy: "lethal" }));
    const [, foe] = resolveParticipantOutcomes(session);
    expect(foe.combatState).toBe("dead");
    expect(foe.worldFate).toBe("dead");
  });

  it("follows its own binding under a mixed policy", () => {
    const session = fightToVictory(open({
      lethalPolicy: "mixed",
      participantBindings: {
        "foe-0": { campaignEntityId: "npc-hale", lethal: true },
        "foe-1": { campaignEntityId: "npc-marsh", lethal: false },
      },
    }, {
      enemies: [
        { id: "foe-0", name: "Hale", maxHp: 1, stats: { attack: 0, defense: 0, critRate: 0, dodgeRate: 0 }, attacks: [{ id: "a", name: "A", hits: 1, damage: 0 }] },
        { id: "foe-1", name: "Marsh", maxHp: 1, stats: { attack: 0, defense: 0, critRate: 0, dodgeRate: 0 }, attacks: [{ id: "a", name: "A", hits: 1, damage: 0 }] },
      ],
    }));
    const fates = worldFatesByParticipant(resolveTowTerminalReceipt(session));
    expect(fates["foe-0"]).toBe("dead");
    expect(fates["foe-1"]).toBe("alive");
  });

  it("names the event that put it down", () => {
    const session = fightToVictory(open({ lethalPolicy: "lethal" }));
    const [, foe] = resolveParticipantOutcomes(session);
    expect(foe.terminalCause).toBe("skill-damage");
    expect(session.encounter.events[foe.sourceEventId - 1].targetId).toBe("foe-0");
  });
});

describe("the player at zero health", () => {
  it("survives a defeat the admission did not stake their life on", () => {
    const session = fightToDefeat({ lethalPolicy: "lethal", playerStakes: "survivable" });
    expect(session.encounter.phase).toBe("defeat");
    const [player] = resolveParticipantOutcomes(session);
    expect(player.combatState).toBe("incapacitated");
    expect(player.worldFate).toBe("alive");
  });

  it("dies only when the admission authorized it beforehand", () => {
    const session = fightToDefeat({ lethalPolicy: "lethal", playerStakes: "lethal" });
    const [player] = resolveParticipantOutcomes(session);
    expect(player.combatState).toBe("dead");
    expect(player.worldFate).toBe("dead");
    expect(resolveTowTerminalReceipt(session).playerWorldFate).toBe("dead");
  });

  it("keeps player stakes independent of how lethal the foes were", () => {
    // A duel to the death against a bandit still leaves the player alive at one vitality;
    // the two questions were previously the same flag and should not have been.
    const session = fightToDefeat({ lethalPolicy: "lethal", playerStakes: "survivable" });
    expect(resolveTowTerminalReceipt(session).playerWorldFate).toBe("alive");
  });
});

describe("the terminal receipt", () => {
  it("is null while the fight is live", () => {
    expect(resolveTowTerminalReceipt(open({}))).toBe(null);
    expect(sealTowTerminalReceipt(open({}))).toMatchObject({ ok: false, reason: "encounter-not-terminal" });
  });

  it("covers every participant and records where each stream stopped", () => {
    const session = fightToVictory(open({ lethalPolicy: "nonlethal" }));
    const receipt = resolveTowTerminalReceipt(session);
    expect(receipt.reason).toBe("victory");
    expect(receipt.winner).toBe("player");
    expect(receipt.loser).toBe("enemies");
    expect(receipt.participants.map((outcome) => outcome.participantId))
      .toEqual(["wanderer", "foe-0"]);
    expect(Object.keys(receipt.streamEndpoints).sort())
      .toEqual(["combat", "intent", "loot", "rewards"]);
  });

  it("seals once and absorbs a second attempt", () => {
    const session = fightToVictory(open({ lethalPolicy: "nonlethal" }));
    const first = sealTowTerminalReceipt(session);
    expect(first.ok).toBe(true);
    expect(first.duplicate).toBe(false);
    expect(first.session.revision).toBe(session.revision);

    // A reload landing on a finished fight must not mint a second, differently-timed verdict.
    const again = sealTowTerminalReceipt(first.session);
    expect(again).toMatchObject({ ok: true, duplicate: true });
    expect(again.session).toBe(first.session);
  });

  it("leaves a standing survivor standing", () => {
    const session = fightToDefeat({ lethalPolicy: "lethal", playerStakes: "survivable" });
    const receipt = resolveTowTerminalReceipt(session);
    const foe = receipt.participants.find((outcome) => outcome.participantId === "foe-0");
    expect(foe.combatState).toBe("standing");
    expect(foe.worldFate).toBe("alive");
    expect(foe.terminalCause).toBe(null);
    expect(foe.sourceEventId).toBe(null);
  });

  it("records a successful escape as fled with no winner or loser", () => {
    const session = open({ retreatPolicy: "allowed" });
    const escaped = {
      ...session,
      encounter: {
        ...session.encounter,
        phase: "retreated",
        sequence: session.encounter.sequence + 2,
        events: [
          ...session.encounter.events,
          { sequence: session.encounter.sequence + 1, round: 1, type: "retreat-attempt", actorId: "wanderer", succeeded: true },
          { sequence: session.encounter.sequence + 2, round: 1, type: "retreated", actorId: "wanderer" },
        ],
      },
    };
    const receipt = resolveTowTerminalReceipt(escaped);
    expect(receipt).toMatchObject({ reason: "retreated", winner: null, loser: null });
    expect(receipt.participants.find((entry) => entry.participantId === "wanderer"))
      .toMatchObject({ combatState: "fled", worldFate: "alive" });
    expect(receipt.participants.find((entry) => entry.participantId === "foe-0"))
      .toMatchObject({ combatState: "standing", worldFate: "alive" });
  });
});
