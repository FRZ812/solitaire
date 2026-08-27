const MAGNITUDE_TABLE_KEYS = Object.freeze([
  "percentByRank",
  "countByRank",
  "factorByRank",
]);

const HARMFUL_SELF_STATUSES = new Set([
  "bleed",
  "burn",
  "confuse",
  "confusion",
  "cripple",
  "doom",
  "fatal-blade",
  "foul-ceremony",
  "injured",
  "lethargy",
  "limp",
  "paralyze",
  "poison",
  "restraint",
  "sleep",
  "stun",
  "vulnerable",
  "weak",
]);

const BENEFICIAL_ENEMY_STATUSES = new Set([
  "bleed-atk",
  "bone-shield",
  "charge",
  "conceal",
  "counter-attack",
  "covert",
  "doom-atk",
  "evade",
  "eviscerate",
  "focus",
  "fortified",
  "grow",
  "guard",
  "haste",
  "immortality",
  "initiative",
  "invincible",
  "judgment",
  "lifesteal",
  "mirror-image",
  "overload",
  "parry",
  "persist",
  "poison-atk",
  "predator",
  "priority",
  "protection",
  "sharpen",
  "skeleton",
  "solidity",
  "steelskin",
  "strength",
  "tenacity",
  "thorn",
  "unstoppable",
]);

function round(value) {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function stronger(value, { integerOnly = false } = {}) {
  if (value > 0) {
    const next = Math.max(value + (Number.isInteger(value) ? 1 : 0.01), value * 1.25);
    return integerOnly ? Math.round(next) : round(next);
  }
  if (value < 0) {
    const next = Math.min(value - (Number.isInteger(value) ? 1 : 0.01), value * 1.25);
    return integerOnly ? Math.round(next) : round(next);
  }
  return value;
}

function smaller(value, { integerOnly = false } = {}) {
  if (value > 0) {
    const next = Math.max(0, Math.min(
      value - (Number.isInteger(value) ? 1 : 0.01),
      value * 0.75,
    ));
    return integerOnly ? Math.floor(next) : round(next);
  }
  if (value < 0) {
    const next = Math.min(value - (Number.isInteger(value) ? 1 : 0.01), value * 1.25);
    return integerOnly ? Math.round(next) : round(next);
  }
  return value;
}

function progressionMode(effect) {
  if (effect.type === "delayed-damage" && effect.target === "self") return "non-increase";
  if (effect.type === "modify-status") return "preserve";
  if (effect.target === "all") return "preserve";
  if (effect.type === "scale-status") {
    const statuses = effect.statuses || [];
    if (effect.target === "self"
      && statuses.every((status) => HARMFUL_SELF_STATUSES.has(status))) {
      return "decrease";
    }
    if (effect.target === "self"
      && statuses.every((status) => !HARMFUL_SELF_STATUSES.has(status))) {
      return "increase";
    }
    if (effect.target === "enemy"
      && statuses.every((status) => BENEFICIAL_ENEMY_STATUSES.has(status))) {
      return "decrease";
    }
    return "increase";
  }
  if (["status", "scaled-status", "status-from-status"].includes(effect.type)) {
    if (effect.target === "self" && HARMFUL_SELF_STATUSES.has(effect.status)) {
      return "non-increase";
    }
    if (effect.target === "enemy" && BENEFICIAL_ENEMY_STATUSES.has(effect.status)) {
      return "non-increase";
    }
    return "increase";
  }
  return "increase";
}

function progressiveZeroScale(rankCount) {
  return Object.freeze(Array.from({ length: rankCount }, (_, index) => (
    Math.round((100 * (rankCount - index - 1)) / rankCount)
  )));
}

function progressiveRetainScale(start, rankCount) {
  if (rankCount <= 1) return Object.freeze([start]);
  return Object.freeze(Array.from({ length: rankCount }, (_, index) => (
    round((start * (rankCount - index - 1)) / (rankCount - 1))
  )));
}

function progressiveFullRetention(start, rankCount) {
  if (rankCount <= 1) return Object.freeze([start]);
  return Object.freeze(Array.from({ length: rankCount }, (_, index) => (
    round(start + (((100 - start) * index) / (rankCount - 1)))
  )));
}

function strengthenTable(effect, table, rankCount, key) {
  const authored = Array.from({ length: rankCount }, (_, index) => (
    table[Math.min(index, table.length - 1)]
  ));
  const mode = progressionMode(effect);
  if (effect.type === "scale-status" && authored.every((value) => value === 0)) {
    return mode === "decrease"
      ? progressiveZeroScale(rankCount)
      : Object.freeze(authored);
  }
  if (effect.type === "scale-status"
    && mode === "decrease"
    && authored.every((value) => value === authored[0])) {
    return progressiveRetainScale(authored[0], rankCount);
  }
  if (effect.type === "scale-status"
    && mode === "increase"
    && authored[0] > 0
    && authored[0] <= 100
    && authored.every((value) => value === authored[0])) {
    return progressiveFullRetention(authored[0], rankCount);
  }

  const expanded = [authored[0]];
  for (let index = 1; index < authored.length; index += 1) {
    const previous = expanded[index - 1];
    const current = authored[index];
    if (mode === "increase") {
      expanded.push(current > previous
        ? current
        : stronger(previous, { integerOnly: key === "countByRank" }));
    } else if (mode === "decrease") {
      expanded.push(current < previous
        ? current
        : smaller(previous, { integerOnly: key === "countByRank" }));
    } else if (mode === "non-increase") {
      expanded.push(Math.min(current, previous));
    } else {
      expanded.push(current);
    }
  }
  return Object.freeze(expanded);
}

/**
 * Replace allowance-only promotions with visible, authoritative effect progression.
 * Source rows remain attached as evidence; this is the explicit Solitaire balance adaptation.
 */
export function withFunctionalPromotions(effects, rankCount, topRarity) {
  if (topRarity !== "mythical" || rankCount <= 1) return Object.freeze([...effects]);
  return Object.freeze(effects.map((effect) => {
    const key = MAGNITUDE_TABLE_KEYS.find((candidate) => Array.isArray(effect[candidate]));
    if (!key) return effect;
    return Object.freeze({
      ...effect,
      [key]: strengthenTable(effect, effect[key], rankCount, key),
    });
  }));
}
