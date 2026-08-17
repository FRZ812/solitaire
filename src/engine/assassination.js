import { attrFactor, getAbilityDef } from "../data/abilities.js";
import { TIER_BY_ID, tier as tierInfo, tierMult } from "../data/tiers.js";
import { enemyFromNPC } from "../data/bestiary.js";
import { passiveDef } from "../data/passives.js";
import { deriveCombatStats } from "./combat-stats.js";
import { isLivingCharacter } from "./aging.js";
import { progressionCombatEntitlements } from "./progression-abilities.js";

const ATTRIBUTES = ["body", "reflex", "vigor", "mind", "wit", "presence"];
const PROTECTED_PASSIVES = new Set(["undying", "godward", "aegis-eternal"]);
const PROTECTED_ABILITY_EFFECTS = new Set(["invuln", "unstoppable"]);
const COMBAT_RESOURCE_GATES = [
  "warriorTempoCost",
  "rogueRequiresOpening",
  "rangerQuarryInsightCost",
  "barbarianFuryCost",
  "paladinConvictionCost",
  "bardCadenceCost",
  "warlockFavorCost",
  "artificerChargeCost",
];
const ITEM_COMBAT_NUMBERS = new Set([
  "armor", "ward", "dodge", "health", "damageReduction", "speed",
]);
const DAMAGE_NUMBERS = new Set(["min", "max", "pen", "reach", "speed"]);

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isFiniteNumber(value, min = 0, max = 1_000_000) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function abilityEntry(value) {
  if (typeof value === "string") return { id: value, tier: "common" };
  if (!value || typeof value !== "object" || typeof value.id !== "string") return null;
  const tier = value.tier || "common";
  if (!Object.hasOwn(TIER_BY_ID, tier)) return null;
  return { id: value.id, tier };
}

function abilityDataIsAuditable(entries) {
  return Array.isArray(entries) && entries.every((value) => {
    const entry = abilityEntry(value);
    return !!entry && !!getAbilityDef(entry.id);
  });
}

function passiveDataIsAuditable(entries) {
  if (entries == null) return true;
  return Array.isArray(entries) && entries.every((value) => {
    const entry = abilityEntry(value);
    return !!entry && !!passiveDef(entry.id);
  });
}

function equipmentDataIsAuditable(character, codex) {
  return Array.isArray(character?.worn) && character.worn.every((itemId) => {
    if (typeof itemId !== "string"
      || !Object.hasOwn(codex?.items || {}, itemId)) return false;
    const item = codex.items[itemId];
    if (!isPlainObject(item)
      || item.id !== itemId
      || typeof item.kind !== "string"
      || (item.tier != null && !Object.hasOwn(TIER_BY_ID, item.tier))
      || !passiveDataIsAuditable(item.passives)) return false;
    if (item.combat == null) return true;
    if (!isPlainObject(item.combat)) return false;
    for (const [key, value] of Object.entries(item.combat)) {
      if (!ITEM_COMBAT_NUMBERS.has(key)
        && !["armorClass", "weaponType", "damage"].includes(key)) return false;
      if (ITEM_COMBAT_NUMBERS.has(key) && !isFiniteNumber(value)) return false;
      if (key === "armorClass" && !["none", "light", "heavy"].includes(value)) return false;
      if (key === "weaponType" && (typeof value !== "string" || !value.trim())) return false;
      if (key === "damage") {
        if (!isPlainObject(value)) return false;
        for (const [damageKey, damageValue] of Object.entries(value)) {
          if (!DAMAGE_NUMBERS.has(damageKey) && damageKey !== "type") return false;
          if (DAMAGE_NUMBERS.has(damageKey) && !isFiniteNumber(damageValue)) return false;
          if (damageKey === "type" && (typeof damageValue !== "string" || !damageValue.trim())) return false;
        }
      }
    }
    return true;
  });
}

function proficiencyDataIsAuditable(character) {
  return isPlainObject(character?.proficiencies)
    && Object.values(character.proficiencies).every((value) => isFiniteNumber(value));
}

function healthDataIsAuditable(character) {
  for (const key of ["vitality", "vitalityMax", "health", "maxHealth"]) {
    if (character[key] != null && !isFiniteNumber(character[key])) return false;
  }
  if (character.combatState == null) return true;
  if (!isPlainObject(character.combatState)) return false;
  for (const key of ["health", "maxHealth"]) {
    if (character.combatState[key] != null && !isFiniteNumber(character.combatState[key])) return false;
  }
  return character.combatState.status == null
    || ["ok", "alive", "yielded", "fled", "dead"].includes(character.combatState.status);
}

function combatDataIsAuditable(character, codex) {
  return abilityDataIsAuditable(character?.abilities)
    && passiveDataIsAuditable(character?.passives)
    && passiveDataIsAuditable(character?.innatePassives)
    && proficiencyDataIsAuditable(character)
    && healthDataIsAuditable(character)
    && equipmentDataIsAuditable(character, codex);
}

function ownedAbilities(character) {
  const byId = new Map();
  for (const source of [
    ...(Array.isArray(character?.abilities) ? character.abilities : []),
    ...(progressionCombatEntitlements(character).abilities || []),
  ]) {
    const entry = abilityEntry(source);
    if (!entry || !getAbilityDef(entry.id)) continue;
    const prior = byId.get(entry.id);
    if (!prior || tierInfo(entry.tier).order > tierInfo(prior.tier).order) byId.set(entry.id, entry);
  }
  return [...byId.values()];
}

function hasCompleteStatBlock(character) {
  return !!character
    && isPlainObject(character.attributes)
    && ATTRIBUTES.every((key) => Object.hasOwn(character.attributes, key)
      && isFiniteNumber(character.attributes[key], 0, 90));
}

function abilityCanResolveAssassination(entry, attacker) {
  const def = getAbilityDef(entry.id);
  if (!def || def.target !== "enemy" || def.nonlethal) return false;
  if (!(def.dmg || def.damageMult || def.damageType)) return false;
  if (def.scaling === "weapon"
    && def.weaponReq?.length
    && !def.weaponReq.includes(attacker?.weapon?.category)) return false;
  if (Number(def.resolveCost || 0) > 0) return false;
  return COMBAT_RESOURCE_GATES.every((key) => def[key] == null || def[key] === false || Number(def[key]) === 0);
}

function protectedTarget(target, stats) {
  if (target.boss || target.isBoss || target.apex || target.guarded || (target.actionsPerTurn || 1) > 1) return true;
  if (tierInfo(target.tier || "common").order >= tierInfo("legendary").order) return true;
  if ((stats.damageCap || 0) > 0 || (stats.triggers?.reviveOnce || 0) > 0 || (stats.triggers?.invulnCharges || 0) > 0) return true;
  const passives = [...(target.innatePassives || []), ...(target.passives || [])]
    .map(abilityEntry)
    .filter(Boolean);
  if (passives.some(({ id }) => PROTECTED_PASSIVES.has(id))) return true;
  return (target.abilities || []).some((value) => {
    const entry = abilityEntry(value);
    const def = entry ? getAbilityDef(entry.id) : null;
    return !!def && PROTECTED_ABILITY_EFFECTS.has(def.effect?.type);
  });
}

function methodScore(attacker, method) {
  const base = (attacker.accuracy || 0)
    + (attacker.prof?.ambush || 0) * 3
    + Math.max(attacker.attrs?.body || 0, attacker.attrs?.reflex || 0, attacker.attrs?.wit || 0)
    + (attacker.weapon?.max || 0) * 2
    + (attacker.weapon?.pen || 0) * 2;
  if (method.id === "basic") return base;
  const def = getAbilityDef(method.id);
  if (!def) return -Infinity;
  const order = tierInfo(method.tier || "common").order;
  let potency = 0;
  if (def.scaling === "weapon") {
    potency = (attacker.weapon?.max || 0) * Math.max(0.25, Math.min(2, def.damageMult || 1));
    if (def.dmg) potency += def.dmg[1] || 0;
  } else if (def.dmg) {
    const attr = def.scaleAttr ? attacker.attrs?.[def.scaleAttr] : 0;
    potency = (def.dmg[1] || 0) * tierMult(method.tier || "common") * attrFactor(attr || 0);
  }
  return base
    + potency
    + order * 8
    + (def.pen || 0) * 2
    + (def.critBonus || 0) / 4
    + (def.damageType === "true" ? 10 : 0);
}

function targetResistance(target, stats) {
  return (stats.maxHealth || 0)
    + (stats.armor || 0) * 3
    + (stats.dodge || 0)
    + (stats.prof?.awareness || 0) * 3
    + Math.round((stats.dr || 0) * 50)
    + Math.max(target.attributes?.vigor || 0, target.attributes?.reflex || 0, target.attributes?.wit || 0);
}

function assassinationMethods(player, attacker) {
  if (!abilityDataIsAuditable(player?.abilities)) return [];
  return [
    { id: "basic", tier: "common" },
    ...ownedAbilities(player).filter((entry) => abilityCanResolveAssassination(entry, attacker)),
  ];
}

export function narratorAssassinationAttemptCapabilities(state, presentCharacterIds) {
  const player = state?.character;
  const codex = state?.world?.codex;
  const characters = codex?.characters || {};
  const playerRecord = { ...(characters[player?.id || "wanderer"] || {}), ...(player || {}) };
  // The narrator assassination resolver belongs to the retired freeform combat
  // model. Tower archetypes must never expose it, even while a just-loaded save
  // still carries legacy learned abilities in either character record.
  if (playerRecord.progressionModel === "tow-archetype") return {};
  const playerId = player?.id || "wanderer";
  const party = new Set(state?.party || []);
  if (!hasCompleteStatBlock(player)
    || !codex
    || !isLivingCharacter(player)
    || (characters[playerId] && !isLivingCharacter(characters[playerId]))
    || !combatDataIsAuditable(playerRecord, codex)) return {};
  const attacker = deriveCombatStats(player, codex);
  const methods = assassinationMethods(player, attacker).map(({ id }) => id);
  const capabilities = {};
  for (const id of presentCharacterIds || []) {
    const target = characters[id];
    if (!target
      || id === playerId
      || target.id !== id
      || party.has(id)
      || !isLivingCharacter(target)
      || !hasCompleteStatBlock(target)
      || !combatDataIsAuditable(target, codex)
      || (target.tier != null && !Object.hasOwn(TIER_BY_ID, target.tier))) continue;
    capabilities[id] = { methods: [...methods] };
  }
  return capabilities;
}

export function narratorAssassinationCapabilities(state, presentCharacterIds) {
  const player = state?.character;
  const codex = state?.world?.codex;
  const characters = codex?.characters || {};
  const playerRecord = { ...(characters[player?.id || "wanderer"] || {}), ...(player || {}) };
  if (playerRecord.progressionModel === "tow-archetype") return {};
  const playerId = player?.id || "wanderer";
  const party = new Set(state?.party || []);
  if (!hasCompleteStatBlock(player)
    || !codex
    || !isLivingCharacter(player)
    || (characters[playerId] && !isLivingCharacter(characters[playerId]))
    || !combatDataIsAuditable(playerRecord, codex)) return {};

  const attacker = deriveCombatStats(player, codex);
  const methods = assassinationMethods(player, attacker);
  const capabilities = {};
  for (const id of presentCharacterIds || []) {
    const target = characters[id];
    if (!target
      || id === playerId
      || target.id !== id
      || party.has(id)
      || !isLivingCharacter(target)
      || !hasCompleteStatBlock(target)
      || !combatDataIsAuditable(target, codex)) continue;
    if (target.tier != null && !Object.hasOwn(TIER_BY_ID, target.tier)) continue;
    const defender = enemyFromNPC(target, codex, { tierId: target.tier || "common" });
    if (protectedTarget(target, defender)) continue;
    const resistance = targetResistance(target, defender);
    const allowed = methods.filter((method) => {
      if (method.id === "basic" && defender.armorClass === "heavy") return false;
      return methodScore(attacker, method) >= resistance;
    }).map(({ id }) => id);
    if (allowed.length) capabilities[id] = { methods: allowed };
  }
  return capabilities;
}


