// Combat abilities. Each definition is the COMMON-tier, attribute-0 baseline;
// the combat engine scales damage/effects by the ability's tier multiplier and
// the wielder's governing attribute. Abilities are clickable actions spent from
// a per-fight Stamina pool, most gated by a cooldown.
//
// damageType: "physical" (reduced by armour), "magical" (reduced by ward),
//             "true" (ignores both), or null (no direct damage).
// effect.type: bleed/poison (damage-over-time, true), stun (skip a turn),
//             weaken (−outgoing damage), vulnerable (+incoming damage),
//             guard (+armour, temporary), regen (heal/turn), focus (+crit next),
//             rally (+outgoing damage). Effects carry a duration in turns.

import { tierMult } from "./tiers.js";

// Always-available actions — not learned, every combatant has them.
export const BASIC_ATTACK = {
  id: "basic-attack", name: "Strike", school: "martial", icon: "swords",
  target: "enemy", damageType: "weapon", scaleAttr: "weapon",
  dmg: null, pen: 0, critBonus: 0, cost: 1, cooldown: 0, effect: null,
  desc: "A measured blow with your equipped weapon.",
};

export const DEFEND = {
  id: "defend", name: "Brace", school: "martial", icon: "shield",
  target: "self", damageType: null, scaleAttr: "vigor",
  dmg: null, pen: 0, critBonus: 0, cost: 0, cooldown: 0,
  effect: { type: "guard", value: 4, duration: 1, target: "self" },
  desc: "Plant and guard. Adds armour until your next turn and recovers a little stamina.",
};

// Social action — demand surrender. Resolution is handled specially by the
// combat engine (playerParley), scaling off Presence/Wit, the foe's morale and
// wounds, how outmatched it is, and whether you fought it fairly.
export const PARLEY = {
  id: "parley", name: "Demand Surrender", school: "social", icon: "user",
  target: "all-enemies", damageType: null, scaleAttr: "presence",
  dmg: null, pen: 0, critBonus: 0, cost: 1, cooldown: 1, effect: null,
  desc: "Call on your foes to yield. Works best on the wounded, the outmatched, and those you've fought with honor.",
};

export const ABILITY_LIBRARY = [
  {
    id: "power-strike", name: "Power Strike", school: "martial", icon: "swords",
    target: "enemy", damageType: "physical", scaleAttr: "body",
    dmg: [6, 10], pen: 1, critBonus: 5, cost: 2, cooldown: 2, effect: null,
    desc: "A heavy committed swing.",
  },
  {
    id: "rapid-jabs", name: "Rapid Jabs", school: "martial", icon: "swords",
    target: "enemy", damageType: "physical", scaleAttr: "reflex",
    dmg: [2, 4], pen: 0, critBonus: 10, cost: 2, cooldown: 1,
    effect: null, hits: 2,
    desc: "Two quick strikes that each roll for a crit.",
  },
  {
    id: "piercing-thrust", name: "Piercing Thrust", school: "martial", icon: "swords",
    target: "enemy", damageType: "physical", scaleAttr: "reflex",
    dmg: [4, 6], pen: 6, critBonus: 0, cost: 2, cooldown: 2, effect: null,
    desc: "A precise thrust that bites through armour.",
  },
  {
    id: "cleave", name: "Cleave", school: "martial", icon: "swords",
    target: "all-enemies", damageType: "physical", scaleAttr: "body",
    dmg: [3, 6], pen: 0, critBonus: 0, cost: 3, cooldown: 3, effect: null,
    desc: "A wide arc that strikes every foe.",
  },
  {
    id: "rend", name: "Rend", school: "martial", icon: "swords",
    target: "enemy", damageType: "physical", scaleAttr: "body",
    dmg: [2, 4], pen: 0, critBonus: 0, cost: 2, cooldown: 2,
    effect: { type: "bleed", value: 3, duration: 3, target: "enemy" },
    desc: "Tears a wound that bleeds for several turns.",
  },
  {
    id: "execute", name: "Execute", school: "martial", icon: "swords",
    target: "enemy", damageType: "true", scaleAttr: "body",
    dmg: [8, 12], pen: 0, critBonus: 15, cost: 4, cooldown: 4, effect: null,
    desc: "A killing blow that bypasses all armour and ward.",
  },
  {
    id: "rallying-shout", name: "Rallying Shout", school: "martial", icon: "flame",
    target: "self", damageType: null, scaleAttr: "presence",
    dmg: null, pen: 0, critBonus: 0, cost: 2, cooldown: 4,
    effect: { type: "rally", value: 30, duration: 3, target: "self" },
    desc: "Steel yourself — outgoing damage rises for several turns.",
  },
  {
    id: "second-wind", name: "Second Wind", school: "survival", icon: "heart",
    target: "self", damageType: null, scaleAttr: "vigor",
    dmg: null, pen: 0, critBonus: 0, cost: 2, cooldown: 4,
    effect: { type: "regen", value: 5, duration: 3, target: "self" },
    desc: "Catch your breath and knit minor wounds over a few turns.",
  },
  {
    id: "venom-strike", name: "Venom Strike", school: "shadow", icon: "droplet",
    target: "enemy", damageType: "physical", scaleAttr: "reflex",
    dmg: [1, 3], pen: 2, critBonus: 0, cost: 2, cooldown: 2,
    effect: { type: "poison", value: 4, duration: 4, target: "enemy" },
    desc: "A coated edge that leaves a lingering, regen-blocking poison.",
  },
  {
    id: "shadowstep", name: "Shadowstep", school: "shadow", icon: "moon",
    target: "self", damageType: null, scaleAttr: "reflex",
    dmg: null, pen: 0, critBonus: 0, cost: 2, cooldown: 3,
    effect: { type: "focus", value: 40, duration: 1, target: "self" },
    desc: "Slip aside and find an opening — your next strike crits far more often.",
  },
  {
    id: "firebolt", name: "Firebolt", school: "arcane", icon: "flame",
    target: "enemy", damageType: "magical", scaleAttr: "mind",
    dmg: [5, 9], pen: 2, critBonus: 0, cost: 2, cooldown: 1, effect: null,
    desc: "A bolt of conjured fire — reduced by ward, not armour.",
  },
  {
    id: "frost-lance", name: "Frost Lance", school: "arcane", icon: "droplet",
    target: "enemy", damageType: "magical", scaleAttr: "mind",
    dmg: [4, 7], pen: 0, critBonus: 0, cost: 2, cooldown: 2,
    effect: { type: "weaken", value: 25, duration: 2, target: "enemy" },
    desc: "A lance of cold that slows the target's blows.",
  },
  {
    id: "chain-lightning", name: "Chain Lightning", school: "arcane", icon: "sparkle",
    target: "all-enemies", damageType: "magical", scaleAttr: "mind",
    dmg: [4, 7], pen: 4, critBonus: 0, cost: 3, cooldown: 3, effect: null,
    desc: "Arcing current that leaps to every foe, biting through ward.",
  },
  {
    id: "hex", name: "Hex", school: "arcane", icon: "sparkle",
    target: "enemy", damageType: null, scaleAttr: "mind",
    dmg: null, pen: 0, critBonus: 0, cost: 2, cooldown: 3,
    effect: { type: "vulnerable", value: 30, duration: 3, target: "enemy" },
    desc: "A curse that makes the target take far more damage.",
  },
  {
    id: "smite", name: "Smite", school: "divine", icon: "sparkle",
    target: "enemy", damageType: "true", scaleAttr: "presence",
    dmg: [4, 6], pen: 0, critBonus: 10, cost: 3, cooldown: 3,
    effect: { type: "stun", value: 1, duration: 1, target: "enemy" },
    desc: "Searing judgement that ignores defences and may stun.",
  },
];

const LIBRARY_BY_ID = Object.fromEntries(ABILITY_LIBRARY.map((a) => [a.id, a]));
const ALL_BY_ID = { ...LIBRARY_BY_ID, [BASIC_ATTACK.id]: BASIC_ATTACK, [DEFEND.id]: DEFEND, [PARLEY.id]: PARLEY };

export function getAbilityDef(id) { return ALL_BY_ID[id] || null; }

// How much an attribute score amplifies an ability: each point adds 8%.
export function attrFactor(score) { return 1 + Math.max(0, score || 0) * 0.08; }

// Scale a base value by a tier multiplier and round.
export function scaleByTier(base, tierId) { return Math.round(base * tierMult(tierId)); }

// A learned ability is stored as { id, tier }. Resolve to its display def +
// tier so the UI can colour and label it. Falls back to common.
export function resolveLearned(entry) {
  const id = typeof entry === "string" ? entry : entry?.id;
  const tierId = (typeof entry === "object" && entry?.tier) || "common";
  const def = getAbilityDef(id);
  return def ? { def, tier: tierId } : null;
}

// Pick a random library ability id, optionally filtered by school. Used when a
// fight drops a new, generatively-tiered ability for the player to learn.
export function randomAbilityId(schools = null) {
  const pool = schools
    ? ABILITY_LIBRARY.filter((a) => schools.includes(a.school))
    : ABILITY_LIBRARY;
  if (pool.length === 0) return ABILITY_LIBRARY[0].id;
  return pool[Math.floor(Math.random() * pool.length)].id;
}
