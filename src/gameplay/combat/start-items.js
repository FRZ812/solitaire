// Solitaire combat equipment grants used by the level-free character start.
//
// Campaign inventory remains the authority for ownership and equipment. This registry only
// answers what a worn, canonical Solitaire item contributes to a Solitaire combat fight. The
// effective build is derived at the encounter boundary, so removing an item removes its
// trait or fusion as well; no second copy is written into the durable build.

import { itemTemplate } from "../../data/catalog.js";
import {
  PERMANENT_STARTING_KEEPSAKES,
  permanentItemIdForKeepsake,
} from "./keepsakes.js";
import { getSkill } from "./skills.js";
import { getFusion, getTrait, TRAIT_CAPACITY, TRAIT_RANK_CAP } from "./traits.js";
import { weaponAttackSnapshotFromItemIds } from "./weapon-techniques.js";

const EMPTY_STATS = Object.freeze({
  attack: 0,
  defense: 0,
  maxHp: 0,
  resolveMax: 0,
  resolveRegen: 0,
  critRate: 0,
  dodgeRate: 0,
});

function grant(itemId, {
  stats = {},
  traits = {},
  skills = [],
  fusions = [],
  passive,
} = {}) {
  return Object.freeze({
    itemId,
    stats: Object.freeze({ ...EMPTY_STATS, ...stats }),
    traits: Object.freeze({ ...traits }),
    skills: Object.freeze([...skills]),
    fusions: Object.freeze([...fusions]),
    passive,
  });
}

// These are authored starting relic effects, not a second copy of the large legacy item
// passive table. Their names and ownership come from the canonical equipment catalogue;
// only their COMBAT-facing grants live here.
const START_ITEM_GRANTS = Object.freeze(Object.fromEntries([
  // Common starting equipment is deliberately modest but never inert. The authored body
  // remains the majority of a character's chassis; gear supplies the margin that changes
  // whether a risky line survives, and the named relics below carry the stronger traits.
  grant("arming-sword", {
    stats: { attack: 2 },
    passive: "Reliable edge: +2 ATK.",
  }),
  grant("chain-shirt", {
    stats: { defense: 3, maxHp: 6 },
    passive: "Riveted mail: +3 DEF and +6 max HP.",
  }),
  grant("round-shield", {
    stats: { defense: 3, maxHp: 4 },
    traits: { aegis: 1 },
    passive: "The first line holds longer: more defence and an extra rank of Aegis.",
  }),
  grant("traveling-cloak", {
    stats: { maxHp: 2, dodgeRate: 1 },
    passive: "Road-worn composure: +2 max HP and +1% Dodge.",
  }),
  grant("marching-boots", {
    stats: { dodgeRate: 3 },
    passive: "Sure footing: +3% Dodge.",
  }),
  grant("hunting-bow", {
    stats: { attack: 2, critRate: 2 },
    passive: "Measured draw: +2 ATK and +2% Critical.",
  }),
  grant("leather-jerkin", {
    stats: { defense: 2, maxHp: 3, dodgeRate: 2 },
    passive: "Supple protection: +2 DEF, +3 max HP, and +2% Dodge.",
  }),
  grant("light-crossbow", {
    stats: { attack: 3 },
    passive: "Mechanical leverage: +3 ATK.",
  }),
  grant("padded-gambeson", {
    stats: { defense: 2, maxHp: 4 },
    passive: "Layered linen: +2 DEF and +4 max HP.",
  }),
  grant("leather-bracers", {
    stats: { defense: 1, critRate: 1 },
    passive: "Guarded wrists: +1 DEF and +1% Critical.",
  }),
  grant("battle-axe", {
    stats: { attack: 3 },
    passive: "Heavy bite: +3 ATK.",
  }),
  grant("iron-spear", {
    stats: { attack: 2, defense: 1 },
    passive: "Reach controls the line: +2 ATK and +1 DEF.",
  }),
  grant("rangers-leathers", {
    stats: { dodgeRate: 8, critRate: 2 },
    traits: { swift: 1 },
    passive: "Light-footed: greater dodge and a chance to gain Haste through Swift.",
  }),
  grant("twin-daggers", {
    stats: { attack: 2, critRate: 9 },
    traits: { agility: 1 },
    passive: "Two edges hunt openings: increased critical chance and Agility.",
  }),
  grant("quarterstaff", {
    stats: { attack: 1, defense: 2, dodgeRate: 1, resolveMax: 1 },
    passive: "Two-ended discipline: +1 ATK, +2 DEF, +1% Dodge, and +1 max Resolve.",
  }),
  grant("homespun-robe", {
    stats: { defense: 1, maxHp: 2, dodgeRate: 2, resolveMax: 2 },
    passive: "Unencumbered focus: +1 DEF, +2 max HP, +2% Dodge, and +2 max Resolve.",
  }),
  grant("war-hammer", {
    stats: { attack: 3 },
    passive: "Armour-breaking weight: +3 ATK.",
  }),
  grant("iron-longsword", {
    stats: { attack: 3 },
    passive: "Reach and leverage: +3 ATK.",
  }),
  grant("iron-dagger", {
    stats: { attack: 1, critRate: 4 },
    passive: "Close-work point: +1 ATK and +4% Critical.",
  }),
  grant("chain-hauberk", {
    stats: { defense: 5, maxHp: 10 },
    passive: "Full mail harness: +5 DEF and +10 max HP.",
  }),
  grant("iron-helm", {
    stats: { defense: 2, maxHp: 3 },
    passive: "Guarded crown: +2 DEF and +3 max HP.",
  }),
  grant("dawnward-mace", {
    stats: { attack: 4, defense: 2 },
    fusions: ["metalize"],
    passive: "Forged covenant — Metalize begins complete, opening combat in Steelskin.",
  }),
  grant("silver-amulet", {
    stats: { defense: 3, maxHp: 8 },
    traits: { aegis: 2 },
    passive: "Old wards reinforce Protection and the life held behind it.",
  }),
  grant("dragonscale-mail", {
    stats: { defense: 7, maxHp: 12 },
    traits: { ironclad: 2 },
    passive: "Overlapping scale adds Ironclad and a deep reserve of defence.",
  }),
  grant("heater-shield", {
    stats: { defense: 3 },
    traits: { aegis: 1 },
    passive: "Compact cover reinforces Aegis without slowing the hand.",
  }),
  grant("scholars-circlet", {
    stats: { attack: 3, critRate: 5, resolveMax: 3, resolveRegen: 1 },
    traits: { ignition: 2 },
    passive: "A focused mind feeds Ignition, adds +3 max Resolve, and restores +1 Resolve each round.",
  }),
  grant("oak-staff", {
    stats: { attack: 4 },
    traits: { destructor: 1 },
    passive: "The clouded crystal carries Destructor into every cast.",
  }),
  grant("warding-charm", {
    stats: { defense: 2, maxHp: 3 },
    traits: { aegis: 1 },
    passive: "A small, reliable ward adds Aegis before the first spell is spoken.",
  }),
  grant("kingsguard-blade", {
    stats: { attack: 8, defense: 4, critRate: 4 },
    passive: "Perfect balance turns committed defence into a killing line.",
  }),
  grant("dragonbone-bulwark", {
    stats: { defense: 10, maxHp: 12 },
    fusions: ["intangible"],
    passive: "The bulwark bears Intangible, granting a brief opening of invincibility.",
  }),
  grant("nightfang-dagger", {
    stats: { attack: 9, critRate: 15, dodgeRate: 5 },
    fusions: ["rogue"],
    passive: "Nightfang and Hush carry the Rogue fusion: concealment renews as you fight.",
  }),
  grant("phantom-leathers", {
    stats: { defense: 4, dodgeRate: 16 },
    fusions: ["breakdown"],
    passive: "Half a step outside the world, every opening can become Breakdown.",
  }),
  grant("wyrmscale-greatblade", {
    stats: { attack: 22, maxHp: 16, critRate: 8 },
    fusions: ["berserker"],
    passive: "The god-blade wakes Berserker on the opening turn.",
  }),
  grant("aegis-plate", {
    stats: { defense: 22, maxHp: 28 },
    fusions: ["intangible", "metalize"],
    passive: "The unmarked harness opens with Intangible and Metalize already forged.",
  }),
  grant("crown-dominion-helm", {
    stats: { attack: 8, defense: 8, dodgeRate: 6 },
    fusions: ["flash"],
    passive: "Dominion moves before resistance: Flash grants six Priority.",
  }),
  grant("vigil-mantle-cloak", {
    stats: { defense: 10, maxHp: 12, dodgeRate: 6 },
    passive: "The star-set mantle turns aside the blow that should have landed.",
  }),
  grant("heart-world-amulet", {
    stats: { attack: 12, defense: 12, maxHp: 24, critRate: 5 },
    passive: "The kept sun makes its bearer more in every measurable way.",
  }),
  ...PERMANENT_STARTING_KEEPSAKES.map((keepsake) => grant(keepsake.itemId, {
    stats: keepsake.stats,
    traits: keepsake.traits,
    skills: keepsake.skills,
    fusions: keepsake.fusions,
    passive: `Permanent keepsake — ${keepsake.effect}.`,
  })),
].map((entry) => [entry.itemId, entry])));

export function getCombatStartItemGrant(itemId) {
  return typeof itemId === "string" && Object.hasOwn(START_ITEM_GRANTS, itemId)
    ? START_ITEM_GRANTS[itemId]
    : null;
}

export function combatStartItemGrants() {
  return Object.values(START_ITEM_GRANTS);
}

export function wornItemIds(character, codex = {}) {
  const id = character?.id || "wanderer";
  const record = codex?.characters?.[id] || codex?.characters?.wanderer || {};
  return Array.isArray(record.worn) ? record.worn.filter((itemId) => typeof itemId === "string") : [];
}

/** Worn gear plus the one permanent profile keepsake, which owns a dedicated slot. */
export function activeCombatItemIds(character, codex = {}) {
  const id = character?.id || "wanderer";
  const record = codex?.characters?.[id] || codex?.characters?.wanderer || {};
  const keepsakeId = character?.profile?.keepsakeId || record?.profile?.keepsakeId || null;
  const permanentItemId = permanentItemIdForKeepsake(keepsakeId);
  return [...new Set([
    ...wornItemIds(character, codex),
    ...(permanentItemId ? [permanentItemId] : []),
  ])];
}

export function combatItemActorBonuses(itemIds = []) {
  const totals = { ...EMPTY_STATS };
  for (const itemId of new Set(Array.isArray(itemIds) ? itemIds : [])) {
    const definition = getCombatStartItemGrant(itemId);
    if (!definition) continue;
    for (const key of Object.keys(totals)) totals[key] += definition.stats[key] || 0;
  }
  return totals;
}

function skillId(entry) {
  return typeof entry === "string" ? entry : entry?.id;
}

/**
 * Materialize item-granted traits, skills, and already-forged fusions for one encounter.
 * The durable build is never mutated and never stores these grants.
 */
export function effectiveCombatBuild(build = {}, itemIds = [], codex = {}) {
  const traits = { ...(build.traits || {}) };
  const skills = Array.isArray(build.skills) ? build.skills.map((entry) => (
    typeof entry === "string" ? entry : { ...entry }
  )) : [];
  const runes = Array.isArray(build.runes) ? [...build.runes] : [];

  for (const itemId of new Set(Array.isArray(itemIds) ? itemIds : [])) {
    const definition = getCombatStartItemGrant(itemId);
    if (!definition) continue;
    for (const [traitId, ranks] of Object.entries(definition.traits)) {
      if (!getTrait(traitId)) continue;
      traits[traitId] = Math.min(TRAIT_RANK_CAP, (traits[traitId] || 0) + ranks);
    }
    for (const fusionId of definition.fusions) {
      if (getFusion(fusionId)) traits[fusionId] = TRAIT_RANK_CAP;
    }
    for (const grantedSkillId of definition.skills) {
      if (!getSkill(grantedSkillId) || skills.some((entry) => skillId(entry) === grantedSkillId)) continue;
      if (skills.length < 5) skills.push(grantedSkillId);
    }
  }

  if (Object.keys(traits).length > TRAIT_CAPACITY) {
    throw new TypeError("item-grants-exceed-trait-capacity");
  }
  return {
    traits,
    skills,
    runes,
    // A fight snapshots only the active form. The weapon's other possible refinements stay
    // in the item lineage and do not imply that the current attack must be replaced.
    basicAttack: weaponAttackSnapshotFromItemIds(itemIds, codex),
  };
}

/** Inspectable item rows for the character-start UI. */
export function describeCombatItems(itemIds = []) {
  return (Array.isArray(itemIds) ? itemIds : []).map((itemId) => {
    const item = itemTemplate(itemId);
    const grant_ = getCombatStartItemGrant(itemId);
    if (!item) return null;
    return {
      id: itemId,
      name: item.name,
      tier: item.tier || "common",
      passive: grant_?.passive || item.description,
      fusions: grant_?.fusions || [],
    };
  }).filter(Boolean);
}

/** Registry integrity used by tests and startup diagnostics. */
export function invalidCombatStartItemGrants() {
  const invalid = [];
  for (const definition of combatStartItemGrants()) {
    if (!itemTemplate(definition.itemId)) invalid.push(`${definition.itemId}:unknown-item`);
    for (const [traitId, ranks] of Object.entries(definition.traits)) {
      if (!getTrait(traitId) || !Number.isInteger(ranks) || ranks < 1) {
        invalid.push(`${definition.itemId}:invalid-trait:${traitId}`);
      }
    }
    for (const fusionId of definition.fusions) {
      if (!getFusion(fusionId)) invalid.push(`${definition.itemId}:invalid-fusion:${fusionId}`);
    }
    for (const grantedSkillId of definition.skills) {
      if (!getSkill(grantedSkillId)) invalid.push(`${definition.itemId}:invalid-skill:${grantedSkillId}`);
    }
  }
  return invalid;
}
