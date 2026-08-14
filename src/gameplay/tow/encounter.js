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
  removeStatus,
  scaleStatus,
  statusCount,
  tickEndOfTurn,
} from "../kernel/status-stack.js";
import { createTowActor, isTowActor } from "../kernel/tow-actor.js";
import { resolveAttack } from "../kernel/tow-damage.js";
import {
  createSkillState,
  effectMagnitude,
  getSkill,
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

const CONTROL_STATUS_TYPES = Object.freeze(["stun", "paralyze", "sleep"]);
const MAX_ENEMY_COMMANDS_PER_WINDOW = 96;

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
          actors[targetId] = {
            ...actors[targetId],
            statuses: applyStatus(actors[targetId].statuses, status, amount),
          };
        }
        next = { ...next, actors };
      } else if (kind === "grant-status") {
        const owner = next.actors[ownerId];
        targetIds.push(ownerId);
        next = {
          ...next,
          actors: {
            ...next.actors,
            [ownerId]: { ...owner, statuses: applyStatus(owner.statuses, status, amount) },
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
          actors[targetId] = {
            ...actors[targetId],
            statuses: applyStatus(actors[targetId].statuses, status, amount),
          };
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
  return {
    ...state,
    actors: { ...state.actors, [actorId]: { ...actor, statuses } },
  };
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
    turn: { actionsRemaining: actionsForRound(state, state.playerId), allies },
  };
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
      - statusCount(actor.statuses, "weak")
      - statusCount(actor.statuses, "lethargy")
      - statusCount(actor.statuses, "cripple"));
  if (scale === "defense") return actor.stats.defense + statusCount(actor.statuses, "tenacity");
  if (scale === "max-hp") return actor.maxHp;
  return 0;
}

/** Validate and normalise one actor's traits, skills and runes. */
function normalizeBuild(build) {
  const traits = cloneJsonData(build?.traits || {}, "invalid-build-traits");
  for (const [traitId, rank] of Object.entries(traits)) {
    if (!getCombatTrait(traitId)) throw new TypeError(`unknown-trait:${traitId}`);
    if (!Number.isSafeInteger(rank) || rank < 1 || rank > 7) throw new TypeError("invalid-trait-rank");
  }
  const skills = (build?.skills || []).map((entry) => (
    typeof entry === "string" ? createSkillState(entry) : { ...entry }
  ));
  const hasBasicAttack = Object.hasOwn(build || {}, "basicAttack");
  const basicAttack = build?.basicAttack == null
    ? null
    : normalizeWeaponAttackSnapshot(build.basicAttack);
  if (build?.basicAttack != null && !basicAttack) throw new TypeError("invalid-basic-attack");
  return {
    traits,
    skills,
    runes: [...(build?.runes || [])],
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
function applyImmediatePriorityBudget(state, actorId, priorityBefore) {
  const actor = state.actors[actorId];
  if (state.phase !== "player" || actor?.side !== "player") return state;
  const priorityAfter = statusCount(actor.statuses, "priority");
  const enemyPriority = state.enemyIds.reduce((most, enemyId) => {
    const enemy = state.actors[enemyId];
    if (!enemy || enemy.hp <= 0) return most;
    return Math.max(most, statusCount(enemy.statuses, "priority"));
  }, 0);
  const beforeNet = Math.max(0, priorityBefore - enemyPriority);
  const afterNet = Math.max(0, priorityAfter - enemyPriority);
  const gainedActions = Math.max(0, afterNet - beforeNet);
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

export function createTowEncounter({
  seed,
  intentSeed,
  intentSchedules,
  player,
  enemies,
  build,
  allies = [],
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
    allyBuilds[actor.id] = normalizeBuild(allyBuild);
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
      const normalized = normalizeBuild(enemyBuild);
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

  const playerBuild = normalizeBuild(build);

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
    turn: { actionsRemaining: 1, allies: {} },
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
      return effect.statuses.some((status) => statusCount(actor.statuses, status) > 0);
    }
    if (effect.type === "amplify-statuses") {
      return targets.some((target) => effect.statuses.some((status) => statusCount(target.statuses, status) > 0));
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
    skillLegality(skillState, { turnAvailable: true }).ok
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

function targetEnemyIntent(state, enemyId, intent) {
  const action = resolveDeclaredAttack(intent, state.enemyAttacks[enemyId] || []);
  if (!action) return intent;
  if (action.target === "self") return { ...intent, targetId: enemyId };
  const standing = livingPlayerSide(state);
  return {
    ...intent,
    targetId: standing.includes(intent.targetId) ? intent.targetId : standing[0] ?? null,
  };
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
      const targetId = attack.target === "self"
        ? enemyId
        : standing.includes(declaredTarget) ? declaredTarget : standing[0] ?? null;
      return {
        enemyId,
        attackId: attack.id,
        skillId: attack.skillId || null,
        name: attack.name,
        hits: attack.hits,
        damage: attack.damage,
        kind: attack.kind || "damage",
        target: attack.target || "enemy",
        targetId,
        targetName: targetId ? state.actors[targetId].name : null,
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

export function isTowEncounter(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (value.version !== TOW_ENCOUNTER_VERSION) return false;
  if (!PHASES.has(value.phase)) return false;
  if (!Number.isSafeInteger(value.round) || value.round < 1) return false;
  if (!Array.isArray(value.enemyIds) || value.enemyIds.length < 1) return false;
  if (!Array.isArray(value.events) || value.events.length !== value.sequence) return false;
  if (value.events.length > MAX_ENCOUNTER_EVENTS) return false;
  if (!isRngState(value.rng) || !isRngState(value.intentRng)) return false;
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
  if (value.build?.basicAttack != null && !isWeaponAttackSnapshot(value.build?.basicAttack)) return false;
  const actorIds = [value.playerId, ...value.allyIds, ...value.enemyIds];
  if (new Set(actorIds).size !== actorIds.length) return false;
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
function isControlled(actor) {
  return activeControlStatuses(actor).length > 0;
}

/**
 * Every effect type the resolver can actually express.
 *
 * A skill whose effect is not on this list does nothing when used — it is transcribed into
 * the catalogue and then silently ignored, which is the worst of both worlds: the player is
 * offered it, spends a use and a turn on it, and gets no rules. A generated test walks the
 * whole catalogue against this list so a newly transcribed effect fails loudly here rather
 * than quietly in someone's fight.
 */
export const SUPPORTED_SKILL_EFFECT_TYPES = Object.freeze([
  "amplify-statuses",
  "consume-status",
  "damage",
  "damage-enemy-lost-hp",
  "damage-self-lost-hp",
  "heal",
  "heal-lost-fraction",
  "reduce-statuses",
  "scaled-status",
  "scaled-status-enemy-lost-hp",
  "shield",
  "status",
]);

function applySkillEffects(state, skillId, rank, targetId, actorId) {
  const definition = getSkill(skillId);
  let next = state;
  // Whoever was commanded, not always the protagonist: an ally's Block shields the ally.
  const playerId = actorId ?? next.playerId;
  const shieldEffectIndexes = definition.effects
    .map((effect, index) => (effect.type === "shield" ? index : -1))
    .filter((index) => index >= 0);
  const lastShieldEffectIndex = shieldEffectIndexes.at(-1) ?? -1;
  const shieldBeforeSkill = next.actors[playerId]?.shield || 0;
  let shieldRaisedBySkill = 0;

  definition.effects.forEach((effect, index) => {
    // Asked for per branch rather than up front: not every effect carries a rank table, and
    // demanding one from an effect that has none crashed the whole skill — which is how
    // First Aid, a skill three professions ship with, threw the moment it was used.
    const magnitude = () => effectMagnitude(skillId, index, rank);
    const player = next.actors[playerId];

    if (effect.type === "damage") {
      const target = next.actors[targetId];
      if (!target || target.hp <= 0) return;
      const priorityBefore = statusCount(player.statuses, "priority");
      const weaponAttack = skillId === "strike"
        ? weaponAttackAtRank(buildFor(next, playerId)?.basicAttack, rank)
        : null;
      const amount = Math.floor((statOf(player, effect.scale) * (
        weaponAttack?.damagePercent ?? magnitude()
      )) / 100);
      const hit = resolveAttack({
        attacker: player,
        defender: target,
        attack: { hits: weaponAttack?.hits ?? effect.hits ?? 1, damage: amount },
        rng: next.rng,
      });
      next = {
        ...next,
        rng: hit.rng,
        actors: { ...next.actors, [playerId]: hit.attacker, [targetId]: hit.defender },
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
            [targetId]: {
              ...currentTarget,
              statuses: applyStatus(currentTarget.statuses, statusEffect.status, count),
            },
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
      const shield = Math.max(shieldBeforeSkill, shieldRaisedBySkill);
      next = {
        ...next,
        actors: { ...next.actors, [playerId]: { ...player, shield } },
      };
      next = push(next, "skill-shield", {
        actorId: playerId,
        skillId,
        amount: Math.max(0, shield - shieldBeforeSkill),
        ward: shieldRaisedBySkill,
        before: shieldBeforeSkill,
        after: shield,
      });
      return;
    }

    if (effect.type === "heal") {
      const amount = Math.floor((statOf(player, effect.scale) * magnitude()) / 100);
      if (amount <= 0 || player.hp >= player.maxHp) return;
      next = {
        ...next,
        actors: {
          ...next.actors,
          [playerId]: { ...player, hp: Math.min(player.maxHp, player.hp + amount) },
        },
      };
      next = push(next, "skill-heal", { actorId: playerId, skillId, amount });
      return;
    }

    if (effect.type === "damage-enemy-lost-hp" || effect.type === "damage-self-lost-hp") {
      const target = next.actors[targetId];
      if (!target || target.hp <= 0) return;
      const source = effect.type === "damage-self-lost-hp" ? player : target;
      const lost = Math.max(0, source.maxHp - source.hp);
      const amount = Math.floor((lost * magnitude()) / 100);
      if (amount <= 0) return;
      const applied = Math.min(target.hp, amount);
      next = {
        ...next,
        actors: {
          ...next.actors,
          [targetId]: { ...target, hp: target.hp - applied },
        },
      };
      next = applyImmediatePriorityBudget(next, playerId, priorityBefore);
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

    // First Aid heals a fraction of what has already been lost, so it is worth most to
    // someone badly hurt and nearly nothing to someone barely scratched.
    if (effect.type === "heal-lost-fraction") {
      const lost = Math.max(0, player.maxHp - player.hp);
      const amount = Math.floor((lost * magnitude()) / 100);
      if (amount <= 0) return;
      next = {
        ...next,
        actors: {
          ...next.actors,
          [playerId]: { ...player, hp: Math.min(player.maxHp, player.hp + amount) },
        },
      };
      next = push(next, "skill-heal", { actorId: playerId, skillId, amount });
      return;
    }

    // Cleaning a wound: bleed, burn and poison are scaled down rather than decremented, so
    // it bites harder on a heavy stack than a light one.
    if (effect.type === "reduce-statuses") {
      const subjectId = effect.target === "enemy" ? targetId : playerId;
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
      if (removed <= 0) return;
      next = {
        ...next,
        actors: { ...next.actors, [subjectId]: { ...subject, statuses: cleaned } },
      };
      next = push(next, "skill-cleanse", {
        actorId: playerId,
        skillId,
        targetId: subjectId,
        statuses: [...effect.statuses],
        removed,
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
        actors: { ...next.actors, [playerId]: { ...player, statuses } },
      };
      next = push(next, "skill-status-spent", {
        actorId: playerId,
        skillId,
        status: effect.status,
        spent,
      });
      return;
    }

    if (effect.type === "amplify-statuses") {
      const target = next.actors[targetId];
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
        actors: { ...next.actors, [targetId]: { ...target, statuses: amplified } },
      };
      next = push(next, "skill-status-amplified", {
        actorId: playerId,
        skillId,
        targetId,
        statuses: [...effect.statuses],
        percent: magnitude(),
        gained,
      });
      return;
    }

    // Judge of Fate reads the target rather than the caster: the more a foe has already
    // lost, the heavier the misfortune that lands on them.
    if (effect.type === "scaled-status-enemy-lost-hp") {
      const target = next.actors[targetId];
      if (!target || target.hp <= 0) return;
      const lost = Math.max(0, target.maxHp - target.hp);
      const count = Math.floor((lost * magnitude()) / 100);
      if (count <= 0) return;
      next = {
        ...next,
        actors: {
          ...next.actors,
          [targetId]: { ...target, statuses: applyStatus(target.statuses, effect.status, count) },
        },
      };
      next = push(next, "skill-status", {
        actorId: playerId,
        skillId,
        status: effect.status,
        target: effect.target,
        targetId,
        count,
      });
      return;
    }

    if (effect.type === "status" || effect.type === "scaled-status") {
      const count = effect.type === "status"
        ? magnitude()
        : Math.floor((statOf(player, effect.scale) * magnitude()) / 100);
      if (count <= 0) return;
      if (effect.target === "self") {
        const priorityBefore = effect.status === "priority"
          ? statusCount(player.statuses, "priority")
          : 0;
        next = {
          ...next,
          actors: {
            ...next.actors,
            [playerId]: { ...player, statuses: applyStatus(player.statuses, effect.status, count) },
          },
        };
        if (effect.status === "priority") {
          next = applyImmediatePriorityBudget(next, playerId, priorityBefore);
        }
      } else {
        const target = next.actors[targetId];
        if (!target || target.hp <= 0) return;
        next = {
          ...next,
          actors: {
            ...next.actors,
            [targetId]: { ...target, statuses: applyStatus(target.statuses, effect.status, count) },
          },
        };
      }
      next = push(next, "skill-status", {
        actorId: playerId,
        skillId,
        status: effect.status,
        target: effect.target,
        targetId: effect.target === "self" ? playerId : targetId,
        count,
      });
    }
  });

  return next;
}

/**
 * Use one of the player's skills. Turn-free skills leave the primary action open.
 */
export function useSkill(state, skillId, targetId = null, actorId = state.playerId) {
  if (state.phase !== "player") return { ok: false, reason: "encounter-over", state };
  const actor = state.actors[actorId];
  if (!actor || actor.side !== "player") return { ok: false, reason: "unknown-actor", state };
  if (actor.hp <= 0) return { ok: false, reason: "actor-down", state };
  if (isControlled(actor)) return { ok: false, reason: "action-nullified", state };

  const build = buildFor(state, actorId);
  if (!build) return { ok: false, reason: "unknown-actor", state };
  const index = build.skills.findIndex((entry) => entry.id === skillId);
  if (index < 0) return { ok: false, reason: "skill-not-held", state };
  const skillState = build.skills[index];
  const legality = skillLegality(skillState, { turnAvailable: actionsLeftFor(state, actorId) > 0 });
  if (!legality.ok) return { ok: false, reason: legality.reason, state };

  const definition = getSkill(skillId);
  const target = targetId || livingEnemies(state)[0];
  if (definition.effects.some((effect) => effect.target === "enemy") && !target) {
    return { ok: false, reason: "no-target", state };
  }

  const spent = spendSkill(skillState);
  if (!spent.ok) return { ok: false, reason: spent.reason, state };

  const spentSkills = build.skills.map((entry, at) => (at === index ? spent.state : entry));
  let next = withBuild(state, actorId, { ...build, skills: spentSkills });
  if (definition.consumesTurn) next = spendAction(next, actorId);
  next = applySkillEffects(next, skillId, skillState.rank, target, actorId);
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
  const actor = state.actors[actorId];
  const actionsBefore = actionsLeftFor(state, actorId);
  const spendsPriority = actionsBefore > regularActionsFor(actor);
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
  if (isControlled(actor)) return { ok: false, reason: "action-nullified", state };
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

function boundaryStatusDamage(state, actorId, { onlyMisfortune = false, includeMisfortune = true } = {}) {
  const actor = state.actors[actorId];
  const burn = onlyMisfortune ? 0 : statusCount(actor.statuses, "burn");
  const doom = onlyMisfortune ? 0 : statusCount(actor.statuses, "doom");
  const poison = onlyMisfortune ? 0 : statusCount(actor.statuses, "poison");
  const bleed = onlyMisfortune ? 0 : statusCount(actor.statuses, "bleed");
  const misfortune = includeMisfortune ? statusCount(actor.statuses, "misfortune") : 0;
  const total = burn + doom + poison + bleed + misfortune;
  if (total <= 0) return state;
  // Boundary damage bypasses defences and Ward outright.
  const damaged = { ...actor, hp: Math.max(0, actor.hp - total) };
  return push(
    { ...state, actors: { ...state.actors, [actorId]: damaged } },
    "tick-damage",
    { actorId, burn, doom, poison, bleed, misfortune },
  );
}

function useEnemySkill(state, enemyId, skillId, targetId) {
  const build = state.enemyBuilds?.[enemyId];
  const index = build?.skills.findIndex((entry) => entry.id === skillId) ?? -1;
  if (index < 0) return { ok: false, reason: "skill-not-held", state };
  const skillState = build.skills[index];
  const legality = skillLegality(skillState, { turnAvailable: true });
  if (!legality.ok) return { ok: false, reason: legality.reason, state };
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
  next = applySkillEffects(next, skillId, skillState.rank, targetId, enemyId);
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
      !skillState || !skillLegality(skillState, { turnAvailable: true }).ok
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
    if (actionsLeftFor(next, actorId) <= 0 || !isControlled(next.actors[actorId])) continue;
    const skipped = skipTurn(next, actorId);
    if (skipped.ok) next = skipped.state;
  }

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
    let priorityRemaining = priorityAdvantageFor(next, enemyId);
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
      if (isControlled(enemy)) {
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
        const priorityBefore = priorityAdvantageFor(next, enemyId);
        const used = useEnemySkill(next, enemyId, declared.skillId, targetId);
        if (!used.ok) return { ok: false, reason: "intent-desync", state };
        const priorityAfter = priorityAdvantageFor(used.state, enemyId);
        priorityRemaining += Math.max(0, priorityAfter - priorityBefore);

        // Advance from the declaration that was actually honoured. Availability is
        // evaluated after spending it, so a cooling-down Chi Liberation cannot be selected
        // repeatedly inside the newly-created Priority sequence.
        next = advanceEnemyIntent(used.state, enemyId);
        const definition = getSkill(declared.skillId);
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
          [defenderId]: resolved.defender,
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
  }
  // Player and ally wards have now met the entire hostile command window. Leftover points
  // are not banked into another round.
  next = expireWards(next, playerSideIds(next), "enemy-window");

  if (next.phase !== "player") return { ok: true, reason: null, state: next };

  // Boundary ticks: damage-over-time first, then status decay, then cooldowns.
  const playerIds = playerSideIds(next);
  for (const actorId of [...playerIds, ...next.enemyIds]) {
    if (next.actors[actorId].hp <= 0) continue;
    next = boundaryStatusDamage(next, actorId, {
      // Hostile Misfortune already resolved before that side's command. Player-side
      // Misfortune was applied during the hostile window and resolves now, before the next
      // player command.
      includeMisfortune: playerIds.includes(actorId),
    });
  }
  next = settle(next);
  if (next.phase !== "player") return { ok: true, reason: null, state: next };

  const ticked = { ...next.actors };
  for (const actorId of Object.keys(ticked)) {
    ticked[actorId] = { ...ticked[actorId], statuses: tickEndOfTurn(ticked[actorId].statuses) };
  }
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
    actors: ticked,
    round: next.round + 1,
    build: {
      ...next.build,
      skills: next.build.skills.map(tickSkillCooldown),
    },
    allyBuilds: tickedAllyBuilds,
    enemyBuilds: tickedEnemyBuilds,
  };

  // Cadence traits fire before the action count is read, so a Swift proc this round is
  // an extra action this round rather than next. The new round's telegraphs land last, so
  // the player opens their turn already able to read the fight.
  next = declareRoundIntents(withFreshTurn(fireTraits(next)));
  return { ok: true, reason: null, state: settle(next) };
}

/** Uses left across the loadout, for a run-level act refill decision. */
export function loadoutUsesRemaining(state) {
  return state.build.skills.reduce(
    (total, entry) => (entry.usesRemaining === UNLIMITED_USES ? total : total + entry.usesRemaining),
    0,
  );
}

export function createStatuses() {
  return createStatusStack();
}
