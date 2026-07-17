import { ATTR_KEYS, ATTR_LABELS } from "../config.js";
import { effectiveAttributes } from "../data/proficiencies.js";
import { attributeThresholdMods } from "../data/attribute-tiers.js";
import { resolveRace, effectiveRaceLifespan } from "../data/races.js";
import { professionRecord } from "../data/professions.js";

// The player's max HP is derived from VIGOR (so toughness is a real, investable
// stat — mirroring how NPCs get HP from vigor). A linear floor keeps early builds
// near the legacy baseline (vigor ≈ 2 → ~30), plus a back-loaded curve that pays
// off the grind: vigor 30 → ~+840 on top, so a maxed build reads ~1010 max HP.
// (This is the ONE home for vigor's HP — combat reads vitalityMax, and the
// attribute-threshold table no longer adds vigor maxHealth, to avoid double-count.)
export const BASE_VITALITY = 20;
export const HP_PER_VIGOR = 5;

export function maxVitalityFor(character) {
  const vigor = effectiveAttributes(character).vigor || 0;
  return Math.round(BASE_VITALITY + vigorHealthBonus(vigor));
}

// The max-HP a given Vigor score contributes (beyond the innate base) — surfaced
// in the attribute panel as Vigor's always-on, since the HP itself lives in
// vitalityMax rather than the combat statMod table.
export function vigorHealthBonus(v) {
  const vigor = v || 0;
  return Math.round(vigor * HP_PER_VIGOR + Math.max(0, vigor * vigor - 16) * 0.95);
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
// Resolve no longer trickles back each turn — you spend down a big pool and refill
// it by rest or drink — so the pool itself is generous (mind 30 → ~+44 on top).
export const BASE_RESOLVE = 6;
export const RESOLVE_PER_MIND = 1;

// The pool for a raw Mind score — the single source of truth, shared by the
// player (via effective attributes), companions, and enemies (bestiary).
export function resolvePoolForMind(mind) {
  const m = mind || 0;
  const curve = Math.round(Math.max(0, m * m - 16) * 0.05); // ~0 at mind ≤4, ~+44 at 30
  return Math.round(BASE_RESOLVE + m * RESOLVE_PER_MIND + curve);
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

// BODY (+ a little VIGOR) drives how much you can haul, the same back-loaded way
// Vigor drives HP — a strong build carries a war's worth of loot, a frail scholar
// little. The result is `carryCapacityMax`, a HARD cap the pack/shop check against
// (engine/weight.js). Measured in the same abstract "stone" as item weights.
export const BASE_CARRY = 40;
export const CARRY_PER_BODY = 8;

export function carryCapacityFor(character) {
  const a = effectiveAttributes(character);
  const body = a.body || 0, vigor = a.vigor || 0;
  const curve = Math.round(Math.max(0, body * body - 16) * 0.4); // ~0 at body ≤4, back-loaded
  // `carryBonus` is a TRANSIENT lift (a spell, a potion, a beast-strength buff).
  // Apply a temporary buff by setting character.carryBonus and clearing it when it
  // lapses — NEVER by writing carryCapacityMax directly, which the every-beat
  // recompute (engine/beat.js) would overwrite. When the bonus clears the cap
  // falls back, and if the load now exceeds it the bearer is simply flagged
  // overburdened (no items lost) until they shed weight (engine/weight.js).
  return Math.round(BASE_CARRY + body * CARRY_PER_BODY + vigor * 2 + curve + (character.carryBonus || 0));
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
      next[k] = Math.max(0, Math.min(25, before + changes[k]));
      if (next[k] !== before) growthLines.push(`${ATTR_LABELS[k]} ${before} → ${next[k]}`);
    }
  }
  return { next, growthLines };
}
