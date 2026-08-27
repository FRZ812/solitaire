// Frozen verifier-only Tower v1.3 semantics from deployed commit 1dd86f8.
// Never route playable/current combat through this module.
// Combat abilities. Each definition is the COMMON-tier, attribute-0 baseline;
// the combat engine scales by the ability's tier and the wielder's governing
// attribute. There is NO stamina: abilities cost ACTION POINTS (actionCost,
// default 1) and are gated by cooldown; spells additionally drain narrative
// Resolve (resolveCost). So a martial technique is limited by the action economy
// + its cooldown, a spell by Resolve (casters burst, then run dry). Performance
// is an explicitly non-spell discipline: audible Bard techniques build and
// spend Cadence without touching Resolve or a casting tradition. Fieldcraft is
// likewise distinct: practical Ranger tracking, terrain, projectiles, and
// trained-animal coordination build and spend target-bound Quarry Insight.
// Rogue subterfuge creates and exploits source-specific Opportunity Windows.
// Paladin oathcraft earns Conviction by actually guarding others or absorbing a
// real hit, then commits it to bounded protection, judgment, and mercy.
// Druid primalcraft is Resolve-powered spellcasting with its own seasonal
// cadence, separate from arcane schools, divine prayers, and pact workings.
// Warlock pactcraft pays explicit reversible prices to earn Pact Favor, then
// commits that Favor to narrow covenant workings without metamagic or spellbooks.
// Artificer devicecraft spends a prepared five-Charge reserve on fabricated
// physical works and uses Field Refit for bounded replenishment without spells.
//
// scaling:   "weapon" — damage built from the EQUIPPED weapon (martial techniques)
//            "stat"   — damage built from the governing ATTRIBUTE (spells); a
//                       staff/wand only adds a small bonus
//            "fieldcraft" — physical force supplied by a trap or present beast
//            "none"   — no direct damage (buffs/utility)
// weaponReq: allowed weapon categories (soft — off-type is penalised, not locked)
// statReq:   { attr, base } → required score = base + tier_order * REQ_PER_TIER
//            (soft — under-req scales the ability down, floor 20%)
// damageType: physical (armor), magical (ward), sonic (audible performance),
//             true (ignores both), weapon (uses the weapon's own type), or null.

import { tierMult, tier as tierInfo } from "./tiers.js";
import { mechanicalAttributeValue } from "./attribute-tiers-v13.js";
import { UNIQUE_ABILITIES } from "./uniques.js";
import { TRAVEL_SPELLS } from "./travel-spells.js";
import { BUFF_SPELLS } from "./buff-spells.js";

export const REQ_PER_TIER = 2;

export const BASIC_ATTACK = {
  id: "basic-attack", name: "Strike", school: "martial", icon: "swords",
  target: "enemy", damageType: "weapon", scaling: "weapon", scaleAttr: "weapon",
  weaponReq: null, statReq: null, dmg: null, pen: 0, critBonus: 0,
  resolveCost: 0, cooldown: 0, effect: null,
  desc: "A measured blow with your equipped weapon.",
};

export const DEFEND = {
  id: "defend", name: "Brace", school: "martial", icon: "shield",
  target: "self", damageType: null, scaling: "none", scaleAttr: "vigor",
  weaponReq: null, statReq: null, dmg: null, pen: 0, critBonus: 0,
  resolveCost: 0, cooldown: 1,
  effect: { type: "block", value: 7, duration: 1, target: "self" },
  desc: "Plant your feet and gain 7 Block until your next turn.",
};

// Social action with several intents (resolved by the engine, not as damage):
// surrender (demand they yield), demoralize (sap the will to fight), provoke
// (goad a foe into a reckless fight and stop it fleeing). Only works on foes
// that can understand you.
export const TALK = {
  id: "talk", name: "Talk", school: "social", icon: "user",
  target: "all-enemies", damageType: null, scaling: "none", scaleAttr: "presence",
  weaponReq: null, statReq: null, dmg: null, pen: 0, critBonus: 0,
  resolveCost: 0, cooldown: 1, effect: null,
  desc: "Speak to your foes — demand surrender, demoralize them, or provoke them. Only the thinking can be reasoned with.",
};

const WARRIOR_WEAPONS = Object.freeze(["sword", "axe", "mace", "spear", "dagger", "bow", "crossbow"]);
const WARRIOR_MELEE_WEAPONS = Object.freeze(["sword", "axe", "mace", "spear", "dagger"]);
const WARRIOR_HEAVY_WEAPONS = Object.freeze(["sword", "axe", "mace", "spear"]);
const warriorIdentity = Object.freeze({ professionId: "fighter", progressionExclusive: true });
const MONK_UNARMED = Object.freeze(["unarmed"]);
// Quarterstaves use the physical spear family in combat data. The literal
// `staff` category remains accepted for authored NPCs that distinguish it.
const MONK_STAFF_ARMS = Object.freeze(["staff", "spear"]);
const MONK_TEMPLE_ARMS = Object.freeze(["staff", "spear", "sword"]);
const monkIdentity = Object.freeze({ professionId: "monk", progressionExclusive: true });
const BARBARIAN_WEAPONS = Object.freeze(["axe", "mace", "sword", "spear", "unarmed"]);
const BARBARIAN_ARMOR = Object.freeze(["none", "light", "heavy"]);
const barbarianIdentity = Object.freeze({ professionId: "barbarian", progressionExclusive: true, armorReq: BARBARIAN_ARMOR });
const bardIdentity = Object.freeze({
  professionId: "bard",
  progressionExclusive: true,
  school: "performance",
  resolveCost: 0,
  audible: true,
  bardCadenceMax: 4,
});
const RANGER_RANGED_WEAPONS = Object.freeze(["bow", "crossbow"]);
const rangerIdentity = Object.freeze({
  professionId: "ranger",
  progressionExclusive: true,
  school: "fieldcraft",
  resolveCost: 0,
  rangerQuarryInsightMax: 5,
});
const ROGUE_WEAPONS = Object.freeze(["dagger", "sword", "bow", "crossbow"]);
const ROGUE_CLOSE_WEAPONS = Object.freeze(["dagger", "sword"]);
const ROGUE_SAP_WEAPONS = Object.freeze(["unarmed", "mace", "dagger", "sword"]);
const rogueIdentity = Object.freeze({
  professionId: "rogue",
  progressionExclusive: true,
  school: "subterfuge",
  resolveCost: 0,
});
const PALADIN_WEAPONS = Object.freeze(["sword", "axe", "mace", "spear"]);
const paladinIdentity = Object.freeze({
  professionId: "paladin",
  progressionExclusive: true,
  school: "oathcraft",
  resolveCost: 0,
  paladinConvictionMax: 5,
});
const druidIdentity = Object.freeze({
  professionId: "druid",
  progressionExclusive: true,
  school: "primalcraft",
});
const DRUID_DAMAGE_SURGE = Object.freeze({ bonus: 0.20, cap: 0.25, appliesTo: "damage" });
const DRUID_EFFECT_SURGE = Object.freeze({ bonus: 0.20, cap: 0.25, appliesTo: "effect" });
const DRUID_MIXED_SURGE = Object.freeze({ bonus: 0.20, cap: 0.25, appliesTo: "damage-and-effect" });
const warlockIdentity = Object.freeze({
  professionId: "warlock",
  progressionExclusive: true,
  school: "pactcraft",
  warlockFavorMax: 5,
});
const artificerIdentity = Object.freeze({
  professionId: "artificer",
  progressionExclusive: true,
  school: "devicecraft",
  resolveCost: 0,
  artificerDeviceChargeMax: 5,
});
const WARLOCK_EXPOSURE_PRICE_15 = Object.freeze({ type: "exposure", incomingDamage: 0.15, cap: 0.20, duration: 2 });
const WARLOCK_EXPOSURE_PRICE_20 = Object.freeze({ type: "exposure", incomingDamage: 0.20, cap: 0.20, duration: 2 });

export const ABILITY_LIBRARY = [
  // ---- Martial (weapon-scaled; gated by action points + cooldown) ----
  { id: "power-strike", name: "Power Strike", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: ["sword", "axe", "mace", "spear"], statReq: { attr: "body", base: 3 }, dmg: [6, 10], pen: 1, critBonus: 5, resolveCost: 0, cooldown: 2, effect: null, desc: "A heavy committed swing. Needs a heavy melee weapon." },
  { id: "rapid-jabs", name: "Rapid Jabs", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: ["sword", "dagger"], statReq: { attr: "reflex", base: 3 }, dmg: [2, 4], pen: 0, critBonus: 10, resolveCost: 0, cooldown: 1, effect: null, hits: 2, desc: "Two quick strikes that each roll for a crit. Light blades." },
  { id: "piercing-thrust", name: "Piercing Thrust", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: ["sword", "spear", "dagger"], statReq: { attr: "reflex", base: 4 }, dmg: [4, 6], pen: 6, critBonus: 0, resolveCost: 0, cooldown: 2, effect: null, desc: "A precise thrust that bites through armour. Point weapons." },
  { id: "cleave", name: "Cleave", school: "martial", icon: "swords", target: "all-enemies", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: ["sword", "axe", "mace", "spear"], statReq: { attr: "body", base: 4 }, dmg: [3, 6], pen: 0, critBonus: 0, resolveCost: 0, cooldown: 3, effect: null, desc: "A wide arc that strikes every foe. Heavy melee." },
  { id: "rend", name: "Rend", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: ["sword", "axe", "dagger"], statReq: { attr: "body", base: 3 }, dmg: [2, 4], pen: 0, critBonus: 0, resolveCost: 0, cooldown: 2, effect: { type: "bleed", value: 3, duration: 3, target: "enemy" }, desc: "Tears a wound that bleeds for several turns. Edged weapons." },
  { id: "execute", name: "Execute", school: "martial", icon: "swords", target: "enemy", damageType: "true", scaling: "weapon", scaleAttr: "body", weaponReq: ["sword", "axe", "mace", "spear", "dagger"], statReq: { attr: "body", base: 5 }, dmg: [8, 12], pen: 0, critBonus: 15, resolveCost: 0, cooldown: 4, effect: null, desc: "A killing blow that bypasses all defence. Any melee weapon." },
  { id: "venom-strike", name: "Venom Strike", school: "shadow", icon: "droplet", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: ["dagger", "sword"], statReq: { attr: "reflex", base: 3 }, dmg: [1, 3], pen: 2, critBonus: 0, resolveCost: 0, cooldown: 2, effect: { type: "poison", value: 4, duration: 4, target: "enemy" }, desc: "A coated edge leaving a regen-blocking poison. Light blades." },
  // ---- Ranged techniques (bow/crossbow, Reflex) — strike from distance ----
  { id: "aimed-shot", name: "Aimed Shot", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: ["bow", "crossbow"], statReq: { attr: "reflex", base: 3 }, dmg: [4, 7], pen: 4, critBonus: 12, resolveCost: 0, cooldown: 2, effect: null, desc: "A patient, armour-seeking shot. Bows & crossbows." },
  { id: "twin-shot", name: "Twin Shot", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: ["bow"], statReq: { attr: "reflex", base: 4 }, dmg: [2, 4], pen: 0, critBonus: 6, resolveCost: 0, cooldown: 1, effect: null, hits: 2, desc: "Two arrows on the string, loosed as one. Bows." },
  { id: "hamstring-shot", name: "Hamstring Shot", school: "martial", icon: "droplet", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: ["bow", "crossbow"], statReq: { attr: "reflex", base: 3 }, dmg: [2, 4], pen: 1, critBonus: 0, resolveCost: 0, cooldown: 2, effect: { type: "weaken", value: 20, duration: 2, target: "enemy" }, desc: "A crippling shot to the leg — saps a foe's strength. Ranged." },
  // ---- Utility / self (action points) ----
  { id: "rallying-shout", name: "Rallying Shout", school: "martial", icon: "flame", target: "self", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 2 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 4, effect: { type: "rally", value: 30, duration: 3, target: "self" }, desc: "Steel yourself — outgoing damage rises for several turns." },
  { id: "second-wind", name: "Second Wind", school: "survival", icon: "heart", target: "self", damageType: null, scaling: "none", scaleAttr: "vigor", weaponReq: null, statReq: { attr: "vigor", base: 2 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 4, effect: { type: "regen", value: 5, duration: 3, target: "self" }, desc: "Catch your breath and knit minor wounds over a few turns." },
  { id: "shadowstep", name: "Shadowstep", school: "shadow", icon: "moon", target: "self", damageType: null, scaling: "none", scaleAttr: "reflex", weaponReq: null, statReq: { attr: "reflex", base: 4 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 3, effect: { type: "focus", value: 40, duration: 1, target: "self" }, desc: "Slip aside and find an opening — your next strike crits far more often." },
  // ---- Defensive / tempo (self) — shields, ward, invuln, extra action ----
  { id: "bulwark-stance", name: "Bulwark Stance", school: "martial", icon: "shield", target: "self", damageType: null, scaling: "none", scaleAttr: "body", weaponReq: null, statReq: { attr: "body", base: 3 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 3, effect: { type: "shield", value: 12, target: "self" }, desc: "Set yourself behind your guard — raises a shield that soaks the next blows." },
  { id: "mana-shield", name: "Mana Shield", school: "arcane", icon: "sparkle", target: "self", damageType: null, scaling: "none", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 3 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 1, cooldown: 3, effect: { type: "magicShield", value: 12, target: "self" }, desc: "Weave a ward that absorbs incoming magic before it bites." },
  { id: "sanctuary", name: "Sanctuary", school: "divine", icon: "shield", target: "self", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 5 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 2, cooldown: 5, effect: { type: "invuln", duration: 2, target: "self" }, desc: "Call down a brief, untouchable grace — ignore all damage for a couple of turns." },
  { id: "haste", name: "Haste", school: "arcane", icon: "sparkle", target: "self", damageType: null, scaling: "none", scaleAttr: "reflex", weaponReq: null, statReq: { attr: "reflex", base: 4 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 1, cooldown: 4, effect: { type: "bonusAction", value: 1, target: "self" }, desc: "Quicken — gain an extra action this turn to spend as you like." },
  // ---- Status spells (control / DoT) ----
  { id: "combust", name: "Combust", school: "arcane", icon: "flame", target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 3 }, dmg: [3, 5], pen: 1, critBonus: 0, resolveCost: 1, cooldown: 2, effect: { type: "burn", value: 4, duration: 3, target: "enemy" }, desc: "Wreathe a foe in flame that keeps burning for several turns." },
  { id: "frost-nova", name: "Frost Nova", school: "arcane", icon: "droplet", target: "all-enemies", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: [2, 4], pen: 0, critBonus: 0, resolveCost: 2, cooldown: 3, effect: { type: "chill", value: 4, duration: 2, target: "enemy" }, desc: "A burst of cold that chills every foe, fouling their aim." },
  { id: "curse", name: "Curse", school: "shadow", icon: "moon", target: "enemy", damageType: null, scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 1, cooldown: 3, effect: { type: "curse", value: 25, duration: 3, target: "enemy" }, desc: "Lay a wasting curse: the foe takes far more from every wound AND their hurts knit half as fast — sustain and regen falter while it holds." },
  // ---- Arcane / divine (stat-scaled, drains Resolve) ----
  { id: "firebolt", name: "Firebolt", school: "arcane", icon: "flame", target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 3 }, dmg: [5, 9], pen: 2, critBonus: 0, resolveCost: 1, cooldown: 1, effect: null, desc: "A bolt of conjured fire — reduced by ward, not armour." },
  { id: "frost-lance", name: "Frost Lance", school: "arcane", icon: "droplet", target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: [4, 7], pen: 0, critBonus: 0, resolveCost: 1, cooldown: 2, effect: { type: "weaken", value: 25, duration: 2, target: "enemy" }, desc: "A lance of cold that slows the target's blows." },
  { id: "chain-lightning", name: "Chain Lightning", school: "arcane", icon: "sparkle", target: "all-enemies", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 5 }, dmg: [4, 7], pen: 4, critBonus: 0, resolveCost: 2, cooldown: 3, effect: null, desc: "Arcing current that leaps to every foe, biting through ward." },
  { id: "hex", name: "Hex", school: "arcane", icon: "sparkle", target: "enemy", damageType: null, scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 1, cooldown: 3, effect: { type: "vulnerable", value: 30, duration: 3, target: "enemy" }, desc: "Pry open a single foe's defences — they take far more damage from every source for a few turns." },
  { id: "smite", name: "Smite", school: "divine", icon: "sparkle", target: "enemy", damageType: "true", scaling: "stat", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 4 }, dmg: [4, 6], pen: 0, critBonus: 10, resolveCost: 2, cooldown: 3, effect: { type: "stun", value: 1, duration: 1, target: "enemy" }, desc: "Searing judgement that ignores defences and may stun." },

  // ============================================================
  // EXPANDED POOL — a broader spread of techniques and spells so a
  // starting kit (and in-play teaching/loot) draws from variety, not
  // a handful. Same schema + scaling rules as above; the engine owns
  // the numbers. Grouped by school.
  // ============================================================
  // ---- Martial (weapon-scaled techniques) ----
  { id: "shield-bash", name: "Shield Bash", school: "martial", icon: "shield", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: null, statReq: { attr: "body", base: 3 }, dmg: [2, 4], pen: 0, critBonus: 0, resolveCost: 0, cooldown: 3, effect: { type: "stun", value: 1, duration: 1, target: "enemy" }, desc: "Slam a foe with shield or shoulder — a stunning check that buys a breath." },
  { id: "concussive-blow", name: "Concussive Blow", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: ["mace", "axe"], statReq: { attr: "body", base: 4 }, dmg: [4, 7], pen: 2, critBonus: 0, resolveCost: 0, cooldown: 3, effect: { type: "stun", value: 1, duration: 1, target: "enemy" }, desc: "A skull-ringing smash with a heavy weapon that can daze. Maces & axes." },
  { id: "disarming-strike", name: "Disarming Strike", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: ["sword", "spear", "dagger"], statReq: { attr: "reflex", base: 3 }, dmg: [2, 4], pen: 0, critBonus: 0, resolveCost: 0, cooldown: 3, effect: { type: "weaken", value: 25, duration: 2, target: "enemy" }, desc: "Bind and twist the foe's guard — their blows land softer for a time. Finesse arms." },
  { id: "feint", name: "Feint", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: ["sword", "dagger"], statReq: { attr: "reflex", base: 3 }, dmg: [1, 3], pen: 0, critBonus: 0, resolveCost: 0, cooldown: 2, effect: { type: "vulnerable", value: 25, duration: 2, target: "enemy" }, desc: "A false opening that draws a foe out of position, leaving them exposed. Light blades." },
  { id: "whirlwind", name: "Whirlwind", school: "martial", icon: "swords", target: "all-enemies", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: ["sword", "dagger", "axe"], statReq: { attr: "reflex", base: 4 }, dmg: [2, 5], pen: 0, critBonus: 0, resolveCost: 0, cooldown: 3, effect: null, desc: "Spin through every foe within reach — fast, light blades." },
  { id: "lunge", name: "Lunge", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: ["spear", "sword"], statReq: { attr: "reflex", base: 4 }, dmg: [4, 7], pen: 3, critBonus: 5, resolveCost: 0, cooldown: 2, effect: null, desc: "A long committed thrust that closes the gap and bites deep. Point weapons." },
  // ---- Ranged techniques ----
  { id: "piercing-shot", name: "Piercing Shot", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: ["bow", "crossbow"], statReq: { attr: "reflex", base: 4 }, dmg: [4, 7], pen: 6, critBonus: 0, resolveCost: 0, cooldown: 2, effect: null, desc: "A heavy shaft driven clean through armour. Bows & crossbows." },
  { id: "arrow-volley", name: "Arrow Volley", school: "martial", icon: "swords", target: "all-enemies", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: ["bow"], statReq: { attr: "reflex", base: 4 }, dmg: [2, 4], pen: 0, critBonus: 0, resolveCost: 0, cooldown: 3, effect: null, desc: "Loose a rain of arrows across the field. Bows." },
  { id: "pinning-shot", name: "Pinning Shot", school: "martial", icon: "droplet", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: ["bow", "crossbow"], statReq: { attr: "reflex", base: 3 }, dmg: [2, 4], pen: 1, critBonus: 0, resolveCost: 0, cooldown: 3, effect: { type: "stun", value: 1, duration: 1, target: "enemy" }, desc: "A shot that nails a foe in place for a moment. Ranged." },
  // ---- Survival / self ----
  { id: "snare", name: "Snare", school: "survival", icon: "moon", target: "enemy", damageType: null, scaling: "none", scaleAttr: "wit", weaponReq: null, statReq: { attr: "wit", base: 3 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 3, effect: { type: "stun", value: 1, duration: 1, target: "enemy" }, desc: "A thrown net, a tripline, or grasping roots — a foe is caught fast for a beat." },
  { id: "battle-focus", name: "Battle Focus", school: "survival", icon: "sparkle", target: "self", damageType: null, scaling: "none", scaleAttr: "reflex", weaponReq: null, statReq: { attr: "reflex", base: 3 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 3, effect: { type: "focus", value: 40, duration: 1, target: "self" }, desc: "Steady your breath and pick the opening — your next strike crits far more often." },
  // ---- Shadow ----
  { id: "shadow-bolt", name: "Shadow Bolt", school: "shadow", icon: "moon", target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 3 }, dmg: [5, 9], pen: 2, critBonus: 0, resolveCost: 1, cooldown: 1, effect: null, desc: "A bolt of clotted darkness — reduced by ward, not armour." },
  { id: "enfeeble", name: "Enfeeble", school: "shadow", icon: "moon", target: "enemy", damageType: null, scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 1, cooldown: 3, effect: { type: "weaken", value: 30, duration: 3, target: "enemy" }, desc: "Sap the strength from a foe's limbs — their blows grow feeble." },
  { id: "terrify", name: "Terrify", school: "shadow", icon: "moon", target: "all-enemies", damageType: null, scaling: "stat", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 3 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 2, cooldown: 4, effect: { type: "weaken", value: 20, duration: 2, target: "enemy" }, desc: "Loose a wave of dread — every foe falters, their blows weakened." },
  { id: "wither", name: "Wither", school: "shadow", icon: "droplet", target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 3 }, dmg: [2, 4], pen: 1, critBonus: 0, resolveCost: 1, cooldown: 2, effect: { type: "poison", value: 4, duration: 4, target: "enemy" }, desc: "Creeping rot eats at a wound — a lingering, regen-blocking decay." },
  // ---- Arcane ----
  { id: "arcane-bolt", name: "Arcane Bolt", school: "arcane", icon: "sparkle", target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 3 }, dmg: [4, 7], pen: 1, critBonus: 0, resolveCost: 1, cooldown: 1, effect: null, desc: "A reliable dart of raw force — cheap to cast, biting ward not armour." },
  { id: "lightning-bolt", name: "Lightning Bolt", school: "arcane", icon: "sparkle", target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 5 }, dmg: [6, 10], pen: 4, critBonus: 0, resolveCost: 2, cooldown: 2, effect: null, desc: "A single searing arc that bites through ward." },
  { id: "fireball", name: "Fireball", school: "arcane", icon: "flame", target: "all-enemies", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: [4, 7], pen: 1, critBonus: 0, resolveCost: 2, cooldown: 3, effect: { type: "burn", value: 4, duration: 3, target: "enemy" }, desc: "A burst of flame that sears and ignites every foe." },
  { id: "ice-shard", name: "Ice Shard", school: "arcane", icon: "droplet", target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 3 }, dmg: [4, 7], pen: 0, critBonus: 0, resolveCost: 1, cooldown: 2, effect: { type: "chill", value: 4, duration: 2, target: "enemy" }, desc: "A spike of ice that chills a foe, fouling their aim." },
  { id: "stone-armor", name: "Stone Armor", school: "arcane", icon: "shield", target: "self", damageType: null, scaling: "none", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 3 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 1, cooldown: 3, effect: { type: "shield", value: 12, target: "self" }, desc: "Sheathe yourself in conjured stone that soaks the next blows." },
  // ---- Divine ----
  { id: "heal", name: "Heal", school: "divine", icon: "heart", target: "self", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 4 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 2, cooldown: 4, effect: { type: "regen", value: 8, duration: 3, target: "self" }, desc: "Call light into your wounds — they knit over a few turns." },
  { id: "bless", name: "Bless", school: "divine", icon: "sparkle", target: "self", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 2 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 1, cooldown: 4, effect: { type: "rally", value: 30, duration: 3, target: "self" }, desc: "A blessing that lends force to your strikes for a few turns." },
  { id: "radiance", name: "Radiance", school: "divine", icon: "sparkle", target: "all-enemies", damageType: "magical", scaling: "stat", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 4 }, dmg: [4, 7], pen: 2, critBonus: 0, resolveCost: 2, cooldown: 3, effect: null, desc: "A burst of holy light that sears every foe before you." },
  { id: "shield-of-faith", name: "Shield of Faith", school: "divine", icon: "shield", target: "self", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 3 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 1, cooldown: 3, effect: { type: "magicShield", value: 12, target: "self" }, desc: "A ward of faith that turns aside the next magic to strike you." },

  // ---- More control & effect spells (each carries an inherent effect, so it
  //      stays worth a slot at high tier — not just bigger damage) ----
  { id: "electrocute", name: "Electrocute", school: "arcane", icon: "sparkle", target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: [4, 7], pen: 3, critBonus: 0, resolveCost: 1, cooldown: 3, effect: { type: "stun", value: 1, duration: 1, target: "enemy" }, desc: "A jolt of lightning that locks a foe's muscles — bites through ward, and may stun." },
  { id: "deep-freeze", name: "Deep Freeze", school: "arcane", icon: "droplet", target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: [4, 7], pen: 0, critBonus: 0, resolveCost: 2, cooldown: 3, effect: { type: "stun", value: 1, duration: 1, target: "enemy" }, desc: "Ice closes over a foe and holds them fast — they may freeze solid for a beat." },
  { id: "blizzard", name: "Blizzard", school: "arcane", icon: "droplet", target: "all-enemies", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: [3, 5], pen: 0, critBonus: 0, resolveCost: 2, cooldown: 3, effect: { type: "chill", value: 4, duration: 2, target: "enemy" }, desc: "A howling storm of ice that batters and chills every foe, fouling their aim." },
  { id: "plague", name: "Plague", school: "shadow", icon: "droplet", target: "all-enemies", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: [2, 4], pen: 1, critBonus: 0, resolveCost: 2, cooldown: 3, effect: { type: "poison", value: 4, duration: 4, target: "enemy" }, desc: "A roiling miasma that sickens every foe with a wasting, regen-blocking rot." },
  { id: "doom", name: "Doom", school: "shadow", icon: "moon", target: "all-enemies", damageType: null, scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 2, cooldown: 4, effect: { type: "vulnerable", value: 30, duration: 3, target: "enemy" }, desc: "Mark the WHOLE field for ruin — every foe at once takes far more damage from every source for a few turns." },
  { id: "life-drain", name: "Life Drain", school: "shadow", icon: "droplet", target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 3 }, dmg: [4, 7], pen: 2, critBonus: 0, resolveCost: 1, cooldown: 2, effect: { type: "drain", value: 50, target: "self" }, desc: "Tear the life from a foe and pour it into your own — your wounds close as theirs open." },

  // ---- Wizard school and nested-specialization workings ----
  // These are never part of the generic random-learning pool at runtime. The
  // profession ledger grants them only after their corresponding branch has
  // been chosen; combat then resolves them like every other authored ability.
  { id: "arcane-aegis", name: "Arcane Aegis", school: "arcane", icon: "shield", target: "self", damageType: null, scaling: "none", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 3, cooldown: 4, effect: { type: "magicShield", value: 0.3, pctMax: true, target: "self" }, branchExclusive: true, desc: "Fold abjuration into a layered ward able to absorb magic worth a share of your vitality." },
  { id: "spell-reflection", name: "Spell Reflection", school: "arcane", icon: "shield", target: "self", damageType: null, scaling: "none", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 5 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 5, cooldown: 6, effect: { type: "spellReflection", value: 50, duration: 2, target: "self" }, branchExclusive: true, desc: "Turn a prepared ward into a mirror; part of magical damage is thrown back at its source for two turns." },
  { id: "beguiling-command", name: "Beguiling Command", school: "arcane", icon: "sparkle", target: "all-enemies", damageType: null, scaling: "stat", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 5 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 7, cooldown: 6, effect: { type: "charmed", value: 1, duration: 2, target: "enemy" }, branchExclusive: true, desc: "An enchantment woven through voice and gesture that bids every listening foe stand down; each will may resist." },
  { id: "mirror-image", name: "Mirror Image", school: "arcane", icon: "moon", target: "self", damageType: null, scaling: "none", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 4, cooldown: 4, effect: { type: "dodgeStack", value: 45, duration: 2, target: "self" }, branchExclusive: true, desc: "Split your outline into convincing false selves, making attacks far harder to place." },
  { id: "phantasmal-killer", name: "Phantasmal Killer", school: "arcane", icon: "moon", target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 5 }, dmg: [7, 11], pen: 2, critBonus: 5, resolveCost: 7, cooldown: 5, effect: { type: "weaken", value: 35, duration: 3, target: "enemy" }, branchExclusive: true, desc: "Give a foe's deepest terror shape; even survivors strike through shaking hands." },
  { id: "elemental-surge", name: "Elemental Surge", school: "arcane", icon: "flame", target: "all-enemies", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 5 }, dmg: [6, 9], pen: 4, critBonus: 0, resolveCost: 8, cooldown: 4, effect: { type: "burn", value: 5, duration: 3, target: "enemy" }, branchExclusive: true, desc: "Overchannel an evoker's chosen element through the whole field in one destructive surge." },
  { id: "summon-undead", name: "Summon Undead", school: "shadow", icon: "moon", target: "self", damageType: null, scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 5 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 8, cooldown: 6, effect: { type: "summonUndead", value: 1, target: "self" }, branchExclusive: true, desc: "Call a bounded skeletal retainer to fight beside you. No caster can maintain more than two at once." },
  { id: "enervation", name: "Enervation", school: "shadow", icon: "droplet", target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 5 }, dmg: [4, 7], pen: 3, critBonus: 0, resolveCost: 7, cooldown: 4, effect: { type: "levelDrain", value: 25, duration: 4, target: "enemy" }, branchExclusive: true, desc: "Strip vigor and practiced certainty from a foe. The wound deals damage and suppresses accuracy and outgoing force." },
  { id: "death-clutch", name: "Death Clutch", school: "shadow", icon: "moon", target: "enemy", damageType: "true", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 6 }, dmg: [10, 15], pen: 0, critBonus: 10, resolveCost: 11, cooldown: 6, effect: { type: "curse", value: 35, duration: 3, target: "enemy" }, branchExclusive: true, desc: "Close spectral fingers around the target's animating force, inflicting severe true damage and a deathly curse." },
  { id: "soul-siphon", name: "Soul Siphon", school: "shadow", icon: "droplet", target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 6 }, dmg: [7, 11], pen: 4, critBonus: 0, resolveCost: 9, cooldown: 4, effect: { type: "drain", value: 90, target: "self" }, branchExclusive: true, desc: "Turn death magic toward theft, restoring most of the harm torn from a living soul." },
  { id: "grasp-heart", name: "Grasp Heart", school: "shadow", icon: "heart", target: "enemy", damageType: "true", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 7 }, dmg: [2, 4], pen: 0, critBonus: 0, resolveCost: 16, cooldown: 8, effect: { type: "instantKill", threshold: 0.25, bossThreshold: 0.08, target: "enemy" }, branchExclusive: true, desc: "Crush a weakened mortal heart at a distance. Healthy foes are unaffected, and bosses retain an overwhelming chance to resist even near death." },
  { id: "flesh-to-stone", name: "Flesh to Stone", school: "arcane", icon: "shield", target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 5 }, dmg: [3, 5], pen: 1, critBonus: 0, resolveCost: 8, cooldown: 6, effect: { type: "stun", value: 1, duration: 2, target: "enemy" }, branchExclusive: true, desc: "Transmute living tissue toward stone, locking the target in place while the change holds." },
  { id: "arcane-convergence", name: "Arcane Convergence", school: "arcane", icon: "sparkle", target: "self", damageType: null, scaling: "none", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 5 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 6, cooldown: 6, effect: { type: "arcaneConvergence", value: 1, duration: 2, target: "self" }, branchExclusive: true, desc: "Unify several schools into one prepared theorem, reducing spell costs and cooldowns for two turns." },
  { id: "antimagic-field", name: "Antimagic Field", school: "arcane", icon: "shield", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 7 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 15, cooldown: 8, effect: { type: "antimagicField", value: 75, duration: 2, target: "self" }, branchExclusive: true, desc: "Raise a moving dead zone around your side. Most magical damage and hostile spell effects fail within it, but protected casters cannot cast spells of their own." },
  { id: "geas", name: "Geas", school: "arcane", icon: "sparkle", target: "enemy", damageType: null, scaling: "stat", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 7 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 15, cooldown: 6, effect: { type: "geas", value: 6, duration: 4, target: "enemy" }, branchExclusive: true, desc: "Bind a command into a creature's will. A subject that continues offensive action loses vitality and Resolve each time it disobeys." },
  { id: "greater-invisibility", name: "Greater Invisibility", school: "arcane", icon: "moon", target: "self", damageType: null, scaling: "none", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 7 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 10, cooldown: 6, effect: { type: "greaterInvisibility", value: 70, duration: 3, target: "self" }, branchExclusive: true, desc: "Remain veiled even while fighting. Most direct attacks lose you entirely, and attacks made from the veil strike with supernatural advantage." },
  { id: "polymorph", name: "Polymorph", school: "arcane", icon: "sparkle", target: "enemy", damageType: null, scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 7 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 10, cooldown: 6, effect: { type: "polymorph", value: 1, duration: 3, target: "enemy" }, branchExclusive: true, desc: "Rewrite a foe into a harmless lesser shape. Its techniques and spells are sealed and only a feeble natural attack remains until the form breaks." },

  // ============================================================
  // SIGNATURE / ULTIMATE POWERS — the top of the pool. Still ordinary
  // library abilities (one def, scaled by the tier they're granted at),
  // but authored as devastating signature moves: high base numbers, long
  // cooldowns, heavy Resolve. A master's capstone or a god's boon hands
  // these out at high tiers; at low tiers they're a feeble echo. Same
  // schema + effect types as everything above.
  // ============================================================
  // ---- Arcane apex ----
  { id: "meteor", name: "Meteor", school: "arcane", icon: "flame", target: "all-enemies", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 5 }, dmg: [8, 12], pen: 3, critBonus: 0, resolveCost: 3, cooldown: 4, effect: { type: "burn", value: 5, duration: 3, target: "enemy" }, cataclysm: true, desc: "Call down a falling star — a roaring impact that sears every foe and leaves them burning. Needs open sky; ruinous in a confined space." },
  { id: "disintegrate", name: "Disintegrate", school: "arcane", icon: "sparkle", target: "enemy", damageType: "true", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 6 }, dmg: [10, 16], pen: 0, critBonus: 0, resolveCost: 3, cooldown: 4, effect: null, desc: "A lance of pure unmaking — annihilating force that no armour or ward can blunt." },
  { id: "tempest", name: "Tempest", school: "arcane", icon: "sparkle", target: "all-enemies", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 6 }, dmg: [6, 10], pen: 5, critBonus: 0, resolveCost: 3, cooldown: 4, effect: null, desc: "A storm of lightning that leaps through every foe, biting deep through ward." },
  { id: "time-stop", name: "Time Stop", school: "arcane", icon: "sparkle", target: "self", damageType: null, scaling: "none", scaleAttr: "reflex", weaponReq: null, statReq: { attr: "reflex", base: 5 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 3, cooldown: 5, effect: { type: "bonusAction", value: 2, target: "self" }, desc: "Time bends around you — seize two extra actions this turn." },
  // ---- Shadow apex ----
  { id: "soul-rend", name: "Soul-Rend", school: "shadow", icon: "moon", target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 5 }, dmg: [8, 12], pen: 3, critBonus: 0, resolveCost: 3, cooldown: 4, effect: { type: "curse", value: 30, duration: 3, target: "enemy" }, desc: "Tear at the spirit itself — devastating dark damage that leaves the wound cursed to fester: the foe takes more from every blow and can barely heal." },
  { id: "mass-terror", name: "Mass Terror", school: "shadow", icon: "moon", target: "all-enemies", damageType: null, scaling: "stat", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 5 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 3, cooldown: 4, effect: { type: "weaken", value: 35, duration: 3, target: "enemy" }, desc: "Loose overwhelming dread — every foe's strength fails them." },
  // ---- Mind-control (enchantment / compulsion) — gated by the target's WILL (mind+presence) ----
  { id: "charm", name: "Charm", school: "arcane", icon: "sparkle", target: "enemy", damageType: null, scaling: "stat", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 2 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 3, cooldown: 4, minTier: "epic", effect: { type: "charmed", value: 1, duration: 3, target: "enemy" }, desc: "Weave a gentle suggestion — the foe is calmed and won't raise a hand against you for a time. It can't be made to harm its own; the strong-willed resist." },
  { id: "dominate", name: "Dominate", school: "shadow", icon: "moon", target: "enemy", damageType: null, scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 2 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 6, cooldown: 6, minTier: "mythical", effect: { type: "dominated", value: 1, duration: 2, target: "enemy" }, desc: "Seize a mind and bend it wholly — one will-save; if it lands, the thrall is yours FOREVER, turned against its own. Only a stronger will resists." },
  { id: "dispel", name: "Dispel", school: "arcane", icon: "sparkle", target: "enemy", damageType: null, scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 2 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 2, cooldown: 3, minTier: "rare", effect: { type: "dispel", target: "enemy" }, desc: "Unweave hostile magic — strips control and curses, and can shatter a domination by overpowering the will that forged it." },
  // ---- Divine apex ----
  { id: "judgment", name: "Judgment", school: "divine", icon: "sparkle", target: "enemy", damageType: "true", scaling: "stat", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 5 }, dmg: [8, 12], pen: 0, critBonus: 15, resolveCost: 3, cooldown: 4, effect: { type: "stun", value: 1, duration: 1, target: "enemy" }, desc: "A pillar of holy fire that ignores all defence, lays the wicked low, and may stun." },
  { id: "dawnburst", name: "Dawnburst", school: "divine", icon: "sparkle", target: "all-enemies", damageType: "magical", scaling: "stat", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 5 }, dmg: [6, 10], pen: 3, critBonus: 0, resolveCost: 3, cooldown: 4, effect: null, desc: "A blinding dawn that scours every foe before you with holy light." },
  { id: "renewal", name: "Renewal", school: "divine", icon: "heart", target: "self", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 5 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 3, cooldown: 5, effect: { type: "regen", value: 14, duration: 4, target: "self" }, desc: "Light floods your wounds — grievous hurts close fast over several turns." },
  // ---- Divine SUPPORT (party-target) — the backbone of a healer/support role.
  //      Deliberately EXPENSIVE (high Resolve + long cooldowns): a force-multiplier
  //      for a built party, not spam. Need Presence to wield. ----
  { id: "sanctify", name: "Sanctify", school: "divine", icon: "heart", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 5 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 4, cooldown: 4, effect: { type: "regen", value: 0.06, pctMax: true, duration: 4, target: "ally" }, desc: "Holy light knits the wounds of you and all who stand with you — restoring a share of each one's health over several turns." },
  { id: "guardian-aegis", name: "Guardian Aegis", school: "divine", icon: "shield", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 5 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 4, cooldown: 4, effect: { type: "shield", value: 0.22, pctMax: true, target: "ally" }, desc: "Raise a bulwark of light over the whole party — each ally soaks blows worth a share of their health." },
  { id: "battle-hymn", name: "Battle Hymn", school: "divine", icon: "flame", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 4 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 3, cooldown: 5, effect: { type: "rally", value: 30, duration: 3, target: "ally" }, desc: "A war-hymn that lifts every ally's strikes for a few turns." },
  { id: "last-sanctuary", name: "Last Sanctuary", school: "divine", icon: "shield", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 6 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 7, cooldown: 7, effect: { type: "invuln", duration: 1, target: "ally" }, desc: "Call an untouchable grace over the whole party — for one turn no harm lands. The costliest mercy, and a raid's salvation." },
  { id: "unbreakable-will", name: "Unbreakable Will", school: "divine", icon: "shield", target: "self", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 5 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 6, cooldown: 7, effect: { type: "unstoppable", duration: 2, target: "self" }, desc: "Bend nothing, break never — for two turns NO debuff can touch you (stun, curse, silence all fail) and no blow can fell you. The answer to an alpha strike or a curse-locking boss." },
  // ---- Cleric DOMAIN prayers — ledger-gated, never freeform-learned. These
  //      emphasize ministry, bounded intercession, and sacred opposition rather
  //      than reproducing a Wizard's elemental spell list. ----
  { id: "purifying-light", name: "Purifying Light", school: "divine", icon: "heart", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 5 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 10, cooldown: 5, effect: { type: "purify", value: 0.08, pctMax: true, target: "ally" }, branchExclusive: true, desc: "Wash the party in measured sacred light: mend a modest share of each ally's wounds and remove poison, bleeding, burning, curses, and other bounded afflictions — not domination or mortal injury." },
  { id: "divine-intercession", name: "Divine Intercession", school: "divine", icon: "heart", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 6 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 18, cooldown: 7, effect: { type: "intercession", value: 0.08, criticalValue: 0.25, threshold: 0.35, shield: 0.1, target: "ally" }, branchExclusive: true, desc: "Intercede for the whole company. Every ally receives modest immediate aid; those already near death receive a greater rescue and a brief protective buffer." },
  { id: "turn-profane", name: "Turn the Profane", school: "divine", icon: "sparkle", target: "all-enemies", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 5 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 10, cooldown: 5, effect: { type: "turnProfane", value: 30, duration: 2, target: "enemy" }, branchExclusive: true, desc: "Present sacred authority against undead, true demons, and hostile spirits. Profane foes that fail to resist recoil helplessly for a turn and remain shaken; mortal creatures are not affected." },
  { id: "exorcise", name: "Exorcise", school: "divine", icon: "sparkle", target: "enemy", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 6 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 16, cooldown: 7, effect: { type: "exorcise", threshold: 0.3, duration: 3, target: "enemy" }, branchExclusive: true, desc: "Contest a possessing or profane entity by sacred name. Free an afflicted host, banish a lesser summon or weakened outsider, or suppress a stronger entity's supernatural action; it is not generic damage." },
  { id: "consecrated-strike", name: "Consecrated Strike", school: "divine", icon: "swords", target: "enemy", damageType: "magical", scaling: "weapon", scaleAttr: "presence", weaponReq: ["mace", "axe", "spear", "sword"], statReq: { attr: "presence", base: 5 }, dmg: [2, 4], pen: 1, critBonus: 5, resolveCost: 6, cooldown: 3, effect: { type: "weaken", value: 20, duration: 2, target: "enemy" }, branchExclusive: true, desc: "Bind weapon practice to a declared protective duty. The Presence-guided blow is checked by ward rather than pretending to be a Paladin's defence-ignoring smite, and it weakens the foe's next attacks." },
  { id: "storm-rebuke", name: "Storm Rebuke", school: "divine", icon: "sparkle", target: "all-enemies", damageType: "magical", scaling: "stat", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 5 }, dmg: [3, 5], pen: 0, critBonus: 0, resolveCost: 10, cooldown: 5, effect: { type: "stun", value: 1, duration: 1, target: "enemy" }, branchExclusive: true, desc: "Answer violence with a peal of sacred thunder. Moderate Presence-based force rolls across the field and may stagger foes for one turn; it lacks a Wizard storm's raw penetration." },
  { id: "verdant-aegis", name: "Verdant Aegis", school: "divine", icon: "shield", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 5 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 12, cooldown: 5, effect: { type: "verdantAegis", heal: 0.07, shield: 0.12, target: "ally" }, branchExclusive: true, desc: "Call the patient vitality of root and season around the party, granting a modest immediate recovery and a physical ward without becoming an elemental attack or another healing-over-time prayer." },
  { id: "sacred-misdirection", name: "Sacred Misdirection", school: "divine", icon: "moon", target: "enemy", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 5 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 10, cooldown: 5, effect: { type: "misdirected", value: 1, duration: 2, target: "enemy" }, branchExclusive: true, desc: "Offer a brief sacred falsehood that tangles one foe's next hostile action. The target keeps its will and allegiance: this is resisted disruption, never charm or domination." },
  // ---- Warrior — progression-owned personal martial technique ----
  // Every card is explicitly owned by the legacy internal `fighter` id while
  // presenting outwardly as Warrior. Martial Tempo is earned only by landing a
  // different native sequence tag or by resolving one of the native defensive
  // reactions below. No spell, innate power, rage, stealth, fieldcraft, order,
  // or other profession's card can enter that economy.
  { ...warriorIdentity, id: "warrior-measured-strike", name: "Measured Strike", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "wit", weaponReq: WARRIOR_WEAPONS, statReq: { attr: "wit", base: 2 }, dmg: null, damageMult: 0.9, accuracyBonus: 25, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 1, effect: null, warriorSequenceTag: "measure", desc: "Test distance with a balanced, highly accurate weapon attack. A clean hit begins a native Warrior sequence without overcommitting." },
  { ...warriorIdentity, id: "warrior-guarded-cut", name: "Guarded Cut", school: "martial", icon: "shield", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: WARRIOR_MELEE_WEAPONS, statReq: { attr: "body", base: 3 }, dmg: null, damageMult: 0.9, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 2, effect: null, selfEffect: { type: "warriorGuard", block: 0.1, duration: 2, target: "self" }, warriorSequenceTag: "guarded-cut", desc: "Cut while recovering behind the weapon. A clean hit raises a short physical guard for the answering exchange." },
  { ...warriorIdentity, id: "warrior-passing-step", name: "Passing Step", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: WARRIOR_MELEE_WEAPONS, statReq: { attr: "reflex", base: 3 }, dmg: null, damageMult: 0.8, pen: 1, critBonus: 5, resolveCost: 0, cooldown: 2, effect: null, selfEffect: { type: "warriorPassingStep", value: 25, duration: 2, target: "self" }, warriorSequenceTag: "passing-step", desc: "Strike while crossing the attack line, then retain a brief footwork advantage against the next reply." },
  { ...warriorIdentity, id: "warrior-weapon-bind", name: "Weapon Bind", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "wit", weaponReq: WARRIOR_MELEE_WEAPONS, statReq: { attr: "wit", base: 3 }, dmg: null, damageMult: 0.7, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 3, effect: { type: "warriorWeaponBind", duration: 2, target: "enemy" }, warriorSequenceTag: "weapon-bind", desc: "Catch an opposing weapon under leverage. The next hostile weapon action is suppressed; spells and natural powers remain unaffected." },
  { ...warriorIdentity, id: "warrior-turning-parry", name: "Turning Parry", school: "martial", icon: "shield", target: "self", damageType: null, scaling: "none", scaleAttr: "reflex", weaponReq: WARRIOR_MELEE_WEAPONS, statReq: { attr: "reflex", base: 4 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 3, effect: { type: "warriorTurningParry", value: 55, duration: 2, target: "self" }, desc: "Prepare to turn one incoming weapon line aside. A successful parry opens the angle, creates Martial Tempo, and cannot answer a spell." },
  { ...warriorIdentity, id: "warrior-sweeping-denial", name: "Sweeping Denial", school: "martial", icon: "swords", target: "all-enemies", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: WARRIOR_MELEE_WEAPONS, statReq: { attr: "body", base: 4 }, dmg: null, damageMult: 0.65, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 4, effect: { type: "warriorDriveBack", value: 1, target: "enemy" }, warriorSequenceTag: "sweeping-denial", desc: "Trace a controlled physical arc across nearby threats, dealing reduced weapon damage and forcing each struck foe one step back." },
  { ...warriorIdentity, id: "warrior-break-guard", name: "Break Guard", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: WARRIOR_HEAVY_WEAPONS, statReq: { attr: "body", base: 4 }, dmg: null, damageMult: 0.9, pen: 8, critBonus: 0, resolveCost: 0, cooldown: 3, effect: { type: "shatter", value: 10, duration: 3, target: "enemy" }, warriorSequenceTag: "break-guard", desc: "Attack fastenings, overlaps, and balance. The blow carries heavy armour penetration and leaves physical protection compromised for a bounded time." },
  { ...warriorIdentity, id: "warrior-masterstroke", name: "Masterstroke", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "wit", weaponReq: WARRIOR_WEAPONS, statReq: { attr: "wit", base: 5 }, dmg: null, damageMult: 1.15, accuracyBonus: 15, pen: 3, critBonus: 10, resolveCost: 0, cooldown: 4, effect: null, warriorTempoCost: 1, warriorConsumeAllTempo: true, warriorFinisher: true, desc: "Spend all built Martial Tempo on one exact physical attack. Each point consumed adds bounded force; armour and dodge still matter." },
  { ...warriorIdentity, id: "warrior-iron-sequence", name: "Iron Sequence", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: WARRIOR_MELEE_WEAPONS, statReq: { attr: "body", base: 5 }, dmg: null, damageMult: 0.55, hits: 3, pen: 1, critBonus: 0, resolveCost: 0, cooldown: 4, effect: null, warriorSequenceTag: "iron-sequence", desc: "Link three compact weapon contacts. Each hit is light, and the repeated tag can create no more than one Martial Tempo for the whole sequence." },
  { ...warriorIdentity, id: "warrior-adaptive-form", name: "Adaptive Form", school: "martial", icon: "shield", target: "self", damageType: null, scaling: "none", scaleAttr: "wit", weaponReq: null, statReq: { attr: "wit", base: 5 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 5, effect: { type: "warriorAdaptiveForm", block: 0.05, cooldownShift: 1, target: "self" }, desc: "Re-center trained stance after a change of weapon, range, or footing. Clear the previous sequence tag and shorten native Warrior cooldowns without granting Tempo." },
  { ...warriorIdentity, id: "warrior-veteran-reversal", name: "Veteran Reversal", school: "martial", icon: "shield", target: "self", damageType: null, scaling: "none", scaleAttr: "wit", weaponReq: WARRIOR_MELEE_WEAPONS, statReq: { attr: "wit", base: 6 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 5, effect: { type: "warriorVeteranReversal", reduction: 0.4, counter: 0.65, duration: 2, target: "self" }, desc: "Prepare one experienced reversal. The next direct physical weapon hit is reduced and answered with a bounded weapon counter, creating Martial Tempo." },
  { ...warriorIdentity, id: "warrior-perfect-technique", name: "Perfect Technique", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "wit", weaponReq: WARRIOR_WEAPONS, statReq: { attr: "wit", base: 7 }, dmg: null, damageMult: 1.4, accuracyBonus: 40, pen: 8, critBonus: 15, resolveCost: 0, cooldown: 6, effect: null, warriorTempoCost: 3, warriorFinisher: true, desc: "Consume three Martial Tempo to execute the Warrior's fully integrated physical technique: exceptionally accurate and penetrating, but never magical or defence-ignoring." },

  // Warrior specialization cards. Every one is chosen through the branch tree
  // and is rejected if injected into a save without that durable route.
  { ...warriorIdentity, id: "warrior-weapon-change", name: "Weapon Change", school: "martial", icon: "swords", target: "self", damageType: null, scaling: "none", scaleAttr: "wit", weaponReq: null, statReq: { attr: "wit", base: 3 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 4, effect: { type: "warriorWeaponChange", value: 20, duration: 2, target: "self" }, branchExclusive: true, desc: "Swap to a prepared alternate weapon without losing the exchange. When no alternate is carried, the action still restores stance but cannot invent equipment." },
  { ...warriorIdentity, id: "warrior-riposte-guard", name: "Riposte Guard", school: "martial", icon: "shield", target: "self", damageType: null, scaling: "none", scaleAttr: "reflex", weaponReq: WARRIOR_MELEE_WEAPONS, statReq: { attr: "reflex", base: 3 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 4, effect: { type: "warriorRiposteGuard", block: 0.15, counter: 0.5, duration: 2, target: "self" }, branchExclusive: true, desc: "Set a weapon guard that absorbs part of the next direct physical exchange and answers once with a bounded riposte, creating Martial Tempo." },
  { ...warriorIdentity, id: "warrior-braced-advance", name: "Braced Advance", school: "martial", icon: "shield", target: "self", damageType: null, scaling: "none", scaleAttr: "vigor", weaponReq: WARRIOR_HEAVY_WEAPONS, statReq: { attr: "vigor", base: 3 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 4, effect: { type: "warriorBracedAdvance", steps: 2, block: 0.12, target: "self" }, branchExclusive: true, desc: "Close up to two steps behind armour and weapon structure while gaining a bounded physical block. It is movement and bracing, not a charge spell." },
  { ...warriorIdentity, id: "warrior-second-breath", name: "Second Breath", school: "martial", icon: "heart", target: "self", damageType: null, scaling: "none", scaleAttr: "vigor", weaponReq: null, statReq: { attr: "vigor", base: 3 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 8, effect: { type: "warriorSecondBreath", value: 0.15, target: "self" }, branchExclusive: true, desc: "Use practiced pacing to recover a bounded share of health immediately once per fight. It is finite conditioning, not regeneration or spell healing." },
  { ...warriorIdentity, id: "warrior-crosscut-sequence", name: "Crosscut Sequence", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: WARRIOR_MELEE_WEAPONS, statReq: { attr: "reflex", base: 4 }, dmg: null, damageMult: 0.75, hits: 2, pen: 2, critBonus: 5, resolveCost: 0, cooldown: 3, effect: null, warriorSequenceTag: "crosscut", branchExclusive: true, desc: "Cut across one recovery line and back through the other. Two bounded physical hits share one native sequence tag and grant at most one Tempo." },
  { ...warriorIdentity, id: "warrior-read-opponent", name: "Read Opponent", school: "martial", icon: "swords", target: "enemy", damageType: null, scaling: "none", scaleAttr: "wit", weaponReq: null, statReq: { attr: "wit", base: 4 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 4, effect: { type: "warriorReadOpponent", value: 30, pen: 5, crit: 15, duration: 3, target: "enemy" }, branchExclusive: true, desc: "Study one foe's balance and habits. Only the reader's next native Warrior weapon attack gains accuracy, penetration, and critical leverage." },
  { ...warriorIdentity, id: "warrior-stop-thrust", name: "Stop Thrust", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: ["spear", "sword"], statReq: { attr: "reflex", base: 4 }, dmg: null, damageMult: 0.75, pen: 3, critBonus: 5, resolveCost: 0, cooldown: 3, effect: { type: "warriorStopThrust", value: 1, duration: 2, target: "enemy" }, warriorSequenceTag: "stop-thrust", branchExclusive: true, desc: "Place a point into the approach, forcing the struck foe back and checking its next attempt to close distance." },
  { ...warriorIdentity, id: "warrior-seize-tempo", name: "Seize Tempo", school: "martial", icon: "swords", target: "self", damageType: null, scaling: "none", scaleAttr: "reflex", weaponReq: null, statReq: { attr: "reflex", base: 4 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 5, effect: { type: "warriorSeizeTempo", value: 1, cooldownShift: 1, target: "self" }, warriorTempoCost: 1, warriorFinisher: true, branchExclusive: true, desc: "Spend one earned Martial Tempo to gain one immediate action and shorten native Warrior cooldowns. It never creates Tempo by itself." },
  { ...warriorIdentity, id: "warrior-break-line", name: "Break Line", school: "martial", icon: "swords", target: "all-enemies", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: WARRIOR_HEAVY_WEAPONS, statReq: { attr: "body", base: 4 }, dmg: null, damageMult: 0.7, pen: 2, critBonus: 0, resolveCost: 0, cooldown: 4, effect: { type: "warriorDriveBack", value: 2, target: "enemy" }, warriorSequenceTag: "break-line", branchExclusive: true, desc: "Drive a personal wedge through nearby opposition, dealing reduced physical weapon damage and forcing struck foes two steps back." },
  { ...warriorIdentity, id: "warrior-deny-approach", name: "Deny Approach", school: "martial", icon: "shield", target: "self", damageType: null, scaling: "none", scaleAttr: "wit", weaponReq: ["spear", "sword"], statReq: { attr: "wit", base: 4 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 5, effect: { type: "warriorDenyApproach", counter: 0.4, duration: 3, target: "self" }, branchExclusive: true, desc: "Hold reach against one incoming melee approach. The first such action is stopped and answered once; ranged attacks and spells pass this guard normally." },
  { ...warriorIdentity, id: "warrior-shake-it-off", name: "Shake It Off", school: "martial", icon: "shield", target: "self", damageType: null, scaling: "none", scaleAttr: "vigor", weaponReq: null, statReq: { attr: "vigor", base: 4 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 5, effect: { type: "warriorShakeOff", block: 0.06, target: "self" }, branchExclusive: true, desc: "Clear bounded physical hindrances such as bleeding, weakness, vulnerability, and slowed footing, then brace briefly. It cannot purge poison, curses, magic, or mind control." },
  { ...warriorIdentity, id: "warrior-last-stand", name: "Last Stand", school: "martial", icon: "shield", target: "self", damageType: null, scaling: "none", scaleAttr: "vigor", weaponReq: null, statReq: { attr: "vigor", base: 5 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 8, effect: { type: "warriorLastStand", duration: 2, block: 0.08, target: "self" }, healthThreshold: 0.35, branchExclusive: true, desc: "While at or below 35% health, commit to two turns in which direct harm cannot take the final point. Once per fight; it heals nothing and delays rather than erases wounds." },

  // ---- Monk — progression-owned physical discipline ----
  // Posture Strain belongs to the TARGET rather than functioning as another
  // self-buff resource. A landed native contact can add at most one strain per
  // target for the whole action, even when the technique has several hits.
  // Consumers spend the stated threshold for bounded leverage, interruption,
  // trips, throws, or added impact. Every apparent marvel remains trained body
  // mechanics: armour still mitigates it and no card teleports, vanishes, casts,
  // invokes, or deals defence-ignoring damage.
  { ...monkIdentity, id: "monk-measured-palm", name: "Measured Palm", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "wit", weaponReq: MONK_UNARMED, statReq: { attr: "wit", base: 2 }, dmg: null, damageMult: 0.7, accuracyBonus: 25, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 1, effect: null, monkPostureBuild: 1, desc: "Place an accurate bare-hand contact against the target's base. It deals modest physical force and begins testing balance for Posture Strain." },
  { ...monkIdentity, id: "monk-three-beat-strike", name: "Three-Beat Strike", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: MONK_UNARMED, statReq: { attr: "reflex", base: 3 }, dmg: null, damageMult: 0.38, hits: 3, pen: 0, critBonus: 3, resolveCost: 0, cooldown: 2, effect: null, monkPostureBuild: 1, desc: "Link three light bare-hand contacts. The sequence can add only one Posture Strain no matter how many blows connect." },
  { ...monkIdentity, id: "monk-yielding-guard", name: "Yielding Guard", school: "martial", icon: "shield", target: "self", damageType: null, scaling: "none", scaleAttr: "reflex", weaponReq: MONK_UNARMED, statReq: { attr: "reflex", base: 3 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 3, effect: { type: "monkYieldingGuard", block: 0.08, dodge: 22, duration: 2, target: "self" }, desc: "Keep empty hands free to yield around the next physical line, adding bounded Block and evasive footwork rather than a ward." },
  { ...monkIdentity, id: "monk-joint-check", name: "Joint Check", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "wit", weaponReq: MONK_UNARMED, statReq: { attr: "wit", base: 3 }, dmg: null, damageMult: 0.7, pen: 1, critBonus: 0, resolveCost: 0, cooldown: 2, effect: null, monkPostureCost: 1, monkControl: "joint-check", desc: "Spend one Posture Strain to check a loaded joint. The bounded physical leverage weakens the target's next blows; it does not paralyse by magic." },
  { ...monkIdentity, id: "monk-reaping-kick", name: "Reaping Kick", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: MONK_UNARMED, statReq: { attr: "body", base: 4 }, dmg: null, damageMult: 0.85, pen: 1, critBonus: 5, resolveCost: 0, cooldown: 3, effect: null, monkPostureCost: 2, monkControl: "trip", monkFreedomRequired: true, desc: "Spend two Posture Strain to reap a bearing leg with a physical kick. Ordinary bodies may be tripped; massive or boss-scale foes merely lose footing briefly." },
  { ...monkIdentity, id: "monk-crossing-step", name: "Crossing Step", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: MONK_UNARMED, statReq: { attr: "reflex", base: 4 }, dmg: null, damageMult: 0.72, pen: 1, critBonus: 5, resolveCost: 0, cooldown: 2, effect: null, selfEffect: { type: "monkCrossingStep", dodge: 20, duration: 2, target: "self" }, monkPostureBuild: 1, monkFreedomRequired: true, desc: "Cross the attack line with a bare-hand contact, adding one bounded Posture Strain and a brief physical footwork advantage." },
  { ...monkIdentity, id: "monk-posture-break", name: "Posture Break", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "wit", weaponReq: MONK_UNARMED, statReq: { attr: "wit", base: 4 }, dmg: null, damageMult: 0.9, accuracyBonus: 10, pen: 2, critBonus: 0, resolveCost: 0, cooldown: 3, effect: null, monkPostureCost: 2, monkControl: "interrupt", desc: "Spend two Posture Strain to buckle the target's base and physically interrupt its next committed action. Boss-scale bodies suffer only a bounded accuracy loss." },
  { ...monkIdentity, id: "monk-cascade-blows", name: "Cascade Blows", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: MONK_UNARMED, statReq: { attr: "reflex", base: 5 }, dmg: null, damageMult: 0.32, hits: 4, pen: 1, critBonus: 4, resolveCost: 0, cooldown: 3, effect: null, monkPostureBuild: 1, desc: "A four-contact bare-hand cascade. It pressures guard and flesh physically, while the whole sequence adds at most one Posture Strain." },
  { ...monkIdentity, id: "monk-resonant-impact", name: "Resonant Impact", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: MONK_UNARMED, statReq: { attr: "body", base: 5 }, dmg: null, damageMult: 1.05, pen: 3, critBonus: 5, resolveCost: 0, cooldown: 4, effect: null, monkPostureCost: 2, monkPostureDamagePerPoint: 0.14, monkControl: "impact", desc: "Spend two Posture Strain and drive a compact bodily shock through the opened structure. 'Resonance' is timing and transferred force: physical, armoured, and bounded." },
  { ...monkIdentity, id: "monk-shoulder-throw", name: "Shoulder Throw", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: MONK_UNARMED, statReq: { attr: "body", base: 5 }, dmg: null, damageMult: 0.78, pen: 1, critBonus: 0, resolveCost: 0, cooldown: 4, effect: null, monkPostureCost: 2, monkControl: "throw", monkFreedomRequired: true, desc: "Spend two Posture Strain to turn the target over hip and shoulder. Size, weight, anatomy, armour, and boss scale strictly bound the throw." },
  { ...monkIdentity, id: "monk-ascending-knee", name: "Ascending Knee", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: MONK_UNARMED, statReq: { attr: "body", base: 6 }, dmg: null, damageMult: 1.05, pen: 3, critBonus: 8, resolveCost: 0, cooldown: 4, effect: null, monkPostureCost: 1, monkControl: "lift", monkFreedomRequired: true, desc: "Spend one Posture Strain on an ascending knee that lifts an ordinary foe off its base. Great bodies are checked, never launched." },
  { ...monkIdentity, id: "monk-perfect-impact", name: "Perfect Impact", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "wit", weaponReq: MONK_UNARMED, statReq: { attr: "wit", base: 7 }, dmg: null, damageMult: 1.3, accuracyBonus: 35, pen: 6, critBonus: 12, resolveCost: 0, cooldown: 6, effect: null, monkPostureCost: 3, monkPostureDamagePerPoint: 0.16, monkControl: "perfect-impact", desc: "Spend three Posture Strain on one fully aligned bare-hand impact. It is unusually exact and forceful, yet remains physical and fully subject to armour and damage reduction." },

  // Monk specialization cards. Only the three Temple Arms cards below accept
  // mundane weapons; every other branch technique continues to require empty
  // hands and is rejected without its selected progression route.
  { ...monkIdentity, id: "monk-open-hand-parry", name: "Open-Hand Parry", school: "martial", icon: "shield", target: "self", damageType: null, scaling: "none", scaleAttr: "reflex", weaponReq: MONK_UNARMED, statReq: { attr: "reflex", base: 3 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 4, effect: { type: "monkOpenHandParry", reduction: 0.35, duration: 2, target: "self" }, branchExclusive: true, desc: "Prepare one empty-hand redirection against a direct physical melee attack. The parry reduces force and its contact may strain the attacker's posture." },
  { ...monkIdentity, id: "monk-iron-body-brace", name: "Iron Body Brace", school: "martial", icon: "shield", target: "self", damageType: null, scaling: "none", scaleAttr: "vigor", weaponReq: MONK_UNARMED, statReq: { attr: "vigor", base: 3 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 4, effect: { type: "monkIronBodyBrace", block: 0.14, duration: 2, target: "self" }, branchExclusive: true, desc: "Brace conditioned tissue and skeletal alignment for bounded physical Block. The 'iron' is trained resilience, not armour conjuration." },
  { ...monkIdentity, id: "monk-burst-step", name: "Burst Step", school: "martial", icon: "swords", target: "self", damageType: null, scaling: "none", scaleAttr: "reflex", weaponReq: MONK_UNARMED, statReq: { attr: "reflex", base: 3 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 4, effect: { type: "monkBurstStep", steps: 2, dodge: 18, duration: 2, target: "self" }, monkFreedomRequired: true, branchExclusive: true, desc: "Sprint up to two battlefield steps and settle behind evasive footwork. It is ordinary movement under exceptional training, never teleportation." },
  { ...monkIdentity, id: "monk-kata-entry", name: "Kata Entry", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "wit", weaponReq: MONK_TEMPLE_ARMS, statReq: { attr: "wit", base: 3 }, dmg: null, damageMult: 0.78, accuracyBonus: 15, pen: 1, critBonus: 0, resolveCost: 0, cooldown: 2, effect: null, monkPostureBuild: 1, branchExclusive: true, desc: "Enter a Temple Arms kata with staff, spear, or sword. A clean mundane weapon contact adds one Posture Strain without borrowing Warrior Tempo." },
  { ...monkIdentity, id: "monk-locking-palm", name: "Locking Palm", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "wit", weaponReq: MONK_UNARMED, statReq: { attr: "wit", base: 4 }, dmg: null, damageMult: 0.65, pen: 1, critBonus: 0, resolveCost: 0, cooldown: 4, effect: null, monkPostureCost: 2, monkControl: "interrupt", branchExclusive: true, desc: "Spend two Posture Strain to close a limb against its loaded joint and interrupt one committed action. It cannot bind an unsuitable anatomy." },
  { ...monkIdentity, id: "monk-wheel-throw", name: "Wheel Throw", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: MONK_UNARMED, statReq: { attr: "body", base: 4 }, dmg: null, damageMult: 0.72, pen: 1, critBonus: 0, resolveCost: 0, cooldown: 5, effect: null, monkPostureCost: 3, monkControl: "wheel-throw", monkFreedomRequired: true, branchExclusive: true, desc: "Spend three Posture Strain to wheel an ordinary target across the ground. Great weight, odd anatomy, and boss scale collapse it to a brief stumble." },
  { ...monkIdentity, id: "monk-absorbing-frame", name: "Absorbing Frame", school: "martial", icon: "shield", target: "self", damageType: null, scaling: "none", scaleAttr: "vigor", weaponReq: MONK_UNARMED, statReq: { attr: "vigor", base: 4 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 5, effect: { type: "monkAbsorbingFrame", reduction: 0.45, duration: 2, target: "self" }, branchExclusive: true, desc: "Receive one direct physical blow through conditioned structure, reducing its force. The resulting body contact may add bounded Posture Strain to the attacker." },
  { ...monkIdentity, id: "monk-breaking-knuckle", name: "Breaking Knuckle", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: MONK_UNARMED, statReq: { attr: "body", base: 4 }, dmg: null, damageMult: 0.9, pen: 4, critBonus: 5, resolveCost: 0, cooldown: 3, effect: null, monkPostureCost: 1, monkControl: "shatter", branchExclusive: true, desc: "Spend one Posture Strain to strike a fastening, overlap, or guarded seam. It physically compromises armour for a bounded time." },
  { ...monkIdentity, id: "monk-rebound-step", name: "Rebound Step", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: MONK_UNARMED, statReq: { attr: "reflex", base: 4 }, dmg: null, damageMult: 0.72, pen: 1, critBonus: 5, resolveCost: 0, cooldown: 3, effect: null, selfEffect: { type: "monkReboundStep", dodge: 24, steps: 1, duration: 2, target: "self" }, monkPostureBuild: 1, monkFreedomRequired: true, branchExclusive: true, desc: "Touch the target and spring back one step under leg power, adding Posture Strain and brief evasive distance without blinking through space." },
  { ...monkIdentity, id: "monk-vaulting-knee", name: "Vaulting Knee", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: MONK_UNARMED, statReq: { attr: "body", base: 4 }, dmg: null, damageMult: 1, pen: 2, critBonus: 8, resolveCost: 0, cooldown: 4, effect: null, monkPostureCost: 1, monkControl: "lift", monkFreedomRequired: true, branchExclusive: true, desc: "Spend one Posture Strain on a running vault and rising knee. It checks large foes instead of impossibly launching them." },
  { ...monkIdentity, id: "monk-staff-circuit", name: "Staff Circuit", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: MONK_STAFF_ARMS, statReq: { attr: "reflex", base: 4 }, dmg: null, damageMult: 0.45, hits: 3, pen: 2, critBonus: 3, resolveCost: 0, cooldown: 3, effect: null, monkPostureBuild: 1, branchExclusive: true, desc: "Cycle three light contacts with a quarterstaff or spear. The mundane weapon sequence adds at most one Posture Strain." },
  { ...monkIdentity, id: "monk-temple-blade-arc", name: "Temple Blade Arc", school: "martial", icon: "swords", target: "all-enemies", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: ["sword"], statReq: { attr: "reflex", base: 4 }, dmg: null, damageMult: 0.62, pen: 2, critBonus: 4, resolveCost: 0, cooldown: 4, effect: null, monkPostureBuild: 1, branchExclusive: true, desc: "Carry a disciplined sword arc through nearby foes. Each target can gain one Posture Strain; it remains a mundane physical blade technique." },

  // ---- Barbarian — progression-owned Fury techniques ----
  // Fury is a 0–5 reserve on the Barbarian. It is earned by actually losing
  // health to a hostile direct-damage action (once for that whole action), not
  // by attacking, missing, absorbing a hit, suffering a DOT, or borrowing any
  // other profession's resource. Every damaging card below remains physical
  // and armour-respecting; spectacular names describe force, not spellcraft.
  { ...barbarianIdentity, id: "barbarian-brutal-swing", name: "Brutal Swing", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: BARBARIAN_WEAPONS, statReq: { attr: "body", base: 2 }, dmg: null, damageMult: 0.95, pen: 1, critBonus: 3, resolveCost: 0, cooldown: 1, effect: null, desc: "Drive axe, mace, sword, spear, or the whole unarmed body through one heavy physical line. It spends no Fury and never creates Fury by attacking." },
  { ...barbarianIdentity, id: "barbarian-bait-the-blow", name: "Bait the Blow", school: "martial", icon: "shield", target: "self", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 3 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 4, effect: { type: "barbarianBaitBlow", fury: 1, exposure: 8, duration: 2, target: "self" }, barbarianFuryBuild: 1, desc: "Provoke the next exchange and gain at most one Fury immediately, while opening a bounded physical gap in your guard. No compulsion or magic is involved." },
  { ...barbarianIdentity, id: "barbarian-fury-hewn-strike", name: "Fury-Hewn Strike", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: BARBARIAN_WEAPONS, statReq: { attr: "body", base: 3 }, dmg: null, damageMult: 1.12, pen: 2, critBonus: 5, resolveCost: 0, cooldown: 2, effect: null, barbarianFuryCost: 1, desc: "Spend one Fury to commit weight and anger to an armour-respecting physical strike." },
  { ...barbarianIdentity, id: "barbarian-reckless-onslaught", name: "Reckless Onslaught", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: BARBARIAN_WEAPONS, statReq: { attr: "reflex", base: 3 }, dmg: null, damageMult: 0.62, hits: 2, pen: 1, critBonus: 4, resolveCost: 0, cooldown: 3, effect: null, selfEffect: { type: "barbarianExposeGuard", value: 8, duration: 2, target: "self" }, barbarianFuryCost: 1, desc: "Spend one Fury on two committed physical blows, then remain briefly exposed. The multi-hit action cannot generate Fury for its attacker." },
  { ...barbarianIdentity, id: "barbarian-savage-reprisal", name: "Savage Reprisal", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: BARBARIAN_WEAPONS, statReq: { attr: "body", base: 4 }, dmg: null, damageMult: 1, pen: 2, critBonus: 7, resolveCost: 0, cooldown: 3, effect: null, barbarianFuryCost: 1, barbarianRecentFuryBonus: 0.25, desc: "Spend one Fury on a physical reprisal. It gains a bounded force bonus only when the Fury came from a recent hostile direct-damage action." },
  { ...barbarianIdentity, id: "barbarian-crashing-advance", name: "Crashing Advance", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: BARBARIAN_WEAPONS, statReq: { attr: "body", base: 4 }, dmg: null, damageMult: 0.95, pen: 2, critBonus: 3, resolveCost: 0, cooldown: 3, effect: null, barbarianFuryCost: 2, barbarianControl: "push", barbarianMovementRequired: true, desc: "Spend two Fury to advance through a physical collision and drive a manageable foe back. Mass, anchoring, and boss scale reduce it to guard disruption." },
  { ...barbarianIdentity, id: "barbarian-armour-crumpler", name: "Armour Crumpler", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: BARBARIAN_WEAPONS, statReq: { attr: "body", base: 4 }, dmg: null, damageMult: 0.92, pen: 1, critBonus: 3, resolveCost: 0, cooldown: 4, effect: null, barbarianFuryCost: 2, barbarianControl: "crumple", desc: "Spend two Fury to batter fastenings and overlaps. It temporarily compromises physical armour instead of bypassing it." },
  { ...barbarianIdentity, id: "barbarian-great-arc", name: "Great Arc", school: "martial", icon: "swords", target: "all-enemies", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: BARBARIAN_WEAPONS, statReq: { attr: "body", base: 5 }, dmg: null, damageMult: 0.62, pen: 1, critBonus: 2, resolveCost: 0, cooldown: 4, effect: null, barbarianFuryCost: 3, desc: "Spend three Fury on one broad physical arc through nearby foes. Armour answers every target separately." },
  { ...barbarianIdentity, id: "barbarian-grit-through", name: "Grit Through", school: "martial", icon: "shield", target: "self", damageType: null, scaling: "none", scaleAttr: "vigor", weaponReq: null, statReq: { attr: "vigor", base: 5 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 5, effect: { type: "barbarianGritThrough", block: 0.08, forcedMoveResist: 2, duration: 2, target: "self" }, barbarianFuryCost: 3, desc: "Spend three Fury to brace through pain and forced movement. It grants bounded physical protection and anchoring, never healing or regeneration." },
  { ...barbarianIdentity, id: "barbarian-ruinous-collision", name: "Ruinous Collision", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: BARBARIAN_WEAPONS, statReq: { attr: "body", base: 5 }, dmg: null, damageMult: 1.12, pen: 3, critBonus: 5, resolveCost: 0, cooldown: 4, effect: null, barbarianFuryCost: 3, barbarianControl: "collision", barbarianMovementRequired: true, desc: "Spend three Fury on a full-body collision. Ordinary bodies may be staggered; bosses and massive targets suffer only bounded guard disruption." },
  { ...barbarianIdentity, id: "barbarian-unrelenting-assault", name: "Unrelenting Assault", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: BARBARIAN_WEAPONS, statReq: { attr: "reflex", base: 6 }, dmg: null, damageMult: 0.4, hits: 4, pen: 2, critBonus: 4, resolveCost: 0, cooldown: 5, effect: null, selfEffect: { type: "barbarianExposeGuard", value: 10, duration: 2, target: "self" }, barbarianFuryCost: 4, desc: "Spend four Fury on four armour-respecting contacts and accept a bounded open guard afterward." },
  { ...barbarianIdentity, id: "barbarian-world-shaking-blow", name: "World-Shaking Blow", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: BARBARIAN_WEAPONS, statReq: { attr: "body", base: 7 }, dmg: null, damageMult: 1.5, accuracyBonus: 15, pen: 5, critBonus: 10, resolveCost: 0, cooldown: 6, effect: null, barbarianFuryCost: 5, barbarianControl: "stagger", desc: "Spend five Fury on the Barbarian's apex physical blow. The name is reputation: armour and damage reduction still apply, and great foes cannot be launched or stun-locked." },

  // Barbarian specialization cards. Each is both progression- and branch-owned;
  // no legacy wrath, generic rage, Warrior, Monk, Commander, Bard, or Paladin
  // card stands in for the route's actual technique.
  { ...barbarianIdentity, id: "barbarian-reaver-sweep", name: "Reaver Sweep", school: "martial", icon: "swords", target: "all-enemies", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: BARBARIAN_WEAPONS, statReq: { attr: "body", base: 3 }, dmg: null, damageMult: 0.55, pen: 1, critBonus: 2, resolveCost: 0, cooldown: 3, effect: null, barbarianFuryCost: 1, branchExclusive: true, desc: "Spend one Fury on a rough physical sweep across nearby foes. Each target keeps its own armour mitigation." },
  { ...barbarianIdentity, id: "barbarian-berserker-abandon", name: "Berserker Abandon", school: "martial", icon: "flame", target: "self", damageType: null, scaling: "none", scaleAttr: "vigor", weaponReq: null, statReq: { attr: "vigor", base: 3 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 4, effect: { type: "barbarianAbandon", maxOffence: 35, exposure: 10, duration: 3, target: "self" }, barbarianFuryCost: 1, branchExclusive: true, desc: "Spend one Fury to turn missing health into bounded physical offence while opening the guard. It restores no health and prevents no wound." },
  { ...barbarianIdentity, id: "barbarian-juggernaut-check", name: "Juggernaut Check", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: BARBARIAN_WEAPONS, statReq: { attr: "body", base: 3 }, dmg: null, damageMult: 0.78, pen: 2, critBonus: 2, resolveCost: 0, cooldown: 3, effect: null, barbarianFuryCost: 1, barbarianControl: "push", barbarianMovementRequired: true, branchExclusive: true, desc: "Spend one Fury on a shoulder-and-weapon check. It is a Barbarian collision, not a Warrior guard or Tempo technique." },
  { ...barbarianIdentity, id: "barbarian-clan-challenge", name: "Clan Challenge", school: "martial", icon: "flame", target: "enemy", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 3 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 4, effect: { type: "barbarianChallenge", value: 15, duration: 2, target: "enemy" }, barbarianFuryCost: 1, branchExclusive: true, desc: "Spend one Fury on an audible, visible personal challenge. It pressures an aware foe's choices without charm, compulsion, or forced allegiance." },
  { ...barbarianIdentity, id: "barbarian-blood-trail", name: "Blood Trail", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "wit", weaponReq: BARBARIAN_WEAPONS, statReq: { attr: "wit", base: 4 }, dmg: null, damageMult: 0.95, pen: 2, critBonus: 5, resolveCost: 0, cooldown: 3, effect: null, barbarianFuryCost: 2, barbarianWoundedBonus: 0.25, branchExclusive: true, desc: "Spend two Fury to pursue the physical weakness of an already wounded foe. The bonus remains armour-respecting and creates no bleed damage over time." },
  { ...barbarianIdentity, id: "barbarian-wide-ruin", name: "Wide Ruin", school: "martial", icon: "swords", target: "all-enemies", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: BARBARIAN_WEAPONS, statReq: { attr: "body", base: 4 }, dmg: null, damageMult: 0.62, pen: 2, critBonus: 3, resolveCost: 0, cooldown: 4, effect: null, barbarianFuryCost: 2, branchExclusive: true, desc: "Spend two Fury to carry a destructive physical line through the crowd without defence-ignoring damage." },
  { ...barbarianIdentity, id: "barbarian-pain-eater", name: "Pain Eater", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "vigor", weaponReq: BARBARIAN_WEAPONS, statReq: { attr: "vigor", base: 4 }, dmg: null, damageMult: 0.9, pen: 2, critBonus: 4, resolveCost: 0, cooldown: 4, effect: null, barbarianFuryCost: 2, barbarianPainConversion: 0.5, branchExclusive: true, desc: "Spend two Fury to convert a bounded share of the last Fury-granting direct wound into the next physical hit. It does not heal, negate, defer, or reflect that wound." },
  { ...barbarianIdentity, id: "barbarian-red-haze", name: "Red Haze", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: BARBARIAN_WEAPONS, statReq: { attr: "reflex", base: 4 }, dmg: null, damageMult: 0.45, hits: 3, pen: 1, critBonus: 5, resolveCost: 0, cooldown: 4, effect: null, selfEffect: { type: "barbarianExposeGuard", value: 10, duration: 2, target: "self" }, barbarianFuryCost: 2, branchExclusive: true, desc: "Spend two Fury on three reckless physical contacts, then leave a bounded opening. Multihit never multiplies Fury gain." },
  { ...barbarianIdentity, id: "barbarian-living-ram", name: "Living Ram", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: BARBARIAN_WEAPONS, statReq: { attr: "body", base: 4 }, dmg: null, damageMult: 0.9, pen: 2, critBonus: 3, resolveCost: 0, cooldown: 4, effect: null, barbarianFuryCost: 2, barbarianControl: "collision", barbarianMovementRequired: true, branchExclusive: true, desc: "Spend two Fury on a bodily charge. Terrain, freedom to move, relative mass, anchoring, and boss scale bound the collision." },
  { ...barbarianIdentity, id: "barbarian-mountain-frame", name: "Mountain Frame", school: "martial", icon: "shield", target: "self", damageType: null, scaling: "none", scaleAttr: "vigor", weaponReq: null, statReq: { attr: "vigor", base: 4 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 5, effect: { type: "barbarianMountainFrame", block: 0.12, forcedMoveResist: 3, duration: 3, target: "self" }, barbarianFuryCost: 2, branchExclusive: true, desc: "Spend two Fury to plant a heavy physical brace. It supplies bounded Block and forced-movement resistance, not invulnerability or healing." },
  { ...barbarianIdentity, id: "barbarian-foe-caller", name: "Foe Caller", school: "martial", icon: "flame", target: "all-enemies", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 4 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 5, effect: { type: "barbarianFoeCaller", value: 18, duration: 2, target: "enemy" }, barbarianFuryCost: 2, branchExclusive: true, desc: "Spend two Fury to call nearby aware foes toward a visible threat. It protects by social pressure, never by Commander order, Bard performance, Paladin aura, or mind control." },
  { ...barbarianIdentity, id: "barbarian-war-cry", name: "War Cry", school: "martial", icon: "flame", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 4 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 5, effect: { type: "barbarianWarCry", value: 20, duration: 2, target: "ally" }, barbarianFuryCost: 2, branchExclusive: true, desc: "Spend two Fury on an audible physical cry that steadies conscious, hearing allies and restores bounded morale. It grants no damage rally, order, aura, spell, or allegiance change." },

  // ---- Bard — progression-owned non-spell performance techniques ----
  // Cadence is a 0–4 performance reserve. Only an audible native builder whose
  // motif differs from the Bard's remembered motif can add one Cadence; spending
  // never forgets that motif. Voice, rhythm, harmony, and story are trained
  // performance forms, never arcane, divine, primal, pact, or innate magic.
  { ...bardIdentity, id: "bard-clarion-note", name: "Clarion Note", icon: "flame", target: "enemy", damageType: "sonic", scaling: "performance", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 2 }, dmg: [2, 4], pen: 0, critBonus: 0, cooldown: 1, effect: null, bardMotif: "voice", bardCadenceBuild: 1, desc: "Project one trained note as a sharp pressure wave. It is audible sonic force, not a cantrip or magical evocation." },
  { ...bardIdentity, id: "bard-steady-beat", name: "Steady Beat", icon: "shield", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 2 }, dmg: null, pen: 0, critBonus: 0, cooldown: 3, effect: { type: "bardSteadyBeat", value: 10, duration: 2, target: "ally" }, bardMotif: "rhythm", bardCadenceBuild: 1, desc: "Lay down a clear physical beat that steadies the timing of every conscious ally who can hear it." },
  { ...bardIdentity, id: "bard-cutting-verse", name: "Cutting Verse", icon: "user", target: "enemy", damageType: null, scaling: "none", scaleAttr: "wit", weaponReq: null, statReq: { attr: "wit", base: 3 }, dmg: null, pen: 0, critBonus: 0, cooldown: 3, effect: { type: "bardCuttingVerse", value: 15, duration: 2, target: "enemy" }, bardMotif: "story", bardCadenceBuild: 1, requiresUnderstanding: true, bardRequiresUnderstanding: true, desc: "Expose one foe's mistake in a perfectly timed line. The verbal barb needs shared understanding and cannot compel a mind." },
  { ...bardIdentity, id: "bard-rising-tempo", name: "Rising Tempo", icon: "flame", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 3 }, dmg: null, pen: 0, critBonus: 0, cooldown: 3, effect: { type: "bardRisingTempo", value: 10, duration: 2, target: "ally" }, bardMotif: "rhythm", bardCadenceBuild: 1, desc: "Accelerate an audible beat just enough to sharpen allied movement without granting supernatural speed or extra actions." },
  { ...bardIdentity, id: "bard-dissonant-chord", name: "Dissonant Chord", icon: "flame", target: "enemy", damageType: "sonic", scaling: "performance", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 3 }, dmg: [3, 5], pen: 0, critBonus: 0, cooldown: 2, effect: { type: "bardDissonance", value: 12, duration: 2, target: "enemy" }, bardMotif: "harmony", bardCadenceBuild: 1, desc: "Drive clashing frequencies through one foe, dealing audible sonic harm and briefly spoiling its concentration." },
  { ...bardIdentity, id: "bard-call-and-response", name: "Call-and-Response", icon: "user", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 3 }, dmg: null, pen: 0, critBonus: 0, cooldown: 3, effect: { type: "bardCallResponse", value: 12, duration: 2, target: "ally" }, bardMotif: "voice", bardCadenceBuild: 1, desc: "Give the company a phrase they can answer, restoring coordination through breath, attention, and shared timing." },
  { ...bardIdentity, id: "bard-stinging-refrain", name: "Stinging Refrain", icon: "user", target: "enemy", damageType: null, scaling: "none", scaleAttr: "wit", weaponReq: null, statReq: { attr: "wit", base: 4 }, dmg: null, pen: 0, critBonus: 0, cooldown: 3, effect: { type: "bardStingingRefrain", value: 18, duration: 3, target: "enemy" }, bardMotif: "story", bardCadenceCost: 1, requiresUnderstanding: true, bardRequiresUnderstanding: true, desc: "Spend one Cadence to make a foe's public failure impossible to ignore. It requires understanding and disrupts morale without magic." },
  { ...bardIdentity, id: "bard-crescendo", name: "Crescendo", icon: "flame", target: "all-enemies", damageType: "sonic", scaling: "performance", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 4 }, dmg: [4, 7], pen: 0, critBonus: 0, cooldown: 4, effect: null, bardMotif: "harmony", bardCadenceCost: 2, desc: "Spend two Cadence to swell several audible lines into a broad sonic impact against every nearby foe exposed to the pressure." },
  { ...bardIdentity, id: "bard-syncopated-break", name: "Syncopated Break", icon: "flame", target: "enemy", damageType: "sonic", scaling: "performance", scaleAttr: "wit", weaponReq: null, statReq: { attr: "wit", base: 4 }, dmg: [3, 5], pen: 0, critBonus: 0, cooldown: 4, effect: { type: "bardSyncopation", value: 20, duration: 1, target: "enemy" }, bardMotif: "rhythm", bardCadenceCost: 2, desc: "Spend two Cadence to snap the expected beat, striking with sonic pressure and fouling one foe's next timing window." },
  { ...bardIdentity, id: "bard-heartening-chorus", name: "Heartening Chorus", icon: "heart", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 5 }, dmg: null, pen: 0, critBonus: 0, cooldown: 5, effect: { type: "bardHearteningChorus", value: 20, duration: 3, target: "ally" }, bardMotif: "harmony", bardCadenceCost: 3, desc: "Spend three Cadence on a chorus that braces allied morale. It heals no wound and offers no sacred blessing." },
  { ...bardIdentity, id: "bard-counter-melody", name: "Counter-Melody", icon: "shield", target: "enemy", damageType: null, scaling: "none", scaleAttr: "wit", weaponReq: null, statReq: { attr: "wit", base: 5 }, dmg: null, pen: 0, critBonus: 0, cooldown: 5, effect: { type: "bardCounterMelody", value: 1, duration: 1, target: "enemy" }, bardMotif: "harmony", bardCadenceCost: 3, desc: "Spend three Cadence to answer one audible action with a competing line, disrupting delivery rather than dispelling magic." },
  { ...bardIdentity, id: "bard-grand-finale", name: "Grand Finale", icon: "flame", target: "all-enemies", damageType: "sonic", scaling: "performance", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 7 }, dmg: [7, 11], pen: 0, critBonus: 5, cooldown: 6, effect: { type: "bardGrandFinale", value: 25, duration: 2, target: "enemy" }, bardMotif: "story", bardCadenceCost: 4, desc: "Spend all four Cadence to resolve the performance in a punishing audible finale, damaging and shaking every nearby foe exposed to the pressure without spellcraft." },

  // Bard specialization cards. The four root performances build Cadence; their
  // eight advanced forms each spend two. Every effect remains Bard-owned so no
  // spell, command, aura, rage, or generic rally substitutes for performance.
  { ...bardIdentity, id: "bard-war-drum", name: "War Drum", icon: "flame", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 3 }, dmg: null, pen: 0, critBonus: 0, cooldown: 3, effect: { type: "bardWarDrum", value: 12, duration: 2, target: "ally" }, bardMotif: "rhythm", bardCadenceBuild: 1, branchExclusive: true, desc: "Carry a disciplined battle rhythm across the company, reinforcing physical commitment through shared timing rather than orders." },
  { ...bardIdentity, id: "bard-pointed-satire", name: "Pointed Satire", icon: "user", target: "enemy", damageType: null, scaling: "none", scaleAttr: "wit", weaponReq: null, statReq: { attr: "wit", base: 3 }, dmg: null, pen: 0, critBonus: 0, cooldown: 3, effect: { type: "bardPointedSatire", value: 15, duration: 2, target: "enemy" }, bardMotif: "story", bardCadenceBuild: 1, requiresUnderstanding: true, bardRequiresUnderstanding: true, branchExclusive: true, desc: "Turn a foe's pretensions into a precise public joke. It works only through understood meaning and cannot enchant or dominate." },
  { ...bardIdentity, id: "bard-resonant-pulse", name: "Resonant Pulse", icon: "flame", target: "all-enemies", damageType: "sonic", scaling: "performance", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 3 }, dmg: [3, 5], pen: 0, critBonus: 0, cooldown: 3, effect: null, bardMotif: "harmony", bardCadenceBuild: 1, branchExclusive: true, desc: "Shape voice and instrument into a broad audible pressure pulse that harms nearby foes exposed to it without elemental or magical force." },
  { ...bardIdentity, id: "bard-lore-callout", name: "Lore Callout", icon: "user", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "wit", weaponReq: null, statReq: { attr: "wit", base: 3 }, dmg: null, pen: 0, critBonus: 0, cooldown: 3, effect: { type: "bardLoreCallout", value: 12, duration: 2, target: "ally" }, bardMotif: "story", bardCadenceBuild: 1, branchExclusive: true, desc: "Call out a remembered weakness or precedent so allies can act on knowledge they can hear and understand in the moment." },
  { ...bardIdentity, id: "bard-marching-cadence", name: "Marching Cadence", icon: "shield", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 4 }, dmg: null, pen: 0, critBonus: 0, cooldown: 4, effect: { type: "bardMarchingCadence", value: 15, duration: 3, target: "ally" }, bardMotif: "rhythm", bardCadenceCost: 2, branchExclusive: true, desc: "Spend two Cadence to keep the company moving through pressure with a stable audible marching pattern." },
  { ...bardIdentity, id: "bard-defiant-anthem", name: "Defiant Anthem", icon: "shield", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 4 }, dmg: null, pen: 0, critBonus: 0, cooldown: 5, effect: { type: "bardDefiantAnthem", value: 20, duration: 2, target: "ally" }, bardMotif: "voice", bardCadenceCost: 2, branchExclusive: true, desc: "Spend two Cadence on a forceful anthem that helps hearing allies hold nerve against fear and pressure without divine protection." },
  { ...bardIdentity, id: "bard-hecklers-hook", name: "Heckler's Hook", icon: "user", target: "enemy", damageType: null, scaling: "none", scaleAttr: "wit", weaponReq: null, statReq: { attr: "wit", base: 4 }, dmg: null, pen: 0, critBonus: 0, cooldown: 4, effect: { type: "bardHecklersHook", value: 20, duration: 2, target: "enemy" }, bardMotif: "voice", bardCadenceCost: 2, requiresUnderstanding: true, bardRequiresUnderstanding: true, branchExclusive: true, desc: "Spend two Cadence to bait one understanding foe into answering the wrong insult at the wrong time; allegiance and agency remain intact." },
  { ...bardIdentity, id: "bard-chorus-of-scorn", name: "Chorus of Scorn", icon: "user", target: "all-enemies", damageType: null, scaling: "none", scaleAttr: "wit", weaponReq: null, statReq: { attr: "wit", base: 4 }, dmg: null, pen: 0, critBonus: 0, cooldown: 5, effect: { type: "bardChorusScorn", value: 15, duration: 2, target: "enemy" }, bardMotif: "harmony", bardCadenceCost: 2, requiresUnderstanding: true, bardRequiresUnderstanding: true, branchExclusive: true, desc: "Spend two Cadence to turn shared mockery across the enemy line. Only foes that hear and understand the performance are disrupted." },
  { ...bardIdentity, id: "bard-shattertone", name: "Shattertone", icon: "flame", target: "enemy", damageType: "sonic", scaling: "performance", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 5 }, dmg: [6, 9], pen: 0, critBonus: 5, cooldown: 4, effect: { type: "bardSonicFracture", value: 20, duration: 3, target: "enemy" }, bardMotif: "voice", bardCadenceCost: 2, branchExclusive: true, desc: "Spend two Cadence on a focused pressure tone that deals sonic harm and leaves the target briefly more susceptible to audible force." },
  { ...bardIdentity, id: "bard-harmonic-weave", name: "Harmonic Weave", icon: "flame", target: "all-enemies", damageType: "sonic", scaling: "performance", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 5 }, dmg: [2, 4], hits: 2, pen: 0, critBonus: 0, cooldown: 4, effect: { type: "bardHarmonicWeave", value: 10, duration: 2, target: "enemy" }, bardMotif: "harmony", bardCadenceCost: 2, branchExclusive: true, desc: "Spend two Cadence to cross two audible pressure lines through every foe. The paired hits remain one performance action." },
  { ...bardIdentity, id: "bard-old-ballad", name: "Old Ballad", icon: "heart", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "wit", weaponReq: null, statReq: { attr: "wit", base: 4 }, dmg: null, pen: 0, critBonus: 0, cooldown: 5, effect: { type: "bardOldBallad", value: 15, duration: 3, target: "ally" }, bardMotif: "story", bardCadenceCost: 2, branchExclusive: true, desc: "Spend two Cadence to place present hardship inside an old survival tale, steadying hearing allies without healing their injuries." },
  { ...bardIdentity, id: "bard-battle-chronicle", name: "Battle Chronicle", icon: "user", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "wit", weaponReq: null, statReq: { attr: "wit", base: 5 }, dmg: null, pen: 0, critBonus: 0, cooldown: 5, effect: { type: "bardBattleChronicle", value: 18, duration: 3, target: "ally" }, bardMotif: "story", bardCadenceCost: 2, branchExclusive: true, desc: "Spend two Cadence to narrate the developing fight in useful beats, helping allies exploit what the company has already learned." },

  // ---- Ranger — progression-owned non-spell fieldcraft ----
  // Quarry Insight is a self-side 0–5 reserve bound to one living studied target.
  // A successful native builder may bind a new quarry, clearing the old reserve
  // before its gain. Spenders require that current quarry and pay exactly once
  // for their whole action. Trailcraft, projectiles, traps, and trained animals
  // remain material practice: no card casts, conjures, summons, or spends Resolve.
  { ...rangerIdentity, id: "ranger-quarry-sign", name: "Quarry Sign", icon: "user", target: "enemy", damageType: null, scaling: "none", scaleAttr: "wit", weaponReq: null, statReq: { attr: "wit", base: 2 }, dmg: null, pen: 0, critBonus: 0, cooldown: 1, effect: { type: "rangerQuarrySign", value: 1, target: "enemy" }, rangerQuarryInsightBuild: 2, rangerQuarryBuildTrigger: "setup", requiresLineOfSight: true, desc: "Read visible gait, spoor, equipment, and intent to bind one living quarry. A different quarry clears all prior Insight before this successful setup builds two." },
  { ...rangerIdentity, id: "ranger-ranging-shot", name: "Ranging Shot", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: RANGER_RANGED_WEAPONS, statReq: { attr: "reflex", base: 2 }, dmg: null, damageMult: 0.75, pen: 1, critBonus: 3, cooldown: 1, effect: null, rangerDamageForm: "projectile", rangerQuarryInsightBuild: 1, rangerQuarryBuildTrigger: "hit", desc: "Loose a conservative physical shot to measure distance and response. Only a hit binds the target and builds one Quarry Insight." },
  { ...rangerIdentity, id: "ranger-field-dressing", name: "Field Dressing", icon: "heart", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "wit", weaponReq: null, statReq: { attr: "wit", base: 3 }, dmg: null, pen: 0, critBonus: 0, cooldown: 5, effect: { type: "rangerFieldDressing", stabilize: true, morale: 12, duration: 2, target: "ally" }, desc: "Triage each eligible ally with pressure, binding, splinting, and calm instruction. It stabilizes and restores bounded morale, never health, Resolve, or magical vitality." },
  { ...rangerIdentity, id: "ranger-trail-cut", name: "Trail Cut", icon: "user", target: "enemy", damageType: null, scaling: "none", scaleAttr: "wit", weaponReq: null, statReq: { attr: "wit", base: 3 }, dmg: null, pen: 0, critBonus: 0, cooldown: 3, effect: { type: "rangerTrailCut", value: 20, duration: 2, target: "enemy" }, rangerQuarryInsightBuild: 1, rangerQuarryBuildTrigger: "setup", terrainReq: "trackable route", desc: "Cut across a trackable route to expose or constrain the target's next line. Only a valid terrain setup binds the quarry and builds one Insight." },
  { ...rangerIdentity, id: "ranger-pinpoint-volley", name: "Pinpoint Volley", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: RANGER_RANGED_WEAPONS, statReq: { attr: "reflex", base: 3 }, dmg: null, damageMult: 0.38, hits: 3, pen: 1, critBonus: 4, cooldown: 3, effect: null, rangerDamageForm: "projectile", rangerQuarryInsightCost: 2, rangerRequiresCurrentQuarry: true, rangerQuarrySpendOnce: true, desc: "Spend two Insight once to place three light physical projectiles through openings in the current quarry's movement. Armour answers every hit." },
  { ...rangerIdentity, id: "ranger-evading-step", name: "Evading Step", icon: "shield", target: "self", damageType: null, scaling: "none", scaleAttr: "reflex", weaponReq: null, statReq: { attr: "reflex", base: 4 }, dmg: null, pen: 0, critBonus: 0, cooldown: 4, effect: { type: "rangerEvadingStep", value: 30, duration: 2, target: "self" }, terrainReq: "room to reposition", desc: "Use visible footing and cover to leave the expected line and gain brief physical evasion. It is movement, not teleportation or concealment magic." },
  { ...rangerIdentity, id: "ranger-crippling-shot", name: "Crippling Shot", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "wit", weaponReq: RANGER_RANGED_WEAPONS, statReq: { attr: "wit", base: 4 }, dmg: null, damageMult: 0.75, pen: 2, critBonus: 5, cooldown: 3, effect: { type: "rangerCripplingShot", value: 25, duration: 2, target: "enemy" }, rangerDamageForm: "piercing", rangerQuarryInsightCost: 2, rangerRequiresCurrentQuarry: true, rangerQuarrySpendOnce: true, desc: "Spend two Insight once to place an armour-respecting projectile against a known weight-bearing line, applying bounded mobility pressure without automatic maiming." },
  { ...rangerIdentity, id: "ranger-pursuit-line", name: "Pursuit Line", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: RANGER_RANGED_WEAPONS, statReq: { attr: "vigor", base: 4 }, dmg: null, damageMult: 0.9, pen: 2, critBonus: 4, cooldown: 3, effect: { type: "rangerPursuitLine", value: 20, duration: 2, target: "enemy" }, rangerDamageForm: "projectile", rangerQuarryInsightBuild: 1, rangerQuarryBuildTrigger: "hit", desc: "Loose along the target's most likely escape line. Only a successful physical hit binds the quarry and builds one Insight." },
  { ...rangerIdentity, id: "ranger-covering-shot", name: "Covering Shot", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "wit", weaponReq: RANGER_RANGED_WEAPONS, statReq: { attr: "wit", base: 5 }, dmg: null, damageMult: 0.65, pen: 1, critBonus: 3, cooldown: 4, effect: { type: "rangerCoveringShot", value: 20, duration: 2, target: "enemy" }, rangerDamageForm: "projectile", rangerQuarryInsightCost: 2, rangerRequiresCurrentQuarry: true, rangerQuarrySpendOnce: true, desc: "Spend two Insight once on a physical shot that punishes the current quarry for pressing a nearby ally, creating cover through threat rather than command or warding." },
  { ...rangerIdentity, id: "ranger-kill-window", name: "Kill Window", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "wit", weaponReq: RANGER_RANGED_WEAPONS, statReq: { attr: "wit", base: 5 }, dmg: null, damageMult: 1.35, accuracyBonus: 20, pen: 5, critBonus: 10, cooldown: 5, effect: null, rangerDamageForm: "piercing", rangerQuarryInsightCost: 3, rangerRequiresCurrentQuarry: true, rangerQuarrySpendOnce: true, desc: "Spend three Insight once on the brief physical opening the current quarry actually revealed. It remains a dodgeable, armour-respecting projectile, not an execution effect." },
  { ...rangerIdentity, id: "ranger-relentless-trail", name: "Relentless Trail", icon: "user", target: "enemy", damageType: null, scaling: "none", scaleAttr: "vigor", weaponReq: null, statReq: { attr: "vigor", base: 6 }, dmg: null, pen: 0, critBonus: 0, cooldown: 5, effect: { type: "rangerRelentlessTrail", value: 1, duration: 3, target: "enemy" }, rangerRequiresCurrentQuarry: true, terrainReq: "observable trail", desc: "Maintain contact with the current living quarry through tracks, disturbed cover, and observed choices. It preserves pursuit without creating or spending Insight." },
  { ...rangerIdentity, id: "ranger-perfect-hunt", name: "Perfect Hunt", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "wit", weaponReq: RANGER_RANGED_WEAPONS, statReq: { attr: "wit", base: 7 }, dmg: null, damageMult: 1.65, accuracyBonus: 25, pen: 7, critBonus: 15, cooldown: 6, effect: null, rangerDamageForm: "piercing", rangerQuarryInsightCost: 5, rangerRequiresCurrentQuarry: true, rangerQuarrySpendOnce: true, desc: "Spend all five Insight once on the Ranger's apex physical shot. Preparation improves placement, never bypasses armour, immunity, anatomy, range, or boss scale." },

  // Ranger specialization cards. The four root practices build Insight only on
  // successful setup or a trained companion's actual hit; every advanced route
  // spends two once. Beast fieldcraft directs an ally already present in the
  // fight and can never manufacture, summon, conjure, or dominate an animal.
  { ...rangerIdentity, id: "ranger-patient-aim", name: "Patient Aim", icon: "user", target: "enemy", damageType: null, scaling: "none", scaleAttr: "wit", weaponReq: RANGER_RANGED_WEAPONS, statReq: { attr: "wit", base: 3 }, dmg: null, pen: 0, critBonus: 0, cooldown: 3, effect: { type: "rangerPatientAim", value: 25, duration: 2, target: "enemy" }, rangerQuarryInsightBuild: 1, rangerQuarryBuildTrigger: "setup", requiresLineOfSight: true, branchExclusive: true, desc: "Hold a real sightline long enough to study one target's rhythm. Only a completed visible setup binds that quarry and builds one Insight." },
  { ...rangerIdentity, id: "ranger-pathfinder-step", name: "Pathfinder Step", icon: "user", target: "enemy", damageType: null, scaling: "none", scaleAttr: "reflex", weaponReq: null, statReq: { attr: "reflex", base: 3 }, dmg: null, pen: 0, critBonus: 0, cooldown: 3, effect: { type: "rangerPathfinderStep", value: 20, duration: 2, target: "enemy" }, rangerQuarryInsightBuild: 1, rangerQuarryBuildTrigger: "setup", terrainReq: "traversable approach", branchExclusive: true, desc: "Choose a traversable approach that closes or crosses one target's route. Only a valid physical path setup binds the quarry and builds one Insight." },
  { ...rangerIdentity, id: "ranger-companion-signal", name: "Companion Signal", icon: "user", target: "enemy", damageType: null, scaling: "none", scaleAttr: "wit", weaponReq: null, statReq: { attr: "wit", base: 3 }, dmg: null, pen: 0, critBonus: 0, cooldown: 3, effect: { type: "rangerCompanionSignal", value: 1, target: "enemy" }, rangerQuarryInsightBuild: 1, rangerQuarryBuildTrigger: "companion-hit", requiresTrainedBeastAlly: true, requiresBeastPerception: true, audible: true, branchExclusive: true, desc: "Give an audible trained cue to a living beast ally already present. Only that ally's successful mundane attack binds the target and builds one Insight; nothing is summoned." },
  { ...rangerIdentity, id: "ranger-set-snare", name: "Set Snare", icon: "shield", target: "enemy", damageType: null, scaling: "none", scaleAttr: "wit", weaponReq: null, statReq: { attr: "wit", base: 3 }, dmg: null, pen: 0, critBonus: 0, cooldown: 4, effect: { type: "rangerSetSnare", value: 20, duration: 2, target: "enemy" }, rangerQuarryInsightBuild: 1, rangerQuarryBuildTrigger: "setup", terrainReq: "anchorable ground", branchExclusive: true, desc: "Place a material restraint along one target's usable route. Only a valid physical setup binds the quarry and builds one Insight; unsuitable terrain defeats it." },
  { ...rangerIdentity, id: "ranger-read-monster", name: "Read Monster", icon: "user", target: "enemy", damageType: null, scaling: "none", scaleAttr: "wit", weaponReq: null, statReq: { attr: "wit", base: 4 }, dmg: null, pen: 0, critBonus: 0, cooldown: 4, effect: { type: "rangerReadMonster", value: 20, duration: 3, target: "enemy" }, rangerQuarryInsightCost: 2, rangerRequiresCurrentQuarry: true, rangerQuarrySpendOnce: true, branchExclusive: true, desc: "Spend two Insight once to turn observed anatomy and behavior into a bounded advantage against the current quarry. Unknown traits remain unknown." },
  { ...rangerIdentity, id: "ranger-deadeye-breath", name: "Deadeye Breath", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "wit", weaponReq: RANGER_RANGED_WEAPONS, statReq: { attr: "wit", base: 4 }, dmg: null, damageMult: 1.2, accuracyBonus: 35, pen: 5, critBonus: 15, cooldown: 4, effect: null, rangerDamageForm: "piercing", rangerQuarryInsightCost: 2, rangerRequiresCurrentQuarry: true, rangerQuarrySpendOnce: true, branchExclusive: true, desc: "Spend two Insight once, settle breath, and loose one highly accurate physical projectile through a known opening. Movement, cover, and armour still answer it." },
  { ...rangerIdentity, id: "ranger-safe-passage", name: "Safe Passage", icon: "shield", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "vigor", weaponReq: null, statReq: { attr: "vigor", base: 4 }, dmg: null, pen: 0, critBonus: 0, cooldown: 5, effect: { type: "rangerSafePassage", value: 25, duration: 3, target: "ally" }, rangerQuarryInsightCost: 2, rangerRequiresCurrentQuarry: true, rangerQuarrySpendOnce: true, terrainReq: "usable cover or route", branchExclusive: true, desc: "Spend two Insight once to guide allies through terrain the current quarry is prepared to threaten. It grants bounded route protection, not a ward or invulnerability." },
  { ...rangerIdentity, id: "ranger-running-shot", name: "Running Shot", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: RANGER_RANGED_WEAPONS, statReq: { attr: "reflex", base: 4 }, dmg: null, damageMult: 0.75, pen: 1, critBonus: 5, cooldown: 3, effect: { type: "rangerRunningShot", value: 25, duration: 2, target: "self" }, rangerDamageForm: "projectile", rangerQuarryInsightCost: 2, rangerRequiresCurrentQuarry: true, rangerQuarrySpendOnce: true, terrainReq: "room to move", branchExclusive: true, desc: "Spend two Insight once to loose while crossing the current quarry's expected line, dealing reduced physical damage and retaining bounded evasion." },
  { ...rangerIdentity, id: "ranger-pack-command", name: "Pack Command", icon: "swords", target: "enemy", damageType: "physical", scaling: "fieldcraft", scaleAttr: "wit", weaponReq: null, statReq: { attr: "wit", base: 4 }, dmg: [4, 7], pen: 1, critBonus: 3, cooldown: 4, effect: { type: "rangerPackCommand", value: 15, duration: 2, target: "enemy" }, rangerDamageForm: "impact", rangerQuarryInsightCost: 2, rangerRequiresCurrentQuarry: true, rangerQuarrySpendOnce: true, requiresTrainedBeastAlly: true, branchExclusive: true, desc: "Spend two Insight once to direct an already-present trained beast ally through the current quarry's opening. The ally supplies ordinary physical force; none is summoned or compelled." },
  { ...rangerIdentity, id: "ranger-falcon-stoop", name: "Falcon Stoop", icon: "swords", target: "enemy", damageType: "physical", scaling: "fieldcraft", scaleAttr: "wit", weaponReq: null, statReq: { attr: "wit", base: 4 }, dmg: [5, 8], pen: 2, critBonus: 8, cooldown: 4, effect: { type: "rangerFalconStoop", value: 20, duration: 2, target: "enemy" }, rangerDamageForm: "piercing", rangerQuarryInsightCost: 2, rangerRequiresCurrentQuarry: true, rangerQuarrySpendOnce: true, requiresTrainedBeastAlly: true, requiresFlyingBeastAlly: true, branchExclusive: true, desc: "Spend two Insight once to cue an already-present trained flying beast into a physical stoop through the current quarry's exposed line. It never conjures an animal." },
  { ...rangerIdentity, id: "ranger-layered-snare", name: "Layered Snare", icon: "swords", target: "enemy", damageType: "physical", scaling: "fieldcraft", scaleAttr: "wit", weaponReq: null, statReq: { attr: "wit", base: 4 }, dmg: [3, 5], pen: 0, critBonus: 0, cooldown: 4, effect: { type: "rangerLayeredSnare", value: 25, duration: 2, target: "enemy" }, rangerDamageForm: "impact", rangerQuarryInsightCost: 2, rangerRequiresCurrentQuarry: true, rangerQuarrySpendOnce: true, terrainReq: "multiple anchor points", branchExclusive: true, desc: "Spend two Insight once to close overlapping material restraints around the current quarry. Physical damage and hindrance depend on usable anchors, mass, and anatomy." },
  { ...rangerIdentity, id: "ranger-kill-zone", name: "Kill Zone", icon: "swords", target: "all-enemies", damageType: "physical", scaling: "fieldcraft", scaleAttr: "wit", weaponReq: RANGER_RANGED_WEAPONS, statReq: { attr: "wit", base: 5 }, dmg: [4, 7], pen: 2, critBonus: 5, cooldown: 5, effect: { type: "rangerKillZone", value: 15, duration: 2, target: "enemy" }, rangerDamageForm: "projectile", rangerQuarryInsightCost: 2, rangerRequiresCurrentQuarry: true, rangerQuarrySpendOnce: true, terrainReq: "prepared firing lanes", branchExclusive: true, desc: "Spend two Insight once to use the current quarry's studied route as the anchor for a prepared physical firing zone. Every foe keeps its own cover and armour." },

  // ---- Rogue — progression-owned non-spell subterfuge ----
  // An Opportunity Window is a two-turn weakness stored on one target and keyed to the
  // Rogue who created it. A successful builder replaces only that Rogue's prior
  // opening on the target; an exploit requires and consumes it once for the
  // whole action. Positioning, deception, tools, toxins, and weapon precision
  // remain physical practice—never spellcraft, invisibility, or borrowed tempo.
  { ...rogueIdentity, id: "rogue-assess-mark", name: "Assess Mark", icon: "user", target: "enemy", damageType: null, scaling: "none", scaleAttr: "wit", weaponReq: null, statReq: { attr: "wit", base: 2 }, dmg: null, pen: 0, critBonus: 0, cooldown: 1, effect: { type: "rogueAssessMark", value: 20, duration: 2, target: "enemy" }, rogueOpeningBuild: true, rogueOpeningDuration: 2, rogueOpeningBuildTrigger: "setup", requiresLineOfSight: true, desc: "Observe one visible target's guard, attention, carried load, and escape habits. A successful assessment creates your two-turn Opportunity Window without marking it by magic." },
  { ...rogueIdentity, id: "rogue-testing-cut", name: "Testing Cut", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: ROGUE_CLOSE_WEAPONS, statReq: { attr: "reflex", base: 2 }, dmg: null, damageMult: 0.7, pen: 1, critBonus: 4, cooldown: 1, effect: null, rogueOpeningBuild: true, rogueOpeningDuration: 2, rogueOpeningBuildTrigger: "hit", desc: "Make a light armour-respecting cut to test the response. Only a hit creates your two-turn Opportunity Window on that target." },
  { ...rogueIdentity, id: "rogue-slip-the-line", name: "Slip the Line", icon: "shield", target: "self", damageType: null, scaling: "none", scaleAttr: "reflex", weaponReq: null, statReq: { attr: "reflex", base: 3 }, dmg: null, pen: 0, critBonus: 0, cooldown: 3, effect: { type: "rogueSlipLine", value: 25, duration: 2, target: "self" }, terrainReq: "room to reposition", desc: "Cross an ordinary sight or attack line using timing and footing. It is physical repositioning, not teleportation, invisibility, or an Opportunity Window interaction." },
  { ...rogueIdentity, id: "rogue-false-opening", name: "False Opening", icon: "user", target: "enemy", damageType: null, scaling: "none", scaleAttr: "wit", weaponReq: null, statReq: { attr: "wit", base: 3 }, dmg: null, pen: 0, critBonus: 0, cooldown: 3, effect: { type: "rogueFalseOpening", value: 15, duration: 2, target: "enemy" }, rogueOpeningBuild: true, rogueOpeningDuration: 2, rogueOpeningBuildTrigger: "setup", requiresAwareness: true, desc: "Offer one believable physical mistake to an aware target. Only a successful reaction creates your two-turn Opportunity Window; no charm or compulsion is involved." },
  { ...rogueIdentity, id: "rogue-exploit-guard", name: "Exploit Guard", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "wit", weaponReq: ROGUE_WEAPONS, statReq: { attr: "wit", base: 3 }, dmg: null, damageMult: 0.9, pen: 5, critBonus: 6, cooldown: 2, effect: { type: "rogueExploitGuard", value: 15, duration: 2, target: "enemy" }, rogueOpeningExploit: true, rogueRequiresOpening: true, desc: "Consume your Opportunity Window to place one physical weapon strike through the guard gap that produced it. Armour and active defence still apply." },
  { ...rogueIdentity, id: "rogue-sap-blow", name: "Sap Blow", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "wit", weaponReq: ROGUE_SAP_WEAPONS, statReq: { attr: "wit", base: 3 }, dmg: null, damageMult: 0.65, pen: 1, critBonus: 3, cooldown: 3, effect: { type: "rogueSapBlow", value: 25, duration: 1, nonlethal: true, target: "enemy" }, rogueOpeningExploit: true, rogueRequiresOpening: true, toolReq: "sap, pommel, or weighted blunt surface", desc: "Consume your Opportunity Window on one bounded blunt strike meant to disrupt rather than kill. Helmets, anatomy, mass, and boss scale constrain it." },
  { ...rogueIdentity, id: "rogue-concealed-shift", name: "Concealed Shift", icon: "user", target: "enemy", damageType: null, scaling: "none", scaleAttr: "reflex", weaponReq: null, statReq: { attr: "reflex", base: 4 }, dmg: null, pen: 0, critBonus: 0, cooldown: 3, effect: { type: "rogueConcealedShift", value: 25, duration: 2, target: "enemy" }, rogueOpeningBuild: true, rogueOpeningDuration: 2, rogueOpeningBuildTrigger: "setup", requiresCover: true, desc: "Use real cover and the target's attention cycle to change angle. Success creates your Opportunity Window; the Rogue remains physically present and never becomes invisible." },
  { ...rogueIdentity, id: "rogue-hamstring", name: "Hamstring", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "wit", weaponReq: ROGUE_WEAPONS, statReq: { attr: "wit", base: 4 }, dmg: null, damageMult: 0.75, pen: 2, critBonus: 5, cooldown: 3, effect: { type: "rogueHamstring", value: 25, duration: 2, target: "enemy" }, rogueOpeningExploit: true, rogueRequiresOpening: true, requiresLivingAnatomy: true, desc: "Consume your Opportunity Window on a physical strike against a known locomotion line. Armour, anatomy, size, and immunity bound the mobility pressure." },
  { ...rogueIdentity, id: "rogue-switchback-feint", name: "Switchback Feint", icon: "user", target: "enemy", damageType: null, scaling: "none", scaleAttr: "reflex", weaponReq: null, statReq: { attr: "reflex", base: 4 }, dmg: null, pen: 0, critBonus: 0, cooldown: 3, effect: { type: "rogueSwitchbackFeint", value: 20, duration: 2, target: "enemy" }, rogueOpeningBuild: true, rogueOpeningDuration: 2, rogueOpeningBuildTrigger: "setup", requiresAwareness: true, terrainReq: "room to reverse direction", desc: "Reverse an ordinary approach after an aware target commits to it. A successful read creates your two-turn Opportunity Window without supernatural speed." },
  { ...rogueIdentity, id: "rogue-kidney-shot", name: "Kidney Shot", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "wit", weaponReq: ROGUE_CLOSE_WEAPONS, statReq: { attr: "wit", base: 5 }, dmg: null, damageMult: 0.8, pen: 2, critBonus: 6, cooldown: 4, effect: { type: "rogueKidneyShot", value: 20, duration: 1, target: "enemy" }, rogueOpeningExploit: true, rogueRequiresOpening: true, requiresLivingAnatomy: true, desc: "Consume your Opportunity Window on a close physical strike to a vulnerable body line. It causes bounded disruption, never an automatic stun or anatomy-ignoring effect." },
  { ...rogueIdentity, id: "rogue-finishing-angle", name: "Finishing Angle", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "wit", weaponReq: ROGUE_WEAPONS, statReq: { attr: "wit", base: 6 }, dmg: null, damageMult: 1.25, pen: 4, critBonus: 10, cooldown: 4, effect: { type: "rogueFinishingAngle", value: 20, duration: 1, target: "enemy" }, rogueOpeningExploit: true, rogueRequiresOpening: true, desc: "Consume your Opportunity Window on one heavy precision strike from the known angle. The name promises intent, not execution: armour, dodge, and damage reduction remain." },
  { ...rogueIdentity, id: "rogue-perfect-opportunity", name: "Perfect Opportunity", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: ROGUE_WEAPONS, statReq: { attr: "reflex", base: 7 }, dmg: null, damageMult: 0.45, hits: 3, pen: 2, critBonus: 10, cooldown: 6, effect: null, rogueOpeningExploit: true, rogueRequiresOpening: true, desc: "Consume your Opportunity Window once on three rapid armour-respecting weapon contacts. The apex sequence is never true damage and cannot consume the same Opportunity Window per hit." },

  // Rogue specialization cards. Root practices create personal target-bound
  // Opportunity Windows; advanced cards consume them. Social pressure stays voluntary and
  // soft, cover stays physical, toxins stay bounded, and sabotage requires an
  // accessible ordinary fault rather than borrowed craft or landscape power.
  { ...rogueIdentity, id: "rogue-silent-entry", name: "Silent Entry", icon: "user", target: "enemy", damageType: null, scaling: "none", scaleAttr: "reflex", weaponReq: null, statReq: { attr: "reflex", base: 3 }, dmg: null, pen: 0, critBonus: 0, cooldown: 3, effect: { type: "rogueSilentEntry", value: 25, duration: 2, target: "enemy" }, rogueOpeningBuild: true, rogueOpeningDuration: 2, rogueOpeningBuildTrigger: "setup", requiresCover: true, branchExclusive: true, desc: "Cross real cover with controlled noise and timing until the target exposes an angle. Success creates your Opportunity Window without invisibility or teleportation." },
  { ...rogueIdentity, id: "rogue-brazen-feint", name: "Brazen Feint", icon: "user", target: "enemy", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 3 }, dmg: null, pen: 0, critBonus: 0, cooldown: 3, effect: { type: "rogueBrazenFeint", attention: 15, morale: 8, duration: 2, target: "enemy" }, rogueOpeningBuild: true, rogueOpeningDuration: 2, rogueOpeningBuildTrigger: "setup", audible: true, requiresAwareness: true, requiresUnderstanding: true, branchExclusive: true, desc: "Make an obvious understood boast or challenge so an aware target watches the wrong commitment. Success creates your Opportunity Window through ordinary attention, never compulsion." },
  { ...rogueIdentity, id: "rogue-killing-measure", name: "Killing Measure", icon: "user", target: "enemy", damageType: null, scaling: "none", scaleAttr: "wit", weaponReq: null, statReq: { attr: "wit", base: 3 }, dmg: null, pen: 0, critBonus: 0, cooldown: 3, effect: { type: "rogueKillingMeasure", value: 25, duration: 2, target: "enemy" }, rogueOpeningBuild: true, rogueOpeningDuration: 2, rogueOpeningBuildTrigger: "setup", requiresLineOfSight: true, branchExclusive: true, desc: "Measure one visible target's protection, reach, and recovery before committing. A completed mundane study creates your two-turn Opportunity Window." },
  { ...rogueIdentity, id: "rogue-fault-finder", name: "Fault Finder", icon: "user", target: "enemy", damageType: null, scaling: "none", scaleAttr: "wit", weaponReq: null, statReq: { attr: "wit", base: 3 }, dmg: null, pen: 0, critBonus: 0, cooldown: 3, effect: { type: "rogueFaultFinder", value: 20, duration: 2, target: "enemy" }, rogueOpeningBuild: true, rogueOpeningDuration: 2, rogueOpeningBuildTrigger: "setup", requiresAccessibleFault: true, branchExclusive: true, desc: "Inspect an accessible fastening, carried device, support, or footing flaw tied to one target. Only a real ordinary fault creates your Opportunity Window." },
  { ...rogueIdentity, id: "rogue-high-window", name: "High Window", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: ROGUE_WEAPONS, statReq: { attr: "reflex", base: 4 }, dmg: null, damageMult: 1.1, accuracyBonus: 20, pen: 4, critBonus: 8, cooldown: 4, effect: { type: "rogueHighWindow", value: 20, duration: 2, target: "enemy" }, rogueOpeningExploit: true, rogueRequiresOpening: true, terrainReq: "elevated or flanking approach", branchExclusive: true, desc: "Consume your Opportunity Window on one physical strike from an actual elevated or flanking approach. A missing route defeats it; no wall-running or flight is implied." },
  { ...rogueIdentity, id: "rogue-crowd-ghost", name: "Crowd Ghost", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: ROGUE_CLOSE_WEAPONS, statReq: { attr: "reflex", base: 4 }, dmg: null, damageMult: 0.8, pen: 2, critBonus: 6, cooldown: 4, effect: null, selfEffect: { type: "rogueCrowdGhost", value: 30, duration: 2, target: "self" }, rogueOpeningExploit: true, rogueRequiresOpening: true, requiresCrowdOrCover: true, branchExclusive: true, desc: "Consume your Opportunity Window on one close physical strike, then move behind real bodies or cover. The Rogue remains visible wherever no obstruction exists." },
  { ...rogueIdentity, id: "rogue-confidence-play", name: "Confidence Play", icon: "user", target: "enemy", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 4 }, dmg: null, pen: 0, critBonus: 0, cooldown: 4, effect: { type: "rogueConfidencePlay", attention: 20, morale: 10, duration: 2, target: "enemy" }, rogueOpeningExploit: true, rogueRequiresOpening: true, audible: true, requiresAwareness: true, requiresUnderstanding: true, branchExclusive: true, desc: "Consume your Opportunity Window with a plausible understood claim that redirects attention and applies bounded morale pressure. It never charms, compels, or changes allegiance." },
  { ...rogueIdentity, id: "rogue-dirty-trick", name: "Dirty Trick", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "wit", weaponReq: ROGUE_CLOSE_WEAPONS, statReq: { attr: "wit", base: 4 }, dmg: null, damageMult: 0.75, pen: 1, critBonus: 5, cooldown: 4, effect: { type: "rogueDirtyTrick", value: 20, duration: 1, target: "enemy" }, rogueOpeningExploit: true, rogueRequiresOpening: true, toolReq: "carried mundane trick or usable debris", branchExclusive: true, desc: "Consume your Opportunity Window on a close physical strike paired with a carried mundane trick or nearby debris. It causes bounded disruption, never generic hard control." },
  { ...rogueIdentity, id: "rogue-first-strike", name: "First Strike", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "reflex", weaponReq: ROGUE_WEAPONS, statReq: { attr: "reflex", base: 4 }, dmg: null, damageMult: 0.95, accuracyBonus: 20, pen: 3, critBonus: 10, cooldown: 4, effect: { type: "rogueFirstStrike", value: 20, duration: 1, target: "enemy" }, rogueOpeningExploit: true, rogueRequiresOpening: true, requiresUnactedTarget: true, branchExclusive: true, desc: "Consume your Opportunity Window before the target completes its first committed action, making one fast physical weapon strike. It grants no extra turn." },
  { ...rogueIdentity, id: "rogue-venom-work", name: "Venom Work", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "wit", weaponReq: ROGUE_WEAPONS, statReq: { attr: "wit", base: 4 }, dmg: null, damageMult: 0.7, pen: 1, critBonus: 4, cooldown: 4, effect: { type: "rogueVenomWork", value: 2, duration: 3, maxStacks: 2, lethal: false, target: "enemy" }, rogueOpeningExploit: true, rogueRequiresOpening: true, roguePhysicalToxin: true, requiresCarriedPhysicalToxin: true, branchExclusive: true, desc: "Consume your Opportunity Window to deliver a carried mundane toxin through one physical wound. Dose, anatomy, immunity, and two bounded stacks prevent instant death." },
  { ...rogueIdentity, id: "rogue-master-key", name: "Master Key", icon: "user", target: "enemy", damageType: null, scaling: "none", scaleAttr: "wit", weaponReq: null, statReq: { attr: "wit", base: 4 }, dmg: null, pen: 0, critBonus: 0, cooldown: 4, effect: { type: "rogueMasterKey", value: 20, duration: 2, target: "enemy" }, rogueOpeningExploit: true, rogueRequiresOpening: true, requiresAccessibleEquipment: true, toolReq: "lockpicks or suitable hand tools", branchExclusive: true, desc: "Consume your Opportunity Window to defeat a known accessible equipment, fastening, lock, or access fault. It cannot unlock by magic or invent a weakness." },
  { ...rogueIdentity, id: "rogue-planned-collapse", name: "Planned Collapse", icon: "user", target: "enemy", damageType: null, scaling: "none", scaleAttr: "wit", weaponReq: null, statReq: { attr: "wit", base: 5 }, dmg: null, pen: 0, critBonus: 0, cooldown: 5, effect: { type: "roguePlannedCollapse", value: 20, duration: 2, bossScale: 0.35, terrainDestruction: false, target: "enemy" }, rogueOpeningExploit: true, rogueRequiresOpening: true, requiresAssessedStructure: true, terrainReq: "assessed ordinary structure or footing", branchExclusive: true, desc: "Consume your Opportunity Window to release a previously assessed ordinary support or footing fault near one target. Bosses soften it, and it never becomes construction craft or terrain-scale destruction." },

  // ---- Paladin — progression-owned non-spell oathcraft ----
  // Conviction is evidence of a kept oath, not a free card reward. Oathguard
  // earns it only after hostile damage is actually intercepted for an ally;
  // Stand Fast earns it only after a real hit consumes physical Block. Every
  // spender commits its cost once for the action, including a missed strike.
  { ...paladinIdentity, id: "paladin-oathguard", name: "Oathguard", icon: "shield", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "vigor", weaponReq: null, statReq: { attr: "vigor", base: 2 }, dmg: null, pen: 0, critBonus: 0, cooldown: 2, effect: { type: "paladinOathguard", share: 0.30, cap: 0.15, duration: 3, physicalInterception: true, target: "ally" }, paladinConvictionOnIntercept: 1, requiresInterceptionLine: true, desc: "Take a reachable line between hostile force and every guarded ally. Intercept thirty percent of eligible damage, capped at fifteen percent of your maximum health per ally hit; only damage actually taken in their place earns Conviction." },
  { ...paladinIdentity, id: "paladin-vowed-strike", name: "Vowed Strike", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: PALADIN_WEAPONS, statReq: { attr: "body", base: 2 }, dmg: null, damageMult: 0.8, pen: 1, critBonus: 3, cooldown: 1, effect: null, desc: "Deliver a disciplined armour-respecting weapon strike in service of the declared oath. It spends no Conviction and carries no spell or radiant rider." },
  { ...paladinIdentity, id: "paladin-stand-fast", name: "Stand Fast", icon: "shield", target: "self", damageType: null, scaling: "none", scaleAttr: "vigor", weaponReq: null, statReq: { attr: "vigor", base: 3 }, dmg: null, pen: 0, critBonus: 0, cooldown: 3, effect: { type: "paladinStandFast", block: 10, physicalOnly: true, duration: 2, target: "self" }, paladinConvictionOnAbsorb: 1, requiresDefensiblePosition: true, desc: "Set body, armour, and footing for ten bounded physical Block. Conviction is earned only when a real hostile hit is actually absorbed, never from merely taking the stance." },
  { ...paladinIdentity, id: "paladin-challenge-of-witness", name: "Challenge of Witness", icon: "user", target: "enemy", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 3 }, dmg: null, pen: 0, critBonus: 0, cooldown: 3, effect: { type: "paladinWitnessChallenge", attention: 15, pressure: 10, soft: true, duration: 2, target: "enemy" }, audible: true, requiresAwareness: true, requiresUnderstanding: true, desc: "State the witnessed conduct before an aware foe who can hear and understand. It applies bounded attention and social pressure only; obedience, allegiance, and choice remain their own." },
  { ...paladinIdentity, id: "paladin-bear-the-blow", name: "Bear the Blow", icon: "shield", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "vigor", weaponReq: null, statReq: { attr: "vigor", base: 4 }, dmg: null, pen: 0, critBonus: 0, cooldown: 3, effect: { type: "paladinBearTheBlow", share: 0.40, cap: 0.18, duration: 2, physicalInterception: true, target: "ally" }, paladinConvictionCost: 1, paladinConvictionCommitSpend: true, requiresInterceptionLine: true, desc: "Commit one Conviction to intercept forty percent of eligible ally damage for two turns, capped at eighteen percent of your maximum health per ally hit. It redirects harm rather than erasing it." },
  { ...paladinIdentity, id: "paladin-steadfast-word", name: "Steadfast Word", icon: "flame", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 4 }, dmg: null, pen: 0, critBonus: 0, cooldown: 4, effect: { type: "paladinSteadfastWord", morale: 15, fearSteadiness: 25, duration: 2, target: "ally" }, audible: true, requiresWillingHearingAllies: true, desc: "Give willing allies who can hear and understand a steadying oath. It supports morale and resistance to fear for two turns without restoring health or forcing courage." },
  { ...paladinIdentity, id: "paladin-judgment-stroke", name: "Judgment Stroke", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "presence", weaponReq: PALADIN_WEAPONS, statReq: { attr: "presence", base: 4 }, dmg: null, damageMult: 0.95, pen: 2, critBonus: 5, cooldown: 3, effect: { type: "paladinJudgmentStroke", pressure: 15, soft: true, duration: 2, target: "enemy" }, paladinConvictionCost: 2, paladinConvictionCommitSpend: true, desc: "Commit two Conviction before one armour-respecting weapon strike. Its witnessed resolve adds bounded morale pressure but never compels submission or changes allegiance." },
  { ...paladinIdentity, id: "paladin-hold-the-line", name: "Hold the Line", icon: "shield", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "body", weaponReq: null, statReq: { attr: "body", base: 5 }, dmg: null, pen: 0, critBonus: 0, cooldown: 4, effect: { type: "paladinHoldTheLine", block: 12, physicalOnly: true, forcedMoveResistance: 25, duration: 2, target: "ally" }, paladinConvictionCost: 2, paladinConvictionCommitSpend: true, requiresDefensiblePosition: true, desc: "Commit two Conviction to organize a real defensible line, granting bounded physical Block and resistance to forced movement. It cannot make anyone invulnerable." },
  { ...paladinIdentity, id: "paladin-merciful-arrest", name: "Merciful Arrest", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "presence", weaponReq: PALADIN_WEAPONS, statReq: { attr: "presence", base: 5 }, dmg: null, damageMult: 0.7, pen: 1, critBonus: 2, cooldown: 3, effect: { type: "paladinMercifulArrest", pressure: 20, nonlethal: true, soft: true, duration: 1, target: "enemy" }, nonlethal: true, paladinConvictionCost: 2, paladinConvictionCommitSpend: true, desc: "Commit two Conviction before a restrained armour-respecting strike using the haft, flat, bind, or controlled point. It is explicitly nonlethal and applies only soft surrender pressure." },
  { ...paladinIdentity, id: "paladin-oathfire-edge", name: "Oathfire Edge", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "presence", weaponReq: PALADIN_WEAPONS, statReq: { attr: "presence", base: 6 }, dmg: null, damageMult: 0.9, pen: 2, critBonus: 5, cooldown: 4, effect: null, paladinConvictionCost: 3, paladinConvictionCommitSpend: true, paladinRadiantRider: { value: 0.25, cap: 0.08, respectsWard: true }, profaneOnly: true, desc: "Commit three Conviction before one physical weapon strike. Against a profane target only, a bounded sacred radiant rider may follow and must pass through ward; it never becomes true damage or an execution." },
  { ...paladinIdentity, id: "paladin-last-witness", name: "Last Witness", icon: "shield", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "vigor", weaponReq: null, statReq: { attr: "vigor", base: 6 }, dmg: null, pen: 0, critBonus: 0, cooldown: 5, effect: { type: "paladinLastWitness", share: 0.55, cap: 0.22, duration: 2, physicalInterception: true, target: "ally" }, paladinConvictionCost: 4, paladinConvictionCommitSpend: true, requiresInterceptionLine: true, desc: "Commit four Conviction to intercept fifty-five percent of eligible ally damage, capped at twenty-two percent of your maximum health per ally hit. It neither heals nor prevents all harm." },
  { ...paladinIdentity, id: "paladin-oath-incarnate", name: "Oath Incarnate", icon: "shield", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 7 }, dmg: null, pen: 0, critBonus: 0, cooldown: 6, effect: { type: "paladinOathIncarnate", share: 0.65, cap: 0.25, duration: 2, physicalInterception: true, target: "ally" }, paladinConvictionCost: 5, paladinConvictionCommitSpend: true, requiresInterceptionLine: true, desc: "Commit all five Conviction to intercept sixty-five percent of eligible ally damage, capped at twenty-five percent of your maximum health per ally hit. The Paladin still suffers redirected harm and grants no healing or invulnerability." },

  // Paladin specialization cards remain oathcraft: physical covenant, public
  // accountability, voluntary mercy, or visible leadership. None is a prayer,
  // spell, charm, allegiance rewrite, or source of unearned Conviction.
  { ...paladinIdentity, id: "paladin-shield-covenant", name: "Shield Covenant", icon: "shield", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "vigor", weaponReq: null, statReq: { attr: "vigor", base: 3 }, dmg: null, pen: 0, critBonus: 0, cooldown: 3, effect: { type: "paladinShieldCovenant", share: 0.35, cap: 0.16, duration: 3, physicalInterception: true, target: "ally" }, requiresShieldOrGuardingWeapon: true, requiresInterceptionLine: true, branchExclusive: true, desc: "Form a shield or guarding-weapon covenant over reachable allies, intercepting thirty-five percent of eligible damage within a sixteen-percent maximum-health cap per ally hit. It creates no Conviction by itself." },
  { ...paladinIdentity, id: "paladin-call-to-account", name: "Call to Account", icon: "user", target: "enemy", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 3 }, dmg: null, pen: 0, critBonus: 0, cooldown: 3, effect: { type: "paladinCallToAccount", truthPressure: 20, soft: true, duration: 2, sourceOwned: true, target: "enemy" }, audible: true, requiresAwareness: true, requiresUnderstanding: true, paladinCallToAccountMark: true, branchExclusive: true, desc: "Name one witnessed contradiction before an aware foe who can hear and understand. It creates bounded, Paladin-owned truth pressure; it neither proves guilt by magic nor compels an answer." },
  { ...paladinIdentity, id: "paladin-offer-quarter", name: "Offer Quarter", icon: "user", target: "enemy", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 3 }, dmg: null, pen: 0, critBonus: 0, cooldown: 3, effect: { type: "paladinOfferQuarter", surrenderPressure: 20, voluntary: true, soft: true, duration: 2, target: "enemy" }, audible: true, requiresAwareness: true, requiresUnderstanding: true, branchExclusive: true, desc: "Offer clear, credible terms to an aware foe who can hear and understand. It applies voluntary surrender pressure only; refusal, retreat, and allegiance remain theirs to choose." },
  { ...paladinIdentity, id: "paladin-beacon-stance", name: "Beacon Stance", icon: "flame", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 3 }, dmg: null, pen: 0, critBonus: 0, cooldown: 3, effect: { type: "paladinBeaconStance", morale: 15, fearSteadiness: 20, visibilitySupport: 20, duration: 3, target: "ally" }, requiresVisibleAllies: true, branchExclusive: true, desc: "Remain visibly planted as a mundane rally point. Allies who can see the Paladin gain bounded morale, fear steadiness, and orientation support without healing or supernatural illumination." },
  { ...paladinIdentity, id: "paladin-rampart-exchange", name: "Rampart Exchange", icon: "shield", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "vigor", weaponReq: null, statReq: { attr: "vigor", base: 4 }, dmg: null, pen: 0, critBonus: 0, cooldown: 4, effect: { type: "paladinRampartExchange", share: 0.50, cap: 0.20, block: 10, physicalOnly: true, duration: 2, target: "ally" }, paladinConvictionCost: 2, paladinConvictionCommitSpend: true, requiresShieldOrGuardingWeapon: true, requiresInterceptionLine: true, branchExclusive: true, desc: "Commit two Conviction to exchange guarded positions across a reachable line, intercepting fifty percent within a twenty-percent cap and granting ten bounded physical Block. Harm is redistributed, never erased." },
  { ...paladinIdentity, id: "paladin-threshold-blow", name: "Threshold Blow", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: PALADIN_WEAPONS, statReq: { attr: "body", base: 4 }, dmg: null, damageMult: 0.8, pen: 2, critBonus: 3, cooldown: 3, effect: { type: "paladinThresholdBlow", push: 1, physicalCheck: true, bossScale: 0.35, duration: 1, target: "enemy" }, paladinConvictionCost: 1, paladinConvictionCommitSpend: true, requiresMeleeReach: true, branchExclusive: true, desc: "Commit one Conviction before an armour-respecting weapon check at a real threshold. A bounded physical push follows only if size, footing, mass, and resistance permit." },
  { ...paladinIdentity, id: "paladin-verdict-edge", name: "Verdict Edge", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "presence", weaponReq: PALADIN_WEAPONS, statReq: { attr: "presence", base: 4 }, dmg: null, damageMult: 0.9, pen: 2, critBonus: 6, cooldown: 3, effect: { type: "paladinVerdictEdge", pressure: 15, soft: true, duration: 2, target: "enemy" }, paladinConvictionCost: 2, paladinConvictionCommitSpend: true, paladinRequiresOwnCallToAccount: true, branchExclusive: true, desc: "Commit two Conviction before one armour-respecting strike. Its bounded pressure benefit applies only while this same Paladin's Call to Account remains on the target; another actor's mark never qualifies." },
  { ...paladinIdentity, id: "paladin-peace-command", name: "Peace Command", icon: "user", target: "enemy", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 4 }, dmg: null, pen: 0, critBonus: 0, cooldown: 3, effect: { type: "paladinPeaceCommand", haltPressure: 20, voluntary: true, soft: true, duration: 1, target: "enemy" }, paladinConvictionCost: 1, paladinConvictionCommitSpend: true, audible: true, requiresAwareness: true, requiresUnderstanding: true, branchExclusive: true, desc: "Commit one Conviction to issue a clear halt before an aware foe who can hear and understand. It creates soft, voluntary pause pressure only and cannot compel peace." },
  { ...paladinIdentity, id: "paladin-redeeming-intercession", name: "Redeeming Intercession", icon: "shield", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 4 }, dmg: null, pen: 0, critBonus: 0, cooldown: 4, effect: { type: "paladinRedeemingIntercession", share: 0.40, cap: 0.18, clearFear: true, duration: 2, physicalInterception: true, target: "ally" }, paladinConvictionCost: 2, paladinConvictionCommitSpend: true, requiresInterceptionLine: true, branchExclusive: true, desc: "Commit two Conviction to place yourself in a reachable guard line, intercepting forty percent within an eighteen-percent cap and clearing ordinary fear. It restores no health." },
  { ...paladinIdentity, id: "paladin-burden-taken", name: "Burden Taken", icon: "shield", target: "self", damageType: null, scaling: "none", scaleAttr: "vigor", weaponReq: null, statReq: { attr: "vigor", base: 4 }, dmg: null, pen: 0, critBonus: 0, cooldown: 4, effect: { type: "paladinBurdenTaken", redirectedDamageReduction: 0.30, cap: 0.12, duration: 2, target: "self" }, paladinConvictionCost: 1, paladinConvictionCommitSpend: true, requiresInterceptionLine: true, branchExclusive: true, desc: "Commit one Conviction to brace for damage already redirected through a reachable ally-guard line. Reduce that redirected portion by thirty percent within a twelve-percent maximum-health cap; direct hits gain nothing." },
  { ...paladinIdentity, id: "paladin-sunward-cut", name: "Sunward Cut", icon: "swords", target: "enemy", damageType: "physical", scaling: "weapon", scaleAttr: "presence", weaponReq: PALADIN_WEAPONS, statReq: { attr: "presence", base: 4 }, dmg: null, damageMult: 0.85, pen: 2, critBonus: 4, cooldown: 3, effect: null, paladinConvictionCost: 2, paladinConvictionCommitSpend: true, paladinRadiantRider: { value: 0.20, cap: 0.06, respectsWard: true }, profaneOnly: true, branchExclusive: true, desc: "Commit two Conviction before one physical weapon cut. A profane target alone may take the bounded sacred radiant rider, and its ward still applies in full." },
  { ...paladinIdentity, id: "paladin-pilgrim-aegis", name: "Pilgrim Aegis", icon: "shield", target: "all-allies", damageType: null, scaling: "none", scaleAttr: "vigor", weaponReq: null, statReq: { attr: "vigor", base: 4 }, dmg: null, pen: 0, critBonus: 0, cooldown: 4, effect: { type: "paladinPilgrimAegis", share: 0.40, cap: 0.18, forcedMoveResistance: 25, fearSteadiness: 20, duration: 2, physicalInterception: true, target: "ally" }, paladinConvictionCost: 2, paladinConvictionCommitSpend: true, requiresInterceptionLine: true, branchExclusive: true, desc: "Commit two Conviction to guard reachable companions on the march, intercepting forty percent within an eighteen-percent cap while steadying fear and forced movement. It grants neither healing nor immunity." },

  // ---- Druid — progression-owned primal spells ----
  // Primalcraft is neither arcane, divine, nor pact magic. Every committed
  // native action checks the actor's current season for its bounded surge and
  // then advances the actor's season exactly once. The universal surge schema
  // deliberately cannot alter targets, hits, duration, or Resolve cost.
  { ...druidIdentity,
    id: "druid-verdant-spark", name: "Verdant Spark", icon: "sparkle",
    target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 2 }, dmg: [3, 5], pen: 0, critBonus: 0,
    resolveCost: 3, cooldown: 1,
    effect: { type: "druidVerdantSpark", rootPressure: 12, duration: 2, target: "enemy" },
    druidSeason: "spring", druidSeasonSurge: DRUID_MIXED_SURGE,
    desc: "Wake seeds and hair-roots already present beneath one foe. Verdant force bites through ward and lays bounded root pressure without creating a forest from nothing.",
  },
  { ...druidIdentity,
    id: "druid-sunlance", name: "Sunlance", icon: "flame",
    target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "presence",
    weaponReq: null, statReq: { attr: "presence", base: 2 }, dmg: [5, 8], pen: 2, critBonus: 3,
    resolveCost: 3, cooldown: 1, effect: null,
    druidSeason: "summer", druidSeasonSurge: DRUID_DAMAGE_SURGE,
    desc: "Concentrate available daylight and seasonal heat into a narrow primal lance. It is ward-respecting solar force, not sacred radiance or arcane evocation.",
  },
  { ...druidIdentity,
    id: "druid-leafrot", name: "Leafrot", icon: "droplet",
    target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 3 }, dmg: [3, 5], pen: 1, critBonus: 0,
    resolveCost: 4, cooldown: 2,
    effect: { type: "druidLeafrot", decay: 3, duration: 3, livingAndConstructedMatter: true, target: "enemy" },
    druidSeason: "autumn", druidSeasonSurge: DRUID_MIXED_SURGE,
    desc: "Call the ordinary autumnal turn in leaf, hide, wood, or worked fibre. Bounded primal decay persists briefly; it cannot age a creature to death or command a soul.",
  },
  { ...druidIdentity,
    id: "druid-rimebark", name: "Rimebark", icon: "shield",
    target: "self", damageType: null, scaling: "none", scaleAttr: "vigor",
    weaponReq: null, statReq: { attr: "vigor", base: 3 }, dmg: null, pen: 0, critBonus: 0,
    resolveCost: 4, cooldown: 3,
    effect: { type: "druidRimebark", ward: 10, forcedMoveResistance: 20, duration: 2, target: "self" },
    druidSeason: "winter", druidSeasonSurge: DRUID_EFFECT_SURGE,
    desc: "Layer your skin in a temporary coat of cold, dormant bark. It grants bounded ward and stability while leaving movement, harm, and counterplay intact.",
  },
  { ...druidIdentity,
    id: "druid-saprise", name: "Saprise", icon: "heart",
    target: "all-allies", damageType: null, scaling: "none", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: null, pen: 0, critBonus: 0,
    resolveCost: 6, cooldown: 4,
    effect: { type: "druidSaprise", regen: 4, cap: 0.08, duration: 3, livingOnly: true, target: "ally" },
    druidSeason: "spring", druidSeasonSurge: DRUID_EFFECT_SURGE,
    desc: "Invite living bodies toward spring recovery for three turns. The regeneration is bounded per ally, cannot restore the dead, and is primal growth rather than a divine cure.",
  },
  { ...druidIdentity,
    id: "druid-sirocco", name: "Sirocco", icon: "flame",
    target: "all-enemies", damageType: "magical", scaling: "stat", scaleAttr: "presence",
    weaponReq: null, statReq: { attr: "presence", base: 4 }, dmg: [3, 5], pen: 1, critBonus: 0,
    resolveCost: 6, cooldown: 3,
    effect: { type: "druidSirocco", accuracyPenalty: 15, duration: 2, target: "enemy" },
    druidSeason: "summer", druidSeasonSurge: DRUID_MIXED_SURGE,
    desc: "Drive a wave of hot, dust-laden wind across the enemy line. Ward answers its primal force while grit and glare impose only bounded aim pressure.",
  },
  { ...druidIdentity,
    id: "druid-harvest-tide", name: "Harvest Tide", icon: "moon",
    target: "all-enemies", damageType: "magical", scaling: "stat", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 5 }, dmg: [4, 6], pen: 2, critBonus: 0,
    resolveCost: 8, cooldown: 4,
    effect: { type: "druidHarvestTide", resolveOnDefeat: 3, resolveCap: 6, duration: 2, sourceOwned: true, target: "enemy" },
    druidSeason: "autumn", druidSeasonSurge: DRUID_MIXED_SURGE,
    desc: "Send a bounded autumnal tide through nearby foes. If a marked foe actually falls, its released natural energy may refund limited Resolve to this Druid; no life or soul is drained.",
  },
  { ...druidIdentity,
    id: "druid-frostroot", name: "Frostroot", icon: "droplet",
    target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 5 }, dmg: [5, 8], pen: 2, critBonus: 0,
    resolveCost: 8, cooldown: 3,
    effect: { type: "druidFrostroot", rootPressure: 25, movementPenalty: 20, duration: 2, target: "enemy" },
    druidSeason: "winter", druidSeasonSurge: DRUID_MIXED_SURGE,
    desc: "Lock present roots and ground moisture into a winter grip around one foe. It causes bounded movement pressure and never becomes an automatic immobilization.",
  },
  { ...druidIdentity,
    id: "druid-living-canopy", name: "Living Canopy", icon: "shield",
    target: "all-allies", damageType: null, scaling: "none", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 6 }, dmg: null, pen: 0, critBonus: 0,
    resolveCost: 10, cooldown: 5,
    effect: { type: "druidLivingCanopy", projectileReduction: 0.25, cap: 0.10, duration: 3, requiresPresentGrowth: true, target: "ally" },
    druidSeason: "spring", druidSeasonSurge: DRUID_EFFECT_SURGE,
    terrainReq: "living growth or seed-bearing ground",
    desc: "Rapidly braid nearby living growth into overhead cover. It reduces projectile harm within a strict cap, depends on usable growth, and never grants total shelter.",
  },
  { ...druidIdentity,
    id: "druid-high-summer", name: "High Summer", icon: "flame",
    target: "all-enemies", damageType: "magical", scaling: "stat", scaleAttr: "presence",
    weaponReq: null, statReq: { attr: "presence", base: 6 }, dmg: [7, 11], pen: 3, critBonus: 5,
    resolveCost: 10, cooldown: 5,
    effect: { type: "druidHighSummer", scorch: 4, duration: 2, target: "enemy" },
    druidSeason: "summer", druidSeasonSurge: DRUID_MIXED_SURGE,
    desc: "Briefly impose the oppressive crest of summer across the hostile line. Ward mitigates both the initial primal heat and its bounded lingering scorch.",
  },
  { ...druidIdentity,
    id: "druid-return-to-soil", name: "Return to Soil", icon: "moon",
    target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 7 }, dmg: [10, 15], pen: 4, critBonus: 5,
    resolveCost: 15, cooldown: 5,
    effect: { type: "druidReturnToSoil", decayAmplification: 20, bossScale: 0.35, duration: 3, target: "enemy" },
    druidSeason: "autumn", druidSeasonSurge: DRUID_MIXED_SURGE,
    desc: "Accelerate the target's material return toward soil. This is heavy ward-respecting decay with a boss-softened rider, never instant death, soul magic, or supernatural ageing.",
  },
  { ...druidIdentity,
    id: "druid-great-year", name: "Great Year", icon: "sparkle",
    target: "all-enemies", damageType: "magical", scaling: "stat", scaleAttr: "presence",
    weaponReq: null, statReq: { attr: "presence", base: 7 }, dmg: [8, 12], pen: 4, critBonus: 5,
    resolveCost: 15, cooldown: 6,
    effect: { type: "druidGreatYear", actionPressure: 20, bossScale: 0.35, duration: 2, target: "enemy" },
    druidSeason: "winter", druidSeasonSurge: DRUID_MIXED_SURGE,
    desc: "Close the Great Year's cycle in a broad winter hush. Ward-respecting primal force and boss-softened action pressure end the sequence without freezing time or stealing turns.",
  },

  // Specialization-owned primalcraft: one card at each Circle and one at each
  // level-thirty method. Level-fifty refinements modify their Circle instead of
  // adding another card.
  { ...druidIdentity,
    id: "druid-grove-awakening", name: "Grove Awakening", icon: "sparkle",
    target: "all-enemies", damageType: null, scaling: "none", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 3 }, dmg: null, pen: 0, critBonus: 0,
    resolveCost: 4, cooldown: 3,
    effect: { type: "druidGroveAwakening", rootPressure: 18, terrainGrowth: true, duration: 3, target: "enemy" },
    druidSeason: "spring", druidSeasonSurge: DRUID_EFFECT_SURGE,
    terrainReq: "living growth or seed-bearing ground", branchExclusive: true,
    desc: "Wake usable roots and shoots throughout a bounded patch of ground. The resulting growth creates terrain and movement pressure, not creatures, summons, or an instant woodland.",
  },
  { ...druidIdentity,
    id: "druid-predator-shape", name: "Predator Shape", icon: "swords",
    target: "self", damageType: null, scaling: "none", scaleAttr: "vigor",
    weaponReq: null, statReq: { attr: "vigor", base: 3 }, dmg: null, pen: 0, critBonus: 0,
    resolveCost: 4, cooldown: 4,
    effect: { type: "druidPredatorShape", bodyBonus: 12, reflexBonus: 12, aspect: "predator", duration: 3, target: "self" },
    druidSeason: "summer", druidSeasonSurge: DRUID_EFFECT_SURGE,
    selfShapeshift: true, branchExclusive: true,
    desc: "Reshape your own body into a lean hunting form for bounded physical bonuses. It creates no separate beast, pet, summon, telepathic bond, or borrowed martial technique.",
  },
  { ...druidIdentity,
    id: "druid-gale-shear", name: "Gale Shear", icon: "sparkle",
    target: "all-enemies", damageType: "magical", scaling: "stat", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 3 }, dmg: [2, 4], pen: 1, critBonus: 0,
    resolveCost: 4, cooldown: 3,
    effect: { type: "druidGaleShear", pushPressure: 15, bossScale: 0.35, duration: 1, target: "enemy" },
    druidSeason: "winter", druidSeasonSurge: DRUID_MIXED_SURGE,
    branchExclusive: true,
    desc: "Cut a cold crosswind through the hostile line. It deals ward-respecting primal force and bounded, boss-softened displacement pressure rather than guaranteed movement.",
  },
  { ...druidIdentity,
    id: "druid-decay-mark", name: "Decay Mark", icon: "moon",
    target: "enemy", damageType: null, scaling: "none", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 3 }, dmg: null, pen: 0, critBonus: 0,
    resolveCost: 4, cooldown: 3,
    effect: { type: "druidDecayMark", decayVulnerability: 18, duration: 3, sourceOwned: true, target: "enemy" },
    druidSeason: "autumn", druidSeasonSurge: DRUID_EFFECT_SURGE,
    branchExclusive: true,
    desc: "Mark one body or object as this Druid's chosen point of natural breakdown. Only source-owned primal decay gains its bounded opening; no curse or necromancy is created.",
  },
  { ...druidIdentity,
    id: "druid-entangling-thicket", name: "Entangling Thicket", icon: "sparkle",
    target: "all-enemies", damageType: "magical", scaling: "stat", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: [3, 5], pen: 1, critBonus: 0,
    resolveCost: 6, cooldown: 4,
    effect: { type: "druidEntanglingThicket", rootPressure: 28, terrainGrowth: true, duration: 3, target: "enemy" },
    druidSeason: "spring", druidSeasonSurge: DRUID_MIXED_SURGE,
    terrainReq: "living growth or seed-bearing ground", branchExclusive: true,
    desc: "Raise a dense but bounded thicket from present growth, dealing ward-respecting primal force and strong movement pressure. It occupies terrain without hard-locking every target.",
  },
  { ...druidIdentity,
    id: "druid-ironbark-rise", name: "Ironbark Rise", icon: "shield",
    target: "all-allies", damageType: null, scaling: "none", scaleAttr: "vigor",
    weaponReq: null, statReq: { attr: "vigor", base: 4 }, dmg: null, pen: 0, critBonus: 0,
    resolveCost: 6, cooldown: 4,
    effect: { type: "druidIronbarkRise", block: 10, ward: 8, cap: 0.12, duration: 2, target: "ally" },
    druidSeason: "winter", druidSeasonSurge: DRUID_EFFECT_SURGE,
    branchExclusive: true,
    desc: "Raise layered ironbark over allies for bounded Block and ward. The living shell can be broken normally and supplies neither invulnerability nor sacred protection.",
  },
  { ...druidIdentity,
    id: "druid-wolf-aspect", name: "Wolf Aspect", icon: "swords",
    target: "self", damageType: null, scaling: "none", scaleAttr: "reflex",
    weaponReq: null, statReq: { attr: "reflex", base: 4 }, dmg: null, pen: 0, critBonus: 0,
    resolveCost: 6, cooldown: 4,
    effect: { type: "druidWolfAspect", reflexBonus: 18, critBonus: 8, pursuitBonus: 15, aspect: "wolf", duration: 3, target: "self" },
    druidSeason: "autumn", druidSeasonSurge: DRUID_EFFECT_SURGE,
    selfShapeshift: true, branchExclusive: true,
    desc: "Take a wolf-bodied aspect that sharpens your own pursuit, reflex, and physical threat. It neither calls a pack nor communicates with animals at a distance.",
  },
  { ...druidIdentity,
    id: "druid-bear-aspect", name: "Bear Aspect", icon: "shield",
    target: "self", damageType: null, scaling: "none", scaleAttr: "body",
    weaponReq: null, statReq: { attr: "body", base: 4 }, dmg: null, pen: 0, critBonus: 0,
    resolveCost: 6, cooldown: 4,
    effect: { type: "druidBearAspect", bodyBonus: 18, block: 12, forcedMoveResistance: 25, aspect: "bear", duration: 3, target: "self" },
    druidSeason: "winter", druidSeasonSurge: DRUID_EFFECT_SURGE,
    selfShapeshift: true, branchExclusive: true,
    desc: "Reshape your own body into a massive bear aspect with bounded strength, Block, and stability. It is not a summon, pet, mount, or independent creature.",
  },
  { ...druidIdentity,
    id: "druid-stormbolt", name: "Stormbolt", icon: "sparkle",
    target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: [7, 10], pen: 4, critBonus: 5,
    resolveCost: 6, cooldown: 3,
    effect: { type: "druidStormbolt", stormCharge: 15, duration: 2, target: "enemy" },
    druidSeason: "summer", druidSeasonSurge: DRUID_MIXED_SURGE,
    requiresOpenSkyOrStorm: true, branchExclusive: true,
    desc: "Draw charge from open sky or an existing storm into one ward-respecting primal bolt. The bounded storm charge is weathercraft, never arcane chain lightning.",
  },
  { ...druidIdentity,
    id: "druid-sunwheel", name: "Sunwheel", icon: "flame",
    target: "all-enemies", damageType: "magical", scaling: "stat", scaleAttr: "presence",
    weaponReq: null, statReq: { attr: "presence", base: 4 }, dmg: [3, 5], hits: 2, pen: 2, critBonus: 3,
    resolveCost: 6, cooldown: 4,
    effect: { type: "druidSunwheel", glarePressure: 18, duration: 2, target: "enemy" },
    druidSeason: "summer", druidSeasonSurge: DRUID_MIXED_SURGE,
    requiresSunlight: true, branchExclusive: true,
    desc: "Wheel two gathered bands of sunlight across nearby foes as one committed primal action. Ward mitigates each hit, while bounded glare pressure depends on real light and grants no holy judgment.",
  },
  { ...druidIdentity,
    id: "druid-moldering-wave", name: "Moldering Wave", icon: "moon",
    target: "all-enemies", damageType: "magical", scaling: "stat", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: [5, 8], pen: 2, critBonus: 0,
    resolveCost: 6, cooldown: 4,
    effect: { type: "druidMolderingWave", decay: 4, duration: 3, target: "enemy" },
    druidSeason: "autumn", druidSeasonSurge: DRUID_MIXED_SURGE,
    branchExclusive: true,
    desc: "Roll bounded decomposition through exposed flesh, fibre, wood, and other matter. Ward answers the primal wave; it cannot rot souls, erase equipment, or kill instantly.",
  },
  { ...druidIdentity,
    id: "druid-reclamation-bloom", name: "Reclamation Bloom", icon: "heart",
    target: "all-allies", damageType: null, scaling: "none", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: null, pen: 0, critBonus: 0,
    resolveCost: 6, cooldown: 5,
    effect: { type: "druidReclamationBloom", restoreHealth: 5, healthCap: 0.06, restoreResolve: 2, resolveCap: 3, target: "ally" },
    druidSeason: "spring", druidSeasonSurge: DRUID_EFFECT_SURGE,
    requiresReclaimableDecay: true, branchExclusive: true,
    desc: "Reclaim energy from actual nearby decay into a bounded bloom of living recovery. It requires reclaimable matter, cannot raise the dead, and returns only limited health and Resolve.",
  },

  // ---- Warlock — progression-owned pact spells ----
  // Pact Favor is a personal 0–5 combat reserve. A builder earns at most one
  // Favor only after its authored, reversible Pact Price is actually paid on a
  // committed action. Price and Favor happen once per whole action, never per
  // hit or target. Spenders likewise commit their Favor once even on a miss.
  { ...warlockIdentity,
    id: "warlock-tithe-bolt", name: "Tithe Bolt", icon: "sparkle",
    target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "presence",
    weaponReq: null, statReq: { attr: "presence", base: 2 }, dmg: [3, 5], pen: 1, critBonus: 0,
    resolveCost: 3, cooldown: 1, effect: null,
    warlockPactPrice: { type: "health", maxHealth: 0.04, cap: 0.04, nonlethal: true },
    warlockFavorBuild: 1, warlockFavorBuildOnPaidPrice: true, warlockPriceCommitOnce: true,
    desc: "Pay four percent of your maximum health, nonlethally, to loose one ward-respecting pact bolt. Only the actually paid tithe earns one Favor; the target's fate does not multiply it.",
  },
  { ...warlockIdentity,
    id: "warlock-debt-mark", name: "Debt Mark", icon: "moon",
    target: "enemy", damageType: null, scaling: "none", scaleAttr: "presence",
    weaponReq: null, statReq: { attr: "presence", base: 2 }, dmg: null, pen: 0, critBonus: 0,
    resolveCost: 3, cooldown: 2,
    effect: { type: "warlockDebtMark", debtPressure: 12, duration: 3, sourceOwned: true, target: "enemy" },
    desc: "Write this Warlock's bounded pact claim over one foe. The source-owned mark creates no Favor by itself and neither owns, steals, nor binds a soul.",
  },
  { ...warlockIdentity,
    id: "warlock-favors-rebuke", name: "Favor's Rebuke", icon: "sparkle",
    target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "presence",
    weaponReq: null, statReq: { attr: "presence", base: 3 }, dmg: [5, 8], pen: 2, critBonus: 3,
    resolveCost: 4, cooldown: 2,
    effect: { type: "warlockFavorsRebuke", pactPressure: 12, duration: 2, target: "enemy" },
    warlockFavorCost: 1, warlockFavorCommitSpend: true,
    desc: "Commit one Favor before a ward-respecting rebuke. Its bounded pact pressure follows the whole action once, whether the bolt lands or misses.",
  },
  { ...warlockIdentity,
    id: "warlock-open-covenant", name: "Open Covenant", icon: "moon",
    target: "self", damageType: null, scaling: "none", scaleAttr: "presence",
    weaponReq: null, statReq: { attr: "presence", base: 3 }, dmg: null, pen: 0, critBonus: 0,
    resolveCost: 4, cooldown: 3,
    effect: { type: "warlockOpenCovenant", accuracyBonus: 10, duration: 2, target: "self" },
    warlockPactPrice: WARLOCK_EXPOSURE_PRICE_15,
    warlockFavorBuild: 1, warlockFavorBuildOnPaidPrice: true, warlockPriceCommitOnce: true,
    desc: "Open your defences to the pact for two turns, taking fifteen percent more incoming damage within a twenty-percent cap. The paid exposure sharpens pact aim and earns one Favor.",
  },
  { ...warlockIdentity,
    id: "warlock-owed-ward", name: "Owed Ward", icon: "shield",
    target: "self", damageType: null, scaling: "none", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 3 }, dmg: null, pen: 0, critBonus: 0,
    resolveCost: 4, cooldown: 3,
    effect: { type: "warlockOwedWard", ward: 10, cap: 0.10, duration: 2, target: "self" },
    warlockFavorCost: 1, warlockFavorCommitSpend: true,
    desc: "Commit one Favor to call in a bounded pact ward. It absorbs ordinary magical harm, can be broken normally, and grants no immunity or divine sanctuary.",
  },
  { ...warlockIdentity,
    id: "warlock-covenant-lash", name: "Covenant Lash", icon: "sparkle",
    target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: [5, 8], pen: 2, critBonus: 3,
    resolveCost: 6, cooldown: 3,
    effect: { type: "warlockCovenantLash", debtPressure: 15, duration: 2, sourceOwned: true, target: "enemy" },
    warlockPactPrice: { type: "health", maxHealth: 0.06, cap: 0.06, nonlethal: true },
    warlockFavorBuild: 1, warlockFavorBuildOnPaidPrice: true, warlockPriceCommitOnce: true,
    desc: "Pay six percent of maximum health, nonlethally, to lash one foe with ward-respecting pact force and a bounded source-owned debt. The paid price earns one Favor only.",
  },
  { ...warlockIdentity,
    id: "warlock-creditors-gaze", name: "Creditor's Gaze", icon: "user",
    target: "enemy", damageType: null, scaling: "none", scaleAttr: "presence",
    weaponReq: null, statReq: { attr: "presence", base: 4 }, dmg: null, pen: 0, critBonus: 0,
    resolveCost: 6, cooldown: 3,
    effect: { type: "warlockCreditorsGaze", revealPressure: 18, soft: true, duration: 2, sourceOwned: true, target: "enemy" },
    warlockPactPrice: WARLOCK_EXPOSURE_PRICE_15,
    warlockFavorBuild: 1, warlockFavorBuildOnPaidPrice: true, warlockPriceCommitOnce: true,
    desc: "Accept bounded self-exposure while reading one target through the pact. The gaze creates source-owned revelation pressure, never compelled confession, stolen memories, or automatic truth.",
  },
  { ...warlockIdentity,
    id: "warlock-claim-due", name: "Claim Due", icon: "sparkle",
    target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "presence",
    weaponReq: null, statReq: { attr: "presence", base: 5 }, dmg: [8, 12], pen: 3, critBonus: 5,
    resolveCost: 8, cooldown: 3,
    effect: { type: "warlockClaimDue", debtBonus: 20, duration: 2, sourceOwned: true, target: "enemy" },
    warlockFavorCost: 2, warlockFavorCommitSpend: true, warlockRequiresOwnDebtMark: true,
    desc: "Commit two Favor against a foe bearing this same Warlock's Debt Mark. The ward-respecting claim gains a bounded debt rider without executing, draining, or taking ownership of the target.",
  },
  { ...warlockIdentity,
    id: "warlock-ruinous-terms", name: "Ruinous Terms", icon: "moon",
    target: "all-enemies", damageType: "magical", scaling: "stat", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 5 }, dmg: [4, 7], pen: 2, critBonus: 0,
    resolveCost: 8, cooldown: 4,
    effect: { type: "warlockRuinousTerms", wardPressure: 12, duration: 2, target: "enemy" },
    warlockPactPrice: WARLOCK_EXPOSURE_PRICE_20,
    warlockFavorBuild: 1, warlockFavorBuildOnPaidPrice: true, warlockPriceCommitOnce: true,
    desc: "Expose yourself to twenty percent more incoming damage for two turns to impose ward-respecting pact force across nearby foes. Paying once earns one Favor for the entire action.",
  },
  { ...warlockIdentity,
    id: "warlock-fivefold-collection", name: "Fivefold Collection", icon: "sparkle",
    target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 6 }, dmg: [1, 3], hits: 5, pen: 1, critBonus: 2,
    resolveCost: 10, cooldown: 4, effect: null,
    warlockFavorCost: 3, warlockFavorCommitSpend: true,
    desc: "Commit three Favor once to send five separate ward-respecting collections into one foe. Each hit is mitigated normally; the action never spends Favor five times.",
  },
  { ...warlockIdentity,
    id: "warlock-black-bargain", name: "Black Bargain", icon: "shield",
    target: "all-allies", damageType: null, scaling: "none", scaleAttr: "presence",
    weaponReq: null, statReq: { attr: "presence", base: 6 }, dmg: null, pen: 0, critBonus: 0,
    resolveCost: 12, cooldown: 5,
    effect: { type: "warlockBlackBargain", ward: 12, cap: 0.10, duration: 2, target: "ally" },
    warlockFavorCost: 4, warlockFavorCommitSpend: true,
    desc: "Commit four Favor to extend a bounded pact ward across willing allies. It restores nothing, compels no agreement, and remains breakable by ordinary hostile magic.",
  },
  { ...warlockIdentity,
    id: "warlock-pact-apotheosis", name: "Pact Apotheosis", icon: "moon",
    target: "all-enemies", damageType: "magical", scaling: "stat", scaleAttr: "presence",
    weaponReq: null, statReq: { attr: "presence", base: 7 }, dmg: [8, 12], pen: 4, critBonus: 5,
    resolveCost: 15, cooldown: 6,
    effect: { type: "warlockPactApotheosis", pactPressure: 25, bossScale: 0.35, duration: 2, target: "enemy" },
    warlockFavorCost: 5, warlockFavorCommitSpend: true,
    desc: "Commit all five Favor once to manifest the pact's full bounded authority across nearby foes. Ward applies, bosses soften its pressure, and no soul theft or instant death occurs.",
  },

  // Specialization-owned pactcraft: each root establishes its own price-bearing
  // covenant; each level-thirty method spends Favor on that narrow pact. Level-
  // fifty refinements deepen the method without adding another combat card.
  { ...warlockIdentity,
    id: "warlock-hellfire-covenant", name: "Hellfire Covenant", icon: "flame",
    target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "presence",
    weaponReq: null, statReq: { attr: "presence", base: 3 }, dmg: [4, 7], pen: 2, critBonus: 2,
    resolveCost: 4, cooldown: 3,
    effect: { type: "warlockHellfireCovenant", scorch: 3, duration: 2, sourceOwned: true, target: "enemy" },
    warlockPactPrice: { type: "health", maxHealth: 0.05, cap: 0.05, nonlethal: true },
    warlockFavorBuild: 1, warlockFavorBuildOnPaidPrice: true, warlockPriceCommitOnce: true,
    branchExclusive: true,
    desc: "Pay five percent of maximum health, nonlethally, to seal a source-owned hellfire covenant on one foe. Its fire respects ward and comes from the pact, never borrowed demonic ancestry.",
  },
  { ...warlockIdentity,
    id: "warlock-witch-mark", name: "Witch Mark", icon: "moon",
    target: "enemy", damageType: null, scaling: "none", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 3 }, dmg: null, pen: 0, critBonus: 0,
    resolveCost: 4, cooldown: 3,
    effect: { type: "warlockWitchMark", hexPressure: 18, duration: 3, sourceOwned: true, target: "enemy" },
    warlockPactPrice: WARLOCK_EXPOSURE_PRICE_15,
    warlockFavorBuild: 1, warlockFavorBuildOnPaidPrice: true, warlockPriceCommitOnce: true,
    branchExclusive: true,
    desc: "Accept two turns of bounded exposure to lay this Witch's source-owned pact hex. It uses no Wizard spellbook, copied formula, soul binding, or automatic curse of death.",
  },
  { ...warlockIdentity,
    id: "warlock-pact-chain", name: "Pact Chain", icon: "shield",
    target: "enemy", damageType: null, scaling: "none", scaleAttr: "presence",
    weaponReq: null, statReq: { attr: "presence", base: 3 }, dmg: null, pen: 0, critBonus: 0,
    resolveCost: 4, cooldown: 3,
    effect: { type: "warlockPactChain", chainPressure: 18, bossScale: 0.35, duration: 2, sourceOwned: true, target: "enemy" },
    warlockPactPrice: { type: "health", maxHealth: 0.04, cap: 0.04, nonlethal: true },
    warlockFavorBuild: 1, warlockFavorBuildOnPaidPrice: true, warlockPriceCommitOnce: true,
    branchExclusive: true,
    desc: "Pay four percent of maximum health, nonlethally, to link your pact to one target. The chain creates bounded, boss-softened pressure without charm, domination, paralysis, or allegiance change.",
  },
  { ...warlockIdentity,
    id: "warlock-whispered-terms", name: "Whispered Terms", icon: "user",
    target: "enemy", damageType: null, scaling: "none", scaleAttr: "presence",
    weaponReq: null, statReq: { attr: "presence", base: 3 }, dmg: null, pen: 0, critBonus: 0,
    resolveCost: 4, cooldown: 3,
    effect: { type: "warlockWhisperedTerms", bargainPressure: 18, voluntary: true, soft: true, duration: 2, target: "enemy" },
    warlockPactPrice: WARLOCK_EXPOSURE_PRICE_15,
    warlockFavorBuild: 1, warlockFavorBuildOnPaidPrice: true, warlockPriceCommitOnce: true,
    audible: true, requiresAwareness: true, requiresUnderstanding: true, branchExclusive: true,
    desc: "Accept bounded exposure while offering intelligible pact terms to an aware listener. The bargain creates soft pressure only; refusal, silence, and allegiance remain entirely theirs.",
  },
  { ...warlockIdentity,
    id: "warlock-infernal-volley", name: "Infernal Volley", icon: "flame",
    target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "presence",
    weaponReq: null, statReq: { attr: "presence", base: 4 }, dmg: [3, 5], hits: 2, pen: 2, critBonus: 3,
    resolveCost: 6, cooldown: 4,
    effect: { type: "warlockInfernalVolley", scorch: 2, duration: 2, target: "enemy" },
    warlockFavorCost: 2, warlockFavorCommitSpend: true, branchExclusive: true,
    desc: "Commit two Favor once to loose a paired hellfire volley. Both hits respect ward and share one action cost; neither uses innate demonic power.",
  },
  { ...warlockIdentity,
    id: "warlock-devils-due", name: "Devil's Due", icon: "flame",
    target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "presence",
    weaponReq: null, statReq: { attr: "presence", base: 4 }, dmg: [7, 11], pen: 3, critBonus: 5,
    resolveCost: 6, cooldown: 4,
    effect: { type: "warlockDevilsDue", contractPressure: 20, sourceOwned: true, duration: 2, target: "enemy" },
    warlockFavorCost: 2, warlockFavorCommitSpend: true, warlockRequiresOwnHellfireCovenant: true,
    branchExclusive: true,
    desc: "Commit two Favor against this Warlock's own Hellfire Covenant. The contracted due is bounded ward-respecting damage and pressure, never a claim on the target's soul.",
  },
  { ...warlockIdentity,
    id: "warlock-layered-hex", name: "Layered Hex", icon: "moon",
    target: "enemy", damageType: null, scaling: "none", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: null, pen: 0, critBonus: 0,
    resolveCost: 6, cooldown: 4,
    effect: { type: "warlockLayeredHex", hexPressure: 24, maxStacks: 2, duration: 3, sourceOwned: true, target: "enemy" },
    warlockFavorCost: 2, warlockFavorCommitSpend: true, branchExclusive: true,
    desc: "Commit two Favor to reinforce this Witch's source-owned pact hex to at most two bounded layers. It copies no Wizard formula and cannot escalate into instant death.",
  },
  { ...warlockIdentity,
    id: "warlock-sympathetic-token", name: "Sympathetic Token", icon: "moon",
    target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: [4, 6], pen: 2, critBonus: 2,
    resolveCost: 6, cooldown: 4,
    effect: { type: "warlockSympatheticToken", sympatheticPressure: 20, duration: 2, sourceOwned: true, target: "enemy" },
    warlockFavorCost: 2, warlockFavorCommitSpend: true,
    requiresCarriedSympatheticToken: true, branchExclusive: true,
    desc: "Commit two Favor through a carried, honestly linked token. The crafted sympathy carries ward-respecting pact force and bounded pressure; a false or destroyed link provides nothing.",
  },
  { ...warlockIdentity,
    id: "warlock-binding-links", name: "Binding Links", icon: "shield",
    target: "all-enemies", damageType: null, scaling: "none", scaleAttr: "presence",
    weaponReq: null, statReq: { attr: "presence", base: 4 }, dmg: null, pen: 0, critBonus: 0,
    resolveCost: 6, cooldown: 4,
    effect: { type: "warlockBindingLinks", chainPressure: 25, bossScale: 0.35, duration: 2, sourceOwned: true, target: "enemy" },
    warlockFavorCost: 2, warlockFavorCommitSpend: true, branchExclusive: true,
    desc: "Commit two Favor once to extend source-owned pact links across nearby foes. The chains apply bounded, boss-softened movement pressure without hard restraint, command, charm, or domination.",
  },
  { ...warlockIdentity,
    id: "warlock-shared-burden", name: "Shared Burden", icon: "shield",
    target: "all-allies", damageType: null, scaling: "none", scaleAttr: "presence",
    weaponReq: null, statReq: { attr: "presence", base: 4 }, dmg: null, pen: 0, critBonus: 0,
    resolveCost: 6, cooldown: 4,
    effect: { type: "warlockSharedBurden", share: 0.20, cap: 0.08, duration: 2, sourceOwned: true, target: "ally" },
    warlockFavorCost: 2, warlockFavorCommitSpend: true, branchExclusive: true,
    desc: "Commit two Favor to chain willing allies into a bounded pact that redistributes twenty percent of eligible harm within an eight-percent cap. It heals nothing and grants no immunity.",
  },
  { ...warlockIdentity,
    id: "warlock-secret-leverage", name: "Secret Leverage", icon: "user",
    target: "enemy", damageType: null, scaling: "none", scaleAttr: "presence",
    weaponReq: null, statReq: { attr: "presence", base: 4 }, dmg: null, pen: 0, critBonus: 0,
    resolveCost: 6, cooldown: 4,
    effect: { type: "warlockSecretLeverage", secretPressure: 22, voluntary: true, soft: true, duration: 2, sourceOwned: true, target: "enemy" },
    warlockFavorCost: 2, warlockFavorCommitSpend: true,
    audible: true, requiresAwareness: true, requiresUnderstanding: true, requiresKnownSecret: true,
    branchExclusive: true,
    desc: "Commit two Favor to state a genuinely known secret before an aware listener who understands. It creates bounded voluntary pressure, never reads thoughts, invents proof, or compels obedience.",
  },
  { ...warlockIdentity,
    id: "warlock-open-bargain", name: "Open Bargain", icon: "user",
    target: "enemy", damageType: null, scaling: "none", scaleAttr: "presence",
    weaponReq: null, statReq: { attr: "presence", base: 4 }, dmg: null, pen: 0, critBonus: 0,
    resolveCost: 6, cooldown: 4,
    effect: { type: "warlockOpenBargain", bargainPressure: 22, voluntary: true, soft: true, duration: 2, target: "enemy" },
    warlockFavorCost: 2, warlockFavorCommitSpend: true,
    audible: true, requiresAwareness: true, requiresUnderstanding: true, branchExclusive: true,
    desc: "Commit two Favor to offer clear, audible terms to an aware foe who understands them. Acceptance and refusal remain voluntary, with no charm, domination, or allegiance rewrite.",
  },

  // ---- Artificer — progression-owned prepared devicecraft ----
  // Device Charges are a personal 0–5 prepared reserve. Every native device
  // commits its authored cost once for the whole action, including multihit and
  // card paths. Field Refit restores a bounded two Charges and never exceeds
  // five. These are fabricated objects, not spontaneous spells or summons.
  { ...artificerIdentity,
    id: "artificer-snapfire-capsule", name: "Snapfire Capsule", icon: "flame",
    target: "enemy", damageType: "magical", scaling: "fieldcraft", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 2 }, dmg: [3, 5], pen: 1, critBonus: 0,
    cooldown: 1, effect: { type: "artificerSnapfire", scorch: 2, duration: 2, target: "enemy" },
    artificerChargeCost: 1, artificerChargeCommitSpend: true,
    desc: "Commit one prepared Charge to rupture a measured alchemical capsule. Its heat respects ward and leaves only a bounded scorch; it is not an evocation spell.",
  },
  { ...artificerIdentity,
    id: "artificer-field-refit", name: "Field Refit", icon: "shield",
    target: "self", damageType: null, scaling: "none", scaleAttr: "wit",
    weaponReq: null, statReq: { attr: "wit", base: 2 }, dmg: null, pen: 0, critBonus: 0,
    cooldown: 4, effect: { type: "artificerFieldRefit", restoreCharges: 2, chargeCap: 5, target: "self" },
    artificerRefit: true,
    desc: "Spend an action on carried spares and recalibration to restore two Device Charges, never above five. The refit creates no free material and cannot be repeated through the same action.",
  },
  { ...artificerIdentity,
    id: "artificer-guard-projector", name: "Guard Projector", icon: "shield",
    target: "self", damageType: null, scaling: "none", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 3 }, dmg: null, pen: 0, critBonus: 0,
    cooldown: 3, effect: { type: "artificerGuardProjector", ward: 10, cap: 0.10, duration: 2, target: "self" },
    artificerChargeCost: 1, artificerChargeCommitSpend: true,
    desc: "Commit one Charge to unfold a prepared ward emitter around yourself. The bounded field can be broken normally and is a device, not Wizard abjuration.",
  },
  { ...artificerIdentity,
    id: "artificer-tangle-line", name: "Tangle Line", icon: "swords",
    target: "enemy", damageType: "physical", scaling: "fieldcraft", scaleAttr: "reflex",
    weaponReq: null, statReq: { attr: "reflex", base: 3 }, dmg: [2, 4], pen: 0, critBonus: 2,
    cooldown: 2, effect: { type: "artificerTangleLine", movementPressure: 18, bossScale: 0.35, duration: 2, sourceOwned: true, target: "enemy" },
    artificerChargeCost: 1, artificerChargeCommitSpend: true,
    desc: "Commit one Charge to launch a real cord-and-anchor restraint. Armour answers the impact and the line creates bounded, boss-softened movement pressure rather than magical rooting.",
  },
  { ...artificerIdentity,
    id: "artificer-arc-node", name: "Arc Node", icon: "sparkle",
    target: "enemy", damageType: null, scaling: "none", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: null, pen: 0, critBonus: 0,
    cooldown: 3, effect: { type: "artificerArcNode", deviceDamageBonus: 15, cap: 0.05, duration: 3, sourceOwned: true, target: "enemy" },
    artificerChargeCost: 1, artificerChargeCommitSpend: true,
    desc: "Commit one Charge to plant this Artificer's source-owned conductive node. Later native device hits gain a bounded ward-respecting bonus; another maker cannot claim it.",
  },
  { ...artificerIdentity,
    id: "artificer-countermeasure", name: "Countermeasure", icon: "shield",
    target: "all-allies", damageType: null, scaling: "none", scaleAttr: "wit",
    weaponReq: null, statReq: { attr: "wit", base: 4 }, dmg: null, pen: 0, critBonus: 0,
    cooldown: 4, effect: { type: "artificerCountermeasure", removeHarmfulStatuses: 1, ward: 4, duration: 1, target: "ally" },
    artificerChargeCost: 1, artificerChargeCommitSpend: true,
    desc: "Commit one Charge to deploy a prepared narrow countermeasure across allies, removing at most one ordinary harmful condition each and adding a small bounded ward. It is not generic Dispel.",
  },
  { ...artificerIdentity,
    id: "artificer-relay-bolt", name: "Relay Bolt", icon: "sparkle",
    target: "all-enemies", damageType: "magical", scaling: "fieldcraft", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 5 }, dmg: [4, 6], pen: 2, critBonus: 2,
    cooldown: 3, effect: null,
    artificerChargeCost: 2, artificerChargeCommitSpend: true,
    desc: "Commit two Charges once to route a prepared discharge across nearby foes. Every contact respects ward and the action never spends again per target.",
  },
  { ...artificerIdentity,
    id: "artificer-repeating-engine", name: "Repeating Engine", icon: "swords",
    target: "enemy", damageType: "physical", scaling: "fieldcraft", scaleAttr: "reflex",
    weaponReq: null, statReq: { attr: "reflex", base: 5 }, dmg: [2, 4], hits: 3, pen: 2, critBonus: 3,
    cooldown: 4, effect: null,
    artificerChargeCost: 2, artificerChargeCommitSpend: true,
    desc: "Commit two Charges once to cycle a three-shot prepared mechanism. Armour applies to every impact and the engine cannot multiply its Charge cost per hit.",
  },
  { ...artificerIdentity,
    id: "artificer-adaptive-plating", name: "Adaptive Plating", icon: "shield",
    target: "all-allies", damageType: null, scaling: "none", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 6 }, dmg: null, pen: 0, critBonus: 0,
    cooldown: 4, effect: { type: "artificerAdaptivePlating", block: 8, ward: 6, cap: 0.10, duration: 2, target: "ally" },
    artificerChargeCost: 2, artificerChargeCommitSpend: true,
    desc: "Commit two Charges to unfold fitted plates and emitters across willing allies. The bounded physical Block and ward heal nothing and never become conjured armour or immunity.",
  },
  { ...artificerIdentity,
    id: "artificer-collapse-charge", name: "Collapse Charge", icon: "flame",
    target: "enemy", damageType: "physical", scaling: "fieldcraft", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 6 }, dmg: [9, 14], pen: 6, critBonus: 5,
    cooldown: 5, effect: { type: "artificerCollapseCharge", structurePressure: 22, bossScale: 0.35, duration: 2, target: "enemy" },
    artificerChargeCost: 3, artificerChargeCommitSpend: true,
    desc: "Commit three Charges to trigger one shaped breach package. Armour still applies, massive targets soften its pressure, and the device never deals true damage or erases a structure by name.",
  },
  { ...artificerIdentity,
    id: "artificer-masterwork-array", name: "Masterwork Array", icon: "shield",
    target: "all-allies", damageType: null, scaling: "none", scaleAttr: "wit",
    weaponReq: null, statReq: { attr: "wit", base: 7 }, dmg: null, pen: 0, critBonus: 0,
    cooldown: 5, effect: { type: "artificerMasterworkArray", accuracyBonus: 12, block: 8, ward: 8, duration: 3, target: "ally" },
    artificerChargeCost: 4, artificerChargeCommitSpend: true,
    desc: "Commit four Charges once to coordinate a finite targeting and protection array for willing allies. It adds bounded aim, Block, and ward without extra actions, healing, or autonomous attacks.",
  },
  { ...artificerIdentity,
    id: "artificer-grand-invention", name: "Grand Invention", icon: "sparkle",
    target: "all-enemies", damageType: "magical", scaling: "fieldcraft", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 7 }, dmg: [8, 12], pen: 4, critBonus: 5,
    cooldown: 6, effect: { type: "artificerGrandInvention", devicePressure: 24, bossScale: 0.35, duration: 2, target: "enemy" },
    artificerChargeCost: 5, artificerChargeCommitSpend: true,
    desc: "Commit all five Charges once to activate the apex prepared array across nearby foes. Ward applies, bosses soften its pressure, and no spontaneous spell, summon, or permanent machine appears.",
  },

  // Specialization devices: one root device and one mature-method device for
  // each workshop. Level-fifty masteries deepen stewardship without another card.
  { ...artificerIdentity,
    id: "artificer-inscribed-ward", name: "Inscribed Ward", icon: "shield",
    target: "all-allies", damageType: null, scaling: "none", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 3 }, dmg: null, pen: 0, critBonus: 0,
    cooldown: 3, effect: { type: "artificerInscribedWard", ward: 8, cap: 0.08, duration: 2, target: "ally" },
    artificerChargeCost: 1, artificerChargeCommitSpend: true, branchExclusive: true,
    desc: "Commit one Charge to activate prepared inscriptions on carried substrates, granting willing allies bounded ward. The device is neither spontaneous abjuration nor a permanent enchantment.",
  },
  { ...artificerIdentity,
    id: "artificer-flash-phial", name: "Flash Phial", icon: "flame",
    target: "all-enemies", damageType: "physical", scaling: "fieldcraft", scaleAttr: "wit",
    weaponReq: null, statReq: { attr: "wit", base: 3 }, dmg: [2, 3], pen: 0, critBonus: 0,
    cooldown: 3, effect: { type: "artificerFlashPhial", accuracyPenalty: 12, duration: 2, target: "enemy" },
    artificerChargeCost: 1, artificerChargeCommitSpend: true, branchExclusive: true,
    desc: "Commit one Charge to break a prepared flash-and-smoke phial. Armour answers fragments and bounded glare fouls aim; it creates no magical blindness or fire spell.",
  },
  { ...artificerIdentity,
    id: "artificer-clockwork-sentinel", name: "Clockwork Sentinel", icon: "shield",
    target: "self", damageType: null, scaling: "none", scaleAttr: "wit",
    weaponReq: null, statReq: { attr: "wit", base: 3 }, dmg: null, pen: 0, critBonus: 0,
    cooldown: 3, effect: { type: "artificerClockworkSentinel", block: 10, counterPressure: 10, duration: 2, target: "self" },
    artificerChargeCost: 1, artificerChargeCommitSpend: true, branchExclusive: true,
    desc: "Commit one Charge to unfold a narrow watch-and-guard mechanism. It supplies bounded Block and counter pressure but is equipment, not a summoned creature or extra combatant.",
  },
  { ...artificerIdentity,
    id: "artificer-deployable-barricade", name: "Deployable Barricade", icon: "shield",
    target: "all-allies", damageType: null, scaling: "none", scaleAttr: "body",
    weaponReq: null, statReq: { attr: "body", base: 3 }, dmg: null, pen: 0, critBonus: 0,
    cooldown: 3, effect: { type: "artificerDeployableBarricade", block: 8, projectileReduction: 0.15, cap: 0.08, duration: 3, target: "ally" },
    artificerChargeCost: 1, artificerChargeCommitSpend: true, branchExclusive: true,
    desc: "Commit one Charge to brace a carried barrier across the allied line. It grants bounded cover, occupies real space, and can be bypassed or destroyed.",
  },
  { ...artificerIdentity,
    id: "artificer-layered-seal", name: "Layered Seal", icon: "shield",
    target: "all-allies", damageType: null, scaling: "none", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: null, pen: 0, critBonus: 0,
    cooldown: 4, effect: { type: "artificerLayeredSeal", ward: 12, cap: 0.10, pressureResistance: 15, duration: 2, target: "ally" },
    artificerChargeCost: 2, artificerChargeCommitSpend: true, branchExclusive: true,
    desc: "Commit two Charges to activate independently inspected inscription layers. Their ward and interference resistance remain bounded and grant no invulnerability or generic dispel.",
  },
  { ...artificerIdentity,
    id: "artificer-runic-edge", name: "Runic Edge", icon: "swords",
    target: "all-allies", damageType: null, scaling: "none", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: null, pen: 0, critBonus: 0,
    cooldown: 4, effect: { type: "artificerRunicEdge", physicalDamageBonus: 12, penBonus: 2, duration: 2, target: "ally" },
    artificerChargeCost: 2, artificerChargeCommitSpend: true, branchExclusive: true,
    desc: "Commit two Charges to energize prepared weapon fittings for willing allies. The bounded physical edge respects armour and grants neither weapon proficiency nor a Warrior technique.",
  },
  { ...artificerIdentity,
    id: "artificer-restorative-aerosol", name: "Restorative Aerosol", icon: "droplet",
    target: "all-allies", damageType: null, scaling: "none", scaleAttr: "wit",
    weaponReq: null, statReq: { attr: "wit", base: 4 }, dmg: null, pen: 0, critBonus: 0,
    cooldown: 4, effect: { type: "artificerRestorativeAerosol", removeHarmfulStatuses: 1, morale: 8, duration: 2, target: "ally" },
    artificerChargeCost: 2, artificerChargeCommitSpend: true, branchExclusive: true,
    desc: "Commit two Charges to release a verified stabilizing wash over willing allies. It removes at most one ordinary condition and steadies morale without healing lost health or replacing diagnosis.",
  },
  { ...artificerIdentity,
    id: "artificer-fracture-compound", name: "Fracture Compound", icon: "flame",
    target: "enemy", damageType: "physical", scaling: "fieldcraft", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: [6, 9], pen: 5, critBonus: 3,
    cooldown: 4, effect: { type: "artificerFractureCompound", armorPressure: 15, bossScale: 0.35, duration: 2, sourceOwned: true, target: "enemy" },
    artificerChargeCost: 2, artificerChargeCommitSpend: true, branchExclusive: true,
    desc: "Commit two Charges to apply a prepared fracture compound against one surface. Armour still mitigates the physical burst and the bounded pressure never becomes true damage.",
  },
  { ...artificerIdentity,
    id: "artificer-interception-automaton", name: "Interception Automaton", icon: "shield",
    target: "all-allies", damageType: null, scaling: "none", scaleAttr: "wit",
    weaponReq: null, statReq: { attr: "wit", base: 4 }, dmg: null, pen: 0, critBonus: 0,
    cooldown: 4, effect: { type: "artificerInterceptionAutomaton", share: 0.20, cap: 0.08, duration: 2, target: "ally" },
    artificerChargeCost: 2, artificerChargeCommitSpend: true, branchExclusive: true,
    desc: "Commit two Charges to unfold a short-lived interception mechanism that absorbs a bounded share of eligible harm. It is no summoned ally and creates no independent turn.",
  },
  { ...artificerIdentity,
    id: "artificer-overclock-servo", name: "Overclock Servo", icon: "sparkle",
    target: "all-allies", damageType: null, scaling: "none", scaleAttr: "reflex",
    weaponReq: null, statReq: { attr: "reflex", base: 4 }, dmg: null, pen: 0, critBonus: 0,
    cooldown: 4, effect: { type: "artificerOverclockServo", accuracyBonus: 12, dodgeBonus: 8, duration: 2, target: "ally" },
    artificerChargeCost: 2, artificerChargeCommitSpend: true, branchExclusive: true,
    desc: "Commit two Charges to overdrive fitted assistance for willing allies. It improves bounded physical timing without Haste, bonus actions, teleportation, or Monk technique.",
  },
  { ...artificerIdentity,
    id: "artificer-shaped-demolition", name: "Shaped Demolition", icon: "flame",
    target: "enemy", damageType: "physical", scaling: "fieldcraft", scaleAttr: "mind",
    weaponReq: null, statReq: { attr: "mind", base: 4 }, dmg: [7, 11], pen: 6, critBonus: 4,
    cooldown: 4, effect: { type: "artificerShapedDemolition", structurePressure: 20, bossScale: 0.35, duration: 2, target: "enemy" },
    artificerChargeCost: 2, artificerChargeCommitSpend: true, branchExclusive: true,
    desc: "Commit two Charges to trigger a precisely cased breach device. Armour and mass remain relevant, and the shaped blast cannot erase a structure or creature by declaration.",
  },
  { ...artificerIdentity,
    id: "artificer-bulwark-frame", name: "Bulwark Frame", icon: "shield",
    target: "all-allies", damageType: null, scaling: "none", scaleAttr: "body",
    weaponReq: null, statReq: { attr: "body", base: 4 }, dmg: null, pen: 0, critBonus: 0,
    cooldown: 4, effect: { type: "artificerBulwarkFrame", block: 12, forcedMoveResistance: 20, duration: 3, target: "ally" },
    artificerChargeCost: 2, artificerChargeCommitSpend: true, branchExclusive: true,
    desc: "Commit two Charges to lock a carried frame into real footing. It grants bounded physical Block and stability while remaining flankable, breakable, and dependent on space.",
  },
  // ---- Martial apex ----
  { id: "earthshatter", name: "Earthshatter", school: "martial", icon: "swords", target: "all-enemies", damageType: "physical", scaling: "weapon", scaleAttr: "body", weaponReq: ["mace", "axe", "spear", "sword"], statReq: { attr: "body", base: 5 }, dmg: [4, 7], pen: 2, critBonus: 0, resolveCost: 0, cooldown: 4, effect: { type: "stun", value: 1, duration: 1, target: "enemy" }, desc: "Smash the ground — a shockwave that staggers every foe near you. Heavy melee." },
  { id: "reaping", name: "Reaping", school: "martial", icon: "swords", target: "all-enemies", damageType: "true", scaling: "weapon", scaleAttr: "body", weaponReq: ["sword", "axe", "spear"], statReq: { attr: "body", base: 6 }, dmg: [6, 10], pen: 0, critBonus: 5, resolveCost: 0, cooldown: 4, effect: null, desc: "A reaping sweep that bites through all defence, striking every foe at once. Heavy blades." },
  { id: "wrath", name: "Wrath", school: "martial", icon: "flame", target: "self", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 4 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 0, cooldown: 5, effect: { type: "rally", value: 50, duration: 3, target: "self" }, desc: "Become wrath incarnate — your blows land devastatingly harder for a few turns." },

  // ---- INNATE (racial) — granted by RACE at creation, never dropped/taught.
  //      Not "learned magic": these are a kindred's inborn nature (see data/races.js). ----
  { id: "dragon-breath", name: "Dragon Breath", school: "arcane", icon: "flame", target: "all-enemies", damageType: "magical", scaling: "stat", scaleAttr: "vigor", weaponReq: null, statReq: { attr: "vigor", base: 3 }, dmg: [4, 8], pen: 2, critBonus: 0, resolveCost: 2, cooldown: 3, effect: { type: "burn", value: 4, duration: 3, target: "enemy" }, innate: true, desc: "Exhale the fire (or frost, or storm) in your blood — a cone that sears every foe before you." },
  { id: "blood-siphon", name: "Blood Siphon", school: "shadow", icon: "droplet", target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "body", weaponReq: null, statReq: { attr: "body", base: 3 }, dmg: [4, 8], pen: 2, critBonus: 5, resolveCost: 1, cooldown: 2, effect: { type: "drain", value: 40, target: "self" }, innate: true, desc: "Tear the vitality from a foe's veins at a distance to feed your own — your wounds close as theirs open (your vampiric nature drinks the spilled blood)." },
  { id: "rending-claws", name: "Rending Claws", school: "martial", icon: "swords", target: "enemy", damageType: "physical", scaling: "stat", scaleAttr: "body", weaponReq: null, statReq: { attr: "body", base: 3 }, dmg: [4, 7], pen: 1, critBonus: 5, resolveCost: 0, cooldown: 1, effect: { type: "bleed", value: 2, duration: 2, target: "enemy" }, innate: true, desc: "Tear with claw and fang — fast, bloody strikes no smith forged." },
  { id: "beast-shift", name: "Beast-Shift", school: "survival", icon: "moon", target: "self", damageType: null, scaling: "none", scaleAttr: "vigor", weaponReq: null, statReq: null, dmg: null, pen: 0, critBonus: 0, resolveCost: 1, cooldown: 4, effect: { type: "rally", value: 35, duration: 3, target: "self" }, innate: true, desc: "Let the beast rise — fury and strength surge for a few savage turns." },
  { id: "hellfire-bolt", name: "Hellfire Bolt", school: "arcane", icon: "flame", target: "enemy", damageType: "magical", scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 3 }, dmg: [5, 9], pen: 2, critBonus: 0, resolveCost: 1, cooldown: 1, effect: { type: "burn", value: 3, duration: 2, target: "enemy" }, innate: true, desc: "Hurl a gout of infernal fire from your tainted blood." },
  { id: "dread-aura", name: "Dread Aura", school: "shadow", icon: "moon", target: "all-enemies", damageType: null, scaling: "none", scaleAttr: "presence", weaponReq: null, statReq: { attr: "presence", base: 3 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 2, cooldown: 4, effect: { type: "weaken", value: 25, duration: 2, target: "enemy" }, innate: true, desc: "Loose the fear in your blood — foes falter, their blows weakened." },
];

// TIER FLOORS — the minimum grade an ability can exist at, graded by raw power so
// the catalogue spreads across the ladder instead of piling up at Common. A
// world-unmaking spell is meaningless as a common trinket; an AoE stun or a heavy
// debuff outclasses a basic strike. Grants/drops below the floor are clamped up
// (region-capped loot skips them instead). Stamped onto the def objects so every
// consumer — the narrator's grantable list, in-play learning, and loot — sees it.
//
// Unlisted = Common (the starter kit: basic strikes + cheap cantrips). Innate
// racial powers are deliberately left unfloored — they are kindred identity, not
// gated loot. Rubric: Uncommon = solid single-target or a clean rider (bleed/
// burn/weaken/shield/minor heal); Rare = control (stun), AoE, or a strong debuff/
// nuke; Very-Rare = premium tempo or a heavy single-target nuke; Epic = AoE
// control/debuff, big heals, signature self-buffs; Legendary = battlefield-enders.
const ABILITY_TIER_FLOOR = {
  // Uncommon — dependable techniques and riders, a step above the basics.
  "piercing-thrust": "uncommon", rend: "uncommon", "venom-strike": "uncommon",
  "aimed-shot": "uncommon", "hamstring-shot": "uncommon", "rallying-shout": "uncommon",
  "second-wind": "uncommon", shadowstep: "uncommon", "bulwark-stance": "uncommon",
  "mana-shield": "uncommon", combust: "uncommon", "frost-lance": "uncommon",
  "disarming-strike": "uncommon", feint: "uncommon", lunge: "uncommon",
  "piercing-shot": "uncommon", "battle-focus": "uncommon", wither: "uncommon",
  "ice-shard": "uncommon", "stone-armor": "uncommon", heal: "uncommon", bless: "uncommon",
  "shield-of-faith": "uncommon", hex: "uncommon", "life-drain": "uncommon", "mirror-image": "uncommon",
  "warrior-guarded-cut": "uncommon", "warrior-passing-step": "uncommon", "warrior-weapon-bind": "uncommon",
  "warrior-weapon-change": "uncommon", "warrior-braced-advance": "uncommon", "warrior-second-breath": "uncommon",
  "monk-three-beat-strike": "uncommon", "monk-yielding-guard": "uncommon", "monk-joint-check": "uncommon",
  "monk-open-hand-parry": "uncommon", "monk-iron-body-brace": "uncommon", "monk-burst-step": "uncommon", "monk-kata-entry": "uncommon",
  "barbarian-bait-the-blow": "uncommon", "barbarian-fury-hewn-strike": "uncommon",
  "barbarian-reaver-sweep": "uncommon", "barbarian-berserker-abandon": "uncommon", "barbarian-juggernaut-check": "uncommon", "barbarian-clan-challenge": "uncommon",
  "bard-steady-beat": "uncommon", "bard-cutting-verse": "uncommon", "bard-rising-tempo": "uncommon", "bard-dissonant-chord": "uncommon",
  "bard-war-drum": "uncommon", "bard-pointed-satire": "uncommon", "bard-resonant-pulse": "uncommon", "bard-lore-callout": "uncommon",
  "ranger-ranging-shot": "uncommon", "ranger-field-dressing": "uncommon", "ranger-trail-cut": "uncommon",
  "ranger-patient-aim": "uncommon", "ranger-pathfinder-step": "uncommon", "ranger-companion-signal": "uncommon", "ranger-set-snare": "uncommon",
  "rogue-testing-cut": "uncommon", "rogue-slip-the-line": "uncommon", "rogue-false-opening": "uncommon", "rogue-exploit-guard": "uncommon",
  "rogue-silent-entry": "uncommon", "rogue-brazen-feint": "uncommon", "rogue-killing-measure": "uncommon", "rogue-fault-finder": "uncommon",
  "paladin-stand-fast": "uncommon", "paladin-challenge-of-witness": "uncommon",
  "paladin-shield-covenant": "uncommon", "paladin-call-to-account": "uncommon", "paladin-offer-quarter": "uncommon", "paladin-beacon-stance": "uncommon",
  "druid-leafrot": "uncommon", "druid-rimebark": "uncommon",
  "druid-grove-awakening": "uncommon", "druid-predator-shape": "uncommon", "druid-gale-shear": "uncommon", "druid-decay-mark": "uncommon",
  "warlock-debt-mark": "uncommon", "warlock-favors-rebuke": "uncommon", "warlock-open-covenant": "uncommon", "warlock-owed-ward": "uncommon",
  "warlock-hellfire-covenant": "uncommon", "warlock-witch-mark": "uncommon", "warlock-pact-chain": "uncommon", "warlock-whispered-terms": "uncommon",
  "artificer-guard-projector": "uncommon", "artificer-tangle-line": "uncommon", "artificer-arc-node": "uncommon",
  "artificer-inscribed-ward": "uncommon", "artificer-flash-phial": "uncommon", "artificer-clockwork-sentinel": "uncommon", "artificer-deployable-barricade": "uncommon",
  // Rare — control (stun), AoE, strong debuffs and nukes.
  cleave: "rare", execute: "rare", "frost-nova": "rare", curse: "rare", smite: "rare",
  "shield-bash": "rare", "concussive-blow": "rare", whirlwind: "rare", "arrow-volley": "rare",
  "pinning-shot": "rare", snare: "rare", enfeeble: "rare", terrify: "rare", fireball: "rare",
  radiance: "rare", electrocute: "rare", "deep-freeze": "rare", blizzard: "rare", plague: "rare",
  "arcane-aegis": "rare", enervation: "rare", "purifying-light": "rare",
  "consecrated-strike": "rare", "verdant-aegis": "rare",
  "warrior-turning-parry": "rare", "warrior-sweeping-denial": "rare", "warrior-break-guard": "rare",
  "warrior-riposte-guard": "rare", "warrior-crosscut-sequence": "rare", "warrior-read-opponent": "rare",
  "warrior-stop-thrust": "rare", "warrior-break-line": "rare", "warrior-shake-it-off": "rare",
  "monk-reaping-kick": "rare", "monk-crossing-step": "rare", "monk-posture-break": "rare",
  "monk-locking-palm": "rare", "monk-wheel-throw": "rare", "monk-absorbing-frame": "rare", "monk-breaking-knuckle": "rare",
  "monk-rebound-step": "rare", "monk-vaulting-knee": "rare", "monk-staff-circuit": "rare", "monk-temple-blade-arc": "rare",
  "barbarian-reckless-onslaught": "rare", "barbarian-savage-reprisal": "rare", "barbarian-crashing-advance": "rare",
  "barbarian-blood-trail": "rare", "barbarian-wide-ruin": "rare", "barbarian-pain-eater": "rare", "barbarian-red-haze": "rare",
  "barbarian-living-ram": "rare", "barbarian-mountain-frame": "rare", "barbarian-foe-caller": "rare", "barbarian-war-cry": "rare",
  "bard-call-and-response": "rare", "bard-stinging-refrain": "rare", "bard-crescendo": "rare",
  "bard-marching-cadence": "rare", "bard-defiant-anthem": "rare", "bard-hecklers-hook": "rare", "bard-chorus-of-scorn": "rare",
  "bard-old-ballad": "rare", "bard-battle-chronicle": "rare",
  "ranger-pinpoint-volley": "rare", "ranger-evading-step": "rare", "ranger-crippling-shot": "rare", "ranger-pursuit-line": "rare",
  "ranger-read-monster": "rare", "ranger-deadeye-breath": "rare", "ranger-safe-passage": "rare", "ranger-running-shot": "rare",
  "ranger-pack-command": "rare", "ranger-falcon-stoop": "rare", "ranger-layered-snare": "rare", "ranger-kill-zone": "rare",
  "rogue-sap-blow": "rare", "rogue-concealed-shift": "rare", "rogue-hamstring": "rare", "rogue-switchback-feint": "rare",
  "rogue-high-window": "rare", "rogue-crowd-ghost": "rare", "rogue-confidence-play": "rare", "rogue-dirty-trick": "rare",
  "rogue-first-strike": "rare", "rogue-venom-work": "rare", "rogue-master-key": "rare",
  "paladin-bear-the-blow": "rare", "paladin-steadfast-word": "rare", "paladin-judgment-stroke": "rare", "paladin-merciful-arrest": "rare",
  "paladin-rampart-exchange": "rare", "paladin-threshold-blow": "rare", "paladin-verdict-edge": "rare", "paladin-peace-command": "rare",
  "paladin-redeeming-intercession": "rare", "paladin-burden-taken": "rare", "paladin-pilgrim-aegis": "rare",
  "druid-saprise": "rare", "druid-sirocco": "rare",
  "druid-entangling-thicket": "rare", "druid-ironbark-rise": "rare", "druid-wolf-aspect": "rare", "druid-bear-aspect": "rare",
  "druid-stormbolt": "rare", "druid-sunwheel": "rare", "druid-moldering-wave": "rare", "druid-reclamation-bloom": "rare",
  "warlock-covenant-lash": "rare", "warlock-creditors-gaze": "rare", "warlock-claim-due": "rare",
  "warlock-infernal-volley": "rare", "warlock-devils-due": "rare", "warlock-layered-hex": "rare", "warlock-sympathetic-token": "rare",
  "warlock-binding-links": "rare", "warlock-shared-burden": "rare", "warlock-secret-leverage": "rare", "warlock-open-bargain": "rare",
  "artificer-countermeasure": "rare", "artificer-relay-bolt": "rare", "artificer-repeating-engine": "rare",
  "artificer-layered-seal": "rare", "artificer-runic-edge": "rare", "artificer-restorative-aerosol": "rare", "artificer-fracture-compound": "rare",
  "artificer-interception-automaton": "rare", "artificer-overclock-servo": "rare", "artificer-shaped-demolition": "rare", "artificer-bulwark-frame": "rare",
  // Very-Rare — premium tempo and the heaviest single-target nukes.
  haste: "very-rare", "chain-lightning": "very-rare", "lightning-bolt": "very-rare",
  "beguiling-command": "very-rare", "phantasmal-killer": "very-rare", "elemental-surge": "very-rare",
  "summon-undead": "very-rare", "flesh-to-stone": "very-rare", "arcane-convergence": "very-rare",
  "turn-profane": "very-rare", "storm-rebuke": "very-rare", "sacred-misdirection": "very-rare",
  "warrior-masterstroke": "very-rare", "warrior-iron-sequence": "very-rare", "warrior-adaptive-form": "very-rare",
  "warrior-seize-tempo": "very-rare", "warrior-deny-approach": "very-rare",
  "monk-cascade-blows": "very-rare", "monk-resonant-impact": "very-rare", "monk-shoulder-throw": "very-rare",
  "barbarian-armour-crumpler": "very-rare", "barbarian-great-arc": "very-rare", "barbarian-grit-through": "very-rare",
  "bard-syncopated-break": "very-rare", "bard-heartening-chorus": "very-rare", "bard-counter-melody": "very-rare",
  "bard-shattertone": "very-rare", "bard-harmonic-weave": "very-rare",
  "ranger-covering-shot": "very-rare", "ranger-kill-window": "very-rare", "ranger-relentless-trail": "very-rare",
  "rogue-kidney-shot": "very-rare", "rogue-finishing-angle": "very-rare", "rogue-planned-collapse": "very-rare",
  "paladin-hold-the-line": "very-rare", "paladin-oathfire-edge": "very-rare", "paladin-sunward-cut": "very-rare",
  "druid-harvest-tide": "very-rare", "druid-frostroot": "very-rare",
  "warlock-ruinous-terms": "very-rare", "warlock-fivefold-collection": "very-rare",
  "artificer-adaptive-plating": "very-rare", "artificer-collapse-charge": "very-rare",
  // Epic — AoE control/debuff, big heals, signature self-buffs.
  tempest: "epic", "time-stop": "epic", "soul-rend": "epic", "mass-terror": "epic",
  judgment: "epic", dawnburst: "epic", renewal: "epic", earthshatter: "epic",
  reaping: "epic", wrath: "epic", sanctuary: "epic", doom: "epic",
  "spell-reflection": "epic", "death-clutch": "epic", "soul-siphon": "epic",
  "greater-invisibility": "epic", polymorph: "epic", "divine-intercession": "epic", exorcise: "epic",
  "warrior-veteran-reversal": "epic", "warrior-last-stand": "epic",
  "monk-ascending-knee": "epic",
  "barbarian-ruinous-collision": "epic", "barbarian-unrelenting-assault": "epic",
  "paladin-last-witness": "epic",
  "druid-living-canopy": "epic", "druid-high-summer": "epic", "druid-return-to-soil": "epic",
  "warlock-black-bargain": "epic",
  "artificer-masterwork-array": "epic",
  // Legendary — battlefield-enders.
  disintegrate: "legendary", meteor: "legendary", "antimagic-field": "legendary", geas: "legendary",
  "warrior-perfect-technique": "legendary",
  "monk-perfect-impact": "legendary",
  "barbarian-world-shaking-blow": "legendary",
  "bard-grand-finale": "legendary",
  "ranger-perfect-hunt": "legendary",
  "rogue-perfect-opportunity": "legendary",
  "paladin-oath-incarnate": "legendary",
  "druid-great-year": "legendary",
  "warlock-pact-apotheosis": "legendary",
  "artificer-grand-invention": "legendary",
  "grasp-heart": "mythical",
};
for (const a of ABILITY_LIBRARY) { if (ABILITY_TIER_FLOOR[a.id]) a.minTier = ABILITY_TIER_FLOOR[a.id]; }

const LIBRARY_BY_ID = Object.fromEntries(ABILITY_LIBRARY.map((a) => [a.id, a]));
const UNIQUE_BY_ID = Object.fromEntries(UNIQUE_ABILITIES.map((a) => [a.id, a]));
// Unique abilities resolve like any other (once learned), but are NOT in the
// random drop pool — they only come from their authored sources (data/uniques.js).
// Travel spells (fly / dimension-door / gate) are real, grantable abilities so the
// normal grant/known/tier-clamp paths work — but they're flagged `noncombat`, so
// every combat + ability-list consumer filters them out (they drive map travel only).
// Utility registries are spread first so a combat definition can deliberately
// share an id and remain the canonical combat resolver. `haste` is both a road
// boon and a combat spell; the old order let the noncombat boon shadow the card
// definition and silently removed Haste from every deck.
const ALL_BY_ID = { ...TRAVEL_SPELLS, ...BUFF_SPELLS, ...LIBRARY_BY_ID, ...UNIQUE_BY_ID, [BASIC_ATTACK.id]: BASIC_ATTACK, [DEFEND.id]: DEFEND, [TALK.id]: TALK };

// These powers belong to the campaign/world layer even when an id (notably
// Haste) also has a canonical combat definition. Tower archetypes keep access
// to world traversal and utility, but never ingest the legacy combat library.
const LEGACY_WORLD_ABILITY_GRANTS = new Set([
  "fly",
  "dimension-door",
  "gate",
  "haste",
  "bear-strength",
]);

export function getAbilityDef(id) { return ALL_BY_ID[id] || null; }

export function classifyLegacyAbilityGrant(id) {
  if (LEGACY_WORLD_ABILITY_GRANTS.has(id)) return "world";
  return getAbilityDef(id) ? "combat" : "narrative-skill";
}

// Resolve the campaign-layer definition rather than the combat definition when
// an id exists in both registries. Haste is the important overlap: its road boon
// is rare while the retired combat spell is very-rare.
export function worldAbilityGrantDefinition(id) {
  if (!LEGACY_WORLD_ABILITY_GRANTS.has(id)) return null;
  return TRAVEL_SPELLS[id] || BUFF_SPELLS[id] || null;
}

export function clampWorldAbilityTier(id, tierId) {
  const def = worldAbilityGrantDefinition(id);
  const t = tierId || "common";
  if (!def?.minTier) return t;
  return tierInfo(t).order < tierInfo(def.minTier).order ? def.minTier : t;
}

// Raise a granted/dropped tier up to an ability's floor (if it has one), so a
// floored apex power can never be handed out below its minimum grade.
export function clampAbilityTier(id, tierId) {
  const def = getAbilityDef(id);
  const t = tierId || "common";
  if (!def || !def.minTier) return t;
  return tierInfo(t).order < tierInfo(def.minTier).order ? def.minTier : t;
}

// Category for the Codex Abilities catalog. Profession-native disciplines are
// intentionally first-class categories and never enter generic arcane/divine or
// martial cost loops. Primalcraft remains spellcasting, but owns its tradition,
// explicit Resolve costs, seasonal cadence, and Codex category.
export function abilityCategoryOf(def) {
  if (!def) return "martial";
  if (def.innate) return "racial";
  if (def.school === "performance") return "performance";
  if (def.school === "fieldcraft") return "fieldcraft";
  if (def.school === "subterfuge") return "subterfuge";
  if (def.school === "oathcraft") return "oathcraft";
  if (def.school === "primalcraft") return "primalcraft";
  if (def.school === "pactcraft") return "pactcraft";
  if (def.school === "devicecraft") return "devicecraft";
  if (abilityScaling(def) === "stat" || def.school === "arcane" || def.school === "divine") return "spell";
  return "martial";
}

// SPELL RESOLVE COSTS — Resolve is now a finite, rest-gated pool that GROWS WITH
// MIND (engine/attributes.js) and does NOT regenerate in a fight, so spell costs
// are tiered by power to bound the castings a pool yields per rest: a Mind-deep
// archmage burns through many cheap spells but only a handful of apex ones, then
// must rest or drink. MARTIAL stays free (gated by action points + cooldown) and
// INNATE racial powers keep their light authored costs (kindred identity, not
// gated spend). Magnitudes are sim starting points (scripts/combat-sim.mjs).
const SPELL_COST_BY_FLOOR = {
  common: 3, uncommon: 4, rare: 6, "very-rare": 8, epic: 10, legendary: 15, mythical: 20, divine: 25,
};
// Hand-tuned overrides — party force-multipliers and apex utility that the floor
// map under-prices (most aren't tier-floored, so they'd default to Common).
const SPELL_COST_OVERRIDE = {
  "battle-hymn": 8, sanctify: 12, "guardian-aegis": 12, "unbreakable-will": 16, "last-sanctuary": 22,
  "purifying-light": 10, "divine-intercession": 18, "turn-profane": 10, exorcise: 16,
  "consecrated-strike": 6, "storm-rebuke": 10, "verdant-aegis": 12, "sacred-misdirection": 10,
};
for (const a of ABILITY_LIBRARY) {
  if (a.innate || abilityCategoryOf(a) !== "spell") continue;
  a.resolveCost = SPELL_COST_OVERRIDE[a.id] ?? SPELL_COST_BY_FLOOR[a.minTier || "common"];
}

// MARTIAL techniques cost Resolve too — but roughly HALF a spell of the same power
// tier, so a low-Mind fighter's smaller pool still lasts a fight. The basic Strike,
// Brace, and Talk (separate defs below ABILITY_LIBRARY) stay free as the always-
// available fallback when the pool runs dry. Performance, fieldcraft,
// subterfuge, and oathcraft never enter this loop; their profession techniques
// use native state and keep authored zero Resolve costs. Innate racial powers keep their
// light authored costs. Magnitudes are sim starting points.
const MARTIAL_COST_BY_FLOOR = {
  common: 1, uncommon: 2, rare: 3, "very-rare": 4, epic: 5, legendary: 8, mythical: 10, divine: 12,
};
for (const a of ABILITY_LIBRARY) {
  if (a.innate || abilityCategoryOf(a) !== "martial") continue;
  a.resolveCost = MARTIAL_COST_BY_FLOOR[a.minTier || "common"];
}

// Every DEFINED, grantable ability (library + authored uniques). The single
// source of truth the codex audits and the narrator must grant from (by id) —
// each carries its own damage, effects, costs, and requirements.
export const ABILITY_CATALOG = [...ABILITY_LIBRARY, ...UNIQUE_ABILITIES];

// How much an attribute score amplifies an ability. Scores through 30 keep the
// original +8% per point exactly; apex scores use the shared diminishing combat
// value so the expanded 0–90 scale cannot triple every damage multiplier.
export function attrFactor(score) { return 1 + mechanicalAttributeValue(score) * 0.08; }

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

const ATTR_FULL = { body: "Body", reflex: "Reflex", vigor: "Vigor", mind: "Mind", wit: "Wit", presence: "Presence" };

// Human-readable combat stat line for an ability at a DISPLAY tier. Spell and
// performance damage scale by tier; weapon techniques read "weapon damage"
// (their hit is built from the equipped weapon). Shared by the Codex catalog and
// the in-play Arsenal so the two always read identically.
export function abilityStatLine(def, tierId) {
  const p = [];
  const scaling = abilityScaling(def);
  if (scaling === "weapon" || def.damageType === "weapon") {
    if (def.rangerDamageForm) p.push(`weapon damage (${def.damageType || "physical"} ${def.rangerDamageForm})`);
    else p.push(def.damageType && def.damageType !== "weapon" && def.damageType !== "physical" ? `weapon damage (${def.damageType})` : "weapon damage");
  } else if (def.dmg) {
    const m = tierMult(tierId || def.minTier || def.tier || "common");
    const damageLabel = def.rangerDamageForm
      ? `${def.damageType || "physical"} ${def.rangerDamageForm}`
      : (def.damageType || "physical");
    p.push(`dmg ${Math.round(def.dmg[0] * m)}–${Math.round(def.dmg[1] * m)} ${damageLabel}`);
  }
  if (def.pen) p.push(`pen ${def.pen}`);
  if (def.critBonus) p.push(`+${def.critBonus}% crit`);
  if (def.hits > 1) p.push(`×${def.hits} hits`);
  p.push(def.target === "all-enemies" ? "all foes" : def.target === "all-allies" ? "all allies" : def.target === "self" ? "self" : "1 foe");
  if (def.effect && def.effect.type) {
    const e = def.effect;
    p.push(`${e.type}${e.value ? ` ${e.value}` : ""}${e.duration ? ` ${e.duration}t` : ""}`);
  }
  if (def.resolveCost) p.push(`${def.resolveCost} resolve`);
  if (def.warriorSequenceTag) p.push("builds Martial Tempo on a new sequence");
  if (def.warriorTempoCost) p.push(`cost ${def.warriorTempoCost} Martial Tempo${def.warriorConsumeAllTempo ? " (spends all)" : ""}`);
  if (def.monkPostureBuild) p.push(`adds up to ${def.monkPostureBuild} target Posture Strain per action`);
  if (def.monkPostureCost) p.push(`spends ${def.monkPostureCost} target Posture Strain`);
  if (def.barbarianFuryBuild) p.push(`provokes up to ${def.barbarianFuryBuild} Fury with exposed guard`);
  if (def.barbarianFuryCost) p.push(`cost ${def.barbarianFuryCost} Fury`);
  if (def.bardMotif) p.push(`${def.bardMotif} motif`);
  if (def.bardCadenceBuild) p.push(`builds ${def.bardCadenceBuild} Cadence on motif change (max ${def.bardCadenceMax || 4})`);
  if (def.bardCadenceCost) p.push(`cost ${def.bardCadenceCost} Cadence`);
  if (def.audible) p.push("audible");
  if (def.bardRequiresUnderstanding || def.requiresUnderstanding) p.push("requires understanding");
  if (def.effect?.type === "rangerQuarrySign") p.push("binds quarry; switching resets prior Insight");
  if (def.rangerQuarryInsightBuild) p.push(`builds ${def.rangerQuarryInsightBuild} Quarry Insight on successful ${String(def.rangerQuarryBuildTrigger || "setup").replace("companion-hit", "companion hit")} (max ${def.rangerQuarryInsightMax || 5})`);
  if (def.rangerQuarryInsightCost) p.push(`cost ${def.rangerQuarryInsightCost} Quarry Insight once`);
  if (def.rogueOpeningBuild) p.push(`creates your ${def.rogueOpeningDuration || 2}t Opportunity Window on target after successful ${def.rogueOpeningBuildTrigger || "setup"}`);
  if (def.rogueOpeningExploit) p.push("exploits and consumes your Opportunity Window once");
  if (def.roguePhysicalToxin) p.push("bounded physical toxin");
  if (def.paladinConvictionOnIntercept) p.push(`builds ${def.paladinConvictionOnIntercept} Conviction only after ally damage is actually intercepted (max ${def.paladinConvictionMax || 5})`);
  if (def.paladinConvictionOnAbsorb) p.push(`builds ${def.paladinConvictionOnAbsorb} Conviction only after a real hit consumes Block (max ${def.paladinConvictionMax || 5})`);
  if (def.paladinConvictionCost) p.push(`cost ${def.paladinConvictionCost} Conviction${def.paladinConvictionCommitSpend ? " (committed once)" : ""}`);
  if (def.effect?.share) p.push(`guards ${Math.round(def.effect.share * 100)}% ally damage${def.effect.cap ? ` (cap ${Math.round(def.effect.cap * 100)}% max HP per hit)` : ""}`);
  if (def.effect?.block) p.push(`bounded ${def.effect.block} ${def.effect.physicalOnly ? "physical " : ""}Block`);
  if (def.effect?.fearSteadiness) p.push(`fear steadiness ${def.effect.fearSteadiness}`);
  if (def.effect?.morale) p.push(`morale support ${def.effect.morale}`);
  if (def.effect?.visibilitySupport) p.push(`visibility support ${def.effect.visibilitySupport}`);
  if (def.effect?.clearFear) p.push("clears ordinary fear");
  if (def.nonlethal || def.effect?.nonlethal) p.push("nonlethal");
  if (def.paladinRadiantRider) {
    const rider = typeof def.paladinRadiantRider === "number" ? { value: def.paladinRadiantRider } : def.paladinRadiantRider;
    p.push(`${Math.round((rider.value || 0) * 100)}% bounded radiant rider vs profane (ward applies${rider.cap ? `; cap ${Math.round(rider.cap * 100)}% max HP` : ""})`);
  }
  if (def.druidSeason && def.druidSeasonSurge) {
    const surge = def.druidSeasonSurge;
    p.push(`${def.druidSeason} season · matching surge +${Math.round(Math.min(surge.bonus || 0, surge.cap || 0) * 100)}% ${surge.appliesTo}`);
  }
  if (def.warlockPactPrice) {
    const price = def.warlockPactPrice;
    if (price.type === "health") p.push(`pays ${Math.round((price.maxHealth || 0) * 100)}% max HP nonlethally once`);
    if (price.type === "exposure") p.push(`pays +${Math.round((price.incomingDamage || 0) * 100)}% incoming damage exposure ${price.duration || 1}t once`);
    if (def.warlockFavorBuildOnPaidPrice) p.push(`builds ${def.warlockFavorBuild || 0} Pact Favor only after price is paid (max ${def.warlockFavorMax || 5})`);
  }
  if (def.warlockFavorCost) p.push(`cost ${def.warlockFavorCost} Pact Favor${def.warlockFavorCommitSpend ? " (committed once)" : ""}`);
  if (def.artificerChargeCost) p.push(`cost ${def.artificerChargeCost} Device Charge${def.artificerChargeCost === 1 ? "" : "s"}${def.artificerChargeCommitSpend ? " (committed once)" : ""}`);
  if (def.artificerRefit && def.effect?.restoreCharges) p.push(`restores ${def.effect.restoreCharges} Device Charges (cap ${def.effect.chargeCap || def.artificerDeviceChargeMax || 5})`);
  if ((def.actionCost || 1) > 1) p.push(`${def.actionCost} AP`);
  if (def.cooldown) p.push(`cd ${def.cooldown}`);
  return p.join(" · ");
}

export function abilityReqLine(def) {
  const b = [];
  if (def.weaponReq && def.weaponReq.length) b.push(`needs ${def.weaponReq.join("/")}`);
  if (def.statReq) b.push(`${ATTR_FULL[def.statReq.attr] || def.statReq.attr} ${def.statReq.base}+`);
  if (def.requiresLineOfSight) b.push("needs line of sight");
  if (def.terrainReq) b.push(`needs ${def.terrainReq}`);
  if (def.requiresFlyingBeastAlly) b.push("needs a trained flying beast ally already present");
  else if (def.requiresTrainedBeastAlly) b.push("needs a trained beast ally already present");
  if (def.requiresBeastPerception) b.push("beast must perceive the signal");
  if (def.rangerRequiresCurrentQuarry) b.push("needs current living quarry");
  if (def.requiresCover) b.push("needs physical cover");
  if (def.requiresCrowdOrCover) b.push("needs a crowd or physical cover");
  if (def.requiresAwareness) b.push("target must be aware");
  if (def.requiresUnderstanding) b.push("target must understand");
  if (def.requiresLivingAnatomy) b.push("needs applicable living anatomy");
  if (def.requiresAccessibleFault) b.push("needs an accessible ordinary fault");
  if (def.requiresAccessibleEquipment) b.push("needs accessible equipment or access point");
  if (def.requiresCarriedPhysicalToxin) b.push("needs a carried mundane toxin");
  if (def.requiresAssessedStructure) b.push("structure or footing must be previously assessed");
  if (def.requiresUnactedTarget) b.push("target must not have committed its first action");
  if (def.toolReq) b.push(`needs ${def.toolReq}`);
  if (def.rogueRequiresOpening) b.push("needs your Opportunity Window on this target");
  if (def.requiresInterceptionLine) b.push("needs a reachable physical interception line to an ally");
  if (def.requiresDefensiblePosition) b.push("needs defensible physical footing");
  if (def.requiresShieldOrGuardingWeapon) b.push("needs a shield or guarding weapon");
  if (def.requiresWillingHearingAllies) b.push("allies must willingly hear and understand");
  if (def.requiresVisibleAllies) b.push("allies must be able to see the Paladin");
  if (def.requiresMeleeReach) b.push("needs physical melee reach");
  if (def.paladinRequiresOwnCallToAccount) b.push("needs your active Call to Account on this target");
  if (def.paladinRadiantRider && def.profaneOnly) b.push("radiant rider applies only to a profane target");
  if (def.requiresOpenSkyOrStorm) b.push("needs open sky or an existing storm");
  if (def.requiresSunlight) b.push("needs real sunlight");
  if (def.requiresReclaimableDecay) b.push("needs nearby reclaimable decay");
  if (def.warlockRequiresOwnDebtMark) b.push("needs your active Debt Mark on this target");
  if (def.warlockRequiresOwnHellfireCovenant) b.push("needs your active Hellfire Covenant on this target");
  if (def.requiresCarriedSympatheticToken) b.push("needs a carried token genuinely linked to the target");
  if (def.requiresKnownSecret) b.push("needs a genuinely known relevant secret");
  return b.join(" · ");
}

export function resolveLearned(entry) {
  const id = typeof entry === "string" ? entry : entry?.id;
  const tierId = (typeof entry === "object" && entry?.tier) || "common";
  const def = getAbilityDef(id);
  return def ? { def, tier: tierId } : null;
}

// Random LIBRARY ability id (never a unique), optionally filtered by school.
export function randomAbilityId(schools = null, random = Math.random) {
  // Innate powers and specialization-exclusive workings are never taught or
  // dropped. The latter enter a kit only through a resolved progression choice.
  const base = ABILITY_LIBRARY.filter((a) => !a.innate && !a.branchExclusive && !a.progressionExclusive);
  const pool = schools ? base.filter((a) => schools.includes(a.school)) : base;
  if (pool.length === 0) return base[0].id;
  return pool[Math.floor(random() * pool.length)].id;
}
