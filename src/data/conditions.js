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

// Central registry of every status the game can place on a character — debuffs
// (wounds, needs, hexes) AND buffs (boons). This is the single source of truth
// for a condition's POLARITY, TIER (rarity — how grand/rare the source is), what
// blocks or speeds healing, its damage-over-time rate, and its plain-language
// description. The engine (beat/healing/upkeep), the survival layer (needs), and
// the UI (pills, codex) all read from here, so the numbers live in one place.
//
// Conditions are stored on the character as objects: { name, remaining } where
// `remaining` is minutes left on a TIMED condition, or null for an INDEFINITE one
// (a wound that lasts until treated, or a need tied to a threshold). A registry
// entry's `duration` is the DEFAULT countdown a freshly-applied instance gets
// (null = indefinite).
//
// ENGINE-WIRED fields (have real mechanical bite the engine applies every beat):
//   blocksHealing  — passive vitality regen is halted while this is on you.
//   dotPerHour     — vitality lost per hour (Bleeding, Poison, disease…).
//   regenPerHour   — bonus vitality healed per hour (recovery buffs).
//   travelSpeedMult — multiplies map travel speed (Haste); engine/buffs.js applies
//                     it as LESS TIME per distance, so it never speeds need drain.
//   carryBonus / rideCapacityBonus — transient lifts to the bearer's carry cap and
//                     the mount they ride (engine/buffs.js → attributes/riding).
// DESCRIPTIVE fields (`tier`, `trigger`, `effect`) document the condition for the
// codex; combat-only effects (accuracy/damage/stun…) are resolved by the combat
// engine's status system and adjudicated in the fiction by the narrator.

export const CONDITIONS = {
  // ============================ DEBUFFS ============================

  // ---- Common: everyday hurts and survival pressure ----
  "Bleeding":   { polarity: "debuff", tier: "common", blocksHealing: true, dotPerHour: 3, duration: null,
    trigger: "a cut, stab, claw, or any open wound left unbound",
    effect: "Loses 3 vitality each hour and STOPS all natural healing until it's bandaged or treated.",
    desc: "An open wound bleeds you steadily; the longer it runs, the weaker you grow." },
  "Bruised":    { polarity: "debuff", tier: "common", duration: 90,
    trigger: "a brawl, a fall, blunt blows that don't break skin",
    effect: "Aches and stiffens — a small penalty to the force of your blows until it fades.",
    desc: "Deep bruising and sore muscle. Nothing grave, but it slows your swing." },
  "Winded":     { polarity: "debuff", tier: "common", duration: 15,
    trigger: "a hard sprint, a gut blow, fighting at altitude",
    effect: "Short of breath — reduced accuracy and stamina until you catch it.",
    desc: "Your lungs heave and your guard sags while you gasp for air." },
  "Wet":        { polarity: "debuff", tier: "common", duration: 90,
    trigger: "rain, fording a river, a dunking, or a thrown bucket",
    effect: "Cold and clumsy; leaves you open to Chilled and dulls your footing until you dry off.",
    desc: "Soaked through — miserable, heavy, and chilled to the bone." },

  // ---- Uncommon: real combat afflictions and acute need ----
  "Poisoned":   { polarity: "debuff", tier: "uncommon", blocksHealing: true, dotPerHour: 2, duration: null,
    trigger: "venomous fangs, a tainted blade, or bad food and drink",
    effect: "Loses 2 vitality each hour and STOPS natural healing until it's cured (antivenom, a healer).",
    desc: "Toxin works through your blood, sapping your strength with every hour." },
  "Burning":    { polarity: "debuff", tier: "uncommon", dotPerHour: 4, duration: 6,
    trigger: "open flame, spilled oil, a fire spell, or pitch",
    effect: "Sears for heavy damage over a few moments until it's smothered or burns out.",
    desc: "Flame has caught on you — beat it out or get to water." },
  "Slowed":     { polarity: "debuff", tier: "uncommon", duration: 30,
    trigger: "mire and deep snow, a frost hex, or a crippling blow to the leg",
    effect: "Sluggish — lowered accuracy and footing, and you act less often in a fight.",
    desc: "Every movement drags, as though the air itself has thickened." },
  "Chilled":    { polarity: "debuff", tier: "uncommon", duration: 30,
    trigger: "biting cold, frost magic, or being Wet in the cold",
    effect: "Cold-bitten — dulled accuracy for a while; can deepen toward worse if not warmed.",
    desc: "The cold seeps into your hands and your aim wanders." },
  "Weakened":   { polarity: "debuff", tier: "uncommon", duration: 30,
    trigger: "a sapping strike, deep fatigue, or an enfeebling hex",
    effect: "Your blows land softer — reduced outgoing damage until it passes.",
    desc: "Strength bleeds out of your limbs; your hardest swing feels feeble." },
  "Stunned":    { polarity: "debuff", tier: "uncommon", duration: 2,
    trigger: "a concussive blow, a shield bash, or a flash of light/sound",
    effect: "Reeling — you lose your action this turn.",
    desc: "The world rings and tilts; for a moment you can do nothing." },
  "Dazed":      { polarity: "debuff", tier: "uncommon", duration: 8,
    trigger: "a glancing blow to the head, a loud blast, sudden glare",
    effect: "Rattled — reduced accuracy and critical chance briefly.",
    desc: "Your thoughts swim and your focus won't hold." },
  "Vulnerable": { polarity: "debuff", tier: "uncommon", duration: 20,
    trigger: "a shattered guard, a sundered stance, a marking strike",
    effect: "Defences broken — you take increased damage for a short time.",
    desc: "Your guard is split open; the next blows will bite deeper." },

  // ---- Rare: lingering sickness, fear, and spellcraft ----
  "Infected":        { polarity: "debuff", tier: "rare", blocksHealing: true, dotPerHour: 1, duration: null,
    trigger: "a wound left untended a day, filth in a cut, a dirty blade",
    effect: "Festers slowly (1 vitality/hour) and STOPS natural healing until cleaned and tended.",
    desc: "A wound gone sour — hot, swollen, and creeping worse." },
  "Festering Wound": { polarity: "debuff", tier: "rare", blocksHealing: true, dotPerHour: 1, duration: null,
    trigger: "a deep wound gone bad, rot setting into torn flesh",
    effect: "Rots the flesh (1 vitality/hour) and STOPS natural healing until properly treated.",
    desc: "The injury has turned putrid; without care it will only deepen." },
  "Diseased":   { polarity: "debuff", tier: "rare", blocksHealing: true, dotPerHour: 1, duration: null,
    trigger: "plague, foul water, vermin, or close contact with the sick",
    effect: "Saps you (1 vitality/hour), STOPS healing, and drags at your vigor until cured.",
    desc: "A sickness has its hooks in you — feverish, weak, and worsening." },
  "Frightened": { polarity: "debuff", tier: "rare", duration: 20,
    trigger: "a terror, a monstrous foe, a horror, or a broken will",
    effect: "Lowered accuracy and resolve; you may be unable to close on the source of the fear.",
    desc: "Cold dread grips you and your courage falters." },
  "Silenced":   { polarity: "debuff", tier: "rare", duration: 15,
    trigger: "a hush hex, a gag, a crushed throat, or a zone of silence",
    effect: "You cannot cast spells or cry out until it lifts.",
    desc: "No sound will leave you — words and incantations die in your throat." },
  "Charmed":    { polarity: "debuff", tier: "epic", duration: 10,
    trigger: "a Charm spell or an enchanter's honeyed suggestion",
    effect: "You are calmed toward the caster — you will not raise a hand against them. It cannot make you harm your own.",
    desc: "A warm, borrowed fondness clouds your judgement; the caster seems a friend." },
  "Dominated":  { polarity: "debuff", tier: "mythical", duration: 4,
    trigger: "a Dominate spell — a will stronger than yours seizing your own",
    effect: "You are leashed to the caster — still wholly yourself, but unable to act against their will — until it breaks.",
    desc: "Every thought is still your own; your body simply will not turn against the one who holds the leash." },
  "Enthralled": { polarity: "debuff", tier: "mythical", duration: null,
    trigger: "a Dominate spell that took hold — a will leashed, not broken",
    effect: "PERMANENTLY bound to the dominator: you keep your own mind, traits, and grudges but cannot act against them — until they die or release you, or another caster's Dispel beats them in a contest of wills.",
    desc: "You are entirely yourself — every loyalty and spite intact — yet your will simply cannot be raised against the one who holds your leash." },
  "Hexed":      { polarity: "debuff", tier: "rare", duration: 60,
    trigger: "a witch's minor curse, an ill-omen, a broken taboo",
    effect: "Fortune turns against you — worse rolls and lowered critical chance for a time.",
    desc: "A petty curse dogs your steps; luck has soured." },

  // ---- Very Rare: crippling magic ----
  "Cursed":     { polarity: "debuff", tier: "very-rare", blocksHealing: true, duration: null,
    trigger: "a true hex, defiled ground, a wronged spirit, a cursed relic",
    effect: "Halves the healing you receive and STOPS natural regen until the curse is lifted.",
    desc: "A malign working clings to you, fouling every mending hand." },
  "Blinded":    { polarity: "debuff", tier: "very-rare", duration: 12,
    trigger: "ash or sand in the eyes, a blinding flash, a wound to the face",
    effect: "Sight gone — your accuracy collapses and you can scarcely find your way.",
    desc: "Darkness swallows your vision; you fight and walk by sound and touch alone." },
  "Enfeebled":  { polarity: "debuff", tier: "very-rare", duration: 90,
    trigger: "a draining spell, a soul-leech, a vampiric strike",
    effect: "Strength and vitality sapped hard — much reduced damage and toughness.",
    desc: "Something has drunk deep of your vigor; you are a shadow of your strength." },
  "Petrified":  { polarity: "debuff", tier: "very-rare", blocksHealing: true, duration: null,
    trigger: "a basilisk or gorgon's gaze, petrifying magic",
    effect: "Turned to stone — you cannot act at all until the spell is broken.",
    desc: "Cold stone creeps over your flesh and locks you in place." },

  // ---- Epic: grievous, lasting harm ----
  "Severed Limb":    { polarity: "debuff", tier: "epic", blocksHealing: true, duration: null,
    trigger: "a cleaving blow, a beast's bite, an executioner's axe",
    effect: "A maiming — STOPS natural healing and will not mend without major surgery or magic.",
    desc: "A limb is gone or ruined; the loss will shape every fight to come." },
  "Gravely Wounded": { polarity: "debuff", tier: "epic", duration: null,
    trigger: "being beaten to the very brink of death",
    effect: "Slow to recover — rest and tend yourself before you push on; healing crawls.",
    desc: "You were broken near to death and your body is far from whole." },
  "Plague-Ridden":   { polarity: "debuff", tier: "epic", blocksHealing: true, dotPerHour: 3, duration: null,
    trigger: "a virulent pestilence, a plague-pit, a corpse-borne contagion",
    effect: "Wastes you (3 vitality/hour), STOPS healing, and can spread to others until cured.",
    desc: "A killing plague burns through you, and any near you are at risk." },

  // ---- Legendary+: dooms and maledictions of the great powers ----
  "Soul-Bound":     { polarity: "debuff", tier: "legendary", duration: null,
    trigger: "a lich's phylactery bond, a binding pact, a stolen name",
    effect: "Your fate is tethered to another — grievous harm if the bond is struck or broken.",
    desc: "Some part of you is held elsewhere, beyond your reach." },
  "Doomed":         { polarity: "debuff", tier: "legendary", duration: null,
    trigger: "a death-god's mark, a true prophecy of doom, a banshee's wail",
    effect: "Fortune forsakes you utterly — the world seems to bend toward your undoing.",
    desc: "A sentence hangs over you; you feel the cold weight of an appointed end." },
  "Withering Curse": { polarity: "debuff", tier: "mythical", blocksHealing: true, dotPerHour: 2, duration: null,
    trigger: "a dragon's malediction, an archfiend's hex, profaning a god",
    effect: "Wastes you away (2 vitality/hour), STOPS healing, and gnaws at your very limits.",
    desc: "You are unmaking, hour by hour — flesh, strength, and life thinning toward nothing." },
  "Damned":         { polarity: "debuff", tier: "divine", blocksHealing: true, duration: null,
    trigger: "a god's condemnation, breaking a sacred oath, ultimate sacrilege",
    effect: "The holy refuses you — blessings and divine healing will not touch you, and regen stops.",
    desc: "Heaven has turned its face away; no grace will reach you while the damnation holds." },

  // ---- Need conditions — engine-managed by hunger/thirst/sleep thresholds ----
  "Hungry":    { polarity: "debuff", tier: "common", isNeed: true, duration: null,
    trigger: "hunger falling below 30",
    effect: "A gnawing distraction. Eat before it becomes starvation.",
    desc: "Your stomach complains and your attention wanders to food." },
  "Starving":  { polarity: "debuff", tier: "uncommon", isNeed: true, blocksHealing: true, duration: null,
    trigger: "hunger falling below 10",
    effect: "You're failing — and starvation STOPS your wounds from healing. Eat now.",
    desc: "Hollow and shaking; every step costs more than the last." },
  "Thirsty":   { polarity: "debuff", tier: "common", isNeed: true, duration: null,
    trigger: "thirst falling below 30",
    effect: "Dry-mouthed and flagging. Find water before it worsens.",
    desc: "Your throat is parched and your head begins to ache." },
  "Parched":   { polarity: "debuff", tier: "uncommon", isNeed: true, blocksHealing: true, duration: null,
    trigger: "thirst falling below 10",
    effect: "Dangerously dry — and it STOPS natural healing. Drink now.",
    desc: "Your tongue is swollen and the world swims; you need water badly." },
  "Tired":     { polarity: "debuff", tier: "common", isNeed: true, duration: null,
    trigger: "sleep falling below 30",
    effect: "Heavy-eyed and slow. Rest in a bedroll before exhaustion sets in.",
    desc: "Your eyelids drag and your thoughts come slower." },
  "Exhausted": { polarity: "debuff", tier: "uncommon", isNeed: true, blocksHealing: true, duration: null,
    trigger: "sleep falling below 10",
    effect: "Barely upright — STOPS natural healing and slows your travel. Rest, or you'll drop.",
    desc: "You can scarcely stay on your feet; sleep, or you will fall where you stand." },

  // ============================= BUFFS =============================

  // ---- Common: comfort and recovery ----
  "Well-Fed": { polarity: "buff", tier: "common", regenPerHour: 0.5, duration: 240,
    trigger: "a full, hearty meal — fresh food or a proper cooked dish",
    effect: "Comfortable and steady; a small boost to natural vitality recovery (+0.5/hour).",
    desc: "A warm, full belly leaves you content and sure on the road." },
  "Rested":   { polarity: "buff", tier: "common", regenPerHour: 1, duration: 240,
    trigger: "a real night's sleep in a bedroll or a bed",
    effect: "Clear-headed and sure-footed; quickened recovery (+1 vitality/hour).",
    desc: "Sleep has knit you back together; you wake renewed." },
  "Warmed":   { polarity: "buff", tier: "common", duration: 120,
    trigger: "a fire, dry shelter, a hot meal, or drying off",
    effect: "Shrugs off the cold — clears or wards against Chilled and Wet, steadies your aim.",
    desc: "Heat seeps back into your hands and the shivering stops." },

  // ---- Uncommon: the heat of battle ----
  "Rallied":    { polarity: "buff", tier: "uncommon", duration: 120,
    trigger: "a battle-cry, a leader's command, a turning point in a fight",
    effect: "Blood up — increased outgoing damage while it lasts.",
    desc: "Heartened and emboldened, you press the fight with extra fire." },
  "Focused":    { polarity: "buff", tier: "uncommon", duration: 120,
    trigger: "a steadying breath, a moment of calm, a clear mind",
    effect: "Sharp-eyed — raised critical chance and accuracy.",
    desc: "The noise falls away and your aim narrows to a single point." },
  "Emboldened": { polarity: "buff", tier: "uncommon", duration: 60,
    trigger: "a stirring speech, a small victory, drink and good company",
    effect: "Resists fear and steadies the will; a slight edge to your blows.",
    desc: "Your courage is up and your doubts are quiet." },
  "Guarded":    { polarity: "buff", tier: "uncommon", duration: 30,
    trigger: "a braced defensive stance, a shield wall, a ward of arms",
    effect: "Increased armor — reduced incoming physical damage for a time.",
    desc: "Set and ready, you weather blows that would have landed clean." },

  // ---- Rare: blessings and quickening ----
  "Blessed":      { polarity: "buff", tier: "rare", regenPerHour: 0.5, duration: 240,
    trigger: "a priest's blessing, a shrine, a holy rite",
    effect: "Fortune and protection — a small all-round boon and faster recovery (+0.5/hour).",
    desc: "A grace lies on you, fortune and protection at your shoulder." },
  "Inspired":     { polarity: "buff", tier: "rare", duration: 120,
    trigger: "a muse, a bard's song, awe, or a flash of insight",
    effect: "Sharper mind — faster resolve recovery and quicker learning.",
    desc: "Your thoughts run bright and clear, ideas arriving unbidden." },
  "Regenerating": { polarity: "buff", tier: "rare", regenPerHour: 3, duration: 60,
    trigger: "a mending draught, regeneration magic, troll-blood, nature's gift",
    effect: "Knits flesh fast — heals an extra 3 vitality each hour while it holds.",
    desc: "Your wounds close before your eyes, flesh closing over hurt." },
  "Hardy":        { polarity: "buff", tier: "rare", regenPerHour: 0.5, duration: 240,
    trigger: "a survivalist's tonic, hard conditioning, a vigor draught",
    effect: "Tough and enduring — damage reduction and slower-creeping needs.",
    desc: "Weather, hunger, and blows all bite a little less for a while." },

  // ---- Very Rare: high sorcery ----
  "Warded":    { polarity: "buff", tier: "very-rare", duration: 120,
    trigger: "a ward spell, a protective charm, a runic sigil",
    effect: "Raised ward — a strong buffer against magical damage.",
    desc: "A shimmer of protection turns aside the worst of hostile magic." },
  "Hastened":  { polarity: "buff", tier: "very-rare", duration: 10, travelSpeedMult: 1.5,
    trigger: "a haste spell, an adrenal surge, a time-quickening",
    effect: "Quickened — you (and your mount) travel far faster, you act more often, and you dodge more readily. Speed only; it never tires you faster.",
    desc: "The world slows around you while you move at a blur." },
  "Bear's Strength": { polarity: "buff", tier: "rare", duration: 120, carryBonus: 60, rideCapacityBonus: 80,
    trigger: "a strength boon, a bestial enchantment, an ogre-might draught",
    effect: "Beast-thewed — you haul far more weight, and the mount you ride bears a heavier load, until it fades.",
    desc: "Your muscles swell with borrowed might; burdens feel like nothing." },
  "Empowered": { polarity: "buff", tier: "very-rare", duration: 60,
    trigger: "a power ritual, drawing on ley-lines, a font of magic",
    effect: "Magic surges — increased spell damage and penetration.",
    desc: "Power crackles at your fingertips, eager to be loosed." },

  // ---- Epic: heroic and sanctified ----
  "Heroic":   { polarity: "buff", tier: "epic", regenPerHour: 1, duration: 60,
    trigger: "a legendary deed, a hero's resolve, a desperate last stand",
    effect: "Raised across the board — better damage, defence, and recovery for a time.",
    desc: "Something greater rises in you; for now you fight like a legend." },
  "Anointed": { polarity: "buff", tier: "epic", regenPerHour: 1, duration: 240,
    trigger: "a high rite, sanctified oil, a champion's consecration",
    effect: "A potent holy ward and amplified healing while the blessing holds.",
    desc: "Marked and sanctified, you carry a portion of the divine." },

  // ---- Legendary+: the favor (or fury) beyond mortal ----
  "Divine Favor": { polarity: "buff", tier: "legendary", regenPerHour: 2, duration: 240,
    trigger: "a god's direct favor, answering a true prayer, a saint's intercession",
    effect: "Fortune, protection, and might far beyond a mortal blessing.",
    desc: "A god has turned its gaze upon you — and found you worthy." },
  "Berserk":      { polarity: "buff", tier: "legendary", duration: 10,
    trigger: "a blood-rage, a berserker's fury, the red mist of battle",
    effect: "Enormous outgoing damage — but reckless, with your defences thrown open.",
    desc: "Fury takes you; you feel no fear and no pain, only the kill." },
  "Dragon-Heart": { polarity: "buff", tier: "mythical", regenPerHour: 5, duration: 480,
    trigger: "a dragon's boon, or devouring the still-warm heart of a slain wyrm",
    effect: "Vast vitality and recovery, resistance to fire, and a dread presence.",
    desc: "A wyrm's fire burns in your chest; lesser things flinch from your shadow." },
  "Ascendant":    { polarity: "buff", tier: "divine", regenPerHour: 10, duration: 30,
    trigger: "apotheosis, a god's avatar, drawing on a divine artifact's full power",
    effect: "Godlike for a brief span — all faculties vastly raised and near-untouchable.",
    desc: "For a few breaths you are more than mortal, and the world bends to your will." },
};

const DEFAULT_META = { polarity: "neutral", tier: "common", blocksHealing: false, dotPerHour: 0, regenPerHour: 0, isNeed: false, duration: null, trigger: null, effect: null, desc: null };

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
