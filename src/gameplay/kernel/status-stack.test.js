import { describe, expect, it } from "vitest";
import {
  applyStatus,
  createStatusStack,
  decrementOnHit,
  getStatusDefinition,
  hasStatus,
  isStatusStack,
  MAX_STATUS_COUNT,
  removeStatus,
  statusCount,
  statusTypes,
  tickEndOfTurn,
  tickEndOfTurnDamage,
} from "./status-stack.js";

describe("status definitions", () => {
  it("carries the lifecycle the wiki records for each observed status", () => {
    expect(getStatusDefinition("protection")).toMatchObject({
      permanent: true,
      decreaseWhenHit: true,
      decreaseAtEndOfTurn: false,
      removeAtEndOfTurn: false,
    });
    expect(getStatusDefinition("steelskin")).toMatchObject({
      permanent: false,
      decreaseWhenHit: true,
    });
    expect(getStatusDefinition("solidity")).toMatchObject({
      decreaseAtEndOfTurn: true,
      decreaseWhenHit: true,
    });
    expect(getStatusDefinition("guard")).toMatchObject({
      decreaseAtEndOfTurn: true,
      decreaseWhenHit: true,
    });
    expect(getStatusDefinition("overload")).toMatchObject({ removeAtEndOfTurn: true });
    expect(getStatusDefinition("doom-atk")).toMatchObject({ removeAtEndOfTurn: true });
    expect(getStatusDefinition("thorn")).toMatchObject({ permanent: true });
    expect(getStatusDefinition("tenacity")).toMatchObject({ permanent: true });
    expect(getStatusDefinition("lethargy")).toMatchObject({ permanent: true });
    expect(getStatusDefinition("vulnerable")).toMatchObject({ decreaseWhenHit: true });
    expect(getStatusDefinition("burn")).toMatchObject({
      permanent: true,
      decreaseWhenHit: true,
      endOfTurnDamage: "persist",
    });
    expect(getStatusDefinition("poison")).toMatchObject({ endOfTurnDamage: "decrease" });
    expect(getStatusDefinition("bleed")).toMatchObject({
      permanent: true,
      endOfTurnDamage: "persist",
    });
    expect(getStatusDefinition("doom")).toMatchObject({ endOfTurnDamage: "remove" });
    expect(getStatusDefinition("charge")).toMatchObject({ removeAtEndOfTurn: true });
    expect(getStatusDefinition("initiative")).toMatchObject({ permanent: true });
    expect(getStatusDefinition("priority")).toMatchObject({ decreaseAtEndOfTurn: true });
    expect(getStatusDefinition("berserk")).toMatchObject({ permanent: true });
    expect(getStatusDefinition("bone-shield")).toMatchObject({ decreaseWhenHit: true });
    expect(getStatusDefinition("mirror-image")).toMatchObject({
      decreaseWhenHit: true,
      decreaseAtEndOfTurn: true,
    });
    expect(getStatusDefinition("void-monster")).toMatchObject({ permanent: true });
    expect(getStatusDefinition("hellfire-spirit")).toMatchObject({ permanent: true });
    expect(getStatusDefinition("limited-life-sentence")).toMatchObject({ decreaseAtEndOfTurn: true });
    expect(getStatusDefinition("forbidden-ritual")).toMatchObject({ decreaseAtEndOfTurn: true });
  });

  it("marks undocumented lifecycles as a gap instead of inventing one", () => {
    for (const type of ["paralyze", "stun"]) {
      const spec = getStatusDefinition(type);
      expect(spec.lifecycleEvidence).toBe("gap");
      expect(spec.permanent).toBe(false);
      expect(spec.removeAtEndOfTurn).toBe(false);
      expect(spec.decreaseAtEndOfTurn).toBe(false);
      expect(spec.decreaseWhenHit).toBe(false);
    }
  });

  it("rejects unknown status types", () => {
    expect(getStatusDefinition("nonsense")).toBeNull();
    expect(getStatusDefinition(null)).toBeNull();
    expect(getStatusDefinition(42)).toBeNull();
    expect(() => applyStatus(createStatusStack(), "nonsense", 1)).toThrow(/unknown-status/);
  });

  it("covers every status named in the evidence ledger", () => {
    expect(statusTypes()).toEqual(expect.arrayContaining([
      "protection", "steelskin", "evade", "haste", "doom-atk", "burn",
      "unstoppable", "tenacity", "thorn", "lifesteal", "strength", "misfortune",
      "poison", "cripple", "charge", "grow", "overload", "poison-atk", "weak",
      "focus", "solidity", "guard", "sharpen", "eviscerate", "priority", "doom",
      "bone-shield", "mirror-image", "void-monster", "hellfire-spirit",
      "limited-life-sentence", "forbidden-ritual",
    ]));
  });
});

describe("applying statuses", () => {
  it("accumulates repeat grants rather than replacing them", () => {
    // Detection grants Thorn every 4 turns; the fourth grant must not erase the first three.
    let stack = createStatusStack();
    stack = applyStatus(stack, "thorn", 14);
    stack = applyStatus(stack, "thorn", 14);
    expect(statusCount(stack, "thorn")).toBe(28);
  });

  it("keeps one entry per type", () => {
    let stack = applyStatus(createStatusStack(), "burn", 3);
    stack = applyStatus(stack, "burn", 5);
    expect(stack).toEqual([{ type: "burn", count: 8 }]);
  });

  it("does not mutate the stack it is given", () => {
    const original = applyStatus(createStatusStack(), "steelskin", 4);
    const snapshot = JSON.parse(JSON.stringify(original));
    applyStatus(original, "steelskin", 9);
    expect(original).toEqual(snapshot);
  });

  it("treats a zero grant as a no-op", () => {
    expect(applyStatus(createStatusStack(), "burn", 0)).toEqual([]);
    expect(statusCount(applyStatus(applyStatus(createStatusStack(), "burn", 2), "burn", 0), "burn")).toBe(2);
  });

  it("clamps at the maximum instead of overflowing", () => {
    let stack = applyStatus(createStatusStack(), "grow", MAX_STATUS_COUNT);
    stack = applyStatus(stack, "grow", 500);
    expect(statusCount(stack, "grow")).toBe(MAX_STATUS_COUNT);
  });

  it("rejects counts that are not safe non-negative integers", () => {
    const stack = createStatusStack();
    for (const bad of [-1, 1.5, NaN, Infinity, "3", null, undefined, MAX_STATUS_COUNT + 1]) {
      expect(() => applyStatus(stack, "burn", bad)).toThrow(/invalid-status-count/);
    }
  });
});

describe("reading statuses", () => {
  it("reports absent statuses as zero, not undefined", () => {
    expect(statusCount(createStatusStack(), "burn")).toBe(0);
    expect(hasStatus(createStatusStack(), "burn")).toBe(false);
    expect(statusCount(null, "burn")).toBe(0);
  });

  it("removes a status entirely", () => {
    const stack = applyStatus(applyStatus(createStatusStack(), "burn", 4), "thorn", 2);
    expect(removeStatus(stack, "burn")).toEqual([{ type: "thorn", count: 2 }]);
  });
});

describe("decrementing on hit", () => {
  it("spends only the statuses that decrease when hit", () => {
    let stack = createStatusStack();
    stack = applyStatus(stack, "steelskin", 4);
    stack = applyStatus(stack, "burn", 80);
    stack = applyStatus(stack, "protection", 21);
    stack = applyStatus(stack, "thorn", 85);
    stack = applyStatus(stack, "evade", 1);

    const after = decrementOnHit(stack);
    expect(statusCount(after, "steelskin")).toBe(3);
    expect(statusCount(after, "burn")).toBe(79);
    expect(statusCount(after, "protection")).toBe(20);
    // Thorn is permanent and Evade only decays at end of turn.
    expect(statusCount(after, "thorn")).toBe(85);
    expect(statusCount(after, "evade")).toBe(1);
  });

  it("spends once per individual hit, so a multi-hit attack costs more", () => {
    // Steelskin is applied to each individual hit, so a 3-hit attack ticks it three times.
    const stack = applyStatus(createStatusStack(), "steelskin", 4);
    let after = stack;
    for (let hit = 0; hit < 3; hit += 1) after = decrementOnHit(after);
    expect(statusCount(after, "steelskin")).toBe(1);
  });

  it("spends Bone Shield and Mirror Image only on landed contact", () => {
    let stack = createStatusStack();
    stack = applyStatus(stack, "bone-shield", 2);
    stack = applyStatus(stack, "mirror-image", 1);
    const after = decrementOnHit(stack);
    expect(statusCount(after, "bone-shield")).toBe(1);
    expect(statusCount(after, "mirror-image")).toBe(0);
  });

  it("drops a status that reaches zero rather than leaving an empty stack", () => {
    const stack = applyStatus(createStatusStack(), "steelskin", 1);
    const after = decrementOnHit(stack);
    expect(after).toEqual([]);
    expect(hasStatus(after, "steelskin")).toBe(false);
  });

  it("never drives a count below zero", () => {
    const stack = applyStatus(createStatusStack(), "burn", 2);
    const after = decrementOnHit(stack, 10);
    expect(after).toEqual([]);
  });
});

describe("ticking at end of turn", () => {
  it("removes remove-at-end-of-turn statuses outright, whatever the count", () => {
    // Overload is temporary attack power, "lost at end of turn" — all of it, not one point.
    let stack = applyStatus(createStatusStack(), "overload", 48);
    stack = applyStatus(stack, "doom-atk", 25);
    stack = applyStatus(stack, "charge", 100);
    stack = applyStatus(stack, "misfortune", 180);
    const after = tickEndOfTurn(stack);
    expect(hasStatus(after, "overload")).toBe(false);
    expect(hasStatus(after, "doom-atk")).toBe(false);
    expect(hasStatus(after, "charge")).toBe(false);
    expect(hasStatus(after, "misfortune")).toBe(false);
  });

  it("decrements decrease-at-end-of-turn statuses", () => {
    let stack = applyStatus(createStatusStack(), "evade", 1);
    stack = applyStatus(stack, "haste", 2);
    stack = applyStatus(stack, "solidity", 10);
    stack = applyStatus(stack, "priority", 3);
    const after = tickEndOfTurn(stack);
    expect(hasStatus(after, "evade")).toBe(false);
    expect(statusCount(after, "haste")).toBe(1);
    expect(statusCount(after, "solidity")).toBe(9);
    expect(statusCount(after, "priority")).toBe(2);
  });

  it("ticks Witch countdowns and leaves summoned spirits in place", () => {
    let stack = createStatusStack();
    stack = applyStatus(stack, "limited-life-sentence", 13);
    stack = applyStatus(stack, "forbidden-ritual", 4);
    stack = applyStatus(stack, "mirror-image", 1);
    stack = applyStatus(stack, "void-monster", 12);
    stack = applyStatus(stack, "hellfire-spirit", 20);
    const after = tickEndOfTurn(stack);
    expect(statusCount(after, "limited-life-sentence")).toBe(12);
    expect(statusCount(after, "forbidden-ritual")).toBe(3);
    expect(statusCount(after, "mirror-image")).toBe(0);
    expect(statusCount(after, "void-monster")).toBe(12);
    expect(statusCount(after, "hellfire-spirit")).toBe(20);
  });

  it("leaves permanent and hit-only statuses untouched", () => {
    let stack = applyStatus(createStatusStack(), "thorn", 85);
    stack = applyStatus(stack, "tenacity", 25);
    stack = applyStatus(stack, "protection", 21);
    stack = applyStatus(stack, "steelskin", 13);
    stack = applyStatus(stack, "burn", 80);
    expect(tickEndOfTurn(stack)).toEqual(stack);
  });

  it("leaves sourced persistent Bleed in place", () => {
    const stack = applyStatus(createStatusStack(), "bleed", 10);
    expect(tickEndOfTurn(stack)).toEqual(stack);
    expect(decrementOnHit(stack)).toEqual(stack);
  });

  it("spends Solidity and Guard from whichever comes first", () => {
    // Both decrease at end of turn AND when hit, so a turn in which you are hit once
    // costs two points, not one.
    let stack = applyStatus(createStatusStack(), "guard", 9);
    stack = decrementOnHit(stack);
    stack = tickEndOfTurn(stack);
    expect(statusCount(stack, "guard")).toBe(7);
  });
});

describe("damage-status lifecycle at the holder's turn end", () => {
  it("keeps Burn and Bleed, decreases Poison by one, and removes all Doom", () => {
    let stack = applyStatus(createStatusStack(), "burn", 5);
    stack = applyStatus(stack, "poison", 3);
    stack = applyStatus(stack, "bleed", 4);
    stack = applyStatus(stack, "doom", 40);
    stack = applyStatus(stack, "thorn", 2);

    const after = tickEndOfTurnDamage(stack);
    expect(statusCount(after, "burn")).toBe(5);
    expect(statusCount(after, "poison")).toBe(2);
    expect(statusCount(after, "bleed")).toBe(4);
    expect(statusCount(after, "doom")).toBe(0);
    expect(statusCount(after, "thorn")).toBe(2);
  });

  it("drops Poison only after its Count-1 tick has resolved", () => {
    const stack = applyStatus(createStatusStack(), "poison", 1);
    expect(tickEndOfTurnDamage(stack)).toEqual([]);
  });

  it("does not let the generic round decay consume Poison or Doom early", () => {
    let stack = applyStatus(createStatusStack(), "poison", 3);
    stack = applyStatus(stack, "doom", 20);
    expect(tickEndOfTurn(stack)).toEqual(stack);
  });
});

describe("stack validity", () => {
  it("accepts stacks the module produces", () => {
    let stack = createStatusStack();
    stack = applyStatus(stack, "burn", 4);
    stack = applyStatus(stack, "thorn", 2);
    expect(isStatusStack(stack)).toBe(true);
    expect(isStatusStack(createStatusStack())).toBe(true);
  });

  it("rejects malformed stacks", () => {
    expect(isStatusStack(null)).toBe(false);
    expect(isStatusStack({})).toBe(false);
    expect(isStatusStack([{ type: "burn" }])).toBe(false);
    expect(isStatusStack([{ type: "burn", count: 0 }])).toBe(false);
    expect(isStatusStack([{ type: "burn", count: -1 }])).toBe(false);
    expect(isStatusStack([{ type: "burn", count: 1.5 }])).toBe(false);
    expect(isStatusStack([{ type: "nonsense", count: 1 }])).toBe(false);
    expect(isStatusStack([{ type: "burn", count: 1, extra: true }])).toBe(false);
    expect(isStatusStack([{ type: "burn", count: 1 }, { type: "burn", count: 2 }])).toBe(false);
  });

  it("survives a JSON round trip", () => {
    let stack = applyStatus(createStatusStack(), "steelskin", 13);
    stack = applyStatus(stack, "protection", 21);
    expect(isStatusStack(JSON.parse(JSON.stringify(stack)))).toBe(true);
  });
});
