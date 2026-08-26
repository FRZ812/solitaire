// Strict actor snapshots for solitaire-tow-v2.
//
// Every combat-relevant identity, stat, resource, loadout rank, preferred formation row,
// and controller profile is explicit. There is intentionally no bridge from v1 builds,
// professions, templates, or legacy skill grants.

import {
  TOW_ABILITY_RULESET_V2_ID,
  TOW_ABILITY_RULES_V2_VERSION,
} from "./ability-rules-v2.js";
import { getTowAbilityRulesV2 } from "./ability-catalog-v2.js";

export const TOW_ACTOR_SIDES_V2 = Object.freeze(["player", "enemy"]);
export const TOW_ACTOR_CONTROLLERS_V2 = Object.freeze(["human", "ai"]);
export const TOW_ACTOR_PREFERRED_ROWS_V2 = Object.freeze([0, 1, 2]);
export const TOW_ACTOR_SCALAR_MAX_V2 = 1_000_000_000;

const ACTOR_KEYS = Object.freeze([
  "aiProfile",
  "controller",
  "hp",
  "id",
  "loadout",
  "maxHp",
  "name",
  "preferredRow",
  "rulesetId",
  "shield",
  "side",
  "stats",
  "version",
].sort());
const CREATE_KEYS = Object.freeze(ACTOR_KEYS.filter((key) => (
  key !== "version" && key !== "rulesetId"
)));
const STATS_KEYS = Object.freeze([
  "attack",
  "critChanceBps",
  "defense",
  "dodgeChanceBps",
  "speed",
].sort());
const LOADOUT_KEYS = Object.freeze(["id", "rank"].sort());
const AI_PROFILE_KEYS = Object.freeze(["id", "version"].sort());

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === expected.length
    && keys.every((key, index) => key === expected[index]);
}

function actorIdentifier(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 256;
}

function rulesIdentifier(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 128
    && /^[a-z0-9][a-z0-9-]*$/.test(value);
}

function canonicalName(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 120
    && value === value.trim();
}

function nonNegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function positiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function compareIdentifiers(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function profileReason(controller, profile) {
  if (controller === "human") return profile === null ? null : "invalid-actor-v2-ai-profile";
  if (!exactKeys(profile, AI_PROFILE_KEYS)
    || !rulesIdentifier(profile.id)
    || !positiveSafeInteger(profile.version)) {
    return "invalid-actor-v2-ai-profile";
  }
  return null;
}

function loadoutReason(loadout, { canonical = true } = {}) {
  if (!Array.isArray(loadout) || loadout.length === 0) return "invalid-actor-v2-loadout";
  const ids = [];
  for (const ability of loadout) {
    if (!exactKeys(ability, LOADOUT_KEYS)
      || !rulesIdentifier(ability.id)
      || !positiveSafeInteger(ability.rank)) return "invalid-actor-v2-loadout";
    const definition = getTowAbilityRulesV2(ability.id);
    if (!definition || ability.rank > definition.rankCount) {
      return "invalid-actor-v2-ability-rank";
    }
    ids.push(ability.id);
  }
  if (new Set(ids).size !== ids.length) return "duplicate-actor-v2-ability";
  if (canonical && ids.some((id, index) => (
    index > 0 && compareIdentifiers(ids[index - 1], id) >= 0
  ))) return "noncanonical-actor-v2-loadout";
  return null;
}

function actorReason(value) {
  if (!exactKeys(value, ACTOR_KEYS)) return "invalid-actor-v2-shape";
  if (value.version !== TOW_ABILITY_RULES_V2_VERSION
    || value.rulesetId !== TOW_ABILITY_RULESET_V2_ID) return "invalid-actor-v2-ruleset";
  if (!actorIdentifier(value.id) || !canonicalName(value.name)) {
    return "invalid-actor-v2-identity";
  }
  if (!TOW_ACTOR_SIDES_V2.includes(value.side)
    || !TOW_ACTOR_CONTROLLERS_V2.includes(value.controller)
    || !TOW_ACTOR_PREFERRED_ROWS_V2.includes(value.preferredRow)) {
    return "invalid-actor-v2-role";
  }
  const profile = profileReason(value.controller, value.aiProfile);
  if (profile) return profile;
  if (!positiveSafeInteger(value.maxHp)
    || value.maxHp > TOW_ACTOR_SCALAR_MAX_V2
    || !nonNegativeSafeInteger(value.hp) || value.hp > value.maxHp
    || !nonNegativeSafeInteger(value.shield)
    || value.shield > TOW_ACTOR_SCALAR_MAX_V2) return "invalid-actor-v2-vitals";
  if (!exactKeys(value.stats, STATS_KEYS)
    || !nonNegativeSafeInteger(value.stats.attack)
    || value.stats.attack > TOW_ACTOR_SCALAR_MAX_V2
    || !nonNegativeSafeInteger(value.stats.defense)
    || value.stats.defense > TOW_ACTOR_SCALAR_MAX_V2
    || !nonNegativeSafeInteger(value.stats.critChanceBps)
    || value.stats.critChanceBps > 10_000
    || !nonNegativeSafeInteger(value.stats.dodgeChanceBps)
    || value.stats.dodgeChanceBps > 10_000
    || !positiveSafeInteger(value.stats.speed)) return "invalid-actor-v2-stats";
  return loadoutReason(value.loadout);
}

function cloneActor(value) {
  return {
    version: value.version,
    rulesetId: value.rulesetId,
    id: value.id,
    name: value.name,
    side: value.side,
    controller: value.controller,
    aiProfile: value.aiProfile === null ? null : { ...value.aiProfile },
    preferredRow: value.preferredRow,
    hp: value.hp,
    maxHp: value.maxHp,
    shield: value.shield,
    stats: { ...value.stats },
    loadout: value.loadout.map((ability) => ({ ...ability })),
  };
}

function result(ok, reason, actor = null) {
  return deepFreeze({ ok, reason, actor });
}

export function validateTowActorV2(value) {
  const reason = actorReason(value);
  return Object.freeze({ ok: reason === null, reason });
}

export function isTowActorV2(value) {
  return validateTowActorV2(value).ok;
}

/** Validate, detach, and deeply freeze one complete actor snapshot. */
export function defineTowActorV2(value) {
  const validation = validateTowActorV2(value);
  if (!validation.ok) throw new TypeError(validation.reason);
  return deepFreeze(cloneActor(value));
}

/** Create a canonical snapshot from explicit genesis input; no gameplay field is inferred. */
export function createTowActorV2(input) {
  if (!exactKeys(input, CREATE_KEYS)) return result(false, "invalid-actor-v2-create-input");
  const loadout = Array.isArray(input.loadout)
    ? input.loadout.map((ability) => ({ ...ability }))
      .sort((left, right) => compareIdentifiers(left.id, right.id))
    : input.loadout;
  const candidate = {
    version: TOW_ABILITY_RULES_V2_VERSION,
    rulesetId: TOW_ABILITY_RULESET_V2_ID,
    ...input,
    aiProfile: input.aiProfile === null ? null : { ...input.aiProfile },
    stats: input.stats && typeof input.stats === "object" ? { ...input.stats } : input.stats,
    loadout,
  };
  const validation = validateTowActorV2(candidate);
  return validation.ok
    ? result(true, null, deepFreeze(cloneActor(candidate)))
    : result(false, validation.reason);
}
