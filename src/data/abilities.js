// Combat abilities. Each definition is the COMMON-tier, attribute-0 baseline;
// the combat engine scales by the ability's tier and the wielder's governing
// attribute. There is NO stamina: abilities cost ACTION POINTS (actionCost,
// default 1) and are gated by cooldown; spells additionally drain narrative
// Resolve (resolveCost). So a martial technique is limited by the action economy
// + its cooldown, a spell by Resolve (casters burst, then run dry).
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
import { mechanicalAttributeValue } from "./attribute-tiers.js";
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
  // Very-Rare — premium tempo and the heaviest single-target nukes.
  haste: "very-rare", "chain-lightning": "very-rare", "lightning-bolt": "very-rare",
  "beguiling-command": "very-rare", "phantasmal-killer": "very-rare", "elemental-surge": "very-rare",
  "summon-undead": "very-rare", "flesh-to-stone": "very-rare", "arcane-convergence": "very-rare",
  "turn-profane": "very-rare", "storm-rebuke": "very-rare", "sacred-misdirection": "very-rare",
  "warrior-masterstroke": "very-rare", "warrior-iron-sequence": "very-rare", "warrior-adaptive-form": "very-rare",
  "warrior-seize-tempo": "very-rare", "warrior-deny-approach": "very-rare",
  "monk-cascade-blows": "very-rare", "monk-resonant-impact": "very-rare", "monk-shoulder-throw": "very-rare",
  "barbarian-armour-crumpler": "very-rare", "barbarian-great-arc": "very-rare", "barbarian-grit-through": "very-rare",
  // Epic — AoE control/debuff, big heals, signature self-buffs.
  tempest: "epic", "time-stop": "epic", "soul-rend": "epic", "mass-terror": "epic",
  judgment: "epic", dawnburst: "epic", renewal: "epic", earthshatter: "epic",
  reaping: "epic", wrath: "epic", sanctuary: "epic", doom: "epic",
  "spell-reflection": "epic", "death-clutch": "epic", "soul-siphon": "epic",
  "greater-invisibility": "epic", polymorph: "epic", "divine-intercession": "epic", exorcise: "epic",
  "warrior-veteran-reversal": "epic", "warrior-last-stand": "epic",
  "monk-ascending-knee": "epic",
  "barbarian-ruinous-collision": "epic", "barbarian-unrelenting-assault": "epic",
  // Legendary — battlefield-enders.
  disintegrate: "legendary", meteor: "legendary", "antimagic-field": "legendary", geas: "legendary",
  "warrior-perfect-technique": "legendary",
  "monk-perfect-impact": "legendary",
  "barbarian-world-shaking-blow": "legendary",
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

export function getAbilityDef(id) { return ALL_BY_ID[id] || null; }

// Raise a granted/dropped tier up to an ability's floor (if it has one), so a
// floored apex power can never be handed out below its minimum grade.
export function clampAbilityTier(id, tierId) {
  const def = getAbilityDef(id);
  const t = tierId || "common";
  if (!def || !def.minTier) return t;
  return tierInfo(t).order < tierInfo(def.minTier).order ? def.minTier : t;
}

// Category for the codex Abilities catalog: innate racial powers, learned spells
// (magic), or martial techniques.
export function abilityCategoryOf(def) {
  if (!def) return "martial";
  if (def.innate) return "racial";
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

// MARTIAL techniques cost resolve too — but roughly HALF a spell of the same power
// tier, so a low-Mind fighter's smaller pool still lasts a fight. The basic Strike,
// Brace, and Talk (separate defs below ABILITY_LIBRARY) stay free as the always-
// available fallback when the pool runs dry. Innate racial powers keep their light
// authored costs. Magnitudes are sim starting points.
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

// Human-readable combat stat line for an ability at a DISPLAY tier. Spell damage
// scales by tier (the same curve the engine applies); weapon techniques read
// "weapon damage" (their hit is built from the equipped weapon); riders, pen, and
// crit are authored flat. Shared by the Codex catalog and the in-play Arsenal so
// the two always read identically.
export function abilityStatLine(def, tierId) {
  const p = [];
  const scaling = abilityScaling(def);
  if (scaling === "weapon" || def.damageType === "weapon") {
    p.push(def.damageType && def.damageType !== "weapon" && def.damageType !== "physical" ? `weapon damage (${def.damageType})` : "weapon damage");
  } else if (def.dmg) {
    const m = tierMult(tierId || def.minTier || def.tier || "common");
    p.push(`dmg ${Math.round(def.dmg[0] * m)}–${Math.round(def.dmg[1] * m)} ${def.damageType || "physical"}`);
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
  if ((def.actionCost || 1) > 1) p.push(`${def.actionCost} AP`);
  if (def.cooldown) p.push(`cd ${def.cooldown}`);
  return p.join(" · ");
}

export function abilityReqLine(def) {
  const b = [];
  if (def.weaponReq && def.weaponReq.length) b.push(`needs ${def.weaponReq.join("/")}`);
  if (def.statReq) b.push(`${ATTR_FULL[def.statReq.attr] || def.statReq.attr} ${def.statReq.base}+`);
  return b.join(" · ");
}

export function resolveLearned(entry) {
  const id = typeof entry === "string" ? entry : entry?.id;
  const tierId = (typeof entry === "object" && entry?.tier) || "common";
  const def = getAbilityDef(id);
  return def ? { def, tier: tierId } : null;
}

// Random LIBRARY ability id (never a unique), optionally filtered by school.
export function randomAbilityId(schools = null) {
  // Innate powers and specialization-exclusive workings are never taught or
  // dropped. The latter enter a kit only through a resolved progression choice.
  const base = ABILITY_LIBRARY.filter((a) => !a.innate && !a.branchExclusive && !a.progressionExclusive);
  const pool = schools ? base.filter((a) => schools.includes(a.school)) : base;
  if (pool.length === 0) return base[0].id;
  return pool[Math.floor(Math.random() * pool.length)].id;
}
