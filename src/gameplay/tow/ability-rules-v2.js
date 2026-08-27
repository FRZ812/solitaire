// Opt-in spatial ability contract for the next Tower ruleset.
//
// The shipped combat reducer and replay path remain pinned to solitaire-tow-v1.3. This module
// deliberately has no adapter from the captured v1 catalogue: a v2 action exists only when
// it is authored against this exact ruleset id and validated here. Current v1.3 receipts and
// future v2 receipts remain distinct, while retired v1 fights fail at the runtime boundary.

export const TOW_ABILITY_RULESET_V2_ID = "solitaire-tow-v2";
export const TOW_ABILITY_RULES_V2_VERSION = 2;
export const TOW_ABILITY_RANK_MAX_V2 = 6;

export const ABILITY_V2_SIDES = Object.freeze(["self", "ally", "enemy"]);
export const ABILITY_V2_ANCHOR_SHAPES = Object.freeze([
  "caster",
  "occupied-cell",
  "cell",
]);
export const ABILITY_V2_ANCHOR_RANGES = Object.freeze([
  "self",
  "adjacent",
  "melee",
  "ranged",
  "global",
]);
// Unit tracking persists the selected actor id and resolves around that actor's current
// cell; if that actor leaves combat, it fizzles rather than substituting another occupant.
// Cell tracking persists the declared side/index and never follows an occupant. Caster
// anchors are always unit-tracked, cell anchors cell-tracked, and occupied-cell anchors may
// deliberately choose either behavior.
export const ABILITY_V2_ANCHOR_TRACKING = Object.freeze(["unit", "cell"]);
export const ABILITY_V2_AREA_SHAPES = Object.freeze([
  "single",
  "row",
  "column",
  "cross-short",
  "cross-full",
  "all",
]);
export const ABILITY_V2_RECIPIENTS = Object.freeze([
  "caster",
  "selected-units",
  "selected-cells",
  "all-allies",
  "all-enemies",
  "all-combatants",
]);
export const ABILITY_V2_ACTION_LANES = Object.freeze(["main", "quick", "reaction"]);
// Cooldowns use the owner's main-action clock for every lane. Spending an action writes
// its ranked cooldown; that counter drops once when each later main-action window opens,
// and the action is legal again only after the counter reaches zero.
export const ABILITY_V2_CAST_MODES = Object.freeze([
  "melee",
  "projectile",
  "field",
  "support",
]);
export const ABILITY_V2_PRESENTATION_TIERS = Object.freeze([
  "restrained",
  "ability",
  "mythical",
]);
// Cast geometry is stable, while tier is rank-indexed so a promoted flexible action can
// cross into the full-screen Mythical declaration without changing its combat semantics.
export const ABILITY_V2_EFFECT_PRIMITIVES = Object.freeze([
  "damage",
  "heal",
  "shield",
  "status",
  "cleanse",
  "resource",
  "move",
  "push",
  "pull",
  "zone",
]);
export const ABILITY_V2_MOTIONS = Object.freeze([
  // Move relocates its recipient to, toward, or away from the selected anchor. Push and
  // pull both use the caster-to-recipient vector; their primitive determines whether that
  // vector is followed (push) or reversed (pull). Ranked `cells` are the maximum legal
  // displacement, so `to-anchor` is refused when the anchor is farther away. Same-row
  // relocation chooses the empty cell with the shortest column distance, breaking ties by
  // the lower cell index; it is refused when no empty cell is within the ranked distance.
  "to-anchor",
  "toward-anchor",
  "away-from-anchor",
  "source-target-vector",
  "nearest-empty-same-row",
]);
export const ABILITY_V2_OPERATIONS = Object.freeze([
  "deal",
  "restore",
  "grant",
  "add",
  "scale",
  "retain-percent",
  "subtract",
  "clear",
  "gain",
  "drain",
  "move",
  "push",
  "pull",
  "create",
]);
// `basis` names the numeric stat; `scalesFrom` names whose stat. A basis of `none` always
// pairs with a null scale source. In zone payloads caster means zone owner and recipient
// means the occupant currently receiving that tick.
export const ABILITY_V2_SCALE_SOURCES = Object.freeze(["caster", "recipient"]);
export const ABILITY_V2_RESOURCE_IDS = Object.freeze(["resolve"]);

// Universal reducer order, independent of individual ability authorship. Selected cells
// are canonical row-major. Their unit ids are snapshotted when the action commits. Effects
// resolve in authored effect-major order, with snapshotted recipients row-major inside each
// effect. Movement or death during an earlier effect never substitutes a later occupant.
export const ABILITY_V2_EXECUTION_ORDER = Object.freeze({
  selectedCells: "row-major",
  selectedUnits: "snapshot-at-commit",
  effects: "authored-effect-major",
  recipients: "row-major",
  substitution: "never",
});
export const ABILITY_V2_VALUE_UNITS = Object.freeze([
  "flat",
  "percent",
  "stacks",
  "cells",
  "turns",
  "rounds",
]);
export const ABILITY_V2_VALUE_BASES = Object.freeze([
  "none",
  "attack",
  "defense",
  "max-hp",
  "missing-hp",
]);

// Reactions are armed during player priority with their target/anchor already pinned, then
// auto-resolve atomically when the authored hostile window occurs. Targeted windows watch
// the pre-armed protected unit, which may be an ally rather than the reaction owner. Main
// and melee windows watch either that protected unit or an explicitly selected hostile
// source as validated below. A missing watched unit makes the arm fizzle; it never retargets.
// Reactions cannot open reaction windows; an unused arm expires when its owner next receives
// player priority.
export const ABILITY_V2_REACTION_WINDOW = "hostile-targeted-before-effects";
export const ABILITY_V2_REACTION_WINDOWS = Object.freeze([
  ABILITY_V2_REACTION_WINDOW,
  "hostile-targeted-after-effects",
  "hostile-main-before-effects",
  "hostile-melee-before-effects",
]);
export const ABILITY_V2_REACTION_WATCHES = Object.freeze([
  "selected-hostile-target",
  "selected-hostile-source",
]);

// Zone timing is a coherent event/phase pair. Enter zones tick immediately after a unit is
// placed; occupant-turn zones tick at that occupant's start or end boundary; round zones
// tick once for all matching occupants at the chosen round boundary. Occupant allegiance
// is always relative to the zone owner. Zone-producing effects measure lifetime in rounds:
// decrement after each round-end tick and remove at zero, so no reducer invents a clock.
export const ZONE_V2_TRIGGERS = Object.freeze(["enter", "occupant-turn", "round"]);
export const ZONE_V2_TICK_TIMINGS = Object.freeze(["after-enter", "start", "end"]);
export const ZONE_V2_STACKING_POLICIES = Object.freeze([
  "replace",
  "refresh-duration",
  "stack-potency",
]);
export const ZONE_V2_RECIPIENTS = Object.freeze([
  "all-occupants",
  "allied-occupants",
  "enemy-occupants",
]);
export const ZONE_V2_MOVEMENT_POLICIES = Object.freeze([
  "none",
  "block-entry",
  "block-exit",
  "block-both",
]);
// Policies apply to voluntary and forced movement one traversed cell at a time. A blocked
// boundary stops the move on its origin side; remaining displacement is discarded.
export const ZONE_V2_PAYLOAD_PRIMITIVES = Object.freeze([
  "damage",
  "heal",
  "shield",
  "status",
  "cleanse",
  "resource",
]);

const DEFINITION_KEYS = Object.freeze([
  "action",
  "effects",
  "id",
  "presentation",
  "rankCount",
  "rulesetId",
  "targeting",
  "version",
].sort());
const ACTION_KEYS = Object.freeze([
  "cooldownByRank",
  "lane",
  "reactionWatch",
  "reactionWindow",
  "resolveCostByRank",
].sort());
const TARGETING_KEYS = Object.freeze([
  "anchor",
  "area",
  "includeCaster",
  "side",
].sort());
const ANCHOR_KEYS = Object.freeze(["range", "shape", "tracking"].sort());
const AREA_KEYS = Object.freeze(["shape"].sort());
const PRESENTATION_KEYS = Object.freeze(["castMode", "tierByRank"].sort());
const EFFECT_KEYS = Object.freeze([
  "motion",
  "operation",
  "primitive",
  "recipient",
  "scalesFrom",
  "subject",
  "value",
].sort());
const VALUE_KEYS = Object.freeze(["basis", "byRank", "unit"].sort());
const ZONE_KEYS = Object.freeze([
  "id",
  "movementPolicy",
  "payload",
  "rankCount",
  "rulesetId",
  "stacking",
  "timing",
  "version",
].sort());
const ZONE_TIMING_KEYS = Object.freeze(["tick", "trigger"].sort());
const ZONE_STACKING_KEYS = Object.freeze(["cap", "policy"].sort());
const ZONE_PAYLOAD_KEYS = Object.freeze([
  "operation",
  "potency",
  "primitive",
  "recipient",
  "scalesFrom",
  "subject",
].sort());
const SUBJECT_PRIMITIVES = new Set(["status", "cleanse", "resource", "zone"]);
const INTEGER_UNITS = new Set(["stacks", "cells", "turns", "rounds"]);
const MOVEMENT_PRIMITIVES = new Set(["move", "push", "pull"]);
const OPERATIONS_BY_PRIMITIVE = Object.freeze({
  damage: Object.freeze(["deal"]),
  heal: Object.freeze(["restore"]),
  shield: Object.freeze(["grant"]),
  status: Object.freeze(["add", "scale", "subtract", "clear"]),
  cleanse: Object.freeze(["retain-percent", "subtract", "clear"]),
  resource: Object.freeze(["gain", "drain"]),
  move: Object.freeze(["move"]),
  push: Object.freeze(["push"]),
  pull: Object.freeze(["pull"]),
  zone: Object.freeze(["create"]),
});

function validStatusMutation(primitive, operation, value) {
  if (primitive === "status") {
    if (operation === "add") {
      return value.unit === "stacks"
        || (value.unit === "percent" && value.basis !== "none");
    }
    if (operation === "scale") {
      return value.unit === "percent" && value.basis === "none";
    }
    if (operation === "subtract") {
      return value.unit === "stacks" && value.basis === "none";
    }
    return operation === "clear"
      && value.unit === "flat"
      && value.basis === "none"
      && value.byRank.every((entry) => entry === 0);
  }
  if (primitive !== "cleanse") return true;
  if (operation === "retain-percent") {
    return value.unit === "percent"
      && value.basis === "none"
      && value.byRank.every((entry) => entry <= 100);
  }
  if (operation === "subtract") {
    return value.unit === "stacks" && value.basis === "none";
  }
  return operation === "clear"
    && value.unit === "flat"
    && value.basis === "none"
    && value.byRank.every((entry) => entry === 0);
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

function rankedNumbers(value, rankCount, { integers = false, positive = false } = {}) {
  return Array.isArray(value)
    && value.length === rankCount
    && value.every((entry) => (
      Number.isFinite(entry)
      && entry >= (positive ? 1 : 0)
      && (!integers || Number.isSafeInteger(entry))
    ));
}

function targetingReason(targeting) {
  if (!exactKeys(targeting, TARGETING_KEYS)) return "invalid-v2-targeting-shape";
  if (!ABILITY_V2_SIDES.includes(targeting.side)) return "invalid-v2-target-side";
  if (typeof targeting.includeCaster !== "boolean") return "invalid-v2-include-caster";
  if (!exactKeys(targeting.anchor, ANCHOR_KEYS)) return "invalid-v2-anchor-shape";
  if (!ABILITY_V2_ANCHOR_SHAPES.includes(targeting.anchor.shape)) {
    return "invalid-v2-anchor-shape";
  }
  if (!ABILITY_V2_ANCHOR_RANGES.includes(targeting.anchor.range)) {
    return "invalid-v2-anchor-range";
  }
  if (!ABILITY_V2_ANCHOR_TRACKING.includes(targeting.anchor.tracking)) {
    return "invalid-v2-anchor-tracking";
  }
  if (!exactKeys(targeting.area, AREA_KEYS)
    || !ABILITY_V2_AREA_SHAPES.includes(targeting.area.shape)) {
    return "invalid-v2-area-shape";
  }

  const selfAnchor = targeting.side === "self";
  if (selfAnchor && (
    targeting.anchor.shape !== "caster"
    || targeting.anchor.range !== "self"
    || targeting.anchor.tracking !== "unit"
    || !targeting.includeCaster
  )) return "incoherent-v2-self-targeting";
  if (!selfAnchor && (
    targeting.anchor.shape === "caster"
    || targeting.anchor.range === "self"
  )) return "incoherent-v2-remote-targeting";
  if (targeting.side === "enemy" && targeting.includeCaster) {
    return "incoherent-v2-enemy-targeting";
  }
  if ((targeting.anchor.shape === "caster" && targeting.anchor.tracking !== "unit")
    || (targeting.anchor.shape === "cell" && targeting.anchor.tracking !== "cell")) {
    return "incoherent-v2-anchor-tracking";
  }
  return null;
}

function effectReason(effect, rankCount) {
  if (!exactKeys(effect, EFFECT_KEYS)) return "invalid-v2-effect-shape";
  if (!ABILITY_V2_EFFECT_PRIMITIVES.includes(effect.primitive)) {
    return "invalid-v2-effect-primitive";
  }
  if (!ABILITY_V2_OPERATIONS.includes(effect.operation)
    || !OPERATIONS_BY_PRIMITIVE[effect.primitive].includes(effect.operation)) {
    return "invalid-v2-effect-operation";
  }
  if (!ABILITY_V2_RECIPIENTS.includes(effect.recipient)) {
    return "invalid-v2-effect-recipient";
  }
  if (effect.scalesFrom !== null && !ABILITY_V2_SCALE_SOURCES.includes(effect.scalesFrom)) {
    return "invalid-v2-effect-scale-source";
  }
  if (effect.motion !== null && !ABILITY_V2_MOTIONS.includes(effect.motion)) {
    return "invalid-v2-effect-motion";
  }
  const needsSubject = SUBJECT_PRIMITIVES.has(effect.primitive);
  if ((needsSubject && !identifier(effect.subject))
    || (!needsSubject && effect.subject !== null)) {
    return "invalid-v2-effect-subject";
  }
  if (effect.primitive === "resource" && !ABILITY_V2_RESOURCE_IDS.includes(effect.subject)) {
    return "unknown-v2-resource-id";
  }
  if (!exactKeys(effect.value, VALUE_KEYS)) return "invalid-v2-effect-value";
  if (!ABILITY_V2_VALUE_UNITS.includes(effect.value.unit)
    || !ABILITY_V2_VALUE_BASES.includes(effect.value.basis)) {
    return "invalid-v2-effect-value";
  }
  if ((effect.value.basis === "none" && effect.scalesFrom !== null)
    || (effect.value.basis !== "none" && effect.scalesFrom === null)) {
    return "incoherent-v2-effect-scaling";
  }

  const integerValues = INTEGER_UNITS.has(effect.value.unit);
  const positiveValues = MOVEMENT_PRIMITIVES.has(effect.primitive)
    || effect.primitive === "zone";
  if (!rankedNumbers(effect.value.byRank, rankCount, {
    integers: integerValues,
    positive: positiveValues,
  })) return "invalid-v2-effect-rank-values";

  if (MOVEMENT_PRIMITIVES.has(effect.primitive)) {
    if (effect.value.unit !== "cells" || effect.value.basis !== "none") {
      return "invalid-v2-movement-value";
    }
    if (effect.primitive === "move"
      && !["caster", "selected-units"].includes(effect.recipient)) {
      return "invalid-v2-movement-recipient";
    }
    if (effect.primitive === "move"
      && ![
        "to-anchor",
        "toward-anchor",
        "away-from-anchor",
        "nearest-empty-same-row",
      ].includes(effect.motion)) {
      return "invalid-v2-movement-motion";
    }
    if (["push", "pull"].includes(effect.primitive)
      && effect.recipient !== "selected-units") {
      return "invalid-v2-movement-recipient";
    }
    if (["push", "pull"].includes(effect.primitive)
      && effect.motion !== "source-target-vector") {
      return "invalid-v2-movement-motion";
    }
  } else if (effect.motion !== null) {
    return "invalid-v2-nonmovement-motion";
  }
  if (effect.primitive === "zone") {
    if (effect.recipient !== "selected-cells"
      || effect.value.unit !== "rounds"
      || effect.value.basis !== "none") {
      return "invalid-v2-zone-effect";
    }
  } else if (effect.recipient === "selected-cells") {
    return "invalid-v2-cell-recipient";
  }
  if (!validStatusMutation(effect.primitive, effect.operation, effect.value)) {
    return "invalid-v2-status-operation";
  }
  if (effect.primitive === "resource"
    && (effect.value.unit !== "flat" || effect.value.basis !== "none")) {
    return "invalid-v2-resource-value";
  }
  if (["damage", "heal", "shield"].includes(effect.primitive)
    && !["flat", "percent"].includes(effect.value.unit)) {
    return "invalid-v2-magnitude-value";
  }
  if (["damage", "heal", "shield"].includes(effect.primitive)
    && effect.value.unit === "percent"
    && effect.value.basis === "none") {
    return "invalid-v2-magnitude-scaling";
  }
  if (["flat", "stacks", "cells", "turns", "rounds"].includes(effect.value.unit)
    && effect.value.basis !== "none") {
    return "invalid-v2-effect-value-basis";
  }
  return null;
}

function validationReason(value) {
  if (!exactKeys(value, DEFINITION_KEYS)) return "invalid-ability-rules-v2-shape";
  if (value.version !== TOW_ABILITY_RULES_V2_VERSION) return "invalid-ability-rules-v2-version";
  if (value.rulesetId !== TOW_ABILITY_RULESET_V2_ID) return "invalid-ability-rules-v2-id";
  if (!identifier(value.id)) return "invalid-ability-rules-v2-ability-id";
  if (!Number.isSafeInteger(value.rankCount)
    || value.rankCount < 1
    || value.rankCount > TOW_ABILITY_RANK_MAX_V2) {
    return "invalid-ability-rules-v2-rank-count";
  }
  if (!exactKeys(value.action, ACTION_KEYS)) return "invalid-v2-action-shape";
  if (!ABILITY_V2_ACTION_LANES.includes(value.action.lane)) return "invalid-v2-action-lane";
  if (!rankedNumbers(value.action.resolveCostByRank, value.rankCount, { integers: true })) {
    return "invalid-v2-action-rank-values";
  }
  if (!rankedNumbers(value.action.cooldownByRank, value.rankCount, { integers: true })) {
    return "invalid-v2-action-cooldowns";
  }
  if (value.action.lane === "reaction") {
    if (!ABILITY_V2_REACTION_WINDOWS.includes(value.action.reactionWindow)) {
      return "invalid-v2-reaction-window";
    }
    if (!ABILITY_V2_REACTION_WATCHES.includes(value.action.reactionWatch)) {
      return "invalid-v2-reaction-watch";
    }
  } else if (value.action.reactionWindow !== null || value.action.reactionWatch !== null) {
    return "invalid-v2-nonreaction-window";
  }
  const targeting = targetingReason(value.targeting);
  if (targeting) return targeting;
  if (value.action.lane === "reaction") {
    const watchesTarget = value.action.reactionWatch === "selected-hostile-target";
    const targetWindows = [
      "hostile-targeted-before-effects",
      "hostile-targeted-after-effects",
      "hostile-melee-before-effects",
    ];
    if ((watchesTarget && !targetWindows.includes(value.action.reactionWindow))
      || (!watchesTarget && value.action.reactionWindow !== "hostile-main-before-effects")) {
      return "incoherent-v2-reaction-watch";
    }
    if ((watchesTarget && !["self", "ally"].includes(value.targeting.side))
      || (!watchesTarget && value.targeting.side !== "enemy")
      || value.targeting.anchor.tracking !== "unit"
      || !["caster", "occupied-cell"].includes(value.targeting.anchor.shape)) {
      return "incoherent-v2-reaction-targeting";
    }
  }
  if (!exactKeys(value.presentation, PRESENTATION_KEYS)) {
    return "invalid-v2-presentation-shape";
  }
  if (!ABILITY_V2_CAST_MODES.includes(value.presentation.castMode)) {
    return "invalid-v2-cast-mode";
  }
  if (!Array.isArray(value.presentation.tierByRank)
    || value.presentation.tierByRank.length !== value.rankCount
    || !value.presentation.tierByRank.every((tier) => (
      ABILITY_V2_PRESENTATION_TIERS.includes(tier)
    ))) {
    return "invalid-v2-presentation-tier";
  }
  if (!Array.isArray(value.effects) || value.effects.length === 0) {
    return "invalid-v2-effects";
  }
  for (const effect of value.effects) {
    const reason = effectReason(effect, value.rankCount);
    if (reason) return reason;
  }
  return null;
}

function zonePayloadReason(payload, rankCount) {
  if (!exactKeys(payload, ZONE_PAYLOAD_KEYS)) return "invalid-zone-v2-payload-shape";
  if (!ZONE_V2_PAYLOAD_PRIMITIVES.includes(payload.primitive)) {
    return "invalid-zone-v2-payload-primitive";
  }
  if (!ABILITY_V2_OPERATIONS.includes(payload.operation)
    || !OPERATIONS_BY_PRIMITIVE[payload.primitive].includes(payload.operation)) {
    return "invalid-zone-v2-payload-operation";
  }
  if (!ZONE_V2_RECIPIENTS.includes(payload.recipient)) {
    return "invalid-zone-v2-recipient";
  }
  if (payload.scalesFrom !== null
    && !ABILITY_V2_SCALE_SOURCES.includes(payload.scalesFrom)) {
    return "invalid-zone-v2-scale-source";
  }
  const needsSubject = ["status", "cleanse", "resource"].includes(payload.primitive);
  if ((needsSubject && !identifier(payload.subject))
    || (!needsSubject && payload.subject !== null)) {
    return "invalid-zone-v2-payload-subject";
  }
  if (payload.primitive === "resource"
    && !ABILITY_V2_RESOURCE_IDS.includes(payload.subject)) {
    return "unknown-zone-v2-resource-id";
  }
  if (!exactKeys(payload.potency, VALUE_KEYS)) return "invalid-zone-v2-potency";
  if (!["flat", "percent", "stacks"].includes(payload.potency.unit)
    || !ABILITY_V2_VALUE_BASES.includes(payload.potency.basis)) {
    return "invalid-zone-v2-potency";
  }
  if ((payload.potency.basis === "none" && payload.scalesFrom !== null)
    || (payload.potency.basis !== "none" && payload.scalesFrom === null)) {
    return "incoherent-zone-v2-scaling";
  }
  if (!rankedNumbers(payload.potency.byRank, rankCount, {
    integers: payload.potency.unit === "stacks",
  })) return "invalid-zone-v2-rank-values";
  if (["flat", "stacks"].includes(payload.potency.unit)
    && payload.potency.basis !== "none") {
    return "invalid-zone-v2-potency-basis";
  }
  if (!validStatusMutation(payload.primitive, payload.operation, payload.potency)) {
    return "invalid-zone-v2-status-operation";
  }
  if (payload.primitive === "resource"
    && (payload.potency.unit !== "flat" || payload.potency.basis !== "none")) {
    return "invalid-zone-v2-resource-potency";
  }
  if (["damage", "heal", "shield"].includes(payload.primitive)
    && payload.potency.unit === "percent"
    && payload.potency.basis === "none") {
    return "invalid-zone-v2-magnitude-scaling";
  }
  return null;
}

function zoneValidationReason(value) {
  if (!exactKeys(value, ZONE_KEYS)) return "invalid-zone-rules-v2-shape";
  if (value.version !== TOW_ABILITY_RULES_V2_VERSION) return "invalid-zone-rules-v2-version";
  if (value.rulesetId !== TOW_ABILITY_RULESET_V2_ID) return "invalid-zone-rules-v2-id";
  if (!identifier(value.id)) return "invalid-zone-rules-v2-zone-id";
  if (!ZONE_V2_MOVEMENT_POLICIES.includes(value.movementPolicy)) {
    return "invalid-zone-v2-movement-policy";
  }
  if (!Number.isSafeInteger(value.rankCount)
    || value.rankCount < 1
    || value.rankCount > TOW_ABILITY_RANK_MAX_V2) {
    return "invalid-zone-rules-v2-rank-count";
  }
  if (!exactKeys(value.timing, ZONE_TIMING_KEYS)) return "invalid-zone-v2-timing-shape";
  if (!ZONE_V2_TRIGGERS.includes(value.timing.trigger)) return "invalid-zone-v2-trigger";
  if (!ZONE_V2_TICK_TIMINGS.includes(value.timing.tick)) return "invalid-zone-v2-tick";
  if ((value.timing.trigger === "enter" && value.timing.tick !== "after-enter")
    || (value.timing.trigger !== "enter" && value.timing.tick === "after-enter")) {
    return "incoherent-zone-v2-timing";
  }
  if (!exactKeys(value.stacking, ZONE_STACKING_KEYS)) {
    return "invalid-zone-v2-stacking-shape";
  }
  if (!ZONE_V2_STACKING_POLICIES.includes(value.stacking.policy)) {
    return "invalid-zone-v2-stacking-policy";
  }
  if (value.stacking.policy === "stack-potency") {
    if (!Number.isSafeInteger(value.stacking.cap)
      || value.stacking.cap < 2
      || value.stacking.cap > 9) return "invalid-zone-v2-stacking-cap";
  } else if (value.stacking.cap !== null) {
    return "invalid-zone-v2-stacking-cap";
  }
  return zonePayloadReason(value.payload, value.rankCount);
}

function cloneDefinition(value) {
  return {
    version: value.version,
    rulesetId: value.rulesetId,
    id: value.id,
    rankCount: value.rankCount,
    action: {
      lane: value.action.lane,
      resolveCostByRank: [...value.action.resolveCostByRank],
      cooldownByRank: [...value.action.cooldownByRank],
      reactionWindow: value.action.reactionWindow,
      reactionWatch: value.action.reactionWatch,
    },
    targeting: {
      side: value.targeting.side,
      includeCaster: value.targeting.includeCaster,
      anchor: { ...value.targeting.anchor },
      area: { ...value.targeting.area },
    },
    presentation: {
      castMode: value.presentation.castMode,
      tierByRank: [...value.presentation.tierByRank],
    },
    effects: value.effects.map((effect) => ({
      primitive: effect.primitive,
      operation: effect.operation,
      recipient: effect.recipient,
      scalesFrom: effect.scalesFrom,
      subject: effect.subject,
      motion: effect.motion,
      value: {
        unit: effect.value.unit,
        basis: effect.value.basis,
        byRank: [...effect.value.byRank],
      },
    })),
  };
}

function cloneZoneDefinition(value) {
  return {
    version: value.version,
    rulesetId: value.rulesetId,
    id: value.id,
    rankCount: value.rankCount,
    movementPolicy: value.movementPolicy,
    timing: { ...value.timing },
    stacking: { ...value.stacking },
    payload: {
      primitive: value.payload.primitive,
      operation: value.payload.operation,
      recipient: value.payload.recipient,
      scalesFrom: value.payload.scalesFrom,
      subject: value.payload.subject,
      potency: {
        unit: value.payload.potency.unit,
        basis: value.payload.potency.basis,
        byRank: [...value.payload.potency.byRank],
      },
    },
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

/** Return a stable authoring failure without throwing. */
export function validateAbilityRulesV2(value) {
  const reason = validationReason(value);
  return Object.freeze({ ok: reason === null, reason });
}

export function isAbilityRulesV2(value) {
  return validationReason(value) === null;
}

/** Validate, detach, and deeply freeze one explicitly-authored v2 ability definition. */
export function defineAbilityRulesV2(value) {
  const result = validateAbilityRulesV2(value);
  if (!result.ok) throw new TypeError(result.reason);
  return deepFreeze(cloneDefinition(value));
}

/** Validate one zone's deterministic event, stacking, recipient, and potency contract. */
export function validateZoneRulesV2(value) {
  const reason = zoneValidationReason(value);
  return Object.freeze({ ok: reason === null, reason });
}

export function isZoneRulesV2(value) {
  return zoneValidationReason(value) === null;
}

// Stacking is resolved per owner + zone id + cell. `replace` overwrites potency and
// duration. `refresh-duration` uses the newest cast's resolved potency and authored
// duration. `stack-potency` adds potency up to `cap` applications and retains the greater
// duration.
export function defineZoneRulesV2(value) {
  const result = validateZoneRulesV2(value);
  if (!result.ok) throw new TypeError(result.reason);
  return deepFreeze(cloneZoneDefinition(value));
}

/** Build a lookup used to resolve a zone effect's `subject` id without fallback behavior. */
export function defineZoneRulesV2Registry(values) {
  if (!Array.isArray(values)) throw new TypeError("invalid-zone-rules-v2-registry");
  const entries = values.map(defineZoneRulesV2);
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) {
    throw new TypeError("duplicate-zone-rules-v2-id");
  }
  return deepFreeze(Object.fromEntries(entries.map((entry) => [entry.id, entry])));
}

export function isZoneRulesV2Registry(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(([id, definition]) => (
    id === definition?.id && isZoneRulesV2(definition)
  ));
}

/** Fail closed when a zone-producing ability is not backed by this pinned registry. */
export function validateAbilityZoneReferencesV2(value, registry) {
  const abilityReason = validationReason(value);
  if (abilityReason) return Object.freeze({ ok: false, reason: abilityReason });
  if (!isZoneRulesV2Registry(registry)) {
    return Object.freeze({ ok: false, reason: "invalid-zone-rules-v2-registry" });
  }
  for (const effect of value.effects) {
    if (effect.primitive !== "zone") continue;
    const zone = registry[effect.subject];
    if (!zone) return Object.freeze({ ok: false, reason: "unknown-zone-rules-v2-id" });
    if (zone.rankCount !== value.rankCount) {
      return Object.freeze({ ok: false, reason: "zone-rules-v2-rank-count-mismatch" });
    }
  }
  return Object.freeze({ ok: true, reason: null });
}

export function zoneRulesV2AtRank(value, rank) {
  const definition = defineZoneRulesV2(value);
  if (!Number.isSafeInteger(rank) || rank < 1 || rank > definition.rankCount) {
    throw new TypeError("invalid-zone-rules-v2-rank");
  }
  return deepFreeze({
    version: definition.version,
    rulesetId: definition.rulesetId,
    id: definition.id,
    rank,
    rankCount: definition.rankCount,
    movementPolicy: definition.movementPolicy,
    timing: { ...definition.timing },
    stacking: { ...definition.stacking },
    payload: {
      primitive: definition.payload.primitive,
      operation: definition.payload.operation,
      recipient: definition.payload.recipient,
      scalesFrom: definition.payload.scalesFrom,
      subject: definition.payload.subject,
      potency: {
        unit: definition.payload.potency.unit,
        basis: definition.payload.potency.basis,
        amount: definition.payload.potency.byRank[rank - 1],
      },
    },
  });
}

/** Resolve every rank table without losing the pinned v2 ruleset identity. */
export function abilityRulesV2AtRank(value, rank) {
  const definition = defineAbilityRulesV2(value);
  if (!Number.isSafeInteger(rank) || rank < 1 || rank > definition.rankCount) {
    throw new TypeError("invalid-ability-rules-v2-rank");
  }
  const index = rank - 1;
  return deepFreeze({
    version: definition.version,
    rulesetId: definition.rulesetId,
    id: definition.id,
    rank,
    rankCount: definition.rankCount,
    action: {
      lane: definition.action.lane,
      resolveCost: definition.action.resolveCostByRank[index],
      cooldown: definition.action.cooldownByRank[index],
      reactionWindow: definition.action.reactionWindow,
      reactionWatch: definition.action.reactionWatch,
    },
    targeting: cloneDefinition(definition).targeting,
    presentation: {
      castMode: definition.presentation.castMode,
      tier: definition.presentation.tierByRank[index],
    },
    effects: definition.effects.map((effect) => ({
      primitive: effect.primitive,
      operation: effect.operation,
      recipient: effect.recipient,
      scalesFrom: effect.scalesFrom,
      subject: effect.subject,
      motion: effect.motion,
      value: {
        unit: effect.value.unit,
        basis: effect.value.basis,
        amount: effect.value.byRank[index],
      },
    })),
  });
}
