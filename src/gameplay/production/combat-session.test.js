import { describe, expect, it } from "vitest";
import {
  readProductionCombatSession,
  startProductionCombatSession,
  transitionProductionCombatSession,
} from "./combat-session.js";

function startInput() {
  return {
    campaignId: "campaign-7",
    sessionId: "campaign-7:combat:3",
    seed: "campaign-7:combat:3",
    source: {
      kind: "narrator",
      note: "A roadside brigand lunges from the ditch.",
      lethal: true,
    },
    player: {
      name: "Wanderer",
      hp: 20,
      maxHp: 20,
      attack: 5,
      defense: 3,
      proficiencyId: "mastery-sword",
    },
    enemy: {
      name: "Roadside brigand",
      hp: 12,
      maxHp: 12,
      damage: { min: 2, max: 2 },
      npcId: "brigand-captain",
    },
  };
}

const strike = Object.freeze({
  type: "use-action",
  actorId: "player",
  actionId: "strike",
  targetId: "enemy",
});

describe("production combat session authority", () => {
  it("starts, owns, persists, and authoritatively replays a production encounter", () => {
    const input = startInput();
    const started = startProductionCombatSession(input);

    expect(started).toMatchObject({
      ok: true,
      session: {
        version: 1,
        domain: "solitaire-production-combat",
        campaignId: "campaign-7",
        sessionId: "campaign-7:combat:3",
        status: "active",
        sequence: 0,
        encounter: {
          version: 2,
          baselineVersion: "solitaire-production-combat-v1",
        },
      },
    });
    expect(Object.isFrozen(started.session)).toBe(true);
    expect(Object.isFrozen(started.session.encounter.actors.player)).toBe(true);

    input.player.attack = 999;
    input.enemy.damage.max = 999;
    expect(started.session.initial.player.attack).toBe(5);
    expect(started.session.initial.player.proficiencyId).toBe("mastery-sword");
    expect(started.session.initial.enemy.damage.max).toBe(2);

    const restored = readProductionCombatSession(
      JSON.parse(JSON.stringify(started.session)),
    );
    expect(restored).toMatchObject({ ok: true, session: { sequence: 0, status: "active" } });
    expect(restored.session).toEqual(started.session);

    const transitioned = transitionProductionCombatSession(restored.session, strike);
    expect(transitioned).toMatchObject({
      ok: true,
      session: {
        sequence: 1,
        history: [strike],
        encounter: { actors: { enemy: { hp: 7 } } },
      },
    });
    expect(restored.session.sequence).toBe(0);
  });

  it("owns travel as an explicit production encounter source", () => {
    const input = startInput();
    input.source.kind = "travel";

    const started = startProductionCombatSession(input);
    expect(started).toMatchObject({
      ok: true,
      session: { source: { kind: "travel" } },
    });
    expect(readProductionCombatSession(
      JSON.parse(JSON.stringify(started.session)),
    )).toMatchObject({
      ok: true,
      session: { source: { kind: "travel" } },
    });

    input.source.kind = "unknown";
    expect(startProductionCombatSession(input)).toEqual({
      ok: false,
      reason: "invalid-production-combat-input",
      session: null,
    });
  });

  it("rejects a forged encounter projection even when its envelope shape is valid", () => {
    const started = startProductionCombatSession(startInput()).session;
    const forged = JSON.parse(JSON.stringify(started));
    forged.encounter.actors.enemy.hp = 1;

    expect(readProductionCombatSession(forged)).toEqual({
      ok: false,
      reason: "invalid-production-combat-session",
      session: null,
    });
  });

  it("rejects invalid commands atomically without appending history", () => {
    const started = startProductionCombatSession(startInput()).session;
    const rejected = transitionProductionCombatSession(started, {
      ...strike,
      actionId: "forged-action",
    });

    expect(rejected).toEqual({
      ok: false,
      reason: "unknown-action",
      session: started,
      events: [],
    });
    expect(started.history).toEqual([]);
    expect(started.encounter.actors.enemy.hp).toBe(12);
  });
});
