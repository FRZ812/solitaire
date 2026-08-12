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
import { participantIsLethal, sealTowSession, towStreamEndpoints } from "./session.js";

export const TOW_TERMINAL_RECEIPT_VERSION = 1;

export const TOW_COMBAT_STATES = Object.freeze([
  "standing",
  "incapacitated",
  "yielded",
  "fled",
  "captured",
  "dead",
]);

export const TOW_WORLD_FATES = Object.freeze(["alive", "dead"]);

/**
 * The event that put an actor down.
 *
 * Scanned backwards off the encounter's own log rather than tallied alongside it, for the
 * same reason proficiency is: a parallel tally is a second source of truth that can drift
 * from the fight it claims to describe.
 */
function lastHarmEvent(encounter, actorId) {
  const isPlayer = actorId === encounter.playerId;
  for (let index = encounter.events.length - 1; index >= 0; index -= 1) {
    const entry = encounter.events[index];
    if (entry.type === "tick-damage" && entry.actorId === actorId) return entry;
    if (entry.type === "skill-damage" && entry.targetId === actorId) return entry;
    // Enemy attacks name their attacker, not their target; in a fight with one commanding
    // actor the target is always the player.
    if (entry.type === "enemy-attack" && isPlayer) return entry;
  }
  return null;
}

function outcomeFor(session, actorId) {
  const { encounter, context } = session;
  const actor = encounter.actors[actorId];
  const binding = context.participantBindings[actorId] || {};
  const campaignEntityId = binding.campaignEntityId ?? null;
  const finalStatuses = actor.statuses.map((entry) => ({ type: entry.type, count: entry.count }));

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
  const isPlayer = actorId === encounter.playerId;
  // The player's stakes were set at admission; a foe's lethality can be set per participant,
  // which is what lets one duel inside a brawl be real while the rest is fists.
  const lethal = isPlayer
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

/** Every participant's fate, player first, then foes in their encounter order. */
export function resolveParticipantOutcomes(session) {
  const ids = [session.encounter.playerId, ...session.encounter.enemyIds];
  return ids.map((actorId) => outcomeFor(session, actorId));
}

/**
 * Seal the terminal receipt for a finished fight.
 *
 * Returns null while the fight is still live. The receipt carries every stream's endpoint so
 * a resumed or replayed session can prove it stopped in the same place, and the encounter's
 * checksum so a settlement can prove it is settling the fight it thinks it is.
 */
export function resolveTowTerminalReceipt(session) {
  const { encounter } = session;
  if (encounter.phase === "player") return null;

  const participants = resolveParticipantOutcomes(session);
  const playerOutcome = participants[0];
  const won = encounter.phase === "victory";

  return {
    version: TOW_TERMINAL_RECEIPT_VERSION,
    sessionId: session.sessionId,
    rulesetId: session.rulesetId,
    reason: encounter.phase,
    winner: won ? "player" : "enemies",
    loser: won ? "enemies" : "player",
    rounds: encounter.round,
    eventCount: encounter.sequence,
    // Hoisted so callers do not have to re-derive the one fact that ends a campaign.
    playerWorldFate: playerOutcome.worldFate,
    participants,
    streamEndpoints: towStreamEndpoints(session),
    encounterChecksum: gameplayChecksum(encounter),
  };
}

/**
 * Attach the terminal receipt to a terminal session.
 *
 * Idempotent: a session that already carries a receipt is returned untouched, so a reload
 * that lands on a finished fight cannot mint a second, differently-timed verdict.
 */
export function sealTowTerminalReceipt(session) {
  if (session.encounter.phase === "player") {
    return { ok: false, reason: "encounter-not-terminal", session };
  }
  if (session.terminalReceipt) {
    return { ok: true, reason: null, session, duplicate: true };
  }
  // Sealing does not accept a command, so the revision does not move; only the derived
  // verdict is added. Re-stamping the checksum keeps the integrity check honest.
  const session_ = sealTowSession({
    ...session,
    terminalReceipt: resolveTowTerminalReceipt(session),
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
