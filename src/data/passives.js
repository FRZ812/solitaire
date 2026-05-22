// Item passives. High-tier gear carries passive effects; the SLOT COUNT is set
// by item tier and each passive carries its OWN tier (magnitude scales with it).
// A passive's tier can never exceed its item's tier, so e.g. a divine-grade
// passive only ever appears on a divine item. Balance lives here (single source).
//
// Slots by item tier:  Common/Uncommon 0 · Rare 1 · Epic 2 · Legendary+ 3
//
// Scope: "combat" passives feed the combat engine (stat mods + triggers);
// "world" passives feed the exploration loop (need decay, travel, regen, coin).
// They only apply while the item is equipped AND its stat requirement is met
// (see itemRequirement in combat-stats.js) — under-req gear keeps reduced base
// stats but its passives switch off.

import { rollTier, tier as tierInfo } from "./tiers.js";

const o = (tierId) => tierInfo(tierId).order;

// Each passive: scope, type, key (what it modifies), minTier (lowest tier it can
// roll at — gates power), and amount(order) → magnitude at that tier.
export const PASSIVES = [
  // --- combat: flat stat mods ---
  { id: "bulwark",   name: "Bulwark",    scope: "combat", type: "stat", key: "armor",      minTier: "common",   amount: (n) => 1 + n,            desc: "Adds armour." },
  { id: "aegis",     name: "Aegis",      scope: "combat", type: "stat", key: "ward",       minTier: "common",   amount: (n) => 1 + n,            desc: "Adds ward against magic." },
  { id: "evasion",   name: "Evasion",    scope: "combat", type: "stat", key: "dodge",      minTier: "common",   amount: (n) => 2 + n * 2,        desc: "Raises dodge chance." },
  { id: "precise",   name: "Precise",    scope: "combat", type: "stat", key: "accuracy",   minTier: "common",   amount: (n) => 2 + n,            desc: "Improves accuracy." },
  { id: "piercing",  name: "Piercing",   scope: "combat", type: "stat", key: "penetration",minTier: "uncommon", amount: (n) => 1 + n,            desc: "Adds armour penetration." },
  { id: "keen-edge", name: "Keen Edge",  scope: "combat", type: "stat", key: "critChance", minTier: "uncommon", amount: (n) => 3 + n * 2,        desc: "Raises critical chance." },
  { id: "tireless",  name: "Tireless",   scope: "combat", type: "stat", key: "maxStamina", minTier: "uncommon", amount: (n) => 1 + Math.floor(n / 2), desc: "Increases max stamina." },
  { id: "savage",    name: "Savage",     scope: "combat", type: "stat", key: "critMult",   minTier: "rare",     amount: (n) => 0.1 + n * 0.05,   desc: "Increases critical damage." },
  // --- combat: triggers ---
  { id: "vampiric",  name: "Vampiric",   scope: "combat", type: "trigger", key: "lifesteal",   minTier: "rare",      amount: (n) => 6 + n * 3,  desc: "Heals for a share of damage dealt." },
  { id: "thorned",   name: "Thornmail",  scope: "combat", type: "trigger", key: "thorns",      minTier: "rare",      amount: (n) => 8 + n * 4,  desc: "Reflects a share of damage taken." },
  { id: "swift",     name: "Swift",      scope: "combat", type: "trigger", key: "staminaRegen", minTier: "uncommon", amount: (n) => 1 + Math.floor(n / 2), desc: "Recovers extra stamina each turn." },
  { id: "clearmind", name: "Clear Mind", scope: "combat", type: "trigger", key: "resolveRegen", minTier: "epic",     amount: (n) => 1,          desc: "Recovers resolve each turn (sustains casting)." },
  { id: "mending-ward", name: "Mending Ward", scope: "combat", type: "trigger", key: "turnRegen", minTier: "epic",   amount: (n) => 2 + n,      desc: "Knits wounds each turn in battle." },
  { id: "echo",      name: "Echo",       scope: "combat", type: "trigger", key: "burst",        minTier: "legendary", amount: (n) => 1 + (n - 5), desc: "Begin each turn with extra stamina." },
  { id: "undying",   name: "Undying",    scope: "combat", type: "trigger", key: "reviveOnce",   minTier: "divine",    amount: (n) => 0.5,         desc: "Once per fight, cheat death at half health." },
  // --- world ---
  { id: "fleet",     name: "Fleet",      scope: "world", type: "world", key: "travelMult",   minTier: "uncommon", amount: (n) => 0.06 + n * 0.03, desc: "Travel takes less time." },
  { id: "fortunate", name: "Fortunate",  scope: "world", type: "world", key: "coinBonus",    minTier: "uncommon", amount: (n) => 0.1 + n * 0.06,  desc: "Find more coin on the fallen." },
  { id: "enduring",  name: "Enduring",   scope: "world", type: "world", key: "needDecayMult", minTier: "rare",    amount: (n) => 0.1 + n * 0.04,  desc: "Hunger, thirst, and fatigue set in slower." },
  { id: "mending",   name: "Mending",    scope: "world", type: "world", key: "healPerHour",  minTier: "rare",     amount: (n) => 0.5 + n * 0.5,   desc: "Wounds knit faster out of battle." },
];

const BY_ID = Object.fromEntries(PASSIVES.map((p) => [p.id, p]));
export function passiveDef(id) { return BY_ID[id] || null; }

// Magnitude of a passive instance at a given tier.
export function passiveMagnitude(id, tierId) {
  const def = BY_ID[id];
  if (!def) return 0;
  return def.amount(o(tierId));
}

// Human-readable "Name +N" / "Name 12%" label for UI.
export function passiveLabel(id, tierId) {
  const def = BY_ID[id];
  if (!def) return "";
  const v = def.amount(o(tierId));
  const pctKeys = ["lifesteal", "thorns", "coinBonus", "travelMult", "needDecayMult", "critChance", "dodge"];
  if (def.key === "critMult") return `${def.name} +${Math.round(v * 100)}%`;
  if (pctKeys.includes(def.key)) {
    const pct = def.key === "travelMult" || def.key === "needDecayMult" ? Math.round(v * 100) : Math.round(v);
    return `${def.name} ${pct}%`;
  }
  return `${def.name} +${Math.round(v)}`;
}

// Passive slots an item of this tier carries.
export function passiveSlots(itemTierId) {
  const n = o(itemTierId);
  if (n >= 5) return 3;       // legendary, mythical, divine
  if (n >= 4) return 2;       // epic
  if (n >= 2) return 1;       // rare, very-rare
  return 0;                   // common, uncommon
}

// Roll an item's passives: one per slot, each at a tier ≤ the item's tier
// (weighted toward lower), no duplicates. Optional scopeFilter limits the pool.
export function rollItemPassives(itemTierId, { luck = 0, scopeFilter = null } = {}) {
  const slots = passiveSlots(itemTierId);
  const out = [];
  const used = new Set();
  for (let i = 0; i < slots; i++) {
    const rolledTier = rollTier(itemTierId, luck);
    const pool = PASSIVES.filter((p) =>
      !used.has(p.id) &&
      o(p.minTier) <= o(rolledTier) &&
      (!scopeFilter || p.scope === scopeFilter));
    if (pool.length === 0) continue;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    used.add(pick.id);
    out.push({ id: pick.id, tier: rolledTier });
  }
  return out;
}

// Combine a list of ENABLED {id,tier} passives into combat effects.
export function aggregateCombatPassives(list) {
  const statMods = {};   // armor/ward/dodge/accuracy/penetration/critChance/critMult/maxStamina
  const triggers = {};   // lifesteal/thorns/staminaRegen/resolveRegen/turnRegen/burst/reviveOnce
  for (const { id, tier } of (list || [])) {
    const def = BY_ID[id];
    if (!def || def.scope !== "combat") continue;
    const v = def.amount(o(tier));
    if (def.type === "stat") statMods[def.key] = (statMods[def.key] || 0) + v;
    else if (def.type === "trigger") triggers[def.key] = (triggers[def.key] || 0) + v;
  }
  return { statMods, triggers };
}

// Combine ENABLED world passives into exploration modifiers.
export function aggregateWorldPassives(list) {
  const out = { travelMult: 0, coinBonus: 0, needDecayMult: 0, healPerHour: 0 };
  for (const { id, tier } of (list || [])) {
    const def = BY_ID[id];
    if (!def || def.scope !== "world") continue;
    out[def.key] = (out[def.key] || 0) + def.amount(o(tier));
  }
  return out;
}
