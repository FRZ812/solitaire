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
  decrementOnHit,
  removeStatus,
  statusCount,
} from "./status-stack.js";

export const PROVISIONAL_DAMAGE_POLICY = Object.freeze({
  // Crit *rate* is observed on every stat block. What a crit multiplies by is not.
  critMultiplier: 1.6,
  critMultiplierEvidence: "observed",

  // Observed: Solidity -30%, Guard -50%. Not observed: how two of them compose.
  percentReductionStacking: "multiplicative",
  percentReductionStackingEvidence: "gap",

  // Observed: Evade "increases Dodge rate by 60%", Conceal "+80% Dodge". Not observed:
  // whether a count above 1 stacks the bonus or just buys more turns of it.
  evadeDodgeBonus: 60,
  mirrorImageDodgeBonus: 33,
  concealDodgeBonus: 80,
  dodgeBonusStacksWithCount: false,
  dodgeBonusEvidence: "gap",

  // Observed: "Damage received from enemy attacks is reduced." Not observed: by how much.
  // Read as a flat Count, mirroring Steelskin, because both share the decrease-when-hit
  // lifecycle.
  protectionMode: "flat-count",
  protectionModeEvidence: "gap",

  // Vulnerable is a number of exposed hits, not a percentage magnitude: while any stack
  // remains, an incoming landed hit deals 50% more damage and consumes one stack. Limp's
  // exact multiplier remains unresolved and is deliberately kept out of this rule.
  vulnerableDamagePercent: 50,
  vulnerableEvidence: "observed",

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

  // Charged is a temporary CriticalChance stat modifier. It clears at the holder's turn
  // boundary; attacks do not spend a 100-point packet.
  chargedMode: "critical-chance",
  chargedEvidence: "shipped-1.4.16",

  // Berserk is an ATK stat modifier. The encounter resolver clears it after the holder's
  // next attack (AllAttack) or at their turn boundary (AllPerTurn).
  berserkMode: "attack-stat",
  berserkEvidence: "shipped-1.4.16",

  // Witch of Eternity's Bone Shield explicitly reduces direct damage by 60% while a
  // charge remains. The charge lifecycle is owned by status-stack and resolves per hit.
  boneShieldDamageReductionPercent: 60,
  boneShieldEvidence: "observed",

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
  const mirrorImage = statusCount(defender.statuses, "mirror-image");
  const conceal = statusCount(defender.statuses, "conceal");
  const evadeBonus = evade > 0
    ? POLICY.evadeDodgeBonus * (POLICY.dodgeBonusStacksWithCount ? evade : 1)
    : 0;
  const concealBonus = conceal > 0
    ? POLICY.concealDodgeBonus * (POLICY.dodgeBonusStacksWithCount ? conceal : 1)
    : 0;
  const mirrorImageBonus = mirrorImage > 0 ? POLICY.mirrorImageDodgeBonus : 0;
  const restraintPenalty = statusCount(defender.statuses, "restraint") > 0 ? 100 : 0;
  return clampRate(defender.stats.dodgeRate + evadeBonus + concealBonus + mirrorImageBonus - restraintPenalty);
}

function criticalChanceFor(attacker) {
  return clampRate(
    attacker.stats.critRate
      + statusCount(attacker.statuses, "focus")
      + statusCount(attacker.statuses, "charge")
      + statusCount(attacker.statuses, "covert"),
  );
}

function criticalMultiplierFor(attacker) {
  return POLICY.critMultiplier + (statusCount(attacker.statuses, "sharpen") / 100);
}

function percentMultiplierFor(defender) {
  let multiplier = 1;
  if (statusCount(defender.statuses, "guard") > 0) multiplier *= 0.5;
  if (statusCount(defender.statuses, "solidity") > 0) multiplier *= 0.7;
  if (statusCount(defender.statuses, "bone-shield") > 0) {
    multiplier *= 1 - (POLICY.boneShieldDamageReductionPercent / 100);
  }
  const persist = statusCount(defender.statuses, "persist");
  if (persist > 0) multiplier *= Math.max(0, 1 - (persist / 100));
  return multiplier;
}

function flatReductionFor(defender) {
  const steelskin = statusCount(defender.statuses, "steelskin");
  const protection = POLICY.protectionMode === "flat-count"
    ? statusCount(defender.statuses, "protection")
    : 0;
  return steelskin + protection + statusCount(defender.statuses, "parry");
}

function vulnerableMultiplierFor(defender) {
  const vulnerable = statusCount(defender.statuses, "vulnerable");
  const weak = statusCount(defender.statuses, "weak");
  const limp = statusCount(defender.statuses, "limp");
  return (vulnerable > 0 ? 1 + (POLICY.vulnerableDamagePercent / 100) : 1)
    * (weak > 0 ? 1.3 : 1)
    * (1 + (limp / 100));
}

function mitigationSnapshot(defender) {
  return {
    invincible: statusCount(defender.statuses, "invincible") > 0,
    guard: statusCount(defender.statuses, "guard") > 0,
    solidity: statusCount(defender.statuses, "solidity") > 0,
    steelskin: statusCount(defender.statuses, "steelskin"),
    protection: statusCount(defender.statuses, "protection"),
    parry: statusCount(defender.statuses, "parry"),
    persist: statusCount(defender.statuses, "persist"),
    weak: statusCount(defender.statuses, "weak"),
    vulnerable: statusCount(defender.statuses, "vulnerable"),
    boneShield: statusCount(defender.statuses, "bone-shield") > 0,
    limp: statusCount(defender.statuses, "limp"),
  };
}

function statusChanges(before, after) {
  const types = new Set([
    ...(before || []).map((entry) => entry.type),
    ...(after || []).map((entry) => entry.type),
  ]);
  return [...types].flatMap((type) => {
    const previous = statusCount(before, type);
    const next = statusCount(after, type);
    return previous === next ? [] : [{ type, before: previous, after: next }];
  });
}

function applyOnHitPassives(attacker, defender, directDamage) {
  let nextAttacker = attacker;
  let nextDefender = defender;
  const applied = [];

  for (const [attackStatus, targetStatus] of [
    ["doom-atk", "doom"],
    ["judgment", "doom"],
    ["poison-atk", "poison"],
    ["bleed-atk", "bleed"],
    ["lethargy-atk", "lethargy"],
    ["eviscerate", "limp"],
    ["death-claw", "limp"],
  ]) {
    const count = statusCount(nextAttacker.statuses, attackStatus);
    if (count <= 0) continue;
    nextDefender = {
      ...nextDefender,
      statuses: applyStatus(nextDefender.statuses, targetStatus, count),
    };
    applied.push({ status: targetStatus, count });
  }

  let lifestealHeal = 0;
  const lifesteal = statusCount(nextAttacker.statuses, "lifesteal")
    + statusCount(nextAttacker.statuses, "predator");
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
    judgmentDamage: 0,
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
      mirrorImage: statusCount(currentDefender.statuses, "mirror-image") > 0,
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
        statusChanges: { attacker: [], defender: [] },
      });
      continue;
    }

    const critRoll = nextInt(currentRng, 1, 100);
    currentRng = critRoll.rng;
    const attackerStatusesBefore = currentAttacker.statuses;
    const defenderStatusesBefore = currentDefender.statuses;
    const critical = critRoll.value <= criticalChanceFor(currentAttacker);

    const afterCritical = attack.damage * (critical ? criticalMultiplierFor(currentAttacker) : 1);
    const defenderSleep = statusCount(currentDefender.statuses, "sleep");
    const rawDamage = Math.floor(afterCritical);
    const berserkBonus = 0;
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
      thorn = statusCount(currentDefender.statuses, "thorn")
        + statusCount(currentDefender.statuses, "counter-attack");
      if (thorn > 0) {
        const retaliation = applyDamage(currentAttacker, thorn);
        currentAttacker = retaliation.actor;
      }
    }

    currentDefender = {
      ...currentDefender,
      statuses: decrementOnHit(currentDefender.statuses),
    };
    if (defenderSleep > 0) {
      currentDefender = {
        ...currentDefender,
        statuses: removeStatus(currentDefender.statuses, "sleep"),
      };
    }
    const passive = applyOnHitPassives(currentAttacker, currentDefender, damage);
    currentAttacker = passive.attacker;
    currentDefender = passive.defender;

    const perHitStatusChanges = {
      attacker: statusChanges(attackerStatusesBefore, currentAttacker.statuses),
      defender: statusChanges(defenderStatusesBefore, currentDefender.statuses),
    };

    hits.push({
      index,
      dodged: false,
      critical,
      baseDamage: attack.damage,
      rawDamage,
      berserkBonus,
      berserkSpent: 0,
      defenderBerserkSpent: 0,
      sleepBroken: defenderSleep,
      vulnerableBonus,
      vulnerablePercent: mitigation.vulnerable > 0 ? POLICY.vulnerableDamagePercent : 0,
      prevented: Math.max(0, rawDamage + vulnerableBonus - damage),
      mitigation,
      avoidance,
      damage,
      absorbed: landed.absorbed,
      toHp: landed.toHp,
      thorn,
      chargeSpent: 0,
      onHitStatuses: passive.applied,
      judgmentDamage: passive.judgmentDamage,
      lifestealHeal: passive.lifestealHeal,
      priorityGained: passive.priorityGained,
      statusChanges: perHitStatusChanges,
    });
  }

  // AllAttack statuses affect the complete authored attack, including every hit, then
  // clear in full. They never disappear merely because their holder was struck.
  const attackStatuses = ["berserk", "predator", "judgment"].reduce(
    (statuses, type) => removeStatus(statuses, type),
    currentAttacker.statuses,
  );
  return {
    attacker: { ...currentAttacker, statuses: attackStatuses },
    defender: currentDefender,
    rng: currentRng,
    hits,
  };
}
