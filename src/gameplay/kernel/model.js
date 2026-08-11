import { cloneJsonData, equalJsonData } from "./json-data.js";
import { encounterIntentFromState, isIntentState } from "./intent.js";
import { createRng } from "./rng.js";
import { getCombatRuleAction, snapshotCombatRules } from "./rules.js";
import { getReferenceAction } from "../reference/actions.js";
import { REFERENCE_POLICY } from "../reference/policy.js";
import {
  createReferenceSkillState,
  getReferenceSkill,
  MAX_SKILL_SLOTS,
} from "../reference/skills.js";

const ENCOUNTER_PHASES = new Set(["player", "victory", "defeat"]);
export const MAX_ENCOUNTER_EVENTS = 20_000;

function finiteNonNegative(value, label) {
  if (
    typeof value !== "number"
    || !Number.isFinite(value)
    || value < 0
    || value > Number.MAX_SAFE_INTEGER
  ) {
    throw new TypeError(`invalid-${label}`);
  }
  return value;
}

function actor(input, side, actionFor, allowSkills) {
  if (!input?.id || !input?.name) throw new TypeError("invalid-actor");
  const maxHp = finiteNonNegative(input.maxHp, "max-hp");
  if (maxHp <= 0) throw new TypeError("invalid-max-hp");
  const hp = Math.min(maxHp, finiteNonNegative(input.hp, "hp"));
  const actionIds = input.actions || [];
  if (
    !Array.isArray(actionIds)
    || !actionIds.every((id) => typeof id === "string" && actionFor(id))
  ) {
    throw new TypeError("invalid-actions");
  }
  const skillIds = side === "player" ? input.skills || [] : [];
  if (!Array.isArray(skillIds)) throw new TypeError("invalid-skills");
  if (!allowSkills && skillIds.length > 0) throw new TypeError("invalid-skills");
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
    ...(side === "enemy" ? {
      intent: input.intent ? cloneJsonData(input.intent, "invalid-enemy-intent") : null,
      intentState: input.intentState
        ? cloneJsonData(input.intentState, "invalid-intent-state")
        : null,
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
      && status.duration <= Number.MAX_SAFE_INTEGER
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

function validActor(value, expectedId, side, round, actionFor, allowSkills) {
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
    && value.maxHp <= Number.MAX_SAFE_INTEGER
    && typeof value.hp === "number"
    && Number.isFinite(value.hp)
    && value.hp >= 0
    && value.hp <= value.maxHp
    && typeof value.guard === "number"
    && Number.isFinite(value.guard)
    && value.guard >= 0
    && value.guard <= Number.MAX_SAFE_INTEGER
    && value.stats
    && [value.stats.attack, value.stats.defense].every((stat) => (
      typeof stat === "number"
        && Number.isFinite(stat)
        && stat >= 0
        && stat <= Number.MAX_SAFE_INTEGER
    ))
    && Array.isArray(value.actions)
    && value.actions.every((actionId) => typeof actionId === "string" && actionFor(actionId))
    && Array.isArray(value.skills)
    && (allowSkills || value.skills.length === 0)
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
    && intent.damage.min <= Number.MAX_SAFE_INTEGER
    && typeof intent.damage.max === "number"
    && Number.isFinite(intent.damage.max)
    && intent.damage.max >= intent.damage.min
    && intent.damage.max <= Number.MAX_SAFE_INTEGER;
}

function validIntentSchedule(actorValue, playerId) {
  if (actorValue.intentState == null) return true;
  if (!isIntentState(actorValue.intentState)) return false;
  try {
    return equalJsonData(actorValue.intent,
      encounterIntentFromState(actorValue.intentState, playerId),
    );
  } catch {
    return false;
  }
}

function hasSafeJsonNumbers(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
  }
  if (!value || typeof value !== "object") return true;
  return Object.values(value).every(hasSafeJsonNumbers);
}

function validEvents(events, sequence, round) {
  if (!Array.isArray(events) || !Number.isSafeInteger(sequence) || sequence < 0) return false;
  if (events.length > MAX_ENCOUNTER_EVENTS) return false;
  if (events.length !== sequence) return false;
  return events.every((event, index) => (
    event
    && typeof event === "object"
    && !Array.isArray(event)
    && event.sequence === index + 1
    && Number.isSafeInteger(event.round)
    && event.round >= 1
    && event.round <= round
    && typeof event.type === "string"
    && event.type.length > 0
    && hasSafeJsonNumbers(event)
  ));
}

function validEncounterSnapshot(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return false;
  const embeddedRules = state.version === 2 ? snapshotCombatRules(state.rules) : null;
  const actionFor = embeddedRules
    ? (actionId) => embeddedRules.actions.find((action) => action.id === actionId) || null
    : getReferenceAction;
  const validVersion = state.version === 1
    ? state.baselineVersion === REFERENCE_POLICY.id
    : state.version === 2
      && embeddedRules
      && state.baselineVersion === embeddedRules.id;
  if (
    !validVersion
    || !ENCOUNTER_PHASES.has(state.phase)
    || !Number.isSafeInteger(state.round)
    || state.round < 1
    || state.rng?.algorithm !== "mulberry32"
    || !Number.isInteger(state.rng?.state)
    || state.rng.state < 0
    || state.rng.state > 0xFFFFFFFF
    || typeof state.playerId !== "string"
    || !Array.isArray(state.enemyIds)
    || state.enemyIds.length !== 1
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
    || !validActor(
      state.actors[state.playerId],
      state.playerId,
      "player",
      state.round,
      actionFor,
      state.version === 1,
    )
  ) return false;

  const player = state.actors[state.playerId];
  const livingEnemyCount = state.enemyIds.filter((enemyId) => state.actors[enemyId]?.hp > 0).length;
  if (state.phase === "victory" && (player.hp <= 0 || livingEnemyCount !== 0)) return false;
  if (state.phase === "defeat" && player.hp !== 0) return false;
  if ((state.phase === "player" || state.phase === "enemy")
    && (player.hp <= 0 || livingEnemyCount === 0)) return false;

  const terminal = state.phase === "victory" || state.phase === "defeat";
  return state.enemyIds.every((enemyId) => {
    const enemy = state.actors[enemyId];
    if (!validActor(enemy, enemyId, "enemy", state.round, actionFor, state.version === 1)) return false;
    if (terminal) return enemy.intent === null && enemy.intentState === null;
    return validIntent(enemy.intent, state.playerId) && validIntentSchedule(enemy, state.playerId);
  });
}

export function isEncounterState(value) {
  try {
    return validEncounterSnapshot(cloneJsonData(value, "invalid-encounter-state"));
  } catch {
    return false;
  }
}

export function getEncounterAction(state, actionId) {
  if (state?.version === 2) return getCombatRuleAction(state.rules, actionId);
  return getReferenceAction(actionId);
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
  const hasEmbeddedRules = Object.hasOwn(request, "rules");
  const rules = hasEmbeddedRules ? snapshotCombatRules(request.rules) : null;
  if (hasEmbeddedRules && !rules) throw new TypeError("invalid-combat-rules");
  const actionFor = rules
    ? (actionId) => rules.actions.find((action) => action.id === actionId) || null
    : getReferenceAction;
  const playerActor = actor(player, "player", actionFor, !rules);
  const enemyActor = actor(enemy, "enemy", actionFor, !rules);
  if (playerActor.id === enemyActor.id) throw new TypeError("duplicate-actor-id");
  if (!enemyActor.intent?.id || enemyActor.intent.targetId !== playerActor.id) {
    throw new TypeError("invalid-enemy-intent");
  }
  const state = {
    version: rules ? 2 : 1,
    baselineVersion: rules?.id || REFERENCE_POLICY.id,
    ...(rules ? { rules } : {}),
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
