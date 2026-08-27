// The complete Solitaire combat rules roster, rebuilt as reusable Solitaire archetypes.
// A selection chooses a combat chassis, trait, five-action kit, equipment package, and
// representative portrait. It does not choose a prewritten protagonist. Source ids remain
// migration aliases so existing saves and replays continue to resolve the same mechanics.

import { itemTemplate } from "../../data/catalog.js";
import { resolvePoolForMind, resolveRegenForAttributes } from "../../engine/attributes.js";
import {
  getCombatArchetypeIdentity,
  sameCombatArchetype,
} from "./archetype-identities.js";
import { FIXED_CHARACTER_ABILITY_TYPES } from "./character-abilities.js";
import {
  DEFAULT_STARTING_KEEPSAKE_ID,
  getStartingKeepsake,
  isStartingKeepsake,
} from "./keepsakes.js";
import { SKILL_SLOTS, getSkill, skillRarityChoices } from "./skills.js";
import { getFusion, getTrait } from "./traits.js";
import { startingPackage } from "./starting-packages.js";
import { describeCombatItems, getCombatStartItemGrant } from "./start-items.js";

export const ARCHETYPE_CHARACTER_SOURCE = "https://namu.wiki/w/%EA%B2%A8%EC%9A%B8%EC%9D%98%20%ED%83%91/%EC%BA%90%EB%A6%AD%ED%84%B0";
export const ARCHETYPE_ROSTER_SIZE = 12;

function archetypeRepresentative(identity) {
  const defaults = identity.defaults;
  return Object.freeze({
    id: identity.id,
    name: identity.name,
    sourceName: identity.name,
    epithet: identity.descriptor,
    summary: identity.summary,
    history: identity.design,
    portraitKey: `archetype:${identity.id}`,
    race: defaults.race,
    subrace: defaults.subrace || null,
    kindLabel: defaults.kindLabel || null,
    origin: defaults.origin,
    gender: defaults.gender,
    age: defaults.age,
    agingMode: defaults.agingMode,
    lifespanMultiplier: defaults.lifespanMultiplier,
    appearance: defaults.appearance,
    baseAppearance: identity.portraitDirection,
    source: Object.freeze({
      page: ARCHETYPE_CHARACTER_SOURCE,
      label: identity.name,
      legacyId: identity.legacyId,
    }),
  });
}

function archetype({
  id,
  professionId,
  traitId,
  traitRank = 3,
  skills,
  tagline,
  playstyle,
  attention,
  attributes,
  baseStats,
  gear,
  color,
  portrait = {},
}) {
  const identity = getCombatArchetypeIdentity(id);
  if (!identity) throw new TypeError(`unknown-archetype-identity:${id}`);
  if (!startingPackage(professionId)) throw new TypeError(`unknown-archetype-profession:${professionId}`);
  const combatStats = {
    ...baseStats,
    resolveMax: baseStats.resolveMax ?? resolvePoolForMind(attributes.mind || 0),
    resolveRegen: baseStats.resolveRegen ?? resolveRegenForAttributes(attributes),
  };
  const representative = archetypeRepresentative(identity);
  return Object.freeze({
    id: identity.id,
    legacyId: identity.legacyId,
    mechanicsId: identity.legacyId,
    name: identity.name,
    role: identity.role,
    descriptor: identity.descriptor,
    summary: identity.summary,
    design: identity.design,
    palette: identity.palette,
    materials: identity.materials,
    vfxTheme: identity.vfxTheme,
    power: "Expedition",
    professionId,
    tagline,
    playstyle,
    attention,
    color,
    portrait: Object.freeze({ scale: 1, x: "50%", y: "100%", ...portrait }),
    // Compatibility name for creation surfaces that already consume `character`; this is
    // an archetype representative, never a canonical person or source protagonist.
    character: representative,
    representative,
    attributes: Object.freeze({ ...attributes }),
    baseStats: Object.freeze(combatStats),
    gear: Object.freeze([...gear]),
    source: Object.freeze({
      page: ARCHETYPE_CHARACTER_SOURCE,
      label: identity.name,
      legacyId: identity.legacyId,
    }),
    build: Object.freeze({
      traits: Object.freeze({ [traitId]: traitRank }),
      skills: Object.freeze([...skills]),
      runes: Object.freeze([]),
    }),
  });
}

export const STARTING_ARCHETYPES = Object.freeze([
  archetype({
    id: "knight", professionId: "fighter", traitId: "ironclad",
    skills: ["arctic-strike", "arctic-block", "arctic-deliberate-blow", "arctic-incineration", "arctic-mortal-blow"],
    tagline: "Hold the line, create the opening, answer with steel.",
    playstyle: "The most forgiving front-line kit: absorb a declared attack, answer without surrendering defence, then accept Incineration's dangerous recoil to end a crisis.",
    attention: "Low", attributes: { body: 4, reflex: 3, vigor: 4, mind: 2, wit: 3, presence: 3 },
    baseStats: { maxHp: 170, attack: 12, defense: 13, critRate: 9, dodgeRate: 4 },
    gear: ["arming-sword", "chain-shirt", "round-shield", "traveling-cloak", "marching-boots"], color: "#8293a8",
  }),
  archetype({
    id: "ranger", professionId: "ranger", traitId: "quickness",
    skills: ["demon-shoot", "demon-evasion", "demon-kick", "demon-arrow-rain", "demon-trackers-net"],
    tagline: "Read the ground, control the range, choose the shot.",
    playstyle: "Open at range, deny a lethal turn with Evasion or Kick, then let Rain of Arrows turn every prepared on-hit effect into a storm.",
    attention: "Medium", attributes: { body: 2, reflex: 5, vigor: 3, mind: 2, wit: 4, presence: 3 },
    baseStats: { maxHp: 160, attack: 13, defense: 12, critRate: 9, dodgeRate: 5 },
    gear: ["hunting-bow", "leather-jerkin", "traveling-cloak", "marching-boots"], color: "#758a58",
    portrait: { scale: 1.04, x: "48%" },
  }),
  archetype({
    id: "artificer", professionId: "artificer", traitId: "innovation",
    skills: ["artificer-fire", "artificer-suppressive-shot", "artificer-missile-support", "artificer-redesign", "artificer-improvement"],
    tagline: "Measure the fault, build the answer, recalibrate under fire.",
    playstyle: "Suppress incoming pressure, layer a free missile strike over the main action, and Redesign ATK and DEF into exactly the buffs the next turn needs.",
    attention: "High", attributes: { body: 2, reflex: 3, vigor: 3, mind: 5, wit: 5, presence: 3 },
    baseStats: { maxHp: 150, attack: 14, defense: 14, critRate: 9, dodgeRate: 4 },
    gear: ["light-crossbow", "padded-gambeson", "leather-bracers", "traveling-cloak"], color: "#5b9296",
    portrait: { scale: 1.02, x: "52%" },
  }),
  archetype({
    id: "berserker", professionId: "barbarian", traitId: "valiancy",
    skills: ["north-king-cleave", "north-king-vitality", "north-king-whirlwind", "north-king-earthquake", "north-king-neutralizing-blow"],
    tagline: "Momentum is armour when the pressure never breaks.",
    playstyle: "Every repeated hit compounds Valiancy. Whirlwind erodes the foe, Vitality erases attrition, and Earthquake ends the exchange with overwhelming scale.",
    attention: "Medium", attributes: { body: 5, reflex: 2, vigor: 4, mind: 2, wit: 3, presence: 5 },
    baseStats: { maxHp: 180, attack: 13, defense: 13, critRate: 6, dodgeRate: 4 },
    gear: ["battle-axe", "chain-shirt", "traveling-cloak", "marching-boots"], color: "#a45d43",
    portrait: { scale: 1.07, x: "49%" },
  }),
  archetype({
    id: "sorcerer", professionId: "druid", traitId: "ignition",
    skills: ["sleepless-swing", "sleepless-hard-scales", "sleepless-entangling-roots", "sleepless-high-speed-flight", "sleepless-fire-essence"],
    tagline: "Shape the element before it shapes the battlefield.",
    playstyle: "Arcane Ward buys time for Ignition and Fire Essence to build pressure while binding growth cancels a dangerous tempo swing. Arcane Flight commits Resolve for four Priority and a decisive sequence.",
    attention: "High", attributes: { body: 4, reflex: 3, vigor: 5, mind: 3, wit: 3, presence: 2 },
    baseStats: { maxHp: 190, attack: 12, defense: 15, critRate: 3, dodgeRate: 3 },
    gear: ["iron-spear", "leather-jerkin", "traveling-cloak", "marching-boots"], color: "#b95e46",
    portrait: { scale: 1.08, y: "102%" },
  }),
  archetype({
    id: "rogue", professionId: "rogue", traitId: "assassin",
    skills: ["assassin-flurry", "assassin-deflect", "assassin-flash-bomb", "assassin-execution", "assassin-storm-of-knives"],
    tagline: "Create one opening, then make it decisive.",
    playstyle: "Chain Slash turns Eviscerate into permanent Limp. Parrying answers multi-hit intent, Flashbang steals a command, and Execution converts the opening into a heavy finishing strike.",
    attention: "High", attributes: { body: 3, reflex: 5, vigor: 3, mind: 2, wit: 5, presence: 2 },
    baseStats: { maxHp: 160, attack: 14, defense: 11, critRate: 12, dodgeRate: 5 },
    gear: ["twin-daggers", "leather-jerkin", "traveling-cloak", "marching-boots"], color: "#756686",
    portrait: { scale: 1.03, x: "47%" },
  }),
  archetype({
    id: "warlock", professionId: "warlock", traitId: "necromancy",
    skills: ["witch-attack", "witch-bone-shield", "witch-skeleton-summon", "witch-all-out-attack", "witch-mirror-image"],
    tagline: "Every pact has a price; make the enemy pay first.",
    playstyle: "Accumulate summoned remnants passively and actively, weather pressure with Bone Shield, then direct five rapid attacks through the opening.",
    attention: "Medium", attributes: { body: 2, reflex: 3, vigor: 3, mind: 5, wit: 4, presence: 4 },
    baseStats: { maxHp: 150, attack: 10, defense: 16, critRate: 12, dodgeRate: 5 },
    gear: ["quarterstaff", "homespun-robe", "traveling-cloak"], color: "#80698e",
    portrait: { scale: 1.06, x: "51%" },
  }),
  archetype({
    id: "wizard", professionId: "wizard", traitId: "charge",
    skills: ["mage-magic-arrow", "mage-barrier", "mage-flame-storm", "mage-amplification", "mage-god-slaying-spear"],
    tagline: "Prepare the field, complete the formula, release the result.",
    playstyle: "Mana Shield buys time for Charge to mature. Flame Storm supplies attrition; Amplification converts the current ATK line into a turn of exacting burst damage.",
    attention: "Medium", attributes: { body: 2, reflex: 3, vigor: 3, mind: 5, wit: 5, presence: 2 },
    baseStats: { maxHp: 160, attack: 15, defense: 12, critRate: 6, dodgeRate: 5 },
    gear: ["quarterstaff", "homespun-robe", "traveling-cloak"], color: "#795f9b",
    portrait: { scale: 1.04, x: "49%" },
  }),
  archetype({
    id: "paladin", professionId: "cleric", traitId: "judgment",
    skills: ["priestess-crush", "priestess-block", "priestess-wrath-of-heaven", "priestess-doom", "priestess-immediate-judgment"],
    tagline: "Hold to the oath when certainty and safety fail.",
    playstyle: "Judgment builds naturally. Block keeps the Paladin alive at a dangerous health line, Sacred Verdict weaponizes what is missing, and Condemnation magnifies every lingering wound.",
    attention: "High", attributes: { body: 4, reflex: 2, vigor: 4, mind: 3, wit: 2, presence: 5 },
    baseStats: { maxHp: 170, attack: 11, defense: 16, critRate: 6, dodgeRate: 4 },
    gear: ["war-hammer", "chain-shirt", "round-shield", "traveling-cloak"], color: "#c2a257",
    portrait: { scale: 1.08, x: "50%" },
  }),
  archetype({
    id: "blademaster", professionId: "monk", traitId: "gale",
    skills: ["blade-slash", "blade-barrier", "blade-chi-liberation", "blade-one-flash", "blade-katana-dance"],
    tagline: "Timing, distance, and edge become one discipline.",
    playstyle: "Measured Slash and Gale build Initiative toward extra actions. Blade Barrier protects the tempo line, Chi Liberation accelerates it, and Final Flash cashes it out.",
    attention: "Medium", attributes: { body: 3, reflex: 5, vigor: 3, mind: 3, wit: 4, presence: 3 },
    baseStats: { maxHp: 160, attack: 14, defense: 12, critRate: 9, dodgeRate: 5 },
    gear: ["iron-longsword", "padded-gambeson", "traveling-cloak", "marching-boots"], color: "#6e9ca5",
    portrait: { scale: 1.07, x: "52%" },
  }),
  archetype({
    id: "vampire", professionId: "rogue", traitId: "bloodsuck",
    skills: ["vampire-claw", "vampire-blood-thirst", "vampire-heart-destroyer", "vampire-rampage", "vampire-bloodflow-absorption"],
    tagline: "Control the hunger and turn every wound into momentum.",
    playstyle: "Every damaging action becomes sustain through Bloodsuck. Blood Thirst recovers without a target, Heartbreaker opens a wound, and Rampage turns repeated hits into a violent recovery sequence.",
    attention: "Medium", attributes: { body: 4, reflex: 4, vigor: 4, mind: 3, wit: 4, presence: 4 },
    baseStats: {
      maxHp: 170,
      attack: 13,
      defense: 13,
      critRate: 9,
      dodgeRate: 4,
      resolveRegen: 2,
    },
    gear: ["iron-dagger", "leather-jerkin", "traveling-cloak", "marching-boots"], color: "#984653",
    portrait: { scale: 1.06, x: "48%" },
  }),
  archetype({
    id: "automaton", professionId: "artificer", traitId: "overheat",
    skills: ["automaton-bombardment", "automaton-repair", "automaton-emergency-cooling", "automaton-fate-manipulator", "automaton-final-counter"],
    tagline: "Balance heat, calibration, and force until the target fails.",
    playstyle: "Overheat makes both sides progressively more vulnerable. Repair holds the chassis together, Cooling vents the worst pressure, and Fate Manipulator buys an explosive action sequence at severe cost.",
    attention: "High", attributes: { body: 5, reflex: 2, vigor: 5, mind: 4, wit: 3, presence: 1 },
    baseStats: { maxHp: 200, attack: 15, defense: 10, critRate: 6, dodgeRate: 3 },
    gear: ["light-crossbow", "chain-hauberk", "iron-helm"], color: "#a36b3f",
    portrait: { scale: 1.12, y: "104%" },
  }),
]);

const ARCHETYPE_BY_ID = new Map(STARTING_ARCHETYPES.flatMap((entry) => [
  [entry.id, entry],
  [entry.legacyId, entry],
]));

export function getStartingArchetype(id) {
  return typeof id === "string" ? ARCHETYPE_BY_ID.get(id) || null : null;
}

export function createDefaultArchetypeDraft() {
  return {
    archetypeId: STARTING_ARCHETYPES[0].id,
    keepsakeId: DEFAULT_STARTING_KEEPSAKE_ID,
    preview: false,
  };
}

function ownedBySelected(skillOrTrait, selected) {
  return !skillOrTrait?.exclusiveTo || sameCombatArchetype(skillOrTrait.exclusiveTo, selected.id);
}

export function isArchetypePracticeLoadout(archetypeId, skillIds) {
  const selected = getStartingArchetype(archetypeId);
  if (!selected || !Array.isArray(skillIds) || skillIds.length !== SKILL_SLOTS) return false;
  if (new Set(skillIds).size !== SKILL_SLOTS) return false;

  const skills = skillIds.map((id) => getSkill(id));
  if (skills.some((skill) => !skill || skill.slot !== "slotted")) return false;
  const ownedFixedAbility = (skill, abilityType) => (
    skill.abilityType === abilityType && ownedBySelected(skill, selected)
  );
  const legalFlexibleAbility = (skill) => (
    (skill.abilityType === "archetype" && ownedBySelected(skill, selected))
    || (skill.abilityType === "general" && skill.exclusiveTo === null)
  );

  return ownedFixedAbility(skills[0], "basic-attack")
    && ownedFixedAbility(skills[1], "defensive")
    && skills.slice(2).every(legalFlexibleAbility);
}

export function isArchetypePracticeSkillRarities(archetypeId, skillIds, skillRarities) {
  if (!isArchetypePracticeLoadout(archetypeId, skillIds)) return false;
  return Array.isArray(skillRarities)
    && skillRarities.length === SKILL_SLOTS
    && skillRarities.every((rarity, index) => {
      const definition = getSkill(skillIds[index]);
      return skillRarityChoices(definition).includes(rarity);
    });
}

function normalizeIdentityOverride(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const name = typeof value.name === "string" ? value.name.trim().slice(0, 80) : "";
  if (!name) return null;
  const normalized = { name };
  for (const key of ["race", "origin", "gender"]) {
    if (typeof value[key] === "string" && value[key].trim()) normalized[key] = value[key].trim().slice(0, 80);
  }
  if (Number.isSafeInteger(value.age) && value.age > 0 && value.age <= 10000) normalized.age = value.age;
  if (value.appearance && typeof value.appearance === "object" && !Array.isArray(value.appearance)) {
    normalized.appearance = Object.fromEntries(Object.entries(value.appearance)
      .filter(([, entry]) => typeof entry === "string")
      .map(([key, entry]) => [key, entry.trim().slice(0, 240)]));
  }
  if (typeof value.baseAppearance === "string" && value.baseAppearance.trim()) {
    normalized.baseAppearance = value.baseAppearance.trim().slice(0, 1000);
  }
  return normalized;
}

export function normalizeArchetypeDraft(input = {}) {
  const selected = getStartingArchetype(input.archetypeId) || STARTING_ARCHETYPES[0];
  const normalized = {
    archetypeId: selected.id,
    keepsakeId: isStartingKeepsake(input.keepsakeId)
      ? input.keepsakeId
      : DEFAULT_STARTING_KEEPSAKE_ID,
    preview: input.preview === true,
  };
  const identity = normalizeIdentityOverride(input.identity);
  if (identity) normalized.identity = identity;
  const hasPracticeLoadout = isArchetypePracticeLoadout(selected.id, input.testSkillIds);
  const practiceSkillIds = hasPracticeLoadout ? input.testSkillIds : selected.build.skills;
  if (hasPracticeLoadout
    && practiceSkillIds.some((id, index) => id !== selected.build.skills[index])) {
    normalized.testSkillIds = [...input.testSkillIds];
  }
  if ((input.testSkillIds == null || hasPracticeLoadout)
    && isArchetypePracticeSkillRarities(selected.id, practiceSkillIds, input.testSkillRarities)
    && input.testSkillRarities.some((rarity, index) => rarity !== getSkill(practiceSkillIds[index]).rarity)) {
    normalized.testSkillRarities = [...input.testSkillRarities];
  }
  return normalized;
}

export function practiceBuildForArchetypeDraft(draft) {
  const normalized = normalizeArchetypeDraft(draft);
  const selected = getStartingArchetype(normalized.archetypeId);
  if (!selected) return null;
  return {
    ...selected.build,
    traits: { ...selected.build.traits },
    skills: [...(normalized.testSkillIds || selected.build.skills)],
    runes: [...selected.build.runes],
  };
}

/** Optional practice-only rarity promotions; omitted when every ability stays at its base. */
export function practiceSkillRaritiesForArchetypeDraft(draft) {
  const normalized = normalizeArchetypeDraft(draft);
  return normalized.testSkillRarities ? [...normalized.testSkillRarities] : null;
}

export function archetypeItemRows(archetypeId) {
  const selected = getStartingArchetype(archetypeId);
  return selected ? describeCombatItems(selected.gear) : [];
}

export function archetypeFusionIds(archetypeId) {
  const ids = new Set();
  for (const row of archetypeItemRows(archetypeId)) {
    for (const id of row.fusions) if (getFusion(id)) ids.add(id);
  }
  return [...ids];
}

export function characterSetupForArchetype(draft) {
  const normalized = normalizeArchetypeDraft(draft);
  const selected = getStartingArchetype(normalized.archetypeId);
  const representative = selected?.representative;
  const keepsake = getStartingKeepsake(normalized.keepsakeId);
  if (!selected || !representative || !keepsake) return null;

  const override = normalized.identity || {};
  const identity = {
    name: override.name || selected.name,
    race: override.race || representative.race,
    origin: override.origin || representative.origin,
    gender: override.gender || representative.gender,
    age: override.age || representative.age,
    appearance: { ...representative.appearance, ...(override.appearance || {}) },
    baseAppearance: override.baseAppearance || representative.baseAppearance,
  };

  return {
    name: identity.name,
    bond: selected.tagline,
    profession: selected.professionId,
    archetype: selected.id,
    combatArchetypeId: selected.id,
    progressionModel: "archetype",
    combatBaseStats: { ...selected.baseStats },
    race: identity.race,
    subrace: representative.subrace,
    origin: identity.origin,
    gender: identity.gender,
    age: identity.age,
    agingMode: representative.agingMode,
    lifespanMultiplier: representative.lifespanMultiplier,
    attractiveness: 6,
    attributes: { ...selected.attributes },
    appearance: identity.appearance,
    base_appearance: identity.baseAppearance,
    portraitKey: representative.portraitKey,
    abilities: [],
    items: [
      ...selected.gear.map((itemId) => ({ itemId, quantity: 1, worn: true })),
      { itemId: keepsake.itemId, quantity: 1, worn: false },
    ],
    coins: { gold: 2, silver: 5 },
    knows: [
      `I fight as a ${selected.name}.`,
      selected.summary,
      selected.design,
      "My combat kit has one Basic Attack, one Defensive ability, and three flexible archetype abilities.",
      `I carry ${keepsake.name} as my one starting keepsake.`,
    ],
    profile: {
      source: "combat-modular-archetype-start",
      sourcePage: ARCHETYPE_CHARACTER_SOURCE,
      identityMode: "modular-archetype",
      characterName: identity.name,
      archetypeId: selected.id,
      archetypeName: selected.name,
      legacyArchetypeId: selected.legacyId,
      power: selected.power,
      role: selected.role,
      keepsakeId: keepsake.id,
      keepsakeFamily: keepsake.family,
      keepsakeRarity: keepsake.rarity,
    },
  };
}

export function invalidStartingArchetypes() {
  const invalid = [];
  const ids = new Set();
  const legacyIds = new Set();
  const portraitKeys = new Set();
  for (const selected of STARTING_ARCHETYPES) {
    const representative = selected.representative;
    if (!representative?.id || !representative?.name || !representative?.portraitKey) {
      invalid.push(`${selected.id}:incomplete-representative`);
    }
    if (ids.has(selected.id)) invalid.push(`${selected.id}:duplicate-archetype-id`);
    if (legacyIds.has(selected.legacyId)) invalid.push(`${selected.id}:duplicate-legacy-id`);
    if (portraitKeys.has(representative?.portraitKey)) invalid.push(`${selected.id}:duplicate-portrait-key`);
    ids.add(selected.id);
    legacyIds.add(selected.legacyId);
    portraitKeys.add(representative?.portraitKey);
    if (!startingPackage(selected.professionId)) invalid.push(`${selected.id}:unknown-profession`);
    for (const [traitId, rank] of Object.entries(selected.build.traits)) {
      const trait = getTrait(traitId);
      if (!trait || !Number.isInteger(rank) || rank < 1 || rank > 7) {
        invalid.push(`${selected.id}:invalid-trait:${traitId}`);
      }
      if (trait?.exclusiveTo && !sameCombatArchetype(trait.exclusiveTo, selected.id)) {
        invalid.push(`${selected.id}:foreign-trait:${traitId}`);
      }
    }
    const skills = selected.build.skills.map((id) => getSkill(id));
    if (skills.length !== SKILL_SLOTS || skills.some((skill) => !skill)) {
      invalid.push(`${selected.id}:invalid-five-ability-kit`);
    } else {
      const typeCounts = Object.fromEntries(FIXED_CHARACTER_ABILITY_TYPES.map((type) => [
        type,
        skills.filter((skill) => skill.abilityType === type).length,
      ]));
      const archetypeCount = skills.filter((skill) => skill.abilityType === "archetype").length;
      const generalCount = skills.filter((skill) => skill.abilityType === "general").length;
      if (FIXED_CHARACTER_ABILITY_TYPES.some((type) => typeCounts[type] !== 1)
        || archetypeCount !== 3
        || generalCount !== 0) {
        invalid.push(`${selected.id}:invalid-ability-types`);
      }
      for (const skill of skills) {
        if (!sameCombatArchetype(skill.exclusiveTo, selected.id)) invalid.push(`${selected.id}:foreign-skill:${skill.id}`);
        if (!skill.source?.page || !skill.source?.sourceName) invalid.push(`${selected.id}:unsourced-skill:${skill.id}`);
      }
    }
    const stats = selected.baseStats;
    if (!stats || !Number.isInteger(stats.maxHp) || !Number.isInteger(stats.resolveMax)
      || stats.resolveMax <= 0 || !Number.isInteger(stats.attack)
      || !Number.isInteger(stats.defense) || !Number.isInteger(stats.critRate)
      || !Number.isInteger(stats.dodgeRate)) {
      invalid.push(`${selected.id}:invalid-base-stats`);
    }
    for (const itemId of selected.gear) {
      if (!itemTemplate(itemId)) invalid.push(`${selected.id}:unknown-item:${itemId}`);
      if (!getCombatStartItemGrant(itemId)) invalid.push(`${selected.id}:unmapped-power-item:${itemId}`);
    }
  }
  if (STARTING_ARCHETYPES.length !== ARCHETYPE_ROSTER_SIZE) invalid.push("roster:wrong-size");
  return invalid;
}
