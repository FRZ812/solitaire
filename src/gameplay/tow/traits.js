// The Tower of Winter trait catalogue, transcribed from docs/design/TOW_EVIDENCE.md.
//
// Traits are the game. Almost every one grants or inflicts a numeric *status count*,
// which is why the kernel had to become a status-stack engine before this file could
// mean anything. A trait holds a rank from 1 to 7; the wiki quotes each trait's value as
// a span across that range ("Gain 1-13 Steelskin"), so rank 1 is the low end and rank 7
// the high one.

import { getStatusDefinition } from "../kernel/status-stack.js";

export const TRAIT_RANK_MIN = 1;
export const TRAIT_RANK_CAP = 7;
export const TRAIT_CAPACITY = 10;
export const TRAIT_SOURCE_PAGE = "https://namu.wiki/w/%EA%B2%A8%EC%9A%B8%EC%9D%98%20%ED%83%91/%ED%8A%B9%EC%84%B1";

// Exact per-rank tables are used whenever the source exposes them. The remaining traits
// retain the older endpoint interpolation policy, kept explicit so inferred ranks never
// masquerade as a directly transcribed value.
export const PROVISIONAL_RANK_SCALING = Object.freeze({
  interpolation: "linear",
  rounding: "nearest",
  evidence: "gap",
});

function span(status, min, max, extra = {}) {
  return Object.freeze({ kind: "grant-status", status, min, max, ...extra });
}

function inflict(status, min, max, extra = {}) {
  return Object.freeze({ kind: "inflict-status", status, min, max, ...extra });
}

// How often the trait fires. `combat-start` is the default reading for a bare "Gain N X".
const AT_START = Object.freeze({ type: "combat-start" });
const everyTurn = () => Object.freeze({ type: "every-turn" });
const everyTurns = (turns) => Object.freeze({ type: "every-n-turns", turns });
// "every 5-2 turns" — the interval shortens as the rank rises.
const everyTurnsSpan = (slowest, fastest) => Object.freeze({
  type: "every-n-turns-span",
  slowest,
  fastest,
});
const everyTurnsTable = (turnsByRank) => Object.freeze({
  type: "every-n-turns-table",
  turnsByRank: Object.freeze([...turnsByRank]),
});
// "each turn with a 2-23% chance" — the chance is what the rank scales, not the amount.
const chanceSpan = (min, max) => Object.freeze({ type: "every-turn-chance", min, max });

function trait(id, name, { effect, cadence = AT_START, exclusiveTo = null, source = null } = {}) {
  return Object.freeze({
    id,
    name,
    effect,
    cadence,
    exclusiveTo,
    acquisition: source,
    sourcePage: TRAIT_SOURCE_PAGE,
    rankCap: TRAIT_RANK_CAP,
  });
}

const TRAITS = Object.freeze(Object.fromEntries([
  trait("aegis", "Aegis", { effect: span("protection", 3, 21) }),
  trait("ironclad", "Ironclad", {
    effect: span("steelskin", 1, 13, { values: Object.freeze([1, 2, 4, 5, 8, 9, 13]) }),
  }),
  trait("agility", "Agility", { effect: span("evade", 1, 1), cadence: chanceSpan(2, 23) }),
  trait("swift", "Swift", { effect: span("haste", 1, 1), cadence: chanceSpan(2, 18) }),
  trait("destructor", "Destructor", { effect: span("doom-atk", 2, 25), source: "event-outcome" }),
  trait("ignition", "Ignition", {
    effect: inflict("burn", 3, 25, { values: Object.freeze([3, 6, 10, 13, 17, 20, 25]) }),
  }),
  trait("fortitude", "Fortitude", { effect: span("unstoppable", 2, 25) }),
  trait("detection", "Detection", { effect: span("thorn", 1, 14), cadence: everyTurns(4) }),
  trait("reflection", "Reflection", { effect: span("thorn", 2, 28) }),
  trait("bloodsuck", "Bloodsuck", {
    effect: span("lifesteal", 2, 18, {
      unit: "percent",
      values: Object.freeze([2, 4, 7, 9, 12, 14, 18]),
    }),
  }),
  trait("fury", "Fury", { effect: span("strength", 1, 10), cadence: everyTurns(4) }),
  trait("luck", "Luck", {
    effect: inflict("misfortune", 18, 180, { chancePercent: 75 }),
  }),
  trait("decay", "Decay", { effect: inflict("poison", 1, 10), cadence: everyTurns(3) }),
  trait("overwhelm", "Overwhelm", { effect: inflict("cripple", 1, 13) }),
  trait("charge", "Charge", {
    effect: span("charge", 100, 100),
    cadence: everyTurnsTable([5, 5, 4, 4, 3, 3, 2]),
  }),
  trait("shocker", "Shocker", {
    effect: inflict("paralyze", 1, 1),
    cadence: everyTurnsSpan(7, 4),
  }),
  trait("adaptation", "Adaptation", { effect: span("grow", 4, 40), cadence: everyTurns(4) }),
  trait("survival", "Survival", { effect: span("grow", 8, 80) }),
  trait("fatality", "Fatality", { effect: span("overload", 4, 48), cadence: everyTurns(4) }),
  trait("rage", "Rage", { effect: span("strength", 1, 12) }),
  trait("venom", "Venom", { effect: span("poison-atk", 1, 5) }),
  trait("ambush", "Ambush", { effect: inflict("weak", 1, 4) }),
  trait("anatomy", "Anatomy", { effect: span("focus", 3, 30, { unit: "percent" }) }),
  trait("endurance", "Endurance", { effect: span("solidity", 1, 10) }),
  trait("guardian", "Guardian", {
    effect: span("guard", 1, 4),
    cadence: everyTurns(5),
    source: "event-outcome",
  }),
  trait("accuracy", "Accuracy", { effect: span("sharpen", 5, 50) }),
  trait("gale", "Gale", {
    effect: span("initiative-atk", 10, 40, {
      values: Object.freeze([10, 15, 20, 25, 30, 35, 40]),
    }),
    exclusiveTo: "wandering-blade",
  }),
  trait("quickness", "Quickness", {
    effect: span("priority", 0, 3, { values: Object.freeze([0, 0, 1, 1, 2, 2, 3]) }),
  }),
  trait("necromancy", "Necromancy", {
    effect: span("skeleton", 1, 4, { values: Object.freeze([1, 1, 2, 2, 3, 3, 4]) }),
    cadence: everyTurn(),
    exclusiveTo: "witch-of-eternity",
  }),
  trait("overheat", "Overheat", {
    effect: span("limp", 2, 18, {
      values: Object.freeze([2, 4, 7, 9, 12, 14, 18]),
      affectsOwnerAndOpponents: true,
    }),
    cadence: everyTurn(),
    exclusiveTo: "forsaken-automaton",
  }),

  // Character-exclusive.
  trait("valiancy", "Valiancy", {
    effect: span("lethargy-atk", 1, 17, {
      values: Object.freeze([1, 2, 5, 6, 10, 12, 17]),
    }),
    exclusiveTo: "old-king-of-northland",
  }),
  trait("innovation", "Innovation", {
    effect: span("strength", 3, 15, {
      values: Object.freeze([3, 6, 6, 10, 10, 15, 15]),
      evenRankStatus: "tenacity",
    }),
    exclusiveTo: "owner-of-clocktower",
  }),
  trait("assassin", "Assassin", {
    effect: span("eviscerate", 2, 5),
    exclusiveTo: "last-assassin",
  }),
  trait("combo", "Combo", {
    effect: span("eviscerate", 2, 5, {
      values: Object.freeze([2, 2, 3, 3, 4, 4, 5]),
    }),
    exclusiveTo: "last-assassin",
  }),
  trait("judgment", "Judgment", {
    effect: span("judgment", 1, 17, {
      values: Object.freeze([1, 2, 5, 6, 10, 12, 17]),
    }),
    cadence: everyTurn(),
    exclusiveTo: "exiled-priestess",
  }),
].map((entry) => [entry.id, entry])));

function fusion(id, name, components, rune, effect, extra = {}) {
  return Object.freeze({
    id,
    name,
    components: Object.freeze([...components].sort()),
    rune,
    runeEvidence: rune ? "observed" : "gap",
    effect,
    ...extra,
  });
}

// Fusing needs both components at rank 7 plus the matching rune. It consumes both and
// grants the fusion already at max rank, which can never be improved.
const FUSIONS = Object.freeze(Object.fromEntries([
  fusion("metalize", "Metalize", ["ironclad", "aegis"], "rune-of-metal", span("steelskin", 40, 40)),
  fusion("extinction", "Extinction", ["detection", "reflection"], "rune-of-extinction", span("thorn", 85, 85)),
  fusion("rupture", "Rupture", ["bloodsuck", "fury"], "rune-of-rupture", span("bleed-atk", 2, 2), { cadence: everyTurn() }),
  fusion("embiggen", "Embiggen", ["survival", "adaptation"], "rune-of-embiggen", span("grow", 30, 30), { cadence: everyTurn() }),
  fusion("intangible", "Intangible", ["endurance", "guardian"], "rune-of-intangible", span("invincible", 7, 7)),
  fusion("inferno", "Inferno", ["ignition", "destructor"], "rune-of-inferno", inflict("burn", 80, 80)),
  fusion("flash", "Flash", ["quickness", "gale"], "rune-of-flash", span("priority", 6, 6)),
  fusion("breakdown", "Breakdown", ["ambush", "anatomy"], null, inflict("vulnerable", 9, 9)),
  fusion("berserker", "Berserker", ["rage", "fatality"], null, span("berserk", 100, 100), { firstTurnOnly: true }),
  fusion("rogue", "Rogue", ["agility", "swift"], null, span("conceal", 1, 1), { cadence: everyTurns(2) }),
  fusion("supreme", "Supreme", ["fortitude", "valiancy"], null, span("lethargy-atk", 50, 50)),
  fusion("justice", "Justice", ["luck", null], null, span("judgment", 100, 100), { cadence: everyTurns(2), exclusiveTo: "exiled-priestess" }),
  fusion("despair", "Despair", ["decay", "overwhelm"], null, inflict("cripple", 7, 7), { cadence: everyTurns(2) }),
  fusion("tempest", "Tempest", ["charge", "shocker"], null, inflict("doom", 80, 80), { cadence: everyTurn() }),
  fusion("biochem", "Biochem", ["venom", "innovation"], null, span("poison-atk", 15, 15)),
  fusion("shadowcast", "Shadowcast", ["accuracy", "assassin"], null, span("eviscerate", 15, 15)),
  fusion("bone-army", "Bone Army", ["necromancy", null], null, span("skeleton", 25, 25)),
  fusion("stabilization", "Stabilization", ["overheat", null], null, inflict("limp", 10, 10), { cadence: everyTurn() }),
].map((entry) => [entry.id, entry])));

export function getTrait(traitId) {
  return typeof traitId === "string" && Object.hasOwn(TRAITS, traitId) ? TRAITS[traitId] : null;
}

export function getFusion(fusionId) {
  return typeof fusionId === "string" && Object.hasOwn(FUSIONS, fusionId) ? FUSIONS[fusionId] : null;
}

/** A trait-like effect that may be a normal ranked trait or an already-forged fusion. */
export function getCombatTrait(id) {
  return getTrait(id) || getFusion(id);
}

export function traitIds() {
  return Object.keys(TRAITS);
}

export function fusionIds() {
  return Object.keys(FUSIONS);
}

export function isValidRank(rank) {
  return Number.isSafeInteger(rank) && rank >= TRAIT_RANK_MIN && rank <= TRAIT_RANK_CAP;
}

/**
 * The value a trait produces at a given rank, interpolated across its evidenced span.
 *
 * @param {string} traitId
 * @param {number} rank 1..7
 * @returns {number}
 */
export function traitValueAtRank(traitId, rank) {
  const definition = getTrait(traitId);
  if (!definition) throw new TypeError(`unknown-trait:${traitId}`);
  if (!isValidRank(rank)) throw new TypeError("invalid-trait-rank");
  const { min, max, values } = definition.effect;
  if (Array.isArray(values)) return values[rank - TRAIT_RANK_MIN];
  if (min === max) return min;
  const steps = TRAIT_RANK_CAP - TRAIT_RANK_MIN;
  return Math.round(min + ((max - min) * (rank - TRAIT_RANK_MIN)) / steps);
}

/**
 * The cadence value at a rank, for traits whose rank scales a chance or an interval
 * rather than an amount. Returns null when the cadence does not scale.
 */
export function traitCadenceAtRank(traitId, rank) {
  const definition = getTrait(traitId);
  if (!definition) throw new TypeError(`unknown-trait:${traitId}`);
  if (!isValidRank(rank)) throw new TypeError("invalid-trait-rank");
  const { cadence } = definition;
  const steps = TRAIT_RANK_CAP - TRAIT_RANK_MIN;
  const at = (from, to) => Math.round(from + ((to - from) * (rank - TRAIT_RANK_MIN)) / steps);
  if (cadence.type === "every-turn-chance") {
    return { type: cadence.type, chancePercent: at(cadence.min, cadence.max) };
  }
  if (cadence.type === "every-n-turns-span") {
    return { type: "every-n-turns", turns: at(cadence.slowest, cadence.fastest) };
  }
  if (cadence.type === "every-n-turns-table") {
    return { type: "every-n-turns", turns: cadence.turnsByRank[rank - TRAIT_RANK_MIN] };
  }
  return null;
}

const STATUS_LABELS = Object.freeze({
  steelskin: "flat attack-damage reduction per hit",
  priority: "Priority actions before the enemy",
  strength: "Strength",
  tenacity: "Tenacity",
  "lethargy-atk": "Lethargy inflicted per landed hit",
  "initiative-atk": "Initiative gained per landed hit",
  eviscerate: "Vulnerable inflicted per landed hit",
  skeleton: "Skeletons summoned",
  judgment: "Judgment gained",
  lifesteal: "Lifesteal",
  burn: "Burn inflicted",
  charge: "Charge",
  limp: "Limp",
});

/** Human-readable sourced mechanic for a trait at one concrete rank. */
export function describeTraitAtRank(traitId, rank) {
  const definition = getTrait(traitId);
  if (!definition) return null;
  const value = traitValueAtRank(traitId, rank);
  if (traitId === "innovation") {
    return `Rank ${rank}: gain ${value} ${rank % 2 === 0 ? "DEF (Tenacity)" : "ATK (Strength)"} at combat start; only the parity-selected stat applies.`;
  }
  if (traitId === "overheat") {
    return `Rank ${rank}: both this character and every enemy gain ${value} Limp each turn, making both sides progressively more vulnerable.`;
  }
  if (traitId === "judgment") {
    return `Rank ${rank}: gain ${value} Judgment each turn; the next damaging attack consumes it as defence-ignoring special damage.`;
  }
  if (traitId === "necromancy") {
    return `Rank ${rank}: summon ${value} Skeletons each turn. Skeletons add attack and are lost when this character is hit.`;
  }
  if (traitId === "gale") {
    return `Rank ${rank}: gain ${value} Initiative per landed hit; each 100 converts into 1 Priority.`;
  }
  if (traitId === "combo") {
    return `Rank ${rank}: every landed hit adds ${value} Vulnerable, increasing later damage; multi-hit attacks apply it per hit.`;
  }
  if (traitId === "valiancy") {
    return `Rank ${rank}: every landed hit inflicts ${value} Lethargy, weakening the enemy's attack pressure.`;
  }
  if (traitId === "bloodsuck") {
    return `Rank ${rank}: restore ${value}% of direct damage dealt, with a minimum heal of 1 per damaging hit.`;
  }
  if (traitId === "ignition") {
    return `Rank ${rank}: inflict ${value} Burn on every enemy when combat begins.`;
  }
  if (traitId === "charge") {
    const cadence = combatTraitCadenceAtRank(traitId, rank);
    return `Rank ${rank}: gain 100 Charge every ${cadence.turns} turns, guaranteeing the charged critical window.`;
  }
  const cadence = combatTraitCadenceAtRank(traitId, rank);
  const status = STATUS_LABELS[definition.effect.status]
    || definition.effect.status.replace(/-/g, " ");
  const timing = cadence.type === "combat-start"
    ? "at combat start"
    : cadence.type === "every-turn"
      ? "each turn"
      : cadence.type === "every-n-turns"
        ? `every ${cadence.turns} turns`
        : cadence.type.replace(/-/g, " ");
  return `Rank ${rank}: ${definition.effect.kind === "inflict-status" ? "inflict" : "gain"} ${value} ${status} ${timing}.`;
}

/**
 * Resolve a normal trait or fusion through the same encounter interface. Fusions are always
 * rank 7 and carry fixed effect magnitudes, while ordinary traits retain rank scaling.
 */
export function combatTraitValueAtRank(id, rank) {
  const definition = getCombatTrait(id);
  if (!definition) throw new TypeError(`unknown-trait:${id}`);
  if (!isValidRank(rank)) throw new TypeError("invalid-trait-rank");
  if (getFusion(id)) {
    if (rank !== TRAIT_RANK_CAP) throw new TypeError("invalid-fusion-rank");
    return definition.effect.max;
  }
  return traitValueAtRank(id, rank);
}

export function combatTraitCadenceAtRank(id, rank) {
  const definition = getCombatTrait(id);
  if (!definition) throw new TypeError(`unknown-trait:${id}`);
  if (!isValidRank(rank)) throw new TypeError("invalid-trait-rank");
  if (getFusion(id)) {
    return definition.cadence || AT_START;
  }
  return traitCadenceAtRank(id, rank) || definition.cadence;
}

/**
 * Whether `fusionId` may be offered for a set of held traits and runes.
 *
 * `traits` is a plain map of traitId to rank. `runes` is a list of held rune ids.
 */
export function fusionOffer(fusionId, { traits = {}, runes = [] } = {}) {
  const definition = getFusion(fusionId);
  if (!definition) return { ok: false, reason: "unknown-fusion" };
  const components = definition.components.filter((id) => id !== null);
  if (components.length !== 2) return { ok: false, reason: "unresolved-components" };
  for (const componentId of components) {
    const descriptor = Object.getOwnPropertyDescriptor(traits, componentId);
    const rank = descriptor && "value" in descriptor ? descriptor.value : undefined;
    if (!isValidRank(rank)) return { ok: false, reason: "missing-component" };
    if (rank < TRAIT_RANK_CAP) return { ok: false, reason: "component-below-rank-cap" };
  }
  if (definition.rune === null) return { ok: false, reason: "unresolved-rune" };
  if (!Array.isArray(runes) || !runes.includes(definition.rune)) {
    return { ok: false, reason: "missing-rune" };
  }
  return { ok: true, reason: null, fusion: definition };
}

/**
 * Apply a fusion: both components leave the build and the fusion takes their place at
 * rank 7. Pure — returns a new traits map.
 */
export function applyFusion(fusionId, { traits = {}, runes = [] } = {}) {
  const offer = fusionOffer(fusionId, { traits, runes });
  if (!offer.ok) return { ok: false, reason: offer.reason, traits: null };
  const next = {};
  for (const [id, rank] of Object.entries(traits)) {
    if (!offer.fusion.components.includes(id)) next[id] = rank;
  }
  next[fusionId] = TRAIT_RANK_CAP;
  return { ok: true, reason: null, traits: next };
}

export function traitCount(traits) {
  return Object.keys(traits || {}).length;
}

export function hasTraitCapacity(traits) {
  return traitCount(traits) < TRAIT_CAPACITY;
}

/** Every status a trait or fusion writes into, for cross-checking against the kernel. */
export function referencedStatusTypes() {
  const types = new Set();
  for (const entry of [...Object.values(TRAITS), ...Object.values(FUSIONS)]) {
    types.add(entry.effect.status);
  }
  return [...types];
}

/** Status types this catalogue names that the kernel does not yet model. */
export function unmodelledStatusTypes() {
  return referencedStatusTypes().filter((type) => getStatusDefinition(type) === null);
}
