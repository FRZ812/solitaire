import { describe, expect, it } from "vitest";

import {
  TOW_ABILITY_RULESET_V2_ID,
  TOW_ABILITY_RULES_V2_VERSION,
  abilityRulesV2AtRank,
  defineZoneRulesV2Registry,
} from "./ability-rules-v2.js";
import { getTowAbilityRulesV2 } from "./ability-catalog-v2.js";
import {
  TOW_MOVEMENT_POLICY_V2,
  formationCellWorldPositionV2,
  quantizeOrthogonalDirectionV2,
  resolveTowMovementV2,
  validateTowMovementContextV2,
  validateTowMovementEffectV2,
  validateTowMovementStateV2,
} from "./movement-v2.js";
import { createTowZoneStateV2, placeTowZoneV2 } from "./zones-v2.js";

function formation(entries = {}) {
  return Array.from({ length: 9 }, (_, index) => entries[index] ?? null);
}

function actor(id, side, hp = 100) {
  return { id, side, hp, maxHp: 100 };
}

function battle({
  player = formation({ 0: "caster" }),
  enemy = formation({ 0: "target" }),
  actors = null,
  version = 2,
} = {}) {
  const inferred = {};
  for (const [side, slots] of Object.entries({ player, enemy })) {
    for (const id of slots) {
      if (id !== null) inferred[id] = actor(id, side);
    }
  }
  return {
    actors: actors ?? inferred,
    formations: { version, player, enemy },
  };
}

function abilityEffect(id, primitive, rank = 1) {
  return abilityRulesV2AtRank(getTowAbilityRulesV2(id), rank)
    .effects.find((effect) => effect.primitive === primitive);
}

function effect({
  primitive = "move",
  recipient = "caster",
  motion = "to-anchor",
  amount = 1,
} = {}) {
  return {
    primitive,
    operation: primitive,
    recipient,
    scalesFrom: null,
    subject: null,
    motion,
    value: { unit: "cells", basis: "none", amount },
  };
}

function context(overrides = {}) {
  return {
    casterId: "caster",
    committedRecipient: null,
    moverId: "caster",
    anchor: null,
    sourceCell: { side: "player", index: 0 },
    ...overrides,
  };
}

function targetContext(index, overrides = {}) {
  return context({
    moverId: "target",
    committedRecipient: { actorId: "target", side: "enemy", index },
    ...overrides,
  });
}

function emptyZones() {
  return createTowZoneStateV2({ zones: [] }).state;
}

function placeDefaultZone(overrides = {}) {
  return placeTowZoneV2(emptyZones(), {
    instanceId: "zone-1",
    definitionId: "ranger-snare",
    ownerActorId: "caster",
    ownerSide: "player",
    side: "enemy",
    index: 3,
    rank: 1,
    resolvedPotency: 1,
    rounds: 2,
    sequence: 1,
    ...overrides,
  }).state;
}

function blockEntryRegistry() {
  return defineZoneRulesV2Registry([{
    version: TOW_ABILITY_RULES_V2_VERSION,
    rulesetId: TOW_ABILITY_RULESET_V2_ID,
    id: "test-block-entry",
    rankCount: 1,
    movementPolicy: "block-entry",
    timing: { trigger: "enter", tick: "after-enter" },
    stacking: { policy: "replace", cap: null },
    payload: {
      primitive: "status",
      operation: "add",
      recipient: "all-occupants",
      scalesFrom: null,
      subject: "restraint",
      potency: { unit: "stacks", basis: "none", byRank: [1] },
    },
  }]);
}

function placeEntryZone(registry) {
  return placeTowZoneV2(emptyZones(), {
    instanceId: "entry-zone",
    definitionId: "test-block-entry",
    ownerActorId: "caster",
    ownerSide: "player",
    side: "enemy",
    index: 3,
    rank: 1,
    resolvedPotency: 1,
    rounds: 2,
    sequence: 1,
  }, { registry }).state;
}

describe("tow movement v2 facing geometry", () => {
  it("projects both side-local front rows into one shared facing plane", () => {
    expect(formationCellWorldPositionV2("player", 0)).toEqual({ x: 0, y: 3 });
    expect(formationCellWorldPositionV2("player", 8)).toEqual({ x: 2, y: 5 });
    expect(formationCellWorldPositionV2("enemy", 0)).toEqual({ x: 0, y: 2 });
    expect(formationCellWorldPositionV2("enemy", 8)).toEqual({ x: 2, y: 0 });
    expect(TOW_MOVEMENT_POLICY_V2.coordinates)
      .toBe("x-column-player-y-3-plus-row-enemy-y-2-minus-row");
  });

  it("quantizes orthogonally with vertical winning exact ties", () => {
    expect(quantizeOrthogonalDirectionV2({ x: 0, y: 0 }, { x: 2, y: 2 }))
      .toEqual({ dx: 0, dy: 1 });
    expect(quantizeOrthogonalDirectionV2({ x: 2, y: 2 }, { x: 0, y: 0 }))
      .toEqual({ dx: 0, dy: -1 });
    expect(quantizeOrthogonalDirectionV2({ x: 0, y: 0 }, { x: 2, y: 1 }))
      .toEqual({ dx: 1, dy: 0 });
    expect(quantizeOrthogonalDirectionV2({ x: 1, y: 1 }, { x: 1, y: 1 })).toBeNull();
  });
});

describe("tow movement v2 primitive semantics", () => {
  it("pushes an enemy away from the committed source along the facing vector", () => {
    const state = battle();
    const before = structuredClone(state);
    const resolved = resolveTowMovementV2(
      state,
      abilityEffect("arctic-giants-smash", "push"),
      targetContext(0),
    );

    expect(resolved).toMatchObject({ ok: true, reason: null });
    expect(resolved.formations.enemy).toEqual(formation({ 3: "target" }));
    expect(resolved.movement).toMatchObject({
      actorId: "target",
      fromIndex: 0,
      toIndex: 3,
      requestedDistance: 1,
      movedDistance: 1,
      completed: true,
      stoppedReason: null,
    });
    expect(resolved.events).toEqual([expect.objectContaining({
      type: "unit-moved",
      forced: true,
      from: { side: "enemy", index: 0 },
      to: { side: "enemy", index: 3 },
    })]);
    expect(state).toEqual(before);
    expect(Object.isFrozen(resolved.formations.enemy)).toBe(true);
  });

  it("applies the same facing rule when the enemy side is the source", () => {
    const state = battle({
      player: formation({ 0: "target" }),
      enemy: formation({ 0: "caster" }),
    });
    const resolved = resolveTowMovementV2(
      state,
      abilityEffect("arctic-giants-smash", "push"),
      {
        casterId: "caster",
        moverId: "target",
        sourceCell: { side: "enemy", index: 0 },
        committedRecipient: { actorId: "target", side: "player", index: 0 },
        anchor: null,
      },
    );

    expect(resolved.formations.player).toEqual(formation({ 3: "target" }));
    expect(resolved.movement.steps[0].to).toEqual({ side: "player", index: 3 });
  });

  it("freezes source-target-vector to the committed source cell", () => {
    const state = battle({
      player: formation({ 2: "caster" }),
      enemy: formation({ 0: "target" }),
    });
    const resolved = resolveTowMovementV2(
      state,
      abilityEffect("arctic-giants-smash", "push"),
      targetContext(0, {
        // The caster moved from committed cell 0 to current cell 2 before this effect.
        sourceCell: { side: "player", index: 0 },
      }),
    );

    // Committed cell 0 yields a vertical push to enemy cell 3. Recomputing from current
    // caster cell 2 would rotate horizontally and stop at the left boundary instead.
    expect(resolved.formations.enemy).toEqual(formation({ 3: "target" }));
    expect(resolved.movement.steps[0].to).toEqual({ side: "enemy", index: 3 });
  });

  it("freezes source-target-vector to the committed recipient cell", () => {
    const state = battle({
      player: formation({ 0: "caster" }),
      enemy: formation({ 2: "target" }),
    });
    const resolved = resolveTowMovementV2(
      state,
      abilityEffect("arctic-giants-smash", "push"),
      targetContext(0),
    );

    // The selected unit moved from committed enemy cell 0 to current cell 2 before the
    // effect. The frozen vertical vector traverses from current cell 2 to enemy cell 5.
    expect(resolved.formations.enemy).toEqual(formation({ 5: "target" }));
    expect(resolved.movement.steps[0].to).toEqual({ side: "enemy", index: 5 });
  });

  it("pulls a rear enemy against the committed source-target vector one cell at a time", () => {
    const state = battle({ enemy: formation({ 6: "target" }) });
    const resolved = resolveTowMovementV2(
      state,
      abilityEffect("clocktower-grappling-hook", "pull", 3),
      targetContext(6),
    );

    expect(resolved.formations.enemy).toEqual(formation({ 0: "target" }));
    expect(resolved.movement.steps.map(({ from, to }) => [from.index, to.index]))
      .toEqual([[6, 3], [3, 0]]);
    expect(resolved.movement.movedDistance).toBe(2);
  });

  it("caps authored displacement with an explicit status-owned allowance", () => {
    const state = battle({ enemy: formation({ 6: "target" }) });
    const resolved = resolveTowMovementV2(
      state,
      abilityEffect("clocktower-grappling-hook", "pull", 3),
      targetContext(6),
      { allowedCells: 1 },
    );

    expect(resolved.formations.enemy).toEqual(formation({ 3: "target" }));
    expect(resolved.movement).toMatchObject({
      requestedDistance: 2,
      allowedDistance: 1,
      plannedDistance: 1,
      movedDistance: 1,
    });
  });

  it("moves away from an anchor in the natural facing direction", () => {
    const state = battle({
      player: formation({ 0: "caster" }),
      enemy: formation({ 0: "target" }),
    });
    const resolved = resolveTowMovementV2(
      state,
      abilityEffect("assassin-flash-bomb", "move"),
      context({ anchor: { side: "enemy", index: 0 } }),
    );

    expect(resolved.formations.player).toEqual(formation({ 3: "caster" }));
    expect(resolved.movement.steps[0].to).toEqual({ side: "player", index: 3 });
  });

  it("freezes away-from-anchor to the committed mover endpoint", () => {
    const state = battle({
      player: formation({ 2: "caster" }),
      enemy: formation({ 0: "target" }),
    });
    const resolved = resolveTowMovementV2(
      state,
      abilityEffect("assassin-flash-bomb", "move"),
      context({
        anchor: { side: "enemy", index: 0 },
        sourceCell: { side: "player", index: 0 },
      }),
    );

    expect(resolved.formations.player).toEqual(formation({ 5: "caster" }));
    expect(resolved.movement.steps[0].to).toEqual({ side: "player", index: 5 });
  });

  it("reaches to-anchor by deterministic orthogonal steps with vertical ties first", () => {
    const state = battle({ enemy: formation({}) });
    const resolved = resolveTowMovementV2(
      state,
      effect({ amount: 4 }),
      context({ anchor: { side: "player", index: 8 } }),
    );

    expect(resolved.movement.steps.map(({ to }) => to.index)).toEqual([3, 4, 7, 8]);
    expect(resolved.formations.player).toEqual(formation({ 8: "caster" }));
    expect(resolved.movement).toMatchObject({
      plannedDistance: 4,
      goalIndex: 8,
      completed: true,
    });
  });

  it("moves toward an anchor only for the ranked distance", () => {
    const state = battle({ enemy: formation({}) });
    const resolved = resolveTowMovementV2(
      state,
      effect({ motion: "toward-anchor", amount: 2 }),
      context({ anchor: { side: "player", index: 8 } }),
    );

    // From player 0 to enemy 8 is a vertical tie first, then continues toward the anchor.
    expect(resolved.movement.steps.map(({ to }) => to.index)).toEqual([3, 4]);
    expect(resolved.movement.movedDistance).toBe(2);
  });

  it("chooses the nearest empty same-row cell, breaking ties by lower index", () => {
    const state = battle({
      player: formation({ 4: "caster" }),
      enemy: formation({ 0: "target" }),
    });
    const resolved = resolveTowMovementV2(
      state,
      abilityEffect("blade-one-flash", "move"),
      context(),
    );

    expect(resolved.formations.player).toEqual(formation({ 3: "caster" }));
    expect(resolved.movement).toMatchObject({ goalIndex: 3, plannedDistance: 1 });
  });
});

describe("tow movement v2 collision and boundary stops", () => {
  it("stops at the first occupied cell without rerouting, swapping, or cascading", () => {
    const state = battle({
      player: formation({ 0: "caster", 3: "blocker" }),
      enemy: formation({}),
    });
    const resolved = resolveTowMovementV2(
      state,
      effect({ amount: 4 }),
      context({ anchor: { side: "player", index: 8 } }),
    );

    expect(resolved.ok).toBe(true);
    expect(resolved.formations.player).toEqual(state.formations.player);
    expect(resolved.movement).toMatchObject({
      movedDistance: 0,
      completed: false,
      stoppedReason: "occupied",
    });
    expect(resolved.events[0]).toMatchObject({
      type: "movement-stopped",
      reason: "occupied",
      occupyingActorId: "blocker",
      from: { side: "player", index: 0 },
      to: { side: "player", index: 3 },
    });
  });

  it("keeps successful partial displacement when a later cell is occupied", () => {
    const state = battle({
      player: formation({ 0: "caster", 4: "blocker" }),
      enemy: formation({}),
    });
    const resolved = resolveTowMovementV2(
      state,
      effect({ amount: 4 }),
      context({ anchor: { side: "player", index: 8 } }),
    );

    expect(resolved.formations.player).toEqual(formation({ 3: "caster", 4: "blocker" }));
    expect(resolved.movement).toMatchObject({
      movedDistance: 1,
      toIndex: 3,
      completed: false,
      stoppedReason: "occupied",
    });
  });

  it("stops at the side boundary and never crosses into the opposing formation", () => {
    const state = battle({
      player: formation({ 0: "caster" }),
      enemy: formation({ 6: "target" }),
    });
    const resolved = resolveTowMovementV2(
      state,
      effect({
        primitive: "push",
        recipient: "selected-units",
        motion: "source-target-vector",
        amount: 4,
      }),
      targetContext(6),
    );

    expect(resolved.formations.enemy).toEqual(formation({ 6: "target" }));
    expect(resolved.movement).toMatchObject({
      movedDistance: 0,
      stoppedReason: "boundary",
      completed: false,
    });
    expect(resolved.events[0]).toMatchObject({ reason: "boundary", to: null });
  });

  it("refuses cross-side and out-of-distance to-anchor commands", () => {
    const state = battle();
    expect(resolveTowMovementV2(
      state,
      effect({ amount: 4 }),
      context({ anchor: { side: "enemy", index: 8 } }),
    )).toMatchObject({ ok: false, reason: "movement-to-anchor-cross-side-v2" });
    expect(resolveTowMovementV2(
      state,
      effect({ amount: 1 }),
      context({ anchor: { side: "player", index: 8 } }),
    )).toMatchObject({ ok: false, reason: "movement-to-anchor-out-of-distance-v2" });
  });
});

describe("tow movement v2 zone composition", () => {
  it("collects an after-enter tick only after a successful step", () => {
    const state = battle();
    const zones = placeDefaultZone();
    const resolved = resolveTowMovementV2(
      state,
      abilityEffect("arctic-giants-smash", "push"),
      targetContext(0),
      { zones },
    );

    expect(resolved.formations.enemy).toEqual(formation({ 3: "target" }));
    expect(resolved.ticks).toEqual([expect.objectContaining({
      type: "zone-tick",
      timing: "after-enter",
      actorId: "target",
      definitionId: "ranger-snare",
    })]);
    expect(resolved.movement.steps[0].enterTicks).toEqual(resolved.ticks);
  });

  it("stops at a zone exit boundary before considering the destination", () => {
    const state = battle({ enemy: formation({ 3: "target", 6: "blocker" }) });
    const zones = placeDefaultZone();
    const resolved = resolveTowMovementV2(
      state,
      abilityEffect("arctic-giants-smash", "push"),
      targetContext(3),
      { zones },
    );

    expect(resolved.movement).toMatchObject({
      movedDistance: 0,
      stoppedReason: "zone-block-exit",
    });
    expect(resolved.events[0]).toMatchObject({
      reason: "zone-block-exit",
      blockers: [expect.objectContaining({ boundary: "exit" })],
    });
  });

  it("stops at an authored zone entry boundary", () => {
    const registry = blockEntryRegistry();
    const zones = placeEntryZone(registry);
    const state = battle();
    const resolved = resolveTowMovementV2(
      state,
      abilityEffect("arctic-giants-smash", "push"),
      targetContext(0),
      { zones, registry },
    );

    expect(resolved.formations.enemy).toEqual(formation({ 0: "target" }));
    expect(resolved.movement).toMatchObject({
      movedDistance: 0,
      stoppedReason: "zone-block-entry",
    });
    expect(resolved.ticks).toEqual([]);
  });
});

describe("tow movement v2 strict validation", () => {
  it("accepts only rank-resolved movement effects and exact contexts", () => {
    const resolvedEffect = abilityEffect("arctic-giants-smash", "push");
    expect(validateTowMovementEffectV2(resolvedEffect)).toEqual({ ok: true, reason: null });
    expect(validateTowMovementEffectV2({ ...resolvedEffect, legacy: true })).toMatchObject({
      ok: false,
      reason: "invalid-movement-effect-v2-shape",
    });
    expect(validateTowMovementContextV2(
      targetContext(0, { anchor: { side: "enemy", index: 0 } }),
      resolvedEffect,
    )).toMatchObject({ ok: false, reason: "invalid-movement-context-v2-anchor" });
    expect(validateTowMovementContextV2(
      { ...targetContext(0), inferredFromV1: true },
      resolvedEffect,
    )).toMatchObject({ ok: false, reason: "invalid-movement-context-v2" });
    expect(resolveTowMovementV2(
      battle(),
      resolvedEffect,
      targetContext(0),
      { allowedCells: 2 },
    )).toMatchObject({ ok: false, reason: "invalid-movement-options-v2" });
    expect(resolveTowMovementV2(
      battle(),
      resolvedEffect,
      targetContext(0, {
        committedRecipient: { actorId: "somebody-else", side: "enemy", index: 0 },
      }),
    )).toMatchObject({ ok: false, reason: "movement-recipient-snapshot-mismatch-v2" });
    expect(resolveTowMovementV2(
      battle(),
      resolvedEffect,
      targetContext(0, { sourceCell: { side: "enemy", index: 0 } }),
    )).toMatchObject({ ok: false, reason: "movement-source-cell-side-mismatch-v2" });
  });

  it("rejects malformed formations and dead or unfielded actors fail closed", () => {
    expect(validateTowMovementStateV2(battle({ version: 1 }))).toMatchObject({
      ok: false,
      reason: "invalid-movement-state-v2",
    });
    const dead = battle({
      actors: {
        caster: actor("caster", "player"),
        target: actor("target", "enemy", 0),
      },
    });
    expect(resolveTowMovementV2(
      dead,
      abilityEffect("arctic-giants-smash", "push"),
      targetContext(0),
    )).toMatchObject({
      ok: false,
      reason: "movement-actor-not-living-and-fielded-v2",
    });
  });

  it("refuses a nearest-row move when no eligible empty cell exists", () => {
    const state = battle({
      player: formation({ 3: "left", 4: "caster", 5: "right" }),
      enemy: formation({}),
    });
    expect(resolveTowMovementV2(
      state,
      abilityEffect("blade-one-flash", "move"),
      context(),
    )).toMatchObject({ ok: false, reason: "movement-no-empty-same-row-v2" });
  });
});
