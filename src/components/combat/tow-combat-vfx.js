import slashAsset from "../../assets/combat-vfx/slash.svg";
import pierceAsset from "../../assets/combat-vfx/pierce.svg";
import impactAsset from "../../assets/combat-vfx/impact.svg";
import gashAsset from "../../assets/combat-vfx/gash.svg";
import fireAsset from "../../assets/combat-vfx/fire.svg";
import lightningAsset from "../../assets/combat-vfx/lightning.svg";
import arcaneAsset from "../../assets/combat-vfx/arcane.svg";
import wardAsset from "../../assets/combat-vfx/ward.svg";
import evadeAsset from "../../assets/combat-vfx/evade.svg";
import healAsset from "../../assets/combat-vfx/heal.svg";
import afflictAsset from "../../assets/combat-vfx/afflict.svg";
import frostAsset from "../../assets/combat-vfx/frost.svg";
import { getSkill } from "../../gameplay/tow/skills.js";

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
});

function effect(family, variant, motion = "balanced") {
  return Object.freeze({ family, variant, motion });
}

const VFX_PALETTES = Object.freeze({
  afflict: ["#6f3a97", "#d8a5ff", "#3a154f"],
  arcane: ["#7e70ef", "#e2ddff", "#242153"],
  evade: ["#55bbaa", "#d1fff5", "#123e3a"],
  fire: ["#f05b22", "#ffe08e", "#60180d"],
  frost: ["#65cce7", "#e5fbff", "#174150"],
  gash: ["#d93458", "#ffb2bd", "#5e1024"],
  heal: ["#80bc58", "#e4ffc3", "#25481d"],
  impact: ["#e4a53f", "#fff0ad", "#5c3511"],
  lightning: ["#4fc8ef", "#e9fbff", "#153f64"],
  pierce: ["#5ec7df", "#ddfaff", "#173e4b"],
  slash: ["#e0503c", "#ffd2bb", "#61190f"],
  ward: ["#63bdd7", "#ddf8ff", "#174656"],
  wind: ["#72c7b4", "#f0fff8", "#1e514a"],
});

const MOTION_MOTIFS = Object.freeze({
  afterimage: "afterimage",
  ascend: "sigil",
  aura: "flame",
  balanced: "blade",
  barrage: "volley",
  bind: "bind",
  bleed: "blade",
  bolt: "projectile",
  brace: "shield",
  brand: "flame",
  charge: "storm",
  counter: "shield",
  cross: "flurry",
  curtain: "shield",
  cyclone: "whirlwind",
  execution: "execution",
  fate: "sigil",
  flash: "storm",
  flurry: "flurry",
  fork: "volley",
  fortress: "shield",
  heavy: "rupture",
  inferno: "flame",
  mend: "sustain",
  measured: "blade",
  multi: "flurry",
  peal: "rupture",
  pin: "projectile",
  projectile: "projectile",
  quake: "rupture",
  radiant: "storm",
  rally: "shield",
  rapid: "flurry",
  rolling: "whirlwind",
  shadow: "afterimage",
  "shadow-flurry": "flurry",
  shield: "shield",
  shout: "bind",
  silence: "sigil",
  siphon: "sustain",
  smoke: "bind",
  snap: "storm",
  summon: "sigil",
  thrust: "projectile",
  unyielding: "shield",
  urgent: "shield",
  void: "sigil",
  volley: "volley",
  weapon: "blade",
});

const bespokeVfxCache = new Map();

function vfxHash(value) {
  let hash = 2166136261;
  for (const character of String(value || "effect")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function familyMotif(family) {
  if (family === "fire") return "flame";
  if (family === "lightning" || family === "frost") return "storm";
  if (family === "ward") return "shield";
  if (family === "heal") return "sustain";
  if (family === "afflict" || family === "arcane") return "sigil";
  if (family === "pierce") return "projectile";
  if (family === "wind") return "whirlwind";
  return "blade";
}

function variantRune(hash) {
  const left = 74 + (hash % 19);
  const peak = 47 + ((hash >>> 4) % 30);
  const right = 176 - ((hash >>> 9) % 17);
  const trough = 178 + ((hash >>> 14) % 25);
  return `M${left} 156 Q112 ${peak} 132 119 T${right} 88 Q150 146 118 ${trough}`;
}

function vfxMotifMarkup(motif, hash) {
  const tilt = (hash % 31) - 15;
  const drift = ((hash >>> 7) % 17) - 8;
  const dash = 7 + ((hash >>> 13) % 9);
  const rotate = `rotate(${tilt} 128 128)`;

  if (motif === "whirlwind") {
    return `<g fill="none" stroke-linecap="round" transform="${rotate}">
      <path d="M31 116 C43 51 139 23 207 70 C232 87 239 112 222 135" stroke="url(#accent)" stroke-width="11"/>
      <path d="M221 147 C195 213 96 231 40 178 C19 158 17 132 34 109" stroke="url(#light)" stroke-width="7" stroke-opacity=".82"/>
      <path d="M69 143 C75 104 122 78 164 91 C187 98 199 116 191 136" stroke="url(#accent)" stroke-width="6" stroke-opacity=".72"/>
      <path d="M42 94 L27 121 L61 115 M215 165 L231 139 L197 145" stroke="currentColor" stroke-width="5"/>
      <ellipse cx="128" cy="130" rx="93" ry="61" stroke="currentColor" stroke-width="2" stroke-dasharray="${dash} 14" stroke-opacity=".48"/>
    </g>`;
  }
  if (motif === "rupture") {
    return `<g fill="none" stroke-linecap="round" stroke-linejoin="round" transform="${rotate}">
      <path d="M29 170 L79 146 L105 154 L129 113 L151 148 L184 132 L229 166" stroke="url(#accent)" stroke-width="12"/>
      <path d="M128 114 L116 74 L139 32 M105 154 L78 190 L66 222 M151 148 L181 185 L204 205" stroke="url(#light)" stroke-width="6"/>
      <path d="M45 178 Q128 211 215 174" stroke="currentColor" stroke-width="3" stroke-dasharray="${dash} 11" stroke-opacity=".55"/>
    </g>`;
  }
  if (motif === "execution") {
    return `<g fill="none" stroke-linecap="round" transform="${rotate}">
      <path d="M164 18 L119 119 L92 235" stroke="url(#light)" stroke-width="16"/>
      <path d="M185 38 L129 126 L69 194" stroke="url(#accent)" stroke-width="7"/>
      <path d="M60 73 L190 184" stroke="currentColor" stroke-width="4" stroke-dasharray="${dash} 12" stroke-opacity=".58"/>
    </g>`;
  }
  if (motif === "flurry") {
    return `<g fill="none" stroke-linecap="round" transform="${rotate}">
      <path d="M34 174 Q104 77 222 62" stroke="url(#accent)" stroke-width="9"/>
      <path d="M39 91 Q131 158 219 181" stroke="url(#light)" stroke-width="7"/>
      <path d="M68 213 Q126 111 192 37" stroke="currentColor" stroke-width="4" stroke-dasharray="${dash} 10" stroke-opacity=".62"/>
      <path d="M${55 + drift} 145 Q128 126 ${205 - drift} 119" stroke="currentColor" stroke-width="3" stroke-opacity=".44"/>
    </g>`;
  }
  if (motif === "projectile") {
    return `<g fill="none" stroke-linecap="round" stroke-linejoin="round" transform="${rotate}">
      <path d="M24 183 Q90 142 199 76" stroke="url(#accent)" stroke-width="10"/>
      <path d="M179 61 L226 57 L207 101" stroke="url(#light)" stroke-width="9"/>
      <path d="M33 204 Q101 154 190 104" stroke="currentColor" stroke-width="4" stroke-dasharray="${dash} 13" stroke-opacity=".55"/>
    </g>`;
  }
  if (motif === "volley") {
    return `<g fill="none" stroke-linecap="round" transform="${rotate}">
      <path d="M25 183 L183 63 M52 211 L211 91 M18 137 L151 37" stroke="url(#accent)" stroke-width="7"/>
      <path d="M174 52 L207 46 L196 79 M202 81 L235 74 L223 108 M143 28 L176 20 L164 54" stroke="url(#light)" stroke-width="5"/>
      <circle cx="128" cy="128" r="81" stroke="currentColor" stroke-width="2" stroke-dasharray="${dash} 15" stroke-opacity=".4"/>
    </g>`;
  }
  if (motif === "shield") {
    return `<g fill="none" stroke-linejoin="round" transform="${rotate}">
      <path d="M128 25 L210 58 L196 151 Q181 207 128 231 Q75 207 60 151 L46 58 Z" stroke="url(#accent)" stroke-width="10"/>
      <path d="M128 52 L179 72 L170 145 Q158 181 128 199 Q98 181 86 145 L77 72 Z" stroke="url(#light)" stroke-width="5" stroke-dasharray="${dash} 9"/>
      <path d="M70 141 Q128 105 187 141" stroke="currentColor" stroke-width="4" stroke-opacity=".5"/>
    </g>`;
  }
  if (motif === "flame") {
    return `<g fill="none" stroke-linecap="round" transform="${rotate}">
      <path d="M132 229 C66 212 48 164 80 120 C98 95 101 69 91 31 C143 62 160 95 149 126 C175 109 191 91 193 72 C228 128 215 202 132 229Z" fill="url(#soft)" stroke="url(#accent)" stroke-width="8"/>
      <path d="M128 199 C100 181 99 151 118 129 C132 113 137 96 132 78 C166 112 171 165 128 199Z" stroke="url(#light)" stroke-width="6"/>
    </g>`;
  }
  if (motif === "storm") {
    return `<g fill="none" stroke-linecap="round" stroke-linejoin="round" transform="${rotate}">
      <path d="M145 18 L78 126 L124 119 L101 238 L190 101 L141 111 Z" fill="url(#soft)" stroke="url(#light)" stroke-width="8"/>
      <path d="M44 90 L77 105 M180 166 L220 183 M42 172 L79 157 M181 73 L217 50" stroke="url(#accent)" stroke-width="6"/>
      <circle cx="130" cy="128" r="91" stroke="currentColor" stroke-width="2" stroke-dasharray="${dash} 13" stroke-opacity=".42"/>
    </g>`;
  }
  if (motif === "sigil") {
    return `<g fill="none" stroke-linejoin="round" transform="${rotate}">
      <circle cx="128" cy="128" r="91" stroke="url(#accent)" stroke-width="7" stroke-dasharray="${dash} 10"/>
      <path d="M128 34 L207 174 L49 174 Z M128 58 L178 159 L78 159 Z" stroke="url(#light)" stroke-width="5"/>
      <path d="${variantRune(hash)}" stroke="currentColor" stroke-width="5" stroke-linecap="round" opacity=".7"/>
      <circle cx="128" cy="128" r="19" fill="url(#soft)" stroke="currentColor" stroke-width="3"/>
    </g>`;
  }
  if (motif === "bind") {
    return `<g fill="none" stroke-linecap="round" transform="${rotate}">
      <path d="M38 211 C92 173 49 116 103 91 C145 72 116 39 151 20 M217 218 C165 184 209 127 155 101 C113 81 145 48 108 29" stroke="url(#accent)" stroke-width="9"/>
      <path d="M43 142 C81 122 99 150 128 128 C158 105 178 136 216 113 M47 176 C88 148 107 182 139 153 C162 132 183 157 213 146" stroke="url(#light)" stroke-width="5"/>
      <path d="${variantRune(hash)}" stroke="currentColor" stroke-width="3" stroke-dasharray="${dash} 8" opacity=".55"/>
    </g>`;
  }
  if (motif === "sustain") {
    return `<g fill="none" stroke-linecap="round" transform="${rotate}">
      <path d="M128 225 C66 181 43 148 54 104 C63 69 102 59 128 91 C154 59 193 69 202 104 C213 148 190 181 128 225Z" fill="url(#soft)" stroke="url(#accent)" stroke-width="8"/>
      <path d="M128 70 V180 M73 125 H183" stroke="url(#light)" stroke-width="8"/>
      <circle cx="128" cy="126" r="82" stroke="currentColor" stroke-width="2" stroke-dasharray="${dash} 14" stroke-opacity=".42"/>
    </g>`;
  }
  if (motif === "afterimage") {
    return `<g fill="none" stroke-linecap="round" transform="${rotate}">
      <path d="M204 39 C151 57 120 85 106 126 C93 165 67 193 25 214" stroke="url(#light)" stroke-width="11"/>
      <path d="M229 68 C167 84 139 109 126 145 C115 176 91 202 55 226" stroke="url(#accent)" stroke-width="7" stroke-dasharray="${dash} 11"/>
      <path d="M186 29 L218 34 L203 61 M35 192 L24 221 L57 215" stroke="currentColor" stroke-width="5" opacity=".55"/>
    </g>`;
  }
  return `<g fill="none" stroke-linecap="round" transform="${rotate}">
    <path d="M33 190 Q112 71 224 48" stroke="url(#accent)" stroke-width="12"/>
    <path d="M47 211 Q124 99 207 72" stroke="url(#light)" stroke-width="6"/>
    <path d="${variantRune(hash)}" stroke="currentColor" stroke-width="4" stroke-dasharray="${dash} 9" opacity=".52"/>
  </g>`;
}

/**
 * Every authored variant resolves to its own transparent SVG asset. The family supplies
 * colour language, the motion supplies silhouette, and the stable id changes the internal
 * rune/geometry. That keeps two earned skills from collapsing back to the same slash decal.
 */
function bespokeVfxAsset(spec) {
  const key = `${spec.family}:${spec.motion}:${spec.variant}`;
  if (bespokeVfxCache.has(key)) return bespokeVfxCache.get(key);
  const [accent, light, deep] = VFX_PALETTES[spec.family] || VFX_PALETTES.impact;
  const hash = vfxHash(key);
  const motif = MOTION_MOTIFS[spec.motion] || familyMotif(spec.family);
  const signaturePoints = hash.toString(16).padStart(8, "0").split("")
    .map((digit, index) => `${31 + (index * 28)},${231 - (Number.parseInt(digit, 16) * 2.2)}`)
    .join(" ");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" color="${light}" data-variant="${spec.variant}">
    <defs>
      <linearGradient id="accent" x1="0" y1="1" x2="1" y2="0"><stop stop-color="${deep}" stop-opacity=".08"/><stop offset=".5" stop-color="${accent}"/><stop offset="1" stop-color="${light}"/></linearGradient>
      <linearGradient id="light" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${light}"/><stop offset="1" stop-color="${accent}" stop-opacity=".28"/></linearGradient>
      <radialGradient id="soft"><stop stop-color="${light}" stop-opacity=".34"/><stop offset="1" stop-color="${accent}" stop-opacity=".03"/></radialGradient>
    </defs>
    ${vfxMotifMarkup(motif, hash)}
    <polyline points="${signaturePoints}" fill="none" stroke="${light}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity=".32"/>
  </svg>`;
  const asset = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  bespokeVfxCache.set(key, asset);
  return asset;
}

// Each authored ability receives its own stable variant. Families provide a dedicated
// transparent effect asset; the motion modifier changes timing, scale, colour treatment,
// and impact behaviour without putting opaque square card art over the battlefield.
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

  // Five-action kits for the authored Tower of Winter roster: two fixed actions and
  // three flexible character-exclusive or General ability slots.
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
  "witch-bone-shield": effect("ward", "witch-bone-shield", "fortress"),
  "witch-skeleton-summon": effect("arcane", "witch-skeleton-summon", "summon"),
  "witch-all-out-attack": effect("gash", "witch-all-out-attack", "barrage"),
  "witch-mirror-image": effect("evade", "witch-mirror-image", "afterimage"),
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
  "dagger-fundamental": effect("slash", "dagger-fundamental", "rapid"),
  "sword-fundamental": effect("slash", "sword-fundamental", "balanced"),
  "axe-fundamental": effect("slash", "axe-fundamental", "heavy"),
  "mace-fundamental": effect("impact", "mace-fundamental", "heavy"),
  "spear-fundamental": effect("pierce", "spear-fundamental", "thrust"),
  "bow-fundamental": effect("pierce", "bow-fundamental", "projectile"),
  "crossbow-fundamental": effect("pierce", "crossbow-fundamental", "projectile"),
  "arcane-fundamental": effect("arcane", "arcane-fundamental", "bolt"),
  "unarmed-fundamental": effect("impact", "unarmed-fundamental", "rapid"),
  "measured-cut": effect("slash", "measured-cut", "measured"),
  "crossing-cuts": effect("slash", "crossing-cuts", "cross"),
  "hampering-cut": effect("gash", "hampering-cut", "bleed"),
  "loose-arrow": effect("pierce", "loose-arrow", "projectile"),
  "split-volley": effect("pierce", "split-volley", "volley"),
  "pinning-arrow": effect("pierce", "pinning-arrow", "pin"),
  "twin-cut": effect("slash", "twin-cut", "cross"),
  "threefold-cut": effect("gash", "threefold-cut", "flurry"),
  "hamstring-cut": effect("gash", "hamstring-cut", "bleed"),
  "dawnward-blow": effect("impact", "dawnward-blow", "radiant"),
  "pealing-blows": effect("impact", "pealing-blows", "peal"),
  sunbreak: effect("impact", "sunbreak", "radiant"),
  "staff-bolt": effect("arcane", "staff-bolt", "bolt"),
  "forked-bolt": effect("lightning", "forked-bolt", "fork"),
  "cinder-mark": effect("fire", "cinder-mark", "brand"),
  "kingsguard-riposte": effect("slash", "kingsguard-riposte", "counter"),
  "double-reply": effect("slash", "double-reply", "cross"),
  "binding-cut": effect("slash", "binding-cut", "bind"),
  "nightfang-hush": effect("gash", "nightfang-hush", "shadow"),
  "threefold-shadow": effect("gash", "threefold-shadow", "shadow-flurry"),
  "silencing-cut": effect("slash", "silencing-cut", "silence"),
  "wyrmscale-cleave": effect("slash", "wyrmscale-cleave", "heavy"),
  "dragons-wake": effect("slash", "dragons-wake", "rolling"),
  "sundering-flame": effect("fire", "sundering-flame", "inferno"),
});

const STATUS_EFFECTS = Object.freeze({
  bleed: effect("gash", "status-bleed", "bleed"),
  "bleed-atk": effect("gash", "status-bleed-atk", "bleed"),
  berserk: effect("fire", "status-berserk", "aura"),
  burn: effect("fire", "status-burn", "brand"),
  charge: effect("lightning", "status-charge", "charge"),
  conceal: effect("evade", "status-conceal", "afterimage"),
  cripple: effect("afflict", "status-cripple", "bind"),
  doom: effect("afflict", "status-doom", "void"),
  "doom-atk": effect("afflict", "status-doom-atk", "void"),
  evade: effect("evade", "status-evade", "afterimage"),
  eviscerate: effect("gash", "status-eviscerate", "execution"),
  focus: effect("arcane", "status-focus", "aura"),
  guard: effect("ward", "status-guard", "brace"),
  grow: effect("heal", "status-grow", "aura"),
  haste: effect("lightning", "status-haste", "rapid"),
  invincible: effect("ward", "status-invincible", "fortress"),
  lethargy: effect("afflict", "status-lethargy", "bind"),
  "lethargy-atk": effect("afflict", "status-lethargy-atk", "bind"),
  lifesteal: effect("gash", "status-lifesteal", "siphon"),
  misfortune: effect("afflict", "status-misfortune", "fate"),
  overload: effect("lightning", "status-overload", "charge"),
  paralyze: effect("lightning", "status-paralyze", "snap"),
  poison: effect("afflict", "status-poison", "smoke"),
  "poison-atk": effect("afflict", "status-poison-atk", "smoke"),
  priority: effect("arcane", "status-priority", "aura"),
  protection: effect("ward", "status-protection", "brace"),
  sharpen: effect("slash", "status-sharpen", "aura"),
  sleep: effect("afflict", "status-sleep", "smoke"),
  solidity: effect("ward", "status-solidity", "brace"),
  steelskin: effect("ward", "status-steelskin", "fortress"),
  strength: effect("fire", "status-strength", "aura"),
  stun: effect("lightning", "status-stun", "snap"),
  swift: effect("evade", "status-swift", "rapid"),
  tenacity: effect("ward", "status-tenacity", "unyielding"),
  thorn: effect("gash", "status-thorn", "counter"),
  unstoppable: effect("ward", "status-unstoppable", "unyielding"),
  weak: effect("afflict", "status-weak", "bind"),
  initiative: effect("evade", "status-initiative", "rapid"),
  judgment: effect("lightning", "status-judgment", "radiant"),
  limp: effect("afflict", "status-limp", "bind"),
  skeleton: effect("arcane", "status-skeleton", "summon"),
  vulnerable: effect("afflict", "status-vulnerable", "bind"),
});

function slug(value, fallback = "unknown") {
  const normalized = String(value || fallback).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return normalized || fallback;
}

function familyFromText(value) {
  const text = String(value || "").toLowerCase();
  if (/(arrow|bolt|jab|lance|pin|pierc|shot|spear|thrust)/.test(text)) return "pierce";
  if (/(burn|cinder|ember|fire|flame|inferno)/.test(text)) return "fire";
  if (/(lightning|shock|storm|thunder)/.test(text)) return "lightning";
  if (/(arcane|magic|rune|spell)/.test(text)) return "arcane";
  if (/(frost|ice|cold|winter)/.test(text)) return "frost";
  if (/(gash|claw|rend|bleed|fang)/.test(text)) return "gash";
  if (/(smash|slam|maul|crush|blow|punch|strike)/.test(text)) return "impact";
  return "slash";
}

function withAsset(spec) {
  return { ...spec, asset: bespokeVfxAsset(spec) };
}

function inferredSkillEffect(skillId) {
  const definition = getSkill(skillId);
  if (!definition) return null;
  const effects = definition.effects || [];
  const statusEffect = effects.find((entry) => entry.type === "status" || entry.type === "scaled-status");
  const damageEffect = effects.find((entry) => entry.type === "damage" || entry.type === "lost-health-damage");
  const hasShield = effects.some((entry) => entry.type === "shield");
  const hasHeal = effects.some((entry) => entry.type === "heal" || entry.type === "heal-lost-fraction" || entry.type === "reduce-statuses");
  const statusVisual = statusEffect && STATUS_EFFECTS[statusEffect.status];
  const identity = `${skillId} ${definition.name || ""} ${statusEffect?.status || ""}`;

  let family = statusVisual?.family || familyFromText(identity);
  if (hasShield && !damageEffect) family = "ward";
  else if (hasHeal && !damageEffect) family = "heal";

  let motion = statusVisual?.motion || "balanced";
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

  return effect(family, skillId, motion);
}

function skillEffectFor(skillId) {
  return SKILL_EFFECTS[skillId] || inferredSkillEffect(skillId);
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
  if (!intent) return withAsset(effect("impact", "intent-attack", "balanced"));
  const family = familyFromText(`${intent.attackId || ""} ${intent.name || ""}`);
  return withAsset(effect(family, `intent-${slug(intent.attackId || intent.name, "attack")}`, intent.hits > 1 ? "multi" : "balanced"));
}

export function combatVfxForStatus(status) {
  const spec = STATUS_EFFECTS[status] || effect("afflict", `status-${slug(status, "unknown")}`, "balanced");
  return withAsset(spec);
}

/** Resolve only presentation metadata from the authoritative event; mechanics stay in the kernel. */
export function combatVfxForEvent(encounter, event) {
  if (!event) return withAsset(effect("impact", "unknown", "balanced"));

  if (event.type === "enemy-attack") {
    const attack = attackDefinition(encounter, event);
    const identity = `${event.attackId || ""} ${attack?.name || ""}`;
    const family = familyFromText(identity);
    return withAsset(effect(family, `enemy-${slug(event.attackId, "attack")}`, (event.hits?.length || attack?.hits || 1) > 1 ? "multi" : "heavy"));
  }

  if (event.type === "tick-damage") {
    return withAsset(event.burn > 0 ? STATUS_EFFECTS.burn : STATUS_EFFECTS.doom);
  }

  const skillVariant = event.skillId && skillEffectFor(event.skillId);
  if (event.type === "skill-shield") {
    return withAsset(effect("ward", `${slug(event.skillId, "ward")}-ward`, skillVariant?.motion || "brace"));
  }
  if (event.type === "skill-heal" || event.type === "skill-cleanse") {
    return withAsset(effect("heal", `${slug(event.skillId, "heal")}-heal`, skillVariant?.motion || "mend"));
  }
  if (event.type === "skill-status" && event.status && STATUS_EFFECTS[event.status]) {
    const statusVariant = STATUS_EFFECTS[event.status];
    return withAsset(effect(
      statusVariant.family,
      `${slug(event.skillId, "skill")}-${slug(event.status, "status")}`,
      statusVariant.motion,
    ));
  }
  if (event.type === "skill-status-amplified") {
    return withAsset(effect("afflict", `${slug(event.skillId, "skill")}-amplified`, "void"));
  }

  const formId = event.skillId === "strike" ? activeFormId(encounter, event) : null;
  if (formId && FORM_EFFECTS[formId]) return withAsset(FORM_EFFECTS[formId]);
  if (skillVariant) return withAsset(skillVariant);
  if (event.status && STATUS_EFFECTS[event.status]) return withAsset(STATUS_EFFECTS[event.status]);

  if (event.type === "enemy-nullified") return withAsset(effect("afflict", "enemy-interrupted", "snap"));
  if (event.type === "actor-nullified") {
    const control = event.controls?.[0];
    return control && STATUS_EFFECTS[control]
      ? withAsset(STATUS_EFFECTS[control])
      : withAsset(effect("afflict", "command-nullified", "snap"));
  }
  if (event.type === "actor-preempted") return withAsset(STATUS_EFFECTS.priority);
  if (event.type === "retreat-attempt") return withAsset(effect(event.succeeded ? "evade" : "afflict", event.succeeded ? "retreat-escaped" : "retreat-cornered", event.succeeded ? "afterimage" : "bind"));

  const family = familyFromText(`${event.skillId || ""} ${event.attackId || ""}`);
  return withAsset(effect(family, `event-${slug(event.skillId || event.attackId || event.type)}`, "balanced"));
}

export function combatVfxVariantForSkill(skillId) {
  const spec = skillEffectFor(skillId);
  return spec ? withAsset(spec) : null;
}

export function combatVfxVariantForForm(formId) {
  return FORM_EFFECTS[formId] ? withAsset(FORM_EFFECTS[formId]) : null;
}
