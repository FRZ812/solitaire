import { createRng, nextInt } from "../kernel/rng.js";
import { cloneJsonData, isJsonData } from "../kernel/json-data.js";
import { REFERENCE_POLICY } from "../reference/policy.js";

const REWARD_COUNT = REFERENCE_POLICY.rewards.choiceCount;
const REFRESH_COUNT = REFERENCE_POLICY.rewards.freeRefreshCount;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function validateCandidates(candidates, count) {
  if (!isJsonData(candidates)) throw new TypeError("invalid-reward-candidate");
  if (!Array.isArray(candidates) || candidates.length < count) {
    throw new RangeError("insufficient-reward-candidates");
  }
  const ids = new Set();
  for (const candidate of candidates) {
    if (
      typeof candidate.id !== "string"
      || candidate.id.length === 0
      || typeof candidate.kind !== "string"
      || candidate.kind.length === 0
    ) {
      throw new TypeError("invalid-reward-candidate");
    }
    if (ids.has(candidate.id)) throw new TypeError("duplicate-reward-candidate");
    ids.add(candidate.id);
  }
}

function drawChoices(rng, candidates, count) {
  const remaining = candidates.map((candidate) => cloneJsonData(candidate));
  const choices = [];
  let cursor = rng;
  for (let index = 0; index < count; index += 1) {
    const draw = nextInt(cursor, 0, remaining.length - 1);
    cursor = draw.rng;
    choices.push(remaining.splice(draw.value, 1)[0]);
  }
  return { rng: cursor, choices };
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function sameJsonData(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function isRewardState(state) {
  if (!isJsonData(state) || !state || typeof state !== "object" || Array.isArray(state)) return false;
  if (
    state.count !== REWARD_COUNT
    || !Array.isArray(state.pool)
    || !Array.isArray(state.choices)
    || state.choices.length !== REWARD_COUNT
    || !Number.isInteger(state.refreshesRemaining)
    || state.refreshesRemaining < 0
    || state.refreshesRemaining > REFRESH_COUNT
    || (state.selected !== null && typeof state.selected !== "string")
    || state.rng?.algorithm !== "mulberry32"
    || !Number.isInteger(state.rng?.state)
    || state.rng.state < 0
    || state.rng.state > 0xFFFFFFFF
  ) return false;

  try {
    validateCandidates(state.pool, REWARD_COUNT);
    validateCandidates(state.choices, REWARD_COUNT);
  } catch {
    return false;
  }

  const poolById = new Map(state.pool.map((candidate) => [candidate.id, candidate]));
  if (state.choices.some((choice) => !poolById.has(choice.id) || !sameJsonData(choice, poolById.get(choice.id)))) {
    return false;
  }
  return state.selected === null || state.choices.some((choice) => choice.id === state.selected);
}

function safeState(state) {
  return deepFreeze(cloneJsonData(state));
}

function invalidStateReceipt() {
  return Object.freeze({ ok: false, reason: "invalid-reward-state", state: null });
}

function rejected(state, reason) {
  return deepFreeze({ ok: false, reason, state: safeState(state) });
}

export function createRewardOffer({ seed, candidates, count, refreshes } = {}) {
  if (typeof seed !== "string" && !(typeof seed === "number" && Number.isFinite(seed))) {
    throw new TypeError("invalid-reward-seed");
  }
  if (count !== undefined && count !== REWARD_COUNT) throw new RangeError("invalid-reward-count");
  if (refreshes !== undefined && refreshes !== REFRESH_COUNT) {
    throw new RangeError("invalid-refresh-count");
  }
  validateCandidates(candidates, REWARD_COUNT);
  const draw = drawChoices(createRng(seed), candidates, REWARD_COUNT);
  return deepFreeze({
    rng: draw.rng,
    pool: candidates.map((candidate) => cloneJsonData(candidate)),
    count: REWARD_COUNT,
    choices: draw.choices,
    refreshesRemaining: REFRESH_COUNT,
    selected: null,
  });
}

export function refreshRewardOffer(state) {
  if (!isRewardState(state)) return invalidStateReceipt();
  if (state.selected !== null) return rejected(state, "reward-already-selected");
  if (state.refreshesRemaining <= 0) return rejected(state, "reward-refresh-exhausted");
  const draw = drawChoices(state.rng, state.pool, REWARD_COUNT);
  return deepFreeze({
    ok: true,
    state: {
      rng: draw.rng,
      pool: state.pool.map((candidate) => cloneJsonData(candidate)),
      count: REWARD_COUNT,
      choices: draw.choices,
      refreshesRemaining: state.refreshesRemaining - 1,
      selected: null,
    },
  });
}

export function selectReward(state, rewardId) {
  if (!isRewardState(state)) return invalidStateReceipt();
  const stableState = safeState(state);
  if (typeof rewardId !== "string" || rewardId.length === 0) {
    return rejected(stableState, "unknown-reward-choice");
  }
  if (stableState.selected !== null) {
    const reward = stableState.choices.find((choice) => choice.id === stableState.selected);
    if (stableState.selected === rewardId) {
      return deepFreeze({
        ok: true,
        selected: false,
        reward: cloneJsonData(reward),
        state: stableState,
      });
    }
    return rejected(stableState, "reward-already-selected");
  }
  const reward = stableState.choices.find((choice) => choice.id === rewardId);
  if (!reward) return rejected(stableState, "unknown-reward-choice");
  const nextState = deepFreeze({ ...cloneJsonData(stableState), selected: rewardId });
  return deepFreeze({
    ok: true,
    selected: true,
    reward: cloneJsonData(reward),
    state: nextState,
  });
}
