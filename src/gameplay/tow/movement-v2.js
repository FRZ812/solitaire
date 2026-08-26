// Pure stepwise movement authority for solitaire-tow-v2.
//
// Movement is resolved only against the v2 3x3 formations. Rendering may mirror either
// formation, but the shared world projection below is authoritative for facing vectors:
// enemy rows occupy y=2..0 and player rows occupy y=3..5. A result contains detached
// formations plus declarative zone-enter ticks; actor HP/status application remains the
// composite reducer's responsibility.

import {
  TOW_ABILITY_RULESET_V2_ID,
} from "./ability-rules-v2.js";
import {
  FORMATION_CELLS,
  FORMATION_WIDTH,
  MOVING_FORMATION_RULES_VERSION,
  actorAtCell,
  cellForActor,
  formationColumn,
  formationRow,
} from "./formation.js";
import {
  collectTowZoneTicksV2,
  validateTowZoneStateV2,
  zoneMovementBlockersV2,
} from "./zones-v2.js";

export const TOW_MOVEMENT_V2_VERSION = 1;
export const TOW_MOVEMENT_SIDES_V2 = Object.freeze(["player", "enemy"]);
export const TOW_MOVEMENT_STOP_REASONS_V2 = Object.freeze([
  "boundary",
  "occupied",
  "zone-block-exit",
  "zone-block-entry",
]);
export const TOW_MOVEMENT_POLICY_V2 = deepFreeze({
  coordinates: "x-column-player-y-3-plus-row-enemy-y-2-minus-row",
  quantization: "orthogonal-vertical-wins-ties",
  traversal: "one-cell-at-a-time-no-diagonal-reroute-swap-cascade-or-cross-side",
  sourceTargetVector: "committed-source-cell-to-committed-recipient-cell",
  push: "along-source-target-vector",
  pull: "against-source-target-vector",
  awayFromAnchor: "along-anchor-to-committed-recipient-vector",
  towardAnchor: "recompute-shortest-orthogonal-step",
  toAnchor: "exact-same-side-destination-within-ranked-distance",
  nearestEmptySameRow: "shortest-distance-then-lower-cell-index",
  statusAllowance: "caller-supplied-allowedCells-caps-authored-distance",
  boundaryOrder: ["board", "zone-exit", "occupancy", "zone-entry"],
  zoneEnterTiming: "after-successful-step",
});

const EFFECT_KEYS = Object.freeze([
  "motion",
  "operation",
  "primitive",
  "recipient",
  "scalesFrom",
  "subject",
  "value",
].sort());
const VALUE_KEYS = Object.freeze(["amount", "basis", "unit"].sort());
const CONTEXT_KEYS = Object.freeze([
  "anchor",
  "casterId",
  "committedRecipient",
  "moverId",
  "sourceCell",
].sort());
const CELL_KEYS = Object.freeze(["index", "side"].sort());
const COMMITTED_RECIPIENT_KEYS = Object.freeze(["actorId", "index", "side"].sort());
const POINT_KEYS = Object.freeze(["x", "y"].sort());
const MOVEMENT_PRIMITIVES = new Set(["move", "push", "pull"]);
const MOVE_MOTIONS = new Set([
  "to-anchor",
  "toward-anchor",
  "away-from-anchor",
  "nearest-empty-same-row",
]);
const VECTOR_MOTIONS = new Set(["to-anchor", "toward-anchor", "away-from-anchor"]);
const OPTION_KEYS = new Set(["allowedCells", "registry", "zones"]);

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

function side(value) {
  return TOW_MOVEMENT_SIDES_V2.includes(value);
}

function cellIndex(value) {
  return Number.isSafeInteger(value) && FORMATION_CELLS.includes(value);
}

function validCell(value) {
  return exactKeys(value, CELL_KEYS) && side(value.side) && cellIndex(value.index);
}

function validCommittedRecipient(value) {
  return exactKeys(value, COMMITTED_RECIPIENT_KEYS)
    && actorIdentifier(value.actorId)
    && side(value.side)
    && cellIndex(value.index);
}

function cloneFormations(formations) {
  return {
    version: formations.version,
    player: [...formations.player],
    enemy: [...formations.enemy],
  };
}

function immutableFormations(formations) {
  return deepFreeze(cloneFormations(formations));
}

function result(ok, reason, formations, movement = null, ticks = [], events = []) {
  return deepFreeze({ ok, reason, formations, movement, ticks, events });
}

function failure(reason, formations = null) {
  return result(false, reason, formations);
}

function stateReason(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)
    || !state.actors || typeof state.actors !== "object" || Array.isArray(state.actors)
    || !state.formations || typeof state.formations !== "object"
    || Array.isArray(state.formations)
    || state.formations.version !== MOVING_FORMATION_RULES_VERSION) {
    return "invalid-movement-state-v2";
  }
  const seen = new Set();
  try {
    for (const formationSide of TOW_MOVEMENT_SIDES_V2) {
      for (const index of FORMATION_CELLS) {
        const id = actorAtCell(state.formations[formationSide], index);
        if (id === null) continue;
        const actor = state.actors[id];
        if (seen.has(id)
          || !actor || actor.id !== id || actor.side !== formationSide
          || !Number.isFinite(actor.hp)) return "invalid-movement-state-v2";
        seen.add(id);
      }
    }
  } catch {
    return "invalid-movement-state-v2";
  }
  return null;
}

export function validateTowMovementStateV2(state) {
  const reason = stateReason(state);
  return Object.freeze({ ok: reason === null, reason });
}

function effectReason(effect) {
  if (!exactKeys(effect, EFFECT_KEYS) || !exactKeys(effect.value, VALUE_KEYS)) {
    return "invalid-movement-effect-v2-shape";
  }
  if (!MOVEMENT_PRIMITIVES.has(effect.primitive)
    || effect.operation !== effect.primitive
    || effect.scalesFrom !== null
    || effect.subject !== null
    || effect.value.unit !== "cells"
    || effect.value.basis !== "none"
    || !Number.isSafeInteger(effect.value.amount)
    || effect.value.amount < 1) return "invalid-movement-effect-v2";
  if (effect.primitive === "move") {
    if (!["caster", "selected-units"].includes(effect.recipient)
      || !MOVE_MOTIONS.has(effect.motion)) return "invalid-movement-effect-v2";
  } else if (effect.recipient !== "selected-units"
    || effect.motion !== "source-target-vector") {
    return "invalid-movement-effect-v2";
  }
  return null;
}

export function validateTowMovementEffectV2(effect) {
  const reason = effectReason(effect);
  return Object.freeze({ ok: reason === null, reason });
}

function contextReason(context, effect) {
  if (!exactKeys(context, CONTEXT_KEYS)
    || !actorIdentifier(context.casterId)
    || !actorIdentifier(context.moverId)
    || !validCell(context.sourceCell)
    || (context.committedRecipient !== null
      && !validCommittedRecipient(context.committedRecipient))
    || (context.anchor !== null && !validCell(context.anchor))) {
    return "invalid-movement-context-v2";
  }
  if (VECTOR_MOTIONS.has(effect.motion) !== (context.anchor !== null)) {
    return "invalid-movement-context-v2-anchor";
  }
  if (["push", "pull"].includes(effect.primitive) && context.anchor !== null) {
    return "invalid-movement-context-v2-anchor";
  }
  if ((effect.recipient === "selected-units")
    !== (context.committedRecipient !== null)) {
    return "invalid-movement-context-v2-recipient-snapshot";
  }
  if (effect.recipient === "caster" && context.casterId !== context.moverId) {
    return "invalid-movement-context-v2-recipient";
  }
  return null;
}

export function validateTowMovementContextV2(context, effect) {
  const effectValidation = validateTowMovementEffectV2(effect);
  if (!effectValidation.ok) return effectValidation;
  const reason = contextReason(context, effect);
  return Object.freeze({ ok: reason === null, reason });
}

/** Project one side-local formation cell into the shared facing coordinate plane. */
export function formationCellWorldPositionV2(formationSide, index) {
  if (!side(formationSide) || !cellIndex(index)) {
    throw new TypeError("invalid-movement-cell-v2");
  }
  const row = formationRow(index);
  return Object.freeze({
    x: formationColumn(index),
    y: formationSide === "player" ? 3 + row : 2 - row,
  });
}

/** Resolve a world coordinate to a cell on one side, or null at/crossing its boundary. */
function worldPositionCell(formationSide, point) {
  const row = formationSide === "player" ? point.y - 3 : 2 - point.y;
  if (!Number.isSafeInteger(point.x)
    || !Number.isSafeInteger(row)
    || point.x < 0 || point.x >= FORMATION_WIDTH
    || row < 0 || row >= FORMATION_WIDTH) return null;
  return (row * FORMATION_WIDTH) + point.x;
}

/** Quantize a vector to one orthogonal step; vertical wins exact magnitude ties. */
export function quantizeOrthogonalDirectionV2(from, to) {
  if (!exactKeys(from, POINT_KEYS) || !exactKeys(to, POINT_KEYS)
    || !Number.isSafeInteger(from.x) || !Number.isSafeInteger(from.y)
    || !Number.isSafeInteger(to.x) || !Number.isSafeInteger(to.y)) {
    throw new TypeError("invalid-movement-vector-v2");
  }
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return null;
  return Object.freeze(Math.abs(dy) >= Math.abs(dx)
    ? { dx: 0, dy: Math.sign(dy) }
    : { dx: Math.sign(dx), dy: 0 });
}

function actorCell(state, id) {
  const actor = state.actors[id];
  if (!actor || !side(actor.side)) return null;
  const index = cellForActor(state.formations[actor.side], id);
  return index === null ? null : { side: actor.side, index };
}

function offsetCell(cell, direction) {
  const point = formationCellWorldPositionV2(cell.side, cell.index);
  const nextIndex = worldPositionCell(cell.side, {
    x: point.x + direction.dx,
    y: point.y + direction.dy,
  });
  return nextIndex === null ? null : { side: cell.side, index: nextIndex };
}

function vectorDirection(fromCell, toCell) {
  return quantizeOrthogonalDirectionV2(
    formationCellWorldPositionV2(fromCell.side, fromCell.index),
    formationCellWorldPositionV2(toCell.side, toCell.index),
  );
}

function invertDirection(direction) {
  return direction === null ? null : { dx: -direction.dx, dy: -direction.dy };
}

function manhattanDistance(left, right) {
  const a = formationCellWorldPositionV2(left.side, left.index);
  const b = formationCellWorldPositionV2(right.side, right.index);
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function nearestEmptySameRow(formations, moverCell, distance) {
  const row = formationRow(moverCell.index);
  return FORMATION_CELLS
    .filter((index) => (
      formationRow(index) === row
      && index !== moverCell.index
      && formations[moverCell.side][index] === null
      && Math.abs(formationColumn(index) - formationColumn(moverCell.index)) <= distance
    ))
    .sort((left, right) => (
      Math.abs(formationColumn(left) - formationColumn(moverCell.index))
      - Math.abs(formationColumn(right) - formationColumn(moverCell.index))
      || left - right
    ))[0] ?? null;
}

function stoppedEvent(context, effect, sideValue, step, from, to, reason, blockers = []) {
  return {
    type: "movement-stopped",
    actorId: context.moverId,
    casterId: context.casterId,
    sourceCell: { ...context.sourceCell },
    committedRecipient: context.committedRecipient === null
      ? null
      : { ...context.committedRecipient },
    anchor: context.anchor === null ? null : { ...context.anchor },
    side: sideValue,
    primitive: effect.primitive,
    motion: effect.motion,
    step,
    from,
    to,
    reason,
    blockers,
  };
}

function movementSummary(context, effect, fromCell, currentCell, requestedDistance,
  allowedDistance, plannedDistance, goalIndex, steps, stoppedReason) {
  return {
    version: TOW_MOVEMENT_V2_VERSION,
    rulesetId: TOW_ABILITY_RULESET_V2_ID,
    actorId: context.moverId,
    casterId: context.casterId,
    sourceCell: { ...context.sourceCell },
    committedRecipient: context.committedRecipient === null
      ? null
      : { ...context.committedRecipient },
    anchor: context.anchor === null ? null : { ...context.anchor },
    side: fromCell.side,
    primitive: effect.primitive,
    motion: effect.motion,
    fromIndex: fromCell.index,
    toIndex: currentCell.index,
    requestedDistance,
    allowedDistance,
    plannedDistance,
    movedDistance: steps.length,
    goalIndex,
    completed: stoppedReason === null,
    stoppedReason,
    steps,
  };
}

/**
 * Resolve one ranked movement effect against current v2 formations.
 *
 * `effect` is one rank-resolved ability effect. `anchor` is deliberately just the durable
 * committed cell projection needed by anchor motions. `sourceCell` and
 * `committedRecipient` are the target plan's immutable endpoints; source-target-vector
 * never falls back to either actor's later cell. Traversal still begins at the mover's
 * current cell. Zone ticks are snapshots only and are not applied.
 */
export function resolveTowMovementV2(
  state,
  effect,
  context,
  options = {},
) {
  const stateValidation = validateTowMovementStateV2(state);
  if (!stateValidation.ok) return failure(stateValidation.reason);
  const initialFormations = immutableFormations(state.formations);
  const effectValidation = validateTowMovementEffectV2(effect);
  if (!effectValidation.ok) return failure(effectValidation.reason, initialFormations);
  const contextValidation = validateTowMovementContextV2(context, effect);
  if (!contextValidation.ok) return failure(contextValidation.reason, initialFormations);
  if (!options || typeof options !== "object" || Array.isArray(options)
    || Object.keys(options).some((key) => !OPTION_KEYS.has(key))) {
    return failure("invalid-movement-options-v2", initialFormations);
  }
  const zones = options.zones ?? null;
  const registry = options.registry;
  const allowedDistance = options.allowedCells ?? effect.value.amount;
  if (!Number.isSafeInteger(allowedDistance)
    || allowedDistance < 0
    || allowedDistance > effect.value.amount
    || (registry !== undefined && zones === null)) {
    return failure("invalid-movement-options-v2", initialFormations);
  }
  if (zones !== null) {
    const zoneValidation = validateTowZoneStateV2(zones, registry);
    if (!zoneValidation.ok) return failure(zoneValidation.reason, initialFormations);
  }

  const caster = state.actors[context.casterId];
  const mover = state.actors[context.moverId];
  const casterCell = actorCell(state, context.casterId);
  const moverCell = actorCell(state, context.moverId);
  if (!caster || !mover || caster.hp <= 0 || mover.hp <= 0 || !casterCell || !moverCell) {
    return failure("movement-actor-not-living-and-fielded-v2", initialFormations);
  }
  if (context.sourceCell.side !== caster.side) {
    return failure("movement-source-cell-side-mismatch-v2", initialFormations);
  }
  if (context.committedRecipient !== null
    && (context.committedRecipient.actorId !== context.moverId
      || context.committedRecipient.side !== mover.side)) {
    return failure("movement-recipient-snapshot-mismatch-v2", initialFormations);
  }

  const requestedDistance = effect.value.amount;
  let goalIndex = null;
  let plannedDistance = allowedDistance;
  let fixedDirection = null;
  let recomputeToward = false;

  if (allowedDistance === 0) {
    return result(
      true,
      null,
      initialFormations,
      movementSummary(
        context,
        effect,
        moverCell,
        moverCell,
        requestedDistance,
        allowedDistance,
        0,
        null,
        [],
        null,
      ),
    );
  }

  if (["push", "pull"].includes(effect.primitive)) {
    const sourceTarget = vectorDirection(context.sourceCell, context.committedRecipient);
    if (sourceTarget === null) {
      return failure("movement-source-target-vector-zero-v2", initialFormations);
    }
    fixedDirection = effect.primitive === "push" ? sourceTarget : invertDirection(sourceTarget);
  } else if (effect.motion === "away-from-anchor") {
    fixedDirection = vectorDirection(
      context.anchor,
      context.committedRecipient ?? context.sourceCell,
    );
    if (fixedDirection === null) {
      return failure("movement-anchor-vector-zero-v2", initialFormations);
    }
  } else if (["to-anchor", "toward-anchor"].includes(effect.motion)) {
    if (effect.motion === "to-anchor") {
      if (context.anchor.side !== moverCell.side) {
        return failure("movement-to-anchor-cross-side-v2", initialFormations);
      }
      const distance = manhattanDistance(moverCell, context.anchor);
      if (distance > requestedDistance) {
        return failure("movement-to-anchor-out-of-distance-v2", initialFormations);
      }
      if (distance > allowedDistance) {
        return failure("movement-to-anchor-out-of-allowed-distance-v2", initialFormations);
      }
      plannedDistance = distance;
      goalIndex = context.anchor.index;
    }
    recomputeToward = true;
  } else {
    goalIndex = nearestEmptySameRow(initialFormations, moverCell, allowedDistance);
    if (goalIndex === null) {
      return failure("movement-no-empty-same-row-v2", initialFormations);
    }
    const goal = { side: moverCell.side, index: goalIndex };
    plannedDistance = manhattanDistance(moverCell, goal);
    fixedDirection = vectorDirection(moverCell, goal);
  }

  const formations = cloneFormations(initialFormations);
  const steps = [];
  const ticks = [];
  const events = [];
  let current = { ...moverCell };
  let stoppedReason = null;

  for (let ordinal = 1; ordinal <= plannedDistance; ordinal += 1) {
    if (goalIndex !== null && current.side === moverCell.side && current.index === goalIndex) break;
    const direction = recomputeToward ? vectorDirection(current, context.anchor) : fixedDirection;
    if (direction === null) break;
    const next = offsetCell(current, direction);
    if (next === null) {
      stoppedReason = "boundary";
      events.push(stoppedEvent(
        context,
        effect,
        moverCell.side,
        ordinal,
        { ...current },
        null,
        stoppedReason,
      ));
      break;
    }

    let zoneBoundary = null;
    if (zones !== null) {
      zoneBoundary = zoneMovementBlockersV2(zones, {
        actorId: context.moverId,
        actorSide: mover.side,
        from: { ...current },
        to: { ...next },
      }, registry === undefined ? {} : { registry });
      if (!zoneBoundary.ok) return failure(zoneBoundary.reason, initialFormations);
      if (zoneBoundary.detail.blockExit) {
        stoppedReason = "zone-block-exit";
        events.push(stoppedEvent(
          context,
          effect,
          moverCell.side,
          ordinal,
          { ...current },
          { ...next },
          stoppedReason,
          zoneBoundary.detail.blockers.filter(({ boundary }) => boundary === "exit"),
        ));
        break;
      }
    }

    const occupyingActorId = formations[moverCell.side][next.index];
    if (occupyingActorId !== null && occupyingActorId !== context.moverId) {
      stoppedReason = "occupied";
      events.push({
        ...stoppedEvent(
          context,
          effect,
          moverCell.side,
          ordinal,
          { ...current },
          { ...next },
          stoppedReason,
        ),
        occupyingActorId,
      });
      break;
    }
    if (zoneBoundary?.detail.blockEntry) {
      stoppedReason = "zone-block-entry";
      events.push(stoppedEvent(
        context,
        effect,
        moverCell.side,
        ordinal,
        { ...current },
        { ...next },
        stoppedReason,
        zoneBoundary.detail.blockers.filter(({ boundary }) => boundary === "entry"),
      ));
      break;
    }

    formations[moverCell.side][current.index] = null;
    formations[moverCell.side][next.index] = context.moverId;
    let enterTicks = [];
    if (zones !== null) {
      const entered = collectTowZoneTicksV2(zones, {
        timing: "after-enter",
        occupants: [{
          actorId: context.moverId,
          actorSide: mover.side,
          side: next.side,
          index: next.index,
        }],
      }, registry === undefined ? {} : { registry });
      if (!entered.ok) return failure(entered.reason, initialFormations);
      enterTicks = entered.ticks;
      ticks.push(...enterTicks);
    }
    const step = {
      ordinal,
      from: { ...current },
      to: { ...next },
      enterTicks,
    };
    steps.push(step);
    events.push({
      type: "unit-moved",
      actorId: context.moverId,
      casterId: context.casterId,
      side: moverCell.side,
      primitive: effect.primitive,
      motion: effect.motion,
      ordinal,
      from: { ...current },
      to: { ...next },
      forced: effect.primitive !== "move",
    });
    current = next;
  }

  if (stoppedReason === null && goalIndex !== null && current.index !== goalIndex) {
    // Defensive invariant: an exact goal can only finish by occupying that exact cell.
    return failure("movement-goal-not-reached-v2", initialFormations);
  }

  const nextFormations = immutableFormations(formations);
  return result(
    true,
    null,
    nextFormations,
    movementSummary(
      context,
      effect,
      moverCell,
      current,
      requestedDistance,
      allowedDistance,
      plannedDistance,
      goalIndex,
      steps,
      stoppedReason,
    ),
    ticks,
    events,
  );
}
