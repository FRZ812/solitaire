import { cloneJsonData } from "../kernel/json-data.js";
import { encounterIntentFromState, createIntentState } from "../kernel/intent.js";
import { createEncounter, isEncounterState } from "../kernel/model.js";
import { resolveCommand } from "../kernel/resolve.js";
import { TRAIT_LEVEL_CAP } from "../reference/abilities.js";
import { ARCTIC_KNIGHT, createReferencePlayer } from "../reference/characters.js";
import { ARCTIC_KNIGHT_ACT_1 } from "../reference/encounters.js";
import { getReferenceEnemy } from "../reference/enemies.js";
import { REFERENCE_POLICY } from "../reference/policy.js";
import { getReferenceReward, referenceRewardIds } from "../reference/rewards.js";
import { getReferenceSkill } from "../reference/skills.js";
import {
  chooseActionProgressionOffer,
  createActionProgressionState,
  filterActionProgressionOffers,
  isActionProgressionState,
} from "./action-progression.js";
import {
  createBuild,
  deriveBuild,
  equipItem,
  grantBaseTrait,
  isBuildState,
} from "./build.js";
import {
  createRewardOffer,
  isRewardState,
  refreshRewardOffer,
  selectReward,
} from "./rewards.js";

export const REFERENCE_RUN_STATE_VERSION = 1;

const RUN_KEYS = Object.freeze([
  "actId",
  "actionProgression",
  "baselineVersion",
  "build",
  "characterId",
  "completedStepIds",
  "currentStep",
  "encounter",
  "events",
  "mode",
  "phase",
  "player",
  "rewardClaims",
  "rewardOffer",
  "runId",
  "seed",
  "sequence",
  "skillIds",
  "status",
  "stepIndex",
  "version",
].sort());
const MODES = new Set(["full", "gatekeeper-preview"]);
const STATUSES = new Set(["active", "blocked", "completed", "defeated"]);
const PHASES = new Set(["content-gap", "encounter", "reward", "complete"]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return value;
}

function validSeed(seed) {
  return (typeof seed === "string" && seed.length > 0)
    || (typeof seed === "number" && Number.isFinite(seed));
}

function validEvents(events, sequence) {
  return Array.isArray(events)
    && Number.isInteger(sequence)
    && sequence >= 0
    && events.length === sequence
    && events.every((event, index) => (
      event
      && typeof event === "object"
      && !Array.isArray(event)
      && event.sequence === index + 1
      && typeof event.type === "string"
      && event.type.length > 0
    ));
}

function validClaims(claims) {
  if (!Array.isArray(claims)) return false;
  const offerIds = new Set();
  return claims.every((claim) => {
    const valid = claim
      && typeof claim === "object"
      && !Array.isArray(claim)
      && typeof claim.offerId === "string"
      && claim.offerId.length > 0
      && typeof claim.rewardId === "string"
      && getReferenceReward(claim.rewardId)
      && !offerIds.has(claim.offerId);
    if (valid) offerIds.add(claim.offerId);
    return Boolean(valid);
  });
}

function phaseIsConsistent(state) {
  if (state.phase === "content-gap") {
    return state.status === "blocked"
      && state.currentStep.enemyId === null
      && state.encounter === null
      && state.rewardOffer === null;
  }
  if (state.phase === "encounter") {
    return state.status === "active"
      && state.encounter?.phase === "player"
      && state.rewardOffer === null;
  }
  if (state.phase === "reward") {
    return state.status === "active"
      && state.encounter?.phase === "victory"
      && state.rewardOffer?.selectedRewardId === null;
  }
  if (state.status === "defeated") {
    return state.encounter?.phase === "defeat" && state.rewardOffer === null;
  }
  return state.status === "completed"
    && state.encounter?.phase === "victory"
    && state.rewardOffer?.selectedRewardId !== null;
}

function validRunSnapshot(state) {
  if (
    !state
    || typeof state !== "object"
    || Array.isArray(state)
    || JSON.stringify(Object.keys(state).sort()) !== JSON.stringify(RUN_KEYS)
    || state.version !== REFERENCE_RUN_STATE_VERSION
    || state.baselineVersion !== REFERENCE_POLICY.id
    || typeof state.runId !== "string"
    || state.runId.length === 0
    || !validSeed(state.seed)
    || state.characterId !== ARCTIC_KNIGHT.id
    || state.actId !== ARCTIC_KNIGHT_ACT_1.id
    || !MODES.has(state.mode)
    || !STATUSES.has(state.status)
    || !PHASES.has(state.phase)
    || !Number.isInteger(state.stepIndex)
    || state.stepIndex < 0
    || state.stepIndex >= ARCTIC_KNIGHT_ACT_1.steps.length
    || JSON.stringify(state.currentStep) !== JSON.stringify(ARCTIC_KNIGHT_ACT_1.steps[state.stepIndex])
    || !state.player
    || typeof state.player !== "object"
    || Array.isArray(state.player)
    || typeof state.player.hp !== "number"
    || !Number.isFinite(state.player.hp)
    || state.player.hp < 0
    || typeof state.player.maxHp !== "number"
    || !Number.isFinite(state.player.maxHp)
    || state.player.maxHp <= 0
    || state.player.hp > state.player.maxHp
    || !isBuildState(state.build)
    || !isActionProgressionState(state.actionProgression)
    || !Array.isArray(state.skillIds)
    || new Set(state.skillIds).size !== state.skillIds.length
    || !state.skillIds.every((id) => typeof id === "string" && getReferenceSkill(id))
    || !(state.encounter === null || isEncounterState(state.encounter))
    || !(state.rewardOffer === null || isRewardState(state.rewardOffer))
    || !validClaims(state.rewardClaims)
    || !Array.isArray(state.completedStepIds)
    || new Set(state.completedStepIds).size !== state.completedStepIds.length
    || !state.completedStepIds.every((stepId) => (
      ARCTIC_KNIGHT_ACT_1.steps.some((step) => step.id === stepId)
    ))
    || !validEvents(state.events, state.sequence)
  ) return false;

  if (state.mode === "gatekeeper-preview" && state.stepIndex !== ARCTIC_KNIGHT_ACT_1.steps.length - 1) {
    return false;
  }
  if (state.encounter !== null) {
    const player = state.encounter.actors[state.encounter.playerId];
    if (
      state.encounter.enemyIds.length !== 1
      || state.encounter.enemyIds[0] !== state.currentStep.enemyId
      || player.hp !== state.player.hp
      || player.maxHp !== state.player.maxHp
    ) return false;
  }
  if (state.rewardOffer !== null) {
    const expectedOfferId = `${state.runId}:${state.currentStep.id}:reward`;
    if (state.rewardOffer.offerId !== expectedOfferId) return false;
    const claim = state.rewardClaims.find(({ offerId }) => offerId === expectedOfferId);
    if (state.rewardOffer.selectedRewardId === null ? Boolean(claim) : claim?.rewardId !== state.rewardOffer.selectedRewardId) {
      return false;
    }
  }
  return phaseIsConsistent(state);
}

function canonicalRun(value) {
  try {
    const snapshot = cloneJsonData(value, "invalid-run-state");
    return validRunSnapshot(snapshot) ? deepFreeze(snapshot) : null;
  } catch {
    return null;
  }
}

function rejected(reason, state = null) {
  return Object.freeze({ ok: false, reason, state, events: Object.freeze([]) });
}

function freezeReceipt(value) {
  return deepFreeze(value);
}

function appendEvent(state, event) {
  const sequence = state.sequence + 1;
  state.sequence = sequence;
  state.events.push({ sequence, ...event });
}

function currentAttackId(actionProgression) {
  return actionProgression.actions.attack.actionId;
}

function encounterForStep(runState, step) {
  const enemy = getReferenceEnemy(step.enemyId);
  if (!enemy) return null;
  const intentResult = createIntentState({
    seed: `${runState.seed}:${step.id}:intent`,
    patternId: enemy.intentPatternId,
  });
  if (!intentResult.ok) return null;
  const player = createReferencePlayer(runState.characterId, { actorId: runState.characterId });
  const derived = deriveBuild(runState.build);
  player.hp = runState.player.hp;
  player.maxHp = runState.player.maxHp;
  player.stats = derived.stats;
  player.actions = [currentAttackId(runState.actionProgression), "basic-defense"];
  player.skills = [...runState.skillIds];
  return createEncounter({
    seed: `${runState.seed}:${step.id}:combat`,
    player,
    enemy: {
      id: enemy.id,
      name: enemy.name,
      hp: enemy.maxHp,
      maxHp: enemy.maxHp,
      stats: {},
      intentState: intentResult.state,
      intent: encounterIntentFromState(intentResult.state, player.id),
    },
  });
}

function rewardCandidateIds(runState) {
  const allIds = referenceRewardIds();
  const derivedTraits = deriveBuild(runState.build).traits;
  const actionRewards = allIds.filter((rewardId) => getReferenceReward(rewardId)?.kind === "action");
  const eligibleActionOffers = new Set(filterActionProgressionOffers(
    runState.actionProgression,
    actionRewards.map((rewardId) => getReferenceReward(rewardId).actionOfferId),
  ));
  return allIds.filter((rewardId) => {
    const reward = getReferenceReward(rewardId);
    if (reward.kind === "action") return eligibleActionOffers.has(reward.actionOfferId);
    if (reward.kind === "trait") {
      return (derivedTraits[reward.traitId] || 0) < TRAIT_LEVEL_CAP;
    }
    return reward.kind === "item";
  });
}

function openRewardOffer(runState) {
  return createRewardOffer({
    offerId: `${runState.runId}:${runState.currentStep.id}:reward`,
    seed: `${runState.seed}:${runState.currentStep.id}:reward`,
    candidateIds: rewardCandidateIds(runState),
  });
}

function applyReward(runState, reward, offerId) {
  if (reward.kind === "action") {
    const result = chooseActionProgressionOffer(runState.actionProgression, reward.actionOfferId);
    return result.ok
      ? { ok: true, actionProgression: result.state, build: runState.build, events: result.events }
      : { ok: false, reason: result.reason };
  }
  if (reward.kind === "item") {
    const result = equipItem(runState.build, {
      instanceId: `${offerId}:${reward.id}`,
      itemId: reward.itemId,
    });
    return result.ok
      ? { ok: true, actionProgression: runState.actionProgression, build: result.build, events: [] }
      : { ok: false, reason: result.reason };
  }
  if (reward.kind === "trait") {
    const result = grantBaseTrait(runState.build, {
      traitId: reward.traitId,
      levels: reward.levels,
    });
    return result.ok
      ? { ok: true, actionProgression: runState.actionProgression, build: result.build, events: [] }
      : { ok: false, reason: result.reason };
  }
  return { ok: false, reason: "unsupported-reward-kind" };
}

function createRun(input, mode, stepIndex) {
  let request;
  try {
    request = cloneJsonData(input, "invalid-run-input");
  } catch {
    throw new TypeError("invalid-run-input");
  }
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new TypeError("invalid-run-input");
  }
  if (typeof request.runId !== "string" || request.runId.length === 0) {
    throw new TypeError("invalid-run-id");
  }
  if (!validSeed(request.seed)) throw new TypeError("invalid-run-seed");

  const build = createBuild({ stats: ARCTIC_KNIGHT.starting.stats });
  const actionProgression = createActionProgressionState();
  const currentStep = ARCTIC_KNIGHT_ACT_1.steps[stepIndex];
  const run = {
    version: REFERENCE_RUN_STATE_VERSION,
    baselineVersion: REFERENCE_POLICY.id,
    runId: request.runId,
    seed: request.seed,
    characterId: ARCTIC_KNIGHT.id,
    actId: ARCTIC_KNIGHT_ACT_1.id,
    mode,
    status: currentStep.enemyId === null ? "blocked" : "active",
    phase: currentStep.enemyId === null ? "content-gap" : "encounter",
    stepIndex,
    currentStep: cloneJsonData(currentStep),
    player: { hp: ARCTIC_KNIGHT.starting.maxHp, maxHp: ARCTIC_KNIGHT.starting.maxHp },
    build,
    actionProgression,
    skillIds: [...ARCTIC_KNIGHT.starting.skills],
    encounter: null,
    rewardOffer: null,
    rewardClaims: [],
    completedStepIds: [],
    sequence: 0,
    events: [],
  };
  if (currentStep.enemyId !== null) run.encounter = encounterForStep(run, currentStep);
  if (!validRunSnapshot(run)) throw new TypeError("invalid-run-state");
  return deepFreeze(run);
}

export function isReferenceRunState(value) {
  return canonicalRun(value) !== null;
}

export function createArcticKnightRun(input = {}) {
  return createRun(input, "full", 0);
}

export function createArcticKnightGatekeeperRun(input = {}) {
  return createRun(input, "gatekeeper-preview", ARCTIC_KNIGHT_ACT_1.steps.length - 1);
}

export function resolveRunCommand(value, command) {
  const state = canonicalRun(value);
  if (!state) return rejected("invalid-run-state");
  if (state.phase !== "encounter") return rejected("run-not-in-encounter", state);
  let request;
  try {
    request = cloneJsonData(command, "invalid-run-command");
  } catch {
    return rejected("invalid-run-command", state);
  }
  if (request?.expectedRunSequence !== state.sequence) {
    return rejected("stale-run-state", state);
  }
  delete request.expectedRunSequence;
  const resolution = resolveCommand(state.encounter, request);
  if (!resolution.ok) return rejected(resolution.reason, state);

  const next = cloneJsonData(state);
  next.encounter = resolution.state;
  const player = resolution.state.actors[resolution.state.playerId];
  next.player = { hp: player.hp, maxHp: player.maxHp };
  appendEvent(next, {
    type: "combat-command-resolved",
    commandType: request.type,
    encounterEventCount: resolution.events.length,
    outcome: resolution.state.phase === "victory"
      ? "victory"
      : resolution.state.phase === "defeat"
        ? "defeat"
        : null,
  });
  if (resolution.state.phase === "victory") {
    next.phase = "reward";
    next.rewardOffer = openRewardOffer(next);
  } else if (resolution.state.phase === "defeat") {
    next.phase = "complete";
    next.status = "defeated";
  }
  if (!validRunSnapshot(next)) return rejected("invalid-run-transition", state);
  return freezeReceipt({
    ok: true,
    state: deepFreeze(next),
    events: cloneJsonData(resolution.events),
  });
}

export function refreshRunReward(value, command) {
  const state = canonicalRun(value);
  if (!state) return rejected("invalid-run-state");
  if (state.phase !== "reward") return rejected("run-not-in-reward", state);
  let request;
  try {
    request = cloneJsonData(command, "invalid-reward-command");
  } catch {
    return rejected("invalid-reward-command", state);
  }
  if (request?.expectedRunSequence !== state.sequence) {
    return rejected("stale-run-state", state);
  }
  const refreshed = refreshRewardOffer(state.rewardOffer, request);
  if (!refreshed.ok) return rejected(refreshed.reason, state);

  const next = cloneJsonData(state);
  next.rewardOffer = refreshed.state;
  appendEvent(next, {
    type: "reward-refreshed",
    offerId: refreshed.state.offerId,
    revision: refreshed.state.revision,
  });
  if (!validRunSnapshot(next)) return rejected("invalid-run-transition", state);
  const event = next.events.at(-1);
  return freezeReceipt({ ok: true, refreshed: true, state: deepFreeze(next), events: [event] });
}

export function claimRunReward(value, command) {
  const state = canonicalRun(value);
  if (!state) return rejected("invalid-run-state");
  let request;
  try {
    request = cloneJsonData(command, "invalid-reward-command");
  } catch {
    return rejected("invalid-reward-command", state);
  }
  const existing = state.rewardClaims.find(({ offerId }) => offerId === request?.offerId);
  if (existing) {
    if (existing.rewardId !== request.rewardId) return rejected("reward-already-claimed", state);
    return freezeReceipt({
      ok: true,
      applied: false,
      reward: getReferenceReward(existing.rewardId),
      state,
      events: Object.freeze([]),
    });
  }
  if (state.phase !== "reward") return rejected("run-not-in-reward", state);
  if (request?.expectedRunSequence !== state.sequence) {
    return rejected("stale-run-state", state);
  }

  const selected = selectReward(state.rewardOffer, request);
  if (!selected.ok) return rejected(selected.reason, state);
  const application = applyReward(state, selected.reward, selected.state.offerId);
  if (!application.ok) return rejected("reward-application-failed", state);

  const next = cloneJsonData(state);
  next.rewardOffer = selected.state;
  next.actionProgression = application.actionProgression;
  next.build = application.build;
  next.rewardClaims.push({ offerId: selected.state.offerId, rewardId: selected.reward.id });
  next.completedStepIds.push(next.currentStep.id);
  next.status = "completed";
  next.phase = "complete";
  appendEvent(next, {
    type: "reward-claimed",
    offerId: selected.state.offerId,
    rewardId: selected.reward.id,
    rewardKind: selected.reward.kind,
  });
  if (!validRunSnapshot(next)) return rejected("invalid-run-transition", state);
  const event = next.events.at(-1);
  return freezeReceipt({
    ok: true,
    applied: true,
    reward: selected.reward,
    state: deepFreeze(next),
    events: [...application.events, event],
  });
}
