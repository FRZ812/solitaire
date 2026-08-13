// The report the narrator was already being told to obey.
//
// The aftermath prompt has always said "narrate STRICTLY from the [COMBAT REPORT] — name the
// actual foes and their exact fates". No such report was ever built. So the model was
// instructed to be faithful to a document that did not exist, which left it inventing the
// very facts it was told to reproduce: who fell, who yielded, who was merely knocked down.
//
// This is that document. It is derived from the terminal receipt after the fight is decided,
// it contains only what the engine actually recorded, and it renders to a compact text block
// that goes into the prompt. Prose can now be checked against it, and — more importantly —
// the player can be shown it whether or not any narration ever arrives.
//
// Two rules shape what goes in. Damage is what actually landed after shields and mitigation,
// not what a skill nominally claims, because the difference between those two numbers is
// exactly the part of a fight worth describing. And nothing that has not happened yet is in
// here: no upcoming intent, no unspent randomness. A report that leaks the next round would
// let prose foreshadow a blow the player has not seen.

import { gameplayChecksum } from "../kernel/replay.js";

export const TOW_CHRONICLE_VERSION = 1;

/** How many blows the report names before it stops listing and starts summarising. */
export const MAX_DECISIVE_EVENTS = 12;

function actorName(encounter, actorId) {
  return encounter.actors[actorId]?.name ?? actorId;
}

function landed(hits) {
  if (!Array.isArray(hits)) return { damage: 0, dodged: 0, critical: 0, absorbed: 0 };
  return hits.reduce((total, hit) => ({
    // `toHp` is what reached health after shields; `damage` is what was swung. The gap
    // between them is the shield doing its job, and it is worth reporting as such.
    damage: total.damage + (Number.isFinite(hit.toHp) ? hit.toHp : 0),
    dodged: total.dodged + (hit.dodged ? 1 : 0),
    critical: total.critical + (hit.critical ? 1 : 0),
    absorbed: total.absorbed + (Number.isFinite(hit.absorbed) ? hit.absorbed : 0),
  }), { damage: 0, dodged: 0, critical: 0, absorbed: 0 });
}

/**
 * The blows worth naming.
 *
 * Every exchange in a twenty-round fight is noise; what a reader needs is who hit whom for
 * how much, and which of those actually decided something. Kills and the heaviest blows are
 * kept, in event order, so the narrative shape of the fight survives the trim.
 */
function decisiveEvents(encounter) {
  const scored = [];
  for (const entry of encounter.events) {
    if (entry.type === "skill-damage") {
      const hit = landed(entry.hits);
      scored.push({
        sequence: entry.sequence,
        round: entry.round,
        kind: "strike",
        actorId: entry.actorId ?? encounter.playerId,
        actor: actorName(encounter, entry.actorId ?? encounter.playerId),
        targetId: entry.targetId,
        target: actorName(encounter, entry.targetId),
        action: entry.skillId,
        damage: hit.damage,
        absorbed: hit.absorbed,
        critical: hit.critical > 0,
        dodged: hit.dodged === (entry.hits?.length || 0) && hit.dodged > 0,
      });
      continue;
    }
    if (entry.type === "enemy-attack") {
      const hit = landed(entry.hits);
      scored.push({
        sequence: entry.sequence,
        round: entry.round,
        kind: "strike",
        actorId: entry.enemyId,
        actor: actorName(encounter, entry.enemyId),
        targetId: entry.targetId ?? encounter.playerId,
        target: actorName(encounter, entry.targetId ?? encounter.playerId),
        action: entry.attackId,
        damage: hit.damage,
        absorbed: hit.absorbed,
        critical: hit.critical > 0,
        dodged: hit.dodged === (entry.hits?.length || 0) && hit.dodged > 0,
      });
    }
  }
  if (scored.length <= MAX_DECISIVE_EVENTS) return scored;
  // Keep the heaviest, then put them back in the order they happened, so the trim changes
  // how much is said and never the sequence it is said in.
  const heaviest = [...scored]
    .sort((first, second) => second.damage - first.damage)
    .slice(0, MAX_DECISIVE_EVENTS)
    .map((entry) => entry.sequence);
  const keep = new Set(heaviest);
  return scored.filter((entry) => keep.has(entry.sequence));
}

/** What the fight was answered with: shields raised, wounds cleaned, blows nullified. */
function mitigations(encounter) {
  const out = [];
  for (const entry of encounter.events) {
    if (entry.type === "skill-shield") {
      out.push({
        sequence: entry.sequence,
        round: entry.round,
        kind: "shield",
        actor: actorName(encounter, entry.actorId ?? encounter.playerId),
        amount: entry.amount,
      });
    } else if (entry.type === "skill-heal") {
      out.push({
        sequence: entry.sequence,
        round: entry.round,
        kind: "heal",
        actor: actorName(encounter, entry.actorId ?? encounter.playerId),
        amount: entry.amount,
      });
    } else if (entry.type === "enemy-nullified") {
      out.push({
        sequence: entry.sequence,
        round: entry.round,
        kind: "nullified",
        actor: actorName(encounter, entry.enemyId),
        amount: 0,
      });
    }
  }
  return out;
}

/** Every status the fight put on someone, and who put it there. */
function statusesApplied(encounter) {
  const out = [];
  for (const entry of encounter.events) {
    if (entry.type !== "skill-status" && entry.type !== "trait-fired") continue;
    out.push({
      sequence: entry.sequence,
      round: entry.round,
      source: entry.skillId ?? entry.traitId,
      actor: actorName(encounter, entry.actorId ?? encounter.playerId),
      status: entry.status,
      count: entry.count ?? entry.amount ?? 0,
      target: entry.target ?? "self",
    });
  }
  return out;
}

function participantRows(session, receipt) {
  const { encounter } = session;
  return receipt.participants.map((outcome) => ({
    participantId: outcome.participantId,
    name: actorName(encounter, outcome.participantId),
    side: outcome.participantId === encounter.playerId
      ? "player"
      : (encounter.allyIds || []).includes(outcome.participantId) ? "ally" : "foe",
    campaignEntityId: outcome.campaignEntityId,
    combatState: outcome.combatState,
    worldFate: outcome.worldFate,
    finalHp: outcome.finalHp,
    maxHp: encounter.actors[outcome.participantId]?.maxHp ?? 0,
    terminalCause: outcome.terminalCause,
  }));
}

/**
 * Build the report for a decided fight.
 *
 * @param {object} session a terminal or settled session
 * @param {object} receipt its terminal receipt
 * @param {{settlementId?: string, playerEndpoint?: object, rewardsCommitted?: Array}} extra
 * @returns {object|null} null while the fight is still live
 */
export function buildCombatChronicle(session, receipt, extra = {}) {
  if (!session || !receipt) return null;
  const { encounter, context } = session;

  const body = {
    version: TOW_CHRONICLE_VERSION,
    sessionId: session.sessionId,
    rulesetId: session.rulesetId,
    cause: context.source?.note ?? null,
    source: context.source?.kind ?? null,
    location: context.location || null,
    stakes: {
      lethalPolicy: context.lethalPolicy,
      playerStakes: context.playerStakes,
      initiator: context.hostilityFacts?.initiator ?? null,
      surprise: Boolean(context.hostilityFacts?.surprise),
    },
    outcome: receipt.reason,
    winner: receipt.winner,
    rounds: receipt.rounds,
    participants: participantRows(session, receipt),
    decisiveEvents: decisiveEvents(encounter),
    mitigations: mitigations(encounter),
    statusesApplied: statusesApplied(encounter),
    playerEndpoint: extra.playerEndpoint ?? null,
    rewardsCommitted: extra.rewardsCommitted ?? [],
    settlementId: extra.settlementId ?? session.settlementId ?? null,
  };
  return { ...body, checksum: gameplayChecksum(body) };
}

const STATE_WORDS = Object.freeze({
  standing: "still standing",
  incapacitated: "knocked out",
  yielded: "yielded",
  fled: "fled",
  captured: "taken",
  dead: "killed",
});

/**
 * The compact text the narrator is handed.
 *
 * Written to be read rather than parsed: one line per participant with their exact fate,
 * then the blows that decided it. It goes in the prompt verbatim, so the instruction to
 * narrate strictly from the report finally refers to something.
 */
export function renderCombatChronicle(chronicle) {
  if (!chronicle) return "";
  const lines = [];
  lines.push(`[COMBAT REPORT] ${chronicle.outcome === "victory" ? "The player's side won" : "The player went down"} after ${chronicle.rounds} ${chronicle.rounds === 1 ? "round" : "rounds"} at ${chronicle.location || "an unnamed place"}.`);
  if (chronicle.cause) lines.push(`Cause: ${chronicle.cause}.`);
  lines.push(
    `Stakes: foes ${chronicle.stakes.lethalPolicy}; the player's life ${chronicle.stakes.playerStakes === "lethal" ? "was at risk" : "was not at risk"}.`,
  );

  lines.push("Fates:");
  for (const row of chronicle.participants) {
    const state = STATE_WORDS[row.combatState] || row.combatState;
    const alive = row.worldFate === "dead" ? "dead in the world" : "alive";
    const role = row.side === "player" ? " — this is the player" : ` — ${row.side}`;
    lines.push(`- ${row.name}: ${state}, ${alive}, ${row.finalHp}/${row.maxHp} health${role}.`);
  }

  if (chronicle.decisiveEvents.length > 0) {
    lines.push("Blows that mattered, in order:");
    for (const event of chronicle.decisiveEvents) {
      const detail = event.dodged
        ? "was dodged entirely"
        : `landed ${event.damage}${event.absorbed > 0 ? ` (${event.absorbed} absorbed)` : ""}${event.critical ? ", a critical" : ""}`;
      lines.push(`- round ${event.round}: ${event.actor} used ${event.action} on ${event.target}; it ${detail}.`);
    }
  }
  if (chronicle.mitigations.length > 0) {
    const shields = chronicle.mitigations.filter((entry) => entry.kind === "shield").length;
    const heals = chronicle.mitigations.filter((entry) => entry.kind === "heal").length;
    const stopped = chronicle.mitigations.filter((entry) => entry.kind === "nullified").length;
    const parts = [];
    if (shields > 0) parts.push(`${shields} guard${shields === 1 ? "" : "s"} raised`);
    if (heals > 0) parts.push(`${heals} wound${heals === 1 ? "" : "s"} tended`);
    if (stopped > 0) parts.push(`${stopped} enemy turn${stopped === 1 ? "" : "s"} stopped outright`);
    if (parts.length > 0) lines.push(`Answers: ${parts.join(", ")}.`);
  }
  lines.push("Every fate above is already canonical. Do not change one, and do not invent a participant who is not listed.");
  return lines.join("\n");
}

/** One plain sentence for a player who never sees the narration at all. */
export function chronicleSummary(chronicle) {
  if (!chronicle) return "";
  const fallen = chronicle.participants.filter(
    (row) => row.side === "foe" && row.combatState !== "standing",
  );
  const allies = chronicle.participants.filter(
    (row) => row.side === "ally" && row.combatState !== "standing",
  );
  if (chronicle.outcome !== "victory") {
    return `You went down after ${chronicle.rounds} ${chronicle.rounds === 1 ? "round" : "rounds"}.`;
  }
  const foePart = fallen.length === 1
    ? `${fallen[0].name} is ${STATE_WORDS[fallen[0].combatState] || fallen[0].combatState}`
    : `${fallen.length} foes are down`;
  const allyPart = allies.length > 0
    ? ` ${allies.map((row) => row.name).join(" and ")} fell in the fighting.`
    : "";
  return `${foePart}. The fight is over.${allyPart}`;
}
