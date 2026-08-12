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
import { getTrait, traitCadenceAtRank, traitValueAtRank } from "./traits.js";

export const TOW_ENCOUNTER_VERSION = 1;
export const MAX_ENCOUNTER_EVENTS = 20_000;

const PHASES = new Set(["player", "victory", "defeat"]);

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
  const definition = getTrait(traitId);
  const { cadence } = definition;
  if (cadence.type === "combat-start") return { fires: round === 1, rng };
  if (cadence.type === "every-turn") return { fires: true, rng };
  if (cadence.type === "every-n-turns") {
    return { fires: round % cadence.turns === 0, rng };
  }
  if (cadence.type === "every-n-turns-span") {
    const scaled = traitCadenceAtRank(traitId, rank);
    return { fires: scaled.turns > 0 && round % scaled.turns === 0, rng };
  }
  if (cadence.type === "every-turn-chance") {
    const scaled = traitCadenceAtRank(traitId, rank);
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
  for (const [traitId, rank] of Object.entries(state.build.traits)) {
    const definition = getTrait(traitId);
    if (!definition) continue;
    const due = traitFiresThisRound(traitId, rank, next.round, rng);
    rng = due.rng;
    if (!due.fires) continue;

    const amount = traitValueAtRank(traitId, rank);
    if (amount <= 0) continue;
    const { kind, status } = definition.effect;

    if (kind === "grant-status") {
      const player = next.actors[next.playerId];
      next = {
        ...next,
        actors: {
          ...next.actors,
          [next.playerId]: { ...player, statuses: applyStatus(player.statuses, status, amount) },
        },
      };
    } else {
      const actors = { ...next.actors };
      for (const enemyId of next.enemyIds) {
        if (actors[enemyId].hp <= 0) continue;
        actors[enemyId] = {
          ...actors[enemyId],
          statuses: applyStatus(actors[enemyId].statuses, status, amount),
        };
      }
      next = { ...next, actors };
    }
    next = push(next, "trait-fired", { traitId, rank, status, amount });
  }
  return { ...next, rng };
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

// How many turn-consuming actions the player gets this round.
//
// Haste "gains additional action during battle". Priority "performs a certain number of
// actions before the enemy; if the enemy has Priority too, they cancel out" — so it is
// the *net* against the enemy line, not a flat bonus, and an enemy with more Priority
// than you simply cancels yours rather than stealing your turn.
export function actionsForRound(state) {
  const player = state.actors[state.playerId];
  const haste = statusCount(player.statuses, "haste");
  const playerPriority = statusCount(player.statuses, "priority");
  const enemyPriority = state.enemyIds.reduce((most, enemyId) => {
    const enemy = state.actors[enemyId];
    if (enemy.hp <= 0) return most;
    return Math.max(most, statusCount(enemy.statuses, "priority"));
  }, 0);
  return 1 + haste + Math.max(0, playerPriority - enemyPriority);
}

function withFreshTurn(state) {
  return { ...state, turn: { actionsRemaining: actionsForRound(state) } };
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
  if (scale === "attack") return actor.stats.attack + statusCount(actor.statuses, "strength")
    + statusCount(actor.statuses, "overload");
  if (scale === "defense") return actor.stats.defense + statusCount(actor.statuses, "tenacity");
  if (scale === "max-hp") return actor.maxHp;
  return 0;
}

export function createTowEncounter({ seed, intentSeed, intentSchedules, player, enemies, build } = {}) {
  if (typeof seed !== "string" && !(typeof seed === "number" && Number.isFinite(seed))) {
    throw new TypeError("invalid-encounter-seed");
  }
  if (!Array.isArray(enemies) || enemies.length < 1) throw new TypeError("invalid-enemies");

  const playerActor = createTowActor({ ...player, side: "player" });
  // An enemy's attack table lives beside the actor rather than on it: the Gatekeeper's
  // six named attacks are encounter content, while the actor stays the strict, validated
  // shape the damage resolver reads.
  const enemyAttacks = {};
  const enemyActors = enemies.map((enemy) => {
    const { attacks, ...actorFields } = enemy;
    const actor = createTowActor({ ...actorFields, side: "enemy" });
    enemyAttacks[actor.id] = (attacks || []).map((attack) => ({
      id: attack.id || "attack",
      name: attack.name || "Attack",
      hits: Number.isSafeInteger(attack.hits) && attack.hits > 0 ? attack.hits : 1,
      damage: Number.isSafeInteger(attack.damage) && attack.damage >= 0
        ? attack.damage
        : actor.stats.attack,
    }));
    return actor;
  });
  const ids = new Set([playerActor.id, ...enemyActors.map((enemy) => enemy.id)]);
  if (ids.size !== enemyActors.length + 1) throw new TypeError("duplicate-actor-id");

  const traits = cloneJsonData(build?.traits || {}, "invalid-build-traits");
  for (const [traitId, rank] of Object.entries(traits)) {
    if (!getTrait(traitId)) throw new TypeError(`unknown-trait:${traitId}`);
    if (!Number.isSafeInteger(rank) || rank < 1 || rank > 7) throw new TypeError("invalid-trait-rank");
  }
  const skills = (build?.skills || []).map((entry) => (
    typeof entry === "string" ? createSkillState(entry) : { ...entry }
  ));

  // Every foe gets a rotation over its own attack table. An authored schedule wins where one
  // is supplied; otherwise the default generator derives one, so an arbitrary bestiary group
  // telegraphs as readably as a named boss.
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
    enemyIds: enemyActors.map((enemy) => enemy.id),
    enemyAttacks,
    intentSchedules: schedules,
    intents: {},
    actors: Object.fromEntries([
      [playerActor.id, playerActor],
      ...enemyActors.map((enemy) => [enemy.id, enemy]),
    ]),
    build: { traits, skills, runes: [...(build?.runes || [])] },
    turn: { actionsRemaining: 1 },
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
    const schedule = state.intentSchedules[enemyId];
    // A foe with no attack table has nothing to telegraph, and a dead one has nothing left
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
      rng,
    });
    rng = declared.rng;
    intents[enemyId] = declared.intent;
    next = push(next, "intent-declared", {
      enemyId,
      attackId: declared.intent.attackId,
      targetId: declared.intent.targetId,
      declarationIndex: declared.intent.declarationIndex,
    });
  }
  return { ...next, intentRng: rng, intents };
}

/** Move one foe's telegraph on to the next step of its rotation. */
function advanceEnemyIntent(state, enemyId) {
  const schedule = state.intentSchedules[enemyId];
  const held = state.intents[enemyId];
  if (!schedule || !held) return state;
  const advanced = advanceTowIntent({
    schedule,
    intent: held,
    targetId: state.playerId,
    rng: state.intentRng,
  });
  const next = push(
    { ...state, intentRng: advanced.rng, intents: { ...state.intents, [enemyId]: advanced.intent } },
    "intent-declared",
    {
      enemyId,
      attackId: advanced.intent.attackId,
      targetId: advanced.intent.targetId,
      declarationIndex: advanced.intent.declarationIndex,
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
      const attack = resolveDeclaredAttack(state.intents[enemyId], state.enemyAttacks[enemyId]);
      if (!attack) return null;
      return {
        enemyId,
        attackId: attack.id,
        name: attack.name,
        hits: attack.hits,
        damage: attack.damage,
        targetId: state.intents[enemyId].targetId,
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
  const actorIds = [value.playerId, ...value.enemyIds];
  if (new Set(actorIds).size !== actorIds.length) return false;
  if (Object.keys(value.actors).length !== actorIds.length) return false;
  return actorIds.every((id) => isTowActor(value.actors[id]));
}

// ---------------------------------------------------------------------------
// Player commands
// ---------------------------------------------------------------------------

function livingEnemies(state) {
  return state.enemyIds.filter((id) => state.actors[id].hp > 0);
}

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
  if (statusCount(actor.statuses, "unstoppable") > 0) return false;
  return statusCount(actor.statuses, "sleep") > 0
    || statusCount(actor.statuses, "paralyze") > 0
    || statusCount(actor.statuses, "stun") > 0;
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
  "damage",
  "heal-lost-fraction",
  "reduce-statuses",
  "scaled-status",
  "scaled-status-enemy-lost-hp",
  "shield",
  "status",
]);

function applySkillEffects(state, skillId, rank, targetId) {
  const definition = getSkill(skillId);
  let next = state;
  const playerId = next.playerId;

  definition.effects.forEach((effect, index) => {
    // Asked for per branch rather than up front: not every effect carries a rank table, and
    // demanding one from an effect that has none crashed the whole skill — which is how
    // First Aid, a skill three professions ship with, threw the moment it was used.
    const magnitude = () => effectMagnitude(skillId, index, rank);
    const player = next.actors[playerId];

    if (effect.type === "damage") {
      const target = next.actors[targetId];
      if (!target || target.hp <= 0) return;
      const amount = Math.floor((statOf(player, effect.scale) * magnitude()) / 100);
      const hit = resolveAttack({
        attacker: player,
        defender: target,
        attack: { hits: 1, damage: amount },
        rng: next.rng,
      });
      next = {
        ...next,
        rng: hit.rng,
        actors: { ...next.actors, [playerId]: hit.attacker, [targetId]: hit.defender },
      };
      next = push(next, "skill-damage", { skillId, targetId, amount, hits: hit.hits });
      return;
    }

    if (effect.type === "shield") {
      const amount = Math.floor((statOf(player, effect.scale) * magnitude()) / 100);
      next = {
        ...next,
        actors: { ...next.actors, [playerId]: { ...player, shield: player.shield + amount } },
      };
      next = push(next, "skill-shield", { skillId, amount });
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
      next = push(next, "skill-heal", { skillId, amount });
      return;
    }

    // Cleaning a wound: bleed, burn and poison are scaled down rather than decremented, so
    // it bites harder on a heavy stack than a light one.
    if (effect.type === "reduce-statuses") {
      const before = player.statuses;
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
        actors: { ...next.actors, [playerId]: { ...player, statuses: cleaned } },
      };
      next = push(next, "skill-cleanse", { skillId, statuses: [...effect.statuses], removed });
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
        skillId,
        status: effect.status,
        target: effect.target,
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
        next = {
          ...next,
          actors: {
            ...next.actors,
            [playerId]: { ...player, statuses: applyStatus(player.statuses, effect.status, count) },
          },
        };
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
        skillId,
        status: effect.status,
        target: effect.target,
        count,
      });
    }
  });

  return next;
}

/**
 * Use one of the player's skills. Turn-free skills leave the primary action open.
 */
export function useSkill(state, skillId, targetId = null) {
  if (state.phase !== "player") return { ok: false, reason: "encounter-over", state };
  const player = state.actors[state.playerId];
  if (isControlled(player)) return { ok: false, reason: "action-nullified", state };

  const index = state.build.skills.findIndex((entry) => entry.id === skillId);
  if (index < 0) return { ok: false, reason: "skill-not-held", state };
  const skillState = state.build.skills[index];
  const legality = skillLegality(skillState, { turnAvailable: state.turn.actionsRemaining > 0 });
  if (!legality.ok) return { ok: false, reason: legality.reason, state };

  const definition = getSkill(skillId);
  const target = targetId || livingEnemies(state)[0];
  if (definition.effects.some((effect) => effect.target === "enemy") && !target) {
    return { ok: false, reason: "no-target", state };
  }

  const spent = spendSkill(skillState);
  if (!spent.ok) return { ok: false, reason: spent.reason, state };

  let next = {
    ...state,
    build: {
      ...state.build,
      skills: state.build.skills.map((entry, at) => (at === index ? spent.state : entry)),
    },
    turn: {
      ...state.turn,
      actionsRemaining: definition.consumesTurn
        ? Math.max(0, state.turn.actionsRemaining - 1)
        : state.turn.actionsRemaining,
    },
  };
  next = applySkillEffects(next, skillId, skillState.rank, target);
  return { ok: true, reason: null, state: settle(next) };
}

// ---------------------------------------------------------------------------
// Ending the turn
// ---------------------------------------------------------------------------

function burnAndDoom(state, actorId) {
  const actor = state.actors[actorId];
  const burn = statusCount(actor.statuses, "burn");
  const doom = statusCount(actor.statuses, "doom");
  const total = burn + doom;
  if (total <= 0) return state;
  // Both bypass defences outright.
  const damaged = { ...actor, hp: Math.max(0, actor.hp - total) };
  return push(
    { ...state, actors: { ...state.actors, [actorId]: damaged } },
    "tick-damage",
    { actorId, burn, doom },
  );
}

/**
 * End the player's turn: every living enemy acts, then boundary statuses tick, then the
 * round advances and cadence traits fire.
 */
export function endTurn(state) {
  if (state.phase !== "player") return { ok: false, reason: "encounter-over", state };

  // Every living foe's declaration is checked against its own attack table before a single
  // blow lands. A telegraph the engine cannot honour means the recorded fight and the fight
  // being played have come apart, and continuing would hide that at exactly the point it
  // matters. Checking up front also means the refusal costs nothing: nothing has moved yet.
  for (const enemyId of state.enemyIds) {
    const enemy = state.actors[enemyId];
    if (enemy.hp <= 0 || !state.intents[enemyId]) continue;
    if (!resolveDeclaredAttack(state.intents[enemyId], state.enemyAttacks[enemyId] || [])) {
      return { ok: false, reason: "intent-desync", state };
    }
  }

  let next = state;

  for (const enemyId of next.enemyIds) {
    if (next.phase !== "player") break;
    const enemy = next.actors[enemyId];
    if (enemy.hp <= 0) continue;
    if (isControlled(enemy)) {
      // The intent is held, not spent: the blow it was winding up still lands, one round
      // later. See INTENT_CONTROL_POLICY — control buys tempo rather than erasing the
      // attack the player was shown.
      next = push(next, "enemy-nullified", { enemyId });
      continue;
    }
    // The foe swings what it declared. Which attack that is was decided at the start of the
    // round, off the intent stream, and shown to the player before they spent their turn.
    const table = next.enemyAttacks?.[enemyId] || [];
    const declared = next.intents[enemyId]
      ? resolveDeclaredAttack(next.intents[enemyId], table)
      : null;
    const attack = declared
      ?? { id: "basic", name: "Attack", hits: 1, damage: enemy.stats.attack };
    const resolved = resolveAttack({
      attacker: enemy,
      defender: next.actors[next.playerId],
      attack: { hits: attack.hits, damage: attack.damage },
      rng: next.rng,
    });
    next = {
      ...next,
      rng: resolved.rng,
      actors: {
        ...next.actors,
        [enemyId]: resolved.attacker,
        [next.playerId]: resolved.defender,
      },
    };
    next = push(next, "enemy-attack", { enemyId, attackId: attack.id, hits: resolved.hits });
    // Spent, so the next declaration is a new one. A foe that died mid-round drops its
    // telegraph in the round-start pass rather than declaring from the grave.
    if (declared) next = advanceEnemyIntent(next, enemyId);
    next = settle(next);
  }

  if (next.phase !== "player") return { ok: true, reason: null, state: next };

  // Boundary ticks: damage-over-time first, then status decay, then cooldowns.
  for (const actorId of [next.playerId, ...next.enemyIds]) {
    if (next.actors[actorId].hp <= 0) continue;
    next = burnAndDoom(next, actorId);
  }
  next = settle(next);
  if (next.phase !== "player") return { ok: true, reason: null, state: next };

  const ticked = { ...next.actors };
  for (const actorId of Object.keys(ticked)) {
    ticked[actorId] = { ...ticked[actorId], statuses: tickEndOfTurn(ticked[actorId].statuses) };
  }
  next = {
    ...next,
    actors: ticked,
    round: next.round + 1,
    build: {
      ...next.build,
      skills: next.build.skills.map(tickSkillCooldown),
    },
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
