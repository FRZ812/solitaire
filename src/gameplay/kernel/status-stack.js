// Solitaire combat statuses are counts, not generic durations. The shipped 1.4.16 status
// table defines both what each Count does and which event reduces it (UnderAttack,
// PerTurn, AllPerTurn, AllAttack, or Never). Keep those lifecycles here so every imported
// character ability resolves through the same source rule.

// Every ordinary source decrement removes one Count. Full-removal events (AllPerTurn and
// AllAttack) are represented separately on the status definition.
export const PROVISIONAL_DECREMENT = Object.freeze({
  perHit: 1,
  perTurn: 1,
  evidence: "shipped-1.4.16",
});

// Control activates when its holder tries to use a skill and has a PerTurn lifecycle in
// the shipped table. The scheduler consumes one Count in the command window it nullifies;
// this is the same holder-turn result without allowing a freshly applied control stack to
// disappear before that holder receives a command.
export const PROVISIONAL_CONTROL_LIFECYCLE = Object.freeze({
  types: Object.freeze(["paralyze", "sleep", "stun", "confuse"]),
  decreaseAtEndOfTurn: false,
  consumeWhenCommandNullified: true,
  evidence: "shipped-1.4.16",
});

/** Whether this status is one of the documented departures from inert-by-default. */
export function hasProvisionalControlLifecycle(type) {
  return PROVISIONAL_CONTROL_LIFECYCLE.types.includes(type);
}

export const MAX_STATUS_COUNT = 1_000_000;

function definition(id, {
  permanent = false,
  removeAtEndOfTurn = false,
  decreaseAtEndOfTurn = false,
  decreaseWhenHit = false,
  endOfTurnDamage = null,
  evidence = "observed",
} = {}) {
  return Object.freeze({
    id,
    permanent,
    removeAtEndOfTurn,
    decreaseAtEndOfTurn,
    decreaseWhenHit,
    // Damage statuses resolve their payload and lifecycle atomically at the holder's own
    // turn end. Keeping this separate from ordinary status decay prevents a freshly
    // inflicted Doom from disappearing in the same hostile action window.
    endOfTurnDamage,
    lifecycleEvidence: evidence,
  });
}

const DEFINITIONS = Object.freeze({
  protection: definition("protection", { permanent: true, decreaseWhenHit: true }),
  confuse: definition("confuse", { evidence: "shipped-1.4.16" }),
  steelskin: definition("steelskin", { permanent: true }),
  evade: definition("evade", { decreaseAtEndOfTurn: true }),
  haste: definition("haste", { decreaseAtEndOfTurn: true }),
  "doom-atk": definition("doom-atk", { permanent: true }),
  "counter-attack": definition("counter-attack", { removeAtEndOfTurn: true }),
  burn: definition("burn", { permanent: true, decreaseWhenHit: true, endOfTurnDamage: "persist" }),
  tenacity: definition("tenacity", { permanent: true }),
  injured: definition("injured", { permanent: true }),
  fortified: definition("fortified", { decreaseAtEndOfTurn: true }),
  rage: definition("rage", { permanent: true }),
  consecration: definition("consecration", { permanent: true }),
  confusion: definition("confusion", { decreaseAtEndOfTurn: true }),
  composure: definition("composure", { decreaseAtEndOfTurn: true }),
  thorn: definition("thorn", { permanent: true }),
  misfortune: definition("misfortune", { removeAtEndOfTurn: true }),
  overload: definition("overload", { removeAtEndOfTurn: true }),
  solidity: definition("solidity", { decreaseWhenHit: true }),
  guard: definition("guard", { decreaseAtEndOfTurn: true, decreaseWhenHit: true }),
  // Witch of Eternity source mechanics. Bone Shield is a 60% direct-damage reduction
  // charge; Mirror Image is a smaller dodge window that can expire either by contact or
  // at the turn boundary.
  "bone-shield": definition("bone-shield", { decreaseWhenHit: true }),
  "mirror-image": definition("mirror-image", { decreaseAtEndOfTurn: true, decreaseWhenHit: true }),

  // The English in-game trait text resolves several rows whose compact Namu lifecycle
  // cells are blank. "Permanent" here means for this encounter: actors themselves are
  // encounter snapshots, so none of these leak into the campaign after settlement.
  unstoppable: definition("unstoppable", { decreaseAtEndOfTurn: true }),
  lifesteal: definition("lifesteal", { permanent: true }),
  strength: definition("strength", { permanent: true }),
  poison: definition("poison", { endOfTurnDamage: "decrease" }),
  cripple: definition("cripple", { permanent: true }),
  charge: definition("charge", { removeAtEndOfTurn: true }),
  grow: definition("grow", { permanent: true }),
  "poison-atk": definition("poison-atk", { permanent: true }),
  "death-claw": definition("death-claw", { permanent: true }),
  "wind-blade": definition("wind-blade", { permanent: true }),
  weak: definition("weak", { decreaseWhenHit: true }),
  focus: definition("focus", { permanent: true }),
  sharpen: definition("sharpen", { permanent: true }),
  eviscerate: definition("eviscerate", { permanent: true }),
  priority: definition("priority", { decreaseAtEndOfTurn: true }),
  doom: definition("doom", { endOfTurnDamage: "remove" }),

  conceal: definition("conceal", { decreaseAtEndOfTurn: true }),
  invincible: definition("invincible", { decreaseAtEndOfTurn: true }),
  // See PROVISIONAL_CONTROL_LIFECYCLE: a stack is consumed by the command window it
  // actually nullifies. Holder-turn decay alone would erase freshly inflicted control
  // before the affected side received (and automatically lost) its next command.
  paralyze: definition("paralyze", { evidence: "shipped-1.4.16" }),
  // Sleep loses one turn when it nullifies a command, but any landed hit wakes the target
  // outright. The hit resolver owns that full removal rather than a one-point decrement.
  sleep: definition("sleep", { evidence: "shipped-1.4.16" }),
  stun: definition("stun", { evidence: "shipped-1.4.16" }),
  bleed: definition("bleed", { permanent: true, endOfTurnDamage: "persist" }),
  "bleed-atk": definition("bleed-atk", { permanent: true }),
  // AllPerTurn clears the full Lethargy value at the holder's turn boundary.
  lethargy: definition("lethargy", { removeAtEndOfTurn: true }),
  "lethargy-atk": definition("lethargy-atk", { permanent: true }),
  vulnerable: definition("vulnerable", { decreaseWhenHit: true }),
  parry: definition("parry", { removeAtEndOfTurn: true }),
  persist: definition("persist", { permanent: true }),
  predator: definition("predator", { permanent: true }),
  restraint: definition("restraint", { decreaseAtEndOfTurn: true }),
  covert: definition("covert", { removeAtEndOfTurn: true }),
  skeleton: definition("skeleton", { decreaseWhenHit: true }),
  // Summoned spirits contribute their Count as special damage at each combat boundary.
  "void-monster": definition("void-monster", { permanent: true }),
  "hellfire-spirit": definition("hellfire-spirit", { permanent: true }),
  immortality: definition("immortality", { decreaseAtEndOfTurn: true }),
  "fatal-blade": definition("fatal-blade", { permanent: true, endOfTurnDamage: "persist" }),
  // These counts are visible countdowns. Their payloads live in encounter scheduled
  // effects so upgraded damage stays exact without encoding hidden data in a status Count.
  "limited-life-sentence": definition("limited-life-sentence", { decreaseAtEndOfTurn: true }),
  "forbidden-ritual": definition("forbidden-ritual", { decreaseAtEndOfTurn: true }),
  "foul-ceremony": definition("foul-ceremony", { decreaseAtEndOfTurn: true }),
  limp: definition("limp", { permanent: true }),
  // Berserk adds its Count to ATK and clears after the holder's next attack or turn.
  berserk: definition("berserk", { removeAtEndOfTurn: true }),
  initiative: definition("initiative", { permanent: true }),
  "initiative-atk": definition("initiative-atk", { permanent: true }),
  judgment: definition("judgment", { permanent: true }),
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

/** Spend a concrete number of stacks without changing any other status. */
export function consumeStatusCount(stack, type, amount = 1) {
  if (!getStatusDefinition(type)) throw new TypeError(`unknown-status:${type}`);
  if (!Number.isSafeInteger(amount) || amount < 0) throw new TypeError("invalid-status-count");
  return normalize(stack)
    .map((entry) => (entry.type === type
      ? { ...entry, count: Math.max(0, entry.count - amount) }
      : entry))
    .filter((entry) => entry.count > 0);
}

/**
 * Cut a status down to a percentage of what it is.
 *
 * First Aid "reduces Bleed, Burn and Poison to 60%", which is a scale rather than a
 * decrement — it has to bite harder on a heavy stack than a light one. Rounding down means
 * the last point of a one-stack burn goes out, which is the reading that matches a skill
 * whose whole job is to clean a wound.
 */
export function scaleStatus(stack, type, percent) {
  if (!getStatusDefinition(type)) throw new TypeError(`unknown-status:${type}`);
  if (!Number.isFinite(percent) || percent < 0) throw new TypeError("invalid-status-percent");
  return normalize(stack)
    .map((entry) => (entry.type === type
      ? { type, count: Math.min(MAX_STATUS_COUNT, Math.floor((entry.count * percent) / 100)) }
      : entry))
    .filter((entry) => entry.count > 0);
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

// Called once per *individual landed hit*. Burn, Protection, Solidity, Guard, Weak,
// Vulnerable, Bone Shield, Skeleton and Mirror Image all use this source event.
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

/**
 * Applies the sourced lifecycle that follows damage at the holder's own turn end.
 * Burn and Bleed remain, Poison loses one Count, and Doom is removed in full.
 */
export function tickEndOfTurnDamage(stack, amount = PROVISIONAL_DECREMENT.perTurn) {
  if (!validCount(amount)) throw new TypeError("invalid-status-count");
  const next = [];
  for (const entry of normalize(stack)) {
    const lifecycle = getStatusDefinition(entry.type).endOfTurnDamage;
    if (lifecycle === "remove") continue;
    if (lifecycle === "decrease") {
      const remaining = entry.count - amount;
      if (remaining > 0) next.push({ type: entry.type, count: remaining });
      continue;
    }
    next.push(entry);
  }
  return next;
}
