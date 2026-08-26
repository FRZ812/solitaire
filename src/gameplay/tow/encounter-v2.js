// Deterministic composite encounter reducer for solitaire-tow-v2.
//
// This module is the first authority allowed to compose the independent v2 geometry,
// economy, status, damage, movement, zone, and staged AI transitions. It still owns no
// session, persistence, animation, runtime registration, or legacy adapter.

import {
  applyTowActionBudgetDeltaV2,
  applyTowResolveDeltaV2,
  armTowReactionV2,
  beginTowActionRoundV2,
  beginTowActorTurnV2,
  canUseTowAbilityV2,
  commitTowAbilityActionV2,
  endTowActionRoundV2,
  endTowActorTurnV2,
  expireTowReactionV2,
  triggerTowReactionV2,
} from "./action-economy-v2.js";
import {
  TOW_ABILITY_RULESET_V2_ID,
  TOW_ABILITY_RULES_V2_VERSION,
  abilityRulesV2AtRank,
  zoneRulesV2AtRank,
} from "./ability-rules-v2.js";
import {
  TOW_ABILITY_ZONES_V2,
  getTowAbilityRulesV2,
  getTowStatusRulesV2,
} from "./ability-catalog-v2.js";
import {
  TOW_ACTOR_SCALAR_MAX_V2,
  defineTowActorV2,
} from "./actor-v2.js";
import {
  declareTowAiIntentV2,
  evaluateTowAiIntentV2,
  redeclareTowAiIntentV2,
} from "./ai-v2.js";
import {
  TOW_DAMAGE_MAX_V2,
  TOW_DAMAGE_POLICY_V2,
  resolveTowDamageV2,
} from "./damage-v2.js";
import {
  TOW_ENCOUNTER_EXECUTION_POLICY_V2,
  TOW_ENCOUNTER_SCHEDULER_V2_VERSION,
  defineTowEncounterStateV2,
  towEncounterRoundOrderV2,
  validateTowEncounterStateV2,
} from "./encounter-state-v2.js";
import {
  FORMATION_CELLS,
} from "./formation.js";
import {
  resolveTowMovementV2,
} from "./movement-v2.js";
import {
  adjudicateTowStatusActionV2,
  advanceTowStatusBoundaryV2,
  mutateTowStatusV2,
  resolveTowForcedTargetV2,
  resolveTowMovementAllowanceV2,
  towStatusCombatModifiersV2,
} from "./status-runtime-v2.js";
import {
  commitAbilityTargetsV2,
  legalAbilityAnchorsV2,
  lockAbilityTargetV2,
} from "./targeting-v2.js";
import {
  collectTowZoneTicksV2,
  endTowZoneRoundV2,
  placeTowZoneV2,
} from "./zones-v2.js";

export const TOW_ENCOUNTER_REDUCER_V2_VERSION = 1;
export const TOW_ENCOUNTER_COMMAND_TYPES_V2 = Object.freeze([
  "round-start",
  "actor-turn-start",
  "reaction-arm",
  "ability",
  "actor-turn-end",
  "round-end",
  "ai-step",
]);
export const TOW_ENCOUNTER_COMBAT_RESULTS_V2 = Object.freeze([
  "victory",
  "defeat",
  "draw",
]);
export const TOW_ENCOUNTER_REDUCER_POLICY_V2 = TOW_ENCOUNTER_EXECUTION_POLICY_V2;

if (TOW_ENCOUNTER_REDUCER_POLICY_V2.version !== TOW_ABILITY_RULES_V2_VERSION
  || TOW_ENCOUNTER_REDUCER_POLICY_V2.rulesetId !== TOW_ABILITY_RULESET_V2_ID
  || TOW_ENCOUNTER_REDUCER_POLICY_V2.reducerVersion
    !== TOW_ENCOUNTER_REDUCER_V2_VERSION) {
  throw new TypeError("tow-encounter-v2-reducer-policy-drift");
}

const ABILITY_INPUT_KEYS = Object.freeze([
  "abilityId",
  "actorId",
  "anchor",
  "randomDraws",
].sort());
const REACTION_ARM_INPUT_KEYS = Object.freeze([
  "abilityId",
  "actorId",
  "anchor",
].sort());
const ACTOR_INPUT_KEYS = Object.freeze(["actorId"]);
const NO_INPUT_KEYS = Object.freeze([]);
const AI_STEP_INPUT_KEYS = Object.freeze(["randomDraws"]);
export const MAX_TOW_AI_STEP_RANDOM_DRAWS_V2 = 8_192;
export const TOW_ENCOUNTER_AI_STEP_STAGES_V2 = Object.freeze([
  "round-started",
  "actor-turn-started",
  "round-ended",
  "intent-declared",
  "intent-invalidated",
  "action-executed",
  "actor-turn-ended",
]);
const COMMAND_KEYS = Object.freeze({
  "round-start": ["rulesetId", "type", "version"].sort(),
  "actor-turn-start": ["actorId", "rulesetId", "type", "version"].sort(),
  "reaction-arm": [
    "abilityId", "actorId", "anchor", "rulesetId", "type", "version",
  ].sort(),
  ability: [
    "abilityId",
    "actorId",
    "anchor",
    "randomDraws",
    "rulesetId",
    "type",
    "version",
  ].sort(),
  "actor-turn-end": ["actorId", "rulesetId", "type", "version"].sort(),
  "round-end": ["rulesetId", "type", "version"].sort(),
  "ai-step": ["randomDraws", "rulesetId", "type", "version"].sort(),
});
const SIDES = Object.freeze(["player", "enemy"]);
const UNIT_PRIMITIVES = new Set([
  "damage",
  "heal",
  "shield",
  "status",
  "cleanse",
  "resource",
  "move",
  "push",
  "pull",
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function cloneData(value) {
  if (Array.isArray(value)) return value.map(cloneData);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneData(child)]));
  }
  return value;
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === expected.length
    && keys.every((key, index) => key === expected[index]);
}

function compareIdentifiers(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function actorIdentifier(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 256;
}

function rulesIdentifier(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 128
    && /^[a-z0-9][a-z0-9-]*$/.test(value);
}

function commandAnchor(value) {
  if (actorIdentifier(value)) return true;
  if (Number.isSafeInteger(value) && FORMATION_CELLS.includes(value)) return true;
  if (exactKeys(value, ["actorId"])) return actorIdentifier(value.actorId);
  return exactKeys(value, ["index", "side"].sort())
    && SIDES.includes(value.side)
    && Number.isSafeInteger(value.index)
    && FORMATION_CELLS.includes(value.index);
}

function randomDrawVector(value, maximumLength = Number.MAX_SAFE_INTEGER) {
  return Array.isArray(value)
    && value.length <= maximumLength
    && Object.keys(value).length === value.length
    && value.every((draw) => (
      Number.isSafeInteger(draw) && draw >= 0 && draw < 10_000
    ));
}

function immutableState(value) {
  return defineTowEncounterStateV2(value);
}

function eventsV2(events) {
  return events.map((event, index) => {
    const payload = cloneData(event);
    delete payload.version;
    delete payload.rulesetId;
    delete payload.ordinal;
    return deepFreeze({
      version: TOW_ABILITY_RULES_V2_VERSION,
      rulesetId: TOW_ABILITY_RULESET_V2_ID,
      ordinal: index + 1,
      ...payload,
    });
  });
}

function result(ok, reason, state, events = [], transaction = null) {
  return deepFreeze({
    ok,
    reason,
    state,
    events: eventsV2(events),
    transaction: transaction === null ? null : {
      version: TOW_ABILITY_RULES_V2_VERSION,
      rulesetId: TOW_ABILITY_RULESET_V2_ID,
      ...cloneData(transaction),
    },
  });
}

function invalidState(reason) {
  return result(false, reason, null);
}

function failure(reason, state) {
  return result(false, reason, state);
}

function success(state, events, transaction) {
  return result(true, null, immutableState(state), events, transaction);
}

function checkedState(state) {
  const validation = validateTowEncounterStateV2(state);
  return validation.ok
    ? { ok: true, state: immutableState(state) }
    : { ok: false, result: invalidState(validation.reason) };
}

function actorCell(state, actorId) {
  for (const side of SIDES) {
    const index = state.formations[side].indexOf(actorId);
    if (index >= 0) return { side, index };
  }
  return null;
}

function unitSnapshot(state, actorId, fallback = null) {
  const cell = actorCell(state, actorId) ?? fallback;
  const actor = state.actors[actorId];
  return actor?.hp > 0 && cell
    ? { side: cell.side, index: cell.index, actorId }
    : null;
}

function livingSideUnits(state, side) {
  return FORMATION_CELLS.flatMap((index) => {
    const actorId = state.formations[side][index];
    const actor = actorId === null ? null : state.actors[actorId];
    return actor?.hp > 0 ? [{ side, index, actorId }] : [];
  });
}

function opposingSide(side) {
  return side === "player" ? "enemy" : "player";
}

function recipientSnapshot(state, ability, targetCommit, effect) {
  const caster = state.actors[targetCommit.casterId];
  if (effect.recipient === "caster") {
    const snapshot = unitSnapshot(state, caster.id, targetCommit.sourceCell);
    return snapshot ? [snapshot] : [];
  }
  if (effect.recipient === "selected-units") {
    return targetCommit.selectedUnits.map((entry) => ({ ...entry }));
  }
  if (effect.recipient === "selected-cells") {
    return targetCommit.selectedCells.map((entry) => ({ ...entry }));
  }
  if (effect.recipient === "all-allies") return livingSideUnits(state, caster.side);
  if (effect.recipient === "all-enemies") {
    return livingSideUnits(state, opposingSide(caster.side));
  }
  if (effect.recipient === "all-combatants") {
    return [
      ...livingSideUnits(state, caster.side),
      ...livingSideUnits(state, opposingSide(caster.side)),
    ];
  }
  throw new TypeError("unsupported-encounter-v2-recipient");
}

function clearDefeatedCells(state) {
  return {
    ...state,
    formations: {
      version: state.formations.version,
      player: state.formations.player.map((actorId) => (
        actorId !== null && state.actors[actorId].hp > 0 ? actorId : null
      )),
      enemy: state.formations.enemy.map((actorId) => (
        actorId !== null && state.actors[actorId].hp > 0 ? actorId : null
      )),
    },
  };
}

function replaceActor(state, actor) {
  return {
    ...state,
    actors: {
      ...state.actors,
      [actor.id]: cloneData(actor),
    },
  };
}

function replaceActors(state, actors) {
  let next = state;
  for (const actor of actors) {
    if (actor !== null) next = replaceActor(next, actor);
  }
  return clearDefeatedCells(next);
}

function replaceActorVitals(state, actorId, updates) {
  const actor = state.actors[actorId];
  return replaceActor(state, defineTowActorV2({
    ...cloneData(actor),
    ...updates,
  }));
}

function expireDefeatedReaction(state, actorId) {
  const armed = state.economy.actors[actorId].armedReaction;
  if (armed === null) return { ok: true, state, event: null };
  const receipt = state.reactionLocks[actorId];
  const expired = expireTowReactionV2(state.economy, {
    actorId,
    abilityId: armed.abilityId,
    cause: "actor-defeated",
  });
  if (!expired.ok) return { ok: false, reason: expired.reason };
  const reactionLocks = { ...state.reactionLocks };
  delete reactionLocks[actorId];
  return {
    ok: true,
    state: {
      ...state,
      economy: expired.state,
      reactionLocks,
    },
    event: {
      ...expired.detail,
      actorId,
      abilityId: armed.abilityId,
      armedSequence: receipt.armedSequence,
      targetLock: receipt.targetLock,
    },
  };
}

function combatResult(state) {
  const playerDefeated = state.rosters.player.every((id) => state.actors[id].hp <= 0);
  const enemyDefeated = state.rosters.enemy.every((id) => state.actors[id].hp <= 0);
  if (playerDefeated && enemyDefeated) return "draw";
  if (enemyDefeated) return "victory";
  if (playerDefeated) return "defeat";
  return null;
}

function scheduledProgress(state) {
  const skippedActorIds = [];
  let index = state.scheduler.cursor;
  while (index < state.scheduler.order.length
    && !liveRecipient(state, state.scheduler.order[index])) {
    skippedActorIds.push(state.scheduler.order[index]);
    index += 1;
  }
  return {
    index,
    skippedActorIds,
    nextActorId: state.scheduler.order[index] ?? null,
  };
}

function skippedScheduleEvents(actorIds) {
  return actorIds.map((actorId) => ({
    type: "actor-turn-skipped",
    actorId,
    reason: "defeated-before-priority",
  }));
}

function appendTerminalEvent(state, events) {
  const outcome = combatResult(state);
  if (outcome !== null) {
    events.push({
      type: "combat-ended",
      result: outcome,
      playerDefeated: outcome === "defeat" || outcome === "draw",
      enemyDefeated: outcome === "victory" || outcome === "draw",
    });
  }
  return outcome;
}

function statusAdjustedScalar(state, actorId, basis, includeModifiers = true) {
  const actor = state.actors[actorId];
  if (!actor) throw new TypeError("unknown-encounter-v2-scaling-actor");
  if (basis === "max-hp") return actor.maxHp;
  if (basis === "missing-hp") return actor.maxHp - actor.hp;
  const modifiers = includeModifiers
    ? towStatusCombatModifiersV2(state.statuses, actorId)
    : { attackDelta: 0, defenseDelta: 0 };
  if (basis === "attack") return Math.max(0, actor.stats.attack + modifiers.attackDelta);
  if (basis === "defense") return Math.max(0, actor.stats.defense + modifiers.defenseDelta);
  throw new TypeError("unsupported-encounter-v2-scale-basis");
}

function resolvedMagnitude(
  state,
  casterId,
  recipientId,
  value,
  scalesFrom,
  { excludeCasterAttackModifiers = false } = {},
) {
  if (value.unit !== "percent" || value.basis === "none") return value.amount;
  const scalingActorId = scalesFrom === "caster" ? casterId : recipientId;
  if (!actorIdentifier(scalingActorId)) {
    throw new TypeError("missing-encounter-v2-scaling-actor");
  }
  const includeModifiers = !(excludeCasterAttackModifiers
    && scalesFrom === "caster"
    && value.basis === "attack");
  const scalar = statusAdjustedScalar(
    state,
    scalingActorId,
    value.basis,
    includeModifiers,
  );
  const amount = Math.floor((scalar * value.amount) / 100);
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new TypeError("encounter-v2-scaled-value-overflow");
  }
  return amount;
}

function statusSourceActorId(statusId, sourceActorId, operation) {
  if (operation !== "add") return null;
  const definition = getTowStatusRulesV2(statusId);
  if (!definition) throw new TypeError("unknown-encounter-v2-status");
  return definition.provenance === "source-actor" ? sourceActorId : null;
}

function applyStatusMutation(state, {
  actorId,
  operation,
  sourceActorId,
  statusId,
  value,
}) {
  const mutation = mutateTowStatusV2(state.statuses, {
    actorId,
    operation,
    sourceActorId: statusSourceActorId(statusId, sourceActorId, operation),
    statusId,
    value,
  });
  return mutation.ok
    ? { ok: true, state: { ...state, statuses: mutation.state }, event: mutation.event }
    : { ok: false, reason: mutation.reason };
}

function applyHeal(state, actorId, amount) {
  const actor = state.actors[actorId];
  if (!actor || actor.hp <= 0) return null;
  const applied = Math.min(actor.maxHp - actor.hp, amount);
  return {
    state: replaceActorVitals(state, actorId, { hp: actor.hp + applied }),
    event: {
      type: "healing-resolved",
      actorId,
      requested: amount,
      applied,
      hpBefore: actor.hp,
      hpAfter: actor.hp + applied,
    },
  };
}

function applyShield(state, actorId, amount) {
  const actor = state.actors[actorId];
  if (!actor || actor.hp <= 0) return null;
  const shield = Math.min(TOW_ACTOR_SCALAR_MAX_V2, actor.shield + amount);
  return {
    state: replaceActorVitals(state, actorId, { shield }),
    event: {
      type: "shield-resolved",
      actorId,
      requested: amount,
      applied: shield - actor.shield,
      shieldBefore: actor.shield,
      shieldAfter: shield,
    },
  };
}

function damagePacket(state, {
  sourceActorId,
  targetActorId,
  amount,
  attackScaleBps,
  kind,
  randomDraws,
}) {
  const source = sourceActorId === null ? null : state.actors[sourceActorId];
  const target = state.actors[targetActorId];
  const resolved = resolveTowDamageV2({
    source,
    target,
    statuses: state.statuses,
    packet: { kind, amount, attackScaleBps },
    randomDraws,
  });
  if (!resolved.ok) return { ok: false, reason: resolved.reason };
  const targetWasLiving = target.hp > 0;
  const sourceWasLiving = source?.hp > 0;
  let next = {
    ...state,
    statuses: resolved.statuses,
  };
  next = replaceActors(next, [resolved.source, resolved.target]);
  const events = [{ type: "damage-resolved", ...cloneData(resolved.outcome) }];
  if (targetWasLiving && next.actors[targetActorId].hp <= 0) {
    events.push({ type: "unit-defeated", actorId: targetActorId, cause: kind });
    const expired = expireDefeatedReaction(next, targetActorId);
    if (!expired.ok) return expired;
    next = expired.state;
    if (expired.event) events.push(expired.event);
  }
  if (sourceActorId !== null
    && sourceWasLiving
    && next.actors[sourceActorId].hp <= 0) {
    events.push({ type: "unit-defeated", actorId: sourceActorId, cause: "reflection" });
    const expired = expireDefeatedReaction(next, sourceActorId);
    if (!expired.ok) return expired;
    next = expired.state;
    if (expired.event) events.push(expired.event);
  }
  return { ok: true, state: next, events };
}

function liveRecipient(state, actorId) {
  return Boolean(state.actors[actorId]?.hp > 0 && actorCell(state, actorId));
}

function skipEvent(effectIndex, recipientIndex, entry, reason) {
  return {
    type: "effect-recipient-skipped",
    effectIndex,
    recipientIndex,
    actorId: entry.actorId ?? null,
    side: entry.side,
    index: entry.index,
    reason,
  };
}

function nextZoneSequence(zones) {
  const maximum = zones.zones.reduce((value, zone) => (
    Math.max(value, zone.updatedSequence)
  ), 0);
  return Number.isSafeInteger(maximum + 1) ? maximum + 1 : null;
}

function zonePlacementPotency(state, casterId, definition) {
  const potency = definition.payload.potency;
  if (definition.payload.scalesFrom === "recipient") {
    throw new TypeError("unsupported-encounter-v2-recipient-scaled-zone");
  }
  return resolvedMagnitude(
    state,
    casterId,
    null,
    potency,
    definition.payload.scalesFrom,
  );
}

function occupantForActor(state, actorId) {
  const actor = state.actors[actorId];
  const cell = actor?.hp > 0 ? actorCell(state, actorId) : null;
  return cell ? {
    actorId,
    actorSide: actor.side,
    side: cell.side,
    index: cell.index,
  } : null;
}

function allLivingOccupants(state) {
  return SIDES.flatMap((side) => FORMATION_CELLS.flatMap((index) => {
    const actorId = state.formations[side][index];
    const actor = actorId === null ? null : state.actors[actorId];
    return actor?.hp > 0 ? [{ actorId, actorSide: side, side, index }] : [];
  }));
}

function applyZoneTick(state, tick, context) {
  const events = [{
    type: "zone-ticked",
    timing: tick.timing,
    instanceId: tick.instanceId,
    definitionId: tick.definitionId,
    ownerActorId: tick.ownerActorId,
    actorId: tick.actorId,
    side: tick.side,
    index: tick.index,
    primitive: tick.payload.primitive,
  }];
  if (!liveRecipient(state, tick.actorId)) {
    events.push({
      type: "zone-recipient-skipped",
      instanceId: tick.instanceId,
      actorId: tick.actorId,
      reason: "recipient-not-living-and-fielded",
    });
    return { ok: true, state, events };
  }
  const amount = tick.payload.amount;
  if (tick.payload.primitive === "damage") {
    const damage = damagePacket(state, {
      sourceActorId: null,
      targetActorId: tick.actorId,
      amount: Math.min(TOW_DAMAGE_MAX_V2, amount),
      attackScaleBps: 0,
      kind: "periodic",
      randomDraws: [],
    });
    return damage.ok
      ? { ok: true, state: damage.state, events: [...events, ...damage.events] }
      : damage;
  }
  if (tick.payload.primitive === "heal") {
    const healed = applyHeal(state, tick.actorId, amount);
    return { ok: true, state: healed.state, events: [...events, healed.event] };
  }
  if (tick.payload.primitive === "shield") {
    const shielded = applyShield(state, tick.actorId, amount);
    return { ok: true, state: shielded.state, events: [...events, shielded.event] };
  }
  if (["status", "cleanse"].includes(tick.payload.primitive)) {
    const mutation = applyStatusMutation(state, {
      actorId: tick.actorId,
      operation: tick.payload.operation,
      sourceActorId: tick.ownerActorId,
      statusId: tick.payload.subject,
      value: amount,
    });
    return mutation.ok
      ? { ok: true, state: mutation.state, events: [...events, mutation.event] }
      : mutation;
  }
  if (tick.payload.primitive === "resource") {
    const delta = tick.payload.operation === "gain" ? amount : -amount;
    const changed = applyTowResolveDeltaV2(state.economy, {
      actorId: tick.actorId,
      delta,
    });
    return changed.ok
      ? {
        ok: true,
        state: { ...state, economy: changed.state },
        events: [...events, changed.detail],
      }
      : { ok: false, reason: changed.reason };
  }
  return {
    ok: false,
    reason: `unsupported-encounter-v2-zone-primitive:${tick.payload.primitive}:${context}`,
  };
}

function applyZoneTicks(state, ticks, context) {
  let current = state;
  const events = [];
  for (const tick of ticks) {
    const applied = applyZoneTick(current, tick, context);
    if (!applied.ok) return applied;
    current = applied.state;
    events.push(...applied.events);
  }
  return { ok: true, state: current, events };
}

function applyStatusIntents(state, intents, {
  budgetActorId = null,
  budgetDeltas = null,
  context,
} = {}) {
  let current = state;
  const events = [];
  for (const intent of intents) {
    if (intent.type === "damage") {
      if (!liveRecipient(current, intent.targetActorId)) {
        events.push({
          type: "status-intent-skipped",
          statusId: intent.statusId,
          actorId: intent.targetActorId,
          reason: "recipient-not-living-and-fielded",
        });
        continue;
      }
      const damage = damagePacket(current, {
        sourceActorId: null,
        targetActorId: intent.targetActorId,
        amount: Math.min(TOW_DAMAGE_MAX_V2, intent.amount),
        attackScaleBps: 0,
        kind: "periodic",
        randomDraws: [],
      });
      if (!damage.ok) return damage;
      current = damage.state;
      events.push({
        type: "status-intent-resolved",
        statusId: intent.statusId,
        intentType: intent.type,
        actorId: intent.targetActorId,
      }, ...damage.events);
      continue;
    }
    if (intent.type === "budget") {
      if (budgetDeltas !== null && intent.actorId === budgetActorId) {
        budgetDeltas[intent.lane] += intent.amount;
        events.push({
          type: "status-intent-resolved",
          statusId: intent.statusId,
          intentType: intent.type,
          actorId: intent.actorId,
          lane: intent.lane,
          amount: intent.amount,
          deferredToPriorityOpen: true,
        });
        continue;
      }
      const changed = applyTowActionBudgetDeltaV2(current.economy, {
        actorId: intent.actorId,
        lane: intent.lane,
        delta: intent.amount,
        cause: intent.statusId,
      });
      if (!changed.ok) return { ok: false, reason: changed.reason };
      current = { ...current, economy: changed.state };
      events.push({
        type: "status-intent-resolved",
        statusId: intent.statusId,
        intentType: intent.type,
        actorId: intent.actorId,
        lane: intent.lane,
        amount: intent.amount,
        deferredToPriorityOpen: false,
      }, changed.detail);
      continue;
    }
    return {
      ok: false,
      reason: `unsupported-encounter-v2-status-intent:${intent.type}:${context}`,
    };
  }
  return { ok: true, state: current, events, budgetDeltas };
}

function advanceBoundary(state, boundary, actorId, options = {}) {
  const advanced = advanceTowStatusBoundaryV2(state.statuses, { boundary, actorId });
  if (!advanced.ok) return { ok: false, reason: advanced.reason };
  const withStatuses = { ...state, statuses: advanced.state };
  const applied = applyStatusIntents(withStatuses, advanced.intents, {
    ...options,
    context: boundary,
  });
  return applied.ok
    ? {
      ok: true,
      state: applied.state,
      events: [advanced.event, ...applied.events],
      budgetDeltas: applied.budgetDeltas,
    }
    : applied;
}

function targetPlan(state, ability, actorId, anchor) {
  const locked = lockAbilityTargetV2(state, ability, actorId, anchor);
  if (!locked.ok) return { ok: false, reason: locked.reason };
  const committed = commitAbilityTargetsV2(state, ability, locked.lock);
  return committed.ok
    ? { ok: true, lock: locked.lock, commit: committed }
    : { ok: false, reason: committed.reason };
}

function validForcedTargets(state, ability, actorId) {
  const ids = [];
  for (const anchor of legalAbilityAnchorsV2(state, ability, actorId)) {
    const plan = targetPlan(
      state,
      ability,
      actorId,
      anchor.tracking === "unit" ? anchor.actorId : { side: anchor.side, index: anchor.index },
    );
    if (!plan.ok) continue;
    for (const effect of ability.effects) {
      for (const recipient of recipientSnapshot(state, ability, plan.commit, effect)) {
        if (recipient.actorId
          && state.actors[recipient.actorId].side !== state.actors[actorId].side) {
          ids.push(recipient.actorId);
        }
      }
    }
  }
  return [...new Set(ids)];
}

function committedHostileRecipients(state, ability, targetCommit) {
  const casterSide = state.actors[targetCommit.casterId].side;
  return [...new Set(ability.effects.flatMap((effect) => (
    recipientSnapshot(state, ability, targetCommit, effect)
      .filter((entry) => entry.actorId && state.actors[entry.actorId].side !== casterSide)
      .map((entry) => entry.actorId)
  )))];
}

function committedHostileTargets(state, targetCommit) {
  const casterSide = state.actors[targetCommit.casterId].side;
  return [...new Set(targetCommit.selectedUnits
    .filter(({ actorId }) => state.actors[actorId].side !== casterSide)
    .map(({ actorId }) => actorId))];
}

function abilityAccessById(state, actorId, abilityId) {
  const actor = state.actors[actorId];
  if (!actor) return { ok: false, reason: "unknown-encounter-v2-actor" };
  if (actor.hp <= 0 || !actorCell(state, actor.id)) {
    return { ok: false, reason: "encounter-v2-actor-not-living-and-fielded" };
  }
  const loadout = actor.loadout.find(({ id }) => id === abilityId);
  if (!loadout) return { ok: false, reason: "ability-not-equipped-v2" };
  const definition = getTowAbilityRulesV2(abilityId);
  if (!definition) return { ok: false, reason: "unknown-encounter-v2-ability" };
  const ability = abilityRulesV2AtRank(definition, loadout.rank);
  if (!["main", "quick"].includes(ability.action.lane)) {
    return { ok: false, reason: "encounter-v2-reaction-arm-command-required" };
  }
  const economy = canUseTowAbilityV2(state.economy, {
    actorId,
    abilityId,
  });
  if (!economy.ok) return { ok: false, reason: economy.reason };
  if (economy.action.rank !== loadout.rank || economy.action.id !== ability.id) {
    return { ok: false, reason: "encounter-v2-ability-rank-mismatch" };
  }
  return { ok: true, actor, ability };
}

function abilityAccess(state, input) {
  if (!exactKeys(input, ABILITY_INPUT_KEYS)
    || !actorIdentifier(input.actorId)
    || !rulesIdentifier(input.abilityId)
    || !commandAnchor(input.anchor)
    || !randomDrawVector(input.randomDraws)) {
    return { ok: false, reason: "invalid-encounter-v2-ability-input" };
  }
  return abilityAccessById(state, input.actorId, input.abilityId);
}

function expectedDamageDraws(recipientSets, ability) {
  return ability.effects.reduce((total, effect, index) => (
    effect.primitive === "damage"
      ? total + (recipientSets[index].length * TOW_DAMAGE_POLICY_V2.direct.randomDrawsPerPacket)
      : total
  ), 0);
}

function reactionWindowPhase(window) {
  return window === "hostile-targeted-after-effects" ? "after" : "before";
}

function reactionWindowMatches(window, hostileAbility) {
  if (["hostile-targeted-before-effects", "hostile-targeted-after-effects"]
    .includes(window)) return true;
  if (window === "hostile-main-before-effects") {
    return hostileAbility.action.lane === "main";
  }
  return window === "hostile-melee-before-effects"
    && hostileAbility.presentation.castMode === "melee";
}

function reactionOwnerRosterIndex(state, actorId) {
  const actor = state.actors[actorId];
  return actor ? state.rosters[actor.side].indexOf(actorId) : Number.MAX_SAFE_INTEGER;
}

function matchingReactionSnapshot(state, hostileAbility, hostileCommit) {
  const hostileSourceId = hostileCommit.casterId;
  const hostileSource = state.actors[hostileSourceId];
  const hostileTargetIds = committedHostileTargets(state, hostileCommit);
  const entries = [];
  for (const [actorId, receipt] of Object.entries(state.reactionLocks)) {
    const owner = state.actors[actorId];
    const arm = state.economy.actors[actorId]?.armedReaction;
    if (!owner || !arm || owner.side === hostileSource.side
      || !reactionWindowMatches(arm.reactionWindow, hostileAbility)) continue;
    const watched = arm.reactionWatch === "selected-hostile-source"
      ? arm.watchedActorId === hostileSourceId
      : hostileTargetIds.includes(arm.watchedActorId);
    if (!watched) continue;
    const reactionAbility = abilityRulesV2AtRank(
      getTowAbilityRulesV2(arm.abilityId),
      arm.rank,
    );
    const initialCommit = commitAbilityTargetsV2(
      state,
      reactionAbility,
      receipt.targetLock,
    );
    const initialRecipients = initialCommit.ok
      ? reactionAbility.effects.map((effect) => (
        recipientSnapshot(state, reactionAbility, initialCommit, effect)
      ))
      : null;
    entries.push({
      actorId,
      abilityId: arm.abilityId,
      rank: arm.rank,
      window: arm.reactionWindow,
      watch: arm.reactionWatch,
      watchedActorId: arm.watchedActorId,
      armedSequence: receipt.armedSequence,
      targetLock: receipt.targetLock,
      reservedDraws: initialRecipients === null
        ? 0
        : expectedDamageDraws(initialRecipients, reactionAbility),
      rosterIndex: reactionOwnerRosterIndex(state, actorId),
    });
  }
  entries.sort((left, right) => (
    left.armedSequence - right.armedSequence
      || left.rosterIndex - right.rosterIndex
      || (left.actorId < right.actorId ? -1 : left.actorId > right.actorId ? 1 : 0)
  ));
  return {
    hostileSourceId,
    hostileTargetIds,
    entries,
    beforeDraws: entries
      .filter(({ window }) => reactionWindowPhase(window) === "before")
      .reduce((sum, { reservedDraws }) => sum + reservedDraws, 0),
    afterDraws: entries
      .filter(({ window }) => reactionWindowPhase(window) === "after")
      .reduce((sum, { reservedDraws }) => sum + reservedDraws, 0),
  };
}

function removeReactionLock(state, actorId) {
  const reactionLocks = { ...state.reactionLocks };
  delete reactionLocks[actorId];
  return { ...state, reactionLocks };
}

function fizzleReaction(state, entry, cause, context) {
  const armed = state.economy.actors[entry.actorId]?.armedReaction;
  if (armed === null || armed === undefined) {
    return { ok: true, state, events: [] };
  }
  const expired = expireTowReactionV2(state.economy, {
    actorId: entry.actorId,
    abilityId: entry.abilityId,
    cause,
  });
  if (!expired.ok) return { ok: false, reason: expired.reason };
  return {
    ok: true,
    state: removeReactionLock({ ...state, economy: expired.state }, entry.actorId),
    events: [{
      ...expired.detail,
      actorId: entry.actorId,
      abilityId: entry.abilityId,
      armedSequence: entry.armedSequence,
      targetLock: entry.targetLock,
      hostileSourceId: context.hostileSourceId,
      hostileTargetIds: context.hostileTargetIds,
    }],
  };
}

function resolveReactionWindow(
  state,
  snapshot,
  phase,
  randomDraws,
  startingDrawIndex,
) {
  let current = state;
  let drawIndex = startingDrawIndex;
  const events = [];
  for (const entry of snapshot.entries) {
    if (reactionWindowPhase(entry.window) !== phase) continue;
    const packetDraws = randomDraws.slice(drawIndex, drawIndex + entry.reservedDraws);
    drawIndex += entry.reservedDraws;
    const armed = current.economy.actors[entry.actorId]?.armedReaction;
    if (armed === null || armed === undefined) continue;
    if (!liveRecipient(current, entry.actorId)) {
      const fizzled = fizzleReaction(
        current,
        entry,
        "owner-not-living-and-fielded",
        snapshot,
      );
      if (!fizzled.ok) return fizzled;
      current = fizzled.state;
      events.push(...fizzled.events);
      continue;
    }
    const reactionAbility = abilityRulesV2AtRank(
      getTowAbilityRulesV2(entry.abilityId),
      entry.rank,
    );
    const targetCommit = commitAbilityTargetsV2(
      current,
      reactionAbility,
      entry.targetLock,
    );
    if (!targetCommit.ok) {
      const fizzled = fizzleReaction(current, entry, "lost-unit-lock", snapshot);
      if (!fizzled.ok) return fizzled;
      current = fizzled.state;
      events.push(...fizzled.events);
      continue;
    }
    const recipients = reactionAbility.effects.map((effect) => (
      recipientSnapshot(current, reactionAbility, targetCommit, effect)
    ));
    if (expectedDamageDraws(recipients, reactionAbility) !== entry.reservedDraws) {
      const fizzled = fizzleReaction(current, entry, "target-snapshot-drift", snapshot);
      if (!fizzled.ok) return fizzled;
      current = fizzled.state;
      events.push(...fizzled.events);
      continue;
    }
    const triggered = triggerTowReactionV2(current.economy, {
      actorId: entry.actorId,
      abilityId: entry.abilityId,
      hostileSourceId: snapshot.hostileSourceId,
      hostileTargetIds: snapshot.hostileTargetIds,
      window: entry.window,
    });
    if (!triggered.ok) return { ok: false, reason: triggered.reason };
    current = removeReactionLock({ ...current, economy: triggered.state }, entry.actorId);
    events.push({
      ...triggered.detail,
      actorId: entry.actorId,
      abilityId: entry.abilityId,
      armedSequence: entry.armedSequence,
      targetLock: entry.targetLock,
      targetCommit,
    });
    const executed = executeAbilityEffects(
      current,
      reactionAbility,
      targetCommit,
      recipients,
      packetDraws,
    );
    if (!executed.ok) return executed;
    current = executed.state;
    events.push(...executed.events, {
      type: "reaction-completed",
      actorId: entry.actorId,
      abilityId: entry.abilityId,
      rank: entry.rank,
      window: entry.window,
      armedSequence: entry.armedSequence,
    });
  }
  return { ok: true, state: current, events, drawIndex };
}

function applyMovementEffect(state, effect, targetCommit, recipient, events) {
  const allowance = resolveTowMovementAllowanceV2(state.statuses, {
    actorId: recipient.actorId,
    requestedCells: effect.value.amount,
  });
  if (!allowance.ok) return { ok: false, reason: allowance.reason };
  events.push(allowance.event);
  const resolved = resolveTowMovementV2(state, effect, {
    casterId: targetCommit.casterId,
    moverId: recipient.actorId,
    sourceCell: targetCommit.sourceCell,
    anchor: ["to-anchor", "toward-anchor", "away-from-anchor"].includes(effect.motion)
      ? { side: targetCommit.anchor.side, index: targetCommit.anchor.index }
      : null,
    committedRecipient: effect.recipient === "selected-units"
      ? { ...recipient }
      : null,
  }, {
    allowedCells: allowance.event.allowedCells,
    zones: state.zones,
  });
  if (!resolved.ok) return { ok: false, reason: resolved.reason };

  let current = state;
  const stepEvents = new Map(resolved.events
    .filter(({ type }) => type === "unit-moved")
    .map((event) => [event.ordinal, event]));
  for (let stepIndex = 0; stepIndex < resolved.movement.steps.length; stepIndex += 1) {
    const step = resolved.movement.steps[stepIndex];
    const formations = cloneData(current.formations);
    formations[step.from.side][step.from.index] = null;
    formations[step.to.side][step.to.index] = recipient.actorId;
    current = { ...current, formations };
    events.push(stepEvents.get(step.ordinal) ?? {
      type: "unit-moved",
      actorId: recipient.actorId,
      casterId: targetCommit.casterId,
      primitive: effect.primitive,
      motion: effect.motion,
      ordinal: step.ordinal,
      from: step.from,
      to: step.to,
      forced: effect.primitive !== "move",
    });
    const ticks = applyZoneTicks(current, step.enterTicks, "movement-after-enter");
    if (!ticks.ok) return ticks;
    current = ticks.state;
    events.push(...ticks.events);
    if (current.actors[recipient.actorId].hp <= 0) {
      events.push({
        type: "movement-stopped",
        actorId: recipient.actorId,
        casterId: targetCommit.casterId,
        primitive: effect.primitive,
        motion: effect.motion,
        stoppedReason: "defeated-after-enter",
        from: step.to,
        to: null,
      });
      return { ok: true, state: current };
    }
    if (step.enterTicks.length > 0 && stepIndex < resolved.movement.steps.length - 1) {
      const continued = resolveTowMovementAllowanceV2(current.statuses, {
        actorId: recipient.actorId,
        requestedCells: effect.value.amount,
      });
      if (!continued.ok) return { ok: false, reason: continued.reason };
      events.push({ ...continued.event, phase: "after-enter" });
      if (step.ordinal >= continued.event.allowedCells) {
        events.push({
          type: "movement-stopped",
          actorId: recipient.actorId,
          casterId: targetCommit.casterId,
          primitive: effect.primitive,
          motion: effect.motion,
          stoppedReason: "status-after-enter",
          from: step.to,
          to: null,
        });
        return { ok: true, state: current };
      }
    }
  }
  events.push(...resolved.events.filter(({ type }) => type !== "unit-moved"));
  return { ok: true, state: current };
}

function executeAbilityEffects(state, ability, targetCommit, recipientSets, randomDraws) {
  let current = state;
  let drawIndex = 0;
  const events = [];

  for (let effectIndex = 0; effectIndex < ability.effects.length; effectIndex += 1) {
    const effect = ability.effects[effectIndex];
    const recipients = recipientSets[effectIndex];
    events.push({
      type: "ability-effect-started",
      actorId: targetCommit.casterId,
      abilityId: ability.id,
      effectIndex,
      primitive: effect.primitive,
      recipientCount: recipients.length,
    });

    if (effect.primitive === "zone") {
      const definition = zoneRulesV2AtRank(TOW_ABILITY_ZONES_V2[effect.subject], ability.rank);
      let potency;
      try {
        potency = zonePlacementPotency(current, targetCommit.casterId, definition);
      } catch (error) {
        return { ok: false, reason: error.message };
      }
      for (let recipientIndex = 0; recipientIndex < recipients.length; recipientIndex += 1) {
        const cell = recipients[recipientIndex];
        const sequence = nextZoneSequence(current.zones);
        if (sequence === null) return { ok: false, reason: "encounter-v2-zone-sequence-overflow" };
        const placed = placeTowZoneV2(current.zones, {
          instanceId: `z:${current.economy.round}:${current.economy.turn}:${sequence}`,
          definitionId: definition.id,
          ownerActorId: targetCommit.casterId,
          ownerSide: current.actors[targetCommit.casterId].side,
          side: cell.side,
          index: cell.index,
          rank: ability.rank,
          resolvedPotency: potency,
          rounds: effect.value.amount,
          sequence,
        });
        if (!placed.ok) return { ok: false, reason: placed.reason };
        current = { ...current, zones: placed.state };
        events.push(...placed.events.map((event) => ({
          ...event,
          effectIndex,
          recipientIndex,
        })));
      }
      events.push({
        type: "ability-effect-completed",
        actorId: targetCommit.casterId,
        abilityId: ability.id,
        effectIndex,
        primitive: effect.primitive,
      });
      continue;
    }

    if (!UNIT_PRIMITIVES.has(effect.primitive)) {
      return { ok: false, reason: `unsupported-encounter-v2-primitive:${effect.primitive}` };
    }
    for (let recipientIndex = 0; recipientIndex < recipients.length; recipientIndex += 1) {
      const recipient = recipients[recipientIndex];
      const drawCount = effect.primitive === "damage"
        ? TOW_DAMAGE_POLICY_V2.direct.randomDrawsPerPacket
        : 0;
      const packetDraws = randomDraws.slice(drawIndex, drawIndex + drawCount);
      drawIndex += drawCount;
      if (!liveRecipient(current, recipient.actorId)) {
        events.push(skipEvent(
          effectIndex,
          recipientIndex,
          recipient,
          "recipient-not-living-and-fielded",
        ));
        continue;
      }

      if (effect.primitive === "damage") {
        if (!liveRecipient(current, targetCommit.casterId)
          || recipient.actorId === targetCommit.casterId) {
          events.push(skipEvent(
            effectIndex,
            recipientIndex,
            recipient,
            "damage-source-not-living-or-self-target",
          ));
          continue;
        }
        let amount;
        try {
          amount = resolvedMagnitude(
            current,
            targetCommit.casterId,
            recipient.actorId,
            effect.value,
            effect.scalesFrom,
            { excludeCasterAttackModifiers: true },
          );
        } catch (error) {
          return { ok: false, reason: error.message };
        }
        const damage = damagePacket(current, {
          sourceActorId: targetCommit.casterId,
          targetActorId: recipient.actorId,
          amount: Math.min(TOW_DAMAGE_MAX_V2, amount),
          attackScaleBps: effect.scalesFrom === "caster"
            && effect.value.basis === "attack"
            ? effect.value.amount * 100
            : 0,
          kind: "direct",
          randomDraws: packetDraws,
        });
        if (!damage.ok) return damage;
        current = damage.state;
        events.push(...damage.events.map((event) => ({
          ...event,
          effectIndex,
          recipientIndex,
        })));
        continue;
      }

      if (["move", "push", "pull"].includes(effect.primitive)) {
        const moved = applyMovementEffect(current, effect, targetCommit, recipient, events);
        if (!moved.ok) return moved;
        current = moved.state;
        continue;
      }

      let amount;
      try {
        amount = resolvedMagnitude(
          current,
          targetCommit.casterId,
          recipient.actorId,
          effect.value,
          effect.scalesFrom,
        );
      } catch (error) {
        return { ok: false, reason: error.message };
      }
      if (effect.primitive === "heal") {
        const healed = applyHeal(current, recipient.actorId, amount);
        current = healed.state;
        events.push({ ...healed.event, effectIndex, recipientIndex });
      } else if (effect.primitive === "shield") {
        const shielded = applyShield(current, recipient.actorId, amount);
        current = shielded.state;
        events.push({ ...shielded.event, effectIndex, recipientIndex });
      } else if (["status", "cleanse"].includes(effect.primitive)) {
        const mutation = applyStatusMutation(current, {
          actorId: recipient.actorId,
          operation: effect.operation,
          sourceActorId: targetCommit.casterId,
          statusId: effect.subject,
          value: amount,
        });
        if (!mutation.ok) return mutation;
        current = mutation.state;
        events.push({ ...mutation.event, effectIndex, recipientIndex });
      } else if (effect.primitive === "resource") {
        const delta = effect.operation === "gain" ? amount : -amount;
        const changed = applyTowResolveDeltaV2(current.economy, {
          actorId: recipient.actorId,
          delta,
        });
        if (!changed.ok) return { ok: false, reason: changed.reason };
        current = { ...current, economy: changed.state };
        events.push({ ...changed.detail, effectIndex, recipientIndex });
      }
    }
    events.push({
      type: "ability-effect-completed",
      actorId: targetCommit.casterId,
      abilityId: ability.id,
      effectIndex,
      primitive: effect.primitive,
    });
  }
  return { ok: true, state: current, events, drawsConsumed: drawIndex };
}

function resolveClosedActorEndBoundaries(state, actorId) {
  let current = state;
  const events = [];
  for (const boundaryName of ["recipient-turn-end", "source-turn-end"]) {
    const boundary = advanceBoundary(current, boundaryName, actorId);
    if (!boundary.ok) return boundary;
    current = boundary.state;
    events.push(...boundary.events);
  }
  const occupant = occupantForActor(current, actorId);
  if (occupant) {
    const collected = collectTowZoneTicksV2(current.zones, {
      timing: "turn-end",
      occupants: [occupant],
    });
    if (!collected.ok) return { ok: false, reason: collected.reason };
    const ticks = applyZoneTicks(current, collected.ticks, "turn-end");
    if (!ticks.ok) return ticks;
    current = ticks.state;
    events.push(...ticks.events);
  }
  return { ok: true, state: current, events };
}

/** Open one deterministic encounter round. */
export function beginTowEncounterRoundV2(state, input = {}) {
  const checked = checkedState(state);
  if (!checked.ok) return checked.result;
  const original = checked.state;
  if (!exactKeys(input, NO_INPUT_KEYS)) {
    return failure("invalid-encounter-v2-round-input", original);
  }
  if (combatResult(original) !== null) return failure("encounter-v2-combat-complete", original);

  const boundary = advanceBoundary(original, "round-start", null);
  if (!boundary.ok) return failure(boundary.reason, original);
  const events = [...boundary.events];
  const boundaryOutcome = appendTerminalEvent(boundary.state, events);
  if (boundaryOutcome !== null) {
    return success(boundary.state, events, {
      type: "round-start",
      round: boundary.state.economy.round,
      combatResult: boundaryOutcome,
    });
  }
  const opened = beginTowActionRoundV2(boundary.state.economy);
  if (!opened.ok) return failure(opened.reason, original);
  const order = towEncounterRoundOrderV2(boundary.state);
  const next = {
    ...boundary.state,
    economy: opened.state,
    scheduler: {
      version: TOW_ENCOUNTER_SCHEDULER_V2_VERSION,
      round: opened.state.round,
      order,
      cursor: 0,
      priorityActorIds: [],
      skippedActorIds: [],
      turnBase: opened.state.turn,
    },
  };
  events.push(
    { type: "round-schedule-created", round: opened.state.round, order },
    { type: "encounter-round-started", round: opened.state.round },
  );
  return success(next, events, {
    type: "round-start",
    round: opened.state.round,
    order,
    combatResult: null,
  });
}

/** Run status/zone start boundaries, then open priority only for a surviving actor. */
export function beginTowEncounterActorTurnV2(state, input) {
  const checked = checkedState(state);
  if (!checked.ok) return checked.result;
  const original = checked.state;
  if (!exactKeys(input, ACTOR_INPUT_KEYS) || !actorIdentifier(input.actorId)) {
    return failure("invalid-encounter-v2-actor-input", original);
  }
  if (combatResult(original) !== null) return failure("encounter-v2-combat-complete", original);
  if (original.economy.phase !== "round") {
    return failure("actor-turn-not-ready-v2", original);
  }
  const scheduled = scheduledProgress(original);
  if (scheduled.nextActorId === null) {
    return failure("encounter-v2-round-schedule-complete", original);
  }
  if (scheduled.nextActorId !== input.actorId) {
    return failure("encounter-v2-actor-out-of-order", original);
  }

  let current = {
    ...original,
    scheduler: {
      ...original.scheduler,
      cursor: scheduled.index + 1,
      skippedActorIds: [
        ...original.scheduler.skippedActorIds,
        ...scheduled.skippedActorIds,
      ],
    },
  };
  const events = skippedScheduleEvents(scheduled.skippedActorIds);
  const budgetDeltas = { main: 0, quick: 0, reaction: 0 };
  for (const boundaryName of ["source-turn-start", "recipient-turn-start"]) {
    const boundary = advanceBoundary(current, boundaryName, input.actorId, {
      budgetActorId: input.actorId,
      budgetDeltas,
    });
    if (!boundary.ok) return failure(boundary.reason, original);
    current = boundary.state;
    events.push(...boundary.events);
  }

  const occupant = occupantForActor(current, input.actorId);
  if (occupant) {
    const collected = collectTowZoneTicksV2(current.zones, {
      timing: "turn-start",
      occupants: [occupant],
    });
    if (!collected.ok) return failure(collected.reason, original);
    const ticks = applyZoneTicks(current, collected.ticks, "turn-start");
    if (!ticks.ok) return failure(ticks.reason, original);
    current = ticks.state;
    events.push(...ticks.events);
  }

  if (!liveRecipient(current, input.actorId)) {
    current = {
      ...current,
      scheduler: {
        ...current.scheduler,
        skippedActorIds: [...current.scheduler.skippedActorIds, input.actorId],
      },
    };
    events.push({
      type: "actor-turn-skipped",
      actorId: input.actorId,
      reason: "defeated-before-priority",
    });
    const outcome = appendTerminalEvent(current, events);
    return success(current, events, {
      type: "actor-turn-start",
      actorId: input.actorId,
      priorityOpened: false,
      combatResult: outcome,
    });
  }

  const control = adjudicateTowStatusActionV2(current.statuses, {
    actorId: input.actorId,
    lane: "main",
  });
  if (!control.ok) return failure(control.reason, original);
  current = { ...current, statuses: control.state };
  events.push(control.event);
  if (!control.event.allowed) {
    current = {
      ...current,
      scheduler: {
        ...current.scheduler,
        skippedActorIds: [...current.scheduler.skippedActorIds, input.actorId],
      },
    };
    events.push({
      type: "actor-priority-skipped",
      actorId: input.actorId,
      reason: "status-action-lock",
      blockedBy: control.event.blockedBy,
    });
    return success(current, events, {
      type: "actor-turn-start",
      actorId: input.actorId,
      priorityOpened: false,
      prioritySkipped: true,
      skipReason: "status-action-lock",
      blockedBy: control.event.blockedBy,
      combatResult: null,
    });
  }

  const opened = beginTowActorTurnV2(current.economy, {
    actorId: input.actorId,
    budgetDeltas,
  });
  if (!opened.ok) return failure(opened.reason, original);
  current = { ...current, economy: opened.state };
  current = {
    ...current,
    scheduler: {
      ...current.scheduler,
      priorityActorIds: [...current.scheduler.priorityActorIds, input.actorId],
    },
  };
  if (opened.detail.expiredReaction !== null) {
    const receipt = current.reactionLocks[input.actorId];
    const reactionLocks = { ...current.reactionLocks };
    delete reactionLocks[input.actorId];
    current = { ...current, reactionLocks };
    events.push({
      type: "reaction-expired",
      actorId: input.actorId,
      abilityId: opened.detail.expiredReaction.abilityId,
      reaction: opened.detail.expiredReaction,
      armedSequence: receipt.armedSequence,
      targetLock: receipt.targetLock,
      cause: "owner-priority-opened",
    });
  }
  events.push(opened.detail);
  return success(current, events, {
    type: "actor-turn-start",
    actorId: input.actorId,
    priorityOpened: true,
    combatResult: null,
  });
}

/** Atomically spend one reaction preparation and persist its exact unit lock/order receipt. */
export function armTowEncounterReactionV2(state, input) {
  const checked = checkedState(state);
  if (!checked.ok) return checked.result;
  const original = checked.state;
  if (combatResult(original) !== null) return failure("encounter-v2-combat-complete", original);
  if (!exactKeys(input, REACTION_ARM_INPUT_KEYS)
    || !actorIdentifier(input.actorId)
    || !rulesIdentifier(input.abilityId)
    || !commandAnchor(input.anchor)) {
    return failure("invalid-encounter-v2-reaction-arm-input", original);
  }
  const actor = original.actors[input.actorId];
  if (!actor) return failure("unknown-encounter-v2-actor", original);
  if (actor.controller !== "human") {
    return failure("encounter-v2-human-ability-required", original);
  }
  if (!liveRecipient(original, input.actorId)) {
    return failure("encounter-v2-actor-not-living-and-fielded", original);
  }
  const loadout = actor.loadout.find(({ id }) => id === input.abilityId);
  if (!loadout) return failure("ability-not-equipped-v2", original);
  const definition = getTowAbilityRulesV2(input.abilityId);
  if (!definition) return failure("unknown-encounter-v2-ability", original);
  const ability = abilityRulesV2AtRank(definition, loadout.rank);
  if (ability.action.lane !== "reaction") {
    return failure("encounter-v2-reaction-ability-required", original);
  }
  const locked = lockAbilityTargetV2(original, ability, input.actorId, input.anchor);
  if (!locked.ok) return failure(locked.reason, original);
  if (locked.lock.anchor.tracking !== "unit" || locked.lock.anchor.actorId === null) {
    return failure("encounter-v2-reaction-unit-lock-required", original);
  }
  if (!Number.isSafeInteger(original.reactionSequence + 1)) {
    return failure("encounter-v2-reaction-sequence-overflow", original);
  }
  // Prove economy authority before a control resolver is allowed to consume a status.
  // The real spend remains below so the lock, status result, and economy receipt commit
  // together or not at all.
  const available = armTowReactionV2(original.economy, {
    actorId: input.actorId,
    abilityId: input.abilityId,
    watchedActorId: locked.lock.anchor.actorId,
  });
  if (!available.ok || available.action.rank !== ability.rank) {
    return failure(
      available.ok ? "encounter-v2-ability-rank-mismatch" : available.reason,
      original,
    );
  }

  let current = original;
  const events = [];
  const adjudicated = adjudicateTowStatusActionV2(current.statuses, {
    actorId: input.actorId,
    lane: "reaction",
  });
  if (!adjudicated.ok) return failure(adjudicated.reason, original);
  current = { ...current, statuses: adjudicated.state };
  events.push(adjudicated.event);
  if (!adjudicated.event.allowed) {
    events.push({
      type: "reaction-arm-blocked",
      actorId: input.actorId,
      abilityId: input.abilityId,
      blockedBy: adjudicated.event.blockedBy,
    });
    return success(current, events, {
      type: "reaction-arm",
      actorId: input.actorId,
      abilityId: input.abilityId,
      rank: ability.rank,
      committed: false,
      targetLock: null,
      armedSequence: null,
    });
  }

  const armedSequence = original.reactionSequence + 1;
  const armed = armTowReactionV2(current.economy, {
    actorId: input.actorId,
    abilityId: input.abilityId,
    watchedActorId: locked.lock.anchor.actorId,
  });
  if (!armed.ok || armed.action.rank !== ability.rank) {
    return failure(armed.ok ? "encounter-v2-ability-rank-mismatch" : armed.reason, original);
  }
  const reactionLocks = Object.fromEntries(Object.entries({
    ...current.reactionLocks,
    [input.actorId]: {
      armedSequence,
      targetLock: locked.lock,
    },
  }).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)));
  current = {
    ...current,
    economy: armed.state,
    reactionLocks,
    reactionSequence: armedSequence,
  };
  events.push({
    ...armed.detail,
    actorId: input.actorId,
    abilityId: input.abilityId,
    targetLock: locked.lock,
    armedSequence,
  });
  return success(current, events, {
    type: "reaction-arm",
    actorId: input.actorId,
    abilityId: input.abilityId,
    rank: ability.rank,
    committed: true,
    targetLock: locked.lock,
    armedSequence,
  });
}

function expectedPlanRandomDraws(state, ability, plan) {
  const recipientSets = ability.effects.map((effect) => (
    recipientSnapshot(state, ability, plan.commit, effect)
  ));
  const reactionSnapshot = matchingReactionSnapshot(state, ability, plan.commit);
  const hostileExpectedDraws = expectedDamageDraws(recipientSets, ability);
  return {
    recipientSets,
    reactionSnapshot,
    hostileExpectedDraws,
    expectedDraws: reactionSnapshot.beforeDraws
      + hostileExpectedDraws
      + reactionSnapshot.afterDraws,
  };
}

function commitPreparedTowEncounterAbilityV2(original, input, ability, plan) {
  const {
    recipientSets,
    reactionSnapshot,
    hostileExpectedDraws,
    expectedDraws,
  } = expectedPlanRandomDraws(original, ability, plan);
  if (input.randomDraws.length !== expectedDraws
    || !randomDrawVector(input.randomDraws)) {
    return failure("invalid-encounter-v2-random-draws", original);
  }

  const validTargets = validForcedTargets(original, ability, input.actorId);
  const forced = resolveTowForcedTargetV2(original.statuses, {
    actorId: input.actorId,
    validActorIds: validTargets,
  });
  if (!forced.ok) return failure(forced.reason, original);
  if (forced.event.targetActorId !== null
    && !committedHostileRecipients(original, ability, plan.commit)
      .includes(forced.event.targetActorId)) {
    return failure("encounter-v2-forced-target-mismatch", original);
  }

  let current = { ...original, statuses: forced.state };
  const events = [forced.event];
  const adjudicated = adjudicateTowStatusActionV2(current.statuses, {
    actorId: input.actorId,
    lane: ability.action.lane,
  });
  if (!adjudicated.ok) return failure(adjudicated.reason, original);
  current = { ...current, statuses: adjudicated.state };
  events.push(adjudicated.event);
  if (!adjudicated.event.allowed) {
    events.push({
      type: "ability-blocked",
      actorId: input.actorId,
      abilityId: ability.id,
      lane: ability.action.lane,
      blockedBy: adjudicated.event.blockedBy,
    });
    return success(current, events, {
      type: "ability",
      actorId: input.actorId,
      abilityId: ability.id,
      rank: ability.rank,
      lane: ability.action.lane,
      committed: false,
      targetCommit: null,
      drawsConsumed: 0,
      combatResult: null,
    });
  }

  const economy = commitTowAbilityActionV2(current.economy, {
    actorId: input.actorId,
    abilityId: ability.id,
  });
  if (!economy.ok || economy.action.rank !== ability.rank) {
    return failure(economy.ok ? "encounter-v2-ability-rank-mismatch" : economy.reason, original);
  }
  current = { ...current, economy: economy.state };
  events.push({
    ...economy.detail,
    targetLock: plan.lock,
    targetCommit: plan.commit,
  });
  if (reactionSnapshot.entries.length > 0) {
    events.push({
      type: "reaction-snapshot-created",
      hostileSourceId: input.actorId,
      hostileTargetIds: reactionSnapshot.hostileTargetIds,
      reactions: reactionSnapshot.entries.map((entry) => ({
        actorId: entry.actorId,
        abilityId: entry.abilityId,
        window: entry.window,
        armedSequence: entry.armedSequence,
      })),
    });
  }

  const beforeReactions = resolveReactionWindow(
    current,
    reactionSnapshot,
    "before",
    input.randomDraws,
    0,
  );
  if (!beforeReactions.ok) return failure(beforeReactions.reason, original);
  current = beforeReactions.state;
  events.push(...beforeReactions.events);

  const executed = executeAbilityEffects(
    current,
    ability,
    plan.commit,
    recipientSets,
    input.randomDraws.slice(
      beforeReactions.drawIndex,
      beforeReactions.drawIndex + hostileExpectedDraws,
    ),
  );
  if (!executed.ok) return failure(executed.reason, original);
  current = executed.state;
  events.push(...executed.events);

  const afterReactions = resolveReactionWindow(
    current,
    reactionSnapshot,
    "after",
    input.randomDraws,
    beforeReactions.drawIndex + hostileExpectedDraws,
  );
  if (!afterReactions.ok) return failure(afterReactions.reason, original);
  current = afterReactions.state;
  events.push(...afterReactions.events);

  if (current.actors[input.actorId].hp <= 0
    && current.economy.phase === "actor-turn"
    && current.economy.activeActorId === input.actorId) {
    const closed = endTowActorTurnV2(current.economy, { actorId: input.actorId });
    if (!closed.ok) return failure(closed.reason, original);
    current = { ...current, economy: closed.state };
    events.push({ type: "actor-priority-closed", actorId: input.actorId, cause: "defeated" });
    const ended = resolveClosedActorEndBoundaries(current, input.actorId);
    if (!ended.ok) return failure(ended.reason, original);
    current = ended.state;
    events.push(...ended.events);
  }
  const outcome = appendTerminalEvent(current, events);
  return success(current, events, {
    type: "ability",
    actorId: input.actorId,
    abilityId: ability.id,
    rank: ability.rank,
    lane: ability.action.lane,
    committed: true,
    targetCommit: plan.commit,
    drawsConsumed: afterReactions.drawIndex,
    combatResult: outcome,
  });
}

/** Commit and execute one main/quick ability as a single atomic state transition. */
export function commitTowEncounterAbilityV2(state, input) {
  const checked = checkedState(state);
  if (!checked.ok) return checked.result;
  const original = checked.state;
  if (combatResult(original) !== null) return failure("encounter-v2-combat-complete", original);
  const access = abilityAccess(original, input);
  if (!access.ok) return failure(access.reason, original);
  const { ability } = access;
  const plan = targetPlan(original, ability, input.actorId, input.anchor);
  if (!plan.ok) return failure(plan.reason, original);
  return commitPreparedTowEncounterAbilityV2(original, input, ability, plan);
}

/** Close priority, then resolve pre-existing end-boundary status and zone effects. */
export function endTowEncounterActorTurnV2(state, input) {
  const checked = checkedState(state);
  if (!checked.ok) return checked.result;
  const original = checked.state;
  if (!exactKeys(input, ACTOR_INPUT_KEYS) || !actorIdentifier(input.actorId)) {
    return failure("invalid-encounter-v2-actor-input", original);
  }
  if (combatResult(original) !== null) return failure("encounter-v2-combat-complete", original);
  const closed = endTowActorTurnV2(original.economy, input);
  if (!closed.ok) return failure(closed.reason, original);
  let current = { ...original, economy: closed.state };
  const events = [{ type: "actor-priority-closed", actorId: input.actorId, cause: "ended" }];
  const ended = resolveClosedActorEndBoundaries(current, input.actorId);
  if (!ended.ok) return failure(ended.reason, original);
  current = ended.state;
  events.push(...ended.events);
  const outcome = appendTerminalEvent(current, events);
  return success(current, events, {
    type: "actor-turn-end",
    actorId: input.actorId,
    combatResult: outcome,
  });
}

/** Resolve round-end status/zones and return the action economy to between-rounds. */
export function endTowEncounterRoundV2(state, input = {}) {
  const checked = checkedState(state);
  if (!checked.ok) return checked.result;
  const original = checked.state;
  if (!exactKeys(input, NO_INPUT_KEYS)) {
    return failure("invalid-encounter-v2-round-input", original);
  }
  if (combatResult(original) !== null) return failure("encounter-v2-combat-complete", original);
  if (original.economy.phase !== "round") {
    return failure("round-not-ready-to-close-v2", original);
  }

  const scheduled = scheduledProgress(original);
  if (scheduled.nextActorId !== null) {
    return failure("encounter-v2-round-schedule-incomplete", original);
  }
  let scheduledState = {
    ...original,
    scheduler: {
      ...original.scheduler,
      cursor: original.scheduler.order.length,
      skippedActorIds: [
        ...original.scheduler.skippedActorIds,
        ...scheduled.skippedActorIds,
      ],
    },
  };
  const events = [
    ...skippedScheduleEvents(scheduled.skippedActorIds),
    {
      type: "round-schedule-completed",
      round: original.economy.round,
      order: original.scheduler.order,
    },
  ];

  const boundary = advanceBoundary(scheduledState, "round-end", null);
  if (!boundary.ok) return failure(boundary.reason, original);
  let current = boundary.state;
  events.push(...boundary.events);
  const zones = endTowZoneRoundV2(current.zones, {
    occupants: allLivingOccupants(current),
  });
  if (!zones.ok) return failure(zones.reason, original);
  current = { ...current, zones: zones.state };
  const ticks = applyZoneTicks(current, zones.ticks, "round-end");
  if (!ticks.ok) return failure(ticks.reason, original);
  current = ticks.state;
  events.push(...ticks.events, ...zones.events);

  const closed = endTowActionRoundV2(current.economy);
  if (!closed.ok) return failure(closed.reason, original);
  current = { ...current, economy: closed.state };
  events.push({ type: "encounter-round-ended", round: current.economy.round });
  const outcome = appendTerminalEvent(current, events);
  return success(current, events, {
    type: "round-end",
    round: current.economy.round,
    combatResult: outcome,
  });
}

function canonicalIntentEntries(intents) {
  return Object.fromEntries(Object.entries(intents)
    .sort(([left], [right]) => compareIdentifiers(left, right)));
}

function persistAiIntent(state, actorId, intent, intentSequence) {
  return immutableState({
    ...state,
    intents: canonicalIntentEntries({ ...state.intents, [actorId]: cloneData(intent) }),
    intentSequence,
  });
}

function clearAiIntent(state, actorId) {
  if (!Object.hasOwn(state.intents, actorId)) return state;
  const intents = { ...state.intents };
  delete intents[actorId];
  return immutableState({ ...state, intents: canonicalIntentEntries(intents) });
}

function preparedAiIntentPlan(state, actorId, intent) {
  const access = abilityAccessById(state, actorId, intent.abilityId);
  if (!access.ok) return access;
  if (access.ability.rank !== intent.rank) {
    return { ok: false, reason: "encounter-v2-ai-intent-rank-mismatch" };
  }
  const committed = commitAbilityTargetsV2(state, access.ability, intent.targetLock);
  return committed.ok
    ? {
      ok: true,
      ability: access.ability,
      plan: { lock: intent.targetLock, commit: committed },
    }
    : { ok: false, reason: committed.reason };
}

function aiStepResult(state, events, input, {
  stage,
  actorId = null,
  abilityId = null,
  drawsConsumed = 0,
}) {
  const result = combatResult(state);
  const detail = {
    type: "ai-step-completed",
    stage,
    actorId,
    abilityId,
    intentSequence: state.intentSequence,
    drawsConsumed,
    drawsProvided: input.randomDraws.length,
    combatResult: result,
  };
  return success(state, [...events, detail], {
    type: "ai-step",
    stage,
    actorId,
    abilityId,
    intentSequence: state.intentSequence,
    drawsConsumed,
    drawsProvided: input.randomDraws.length,
    combatResult: result,
  });
}

function endAiPriorityAfterDecision(original, current, input, actorId, events) {
  const ended = endTowEncounterActorTurnV2(current, { actorId });
  if (!ended.ok) return failure(ended.reason, original);
  return aiStepResult(ended.state, [...events, ...ended.events], input, {
    stage: "actor-turn-ended",
    actorId,
  });
}

/**
 * Perform exactly one replay-owned AI transition.
 *
 * Scheduler advancement, declaration, invalidation/redeclaration, execution, and the
 * no-action priority close are deliberately separate accepted commands. A persisted
 * intent is therefore externally observable between declaration and execution, and a
 * Challenge change can invalidate it without silent retargeting. The command owns one
 * replayed draw pool; only an execution step consumes its required prefix.
 */
export function runTowEncounterAiStepV2(state, input) {
  const checked = checkedState(state);
  if (!checked.ok) return checked.result;
  const original = checked.state;
  if (!exactKeys(input, AI_STEP_INPUT_KEYS)
    || !randomDrawVector(input.randomDraws, MAX_TOW_AI_STEP_RANDOM_DRAWS_V2)) {
    return failure("invalid-encounter-v2-ai-step-input", original);
  }
  if (combatResult(original) !== null) return failure("encounter-v2-combat-complete", original);
  if (original.economy.phase === "actor-turn") {
    const active = original.actors[original.economy.activeActorId];
    if (active?.controller === "human") {
      return failure("encounter-v2-player-decision-required", original);
    }
  }

  if (original.economy.phase === "between-rounds") {
    const opened = beginTowEncounterRoundV2(original);
    if (!opened.ok) return failure(opened.reason, original);
    return aiStepResult(opened.state, opened.events, input, { stage: "round-started" });
  }

  if (original.economy.phase === "round") {
    const scheduled = scheduledProgress(original);
    if (scheduled.nextActorId === null) {
      const ended = endTowEncounterRoundV2(original);
      if (!ended.ok) return failure(ended.reason, original);
      return aiStepResult(ended.state, ended.events, input, { stage: "round-ended" });
    }
    const actorId = scheduled.nextActorId;
    const opened = beginTowEncounterActorTurnV2(original, { actorId });
    if (!opened.ok) return failure(opened.reason, original);
    return aiStepResult(opened.state, opened.events, input, {
      stage: "actor-turn-started",
      actorId,
    });
  }

  const actorId = original.economy.activeActorId;
  const actor = original.actors[actorId];
  if (!actor || actor.controller !== "ai") {
    return failure("encounter-v2-ai-priority-required", original);
  }

  const intent = original.intents[actorId] ?? null;
  if (intent === null) {
    const declaredSequence = original.intentSequence + 1;
    if (!Number.isSafeInteger(declaredSequence)) {
      return failure("encounter-v2-ai-intent-sequence-overflow", original);
    }
    const declared = declareTowAiIntentV2(original, { actorId, declaredSequence });
    if (!declared.ok) return failure(declared.reason, original);
    const current = immutableState({ ...original, intentSequence: declaredSequence });
    if (declared.decision === "end") {
      return endAiPriorityAfterDecision(
        original,
        current,
        input,
        actorId,
        declared.events,
      );
    }
    const persisted = persistAiIntent(current, actorId, declared.intent, declaredSequence);
    return aiStepResult(persisted, declared.events, input, {
      stage: "intent-declared",
      actorId,
      abilityId: declared.intent.abilityId,
    });
  }

  const evaluated = evaluateTowAiIntentV2(original, { actorId, intent });
  if (!evaluated.ok) return failure(evaluated.reason, original);
  if (!evaluated.valid) {
    const nextDeclaredSequence = original.intentSequence + 1;
    if (!Number.isSafeInteger(nextDeclaredSequence)) {
      return failure("encounter-v2-ai-intent-sequence-overflow", original);
    }
    const redeclared = redeclareTowAiIntentV2(original, {
      actorId,
      intent,
      nextDeclaredSequence,
    });
    if (!redeclared.ok) return failure(redeclared.reason, original);
    let current = clearAiIntent(original, actorId);
    current = immutableState({ ...current, intentSequence: nextDeclaredSequence });
    if (redeclared.decision === "end") {
      return endAiPriorityAfterDecision(
        original,
        current,
        input,
        actorId,
        redeclared.events,
      );
    }
    current = persistAiIntent(current, actorId, redeclared.intent, nextDeclaredSequence);
    return aiStepResult(current, redeclared.events, input, {
      stage: "intent-invalidated",
      actorId,
      abilityId: redeclared.intent.abilityId,
    });
  }

  const prepared = preparedAiIntentPlan(original, actorId, intent);
  if (!prepared.ok) return failure(prepared.reason, original);
  const projection = expectedPlanRandomDraws(original, prepared.ability, prepared.plan);
  if (projection.expectedDraws > input.randomDraws.length) {
    return failure("insufficient-encounter-v2-ai-step-random-draws", original);
  }
  const actionDraws = input.randomDraws.slice(0, projection.expectedDraws);
  const current = clearAiIntent(original, actorId);
  const executed = commitPreparedTowEncounterAbilityV2(
    current,
    {
      actorId,
      abilityId: intent.abilityId,
      anchor: intent.targetLock.anchor.tracking === "unit"
        ? intent.targetLock.anchor.actorId
        : {
          side: intent.targetLock.anchor.side,
          index: intent.targetLock.anchor.index,
        },
      randomDraws: actionDraws,
    },
    prepared.ability,
    prepared.plan,
  );
  if (!executed.ok) return failure(executed.reason, original);
  return aiStepResult(executed.state, executed.events, input, {
    stage: "action-executed",
    actorId,
    abilityId: intent.abilityId,
    drawsConsumed: projection.expectedDraws,
  });
}

/**
 * Apply one exact serialized v2 command without inferring its ruleset, rank, or actor side.
 * Convenience functions above remain useful to a future session adapter, while this entry
 * point is the fail-closed replay/reducer boundary.
 */
export function reduceTowEncounterV2(state, command) {
  const type = command?.type;
  const expected = TOW_ENCOUNTER_COMMAND_TYPES_V2.includes(type)
    ? COMMAND_KEYS[type]
    : null;
  if (!expected
    || !exactKeys(command, expected)
    || command.version !== TOW_ABILITY_RULES_V2_VERSION
    || command.rulesetId !== TOW_ABILITY_RULESET_V2_ID) {
    const checked = checkedState(state);
    return checked.ok
      ? failure("invalid-encounter-v2-command", checked.state)
      : checked.result;
  }
  if (type === "round-start") return beginTowEncounterRoundV2(state);
  if (type === "actor-turn-start") {
    return beginTowEncounterActorTurnV2(state, { actorId: command.actorId });
  }
  if (type === "reaction-arm") {
    return armTowEncounterReactionV2(state, {
      actorId: command.actorId,
      abilityId: command.abilityId,
      anchor: command.anchor,
    });
  }
  if (type === "ability") {
    return commitTowEncounterAbilityV2(state, {
      actorId: command.actorId,
      abilityId: command.abilityId,
      anchor: command.anchor,
      randomDraws: command.randomDraws,
    });
  }
  if (type === "actor-turn-end") {
    return endTowEncounterActorTurnV2(state, { actorId: command.actorId });
  }
  if (type === "ai-step") {
    return runTowEncounterAiStepV2(state, { randomDraws: command.randomDraws });
  }
  return endTowEncounterRoundV2(state);
}
