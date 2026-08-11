import { cloneJsonData, equalJsonData } from "../kernel/json-data.js";
import { encounterIntentFromState, createIntentState } from "../kernel/intent.js";
import { createEncounter, isEncounterState } from "../kernel/model.js";
import { replayCommandSequence, resolveCommand } from "../kernel/resolve.js";
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

export const REFERENCE_RUN_STATE_VERSION = 2;
export const MAX_RUN_TRANSITIONS = 4096;
export const MAX_RUN_ID_CODE_UNITS = 256;
export const MAX_RUN_SEED_CODE_UNITS = 256;

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
  "history",
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
const authoritativeRuns = new WeakSet();

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return value;
}

function authoritativeRun(value) {
  const frozen = deepFreeze(value);
  authoritativeRuns.add(frozen);
  return frozen;
}

function validSeed(seed) {
  return (typeof seed === "string" && seed.length > 0 && seed.length <= MAX_RUN_SEED_CODE_UNITS)
    || Number.isSafeInteger(seed);
}

function validRunId(runId) {
  return typeof runId === "string"
    && runId.length > 0
    && runId.length <= MAX_RUN_ID_CODE_UNITS;
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

function exactKeys(value, keys) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && equalJsonData(Object.keys(value).sort(), [...keys].sort());
}

function validHistoryCommand(entry) {
  if (!exactKeys(entry, ["command", "type"])) return false;
  const command = entry.command;
  if (entry.type === "combat-command") {
    const common = typeof command?.actorId === "string"
      && typeof command?.targetId === "string";
    if (!common) return false;
    if (command.type === "use-action") {
      return exactKeys(command, ["actionId", "actorId", "targetId", "type"])
        && typeof command.actionId === "string";
    }
    return command.type === "use-skill"
      && exactKeys(command, ["actorId", "skillId", "targetId", "type"])
      && typeof command.skillId === "string";
  }
  if (entry.type === "reward-refresh") {
    return exactKeys(command, ["expectedRevision", "offerId"])
      && typeof command.offerId === "string"
      && Number.isInteger(command.expectedRevision);
  }
  if (entry.type === "reward-claim") {
    return exactKeys(command, ["expectedRevision", "offerId", "rewardId"])
      && typeof command.offerId === "string"
      && typeof command.rewardId === "string"
      && Number.isInteger(command.expectedRevision);
  }
  return false;
}

function validHistory(history, sequence) {
  return Array.isArray(history)
    && history.length === sequence
    && history.length <= MAX_RUN_TRANSITIONS
    && history.every(validHistoryCommand);
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
    if (state.currentStep.enemyId === null) {
      return state.status === "blocked"
        && state.rewardOffer === null
        && state.encounter === null;
    }
    if (state.encounter?.phase !== "victory") return false;
    if (state.status === "blocked") return state.rewardOffer === null;
    return state.status === "completed"
      && state.rewardOffer?.selectedRewardId !== null
      && state.completedStepIds.includes(state.currentStep.id);
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
    || !validRunId(state.runId)
    || !validSeed(state.seed)
    || state.characterId !== ARCTIC_KNIGHT.id
    || state.actId !== ARCTIC_KNIGHT_ACT_1.id
    || !MODES.has(state.mode)
    || !STATUSES.has(state.status)
    || !PHASES.has(state.phase)
    || !Number.isInteger(state.stepIndex)
    || state.stepIndex < 0
    || state.stepIndex >= ARCTIC_KNIGHT_ACT_1.steps.length
    || !equalJsonData(state.currentStep, ARCTIC_KNIGHT_ACT_1.steps[state.stepIndex])
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
    || !validHistory(state.history, state.sequence)
  ) return false;

  if (state.mode === "gatekeeper-preview" && state.stepIndex !== ARCTIC_KNIGHT_ACT_1.steps.length - 1) {
    return false;
  }
  if (state.encounter !== null) {
    const player = state.encounter.actors[state.encounter.playerId];
    const enemyId = state.encounter.enemyIds[0];
    const enemyActor = state.encounter.actors[enemyId];
    const enemy = getReferenceEnemy(state.currentStep.enemyId);
    const derived = deriveBuild(state.build);
    const expectedActions = [currentAttackId(state.actionProgression), "basic-defense"];
    const settledAfterReward = state.phase === "content-gap" && state.status === "completed";
    if (
      state.encounter.enemyIds.length !== 1
      || enemyId !== state.currentStep.enemyId
      || !enemy
      || player.hp !== state.player.hp
      || player.maxHp !== state.player.maxHp
      || (!settledAfterReward && !equalJsonData(player.stats, derived.stats))
      || (!settledAfterReward && !equalJsonData(player.actions, expectedActions))
      || !equalJsonData(player.skills.map(({ id }) => id), state.skillIds)
      || enemyActor.name !== enemy.name
      || enemyActor.maxHp !== enemy.maxHp
      || (state.encounter.phase === "player"
        && enemyActor.intentState?.patternId !== enemy.intentPatternId)
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

function replayRunHistory(state) {
  const stepIndex = state.mode === "gatekeeper-preview"
    ? ARCTIC_KNIGHT_ACT_1.steps.length - 1
    : 0;
  let expected;
  try {
    expected = cloneJsonData(
      createRun({ runId: state.runId, seed: state.seed }, state.mode, stepIndex),
    );
  } catch {
    return false;
  }
  let historyIndex = 0;
  const combatEntries = [];
  while (state.history[historyIndex]?.type === "combat-command") {
    combatEntries.push(state.history[historyIndex]);
    historyIndex += 1;
  }
  if (combatEntries.length > 0) {
    if (expected.phase !== "encounter" || !expected.encounter) return false;
    const replay = replayCommandSequence(
      expected.encounter,
      combatEntries.map((entry) => entry.command),
    );
    if (!replay.ok || replay.steps.length !== combatEntries.length) return false;
    for (let index = 0; index < combatEntries.length; index += 1) {
      const entry = combatEntries[index];
      const step = replay.steps[index];
      expected.player = step.player;
      appendEvent(expected, {
        type: "combat-command-resolved",
        commandType: entry.command.type,
        encounterEventCount: step.events.length,
        outcome: step.phase === "victory"
          ? "victory"
          : step.phase === "defeat"
            ? "defeat"
            : null,
      });
      expected.history.push({
        type: "combat-command",
        command: cloneJsonData(entry.command),
      });
    }
    expected.encounter = replay.state;
    if (replay.state.phase === "victory") {
      const drafted = draftReferenceRunRewardOffer(expected);
      expected.phase = drafted.ok ? "reward" : "content-gap";
      expected.status = drafted.ok ? "active" : "blocked";
      expected.rewardOffer = drafted.ok ? drafted.state : null;
    } else if (replay.state.phase === "defeat") {
      expected.phase = "complete";
      expected.status = "defeated";
    }
  }
  for (; historyIndex < state.history.length; historyIndex += 1) {
    const entry = state.history[historyIndex];
    if (entry.type === "combat-command") return false;
    const command = { ...cloneJsonData(entry.command), expectedRunSequence: expected.sequence };
    const result = entry.type === "reward-refresh"
      ? refreshRunRewardInternal(expected, command, true)
      : claimRunRewardInternal(expected, command, true);
    if (!result.ok) return false;
    expected = result.state;
  }
  return validRunSnapshot(expected) && equalJsonData(expected, state);
}

function canonicalRun(value) {
  if (value && typeof value === "object" && authoritativeRuns.has(value)) return value;
  try {
    const snapshot = cloneJsonData(value, "invalid-run-state");
    return validRunSnapshot(snapshot) && replayRunHistory(snapshot)
      ? authoritativeRun(snapshot)
      : null;
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

export function draftReferenceRunRewardOffer(value) {
  let runState;
  try {
    runState = cloneJsonData(value, "invalid-reward-context");
  } catch {
    return deepFreeze({ ok: false, reason: "invalid-reward-context", candidateIds: [] });
  }
  if (
    !runState
    || typeof runState !== "object"
    || !validRunId(runState.runId)
    || !validSeed(runState.seed)
    || typeof runState.currentStep?.id !== "string"
    || !isBuildState(runState.build)
    || !isActionProgressionState(runState.actionProgression)
  ) return deepFreeze({ ok: false, reason: "invalid-reward-context", candidateIds: [] });

  const candidateIds = rewardCandidateIds(runState);
  const minimum = REFERENCE_POLICY.rewards.choiceCount + 1;
  if (candidateIds.length < minimum) {
    return deepFreeze({ ok: false, reason: "insufficient-reward-candidates", candidateIds });
  }
  return deepFreeze({
    ok: true,
    state: createRewardOffer({
      offerId: `${runState.runId}:${runState.currentStep.id}:reward`,
      seed: `${runState.seed}:${runState.currentStep.id}:reward`,
      candidateIds,
    }),
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
    return result.ok && result.applied
      ? { ok: true, actionProgression: runState.actionProgression, build: result.build, events: [] }
      : { ok: false, reason: result.reason || "reward-no-longer-eligible" };
  }
  if (reward.kind === "trait") {
    const result = grantBaseTrait(runState.build, {
      traitId: reward.traitId,
      levels: reward.levels,
    });
    return result.ok && result.applied
      ? { ok: true, actionProgression: runState.actionProgression, build: result.build, events: [] }
      : { ok: false, reason: result.reason || "reward-no-longer-eligible" };
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
  if (!validRunId(request.runId)) {
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
    history: [],
  };
  if (currentStep.enemyId !== null) run.encounter = encounterForStep(run, currentStep);
  if (!validRunSnapshot(run)) throw new TypeError("invalid-run-state");
  return authoritativeRun(run);
}

export function isReferenceRunState(value) {
  return canonicalRun(value) !== null;
}

export function canonicalizeReferenceRunState(value) {
  return canonicalRun(value);
}

export function createArcticKnightRun(input = {}) {
  return createRun(input, "full", 0);
}

export function createArcticKnightGatekeeperRun(input = {}) {
  return createRun(input, "gatekeeper-preview", ARCTIC_KNIGHT_ACT_1.steps.length - 1);
}

function resolveRunCommandInternal(value, command) {
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
  next.history.push({ type: "combat-command", command: cloneJsonData(request) });
  if (resolution.state.phase === "victory") {
    const drafted = draftReferenceRunRewardOffer(next);
    next.phase = drafted.ok ? "reward" : "content-gap";
    next.status = drafted.ok ? "active" : "blocked";
    next.rewardOffer = drafted.ok ? drafted.state : null;
  } else if (resolution.state.phase === "defeat") {
    next.phase = "complete";
    next.status = "defeated";
  }
  if (!validRunSnapshot(next)) return rejected("invalid-run-transition", state);
  const receipt = {
    ok: true,
    state: authoritativeRun(next),
    events: cloneJsonData(resolution.events),
  };
  return freezeReceipt(receipt);
}

export function resolveRunCommand(value, command) {
  return resolveRunCommandInternal(value, command);
}

function refreshRunRewardInternal(value, command, trusted = false) {
  const state = trusted ? value : canonicalRun(value);
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

  const next = trusted ? state : cloneJsonData(state);
  next.rewardOffer = refreshed.state;
  appendEvent(next, {
    type: "reward-refreshed",
    offerId: refreshed.state.offerId,
    revision: refreshed.state.revision,
  });
  next.history.push({
    type: "reward-refresh",
    command: {
      offerId: request.offerId,
      expectedRevision: request.expectedRevision,
    },
  });
  if (!trusted && !validRunSnapshot(next)) return rejected("invalid-run-transition", state);
  const event = next.events.at(-1);
  const receipt = {
    ok: true,
    refreshed: true,
    state: trusted ? next : authoritativeRun(next),
    events: [event],
  };
  return trusted ? receipt : freezeReceipt(receipt);
}

export function refreshRunReward(value, command) {
  return refreshRunRewardInternal(value, command);
}

function claimRunRewardInternal(value, command, trusted = false) {
  const state = trusted ? value : canonicalRun(value);
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

  const next = trusted ? state : cloneJsonData(state);
  next.rewardOffer = selected.state;
  next.actionProgression = application.actionProgression;
  next.build = application.build;
  next.rewardClaims.push({ offerId: selected.state.offerId, rewardId: selected.reward.id });
  next.completedStepIds.push(next.currentStep.id);
  next.status = "completed";
  next.phase = "content-gap";
  appendEvent(next, {
    type: "reward-claimed",
    offerId: selected.state.offerId,
    rewardId: selected.reward.id,
    rewardKind: selected.reward.kind,
  });
  next.history.push({
    type: "reward-claim",
    command: {
      offerId: request.offerId,
      expectedRevision: request.expectedRevision,
      rewardId: request.rewardId,
    },
  });
  if (!trusted && !validRunSnapshot(next)) return rejected("invalid-run-transition", state);
  const event = next.events.at(-1);
  const receipt = {
    ok: true,
    applied: true,
    reward: selected.reward,
    state: trusted ? next : authoritativeRun(next),
    events: [...application.events, event],
  };
  return trusted ? receipt : freezeReceipt(receipt);
}

export function claimRunReward(value, command) {
  return claimRunRewardInternal(value, command);
}
