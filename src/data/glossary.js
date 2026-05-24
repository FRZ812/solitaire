// Plain-language explanations of the game's concepts, surfaced as tap-to-read
// entries in the character menu and a Glossary tab in the codex. Numbers here
// mirror the engine (engine/healing.js, combat-stats.js, needs.js, economy.js,
// light.js) — keep them in sync if the engine is retuned.

export const GLOSSARY_CATEGORIES = ["Vitals", "Survival", "Combat", "Currency", "Light", "Kit"];

export const GLOSSARY = [
  // ---- Vitals ----
  { id: "vitality", term: "Vitality", category: "Vitals",
    text: "Your life. At 0 you fall. Out of combat it knits back about 1 point per hour (faster with Mending gear) — but it does NOT heal at all while you're Bleeding, Poisoned, Burning, Cursed, Starving, or Parched, so deal with the wound or the need first. Your maximum rises with Vigor." },
  { id: "resolve", term: "Resolve", category: "Vitals",
    text: "The grit that fuels spells (martial techniques are free, gated by cooldown). It has NO base per-turn regen — you spend down a pool and refill it by RESTING or by drinking (ale, wine, or a hard pull of spirits). The pool itself grows with MIND, the way your health grows with Vigor, so a true mage commands a deep well. A few rare wills DO trickle it back mid-fight — high Presence and traits like Clear Mind or Archmage — and earned procs (a kill via Bloodhunt, a crit via Channeler) hand some back." },

  // ---- Survival (needs) ----
  { id: "hunger", term: "Hunger", category: "Survival",
    text: "Drops about 2 per hour. Below 30 you're Hungry; below 10 you're Starving — and starvation stops your wounds from healing. Eat preserved rations or a meal to restore it." },
  { id: "thirst", term: "Thirst", category: "Survival",
    text: "Drops about 3 per hour — the fastest of the three. Below 30 you're Thirsty; below 10 Parched, which also halts healing. Drink from a waterskin, well, or clean stream." },
  { id: "sleep", term: "Sleep", category: "Survival",
    text: "Drops about 2.5 per hour. Below 30 you're Tired; below 10 Exhausted. Bed down in a bedroll to rest and restore it — choose how long, and time passes." },

  // ---- Combat ----
  { id: "armor", term: "Armor", category: "Combat",
    text: "Soaks PHYSICAL damage point-for-point. Comes from your Body (about a third of it) plus worn armour and shields. A foe's Penetration cuts through it." },
  { id: "ward", term: "Ward", category: "Combat",
    text: "Armor against MAGICAL damage. Comes from your Mind (about a third) plus wards, robes, and charms. Spell Penetration cuts through it." },
  { id: "dodge", term: "Dodge", category: "Combat",
    text: "Your chance to avoid a blow entirely, weighed against the attacker's Accuracy. Grows with Reflex and light, evasive gear." },
  { id: "accuracy", term: "Accuracy", category: "Combat",
    text: "How surely your blows land, set against the target's Dodge. Fighting in the dark with no torch lit cuts it sharply." },
  { id: "crit", term: "Critical hit", category: "Combat",
    text: "A telling blow for extra damage. Your crit chance rises with Wit; crit damage rises with gear and traits." },
  { id: "penetration", term: "Penetration", category: "Combat",
    text: "Ignores that much of the target's Armor (physical) or Ward (magical) — the bite that gets through plate or wards." },
  { id: "damage", term: "Damage", category: "Combat",
    text: "What a hit takes off, set by your weapon and amplified by the governing attribute and tier. Physical is met by Armor, magical by Ward." },
  { id: "shields", term: "Shields", category: "Combat",
    text: "A temporary buffer (from some spells/affixes) that absorbs damage before your Vitality. Physical and magical shields are separate pools." },
  { id: "dr", term: "Damage reduction", category: "Combat",
    text: "A flat percentage cut taken off incoming damage after Armor/Ward (capped). High Vigor and certain traits grant it." },

  // ---- Currency ----
  { id: "currency", term: "Coins (gp / sp / cp)", category: "Currency",
    text: "Gold, silver, and copper. 1 silver = 10 copper, 1 gold = 100 copper (so 1 gold = 10 silver). Rough worth: a torch ~6cp, a dagger ~20cp, a sword ~100–200cp, leather ~80cp, mail ~300–500cp. Finer (higher-tier) goods cost several times their common version." },

  // ---- Light ----
  { id: "light", term: "Light & darkness", category: "Light",
    text: "Daylight lights the open world; after dark, only a flame does (towns keep some ambient glow, the wilds do not). Caves, dungeons, and interiors are dark at any hour. In the dark with NO light you go blind: your aim suffers in a fight and your sight shrinks to a single hex — you can barely map your way and can't travel far. A torch (≈1h, modest pool) or a lantern (≈4h on a flask of oil, steady and bright) pushes it back. Strike either with a tinderbox." },
  { id: "night", term: "Night & ambush", category: "Light",
    text: "More things prowl after dark — encounters are likelier at night and in gloomy country. A burning light lets you see and fight, but it's a BEACON: foes are likelier to ambush you and you can't slip past them. Go unlit and you're blind, but HIDDEN — you can slip away from trouble and break from a fight far more easily. A risk you weigh each night." },
  { id: "travel-magic", term: "Flight & teleport", category: "Light",
    text: "Travel magic skips the slow road — if you've learned it. FLY (a known spell) lets you cross any ground from the air, far faster, with a wide view, and above the things that prowl below — each leg aloft costs resolve. DIMENSION DOOR jumps you to a spot you can see a short way off; GATE tears open a way to anywhere you've been or a landmark you know of (gating somewhere you've only heard of, you arrive blind). Teleports cost resolve per jump — and that resolve is gone for whatever waits on the far side. Choose these from the map when you know the spell." },
  { id: "darkvision", term: "Darkvision", category: "Light",
    text: "Some kindreds — drow, vampires, lycanthropes — see in pitch dark. They suffer none of the dark's blindness (full sight, no combat penalty) and can stay unlit to remain hidden: the best of both. Most folk need a flame." },

  // ---- Starting kit ----
  { id: "kit-torch", term: "Torch & tinderbox", category: "Kit",
    text: "A torch gives light for about an hour — but you need a tinderbox to strike the flame, which is why the two travel together. Open the torch in your pack and choose Light." },
  { id: "kit-bedroll", term: "Bedroll & blanket", category: "Kit",
    text: "Bed down to rest: pick a duration, skip that much time, and recover Sleep (and some Vitality). A dry, warm rest is the difference between waking restored and waking sick." },
  { id: "kit-waterskin", term: "Waterskin", category: "Kit",
    text: "Holds a few draughts of water. Drink to cut Thirst; refill at a well, settlement, or clean stream when it runs dry." },
  { id: "kit-rations", term: "Trail rations", category: "Kit",
    text: "Preserved food that keeps on the road (unlike fresh meat or fruit, which spoil). Eat to stave off Hunger." },
];

const BY_ID = Object.fromEntries(GLOSSARY.map((g) => [g.id, g]));
export function glossaryById(id) { return BY_ID[id] || null; }

// Explanations for the condition pills the menu shows. Keys are the narrative
// labels the game stores in character.conditions. Anything not listed gets a
// sensible generic line so even narrator-improvised conditions (e.g. "Wet")
// still explain themselves.
const CONDITION_INFO = {
  Bleeding:  "An open wound bleeds you for damage over time and STOPS all natural healing until it's bound or treated.",
  Poisoned:  "Toxin saps your Vitality over time and STOPS natural healing until it's cured (an antivenom, a healer).",
  Burning:   "Flames sear you for a few turns of damage.",
  Cursed:    "A malign hex — it halves healing you receive and STOPS natural regen until lifted.",
  Wet:       "Soaked through — miserable and cold, and it can make you vulnerable to chill or slow you down until you dry off.",
  Stunned:   "Reeling — you lose your action this turn.",
  Slowed:    "Sluggish — your accuracy and footing suffer for a short while.",
  Chilled:   "Cold-bitten — your accuracy is dulled for a couple of turns.",
  Weakened:  "Your blows land softer — reduced outgoing damage for a time.",
  Hungry:    "Below 30 hunger. A gnawing distraction; eat before it becomes starvation.",
  Starving:  "Below 10 hunger. You're failing — and STARVATION STOPS your wounds from healing. Eat now.",
  Thirsty:   "Below 30 thirst. Find water before it gets worse.",
  Parched:   "Below 10 thirst. Dangerously dry — and it STOPS natural healing. Drink now.",
  Tired:     "Below 30 sleep. Heavy-eyed; rest in a bedroll before you're exhausted.",
  Exhausted: "Below 10 sleep. Barely upright — rest, or you'll drop.",
};

export function conditionInfo(label) {
  if (CONDITION_INFO[label]) return { term: label, text: CONDITION_INFO[label] };
  return { term: label, text: "A circumstance the story has placed on you. It colours what you can do until it passes or is dealt with." };
}
