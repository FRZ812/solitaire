import { describe, expect, it } from "vitest";
import { startProductionCombatSession, transitionProductionCombatSession } from "./combat-session.js";
import { settleProductionCombat } from "./combat-settlement.js";

function session({ playerHp = 20, enemyHp = 5, damage = 2 } = {}) {
  const started = startProductionCombatSession({
    campaignId: "campaign-7",
    sessionId: "campaign-7:combat:2",
    seed: "campaign-7:combat:2",
    source: { kind: "narrator", note: "A brigand attacks.", lethal: true },
    player: {
      name: "Wanderer",
      hp: playerHp,
      maxHp: 20,
      attack: 5,
      defense: 3,
      proficiencyId: "mastery-sword",
    },
    enemy: {
      name: "Brigand captain",
      hp: enemyHp,
      maxHp: enemyHp,
      damage: { min: damage, max: damage },
      npcId: "brigand-captain",
    },
  }).session;
  return transitionProductionCombatSession(started, {
    type: "use-action",
    actorId: "player",
    actionId: "strike",
    targetId: "enemy",
  }).session;
}

function campaign(activeCombatSession) {
  return {
    activeCombatSession,
    combatSettlementReceipts: [],
    pendingLoot: null,
    beats: [],
    character: {
      name: "Wanderer",
      vitality: 20,
      vitalityMax: 20,
      conditions: [],
      proficiencies: {},
      attributes: { body: 2, reflex: 3, vigor: 2, mind: 2, wit: 4, presence: 1 },
    },
    world: {
      codex: {
        characters: {
          wanderer: { id: "wanderer", name: "Wanderer" },
          "brigand-captain": {
            id: "brigand-captain",
            name: "Brigand captain",
            combatState: { health: 5, maxHealth: 5, status: "ok" },
          },
        },
      },
    },
  };
}

describe("production combat settlement", () => {
  it("settles victory exactly once into vitality, progression, named-foe state, and a receipt", () => {
    const terminal = session();
    expect(terminal.status).toBe("victory");

    const result = settleProductionCombat(campaign(terminal), { campaignId: "campaign-7" });

    expect(result).toMatchObject({
      ok: true,
      receipt: {
        version: 1,
        sessionId: "campaign-7:combat:2",
        outcome: "victory",
        playerHp: 20,
        enemyHp: 0,
        proficiencyGains: { "mastery-sword": 2 },
        loot: "none",
      },
      state: {
        activeCombatSession: null,
        character: {
          vitality: 20,
          proficiencies: { "mastery-sword": 2 },
          progression: { xp: 200 },
        },
        world: {
          codex: {
            characters: {
              "brigand-captain": {
                combatState: { health: 0, maxHealth: 5, status: "dead" },
              },
            },
          },
        },
      },
    });
    expect(result.state.combatSettlementReceipts).toEqual([result.receipt]);
    expect(result.state.pendingLoot).toBe(null);

    const alreadySettledState = {
      ...result.state,
      activeCombatSession: terminal,
    };
    const replayed = settleProductionCombat(alreadySettledState, { campaignId: "campaign-7" });
    expect(replayed).toEqual({
      ok: false,
      reason: "production-combat-already-settled",
      state: replayed.state,
      receipt: result.receipt,
    });
    expect(replayed.state).toBe(alreadySettledState);
  });

  it("settles defeat as survivable campaign injury without killing the named foe", () => {
    const terminal = session({ playerHp: 5, enemyHp: 20, damage: 20 });
    expect(terminal.status).toBe("defeat");

    const result = settleProductionCombat(campaign(terminal), { campaignId: "campaign-7" });

    expect(result).toMatchObject({
      ok: true,
      receipt: { outcome: "defeat", playerHp: 0, enemyHp: 15 },
      state: {
        character: { vitality: 1 },
        world: {
          codex: {
            characters: {
              "brigand-captain": {
                combatState: { health: 15, maxHealth: 20, status: "wounded" },
              },
            },
          },
        },
      },
    });
    expect(result.state.character.conditions.map((condition) => condition.name)).toEqual(
      expect.arrayContaining(["Bleeding", "Gravely Wounded"]),
    );
  });
});
