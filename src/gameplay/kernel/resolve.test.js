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
      stats: { attack: 4, defense: 2 },
      actions: ["basic-attack", "basic-defense"],
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
        damage: { min: 8, max: 8 },
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

const defend = Object.freeze({
  type: "use-action",
  actorId: "player",
  actionId: "basic-defense",
  targetId: "player",
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

  it("keeps the canonical trace isolated from mutations to the returned event batch", () => {
    const result = resolveCommand(fixture(), attack);

    result.events[0].type = "tampered";

    expect(result.state.events[0].type).toBe("action-used");
  });

  it("exposes intent before input and Defense mitigates that declared hit", () => {
    const before = fixture(17);
    expect(before.actors.gatekeeper.intent).toMatchObject({
      id: "gatekeeper-strike",
      type: "attack",
      targetId: "player",
      damage: { min: 8, max: 8 },
    });

    const attacked = resolveCommand(fixture(17), attack);
    const defended = resolveCommand(fixture(17), defend);
    const incoming = defended.events.findLast((event) => (
      event.type === "damage-resolved" && event.targetId === "player"
    ));

    expect(defended.ok).toBe(true);
    expect(defended.state.actors.player.hp).toBeGreaterThan(attacked.state.actors.player.hp);
    expect(defended.state.actors.player.guard).toBe(0);
    expect(incoming).toMatchObject({
      sourceId: "gatekeeper",
      targetId: "player",
      rawAmount: 8,
      guardSpent: 5,
      amount: 3,
    });
    expect(defended.events.map((event) => event.type)).toEqual([
      "action-used",
      "defense-gained",
      "intent-resolved",
      "damage-resolved",
      "intent-declared",
    ]);
  });

  it("rejects core actions aimed at the wrong side without mutation", () => {
    const before = fixture();

    expect(resolveCommand(before, { ...attack, targetId: "player" })).toEqual({
      ok: false,
      reason: "invalid-target",
      state: before,
      events: [],
    });
    expect(resolveCommand(before, { ...defend, targetId: "gatekeeper" })).toEqual({
      ok: false,
      reason: "invalid-target",
      state: before,
      events: [],
    });
  });

  it("expires unused Defense after the declared enemy intent resolves", () => {
    const before = fixture(29);
    before.actors.gatekeeper.intent.damage = { min: 2, max: 2 };
    const result = resolveCommand(before, defend);

    expect(result.ok).toBe(true);
    expect(result.state.actors.player.hp).toBe(24);
    expect(result.state.actors.player.guard).toBe(0);
    expect(result.events.map((event) => event.type)).toEqual([
      "action-used",
      "defense-gained",
      "intent-resolved",
      "damage-resolved",
      "defense-expired",
      "intent-declared",
    ]);
    expect(result.events.find((event) => event.type === "defense-expired")).toMatchObject({
      actorId: "player",
      amount: 3,
      reason: "enemy-intent-resolved",
    });
  });
});
