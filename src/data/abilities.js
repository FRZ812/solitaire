// Combat abilities. Each definition is the COMMON-tier, attribute-0 baseline;
// the combat engine scales by the ability's tier and the wielder's governing
// attribute. Abilities are clickable actions spent from per-fight Stamina, and
// spells additionally drain narrative Resolve (so casters burst then run dry).
//
// scaling:   "weapon" — damage built from the EQUIPPED weapon (martial techniques)
//            "stat"   — damage built from the governing ATTRIBUTE (spells); a
//                       staff/wand only adds a small bonus
//            "none"   — no direct damage (buffs/utility)
// weaponReq: allowed weapon categories (soft — off-type is penalised, not locked)
// statReq:   { attr, base } → required score = base + tier_order * REQ_PER_TIER
//            (soft — under-req scales the ability down, floor 20%)
// damageType: physical (armor), magical (ward), true (ignores both), weapon (uses
//             the weapon's own type), or null.

import { tierMult, tier as tierInfo } from "./tiers.js";
import { UNIQUE_ABILITIES } from "./uniques.js";

export const REQ_PER_TIER = 2;

export const BASIC_ATTACK = {
  id: "basic-attack", name: "Strike", school: "martial", icon: "swords",
  target: "enemy", damageType: "weapon", scaling: "weapon", scaleAttr: "weapon",
  weaponReq: null, statReq: null, dmg: null, pen: 0, critBonus: 0,
  cost: 1, resolveCost: 0, cooldown: 0, effect: null,
  desc: "A measured blow with your equipped weapon.",
};

export const DEFEND = {
  id: "defend", name: "Brace", school: "martial", icon: "shield",
  target: "self", damageType: null, scaling: "none", scaleAttr: "vigor",
  weaponReq: null, statReq: null, dmg: null, pen: 0, critBonus: 0,
  cost: 1, resolveCost: 0, cooldown: 1,
  effect: { type: "guard", value: 4, duration: 1, target: "self" },
  desc: "Plant and guard — raises armour until your next turn.",
};

// Social action with several intents (resolved by the engine, not as damage):
// surrender (demand they yield), demoralize (sap the will to fight), provoke
// (goad a foe into a reckless fight and stop it fleeing). Only works on foes
// that can understand you.
export const TALK = {
  id: "talk", name: "Talk", school: "social", icon: "user",
  target: "all-enemies", damageType: null, scaling: "none", scaleAttr: "presence",
  weaponReq: null, statReq: null, dmg: null, pen: 0, critBonus: 0,
  cost: 1, resolveCost: 0, cooldown: 1, effect: null,
  desc: "Speak to your foes — demand surrender, demoralize them, or provoke them. Only the thinking can be reasoned with.",
};

export const ABILITY_LIBRARY = [
  // ---- Martial (weapon-scaled, Stamina) ----
  { id: "power-strike", name: "Power Strike", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: ["sword", "axe", "mace", "spear"], statReq: { attr: "body", base: 3 }, dmg: [6, 10], pen: 1, critBonus: 5, cost: 2, resolveCost: 0, cooldown: 2, effect: null, desc: "A heavy committed swing. Needs a heavy melee weapon." },
  { id: "rapid-jabs", name: "Rapid Jabs", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: ["sword", "dagger"], statReq: { attr: "reflex", base: 3 }, dmg: [2, 4], pen: 0, critBonus: 10, cost: 2, resolveCost: 0, cooldown: 1, effect: null, hits: 2, desc: "Two quick strikes that each roll for a crit. Light blades." },
  { id: "piercing-thrust", name: "Piercing Thrust", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: ["sword", "spear", "dagger"], statReq: { attr: "reflex", base: 4 }, dmg: [4, 6], pen: 6, critBonus: 0, cost: 2, resolveCost: 0, cooldown: 2, effect: null, desc: "A precise thrust that bites through armour. Point weapons." },
  { id: "cleave", name: "Cleave", school: "martial", icon: "swords", target: "all-enemies", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: ["sword", "axe", "mace", "spear"], statReq: { attr: "body", base: 4 }, dmg: [3, 6], pen: 0, critBonus: 0, cost: 3, resolveCost: 0, cooldown: 3, effect: null, desc: "A wide arc that strikes every foe. Heavy melee." },
  { id: "rend", name: "Rend", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: ["sword", "axe", "dagger"], statReq: { attr: "body", base: 3 }, dmg: [2, 4], pen: 0, critBonus: 0, cost: 2, resolveCost: 0, cooldown: 2, effect: { type: "bleed", value: 3, duration: 3, target: "enemy" }, desc: "Tears a wound that bleeds for several turns. Edged weapons." },
  { id: "execute", name: "Execute", school: "martial", icon: "swords", target: "enemy", damageType: "true", scaling: "weapon", scaleAttr: "body", weaponReq: ["sword", "axe", "mace", "spear", "dagger"], statReq: { attr: "body", base: 5 }, dmg: [8, 12], pen: 0, critBonus: 15, cost: 4, resolveCost: 0, cooldown: 4, effect: null, desc: "A killing blow that bypasses all defence. Any melee weapon." },
  { id: "venom-strike", name: "Venom Strike", school: "shadow", icon: "droplet", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: ["dagger", "sword"], statReq: { attr: "reflex", base: 3 }, dmg: [1, 3], pen: 2, critBonus: 0, cost: 2, resolveCost: 0, cooldown: 2, effect: { type: "poison", value: 4, duration: 4, target: "enemy" }, desc: "A coated edge leaving a regen-blocking poison. Light blades." },
  // ---- Utility / self (Stamina) ----
  { id: "rallying-shout", name: "Rallying Shout", school: "martial", icon: "flame", target: "self", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 2 }, dmg: null, pen: 0, critBonus: 0, cost: 2, resolveCost: 0, cooldown: 4, effect: { type: "rally", value: 30, duration: 3, target: "self" }, desc: "Steel yourself — outgoing damage rises for several turns." },
  { id: "second-wind", name: "Second Wind", school: "survival", icon: "heart", target: "self", damageType: null, scaling: "none", scaleAttr: "vigor", weaponReq: null, statReq: { attr: "vigor", base: 2 }, dmg: null, pen: 0, critBonus: 0, cost: 2, resolveCost: 0, cooldown: 4, effect: { type: "regen", value: 5, duration: 3, target: "self" }, desc: "Catch your breath and knit minor wounds over a few turns." },
  { id: "shadowstep", name: "Shadowstep", school: "shadow", icon: "moon", target: "self", damageType: null, scaling: "none", scaleAttr: "reflex", weaponReq: null, statReq: { attr: "reflex", base: 4 }, dmg: null, pen: 0, critBonus: 0, cost: 2, resolveCost: 0, cooldown: 3, effect: { type: "focus", value: 40, duration: 1, target: "self" }, desc: "Slip aside and find an opening — your next strike crits far more often." },
  // ---- Defensive / tempo (self, Stamina) — shields, ward, invuln, extra action ----
  { id: "bulwark-stance", name: "Bulwark Stance", school: "martial", icon: "shield", target: "self", damageType: null, scaling: "none", scaleAttr: "body", weaponReq: null, statReq: { attr: "body", base: 3 }, dmg: null, pen: 0, critBonus: 0, cost: 2, resolveCost: 0, cooldown: 3, effect: { type: "shield", value: 12, target: "self" }, desc: "Set yourself behind your guard — raises a shield that soaks the next blows." },
  { id: "mana-shield", name: "Mana Shield", school: "arcane", icon: "sparkle", target: "self", damageType: null, scaling: "none", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 3 }, dmg: null, pen: 0, critBonus: 0, cost: 1, resolveCost: 1, cooldown: 3, effect: { type: "magicShield", value: 12, target: "self" }, desc: "Weave a ward that absorbs incoming magic before it bites." },
  { id: "sanctuary", name: "Sanctuary", school: "divine", icon: "shield", target: "self", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 5 }, dmg: null, pen: 0, critBonus: 0, cost: 4, resolveCost: 2, cooldown: 5, effect: { type: "invuln", duration: 2, target: "self" }, desc: "Call down a brief, untouchable grace — ignore all damage for a couple of turns." },
  { id: "haste", name: "Haste", school: "arcane", icon: "sparkle", target: "self", damageType: null, scaling: "none", scaleAttr: "reflex", weaponReq: null, statReq: { attr: "reflex", base: 4 }, dmg: null, pen: 0, critBonus: 0, cost: 1, resolveCost: 1, cooldown: 4, effect: { type: "bonusAction", value: 1, target: "self" }, desc: "Quicken — gain an extra action this turn to spend as you like." },
  // ---- Status spells (control / DoT) ----
  { id: "combust", name: "Combust", school: "arcane", icon: "flame", target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 3 }, dmg: [3, 5], pen: 1, critBonus: 0, cost: 2, resolveCost: 1, cooldown: 2, effect: { type: "burn", value: 4, duration: 3, target: "enemy" }, desc: "Wreathe a foe in flame that keeps burning for several turns." },
  { id: "frost-nova", name: "Frost Nova", school: "arcane", icon: "droplet", target: "all-enemies", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: [2, 4], pen: 0, critBonus: 0, cost: 2, resolveCost: 2, cooldown: 3, effect: { type: "chill", value: 4, duration: 2, target: "enemy" }, desc: "A burst of cold that chills every foe, fouling their aim." },
  { id: "curse", name: "Curse", school: "shadow", icon: "moon", target: "enemy", damageType: null, scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: null, pen: 0, critBonus: 0, cost: 1, resolveCost: 1, cooldown: 3, effect: { type: "curse", value: 25, duration: 3, target: "enemy" }, desc: "Lay a curse that makes a foe suffer far more from every wound." },
  // ---- Arcane / divine (stat-scaled, drains Resolve) ----
  { id: "firebolt", name: "Firebolt", school: "arcane", icon: "flame", target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 3 }, dmg: [5, 9], pen: 2, critBonus: 0, cost: 1, resolveCost: 1, cooldown: 1, effect: null, desc: "A bolt of conjured fire — reduced by ward, not armour." },
  { id: "frost-lance", name: "Frost Lance", school: "arcane", icon: "droplet", target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: [4, 7], pen: 0, critBonus: 0, cost: 1, resolveCost: 1, cooldown: 2, effect: { type: "weaken", value: 25, duration: 2, target: "enemy" }, desc: "A lance of cold that slows the target's blows." },
  { id: "chain-lightning", name: "Chain Lightning", school: "arcane", icon: "sparkle", target: "all-enemies", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 5 }, dmg: [4, 7], pen: 4, critBonus: 0, cost: 2, resolveCost: 2, cooldown: 3, effect: null, desc: "Arcing current that leaps to every foe, biting through ward." },
  { id: "hex", name: "Hex", school: "arcane", icon: "sparkle", target: "enemy", damageType: null, scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: null, pen: 0, critBonus: 0, cost: 1, resolveCost: 1, cooldown: 3, effect: { type: "vulnerable", value: 30, duration: 3, target: "enemy" }, desc: "A curse that makes the target take far more damage." },
  { id: "smite", name: "Smite", school: "divine", icon: "sparkle", target: "enemy", damageType: "true", scaling: "stat", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 4 }, dmg: [4, 6], pen: 0, critBonus: 10, cost: 2, resolveCost: 2, cooldown: 3, effect: { type: "stun", value: 1, duration: 1, target: "enemy" }, desc: "Searing judgement that ignores defences and may stun." },
];

const LIBRARY_BY_ID = Object.fromEntries(ABILITY_LIBRARY.map((a) => [a.id, a]));
const UNIQUE_BY_ID = Object.fromEntries(UNIQUE_ABILITIES.map((a) => [a.id, a]));
// Unique abilities resolve like any other (once learned), but are NOT in the
// random drop pool — they only come from their authored sources (data/uniques.js).
const ALL_BY_ID = { ...LIBRARY_BY_ID, ...UNIQUE_BY_ID, [BASIC_ATTACK.id]: BASIC_ATTACK, [DEFEND.id]: DEFEND, [TALK.id]: TALK };

export function getAbilityDef(id) { return ALL_BY_ID[id] || null; }

// How much an attribute score amplifies an ability: each point adds 8%.
export function attrFactor(score) { return 1 + Math.max(0, score || 0) * 0.08; }

export function scaleByTier(base, tierId) { return Math.round(base * tierMult(tierId)); }

// Scaling style, with a sane fallback for defs that omit it (e.g. uniques).
export function abilityScaling(def) {
  if (def.scaling) return def.scaling;
  if (def.damageType === "magical") return "stat";
  if (def.damageType === "weapon") return "weapon";
  if (!def.dmg) return "none";
  return def.scaleAttr === "mind" || def.scaleAttr === "presence" ? "stat" : "weapon";
}

// Required attribute value for an ability at a given tier (base + tier ramp).
export function abilityRequiredStat(def, tierId) {
  if (!def.statReq) return null;
  return { attr: def.statReq.attr, value: def.statReq.base + tierInfo(tierId).order * REQ_PER_TIER };
}

export function resolveLearned(entry) {
  const id = typeof entry === "string" ? entry : entry?.id;
  const tierId = (typeof entry === "object" && entry?.tier) || "common";
  const def = getAbilityDef(id);
  return def ? { def, tier: tierId } : null;
}

// Random LIBRARY ability id (never a unique), optionally filtered by school.
export function randomAbilityId(schools = null) {
  const pool = schools ? ABILITY_LIBRARY.filter((a) => schools.includes(a.school)) : ABILITY_LIBRARY;
  if (pool.length === 0) return ABILITY_LIBRARY[0].id;
  return pool[Math.floor(Math.random() * pool.length)].id;
}
