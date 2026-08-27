// Pure enemy intent authority for solitaire-combat-v2.
//
// This module deliberately consumes only the canonical v2 encounter snapshot, authored
// catalogue, action/status legality projections, and targeting locks. It never imports a
// v1 profile, skill, encounter, or target helper; it never executes an effect or mutates
// encounter state. An intent is therefore only a durable, rank-pinned target declaration.

import { canUseCombatAbilityV2 } from "./action-economy-v2.js";
import {
  COMBAT_ABILITY_RULESET_V2_ID,
  COMBAT_ABILITY_RULES_V2_VERSION,
  abilityRulesV2AtRank,
} from "./ability-rules-v2.js";
import {
  COMBAT_DEFAULT_ABILITY_KITS_V2,
  getCombatAbilityRolesV2,
  getCombatAbilityRulesV2,
} from "./ability-catalog-v2.js";
import {
  adjudicateCombatStatusActionV2,
  resolveCombatForcedTargetV2,
  combatStatusMagnitudeV2,
} from "./status-runtime-v2.js";
import {
  commitAbilityTargetsV2,
  isAbilityTargetLockV2,
  legalAbilityAnchorsV2,
  lockAbilityTargetV2,
} from "./targeting-v2.js";

export const COMBAT_AI_POLICY_REGISTRY_V2_VERSION = 1;
export const COMBAT_AI_PROFILE_VERSION_V2 = 1;

export const COMBAT_AI_PROFILE_IDS_V2 = Object.freeze([
  "knight",
  "ranger",
  "artificer",
  "berserker",
  "sorcerer",
  "rogue",
  "warlock",
  "wizard",
  "paladin",
  "blademaster",
  "vampire",
  "automaton",
]);

const ROLE_PRIORITIES = Object.freeze({
  knight: ["tank-control", "buff", "damage", "heal", "cleanse", "tempo", "economy"],
  ranger: ["damage", "tank-control", "buff", "tempo", "heal", "cleanse", "economy"],
  artificer: ["heal", "tempo", "tank-control", "buff", "damage", "cleanse", "economy"],
  berserker: ["damage", "cleanse", "buff", "tank-control", "tempo", "heal", "economy"],
  sorcerer: ["tank-control", "damage", "buff", "tempo", "heal", "cleanse", "economy"],
  rogue: ["tempo", "damage", "cleanse", "tank-control", "buff", "heal", "economy"],
  warlock: ["buff", "tank-control", "damage", "tempo", "heal", "cleanse", "economy"],
  wizard: ["damage", "buff", "tank-control", "tempo", "heal", "cleanse", "economy"],
  paladin: ["heal", "cleanse", "tank-control", "buff", "damage", "tempo", "economy"],
  blademaster: ["tempo", "buff", "tank-control", "damage", "heal", "cleanse", "economy"],
  vampire: ["heal", "damage", "buff", "tank-control", "tempo", "cleanse", "economy"],
  automaton: ["economy", "heal", "cleanse", "tank-control", "damage", "buff", "tempo"],
});
const AI_ROLE_IDS = Object.freeze([
  "buff",
  "cleanse",
  "damage",
  "economy",
  "heal",
  "tank-control",
  "tempo",
]);

const POLICY_KEYS = Object.freeze([
  "abilityPriority",
  "lanePriority",
  "policyId",
  "profileId",
  "profileVersion",
  "randomness",
  "rolePriority",
  "rulesetId",
  "version",
].sort());
const INTENT_KEYS = Object.freeze([
  "abilityId",
  "declaredSequence",
  "policyId",
  "rank",
  "targetLock",
].sort());
const DECLARE_INPUT_KEYS = Object.freeze(["actorId", "declaredSequence"].sort());
const EVALUATE_INPUT_KEYS = Object.freeze(["actorId", "intent"].sort());
const REDECLARE_INPUT_KEYS = Object.freeze([
  "actorId",
  "intent",
  "nextDeclaredSequence",
].sort());

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

function compareIdentifiers(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function actorIdentifier(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 256;
}

function rulesIdentifier(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 128
    && /^[a-z][a-z0-9-]*$/.test(value);
}

function positiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function uniqueStrings(value) {
  return Array.isArray(value)
    && value.every(rulesIdentifier)
    && new Set(value).size === value.length;
}

function sameStringSet(left, right) {
  return left.length === right.length
    && left.every((entry) => right.includes(entry));
}

function stableSerialize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${stableSerialize(value[key])}`
  )).join(",")}}`;
}

function fnv1a32(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function policyReason(value) {
  if (!exactKeys(value, POLICY_KEYS)) return "invalid-ai-policy-v2-shape";
  if (value.version !== COMBAT_AI_POLICY_REGISTRY_V2_VERSION
    || value.rulesetId !== COMBAT_ABILITY_RULESET_V2_ID
    || !rulesIdentifier(value.profileId)
    || value.profileVersion !== COMBAT_AI_PROFILE_VERSION_V2
    || value.policyId !== `${value.profileId}-v${value.profileVersion}`
    || value.randomness !== "none") return "invalid-ai-policy-v2-identity";
  if (!COMBAT_AI_PROFILE_IDS_V2.includes(value.profileId)
    || !uniqueStrings(value.lanePriority)
    || value.lanePriority.length !== 2
    || !value.lanePriority.includes("quick")
    || !value.lanePriority.includes("main")
    || !uniqueStrings(value.rolePriority)
    || !sameStringSet(value.rolePriority, AI_ROLE_IDS)
    || !uniqueStrings(value.abilityPriority)) return "invalid-ai-policy-v2-priority";
  const kit = COMBAT_DEFAULT_ABILITY_KITS_V2[value.profileId];
  const actionKit = kit?.filter((id) => getCombatAbilityRulesV2(id).action.lane !== "reaction");
  if (!actionKit || !sameStringSet(value.abilityPriority, actionKit)) {
    return "invalid-ai-policy-v2-kit";
  }
  return null;
}

function createPolicy(profileId) {
  const policy = {
    version: COMBAT_AI_POLICY_REGISTRY_V2_VERSION,
    rulesetId: COMBAT_ABILITY_RULESET_V2_ID,
    profileId,
    profileVersion: COMBAT_AI_PROFILE_VERSION_V2,
    policyId: `${profileId}-v${COMBAT_AI_PROFILE_VERSION_V2}`,
    lanePriority: ["quick", "main"],
    rolePriority: [...ROLE_PRIORITIES[profileId]],
    abilityPriority: COMBAT_DEFAULT_ABILITY_KITS_V2[profileId]
      .filter((id) => getCombatAbilityRulesV2(id).action.lane !== "reaction"),
    randomness: "none",
  };
  const reason = policyReason(policy);
  if (reason !== null) throw new TypeError(reason);
  return deepFreeze(policy);
}

export const COMBAT_AI_POLICY_REGISTRY_V2 = deepFreeze(Object.fromEntries(
  COMBAT_AI_PROFILE_IDS_V2.map((profileId) => {
    const policy = createPolicy(profileId);
    return [policy.policyId, policy];
  }),
));

export function calculateCombatAiPolicyRegistryV2Checksum() {
  return `fnv1a32:${fnv1a32(stableSerialize({
    version: COMBAT_AI_POLICY_REGISTRY_V2_VERSION,
    rulesetId: COMBAT_ABILITY_RULESET_V2_ID,
    policies: Object.values(COMBAT_AI_POLICY_REGISTRY_V2),
  }))}`;
}

// This literal is intentionally pinned so a save/session authority can fail closed on AI
// policy drift in the same way it pins the authored ability catalogue.
export const COMBAT_AI_POLICY_REGISTRY_V2_CHECKSUM = "fnv1a32:9bcc646d";

if (calculateCombatAiPolicyRegistryV2Checksum() !== COMBAT_AI_POLICY_REGISTRY_V2_CHECKSUM) {
  throw new TypeError("combat-ai-policy-v2-checksum-drift");
}

export function validateCombatAiPolicyV2(value) {
  const reason = policyReason(value);
  return Object.freeze({ ok: reason === null, reason });
}

export function isCombatAiPolicyV2(value) {
  return validateCombatAiPolicyV2(value).ok;
}

export function getCombatAiPolicyV2(profileId, profileVersion) {
  if (!rulesIdentifier(profileId) || !positiveSafeInteger(profileVersion)) return null;
  return COMBAT_AI_POLICY_REGISTRY_V2[`${profileId}-v${profileVersion}`] ?? null;
}

function intentReason(value) {
  if (!exactKeys(value, INTENT_KEYS)) return "invalid-ai-intent-v2-shape";
  if (!rulesIdentifier(value.abilityId)
    || !positiveSafeInteger(value.rank)
    || !positiveSafeInteger(value.declaredSequence)
    || !rulesIdentifier(value.policyId)
    || !Object.hasOwn(COMBAT_AI_POLICY_REGISTRY_V2, value.policyId)
    || !isAbilityTargetLockV2(value.targetLock)) return "invalid-ai-intent-v2-value";
  if (value.targetLock.abilityId !== value.abilityId
    || value.targetLock.rank !== value.rank
    || value.targetLock.rulesetId !== COMBAT_ABILITY_RULESET_V2_ID) {
    return "ai-intent-target-lock-mismatch-v2";
  }
  return null;
}

function cloneLock(lock) {
  return {
    version: lock.version,
    rulesetId: lock.rulesetId,
    abilityId: lock.abilityId,
    rank: lock.rank,
    casterId: lock.casterId,
    anchor: { ...lock.anchor },
  };
}

function cloneIntent(intent) {
  return {
    abilityId: intent.abilityId,
    rank: intent.rank,
    targetLock: cloneLock(intent.targetLock),
    declaredSequence: intent.declaredSequence,
    policyId: intent.policyId,
  };
}

export function validateCombatAiIntentV2(value) {
  const reason = intentReason(value);
  return Object.freeze({ ok: reason === null, reason });
}

export function isCombatAiIntentV2(value) {
  return validateCombatAiIntentV2(value).ok;
}

function failure(reason) {
  return deepFreeze({
    ok: false,
    reason,
    decision: null,
    endReason: null,
    intent: null,
    events: [],
  });
}

function semanticResult(valid, reason, targetCommit = null) {
  return deepFreeze({
    ok: true,
    valid,
    reason,
    requiresFreshDeclaration: !valid,
    targetCommit,
  });
}

function declarationResult(decision, intent, events, endReason = null) {
  return deepFreeze({
    ok: true,
    reason: null,
    decision,
    endReason,
    intent,
    events,
  });
}

function checkedState(state) {
  return !state || typeof state !== "object" || Array.isArray(state)
    || state.version !== COMBAT_ABILITY_RULES_V2_VERSION
    || state.rulesetId !== COMBAT_ABILITY_RULESET_V2_ID
    || !state.actors || typeof state.actors !== "object" || Array.isArray(state.actors)
    || !state.formations || typeof state.formations !== "object"
    || !state.economy || typeof state.economy !== "object"
    || !state.statuses || typeof state.statuses !== "object"
    ? "invalid-ai-state-projection-v2"
    : null;
}

function policyForActor(actor) {
  if (!actor || actor.controller !== "ai" || actor.aiProfile === null) return null;
  return getCombatAiPolicyV2(actor.aiProfile.id, actor.aiProfile.version);
}

function opposingSide(side) {
  return side === "player" ? "enemy" : "player";
}

function livingIdsOnSide(state, side) {
  return state.formations[side].flatMap((actorId) => {
    const actor = actorId === null ? null : state.actors[actorId];
    return actor?.hp > 0 ? [actorId] : [];
  });
}

function effectRecipientIds(state, commit, effect) {
  const caster = state.actors[commit.casterId];
  if (effect.recipient === "caster") return [caster.id];
  if (effect.recipient === "selected-units") {
    return commit.selectedUnits.map(({ actorId }) => actorId);
  }
  if (effect.recipient === "selected-cells") return [];
  if (effect.recipient === "all-allies") return livingIdsOnSide(state, caster.side);
  if (effect.recipient === "all-enemies") {
    return livingIdsOnSide(state, opposingSide(caster.side));
  }
  if (effect.recipient === "all-combatants") {
    return [
      ...livingIdsOnSide(state, caster.side),
      ...livingIdsOnSide(state, opposingSide(caster.side)),
    ];
  }
  return [];
}

function uniqueIds(values) {
  return [...new Set(values)];
}

function hostileRecipientIds(state, actorId, ability, commit) {
  const side = state.actors[actorId].side;
  return uniqueIds(ability.effects.flatMap((effect) => (
    effectRecipientIds(state, commit, effect)
      .filter((recipientId) => state.actors[recipientId].side !== side)
  )));
}

function healthNeedBps(actor) {
  return Math.floor(((actor.maxHp - actor.hp) * 10_000) / actor.maxHp);
}

function statusMagnitude(state, actorId, statusId) {
  return combatStatusMagnitudeV2(state.statuses, actorId, statusId);
}

function candidateMetrics(state, actorId, policy, ability, commit) {
  const casterSide = state.actors[actorId].side;
  const hostileIds = new Set();
  const alliedIds = new Set();
  let healNeed = 0;
  let cleanseNeed = 0;
  let resourceNeed = 0;
  let protectionNeed = 0;
  let offensivePotency = 0;
  let supportPotency = 0;
  let zoneCellCount = 0;

  for (const effect of ability.effects) {
    const recipientIds = effectRecipientIds(state, commit, effect);
    if (effect.primitive === "zone" && effect.recipient === "selected-cells") {
      zoneCellCount += commit.selectedCells.length;
    }
    for (const recipientId of recipientIds) {
      const recipient = state.actors[recipientId];
      const allied = recipient.side === casterSide;
      (allied ? alliedIds : hostileIds).add(recipientId);
      if (effect.primitive === "heal") healNeed += healthNeedBps(recipient);
      if (effect.primitive === "cleanse" && effect.subject !== null) {
        cleanseNeed += statusMagnitude(state, recipientId, effect.subject);
      }
      if (effect.primitive === "resource") {
        const economyActor = state.economy.actors[recipientId];
        resourceNeed += economyActor.maxResolve - economyActor.resolve;
      }
      if (allied && ["shield", "status"].includes(effect.primitive)) {
        protectionNeed += healthNeedBps(recipient);
      }
      const weightedAmount = effect.value.amount * (effect.primitive === "damage" ? 2 : 1);
      if (allied) supportPotency += weightedAmount;
      else offensivePotency += weightedAmount;
    }
  }

  const hostileVulnerability = [...hostileIds]
    .reduce((sum, id) => sum + healthNeedBps(state.actors[id]), 0);
  const affectedCount = hostileIds.size + alliedIds.size;
  let utilityTier = zoneCellCount > 0 ? 10 : 0;
  let utilityValue = zoneCellCount;
  if (alliedIds.size > 0) {
    utilityTier = 20;
    utilityValue = Math.max(utilityValue, alliedIds.size);
  }
  if (protectionNeed > 0) {
    utilityTier = 50;
    utilityValue = protectionNeed;
  }
  if (hostileIds.size > 0) {
    utilityTier = 60;
    utilityValue = (hostileIds.size * 10_001) + hostileVulnerability;
  }
  if (resourceNeed > 0) {
    utilityTier = 70;
    utilityValue = resourceNeed;
  }
  if (cleanseNeed > 0) {
    utilityTier = 80;
    utilityValue = cleanseNeed;
  }
  if (healNeed > 0) {
    utilityTier = 90;
    utilityValue = healNeed;
  }

  const roles = getCombatAbilityRolesV2(ability.id) ?? [];
  const roleIndex = roles.reduce((best, role) => {
    const index = policy.rolePriority.indexOf(role);
    return index === -1 ? best : Math.min(best, index);
  }, policy.rolePriority.length);
  const abilityIndex = policy.abilityPriority.indexOf(ability.id);
  return {
    laneIndex: policy.lanePriority.indexOf(ability.action.lane),
    utilityTier,
    utilityValue,
    affectedCount,
    offensivePotency,
    supportPotency,
    zoneCellCount,
    roleIndex,
    abilityIndex: abilityIndex === -1 ? Number.MAX_SAFE_INTEGER : abilityIndex,
  };
}

function compareCandidates(left, right) {
  return left.metrics.laneIndex - right.metrics.laneIndex
    || right.metrics.utilityTier - left.metrics.utilityTier
    || right.metrics.utilityValue - left.metrics.utilityValue
    || right.metrics.affectedCount - left.metrics.affectedCount
    || right.metrics.offensivePotency - left.metrics.offensivePotency
    || right.metrics.supportPotency - left.metrics.supportPotency
    || right.metrics.zoneCellCount - left.metrics.zoneCellCount
    || right.ability.action.resolveCost - left.ability.action.resolveCost
    || left.metrics.roleIndex - right.metrics.roleIndex
    || left.metrics.abilityIndex - right.metrics.abilityIndex
    || compareIdentifiers(left.ability.id, right.ability.id)
    || left.anchor.index - right.anchor.index
    || compareIdentifiers(left.anchor.actorId ?? "", right.anchor.actorId ?? "");
}

function anchorsForAbility(state, actorId, ability) {
  const anchors = legalAbilityAnchorsV2(state, ability, actorId);
  return anchors.flatMap((anchor) => {
    const durableAnchor = anchor.tracking === "unit"
      ? anchor.actorId
      : { side: anchor.side, index: anchor.index };
    const locked = lockAbilityTargetV2(state, ability, actorId, durableAnchor);
    if (!locked.ok) return [];
    const committed = commitAbilityTargetsV2(state, ability, locked.lock);
    return committed.ok ? [{ anchor, lock: locked.lock, commit: committed }] : [];
  });
}

function forcedTargetProjection(state, actorId, ability, anchored) {
  const validActorIds = uniqueIds(anchored.flatMap(({ commit }) => (
    hostileRecipientIds(state, actorId, ability, commit)
  )));
  return resolveCombatForcedTargetV2(state.statuses, { actorId, validActorIds });
}

function abilityCandidates(state, actor, policy, loadout) {
  const definition = getCombatAbilityRulesV2(loadout.id);
  if (!definition || loadout.rank > definition.rankCount) {
    return { ok: false, reason: "invalid-ai-loadout-v2", candidates: [] };
  }
  const ability = abilityRulesV2AtRank(definition, loadout.rank);
  if (!["main", "quick"].includes(ability.action.lane)) {
    return { ok: true, reason: null, candidates: [] };
  }
  const access = canUseCombatAbilityV2(state.economy, {
    actorId: actor.id,
    abilityId: ability.id,
  });
  if (!access.ok) return { ok: true, reason: null, candidates: [] };
  const gate = adjudicateCombatStatusActionV2(state.statuses, {
    actorId: actor.id,
    lane: ability.action.lane,
  });
  if (!gate.ok) return { ok: false, reason: gate.reason, candidates: [] };
  if (!gate.event.allowed) return { ok: true, reason: null, candidates: [] };

  const anchored = anchorsForAbility(state, actor.id, ability);
  if (anchored.length === 0) return { ok: true, reason: null, candidates: [] };
  const forced = forcedTargetProjection(state, actor.id, ability, anchored);
  if (!forced.ok) return { ok: false, reason: forced.reason, candidates: [] };
  const forcedId = forced.event.targetActorId;
  const candidates = anchored
    .filter(({ commit }) => forcedId === null
      || hostileRecipientIds(state, actor.id, ability, commit).includes(forcedId))
    .map(({ anchor, lock, commit }) => ({
      ability,
      anchor,
      lock,
      commit,
      metrics: candidateMetrics(state, actor.id, policy, ability, commit),
    }));
  return { ok: true, reason: null, candidates };
}

function allCandidates(state, actor, policy) {
  const candidates = [];
  for (const loadout of actor.loadout) {
    const resolved = abilityCandidates(state, actor, policy, loadout);
    if (!resolved.ok) return resolved;
    candidates.push(...resolved.candidates);
  }
  candidates.sort(compareCandidates);
  return { ok: true, reason: null, candidates };
}

function declaredEvent(actorId, intent) {
  return {
    type: "ai-intent-declared",
    actorId,
    abilityId: intent.abilityId,
    rank: intent.rank,
    declaredSequence: intent.declaredSequence,
    policyId: intent.policyId,
    targetLock: cloneLock(intent.targetLock),
  };
}

/**
 * Declare one fresh main/quick intent for the AI actor that currently owns priority.
 *
 * No random source is consulted. Equal utility is resolved by policy lane/role/ability
 * order, ability id, row-major anchor index, then actor id.
 */
export function declareCombatAiIntentV2(state, input) {
  const stateError = checkedState(state);
  if (stateError !== null) return failure(stateError);
  if (!exactKeys(input, DECLARE_INPUT_KEYS)
    || !actorIdentifier(input.actorId)
    || !positiveSafeInteger(input.declaredSequence)) {
    return failure("invalid-ai-intent-declaration-v2");
  }
  const actor = state.actors[input.actorId];
  if (!actor) return failure("unknown-ai-actor-v2");
  if (actor.controller !== "ai") return failure("ai-controller-required-v2");
  if (actor.hp <= 0 || !state.formations[actor.side].includes(actor.id)) {
    return failure("ai-actor-not-living-and-fielded-v2");
  }
  if (state.economy.phase !== "actor-turn" || state.economy.activeActorId !== actor.id) {
    return failure("ai-actor-does-not-have-priority-v2");
  }
  const policy = policyForActor(actor);
  if (!policy) return failure("unknown-ai-profile-v2");

  const collected = allCandidates(state, actor, policy);
  if (!collected.ok) return failure(collected.reason);
  if (collected.candidates.length === 0) {
    const event = {
      type: "ai-priority-ended",
      actorId: actor.id,
      declaredSequence: input.declaredSequence,
      policyId: policy.policyId,
      reason: "no-legal-action-v2",
    };
    return declarationResult("end", null, [event], "no-legal-action-v2");
  }

  const selected = collected.candidates[0];
  const intent = deepFreeze({
    abilityId: selected.ability.id,
    rank: selected.ability.rank,
    targetLock: cloneLock(selected.lock),
    declaredSequence: input.declaredSequence,
    policyId: policy.policyId,
  });
  return declarationResult("intent", intent, [declaredEvent(actor.id, intent)]);
}

/** Validate a persisted intent against current authorities without changing its lock. */
export function evaluateCombatAiIntentV2(state, input) {
  const stateError = checkedState(state);
  if (stateError !== null) return deepFreeze({
    ok: false,
    valid: false,
    reason: stateError,
    requiresFreshDeclaration: false,
    targetCommit: null,
  });
  if (!exactKeys(input, EVALUATE_INPUT_KEYS) || !actorIdentifier(input.actorId)) {
    return deepFreeze({
      ok: false,
      valid: false,
      reason: "invalid-ai-intent-evaluation-v2",
      requiresFreshDeclaration: false,
      targetCommit: null,
    });
  }
  const structural = validateCombatAiIntentV2(input.intent);
  if (!structural.ok) return deepFreeze({
    ok: false,
    valid: false,
    reason: structural.reason,
    requiresFreshDeclaration: false,
    targetCommit: null,
  });
  const actor = state.actors[input.actorId];
  if (!actor || actor.controller !== "ai") {
    return semanticResult(false, "ai-controller-required-v2");
  }
  const policy = policyForActor(actor);
  if (!policy || policy.policyId !== input.intent.policyId) {
    return semanticResult(false, "ai-intent-policy-mismatch-v2");
  }
  if (input.intent.targetLock.casterId !== actor.id) {
    return semanticResult(false, "ai-intent-caster-mismatch-v2");
  }
  if (actor.hp <= 0 || !state.formations[actor.side].includes(actor.id)) {
    return semanticResult(false, "ai-actor-not-living-and-fielded-v2");
  }
  const loadout = actor.loadout.find(({ id }) => id === input.intent.abilityId);
  if (!loadout || loadout.rank !== input.intent.rank) {
    return semanticResult(false, "ai-intent-loadout-rank-mismatch-v2");
  }
  const definition = getCombatAbilityRulesV2(input.intent.abilityId);
  if (!definition) return semanticResult(false, "unknown-ai-ability-v2");
  const ability = abilityRulesV2AtRank(definition, loadout.rank);
  if (!["main", "quick"].includes(ability.action.lane)) {
    return semanticResult(false, "ai-intent-action-lane-mismatch-v2");
  }
  const access = canUseCombatAbilityV2(state.economy, {
    actorId: actor.id,
    abilityId: ability.id,
  });
  if (!access.ok) return semanticResult(false, access.reason);
  const gate = adjudicateCombatStatusActionV2(state.statuses, {
    actorId: actor.id,
    lane: ability.action.lane,
  });
  if (!gate.ok) return semanticResult(false, gate.reason);
  if (!gate.event.allowed) return semanticResult(false, "ai-intent-status-blocked-v2");
  const committed = commitAbilityTargetsV2(state, ability, input.intent.targetLock);
  if (!committed.ok) return semanticResult(false, committed.reason);

  const anchored = anchorsForAbility(state, actor.id, ability);
  const forced = forcedTargetProjection(state, actor.id, ability, anchored);
  if (!forced.ok) return semanticResult(false, forced.reason);
  if (forced.event.targetActorId !== null
    && !hostileRecipientIds(state, actor.id, ability, committed)
      .includes(forced.event.targetActorId)) {
    return semanticResult(false, "ai-intent-forced-target-mismatch-v2");
  }
  return semanticResult(true, null, committed);
}

/**
 * Explicitly retain a valid intent or replace an invalid one with a new declaration.
 *
 * Replacement is never in-place: the caller supplies a strictly newer sequence, the old
 * intent is emitted as invalidated, and declaration constructs a new authoritative lock.
 */
export function redeclareCombatAiIntentV2(state, input) {
  if (!exactKeys(input, REDECLARE_INPUT_KEYS)
    || !actorIdentifier(input.actorId)
    || !positiveSafeInteger(input.nextDeclaredSequence)) {
    return failure("invalid-ai-intent-redeclaration-v2");
  }
  const structural = validateCombatAiIntentV2(input.intent);
  if (!structural.ok) return failure(structural.reason);
  if (input.nextDeclaredSequence <= input.intent.declaredSequence) {
    return failure("nonmonotonic-ai-intent-sequence-v2");
  }
  const evaluated = evaluateCombatAiIntentV2(state, {
    actorId: input.actorId,
    intent: input.intent,
  });
  if (!evaluated.ok) return failure(evaluated.reason);
  if (evaluated.valid) {
    return declarationResult("retain", deepFreeze(cloneIntent(input.intent)), []);
  }

  const invalidated = {
    type: "ai-intent-invalidated",
    actorId: input.actorId,
    abilityId: input.intent.abilityId,
    rank: input.intent.rank,
    declaredSequence: input.intent.declaredSequence,
    policyId: input.intent.policyId,
    reason: evaluated.reason,
  };
  const declared = declareCombatAiIntentV2(state, {
    actorId: input.actorId,
    declaredSequence: input.nextDeclaredSequence,
  });
  if (!declared.ok) return declared;
  return declarationResult(
    declared.decision,
    declared.intent,
    [invalidated, ...declared.events],
    declared.endReason,
  );
}

if (COMBAT_ABILITY_RULES_V2_VERSION !== 2) {
  throw new TypeError("combat-ai-v2-rules-version-drift");
}
