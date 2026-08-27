// Read-only tactical metadata for the captured Archetype ability catalogue.
//
// An ability definition is part of the v1 replay contract: changing its effects, Resolve
// price, targeting, or presentation can reinterpret a command that was already recorded.
// Profiles therefore project the current rules without mutating or serializing anything.
// A later ruleset may replace this projection while v1 continues to call this exact module.

import {
  ABILITY_EFFECT_RECIPIENTS,
  ABILITY_PRESENTATION_TIERS,
  abilityTargeting,
  effectRecipient,
  isAbilityTargetingMetadata,
  presentationTier,
} from "./ability-targeting.js";
import {
  SKILL_RARITY_PROGRESSION,
  getSkill,
  resolveCost,
  skillRarityAtRank,
} from "./skills.js";
import { COMBAT_RULESET_ID } from "./ruleset.js";

export const ABILITY_PROFILE_VERSION = 1;

export const ABILITY_ROLES = Object.freeze([
  "damage",
  "tank-control",
  "heal",
  "buff",
  "cleanse",
  "tempo",
  "economy",
]);

export const ABILITY_ROLE_LABELS = Object.freeze({
  damage: "Damage",
  "tank-control": "Guard / control",
  heal: "Healing",
  buff: "Empower",
  cleanse: "Cleanse",
  tempo: "Tempo",
  economy: "Resolve",
});

export const ABILITY_PROFILE_SLOTS = Object.freeze(["basic", "defense", "flex"]);
export const ABILITY_COST_BANDS = Object.freeze([
  "free",
  "light",
  "tactical",
  "major",
  "signature",
  "mythical",
]);

const COMPATIBILITY_BASIC_IDS = new Set(["strike", "shield-bash", "slaughter"]);
const COMPATIBILITY_DEFENSE_IDS = new Set(["block", "defensive-stance", "parry"]);

// These status groups describe mechanics, never translated display names. They let the
// UI and simulation agree that, for example, Haste is a buff and tempo tool while a
// self-inflicted Paralyze rider is neither.
const BENEFICIAL_STATUS_TYPES = new Set([
  "bleed-atk",
  "bone-shield",
  "charge",
  "conceal",
  "counter-attack",
  "covert",
  "doom-atk",
  "evade",
  "eviscerate",
  "focus",
  "grow",
  "guard",
  "haste",
  "initiative",
  "invincible",
  "judgment",
  "lifesteal",
  "mirror-image",
  "overload",
  "parry",
  "persist",
  "poison-atk",
  "predator",
  "priority",
  "protection",
  "sharpen",
  "skeleton",
  "solidity",
  "steelskin",
  "strength",
  "tenacity",
  "thorn",
  "unstoppable",
]);

const PROTECTIVE_STATUS_TYPES = new Set([
  "bone-shield",
  "counter-attack",
  "evade",
  "guard",
  "invincible",
  "mirror-image",
  "parry",
  "persist",
  "protection",
  "solidity",
  "steelskin",
  "tenacity",
  "thorn",
  "unstoppable",
]);

const TEMPO_STATUS_TYPES = new Set([
  "haste",
  "initiative",
  "priority",
]);

const CONTROL_STATUS_TYPES = new Set([
  "cripple",
  "injured",
  "lethargy",
  "limp",
  "paralyze",
  "restraint",
  "sleep",
  "stun",
  "vulnerable",
  "weak",
]);

const DAMAGING_STATUS_TYPES = new Set([
  "bleed",
  "burn",
  "doom",
  "fatal-blade",
  "hellfire-spirit",
  "limited-life-sentence",
  "misfortune",
  "poison",
  "void-monster",
]);

// Dedicated cleanse semantics cannot be recovered from effect type alone. Several captured
// actions use scale-status below 100% for cleansing, while other actions use the same effect
// type to spend a beneficial stack as a cost. Keep the distinction authored by stable id.
const CLEANSE_ABILITY_IDS = new Set([
  "first-aid",
  "priestess-purification",
  "assassin-life-saving-pill",
  "north-king-warriors-oath",
  "sleepless-transference",
  "vampire-endless-will",
  "automaton-repair",
  "automaton-heat-emission",
  "automaton-emergency-cooling",
  "automaton-fate-manipulator",
]);

const DISPEL_ABILITY_IDS = new Set([
  "assassin-cold-blood",
  "artificer-armor-piercing-round",
  "witch-nullification",
]);

function definitionFor(skillOrId) {
  const id = typeof skillOrId === "string" ? skillOrId : skillOrId?.id;
  const definition = getSkill(id);
  if (!definition || definition.slot !== "slotted") {
    throw new TypeError(`invalid-ability-profile:${typeof id === "string" ? id : "definition"}`);
  }
  if (typeof skillOrId === "object" && skillOrId !== definition) {
    throw new TypeError(`noncanonical-ability-definition:${id}`);
  }
  return definition;
}

function profileSlot(definition) {
  if (definition.abilityType === "basic-attack" || COMPATIBILITY_BASIC_IDS.has(definition.id)) {
    return "basic";
  }
  if (definition.abilityType === "defensive" || COMPATIBILITY_DEFENSE_IDS.has(definition.id)) {
    return "defense";
  }
  return "flex";
}

function statusTypes(effect) {
  return [effect.status, ...(effect.statuses || [])].filter(Boolean);
}

function effectValueAtRank(effect, rank) {
  const values = effect.countByRank || effect.percentByRank || effect.factorByRank;
  if (!Array.isArray(values) || values.length === 0) return null;
  return values[Math.min(rank - 1, values.length - 1)];
}

function hasActiveMagnitude(effect, rank) {
  const value = effectValueAtRank(effect, rank);
  return value === null || (Number.isFinite(value) && value > 0);
}

function appliesOrAmplifiesStatus(effect, rank) {
  if ([
    "status",
    "scaled-status",
    "status-from-status",
    "scaled-status-enemy-lost-hp",
    "amplify-statuses",
  ].includes(effect.type)) return hasActiveMagnitude(effect, rank);
  const value = effectValueAtRank(effect, rank);
  if (effect.type === "scale-status") return Number.isFinite(value) && value > 100;
  if (effect.type === "modify-status") return Number.isFinite(value) && value > 0;
  return false;
}

function removesStatus(effect, rank) {
  if (effect.type === "reduce-statuses") {
    return Number.isFinite(effect.toPercent) && effect.toPercent < 100;
  }
  const value = effectValueAtRank(effect, rank);
  if (effect.type === "scale-status") return Number.isFinite(value) && value < 100;
  if (effect.type === "modify-status") return Number.isFinite(value) && value < 0;
  return false;
}

function inferredRoles(definition, rank) {
  const found = new Set();

  for (const effect of definition.effects) {
    const statuses = statusTypes(effect);
    const activeMagnitude = hasActiveMagnitude(effect, rank);
    const appliesStatus = appliesOrAmplifiesStatus(effect, rank);
    if ((activeMagnitude && (effect.type === "damage" || effect.type.startsWith("damage-")))
      || (activeMagnitude && effect.type === "delayed-damage" && effect.target !== "self")
      || (appliesStatus
        && effect.target !== "self"
        && statuses.some((status) => DAMAGING_STATUS_TYPES.has(status)))) {
      found.add("damage");
    }
    if (activeMagnitude && effect.type.startsWith("heal")) found.add("heal");
    if (activeMagnitude && ["restore-skill-uses", "resolve-regen"].includes(effect.type)) {
      found.add("economy");
    }

    if ((activeMagnitude && effect.type === "shield")
      || (appliesStatus
        && effect.target !== "enemy"
        && statuses.some((status) => PROTECTIVE_STATUS_TYPES.has(status)))) {
      found.add("tank-control");
    }
    if (appliesStatus
      && effect.target === "enemy"
      && statuses.some((status) => CONTROL_STATUS_TYPES.has(status))) {
      found.add("tank-control");
    }
    if (appliesStatus
      && (effect.target === "self" || effect.target === "all")
      && statuses.some((status) => BENEFICIAL_STATUS_TYPES.has(status))) {
      found.add("buff");
    }
    if (appliesStatus
      && effect.target !== "enemy"
      && statuses.some((status) => TEMPO_STATUS_TYPES.has(status))) found.add("tempo");
    if (activeMagnitude && effect.type === "temporary-max-hp") {
      found.add("buff");
      found.add("tank-control");
    }
  }

  const activeRemovals = definition.effects.filter((effect) => removesStatus(effect, rank));
  if (CLEANSE_ABILITY_IDS.has(definition.id)
    && activeRemovals.some((effect) => effect.target !== "enemy")) found.add("cleanse");
  if (DISPEL_ABILITY_IDS.has(definition.id)
    && activeRemovals.some((effect) => effect.target === "enemy" || effect.target === "all")) {
    found.add("cleanse");
  }

  return Object.freeze(ABILITY_ROLES.filter((role) => found.has(role)));
}

/** Contextual player-facing copy without expanding the canonical role taxonomy. */
export function abilityRoleLabel(role, skillOrId, rank = 1) {
  if (!ABILITY_ROLES.includes(role)) throw new TypeError(`invalid-ability-role:${role}`);
  const definition = definitionFor(skillOrId);
  skillRarityAtRank(definition, rank);
  if (role !== "cleanse") return ABILITY_ROLE_LABELS[role];
  const removals = definition.effects.filter((effect) => removesStatus(effect, rank));
  const removesFriendly = removals.some((effect) => effect.target === "self" || effect.target === "all");
  const removesEnemy = removals.some((effect) => effect.target === "enemy" || effect.target === "all");
  if (removesEnemy && !removesFriendly) return "Dispel";
  if (removesFriendly && !removesEnemy) return "Cleanse";
  return "Cleanse / dispel";
}

function costBand(cost) {
  if (cost === 0) return "free";
  if (cost === 1) return "light";
  if (cost === 2) return "tactical";
  if (cost === 3) return "major";
  if (cost <= 5) return "signature";
  return "mythical";
}

export function isAbilityProfile(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  if (keys.join() !== [
    "economy",
    "effectRecipients",
    "id",
    "presentation",
    "progression",
    "roles",
    "rulesetId",
    "slot",
    "targeting",
    "version",
  ].sort().join()) return false;
  const definition = getSkill(value.id);
  if (!definition || definition.slot !== "slotted") return false;
  if (!Array.isArray(value.roles) || !Array.isArray(value.effectRecipients)) return false;
  const rank = value.progression?.rank;
  if (!Number.isSafeInteger(rank) || rank < 1 || rank > definition.rankCount) return false;
  const canonicalRoles = ABILITY_ROLES.filter((role) => value.roles.includes(role));
  const canonicalTargeting = abilityTargeting(definition);
  const economyKeys = Object.keys(value.economy || {}).sort();
  const progressionKeys = Object.keys(value.progression || {}).sort();
  return value.version === ABILITY_PROFILE_VERSION
    && value.rulesetId === COMBAT_RULESET_ID
    && value.slot === profileSlot(definition)
    && Array.isArray(value.roles)
    && new Set(value.roles).size === value.roles.length
    && value.roles.every((role, index) => role === canonicalRoles[index])
    && value.roles.join() === inferredRoles(definition, rank).join()
    && isAbilityTargetingMetadata(value.targeting)
    && Object.keys(canonicalTargeting).every((key) => (
      value.targeting[key] === canonicalTargeting[key]
    ))
    && value.effectRecipients.length === definition.effects.length
    && value.effectRecipients.every((recipient, index) => (
      ABILITY_EFFECT_RECIPIENTS.includes(recipient)
      && recipient === effectRecipient(definition, definition.effects[index], index)
    ))
    && economyKeys.join() === [
      "consumesTurn",
      "cooldown",
      "cost",
      "costBand",
      "resource",
    ].sort().join()
    && value.economy?.resource === "resolve"
    && ABILITY_COST_BANDS.includes(value.economy?.costBand)
    && Number.isSafeInteger(value.economy?.cost)
    && value.economy.cost >= 0
    && value.economy.costBand === costBand(value.economy.cost)
    && typeof value.economy?.consumesTurn === "boolean"
    && Number.isSafeInteger(value.economy?.cooldown)
    && value.economy.cooldown >= 0
    && progressionKeys.join() === [
      "baseTier",
      "effectiveTier",
      "rank",
      "rankCount",
    ].sort().join()
    && Number.isSafeInteger(value.progression?.rank)
    && Number.isSafeInteger(value.progression?.rankCount)
    && value.progression.rank >= 1
    && value.progression.rank <= value.progression.rankCount
    && value.progression.rankCount === definition.rankCount
    && value.progression.baseTier === definition.rarity
    && SKILL_RARITY_PROGRESSION.includes(value.progression.effectiveTier)
    && value.progression.effectiveTier === skillRarityAtRank(definition, value.progression.rank)
    && value.economy.cost === resolveCost(definition.id, value.progression.rank)
    && value.economy.consumesTurn === definition.consumesTurn
    && value.economy.cooldown === definition.cooldown
    && ABILITY_PRESENTATION_TIERS.includes(value.presentation)
    && value.presentation === presentationTier(definition, value.progression.rank);
}

/**
 * Project one v1 ability into shared UI/simulation metadata.
 *
 * Nothing returned here is written into sessions or receipts. `rulesetId` is accepted as
 * an explicit guard so no caller can accidentally describe v2 with v1 targeting/cost rules.
 */
export function abilityProfile(skillOrId, rank = 1, { rulesetId = COMBAT_RULESET_ID } = {}) {
  if (rulesetId !== COMBAT_RULESET_ID) throw new TypeError(`unsupported-ability-ruleset:${rulesetId}`);
  const definition = definitionFor(skillOrId);
  const effectiveTier = skillRarityAtRank(definition, rank);
  const cost = resolveCost(definition.id, rank);
  const profile = Object.freeze({
    version: ABILITY_PROFILE_VERSION,
    rulesetId,
    id: definition.id,
    slot: profileSlot(definition),
    roles: inferredRoles(definition, rank),
    targeting: abilityTargeting(definition),
    effectRecipients: Object.freeze(definition.effects.map((effect, index) => (
      effectRecipient(definition, effect, index)
    ))),
    economy: Object.freeze({
      resource: "resolve",
      cost,
      costBand: costBand(cost),
      consumesTurn: definition.consumesTurn,
      cooldown: definition.cooldown,
    }),
    progression: Object.freeze({
      baseTier: definition.rarity,
      effectiveTier,
      rank,
      rankCount: definition.rankCount,
    }),
    presentation: presentationTier(definition, rank),
  });
  if (!isAbilityProfile(profile)) throw new TypeError(`invalid-derived-ability-profile:${definition.id}`);
  return profile;
}
