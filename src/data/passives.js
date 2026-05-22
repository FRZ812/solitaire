// Item passives — the affix system. High-tier gear carries passive effects; the
// SLOT COUNT scales with item tier and each passive carries its OWN tier (its
// magnitude scales with that). A passive's tier can never exceed its item's, so
// a divine-grade affix only ever rides a divine item. Balance lives here.
//
// Slots by item tier:  Common/Uncommon 0 · Rare/Very-Rare 1 · Epic 2 ·
//                      Legendary/Mythical 3 · Divine 4 (the godlike extra power)
//
// DESIGN (itemisation in the Diablo/DotA vein):
//   - Many small affixes that build an identity, not one dominant stat. Several
//     different affixes map to the SAME underlying stat (e.g. Honed = flat
//     damage, Brutal = % damage) so loadouts mix flavours without stacking one
//     number to the moon.
//   - SNOWBALL stats are curved low and CAPPED in the engine: lifesteal is the
//     classic offender (sustained lifesteal out-DPSing incoming damage makes you
//     unkillable — far worse to fight than a one-shot cheat-death), so it is
//     deliberately modest and the engine clamps TOTAL lifesteal to 25% and total
//     flat damage-reduction to 60%. Dodge and crit-chance are clamped too.
//   - The genuinely GAME-BREAKING affixes (Undying, Worldbreaker, Sunder, …) are
//     gated to LEGENDARY/DIVINE so they read as the reward for slaying the fabled.
//
// Scope: "combat" passives feed the combat engine (stat mods + triggers); "world"
// passives feed exploration (need decay, travel, regen, coin). They apply only
// while equipped AND the item's stat requirement is met (itemRequirement).

import { rollTier, tier as tierInfo } from "./tiers.js";

const o = (tierId) => tierInfo(tierId).order;

// Engine caps for snowball-prone stats (aggregate, applied in combat-stats.js).
export const PASSIVE_CAPS = { lifesteal: 25, drPct: 0.6, thorns: 50 };

// Each passive: scope, type, key (what it modifies), minTier (lowest grade it can
// roll at — gates power), amount(order) → magnitude at that tier, and a category
// for UI grouping. type "stat" → flat add to a combat stat; "trigger" → an
// in-combat reaction; "world" → exploration modifier.
export const PASSIVES = [
  // ---------- OFFENCE (stat) ----------
  { id: "honed",      name: "Honed",        cat: "offence", scope: "combat", type: "stat", key: "damageFlat",  minTier: "common",    amount: (n) => 1 + n,                desc: "Adds flat weapon damage." },
  { id: "brutal",     name: "Brutal",       cat: "offence", scope: "combat", type: "stat", key: "damageMult",  minTier: "uncommon",  amount: (n) => 0.05 + n * 0.025,     desc: "Increases weapon damage by a percentage." },
  { id: "precise",    name: "Precise",      cat: "offence", scope: "combat", type: "stat", key: "accuracy",    minTier: "common",    amount: (n) => 2 + n,                desc: "Improves accuracy." },
  { id: "keen-edge",  name: "Keen Edge",    cat: "offence", scope: "combat", type: "stat", key: "critChance",  minTier: "uncommon",  amount: (n) => 3 + n * 1.5,          desc: "Raises critical chance." },
  { id: "savage",     name: "Savage",       cat: "offence", scope: "combat", type: "stat", key: "critMult",    minTier: "rare",      amount: (n) => 0.1 + n * 0.04,       desc: "Increases critical damage." },
  { id: "piercing",   name: "Piercing",     cat: "offence", scope: "combat", type: "stat", key: "penetration", minTier: "uncommon",  amount: (n) => 1 + n,                desc: "Adds armour penetration." },

  // ---------- DEFENCE (stat) ----------
  { id: "bulwark",    name: "Bulwark",      cat: "defence", scope: "combat", type: "stat", key: "armor",       minTier: "common",    amount: (n) => 1 + n,                desc: "Adds armour (vs physical)." },
  { id: "aegis",      name: "Aegis",        cat: "defence", scope: "combat", type: "stat", key: "ward",        minTier: "common",    amount: (n) => 1 + n,                desc: "Adds ward (vs magic)." },
  { id: "evasion",    name: "Evasion",      cat: "defence", scope: "combat", type: "stat", key: "dodge",       minTier: "common",    amount: (n) => 2 + Math.round(n * 1.5), desc: "Raises dodge chance." },
  { id: "stalwart",   name: "Stalwart",     cat: "defence", scope: "combat", type: "stat", key: "maxHealth",   minTier: "common",    amount: (n) => 3 + n * 2,            desc: "Increases maximum health." },
  { id: "stoneskin",  name: "Stoneskin",    cat: "defence", scope: "combat", type: "stat", key: "drPct",       minTier: "rare",      amount: (n) => 0.03 + n * 0.01,      desc: "Reduces all damage taken by a percentage." },

  // ---------- SUSTAIN (trigger) — tuned low; lifesteal is capped in-engine ----------
  { id: "vampiric",   name: "Vampiric",     cat: "sustain", scope: "combat", type: "trigger", key: "lifesteal", minTier: "rare",     amount: (n) => 3 + n,                desc: "Heals for a small share of damage dealt." },
  { id: "renewing",   name: "Renewing",     cat: "sustain", scope: "combat", type: "trigger", key: "turnRegen", minTier: "epic",     amount: (n) => 1 + Math.floor(n / 2), desc: "Knits a few wounds each turn." },
  { id: "thorned",    name: "Thornmail",    cat: "sustain", scope: "combat", type: "trigger", key: "thorns",    minTier: "rare",      amount: (n) => 6 + n * 3,            desc: "Reflects a share of damage taken." },

  // ---------- RESOURCE (stamina / resolve) ----------
  { id: "tireless",   name: "Tireless",     cat: "resource", scope: "combat", type: "stat", key: "maxStamina", minTier: "uncommon",  amount: (n) => 1 + Math.floor(n / 2), desc: "Increases max stamina." },
  { id: "swift",      name: "Swift",        cat: "resource", scope: "combat", type: "trigger", key: "staminaRegen", minTier: "uncommon", amount: (n) => 1 + Math.floor(n / 2), desc: "Recovers extra stamina each turn." },
  { id: "clearmind",  name: "Clear Mind",   cat: "resource", scope: "combat", type: "trigger", key: "resolveRegen", minTier: "epic",  amount: (n) => 1,                    desc: "Recovers resolve each turn (sustains casting)." },

  // ---------- LEGENDARY+ POWERS — build-defining ----------
  { id: "colossus",   name: "Colossus",     cat: "power", scope: "combat", type: "stat", key: "maxHealth",     minTier: "legendary", amount: (n) => 12 + n * 4,           desc: "Vastly increases maximum health." },
  { id: "echo",       name: "Echo",         cat: "power", scope: "combat", type: "trigger", key: "burst",      minTier: "legendary", amount: (n) => 1 + Math.max(0, n - 5), desc: "Begin each turn with extra stamina." },
  { id: "sunder",     name: "Sundering",    cat: "power", scope: "combat", type: "stat", key: "penetration",   minTier: "legendary", amount: (n) => 4 + n * 2,            desc: "Cleaves through most armour." },
  { id: "bloodthirst",name: "Bloodthirst",  cat: "power", scope: "combat", type: "trigger", key: "lifesteal",  minTier: "legendary", amount: (n) => 6 + n,                desc: "Heals for a large share of damage dealt (capped)." },

  // ---------- DIVINE POWERS — the godlike reward ----------
  { id: "undying",    name: "Undying",      cat: "divine", scope: "combat", type: "trigger", key: "reviveOnce", minTier: "divine",   amount: (n) => 0.5,                  desc: "Once per fight, cheat death at half health." },
  { id: "worldbreaker",name: "Worldbreaker",cat: "divine", scope: "combat", type: "stat", key: "damageMult",   minTier: "divine",    amount: (n) => 0.45,                 desc: "Devastatingly increases all damage." },
  { id: "godward",    name: "Godward",      cat: "divine", scope: "combat", type: "stat", key: "drPct",        minTier: "divine",    amount: (n) => 0.18,                 desc: "Shrugs off a fifth of all damage." },

  // ---------- WORLD (exploration) ----------
  { id: "fleet",      name: "Fleet",        cat: "world", scope: "world", type: "world", key: "travelMult",    minTier: "uncommon",  amount: (n) => 0.06 + n * 0.03,      desc: "Travel takes less time." },
  { id: "fortunate",  name: "Fortunate",    cat: "world", scope: "world", type: "world", key: "coinBonus",     minTier: "uncommon",  amount: (n) => 0.1 + n * 0.06,       desc: "Find more coin on the fallen." },
  { id: "enduring",   name: "Enduring",     cat: "world", scope: "world", type: "world", key: "needDecayMult", minTier: "rare",      amount: (n) => 0.1 + n * 0.04,       desc: "Hunger, thirst, and fatigue set in slower." },
  { id: "mending",    name: "Mending",      cat: "world", scope: "world", type: "world", key: "healPerHour",   minTier: "rare",      amount: (n) => 0.5 + n * 0.5,        desc: "Wounds knit faster out of battle." },
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
  if (def.key === "reviveOnce") return def.name;
  const fracKeys = ["damageMult", "drPct", "travelMult", "needDecayMult", "critMult"]; // stored 0..1
  const pctKeys = ["lifesteal", "thorns", "coinBonus"];                                 // stored as whole %
  if (fracKeys.includes(def.key)) return `${def.name} ${Math.round(v * 100)}%`;
  if (pctKeys.includes(def.key)) return `${def.name} ${Math.round(v)}%`;
  return `${def.name} +${Math.round(v)}`;
}

// Passive slots an item of this tier carries.
export function passiveSlots(itemTierId) {
  const n = o(itemTierId);
  if (n >= 7) return 4;       // divine — the godlike extra power
  if (n >= 5) return 3;       // legendary, mythical
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

// Combine a list of ENABLED {id,tier} passives into combat effects, applying the
// snowball caps so no amount of stacking can run away.
export function aggregateCombatPassives(list) {
  const statMods = {};   // armor/ward/dodge/accuracy/penetration/critChance/critMult/maxStamina/damageFlat/damageMult/maxHealth/drPct
  const triggers = {};   // lifesteal/thorns/staminaRegen/resolveRegen/turnRegen/burst/reviveOnce
  for (const { id, tier } of (list || [])) {
    const def = BY_ID[id];
    if (!def || def.scope !== "combat") continue;
    const v = def.amount(o(tier));
    if (def.type === "stat") statMods[def.key] = (statMods[def.key] || 0) + v;
    else if (def.type === "trigger") triggers[def.key] = (triggers[def.key] || 0) + v;
  }
  if (statMods.drPct != null) statMods.drPct = Math.min(statMods.drPct, PASSIVE_CAPS.drPct);
  if (triggers.lifesteal != null) triggers.lifesteal = Math.min(triggers.lifesteal, PASSIVE_CAPS.lifesteal);
  if (triggers.thorns != null) triggers.thorns = Math.min(triggers.thorns, PASSIVE_CAPS.thorns);
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
