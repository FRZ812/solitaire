// Deterministic round-boundary reflow for moving (formation rules v2) Archetype fights.
//
// Movement is deliberately narrower than targeting. It never rolls, never chooses an
// ability for the player, and never edits the authored opening formation. Once a round has
// fully resolved, each living actor may take one same-column step toward the row implied by
// their flexible hostile loadout. Every proposal reads the same pre-move snapshot, so an
// actor cannot follow another through a cell vacated in this phase or exchange places with
// them. Roster order is the total tie-break when two actors want the same empty cell.

import { abilityTargeting } from "./ability-targeting.js";
import {
  MOVING_FORMATION_RULES_VERSION,
  formationRow,
} from "./formation.js";
import { getSkill } from "./skills.js";

const FLEXIBLE_ABILITY_TYPES = new Set(["archetype", "general"]);
const FRONT_ROW = 0;
const MIDDLE_ROW = 1;
const REAR_ROW = 2;
const ROW_STEP = 3;

function buildForActor(state, actorId) {
  if (actorId === state.playerId) return state.build;
  return state.allyBuilds?.[actorId] || state.enemyBuilds?.[actorId] || null;
}

function hostilePosture(build, currentRow) {
  let hasMelee = false;
  let hasRangedOrField = false;

  for (const held of build?.skills || []) {
    const definition = getSkill(typeof held === "string" ? held : held?.id);
    if (!definition || !FLEXIBLE_ABILITY_TYPES.has(definition.abilityType)) continue;
    const targeting = abilityTargeting(definition);
    // Self, ally, and support actions do not pull a combatant out of their authored row.
    if (targeting.anchorSide !== "enemy" || targeting.castMode === "support") continue;
    if (targeting.castMode === "melee") hasMelee = true;
    if (targeting.castMode === "projectile" || targeting.castMode === "field") {
      hasRangedOrField = true;
    }
  }

  if (hasMelee && hasRangedOrField) return MIDDLE_ROW;
  if (hasMelee) return FRONT_ROW;
  if (hasRangedOrField) return REAR_ROW;
  return currentRow;
}

function sideProposals(state, side, actorIds, formation) {
  const proposals = [];
  const claimed = new Set();

  for (const actorId of actorIds) {
    const actor = state.actors?.[actorId];
    if (!actor || actor.hp <= 0) continue;
    const fromCell = formation.indexOf(actorId);
    if (fromCell < 0) continue;
    const currentRow = formationRow(fromCell);
    const preferredRow = hostilePosture(buildForActor(state, actorId), currentRow);
    if (preferredRow === currentRow) continue;

    const toCell = fromCell + (preferredRow < currentRow ? -ROW_STEP : ROW_STEP);
    // Only a cell that was truly vacant before anybody moved can receive a proposal. A
    // defeated actor remains a non-null occupant and therefore continues to block it.
    if (formation[toCell] !== null || claimed.has(toCell)) continue;
    claimed.add(toCell);
    proposals.push({ actorId, side, fromCell, toCell });
  }

  return proposals;
}

function applyMoves(formation, moves) {
  if (moves.length === 0) return formation;
  const next = [...formation];
  for (const move of moves) next[move.fromCell] = null;
  for (const move of moves) next[move.toCell] = move.actorId;
  return next;
}

/**
 * Compute one atomic v2 reflow. The input state and both formation arrays are never mutated.
 *
 * @returns {{formations: object, moves: Array<object>}}
 */
export function reflowCombatFormations(state) {
  const formations = state?.formations;
  if (formations?.version !== MOVING_FORMATION_RULES_VERSION) {
    return { formations, moves: [] };
  }

  const playerIds = [state.playerId, ...(state.allyIds || [])];
  const enemyIds = [...(state.enemyIds || [])];
  const playerMoves = sideProposals(state, "player", playerIds, formations.player);
  const enemyMoves = sideProposals(state, "enemy", enemyIds, formations.enemy);
  const moves = [...playerMoves, ...enemyMoves];
  if (moves.length === 0) return { formations, moves };

  return {
    formations: {
      ...formations,
      player: applyMoves(formations.player, playerMoves),
      enemy: applyMoves(formations.enemy, enemyMoves),
    },
    moves,
  };
}
