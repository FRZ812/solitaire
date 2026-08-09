import { describe, expect, it } from "vitest";
import { createEncounter } from "./model.js";
import { resolveCommand } from "./resolve.js";

function fixture({
  seed = 65537,
  skills = ["emergency-evasion", "sleep-bomb"],
  enemyGuard = 0,
  enemyStatuses = [],
} = {}) {
  return createEncounter({
    seed,
    player: {
      id: "player",
      name: "Arctic Knight",
      hp: 24,
      maxHp: 24,
      stats: { attack: 4, defense: 2 },
      actions: ["basic-attack", "basic-defense"],
      skills,
    },
    enemy: {
      id: "gatekeeper",
      name: "The Gatekeeper",
      hp: 18,
      maxHp: 18,
      guard: enemyGuard,
      stats: { attack: 3, defense: 0 },
      statuses: enemyStatuses,
      intent: {
        id: "gatekeeper-strike",
        type: "attack",
        targetId: "player",
        damage: { min: 8, max: 8 },
      },
    },
  });
}

const evade = Object.freeze({
  type: "use-skill",
  actorId: "player",
  skillId: "emergency-evasion",
  targetId: "player",
});

const sleep = Object.freeze({
  type: "use-skill",
  actorId: "player",
  skillId: "sleep-bomb",
  targetId: "gatekeeper",
});

const attack = Object.freeze({
  type: "use-action",
  actorId: "player",
  actionId: "basic-attack",
  targetId: "gatekeeper",
});

function skill(state, skillId) {
  return state.actors.player.skills.find((entry) => entry.id === skillId);
}

describe("reference skill economy", () => {
  it("limits a reference loadout to three skills", () => {
    expect(() => fixture({
      skills: ["emergency-evasion", "sleep-bomb", "emergency-evasion", "sleep-bomb"],
    })).toThrow("too-many-skills");
  });

  it.each(["toString", "constructor", "__proto__"])(
    "rejects inherited object key %s as an unknown skill",
    (skillId) => {
      expect(() => fixture({ skills: [skillId] })).toThrow(`unknown-skill:${skillId}`);
    },
  );

  it("uses Emergency Evasion for free and avoids the next declared enemy hit", () => {
    const used = resolveCommand(fixture(), evade);

    expect(used.ok).toBe(true);
    expect(used.state.phase).toBe("player");
    expect(used.state.round).toBe(1);
    expect(used.state.actors.player.hp).toBe(24);
    expect(skill(used.state, "emergency-evasion").usesRemaining).toBe(3);
    expect(used.state.actors.player.statuses).toContainEqual(expect.objectContaining({ type: "evasion" }));
    expect(used.events.map((event) => event.type)).toEqual([
      "skill-used",
      "skill-use-spent",
      "status-applied",
    ]);

    const attacked = resolveCommand(used.state, attack);
    expect(attacked.state.actors.player.hp).toBe(24);
    expect(attacked.state.actors.player.statuses.some((status) => status.type === "evasion")).toBe(false);
    expect(attacked.events.map((event) => event.type)).toContain("damage-avoided");
  });

  it("never lets finite skill uses become negative", () => {
    let state = fixture();
    for (let count = 0; count < 4; count += 1) {
      const result = resolveCommand(state, evade);
      expect(result.ok).toBe(true);
      state = result.state;
    }
    expect(skill(state, "emergency-evasion").usesRemaining).toBe(0);

    const rejected = resolveCommand(state, evade);
    expect(rejected).toEqual({
      ok: false,
      reason: "skill-uses-exhausted",
      state,
      events: [],
    });
    expect(skill(rejected.state, "emergency-evasion").usesRemaining).toBe(0);
  });

  it("Sleep Bomb consumes the turn, skips the intent, wakes on damage, and observes cooldown", () => {
    const slept = resolveCommand(fixture(), sleep);

    expect(slept.ok).toBe(true);
    expect(slept.state.round).toBe(2);
    expect(slept.state.actors.player.hp).toBe(24);
    expect(slept.state.actors.gatekeeper.statuses).toContainEqual(expect.objectContaining({ type: "sleep" }));
    expect(skill(slept.state, "sleep-bomb").cooldownRemaining).toBe(6);
    expect(slept.events.map((event) => event.type)).toEqual([
      "skill-used",
      "cooldown-set",
      "status-applied",
      "intent-skipped",
      "intent-declared",
    ]);

    const blocked = resolveCommand(slept.state, sleep);
    expect(blocked).toEqual({
      ok: false,
      reason: "skill-on-cooldown",
      state: slept.state,
      events: [],
    });

    const woke = resolveCommand(slept.state, attack);
    expect(woke.ok).toBe(true);
    expect(woke.state.actors.gatekeeper.statuses.some((status) => status.type === "sleep")).toBe(false);
    expect(woke.state.actors.player.hp).toBe(16);
    expect(skill(woke.state, "sleep-bomb").cooldownRemaining).toBe(5);
    expect(woke.events).toContainEqual(expect.objectContaining({
      type: "status-removed",
      actorId: "gatekeeper",
      status: "sleep",
      reason: "damaged",
    }));
  });

  it("keeps Sleep when guard absorbs the hit before HP damage", () => {
    const slept = resolveCommand(fixture({ enemyGuard: 99 }), sleep);
    const blockedHit = resolveCommand(slept.state, attack);

    expect(blockedHit.events).toContainEqual(expect.objectContaining({
      type: "damage-resolved",
      targetId: "gatekeeper",
      amount: 0,
    }));
    expect(blockedHit.state.actors.gatekeeper.statuses).toContainEqual(
      expect.objectContaining({ type: "sleep" }),
    );
    expect(blockedHit.events).not.toContainEqual(expect.objectContaining({
      type: "status-removed",
      actorId: "gatekeeper",
      status: "sleep",
    }));
  });

  it("records control immunity instead of silently applying Sleep through Unstoppable", () => {
    const result = resolveCommand(fixture({
      enemyStatuses: [{ type: "unstoppable", duration: 1 }],
    }), sleep);

    expect(result.ok).toBe(true);
    expect(result.state.actors.gatekeeper.statuses.some((status) => status.type === "sleep")).toBe(false);
    expect(result.state.actors.player.hp).toBe(16);
    expect(result.events).toContainEqual(expect.objectContaining({
      type: "status-blocked",
      actorId: "gatekeeper",
      status: "sleep",
      reason: "unstoppable",
    }));
  });
});
