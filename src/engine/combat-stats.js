// Derives a combatant's concrete combat stats from the 6 RPG attributes plus
// equipped gear. The attributes stay the character backbone; everything the
// combat engine needs (health, armour, dodge, penetration, weapon damage,
// stamina) is computed here so nothing else has to know the formulas.

import { attrFactor } from "../data/abilities.js";
import { tierMult } from "../data/tiers.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Combat properties for an item. Honours an explicit `combat` block on the
// codex item (set by loot generation or the narrator); otherwise infers a
// sensible block from the item's kind and name so hand-authored / looted gear
// still fights reasonably. Returns { armor, ward, dodge, damage }, any of which
// may be 0/null.
export function itemCombatStats(item) {
  if (!item) return { armor: 0, ward: 0, dodge: 0, damage: null };
  if (item.combat) {
    return {
      armor: item.combat.armor || 0,
      ward: item.combat.ward || 0,
      dodge: item.combat.dodge || 0,
      damage: item.combat.damage || null,
    };
  }
  const name = `${item.name || ""} ${item.id || ""}`.toLowerCase();
  const kind = item.kind;
  const has = (...words) => words.some((w) => name.includes(w));

  if (kind === "weapon" || has("sword", "axe", "dagger", "knife", "mace", "hammer", "spear", "bow", "staff", "cleaver", "lance", "blade")) {
    let damage = { min: 2, max: 5, type: "physical", pen: 0 };
    if (has("dagger", "knife"))      damage = { min: 2, max: 4, type: "physical", pen: 1 };
    else if (has("short sword"))     damage = { min: 3, max: 6, type: "physical", pen: 0 };
    else if (has("long", "sword", "blade", "cleaver")) damage = { min: 4, max: 8, type: "physical", pen: 0 };
    else if (has("axe"))             damage = { min: 5, max: 9, type: "physical", pen: 0 };
    else if (has("hammer", "mace", "warhammer")) damage = { min: 5, max: 8, type: "physical", pen: 2 };
    else if (has("spear", "lance"))  damage = { min: 3, max: 7, type: "physical", pen: 2 };
    else if (has("bow"))             damage = { min: 3, max: 6, type: "physical", pen: 1 };
    else if (has("staff", "wand", "rod")) damage = { min: 3, max: 6, type: "magical", pen: 1 };
    if (item.tier) {
      const m = tierMult(item.tier);
      damage = { ...damage, min: Math.round(damage.min * m), max: Math.round(damage.max * m) };
    }
    return { armor: 0, ward: 0, dodge: 0, damage };
  }

  // Defensive / worn gear.
  let armor = 0, ward = 0, dodge = 0;
  if (has("plate", "full plate")) armor = 8;
  else if (has("chain", "mail", "hauberk")) armor = 5;
  else if (has("brigandine", "scale")) armor = 4;
  else if (has("leather", "jerkin", "hide")) armor = 3;
  else if (has("shield", "buckler")) armor = 3;
  else if (has("helm", "helmet", "cap", "bracers", "greaves", "gauntlet")) armor = 1;
  else if (has("cloak", "robe", "coat")) armor = 1;
  if (has("robe", "circlet", "amulet", "pendant", "charm")) ward += 2;
  if (has("boots", "shoes")) dodge += 2;
  if (item.tier) { const m = tierMult(item.tier); armor = Math.round(armor * m); ward = Math.round(ward * m); }
  return { armor, ward, dodge, damage: null };
}

function equippedItems(character, codex) {
  const worn = codex?.characters?.wanderer?.worn || [];
  const items = codex?.items || {};
  return worn.map((id) => items[id]).filter(Boolean);
}

// Find the equipped weapon's damage block, or unarmed defaults. The governing
// attribute (body for physical, mind for magical) amplifies it.
function weaponProfile(character, codex) {
  const gear = equippedItems(character, codex);
  const weapon = gear.find((it) => itemCombatStats(it).damage);
  const base = weapon ? itemCombatStats(weapon).damage : { min: 2, max: 4, type: "physical", pen: 0 };
  const attrs = character.attributes || {};
  const gov = base.type === "magical" ? attrs.mind : attrs.body;
  const f = attrFactor(gov);
  return {
    min: Math.max(1, Math.round(base.min * f)),
    max: Math.max(1, Math.round(base.max * f)),
    type: base.type || "physical",
    pen: (base.pen || 0) + Math.floor((attrs.body || 0) / 4),
    name: weapon ? (weapon.name || weapon.id) : "Unarmed",
  };
}

export function deriveCombatStats(character, codex) {
  const a = character.attributes || {};
  const body = a.body || 0, reflex = a.reflex || 0, vigor = a.vigor || 0;
  const mind = a.mind || 0, wit = a.wit || 0;
  const gear = equippedItems(character, codex);

  let armor = Math.floor(body / 3);
  let ward = Math.floor(mind / 3);
  let dodgeGear = 0;
  for (const it of gear) {
    const cs = itemCombatStats(it);
    armor += cs.armor; ward += cs.ward; dodgeGear += cs.dodge;
  }

  return {
    maxHealth: character.vitalityMax,
    armor,
    ward,
    dodge: clamp(reflex * 2 + dodgeGear, 0, 60),
    accuracy: reflex + wit,
    critChance: clamp(Math.round(wit * 1.5 + reflex), 0, 50),
    critMult: 1.5,
    weapon: weaponProfile(character, codex),
    maxStamina: 4 + Math.floor((vigor + reflex) / 3),
    staminaRegen: 2 + Math.floor(vigor / 4),
    speed: reflex + Math.floor(wit / 2),
  };
}
