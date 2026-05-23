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

// TIERED stat-threshold passives: each attribute, at a breakpoint, grants a
// single tier-graded boon — and a STRONGER one than a gear passive of the same
// grade, because reaching a high attribute is a brutal grind that should pay a
// hero's dividend. The grind ladder:
//   5 → rare · 10 → very-rare · 15 → epic · 20 → legendary · 25 → mythic · 30 → divine
// You get the boon for your HIGHEST threshold per attribute (not a sum). Applied
// to NPCs too, so a high-attribute foe (a boss) is innately mighty.
const THRESHOLD_TIER = [[30, 7], [25, 6], [20, 5], [15, 4], [10, 3], [5, 2]]; // [attr value, tier order]
// Tier power multipliers by order (common→divine), mirroring data/tiers.js.
const TIER_MULT = [1, 1.35, 1.8, 2.4, 3.2, 5.2, 7.6, 12];
const tierOrderFor = (v) => { for (const [val, ord] of THRESHOLD_TIER) if ((v || 0) >= val) return ord; return 0; };
const geo = (base, o) => Math.round(base * TIER_MULT[o]);

// The per-attribute boon at tier order `o` (≥2). Magnitudes are deliberately
// above an equivalent-tier gear affix (e.g. vigor-30 maxHealth 840 > Juggernaut
// 720). `s` → statMods, `t` → triggers.
function thresholdBoon(key, o) {
  const s = {}, t = {};
  switch (key) {
    case "vigor":    s.maxHealth = geo(70, o); s.drPct = 0.03 + 0.012 * o; break;       // the hero's innate vitality + mitigation
    case "body":     s.damageMult = 0.05 * o; s.armor = geo(2, o); s.penetration = Math.round(o * 0.9); break;
    case "reflex":   s.dodge = geo(2, o); s.swiftChance = 0.02 * o; s.accuracy = o; break;
    case "mind":     s.ward = geo(2, o); s.damageMult = 0.025 * o; s.cooldownReduction = o >= 6 ? 1 : 0.5; break;
    case "wit":      s.critChance = 3 * o; s.accuracy = o; s.speed = Math.floor(o / 2); break;
    case "presence": s.fortify = Math.min(0.2, 0.02 * o); t.resolveRegen = o >= 5 ? 2 : 1; break; // mostly narrative
  }
  return { s, t };
}

// Each attribute contributes the boon of its highest threshold → { statMods,
// triggers } folded into the combat pipeline (same keys aggregateCombatPassives uses).
export function attributeThresholdMods(attrs = {}) {
  const statMods = {}, triggers = {};
  for (const key of ["body", "reflex", "vigor", "mind", "wit", "presence"]) {
    const o = tierOrderFor(attrs[key] || 0);
    if (!o) continue;
    const { s, t } = thresholdBoon(key, o);
    for (const k in s) statMods[k] = (statMods[k] || 0) + s[k];
    for (const k in t) triggers[k] = (triggers[k] || 0) + t[k];
  }
  return { statMods, triggers };
}
