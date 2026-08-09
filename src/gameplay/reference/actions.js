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

const ACTIONS = Object.freeze({
  [BASIC_ATTACK.id]: BASIC_ATTACK,
});

export function getReferenceAction(actionId) {
  return ACTIONS[actionId] || null;
}
