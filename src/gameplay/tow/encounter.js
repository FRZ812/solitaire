// The Tower of Winter encounter loop.
//
// This is where traits stop being data and start being the fight. A trait grants a
// numeric status on a cadence — at combat start, every turn, every N turns, or on a
// per-turn chance — and the statuses it grants are what the damage resolver reads.
//
// Multi-enemy is supported from the start. The reference campaign fields groups, and the
// old kernel's single-enemy assumption is exactly what forced the production adapter to
// reject most real encounters.

import { cloneJsonData } from "../kernel/json-data.js";
import { createRng, nextInt } from "../kernel/rng.js";
import {
  advanceTowIntent,
  declareTowIntent,
  defaultIntentSchedule,
  intentSchedulesSnapshot,
  isIntentSchedule,
  isTowIntent,
  resolveDeclaredAttack,
} from "./intent.js";
import {
  applyStatus,
  createStatusStack,
  getStatusDefinition,
  MAX_STATUS_COUNT,
  removeStatus,
  scaleStatus,
  statusCount,
  tickEndOfTurn,
  tickEndOfTurnDamage,
} from "../kernel/status-stack.js";
import { createTowActor, isTowActor } from "../kernel/tow-actor.js";
import { resolveAttack } from "../kernel/tow-damage.js";
import { getCombatItem, normalizeCombatItems } from "./combat-items.js";
import { effectRecipient } from "./ability-targeting.js";
import {
  MOVING_FORMATION_RULES_VERSION,
  STATIC_FORMATION_RULES_VERSION,
  isFormationRulesVersion,
  normalizeFormation,
} from "./formation.js";
import { reflowTowFormations } from "./movement.js";
import { legalSkillAnchors, resolveSkillTargets } from "./targeting.js";
import {
  createSkillState,
  effectMagnitude,
  getSkill,
  isSkillState,
  resolveCost,
  restoreUses,
  skillLegality,
  spendSkill,
  tickSkillCooldown,
  UNLIMITED_USES,
} from "./skills.js";
import {
  combatTraitCadenceAtRank,
  combatTraitValueAtRank,
  getCombatTrait,
} from "./traits.js";
import {
  isWeaponAttackSnapshot,
  normalizeWeaponAttackSnapshot,
  weaponAttackAtRank,
} from "./weapon-techniques.js";

export const TOW_ENCOUNTER_VERSION = 1;
export const MAX_ENCOUNTER_EVENTS = 20_000;

const PHASES = new Set(["player", "victory", "defeat", "retreated"]);

export const RETREAT_CHANCE_MIN = 10;
export const RETREAT_CHANCE_MAX = 90;
export const RETREAT_BASE_CHANCE = 50;

const CONTROL_STATUS_TYPES = Object.freeze(["stun", "paralyze", "sleep", "confuse"]);
const MAX_ENEMY_COMMANDS_PER_WINDOW = 96;
// Compatibility only: v1.2 saved Forbidden Ritual schedules omitted the applied max-HP
// gain, so recovery must reconstruct the retired 50% cap before removing that old gain.
const LEGACY_TEMPORARY_MAX_HP_FRACTION = 0.50;

function convertInitiativeToPriority(statuses) {
  const initiative = statusCount(statuses, "initiative");
  const gained = Math.floor(initiative / 100);
  if (gained <= 0) return statuses;
  let converted = removeStatus(statuses, "initiative");
  const remainder = initiative % 100;
  if (remainder > 0) converted = applyStatus(converted, "initiative", remainder);
  return applyStatus(converted, "priority", gained);
}

function actorWithStatuses(actor, statuses) {
  const convertedStatuses = convertInitiativeToPriority(statuses);
  const growDelta = statusCount(convertedStatuses, "grow") - statusCount(actor.statuses, "grow");
  const maxHp = Math.max(1, actor.maxHp + growDelta);
  return {
    ...actor,
    maxHp,
    hp: Math.min(actor.hp, maxHp),
    statuses: convertedStatuses,
  };
}

function actorWithAppliedStatus(actor, type, count) {
  return actorWithStatuses(actor, applyStatus(
    actor.statuses,
    type,
    Math.min(MAX_STATUS_COUNT, Math.max(0, Math.floor(count))),
  ));
}

function effectSubjectIds(state, target, actorId, targetId) {
  if (target === "all") {
    return [...new Set([...playerSideIds(state), ...state.enemyIds])]
      .filter((id) => state.actors[id]?.hp > 0);
  }
  return [target === "self" ? actorId : targetId].filter(Boolean);
}

function protectStatusDecay(state, actorId, type, count, turns) {
  if (!Number.isSafeInteger(turns) || turns <= 0 || count <= 0) return state;
  const actorProtection = state.statusDecayProtection?.[actorId] || {};
  const previous = actorProtection[type] || { count: 0, turnsRemaining: 0 };
  return {
    ...state,
    statusDecayProtection: {
      ...(state.statusDecayProtection || {}),
      [actorId]: {
        ...actorProtection,
        [type]: {
          count: Math.min(MAX_STATUS_COUNT, previous.count + count),
          turnsRemaining: Math.max(previous.turnsRemaining, turns),
        },
      },
    },
  };
}

function event(state, type, detail = {}) {
  return { sequence: state.sequence + 1, round: state.round, type, ...detail };
}

function push(state, type, detail) {
  return {
    ...state,
    sequence: state.sequence + 1,
    events: [...state.events, event(state, type, detail)],
  };
}

function regenerateResolve(state) {
  let next = state;
  const actorIds = [state.playerId, ...(state.allyIds || []), ...(state.enemyIds || [])];
  for (const actorId of actorIds) {
    const actor = next.actors[actorId];
    if (!actor || actor.hp <= 0 || !Number.isFinite(actor.resolve) || actor.resolveRegen <= 0) continue;
    const after = Math.min(actor.resolveMax, actor.resolve + actor.resolveRegen);
    const amount = after - actor.resolve;
    if (amount <= 0) continue;
    next = {
      ...next,
      actors: {
        ...next.actors,
        [actorId]: { ...actor, resolve: after },
      },
    };
    next = push(next, "resolve-regenerated", {
      actorId,
      amount,
      before: actor.resolve,
      after,
    });
  }
  return next;
}

// ---------------------------------------------------------------------------
// Trait firing
// ---------------------------------------------------------------------------

function traitFiresThisRound(traitId, rank, round, rng) {
  const definition = getCombatTrait(traitId);
  const cadence = combatTraitCadenceAtRank(traitId, rank);
  if (cadence.type === "combat-start") return { fires: round === 1, rng };
  if (cadence.type === "every-turn") return { fires: true, rng };
  if (cadence.type === "every-n-turns") {
    return { fires: round % cadence.turns === 0, rng };
  }
  if (cadence.type === "every-n-turns-span") {
    const scaled = combatTraitCadenceAtRank(traitId, rank);
    return { fires: scaled.turns > 0 && round % scaled.turns === 0, rng };
  }
  if (cadence.type === "every-turn-chance") {
    const scaled = combatTraitCadenceAtRank(traitId, rank);
    const roll = nextInt(rng, 1, 100);
    return { fires: roll.value <= scaled.chancePercent, rng: roll.rng };
  }
  return { fires: false, rng };
}

/**
 * Fire every trait whose cadence is due this round, writing its status onto the owner or
 * onto every enemy, and return the updated encounter.
 */
export function fireTraits(state) {
  let next = state;
  let rng = state.rng;
  const appliedGroupPressure = new Set();
  // Every built combatant fires their own traits, in stable side order. A foe's archetype
  // is not a shallow attack table wearing a character portrait: its innate trait resolves
  // through this same cadence and status machinery too.
  for (const ownerId of [...playerSideIds(state), ...state.enemyIds]) {
    const build = buildFor(next, ownerId);
    if (!build || next.actors[ownerId].hp <= 0) continue;
    for (const [traitId, rank] of Object.entries(build.traits)) {
      const definition = getCombatTrait(traitId);
      if (!definition) continue;
      const due = traitFiresThisRound(traitId, rank, next.round, rng);
      rng = due.rng;
      if (!due.fires) continue;

      const amount = combatTraitValueAtRank(traitId, rank);
      if (amount <= 0) continue;
      const { kind } = definition.effect;
      const status = definition.effect.evenRankStatus && rank % 2 === 0
        ? definition.effect.evenRankStatus
        : definition.effect.status;

      // Identical enemy auras are one tactical pressure, not N copies of the same passive.
      // Self-granting traits still belong to every individual actor; only repeated hostile
      // application is coalesced. Otherwise a routine pack of three matching archetypes can
      // triple an every-turn debuff before the player receives a command window.
      const pressureKey = `${next.actors[ownerId].side}:${traitId}`;
      if (kind !== "grant-status" && appliedGroupPressure.has(pressureKey)) continue;
      if (kind !== "grant-status") appliedGroupPressure.add(pressureKey);
      const targetIds = [];

      if (definition.effect.affectsOwnerAndOpponents) {
        const actors = { ...next.actors };
        const affectedIds = [
          ownerId,
          ...(next.actors[ownerId].side === "enemy" ? playerSideIds(next) : next.enemyIds),
        ];
        for (const targetId of affectedIds) {
          if (!actors[targetId] || actors[targetId].hp <= 0) continue;
          targetIds.push(targetId);
          actors[targetId] = actorWithAppliedStatus(actors[targetId], status, amount);
        }
        next = { ...next, actors };
      } else if (kind === "grant-status") {
        const owner = next.actors[ownerId];
        targetIds.push(ownerId);
        next = {
          ...next,
          actors: {
            ...next.actors,
            [ownerId]: actorWithAppliedStatus(owner, status, amount),
          },
        };
      } else {
        const actors = { ...next.actors };
        const opposingIds = next.actors[ownerId].side === "enemy"
          ? playerSideIds(next)
          : next.enemyIds;
        for (const targetId of opposingIds) {
          if (actors[targetId].hp <= 0) continue;
          targetIds.push(targetId);
          actors[targetId] = actorWithAppliedStatus(actors[targetId], status, amount);
        }
        next = { ...next, actors };
      }
      next = push(next, "trait-fired", {
        actorId: ownerId,
        traitId,
        rank,
        status,
        amount,
        effectKind: kind,
        targetIds,
      });
    }
  }
  return { ...next, rng };
}

/** The player and every ally, in the order they act. */
export function playerSideIds(state) {
  return [state.playerId, ...(state.allyIds || [])];
}

/** Whichever build belongs to this actor, regardless of which side fields them. */
export function buildFor(state, actorId) {
  if (actorId === state.playerId) return state.build;
  return state.allyBuilds?.[actorId] || state.enemyBuilds?.[actorId] || null;
}

function updateBuildFor(state, actorId, update) {
  if (actorId === state.playerId) return { ...state, build: update(state.build) };
  if (Object.hasOwn(state.allyBuilds || {}, actorId)) {
    return {
      ...state,
      allyBuilds: { ...state.allyBuilds, [actorId]: update(state.allyBuilds[actorId]) },
    };
  }
  if (Object.hasOwn(state.enemyBuilds || {}, actorId)) {
    return {
      ...state,
      enemyBuilds: { ...state.enemyBuilds, [actorId]: update(state.enemyBuilds[actorId]) },
    };
  }
  return state;
}

/**
 * Ward is a brace for one opposing command window, not encounter-long armour.
 *
 * Player-side wards are raised before foes act and expire after that enemy window. Enemy
 * wards are raised after the player's action and expire after the following player window,
 * immediately before that enemy can act again. Keeping this boundary in the reducer makes
 * the displayed pool and the damage resolver share one authoritative lifetime.
 */
function expireWards(state, actorIds, boundary) {
  let next = state;
  for (const actorId of actorIds) {
    const actor = next.actors[actorId];
    if (!actor || actor.shield <= 0) continue;
    const amount = actor.shield;
    next = {
      ...next,
      actors: { ...next.actors, [actorId]: { ...actor, shield: 0 } },
    };
    next = push(next, "ward-expired", { actorId, amount, boundary });
  }
  return next;
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

// How many turn-consuming actions this combatant gets in its command window.
//
// Haste "gains additional action during battle". Priority "performs a certain number of
// actions before the enemy; if the enemy has Priority too, they cancel out" — so it is
// the *net* against the opposing line, not a flat bonus. Priority actions are spent before
// the ordinary action; `spendAction` and the enemy resolver consume their matching stacks.
function opposingPriority(state, actorId) {
  const actor = state.actors[actorId];
  if (!actor) return 0;
  const opposingIds = actor.side === "enemy" ? playerSideIds(state) : state.enemyIds;
  return opposingIds.reduce((most, opposingId) => {
    const opposing = state.actors[opposingId];
    if (!opposing || opposing.hp <= 0) return most;
    return Math.max(most, statusCount(opposing.statuses, "priority"));
  }, 0);
}

export function priorityAdvantageFor(state, actorId) {
  const actor = state.actors[actorId];
  if (!actor || actor.hp <= 0) return 0;
  return Math.max(
    0,
    statusCount(actor.statuses, "priority") - opposingPriority(state, actorId),
  );
}

function regularActionsFor(actor) {
  return actor && actor.hp > 0 ? 1 + statusCount(actor.statuses, "haste") : 0;
}

export function actionsForRound(state, actorId = state.playerId) {
  const actor = state.actors[actorId];
  if (!actor || actor.hp <= 0) return 0;
  return regularActionsFor(actor) + priorityAdvantageFor(state, actorId);
}

function consumeStatusCount(stack, type, amount = 1) {
  const count = statusCount(stack, type);
  if (count <= 0 || amount <= 0) return stack;
  if (amount >= count) return removeStatus(stack, type);
  return stack.map((entry) => (
    entry.type === type ? { ...entry, count: entry.count - amount } : entry
  ));
}

function consumeActorPriority(state, actorId, amount = 1) {
  const actor = state.actors[actorId];
  if (!actor || amount <= 0) return state;
  const statuses = consumeStatusCount(actor.statuses, "priority", amount);
  if (statuses === actor.statuses) return state;
  const next = {
    ...state,
    actors: { ...state.actors, [actorId]: { ...actor, statuses } },
  };
  return consumePriorityBeforeControl(next, actorId, amount);
}

function activeControlStatuses(actor) {
  if (!actor || statusCount(actor.statuses, "unstoppable") > 0) return [];
  return CONTROL_STATUS_TYPES
    .map((type) => ({ type, count: statusCount(actor.statuses, type) }))
    .filter((entry) => entry.count > 0);
}

function consumeControlWindow(state, actorId) {
  const actor = state.actors[actorId];
  const controls = activeControlStatuses(actor);
  if (controls.length === 0) return { state, controls };
  const statuses = controls.reduce(
    (stack, control) => consumeStatusCount(stack, control.type, 1),
    actor.statuses,
  );
  return {
    controls,
    state: {
      ...state,
      actors: { ...state.actors, [actorId]: { ...actor, statuses } },
    },
  };
}

function actorRetreatRating(actor) {
  if (!actor || actor.hp <= 0) return 0;
  const healthRatio = actor.maxHp > 0 ? actor.hp / actor.maxHp : 0;
  const base = (actor.maxHp * 0.2)
    + (actor.stats.attack * 2)
    + (actor.stats.defense * 2)
    + actor.stats.dodgeRate
    + (actor.stats.critRate * 0.5);
  const tempo = (statusCount(actor.statuses, "haste") * 5)
    + (statusCount(actor.statuses, "priority") * 3)
    + (statusCount(actor.statuses, "evade") * 2);
  return Math.max(1, Math.round((base + tempo) * (0.55 + (0.45 * healthRatio))));
}

function sideRetreatRating(state, actorIds) {
  return actorIds.reduce(
    (total, actorId) => total + actorRetreatRating(state.actors[actorId]),
    0,
  );
}

/** Party comparison behind the displayed retreat chance. Equal living sides sit at 50%. */
export function retreatOdds(state) {
  const playerRating = sideRetreatRating(state, playerSideIds(state));
  const enemyRating = sideRetreatRating(state, state.enemyIds || []);
  const combined = playerRating + enemyRating;
  const modifier = combined > 0
    ? Math.round((40 * (playerRating - enemyRating)) / combined)
    : 0;
  const chancePercent = Math.max(
    RETREAT_CHANCE_MIN,
    Math.min(RETREAT_CHANCE_MAX, RETREAT_BASE_CHANCE + modifier),
  );
  return {
    baseChance: RETREAT_BASE_CHANCE,
    modifier,
    chancePercent,
    playerRating,
    enemyRating,
  };
}

function withFreshTurn(state) {
  // The player's budget stays where every existing caller expects it; allies get their own
  // beside it, so one round is one command window covering the whole side.
  const allies = {};
  for (const allyId of state.allyIds || []) allies[allyId] = actionsForRound(state, allyId);
  return {
    ...state,
    turn: {
      actionsRemaining: actionsForRound(state, state.playerId),
      allies,
      priorityBeforeControl: {},
    },
  };
}

function priorityBeforeControlFor(state, actorId) {
  const value = state.turn.priorityBeforeControl?.[actorId];
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function addPriorityBeforeControl(state, actorId, amount) {
  if (!Number.isSafeInteger(amount) || amount <= 0) return state;
  return {
    ...state,
    turn: {
      ...state.turn,
      priorityBeforeControl: {
        ...state.turn.priorityBeforeControl,
        [actorId]: priorityBeforeControlFor(state, actorId) + amount,
      },
    },
  };
}

function consumePriorityBeforeControl(state, actorId, amount) {
  const current = priorityBeforeControlFor(state, actorId);
  if (current <= 0 || amount <= 0) return state;
  const remaining = Math.max(0, current - amount);
  const priorityBeforeControl = { ...state.turn.priorityBeforeControl };
  if (remaining > 0) priorityBeforeControl[actorId] = remaining;
  else delete priorityBeforeControl[actorId];
  return { ...state, turn: { ...state.turn, priorityBeforeControl } };
}

/**
 * The value a skill scales off, including whatever statuses are currently lifting it.
 *
 * Exported because the simulation harness has to predict a skill's output to choose between
 * skills, and a second copy of this arithmetic would let the policy and the resolver drift
 * apart — at which point the harness would be measuring a fight nobody plays.
 */
export function actorScaleValue(actor, scale) {
  return statOf(actor, scale);
}

function statOf(actor, scale) {
  if (scale === "attack") return Math.max(0,
    actor.stats.attack
      + statusCount(actor.statuses, "strength")
      + statusCount(actor.statuses, "overload")
      + statusCount(actor.statuses, "skeleton")
      + statusCount(actor.statuses, "berserk")
      - statusCount(actor.statuses, "lethargy")
      - statusCount(actor.statuses, "cripple"));
  if (scale === "defense") return Math.max(0,
    actor.stats.defense
      + statusCount(actor.statuses, "tenacity")
      + statusCount(actor.statuses, "fortified")
      - statusCount(actor.statuses, "injured"));
  if (scale === "max-hp") return actor.maxHp;
  if (scale === "current-hp") return actor.hp;
  return 0;
}

function factorActor(player, target, owner) {
  return owner === "enemy" ? target : player;
}

function sourceFactorValue(player, target, effect) {
  if (effect.scale) return statOf(player, effect.scale);
  const owner = factorActor(player, target, effect.factorOwner);
  if (!owner) return 0;
  if (effect.factorStatus) return statusCount(owner.statuses, effect.factorStatus);
  if (effect.factorScale === "current-hp") return owner.hp;
  if (effect.factorScale === "lost-hp") return Math.max(0, owner.maxHp - owner.hp);
  if (effect.factorScale === "max-hp") return owner.maxHp;
  return 0;
}

function sourcedMagnitudeAmount(player, target, effect, magnitude) {
  const value = sourceFactorValue(player, target, effect);
  return Math.floor(effect.factorByRank ? value * magnitude : (value * magnitude) / 100);
}

/** Validate and normalise one actor's traits, skills and runes. */
function normalizeBuild(build, { resolveEconomy = false } = {}) {
  const traits = cloneJsonData(build?.traits || {}, "invalid-build-traits");
  for (const [traitId, rank] of Object.entries(traits)) {
    if (!getCombatTrait(traitId)) throw new TypeError(`unknown-trait:${traitId}`);
    if (!Number.isSafeInteger(rank) || rank < 1 || rank > 7) throw new TypeError("invalid-trait-rank");
  }
  const skills = (build?.skills || []).map((entry) => {
    // A durable build may specify only `{ id, rank }`. Hydrate that authored rank through
    // the canonical constructor before encounter validation; copying the partial object used
    // to omit cooldownRemaining and made every promoted practice action invalid on arrival.
    const state = typeof entry === "string"
      ? createSkillState(entry)
      : isSkillState(entry)
        ? { ...entry }
        : createSkillState(entry?.id, entry?.rank ?? 1);
    // A current actor spends from one Resolve pool. Legacy actors omit that pool and retain
    // their captured charge counters so an already-recorded exchange still replays exactly.
    return resolveEconomy ? { ...state, usesRemaining: UNLIMITED_USES } : state;
  });
  const hasBasicAttack = Object.hasOwn(build || {}, "basicAttack");
  const basicAttack = build?.basicAttack == null
    ? null
    : normalizeWeaponAttackSnapshot(build.basicAttack);
  if (build?.basicAttack != null && !basicAttack) throw new TypeError("invalid-basic-attack");
  return {
    traits,
    skills,
    runes: [...(build?.runes || [])],
    ...(Object.hasOwn(build || {}, "combatItems")
      ? { combatItems: normalizeCombatItems(build.combatItems) }
      : {}),
    ...(hasBasicAttack ? { basicAttack } : {}),
  };
}

// Legacy attack tables record damage directly rather than a skill scaling. They still have
// to obey live ATK pressure: otherwise an Old King's per-hit Lethargy can zero a modern
// build-backed foe but leaves an older saved foe mysteriously untouched.
function authoredAttackDamage(actor, amount) {
  const baseAttack = Math.max(1, actor.stats.attack);
  return Math.max(0, Math.floor((amount * statOf(actor, "attack")) / baseAttack));
}

/**
 * Priority granted during an open command window belongs to that window. Waiting until
 * `withFreshTurn` made a Swift Priority ability leak one enemy attack before its tempo
 * existed. Only the newly gained net Priority is added; hostile Priority still cancels it.
 */
function applyImmediatePriorityBudget(
  state,
  actorId,
  priorityBefore,
  { protectBeforeControl = false } = {},
) {
  const actor = state.actors[actorId];
  if (state.phase !== "player" || !actor) return state;
  const priorityAfter = statusCount(actor.statuses, "priority");
  const opposing = opposingPriority(state, actorId);
  const beforeNet = Math.max(0, priorityBefore - opposing);
  const afterNet = Math.max(0, priorityAfter - opposing);
  const gainedActions = Math.max(0, afterNet - beforeNet);
  if (gainedActions <= 0) return state;
  let next = protectBeforeControl
    ? addPriorityBeforeControl(state, actorId, gainedActions)
    : state;
  if (actor.side !== "player") return next;
  if (actorId === state.playerId) {
    return {
      ...next,
      turn: {
        ...next.turn,
        actionsRemaining: next.turn.actionsRemaining + gainedActions,
      },
    };
  }
  return {
    ...next,
    turn: {
      ...next.turn,
      allies: {
        ...next.turn.allies,
        [actorId]: (next.turn.allies?.[actorId] ?? 0) + gainedActions,
      },
    },
  };
}

/**
 * Turn-free Haste gained during an open player-side command window belongs to that window.
 * The normal budget snapshot reads Haste only when the round opens, and Haste decays before
 * the next snapshot; without this adjustment a swift Haste setup can expire without granting
 * any action. Turn-consuming Haste is deliberately deferred to the next window so it cannot
 * refund itself forever. Add only the stacks actually stored so caps and repeated effects
 * cannot create phantom budget.
 */
function applyImmediateHasteBudget(state, actorId, hasteBefore) {
  const actor = state.actors[actorId];
  if (state.phase !== "player" || actor?.side !== "player") return state;
  const gainedActions = Math.max(0, statusCount(actor.statuses, "haste") - hasteBefore);
  if (gainedActions <= 0) return state;
  if (actorId === state.playerId) {
    return {
      ...state,
      turn: {
        ...state.turn,
        actionsRemaining: state.turn.actionsRemaining + gainedActions,
      },
    };
  }
  return {
    ...state,
    turn: {
      ...state.turn,
      allies: {
        ...state.turn.allies,
        [actorId]: (state.turn.allies?.[actorId] ?? 0) + gainedActions,
      },
    },
  };
}

function skillActionKind(definition) {
  const effects = definition.effects || [];
  if (effects.some((effect) => effect.type.startsWith("damage"))) return "damage";
  if (effects.some((effect) => effect.type === "shield")) return "ward";
  if (effects.some((effect) => effect.type.startsWith("heal") || effect.type === "reduce-statuses")) {
    return "recover";
  }
  if (effects.some((effect) => effect.target === "enemy")) return "afflict";
  return "boon";
}

/**
 * Intent-compatible identity for one real skill.
 *
 * `enemyAttacks` remains the durable declaration table name for v1 replay compatibility,
 * but new entries are projections of the same skill definitions and rank states the player
 * uses. Resolution never trusts the preview numbers; it executes the skill itself.
 */
function skillActionEntry(actor, skillState) {
  const definition = getSkill(skillState.id);
  const damageIndex = definition.effects.findIndex((effect) => effect.type === "damage");
  const damageEffect = damageIndex >= 0 ? definition.effects[damageIndex] : null;
  const damage = damageEffect
    ? Math.max(0, Math.floor(
      (statOf(actor, damageEffect.scale) * effectMagnitude(definition.id, damageIndex, skillState.rank)) / 100,
    ))
    : 0;
  const targetsEnemy = definition.effects.some((effect) => effect.target === "enemy");
  return {
    id: definition.id,
    skillId: definition.id,
    name: definition.name,
    hits: damageEffect?.hits ?? 1,
    damage,
    kind: skillActionKind(definition),
    target: targetsEnemy ? "enemy" : "self",
  };
}

function projectedSkillDamage(state, actorId, skillId, targetId) {
  const definition = getSkill(skillId);
  const actor = state.actors[actorId];
  const target = state.actors[targetId];
  const rank = buildFor(state, actorId)?.skills.find((entry) => entry.id === skillId)?.rank ?? 1;
  if (!definition || !actor || !target) return { damage: 0, hits: 1 };
  const packets = [];
  definition.effects.forEach((effect, index) => {
    const magnitude = effectMagnitude(skillId, index, rank);
    if (effect.type === "damage") {
      const hits = effect.hits ?? 1;
      const authored = sourcedMagnitudeAmount(actor, target, effect, magnitude);
      if (authored > 0) packets.push({ amount: authored, hits });
    } else if (effect.type === "damage-enemy-lost-hp" || effect.type === "damage-self-lost-hp") {
      const source = effect.type === "damage-self-lost-hp" ? actor : target;
      const authored = Math.floor((Math.max(0, source.maxHp - source.hp) * magnitude) / 100);
      if (authored > 0) packets.push({ amount: authored, hits: 1 });
    } else if (effect.type === "damage-enemy-max-hp") {
      const authored = Math.floor((target.maxHp * magnitude) / 100);
      if (authored > 0) packets.push({ amount: authored, hits: 1 });
    }
  });
  if (packets.length === 1) return { damage: packets[0].amount, hits: packets[0].hits };
  return {
    damage: packets.reduce((total, packet) => total + packet.amount * packet.hits, 0),
    hits: 1,
  };
}

export function createTowEncounter({
  seed,
  intentSeed,
  intentSchedules,
  player,
  enemies,
  build,
  allies = [],
  formations,
} = {}) {
  if (typeof seed !== "string" && !(typeof seed === "number" && Number.isFinite(seed))) {
    throw new TypeError("invalid-encounter-seed");
  }
  if (!Array.isArray(enemies) || enemies.length < 1) throw new TypeError("invalid-enemies");
  if (!Array.isArray(allies)) throw new TypeError("invalid-allies");

  const playerActor = createTowActor({ ...player, side: "player" });

  // An ally is a full actor with a build of their own — never a copy of the protagonist's
  // package. A companion who fought with the player's traits and the player's skills would
  // be a second protagonist wearing someone else's name.
  const allyBuilds = {};
  const allyActors = allies.map((ally) => {
    const { build: allyBuild, ...actorFields } = ally;
    const actor = createTowActor({ ...actorFields, side: "player" });
    allyBuilds[actor.id] = normalizeBuild(allyBuild, {
      resolveEconomy: Number.isFinite(actor.resolve),
    });
    return actor;
  });
  // New foes bring a build just like player-side actors. `enemyAttacks` is retained as the
  // v1 declaration index and as the legacy path for already-recorded fights; build-backed
  // rows are derived from real skills and are never resolved as standalone damage records.
  const enemyAttacks = {};
  const enemyBuilds = {};
  const enemyArchetypes = {};
  const enemyActors = enemies.map((enemy) => {
    const {
      attacks,
      build: enemyBuild,
      archetypeId = null,
      ...actorFields
    } = enemy;
    const actor = createTowActor({ ...actorFields, side: "enemy" });
    if (enemyBuild) {
      const normalized = normalizeBuild(enemyBuild, {
        resolveEconomy: Number.isFinite(actor.resolve),
      });
      enemyBuilds[actor.id] = normalized;
      enemyArchetypes[actor.id] = typeof archetypeId === "string" ? archetypeId : null;
      enemyAttacks[actor.id] = normalized.skills.map((skillState) => skillActionEntry(actor, skillState));
    } else {
      enemyAttacks[actor.id] = (attacks || []).map((attack) => ({
        id: attack.id || "attack",
        name: attack.name || "Attack",
        hits: Number.isSafeInteger(attack.hits) && attack.hits > 0 ? attack.hits : 1,
        damage: Number.isSafeInteger(attack.damage) && attack.damage >= 0
          ? attack.damage
          : actor.stats.attack,
      }));
    }
    return actor;
  });
  const everyId = [
    playerActor.id,
    ...allyActors.map((ally) => ally.id),
    ...enemyActors.map((enemy) => enemy.id),
  ];
  if (new Set(everyId).size !== everyId.length) throw new TypeError("duplicate-actor-id");

  let formationSnapshot = null;
  if (formations !== undefined) {
    if (!formations || typeof formations !== "object" || Array.isArray(formations)) {
      throw new TypeError("invalid-formations");
    }
    const formationVersion = Object.hasOwn(formations, "version")
      ? formations.version
      : STATIC_FORMATION_RULES_VERSION;
    if (!isFormationRulesVersion(formationVersion)) {
      throw new TypeError("invalid-formation-version");
    }
    formationSnapshot = {
      version: formationVersion,
      player: normalizeFormation(
        [playerActor.id, ...allyActors.map((ally) => ally.id)],
        formations.player || null,
      ),
      enemy: normalizeFormation(
        enemyActors.map((enemy) => enemy.id),
        formations.enemy || null,
      ),
    };
  }

  const playerBuild = normalizeBuild(build, {
    resolveEconomy: Number.isFinite(playerActor.resolve),
  });

  // Every foe gets a rotation over its own action index. For new fights that index is a
  // projection of real archetype skills; for v1 replay snapshots it can still be an immutable
  // attack table. An authored schedule wins where one is supplied.
  const authored = intentSchedulesSnapshot(intentSchedules);
  if (intentSchedules !== undefined && authored === null) {
    throw new TypeError("invalid-intent-schedules");
  }
  const schedules = {};
  for (const enemy of enemyActors) {
    const schedule = authored?.[enemy.id] ?? defaultIntentSchedule(enemy.id, enemyAttacks[enemy.id]);
    if (schedule) schedules[enemy.id] = schedule;
  }

  const base = {
    version: TOW_ENCOUNTER_VERSION,
    phase: "player",
    round: 1,
    sequence: 0,
    rng: createRng(seed),
    // Declarations draw from their own stream, so adding a schedule step or a tie-break can
    // never shift a damage roll that a saved fight already recorded.
    intentRng: createRng(intentSeed ?? `${seed}::tow-stream::intent::v1`),
    playerId: playerActor.id,
    allyIds: allyActors.map((ally) => ally.id),
    enemyIds: enemyActors.map((enemy) => enemy.id),
    enemyAttacks,
    enemyBuilds,
    enemyArchetypes,
    intentSchedules: schedules,
    intents: {},
    actors: Object.fromEntries([
      [playerActor.id, playerActor],
      ...allyActors.map((ally) => [ally.id, ally]),
      ...enemyActors.map((enemy) => [enemy.id, enemy]),
    ]),
    build: playerBuild,
    allyBuilds,
    ...(formationSnapshot ? { formations: formationSnapshot } : {}),
    turn: { actionsRemaining: 1, allies: {}, priorityBeforeControl: {} },
    scheduledEffects: [],
    statusDecayProtection: {},
    events: [],
  };

  // Combat-start traits land before the first player command, which is what makes
  // Intangible's 7 Invincible or Inferno's 80 Burn an opening rather than a turn-one play.
  // The opening action count is read after they fire, so Flash's 6 Priority is worth
  // something on round one rather than only from round two.
  //
  // The opening telegraph lands after them, so the first thing the player sees is a fight
  // they can already read.
  return declareRoundIntents(withFreshTurn(fireTraits(base)));
}

// ---------------------------------------------------------------------------
// Telegraphs
// ---------------------------------------------------------------------------

function enemySkillState(state, enemyId, skillId) {
  return state.enemyBuilds?.[enemyId]?.skills?.find((entry) => entry.id === skillId) || null;
}

function enemySkillUseful(state, enemyId, skillState) {
  const definition = getSkill(skillState.id);
  const actor = state.actors[enemyId];
  const targets = livingPlayerSide(state).map((id) => state.actors[id]);
  // Mythical techniques are conclusions, not openers. Rarity carries that escalation now;
  // the five-slot model deliberately has no Special or Ultimate category.
  if (definition.abilityType === "archetype"
    && definition.rarity === "mythical"
    && actor.hp > Math.ceil(actor.maxHp / 2)) return false;
  // Treat a mixed defensive technique as one decision. Blade Barrier also grants Guard;
  // letting that secondary boon bypass the Ward gate made a healthy foe choose the whole
  // defensive action repeatedly. Ward is only a useful declaration when its owner is both
  // exposed and actually needs the brace.
  if (definition.effects.some((effect) => effect.type === "shield")
    && (actor.shield > 0 || actor.hp > Math.ceil(actor.maxHp * 0.6))) return false;
  return definition.effects.some((effect) => {
    if (effect.type.startsWith("damage")) return targets.length > 0;
    // Ward is a timed answer to an exposed state, not a resource to hoard forever. Without
    // this gate a defensive archetype can spend every ready turn adding another full Block,
    // making a nearly-defeated foe less vulnerable the longer the player pressures them.
    if (effect.type === "shield") return true;
    if (effect.type.startsWith("heal")) return actor.hp < actor.maxHp;
    if (effect.type === "reduce-statuses") {
      const subjects = effect.target === "enemy" ? targets : [actor];
      return subjects.some((subject) => (
        (effect.clearShield && subject.shield > 0)
        || effect.statuses.some((status) => statusCount(subject.statuses, status) > 0)
      ));
    }
    if (effect.type === "amplify-statuses") {
      const subjects = effect.target === "self" ? [actor] : targets;
      return subjects.some((subject) => effect.statuses.some((status) => statusCount(subject.statuses, status) > 0));
    }
    if (effect.target === "self") return true;
    if ((effect.type === "status" || effect.type === "scaled-status") && effect.status) {
      return targets.some((target) => statusCount(target.statuses, effect.status) <= 0);
    }
    return targets.length > 0;
  });
}

function enemySkillReserved(state, enemyId, skillState) {
  const definition = getSkill(skillState.id);
  if (definition.abilityType === "basic-attack") return false;
  return Object.entries(state.intents || {}).some(([otherId, intent]) => {
    if (otherId === enemyId || state.actors[otherId]?.hp <= 0) return false;
    const promised = resolveDeclaredAttack(intent, state.enemyAttacks?.[otherId] || []);
    const promisedDefinition = promised?.skillId ? getSkill(promised.skillId) : null;
    // One signature move leads the enemy line in an exchange. The rest still act through
    // their own basic abilities, but the player reads one guard/control/signature decision
    // instead of a wall of unrelated techniques firing in lockstep.
    return promisedDefinition && promisedDefinition.abilityType !== "basic-attack";
  });
}

function availableEnemySchedule(state, enemyId) {
  const schedule = state.intentSchedules[enemyId];
  const build = state.enemyBuilds?.[enemyId];
  if (!schedule || !build) return schedule;

  const legal = build.skills.filter((skillState) => (
    skillLegality(skillState, {
      turnAvailable: true,
      resolveAvailable: state.actors[enemyId]?.resolve,
    }).ok
    && !enemySkillReserved(state, enemyId, skillState)
  ));
  const useful = legal.filter((skillState) => enemySkillUseful(state, enemyId, skillState));
  const ready = useful.length > 0 ? useful : legal;
  if (ready.length === 0) return null;
  const readyIds = new Set(ready.map((entry) => entry.id));
  const fallback = [...readyIds];
  return {
    id: schedule.id,
    steps: schedule.steps.map((step) => {
      const filtered = step.attackIds.filter((id) => readyIds.has(id));
      return { id: step.id, attackIds: filtered.length > 0 ? filtered : fallback };
    }),
  };
}

/**
 * Resolve a foe's declared actor target through the same formation geometry used by the
 * command reducer. Intent selection predates formations and still draws from the living
 * opposing actors; a melee declaration can therefore name somebody behind the exposed
 * rank. Preserve that draw, but fall back deterministically to the first legal spatial
 * anchor when the named actor cannot actually be reached.
 */
function resolveEnemySkillTargets(state, enemyId, skillId, targetId = null) {
  const requested = resolveSkillTargets(state, skillId, enemyId, { targetId });
  if (requested.ok) return requested;
  return resolveSkillTargets(state, skillId, enemyId);
}

function targetEnemyIntent(state, enemyId, intent) {
  const action = resolveDeclaredAttack(intent, state.enemyAttacks[enemyId] || []);
  if (!action) return intent;
  if (action.skillId) {
    const requestedTarget = action.target === "self" ? enemyId : intent.targetId;
    const resolved = resolveEnemySkillTargets(state, enemyId, action.skillId, requestedTarget);
    return { ...intent, targetId: resolved.ok ? resolved.primaryTargetId : null };
  }
  if (action.target === "self") return { ...intent, targetId: enemyId };
  const standing = livingPlayerSide(state);
  return {
    ...intent,
    targetId: standing.includes(intent.targetId) ? intent.targetId : standing[0] ?? null,
  };
}

/**
 * Re-resolve held actor targets after a moving formation reflows.
 *
 * Enemy rotations advance as soon as each hostile action lands, so most of the next round's
 * intents already exist before the round boundary. Keep the promised attack and declaration
 * index, but record any actor-target change rather than silently falling back after movement.
 */
function retargetHeldIntents(state) {
  if (state.formations?.version !== MOVING_FORMATION_RULES_VERSION) return state;
  let next = state;
  for (const enemyId of state.enemyIds) {
    if (next.actors[enemyId]?.hp <= 0) continue;
    const held = next.intents[enemyId];
    if (!held) continue;
    const retargeted = targetEnemyIntent(next, enemyId, held);
    if (retargeted.targetId === held.targetId) continue;
    next = push(
      { ...next, intents: { ...next.intents, [enemyId]: retargeted } },
      "intent-retargeted",
      {
        enemyId,
        attackId: held.attackId,
        declarationIndex: held.declarationIndex,
        fromTargetId: held.targetId,
        targetId: retargeted.targetId,
      },
    );
  }
  return next;
}

function reflowRoundFormations(state) {
  const reflowed = reflowTowFormations(state);
  if (reflowed.moves.length === 0) return state;
  return push(
    { ...state, formations: reflowed.formations },
    "formation-moved",
    {
      round: state.round,
      phase: "round-open",
      moves: reflowed.moves,
    },
  );
}

/**
 * Declare the coming round's attack for every living foe that does not already hold one.
 *
 * Enemies are walked in their stable encounter order off one shared intent stream, so a
 * group's declarations are reproducible and a foe added to the middle of a line-up cannot
 * silently re-roll the others.
 */
function declareRoundIntents(state) {
  let next = state;
  let rng = state.intentRng;
  const intents = { ...state.intents };

  for (const enemyId of state.enemyIds) {
    const enemy = next.actors[enemyId];
    const schedule = availableEnemySchedule(next, enemyId);
    // A foe with no action index has nothing to telegraph, and a dead one has nothing left
    // to say. Both drop their declaration rather than keeping a stale one.
    if (!schedule || enemy.hp <= 0) {
      delete intents[enemyId];
      continue;
    }
    const held = intents[enemyId];
    if (held && isTowIntent(held)) continue;
    const declared = declareTowIntent({
      schedule,
      declarationIndex: 0,
      targetId: state.playerId,
      targets: livingPlayerSide(next),
      rng,
    });
    rng = declared.rng;
    const intent = targetEnemyIntent(next, enemyId, declared.intent);
    intents[enemyId] = intent;
    // Make this promise visible while the rest of the line chooses. Signature abilities are
    // coordinated across the group, so three identical foes do not all declare the same
    // Deflect, stun or execution in mechanical lockstep.
    next = push({ ...next, intents: { ...intents } }, "intent-declared", {
      enemyId,
      attackId: intent.attackId,
      targetId: intent.targetId,
      declarationIndex: intent.declarationIndex,
    });
  }
  return { ...next, intentRng: rng, intents };
}

/** Move one foe's telegraph on to the next step of its rotation. */
function advanceEnemyIntent(state, enemyId) {
  const schedule = availableEnemySchedule(state, enemyId);
  const held = state.intents[enemyId];
  if (!held) return state;
  if (!schedule) {
    const intents = { ...state.intents };
    delete intents[enemyId];
    return { ...state, intents };
  }
  const advanced = advanceTowIntent({
    schedule,
    intent: held,
    targetId: state.playerId,
    targets: livingPlayerSide(state),
    rng: state.intentRng,
  });
  const intent = targetEnemyIntent(state, enemyId, advanced.intent);
  const next = push(
    { ...state, intentRng: advanced.rng, intents: { ...state.intents, [enemyId]: intent } },
    "intent-declared",
    {
      enemyId,
      attackId: intent.attackId,
      targetId: intent.targetId,
      declarationIndex: intent.declarationIndex,
    },
  );
  return next;
}

/**
 * What each living foe has declared, ready to show the player.
 *
 * Returns the attack's own name, hit count and damage — what the foe is bringing — and no
 * roll that has not happened yet. Crit, dodge and the player's defence are still live.
 */
export function declaredIntents(state) {
  return state.enemyIds
    .filter((enemyId) => state.actors[enemyId].hp > 0 && state.intents[enemyId])
    .map((enemyId) => {
      const indexed = resolveDeclaredAttack(state.intents[enemyId], state.enemyAttacks[enemyId]);
      const skillState = enemySkillState(state, enemyId, indexed?.skillId);
      const attack = skillState
        ? skillActionEntry(state.actors[enemyId], skillState)
        : indexed;
      if (!attack) return null;
      // The declared target may have fallen since; report who will actually take it, so the
      // player is never shown a blow aimed at a body.
      const standing = livingPlayerSide(state);
      const declaredTarget = state.intents[enemyId].targetId;
      const spatial = attack.skillId
        ? resolveEnemySkillTargets(
          state,
          enemyId,
          attack.skillId,
          attack.target === "self" ? enemyId : declaredTarget,
        )
        : null;
      const targetId = spatial?.ok
        ? spatial.primaryTargetId
        : attack.target === "self"
          ? enemyId
          : standing.includes(declaredTarget) ? declaredTarget : standing[0] ?? null;
      const targetIds = spatial?.ok ? spatial.targetIds : targetId ? [targetId] : [];
      const projected = attack.skillId && targetId
        ? projectedSkillDamage(state, enemyId, attack.skillId, targetId)
        : { damage: attack.damage, hits: attack.hits };
      return {
        enemyId,
        attackId: attack.id,
        skillId: attack.skillId || null,
        name: attack.name,
        hits: projected.hits,
        damage: projected.damage,
        kind: attack.kind || "damage",
        target: targetIds.length > 1 ? "area" : targetId === enemyId ? "self" : "enemy",
        targetId,
        targetIds,
        targetName: targetIds.length > 1
          ? targetIds.map((id) => state.actors[id].name).join(", ")
          : targetId ? state.actors[targetId].name : null,
      };
    })
    .filter(Boolean);
}

function isRngState(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value)
    && value.algorithm === "mulberry32"
    && Number.isInteger(value.state)
    && value.state >= 0
    && value.state <= 0xFFFFFFFF;
}

function isKeyedByEnemies(value, enemyIds, valid) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const known = new Set(enemyIds);
  return Object.entries(value).every(([enemyId, entry]) => known.has(enemyId) && valid(entry));
}

function isScheduledEffect(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value)
    && (value.type === "damage" || value.type === "fatal")
    && typeof value.skillId === "string"
    && typeof value.sourceId === "string"
    && typeof value.targetId === "string"
    && Number.isSafeInteger(value.turnsRemaining)
    && value.turnsRemaining > 0
    && Number.isSafeInteger(value.amount)
    && value.amount >= 0
    && (value.status === undefined || Boolean(getStatusDefinition(value.status)));
}

function isStatusDecayProtection(value, actorIds) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const knownActors = new Set(actorIds);
  return Object.entries(value).every(([actorId, statuses]) => (
    knownActors.has(actorId)
    && statuses
    && typeof statuses === "object"
    && !Array.isArray(statuses)
    && Object.entries(statuses).every(([type, entry]) => (
      getStatusDefinition(type)
      && entry
      && typeof entry === "object"
      && !Array.isArray(entry)
      && Number.isSafeInteger(entry.count)
      && entry.count > 0
      && entry.count <= 1_000_000
      && Number.isSafeInteger(entry.turnsRemaining)
      && entry.turnsRemaining > 0
    ))
  ));
}

export function isTowEncounter(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (value.version !== TOW_ENCOUNTER_VERSION) return false;
  if (!PHASES.has(value.phase)) return false;
  if (!Number.isSafeInteger(value.round) || value.round < 1) return false;
  if (!Array.isArray(value.enemyIds) || value.enemyIds.length < 1) return false;
  if (!Array.isArray(value.events) || value.events.length !== value.sequence) return false;
  if (value.events.length > MAX_ENCOUNTER_EVENTS) return false;
  if (!isRngState(value.rng) || !isRngState(value.intentRng)) return false;
  // Optional for older v1 saves; newly-created encounters always provide the queue.
  if (value.scheduledEffects !== undefined && (
    !Array.isArray(value.scheduledEffects)
    || value.scheduledEffects.length > 100
    || !value.scheduledEffects.every(isScheduledEffect)
  )) return false;
  if (!isKeyedByEnemies(value.intentSchedules, value.enemyIds, isIntentSchedule)) return false;
  if (!isKeyedByEnemies(value.intents, value.enemyIds, isTowIntent)) return false;
  if (!Array.isArray(value.allyIds)) return false;
  // Every ally needs a build of their own, and no build may belong to nobody.
  if (!value.allyBuilds || typeof value.allyBuilds !== "object" || Array.isArray(value.allyBuilds)) {
    return false;
  }
  const allyKeys = Object.keys(value.allyBuilds);
  if (allyKeys.length !== value.allyIds.length) return false;
  if (!value.allyIds.every((id) => (
    Array.isArray(value.allyBuilds[id]?.skills)
    && (value.allyBuilds[id].basicAttack == null || isWeaponAttackSnapshot(value.allyBuilds[id].basicAttack))
  ))) return false;
  // Build-backed foes are optional so a saved v1 fight with a recorded legacy attack table
  // remains loadable. Every new fight supplies these maps (possibly empty), and every entry
  // must belong to a known enemy and carry the same normalized skill-state shape.
  if (value.enemyBuilds !== undefined) {
    if (!value.enemyBuilds || typeof value.enemyBuilds !== "object" || Array.isArray(value.enemyBuilds)) {
      return false;
    }
    if (!Object.entries(value.enemyBuilds).every(([id, enemyBuild]) => (
      value.enemyIds.includes(id)
      && Array.isArray(enemyBuild?.skills)
      && (enemyBuild.basicAttack == null || isWeaponAttackSnapshot(enemyBuild.basicAttack))
    ))) return false;
  }
  if (value.enemyArchetypes !== undefined) {
    if (!value.enemyArchetypes || typeof value.enemyArchetypes !== "object" || Array.isArray(value.enemyArchetypes)) {
      return false;
    }
    if (!Object.entries(value.enemyArchetypes).every(([id, archetypeId]) => (
      value.enemyIds.includes(id)
      && Object.hasOwn(value.enemyBuilds || {}, id)
      && (archetypeId === null || typeof archetypeId === "string")
    ))) return false;
  }
  if (value.formations !== undefined) {
    if (!value.formations || !isFormationRulesVersion(value.formations.version)
      || Object.keys(value.formations).sort().join(",") !== "enemy,player,version") return false;
    try {
      const expectedPlayer = normalizeFormation(
        [value.playerId, ...value.allyIds],
        value.formations.player,
      );
      const expectedEnemy = normalizeFormation(value.enemyIds, value.formations.enemy);
      if (!expectedPlayer.every((entry, index) => entry === value.formations.player[index])
        || !expectedEnemy.every((entry, index) => entry === value.formations.enemy[index])) return false;
    } catch {
      return false;
    }
  }
  if (value.build?.basicAttack != null && !isWeaponAttackSnapshot(value.build?.basicAttack)) return false;
  const actorIds = [value.playerId, ...value.allyIds, ...value.enemyIds];
  if (new Set(actorIds).size !== actorIds.length) return false;
  if (value.statusDecayProtection !== undefined
    && !isStatusDecayProtection(value.statusDecayProtection, actorIds)) return false;
  if (Object.keys(value.actors).length !== actorIds.length) return false;
  if (value.allyIds.some((id) => value.actors[id]?.side !== "player")) return false;
  if (value.enemyIds.some((id) => value.actors[id]?.side !== "enemy")) return false;
  return actorIds.every((id) => isTowActor(value.actors[id]));
}

// ---------------------------------------------------------------------------
// Player commands
// ---------------------------------------------------------------------------

function livingEnemies(state) {
  return state.enemyIds.filter((id) => state.actors[id].hp > 0);
}

/** Everyone on the player's side still standing — the foes' target pool. */
function livingPlayerSide(state) {
  return playerSideIds(state).filter((id) => state.actors[id]?.hp > 0);
}

// The fight ends when the protagonist falls, not when the last of their side does. An ally
// going down is a fate that ally settles on their own; it is a loss, not the end of the
// story, and continuing to swing over the player's body would be a different game.
function terminalPhase(state) {
  if (state.actors[state.playerId].hp <= 0) return "defeat";
  if (livingEnemies(state).length === 0) return "victory";
  return "player";
}

function settle(state) {
  const phase = terminalPhase(state);
  if (phase === state.phase) return state;
  return push({ ...state, phase }, phase === "victory" ? "victory" : "defeat", {});
}

// A control status nullifies the actor's action unless Unstoppable answers it.
function isControlled(state, actorId) {
  const actor = state.actors[actorId];
  const protectedPriority = Math.min(
    priorityBeforeControlFor(state, actorId),
    priorityAdvantageFor(state, actorId),
  );
  return protectedPriority <= 0 && activeControlStatuses(actor).length > 0;
}

/** Read-only authority query for presentation and policy layers. */
export function controlNullifiesActor(state, actorId) {
  return isControlled(state, actorId);
}

/**
 * Every effect type the resolver can actually express.
 *
 * A skill whose effect is not on this list does nothing when used — it is transcribed into
 * the catalogue and then silently ignored, which is the worst of both worlds: the player is
 * offered it, spends Resolve and a turn on it, and gets no rules. A generated test walks the
 * whole catalogue against this list so a newly transcribed effect fails loudly here rather
 * than quietly in someone's fight.
 */
export const SUPPORTED_SKILL_EFFECT_TYPES = Object.freeze([
  "amplify-statuses",
  "consume-status",
  "damage",
  "damage-enemy-lost-hp",
  "damage-enemy-max-hp",
  "damage-self-lost-hp",
  "delayed-damage",
  "heal",
  "heal-flat",
  "heal-lost-fraction",
  "modify-status",
  "reduce-statuses",
  "restore-skill-uses",
  "resolve-regen",
  "scale-status",
  "scaled-status",
  "scaled-status-enemy-lost-hp",
  "shield",
  "status",
  "status-from-status",
  "temporary-max-hp",
]);

function priorityPrecedesSelfControl(definition, effect) {
  return effect.type === "status"
    && effect.status === "priority"
    && effect.target === "self"
    && definition.effects.some((candidate) => (
      candidate !== effect
      && ["status", "scaled-status"].includes(candidate.type)
      && (candidate.target === "self" || candidate.target === "all")
      && CONTROL_STATUS_TYPES.includes(candidate.status)
    ));
}

function applySkillEffects(state, skillId, rank, targetId, actorId, effectIndexes = null) {
  const definition = getSkill(skillId);
  let next = state;
  const selectedEffects = effectIndexes === null ? null : new Set(effectIndexes);
  // Whoever was commanded, not always the protagonist: an ally's Block shields the ally.
  const playerId = actorId ?? next.playerId;
  const shieldEffectIndexes = definition.effects
    .map((effect, index) => (
      effect.type === "shield" && (selectedEffects === null || selectedEffects.has(index))
        ? index
        : -1
    ))
    .filter((index) => index >= 0);
  const lastShieldEffectIndex = shieldEffectIndexes.at(-1) ?? -1;
  const shieldSubjectId = lastShieldEffectIndex >= 0
    && effectRecipient(
      definition,
      definition.effects[lastShieldEffectIndex],
      lastShieldEffectIndex,
    ) === "anchor"
    ? targetId
    : playerId;
  const shieldBeforeSkill = next.actors[shieldSubjectId]?.shield || 0;
  let shieldRaisedBySkill = 0;
  definition.effects.forEach((effect, index) => {
    if (selectedEffects !== null && !selectedEffects.has(index)) return;
    // Asked for per branch rather than up front: not every effect carries a rank table, and
    // demanding one from an effect that has none crashed the whole skill — which is how
    // First Aid, a skill three professions ship with, threw the moment it was used.
    const magnitude = () => effectMagnitude(skillId, index, rank);
    const player = next.actors[playerId];
    const recipient = effectRecipient(definition, effect, index);
    const subjectId = recipient === "anchor" ? targetId : playerId;
    const recipientTarget = recipient === "all"
      ? "all"
      : recipient === "caster" ? "self" : "enemy";

    if (effect.type === "damage") {
      const target = next.actors[targetId];
      if (!target || target.hp <= 0) return;
      const priorityBefore = statusCount(player.statuses, "priority");
      const weaponAttack = skillId === "strike"
        ? weaponAttackAtRank(buildFor(next, playerId)?.basicAttack, rank)
        : null;
      const authoredAmount = weaponAttack
        ? Math.floor((statOf(player, effect.scale) * weaponAttack.damagePercent) / 100)
        : sourcedMagnitudeAmount(player, target, effect, magnitude());
      const hitCount = weaponAttack?.hits ?? effect.hits ?? 1;
      const amount = authoredAmount;
      if (amount <= 0) return;
      const hit = resolveAttack({
        attacker: player,
        defender: target,
        attack: { hits: hitCount, damage: amount },
        rng: next.rng,
      });
      next = {
        ...next,
        rng: hit.rng,
        actors: {
          ...next.actors,
          [playerId]: hit.attacker,
          // Attack-payload statuses (Doom ATK, Poison ATK, and kin) are applied inside the
          // shared damage kernel, so bring the resolved stack through the same peer cap.
          [targetId]: actorWithStatuses(hit.defender, hit.defender.statuses),
        },
      };
      next = push(next, "skill-damage", {
        actorId: playerId,
        skillId,
        targetId,
        amount,
        hits: hit.hits,
        ...(weaponAttack ? { basicAttackFormId: buildFor(next, playerId).basicAttack.formId } : {}),
      });
      // Weapon branches may bind one scaled status to the same basic attack. It resolves
      // after all hits, making a double/triple form mechanically distinct from the optional
      // single-hit debuff form while leaving the base attack free to rank up in place.
      for (const statusEffect of weaponAttack?.statusEffects || []) {
        const currentPlayer = next.actors[playerId];
        const currentTarget = next.actors[targetId];
        if (!currentTarget || currentTarget.hp <= 0) break;
        const count = Math.floor((statOf(currentPlayer, statusEffect.scale) * statusEffect.percent) / 100);
        if (count <= 0) continue;
        next = {
          ...next,
          actors: {
            ...next.actors,
            [targetId]: actorWithAppliedStatus(currentTarget, statusEffect.status, count),
          },
        };
        next = push(next, "skill-status", {
          actorId: playerId,
          skillId,
          status: statusEffect.status,
          target: statusEffect.target,
          targetId,
          count,
          basicAttackFormId: buildFor(next, playerId).basicAttack.formId,
        });
      }
      return;
    }

    if (effect.type === "shield") {
      const amount = Math.floor((statOf(player, effect.scale) * magnitude()) / 100);
      shieldRaisedBySkill += amount;
      // A dual-source barrier (for example ATK + DEF) is one brace and sums inside this
      // skill. A second skill in the same window refreshes the brace instead of adding a
      // second permanent pool on top of it.
      if (index !== lastShieldEffectIndex) return;
      const subject = next.actors[subjectId];
      if (!subject || subject.hp <= 0) return;
      const shield = Math.max(shieldBeforeSkill, shieldRaisedBySkill);
      next = {
        ...next,
        actors: { ...next.actors, [subjectId]: { ...subject, shield } },
      };
      next = push(next, "skill-shield", {
        actorId: playerId,
        skillId,
        targetId: subjectId,
        amount: Math.max(0, shield - shieldBeforeSkill),
        ward: shieldRaisedBySkill,
        before: shieldBeforeSkill,
        after: shield,
      });
      return;
    }

    if (effect.type === "heal") {
      const subject = next.actors[subjectId];
      const requested = sourcedMagnitudeAmount(player, null, effect, magnitude());
      if (!subject || subject.hp <= 0 || requested <= 0 || subject.hp >= subject.maxHp) return;
      const amount = Math.min(requested, subject.maxHp - subject.hp);
      next = {
        ...next,
        actors: {
          ...next.actors,
          [subjectId]: { ...subject, hp: subject.hp + amount },
        },
      };
      next = push(next, "skill-heal", { actorId: playerId, skillId, targetId: subjectId, amount });
      return;
    }

    if (effect.type === "heal-flat") {
      const subject = next.actors[subjectId];
      const amount = magnitude();
      if (!subject || subject.hp <= 0 || amount <= 0 || subject.hp >= subject.maxHp) return;
      const healed = Math.min(amount, subject.maxHp - subject.hp);
      next = {
        ...next,
        actors: {
          ...next.actors,
          [subjectId]: { ...subject, hp: subject.hp + healed },
        },
      };
      next = push(next, "skill-heal", {
        actorId: playerId,
        skillId,
        targetId: subjectId,
        amount: healed,
      });
      return;
    }

    if (effect.type === "damage-enemy-lost-hp" || effect.type === "damage-self-lost-hp") {
      const target = next.actors[targetId];
      if (!target || target.hp <= 0) return;
      const source = effect.type === "damage-self-lost-hp" ? player : target;
      const lost = Math.max(0, source.maxHp - source.hp);
      const authoredAmount = Math.floor((lost * magnitude()) / 100);
      const amount = authoredAmount;
      if (amount <= 0) return;
      const applied = Math.min(target.hp, amount);
      next = {
        ...next,
        actors: {
          ...next.actors,
          [targetId]: { ...target, hp: target.hp - applied },
        },
      };
      next = push(next, "skill-damage", {
        actorId: playerId,
        skillId,
        targetId,
        amount: applied,
        hits: [{
          index: 0,
          dodged: false,
          critical: false,
          baseDamage: amount,
          rawDamage: amount,
          prevented: 0,
          mitigation: {},
          avoidance: {},
          damage: applied,
          absorbed: 0,
          toHp: applied,
          thorn: 0,
        }],
      });
      return;
    }

    if (effect.type === "damage-enemy-max-hp") {
      const target = next.actors[targetId];
      if (!target || target.hp <= 0) return;
      const authoredAmount = Math.floor((target.maxHp * magnitude()) / 100);
      const amount = authoredAmount;
      if (amount <= 0) return;
      // Reaper's Scythe is max-health based, but it remains a real attack: critical and
      // Vulnerable modifiers resolve through the same per-hit path as weapon damage.
      const hit = resolveAttack({
        attacker: player,
        defender: target,
        attack: { hits: 1, damage: amount },
        rng: next.rng,
      });
      const spentAttackStatuses = ["berserk", "predator"].reduce(
        (statuses, status) => removeStatus(statuses, status),
        hit.attacker.statuses,
      );
      const resolvedAttacker = { ...hit.attacker, statuses: spentAttackStatuses };
      next = {
        ...next,
        rng: hit.rng,
        actors: {
          ...next.actors,
          [playerId]: resolvedAttacker,
          [targetId]: actorWithStatuses(hit.defender, hit.defender.statuses),
        },
      };
      next = push(next, "skill-damage", {
        actorId: playerId,
        skillId,
        targetId,
        amount,
        hits: hit.hits,
      });
      return;
    }

    // First Aid heals a fraction of what has already been lost, so it is worth most to
    // someone badly hurt and nearly nothing to someone barely scratched.
    if (effect.type === "heal-lost-fraction") {
      const subject = next.actors[subjectId];
      if (!subject || subject.hp <= 0) return;
      const lost = Math.max(0, subject.maxHp - subject.hp);
      const amount = Math.floor((lost * magnitude()) / 100);
      if (amount <= 0) return;
      next = {
        ...next,
        actors: {
          ...next.actors,
          [subjectId]: { ...subject, hp: Math.min(subject.maxHp, subject.hp + amount) },
        },
      };
      next = push(next, "skill-heal", { actorId: playerId, skillId, targetId: subjectId, amount });
      return;
    }

    // Cleaning a wound: bleed, burn and poison are scaled down rather than decremented, so
    // it bites harder on a heavy stack than a light one.
    if (effect.type === "reduce-statuses") {
      const subject = next.actors[subjectId];
      if (!subject || subject.hp <= 0) return;
      const before = subject.statuses;
      const cleaned = effect.statuses.reduce(
        (statuses, status) => scaleStatus(statuses, status, effect.toPercent),
        before,
      );
      const removed = effect.statuses.reduce(
        (total, status) => total + (statusCount(before, status) - statusCount(cleaned, status)),
        0,
      );
      const wardRemoved = effect.clearShield ? subject.shield : 0;
      if (removed <= 0 && wardRemoved <= 0) return;
      next = {
        ...next,
        actors: {
          ...next.actors,
          [subjectId]: {
            ...actorWithStatuses(subject, cleaned),
            shield: effect.clearShield ? 0 : subject.shield,
          },
        },
      };
      next = push(next, "skill-cleanse", {
        actorId: playerId,
        skillId,
        targetId: subjectId,
        statuses: [...effect.statuses],
        removed,
        wardRemoved,
      });
      return;
    }

    if (effect.type === "consume-status") {
      const before = statusCount(player.statuses, effect.status);
      if (before <= 0) return;
      const spent = Math.min(before, magnitude());
      const statuses = consumeStatusCount(player.statuses, effect.status, spent);
      next = {
        ...next,
        actors: { ...next.actors, [playerId]: actorWithStatuses(player, statuses) },
      };
      next = push(next, "skill-status-spent", {
        actorId: playerId,
        skillId,
        status: effect.status,
        spent,
      });
      return;
    }

    if (effect.type === "modify-status") {
      const subjectIds = effectSubjectIds(next, recipientTarget, playerId, targetId);
      for (const subjectId of subjectIds) {
        const subject = next.actors[subjectId];
        if (!subject || subject.hp <= 0) continue;
        const requestedDelta = magnitude();
        const before = statusCount(subject.statuses, effect.status);
        const statuses = requestedDelta < 0
          ? consumeStatusCount(subject.statuses, effect.status, Math.abs(requestedDelta))
          : applyStatus(subject.statuses, effect.status, requestedDelta);
        const updated = actorWithStatuses(subject, statuses);
        const after = statusCount(updated.statuses, effect.status);
        const delta = after - before;
        next = {
          ...next,
          actors: { ...next.actors, [subjectId]: updated },
        };
        next = push(next, "skill-status-modified", {
          actorId: playerId,
          skillId,
          targetId: subjectId,
          status: effect.status,
          requestedDelta,
          delta,
          before,
          after,
        });
      }
      return;
    }

    if (effect.type === "status-from-status") {
      const source = effect.factorOwner === "enemy" ? next.actors[targetId] : next.actors[playerId];
      if (!source) return;
      const requestedCount = Math.min(
        MAX_STATUS_COUNT,
        Math.floor(statusCount(source.statuses, effect.factorStatus) * magnitude()),
      );
      if (requestedCount <= 0) return;
      const subjectIds = effectSubjectIds(next, recipientTarget, playerId, targetId);
      for (const subjectId of subjectIds) {
        const subject = next.actors[subjectId];
        if (!subject || subject.hp <= 0) continue;
        const before = statusCount(subject.statuses, effect.status);
        const updated = actorWithAppliedStatus(subject, effect.status, requestedCount);
        const count = Math.max(0, statusCount(updated.statuses, effect.status) - before);
        if (count <= 0) continue;
        next = {
          ...next,
          actors: {
            ...next.actors,
            [subjectId]: updated,
          },
        };
        next = protectStatusDecay(next, subjectId, effect.status, count, effect.stackDownDelay);
        next = push(next, "skill-status", {
          actorId: playerId,
          skillId,
          status: effect.status,
          target: effect.target,
          targetId: subjectId,
          count,
          ...(requestedCount !== count ? { requestedCount } : {}),
          factorStatus: effect.factorStatus,
        });
      }
      return;
    }

    if (effect.type === "scale-status") {
      const subjectIds = effectSubjectIds(next, recipientTarget, playerId, targetId);
      for (const subjectId of subjectIds) {
        const subject = next.actors[subjectId];
        if (!subject || subject.hp <= 0) continue;
        const before = subject.statuses;
        const requested = effect.statuses.reduce(
          (statuses, status) => scaleStatus(statuses, status, magnitude()),
          before,
        );
        const requestedChanges = effect.statuses.flatMap((status) => {
          const previous = statusCount(before, status);
          const after = statusCount(requested, status);
          return previous === after ? [] : [{ status, before: previous, after }];
        });
        const updated = actorWithStatuses(subject, requested);
        const changes = effect.statuses.flatMap((status) => {
          const previous = statusCount(before, status);
          const after = statusCount(updated.statuses, status);
          return previous === after ? [] : [{ status, before: previous, after }];
        });
        const changed = changes.reduce(
          (total, change) => total + Math.abs(change.after - change.before),
          0,
        );
        if (changed <= 0) continue;
        next = {
          ...next,
          actors: { ...next.actors, [subjectId]: updated },
        };
        next = push(next, "skill-status-scaled", {
          actorId: playerId,
          skillId,
          targetId: subjectId,
          statuses: [...effect.statuses],
          percent: magnitude(),
          changed,
          changes,
          ...(JSON.stringify(requestedChanges) !== JSON.stringify(changes)
            ? { requestedChanges }
            : {}),
        });
      }
      return;
    }

    if (effect.type === "restore-skill-uses") {
      const amount = magnitude();
      const currentActor = next.actors[subjectId];
      if (Number.isFinite(currentActor?.resolve)) {
        const restored = Math.max(
          0,
          Math.min(currentActor.resolveMax, currentActor.resolve + amount) - currentActor.resolve,
        );
        if (restored > 0) {
          next = {
            ...next,
            actors: {
              ...next.actors,
              [subjectId]: { ...currentActor, resolve: currentActor.resolve + restored },
            },
          };
        }
        next = push(next, "skill-resolve-restored", {
          actorId: playerId,
          targetId: subjectId,
          skillId,
          amount,
          restored,
        });
        return;
      }
      // Captured v1 encounters had no Resolve field and keep the old restoration rule.
      let restored = 0;
      next = updateBuildFor(next, subjectId, (build) => ({
        ...build,
        skills: build.skills.map((entry) => {
          if (entry.id === skillId || entry.usesRemaining === UNLIMITED_USES) return entry;
          const updated = restoreUses(entry, amount);
          restored += updated.usesRemaining - entry.usesRemaining;
          return updated;
        }),
      }));
      next = push(next, "skill-uses-restored", {
        actorId: playerId,
        targetId: subjectId,
        skillId,
        amount,
        restored,
      });
      return;
    }

    if (effect.type === "resolve-regen") {
      const currentActor = next.actors[subjectId];
      if (!Number.isFinite(currentActor?.resolveRegen)) return;
      const before = currentActor.resolveRegen;
      const after = Math.max(before, magnitude());
      if (after <= before) return;
      next = {
        ...next,
        actors: {
          ...next.actors,
          [subjectId]: { ...currentActor, resolveRegen: after },
        },
      };
      next = push(next, "skill-resolve-regen", {
        actorId: playerId,
        targetId: subjectId,
        skillId,
        before,
        after,
      });
      return;
    }

    if (effect.type === "amplify-statuses") {
      const target = next.actors[subjectId];
      if (!target || target.hp <= 0) return;
      const amplified = effect.statuses.reduce(
        (statuses, status) => scaleStatus(statuses, status, magnitude()),
        target.statuses,
      );
      const gained = effect.statuses.reduce(
        (total, status) => total + Math.max(0, statusCount(amplified, status) - statusCount(target.statuses, status)),
        0,
      );
      if (gained <= 0) return;
      next = {
        ...next,
        actors: { ...next.actors, [subjectId]: actorWithStatuses(target, amplified) },
      };
      next = push(next, "skill-status-amplified", {
        actorId: playerId,
        skillId,
        targetId: subjectId,
        statuses: [...effect.statuses],
        percent: magnitude(),
        gained,
      });
      return;
    }

    if (effect.type === "delayed-damage") {
      const delayedTargetId = effect.target === "self" ? playerId : targetId;
      const target = next.actors[delayedTargetId];
      if (!target || target.hp <= 0) return;
      const authoredAmount = magnitude();
      const amount = authoredAmount;
      const delayedStatus = effect.status || "limited-life-sentence";
      const turns = effect.turnsByRank
        ? effect.turnsByRank[Math.min(rank - 1, effect.turnsByRank.length - 1)]
        : effect.turns;
      next = {
        ...next,
        scheduledEffects: [
          ...(next.scheduledEffects || []),
          {
            type: "damage",
            skillId,
            sourceId: playerId,
            targetId: delayedTargetId,
            turnsRemaining: turns,
            amount,
            status: delayedStatus,
          },
        ],
        actors: {
          ...next.actors,
          [delayedTargetId]: actorWithAppliedStatus(target, delayedStatus, turns),
        },
      };
      next = push(next, "skill-status", {
        actorId: playerId,
        skillId,
        status: delayedStatus,
        target: effect.target,
        targetId: delayedTargetId,
        count: turns,
        delayedDamage: amount,
      });
      return;
    }

    if (effect.type === "temporary-max-hp") {
      const authoredAmount = magnitude();
      const amount = effect.scale === "max-hp"
        ? Math.max(1, Math.floor((player.maxHp * authoredAmount) / 100))
        : authoredAmount;
      const turns = effect.turns;
      next = {
        ...next,
        scheduledEffects: effect.fatal
          ? [
            ...(next.scheduledEffects || []),
            {
              type: "fatal",
              skillId,
              sourceId: playerId,
              targetId: playerId,
              turnsRemaining: turns,
              amount: 0,
              maxHpGain: amount,
            },
          ]
          : (next.scheduledEffects || []),
        actors: {
          ...next.actors,
          [playerId]: {
            ...player,
            hp: player.hp + amount,
            maxHp: player.maxHp + amount,
            statuses: applyStatus(player.statuses, "forbidden-ritual", turns),
          },
        },
      };
      next = push(next, "skill-max-hp", {
        actorId: playerId,
        targetId: playerId,
        skillId,
        amount,
        turns,
        fatal: effect.fatal,
      });
      next = push(next, "skill-status", {
        actorId: playerId,
        skillId,
        status: "forbidden-ritual",
        target: "self",
        targetId: playerId,
        count: turns,
      });
      return;
    }

    // Judge of Fate reads the target rather than the caster: the more a foe has already
    // lost, the heavier the misfortune that lands on them.
    if (effect.type === "scaled-status-enemy-lost-hp") {
      const target = next.actors[targetId];
      if (!target || target.hp <= 0) return;
      const lost = Math.max(0, target.maxHp - target.hp);
      const requestedCount = Math.floor((lost * magnitude()) / 100);
      if (requestedCount <= 0) return;
      const before = statusCount(target.statuses, effect.status);
      const updated = actorWithAppliedStatus(target, effect.status, requestedCount);
      const count = Math.max(0, statusCount(updated.statuses, effect.status) - before);
      if (count <= 0) return;
      next = {
        ...next,
        actors: {
          ...next.actors,
          [targetId]: updated,
        },
      };
      next = push(next, "skill-status", {
        actorId: playerId,
        skillId,
        status: effect.status,
        target: effect.target,
        targetId,
        count,
        ...(requestedCount !== count ? { requestedCount } : {}),
      });
      return;
    }

    if (effect.type === "status" || effect.type === "scaled-status") {
      const requestedCount = Math.min(MAX_STATUS_COUNT, effect.type === "status"
        ? magnitude()
        : sourcedMagnitudeAmount(player, next.actors[targetId], effect, magnitude()));
      if (requestedCount <= 0) return;
      const subjectIds = effectSubjectIds(next, recipientTarget, playerId, targetId);
      for (const subjectId of subjectIds) {
        const subject = next.actors[subjectId];
        if (!subject || subject.hp <= 0) continue;
        const before = statusCount(subject.statuses, effect.status);
        const hasteBefore = statusCount(subject.statuses, "haste");
        const priorityBefore = statusCount(subject.statuses, "priority");
        const updated = actorWithAppliedStatus(subject, effect.status, requestedCount);
        const priorityGained = Math.max(
          0,
          statusCount(updated.statuses, "priority") - priorityBefore,
        );
        const count = effect.status === "initiative"
          ? requestedCount
          : Math.max(0, statusCount(updated.statuses, effect.status) - before);
        if (count <= 0 && priorityGained <= 0) continue;
        next = {
          ...next,
          actors: {
            ...next.actors,
            [subjectId]: updated,
          },
        };
        if (effect.status !== "initiative") {
          next = protectStatusDecay(next, subjectId, effect.status, count, effect.stackDownDelay);
        }
        if (priorityGained > 0 || effect.status === "priority") {
          next = applyImmediatePriorityBudget(next, subjectId, priorityBefore, {
            protectBeforeControl: priorityPrecedesSelfControl(definition, effect),
          });
        }
        if (effect.status === "haste") {
          if (definition.consumesTurn) {
            next = protectStatusDecay(next, subjectId, effect.status, count, 1);
          } else {
            next = applyImmediateHasteBudget(next, subjectId, hasteBefore);
          }
        }
        next = push(next, "skill-status", {
          actorId: playerId,
          skillId,
          status: effect.status,
          target: effect.target,
          targetId: subjectId,
          count,
          ...(requestedCount !== count ? { requestedCount } : {}),
        });
        if (priorityGained > 0 && effect.status === "initiative") {
          next = push(next, "initiative-converted", {
            actorId: subjectId,
            skillId,
            initiativeSpent: priorityGained * 100,
            priorityGained,
            remainder: statusCount(updated.statuses, "initiative"),
          });
        }
      }
      return;
    }
  });

  return next;
}

function applyResolvedSkillEffects(state, definition, rank, actorId, resolvedTargets) {
  const skillId = definition.id;
  const actionId = `${state.sequence + 1}:${actorId}:${skillId}`;
  let next = push(state, "skill-committed", {
    actionId,
    actorId,
    skillId,
    rank,
    sourceCell: resolvedTargets.sourceCell,
    anchorCell: resolvedTargets.anchorCell,
    affectedCells: resolvedTargets.affectedCells,
    targetIds: resolvedTargets.targetIds,
    footprint: resolvedTargets.targeting.footprint,
    castMode: resolvedTargets.targeting.castMode,
    presentation: resolvedTargets.targeting.presentation,
  });
  const effectGroups = definition.effects.reduce((groups, effect, effectIndex) => {
    groups[effectRecipient(definition, effect, effectIndex)].push(effectIndex);
    return groups;
  }, { anchor: [], caster: [], all: [] });

  // One cast spends one action and one Resolve payment. Spatial recipients repeat only the
  // effects that belong on the footprint; caster riders and all-combatant effects resolve
  // exactly once. Row-major targets make RNG and one-shot attacker status consumption stable.
  for (const spatialTargetId of resolvedTargets.targetIds) {
    if (effectGroups.anchor.length === 0) break;
    next = applySkillEffects(next, skillId, rank, spatialTargetId, actorId, effectGroups.anchor);
  }
  if (effectGroups.all.length > 0) {
    next = applySkillEffects(
      next,
      skillId,
      rank,
      resolvedTargets.primaryTargetId,
      actorId,
      effectGroups.all,
    );
  }
  if (effectGroups.caster.length > 0) {
    next = applySkillEffects(
      next,
      skillId,
      rank,
      resolvedTargets.primaryTargetId,
      actorId,
      effectGroups.caster,
    );
  }
  return next;
}

function contextualEffectSubjectIds(state, definition, effect, effectIndex, actorId, resolvedTargets) {
  const recipient = effectRecipient(definition, effect, effectIndex);
  if (recipient === "anchor") return resolvedTargets.targetIds;
  if (recipient === "caster") return [actorId];
  return effectSubjectIds(
    state,
    "all",
    actorId,
    resolvedTargets.primaryTargetId,
  );
}

function hasContextualSkillOutcome(state, definition, rank, actorId, resolvedTargets) {
  const actor = state.actors[actorId];
  return definition.effects.some((effect, effectIndex) => {
    if (effect.type === "reduce-statuses") {
      return contextualEffectSubjectIds(
        state,
        definition,
        effect,
        effectIndex,
        actorId,
        resolvedTargets,
      ).some((subjectId) => {
        const subject = state.actors[subjectId];
        if (!subject || subject.hp <= 0) return false;
        if (effect.clearShield && subject.shield > 0) return true;
        return effect.toPercent < 100
          && effect.statuses.some((status) => statusCount(subject.statuses, status) > 0);
      });
    }
    const magnitude = effectMagnitude(definition.id, effectIndex, rank);
    if (effect.type === "modify-status") {
      return contextualEffectSubjectIds(
        state,
        definition,
        effect,
        effectIndex,
        actorId,
        resolvedTargets,
      ).some((subjectId) => {
        const subject = state.actors[subjectId];
        if (!subject || subject.hp <= 0) return false;
        const requestedDelta = magnitude;
        const statuses = requestedDelta < 0
          ? consumeStatusCount(subject.statuses, effect.status, Math.abs(requestedDelta))
          : applyStatus(subject.statuses, effect.status, requestedDelta);
        const updated = actorWithStatuses(subject, statuses);
        return JSON.stringify(updated.statuses) !== JSON.stringify(subject.statuses);
      });
    }
    if (effect.type === "damage") {
      const weaponAttack = definition.id === "strike"
        ? weaponAttackAtRank(buildFor(state, actorId)?.basicAttack, rank)
        : null;
      return resolvedTargets.targetIds.some((subjectId) => {
        const subject = state.actors[subjectId];
        if (!subject || subject.hp <= 0) return false;
        const authored = weaponAttack
          ? Math.floor((statOf(actor, effect.scale) * weaponAttack.damagePercent) / 100)
          : sourcedMagnitudeAmount(actor, subject, effect, magnitude);
        return authored > 0;
      });
    }
    if (effect.type === "restore-skill-uses") {
      if (Number.isFinite(actor.resolve)) {
        const cost = resolveCost(definition.id, rank);
        const afterCost = actor.resolve - cost;
        const finalResolve = Math.min(actor.resolveMax, afterCost + magnitude);
        return finalResolve > actor.resolve;
      }
      return buildFor(state, actorId)?.skills.some((entry) => {
        if (entry.id === definition.id || entry.usesRemaining === UNLIMITED_USES) return false;
        return restoreUses(entry, magnitude).usesRemaining > entry.usesRemaining;
      }) || false;
    }
    if (effect.type === "resolve-regen") {
      return Number.isFinite(actor.resolveRegen) && magnitude > actor.resolveRegen;
    }
    if (effect.type === "status" || effect.type === "scaled-status") {
      const recipient = effectRecipient(definition, effect, effectIndex);
      return contextualEffectSubjectIds(
        state,
        definition,
        effect,
        effectIndex,
        actorId,
        resolvedTargets,
      ).some((subjectId) => {
        const subject = state.actors[subjectId];
        if (!subject || subject.hp <= 0) return false;
        const scaleTargetId = recipient === "anchor"
          ? subjectId
          : resolvedTargets.primaryTargetId;
        const requestedCount = Math.min(
          MAX_STATUS_COUNT,
          effect.type === "status"
            ? magnitude
            : sourcedMagnitudeAmount(actor, state.actors[scaleTargetId], effect, magnitude),
        );
        if (requestedCount <= 0) return false;
        const updated = actorWithAppliedStatus(subject, effect.status, requestedCount);
        return JSON.stringify(updated.statuses) !== JSON.stringify(subject.statuses);
      });
    }
    if (effect.type === "shield") {
      return contextualEffectSubjectIds(
        state,
        definition,
        effect,
        effectIndex,
        actorId,
        resolvedTargets,
      ).some((subjectId) => {
        const subject = state.actors[subjectId];
        if (!subject || subject.hp <= 0) return false;
        const ward = definition.effects.reduce((total, candidate, candidateIndex) => {
          if (candidate.type !== "shield") return total;
          const candidateSubjects = contextualEffectSubjectIds(
            state,
            definition,
            candidate,
            candidateIndex,
            actorId,
            resolvedTargets,
          );
          if (!candidateSubjects.includes(subjectId)) return total;
          return total + Math.floor(
            (statOf(actor, candidate.scale)
              * effectMagnitude(definition.id, candidateIndex, rank)) / 100,
          );
        }, 0);
        return ward > subject.shield;
      });
    }
    if (effect.type === "scale-status") {
      return contextualEffectSubjectIds(
        state,
        definition,
        effect,
        effectIndex,
        actorId,
        resolvedTargets,
      ).some((subjectId) => {
        const subject = state.actors[subjectId];
        if (!subject || subject.hp <= 0) return false;
        const scaled = effect.statuses.reduce(
          (statuses, status) => scaleStatus(statuses, status, magnitude),
          subject.statuses,
        );
        const applied = actorWithStatuses(subject, scaled).statuses;
        return effect.statuses.some((status) => (
          statusCount(applied, status) !== statusCount(subject.statuses, status)
        ));
      });
    }
    if (effect.type === "scaled-status-enemy-lost-hp") {
      return contextualEffectSubjectIds(
        state,
        definition,
        effect,
        effectIndex,
        actorId,
        resolvedTargets,
      ).some((subjectId) => {
        const subject = state.actors[subjectId];
        if (!subject || subject.hp <= 0) return false;
        const lost = Math.max(0, subject.maxHp - subject.hp);
        const requestedCount = Math.floor((lost * magnitude) / 100);
        if (requestedCount <= 0) return false;
        const updated = actorWithAppliedStatus(subject, effect.status, requestedCount);
        return JSON.stringify(updated.statuses) !== JSON.stringify(subject.statuses);
      });
    }
    if (effect.type === "status-from-status") {
      const recipient = effectRecipient(definition, effect, effectIndex);
      return contextualEffectSubjectIds(
        state,
        definition,
        effect,
        effectIndex,
        actorId,
        resolvedTargets,
      ).some((subjectId) => {
        const subject = state.actors[subjectId];
        if (!subject || subject.hp <= 0) return false;
        const sourceId = effect.factorOwner === "enemy"
          ? (recipient === "anchor" ? subjectId : resolvedTargets.primaryTargetId)
          : actorId;
        const requestedCount = Math.min(
          MAX_STATUS_COUNT,
          Math.floor(statusCount(state.actors[sourceId]?.statuses, effect.factorStatus) * magnitude),
        );
        if (requestedCount <= 0) return false;
        const updated = actorWithAppliedStatus(subject, effect.status, requestedCount);
        return JSON.stringify(updated.statuses) !== JSON.stringify(subject.statuses);
      });
    }
    if (!["heal", "heal-flat", "heal-lost-fraction"].includes(effect.type)) return true;
    return contextualEffectSubjectIds(
      state,
      definition,
      effect,
      effectIndex,
      actorId,
      resolvedTargets,
    ).some((subjectId) => {
      const subject = state.actors[subjectId];
      if (!subject || subject.hp <= 0 || subject.hp >= subject.maxHp) return false;
      if (effect.type === "heal") {
        return sourcedMagnitudeAmount(actor, null, effect, magnitude) > 0;
      }
      if (effect.type === "heal-flat") return magnitude > 0;
      return Math.floor(((subject.maxHp - subject.hp) * magnitude) / 100) > 0;
    });
  });
}

export function combatSkillLegality(state, skillId, actorId = state.playerId) {
  if (state.phase !== "player") return { ok: false, reason: "encounter-over" };
  const actor = state.actors[actorId];
  if (!actor || actor.side !== "player") return { ok: false, reason: "unknown-actor" };
  if (actor.hp <= 0) return { ok: false, reason: "actor-down" };
  if (isControlled(state, actorId)) return { ok: false, reason: "action-nullified" };
  const build = buildFor(state, actorId);
  if (!build) return { ok: false, reason: "unknown-actor" };
  const skillState = build.skills.find((entry) => entry.id === skillId);
  if (!skillState) return { ok: false, reason: "skill-not-held" };
  const legality = skillLegality(skillState, {
    turnAvailable: actionsLeftFor(state, actorId) > 0,
    resolveAvailable: actor.resolve,
  });
  if (!legality.ok) return legality;
  const definition = getSkill(skillId);
  const useful = legalSkillAnchors(state, definition, actorId).some((anchorCell) => {
    const resolved = resolveSkillTargets(state, definition, actorId, { anchorCell });
    return resolved.ok
      && hasContextualSkillOutcome(state, definition, skillState.rank, actorId, resolved);
  });
  return useful
    ? { ok: true, reason: null }
    : { ok: false, reason: "no-effective-outcome" };
}

/**
 * Use one of the player's skills. Turn-free skills leave the primary action open.
 */
export function useSkill(
  state,
  skillId,
  targetId = null,
  actorId = state.playerId,
  anchorCell = null,
) {
  if (state.phase !== "player") return { ok: false, reason: "encounter-over", state };
  const actor = state.actors[actorId];
  if (!actor || actor.side !== "player") return { ok: false, reason: "unknown-actor", state };
  if (actor.hp <= 0) return { ok: false, reason: "actor-down", state };
  if (isControlled(state, actorId)) return { ok: false, reason: "action-nullified", state };

  const build = buildFor(state, actorId);
  if (!build) return { ok: false, reason: "unknown-actor", state };
  const index = build.skills.findIndex((entry) => entry.id === skillId);
  if (index < 0) return { ok: false, reason: "skill-not-held", state };
  const skillState = build.skills[index];
  const legality = skillLegality(skillState, {
    turnAvailable: actionsLeftFor(state, actorId) > 0,
    resolveAvailable: actor.resolve,
  });
  if (!legality.ok) return { ok: false, reason: legality.reason, state };

  const definition = getSkill(skillId);
  const resolvedTargets = resolveSkillTargets(state, definition, actorId, {
    anchorCell,
    targetId,
  });
  if (!resolvedTargets.ok) return { ok: false, reason: resolvedTargets.reason, state };
  if (!hasContextualSkillOutcome(state, definition, skillState.rank, actorId, resolvedTargets)) {
    return { ok: false, reason: "no-effective-outcome", state };
  }

  const spent = spendSkill(skillState);
  if (!spent.ok) return { ok: false, reason: spent.reason, state };

  const spentSkills = build.skills.map((entry, at) => (at === index ? spent.state : entry));
  let next = withBuild(state, actorId, { ...build, skills: spentSkills });
  const cost = Number.isFinite(actor.resolve) ? resolveCost(skillId, skillState.rank) : 0;
  if (cost > 0) {
    next = {
      ...next,
      actors: {
        ...next.actors,
        [actorId]: { ...next.actors[actorId], resolve: next.actors[actorId].resolve - cost },
      },
    };
    next = push(next, "resolve-spent", { actorId, skillId, amount: cost });
  }
  if (definition.consumesTurn) next = spendAction(next, actorId);
  next = applyResolvedSkillEffects(next, definition, skillState.rank, actorId, resolvedTargets);
  return { ok: true, reason: null, state: settle(next) };
}

/** Whether one carried combat consumable can be committed by this actor now. */
export function combatItemLegality(state, itemId, actorId = state.playerId) {
  if (state.phase !== "player") return { ok: false, reason: "encounter-over" };
  const actor = state.actors[actorId];
  if (!actor || actor.side !== "player") return { ok: false, reason: "unknown-actor" };
  if (actor.hp <= 0) return { ok: false, reason: "actor-down" };
  if (isControlled(state, actorId)) return { ok: false, reason: "action-nullified" };
  if (actionsLeftFor(state, actorId) <= 0) return { ok: false, reason: "turn-already-spent" };
  const item = getCombatItem(itemId);
  if (!item) return { ok: false, reason: "unknown-combat-item" };
  const held = buildFor(state, actorId)?.combatItems?.find((entry) => entry.id === itemId);
  if (!held || held.quantity <= 0) return { ok: false, reason: "item-spent" };
  if (item.effect.type === "heal-max-percent" && actor.hp >= actor.maxHp) {
    return { ok: false, reason: "health-full" };
  }
  if (item.effect.type === "restore-resolve"
    && (!Number.isFinite(actor.resolve)
      || (actor.resolve >= actor.resolveMax
        && actor.resolveRegen >= (item.effect.regenMinimum || 0)))) {
    return { ok: false, reason: "resolve-full" };
  }
  return { ok: true, reason: null };
}

/** Spend one action and one snapshotted consumable through the authoritative reducer. */
export function useCombatItem(state, itemId, targetId = null, actorId = state.playerId) {
  const legality = combatItemLegality(state, itemId, actorId);
  if (!legality.ok) return { ok: false, reason: legality.reason, state };
  const item = getCombatItem(itemId);
  const actor = state.actors[actorId];
  const target = item.effect.target === "enemy"
    ? state.actors[targetId || livingEnemies(state)[0]]
    : actor;
  if (!target || target.hp <= 0) return { ok: false, reason: "no-target", state };

  let next = updateBuildFor(state, actorId, (build) => ({
    ...build,
    combatItems: build.combatItems.flatMap((entry) => {
      if (entry.id !== itemId) return [entry];
      return entry.quantity > 1 ? [{ ...entry, quantity: entry.quantity - 1 }] : [];
    }),
  }));
  let amount = 0;
  let hits = null;

  if (item.effect.type === "heal-max-percent") {
    amount = Math.min(
      actor.maxHp - actor.hp,
      Math.max(1, Math.floor((actor.maxHp * item.effect.percent) / 100)),
    );
    next = {
      ...next,
      actors: { ...next.actors, [actorId]: { ...next.actors[actorId], hp: actor.hp + amount } },
    };
  } else if (item.effect.type === "restore-resolve") {
    amount = Math.min(item.effect.amount, actor.resolveMax - actor.resolve);
    const resolveRegen = Math.max(actor.resolveRegen, item.effect.regenMinimum || 0);
    next = {
      ...next,
      actors: {
        ...next.actors,
        [actorId]: {
          ...next.actors[actorId],
          resolve: actor.resolve + amount,
          resolveRegen,
        },
      },
    };
  } else if (item.effect.type === "shield-defense-percent") {
    const raised = Math.max(1, Math.floor((statOf(actor, "defense") * item.effect.percent) / 100));
    const after = Math.max(actor.shield, raised);
    amount = Math.max(0, after - actor.shield);
    next = {
      ...next,
      actors: { ...next.actors, [actorId]: { ...next.actors[actorId], shield: after } },
    };
  } else if (item.effect.type === "damage-attack-percent") {
    const damage = Math.max(1, Math.floor((statOf(actor, "attack") * item.effect.percent) / 100));
    const hit = resolveAttack({
      attacker: actor,
      defender: target,
      attack: { hits: 1, damage },
      rng: next.rng,
    });
    hits = hit.hits;
    amount = hits.reduce((total, entry) => total + (entry.toHp || 0), 0);
    next = {
      ...next,
      rng: hit.rng,
      actors: {
        ...next.actors,
        [actorId]: hit.attacker,
        [target.id]: actorWithStatuses(hit.defender, hit.defender.statuses),
      },
    };
  }

  next = push(next, "combat-item-used", {
    actorId,
    itemId,
    effect: item.effect.type,
    targetId: target.id,
    amount,
    ...(item.effect.type === "restore-resolve"
      ? { resolveRegen: next.actors[actorId].resolveRegen }
      : {}),
    ...(hits ? { hits } : {}),
  });
  if (item.consumesTurn) next = spendAction(next, actorId);
  return { ok: true, reason: null, state: settle(next) };
}

/** How many actions this actor has left in the current command window. */
export function actionsLeftFor(state, actorId) {
  if (actorId === state.playerId) return state.turn.actionsRemaining;
  return state.turn.allies?.[actorId] ?? 0;
}

function withBuild(state, actorId, build) {
  if (actorId === state.playerId) return { ...state, build };
  return { ...state, allyBuilds: { ...state.allyBuilds, [actorId]: build } };
}

function spendAction(state, actorId) {
  // Priority actions are always spent before the ordinary action budget. Comparing the
  // remaining total with a recomputed base budget leaves a phantom Priority stack when a
  // turn-consuming skill grants Priority after its base action has already been spent.
  const spendsPriority = priorityAdvantageFor(state, actorId) > 0;
  let next;
  if (actorId === state.playerId) {
    next = {
      ...state,
      turn: { ...state.turn, actionsRemaining: Math.max(0, state.turn.actionsRemaining - 1) },
    };
  } else {
    next = {
      ...state,
      turn: {
        ...state.turn,
        allies: {
          ...state.turn.allies,
          [actorId]: Math.max(0, (state.turn.allies?.[actorId] ?? 0) - 1),
        },
      },
    };
  }
  return spendsPriority ? consumeActorPriority(next, actorId) : next;
}

/** Spend one actor's action on one replay-safe, party-wide attempt to break contact. */
export function attemptRetreat(state, actorId = state.playerId) {
  if (state.phase !== "player") return { ok: false, reason: "encounter-over", state };
  const actor = state.actors[actorId];
  if (!actor || actor.side !== "player") return { ok: false, reason: "unknown-actor", state };
  if (actor.hp <= 0) return { ok: false, reason: "actor-down", state };
  if (isControlled(state, actorId)) return { ok: false, reason: "action-nullified", state };
  if (actionsLeftFor(state, actorId) <= 0) {
    return { ok: false, reason: "turn-already-spent", state };
  }

  const odds = retreatOdds(state);
  const rolled = nextInt(state.rng, 1, 100);
  const succeeded = rolled.value <= odds.chancePercent;
  let next = spendAction({ ...state, rng: rolled.rng }, actorId);
  next = push(next, "retreat-attempt", {
    actorId,
    ...odds,
    roll: rolled.value,
    succeeded,
  });
  if (succeeded) next = push({ ...next, phase: "retreated" }, "retreated", { actorId });
  return { ok: true, reason: null, state: next };
}

/**
 * Stand an actor down for the round without spending anything.
 *
 * Skipping an ally is an explicit command, never hidden AI. A companion who does nothing
 * did nothing because the player decided so, and the command log says as much.
 */
export function skipTurn(state, actorId) {
  if (state.phase !== "player") return { ok: false, reason: "encounter-over", state };
  const actor = state.actors[actorId];
  if (!actor || actor.side !== "player") return { ok: false, reason: "unknown-actor", state };
  if (actionsLeftFor(state, actorId) <= 0) return { ok: false, reason: "turn-already-spent", state };
  let next = state;
  while (actionsLeftFor(next, actorId) > 0) next = spendAction(next, actorId);
  const consumed = consumeControlWindow(next, actorId);
  if (consumed.controls.length > 0) {
    return {
      ok: true,
      reason: null,
      state: push(consumed.state, "actor-nullified", {
        actorId,
        controls: consumed.controls.map((entry) => entry.type),
        stacksSpent: consumed.controls.length,
      }),
    };
  }
  const hostilePriority = state.enemyIds.reduce(
    (most, enemyId) => Math.max(most, priorityAdvantageFor(state, enemyId)),
    0,
  );
  if (hostilePriority > 0) {
    return {
      ok: true,
      reason: null,
      state: push(next, "actor-preempted", { actorId, hostilePriority }),
    };
  }
  return { ok: true, reason: null, state: push(next, "actor-stood-down", { actorId }) };
}

// ---------------------------------------------------------------------------
// Ending the turn
// ---------------------------------------------------------------------------

function scheduledMaxHpGain(state, actor, entry) {
  if (Number.isFinite(entry.maxHpGain)) return entry.maxHpGain;
  if (entry.type !== "fatal") return 0;
  const definition = getSkill(entry.skillId);
  const effectIndex = definition?.effects.findIndex((effect) => (
    effect.type === "temporary-max-hp" && effect.fatal
  )) ?? -1;
  if (effectIndex < 0) return 0;
  const rank = buildFor(state, entry.sourceId)?.skills
    .find((skill) => skill.id === entry.skillId)?.rank ?? 1;
  if (!Number.isFinite(actor.resolve)) return Math.min(3_333, Math.max(0, actor.maxHp - 1));

  const fraction = LEGACY_TEMPORARY_MAX_HP_FRACTION;
  const approximate = Math.max(1, Math.floor((actor.maxHp * fraction) / (1 + fraction)));
  for (let offset = -2; offset <= 2; offset += 1) {
    const gain = approximate + offset;
    const baseMaxHp = actor.maxHp - gain;
    if (gain < 1 || baseMaxHp < 1) continue;
    const applied = Math.max(1, Math.floor(baseMaxHp * fraction));
    if (applied === gain) return gain;
  }
  return 0;
}

function boundaryStatusDamage(state, actorId, { onlyMisfortune = false, includeMisfortune = true } = {}) {
  const actor = state.actors[actorId];
  const burn = onlyMisfortune ? 0 : statusCount(actor.statuses, "burn");
  const doom = onlyMisfortune ? 0 : statusCount(actor.statuses, "doom");
  const poison = onlyMisfortune ? 0 : statusCount(actor.statuses, "poison");
  const bleed = onlyMisfortune ? 0 : statusCount(actor.statuses, "bleed");
  const misfortune = includeMisfortune ? statusCount(actor.statuses, "misfortune") : 0;
  const voidMonster = onlyMisfortune ? 0 : statusCount(actor.statuses, "void-monster");
  const hellfireSpirit = onlyMisfortune ? 0 : statusCount(actor.statuses, "hellfire-spirit");
  const fatalBlade = onlyMisfortune ? 0 : statusCount(actor.statuses, "fatal-blade");
  const scheduled = state.scheduledEffects || [];
  const due = onlyMisfortune
    ? []
    : scheduled.filter((entry) => entry.targetId === actorId && entry.turnsRemaining <= 1);
  const delayedDamage = due
    .filter((entry) => entry.type === "damage")
    .reduce((total, entry) => total + entry.amount, 0);
  const delayedSkillIds = due
    .filter((entry) => entry.type === "damage")
    .map((entry) => entry.skillId);
  const delayedStatuses = due
    .filter((entry) => entry.type === "damage" && entry.status)
    .map((entry) => entry.status);
  const forbiddenRitual = due.some((entry) => entry.type === "fatal");
  const maxHpExpired = due.reduce(
    (sum, entry) => sum + scheduledMaxHpGain(state, actor, entry),
    0,
  );
  const maxHpAfter = Math.max(1, actor.maxHp - maxHpExpired);
  const nonFatalTotal = burn + doom + poison + bleed + misfortune
    + voidMonster + hellfireSpirit + fatalBlade + delayedDamage;
  const fatalDamage = forbiddenRitual ? Math.max(0, actor.hp - nonFatalTotal) : 0;
  const total = nonFatalTotal + fatalDamage;
  const scheduledEffects = onlyMisfortune
    ? scheduled
    : scheduled.flatMap((entry) => {
      if (entry.targetId !== actorId) return [entry];
      if (entry.turnsRemaining <= 1) return [];
      return [{ ...entry, turnsRemaining: entry.turnsRemaining - 1 }];
    });
  if (total <= 0) return scheduledEffects === scheduled ? state : { ...state, scheduledEffects };
  // Boundary damage bypasses defences and Ward outright.
  const damaged = {
    ...actor,
    maxHp: maxHpAfter,
    hp: Math.min(maxHpAfter, Math.max(0, actor.hp - total)),
  };
  return push(
    {
      ...state,
      scheduledEffects,
      actors: { ...state.actors, [actorId]: damaged },
    },
    "tick-damage",
    {
      actorId,
      burn,
      doom,
      poison,
      bleed,
      misfortune,
      voidMonster,
      hellfireSpirit,
      fatalBlade,
      delayedDamage,
      delayedSkillIds,
      delayedStatuses,
      forbiddenRitual,
      fatalDamage,
      maxHpExpired,
      maxHpBefore: actor.maxHp,
      maxHpAfter,
      total,
      applied: Math.min(actor.hp, total),
    },
  );
}

function decayActorStatusesAtBoundary(state, actorId) {
  const actor = state.actors[actorId];
  const protection = state.statusDecayProtection?.[actorId] || {};
  let protectedStatuses = createStatusStack();
  let tickableStatuses = createStatusStack();
  const remainingProtection = {};

  for (const entry of actor.statuses) {
    const protectedEntry = protection[entry.type];
    const protectedCount = protectedEntry
      ? Math.min(entry.count, protectedEntry.count)
      : 0;
    const tickableCount = entry.count - protectedCount;
    if (tickableCount > 0) tickableStatuses = applyStatus(tickableStatuses, entry.type, tickableCount);
    if (protectedCount > 0) {
      protectedStatuses = applyStatus(protectedStatuses, entry.type, protectedCount);
      if (protectedEntry.turnsRemaining > 1) {
        remainingProtection[entry.type] = {
          count: protectedCount,
          turnsRemaining: protectedEntry.turnsRemaining - 1,
        };
      }
    }
  }

  let statuses = tickEndOfTurnDamage(tickableStatuses);
  statuses = tickEndOfTurn(statuses);
  for (const entry of protectedStatuses) statuses = applyStatus(statuses, entry.type, entry.count);

  const statusDecayProtection = { ...(state.statusDecayProtection || {}) };
  if (Object.keys(remainingProtection).length > 0) {
    statusDecayProtection[actorId] = remainingProtection;
  } else {
    delete statusDecayProtection[actorId];
  }

  return {
    ...state,
    statusDecayProtection,
    actors: {
      ...state.actors,
      [actorId]: actorWithStatuses(actor, statuses),
    },
  };
}

function resolveActorTurnEnd(state, actorId, { includeMisfortune = false } = {}) {
  const damaged = boundaryStatusDamage(state, actorId, { includeMisfortune });
  return decayActorStatusesAtBoundary(damaged, actorId);
}

function useEnemySkill(state, enemyId, skillId, targetId) {
  const build = state.enemyBuilds?.[enemyId];
  const index = build?.skills.findIndex((entry) => entry.id === skillId) ?? -1;
  if (index < 0) return { ok: false, reason: "skill-not-held", state };
  const skillState = build.skills[index];
  const enemy = state.actors[enemyId];
  const legality = skillLegality(skillState, {
    turnAvailable: true,
    resolveAvailable: enemy?.resolve,
  });
  if (!legality.ok) return { ok: false, reason: legality.reason, state };
  const definition = getSkill(skillId);
  const resolvedTargets = resolveEnemySkillTargets(state, enemyId, definition.id, targetId);
  if (!resolvedTargets.ok) return { ok: false, reason: resolvedTargets.reason, state };
  const spent = spendSkill(skillState);
  if (!spent.ok) return { ok: false, reason: spent.reason, state };

  const skills = build.skills.map((entry, at) => (at === index ? spent.state : entry));
  let next = {
    ...state,
    enemyBuilds: {
      ...state.enemyBuilds,
      [enemyId]: { ...build, skills },
    },
  };
  const cost = Number.isFinite(enemy?.resolve) ? resolveCost(skillId, skillState.rank) : 0;
  if (cost > 0) {
    next = {
      ...next,
      actors: {
        ...next.actors,
        [enemyId]: { ...next.actors[enemyId], resolve: next.actors[enemyId].resolve - cost },
      },
    };
    next = push(next, "resolve-spent", { actorId: enemyId, skillId, amount: cost });
  }
  next = applyResolvedSkillEffects(next, definition, skillState.rank, enemyId, resolvedTargets);
  return { ok: true, reason: null, state: settle(next) };
}

/**
 * End the player's turn: every living enemy acts, then boundary statuses tick, then the
 * round advances and cadence traits fire.
 */
export function endTurn(state) {
  if (state.phase !== "player") return { ok: false, reason: "encounter-over", state };

  // Every living foe's declaration is checked against its own action index before anything
  // resolves. A telegraph the engine cannot honour means the recorded fight and the fight
  // being played have come apart, and continuing would hide that at exactly the point it
  // matters. Checking up front also means the refusal costs nothing: nothing has moved yet.
  for (const enemyId of state.enemyIds) {
    const enemy = state.actors[enemyId];
    if (enemy.hp <= 0 || !state.intents[enemyId]) continue;
    const declared = resolveDeclaredAttack(state.intents[enemyId], state.enemyAttacks[enemyId] || []);
    const skillState = declared?.skillId
      ? enemySkillState(state, enemyId, declared.skillId)
      : null;
    if (!declared || (declared.skillId && (
      !skillState || !skillLegality(skillState, {
        turnAvailable: true,
        resolveAvailable: enemy.resolve,
      }).ok
    ))) {
      return { ok: false, reason: "intent-desync", state };
    }
  }

  let next = state;

  // Control is a scheduler rule, not a UI convention.  A caller may hand the window over
  // directly (the replay runner and deterministic balance harness both do), so consume the
  // forfeited command here as well as through the explicit `skipTurn` command.  Only actors
  // who still have an action are affected: self-control applied after an action (Mortal
  // Blow, Incineration) belongs to the *next* command window and must not disappear early.
  for (const actorId of playerSideIds(next)) {
    if (actionsLeftFor(next, actorId) <= 0 || !isControlled(next, actorId)) continue;
    const skipped = skipTurn(next, actorId);
    if (skipped.ok) next = skipped.state;
  }

  // Freeze the opposed Priority arithmetic before player-side end-of-turn decay. Otherwise
  // tied stacks can help the player, lose one on this boundary, then help the enemy again in
  // the same round. Priority newly granted inside an enemy window is still added below.
  const enemyPriorityAtWindowOpen = Object.fromEntries(next.enemyIds.map((enemyId) => [
    enemyId,
    priorityAdvantageFor(next, enemyId),
  ]));

  // This call is the player side handing its command window over. Resolve every player-side
  // holder's persistent wounds now, before the enemy can apply a new one. In particular, a
  // Doom inflicted in the coming hostile window must survive through the next player window
  // and cannot detonate immediately after the skill that inflicted it.
  for (const actorId of playerSideIds(next)) {
    if (next.actors[actorId].hp <= 0) continue;
    next = resolveActorTurnEnd(next, actorId, { includeMisfortune: true });
  }
  next = settle(next);
  if (next.phase !== "player") return { ok: true, reason: null, state: next };

  // Any hostile ward standing here already protected its owner throughout the player's
  // command window. Clear it before the foe can refresh or attack behind the same brace.
  next = expireWards(next, next.enemyIds, "player-window");

  // Misfortune is explicitly beginning-of-enemy-turn damage. Resolve it before the foe's
  // command so a fatal judgment prevents that command instead of landing after retaliation.
  for (const enemyId of next.enemyIds) {
    if (next.actors[enemyId].hp <= 0) continue;
    next = boundaryStatusDamage(next, enemyId, { onlyMisfortune: true });
  }
  next = settle(next);
  if (next.phase !== "player") return { ok: true, reason: null, state: next };

  for (const enemyId of next.enemyIds) {
    if (next.phase !== "player") break;
    if (next.actors[enemyId].hp <= 0) continue;

    // One enemy command window has ordinary actions from the base turn and Haste, plus a
    // separate front-loaded Priority budget. Free actions spend neither. If a free setup
    // grants Priority (Chi Liberation), its newly won actions join this same window before
    // control can return to the player.
    let regularRemaining = regularActionsFor(next.actors[enemyId]);
    let priorityRemaining = enemyPriorityAtWindowOpen[enemyId] || 0;
    let commandsResolved = 0;

    while (
      next.phase === "player"
      && next.actors[enemyId].hp > 0
      && (regularRemaining > 0 || priorityRemaining > 0)
    ) {
      if (commandsResolved >= MAX_ENEMY_COMMANDS_PER_WINDOW) {
        next = push(next, "enemy-waits", { enemyId, reason: "command-window-safety-limit" });
        break;
      }

      const enemy = next.actors[enemyId];
      if (isControlled(next, enemyId)) {
        // Control forfeits the whole actor window and consumes one stack of every active
        // control family. The held telegraph remains the promise for its next legal window.
        const consumed = consumeControlWindow(next, enemyId);
        next = consumeActorPriority(consumed.state, enemyId, priorityRemaining);
        next = push(next, "enemy-nullified", {
          enemyId,
          controls: consumed.controls.map((entry) => entry.type),
          priorityLost: priorityRemaining,
        });
        regularRemaining = 0;
        priorityRemaining = 0;
        break;
      }

      // The foe performs what it declared. Build-backed foes resolve the exact same skill
      // definition, rank, uses, cooldowns and effects a player with that archetype would use.
      // Legacy saved fights continue through their immutable attack table below.
      const table = next.enemyAttacks?.[enemyId] || [];
      const declared = next.intents[enemyId]
        ? resolveDeclaredAttack(next.intents[enemyId], table)
        : null;
      const spendingPriority = priorityRemaining > 0;

      if (declared?.skillId && next.enemyBuilds?.[enemyId]) {
        const standing = livingPlayerSide(next);
        const declaredTarget = next.intents[enemyId]?.targetId;
        const targetId = declared.target === "self"
          ? enemyId
          : standing.includes(declaredTarget) ? declaredTarget : standing[0];
        if (!targetId) break;
        const definition = getSkill(declared.skillId);
        const hasteBefore = statusCount(next.actors[enemyId].statuses, "haste");
        const priorityBefore = priorityAdvantageFor(next, enemyId);
        const used = useEnemySkill(next, enemyId, declared.skillId, targetId);
        if (!used.ok) return { ok: false, reason: "intent-desync", state };
        const hasteAfter = statusCount(used.state.actors[enemyId].statuses, "haste");
        const priorityAfter = priorityAdvantageFor(used.state, enemyId);
        if (!definition.consumesTurn) {
          regularRemaining += Math.max(0, hasteAfter - hasteBefore);
        }
        priorityRemaining += Math.max(0, priorityAfter - priorityBefore);

        // Advance from the declaration that was actually honoured. Availability is
        // evaluated after spending it, so a cooling-down Chi Liberation cannot be selected
        // repeatedly inside the newly-created Priority sequence.
        next = advanceEnemyIntent(used.state, enemyId);
        if (definition.consumesTurn) {
          if (spendingPriority) {
            next = consumeActorPriority(next, enemyId);
            priorityRemaining = Math.max(0, priorityRemaining - 1);
          } else {
            regularRemaining = Math.max(0, regularRemaining - 1);
          }
        }
        commandsResolved += 1;
        next = settle(next);
        continue;
      }

      if (next.enemyBuilds?.[enemyId] && !declared) {
        next = push(next, "enemy-waits", { enemyId, reason: "no-ready-skill" });
        break;
      }

      const attack = declared
        ?? { id: "basic", name: "Attack", hits: 1, damage: enemy.stats.attack };
      // The foe strikes whoever it named. If that actor has since gone down, the blow falls
      // on the next one still standing rather than on a body.
      const standing = livingPlayerSide(next);
      const declaredTarget = next.intents[enemyId]?.targetId;
      const defenderId = standing.includes(declaredTarget) ? declaredTarget : standing[0];
      if (!defenderId) break;
      const resolved = resolveAttack({
        attacker: enemy,
        defender: next.actors[defenderId],
        attack: { hits: attack.hits, damage: authoredAttackDamage(enemy, attack.damage) },
        rng: next.rng,
      });
      next = {
        ...next,
        rng: resolved.rng,
        actors: {
          ...next.actors,
          [enemyId]: resolved.attacker,
          [defenderId]: actorWithStatuses(resolved.defender, resolved.defender.statuses),
        },
      };
      next = push(next, "enemy-attack", {
        enemyId,
        targetId: defenderId,
        attackId: attack.id,
        hits: resolved.hits,
      });
      if (declared) next = advanceEnemyIntent(next, enemyId);
      if (spendingPriority) {
        next = consumeActorPriority(next, enemyId);
        priorityRemaining = Math.max(0, priorityRemaining - 1);
      } else {
        regularRemaining = Math.max(0, regularRemaining - 1);
      }
      commandsResolved += 1;
      next = settle(next);
    }

    // Each foe owns a distinct command window. Its wounds resolve after that window, before
    // the next foe acts, so a fatal Bleed or Poison tick cannot leave a defeated combatant
    // standing through the rest of the enemy line.
    if (next.phase === "player" && next.actors[enemyId].hp > 0) {
      next = resolveActorTurnEnd(next, enemyId);
      next = settle(next);
    }
  }
  // Player and ally wards have now met the entire hostile command window. Leftover points
  // are not banked into another round.
  next = expireWards(next, playerSideIds(next), "enemy-window");

  if (next.phase !== "player") return { ok: true, reason: null, state: next };

  // Cooldowns tick for everyone who could have spent one, allies included.
  const tickedAllyBuilds = {};
  for (const [allyId, build] of Object.entries(next.allyBuilds || {})) {
    tickedAllyBuilds[allyId] = { ...build, skills: build.skills.map(tickSkillCooldown) };
  }
  const tickedEnemyBuilds = {};
  for (const [enemyId, build] of Object.entries(next.enemyBuilds || {})) {
    tickedEnemyBuilds[enemyId] = { ...build, skills: build.skills.map(tickSkillCooldown) };
  }
  next = {
    ...next,
    round: next.round + 1,
    build: {
      ...next.build,
      skills: next.build.skills.map(tickSkillCooldown),
    },
    allyBuilds: tickedAllyBuilds,
    enemyBuilds: tickedEnemyBuilds,
  };
  next = regenerateResolve(next);

  // Cadence traits still fire before the action count is read, so a Swift proc this round is
  // an extra action this round rather than next. Moving formations reflow once afterwards,
  // from one snapshot, and held telegraphs are explicitly retargeted before the fresh player
  // window is exposed. Static v1 formations take the byte-identical historical path.
  next = fireTraits(next);
  if (next.formations?.version === MOVING_FORMATION_RULES_VERSION) {
    next = reflowRoundFormations(next);
    next = retargetHeldIntents(next);
  }
  next = declareRoundIntents(withFreshTurn(next));
  return { ok: true, reason: null, state: settle(next) };
}

/** Remaining combat resource; legacy encounters still report their captured charge total. */
export function loadoutUsesRemaining(state) {
  const player = state.actors?.[state.playerId];
  if (Number.isFinite(player?.resolve)) return player.resolve;
  return state.build.skills.reduce(
    (total, entry) => (entry.usesRemaining === UNLIMITED_USES ? total : total + entry.usesRemaining),
    0,
  );
}

export function createStatuses() {
  return createStatusStack();
}
