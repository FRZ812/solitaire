import { equalJsonData } from "../kernel/json-data.js";
import { ARCTIC_KNIGHT_ACT_1 } from "../reference/encounters.js";
import {
  MAX_RUN_ID_CODE_UNITS,
  MAX_RUN_SEED_CODE_UNITS,
  createArcticKnightGatekeeperRun,
} from "./state.js";
import { createGameplaySave, restoreGameplaySave } from "./persistence.js";

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function campaignSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  let descriptors;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return null;
  }
  if (Reflect.ownKeys(descriptors).some((key) => typeof key === "symbol")) return null;
  const snapshot = {};
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!descriptor.enumerable) continue;
    if (!("value" in descriptor)) return null;
    Object.defineProperty(snapshot, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: descriptor.value,
    });
  }
  return snapshot;
}

function ownData(value, key) {
  if (!value || typeof value !== "object") return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function campaignIdentity(campaignId) {
  return typeof campaignId === "string" && campaignId.length > 0
    ? campaignId
    : "local-campaign";
}

function referenceAttempt(snapshot) {
  if (!hasOwn(snapshot, "referenceGameplayAttempt")) return 0;
  return Number.isSafeInteger(snapshot.referenceGameplayAttempt)
    && snapshot.referenceGameplayAttempt >= 0
    ? snapshot.referenceGameplayAttempt
    : null;
}

function campaignSeed(state, campaignId) {
  const seed = ownData(ownData(state, "world"), "seed");
  return (typeof seed === "string" && seed.length > 0) || Number.isSafeInteger(seed)
    ? String(seed)
    : campaignIdentity(campaignId);
}

function referenceCampaignSeed(snapshot) {
  const seed = ownData(snapshot, "referenceGameplayCampaignSeed");
  return typeof seed === "string" && seed.length > 0 ? seed : null;
}

export function readReferenceGameplay(campaignState, { campaignId } = {}) {
  const snapshot = campaignSnapshot(campaignState);
  if (!snapshot) {
    return { ok: false, reason: "invalid-campaign-state", run: null };
  }
  if (!hasOwn(snapshot, "referenceGameplaySave") || snapshot.referenceGameplaySave == null) {
    return { ok: false, reason: "no-reference-gameplay-save", run: null };
  }

  const restored = restoreGameplaySave(snapshot.referenceGameplaySave);
  if (!restored.ok) return { ok: false, reason: restored.reason, run: null };
  const attempt = referenceAttempt(snapshot);
  const identity = campaignIdentity(campaignId);
  const lineageSeed = referenceCampaignSeed(snapshot);
  const expectedSeed = attempt === null
    ? null
    : `${lineageSeed}:combat-winter:${attempt}`;
  if (
    attempt === null
    || attempt < 1
    || lineageSeed === null
    || restored.state.runId !== `${identity}:combat-winter:${attempt}`
    || restored.state.seed !== expectedSeed
  ) {
    return { ok: false, reason: "reference-gameplay-lineage-mismatch", run: null };
  }
  const gatekeeperStepIndex = ARCTIC_KNIGHT_ACT_1.steps.length - 1;
  const gatekeeperStep = ARCTIC_KNIGHT_ACT_1.steps[gatekeeperStepIndex];
  if (
    restored.state.mode !== "gatekeeper-preview"
    || restored.state.characterId !== ARCTIC_KNIGHT_ACT_1.characterId
    || restored.state.actId !== ARCTIC_KNIGHT_ACT_1.id
    || restored.state.stepIndex !== gatekeeperStepIndex
    || restored.state.currentStep?.id !== gatekeeperStep.id
    || restored.state.currentStep?.enemyId !== gatekeeperStep.enemyId
  ) {
    return { ok: false, reason: "reference-gameplay-domain-mismatch", run: null };
  }
  return { ok: true, reason: null, run: restored.state };
}

export function startReferenceGatekeeperTrial(
  campaignState,
  { campaignId, previewEnabled = false, replaceInvalid = false } = {},
) {
  const snapshot = campaignSnapshot(campaignState);
  if (!snapshot) {
    return { ok: false, reason: "invalid-campaign-state", state: campaignState, run: null };
  }
  if (previewEnabled !== true) {
    return {
      ok: false,
      reason: "reference-gameplay-preview-disabled",
      state: campaignState,
      run: null,
    };
  }

  const storedAttempt = referenceAttempt(snapshot);
  if (storedAttempt === null && replaceInvalid !== true) {
    return { ok: false, reason: "invalid-reference-gameplay-attempt", state: campaignState, run: null };
  }
  const previousAttempt = storedAttempt ?? 0;
  if (previousAttempt === Number.MAX_SAFE_INTEGER) {
    return {
      ok: false,
      reason: "reference-gameplay-attempt-limit-reached",
      state: campaignState,
      run: null,
    };
  }
  const attempt = previousAttempt + 1;
  const identity = campaignIdentity(campaignId);
  const lineageSeed = replaceInvalid === true || previousAttempt === 0
    ? campaignSeed(snapshot, campaignId)
    : referenceCampaignSeed(snapshot);
  if (lineageSeed === null) {
    return {
      ok: false,
      reason: "invalid-reference-gameplay-lineage",
      state: campaignState,
      run: null,
    };
  }
  const seed = `${lineageSeed}:combat-winter:${attempt}`;
  const runId = `${identity}:combat-winter:${attempt}`;
  if (runId.length > MAX_RUN_ID_CODE_UNITS || seed.length > MAX_RUN_SEED_CODE_UNITS) {
    return {
      ok: false,
      reason: "reference-gameplay-lineage-limit-exceeded",
      state: campaignState,
      run: null,
    };
  }
  let run;
  let save;
  try {
    run = createArcticKnightGatekeeperRun({ runId, seed });
    save = createGameplaySave(run);
  } catch {
    return {
      ok: false,
      reason: "invalid-reference-gameplay-lineage",
      state: campaignState,
      run: null,
    };
  }
  const state = {
    ...snapshot,
    referenceGameplayAttempt: attempt,
    referenceGameplayCampaignSeed: lineageSeed,
    referenceGameplayOpen: true,
    referenceGameplaySave: save,
  };

  return { ok: true, reason: null, state, run };
}

export function transitionReferenceGameplay(
  campaignState,
  transition,
  { campaignId, previewEnabled = false } = {},
) {
  const snapshot = campaignSnapshot(campaignState);
  if (!snapshot) {
    return {
      ok: false,
      reason: "invalid-campaign-state",
      state: campaignState,
      run: null,
    };
  }
  if (previewEnabled !== true) {
    return {
      ok: false,
      reason: "reference-gameplay-preview-disabled",
      state: campaignState,
      run: null,
    };
  }
  const restored = readReferenceGameplay(snapshot, { campaignId });
  if (!restored.ok) {
    return {
      ok: false,
      reason: restored.reason,
      state: campaignState,
      run: null,
    };
  }
  if (typeof transition !== "function") {
    return {
      ok: false,
      reason: "invalid-reference-transition",
      state: campaignState,
      run: restored.run,
    };
  }

  let result;
  try {
    result = transition(restored.run);
  } catch {
    return {
      ok: false,
      reason: "invalid-reference-transition",
      state: campaignState,
      run: restored.run,
    };
  }
  if (!result || result.ok !== true || !result.state) {
    return {
      ok: false,
      reason: result?.reason || "invalid-reference-transition",
      state: campaignState,
      run: restored.run,
    };
  }

  let nextSave;
  try {
    nextSave = createGameplaySave(result.state);
  } catch {
    return {
      ok: false,
      reason: "invalid-reference-transition",
      state: campaignState,
      run: restored.run,
    };
  }
  const nextRun = nextSave.runState;
  const unchanged = equalJsonData(nextRun, restored.run);
  const extendsHistory = nextRun.runId === restored.run.runId
    && equalJsonData(nextRun.seed, restored.run.seed)
    && nextRun.sequence === restored.run.sequence + 1
    && nextRun.history.length === restored.run.history.length + 1
    && equalJsonData(nextRun.history.slice(0, -1), restored.run.history);
  if (result.applied === false ? !unchanged : !extendsHistory) {
    return {
      ok: false,
      reason: "non-monotonic-reference-transition",
      state: campaignState,
      run: restored.run,
    };
  }

  const state = {
    ...snapshot,
    referenceGameplayOpen: true,
    referenceGameplaySave: nextSave,
  };
  return {
    ok: true,
    applied: result.applied !== false,
    reason: result.reason || null,
    state,
    run: nextRun,
  };
}

export function closeReferenceGameplay(campaignState, { campaignId } = {}) {
  const snapshot = campaignSnapshot(campaignState);
  if (!snapshot) return campaignState;
  const restored = readReferenceGameplay(snapshot, { campaignId });
  if (!restored.ok || snapshot.referenceGameplayOpen === false) return campaignState;
  let save;
  try {
    save = createGameplaySave(restored.run);
  } catch {
    return campaignState;
  }
  return { ...snapshot, referenceGameplayOpen: false, referenceGameplaySave: save };
}

export function openReferenceGameplay(
  campaignState,
  { campaignId, previewEnabled = false } = {},
) {
  const snapshot = campaignSnapshot(campaignState);
  if (!snapshot) return campaignState;
  if (previewEnabled !== true) return campaignState;
  const restored = readReferenceGameplay(snapshot, { campaignId });
  if (!restored.ok || snapshot.referenceGameplayOpen === true) return campaignState;
  let save;
  try {
    save = createGameplaySave(restored.run);
  } catch {
    return campaignState;
  }
  return { ...snapshot, referenceGameplayOpen: true, referenceGameplaySave: save };
}
