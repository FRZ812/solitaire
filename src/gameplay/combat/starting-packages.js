// The authored starting-package registry.
//
// A profession resolves to one starting trait and a skill loadout. That mapping already
// existed inside professions.js as a private table; this is the registry layer around it,
// so a package can be inspected before play rather than discovered in the first fight.
// The plan's requirement is that every template has a distinct, inspectable Spire of
// Winter mapping — you cannot show a player their combat identity at character select if
// the only way to obtain it is to start a fight.
//
// This delegates rather than duplicating: professions.js stays the single source of the
// table, and this file adds validation, inspection and the package contract.

import { getSkill, SKILL_SLOTS } from "./skills.js";
import { getTrait, TRAIT_RANK_CAP } from "./traits.js";
import {
  FALLBACK_PROFESSION_ID,
  mappedProfessionIds,
  combatPackageForProfession,
  traitRankForLevel,
} from "./professions.js";

export { FALLBACK_PROFESSION_ID };

export const STARTING_PACKAGE_VERSION = 1;

/**
 * A package as presented to a player: the trait they open with, the skills in their
 * loadout, and enough detail to compare two professions before committing.
 */
export function startingPackage(professionId, { level = 1 } = {}) {
  const definition = combatPackageForProfession(professionId);
  if (!definition) return null;
  const trait = getTrait(definition.traitId);
  if (!trait) return null;

  const skills = definition.skills
    .filter((id) => getSkill(id))
    .slice(0, SKILL_SLOTS)
    .map((id) => {
      const skill = getSkill(id);
      return Object.freeze({
        id,
        name: skill.name,
        rarity: skill.rarity,
        consumesTurn: skill.consumesTurn,
        cooldown: skill.cooldown,
        replaces: skill.replaces,
      });
    });

  return Object.freeze({
    version: STARTING_PACKAGE_VERSION,
    professionId: Object.hasOwn(indexedIds(), professionId) ? professionId : FALLBACK_PROFESSION_ID,
    trait: Object.freeze({
      id: trait.id,
      name: trait.name,
      rank: traitRankForLevel(level),
      rankCap: TRAIT_RANK_CAP,
      effect: trait.effect,
      cadence: trait.cadence,
    }),
    skills: Object.freeze(skills),
  });
}

let cachedIds = null;
function indexedIds() {
  if (!cachedIds) {
    cachedIds = Object.freeze(Object.fromEntries(mappedProfessionIds().map((id) => [id, true])));
  }
  return cachedIds;
}

export function startingPackageIds() {
  return mappedProfessionIds();
}

/** Whether a package is well formed: real trait, real skills, within the slot limit. */
export function isValidStartingPackage(value) {
  return Boolean(
    value
    && value.version === STARTING_PACKAGE_VERSION
    && typeof value.professionId === "string"
    && value.trait
    && getTrait(value.trait.id)
    && Number.isSafeInteger(value.trait.rank)
    && value.trait.rank >= 1
    && value.trait.rank <= TRAIT_RANK_CAP
    && Array.isArray(value.skills)
    && value.skills.length > 0
    && value.skills.length <= SKILL_SLOTS
    && value.skills.every((skill) => getSkill(skill.id)),
  );
}

/**
 * Every package, for the character-select surfaces. Sorted by id so the order a player
 * sees does not depend on object key iteration.
 */
export function allStartingPackages({ level = 1 } = {}) {
  return startingPackageIds()
    .slice()
    .sort()
    .map((id) => startingPackage(id, { level }))
    .filter(Boolean);
}
