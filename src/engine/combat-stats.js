// Derives a combatant's concrete combat stats from the 6 RPG attributes plus
// equipped gear. The attributes stay the character backbone; everything the
// combat engine needs (health, armour, dodge, penetration, weapon damage,
// stamina, triggers) is computed here so nothing else has to know the formulas.
//
// Gear carries a stat REQUIREMENT scaled by tier. Requirements are SOFT: under-
// req gear still works but its base stats are scaled down by how far short you
// fall (floor 20%), and its PASSIVES switch off entirely until you meet the req.

import { attrFactor } from "../data/abilities.js";
import { tierMult, tier as tierInfo } from "../data/tiers.js";
import { aggregateCombatPassives, aggregateWorldPassives } from "../data/passives.js";
import { effectiveAttributes, proficiencyRating, weaponMasteryId } from "../data/proficiencies.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Weapon category for ability weapon-requirements. Honours an explicit
// combat.weaponType, else infers from name/kind.
export function weaponCategory(item) {
  if (!item) return "unarmed";
  if (item.combat?.weaponType) return item.combat.weaponType;
  const name = `${item.name || ""} ${item.id || ""}`.toLowerCase();
  const has = (...w) => w.some((s) => name.includes(s));
  if (has("dagger", "knife", "dirk", "stiletto", "rondel", "main-gauche", "poignard", "kris")) return "dagger";
  if (has("axe", "cleaver", "hatchet")) return "axe";
  if (has("hammer", "mace", "maul", "warhammer", "club", "morningstar", "flail")) return "mace";
  if (has("spear", "lance", "pike", "halberd", "glaive")) return "spear";
  if (has("bow", "sling", "crossbow", "arbalest")) return "bow";
  if (has("staff", "stave")) return "staff";
  if (has("wand", "rod", "scepter", "focus")) return "wand";
  if (has("sword", "blade", "sabre", "saber", "rapier", "falchion")) return "sword";
  if (item.kind === "weapon") return "sword";
  return null; // not a weapon
}

export function itemCombatStats(item) {
  if (!item) return { armor: 0, ward: 0, dodge: 0, damage: null, weaponType: null };
  const weaponType = weaponCategory(item);
  if (item.combat) {
    return {
      armor: item.combat.armor || 0,
      ward: item.combat.ward || 0,
      dodge: item.combat.dodge || 0,
      damage: item.combat.damage || null,
      weaponType: item.combat.damage ? (weaponType || "sword") : null,
    };
  }
  const name = `${item.name || ""} ${item.id || ""}`.toLowerCase();
  const kind = item.kind;
  const has = (...words) => words.some((w) => name.includes(w));

  if (kind === "weapon" || weaponType) {
    let damage = { min: 2, max: 5, type: "physical", pen: 0 };
    if (weaponType === "dagger")      damage = { min: 2, max: 4, type: "physical", pen: 1 };
    else if (weaponType === "axe")    damage = { min: 5, max: 9, type: "physical", pen: 0 };
    else if (weaponType === "mace")   damage = { min: 5, max: 8, type: "physical", pen: 2 };
    else if (weaponType === "spear")  damage = { min: 3, max: 7, type: "physical", pen: 2 };
    else if (weaponType === "bow")    damage = { min: 3, max: 6, type: "physical", pen: 1 };
    else if (weaponType === "staff" || weaponType === "wand") damage = { min: 2, max: 4, type: "magical", pen: 1 };
    else if (has("long", "great"))    damage = { min: 5, max: 9, type: "physical", pen: 0 };
    else                              damage = { min: 4, max: 7, type: "physical", pen: 0 };
    // Heft within a family (name keywords): a two-handed/heavy weapon hits harder
    // (and a war-pick/maul punches through more), a light one hits softer but is
    // implicitly faster. Applied to the family base BEFORE tier scaling, so the
    // tier curve still drives overall power.
    const HEAVY = ["great", "greater", "two-handed", "twohanded", "maul", "halberd", "glaive", "poleaxe", "bardiche", "partisan", "pike", "zweihander", "claymore", "executioner", "warhammer", "war hammer", "war-hammer", "war bow", "war-bow", "longbow", "heavy", "arbalest", "battle"];
    const LIGHT = ["short", "hand axe", "hand-axe", "throwing", "light", "stiletto", "main-gauche", "hatchet", "sling", "buckler"];
    if (HEAVY.some((w) => name.includes(w))) {
      damage = { ...damage, min: Math.round(damage.min * 1.3), max: Math.round(damage.max * 1.3) };
      if (weaponType === "mace" || has("war", "maul", "pick")) damage.pen += 1;
    } else if (LIGHT.some((w) => name.includes(w))) {
      damage = { ...damage, min: Math.max(1, Math.round(damage.min * 0.82)), max: Math.max(2, Math.round(damage.max * 0.82)) };
    }
    if (item.tier) {
      const m = tierMult(item.tier);
      damage = { ...damage, min: Math.round(damage.min * m), max: Math.round(damage.max * m) };
    }
    return { armor: 0, ward: 0, dodge: 0, damage, weaponType: weaponType || "sword" };
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
  return { armor, ward, dodge, damage: null, weaponType: null };
}

// How many hands a weapon needs. Two-handers (greatswords, mauls, polearms) and
// all bows/crossbows/staves occupy BOTH hands — so they can't be paired with a
// shield. Honours an explicit `hands`, else infers from family + name.
export function weaponHands(item) {
  if (!item) return 1;
  if (item.hands === 2 || item.hands === 1) return item.hands;
  const wt = weaponCategory(item);
  if (wt === "bow" || wt === "staff") return 2;
  const n = `${item.name || ""} ${item.id || ""}`.toLowerCase();
  if (/great|maul|halberd|glaive|pike|two-hand|zweihander|claymore|greataxe|greatsword|longbow|war ?bow|bardiche|partisan|poleaxe|lance/.test(n)) return 2;
  return 1;
}

// The equipment SLOT an item occupies. One item per slot (two rings) — equipping
// a new one displaces the slot's current occupant back to the pack, so combat
// effects can't be stacked by piling on duplicate gear. clothing is split into
// real slots (head/hands/legs/feet/back/over/torso) so you can't wear five helms.
export function equipSlot(item) {
  if (!item) return null;
  const k = item.kind;
  const n = `${item.name || ""} ${item.id || ""}`.toLowerCase();
  if (k === "weapon") return "mainhand";
  if (k === "shield") return "offhand";
  if (k === "armor") return "body";
  if (k === "trinket") return /\bring\b|signet|band/.test(n) ? "ring" : "neck";
  if (k === "clothing") {
    if (/helm|helmet|cap|coif|hood|circlet|crown|mask|\bhat\b/.test(n)) return "head";
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
  return slot === "ring" ? 2 : 1;
}

// The attribute + minimum score an item demands, scaled by tier. Met → full
// power + passives; unmet → reduced base stats + passives off.
export function itemRequirement(item) {
  if (!item) return { attr: "body", value: 0 };
  const order = tierInfo(item.tier || "common").order;
  const value = order * 3; // common 0 … divine 21
  const wt = weaponCategory(item);
  let attr = "body";
  if (item.kind === "weapon" || wt) {
    if (wt === "dagger" || wt === "bow") attr = "reflex";
    else if (wt === "staff" || wt === "wand") attr = "mind";
    else attr = "body";
  } else if (item.kind === "trinket") attr = "mind";
  else attr = "body";
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
  const base = cs?.damage || { min: 2, max: 4, type: "physical", pen: 0 };
  const category = cs?.weaponType || "unarmed";
  const gov = base.type === "magical" ? attrs.mind : attrs.body;
  const f = attrFactor(gov);
  const reqEff = weapon ? reqEffectiveness(attrs, itemRequirement(weapon)) : 1;
  const mastery = proficiencyRating(character, weaponMasteryId(category)); // weapon mastery → damage
  return {
    min: Math.max(1, Math.round(base.min * f * reqEff) + Math.floor(mastery / 2)),
    max: Math.max(1, Math.round(base.max * f * reqEff) + mastery),
    type: base.type || "physical",
    pen: (base.pen || 0) + Math.floor((attrs.body || 0) / 4),
    category,
    mastery,
    name: weapon ? (weapon.name || weapon.id) : "Unarmed",
  };
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
  for (const it of gear) {
    const stats = itemCombatStats(it);
    const eff = reqEffectiveness(a, itemRequirement(it));
    armor += Math.round(stats.armor * eff);
    ward += Math.round(stats.ward * eff);
    dodgeGear += Math.round(stats.dodge * eff);
  }

  // Req-met passives modify stats and add triggers.
  const { enabled } = collectEquippedPassives(character, codex);
  const { statMods, triggers } = aggregateCombatPassives(enabled);

  const weapon = weaponProfile(character, codex, a);
  weapon.pen += statMods.penetration || 0;
  // Affix offence: flat damage adds, then % damage multiplies (Diablo-style).
  const dFlat = statMods.damageFlat || 0;
  const dMult = 1 + (statMods.damageMult || 0);
  weapon.min = Math.max(1, Math.round((weapon.min + dFlat) * dMult));
  weapon.max = Math.max(weapon.min, Math.round((weapon.max + dFlat) * dMult));
  prof.weaponMastery = weapon.mastery;

  return {
    maxHealth: character.vitalityMax + (statMods.maxHealth || 0),
    dr: clamp(statMods.drPct || 0, 0, 0.6), // flat % damage reduction, capped
    armor: armor + (statMods.armor || 0),
    ward: ward + (statMods.ward || 0),
    dodge: clamp(reflex * 2 + dodgeGear + prof.evasion + (statMods.dodge || 0), 0, 70),
    accuracy: reflex + wit + prof.awareness + weapon.mastery + (statMods.accuracy || 0),
    critChance: clamp(Math.round(wit * 1.5 + reflex) + (statMods.critChance || 0), 0, 60),
    critMult: 1.5 + (statMods.critMult || 0),
    weapon,
    maxStamina: 4 + Math.floor((vigor + reflex) / 3) + Math.floor(prof.endurance / 2) + (statMods.maxStamina || 0),
    staminaRegen: 2 + Math.floor(vigor / 4) + (triggers.staminaRegen || 0),
    speed: reflex + Math.floor(wit / 2),
    // Action economy: everyone gets 1 action point a turn; "swift" affixes add up
    // to +3 (capped). Cooldown-reduction and fortify ride along for the engine.
    actionsPerTurn: 1 + clamp(statMods.extraActions || 0, 0, 3),
    cooldownReduction: clamp(statMods.cooldownReduction || 0, 0, 3),
    fortify: clamp(statMods.fortify || 0, 0, 0.25),
    attrs: a,
    prof,
    triggers,
  };
}

// Aggregated world (exploration) passives from currently-equipped, req-met gear.
export function activeWorldPassives(character, codex) {
  const { enabled } = collectEquippedPassives(character, codex);
  return aggregateWorldPassives(enabled);
}
