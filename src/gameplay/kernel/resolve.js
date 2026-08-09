import { nextInt } from "./rng.js";
import { getReferenceAction } from "../reference/actions.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const rejected = (state, reason) => ({ ok: false, reason, state, events: [] });

function emit(state, events, event) {
  const record = {
    sequence: state.sequence + 1,
    round: state.round,
    ...event,
  };
  state.sequence = record.sequence;
  state.events.push(record);
  events.push(record);
  return record;
}

function rollDamage(state, min, max) {
  const rolled = nextInt(state.rng, Math.max(0, Math.floor(min)), Math.max(0, Math.floor(max)));
  state.rng = rolled.rng;
  return rolled.value;
}

function applyDamage(state, events, { sourceId, targetId, actionId = null, intentId = null, amount }) {
  const target = state.actors[targetId];
  const before = target.hp;
  const rawAmount = Math.max(0, amount);
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
}

function validate(state, command) {
  if (command?.type !== "use-action") return "invalid-command";
  if (state.phase !== "player") return "not-player-phase";
  if (command.actorId !== state.playerId) return "invalid-actor";
  const actor = state.actors[command.actorId];
  if (!actor || actor.hp <= 0) return "invalid-actor";
  const action = actor.actions.includes(command.actionId) ? getReferenceAction(command.actionId) : null;
  if (!action) return "unknown-action";
  const target = state.actors[command.targetId];
  if (!target || target.hp <= 0) return "invalid-target";
  if (action.target === "self" && target.id !== actor.id) return "invalid-target";
  if (action.target === "enemy" && target.side === actor.side) return "invalid-target";
  return null;
}

export function resolveCommand(state, command) {
  const reason = validate(state, command);
  if (reason) return rejected(state, reason);

  const next = clone(state);
  const events = [];
  const actor = next.actors[command.actorId];
  const target = next.actors[command.targetId];
  const action = getReferenceAction(command.actionId);

  emit(next, events, {
    type: "action-used",
    actorId: actor.id,
    actionId: action.id,
    targetId: target.id,
    consumesTurn: action.consumesTurn,
  });

  if (action.effect.type === "damage") {
    const variance = action.effect.variance;
    const base = actor.stats[action.effect.stat] * action.effect.multiplier;
    const amount = rollDamage(next, base + variance.min, base + variance.max);
    applyDamage(next, events, {
      sourceId: actor.id,
      targetId: target.id,
      actionId: action.id,
      amount,
    });
  } else if (action.effect.type === "defend") {
    const before = actor.guard;
    const amount = action.effect.base + actor.stats[action.effect.stat] * action.effect.multiplier;
    actor.guard += amount;
    emit(next, events, {
      type: "defense-gained",
      actorId: actor.id,
      actionId: action.id,
      amount,
      before,
      after: actor.guard,
    });
  }

  const livingEnemies = next.enemyIds
    .map((enemyId) => next.actors[enemyId])
    .filter((enemyActor) => enemyActor.hp > 0);
  if (livingEnemies.length === 0) {
    next.phase = "victory";
    emit(next, events, { type: "encounter-ended", outcome: "victory" });
    return { ok: true, state: next, events };
  }

  next.phase = "enemy";
  const enemy = livingEnemies[0];
  const intent = enemy.intent;
  emit(next, events, {
    type: "intent-resolved",
    actorId: enemy.id,
    intentId: intent.id,
    targetId: intent.targetId,
  });
  const enemyAmount = rollDamage(next, intent.damage.min, intent.damage.max);
  applyDamage(next, events, {
    sourceId: enemy.id,
    targetId: intent.targetId,
    intentId: intent.id,
    amount: enemyAmount,
  });

  const player = next.actors[next.playerId];
  if (player.guard > 0) {
    const amount = player.guard;
    player.guard = 0;
    emit(next, events, {
      type: "defense-expired",
      actorId: player.id,
      amount,
      reason: "enemy-intent-resolved",
    });
  }
  if (player.hp <= 0) {
    next.phase = "defeat";
    emit(next, events, { type: "encounter-ended", outcome: "defeat" });
    return { ok: true, state: next, events };
  }

  next.round += 1;
  next.phase = "player";
  emit(next, events, {
    type: "intent-declared",
    actorId: enemy.id,
    intentId: intent.id,
    targetId: intent.targetId,
    intent: clone(intent),
  });
  return { ok: true, state: next, events };
}
