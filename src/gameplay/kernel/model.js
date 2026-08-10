import { cloneJsonData } from "./json-data.js";
import { encounterIntentFromState, isIntentState } from "./intent.js";
import { createRng } from "./rng.js";
import { getReferenceAction } from "../reference/actions.js";
import { REFERENCE_POLICY } from "../reference/policy.js";
import {
  createReferenceSkillState,
  getReferenceSkill,
  MAX_SKILL_SLOTS,
} from "../reference/skills.js";

const ENCOUNTER_PHASES = new Set(["player", "enemy", "victory", "defeat"]);

function finiteNonNegative(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`invalid-${label}`);
  }
  return value;
}

function actor(input, side) {
  if (!input?.id || !input?.name) throw new TypeError("invalid-actor");
  const maxHp = finiteNonNegative(input.maxHp, "max-hp");
  if (maxHp <= 0) throw new TypeError("invalid-max-hp");
  const hp = Math.min(maxHp, finiteNonNegative(input.hp, "hp"));
  const actionIds = input.actions || [];
  if (!Array.isArray(actionIds) || !actionIds.every((id) => getReferenceAction(id))) {
    throw new TypeError("invalid-actions");
  }
  const skillIds = side === "player" ? input.skills || [] : [];
  if (!Array.isArray(skillIds)) throw new TypeError("invalid-skills");
  if (skillIds.length > MAX_SKILL_SLOTS) throw new TypeError("too-many-skills");
  if (input.statuses !== undefined && !Array.isArray(input.statuses)) {
    throw new TypeError("invalid-statuses");
  }
  return {
    id: input.id,
    name: input.name,
    side,
    hp,
    maxHp,
    guard: finiteNonNegative(input.guard ?? 0, "guard"),
    stats: {
      attack: finiteNonNegative(input.stats?.attack ?? 0, "attack"),
      defense: finiteNonNegative(input.stats?.defense ?? 0, "defense"),
    },
    actions: [...actionIds],
    skills: skillIds.map(createReferenceSkillState),
    statuses: cloneJsonData(input.statuses || [], "invalid-statuses"),
    ...(input.intent ? { intent: cloneJsonData(input.intent, "invalid-enemy-intent") } : {}),
    ...(input.intentState ? {
      intentState: cloneJsonData(input.intentState, "invalid-intent-state"),
    } : {}),
  };
}

function validStatus(status) {
  return status
    && typeof status === "object"
    && !Array.isArray(status)
    && typeof status.type === "string"
    && status.type.length > 0
    && (status.duration === null || (
      typeof status.duration === "number"
      && Number.isFinite(status.duration)
      && status.duration >= 0
    ))
    && (status.breakOnDamage === undefined || typeof status.breakOnDamage === "boolean");
}

function validSkillState(skill, round) {
  const definition = getReferenceSkill(skill?.id);
  if (!definition) return false;
  const validUses = definition.usesPerEncounter === null
    ? skill.usesRemaining === null
    : Number.isInteger(skill.usesRemaining)
      && skill.usesRemaining >= 0
      && skill.usesRemaining <= definition.usesPerEncounter;
  return validUses
    && Number.isInteger(skill.cooldownRemaining)
    && skill.cooldownRemaining >= 0
    && skill.cooldownRemaining <= definition.cooldown
    && (skill.cooldownSetRound === null || (
      Number.isInteger(skill.cooldownSetRound)
      && skill.cooldownSetRound >= 1
      && skill.cooldownSetRound <= round
    ));
}

function validActor(value, expectedId, side, round) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && typeof value.id === "string"
    && value.id.length > 0
    && value.id === expectedId
    && typeof value.name === "string"
    && value.name.length > 0
    && value.side === side
    && typeof value.maxHp === "number"
    && Number.isFinite(value.maxHp)
    && value.maxHp > 0
    && typeof value.hp === "number"
    && Number.isFinite(value.hp)
    && value.hp >= 0
    && value.hp <= value.maxHp
    && typeof value.guard === "number"
    && Number.isFinite(value.guard)
    && value.guard >= 0
    && value.stats
    && [value.stats.attack, value.stats.defense].every((stat) => (
      typeof stat === "number" && Number.isFinite(stat) && stat >= 0
    ))
    && Array.isArray(value.actions)
    && value.actions.every((actionId) => typeof actionId === "string" && getReferenceAction(actionId))
    && Array.isArray(value.skills)
    && value.skills.length <= MAX_SKILL_SLOTS
    && value.skills.every((skill) => validSkillState(skill, round))
    && Array.isArray(value.statuses)
    && value.statuses.every(validStatus);
}

function validIntent(intent, playerId) {
  return intent
    && typeof intent === "object"
    && !Array.isArray(intent)
    && typeof intent.id === "string"
    && intent.id.length > 0
    && intent.type === "attack"
    && intent.targetId === playerId
    && intent.damage
    && typeof intent.damage.min === "number"
    && Number.isFinite(intent.damage.min)
    && intent.damage.min >= 0
    && typeof intent.damage.max === "number"
    && Number.isFinite(intent.damage.max)
    && intent.damage.max >= intent.damage.min;
}

function validIntentSchedule(actorValue, playerId) {
  if (actorValue.intentState === undefined) return true;
  if (!isIntentState(actorValue.intentState)) return false;
  try {
    return JSON.stringify(actorValue.intent) === JSON.stringify(
      encounterIntentFromState(actorValue.intentState, playerId),
    );
  } catch {
    return false;
  }
}

function validEvents(events, sequence, round) {
  if (!Array.isArray(events) || !Number.isInteger(sequence) || sequence < 0) return false;
  if (events.length !== sequence) return false;
  return events.every((event, index) => (
    event
    && typeof event === "object"
    && !Array.isArray(event)
    && event.sequence === index + 1
    && Number.isInteger(event.round)
    && event.round >= 1
    && event.round <= round
    && typeof event.type === "string"
    && event.type.length > 0
  ));
}

function validEncounterSnapshot(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return false;
  if (
    state.version !== 1
    || state.baselineVersion !== REFERENCE_POLICY.id
    || !ENCOUNTER_PHASES.has(state.phase)
    || !Number.isInteger(state.round)
    || state.round < 1
    || state.rng?.algorithm !== "mulberry32"
    || !Number.isInteger(state.rng?.state)
    || state.rng.state < 0
    || state.rng.state > 0xFFFFFFFF
    || typeof state.playerId !== "string"
    || !Array.isArray(state.enemyIds)
    || state.enemyIds.length === 0
    || new Set(state.enemyIds).size !== state.enemyIds.length
    || !state.actors
    || typeof state.actors !== "object"
    || Array.isArray(state.actors)
    || !validEvents(state.events, state.sequence, state.round)
  ) return false;

  const expectedIds = new Set([state.playerId, ...state.enemyIds]);
  if (
    Object.keys(state.actors).length !== expectedIds.size
    || Object.keys(state.actors).some((actorId) => !expectedIds.has(actorId))
    || !validActor(state.actors[state.playerId], state.playerId, "player", state.round)
  ) return false;

  return state.enemyIds.every((enemyId) => {
    const enemy = state.actors[enemyId];
    return validActor(enemy, enemyId, "enemy", state.round)
      && validIntent(enemy.intent, state.playerId)
      && validIntentSchedule(enemy, state.playerId);
  });
}

export function isEncounterState(value) {
  try {
    return validEncounterSnapshot(cloneJsonData(value, "invalid-encounter-state"));
  } catch {
    return false;
  }
}

export function createEncounter(input = {}) {
  let request;
  try {
    request = cloneJsonData(input, "invalid-encounter-input");
  } catch {
    throw new TypeError("invalid-encounter-input");
  }
  const { seed, player, enemy } = request;
  if (typeof seed !== "string" && !(typeof seed === "number" && Number.isFinite(seed))) {
    throw new TypeError("invalid-encounter-seed");
  }
  const playerActor = actor(player, "player");
  const enemyActor = actor(enemy, "enemy");
  if (playerActor.id === enemyActor.id) throw new TypeError("duplicate-actor-id");
  if (!enemyActor.intent?.id || enemyActor.intent.targetId !== playerActor.id) {
    throw new TypeError("invalid-enemy-intent");
  }
  const state = {
    version: 1,
    baselineVersion: REFERENCE_POLICY.id,
    phase: "player",
    round: 1,
    sequence: 0,
    rng: createRng(seed),
    playerId: playerActor.id,
    enemyIds: [enemyActor.id],
    actors: {
      [playerActor.id]: playerActor,
      [enemyActor.id]: enemyActor,
    },
    events: [],
  };
  if (!isEncounterState(state)) throw new TypeError("invalid-encounter-input");
  return state;
}
