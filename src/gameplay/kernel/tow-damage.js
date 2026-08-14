// Multi-hit damage resolution.
//
// The load-bearing detail: an attack declares a *number of hits*, and Steelskin, Thorn,
// Burn and DoomAtk all resolve per individual hit. Collapsing a swing into one damage
// number gets all four wrong, which is why this cannot be a one-line subtraction.
//
// Every value the wiki does not establish lives in PROVISIONAL_DAMAGE_POLICY rather than
// being baked into the arithmetic, so a later capture is a one-object change and a trace
// can always say which numbers were evidence and which were placeholder.

import { nextInt } from "./rng.js";
import {
  applyStatus,
  consumeStatusCount,
  decrementOnHit,
  removeStatus,
  statusCount,
} from "./status-stack.js";

export const PROVISIONAL_DAMAGE_POLICY = Object.freeze({
  // Crit *rate* is observed on every stat block. What a crit multiplies by is not.
  critMultiplier: 2,
  critMultiplierEvidence: "gap",

  // Observed: Solidity -30%, Guard -50%. Not observed: how two of them compose.
  percentReductionStacking: "multiplicative",
  percentReductionStackingEvidence: "gap",

  // Observed: Evade "increases Dodge rate by 60%", Conceal "+80% Dodge". Not observed:
  // whether a count above 1 stacks the bonus or just buys more turns of it.
  evadeDodgeBonus: 60,
  concealDodgeBonus: 80,
  dodgeBonusStacksWithCount: false,
  dodgeBonusEvidence: "gap",

  // Observed: "Damage received from enemy attacks is reduced." Not observed: by how much.
  // Read as a flat Count, mirroring Steelskin, because both share the decrease-when-hit
  // lifecycle.
  protectionMode: "flat-count",
  protectionModeEvidence: "gap",

  // Vulnerable is a Count whose strategic value must be visible rather than an inert label.
  // Each point raises attack damage received by one percent. The source establishes exposed
  // defence but not the composition order, so this provisional rule is isolated here.
  vulnerableDamagePerCountPercent: 1,
  vulnerableEvidence: "gap",

  // Not observed: whether a dodged hit still spends on-hit statuses or provokes Thorn.
  dodgeSpendsOnHitStatuses: false,
  dodgeProvokesThorn: false,
  dodgeEvidence: "gap",

  // Observed: Thorn "activates as many times as the # of being attacked". Not observed:
  // whether a hit reduced to zero still counts as being attacked.
  thornOnFullyMitigatedHit: true,
  thornEvidence: "gap",

  // Not observed: whether the remaining hits of a multi-hit attack land after the target
  // is already down.
  stopHitsOnDefeat: true,
  stopHitsOnDefeatEvidence: "gap",

  // The source records Charge in 100-point packets but leaves the status-table effect
  // blank. Solitaire makes that packet an explicit charged critical window: the next
  // landed hit is critical and spends one packet. Keeping the threshold here makes the
  // adaptation auditable instead of leaving the Tenacious Mage's innate trait inert.
  chargeThreshold: 100,
  chargedHit: "guaranteed-critical",
  chargedHitEvidence: "adapted",

  rounding: "floor",
  roundingEvidence: "gap",

  order: Object.freeze([
    "dodge-roll",
    "crit-roll",
    "invincible-check",
    "percent-reduction",
    "vulnerable-amplification",
    "flat-reduction",
    "shield-absorb",
    "hp-damage",
    "thorn-retaliation",
    "on-hit-status-decrement",
  ]),
  orderEvidence: "gap",
});

const POLICY = PROVISIONAL_DAMAGE_POLICY;

function clampRate(value) {
  return Math.max(0, Math.min(100, value));
}

function dodgeChanceFor(defender) {
  const evade = statusCount(defender.statuses, "evade");
  const conceal = statusCount(defender.statuses, "conceal");
  const evadeBonus = evade > 0
    ? POLICY.evadeDodgeBonus * (POLICY.dodgeBonusStacksWithCount ? evade : 1)
    : 0;
  const concealBonus = conceal > 0
    ? POLICY.concealDodgeBonus * (POLICY.dodgeBonusStacksWithCount ? conceal : 1)
    : 0;
  return clampRate(defender.stats.dodgeRate + evadeBonus + concealBonus);
}

function percentMultiplierFor(defender) {
  let multiplier = 1;
  if (statusCount(defender.statuses, "guard") > 0) multiplier *= 0.5;
  if (statusCount(defender.statuses, "solidity") > 0) multiplier *= 0.7;
  return multiplier;
}

function flatReductionFor(defender) {
  const steelskin = statusCount(defender.statuses, "steelskin");
  const protection = POLICY.protectionMode === "flat-count"
    ? statusCount(defender.statuses, "protection")
    : 0;
  return steelskin + protection;
}

function vulnerableMultiplierFor(defender) {
  const vulnerable = statusCount(defender.statuses, "vulnerable");
  const limp = statusCount(defender.statuses, "limp");
  return 1 + (((vulnerable + limp) * POLICY.vulnerableDamagePerCountPercent) / 100);
}

function mitigationSnapshot(defender) {
  return {
    invincible: statusCount(defender.statuses, "invincible") > 0,
    guard: statusCount(defender.statuses, "guard") > 0,
    solidity: statusCount(defender.statuses, "solidity") > 0,
    steelskin: statusCount(defender.statuses, "steelskin") > 0,
    protection: statusCount(defender.statuses, "protection") > 0,
    vulnerable: statusCount(defender.statuses, "vulnerable"),
    limp: statusCount(defender.statuses, "limp"),
  };
}

function applyOnHitPassives(attacker, defender, directDamage) {
  let nextAttacker = attacker;
  let nextDefender = defender;
  const applied = [];

  for (const [attackStatus, targetStatus] of [
    ["doom-atk", "doom"],
    ["poison-atk", "poison"],
    ["bleed-atk", "bleed"],
    ["lethargy-atk", "lethargy"],
    ["eviscerate", "vulnerable"],
  ]) {
    const count = statusCount(nextAttacker.statuses, attackStatus);
    if (count <= 0) continue;
    nextDefender = {
      ...nextDefender,
      statuses: applyStatus(nextDefender.statuses, targetStatus, count),
    };
    applied.push({ status: targetStatus, count });
  }

  let judgmentDamage = 0;
  const judgment = statusCount(nextAttacker.statuses, "judgment");
  if (judgment > 0) {
    judgmentDamage = Math.min(nextDefender.hp, judgment);
    nextDefender = { ...nextDefender, hp: nextDefender.hp - judgmentDamage };
    nextAttacker = { ...nextAttacker, statuses: removeStatus(nextAttacker.statuses, "judgment") };
  }

  let lifestealHeal = 0;
  const lifesteal = statusCount(nextAttacker.statuses, "lifesteal");
  if (lifesteal > 0 && directDamage > 0 && nextAttacker.hp > 0) {
    lifestealHeal = Math.max(1, Math.ceil((directDamage * lifesteal) / 100));
    lifestealHeal = Math.min(lifestealHeal, nextAttacker.maxHp - nextAttacker.hp);
    if (lifestealHeal > 0) {
      nextAttacker = { ...nextAttacker, hp: nextAttacker.hp + lifestealHeal };
    }
  }

  let priorityGained = 0;
  const initiativePerHit = statusCount(nextAttacker.statuses, "initiative-atk");
  if (initiativePerHit > 0) {
    const initiative = statusCount(nextAttacker.statuses, "initiative") + initiativePerHit;
    priorityGained = Math.floor(initiative / 100);
    let statuses = removeStatus(nextAttacker.statuses, "initiative");
    const remainder = initiative % 100;
    if (remainder > 0) statuses = applyStatus(statuses, "initiative", remainder);
    if (priorityGained > 0) statuses = applyStatus(statuses, "priority", priorityGained);
    nextAttacker = { ...nextAttacker, statuses };
  }

  return {
    attacker: nextAttacker,
    defender: nextDefender,
    applied,
    judgmentDamage,
    lifestealHeal,
    priorityGained,
  };
}

// Damage lands on the shield first and only spills into HP once the shield is gone.
function applyDamage(actor, amount) {
  if (amount <= 0) return { actor, absorbed: 0, toHp: 0 };
  const absorbed = Math.min(actor.shield, amount);
  const toHp = amount - absorbed;
  return {
    actor: {
      ...actor,
      shield: actor.shield - absorbed,
      hp: Math.max(0, actor.hp - toHp),
    },
    absorbed,
    toHp,
  };
}

/**
 * Resolve one attack of `attack.hits` individual hits from `attacker` against `defender`.
 *
 * Pure: returns fresh actors and a fresh rng, and never mutates its arguments.
 *
 * @param {{attacker: object, defender: object, attack: {id?: string, hits: number, damage: number}, rng: object}} input
 * @returns {{attacker: object, defender: object, rng: object, hits: object[]}}
 */
export function resolveAttack({ attacker, defender, attack, rng } = {}) {
  if (!attack || !Number.isSafeInteger(attack.hits) || attack.hits < 1) {
    throw new TypeError("invalid-attack-hits");
  }
  if (!Number.isSafeInteger(attack.damage) || attack.damage < 0) {
    throw new TypeError("invalid-attack-damage");
  }

  let currentAttacker = attacker;
  let currentDefender = defender;
  let currentRng = rng;
  const hits = [];

  for (let index = 0; index < attack.hits; index += 1) {
    if (POLICY.stopHitsOnDefeat && (currentDefender.hp <= 0 || currentAttacker.hp <= 0)) break;

    const dodgeChance = dodgeChanceFor(currentDefender);
    const avoidance = {
      chance: dodgeChance,
      evade: statusCount(currentDefender.statuses, "evade") > 0,
      conceal: statusCount(currentDefender.statuses, "conceal") > 0,
    };
    const dodgeRoll = nextInt(currentRng, 1, 100);
    currentRng = dodgeRoll.rng;
    const dodged = dodgeRoll.value <= dodgeChance;

    if (dodged) {
      if (POLICY.dodgeSpendsOnHitStatuses) {
        currentDefender = {
          ...currentDefender,
          statuses: decrementOnHit(currentDefender.statuses),
        };
      }
      hits.push({
        index,
        dodged: true,
        critical: false,
        baseDamage: attack.damage,
        rawDamage: attack.damage,
        vulnerableBonus: 0,
        prevented: attack.damage,
        mitigation: {},
        avoidance,
        damage: 0,
        absorbed: 0,
        toHp: 0,
        thorn: 0,
      });
      continue;
    }

    const critRoll = nextInt(currentRng, 1, 100);
    currentRng = critRoll.rng;
    const chargeSpent = statusCount(currentAttacker.statuses, "charge") >= POLICY.chargeThreshold
      ? POLICY.chargeThreshold
      : 0;
    const critical = chargeSpent > 0 || critRoll.value <= currentAttacker.stats.critRate;

    const rawDamage = attack.damage * (critical ? POLICY.critMultiplier : 1);
    const mitigation = mitigationSnapshot(currentDefender);
    let damage = rawDamage;
    let vulnerableBonus = 0;
    if (statusCount(currentDefender.statuses, "invincible") > 0) {
      damage = 0;
    } else {
      damage = Math.floor(damage * percentMultiplierFor(currentDefender));
      const beforeVulnerable = damage;
      damage = Math.floor(damage * vulnerableMultiplierFor(currentDefender));
      vulnerableBonus = Math.max(0, damage - beforeVulnerable);
      damage = Math.max(0, damage - flatReductionFor(currentDefender));
    }

    const landed = applyDamage(currentDefender, damage);
    currentDefender = landed.actor;

    // Thorn answers per hit received, not per attack.
    let thorn = 0;
    if (damage > 0 || POLICY.thornOnFullyMitigatedHit) {
      thorn = statusCount(currentDefender.statuses, "thorn");
      if (thorn > 0) {
        const retaliation = applyDamage(currentAttacker, thorn);
        currentAttacker = retaliation.actor;
      }
    }

    currentDefender = {
      ...currentDefender,
      statuses: decrementOnHit(currentDefender.statuses),
    };
    if (chargeSpent > 0) {
      currentAttacker = {
        ...currentAttacker,
        statuses: consumeStatusCount(currentAttacker.statuses, "charge", chargeSpent),
      };
    }

    const passive = applyOnHitPassives(currentAttacker, currentDefender, damage);
    currentAttacker = passive.attacker;
    currentDefender = passive.defender;

    hits.push({
      index,
      dodged: false,
      critical,
      baseDamage: attack.damage,
      rawDamage,
      vulnerableBonus,
      prevented: Math.max(0, rawDamage + vulnerableBonus - damage),
      mitigation,
      avoidance,
      damage,
      absorbed: landed.absorbed,
      toHp: landed.toHp,
      thorn,
      chargeSpent,
      onHitStatuses: passive.applied,
      judgmentDamage: passive.judgmentDamage,
      lifestealHeal: passive.lifestealHeal,
      priorityGained: passive.priorityGained,
    });
  }

  return { attacker: currentAttacker, defender: currentDefender, rng: currentRng, hits };
}
