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
  resolveCost: 0, cooldown: 1, effect: null,
  desc: "Speak to your foes — demand surrender, demoralize them, or provoke them. Only the thinking can be reasoned with.",
};

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
  { id: "dominate", name: "Dominate", school: "shadow", icon: "moon", target: "enemy", damageType: null, scaling: "stat", scaleAttr: "mind", weaponReq: null, statReq: { attr: "mind", base: 2 }, dmg: null, pen: 0, critBonus: 0, resolveCost: 6, cooldown: 6, minTier: "mythical", effect: { type: "dominated", value: 1, duration: 2, target: "enemy" }, desc: "Seize a mind and bend it wholly — the thrall turns on its own. Extremely potent, but a strong or higher will throws it off." },
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
  "shield-of-faith": "uncommon", hex: "uncommon", "life-drain": "uncommon",
  // Rare — control (stun), AoE, strong debuffs and nukes.
  cleave: "rare", execute: "rare", "frost-nova": "rare", curse: "rare", smite: "rare",
  "shield-bash": "rare", "concussive-blow": "rare", whirlwind: "rare", "arrow-volley": "rare",
  "pinning-shot": "rare", snare: "rare", enfeeble: "rare", terrify: "rare", fireball: "rare",
  radiance: "rare", electrocute: "rare", "deep-freeze": "rare", blizzard: "rare", plague: "rare",
  // Very-Rare — premium tempo and the heaviest single-target nukes.
  haste: "very-rare", "chain-lightning": "very-rare", "lightning-bolt": "very-rare",
  // Epic — AoE control/debuff, big heals, signature self-buffs.
  tempest: "epic", "time-stop": "epic", "soul-rend": "epic", "mass-terror": "epic",
  judgment: "epic", dawnburst: "epic", renewal: "epic", earthshatter: "epic",
  reaping: "epic", wrath: "epic", sanctuary: "epic", doom: "epic",
  // Legendary — battlefield-enders.
  disintegrate: "legendary", meteor: "legendary",
};
for (const a of ABILITY_LIBRARY) { if (ABILITY_TIER_FLOOR[a.id]) a.minTier = ABILITY_TIER_FLOOR[a.id]; }

const LIBRARY_BY_ID = Object.fromEntries(ABILITY_LIBRARY.map((a) => [a.id, a]));
const UNIQUE_BY_ID = Object.fromEntries(UNIQUE_ABILITIES.map((a) => [a.id, a]));
// Unique abilities resolve like any other (once learned), but are NOT in the
// random drop pool — they only come from their authored sources (data/uniques.js).
// Travel spells (fly / dimension-door / gate) are real, grantable abilities so the
// normal grant/known/tier-clamp paths work — but they're flagged `noncombat`, so
// every combat + ability-list consumer filters them out (they drive map travel only).
const ALL_BY_ID = { ...LIBRARY_BY_ID, ...UNIQUE_BY_ID, ...TRAVEL_SPELLS, ...BUFF_SPELLS, [BASIC_ATTACK.id]: BASIC_ATTACK, [DEFEND.id]: DEFEND, [TALK.id]: TALK };

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
  p.push(def.target === "all-enemies" ? "all foes" : def.target === "self" ? "self" : "1 foe");
  if (def.effect && def.effect.type) {
    const e = def.effect;
    p.push(`${e.type}${e.value ? ` ${e.value}` : ""}${e.duration ? ` ${e.duration}t` : ""}`);
  }
  if (def.resolveCost) p.push(`${def.resolveCost} resolve`);
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
  // Innate (racial) abilities are never taught or dropped — exclude from the pool.
  const base = ABILITY_LIBRARY.filter((a) => !a.innate);
  const pool = schools ? base.filter((a) => schools.includes(a.school)) : base;
  if (pool.length === 0) return base[0].id;
  return pool[Math.floor(Math.random() * pool.length)].id;
}
