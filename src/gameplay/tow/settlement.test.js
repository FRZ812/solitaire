import { describe, expect, it } from "vitest";
import { makeInitialState } from "../../data/initial-state.js";
import { createTowEncounter, endTurn, useSkill } from "./encounter.js";
import { settleTowEncounter } from "./settlement.js";

function player(overrides = {}) {
  return {
    id: "wanderer",
    name: "Wanderer",
    maxHp: 60,
    stats: { attack: 30, defense: 5, critRate: 0, dodgeRate: 0 },
    ...overrides,
  };
}

function foe(id, overrides = {}) {
  return {
    id,
    name: id === "brigand" ? "Brigand" : "Raider",
    maxHp: 10,
    stats: { attack: 2, defense: 0, critRate: 0, dodgeRate: 0 },
    ...overrides,
  };
}

function wonFight({ enemies = [foe("brigand")] } = {}) {
  let state = createTowEncounter({
    seed: "settlement-test",
    player: player(),
    enemies,
    build: { traits: {}, skills: ["strike", "block"] },
  });
  for (let turn = 0; turn < 40 && state.phase === "player"; turn += 1) {
    const target = state.enemyIds.find((id) => state.actors[id].hp > 0);
    const used = useSkill(state, "strike", target);
    state = used.ok ? used.state : state;
    if (state.phase !== "player") break;
    state = endTurn(state).state;
  }
  return state;
}

function lostFight() {
  let state = createTowEncounter({
    seed: "settlement-loss",
    player: player({ maxHp: 4, hp: 4, stats: { attack: 1, defense: 0, critRate: 0, dodgeRate: 0 } }),
    enemies: [foe("brigand", { maxHp: 500, stats: { attack: 40, defense: 0, critRate: 0, dodgeRate: 0 } })],
    build: { traits: {}, skills: ["strike"] },
  });
  for (let turn = 0; turn < 20 && state.phase === "player"; turn += 1) {
    state = endTurn(state).state;
  }
  return state;
}

function campaign() {
  const state = makeInitialState();
  state.created = true;
  state.world.codex.characters.brigand = {
    id: "brigand",
    name: "Brigand",
    combatState: { health: 10, maxHealth: 10, status: "ok" },
  };
  state.world.codex.characters.raider = {
    id: "raider",
    name: "Raider",
    combatState: { health: 10, maxHealth: 10, status: "ok" },
  };
  return state;
}

describe("settling a victory", () => {
  it("writes a receipt and narrates the outcome", () => {
    const encounter = wonFight();
    expect(encounter.phase).toBe("victory");
    const result = settleTowEncounter(campaign(), encounter, { encounterId: "fight-1" });
    expect(result.ok).toBe(true);
    expect(result.receipt).toMatchObject({ sessionId: "fight-1", outcome: "victory", fallen: 1 });
    expect(result.state.beats.at(-1).content).toContain("The fight is over");
  });

  it("carries the player's remaining health back onto the character", () => {
    const encounter = wonFight();
    const result = settleTowEncounter(campaign(), encounter, { encounterId: "fight-1" });
    const survived = encounter.actors.wanderer.hp;
    expect(result.state.character.vitality)
      .toBe(Math.min(result.state.character.vitalityMax, survived));
  });

  it("awards proficiency and progression from what was actually done", () => {
    const encounter = wonFight();
    const before = campaign();
    const result = settleTowEncounter(before, encounter, {
      encounterId: "fight-1",
      proficiencyId: "mastery-sword",
    });
    expect(result.receipt.proficiencyGains["mastery-sword"]).toBeGreaterThan(0);
    expect(result.state.character.proficiencies["mastery-sword"])
      .toBeGreaterThan(before.character.proficiencies?.["mastery-sword"] || 0);
  });

  it("marks every fallen foe dead in the codex, not just the first", () => {
    // The single-enemy settlement this replaces would have left the raider untouched.
    const encounter = wonFight({ enemies: [foe("brigand"), foe("raider")] });
    expect(encounter.phase).toBe("victory");
    const result = settleTowEncounter(campaign(), encounter, {
      encounterId: "group-fight",
      npcIds: { brigand: "brigand", raider: "raider" },
    });
    const codex = result.state.world.codex.characters;
    expect(codex.brigand.combatState.status).toBe("dead");
    expect(codex.raider.combatState.status).toBe("dead");
    expect(result.receipt.fallen).toBe(2);
  });

  it("leaves the codex alone for foes that are not real people", () => {
    const before = campaign();
    const result = settleTowEncounter(before, wonFight(), { encounterId: "fight-1" });
    expect(result.state.world.codex.characters.brigand.combatState.status).toBe("ok");
  });
});

describe("settling a defeat", () => {
  it("leaves the player alive at one vitality with wounds, not dead", () => {
    const encounter = lostFight();
    expect(encounter.phase).toBe("defeat");
    const result = settleTowEncounter(campaign(), encounter, { encounterId: "loss-1" });
    expect(result.ok).toBe(true);
    expect(result.state.character.vitality).toBe(1);
    const names = result.state.character.conditions.map((c) => (typeof c === "string" ? c : c.name));
    expect(names).toEqual(expect.arrayContaining(["Gravely Wounded", "Bleeding"]));
    expect(result.state.beats.at(-1).content).toContain("goes against you");
  });
});

describe("idempotence", () => {
  it("refuses a second settlement and hands back the original receipt", () => {
    const encounter = wonFight();
    const first = settleTowEncounter(campaign(), encounter, { encounterId: "fight-1" });
    const second = settleTowEncounter(first.state, encounter, { encounterId: "fight-1" });
    expect(second).toMatchObject({ ok: false, reason: "tow-encounter-already-settled" });
    expect(second.receipt).toEqual(first.receipt);
    // No second helping of proficiency.
    expect(second.state.character.proficiencies).toEqual(first.state.character.proficiencies);
  });

  it("settles a different encounter alongside the first", () => {
    const first = settleTowEncounter(campaign(), wonFight(), { encounterId: "fight-1" });
    const second = settleTowEncounter(first.state, wonFight(), { encounterId: "fight-2" });
    expect(second.ok).toBe(true);
    expect(second.state.combatSettlementReceipts).toHaveLength(2);
  });
});

describe("refusals", () => {
  it("will not settle a fight still in progress", () => {
    const running = createTowEncounter({
      seed: "unfinished",
      player: player(),
      enemies: [foe("brigand")],
      build: { skills: ["strike"] },
    });
    expect(settleTowEncounter(campaign(), running, { encounterId: "x" }))
      .toMatchObject({ ok: false, reason: "tow-encounter-not-terminal" });
  });

  it("needs an encounter id to key the receipt", () => {
    expect(settleTowEncounter(campaign(), wonFight(), {}))
      .toMatchObject({ ok: false, reason: "invalid-encounter-id" });
  });

  it("rejects malformed receipt storage rather than overwriting it", () => {
    const broken = { ...campaign(), combatSettlementReceipts: "not-an-array" };
    expect(settleTowEncounter(broken, wonFight(), { encounterId: "fight-1" }))
      .toMatchObject({ ok: false, reason: "invalid-tow-settlement-receipts" });
  });

  it("does not mutate the campaign it is given", () => {
    const before = campaign();
    const snapshot = JSON.stringify(before);
    settleTowEncounter(before, wonFight(), { encounterId: "fight-1", npcIds: { brigand: "brigand" } });
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe("lethality decides what zero health means", () => {
  // A brawl and a duel to the death resolve identically on the kernel. They differ only
  // in what the codex records afterwards, and recording a spared foe dead is
  // unrecoverable — the player loses a person they deliberately chose not to kill.
  function fightTo(hp, lethal) {
    const state = makeInitialState();
    state.created = true;
    state.world.codex.characters["road-brigand"] = {
      id: "road-brigand",
      name: "Road brigand",
      combatState: { health: 6, maxHealth: 6, status: "ok" },
    };
    const encounter = {
      version: 1,
      phase: "victory",
      round: 3,
      sequence: 0,
      playerId: "wanderer",
      enemyIds: ["foe"],
      actors: {
        wanderer: {
          id: "wanderer", name: "Wanderer", side: "player", hp: 10, maxHp: 10,
          shield: 0, stats: { attack: 3, defense: 1, critRate: 0, dodgeRate: 0 }, statuses: [],
        },
        foe: {
          id: "foe", name: "Road brigand", side: "enemy", hp, maxHp: 6,
          shield: 0, stats: { attack: 2, defense: 0, critRate: 0, dodgeRate: 0 }, statuses: [],
        },
      },
      events: [],
    };
    return settleTowEncounter(state, encounter, {
      encounterId: `lethality:${hp}:${lethal}`,
      npcIds: { foe: "road-brigand" },
      lethal,
    });
  }

  it("records a killed foe dead when the fight was lethal", () => {
    const settled = fightTo(0, true);
    expect(settled.ok).toBe(true);
    expect(settled.state.world.codex.characters["road-brigand"].combatState.status).toBe("dead");
  });

  it("records a beaten foe downed, not dead, when the fight was not lethal", () => {
    const settled = fightTo(0, false);
    expect(settled.ok).toBe(true);
    const after = settled.state.world.codex.characters["road-brigand"].combatState;
    expect(after.status).toBe("downed");
    expect(after.status).not.toBe("dead");
  });

  it("still records a survivor as wounded either way", () => {
    for (const lethal of [true, false]) {
      const settled = fightTo(2, lethal);
      expect(settled.state.world.codex.characters["road-brigand"].combatState.status)
        .toBe("wounded");
    }
  });

  it("defaults to lethal, so a caller that never learned the distinction is unchanged", () => {
    const state = makeInitialState();
    state.created = true;
    state.world.codex.characters.foe = {
      id: "foe", name: "Foe", combatState: { health: 4, maxHealth: 4, status: "ok" },
    };
    const encounter = {
      version: 1, phase: "victory", round: 1, sequence: 0,
      playerId: "wanderer", enemyIds: ["foe"],
      actors: {
        wanderer: {
          id: "wanderer", name: "Wanderer", side: "player", hp: 9, maxHp: 9,
          shield: 0, stats: { attack: 3, defense: 1, critRate: 0, dodgeRate: 0 }, statuses: [],
        },
        foe: {
          id: "foe", name: "Foe", side: "enemy", hp: 0, maxHp: 4,
          shield: 0, stats: { attack: 1, defense: 0, critRate: 0, dodgeRate: 0 }, statuses: [],
        },
      },
      events: [],
    };
    const settled = settleTowEncounter(state, encounter, {
      encounterId: "default-lethality",
      npcIds: { foe: "foe" },
    });
    expect(settled.state.world.codex.characters.foe.combatState.status).toBe("dead");
  });
});
