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

import { TIERS, rollTier, tier as tierInfo } from "./tiers.js";
import { ATTR_KEYS, ATTR_LABELS } from "../config.js";

const o = (tierId) => tierInfo(tierId).order;

// "When Body ≥ 12" suffix for threshold (attrReq) passives, for the codex/labels.
function reqText(def) {
  const r = def && def.attrReq;
  if (!r) return "";
  const label = r.key === "highest" ? "highest attribute" : (ATTR_LABELS[r.key] || r.key);
  return ` (when ${label} ≥ ${r.min})`;
}

// Flat "power" affixes (raw health, flat damage, flat armour/pen) must track the
// GEOMETRIC tier curve, not grow linearly with tier order — otherwise they go
// dead at high grade while % affixes keep pace. geo(base, n) scales a base value
// by the tier's power multiplier (common ×1 → divine ×12).
const MULT_BY_ORDER = TIERS.map((t) => t.mult);
const geo = (base, n) => Math.round(base * MULT_BY_ORDER[n]);

// Engine caps for snowball-prone stats (aggregate, applied in combat-stats.js).
// extraActions/shieldGen/etc. are the build-defining tempo & defensive stats, so
// they are clamped just as hard as lifesteal — a swift build tops out at +3 extra
// action points (4 total), a shield build at a fixed per-turn absorb, etc.
// turnRegen / shieldGen / magicShieldGen are FRACTIONS of max health per turn
// (the engine multiplies by the wearer's maxHealth), so they scale at every tier
// instead of going dead at high grade. Their caps are fractions too.
export const PASSIVE_CAPS = {
  // Lifesteal can reach 100% (you can build a true sustain monster) — it's kept in
  // check by anti-heal (curse halves healing), armour/DR shrinking the damage it's
  // a share of, and bosses that out-burst or true-strike faster than you can drink.
  lifesteal: 100, drPct: 0.85, thorns: 50,
  extraActions: 3, cooldownReduction: 3, fortify: 0.25,
  turnRegen: 0.12, shieldGen: 0.12, magicShieldGen: 0.12, invulnCharges: 2,
  controlResist: 0.6, healPower: 1.0, dmgDefer: 0.6,
};

// Each passive: scope, type, key (what it modifies), minTier (lowest grade it can
// roll at — gates power), amount(order) → magnitude at that tier, and a category
// for UI grouping. type "stat" → flat add to a combat stat; "trigger" → an
// in-combat reaction; "world" → exploration modifier.
export const PASSIVES = [
  // ---------- OFFENCE (stat) ----------
  { id: "honed",      name: "Honed",        cat: "offence", scope: "combat", type: "stat", key: "damageFlat",  minTier: "common",    amount: (n) => geo(1.5, n),          desc: "Adds flat weapon damage (scales with grade)." },
  { id: "brutal",     name: "Brutal",       cat: "offence", scope: "combat", type: "stat", key: "damageMult",  minTier: "uncommon",  amount: (n) => 0.05 + n * 0.025,     desc: "Increases weapon damage by a percentage." },
  { id: "precise",    name: "Precise",      cat: "offence", scope: "combat", type: "stat", key: "accuracy",    minTier: "common",    amount: (n) => 2 + n,                desc: "Improves accuracy." },
  { id: "keen-edge",  name: "Keen Edge",    cat: "offence", scope: "combat", type: "stat", key: "critChance",  minTier: "uncommon",  amount: (n) => 3 + n * 1.5,          desc: "Raises critical chance." },
  { id: "savage",     name: "Savage",       cat: "offence", scope: "combat", type: "stat", key: "critMult",    minTier: "rare",      amount: (n) => 0.1 + n * 0.04,       desc: "Increases critical damage." },
  { id: "piercing",   name: "Piercing",     cat: "offence", scope: "combat", type: "stat", key: "penetration", minTier: "uncommon",  amount: (n) => geo(1.2, n),          desc: "Adds armour penetration (scales with grade)." },

  // ---------- DEFENCE (stat) ----------
  { id: "bulwark",    name: "Bulwark",      cat: "defence", scope: "combat", type: "stat", key: "armor",       minTier: "common",    amount: (n) => geo(1.2, n),          desc: "Adds armour (vs physical), scaling with grade." },
  { id: "aegis",      name: "Aegis",        cat: "defence", scope: "combat", type: "stat", key: "ward",        minTier: "common",    amount: (n) => geo(1.2, n),          desc: "Adds ward (vs magic), scaling with grade." },
  { id: "evasion",    name: "Evasion",      cat: "defence", scope: "combat", type: "stat", key: "dodge",       minTier: "common",    amount: (n) => 2 + Math.round(n * 1.5), desc: "Raises dodge chance." },
  { id: "stalwart",   name: "Stalwart",     cat: "defence", scope: "combat", type: "stat", key: "maxHealth",   minTier: "common",    amount: (n) => geo(12, n),           desc: "Increases maximum health (scales with grade)." },
  { id: "stoneskin",  name: "Stoneskin",    cat: "defence", scope: "combat", type: "stat", key: "drPct",       minTier: "rare",      amount: (n) => 0.03 + n * 0.01,      desc: "Reduces all damage taken by a percentage." },
  { id: "defiance",   name: "Defiance",     cat: "defence", scope: "combat", type: "stat", key: "dmgDefer",    minTier: "epic",      amount: (n) => 0.12 + n * 0.04,      desc: "A share of every blow is held back and bleeds out over a few turns instead of landing at once — burst becomes a wound you can heal through." },

  // ---------- SUSTAIN (trigger) — tuned low; lifesteal is capped in-engine ----------
  { id: "vampiric",   name: "Vampiric",     cat: "sustain", scope: "combat", type: "trigger", key: "lifesteal", minTier: "rare",     amount: (n) => 3 + n,                desc: "Heals for a small share of damage dealt." },
  { id: "renewing",   name: "Renewing",     cat: "sustain", scope: "combat", type: "trigger", key: "turnRegen", minTier: "epic",     amount: (n) => 0.04 + n * 0.008, desc: "Knits a share of your wounds each turn — scales with your vitality." },
  { id: "benediction",name: "Benediction",  cat: "sustain", scope: "combat", type: "stat",    key: "healPower", minTier: "rare",     amount: (n) => 0.10 + n * 0.04,      desc: "Amplifies ALL healing you receive — regen, lifesteal, and mended wounds all hit harder." },

  // ---------- RESOURCE / TEMPO (resolve, initiative, action economy) ----------
  { id: "tireless",   name: "Fleet-Footed", cat: "tempo", scope: "combat", type: "stat", key: "speed",       minTier: "uncommon",  amount: (n) => 1 + Math.floor(n / 2), desc: "Acts sooner — raises initiative." },
  { id: "swift",      name: "Swift",        cat: "tempo", scope: "combat", type: "stat", key: "swiftChance", minTier: "uncommon",  amount: (n) => 0.05 + n * 0.02,      desc: "Chance each turn to act again." },
  { id: "clearmind",  name: "Clear Mind",   cat: "resource", scope: "combat", type: "trigger", key: "resolveRegen", minTier: "epic",  amount: (n) => 1,                    desc: "Recovers resolve each turn (sustains casting)." },

  // ---------- LEGENDARY+ POWERS — build-defining ----------
  { id: "colossus",   name: "Colossus",     cat: "power", scope: "combat", type: "stat", key: "maxHealth",     minTier: "legendary", amount: (n) => geo(40, n),           desc: "Vastly increases maximum health." },
  { id: "sunder",     name: "Sundering",    cat: "power", scope: "combat", type: "stat", key: "penetration",   minTier: "legendary", amount: (n) => geo(2.7, n),          desc: "Cleaves through most armour (scales with grade)." },
  { id: "bloodthirst",name: "Bloodthirst",  cat: "power", scope: "combat", type: "trigger", key: "lifesteal",  minTier: "legendary", amount: (n) => 6 + n,                desc: "Heals for a large share of damage dealt (capped)." },

  // ---------- DIVINE POWERS — the godlike reward ----------
  { id: "undying",    name: "Undying",      cat: "divine", scope: "combat", type: "trigger", key: "reviveOnce", minTier: "divine",   amount: (n) => 0.5,                  desc: "Once per fight, cheat death at half health." },
  { id: "worldbreaker",name: "Worldbreaker",cat: "divine", scope: "combat", type: "stat", key: "damageMult",   minTier: "divine",    amount: (n) => 0.45,                 desc: "Devastatingly increases all damage." },
  { id: "godward",    name: "Godward",      cat: "divine", scope: "combat", type: "stat", key: "drPct",        minTier: "divine",    amount: (n) => 0.18,                 desc: "Shrugs off a fifth of all damage." },
  // Playstyle-anchor divine affixes — each makes a divine piece serve one build.
  { id: "tempest",    name: "Tempest",      cat: "divine", scope: "combat", type: "stat", key: "swiftChance",  minTier: "divine",    amount: (n) => 0.25,                 desc: "A blur of motion — great chance to act again." },
  { id: "deadeye",    name: "Deadeye",      cat: "divine", scope: "combat", type: "stat", key: "accuracy",     minTier: "divine",    amount: (n) => 30,                   desc: "Every shot finds the mark — overwhelming accuracy, dodge be damned." },
  { id: "archmage",   name: "Archmage",     cat: "divine", scope: "combat", type: "trigger", key: "resolveRegen", minTier: "divine",  amount: (n) => 3,                    desc: "Bottomless will — restores great resolve each turn." },
  { id: "phantom",    name: "Phantom",      cat: "divine", scope: "combat", type: "stat", key: "dodge",        minTier: "divine",    amount: (n) => 28,                   desc: "Half-real — devastating evasion." },
  { id: "juggernaut", name: "Juggernaut",   cat: "divine", scope: "combat", type: "stat", key: "maxHealth",    minTier: "divine",    amount: () => geo(60, 7),            desc: "A mountain of vitality." },

  // ---------- PARAGON — threshold affixes that only wake for the truly gifted ----------
  // Distinct from the gentle per-point attribute scaling: a strong, build-defining
  // bonus that lies DORMANT until the wearer's attribute crosses a high bar (≥12),
  // rewarding deep investment in a single attribute on top of high-tier gear.
  { id: "titans-might",    name: "Titan's Might",    cat: "paragon", scope: "combat", type: "stat", key: "damageMult",        minTier: "epic", attrReq: { key: "body", min: 12 },   amount: (n) => 0.12 + n * 0.02, desc: "Raw, mountain-moving power — for the truly mighty alone." },
  { id: "quicksilver",     name: "Quicksilver",      cat: "paragon", scope: "combat", type: "stat", key: "swiftChance",       minTier: "epic", attrReq: { key: "reflex", min: 12 }, amount: (n) => 0.10 + n * 0.02, desc: "Preternatural speed — extra strikes slip in for the impossibly quick." },
  { id: "adamant",         name: "Adamant",          cat: "paragon", scope: "combat", type: "stat", key: "drPct",             minTier: "epic", attrReq: { key: "vigor", min: 12 },  amount: (n) => 0.06 + n * 0.012, desc: "An unbreakable body shrugs off what would fell another." },
  { id: "grand-strategist",name: "Grand Strategist", cat: "paragon", scope: "combat", type: "stat", key: "cooldownReduction", minTier: "epic", attrReq: { key: "mind", min: 12 },   amount: () => 1,                desc: "A brilliant mind reads the fight and recovers its tricks faster." },
  { id: "hawkeye",         name: "Hawkeye",          cat: "paragon", scope: "combat", type: "stat", key: "critChance",        minTier: "epic", attrReq: { key: "wit", min: 12 },    amount: (n) => 8 + n * 2,       desc: "Uncanny perception finds the gap in any guard." },

  // ---------- TEMPO (action economy) — the swift build, capped at +3 ----------
  // extraActions grants generic ACTION POINTS the bearer spends on anything; with
  // enough action points a swift build acts several times a turn (ToW Wandering Blade).
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
  { id: "bloodhunt",  name: "Bloodhunt",    cat: "power", scope: "combat", type: "proc",    hook: "onKill", apply: { kind: "refund", resolve: true, action: true }, chance: 1, minTier: "legendary", amount: (n) => 2 + Math.floor(n / 2), desc: "Killing a foe refunds resolve and an action." },

  // ---------- CONTROL (proc) — chill, curse, stun ----------
  { id: "frostbrand", name: "Frostbrand",   cat: "control", scope: "combat", type: "proc",  hook: "onHit", apply: { kind: "status", status: "chill", duration: 2 }, chance: 0.4, minTier: "rare", amount: (n) => 2 + n, desc: "Chance on hit to chill (saps accuracy)." },
  { id: "cursed",     name: "Cursed",       cat: "control", scope: "combat", type: "proc",  hook: "onHit", apply: { kind: "status", status: "curse", duration: 2 }, chance: 0.3, minTier: "rare", amount: (n) => 5 + n * 2, desc: "Chance on hit to curse (amplifies damage taken)." },
  { id: "concussive", name: "Concussive",   cat: "control", scope: "combat", type: "proc",  hook: "onCrit", apply: { kind: "status", status: "stun", duration: 1 }, chance: 0.5, minTier: "epic", amount: () => 1, desc: "Critical hits may stun." },

  // ---------- DEFENCE (shields, ward-shields, fortify, evasion, invuln) ----------
  { id: "barrier",    name: "Barrier",      cat: "defence", scope: "combat", type: "trigger", key: "shieldGen",      minTier: "rare",      amount: (n) => 0.03 + n * 0.006,     desc: "Regenerates a physical shield each turn, sized to your vitality." },
  { id: "wardstone",  name: "Wardstone",    cat: "defence", scope: "combat", type: "trigger", key: "magicShieldGen", minTier: "rare",      amount: (n) => 0.03 + n * 0.006,     desc: "Regenerates a magic ward-shield each turn, sized to your vitality." },
  { id: "bastion",    name: "Bastion",      cat: "defence", scope: "combat", type: "stat",    key: "fortify",        minTier: "epic",      amount: (n) => 0.05 + n * 0.02,      desc: "Reduces damage sharply while badly wounded." },
  { id: "evasive",    name: "Evasive",      cat: "defence", scope: "combat", type: "proc",    hook: "onDodge", apply: { kind: "buff", status: "dodgeStack", duration: 2 }, chance: 1, minTier: "rare", amount: (n) => 3 + n, desc: "Each dodge stacks more dodge (snowballing evasion)." },
  { id: "lifeward",   name: "Lifeward",     cat: "defence", scope: "combat", type: "proc",    hook: "lowHealth", apply: { kind: "shield", pctMax: true }, threshold: 0.35, chance: 1, minTier: "epic", amount: (n) => 0.12 + n * 0.02, desc: "Bursts a shield scaled to your vitality when badly wounded (once per fight)." },
  { id: "thorned",    name: "Thornmail",    cat: "defence", scope: "combat", type: "trigger", key: "thorns",         minTier: "rare",      amount: (n) => 6 + n * 3,            desc: "Reflects a share of damage taken back at the attacker." },
  { id: "aegis-eternal", name: "Aegis Eternal", cat: "divine", scope: "combat", type: "trigger", key: "invulnCharges", minTier: "divine", amount: () => 1, desc: "When near death, becomes briefly invulnerable (limited charges)." },

  // ---------- EXPANSION — fills tier/role gaps; %-based or geo-scaled so each
  //            stays relevant at every grade (slow/shatter/cap are new mechanics) ----------
  { id: "feast",      name: "Feast",        cat: "sustain", scope: "combat", type: "proc", hook: "onKill", apply: { kind: "refund", heal: true, pctMax: true }, chance: 1, minTier: "rare", amount: (n) => 0.05 + n * 0.01, desc: "Each kill knits back a share of your max health." },
  { id: "reprieve",   name: "Reprieve",     cat: "sustain", scope: "combat", type: "proc", hook: "lowHealth", apply: { kind: "refund", heal: true, pctMax: true }, threshold: 0.35, chance: 1, minTier: "epic", amount: (n) => 0.15 + n * 0.02, desc: "When badly wounded, surge back a chunk of max health (once per fight)." },
  { id: "ravage",     name: "Ravage",       cat: "offence", scope: "combat", type: "proc", hook: "onHit", cond: "targetDot", apply: { kind: "bonusHit" }, chance: 1, minTier: "epic", amount: (n) => geo(2, n), desc: "Tears extra deep into foes already bleeding, poisoned, or burning." },
  { id: "stonewall",  name: "Stonewall",    cat: "defence", scope: "combat", type: "stat", key: "damageCap", minTier: "legendary", amount: () => 0.33, desc: "No single blow may take more than a third of your max health — burst can't one-shot you." },
  { id: "unbowed",    name: "Unbowed",      cat: "defence", scope: "combat", type: "stat", key: "controlResist", minTier: "legendary", amount: (n) => 0.2 + n * 0.04, desc: "A growing chance to shrug off stuns and slows." },
  { id: "channeler",  name: "Channeler",    cat: "resource", scope: "combat", type: "proc", hook: "onCrit", apply: { kind: "refund", resolve: true }, chance: 1, minTier: "epic", amount: (n) => 1 + Math.floor(n / 2), desc: "Critical hits restore resolve — sustains a caster's burst." },
  { id: "hobble",     name: "Hobble",       cat: "control", scope: "combat", type: "proc", hook: "onHit", apply: { kind: "status", status: "slow", duration: 2 }, chance: 0.4, minTier: "rare", amount: () => 1, desc: "Chance on hit to slow a foe — they act later and lose their act-again." },
  { id: "shatterblow",name: "Shatterblow",  cat: "control", scope: "combat", type: "proc", hook: "onHit", apply: { kind: "status", status: "shatter", duration: 2 }, chance: 0.5, minTier: "epic", amount: (n) => geo(2, n), desc: "Chance on hit to sunder a foe's armour for a few turns." },

  // ---------- FUSION-ONLY (forged, never rolled) — see FUSIONS below ----------
  { id: "rupture",    name: "Rupture",      cat: "fusion", scope: "combat", type: "proc", noRoll: true, hook: "onHit", apply: { kind: "status", status: "bleed", duration: 3 }, chance: 1, minTier: "epic", amount: (n) => 4 + n * 2, desc: "FUSION: every hit ruptures flesh — guaranteed heavy bleed." },
  { id: "stormrend",  name: "Stormrend",    cat: "fusion", scope: "combat", type: "proc", noRoll: true, hook: "onCrit", apply: { kind: "status", status: "stun", duration: 1 }, chance: 1, minTier: "epic", amount: () => 1, desc: "FUSION: every critical hit stuns." },
  { id: "soulflame",  name: "Soulflame",    cat: "fusion", scope: "combat", type: "proc", noRoll: true, hook: "onHit", apply: { kind: "status", status: "burn", duration: 3 }, chance: 1, minTier: "epic", amount: (n) => 3 + n * 2, desc: "FUSION: cursed flame — every hit burns and the burn bites deep." },
  { id: "phalanx",    name: "Phalanx",      cat: "fusion", scope: "combat", type: "trigger", noRoll: true, key: "shieldGen", minTier: "epic", amount: (n) => 0.05 + n * 0.008, desc: "FUSION: an ever-renewing bulwark of overlapping shields, sized to your vitality." },
  { id: "revenant",   name: "Revenant",     cat: "fusion", scope: "combat", type: "proc", noRoll: true, hook: "onKill", apply: { kind: "refund", resolve: true, action: true, heal: true }, chance: 1, minTier: "legendary", amount: (n) => 3 + n, desc: "FUSION: every kill restores resolve, an action, and health." },
  { id: "volley",     name: "Volley",       cat: "fusion", scope: "combat", type: "proc", noRoll: true, hook: "onHit", apply: { kind: "bonusHit" }, chance: 0.5, minTier: "epic", amount: (n) => 5 + n, desc: "FUSION (ranged): a second shaft looses with every shot." },
  { id: "overload",   name: "Overload",     cat: "fusion", scope: "combat", type: "proc", noRoll: true, hook: "onHit", apply: { kind: "status", status: "burn", duration: 3 }, chance: 1, minTier: "epic", amount: (n) => 3 + n * 2, desc: "FUSION (caster): spellfire — every hit ignites and the burn bites deep." },
  { id: "blitz",      name: "Blitz",        cat: "fusion", scope: "combat", type: "stat", key: "swiftChance", noRoll: true, minTier: "legendary", amount: (n) => 0.3, desc: "FUSION (tempo): relentless speed — high chance to act again." },
  { id: "umbra",      name: "Umbra",        cat: "fusion", scope: "combat", type: "proc", noRoll: true, hook: "onDodge", apply: { kind: "buff", status: "dodgeStack", duration: 3 }, chance: 1, minTier: "epic", amount: (n) => 6 + n, desc: "FUSION (evasion): each dodge makes the next surer — snowballing into the unhittable." },
  { id: "ascendant",  name: "Ascendant",    cat: "fusion", scope: "combat", type: "stat", key: "damageMult", noRoll: true, minTier: "divine", amount: (n) => 0.6, desc: "FUSION (divine apex): ascend — overwhelming, world-ending force." },

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
  const fracKeys = ["damageMult", "drPct", "travelMult", "needDecayMult", "critMult", "fortify", "swiftChance", "coinBonus", "reviveOnce", "turnRegen", "shieldGen", "magicShieldGen", "healPower", "dmgDefer"]; // stored 0..1
  const wholePctKeys = ["lifesteal", "thorns"];        // stored as whole %, render with a % suffix
  const pctSuffixKeys = ["critChance", "dodge"];       // whole numbers that ARE percentages
  if (fracKeys.includes(def.key)) return `${def.name} ${Math.round(v * 100)}%`;
  if (wholePctKeys.includes(def.key)) return `${def.name} ${Math.round(v)}%`;
  if (pctSuffixKeys.includes(def.key)) return `${def.name} +${Math.round(v)}%`;
  return `${def.name} +${Math.round(v)}`;
}

// ---------------------------------------------------------------------------
// PRECISE EFFECT TEXT — the unambiguous answer to "what does this affix DO, and
// by how much, exactly?" A chip label says "Keen Edge +14"; this says
// "+14% critical-hit chance". Single source of truth for the item-detail chip
// reveal and the Passives codex audit. `numFmt` formats the magnitude per the
// stat's storage convention, `KEY_EFFECT` phrases stat/trigger/world affixes,
// and `formatProc` phrases on-hit/on-crit/etc. procs.
// ---------------------------------------------------------------------------
const numFmt = {
  flat:  (v) => `${Math.round(v)}`,
  pct:   (v) => `${Math.round(v * 100)}`,           // stored 0..1, shown as whole %
  float: (v) => (v % 1 ? v.toFixed(1) : `${Math.round(v)}`),
};
const plur = (n) => (Number(n) === 1 ? "" : "s");

// scale: how the magnitude is stored/formatted · p: phrase built from that number.
const KEY_EFFECT = {
  // offence
  damageFlat:  { s: "flat", p: (n) => `+${n} flat weapon damage` },
  damageMult:  { s: "pct",  p: (n) => `+${n}% damage dealt` },
  accuracy:    { s: "flat", p: (n) => `+${n} accuracy` },
  critChance:  { s: "flat", p: (n) => `+${n}% critical-hit chance` },
  critMult:    { s: "pct",  p: (n) => `+${n}% critical damage` },
  penetration: { s: "flat", p: (n) => `+${n} armour penetration` },
  // defence
  armor:       { s: "flat", p: (n) => `+${n} armour (vs physical)` },
  ward:        { s: "flat", p: (n) => `+${n} ward (vs magic)` },
  dodge:       { s: "flat", p: (n) => `+${n}% dodge chance` },
  maxHealth:   { s: "flat", p: (n) => `+${n} maximum health` },
  drPct:       { s: "pct",  p: (n) => `${n}% less damage taken from all sources` },
  healPower:   { s: "pct",  p: (n) => `+${n}% to all healing you receive` },
  dmgDefer:    { s: "pct",  p: (n) => `${n}% of damage taken is deferred, bleeding out over a few turns` },
  fortify:     { s: "pct",  p: (n) => `${n}% less damage taken while below 35% health` },
  damageCap:   { s: "pct",  p: (n) => `no single hit can exceed ${n}% of your max health` },
  controlResist:{ s: "pct", p: (n) => `${n}% chance to shrug off stuns and slows` },
  // tempo
  speed:       { s: "flat", p: (n) => `+${n} initiative (acts sooner)` },
  swiftChance: { s: "pct",  p: (n) => `+${n}% chance each turn to act a second time` },
  extraActions:{ s: "flat", p: (n) => `+${n} action point${plur(n)} each turn` },
  cooldownReduction: { s: "flat", p: (n) => `ability cooldowns recover ${n} turn${plur(n)} sooner` },
  // sustain / triggers
  lifesteal:   { s: "flat", p: (n) => `heal for ${n}% of damage dealt (capped at ${PASSIVE_CAPS.lifesteal}% total)` },
  turnRegen:   { s: "pct",  p: (n) => `restore ${n}% of max health each turn` },
  thorns:      { s: "flat", p: (n) => `reflect ${n}% of damage taken back at the attacker` },
  resolveRegen:{ s: "flat", p: (n) => `restore ${n} resolve each turn` },
  shieldGen:   { s: "pct",  p: (n) => `gain a physical shield worth ${n}% of max health each turn` },
  magicShieldGen: { s: "pct", p: (n) => `gain a magic ward worth ${n}% of max health each turn` },
  invulnCharges:{ s: "flat", p: (n) => `near death, turn briefly invulnerable (${n} charge${plur(n)} per fight)` },
  reviveOnce:  { s: "pct",  p: (n) => `once per fight, cheat death and revive at ${n}% health` },
  // world / exploration
  travelMult:   { s: "pct", p: (n) => `travel takes ${n}% less time` },
  coinBonus:    { s: "pct", p: (n) => `+${n}% coin looted from the fallen` },
  needDecayMult:{ s: "pct", p: (n) => `hunger, thirst & fatigue set in ${n}% slower` },
  healPerHour:  { s: "float", p: (n) => `recover ${n} extra health per hour out of battle` },
};

// On-X procs: hook → when it fires, plus its chance/condition.
const HOOK_PREFIX = {
  onHit: "On hit", onCrit: "On a critical hit", onKill: "On a kill",
  onDodge: "On each dodge", turnRamp: "Each turn", lowHealth: "When badly wounded",
};
function chancePrefix(def) {
  const base = HOOK_PREFIX[def.hook] || "On hit";
  const thr = def.hook === "lowHealth" && def.threshold ? ` (below ${Math.round(def.threshold * 100)}% health)` : "";
  const cond = def.cond === "targetLow" ? " against badly wounded foes" : def.cond === "targetDot" ? " against bleeding or burning foes" : "";
  const c = def.chance ?? 1;
  const chance = c < 1 ? ` — ${Math.round(c * 100)}% chance` : "";
  return `${base}${thr}${cond}${chance}`;
}
// Status payload → plain text. `n` is the already-formatted magnitude, `d` its duration.
const STATUS_EFFECT = {
  bleed:  (n, d) => `inflict bleeding (${n} damage/turn for ${d} turn${plur(d)})`,
  poison: (n, d) => `inflict poison (${n} damage/turn for ${d} turn${plur(d)})`,
  burn:   (n, d) => `set ablaze (${n} damage/turn for ${d} turn${plur(d)})`,
  chill:  (n, d) => `chill the foe (saps ${n} accuracy for ${d} turn${plur(d)})`,
  curse:  (n, d) => `curse the foe (+${n}% damage they take for ${d} turn${plur(d)})`,
  stun:   (n, d) => `stun the foe (skips ${d} turn${plur(d)})`,
  slow:   (n, d) => `slow the foe (acts later, no extra actions, ${d} turn${plur(d)})`,
  shatter:(n, d) => `shatter the foe's armour (−${n} armour for ${d} turn${plur(d)})`,
  rally:  (n, d) => `gain rally (+${n}% damage dealt for ${d} turn${plur(d)})`,
  dodgeStack: (n, d) => `gain +${n}% dodge that stacks with each dodge (${d} turn${plur(d)})`,
};
function procValueStr(lo, hi) {
  const a = Math.round(lo);
  if (hi == null) return `${a}`;
  const b = Math.round(hi);
  return a === b ? `${a}` : `${a}–${b}`;
}
// pctMax procs (Lifeward shield, Feast heal) store a fraction of max health.
function procPctStr(lo, hi) {
  const a = Math.round(lo * 100);
  if (hi == null) return `${a}`;
  const b = Math.round(hi * 100);
  return a === b ? `${a}` : `${a}–${b}`;
}
function formatProc(def, lo, hi) {
  const a = def.apply || {};
  const n = procValueStr(lo, hi);
  const pm = procPctStr(lo, hi);   // for pctMax payloads
  let effect;
  if (a.kind === "status" || a.kind === "buff") {
    const fn = STATUS_EFFECT[a.status];
    effect = fn ? fn(n, a.duration || 1) : a.status;
  } else if (a.kind === "execute") effect = `deal ${n} bonus damage`;
  else if (a.kind === "bonusHit") effect = `strike again for ${n} damage`;
  else if (a.kind === "shield") effect = a.pctMax ? `raise a shield worth ${pm}% of max health` : `raise a ${n}-point shield`;
  else if (a.kind === "refund") {
    const parts = [];
    if (a.resolve) parts.push(`${n} resolve`);
    if (a.action) parts.push("an action");
    if (a.heal) parts.push(a.pctMax ? `${pm}% of max health` : `${n} health`);
    const verb = (!a.resolve && !a.action && a.heal) ? "heal" : "refund";
    effect = `${verb} ${parts.join(", ")}`;
  } else effect = def.desc || "";
  return `${chancePrefix(def)}: ${effect}`;
}

// Precise effect of a passive at a CONCRETE tier — e.g. "+14% critical-hit chance".
// Falls back to the affix's tier floor when no tier is supplied.
export function passiveEffectText(id, tierId) {
  const def = BY_ID[id];
  if (!def) return "";
  const n = o(tierId || def.minTier || "common");
  if (def.type === "proc") return formatProc(def, def.amount(n)) + reqText(def);
  const k = KEY_EFFECT[def.key];
  return (k ? k.p(numFmt[k.s](def.amount(n))) : (def.desc || "")) + reqText(def);
}

// Effect across an affix's whole grade range (tier floor → divine), for the codex
// audit — e.g. "+6–14% critical-hit chance". Collapses to a single value when flat.
export function passiveEffectRange(id) {
  const def = BY_ID[id];
  if (!def) return "";
  const lo = o(def.minTier || "common"), hi = o("divine");
  if (def.type === "proc") return formatProc(def, def.amount(lo), def.amount(hi)) + reqText(def);
  const k = KEY_EFFECT[def.key];
  if (!k) return def.desc || "";
  const a = numFmt[k.s](def.amount(lo)), b = numFmt[k.s](def.amount(hi));
  return k.p(a === b ? a : `${a}–${b}`) + reqText(def);
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
export function aggregateCombatPassives(list, attrs = null) {
  const statMods = {};   // armor/ward/dodge/accuracy/penetration/critChance/critMult/speed/swiftChance/damageFlat/damageMult/maxHealth/drPct/extraActions/cooldownReduction/fortify
  const triggers = {};   // lifesteal/thorns/resolveRegen/turnRegen/reviveOnce/shieldGen/magicShieldGen/invulnCharges
  const procs = [];      // {hook, kind, status?, duration?, value, chance, cond?, threshold?, name} — fired by the engine
  for (const { id, tier } of (list || [])) {
    const def = BY_ID[id];
    if (!def || def.scope !== "combat") continue;
    // Threshold (Paragon) affixes lie dormant until the wearer's attribute clears
    // the bar. Without an attributes context they stay off (loot/forge previews).
    if (def.attrReq) {
      if (!attrs) continue;
      const have = def.attrReq.key === "highest"
        ? Math.max(0, ...ATTR_KEYS.map((k) => attrs[k] || 0))
        : (attrs[def.attrReq.key] || 0);
      if (have < def.attrReq.min) continue;
    }
    const v = def.amount(o(tier));
    if (def.type === "stat") {
      // damageCap is a "lowest wins" cap (stacking shouldn't weaken it); everything else sums.
      if (def.key === "damageCap") statMods.damageCap = statMods.damageCap ? Math.min(statMods.damageCap, v) : v;
      else statMods[def.key] = (statMods[def.key] || 0) + v;
    }
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
  if (statMods.controlResist != null) statMods.controlResist = Math.min(statMods.controlResist, PASSIVE_CAPS.controlResist);
  if (statMods.healPower != null) statMods.healPower = Math.min(statMods.healPower, PASSIVE_CAPS.healPower);
  if (statMods.dmgDefer != null) statMods.dmgDefer = Math.min(statMods.dmgDefer, PASSIVE_CAPS.dmgDefer);
  if (triggers.lifesteal != null) triggers.lifesteal = Math.min(triggers.lifesteal, PASSIVE_CAPS.lifesteal);
  if (triggers.turnRegen != null) triggers.turnRegen = Math.min(triggers.turnRegen, PASSIVE_CAPS.turnRegen);
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
  "rune-of-the-hunt":{ id: "rune-of-the-hunt",name: "Rune of the Hunt",kind: "material", value: 450, appearance: "A green-grey stone cut with a running hart.", description: "A forge-rune. Fuses two affixes into a signature power." },
  "rune-of-the-mind":{ id: "rune-of-the-mind",name: "Rune of the Mind",kind: "material", value: 450, appearance: "A violet crystal that hums against thought.", description: "A forge-rune. Fuses two affixes into a signature power." },
  "rune-of-haste":   { id: "rune-of-haste",   name: "Rune of Haste",   kind: "material", value: 500, appearance: "A quicksilver sigil that will not hold still.", description: "A forge-rune. Fuses two affixes into a signature power." },
  "rune-of-shadows": { id: "rune-of-shadows", name: "Rune of Shadows", kind: "material", value: 500, appearance: "A rune the eye keeps sliding off.", description: "A forge-rune. Fuses two affixes into a signature power." },
  "greater-rune-of-ascension": { id: "greater-rune-of-ascension", name: "Greater Rune of Ascension", kind: "material", value: 2000, appearance: "A rune of white fire that aches to look upon.", description: "A god-forged rune. Fuses two DIVINE powers into one apex force." },
};

export const FUSIONS = [
  { id: "fuse-rupture",  a: "serrated",   b: "savage",     rune: "rune-of-rupture", result: "rupture",   minTier: "epic" },
  { id: "fuse-stormrend",a: "keen-edge",  b: "concussive", rune: "rune-of-storms",  result: "stormrend", minTier: "epic" },
  { id: "fuse-soulflame",a: "incendiary", b: "cursed",     rune: "rune-of-flame",   result: "soulflame", minTier: "epic" },
  { id: "fuse-phalanx",  a: "barrier",    b: "bulwark",    rune: "rune-of-aegis",   result: "phalanx",   minTier: "epic" },
  { id: "fuse-revenant", a: "bloodthirst",b: "bloodhunt",  rune: "rune-of-souls",   result: "revenant",  minTier: "legendary" },
  { id: "fuse-volley",   a: "piercing",   b: "keen-edge",  rune: "rune-of-the-hunt",result: "volley",    minTier: "epic" },
  { id: "fuse-overload", a: "brutal",     b: "clearmind",  rune: "rune-of-the-mind",result: "overload",  minTier: "epic" },
  { id: "fuse-blitz",    a: "swift",      b: "quickened",  rune: "rune-of-haste",   result: "blitz",     minTier: "legendary" },
  { id: "fuse-umbra",    a: "evasion",    b: "evasive",    rune: "rune-of-shadows", result: "umbra",     minTier: "epic" },
  { id: "fuse-ascend",   a: "worldbreaker", b: "undying",  rune: "greater-rune-of-ascension", result: "ascendant", minTier: "divine" },
];

// Is this item id a forge-rune (the catalyst the Fusion ritual consumes)?
export function isFusionRune(id) {
  return FUSIONS.some((f) => f.rune === id);
}

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
