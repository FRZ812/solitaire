// Immutable status semantics for solitaire-tow-v2.
//
// Ability effects carry magnitudes; this registry pins lifecycle and behavior identity.
// It is intentionally not a complete behavior executor: runtime registration also requires
// one typed code resolver per concrete status. Unknown ids or missing resolvers are never
// inferred from names or v1 mechanics.

import {
  TOW_ABILITY_RULESET_V2_ID,
  TOW_ABILITY_RULES_V2_VERSION,
  isAbilityRulesV2,
  isZoneRulesV2Registry,
  validateAbilityZoneReferencesV2,
} from "./ability-rules-v2.js";

export const STATUS_V2_PROVENANCE = Object.freeze(["none", "source-actor"]);
export const STATUS_V2_DURATION_CLOCKS = Object.freeze([
  "encounter",
  "round-end",
  "source-turn-end",
  "recipient-turn-end",
]);
export const STATUS_V2_DECAY_TIMINGS = Object.freeze([
  "none",
  "round-start",
  "round-end",
  "source-turn-start",
  "source-turn-end",
  "recipient-turn-start",
  "recipient-turn-end",
]);
export const STATUS_V2_EXPIRY_POLICIES = Object.freeze([
  "combat-end",
  "at-zero",
  "duration-end",
  "at-zero-or-duration-end",
]);
export const STATUS_V2_STACKING_POLICIES = Object.freeze([
  "add",
  "replace",
  "maximum",
  "unique-per-source",
]);
export const STATUS_V2_POLARITIES = Object.freeze(["beneficial", "harmful", "neutral"]);
export const STATUS_V2_CATEGORIES = Object.freeze([
  "offense",
  "defense",
  "control",
  "damage",
  "healing",
  "tempo",
  "resource",
  "targeting",
  "mobility",
  "summon",
]);
export const STATUS_V2_BEHAVIORS = Object.freeze([
  "stat-modifier",
  "periodic-damage",
  "periodic-heal",
  "action-lock",
  "forced-target",
  "avoidance",
  "damage-redirect",
  "resource-counter",
  "summon-counter",
  "marker",
]);
export const STATUS_V2_FORCED_TARGET_POLICY = Object.freeze({
  conflict: "latest-application-replaces-source",
  invalidSource: "expire",
});
export const STATUS_V2_RUNTIME_RESOLVER_CONTRACT = "typed-resolver-per-status";

// Duration count drops at its named boundary. When decay shares that boundary, decay is
// applied first, duration second, and expiry is evaluated last. Stacking is deterministic:
// add sums to cap; replace takes the newest magnitude, provenance, and duration; maximum
// keeps the larger magnitude and duration; unique-per-source keeps one record per source
// actor up to cap. Forced-target is stricter: replace/cap 1 only, so the latest Challenge
// owns provenance, and the status expires rather than guessing if that source is invalid.

const STATUS_KEYS = Object.freeze([
  "behavior",
  "category",
  "decay",
  "duration",
  "expiry",
  "id",
  "polarity",
  "provenance",
  "rulesetId",
  "stacking",
  "version",
].sort());
const DURATION_KEYS = Object.freeze(["clock", "count"].sort());
const DECAY_KEYS = Object.freeze(["stacks", "timing"].sort());
const STACKING_KEYS = Object.freeze(["cap", "policy"].sort());
const REFERENCE_SET_KEYS = Object.freeze(["statuses", "zones"].sort());

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

function validationReason(value) {
  if (!exactKeys(value, STATUS_KEYS)) return "invalid-status-rules-v2-shape";
  if (value.version !== TOW_ABILITY_RULES_V2_VERSION) return "invalid-status-rules-v2-version";
  if (value.rulesetId !== TOW_ABILITY_RULESET_V2_ID) return "invalid-status-rules-v2-id";
  if (!identifier(value.id)) return "invalid-status-rules-v2-status-id";
  if (!STATUS_V2_PROVENANCE.includes(value.provenance)) return "invalid-status-v2-provenance";
  if (!STATUS_V2_POLARITIES.includes(value.polarity)) return "invalid-status-v2-polarity";
  if (!STATUS_V2_CATEGORIES.includes(value.category)) return "invalid-status-v2-category";
  if (!STATUS_V2_BEHAVIORS.includes(value.behavior)) return "invalid-status-v2-behavior";

  if (!exactKeys(value.duration, DURATION_KEYS)) return "invalid-status-v2-duration-shape";
  if (!STATUS_V2_DURATION_CLOCKS.includes(value.duration.clock)) {
    return "invalid-status-v2-duration-clock";
  }
  const encounterDuration = value.duration.clock === "encounter";
  if ((encounterDuration && value.duration.count !== null)
    || (!encounterDuration
      && (!Number.isSafeInteger(value.duration.count) || value.duration.count < 1))) {
    return "invalid-status-v2-duration-count";
  }

  if (!exactKeys(value.decay, DECAY_KEYS)) return "invalid-status-v2-decay-shape";
  if (!STATUS_V2_DECAY_TIMINGS.includes(value.decay.timing)) return "invalid-status-v2-decay";
  const noDecay = value.decay.timing === "none";
  if ((noDecay && value.decay.stacks !== 0)
    || (!noDecay && (!Number.isSafeInteger(value.decay.stacks) || value.decay.stacks < 1))) {
    return "invalid-status-v2-decay-stacks";
  }

  if (!STATUS_V2_EXPIRY_POLICIES.includes(value.expiry)) return "invalid-status-v2-expiry";
  if ((encounterDuration && ["duration-end", "at-zero-or-duration-end"].includes(value.expiry))
    || (!encounterDuration && ["combat-end", "at-zero"].includes(value.expiry))) {
    return "incoherent-status-v2-expiry";
  }
  if (!noDecay && !["at-zero", "at-zero-or-duration-end"].includes(value.expiry)) {
    return "incoherent-status-v2-decay";
  }

  if (!exactKeys(value.stacking, STACKING_KEYS)) return "invalid-status-v2-stacking-shape";
  if (!STATUS_V2_STACKING_POLICIES.includes(value.stacking.policy)) {
    return "invalid-status-v2-stacking-policy";
  }
  if (!Number.isSafeInteger(value.stacking.cap) || value.stacking.cap < 1) {
    return "invalid-status-v2-stacking-cap";
  }

  if (value.behavior === "forced-target") {
    if (value.provenance !== "source-actor"
      || value.polarity !== "harmful"
      || value.category !== "targeting"
      || value.stacking.policy !== "replace"
      || value.stacking.cap !== 1) {
      return "incoherent-status-v2-forced-target";
    }
  }
  return null;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function cloneDefinition(value) {
  return {
    version: value.version,
    rulesetId: value.rulesetId,
    id: value.id,
    provenance: value.provenance,
    duration: { ...value.duration },
    decay: { ...value.decay },
    expiry: value.expiry,
    stacking: { ...value.stacking },
    polarity: value.polarity,
    category: value.category,
    behavior: value.behavior,
  };
}

export function validateStatusRulesV2(value) {
  const reason = validationReason(value);
  return Object.freeze({ ok: reason === null, reason });
}

export function isStatusRulesV2(value) {
  return validationReason(value) === null;
}

export function defineStatusRulesV2(value) {
  const result = validateStatusRulesV2(value);
  if (!result.ok) throw new TypeError(result.reason);
  return deepFreeze(cloneDefinition(value));
}

export function defineStatusRulesV2Registry(values) {
  if (!Array.isArray(values)) throw new TypeError("invalid-status-rules-v2-registry");
  const entries = values.map(defineStatusRulesV2);
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) {
    throw new TypeError("duplicate-status-rules-v2-id");
  }
  return deepFreeze(Object.fromEntries(entries.map((entry) => [entry.id, entry])));
}

export function isStatusRulesV2Registry(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(([id, definition]) => (
    id === definition?.id && isStatusRulesV2(definition)
  ));
}

/** Runtime gate: metadata alone cannot make a status executable. */
export function defineStatusRuntimeResolversV2(statuses, resolvers) {
  if (!isStatusRulesV2Registry(statuses)
    || !resolvers
    || typeof resolvers !== "object"
    || Array.isArray(resolvers)) {
    throw new TypeError("invalid-status-runtime-resolvers-v2");
  }
  const statusIds = Object.keys(statuses).sort();
  const resolverIds = Object.keys(resolvers).sort();
  if (statusIds.length !== resolverIds.length
    || !statusIds.every((id, index) => id === resolverIds[index])
    || !resolverIds.every((id) => typeof resolvers[id] === "function")) {
    throw new TypeError("invalid-status-runtime-resolvers-v2");
  }
  return Object.freeze(Object.fromEntries(resolverIds.map((id) => [id, resolvers[id]])));
}

export function validateAbilityStatusReferencesV2(value, registry) {
  if (!isAbilityRulesV2(value)) {
    return Object.freeze({ ok: false, reason: "invalid-ability-rules-v2" });
  }
  if (!isStatusRulesV2Registry(registry)) {
    return Object.freeze({ ok: false, reason: "invalid-status-rules-v2-registry" });
  }
  for (const effect of value.effects) {
    if (!["status", "cleanse"].includes(effect.primitive)) continue;
    if (!registry[effect.subject]) {
      return Object.freeze({ ok: false, reason: "unknown-status-rules-v2-id" });
    }
  }
  return Object.freeze({ ok: true, reason: null });
}

export function validateZoneStatusReferencesV2(zones, registry) {
  if (!isZoneRulesV2Registry(zones)) {
    return Object.freeze({ ok: false, reason: "invalid-zone-rules-v2-registry" });
  }
  if (!isStatusRulesV2Registry(registry)) {
    return Object.freeze({ ok: false, reason: "invalid-status-rules-v2-registry" });
  }
  for (const zone of Object.values(zones)) {
    if (!["status", "cleanse"].includes(zone.payload.primitive)) continue;
    if (!registry[zone.payload.subject]) {
      return Object.freeze({ ok: false, reason: "unknown-status-rules-v2-id" });
    }
  }
  return Object.freeze({ ok: true, reason: null });
}

/** One catalog gate: both zone and status ids must resolve in the pinned v2 registries. */
export function validateAbilityRuleReferencesV2(value, references) {
  if (!exactKeys(references, REFERENCE_SET_KEYS)) {
    return Object.freeze({ ok: false, reason: "invalid-ability-rules-v2-references" });
  }
  const zones = validateAbilityZoneReferencesV2(value, references.zones);
  if (!zones.ok) return zones;
  const zoneStatuses = validateZoneStatusReferencesV2(references.zones, references.statuses);
  if (!zoneStatuses.ok) return zoneStatuses;
  return validateAbilityStatusReferencesV2(value, references.statuses);
}
