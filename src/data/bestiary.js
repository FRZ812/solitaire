// Enemy templates keyed by the spawn-table `kind`. Values are the COMMON-tier
// baseline; generateEnemy scales them by the rolled tier. `count` is the group
// size range. Anything not listed falls back to a generic block inferred from
// the kind name, so every hostile spawn can resolve to a fightable foe.

import { tierMult, rollTier } from "./tiers.js";
import { DEMEANOR_CONFIG, defaultDemeanor } from "./combat-flavor.js";
import { itemCombatStats, weaponFamilyBase, mergeThresholdMods } from "../engine/combat-stats.js";
import { itemTemplate } from "./catalog.js";
import { aggregateCombatPassives } from "./passives.js";
import { attributeThresholdMods } from "./attribute-tiers.js";
import { resolvePoolForMind, maxVitalityFor } from "../engine/attributes.js";

// A natural weapon (fang/claw/horn/…) or an armed humanoid's weapon category.
const nw = (min, max, category = "natural", pen = 0, type = "physical") => ({ min, max, type, pen, category });

// PUNISHING, GROUNDED COMBAT (tuned against scripts/combat-sim.mjs): an AVERAGE
// person (Senna) is ~40% to win a 1-v-1 vs a lone bandit and ~0% vs two — you
// prepare and you gang up. Humanoids carry REAL gear that DROPS on death; beasts
// use natural weapons.
// Every entity is a full six-attribute stack (no mob-vs-character split) — combat
// stats derive uniformly via combatantFromAttributes, the SAME path the player and
// companions use. Balance anchor: an AVERAGE person is ~Senna Rell (vigor 2 ≈ 30 HP);
// common humanoid foes (bandit, goblin) sit slightly above her; vermin below; big
// beasts and bosses well above. HP comes from vigor (maxVitalityFor); only truly
// tiny vermin keep an explicit `health` so they stay one-hit fragile.
const GENERIC = {
  name: "Assailant", race: null,
  attributes: { body: 3, reflex: 3, vigor: 3, mind: 1, wit: 3, presence: 1 },
  worn: ["arming-sword", "leather-jerkin"],
  abilities: ["power-strike"], count: [1, 1], maxLootTier: "uncommon",
};

export const BESTIARY = {
  // --- beasts / packs --- (naturalWeapon values are PRE-govF; final ≈ nw × (1+body·0.08))
  wolves:        { name: "Wolf",        race: "wolf",     attributes: { body: 2, reflex: 6, vigor: 2, mind: 1, wit: 4, presence: 1 }, naturalWeapon: nw(3, 5, "fang"),            abilities: ["rend"],                    count: [2, 4], maxLootTier: "uncommon" },
  "bog-hounds":  { name: "Bog-Hound",   race: "hound",    attributes: { body: 2, reflex: 5, vigor: 2, mind: 1, wit: 3, presence: 1 }, naturalWeapon: nw(3, 5, "fang"),            abilities: ["rend"],                    count: [2, 4], maxLootTier: "uncommon" },
  "wild-dogs":   { name: "Wild Dog",    race: "dog",      attributes: { body: 1, reflex: 5, vigor: 1, mind: 1, wit: 3, presence: 1 }, naturalWeapon: nw(2, 5, "fang"),            abilities: [],                          count: [2, 5], maxLootTier: "common" },
  wargs:         { name: "Warg",        race: "warg",     attributes: { body: 4, reflex: 5, vigor: 3, mind: 1, wit: 4, presence: 2 }, naturalWeapon: nw(4, 6, "fang", 1), naturalArmor: 1, abilities: ["rend", "power-strike"], count: [1, 3], maxLootTier: "rare" },
  bear:          { name: "Brown Bear",  race: "bear",     attributes: { body: 7, reflex: 2, vigor: 6, mind: 1, wit: 2, presence: 2 }, naturalWeapon: nw(4, 7, "claw"),            abilities: ["power-strike"],            count: [1, 1], maxLootTier: "rare" },
  boar:          { name: "Wild Boar",   race: "boar",     attributes: { body: 5, reflex: 2, vigor: 4, mind: 0, wit: 2, presence: 1 }, naturalWeapon: nw(3, 6, "horn", 2),         abilities: ["power-strike"],            count: [1, 2], maxLootTier: "uncommon" },
  owlbear:       { name: "Owlbear",     race: "owlbear",  attributes: { body: 8, reflex: 3, vigor: 6, mind: 1, wit: 3, presence: 2 }, naturalWeapon: nw(4, 7, "claw"),            abilities: ["power-strike", "rend"],    count: [1, 1], maxLootTier: "epic" },
  "giant-spider":{ name: "Giant Spider",race: "spider",   attributes: { body: 3, reflex: 6, vigor: 2, mind: 2, wit: 4, presence: 1 }, naturalWeapon: nw(3, 5, "fang", 1), naturalArmor: 1, abilities: ["venom-strike"],         count: [1, 3], maxLootTier: "rare" },
  "salt-eel":    { name: "Salt-Eel",    race: "eel",      attributes: { body: 3, reflex: 5, vigor: 2, mind: 1, wit: 3, presence: 1 }, naturalWeapon: nw(3, 6, "fang"), naturalArmor: 1, abilities: [],                      count: [1, 1], maxLootTier: "uncommon" },
  "leech-cloud": { name: "Blood-Leech", race: "leech",    attributes: { body: 1, reflex: 3, vigor: 1, mind: 0, wit: 2, presence: 0 }, naturalWeapon: nw(2, 4, "fang"), health: 6,  abilities: ["venom-strike"],            count: [3, 6], maxLootTier: "common" },
  "stirge-flight":{name: "Stirge",      race: "stirge",   attributes: { body: 1, reflex: 6, vigor: 1, mind: 0, wit: 3, presence: 0 }, naturalWeapon: nw(2, 4, "fang"), health: 7,  abilities: [],                          count: [3, 5], maxLootTier: "common" },

  // --- humanoid raiders (slightly above the average person; they carry REAL gear
  //     that DROPS on death — see combatantFromAttributes.gear + rollLoot) ---
  bandits:       { name: "Bandit",      race: "human",    attributes: { body: 4, reflex: 3, vigor: 3, mind: 1, wit: 3, presence: 1 }, worn: ["arming-sword", "leather-jerkin"], demeanor: "wary", abilities: ["power-strike"], count: [2, 3], maxLootTier: "rare" },
  brigands:      { name: "Brigand",     race: "human",    attributes: { body: 3, reflex: 3, vigor: 3, mind: 1, wit: 2, presence: 1 }, worn: ["hand-axe", "leather-jerkin"],          abilities: ["power-strike"],         count: [2, 4], maxLootTier: "rare" },
  "lone-bandit": { name: "Cutthroat",   race: "human",    attributes: { body: 3, reflex: 5, vigor: 2, mind: 1, wit: 4, presence: 1 }, worn: ["iron-dagger", "padded-gambeson"],      abilities: ["piercing-thrust"],         count: [1, 1], maxLootTier: "rare" },
  "highway-brigands":{ name: "Highwayman",race: "human",  attributes: { body: 3, reflex: 4, vigor: 3, mind: 1, wit: 3, presence: 1 }, worn: ["battle-axe", "leather-jerkin"],        abilities: ["piercing-thrust", "power-strike"], count: [2, 4], maxLootTier: "rare" },
  "mountain-bandits":{ name: "Mountain Bandit",race: "human", attributes: { body: 5, reflex: 2, vigor: 4, mind: 1, wit: 2, presence: 1 }, worn: ["battle-axe", "chain-shirt"],        abilities: ["power-strike"],       count: [2, 3], maxLootTier: "rare" },
  cutthroats:    { name: "Cutthroat",   race: "human",    attributes: { body: 3, reflex: 5, vigor: 2, mind: 1, wit: 4, presence: 1 }, worn: ["iron-dagger", "leather-jerkin"],       abilities: ["venom-strike"],            count: [2, 2], maxLootTier: "rare" },
  "press-gang":  { name: "Press-Ganger",race: "human",    attributes: { body: 4, reflex: 2, vigor: 4, mind: 1, wit: 2, presence: 1 }, worn: ["falchion", "padded-gambeson"],         abilities: ["power-strike"],         count: [2, 3], maxLootTier: "uncommon" },
  pickpocket:    { name: "Pickpocket",  race: "human",    attributes: { body: 2, reflex: 7, vigor: 2, mind: 2, wit: 5, presence: 2 }, worn: ["iron-dagger"],                         abilities: [],                          count: [1, 1], maxLootTier: "uncommon" },

  // --- goblinoids / orcs (armed; gear drops) ---
  goblins:       { name: "Goblin",      race: "goblin",   attributes: { body: 4, reflex: 4, vigor: 3, mind: 1, wit: 4, presence: 1 }, worn: ["iron-shortsword", "leather-jerkin"], demeanor: "wary", abilities: ["power-strike"], count: [2, 4], maxLootTier: "rare" },
  "orc-scout":   { name: "Orc Scout",   race: "orc",      attributes: { body: 5, reflex: 3, vigor: 4, mind: 1, wit: 3, presence: 2 }, worn: ["battle-axe", "leather-jerkin"],        abilities: ["power-strike"],         count: [1, 2], maxLootTier: "rare" },
  "orc-raiders": { name: "Orc Raider",  race: "orc",      attributes: { body: 6, reflex: 2, vigor: 4, mind: 1, wit: 2, presence: 2 }, worn: ["bearded-axe", "chain-shirt"],          abilities: ["power-strike", "cleave"], count: [2, 5], maxLootTier: "epic" },

  // --- big & nasty ---
  ogre:          { name: "Ogre",        race: "ogre",     attributes: { body: 9, reflex: 2, vigor: 7, mind: 0, wit: 2, presence: 2 }, naturalWeapon: nw(5, 9, "mace", 2),         abilities: ["power-strike", "cleave"],  count: [1, 1], maxLootTier: "epic" },
  "lone-troll":  { name: "Troll",       race: "troll",    attributes: { body: 8, reflex: 2, vigor: 7, mind: 1, wit: 2, presence: 2 }, naturalWeapon: nw(5, 8, "claw"),            abilities: ["power-strike", "second-wind"], count: [1, 1], maxLootTier: "epic" },
  "stone-troll": { name: "Stone-Troll", race: "troll",    attributes: { body: 9, reflex: 1, vigor: 8, mind: 1, wit: 2, presence: 2 }, naturalWeapon: nw(5, 8, "mace", 1), naturalArmor: 3, abilities: ["power-strike"],     count: [1, 1], maxLootTier: "legendary" },
  drakeling:     { name: "Drakeling",   race: "drakeborn",attributes: { body: 4, reflex: 5, vigor: 4, mind: 6, wit: 4, presence: 4 }, naturalWeapon: nw(3, 6, "fang", 1), naturalWard: 2, abilities: ["firebolt"],          count: [1, 2], maxLootTier: "epic" },
  "wyvern-passage":{ name: "Wyvern",    race: "wyvern",   attributes: { body: 7, reflex: 6, vigor: 5, mind: 3, wit: 5, presence: 4 }, naturalWeapon: nw(4, 8, "fang", 3), naturalArmor: 2, naturalWard: 1, abilities: ["power-strike", "rend"], count: [1, 1], maxLootTier: "legendary" },

  // --- aerial predators (the only things that can reach a flier; see AERIAL_SPAWNS) ---
  gryphon:       { name: "Gryphon",     race: "gryphon",  attributes: { body: 6, reflex: 7, vigor: 5, mind: 3, wit: 5, presence: 4 }, naturalWeapon: nw(4, 7, "talon", 2), naturalArmor: 1, naturalWard: 1, abilities: ["power-strike", "rend"], count: [1, 2], maxLootTier: "legendary" },
  harpy:         { name: "Harpy",       race: "harpy",    attributes: { body: 3, reflex: 7, vigor: 3, mind: 2, wit: 5, presence: 2 }, naturalWeapon: nw(3, 5, "talon"), naturalArmor: 1, naturalWard: 1, abilities: ["venom-strike"], count: [2, 4], maxLootTier: "rare" },
  roc:           { name: "Roc",         race: "roc",      attributes: { body: 9, reflex: 5, vigor: 7, mind: 2, wit: 4, presence: 3 }, naturalWeapon: nw(5, 9, "talon", 3), naturalWard: 1, abilities: ["power-strike"],   count: [1, 1], maxLootTier: "legendary" },

  // --- undead / aberrant ---
  "bog-skeleton":{ name: "Bog-Skeleton",race: "undead",   attributes: { body: 4, reflex: 2, vigor: 3, mind: 0, wit: 2, presence: 0 }, worn: ["arming-sword", "leather-jerkin"], demeanor: "mindless", abilities: ["power-strike"], count: [1, 3], maxLootTier: "uncommon" },
  "carrion-thrall":{ name: "Carrion-Thrall",race: "undead", attributes: { body: 4, reflex: 1, vigor: 4, mind: 0, wit: 1, presence: 0 }, naturalWeapon: nw(2, 5, "claw"), demeanor: "mindless", abilities: ["venom-strike"], count: [1, 3], maxLootTier: "uncommon" },
};

// Fallback inference for any hostile kind without an explicit template — produces a
// full attribute stack like the authored templates.
function inferTemplate(kind) {
  const k = (kind || "").toLowerCase();
  const has = (...w) => w.some((s) => k.includes(s));
  const t = { ...GENERIC, name: titleCase(k) };
  if (has("wolf", "hound", "dog", "beast", "boar", "cat", "rat")) { t.race = t.race || "beast"; t.attributes = { body: 3, reflex: 5, vigor: 3, mind: 1, wit: 4, presence: 1 }; t.worn = undefined; t.naturalWeapon = nw(3, 6, "fang"); t.naturalArmor = 0; t.count = [2, 3]; t.abilities = []; }
  if (has("bandit", "brigand", "cutthroat", "thief", "robber", "raider")) { t.race = "human"; t.attributes = { body: 4, reflex: 3, vigor: 3, mind: 1, wit: 3, presence: 1 }; t.worn = ["arming-sword", "leather-jerkin"]; t.count = [2, 3]; t.abilities = ["power-strike"]; t.maxLootTier = "rare"; }
  if (has("goblin")) { t.race = "goblin"; t.attributes = { body: 4, reflex: 4, vigor: 3, mind: 1, wit: 4, presence: 1 }; t.worn = ["iron-shortsword", "leather-jerkin"]; t.abilities = ["power-strike"]; t.count = [2, 4]; t.maxLootTier = "rare"; }
  if (has("orc")) { t.race = "orc"; t.attributes = { body: 5, reflex: 3, vigor: 4, mind: 1, wit: 3, presence: 2 }; t.worn = ["battle-axe", "leather-jerkin"]; t.abilities = ["power-strike"]; t.maxLootTier = "rare"; }
  if (has("troll", "ogre", "giant")) { t.attributes = { body: 9, reflex: 2, vigor: 7, mind: 0, wit: 2, presence: 2 }; t.worn = undefined; t.naturalWeapon = nw(5, 9, "mace", 1); t.naturalArmor = 0; t.abilities = ["power-strike", "cleave"]; t.maxLootTier = "epic"; }
  if (has("skeleton", "thrall", "wight", "ghoul", "undead", "corpse")) { t.race = "undead"; t.attributes = { body: 4, reflex: 2, vigor: 3, mind: 0, wit: 2, presence: 0 }; t.worn = ["arming-sword", "leather-jerkin"]; t.demeanor = "mindless"; }
  return t;
}

function titleCase(s) { return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function randInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
const scale = (v, m) => Math.round((v || 0) * m);

// Build one enemy combatant instance of `kind` at the given tier — a bestiary mob
// now derives from its attribute stack through the SAME path as a named NPC.
export function generateEnemy(kind, { tierId = "common", index = 0, total = 1 } = {}) {
  const tmpl = BESTIARY[kind] || inferTemplate(kind);
  const name = total > 1 ? `${tmpl.name} ${index + 1}` : tmpl.name;
  const demeanor = tmpl.demeanor || defaultDemeanor(kind, tmpl.race);
  const e = combatantFromAttributes({
    attributes: tmpl.attributes, worn: tmpl.worn, tierGear: true,
    naturalWeapon: tmpl.naturalWeapon,
    naturalArmor: tmpl.naturalArmor, naturalWard: tmpl.naturalWard,
    innatePassives: tmpl.innatePassives, abilities: tmpl.abilities, health: tmpl.health,
    demeanor, kind, name, race: tmpl.race || null,
  }, null, { tierId });
  e.id = `enemy-${kind}-${index}-${Math.random().toString(36).slice(2, 7)}`;
  e.maxLootTier = tmpl.maxLootTier || "uncommon";
  return e;
}

const TIERS_ORDER = { common: 0, uncommon: 1, rare: 2, "very-rare": 3, epic: 4, legendary: 5, mythical: 6, divine: 7 };

// Demeanor for a named NPC turned combatant, inferred from profession/race.
function npcDemeanor(npc) {
  const p = `${npc.profession || ""} ${npc.race || ""}`.toLowerCase();
  if (/(undead|skeleton|wraith|thrall)/.test(p)) return "mindless";
  if (/(beast|wolf|bear|hound|animal)/.test(p)) return "feral";
  if (/(knight|guard|soldier|paladin|warden|captain|monarch|noble|hold-father|matriarch|chapter-master|speaker)/.test(p)) return "honorable";
  if (/(warlord|orc|wyrm|warrior|raider)/.test(p)) return "fierce";
  if (/(thief|cutthroat|bandit|brigand|pickpocket|beggar)/.test(p)) return "cowardly";
  return "wary";
}

// THE single combat-stat derivation for EVERY entity — player-side, mob, named NPC,
// companion, mount. Takes a `spec` (attributes + optional worn gear, naturalWeapon/
// Armor/Ward, innatePassives, abilities, health, demeanor, identity). No "mob"
// shortcut: a bandit and the Demon-King run through the same math.
function combatantFromAttributes(spec, codex, { tierId = "common" } = {}) {
  const a = spec.attributes || {};
  const body = a.body || 0, reflex = a.reflex || 0, vigor = a.vigor || 0, mind = a.mind || 0, wit = a.wit || 0, presence = a.presence || 0;
  const wornRaw = (spec.worn || []).map((id) => codex?.items?.[id] || itemTemplate(id)).filter(Boolean);
  // Mob templates carry COMMON-grade gear ids; scale them to the foe's tier so a
  // rare bandit's blade hits (and drops) at rare. Named NPCs keep their real gear.
  const worn = spec.tierGear ? wornRaw.map((it) => ({ ...it, tier: tierId })) : wornRaw;
  const m = tierMult(tierId);

  // Armour/ward have an attribute base (body/3, mind/3) + innate (naturalArmor/Ward)
  // + gear. The attribute base tier-scales; gear is already tier-scaled.
  let attrArmor = Math.floor(body / 3) + (spec.naturalArmor || 0);
  let attrWard = Math.floor(mind / 3) + (spec.naturalWard || 0);
  let gearArmor = 0, gearWard = 0, dodgeGear = 0, weaponDmg = null, weaponType = "unarmed";
  for (const it of worn) {
    const cs = itemCombatStats(it);
    gearArmor += cs.armor; gearWard += cs.ward; dodgeGear += cs.dodge;
    if (cs.damage && !weaponDmg) { weaponDmg = cs.damage; weaponType = cs.weaponType || "sword"; }
  }
  // Worn-gear affixes + innatePassives (a creature's power in its NATURE) both apply.
  const { statMods: sm, triggers: tr } = aggregateCombatPassives([
    ...worn.flatMap((it) => it.passives || []),
    ...(spec.innatePassives || []),
  ], a);
  mergeThresholdMods(sm, tr, attributeThresholdMods(a));
  // Weapon: worn weapon (pre-scaled) > NATURAL weapon (tier-scaled here) > bare fists.
  let base;
  if (weaponDmg) {
    base = weaponDmg;
  } else if (spec.naturalWeapon) {
    const natw = spec.naturalWeapon;
    base = {
      min: Math.max(1, scale(natw.min, m)), max: Math.max(1, scale(natw.max, m)),
      type: natw.type || "physical", pen: natw.pen || 0,
      reach: natw.reach, range: natw.range, speed: natw.speed, acc: natw.acc,
    };
    weaponType = natw.category || "natural";
  } else {
    base = { min: 2, max: 4, type: "physical", pen: 0 };
  }
  const govF = 1 + (base.type === "magical" ? mind : body) * 0.08;
  const dFlat = sm.damageFlat || 0, dMult = 1 + (sm.damageMult || 0);
  const fam = weaponFamilyBase(weaponType);
  const weapon = {
    min: Math.max(1, Math.round((base.min * govF + dFlat) * dMult)),
    max: Math.max(1, Math.round((base.max * govF + dFlat) * dMult)),
    type: base.type || "physical", pen: (base.pen || 0) + Math.floor(body / 4) + (sm.penetration || 0), category: weaponType,
    reach: base.reach ?? fam.reach ?? 1, range: base.range ?? fam.range ?? 0,
    speed: base.speed ?? fam.speed ?? 0, reload: base.reload ?? fam.reload ?? 0,
    acc: base.acc ?? fam.acc ?? 0,
  };
  const demeanor = spec.demeanor || "wary";
  const dcfg = DEMEANOR_CONFIG[demeanor] || DEMEANOR_CONFIG.wary;
  // Declared abilities win; else a basic attribute-inferred kit.
  let abilities;
  if (Array.isArray(spec.abilities) && spec.abilities.length) {
    abilities = spec.abilities.map((id) => ({ id, tier: tierId }));
  } else {
    abilities = [];
    if (body >= 6) abilities.push({ id: "power-strike", tier: tierId });
    if (mind >= 8) abilities.push({ id: "firebolt", tier: tierId });
  }
  // HP from vigor (the player's curve — full parity), OR an authored base pool for
  // designed raid bosses / tiny one-hit vermin (spec.health). Both tier-scaled.
  const baseHp = spec.health != null ? spec.health : maxVitalityFor({ attributes: a });
  const maxHealth = Math.max(1, Math.round(baseHp * m) + (sm.maxHealth || 0));
  const cstate = spec.combatState;
  const health = (cstate && typeof cstate.health === "number") ? Math.max(0, Math.min(maxHealth, cstate.health)) : maxHealth;
  const morale = cstate?.status === "yielded" ? Math.min(dcfg.morale, 10) : dcfg.morale;

  return {
    id: `enemy-${Math.random().toString(36).slice(2, 7)}`,
    kind: spec.kind || "foe", name: spec.name || "Foe", race: spec.race || null, tier: tierId,
    demeanor, morale, moraleMax: dcfg.morale,
    canTalk: !(demeanor === "mindless" || demeanor === "feral"),
    controlPressure: 0, provoked: false, resolved: null, lastFlavorTurn: 0, noFleeUntil: 0,
    maxHealth, health,
    armor: Math.round(attrArmor * m) + gearArmor + (sm.armor || 0), ward: Math.round(attrWard * m) + gearWard + (sm.ward || 0),
    dr: Math.min(0.85, sm.drPct || 0), fortify: Math.min(0.25, sm.fortify || 0),
    phaseChance: Math.min(0.4, sm.phaseChance || 0), dodgeIgnore: Math.min(1, sm.dodgeIgnore || 0),
    healPower: Math.min(1.0, sm.healPower || 0), dmgDefer: Math.min(0.6, sm.dmgDefer || 0),
    damageCap: sm.damageCap || 0,
    controlResist: Math.min(0.6, sm.controlResist || 0),
    dodge: Math.min(70, reflex * 2 + dodgeGear + (sm.dodge || 0)),
    accuracy: reflex + wit + (weapon.acc || 0) + (sm.accuracy || 0), critChance: Math.min(100, Math.round(wit * 1.5 + reflex) + (fam.crit || 0) + (sm.critChance || 0)), critMult: Math.min(9.99, 1.5 + (sm.critMult || 0)),
    speed: reflex + Math.floor(wit / 2),
    will: mind + presence, // willpower — feeds the Charm/Dominate save (engine/combat.js)
    saveDC: sm.saveDC || 0, // Mind threshold: raises how hard this caster's control magic is to resist
    attrs: a, // source attributes — lets a Dominated foe be filed as a lasting thrall
    naturalWeaponSpec: spec.naturalWeapon || null, // kept so a thrall beast re-derives its bite
    triggers: tr,
    resolve: resolvePoolForMind(mind) + (sm.resolveMax || 0), resolveMax: resolvePoolForMind(mind) + (sm.resolveMax || 0),
    swiftChance: Math.min(0.5, sm.swiftChance || 0),
    actionsPerTurn: spec.actionsPerTurn != null ? spec.actionsPerTurn : (1 + Math.min(3, Math.max(0, sm.extraActions || 0))), actionsLeft: 1,
    cooldownReduction: Math.min(3, sm.cooldownReduction || 0),
    procs: tr.procs || [], shield: 0, magicShield: 0, invuln: 0,
    weapon, abilities, maxLootTier: spec.maxLootTier || tierId, statuses: [], cooldowns: {},
    // The actual gear this combatant wears — a slain person drops their kit (rollLoot).
    gear: worn.map((it) => ({ id: it.id, tier: it.tier || tierId })),
  };
}

// Turn a known/named codex NPC into a combat enemy using their real attributes
// + worn gear, so a fight against "the hooded figure" reflects who they are.
export function enemyFromNPC(npc, codex, { tierId = "common" } = {}) {
  const e = combatantFromAttributes({
    attributes: npc.attributes, worn: npc.worn,
    naturalWeapon: npc.naturalWeapon, naturalArmor: npc.naturalArmor, naturalWard: npc.naturalWard,
    innatePassives: npc.innatePassives, abilities: npc.abilities, health: npc.health,
    actionsPerTurn: npc.actionsPerTurn, combatState: npc.combatState,
    demeanor: npcDemeanor(npc),
    kind: npc.profession || npc.race || "foe", name: npc.name || "Foe", race: npc.race || null,
  }, codex, { tierId });
  e.id = `enemy-npc-${npc.id}-${Math.random().toString(36).slice(2, 6)}`;
  e.npcId = npc.id;
  return e;
}

// Turn a recruited companion (a full codex character) into an allied combatant
// on the player's side — same derivation as enemyFromNPC, but tagged as an ally
// and given a brave bearing (companions don't break and run; they fall fighting).
export function allyFromCompanion(npc, codex, { tierId = "common" } = {}) {
  const base = enemyFromNPC(npc, codex, { tierId });
  // Companions' worn gear is descriptive (not codex items), so no weapon
  // resolves — give a competent weapon scaled to their martial attribute.
  if (!base.weapon || base.weapon.category === "unarmed") {
    const a = npc.attributes || {};
    const force = Math.max(a.body || 0, a.reflex || 0);
    const m = tierMult(tierId);
    base.weapon = {
      min: Math.max(2, Math.round((2 + force * 0.4) * m)),
      max: Math.max(4, Math.round((5 + force * 0.7) * m)),
      type: "physical", pen: Math.floor((a.body || 0) / 4),
      category: (a.reflex || 0) > (a.body || 0) ? "dagger" : "sword",
    };
  }
  // Use the companion's OWN defined kit of abilities (not attribute-inferred),
  // so what they do in a fight matches what they tell you they can do.
  const abilities = (npc.abilities && npc.abilities.length)
    ? npc.abilities.map((id) => ({ id, tier: tierId }))
    : base.abilities;
  return {
    ...base,
    id: `ally-${npc.id}-${Math.random().toString(36).slice(2, 6)}`,
    npcId: null,
    companionId: npc.id,
    // Mounts fight too — tagged so combat can branch (a beast loots nothing) and
    // so the rider's mounted bonus can be matched to its carrier.
    mountId: npc.kind === "mount" ? npc.id : null,
    side: "player",
    abilities,
    demeanor: "fierce", morale: 100, moraleMax: 100,
    health: base.maxHealth, // companions/mounts arrive fresh; we don't carry their wounds
    combatState: undefined,
  };
}

// Build a whole hostile group for a spawn kind. `power` (0..1) is the rollTier
// luck (nudge toward the high end); `maxTier` caps the tier (a region's
// enemyTier ceiling). `count` forces an exact group size (the narrator's roster
// wins over the template's range); `name` overrides the displayed name so the
// foes match the fiction the narrator set up.
export function generateEnemyGroup(kind, { power = 0, maxTier = null, count = null, name = null } = {}) {
  const tmpl = BESTIARY[kind] || inferTemplate(kind);
  const [lo, hi] = tmpl.count || [1, 1];
  const n = count != null ? Math.max(1, Math.round(count)) : randInt(lo, hi);
  const cap = maxTier || (power >= 0.75 ? "legendary" : power >= 0.5 ? "epic" : power >= 0.25 ? "very-rare" : "rare");
  const enemies = [];
  for (let i = 0; i < n; i++) {
    const tierId = rollTier(cap, power);
    const e = generateEnemy(kind, { tierId, index: i, total: n });
    if (name) e.name = n > 1 ? `${name} ${i + 1}` : name;
    enemies.push(e);
  }
  return enemies;
}
