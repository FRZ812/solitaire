// Pure spatial-zone authority for solitaire-tow-v2.
//
// This module owns zone identity, stacking, lifetime, trigger selection, and movement
// boundaries. It deliberately does not mutate actors, execute status resolvers, spend
// action economy, or emit encounter sequence numbers. Callers receive immutable tick and
// event descriptors and apply them through the composite v2 reducer.

import {
  TOW_ABILITY_RULESET_V2_ID,
  TOW_ABILITY_RULES_V2_VERSION,
  isZoneRulesV2Registry,
  zoneRulesV2AtRank,
} from "./ability-rules-v2.js";
import { TOW_ABILITY_ZONES_V2 } from "./ability-catalog-v2.js";
import { FORMATION_CELLS } from "./formation.js";

export const TOW_ZONE_RUNTIME_V2_VERSION = 1;
export const MAX_TOW_ZONES_V2 = 4096;
export const MAX_TOW_ZONE_ROUNDS_V2 = 2000;
export const TOW_ZONE_TRIGGER_TIMINGS_V2 = Object.freeze([
  "after-enter",
  "turn-start",
  "turn-end",
  "round-end",
]);

// Runtime stacking is deliberately explicit. In particular, refresh-duration takes the
// newest cast's rank, resolved potency, and authored lifetime; it does not infer a maximum
// from the previous application. Potency is already an integer snapshot, so a later owner
// death or stat change cannot rewrite a saved zone tick.
export const TOW_ZONE_RUNTIME_POLICY_V2 = deepFreeze({
  stackKey: ["owner-actor", "definition", "side", "cell"],
  replace: "newest-instance",
  refreshDuration: "newest-potency-and-duration",
  stackPotency: "add-until-application-cap-and-keep-greater-duration",
  creationCountsAsEnter: false,
  ownerStatPolicy: "resolved-potency-snapshot",
  lifetimeClock: "after-round-end-ticks",
  movementBoundary: "origin-exit-then-destination-entry",
});

const SIDES = Object.freeze(["player", "enemy"]);
const STATE_KEYS = Object.freeze(["rulesetId", "version", "zones"].sort());
const INSTANCE_KEYS = Object.freeze([
  "applications",
  "createdSequence",
  "definitionId",
  "index",
  "instanceId",
  "key",
  "ownerActorId",
  "ownerSide",
  "rank",
  "resolvedPotency",
  "roundsRemaining",
  "rulesetId",
  "side",
  "updatedSequence",
  "version",
].sort());
const PLACE_KEYS = Object.freeze([
  "definitionId",
  "index",
  "instanceId",
  "ownerActorId",
  "ownerSide",
  "rank",
  "resolvedPotency",
  "rounds",
  "sequence",
  "side",
].sort());
const CELL_KEYS = Object.freeze(["index", "side"].sort());
const OCCUPANT_KEYS = Object.freeze(["actorId", "actorSide", "index", "side"].sort());
const TRIGGER_KEYS = Object.freeze(["occupants", "timing"].sort());
const ROUND_END_KEYS = Object.freeze(["occupants"].sort());
const MOVEMENT_KEYS = Object.freeze(["actorId", "actorSide", "from", "to"].sort());

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

function rulesIdentifier(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 128
    && /^[a-z0-9][a-z0-9-]*$/.test(value);
}

function nonNegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function cellIndex(value) {
  return Number.isSafeInteger(value) && FORMATION_CELLS.includes(value);
}

function side(value) {
  return SIDES.includes(value);
}

function canonicalCompare(a, b) {
  if (a.createdSequence !== b.createdSequence) return a.createdSequence - b.createdSequence;
  if (a.key !== b.key) return a.key < b.key ? -1 : 1;
  return a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0;
}

function cloneInstance(value) {
  return { ...value };
}

function cloneState(value) {
  return {
    version: value.version,
    rulesetId: value.rulesetId,
    zones: value.zones.map(cloneInstance),
  };
}

function immutableState(value) {
  return deepFreeze(cloneState(value));
}

function result(ok, reason, state, ticks = [], events = [], detail = null) {
  return deepFreeze({ ok, reason, state, ticks, events, detail });
}

function failure(reason, state = null) {
  return result(false, reason, state);
}

function success(state, { ticks = [], events = [], detail = null } = {}) {
  return result(true, null, state, ticks, events, detail);
}

function registryOrDefault(registry) {
  return registry === undefined ? TOW_ABILITY_ZONES_V2 : registry;
}

function registryFromOptions(options) {
  if (!exactKeys(options, []) && !exactKeys(options, ["registry"])) {
    return { ok: false, registry: null };
  }
  return { ok: true, registry: registryOrDefault(options.registry) };
}

function resolvedDefinition(registry, definitionId, rank) {
  if (!isZoneRulesV2Registry(registry) || !rulesIdentifier(definitionId)) return null;
  const definition = registry[definitionId];
  if (!definition || !Number.isSafeInteger(rank) || rank < 1 || rank > definition.rankCount) {
    return null;
  }
  try {
    return zoneRulesV2AtRank(definition, rank);
  } catch {
    return null;
  }
}

/** Collision-free, stable stacking identity. */
export function zoneStackKeyV2(ownerActorId, definitionId, zoneSide, index) {
  if (!actorIdentifier(ownerActorId)
    || !rulesIdentifier(definitionId)
    || !side(zoneSide)
    || !cellIndex(index)) return null;
  return JSON.stringify([ownerActorId, definitionId, zoneSide, index]);
}

function instanceReason(value, registry) {
  if (!exactKeys(value, INSTANCE_KEYS)) return "invalid-zone-instance-v2-shape";
  if (value.version !== TOW_ABILITY_RULES_V2_VERSION
    || value.rulesetId !== TOW_ABILITY_RULESET_V2_ID) {
    return "invalid-zone-instance-v2-ruleset";
  }
  if (!actorIdentifier(value.instanceId)
    || !actorIdentifier(value.ownerActorId)
    || !side(value.ownerSide)
    || !side(value.side)
    || !cellIndex(value.index)) return "invalid-zone-instance-v2-identity";
  const definition = resolvedDefinition(registry, value.definitionId, value.rank);
  if (!definition) return "invalid-zone-instance-v2-definition";
  if (value.key !== zoneStackKeyV2(
    value.ownerActorId,
    value.definitionId,
    value.side,
    value.index,
  )) return "invalid-zone-instance-v2-key";
  if (!nonNegativeSafeInteger(value.resolvedPotency)
    || !Number.isSafeInteger(value.roundsRemaining)
    || value.roundsRemaining < 1
    || value.roundsRemaining > MAX_TOW_ZONE_ROUNDS_V2
    || !Number.isSafeInteger(value.applications)
    || value.applications < 1
    || value.applications > (definition.stacking.cap ?? 1)
    || !nonNegativeSafeInteger(value.createdSequence)
    || !nonNegativeSafeInteger(value.updatedSequence)
    || value.updatedSequence < value.createdSequence) {
    return "invalid-zone-instance-v2-state";
  }
  if (definition.stacking.policy !== "stack-potency" && value.applications !== 1) {
    return "invalid-zone-instance-v2-applications";
  }
  return null;
}

export function validateTowZoneInstanceV2(value, registry = TOW_ABILITY_ZONES_V2) {
  const reason = instanceReason(value, registryOrDefault(registry));
  return Object.freeze({ ok: reason === null, reason });
}

export function isTowZoneInstanceV2(value, registry = TOW_ABILITY_ZONES_V2) {
  return validateTowZoneInstanceV2(value, registry).ok;
}

function stateReason(value, registry) {
  if (!exactKeys(value, STATE_KEYS)) return "invalid-zone-state-v2-shape";
  if (value.version !== TOW_ABILITY_RULES_V2_VERSION
    || value.rulesetId !== TOW_ABILITY_RULESET_V2_ID) {
    return "invalid-zone-state-v2-ruleset";
  }
  if (!Array.isArray(value.zones) || value.zones.length > MAX_TOW_ZONES_V2) {
    return "invalid-zone-state-v2-zones";
  }
  if (value.zones.some((zone) => instanceReason(zone, registry) !== null)) {
    return "invalid-zone-state-v2-zone";
  }
  if (new Set(value.zones.map(({ instanceId }) => instanceId)).size !== value.zones.length
    || new Set(value.zones.map(({ key }) => key)).size !== value.zones.length) {
    return "duplicate-zone-state-v2-identity";
  }
  const sorted = [...value.zones].sort(canonicalCompare);
  if (sorted.some((zone, index) => zone !== value.zones[index])) {
    return "noncanonical-zone-state-v2-order";
  }
  return null;
}

export function validateTowZoneStateV2(value, registry = TOW_ABILITY_ZONES_V2) {
  const selectedRegistry = registryOrDefault(registry);
  if (!isZoneRulesV2Registry(selectedRegistry)) {
    return Object.freeze({ ok: false, reason: "invalid-zone-rules-v2-registry" });
  }
  const reason = stateReason(value, selectedRegistry);
  return Object.freeze({ ok: reason === null, reason });
}

export function isTowZoneStateV2(value, registry = TOW_ABILITY_ZONES_V2) {
  return validateTowZoneStateV2(value, registry).ok;
}

export function createTowZoneStateV2(input = {}) {
  if (!exactKeys(input, ["zones"]) || !Array.isArray(input.zones)) {
    return failure("invalid-zone-state-v2-create-input");
  }
  const state = {
    version: TOW_ABILITY_RULES_V2_VERSION,
    rulesetId: TOW_ABILITY_RULESET_V2_ID,
    zones: input.zones.map(cloneInstance).sort(canonicalCompare),
  };
  const validation = validateTowZoneStateV2(state);
  return validation.ok ? success(deepFreeze(state)) : failure(validation.reason);
}

function checkedState(state, registry) {
  const validation = validateTowZoneStateV2(state, registry);
  return validation.ok
    ? { ok: true, state: immutableState(state) }
    : { ok: false, result: failure(validation.reason) };
}

function placementReason(input, registry) {
  if (!exactKeys(input, PLACE_KEYS)) return "invalid-zone-placement-v2-shape";
  if (!actorIdentifier(input.instanceId)
    || !actorIdentifier(input.ownerActorId)
    || !side(input.ownerSide)
    || !side(input.side)
    || !cellIndex(input.index)
    || !nonNegativeSafeInteger(input.resolvedPotency)
    || !Number.isSafeInteger(input.rounds)
    || input.rounds < 1
    || input.rounds > MAX_TOW_ZONE_ROUNDS_V2
    || !nonNegativeSafeInteger(input.sequence)) {
    return "invalid-zone-placement-v2";
  }
  return resolvedDefinition(registry, input.definitionId, input.rank)
    ? null
    : "invalid-zone-placement-v2-definition";
}

function placedInstance(input) {
  return {
    version: TOW_ABILITY_RULES_V2_VERSION,
    rulesetId: TOW_ABILITY_RULESET_V2_ID,
    instanceId: input.instanceId,
    key: zoneStackKeyV2(input.ownerActorId, input.definitionId, input.side, input.index),
    definitionId: input.definitionId,
    ownerActorId: input.ownerActorId,
    ownerSide: input.ownerSide,
    side: input.side,
    index: input.index,
    rank: input.rank,
    resolvedPotency: input.resolvedPotency,
    applications: 1,
    roundsRemaining: input.rounds,
    createdSequence: input.sequence,
    updatedSequence: input.sequence,
  };
}

/**
 * Place or stack one already-resolved zone effect.
 *
 * `resolvedPotency` and `rounds` are reducer-owned snapshots of the ranked effect. Existing
 * occupants are intentionally ignored: zone creation is not an enter trigger.
 */
export function placeTowZoneV2(
  state,
  input,
  options = {},
) {
  const selected = registryFromOptions(options);
  if (!selected.ok) return failure("invalid-zone-options-v2");
  const selectedRegistry = selected.registry;
  const checked = checkedState(state, selectedRegistry);
  if (!checked.ok) return checked.result;
  const current = checked.state;
  const reason = placementReason(input, selectedRegistry);
  if (reason) return failure(reason, current);

  const incoming = placedInstance(input);
  const definition = resolvedDefinition(selectedRegistry, input.definitionId, input.rank);
  const existingIndex = current.zones.findIndex(({ key }) => key === incoming.key);
  const existing = existingIndex < 0 ? null : current.zones[existingIndex];

  if (existing && input.sequence <= existing.updatedSequence) {
    return failure("stale-zone-placement-v2", current);
  }
  if ((!existing || definition.stacking.policy === "replace")
    && current.zones.some(({ instanceId, key }) => (
      instanceId === incoming.instanceId && key !== incoming.key
    ))) {
    return failure("duplicate-zone-instance-v2-id", current);
  }
  if (!existing && current.zones.length >= MAX_TOW_ZONES_V2) {
    return failure("zone-state-v2-limit-exceeded", current);
  }

  let nextInstance = incoming;
  let eventType = "zone-created";
  if (existing) {
    if (definition.stacking.policy === "replace") {
      eventType = "zone-replaced";
    } else if (definition.stacking.policy === "refresh-duration") {
      nextInstance = {
        ...cloneInstance(existing),
        rank: input.rank,
        resolvedPotency: input.resolvedPotency,
        roundsRemaining: input.rounds,
        updatedSequence: input.sequence,
      };
      eventType = "zone-refreshed";
    } else {
      const cap = definition.stacking.cap;
      const addsApplication = existing.applications < cap;
      nextInstance = {
        ...cloneInstance(existing),
        rank: input.rank,
        resolvedPotency: addsApplication
          ? existing.resolvedPotency + input.resolvedPotency
          : existing.resolvedPotency,
        applications: addsApplication ? existing.applications + 1 : existing.applications,
        roundsRemaining: Math.max(existing.roundsRemaining, input.rounds),
        updatedSequence: input.sequence,
      };
      if (!Number.isSafeInteger(nextInstance.resolvedPotency)) {
        return failure("zone-potency-v2-overflow", current);
      }
      eventType = "zone-stacked";
    }
  }

  const zones = existing
    ? current.zones.map((zone, index) => index === existingIndex ? nextInstance : cloneInstance(zone))
    : [...current.zones.map(cloneInstance), nextInstance];
  zones.sort(canonicalCompare);
  const next = deepFreeze({
    version: TOW_ABILITY_RULES_V2_VERSION,
    rulesetId: TOW_ABILITY_RULESET_V2_ID,
    zones,
  });
  const validation = validateTowZoneStateV2(next, selectedRegistry);
  if (!validation.ok) return failure(validation.reason, current);

  return success(next, {
    // Intentionally no zone tick: creation under an occupant is not enter.
    events: [{
      type: eventType,
      instanceId: nextInstance.instanceId,
      definitionId: nextInstance.definitionId,
      ownerActorId: nextInstance.ownerActorId,
      side: nextInstance.side,
      index: nextInstance.index,
      rank: nextInstance.rank,
      resolvedPotency: nextInstance.resolvedPotency,
      applications: nextInstance.applications,
      roundsRemaining: nextInstance.roundsRemaining,
      causeSequence: input.sequence,
    }],
    detail: { zone: cloneInstance(nextInstance) },
  });
}

function validCell(value) {
  return exactKeys(value, CELL_KEYS) && side(value.side) && cellIndex(value.index);
}

function validOccupant(value) {
  return exactKeys(value, OCCUPANT_KEYS)
    && actorIdentifier(value.actorId)
    && side(value.actorSide)
    && side(value.side)
    && cellIndex(value.index)
    && value.actorSide === value.side;
}

function validOccupants(values) {
  if (!Array.isArray(values) || !values.every(validOccupant)) return false;
  return new Set(values.map(({ actorId }) => actorId)).size === values.length
    && new Set(values.map(({ side: zoneSide, index }) => `${zoneSide}:${index}`)).size === values.length;
}

function occupantMatchesRecipient(ownerSide, actorSide, recipient) {
  if (recipient === "all-occupants") return true;
  if (recipient === "allied-occupants") return actorSide === ownerSide;
  return recipient === "enemy-occupants" && actorSide !== ownerSide;
}

function timingMatches(definition, timing) {
  if (timing === "after-enter") {
    return definition.timing.trigger === "enter" && definition.timing.tick === "after-enter";
  }
  if (timing === "turn-start") {
    return definition.timing.trigger === "occupant-turn" && definition.timing.tick === "start";
  }
  if (timing === "turn-end") {
    return definition.timing.trigger === "occupant-turn" && definition.timing.tick === "end";
  }
  return timing === "round-end"
    && definition.timing.trigger === "round"
    && definition.timing.tick === "end";
}

function tickDescriptor(zone, definition, occupant, timing) {
  return {
    type: "zone-tick",
    timing,
    instanceId: zone.instanceId,
    definitionId: zone.definitionId,
    ownerActorId: zone.ownerActorId,
    ownerSide: zone.ownerSide,
    actorId: occupant.actorId,
    actorSide: occupant.actorSide,
    side: zone.side,
    index: zone.index,
    rank: zone.rank,
    payload: {
      primitive: definition.payload.primitive,
      operation: definition.payload.operation,
      recipient: definition.payload.recipient,
      subject: definition.payload.subject,
      unit: definition.payload.potency.unit,
      amount: zone.resolvedPotency,
    },
  };
}

/** Select zone payloads for one exact movement/turn/round boundary. */
export function collectTowZoneTicksV2(
  state,
  input,
  options = {},
) {
  const selected = registryFromOptions(options);
  if (!selected.ok) return failure("invalid-zone-options-v2");
  const selectedRegistry = selected.registry;
  const checked = checkedState(state, selectedRegistry);
  if (!checked.ok) return checked.result;
  const current = checked.state;
  if (!exactKeys(input, TRIGGER_KEYS)
    || !TOW_ZONE_TRIGGER_TIMINGS_V2.includes(input.timing)
    || !validOccupants(input.occupants)
    || (input.timing !== "round-end" && input.occupants.length !== 1)) {
    return failure("invalid-zone-trigger-v2", current);
  }

  const occupants = new Map(input.occupants.map((occupant) => [
    `${occupant.side}:${occupant.index}`,
    occupant,
  ]));
  const ticks = current.zones.flatMap((zone) => {
    const occupant = occupants.get(`${zone.side}:${zone.index}`);
    if (!occupant) return [];
    const definition = resolvedDefinition(selectedRegistry, zone.definitionId, zone.rank);
    if (!timingMatches(definition, input.timing)
      || !occupantMatchesRecipient(
        zone.ownerSide,
        occupant.actorSide,
        definition.payload.recipient,
      )) return [];
    return [tickDescriptor(zone, definition, occupant, input.timing)];
  });
  return success(current, { ticks });
}

function blockerDescriptor(zone, boundary) {
  return {
    instanceId: zone.instanceId,
    definitionId: zone.definitionId,
    ownerActorId: zone.ownerActorId,
    ownerSide: zone.ownerSide,
    side: zone.side,
    index: zone.index,
    boundary,
  };
}

/**
 * Query the two zone boundaries for one proposed same-side step.
 *
 * Movement policies affect only occupants eligible for the zone payload's authored
 * allegiance. The result is serializable and can be consumed by movement-v2 without a
 * module cycle.
 */
export function zoneMovementBlockersV2(
  state,
  input,
  options = {},
) {
  const selected = registryFromOptions(options);
  if (!selected.ok) return failure("invalid-zone-options-v2");
  const selectedRegistry = selected.registry;
  const checked = checkedState(state, selectedRegistry);
  if (!checked.ok) return checked.result;
  const current = checked.state;
  if (!exactKeys(input, MOVEMENT_KEYS)
    || !actorIdentifier(input.actorId)
    || !side(input.actorSide)
    || !validCell(input.from)
    || !validCell(input.to)
    || input.from.side !== input.actorSide
    || input.to.side !== input.actorSide) {
    return failure("invalid-zone-movement-query-v2", current);
  }

  const exit = [];
  const entry = [];
  for (const zone of current.zones) {
    const definition = resolvedDefinition(selectedRegistry, zone.definitionId, zone.rank);
    if (!occupantMatchesRecipient(
      zone.ownerSide,
      input.actorSide,
      definition.payload.recipient,
    )) continue;
    if (zone.side === input.from.side && zone.index === input.from.index
      && ["block-exit", "block-both"].includes(definition.movementPolicy)) {
      exit.push(blockerDescriptor(zone, "exit"));
    }
    if (zone.side === input.to.side && zone.index === input.to.index
      && ["block-entry", "block-both"].includes(definition.movementPolicy)) {
      entry.push(blockerDescriptor(zone, "entry"));
    }
  }
  const blockers = [...exit, ...entry];
  return success(current, {
    detail: {
      blocked: blockers.length > 0,
      blockExit: exit.length > 0,
      blockEntry: entry.length > 0,
      blockers,
    },
  });
}

/** Collect round-end ticks, then decrement every zone and remove expiries. */
export function endTowZoneRoundV2(
  state,
  input,
  options = {},
) {
  const selected = registryFromOptions(options);
  if (!selected.ok) return failure("invalid-zone-options-v2");
  const selectedRegistry = selected.registry;
  const checked = checkedState(state, selectedRegistry);
  if (!checked.ok) return checked.result;
  const current = checked.state;
  if (!exactKeys(input, ROUND_END_KEYS) || !validOccupants(input.occupants)) {
    return failure("invalid-zone-round-end-v2", current);
  }
  const collected = collectTowZoneTicksV2(current, {
    timing: "round-end",
    occupants: input.occupants,
  }, { registry: selectedRegistry });
  if (!collected.ok) return collected;

  const events = [];
  const zones = [];
  for (const zone of current.zones) {
    const roundsRemaining = zone.roundsRemaining - 1;
    if (roundsRemaining <= 0) {
      events.push({
        type: "zone-expired",
        instanceId: zone.instanceId,
        definitionId: zone.definitionId,
        ownerActorId: zone.ownerActorId,
        side: zone.side,
        index: zone.index,
      });
    } else {
      zones.push({ ...cloneInstance(zone), roundsRemaining });
    }
  }
  const next = deepFreeze({
    version: TOW_ABILITY_RULES_V2_VERSION,
    rulesetId: TOW_ABILITY_RULESET_V2_ID,
    zones,
  });
  return success(next, { ticks: collected.ticks, events });
}
