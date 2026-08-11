// Tower of Winter statuses are counts, not durations. A trait grants "12 Steelskin",
// not "Steelskin for 3 turns", and the count is what both the effect magnitude and the
// remaining lifetime are read from. Every rule here is sourced from
// docs/design/TOW_EVIDENCE.md; anything the wiki leaves blank is marked `gap` rather
// than filled in with a plausible number.

// How much a stack loses per decrement event. The wiki records *that* Steelskin decreases
// when hit and *that* Solidity decreases at end of turn, but never by how much. One is the
// provisional policy until a capture settles it — isolated here so a correction is a
// one-line change rather than an archaeology exercise.
export const PROVISIONAL_DECREMENT = Object.freeze({
  perHit: 1,
  perTurn: 1,
  evidence: "gap",
});

export const MAX_STATUS_COUNT = 1_000_000;

function definition(id, { permanent = false, removeAtEndOfTurn = false, decreaseAtEndOfTurn = false, decreaseWhenHit = false, evidence = "observed" } = {}) {
  return Object.freeze({
    id,
    permanent,
    removeAtEndOfTurn,
    decreaseAtEndOfTurn,
    decreaseWhenHit,
    lifecycleEvidence: evidence,
  });
}

// `gap` entries have every flag false, which makes them persist untouched. That is the
// safe reading: a status that silently expired would hide the missing evidence, whereas
// one that lingers shows up the moment a fight is traced.
const DEFINITIONS = Object.freeze({
  protection: definition("protection", { permanent: true, decreaseWhenHit: true }),
  steelskin: definition("steelskin", { decreaseWhenHit: true }),
  evade: definition("evade", { decreaseAtEndOfTurn: true }),
  haste: definition("haste", { decreaseAtEndOfTurn: true }),
  "doom-atk": definition("doom-atk", { removeAtEndOfTurn: true }),
  burn: definition("burn", { decreaseWhenHit: true }),
  tenacity: definition("tenacity", { permanent: true }),
  thorn: definition("thorn", { permanent: true }),
  misfortune: definition("misfortune", { decreaseAtEndOfTurn: true }),
  overload: definition("overload", { removeAtEndOfTurn: true }),
  solidity: definition("solidity", { decreaseAtEndOfTurn: true, decreaseWhenHit: true }),
  guard: definition("guard", { decreaseAtEndOfTurn: true, decreaseWhenHit: true }),

  unstoppable: definition("unstoppable", { evidence: "gap" }),
  lifesteal: definition("lifesteal", { evidence: "gap" }),
  strength: definition("strength", { evidence: "gap" }),
  poison: definition("poison", { evidence: "gap" }),
  cripple: definition("cripple", { evidence: "gap" }),
  charge: definition("charge", { evidence: "gap" }),
  grow: definition("grow", { evidence: "gap" }),
  "poison-atk": definition("poison-atk", { evidence: "gap" }),
  weak: definition("weak", { evidence: "gap" }),
  focus: definition("focus", { evidence: "gap" }),
  sharpen: definition("sharpen", { evidence: "gap" }),
  eviscerate: definition("eviscerate", { evidence: "gap" }),
  priority: definition("priority", { evidence: "gap" }),
  doom: definition("doom", { evidence: "gap" }),

  // Named by traits, fusions and skills but absent from the wiki's status table, so their
  // effect is known while their lifecycle is not.
  conceal: definition("conceal", { evidence: "gap" }),
  invincible: definition("invincible", { evidence: "gap" }),
  paralyze: definition("paralyze", { evidence: "gap" }),
  sleep: definition("sleep", { evidence: "gap" }),
  stun: definition("stun", { evidence: "gap" }),
  bleed: definition("bleed", { evidence: "gap" }),
  "bleed-atk": definition("bleed-atk", { evidence: "gap" }),
  lethargy: definition("lethargy", { evidence: "gap" }),
  "lethargy-atk": definition("lethargy-atk", { evidence: "gap" }),
  vulnerable: definition("vulnerable", { evidence: "gap" }),
  skeleton: definition("skeleton", { evidence: "gap" }),
  limp: definition("limp", { evidence: "gap" }),
  berserk: definition("berserk", { evidence: "gap" }),
  initiative: definition("initiative", { evidence: "gap" }),
  judgment: definition("judgment", { evidence: "gap" }),
});

export function getStatusDefinition(type) {
  return typeof type === "string" && Object.hasOwn(DEFINITIONS, type)
    ? DEFINITIONS[type]
    : null;
}

export function statusTypes() {
  return Object.keys(DEFINITIONS);
}

function validCount(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_STATUS_COUNT;
}

export function isStatusStack(value) {
  if (!Array.isArray(value)) return false;
  const seen = new Set();
  return value.every((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const keys = Object.keys(entry);
    if (keys.length !== 2 || !keys.includes("type") || !keys.includes("count")) return false;
    if (!getStatusDefinition(entry.type)) return false;
    // A zero stack is not a status at rest, it is a status that should have been dropped.
    if (!validCount(entry.count) || entry.count === 0) return false;
    if (seen.has(entry.type)) return false;
    seen.add(entry.type);
    return true;
  });
}

export function createStatusStack() {
  return [];
}

export function statusCount(stack, type) {
  if (!Array.isArray(stack)) return 0;
  const found = stack.find((entry) => entry?.type === type);
  return found ? found.count : 0;
}

export function hasStatus(stack, type) {
  return statusCount(stack, type) > 0;
}

// Stacks accumulate. "Gain 1-14 Thorn every 4 turns" and Rupture's "cumulative Bleed
// Attack per Turn" only make sense if repeated grants add rather than overwrite.
export function applyStatus(stack, type, count) {
  if (!getStatusDefinition(type)) throw new TypeError(`unknown-status:${type}`);
  if (!validCount(count)) throw new TypeError("invalid-status-count");
  if (count === 0) return normalize(stack);
  const next = normalize(stack);
  const index = next.findIndex((entry) => entry.type === type);
  if (index < 0) return [...next, { type, count }];
  const total = Math.min(MAX_STATUS_COUNT, next[index].count + count);
  return next.map((entry, at) => (at === index ? { type, count: total } : entry));
}

export function removeStatus(stack, type) {
  return normalize(stack).filter((entry) => entry.type !== type);
}

function normalize(stack) {
  if (!Array.isArray(stack)) return [];
  return stack
    .filter((entry) => entry && validCount(entry.count) && entry.count > 0 && getStatusDefinition(entry.type))
    .map((entry) => ({ type: entry.type, count: entry.count }));
}

function decrementBy(stack, amount, applies) {
  const next = [];
  for (const entry of normalize(stack)) {
    const spec = getStatusDefinition(entry.type);
    if (!applies(spec)) {
      next.push(entry);
      continue;
    }
    if (spec.removeAtEndOfTurn) continue;
    const remaining = entry.count - amount;
    if (remaining > 0) next.push({ type: entry.type, count: remaining });
  }
  return next;
}

// Called once per *individual hit*, not once per attack. Steelskin, Thorn, Burn and
// DoomAtk all resolve per hit, so a two-hit swing spends two ticks of everything here.
export function decrementOnHit(stack, amount = PROVISIONAL_DECREMENT.perHit) {
  if (!validCount(amount)) throw new TypeError("invalid-status-count");
  return decrementBy(stack, amount, (spec) => spec.decreaseWhenHit);
}

export function tickEndOfTurn(stack, amount = PROVISIONAL_DECREMENT.perTurn) {
  if (!validCount(amount)) throw new TypeError("invalid-status-count");
  return decrementBy(
    stack,
    amount,
    (spec) => spec.removeAtEndOfTurn || spec.decreaseAtEndOfTurn,
  );
}
