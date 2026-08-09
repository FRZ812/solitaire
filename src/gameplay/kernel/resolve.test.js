import { describe, expect, it } from "vitest";
import { createEncounter } from "./model.js";
import { resolveCommand } from "./resolve.js";

function fixture(seed = 104729) {
  return createEncounter({
    seed,
    player: {
      id: "player",
      name: "Arctic Knight",
      hp: 24,
      maxHp: 24,
      stats: { attack: 4, defense: 0 },
      actions: ["basic-attack"],
    },
    enemy: {
      id: "gatekeeper",
      name: "The Gatekeeper",
      hp: 18,
      maxHp: 18,
      stats: { attack: 3, defense: 0 },
      intent: {
        id: "gatekeeper-strike",
        type: "attack",
        targetId: "player",
        damage: { min: 3, max: 5 },
      },
    },
  });
}

const attack = Object.freeze({
  type: "use-action",
  actorId: "player",
  actionId: "basic-attack",
  targetId: "gatekeeper",
});

describe("reference combat kernel", () => {
  it("resolves Attack and the declared enemy intent as one deterministic turn trace", () => {
    const first = resolveCommand(fixture(), attack);
    const replay = resolveCommand(fixture(), attack);

    expect(first).toEqual(replay);
    expect(first.ok).toBe(true);
    expect(first.state.phase).toBe("player");
    expect(first.state.round).toBe(2);
    expect(first.state.actors.gatekeeper.hp).toBeLessThan(18);
    expect(first.state.actors.player.hp).toBeLessThan(24);
    expect(first.events.map((event) => event.type)).toEqual([
      "action-used",
      "damage-resolved",
      "intent-resolved",
      "damage-resolved",
      "intent-declared",
    ]);
    expect(first.events.map((event) => event.sequence)).toEqual([1, 2, 3, 4, 5]);
    expect(first.state.events).toEqual(first.events);
  });

  it("rejects an illegal target with an objective reason and no state change", () => {
    const before = fixture();
    const result = resolveCommand(before, { ...attack, targetId: "missing" });

    expect(result).toEqual({ ok: false, reason: "invalid-target", state: before, events: [] });
    expect(before.actors.gatekeeper.hp).toBe(18);
    expect(before.events).toEqual([]);
  });

  it("ends in victory without resolving the queued enemy intent when Attack is lethal", () => {
    const before = fixture();
    const fragile = {
      ...before,
      actors: {
        ...before.actors,
        gatekeeper: { ...before.actors.gatekeeper, hp: 1, maxHp: 1 },
      },
    };
    const result = resolveCommand(fragile, attack);

    expect(result.ok).toBe(true);
    expect(result.state.phase).toBe("victory");
    expect(result.state.actors.gatekeeper.hp).toBe(0);
    expect(result.state.actors.player.hp).toBe(24);
    expect(result.events.map((event) => event.type)).toEqual([
      "action-used",
      "damage-resolved",
      "encounter-ended",
    ]);
  });

  it("keeps state finite and serializable across a turn", () => {
    const result = resolveCommand(fixture(7), attack);
    const roundTrip = JSON.parse(JSON.stringify(result.state));

    expect(roundTrip).toEqual(result.state);
    for (const actor of Object.values(result.state.actors)) {
      expect(Number.isFinite(actor.hp)).toBe(true);
      expect(actor.hp).toBeGreaterThanOrEqual(0);
      expect(actor.hp).toBeLessThanOrEqual(actor.maxHp);
    }
  });
});
