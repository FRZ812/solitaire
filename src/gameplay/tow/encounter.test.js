import { describe, expect, it } from "vitest";
import { statusCount } from "../kernel/status-stack.js";
import { createTowEncounter, endTurn, isTowEncounter, useSkill } from "./encounter.js";
import { TRAIT_RANK_CAP } from "./traits.js";

// The Arctic Knight as the wiki records them: 170 HP, 12 ATK, 13 DEF, 9% crit, 4% dodge,
// starting trait Ironclad, starting skills Strike and Block. Crit and dodge are zeroed in
// most cases below so the arithmetic is readable; where they matter they are set back.
function knight(overrides = {}) {
  return {
    id: "arctic-knight",
    name: "Arctic Knight",
    maxHp: 170,
    stats: { attack: 12, defense: 13, critRate: 0, dodgeRate: 0 },
    ...overrides,
  };
}

function foe(overrides = {}) {
  return {
    id: "gatekeeper",
    name: "The Gatekeeper",
    maxHp: 190,
    stats: { attack: 23, defense: 0, critRate: 0, dodgeRate: 0 },
    ...overrides,
  };
}

function start(overrides = {}) {
  return createTowEncounter({
    seed: "tow-encounter-test",
    player: knight(overrides.player),
    enemies: overrides.enemies || [foe()],
    build: { traits: {}, skills: ["strike", "block"], ...overrides.build },
  });
}

describe("starting an encounter", () => {
  it("is a valid encounter with everyone at full health", () => {
    const state = start();
    expect(isTowEncounter(state)).toBe(true);
    expect(state.phase).toBe("player");
    expect(state.round).toBe(1);
    expect(state.actors["arctic-knight"].hp).toBe(170);
    expect(state.actors.gatekeeper.hp).toBe(190);
  });

  it("fires combat-start traits before the first command", () => {
    // Ironclad at rank 7 is 13 Steelskin, and it must be standing before the enemy swings.
    const state = start({ build: { traits: { ironclad: TRAIT_RANK_CAP } } });
    expect(statusCount(state.actors["arctic-knight"].statuses, "steelskin")).toBe(13);
    expect(state.events.some((e) => e.type === "trait-fired" && e.traitId === "ironclad")).toBe(true);
  });

  it("gives Intangible its seven Invincible as an opening, not a play", () => {
    const state = start({ build: { traits: { endurance: 1 } } });
    expect(statusCount(state.actors["arctic-knight"].statuses, "solidity")).toBe(1);
  });

  it("inflicts enemy-targeted traits on every living foe", () => {
    const state = start({
      enemies: [foe(), foe({ id: "second", name: "Second" })],
      build: { traits: { ambush: TRAIT_RANK_CAP } },
    });
    expect(statusCount(state.actors.gatekeeper.statuses, "weak")).toBe(4);
    expect(statusCount(state.actors.second.statuses, "weak")).toBe(4);
  });

  it("rejects malformed input", () => {
    expect(() => createTowEncounter({ seed: 1, player: knight(), enemies: [] }))
      .toThrow(/invalid-enemies/);
    expect(() => createTowEncounter({ player: knight(), enemies: [foe()] }))
      .toThrow(/invalid-encounter-seed/);
    expect(() => createTowEncounter({
      seed: "s", player: knight(), enemies: [foe()], build: { traits: { nonsense: 1 } },
    })).toThrow(/unknown-trait/);
    expect(() => createTowEncounter({
      seed: "s", player: knight(), enemies: [foe({ id: "arctic-knight" })],
    })).toThrow(/duplicate-actor-id/);
  });
});

describe("using skills", () => {
  it("deals Strike for the recorded fraction of attack power", () => {
    // Strike rank 1 is 100% of ATK. 12 ATK into 0 defence is 12.
    const result = useSkill(start(), "strike");
    expect(result.ok).toBe(true);
    expect(result.state.actors.gatekeeper.hp).toBe(178);
  });

  it("turns Block into shield from defence, not damage", () => {
    // Block rank 1 is 250% of DEF: 13 * 250% = 32.
    const result = useSkill(start(), "block");
    expect(result.state.actors["arctic-knight"].shield).toBe(32);
    expect(result.state.actors.gatekeeper.hp).toBe(190);
  });

  it("spends the turn for a turn-consuming skill and refuses a second", () => {
    const first = useSkill(start(), "strike");
    expect(first.state.turn.actionsRemaining).toBe(0);
    expect(useSkill(first.state, "strike")).toMatchObject({ ok: false, reason: "turn-already-spent" });
  });

  it("leaves the turn open for a turn-free skill", () => {
    const state = start({ build: { skills: ["strike", "warcry"] } });
    const free = useSkill(state, "warcry");
    expect(free.ok).toBe(true);
    expect(free.state.turn.actionsRemaining).toBe(1);
    expect(statusCount(free.state.actors["arctic-knight"].statuses, "solidity")).toBe(3);
    expect(useSkill(free.state, "strike").ok).toBe(true);
  });

  it("refuses a skill that is not in the loadout", () => {
    expect(useSkill(start(), "impregnable")).toMatchObject({ ok: false, reason: "skill-not-held" });
  });

  it("spends an act use", () => {
    const result = useSkill(start(), "block");
    expect(result.state.build.skills.find((s) => s.id === "block").usesRemaining).toBe(29);
  });

  it("meets Steelskin per hit, so the fight reads off the enemy's mitigation", () => {
    const state = start({ enemies: [foe({ statuses: [{ type: "steelskin", count: 4 }] })] });
    const result = useSkill(state, "strike");
    // 12 ATK - 4 Steelskin = 8.
    expect(result.state.actors.gatekeeper.hp).toBe(182);
    expect(statusCount(result.state.actors.gatekeeper.statuses, "steelskin")).toBe(3);
  });

  it("does not mutate the encounter it is given", () => {
    const state = start();
    const before = JSON.stringify(state);
    useSkill(state, "strike");
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("ending the turn", () => {
  it("lets the enemy answer and advances the round", () => {
    const result = endTurn(start());
    expect(result.ok).toBe(true);
    expect(result.state.round).toBe(2);
    expect(result.state.turn.actionsRemaining).toBe(1);
    expect(result.state.actors["arctic-knight"].hp).toBeLessThan(170);
  });

  it("spends the shield before health", () => {
    const blocked = useSkill(start(), "block").state;
    const after = endTurn(blocked).state;
    const knightAfter = after.actors["arctic-knight"];
    // 32 shield against a 23-damage swing leaves shield standing and health untouched.
    expect(knightAfter.hp).toBe(170);
    expect(knightAfter.shield).toBe(9);
  });

  it("uses a multi-hit attack table, so mitigation is spent per hit", () => {
    const state = createTowEncounter({
      seed: "multi-hit",
      player: knight({ stats: { attack: 12, defense: 13, critRate: 0, dodgeRate: 0 } }),
      enemies: [foe({ attacks: [{ id: "flurry", name: "Flurry", hits: 3, damage: 10 }] })],
      build: { traits: { ironclad: 1 }, skills: ["strike"] },
    });
    // Ironclad rank 1 is 1 Steelskin, so hit one is reduced and the stack is then gone.
    expect(statusCount(state.actors["arctic-knight"].statuses, "steelskin")).toBe(1);
    const after = endTurn(state).state;
    const attackEvent = after.events.find((e) => e.type === "enemy-attack");
    expect(attackEvent.hits).toHaveLength(3);
    expect(attackEvent.hits.map((hit) => hit.damage)).toEqual([9, 10, 10]);
    expect(after.actors["arctic-knight"].hp).toBe(170 - 29);
  });

  it("lets every living enemy act", () => {
    const state = start({ enemies: [foe(), foe({ id: "second", name: "Second" })] });
    const after = endTurn(state).state;
    expect(after.events.filter((e) => e.type === "enemy-attack")).toHaveLength(2);
    expect(after.actors["arctic-knight"].hp).toBe(170 - 46);
  });

  it("skips an enemy that is already down", () => {
    const state = start({
      enemies: [foe({ maxHp: 190, hp: 0 }), foe({ id: "second", name: "Second" })],
    });
    const after = endTurn(state).state;
    expect(after.events.filter((e) => e.type === "enemy-attack")).toHaveLength(1);
  });

  it("fires cadence traits on their round, not before", () => {
    // Detection grants Thorn every 4 turns.
    let state = start({ build: { traits: { detection: TRAIT_RANK_CAP } } });
    expect(statusCount(state.actors["arctic-knight"].statuses, "thorn")).toBe(0);
    for (let round = 0; round < 3; round += 1) state = endTurn(state).state;
    expect(state.round).toBe(4);
    expect(statusCount(state.actors["arctic-knight"].statuses, "thorn")).toBe(14);
  });

  it("burns for fixed damage that ignores defences, after the hit has spent a stack", () => {
    const state = start({
      player: { ...knight(), statuses: [{ type: "burn", count: 5 }] },
    });
    const after = endTurn(state).state;
    // Burn decreases when hit, so the enemy's swing spends one stack before the
    // end-of-turn tick reads it: 5 becomes 4, and 4 lands as unmitigated damage.
    expect(after.events.find((e) => e.type === "tick-damage")).toMatchObject({ burn: 4 });
    // 23 from the swing plus 4 from Burn. Raw DEF is deliberately not flat mitigation —
    // the evidence has DEF feeding Block's shield and Tenacity, while Steelskin and
    // Protection are what reduce an incoming hit.
    expect(after.actors["arctic-knight"].hp).toBe(170 - 23 - 4);
  });

  it("decays end-of-turn statuses", () => {
    const state = useSkill(start({ build: { skills: ["warcry"] } }), "warcry").state;
    expect(statusCount(state.actors["arctic-knight"].statuses, "solidity")).toBe(3);
    const after = endTurn(state).state;
    // One spent by the incoming hit, one by the end-of-turn tick.
    expect(statusCount(after.actors["arctic-knight"].statuses, "solidity")).toBe(1);
  });

  it("nullifies an actor held by a control status", () => {
    const state = start({ enemies: [foe({ statuses: [{ type: "sleep", count: 3 }] })] });
    const after = endTurn(state).state;
    expect(after.events.some((e) => e.type === "enemy-nullified")).toBe(true);
    expect(after.actors["arctic-knight"].hp).toBe(170);
  });

  it("lets Unstoppable answer a control status", () => {
    const state = start({
      enemies: [foe({ statuses: [{ type: "sleep", count: 3 }, { type: "unstoppable", count: 4 }] })],
    });
    const after = endTurn(state).state;
    expect(after.events.some((e) => e.type === "enemy-attack")).toBe(true);
  });
});

describe("terminal outcomes", () => {
  it("reaches victory when the last enemy falls", () => {
    const state = start({ enemies: [foe({ maxHp: 190, hp: 5 })] });
    const after = useSkill(state, "strike").state;
    expect(after.phase).toBe("victory");
    expect(after.actors.gatekeeper.hp).toBe(0);
    expect(useSkill(after, "strike")).toMatchObject({ ok: false, reason: "encounter-over" });
    expect(endTurn(after)).toMatchObject({ ok: false, reason: "encounter-over" });
  });

  it("stays alive while any enemy stands", () => {
    const state = start({ enemies: [foe({ maxHp: 190, hp: 5 }), foe({ id: "second", name: "Second" })] });
    const after = useSkill(state, "strike", "gatekeeper").state;
    expect(after.phase).toBe("player");
  });

  it("reaches defeat when the player falls", () => {
    const state = start({ player: { ...knight(), maxHp: 170, hp: 5 } });
    const after = endTurn(state).state;
    expect(after.phase).toBe("defeat");
    expect(after.actors["arctic-knight"].hp).toBe(0);
  });
});

describe("determinism", () => {
  it("replays identically from the same seed", () => {
    const run = () => {
      let state = createTowEncounter({
        seed: "repeatable",
        player: knight({ stats: { attack: 12, defense: 13, critRate: 30, dodgeRate: 20 } }),
        enemies: [foe({ stats: { attack: 23, defense: 0, critRate: 25, dodgeRate: 15 } })],
        build: { traits: { agility: 4, ironclad: 3 }, skills: ["strike", "block"] },
      });
      for (let turn = 0; turn < 5 && state.phase === "player"; turn += 1) {
        const used = useSkill(state, turn % 2 === 0 ? "strike" : "block");
        state = used.ok ? used.state : state;
        if (state.phase !== "player") break;
        state = endTurn(state).state;
      }
      return state;
    };
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });

  it("keeps the event log sequential", () => {
    let state = start();
    for (let turn = 0; turn < 3; turn += 1) {
      state = useSkill(state, "strike").state;
      state = endTurn(state).state;
    }
    expect(state.events).toHaveLength(state.sequence);
    state.events.forEach((entry, index) => {
      expect(entry.sequence).toBe(index + 1);
      expect(entry.round).toBeGreaterThanOrEqual(1);
    });
    expect(isTowEncounter(state)).toBe(true);
  });
});

describe("Priority and Haste", () => {
  it("gives one action a round by default", () => {
    expect(start().turn.actionsRemaining).toBe(1);
  });

  it("turns Haste into an extra action, spendable the same round", () => {
    // Swift grants Haste; two stacks means three turn-consuming actions this round.
    const state = start({ player: { ...knight(), statuses: [{ type: "haste", count: 2 }] } });
    expect(state.turn.actionsRemaining).toBe(3);
    let after = useSkill(state, "strike").state;
    expect(after.turn.actionsRemaining).toBe(2);
    after = useSkill(after, "strike").state;
    after = useSkill(after, "strike").state;
    expect(after.turn.actionsRemaining).toBe(0);
    expect(useSkill(after, "strike")).toMatchObject({ ok: false, reason: "turn-already-spent" });
    // Three strikes of 12 landed, not one.
    expect(after.actors.gatekeeper.hp).toBe(190 - 36);
  });

  it("lets Priority act before the enemy", () => {
    const state = start({ player: { ...knight(), statuses: [{ type: "priority", count: 3 }] } });
    expect(state.turn.actionsRemaining).toBe(4);
  });

  it("cancels Priority against the enemy's own", () => {
    // "If the enemy has Priority too, they cancel out each other."
    const state = start({
      player: { ...knight(), statuses: [{ type: "priority", count: 3 }] },
      enemies: [foe({ statuses: [{ type: "priority", count: 2 }] })],
    });
    expect(state.turn.actionsRemaining).toBe(2);
  });

  it("never drops below one action when the enemy out-prioritises you", () => {
    const state = start({
      player: { ...knight(), statuses: [{ type: "priority", count: 1 }] },
      enemies: [foe({ statuses: [{ type: "priority", count: 9 }] })],
    });
    expect(state.turn.actionsRemaining).toBe(1);
  });

  it("ignores the Priority of a foe that is already down", () => {
    const state = start({
      player: { ...knight(), statuses: [{ type: "priority", count: 2 }] },
      enemies: [foe({ maxHp: 190, hp: 0, statuses: [{ type: "priority", count: 5 }] }),
        foe({ id: "second", name: "Second" })],
    });
    expect(state.turn.actionsRemaining).toBe(3);
  });

  it("stacks Haste with net Priority", () => {
    const state = start({
      player: { ...knight(), statuses: [{ type: "haste", count: 1 }, { type: "priority", count: 2 }] },
    });
    expect(state.turn.actionsRemaining).toBe(4);
  });

  it("recomputes the count each round, after cadence traits fire", () => {
    // Haste decays at end of turn, so the extra action is not permanent.
    const state = start({ player: { ...knight(), statuses: [{ type: "haste", count: 1 }] } });
    expect(state.turn.actionsRemaining).toBe(2);
    const after = endTurn(useSkill(state, "strike").state).state;
    expect(after.turn.actionsRemaining).toBe(1);
  });
});
