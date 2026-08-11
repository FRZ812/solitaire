import { cloneJsonData, equalJsonData } from "./json-data.js";

const MAX_RULE_ACTIONS = 16;
const MAX_RULE_IDENTIFIER_LENGTH = 128;
const MAX_RULE_NAME_LENGTH = 128;
const MAX_RULE_SCALAR = 1_000_000;
const RULE_KEYS = Object.freeze(["actions", "id", "version"]);
const ACTION_KEYS = Object.freeze(["consumesTurn", "effect", "id", "name", "target"]);
const DAMAGE_EFFECT_KEYS = Object.freeze(["multiplier", "stat", "type", "variance"]);
const MITIGATED_DAMAGE_EFFECT_KEYS = Object.freeze([
  "mitigationStat",
  "multiplier",
  "stat",
  "type",
  "variance",
]);
const DEFEND_EFFECT_KEYS = Object.freeze(["base", "multiplier", "stat", "type"]);
const VARIANCE_KEYS = Object.freeze(["max", "min"]);

function exactKeys(value, keys) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && equalJsonData(Object.keys(value).sort(), keys);
}

function identifier(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= MAX_RULE_IDENTIFIER_LENGTH;
}

function boundedScalar(value) {
  return typeof value === "number"
    && Number.isFinite(value)
    && Math.abs(value) <= MAX_RULE_SCALAR;
}

function validDamageEffect(effect) {
  const hasMitigation = Object.hasOwn(effect, "mitigationStat");
  return exactKeys(effect, hasMitigation ? MITIGATED_DAMAGE_EFFECT_KEYS : DAMAGE_EFFECT_KEYS)
    && effect.type === "damage"
    && effect.stat === "attack"
    && (!hasMitigation || effect.mitigationStat === "defense")
    && boundedScalar(effect.multiplier)
    && effect.multiplier >= 0
    && exactKeys(effect.variance, VARIANCE_KEYS)
    && Number.isSafeInteger(effect.variance.min)
    && Number.isSafeInteger(effect.variance.max)
    && effect.variance.min >= -MAX_RULE_SCALAR
    && effect.variance.max <= MAX_RULE_SCALAR
    && effect.variance.max >= effect.variance.min;
}

function validDefendEffect(effect) {
  return exactKeys(effect, DEFEND_EFFECT_KEYS)
    && effect.type === "defend"
    && effect.stat === "defense"
    && boundedScalar(effect.base)
    && effect.base >= 0
    && boundedScalar(effect.multiplier)
    && effect.multiplier >= 0;
}

function validAction(action) {
  if (
    !exactKeys(action, ACTION_KEYS)
    || !identifier(action.id)
    || typeof action.name !== "string"
    || action.name.length < 1
    || action.name.length > MAX_RULE_NAME_LENGTH
    || typeof action.consumesTurn !== "boolean"
    || !["enemy", "self"].includes(action.target)
  ) return false;
  if (action.effect?.type === "damage") {
    return action.target === "enemy" && validDamageEffect(action.effect);
  }
  if (action.effect?.type === "defend") {
    return action.target === "self" && validDefendEffect(action.effect);
  }
  return false;
}

export function snapshotCombatRules(value) {
  let rules;
  try {
    rules = cloneJsonData(value, "invalid-combat-rules");
  } catch {
    return null;
  }
  if (
    !exactKeys(rules, RULE_KEYS)
    || rules.version !== 1
    || !identifier(rules.id)
    || !Array.isArray(rules.actions)
    || rules.actions.length < 1
    || rules.actions.length > MAX_RULE_ACTIONS
    || !rules.actions.every(validAction)
  ) return null;
  const ids = rules.actions.map((action) => action.id);
  return new Set(ids).size === ids.length ? rules : null;
}

export function isCombatRules(value) {
  return snapshotCombatRules(value) !== null;
}

export function getCombatRuleAction(value, actionId) {
  if (typeof actionId !== "string") return null;
  const rules = snapshotCombatRules(value);
  return rules?.actions.find((action) => action.id === actionId) || null;
}
