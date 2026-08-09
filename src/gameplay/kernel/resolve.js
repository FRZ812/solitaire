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
  target.hp = Math.max(0, Math.min(target.maxHp, before - Math.max(0, amount)));
  emit(state, events, {
    type: "damage-resolved",
    sourceId,
    targetId,
    ...(actionId ? { actionId } : {}),
    ...(intentId ? { intentId } : {}),
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
  if (!actor.actions.includes(command.actionId) || !getReferenceAction(command.actionId)) return "unknown-action";
  const target = state.actors[command.targetId];
  if (!target || target.side === actor.side || target.hp <= 0) return "invalid-target";
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

  const variance = action.effect.variance;
  const base = actor.stats[action.effect.stat] * action.effect.multiplier;
  const amount = rollDamage(next, base + variance.min, base + variance.max);
  applyDamage(next, events, {
    sourceId: actor.id,
    targetId: target.id,
    actionId: action.id,
    amount,
  });

  if (target.hp <= 0) {
    next.phase = "victory";
    emit(next, events, { type: "encounter-ended", outcome: "victory" });
    return { ok: true, state: next, events };
  }

  next.phase = "enemy";
  const enemy = target;
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
