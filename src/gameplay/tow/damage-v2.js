// Deterministic single-packet damage authority for solitaire-tow-v2.
//
// The caller resolves authored rank scaling before constructing a packet. This authority
// applies v2 status pressure, consumes a fixed random-draw budget, mitigates one individual
// hit, and returns immutable actor snapshots. Multi-hit actions call it once per authored
// damage effect so dodge, criticals, shields, reflection, lifesteal, and hit-spent statuses
// never collapse into an aggregate shortcut.

import {
  TOW_ABILITY_RULESET_V2_ID,
  TOW_ABILITY_RULES_V2_VERSION,
} from "./ability-rules-v2.js";
import {
  TOW_ACTOR_SCALAR_MAX_V2,
  isTowActorV2,
} from "./actor-v2.js";
import {
  TOW_STATUS_POLICY_V2_CHECKSUM,
  isTowStatusRuntimeV2,
  resolveTowDirectHitStatusesV2,
  towStatusCombatModifiersV2,
} from "./status-runtime-v2.js";

export const TOW_DAMAGE_KINDS_V2 = Object.freeze(["direct", "periodic"]);
export const TOW_DAMAGE_MAX_V2 = 1_000_000_000;
export const TOW_DAMAGE_ATTACK_SCALE_MAX_BPS_V2 = 100_000;
export const TOW_DAMAGE_ACTOR_SCALAR_MAX_V2 = TOW_ACTOR_SCALAR_MAX_V2;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export const TOW_DAMAGE_POLICY_V2 = deepFreeze({
  version: TOW_ABILITY_RULES_V2_VERSION,
  rulesetId: TOW_ABILITY_RULESET_V2_ID,
  packetKinds: TOW_DAMAGE_KINDS_V2,
  maximumPacketDamage: TOW_DAMAGE_MAX_V2,
  maximumAttackScaleBps: TOW_DAMAGE_ATTACK_SCALE_MAX_BPS_V2,
  maximumActorScalar: TOW_DAMAGE_ACTOR_SCALAR_MAX_V2,
  rates: {
    basisPoints: 10_000,
    minimum: 0,
    maximum: 10_000,
  },
  direct: {
    randomDrawOrder: ["dodge", "critical"],
    randomDrawsPerPacket: 2,
    consumeAllDrawsBeforeBranching: true,
    criticalMultiplierBps: 16_000,
    defenseFormula: "floor(amount*10000/(10000+defense*100))",
    statusPercentReductionStacking: "multiplicative",
    redirectSelection: "greatest-single-policy",
    shieldOrder: "after-mitigation-before-hp",
    landedContact: "not-dodged-even-when-zero-damage",
  },
  periodic: {
    randomDrawsPerPacket: 0,
    bypasses: [
      "avoidance",
      "critical",
      "defense",
      "status-flat-mitigation",
      "status-percent-mitigation",
      "redirect",
      "shield",
      "lifesteal",
      "reflection",
      "direct-hit-status-hooks",
    ],
    target: "hp-only",
  },
  lifesteal: {
    basis: "hp-damage-only",
    capBps: 10_000,
    rounding: "floor",
    defeatedSourceReceivesHealing: false,
  },
  reflection: {
    trigger: "landed-direct-contact",
    basis: "flat-status-magnitude",
    target: "source-shield-then-hp",
    bypasses: ["avoidance", "critical", "defense", "status-mitigation", "redirect"],
    recursive: false,
    grantsLifesteal: false,
    opensDirectHitHooks: false,
  },
  rounding: "floor-after-each-multiplicative-stage",
  directOrder: [
    "consume-dodge-draw",
    "consume-critical-draw",
    "dodge-check",
    "scaled-outgoing-status-attack-delta",
    "critical-multiplier",
    "defense-mitigation",
    "status-flat-mitigation",
    "status-percent-mitigation",
    "damage-redirect",
    "shield-absorb",
    "hp-damage",
    "lifesteal",
    "reflection",
    "direct-hit-status-hooks",
  ],
  statusPolicyChecksum: TOW_STATUS_POLICY_V2_CHECKSUM,
});

const INPUT_KEYS = Object.freeze([
  "packet",
  "randomDraws",
  "source",
  "statuses",
  "target",
].sort());
const PACKET_KEYS = Object.freeze(["amount", "attackScaleBps", "kind"].sort());

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === expected.length
    && keys.every((key, index) => key === expected[index]);
}

function validActor(value) {
  return isTowActorV2(value);
}

export function validateTowDamageActorV2(value) {
  return Object.freeze({
    ok: validActor(value),
    reason: validActor(value) ? null : "invalid-damage-v2-actor",
  });
}

export function isTowDamageActorV2(value) {
  return validActor(value);
}

function cloneActor(actor) {
  return actor === null ? null : {
    version: actor.version,
    rulesetId: actor.rulesetId,
    id: actor.id,
    name: actor.name,
    side: actor.side,
    controller: actor.controller,
    aiProfile: actor.aiProfile === null ? null : { ...actor.aiProfile },
    preferredRow: actor.preferredRow,
    hp: actor.hp,
    maxHp: actor.maxHp,
    shield: actor.shield,
    stats: { ...actor.stats },
    loadout: actor.loadout.map((ability) => ({ ...ability })),
  };
}

function stableSerialize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  return `{${Object.keys(value).sort().map(
    (key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`,
  ).join(",")}}`;
}

function fnv1a32(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function calculateTowDamagePolicyV2Checksum() {
  return `fnv1a32:${fnv1a32(stableSerialize(TOW_DAMAGE_POLICY_V2))}`;
}

// Literal is checked by tests so formula or ordering drift cannot be accidental.
export const TOW_DAMAGE_POLICY_V2_CHECKSUM = "fnv1a32:f41dd5bb";

function clampRate(value) {
  return Math.max(
    TOW_DAMAGE_POLICY_V2.rates.minimum,
    Math.min(TOW_DAMAGE_POLICY_V2.rates.maximum, value),
  );
}

function applyShieldThenHp(actor, amount) {
  const absorbed = Math.min(actor.shield, amount);
  const hpDamage = Math.min(actor.hp, amount - absorbed);
  return {
    actor: {
      ...cloneActor(actor),
      shield: actor.shield - absorbed,
      hp: actor.hp - hpDamage,
    },
    absorbed,
    hpDamage,
  };
}

function applyHpOnly(actor, amount) {
  const hpDamage = Math.min(actor.hp, amount);
  return {
    actor: { ...cloneActor(actor), hp: actor.hp - hpDamage },
    hpDamage,
  };
}

function invalid(reason) {
  return deepFreeze({
    ok: false,
    reason,
    source: null,
    target: null,
    statuses: null,
    outcome: null,
  });
}

function validInput(input) {
  if (!exactKeys(input, INPUT_KEYS)
    || !validActor(input.target)
    || !isTowStatusRuntimeV2(input.statuses)
    || !Object.hasOwn(input.statuses.actors, input.target.id)
    || !exactKeys(input.packet, PACKET_KEYS)
    || !TOW_DAMAGE_KINDS_V2.includes(input.packet.kind)
    || !Number.isSafeInteger(input.packet.amount)
    || input.packet.amount < 0
    || input.packet.amount > TOW_DAMAGE_MAX_V2
    || !Number.isSafeInteger(input.packet.attackScaleBps)
    || input.packet.attackScaleBps < 0
    || input.packet.attackScaleBps > TOW_DAMAGE_ATTACK_SCALE_MAX_BPS_V2
    || (input.packet.kind === "periodic" && input.packet.attackScaleBps !== 0)
    || input.target.hp === 0
    || !Array.isArray(input.randomDraws)) {
    return "invalid-damage-v2-input";
  }
  if (input.packet.kind === "direct") {
    if (!validActor(input.source)
      || input.source.id === input.target.id
      || input.source.hp === 0
      || !Object.hasOwn(input.statuses.actors, input.source.id)
      || input.randomDraws.length !== TOW_DAMAGE_POLICY_V2.direct.randomDrawsPerPacket
      || input.randomDraws.some((draw) => !Number.isSafeInteger(draw) || draw < 0 || draw >= 10_000)) {
      return "invalid-direct-damage-v2-input";
    }
  } else if (input.source !== null
    || input.randomDraws.length !== TOW_DAMAGE_POLICY_V2.periodic.randomDrawsPerPacket) {
    return "invalid-periodic-damage-v2-input";
  }
  return null;
}

function periodicDamage(input) {
  const applied = applyHpOnly(input.target, input.packet.amount);
  const outcome = deepFreeze({
    kind: "periodic",
    sourceActorId: null,
    targetActorId: input.target.id,
    baseDamage: input.packet.amount,
    drawsConsumed: 0,
    dodgeRoll: null,
    criticalRoll: null,
    dodgeChanceBps: 0,
    criticalChanceBps: 0,
    dodged: false,
    critical: false,
    attackDelta: 0,
    attackScaleBps: 0,
    scaledAttackDelta: 0,
    defense: 0,
    afterAttackDelta: input.packet.amount,
    afterCritical: input.packet.amount,
    afterDefense: input.packet.amount,
    afterFlatReduction: input.packet.amount,
    afterPercentReduction: input.packet.amount,
    redirected: 0,
    shieldAbsorbed: 0,
    hpDamage: applied.hpDamage,
    lifestealHealed: 0,
    reflected: 0,
    reflectionShieldAbsorbed: 0,
    reflectionHpDamage: 0,
    statusMutations: [],
  });
  return deepFreeze({
    ok: true,
    reason: null,
    source: null,
    target: applied.actor,
    statuses: input.statuses,
    outcome,
  });
}

function directDamage(input) {
  const sourceModifiers = towStatusCombatModifiersV2(input.statuses, input.source.id);
  const targetModifiers = towStatusCombatModifiersV2(input.statuses, input.target.id);
  const dodgeRoll = input.randomDraws[0];
  const criticalRoll = input.randomDraws[1];
  const dodgeChanceBps = clampRate(
    input.target.stats.dodgeChanceBps + targetModifiers.avoidanceBonusBps,
  );
  const criticalChanceBps = clampRate(
    input.source.stats.critChanceBps + sourceModifiers.criticalChanceBonusBps,
  );
  const dodged = dodgeRoll < dodgeChanceBps;
  const critical = !dodged && criticalRoll < criticalChanceBps;

  if (dodged) {
    const statusResult = resolveTowDirectHitStatusesV2(input.statuses, {
      attackerActorId: input.source.id,
      defenderActorId: input.target.id,
      landed: false,
    });
    const outcome = deepFreeze({
      kind: "direct",
      sourceActorId: input.source.id,
      targetActorId: input.target.id,
      baseDamage: input.packet.amount,
      drawsConsumed: 2,
      dodgeRoll,
      criticalRoll,
      dodgeChanceBps,
      criticalChanceBps,
      dodged: true,
      critical: false,
      attackDelta: sourceModifiers.attackDelta,
      attackScaleBps: input.packet.attackScaleBps,
      scaledAttackDelta: 0,
      defense: Math.max(0, input.target.stats.defense + targetModifiers.defenseDelta),
      afterAttackDelta: 0,
      afterCritical: 0,
      afterDefense: 0,
      afterFlatReduction: 0,
      afterPercentReduction: 0,
      redirected: 0,
      shieldAbsorbed: 0,
      hpDamage: 0,
      lifestealHealed: 0,
      reflected: 0,
      reflectionShieldAbsorbed: 0,
      reflectionHpDamage: 0,
      statusMutations: statusResult.event.mutations,
    });
    return deepFreeze({
      ok: true,
      reason: null,
      source: cloneActor(input.source),
      target: cloneActor(input.target),
      statuses: statusResult.state,
      outcome,
    });
  }

  const scaledAttackDelta = Math.floor(
    (sourceModifiers.attackDelta * input.packet.attackScaleBps) / 10_000,
  );
  const afterAttackDelta = Math.max(0, input.packet.amount + scaledAttackDelta);
  const afterCritical = critical
    ? Math.floor((afterAttackDelta * TOW_DAMAGE_POLICY_V2.direct.criticalMultiplierBps) / 10_000)
    : afterAttackDelta;
  const defense = Math.max(0, input.target.stats.defense + targetModifiers.defenseDelta);
  const afterDefense = Math.floor(
    (afterCritical * 10_000) / (10_000 + (defense * 100)),
  );
  const afterFlatReduction = Math.max(
    0,
    afterDefense - targetModifiers.directFlatReduction,
  );
  const afterPercentReduction = Math.floor(
    (afterFlatReduction * (10_000 - Math.min(10_000, targetModifiers.directReductionBps)))
      / 10_000,
  );
  const redirected = Math.floor(
    (afterPercentReduction * Math.min(10_000, targetModifiers.redirectBps)) / 10_000,
  );
  const delivered = afterPercentReduction - redirected;
  const landed = applyShieldThenHp(input.target, delivered);
  let nextSource = cloneActor(input.source);
  let lifestealHealed = 0;
  const lifestealBps = Math.min(
    TOW_DAMAGE_POLICY_V2.lifesteal.capBps,
    Math.max(0, sourceModifiers.lifestealBps),
  );
  if (nextSource.hp > 0 && landed.hpDamage > 0 && lifestealBps > 0) {
    lifestealHealed = Math.min(
      nextSource.maxHp - nextSource.hp,
      Math.floor((landed.hpDamage * lifestealBps) / 10_000),
    );
    nextSource = { ...nextSource, hp: nextSource.hp + lifestealHealed };
  }

  const reflected = Math.max(0, targetModifiers.reflectionDamage);
  let reflectionShieldAbsorbed = 0;
  let reflectionHpDamage = 0;
  if (reflected > 0) {
    const retaliation = applyShieldThenHp(nextSource, reflected);
    nextSource = retaliation.actor;
    reflectionShieldAbsorbed = retaliation.absorbed;
    reflectionHpDamage = retaliation.hpDamage;
  }

  const statusResult = resolveTowDirectHitStatusesV2(input.statuses, {
    attackerActorId: input.source.id,
    defenderActorId: input.target.id,
    landed: true,
  });
  const outcome = deepFreeze({
    kind: "direct",
    sourceActorId: input.source.id,
    targetActorId: input.target.id,
    baseDamage: input.packet.amount,
    drawsConsumed: 2,
    dodgeRoll,
    criticalRoll,
    dodgeChanceBps,
    criticalChanceBps,
    dodged: false,
    critical,
    attackDelta: sourceModifiers.attackDelta,
    attackScaleBps: input.packet.attackScaleBps,
    scaledAttackDelta,
    defense,
    afterAttackDelta,
    afterCritical,
    afterDefense,
    afterFlatReduction,
    afterPercentReduction,
    redirected,
    shieldAbsorbed: landed.absorbed,
    hpDamage: landed.hpDamage,
    lifestealHealed,
    reflected,
    reflectionShieldAbsorbed,
    reflectionHpDamage,
    statusMutations: statusResult.event.mutations,
  });
  return deepFreeze({
    ok: true,
    reason: null,
    source: nextSource,
    target: landed.actor,
    statuses: statusResult.state,
    outcome,
  });
}

export function resolveTowDamageV2(input) {
  const reason = validInput(input);
  if (reason !== null) return invalid(reason);
  return input.packet.kind === "periodic" ? periodicDamage(input) : directDamage(input);
}
