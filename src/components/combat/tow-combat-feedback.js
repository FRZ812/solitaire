import { statusCount } from "../../gameplay/kernel/status-stack.js";
import { PROVISIONAL_DAMAGE_POLICY } from "../../gameplay/kernel/tow-damage.js";
import { getCombatItem } from "../../gameplay/tow/combat-items.js";
import { getSkill } from "../../gameplay/tow/skills.js";
import { combatVfxForEvent, combatVfxForHit, combatVfxForStatus } from "./tow-combat-vfx.js";

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
const EMPOWERING_STATUSES = new Set([
  "charge", "focus", "haste", "initiative", "judgment", "lifesteal", "overload",
  "priority", "skeleton", "strength", "swift",
]);

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

function resolvedHits(hits, baseDamage = null) {
  if (Array.isArray(hits)) return hits;
  if (!Number.isSafeInteger(hits) || hits <= 0) return [];
  const damage = Number.isFinite(baseDamage) ? baseDamage : 0;
  return Array.from({ length: hits }, (_, index) => ({
    index,
    dodged: false,
    critical: false,
    baseDamage: damage,
    rawDamage: damage,
    prevented: 0,
    mitigation: {},
    avoidance: {},
    damage,
    absorbed: 0,
    toHp: damage,
    thorn: 0,
  }));
}

function hitTotals(hits = [], baseDamage = null) {
  const rows = resolvedHits(hits, baseDamage);
  const totals = {
    attempted: rows.length,
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
    amplified: 0,
    vulnerablePercent: 0,
    defences: new Set(),
  };

  for (const hit of rows) {
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
    totals.amplified += hit.vulnerableBonus || 0;
    totals.vulnerablePercent = Math.max(
      totals.vulnerablePercent,
      Number(hit.vulnerablePercent)
        || (Number(hit.vulnerableBonus) > 0 ? PROVISIONAL_DAMAGE_POLICY.vulnerableDamagePercent : 0),
    );
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
  if (totals.amplified > 0) {
    clauses.push(`${totals.amplified} added by ${totals.vulnerablePercent}% Vulnerable`);
  }
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
  if (event.type === "resolve-spent") {
    return {
      sequence: event.sequence,
      kind: "resource",
      text: `${possessive(actor)} ${actionName(encounter, event, options)} commits ${event.amount} Resolve.`,
    };
  }
  if (event.type === "skill-resolve-restored") {
    return {
      sequence: event.sequence,
      kind: "resource",
      text: `${possessive(actor)} ${actionName(encounter, event, options)} restores ${event.restored} Resolve.`,
    };
  }
  if (event.type === "combat-item-used") {
    const item = getCombatItem(event.itemId);
    const name = item?.name || words(event.itemId);
    const target = actorName(encounter, event.targetId, "the target");
    let outcome = `${event.amount} effect`;
    if (event.effect === "heal-max-percent") outcome = `restores ${event.amount} health`;
    if (event.effect === "restore-resolve") outcome = `restores ${event.amount} Resolve`;
    if (event.effect === "shield-defense-percent") outcome = `raises ${event.amount} ward`;
    if (event.effect === "damage-attack-percent") outcome = `deals ${event.amount} health damage to ${target}`;
    return {
      sequence: event.sequence,
      kind: event.effect === "damage-attack-percent" ? "damage" : "item",
      text: `${actor} ${actor === "You" ? "use" : "uses"} ${name} and ${outcome}.`,
    };
  }
  if (event.type === "skill-shield") {
    const established = Number.isFinite(event.ward) ? event.ward : event.amount;
    const text = event.amount > 0
      ? `${possessive(actor)} ${actionName(encounter, event, options)} raises ${event.amount} ward.`
      : `${possessive(actor)} ${actionName(encounter, event, options)} refreshes the existing ${established} ward without stacking it.`;
    return {
      sequence: event.sequence,
      kind: "guard",
      text,
    };
  }
  if (event.type === "ward-expired") {
    return {
      sequence: event.sequence,
      kind: "guard",
      text: `${possessive(actor)} remaining ${event.amount} ward expires with the opposing command window.`,
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
  if (event.type === "skill-status-amplified") {
    const target = actorName(encounter, event.targetId, "the target");
    const statuses = event.statuses?.map(words).join(" / ") || "harmful effects";
    return {
      sequence: event.sequence,
      kind: "status",
      text: `${possessive(actor)} ${actionName(encounter, event, options)} amplifies ${target}'s ${statuses} by ${event.gained || 0} stacks.`,
    };
  }
  if (event.type === "trait-fired") {
    const targetIds = Array.isArray(event.targetIds) ? event.targetIds : [];
    const targetNames = targetIds.map((targetId) => actorName(encounter, targetId, "the target"));
    const target = targetNames.length > 1
      ? `${targetNames.slice(0, -1).join(", ")} and ${targetNames.at(-1)}`
      : targetNames[0];
    const inflicts = event.effectKind !== "grant-status"
      && targetIds.some((targetId) => targetId !== event.actorId);
    return {
      sequence: event.sequence,
      kind: "trait",
      text: inflicts
        ? `${possessive(actor)} ${words(event.traitId)} inflicts ${event.amount} ${words(event.status)} on ${target}.`
        : `${possessive(actor)} ${words(event.traitId)} grants ${event.amount} ${words(event.status)}.`,
    };
  }
  if (event.type === "enemy-nullified") {
    return {
      sequence: event.sequence,
      kind: "control",
      text: `${actorName(encounter, event.enemyId, "The foe")} cannot act while controlled; its declared attack is delayed, not erased.`,
    };
  }
  if (event.type === "actor-nullified") {
    const controls = event.controls?.map(words).join(" + ") || "Control";
    const spent = event.stacksSpent || 1;
    return {
      sequence: event.sequence,
      kind: "control",
      text: `${actor} automatically loses the command window to ${controls}; ${spent} control stack${spent === 1 ? " is" : "s are"} spent.`,
    };
  }
  if (event.type === "actor-preempted") {
    return {
      sequence: event.sequence,
      kind: "tempo",
      text: `${actor} is pre-empted by ${event.hostilePriority} enemy Priority; the enemy sequence resolves first.`,
    };
  }
  if (event.type === "tick-damage") {
    const entries = [
      ["Burn", event.burn || 0],
      ["Doom", event.doom || 0],
      ["Poison", event.poison || 0],
      ["Bleed", event.bleed || 0],
      ["Misfortune", event.misfortune || 0],
    ];
    const sources = entries.filter(([, amount]) => amount > 0);
    const total = sources.reduce((sum, [, amount]) => sum + amount, 0);
    return {
      sequence: event.sequence,
      kind: "damage",
      text: `${actor} loses ${total} health to ${sources.map(([name, amount]) => `${amount} ${name}`).join(" + ")}; this bypasses defence and ward.`,
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
    else reasons.push(`enemy Priority ${enemyPriority} resolves before this command window`);
  }
  return {
    sequence: `tempo-${encounter.round}-${actorId}`,
    kind: "tempo",
    text: `${actor.name} has ${remaining} action${remaining === 1 ? "" : "s"} left: ${reasons.join("; ")}. Swift abilities keep them.`,
  };
}

function effectSide(encounter, targetId, fallback = "enemy") {
  return encounter?.actors?.[targetId]?.side || fallback;
}

function activeDefences(hit) {
  return Object.entries(DEFENCE_LABELS)
    .filter(([key]) => hit?.mitigation?.[key])
    .map(([, label]) => label);
}

function cueIdentity(event, suffix) {
  return `${event.sequence}-${suffix}`;
}

function hitCue(encounter, event, hit, index, hitCount, visual) {
  const enemyAttack = event.type === "enemy-attack";
  const attackerId = enemyAttack ? event.enemyId : event.actorId;
  const targetId = event.targetId;
  const toHp = hit.toHp || 0;
  const absorbed = hit.absorbed || 0;
  const defences = activeDefences(hit);
  const raw = hit.rawDamage ?? hit.baseDamage ?? hit.damage ?? toHp + absorbed;
  const prevented = hit.prevented ?? Math.max(0, raw - (hit.damage || 0));
  const statusChanges = [
    ...(hit.statusChanges?.attacker || []).map((change) => ({ ...change, actorId: attackerId })),
    ...(hit.statusChanges?.defender || []).map((change) => ({ ...change, actorId: targetId })),
  ];

  let kind = hit.critical ? "critical" : "hit";
  let label = `-${toHp}`;
  let kicker = hit.critical ? "Critical" : null;
  if (hit.dodged) {
    kind = "evade";
    label = "Evaded";
    kicker = null;
  } else if (toHp <= 0 && absorbed > 0) {
    kind = "ward";
    label = "0";
    kicker = "Ward holds";
  } else if (toHp <= 0) {
    kind = "block";
    label = "0";
    kicker = defences.join(" + ") || "Blocked";
  } else if (absorbed > 0) {
    kicker = hit.critical ? "Critical · Ward breaks" : "Ward breaks";
  } else if (prevented > 0) {
    kicker = hit.critical
      ? `Critical · ${defences.join(" + ") || "Guarded"}`
      : defences.join(" + ") || "Guarded";
  }

  return {
    id: cueIdentity(event, `hit-${hit.index ?? index}`),
    sequence: event.sequence,
    kind,
    label,
    kicker,
    attackerId,
    targetId,
    targetSide: effectSide(encounter, targetId),
    hitIndex: index,
    hitCount,
    delayMs: index * 155,
    hpChange: toHp > 0 ? -toHp : 0,
    shieldChange: absorbed > 0 ? -absorbed : 0,
    absorbed,
    prevented,
    statusChanges,
    guarded: prevented > 0 && !hit.dodged,
    skillId: event.skillId || null,
    attackId: event.attackId || null,
    visual,
    outcomeAsset: null,
  };
}

function simpleCue(encounter, event, {
  suffix,
  kind,
  label,
  kicker = null,
  attackerId = event.actorId,
  targetId = event.actorId,
  targetSide,
  visual = combatVfxForEvent(encounter, event),
  hpChange = 0,
  shieldChange = 0,
}) {
  return {
    id: cueIdentity(event, suffix),
    sequence: event.sequence,
    kind,
    label,
    kicker,
    attackerId,
    targetId,
    targetSide: targetSide || effectSide(encounter, targetId, "player"),
    hitIndex: 0,
    hitCount: 1,
    delayMs: 0,
    hpChange,
    shieldChange,
    skillId: event.skillId || null,
    attackId: event.attackId || null,
    visual,
    outcomeAsset: null,
  };
}

/**
 * Map authoritative events to short-lived art feedback. Damage events deliberately return
 * one cue per resolved hit so a flurry cannot collapse into one aggregate animation.
 */
export function combatCuesForEvent(encounter, event) {
  if (!event) return [];
  if (event.type === "skill-damage" || event.type === "enemy-attack") {
    const visual = combatVfxForEvent(encounter, event);
    const enemyDefinition = event.type === "enemy-attack"
      ? encounter?.enemyAttacks?.[event.enemyId]?.find((entry) => entry.id === event.attackId)
      : null;
    const hits = resolvedHits(event.hits, event.type === "enemy-attack" ? enemyDefinition?.damage : event.amount);
    return hits.map((hit, index) => hitCue(
      encounter,
      event,
      hit,
      index,
      hits.length,
      combatVfxForHit(visual, index, hits.length),
    ));
  }

  if (event.type === "combat-item-used") {
    if (event.effect === "damage-attack-percent") {
      const visual = combatVfxForEvent(encounter, event);
      const hits = resolvedHits(event.hits, event.amount);
      return hits.map((hit, index) => hitCue(
        encounter,
        event,
        hit,
        index,
        hits.length,
        combatVfxForHit(visual, index, hits.length),
      ));
    }
    if (event.effect === "heal-max-percent") {
      return [simpleCue(encounter, event, {
        suffix: "item-heal",
        kind: "heal",
        label: `+${event.amount}`,
        kicker: getCombatItem(event.itemId)?.name || "Item",
        hpChange: event.amount,
      })];
    }
    if (event.effect === "shield-defense-percent") {
      return [simpleCue(encounter, event, {
        suffix: "item-ward",
        kind: "ward",
        label: `+${event.amount}`,
        kicker: getCombatItem(event.itemId)?.name || "Item",
        shieldChange: event.amount,
      })];
    }
    if (event.effect === "restore-resolve") {
      return [simpleCue(encounter, event, {
        suffix: "item-resolve",
        kind: "empower",
        label: `+${event.amount}`,
        kicker: "Resolve",
      })];
    }
  }

  if (event.type === "skill-shield") {
    const established = Number.isFinite(event.after) ? event.after : event.amount;
    return [simpleCue(encounter, event, {
      suffix: "ward",
      kind: "ward",
      label: event.amount > 0 ? `+${event.amount}` : `${established}`,
      kicker: event.amount > 0 ? "Ward" : "Ward refreshed",
      shieldChange: event.amount,
    })];
  }
  if (event.type === "ward-expired") {
    return [simpleCue(encounter, event, {
      suffix: "ward-expired",
      kind: "ward",
      label: `-${event.amount}`,
      kicker: "Ward expires",
      shieldChange: -event.amount,
    })];
  }
  if (event.type === "skill-heal") {
    return [simpleCue(encounter, event, {
      suffix: "heal",
      kind: "heal",
      label: `+${event.amount}`,
      kicker: "Restored",
      hpChange: event.amount,
    })];
  }
  if (event.type === "skill-cleanse") {
    return [simpleCue(encounter, event, {
      suffix: "cleanse",
      kind: "heal",
      label: "Cleanse",
      kicker: `${event.removed || 0} removed`,
    })];
  }
  if (event.type === "skill-status") {
    const targetId = targetForStatus(event);
    const status = event.status;
    const kind = EVASIVE_STATUSES.has(status)
      ? "evade"
      : DEFENSIVE_STATUSES.has(status)
        ? "guard"
        : EMPOWERING_STATUSES.has(status)
          ? "empower"
          : "afflict";
    return [simpleCue(encounter, event, {
      suffix: `status-${status}`,
      kind,
      label: words(status),
      kicker: event.count > 0 ? `+${event.count}` : null,
      targetId,
      targetSide: effectSide(encounter, targetId, event.target === "enemy" ? "enemy" : "player"),
    })];
  }
  if (event.type === "skill-status-amplified") {
    return [simpleCue(encounter, event, {
      suffix: "status-amplified",
      kind: "afflict",
      label: "Amplified",
      kicker: event.gained > 0 ? `+${event.gained}` : null,
      targetId: event.targetId,
      targetSide: effectSide(encounter, event.targetId, "enemy"),
    })];
  }
  if (event.type === "enemy-nullified") {
    return [simpleCue(encounter, event, {
      suffix: "interrupted",
      kind: "afflict",
      label: "Interrupted",
      attackerId: null,
      targetId: event.enemyId,
      targetSide: "enemy",
    })];
  }
  if (event.type === "actor-nullified") {
    return [simpleCue(encounter, event, {
      suffix: "command-nullified",
      kind: "afflict",
      label: "Turn skipped",
      kicker: event.controls?.map(words).join(" + ") || "Controlled",
      targetId: event.actorId,
      targetSide: "player",
    })];
  }
  if (event.type === "actor-preempted") {
    return [simpleCue(encounter, event, {
      suffix: "priority-preempted",
      kind: "afflict",
      label: "Pre-empted",
      kicker: `${event.hostilePriority || 0} Priority`,
      targetId: event.actorId,
      targetSide: "player",
    })];
  }
  if (event.type === "retreat-attempt") {
    return [simpleCue(encounter, event, {
      suffix: event.succeeded ? "escaped" : "cornered",
      kind: event.succeeded ? "evade" : "afflict",
      label: event.succeeded ? "Escaped" : "Cornered",
      targetId: event.actorId,
      targetSide: "player",
    })];
  }
  if (event.type === "tick-damage") {
    const cues = ["burn", "doom", "poison", "bleed", "misfortune"].flatMap((type) => {
      const amount = event[type] || 0;
      if (amount <= 0) return [];
      return [simpleCue(encounter, event, {
        suffix: type,
        kind: "hit",
        label: `-${amount}`,
        kicker: words(type),
        attackerId: null,
        targetId: event.actorId,
        hpChange: -amount,
        visual: combatVfxForStatus(type),
      })];
    });
    return cues.map((cue, index) => ({ ...cue, hitIndex: index, hitCount: cues.length, delayMs: index * 155 }));
  }
  return [];
}

const SAME_ACTION_EFFECT_GAP_MS = 105;

const EXCHANGE_GAPS = Object.freeze({
  afterimage: 280,
  barrage: 390,
  brace: 440,
  counter: 420,
  cyclone: 420,
  execution: 560,
  flurry: 360,
  fortress: 470,
  heavy: 540,
  inferno: 520,
  mend: 430,
  multi: 360,
  projectile: 340,
  quake: 580,
  rapid: 290,
  radiant: 460,
  snap: 300,
  volley: 390,
});

function exchangeGap(motion) {
  return EXCHANGE_GAPS[motion] || 400;
}

function cueActionKey(event) {
  if (event.type === "enemy-attack") {
    return `enemy:${event.enemyId || "enemy"}:${event.attackId || event.sequence}`;
  }
  if (event.skillId) return `skill:${event.actorId || "actor"}:${event.skillId}`;
  if (event.type === "tick-damage") return `tick:${event.actorId || "actor"}`;
  return `${event.type}:${event.sequence}`;
}

function declarationLabel(encounter, event) {
  if (event.type === "enemy-attack") return enemyAttackName(encounter, event);
  if (event.skillId) {
    try {
      return getSkill(event.skillId)?.name || words(event.skillId);
    } catch {
      return words(event.skillId);
    }
  }
  if (event.itemId) return getCombatItem(event.itemId)?.name || words(event.itemId);
  if (event.type === "tick-damage") {
    const type = ["burn", "doom", "poison", "bleed", "misfortune"]
      .find((candidate) => event[candidate] > 0);
    return type ? words(type) : "Status damage";
  }
  return words(event.type);
}

/**
 * Lay authoritative events onto one presentation timeline. Consecutive effects from the
 * same skill stay in one beat; a counterattack starts only after the prior contact reads.
 */
export function combatCueTimeline(encounter, events, { limit = 16 } = {}) {
  const timeline = [];
  let actionKey = null;
  let actionIndex = -1;
  let groupEnd = 0;
  let groupMotion = "balanced";

  for (const event of events || []) {
    const cues = combatCuesForEvent(encounter, event);
    if (cues.length === 0) continue;
    const nextKey = cueActionKey(event);
    const sameAction = nextKey === actionKey;
    let eventOffset;

    if (sameAction) {
      eventOffset = groupEnd + SAME_ACTION_EFFECT_GAP_MS;
    } else {
      eventOffset = timeline.length === 0 ? 0 : groupEnd + exchangeGap(groupMotion);
      actionKey = nextKey;
      actionIndex += 1;
      groupMotion = cues[0]?.visual?.motion || "balanced";
    }

    const staged = cues.map((cue) => ({
      ...cue,
      actionIndex,
      declarationLabel: declarationLabel(encounter, event),
      delayMs: eventOffset + (cue.delayMs || 0),
    }));
    timeline.push(...staged);
    groupEnd = Math.max(groupEnd, ...staged.map((cue) => cue.delayMs));
  }

  return timeline.slice(-limit);
}

/** Backwards-compatible single-cue view for code that does not render hit sequences. */
export function combatCueForEvent(encounter, event) {
  return combatCuesForEvent(encounter, event)[0] || null;
}
