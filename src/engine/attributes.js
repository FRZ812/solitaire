import { ATTRIBUTE_CAP, ATTR_KEYS, ATTR_LABELS } from "../config.js";
import { effectiveAttributes } from "../data/proficiencies.js";
import { attributeThresholdMods } from "../data/attribute-tiers.js";
import { resolveRace, effectiveRaceLifespan } from "../data/races.js";
import { professionRecord } from "../data/professions.js";

// The player's max HP is derived from VIGOR (so toughness is a real, investable
// stat — mirroring how NPCs get HP from vigor). The original curve is preserved
// exactly through 30. Beyond the old cap it becomes linear: a divine score of 90
// yields 2,810 max HP, about 2.8x the old 1,010 ceiling rather than the ninefold
// result produced by extending the quadratic unchanged.
// (This is the ONE home for vigor's HP — combat reads vitalityMax, and the
// attribute-threshold table no longer adds vigor maxHealth, to avoid double-count.)
export const BASE_VITALITY = 20;
export const HP_PER_VIGOR = 5;
const LEGACY_ATTRIBUTE_CAP = 30;

function boundedAttribute(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(ATTRIBUTE_CAP, parsed)) : 0;
}

export function maxVitalityFor(character) {
  const vigor = effectiveAttributes(character).vigor || 0;
  return Math.round(BASE_VITALITY + vigorHealthBonus(vigor));
}

// The max-HP a given Vigor score contributes (beyond the innate base) — surfaced
// in the attribute panel as Vigor's always-on, since the HP itself lives in
// vitalityMax rather than the combat statMod table.
export function vigorHealthBonus(v) {
  const vigor = boundedAttribute(v);
  const legacyBonus = (score) => score * HP_PER_VIGOR + Math.max(0, score * score - 16) * 0.95;
  if (vigor <= LEGACY_ATTRIBUTE_CAP) return Math.round(legacyBonus(vigor));
  return Math.round(legacyBonus(LEGACY_ATTRIBUTE_CAP) + (vigor - LEGACY_ATTRIBUTE_CAP) * 30);
}

// Recompute and store `vitalityMax` from current (effective) vigor — call wherever
// vigor can change (creation, racial kit, attribute growth, on load). A positive
// delta heals you by that much (gaining toughness mends), never overhealing; a
// drop clamps current vitality down. Mutates and returns the character.
export function recomputeVitalityMax(character) {
  if (!character) return character;
  const prevMax = character.vitalityMax ?? 0;
  const nextMax = maxVitalityFor(character);
  const cur = character.vitality ?? nextMax;
  character.vitalityMax = nextMax;
  const delta = nextMax - prevMax;
  character.vitality = Math.max(0, Math.min(nextMax, delta > 0 ? cur + delta : cur));
  return character;
}

// MIND DRIVES RESOLVE the way Vigor drives HP: a back-loaded pool so a low-Mind
// fighter has little to spend on spells while a true mage commands a deep well.
// The old curve remains exact through 30, then grows linearly to keep 90 at about
// 2.7x the old pool instead of letting the quadratic run away.
export const BASE_RESOLVE = 6;
export const RESOLVE_PER_MIND = 1;
export const BASE_RESOLVE_REGEN = 1;

// The pool for a raw Mind score — the single source of truth, shared by the
// player (via effective attributes), companions, and enemies (bestiary).
export function resolvePoolForMind(mind) {
  const m = boundedAttribute(mind);
  const legacyPool = (score) => BASE_RESOLVE + score * RESOLVE_PER_MIND
    + Math.round(Math.max(0, score * score - 16) * 0.05);
  if (m <= LEGACY_ATTRIBUTE_CAP) return Math.round(legacyPool(m));
  return Math.round(legacyPool(LEGACY_ATTRIBUTE_CAP) + (m - LEGACY_ATTRIBUTE_CAP) * 2.2);
}

/** Per-round Archetype recovery: a universal baseline plus authored Presence milestones. */
export function resolveRegenForAttributes(attrs = {}) {
  const threshold = attributeThresholdMods(attrs).triggers.resolveRegen || 0;
  return BASE_RESOLVE_REGEN + Math.max(0, Math.round(threshold));
}

export function maxResolveFor(character) {
  const a = effectiveAttributes(character);
  // Presence's always-on deepens the pool (attribute-tiers smoothStats.maxResolve).
  const bonus = attributeThresholdMods(a).statMods.maxResolve || 0;
  return resolvePoolForMind(a.mind || 0) + bonus;
}

// Mirror recomputeVitalityMax for resolve: gaining Mind tops you up, losing it
// clamps down. Call wherever Mind can change (creation, kit, growth, load) — and
// for companions, so every caster carries their own well.
export function recomputeResolveMax(character) {
  if (!character) return character;
  const prevMax = character.resolveMax ?? 0;
  const nextMax = maxResolveFor(character);
  const cur = character.resolve ?? nextMax;
  character.resolveMax = nextMax;
  const delta = nextMax - prevMax;
  character.resolve = Math.max(0, Math.min(nextMax, delta > 0 ? cur + delta : cur));
  return character;
}

// BODY (+ a little VIGOR) drives how much you can haul. Both contributions retain
// their exact old values through 30 and then diminish. Body 90 + Vigor 90 carries
// 1,624, about 2.3x the former 694 ceiling, rather than exceeding it sixfold.
// The result is `carryCapacityMax`, a HARD cap the pack/shop check against
// (engine/weight.js). Measured in the same abstract "stone" as item weights.
export const BASE_CARRY = 40;
export const CARRY_PER_BODY = 8;

export function carryCapacityFor(character) {
  const a = effectiveAttributes(character);
  const body = boundedAttribute(a.body), vigor = boundedAttribute(a.vigor);
  const legacyBodyBonus = (score) => score * CARRY_PER_BODY + Math.round(Math.max(0, score * score - 16) * 0.4);
  const bodyBonus = body <= LEGACY_ATTRIBUTE_CAP
    ? legacyBodyBonus(body)
    : legacyBodyBonus(LEGACY_ATTRIBUTE_CAP) + (body - LEGACY_ATTRIBUTE_CAP) * 14;
  const vigorBonus = vigor <= LEGACY_ATTRIBUTE_CAP
    ? vigor * 2
    : LEGACY_ATTRIBUTE_CAP * 2 + (vigor - LEGACY_ATTRIBUTE_CAP) * 1.5;
  // `carryBonus` is a TRANSIENT lift (a spell, a potion, a beast-strength buff).
  // Apply a temporary buff by setting character.carryBonus and clearing it when it
  // lapses — NEVER by writing carryCapacityMax directly, which the every-beat
  // recompute (engine/beat.js) would overwrite. When the bonus clears the cap
  // falls back, and if the load now exceeds it the bearer is simply flagged
  // overburdened (no items lost) until they shed weight (engine/weight.js).
  return Math.round(BASE_CARRY + bodyBonus + vigorBonus + (character.carryBonus || 0));
}

export function recomputeCarryCapacity(character) {
  if (!character) return character;
  character.carryCapacityMax = carryCapacityFor(character);
  return character;
}

// A role-tagged profession skews toward the stats that role leans on in combat.
const ROLE_ATTR_SKEW = {
  Tank: { body: 1, vigor: 1 },
  Bruiser: { body: 1, vigor: 1 },
  "Ranged DPS": { reflex: 1, wit: 1 },
  Assassin: { reflex: 1, wit: 1 },
  Skirmisher: { reflex: 1 },
  Healer: { mind: 1, presence: 1 },
  Mage: { mind: 1 },
  Warlock: { mind: 1, presence: 1 },
  Face: { presence: 1 },
  Demigod: { body: 1, vigor: 1, presence: 1 },
  "God-Tyrant": { presence: 2, mind: 1 },
};

// Common (non-adventuring) occupations have no combat "role" tag but still
// imply a leaning — a farmer is built for labour, a courtier for presence.
const COMMON_PROFESSION_SKEW = {
  farmer: { body: 1, vigor: 1 },
  innkeeper: { presence: 1 },
  peddler: { wit: 1 },
  monarch: { presence: 1 },
  noble: { presence: 1 },
  witch: { mind: 1 },
  speaker: { presence: 1 },
  "chapter-master": { body: 1, presence: 1 },
  "hold-father": { vigor: 1, presence: 1 },
  matriarch: { presence: 1, wit: 1 },
};

// A rough life-stage bucket from the race's biological lifespan curve — used
// only to nudge an estimate, not to model aging precisely.
function ageStage(race, subrace, age) {
  if (age == null) return "adult";
  const span = effectiveRaceLifespan(race, subrace) || { adult: 16, elder: 60, max: 80 };
  if (age < span.adult) return "young";
  if (age >= span.elder) return "elder";
  return "adult";
}

// Estimate a plausible 6-stat block for an NPC the narrator introduced without
// ever rolling one (an improvised companion joining via discoveries.characters
// with no authored template to force stats). Not a substitute for authored
// design — just a sanity default shaped by what we do know about them (race,
// age, profession) instead of a flat, characterless baseline.
export function estimateAttributesFor({ race, subrace, age, agingMode, profession } = {}) {
  const attrs = { body: 2, reflex: 2, vigor: 2, mind: 2, wit: 2, presence: 2 };
  const kit = race ? resolveRace(race, subrace) : null;
  if (kit) {
    for (const [k, v] of Object.entries(kit.attributeModifiers || {})) {
      attrs[k] = (attrs[k] ?? 2) + v;
    }
  }
  if (agingMode !== "ageless" && agingMode !== "out-of-time") {
    const stage = ageStage(race, subrace, age);
    if (stage === "young") { attrs.body -= 1; attrs.vigor -= 1; attrs.wit += 1; }
    else if (stage === "elder") { attrs.body -= 1; attrs.reflex -= 1; attrs.mind += 1; attrs.wit += 1; }
  }
  const rec = profession ? professionRecord(profession) : null;
  const skew = (rec?.role && ROLE_ATTR_SKEW[rec.role]) || COMMON_PROFESSION_SKEW[profession];
  if (skew) {
    for (const [k, v] of Object.entries(skew)) attrs[k] = (attrs[k] ?? 2) + v;
  }
  for (const k of ATTR_KEYS) attrs[k] = Math.max(1, Math.min(6, attrs[k] ?? 2));
  return attrs;
}

export function applyAttributeChanges(attrs, changes) {
  if (!changes) return { next: attrs, growthLines: [] };
  const next = { ...attrs };
  const growthLines = [];
  for (const k of ATTR_KEYS) {
    if (typeof changes[k] === "number" && changes[k] !== 0) {
      const before = next[k] ?? 0;
      next[k] = Math.max(0, Math.min(ATTRIBUTE_CAP, before + changes[k]));
      if (next[k] !== before) growthLines.push(`${ATTR_LABELS[k]} ${before} → ${next[k]}`);
    }
  }
  return { next, growthLines };
}
