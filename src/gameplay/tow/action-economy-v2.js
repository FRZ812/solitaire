// Pure action-economy authority for the opt-in solitaire-tow-v2 ruleset.
//
// This module deliberately does not register a runtime or call the v1 reducer. It owns only
// the deterministic resources around an authored v2 action: one main, one quick, and one
// reaction preparation per actor priority; Resolve payment; owner-clock cooldowns; and the
// lifetime of a pre-armed reaction. Spatial legality and effect execution belong to the v2
// combat reducer that consumes the resolved `action` returned by successful transitions.

import {
  ABILITY_V2_REACTION_WINDOWS,
  TOW_ABILITY_RULESET_V2_ID,
  TOW_ABILITY_RULES_V2_VERSION,
  abilityRulesV2AtRank,
} from "./ability-rules-v2.js";
import { getTowAbilityRulesV2 } from "./ability-catalog-v2.js";

export const TOW_ACTION_ECONOMY_PHASES_V2 = Object.freeze([
  "between-rounds",
  "round",
  "actor-turn",
]);

export const TOW_ACTION_BUDGET_BASE_V2 = Object.freeze({
  main: 1,
  quick: 1,
  reaction: 1,
});

// Tempo effects may add actions, but the cap is intentionally finite so stacked support
// cannot create an unbounded turn. Reaction remains capped at one because an actor can own
// only one prepared reaction at a time; positive reaction deltas are refused so a spent or
// fizzled preparation cannot be restored during the same priority.
export const TOW_ACTION_BUDGET_CAP_V2 = Object.freeze({
  main: 3,
  quick: 3,
  reaction: 1,
});

// The scheduler must adjudicate control/status effects before it calls `beginTowActorTurnV2`.
// Once called, this order is fixed: expire the old preparation, tick every owner-clock
// cooldown, refresh the three independent budgets, apply supplied scheduler modifiers, then
// expose the main-action window.
// Quick actions consume only quick budget. Preparing a reaction spends Resolve, reaction
// budget, and cooldown immediately; firing or fizzing never pays or refunds it. There can be
// at most one prepared reaction per actor, and no legacy action-consumption or skill
// legality inference participates in any decision in this module.
export const TOW_ACTION_ECONOMY_POLICY_V2 = deepFreeze({
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

const STATE_KEYS = Object.freeze([
  "activeActorId",
  "actors",
  "phase",
  "round",
  "rulesetId",
  "turn",
  "version",
].sort());
const ACTOR_KEYS = Object.freeze([
  "abilityRanks",
  "armedReaction",
  "budgets",
  "cooldowns",
  "id",
  "maxResolve",
  "resolve",
].sort());
const BUDGET_KEYS = Object.freeze(["main", "quick", "reaction"].sort());
const ARMED_REACTION_KEYS = Object.freeze([
  "abilityId",
  "armedRound",
  "armedTurn",
  "rank",
  "reactionWatch",
  "reactionWindow",
  "watchedActorId",
].sort());
const CREATE_KEYS = Object.freeze(["actors"]);
const CREATE_ACTOR_KEYS = Object.freeze([
  "abilities",
  "id",
  "maxResolve",
  "resolve",
].sort());
const CREATE_ABILITY_KEYS = Object.freeze(["id", "rank"].sort());
const ACTOR_INPUT_KEYS = Object.freeze(["actorId"]);
const ACTOR_WITH_BUDGET_DELTAS_INPUT_KEYS = Object.freeze(["actorId", "budgetDeltas"].sort());
const ACTION_INPUT_KEYS = Object.freeze(["abilityId", "actorId"].sort());
const EXPIRE_REACTION_INPUT_KEYS = Object.freeze(["abilityId", "actorId", "cause"].sort());
const ARM_INPUT_KEYS = Object.freeze(["abilityId", "actorId", "watchedActorId"].sort());
const TRIGGER_INPUT_KEYS = Object.freeze([
  "abilityId",
  "actorId",
  "hostileSourceId",
  "hostileTargetIds",
  "window",
].sort());
const RESOLVE_DELTA_INPUT_KEYS = Object.freeze(["actorId", "delta"].sort());
const BUDGET_DELTA_INPUT_KEYS = Object.freeze(["actorId", "cause", "delta", "lane"].sort());
const PRESERVE_ARMED_REACTION = Symbol("preserve-armed-reaction-v2");

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === expected.length
    && keys.every((key, index) => key === expected[index]);
}

function identifier(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 128
    && /^[a-z0-9][a-z0-9-]*$/.test(value);
}

function actorIdentifier(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 256;
}

function uniqueActorIds(values) {
  return Array.isArray(values)
    && values.every(actorIdentifier)
    && new Set(values).size === values.length;
}

function objectKeysAreCanonical(value) {
  const keys = Object.keys(value);
  // Object enumeration always lifts array-index-like keys ahead of string keys. Rebuild the
  // lexically sorted set through the same ECMAScript operation so numeric participant ids
  // still have one portable canonical representation.
  const canonical = Object.keys(Object.fromEntries(
    [...keys].sort(compareIdentifiers).map((key) => [key, true]),
  ));
  return keys.every((key, index) => key === canonical[index]);
}

function compareIdentifiers(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function clampedIntegerDelta(current, delta, cap) {
  return delta >= 0
    ? (delta >= cap - current ? cap : current + delta)
    : (-delta >= current ? 0 : current + delta);
}

function cloneArmedReaction(value) {
  return value === null ? null : { ...value };
}

function cloneActor(value) {
  return {
    id: value.id,
    resolve: value.resolve,
    maxResolve: value.maxResolve,
    abilityRanks: { ...value.abilityRanks },
    budgets: { ...value.budgets },
    cooldowns: { ...value.cooldowns },
    armedReaction: cloneArmedReaction(value.armedReaction),
  };
}

function cloneState(value) {
  return {
    version: value.version,
    rulesetId: value.rulesetId,
    round: value.round,
    turn: value.turn,
    phase: value.phase,
    activeActorId: value.activeActorId,
    actors: Object.fromEntries(
      Object.entries(value.actors).map(([id, actor]) => [id, cloneActor(actor)]),
    ),
  };
}

function immutableState(value) {
  // A shallowly frozen foreign object is not sufficient authority. Always clone and freeze
  // the full validated graph so every returned state has the same immutability guarantee.
  return deepFreeze(cloneState(value));
}

function result(ok, reason, state, action = null, detail = null) {
  return deepFreeze({ ok, reason, state, action, detail });
}

function failure(reason, state = null) {
  return result(false, reason, state, null, null);
}

function success(state, action = null, detail = null) {
  return result(true, null, state, action, detail);
}

function replaceActor(state, actorId, actor, overrides = {}) {
  const actors = Object.fromEntries(
    Object.entries(state.actors).map(([id, current]) => [
      id,
      id === actorId ? actor : cloneActor(current),
    ]),
  );
  return deepFreeze({
    ...cloneState(state),
    ...overrides,
    actors,
  });
}

function stateReason(value) {
  if (!exactKeys(value, STATE_KEYS)) return "invalid-action-economy-v2-shape";
  if (value.version !== TOW_ABILITY_RULES_V2_VERSION) {
    return "invalid-action-economy-v2-version";
  }
  if (value.rulesetId !== TOW_ABILITY_RULESET_V2_ID) {
    return "invalid-action-economy-v2-ruleset";
  }
  if (!Number.isSafeInteger(value.round) || value.round < 0) {
    return "invalid-action-economy-v2-round";
  }
  if (!Number.isSafeInteger(value.turn) || value.turn < 0) {
    return "invalid-action-economy-v2-turn";
  }
  if (!TOW_ACTION_ECONOMY_PHASES_V2.includes(value.phase)) {
    return "invalid-action-economy-v2-phase";
  }
  if (!value.actors || typeof value.actors !== "object" || Array.isArray(value.actors)) {
    return "invalid-action-economy-v2-actors";
  }
  const actorIds = Object.keys(value.actors);
  if (actorIds.length === 0 || !objectKeysAreCanonical(value.actors)) {
    return "invalid-action-economy-v2-actors";
  }

  for (const actorId of actorIds) {
    const actor = value.actors[actorId];
    if (!actorIdentifier(actorId) || !exactKeys(actor, ACTOR_KEYS) || actor.id !== actorId) {
      return "invalid-action-economy-v2-actor";
    }
    if (!Number.isSafeInteger(actor.maxResolve) || actor.maxResolve < 0
      || !Number.isSafeInteger(actor.resolve) || actor.resolve < 0
      || actor.resolve > actor.maxResolve) {
      return "invalid-action-economy-v2-resolve";
    }
    if (!actor.abilityRanks || typeof actor.abilityRanks !== "object"
      || Array.isArray(actor.abilityRanks)
      || Object.keys(actor.abilityRanks).length === 0
      || !objectKeysAreCanonical(actor.abilityRanks)) {
      return "invalid-action-economy-v2-abilities";
    }
    for (const [abilityId, rank] of Object.entries(actor.abilityRanks)) {
      const definition = getTowAbilityRulesV2(abilityId);
      if (!definition || !Number.isSafeInteger(rank) || rank < 1 || rank > definition.rankCount) {
        return "invalid-action-economy-v2-ability-rank";
      }
    }
    if (!exactKeys(actor.budgets, BUDGET_KEYS)
      || BUDGET_KEYS.some((lane) => !Number.isSafeInteger(actor.budgets[lane])
        || actor.budgets[lane] < 0
        || actor.budgets[lane] > TOW_ACTION_BUDGET_CAP_V2[lane])) {
      return "invalid-action-economy-v2-budgets";
    }
    if (!actor.cooldowns || typeof actor.cooldowns !== "object"
      || Array.isArray(actor.cooldowns)
      || !objectKeysAreCanonical(actor.cooldowns)) {
      return "invalid-action-economy-v2-cooldowns";
    }
    for (const [abilityId, count] of Object.entries(actor.cooldowns)) {
      if (!Object.hasOwn(actor.abilityRanks, abilityId)) {
        return "invalid-action-economy-v2-cooldowns";
      }
      const action = abilityRulesV2AtRank(
        getTowAbilityRulesV2(abilityId),
        actor.abilityRanks[abilityId],
      ).action;
      if (!Number.isSafeInteger(count) || count < 1
        || count > action.cooldown) {
        return "invalid-action-economy-v2-cooldowns";
      }
    }
    if (actor.armedReaction !== null) {
      const arm = actor.armedReaction;
      if (!exactKeys(arm, ARMED_REACTION_KEYS)
        || !Object.hasOwn(actor.abilityRanks, arm.abilityId)
        || arm.rank !== actor.abilityRanks[arm.abilityId]
        || !actorIdentifier(arm.watchedActorId)
        || !Object.hasOwn(value.actors, arm.watchedActorId)
        || !Number.isSafeInteger(arm.armedRound) || arm.armedRound < 1
        || !Number.isSafeInteger(arm.armedTurn) || arm.armedTurn < 1
        || arm.armedRound > value.round || arm.armedTurn > value.turn) {
        return "invalid-action-economy-v2-reaction-arm";
      }
      const action = abilityRulesV2AtRank(
        getTowAbilityRulesV2(arm.abilityId),
        arm.rank,
      ).action;
      if (action.lane !== "reaction"
        || action.reactionWindow !== arm.reactionWindow
        || action.reactionWatch !== arm.reactionWatch
        || (action.cooldown > 0 && actor.cooldowns[arm.abilityId] !== action.cooldown)
        || (action.cooldown === 0 && Object.hasOwn(actor.cooldowns, arm.abilityId))
        || actor.budgets.reaction !== 0) {
        return "invalid-action-economy-v2-reaction-arm";
      }
    }
  }

  if (value.phase === "actor-turn") {
    if (!actorIdentifier(value.activeActorId) || !Object.hasOwn(value.actors, value.activeActorId)
      || value.round < 1 || value.turn < 1) {
      return "invalid-action-economy-v2-active-actor";
    }
  } else if (value.activeActorId !== null) {
    return "invalid-action-economy-v2-active-actor";
  }
  if (value.phase !== "between-rounds" && value.round < 1) {
    return "invalid-action-economy-v2-round";
  }
  for (const [actorId, actor] of Object.entries(value.actors)) {
    if (actorId !== value.activeActorId
      && BUDGET_KEYS.some((lane) => actor.budgets[lane] !== 0)) {
      return "invalid-action-economy-v2-inactive-budget";
    }
  }
  return null;
}

function canonicalStateOrFailure(state) {
  const validation = validateTowActionEconomyV2(state);
  return validation.ok
    ? { ok: true, state: immutableState(state) }
    : { ok: false, result: failure(validation.reason) };
}

function actionAccess(state, input, expectedLane = null) {
  if (!exactKeys(input, ACTION_INPUT_KEYS)
    || !actorIdentifier(input.actorId) || !identifier(input.abilityId)) {
    return { ok: false, reason: "invalid-action-economy-v2-action-input" };
  }
  if (state.phase !== "actor-turn" || state.activeActorId !== input.actorId) {
    return { ok: false, reason: "actor-does-not-have-priority-v2" };
  }
  const actor = state.actors[input.actorId];
  if (!Object.hasOwn(actor.abilityRanks, input.abilityId)) {
    return { ok: false, reason: "ability-not-equipped-v2" };
  }
  const action = abilityRulesV2AtRank(
    getTowAbilityRulesV2(input.abilityId),
    actor.abilityRanks[input.abilityId],
  );
  if (expectedLane !== null && action.action.lane !== expectedLane) {
    return { ok: false, reason: expectedLane === "reaction"
      ? "ability-is-not-reaction-v2"
      : "reaction-must-be-armed-v2" };
  }
  if (expectedLane === null && action.action.lane === "reaction") {
    return { ok: false, reason: "reaction-must-be-armed-v2" };
  }
  if (actor.budgets[action.action.lane] < 1) {
    return { ok: false, reason: "action-lane-spent-v2" };
  }
  if ((actor.cooldowns[input.abilityId] ?? 0) > 0) {
    return { ok: false, reason: "ability-on-cooldown-v2" };
  }
  if (actor.resolve < action.action.resolveCost) {
    return { ok: false, reason: "insufficient-resolve-v2" };
  }
  return { ok: true, actor, action };
}

function payForAction(
  state,
  actorId,
  action,
  armedReaction = PRESERVE_ARMED_REACTION,
) {
  const actor = state.actors[actorId];
  const cooldowns = { ...actor.cooldowns };
  if (action.action.cooldown > 0) cooldowns[action.id] = action.action.cooldown;
  const nextActor = {
    ...cloneActor(actor),
    resolve: actor.resolve - action.action.resolveCost,
    budgets: {
      ...actor.budgets,
      [action.action.lane]: actor.budgets[action.action.lane] - 1,
    },
    cooldowns: Object.fromEntries(Object.entries(cooldowns).sort(([a], [b]) => compareIdentifiers(a, b))),
    armedReaction: armedReaction === PRESERVE_ARMED_REACTION
      ? cloneArmedReaction(actor.armedReaction)
      : armedReaction,
  };
  return replaceActor(state, actorId, nextActor);
}

export function validateTowActionEconomyV2(value) {
  const reason = stateReason(value);
  return Object.freeze({ ok: reason === null, reason });
}

export function isTowActionEconomyV2(value) {
  return validateTowActionEconomyV2(value).ok;
}

export function createTowActionEconomyV2(input) {
  if (!exactKeys(input, CREATE_KEYS) || !Array.isArray(input.actors) || input.actors.length === 0) {
    return failure("invalid-action-economy-v2-create-input");
  }
  const actors = [];
  for (const value of input.actors) {
    if (!exactKeys(value, CREATE_ACTOR_KEYS)
      || !actorIdentifier(value.id)
      || !Number.isSafeInteger(value.maxResolve) || value.maxResolve < 0
      || !Number.isSafeInteger(value.resolve) || value.resolve < 0
      || value.resolve > value.maxResolve
      || !Array.isArray(value.abilities) || value.abilities.length === 0) {
      return failure("invalid-action-economy-v2-create-actor");
    }
    const abilityRanks = [];
    for (const ability of value.abilities) {
      if (!exactKeys(ability, CREATE_ABILITY_KEYS)
        || !identifier(ability.id)
        || !Number.isSafeInteger(ability.rank)) {
        return failure("invalid-action-economy-v2-create-ability");
      }
      const definition = getTowAbilityRulesV2(ability.id);
      if (!definition || ability.rank < 1 || ability.rank > definition.rankCount) {
        return failure("invalid-action-economy-v2-create-ability");
      }
      abilityRanks.push([ability.id, ability.rank]);
    }
    if (new Set(abilityRanks.map(([id]) => id)).size !== abilityRanks.length) {
      return failure("duplicate-action-economy-v2-ability");
    }
    actors.push([value.id, {
      id: value.id,
      resolve: value.resolve,
      maxResolve: value.maxResolve,
      abilityRanks: Object.fromEntries(abilityRanks.sort(([a], [b]) => compareIdentifiers(a, b))),
      budgets: { main: 0, quick: 0, reaction: 0 },
      cooldowns: {},
      armedReaction: null,
    }]);
  }
  if (new Set(actors.map(([id]) => id)).size !== actors.length) {
    return failure("duplicate-action-economy-v2-actor");
  }
  const state = deepFreeze({
    version: TOW_ABILITY_RULES_V2_VERSION,
    rulesetId: TOW_ABILITY_RULESET_V2_ID,
    round: 0,
    turn: 0,
    phase: "between-rounds",
    activeActorId: null,
    actors: Object.fromEntries(actors.sort(([a], [b]) => compareIdentifiers(a, b))),
  });
  const validation = validateTowActionEconomyV2(state);
  return validation.ok ? success(state) : failure(validation.reason);
}

export function beginTowActionRoundV2(state) {
  const checked = canonicalStateOrFailure(state);
  if (!checked.ok) return checked.result;
  const current = checked.state;
  if (current.phase !== "between-rounds") {
    return failure("round-already-open-v2", current);
  }
  return success(deepFreeze({
    ...cloneState(current),
    round: current.round + 1,
    phase: "round",
  }));
}

export function endTowActionRoundV2(state) {
  const checked = canonicalStateOrFailure(state);
  if (!checked.ok) return checked.result;
  const current = checked.state;
  if (current.phase !== "round") return failure("round-not-ready-to-close-v2", current);
  return success(deepFreeze({
    ...cloneState(current),
    phase: "between-rounds",
  }));
}

export function beginTowActorTurnV2(state, input) {
  const checked = canonicalStateOrFailure(state);
  if (!checked.ok) return checked.result;
  const current = checked.state;
  const hasBaseInput = exactKeys(input, ACTOR_INPUT_KEYS);
  const hasBudgetDeltas = exactKeys(input, ACTOR_WITH_BUDGET_DELTAS_INPUT_KEYS);
  if ((!hasBaseInput && !hasBudgetDeltas)
    || !actorIdentifier(input.actorId)
    || (hasBudgetDeltas && (!exactKeys(input.budgetDeltas, BUDGET_KEYS)
      || BUDGET_KEYS.some((lane) => !Number.isSafeInteger(input.budgetDeltas[lane]))))) {
    return failure("invalid-action-economy-v2-actor-input", current);
  }
  if (current.phase !== "round") return failure("actor-turn-not-ready-v2", current);
  if (!Object.hasOwn(current.actors, input.actorId)) {
    return failure("unknown-action-economy-v2-actor", current);
  }
  const actor = current.actors[input.actorId];
  const cooldowns = Object.fromEntries(
    Object.entries(actor.cooldowns)
      .map(([id, count]) => [id, count - 1])
      .filter(([, count]) => count > 0),
  );
  const expiredReaction = cloneArmedReaction(actor.armedReaction);
  const budgetDeltas = hasBudgetDeltas
    ? input.budgetDeltas
    : { main: 0, quick: 0, reaction: 0 };
  const budgets = Object.fromEntries(BUDGET_KEYS.map((lane) => [
    lane,
    clampedIntegerDelta(
      TOW_ACTION_BUDGET_BASE_V2[lane],
      budgetDeltas[lane],
      TOW_ACTION_BUDGET_CAP_V2[lane],
    ),
  ]));
  const nextActor = {
    ...cloneActor(actor),
    budgets,
    cooldowns,
    armedReaction: null,
  };
  const next = replaceActor(current, input.actorId, nextActor, {
    phase: "actor-turn",
    activeActorId: input.actorId,
    turn: current.turn + 1,
  });
  return success(next, null, {
    type: "owner-priority-opened",
    budgetDeltas: { ...budgetDeltas },
    budgets: { ...budgets },
    expiredReaction,
  });
}

export function endTowActorTurnV2(state, input) {
  const checked = canonicalStateOrFailure(state);
  if (!checked.ok) return checked.result;
  const current = checked.state;
  if (!exactKeys(input, ACTOR_INPUT_KEYS) || !actorIdentifier(input.actorId)) {
    return failure("invalid-action-economy-v2-actor-input", current);
  }
  if (current.phase !== "actor-turn" || current.activeActorId !== input.actorId) {
    return failure("actor-does-not-have-priority-v2", current);
  }
  const actor = current.actors[input.actorId];
  const nextActor = {
    ...cloneActor(actor),
    budgets: { main: 0, quick: 0, reaction: 0 },
  };
  return success(replaceActor(current, input.actorId, nextActor, {
    phase: "round",
    activeActorId: null,
  }));
}

export function canUseTowAbilityV2(state, input) {
  const checked = canonicalStateOrFailure(state);
  if (!checked.ok) return checked.result;
  const access = actionAccess(checked.state, input);
  return access.ok
    ? success(checked.state, access.action)
    : failure(access.reason, checked.state);
}

export function commitTowAbilityActionV2(state, input) {
  const checked = canonicalStateOrFailure(state);
  if (!checked.ok) return checked.result;
  const current = checked.state;
  const access = actionAccess(current, input);
  if (!access.ok) return failure(access.reason, current);
  return success(payForAction(current, input.actorId, access.action), access.action, {
    type: "action-committed",
    actorId: input.actorId,
    abilityId: input.abilityId,
    lane: access.action.action.lane,
    resolveSpent: access.action.action.resolveCost,
    cooldownApplied: access.action.action.cooldown,
  });
}

export function armTowReactionV2(state, input) {
  const checked = canonicalStateOrFailure(state);
  if (!checked.ok) return checked.result;
  const current = checked.state;
  if (!exactKeys(input, ARM_INPUT_KEYS)
    || !actorIdentifier(input.actorId)
    || !identifier(input.abilityId)
    || !actorIdentifier(input.watchedActorId)) {
    return failure("invalid-action-economy-v2-reaction-input", current);
  }
  if (!Object.hasOwn(current.actors, input.watchedActorId)) {
    return failure("unknown-reaction-watch-actor-v2", current);
  }
  if (current.phase === "actor-turn"
    && current.activeActorId === input.actorId
    && current.actors[input.actorId].armedReaction !== null) {
    return failure("reaction-already-armed-v2", current);
  }
  const access = actionAccess(current, {
    actorId: input.actorId,
    abilityId: input.abilityId,
  }, "reaction");
  if (!access.ok) return failure(access.reason, current);
  const arm = deepFreeze({
    abilityId: access.action.id,
    rank: access.action.rank,
    reactionWindow: access.action.action.reactionWindow,
    reactionWatch: access.action.action.reactionWatch,
    watchedActorId: input.watchedActorId,
    armedRound: current.round,
    armedTurn: current.turn,
  });
  return success(payForAction(current, input.actorId, access.action, arm), access.action, {
    type: "reaction-armed",
    reaction: arm,
    resolveSpent: access.action.action.resolveCost,
    cooldownApplied: access.action.action.cooldown,
  });
}

export function triggerTowReactionV2(state, input) {
  const checked = canonicalStateOrFailure(state);
  if (!checked.ok) return checked.result;
  const current = checked.state;
  if (!exactKeys(input, TRIGGER_INPUT_KEYS)
    || !actorIdentifier(input.actorId)
    || !identifier(input.abilityId)
    || !actorIdentifier(input.hostileSourceId)
    || !uniqueActorIds(input.hostileTargetIds)
    || !ABILITY_V2_REACTION_WINDOWS.includes(input.window)) {
    return failure("invalid-action-economy-v2-trigger-input", current);
  }
  if (current.phase !== "actor-turn"
    || current.activeActorId !== input.hostileSourceId
    || input.hostileSourceId === input.actorId
    || !Object.hasOwn(current.actors, input.actorId)
    || !Object.hasOwn(current.actors, input.hostileSourceId)
    || input.hostileTargetIds.some((id) => !Object.hasOwn(current.actors, id))) {
    return failure("invalid-hostile-action-window-v2", current);
  }
  const actor = current.actors[input.actorId];
  const arm = actor.armedReaction;
  if (arm === null || arm.abilityId !== input.abilityId) {
    return failure("reaction-not-armed-v2", current);
  }
  if (arm.reactionWindow !== input.window) {
    return failure("reaction-window-mismatch-v2", current);
  }
  const watched = arm.reactionWatch === "selected-hostile-source"
    ? input.hostileSourceId === arm.watchedActorId
    : input.hostileTargetIds.includes(arm.watchedActorId);
  if (!watched) return failure("reaction-watch-mismatch-v2", current);
  const action = abilityRulesV2AtRank(
    getTowAbilityRulesV2(arm.abilityId),
    arm.rank,
  );
  const nextActor = { ...cloneActor(actor), armedReaction: null };
  return success(replaceActor(current, input.actorId, nextActor), action, {
    type: "reaction-triggered",
    reaction: cloneArmedReaction(arm),
    hostileSourceId: input.hostileSourceId,
    hostileTargetIds: [...input.hostileTargetIds],
  });
}

export function expireTowReactionV2(state, input) {
  const checked = canonicalStateOrFailure(state);
  if (!checked.ok) return checked.result;
  const current = checked.state;
  if (!exactKeys(input, EXPIRE_REACTION_INPUT_KEYS)
    || !actorIdentifier(input.actorId)
    || !identifier(input.abilityId)
    || !identifier(input.cause)) {
    return failure("invalid-action-economy-v2-reaction-expiry", current);
  }
  if (!Object.hasOwn(current.actors, input.actorId)) {
    return failure("unknown-action-economy-v2-actor", current);
  }
  const actor = current.actors[input.actorId];
  if (actor.armedReaction === null || actor.armedReaction.abilityId !== input.abilityId) {
    return failure("reaction-not-armed-v2", current);
  }
  const expired = cloneArmedReaction(actor.armedReaction);
  return success(
    replaceActor(current, input.actorId, { ...cloneActor(actor), armedReaction: null }),
    null,
    { type: "reaction-fizzled", cause: input.cause, reaction: expired },
  );
}

export function applyTowResolveDeltaV2(state, input) {
  const checked = canonicalStateOrFailure(state);
  if (!checked.ok) return checked.result;
  const current = checked.state;
  if (!exactKeys(input, RESOLVE_DELTA_INPUT_KEYS)
    || !actorIdentifier(input.actorId)
    || !Number.isSafeInteger(input.delta)) {
    return failure("invalid-action-economy-v2-resolve-delta", current);
  }
  if (!Object.hasOwn(current.actors, input.actorId)) {
    return failure("unknown-action-economy-v2-actor", current);
  }
  const actor = current.actors[input.actorId];
  const resolve = input.delta >= 0
    ? (input.delta >= actor.maxResolve - actor.resolve
      ? actor.maxResolve
      : actor.resolve + input.delta)
    : (-input.delta >= actor.resolve ? 0 : actor.resolve + input.delta);
  return success(
    replaceActor(current, input.actorId, { ...cloneActor(actor), resolve }),
    null,
    {
      type: "resolve-changed",
      actorId: input.actorId,
      requestedDelta: input.delta,
      appliedDelta: resolve - actor.resolve,
    },
  );
}

// Scheduler/status-resolver hook for tempo effects during an already-open owner priority.
// The required cause id keeps replay/event attribution explicit; canonical clamping makes
// main/quick support bonuses and all lane penalties deterministic. Reaction preparation is
// once-per-priority, so this hook can suppress but never replenish its budget.
export function applyTowActionBudgetDeltaV2(state, input) {
  const checked = canonicalStateOrFailure(state);
  if (!checked.ok) return checked.result;
  const current = checked.state;
  if (!exactKeys(input, BUDGET_DELTA_INPUT_KEYS)
    || !actorIdentifier(input.actorId)
    || !identifier(input.cause)
    || !BUDGET_KEYS.includes(input.lane)
    || !Number.isSafeInteger(input.delta)) {
    return failure("invalid-action-economy-v2-budget-delta", current);
  }
  if (current.phase !== "actor-turn" || current.activeActorId !== input.actorId) {
    return failure("actor-does-not-have-priority-v2", current);
  }
  const actor = current.actors[input.actorId];
  if (input.lane === "reaction" && input.delta > 0) {
    return failure("reaction-budget-not-grantable-v2", current);
  }
  const before = actor.budgets[input.lane];
  const after = clampedIntegerDelta(before, input.delta, TOW_ACTION_BUDGET_CAP_V2[input.lane]);
  return success(
    replaceActor(current, input.actorId, {
      ...cloneActor(actor),
      budgets: { ...actor.budgets, [input.lane]: after },
    }),
    null,
    {
      type: "action-budget-changed",
      actorId: input.actorId,
      lane: input.lane,
      cause: input.cause,
      requestedDelta: input.delta,
      appliedDelta: after - before,
    },
  );
}
