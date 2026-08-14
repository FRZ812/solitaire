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
import { getSkill } from "../../gameplay/tow/skills.js";
import { resolveTowAbilityArt, resolveTowIntentArt } from "./tow-combat-ability-art.js";

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

function effect(family, variant, motion = "balanced") {
  return Object.freeze({ family, variant, motion });
}

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
    rotate: `${(hash % 31) - 15}deg`,
    scale: (0.9 + ((hash >>> 5) % 19) / 100).toFixed(2),
    x: `${((hash >>> 10) % 17) - 8}%`,
    y: `${((hash >>> 15) % 15) - 7}%`,
    delay: `${(hash >>> 20) % 90}ms`,
    mirror: hash % 2 === 0 ? 1 : -1,
  });
}

function withAsset(spec, signatureAsset = null) {
  return Object.freeze({
    ...spec,
    asset: COMBAT_VFX_ASSETS[spec.family] || COMBAT_VFX_ASSETS.impact,
    signatureAsset,
    profile: visualProfile(spec.variant),
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

function signatureForSkill(skillId, weaponPresentation = null) {
  const definition = safeSkill(skillId);
  return definition ? resolveTowAbilityArt(definition, weaponPresentation) : null;
}

function familyForForm(formId) {
  const value = String(formId || "");
  if (/(arrow|bow|volley|pinning)/.test(value)) return "bow";
  if (/(dagger|nightfang|shadow|silencing)/.test(value)) return "dagger";
  if (/(mace|dawnward|pealing|sunbreak)/.test(value)) return "mace";
  if (/(staff|bolt|cinder|arcane)/.test(value)) return "arcane";
  if (/(spear|thrust)/.test(value)) return "spear";
  if (/(axe)/.test(value)) return "axe";
  if (/(unarmed)/.test(value)) return "unarmed";
  return "sword";
}

function signatureForForm(formId) {
  return resolveTowAbilityArt(safeSkill("strike"), {
    activeFormId: formId,
    family: familyForForm(formId),
  });
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
  "initiative-atk": effect("evade", "status-initiative-atk", "rapid"),
  judgment: effect("lightning", "status-judgment", "radiant"),
  limp: effect("afflict", "status-limp", "bind"),
  skeleton: effect("arcane", "status-skeleton", "summon"),
  vulnerable: effect("afflict", "status-vulnerable", "bind"),
});

function icon(asset, column, row) {
  return Object.freeze({
    iconAsset: asset,
    iconPosition: `${column * 100}% ${row * 100}%`,
    iconSize: "200% 200%",
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

function inferredSkillEffect(skillId) {
  const definition = safeSkill(skillId);
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
  const skillVisual = intent?.skillId ? skillEffectFor(intent.skillId) : null;
  let family = skillVisual?.family || familyFromText(`${intent?.attackId || ""} ${intent?.name || ""}`);
  if (intent?.kind === "ward") family = "ward";
  else if (intent?.kind === "recover") family = "heal";
  else if (intent?.kind === "afflict" && !skillVisual) family = "afflict";
  const spec = effect(
    family,
    `intent-${slug(intent?.skillId || intent?.attackId || intent?.name, "attack")}`,
    skillVisual?.motion || (intent?.hits > 1 ? "multi" : "balanced"),
  );
  return Object.freeze({
    ...spec,
    asset: resolveTowIntentArt(intent, family),
    vfxAsset: COMBAT_VFX_ASSETS[family] || COMBAT_VFX_ASSETS.impact,
    profile: visualProfile(spec.variant),
  });
}

export function combatVfxForStatus(status) {
  const spec = STATUS_EFFECTS[status] || effect("afflict", `status-${slug(status, "unknown")}`, "balanced");
  const iconVisual = STATUS_ICONS[status] || STATUS_ICONS.doom;
  return Object.freeze({ ...withAsset(spec), ...iconVisual });
}

/** Resolve only presentation metadata from the authoritative event; mechanics stay in the kernel. */
export function combatVfxForEvent(encounter, event) {
  if (!event) return withAsset(effect("impact", "unknown", "balanced"));

  if (event.type === "enemy-attack") {
    const attack = attackDefinition(encounter, event);
    const skillVisual = attack?.skillId ? skillEffectFor(attack.skillId) : null;
    const identity = `${event.attackId || ""} ${attack?.name || ""}`;
    const family = skillVisual?.family || familyFromText(identity);
    const spec = effect(
      family,
      `enemy-${slug(event.attackId, "attack")}`,
      skillVisual?.motion || ((event.hits?.length || attack?.hits || 1) > 1 ? "multi" : "heavy"),
    );
    const signature = resolveTowIntentArt({
      attackId: event.attackId,
      skillId: attack?.skillId,
      name: attack?.name,
    }, family);
    return withAsset(spec, signature);
  }

  if (event.type === "tick-damage") {
    const type = event.burn > 0 ? "burn" : event.doom > 0 ? "doom" : event.poison > 0 ? "poison" : event.bleed > 0 ? "bleed" : "misfortune";
    return combatVfxForStatus(type);
  }

  const skillVariant = event.skillId && skillEffectFor(event.skillId);
  const signature = signatureForSkill(event.skillId);
  if (event.type === "skill-shield") {
    return withAsset(effect("ward", `${slug(event.skillId, "ward")}-ward`, skillVariant?.motion || "brace"), signature);
  }
  if (event.type === "ward-expired") {
    return withAsset(effect("ward", "ward-expired", "shatter"));
  }
  if (event.type === "skill-heal" || event.type === "skill-cleanse") {
    return withAsset(effect("heal", `${slug(event.skillId, "heal")}-heal`, skillVariant?.motion || "mend"), signature);
  }
  if (event.type === "skill-status" && event.status && STATUS_EFFECTS[event.status]) {
    const statusVariant = STATUS_EFFECTS[event.status];
    return withAsset(effect(
      statusVariant.family,
      `${slug(event.skillId, "skill")}-${slug(event.status, "status")}`,
      statusVariant.motion,
    ), signature);
  }
  if (event.type === "skill-status-amplified") {
    return withAsset(effect("afflict", `${slug(event.skillId, "skill")}-amplified`, "void"), signature);
  }

  const formId = event.skillId === "strike" ? activeFormId(encounter, event) : null;
  if (formId && FORM_EFFECTS[formId]) return withAsset(FORM_EFFECTS[formId], signatureForForm(formId));
  if (skillVariant) return withAsset(skillVariant, signature);
  if (event.status && STATUS_EFFECTS[event.status]) return combatVfxForStatus(event.status);

  if (event.type === "enemy-nullified") return withAsset(effect("afflict", "enemy-interrupted", "snap"));
  if (event.type === "actor-nullified") {
    const control = event.controls?.[0];
    return control && STATUS_EFFECTS[control]
      ? combatVfxForStatus(control)
      : withAsset(effect("afflict", "command-nullified", "snap"));
  }
  if (event.type === "actor-preempted") return combatVfxForStatus("priority");
  if (event.type === "retreat-attempt") return withAsset(effect(event.succeeded ? "evade" : "afflict", event.succeeded ? "retreat-escaped" : "retreat-cornered", event.succeeded ? "afterimage" : "bind"));

  const family = familyFromText(`${event.skillId || ""} ${event.attackId || ""}`);
  return withAsset(effect(family, `event-${slug(event.skillId || event.attackId || event.type)}`, "balanced"), signature);
}

export function combatVfxVariantForSkill(skillId) {
  const spec = skillEffectFor(skillId);
  return spec ? withAsset(spec, signatureForSkill(skillId)) : null;
}

export function combatVfxVariantForForm(formId) {
  return FORM_EFFECTS[formId] ? withAsset(FORM_EFFECTS[formId], signatureForForm(formId)) : null;
}
