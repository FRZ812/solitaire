import { describe, expect, it } from "vitest";
import { createRng } from "./rng.js";
import { applyStatus, createStatusStack, statusCount } from "./status-stack.js";
import { createTowActor } from "./tow-actor.js";
import { PROVISIONAL_DAMAGE_POLICY, resolveAttack } from "./tow-damage.js";

function statuses(...pairs) {
  return pairs.reduce((stack, [type, count]) => applyStatus(stack, type, count), createStatusStack());
}

// Neither side rolls: dodge 0 means no roll can land, crit 0 likewise. Every number in a
// test built this way is arithmetic, not luck.
function actor(overrides = {}) {
  return createTowActor({
    id: overrides.id || "a",
    name: overrides.name || "Actor",
    side: overrides.side || "enemy",
    maxHp: overrides.maxHp ?? 200,
    hp: overrides.hp ?? overrides.maxHp ?? 200,
    shield: overrides.shield ?? 0,
    stats: {
      attack: overrides.attack ?? 10,
      defense: overrides.defense ?? 0,
      critRate: overrides.critRate ?? 0,
      dodgeRate: overrides.dodgeRate ?? 0,
    },
    statuses: overrides.statuses ?? createStatusStack(),
  });
}

const seed = () => createRng("tow-damage-test");

describe("multi-hit resolution", () => {
  it("applies Steelskin to each individual hit, spending a point per hit", () => {
    // This is the whole reason an attack cannot be one damage number: a 3-hit swing
    // meets a *different* Steelskin value each time.
    const result = resolveAttack({
      attacker: actor({ id: "atk", side: "enemy" }),
      defender: actor({ id: "def", side: "player", hp: 100, maxHp: 100, statuses: statuses(["steelskin", 4]) }),
      attack: { hits: 3, damage: 10 },
      rng: seed(),
    });

    expect(result.hits.map((hit) => hit.damage)).toEqual([6, 7, 8]);
    expect(result.defender.hp).toBe(100 - 21);
    expect(statusCount(result.defender.statuses, "steelskin")).toBe(1);
  });

  it("answers with Thorn once per hit received", () => {
    const result = resolveAttack({
      attacker: actor({ id: "atk", hp: 100, maxHp: 100 }),
      defender: actor({ id: "def", side: "player", statuses: statuses(["thorn", 5]) }),
      attack: { hits: 3, damage: 10 },
      rng: seed(),
    });

    expect(result.hits.map((hit) => hit.thorn)).toEqual([5, 5, 5]);
    expect(result.attacker.hp).toBe(100 - 15);
    // Thorn is permanent — it does not deplete as it retaliates.
    expect(statusCount(result.defender.statuses, "thorn")).toBe(5);
  });

  it("stops the remaining hits once the defender is down", () => {
    const result = resolveAttack({
      attacker: actor({ id: "atk" }),
      defender: actor({ id: "def", side: "player", hp: 15, maxHp: 100 }),
      attack: { hits: 5, damage: 10 },
      rng: seed(),
    });

    expect(result.defender.hp).toBe(0);
    expect(result.hits).toHaveLength(2);
  });
});

describe("mitigation", () => {
  it("spends the shield before HP", () => {
    const result = resolveAttack({
      attacker: actor({ id: "atk" }),
      defender: actor({ id: "def", side: "player", hp: 100, maxHp: 100, shield: 25 }),
      attack: { hits: 1, damage: 40 },
      rng: seed(),
    });

    expect(result.hits[0]).toMatchObject({ absorbed: 25, toHp: 15 });
    expect(result.defender.shield).toBe(0);
    expect(result.defender.hp).toBe(85);
  });

  it("stacks Guard and Solidity multiplicatively before flat reduction", () => {
    // 100 -> Guard 50% -> 50 -> Solidity 30% -> 35 -> Steelskin 5 -> 30
    const result = resolveAttack({
      attacker: actor({ id: "atk" }),
      defender: actor({
        id: "def",
        side: "player",
        hp: 100,
        maxHp: 100,
        statuses: statuses(["guard", 9], ["solidity", 3], ["steelskin", 5]),
      }),
      attack: { hits: 1, damage: 100 },
      rng: seed(),
    });

    expect(result.hits[0].damage).toBe(30);
  });

  it("nullifies damage entirely while Invincible stands", () => {
    const result = resolveAttack({
      attacker: actor({ id: "atk" }),
      defender: actor({ id: "def", side: "player", hp: 100, maxHp: 100, statuses: statuses(["invincible", 7]) }),
      attack: { hits: 3, damage: 50 },
      rng: seed(),
    });

    expect(result.defender.hp).toBe(100);
    expect(result.hits.every((hit) => hit.damage === 0)).toBe(true);
  });

  it("floors damage at zero rather than healing the target", () => {
    const result = resolveAttack({
      attacker: actor({ id: "atk" }),
      defender: actor({ id: "def", side: "player", hp: 50, maxHp: 100, statuses: statuses(["steelskin", 500]) }),
      attack: { hits: 1, damage: 10 },
      rng: seed(),
    });

    expect(result.hits[0].damage).toBe(0);
    expect(result.defender.hp).toBe(50);
  });

  it("spends Guard and Solidity one point per hit", () => {
    const result = resolveAttack({
      attacker: actor({ id: "atk" }),
      defender: actor({
        id: "def",
        side: "player",
        statuses: statuses(["guard", 9], ["solidity", 3]),
      }),
      attack: { hits: 2, damage: 10 },
      rng: seed(),
    });

    expect(statusCount(result.defender.statuses, "guard")).toBe(7);
    expect(statusCount(result.defender.statuses, "solidity")).toBe(1);
  });
});

describe("dodge and crit", () => {
  it("takes no damage on a dodge and, per policy, spends no on-hit status", () => {
    const result = resolveAttack({
      attacker: actor({ id: "atk" }),
      defender: actor({
        id: "def",
        side: "player",
        hp: 100,
        maxHp: 100,
        dodgeRate: 100,
        statuses: statuses(["steelskin", 4]),
      }),
      attack: { hits: 2, damage: 30 },
      rng: seed(),
    });

    expect(result.hits.every((hit) => hit.dodged)).toBe(true);
    expect(result.defender.hp).toBe(100);
    expect(statusCount(result.defender.statuses, "steelskin")).toBe(4);
    expect(PROVISIONAL_DAMAGE_POLICY.dodgeSpendsOnHitStatuses).toBe(false);
  });

  it("lets Evade raise an otherwise hopeless dodge rate", () => {
    const withoutEvade = resolveAttack({
      attacker: actor({ id: "atk" }),
      defender: actor({ id: "def", side: "player", dodgeRate: 4 }),
      attack: { hits: 8, damage: 10 },
      rng: seed(),
    });
    const withEvade = resolveAttack({
      attacker: actor({ id: "atk" }),
      defender: actor({ id: "def", side: "player", dodgeRate: 4, statuses: statuses(["evade", 1]) }),
      attack: { hits: 8, damage: 10 },
      rng: seed(),
    });

    const dodges = (result) => result.hits.filter((hit) => hit.dodged).length;
    expect(dodges(withEvade)).toBeGreaterThan(dodges(withoutEvade));
  });

  it("multiplies damage on a critical hit", () => {
    const result = resolveAttack({
      attacker: actor({ id: "atk", critRate: 100 }),
      defender: actor({ id: "def", side: "player", hp: 100, maxHp: 100 }),
      attack: { hits: 1, damage: 20 },
      rng: seed(),
    });

    expect(result.hits[0]).toMatchObject({ critical: true, damage: 40 });
  });
});

describe("determinism and purity", () => {
  it("returns the same result for the same seed", () => {
    const run = () => resolveAttack({
      attacker: actor({ id: "atk", critRate: 30 }),
      defender: actor({ id: "def", side: "player", dodgeRate: 25 }),
      attack: { hits: 6, damage: 12 },
      rng: createRng("repeatable"),
    });
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });

  it("advances the rng so a second attack differs", () => {
    const first = resolveAttack({
      attacker: actor({ id: "atk", critRate: 50 }),
      defender: actor({ id: "def", side: "player", dodgeRate: 50 }),
      attack: { hits: 6, damage: 12 },
      rng: createRng("advancing"),
    });
    const second = resolveAttack({
      attacker: first.attacker,
      defender: first.defender,
      attack: { hits: 6, damage: 12 },
      rng: first.rng,
    });
    expect(second.rng.state).not.toBe(first.rng.state);
  });

  it("does not mutate the actors it is given", () => {
    const attacker = actor({ id: "atk", hp: 100, maxHp: 100 });
    const defender = actor({
      id: "def",
      side: "player",
      hp: 100,
      maxHp: 100,
      shield: 10,
      statuses: statuses(["steelskin", 4], ["thorn", 3]),
    });
    const before = JSON.stringify({ attacker, defender });

    resolveAttack({ attacker, defender, attack: { hits: 3, damage: 20 }, rng: seed() });

    expect(JSON.stringify({ attacker, defender })).toBe(before);
  });

  it("rejects malformed attacks", () => {
    const args = { attacker: actor({ id: "a" }), defender: actor({ id: "b", side: "player" }), rng: seed() };
    for (const hits of [0, -1, 1.5, NaN, "2", undefined]) {
      expect(() => resolveAttack({ ...args, attack: { hits, damage: 5 } })).toThrow(/invalid-attack-hits/);
    }
    for (const damage of [-1, 1.5, NaN, "5", undefined]) {
      expect(() => resolveAttack({ ...args, attack: { hits: 1, damage } })).toThrow(/invalid-attack-damage/);
    }
  });
});

describe("the Gatekeeper, as recorded", () => {
  it("takes four less from every hit while its Ironclad Steelskin holds", () => {
    // wiki:gatekeeper — 190 HP, Ironclad (+4 Steelskin), "reducing all damage they take by four".
    const gatekeeper = actor({
      id: "gatekeeper",
      name: "The Gatekeeper",
      side: "enemy",
      hp: 190,
      maxHp: 190,
      attack: 23,
      critRate: 6,
      dodgeRate: 1,
      statuses: statuses(["steelskin", 4]),
    });
    const result = resolveAttack({
      attacker: actor({ id: "knight", side: "player" }),
      defender: gatekeeper,
      attack: { hits: 1, damage: 12 },
      rng: seed(),
    });

    expect(result.hits[0].damage).toBe(8);
    expect(result.defender.hp).toBe(182);
  });
});
