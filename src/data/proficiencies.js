// Use-based proficiencies — the non-loot progression pillar. You get better at
// what you DO: every combat action trains a proficiency, and a proficiency's XP
// feeds the ATTRIBUTE it's governed by. Attributes can ONLY grow this way (by
// grinding their proficiencies); there is no level system and no free attribute
// gifts. Proficiencies also give a small direct bonus in their own domain
// (weapon accuracy/damage, ambush odds, dodge, spell power, etc.).
//
// Stored on the character as { proficiencies: { [id]: xp } }.

import { ATTR_KEYS } from "../config.js";

export const PROFICIENCIES = [
  // Weapon masteries (one per category) — feed Reflex (finesse) or Body (force).
  { id: "mastery-sword",   name: "Swordsmanship",  attr: "reflex", domain: "weapon", category: "sword" },
  { id: "mastery-dagger",  name: "Knife-Fighting", attr: "reflex", domain: "weapon", category: "dagger" },
  { id: "mastery-bow",     name: "Archery",        attr: "reflex", domain: "weapon", category: "bow" },
  { id: "mastery-axe",     name: "Axe-Craft",      attr: "body",   domain: "weapon", category: "axe" },
  { id: "mastery-mace",    name: "Bludgeon",       attr: "body",   domain: "weapon", category: "mace" },
  { id: "mastery-spear",   name: "Spearcraft",     attr: "body",   domain: "weapon", category: "spear" },
  { id: "mastery-unarmed", name: "Brawling",       attr: "body",   domain: "weapon", category: "unarmed" },
  { id: "ambush",          name: "Ambush",         attr: "reflex", domain: "ambush" },
  { id: "evasion",         name: "Evasion",        attr: "reflex", domain: "evasion" },
  { id: "awareness",       name: "Awareness",      attr: "wit",    domain: "awareness" },
  { id: "spellcasting",    name: "Spellcasting",   attr: "mind",   domain: "spellcasting" },
  { id: "endurance",       name: "Endurance",      attr: "vigor",  domain: "endurance" },
  { id: "command",         name: "Command",        attr: "presence", domain: "command" },
];

const BY_ID = Object.fromEntries(PROFICIENCIES.map((p) => [p.id, p]));
export function proficiencyDef(id) { return BY_ID[id] || null; }
export function proficiencyName(id) { return BY_ID[id]?.name || id; }

const CAT_TO_MASTERY = Object.fromEntries(PROFICIENCIES.filter((p) => p.domain === "weapon").map((p) => [p.category, p.id]));
export function weaponMasteryId(category) { return CAT_TO_MASTERY[category] || "mastery-unarmed"; }

// Proficiencies feeding each attribute.
export const PROFS_BY_ATTR = {};
for (const k of ATTR_KEYS) PROFS_BY_ATTR[k] = PROFICIENCIES.filter((p) => p.attr === k).map((p) => p.id);

// Curves. Rating climbs with the square root of XP, so each level costs more:
//   rating: xp 6→1, 24→2, 54→3, 96→4, 150→5, 216→6 …
// Attribute growth from the SUM of its proficiencies' XP, much slower:
//   +1 at 40 total, +2 at 160, +3 at 360, +4 at 640 …
export function ratingFromXp(xp) { return Math.floor(Math.sqrt(Math.max(0, xp || 0) / 6)); }
export function attributeGrowth(sumXp) { return Math.floor(Math.sqrt(Math.max(0, sumXp || 0) / 40)); }

export function proficiencyRating(character, id) {
  return ratingFromXp(character?.proficiencies?.[id] || 0);
}

// Effective attribute = base (creation) + growth earned by grinding its profs.
export function effectiveAttributes(character) {
  const base = character?.attributes || {};
  const prof = character?.proficiencies || {};
  const out = {};
  for (const k of ATTR_KEYS) {
    let sum = 0;
    for (const id of (PROFS_BY_ATTR[k] || [])) sum += prof[id] || 0;
    out[k] = Math.min(30, (base[k] || 0) + attributeGrowth(sum));
  }
  return out;
}

// XP awarded per action (kept small so growth is earned over many fights).
export const XP = {
  WEAPON_HIT: 2,
  SPELL_CAST: 3,
  AMBUSH_TRY: 2,
  AMBUSH_WIN: 5,
  AWARENESS: 4,
  EVASION: 1,
  ENDURANCE: 1,
  COMMAND: 3,
};
