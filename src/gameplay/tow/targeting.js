// Authoritative spatial targeting for Tower combat.
//
// Formation geometry is deliberately separate from ability semantics: the former answers
// "which cells?", while `ability-targeting.js` answers "which side and what shape?". Both
// the UI preview and the encounter reducer call this module so a highlighted footprint can
// never disagree with the actors the command actually affects.

import {
  FORMATION_CELLS,
  actorAtCell,
  cellForActor,
  footprintCells,
  formationRow,
  isFormationRulesVersion,
  livingActorIds,
  normalizeFormation,
  STATIC_FORMATION_RULES_VERSION,
} from "./formation.js";
import { abilityTargeting } from "./ability-targeting.js";
import { getSkill } from "./skills.js";

export const FORMATION_SIDES = Object.freeze(["player", "enemy"]);

function opposingSide(side) {
  return side === "player" ? "enemy" : "player";
}

function definitionOf(skillOrDefinition) {
  const definition = typeof skillOrDefinition === "string"
    ? getSkill(skillOrDefinition)
    : skillOrDefinition;
  if (!definition) throw new TypeError("unknown-skill");
  return definition;
}

function actorIdsForSide(state, side) {
  return side === "player"
    ? [state.playerId, ...(state.allyIds || [])]
    : [...(state.enemyIds || [])];
}

/** Return normalized formations without mutating an older encounter that has no snapshot. */
export function encounterFormations(state) {
  if (!state || typeof state !== "object") throw new TypeError("invalid-encounter");
  const supplied = state.formations;
  if (supplied !== undefined && (
    !supplied || typeof supplied !== "object" || Array.isArray(supplied)
  )) throw new TypeError("invalid-formations");
  // Absence is the supported legacy shape. Once a snapshot key exists, its rules version
  // must be explicit so malformed current state cannot silently acquire static v1 semantics.
  const version = supplied === undefined
    ? STATIC_FORMATION_RULES_VERSION
    : supplied.version;
  if (!isFormationRulesVersion(version)) throw new TypeError("invalid-formation-version");
  return {
    version,
    player: normalizeFormation(
      actorIdsForSide(state, "player"),
      supplied?.player || null,
    ),
    enemy: normalizeFormation(
      actorIdsForSide(state, "enemy"),
      supplied?.enemy || null,
    ),
  };
}

/** Strict enough for encounter/session schema validation while accepting no hidden data. */
export function isEncounterFormations(value, state) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || !isFormationRulesVersion(value.version)) {
    return false;
  }
  if (Object.keys(value).sort().join(",") !== "enemy,player,version") return false;
  try {
    const normalized = encounterFormations({ ...state, formations: value });
    return FORMATION_SIDES.every((side) => (
      Array.isArray(value[side])
      && value[side].length === 9
      && value[side].every((entry, index) => entry === normalized[side][index])
    ));
  } catch {
    return false;
  }
}

export function formationCellForActor(state, actorId) {
  const actor = state?.actors?.[actorId];
  if (!actor || !FORMATION_SIDES.includes(actor.side)) return null;
  const formations = encounterFormations(state);
  const index = cellForActor(formations[actor.side], actorId);
  return index === null ? null : { side: actor.side, index };
}

function targetFormationSide(actorSide, anchorSide) {
  return anchorSide === "enemy" ? opposingSide(actorSide) : actorSide;
}

function normalizeAnchor(anchorCell, side) {
  if (Number.isSafeInteger(anchorCell)) return { side, index: anchorCell };
  if (!anchorCell || typeof anchorCell !== "object" || Array.isArray(anchorCell)) return null;
  return {
    side: anchorCell.side || side,
    index: anchorCell.index,
  };
}

function livingInFootprint(state, formation, anchor, footprint) {
  return livingActorIds(formation, state.actors, footprintCells(anchor, footprint));
}

/**
 * Legal anchors for one actor/ability, in stable row-major order.
 *
 * `melee` means the nearest occupied rank on the opposing side. A front rank that has been
 * wiped out therefore exposes the middle rank without moving any character or invalidating
 * a telegraphed cell. Area abilities may anchor an empty cell when their footprint still
 * reaches a living actor; single-target skills require an occupied anchor.
 */
export function legalSkillAnchors(state, skillOrDefinition, actorId = state.playerId) {
  const actor = state?.actors?.[actorId];
  if (!actor || actor.hp <= 0 || !FORMATION_SIDES.includes(actor.side)) return [];
  const definition = definitionOf(skillOrDefinition);
  const targeting = abilityTargeting(definition);
  const formations = encounterFormations(state);
  const side = targetFormationSide(actor.side, targeting.anchorSide);
  const formation = formations[side];
  const sourceIndex = cellForActor(formations[actor.side], actorId);
  if (sourceIndex === null) return [];

  let candidates;
  if (targeting.footprint === "all") {
    // The anchor is geometrically irrelevant; using the centre gives keyboard and screen
    // reader users one honest confirmation target rather than nine identical choices.
    candidates = [4];
  } else if (targeting.reach === "self" || targeting.anchorSide === "self") {
    candidates = [sourceIndex];
  } else if (targeting.reach === "melee" && side !== actor.side) {
    const occupied = FORMATION_CELLS.filter((index) => (
      state.actors[formation[index]]?.hp > 0
    ));
    const frontRow = occupied.length > 0
      ? Math.min(...occupied.map(formationRow))
      : null;
    candidates = frontRow === null
      ? []
      : FORMATION_CELLS.filter((index) => formationRow(index) === frontRow);
  } else {
    candidates = [...FORMATION_CELLS];
  }

  return candidates.flatMap((index) => {
    const occupant = actorAtCell(formation, index);
    const occupied = Boolean(occupant && state.actors[occupant]?.hp > 0);
    const reachesLiving = livingInFootprint(state, formation, index, targeting.footprint).length > 0;
    if (targeting.anchorPolicy === "occupied" && !occupied) return [];
    if (targeting.anchorSide !== "self" && !reachesLiving) return [];
    return [{ side, index }];
  });
}

/** Resolve an anchor to the exact cells and living actor ids that a command will affect. */
export function resolveSkillTargets(
  state,
  skillOrDefinition,
  actorId = state.playerId,
  { anchorCell = null, targetId = null } = {},
) {
  const actor = state?.actors?.[actorId];
  if (!actor || actor.hp <= 0 || !FORMATION_SIDES.includes(actor.side)) {
    return { ok: false, reason: "unknown-actor" };
  }
  const definition = definitionOf(skillOrDefinition);
  const targeting = abilityTargeting(definition);
  const formations = encounterFormations(state);
  const side = targetFormationSide(actor.side, targeting.anchorSide);
  const sourceIndex = cellForActor(formations[actor.side], actorId);
  const legalAnchors = legalSkillAnchors(state, definition, actorId);

  let requested = normalizeAnchor(anchorCell, side);
  if (!requested && targeting.footprint === "all") {
    requested = legalAnchors[0] || null;
  } else if (!requested && targetId) {
    const target = state.actors[targetId];
    if (target?.side === side) {
      const index = cellForActor(formations[side], targetId);
      if (index !== null) requested = { side, index };
    }
  }
  if (!requested) requested = legalAnchors[0] || null;
  const legal = requested && legalAnchors.some((entry) => (
    entry.side === requested.side && entry.index === requested.index
  ));
  if (!legal) return { ok: false, reason: legalAnchors.length > 0 ? "invalid-target" : "no-target" };

  const indexes = footprintCells(requested.index, targeting.footprint);
  const affectsAllCombatants = definition.effects.some((effect) => effect.target === "all");
  let targetIds = affectsAllCombatants
    ? FORMATION_SIDES.flatMap((formationSide) => (
      livingActorIds(formations[formationSide], state.actors, FORMATION_CELLS)
    ))
    : livingActorIds(formations[side], state.actors, indexes);
  if (targeting.anchorSide === "self" && !affectsAllCombatants) {
    targetIds = targetIds.filter((id) => id === actorId);
  }
  if (targetIds.length === 0) return { ok: false, reason: "no-target" };
  const primaryTargetId = targetIds.includes(targetId)
    ? targetId
    : affectsAllCombatants && targetIds.includes(actorId) ? actorId : targetIds[0];
  const affectedCells = affectsAllCombatants
    ? FORMATION_SIDES.flatMap((formationSide) => (
      FORMATION_CELLS.map((index) => ({ side: formationSide, index }))
    ))
    : indexes.map((index) => ({ side, index }));

  return {
    ok: true,
    reason: null,
    targeting,
    sourceCell: { side: actor.side, index: sourceIndex },
    anchorCell: requested,
    affectedCells,
    targetIds,
    primaryTargetId,
  };
}
