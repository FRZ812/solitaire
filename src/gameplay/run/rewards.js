import { cloneJsonData } from "../kernel/json-data.js";
import { createRng, nextInt } from "../kernel/rng.js";
import { REFERENCE_POLICY } from "../reference/policy.js";
import { getReferenceReward } from "../reference/rewards.js";

export const REWARD_STATE_VERSION = REFERENCE_POLICY.rewards.schemaVersion;

const STATE_KEYS = Object.freeze([
  "baselineVersion",
  "candidateIds",
  "choices",
  "offerId",
  "refreshesRemaining",
  "refreshesUsed",
  "revision",
  "rng",
  "seed",
  "selectedRewardId",
  "version",
].sort());

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return value;
}

function sameSet(first, second) {
  return first.length === second.length && first.every((id) => second.includes(id));
}

function validSeed(seed) {
  return (typeof seed === "string" && seed.length > 0)
    || (typeof seed === "number" && Number.isFinite(seed));
}

function validCandidateIds(candidateIds) {
  const minimum = REFERENCE_POLICY.rewards.choiceCount + 1;
  return Array.isArray(candidateIds)
    && candidateIds.length >= minimum
    && new Set(candidateIds).size === candidateIds.length
    && candidateIds.every((id) => typeof id === "string" && getReferenceReward(id));
}

function drawChoices(rng, candidateIds, previousChoices = null) {
  const pool = [...candidateIds];
  let nextRng = rng;
  for (let index = 0; index < REFERENCE_POLICY.rewards.choiceCount; index += 1) {
    const drawn = nextInt(nextRng, index, pool.length - 1);
    nextRng = drawn.rng;
    [pool[index], pool[drawn.value]] = [pool[drawn.value], pool[index]];
  }
  const choices = pool.slice(0, REFERENCE_POLICY.rewards.choiceCount);
  if (previousChoices && sameSet(choices, previousChoices)) {
    const replacement = candidateIds.find((id) => !previousChoices.includes(id));
    choices[choices.length - 1] = replacement;
  }
  return { rng: nextRng, choices };
}

function deriveOffer(seed, candidateIds, refreshesUsed) {
  let rng = createRng(seed);
  let choices = null;
  for (let drawIndex = 0; drawIndex <= refreshesUsed; drawIndex += 1) {
    const draw = drawChoices(rng, candidateIds, choices);
    rng = draw.rng;
    choices = draw.choices;
  }
  return { rng, choices };
}

function validStateSnapshot(state) {
  if (
    !state
    || typeof state !== "object"
    || Array.isArray(state)
    || JSON.stringify(Object.keys(state).sort()) !== JSON.stringify(STATE_KEYS)
    || state.version !== REWARD_STATE_VERSION
    || state.baselineVersion !== REFERENCE_POLICY.id
    || typeof state.offerId !== "string"
    || state.offerId.length === 0
    || !validSeed(state.seed)
    || !validCandidateIds(state.candidateIds)
    || !Number.isInteger(state.refreshesUsed)
    || state.refreshesUsed < 0
    || state.refreshesUsed > REFERENCE_POLICY.rewards.freeRefreshCount
    || state.refreshesRemaining !== REFERENCE_POLICY.rewards.freeRefreshCount - state.refreshesUsed
    || !Number.isInteger(state.revision)
    || !Array.isArray(state.choices)
    || state.choices.length !== REFERENCE_POLICY.rewards.choiceCount
    || new Set(state.choices).size !== state.choices.length
    || !state.choices.every((id) => state.candidateIds.includes(id))
    || !(state.selectedRewardId === null || state.choices.includes(state.selectedRewardId))
  ) return false;

  const expectedRevision = state.refreshesUsed + (state.selectedRewardId === null ? 0 : 1);
  if (state.revision !== expectedRevision) return false;
  const expected = deriveOffer(state.seed, state.candidateIds, state.refreshesUsed);
  return JSON.stringify(state.choices) === JSON.stringify(expected.choices)
    && state.rng?.algorithm === expected.rng.algorithm
    && state.rng?.state === expected.rng.state;
}

function stateSnapshot(value) {
  try {
    const snapshot = cloneJsonData(value, "invalid-reward-state");
    return validStateSnapshot(snapshot) ? deepFreeze(snapshot) : null;
  } catch {
    return null;
  }
}

function commandSnapshot(value) {
  try {
    const snapshot = cloneJsonData(value, "invalid-reward-command");
    return snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot : null;
  } catch {
    return null;
  }
}

function receipt(value) {
  return Object.freeze(value);
}

export function isRewardState(value) {
  return stateSnapshot(value) !== null;
}

export function createRewardOffer(input = {}) {
  let request;
  try {
    request = cloneJsonData(input, "invalid-reward-offer-input");
  } catch {
    throw new TypeError("invalid-reward-offer-input");
  }
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new TypeError("invalid-reward-offer-input");
  }
  if (typeof request.offerId !== "string" || request.offerId.length === 0) {
    throw new TypeError("invalid-reward-offer-id");
  }
  if (!validSeed(request.seed)) throw new TypeError("invalid-reward-seed");
  if (!validCandidateIds(request.candidateIds)) throw new TypeError("invalid-reward-candidates");

  const draw = deriveOffer(request.seed, request.candidateIds, 0);
  return deepFreeze({
    version: REWARD_STATE_VERSION,
    baselineVersion: REFERENCE_POLICY.id,
    offerId: request.offerId,
    seed: request.seed,
    candidateIds: [...request.candidateIds],
    choices: draw.choices,
    rng: draw.rng,
    refreshesUsed: 0,
    refreshesRemaining: REFERENCE_POLICY.rewards.freeRefreshCount,
    revision: 0,
    selectedRewardId: null,
  });
}

export function refreshRewardOffer(value, command) {
  const state = stateSnapshot(value);
  if (!state) return receipt({ ok: false, reason: "invalid-reward-state", state: null });
  const request = commandSnapshot(command);
  if (!request) return receipt({ ok: false, reason: "invalid-reward-command", state });
  if (request.offerId !== state.offerId) {
    return receipt({ ok: false, reason: "reward-offer-mismatch", state });
  }
  if (request.expectedRevision !== state.revision) {
    return receipt({ ok: false, reason: "stale-reward-offer", state });
  }
  if (state.selectedRewardId !== null) {
    return receipt({ ok: false, reason: "reward-already-selected", state });
  }
  if (state.refreshesRemaining === 0) {
    return receipt({ ok: false, reason: "refresh-exhausted", state });
  }

  const refreshesUsed = state.refreshesUsed + 1;
  const draw = deriveOffer(state.seed, state.candidateIds, refreshesUsed);
  const nextState = deepFreeze({
    ...state,
    choices: draw.choices,
    rng: draw.rng,
    refreshesUsed,
    refreshesRemaining: REFERENCE_POLICY.rewards.freeRefreshCount - refreshesUsed,
    revision: state.revision + 1,
  });
  return receipt({ ok: true, refreshed: true, state: nextState });
}

export function selectReward(value, command) {
  const state = stateSnapshot(value);
  if (!state) return receipt({ ok: false, reason: "invalid-reward-state", state: null });
  const request = commandSnapshot(command);
  if (!request) return receipt({ ok: false, reason: "invalid-reward-command", state });
  if (request.offerId !== state.offerId) {
    return receipt({ ok: false, reason: "reward-offer-mismatch", state });
  }

  if (state.selectedRewardId !== null) {
    if (
      request.rewardId === state.selectedRewardId
      && (request.expectedRevision === state.revision || request.expectedRevision === state.revision - 1)
    ) {
      return receipt({
        ok: true,
        selected: false,
        reward: getReferenceReward(state.selectedRewardId),
        state,
      });
    }
    return receipt({ ok: false, reason: "reward-already-selected", state });
  }
  if (request.expectedRevision !== state.revision) {
    return receipt({ ok: false, reason: "stale-reward-offer", state });
  }
  if (!state.choices.includes(request.rewardId)) {
    return receipt({ ok: false, reason: "reward-not-offered", state });
  }

  const nextState = deepFreeze({
    ...state,
    revision: state.revision + 1,
    selectedRewardId: request.rewardId,
  });
  return receipt({
    ok: true,
    selected: true,
    reward: getReferenceReward(request.rewardId),
    state: nextState,
  });
}
