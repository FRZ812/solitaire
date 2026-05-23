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

const T = (min, max, type = "physical", pen = 0) => ({ min, max, type, pen });

// PUNISHING, GROUNDED COMBAT: ordinary folk (the player/companions at vigor ~2 →
// ~30 HP) are NOT seasoned killers, but these creatures kill to live and fight
// like it. Common-tier baselines below lean on DAMAGE + ACCURACY (real threat)
// with modest HP (a basic foe survives a hit or two, not a one-shot). Relative
// identity is preserved — a goblin is still far below an ogre — the whole curve
// just sits higher. Tuned against scripts/combat-sim.mjs.
const GENERIC = {
  name: "Assailant", race: null, health: 16, armor: 1, ward: 0,
  dodge: 8, accuracy: 6, critChance: 5, speed: 4,
  damage: T(4, 7), abilities: ["power-strike"], count: [1, 1], maxLootTier: "uncommon",
};

export const BESTIARY = {
  // --- beasts / packs ---
  wolves:        { name: "Wolf",         race: "wolf",     health: 13, armor: 0, dodge: 16, accuracy: 7, critChance: 8, speed: 7, damage: T(3, 6), abilities: ["rend"], count: [2, 4], maxLootTier: "uncommon" },
  "bog-hounds":  { name: "Bog-Hound",    race: "hound",    health: 11, armor: 0, dodge: 14, accuracy: 6, critChance: 6, speed: 6, damage: T(3, 6), abilities: ["rend"], count: [2, 4], maxLootTier: "uncommon" },
  "wild-dogs":   { name: "Wild Dog",     race: "dog",      health: 9,  armor: 0, dodge: 14, accuracy: 6, speed: 6, damage: T(2, 5), abilities: [], count: [2, 5], maxLootTier: "common" },
  wargs:         { name: "Warg",         race: "warg",     health: 20, armor: 1, dodge: 14, accuracy: 8, critChance: 8, speed: 7, damage: T(5, 8), abilities: ["rend", "power-strike"], count: [1, 3], maxLootTier: "rare" },
  bear:          { name: "Brown Bear",   race: "bear",     health: 32, armor: 2, dodge: 4,  accuracy: 6, speed: 4, damage: T(6, 11), abilities: ["power-strike"], count: [1, 1], maxLootTier: "rare" },
  boar:          { name: "Wild Boar",    race: "boar",     health: 18, armor: 1, dodge: 6,  accuracy: 6, speed: 5, damage: T(4, 8, "physical", 2), abilities: ["power-strike"], count: [1, 2], maxLootTier: "uncommon" },
  owlbear:       { name: "Owlbear",      race: "owlbear",  health: 38, armor: 2, dodge: 6,  accuracy: 7, critChance: 8, speed: 5, damage: T(7, 12), abilities: ["power-strike", "rend"], count: [1, 1], maxLootTier: "epic" },
  "giant-spider":{ name: "Giant Spider", race: "spider",   health: 16, armor: 1, dodge: 18, accuracy: 8, speed: 6, damage: T(3, 6), abilities: ["venom-strike"], count: [1, 3], maxLootTier: "rare" },
  "salt-eel":    { name: "Salt-Eel",     race: "eel",      health: 14, armor: 1, dodge: 16, accuracy: 7, speed: 6, damage: T(4, 7), abilities: [], count: [1, 1], maxLootTier: "uncommon" },
  "leech-cloud": { name: "Blood-Leech",  race: "leech",    health: 6,  armor: 0, dodge: 10, accuracy: 6, speed: 5, damage: T(2, 4), abilities: ["venom-strike"], count: [3, 6], maxLootTier: "common" },
  "stirge-flight":{name: "Stirge",       race: "stirge",   health: 7,  armor: 0, dodge: 20, accuracy: 7, speed: 8, damage: T(2, 4), abilities: [], count: [3, 5], maxLootTier: "common" },

  // --- humanoid raiders (experienced killers — they fight to kill) ---
  bandits:       { name: "Bandit",       race: "human",    health: 18, armor: 2, dodge: 8,  accuracy: 7, critChance: 5, speed: 5, damage: T(5, 8), abilities: ["power-strike"], count: [2, 3], maxLootTier: "rare" },
  brigands:      { name: "Brigand",      race: "human",    health: 18, armor: 2, dodge: 8,  accuracy: 7, speed: 5, damage: T(5, 8), abilities: ["power-strike"], count: [2, 4], maxLootTier: "rare" },
  "lone-bandit": { name: "Cutthroat",    race: "human",    health: 16, armor: 1, dodge: 12, accuracy: 8, critChance: 12, speed: 6, damage: T(4, 8, "physical", 1), abilities: ["piercing-thrust"], count: [1, 1], maxLootTier: "rare" },
  "highway-brigands":{ name: "Highwayman", race: "human",  health: 19, armor: 2, dodge: 10, accuracy: 7, speed: 5, damage: T(5, 9), abilities: ["piercing-thrust", "power-strike"], count: [2, 4], maxLootTier: "rare" },
  "mountain-bandits":{ name: "Mountain Bandit", race: "human", health: 21, armor: 3, dodge: 8, accuracy: 7, speed: 4, damage: T(6, 9), abilities: ["power-strike"], count: [2, 3], maxLootTier: "rare" },
  cutthroats:    { name: "Cutthroat",    race: "human",    health: 16, armor: 1, dodge: 12, accuracy: 8, critChance: 12, speed: 6, damage: T(4, 8, "physical", 1), abilities: ["venom-strike"], count: [2, 2], maxLootTier: "rare" },
  "press-gang":  { name: "Press-Ganger", race: "human",    health: 20, armor: 2, dodge: 6,  accuracy: 6, speed: 4, damage: T(5, 8), abilities: ["power-strike"], count: [2, 3], maxLootTier: "uncommon" },
  pickpocket:    { name: "Pickpocket",   race: "human",    health: 12, armor: 0, dodge: 22, accuracy: 7, speed: 7, damage: T(2, 5), abilities: [], count: [1, 1], maxLootTier: "uncommon" },

  // --- goblinoids / orcs ---
  goblins:       { name: "Goblin",       race: "goblin",   health: 13, armor: 2, dodge: 14, accuracy: 7, critChance: 8, speed: 6, damage: T(4, 7), abilities: ["power-strike"], count: [2, 4], maxLootTier: "rare" },
  "orc-scout":   { name: "Orc Scout",    race: "orc",      health: 22, armor: 3, dodge: 8,  accuracy: 7, speed: 5, damage: T(5, 9), abilities: ["power-strike"], count: [1, 2], maxLootTier: "rare" },
  "orc-raiders": { name: "Orc Raider",   race: "orc",      health: 24, armor: 4, dodge: 6,  accuracy: 7, critChance: 6, speed: 4, damage: T(6, 10), abilities: ["power-strike", "cleave"], count: [2, 5], maxLootTier: "epic" },

  // --- big & nasty ---
  ogre:          { name: "Ogre",         race: "ogre",     health: 52, armor: 3, dodge: 2,  accuracy: 6, speed: 3, damage: T(9, 15, "physical", 2), abilities: ["power-strike", "cleave"], count: [1, 1], maxLootTier: "epic" },
  "lone-troll":  { name: "Troll",        race: "troll",    health: 56, armor: 2, dodge: 3,  accuracy: 6, speed: 3, damage: T(8, 13), abilities: ["power-strike", "second-wind"], count: [1, 1], maxLootTier: "epic" },
  "stone-troll": { name: "Stone-Troll",  race: "troll",    health: 66, armor: 6, dodge: 1,  accuracy: 6, speed: 2, damage: T(9, 14, "physical", 1), abilities: ["power-strike"], count: [1, 1], maxLootTier: "legendary" },
  drakeling:     { name: "Drakeling",    race: "drakeborn",health: 28, armor: 3, ward: 4, dodge: 12, accuracy: 8, critChance: 8, speed: 6, damage: T(5, 9, "magical", 2), abilities: ["firebolt"], count: [1, 2], maxLootTier: "epic" },
  "wyvern-passage":{ name: "Wyvern",     race: "wyvern",   health: 44, armor: 4, ward: 2, dodge: 16, accuracy: 9, critChance: 10, speed: 8, damage: T(7, 12, "physical", 3), abilities: ["power-strike", "rend"], count: [1, 1], maxLootTier: "legendary" },

  // --- undead / aberrant ---
  "bog-skeleton":{ name: "Bog-Skeleton", race: "undead",   health: 15, armor: 2, dodge: 6, accuracy: 5, speed: 4, damage: T(3, 6), abilities: ["power-strike"], count: [1, 3], maxLootTier: "uncommon" },
  "carrion-thrall":{ name: "Carrion-Thrall", race: "undead", health: 17, armor: 1, dodge: 4, accuracy: 5, speed: 3, damage: T(3, 6), abilities: ["venom-strike"], count: [1, 3], maxLootTier: "uncommon" },
};

// Fallback inference for any hostile kind without an explicit template.
function inferTemplate(kind) {
  const k = (kind || "").toLowerCase();
  const has = (...w) => w.some((s) => k.includes(s));
  const t = { ...GENERIC, name: titleCase(k) };
  if (has("wolf", "hound", "dog", "beast", "boar", "cat", "rat")) { t.dodge = 14; t.speed = 6; t.count = [2, 3]; t.damage = T(3, 6); }
  if (has("bandit", "brigand", "cutthroat", "thief", "robber", "raider")) { t.race = "human"; t.health = 18; t.armor = 2; t.damage = T(5, 8); t.count = [2, 3]; t.abilities = ["power-strike"]; t.maxLootTier = "rare"; }
  if (has("goblin")) { t.race = "goblin"; t.health = 13; t.armor = 2; t.dodge = 14; t.accuracy = 7; t.damage = T(4, 7); t.abilities = ["power-strike"]; t.count = [2, 4]; t.maxLootTier = "rare"; }
  if (has("orc")) { t.race = "orc"; t.health = 22; t.armor = 3; t.damage = T(5, 9); t.abilities = ["power-strike"]; t.maxLootTier = "rare"; }
  if (has("troll", "ogre", "giant")) { t.health = 52; t.armor = 3; t.damage = T(9, 14); t.dodge = 2; t.maxLootTier = "epic"; }
  if (has("skeleton", "thrall", "wight", "ghoul", "undead", "corpse")) { t.race = "undead"; t.armor = 2; }
  return t;
}

function titleCase(s) { return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function randInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
const scale = (v, m) => Math.round((v || 0) * m);

// Build one enemy combatant instance of `kind` at the given tier.
export function generateEnemy(kind, { tierId = "common", index = 0, total = 1 } = {}) {
  const tmpl = BESTIARY[kind] || inferTemplate(kind);
  const m = tierMult(tierId);
  const tierOf = (TIERS_ORDER[tierId] || 0);
  const dmg = tmpl.damage || T(2, 5);
  const name = total > 1 ? `${tmpl.name} ${index + 1}` : tmpl.name;
  const maxHealth = Math.max(1, scale(tmpl.health, m));
  const demeanor = tmpl.demeanor || defaultDemeanor(kind, tmpl.race);
  const dcfg = DEMEANOR_CONFIG[demeanor] || DEMEANOR_CONFIG.wary;
  return {
    id: `enemy-${kind}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    kind, name, race: tmpl.race || null, tier: tierId,
    demeanor, morale: dcfg.morale, moraleMax: dcfg.morale,
    canTalk: !(demeanor === "mindless" || demeanor === "feral"),
    controlPressure: 0, provoked: false, resolved: null, lastFlavorTurn: 0, noFleeUntil: 0,
    maxHealth, health: maxHealth,
    armor: scale(tmpl.armor, m), ward: scale(tmpl.ward, m),
    dodge: Math.min(60, (tmpl.dodge || 0) + tierOf * 2),
    accuracy: (tmpl.accuracy || 4) + tierOf,
    critChance: Math.min(50, (tmpl.critChance || 4) + tierOf * 2),
    critMult: 1.5,
    speed: (tmpl.speed || 4) + Math.floor(tierOf / 2),
    weapon: { min: Math.max(1, scale(dmg.min, m)), max: Math.max(1, scale(dmg.max, m)), type: dmg.type || "physical", pen: scale(dmg.pen, m), reach: dmg.reach || 1, range: dmg.range || 0 },
    abilities: (tmpl.abilities || []).map((id) => ({ id, tier: tierId })),
    maxLootTier: tmpl.maxLootTier || "uncommon",
    // Action economy: one action a turn (no stamina). Template foes carry no
    // affixes, so no swift extras; caster foes spend Resolve on their spells.
    resolve: 6 + tierOf, resolveMax: 6 + tierOf, resolveRegen: 1,
    actionsPerTurn: 1, actionsLeft: 1, cooldownReduction: 0, swiftChance: 0,
    procs: [], shield: 0, magicShield: 0, invuln: 0,
    statuses: [],
    cooldowns: {},
  };
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

// Turn a known/named codex NPC into a combat enemy using their real attributes
// + worn gear, so a fight against "the hooded figure" reflects who they are.
export function enemyFromNPC(npc, codex, { tierId = "common" } = {}) {
  const a = npc.attributes || {};
  const body = a.body || 0, reflex = a.reflex || 0, vigor = a.vigor || 0, mind = a.mind || 0, wit = a.wit || 0;
  const worn = (npc.worn || []).map((id) => codex?.items?.[id] || itemTemplate(id)).filter(Boolean);
  const m = tierMult(tierId);

  // Gear stats are ALREADY tier-scaled by itemCombatStats; only the attribute-
  // derived base scales by tier (m) below — otherwise worn gear double-scales.
  // A creature with no armour ITEM can still be naturally armoured — a wyrm's
  // scale, a golem's stone (naturalArmor), or an innate magical resilience
  // (naturalWard). Both are innate, so they ride the attribute base and tier-scale.
  let attrArmor = Math.floor(body / 3) + (npc.naturalArmor || 0);
  let attrWard = Math.floor(mind / 3) + (npc.naturalWard || 0);
  let gearArmor = 0, gearWard = 0, dodgeGear = 0, weaponDmg = null, weaponType = "unarmed";
  for (const it of worn) {
    const cs = itemCombatStats(it);
    gearArmor += cs.armor; gearWard += cs.ward; dodgeGear += cs.dodge;
    if (cs.damage && !weaponDmg) { weaponDmg = cs.damage; weaponType = cs.weaponType || "sword"; }
  }
  // Worn gear's affixes apply to the bearer too — so a fabled boss in divine arms
  // fights with their game-breaking powers (Worldbreaker, Sundering, Undying…),
  // not just big base numbers. Their req is assumed met (it's their own gear).
  // INNATE compensation: a creature that wears no gear like a humanoid (a wyrm, an
  // elemental, a beast) carries its power in its NATURE — `innatePassives` are
  // affixes it embodies ({id,tier}, with their own tiers exactly like gear affixes),
  // so a tier-appropriate monster can field the same game-breaking powers a divine-
  // armed boss would, without pinning fictional "hoard" gear on it.
  const { statMods: sm, triggers: tr } = aggregateCombatPassives([
    ...worn.flatMap((it) => it.passives || []),
    ...(npc.innatePassives || []),
  ], a);
  // Attribute thresholds (symmetric with the player): smooth stat scaling + unique
  // unlocks — a high-attribute foe (a boss) is dangerous by its very nature.
  mergeThresholdMods(sm, tr, attributeThresholdMods(a));
  // Weapon: a worn weapon (already tier-scaled by itemCombatStats) wins; else a
  // NATURAL weapon (fang/claw/breath) — tier-scaled HERE (m) since it's an innate
  // stat, not a pre-scaled item — so an item-less foe hits at its tier instead of
  // being stuck at bare-fist damage; else bare fists.
  let base;
  if (weaponDmg) {
    base = weaponDmg;
  } else if (npc.naturalWeapon) {
    const nw = npc.naturalWeapon;
    base = {
      // Only min/max tier-scale (like an item weapon); pen is a flat family-style
      // identity value — the big armour-cleaving comes from a Sunder innatePassive.
      min: Math.max(1, scale(nw.min, m)), max: Math.max(1, scale(nw.max, m)),
      type: nw.type || "physical", pen: nw.pen || 0,
      reach: nw.reach, range: nw.range, speed: nw.speed, acc: nw.acc,
    };
    weaponType = nw.category || "natural";
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
  const demeanor = npcDemeanor(npc);
  const dcfg = DEMEANOR_CONFIG[demeanor] || DEMEANOR_CONFIG.wary;
  // A named foe's OWN declared abilities win — a wyrm breathes fire because its
  // kit lists it, not because it cleared a stat threshold; this is also how an
  // item-less creature gets its signature powers (dragon-breath, dread-aura).
  // Falls back to a basic attribute-inferred kit for foes that declare none.
  let abilities;
  if (Array.isArray(npc.abilities) && npc.abilities.length) {
    abilities = npc.abilities.map((id) => ({ id, tier: tierId }));
  } else {
    abilities = [];
    if (body >= 6) abilities.push({ id: "power-strike", tier: tierId });
    if (mind >= 8) abilities.push({ id: "firebolt", tier: tierId });
  }
  // HP from vigor/body, OR an authored base pool for designed raid bosses
  // (npc.health) — both tier-scaled, like a template mob's base health.
  const baseHp = npc.health != null ? npc.health : (12 + vigor * 2 + body);
  const maxHealth = Math.max(1, Math.round(baseHp * m) + (sm.maxHealth || 0));
  // Named foes carry their wounds between encounters — re-engaging doesn't reset
  // them to full. A previously-yielded foe is already cowed (low morale).
  const cstate = npc.combatState;
  const health = (cstate && typeof cstate.health === "number") ? Math.max(0, Math.min(maxHealth, cstate.health)) : maxHealth;
  const morale = cstate?.status === "yielded" ? Math.min(dcfg.morale, 10) : dcfg.morale;

  return {
    id: `enemy-npc-${npc.id}-${Math.random().toString(36).slice(2, 6)}`,
    npcId: npc.id,
    kind: npc.profession || npc.race || "foe", name: npc.name || "Foe", race: npc.race || null, tier: tierId,
    demeanor, morale, moraleMax: dcfg.morale,
    canTalk: !(demeanor === "mindless" || demeanor === "feral"),
    controlPressure: 0, provoked: false, resolved: null, lastFlavorTurn: 0, noFleeUntil: 0,
    maxHealth, health,
    armor: Math.round(attrArmor * m) + gearArmor + (sm.armor || 0), ward: Math.round(attrWard * m) + gearWard + (sm.ward || 0),
    dr: Math.min(0.85, sm.drPct || 0), fortify: Math.min(0.25, sm.fortify || 0),
    healPower: Math.min(1.0, sm.healPower || 0), dmgDefer: Math.min(0.6, sm.dmgDefer || 0),
    dodge: Math.min(70, reflex * 2 + dodgeGear + (sm.dodge || 0)),
    accuracy: reflex + wit + (weapon.acc || 0) + (sm.accuracy || 0), critChance: Math.min(60, Math.round(wit * 1.5 + reflex) + (fam.crit || 0) + (sm.critChance || 0)), critMult: 1.5 + (sm.critMult || 0),
    speed: reflex + Math.floor(wit / 2),
    triggers: tr,
    // Same action economy as the player (no stamina); swift-geared foes (extra-
    // action / swift affixes) act several times a turn. Casters spend Resolve.
    resolve: 6 + Math.floor(mind / 2), resolveMax: 6 + Math.floor(mind / 2),
    resolveRegen: 1 + (tr.resolveRegen || 0),
    swiftChance: Math.min(0.5, sm.swiftChance || 0),
    // A designed raid boss acts several times a turn (npc.actionsPerTurn) so it
    // threatens a whole PARTY each round — that's how it's meant to be fought.
    actionsPerTurn: npc.actionsPerTurn != null ? npc.actionsPerTurn : (1 + Math.min(3, Math.max(0, sm.extraActions || 0))), actionsLeft: 1,
    cooldownReduction: Math.min(3, sm.cooldownReduction || 0),
    procs: tr.procs || [], shield: 0, magicShield: 0, invuln: 0,
    weapon, abilities, maxLootTier: tierId, statuses: [], cooldowns: {},
  };
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
    side: "player",
    abilities,
    demeanor: "fierce", morale: 100, moraleMax: 100,
    health: base.maxHealth, // companions arrive fresh; we don't carry their wounds
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
