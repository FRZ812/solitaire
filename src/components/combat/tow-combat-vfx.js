import afflictAsset from "../../assets/generated/winter-tower/vfx/afflict-v1.png";
import arcaneAsset from "../../assets/generated/winter-tower/vfx/arcane-v1.png";
import evadeAsset from "../../assets/generated/winter-tower/vfx/evade-v1.png";
import fireAsset from "../../assets/generated/winter-tower/vfx/fire-v1.png";
import frostAsset from "../../assets/generated/winter-tower/vfx/frost-v1.png";
import gashAsset from "../../assets/generated/winter-tower/vfx/gash-v1.png";
import healAsset from "../../assets/generated/winter-tower/vfx/heal-v1.png";
import impactAsset from "../../assets/generated/winter-tower/vfx/impact-v1.png";
import lightningAsset from "../../assets/generated/winter-tower/vfx/lightning-v1.png";
import pierceAsset from "../../assets/generated/winter-tower/vfx/pierce-v1.png";
import slashAsset from "../../assets/generated/winter-tower/vfx/slash-v1.png";
import wardAsset from "../../assets/generated/winter-tower/vfx/ward-v1.png";
import windAsset from "../../assets/generated/winter-tower/vfx/wind-v1.png";
import witchBoneShieldIcon from "../../assets/generated/winter-tower/abilities/witch-bone-shield-v1.webp";
import witchForbiddenRitualIcon from "../../assets/generated/winter-tower/abilities/witch-forbidden-ritual-v1.webp";
import witchHellfireSpiritIcon from "../../assets/generated/winter-tower/abilities/witch-hellfire-spirit-v1.webp";
import witchLimitedLifeSentenceIcon from "../../assets/generated/winter-tower/abilities/witch-limited-life-sentence-v1.webp";
import witchMirrorImageIcon from "../../assets/generated/winter-tower/abilities/witch-mirror-image-v1.webp";
import witchVoidMonsterIcon from "../../assets/generated/winter-tower/abilities/witch-void-monster-v1.webp";

import statusAfflictions from "../../assets/generated/winter-tower/status/afflictions-v1.png";
import statusAttackModifiers from "../../assets/generated/winter-tower/status/attack-modifiers-v1.png";
import statusControl from "../../assets/generated/winter-tower/status/control-v1.png";
import statusDebilitation from "../../assets/generated/winter-tower/status/debilitation-v1.png";
import statusDefense from "../../assets/generated/winter-tower/status/defense-v1.png";
import statusOffense from "../../assets/generated/winter-tower/status/offense-v1.png";
import statusResolve from "../../assets/generated/winter-tower/status/resolve-v1.png";
import statusResources from "../../assets/generated/winter-tower/status/resources-v1.png";
import statusSummonExecution from "../../assets/generated/winter-tower/status/summon-execution-v1.png";
import statusSustain from "../../assets/generated/winter-tower/status/sustain-v1.png";
import statusTempo from "../../assets/generated/winter-tower/status/tempo-v1.png";
import { getSkill, skillIds } from "../../gameplay/tow/skills.js";
import { resolveTowIntentArt } from "./tow-combat-ability-art.js";

const GENERATED_FLIPBOOK_MODULES = import.meta.glob(
  "../../assets/generated/winter-tower/vfx/flipbooks/*-v1.webp",
  { eager: true, import: "default" },
);

export const COMBAT_VFX_FLIPBOOK_ASSETS = Object.freeze(Object.fromEntries(
  Object.entries(GENERATED_FLIPBOOK_MODULES).map(([modulePath, asset]) => {
    const id = modulePath.match(/\/([^/]+)-v1\.webp$/)?.[1];
    return [id, asset];
  }).filter(([id]) => Boolean(id)),
));

const FLIPBOOK_IDS_BY_LENGTH = Object.freeze(
  Object.keys(COMBAT_VFX_FLIPBOOK_ASSETS).sort((left, right) => right.length - left.length),
);

function flipbookIdForVariant(variant) {
  if (!variant) return null;
  if (COMBAT_VFX_FLIPBOOK_ASSETS[variant]) return variant;
  return FLIPBOOK_IDS_BY_LENGTH.find((id) => variant.startsWith(`${id}-`))
    || (COMBAT_VFX_FLIPBOOK_ASSETS.strike ? "strike" : FLIPBOOK_IDS_BY_LENGTH[0])
    || null;
}

function flipbookForId(id, frameRange = null) {
  const asset = id && COMBAT_VFX_FLIPBOOK_ASSETS[id];
  if (!asset) return null;
  return Object.freeze({
    id,
    asset,
    frameCount: 9,
    frameSize: 256,
    fps: 18,
    layout: "horizontal",
    ...(frameRange ? { frameRange: Object.freeze([...frameRange]) } : {}),
  });
}

// Kept as a compatibility manifest for old intent-card and external UI consumers. The
// battlefield renderer never reads these static emblems; it samples generated flipbooks.
export const COMBAT_VFX_ASSETS = Object.freeze({
  afflict: afflictAsset,
  arcane: arcaneAsset,
  evade: evadeAsset,
  fire: fireAsset,
  frost: frostAsset,
  gash: gashAsset,
  heal: healAsset,
  impact: impactAsset,
  lightning: lightningAsset,
  pierce: pierceAsset,
  slash: slashAsset,
  ward: wardAsset,
  wind: windAsset,
});

export const STATUS_ICON_ASSETS = Object.freeze({
  afflictions: statusAfflictions,
  "attack-modifiers": statusAttackModifiers,
  control: statusControl,
  debilitation: statusDebilitation,
  defense: statusDefense,
  offense: statusOffense,
  resolve: statusResolve,
  resources: statusResources,
  "summon-execution": statusSummonExecution,
  sustain: statusSustain,
  tempo: statusTempo,
});

function effect(family, variant, motion = "balanced", choreography = null, palette = null) {
  return Object.freeze({ family, variant, motion, choreography, palette });
}

const FAMILY_PALETTES = Object.freeze({
  afflict: Object.freeze(["#f4ddff", "#a45ad0", "#311041"]),
  arcane: Object.freeze(["#f0eaff", "#8f78ed", "#25175f"]),
  evade: Object.freeze(["#e6fff8", "#75d8c3", "#174e4b"]),
  fire: Object.freeze(["#fff1c7", "#ff6b2c", "#7b160d"]),
  frost: Object.freeze(["#f1fdff", "#7edff4", "#1c5278"]),
  gash: Object.freeze(["#fff0f2", "#d72e51", "#530819"]),
  heal: Object.freeze(["#f0ffd8", "#91d96b", "#285525"]),
  impact: Object.freeze(["#fff2ce", "#e9a848", "#65401d"]),
  lightning: Object.freeze(["#f4fdff", "#65d7ff", "#254d92"]),
  mechanical: Object.freeze(["#fff1cc", "#d99a43", "#4f2f17"]),
  nature: Object.freeze(["#d8f8d8", "#5eae62", "#183e1c"]),
  pierce: Object.freeze(["#f2feff", "#72cfea", "#22536b"]),
  radiant: Object.freeze(["#fff9db", "#fab005", "#874b00"]),
  slash: Object.freeze(["#fff7e8", "#f0785c", "#67231f"]),
  toxic: Object.freeze(["#c7f9cc", "#57cc99", "#22577a"]),
  void: Object.freeze(["#f0e6ff", "#9b5de5", "#240046"]),
  ward: Object.freeze(["#effcff", "#79cee8", "#234e70"]),
  wind: Object.freeze(["#ebfff9", "#73cfb7", "#215b55"]),
});

// Status ticks, item reactions, and plan-only aliases are not separate abilities, so they
// reuse the closest authored ability flipbook instead of falling back to procedural marks.
// Every current skill still resolves to its own exact `${skillId}-v1.webp` atlas first.
const FAMILY_FLIPBOOK_IDS = Object.freeze({
  afflict: "blade-of-curse",
  arcane: "mage-magic-arrow",
  evade: "emergency-evasion",
  fire: "incineration",
  frost: "rapid-cooling",
  gash: "slaughter",
  heal: "first-aid",
  impact: "sudden-blow",
  lightning: "rising-power",
  mechanical: "automaton-impact-cannon",
  nature: "mage-thorn-veil",
  pierce: "penetration",
  radiant: "priestess-holy-shock",
  slash: "strike",
  toxic: "demon-poison-bottle",
  void: "witch-void-monster",
  ward: "block",
  wind: "north-king-whirlwind",
});

function prefixedChoreographies(prefix, entries) {
  return Object.fromEntries(Object.entries(entries).map(([id, choreography]) => [
    `${prefix}-${id}`,
    choreography,
  ]));
}

// The authoritative catalogue is deliberately explicit. Choreographies share optimized
// drawing primitives, while every skill still receives its own seeded profile and signature.
const AUTHORED_CHOREOGRAPHIES = Object.freeze({
  strike: "single-sweep",
  "shield-bash": "impact-rings",
  slaughter: "wound-rip",
  block: "ward-arc",
  "defensive-stance": "fortress-barrier",
  parry: "counter-sweep",
  "threatening-cry": "soul-shockwave",
  "mortal-blow": "execution-line",
  "giants-smash": "ground-fracture",
  "deliberate-blow": "heavy-sweep",
  warcry: "rage-surge",
  "fist-of-justice": "impact-rings",
  retaliation: "counter-sweep",
  incineration: "flame-rise",
  "emergency-evasion": "afterimage-dash",
  "elixir-of-wrath": "rage-surge",
  "first-aid": "regeneration-rise",
  impregnable: "fortress-barrier",
  "judge-of-fate": "fate-clock",
  penetration: "armor-break",
  "rapid-cooling": "frost-shatter",
  "rising-power": "charge-surge",
  shouting: "soul-shockwave",
  "sleep-grenade": "sleep-drift",
  "sudden-blow": "impact-rings",
  "thirst-for-blood": "siphon-stream",
  transcendence: "awakening-burst",
  "unbendable-will": "unyielding-rise",
  "urgent-guard": "ward-arc",
  "stone-skin-elixir": "fortress-barrier",
  "protection-scroll": "ward-arc",
  "killing-instinct": "focus-gleam",
  "blade-of-curse": "death-claw-slash",
  beastification: "rage-surge",
  "super-speed": "haste-streak",
  "peace-declaration": "silencing-line",

  ...prefixedChoreographies("arctic", {
    strike: "frost-sweep",
    block: "fortress-barrier",
    "shield-bash": "impact-rings",
    slaughter: "wound-rip",
    parry: "counter-sweep",
    "defensive-stance": "fortress-barrier",
    "threatening-cry": "soul-shockwave",
    "mortal-blow": "execution-line",
    "gather-strength": "charge-surge",
    "battle-cry": "rage-surge",
    "cross-slash": "cross-cut",
    "giants-smash": "ground-fracture",
    "deliberate-blow": "heavy-sweep",
    "thirst-for-blood": "siphon-stream",
    "fist-of-justice": "impact-rings",
    "brutal-slash": "armor-break",
    "triple-slash": "strike-combo",
    retaliation: "counter-sweep",
    "decisive-warcry": "soul-shockwave",
    "secret-blow": "projectile-line",
    "iron-wall-defense": "fortress-barrier",
    incineration: "ember-sweep",
    "ultimate-body": "aegis-radiance",
  }),

  ...prefixedChoreographies("demon", {
    shoot: "projectile-line",
    evasion: "afterimage-dash",
    "rapid-fire": "projectile-barrage",
    "precise-shot": "focus-gleam",
    deflection: "counter-sweep",
    improvisation: "afterimage-dash",
    "apply-poison": "poison-wisp",
    kick: "impact-rings",
    "poison-bottle": "toxic-burst",
    "evasive-shot": "afterimage-dash",
    "triple-shot": "projectile-barrage",
    catalyst: "toxic-burst",
    snipe: "railgun-line",
    "smoke-bomb": "mist-disperse",
    "eagle-eye": "vulnerable-target",
    "arrow-rain": "projectile-rain",
    "trackers-net": "binding-lines",
    "ultimate-venom": "toxic-burst",
    overwhelm: "strike-combo",
    "d-day": "fate-clock",
    "high-speed-shooting": "ballistic-burst",
    "shadow-stealth": "mist-disperse",
    "endless-grudge": "projectile-barrage",
  }),

  ...prefixedChoreographies("mage", {
    "magic-arrow": "projectile-line",
    barrier: "ward-arc",
    incinerate: "flame-rise",
    "blood-sword": "single-sweep",
    "life-drain": "siphon-stream",
    "blood-protection": "blood-ward",
    regeneration: "regeneration-rise",
    blink: "afterimage-dash",
    "thorn-veil": "thorn-growth",
    ignition: "flame-rise",
    "arrow-of-harmony": "projectile-line",
    fear: "soul-shockwave",
    overload: "overload-spark",
    "destruction-ray": "beam-line",
    "flame-storm": "blood-maelstrom",
    "mana-concentration": "charge-surge",
    "ancient-curse": "forbidden-glyph",
    "blood-judgment": "judgment-pillar",
    invincible: "aegis-radiance",
    disintegrate: "beam-line",
    "god-slaying-spear": "judgment-pillar",
    amplification: "growth-rings",
    regression: "time-warp",
  }),

  ...prefixedChoreographies("priestess", {
    crush: "impact-rings",
    block: "ward-arc",
    "holy-shock": "lightning-fork",
    "blow-of-composure": "impact-rings",
    counter: "counter-sweep",
    "holy-shield": "fortress-barrier",
    "instant-heal": "regeneration-rise",
    "weapon-of-judgment": "focus-gleam",
    "hour-of-judgment": "fate-clock",
    "wrath-of-heaven": "judgment-pillar",
    "divine-favor": "radiant-fall",
    "divine-barrier": "fortress-barrier",
    intercession: "ward-arc",
    "holy-smite": "judgment-pillar",
    purification: "radiant-fall",
    "immediate-judgment": "judgment-pillar",
    oracle: "focus-gleam",
    doom: "doom-collapse",
    "holy-binding": "binding-lines",
    "greater-heal": "regeneration-rise",
    trinity: "aegis-radiance",
    "power-of-god": "rage-surge",
    immortality: "aegis-radiance",
  }),

  ...prefixedChoreographies("assassin", {
    flurry: "knife-combo",
    deflect: "counter-sweep",
    "hamstring-cut": "low-sweep",
    mutilate: "wound-rip",
    "weapon-block": "ward-arc",
    acrobatics: "afterimage-dash",
    "double-slash": "cross-cut",
    feint: "afterimage-dash",
    "boost-up": "haste-streak",
    "decisive-blow": "execution-line",
    "leg-cut": "low-sweep",
    "total-defense": "fortress-barrier",
    ambush: "shadow-lunge",
    "perfect-plan": "focus-gleam",
    "storm-of-knives": "knife-combo",
    "finishing-blow": "execution-line",
    "perfect-opportunity": "vulnerable-target",
    "flash-cut": "flash-cut",
    execution: "execution-line",
    "cold-blood": "focus-gleam",
    "flash-bomb": "explosion-burst",
    "shadow-strike": "shadow-lunge",
    "life-saving-pill": "regeneration-rise",
  }),

  ...prefixedChoreographies("north-king", {
    cleave: "heavy-sweep",
    vitality: "regeneration-rise",
    "sweeping-blow": "single-sweep",
    smash: "ground-fracture",
    endure: "unyielding-rise",
    headbutt: "impact-rings",
    charge: "haste-streak",
    "bears-blessing": "rage-surge",
    "boulder-toss": "projectile-line",
    "battle-instinct": "focus-gleam",
    whirlwind: "wind-spiral",
    "power-of-earth": "ground-fracture",
    intimidation: "soul-shockwave",
    "warriors-oath": "aegis-radiance",
    "neutralizing-blow": "impact-rings",
    "reckless-blow": "heavy-sweep",
    maelstrom: "wind-spiral",
    rampage: "strike-combo",
    "natures-intervention": "growth-rings",
    "bear-trap": "binding-lines",
    "crumbling-blow": "armor-break",
    earthquake: "ground-fracture",
    "beasts-heart": "rage-surge",
  }),

  ...prefixedChoreographies("clocktower", {
    fire: "projectile-line",
    "suppressive-shot": "ballistic-burst",
    "binding-shot": "binding-lines",
    "fusion-shot": "beam-line",
    "cloaking-field": "afterimage-dash",
    "fusion-barrier": "forcefield-grid",
    "grappling-hook": "projectile-line",
    "high-voltage": "lightning-fork",
    "armor-piercing-round": "armor-break",
    "ultra-barrier": "fortress-barrier",
    "grenade-toss": "explosion-burst",
    improvement: "gear-surge",
    preparation: "focus-gleam",
    "tailored-drink": "growth-rings",
    reinforcement: "ward-arc",
    buckshot: "projectile-barrage",
    "missile-support": "projectile-barrage",
    "steel-net": "binding-lines",
    "mysterious-stopwatch": "time-warp",
    "chain-explosion": "explosion-burst",
    "critical-weakness": "vulnerable-target",
    "time-machine": "time-warp",
    redesign: "gear-surge",
  }),

  ...prefixedChoreographies("witch", {
    attack: "projectile-line",
    "bone-shield": "bone-ward",
    "vampiric-touch": "siphon-stream",
    "skull-throw": "projectile-line",
    "ghost-form": "afterimage-dash",
    "curse-of-aging": "lethargy-shackle",
    "skeleton-summon": "summon-rise",
    "touch-of-the-dead": "doom-collapse",
    "demons-sigil": "forbidden-glyph",
    "battering-ram": "impact-rings",
    proliferation: "summon-rise",
    "reapers-scythe": "death-claw-slash",
    "void-monster": "void-tendrils",
    "skeleton-defense": "bone-ward",
    nullification: "arcane-trace",
    "mirror-image": "mirror-shimmer",
    "all-out-attack": "projectile-barrage",
    "human-wave-tactics": "summon-rise",
    "gate-underworld": "void-tendrils",
    "forbidden-ritual": "forbidden-glyph",
    "hellfire-spirit": "hellfire-rise",
    "bone-sphere": "projectile-line",
    "limited-life-sentence": "fate-clock",
  }),

  ...prefixedChoreographies("sleepless", {
    swing: "single-sweep",
    "hard-scales": "fortress-barrier",
    "flame-strike": "ember-sweep",
    "spinning-strike": "wind-spiral",
    "steel-scales": "ward-arc",
    "flame-curtain": "curtain-rise",
    detonation: "explosion-burst",
    acceleration: "haste-streak",
    "fire-rain": "projectile-rain",
    "entangling-roots": "thorn-growth",
    "mark-of-the-wild": "growth-rings",
    "essence-torrent": "projectile-barrage",
    "water-totem": "growth-rings",
    "cool-composure": "growth-rings",
    "tail-swipe": "heavy-sweep",
    transference: "siphon-stream",
    "predators-instinct": "focus-gleam",
    "gale-totem": "wind-spiral",
    "fire-dragons-breath": "flame-rise",
    breakthrough: "armor-break",
    hardening: "fortress-barrier",
    "fire-essence": "flame-rise",
    "high-speed-flight": "afterimage-dash",
  }),

  ...prefixedChoreographies("blade", {
    slash: "single-sweep",
    riposte: "counter-sweep",
    inversion: "cross-cut",
    "killers-sword": "execution-line",
    "flash-step": "afterimage-dash",
    barrier: "ward-arc",
    "quick-swordsmanship": "haste-streak",
    "double-slash": "cross-cut",
    "killing-intent-release": "rage-surge",
    "secret-sword": "focus-gleam",
    domain: "aura-current",
    "steal-the-flow": "siphon-stream",
    "flying-sword": "projectile-line",
    "katana-dance": "strike-combo",
    "sword-qi": "aura-current",
    "mountain-of-blades": "projectile-rain",
    "latent-power": "charge-surge",
    "selfless-state": "growth-rings",
    "chi-liberation": "awakening-burst",
    "instant-kill": "execution-line",
    breakthrough: "armor-break",
    "one-flash": "flash-cut",
    "flowing-water": "rolling-wave",
  }),

  ...prefixedChoreographies("vampire", {
    claw: "claw-trails",
    "blood-thirst": "blood-orbit",
    sever: "sever-line",
    bite: "bite-collapse",
    "mist-form": "mist-disperse",
    "blood-whirlwind": "blood-maelstrom",
    "super-regeneration": "regeneration-rise",
    "blood-hunger": "hunger-pulse",
    transformation: "metamorphosis-split",
    backflow: "blood-backflow",
    "soul-scream": "soul-shockwave",
    "blood-spear": "blood-lance",
    "heart-destroyer": "heart-pierce",
    "bloodflow-absorption": "siphon-stream",
    "blood-barrier": "blood-ward",
    "rain-of-death": "blood-rain",
    devour: "devour-collapse",
    "tear-wound": "wound-rip",
    "cruel-touch": "cruel-tendrils",
    "endless-will": "unyielding-rise",
    awakening: "awakening-burst",
    rampage: "rampage-combo",
    "ancestral-blood": "ancestral-current",
  }),

  ...prefixedChoreographies("automaton", {
    bombardment: "projectile-barrage",
    repair: "nanite-swarm",
    "pulverizing-cannon": "explosion-burst",
    "impact-cannon": "impact-rings",
    "force-field": "forcefield-grid",
    interception: "counter-sweep",
    "heat-emission": "flame-rise",
    "barrel-cooling": "frost-shatter",
    "shock-grenade": "overload-spark",
    "attack-stance": "focus-gleam",
    "chain-cannon": "ballistic-burst",
    "precision-analysis": "vulnerable-target",
    "electromagnetic-field": "lightning-bind",
    "aim-correction": "focus-gleam",
    flash: "flash-cut",
    "scorched-earth": "explosion-burst",
    "emergency-cooling": "frost-shatter",
    "rapid-acceleration": "haste-streak",
    crossfire: "projectile-barrage",
    "final-counter": "counter-sweep",
    "emergency-fuel": "charge-surge",
    "fate-manipulator": "time-warp",
    "infinite-power": "aegis-radiance",
  }),

  "status-thorn": "thorn-growth",
  "status-lifesteal": "siphon-stream",
  "status-bleed": "blood-drip",
  "status-bleed-atk": "wound-rip",
  "status-burn": "flame-rise",
  "status-poison": "poison-wisp",
  "status-poison-atk": "poison-wisp",
  "status-doom": "doom-collapse",
  "status-doom-atk": "doom-collapse",
  "status-paralyze": "lightning-bind",
  "status-stun": "impact-stagger",
  "status-sleep": "sleep-drift",
  "status-confuse": "confusion-swirl",
  "status-confusion": "confusion-swirl",
  "status-lethargy": "lethargy-shackle",
  "status-lethargy-atk": "lethargy-shackle",
  "status-weak": "binding-lines",
  "status-cripple": "cripple-shatter",
  "status-vulnerable": "vulnerable-target",
  "status-limp": "limp-drag",
  "status-misfortune": "fate-threads",
  "status-mirror-image": "mirror-shimmer",
  "status-bone-shield": "bone-ward",
  "status-hellfire-spirit": "hellfire-rise",
  "status-void-monster": "void-tendrils",
  "status-limited-life-sentence": "fate-clock",
  "status-forbidden-ritual": "forbidden-glyph",
  "status-foul-ceremony": "forbidden-glyph",
  "status-skeleton": "summon-rise",
  "status-wind-blade": "wind-spiral",
  "status-counter-attack": "counter-sweep",
  "status-parry": "counter-sweep",
  "status-death-claw": "death-claw-slash",
  "status-injured": "wound-rip",
});

// The supplied design document also names forward-compatible aliases that are not yet in the
// source-backed 1.4.16 skill table. Keeping them authored makes replay/imported encounters and
// future catalogue migrations render correctly instead of dropping to a generic placeholder.
const PLANNED_ONLY_CHOREOGRAPHIES = Object.freeze({
  ...prefixedChoreographies("assassin", {
    stealth: "mist-disperse",
    "poison-coat": "poison-wisp",
    "venom-strike": "toxic-burst",
    "shadow-dance": "shadow-combo",
    "vital-strike": "focus-gleam",
    "smoke-screen": "mist-disperse",
    "smoke-bomb": "explosion-burst",
    backstab: "shadow-lunge",
    "silent-kill": "execution-line",
    adrenaline: "haste-streak",
    "blade-dance": "wind-spiral",
    "shadow-clone": "mirror-shimmer",
    "grand-finale": "strike-combo",
  }),
  ...prefixedChoreographies("mage", {
    parry: "counter-sweep",
    concentration: "charge-surge",
    "frost-arrow": "projectile-line",
    "chain-lightning": "lightning-fork",
    "mana-burn": "flame-rise",
    "ice-barrier": "fortress-barrier",
    "arcane-blast": "explosion-burst",
    "spell-vamp": "siphon-stream",
    meteor: "projectile-rain",
    blizzard: "frost-shatter",
    "thunder-god": "judgment-pillar",
    "mana-surge": "awakening-burst",
    "time-warp": "time-warp",
    disintegration: "beam-line",
    "absolute-zero": "frost-shatter",
    "avatar-of-magic": "awakening-burst",
  }),
  ...prefixedChoreographies("priestess", {
    "healing-light": "regeneration-rise",
    smite: "judgment-pillar",
    prayer: "growth-rings",
    sanctuary: "fortress-barrier",
    blessing: "radiant-fall",
    "divine-punishment": "impact-rings",
    "holy-nova": "awakening-burst",
    aegis: "aegis-radiance",
    redemption: "regeneration-rise",
    retribution: "counter-sweep",
    resurrection: "awakening-burst",
    "divine-judgment": "judgment-pillar",
    "hymn-of-glory": "aegis-radiance",
    "angelic-wings": "radiant-fall",
    "seraphim-blade": "ember-sweep",
    miracle: "awakening-burst",
    "gods-hand": "radiant-fall",
  }),
  ...prefixedChoreographies("blade", {
    stance: "focus-gleam",
    "wind-cut": "wind-spiral",
    "moon-slash": "single-sweep",
    "cherry-blossom": "projectile-barrage",
    counter: "counter-sweep",
    "twin-dragons": "rolling-wave",
    flow: "rolling-wave",
    "sever-sky": "judgment-pillar",
    "heart-blade": "heart-pierce",
    shadowless: "shadow-combo",
    "iron-body": "fortress-barrier",
    storm: "wind-spiral",
    "thousand-cuts": "strike-combo",
    "void-cut": "doom-collapse",
    "god-speed": "haste-streak",
    zen: "growth-rings",
    "ultimate-slash": "execution-line",
    "sword-saint": "projectile-rain",
  }),
  ...prefixedChoreographies("clocktower", {
    "wrench-smash": "impact-rings",
    "shield-deploy": "forcefield-grid",
    grenade: "explosion-burst",
    turret: "ballistic-burst",
    overclock: "gear-surge",
    emp: "overload-spark",
    flamethrower: "flame-rise",
    mortar: "projectile-rain",
    "tesla-coil": "lightning-fork",
    "repair-drone": "nanite-swarm",
    "laser-cannon": "beam-line",
    "time-dilation": "time-warp",
    "artillery-barrage": "projectile-rain",
    "mecha-fist": "impact-rings",
    forcefield: "forcefield-grid",
    "super-bomb": "explosion-burst",
    "perpetual-motion": "gear-surge",
    masterpiece: "projectile-barrage",
  }),
  ...prefixedChoreographies("north-king", {
    "axe-throw": "projectile-line",
    warcry: "soul-shockwave",
    "frost-armor": "fortress-barrier",
    avalanche: "projectile-rain",
    "furious-strike": "heavy-sweep",
    intimidate: "soul-shockwave",
    "blood-pact": "rage-surge",
    "mountain-breaker": "ground-fracture",
    "frost-breath": "frost-shatter",
    glory: "aegis-radiance",
    "berserker-rage": "rage-surge",
    "valhalla-call": "summon-rise",
    juggernaut: "haste-streak",
    "glacier-smash": "frost-shatter",
    "chieftain-will": "unyielding-rise",
    fimbulwinter: "frost-shatter",
    ragnarok: "ember-sweep",
  }),
  ...prefixedChoreographies("sleepless", {
    nightmare: "doom-collapse",
    possession: "shadow-lunge",
    "wraith-touch": "siphon-stream",
    "soul-burn": "hellfire-rise",
    "shadow-veil": "mist-disperse",
    "screaming-skulls": "projectile-barrage",
    "spectral-chains": "lethargy-shackle",
    haunt: "mist-disperse",
    "nether-beam": "beam-line",
    "soul-feast": "siphon-stream",
    "phantom-step": "afterimage-dash",
    "curse-of-agony": "forbidden-glyph",
    "spirit-bomb": "explosion-burst",
    "abyssal-rift": "void-tendrils",
    "eternal-torment": "void-tendrils",
    "wraith-lord": "hellfire-rise",
    "nightmare-realm": "doom-collapse",
    "harvester-of-souls": "death-claw-slash",
  }),
  ...prefixedChoreographies("witch", {
    "curse-of-frailty": "lethargy-shackle",
    "hex-burst": "explosion-burst",
    "dark-covenant": "fate-threads",
    "abyssal-grasp": "void-tendrils",
    "witching-hour": "doom-collapse",
    apocalypse: "explosion-burst",
  }),
  ...prefixedChoreographies("automaton", {
    "piston-strike": "impact-rings",
    "iron-plating": "fortress-barrier",
    "laser-sweep": "beam-line",
    "rocket-barrage": "projectile-barrage",
    "shield-generator": "forcefield-grid",
    overdrive: "gear-surge",
    "flame-vent": "flame-rise",
    "emp-discharge": "overload-spark",
    "drill-charge": "armor-break",
    "nanite-swarm": "nanite-swarm",
    railgun: "railgun-line",
    "energy-barrier": "forcefield-grid",
    "plasma-cannon": "explosion-burst",
    "defensive-matrix": "forcefield-grid",
    "self-destruct": "explosion-burst",
    "siege-mode": "fortress-barrier",
    "orbital-laser": "orbital-pillar",
    "prime-titan": "awakening-burst",
  }),
});

const MOTION_CHOREOGRAPHIES = Object.freeze({
  afterimage: "afterimage-dash",
  ascend: "awakening-burst",
  aura: "aura-current",
  balanced: "single-sweep",
  barrage: "projectile-barrage",
  bind: "binding-lines",
  bleed: "wound-rip",
  bolt: "projectile-line",
  brace: "ward-arc",
  brand: "flame-rise",
  charge: "charge-current",
  counter: "counter-sweep",
  cross: "cross-cut",
  curtain: "curtain-rise",
  cyclone: "wind-spiral",
  execution: "execution-line",
  fate: "fate-threads",
  flash: "flash-cut",
  flurry: "strike-combo",
  fork: "lightning-fork",
  fortress: "ward-arc",
  heavy: "heavy-sweep",
  inferno: "flame-rise",
  mend: "regeneration-rise",
  measured: "single-sweep",
  multi: "strike-combo",
  peal: "impact-rings",
  pin: "projectile-line",
  projectile: "projectile-line",
  quake: "ground-fracture",
  radiant: "radiant-fall",
  rally: "rage-surge",
  rapid: "flash-cut",
  rolling: "rolling-wave",
  shadow: "shadow-lunge",
  "shadow-flurry": "shadow-combo",
  shield: "ward-arc",
  shatter: "frost-shatter",
  shout: "soul-shockwave",
  sigil: "arcane-trace",
  silence: "silencing-line",
  siphon: "siphon-stream",
  smoke: "mist-disperse",
  snap: "lightning-fork",
  summon: "summon-rise",
  thrust: "projectile-line",
  unyielding: "unyielding-rise",
  urgent: "ward-arc",
  void: "doom-collapse",
  volley: "projectile-barrage",
  weapon: "single-sweep",
});

const FAMILY_CHOREOGRAPHIES = Object.freeze({
  afflict: Object.freeze(["binding-lines", "fate-threads", "poison-wisp", "doom-collapse"]),
  arcane: Object.freeze(["arcane-trace", "summon-rise", "charge-current", "void-tendrils"]),
  evade: Object.freeze(["afterimage-dash", "mist-disperse", "flash-cut"]),
  fire: Object.freeze(["flame-rise", "curtain-rise", "ember-sweep"]),
  frost: Object.freeze(["frost-shatter", "frost-sweep", "ice-spikes"]),
  gash: Object.freeze(["sever-line", "wound-rip", "blood-drip", "claw-trails"]),
  heal: Object.freeze(["regeneration-rise", "aura-current", "ancestral-current"]),
  impact: Object.freeze(["impact-rings", "ground-fracture", "heavy-sweep", "impact-stagger"]),
  lightning: Object.freeze(["lightning-fork", "charge-current", "lightning-bind"]),
  mechanical: Object.freeze(["gear-surge", "ballistic-burst", "forcefield-grid", "time-warp"]),
  nature: Object.freeze(["thorn-growth", "growth-rings", "wind-spiral"]),
  pierce: Object.freeze(["projectile-line", "projectile-barrage", "blood-lance"]),
  radiant: Object.freeze(["radiant-fall", "judgment-pillar", "aegis-radiance"]),
  slash: Object.freeze(["single-sweep", "cross-cut", "counter-sweep", "low-sweep"]),
  toxic: Object.freeze(["poison-wisp", "toxic-burst", "binding-lines"]),
  void: Object.freeze(["doom-collapse", "void-tendrils", "forbidden-glyph"]),
  ward: Object.freeze(["ward-arc", "unyielding-rise", "bone-ward"]),
  wind: Object.freeze(["wind-spiral", "rolling-wave", "afterimage-dash"]),
});

function visualHash(value) {
  let hash = 2166136261;
  for (const character of String(value || "effect")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function visualProfile(variant) {
  const hash = visualHash(variant);
  return Object.freeze({
    key: `vfx-${hash.toString(36)}`,
    seed: hash,
    rotate: (hash % 31) - 15,
    scale: Number((0.82 + ((hash >>> 5) % 19) / 100).toFixed(2)),
    x: ((hash >>> 10) % 17) - 8,
    y: ((hash >>> 15) % 15) - 7,
    curvature: ((hash >>> 19) % 25) - 12,
    spread: 7 + ((hash >>> 23) % 13),
    strokeWidth: Number((0.72 + ((hash >>> 27) % 8) / 10).toFixed(2)),
    mirror: hash % 2 === 0 ? 1 : -1,
  });
}

function choreographyFor(spec, profile) {
  const authored = spec.choreography
    || AUTHORED_CHOREOGRAPHIES[spec.variant]
    || PLANNED_ONLY_CHOREOGRAPHIES[spec.variant];
  if (authored) return authored;
  const motion = MOTION_CHOREOGRAPHIES[spec.motion];
  if (motion && !["balanced", "weapon"].includes(spec.motion)) return motion;
  const candidates = FAMILY_CHOREOGRAPHIES[spec.family] || FAMILY_CHOREOGRAPHIES.impact;
  return candidates[profile.seed % candidates.length];
}

function paletteFor(spec, profile) {
  if (spec.palette && !Array.isArray(spec.palette)) return Object.freeze({ ...spec.palette });
  if (Array.isArray(spec.palette)) {
    return Object.freeze({
      primary: spec.palette[0],
      secondary: spec.palette[1],
      shadow: spec.palette[2],
      lightShift: 0,
    });
  }
  const base = FAMILY_PALETTES[spec.family] || FAMILY_PALETTES.impact;
  const light = (profile.seed % 7) - 3;
  return Object.freeze({
    primary: base[0],
    secondary: base[1],
    shadow: base[2],
    lightShift: light,
  });
}

function withMotion(spec) {
  const profile = visualProfile(spec.variant);
  const choreography = choreographyFor(spec, profile);
  const inheritedFlipbookId = spec.flipbook?.id
    || flipbookIdForVariant(spec.variant)
    || FAMILY_FLIPBOOK_IDS[spec.family]
    || "strike";
  const flipbook = spec.flipbook || flipbookForId(inheritedFlipbookId);
  return Object.freeze({
    ...spec,
    // Full ability art remains in command/intent UI. Battlefield presentation samples an
    // ImageGen-authored nine-frame raster atlas; it never enlarges the old static emblems.
    asset: null,
    assetSource: flipbook ? "imagegen-flipbook" : "none",
    flipbook,
    choreography,
    authored: Boolean(
      flipbook
      || spec.choreography
      || AUTHORED_CHOREOGRAPHIES[spec.variant]
      || PLANNED_ONLY_CHOREOGRAPHIES[spec.variant]
    ),
    palette: paletteFor(spec, profile),
    profile,
    signatureKey: `${spec.variant}:${choreography}:${profile.key}`,
  });
}

function safeSkill(skillId) {
  if (!skillId) return null;
  try {
    return getSkill(skillId);
  } catch {
    return null;
  }
}

const SKILL_EFFECTS = Object.freeze({
  strike: effect("impact", "strike", "weapon"),
  "shield-bash": effect("impact", "shield-bash", "shield"),
  slaughter: effect("gash", "slaughter", "bleed"),
  block: effect("ward", "block", "brace"),
  "defensive-stance": effect("ward", "defensive-stance", "brace"),
  parry: effect("ward", "parry", "counter"),
  "threatening-cry": effect("afflict", "threatening-cry", "shout"),
  "mortal-blow": effect("slash", "mortal-blow", "execution"),
  "giants-smash": effect("impact", "giants-smash", "quake"),
  "deliberate-blow": effect("impact", "deliberate-blow", "heavy"),
  warcry: effect("ward", "warcry", "rally"),
  "fist-of-justice": effect("impact", "fist-of-justice", "radiant"),
  retaliation: effect("ward", "retaliation", "counter"),
  incineration: effect("fire", "incineration", "inferno"),
  "emergency-evasion": effect("evade", "emergency-evasion", "afterimage"),
  "elixir-of-wrath": effect("fire", "elixir-of-wrath", "aura"),
  "first-aid": effect("heal", "first-aid", "mend"),
  impregnable: effect("ward", "impregnable", "fortress"),
  "judge-of-fate": effect("afflict", "judge-of-fate", "fate"),
  penetration: effect("pierce", "penetration", "void"),
  "rapid-cooling": effect("frost", "rapid-cooling", "snap"),
  "rising-power": effect("lightning", "rising-power", "charge"),
  shouting: effect("afflict", "shouting", "shout"),
  "sleep-grenade": effect("afflict", "sleep-grenade", "smoke"),
  "sudden-blow": effect("impact", "sudden-blow", "rapid"),
  "thirst-for-blood": effect("gash", "thirst-for-blood", "siphon"),
  transcendence: effect("arcane", "transcendence", "ascend"),
  "unbendable-will": effect("ward", "unbendable-will", "unyielding"),
  "urgent-guard": effect("ward", "urgent-guard", "urgent"),
  "stone-skin-elixir": effect("ward", "stone-skin-elixir", "fortress"),
  "protection-scroll": effect("ward", "protection-scroll", "shield"),
  "killing-instinct": effect("gash", "killing-instinct", "aura"),
  "blade-of-curse": effect("afflict", "blade-of-curse", "execution"),
  beastification: effect("gash", "beastification", "aura"),
  "super-speed": effect("evade", "super-speed", "afterimage"),
  "peace-declaration": effect("afflict", "peace-declaration", "silence"),

  "arctic-strike": effect("slash", "arctic-strike", "measured"),
  "arctic-block": effect("ward", "arctic-block", "brace"),
  "arctic-deliberate-blow": effect("impact", "arctic-deliberate-blow", "heavy"),
  "arctic-incineration": effect("fire", "arctic-incineration", "inferno"),
  "arctic-mortal-blow": effect("impact", "arctic-mortal-blow", "execution"),
  "demon-shoot": effect("pierce", "demon-shoot", "projectile"),
  "demon-evasion": effect("evade", "demon-evasion", "afterimage"),
  "demon-kick": effect("impact", "demon-kick", "rapid"),
  "demon-arrow-rain": effect("pierce", "demon-arrow-rain", "volley"),
  "demon-trackers-net": effect("afflict", "demon-trackers-net", "bind"),
  "clocktower-fire": effect("pierce", "clocktower-fire", "projectile"),
  "clocktower-suppressive-shot": effect("pierce", "clocktower-suppressive-shot", "pin"),
  "clocktower-missile-support": effect("fire", "clocktower-missile-support", "barrage"),
  "clocktower-redesign": effect("lightning", "clocktower-redesign", "charge"),
  "clocktower-improvement": effect("lightning", "clocktower-improvement", "sigil"),
  "north-king-cleave": effect("slash", "north-king-cleave", "heavy"),
  "north-king-vitality": effect("heal", "north-king-vitality", "mend"),
  "north-king-whirlwind": effect("wind", "north-king-whirlwind", "cyclone"),
  "north-king-earthquake": effect("impact", "north-king-earthquake", "quake"),
  "north-king-neutralizing-blow": effect("impact", "north-king-neutralizing-blow", "counter"),
  "sleepless-flame-strike": effect("fire", "sleepless-flame-strike", "brand"),
  "sleepless-flame-curtain": effect("fire", "sleepless-flame-curtain", "curtain"),
  "sleepless-entangling-roots": effect("afflict", "sleepless-entangling-roots", "bind"),
  "sleepless-high-speed-flight": effect("evade", "sleepless-high-speed-flight", "afterimage"),
  "sleepless-fire-essence": effect("fire", "sleepless-fire-essence", "aura"),
  "assassin-flurry": effect("slash", "assassin-flurry", "flurry"),
  "assassin-deflect": effect("ward", "assassin-deflect", "counter"),
  "assassin-flash-bomb": effect("lightning", "assassin-flash-bomb", "flash"),
  "assassin-execution": effect("gash", "assassin-execution", "execution"),
  "assassin-storm-of-knives": effect("gash", "assassin-storm-of-knives", "volley"),
  "witch-skull-throw": effect("arcane", "witch-skull-throw", "projectile"),
  "witch-vampiric-touch": effect("gash", "witch-vampiric-touch", "siphon"),
  "witch-bone-shield": effect("ward", "witch-bone-shield", "fortress"),
  "witch-skeleton-summon": effect("arcane", "witch-skeleton-summon", "summon"),
  "witch-all-out-attack": effect("gash", "witch-all-out-attack", "barrage"),
  "witch-mirror-image": effect("evade", "witch-mirror-image", "afterimage"),
  "witch-demons-sigil": effect("evade", "witch-demons-sigil", "sigil"),
  "witch-battering-ram": effect("impact", "witch-battering-ram", "quake"),
  "witch-void-monster": effect("arcane", "witch-void-monster", "summon"),
  "witch-nullification": effect("arcane", "witch-nullification", "snap"),
  "witch-reapers-scythe": effect("gash", "witch-reapers-scythe", "execution"),
  "witch-proliferation": effect("arcane", "witch-proliferation", "summon"),
  "witch-forbidden-ritual": effect("arcane", "witch-forbidden-ritual", "void"),
  "witch-gate-underworld": effect("arcane", "witch-gate-underworld", "summon"),
  "witch-hellfire-spirit": effect("fire", "witch-hellfire-spirit", "summon"),
  "witch-bone-sphere": effect("impact", "witch-bone-sphere", "projectile"),
  "witch-limited-life-sentence": effect("afflict", "witch-limited-life-sentence", "fate"),
  "mage-magic-arrow": effect("arcane", "mage-magic-arrow", "bolt"),
  "mage-barrier": effect("ward", "mage-barrier", "fortress"),
  "mage-flame-storm": effect("fire", "mage-flame-storm", "inferno"),
  "mage-amplification": effect("arcane", "mage-amplification", "ascend"),
  "mage-god-slaying-spear": effect("arcane", "mage-god-slaying-spear", "projectile"),
  "priestess-crush": effect("impact", "priestess-crush", "radiant"),
  "priestess-holy-shield": effect("ward", "priestess-holy-shield", "radiant"),
  "priestess-wrath-of-heaven": effect("lightning", "priestess-wrath-of-heaven", "radiant"),
  "priestess-doom": effect("afflict", "priestess-doom", "void"),
  "priestess-immediate-judgment": effect("lightning", "priestess-immediate-judgment", "execution"),
  "blade-slash": effect("slash", "blade-slash", "measured"),
  "blade-barrier": effect("ward", "blade-barrier", "counter"),
  "blade-chi-liberation": effect("arcane", "blade-chi-liberation", "ascend"),
  "blade-one-flash": effect("slash", "blade-one-flash", "execution"),
  "blade-katana-dance": effect("slash", "blade-katana-dance", "flurry"),
  "vampire-claw": effect("gash", "vampire-claw", "rapid"),
  "vampire-blood-thirst": effect("heal", "vampire-blood-thirst", "siphon"),
  "vampire-heart-destroyer": effect("gash", "vampire-heart-destroyer", "execution"),
  "vampire-rampage": effect("gash", "vampire-rampage", "flurry"),
  "vampire-bloodflow-absorption": effect("gash", "vampire-bloodflow-absorption", "siphon"),
  "automaton-bombardment": effect("fire", "automaton-bombardment", "barrage"),
  "automaton-repair": effect("heal", "automaton-repair", "mend"),
  "automaton-emergency-cooling": effect("frost", "automaton-emergency-cooling", "snap"),
  "automaton-fate-manipulator": effect("lightning", "automaton-fate-manipulator", "charge"),
  "automaton-final-counter": effect("impact", "automaton-final-counter", "counter"),
});

const FORM_EFFECTS = Object.freeze({
  "dagger-fundamental": effect("slash", "dagger-fundamental", "rapid", "cross-cut"),
  "sword-fundamental": effect("slash", "sword-fundamental", "balanced", "single-sweep"),
  "axe-fundamental": effect("slash", "axe-fundamental", "heavy", "heavy-sweep"),
  "mace-fundamental": effect("impact", "mace-fundamental", "heavy", "impact-rings"),
  "spear-fundamental": effect("pierce", "spear-fundamental", "thrust", "projectile-line"),
  "bow-fundamental": effect("pierce", "bow-fundamental", "projectile", "projectile-line"),
  "crossbow-fundamental": effect("pierce", "crossbow-fundamental", "projectile", "railgun-line"),
  "arcane-fundamental": effect("arcane", "arcane-fundamental", "bolt", "arcane-trace"),
  "unarmed-fundamental": effect("impact", "unarmed-fundamental", "rapid", "impact-rings"),
  "measured-cut": effect("slash", "measured-cut", "measured", "single-sweep"),
  "crossing-cuts": effect("slash", "crossing-cuts", "cross", "cross-cut"),
  "hampering-cut": effect("gash", "hampering-cut", "bleed", "low-sweep"),
  "loose-arrow": effect("pierce", "loose-arrow", "projectile", "projectile-line"),
  "split-volley": effect("pierce", "split-volley", "volley", "projectile-barrage"),
  "pinning-arrow": effect("pierce", "pinning-arrow", "pin", "binding-lines"),
  "twin-cut": effect("slash", "twin-cut", "cross", "cross-cut"),
  "threefold-cut": effect("gash", "threefold-cut", "flurry", "strike-combo"),
  "hamstring-cut": effect("gash", "hamstring-cut", "bleed", "low-sweep"),
  "dawnward-blow": effect("radiant", "dawnward-blow", "radiant", "impact-rings"),
  "pealing-blows": effect("radiant", "pealing-blows", "peal", "strike-combo"),
  sunbreak: effect("radiant", "sunbreak", "radiant", "judgment-pillar"),
  "staff-bolt": effect("arcane", "staff-bolt", "bolt", "projectile-line"),
  "forked-bolt": effect("lightning", "forked-bolt", "fork", "lightning-fork"),
  "cinder-mark": effect("fire", "cinder-mark", "brand", "ember-sweep"),
  "kingsguard-riposte": effect("slash", "kingsguard-riposte", "counter", "counter-sweep"),
  "double-reply": effect("slash", "double-reply", "cross", "cross-cut"),
  "binding-cut": effect("slash", "binding-cut", "bind", "binding-lines"),
  "nightfang-hush": effect("gash", "nightfang-hush", "shadow", "shadow-combo"),
  "threefold-shadow": effect("gash", "threefold-shadow", "shadow-flurry", "shadow-combo"),
  "silencing-cut": effect("slash", "silencing-cut", "silence", "silencing-line"),
  "wyrmscale-cleave": effect("slash", "wyrmscale-cleave", "heavy", "heavy-sweep"),
  "dragons-wake": effect("fire", "dragons-wake", "rolling", "rolling-wave"),
  "sundering-flame": effect("fire", "sundering-flame", "inferno", "ember-sweep"),
});

const STATUS_PALETTES = Object.freeze({
  bramble: Object.freeze(["#d8f8d8", "#5eae62", "#183e1c"]),
  crimson: Object.freeze(["#ff4d6d", "#b7094c", "#590d22"]),
  ember: Object.freeze(["#fff1c7", "#ff6b2c", "#7b160d"]),
  toxic: Object.freeze(["#c7f9cc", "#57cc99", "#22577a"]),
  void: Object.freeze(["#f0e6ff", "#9b5de5", "#240046"]),
  electric: Object.freeze(["#f4fdff", "#00f5d4", "#0b525b"]),
  daze: Object.freeze(["#fff2ce", "#e9a848", "#65401d"]),
  dream: Object.freeze(["#e0aaff", "#9d4edd", "#3c096c"]),
  delirium: Object.freeze(["#ffb703", "#fb8500", "#023047"]),
  heavy: Object.freeze(["#d8bbff", "#7b2cbf", "#10002b"]),
  fracture: Object.freeze(["#f8f9fa", "#ced4da", "#495057"]),
  breach: Object.freeze(["#ffccd5", "#ff4d6d", "#800f2f"]),
  mire: Object.freeze(["#ccd5ae", "#84a98c", "#2f3e46"]),
  ward: Object.freeze(["#effcff", "#79cee8", "#234e70"]),
  velocity: Object.freeze(["#e0fbfc", "#3d5a80", "#293241"]),
  fury: Object.freeze(["#ffedd8", "#ea580c", "#7c2d12"]),
  gold: Object.freeze(["#fefae0", "#dda15e", "#bc6c25"]),
  focus: Object.freeze(["#f8f9fa", "#e63946", "#1d3557"]),
  jade: Object.freeze(["#d8f3dc", "#74c69d", "#1b4332"]),
  plasma: Object.freeze(["#caf0f8", "#00b4d8", "#03045e"]),
  celestial: Object.freeze(["#fff9db", "#fab005", "#e67700"]),
});

const STATUS_EFFECTS = Object.freeze({
  protection: effect("ward", "status-protection", "brace", "ward-arc", STATUS_PALETTES.ward),
  confuse: effect("afflict", "status-confuse", "snap", "confusion-swirl", STATUS_PALETTES.delirium),
  steelskin: effect("ward", "status-steelskin", "fortress", "fortress-barrier", STATUS_PALETTES.ward),
  evade: effect("evade", "status-evade", "afterimage", "afterimage-dash"),
  haste: effect("evade", "status-haste", "rapid", "haste-streak", STATUS_PALETTES.velocity),
  "doom-atk": effect("void", "status-doom-atk", "void", "doom-collapse", STATUS_PALETTES.void),
  "counter-attack": effect("impact", "status-counter-attack", "counter", "counter-sweep"),
  burn: effect("fire", "status-burn", "brand", "flame-rise", STATUS_PALETTES.ember),
  tenacity: effect("radiant", "status-tenacity", "unyielding", "unyielding-rise", STATUS_PALETTES.gold),
  injured: effect("gash", "status-injured", "bleed", "wound-rip", STATUS_PALETTES.crimson),
  fortified: effect("ward", "status-fortified", "fortress", "fortress-barrier", STATUS_PALETTES.ward),
  rage: effect("fire", "status-rage", "aura", "rage-surge", STATUS_PALETTES.fury),
  consecration: effect("radiant", "status-consecration", "radiant", "radiant-fall", STATUS_PALETTES.celestial),
  confusion: effect("afflict", "status-confusion", "snap", "confusion-swirl", STATUS_PALETTES.delirium),
  composure: effect("heal", "status-composure", "aura", "growth-rings", STATUS_PALETTES.jade),
  thorn: effect("nature", "status-thorn", "counter", "thorn-growth", STATUS_PALETTES.bramble),
  misfortune: effect("afflict", "status-misfortune", "fate", "fate-threads", STATUS_PALETTES.crimson),
  overload: effect("lightning", "status-overload", "charge", "overload-spark", STATUS_PALETTES.plasma),
  solidity: effect("ward", "status-solidity", "brace", "ward-arc", STATUS_PALETTES.ward),
  guard: effect("ward", "status-guard", "brace", "ward-arc", STATUS_PALETTES.ward),
  "bone-shield": effect("ward", "status-bone-shield", "fortress", "bone-ward", ["#fdfbf7", "#d4c5b9", "#605247"]),
  "mirror-image": effect("evade", "status-mirror-image", "afterimage", "mirror-shimmer", ["#e0f7fa", "#80deea", "#006064"]),
  unstoppable: effect("radiant", "status-unstoppable", "unyielding", "unyielding-rise", STATUS_PALETTES.gold),
  lifesteal: effect("gash", "status-lifesteal", "siphon", "siphon-stream", STATUS_PALETTES.crimson),
  strength: effect("fire", "status-strength", "aura", "rage-surge", STATUS_PALETTES.fury),
  poison: effect("toxic", "status-poison", "smoke", "poison-wisp", STATUS_PALETTES.toxic),
  cripple: effect("afflict", "status-cripple", "bind", "cripple-shatter", STATUS_PALETTES.fracture),
  charge: effect("lightning", "status-charge", "charge", "charge-surge", STATUS_PALETTES.plasma),
  grow: effect("heal", "status-grow", "aura", "growth-rings", STATUS_PALETTES.jade),
  "poison-atk": effect("toxic", "status-poison-atk", "smoke", "poison-wisp", STATUS_PALETTES.toxic),
  "death-claw": effect("void", "status-death-claw", "execution", "death-claw-slash", ["#fdf2f8", "#db2777", "#500724"]),
  "wind-blade": effect("wind", "status-wind-blade", "projectile", "wind-spiral"),
  weak: effect("afflict", "status-weak", "bind", "binding-lines", STATUS_PALETTES.fracture),
  focus: effect("arcane", "status-focus", "aura", "focus-gleam", STATUS_PALETTES.focus),
  sharpen: effect("slash", "status-sharpen", "aura", "focus-gleam", STATUS_PALETTES.focus),
  eviscerate: effect("gash", "status-eviscerate", "execution", "execution-line", STATUS_PALETTES.focus),
  priority: effect("evade", "status-priority", "rapid", "haste-streak", STATUS_PALETTES.velocity),
  doom: effect("void", "status-doom", "void", "doom-collapse", STATUS_PALETTES.void),
  conceal: effect("evade", "status-conceal", "afterimage", "mist-disperse"),
  invincible: effect("radiant", "status-invincible", "fortress", "aegis-radiance", STATUS_PALETTES.gold),
  paralyze: effect("lightning", "status-paralyze", "snap", "lightning-bind", STATUS_PALETTES.electric),
  sleep: effect("afflict", "status-sleep", "smoke", "sleep-drift", STATUS_PALETTES.dream),
  stun: effect("impact", "status-stun", "snap", "impact-stagger", STATUS_PALETTES.daze),
  bleed: effect("gash", "status-bleed", "bleed", "blood-drip", STATUS_PALETTES.crimson),
  "bleed-atk": effect("gash", "status-bleed-atk", "bleed", "wound-rip", STATUS_PALETTES.crimson),
  lethargy: effect("afflict", "status-lethargy", "bind", "lethargy-shackle", STATUS_PALETTES.heavy),
  "lethargy-atk": effect("afflict", "status-lethargy-atk", "bind", "lethargy-shackle", STATUS_PALETTES.heavy),
  vulnerable: effect("afflict", "status-vulnerable", "bind", "vulnerable-target", STATUS_PALETTES.breach),
  parry: effect("ward", "status-parry", "counter", "counter-sweep", STATUS_PALETTES.ward),
  persist: effect("radiant", "status-persist", "unyielding", "unyielding-rise", STATUS_PALETTES.gold),
  predator: effect("gash", "status-predator", "siphon", "siphon-stream", STATUS_PALETTES.crimson),
  restraint: effect("afflict", "status-restraint", "bind", "binding-lines", STATUS_PALETTES.heavy),
  covert: effect("evade", "status-covert", "afterimage", "mist-disperse"),
  skeleton: effect("arcane", "status-skeleton", "summon", "summon-rise", STATUS_PALETTES.fracture),
  "void-monster": effect("void", "status-void-monster", "summon", "void-tendrils", STATUS_PALETTES.void),
  "hellfire-spirit": effect("fire", "status-hellfire-spirit", "summon", "hellfire-rise", STATUS_PALETTES.ember),
  immortality: effect("radiant", "status-immortality", "ascend", "aegis-radiance", STATUS_PALETTES.gold),
  "fatal-blade": effect("slash", "status-fatal-blade", "execution", "execution-line", STATUS_PALETTES.focus),
  "limited-life-sentence": effect("void", "status-limited-life-sentence", "fate", "fate-clock", ["#fae8ff", "#d946ef", "#4a044e"]),
  "forbidden-ritual": effect("void", "status-forbidden-ritual", "void", "forbidden-glyph", ["#ffe4e6", "#e11d48", "#4c0519"]),
  "foul-ceremony": effect("void", "status-foul-ceremony", "void", "forbidden-glyph", ["#ffe4e6", "#e11d48", "#4c0519"]),
  limp: effect("afflict", "status-limp", "bind", "limp-drag", STATUS_PALETTES.mire),
  berserk: effect("fire", "status-berserk", "aura", "rage-surge", STATUS_PALETTES.fury),
  initiative: effect("evade", "status-initiative", "rapid", "haste-streak", STATUS_PALETTES.velocity),
  "initiative-atk": effect("evade", "status-initiative-atk", "rapid", "haste-streak", STATUS_PALETTES.velocity),
  judgment: effect("radiant", "status-judgment", "radiant", "judgment-pillar", STATUS_PALETTES.celestial),
});

const STATUS_ICON_SHEETS_BY_FAMILY = Object.freeze({
  afflict: statusDebilitation,
  arcane: statusResources,
  evade: statusTempo,
  fire: statusOffense,
  frost: statusResolve,
  gash: statusAfflictions,
  heal: statusSustain,
  impact: statusControl,
  lightning: statusResources,
  mechanical: statusResources,
  nature: statusSustain,
  pierce: statusAttackModifiers,
  radiant: statusResolve,
  slash: statusSummonExecution,
  toxic: statusAfflictions,
  void: statusDebilitation,
  ward: statusDefense,
  wind: statusTempo,
});

function icon(asset, column, row) {
  return Object.freeze({
    iconAsset: asset,
    iconPosition: `${column * 100}% ${row * 100}%`,
    iconSize: "200% 200%",
  });
}

function fullIcon(asset) {
  return Object.freeze({
    iconAsset: asset,
    iconPosition: "0% 0%",
    iconSize: "100% 100%",
  });
}

function fallbackStatusIcon(status, spec) {
  const hash = visualHash(status);
  const x = (10 + ((hash % 8191) / 8191) * 80).toFixed(3);
  const y = (10 + (((hash >>> 13) % 8191) / 8191) * 80).toFixed(3);
  return Object.freeze({
    iconAsset: STATUS_ICON_SHEETS_BY_FAMILY[spec.family] || statusAfflictions,
    iconPosition: `${x}% ${y}%`,
    iconSize: "225% 225%",
  });
}

const STATUS_ICONS = Object.freeze({
  protection: icon(statusDefense, 0, 0),
  steelskin: icon(statusDefense, 1, 0),
  guard: icon(statusDefense, 0, 1),
  solidity: icon(statusDefense, 1, 1),
  evade: icon(statusTempo, 0, 0),
  haste: icon(statusTempo, 1, 0),
  swift: icon(statusTempo, 0, 1),
  priority: icon(statusTempo, 1, 1),
  burn: icon(statusAfflictions, 0, 0),
  poison: icon(statusAfflictions, 1, 0),
  bleed: icon(statusAfflictions, 0, 1),
  doom: icon(statusAfflictions, 1, 1),
  lethargy: icon(statusDebilitation, 0, 0),
  weak: icon(statusDebilitation, 1, 0),
  cripple: icon(statusDebilitation, 0, 1),
  vulnerable: icon(statusDebilitation, 1, 1),
  paralyze: icon(statusControl, 0, 0),
  stun: icon(statusControl, 1, 0),
  sleep: icon(statusControl, 0, 1),
  limp: icon(statusControl, 1, 1),
  strength: icon(statusOffense, 0, 0),
  berserk: icon(statusOffense, 1, 0),
  focus: icon(statusOffense, 0, 1),
  sharpen: icon(statusOffense, 1, 1),
  tenacity: icon(statusResolve, 0, 0),
  unstoppable: icon(statusResolve, 1, 0),
  invincible: icon(statusResolve, 0, 1),
  thorn: icon(statusResolve, 1, 1),
  lifesteal: icon(statusSustain, 0, 0),
  grow: icon(statusSustain, 1, 0),
  conceal: icon(statusSustain, 0, 1),
  misfortune: icon(statusSustain, 1, 1),
  overload: icon(statusResources, 0, 0),
  charge: icon(statusResources, 1, 0),
  initiative: icon(statusResources, 0, 1),
  judgment: icon(statusResources, 1, 1),
  "poison-atk": icon(statusAttackModifiers, 0, 0),
  "bleed-atk": icon(statusAttackModifiers, 1, 0),
  "doom-atk": icon(statusAttackModifiers, 0, 1),
  "lethargy-atk": icon(statusAttackModifiers, 1, 1),
  skeleton: icon(statusSummonExecution, 0, 0),
  eviscerate: icon(statusSummonExecution, 1, 0),
  "initiative-atk": icon(statusSummonExecution, 0, 1),
  "bone-shield": fullIcon(witchBoneShieldIcon),
  "mirror-image": fullIcon(witchMirrorImageIcon),
  "void-monster": fullIcon(witchVoidMonsterIcon),
  "hellfire-spirit": fullIcon(witchHellfireSpiritIcon),
  "limited-life-sentence": fullIcon(witchLimitedLifeSentenceIcon),
  "forbidden-ritual": fullIcon(witchForbiddenRitualIcon),
});

function slug(value, fallback = "unknown") {
  const normalized = String(value || fallback).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return normalized || fallback;
}

function familyFromText(value) {
  const text = String(value || "").toLowerCase();
  if (/(poison|toxic|venom|catalyst)/.test(text)) return "toxic";
  if (/(thorn|root|briar|nature|wild)/.test(text)) return "nature";
  if (/(holy|divine|judgment|radiant|god|celestial|consecr)/.test(text)) return "radiant";
  if (/(void|doom|abyss|underworld|forbidden|curse|wraith|soul)/.test(text)) return "void";
  if (/(automaton|clocktower|gear|cannon|missile|grenade|voltage|machine|fusion|buckshot)/.test(text)) return "mechanical";
  if (/(heal|repair|regener|vitality|first-aid)/.test(text)) return "heal";
  if (/(arrow|bolt|jab|lance|pin|pierc|shot|spear|thrust)/.test(text)) return "pierce";
  if (/(burn|cinder|ember|fire|flame|inferno)/.test(text)) return "fire";
  if (/(lightning|shock|storm|thunder)/.test(text)) return "lightning";
  if (/(arcane|magic|rune|spell)/.test(text)) return "arcane";
  if (/(frost|ice|cold|winter)/.test(text)) return "frost";
  if (/(gash|claw|rend|bleed|fang)/.test(text)) return "gash";
  if (/(smash|slam|maul|crush|blow|punch|strike)/.test(text)) return "impact";
  return "slash";
}

function familyForChoreography(choreography, identity) {
  const text = `${choreography || ""} ${identity || ""}`.toLowerCase();
  if (/(heal|repair|regener|restor)/.test(text)) return "heal";
  if (/(poison|toxic|venom)/.test(text)) return "toxic";
  if (/(thorn|briar|root|nature)/.test(text)) return "nature";
  if (/(holy|divine|judgment|radiant|celestial|aegis)/.test(text)) return "radiant";
  if (/(void|doom|abyss|underworld|forbidden|fate-clock|curse)/.test(text)) return "void";
  if (/(automaton|clocktower|gear|ballistic|forcefield|railgun|orbital|nanite)/.test(text)) return "mechanical";
  if (/(flame|fire|ember|hellfire|rage)/.test(text)) return "fire";
  if (/(frost|ice|blizzard)/.test(text)) return "frost";
  if (/(lightning|charge|overload|plasma)/.test(text)) return "lightning";
  if (/(afterimage|mist|mirror|haste|stealth|shadow-step)/.test(text)) return "evade";
  if (/(ward|barrier|fortress|unyielding|bone-ward)/.test(text)) return "ward";
  if (/(blood|wound|claw|bite|siphon|devour|cruel)/.test(text)) return "gash";
  if (/(projectile|lance|beam|shot|arrow|railgun)/.test(text)) return "pierce";
  if (/(impact|fracture|shatter|explosion|stagger)/.test(text)) return "impact";
  if (/(wind|vortex|rolling-wave)/.test(text)) return "wind";
  if (/(arcane|summon|time-warp|glyph|awakening|growth-rings)/.test(text)) return "arcane";
  return familyFromText(identity);
}

function motionForChoreography(choreography) {
  if (/(execution|sever|flash-cut|death-claw)/.test(choreography)) return "execution";
  if (/(combo)/.test(choreography)) return "flurry";
  if (/(barrage|rain|ballistic)/.test(choreography)) return "volley";
  if (/(heavy-sweep)/.test(choreography)) return "heavy";
  if (/(ground-fracture)/.test(choreography)) return "quake";
  if (/(ward|barrier|forcefield|aegis)/.test(choreography)) return "fortress";
  if (/(regeneration|growth)/.test(choreography)) return "mend";
  if (/(afterimage|haste)/.test(choreography)) return "afterimage";
  if (/(projectile|beam|railgun|lance)/.test(choreography)) return "projectile";
  if (/(flame|hellfire|ember)/.test(choreography)) return "inferno";
  if (/(lightning|charge|overload)/.test(choreography)) return "charge";
  if (/(summon|rise|awakening)/.test(choreography)) return "summon";
  return "balanced";
}

function inferredSkillEffect(skillId) {
  const definition = safeSkill(skillId);
  if (!definition) return null;
  const effects = definition.effects || [];
  const statusEffect = effects.find((entry) => (
    ["modify-status", "scale-status", "scaled-status", "status", "status-from-status"].includes(entry.type)
  ));
  const statusType = statusEffect?.status || statusEffect?.statuses?.[0] || statusEffect?.factorStatus;
  const damageEffect = effects.find((entry) => entry.type === "damage" || entry.type.startsWith("damage-"));
  const hasShield = effects.some((entry) => entry.type === "shield");
  const hasHeal = effects.some((entry) => entry.type.startsWith("heal") || entry.type === "reduce-statuses");
  const statusVisual = statusType && STATUS_EFFECTS[statusType];
  const identity = `${skillId} ${definition.name || ""} ${statusType || ""}`;

  const authoredChoreography = AUTHORED_CHOREOGRAPHIES[skillId]
    || PLANNED_ONLY_CHOREOGRAPHIES[skillId];
  let family = statusVisual?.family || familyForChoreography(authoredChoreography, identity);
  if (hasShield && !damageEffect) family = "ward";
  else if (hasHeal && !damageEffect) family = "heal";

  let motion = statusVisual?.motion || motionForChoreography(authoredChoreography || "");
  if (hasShield && damageEffect) motion = "counter";
  else if (hasShield) motion = "shield";
  else if (hasHeal && damageEffect) motion = "siphon";
  else if (hasHeal) motion = "mend";
  else if ((damageEffect?.hits || 1) >= 3) motion = family === "pierce" ? "volley" : "flurry";
  else if ((damageEffect?.hits || 1) === 2) motion = "cross";
  else if (definition.consumesTurn === false) motion = "aura";
  else if (damageEffect && /execution|ultimate|final|doom|judgment|flash/i.test(identity)) motion = "execution";
  else if (damageEffect && /smash|earthquake|crush|cannon|bomb/i.test(identity)) motion = "quake";
  else if (damageEffect && family === "pierce") motion = "projectile";

  return effect(family, skillId, motion, authoredChoreography || null);
}

function plannedSkillEffect(skillId) {
  const choreography = PLANNED_ONLY_CHOREOGRAPHIES[skillId];
  if (!choreography) return null;
  return effect(
    familyForChoreography(choreography, skillId),
    skillId,
    motionForChoreography(choreography),
    choreography,
  );
}

export const COMBAT_VFX_SKILL_REGISTRY = Object.freeze(Object.fromEntries(
  skillIds().map((skillId) => {
    const spec = SKILL_EFFECTS[skillId] || inferredSkillEffect(skillId);
    return [skillId, withMotion(spec || effect("impact", skillId, "balanced"))];
  }),
));

export const COMBAT_VFX_PLANNED_SKILL_REGISTRY = Object.freeze(Object.fromEntries(
  Object.keys(PLANNED_ONLY_CHOREOGRAPHIES).map((skillId) => [
    skillId,
    withMotion(plannedSkillEffect(skillId)),
  ]),
));

function skillEffectFor(skillId) {
  return COMBAT_VFX_SKILL_REGISTRY[skillId]
    || COMBAT_VFX_PLANNED_SKILL_REGISTRY[skillId]
    || null;
}

function withInheritedFlipbook(spec, sourceVisual) {
  return withMotion(Object.freeze({
    ...spec,
    flipbook: sourceVisual?.flipbook || spec.flipbook || null,
  }));
}

function attackDefinition(encounter, event) {
  return encounter?.enemyAttacks?.[event.enemyId]?.find((entry) => entry.id === event.attackId) || null;
}

function activeFormId(encounter, event) {
  if (event.basicAttackFormId) return event.basicAttackFormId;
  if (event.actorId === encounter?.playerId) return encounter?.build?.basicAttack?.formId;
  return encounter?.allyBuilds?.[event.actorId]?.basicAttack?.formId;
}

export function combatVfxForIntent(intent) {
  const skillVisual = intent?.skillId ? skillEffectFor(intent.skillId) : null;
  let family = skillVisual?.family || familyFromText(`${intent?.attackId || ""} ${intent?.name || ""}`);
  if (intent?.kind === "ward") family = "ward";
  else if (intent?.kind === "recover") family = "heal";
  else if (intent?.kind === "afflict" && !skillVisual) family = "afflict";
  const spec = effect(
    family,
    `intent-${slug(intent?.skillId || intent?.attackId || intent?.name, "attack")}`,
    skillVisual?.motion || (intent?.hits > 1 ? "multi" : "balanced"),
    skillVisual?.choreography || null,
    skillVisual?.palette || null,
  );
  const motionVisual = withMotion(spec);
  return Object.freeze({
    ...motionVisual,
    asset: resolveTowIntentArt(intent, family),
    assetSource: "intent-art",
  });
}

export function combatVfxForStatus(status) {
  const spec = STATUS_EFFECTS[status] || effect("afflict", `status-${slug(status, "unknown")}`, "balanced");
  const iconVisual = STATUS_ICONS[status] || fallbackStatusIcon(status, spec);
  return Object.freeze({ ...withMotion(spec), ...iconVisual });
}

/** Resolve only presentation metadata from the authoritative event; mechanics stay in the kernel. */
export function combatVfxForEvent(encounter, event) {
  if (!event) return withMotion(effect("impact", "unknown", "balanced"));

  if (event.type === "enemy-attack") {
    const attack = attackDefinition(encounter, event);
    const skillVisual = attack?.skillId ? skillEffectFor(attack.skillId) : null;
    const identity = `${event.attackId || ""} ${attack?.name || ""}`;
    const family = skillVisual?.family || familyFromText(identity);
    const spec = effect(
      family,
      `enemy-${slug(event.attackId, "attack")}`,
      skillVisual?.motion || ((event.hits?.length || attack?.hits || 1) > 1 ? "multi" : "heavy"),
      skillVisual?.choreography || null,
      skillVisual?.palette || null,
    );
    return withInheritedFlipbook(spec, skillVisual);
  }

  if (event.type === "tick-damage") {
    const type = event.forbiddenRitual ? "forbidden-ritual"
      : event.delayedDamage > 0 ? event.delayedStatuses?.[0] || "limited-life-sentence"
        : event.hellfireSpirit > 0 ? "hellfire-spirit"
          : event.voidMonster > 0 ? "void-monster"
            : event.burn > 0 ? "burn"
              : event.doom > 0 ? "doom"
                : event.poison > 0 ? "poison"
                  : event.bleed > 0 ? "bleed"
                    : "misfortune";
    return combatVfxForStatus(type);
  }

  const skillVariant = event.skillId && skillEffectFor(event.skillId);
  if (event.type === "skill-shield") {
    return withInheritedFlipbook(effect(
      "ward",
      `${slug(event.skillId, "ward")}-ward`,
      skillVariant?.motion === "fortress" ? "fortress" : "brace",
      skillVariant?.motion === "fortress" ? "fortress-barrier" : "ward-arc",
      STATUS_PALETTES.ward,
    ), skillVariant);
  }
  if (event.type === "ward-expired") {
    return withMotion(effect("ward", "ward-expired", "shatter"));
  }
  if (event.type === "skill-heal" || event.type === "skill-cleanse") {
    return withInheritedFlipbook(effect(
      "heal",
      `${slug(event.skillId, "heal")}-heal`,
      "mend",
      "regeneration-rise",
      STATUS_PALETTES.jade,
    ), skillVariant);
  }
  if (event.type === "skill-status" && event.status && STATUS_EFFECTS[event.status]) {
    const statusVariant = STATUS_EFFECTS[event.status];
    return withInheritedFlipbook(effect(
      statusVariant.family,
      `${slug(event.skillId, "skill")}-${slug(event.status, "status")}`,
      statusVariant.motion,
      statusVariant.choreography,
      statusVariant.palette,
    ), skillVariant);
  }
  if (["skill-status-amplified", "skill-status-scaled", "skill-status-modified"].includes(event.type)) {
    const status = event.status || event.statuses?.[0];
    const statusVariant = STATUS_EFFECTS[status];
    return withInheritedFlipbook(effect(
      statusVariant?.family || "afflict",
      `${slug(event.skillId, "skill")}-${slug(status, "status")}-${slug(event.type)}`,
      statusVariant?.motion || "void",
      statusVariant?.choreography || "doom-collapse",
      statusVariant?.palette || STATUS_PALETTES.void,
    ), skillVariant);
  }

  const formId = event.skillId === "strike" ? activeFormId(encounter, event) : null;
  if (formId && FORM_EFFECTS[formId]) {
    return withInheritedFlipbook(FORM_EFFECTS[formId], skillVariant || skillEffectFor("strike"));
  }
  if (skillVariant) return withMotion(skillVariant);
  if (event.status && STATUS_EFFECTS[event.status]) return combatVfxForStatus(event.status);

  if (event.type === "enemy-nullified") return withMotion(effect("afflict", "enemy-interrupted", "snap"));
  if (event.type === "actor-nullified") {
    const control = event.controls?.[0];
    return control && STATUS_EFFECTS[control]
      ? combatVfxForStatus(control)
      : withMotion(effect("afflict", "command-nullified", "snap"));
  }
  if (event.type === "actor-preempted") return combatVfxForStatus("priority");
  if (event.type === "retreat-attempt") return withMotion(effect(event.succeeded ? "evade" : "afflict", event.succeeded ? "retreat-escaped" : "retreat-cornered", event.succeeded ? "afterimage" : "bind"));

  const family = familyFromText(`${event.skillId || ""} ${event.attackId || ""}`);
  return withMotion(effect(family, `event-${slug(event.skillId || event.attackId || event.type)}`, "balanced"));
}

export function combatVfxVariantForSkill(skillId) {
  const spec = skillEffectFor(skillId);
  return spec ? withMotion(spec) : null;
}

export function combatVfxVariantForForm(formId) {
  return FORM_EFFECTS[formId]
    ? withInheritedFlipbook(FORM_EFFECTS[formId], skillEffectFor("strike"))
    : null;
}

const CHOREOGRAPHY_COMBOS = Object.freeze({
  "knife-combo": Object.freeze(["knife-left", "knife-right", "knife-thrust", "knife-cross"]),
  "rampage-combo": Object.freeze(["blood-sweep-left", "blood-sweep-right", "blood-lance", "blood-backflow"]),
  "blood-rain": Object.freeze(["blood-drop-left", "blood-drop-right", "blood-lance", "blood-drop-cross"]),
  "strike-combo": Object.freeze(["combo-left", "combo-right", "combo-thrust", "combo-cross"]),
  "shadow-combo": Object.freeze(["shadow-left", "shadow-right", "shadow-thrust", "shadow-cross"]),
  "projectile-barrage": Object.freeze(["projectile-high", "projectile-low", "projectile-center", "projectile-cross"]),
});

function flipbookRangeForHit(hitIndex, hitCount) {
  const count = Math.max(1, hitCount);
  const index = Math.max(0, Math.min(count - 1, hitIndex));
  const start = Math.floor((index * 9) / count);
  const end = Math.max(start, Math.floor(((index + 1) * 9) / count) - 1);
  return [start, Math.min(8, end)];
}

/** Give every contact in a multi-hit action its own moving beat rather than replaying one overlay. */
export function combatVfxForHit(visual, hitIndex = 0, hitCount = 1) {
  if (!visual) return null;
  const combo = CHOREOGRAPHY_COMBOS[visual.choreography]
    || (hitCount > 1 ? CHOREOGRAPHY_COMBOS[visual.motion === "barrage" || visual.motion === "volley"
      ? "projectile-barrage"
      : visual.family === "gash"
        ? "rampage-combo"
        : "strike-combo"] : null);
  if (!combo) return visual;
  const choreography = combo[hitIndex % combo.length];
  const profile = visualProfile(`${visual.variant}:hit:${hitIndex}`);
  const frameRange = flipbookRangeForHit(hitIndex, hitCount);
  const flipbook = visual.flipbook
    ? flipbookForId(visual.flipbook.id, frameRange)
    : null;
  return Object.freeze({
    ...visual,
    choreography,
    flipbook,
    profile,
    signatureKey: `${visual.variant}:${choreography}:${profile.key}:${frameRange.join("-")}`,
    comboStep: hitIndex,
  });
}
