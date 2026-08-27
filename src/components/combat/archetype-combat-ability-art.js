import weaponDagger from "../../assets/generated/combat-abilities/weapon-dagger.webp";
import weaponSword from "../../assets/generated/combat-abilities/weapon-sword.webp";
import weaponAxe from "../../assets/generated/combat-abilities/weapon-axe.webp";
import weaponMace from "../../assets/generated/combat-abilities/weapon-mace.webp";
import weaponSpear from "../../assets/generated/combat-abilities/weapon-spear.webp";
import weaponBow from "../../assets/generated/combat-abilities/weapon-bow.webp";
import weaponCrossbow from "../../assets/generated/combat-abilities/weapon-crossbow.webp";
import weaponArcane from "../../assets/generated/combat-abilities/weapon-arcane.webp";
import weaponUnarmed from "../../assets/generated/combat-abilities/weapon-unarmed.webp";

import itemArmingSword from "../../assets/generated/combat-abilities/item-arming-sword.webp";
import itemHuntingBow from "../../assets/generated/combat-abilities/item-hunting-bow.webp";
import itemTwinDaggers from "../../assets/generated/combat-abilities/item-twin-daggers.webp";
import itemDawnwardMace from "../../assets/generated/combat-abilities/item-dawnward-mace.webp";
import itemOakStaff from "../../assets/generated/combat-abilities/item-oak-staff.webp";
import itemKingsguardBlade from "../../assets/generated/combat-abilities/item-kingsguard-blade.webp";
import itemNightfangDagger from "../../assets/generated/combat-abilities/item-nightfang-dagger.webp";
import itemWyrmscaleGreatblade from "../../assets/generated/combat-abilities/item-wyrmscale-greatblade.webp";

import attackCrossingCuts from "../../assets/generated/combat-abilities/attack-crossing-cuts.webp";
import attackHamperingCut from "../../assets/generated/combat-abilities/attack-hampering-cut.webp";
import attackSplitVolley from "../../assets/generated/combat-abilities/attack-split-volley.webp";
import attackPinningArrow from "../../assets/generated/combat-abilities/attack-pinning-arrow.webp";
import attackThreefoldCut from "../../assets/generated/combat-abilities/attack-threefold-cut.webp";
import attackHamstringCut from "../../assets/generated/combat-abilities/attack-hamstring-cut.webp";
import attackPealingBlows from "../../assets/generated/combat-abilities/attack-pealing-blows.webp";
import attackSunbreak from "../../assets/generated/combat-abilities/attack-sunbreak.webp";
import attackForkedBolt from "../../assets/generated/combat-abilities/attack-forked-bolt.webp";
import attackCinderMark from "../../assets/generated/combat-abilities/attack-cinder-mark.webp";
import attackDoubleReply from "../../assets/generated/combat-abilities/attack-double-reply.webp";
import attackBindingCut from "../../assets/generated/combat-abilities/attack-binding-cut.webp";
import attackThreefoldShadow from "../../assets/generated/combat-abilities/attack-threefold-shadow.webp";
import attackSilencingCut from "../../assets/generated/combat-abilities/attack-silencing-cut.webp";
import attackDragonsWake from "../../assets/generated/combat-abilities/attack-dragons-wake.webp";
import attackSunderingFlame from "../../assets/generated/combat-abilities/attack-sundering-flame.webp";

import skillBlock from "../../assets/generated/combat-abilities/skill-block.webp";
import skillWarcry from "../../assets/generated/combat-abilities/skill-warcry.webp";
import skillDeliberateBlow from "../../assets/generated/combat-abilities/skill-deliberate-blow.webp";
import skillSuddenBlow from "../../assets/generated/combat-abilities/skill-sudden-blow.webp";
import skillPenetration from "../../assets/generated/combat-abilities/skill-penetration.webp";
import skillEmergencyEvasion from "../../assets/generated/combat-abilities/skill-emergency-evasion.webp";
import skillSlaughter from "../../assets/generated/combat-abilities/skill-slaughter.webp";
import skillFirstAid from "../../assets/generated/combat-abilities/skill-first-aid.webp";
import skillImpregnable from "../../assets/generated/combat-abilities/skill-impregnable.webp";
import skillRapidCooling from "../../assets/generated/combat-abilities/skill-rapid-cooling.webp";
import skillShieldBash from "../../assets/generated/combat-abilities/skill-shield-bash.webp";
import skillElixirOfWrath from "../../assets/generated/combat-abilities/skill-elixir-of-wrath.webp";
import skillMortalBlow from "../../assets/generated/combat-abilities/skill-mortal-blow.webp";
import skillDefenceFallback from "../../assets/generated/combat-abilities/skill-defence-fallback.webp";
import skillSwiftFallback from "../../assets/generated/combat-abilities/skill-swift-fallback.webp";
import skillTechniqueFallback from "../../assets/generated/combat-abilities/skill-technique-fallback.webp";
import skillDefensiveStance from "../../assets/generated/combat/legacy-abilities/defensive-stance-v1.png";
import skillParry from "../../assets/generated/combat/legacy-abilities/parry-v1.png";
import skillThreateningCry from "../../assets/generated/combat/legacy-abilities/threatening-cry-v1.png";
import skillGiantsSmash from "../../assets/generated/combat/legacy-abilities/giants-smash-v1.png";
import skillFistOfJustice from "../../assets/generated/combat/legacy-abilities/fist-of-justice-v1.png";
import skillRetaliation from "../../assets/generated/combat/legacy-abilities/retaliation-v1.png";
import skillIncineration from "../../assets/generated/combat/legacy-abilities/incineration-v1.png";
import skillRisingPower from "../../assets/generated/combat/legacy-abilities/rising-power-v1.png";
import skillShouting from "../../assets/generated/combat/legacy-abilities/shouting-v1.png";
import skillThirstForBlood from "../../assets/generated/combat/legacy-abilities/thirst-for-blood-v1.png";
import { characterAbilityIds } from "../../gameplay/combat/character-abilities.js";
import { generalAbilityIds, getSkill } from "../../gameplay/combat/skills.js";

const GENERATED_COMBAT_ABILITY_ART = import.meta.glob(
  "../../assets/generated/combat/abilities/*.webp",
  { eager: true, import: "default" },
);

function generatedCombatAbilityArt(abilityId) {
  const key = `../../assets/generated/combat/abilities/${abilityId}-v1.webp`;
  return GENERATED_COMBAT_ABILITY_ART[key] || null;
}

const COMBAT_ABILITY_ART = Object.freeze(Object.fromEntries(
  [...characterAbilityIds(), ...generalAbilityIds()]
    .map((abilityId) => [abilityId, generatedCombatAbilityArt(abilityId)]),
));

const FAMILY_ART = Object.freeze({
  dagger: weaponDagger,
  sword: weaponSword,
  axe: weaponAxe,
  mace: weaponMace,
  spear: weaponSpear,
  bow: weaponBow,
  crossbow: weaponCrossbow,
  arcane: weaponArcane,
  unarmed: weaponUnarmed,
});

const ITEM_ART = Object.freeze({
  "arming-sword": itemArmingSword,
  "hunting-bow": itemHuntingBow,
  "twin-daggers": itemTwinDaggers,
  "dawnward-mace": itemDawnwardMace,
  "oak-staff": itemOakStaff,
  "kingsguard-blade": itemKingsguardBlade,
  "nightfang-dagger": itemNightfangDagger,
  "wyrmscale-greatblade": itemWyrmscaleGreatblade,
});

// Rank-up-in-place forms retain the weapon's authored base icon. Optional branches get
// distinct ImageGen art so a three-hit attack and a single-hit debuff never masquerade as
// the same button.
const ATTACK_FORM_ART = Object.freeze({
  "crossing-cuts": attackCrossingCuts,
  "hampering-cut": attackHamperingCut,
  "split-volley": attackSplitVolley,
  "pinning-arrow": attackPinningArrow,
  "threefold-cut": attackThreefoldCut,
  "hamstring-cut": attackHamstringCut,
  "pealing-blows": attackPealingBlows,
  sunbreak: attackSunbreak,
  "forked-bolt": attackForkedBolt,
  "cinder-mark": attackCinderMark,
  "double-reply": attackDoubleReply,
  "binding-cut": attackBindingCut,
  "threefold-shadow": attackThreefoldShadow,
  "silencing-cut": attackSilencingCut,
  "dragons-wake": attackDragonsWake,
  "sundering-flame": attackSunderingFlame,
});

const SKILL_ART = Object.freeze({
  block: skillBlock,
  warcry: skillWarcry,
  "deliberate-blow": skillDeliberateBlow,
  "sudden-blow": skillSuddenBlow,
  penetration: skillPenetration,
  "emergency-evasion": skillEmergencyEvasion,
  slaughter: skillSlaughter,
  "first-aid": skillFirstAid,
  impregnable: skillImpregnable,
  "rapid-cooling": skillRapidCooling,
  "shield-bash": skillShieldBash,
  "elixir-of-wrath": skillElixirOfWrath,
  "mortal-blow": skillMortalBlow,
  "defensive-stance": skillDefensiveStance,
  parry: skillParry,
  "threatening-cry": skillThreateningCry,
  "giants-smash": skillGiantsSmash,
  "fist-of-justice": skillFistOfJustice,
  retaliation: skillRetaliation,
  incineration: skillIncineration,
  "rising-power": skillRisingPower,
  shouting: skillShouting,
  "thirst-for-blood": skillThirstForBlood,
  "stone-skin-elixir": generatedCombatAbilityArt("stone-skin-elixir"),
  "protection-scroll": generatedCombatAbilityArt("protection-scroll"),
  "killing-instinct": generatedCombatAbilityArt("killing-instinct"),
  "blade-of-curse": generatedCombatAbilityArt("blade-of-curse"),
  beastification: generatedCombatAbilityArt("beastification"),
  "super-speed": generatedCombatAbilityArt("super-speed"),
  "peace-declaration": generatedCombatAbilityArt("peace-declaration"),
  "urgent-guard": generatedCombatAbilityArt("urgent-guard"),
  "unbendable-will": generatedCombatAbilityArt("unbendable-will"),
  "sleep-grenade": generatedCombatAbilityArt("sleep-grenade"),
  "judge-of-fate": generatedCombatAbilityArt("judge-of-fate"),
  transcendence: generatedCombatAbilityArt("transcendence"),
  ...COMBAT_ABILITY_ART,
});

/**
 * Resolve generated ability art without changing the underlying Archetype skill id.
 * Strike is the one equipment-led slot; every authored ability keeps its own art.
 */
export function resolveCombatAbilityArt(definition, weaponPresentation) {
  if (definition?.id === "strike") {
    const formId = weaponPresentation?.activeFormId || weaponPresentation?.attackSnapshot?.formId;
    const itemId = weaponPresentation?.itemId;
    const family = weaponPresentation?.family || "unarmed";
    return ATTACK_FORM_ART[formId] || ITEM_ART[itemId] || FAMILY_ART[family] || FAMILY_ART.unarmed;
  }
  if (definition?.id && SKILL_ART[definition.id]) return SKILL_ART[definition.id];
  if (definition?.replaces === "block") return skillDefenceFallback;
  if (definition?.consumesTurn === false) return skillSwiftFallback;
  return skillTechniqueFallback;
}

const INTENT_FAMILY_WEAPON = Object.freeze({
  afflict: "arcane",
  arcane: "arcane",
  evade: "dagger",
  fire: "arcane",
  frost: "arcane",
  gash: "dagger",
  heal: "arcane",
  impact: "mace",
  lightning: "arcane",
  pierce: "spear",
  slash: "sword",
  ward: "mace",
  wind: "sword",
});

/** Enemy declarations use the exact queued skill icon whenever the durable intent has one. */
export function resolveCombatIntentArt(intent, family = "impact") {
  const abilityId = intent?.skillId || intent?.attackId;
  const definition = abilityId ? getSkill(abilityId) : null;
  if (definition) return resolveCombatAbilityArt(definition, intent?.weaponPresentation);
  if (intent?.attackId && ATTACK_FORM_ART[intent.attackId]) return ATTACK_FORM_ART[intent.attackId];
  return FAMILY_ART[INTENT_FAMILY_WEAPON[family] || "unarmed"] || FAMILY_ART.unarmed;
}

export function resolveCombatActionName(definition, weaponPresentation) {
  return definition?.id === "strike"
    ? (weaponPresentation?.actionName || "Unarmed Strike")
    : definition?.name || "Action";
}
