const DIRECT_DAMAGE_EFFECT_TYPES = new Set([
  "damage",
  "damage-enemy-lost-hp",
  "damage-self-lost-hp",
]);

export const TOW_DAMAGING_STATUS_TYPES = Object.freeze([
  "bleed",
  "burn",
  "doom",
  "fatal-blade",
  "hellfire-spirit",
  "misfortune",
  "poison",
  "void-monster",
]);

const DAMAGING_STATUS_TYPES = new Set(TOW_DAMAGING_STATUS_TYPES);
const DAMAGING_STATUS_EFFECT_TYPES = new Set([
  "scale-status",
  "scaled-status",
  "scaled-status-enemy-lost-hp",
  "status",
  "status-from-status",
]);

export const TOW_COMBAT_BALANCE_POLICY = Object.freeze({
  directSkillDamageFraction: 0.45,
  maxHpSkillDamageFraction: 0.35,
  damagingStatusFraction: 0.30,
  delayedSkillDamageFraction: 0.65,
  temporaryMaxHpFraction: 0.50,
});

function percent(fraction) {
  return Math.round(fraction * 100);
}

export function combatPolicyClausesForSkill(definition) {
  const effects = Array.isArray(definition?.effects) ? definition.effects : [];
  const clauses = [];
  if (effects.some((effect) => DIRECT_DAMAGE_EFFECT_TYPES.has(effect.type))) {
    clauses.push(
      `Resolve combat: total base damage before criticals is capped at ${percent(TOW_COMBAT_BALANCE_POLICY.directSkillDamageFraction)}% of the target's maximum health`,
    );
  }
  if (effects.some((effect) => (
    DAMAGING_STATUS_EFFECT_TYPES.has(effect.type)
    && (
      DAMAGING_STATUS_TYPES.has(effect.status)
      || effect.statuses?.some((status) => DAMAGING_STATUS_TYPES.has(status))
    )
  ))) {
    clauses.push(
      `Resolve combat: damaging statuses are capped at ${percent(TOW_COMBAT_BALANCE_POLICY.damagingStatusFraction)}% of the target's maximum health`,
    );
  }
  if (effects.some((effect) => (
    effect.type === "delayed-damage" && effect.target !== "self"
  ))) {
    clauses.push(
      `Resolve combat: delayed damage is capped at ${percent(TOW_COMBAT_BALANCE_POLICY.delayedSkillDamageFraction)}% of the target's maximum health`,
    );
  }
  if (effects.some((effect) => effect.type === "temporary-max-hp")) {
    clauses.push(
      `Resolve combat: temporary maximum health is capped at ${percent(TOW_COMBAT_BALANCE_POLICY.temporaryMaxHpFraction)}% of the caster's current maximum health`,
    );
  }
  return clauses;
}
