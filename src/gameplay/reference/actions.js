import { REFERENCE_POLICY } from "./policy.js";

export const BASIC_ATTACK = Object.freeze({
  id: "basic-attack",
  name: "Attack",
  consumesTurn: true,
  target: "enemy",
  effect: Object.freeze({
    type: "damage",
    stat: "attack",
    multiplier: REFERENCE_POLICY.damage.attackStatMultiplier,
    variance: REFERENCE_POLICY.damage.basicAttackVariance,
  }),
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

const ACTIONS = Object.freeze({
  [BASIC_ATTACK.id]: BASIC_ATTACK,
  [BASIC_DEFENSE.id]: BASIC_DEFENSE,
});

export function getReferenceAction(actionId) {
  return ACTIONS[actionId] || null;
}
