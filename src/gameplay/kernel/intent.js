import { cloneJsonData, equalJsonData } from "./json-data.js";
import { createRng, nextInt } from "./rng.js";
import { getReferenceIntentPattern } from "../reference/enemies.js";

function ownData(object, key) {
  if (!object || typeof object !== "object") return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

export const MAX_INTENT_DECLARATIONS = 4096;
const MAX_EMBEDDED_PATTERN_STEPS = 64;
const MAX_EMBEDDED_PATTERN_OPTIONS = 8;
const MAX_EMBEDDED_INTENT_DAMAGE = 1_000_000;
const MAX_EMBEDDED_IDENTIFIER_LENGTH = 128;
const INTENT_STATE_KEYS_V1 = Object.freeze([
  "declarationIndex",
  "intent",
  "patternId",
  "rng",
  "seed",
  "stepIndex",
  "version",
].sort());
const INTENT_STATE_KEYS_V2 = Object.freeze([
  ...INTENT_STATE_KEYS_V1,
  "pattern",
].sort());
const PATTERN_KEYS = Object.freeze(["id", "steps"]);
const STEP_KEYS = Object.freeze(["id", "options"]);
const OPTION_KEYS = Object.freeze(["damage", "id", "target", "type"]);
const DAMAGE_KEYS = Object.freeze(["max", "min"]);

function validSeed(seed) {
  return (typeof seed === "string" && seed.length > 0)
    || (typeof seed === "number" && Number.isFinite(seed));
}

function freezeJson(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeJson(child);
  return Object.freeze(value);
}

function validIdentifier(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= MAX_EMBEDDED_IDENTIFIER_LENGTH;
}

function exactKeys(value, keys) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && equalJsonData(Object.keys(value).sort(), keys);
}

function embeddedPatternSnapshot(value) {
  let pattern;
  try {
    pattern = cloneJsonData(value, "invalid-intent-pattern");
  } catch {
    return null;
  }
  if (
    !exactKeys(pattern, PATTERN_KEYS)
    || !validIdentifier(pattern.id)
    || !Array.isArray(pattern.steps)
    || pattern.steps.length < 1
    || pattern.steps.length > MAX_EMBEDDED_PATTERN_STEPS
  ) return null;

  const stepIds = new Set();
  const optionIds = new Set();
  for (const step of pattern.steps) {
    if (
      !exactKeys(step, STEP_KEYS)
      || !validIdentifier(step.id)
      || stepIds.has(step.id)
      || !Array.isArray(step.options)
      || step.options.length < 1
      || step.options.length > MAX_EMBEDDED_PATTERN_OPTIONS
    ) return null;
    stepIds.add(step.id);
    for (const option of step.options) {
      if (
        !exactKeys(option, OPTION_KEYS)
        || !validIdentifier(option.id)
        || optionIds.has(option.id)
        || option.type !== "attack"
        || option.target !== "player"
        || !exactKeys(option.damage, DAMAGE_KEYS)
        || !Number.isSafeInteger(option.damage.min)
        || !Number.isSafeInteger(option.damage.max)
        || option.damage.min < 0
        || option.damage.max < option.damage.min
        || option.damage.max > MAX_EMBEDDED_INTENT_DAMAGE
      ) return null;
      optionIds.add(option.id);
    }
  }
  return pattern;
}

function freezeState(pattern, seed, declarationIndex, stepIndex, rng, intent, embedded = false) {
  const state = {
    version: embedded ? 2 : 1,
    patternId: pattern.id,
    seed,
    declarationIndex,
    stepIndex,
    rng: Object.freeze({ ...rng }),
    intent: Object.freeze({ ...intent }),
    ...(embedded ? { pattern: freezeJson(cloneJsonData(pattern)) } : {}),
  };
  return Object.freeze(state);
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

function deriveDeclaration(pattern, seed, declarationIndex) {
  let rng = createRng(seed);
  let declaration = null;
  for (let index = 0; index <= declarationIndex; index += 1) {
    declaration = declare(pattern, index % pattern.steps.length, rng);
    rng = declaration.rng;
  }
  return {
    stepIndex: declarationIndex % pattern.steps.length,
    rng,
    intent: declaration.intent,
  };
}

function validIntentSnapshot(state, pattern) {
  const embedded = state?.version === 2;
  const expectedKeys = embedded ? INTENT_STATE_KEYS_V2 : INTENT_STATE_KEYS_V1;
  const structurallyValid = state
    && typeof state === "object"
    && !Array.isArray(state)
    && (state.version === 1 || embedded)
    && equalJsonData(Object.keys(state).sort(), expectedKeys)
    && state.patternId === pattern.id
    && (!embedded || equalJsonData(state.pattern, pattern))
    && validSeed(state.seed)
    && Number.isInteger(state.declarationIndex)
    && state.declarationIndex >= 0
    && state.declarationIndex <= MAX_INTENT_DECLARATIONS
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
  if (!structurallyValid) return false;
  const expected = deriveDeclaration(pattern, state.seed, state.declarationIndex);
  return state.stepIndex === expected.stepIndex
    && equalJsonData(state.rng, expected.rng)
    && equalJsonData(state.intent, expected.intent);
}

function snapshotIntentState(value) {
  try {
    const state = cloneJsonData(value, "invalid-intent-state");
    const pattern = state?.version === 2
      ? embeddedPatternSnapshot(state.pattern)
      : getReferenceIntentPattern(state?.patternId);
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
  let suppliedSeed;
  try {
    suppliedSeed = ownData(input, "seed");
  } catch {
    return { ok: false, reason: "invalid-intent-input", state: null };
  }
  if (!validSeed(suppliedSeed)) {
    return { ok: false, reason: "invalid-intent-seed", state: null };
  }
  let request;
  try {
    request = cloneJsonData(input, "invalid-intent-input");
  } catch {
    return { ok: false, reason: "invalid-intent-input", state: null };
  }
  const seed = request?.seed;
  const patternId = request?.patternId;
  if (!validSeed(seed)) return { ok: false, reason: "invalid-intent-seed", state: null };
  const embedded = Object.hasOwn(request || {}, "pattern");
  const pattern = embedded
    ? embeddedPatternSnapshot(request.pattern)
    : getReferenceIntentPattern(patternId);
  if (!pattern) {
    return {
      ok: false,
      reason: embedded ? "invalid-intent-pattern" : "unknown-intent-pattern",
      state: null,
    };
  }
  if (embedded && patternId !== undefined && patternId !== pattern.id) {
    return { ok: false, reason: "invalid-intent-pattern", state: null };
  }
  const declaration = declare(pattern, 0, createRng(seed));
  const result = {
    ok: true,
    state: freezeState(pattern, seed, 0, 0, declaration.rng, declaration.intent, embedded),
  };
  return isIntentState(result.state)
    ? result
    : { ok: false, reason: "invalid-intent-input", state: null };
}

export function advanceIntent(value) {
  let snapshot;
  try {
    snapshot = cloneJsonData(value, "invalid-intent-state");
  } catch {
    return { ok: false, reason: "invalid-intent-state", state: null };
  }
  const embedded = snapshot?.version === 2;
  const pattern = embedded
    ? embeddedPatternSnapshot(snapshot.pattern)
    : getReferenceIntentPattern(snapshot?.patternId);
  if (!pattern || !validIntentSnapshot(snapshot, pattern)) {
    return { ok: false, reason: "invalid-intent-state", state: snapshot };
  }
  if (snapshot.declarationIndex >= MAX_INTENT_DECLARATIONS) {
    return { ok: false, reason: "intent-declaration-limit-exceeded", state: snapshot };
  }
  const declarationIndex = snapshot.declarationIndex + 1;
  const stepIndex = declarationIndex % pattern.steps.length;
  const declaration = declare(pattern, stepIndex, snapshot.rng);
  return {
    ok: true,
    state: freezeState(
      pattern,
      snapshot.seed,
      declarationIndex,
      stepIndex,
      declaration.rng,
      declaration.intent,
      embedded,
    ),
  };
}
