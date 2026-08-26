import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createTowActorV2 } from "./actor-v2.js";
import {
  TOW_DAMAGE_POLICY_V2,
  TOW_DAMAGE_POLICY_V2_CHECKSUM,
  calculateTowDamagePolicyV2Checksum,
  isTowDamageActorV2,
  resolveTowDamageV2,
  validateTowDamageActorV2,
} from "./damage-v2.js";
import {
  createTowStatusRuntimeV2,
  mutateTowStatusV2,
  towStatusMagnitudeV2,
} from "./status-runtime-v2.js";

function actor(id, overrides = {}) {
  const {
    attack = 20,
    defense = 0,
    critChanceBps = 0,
    dodgeChanceBps = 0,
    ...vitals
  } = overrides;
  const player = id === "source";
  const result = createTowActorV2({
    id,
    name: player ? "Source" : "Target",
    side: player ? "player" : "enemy",
    controller: player ? "human" : "ai",
    aiProfile: player ? null : { id: "damage-test-ai", version: 1 },
    preferredRow: player ? 2 : 0,
    hp: 100,
    maxHp: 100,
    shield: 0,
    stats: { attack, defense, critChanceBps, dodgeChanceBps, speed: 10 },
    loadout: [{ id: player ? "arctic-strike" : "demon-shoot", rank: 1 }],
    ...vitals,
  });
  if (!result.ok) throw new TypeError(result.reason);
  return result.actor;
}

function statuses() {
  return createTowStatusRuntimeV2({ actorIds: ["source", "target"] }).state;
}

function withStatus(state, actorId, statusId, value) {
  const result = mutateTowStatusV2(state, {
    actorId,
    statusId,
    operation: "add",
    value,
    sourceActorId: null,
  });
  expect(result.ok, result.reason).toBe(true);
  return result.state;
}

function direct(overrides = {}) {
  return {
    source: actor("source"),
    target: actor("target"),
    statuses: statuses(),
    packet: { kind: "direct", amount: 100, attackScaleBps: 10_000 },
    randomDraws: [9_999, 9_999],
    ...overrides,
  };
}

function assertDeeplyFrozen(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) assertDeeplyFrozen(child, seen);
}

describe("Tower damage authority v2", () => {
  it("pins direct, periodic, lifesteal, reflection, and rounding policy to one checksum", () => {
    expect(TOW_DAMAGE_POLICY_V2_CHECKSUM).toBe("fnv1a32:f41dd5bb");
    expect(calculateTowDamagePolicyV2Checksum()).toBe(TOW_DAMAGE_POLICY_V2_CHECKSUM);
    expect(TOW_DAMAGE_POLICY_V2.direct.randomDrawOrder).toEqual(["dodge", "critical"]);
    expect(TOW_DAMAGE_POLICY_V2.periodic.bypasses).toContain("shield");
    expect(TOW_DAMAGE_POLICY_V2.rounding).toBe("floor-after-each-multiplicative-stage");
    assertDeeplyFrozen(TOW_DAMAGE_POLICY_V2);
  });

  it("validates the exact bounded actor snapshot contract", () => {
    expect(isTowDamageActorV2(actor("source"))).toBe(true);
    expect(validateTowDamageActorV2(actor("source")))
      .toEqual({ ok: true, reason: null });
    for (const candidate of [
      null,
      { ...actor("source"), extra: true },
      { ...actor("source"), maxHp: 0 },
      { ...actor("source"), hp: 101 },
      {
        ...actor("source"),
        stats: { ...actor("source").stats, defense: 1_000_000_001 },
      },
      {
        ...actor("source"),
        stats: { ...actor("source").stats, dodgeChanceBps: 10_001 },
      },
    ]) {
      expect(validateTowDamageActorV2(candidate))
        .toEqual({ ok: false, reason: "invalid-damage-v2-actor" });
    }
  });

  it("consumes dodge then critical draws even when avoidance ends the hit", () => {
    const state = withStatus(statuses(), "target", "evade", 1);
    const result = resolveTowDamageV2(direct({
      source: actor("source", { critChanceBps: 10_000 }),
      target: actor("target", { dodgeChanceBps: 500 }),
      statuses: state,
      randomDraws: [6_499, 0],
    }));

    expect(result.ok).toBe(true);
    expect(result.outcome).toMatchObject({
      drawsConsumed: 2,
      dodgeRoll: 6_499,
      criticalRoll: 0,
      dodgeChanceBps: 6_500,
      criticalChanceBps: 10_000,
      dodged: true,
      critical: false,
      hpDamage: 0,
    });
    expect(result.source).toEqual(actor("source", { critChanceBps: 10_000 }));
    expect(result.target).toEqual(actor("target", { dodgeChanceBps: 500 }));
    expect(towStatusMagnitudeV2(result.statuses, "target", "evade")).toBe(1);
    assertDeeplyFrozen(result);
  });

  it("resolves one critical direct hit in the fixed mitigation and consequence order", () => {
    let state = statuses();
    for (const [actorId, id, value] of [
      ["source", "strength", 10],
      ["source", "lifesteal", 50],
      ["target", "protection", 5],
      ["target", "skeleton", 2],
      ["target", "solidity", 1],
      ["target", "bone-shield", 1],
      ["target", "thorn", 7],
    ]) state = withStatus(state, actorId, id, value);
    const source = actor("source", {
      hp: 50,
      maxHp: 100,
      shield: 3,
      critChanceBps: 2_000,
    });
    const target = actor("target", { hp: 100, shield: 15, defense: 25 });
    const result = resolveTowDamageV2(direct({
      source,
      target,
      statuses: state,
      randomDraws: [9_999, 0],
    }));

    expect(result.outcome).toMatchObject({
      critical: true,
      attackDelta: 10,
      defense: 25,
      afterAttackDelta: 110,
      afterCritical: 176,
      afterDefense: 140,
      afterFlatReduction: 133,
      afterPercentReduction: 93,
      redirected: 55,
      shieldAbsorbed: 15,
      hpDamage: 23,
      lifestealHealed: 11,
      reflected: 7,
      reflectionShieldAbsorbed: 3,
      reflectionHpDamage: 4,
    });
    expect(result.target).toEqual(actor("target", { hp: 77, shield: 0, defense: 25 }));
    expect(result.source).toEqual(actor("source", {
      hp: 57,
      maxHp: 100,
      shield: 0,
      critChanceBps: 2_000,
    }));
    expect(towStatusMagnitudeV2(result.statuses, "target", "protection")).toBe(4);
    expect(towStatusMagnitudeV2(result.statuses, "target", "skeleton")).toBe(1);
    expect(towStatusMagnitudeV2(result.statuses, "target", "solidity")).toBe(0);
    expect(towStatusMagnitudeV2(result.statuses, "target", "bone-shield")).toBe(0);
    expect(source).toEqual(actor("source", {
      hp: 50,
      maxHp: 100,
      shield: 3,
      critChanceBps: 2_000,
    }));
    expect(target).toEqual(actor("target", { hp: 100, shield: 15, defense: 25 }));
  });

  it("scales outgoing Attack modifiers by the authored damage contribution exactly once", () => {
    let state = statuses();
    state = withStatus(state, "source", "strength", 10);
    const rainHit = resolveTowDamageV2(direct({
      statuses: state,
      packet: { kind: "direct", amount: 35, attackScaleBps: 3_500 },
    }));
    expect(rainHit.outcome).toMatchObject({
      attackDelta: 10,
      attackScaleBps: 3_500,
      scaledAttackDelta: 3,
      afterAttackDelta: 38,
      hpDamage: 38,
    });

    const maxHpHit = resolveTowDamageV2(direct({
      statuses: state,
      packet: { kind: "direct", amount: 13, attackScaleBps: 0 },
    }));
    expect(maxHpHit.outcome).toMatchObject({ scaledAttackDelta: 0, hpDamage: 13 });
  });

  it("lets periodic damage bypass every direct-only system and strike HP exactly", () => {
    let state = statuses();
    for (const [id, value] of [
      ["evade", 1],
      ["protection", 50],
      ["solidity", 2],
      ["bone-shield", 2],
      ["thorn", 40],
    ]) state = withStatus(state, "target", id, value);
    const result = resolveTowDamageV2({
      source: null,
      target: actor("target", { hp: 50, shield: 99, defense: 999 }),
      statuses: state,
      packet: { kind: "periodic", amount: 20, attackScaleBps: 0 },
      randomDraws: [],
    });

    expect(result.ok).toBe(true);
    expect(result.source).toBe(null);
    expect(result.target).toEqual(actor("target", { hp: 30, shield: 99, defense: 999 }));
    expect(result.outcome).toMatchObject({
      kind: "periodic",
      drawsConsumed: 0,
      shieldAbsorbed: 0,
      hpDamage: 20,
      reflected: 0,
      lifestealHealed: 0,
      redirected: 0,
    });
    expect(result.statuses).toBe(state);
  });

  it("calculates lifesteal from HP damage only, floors it, and caps it at missing health", () => {
    let state = statuses();
    state = withStatus(state, "source", "lifesteal", 50);
    const result = resolveTowDamageV2(direct({
      source: actor("source", { hp: 20 }),
      target: actor("target", { shield: 75 }),
      statuses: state,
    }));
    expect(result.outcome).toMatchObject({ shieldAbsorbed: 75, hpDamage: 25, lifestealHealed: 12 });
    expect(result.source.hp).toBe(32);

    state = withStatus(statuses(), "source", "lifesteal", 200);
    const capped = resolveTowDamageV2(direct({
      source: actor("source", { hp: 95 }),
      target: actor("target"),
      statuses: state,
    }));
    expect(capped.outcome.lifestealHealed).toBe(5);
    expect(capped.source.hp).toBe(100);
  });

  it("reflects flat Thorn through source shield without recursion, mitigation, or lifesteal", () => {
    let state = statuses();
    state = withStatus(state, "source", "thorn", 99);
    state = withStatus(state, "target", "thorn", 10);
    state = withStatus(state, "target", "protection", 500);
    const result = resolveTowDamageV2(direct({
      source: actor("source", { hp: 50, shield: 4, defense: 999 }),
      target: actor("target"),
      statuses: state,
      packet: { kind: "direct", amount: 0, attackScaleBps: 10_000 },
    }));

    expect(result.outcome).toMatchObject({
      hpDamage: 0,
      reflected: 10,
      reflectionShieldAbsorbed: 4,
      reflectionHpDamage: 6,
      lifestealHealed: 0,
    });
    expect(result.source.hp).toBe(44);
    expect(result.target.hp).toBe(100);
    expect(towStatusMagnitudeV2(result.statuses, "source", "thorn")).toBe(99);
    expect(towStatusMagnitudeV2(result.statuses, "target", "thorn")).toBe(10);
  });

  it("applies Judgment and landed-contact stack spending after the damage snapshot", () => {
    let state = statuses();
    state = withStatus(state, "source", "judgment", 13);
    state = withStatus(state, "target", "burn", 2);
    state = withStatus(state, "target", "protection", 4);
    const result = resolveTowDamageV2(direct({ statuses: state }));

    expect(result.outcome.afterFlatReduction).toBe(96);
    expect(result.outcome.hpDamage).toBe(96);
    expect(towStatusMagnitudeV2(result.statuses, "source", "judgment")).toBe(0);
    expect(towStatusMagnitudeV2(result.statuses, "target", "doom")).toBe(13);
    expect(towStatusMagnitudeV2(result.statuses, "target", "burn")).toBe(1);
    expect(towStatusMagnitudeV2(result.statuses, "target", "protection")).toBe(3);
    expect(result.outcome.statusMutations.map(({ statusId }) => statusId)).toEqual([
      "doom",
      "judgment",
      "burn",
      "protection",
    ]);
  });

  it("caps combined avoidance and critical chance at ten thousand basis points", () => {
    let state = statuses();
    state = withStatus(state, "target", "evade", 1);
    state = withStatus(state, "target", "mirror-image", 1);
    state = withStatus(state, "source", "sharpen", 60);
    const dodged = resolveTowDamageV2(direct({
      source: actor("source", { critChanceBps: 9_000 }),
      target: actor("target", { dodgeChanceBps: 9_000 }),
      statuses: state,
      randomDraws: [9_999, 9_999],
    }));
    expect(dodged.outcome.dodgeChanceBps).toBe(10_000);
    expect(dodged.outcome.criticalChanceBps).toBe(10_000);
    expect(dodged.outcome.dodged).toBe(true);
  });

  it("fails closed on malformed actors, packet kinds, draw counts, and mixed periodic sources", () => {
    const cases = [
      { ...direct(), source: null },
      { ...direct(), source: actor("target") },
      { ...direct(), source: { ...actor("source"), extra: true } },
      { ...direct(), target: actor("missing") },
      { ...direct(), packet: { kind: "legacy", amount: 1, attackScaleBps: 0 } },
      { ...direct(), packet: { kind: "direct", amount: -1, attackScaleBps: 10_000 } },
      { ...direct(), packet: { kind: "direct", amount: 1, attackScaleBps: -1 } },
      { ...direct(), randomDraws: [1] },
      { ...direct(), randomDraws: [1, 10_000] },
      {
        ...direct(),
        source: actor("source"),
        packet: { kind: "periodic", amount: 1, attackScaleBps: 0 },
        randomDraws: [],
      },
      {
        ...direct(),
        source: null,
        packet: { kind: "periodic", amount: 1, attackScaleBps: 0 },
        randomDraws: [0],
      },
    ];
    for (const input of cases) {
      const result = resolveTowDamageV2(input);
      expect(result.ok).toBe(false);
      expect(result.outcome).toBe(null);
      expect(result.statuses).toBe(null);
      assertDeeplyFrozen(result);
    }
  });

  it("contains no legacy runtime imports or name-derived execution branch", () => {
    const damageSource = readFileSync(new URL("./damage-v2.js", import.meta.url), "utf8");
    const statusSource = readFileSync(new URL("./status-runtime-v2.js", import.meta.url), "utf8");
    for (const source of [damageSource, statusSource]) {
      expect(source).not.toMatch(/from\s+["'].\/(?:encounter|session|simulation|status-stack|tow-damage)\.js/);
      expect(source).not.toContain("infer-v1");
    }
  });
});
