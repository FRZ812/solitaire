import { describe, expect, it } from "vitest";

import {
  TOW_ABILITY_RULESET_V2_ID,
  TOW_ABILITY_RULES_V2_VERSION,
  defineZoneRulesV2Registry,
} from "./ability-rules-v2.js";
import {
  TOW_ZONE_RUNTIME_POLICY_V2,
  collectTowZoneTicksV2,
  createTowZoneStateV2,
  endTowZoneRoundV2,
  isTowZoneStateV2,
  placeTowZoneV2,
  validateTowZoneStateV2,
  zoneMovementBlockersV2,
  zoneStackKeyV2,
} from "./zones-v2.js";

function emptyState() {
  const created = createTowZoneStateV2({ zones: [] });
  expect(created.ok).toBe(true);
  return created.state;
}

function placement(overrides = {}) {
  return {
    instanceId: "zone-1",
    definitionId: "ranger-snare",
    ownerActorId: "ranger",
    ownerSide: "player",
    side: "enemy",
    index: 4,
    rank: 1,
    resolvedPotency: 1,
    rounds: 2,
    sequence: 10,
    ...overrides,
  };
}

function occupant(overrides = {}) {
  return {
    actorId: "enemy-a",
    actorSide: "enemy",
    side: "enemy",
    index: 4,
    ...overrides,
  };
}

function customRegistry(policy, {
  cap = null,
  movementPolicy = "none",
  recipient = "all-occupants",
  trigger = "enter",
  tick = "after-enter",
} = {}) {
  return defineZoneRulesV2Registry([{
    version: TOW_ABILITY_RULES_V2_VERSION,
    rulesetId: TOW_ABILITY_RULESET_V2_ID,
    id: `test-${policy}`,
    rankCount: 2,
    movementPolicy,
    timing: { trigger, tick },
    stacking: { policy, cap },
    payload: {
      primitive: "status",
      operation: "add",
      recipient,
      scalesFrom: null,
      subject: "restraint",
      potency: { unit: "stacks", basis: "none", byRank: [1, 2] },
    },
  }]);
}

function customPlacement(policy, overrides = {}) {
  return placement({
    definitionId: `test-${policy}`,
    ...overrides,
  });
}

describe("tow zones v2 state authority", () => {
  it("creates a detached, deeply frozen, versioned empty state", () => {
    const input = { zones: [] };
    const result = createTowZoneStateV2(input);

    expect(result).toMatchObject({ ok: true, reason: null });
    expect(result.state).toEqual({
      version: TOW_ABILITY_RULES_V2_VERSION,
      rulesetId: TOW_ABILITY_RULESET_V2_ID,
      zones: [],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.state)).toBe(true);
    expect(Object.isFrozen(result.state.zones)).toBe(true);
    expect(input).toEqual({ zones: [] });
    expect(isTowZoneStateV2(result.state)).toBe(true);
  });

  it("rejects malformed, unknown, duplicate, and noncanonical serialized states", () => {
    expect(createTowZoneStateV2({})).toMatchObject({
      ok: false,
      reason: "invalid-zone-state-v2-create-input",
    });
    const first = placeTowZoneV2(emptyState(), placement()).state;
    const unknown = {
      ...first,
      zones: [{ ...first.zones[0], definitionId: "not-authored" }],
    };
    expect(validateTowZoneStateV2(unknown)).toMatchObject({
      ok: false,
      reason: "invalid-zone-state-v2-zone",
    });

    const second = placeTowZoneV2(first, placement({
      instanceId: "zone-2",
      index: 5,
      sequence: 11,
    })).state;
    expect(validateTowZoneStateV2({
      ...second,
      zones: [...second.zones].reverse(),
    })).toMatchObject({ ok: false, reason: "noncanonical-zone-state-v2-order" });
    expect(validateTowZoneStateV2({
      ...second,
      zones: [second.zones[0], { ...second.zones[1], instanceId: "zone-1" }],
    })).toMatchObject({ ok: false, reason: "duplicate-zone-state-v2-identity" });
  });
});

describe("tow zones v2 placement and stacking", () => {
  it("snapshots owner, rank, potency, lifetime, and key without ticking an occupant", () => {
    const state = emptyState();
    const input = placement();
    const before = structuredClone(input);
    const result = placeTowZoneV2(state, input);

    expect(result).toMatchObject({ ok: true, reason: null, ticks: [] });
    expect(result.events).toEqual([expect.objectContaining({
      type: "zone-created",
      instanceId: "zone-1",
      resolvedPotency: 1,
      roundsRemaining: 2,
    })]);
    expect(result.state.zones).toEqual([expect.objectContaining({
      key: zoneStackKeyV2("ranger", "ranger-snare", "enemy", 4),
      ownerSide: "player",
      side: "enemy",
      index: 4,
      rank: 1,
      resolvedPotency: 1,
      applications: 1,
      roundsRemaining: 2,
      createdSequence: 10,
      updatedSequence: 10,
    })]);
    expect(input).toEqual(before);
    expect(state.zones).toEqual([]);
    expect(Object.isFrozen(result.state.zones[0])).toBe(true);
    expect(TOW_ZONE_RUNTIME_POLICY_V2.creationCountsAsEnter).toBe(false);
  });

  it("refreshes with the newest rank, potency, and authored duration", () => {
    const initial = placeTowZoneV2(emptyState(), placement({
      resolvedPotency: 20,
      rounds: 5,
    })).state;
    const refreshed = placeTowZoneV2(initial, placement({
      instanceId: "discarded-new-id",
      rank: 2,
      resolvedPotency: 1,
      rounds: 1,
      sequence: 11,
    }));

    expect(refreshed.ok).toBe(true);
    expect(refreshed.events[0].type).toBe("zone-refreshed");
    expect(refreshed.state.zones[0]).toMatchObject({
      instanceId: "zone-1",
      rank: 2,
      resolvedPotency: 1,
      roundsRemaining: 1,
      createdSequence: 10,
      updatedSequence: 11,
    });
    expect(initial.zones[0]).toMatchObject({ resolvedPotency: 20, roundsRemaining: 5 });
  });

  it("keeps different owners on the same definition and cell as distinct zones", () => {
    const first = placeTowZoneV2(emptyState(), placement()).state;
    const second = placeTowZoneV2(first, placement({
      instanceId: "zone-2",
      ownerActorId: "ranger-2",
      sequence: 11,
    }));

    expect(second.ok).toBe(true);
    expect(second.state.zones).toHaveLength(2);
    expect(new Set(second.state.zones.map(({ key }) => key)).size).toBe(2);
    expect(second.state.zones.map(({ ownerActorId }) => ownerActorId))
      .toEqual(["ranger", "ranger-2"]);
  });

  it("implements replace and capped stack-potency without hidden defaults", () => {
    const replaceRegistry = customRegistry("replace");
    const replacedInitial = placeTowZoneV2(
      emptyState(),
      customPlacement("replace", { resolvedPotency: 8, rounds: 4 }),
      { registry: replaceRegistry },
    ).state;
    const replaced = placeTowZoneV2(replacedInitial, customPlacement("replace", {
      instanceId: "replacement",
      rank: 2,
      resolvedPotency: 2,
      rounds: 1,
      sequence: 12,
    }), { registry: replaceRegistry });
    expect(replaced.state.zones[0]).toMatchObject({
      instanceId: "replacement",
      rank: 2,
      resolvedPotency: 2,
      roundsRemaining: 1,
      createdSequence: 12,
    });

    const stackRegistry = customRegistry("stack-potency", { cap: 2 });
    const stackedInitial = placeTowZoneV2(
      emptyState(),
      customPlacement("stack-potency", { resolvedPotency: 3, rounds: 1 }),
      { registry: stackRegistry },
    ).state;
    const stackedTwice = placeTowZoneV2(stackedInitial, customPlacement("stack-potency", {
      instanceId: "ignored-2",
      resolvedPotency: 4,
      rounds: 3,
      sequence: 11,
    }), { registry: stackRegistry }).state;
    const capped = placeTowZoneV2(stackedTwice, customPlacement("stack-potency", {
      instanceId: "ignored-3",
      resolvedPotency: 50,
      rounds: 2,
      sequence: 12,
    }), { registry: stackRegistry });
    expect(capped.state.zones[0]).toMatchObject({
      instanceId: "zone-1",
      applications: 2,
      resolvedPotency: 7,
      roundsRemaining: 3,
      updatedSequence: 12,
    });
  });

  it("fails closed on stale sequence and duplicate instance identity", () => {
    const initial = placeTowZoneV2(emptyState(), placement()).state;
    expect(placeTowZoneV2(initial, placement({ sequence: 9 }))).toMatchObject({
      ok: false,
      reason: "stale-zone-placement-v2",
    });
    expect(placeTowZoneV2(initial, placement({ sequence: 10 }))).toMatchObject({
      ok: false,
      reason: "stale-zone-placement-v2",
    });
    expect(placeTowZoneV2(initial, placement({
      definitionId: "sorcerer-binding-growth",
      index: 5,
      rank: 1,
      sequence: 11,
    }))).toMatchObject({ ok: false, reason: "duplicate-zone-instance-v2-id" });
  });
});

describe("tow zones v2 trigger and boundary authority", () => {
  it("ticks enter zones only after entry and only for authored allegiance", () => {
    const placed = placeTowZoneV2(emptyState(), placement()).state;

    const enemy = collectTowZoneTicksV2(placed, {
      timing: "after-enter",
      occupants: [occupant()],
    });
    expect(enemy.ticks).toEqual([expect.objectContaining({
      type: "zone-tick",
      timing: "after-enter",
      actorId: "enemy-a",
      payload: expect.objectContaining({
        subject: "restraint",
        amount: 1,
        recipient: "enemy-occupants",
      }),
    })]);
    expect(collectTowZoneTicksV2(placed, {
      timing: "turn-start",
      occupants: [occupant()],
    }).ticks).toEqual([]);
    expect(collectTowZoneTicksV2(placed, {
      timing: "after-enter",
      occupants: [occupant({ actorId: "ally", actorSide: "player", side: "player" })],
    }).ticks).toEqual([]);
  });

  it("selects exact occupant-turn and round-end triggers", () => {
    const alliedField = placeTowZoneV2(emptyState(), placement({
      definitionId: "artificer-reinforced-field",
      instanceId: "field",
      ownerActorId: "artificer",
      side: "player",
      index: 2,
      rank: 2,
      resolvedPotency: 91,
    })).state;
    expect(collectTowZoneTicksV2(alliedField, {
      timing: "turn-start",
      occupants: [occupant({ actorId: "knight", actorSide: "player", side: "player", index: 2 })],
    }).ticks[0]).toMatchObject({
      actorId: "knight",
      payload: { amount: 91, recipient: "allied-occupants" },
    });
    expect(collectTowZoneTicksV2(alliedField, {
      timing: "turn-end",
      occupants: [occupant({ actorId: "knight", actorSide: "player", side: "player", index: 2 })],
    }).ticks).toEqual([]);

    const storm = placeTowZoneV2(emptyState(), placement({
      definitionId: "wizard-flame-storm",
      instanceId: "storm",
      ownerActorId: "wizard",
      side: "enemy",
      index: 7,
      rank: 1,
      resolvedPotency: 33,
    })).state;
    const round = collectTowZoneTicksV2(storm, {
      timing: "round-end",
      occupants: [occupant({ index: 7 })],
    });
    expect(round.ticks[0]).toMatchObject({
      definitionId: "wizard-flame-storm",
      payload: { amount: 33, subject: "burn" },
    });
  });

  it("applies block-exit only to eligible occupants and reports boundary provenance", () => {
    const placed = placeTowZoneV2(emptyState(), placement()).state;
    const hostile = zoneMovementBlockersV2(placed, {
      actorId: "enemy-a",
      actorSide: "enemy",
      from: { side: "enemy", index: 4 },
      to: { side: "enemy", index: 5 },
    });
    expect(hostile.detail).toMatchObject({ blocked: true, blockExit: true, blockEntry: false });
    expect(hostile.detail.blockers).toEqual([expect.objectContaining({
      definitionId: "ranger-snare",
      boundary: "exit",
    })]);

    const allied = zoneMovementBlockersV2(placed, {
      actorId: "ranger",
      actorSide: "player",
      from: { side: "player", index: 4 },
      to: { side: "player", index: 5 },
    });
    expect(allied.detail.blocked).toBe(false);
  });

  it("supports exact entry and both-boundary policies in a custom registry", () => {
    const registry = customRegistry("replace", {
      movementPolicy: "block-both",
      recipient: "all-occupants",
    });
    const atOrigin = placeTowZoneV2(emptyState(), customPlacement("replace"), {
      registry,
    }).state;
    expect(zoneMovementBlockersV2(atOrigin, {
      actorId: "enemy-a",
      actorSide: "enemy",
      from: { side: "enemy", index: 4 },
      to: { side: "enemy", index: 5 },
    }, { registry }).detail).toMatchObject({ blockExit: true, blockEntry: false });

    const atDestination = placeTowZoneV2(emptyState(), customPlacement("replace", {
      index: 5,
    }), { registry }).state;
    expect(zoneMovementBlockersV2(atDestination, {
      actorId: "enemy-a",
      actorSide: "enemy",
      from: { side: "enemy", index: 4 },
      to: { side: "enemy", index: 5 },
    }, { registry }).detail).toMatchObject({ blockExit: false, blockEntry: true });
  });

  it("ticks before decrementing round lifetime and then removes exact expiries", () => {
    let state = placeTowZoneV2(emptyState(), placement({
      definitionId: "wizard-flame-storm",
      instanceId: "expires",
      ownerActorId: "wizard",
      index: 0,
      resolvedPotency: 12,
      rounds: 1,
    })).state;
    state = placeTowZoneV2(state, placement({
      definitionId: "automaton-scorched-earth",
      instanceId: "survives",
      ownerActorId: "automaton",
      index: 1,
      rank: 1,
      resolvedPotency: 3,
      rounds: 2,
      sequence: 11,
    })).state;

    const ended = endTowZoneRoundV2(state, {
      occupants: [occupant({ index: 0 }), occupant({ actorId: "enemy-b", index: 1 })],
    });
    expect(ended.ticks).toHaveLength(2);
    expect(ended.state.zones).toEqual([expect.objectContaining({
      instanceId: "survives",
      roundsRemaining: 1,
    })]);
    expect(ended.events).toEqual([expect.objectContaining({
      type: "zone-expired",
      instanceId: "expires",
    })]);
  });

  it("rejects imprecise trigger and cross-side movement queries", () => {
    const state = emptyState();
    expect(collectTowZoneTicksV2(state, {
      timing: "after-enter",
      occupants: [],
    })).toMatchObject({ ok: false, reason: "invalid-zone-trigger-v2" });
    expect(zoneMovementBlockersV2(state, {
      actorId: "enemy-a",
      actorSide: "enemy",
      from: { side: "enemy", index: 4 },
      to: { side: "player", index: 4 },
    })).toMatchObject({ ok: false, reason: "invalid-zone-movement-query-v2" });
    expect(placeTowZoneV2(state, placement(), { inferredFromV1: true })).toMatchObject({
      ok: false,
      reason: "invalid-zone-options-v2",
    });
  });
});
