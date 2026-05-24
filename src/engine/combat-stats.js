// Derives a combatant's concrete combat stats from the 6 RPG attributes plus
// equipped gear. The attributes stay the character backbone; everything the
// combat engine needs (health, armour, dodge, penetration, weapon damage,
// reach/range, initiative, action points, resolve, triggers) is computed here so
// nothing else has to know the formulas.
//
// Gear carries a stat REQUIREMENT scaled by tier. Requirements are SOFT: under-
// req gear still works but its base stats are scaled down by how far short you
// fall (floor 20%), and its PASSIVES switch off entirely until you meet the req.
//
// COMBAT MODEL (post-overhaul): there is NO stamina. Actions are limited by
// ACTION POINTS (actionsPerTurn); spells/abilities additionally drain RESOLVE.
// Weapons differ by SPEED (initiative + the swift "act-again" playstyle), REACH
// (melee) / RANGE (ranged), and penetration. Armour comes in two punishing,
// playstyle-aligned bands — LIGHT (fast, evasive, caster-friendly) and HEAVY
// (slow but armoured, aegis-shielded, harder-hitting).

import { attrFactor } from "../data/abilities.js";
import { tierMult, tier as tierInfo } from "../data/tiers.js";
import { aggregateCombatPassives, aggregateWorldPassives, PASSIVE_CAPS } from "../data/passives.js";
import { attributeThresholdMods } from "../data/attribute-tiers.js";

// Fold attribute-threshold mods into a passive statMods/triggers bundle: most
// stats sum, damageCap is lowest-wins, and the snowball trigger caps are re-applied
// so threshold bonuses can't push lifesteal/thorns/regen/shields past their limits.
const _TRIGGER_CAP_KEYS = ["lifesteal", "thorns", "turnRegen", "shieldGen", "magicShieldGen"];
export function mergeThresholdMods(statMods, triggers, th) {
  for (const k in th.statMods) {
    if (k === "damageCap") statMods.damageCap = statMods.damageCap ? Math.min(statMods.damageCap, th.statMods[k]) : th.statMods[k];
    else statMods[k] = (statMods[k] || 0) + th.statMods[k];
  }
  for (const k in th.triggers) triggers[k] = (triggers[k] || 0) + th.triggers[k];
  for (const k of _TRIGGER_CAP_KEYS) if (triggers[k] != null && PASSIVE_CAPS[k] != null) triggers[k] = Math.min(triggers[k], PASSIVE_CAPS[k]);
}
import { effectiveAttributes, proficiencyRating, weaponMasteryId } from "../data/proficiencies.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Per-family weapon identity. damage min/max + pen are the raw profile; reach is
// melee striking distance, range is the ranged striking distance (a ranged
// weapon may strike anything up to `range`); speed feeds initiative + the swift
// playstyle; reload is a self-cooldown after firing (crossbows). Damage is tier-
// scaled later; reach/range/speed/reload are NOT (they're identity, not power).
// `acc` is the weapon's own accuracy contribution (counters the target's dodge):
// finesse/aimed arms (daggers, bows) are precise; heavy choppers (axes, mauls)
// are not. `reach`/`range` gate striking distance; `speed` feeds initiative.
const WEAPON_BASE = {
  dagger:   { min: 2, max: 4, type: "physical", pen: 1, reach: 1, speed: 3,  acc: 2, crit: 12 }, // low base, FAR highest crit — a finesse killer
  sword:    { min: 4, max: 7, type: "physical", pen: 0, reach: 1, speed: 1,  acc: 1, crit: 4 },
  axe:      { min: 5, max: 9, type: "physical", pen: 0, reach: 1, speed: -1, acc: -2, crit: 2 },
  mace:     { min: 5, max: 8, type: "physical", pen: 2, reach: 1, speed: -2, acc: -1, crit: 0 },
  spear:    { min: 3, max: 7, type: "physical", pen: 2, reach: 2, speed: 0,  acc: 1, crit: 3 },
  bow:      { min: 3, max: 6, type: "physical", pen: 1, range: 4, speed: 1,  acc: 3, crit: 8 },
  crossbow: { min: 5, max: 9, type: "physical", pen: 3, range: 5, speed: -2, reload: 1, acc: 2, crit: 4 },
  arcane:   { min: 2, max: 4, type: "magical",  pen: 1, range: 3, speed: 0,  acc: 0, crit: 2 },
  unarmed:  { min: 2, max: 4, type: "physical", pen: 0, reach: 1, speed: 2,  acc: 0, crit: 0 },
};

// Arcane foci sub-types differ on the ITEM (one family, one mastery): a STAFF is
// a two-handed artillery focus (highest magical damage + reach, but slow); a WAND
// is fast, light, and precise (more casts, leaves a hand free); a GRIMOIRE is a
// one-handed control focus that bites through ward (high magic-pen).
function arcaneSubProfile(name) {
  if (/staff|stave/.test(name)) return { min: 3, max: 6, type: "magical", pen: 1, range: 4, speed: -1, acc: 0 };
  if (/grimoire|tome|spellbook|codex/.test(name)) return { min: 2, max: 5, type: "magical", pen: 3, range: 3, speed: 0, acc: 1 };
  return { min: 2, max: 4, type: "magical", pen: 1, range: 3, speed: 2, acc: 2 }; // wand / rod / scepter / focus
}

// The family identity profile (reach/range/speed/reload) for a weapon category —
// used to give NPC weapons the same positioning identity as the player's.
export function weaponFamilyBase(category) {
  return WEAPON_BASE[category] || WEAPON_BASE.unarmed;
}

// Weapon category for ability weapon-requirements + identity. Honours an explicit
// combat.weaponType, else infers from name/kind. NOTE order: "crossbow" before
// "bow" (it contains the substring), and sling is GONE (no longer a weapon).
export function weaponCategory(item) {
  if (!item) return "unarmed";
  if (item.combat?.weaponType) return item.combat.weaponType;
  const name = `${item.name || ""} ${item.id || ""}`.toLowerCase();
  const has = (...w) => w.some((s) => name.includes(s));
  if (has("dagger", "knife", "dirk", "stiletto", "rondel", "main-gauche", "poignard", "kris")) return "dagger";
  if (has("crossbow", "arbalest", "windlass")) return "crossbow";
  if (has("axe", "cleaver", "hatchet")) return "axe";
  if (has("hammer", "mace", "maul", "warhammer", "club", "morningstar", "flail")) return "mace";
  if (has("spear", "lance", "pike", "halberd", "glaive", "partisan", "trident")) return "spear";
  if (has("bow")) return "bow";
  if (has("staff", "stave", "wand", "rod ", "scepter", "sceptre", "focus", "grimoire", "tome", "spellbook", "codex")) return "arcane";
  if (has("sword", "blade", "sabre", "saber", "rapier", "falchion")) return "sword";
  if (item.kind === "weapon") return "sword";
  return null; // not a weapon
}

// Body-armour weight band. Explicit `armorClass` wins; else inferred from the
// name. Mail/plate/banded/splint/hauberk = heavy; everything softer = light.
export function armorClass(item) {
  if (!item) return null;
  if (item.kind !== "armor") return null;
  if (item.armorClass === "light" || item.armorClass === "heavy") return item.armorClass;
  const name = `${item.name || ""} ${item.id || ""}`.toLowerCase();
  const has = (...w) => w.some((s) => name.includes(s));
  if (has("plate", "banded", "splint", "hauberk")) return "heavy";
  if ((has("mail", "chain")) && !has("shirt")) return "heavy";
  return "light";
}

export function itemCombatStats(item) {
  if (!item) return { armor: 0, ward: 0, dodge: 0, damage: null, weaponType: null, armorClass: null };
  const weaponType = weaponCategory(item);
  if (item.combat) {
    const base = item.combat.damage;
    const fam = WEAPON_BASE[weaponType] || WEAPON_BASE.sword;
    return {
      armor: item.combat.armor || 0,
      ward: item.combat.ward || 0,
      dodge: item.combat.dodge || 0,
      damage: base ? {
        ...base,
        reach: base.reach ?? fam.reach,
        range: base.range ?? fam.range,
        speed: base.speed ?? fam.speed ?? 0,
        reload: base.reload ?? fam.reload ?? 0,
        acc: base.acc ?? fam.acc ?? 0,
      } : null,
      weaponType: base ? (weaponType || "sword") : null,
      armorClass: null,
    };
  }
  const name = `${item.name || ""} ${item.id || ""}`.toLowerCase();
  const kind = item.kind;
  const has = (...words) => words.some((w) => name.includes(w));

  if (kind === "weapon" || weaponType) {
    const fam = weaponType === "arcane" ? arcaneSubProfile(name) : (WEAPON_BASE[weaponType] || WEAPON_BASE.sword);
    let damage = { ...fam };
    // A nameless great/long blade (no family word) reads heavier.
    if (!WEAPON_BASE[weaponType] && has("long", "great")) damage = { ...damage, min: 5, max: 9 };
    // Heft within a family (name keywords): a two-handed/heavy weapon hits harder
    // and slower; a light one hits softer but faster. Applied to the family base
    // BEFORE tier scaling, so the tier curve still drives overall power.
    const HEAVY = ["great", "greater", "two-handed", "twohanded", "maul", "halberd", "glaive", "poleaxe", "bardiche", "partisan", "pike", "zweihander", "claymore", "executioner", "warhammer", "war hammer", "war-hammer", "war bow", "war-bow", "longbow", "heavy", "arbalest", "battle"];
    const LIGHT = ["short", "hand axe", "hand-axe", "throwing", "light", "stiletto", "main-gauche", "hatchet", "buckler"];
    if (HEAVY.some((w) => name.includes(w))) {
      damage = { ...damage, min: Math.round(damage.min * 1.3), max: Math.round(damage.max * 1.3), speed: (damage.speed || 0) - 1 };
      if (weaponType === "mace" || has("war", "maul", "pick")) damage.pen += 1;
    } else if (LIGHT.some((w) => name.includes(w))) {
      damage = { ...damage, min: Math.max(1, Math.round(damage.min * 0.82)), max: Math.max(2, Math.round(damage.max * 0.82)), speed: (damage.speed || 0) + 1 };
    }
    if (item.tier) {
      const m = tierMult(item.tier);
      damage = { ...damage, min: Math.round(damage.min * m), max: Math.round(damage.max * m) };
    }
    return { armor: 0, ward: 0, dodge: 0, damage, weaponType: weaponType || "sword", armorClass: null };
  }

  // Armour class by name keyword (most specific first), scaled by tier.
  let armor = 0, ward = 0, dodge = 0;
  if (has("full plate", "full-plate", "field plate")) armor = 9;
  else if (has("half plate", "half-plate")) armor = 7;
  else if (has("plate")) armor = 8;
  else if (has("banded", "splint")) armor = 6;
  else if (has("chain", "mail", "hauberk")) armor = 5;
  else if (has("brigandine", "scale", "lamellar")) armor = 4;
  else if (has("studded")) armor = 3;
  else if (has("leather", "jerkin", "hide", "gambeson", "padded", "quilted")) armor = 3;
  else if (has("tower shield", "tower")) armor = 4;
  else if (has("kite", "heater", "shield")) armor = 3;
  else if (has("buckler")) armor = 2;
  else if (has("coif", "vambrace", "greaves", "gauntlet")) armor = 2;
  else if (has("helm", "helmet", "cap", "bracers")) armor = 1;
  else if (has("cloak", "robe", "coat")) armor = 1;
  if (has("robe", "circlet", "amulet", "pendant", "charm", "talisman")) ward += 2;
  if (has("boots", "shoes")) dodge += 2;
  if (item.tier) { const m = tierMult(item.tier); armor = Math.round(armor * m); ward = Math.round(ward * m); }
  return { armor, ward, dodge, damage: null, weaponType: null, armorClass: armorClass(item) };
}

// How many hands a weapon needs. Bows/crossbows/staves and two-handed melee
// occupy BOTH hands (no shield); wands/grimoires and one-handers leave a hand
// free. Honours an explicit `hands`, else infers from family + name.
export function weaponHands(item) {
  if (!item) return 1;
  if (item.hands === 2 || item.hands === 1) return item.hands;
  const wt = weaponCategory(item);
  if (wt === "bow" || wt === "crossbow") return 2;
  const n = `${item.name || ""} ${item.id || ""}`.toLowerCase();
  if (wt === "arcane") return /staff|stave/.test(n) ? 2 : 1; // wands/grimoires are one-handed
  if (/great|maul|halberd|glaive|pike|two-hand|zweihander|claymore|greataxe|greatsword|bardiche|partisan|poleaxe|lance/.test(n)) return 2;
  return 1;
}

// The equipment SLOT an item occupies. One item per slot (two rings) — equipping
// a new one displaces the slot's current occupant back to the pack, so combat
// effects can't be stacked by piling on duplicate gear. clothing is split into
// real slots (head/hands/legs/feet/back/over/torso) so you can't wear five helms.
// The wearable slots, in head-to-toe paper-doll order. `cap` is how many items
// the slot holds (two rings). Weapons/shields/body-armour map cleanly from
// `kind`; the finer clothing/trinket slots are ambiguous by name, so those items
// carry an explicit `slot` (read first by equipSlot below).
export const SLOTS = [
  { id: "head",     label: "Head" },
  { id: "neck",     label: "Neck" },
  { id: "over",     label: "Over-robe" },
  { id: "body",     label: "Body" },
  { id: "back",     label: "Back" },
  { id: "hands",    label: "Hands" },
  { id: "ring",     label: "Rings", cap: 2 },
  { id: "legs",     label: "Legs" },
  { id: "feet",     label: "Feet" },
  { id: "torso",    label: "Torso" },
  { id: "mainhand", label: "Main Hand" },
  { id: "offhand",  label: "Off Hand" },
];
const SLOT_IDS = new Set(SLOTS.map((s) => s.id));

export function equipSlot(item) {
  if (!item) return null;
  if (item.slot && SLOT_IDS.has(item.slot)) return item.slot; // explicit wins
  const k = item.kind;
  const n = `${item.name || ""} ${item.id || ""}`.toLowerCase();
  if (k === "weapon") return "mainhand";
  if (k === "shield") return "offhand";
  if (k === "armor") return "body";
  if (k === "trinket") return /\bring\b|signet|band/.test(n) ? "ring" : "neck";
  if (k === "clothing") {
    if (/helm|helmet|cap|coif|hood|circlet|crown|diadem|tiara|mask|\bhat\b/.test(n)) return "head";
    if (/bracer|vambrace|gauntlet|glove/.test(n)) return "hands";
    if (/greave|legging|chausse|cuisse/.test(n)) return "legs";
    if (/boot|shoe|sabaton|sandal/.test(n)) return "feet";
    if (/cloak|cape|mantle|shawl/.test(n)) return "back";
    if (/robe|tabard|livery|surcoat|vestment/.test(n)) return "over";
    return "torso";
  }
  return null;
}

// How many items a slot can hold (two rings; everything else one).
export function slotCapacity(slot) {
  return SLOTS.find((s) => s.id === slot)?.cap || 1;
}

// The attribute + minimum score an item demands, scaled by tier. Met → full
// power + passives; unmet → reduced base stats + passives off. Heavy armour
// demands extra Body (its punishing entry cost); ranged/finesse weapons want
// Reflex, arcane foci want Mind.
export function itemRequirement(item) {
  if (!item) return { attr: "body", value: 0 };
  const order = tierInfo(item.tier || "common").order;
  let value = order * 3; // common 0 … divine 21
  const wt = weaponCategory(item);
  let attr = "body";
  if (item.kind === "weapon" || (wt && item.kind !== "armor")) {
    if (wt === "dagger" || wt === "bow" || wt === "crossbow") attr = "reflex";
    else if (wt === "arcane") attr = "mind";
    else attr = "body";
  } else if (item.kind === "trinket") attr = "mind";
  else if (item.kind === "armor") {
    attr = "body";
    if (armorClass(item) === "heavy") value += 3; // heavy plate asks more of the wearer
  } else if (item.kind === "clothing") {
    // A caster's headpiece wards the MIND, not the body — a circlet that "clears
    // and sharpens the mind" should ask Mind, like a trinket, not the Body a helm
    // or vambrace demands. Decide by what the piece actually grants: more ward
    // than armour ⇒ an arcane focus (Mind); otherwise martial kit (Body).
    const cs = itemCombatStats(item);
    attr = (cs.ward || 0) > (cs.armor || 0) ? "mind" : "body";
  } else attr = "body";
  return { attr, value };
}

function equippedItems(character, codex) {
  const worn = codex?.characters?.wanderer?.worn || [];
  const items = codex?.items || {};
  return worn.map((id) => items[id]).filter(Boolean);
}

// Effectiveness 0.2..1 of an item/ability given how the player's stat compares
// to a requirement. value 0 → always 1.
export function reqEffectiveness(attrs, req) {
  if (!req || !req.value) return 1;
  return clamp((attrs[req.attr] || 0) / req.value, 0.2, 1);
}

// All passives from equipped gear, split by whether their item's requirement is
// met. Used by both combat-stat derivation and the world (exploration) loop.
export function collectEquippedPassives(character, codex) {
  const attrs = effectiveAttributes(character);
  const gear = equippedItems(character, codex);
  const enabled = [];
  const disabled = [];
  // Racial passives are innate and ALWAYS on — no item, no requirement check. They
  // flow through the same aggregation as gear affixes (combat + world passives).
  if (Array.isArray(character?.racialPassives) && character.racialPassives.length) enabled.push(...character.racialPassives);
  for (const it of gear) {
    const list = it.passives || [];
    if (list.length === 0) continue;
    const met = reqEffectiveness(attrs, itemRequirement(it)) >= 1;
    (met ? enabled : disabled).push(...list);
  }
  return { enabled, disabled };
}

function weaponProfile(character, codex, eff) {
  const attrs = eff || effectiveAttributes(character);
  const gear = equippedItems(character, codex);
  const weapon = gear.find((it) => itemCombatStats(it).damage);
  const cs = weapon ? itemCombatStats(weapon) : null;
  const base = cs?.damage || { ...WEAPON_BASE.unarmed };
  const category = cs?.weaponType || "unarmed";
  const gov = base.type === "magical" ? attrs.mind : attrs.body;
  const f = attrFactor(gov);
  const reqEff = weapon ? reqEffectiveness(attrs, itemRequirement(weapon)) : 1;
  const mastery = proficiencyRating(character, weaponMasteryId(category)); // weapon mastery → damage
  const fam = WEAPON_BASE[category] || WEAPON_BASE.unarmed;
  return {
    min: Math.max(1, Math.round(base.min * f * reqEff) + Math.floor(mastery / 2)),
    max: Math.max(1, Math.round(base.max * f * reqEff) + mastery),
    type: base.type || "physical",
    pen: (base.pen || 0) + Math.floor((attrs.body || 0) / 4),
    category,
    mastery,
    reach: base.reach ?? fam.reach ?? 1,
    range: base.range ?? fam.range ?? 0,
    speed: base.speed ?? fam.speed ?? 0,
    reload: base.reload ?? fam.reload ?? 0,
    acc: base.acc ?? fam.acc ?? 0,
    crit: fam.crit ?? 0, // weapon-family crit chance (daggers/finesse arms crit most)
    name: weapon ? (weapon.name || weapon.id) : "Unarmed",
  };
}

// Light/heavy armour band modifiers — the punishing, playstyle-aligned tradeoff.
// LIGHT rewards speed/evasion/casting; HEAVY rewards armour/health/damage but
// crushes mobility and tempo.
function armorBandMods(cls) {
  if (cls === "heavy") {
    return {
      speed: -3, actions: -1, swiftChance: -1, dodgeMult: 0.2,
      maxHealth: 10, damageMult: 0.1, ward: 2, shieldGen: 0.03, accuracy: -2,
    };
  }
  if (cls === "light") {
    return {
      speed: 2, actions: 0, swiftChance: 0.15, dodgeMult: 1,
      maxHealth: 0, damageMult: 0, ward: 1, shieldGen: 0, accuracy: 1, dodge: 4,
    };
  }
  return { speed: 0, actions: 0, swiftChance: 0, dodgeMult: 1, maxHealth: 0, damageMult: 0, ward: 0, shieldGen: 0, accuracy: 0, dodge: 0 };
}

export function deriveCombatStats(character, codex) {
  const a = effectiveAttributes(character);
  const body = a.body || 0, reflex = a.reflex || 0, vigor = a.vigor || 0;
  const mind = a.mind || 0, wit = a.wit || 0;
  const gear = equippedItems(character, codex);

  // Proficiency domain bonuses (the gradual, do-it-get-better effects).
  const prof = {
    ambush: proficiencyRating(character, "ambush"),
    awareness: proficiencyRating(character, "awareness"),
    evasion: proficiencyRating(character, "evasion"),
    spellcasting: proficiencyRating(character, "spellcasting"),
    endurance: proficiencyRating(character, "endurance"),
    command: proficiencyRating(character, "command"),
  };

  let armor = Math.floor(body / 3);
  let ward = Math.floor(mind / 3);
  let dodgeGear = 0;
  let band = armorBandMods(null);
  for (const it of gear) {
    const stats = itemCombatStats(it);
    const eff = reqEffectiveness(a, itemRequirement(it));
    armor += Math.round(stats.armor * eff);
    ward += Math.round(stats.ward * eff);
    dodgeGear += Math.round(stats.dodge * eff);
    if (it.kind === "armor" && stats.armorClass) band = armorBandMods(stats.armorClass);
  }

  // Req-met passives modify stats and add triggers (attrs gate threshold passives).
  const { enabled } = collectEquippedPassives(character, codex);
  const { statMods, triggers } = aggregateCombatPassives(enabled, a);
  // Attribute thresholds: smooth stat scaling + unique-effect unlocks, folded into
  // the same statMods/triggers (damageCap is lowest-wins; trigger caps re-applied).
  mergeThresholdMods(statMods, triggers, attributeThresholdMods(a));

  const weapon = weaponProfile(character, codex, a);
  weapon.pen += statMods.penetration || 0;
  // Affix offence: flat damage adds, then % damage multiplies (Diablo-style),
  // plus the heavy-armour damage bump.
  const dFlat = statMods.damageFlat || 0;
  const dMult = 1 + (statMods.damageMult || 0) + (band.damageMult || 0);
  weapon.min = Math.max(1, Math.round((weapon.min + dFlat) * dMult));
  weapon.max = Math.max(weapon.min, Math.round((weapon.max + dFlat) * dMult));
  prof.weaponMastery = weapon.mastery;

  // Initiative (speed): attributes + weapon speed + armour band + affixes.
  const speed = reflex + Math.floor(wit / 2) + (weapon.speed || 0) + (band.speed || 0) + (statMods.speed || 0);
  // Action points: 1 base + swift affixes (capped) + armour band penalty (heavy).
  const actionsPerTurn = Math.max(1, 1 + clamp(statMods.extraActions || 0, 0, 3) + (band.actions || 0));
  // Swift "act again" chance: light armour + affixes + a touch of Reflex, capped.
  const swiftChance = clamp((band.swiftChance || 0) + (statMods.swiftChance || 0) + reflex * 0.01, 0, 0.5);
  // Dodge: light keeps full value, heavy is crushed to a fifth.
  let dodge = reflex * 2 + dodgeGear + prof.evasion + (statMods.dodge || 0) + (band.dodge || 0);
  dodge = clamp(Math.round(dodge * (band.dodgeMult ?? 1)), 0, 70);

  return {
    maxHealth: character.vitalityMax + (statMods.maxHealth || 0) + (band.maxHealth || 0),
    dr: clamp(statMods.drPct || 0, 0, 0.85), // flat % damage reduction, capped (deep DR stacking pays off)
    phaseChance: clamp(statMods.phaseChance || 0, 0, 0.4), // uncounterable evade (Phantom)
    dodgeIgnore: clamp(statMods.dodgeIgnore || 0, 0, 1),   // attacks ignore the foe's dodge (Deadeye)
    armor: armor + (statMods.armor || 0),
    ward: ward + (statMods.ward || 0) + (band.ward || 0),
    dodge,
    accuracy: reflex + wit + prof.awareness + weapon.mastery + (weapon.acc || 0) + (statMods.accuracy || 0) + (band.accuracy || 0),
    critChance: clamp(Math.round(wit * 1.5 + reflex) + (weapon.crit || 0) + (statMods.critChance || 0), 0, 100), // stackable to a guaranteed crit
    critMult: Math.min(9.99, 1.5 + (statMods.critMult || 0)), // crit damage caps at 999%, not a token ceiling
    weapon,
    speed,
    // Action economy: action points spent on anything; swift builds act several
    // times a turn via extra AP and the act-again roll. No stamina.
    actionsPerTurn,
    swiftChance,
    cooldownReduction: clamp(statMods.cooldownReduction || 0, 0, 3),
    fortify: clamp(statMods.fortify || 0, 0, 0.25),
    // Stonewall caps any single hit to a share of max health (0 = no cap); the
    // strongest (lowest) wins, set in aggregateCombatPassives. Unbowed resists control.
    damageCap: statMods.damageCap || 0,
    controlResist: clamp(statMods.controlResist || 0, 0, 0.6),
    // Healing amplification (all heals ×(1+healPower)) and damage deferral (a share
    // of each blow bleeds out over a few turns instead of landing at once).
    healPower: clamp(statMods.healPower || 0, 0, 1.0),
    dmgDefer: clamp(statMods.dmgDefer || 0, 0, 0.6),
    // Heavy armour layers on a small ever-renewing aegis shield (folded into the
    // shieldGen trigger so the engine's cap still applies).
    triggers: { ...triggers, shieldGen: (triggers.shieldGen || 0) + (band.shieldGen || 0) },
    attrs: a,
    prof,
  };
}

// Aggregated world (exploration) passives from currently-equipped, req-met gear.
export function activeWorldPassives(character, codex) {
  const { enabled } = collectEquippedPassives(character, codex);
  return aggregateWorldPassives(enabled);
}
