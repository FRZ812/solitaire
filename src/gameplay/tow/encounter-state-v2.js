// Canonical genesis and composite state scaffold for solitaire-tow-v2.
//
// This file intentionally defines data authority only. It persists and validates the exact
// round-order/cursor receipt, but does not resolve commands, execute effects, or register a
// runtime/session. Genesis accepts only explicit v2 actor snapshots and Resolve seeds, then
// composes the independently validated action, targeting, status, formation, and zone
// authorities into one frozen encounter snapshot.

import {
  TOW_ACTION_ECONOMY_POLICY_V2,
  createTowActionEconomyV2,
  validateTowActionEconomyV2,
} from "./action-economy-v2.js";
import {
  TOW_ABILITY_CATALOG_V2_CHECKSUM,
} from "./ability-catalog-v2.js";
import {
  TOW_ABILITY_RULESET_V2_ID,
  TOW_ABILITY_RULES_V2_VERSION,
  ABILITY_V2_REACTION_WINDOWS,
} from "./ability-rules-v2.js";
import {
  TOW_DAMAGE_POLICY_V2,
  TOW_DAMAGE_POLICY_V2_CHECKSUM,
} from "./damage-v2.js";
import {
  TOW_AI_POLICY_REGISTRY_V2_CHECKSUM,
  TOW_AI_POLICY_REGISTRY_V2_VERSION,
  getTowAiPolicyV2,
  isTowAiIntentV2,
} from "./ai-v2.js";
import {
  isTowActorV2,
} from "./actor-v2.js";
import {
  FORMATION_CELLS,
  MOVING_FORMATION_RULES_VERSION,
} from "./formation.js";
import {
  TOW_STATUS_BEHAVIOR_POLICY_V2,
  TOW_STATUS_POLICY_V2_CHECKSUM,
  TOW_STATUS_RUNTIME_V2_VERSION,
  createTowStatusRuntimeV2,
  validateTowStatusRuntimeV2,
} from "./status-runtime-v2.js";
import {
  TOW_TARGET_LOCK_V2_VERSION,
  isAbilityTargetLockV2,
} from "./targeting-v2.js";
import {
  TOW_ZONE_RUNTIME_POLICY_V2,
  TOW_ZONE_RUNTIME_V2_VERSION,
  createTowZoneStateV2,
  validateTowZoneStateV2,
} from "./zones-v2.js";

export const PINNED_TOW_ABILITY_CATALOG_V2_CHECKSUM = "fnv1a32:8a8adfc6";
export const TOW_ENCOUNTER_POLICY_V2_ID = "solitaire-tow-v2-encounter-policy-v1";
export const TOW_ENCOUNTER_SCHEDULER_V2_VERSION = 1;

if (TOW_ABILITY_CATALOG_V2_CHECKSUM !== PINNED_TOW_ABILITY_CATALOG_V2_CHECKSUM) {
  throw new TypeError("tow-v2-catalog-checksum-drift");
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export const TOW_ENCOUNTER_EXECUTION_POLICY_V2 = deepFreeze({
  version: TOW_ABILITY_RULES_V2_VERSION,
  rulesetId: TOW_ABILITY_RULESET_V2_ID,
  reducerVersion: 1,
  abilityOrder: "authored-effect-major-snapshot-recipient-row-major",
  allCombatantsOrder: "caster-side-row-major-then-opposing-side-row-major",
  targetCommit: "lock-and-snapshot-before-economy-spend",
  transactionFailure: "no-state-change",
  randomDraws: {
    source: "command",
    order: "before-reactions-then-hostile-effect-major-recipient-row-major-then-after-reactions",
    deadSnapshotRecipient: "consume-packet-draws-then-skip",
    reactionReservation: "snapshot-cardinality-consumed-on-trigger-or-fizzle",
    blockedAction: "validate-vector-before-control-then-consume-zero",
  },
  movement: {
    geometry: "committed-source-and-recipient",
    ticks: "after-each-successful-step-before-next-step",
    lethalEnter: "stop-remaining-steps",
  },
  scheduler: {
    order: "speed-desc-player-before-enemy-roster-order",
    snapshot: "living-fielded-at-round-start",
    cursor: "advance-on-priority-open-or-authorized-skip",
    prioritiesPerScheduledActor: 1,
    roundEnd: "only-after-no-living-scheduled-actor-remains",
  },
  turnStart: [
    "pre-existing-source-status-boundary",
    "pre-existing-recipient-status-boundary",
    "zone-turn-start",
    "defeat-and-control-adjudication",
    "open-economy-priority-if-living",
  ],
  turnEnd: [
    "close-economy-priority",
    "pre-existing-recipient-status-boundary",
    "pre-existing-source-status-boundary",
    "zone-turn-end",
  ],
  terminal: "absorbing-entire-roster-side-defeated",
  reactions: {
    arm: "atomic-economy-target-lock-and-monotonic-sequence",
    snapshot: "matching-arms-at-hostile-action-commit",
    order: "armed-sequence-then-owner-roster",
    windows: [...ABILITY_V2_REACTION_WINDOWS],
    nested: "never",
    consumption: "trigger-or-fizzle-once-no-refund",
    fizzle: "owner-not-fielded-or-lost-unit-lock",
    unusedExpiry: "owner-priority-open-only",
  },
  ai: {
    registryChecksum: TOW_AI_POLICY_REGISTRY_V2_CHECKSUM,
    registryVersion: TOW_AI_POLICY_REGISTRY_V2_VERSION,
    intent: "rank-pinned-durable-target-lock",
    sequence: "global-monotonic-declaration-order",
    invalidation: "explicit-event-then-fresh-lock-no-retarget",
    step: "one-replay-command-per-scheduler-declaration-redeclaration-execution-or-end-transition",
  },
});

export const TOW_ENCOUNTER_POLICY_V2 = deepFreeze({
  id: TOW_ENCOUNTER_POLICY_V2_ID,
  catalogue: {
    checksum: PINNED_TOW_ABILITY_CATALOG_V2_CHECKSUM,
    unknownAbility: "reject",
    rankSource: "explicit-actor-loadout",
  },
  formation: {
    rulesVersion: MOVING_FORMATION_RULES_VERSION,
    genesisPlacement: "roster-order-preferred-row-nearest-row-lower-tie",
    occupantIdentity: "exact-roster",
  },
  actionEconomy: TOW_ACTION_ECONOMY_POLICY_V2,
  execution: TOW_ENCOUNTER_EXECUTION_POLICY_V2,
  damage: {
    policyChecksum: TOW_DAMAGE_POLICY_V2_CHECKSUM,
    policy: TOW_DAMAGE_POLICY_V2,
  },
  targeting: {
    lockVersion: TOW_TARGET_LOCK_V2_VERSION,
    reactionLockAtomicity: "iff-armed-reaction",
  },
  statuses: {
    runtimeVersion: TOW_STATUS_RUNTIME_V2_VERSION,
    policyChecksum: TOW_STATUS_POLICY_V2_CHECKSUM,
    behaviorPolicy: TOW_STATUS_BEHAVIOR_POLICY_V2,
  },
  zones: {
    runtimeVersion: TOW_ZONE_RUNTIME_V2_VERSION,
    runtimePolicy: TOW_ZONE_RUNTIME_POLICY_V2,
  },
  ai: {
    registryVersion: TOW_AI_POLICY_REGISTRY_V2_VERSION,
    registryChecksum: TOW_AI_POLICY_REGISTRY_V2_CHECKSUM,
    profileSource: "explicit-actor-ai-profile",
    intentPersistence: "actor-keyed-rank-lock-sequence-policy",
  },
});

const STATE_KEYS = Object.freeze([
  "actors",
  "aiPolicyChecksum",
  "catalogChecksum",
  "economy",
  "formations",
  "intents",
  "intentSequence",
  "policy",
  "reactionLocks",
  "reactionSequence",
  "rosters",
  "rulesetId",
  "scheduler",
  "statuses",
  "version",
  "zones",
].sort());
const ROSTER_KEYS = Object.freeze(["enemy", "player"].sort());
const FORMATION_KEYS = Object.freeze(["enemy", "player", "version"].sort());
const GENESIS_KEYS = Object.freeze([
  "aiPolicyChecksum",
  "actors",
  "catalogChecksum",
  "policyId",
  "resolveSeeds",
  "rosters",
].sort());
const RESOLVE_SEED_KEYS = Object.freeze(["id", "maxResolve", "resolve"].sort());
const SCHEDULER_KEYS = Object.freeze([
  "cursor",
  "order",
  "priorityActorIds",
  "round",
  "skippedActorIds",
  "turnBase",
  "version",
].sort());
const REACTION_LOCK_RECEIPT_KEYS = Object.freeze(["armedSequence", "targetLock"].sort());

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === expected.length
    && keys.every((key, index) => key === expected[index]);
}

function actorIdentifier(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 256;
}

function nonNegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function compareIdentifiers(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalObjectKeys(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  const canonical = Object.keys(Object.fromEntries(
    [...keys].sort(compareIdentifiers).map((key) => [key, true]),
  ));
  return keys.length === canonical.length
    && keys.every((key, index) => key === canonical[index]);
}

function cloneData(value) {
  if (Array.isArray(value)) return value.map(cloneData);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneData(child)]));
  }
  return value;
}

function sameData(left, right) {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((entry, index) => sameData(entry, right[index]));
  }
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => (
      key === rightKeys[index] && sameData(left[key], right[key])
    ));
}

function sameIdSet(left, right) {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort(compareIdentifiers);
  const sortedRight = [...right].sort(compareIdentifiers);
  return sortedLeft.every((id, index) => id === sortedRight[index]);
}

function rosterReason(rosters) {
  if (!exactKeys(rosters, ROSTER_KEYS)) return "invalid-encounter-v2-rosters";
  for (const side of ["player", "enemy"]) {
    const ids = rosters[side];
    if (!Array.isArray(ids)
      || ids.length < 1
      || ids.length > FORMATION_CELLS.length
      || ids.some((id) => !actorIdentifier(id))
      || new Set(ids).size !== ids.length) return "invalid-encounter-v2-rosters";
  }
  if (rosters.player.some((id) => rosters.enemy.includes(id))) {
    return "invalid-encounter-v2-rosters";
  }
  return null;
}

function actorMapReason(actors, rosters) {
  if (!actors || typeof actors !== "object" || Array.isArray(actors)
    || !canonicalObjectKeys(actors)) return "invalid-encounter-v2-actors";
  const rosterIds = [...rosters.player, ...rosters.enemy];
  if (!sameIdSet(Object.keys(actors), rosterIds)) return "encounter-v2-actor-roster-mismatch";
  for (const [id, actor] of Object.entries(actors)) {
    if (actor.id !== id || !isTowActorV2(actor)) return "invalid-encounter-v2-actor";
    const expectedSide = rosters.player.includes(id) ? "player" : "enemy";
    if (actor.side !== expectedSide) return "encounter-v2-actor-side-mismatch";
  }
  return null;
}

function formationReason(formations, rosters, actors) {
  if (!exactKeys(formations, FORMATION_KEYS)
    || formations.version !== MOVING_FORMATION_RULES_VERSION) {
    return "invalid-encounter-v2-formations";
  }
  for (const side of ["player", "enemy"]) {
    const formation = formations[side];
    if (!Array.isArray(formation) || formation.length !== FORMATION_CELLS.length) {
      return "invalid-encounter-v2-formations";
    }
    const occupants = formation.filter((id) => id !== null);
    const livingRoster = rosters[side].filter((id) => actors[id].hp > 0);
    if (occupants.some((id) => !actorIdentifier(id))
      || new Set(occupants).size !== occupants.length
      || !sameIdSet(occupants, livingRoster)) {
      return "encounter-v2-formation-roster-mismatch";
    }
  }
  return null;
}

function loadoutRanks(actor) {
  return Object.fromEntries(actor.loadout.map(({ id, rank }) => [id, rank]));
}

function economyReason(economy, actors) {
  const validation = validateTowActionEconomyV2(economy);
  if (!validation.ok) return "invalid-encounter-v2-economy";
  const actorIds = Object.keys(actors);
  if (!sameIdSet(Object.keys(economy.actors), actorIds)) {
    return "encounter-v2-economy-actor-mismatch";
  }
  for (const id of actorIds) {
    if (!sameData(economy.actors[id].abilityRanks, loadoutRanks(actors[id]))) {
      return "encounter-v2-economy-loadout-mismatch";
    }
  }
  if (economy.activeActorId !== null && actors[economy.activeActorId].hp <= 0) {
    return "encounter-v2-defeated-active-actor";
  }
  return null;
}

function statusesReason(statuses, actors) {
  const validation = validateTowStatusRuntimeV2(statuses);
  if (!validation.ok) return "invalid-encounter-v2-statuses";
  return sameIdSet(Object.keys(statuses.actors), Object.keys(actors))
    ? null
    : "encounter-v2-status-actor-mismatch";
}

function zonesReason(zones, actors) {
  const validation = validateTowZoneStateV2(zones);
  if (!validation.ok) return "invalid-encounter-v2-zones";
  for (const zone of zones.zones) {
    const owner = actors[zone.ownerActorId];
    if (!owner || owner.side !== zone.ownerSide) {
      return "encounter-v2-zone-owner-mismatch";
    }
  }
  return null;
}

function schedulerActorOrder(leftId, rightId, actors, rosters) {
  const left = actors[leftId];
  const right = actors[rightId];
  const speed = right.stats.speed - left.stats.speed;
  if (speed !== 0) return speed;
  const side = (left.side === "player" ? 0 : 1) - (right.side === "player" ? 0 : 1);
  if (side !== 0) return side;
  const roster = rosters[left.side].indexOf(leftId) - rosters[right.side].indexOf(rightId);
  return roster || compareIdentifiers(leftId, rightId);
}

function schedulerReason(scheduler, economy, actors, rosters) {
  if (!exactKeys(scheduler, SCHEDULER_KEYS)
    || scheduler.version !== TOW_ENCOUNTER_SCHEDULER_V2_VERSION
    || !nonNegativeSafeInteger(scheduler.round)
    || scheduler.round !== economy.round
    || !Array.isArray(scheduler.order)
    || scheduler.order.some((id) => !actorIdentifier(id) || !Object.hasOwn(actors, id))
    || new Set(scheduler.order).size !== scheduler.order.length
    || !Array.isArray(scheduler.priorityActorIds)
    || scheduler.priorityActorIds.some((id) => (
      !actorIdentifier(id) || !scheduler.order.includes(id)
    ))
    || new Set(scheduler.priorityActorIds).size !== scheduler.priorityActorIds.length
    || !Array.isArray(scheduler.skippedActorIds)
    || scheduler.skippedActorIds.some((id) => (
      !actorIdentifier(id) || !scheduler.order.includes(id)
    ))
    || new Set(scheduler.skippedActorIds).size !== scheduler.skippedActorIds.length
    || scheduler.skippedActorIds.some((id) => scheduler.priorityActorIds.includes(id))
    || !nonNegativeSafeInteger(scheduler.turnBase)
    || scheduler.turnBase > economy.turn
    || !nonNegativeSafeInteger(scheduler.cursor)
    || scheduler.cursor > scheduler.order.length) {
    return "invalid-encounter-v2-scheduler";
  }
  const canonical = [...scheduler.order].sort((left, right) => (
    schedulerActorOrder(left, right, actors, rosters)
  ));
  if (canonical.some((id, index) => id !== scheduler.order[index])) {
    return "noncanonical-encounter-v2-schedule";
  }
  if (economy.round === 0) {
    return scheduler.order.length === 0
      && scheduler.priorityActorIds.length === 0
      && scheduler.skippedActorIds.length === 0
      && scheduler.turnBase === 0
      && scheduler.cursor === 0
      ? null
      : "invalid-encounter-v2-scheduler";
  }
  if (economy.turn !== scheduler.turnBase + scheduler.priorityActorIds.length) {
    return "encounter-v2-schedule-turn-mismatch";
  }
  const priorityIndexes = scheduler.priorityActorIds.map((id) => scheduler.order.indexOf(id));
  if (priorityIndexes.some((index, position) => (
    index >= scheduler.cursor
      || (position > 0 && priorityIndexes[position - 1] >= index)
  ))) return "noncanonical-encounter-v2-schedule-priorities";
  const skippedIndexes = scheduler.skippedActorIds.map((id) => scheduler.order.indexOf(id));
  if (skippedIndexes.some((index, position) => (
    index >= scheduler.cursor
      || (position > 0 && skippedIndexes[position - 1] >= index)
  ))) return "noncanonical-encounter-v2-schedule-skips";
  for (let index = 0; index < scheduler.cursor; index += 1) {
    const actorId = scheduler.order[index];
    const dispositionCount = Number(scheduler.priorityActorIds.includes(actorId))
      + Number(scheduler.skippedActorIds.includes(actorId));
    if (dispositionCount !== 1) {
      return "encounter-v2-schedule-prefix-mismatch";
    }
  }
  const livingActorIds = Object.keys(actors).filter((id) => actors[id].hp > 0);
  if (livingActorIds.some((id) => !scheduler.order.includes(id))) {
    return "encounter-v2-schedule-actor-mismatch";
  }
  if (economy.phase === "between-rounds" && scheduler.cursor !== scheduler.order.length) {
    return "encounter-v2-schedule-incomplete";
  }
  if (economy.phase === "actor-turn"
    && (scheduler.cursor < 1
      || scheduler.order[scheduler.cursor - 1] !== economy.activeActorId
      || scheduler.priorityActorIds.at(-1) !== economy.activeActorId)) {
    return "encounter-v2-schedule-active-actor-mismatch";
  }
  return null;
}

function reactionLocksReason(reactionLocks, reactionSequence, economy) {
  if (!reactionLocks || typeof reactionLocks !== "object" || Array.isArray(reactionLocks)
    || !canonicalObjectKeys(reactionLocks)
    || !nonNegativeSafeInteger(reactionSequence)) {
    return "invalid-encounter-v2-reaction-locks";
  }
  const armedActorIds = Object.entries(economy.actors)
    .filter(([, actor]) => actor.armedReaction !== null)
    .map(([id]) => id);
  if (!sameIdSet(Object.keys(reactionLocks), armedActorIds)) {
    return "encounter-v2-reaction-lock-arm-mismatch";
  }
  const armedSequences = [];
  for (const actorId of armedActorIds) {
    const arm = economy.actors[actorId].armedReaction;
    const receipt = reactionLocks[actorId];
    const lock = receipt?.targetLock;
    if (!exactKeys(receipt, REACTION_LOCK_RECEIPT_KEYS)
      || !Number.isSafeInteger(receipt.armedSequence)
      || receipt.armedSequence < 1
      || receipt.armedSequence > reactionSequence
      || !isAbilityTargetLockV2(lock)
      || lock.casterId !== actorId
      || lock.abilityId !== arm.abilityId
      || lock.rank !== arm.rank
      || lock.anchor.tracking !== "unit"
      || lock.anchor.actorId !== arm.watchedActorId) {
      return "encounter-v2-reaction-lock-arm-mismatch";
    }
    armedSequences.push(receipt.armedSequence);
  }
  if (new Set(armedSequences).size !== armedSequences.length) {
    return "encounter-v2-reaction-sequence-collision";
  }
  return null;
}

function intentsReason(intents, intentSequence, actors) {
  if (!intents || typeof intents !== "object" || Array.isArray(intents)
    || !canonicalObjectKeys(intents)
    || !nonNegativeSafeInteger(intentSequence)) return "invalid-encounter-v2-intents";
  const sequences = [];
  for (const [actorId, intent] of Object.entries(intents)) {
    const actor = actors[actorId];
    const policy = actor?.aiProfile === null || actor?.aiProfile === undefined
      ? null
      : getTowAiPolicyV2(actor.aiProfile.id, actor.aiProfile.version);
    const loadout = actor?.loadout.find(({ id }) => id === intent?.abilityId);
    if (!actor || actor.controller !== "ai" || actor.hp <= 0
      || !policy || !isTowAiIntentV2(intent)
      || intent.policyId !== policy.policyId
      || intent.targetLock.casterId !== actorId
      || !loadout || loadout.rank !== intent.rank
      || intent.declaredSequence > intentSequence) {
      return "encounter-v2-intent-authority-mismatch";
    }
    sequences.push(intent.declaredSequence);
  }
  if (new Set(sequences).size !== sequences.length) {
    return "encounter-v2-intent-sequence-collision";
  }
  return null;
}

function stateReason(value) {
  if (!exactKeys(value, STATE_KEYS)) return "invalid-encounter-state-v2-shape";
  if (value.version !== TOW_ABILITY_RULES_V2_VERSION
    || value.rulesetId !== TOW_ABILITY_RULESET_V2_ID) {
    return "invalid-encounter-state-v2-ruleset";
  }
  if (value.catalogChecksum !== PINNED_TOW_ABILITY_CATALOG_V2_CHECKSUM) {
    return "invalid-encounter-state-v2-catalog-checksum";
  }
  if (value.aiPolicyChecksum !== TOW_AI_POLICY_REGISTRY_V2_CHECKSUM) {
    return "invalid-encounter-state-v2-ai-policy-checksum";
  }
  if (!sameData(value.policy, TOW_ENCOUNTER_POLICY_V2)) {
    return "invalid-encounter-state-v2-policy";
  }
  const roster = rosterReason(value.rosters);
  if (roster) return roster;
  const actors = actorMapReason(value.actors, value.rosters);
  if (actors) return actors;
  if (Object.values(value.actors).some((actor) => actor.controller === "ai"
    && getTowAiPolicyV2(actor.aiProfile.id, actor.aiProfile.version) === null)) {
    return "invalid-encounter-v2-ai-profile";
  }
  const formations = formationReason(value.formations, value.rosters, value.actors);
  if (formations) return formations;
  const economy = economyReason(value.economy, value.actors);
  if (economy) return economy;
  const scheduler = schedulerReason(
    value.scheduler,
    value.economy,
    value.actors,
    value.rosters,
  );
  if (scheduler) return scheduler;
  const statuses = statusesReason(value.statuses, value.actors);
  if (statuses) return statuses;
  const zones = zonesReason(value.zones, value.actors);
  if (zones) return zones;
  const reactions = reactionLocksReason(
    value.reactionLocks,
    value.reactionSequence,
    value.economy,
  );
  if (reactions) return reactions;
  return intentsReason(value.intents, value.intentSequence, value.actors);
}

function result(ok, reason, state = null) {
  return deepFreeze({ ok, reason, state });
}

export function validateTowEncounterStateV2(value) {
  const reason = stateReason(value);
  return Object.freeze({ ok: reason === null, reason });
}

export function isTowEncounterStateV2(value) {
  return validateTowEncounterStateV2(value).ok;
}

/** Snapshot the sole deterministic owner-priority order for a new round. */
export function towEncounterRoundOrderV2(value) {
  const validation = validateTowEncounterStateV2(value);
  if (!validation.ok) throw new TypeError(validation.reason);
  return deepFreeze(
    [...value.rosters.player, ...value.rosters.enemy]
      .filter((id) => value.actors[id].hp > 0)
      .sort((left, right) => schedulerActorOrder(left, right, value.actors, value.rosters)),
  );
}

/** Validate, detach, and deeply freeze a decoded composite state. */
export function defineTowEncounterStateV2(value) {
  const validation = validateTowEncounterStateV2(value);
  if (!validation.ok) throw new TypeError(validation.reason);
  return deepFreeze(cloneData(value));
}

function preferredFormation(roster, actors) {
  const cells = Array(FORMATION_CELLS.length).fill(null);
  for (const id of roster) {
    const preferred = actors[id].preferredRow;
    const rows = [0, 1, 2].sort((left, right) => (
      Math.abs(left - preferred) - Math.abs(right - preferred) || left - right
    ));
    const index = rows.flatMap((row) => [0, 1, 2].map((column) => row * 3 + column))
      .find((candidate) => cells[candidate] === null);
    if (index === undefined) throw new TypeError("encounter-v2-formation-full");
    cells[index] = id;
  }
  return cells;
}

function genesisActors(inputActors, rosters) {
  if (!Array.isArray(inputActors) || inputActors.length === 0) return null;
  const entries = inputActors.map((actor) => [actor?.id, actor]);
  if (entries.some(([id, actor]) => !actorIdentifier(id) || !isTowActorV2(actor))
    || new Set(entries.map(([id]) => id)).size !== entries.length) return null;
  const actors = Object.fromEntries(entries.sort(([left], [right]) => (
    compareIdentifiers(left, right)
  )));
  return actorMapReason(actors, rosters) === null ? actors : null;
}

function genesisResolveSeeds(seeds, actors) {
  if (!Array.isArray(seeds) || seeds.length !== Object.keys(actors).length) return null;
  const entries = [];
  for (const seed of seeds) {
    if (!exactKeys(seed, RESOLVE_SEED_KEYS)
      || !actorIdentifier(seed.id)
      || !Object.hasOwn(actors, seed.id)
      || !nonNegativeSafeInteger(seed.maxResolve)
      || !nonNegativeSafeInteger(seed.resolve)
      || seed.resolve > seed.maxResolve) return null;
    entries.push([seed.id, seed]);
  }
  if (new Set(entries.map(([id]) => id)).size !== entries.length) return null;
  return Object.fromEntries(entries.sort(([left], [right]) => compareIdentifiers(left, right)));
}

/** Create the canonical, command-free v2 encounter genesis snapshot. */
export function createTowEncounterGenesisV2(input) {
  if (!exactKeys(input, GENESIS_KEYS)) {
    return result(false, "invalid-encounter-genesis-v2-input");
  }
  if (input.catalogChecksum !== PINNED_TOW_ABILITY_CATALOG_V2_CHECKSUM) {
    return result(false, "invalid-encounter-genesis-v2-catalog-checksum");
  }
  if (input.aiPolicyChecksum !== TOW_AI_POLICY_REGISTRY_V2_CHECKSUM) {
    return result(false, "invalid-encounter-genesis-v2-ai-policy-checksum");
  }
  if (input.policyId !== TOW_ENCOUNTER_POLICY_V2_ID) {
    return result(false, "invalid-encounter-genesis-v2-policy");
  }
  const roster = rosterReason(input.rosters);
  if (roster) return result(false, roster);
  const actors = genesisActors(input.actors, input.rosters);
  if (!actors) return result(false, "invalid-encounter-genesis-v2-actors");
  if (Object.values(actors).some((actor) => actor.controller === "ai"
    && getTowAiPolicyV2(actor.aiProfile.id, actor.aiProfile.version) === null)) {
    return result(false, "invalid-encounter-genesis-v2-ai-profile");
  }
  if (Object.values(actors).some((actor) => actor.hp <= 0)) {
    return result(false, "invalid-encounter-genesis-v2-defeated-actor");
  }
  const resolveSeeds = genesisResolveSeeds(input.resolveSeeds, actors);
  if (!resolveSeeds) return result(false, "invalid-encounter-genesis-v2-resolve-seeds");

  const actorIds = Object.keys(actors);
  const economy = createTowActionEconomyV2({
    actors: actorIds.map((id) => ({
      id,
      resolve: resolveSeeds[id].resolve,
      maxResolve: resolveSeeds[id].maxResolve,
      abilities: actors[id].loadout.map((ability) => ({ ...ability })),
    })),
  });
  if (!economy.ok) return result(false, economy.reason);
  const statuses = createTowStatusRuntimeV2({ actorIds });
  if (!statuses.ok) return result(false, statuses.reason);
  const zones = createTowZoneStateV2({ zones: [] });
  if (!zones.ok) return result(false, zones.reason);

  const state = {
    version: TOW_ABILITY_RULES_V2_VERSION,
    rulesetId: TOW_ABILITY_RULESET_V2_ID,
    catalogChecksum: PINNED_TOW_ABILITY_CATALOG_V2_CHECKSUM,
    aiPolicyChecksum: TOW_AI_POLICY_REGISTRY_V2_CHECKSUM,
    policy: cloneData(TOW_ENCOUNTER_POLICY_V2),
    rosters: {
      player: [...input.rosters.player],
      enemy: [...input.rosters.enemy],
    },
    actors: cloneData(actors),
    formations: {
      version: MOVING_FORMATION_RULES_VERSION,
      player: preferredFormation(input.rosters.player, actors),
      enemy: preferredFormation(input.rosters.enemy, actors),
    },
    economy: cloneData(economy.state),
    scheduler: {
      version: TOW_ENCOUNTER_SCHEDULER_V2_VERSION,
      round: 0,
      order: [],
      cursor: 0,
      priorityActorIds: [],
      skippedActorIds: [],
      turnBase: 0,
    },
    statuses: cloneData(statuses.state),
    zones: cloneData(zones.state),
    reactionLocks: {},
    reactionSequence: 0,
    intents: {},
    intentSequence: 0,
  };
  const validation = validateTowEncounterStateV2(state);
  return validation.ok
    ? result(true, null, deepFreeze(cloneData(state)))
    : result(false, validation.reason);
}
