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
// extraActions/shieldGen/etc. are the build-defining tempo & defensive stats, so
// they are clamped just as hard as lifesteal — a swift build tops out at +3 extra
// action points (4 total), a shield build at a fixed per-turn absorb, etc.
export const PASSIVE_CAPS = {
  lifesteal: 25, drPct: 0.6, thorns: 50,
  extraActions: 3, cooldownReduction: 3, fortify: 0.25,
  shieldGen: 12, magicShieldGen: 12, invulnCharges: 2,
};

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

  // ---------- TEMPO (action economy) — the swift build, capped at +3 ----------
  // extraActions grants generic ACTION POINTS the bearer spends on anything; with
  // enough stamina a swift build acts several times a turn (ToW Wandering Blade).
  { id: "quickened",  name: "Quickened",    cat: "tempo", scope: "combat", type: "stat",    key: "extraActions",      minTier: "epic",      amount: () => 1,                     desc: "Grants an extra action each turn." },
  { id: "nimble",     name: "Nimble",       cat: "tempo", scope: "combat", type: "stat",    key: "extraActions",      minTier: "legendary", amount: (n) => 1 + (n >= 7 ? 1 : 0), desc: "Grants extra actions each turn (two at divine grade)." },
  { id: "efficient",  name: "Efficient",    cat: "tempo", scope: "combat", type: "stat",    key: "cooldownReduction", minTier: "epic",      amount: () => 1,                     desc: "Ability cooldowns recover faster." },
  { id: "flurry",     name: "Flurry",       cat: "tempo", scope: "combat", type: "proc",    hook: "onHit", apply: { kind: "bonusHit" },                       chance: 0.3, minTier: "legendary", amount: (n) => 3 + n,        desc: "Chance on hit to land a bonus strike." },

  // ---------- OFFENCE / DoT (proc) — bleed, poison, burn, execute, ramp ----------
  { id: "serrated",   name: "Serrated",     cat: "offence", scope: "combat", type: "proc",  hook: "onHit", apply: { kind: "status", status: "bleed", duration: 2 }, chance: 0.5, minTier: "uncommon", amount: (n) => 1 + Math.floor(n / 2), desc: "Chance on hit to cause bleeding." },
  { id: "lacerate",   name: "Lacerate",     cat: "offence", scope: "combat", type: "proc",  hook: "onCrit", apply: { kind: "status", status: "bleed", duration: 3 }, chance: 1, minTier: "rare", amount: (n) => 2 + n, desc: "Critical hits cause heavy bleeding." },
  { id: "venomous",   name: "Venomous",     cat: "offence", scope: "combat", type: "proc",  hook: "onHit", apply: { kind: "status", status: "poison", duration: 3 }, chance: 0.4, minTier: "uncommon", amount: (n) => 1 + Math.floor(n / 2), desc: "Chance on hit to poison." },
  { id: "incendiary", name: "Incendiary",   cat: "offence", scope: "combat", type: "proc",  hook: "onHit", apply: { kind: "status", status: "burn", duration: 2 }, chance: 0.4, minTier: "rare", amount: (n) => 2 + n, desc: "Chance on hit to set ablaze (burn)." },
  { id: "executioner",name: "Executioner",  cat: "offence", scope: "combat", type: "proc",  hook: "onHit", apply: { kind: "execute" }, cond: "targetLow", chance: 1, minTier: "epic", amount: (n) => 3 + n * 2, desc: "Deals bonus damage to badly wounded foes." },
  { id: "rampage",    name: "Rampage",      cat: "offence", scope: "combat", type: "proc",  hook: "turnRamp", apply: { kind: "buff", status: "rally", duration: 2 }, chance: 1, minTier: "epic", amount: (n) => 3 + n, desc: "Builds momentum (rally) each turn." },
  { id: "bloodhunt",  name: "Bloodhunt",    cat: "power", scope: "combat", type: "proc",    hook: "onKill", apply: { kind: "refund", stamina: true, action: true }, chance: 1, minTier: "legendary", amount: (n) => 2 + Math.floor(n / 2), desc: "Killing a foe refunds stamina and an action." },

  // ---------- CONTROL (proc) — chill, curse, stun ----------
  { id: "frostbrand", name: "Frostbrand",   cat: "control", scope: "combat", type: "proc",  hook: "onHit", apply: { kind: "status", status: "chill", duration: 2 }, chance: 0.4, minTier: "rare", amount: (n) => 2 + n, desc: "Chance on hit to chill (saps accuracy)." },
  { id: "cursed",     name: "Cursed",       cat: "control", scope: "combat", type: "proc",  hook: "onHit", apply: { kind: "status", status: "curse", duration: 2 }, chance: 0.3, minTier: "rare", amount: (n) => 5 + n * 2, desc: "Chance on hit to curse (amplifies damage taken)." },
  { id: "concussive", name: "Concussive",   cat: "control", scope: "combat", type: "proc",  hook: "onCrit", apply: { kind: "status", status: "stun", duration: 1 }, chance: 0.5, minTier: "epic", amount: () => 1, desc: "Critical hits may stun." },

  // ---------- DEFENCE (shields, ward-shields, fortify, evasion, invuln) ----------
  { id: "barrier",    name: "Barrier",      cat: "defence", scope: "combat", type: "trigger", key: "shieldGen",      minTier: "rare",      amount: (n) => 3 + n,                desc: "Regenerates a physical shield each turn." },
  { id: "wardstone",  name: "Wardstone",    cat: "defence", scope: "combat", type: "trigger", key: "magicShieldGen", minTier: "rare",      amount: (n) => 3 + n,                desc: "Regenerates a magic ward-shield each turn." },
  { id: "bastion",    name: "Bastion",      cat: "defence", scope: "combat", type: "stat",    key: "fortify",        minTier: "epic",      amount: (n) => 0.05 + n * 0.02,      desc: "Reduces damage sharply while badly wounded." },
  { id: "evasive",    name: "Evasive",      cat: "defence", scope: "combat", type: "proc",    hook: "onDodge", apply: { kind: "buff", status: "dodgeStack", duration: 2 }, chance: 1, minTier: "rare", amount: (n) => 3 + n, desc: "Each dodge stacks more dodge (snowballing evasion)." },
  { id: "lifeward",   name: "Lifeward",     cat: "defence", scope: "combat", type: "proc",    hook: "lowHealth", apply: { kind: "shield" }, threshold: 0.35, chance: 1, minTier: "epic", amount: (n) => 8 + n * 3, desc: "Bursts a shield when badly wounded (once per fight)." },
  { id: "aegis-eternal", name: "Aegis Eternal", cat: "divine", scope: "combat", type: "trigger", key: "invulnCharges", minTier: "divine", amount: () => 1, desc: "When near death, becomes briefly invulnerable (limited charges)." },

  // ---------- FUSION-ONLY (forged, never rolled) — see FUSIONS below ----------
  { id: "rupture",    name: "Rupture",      cat: "fusion", scope: "combat", type: "proc", noRoll: true, hook: "onHit", apply: { kind: "status", status: "bleed", duration: 3 }, chance: 1, minTier: "epic", amount: (n) => 4 + n * 2, desc: "FUSION: every hit ruptures flesh — guaranteed heavy bleed." },
  { id: "stormrend",  name: "Stormrend",    cat: "fusion", scope: "combat", type: "proc", noRoll: true, hook: "onCrit", apply: { kind: "status", status: "stun", duration: 1 }, chance: 1, minTier: "epic", amount: () => 1, desc: "FUSION: every critical hit stuns." },
  { id: "soulflame",  name: "Soulflame",    cat: "fusion", scope: "combat", type: "proc", noRoll: true, hook: "onHit", apply: { kind: "status", status: "burn", duration: 3 }, chance: 1, minTier: "epic", amount: (n) => 3 + n * 2, desc: "FUSION: cursed flame — every hit burns and the burn bites deep." },
  { id: "phalanx",    name: "Phalanx",      cat: "fusion", scope: "combat", type: "trigger", noRoll: true, key: "shieldGen", minTier: "epic", amount: (n) => 6 + n * 2, desc: "FUSION: an ever-renewing bulwark of overlapping shields." },
  { id: "revenant",   name: "Revenant",     cat: "fusion", scope: "combat", type: "proc", noRoll: true, hook: "onKill", apply: { kind: "refund", stamina: true, action: true, heal: true }, chance: 1, minTier: "legendary", amount: (n) => 3 + n, desc: "FUSION: every kill restores stamina, an action, and health." },

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
  if (def.type === "proc") return def.name; // proc magnitude is contextual — name carries it
  if (def.key === "reviveOnce") return def.name;
  const fracKeys = ["damageMult", "drPct", "travelMult", "needDecayMult", "critMult", "fortify"]; // stored 0..1
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
      !p.noRoll &&                              // fusion-only affixes never drop as loot
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
  const statMods = {};   // armor/ward/dodge/accuracy/penetration/critChance/critMult/maxStamina/damageFlat/damageMult/maxHealth/drPct/extraActions/cooldownReduction/fortify
  const triggers = {};   // lifesteal/thorns/staminaRegen/resolveRegen/turnRegen/burst/reviveOnce/shieldGen/magicShieldGen/invulnCharges
  const procs = [];      // {hook, kind, status?, duration?, value, chance, cond?, threshold?, name} — fired by the engine
  for (const { id, tier } of (list || [])) {
    const def = BY_ID[id];
    if (!def || def.scope !== "combat") continue;
    const v = def.amount(o(tier));
    if (def.type === "stat") statMods[def.key] = (statMods[def.key] || 0) + v;
    else if (def.type === "trigger") triggers[def.key] = (triggers[def.key] || 0) + v;
    else if (def.type === "proc") {
      procs.push({ hook: def.hook, ...def.apply, value: v, chance: def.chance ?? 1, cond: def.cond, threshold: def.threshold, name: def.name });
    }
  }
  // Snowball caps — no amount of stacking runs away.
  if (statMods.drPct != null) statMods.drPct = Math.min(statMods.drPct, PASSIVE_CAPS.drPct);
  if (statMods.extraActions != null) statMods.extraActions = Math.min(statMods.extraActions, PASSIVE_CAPS.extraActions);
  if (statMods.cooldownReduction != null) statMods.cooldownReduction = Math.min(statMods.cooldownReduction, PASSIVE_CAPS.cooldownReduction);
  if (statMods.fortify != null) statMods.fortify = Math.min(statMods.fortify, PASSIVE_CAPS.fortify);
  if (triggers.lifesteal != null) triggers.lifesteal = Math.min(triggers.lifesteal, PASSIVE_CAPS.lifesteal);
  if (triggers.thorns != null) triggers.thorns = Math.min(triggers.thorns, PASSIVE_CAPS.thorns);
  if (triggers.shieldGen != null) triggers.shieldGen = Math.min(triggers.shieldGen, PASSIVE_CAPS.shieldGen);
  if (triggers.magicShieldGen != null) triggers.magicShieldGen = Math.min(triggers.magicShieldGen, PASSIVE_CAPS.magicShieldGen);
  if (triggers.invulnCharges != null) triggers.invulnCharges = Math.min(triggers.invulnCharges, PASSIVE_CAPS.invulnCharges);
  if (procs.length) triggers.procs = procs;
  return { statMods, triggers };
}

// ---------------------------------------------------------------------------
// FUSION (ToW Fusion Traits): two specific affixes + a Rune are forged into one
// signature power. The two components are consumed and replaced by the fused
// affix (a noRoll PASSIVE), inheriting the higher of the two component tiers.
// Recipes are an explicit, bounded, hand-authored list.
// ---------------------------------------------------------------------------
export const RUNES = {
  "rune-of-rupture": { id: "rune-of-rupture", name: "Rune of Rupture", kind: "material", value: 400, appearance: "A jagged blood-red sigil-stone, warm to the touch.", description: "A forge-rune. Fuses two affixes into a signature power." },
  "rune-of-storms":  { id: "rune-of-storms",  name: "Rune of Storms",  kind: "material", value: 400, appearance: "A slate disc veined with stilled lightning.", description: "A forge-rune. Fuses two affixes into a signature power." },
  "rune-of-flame":   { id: "rune-of-flame",   name: "Rune of Flame",   kind: "material", value: 400, appearance: "An ember-cored rune that never quite cools.", description: "A forge-rune. Fuses two affixes into a signature power." },
  "rune-of-aegis":   { id: "rune-of-aegis",   name: "Rune of Aegis",   kind: "material", value: 400, appearance: "A pale shield-graven stone, cold and steady.", description: "A forge-rune. Fuses two affixes into a signature power." },
  "rune-of-souls":   { id: "rune-of-souls",   name: "Rune of Souls",   kind: "material", value: 600, appearance: "A black rune that drinks the light around it.", description: "A forge-rune. Fuses two affixes into a signature power." },
};

export const FUSIONS = [
  { id: "fuse-rupture",  a: "serrated",   b: "savage",     rune: "rune-of-rupture", result: "rupture",   minTier: "epic" },
  { id: "fuse-stormrend",a: "keen-edge",  b: "concussive", rune: "rune-of-storms",  result: "stormrend", minTier: "epic" },
  { id: "fuse-soulflame",a: "incendiary", b: "cursed",     rune: "rune-of-flame",   result: "soulflame", minTier: "epic" },
  { id: "fuse-phalanx",  a: "barrier",    b: "bulwark",    rune: "rune-of-aegis",   result: "phalanx",   minTier: "epic" },
  { id: "fuse-revenant", a: "bloodthirst",b: "bloodhunt",  rune: "rune-of-souls",   result: "revenant",  minTier: "legendary" },
];

const hasAffix = (list, id) => (list || []).some((p) => p.id === id);
const affixTier = (list, id) => (list || []).find((p) => p.id === id)?.tier || "common";

// Fusion recipes whose BOTH components are present on this item's passive list.
export function availableFusions(passiveList) {
  return FUSIONS.filter((f) => hasAffix(passiveList, f.a) && hasAffix(passiveList, f.b));
}

// Forge a fusion: remove the two components, add the fused affix at the higher of
// their two tiers (but not below the recipe's minTier). Returns a NEW list.
export function applyFusion(passiveList, recipe) {
  if (!recipe || !hasAffix(passiveList, recipe.a) || !hasAffix(passiveList, recipe.b)) return passiveList;
  const tA = affixTier(passiveList, recipe.a), tB = affixTier(passiveList, recipe.b);
  let tier = o(tA) >= o(tB) ? tA : tB;
  if (o(tier) < o(recipe.minTier)) tier = recipe.minTier;
  const kept = passiveList.filter((p) => p.id !== recipe.a && p.id !== recipe.b);
  kept.push({ id: recipe.result, tier });
  return kept;
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
