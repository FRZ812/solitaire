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

function isIntentState(state, pattern) {
  const version = ownData(state, "version");
  const patternId = ownData(state, "patternId");
  const stepIndex = ownData(state, "stepIndex");
  const rng = ownData(state, "rng");
  const intent = ownData(state, "intent");
  return version === 1
    && patternId === pattern.id
    && Number.isInteger(stepIndex)
    && stepIndex >= 0
    && stepIndex < pattern.steps.length
    && ownData(rng, "algorithm") === "mulberry32"
    && Number.isInteger(ownData(rng, "state"))
    && ownData(rng, "state") >= 0
    && ownData(rng, "state") <= 0xFFFFFFFF
    && typeof ownData(intent, "id") === "string"
    && ownData(intent, "type") === "attack"
    && ownData(intent, "target") === "player"
    && Number.isInteger(ownData(intent, "damage"))
    && ownData(intent, "damage") >= 0;
}

export function createIntentState({ seed, patternId } = {}) {
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

export function advanceIntent(state) {
  const patternId = ownData(state, "patternId");
  const pattern = getReferenceIntentPattern(patternId);
  if (!pattern || !isIntentState(state, pattern)) {
    return { ok: false, reason: "invalid-intent-state", state };
  }
  const stepIndex = (ownData(state, "stepIndex") + 1) % pattern.steps.length;
  const declaration = declare(pattern, stepIndex, ownData(state, "rng"));
  return {
    ok: true,
    state: freezeState(pattern.id, stepIndex, declaration.rng, declaration.intent),
  };
}
