import { describe, expect, it } from "vitest";
import { abilityRulesV2AtRank } from "./ability-rules-v2.js";
import { getTowAbilityRulesV2 } from "./ability-catalog-v2.js";
import {
  TOW_TARGET_COMMIT_V2_VERSION,
  commitAbilityTargetsV2,
  isAbilityTargetLockV2,
  legalAbilityAnchorsV2,
  lockAbilityTargetV2,
} from "./targeting-v2.js";

function formation(entries = {}) {
  return Array.from({ length: 9 }, (_, index) => entries[index] || null);
}

function actor(id, side, hp = 100) {
  return { id, side, hp, maxHp: 100 };
}

function battle({
  player = formation({ 8: "player", 7: "guard", 0: "scout" }),
  enemy = formation({ 0: "front", 4: "middle", 8: "rear" }),
  actors = null,
  version = 2,
} = {}) {
  return {
    actors: actors || {
      player: actor("player", "player"),
      guard: actor("guard", "player"),
      scout: actor("scout", "player"),
      front: actor("front", "enemy"),
      middle: actor("middle", "enemy"),
      rear: actor("rear", "enemy"),
    },
    formations: { version, player, enemy },
  };
}

function ability(id, rank = 1) {
  return abilityRulesV2AtRank(getTowAbilityRulesV2(id), rank);
}

function commitNow(state, resolvedAbility, casterId, anchor) {
  const declared = lockAbilityTargetV2(state, resolvedAbility, casterId, anchor);
  if (!declared.ok) return declared;
  return commitAbilityTargetsV2(state, resolvedAbility, declared.lock);
}

describe("v2 legal ability anchors", () => {
  it("uses the nearest living hostile rank for melee on either independently oriented side", () => {
    const state = battle();
    expect(legalAbilityAnchorsV2(state, ability("arctic-strike"), "player"))
      .toEqual([{
        tracking: "unit",
        side: "enemy",
        index: 0,
        actorId: "front",
      }]);

    const enemyCasterState = battle({
      player: formation({ 1: "scout", 4: "guard", 8: "player" }),
      enemy: formation({ 8: "front" }),
      actors: {
        player: actor("player", "player"),
        guard: actor("guard", "player"),
        scout: actor("scout", "player"),
        front: actor("front", "enemy"),
      },
    });
    expect(legalAbilityAnchorsV2(
      enemyCasterState,
      ability("arctic-strike"),
      "front",
    )).toEqual([{
      tracking: "unit",
      side: "player",
      index: 1,
      actorId: "scout",
    }]);
  });

  it("limits adjacent support to orthogonal allies and authored caster inclusion", () => {
    const state = battle({
      player: formation({ 4: "diagonal", 5: "guard", 7: "scout", 8: "player" }),
      actors: {
        player: actor("player", "player"),
        guard: actor("guard", "player"),
        scout: actor("scout", "player"),
        diagonal: actor("diagonal", "player"),
        front: actor("front", "enemy"),
      },
      enemy: formation({ 0: "front" }),
    });

    expect(legalAbilityAnchorsV2(state, ability("arctic-block"), "player"))
      .toEqual([
        { tracking: "unit", side: "player", index: 5, actorId: "guard" },
        { tracking: "unit", side: "player", index: 7, actorId: "scout" },
        { tracking: "unit", side: "player", index: 8, actorId: "player" },
      ]);
  });

  it("requires pure unit fields to reach someone but allows an empty zone footprint", () => {
    const state = battle({
      player: formation({ 8: "player" }),
      enemy: formation({ 0: "front" }),
      actors: {
        player: actor("player", "player"),
        front: actor("front", "enemy"),
      },
    });

    const pureField = legalAbilityAnchorsV2(state, ability("arctic-battle-cry"), "player");
    expect(pureField.map(({ index }) => index)).toEqual([6, 7, 8]);

    const zoneField = legalAbilityAnchorsV2(state, ability("demon-trackers-net"), "player");
    expect(zoneField.map(({ index }) => index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(zoneField[8]).toEqual({
      tracking: "cell",
      side: "enemy",
      index: 8,
      actorId: null,
    });
  });

  it("canonicalizes a global all-field to one centre anchor", () => {
    expect(legalAbilityAnchorsV2(
      battle(),
      ability("demon-arrow-rain"),
      "player",
    )).toEqual([{
      tracking: "cell",
      side: "enemy",
      index: 4,
      actorId: "middle",
    }]);
  });
});

describe("v2 target commitment", () => {
  it("commits a unit-tracked anchor at its current cell", () => {
    const state = battle({
      enemy: formation({ 4: "front", 8: "rear" }),
      actors: {
        player: actor("player", "player"),
        guard: actor("guard", "player"),
        scout: actor("scout", "player"),
        front: actor("front", "enemy"),
        rear: actor("rear", "enemy"),
      },
    });
    const original = structuredClone(state);

    const committed = commitNow(
      state,
      ability("arctic-strike", 3),
      "player",
      "front",
    );

    expect(committed).toMatchObject({
      ok: true,
      reason: null,
      version: TOW_TARGET_COMMIT_V2_VERSION,
      abilityId: "arctic-strike",
      rank: 3,
      casterId: "player",
      sourceCell: { side: "player", index: 8 },
      anchor: {
        tracking: "unit",
        side: "enemy",
        index: 4,
        actorId: "front",
      },
      selectedCells: [{ side: "enemy", index: 4 }],
      selectedUnits: [{ side: "enemy", index: 4, actorId: "front" }],
    });
    expect(Object.isFrozen(committed)).toBe(true);
    expect(Object.isFrozen(committed.selectedUnits)).toBe(true);
    expect(state).toEqual(original);
  });

  it("follows an adjacent protected ally after that unit moves out of declaration range", () => {
    const resolvedAbility = ability("arctic-block");
    const declaredState = battle({
      player: formation({ 1: "guard", 4: "player" }),
      enemy: formation({ 0: "front" }),
      actors: {
        player: actor("player", "player"),
        guard: actor("guard", "player"),
        front: actor("front", "enemy"),
      },
    });
    const declared = lockAbilityTargetV2(
      declaredState,
      resolvedAbility,
      "player",
      "guard",
    );
    expect(declared.ok).toBe(true);
    expect(isAbilityTargetLockV2(declared.lock)).toBe(true);
    expect(declared.lock.anchor).toEqual({
      tracking: "unit",
      side: "player",
      index: null,
      actorId: "guard",
    });

    const movedState = battle({
      player: formation({ 4: "player", 8: "guard" }),
      enemy: formation({ 0: "front" }),
      actors: declaredState.actors,
    });
    const committed = commitAbilityTargetsV2(movedState, resolvedAbility, declared.lock);

    expect(committed.ok).toBe(true);
    expect(committed.anchor).toEqual({
      tracking: "unit",
      side: "player",
      index: 8,
      actorId: "guard",
    });
    expect(committed.selectedUnits).toEqual([
      { side: "player", index: 8, actorId: "guard" },
    ]);
  });

  it("fizzles a missing unit lock without substituting the current cell occupant", () => {
    const declaredState = battle({
      enemy: formation({ 0: "departed" }),
      actors: {
        player: actor("player", "player"),
        guard: actor("guard", "player"),
        scout: actor("scout", "player"),
        departed: actor("departed", "enemy"),
      },
    });
    const resolvedAbility = ability("arctic-strike");
    const declared = lockAbilityTargetV2(
      declaredState,
      resolvedAbility,
      "player",
      "departed",
    );
    expect(declared.ok).toBe(true);

    const state = battle({
      enemy: formation({ 0: "replacement" }),
      actors: {
        player: actor("player", "player"),
        guard: actor("guard", "player"),
        scout: actor("scout", "player"),
        replacement: actor("replacement", "enemy"),
        departed: actor("departed", "enemy", 0),
      },
    });

    expect(commitAbilityTargetsV2(
      state,
      resolvedAbility,
      declared.lock,
    )).toEqual({ ok: false, reason: "lost-v2-unit-anchor" });
  });

  it("keeps a cell lock fixed and snapshots current occupants in row-major order", () => {
    const resolvedAbility = ability("demon-trackers-net");
    const declaredState = battle({
      enemy: formation({ 0: "departed" }),
      actors: {
        player: actor("player", "player"),
        guard: actor("guard", "player"),
        scout: actor("scout", "player"),
        departed: actor("departed", "enemy"),
      },
    });
    const declared = lockAbilityTargetV2(
      declaredState,
      resolvedAbility,
      "player",
      { side: "enemy", index: 0 },
    );
    expect(declared.ok).toBe(true);
    expect(declared.lock.anchor).toEqual({
      tracking: "cell",
      side: "enemy",
      index: 0,
      actorId: null,
    });

    const state = battle({
      enemy: formation({ 0: "replacement", 1: "second", 3: "third", 8: "departed" }),
      actors: {
        player: actor("player", "player"),
        guard: actor("guard", "player"),
        scout: actor("scout", "player"),
        replacement: actor("replacement", "enemy"),
        second: actor("second", "enemy"),
        third: actor("third", "enemy"),
        departed: actor("departed", "enemy"),
      },
    });

    const committed = commitAbilityTargetsV2(
      state,
      resolvedAbility,
      declared.lock,
    );
    expect(committed.anchor).toEqual({
      tracking: "cell",
      side: "enemy",
      index: 0,
      actorId: null,
    });
    expect(committed.selectedCells).toEqual([0, 1, 3].map((index) => ({
      side: "enemy",
      index,
    })));
    expect(committed.selectedUnits.map(({ actorId }) => actorId))
      .toEqual(["replacement", "second", "third"]);
  });

  it("does not auto-add a distant caster to an allied area", () => {
    const state = battle({
      player: formation({ 0: "scout", 8: "player" }),
      enemy: formation({ 0: "front" }),
      actors: {
        player: actor("player", "player"),
        scout: actor("scout", "player"),
        front: actor("front", "enemy"),
      },
    });
    const committed = commitNow(
      state,
      ability("arctic-battle-cry"),
      "player",
      { side: "player", index: 0 },
    );

    expect(committed.ok).toBe(true);
    expect(committed.selectedUnits).toEqual([
      { side: "player", index: 0, actorId: "scout" },
    ]);
  });

  it("commits an intentionally empty zone without inventing a unit target", () => {
    const state = battle({
      player: formation({ 8: "player" }),
      enemy: formation({ 0: "front" }),
      actors: {
        player: actor("player", "player"),
        front: actor("front", "enemy"),
      },
    });
    const committed = commitNow(
      state,
      ability("demon-trackers-net"),
      "player",
      { side: "enemy", index: 8 },
    );

    expect(committed.ok).toBe(true);
    expect(committed.selectedCells).toEqual([5, 7, 8].map((index) => ({
      side: "enemy",
      index,
    })));
    expect(committed.selectedUnits).toEqual([]);
  });

  it("requires an explicit, in-range, correctly sided anchor", () => {
    const state = battle();
    expect(lockAbilityTargetV2(state, ability("arctic-strike"), "player"))
      .toEqual({ ok: false, reason: "lost-v2-unit-anchor" });
    expect(lockAbilityTargetV2(
      state,
      ability("arctic-giants-smash"),
      "player",
      { side: "player", index: 0 },
    )).toEqual({ ok: false, reason: "invalid-v2-target" });
    expect(lockAbilityTargetV2(
      state,
      ability("arctic-strike"),
      "player",
      "rear",
    )).toEqual({ ok: false, reason: "invalid-v2-target" });
  });

  it("commits only a validated lock for the exact ability and rank", () => {
    const state = battle();
    const rankOne = ability("arctic-strike", 1);
    const declared = lockAbilityTargetV2(state, rankOne, "player", "front");
    expect(declared.ok).toBe(true);

    expect(commitAbilityTargetsV2(state, rankOne, "front"))
      .toEqual({ ok: false, reason: "invalid-v2-target-lock" });
    expect(commitAbilityTargetsV2(
      state,
      ability("arctic-strike", 2),
      declared.lock,
    )).toEqual({ ok: false, reason: "v2-target-lock-mismatch" });
  });

  it("fails closed on v1 formations and unresolved ability definitions", () => {
    const resolved = ability("arctic-strike");
    expect(() => legalAbilityAnchorsV2(battle({ version: 1 }), resolved, "player"))
      .toThrow("invalid-v2-target-state");
    expect(lockAbilityTargetV2(
      battle(),
      getTowAbilityRulesV2("arctic-strike"),
      "player",
      "front",
    )).toEqual({ ok: false, reason: "invalid-resolved-ability-v2" });
  });
});
