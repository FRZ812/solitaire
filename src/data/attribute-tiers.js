// Attribute tiers — one source of truth for the named bands the narrator uses
// (mirrors the table in system-prompt.js) AND the in-combat "breakpoint" bonuses
// crossing a band grants. So a high attribute reads the same in prose and in the
// fight: thresholds anchor both. Bonuses are CUMULATIVE — vigor 12 has crossed
// 2, 5, and 10 and sums every increment up to its value.
//
// The breakpoint bonuses are DISTINCT from (and on top of) the gentle per-point
// scaling in combat-stats.js / bestiary.js. They also apply to NPCs, so a foe
// with high attributes (a boss) is dangerous by its very nature.

// [minValue, label] bands per attribute (labels from the system-prompt table).
const BANDS = {
  body:     [[2, "common"], [5, "fit"], [10, "strong"], [15, "powerful"], [20, "legendary"]],
  reflex:   [[2, "average"], [5, "quick"], [10, "sharp"], [15, "inhuman"], [20, "legendary"]],
  vigor:    [[2, "hardy"], [5, "tough"], [10, "iron-willed"], [15, "stalwart"], [20, "indomitable"]],
  mind:     [[2, "common"], [5, "educated"], [10, "learned"], [15, "brilliant"], [20, "genius"]],
  wit:      [[2, "watchful"], [5, "keen"], [10, "sharp"], [15, "uncanny"], [20, "foresighted"]],
  presence: [[2, "polite"], [5, "commanding"], [10, "magnetic"], [15, "compelling"], [20, "world-shaping"]],
};

// The named band an attribute value sits in (for narrator state context + UI).
export function attrDescriptor(key, value) {
  let label = "untrained"; // 0–1
  for (const [min, l] of (BANDS[key] || [])) if ((value || 0) >= min) label = l;
  return label;
}

// Attributes pay off two ways:
//
// 1) SMOOTH stat scaling — a back-loaded (quadratic-ish) curve so low/mid stats
//    stay modest (the punishing mob balance holds) while a maxed stat is huge:
//    vigor 30 → +840 HP. No 5x gating; it just inflates with the attribute.
//
// 2) UNIQUE-EFFECT unlocks at the grind thresholds — a distinct mechanic at each
//    of 5/10/15/20/25/30 (rare/very-rare/epic/legendary/mythic/divine), CUMULATIVE
//    (you keep every one you've passed). These are qualitative powers (cheat death,
//    shrug off control, cap big hits, cleave armour, regen, extra actions,
//    ward-shields…), not just numbers. Applied to NPCs too, so a high-attribute
//    boss is innately mighty.

const addInto = (dst, src) => { for (const k in src) dst[k] = (dst[k] || 0) + src[k]; };

// Smooth, always-on stat scaling per attribute — back-loaded with an OFFSET so the
// first few points add nothing (an attribute of ≤4 contributes 0, keeping the
// punishing low/mid baseline exactly as tuned) and it ramps hard toward a maxed 30.
// q = max(0, v²-16); coefficient = target / (30²-16) = target / 884.
function smoothStats(key, v) {
  const q = Math.max(0, v * v - 16), s = {};
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

// Unique-effect unlocks at [5,10,15,20,25,30], cumulative. `s` → statMods,
// `t` → triggers (same keys the gear-affix engine already honors).
const UNIQUE = {
  vigor: [ // TOUGHNESS — deep HP (always-on) + shrugging off control, capped by Stonewall
    null,                             // 5
    { s: { controlResist: 0.25 } },   // 10 — hardy: shrug off stun/slow
    null,                             // 15
    { s: { controlResist: 0.35 } },   // 20 — near control-immune
    null,                             // 25
    { s: { damageCap: 0.25 } },       // 30 — Stonewall: no single hit exceeds 25% max HP
  ],
  body: [ // RAW MIGHT — devastating force: brutal crit damage + crushing blows
    { s: { critMult: 0.20 } },        // 5  rare      — heavy blows land like a falling hammer
    { s: { damageMult: 0.08 } },      // 10 very-rare — crushing strength
    { s: { critMult: 0.30 } },        // 15 epic      — bone-shattering critical force
    { s: { damageMult: 0.10 } },      // 20 legendary — colossal might
    { s: { critMult: 0.40 } },        // 25 mythic    — catastrophic, devastating crits
    { s: { execute: 0.20 } },         // 30 divine    — Execute: hits finish foes already below 20% HP
  ],
  reflex: [
    { s: { swiftChance: 0.10 } },     // 5  — flurry: chance to act again
    { s: { swiftChance: 0.10 } },     // 10
    { s: { extraActions: 1 } },       // 15 — move between heartbeats: an extra action
    { s: { swiftChance: 0.15 } },     // 20 — act-again totals 35%
    { s: { extraActions: 1 } },       // 25 — another extra action
    { s: { phaseChance: 0.25 } },     // 30 — Phantom: a quarter of attacks pass straight through you
  ],
  mind: [ // CONTROL & CASTING — your control magic lingers; your spells can surge
    { s: { controlDuration: 0.15 } }, // 5  — control you inflict lasts longer
    { s: { controlDuration: 0.15 } }, // 10
    { s: { cooldownReduction: 1 } },  // 15 — quick study: tricks recover faster
    { s: { controlDuration: 0.20 } }, // 20
    { s: { cooldownReduction: 1 } },  // 25
    { s: { spellSurge: 1 } },         // 30 — ALL abilities cost double Resolve but deal half again as much
  ],
  wit: [ // INSIGHT — clever mending, quick thinking, and precision crits
    { s: { healPower: 0.10 } },       // 5  rare      — tend wounds cannily: healing hits harder
    { s: { cooldownReduction: 1 } },  // 10 very-rare — quick thinking: tricks recover faster
    { s: { healPower: 0.15 } },       // 15 epic      — a healer's eye
    { s: { cooldownReduction: 1 } },  // 20 legendary — tricks recover faster still
    { s: { healPower: 0.20 } },       // 25 mythic    — perfect insight into mending
    { s: { abilityCrit: 1 } },        // 30 divine    — your abilities can crit, even healing spells
  ],
  presence: [ // WILLPOWER — sustain your Resolve, endure, and refuse to break
    { t: { resolveRegen: 1 } },          // 5  rare      — force of will fuels you
    { s: { dmgDefer: 0.15 } },           // 10 very-rare — iron will: endure, spread the pain over time
    { t: { resolveRegen: 1 } },          // 15 epic      — your will keeps fueling you (+1 more/turn)
    { s: { ccDurationReduction: 0.25 } },// 20 legendary — control & debuffs on you wear off faster
    { s: { dmgDefer: 0.15 } },           // 25 mythic    — defer ever more of the brunt
    { t: { lastStand: 1 } },             // 30 divine    — once per fight, a lethal blow can't drop you below 1 HP for 3 turns
  ],
};
const THRESHOLDS = [5, 10, 15, 20, 25, 30];

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

const THRESHOLD_TIER = { 5: "rare", 10: "very-rare", 15: "epic", 20: "legendary", 25: "mythical", 30: "divine" };

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
  saveDC:           (v) => `+${v} spell save DC — your charm, domination & control magic is harder to resist`,
  critChance:       (v) => `+${v}% crit chance`,
  critMult:         (v) => `+${Math.round(v * 100)}% crit damage`,
  healPower:        (v) => `+${Math.round(v * 100)}% healing potency`,
  swiftChance:      (v) => `${Math.round(v * 100)}% chance to act again`,
  extraActions:     (v) => `+${v} action each turn`,
  cooldownReduction:(v) => `${v}-turn cooldown reduction`,
  controlResist:    (v) => `resist ${Math.round(v * 100)}% of stuns, slows & debuffs`,
  damageCap:        (v) => `no single hit exceeds ${Math.round(v * 100)}% of your max HP`,
  execute:          (v) => `your hits finish foes already below ${Math.round(v * 100)}% HP`,
  phaseChance:      (v) => `${Math.round(v * 100)}% of attacks pass straight through you`,
  dmgDefer:         (v) => `spread ${Math.round(v * 100)}% of incoming damage over time`,
  turnRegen:        (v) => `regenerate ${Math.round(v * 100)}% max HP each turn`,
  reviveOnce:       (v) => `once per fight, cheat death (revive at ${Math.round(v * 100)}% HP)`,
  thorns:           (v) => `attackers take ${v} damage for striking you`,
  lifesteal:        (v) => `heal for ${v}% of the damage you deal`,
  shieldGen:        (v) => `conjure a shield worth ${Math.round(v * 100)}% max HP each turn`,
  magicShieldGen:   (v) => `weave a magic ward worth ${Math.round(v * 100)}% max HP each turn`,
  resolveRegen:     (v) => `recover +${v} resolve each turn`,
  controlDuration:  (v) => `+${Math.round(v * 100)}% control duration (stuns, slows & control you inflict last longer)`,
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
  mind:     "Intellect. Powers spell damage, sets how deep your Resolve runs, adds Ward (about a third of your Mind) against magic, sharpens your spell save DC so your charm, domination and control magic is harder to resist, and quickens how fast you learn.",
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
