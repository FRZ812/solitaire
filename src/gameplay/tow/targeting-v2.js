// Pure targeting for rank-resolved solitaire-tow-v2 abilities.
//
// The module owns geometry and the target snapshot only. It never resolves v1 skills,
// mutates encounter state, spends action economy, expands per-effect recipients, or
// substitutes a later occupant. Reducers can therefore compose one immutable target commit
// with their own economy and effect primitives without creating a second targeting truth.

import {
  TOW_ABILITY_RULESET_V2_ID,
  TOW_ABILITY_RULES_V2_VERSION,
} from "./ability-rules-v2.js";
import {
  FORMATION_CELLS,
  MOVING_FORMATION_RULES_VERSION,
  actorAtCell,
  cellForActor,
  footprintCells,
  formationRow,
  livingOccupants,
} from "./formation.js";

export const TOW_TARGET_COMMIT_V2_VERSION = 1;
export const TOW_TARGET_LOCK_V2_VERSION = 1;
export const TOW_FORMATION_SIDES_V2 = Object.freeze(["player", "enemy"]);

const TARGET_SIDES = new Set(["self", "ally", "enemy"]);
const ANCHOR_SHAPES = new Set(["caster", "occupied-cell", "cell"]);
const ANCHOR_RANGES = new Set(["self", "adjacent", "melee", "ranged", "global"]);
const ANCHOR_TRACKING = new Set(["unit", "cell"]);
const AREA_SHAPES = new Set(["single", "row", "column", "cross-short", "cross-full", "all"]);
const LOCK_KEYS = Object.freeze([
  "abilityId",
  "anchor",
  "casterId",
  "rank",
  "rulesetId",
  "version",
].sort());
const LOCK_ANCHOR_KEYS = Object.freeze(["actorId", "index", "side", "tracking"].sort());

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

function actorId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 256;
}

function cellIndex(value) {
  return Number.isSafeInteger(value) && value >= 0 && value < FORMATION_CELLS.length;
}

function oppositeSide(side) {
  return side === "player" ? "enemy" : "player";
}

function isRankResolvedAbilityV2(value) {
  return Boolean(
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && value.version === TOW_ABILITY_RULES_V2_VERSION
    && value.rulesetId === TOW_ABILITY_RULESET_V2_ID
    && actorId(value.id)
    && Number.isSafeInteger(value.rank)
    && value.rank >= 1
    && Number.isSafeInteger(value.rankCount)
    && value.rank <= value.rankCount
    && value.targeting
    && TARGET_SIDES.has(value.targeting.side)
    && typeof value.targeting.includeCaster === "boolean"
    && value.targeting.anchor
    && ANCHOR_SHAPES.has(value.targeting.anchor.shape)
    && ANCHOR_RANGES.has(value.targeting.anchor.range)
    && ANCHOR_TRACKING.has(value.targeting.anchor.tracking)
    && value.targeting.area
    && AREA_SHAPES.has(value.targeting.area.shape)
    && Array.isArray(value.effects)
    && value.effects.length > 0
    && value.effects.every((effect) => (
      effect && typeof effect === "object" && typeof effect.recipient === "string"
    ))
  );
}

function assertResolvedAbility(value) {
  if (!isRankResolvedAbilityV2(value)) throw new TypeError("invalid-resolved-ability-v2");
  return value;
}

function assertTargetState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)
    || !state.actors || typeof state.actors !== "object" || Array.isArray(state.actors)
    || !state.formations || typeof state.formations !== "object"
    || state.formations.version !== MOVING_FORMATION_RULES_VERSION) {
    throw new TypeError("invalid-v2-target-state");
  }

  const fielded = new Set();
  try {
    for (const side of TOW_FORMATION_SIDES_V2) {
      for (const index of FORMATION_CELLS) {
        const id = actorAtCell(state.formations[side], index);
        if (id === null) continue;
        const actor = state.actors[id];
        if (fielded.has(id)
          || !actor || actor.id !== id || actor.side !== side
          || !Number.isFinite(actor.hp)) {
          throw new TypeError("invalid-v2-target-state");
        }
        fielded.add(id);
      }
    }
  } catch (error) {
    if (error instanceof TypeError && error.message === "invalid-v2-target-state") throw error;
    throw new TypeError("invalid-v2-target-state");
  }
  return state;
}

function actorCell(state, id) {
  const actor = state.actors[id];
  if (!actor || !TOW_FORMATION_SIDES_V2.includes(actor.side)) return null;
  const index = cellForActor(state.formations[actor.side], id);
  return index === null ? null : { side: actor.side, index };
}

function livingActorAt(state, side, index) {
  const id = actorAtCell(state.formations[side], index);
  const actor = id === null ? null : state.actors[id];
  return actor && actor.side === side && actor.hp > 0 ? actor : null;
}

function livingOnSide(state, side) {
  return livingOccupants(state.formations[side], state.actors).map(({ cell, actorId: id }) => ({
    actorId: id,
    side,
    index: cell,
  }));
}

function targetFormationSide(casterSide, declaredSide) {
  return declaredSide === "enemy" ? oppositeSide(casterSide) : casterSide;
}

function rangeCandidates(state, ability, caster) {
  const { targeting } = ability;
  const sourceCell = actorCell(state, caster.id);
  if (!sourceCell) return [];
  const side = targetFormationSide(caster.side, targeting.side);

  if (targeting.anchor.range === "self") return [sourceCell.index];
  if (targeting.anchor.range === "adjacent") {
    // Each side owns an independently oriented board, so cross-side adjacency has no
    // coherent cell edge. Authored v2 adjacent actions are allied; hostile ones fail closed.
    return side === caster.side ? footprintCells(sourceCell.index, "cross-short") : [];
  }
  if (targeting.anchor.range === "melee") {
    if (side === caster.side) return footprintCells(sourceCell.index, "cross-short");
    const living = livingOnSide(state, side);
    if (living.length === 0) return [];
    // Row zero faces the opposing formation for both sides. Rendering may mirror enemies,
    // but rules geometry does not, so the lowest occupied row is always the exposed rank.
    const exposedRow = Math.min(...living.map(({ index }) => formationRow(index)));
    return FORMATION_CELLS.filter((index) => formationRow(index) === exposedRow);
  }
  return [...FORMATION_CELLS];
}

function eligibleSelectedUnits(state, ability, caster, side, indexes) {
  return livingOccupants(state.formations[side], state.actors, indexes)
    .filter(({ actorId: selectedId }) => ability.targeting.includeCaster
      || selectedId !== caster.id)
    .map(({ cell, actorId: selectedId }) => ({
      side,
      index: cell,
      actorId: selectedId,
    }));
}

function supportsEmptySelection(ability) {
  // A selected-cells primitive (currently a zone) has meaningful work even with no current
  // occupant. Pure unit fields must reach at least one eligible living recipient.
  return ability.effects.some((effect) => effect.recipient === "selected-cells");
}

function legalAnchors(state, ability, caster) {
  const { targeting } = ability;
  const side = targetFormationSide(caster.side, targeting.side);
  let candidates = rangeCandidates(state, ability, caster);

  // Every cell is equivalent for a whole-field cell lock. Canonicalizing to the centre
  // avoids nine duplicate commands without losing unit-tracked reaction identity.
  if (targeting.area.shape === "all" && targeting.anchor.shape === "cell"
    && candidates.length > 0) {
    candidates = [candidates.includes(4) ? 4 : candidates[0]];
  }

  return candidates.flatMap((index) => {
    const occupant = livingActorAt(state, side, index);
    if (targeting.anchor.shape === "caster" && occupant?.id !== caster.id) return [];
    if (targeting.anchor.shape === "occupied-cell" && !occupant) return [];
    if (!targeting.includeCaster && occupant?.id === caster.id) return [];

    const cells = footprintCells(index, targeting.area.shape);
    const reachesEligible = eligibleSelectedUnits(state, ability, caster, side, cells).length > 0;
    if (targeting.anchor.shape === "cell"
      && !reachesEligible
      && !supportsEmptySelection(ability)) return [];

    return [{
      tracking: targeting.anchor.tracking,
      side,
      index,
      actorId: occupant?.id || null,
    }];
  });
}

/** Return explicit v2 anchors in stable row-major order. */
export function legalAbilityAnchorsV2(state, ability, casterId) {
  assertTargetState(state);
  assertResolvedAbility(ability);
  const caster = actorId(casterId) ? state.actors[casterId] : null;
  if (!caster || caster.hp <= 0 || !actorCell(state, casterId)) return Object.freeze([]);
  return deepFreeze(legalAnchors(state, ability, caster));
}

function normalizedAnchor(state, ability, caster, anchor) {
  const tracking = ability.targeting.anchor.tracking;
  const side = targetFormationSide(caster.side, ability.targeting.side);

  if (tracking === "unit") {
    const selectedId = typeof anchor === "string" ? anchor : anchor?.actorId;
    if (!actorId(selectedId)) return null;
    const current = actorCell(state, selectedId);
    const selected = state.actors[selectedId];
    return selected?.hp > 0 && current?.side === side
      ? { tracking, side, index: current.index, actorId: selectedId }
      : null;
  }

  const candidate = Number.isSafeInteger(anchor)
    ? { side, index: anchor }
    : anchor;
  return candidate
    && candidate.side === side
    && cellIndex(candidate.index)
    ? { tracking, side, index: candidate.index, actorId: null }
    : null;
}

/**
 * Validate one declaration and persist only its authored tracking identity.
 *
 * No first-target fallback exists: commands, telegraphs, and reactions must carry the exact
 * player-selected lock. Unit locks discard the declaration cell so they can follow that
 * actor. Cell locks discard the occupant so they can never follow or substitute one.
 */
export function lockAbilityTargetV2(state, ability, casterId, anchor) {
  try {
    assertTargetState(state);
    assertResolvedAbility(ability);
  } catch (error) {
    return deepFreeze({
      ok: false,
      reason: error instanceof TypeError ? error.message : "invalid-v2-target",
    });
  }

  const caster = actorId(casterId) ? state.actors[casterId] : null;
  const sourceCell = caster?.hp > 0 ? actorCell(state, casterId) : null;
  if (!caster || !sourceCell) {
    return deepFreeze({ ok: false, reason: "invalid-v2-caster" });
  }
  const requested = normalizedAnchor(state, ability, caster, anchor);
  if (!requested) {
    return deepFreeze({
      ok: false,
      reason: ability.targeting.anchor.tracking === "unit"
        ? "lost-v2-unit-anchor"
        : "invalid-v2-target",
    });
  }

  const legal = legalAnchors(state, ability, caster);
  const accepted = legal.find((candidate) => (
    candidate.side === requested.side
    && candidate.index === requested.index
    && (requested.tracking === "cell" || candidate.actorId === requested.actorId)
  ));
  if (!accepted) return deepFreeze({ ok: false, reason: "invalid-v2-target" });

  const lock = {
    version: TOW_TARGET_LOCK_V2_VERSION,
    rulesetId: TOW_ABILITY_RULESET_V2_ID,
    abilityId: ability.id,
    rank: ability.rank,
    casterId,
    anchor: {
      tracking: accepted.tracking,
      side: accepted.side,
      index: accepted.tracking === "cell" ? accepted.index : null,
      actorId: accepted.tracking === "unit" ? accepted.actorId : null,
    },
  };
  return deepFreeze({ ok: true, reason: null, lock });
}

export function isAbilityTargetLockV2(value) {
  if (!exactKeys(value, LOCK_KEYS)
    || value.version !== TOW_TARGET_LOCK_V2_VERSION
    || value.rulesetId !== TOW_ABILITY_RULESET_V2_ID
    || !actorId(value.abilityId)
    || !actorId(value.casterId)
    || !Number.isSafeInteger(value.rank) || value.rank < 1
    || !exactKeys(value.anchor, LOCK_ANCHOR_KEYS)
    || !TOW_FORMATION_SIDES_V2.includes(value.anchor.side)
    || !ANCHOR_TRACKING.has(value.anchor.tracking)) return false;

  if (value.anchor.tracking === "unit") {
    return actorId(value.anchor.actorId) && value.anchor.index === null;
  }
  return value.anchor.actorId === null && cellIndex(value.anchor.index);
}

function resolveLockedAnchor(state, ability, caster, lock) {
  const expectedSide = targetFormationSide(caster.side, ability.targeting.side);
  if (lock.anchor.side !== expectedSide
    || lock.anchor.tracking !== ability.targeting.anchor.tracking) return null;

  if (lock.anchor.tracking === "cell") {
    return {
      tracking: "cell",
      side: lock.anchor.side,
      index: lock.anchor.index,
      actorId: null,
    };
  }
  const current = actorCell(state, lock.anchor.actorId);
  const selected = state.actors[lock.anchor.actorId];
  if (!selected || selected.hp <= 0 || current?.side !== lock.anchor.side) return null;
  if (ability.targeting.anchor.shape === "caster" && selected.id !== caster.id) return null;
  if (!ability.targeting.includeCaster && selected.id === caster.id) return null;
  return {
    tracking: "unit",
    side: current.side,
    index: current.index,
    actorId: selected.id,
  };
}

/**
 * Commit a previously validated lock to immutable cells and unit ids.
 *
 * Range is intentionally not rechecked. Unit tracking promises to follow a still-living,
 * still-fielded actor to its current cell; cell tracking promises to remain at the declared
 * side/index. Leaving combat is the unit fizzle condition. After this snapshot, reducers
 * must never substitute a new occupant for a selected unit id.
 */
export function commitAbilityTargetsV2(state, ability, lock) {
  try {
    assertTargetState(state);
    assertResolvedAbility(ability);
  } catch (error) {
    return deepFreeze({
      ok: false,
      reason: error instanceof TypeError ? error.message : "invalid-v2-target",
    });
  }
  if (!isAbilityTargetLockV2(lock)) {
    return deepFreeze({ ok: false, reason: "invalid-v2-target-lock" });
  }
  if (lock.abilityId !== ability.id
    || lock.rank !== ability.rank
    || lock.rulesetId !== ability.rulesetId) {
    return deepFreeze({ ok: false, reason: "v2-target-lock-mismatch" });
  }

  const casterId = lock.casterId;
  const caster = state.actors[casterId];
  const sourceCell = caster?.hp > 0 ? actorCell(state, casterId) : null;
  if (!caster || !sourceCell) {
    return deepFreeze({ ok: false, reason: "invalid-v2-caster" });
  }
  const accepted = resolveLockedAnchor(state, ability, caster, lock);
  if (!accepted) {
    return deepFreeze({
      ok: false,
      reason: lock.anchor.tracking === "unit"
        ? "lost-v2-unit-anchor"
        : "v2-target-lock-mismatch",
    });
  }

  const cellIndexes = footprintCells(accepted.index, ability.targeting.area.shape);
  const selectedCells = cellIndexes.map((index) => ({ side: accepted.side, index }));
  const selectedUnits = eligibleSelectedUnits(
    state,
    ability,
    caster,
    accepted.side,
    cellIndexes,
  );
  const result = {
    ok: true,
    reason: null,
    version: TOW_TARGET_COMMIT_V2_VERSION,
    rulesetId: TOW_ABILITY_RULESET_V2_ID,
    abilityId: ability.id,
    rank: ability.rank,
    casterId,
    sourceCell,
    anchor: {
      tracking: accepted.tracking,
      side: accepted.side,
      index: accepted.index,
      actorId: accepted.tracking === "unit" ? accepted.actorId : null,
    },
    selectedCells,
    selectedUnits,
  };
  return deepFreeze(result);
}
