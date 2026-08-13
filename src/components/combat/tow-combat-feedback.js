import { statusCount } from "../../gameplay/kernel/status-stack.js";
import { getSkill } from "../../gameplay/tow/skills.js";

const DEFENCE_LABELS = Object.freeze({
  invincible: "Invincible",
  guard: "Guard",
  solidity: "Solidity",
  steelskin: "Steelskin",
  protection: "Protection",
});

const DEFENSIVE_STATUSES = new Set([
  "guard", "invincible", "protection", "solidity", "steelskin", "tenacity", "thorn",
]);
const EVASIVE_STATUSES = new Set(["conceal", "evade"]);
const EMPOWERING_STATUSES = new Set(["haste", "overload", "priority", "strength", "swift"]);

function words(value) {
  return String(value || "unknown")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function actorName(encounter, actorId, fallback = "Someone") {
  if (actorId && actorId === encounter?.playerId) return "You";
  return encounter?.actors?.[actorId]?.name || fallback;
}

function possessive(name) {
  return name === "You" ? "Your" : `${name}'s`;
}

function actionName(encounter, event, options) {
  const supplied = options?.skillName?.(event, encounter);
  if (supplied) return supplied;
  try {
    return getSkill(event.skillId)?.name || words(event.skillId);
  } catch {
    return words(event.skillId);
  }
}

function enemyAttackName(encounter, event) {
  const attack = encounter?.enemyAttacks?.[event.enemyId]
    ?.find((entry) => entry.id === event.attackId);
  return attack?.name || words(event.attackId || "attack");
}

function hitTotals(hits = [], baseDamage = null) {
  const totals = {
    attempted: hits.length,
    landed: 0,
    dodged: 0,
    critical: 0,
    raw: 0,
    damage: 0,
    avoided: 0,
    mitigated: 0,
    absorbed: 0,
    toHp: 0,
    thorn: 0,
    defences: new Set(),
  };

  for (const hit of hits) {
    const raw = hit.rawDamage
      ?? hit.baseDamage
      ?? (Number.isFinite(baseDamage) ? baseDamage * (hit.critical ? 2 : 1) : hit.damage ?? 0);
    totals.raw += raw;
    totals.damage += hit.damage || 0;
    const prevented = hit.prevented ?? Math.max(0, raw - (hit.damage || 0));
    if (hit.dodged) totals.avoided += prevented;
    else totals.mitigated += prevented;
    totals.absorbed += hit.absorbed || 0;
    totals.toHp += hit.toHp || 0;
    totals.thorn += hit.thorn || 0;
    if (hit.dodged) totals.dodged += 1;
    else totals.landed += 1;
    if (hit.critical) totals.critical += 1;
    for (const key of Object.keys(DEFENCE_LABELS)) {
      if (hit.mitigation?.[key]) totals.defences.add(DEFENCE_LABELS[key]);
    }
  }
  return totals;
}

function hitCountText(totals) {
  if (totals.attempted <= 1) return "hits";
  return `lands ${totals.landed} of ${totals.attempted} hits on`;
}

function damageReceipt(encounter, event, options) {
  const enemyAttack = event.type === "enemy-attack";
  const attackerId = enemyAttack ? event.enemyId : event.actorId;
  const attacker = actorName(encounter, attackerId, enemyAttack ? "The foe" : "The attacker");
  const defender = actorName(encounter, event.targetId, "the target");
  const attack = enemyAttack ? enemyAttackName(encounter, event) : actionName(encounter, event, options);
  const enemyDefinition = enemyAttack
    ? encounter?.enemyAttacks?.[event.enemyId]?.find((entry) => entry.id === event.attackId)
    : null;
  const totals = hitTotals(event.hits, enemyAttack ? enemyDefinition?.damage : event.amount);
  const subject = `${possessive(attacker)} ${attack}`;

  if (totals.attempted > 0 && totals.dodged === totals.attempted) {
    const hitWord = totals.attempted === 1 ? "hit" : `${totals.attempted} hits`;
    return `${defender} ${defender === "You" ? "dodge" : "dodges"} ${totals.attempted === 1 ? "the" : "all"} ${hitWord} from ${subject}, avoiding ${totals.raw} damage.`;
  }

  const clauses = [];
  clauses.push(totals.toHp > 0 ? `${totals.toHp} health lost` : "no health lost");
  if (totals.absorbed > 0) clauses.push(`${totals.absorbed} absorbed by ward`);
  if (totals.mitigated > 0) {
    const sources = [...totals.defences];
    clauses.push(`${totals.mitigated} reduced${sources.length ? ` by ${sources.join(" + ")}` : " by defence"}`);
  }
  if (totals.dodged > 0) {
    clauses.push(`${totals.dodged} ${totals.dodged === 1 ? "hit" : "hits"} dodged (${totals.avoided} avoided)`);
  }
  if (totals.critical > 0) clauses.push(`${totals.critical} critical ${totals.critical === 1 ? "hit" : "hits"}`);
  if (totals.thorn > 0) clauses.push(`Thorn returns ${totals.thorn}`);
  return `${subject} ${hitCountText(totals)} ${defender}: ${clauses.join("; ")}.`;
}

function targetForStatus(event) {
  if (event.targetId) return event.targetId;
  if (event.target === "self") return event.actorId;
  return null;
}

/** Turn one append-only encounter event into player-facing mechanical prose. */
export function combatEventReceipt(encounter, event, options = {}) {
  if (!event) return null;
  if (event.type === "skill-damage" || event.type === "enemy-attack") {
    return { sequence: event.sequence, kind: "damage", text: damageReceipt(encounter, event, options) };
  }

  const actor = actorName(encounter, event.actorId);
  if (event.type === "skill-shield") {
    return {
      sequence: event.sequence,
      kind: "guard",
      text: `${possessive(actor)} ${actionName(encounter, event, options)} raises ${event.amount} ward.`,
    };
  }
  if (event.type === "skill-heal") {
    return {
      sequence: event.sequence,
      kind: "heal",
      text: `${possessive(actor)} ${actionName(encounter, event, options)} restores ${event.amount} health.`,
    };
  }
  if (event.type === "skill-cleanse") {
    return {
      sequence: event.sequence,
      kind: "cleanse",
      text: `${possessive(actor)} ${actionName(encounter, event, options)} removes ${event.removed} ${event.statuses?.map(words).join(" / ") || "harmful"} stacks.`,
    };
  }
  if (event.type === "skill-status") {
    const targetId = targetForStatus(event);
    const target = actorName(encounter, targetId, event.target === "enemy" ? "the target" : actor);
    return {
      sequence: event.sequence,
      kind: "status",
      text: `${actionName(encounter, event, options)} gives ${target} ${event.count} ${words(event.status)}.`,
    };
  }
  if (event.type === "trait-fired") {
    return {
      sequence: event.sequence,
      kind: "trait",
      text: `${possessive(actor)} ${words(event.traitId)} grants ${event.amount} ${words(event.status)}.`,
    };
  }
  if (event.type === "enemy-nullified") {
    return {
      sequence: event.sequence,
      kind: "control",
      text: `${actorName(encounter, event.enemyId, "The foe")} cannot act while controlled; its declared attack is delayed, not erased.`,
    };
  }
  if (event.type === "tick-damage") {
    const burn = event.burn || 0;
    const doom = event.doom || 0;
    const sources = [burn ? `${burn} Burn` : null, doom ? `${doom} Doom` : null].filter(Boolean);
    return {
      sequence: event.sequence,
      kind: "damage",
      text: `${actor} loses ${burn + doom} health to ${sources.join(" + ")}; this bypasses defence and ward.`,
    };
  }
  if (event.type === "actor-stood-down") {
    return { sequence: event.sequence, kind: "action", text: `${actor} is ordered to hold position this round.` };
  }
  if (event.type === "retreat-attempt") {
    const chance = event.chancePercent;
    const comparison = `${event.playerRating} party strength versus ${event.enemyRating}`;
    const isPlayer = event.actorId === encounter?.playerId;
    return {
      sequence: event.sequence,
      kind: event.succeeded ? "retreat" : "danger",
      text: event.succeeded
        ? `${isPlayer ? "You lead" : `${actor} leads`} the party clear (${chance}% chance; rolled ${event.roll}; ${comparison}).`
        : `${isPlayer ? "Your" : `${actor}'s`} retreat fails (${chance}% chance; rolled ${event.roll}; ${comparison}); the action is spent.`,
    };
  }
  return null;
}

/** Keep the battlefield terse: only the latest meaningful receipts are prepared for UI. */
export function recentCombatReceipts(encounter, options = {}, limit = 6) {
  return (encounter?.events || [])
    .slice(-32)
    .map((event) => combatEventReceipt(encounter, event, options))
    .filter(Boolean)
    .slice(-limit);
}

/** Explain the current action budget only when Haste or Priority changes the normal one. */
export function combatTempoReceipt(encounter, actorId) {
  if (!encounter || encounter.phase !== "player") return null;
  const actor = encounter.actors?.[actorId];
  if (!actor || actor.hp <= 0) return null;
  const haste = statusCount(actor.statuses, "haste");
  const ownPriority = statusCount(actor.statuses, "priority");
  const enemyPriority = (encounter.enemyIds || []).reduce((highest, enemyId) => {
    const enemy = encounter.actors?.[enemyId];
    return !enemy || enemy.hp <= 0
      ? highest
      : Math.max(highest, statusCount(enemy.statuses, "priority"));
  }, 0);
  if (haste <= 0 && ownPriority <= 0 && enemyPriority <= 0) return null;
  const remaining = actorId === encounter.playerId
    ? encounter.turn.actionsRemaining
    : encounter.turn.allies?.[actorId] ?? 0;
  const reasons = [];
  if (haste > 0) reasons.push(`Haste grants ${haste}`);
  if (ownPriority > 0 || enemyPriority > 0) {
    const net = Math.max(0, ownPriority - enemyPriority);
    if (net > 0) reasons.push(`Priority ${ownPriority} versus ${enemyPriority} grants ${net}`);
    else if (ownPriority > 0) reasons.push(`enemy Priority ${enemyPriority} cancels Priority ${ownPriority}`);
    else reasons.push(`enemy Priority ${enemyPriority} cannot steal the base action`);
  }
  return {
    sequence: `tempo-${encounter.round}-${actorId}`,
    kind: "tempo",
    text: `${actor.name} has ${remaining} action${remaining === 1 ? "" : "s"} left: ${reasons.join("; ")}. Swift abilities keep them.`,
  };
}

/** Map authoritative events to short-lived art feedback; no mechanics are re-simulated. */
export function combatCueForEvent(encounter, event) {
  if (!event) return null;
  if (event.type === "skill-damage" || event.type === "enemy-attack") {
    const enemyAttack = event.type === "enemy-attack";
    const enemyDefinition = enemyAttack
      ? encounter?.enemyAttacks?.[event.enemyId]?.find((entry) => entry.id === event.attackId)
      : null;
    const totals = hitTotals(event.hits, enemyAttack ? enemyDefinition?.damage : event.amount);
    let kind = "guard";
    let label = "Deflected";
    if (totals.attempted > 0 && totals.dodged === totals.attempted) {
      kind = "dodge";
      label = "Dodged";
    } else if (totals.toHp > 0) {
      kind = totals.critical > 0 ? "critical" : "hit";
      label = totals.critical > 0 ? "Critical" : `-${totals.toHp}`;
    } else if (totals.absorbed > 0) {
      kind = "guard";
      label = "Ward holds";
    }
    return {
      sequence: event.sequence,
      kind,
      label,
      attackerId: enemyAttack ? event.enemyId : event.actorId,
      targetId: event.targetId,
      targetSide: encounter?.actors?.[event.targetId]?.side || "enemy",
    };
  }
  if (event.type === "skill-shield") {
    return { sequence: event.sequence, kind: "guard", label: "Ward", attackerId: event.actorId, targetId: event.actorId, targetSide: "player" };
  }
  if (event.type === "skill-heal") {
    return { sequence: event.sequence, kind: "heal", label: `+${event.amount}`, attackerId: event.actorId, targetId: event.actorId, targetSide: "player" };
  }
  if (event.type === "skill-status") {
    const targetId = targetForStatus(event);
    const status = event.status;
    const kind = EVASIVE_STATUSES.has(status)
      ? "dodge"
      : DEFENSIVE_STATUSES.has(status)
        ? "guard"
        : EMPOWERING_STATUSES.has(status)
          ? "empower"
          : "afflict";
    return {
      sequence: event.sequence,
      kind,
      label: words(status),
      attackerId: event.actorId,
      targetId,
      targetSide: encounter?.actors?.[targetId]?.side || (event.target === "enemy" ? "enemy" : "player"),
    };
  }
  if (event.type === "enemy-nullified") {
    return { sequence: event.sequence, kind: "afflict", label: "Interrupted", attackerId: null, targetId: event.enemyId, targetSide: "enemy" };
  }
  if (event.type === "retreat-attempt") {
    return {
      sequence: event.sequence,
      kind: event.succeeded ? "dodge" : "afflict",
      label: event.succeeded ? "Escaped" : "Cornered",
      attackerId: event.actorId,
      targetId: event.actorId,
      targetSide: "player",
    };
  }
  if (event.type === "tick-damage") {
    return { sequence: event.sequence, kind: "hit", label: `-${(event.burn || 0) + (event.doom || 0)}`, attackerId: null, targetId: event.actorId, targetSide: encounter?.actors?.[event.actorId]?.side || "player" };
  }
  return null;
}
