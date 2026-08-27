// Executable status authority for the opt-in solitaire-combat-v2 ruleset.
//
// This module deliberately imports only v2 contracts. Status names are never parsed and
// no legacy mechanics are consulted: each of the thirty catalogue statuses has one exact
// policy row and one registered resolver. The runtime owns canonical stacking, provenance,
// lifecycle clocks, event-spent stacks, and reducer-facing intents; HP mutations remain the
// responsibility of damage-v2.js.

import {
  ABILITY_V2_ACTION_LANES,
  COMBAT_ABILITY_RULESET_V2_ID,
  COMBAT_ABILITY_RULES_V2_VERSION,
} from "./ability-rules-v2.js";
import {
  COMBAT_ABILITY_STATUS_LIST_V2,
  COMBAT_ABILITY_STATUSES_V2,
} from "./ability-catalog-v2.js";
import { defineStatusRuntimeResolversV2 } from "./status-rules-v2.js";

export const COMBAT_STATUS_RUNTIME_V2_VERSION = 1;
export const COMBAT_STATUS_BOUNDARIES_V2 = Object.freeze([
  "round-start",
  "round-end",
  "source-turn-start",
  "source-turn-end",
  "recipient-turn-start",
  "recipient-turn-end",
  "combat-end",
]);

const STATE_KEYS = Object.freeze([
  "actors",
  "nextApplicationSequence",
  "rulesetId",
  "runtimeVersion",
  "version",
].sort());
const RECORD_KEYS = Object.freeze([
  "applicationSequence",
  "durationRemaining",
  "id",
  "magnitude",
  "sourceActorId",
].sort());
const CREATE_KEYS = Object.freeze(["actorIds"]);
const MUTATION_KEYS = Object.freeze([
  "actorId",
  "operation",
  "sourceActorId",
  "statusId",
  "value",
].sort());
const BOUNDARY_KEYS = Object.freeze(["actorId", "boundary"].sort());
const ACTION_GATE_KEYS = Object.freeze(["actorId", "lane"].sort());
const FORCED_TARGET_KEYS = Object.freeze(["actorId", "validActorIds"].sort());
const MOVEMENT_KEYS = Object.freeze(["actorId", "requestedCells"].sort());
const DIRECT_HIT_KEYS = Object.freeze([
  "attackerActorId",
  "defenderActorId",
  "landed",
].sort());
const RESOLVER_CONTEXT_KEYS = Object.freeze([
  "boundary",
  "holderActorId",
  "record",
].sort());

const STATUS_MUTATIONS_V2 = Object.freeze([
  "add",
  "clear",
  "retain-percent",
  "scale",
  "subtract",
]);
const ACTOR_BOUNDARIES = new Set([
  "source-turn-start",
  "source-turn-end",
  "recipient-turn-start",
  "recipient-turn-end",
]);
const GLOBAL_BOUNDARIES = new Set(["round-start", "round-end", "combat-end"]);

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

function actorIdentifier(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 256;
}

function compareIdentifiers(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalObjectKeys(value) {
  const keys = Object.keys(value);
  const canonical = Object.keys(Object.fromEntries(
    [...keys].sort(compareIdentifiers).map((key) => [key, true]),
  ));
  return keys.length === canonical.length
    && keys.every((key, index) => key === canonical[index]);
}

function compareRecords(left, right) {
  const id = compareIdentifiers(left.id, right.id);
  if (id !== 0) return id;
  const source = compareIdentifiers(left.sourceActorId ?? "", right.sourceActorId ?? "");
  return source !== 0 ? source : left.applicationSequence - right.applicationSequence;
}

function clampedAdd(left, right, cap) {
  return right >= cap - left ? cap : left + right;
}

function cloneRecord(record) {
  return {
    id: record.id,
    magnitude: record.magnitude,
    sourceActorId: record.sourceActorId,
    durationRemaining: record.durationRemaining,
    applicationSequence: record.applicationSequence,
  };
}

function cloneState(state) {
  return {
    version: state.version,
    rulesetId: state.rulesetId,
    runtimeVersion: state.runtimeVersion,
    nextApplicationSequence: state.nextApplicationSequence,
    actors: Object.fromEntries(Object.entries(state.actors).map(([actorId, records]) => [
      actorId,
      records.map(cloneRecord),
    ])),
  };
}

function immutableState(state) {
  return deepFreeze(cloneState(state));
}

function result(ok, reason, state, event = null, intents = []) {
  return deepFreeze({ ok, reason, state, event, intents });
}

function success(state, event = null, intents = []) {
  return result(true, null, state, event, intents);
}

function failure(reason, state = null) {
  return result(false, reason, state, null, []);
}

function policy(overrides = {}) {
  return {
    actionLockLanes: [],
    afterDirectHit: { applyStatus: null, consumeAttacker: "none", consumeDefender: 0 },
    attackDeltaPerMagnitude: 0,
    avoidanceBonusBps: 0,
    behavior: null,
    boundaryEffect: null,
    criticalChanceBpsPerMagnitude: 0,
    defenseDeltaPerMagnitude: 0,
    directFlatReductionPerMagnitude: 0,
    directReductionBps: 0,
    forcedTarget: false,
    lifestealBpsPerMagnitude: 0,
    movement: { magnitudePerCell: 0, mode: "none" },
    redirectBps: 0,
    reflectionPerMagnitude: 0,
    resourceThreshold: 0,
    summonRole: null,
    ...overrides,
  };
}

// Magnitudes are already resolved by the ability executor (for example, a 50% DEF status
// effect arrives here as its integer magnitude). Fixed percentage mechanics use basis
// points. Every row has a concrete runtime role; an unregistered status cannot execute.
export const COMBAT_STATUS_BEHAVIOR_POLICY_V2 = deepFreeze({
  "blade-dance-parry": policy({
    behavior: "stat-modifier",
    directFlatReductionPerMagnitude: 1,
  }),
  bleed: policy({ behavior: "periodic-damage", boundaryEffect: "periodic-damage" }),
  "bone-shield": policy({
    behavior: "damage-redirect",
    redirectBps: 6_000,
    afterDirectHit: { applyStatus: null, consumeAttacker: "none", consumeDefender: 1 },
  }),
  burn: policy({
    behavior: "periodic-damage",
    boundaryEffect: "periodic-damage",
    afterDirectHit: { applyStatus: null, consumeAttacker: "none", consumeDefender: 1 },
  }),
  challenged: policy({ behavior: "forced-target", forcedTarget: true }),
  cripple: policy({ behavior: "stat-modifier", attackDeltaPerMagnitude: -1 }),
  doom: policy({ behavior: "periodic-damage", boundaryEffect: "periodic-damage" }),
  "delayed-lethargy": policy({ behavior: "stat-modifier", attackDeltaPerMagnitude: -1 }),
  evade: policy({ behavior: "avoidance", avoidanceBonusBps: 6_000 }),
  haste: policy({
    behavior: "resource-counter",
    boundaryEffect: "quick-budget",
    resourceThreshold: 1,
  }),
  initiative: policy({
    behavior: "resource-counter",
    boundaryEffect: "initiative-conversion",
    resourceThreshold: 100,
  }),
  injured: policy({ behavior: "stat-modifier", defenseDeltaPerMagnitude: -1 }),
  judgment: policy({
    behavior: "resource-counter",
    afterDirectHit: { applyStatus: "doom", consumeAttacker: "all", consumeDefender: 0 },
  }),
  lethargy: policy({ behavior: "stat-modifier", attackDeltaPerMagnitude: -1 }),
  lifesteal: policy({ behavior: "stat-modifier", lifestealBpsPerMagnitude: 100 }),
  limp: policy({
    behavior: "stat-modifier",
    movement: { magnitudePerCell: 20, mode: "reduce" },
  }),
  "mirror-image": policy({
    behavior: "avoidance",
    avoidanceBonusBps: 3_300,
    afterDirectHit: { applyStatus: null, consumeAttacker: "none", consumeDefender: 1 },
  }),
  paralyze: policy({ behavior: "action-lock", actionLockLanes: [...ABILITY_V2_ACTION_LANES] }),
  parry: policy({ behavior: "stat-modifier", directFlatReductionPerMagnitude: 1 }),
  poison: policy({ behavior: "periodic-damage", boundaryEffect: "periodic-damage" }),
  predator: policy({ behavior: "stat-modifier", lifestealBpsPerMagnitude: 100 }),
  protection: policy({
    behavior: "stat-modifier",
    directFlatReductionPerMagnitude: 1,
    afterDirectHit: { applyStatus: null, consumeAttacker: "none", consumeDefender: 1 },
  }),
  restraint: policy({
    behavior: "stat-modifier",
    movement: { magnitudePerCell: 0, mode: "block" },
  }),
  sharpen: policy({ behavior: "stat-modifier", criticalChanceBpsPerMagnitude: 100 }),
  skeleton: policy({
    behavior: "summon-counter",
    directFlatReductionPerMagnitude: 1,
    afterDirectHit: { applyStatus: null, consumeAttacker: "none", consumeDefender: 1 },
    summonRole: "direct-hit-interceptor",
  }),
  solidity: policy({
    behavior: "stat-modifier",
    directReductionBps: 3_000,
    afterDirectHit: { applyStatus: null, consumeAttacker: "none", consumeDefender: 1 },
  }),
  strength: policy({ behavior: "stat-modifier", attackDeltaPerMagnitude: 1 }),
  stun: policy({ behavior: "action-lock", actionLockLanes: [...ABILITY_V2_ACTION_LANES] }),
  tenacity: policy({ behavior: "stat-modifier", defenseDeltaPerMagnitude: 1 }),
  thorn: policy({ behavior: "marker", reflectionPerMagnitude: 1 }),
});

const POLICY_IDS = Object.keys(COMBAT_STATUS_BEHAVIOR_POLICY_V2).sort(compareIdentifiers);
const REGISTRY_IDS = Object.keys(COMBAT_ABILITY_STATUSES_V2).sort(compareIdentifiers);
if (POLICY_IDS.length !== REGISTRY_IDS.length
  || !POLICY_IDS.every((id, index) => id === REGISTRY_IDS[index])
  || !POLICY_IDS.every((id) => (
    COMBAT_STATUS_BEHAVIOR_POLICY_V2[id].behavior === COMBAT_ABILITY_STATUSES_V2[id].behavior
  ))) {
  throw new TypeError("invalid-status-behavior-policy-v2");
}

function stableSerialize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  return `{${Object.keys(value).sort(compareIdentifiers).map(
    (key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`,
  ).join(",")}}`;
}

function fnv1a32(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function calculateCombatStatusPolicyV2Checksum() {
  return `fnv1a32:${fnv1a32(stableSerialize({
    rulesetId: COMBAT_ABILITY_RULESET_V2_ID,
    version: COMBAT_ABILITY_RULES_V2_VERSION,
    runtimeVersion: COMBAT_STATUS_RUNTIME_V2_VERSION,
    definitions: COMBAT_ABILITY_STATUS_LIST_V2,
    policies: COMBAT_STATUS_BEHAVIOR_POLICY_V2,
  }))}`;
}

// Literal is checked by tests so policy drift requires an intentional review.
export const COMBAT_STATUS_POLICY_V2_CHECKSUM = "fnv1a32:bcab7c74";

function stateReason(value) {
  if (!exactKeys(value, STATE_KEYS)) return "invalid-status-runtime-v2-shape";
  if (value.version !== COMBAT_ABILITY_RULES_V2_VERSION
    || value.rulesetId !== COMBAT_ABILITY_RULESET_V2_ID
    || value.runtimeVersion !== COMBAT_STATUS_RUNTIME_V2_VERSION) {
    return "invalid-status-runtime-v2-version";
  }
  if (!Number.isSafeInteger(value.nextApplicationSequence)
    || value.nextApplicationSequence < 1) {
    return "invalid-status-runtime-v2-sequence";
  }
  if (!value.actors || typeof value.actors !== "object" || Array.isArray(value.actors)
    || Object.keys(value.actors).length === 0 || !canonicalObjectKeys(value.actors)) {
    return "invalid-status-runtime-v2-actors";
  }

  const sequences = new Set();
  let greatestSequence = 0;
  for (const [actorId, records] of Object.entries(value.actors)) {
    if (!actorIdentifier(actorId) || !Array.isArray(records)) {
      return "invalid-status-runtime-v2-actor";
    }
    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      if (!exactKeys(record, RECORD_KEYS)) return "invalid-status-runtime-v2-record";
      const definition = COMBAT_ABILITY_STATUSES_V2[record.id];
      if (!definition) return "unknown-status-runtime-v2-id";
      if (!Number.isSafeInteger(record.magnitude) || record.magnitude < 1
        || record.magnitude > definition.stacking.cap) {
        return "invalid-status-runtime-v2-magnitude";
      }
      if (!Number.isSafeInteger(record.applicationSequence)
        || record.applicationSequence < 1
        || sequences.has(record.applicationSequence)) {
        return "invalid-status-runtime-v2-application-sequence";
      }
      sequences.add(record.applicationSequence);
      greatestSequence = Math.max(greatestSequence, record.applicationSequence);
      if (definition.provenance === "source-actor") {
        if (!actorIdentifier(record.sourceActorId)
          || !Object.hasOwn(value.actors, record.sourceActorId)) {
          return "invalid-status-runtime-v2-provenance";
        }
      } else if (record.sourceActorId !== null) {
        return "invalid-status-runtime-v2-provenance";
      }
      if (definition.duration.count === null) {
        if (record.durationRemaining !== null) {
          return "invalid-status-runtime-v2-duration";
        }
      } else if (!Number.isSafeInteger(record.durationRemaining)
        || record.durationRemaining < 1
        || record.durationRemaining > definition.duration.count) {
        return "invalid-status-runtime-v2-duration";
      }
      if (index > 0 && compareRecords(records[index - 1], record) >= 0) {
        return "noncanonical-status-runtime-v2-order";
      }
    }
    const grouped = new Map();
    for (const record of records) {
      const definition = COMBAT_ABILITY_STATUSES_V2[record.id];
      const key = definition.stacking.policy === "unique-per-source"
        ? `${record.id}\u0000${record.sourceActorId}`
        : record.id;
      if (grouped.has(key)) return "duplicate-status-runtime-v2-record";
      grouped.set(key, record);
    }
  }
  if (value.nextApplicationSequence <= greatestSequence) {
    return "invalid-status-runtime-v2-sequence";
  }
  return null;
}

export function validateCombatStatusRuntimeV2(value) {
  const reason = stateReason(value);
  return Object.freeze({ ok: reason === null, reason });
}

export function isCombatStatusRuntimeV2(value) {
  return stateReason(value) === null;
}

export function createCombatStatusRuntimeV2(input) {
  if (!exactKeys(input, CREATE_KEYS)
    || !Array.isArray(input.actorIds)
    || input.actorIds.length === 0
    || input.actorIds.some((id) => !actorIdentifier(id))
    || new Set(input.actorIds).size !== input.actorIds.length) {
    return failure("invalid-status-runtime-v2-create-input");
  }
  const actors = Object.fromEntries(
    [...input.actorIds].sort(compareIdentifiers).map((actorId) => [actorId, []]),
  );
  return success(deepFreeze({
    version: COMBAT_ABILITY_RULES_V2_VERSION,
    rulesetId: COMBAT_ABILITY_RULESET_V2_ID,
    runtimeVersion: COMBAT_STATUS_RUNTIME_V2_VERSION,
    nextApplicationSequence: 1,
    actors,
  }));
}

function checkedState(state) {
  const reason = stateReason(state);
  return reason === null
    ? { ok: true, state: immutableState(state) }
    : { ok: false, result: failure(reason) };
}

function statusMagnitudeUnchecked(state, actorId, statusId) {
  return state.actors[actorId]
    .filter((record) => record.id === statusId)
    .reduce((total, record) => total + record.magnitude, 0);
}

export function combatStatusMagnitudeV2(state, actorId, statusId) {
  const reason = stateReason(state);
  if (reason !== null) throw new TypeError(reason);
  if (!actorIdentifier(actorId) || !Object.hasOwn(state.actors, actorId)) {
    throw new TypeError("unknown-status-runtime-v2-actor");
  }
  if (typeof statusId !== "string" || !Object.hasOwn(COMBAT_ABILITY_STATUSES_V2, statusId)) {
    throw new TypeError("unknown-status-runtime-v2-id");
  }
  return statusMagnitudeUnchecked(state, actorId, statusId);
}

function mutationReason(state, input) {
  if (!exactKeys(input, MUTATION_KEYS)
    || !actorIdentifier(input.actorId)
    || !Object.hasOwn(state.actors, input.actorId)
    || !Object.hasOwn(COMBAT_ABILITY_STATUSES_V2, input.statusId)
    || !STATUS_MUTATIONS_V2.includes(input.operation)
    || !Number.isSafeInteger(input.value) || input.value < 0) {
    return "invalid-status-runtime-v2-mutation";
  }
  const definition = COMBAT_ABILITY_STATUSES_V2[input.statusId];
  if (input.operation === "add") {
    if (definition.provenance === "source-actor") {
      if (!actorIdentifier(input.sourceActorId)
        || !Object.hasOwn(state.actors, input.sourceActorId)) {
        return "invalid-status-runtime-v2-provenance";
      }
    } else if (input.sourceActorId !== null) {
      return "invalid-status-runtime-v2-provenance";
    }
    return null;
  }
  if (input.sourceActorId !== null) return "invalid-status-runtime-v2-provenance";
  if (["retain-percent", "scale"].includes(input.operation) && input.value > 1_000_000) {
    return "invalid-status-runtime-v2-percent";
  }
  return null;
}

function replaceActorRecords(state, actorId, records, sequence = state.nextApplicationSequence) {
  return deepFreeze({
    ...cloneState(state),
    nextApplicationSequence: sequence,
    actors: {
      ...state.actors,
      [actorId]: records.map(cloneRecord).sort(compareRecords),
    },
  });
}

function mutateUnchecked(state, input) {
  const definition = COMBAT_ABILITY_STATUSES_V2[input.statusId];
  const records = state.actors[input.actorId].map(cloneRecord);
  const before = statusMagnitudeUnchecked(state, input.actorId, input.statusId);
  let nextRecords = records;
  let nextSequence = state.nextApplicationSequence;

  if (input.operation === "add" && input.value > 0) {
    const candidate = {
      id: input.statusId,
      magnitude: Math.min(definition.stacking.cap, input.value),
      sourceActorId: input.sourceActorId,
      durationRemaining: definition.duration.count,
      applicationSequence: nextSequence,
    };
    const match = records.findIndex((record) => (
      record.id === input.statusId
        && (definition.stacking.policy !== "unique-per-source"
          || record.sourceActorId === input.sourceActorId)
    ));
    if (match < 0) {
      nextRecords = [...records, candidate];
      nextSequence += 1;
    } else {
      const current = records[match];
      let replacement = current;
      if (definition.stacking.policy === "add"
        || definition.stacking.policy === "unique-per-source") {
        replacement = {
          ...current,
          magnitude: clampedAdd(current.magnitude, input.value, definition.stacking.cap),
          durationRemaining: current.durationRemaining === null
            ? null
            : Math.max(current.durationRemaining, definition.duration.count),
        };
      } else if (definition.stacking.policy === "replace") {
        replacement = candidate;
        nextSequence += 1;
      } else if (candidate.magnitude > current.magnitude) {
        replacement = candidate;
        nextSequence += 1;
      } else if (candidate.magnitude === current.magnitude
        && current.durationRemaining !== null) {
        replacement = {
          ...current,
          durationRemaining: Math.max(current.durationRemaining, candidate.durationRemaining),
        };
      }
      nextRecords = records.map((record, index) => (index === match ? replacement : record));
    }
  } else if (input.operation === "clear") {
    nextRecords = records.filter((record) => record.id !== input.statusId);
  } else if (input.operation === "subtract") {
    let remaining = input.value;
    nextRecords = records.flatMap((record) => {
      if (record.id !== input.statusId || remaining === 0) return [record];
      const spent = Math.min(record.magnitude, remaining);
      remaining -= spent;
      return record.magnitude === spent
        ? []
        : [{ ...record, magnitude: record.magnitude - spent }];
    });
  } else if (["retain-percent", "scale"].includes(input.operation)) {
    nextRecords = records.flatMap((record) => {
      if (record.id !== input.statusId) return [record];
      const magnitude = Math.min(
        definition.stacking.cap,
        Math.floor((record.magnitude * input.value) / 100),
      );
      return magnitude > 0 ? [{ ...record, magnitude }] : [];
    });
  }

  const next = replaceActorRecords(state, input.actorId, nextRecords, nextSequence);
  const after = statusMagnitudeUnchecked(next, input.actorId, input.statusId);
  return {
    state: next,
    event: deepFreeze({
      type: "status-mutated",
      actorId: input.actorId,
      statusId: input.statusId,
      operation: input.operation,
      requestedValue: input.value,
      sourceActorId: input.sourceActorId,
      before,
      after,
    }),
  };
}

export function mutateCombatStatusV2(state, input) {
  const checked = checkedState(state);
  if (!checked.ok) return checked.result;
  const reason = mutationReason(checked.state, input);
  if (reason !== null) return failure(reason, checked.state);
  const mutation = mutateUnchecked(checked.state, input);
  return success(mutation.state, mutation.event);
}

function intent(value) {
  return deepFreeze({
    type: value.type,
    actorId: value.actorId ?? null,
    sourceActorId: value.sourceActorId ?? null,
    targetActorId: value.targetActorId ?? null,
    statusId: value.statusId,
    damageKind: value.damageKind ?? null,
    lane: value.lane ?? null,
    amount: value.amount,
  });
}

function validResolverRecord(statusId, record) {
  if (!exactKeys(record, RECORD_KEYS) || record.id !== statusId) return false;
  const definition = COMBAT_ABILITY_STATUSES_V2[statusId];
  return Number.isSafeInteger(record.magnitude)
    && record.magnitude >= 1
    && record.magnitude <= definition.stacking.cap
    && Number.isSafeInteger(record.applicationSequence)
    && record.applicationSequence >= 1
    && (definition.provenance === "source-actor"
      ? actorIdentifier(record.sourceActorId)
      : record.sourceActorId === null)
    && (definition.duration.count === null
      ? record.durationRemaining === null
      : Number.isSafeInteger(record.durationRemaining)
        && record.durationRemaining >= 1
        && record.durationRemaining <= definition.duration.count);
}

function createStatusResolverV2(statusId) {
  const statusPolicy = COMBAT_STATUS_BEHAVIOR_POLICY_V2[statusId];
  return (context) => {
    if (!exactKeys(context, RESOLVER_CONTEXT_KEYS)
      || !COMBAT_STATUS_BOUNDARIES_V2.includes(context.boundary)
      || !actorIdentifier(context.holderActorId)
      || !validResolverRecord(statusId, context.record)) {
      throw new TypeError("invalid-status-resolver-v2-context");
    }
    const intents = [];
    let consumeMagnitude = 0;
    if (context.boundary === "recipient-turn-end"
      && statusPolicy.boundaryEffect === "periodic-damage") {
      intents.push(intent({
        type: "damage",
        sourceActorId: context.record.sourceActorId,
        targetActorId: context.holderActorId,
        statusId,
        damageKind: "periodic",
        amount: context.record.magnitude,
      }));
    }
    if (context.boundary === "recipient-turn-start"
      && statusPolicy.boundaryEffect === "quick-budget") {
      intents.push(intent({
        type: "budget",
        actorId: context.holderActorId,
        statusId,
        lane: "quick",
        amount: 1,
      }));
    }
    if (context.boundary === "recipient-turn-start"
      && statusPolicy.boundaryEffect === "initiative-conversion") {
      const packets = Math.floor(context.record.magnitude / statusPolicy.resourceThreshold);
      if (packets > 0) {
        consumeMagnitude = packets * statusPolicy.resourceThreshold;
        intents.push(intent({
          type: "budget",
          actorId: context.holderActorId,
          statusId,
          lane: "main",
          amount: packets,
        }));
      }
    }
    return deepFreeze({ consumeMagnitude, intents });
  };
}

export const COMBAT_STATUS_RUNTIME_RESOLVERS_V2 = defineStatusRuntimeResolversV2(
  COMBAT_ABILITY_STATUSES_V2,
  {
    "blade-dance-parry": createStatusResolverV2("blade-dance-parry"),
    bleed: createStatusResolverV2("bleed"),
    "bone-shield": createStatusResolverV2("bone-shield"),
    burn: createStatusResolverV2("burn"),
    challenged: createStatusResolverV2("challenged"),
    cripple: createStatusResolverV2("cripple"),
    "delayed-lethargy": createStatusResolverV2("delayed-lethargy"),
    doom: createStatusResolverV2("doom"),
    evade: createStatusResolverV2("evade"),
    haste: createStatusResolverV2("haste"),
    initiative: createStatusResolverV2("initiative"),
    injured: createStatusResolverV2("injured"),
    judgment: createStatusResolverV2("judgment"),
    lethargy: createStatusResolverV2("lethargy"),
    lifesteal: createStatusResolverV2("lifesteal"),
    limp: createStatusResolverV2("limp"),
    "mirror-image": createStatusResolverV2("mirror-image"),
    paralyze: createStatusResolverV2("paralyze"),
    parry: createStatusResolverV2("parry"),
    poison: createStatusResolverV2("poison"),
    predator: createStatusResolverV2("predator"),
    protection: createStatusResolverV2("protection"),
    restraint: createStatusResolverV2("restraint"),
    sharpen: createStatusResolverV2("sharpen"),
    skeleton: createStatusResolverV2("skeleton"),
    solidity: createStatusResolverV2("solidity"),
    strength: createStatusResolverV2("strength"),
    stun: createStatusResolverV2("stun"),
    tenacity: createStatusResolverV2("tenacity"),
    thorn: createStatusResolverV2("thorn"),
  },
);

function boundaryAppliesToRecord(boundary, actorId, holderActorId, record) {
  if (GLOBAL_BOUNDARIES.has(boundary)) return true;
  if (boundary.startsWith("recipient-")) return actorId === holderActorId;
  return record.sourceActorId !== null && actorId === record.sourceActorId;
}

function lifecycleBoundaryMatches(clockOrTiming, boundary, actorId, holderActorId, record) {
  if (clockOrTiming === "none" || clockOrTiming === "encounter") return false;
  return clockOrTiming === boundary
    && boundaryAppliesToRecord(boundary, actorId, holderActorId, record);
}

function shouldExpire(record, definition) {
  const atZero = ["at-zero", "at-zero-or-duration-end"].includes(definition.expiry)
    && record.magnitude <= 0;
  const durationEnd = ["duration-end", "at-zero-or-duration-end"].includes(definition.expiry)
    && record.durationRemaining !== null
    && record.durationRemaining <= 0;
  return atZero || durationEnd;
}

export function advanceCombatStatusBoundaryV2(state, input) {
  const checked = checkedState(state);
  if (!checked.ok) return checked.result;
  const current = checked.state;
  if (!exactKeys(input, BOUNDARY_KEYS)
    || !COMBAT_STATUS_BOUNDARIES_V2.includes(input.boundary)
    || (ACTOR_BOUNDARIES.has(input.boundary)
      && (!actorIdentifier(input.actorId) || !Object.hasOwn(current.actors, input.actorId)))
    || (GLOBAL_BOUNDARIES.has(input.boundary) && input.actorId !== null)) {
    return failure("invalid-status-runtime-v2-boundary", current);
  }

  if (input.boundary === "combat-end") {
    const next = deepFreeze({
      ...cloneState(current),
      actors: Object.fromEntries(Object.keys(current.actors).map((actorId) => [actorId, []])),
    });
    return success(next, deepFreeze({
      type: "status-boundary-resolved",
      boundary: input.boundary,
      actorId: null,
      changes: Object.values(current.actors).reduce((count, records) => count + records.length, 0),
    }));
  }

  const intents = [];
  const actors = {};
  let changes = 0;
  for (const [holderActorId, records] of Object.entries(current.actors)) {
    const nextRecords = [];
    for (const original of records) {
      const definition = COMBAT_ABILITY_STATUSES_V2[original.id];
      let record = cloneRecord(original);
      if (boundaryAppliesToRecord(input.boundary, input.actorId, holderActorId, record)) {
        const resolved = COMBAT_STATUS_RUNTIME_RESOLVERS_V2[record.id]({
          boundary: input.boundary,
          holderActorId,
          record,
        });
        intents.push(...resolved.intents);
        if (resolved.consumeMagnitude > 0) {
          record.magnitude = Math.max(0, record.magnitude - resolved.consumeMagnitude);
        }
        if (lifecycleBoundaryMatches(
          definition.decay.timing,
          input.boundary,
          input.actorId,
          holderActorId,
          record,
        )) {
          record.magnitude = Math.max(0, record.magnitude - definition.decay.stacks);
        }
        if (lifecycleBoundaryMatches(
          definition.duration.clock,
          input.boundary,
          input.actorId,
          holderActorId,
          record,
        )) {
          record.durationRemaining -= 1;
        }
      }
      if (shouldExpire(record, definition)) {
        changes += 1;
      } else {
        if (record.magnitude !== original.magnitude
          || record.durationRemaining !== original.durationRemaining) changes += 1;
        nextRecords.push(record);
      }
    }
    actors[holderActorId] = nextRecords.sort(compareRecords);
  }
  const next = deepFreeze({ ...cloneState(current), actors });
  return success(next, deepFreeze({
    type: "status-boundary-resolved",
    boundary: input.boundary,
    actorId: input.actorId,
    changes,
  }), intents);
}

export function adjudicateCombatStatusActionV2(state, input) {
  const checked = checkedState(state);
  if (!checked.ok) return checked.result;
  const current = checked.state;
  if (!exactKeys(input, ACTION_GATE_KEYS)
    || !actorIdentifier(input.actorId)
    || !Object.hasOwn(current.actors, input.actorId)
    || !ABILITY_V2_ACTION_LANES.includes(input.lane)) {
    return failure("invalid-status-runtime-v2-action-gate", current);
  }
  const blocking = current.actors[input.actorId].find((record) => (
    COMBAT_STATUS_BEHAVIOR_POLICY_V2[record.id].actionLockLanes.includes(input.lane)
  ));
  if (!blocking) {
    return success(current, deepFreeze({
      type: "status-action-adjudicated",
      actorId: input.actorId,
      lane: input.lane,
      allowed: true,
      blockedBy: null,
      consumed: 0,
    }));
  }
  const mutation = mutateUnchecked(current, {
    actorId: input.actorId,
    operation: "subtract",
    sourceActorId: null,
    statusId: blocking.id,
    value: 1,
  });
  return success(mutation.state, deepFreeze({
    type: "status-action-adjudicated",
    actorId: input.actorId,
    lane: input.lane,
    allowed: false,
    blockedBy: blocking.id,
    consumed: 1,
  }));
}

export function resolveCombatForcedTargetV2(state, input) {
  const checked = checkedState(state);
  if (!checked.ok) return checked.result;
  const current = checked.state;
  if (!exactKeys(input, FORCED_TARGET_KEYS)
    || !actorIdentifier(input.actorId)
    || !Object.hasOwn(current.actors, input.actorId)
    || !Array.isArray(input.validActorIds)
    || input.validActorIds.some((id) => !actorIdentifier(id))
    || new Set(input.validActorIds).size !== input.validActorIds.length) {
    return failure("invalid-status-runtime-v2-forced-target", current);
  }
  const challenge = current.actors[input.actorId].find((record) => record.id === "challenged");
  if (!challenge) {
    return success(current, deepFreeze({
      type: "status-forced-target-resolved",
      actorId: input.actorId,
      targetActorId: null,
      expired: false,
    }));
  }
  if (input.validActorIds.includes(challenge.sourceActorId)) {
    return success(current, deepFreeze({
      type: "status-forced-target-resolved",
      actorId: input.actorId,
      targetActorId: challenge.sourceActorId,
      expired: false,
    }));
  }
  const mutation = mutateUnchecked(current, {
    actorId: input.actorId,
    operation: "clear",
    sourceActorId: null,
    statusId: "challenged",
    value: 0,
  });
  return success(mutation.state, deepFreeze({
    type: "status-forced-target-resolved",
    actorId: input.actorId,
    targetActorId: null,
    expired: true,
  }));
}

export function resolveCombatMovementAllowanceV2(state, input) {
  const checked = checkedState(state);
  if (!checked.ok) return checked.result;
  const current = checked.state;
  if (!exactKeys(input, MOVEMENT_KEYS)
    || !actorIdentifier(input.actorId)
    || !Object.hasOwn(current.actors, input.actorId)
    || !Number.isSafeInteger(input.requestedCells) || input.requestedCells < 0) {
    return failure("invalid-status-runtime-v2-movement", current);
  }
  const restraint = statusMagnitudeUnchecked(current, input.actorId, "restraint");
  const limp = statusMagnitudeUnchecked(current, input.actorId, "limp");
  const blocked = restraint > 0;
  const penalty = blocked ? input.requestedCells : Math.ceil(
    limp / COMBAT_STATUS_BEHAVIOR_POLICY_V2.limp.movement.magnitudePerCell,
  );
  const allowedCells = blocked ? 0 : Math.max(0, input.requestedCells - penalty);
  return success(current, deepFreeze({
    type: "status-movement-resolved",
    actorId: input.actorId,
    requestedCells: input.requestedCells,
    allowedCells,
    blockedBy: blocked ? "restraint" : null,
    limpPenalty: blocked ? 0 : penalty,
  }));
}

export function combatStatusCombatModifiersV2(state, actorId) {
  const reason = stateReason(state);
  if (reason !== null) throw new TypeError(reason);
  if (!actorIdentifier(actorId) || !Object.hasOwn(state.actors, actorId)) {
    throw new TypeError("unknown-status-runtime-v2-actor");
  }
  const modifiers = {
    attackDelta: 0,
    avoidanceBonusBps: 0,
    criticalChanceBonusBps: 0,
    defenseDelta: 0,
    directFlatReduction: 0,
    directReductionBps: 0,
    lifestealBps: 0,
    redirectBps: 0,
    reflectionDamage: 0,
  };
  for (const record of state.actors[actorId]) {
    const row = COMBAT_STATUS_BEHAVIOR_POLICY_V2[record.id];
    modifiers.attackDelta += row.attackDeltaPerMagnitude * record.magnitude;
    modifiers.avoidanceBonusBps += row.avoidanceBonusBps;
    modifiers.criticalChanceBonusBps += row.criticalChanceBpsPerMagnitude * record.magnitude;
    modifiers.defenseDelta += row.defenseDeltaPerMagnitude * record.magnitude;
    modifiers.directFlatReduction += row.directFlatReductionPerMagnitude * record.magnitude;
    modifiers.directReductionBps = 10_000 - Math.floor(
      ((10_000 - modifiers.directReductionBps) * (10_000 - row.directReductionBps)) / 10_000,
    );
    modifiers.lifestealBps += row.lifestealBpsPerMagnitude * record.magnitude;
    modifiers.redirectBps = Math.max(modifiers.redirectBps, row.redirectBps);
    modifiers.reflectionDamage += row.reflectionPerMagnitude * record.magnitude;
  }
  return deepFreeze(modifiers);
}

export function resolveCombatDirectHitStatusesV2(state, input) {
  const checked = checkedState(state);
  if (!checked.ok) return checked.result;
  let current = checked.state;
  if (!exactKeys(input, DIRECT_HIT_KEYS)
    || !actorIdentifier(input.attackerActorId)
    || !actorIdentifier(input.defenderActorId)
    || input.attackerActorId === input.defenderActorId
    || !Object.hasOwn(current.actors, input.attackerActorId)
    || !Object.hasOwn(current.actors, input.defenderActorId)
    || typeof input.landed !== "boolean") {
    return failure("invalid-status-runtime-v2-direct-hit", current);
  }
  const mutations = [];
  if (input.landed) {
    const attackerHooks = current.actors[input.attackerActorId]
      .filter((record) => (
        COMBAT_STATUS_BEHAVIOR_POLICY_V2[record.id].afterDirectHit.applyStatus !== null
      ))
      .map(cloneRecord);
    for (const record of attackerHooks) {
      const hook = COMBAT_STATUS_BEHAVIOR_POLICY_V2[record.id].afterDirectHit;
      const applied = mutateUnchecked(current, {
        actorId: input.defenderActorId,
        operation: "add",
        sourceActorId: null,
        statusId: hook.applyStatus,
        value: record.magnitude,
      });
      current = applied.state;
      mutations.push(applied.event);
      if (hook.consumeAttacker === "all") {
        const cleared = mutateUnchecked(current, {
          actorId: input.attackerActorId,
          operation: "clear",
          sourceActorId: null,
          statusId: record.id,
          value: 0,
        });
        current = cleared.state;
        mutations.push(cleared.event);
      }
    }
    const spent = current.actors[input.defenderActorId]
      .filter((record) => (
        COMBAT_STATUS_BEHAVIOR_POLICY_V2[record.id].afterDirectHit.consumeDefender > 0
      ))
      .map((record) => record.id);
    for (const statusId of spent) {
      const amount = COMBAT_STATUS_BEHAVIOR_POLICY_V2[statusId].afterDirectHit.consumeDefender;
      const mutation = mutateUnchecked(current, {
        actorId: input.defenderActorId,
        operation: "subtract",
        sourceActorId: null,
        statusId,
        value: amount,
      });
      current = mutation.state;
      mutations.push(mutation.event);
    }
  }
  return success(current, deepFreeze({
    type: "direct-hit-statuses-resolved",
    attackerActorId: input.attackerActorId,
    defenderActorId: input.defenderActorId,
    landed: input.landed,
    mutations,
  }));
}
