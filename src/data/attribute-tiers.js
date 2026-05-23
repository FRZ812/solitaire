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

// Combat breakpoint increments, granted on REACHING each value (cumulative).
// `stat` keys merge into the combat statMods; `trig` keys into triggers.
// (Vigor's HP comes from the per-point vitalityMax in attributes.js; its
// breakpoints give mitigation instead, so thresholds feel "different".)
const BREAKPOINTS = {
  body: [
    { at: 5,  stat: { armor: 1, damageMult: 0.05 } },
    { at: 10, stat: { armor: 1, penetration: 1, damageMult: 0.05 } },
    { at: 15, stat: { armor: 2, penetration: 1, damageMult: 0.08 } },
    { at: 20, stat: { armor: 2, penetration: 2, damageMult: 0.12 } },
  ],
  reflex: [
    { at: 5,  stat: { dodge: 3, accuracy: 1 } },
    { at: 10, stat: { dodge: 4, accuracy: 1, critChance: 3 } },
    { at: 15, stat: { dodge: 5, accuracy: 2, swiftChance: 0.08 } },
    { at: 20, stat: { dodge: 6, accuracy: 2, swiftChance: 0.10 } },
  ],
  vigor: [
    { at: 5,  stat: { drPct: 0.03 } },
    { at: 10, stat: { drPct: 0.06 } },
    { at: 15, stat: { drPct: 0.08, fortify: 0.10 } },
    { at: 20, stat: { drPct: 0.10, fortify: 0.15 } },
  ],
  mind: [
    { at: 5,  stat: { ward: 1 }, trig: { resolveRegen: 1 } },
    { at: 10, stat: { ward: 1, cooldownReduction: 0.5 } },
    { at: 15, stat: { ward: 2, cooldownReduction: 0.5 } },
    { at: 20, stat: { ward: 2, cooldownReduction: 1 } },
  ],
  wit: [
    { at: 5,  stat: { critChance: 3, accuracy: 1 } },
    { at: 10, stat: { critChance: 4, accuracy: 1 } },
    { at: 15, stat: { critChance: 5, accuracy: 2, speed: 2 } },
    { at: 20, stat: { critChance: 6, speed: 2 } },
  ],
  presence: [
    // Largely narrative; a sliver of will at the high end.
    { at: 10, trig: { resolveRegen: 1 } },
    { at: 20, stat: { fortify: 0.05 } },
  ],
};

const addInto = (dst, src) => { for (const k in src) dst[k] = (dst[k] || 0) + src[k]; };

// Sum every breakpoint each attribute has crossed → { statMods, triggers } to
// fold into the combat pipeline (same keys aggregateCombatPassives produces).
export function attributeThresholdMods(attrs = {}) {
  const statMods = {}, triggers = {};
  for (const key in BREAKPOINTS) {
    const v = attrs[key] || 0;
    for (const bp of BREAKPOINTS[key]) {
      if (v < bp.at) break; // ascending; nothing higher qualifies
      if (bp.stat) addInto(statMods, bp.stat);
      if (bp.trig) addInto(triggers, bp.trig);
    }
  }
  return { statMods, triggers };
}
