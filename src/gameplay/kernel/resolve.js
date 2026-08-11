import { cloneJsonData } from "./json-data.js";
import { advanceIntent, encounterIntentFromState } from "./intent.js";
import { getEncounterAction, isEncounterState, MAX_ENCOUNTER_EVENTS } from "./model.js";
import { nextInt } from "./rng.js";
import { applyStatus, hasStatus, removeStatus } from "./statuses.js";
import { getReferenceSkill } from "../reference/skills.js";

const clone = (value) => cloneJsonData(value);
const rejected = (state, reason) => ({ ok: false, reason, state, events: [] });
const MAX_EVENTS_PER_COMMAND = 12;

function actorById(state, actorId) {
  return typeof actorId === "string" && Object.hasOwn(state.actors, actorId)
    ? state.actors[actorId]
    : null;
}

function emit(state, events, event) {
  const record = {
    sequence: state.sequence + 1,
    round: state.round,
    ...event,
  };
  state.sequence = record.sequence;
  state.events.push(clone(record));
  events.push(record);
  return record;
}

function rollDamage(state, min, max) {
  const rolled = nextInt(state.rng, Math.max(0, Math.floor(min)), Math.max(0, Math.floor(max)));
  state.rng = rolled.rng;
  return rolled.value;
}

function emitStatusRemoved(state, events, actorId, status, reason) {
  emit(state, events, {
    type: "status-removed",
    actorId,
    status: status.type,
    reason,
  });
}

function applyDamage(state, events, { sourceId, targetId, actionId = null, intentId = null, amount }) {
  const target = state.actors[targetId];
  const rawAmount = Math.max(0, amount);
  const evasion = removeStatus(target, "evasion");
  if (evasion) {
    emit(state, events, {
      type: "damage-avoided",
      sourceId,
      targetId,
      ...(actionId ? { actionId } : {}),
      ...(intentId ? { intentId } : {}),
      rawAmount,
      reason: "evasion",
    });
    emitStatusRemoved(state, events, targetId, evasion, "triggered");
    return;
  }

  const before = target.hp;
  const guardSpent = Math.min(target.guard || 0, rawAmount);
  target.guard = Math.max(0, (target.guard || 0) - guardSpent);
  target.hp = Math.max(0, Math.min(target.maxHp, before - (rawAmount - guardSpent)));
  emit(state, events, {
    type: "damage-resolved",
    sourceId,
    targetId,
    ...(actionId ? { actionId } : {}),
    ...(intentId ? { intentId } : {}),
    rawAmount,
    guardSpent,
    amount: before - target.hp,
    before,
    after: target.hp,
  });

  const sleep = before > target.hp ? removeStatus(target, "sleep") : null;
  if (sleep) emitStatusRemoved(state, events, targetId, sleep, "damaged");
}

function targetReason(definition, actor, target) {
  if (!target || target.hp <= 0) return "invalid-target";
  if (definition.target === "self" && target.id !== actor.id) return "invalid-target";
  if (definition.target === "enemy" && target.side === actor.side) return "invalid-target";
  return null;
}

function validate(state, command) {
  if (!command || !["use-action", "use-skill"].includes(command.type)) return "invalid-command";
  if (state.phase !== "player") return "not-player-phase";
  if (command.actorId !== state.playerId) return "invalid-actor";
  const actor = actorById(state, command.actorId);
  if (!actor || actor.hp <= 0) return "invalid-actor";

  if (command.type === "use-action") {
    const action = actor.actions.includes(command.actionId)
      ? getEncounterAction(state, command.actionId)
      : null;
    if (!action) return "unknown-action";
    return targetReason(action, actor, actorById(state, command.targetId));
  }

  const skillState = (actor.skills || []).find((entry) => entry.id === command.skillId);
  const skill = skillState ? getReferenceSkill(command.skillId) : null;
  if (!skill) return "unknown-skill";
  if (skillState.cooldownRemaining > 0) return "skill-on-cooldown";
  if (skillState.usesRemaining === 0) return "skill-uses-exhausted";
  return targetReason(skill, actor, actorById(state, command.targetId));
}

function resolveAction(state, events, command) {
  const actor = state.actors[command.actorId];
  const target = state.actors[command.targetId];
  const action = getEncounterAction(state, command.actionId);

  emit(state, events, {
    type: "action-used",
    actorId: actor.id,
    actionId: action.id,
    targetId: target.id,
    consumesTurn: action.consumesTurn,
  });

  if (action.effect.type === "damage") {
    const variance = action.effect.variance;
    const base = actor.stats[action.effect.stat] * action.effect.multiplier;
    const rolled = rollDamage(state, base + variance.min, base + variance.max);
    const mitigation = action.effect.mitigationStat
      ? Math.max(0, target.stats[action.effect.mitigationStat] || 0)
      : 0;
    const amount = rolled > 0 ? Math.max(1, rolled - mitigation) : 0;
    applyDamage(state, events, {
      sourceId: actor.id,
      targetId: target.id,
      actionId: action.id,
      amount,
    });
  } else if (action.effect.type === "defend") {
    const before = actor.guard;
    const amount = action.effect.base + actor.stats[action.effect.stat] * action.effect.multiplier;
    actor.guard += amount;
    emit(state, events, {
      type: "defense-gained",
      actorId: actor.id,
      actionId: action.id,
      amount,
      before,
      after: actor.guard,
    });
  }
  return action.consumesTurn;
}

function resolveSkill(state, events, command) {
  const actor = state.actors[command.actorId];
  const target = state.actors[command.targetId];
  const skill = getReferenceSkill(command.skillId);
  const skillState = actor.skills.find((entry) => entry.id === skill.id);

  emit(state, events, {
    type: "skill-used",
    actorId: actor.id,
    skillId: skill.id,
    targetId: target.id,
    consumesTurn: skill.consumesTurn,
  });

  if (skillState.usesRemaining != null) {
    const before = skillState.usesRemaining;
    skillState.usesRemaining = Math.max(0, before - 1);
    emit(state, events, {
      type: "skill-use-spent",
      actorId: actor.id,
      skillId: skill.id,
      before,
      after: skillState.usesRemaining,
    });
  }

  if (skill.cooldown > 0) {
    skillState.cooldownRemaining = skill.cooldown;
    skillState.cooldownSetRound = state.round;
    emit(state, events, {
      type: "cooldown-set",
      actorId: actor.id,
      skillId: skill.id,
      amount: skill.cooldown,
    });
  }

  if (skill.effect.type === "apply-status") {
    const result = applyStatus(target, skill.effect.status);
    if (result.applied) {
      emit(state, events, {
        type: "status-applied",
        actorId: target.id,
        sourceId: actor.id,
        skillId: skill.id,
        status: result.status.type,
        duration: result.status.duration,
      });
    } else {
      emit(state, events, {
        type: "status-blocked",
        actorId: target.id,
        sourceId: actor.id,
        skillId: skill.id,
        status: skill.effect.status.type,
        reason: result.reason,
      });
    }
  }
  return skill.consumesTurn;
}

function tickCooldowns(state, events, actionRound) {
  const player = state.actors[state.playerId];
  for (const skill of player.skills || []) {
    if (skill.cooldownRemaining <= 0 || skill.cooldownSetRound >= actionRound) continue;
    const before = skill.cooldownRemaining;
    skill.cooldownRemaining = Math.max(0, before - 1);
    emit(state, events, {
      type: "cooldown-ticked",
      actorId: player.id,
      skillId: skill.id,
      before,
      after: skill.cooldownRemaining,
    });
  }
}

function resolveEnemyTurn(state, events) {
  const livingEnemies = state.enemyIds
    .map((enemyId) => state.actors[enemyId])
    .filter((enemy) => enemy.hp > 0);
  if (livingEnemies.length === 0) {
    for (const enemyId of state.enemyIds) {
      const enemy = state.actors[enemyId];
      if (enemy.intent) {
        emit(state, events, {
          type: "intent-cancelled",
          actorId: enemy.id,
          intentId: enemy.intent.id,
          targetId: enemy.intent.targetId,
          reason: "enemy-defeated",
        });
      }
      enemy.intent = null;
      enemy.intentState = null;
    }
    state.phase = "victory";
    emit(state, events, { type: "encounter-ended", outcome: "victory" });
    return;
  }

  const actionRound = state.round;
  state.phase = "enemy";
  const enemy = livingEnemies[0];
  const intent = enemy.intent;
  const intentState = enemy.intentState;
  if (hasStatus(enemy, "sleep")) {
    emit(state, events, {
      type: "intent-skipped",
      actorId: enemy.id,
      intentId: intent.id,
      targetId: intent.targetId,
      reason: "sleep",
    });
  } else {
    emit(state, events, {
      type: "intent-resolved",
      actorId: enemy.id,
      intentId: intent.id,
      targetId: intent.targetId,
    });
    const enemyAmount = rollDamage(state, intent.damage.min, intent.damage.max);
    applyDamage(state, events, {
      sourceId: enemy.id,
      targetId: intent.targetId,
      intentId: intent.id,
      amount: enemyAmount,
    });
  }

  emit(state, events, {
    type: "intent-consumed",
    actorId: enemy.id,
    intentId: intent.id,
    targetId: intent.targetId,
  });
  enemy.intent = null;
  enemy.intentState = null;

  const player = state.actors[state.playerId];
  if (player.guard > 0) {
    const amount = player.guard;
    player.guard = 0;
    emit(state, events, {
      type: "defense-expired",
      actorId: player.id,
      amount,
      reason: "enemy-intent-resolved",
    });
  }
  if (player.hp <= 0) {
    state.phase = "defeat";
    emit(state, events, { type: "encounter-ended", outcome: "defeat" });
    return;
  }

  tickCooldowns(state, events, actionRound);
  if (intentState) {
    const advanced = advanceIntent(intentState);
    if (!advanced.ok) throw new TypeError(advanced.reason);
    enemy.intentState = clone(advanced.state);
    enemy.intent = clone(encounterIntentFromState(advanced.state, state.playerId));
  } else {
    enemy.intent = clone(intent);
  }
  state.round += 1;
  state.phase = "player";
  emit(state, events, {
    type: "intent-declared",
    actorId: enemy.id,
    intentId: enemy.intent.id,
    targetId: enemy.intent.targetId,
    intent: clone(enemy.intent),
  });
}

function resolveCommandInternal(state, command, mutateForReplay = false) {
  let next;
  if (mutateForReplay) {
    next = state;
  } else {
    try {
      next = cloneJsonData(state, "invalid-encounter-state");
    } catch {
      return rejected(null, "invalid-encounter-state");
    }
    if (!isEncounterState(next)) return rejected(null, "invalid-encounter-state");
  }

  let request;
  try {
    request = cloneJsonData(command, "invalid-command");
  } catch {
    return rejected(next, "invalid-command");
  }
  const reason = validate(next, request);
  if (reason) return rejected(next, reason);
  if (next.events.length > MAX_ENCOUNTER_EVENTS - MAX_EVENTS_PER_COMMAND) {
    return rejected(next, "encounter-event-limit-exceeded");
  }

  const prior = mutateForReplay ? null : clone(next);
  const events = [];
  try {
    const consumesTurn = request.type === "use-action"
      ? resolveAction(next, events, request)
      : resolveSkill(next, events, request);
    if (consumesTurn) resolveEnemyTurn(next, events);
  } catch (error) {
    const reason = error instanceof TypeError
      && error.message === "intent-declaration-limit-exceeded"
      ? error.message
      : "invalid-encounter-transition";
    return rejected(prior, reason);
  }
  if (!mutateForReplay && !isEncounterState(next)) {
    return rejected(prior, "invalid-encounter-transition");
  }
  return { ok: true, state: next, events };
}

export function resolveCommand(state, command) {
  return resolveCommandInternal(state, command);
}

// Replay owns one isolated clone for the entire command sequence. The mutable
// single-command path never crosses the module boundary, and any rejection
// discards all partial HP, event, cooldown, round, RNG, and intent changes.
export function replayCommandSequence(state, commands) {
  let next;
  let requests;
  try {
    next = cloneJsonData(state, "invalid-encounter-state");
    requests = cloneJsonData(commands, "invalid-command-sequence");
  } catch {
    return { ok: false, reason: "invalid-command-sequence", state: null, steps: [] };
  }
  if (!isEncounterState(next) || !Array.isArray(requests)) {
    return { ok: false, reason: "invalid-command-sequence", state: null, steps: [] };
  }

  const steps = [];
  for (const request of requests) {
    const resolution = resolveCommandInternal(next, request, true);
    if (!resolution.ok) {
      return { ok: false, reason: resolution.reason, state: null, steps: [] };
    }
    const player = next.actors[next.playerId];
    steps.push({
      events: cloneJsonData(resolution.events),
      phase: next.phase,
      player: { hp: player.hp, maxHp: player.maxHp },
    });
  }
  if (!isEncounterState(next)) {
    return { ok: false, reason: "invalid-encounter-transition", state: null, steps: [] };
  }
  return { ok: true, reason: null, state: next, steps };
}
