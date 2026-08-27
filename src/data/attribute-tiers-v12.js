// Frozen verifier-only Tower v1.2 semantics from deployed commit d925c35.
// Never route playable/current combat through this module.
// Attribute tiers — one source of truth for the named bands the narrator uses
// (mirrors the table in system-prompt.js) AND the in-combat "breakpoint" bonuses
// crossing a band grants. So a high attribute reads the same in prose and in the
// fight: thresholds anchor both. Bonuses are CUMULATIVE — vigor 12 has crossed
// 2, 5, and 10 and sums every increment up to its value.
//
// The breakpoint bonuses are DISTINCT from (and on top of) the gentle per-point
// scaling in combat-stats.js / bestiary.js. They also apply to NPCs, so a foe
// with high attributes (a boss) is dangerous by its very nature.

import { ATTRIBUTE_CAP } from "../config.js";

// The authored attribute scale now reaches 90, but feeding a raw apex score into
// every old linear/quadratic combat formula would turn 3x numeric headroom into
// 9x-or-worse combat output. Scores through the former cap retain their exact
// mechanical value. Above 30, this bounded rational curve keeps every added
// point meaningful while approaching (but never reaching) an effective 50.
//
//  30 -> 30, 45 -> 38.57, 60 -> 42, 75 -> 43.85, 90 -> 45
//
// Requirements and unlocks still read the RAW score; this helper is only for
// formulas that turn an attribute into damage, accuracy, defence, percentages,
// initiative, and similar combat quantities.
export const COMMON_ATTRIBUTE_MECHANICAL_CAP = 30;
const APEX_MECHANICAL_HEADROOM = 20;

export function mechanicalAttributeValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  const raw = Math.min(ATTRIBUTE_CAP, parsed);
  if (raw <= COMMON_ATTRIBUTE_MECHANICAL_CAP) return raw;
  const excess = raw - COMMON_ATTRIBUTE_MECHANICAL_CAP;
  return COMMON_ATTRIBUTE_MECHANICAL_CAP
    + (APEX_MECHANICAL_HEADROOM * excess) / (excess + APEX_MECHANICAL_HEADROOM);
}

// [minValue, label] bands per attribute. The 45/60/75/90 bands deliberately
// leave a wide gulf between ordinary people and epic, legendary, mythical, and
// divine beings rather than calling a score near the old cap world-shaping.
const BANDS = {
  body:     [[2, "common"], [5, "fit"], [10, "trained"], [15, "strong"], [20, "mighty"], [30, "heroic"], [45, "epic"], [60, "titan-blooded"], [75, "mythical"], [90, "divine"]],
  reflex:   [[2, "average"], [5, "quick"], [10, "sharp"], [15, "masterful"], [20, "uncanny"], [30, "heroic"], [45, "epic"], [60, "time-bending"], [75, "mythical"], [90, "divine"]],
  vigor:    [[2, "hardy"], [5, "tough"], [10, "iron-willed"], [15, "stalwart"], [20, "indomitable"], [30, "heroic"], [45, "epic"], [60, "death-defying"], [75, "mythical"], [90, "divine"]],
  mind:     [[2, "common"], [5, "educated"], [10, "learned"], [15, "brilliant"], [20, "genius"], [30, "polymathic"], [45, "epic"], [60, "transcendent"], [75, "mythical"], [90, "divine"]],
  wit:      [[2, "watchful"], [5, "keen"], [10, "sharp"], [15, "uncanny"], [20, "foresighted"], [30, "oracular"], [45, "epic"], [60, "fate-reading"], [75, "mythical"], [90, "divine"]],
  presence: [[2, "polite"], [5, "commanding"], [10, "magnetic"], [15, "compelling"], [20, "sovereign"], [30, "heroic"], [45, "epic"], [60, "legend-commanding"], [75, "mythical"], [90, "divine"]],
};

// The named band an attribute value sits in (for narrator state context + UI).
export function attrDescriptor(key, value) {
  let label = "untrained"; // 0–1
  for (const [min, l] of (BANDS[key] || [])) if ((value || 0) >= min) label = l;
  return label;
}

// Attributes pay off two ways:
//
// 1) SMOOTH stat scaling — the old quadratic-ish curve is unchanged through 30,
//    then consumes the diminishing mechanical value above so a raw 90 is
//    exceptional without creating ninefold quadratic output.
//
// 2) UNIQUE-EFFECT unlocks at the grind thresholds — a distinct mechanic at each
//    of 5/10/15/20/25/30/45/60/75/90, CUMULATIVE
//    (you keep every one you've passed). These are qualitative powers (cheat death,
//    shrug off control, cap big hits, cleave armour, regen, extra actions,
//    ward-shields…), not just numbers. Applied to NPCs too, so a high-attribute
//    boss is innately mighty.

const addInto = (dst, src) => { for (const k in src) dst[k] = (dst[k] || 0) + src[k]; };

// Smooth, always-on stat scaling per attribute — back-loaded with an OFFSET so the
// first few points add nothing (an attribute of ≤4 contributes 0, keeping the
// punishing low/mid baseline exactly as tuned); above 30 the bounded mechanical
// value continues the curve without treating the former mortal cap as divine.
// q = max(0, v²-16); coefficient = target / (30²-16) = target / 884.
function smoothStats(key, v) {
  const mechanical = mechanicalAttributeValue(v);
  const q = Math.max(0, mechanical * mechanical - 16), s = {};
  switch (key) {
    case "vigor":    break;                                              // HP lives in vitalityMax (attributes.js) — shown in the panel, no combat statMod here
    case "body":     s.damageMult = +(q * 0.00041).toFixed(4); break;     // 30 → +36% damage (armour & penetration dropped)
    case "reflex":   s.dodge = Math.round(q * 0.06787); break;            // 30 → +60 dodge (accuracy dropped)
    case "mind":     s.saveDC = Math.round(q * 0.0079); break;                // 30 → +7 save DC (control harder to resist)
    case "wit":      s.critChance = Math.round(q * 0.04525); break;           // 30 → +40 crit chance
    case "presence": s.maxResolve = Math.round(q * 0.02262); break;           // willpower: 30 → +20 max Resolve
  }
  return s;
}

// Unique-effect unlocks at [5,10,15,20,25,30,45,60,75,90], cumulative. `s` → statMods,
// `t` → triggers (same keys the gear-affix engine already honors).
const UNIQUE = {
  vigor: [ // TOUGHNESS — deep HP (always-on) + shrugging off control, capped by Stonewall
    null,                             // 5
    { s: { controlResist: 0.25 } },   // 10 — hardy: shrug off stun/slow
    null,                             // 15
    { s: { controlResist: 0.35 } },   // 20 — near control-immune
    null,                             // 25
    { s: { fortify: 0.05 } },         // 30 — mortal pinnacle: harder to finish while wounded
    { s: { controlResist: 0.10 } },   // 45 — epic composure under control
    { s: { damageCap: 0.25 } },       // 60 — Stonewall: no single hit exceeds 25% max HP
    { t: { turnRegen: 0.01 } },       // 75 — wounds begin closing during battle
    { t: { reviveOnce: 0.20 } },      // 90 — once per fight, return from death
  ],
  body: [ // RAW MIGHT — devastating force: brutal crit damage + crushing blows
    { s: { critMult: 0.20 } },        // 5  rare      — heavy blows land like a falling hammer
    { s: { damageMult: 0.08 } },      // 10 very-rare — crushing strength
    { s: { critMult: 0.30 } },        // 15 epic      — bone-shattering critical force
    { s: { damageMult: 0.10 } },      // 20 legendary — colossal might
    { s: { critMult: 0.40 } },        // 25 mythic    — catastrophic, devastating crits
    { s: { penetration: 1 } },        // 30 — mortal pinnacle force begins to breach protection
    { s: { damageMult: 0.05 } },      // 45 — epic force behind every blow
    { s: { critMult: 0.15 } },        // 60 — legendary critical force
    { s: { penetration: 3 } },        // 75 — mythical blows split protection
    { s: { execute: 0.20, damageMult: 0.10 } }, // 90 — divine Execute and raw might
  ],
  reflex: [
    { s: { swiftChance: 0.10 } },     // 5  — flurry: chance to act again
    { s: { swiftChance: 0.10 } },     // 10
    { s: { accuracy: 2 } },           // 15 — practiced precision
    { s: { swiftChance: 0.15 } },     // 20 — act-again totals 35%
    { s: { dodge: 5 } },              // 25 — evasive footwork
    { s: { accuracy: 3 } },           // 30 — mortal pinnacle precision
    { s: { extraActions: 1 } },       // 45 — epic speed finds an extra action
    { s: { swiftChance: 0.10 } },     // 60 — legendary openings to act again
    { s: { extraActions: 1 } },       // 75 — mythical motion between heartbeats
    { s: { phaseChance: 0.25, dodgeIgnore: 0.20 } }, // 90 — divine Phantom motion
  ],
  mind: [ // CONTROL & CASTING — your control magic lingers; your spells can surge
    { s: { controlDuration: 0.15 } }, // 5  — control you inflict lasts longer
    { s: { controlDuration: 0.15 } }, // 10
    { s: { cooldownReduction: 1 } },  // 15 — quick study: tricks recover faster
    { s: { controlDuration: 0.20 } }, // 20
    { s: { cooldownReduction: 1 } },  // 25
    { s: { saveDC: 1 } },             // 30 — mortal pinnacle command of spell structure
    { s: { saveDC: 2 } },             // 45 — epic command of hostile magic
    { t: { magicShieldGen: 0.02 } },   // 60 — thought instinctively renews a ward
    { s: { cooldownReduction: 1, controlDuration: 0.15 } }, // 75 — mythical recall and control
    { s: { spellSurge: 1 } },          // 90 — divine spell surge
  ],
  wit: [ // INSIGHT — clever mending, quick thinking, and precision crits
    { s: { healPower: 0.10 } },       // 5  rare      — tend wounds cannily: healing hits harder
    { s: { cooldownReduction: 1 } },  // 10 very-rare — quick thinking: tricks recover faster
    { s: { healPower: 0.15 } },       // 15 epic      — a healer's eye
    { s: { cooldownReduction: 1 } },  // 20 legendary — tricks recover faster still
    { s: { healPower: 0.20 } },       // 25 mythic    — perfect insight into mending
    { s: { critChance: 3 } },         // 30 — mortal pinnacle awareness
    { s: { critChance: 5 } },         // 45 — epic awareness of openings
    { s: { dodgeIgnore: 0.10 } },      // 60 — reads a foe's escape before it begins
    { s: { abilityCrit: 1, healPower: 0.10 } }, // 75 — mythical abilities can crit
    { s: { cooldownReduction: 1 } },   // 90 — divine intuition wastes no motion
  ],
  presence: [ // WILLPOWER — sustain your Resolve, endure, and refuse to break
    { t: { resolveRegen: 1 } },          // 5  rare      — force of will fuels you
    { s: { dmgDefer: 0.15 } },           // 10 very-rare — iron will: endure, spread the pain over time
    { t: { resolveRegen: 1 } },          // 15 epic      — your will keeps fueling you (+1 more/turn)
    { s: { ccDurationReduction: 0.25 } },// 20 legendary — control & debuffs on you wear off faster
    { s: { dmgDefer: 0.15 } },           // 25 mythic    — defer ever more of the brunt
    { s: { maxResolve: 3 } },             // 30 — mortal pinnacle reserves of conviction
    { s: { maxResolve: 5 } },             // 45 — epic reserves of conviction
    { s: { ccDurationReduction: 0.10 } }, // 60 — legendary self-command
    { t: { shieldGen: 0.02 } },           // 75 — presence manifests as a renewing aegis
    { t: { lastStand: 1 } },               // 90 — divine will refuses a lethal blow
  ],
};
const THRESHOLDS = [5, 10, 15, 20, 25, 30, 45, 60, 75, 90];

// Smooth stats + every unique unlock the attributes have passed → { statMods,
// triggers } folded into the combat pipeline.
export function attributeThresholdMods(attrs = {}) {
  const statMods = {}, triggers = {};
  for (const key of ["body", "reflex", "vigor", "mind", "wit", "presence"]) {
    const v = attrs[key] || 0;
    addInto(statMods, smoothStats(key, v));
    const ladder = UNIQUE[key] || [];
    THRESHOLDS.forEach((th, i) => {
      if (v < th || !ladder[i]) return;
      if (ladder[i].s) addInto(statMods, ladder[i].s);
      if (ladder[i].t) addInto(triggers, ladder[i].t);
    });
  }
  return { statMods, triggers };
}

// ---- Display helpers (character panel: tap an attribute to see its payoff) ----

const THRESHOLD_TIER = {
  5: "common", 10: "common", 15: "uncommon", 20: "uncommon", 25: "rare",
  30: "very-rare", 45: "epic", 60: "legendary", 75: "mythical", 90: "divine",
};

// One readable phrase per stat/trigger key, used for both the smooth bonuses and
// the unique unlocks so the panel reads in plain language.
const EFFECT_FMT = {
  drPct:            (v) => `+${Math.round(v * 100)}% damage reduction`,
  damageMult:       (v) => `+${Math.round(v * 100)}% damage`,
  armor:            (v) => `+${v} armour`,
  penetration:      (v) => `+${v} penetration`,
  dodge:            (v) => `+${v}% dodge`,
  accuracy:         (v) => `+${v} accuracy`,
  ward:             (v) => `+${v} ward`,
  saveDC:           (v) => `+${v} spell save DC`,
  critChance:       (v) => `+${v}% crit chance`,
  critMult:         (v) => `+${Math.round(v * 100)}% crit damage`,
  healPower:        (v) => `+${Math.round(v * 100)}% healing potency`,
  swiftChance:      (v) => `${Math.round(v * 100)}% chance to act again`,
  extraActions:     (v) => `+${v} action each turn`,
  cooldownReduction:(v) => `${v}-turn cooldown reduction`,
  controlResist:    (v) => `resist ${Math.round(v * 100)}% of stuns, slows & debuffs`,
  damageCap:        (v) => `no single hit exceeds ${Math.round(v * 100)}% of your max HP`,
  execute:          (v) => `dealing damage to foes below ${Math.round(v * 100)}% HP instantly kills them`,
  phaseChance:      (v) => `${Math.round(v * 100)}% of attacks pass straight through you`,
  dmgDefer:         (v) => `spread ${Math.round(v * 100)}% of incoming damage over time`,
  turnRegen:        (v) => `regenerate ${Math.round(v * 100)}% max HP each turn`,
  reviveOnce:       (v) => `once per fight, cheat death (revive at ${Math.round(v * 100)}% HP)`,
  thorns:           (v) => `attackers take ${v} damage for striking you`,
  lifesteal:        (v) => `heal for ${v}% of the damage you deal`,
  shieldGen:        (v) => `conjure a shield worth ${Math.round(v * 100)}% max HP each turn`,
  magicShieldGen:   (v) => `weave a magic ward worth ${Math.round(v * 100)}% max HP each turn`,
  resolveRegen:     (v) => `recover +${v} resolve each turn`,
  controlDuration:  (v) => `+${Math.round(v * 100)}% control duration`,
  ccDurationReduction:(v) => `incoming stuns, slows & debuffs last ${Math.round(v * 100)}% less`,
  spellSurge:       () => `your abilities cost double Resolve but deal 50% more damage`,
  maxResolve:       (v) => `+${v} max Resolve`,
  lastStand:        () => `once per fight, a lethal blow can't drop you below 1 HP for 3 turns`,
  abilityCrit:      () => `your abilities can land critical hits — even healing spells`,
};
const fmtEffects = (obj) => Object.entries(obj || {}).map(([k, v]) => (EFFECT_FMT[k] ? EFFECT_FMT[k](v) : `${k} +${v}`));

// What each attribute does, mechanically — so tapping a stat always explains
// itself even when a low score's numeric bonus rounds to nothing yet.
const ATTR_PURPOSE = {
  body:     "Raw might. Drives melee damage and the heavy weapons you can wield, and adds Armor (about a third of your Body) against physical hits.",
  reflex:   "Speed and finesse. Raises Dodge and Accuracy, helps you strike first, and powers light, finesse weapons — daggers, bows.",
  vigor:    "Toughness. Sets your maximum Vitality and grants flat damage reduction — how much punishment you can take before you fall.",
  mind:     "Intellect. Powers spell damage, sets how deep your Resolve runs, adds Ward (about a third of your Mind) against magic, sharpens your spell save DC, and quickens how fast you learn.",
  wit:      "Awareness. Raises your critical-hit chance and your perception — spotting ambushes and openings — and sharpens healing and quick thinking.",
  presence: "Force of will. Steadies morale and sways how others and foes respond to you; at high Presence your Resolve recovers even in the thick of a fight.",
};
export function attrPurpose(key) { return ATTR_PURPOSE[key] || ""; }

// The smooth, always-on bonuses an attribute currently grants at value `v`.
// Drops entries whose magnitude rounds to zero (a low score gives "nothing yet").
export function smoothStatSummary(key, v) {
  return fmtEffects(smoothStats(key, v)).filter((s) => {
    const m = s.match(/-?\d+(\.\d+)?/);
    return !m || parseFloat(m[0]) !== 0;
  });
}

// The full unique-unlock ladder for an attribute, each step marked reached or not
// against `v`. `at` is the score it unlocks at; `tier` its grade; `text` what it does.
export function attributeLadder(key, v = 0) {
  const ladder = UNIQUE[key] || [];
  return THRESHOLDS.map((at, i) => ({
    at, tier: THRESHOLD_TIER[at],
    reached: (v || 0) >= at,
    text: ladder[i] ? [...fmtEffects(ladder[i].s), ...fmtEffects(ladder[i].t)].join("; ") : "",
  })).filter((x) => x.text);
}
