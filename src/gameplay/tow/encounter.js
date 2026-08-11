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
  applyStatus,
  createStatusStack,
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

function statOf(actor, scale) {
  if (scale === "attack") return actor.stats.attack + statusCount(actor.statuses, "strength")
    + statusCount(actor.statuses, "overload");
  if (scale === "defense") return actor.stats.defense + statusCount(actor.statuses, "tenacity");
  if (scale === "max-hp") return actor.maxHp;
  return 0;
}

export function createTowEncounter({ seed, player, enemies, build } = {}) {
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

  const base = {
    version: TOW_ENCOUNTER_VERSION,
    phase: "player",
    round: 1,
    sequence: 0,
    rng: createRng(seed),
    playerId: playerActor.id,
    enemyIds: enemyActors.map((enemy) => enemy.id),
    enemyAttacks,
    actors: Object.fromEntries([
      [playerActor.id, playerActor],
      ...enemyActors.map((enemy) => [enemy.id, enemy]),
    ]),
    build: { traits, skills, runes: [...(build?.runes || [])] },
    turn: { actionSpent: false },
    events: [],
  };

  // Combat-start traits land before the first player command, which is what makes
  // Intangible's 7 Invincible or Inferno's 80 Burn an opening rather than a turn-one play.
  return fireTraits(base);
}

export function isTowEncounter(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (value.version !== TOW_ENCOUNTER_VERSION) return false;
  if (!PHASES.has(value.phase)) return false;
  if (!Number.isSafeInteger(value.round) || value.round < 1) return false;
  if (!Array.isArray(value.enemyIds) || value.enemyIds.length < 1) return false;
  if (!Array.isArray(value.events) || value.events.length !== value.sequence) return false;
  if (value.events.length > MAX_ENCOUNTER_EVENTS) return false;
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

function applySkillEffects(state, skillId, rank, targetId) {
  const definition = getSkill(skillId);
  let next = state;
  const playerId = next.playerId;

  definition.effects.forEach((effect, index) => {
    const magnitude = effectMagnitude(skillId, index, rank);
    const player = next.actors[playerId];

    if (effect.type === "damage") {
      const target = next.actors[targetId];
      if (!target || target.hp <= 0) return;
      const amount = Math.floor((statOf(player, effect.scale) * magnitude) / 100);
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
      const amount = Math.floor((statOf(player, effect.scale) * magnitude) / 100);
      next = {
        ...next,
        actors: { ...next.actors, [playerId]: { ...player, shield: player.shield + amount } },
      };
      next = push(next, "skill-shield", { skillId, amount });
      return;
    }

    if (effect.type === "status" || effect.type === "scaled-status") {
      const count = effect.type === "status"
        ? magnitude
        : Math.floor((statOf(player, effect.scale) * magnitude) / 100);
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
  const legality = skillLegality(skillState, { turnAvailable: !state.turn.actionSpent });
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
      actionSpent: state.turn.actionSpent || definition.consumesTurn,
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
  let next = state;

  for (const enemyId of next.enemyIds) {
    if (next.phase !== "player") break;
    const enemy = next.actors[enemyId];
    if (enemy.hp <= 0) continue;
    if (isControlled(enemy)) {
      next = push(next, "enemy-nullified", { enemyId });
      continue;
    }
    // Which of an enemy's attacks it chooses is not established by the evidence, so the
    // pick is a seeded uniform draw and lives here as one obvious provisional decision
    // rather than being spread through the loop.
    const table = next.enemyAttacks?.[enemyId] || [];
    let attack = { id: "basic", name: "Attack", hits: 1, damage: enemy.stats.attack };
    let chooseRng = next.rng;
    if (table.length > 0) {
      const pick = nextInt(chooseRng, 0, table.length - 1);
      chooseRng = pick.rng;
      attack = table[pick.value];
    }
    const resolved = resolveAttack({
      attacker: enemy,
      defender: next.actors[next.playerId],
      attack: { hits: attack.hits, damage: attack.damage },
      rng: chooseRng,
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
    turn: { actionSpent: false },
    build: {
      ...next.build,
      skills: next.build.skills.map(tickSkillCooldown),
    },
  };

  next = fireTraits(next);
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
