// Solitaire professions as Tower of Winter starting packages.
//
// This is the seam that lets the deck engine retire. The plan's decision was to treat a
// profession as a complete rules package — "starting actions, traits, skills … belong
// together" — rather than as a bag of bespoke combat abilities bolted onto a shared
// engine. So each profession resolves to one starting trait and a skill loadout drawn
// from the Tower of Winter catalogue, and nothing else about it reaches combat.
//
// Resolution is one-directional: combat asks what package a profession grants, and the
// narrative layer never learns that traits or skills exist. That keeps professions,
// specialisations and progression free to stay what they are for story and world play.

import { getSkill, SKILL_SLOTS } from "./skills.js";
import { getTrait } from "./traits.js";

// Every package opens with an attack slot and a defence slot, because Strike and Block
// are slots in Tower of Winter rather than cards — a replacement takes the slot over.
const BASE = Object.freeze(["strike", "block"]);

function pkg(traitId, ...skills) {
  return Object.freeze({ traitId, skills: Object.freeze([...BASE, ...skills]) });
}

const PACKAGES = Object.freeze({
  // Martial
  fighter: pkg("ironclad", "warcry", "deliberate-blow"),
  barbarian: pkg("rage", "elixir-of-wrath", "mortal-blow"),
  monk: pkg("agility", "emergency-evasion", "sudden-blow"),
  ranger: pkg("accuracy", "sudden-blow", "penetration"),
  rogue: pkg("ambush", "emergency-evasion", "slaughter"),
  paladin: pkg("guardian", "impregnable", "shield-bash"),
  commander: pkg("fortitude", "warcry", "threatening-cry"),

  // Casters
  wizard: pkg("destructor", "penetration", "rapid-cooling"),
  sorcerer: pkg("ignition", "penetration", "rising-power"),
  warlock: pkg("decay", "sleep-grenade", "judge-of-fate"),
  cleric: pkg("aegis", "first-aid", "impregnable", "sudden-blow"),
  druid: pkg("adaptation", "first-aid", "thirst-for-blood"),
  artificer: pkg("venom", "rapid-cooling", "urgent-guard"),
  bard: pkg("luck", "shouting", "elixir-of-wrath"),

  // Generalist and civilian professions. They fight, but they fight like people who do
  // something else for a living: an opening trait that keeps them upright and one answer.
  wanderer: pkg("survival", "emergency-evasion", "sudden-blow"),
  innkeeper: pkg("endurance", "urgent-guard"),
  farmer: pkg("survival", "urgent-guard"),
  merchant: pkg("luck", "emergency-evasion"),
  artisan: pkg("ironclad", "urgent-guard"),
  labourer: pkg("endurance", "warcry"),
  scholar: pkg("anatomy", "emergency-evasion"),
  healer: pkg("aegis", "first-aid"),
  performer: pkg("agility", "emergency-evasion"),
  mariner: pkg("swift", "sudden-blow"),
  diplomat: pkg("luck", "shouting"),
  courtier: pkg("anatomy", "emergency-evasion"),
  steward: pkg("endurance", "urgent-guard"),
  ruler: pkg("aegis", "threatening-cry"),
  attendant: pkg("swift", "emergency-evasion"),
});

export const FALLBACK_PROFESSION_ID = "wanderer";

export function towPackageForProfession(professionId) {
  if (typeof professionId === "string" && Object.hasOwn(PACKAGES, professionId)) {
    return PACKAGES[professionId];
  }
  return PACKAGES[FALLBACK_PROFESSION_ID];
}

export function mappedProfessionIds() {
  return Object.keys(PACKAGES);
}

/**
 * The combat build a character brings to a fight.
 *
 * Trait rank rises with the character's level so a veteran's Ironclad is worth more than
 * a recruit's, which is the one place Solitaire's progression is allowed to touch a
 * Tower of Winter number. The curve is a judgement, not evidence: rank 1 at level 1 up to
 * the cap of 7 near level 61+.
 */
export const PROVISIONAL_LEVEL_TO_RANK = Object.freeze({
  thresholds: Object.freeze([1, 6, 16, 26, 36, 46, 61]),
  evidence: "bridge-policy",
});

export function traitRankForLevel(level) {
  const value = Number.isFinite(level) ? level : 1;
  let rank = 1;
  PROVISIONAL_LEVEL_TO_RANK.thresholds.forEach((threshold, index) => {
    if (value >= threshold) rank = index + 1;
  });
  return Math.max(1, Math.min(7, rank));
}

export function towBuildForCharacter(character = {}) {
  const definition = towPackageForProfession(character.profession);
  const rank = traitRankForLevel(character.level ?? character.progression?.level ?? 1);
  const skills = definition.skills.filter((id) => getSkill(id)).slice(0, SKILL_SLOTS);
  const traits = getTrait(definition.traitId) ? { [definition.traitId]: rank } : {};
  return { traits, skills, runes: [] };
}
