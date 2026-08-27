// What zero health actually means.
//
// The encounter knows one thing about a fallen actor: their HP reached zero. Everything the
// world cares about — whether they are a corpse, a prisoner, or someone who will wake with a
// headache and a grudge — is a fact about the fight that was admitted, not about the number.
// Reading death off the number is how a foe the player deliberately spared ended up in the
// codex as dead, unrecoverably, because nothing downstream could tell the difference.
//
// So a terminal encounter produces a receipt with one outcome per participant, and each
// outcome separates two questions that were previously the same question:
//
//   combatState — how they left the fight (standing, incapacitated, yielded, fled, dead)
//   worldFate   — whether they are still alive in the world afterwards
//
// The player's death is the sharpest case. It is authorized at admission, before the first
// blow, by `context.playerStakes` — never inferred afterwards from how bad the loss looked.
// A fight the player entered knowing it could kill them can kill them; a fight they did not
// cannot start killing them because the foe turned out to be stronger than expected.

import { gameplayChecksum } from "../kernel/replay.js";
import { participantIsLethal, sealCombatSession, combatStreamEndpoints } from "./session.js";

export const COMBAT_TERMINAL_RECEIPT_VERSION = 1;

export const COMBAT_COMBAT_STATES = Object.freeze([
  "standing",
  "incapacitated",
  "yielded",
  "fled",
  "captured",
  "dead",
]);

export const COMBAT_WORLD_FATES = Object.freeze(["alive", "dead"]);

/**
 * The event that put an actor down.
 *
 * Scanned backwards off the encounter's own log rather than tallied alongside it, for the
 * same reason proficiency is: a parallel tally is a second source of truth that can drift
 * from the fight it claims to describe.
 */
function lastHarmEvent(encounter, actorId) {
  for (let index = encounter.events.length - 1; index >= 0; index -= 1) {
    const entry = encounter.events[index];
    if (entry.type === "tick-damage" && entry.actorId === actorId) return entry;
    if (entry.type === "skill-damage" && entry.targetId === actorId) return entry;
    // Enemy attacks name who they landed on, which with allies on the field is no longer
    // always the protagonist.
    if (entry.type === "enemy-attack" && entry.targetId === actorId) return entry;
  }
  return null;
}

function outcomeFor(session, actorId) {
  const { encounter, context } = session;
  const actor = encounter.actors[actorId];
  const binding = context.participantBindings[actorId] || {};
  const campaignEntityId = binding.campaignEntityId ?? null;
  const finalStatuses = actor.statuses.map((entry) => ({ type: entry.type, count: entry.count }));
  const isPlayer = actorId === encounter.playerId;
  const isAlly = (encounter.allyIds || []).includes(actorId);

  if (encounter.phase === "retreated" && actor.hp > 0 && (isPlayer || isAlly)) {
    const retreat = [...encounter.events].reverse().find((entry) => entry.type === "retreat-attempt");
    return {
      participantId: actorId,
      campaignEntityId,
      combatState: "fled",
      worldFate: "alive",
      terminalCause: "retreat-attempt",
      finalHp: actor.hp,
      finalStatuses,
      sourceEventId: retreat?.sequence ?? null,
    };
  }

  if (actor.hp > 0) {
    return {
      participantId: actorId,
      campaignEntityId,
      combatState: "standing",
      worldFate: "alive",
      terminalCause: null,
      finalHp: actor.hp,
      finalStatuses,
      sourceEventId: null,
    };
  }

  const harm = lastHarmEvent(encounter, actorId);
  // The player's stakes were set at admission; a foe's lethality can be set per participant,
  // which is what lets one duel inside a brawl be real while the rest is fists.
  //
  // An ally follows the player's stakes rather than the foes' policy. Someone who walked
  // into a fight the player could die in can die in it too; someone who came along to a
  // brawl gets knocked out, the same as the person they came with.
  const lethal = isPlayer || isAlly
    ? context.playerStakes === "lethal"
    : participantIsLethal(context, actorId);

  return {
    participantId: actorId,
    campaignEntityId,
    combatState: lethal ? "dead" : "incapacitated",
    worldFate: lethal ? "dead" : "alive",
    terminalCause: harm ? harm.type : "unknown",
    finalHp: actor.hp,
    finalStatuses,
    sourceEventId: harm ? harm.sequence : null,
  };
}

/**
 * Every participant's fate: the player, then their allies, then the foes.
 *
 * An ally's fate is settled on its own terms, not inherited from how the fight went for the
 * protagonist. A companion can fall in a fight the player wins, and the codex has to record
 * that rather than a victory for everyone who was standing nearby.
 */
export function resolveParticipantOutcomes(session) {
  const ids = [
    session.encounter.playerId,
    ...(session.encounter.allyIds || []),
    ...session.encounter.enemyIds,
  ];
  return ids.map((actorId) => outcomeFor(session, actorId));
}

/**
 * Seal the terminal receipt for a finished fight.
 *
 * Returns null while the fight is still live. The receipt carries every stream's endpoint so
 * a resumed or replayed session can prove it stopped in the same place, and the encounter's
 * checksum so a settlement can prove it is settling the fight it thinks it is.
 */
export function resolveCombatTerminalReceipt(session) {
  const { encounter } = session;
  if (encounter.phase === "player") return null;

  const participants = resolveParticipantOutcomes(session);
  const playerOutcome = participants[0];
  const won = encounter.phase === "victory";
  const retreated = encounter.phase === "retreated";

  return {
    version: COMBAT_TERMINAL_RECEIPT_VERSION,
    sessionId: session.sessionId,
    rulesetId: session.rulesetId,
    reason: encounter.phase,
    winner: retreated ? null : won ? "player" : "enemies",
    loser: retreated ? null : won ? "enemies" : "player",
    rounds: encounter.round,
    eventCount: encounter.sequence,
    // Hoisted so callers do not have to re-derive the one fact that ends a campaign.
    playerWorldFate: playerOutcome.worldFate,
    participants,
    streamEndpoints: combatStreamEndpoints(session),
    encounterChecksum: gameplayChecksum(encounter),
  };
}

/**
 * Attach the terminal receipt to a terminal session.
 *
 * Idempotent: a session that already carries a receipt is returned untouched, so a reload
 * that lands on a finished fight cannot mint a second, differently-timed verdict.
 */
export function sealCombatTerminalReceipt(session) {
  if (session.encounter.phase === "player") {
    return { ok: false, reason: "encounter-not-terminal", session };
  }
  if (session.terminalReceipt) {
    return { ok: true, reason: null, session, duplicate: true };
  }
  // Sealing does not accept a command, so the revision does not move; only the derived
  // verdict is added. Re-stamping the checksum keeps the integrity check honest.
  const session_ = sealCombatSession({
    ...session,
    terminalReceipt: resolveCombatTerminalReceipt(session),
    checksum: null,
  });
  return { ok: true, reason: null, session: session_, duplicate: false };
}

/**
 * The outcome map settlement reads: actor id to world fate.
 *
 * Settlement needs one question answered per foe — is this person dead in the world — and
 * asking it this way means it can never be answered by re-deriving lethality from a flag
 * that was not the flag the fight was admitted under.
 */
export function worldFatesByParticipant(receipt) {
  return Object.fromEntries(
    (receipt?.participants || []).map((outcome) => [outcome.participantId, outcome.worldFate]),
  );
}
