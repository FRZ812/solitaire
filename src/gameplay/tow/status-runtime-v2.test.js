import { describe, expect, it } from "vitest";
import {
  TOW_ABILITY_STATUS_LIST_V2,
  TOW_ABILITY_STATUSES_V2,
} from "./ability-catalog-v2.js";
import {
  TOW_STATUS_BEHAVIOR_POLICY_V2,
  TOW_STATUS_POLICY_V2_CHECKSUM,
  TOW_STATUS_RUNTIME_RESOLVERS_V2,
  adjudicateTowStatusActionV2,
  advanceTowStatusBoundaryV2,
  calculateTowStatusPolicyV2Checksum,
  createTowStatusRuntimeV2,
  isTowStatusRuntimeV2,
  mutateTowStatusV2,
  resolveTowDirectHitStatusesV2,
  resolveTowForcedTargetV2,
  resolveTowMovementAllowanceV2,
  towStatusCombatModifiersV2,
  towStatusMagnitudeV2,
  validateTowStatusRuntimeV2,
} from "./status-runtime-v2.js";

const ACTORS = Object.freeze(["alpha", "bravo", "charlie"]);

function create() {
  const result = createTowStatusRuntimeV2({ actorIds: ACTORS });
  expect(result.ok).toBe(true);
  return result.state;
}

function mutate(state, actorId, statusId, value, sourceActorId = null, operation = "add") {
  const result = mutateTowStatusV2(state, {
    actorId,
    statusId,
    operation,
    value,
    sourceActorId,
  });
  expect(result.ok, result.reason).toBe(true);
  return result;
}

function withStatus(state, actorId, statusId, value, sourceActorId = null) {
  return mutate(state, actorId, statusId, value, sourceActorId).state;
}

function assertDeeplyFrozen(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) assertDeeplyFrozen(child, seen);
}

describe("Tower status runtime v2", () => {
  it("registers one immutable concrete policy and resolver for all thirty statuses", () => {
    const ids = Object.keys(TOW_ABILITY_STATUSES_V2).sort();
    expect(ids).toHaveLength(30);
    expect(Object.keys(TOW_STATUS_BEHAVIOR_POLICY_V2).sort()).toEqual(ids);
    expect(Object.keys(TOW_STATUS_RUNTIME_RESOLVERS_V2).sort()).toEqual(ids);
    expect(new Set(Object.values(TOW_STATUS_RUNTIME_RESOLVERS_V2)).size).toBe(30);

    for (const definition of TOW_ABILITY_STATUS_LIST_V2) {
      const policy = TOW_STATUS_BEHAVIOR_POLICY_V2[definition.id];
      expect(policy.behavior, definition.id).toBe(definition.behavior);
      expect(typeof TOW_STATUS_RUNTIME_RESOLVERS_V2[definition.id], definition.id)
        .toBe("function");
      expect([
        policy.actionLockLanes.length > 0,
        policy.afterDirectHit.applyStatus !== null,
        policy.afterDirectHit.consumeDefender > 0,
        policy.attackDeltaPerMagnitude !== 0,
        policy.avoidanceBonusBps !== 0,
        policy.boundaryEffect !== null,
        policy.criticalChanceBpsPerMagnitude !== 0,
        policy.defenseDeltaPerMagnitude !== 0,
        policy.directFlatReductionPerMagnitude !== 0,
        policy.directReductionBps !== 0,
        policy.forcedTarget,
        policy.lifestealBpsPerMagnitude !== 0,
        policy.movement.mode !== "none",
        policy.redirectBps !== 0,
        policy.reflectionPerMagnitude !== 0,
        policy.summonRole !== null,
      ].some(Boolean), definition.id).toBe(true);
    }
    assertDeeplyFrozen(TOW_STATUS_BEHAVIOR_POLICY_V2);
    assertDeeplyFrozen(TOW_STATUS_RUNTIME_RESOLVERS_V2);
  });

  it("locks the complete status policy to an intentional checksum", () => {
    expect(TOW_STATUS_POLICY_V2_CHECKSUM).toBe("fnv1a32:bcab7c74");
    expect(calculateTowStatusPolicyV2Checksum()).toBe(TOW_STATUS_POLICY_V2_CHECKSUM);
  });

  it("creates one canonical immutable actor map and rejects malformed snapshots", () => {
    const result = createTowStatusRuntimeV2({ actorIds: ["charlie", "alpha", "bravo"] });
    expect(result.state).toMatchObject({
      version: 2,
      rulesetId: "solitaire-tow-v2",
      runtimeVersion: 1,
      nextApplicationSequence: 1,
      actors: { alpha: [], bravo: [], charlie: [] },
    });
    expect(Object.keys(result.state.actors)).toEqual(ACTORS);
    expect(validateTowStatusRuntimeV2(result.state)).toEqual({ ok: true, reason: null });
    expect(isTowStatusRuntimeV2(result.state)).toBe(true);
    assertDeeplyFrozen(result);

    for (const input of [
      null,
      {},
      { actorIds: [] },
      { actorIds: ["alpha", "alpha"] },
      { actorIds: [""] },
      { actorIds: ACTORS, extra: true },
    ]) {
      expect(createTowStatusRuntimeV2(input).ok).toBe(false);
    }
    expect(validateTowStatusRuntimeV2({ ...result.state, version: 1 }))
      .toEqual({ ok: false, reason: "invalid-status-runtime-v2-version" });
    expect(validateTowStatusRuntimeV2({ ...result.state, nextApplicationSequence: 0 }))
      .toEqual({ ok: false, reason: "invalid-status-runtime-v2-sequence" });
  });

  it("adds, caps, subtracts, scales, retains, and clears without mutating prior state", () => {
    const empty = create();
    const first = mutate(empty, "alpha", "strength", 40);
    const stacked = mutate(first.state, "alpha", "strength", 30);
    expect(towStatusMagnitudeV2(empty, "alpha", "strength")).toBe(0);
    expect(towStatusMagnitudeV2(stacked.state, "alpha", "strength")).toBe(70);
    expect(stacked.state.nextApplicationSequence).toBe(2);
    expect(stacked.event).toMatchObject({ before: 40, after: 70, operation: "add" });

    const subtracted = mutate(stacked.state, "alpha", "strength", 11, null, "subtract");
    expect(towStatusMagnitudeV2(subtracted.state, "alpha", "strength")).toBe(59);
    const scaled = mutate(subtracted.state, "alpha", "strength", 150, null, "scale");
    expect(towStatusMagnitudeV2(scaled.state, "alpha", "strength")).toBe(88);
    const retained = mutate(scaled.state, "alpha", "strength", 40, null, "retain-percent");
    expect(towStatusMagnitudeV2(retained.state, "alpha", "strength")).toBe(35);
    const cleared = mutate(retained.state, "alpha", "strength", 0, null, "clear");
    expect(towStatusMagnitudeV2(cleared.state, "alpha", "strength")).toBe(0);
    expect(cleared.state.actors.alpha).toEqual([]);
    assertDeeplyFrozen(cleared);
  });

  it("keeps canonical status ordering and gives replace-status provenance to the latest source", () => {
    let state = create();
    state = withStatus(state, "alpha", "thorn", 4);
    state = withStatus(state, "alpha", "bleed", 7);
    state = withStatus(state, "alpha", "challenged", 1, "bravo");
    const firstSequence = state.actors.alpha.find(({ id }) => id === "challenged")
      .applicationSequence;
    state = withStatus(state, "alpha", "challenged", 1, "charlie");
    const challenged = state.actors.alpha.find(({ id }) => id === "challenged");

    expect(state.actors.alpha.map(({ id }) => id)).toEqual(["bleed", "challenged", "thorn"]);
    expect(challenged.sourceActorId).toBe("charlie");
    expect(challenged.applicationSequence).toBeGreaterThan(firstSequence);
    expect(challenged.durationRemaining).toBe(1);
    expect(validateTowStatusRuntimeV2(state)).toEqual({ ok: true, reason: null });
  });

  it("fails closed on unknown actors, statuses, illegal provenance, and malformed operations", () => {
    const state = create();
    const base = {
      actorId: "alpha",
      statusId: "strength",
      operation: "add",
      value: 1,
      sourceActorId: null,
    };
    const cases = [
      [{ ...base, actorId: "missing" }, "invalid-status-runtime-v2-mutation"],
      [{ ...base, statusId: "unknown" }, "invalid-status-runtime-v2-mutation"],
      [{ ...base, operation: "infer" }, "invalid-status-runtime-v2-mutation"],
      [{ ...base, value: -1 }, "invalid-status-runtime-v2-mutation"],
      [{ ...base, sourceActorId: "bravo" }, "invalid-status-runtime-v2-provenance"],
      [{ ...base, statusId: "challenged" }, "invalid-status-runtime-v2-provenance"],
      [{ ...base, statusId: "challenged", sourceActorId: "missing" }, "invalid-status-runtime-v2-provenance"],
      [{ ...base, extra: true }, "invalid-status-runtime-v2-mutation"],
    ];
    for (const [input, reason] of cases) {
      const result = mutateTowStatusV2(state, input);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe(reason);
      expect(result.state).toEqual(state);
    }
    expect(() => towStatusMagnitudeV2(state, "alpha", "unknown"))
      .toThrow("unknown-status-runtime-v2-id");
  });

  it("emits periodic damage in canonical order before applying poison decay and Doom expiry", () => {
    let state = create();
    state = withStatus(state, "alpha", "poison", 3);
    state = withStatus(state, "alpha", "doom", 9);
    state = withStatus(state, "alpha", "bleed", 5);
    state = withStatus(state, "alpha", "burn", 7);

    const tick = advanceTowStatusBoundaryV2(state, {
      boundary: "recipient-turn-end",
      actorId: "alpha",
    });
    expect(tick.intents.map(({ statusId, amount }) => [statusId, amount])).toEqual([
      ["bleed", 5],
      ["burn", 7],
      ["doom", 9],
      ["poison", 3],
    ]);
    expect(towStatusMagnitudeV2(tick.state, "alpha", "bleed")).toBe(5);
    expect(towStatusMagnitudeV2(tick.state, "alpha", "burn")).toBe(7);
    expect(towStatusMagnitudeV2(tick.state, "alpha", "doom")).toBe(0);
    expect(towStatusMagnitudeV2(tick.state, "alpha", "poison")).toBe(2);
  });

  it("honours recipient duration clocks after hooks and clears everything only at combat end", () => {
    let state = create();
    state = withStatus(state, "alpha", "blade-dance-parry", 20);
    state = withStatus(state, "alpha", "parry", 10);
    state = withStatus(state, "alpha", "challenged", 1, "bravo");

    const first = advanceTowStatusBoundaryV2(state, {
      boundary: "recipient-turn-end",
      actorId: "alpha",
    });
    expect(towStatusMagnitudeV2(first.state, "alpha", "blade-dance-parry")).toBe(20);
    expect(first.state.actors.alpha.find(({ id }) => id === "blade-dance-parry")
      .durationRemaining).toBe(1);
    expect(towStatusMagnitudeV2(first.state, "alpha", "parry")).toBe(0);
    expect(towStatusMagnitudeV2(first.state, "alpha", "challenged")).toBe(0);

    const second = advanceTowStatusBoundaryV2(first.state, {
      boundary: "recipient-turn-end",
      actorId: "alpha",
    });
    expect(towStatusMagnitudeV2(second.state, "alpha", "blade-dance-parry")).toBe(0);
    const ended = advanceTowStatusBoundaryV2(second.state, {
      boundary: "combat-end",
      actorId: null,
    });
    expect(Object.values(ended.state.actors).every((records) => records.length === 0)).toBe(true);
  });

  it("converts Haste and Initiative into typed budget intents without inventing reaction budget", () => {
    let state = create();
    state = withStatus(state, "alpha", "haste", 2);
    state = withStatus(state, "alpha", "initiative", 235);
    const opened = advanceTowStatusBoundaryV2(state, {
      boundary: "recipient-turn-start",
      actorId: "alpha",
    });

    expect(opened.intents).toEqual([
      {
        type: "budget",
        actorId: "alpha",
        sourceActorId: null,
        targetActorId: null,
        statusId: "haste",
        damageKind: null,
        lane: "quick",
        amount: 1,
      },
      {
        type: "budget",
        actorId: "alpha",
        sourceActorId: null,
        targetActorId: null,
        statusId: "initiative",
        damageKind: null,
        lane: "main",
        amount: 2,
      },
    ]);
    expect(towStatusMagnitudeV2(opened.state, "alpha", "initiative")).toBe(35);
    expect(towStatusMagnitudeV2(opened.state, "alpha", "haste")).toBe(2);
  });

  it("consumes one canonical action lock at the command it refuses", () => {
    let state = create();
    state = withStatus(state, "alpha", "stun", 2);
    state = withStatus(state, "alpha", "paralyze", 1);
    const first = adjudicateTowStatusActionV2(state, { actorId: "alpha", lane: "main" });
    expect(first.event).toMatchObject({ allowed: false, blockedBy: "paralyze", consumed: 1 });
    expect(towStatusMagnitudeV2(first.state, "alpha", "paralyze")).toBe(0);
    expect(towStatusMagnitudeV2(first.state, "alpha", "stun")).toBe(2);

    const second = adjudicateTowStatusActionV2(first.state, { actorId: "alpha", lane: "quick" });
    expect(second.event).toMatchObject({ allowed: false, blockedBy: "stun", consumed: 1 });
    const third = adjudicateTowStatusActionV2(second.state, { actorId: "alpha", lane: "reaction" });
    expect(third.event).toMatchObject({ allowed: false, blockedBy: "stun", consumed: 1 });
    const allowed = adjudicateTowStatusActionV2(third.state, { actorId: "alpha", lane: "main" });
    expect(allowed.event).toMatchObject({ allowed: true, blockedBy: null, consumed: 0 });
  });

  it("enforces Challenge provenance and expires instead of guessing when its source is invalid", () => {
    let state = create();
    state = withStatus(state, "alpha", "challenged", 1, "bravo");
    const valid = resolveTowForcedTargetV2(state, {
      actorId: "alpha",
      validActorIds: ["charlie", "bravo"],
    });
    expect(valid.event).toMatchObject({ targetActorId: "bravo", expired: false });

    const invalid = resolveTowForcedTargetV2(valid.state, {
      actorId: "alpha",
      validActorIds: ["charlie"],
    });
    expect(invalid.event).toMatchObject({ targetActorId: null, expired: true });
    expect(towStatusMagnitudeV2(invalid.state, "alpha", "challenged")).toBe(0);
  });

  it("makes Restraint a hard movement lock and Limp a deterministic distance penalty", () => {
    let state = create();
    state = withStatus(state, "alpha", "limp", 21);
    const limping = resolveTowMovementAllowanceV2(state, {
      actorId: "alpha",
      requestedCells: 3,
    });
    expect(limping.event).toEqual({
      type: "status-movement-resolved",
      actorId: "alpha",
      requestedCells: 3,
      allowedCells: 1,
      blockedBy: null,
      limpPenalty: 2,
    });
    state = withStatus(limping.state, "alpha", "restraint", 1);
    expect(resolveTowMovementAllowanceV2(state, {
      actorId: "alpha",
      requestedCells: 3,
    }).event).toMatchObject({ allowedCells: 0, blockedBy: "restraint", limpPenalty: 0 });
  });

  it("derives every combat modifier from explicit policy rows", () => {
    let state = create();
    for (const [id, amount] of [
      ["strength", 30],
      ["cripple", 7],
      ["lethargy", 3],
      ["tenacity", 12],
      ["injured", 2],
      ["evade", 1],
      ["mirror-image", 2],
      ["sharpen", 25],
      ["protection", 9],
      ["parry", 11],
      ["skeleton", 4],
      ["solidity", 2],
      ["bone-shield", 1],
      ["lifesteal", 20],
      ["predator", 15],
      ["thorn", 8],
    ]) state = withStatus(state, "alpha", id, amount);

    expect(towStatusCombatModifiersV2(state, "alpha")).toEqual({
      attackDelta: 20,
      avoidanceBonusBps: 9_300,
      criticalChanceBonusBps: 2_500,
      defenseDelta: 10,
      directFlatReduction: 24,
      directReductionBps: 3_000,
      lifestealBps: 3_500,
      redirectBps: 6_000,
      reflectionDamage: 8,
    });
  });

  it("resolves landed-hit mutations once, including Judgment provenance-free Doom", () => {
    let state = create();
    state = withStatus(state, "alpha", "judgment", 12);
    for (const [id, amount] of [
      ["burn", 3],
      ["bone-shield", 2],
      ["mirror-image", 2],
      ["protection", 5],
      ["skeleton", 4],
      ["solidity", 2],
    ]) state = withStatus(state, "bravo", id, amount);

    const missed = resolveTowDirectHitStatusesV2(state, {
      attackerActorId: "alpha",
      defenderActorId: "bravo",
      landed: false,
    });
    expect(missed.event.mutations).toEqual([]);
    expect(missed.state).toEqual(state);

    const landed = resolveTowDirectHitStatusesV2(state, {
      attackerActorId: "alpha",
      defenderActorId: "bravo",
      landed: true,
    });
    expect(towStatusMagnitudeV2(landed.state, "alpha", "judgment")).toBe(0);
    expect(towStatusMagnitudeV2(landed.state, "bravo", "doom")).toBe(12);
    expect(landed.state.actors.bravo.find(({ id }) => id === "doom").sourceActorId).toBe(null);
    expect(towStatusMagnitudeV2(landed.state, "bravo", "burn")).toBe(2);
    expect(towStatusMagnitudeV2(landed.state, "bravo", "bone-shield")).toBe(1);
    expect(towStatusMagnitudeV2(landed.state, "bravo", "mirror-image")).toBe(1);
    expect(towStatusMagnitudeV2(landed.state, "bravo", "protection")).toBe(4);
    expect(towStatusMagnitudeV2(landed.state, "bravo", "skeleton")).toBe(3);
    expect(towStatusMagnitudeV2(landed.state, "bravo", "solidity")).toBe(1);
    expect(landed.event.mutations.map(({ statusId }) => statusId)).toEqual([
      "doom",
      "judgment",
      "bone-shield",
      "burn",
      "mirror-image",
      "protection",
      "skeleton",
      "solidity",
    ]);
  });

  it("rejects malformed hook calls instead of inferring actor or phase", () => {
    const state = create();
    expect(advanceTowStatusBoundaryV2(state, {
      boundary: "recipient-turn-end",
      actorId: null,
    }).reason).toBe("invalid-status-runtime-v2-boundary");
    expect(advanceTowStatusBoundaryV2(state, {
      boundary: "round-end",
      actorId: "alpha",
    }).reason).toBe("invalid-status-runtime-v2-boundary");
    expect(adjudicateTowStatusActionV2(state, { actorId: "alpha", lane: "legacy" }).ok)
      .toBe(false);
    expect(resolveTowDirectHitStatusesV2(state, {
      attackerActorId: "alpha",
      defenderActorId: "alpha",
      landed: true,
    }).ok).toBe(false);
    expect(() => TOW_STATUS_RUNTIME_RESOLVERS_V2.bleed({
      boundary: "recipient-turn-end",
      holderActorId: "alpha",
      record: { id: "poison" },
    })).toThrow("invalid-status-resolver-v2-context");
  });
});
