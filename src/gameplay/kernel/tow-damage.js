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
import { decrementOnHit, statusCount } from "./status-stack.js";

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

  rounding: "floor",
  roundingEvidence: "gap",

  order: Object.freeze([
    "dodge-roll",
    "crit-roll",
    "invincible-check",
    "percent-reduction",
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

    const dodgeRoll = nextInt(currentRng, 1, 100);
    currentRng = dodgeRoll.rng;
    const dodged = dodgeRoll.value <= dodgeChanceFor(currentDefender);

    if (dodged) {
      if (POLICY.dodgeSpendsOnHitStatuses) {
        currentDefender = {
          ...currentDefender,
          statuses: decrementOnHit(currentDefender.statuses),
        };
      }
      hits.push({ index, dodged: true, critical: false, damage: 0, absorbed: 0, toHp: 0, thorn: 0 });
      continue;
    }

    const critRoll = nextInt(currentRng, 1, 100);
    currentRng = critRoll.rng;
    const critical = critRoll.value <= currentAttacker.stats.critRate;

    let damage = attack.damage * (critical ? POLICY.critMultiplier : 1);
    if (statusCount(currentDefender.statuses, "invincible") > 0) {
      damage = 0;
    } else {
      damage = Math.floor(damage * percentMultiplierFor(currentDefender));
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

    hits.push({
      index,
      dodged: false,
      critical,
      damage,
      absorbed: landed.absorbed,
      toHp: landed.toHp,
      thorn,
    });
  }

  return { attacker: currentAttacker, defender: currentDefender, rng: currentRng, hits };
}
