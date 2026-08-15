import { describe, expect, it } from "vitest";
import { applyStatus, createStatusStack } from "./status-stack.js";
import { createTowActor, isDefeated, isTowActor, MAX_ACTOR_VALUE } from "./tow-actor.js";

const knight = {
  id: "arctic-knight",
  name: "Arctic Knight",
  side: "player",
  maxHp: 170,
  stats: { attack: 12, defense: 13, critRate: 9, dodgeRate: 4 },
};

describe("creating an actor", () => {
  it("builds the Arctic Knight exactly as the wiki records it", () => {
    const actor = createTowActor(knight);
    expect(actor).toEqual({
      id: "arctic-knight",
      name: "Arctic Knight",
      side: "player",
      hp: 170,
      maxHp: 170,
      shield: 0,
      stats: { attack: 12, defense: 13, critRate: 9, dodgeRate: 4 },
      statuses: [],
    });
    expect(isTowActor(actor)).toBe(true);
  });

  it("builds the Gatekeeper with its own crit and dodge", () => {
    const actor = createTowActor({
      id: "gatekeeper",
      name: "The Gatekeeper",
      side: "enemy",
      maxHp: 190,
      stats: { attack: 23, defense: 0, critRate: 6, dodgeRate: 1 },
      statuses: applyStatus(createStatusStack(), "steelskin", 4),
    });
    expect(actor.hp).toBe(190);
    expect(actor.stats).toEqual({ attack: 23, defense: 0, critRate: 6, dodgeRate: 1 });
    expect(actor.statuses).toEqual([{ type: "steelskin", count: 4 }]);
  });

  it("snapshots a current actor's persistent Resolve pool", () => {
    const actor = createTowActor({ ...knight, resolve: 5, resolveMax: 9 });
    expect(actor).toMatchObject({ resolve: 5, resolveMax: 9 });
    expect(isTowActor(actor)).toBe(true);
    expect(isTowActor(JSON.parse(JSON.stringify(actor)))).toBe(true);
  });

  it("defaults current HP to full and clamps an overfull value", () => {
    expect(createTowActor(knight).hp).toBe(170);
    expect(createTowActor({ ...knight, hp: 999 }).hp).toBe(170);
    expect(createTowActor({ ...knight, hp: 0 }).hp).toBe(0);
  });

  it("copies the status stack instead of aliasing it", () => {
    const stack = applyStatus(createStatusStack(), "burn", 3);
    const actor = createTowActor({ ...knight, statuses: stack });
    actor.statuses[0].count = 999;
    expect(stack[0].count).toBe(3);
  });

  it("rejects malformed input", () => {
    expect(() => createTowActor({ ...knight, id: "" })).toThrow(/invalid-actor-id/);
    expect(() => createTowActor({ ...knight, id: 7 })).toThrow(/invalid-actor-id/);
    expect(() => createTowActor({ ...knight, name: "" })).toThrow(/invalid-actor-name/);
    expect(() => createTowActor({ ...knight, side: "ally" })).toThrow(/invalid-actor-side/);
    expect(() => createTowActor({ ...knight, maxHp: 0 })).toThrow(/invalid-max-hp/);
    expect(() => createTowActor({ ...knight, maxHp: -1 })).toThrow(/invalid-max-hp/);
    expect(() => createTowActor({ ...knight, maxHp: 1.5 })).toThrow(/invalid-max-hp/);
    expect(() => createTowActor({ ...knight, shield: -1 })).toThrow(/invalid-shield/);
    expect(() => createTowActor({ ...knight, resolve: 1 })).toThrow(/invalid-resolve-max/);
    expect(() => createTowActor({ ...knight, resolve: -1, resolveMax: 8 })).toThrow(/invalid-resolve/);
    expect(() => createTowActor({ ...knight, statuses: [{ type: "burn", count: 0 }] }))
      .toThrow(/invalid-statuses/);
    expect(() => createTowActor({ ...knight, statuses: "none" })).toThrow(/invalid-statuses/);
  });

  it("rejects rates outside nought to a hundred", () => {
    for (const critRate of [-1, 101, 1.5, NaN]) {
      expect(() => createTowActor({ ...knight, stats: { ...knight.stats, critRate } }))
        .toThrow(/invalid-crit-rate/);
    }
    for (const dodgeRate of [-1, 101, 0.5, Infinity]) {
      expect(() => createTowActor({ ...knight, stats: { ...knight.stats, dodgeRate } }))
        .toThrow(/invalid-dodge-rate/);
    }
  });

  it("rejects values beyond the bound", () => {
    expect(() => createTowActor({ ...knight, maxHp: MAX_ACTOR_VALUE + 1 })).toThrow(/invalid-max-hp/);
  });
});

describe("validating an actor", () => {
  it("accepts what the factory produces, before and after a JSON round trip", () => {
    const actor = createTowActor({ ...knight, statuses: applyStatus(createStatusStack(), "thorn", 2) });
    expect(isTowActor(actor)).toBe(true);
    expect(isTowActor(JSON.parse(JSON.stringify(actor)))).toBe(true);
  });

  it("rejects shapes that are close but wrong", () => {
    const actor = createTowActor(knight);
    expect(isTowActor(null)).toBe(false);
    expect(isTowActor([])).toBe(false);
    expect(isTowActor({ ...actor, extra: 1 })).toBe(false);
    expect(isTowActor({ ...actor, hp: actor.maxHp + 1 })).toBe(false);
    expect(isTowActor({ ...actor, hp: -1 })).toBe(false);
    expect(isTowActor({ ...actor, side: "ally" })).toBe(false);
    expect(isTowActor({ ...actor, stats: { attack: 1, defense: 1, critRate: 1 } })).toBe(false);
    expect(isTowActor({ ...actor, stats: { ...actor.stats, dodgeRate: 101 } })).toBe(false);
    expect(isTowActor({ ...actor, statuses: [{ type: "nonsense", count: 1 }] })).toBe(false);
    const { shield, ...missingShield } = actor;
    expect(isTowActor(missingShield)).toBe(false);
  });
});

describe("defeat", () => {
  it("is reached at zero HP, not before", () => {
    expect(isDefeated(createTowActor({ ...knight, hp: 1 }))).toBe(false);
    expect(isDefeated(createTowActor({ ...knight, hp: 0 }))).toBe(true);
  });
});
