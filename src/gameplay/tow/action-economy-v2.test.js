import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  TOW_ACTION_BUDGET_BASE_V2,
  TOW_ACTION_BUDGET_CAP_V2,
  TOW_ACTION_ECONOMY_POLICY_V2,
  applyTowActionBudgetDeltaV2,
  applyTowResolveDeltaV2,
  armTowReactionV2,
  beginTowActionRoundV2,
  beginTowActorTurnV2,
  canUseTowAbilityV2,
  commitTowAbilityActionV2,
  createTowActionEconomyV2,
  endTowActionRoundV2,
  endTowActorTurnV2,
  expireTowReactionV2,
  isTowActionEconomyV2,
  triggerTowReactionV2,
  validateTowActionEconomyV2,
} from "./action-economy-v2.js";
import {
  TOW_ABILITY_RULESET_V2_ID,
  TOW_ABILITY_RULES_V2_VERSION,
} from "./ability-rules-v2.js";

function actor(id, overrides = {}) {
  return {
    id,
    resolve: 5,
    maxResolve: 9,
    abilities: [
      { id: "arctic-strike", rank: 1 },
      { id: "arctic-block", rank: 1 },
      { id: "arctic-threatening-cry", rank: 1 },
      { id: "arctic-battle-cry", rank: 1 },
    ],
    ...overrides,
  };
}

function create(overrides = {}) {
  const opened = createTowActionEconomyV2({
    actors: [
      actor("knight"),
      actor("paladin", {
        abilities: [
          { id: "priestess-crush", rank: 1 },
          { id: "priestess-block", rank: 1 },
        ],
      }),
      actor("raider", {
        abilities: [{ id: "north-king-cleave", rank: 1 }],
      }),
    ],
    ...overrides,
  });
  if (!opened.ok) throw new Error(opened.reason);
  return opened.state;
}

function openRound(state = create()) {
  const result = beginTowActionRoundV2(state);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

function openTurn(state, actorId) {
  const result = beginTowActorTurnV2(state, { actorId });
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

function closeTurn(state, actorId) {
  const result = endTowActorTurnV2(state, { actorId });
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

function assertDeeplyFrozen(value, visited = new Set()) {
  if (!value || typeof value !== "object" || visited.has(value)) return;
  visited.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) assertDeeplyFrozen(child, visited);
}

describe("v2 action economy state", () => {
  it("stays additive and imports no legacy session, skill, or runtime authority", () => {
    const source = readFileSync(new URL("./action-economy-v2.js", import.meta.url), "utf8");
    expect(source).not.toMatch(
      /from "\.\/(?:ability-profile|commands|encounter|runtime|session|skills)\.js"/,
    );
  });

  it("creates a canonical immutable ruleset-pinned state", () => {
    const state = create({ actors: [actor("zeta"), actor("alpha")] });

    expect(state).toMatchObject({
      version: TOW_ABILITY_RULES_V2_VERSION,
      rulesetId: TOW_ABILITY_RULESET_V2_ID,
      round: 0,
      turn: 0,
      phase: "between-rounds",
      activeActorId: null,
    });
    expect(Object.keys(state.actors)).toEqual(["alpha", "zeta"]);
    expect(Object.keys(state.actors.alpha.abilityRanks)).toEqual([
      "arctic-battle-cry",
      "arctic-block",
      "arctic-strike",
      "arctic-threatening-cry",
    ]);
    expect(isTowActionEconomyV2(state)).toBe(true);
    expect(validateTowActionEconomyV2(state)).toEqual({ ok: true, reason: null });
    assertDeeplyFrozen(state);
    expect(TOW_ACTION_ECONOMY_POLICY_V2).toEqual({
      ownerPriorityOrder: [
        "expire-prepared-reaction",
        "tick-owner-cooldowns",
        "refresh-lane-budgets",
        "apply-scheduler-budget-deltas",
        "open-main-action-window",
      ],
      cooldownClock: "later-owner-main-window-open",
      cooldownLegalAt: 0,
      reactionCommit: "prepare",
      reactionRefund: "never",
      preparedReactionLimitPerActor: 1,
      reactionBudgetBonuses: false,
      baseBudgets: TOW_ACTION_BUDGET_BASE_V2,
      budgetCaps: TOW_ACTION_BUDGET_CAP_V2,
      quickConsumesMainBudget: false,
      controlAdjudication: "scheduler-before-owner-priority",
      turnOrderAuthority: "encounter-scheduler",
      skippedPriorityTicksCooldowns: false,
      skippedPriorityExpiresReaction: false,
      targetLockAtomicity: "composite-reducer",
    });
    assertDeeplyFrozen(TOW_ACTION_ECONOMY_POLICY_V2);
  });

  it("fails closed for malformed creation data and duplicate identities", () => {
    const duplicateActor = createTowActionEconomyV2({
      actors: [actor("knight"), actor("knight")],
    });
    const duplicateAbility = createTowActionEconomyV2({
      actors: [actor("knight", {
        abilities: [
          { id: "arctic-strike", rank: 1 },
          { id: "arctic-strike", rank: 2 },
        ],
      })],
    });
    const unknownAbility = createTowActionEconomyV2({
      actors: [actor("knight", { abilities: [{ id: "legacy-strike", rank: 1 }] })],
    });
    const extraField = createTowActionEconomyV2({
      actors: [{ ...actor("knight"), level: 99 }],
    });

    expect(duplicateActor).toMatchObject({
      ok: false,
      reason: "duplicate-action-economy-v2-actor",
      state: null,
    });
    expect(duplicateAbility.reason).toBe("duplicate-action-economy-v2-ability");
    expect(unknownAbility.reason).toBe("invalid-action-economy-v2-create-ability");
    expect(extraField.reason).toBe("invalid-action-economy-v2-create-actor");
    assertDeeplyFrozen(duplicateActor);
  });

  it("opens explicit round and actor boundaries with per-actor lane budgets", () => {
    const created = create();
    const round = beginTowActionRoundV2(created);
    const turn = beginTowActorTurnV2(round.state, { actorId: "knight" });

    expect(round.state).not.toBe(created);
    expect(created.round).toBe(0);
    expect(round.state).toMatchObject({ round: 1, phase: "round", turn: 0 });
    expect(turn.state).toMatchObject({
      round: 1,
      phase: "actor-turn",
      activeActorId: "knight",
      turn: 1,
    });
    expect(turn.state.actors.knight.budgets).toEqual(TOW_ACTION_BUDGET_BASE_V2);
    expect(turn.state.actors.paladin.budgets).toEqual({ main: 0, quick: 0, reaction: 0 });
    expect(beginTowActionRoundV2(round.state)).toMatchObject({
      ok: false,
      reason: "round-already-open-v2",
      state: round.state,
    });
    expect(endTowActionRoundV2(turn.state)).toMatchObject({
      ok: false,
      reason: "round-not-ready-to-close-v2",
      state: turn.state,
    });
    assertDeeplyFrozen(turn);
  });

  it("applies scheduler tempo modifiers atomically before owner priority opens", () => {
    const round = openRound();
    const opened = beginTowActorTurnV2(round, {
      actorId: "knight",
      budgetDeltas: { main: 1, quick: 99, reaction: -99 },
    });

    expect(opened).toMatchObject({
      ok: true,
      state: {
        phase: "actor-turn",
        actors: { knight: { budgets: { main: 2, quick: 3, reaction: 0 } } },
      },
      detail: {
        type: "owner-priority-opened",
        budgetDeltas: { main: 1, quick: 99, reaction: -99 },
        expiredReaction: null,
      },
    });
    expect(round.phase).toBe("round");
    assertDeeplyFrozen(opened);
  });

  it("spends main and quick budgets independently and pays exact ranked Resolve", () => {
    const turn = openTurn(openRound(), "knight");
    const quick = commitTowAbilityActionV2(turn, {
      actorId: "knight",
      abilityId: "arctic-threatening-cry",
    });
    const secondQuick = commitTowAbilityActionV2(quick.state, {
      actorId: "knight",
      abilityId: "arctic-battle-cry",
    });
    const main = commitTowAbilityActionV2(quick.state, {
      actorId: "knight",
      abilityId: "arctic-strike",
    });

    expect(quick).toMatchObject({
      ok: true,
      action: { id: "arctic-threatening-cry", action: { lane: "quick", resolveCost: 1 } },
      detail: { resolveSpent: 1, cooldownApplied: 1 },
    });
    expect(quick.state.actors.knight).toMatchObject({
      resolve: 4,
      budgets: { main: 1, quick: 0, reaction: 1 },
      cooldowns: { "arctic-threatening-cry": 1 },
    });
    expect(secondQuick).toMatchObject({
      ok: false,
      reason: "action-lane-spent-v2",
      state: quick.state,
    });
    expect(main.state.actors.knight).toMatchObject({
      resolve: 4,
      budgets: { main: 0, quick: 0, reaction: 1 },
    });
    expect(turn.actors.knight).toMatchObject({
      resolve: 5,
      budgets: { main: 1, quick: 1, reaction: 1 },
      cooldowns: {},
    });
    assertDeeplyFrozen(main);
  });

  it("refuses unaffordable actions without spending or mutating state", () => {
    const state = openTurn(openRound(create({
      actors: [actor("knight", { resolve: 1 })],
    })), "knight");
    const before = JSON.stringify(state);
    const result = commitTowAbilityActionV2(state, {
      actorId: "knight",
      abilityId: "arctic-battle-cry",
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "insufficient-resolve-v2",
      state,
    });
    expect(JSON.stringify(state)).toBe(before);
    expect(state.actors.knight.budgets.quick).toBe(1);
    expect(state.actors.knight.resolve).toBe(1);
  });

  it("resolves cost from the equipped rank rather than rank one or a legacy profile", () => {
    let state = create({
      actors: [actor("rogue", {
        resolve: 0,
        abilities: [{ id: "assassin-cold-blood", rank: 2 }],
      })],
    });
    state = openTurn(openRound(state), "rogue");
    const committed = commitTowAbilityActionV2(state, {
      actorId: "rogue",
      abilityId: "assassin-cold-blood",
    });

    expect(committed).toMatchObject({
      ok: true,
      action: { id: "assassin-cold-blood", rank: 2, action: { resolveCost: 0 } },
      detail: { resolveSpent: 0 },
    });
    expect(committed.state.actors.rogue.resolve).toBe(0);
    expect(committed.state.actors.rogue.budgets.quick).toBe(0);
  });

  it("lets a typed tempo resolver grant a bounded extra action during priority", () => {
    let state = openTurn(openRound(), "knight");
    state = commitTowAbilityActionV2(state, {
      actorId: "knight",
      abilityId: "arctic-strike",
    }).state;
    expect(state.actors.knight.budgets.main).toBe(0);

    const granted = applyTowActionBudgetDeltaV2(state, {
      actorId: "knight",
      lane: "main",
      delta: 1,
      cause: "haste",
    });
    expect(granted).toMatchObject({
      ok: true,
      state: { actors: { knight: { budgets: { main: 1 } } } },
      detail: {
        type: "action-budget-changed",
        cause: "haste",
        requestedDelta: 1,
        appliedDelta: 1,
      },
    });
    expect(commitTowAbilityActionV2(granted.state, {
      actorId: "knight",
      abilityId: "arctic-strike",
    })).toMatchObject({ ok: true, state: { actors: { knight: { budgets: { main: 0 } } } } });

    const capped = applyTowActionBudgetDeltaV2(openTurn(openRound(create()), "knight"), {
      actorId: "knight",
      lane: "quick",
      delta: Number.MAX_SAFE_INTEGER,
      cause: "haste",
    });
    expect(capped.state.actors.knight.budgets.quick).toBe(TOW_ACTION_BUDGET_CAP_V2.quick);
  });

  it("ticks cooldowns only when the owner's later main-action window opens", () => {
    let state = openTurn(openRound(), "knight");
    state = commitTowAbilityActionV2(state, {
      actorId: "knight",
      abilityId: "arctic-threatening-cry",
    }).state;
    state = closeTurn(state, "knight");

    state = openTurn(state, "raider");
    expect(state.actors.knight.cooldowns).toEqual({ "arctic-threatening-cry": 1 });
    state = closeTurn(state, "raider");
    state = endTowActionRoundV2(state).state;
    expect(state.actors.knight.cooldowns).toEqual({ "arctic-threatening-cry": 1 });
    state = beginTowActionRoundV2(state).state;
    expect(state.actors.knight.cooldowns).toEqual({ "arctic-threatening-cry": 1 });

    state = openTurn(state, "knight");
    expect(state.actors.knight.cooldowns).toEqual({});
    expect(canUseTowAbilityV2(state, {
      actorId: "knight",
      abilityId: "arctic-threatening-cry",
    })).toMatchObject({ ok: true });
  });

  it("writes the exact ranked cooldown and decrements it once per later owner window", () => {
    let state = create({
      actors: [actor("automaton", {
        resolve: 9,
        abilities: [
          { id: "automaton-bombardment", rank: 1 },
          { id: "automaton-chain-cannon", rank: 4 },
        ],
      })],
    });
    state = openTurn(openRound(state), "automaton");
    const committed = commitTowAbilityActionV2(state, {
      actorId: "automaton",
      abilityId: "automaton-chain-cannon",
    });
    expect(committed).toMatchObject({
      ok: true,
      action: { rank: 4 },
      detail: { cooldownApplied: 5, resolveSpent: 3 },
    });
    expect(committed.state.actors.automaton.cooldowns).toEqual({
      "automaton-chain-cannon": 5,
    });
    state = closeTurn(committed.state, "automaton");

    for (const expected of [4, 3, 2, 1, 0]) {
      state = endTowActionRoundV2(state).state;
      state = beginTowActionRoundV2(state).state;
      state = openTurn(state, "automaton");
      expect(state.actors.automaton.cooldowns["automaton-chain-cannon"] ?? 0)
        .toBe(expected);
      expect(canUseTowAbilityV2(state, {
        actorId: "automaton",
        abilityId: "automaton-chain-cannon",
      }).reason).toBe(expected === 0 ? null : "ability-on-cooldown-v2");
      state = closeTurn(state, "automaton");
    }
  });

  it("closes a turn by forfeiting unused budgets without cancelling an armed reaction", () => {
    let state = openTurn(openRound(), "knight");
    state = armTowReactionV2(state, {
      actorId: "knight",
      abilityId: "arctic-block",
      watchedActorId: "paladin",
    }).state;
    state = closeTurn(state, "knight");

    expect(state).toMatchObject({ phase: "round", activeActorId: null });
    expect(state.actors.knight.budgets).toEqual({ main: 0, quick: 0, reaction: 0 });
    expect(state.actors.knight.armedReaction).toMatchObject({
      abilityId: "arctic-block",
      watchedActorId: "paladin",
    });
  });
});

describe("v2 pre-armed reactions", () => {
  it("pays and applies cooldown at arm time, then consumes only on an exact hostile window", () => {
    let state = openTurn(openRound(), "knight");
    const armed = armTowReactionV2(state, {
      actorId: "knight",
      abilityId: "arctic-block",
      watchedActorId: "paladin",
    });
    state = closeTurn(armed.state, "knight");
    state = openTurn(state, "raider");

    const wrongWindow = triggerTowReactionV2(state, {
      actorId: "knight",
      abilityId: "arctic-block",
      hostileSourceId: "raider",
      hostileTargetIds: ["paladin"],
      window: "hostile-targeted-after-effects",
    });
    const wrongTarget = triggerTowReactionV2(state, {
      actorId: "knight",
      abilityId: "arctic-block",
      hostileSourceId: "raider",
      hostileTargetIds: ["knight"],
      window: "hostile-targeted-before-effects",
    });
    const triggered = triggerTowReactionV2(state, {
      actorId: "knight",
      abilityId: "arctic-block",
      hostileSourceId: "raider",
      hostileTargetIds: ["paladin"],
      window: "hostile-targeted-before-effects",
    });

    expect(armed).toMatchObject({
      ok: true,
      action: { id: "arctic-block", action: { lane: "reaction", resolveCost: 1 } },
      detail: { type: "reaction-armed", resolveSpent: 1, cooldownApplied: 0 },
    });
    expect(armed.state.actors.knight).toMatchObject({
      resolve: 4,
      budgets: { reaction: 0 },
      armedReaction: { watchedActorId: "paladin" },
    });
    expect(applyTowActionBudgetDeltaV2(armed.state, {
      actorId: "knight",
      lane: "reaction",
      delta: 1,
      cause: "haste",
    })).toMatchObject({
      ok: false,
      reason: "reaction-budget-not-grantable-v2",
      state: armed.state,
    });
    expect(wrongWindow).toMatchObject({
      ok: false,
      reason: "reaction-window-mismatch-v2",
      state,
    });
    expect(wrongTarget).toMatchObject({
      ok: false,
      reason: "reaction-watch-mismatch-v2",
      state,
    });
    expect(triggered).toMatchObject({
      ok: true,
      action: { id: "arctic-block" },
      detail: { type: "reaction-triggered", hostileSourceId: "raider" },
    });
    expect(triggered.state.actors.knight.armedReaction).toBeNull();
    expect(triggerTowReactionV2(triggered.state, {
      actorId: "knight",
      abilityId: "arctic-block",
      hostileSourceId: "raider",
      hostileTargetIds: ["paladin"],
      window: "hostile-targeted-before-effects",
    }).reason).toBe("reaction-not-armed-v2");
    assertDeeplyFrozen(triggered);
  });

  it("preserves a prepared reaction while independent quick and main lanes commit", () => {
    let state = openTurn(openRound(), "knight");
    state = armTowReactionV2(state, {
      actorId: "knight",
      abilityId: "arctic-block",
      watchedActorId: "paladin",
    }).state;
    state = commitTowAbilityActionV2(state, {
      actorId: "knight",
      abilityId: "arctic-threatening-cry",
    }).state;
    expect(state.actors.knight.armedReaction).toMatchObject({
      abilityId: "arctic-block",
      watchedActorId: "paladin",
    });
    state = commitTowAbilityActionV2(state, {
      actorId: "knight",
      abilityId: "arctic-strike",
    }).state;
    expect(state.actors.knight.armedReaction).toMatchObject({ abilityId: "arctic-block" });

    state = closeTurn(state, "knight");
    state = openTurn(state, "raider");
    const triggered = triggerTowReactionV2(state, {
      actorId: "knight",
      abilityId: "arctic-block",
      hostileSourceId: "raider",
      hostileTargetIds: ["paladin"],
      window: "hostile-targeted-before-effects",
    });
    expect(triggered).toMatchObject({ ok: true, action: { id: "arctic-block" } });
    expect(triggered.state.actors.knight.armedReaction).toBeNull();
  });

  it("never restores spent reaction budget during the same owner priority", () => {
    let state = openTurn(openRound(), "knight");
    state = armTowReactionV2(state, {
      actorId: "knight",
      abilityId: "arctic-block",
      watchedActorId: "paladin",
    }).state;
    state = expireTowReactionV2(state, {
      actorId: "knight",
      abilityId: "arctic-block",
      cause: "target-lock-fizzled",
    }).state;
    expect(state.actors.knight).toMatchObject({
      budgets: { reaction: 0 },
      armedReaction: null,
    });
    expect(applyTowActionBudgetDeltaV2(state, {
      actorId: "knight",
      lane: "reaction",
      delta: 1,
      cause: "haste",
    })).toMatchObject({
      ok: false,
      reason: "reaction-budget-not-grantable-v2",
      state,
    });
  });

  it("preserves arms over round boundaries and expires them only at owner priority", () => {
    let state = openTurn(openRound(), "knight");
    state = armTowReactionV2(state, {
      actorId: "knight",
      abilityId: "arctic-block",
      watchedActorId: "paladin",
    }).state;
    state = closeTurn(state, "knight");
    state = endTowActionRoundV2(state).state;
    expect(state.actors.knight.armedReaction).not.toBeNull();
    state = beginTowActionRoundV2(state).state;
    expect(state.actors.knight.armedReaction).not.toBeNull();

    const opened = beginTowActorTurnV2(state, { actorId: "knight" });
    expect(opened).toMatchObject({
      ok: true,
      detail: {
        type: "owner-priority-opened",
        expiredReaction: { abilityId: "arctic-block", watchedActorId: "paladin" },
      },
    });
    expect(opened.state.actors.knight).toMatchObject({
      resolve: 4,
      budgets: TOW_ACTION_BUDGET_BASE_V2,
      armedReaction: null,
    });
  });

  it("supports an explicit no-refund fizzle when a watched actor becomes unavailable", () => {
    let state = openTurn(openRound(), "knight");
    state = armTowReactionV2(state, {
      actorId: "knight",
      abilityId: "arctic-block",
      watchedActorId: "paladin",
    }).state;
    const expired = expireTowReactionV2(state, {
      actorId: "knight",
      abilityId: "arctic-block",
      cause: "watched-actor-unavailable",
    });

    expect(expired).toMatchObject({
      ok: true,
      detail: {
        type: "reaction-fizzled",
        cause: "watched-actor-unavailable",
        reaction: { abilityId: "arctic-block" },
      },
    });
    expect(expired.state.actors.knight).toMatchObject({
      resolve: 4,
      budgets: { reaction: 0 },
      armedReaction: null,
    });
  });

  it("rejects replacing a prepared reaction and supports source-watched windows", () => {
    let state = create({
      actors: [
        actor("artificer", {
          abilities: [
            { id: "clocktower-fire", rank: 1 },
            { id: "clocktower-suppressive-shot", rank: 1 },
          ],
        }),
        actor("raider", { abilities: [{ id: "north-king-cleave", rank: 1 }] }),
      ],
    });
    state = openTurn(openRound(state), "artificer");
    const armed = armTowReactionV2(state, {
      actorId: "artificer",
      abilityId: "clocktower-suppressive-shot",
      watchedActorId: "raider",
    });
    expect(armTowReactionV2(armed.state, {
      actorId: "artificer",
      abilityId: "clocktower-suppressive-shot",
      watchedActorId: "raider",
    })).toMatchObject({
      ok: false,
      reason: "reaction-already-armed-v2",
      state: armed.state,
    });

    state = closeTurn(armed.state, "artificer");
    state = openTurn(state, "raider");
    const triggered = triggerTowReactionV2(state, {
      actorId: "artificer",
      abilityId: "clocktower-suppressive-shot",
      hostileSourceId: "raider",
      hostileTargetIds: ["artificer"],
      window: "hostile-main-before-effects",
    });
    expect(triggered).toMatchObject({
      ok: true,
      action: {
        id: "clocktower-suppressive-shot",
        action: { reactionWatch: "selected-hostile-source" },
      },
    });
  });

  it("uses the same owner clock for reaction cooldowns", () => {
    let state = create({
      actors: [
        actor("sorcerer", {
          abilities: [
            { id: "sleepless-hard-scales", rank: 1 },
            { id: "sleepless-swing", rank: 1 },
          ],
        }),
        actor("raider", { abilities: [{ id: "north-king-cleave", rank: 1 }] }),
      ],
    });
    state = openTurn(openRound(state), "sorcerer");
    state = armTowReactionV2(state, {
      actorId: "sorcerer",
      abilityId: "sleepless-hard-scales",
      watchedActorId: "sorcerer",
    }).state;
    expect(state.actors.sorcerer.cooldowns).toEqual({ "sleepless-hard-scales": 1 });
    state = closeTurn(state, "sorcerer");
    state = openTurn(state, "raider");
    state = triggerTowReactionV2(state, {
      actorId: "sorcerer",
      abilityId: "sleepless-hard-scales",
      hostileSourceId: "raider",
      hostileTargetIds: ["sorcerer"],
      window: "hostile-targeted-before-effects",
    }).state;
    state = closeTurn(state, "raider");
    state = endTowActionRoundV2(state).state;
    state = beginTowActionRoundV2(state).state;
    state = openTurn(state, "sorcerer");

    expect(state.actors.sorcerer.cooldowns).toEqual({});
    expect(armTowReactionV2(state, {
      actorId: "sorcerer",
      abilityId: "sleepless-hard-scales",
      watchedActorId: "sorcerer",
    })).toMatchObject({ ok: true });
  });
});

describe("v2 resource and validation boundaries", () => {
  it("applies effect-driven Resolve deltas with deterministic zero/max clamping", () => {
    const state = create();
    const gained = applyTowResolveDeltaV2(state, { actorId: "knight", delta: 99 });
    const drained = applyTowResolveDeltaV2(gained.state, { actorId: "knight", delta: -99 });

    expect(gained.state.actors.knight.resolve).toBe(9);
    expect(gained.detail).toEqual({
      type: "resolve-changed",
      actorId: "knight",
      requestedDelta: 99,
      appliedDelta: 4,
    });
    expect(drained.state.actors.knight.resolve).toBe(0);
    expect(drained.detail.appliedDelta).toBe(-9);
    expect(state.actors.knight.resolve).toBe(5);
    assertDeeplyFrozen(drained);
  });

  it("rejects wrong priority, reaction misuse, unknown actors, and extra input fields", () => {
    const state = openTurn(openRound(), "knight");

    expect(commitTowAbilityActionV2(state, {
      actorId: "paladin",
      abilityId: "priestess-crush",
    }).reason).toBe("actor-does-not-have-priority-v2");
    expect(commitTowAbilityActionV2(state, {
      actorId: "knight",
      abilityId: "arctic-block",
    }).reason).toBe("reaction-must-be-armed-v2");
    expect(armTowReactionV2(state, {
      actorId: "knight",
      abilityId: "arctic-strike",
      watchedActorId: "raider",
    }).reason).toBe("ability-is-not-reaction-v2");
    expect(beginTowActorTurnV2(state, { actorId: "knight", force: true })).toMatchObject({
      ok: false,
      reason: "invalid-action-economy-v2-actor-input",
      state,
    });
    expect(applyTowResolveDeltaV2(state, {
      actorId: "missing",
      delta: 1,
    }).reason).toBe("unknown-action-economy-v2-actor");
  });

  it("fails closed on tampered state rather than normalizing an invalid authority", () => {
    const valid = create();
    const tampered = JSON.parse(JSON.stringify(valid));
    tampered.actors.knight.resolve = 100;
    tampered.actors.knight.budgets.main = 1;

    expect(validateTowActionEconomyV2(tampered)).toEqual({
      ok: false,
      reason: "invalid-action-economy-v2-resolve",
    });
    const result = beginTowActionRoundV2(tampered);
    expect(result).toMatchObject({
      ok: false,
      reason: "invalid-action-economy-v2-resolve",
      state: null,
      action: null,
    });
    assertDeeplyFrozen(result);
  });

  it("rejects cooldown counters that exceed the equipped rank's authored value", () => {
    const valid = create();
    const tampered = JSON.parse(JSON.stringify(valid));
    tampered.actors.knight.cooldowns["arctic-threatening-cry"] = 2;

    expect(validateTowActionEconomyV2(tampered)).toEqual({
      ok: false,
      reason: "invalid-action-economy-v2-cooldowns",
    });
    expect(beginTowActionRoundV2(tampered)).toMatchObject({
      ok: false,
      reason: "invalid-action-economy-v2-cooldowns",
      state: null,
    });

    const unknown = JSON.parse(JSON.stringify(valid));
    unknown.actors.knight.cooldowns["legacy-strike"] = 1;
    expect(() => validateTowActionEconomyV2(unknown)).not.toThrow();
    expect(validateTowActionEconomyV2(unknown).reason)
      .toBe("invalid-action-economy-v2-cooldowns");
  });
});
