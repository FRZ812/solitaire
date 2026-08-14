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

  // Fixed four-action kits for the authored Tower of Winter roster.
  "arctic-strike": effect("slash", "arctic-strike", "measured"),
  "arctic-block": effect("ward", "arctic-block", "brace"),
  "arctic-deliberate-blow": effect("impact", "arctic-deliberate-blow", "heavy"),
  "arctic-incineration": effect("fire", "arctic-incineration", "inferno"),
  "demon-shoot": effect("pierce", "demon-shoot", "projectile"),
  "demon-evasion": effect("evade", "demon-evasion", "afterimage"),
  "demon-kick": effect("impact", "demon-kick", "rapid"),
  "demon-arrow-rain": effect("pierce", "demon-arrow-rain", "volley"),
  "clocktower-fire": effect("pierce", "clocktower-fire", "projectile"),
  "clocktower-suppressive-shot": effect("pierce", "clocktower-suppressive-shot", "pin"),
  "clocktower-missile-support": effect("fire", "clocktower-missile-support", "barrage"),
  "clocktower-redesign": effect("lightning", "clocktower-redesign", "charge"),
  "north-king-cleave": effect("slash", "north-king-cleave", "heavy"),
  "north-king-vitality": effect("heal", "north-king-vitality", "mend"),
  "north-king-whirlwind": effect("slash", "north-king-whirlwind", "cyclone"),
  "north-king-earthquake": effect("impact", "north-king-earthquake", "quake"),
  "sleepless-flame-strike": effect("fire", "sleepless-flame-strike", "brand"),
  "sleepless-flame-curtain": effect("fire", "sleepless-flame-curtain", "curtain"),
  "sleepless-entangling-roots": effect("afflict", "sleepless-entangling-roots", "bind"),
  "sleepless-high-speed-flight": effect("evade", "sleepless-high-speed-flight", "afterimage"),
  "assassin-flurry": effect("slash", "assassin-flurry", "flurry"),
  "assassin-deflect": effect("ward", "assassin-deflect", "counter"),
  "assassin-flash-bomb": effect("lightning", "assassin-flash-bomb", "flash"),
  "assassin-execution": effect("gash", "assassin-execution", "execution"),
  "witch-skull-throw": effect("arcane", "witch-skull-throw", "projectile"),
  "witch-bone-shield": effect("ward", "witch-bone-shield", "fortress"),
  "witch-skeleton-summon": effect("arcane", "witch-skeleton-summon", "summon"),
  "witch-all-out-attack": effect("gash", "witch-all-out-attack", "barrage"),
  "mage-magic-arrow": effect("arcane", "mage-magic-arrow", "bolt"),
  "mage-barrier": effect("ward", "mage-barrier", "fortress"),
  "mage-flame-storm": effect("fire", "mage-flame-storm", "inferno"),
  "mage-amplification": effect("arcane", "mage-amplification", "ascend"),
  "priestess-crush": effect("impact", "priestess-crush", "radiant"),
  "priestess-holy-shield": effect("ward", "priestess-holy-shield", "radiant"),
  "priestess-wrath-of-heaven": effect("lightning", "priestess-wrath-of-heaven", "radiant"),
  "priestess-doom": effect("afflict", "priestess-doom", "void"),
  "blade-slash": effect("slash", "blade-slash", "measured"),
  "blade-barrier": effect("ward", "blade-barrier", "counter"),
  "blade-chi-liberation": effect("arcane", "blade-chi-liberation", "ascend"),
  "blade-one-flash": effect("slash", "blade-one-flash", "execution"),
  "vampire-claw": effect("gash", "vampire-claw", "rapid"),
  "vampire-blood-thirst": effect("heal", "vampire-blood-thirst", "siphon"),
  "vampire-heart-destroyer": effect("gash", "vampire-heart-destroyer", "execution"),
  "vampire-rampage": effect("gash", "vampire-rampage", "flurry"),
  "automaton-bombardment": effect("fire", "automaton-bombardment", "barrage"),
  "automaton-repair": effect("heal", "automaton-repair", "mend"),
  "automaton-emergency-cooling": effect("frost", "automaton-emergency-cooling", "snap"),
  "automaton-fate-manipulator": effect("lightning", "automaton-fate-manipulator", "charge"),
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
  burn: effect("fire", "status-burn", "brand"),
  charge: effect("lightning", "status-charge", "charge"),
  conceal: effect("evade", "status-conceal", "afterimage"),
  doom: effect("afflict", "status-doom", "void"),
  evade: effect("evade", "status-evade", "afterimage"),
  focus: effect("arcane", "status-focus", "aura"),
  guard: effect("ward", "status-guard", "brace"),
  haste: effect("lightning", "status-haste", "rapid"),
  invincible: effect("ward", "status-invincible", "fortress"),
  lethargy: effect("afflict", "status-lethargy", "bind"),
  lifesteal: effect("gash", "status-lifesteal", "siphon"),
  misfortune: effect("afflict", "status-misfortune", "fate"),
  overload: effect("lightning", "status-overload", "charge"),
  paralyze: effect("lightning", "status-paralyze", "snap"),
  poison: effect("afflict", "status-poison", "smoke"),
  priority: effect("arcane", "status-priority", "aura"),
  protection: effect("ward", "status-protection", "brace"),
  sleep: effect("afflict", "status-sleep", "smoke"),
  solidity: effect("ward", "status-solidity", "brace"),
  steelskin: effect("ward", "status-steelskin", "fortress"),
  strength: effect("fire", "status-strength", "aura"),
  stun: effect("lightning", "status-stun", "snap"),
  swift: effect("evade", "status-swift", "rapid"),
  tenacity: effect("ward", "status-tenacity", "unyielding"),
  thorn: effect("gash", "status-thorn", "counter"),
  unstoppable: effect("ward", "status-unstoppable", "unyielding"),
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
  return { ...spec, asset: COMBAT_VFX_ASSETS[spec.family] || COMBAT_VFX_ASSETS.impact };
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

  const skillVariant = event.skillId && SKILL_EFFECTS[event.skillId];
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
  if (event.type === "retreat-attempt") return withAsset(effect(event.succeeded ? "evade" : "afflict", event.succeeded ? "retreat-escaped" : "retreat-cornered", event.succeeded ? "afterimage" : "bind"));

  const family = familyFromText(`${event.skillId || ""} ${event.attackId || ""}`);
  return withAsset(effect(family, `event-${slug(event.skillId || event.attackId || event.type)}`, "balanced"));
}

export function combatVfxVariantForSkill(skillId) {
  return SKILL_EFFECTS[skillId] ? withAsset(SKILL_EFFECTS[skillId]) : null;
}

export function combatVfxVariantForForm(formId) {
  return FORM_EFFECTS[formId] ? withAsset(FORM_EFFECTS[formId]) : null;
}
