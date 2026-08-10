import { cloneJsonData } from "./json-data.js";
import { createRng, nextInt } from "./rng.js";
import { getReferenceIntentPattern } from "../reference/enemies.js";

function ownData(object, key) {
  if (!object || typeof object !== "object") return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

function freezeState(patternId, stepIndex, rng, intent) {
  return Object.freeze({
    version: 1,
    patternId,
    stepIndex,
    rng: Object.freeze({ ...rng }),
    intent: Object.freeze({ ...intent }),
  });
}

function declare(pattern, stepIndex, rng) {
  const step = pattern.steps[stepIndex];
  const optionDraw = nextInt(rng, 0, step.options.length - 1);
  const option = step.options[optionDraw.value];
  const damageDraw = nextInt(optionDraw.rng, option.damage.min, option.damage.max);
  return {
    rng: damageDraw.rng,
    intent: {
      id: option.id,
      type: option.type,
      target: option.target,
      damage: damageDraw.value,
    },
  };
}

function validIntentSnapshot(state, pattern) {
  return state
    && typeof state === "object"
    && !Array.isArray(state)
    && state.version === 1
    && state.patternId === pattern.id
    && Number.isInteger(state.stepIndex)
    && state.stepIndex >= 0
    && state.stepIndex < pattern.steps.length
    && state.rng?.algorithm === "mulberry32"
    && Number.isInteger(state.rng?.state)
    && state.rng.state >= 0
    && state.rng.state <= 0xFFFFFFFF
    && typeof state.intent?.id === "string"
    && state.intent.type === "attack"
    && state.intent.target === "player"
    && Number.isInteger(state.intent.damage)
    && state.intent.damage >= 0;
}

function snapshotIntentState(value) {
  try {
    const state = cloneJsonData(value, "invalid-intent-state");
    const pattern = getReferenceIntentPattern(state?.patternId);
    return pattern && validIntentSnapshot(state, pattern) ? { state, pattern } : null;
  } catch {
    return null;
  }
}

export function isIntentState(value) {
  return snapshotIntentState(value) !== null;
}

export function encounterIntentFromState(value, targetId) {
  const canonical = snapshotIntentState(value);
  if (!canonical || typeof targetId !== "string" || targetId.length === 0) {
    throw new TypeError("invalid-intent-state");
  }
  return Object.freeze({
    id: canonical.state.intent.id,
    type: canonical.state.intent.type,
    targetId,
    damage: Object.freeze({
      min: canonical.state.intent.damage,
      max: canonical.state.intent.damage,
    }),
  });
}

export function createIntentState(input = {}) {
  const seed = ownData(input, "seed");
  const patternId = ownData(input, "patternId");
  if (typeof seed !== "string" && !(typeof seed === "number" && Number.isFinite(seed))) {
    return { ok: false, reason: "invalid-intent-seed", state: null };
  }
  const pattern = getReferenceIntentPattern(patternId);
  if (!pattern) return { ok: false, reason: "unknown-intent-pattern", state: null };
  const declaration = declare(pattern, 0, createRng(seed));
  return {
    ok: true,
    state: freezeState(pattern.id, 0, declaration.rng, declaration.intent),
  };
}

export function advanceIntent(value) {
  let snapshot;
  try {
    snapshot = cloneJsonData(value, "invalid-intent-state");
  } catch {
    return { ok: false, reason: "invalid-intent-state", state: null };
  }
  const pattern = getReferenceIntentPattern(snapshot?.patternId);
  if (!pattern || !validIntentSnapshot(snapshot, pattern)) {
    return { ok: false, reason: "invalid-intent-state", state: snapshot };
  }
  const stepIndex = (snapshot.stepIndex + 1) % pattern.steps.length;
  const declaration = declare(pattern, stepIndex, snapshot.rng);
  return {
    ok: true,
    state: freezeState(pattern.id, stepIndex, declaration.rng, declaration.intent),
  };
}
