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
import { characterAbilityIds } from "../../gameplay/tow/character-abilities.js";
import { combatVfxVariantForSkill } from "./tow-combat-vfx.js";

const GENERATED_TOW_ABILITY_ART = import.meta.glob(
  "../../assets/generated/winter-tower/abilities/*.webp",
  { eager: true, import: "default" },
);

const FALLBACK_PALETTES = Object.freeze({
  afflict: ["#2b1437", "#b56ce8"],
  arcane: ["#171936", "#9f8cff"],
  evade: ["#102d2d", "#8fe9dc"],
  fire: ["#3b140d", "#ff7b35"],
  frost: ["#102a35", "#9eeaff"],
  gash: ["#3a101d", "#f05270"],
  heal: ["#18301b", "#a7de7c"],
  impact: ["#34230f", "#f3b95b"],
  lightning: ["#10263a", "#72d9ff"],
  pierce: ["#102733", "#83dff4"],
  slash: ["#381812", "#ef725c"],
  ward: ["#112b36", "#82d6ee"],
});

function abilityHash(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function proceduralTowAbilityArt(abilityId) {
  const visual = combatVfxVariantForSkill(abilityId);
  const [deep, accent] = FALLBACK_PALETTES[visual?.family] || FALLBACK_PALETTES.impact;
  const hash = abilityHash(abilityId);
  const tilt = (hash % 46) - 23;
  const spokes = 5 + (hash % 5);
  const initials = abilityId.split("-").slice(-2).map((word) => word[0]).join("").toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <defs>
      <radialGradient id="g" cx="50%" cy="42%" r="72%"><stop stop-color="${accent}" stop-opacity=".56"/><stop offset=".54" stop-color="${deep}"/><stop offset="1" stop-color="#05090b"/></radialGradient>
      <filter id="b"><feGaussianBlur stdDeviation="7"/></filter>
    </defs>
    <rect width="256" height="256" fill="url(#g)"/>
    <circle cx="128" cy="122" r="74" fill="none" stroke="${accent}" stroke-opacity=".24" stroke-width="3" stroke-dasharray="8 11" transform="rotate(${tilt} 128 122)"/>
    <g transform="translate(128 122) rotate(${tilt})" stroke="${accent}" stroke-linecap="round">
      ${Array.from({ length: spokes }, (_, index) => `<path d="M0 -20 L${Math.round(Math.sin((index / spokes) * Math.PI * 2) * 78)} ${Math.round(-Math.cos((index / spokes) * Math.PI * 2) * 78)}" stroke-opacity="${0.24 + (index % 3) * 0.13}" stroke-width="${3 + (index % 2) * 2}"/>`).join("")}
    </g>
    <circle cx="128" cy="122" r="34" fill="${accent}" fill-opacity=".18" filter="url(#b)"/>
    <path d="M78 128 Q128 64 178 128 Q128 192 78 128Z" fill="none" stroke="${accent}" stroke-width="6"/>
    <circle cx="128" cy="128" r="14" fill="${accent}"/>
    <text x="128" y="230" text-anchor="middle" fill="#fff4de" fill-opacity=".86" font-family="Georgia,serif" font-size="24" letter-spacing="5">${initials}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function generatedTowAbilityArt(abilityId) {
  const key = `../../assets/generated/winter-tower/abilities/${abilityId}-v1.webp`;
  return GENERATED_TOW_ABILITY_ART[key] || proceduralTowAbilityArt(abilityId);
}

const TOW_ABILITY_ART = Object.freeze(Object.fromEntries(
  characterAbilityIds().map((abilityId) => [abilityId, generatedTowAbilityArt(abilityId)]),
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
  ...TOW_ABILITY_ART,
});

/**
 * Resolve generated ability art without changing the underlying Tower skill id.
 * Strike is the one equipment-led slot; every authored ability keeps its own art.
 */
export function resolveTowAbilityArt(definition, weaponPresentation) {
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

export function resolveTowActionName(definition, weaponPresentation) {
  return definition?.id === "strike"
    ? (weaponPresentation?.actionName || "Unarmed Strike")
    : definition?.name || "Action";
}
