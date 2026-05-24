// Central registry of every status the game can place on a character — debuffs
// (wounds, needs, hexes) AND buffs (boons). This is the single source of truth
// for a condition's POLARITY, whether it blocks natural healing, its damage-over-
// time rate, and its plain-language description. The engine (beat/healing/upkeep),
// the survival layer (needs), and the UI (pills, glossary) all read from here, so
// the numbers live in one place instead of being scattered across files.
//
// Conditions are stored on the character as objects: { name, remaining } where
// `remaining` is minutes left on a TIMED condition, or null for an INDEFINITE one
// (a wound that lasts until treated, or a need tied to a threshold). A registry
// entry's `duration` is the DEFAULT countdown a freshly-applied instance gets
// (null = indefinite).

export const CONDITIONS = {
  // ---- Wounds & hexes — indefinite, last until treated ----
  "Bleeding":        { polarity: "debuff", blocksHealing: true, dotPerHour: 3, duration: null,
    desc: "An open wound bleeds you for damage over time and STOPS all natural healing until it's bound or treated." },
  "Poisoned":        { polarity: "debuff", blocksHealing: true, dotPerHour: 2, duration: null,
    desc: "Toxin saps your Vitality over time and STOPS natural healing until it's cured (an antivenom, a healer)." },
  "Cursed":          { polarity: "debuff", blocksHealing: true, duration: null,
    desc: "A malign hex — it halves healing you receive and STOPS natural regen until lifted." },
  "Infected":        { polarity: "debuff", blocksHealing: true, duration: null,
    desc: "A wound has turned foul. It festers and STOPS natural healing until it's cleaned and tended." },
  "Festering Wound": { polarity: "debuff", blocksHealing: true, duration: null,
    desc: "An untended cut has gone bad — it needs proper tending, and STOPS natural healing until it gets it." },
  "Severed Limb":    { polarity: "debuff", blocksHealing: true, duration: null,
    desc: "A grievous, lasting maiming — it STOPS natural healing and will not mend without major intervention." },
  "Gravely Wounded": { polarity: "debuff", blocksHealing: false, duration: null,
    desc: "You were beaten to the edge of death and are slow to recover — rest and tend yourself before you push on." },

  // ---- Transient debuffs — count down on their own ----
  "Burning":  { polarity: "debuff", duration: 6,  desc: "Flames sear you for a few moments of damage." },
  "Wet":      { polarity: "debuff", duration: 90, desc: "Soaked through — miserable and cold; it can make you vulnerable to chill or slow you down until you dry off." },
  "Stunned":  { polarity: "debuff", duration: 2,  desc: "Reeling — you lose your action this turn." },
  "Slowed":   { polarity: "debuff", duration: 30, desc: "Sluggish — your accuracy and footing suffer for a short while." },
  "Chilled":  { polarity: "debuff", duration: 30, desc: "Cold-bitten — your accuracy is dulled for a couple of turns." },
  "Weakened": { polarity: "debuff", duration: 30, desc: "Your blows land softer — reduced outgoing damage for a time." },

  // ---- Need conditions — engine-managed by hunger/thirst/sleep thresholds ----
  "Hungry":    { polarity: "debuff", isNeed: true, duration: null, desc: "Below 30 hunger. A gnawing distraction; eat before it becomes starvation." },
  "Starving":  { polarity: "debuff", isNeed: true, blocksHealing: true, duration: null, desc: "Below 10 hunger. You're failing — and STARVATION STOPS your wounds from healing. Eat now." },
  "Thirsty":   { polarity: "debuff", isNeed: true, duration: null, desc: "Below 30 thirst. Find water before it gets worse." },
  "Parched":   { polarity: "debuff", isNeed: true, blocksHealing: true, duration: null, desc: "Below 10 thirst. Dangerously dry — and it STOPS natural healing. Drink now." },
  "Tired":     { polarity: "debuff", isNeed: true, duration: null, desc: "Below 30 sleep. Heavy-eyed; rest in a bedroll before you're exhausted." },
  "Exhausted": { polarity: "debuff", isNeed: true, blocksHealing: true, duration: null, desc: "Below 10 sleep. Barely upright — rest, or you'll drop." },

  // ---- Buffs (boons) — timed; granted by the narrator, rest, or a fine meal ----
  "Well-Fed": { polarity: "buff", duration: 240, desc: "A full, hearty meal sits warm in you — comfortable and steady on the road." },
  "Rested":   { polarity: "buff", duration: 240, desc: "Sleep has knit you back together; you wake clear-headed and sure-footed." },
  "Rallied":  { polarity: "buff", duration: 120, desc: "Your blood is up — heartened and emboldened, you press the fight with extra fire." },
  "Blessed":  { polarity: "buff", duration: 240, desc: "A grace lies on you — fortune and protection at your shoulder for a while." },
  "Focused":  { polarity: "buff", duration: 120, desc: "Calm and sharp-eyed; your aim and judgment are honed." },
};

const DEFAULT_META = { polarity: "neutral", blocksHealing: false, dotPerHour: 0, isNeed: false, duration: null, desc: null };

// Static properties for a condition name. Narrator-improvised conditions (not in
// the registry) read as a neutral, harmless circumstance with no timer.
export function conditionMeta(name) {
  return CONDITIONS[name] || DEFAULT_META;
}

export function polarityOf(name) { return conditionMeta(name).polarity; }

// A condition entry may be a bare string (legacy saves) or a { name, remaining }
// object — these read either shape.
export function condName(c) { return typeof c === "string" ? c : (c && c.name) || ""; }
export function condNames(conditions) { return (conditions || []).map(condName).filter(Boolean); }
export function hasCondition(conditions, name) { return condNames(conditions).includes(name); }

// string[] | object[] -> { name, remaining }[]. Idempotent (safe to re-run), and
// the migration path for older saves that stored plain condition strings. A bare
// string / {name} gets the registry's default duration (null for wounds & needs).
export function normalizeConditions(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const c of raw) {
    const name = condName(c);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const hasRemaining = typeof c === "object" && c !== null && "remaining" in c;
    const remaining = hasRemaining ? c.remaining : conditionMeta(name).duration;
    out.push({ name, remaining: remaining == null ? null : remaining });
  }
  return out;
}

// Count timed conditions down by the elapsed minutes, dropping any that run out.
// Indefinite conditions (remaining == null) are untouched. Returns the surviving
// list plus the names that just expired (for an "it wore off" log line).
export function tickConditions(conditions, minutes) {
  const m = minutes || 0;
  const kept = [];
  const expired = [];
  for (const c of normalizeConditions(conditions)) {
    if (c.remaining == null) { kept.push(c); continue; }
    const left = c.remaining - m;
    if (left > 0) kept.push({ ...c, remaining: left });
    else expired.push(c.name);
  }
  return { conditions: kept, expired };
}
