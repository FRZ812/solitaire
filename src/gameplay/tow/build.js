// The durable player build.
//
// Today a build is recomputed from profession and level every time a fight starts
// (towBuildForCharacter), which means it cannot grow: a trait earned from a trainer, a
// skill replaced by a reward, a rune found in a ruin all vanish on the next encounter.
// This is the persistent, player-owned version — the thing a character actually carries.
//
// It is a plain JSON record so it can live in campaign state and survive a save round
// trip, and it validates strictly because it is durable: a malformed build must be
// rejected at the boundary rather than crashing a fight three rounds in.

import { cloneJsonData } from "../kernel/json-data.js";
import { getSkill, maxRankOf, SKILL_SLOTS } from "./skills.js";
import { getCombatTrait, getFusion, getTrait, TRAIT_CAPACITY, TRAIT_RANK_CAP } from "./traits.js";
import { startingPackage } from "./starting-packages.js";
import { traitRankForLevel } from "./professions.js";

export const TOW_BUILD_VERSION = 2;
const MAX_RUNES = 32;
const BUILD_KEYS = Object.freeze(["professionId", "runes", "skills", "traits", "version"]);

function validId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 128;
}

export function isLegacyTowBuild(value) {
  return Boolean(value
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.keys(value).sort().join(",") === BUILD_KEYS.join(",")
    && value.version === 1
    && validId(value.professionId)
    && value.traits
    && typeof value.traits === "object"
    && !Array.isArray(value.traits)
    && Array.isArray(value.skills)
    && value.skills.every(validId)
    && Array.isArray(value.runes));
}

export function migrateLegacyTowBuild(value) {
  if (!isLegacyTowBuild(value)) return null;
  try {
    return createTowBuild({
      professionId: value.professionId,
      traits: value.traits,
      skills: value.skills.map((id) => ({ id, rank: 1 })),
      runes: value.runes,
    });
  } catch {
    return null;
  }
}

/** Compose the build a profession starts with, at a given level. */
export function startingBuild(professionId, { level = 1 } = {}) {
  const pkg = startingPackage(professionId, { level });
  if (!pkg) return null;
  return createTowBuild({
    professionId: pkg.professionId,
    traits: { [pkg.trait.id]: traitRankForLevel(level) },
    skills: pkg.skills.map((skill) => skill.id),
    runes: [],
  });
}

export function createTowBuild({ professionId, traits = {}, skills = [], runes = [] } = {}) {
  if (!validId(professionId)) throw new TypeError("invalid-build-profession");

  const cleanTraits = {};
  for (const [traitId, rank] of Object.entries(cloneJsonData(traits, "invalid-build-traits"))) {
    if (!getCombatTrait(traitId)) throw new TypeError(`unknown-trait:${traitId}`);
    if (!Number.isSafeInteger(rank) || rank < 1 || rank > TRAIT_RANK_CAP) {
      throw new TypeError("invalid-trait-rank");
    }
    if (getFusion(traitId) && rank !== TRAIT_RANK_CAP) throw new TypeError("invalid-fusion-rank");
    cleanTraits[traitId] = rank;
  }
  if (Object.keys(cleanTraits).length > TRAIT_CAPACITY) throw new TypeError("trait-capacity-exceeded");

  if (!Array.isArray(skills)) throw new TypeError("invalid-build-skills");
  const cleanSkills = [];
  for (const entry of skills) {
    const skillId = typeof entry === "string" ? entry : entry?.id;
    const rank = typeof entry === "string" ? 1 : entry?.rank;
    const definition = getSkill(skillId);
    if (!definition) throw new TypeError(`unknown-skill:${skillId}`);
    if (definition.slot !== "slotted") throw new TypeError("unslotted-skill-in-loadout");
    if (!Number.isSafeInteger(rank) || rank < 1 || rank > maxRankOf(skillId)) {
      throw new TypeError("invalid-skill-rank");
    }
    if (cleanSkills.some((skill) => skill.id === skillId)) throw new TypeError("duplicate-skill");
    cleanSkills.push({ id: skillId, rank });
  }
  if (cleanSkills.length > SKILL_SLOTS) throw new TypeError("skill-capacity-exceeded");

  if (!Array.isArray(runes) || runes.length > MAX_RUNES || !runes.every(validId)) {
    throw new TypeError("invalid-build-runes");
  }

  return canonicalizeTowBuild({
    version: TOW_BUILD_VERSION,
    professionId,
    traits: cleanTraits,
    skills: cleanSkills,
    runes: [...new Set(runes)],
  });
}

/**
 * Canonical form: keys and trait ids sorted, so two builds that are the same build hash
 * the same. Receipt identity depends on this.
 */
export function canonicalizeTowBuild(build) {
  const traits = {};
  for (const traitId of Object.keys(build.traits).sort()) traits[traitId] = build.traits[traitId];
  return {
    version: build.version,
    professionId: build.professionId,
    traits,
    skills: build.skills.map((skill) => ({ id: skill.id, rank: skill.rank })),
    runes: [...build.runes].sort(),
  };
}

export function isTowBuild(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  if (keys.length !== BUILD_KEYS.length || keys.some((key, at) => key !== BUILD_KEYS[at])) {
    return false;
  }
  if (value.version !== TOW_BUILD_VERSION || !validId(value.professionId)) return false;
  if (!value.traits || typeof value.traits !== "object" || Array.isArray(value.traits)) return false;
  const traitIds = Object.keys(value.traits);
  if (traitIds.length > TRAIT_CAPACITY) return false;
  if (!traitIds.every((id) => getCombatTrait(id)
    && Number.isSafeInteger(value.traits[id])
    && value.traits[id] >= 1
    && value.traits[id] <= TRAIT_RANK_CAP
    && (!getFusion(id) || value.traits[id] === TRAIT_RANK_CAP))) return false;
  if (!Array.isArray(value.skills) || value.skills.length > SKILL_SLOTS) return false;
  if (!value.skills.every((skill) => skill
    && typeof skill === "object"
    && !Array.isArray(skill)
    && Object.keys(skill).sort().join(",") === "id,rank"
    && getSkill(skill.id)?.slot === "slotted"
    && Number.isSafeInteger(skill.rank)
    && skill.rank >= 1
    && skill.rank <= maxRankOf(skill.id))) return false;
  if (new Set(value.skills.map((skill) => skill.id)).size !== value.skills.length) return false;
  return Array.isArray(value.runes)
    && value.runes.length <= MAX_RUNES
    && value.runes.every(validId)
    && new Set(value.runes).size === value.runes.length;
}

/** The shape the encounter kernel consumes. Derived, never stored twice. */
export function encounterBuildFrom(build) {
  return {
    traits: { ...build.traits },
    skills: build.skills.map((skill) => ({ id: skill.id, rank: skill.rank })),
    runes: [...build.runes],
  };
}

// ---------------------------------------------------------------------------
// Growth — the reason a durable build exists at all
// ---------------------------------------------------------------------------

/** Acquire a trait, or raise one already held. Pure. */
export function acquireTrait(build, traitId) {
  if (!getTrait(traitId)) return { ok: false, reason: "unknown-trait", build: null };
  const held = Object.hasOwn(build.traits, traitId);
  if (held && build.traits[traitId] >= TRAIT_RANK_CAP) {
    return { ok: false, reason: "trait-at-rank-cap", build: null };
  }
  if (!held && Object.keys(build.traits).length >= TRAIT_CAPACITY) {
    return { ok: false, reason: "trait-capacity-full", build: null };
  }
  const traits = { ...build.traits, [traitId]: held ? build.traits[traitId] + 1 : 1 };
  return { ok: true, reason: null, build: canonicalizeTowBuild({ ...build, traits }) };
}

/** Add a rune, which is what makes a fusion reachable. Pure. */
export function acquireRune(build, runeId) {
  if (!validId(runeId)) return { ok: false, reason: "invalid-rune", build: null };
  if (build.runes.includes(runeId)) return { ok: false, reason: "rune-already-held", build: null };
  if (build.runes.length >= MAX_RUNES) return { ok: false, reason: "rune-capacity-full", build: null };
  return {
    ok: true,
    reason: null,
    build: canonicalizeTowBuild({ ...build, runes: [...build.runes, runeId] }),
  };
}
