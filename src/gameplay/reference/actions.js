import { REFERENCE_POLICY } from "./policy.js";

const ACTION_REPLACEMENT_SOURCE = Object.freeze({
  confidence: "secondary",
  date: "2023-09-12",
  url: "https://gall.dcinside.com/mgallery/board/view/?id=combat&no=5666",
  referenceVersion: "guide-current-on-source-date",
});

const UNRESOLVED_REPLACEMENT_EFFECTS = Object.freeze([
  "exact-effect",
  "rank-scaling",
]);

function damageEffect() {
  return Object.freeze({
    type: "damage",
    stat: "attack",
    multiplier: REFERENCE_POLICY.damage.attackStatMultiplier,
    variance: REFERENCE_POLICY.damage.basicAttackVariance,
  });
}

function registry(entries) {
  const value = Object.create(null);
  for (const entry of entries) value[entry.id] = entry;
  return Object.freeze(value);
}

export const BASIC_ATTACK = Object.freeze({
  id: "basic-attack",
  name: "Attack",
  consumesTurn: true,
  target: "enemy",
  effect: damageEffect(),
});

export const BASIC_DEFENSE = Object.freeze({
  id: "basic-defense",
  name: "Defense",
  consumesTurn: true,
  target: "self",
  effect: Object.freeze({
    type: "defend",
    stat: "defense",
    base: REFERENCE_POLICY.defense.base,
    multiplier: REFERENCE_POLICY.defense.defenseStatMultiplier,
  }),
});

export const SHIELD_BASH = Object.freeze({
  id: "shield-bash",
  name: "Shield Bash",
  consumesTurn: true,
  target: "enemy",
  slot: "attack",
  familyId: "shield-bash",
  effect: damageEffect(),
  evidence: ACTION_REPLACEMENT_SOURCE,
  unresolved: UNRESOLVED_REPLACEMENT_EFFECTS,
});

export const SLAUGHTER = Object.freeze({
  id: "slaughter",
  name: "Slaughter",
  consumesTurn: true,
  target: "enemy",
  slot: "attack",
  familyId: "slaughter",
  effect: damageEffect(),
  evidence: ACTION_REPLACEMENT_SOURCE,
  unresolved: UNRESOLVED_REPLACEMENT_EFFECTS,
});

export const SHIELD_BASH_FAMILY = Object.freeze({
  id: "shield-bash",
  slot: "attack",
  replacesActionId: BASIC_ATTACK.id,
  replacementActionId: SHIELD_BASH.id,
  evidence: ACTION_REPLACEMENT_SOURCE,
  unresolved: UNRESOLVED_REPLACEMENT_EFFECTS,
});

export const SLAUGHTER_FAMILY = Object.freeze({
  id: "slaughter",
  slot: "attack",
  replacesActionId: BASIC_ATTACK.id,
  replacementActionId: SLAUGHTER.id,
  evidence: ACTION_REPLACEMENT_SOURCE,
  unresolved: UNRESOLVED_REPLACEMENT_EFFECTS,
});

export const SHIELD_BASH_UPGRADE = Object.freeze({
  id: "shield-bash-upgrade",
  name: "Shield Bash upgrade",
  kind: "upgrade",
  slot: "attack",
  familyId: SHIELD_BASH_FAMILY.id,
  evidence: ACTION_REPLACEMENT_SOURCE,
  unresolved: UNRESOLVED_REPLACEMENT_EFFECTS,
});

export const SLAUGHTER_UPGRADE = Object.freeze({
  id: "slaughter-upgrade",
  name: "Slaughter upgrade",
  kind: "upgrade",
  slot: "attack",
  familyId: SLAUGHTER_FAMILY.id,
  evidence: ACTION_REPLACEMENT_SOURCE,
  unresolved: UNRESOLVED_REPLACEMENT_EFFECTS,
});

export const SHIELD_BASH_REPLACEMENT = Object.freeze({
  id: "shield-bash-replacement",
  name: "Replace Attack with Shield Bash",
  kind: "replacement",
  slot: "attack",
  familyId: SHIELD_BASH_FAMILY.id,
  replacementActionId: SHIELD_BASH.id,
  evidence: ACTION_REPLACEMENT_SOURCE,
  unresolved: UNRESOLVED_REPLACEMENT_EFFECTS,
});

export const SLAUGHTER_REPLACEMENT = Object.freeze({
  id: "slaughter-replacement",
  name: "Replace Attack with Slaughter",
  kind: "replacement",
  slot: "attack",
  familyId: SLAUGHTER_FAMILY.id,
  replacementActionId: SLAUGHTER.id,
  evidence: ACTION_REPLACEMENT_SOURCE,
  unresolved: UNRESOLVED_REPLACEMENT_EFFECTS,
});

const ACTIONS = registry([
  BASIC_ATTACK,
  BASIC_DEFENSE,
  SHIELD_BASH,
  SLAUGHTER,
]);

const ACTION_REPLACEMENT_FAMILIES = registry([
  SHIELD_BASH_FAMILY,
  SLAUGHTER_FAMILY,
]);

const ACTION_PROGRESSION_OFFERS = registry([
  SHIELD_BASH_UPGRADE,
  SLAUGHTER_UPGRADE,
  SHIELD_BASH_REPLACEMENT,
  SLAUGHTER_REPLACEMENT,
]);

export function getReferenceAction(actionId) {
  return typeof actionId === "string" && Object.hasOwn(ACTIONS, actionId)
    ? ACTIONS[actionId]
    : null;
}

export function getActionReplacementFamily(familyId) {
  return typeof familyId === "string" && Object.hasOwn(ACTION_REPLACEMENT_FAMILIES, familyId)
    ? ACTION_REPLACEMENT_FAMILIES[familyId]
    : null;
}

export function getActionProgressionOffer(offerId) {
  return typeof offerId === "string" && Object.hasOwn(ACTION_PROGRESSION_OFFERS, offerId)
    ? ACTION_PROGRESSION_OFFERS[offerId]
    : null;
}
