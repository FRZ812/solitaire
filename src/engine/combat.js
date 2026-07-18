// The turn-based combat engine. Pure-ish: every exported action takes a combat
// state and returns a NEW one (deep-cloned), so React can drive the UI by
// swapping state. Resolution is client-side and fast — light RNG (damage
// ranges, %-based dodge/crit), no d20s.
//
// Damage pipeline for one hit:
//   dodge check → roll base damage → rally/weaken → crit → vulnerable
//   → mitigate (physical:armor, magical:ward, sonic:acoustic guard, true:none)
// Status effects: bleed/poison (true damage-over-time), stun (skip a turn),
// weaken (−outgoing), vulnerable (+incoming), guard (+armour), rally
// (+outgoing), regen (heal-over-time), focus (+crit, consumed on next hit).
//
// Foes are not stat sheets: each carries a demeanor + morale (see
// data/combat-flavor.js). As a fight turns against them — wounds, fallen
// allies, being stun-locked or out-classed — they may waver, plead, demand a
// fair fight, flee, or yield. The player can also Demand Surrender (parley).

import { getAbilityDef, attrFactor, abilityScaling, abilityRequiredStat, abilityCategoryOf, clampAbilityTier, BASIC_ATTACK, DEFEND, TALK } from "../data/abilities.js";
import { tierMult, tier as tierInfo } from "../data/tiers.js";
import { DEMEANOR_CONFIG, flavorLine } from "../data/combat-flavor.js";
import { weaponMasteryId, XP } from "../data/proficiencies.js";
import { deriveCombatStats, reqEffectiveness } from "./combat-stats.js";
import { seedConditionStatuses } from "./condition-combat.js";
import { chooseAction, estimateHit } from "./combat-ai.js";
import { DARK_ACC_PENALTY, DARK_FLEE_BONUS } from "./light.js";
import { cardDefinition, defaultCombatDeck } from "../data/combat-cards.js";
import { normalizeSeed, shuffleSeeded } from "./combat-rng.js";
// Loot generation + combat→state folding live in sibling leaf modules (Stage 1
// extraction). The turn loop's finish* helpers call rollLoot/lootCtx; App.jsx
// imports applyCombatResult/applyLoot directly from ./combat-result.js.
import { rollLoot, lootCtx } from "./combat-loot.js";
import { mechanicalAttributeValue } from "../data/attribute-tiers.js";
import { progressionCombatEntitlements } from "./progression-abilities.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const rand100 = () => Math.random() * 100;
const clone = (x) => JSON.parse(JSON.stringify(x));
let LOG_SEQ = 0;
const logEntry = (text, kind = "system") => ({ id: `l${Date.now()}-${LOG_SEQ++}`, text, kind });

const CONTROL_TYPES = new Set(["stun", "weaken", "vulnerable", "chill", "curse", "slow", "silence", "charmed", "dominated", "geas", "polymorph", "levelDrain", "misdirected"]);
const RESISTABLE_CONTROL = new Set(["stun", "slow"]); // hard controls Unbowed (controlResist) can shrug off
const MIND_CONTROL = new Set(["charmed", "dominated", "geas"]); // enchantments gated by a WILL save (applyEnemyEffect)
const FEAR_ABILITY_IDS = new Set(["terrify", "mass-terror", "dread-aura", "phantasmal-killer"]);
const BARD_PRESSURE_STATUS = new Set([
  "bardCuttingVerse", "bardDissonance", "bardStingingRefrain", "bardSyncopation",
  "bardCounterMelody", "bardGrandFinale", "bardPointedSatire", "bardHecklersHook",
  "bardChorusScorn", "bardSonicFracture", "bardHarmonicWeave",
]);
const RANGER_PRESSURE_STATUS = new Set([
  "rangerTrailCut", "rangerCripplingShot", "rangerPursuitLine", "rangerCoveringShot",
  "rangerPatientAim", "rangerPathfinderStep", "rangerCompanionSignal", "rangerSetSnare",
  "rangerReadMonster", "rangerPackCommand", "rangerFalconStoop",
  "rangerLayeredSnare", "rangerKillZone",
]);
const ROGUE_PRESSURE_STATUS = new Set([
  "rogueAssessMark", "rogueFalseOpening", "rogueExploitGuard", "rogueSapBlow",
  "rogueConcealedShift", "rogueHamstring", "rogueSwitchbackFeint", "rogueKidneyShot",
  "rogueFinishingAngle", "rogueSilentEntry", "rogueBrazenFeint", "rogueKillingMeasure",
  "rogueFaultFinder", "rogueHighWindow", "rogueConfidencePlay", "rogueDirtyTrick",
  "rogueFirstStrike", "rogueVenomWork", "rogueMasterKey", "roguePlannedCollapse",
]);
const PALADIN_PRESSURE_STATUS = new Set([
  "paladinWitnessChallenge", "paladinJudgmentStroke", "paladinMercifulArrest",
  "paladinCallToAccount", "paladinOfferQuarter", "paladinThresholdBlow",
  "paladinVerdictEdge", "paladinPeaceCommand", "paladinSunwardCut",
]);
const DRUID_ENEMY_STATUS = new Set([
  "druidVerdantSpark", "druidLeafrot", "druidSirocco", "druidHarvestTide",
  "druidFrostroot", "druidHighSummer", "druidReturnToSoil", "druidGreatYear",
  "druidGroveAwakening", "druidGaleShear", "druidDecayMark", "druidEntanglingThicket",
  "druidStormbolt", "druidSunwheel", "druidMolderingWave",
]);
const DRUID_PRESSURE_STATUS = new Set([
  "druidVerdantSpark", "druidSirocco", "druidHarvestTide", "druidFrostroot",
  "druidReturnToSoil", "druidGreatYear", "druidGroveAwakening", "druidGaleShear",
  "druidDecayMark", "druidEntanglingThicket", "druidStormbolt", "druidSunwheel",
]);
const WARLOCK_ENEMY_STATUS = new Set([
  "warlockDebtMark", "warlockFavorsRebuke", "warlockCovenantLash", "warlockCreditorsGaze",
  "warlockClaimDue", "warlockRuinousTerms", "warlockPactApotheosis", "warlockHellfireCovenant",
  "warlockWitchMark", "warlockPactChain", "warlockWhisperedTerms", "warlockInfernalVolley",
  "warlockDevilsDue", "warlockLayeredHex", "warlockSympatheticToken", "warlockBindingLinks",
  "warlockSecretLeverage", "warlockOpenBargain",
]);
const WARLOCK_PRESSURE_STATUS = new Set([
  "warlockDebtMark", "warlockFavorsRebuke", "warlockCovenantLash", "warlockCreditorsGaze",
  "warlockClaimDue", "warlockRuinousTerms", "warlockPactApotheosis", "warlockWitchMark",
  "warlockPactChain", "warlockWhisperedTerms", "warlockDevilsDue", "warlockLayeredHex",
  "warlockSympatheticToken", "warlockBindingLinks", "warlockSecretLeverage", "warlockOpenBargain",
]);
const WARLOCK_SCORCH_STATUS = new Set(["warlockHellfireCovenant", "warlockInfernalVolley"]);
const ARTIFICER_ENEMY_STATUS = new Set([
  "artificerSnapfire", "artificerTangleLine", "artificerArcNode", "artificerCollapseCharge",
  "artificerGrandInvention", "artificerFlashPhial", "artificerFractureCompound", "artificerShapedDemolition",
]);
const ARTIFICER_PRESSURE_STATUS = new Set([
  "artificerTangleLine", "artificerArcNode", "artificerCollapseCharge", "artificerGrandInvention",
  "artificerFlashPhial", "artificerFractureCompound", "artificerShapedDemolition",
]);
// Debuffs an "unstoppable" combatant (BKB) is flat-out immune to — disables and the
// anti-heal curse, NOT damage-over-time (a wound still bleeds; you just can't be
// disabled or cursed). Damage immunity (incl. true) is invuln's job, separately.
const BKB_BLOCKS = new Set(["stun", "weaken", "vulnerable", "chill", "curse", "slow", "silence", "polymorph", "levelDrain", "misdirected", "warriorWeaponBound", "warriorAdvanceChecked", "monkActionInterrupted", "monkBalanceChecked", "barbarianActionStaggered", "barbarianGuardDisrupted", ...BARD_PRESSURE_STATUS, ...RANGER_PRESSURE_STATUS, ...ROGUE_PRESSURE_STATUS, ...PALADIN_PRESSURE_STATUS, ...DRUID_PRESSURE_STATUS, ...WARLOCK_PRESSURE_STATUS, ...ARTIFICER_PRESSURE_STATUS]); // NOT mind-control: no flat immunity wards a mind, only the will gap
// Control + debuff statuses whose duration scales with the caster's controlDuration
// (Mind) and the target's ccDurationReduction (Presence). DOTs are excluded.
const CONTROL_DEBUFF = new Set(["stun", "slow", "weaken", "vulnerable", "chill", "curse", "silence", "charmed", "dominated", "geas", "polymorph", "levelDrain", "misdirected", "warriorWeaponBound", "warriorAdvanceChecked", "monkActionInterrupted", "monkBalanceChecked", "barbarianActionStaggered", "barbarianGuardDisrupted", ...BARD_PRESSURE_STATUS, ...RANGER_PRESSURE_STATUS, ...ROGUE_PRESSURE_STATUS, ...PALADIN_PRESSURE_STATUS]);
const PURIFIABLE_STATUS = new Set(["bleed", "poison", "burn", "chill", "curse", "vulnerable", "weaken", "silence", "slow", "rogueVenomWork", "druidLeafrot", "druidHighSummer", "druidMolderingWave", ...WARLOCK_ENEMY_STATUS, ...ARTIFICER_ENEMY_STATUS]);
const WARRIOR_SHAKE_OFF_STATUS = new Set(["bleed", "weaken", "vulnerable", "slow", "warriorWeaponBound", "warriorAdvanceChecked"]);
const MONK_POSTURE_IMMUNE_ANATOMY = new Set(["amorphous", "incorporeal", "mist", "ooze", "slime", "swarm"]);
const MONK_LARGE_SIZES = new Set(["large", "huge", "gargantuan", "colossal"]);
const MONK_IMMOVABLE_SIZES = new Set(["huge", "gargantuan", "colossal"]);
const PROFANE_RACES = new Set(["undead", "demon", "fiend", "spirit"]);
const MUNDANE_TRAINED_BEAST_RACES = new Set([
  "animal", "beast", "wolf", "warg", "hound", "dog", "horse", "pony", "mule", "camel",
  "stag", "deer", "ram", "goat", "boar", "cat", "lynx", "rat", "hawk", "falcon", "eagle", "owl",
]);
const FLYING_TRAINED_BEAST_RACES = new Set(["hawk", "falcon", "eagle", "owl"]);
const ALLY_LOSS = { cowardly: 22, wary: 14, fierce: 8, brutish: 10, honorable: 10, feral: 8, fanatic: 0, mindless: 0 };

function sumStatus(c, type) {
  return (c.statuses || []).filter((s) => s.type === type).reduce((s, x) => s + (x.value || 0), 0);
}
function sumStatusField(c, types, field) {
  const wanted = new Set(Array.isArray(types) ? types : [types]);
  return (c?.statuses || []).filter((status) => wanted.has(status.type))
    .reduce((total, status) => total + (Number(status[field]) || 0), 0);
}
function hasStatus(c, type) { return (c?.statuses || []).some((s) => s.type === type); }
export function isPlayerControlled(cs) {
  const player = cs?.player;
  return !!player && ["charmed", "enthralled", "dominated"].some((type) => hasStatus(player, type));
}
export function isPlayerTurnLocked(cs) {
  return isPlayerControlled(cs) || hasStatus(cs?.player, "stun");
}
function isPlayerPermanentlyControlled(cs) {
  const player = cs?.player;
  if (!player) return false;
  if (player.enthralledBy) return true;
  return (player.statuses || []).some((status) =>
    ["enthralled", "dominated"].includes(status.type) &&
    (status.duration == null || !Number.isFinite(status.duration) || status.duration >= 10000));
}

// Curse is distinct from vulnerable: as well as amplifying damage taken, a cursed
// creature's wounds barely knit — ALL healing it receives is halved. Every heal
// path routes through gainHealth so the suppression (and the maxHealth clamp) lives
// in one place. Returns the health actually restored (for honest logs).
const CURSE_HEAL_MULT = 0.5;
const DEFER_TURNS = 3; // turns a deferred (dmgDefer) wound bleeds out over
const CEASEFIRE_TURN = 50; // a grindingly long fight: a thinking foe offers a truce
const TERMINAL_PHASES = new Set(["victory", "defeat", "resolved", "playerFled"]);
function gainHealth(c, amt) {
  if (!c || amt <= 0 || c.health <= 0) return 0;
  let h = amt;
  if (hasStatus(c, "curse")) h = Math.round(h * CURSE_HEAL_MULT);
  // Healing amplification (healPower): a multiplier on ALL health gained — regen,
  // lifesteal, ability heals, party heals — so it compounds lifesteal/regen builds.
  if (c.healPower) h = Math.round(h * (1 + c.healPower));
  if (h <= 0) return 0;
  const before = c.health;
  c.health = Math.min(c.maxHealth, c.health + h);
  return c.health - before;
}

// Last Stand (Presence 30): once per fight, a lethal blow can't drop the bearer
// below 1 HP — it opens a 3-turn window during which they can't be killed.
// Returns true if a lethal result is held off (the caller floors health at 1).
function lastStandHolds(c) {
  if (!c) return false;
  if ((c.deathlessTurns || 0) > 0) return true;
  if (c.triggers?.lastStand && !c._lastStand) { c._lastStand = true; c.deathlessTurns = 3; return true; }
  return false;
}

function addStatus(c, effect) {
  if (!effect) return false;
  // Debuff immunity (Unstoppable / BKB): control, silence, and curse are rejected
  // outright while it's up.
  if (c && BKB_BLOCKS.has(effect.type) && hasStatus(c, "unstoppable")) return false;
  // Hard control (stun/slow) has DIMINISHING RETURNS: Unbowed (controlResist) plus
  // a stacking resist from how often this foe has already been controlled this
  // fight (+20% per prior control, capped). So you can chain a couple of locks to
  // set up a kill, but you can't perma-stun a boss out of the fight.
  if (c && RESISTABLE_CONTROL.has(effect.type)) {
    const resist = Math.min(0.8, (c.controlResist || 0) + (c.controlPressure || 0) * 0.2);
    if (resist > 0 && Math.random() < resist) return false;
  }
  c.statuses = c.statuses || [];
  // Presence: control & debuffs applied to a bearer with ccDurationReduction wear
  // off sooner (their duration is shaved, floored at 1 turn).
  let dur = effect.duration || 1;
  if (CONTROL_DEBUFF.has(effect.type) && (c.ccDurationReduction || 0) > 0) {
    dur = Math.max(1, Math.round(dur * (1 - Math.min(0.9, c.ccDurationReduction))));
  }
  c.statuses.push({
    ...effect,
    type: effect.type,
    value: effect.value || 0,
    duration: dur,
    pctMax: !!effect.pctMax,
    ...(effect.sourceUid ? { sourceUid: effect.sourceUid } : {}),
    ...(effect.cap != null ? { cap: effect.cap } : {}),
  });
  return true;
}

// The will-save chance the SUBJECT resists a mind-control attempt. PURE POWER GAP —
// no rank, title, or flat immunity wards a mind; only the contest of WILLS decides it
// (subject's will vs the caster's). An iron will (controlResist) raises the odds.
// DIVINE-tier mind-magic BREAKS THE LAWS — it ignores controlResist, immunity, and the
// base floor, and is a pure clash of wills: a god's command is answered only by a
// greater will.
function willSaveChance(caster, target, type, tier) {
  const potency = (caster?.will || 0) + (caster?.saveDC || 0); // Mind threshold sharpens the caster's save DC
  if (tier === "divine") return Math.min(0.95, Math.max(0, (target.will || 0) - potency) * 0.05);
  const base = type === "dominated" ? 0.05 : 0.10;
  return Math.min(0.95, base + Math.max(0, (target.will || 0) - potency) * 0.05 + (target.controlResist || 0) + (target.controlPressure || 0) * 0.15);
}

function isProfaneEntity(target) {
  const race = String(target?.race || "").toLowerCase();
  if (PROFANE_RACES.has(race)) return true;
  const identity = `${target?.kind || ""} ${target?.name || ""}`.toLowerCase();
  return /\b(undead|skeleton|wight|wraith|ghost|spirit|fiend|demon|possessor|carrion[- ]thrall)\b/.test(identity);
}

function isBossScale(caster, target) {
  return !!(target?.boss || target?.isBoss || target?.apex
    || tierInfo(target?.tier || "common").order >= tierInfo("legendary").order
    || (caster?.maxHealth > 0 && target?.maxHealth >= caster.maxHealth * 3));
}

function sacredResistanceChance(caster, target, tier, bossBonus = 0) {
  const sacredForce = (caster?.attrs?.presence || 0) + (caster?.saveDC || 0) + tierInfo(tier || "common").order * 2;
  const profaneWill = (target?.will || 0) + (target?.controlResist || 0) * 10;
  return clamp(0.15 + Math.max(0, profaneWill - sacredForce) * 0.04 + bossBonus, 0.1, 0.9);
}

function isNativeWarriorTechnique(def) {
  return !!def && def.professionId === "fighter" && def.school === "martial" && !def.innate;
}

function isNativeMonkTechnique(def) {
  return !!def && def.professionId === "monk" && def.school === "martial" && !def.innate;
}

function isNativeBarbarianTechnique(def) {
  return !!def && def.professionId === "barbarian" && def.school === "martial" && !def.innate;
}

function isBarbarianCombatant(actor) {
  if (!actor) return false;
  if (actor.professionId === "barbarian" || actor.professionIds?.includes?.("barbarian")) return true;
  // The player always carries the entitlement-filtered progression list. Do
  // not fall back to a forged freeform abilities list when that authority is
  // present; authored NPCs/allies without a ledger may identify through their
  // native Barbarian kit instead.
  if (actor.uid === "p" && Array.isArray(actor.progressionAbilityIds)) {
    return actor.progressionAbilityIds.some((id) => isNativeBarbarianTechnique(getAbilityDef(id)));
  }
  const ids = [
    ...(actor.progressionAbilityIds || []),
    ...(actor.abilities || []).map((entry) => typeof entry === "string" ? entry : entry?.id).filter(Boolean),
  ];
  return ids.some((id) => isNativeBarbarianTechnique(getAbilityDef(id)));
}

function beginBarbarianAction(actor) {
  if (!actor) return;
  actor._barbarianFuryGrantedTargets = [];
  delete actor._barbarianFurySpent;
}

function endBarbarianAction(actor) {
  if (!actor) return;
  delete actor._barbarianFuryGrantedTargets;
  delete actor._barbarianFurySpent;
}

function gainBarbarianFuryFromDamage(cs, attacker, target, dealt) {
  if (!attacker || !target || dealt <= 0 || target.health <= 0 || attacker.side === target.side || !isBarbarianCombatant(target)) return false;
  const key = combatantActionKey(target);
  attacker._barbarianFuryGrantedTargets = attacker._barbarianFuryGrantedTargets || [];
  if (attacker._barbarianFuryGrantedTargets.includes(key)) return false;
  attacker._barbarianFuryGrantedTargets.push(key);
  const before = clamp(Math.floor(target.barbarianFury || 0), 0, 5);
  target.barbarianFury = Math.min(5, before + 1);
  if (target.barbarianFury <= before) return false;
  target.statuses = (target.statuses || []).filter((status) => status.type !== "barbarianRecentDamage");
  addStatus(target, {
    type: "barbarianRecentDamage",
    value: clamp(Math.round(dealt), 1, Math.max(1, Math.round((target.maxHealth || dealt) * 0.2))),
    duration: 2,
  });
  cs?.log?.push(logEntry(`${target.name} gains Fury from the damaging hostile action (${target.barbarianFury}/5).`, "status"));
  return true;
}

function gainProvokedBarbarianFury(cs, actor) {
  if (!isBarbarianCombatant(actor)) return false;
  const before = clamp(Math.floor(actor.barbarianFury || 0), 0, 5);
  actor.barbarianFury = Math.min(5, before + 1);
  if (actor.barbarianFury <= before) return false;
  cs?.log?.push(logEntry(`${actor.name} provokes one Fury (${actor.barbarianFury}/5) while exposing the guard.`, "status"));
  return true;
}

function spendBarbarianFury(cs, actor, def) {
  if (!isNativeBarbarianTechnique(def)) return 0;
  const cost = clamp(Math.floor(def?.barbarianFuryCost || 0), 0, 5);
  if (!cost) { delete actor._barbarianFurySpent; return 0; }
  const available = clamp(Math.floor(actor.barbarianFury || 0), 0, 5);
  if (available < cost) { actor._barbarianFurySpent = 0; return 0; }
  actor.barbarianFury = available - cost;
  actor._barbarianFurySpent = cost;
  cs?.log?.push(logEntry(`${actor.name} spends ${cost} Fury (${actor.barbarianFury}/5 remains).`, "status"));
  return cost;
}

function isNativeBardPerformance(def) {
  return !!def && def.professionId === "bard" && def.school === "performance" && !def.innate;
}

function canPerceiveBardPerformance(target, { willing = false } = {}) {
  if (!target || target.health <= 0 || target._dead || target.resolved) return false;
  if (target.conscious === false || target.unconscious || hasStatus(target, "unconscious")) return false;
  if (target.canHear === false || target.hearing === false || target.deaf || hasStatus(target, "deaf")) return false;
  if (target.demeanor === "mindless") return false;
  if (willing && target.willing === false) return false;
  return true;
}

function canUnderstandBardPerformance(target) {
  return canPerceiveBardPerformance(target)
    && target.canUnderstand !== false
    && target.understandsSpeech !== false
    && target.languageUnderstanding !== false
    && target.canTalk !== false;
}

function spendBardCadence(cs, actor, def) {
  if (!isNativeBardPerformance(def)) return 0;
  const cost = clamp(Math.floor(def?.bardCadenceCost || 0), 0, 4);
  if (!cost) return 0;
  const available = clamp(Math.floor(actor.bardCadence || 0), 0, 4);
  if (available < cost) return 0;
  actor.bardCadence = available - cost;
  cs?.log?.push(logEntry(`${actor.name} spends ${cost} Cadence (${actor.bardCadence}/4 remains).`, "status"));
  return cost;
}

function completeBardPerformance(cs, actor, def) {
  if (!isNativeBardPerformance(def) || !def.bardMotif) return;
  const previous = actor.bardLastMotif || null;
  const motif = String(def.bardMotif);
  actor.bardLastMotif = motif;
  if (!def.bardCadenceBuild || (def.bardCadenceCost || 0) > 0 || previous === motif) return;
  const before = clamp(Math.floor(actor.bardCadence || 0), 0, 4);
  actor.bardCadence = Math.min(4, before + clamp(Math.floor(def.bardCadenceBuild || 1), 1, 1));
  if (actor.bardCadence > before) {
    cs?.log?.push(logEntry(`${actor.name} changes to a ${motif} motif and builds Cadence (${actor.bardCadence}/4).`, "status"));
  }
}

function isNativeRangerFieldcraft(def) {
  return !!def && def.professionId === "ranger" && def.school === "fieldcraft" && !def.innate;
}

function rangerBeastRace(beast) {
  return String(beast?.race || beast?.species || beast?.kind || "").trim().toLowerCase();
}

function isEligibleTrainedBeast(beast, { flying = false } = {}) {
  if (!beast || beast.health <= 0 || beast._dead || beast.resolved) return false;
  if (beast.conscious === false || beast.unconscious || hasStatus(beast, "unconscious")) return false;
  if (beast._summoned || beast.summoned === true || beast.magical === true || beast.magicalConstruct
      || beast.mundane === false || beast.kind === "summon") return false;
  const race = rangerBeastRace(beast);
  const trained = beast.trainedBeast === true || beast.animalCompanion === true
    || beast.trained === true || beast.kind === "mount";
  const mundane = beast.mundaneAnimal === true || MUNDANE_TRAINED_BEAST_RACES.has(race);
  if (!trained || !mundane) return false;
  if (!flying) return true;
  return beast.canFly === true || beast.flight === true || FLYING_TRAINED_BEAST_RACES.has(race);
}

function rangerBeastAlly(cs, actor, def) {
  if (!def?.requiresTrainedBeastAlly && !def?.requiresFlyingBeastAlly) return null;
  const flying = !!def.requiresFlyingBeastAlly;
  return sideAllies(cs, actor).find((ally) => {
    if (ally === actor || !isEligibleTrainedBeast(ally, { flying })) return false;
    if (def.requiresBeastPerception && (ally.canHear === false || ally.hearing === false || ally.deaf
        || hasStatus(ally, "deaf"))) return false;
    return true;
  }) || null;
}

function rangerBeastRequirementMet(cs, actor, def) {
  return (!def?.requiresTrainedBeastAlly && !def?.requiresFlyingBeastAlly)
    || !!rangerBeastAlly(cs, actor, def);
}

function rangerQuarryTarget(cs, actor) {
  const uid = actor?.rangerQuarryUid;
  if (!uid) return null;
  const target = byUid(cs, uid);
  return target && target.side !== actor.side && canAct(target) ? target : null;
}

function rangerQuarryReady(cs, actor, target, def) {
  const cost = clamp(Math.floor(def?.rangerQuarryInsightCost || 0), 0, 5);
  if (!cost && !def?.rangerRequiresCurrentQuarry) return true;
  const quarry = rangerQuarryTarget(cs, actor);
  if (!quarry || clamp(Math.floor(actor?.rangerQuarryInsight || 0), 0, 5) < cost) return false;
  const enemyTargeted = def?.target === "enemy";
  return !enemyTargeted || !target || combatantActionKey(target) === combatantActionKey(quarry);
}

function beginRangerAction(actor) {
  if (!actor) return;
  actor._rangerQuarryBuiltTargets = [];
  delete actor._rangerQuarrySpent;
}

function endRangerAction(actor) {
  if (!actor) return;
  delete actor._rangerQuarryBuiltTargets;
  delete actor._rangerQuarrySpent;
}

function gainRangerQuarryInsight(cs, actor, target, def) {
  if (!isNativeRangerFieldcraft(def) || !actor || !target || !canAct(target)) return false;
  const build = clamp(Math.floor(def.rangerQuarryInsightBuild || 0), 0, 5);
  if (!build) return false;
  const key = combatantActionKey(target);
  actor._rangerQuarryBuiltTargets = actor._rangerQuarryBuiltTargets || [];
  if (actor._rangerQuarryBuiltTargets.includes(key)) return false;
  actor._rangerQuarryBuiltTargets.push(key);
  if (actor.rangerQuarryUid !== key) {
    actor.rangerQuarryUid = key;
    actor.rangerQuarryInsight = 0;
  }
  const before = clamp(Math.floor(actor.rangerQuarryInsight || 0), 0, 5);
  actor.rangerQuarryInsight = Math.min(5, before + build);
  if (actor.rangerQuarryInsight <= before) return false;
  cs?.log?.push(logEntry(`${actor.name} reads ${target.name} as the current quarry (${actor.rangerQuarryInsight}/5 Insight).`, "status"));
  return true;
}

function spendRangerQuarryInsight(cs, actor, target, def) {
  if (!isNativeRangerFieldcraft(def)) return 0;
  const cost = clamp(Math.floor(def?.rangerQuarryInsightCost || 0), 0, 5);
  if (!cost) return 0;
  if (actor._rangerQuarrySpent != null) return actor._rangerQuarrySpent;
  if (!rangerQuarryReady(cs, actor, target, def)) {
    actor._rangerQuarrySpent = 0;
    return 0;
  }
  actor.rangerQuarryInsight = clamp(Math.floor(actor.rangerQuarryInsight || 0), 0, 5) - cost;
  actor._rangerQuarrySpent = cost;
  cs?.log?.push(logEntry(`${actor.name} spends ${cost} Quarry Insight (${actor.rangerQuarryInsight}/5 remains).`, "status"));
  return cost;
}

function isNativeRogueSubterfuge(def) {
  return !!def && def.professionId === "rogue" && def.school === "subterfuge" && !def.innate;
}

function rogueOpeningFor(actor, target) {
  if (!actor || !target) return null;
  const sourceUid = combatantActionKey(actor);
  return (target.statuses || []).find((status) => status.type === "rogueOpening" && status.sourceUid === sourceUid) || null;
}

function rogueOpeningReady(actor, target, def) {
  return !def?.rogueRequiresOpening || !!rogueOpeningFor(actor, target);
}

function rogueHasCover(cs, actor) {
  return !!(actor?.inCover || actor?.behindCover || actor?.coverAvailable
    || hasStatus(actor, "cover") || cs?.coverAvailable);
}

function rogueHasCrowd(cs, actor) {
  if (actor?.inCrowd || cs?.crowded || cs?.battle?.crowded) return true;
  const active = allCombatants(cs || {}).filter((combatant) => combatant?.health > 0 && !combatant._dead && !combatant.resolved);
  return active.length >= 4;
}

function roguePhysicalRequirementMet(cs, actor, target, def) {
  if (!isNativeRogueSubterfuge(def)) return true;
  if (def.requiresLineOfSight && (target?.lineOfSightBlocked || cs?.lineOfSightBlocked)) return false;
  if (def.requiresAwareness && (!target || target.aware === false || target.conscious === false
      || target.unconscious || hasStatus(target, "unconscious"))) return false;
  if (def.requiresCover && !rogueHasCover(cs, actor)) return false;
  if (def.requiresCrowdOrCover && !rogueHasCover(cs, actor) && !rogueHasCrowd(cs, actor)) return false;
  if (def.requiresLivingAnatomy) {
    const race = String(target?.race || target?.kind || "").toLowerCase();
    const anatomy = String(target?.anatomy || target?.form || "").toLowerCase();
    if (!target || target.incorporeal || ["construct", "undead"].includes(race)
        || ["amorphous", "incorporeal", "mist", "ooze", "slime", "swarm"].includes(anatomy)) return false;
  }
  if (def.requiresUnactedTarget && target?._actedThisRound === true) return false;
  if (def.requiresCarriedPhysicalToxin && actor?.carriedPhysicalToxin === false) return false;
  if (def.requiresAccessibleFault) {
    const fault = target?.physicalFaultExposed || target?.accessiblePhysicalFault
      || target?.structureAssessed || target?.footingAssessed
      || cs?.structureAssessed || cs?.footingAssessed;
    if (!fault) return false;
  }
  if (def.requiresAccessibleEquipment) {
    const equipment = target?.equipmentAccessible === true
      || (target?.equipmentAccessible !== false && !!(target?.weapon || target?.armor || target?.armorClass));
    if (!equipment) return false;
  }
  if (def.requiresAssessedTerrain || def.requiresAssessedStructure || def.effect?.type === "roguePlannedCollapse") {
    const assessed = target?.structureAssessed || target?.footingAssessed
      || cs?.terrainAssessed || cs?.structureAssessed || cs?.footingAssessed;
    if (!assessed) return false;
  }
  return true;
}

function canReceiveRogueSpeech(target) {
  return !!target && target.health > 0 && !target._dead && !target.resolved
    && target.conscious !== false && !target.unconscious && !hasStatus(target, "unconscious")
    && target.aware !== false && target.canHear !== false && target.hearing !== false
    && !target.deaf && !hasStatus(target, "deaf") && target.demeanor !== "mindless"
    && target.canUnderstand !== false && target.understandsSpeech !== false
    && target.languageUnderstanding !== false;
}

function rogueTargetEligible(cs, actor, target, def) {
  if (!isNativeRogueSubterfuge(def) || def.target !== "enemy") return true;
  if (!canAct(target) || !roguePhysicalRequirementMet(cs, actor, target, def)) return false;
  if ((def.rogueRequiresUnderstanding || def.audible) && !canReceiveRogueSpeech(target)) return false;
  return rogueOpeningReady(actor, target, def);
}

function beginRogueAction(actor) {
  if (!actor) return;
  actor._rogueOpeningBuiltTargets = [];
  delete actor._rogueOpeningSpent;
}

function endRogueAction(actor) {
  if (!actor) return;
  delete actor._rogueOpeningBuiltTargets;
  delete actor._rogueOpeningSpent;
}

function gainRogueOpening(cs, actor, target, def) {
  if (!isNativeRogueSubterfuge(def) || !def.rogueOpeningBuild || !actor || !target || !canAct(target)) return false;
  const targetUid = combatantActionKey(target);
  actor._rogueOpeningBuiltTargets = actor._rogueOpeningBuiltTargets || [];
  if (actor._rogueOpeningBuiltTargets.includes(targetUid)) return false;
  actor._rogueOpeningBuiltTargets.push(targetUid);
  const sourceUid = combatantActionKey(actor);
  target.statuses = (target.statuses || []).filter((status) => !(
    status.type === "rogueOpening" && status.sourceUid === sourceUid
  ));
  addStatus(target, {
    type: "rogueOpening",
    value: 1,
    duration: clamp(def.rogueOpeningDuration || 2, 1, 2),
    sourceUid,
  });
  cs?.log?.push(logEntry(`${actor.name} creates a brief Opportunity Window against ${target.name}.`, "status"));
  return true;
}

function consumeRogueOpening(cs, actor, target, def) {
  if (!isNativeRogueSubterfuge(def) || !def.rogueOpeningExploit) return true;
  if (actor._rogueOpeningSpent) {
    return actor._rogueOpeningSpent.targetUid === combatantActionKey(target);
  }
  const opening = rogueOpeningFor(actor, target);
  if (!opening) return false;
  target.statuses = (target.statuses || []).filter((status) => status !== opening);
  actor._rogueOpeningSpent = { targetUid: combatantActionKey(target), opening };
  cs?.log?.push(logEntry(`${actor.name} commits ${def.name} through the Opportunity Window on ${target.name}.`, "status"));
  return true;
}

function rogueExploitCommitted(actor, target, def) {
  return !!(isNativeRogueSubterfuge(def) && def.rogueOpeningExploit
    && actor?._rogueOpeningSpent?.targetUid === combatantActionKey(target));
}

function isNativePaladinOathcraft(def) {
  return !!def && def.professionId === "paladin" && def.school === "oathcraft" && !def.innate;
}

function isPaladinCombatant(actor) {
  if (!actor) return false;
  if (actor.professionId === "paladin" || actor.professionIds?.includes?.("paladin")) return true;
  if (actor.uid === "p" && Array.isArray(actor.progressionAbilityIds)) {
    return actor.progressionAbilityIds.some((id) => isNativePaladinOathcraft(getAbilityDef(id)));
  }
  const ids = [
    ...(actor.progressionAbilityIds || []),
    ...(actor.abilities || []).map((entry) => typeof entry === "string" ? entry : entry?.id).filter(Boolean),
  ];
  return ids.some((id) => isNativePaladinOathcraft(getAbilityDef(id)));
}

function beginPaladinAction(actor) {
  if (!actor) return;
  actor._paladinConvictionBuiltSources = [];
  delete actor._paladinConvictionSpent;
}

function endPaladinAction(actor) {
  if (!actor) return;
  delete actor._paladinConvictionBuiltSources;
  delete actor._paladinConvictionSpent;
}

const DRUID_SEASONS = Object.freeze(["spring", "summer", "autumn", "winter"]);
const DRUID_SURGE_EFFECT_EXCLUSIONS = Object.freeze(new Set([
  "duration", "cap", "healthCap", "resolveCap", "bossScale", "threshold", "target",
]));

function isNativeDruidPrimalcraft(def) {
  return !!def && def.professionId === "druid" && def.school === "primalcraft" && !def.innate;
}

function isDruidCombatant(actor) {
  if (!actor) return false;
  if (actor.professionId === "druid" || actor.professionIds?.includes?.("druid")) return true;
  return [...(actor.progressionAbilityIds || []), ...(actor.abilities || []).map((entry) =>
    typeof entry === "string" ? entry : entry?.id).filter(Boolean)]
    .some((id) => isNativeDruidPrimalcraft(getAbilityDef(id)));
}

function normalizedDruidSeason(actor) {
  const season = String(actor?.druidSeason || "spring").toLowerCase();
  return DRUID_SEASONS.includes(season) ? season : "spring";
}

function beginDruidAction(actor) {
  if (actor) delete actor._druidSeasonAction;
}

function commitDruidAction(cs, actor, def) {
  if (!actor || !isNativeDruidPrimalcraft(def)) return false;
  const currentSeason = normalizedDruidSeason(actor);
  const authoredSeason = String(def.druidSeason || "").toLowerCase();
  const authoredSurge = def.druidSeasonSurge || {};
  const bonus = clamp(Number(authoredSurge.bonus || 0), 0, 0.25);
  const cap = clamp(Number(authoredSurge.cap ?? 0.25), 0, 0.25);
  const multiplier = 1 + Math.min(bonus, cap);
  const surged = DRUID_SEASONS.includes(authoredSeason) && authoredSeason === currentSeason && multiplier > 1;
  actor._druidSeasonAction = {
    defId: def.id,
    startSeason: currentSeason,
    authoredSeason,
    surged,
    multiplier,
    appliesTo: authoredSurge.appliesTo || "",
    effectRefs: [def.effect, def.selfEffect].filter(Boolean),
  };
  if (surged) {
    cs?.log?.push(logEntry(`${actor.name}'s ${def.name} answers the ${currentSeason} season with a bounded ${Math.round((multiplier - 1) * 100)}% surge.`, "status"));
  }
  return true;
}

function finishDruidAction(cs, actor, committed = true) {
  const action = actor?._druidSeasonAction;
  if (!actor || !action) return;
  if (committed) {
    const index = DRUID_SEASONS.indexOf(action.startSeason);
    actor.druidSeason = DRUID_SEASONS[(index + 1) % DRUID_SEASONS.length];
    cs?.log?.push(logEntry(`${actor.name}'s primal cycle turns from ${action.startSeason} to ${actor.druidSeason}.`, "status"));
  }
  delete actor._druidSeasonAction;
}

function druidSeasonDamageMultiplier(actor, def) {
  const action = actor?._druidSeasonAction;
  if (!action?.surged || action.defId !== def?.id) return 1;
  return ["damage", "damage-and-effect"].includes(action.appliesTo) ? action.multiplier : 1;
}

function druidSurgedEffect(sourceActor, effect, sourceDef = null) {
  const action = sourceActor?._druidSeasonAction;
  if (!effect || !action?.surged || !["effect", "damage-and-effect"].includes(action.appliesTo)) return effect;
  if (sourceDef && action.defId !== sourceDef.id) return effect;
  if (!sourceDef && !action.effectRefs.includes(effect)) return effect;
  const surged = { ...effect };
  for (const [field, authored] of Object.entries(surged)) {
    if (DRUID_SURGE_EFFECT_EXCLUSIONS.has(field)) continue;
    if (typeof authored !== "number") continue;
    const value = Number(authored);
    if (!Number.isFinite(value) || value === 0) continue;
    const next = value * action.multiplier;
    surged[field] = Number.isInteger(value) ? Math.round(next) : next;
  }
  return surged;
}

function isMagicalCastingDiscipline(def) {
  return ["spell", "primalcraft", "pactcraft"].includes(abilityCategoryOf(def));
}

function druidEnvironmentRequirementMet(cs, actor, def) {
  if (!isNativeDruidPrimalcraft(def)) return true;
  if (def.terrainReq) {
    const unavailable = cs?.livingGrowthAvailable === false || cs?.seedBearingGround === false
      || cs?.terrain?.livingGrowth === false || cs?.terrain?.seedBearingGround === false;
    if (unavailable) return false;
  }
  if (def.requiresOpenSkyOrStorm) {
    const storm = cs?.stormActive === true || cs?.weather?.storm === true || actor?.stormActive === true;
    const openSky = cs?.openSky !== false && cs?.indoors !== true && actor?.openSky !== false;
    if (!storm && !openSky) return false;
  }
  if (def.requiresSunlight) {
    const sunlight = actor?.sunlightExposure === true || cs?.sunlight === true
      || cs?.weather?.sunlight === true || cs?.openSkyDaylight === true;
    if (!sunlight) return false;
  }
  if (def.requiresReclaimableDecay) {
    const decayTypes = new Set(["druidLeafrot", "druidDecayMark", "druidMolderingWave", "druidReturnToSoil"]);
    const actors = [cs?.player, ...(cs?.allies || []), ...(cs?.enemies || [])].filter(Boolean);
    const reclaimable = cs?.reclaimableDecay === true || actors.some((entry) =>
      (entry.statuses || []).some((status) => decayTypes.has(status.type)));
    if (!reclaimable) return false;
  }
  return true;
}

function isNativeWarlockPactcraft(def) {
  return !!def && def.professionId === "warlock" && def.school === "pactcraft" && !def.innate;
}

function isWarlockCombatant(actor) {
  if (!actor) return false;
  if (actor.professionId === "warlock" || actor.professionIds?.includes?.("warlock")) return true;
  return [...(actor.progressionAbilityIds || []), ...(actor.abilities || []).map((entry) =>
    typeof entry === "string" ? entry : entry?.id).filter(Boolean)]
    .some((id) => isNativeWarlockPactcraft(getAbilityDef(id)));
}

function beginWarlockAction(actor) {
  if (!actor) return;
  delete actor._warlockPactPricePaid;
  delete actor._warlockFavorSpent;
  delete actor._warlockFavorBuilt;
}

function endWarlockAction(actor) {
  if (!actor) return;
  delete actor._warlockPactPricePaid;
  delete actor._warlockFavorSpent;
  delete actor._warlockFavorBuilt;
}

function warlockHealthPriceAmount(actor, price) {
  if (!actor || price?.type !== "health") return 0;
  const maxHealth = Math.max(1, actor.maxHealth || actor.health || 1);
  const ratio = clamp(Number(price.maxHealth || 0), 0.01, 0.2);
  const cap = clamp(Number(price.cap ?? ratio), 0.01, 0.2);
  return Math.max(1, Math.min(Math.round(maxHealth * ratio), Math.round(maxHealth * cap)));
}

function warlockPactPricePayable(actor, def) {
  if (!isNativeWarlockPactcraft(def) || !def.warlockPactPrice) return true;
  const price = def.warlockPactPrice;
  if (price.type === "health") {
    const amount = warlockHealthPriceAmount(actor, price);
    return amount > 0 && (price.nonlethal ? actor.health > amount : actor.health >= amount);
  }
  if (price.type === "exposure") return Number(price.incomingDamage || 0) > 0;
  return false;
}

function gainWarlockFavor(cs, actor, amount = 1) {
  if (!isWarlockCombatant(actor) || amount <= 0 || actor._warlockFavorBuilt) return false;
  const before = clamp(Math.floor(actor.warlockFavor || 0), 0, 5);
  actor.warlockFavor = Math.min(5, before + Math.min(1, Math.floor(amount)));
  actor._warlockFavorBuilt = true;
  if (actor.warlockFavor <= before) return false;
  cs?.log?.push(logEntry(`${actor.name} earns Pact Favor only after paying the authored price (${actor.warlockFavor}/5).`, "status"));
  return true;
}

function payWarlockPactPrice(cs, actor, def) {
  if (!isNativeWarlockPactcraft(def) || !def.warlockPactPrice || actor._warlockPactPricePaid) return false;
  if (!warlockPactPricePayable(actor, def)) return false;
  const price = def.warlockPactPrice;
  if (price.type === "health") {
    const amount = warlockHealthPriceAmount(actor, price);
    actor.health = Math.max(price.nonlethal ? 1 : 0, actor.health - amount);
    actor._warlockPactPricePaid = { type: "health", amount };
    cs?.log?.push(logEntry(`${actor.name} pays ${amount} actual health into ${def.name}; the price cannot be refunded by the cast.`, "status"));
  } else if (price.type === "exposure") {
    const incoming = clamp(Number(price.incomingDamage || 0), 0.05, Number(price.cap || 0.25));
    const value = clamp(Math.round(incoming * 100), 5, 25);
    addStatus(actor, {
      type: "warlockPactExposure",
      value,
      cap: clamp(Number(price.cap || 0.25), 0.05, 0.25),
      duration: clamp(price.duration || 2, 1, 3),
      sourceUid: combatantActionKey(actor),
    });
    actor._warlockPactPricePaid = { type: "exposure", value };
    cs?.log?.push(logEntry(`${actor.name} accepts ${value}% bounded incoming-harm exposure as the price of ${def.name}.`, "status"));
  }
  if (!actor._warlockPactPricePaid) return false;
  if (def.warlockFavorBuildOnPaidPrice && (def.warlockFavorBuild || 0) > 0) {
    gainWarlockFavor(cs, actor, def.warlockFavorBuild);
  }
  return true;
}

function warlockFavorReady(actor, def) {
  const cost = clamp(Math.floor(def?.warlockFavorCost || 0), 0, 5);
  return !cost || clamp(Math.floor(actor?.warlockFavor || 0), 0, 5) >= cost;
}

function spendWarlockFavor(cs, actor, def) {
  if (!isNativeWarlockPactcraft(def)) return 0;
  const cost = clamp(Math.floor(def?.warlockFavorCost || 0), 0, 5);
  if (!cost) return 0;
  if (actor._warlockFavorSpent != null) return actor._warlockFavorSpent;
  if (!warlockFavorReady(actor, def)) {
    actor._warlockFavorSpent = 0;
    return 0;
  }
  actor.warlockFavor = clamp(Math.floor(actor.warlockFavor || 0), 0, 5) - cost;
  actor._warlockFavorSpent = cost;
  cs?.log?.push(logEntry(`${actor.name} commits ${cost} Pact Favor to ${def.name} (${actor.warlockFavor}/5 remains).`, "status"));
  return cost;
}

function isNativeArtificerDevicecraft(def) {
  return !!def && def.professionId === "artificer" && def.school === "devicecraft" && !def.innate;
}

function beginArtificerAction(actor) {
  if (!actor) return;
  delete actor._artificerChargeSpent;
  delete actor._artificerRefitApplied;
}

function endArtificerAction(actor) {
  if (!actor) return;
  delete actor._artificerChargeSpent;
  delete actor._artificerRefitApplied;
}

function artificerChargesReady(actor, def) {
  const cost = clamp(Math.floor(def?.artificerChargeCost || 0), 0, 5);
  return !cost || clamp(Math.floor(actor?.artificerDeviceCharges || 0), 0, 5) >= cost;
}

function spendArtificerCharges(cs, actor, def) {
  if (!isNativeArtificerDevicecraft(def)) return 0;
  const cost = clamp(Math.floor(def?.artificerChargeCost || 0), 0, 5);
  if (!cost) return 0;
  if (actor._artificerChargeSpent != null) return actor._artificerChargeSpent;
  if (!artificerChargesReady(actor, def)) {
    actor._artificerChargeSpent = 0;
    return 0;
  }
  actor.artificerDeviceCharges = clamp(Math.floor(actor.artificerDeviceCharges || 0), 0, 5) - cost;
  actor._artificerChargeSpent = cost;
  cs?.log?.push(logEntry(`${actor.name} commits ${cost} prepared Device Charge${cost === 1 ? "" : "s"} to ${def.name} (${actor.artificerDeviceCharges}/5 remain).`, "status"));
  return cost;
}

function applyArtificerRefit(cs, actor, effect) {
  if (!actor || actor._artificerRefitApplied) return 0;
  const before = clamp(Math.floor(actor.artificerDeviceCharges || 0), 0, 5);
  const cap = clamp(Math.floor(effect?.chargeCap || 5), 1, 5);
  const restored = clamp(Math.floor(effect?.restoreCharges || 0), 0, 2);
  actor.artificerDeviceCharges = Math.min(cap, before + restored);
  actor._artificerRefitApplied = true;
  const gained = actor.artificerDeviceCharges - before;
  cs?.log?.push(logEntry(`${actor.name} refits carried devices and restores ${gained} Charge${gained === 1 ? "" : "s"} (${actor.artificerDeviceCharges}/5 prepared).`, "status"));
  return gained;
}

function warlockOwnStatus(actor, target, type) {
  const sourceUid = combatantActionKey(actor);
  return (target?.statuses || []).some((status) => status.type === type && status.sourceUid === sourceUid);
}

function warlockCarriesSympatheticToken(actor, target) {
  if (!actor) return false;
  if (actor.carriedSympatheticToken === true || actor.hasSympatheticToken === true) return true;
  const targetUid = combatantActionKey(target);
  const linkedTargets = [
    ...(actor.sympatheticTokenTargetUids || []),
    ...(actor.sympatheticLinks || []),
  ].map((entry) => typeof entry === "string" ? entry : combatantActionKey(entry));
  if (linkedTargets.includes(targetUid)) return true;
  const carried = [
    ...(actor.sympatheticTokens || []),
    ...(actor.carried || []),
    ...(actor.items || []),
    ...(actor.inventory?.items || []),
  ];
  return carried.some((item) => {
    if (typeof item === "string") return /sympathetic|poppet|true-name-token|linked-token/i.test(item);
    if (!item) return false;
    const identity = `${item.id || ""} ${item.name || ""} ${(item.tags || []).join?.(" ") || ""}`;
    const linkedUid = item.targetUid || item.linkedTargetUid || item.ownerUid;
    return /sympathetic|poppet|true-name-token|linked-token/i.test(identity)
      && (!linkedUid || linkedUid === targetUid);
  });
}

function warlockKnowsTargetSecret(actor, target) {
  if (!actor || !target) return false;
  if (actor.knowsTargetSecret === true || actor.hasKnownSecret === true || actor.knownSecret === true) return true;
  const actorUid = combatantActionKey(actor);
  const targetUid = combatantActionKey(target);
  const targetAcknowledges = [target.secretKnownBy, target.knownSecretBy, target.secretWitnesses]
    .filter(Array.isArray)
    .some((entries) => entries.includes(actorUid));
  if (targetAcknowledges) return true;
  const directTargets = [
    ...(actor.knownSecretTargetUids || []),
    ...(actor.secretTargetUids || []),
  ];
  if (directTargets.includes(targetUid)) return true;
  const known = actor.knownSecrets || actor.secretsKnown || [];
  if (!Array.isArray(known) && known && typeof known === "object") {
    return !!(known[targetUid] || known[target?.uid] || known[target?.id] || known[target?.name]);
  }
  return known.some((entry) => {
    if (typeof entry === "string") return entry === targetUid || entry === target?.uid || entry === target?.id || entry === target?.name;
    const linkedUid = entry?.targetUid || entry?.subjectUid || entry?.ownerUid || entry?.targetId;
    return !!entry && (linkedUid === targetUid || linkedUid === target?.uid || linkedUid === target?.id);
  });
}

function warlockTargetEligible(cs, actor, target, def) {
  if (!isNativeWarlockPactcraft(def) || def.target !== "enemy") return true;
  if (!canAct(target)) return false;
  if ((def.audible || def.requiresAwareness || def.requiresUnderstanding)
      && !canReceiveRogueSpeech(target)) return false;
  if (def.warlockRequiresOwnDebtMark && !warlockOwnStatus(actor, target, "warlockDebtMark")) return false;
  if (def.warlockRequiresOwnHellfireCovenant
      && !warlockOwnStatus(actor, target, "warlockHellfireCovenant")) return false;
  if (def.requiresCarriedSympatheticToken && !warlockCarriesSympatheticToken(actor, target)) return false;
  if (def.requiresKnownSecret && !warlockKnowsTargetSecret(actor, target)) return false;
  return true;
}

function gainPaladinConviction(cs, paladin, hostileActor, amount = 1) {
  if (!isPaladinCombatant(paladin) || !hostileActor || hostileActor.side === paladin.side || amount <= 0) return false;
  const sourceUid = combatantActionKey(paladin);
  hostileActor._paladinConvictionBuiltSources = hostileActor._paladinConvictionBuiltSources || [];
  if (hostileActor._paladinConvictionBuiltSources.includes(sourceUid)) return false;
  hostileActor._paladinConvictionBuiltSources.push(sourceUid);
  const before = clamp(Math.floor(paladin.paladinConviction || 0), 0, 5);
  paladin.paladinConviction = Math.min(5, before + clamp(Math.floor(amount), 1, 1));
  if (paladin.paladinConviction <= before) return false;
  cs?.log?.push(logEntry(`${paladin.name} earns Conviction by bearing real hostile force (${paladin.paladinConviction}/5).`, "status"));
  return true;
}

function paladinConvictionReady(actor, def) {
  const cost = clamp(Math.floor(def?.paladinConvictionCost || 0), 0, 5);
  return !cost || clamp(Math.floor(actor?.paladinConviction || 0), 0, 5) >= cost;
}

function paladinTargetEligible(actor, target, def) {
  if (!isNativePaladinOathcraft(def) || def.target !== "enemy") return true;
  if (!canAct(target)) return false;
  if ((def.audible || def.requiresUnderstanding || def.requiresAwareness)
      && !canReceiveRogueSpeech(target)) return false;
  if (def.paladinRequiresOwnCallToAccount && !(target.statuses || []).some((status) =>
    status.type === "paladinCallToAccount" && status.sourceUid === combatantActionKey(actor))) return false;
  if (def.effect?.type === "paladinThresholdBlow") {
    const anatomy = String(target.anatomy || target.form || "").toLowerCase();
    if (target.incorporeal || ["incorporeal", "mist", "swarm"].includes(anatomy)) return false;
  }
  return true;
}

function paladinPhysicalRequirementMet(cs, actor, def) {
  if (!isNativePaladinOathcraft(def)) return true;
  if (def.requiresDefensiblePosition && (actor?.defensiblePosition === false || cs?.defensiblePosition === false)) return false;
  if (def.requiresInterceptionLine && (actor?.interceptionLineAvailable === false || cs?.interceptionLineAvailable === false)) return false;
  if (def.requiresShieldOrGuardingWeapon) {
    const guardingWeapon = ["sword", "axe", "mace", "spear"].includes(actor?.weapon?.category);
    const shield = actor?.shieldEquipped || actor?.offhand?.category === "shield" || actor?.weapon?.category === "shield";
    if (!guardingWeapon && !shield) return false;
  }
  return true;
}

function spendPaladinConviction(cs, actor, def) {
  if (!isNativePaladinOathcraft(def)) return 0;
  const cost = clamp(Math.floor(def?.paladinConvictionCost || 0), 0, 5);
  if (!cost) return 0;
  if (actor._paladinConvictionSpent != null) return actor._paladinConvictionSpent;
  if (!paladinConvictionReady(actor, def)) {
    actor._paladinConvictionSpent = 0;
    return 0;
  }
  actor.paladinConviction = clamp(Math.floor(actor.paladinConviction || 0), 0, 5) - cost;
  actor._paladinConvictionSpent = cost;
  cs?.log?.push(logEntry(`${actor.name} commits ${cost} Conviction to ${def.name} (${actor.paladinConviction}/5 remains).`, "status"));
  return cost;
}

function paladinOathguardLink(cs, target) {
  const candidates = (target?.statuses || [])
    .filter((status) => status.type === "paladinOathguard" && status.sourceUid)
    .map((status) => ({ status, source: byUid(cs, status.sourceUid) }))
    .filter(({ source }) => source && source !== target && canAct(source)
      && source.side === target.side && isPaladinCombatant(source));
  candidates.sort((a, b) => (b.status.value || 0) - (a.status.value || 0)
    || (b.source.health || 0) - (a.source.health || 0));
  return candidates[0] || null;
}

function redirectThroughPaladinOathguard(cs, attacker, target, dealt) {
  if (!cs || !attacker || !target || dealt <= 0 || attacker.side === target.side) return 0;
  const link = paladinOathguardLink(cs, target);
  if (!link) return 0;
  const share = clamp((link.status.value || 0) / 100, 0.1, 0.65);
  const perHitCap = Math.max(1, Math.round((link.source.maxHealth || link.source.health || 1)
    * clamp(Number(link.status.cap ?? 0.15), 0.08, 0.25)));
  const redirected = Math.min(dealt, perHitCap, Math.max(1, Math.round(dealt * share)));
  if (redirected <= 0) return 0;

  // This is damage reassignment, not healing: return the intercepted portion to
  // the original target directly, then place the already-mitigated force on the
  // sworn protector without recursively invoking another guard link.
  target.health = Math.min(target.maxHealth || target.health + redirected, target.health + redirected);
  const burden = (link.source.statuses || []).find((status) => status.type === "paladinBurdenTaken");
  const burdenReduction = clamp(burden?.value || 0, 0, 35) / 100;
  const burdenCap = burden
    ? Math.max(1, Math.round((link.source.maxHealth || 1) * clamp(burden.cap || 0.12, 0.08, 0.2)))
    : 0;
  const reduced = burden ? Math.min(burdenCap, Math.max(0, Math.round(redirected * burdenReduction))) : 0;
  const borne = Math.max(1, redirected - reduced);
  const nextHealth = link.source.health - borne;
  link.source.health = nextHealth <= 0 && lastStandHolds(link.source) ? 1 : Math.max(0, nextHealth);
  gainPaladinConviction(cs, link.source, attacker, 1);
  cs.log.push(logEntry(`${link.source.name} redirects ${redirected} damage from ${target.name} through a witnessed Oathguard and bears ${borne}.`, "status"));
  if (link.source.health <= 0 && link.source !== cs.player) {
    if (link.source.side === "enemy") downEnemy(cs, link.source);
    else downAlly(cs, link.source);
  }
  return redirected;
}

function warlockSharedBurdenLink(cs, target) {
  if (!cs || !target) return null;
  const links = (target.statuses || []).filter((status) =>
    status.type === "warlockSharedBurden" && status.sourceUid);
  for (const status of links) {
    const source = byUid(cs, status.sourceUid);
    if (!source || source.side !== target.side || !isWarlockCombatant(source)) continue;
    const linked = sideAllies(cs, target)
      .filter((candidate) => candidate !== target && candidate.willing !== false
        && (candidate.statuses || []).some((entry) => entry.type === "warlockSharedBurden"
          && entry.sourceUid === status.sourceUid));
    if (!linked.length) continue;
    linked.sort((a, b) => (a === source ? -1 : b === source ? 1 : 0)
      || (b.health / Math.max(1, b.maxHealth || 1)) - (a.health / Math.max(1, a.maxHealth || 1)));
    return { status, source, recipient: linked[0] };
  }
  return null;
}

function redistributeWarlockSharedBurden(cs, attacker, target, dealt) {
  if (!cs || !attacker || !target || dealt <= 0 || attacker.side === target.side) return 0;
  const link = warlockSharedBurdenLink(cs, target);
  if (!link) return 0;
  const share = clamp((link.status.value || 0) / 100, 0.05, 0.20);
  const recipientCap = Math.max(1, Math.round((link.recipient.maxHealth || link.recipient.health || 1)
    * clamp(Number(link.status.cap ?? 0.08), 0.03, 0.08)));
  const redistributed = Math.min(dealt, recipientCap, Math.max(1, Math.round(dealt * share)));
  if (redistributed <= 0) return 0;

  // Reassignment is deliberately nonrecursive. Return the already-mitigated
  // share to the struck ally, then place that exact harm directly on one other
  // willing linked ally. No health is created and no second link can catch it.
  target.health = Math.min(target.maxHealth || target.health + redistributed, target.health + redistributed);
  const nextHealth = link.recipient.health - redistributed;
  link.recipient.health = nextHealth <= 0 && lastStandHolds(link.recipient) ? 1 : Math.max(0, nextHealth);
  cs.log.push(logEntry(`${link.recipient.name} accepts ${redistributed} already-mitigated harm from ${target.name} through Shared Burden.`, "status"));
  if (link.recipient.health <= 0 && link.recipient !== cs.player) {
    if (link.recipient.side === "enemy") downEnemy(cs, link.recipient);
    else downAlly(cs, link.recipient);
  }
  return redistributed;
}

function silenceBlocksAbility(def) {
  if (!def) return true;
  return abilityCategoryOf(def) === "spell" || def.school === "performance" || def.audible === true
    || def.requiresSpeech === true || def.requiresVoice === true;
}

function monkPostureImmune(target) {
  const anatomy = String(target?.anatomy || target?.form || "").toLowerCase();
  return !!(target?.postureImmune || target?.incorporeal || MONK_POSTURE_IMMUNE_ANATOMY.has(anatomy));
}

// How much target-side Posture Strain a body can hold. This deliberately reads
// only explicit combat facts: anatomy/form flags, size, weight, and the armour
// band carried into combat. Boss identity does not make posture impossible; it
// changes what spending posture can accomplish (see applyMonkControl).
export function monkPostureCapacity(caster, target) {
  if (!target || monkPostureImmune(target)) return 0;
  let cap = 3;
  const size = String(target.size || "").toLowerCase();
  if (MONK_IMMOVABLE_SIZES.has(size)) cap = 1;
  else if (MONK_LARGE_SIZES.has(size)) cap = Math.min(cap, 2);
  if (target.armorClass === "heavy") cap = Math.min(cap, 2);
  const casterWeight = Number(caster?.weight);
  const targetWeight = Number(target.weight);
  if (Number.isFinite(casterWeight) && casterWeight > 0 && Number.isFinite(targetWeight) && targetWeight > 0) {
    const ratio = targetWeight / casterWeight;
    if (ratio >= 3) cap = Math.min(cap, 1);
    else if (ratio >= 1.75) cap = Math.min(cap, 2);
  }
  return clamp(cap, 0, 3);
}

function combatantActionKey(target) {
  return target?.uid || target?.id || target?.name || "target";
}

function beginMonkAction(actor) {
  if (!actor) return;
  actor._monkPostureBuiltTargets = [];
  actor._monkPostureSpentByTarget = {};
}

function endMonkAction(actor) {
  if (!actor) return;
  delete actor._monkPostureBuiltTargets;
  delete actor._monkPostureSpentByTarget;
}

function gainMonkPosture(cs, attacker, target, amount = 1) {
  if (!attacker || !target || amount <= 0) return false;
  const key = combatantActionKey(target);
  attacker._monkPostureBuiltTargets = attacker._monkPostureBuiltTargets || [];
  if (attacker._monkPostureBuiltTargets.includes(key)) return false;
  attacker._monkPostureBuiltTargets.push(key);
  const capacity = monkPostureCapacity(attacker, target);
  const before = clamp(Math.floor(target.postureStrain || 0), 0, capacity);
  target.postureStrain = Math.min(capacity, before + clamp(Math.floor(amount), 1, 1));
  if (target.postureStrain <= before) {
    if (capacity === 0) cs?.log?.push(logEntry(`${target.name}'s anatomy offers no stable posture to strain.`, "status"));
    return false;
  }
  // One target turn of grace prevents an immediate start-of-turn decay from
  // erasing the contact. Without renewed contact, later turns shed strain.
  target.postureDecayTurns = 1;
  cs?.log?.push(logEntry(`${target.name} gains Posture Strain (${target.postureStrain}/${capacity}).`, "status"));
  return true;
}

function monkPostureReady(target, def, attacker = null) {
  const cost = Math.max(0, Math.floor(def?.monkPostureCost || 0));
  const capacity = monkPostureCapacity(attacker, target);
  return !cost || clamp(Math.floor(target?.postureStrain || 0), 0, capacity) >= cost;
}

function spendMonkPosture(cs, attacker, target, def) {
  if (!isNativeMonkTechnique(def)) return 0;
  const cost = Math.max(0, Math.floor(def?.monkPostureCost || 0));
  if (!cost || !target) return 0;
  attacker._monkPostureSpentByTarget = attacker._monkPostureSpentByTarget || {};
  const key = combatantActionKey(target);
  if (Object.prototype.hasOwnProperty.call(attacker._monkPostureSpentByTarget, key)) {
    return attacker._monkPostureSpentByTarget[key];
  }
  const available = clamp(Math.floor(target.postureStrain || 0), 0, monkPostureCapacity(attacker, target));
  const spent = available >= cost ? cost : 0;
  if (spent) {
    target.postureStrain = available - spent;
    if (target.postureStrain <= 0) target.postureDecayTurns = 0;
    cs?.log?.push(logEntry(`${attacker.name} spends ${spent} of ${target.name}'s Posture Strain (${target.postureStrain}/3 remains).`, "status"));
  }
  attacker._monkPostureSpentByTarget[key] = spent;
  return spent;
}

function gainWarriorTempo(cs, actor, { sequenceTag = null, defensive = false } = {}) {
  if (!actor || (!defensive && !sequenceTag)) return false;
  if (!defensive && actor.lastWarriorSequenceTag === sequenceTag) return false;
  if (!defensive) actor.lastWarriorSequenceTag = sequenceTag;
  const before = clamp(Math.floor(actor.martialTempo || 0), 0, 3);
  actor.martialTempo = Math.min(3, before + 1);
  if (actor.martialTempo <= before) return false;
  cs?.log?.push(logEntry(`${actor.name} builds Martial Tempo (${actor.martialTempo}/3).`, "status"));
  return true;
}

function spendWarriorTempo(cs, actor, def) {
  const minimum = Math.max(0, Math.floor(def?.warriorTempoCost || 0));
  if (!minimum) { delete actor._warriorTempoSpent; return 0; }
  const available = clamp(Math.floor(actor.martialTempo || 0), 0, 3);
  const spent = def.warriorConsumeAllTempo ? available : minimum;
  actor.martialTempo = Math.max(0, available - spent);
  actor._warriorTempoSpent = spent;
  cs?.log?.push(logEntry(`${actor.name} spends ${spent} Martial Tempo (${actor.martialTempo}/3 remains).`, "status"));
  return spent;
}

// Instant-death magic is an earned finisher, not an unconditional boss delete.
// It only functions under a strict health threshold; legendary/boss-scale foes
// use a much smaller threshold and retain a large irreducible resistance.
function applyInstantDeath(cs, caster, target, effect, tier) {
  const bossLike = !!(target.boss || target.isBoss || target.apex
    || tierInfo(target.tier || "common").order >= tierInfo("legendary").order
    || (caster?.maxHealth > 0 && target.maxHealth >= caster.maxHealth * 3));
  const threshold = bossLike ? (effect.bossThreshold ?? 0.08) : (effect.threshold ?? 0.25);
  const healthFraction = target.health / Math.max(1, target.maxHealth || target.health);
  if (healthFraction > threshold) {
    cs.log.push(logEntry(`${target.name}'s life is too strong for the death-working to close around it.`, "status"));
    return false;
  }
  const casterWill = (caster?.will || 0) + (caster?.saveDC || 0) + tierInfo(tier || "common").order;
  const targetWill = (target.will || 0) + (target.controlResist || 0) * 10;
  const contested = clamp(0.2 + (targetWill - casterWill) * 0.04, 0.1, 0.85);
  const resistChance = bossLike ? Math.max(0.7, contested) : contested;
  if (Math.random() < resistChance) {
    cs.log.push(logEntry(`${target.name} resists the hand closing around their heart.`, "status"));
    return false;
  }
  if (lastStandHolds(target)) {
    target.health = 1;
    cs.log.push(logEntry(`${target.name} refuses the final command and clings to one last breath.`, "status"));
    return false;
  }
  target.health = 0;
  cs.log.push(logEntry(`${caster?.name || "The caster"} stills ${target.name}'s heart.`, caster?.side === "player" ? "crit" : "enemy"));
  return true;
}
// Apply an enemy-targeted ability effect. MIND CONTROL gets ONE will-save. Below divine:
// Charm is a brief stand-down, Dominate (if it lands) is a PERMANENT enthrall. At DIVINE
// both bind FOREVER — Dominate leashes the body (attitude kept), Charm rewrites the heart
// (artificial devotion). Everything else applies straight (addStatus owns stun/slow resist).
function applyEnemyEffect(cs, caster, target, effect, tier, sourceDef = null) {
  if (!effect || !target || target.health <= 0) return;
  effect = druidSurgedEffect(caster, effect, sourceDef);
  // Antimagic suppresses spell riders as well as most direct magical damage.
  // Physical techniques and innate racial powers still work inside the field.
  if (sourceDef && hasStatus(target, "antimagicField")
      && isMagicalCastingDiscipline(sourceDef) && !sourceDef.innate) {
    cs.log.push(logEntry(`${target.name}'s antimagic field unravels ${sourceDef.name}.`, "status"));
    return;
  }
  // Dragon Heart does not make its bearer emotionless; it lets a sovereign
  // draconic will keep acting through supernatural dread. Fear riders land at
  // half force and lose a turn of duration (direct fear damage is reduced in
  // dealHit below).
  if (target.triggers?.dragonHeart && sourceDef && FEAR_ABILITY_IDS.has(sourceDef.id)) {
    effect = {
      ...effect,
      value: Math.max(0, Math.round((effect.value || 0) * 0.5)),
      duration: Math.max(1, (effect.duration || 1) - 1),
    };
    cs.log.push(logEntry(`${target.name}'s dragon heart steadies them against ${sourceDef.name}.`, "status"));
  }
  const performedCourage = clamp(
    sumStatus(target, "bardHearteningChorus") + sumStatus(target, "bardDefiantAnthem") + sumStatus(target, "bardOldBallad"),
    0,
    50,
  );
  if (performedCourage > 0 && sourceDef && FEAR_ABILITY_IDS.has(sourceDef.id)) {
    effect = {
      ...effect,
      value: Math.max(0, Math.round((effect.value || 0) * (1 - performedCourage / 100))),
      duration: Math.max(1, (effect.duration || 1) - (performedCourage >= 30 ? 1 : 0)),
    };
    cs.log.push(logEntry(`${target.name} keeps time with a remembered chorus against ${sourceDef.name}.`, "status"));
  }
  const oathCourage = clamp(
    sumStatus(target, "paladinSteadfastWord") + sumStatus(target, "paladinBeaconStance")
      + sumStatus(target, "paladinPilgrimAegis"),
    0,
    55,
  );
  if (oathCourage > 0 && sourceDef && FEAR_ABILITY_IDS.has(sourceDef.id)) {
    effect = {
      ...effect,
      value: Math.max(0, Math.round((effect.value || 0) * (1 - oathCourage / 100))),
      duration: Math.max(1, (effect.duration || 1) - (oathCourage >= 25 ? 1 : 0)),
    };
    cs.log.push(logEntry(`${target.name} stands inside a witnessed oath against ${sourceDef.name}.`, "status"));
  }
  // Mind: control & debuffs the caster inflicts last longer (controlDuration).
  if (effect && CONTROL_DEBUFF.has(effect.type) && (caster?.controlDuration || 0) > 0) {
    effect = { ...effect, duration: Math.max(1, Math.round((effect.duration || 1) * (1 + caster.controlDuration))) };
  }
  // DISPEL — strips brief control, and BREAKS a binding via a CONTEST of wills between
  // the dispeller and the ORIGINAL binder (stored at cast) — NOT a save by the thrall.
  if (effect.type === "dispel") {
    const STRIP = new Set(["charmed", "dominated", "geas", "polymorph", "stun", "slow", "weaken", "vulnerable", "chill", "curse", "silence"]);
    if (Array.isArray(target.statuses)) target.statuses = target.statuses.filter((s) => !STRIP.has(s.type));
    if (target.enthralledBy) {
      const freeChance = Math.min(0.95, Math.max(0.05, 0.5 + (((caster?.will || 0) + (caster?.saveDC || 0)) - (target.dominationWill || 0)) * 0.05));
      if (Math.random() < freeChance) freeThrall(cs, target);
      else cs.log.push(logEntry(`The binding on ${target.name} holds — the binder's will is the stronger.`, "status"));
    } else {
      cs.log.push(logEntry(`${target.name} is cleansed of lingering magics.`, "status"));
    }
    return;
  }
  if (effect.type === "turnProfane") {
    if (!isProfaneEntity(target)) {
      cs.log.push(logEntry(`${sourceDef?.name || "The turning prayer"} finds no profane hold in ${target.name}.`, "status"));
      return;
    }
    const bossLike = isBossScale(caster, target);
    if (Math.random() < sacredResistanceChance(caster, target, tier, bossLike ? 0.5 : 0)) {
      cs.log.push(logEntry(`${target.name} holds against the turning prayer.`, "status"));
      return;
    }
    if (bossLike) {
      if (addStatus(target, { type: "weaken", value: Math.min(20, effect.value || 20), duration: 1 })) {
        cs.log.push(logEntry(`${target.name} recoils from the sacred authority but cannot be driven away.`, "status"));
      }
    } else {
      const turned = addStatus(target, { type: "stun", value: 1, duration: 1 });
      addStatus(target, { type: "weaken", value: clamp(effect.value || 30, 10, 40), duration: clamp(effect.duration || 2, 1, 3) });
      if (turned) cs.log.push(logEntry(`${target.name} recoils helplessly from the sacred authority.`, "status"));
    }
    if (target.side === "enemy") onEnemyControlled(target);
    return;
  }
  if (effect.type === "exorcise") {
    const possessionTypes = new Set(["possessed", "possession", "spiritPossession"]);
    const beforeStatuses = target.statuses?.length || 0;
    target.statuses = (target.statuses || []).filter((status) => !possessionTypes.has(status.type));
    const freedHost = target.statuses.length < beforeStatuses;
    if (freedHost) cs.log.push(logEntry(`${target.name} is separated from the possessing influence.`, "status"));
    if (!isProfaneEntity(target)) {
      if (!freedHost) cs.log.push(logEntry(`${sourceDef?.name || "The exorcism"} finds no possessing or profane entity in ${target.name}.`, "status"));
      return;
    }
    const bossLike = isBossScale(caster, target);
    if (Math.random() < sacredResistanceChance(caster, target, tier, bossLike ? 0.45 : 0.05)) {
      cs.log.push(logEntry(`${target.name} resists expulsion and clings to the world.`, "status"));
      return;
    }
    const healthFraction = target.health / Math.max(1, target.maxHealth || target.health);
    if (target._summoned || (!bossLike && healthFraction <= clamp(effect.threshold || 0.3, 0.15, 0.4))) {
      target.health = 0;
      target._banished = true;
      cs.log.push(logEntry(`${target.name} is banished beyond the violated boundary.`, caster?.side === "player" ? "crit" : "enemy"));
      return;
    }
    const duration = bossLike ? 1 : clamp(effect.duration || 3, 1, 4);
    const silenced = addStatus(target, { type: "silence", duration });
    addStatus(target, { type: "weaken", value: bossLike ? 20 : 40, duration });
    if (target.resolve != null) target.resolve = Math.max(0, target.resolve - (bossLike ? 2 : 5));
    if (silenced) cs.log.push(logEntry(`${target.name}'s profane nature is suppressed, not merely wounded.`, "status"));
    if (target.side === "enemy") onEnemyControlled(target);
    return;
  }
  if (effect.type === "misdirected") {
    const bossLike = isBossScale(caster, target);
    const casterPresence = caster?.attrs?.presence || caster?.will || 0;
    const targetWill = (target.will || 0) + (target.controlResist || 0) * 10;
    const resistChance = clamp(0.2 + Math.max(0, targetWill - casterPresence) * 0.04 + (bossLike ? 0.35 : 0), 0.1, 0.85);
    if (Math.random() < resistChance) {
      cs.log.push(logEntry(`${target.name} sees through the sacred misdirection.`, "status"));
      return;
    }
    if (addStatus(target, { ...effect, value: 1, duration: clamp(effect.duration || 2, 1, 2) })) {
      cs.log.push(logEntry(`${target.name}'s next hostile intent is led toward a harmless false opening.`, "status"));
      if (target.side === "enemy") onEnemyControlled(target);
    }
    return;
  }
  if (effect.type === "warriorWeaponBind") {
    if (addStatus(target, { type: "warriorWeaponBound", value: 1, duration: clamp(effect.duration || 2, 1, 2) })) {
      cs.log.push(logEntry(`${target.name}'s weapon line is caught under physical leverage.`, "status"));
    }
    return;
  }
  if (effect.type === "warriorDriveBack") {
    if (target.side === "enemy") target.distance = Math.min(MAX_DISTANCE, (target.distance || 0) + clamp(effect.value || 1, 1, 2));
    cs.log.push(logEntry(`${target.name} is forced back by controlled weapon pressure.`, "status"));
    return;
  }
  if (effect.type === "warriorReadOpponent") {
    target.statuses = (target.statuses || []).filter((status) => !(status.type === "warriorReadOpponent" && status.sourceUid === caster.uid));
    target.statuses.push({
      type: "warriorReadOpponent",
      value: clamp(effect.value || 30, 10, 40),
      pen: clamp(effect.pen || 5, 1, 8),
      crit: clamp(effect.crit || 15, 5, 20),
      duration: clamp(effect.duration || 3, 1, 4),
      sourceUid: caster.uid,
    });
    cs.log.push(logEntry(`${caster.name} reads ${target.name}'s balance and repeated habits.`, "status"));
    return;
  }
  if (effect.type === "warriorStopThrust") {
    if (target.side === "enemy") target.distance = Math.min(MAX_DISTANCE, (target.distance || 0) + clamp(effect.value || 1, 1, 2));
    addStatus(target, { type: "warriorAdvanceChecked", value: 1, duration: clamp(effect.duration || 2, 1, 2) });
    cs.log.push(logEntry(`${target.name}'s next approach is checked by the waiting point.`, "status"));
    return;
  }
  if (effect.type === "barbarianChallenge" || effect.type === "barbarianFoeCaller") {
    const aware = target.health > 0 && !target.unconscious && target.canHear !== false && !target.deaf
      && target.aware !== false && target.demeanor !== "mindless" && !target.alienMorale && !target.moraleImmune;
    if (!aware) {
      cs.log.push(logEntry(`${target.name} cannot meaningfully receive the physical challenge.`, "status"));
      return;
    }
    const bossLike = isBossScale(caster, target);
    const statusType = effect.type === "barbarianChallenge" ? "barbarianChallenged" : "barbarianFoeCalled";
    target.statuses = (target.statuses || []).filter((status) => !(status.type === statusType && status.sourceUid === caster.uid));
    addStatus(target, {
      type: statusType,
      value: bossLike ? clamp(Math.round((effect.value || 15) * 0.4), 3, 8) : clamp(effect.value || 15, 8, 22),
      duration: bossLike ? 1 : clamp(effect.duration || 2, 1, 2),
      sourceUid: caster.uid,
    });
    cs.log.push(logEntry(`${target.name} answers the visible, audible pressure without losing will or allegiance.`, "status"));
    return;
  }
  if (effect.type === "rangerQuarrySign" || RANGER_PRESSURE_STATUS.has(effect.type)) {
    if (!isNativeRangerFieldcraft(sourceDef)) return;
    const trainedBeast = (sourceDef.requiresTrainedBeastAlly || sourceDef.requiresFlyingBeastAlly)
      ? rangerBeastAlly(cs, caster, sourceDef)
      : null;
    if ((sourceDef.requiresTrainedBeastAlly || sourceDef.requiresFlyingBeastAlly)
        && !trainedBeast) {
      cs.log.push(logEntry(`${caster.name} has no conscious trained ${sourceDef.requiresFlyingBeastAlly ? "flying " : ""}animal ally to coordinate.`, "status"));
      return;
    }
    if (effect.type === "rangerCompanionSignal") {
      const beastProfile = attackProfile(trainedBeast, BASIC_ATTACK, tier || trainedBeast.tier || "common", false);
      const contact = beastProfile ? dealHit(cs, trainedBeast, target, beastProfile, BASIC_ATTACK, tier || "common") : null;
      if (!contact || contact.dealt <= 0 || target.health <= 0) {
        cs.log.push(logEntry(`${trainedBeast.name}'s trained response fails to establish contact; no Quarry Insight is gained.`, "status"));
        return;
      }
    }
    const trapLike = ["rangerSetSnare", "rangerLayeredSnare", "rangerKillZone"].includes(effect.type);
    const anatomy = String(target.anatomy || target.form || "").toLowerCase();
    if (trapLike && (target.incorporeal || ["incorporeal", "mist", "swarm"].includes(anatomy))) {
      cs.log.push(logEntry(`${target.name} offers no stable body or footing for ${sourceDef.name}.`, "status"));
      return;
    }
    const bossLike = isBossScale(caster, target);
    const baseValue = clamp(effect.value || (effect.type === "rangerQuarrySign" ? 6 : 12), 1, 30);
    const value = bossLike ? clamp(Math.round(baseValue * 0.45), 2, 10) : baseValue;
    const duration = effect.type === "rangerQuarrySign"
      ? clamp(effect.duration || 4, 1, 6)
      : bossLike ? 1 : clamp(effect.duration || 2, 1, 3);
    target.statuses = (target.statuses || []).filter((status) => !(
      status.type === effect.type && status.sourceUid === caster.uid
    ));
    const applied = addStatus(target, { type: effect.type, value, duration, sourceUid: caster.uid });
    if (!applied) {
      cs.log.push(logEntry(`${target.name} keeps enough freedom to defeat the fieldcraft pressure.`, "status"));
      return;
    }
    if (["rangerSetSnare", "rangerLayeredSnare"].includes(effect.type) && target.side === "enemy") {
      target.distance = Math.min(MAX_DISTANCE, (target.distance || 0) + (bossLike ? 0 : 1));
    }
    gainRangerQuarryInsight(cs, caster, target, sourceDef);
    cs.log.push(logEntry(`${caster.name}'s ${sourceDef.name} establishes a physical fieldcraft advantage against ${target.name}${bossLike ? " at reduced effect" : ""}.`, "status"));
    return;
  }
  if (ROGUE_PRESSURE_STATUS.has(effect.type)) {
    if (!isNativeRogueSubterfuge(sourceDef)) return;
    if (!roguePhysicalRequirementMet(cs, caster, target, sourceDef)) {
      cs.log.push(logEntry(`${caster.name} cannot establish the physical circumstances required for ${sourceDef.name}.`, "status"));
      return;
    }
    if ((sourceDef.rogueRequiresUnderstanding || sourceDef.audible)
        && !canReceiveRogueSpeech(target)) {
      cs.log.push(logEntry(`${target.name} cannot hear and understand the mundane verbal play behind ${sourceDef.name}.`, "status"));
      return;
    }
    const anatomy = String(target.anatomy || target.form || "").toLowerCase();
    const incorporeal = target.incorporeal || ["incorporeal", "mist", "swarm"].includes(anatomy);
    if (incorporeal && ["rogueFaultFinder", "rogueMasterKey", "roguePlannedCollapse"].includes(effect.type)) {
      cs.log.push(logEntry(`${target.name} offers no accessible physical fault for ${sourceDef.name}.`, "status"));
      return;
    }
    if (effect.type === "rogueVenomWork") {
      const race = String(target.race || target.kind || "").toLowerCase();
      const toxinImmune = target.toxinImmune || target.poisonImmune || target.immuneToPoison
        || target.triggers?.poisonImmune || ["construct", "undead"].includes(race);
      if (toxinImmune) {
        cs.log.push(logEntry(`${target.name}'s body cannot be impaired by the prepared physical toxin.`, "status"));
        return;
      }
    }
    const bossLike = isBossScale(caster, target);
    const baseValue = clamp(effect.value || 10, 1, 30);
    const value = bossLike ? clamp(Math.round(baseValue * 0.45), 2, 10) : baseValue;
    const duration = bossLike ? 1 : clamp(effect.duration || 2, 1, 3);
    const sourceUid = combatantActionKey(caster);
    target.statuses = (target.statuses || []).filter((status) => !(
      status.type === effect.type && status.sourceUid === sourceUid
    ));
    const applied = addStatus(target, { type: effect.type, value, duration, sourceUid });
    if (!applied) {
      cs.log.push(logEntry(`${target.name} keeps enough physical freedom to defeat the subterfuge pressure.`, "status"));
      return;
    }
    gainRogueOpening(cs, caster, target, sourceDef);
    cs.log.push(logEntry(`${caster.name}'s ${sourceDef.name} creates a bounded physical advantage against ${target.name}${bossLike ? " at reduced effect" : ""}.`, "status"));
    return;
  }
  if (WARLOCK_ENEMY_STATUS.has(effect.type)) {
    if (!isNativeWarlockPactcraft(sourceDef)) return;
    if (!warlockTargetEligible(cs, caster, target, sourceDef)) {
      cs.log.push(logEntry(`${target.name} does not satisfy the explicit pact conditions for ${sourceDef.name}.`, "status"));
      return;
    }
    if (WARLOCK_PRESSURE_STATUS.has(effect.type) && hasStatus(target, "unstoppable")) {
      cs.log.push(logEntry(`${target.name}'s unstoppable state rejects the bounded pact pressure of ${sourceDef.name}.`, "status"));
      return;
    }
    const bossLike = isBossScale(caster, target);
    const sourceUid = combatantActionKey(caster);
    const scorch = WARLOCK_SCORCH_STATUS.has(effect.type);
    const magnitude = Number(
      effect.value ?? effect.scorch ?? effect.debtPressure ?? effect.pactPressure
        ?? effect.revealPressure ?? effect.debtBonus ?? effect.wardPressure
        ?? effect.hexPressure ?? effect.chainPressure ?? effect.bargainPressure
        ?? effect.contractPressure ?? effect.sympatheticPressure ?? effect.secretPressure ?? 1,
    );
    const bossScale = clamp(Number(effect.bossScale ?? 0.45), 0.25, 0.6);
    const softened = !scorch && bossLike;
    const baseValue = softened
      ? Math.max(1, Math.round(magnitude * bossScale))
      : Math.max(1, Math.round(magnitude));
    const duration = clamp(effect.duration || 2, 1, 4);
    const existing = (target.statuses || []).find((status) =>
      status.type === effect.type && status.sourceUid === sourceUid);
    const maxStacks = effect.type === "warlockLayeredHex"
      ? clamp(Math.floor(effect.maxStacks || 2), 1, 2)
      : 1;
    const stacks = effect.type === "warlockLayeredHex"
      ? Math.min(maxStacks, Math.max(1, Math.floor(existing?.stacks || 0) + 1))
      : 1;
    target.statuses = (target.statuses || []).filter((status) => !(
      status.type === effect.type && status.sourceUid === sourceUid
    ));
    const applied = addStatus(target, {
      ...effect,
      value: Math.min(40, baseValue * stacks),
      duration,
      sourceUid,
      stacks,
      maxStacks,
    });
    if (!applied) {
      cs.log.push(logEntry(`${target.name} rejects the bounded pact effect of ${sourceDef.name}.`, "status"));
      return;
    }
    if (["warlockPactChain", "warlockBindingLinks"].includes(effect.type)
        && target.side === "enemy" && !bossLike) {
      target.distance = Math.min(MAX_DISTANCE, (target.distance || 0) + 1);
    }
    if (["warlockWhisperedTerms", "warlockSecretLeverage", "warlockOpenBargain"].includes(effect.type)
        && Number.isFinite(Number(target.morale))) {
      target.morale = Math.max(0, target.morale - clamp(Math.round(baseValue / 4), 1, bossLike ? 3 : 6));
    }
    cs.log.push(logEntry(`${caster.name}'s ${sourceDef.name} establishes ${softened ? "boss-softened " : ""}${scorch ? "pact scorch" : "source-owned pact pressure"} on ${target.name}${stacks > 1 ? ` (${stacks}/${maxStacks} layers)` : ""}.`, "status"));
    return;
  }
  if (ARTIFICER_ENEMY_STATUS.has(effect.type)) {
    if (!isNativeArtificerDevicecraft(sourceDef)) return;
    if (ARTIFICER_PRESSURE_STATUS.has(effect.type) && hasStatus(target, "unstoppable")) {
      cs.log.push(logEntry(`${target.name}'s unstoppable state defeats the bounded device pressure of ${sourceDef.name}.`, "status"));
      return;
    }
    const bossLike = isBossScale(caster, target);
    const sourceUid = combatantActionKey(caster);
    const scorch = effect.type === "artificerSnapfire";
    const magnitude = Number(
      effect.value ?? effect.scorch ?? effect.movementPressure ?? effect.deviceDamageBonus
        ?? effect.structurePressure ?? effect.devicePressure ?? effect.accuracyPenalty
        ?? effect.armorPressure ?? 1,
    );
    const bossScale = clamp(Number(effect.bossScale ?? 0.45), 0.25, 0.6);
    const softened = !scorch && bossLike;
    const value = softened ? Math.max(1, Math.round(magnitude * bossScale)) : Math.max(1, Math.round(magnitude));
    const duration = clamp(effect.duration || 2, 1, 4);
    target.statuses = (target.statuses || []).filter((status) => !(
      status.type === effect.type && status.sourceUid === sourceUid
    ));
    const applied = addStatus(target, { ...effect, value, duration, sourceUid });
    if (!applied) {
      cs.log.push(logEntry(`${target.name} defeats the bounded physical circumstances of ${sourceDef.name}.`, "status"));
      return;
    }
    if (effect.type === "artificerTangleLine" && target.side === "enemy" && !bossLike) {
      target.distance = Math.min(MAX_DISTANCE, (target.distance || 0) + 1);
    }
    cs.log.push(logEntry(`${caster.name}'s ${sourceDef.name} establishes ${softened ? "boss-softened " : ""}${scorch ? "prepared scorch" : "source-owned device pressure"} on ${target.name}.`, "status"));
    return;
  }
  if (DRUID_ENEMY_STATUS.has(effect.type)) {
    if (!isNativeDruidPrimalcraft(sourceDef)) return;
    const bossLike = isBossScale(caster, target);
    const magnitude = Number(
      effect.value ?? effect.rootPressure ?? effect.decay ?? effect.accuracyPenalty
        ?? effect.resolveOnDefeat ?? effect.movementPenalty ?? effect.scorch
        ?? effect.decayAmplification ?? effect.actionPressure ?? effect.pushPressure
        ?? effect.decayVulnerability ?? effect.stormCharge ?? effect.glarePressure ?? 1,
    );
    const isPressure = DRUID_PRESSURE_STATUS.has(effect.type);
    const bossScale = clamp(Number(effect.bossScale ?? 0.45), 0.25, 0.6);
    const value = isPressure && bossLike
      ? Math.max(1, Math.round(magnitude * bossScale))
      : Math.max(1, Math.round(magnitude));
    const duration = clamp(effect.duration || 2, 1, 4);
    const sourceUid = combatantActionKey(caster);
    target.statuses = (target.statuses || []).filter((status) => !(
      status.type === effect.type && status.sourceUid === sourceUid
    ));
    const applied = addStatus(target, {
      ...effect,
      value,
      duration,
      sourceUid,
      resolveCap: effect.resolveCap,
    });
    if (!applied) {
      cs.log.push(logEntry(`${target.name} resists the bounded natural pressure of ${sourceDef.name}.`, "status"));
      return;
    }
    if (effect.type === "druidGaleShear" && target.side === "enemy" && !bossLike) {
      target.distance = Math.min(MAX_DISTANCE, (target.distance || 0) + 1);
    }
    cs.log.push(logEntry(`${caster.name}'s ${sourceDef.name} establishes ${bossLike && isPressure ? "boss-softened " : ""}primal ${isPressure ? "pressure" : "decay"} on ${target.name}.`, "status"));
    return;
  }
  if (PALADIN_PRESSURE_STATUS.has(effect.type)) {
    if (!isNativePaladinOathcraft(sourceDef)) return;
    const semantic = [
      "paladinWitnessChallenge", "paladinCallToAccount", "paladinOfferQuarter", "paladinPeaceCommand",
    ].includes(effect.type) || sourceDef.audible || sourceDef.requiresUnderstanding;
    if (semantic && !canReceiveRogueSpeech(target)) {
      cs.log.push(logEntry(`${target.name} cannot knowingly hear and understand ${sourceDef.name}; the oathcraft does not compel them.`, "status"));
      return;
    }
    const anatomy = String(target.anatomy || target.form || "").toLowerCase();
    if (effect.type === "paladinThresholdBlow" && (target.incorporeal || ["incorporeal", "mist", "swarm"].includes(anatomy))) {
      cs.log.push(logEntry(`${target.name} offers no body or footing for the threshold check.`, "status"));
      return;
    }
    const bossLike = isBossScale(caster, target);
    const baseValue = clamp(
      effect.value || effect.attention || effect.pressure || effect.truthPressure
        || effect.surrenderPressure || effect.haltPressure || effect.morale || 12,
      1,
      30,
    );
    const value = bossLike ? clamp(Math.round(baseValue * 0.45), 2, 10) : baseValue;
    const duration = bossLike ? 1 : clamp(effect.duration || 2, 1, 3);
    const sourceUid = combatantActionKey(caster);
    target.statuses = (target.statuses || []).filter((status) => !(
      status.type === effect.type && status.sourceUid === sourceUid
    ));
    const applied = addStatus(target, { type: effect.type, value, duration, sourceUid });
    if (!applied) {
      cs.log.push(logEntry(`${target.name} keeps enough agency to defeat the oathbound pressure.`, "status"));
      return;
    }
    if (["paladinOfferQuarter", "paladinPeaceCommand"].includes(effect.type)
        && Number.isFinite(Number(target.morale))) {
      target.morale = Math.max(0, target.morale - clamp(effect.morale || Math.round(value / 2), 1, bossLike ? 5 : 10));
    }
    if (effect.type === "paladinThresholdBlow" && target.side === "enemy") {
      target.distance = Math.min(MAX_DISTANCE, (target.distance || 0) + (bossLike ? 0 : 1));
    }
    cs.log.push(logEntry(`${target.name} faces ${sourceDef.name} as bounded witnessed pressure, without compulsion or lost allegiance.`, "status"));
    return;
  }
  if (BARD_PRESSURE_STATUS.has(effect.type)) {
    const semantic = !!sourceDef?.bardRequiresUnderstanding;
    const sonicPressure = sourceDef?.damageType === "sonic";
    const eligible = semantic
      ? canUnderstandBardPerformance(target)
      : sonicPressure
        ? !target.sonicImmune
        : canPerceiveBardPerformance(target);
    if (!eligible) {
      cs.log.push(logEntry(`${target.name} cannot meaningfully receive ${sourceDef?.name || "the performance"}.`, "status"));
      return;
    }
    const bossLike = isBossScale(caster, target);
    const value = bossLike
      ? clamp(Math.round((effect.value || 10) * 0.45), 2, 10)
      : clamp(effect.value || 10, 3, 25);
    const duration = bossLike ? 1 : clamp(effect.duration || 2, 1, 3);
    // Native pressure refreshes its own line instead of stacking duplicate
    // timing penalties into a pseudo stun-lock.
    target.statuses = (target.statuses || []).filter((status) => status.type !== effect.type);
    if (addStatus(target, { type: effect.type, value, duration, sourceUid: caster?.uid || null })) {
      cs.log.push(logEntry(`${target.name} is pressured by ${sourceDef?.name || "the performance"} without losing agency or allegiance.`, "status"));
    }
    return;
  }
  if (effect.type === "instantKill") {
    applyInstantDeath(cs, caster, target, effect, tier);
    return;
  }
  if (effect.type === "levelDrain") {
    const applied = addStatus(target, {
      ...effect,
      value: clamp(effect.value || 20, 5, 40),
      duration: clamp(effect.duration || 3, 1, 6),
    });
    if (applied) {
      if (target.resolve != null) target.resolve = Math.max(0, target.resolve - Math.max(1, Math.ceil((effect.value || 20) / 10)));
      cs.log.push(logEntry(`${target.name} is enervated — skill, aim, and force ebb away.`, "status"));
      if (target.side === "enemy") onEnemyControlled(target);
    }
    return;
  }
  if (effect.type === "polymorph") {
    const bossLike = !!(target.boss || target.isBoss || target.apex
      || tierInfo(target.tier || "common").order >= tierInfo("legendary").order
      || (caster?.maxHealth > 0 && target.maxHealth >= caster.maxHealth * 3));
    const casterWill = (caster?.will || 0) + (caster?.saveDC || 0) + tierInfo(tier || "common").order;
    const targetWill = (target.will || 0) + (target.controlResist || 0) * 10;
    const resistChance = clamp(0.1 + Math.max(0, targetWill - casterWill) * 0.04 + (bossLike ? 0.5 : 0), 0.1, 0.9);
    if (hasStatus(target, "unstoppable") || Math.random() < resistChance) {
      cs.log.push(logEntry(`${target.name} resists the attempted transformation.`, "status"));
      return;
    }
    const duration = clamp(effect.duration || 3, 1, bossLike ? 2 : 4);
    if (addStatus(target, { ...effect, duration, sourceUid: caster?.uid })) {
      cs.log.push(logEntry(`${target.name} is transformed into a harmless lesser shape.`, "status"));
      if (target.side === "enemy") onEnemyControlled(target);
    }
    return;
  }
  if (MIND_CONTROL.has(effect.type)) {
    if (Math.random() < willSaveChance(caster, target, effect.type, tier)) {
      cs.log.push(logEntry(`${target.name} shrugs off the ${effect.type === "dominated" ? "domination" : "charm"}.`, "status"));
      if (target.side === "enemy") onEnemyControlled(target); // the failed assault still rattles them
      return;
    }
    if (effect.type === "dominated") { bindToCaster(cs, caster, target, "dominate"); return; } // permanent thrall
    if (effect.type === "charmed" && tier === "divine") { bindToCaster(cs, caster, target, "charm"); return; } // permanent, artificial love
    if (effect.type === "geas") {
      addStatus(target, { ...effect, value: clamp(effect.value || 6, 2, 10), sourceUid: caster?.uid });
      cs.log.push(logEntry(`${target.name} is bound by a geas and will suffer for each disobedient attack.`, "status"));
      if (target.side === "enemy") onEnemyControlled(target);
      return;
    }
    // a sub-divine charm is a brief stand-down — falls through to addStatus
  }
  addStatus(target, effect);
  if (CONTROL_TYPES.has(effect.type) && target.side === "enemy") onEnemyControlled(target);
}

// Move a non-player combatant to a side, splicing it between cs.enemies/cs.allies.
function combatantArray(cs, c) {
  if (cs.enemies.includes(c)) return cs.enemies;
  if ((cs.allies || []).includes(c)) return cs.allies;
  return null;
}
function moveToSide(cs, c, side) {
  if (c === cs.player) return; // the player never leaves their slot
  const from = combatantArray(cs, c);
  if (from) { const i = from.indexOf(c); if (i >= 0) from.splice(i, 1); }
  c.side = side;
  if (side === "player") { cs.allies = cs.allies || []; cs.allies.push(c); }
  else cs.enemies.push(c);
}
// BIND a subject to the caster (a landed Dominate, or a divine Charm). Both switch the
// subject to the caster's side at once and last until the binder dies/releases it or a
// Dispel beats the binder's will. The KIND differs in the FICTION (engine flavor only):
// "dominate" is a leash — the subject keeps its attitude and may loathe its master;
// "charm" rewrites the heart — artificial devotion. dominationWill is the binder's
// potency, stored so a later Dispel can contest it even if the binder is long gone.
function bindToCaster(cs, caster, target, kind) {
  const casterSide = (caster === cs.player || caster?.side === "player") ? "player" : "enemy";
  target.enthralledBy = caster === cs.player ? "p" : (caster?.uid || null);
  target.dominationWill = (caster?.will || 0) + (caster?.saveDC || 0);
  target.enthralledFrom = target.side; // where to revert if freed
  target.bindKind = kind;
  if (Array.isArray(target.statuses)) target.statuses = target.statuses.filter((s) => s.type !== "charmed" && s.type !== "dominated");
  addStatus(target, { type: "enthralled", value: 1, duration: 99999 });
  if (target !== cs.player) moveToSide(cs, target, casterSide);
  cs.log.push(logEntry(kind === "charm"
    ? `${target.name} turns to ${caster?.name || "the caster"} with sudden, helpless devotion — a love that is not their own.`
    : `${target.name} is bound — enthralled, their will no longer their own.`, "status"));
}
// Break one binding — drop the marks and revert the subject to the side it came from.
function freeThrall(cs, c) {
  const back = c.enthralledFrom || (c.side === "player" ? "enemy" : "player");
  c.enthralledBy = null; c.dominationWill = 0; c.enthralledFrom = null; c.bindKind = null;
  if (Array.isArray(c.statuses)) c.statuses = c.statuses.filter((s) => s.type !== "enthralled");
  if (c !== cs.player && c.side !== back) moveToSide(cs, c, back);
  cs.log.push(logEntry(`${c.name} shudders as the binding breaks — their will returns.`, "status"));
}
// Free every thrall bound to `uid` (its dominator died) — see freeThrall.
function freeThrallsOf(cs, uid) {
  if (!uid) return;
  for (const c of allCombatants(cs)) if (c.enthralledBy === uid) freeThrall(cs, c);
}
// livingEnemies = anything not dead and not resolved (yielded/fled/ko). A FLEEING
// foe is still "living" — it's on the field, running, until it gets clear.
const livingEnemies = (cs) => cs.enemies.filter((e) => e.health > 0 && !e.resolved);
const livingAllies = (cs) => (cs.allies || []).filter((a) => a.health > 0 && !a.resolved && !a._dead);
// The player's side as a target list for enemies: the player plus living allies.
const playerSide = (cs) => [cs.player, ...livingAllies(cs)].filter((c) => c.health > 0);
// Foes still actively FIGHTING — a fleeing foe is on the field but not a threat.
const liveAttackers = (cs) => livingEnemies(cs).filter((e) => !e.fleeing);
// Foes that yielded and kneel at the player's mercy — on the field, awaiting the
// player's verdict (finish or spare). They keep combat from ending on their own.
const pendingCaptives = (cs) => cs.enemies.filter((e) => e.resolved === "yielded" && !e._dead);
// Combat is over when nothing's left fighting AND no captive waits. A CHARMED foe is
// stood down (no longer a threat) — once every remaining foe is charmed the field is
// yours. (Dominated foes are already gone — they've switched to the caster's side.)
const combatOver = (cs) => livingEnemies(cs).filter((e) => !hasStatus(e, "charmed")).length === 0 && pendingCaptives(cs).length === 0;
// The player may strike anything alive that isn't already gone — including a
// fleeing foe (to run it down) or a yielded one (to execute it, deliberately).
const playerTargetable = (e) => !!e && e.health > 0 && !e._dead && (!e.resolved || e.resolved === "yielded");
const sideHpFrac = (list) => {
  const liv = list.filter((c) => c.health > 0);
  return liv.length ? liv.reduce((s, c) => s + c.health / Math.max(1, c.maxHealth), 0) / liv.length : 0;
};

// ----- setup -----

function playerThreat(p) {
  const learned = (p.abilities || []).filter((a) => !["basic-attack", "defend", "talk"].includes(a.id)).length;
  return p.weapon.max + p.maxHealth * 0.2 + p.critChance * 0.1 + learned * 1.5;
}
function enemyThreat(e) {
  return e.maxHealth * 0.25 + e.weapon.max + tierInfo(e.tier).order * 2;
}

function hasAbilityMetamagic(actor, def, metamagicId) {
  if (!actor || !def) return false;
  // Metamagic belongs to cast spells only. Forged legacy state must never make
  // a martial, innate, survival, social, or Bard performance action-free or
  // otherwise rewrite it.
  if (abilityCategoryOf(def) !== "spell") return false;
  const perAbility = actor.metamagicByAbilityId?.[def.id];
  if (Array.isArray(perAbility)) return perAbility.includes(metamagicId);
  // Backward-compatible combat snapshots predate per-spell profiles.
  return !!(actor.signatureSpellIds?.includes(def.id) && actor.metamagicIds?.includes(metamagicId));
}

function effectiveAbilityTarget(actor, def) {
  if (def?.target === "enemy" && hasAbilityMetamagic(actor, def, "shaped-signature")) return "all-enemies";
  return def?.target || "enemy";
}

function isTwinnedSignature(actor, def) {
  return def?.target === "enemy"
    && !hasAbilityMetamagic(actor, def, "shaped-signature")
    && hasAbilityMetamagic(actor, def, "twinned-signature");
}

function effectiveActionCost(actor, def) {
  if (hasAbilityMetamagic(actor, def, "quickened-signature")) return 0;
  return def?.actionCost || 1;
}

function effectiveCooldown(actor, def) {
  const convergence = hasStatus(actor, "arcaneConvergence") ? 1 : 0;
  return Math.max(0, (def?.cooldown || 0) - convergence);
}

// ----- browser-native deck state -----

function makeDeck(character, seed, entitlements = progressionCombatEntitlements(character)) {
  const combatCharacter = { ...character, abilities: entitlements.abilities };
  const specs = defaultCombatDeck(combatCharacter);
  const cards = {};
  const ids = specs.map((spec, index) => {
    const uid = `c${String(index + 1).padStart(3, "0")}`;
    const definition = cardDefinition(spec.abilityId, spec.tier);
    const signature = entitlements.signatureSpellIds.includes(spec.abilityId);
    const metamagic = entitlements.metamagicByAbilityId?.[spec.abilityId]
      || (signature ? entitlements.metamagicIds : []);
    const quickened = metamagic.includes("quickened-signature");
    const shaped = metamagic.includes("shaped-signature") && definition?.target === "enemy";
    cards[uid] = {
      uid,
      ...definition,
      ...(quickened ? { energyCost: 0 } : {}),
      ...(shaped ? { target: "all-enemies" } : {}),
      ...(signature ? { signature: true } : {}),
      ...(metamagic.length ? { metamagic: [...metamagic] } : {}),
    };
    return uid;
  });
  const shuffled = shuffleSeeded(ids, normalizeSeed(seed));
  return {
    cards,
    draw: shuffled.items,
    hand: [],
    discard: [],
    exhaust: [],
    shuffleState: shuffled.state,
  };
}

function reshuffleDiscard(cs) {
  if (cs.deck.draw.length || !cs.deck.discard.length) return;
  const shuffled = shuffleSeeded(cs.deck.discard, cs.deck.shuffleState);
  cs.deck.draw = shuffled.items;
  cs.deck.discard = [];
  cs.deck.shuffleState = shuffled.state;
  cs.log.push(logEntry("The discard is gathered and shuffled.", "system"));
}

function drawCardsInto(cs, count) {
  for (let i = 0; i < count; i += 1) {
    reshuffleDiscard(cs);
    if (!cs.deck.draw.length) break;
    const uid = cs.deck.draw.shift();
    if (cs.deck.hand.length >= 10) {
      cs.deck.discard.push(uid);
      cs.log.push(logEntry(`${cs.deck.cards[uid]?.name || "A card"} is discarded — your hand is full.`, "system"));
    } else {
      cs.deck.hand.push(uid);
    }
  }
}

export function drawCards(cs0, count = 1) {
  if (!cs0?.deck || count <= 0) return cs0;
  const cs = clone(cs0);
  drawCardsInto(cs, count);
  return cs;
}

function discardHand(cs) {
  const retained = [];
  for (const uid of cs.deck.hand) {
    const card = cs.deck.cards[uid];
    if (card?.retain) retained.push(uid);
    else if (card?.ethereal) cs.deck.exhaust.push(uid);
    else cs.deck.discard.push(uid);
  }
  cs.deck.hand = retained;
}

function startPlayerDeckRound(cs, { initial = false } = {}) {
  if (!initial) {
    cs.round = (cs.round || cs.turn || 1) + 1;
    cs.turn = cs.round; // legacy morale/result code reads turn
    cs.log.push(logEntry(`— Round ${cs.round} —`, "system"));
  }
  const begun = beginTurnFor(cs, cs.player, { deckMode: true });
  if (begun === "dead" || playerDown(cs)) return finishDefeat(cs);
  cs.player.maxEnergy = 3;
  cs.player.energy = begun === "stun" || begun === "controlled" ? 0 : 3;
  cs.player.actionsLeft = cs.player.energy; // compatibility for legacy helpers
  planEnemyIntents(cs);
  if (begun === "controlled" || begun === "stun") {
    // A stunned or controlled player never receives an actionable hand. The
    // deck driver sees this internal enemy phase and resolves it immediately.
    cs.phase = "enemy";
    return checkCombatEnd(cs);
  }
  cs.phase = "player";
  drawCardsInto(cs, Math.max(0, 5 - cs.deck.hand.length));
  return checkCombatEnd(cs);
}

// Lend a rider their mount's charge: better aim and reach, a heavier blow, more
// speed. The mount itself fights separately; this is purely the rider's lift.
function applyMountedBonus(c, b) {
  if (!c || !b) return;
  c.accuracy = (c.accuracy || 0) + (b.accuracy || 0);
  c.dodge = (c.dodge || 0) + (b.dodge || 0);
  c.speed = (c.speed || 0) + (b.speed || 0);
  if (c.weapon) {
    const w = { ...c.weapon };
    if (b.damageMult) { w.min = Math.max(1, Math.round(w.min * (1 + b.damageMult))); w.max = Math.max(1, Math.round(w.max * (1 + b.damageMult))); }
    if (b.reach) w.reach = Math.max(w.reach || 1, 1 + b.reach);
    c.weapon = w;
  }
  c.mounted = true;
}

export function initCombat(character, codex, enemies, opts = {}) {
  LOG_SEQ = 0;
  const cs = deriveCombatStats(character, codex);
  const entitlements = progressionCombatEntitlements(character);
  const learned = entitlements.abilities;
  const abilities = [
    { id: BASIC_ATTACK.id, tier: "common" },
    { id: DEFEND.id, tier: "common" },
    { id: TALK.id, tier: "common" },
    ...learned.map((e) => (typeof e === "string" ? { id: e, tier: "common" } : { id: e.id, tier: e.tier || "common" })),
  ]
    .map((ability) => ({ ...ability, tier: clampAbilityTier(ability.id, ability.tier) }))
    .filter((a) => { const d = getAbilityDef(a.id); return d && !d.noncombat; }); // travel spells never fight

  // +life affixes (cs.maxHealth above character.vitalityMax) are granted filled,
  // so a wounded player still benefits from extra health gear at full value.
  const healthBonus = Math.max(0, cs.maxHealth - (character.vitalityMax || cs.maxHealth));
  const player = {
    uid: "p",
    name: character.name || "You",
    race: String(character.race || character.progression?.racial?.raceId || "").toLowerCase(),
    anatomy: character.anatomy || character.form || null,
    size: character.size || null,
    weight: Number.isFinite(Number(character.weight)) ? Number(character.weight) : null,
    needs: clone(character.needs || {}),
    sunlightExposure: !!opts.sunlight,
    health: Math.min(cs.maxHealth, Math.round(character.vitality) + healthBonus),
    maxHealth: cs.maxHealth,
    resolve: Math.round(character.resolve ?? 0),
    resolveMax: character.resolveMax ?? 0,
    dr: cs.dr || 0, fortify: cs.fortify || 0,
    phaseChance: cs.phaseChance || 0, dodgeIgnore: cs.dodgeIgnore || 0,
    damageCap: cs.damageCap || 0, execute: cs.execute || 0, controlResist: cs.controlResist || 0,
    will: cs.will || 0, // willpower — Charm/Dominate save (mind+presence)
    healPower: cs.healPower || 0, dmgDefer: cs.dmgDefer || 0,
    armor: cs.armor, armorClass: cs.armorClass || null, ward: cs.ward,
    sonicGuard: Math.max(0, Number(cs.sonicGuard || 0)), dodge: cs.dodge,
    accuracy: cs.accuracy, critChance: cs.critChance, critMult: cs.critMult,
    weapon: cs.weapon, speed: cs.speed, swiftChance: cs.swiftChance || 0, reloadLeft: 0,
    triggers: cs.triggers || {},
    procs: cs.triggers?.procs || [],
    actionsPerTurn: cs.actionsPerTurn || 1,
    actionsLeft: cs.actionsPerTurn || 1,
    cooldownReduction: cs.cooldownReduction || 0,
    controlDuration: cs.controlDuration || 0, ccDurationReduction: cs.ccDurationReduction || 0,
    spellSurge: !!cs.spellSurge, abilityCrit: !!cs.abilityCrit,
    block: 0, shield: 0, magicShield: 0, invuln: 0,
    prof: cs.prof || {},
    attrs: cs.attrs || { ...character.attributes },
    signatureSpellIds: [...entitlements.signatureSpellIds],
    metamagicIds: [...entitlements.metamagicIds],
    metamagicByAbilityId: Object.fromEntries(
      Object.entries(entitlements.metamagicByAbilityId || {}).map(([abilityId, ids]) => [abilityId, [...ids]]),
    ),
    progressionAbilityIds: [...(entitlements.progressionAbilityIds || [])],
    progressionBranchAbilityIds: [...entitlements.selectedBranchAbilityIds],
    martialTempo: 0,
    lastWarriorSequenceTag: null,
    postureStrain: 0,
    postureDecayTurns: 0,
    barbarianFury: 0,
    bardCadence: 0,
    bardLastMotif: null,
    rangerQuarryInsight: 0,
    rangerQuarryUid: null,
    paladinConviction: 0,
    druidSeason: "spring",
    warlockFavor: 0,
    artificerDeviceCharges: 5,
    abilities, cooldowns: {}, statuses: [], side: "player",
  };

  // Allied companions fight at the player's side, AI-driven (engine/combat-ai).
  // They're built by the caller (allyFromCompanion) into the same combatant shape.
  const allies = (opts.allies || []).map((a, i) => ({
    ...clone(a), uid: `a${i}`, side: "player", statuses: a.statuses || [], cooldowns: a.cooldowns || {},
    actionsPerTurn: a.actionsPerTurn || 1, actionsLeft: a.actionsPerTurn || 1,
    martialTempo: clamp(Math.floor(a.martialTempo || 0), 0, 3),
    lastWarriorSequenceTag: a.lastWarriorSequenceTag || null,
    postureStrain: clamp(Math.floor(a.postureStrain || 0), 0, 3),
    postureDecayTurns: clamp(Math.floor(a.postureDecayTurns || 0), 0, 1),
    barbarianFury: 0,
    bardCadence: 0,
    bardLastMotif: null,
    rangerQuarryInsight: 0,
    rangerQuarryUid: null,
    paladinConviction: 0,
    druidSeason: "spring",
    warlockFavor: 0,
    artificerDeviceCharges: 5,
    speed: a.speed ?? 4, swiftChance: a.swiftChance || 0, reloadLeft: 0,
    procs: a.procs || a.triggers?.procs || [], block: 0, shield: 0, magicShield: 0, invuln: 0,
  }));

  // A rider fights with their mount's bulk and speed under them — a charge bonus
  // (engine/riding.js + data/mounts.js mountedBonus). The mount is its OWN allied
  // combatant; this is the lift the rider gets from being astride it.
  if (opts.playerMountedBonus) applyMountedBonus(player, opts.playerMountedBonus);
  for (const a of allies) if (a._mountedBonus) applyMountedBonus(a, a._mountedBonus);

  // Fighting blind: in the dark with no torch lit, your side's aim suffers.
  // Monsters that haunt the dark are not so hampered, so only the player/allies pay.
  if (opts.dark) {
    player.darkPenalty = DARK_ACC_PENALTY;
    for (const a of allies) a.darkPenalty = DARK_ACC_PENALTY;
  }
  // Bone-weary: an exhausted fighter is slower and less sure (heavy, not disabling).
  if (opts.weary) player.accuracy = Math.max(0, (player.accuracy || 0) - 15);
  // Carry the player's standing buffs & debuffs into the fight as real combat
  // statuses (Rallied → +damage, Cursed → no healing + extra damage taken, etc.).
  // Done after armour/ward are set so Guarded/Warded can scale off them.
  seedConditionStatuses(player, character.conditions);

  const foes = clone(enemies);
  foes.forEach((e, i) => {
    e.uid = `e${i}`;
    e.side = "enemy";
    e.actionsPerTurn = e.actionsPerTurn || 1;
    e.actionsLeft = e.actionsPerTurn;
    e.martialTempo = clamp(Math.floor(e.martialTempo || 0), 0, 3);
    e.lastWarriorSequenceTag = e.lastWarriorSequenceTag || null;
    e.postureStrain = clamp(Math.floor(e.postureStrain || 0), 0, 3);
    e.postureDecayTurns = clamp(Math.floor(e.postureDecayTurns || 0), 0, 1);
    e.barbarianFury = 0;
    e.bardCadence = 0;
    e.bardLastMotif = null;
    e.rangerQuarryInsight = 0;
    e.rangerQuarryUid = null;
    e.paladinConviction = 0;
    e.druidSeason = "spring";
    e.warlockFavor = 0;
    e.artificerDeviceCharges = 5;
    e.speed = e.speed ?? 4; e.swiftChance = e.swiftChance || 0; e.reloadLeft = 0;
    // Engagement distance from the player. Most foes open a step out (melee must
    // close; ranged & reach weapons can already strike). An ambush starts closer.
    // Card combat presents one readable field rather than a hidden scalar range
    // minigame. Weapon/range identity remains in card requirements and damage.
    e.distance = 0;
    e.procs = e.procs || e.triggers?.procs || [];
    e.block = e.block || 0; e.shield = e.shield || 0; e.magicShield = e.magicShield || 0; e.invuln = e.invuln || 0;
  });
  // How outmatched are they? Lower the nerve of foes who can see they're outclassed.
  const pThreat = playerThreat(player) + allies.reduce((s, a) => s + enemyThreat(a), 0);
  const eThreatAvg = foes.reduce((s, e) => s + enemyThreat(e), 0) / Math.max(1, foes.length);
  const powerRatio = pThreat / Math.max(1, eThreatAvg);
  if (powerRatio > 1.2) {
    for (const e of foes) {
      const cfg = DEMEANOR_CONFIG[e.demeanor] || DEMEANOR_CONFIG.wary;
      if (e.demeanor === "fanatic" || e.demeanor === "mindless") continue;
      const drop = clamp((powerRatio - 1) * 25, 0, cfg.proud ? 15 : 30);
      e.morale = Math.max(8, e.morale - drop);
    }
  }

  // Lethality. A brawl (lethal:false) is bare-knuckle — both sides stow real
  // weapons and fight with fists; nobody dies (0 HP = knocked out). Drawing a
  // weapon escalates it to a killing matter (see playerDrawWeapon).
  const lethal = opts.lethal !== false;
  if (!lethal) {
    player.stowedWeapon = player.weapon;
    player.weapon = fistsProfile(player.weapon);
    for (const e of foes) {
      e.armed = !!(e.weapon && e.weapon.category && e.weapon.category !== "unarmed");
      e.stowedWeapon = e.weapon;
      e.weapon = fistsProfile(e.weapon);
    }
    for (const a of allies) {
      a.armed = !!(a.weapon && a.weapon.category && a.weapon.category !== "unarmed");
      a.stowedWeapon = a.weapon;
      a.weapon = fistsProfile(a.weapon);
    }
  }

  const flavor = foes.length === 1 ? foes[0].name : `${foes.length} foes`;
  const combatState = {
    player,
    allies,
    enemies: foes,
    target: 0,
    targetUid: foes[0]?.uid || null,
    turn: 1,
    round: 1,
    phase: "player",
    order: [],
    orderIdx: 0,
    powerRatio,
    lethal,
    escalated: false,
    maxLootTier: opts.maxLootTier || null,
    region: opts.region || 1,
    ownedUniques: opts.ownedUniques || [],
    coinBonus: opts.coinBonus || 0,
    dark: !!opts.dark, // fighting blind: accuracy penalty (set on player) + easier flight
    revivedUsed: false,
    profGains: {},
    log: [logEntry(lethal ? `Combat begins — ${flavor}.` : `A brawl breaks out — ${flavor}. Bare hands, for now.`, "system")],
    loot: null,
    seed: normalizeSeed(opts.seed ?? `${character.name || "wanderer"}|${foes.map((e) => e.name).join("|")}`),
  };
  combatState.deck = makeDeck(character, combatState.seed, entitlements);
  if (opts.ambush) applyAmbush(combatState, opts.ambush);
  if (TERMINAL_PHASES.has(combatState.phase)) return combatState;
  const started = startPlayerDeckRound(combatState, { initial: true });
  return started.phase === "enemy" ? advanceDeckUntilPlayer(started) : started;
}

// ----- initiative -----

const allCombatants = (cs) => [cs.player, ...(cs.allies || []), ...cs.enemies];
const byUid = (cs, uid) => allCombatants(cs).find((c) => c.uid === uid);
const canAct = (c) => c && c.health > 0 && !c.resolved && !c._dead;

// ----- distance / reach -----

const MAX_DISTANCE = 6;

// The reach (melee) / range (ranged) of an action: an explicit ability range, a
// medium range for spells and projected performances, else the wielded
// weapon's reach/range.
function abilityReach(actor, def) {
  if (def.range != null) return def.range;
  if (["stat", "performance", "fieldcraft"].includes(abilityScaling(def))) return 3;
  const w = actor.weapon || {};
  return w.range || w.reach || 1;
}

// The gap to bridge for an actor↔target interaction is always the ENEMY's
// distance from the player's line (the player/allies hold the line at 0).
function gap(actor, target) {
  const e = actor.side === "enemy" ? actor : target;
  return e ? (e.distance || 0) : 0;
}

// Take one step to close on a specific foe. A foe steps itself toward the line;
// the player/ally advances on the foe they're engaging.
function closeStep(cs, actor, target) {
  if (actor.side === "enemy") { actor.distance = Math.max(0, (actor.distance || 0) - 1); return; }
  if (target) target.distance = Math.max(0, (target.distance || 0) - 1);
}

function moveCombatantsApart(actor, target, steps) {
  const distance = clamp(Math.floor(steps || 0), 0, 2);
  if (!distance) return;
  const enemy = actor?.side === "enemy" ? actor : target?.side === "enemy" ? target : null;
  if (enemy) enemy.distance = Math.min(MAX_DISTANCE, (enemy.distance || 0) + distance);
}

// Convert spent Posture Strain into explicitly physical consequences. Hard
// interruption/prone effects require an ordinary, fully leverageable body.
// Bosses and resistant bodies keep taking the physical hit but receive only a
// short balance/force penalty and tightly bounded displacement.
function applyMonkControl(cs, attacker, target, def, spent) {
  if (!def?.monkControl || spent <= 0 || !target || target.health <= 0) return;
  const capacity = monkPostureCapacity(attacker, target);
  if (capacity <= 0) {
    cs.log.push(logEntry(`${def.name} finds no usable balance structure in ${target.name}.`, "status"));
    return;
  }
  const bossLike = isBossScale(attacker, target);
  const hardControl = capacity >= 3 && !bossLike && !hasStatus(target, "unstoppable");
  const softValue = capacity >= 3 ? 20 : capacity === 2 ? 14 : 8;
  const balanceCheck = (value = softValue) => addStatus(target, {
    type: "monkBalanceChecked",
    value: clamp(value, 5, 25),
    duration: 1,
  });
  let description = "checks balance";
  switch (def.monkControl) {
    case "joint-check":
      addStatus(target, { type: "weaken", value: clamp(softValue + 5, 10, 30), duration: 2 });
      description = "loads a joint and weakens the answering blows";
      break;
    case "trip": {
      const stopped = hardControl && addStatus(target, { type: "stun", value: 1, duration: 1 });
      if (!stopped) balanceCheck();
      moveCombatantsApart(attacker, target, hardControl ? 1 : 0);
      description = stopped ? "reaps the target off its feet" : "checks a base too solid to reap";
      break;
    }
    case "interrupt": {
      const stopped = hardControl && addStatus(target, { type: "monkActionInterrupted", value: 1, duration: 2 });
      if (!stopped) balanceCheck(softValue + 3);
      if (stopped && target.side === "enemy") onEnemyControlled(target);
      description = stopped ? "physically interrupts the next committed action" : "forces a brief balance correction";
      break;
    }
    case "impact":
      addStatus(target, { type: "shatter", value: clamp(3 + spent, 3, 6), duration: 2 });
      balanceCheck(softValue);
      description = "transfers force through the opened structure";
      break;
    case "throw":
    case "wheel-throw": {
      const wider = def.monkControl === "wheel-throw";
      const steps = hardControl ? (wider ? 2 : 1) : capacity >= 2 ? 1 : 0;
      moveCombatantsApart(attacker, target, steps);
      const stopped = hardControl && addStatus(target, { type: "stun", value: 1, duration: 1 });
      if (!stopped) balanceCheck();
      description = stopped ? `throws the target ${steps} step${steps === 1 ? "" : "s"}` : "turns the target only as far as its mass allows";
      break;
    }
    case "lift": {
      const stopped = hardControl && addStatus(target, { type: "monkActionInterrupted", value: 1, duration: 2 });
      if (!stopped) balanceCheck(softValue + 2);
      if (stopped && target.side === "enemy") onEnemyControlled(target);
      description = stopped ? "lifts the target out of its next action" : "checks the target without launching it";
      break;
    }
    case "shatter":
      addStatus(target, { type: "shatter", value: clamp(5 + spent * 2, 5, 10), duration: 3 });
      description = "compromises a physical guard seam";
      break;
    case "perfect-impact":
      balanceCheck(softValue);
      description = "lands a fully aligned but bounded physical finish";
      break;
  }
  cs.log.push(logEntry(`${attacker.name}'s ${def.name} ${description}.`, "status"));
}

function barbarianControlGrade(attacker, target) {
  if (!target || target.anchored || target.immovable || target.incorporeal) return 0;
  let grade = 2;
  const size = String(target.size || "").toLowerCase();
  if (["huge", "gargantuan", "colossal"].includes(size)) grade = 0;
  else if (size === "large") grade = 1;
  const attackerWeight = Number(attacker?.weight);
  const targetWeight = Number(target.weight);
  if (Number.isFinite(attackerWeight) && attackerWeight > 0 && Number.isFinite(targetWeight) && targetWeight > 0) {
    const ratio = targetWeight / attackerWeight;
    if (ratio >= 3) grade = 0;
    else if (ratio >= 1.75) grade = Math.min(grade, 1);
  }
  if (isBossScale(attacker, target)) grade = Math.min(grade, 1);
  const brace = sumStatus(target, "barbarianGritThrough") + sumStatus(target, "barbarianMountainFrame");
  if (brace >= 3) grade = Math.max(0, grade - 2);
  else if (brace > 0) grade = Math.max(0, grade - 1);
  return clamp(grade, 0, 2);
}

function applyBarbarianControl(cs, attacker, target, def) {
  if (!def?.barbarianControl || !target || target.health <= 0) return;
  const grade = barbarianControlGrade(attacker, target);
  const disrupt = (value) => addStatus(target, {
    type: "barbarianGuardDisrupted",
    value: clamp(value, 3, 10),
    duration: 2,
  });
  let description = "meets an immovable body";
  switch (def.barbarianControl) {
    case "crumple": {
      const value = grade >= 2 ? 9 : grade === 1 ? 5 : 3;
      addStatus(target, { type: "shatter", value, duration: grade >= 2 ? 3 : 2 });
      description = `crumples physical protection by ${value} for a bounded time`;
      break;
    }
    case "push": {
      if (grade >= 2) {
        moveCombatantsApart(attacker, target, 1);
        description = "drives the manageable target back one step";
      } else {
        disrupt(grade === 1 ? 6 : 3);
        description = grade === 1 ? "shakes a great target's guard without moving it" : "breaks against anchoring without displacement";
      }
      break;
    }
    case "collision":
    case "stagger": {
      if (grade >= 2) {
        if (def.barbarianControl === "collision") moveCombatantsApart(attacker, target, 1);
        addStatus(target, { type: "barbarianActionStaggered", value: 1, duration: 2 });
        if (target.side === "enemy") onEnemyControlled(target);
        description = def.barbarianControl === "collision" ? "drives and staggers the manageable body" : "staggers the target's next committed action";
      } else {
        disrupt(grade === 1 ? 7 : 3);
        description = grade === 1 ? "disrupts a great target's guard without launching or stunning it" : "cannot move the anchored mass";
      }
      break;
    }
  }
  cs.log.push(logEntry(`${attacker.name}'s ${def.name} ${description}.`, "status"));
}

// Order every living combatant for the round by speed (initiative), highest
// first. Light armour + fast weapons + Reflex/Wit act sooner; heavy/slow act
// later. A small jitter breaks ties and the player edges ties on their side.
function rollInitiative(cs) {
  const ranked = allCombatants(cs).filter(canAct).map((c) => ({
    uid: c.uid,
    key: (c.speed || 0) - (hasStatus(c, "slow") ? 4 : 0) + (c.side === "player" ? 0.25 : 0) + Math.random(),
  }));
  ranked.sort((x, y) => y.key - x.key);
  cs.order = ranked.map((o) => o.uid);
  cs.orderIdx = 0;
}

function downActor(cs, actor) {
  if (actor === cs.player) return; // player death is handled by playerDown/finishDefeat
  if (actor.side === "enemy") downEnemy(cs, actor); else downAlly(cs, actor);
}

// Begin one combatant's turn: tick statuses/cooldowns/reload, trait resolve regen
// and turn-heal, fire start-of-turn procs, resolve stun, and set action points
// (base + swift "act-again" rolls). Returns "dead" | "stun" | "ok".
function decrementCooldowns(actor) {
  const cdr = 1 + (actor.cooldownReduction || 0);
  for (const id of Object.keys(actor.cooldowns || {})) {
    actor.cooldowns[id] = Math.max(0, actor.cooldowns[id] - cdr);
  }
}

function beginTurnFor(cs, actor, { deckMode = false } = {}) {
  // Block is tactical protection for one round: it covers the opposing phase,
  // then falls away when this combatant begins acting again. Persistent item
  // shields remain separate pools and are not cleared here.
  actor.block = 0;
  // Observe turn-cancelling statuses before the normal start-of-turn expiry.
  // This makes duration:1 mean "skip the next turn" while leaving every other
  // status on the existing tick cadence.
  const stunnedAtTurnStart = hasStatus(actor, "stun");
  const charmedAtTurnStart = hasStatus(actor, "charmed");
  const controlledAtTurnStart = actor === cs.player && isPlayerControlled(cs);
  const controlKindAtTurnStart = hasStatus(actor, "enthralled") || hasStatus(actor, "dominated") ? "enthralled" : "charmed";
  tickStatuses(actor).forEach((l) => cs.log.push(l));
  if (actor.health <= 0) {
    if (actor === cs.player) { if (playerDown(cs)) return "dead"; }
    else { downActor(cs, actor); return "dead"; }
  }
  decrementCooldowns(actor);
  if (actor.reloadLeft > 0) actor.reloadLeft = Math.max(0, actor.reloadLeft - 1);
  startOfTurn(cs, actor);
  // Resolve is a rest/consumable-gated pool (engine/attributes.js) — no base regen.
  // The ONLY per-turn trickle is from the rare will-traits Clear Mind / Archmage /
  // high Presence (triggers.resolveRegen); plus EARNED refund procs in fireProc.
  const tr = actor.triggers || {};
  const rr = tr.resolveRegen || 0;
  if (rr && actor.resolveMax != null) {
    const prevResolve = actor.resolve || 0;
    actor.resolve = Math.min(actor.resolveMax, prevResolve + rr);
    const gained = actor.resolve - prevResolve;
    if (gained > 0) cs.log.push(logEntry(`${actor.name} recovers ${gained} resolve.`, "status"));
  }
  if (tr.turnRegen && actor.health > 0) {
    // turnRegen is a FRACTION of max health (scales with the wearer at every tier).
    const mended = gainHealth(actor, Math.max(1, Math.round(actor.maxHealth * tr.turnRegen)));
    if (mended > 0) cs.log.push(logEntry(`${actor.name} mends ${mended}.`, "status"));
  }
  if (stunnedAtTurnStart) {
    cs.log.push(logEntry(`${actor.name} is stunned and cannot act.`, "status"));
    return "stun";
  }
  if (controlledAtTurnStart) {
    cs.log.push(logEntry(
      controlKindAtTurnStart === "enthralled"
        ? "Your body is not your own — you stand frozen, enthralled."
        : "A strange calm stays your hand — you cannot raise a weapon.",
      "status",
    ));
    return "controlled";
  }
  if (actor !== cs.player && charmedAtTurnStart) {
    cs.log.push(logEntry(`${actor.name} stands down, held by the charm.`, "status"));
    return "charmed";
  }
  // Action points: base + swift "act-again" rolls (each less likely, capped).
  // Slow denies the act-again rolls entirely (and docks initiative, above).
  let extra = 0, chance = deckMode || hasStatus(actor, "slow") ? 0 : (actor.swiftChance || 0);
  while (chance > 0 && extra < 3 && Math.random() < chance) { extra += 1; chance *= 0.5; }
  if (extra > 0 && actor === cs.player) cs.log.push(logEntry(`You move with uncanny speed — an extra action.`, "status"));
  actor.actionsLeft = (actor.actionsPerTurn || 1) + extra;
  return "ok";
}

// Walk the initiative order, resolving NPC turns, until it's the player's turn
// (hand control to the UI with phase "player") or combat ends. Recomputes the
// order at the top of each new round.
// A grinding stalemate: once a fight drags past CEASEFIRE_TURN and a thinking foe
// is still standing, it offers a truce. The offer then stays on the table — the
// player can keep swinging, or break it off as a draw (playerCeasefire).
function maybeOfferCeasefire(cs) {
  if (cs.ceasefire || cs.turn < CEASEFIRE_TURN) return;
  const talker = livingEnemies(cs).find((e) => !e.fleeing && e.canTalk !== false && DEMEANOR_CONFIG[e.demeanor]?.canParley);
  if (!talker) return;
  cs.ceasefire = true;
  cs.log.push(logEntry(`${talker.name}, blooded and weary, gives ground and calls for a truce — neither side can best the other here. You may stand down to a wary draw, or fight on.`, "enemy"));
}

function advanceQueue(cs) {
  for (let guard = 0; guard < 2000; guard++) {
    routCheck(cs); // a foe whose side just lost may break before anyone else acts
    if (combatOver(cs)) return checkCombatEnd(cs);
    if (!cs.order || cs.orderIdx >= cs.order.length) {
      cs.turn += 1;
      rollInitiative(cs);
      cs.log.push(logEntry(`— Turn ${cs.turn} —`, "system"));
      maybeOfferCeasefire(cs);
      continue;
    }
    const actor = byUid(cs, cs.order[cs.orderIdx]);
    if (!actor || !canAct(actor)) { cs.orderIdx += 1; continue; }

    if (actor === cs.player) {
      const r = beginTurnFor(cs, actor);
      if (r === "dead") return finishDefeat(cs);
      if (r === "stun") { cs.orderIdx += 1; continue; }
      if (r === "controlled") { cs.orderIdx += 1; continue; }
      cs.phase = "player";
      return cs; // hand control to the UI
    }

    // NPC turn (ally or enemy)
    const r = beginTurnFor(cs, actor);
    cs.orderIdx += 1;
    if (r === "dead") { if (playerDown(cs)) return finishDefeat(cs); continue; }
    if (r === "stun" || r === "charmed") continue;
    // A fleeing foe spends its turn putting ground between it and the field; once
    // it's far enough it's gone. It doesn't fight — the player must run it down.
    if (actor.side === "enemy" && actor.fleeing) { fleeStep(cs, actor); continue; }
    if (actor.side === "enemy" && !moraleCheck(cs, actor)) continue;
    // An enthralled creature has already switched sides, so it fights for its
    // new side below. Brief charm was consumed by beginTurnFor above.
    while ((actor.actionsLeft || 0) > 0) {
      // Companions hit only foes still fighting — never a fleeing or yielded foe
      // (running one down or finishing a captive is the player's call alone).
      const opponents = actor.side === "player" ? liveAttackers(cs) : playerSide(cs);
      if (opponents.length === 0) break;
      if (actor.side !== "player" && cs.player.health <= 0) break;
      if (!npcPerform(cs, actor, opponents)) break;
      if (playerDown(cs)) return finishDefeat(cs);
    }
    if (combatOver(cs)) return checkCombatEnd(cs);
    if (playerDown(cs)) return finishDefeat(cs);
  }
  return cs;
}

function fistsProfile(w) {
  return {
    min: Math.max(1, Math.round((w?.min || 2) * 0.5)),
    max: Math.max(2, Math.round((w?.max || 4) * 0.5)),
    type: "physical", pen: 0, category: "unarmed", name: "Fists",
  };
}

// Escalate a brawl to a lethal fight — you and any armed foes switch to real
// weapons, deaths become possible, and the aftermath gets far worse.
function escalateToLethal(cs, reason) {
  if (cs.lethal) return;
  cs.lethal = true;
  cs.escalated = true;
  if (cs.player.stowedWeapon) cs.player.weapon = cs.player.stowedWeapon;
  for (const e of cs.enemies) {
    if (e.health > 0 && !e.resolved && e.armed && e.stowedWeapon) e.weapon = e.stowedWeapon;
  }
  for (const a of cs.allies || []) {
    if (a.health > 0 && !a.resolved && a.armed && a.stowedWeapon) a.weapon = a.stowedWeapon;
  }
  cs.log.push(logEntry(
    reason === "magic"
      ? "You work a spell — the room recoils; this is no brawl now."
      : reason === "sonic"
        ? "The performance turns into harmful force — this is no harmless brawl now."
      : "Steel is drawn — the brawl turns to a killing matter.", "system"));
}

// Draw steel mid-brawl — escalates to a lethal fight (you and any armed foes
// switch to real weapons; the aftermath gets far worse).
export function playerDrawWeapon(cs0) {
  if (cs0.phase !== "player" || cs0.lethal || isPlayerTurnLocked(cs0)) return cs0;
  if (!cs0.player.stowedWeapon || cs0.player.stowedWeapon.category === "unarmed") return cs0;
  const cs = clone(cs0);
  escalateToLethal(cs, "weapon");
  return cs;
}

function addProf(cs, id, xp) {
  const adaptable = Math.max(0, cs.player?.triggers?.adaptable || 0);
  cs.profGains[id] = (cs.profGains[id] || 0) + xp * (1 + adaptable);
}
const alertness = (d) => ({ feral: 4, honorable: 3, wary: 3, fierce: 2, fanatic: 2, brutish: 1, cowardly: 0, mindless: 0 }[d] ?? 1);

// A surprise strike is CONTESTED, not free — so you can't just ambush everyone.
// Player ambush: your stealth (Reflex + ½Wit + Ambush proficiency) vs the foes'
// awareness (their accuracy + demeanor alertness, harder per extra foe). Win →
// they reel and lose their first turn. Enemy ambush: contested by your Wit + ½
// Reflex + Awareness proficiency; lose the read and they get a free opening
// blow. Either way you train the relevant proficiency.
function applyAmbush(cs, side) {
  const a = cs.player.attrs || {};
  const reflex = mechanicalAttributeValue(a.reflex);
  const wit = mechanicalAttributeValue(a.wit);
  const living = livingEnemies(cs);
  if (side === "player") {
    const stealth = reflex + Math.floor(wit / 2) + (cs.player.prof?.ambush || 0);
    const awareness = Math.max(...living.map((e) => (e.accuracy || 0) + alertness(e.demeanor)), 0);
    const chance = clamp(40 + (stealth - awareness) * 6 - (living.length - 1) * 12, 5, 95);
    addProf(cs, "ambush", XP.AMBUSH_TRY);
    if (rand100() <= chance) {
      for (const e of cs.enemies) addStatus(e, { type: "stun", value: 1, duration: 1 });
      cs.log.push(logEntry("You strike first — they reel, caught unaware.", "system"));
      addProf(cs, "ambush", XP.AMBUSH_WIN);
    } else {
      cs.log.push(logEntry("They were readier than you thought — no opening blow.", "system"));
    }
  } else if (side === "enemy") {
    const enemyStealth = Math.max(...living.map((e) => (e.speed || 4) + tierInfo(e.tier).order), 0);
    const perception = wit + Math.floor(reflex / 2) + (cs.player.prof?.awareness || 0);
    addProf(cs, "awareness", XP.AWARENESS);
    const chance = clamp(50 + (enemyStealth - perception) * 6, 5, 95);
    if (rand100() > chance) {
      cs.log.push(logEntry("You sense it coming and meet them ready.", "system"));
      return;
    }
    cs.log.push(logEntry("Ambush — they strike before you're ready!", "enemy"));
    for (const e of cs.enemies) {
      if (e.health <= 0) continue;
      const profile = attackProfile(e, BASIC_ATTACK, e.tier, false);
      if (profile) cs.log.push(resolveHit(e, cs.player, profile).log);
      if (cs.player.health <= 0) break;
    }
    if (cs.player.health <= 0) finishDefeat(cs);
  }
}

// ----- damage resolution -----

// Build the damage profile. Weapon-scaling techniques are built from the
// attacker's weapon (+ a stat modifier that grows with the ability's tier);
// stat-scaling spells are built from the attribute × tier, with a staff/wand
// adding only a small bonus. Performance-scaled sonic techniques use Presence
// and training without inheriting spell focus, metamagic, or spell surge.
function attackProfile(attacker, def, tierId, isPlayer) {
  // Polymorph seals equipment, techniques, and spellcasting behind a harmless
  // lesser form. The creature can still nip or kick, but rank and gear cannot
  // turn that fallback into a disguised full-strength attack.
  if (hasStatus(attacker, "polymorph")) {
    return { min: 1, max: 2, type: "physical", pen: 0, critBonus: 0 };
  }
  const scaling = abilityScaling(def);
  const order = tierInfo(tierId).order;
  // Spell Surge is a casting threshold, never a hidden multiplier for trained
  // weapon craft, Bard performance, or racial anatomy.
  const surge = attacker.spellSurge && abilityCategoryOf(def) === "spell" ? 1.5 : 1;
  const unseen = hasStatus(attacker, "greaterInvisibility") ? 1.25 : 1;
  const seasonal = druidSeasonDamageMultiplier(attacker, def);

  if (scaling === "weapon" || def.damageType === "weapon") {
    const w = attacker.weapon || { min: 1, max: 2, type: "physical", pen: 0 };
    const techMult = 1 + order * 0.15;
    const govAttr = mechanicalAttributeValue(attacker.attrs?.[def.scaleAttr] ?? attacker.attrs?.body ?? 0);
    const statMod = Math.round(govAttr * (0.5 + order * 0.25));
    const type = def.damageType && def.damageType !== "weapon" ? def.damageType : w.type;
    const authoredMult = Math.max(0.25, Math.min(2, def.damageMult || 1));
    const tempoMult = def.warriorFinisher
      ? 1 + clamp(attacker._warriorTempoSpent || 0, 0, 3) * 0.2
      : 1;
    return {
      min: Math.max(1, Math.round((w.min * techMult + statMod) * surge * unseen * authoredMult * tempoMult * seasonal)),
      max: Math.max(1, Math.round((w.max * techMult + statMod) * surge * unseen * authoredMult * tempoMult * seasonal)),
      type,
      pen: (w.pen || 0) + (def.pen || 0),
      critBonus: def.critBonus || 0,
      accuracyBonus: def.accuracyBonus || 0,
    };
  }

  if (scaling === "stat") {
    if (!def.dmg) return null;
    const m = tierMult(tierId);
    const f = def.scaleAttr && attacker.attrs ? attrFactor(attacker.attrs[def.scaleAttr]) : 1;
    const castBonus = isPlayer ? 1 + (attacker.prof?.spellcasting || 0) * 0.05 : 1; // Spellcasting proficiency
    let signatureMult = 1;
    if (hasAbilityMetamagic(attacker, def, "empowered-signature")) signatureMult *= 1.35;
    if (hasAbilityMetamagic(attacker, def, "perfected-signature")) signatureMult *= 1.15;
    // Shaped and twinned castings exchange per-target force for reach. They are
    // still a net gain when they connect with multiple targets.
    if (hasAbilityMetamagic(attacker, def, "shaped-signature")) signatureMult *= 0.75;
    if (isTwinnedSignature(attacker, def)) signatureMult *= 0.75;
    let focus = 0;
    if (attacker.weapon?.category === "arcane") {
      focus = Math.round((attacker.weapon.max || 0) * 0.3);
    }
    const transmuted = hasAbilityMetamagic(attacker, def, "transmuted-signature") && def.damageType === "magical";
    return {
      min: Math.max(1, Math.round(def.dmg[0] * m * f * castBonus * surge * signatureMult * unseen * seasonal) + focus),
      max: Math.max(1, Math.round(def.dmg[1] * m * f * castBonus * surge * signatureMult * unseen * seasonal) + focus),
      type: transmuted ? "physical" : def.damageType,
      pen: (def.pen || 0) + (hasAbilityMetamagic(attacker, def, "piercing-signature") ? 8 : 0),
      critBonus: def.critBonus || 0,
    };
  }
  if (scaling === "performance") {
    if (!def.dmg) return null;
    const m = tierMult(tierId);
    const f = def.scaleAttr && attacker.attrs ? attrFactor(attacker.attrs[def.scaleAttr]) : 1;
    const trained = isPlayer ? 1 + (attacker.prof?.performance || 0) * 0.05 : 1;
    return {
      min: Math.max(1, Math.round(def.dmg[0] * m * f * trained * seasonal)),
      max: Math.max(1, Math.round(def.dmg[1] * m * f * trained * seasonal)),
      type: "sonic",
      pen: def.pen || 0,
      critBonus: def.critBonus || 0,
      accuracyBonus: def.accuracyBonus || 0,
    };
  }
  if (scaling === "fieldcraft") {
    if (!def.dmg) return null;
    const m = tierMult(tierId);
    const f = def.scaleAttr && attacker.attrs ? attrFactor(attacker.attrs[def.scaleAttr]) : 1;
    const trained = isPlayer ? 1 + clamp(attacker.prof?.awareness || 0, 0, 15) * 0.03 : 1;
    return {
      min: Math.max(1, Math.round(def.dmg[0] * m * f * trained * seasonal)),
      max: Math.max(1, Math.round(def.dmg[1] * m * f * trained * seasonal)),
      type: def.damageType || "physical",
      pen: def.pen || 0,
      critBonus: def.critBonus || 0,
      accuracyBonus: def.accuracyBonus || 0,
    };
  }
  return null; // no direct damage
}

// Soft requirement multiplier: stat shortfall scales damage down (floor 20%).
// Weapon-type mismatch is no longer a penalty — it hard-blocks use (see
// weaponReqMet/abilityUsable), so anything that reaches here has its weapon.
function abilityEffectiveness(player, def, tierId) {
  const base = reqEffectiveness(player.attrs || {}, abilityRequiredStat(def, tierId));
  // Adaptable turns partial familiarity into usable practice: it erases half of
  // its magnitude from the remaining shortfall (0.5 trait => 25% less penalty),
  // while never replacing the attributes needed for full mastery.
  const recovery = Math.min(0.5, Math.max(0, player.triggers?.adaptable || 0) * 0.5);
  return Math.min(1, base + (1 - base) * recovery);
}

// Resolve a single hit. Returns { log, dmg, crit, dodged } so callers can fire
// procs (on-crit / on-hit / on-dodge / on-kill) off the outcome.
function resolveHit(attacker, defender, profile) {
  // Greater Invisibility is not ordinary dodge: accuracy cannot fully solve a
  // target the attacker cannot locate. It therefore rolls before accuracy, like
  // Phantom, while remaining bounded below certainty.
  const invisibilityChance = clamp(sumStatus(defender, "greaterInvisibility"), 0, 90) / 100;
  if (invisibilityChance > 0 && Math.random() <= invisibilityChance) {
    return { log: logEntry(`${attacker.name} attacks ${defender.name} — the greater veil leaves nothing to strike.`, "miss"), dmg: 0, crit: false, dodged: true };
  }
  // Phantom: a flat, UNCOUNTERABLE chance the blow passes through the half-real
  // defender — rolled independently of accuracy, so no foe accuracy can negate it.
  if ((defender.phaseChance || 0) > 0 && rand100() <= defender.phaseChance * 100) {
    return { log: logEntry(`${attacker.name} attacks ${defender.name} — the blow passes through (half-real).`, "miss"), dmg: 0, crit: false, dodged: true };
  }
  // Chill saps the attacker's accuracy; dodge-stacks add to the defender's dodge.
  // Deadeye (dodgeIgnore) erases the defender's dodge so the strike can't be evaded.
  const acc = (attacker.accuracy || 0) + (profile.accuracyBonus || 0)
    + (hasStatus(attacker, "greaterInvisibility") ? 25 : 0) + sumStatus(attacker, "barbarianWarCry")
    + clamp(sumStatus(attacker, "warlockOpenCovenant"), 0, 15)
    + clamp(sumStatus(attacker, "artificerMasterworkArray") + sumStatus(attacker, "artificerOverclockServo"), 0, 25)
    + clamp(sumStatus(attacker, "bardSteadyBeat") + sumStatus(attacker, "bardRisingTempo")
      + sumStatus(attacker, "bardCallResponse") + sumStatus(attacker, "bardWarDrum")
      + sumStatus(attacker, "bardLoreCallout") + sumStatus(attacker, "bardMarchingCadence")
      + sumStatus(attacker, "bardBattleChronicle"), 0, 45)
    - sumStatus(attacker, "chill") - sumStatus(attacker, "barbarianGuardDisrupted")
    - sumStatus(attacker, "levelDrain") - sumStatus(attacker, "monkBalanceChecked")
    - clamp(sumStatus(attacker, "bardCuttingVerse") + sumStatus(attacker, "bardDissonance")
      + sumStatus(attacker, "bardSyncopation") + sumStatus(attacker, "bardCounterMelody")
      + sumStatus(attacker, "bardGrandFinale") + sumStatus(attacker, "bardPointedSatire")
      + sumStatus(attacker, "bardHecklersHook") + sumStatus(attacker, "bardChorusScorn")
      + sumStatus(attacker, "bardHarmonicWeave"), 0, 60)
    - clamp(sumStatus(attacker, "rangerCoveringShot") + sumStatus(attacker, "rangerCompanionSignal")
      + sumStatus(attacker, "rangerPackCommand") + sumStatus(attacker, "rangerFalconStoop")
      + sumStatus(attacker, "rangerKillZone"), 0, 45)
    - clamp(sumStatus(attacker, "rogueFalseOpening") + sumStatus(attacker, "rogueSapBlow")
      + sumStatus(attacker, "rogueKidneyShot") + sumStatus(attacker, "rogueBrazenFeint")
      + sumStatus(attacker, "rogueConfidencePlay") + sumStatus(attacker, "rogueDirtyTrick")
      + sumStatus(attacker, "rogueVenomWork"), 0, 45)
    - clamp(sumStatus(attacker, "paladinMercifulArrest") + sumStatus(attacker, "paladinPeaceCommand"), 0, 30)
    - clamp(sumStatus(attacker, "druidSirocco") + sumStatus(attacker, "druidSunwheel")
      + sumStatus(attacker, "druidGreatYear"), 0, 45)
    - clamp(sumStatus(attacker, "warlockFavorsRebuke") + sumStatus(attacker, "warlockPactApotheosis")
      + sumStatus(attacker, "warlockPactChain") + sumStatus(attacker, "warlockBindingLinks")
      + sumStatus(attacker, "warlockWitchMark") + sumStatus(attacker, "warlockLayeredHex")
      + sumStatus(attacker, "warlockWhisperedTerms") + sumStatus(attacker, "warlockSecretLeverage")
      + sumStatus(attacker, "warlockOpenBargain"), 0, 45)
    - clamp(sumStatus(attacker, "artificerFlashPhial"), 0, 20)
    - (attacker.darkPenalty || 0);
  const warriorFootwork = sumStatus(defender, "warriorPassingStep") + sumStatus(defender, "warriorTurningParry");
  const monkFootwork = sumStatus(defender, "monkYieldingGuard") + sumStatus(defender, "monkCrossingStep")
    + sumStatus(defender, "monkBurstStep") + sumStatus(defender, "monkReboundStep");
  const bardFootwork = clamp(sumStatus(defender, "bardRisingTempo") + sumStatus(defender, "bardMarchingCadence"), 0, 30);
  const rangerFootwork = clamp(sumStatus(defender, "rangerEvadingStep") + sumStatus(defender, "rangerSafePassage")
    + sumStatus(defender, "rangerPathfinderStep") + sumStatus(defender, "rangerRunningShot"), 0, 35);
  const rangerTerrainPenalty = clamp(sumStatus(defender, "rangerTrailCut") + sumStatus(defender, "rangerCripplingShot")
    + sumStatus(defender, "rangerSetSnare") + sumStatus(defender, "rangerLayeredSnare"), 0, 35);
  const rogueFootwork = clamp(sumStatus(defender, "rogueSlipLine") + sumStatus(defender, "rogueCrowdGhost"), 0, 35);
  const rogueSourceUid = combatantActionKey(attacker);
  const ownedRoguePressure = (...types) => (defender.statuses || [])
    .filter((status) => status.sourceUid === rogueSourceUid && types.includes(status.type))
    .reduce((total, status) => total + (status.value || 0), 0);
  const rogueDodgePressure = clamp(ownedRoguePressure(
    "rogueAssessMark", "rogueExploitGuard", "rogueHamstring", "rogueKillingMeasure",
    "rogueFaultFinder", "rogueMasterKey", "roguePlannedCollapse",
  ), 0, 35);
  const ownedPaladinPressure = (...types) => (defender.statuses || [])
    .filter((status) => status.sourceUid === rogueSourceUid && types.includes(status.type))
    .reduce((total, status) => total + (status.value || 0), 0);
  const paladinDodgePressure = clamp(ownedPaladinPressure(
    "paladinJudgmentStroke", "paladinCallToAccount", "paladinThresholdBlow", "paladinVerdictEdge",
  ), 0, 30);
  const ownedWarlockPressure = (...types) => (defender.statuses || [])
    .filter((status) => status.sourceUid === rogueSourceUid && types.includes(status.type))
    .reduce((total, status) => total + (status.value || 0), 0);
  const warlockDodgePressure = clamp(ownedWarlockPressure(
    "warlockDebtMark", "warlockCovenantLash", "warlockCreditorsGaze", "warlockClaimDue",
    "warlockWitchMark", "warlockLayeredHex", "warlockSympatheticToken",
    "warlockPactChain", "warlockBindingLinks", "warlockDevilsDue",
  ), 0, 30);
  const druidRootPressure = clamp(
    sumStatus(defender, "druidVerdantSpark") + sumStatus(defender, "druidFrostroot")
      + sumStatus(defender, "druidGroveAwakening") + sumStatus(defender, "druidEntanglingThicket")
      + sumStatus(defender, "druidGaleShear"),
    0,
    40,
  );
  const druidFormDodge = clamp(sumStatusField(
    defender,
    ["druidPredatorShape", "druidWolfAspect", "druidBearAspect"],
    "reflexBonus",
  ), 0, 24);
  const artificerServoDodge = clamp(sumStatusField(defender, ["artificerOverclockServo"], "dodgeBonus"), 0, 12);
  const dodge = Math.max(0, (defender.dodge || 0) + sumStatus(defender, "dodgeStack") + warriorFootwork
    + monkFootwork + bardFootwork + rangerFootwork + rogueFootwork + druidFormDodge + artificerServoDodge
    - rangerTerrainPenalty - rogueDodgePressure - paladinDodgePressure - druidRootPressure - warlockDodgePressure)
    * (1 - (attacker.dodgeIgnore || 0));
  const hitChance = 100 - clamp(dodge - acc, 0, 90);
  if (rand100() > hitChance) {
    return { log: logEntry(`${attacker.name} attacks ${defender.name} — dodged.`, "miss"), dmg: 0, crit: false, dodged: true };
  }
  let raw = randInt(profile.min, profile.max);
  if (profile.eff != null) raw *= profile.eff;
  raw *= 1 + sumStatus(attacker, "rally") / 100
    + sumStatus(attacker, "barbarianAbandon") / 100
    + clamp(sumStatus(attacker, "bardWarDrum"), 0, 18) / 100
    - (sumStatus(attacker, "weaken") + sumStatus(attacker, "levelDrain")
      + clamp(sumStatus(attacker, "bardStingingRefrain") + sumStatus(attacker, "bardCounterMelody")
        + sumStatus(attacker, "bardPointedSatire") + sumStatus(attacker, "bardChorusScorn"), 0, 45)
      + clamp(sumStatus(attacker, "druidGreatYear"), 0, 20)) / 100;
  if (profile.type === "physical") {
    const formForce = clamp(Math.max(
      sumStatusField(attacker, ["druidPredatorShape", "druidWolfAspect", "druidBearAspect"], "bodyBonus"),
      sumStatusField(attacker, ["druidPredatorShape", "druidWolfAspect", "druidBearAspect"], "reflexBonus"),
    ), 0, 24);
    raw *= 1 + formForce / 100;
    raw *= 1 + clamp(sumStatusField(attacker, ["artificerRunicEdge"], "physicalDamageBonus"), 0, 15) / 100;
  }

  const challenge = (attacker.statuses || []).find((status) =>
    ["barbarianChallenged", "barbarianFoeCalled"].includes(status.type));
  if (challenge && defender.uid !== challenge.sourceUid) {
    raw *= 1 - clamp(challenge.value || 0, 0, 25) / 100;
  }
  const witnessedChallenge = (attacker.statuses || []).find((status) =>
    status.type === "paladinWitnessChallenge");
  if (witnessedChallenge && defender.uid !== witnessedChallenge.sourceUid) {
    raw *= 1 - clamp(witnessedChallenge.value || 0, 0, 20) / 100;
  }
  if (profile.type === "physical") raw *= 1 + clamp(sumStatus(defender, "barbarianExposedGuard"), 0, 30) / 100;

  const bardTimingCrit = clamp(Math.round((sumStatus(attacker, "bardCallResponse") + sumStatus(attacker, "bardBattleChronicle")) / 2), 0, 18);
  const druidFormCrit = clamp(sumStatusField(attacker, ["druidPredatorShape", "druidWolfAspect", "druidBearAspect"], "critBonus"), 0, 12);
  const critChance = (attacker.critChance || 0) + (profile.critBonus || 0) + sumStatus(attacker, "focus") + bardTimingCrit + druidFormCrit;
  const crit = rand100() <= critChance;
  if (crit) raw *= attacker.critMult || 1.5;
  if (hasStatus(attacker, "focus")) attacker.statuses = attacker.statuses.filter((s) => s.type !== "focus");

  // Vulnerable and Curse both amplify incoming damage.
  raw *= 1 + (sumStatus(defender, "vulnerable") + sumStatus(defender, "curse")
    + clamp(sumStatus(defender, "rangerKillZone"), 0, 15)
    + clamp(ownedRoguePressure("rogueFinishingAngle", "rogueHighWindow", "rogueFirstStrike"), 0, 15)
    + clamp(sumStatus(defender, "warlockPactExposure"), 0, 25)) / 100;
  raw = Math.max(0, Math.round(raw));

  let mitig = 0;
  // Shatter (sundered armour) eats into physical mitigation while it lasts.
  if (profile.type === "physical") mitig = Math.max(0, (defender.armor || 0) + sumStatus(defender, "guard") - sumStatus(defender, "shatter") - sumStatus(defender, "barbarianGuardDisrupted") - (profile.pen || 0));
  else if (profile.type === "magical") mitig = Math.max(0, (defender.ward || 0)
    + sumStatus(defender, "druidRimebark") + sumStatus(defender, "druidIronbarkRise")
    + sumStatus(defender, "warlockOwedWard") + sumStatus(defender, "warlockBlackBargain")
    - clamp(ownedWarlockPressure("warlockRuinousTerms"), 0, 20) - (profile.pen || 0));
  else if (profile.type === "sonic") {
    const baseAcousticGuard = Math.max(0, Number(defender.sonicGuard || 0) + Math.round((defender.armor || 0) * 0.25));
    const fracture = clamp(sumStatus(defender, "bardSonicFracture") + sumStatus(defender, "bardHarmonicWeave"), 0, 50) / 100;
    const acousticMitigation = Math.max(0, Math.round(baseAcousticGuard) - (profile.pen || 0));
    mitig = defender.sonicImmune
      ? raw
      : Math.round(Math.min(Math.max(0, Math.round(raw * 0.85)), acousticMitigation) * (1 - fracture));
  }
  // Flat % damage-reduction (Stoneskin / Godward), plus Bastion fortify while
  // badly wounded. Capped so it can never fully negate a blow.
  let dmg = Math.max(0, raw - mitig);
  let dr = defender.dr || 0;
  if (defender.fortify && defender.maxHealth && defender.health / defender.maxHealth < 0.35) dr += defender.fortify;
  if (dr) dmg = Math.max(0, Math.round(dmg * (1 - Math.min(0.85, dr))));
  let antimagicAbsorbed = 0;
  if (profile.type === "magical" && hasStatus(defender, "antimagicField") && dmg > 0) {
    const beforeAntimagic = dmg;
    const reduction = clamp(sumStatus(defender, "antimagicField"), 0, 90) / 100;
    dmg = Math.max(0, Math.round(dmg * (1 - reduction)));
    antimagicAbsorbed = beforeAntimagic - dmg;
  }
  // Per-hit cap (damageCap): no single blow may exceed a share of max health.
  // Same rule for every creature — the cap is earned, from a Stonewall affix or a
  // high-vigor threshold. Nothing is boss-specific; Senna and a great-wyrm obey
  // the identical line.
  if (defender.damageCap && defender.maxHealth) dmg = Math.min(dmg, Math.max(1, Math.round(defender.maxHealth * defender.damageCap)));

  // Invulnerability turns the blow aside entirely. Tactical Block absorbs any
  // direct hit next, then persistent typed shields catch what remains.
  let invulnerable = false, blockAbsorbed = 0, shieldAbsorbed = 0;
  if ((defender.invuln || 0) > 0) { invulnerable = true; dmg = 0; }
  else if (dmg > 0) {
    if ((defender.block || 0) > 0) {
      blockAbsorbed = Math.min(defender.block, dmg);
      defender.block -= blockAbsorbed;
      dmg -= blockAbsorbed;
    }
    if (profile.type === "magical" && (defender.magicShield || 0) > 0) {
      shieldAbsorbed = Math.min(defender.magicShield, dmg); defender.magicShield -= shieldAbsorbed; dmg -= shieldAbsorbed;
    } else if (profile.type !== "magical" && (defender.shield || 0) > 0) {
      shieldAbsorbed = Math.min(defender.shield, dmg); defender.shield -= shieldAbsorbed; dmg -= shieldAbsorbed;
    }
  }
  // Damage deferral (dmgDefer): a share of the blow that WOULD land is held back
  // and bled out over a few turns as a "lingering" wound instead of all at once —
  // anti-burst, so sustain can answer it. Not applied to the lingering tick itself.
  let deferred = 0;
  if (dmg > 0 && (defender.dmgDefer || 0) > 0) {
    deferred = Math.round(dmg * Math.min(0.7, defender.dmgDefer));
    if (deferred > 0) {
      dmg -= deferred;
      addStatus(defender, { type: "lingering", value: Math.max(1, Math.ceil(deferred / DEFER_TURNS)), duration: DEFER_TURNS });
    }
  }
  const nextHealth = defender.health - dmg;
  defender.health = (nextHealth <= 0 && lastStandHolds(defender)) ? 1 : Math.max(0, nextHealth);

  const typeTag = profile.type === "true" ? " true" : profile.type === "magical" ? " magical" : profile.type === "sonic" ? " sonic" : "";
  const critTag = crit ? " CRIT" : "";
  const absorption = [
    blockAbsorbed > 0 ? `${blockAbsorbed} Block` : "",
    shieldAbsorbed > 0 ? `${shieldAbsorbed} ${profile.type === "magical" ? "magic shield" : "shield"}` : "",
    antimagicAbsorbed > 0 ? `${antimagicAbsorbed} antimagic` : "",
  ].filter(Boolean).join(" + ");
  const tail = invulnerable
    ? " — turned aside (invulnerable)."
    : absorption && dmg === 0
      ? ` — ${absorption} absorb it.`
      : absorption
        ? ` — ${absorption} absorbed.`
        : dmg === 0 ? " — absorbed." : ".";
  return { log: logEntry(`${attacker.name} hits ${defender.name} for ${dmg}${typeTag}${critTag}${tail}`, crit ? "crit" : "hit"), dmg, crit, dodged: false };
}

function removeStatusType(actor, type) {
  let removed = false;
  actor.statuses = (actor.statuses || []).filter((status) => {
    if (!removed && status.type === type) { removed = true; return false; }
    return true;
  });
  return removed;
}

function warriorCounterHit(cs, defender, attacker, multiplier, label) {
  if (!defender?.weapon || !attacker || attacker.health <= 0) return 0;
  const profile = attackProfile(defender, BASIC_ATTACK, defender.tier || "common", defender.side === "player");
  if (!profile) return 0;
  const bounded = clamp(multiplier || 0.5, 0.25, 0.75);
  const counterProfile = {
    ...profile,
    type: "physical",
    min: Math.max(1, Math.round(profile.min * bounded)),
    max: Math.max(1, Math.round(profile.max * bounded)),
    critBonus: 0,
  };
  cs.log.push(logEntry(`${defender.name} answers with ${label}.`, defender.side === "player" ? "player" : "enemy"));
  const before = attacker.health;
  const result = resolveHit(defender, attacker, counterProfile);
  cs.log.push(result.log);
  if (attacker.health <= 0 && attacker !== cs.player) {
    if (attacker.side === "enemy") downEnemy(cs, attacker);
    else downAlly(cs, attacker);
  }
  return Math.max(0, before - attacker.health);
}

// The shared per-hit resolution used by BOTH the player and NPCs (the unified
// combat path). Pushes the hit log, applies lifesteal/thorns, fires the
// attacker's on-hit/on-crit/on-kill procs and the defender's on-dodge procs, and
// applies any ability-borne status. Returns { dealt, crit }.
function dealHit(cs, attacker, target, profile, def, tier) {
  const before = target.health;
  const nativeWarrior = isNativeWarriorTechnique(def);
  const nativeMonk = isNativeMonkTechnique(def);
  const nativeBarbarian = isNativeBarbarianTechnique(def);
  const nativeRanger = isNativeRangerFieldcraft(def);
  const nativeRogue = isNativeRogueSubterfuge(def);
  const nativePaladin = isNativePaladinOathcraft(def);
  const nativeDruid = isNativeDruidPrimalcraft(def);
  const nativeWarlock = isNativeWarlockPactcraft(def);
  const nativeArtificer = isNativeArtificerDevicecraft(def);
  const recentDamage = nativeBarbarian
    ? (attacker.statuses || []).find((status) => status.type === "barbarianRecentDamage")
    : null;
  let barbarianProfile = profile;
  if (nativeBarbarian && recentDamage && def.barbarianRecentFuryBonus) {
    const mult = 1 + clamp(def.barbarianRecentFuryBonus, 0.1, 0.35);
    barbarianProfile = {
      ...barbarianProfile,
      min: Math.max(1, Math.round(barbarianProfile.min * mult)),
      max: Math.max(1, Math.round(barbarianProfile.max * mult)),
    };
  }
  if (nativeBarbarian && recentDamage && def.barbarianPainConversion) {
    const converted = Math.min(
      Math.max(1, Math.round((recentDamage.value || 0) * clamp(def.barbarianPainConversion, 0.25, 0.6))),
      Math.max(1, Math.round(barbarianProfile.max * 0.5)),
    );
    barbarianProfile = {
      ...barbarianProfile,
      min: barbarianProfile.min + converted,
      max: barbarianProfile.max + converted,
    };
  }
  if (nativeBarbarian && def.barbarianWoundedBonus && target.health / Math.max(1, target.maxHealth || 1) <= 0.5) {
    const mult = 1 + clamp(def.barbarianWoundedBonus, 0.1, 0.3);
    barbarianProfile = {
      ...barbarianProfile,
      min: Math.max(1, Math.round(barbarianProfile.min * mult)),
      max: Math.max(1, Math.round(barbarianProfile.max * mult)),
    };
  }
  if (recentDamage && (def.barbarianRecentFuryBonus || def.barbarianPainConversion)) {
    attacker.statuses = (attacker.statuses || []).filter((status) => status !== recentDamage);
  }
  const postureSpent = nativeMonk ? spendMonkPosture(cs, attacker, target, def) : 0;
  const postureDamageMult = postureSpent > 0 && def.monkPostureDamagePerPoint
    ? 1 + postureSpent * clamp(def.monkPostureDamagePerPoint, 0.05, 0.2)
    : 1;
  const monkProfile = postureDamageMult > 1
    ? {
        ...barbarianProfile,
        min: Math.max(1, Math.round(barbarianProfile.min * postureDamageMult)),
        max: Math.max(1, Math.round(barbarianProfile.max * postureDamageMult)),
      }
    : barbarianProfile;
  const read = nativeWarrior
    ? (target.statuses || []).find((status) => status.type === "warriorReadOpponent" && status.sourceUid === attacker.uid)
    : null;
  const weaponChange = nativeWarrior
    ? (attacker.statuses || []).find((status) => status.type === "warriorWeaponChange")
    : null;
  let warriorProfile = monkProfile;
  if (read) {
    warriorProfile = {
      ...warriorProfile,
      accuracyBonus: (warriorProfile.accuracyBonus || 0) + clamp(read.value || 0, 0, 40),
      pen: (warriorProfile.pen || 0) + clamp(read.pen || 0, 0, 8),
      critBonus: (warriorProfile.critBonus || 0) + clamp(read.crit || 0, 0, 20),
    };
    target.statuses = (target.statuses || []).filter((status) => status !== read);
    cs.log.push(logEntry(`${attacker.name}'s reading of ${target.name} sharpens the committed technique.`, "status"));
  }
  if (weaponChange) {
    warriorProfile = { ...warriorProfile, accuracyBonus: (warriorProfile.accuracyBonus || 0) + clamp(weaponChange.value || 0, 0, 30) };
    attacker.statuses = (attacker.statuses || []).filter((status) => status !== weaponChange);
  }
  let rangerProfile = warriorProfile;
  if (nativeRanger && combatantActionKey(target) === attacker.rangerQuarryUid) {
    const owned = (target.statuses || []).filter((status) => status.sourceUid === attacker.uid);
    const ownedValue = (...types) => owned.filter((status) => types.includes(status.type))
      .reduce((total, status) => total + (status.value || 0), 0);
    const accuracyRead = clamp(ownedValue("rangerQuarrySign", "rangerPatientAim", "rangerReadMonster", "rangerKillZone"), 0, 35);
    const penetrationRead = clamp(Math.round(ownedValue("rangerReadMonster", "rangerLayeredSnare", "rangerKillZone") / 5), 0, 8);
    const patientCrit = clamp(Math.round(ownedValue("rangerPatientAim", "rangerDeadeyeBreath") / 2), 0, 20);
    const relentless = clamp(sumStatus(attacker, "rangerRelentlessTrail"), 0, 20);
    rangerProfile = {
      ...rangerProfile,
      accuracyBonus: (rangerProfile.accuracyBonus || 0) + accuracyRead + relentless,
      pen: (rangerProfile.pen || 0) + penetrationRead,
      critBonus: (rangerProfile.critBonus || 0) + patientCrit,
    };
  }
  const rogueProfile = nativeRogue && rogueExploitCommitted(attacker, target, def)
    ? {
        ...rangerProfile,
        accuracyBonus: (rangerProfile.accuracyBonus || 0) + 12,
        pen: (rangerProfile.pen || 0) + clamp(def.rogueOpeningPen || 1, 0, 4),
      }
    : rangerProfile;
  const accounted = nativePaladin && def.id === "paladin-verdict-edge"
    ? (target.statuses || []).find((status) => status.type === "paladinCallToAccount"
      && status.sourceUid === combatantActionKey(attacker))
    : null;
  const paladinProfile = accounted
    ? {
        ...rogueProfile,
        accuracyBonus: (rogueProfile.accuracyBonus || 0) + clamp(accounted.value || 0, 5, 20),
        pen: (rogueProfile.pen || 0) + 2,
      }
    : rogueProfile;
  const druidDecayAction = nativeDruid && [
    "druidLeafrot", "druidDecayMark", "druidMolderingWave", "druidReturnToSoil",
  ].includes(def.effect?.type);
  const druidDecayOpening = druidDecayAction
    ? (target.statuses || []).filter((status) => status.sourceUid === combatantActionKey(attacker)
      && ["druidDecayMark", "druidReturnToSoil"].includes(status.type))
      .reduce((total, status) => total + (status.value || 0), 0)
    : 0;
  const druidProfile = druidDecayOpening > 0
    ? {
        ...paladinProfile,
        min: Math.max(1, Math.round(paladinProfile.min * (1 + clamp(druidDecayOpening, 0, 35) / 100))),
        max: Math.max(1, Math.round(paladinProfile.max * (1 + clamp(druidDecayOpening, 0, 35) / 100))),
      }
    : paladinProfile;
  const warlockOwnedCondition = nativeWarlock && (
    (def.warlockRequiresOwnDebtMark && warlockOwnStatus(attacker, target, "warlockDebtMark"))
    || (def.warlockRequiresOwnHellfireCovenant && warlockOwnStatus(attacker, target, "warlockHellfireCovenant"))
  );
  const authoredPactBonus = Number(def.effect?.debtBonus ?? def.effect?.contractPressure ?? 0);
  const pactBonus = warlockOwnedCondition ? clamp(authoredPactBonus, 0, 20) / 100 : 0;
  const warlockProfile = pactBonus > 0
    ? {
        ...druidProfile,
        min: Math.max(1, Math.round(druidProfile.min * (1 + pactBonus))),
        max: Math.max(1, Math.round(druidProfile.max * (1 + pactBonus))),
      }
    : druidProfile;
  const artificerNode = nativeArtificer
    ? (target.statuses || []).find((status) => status.type === "artificerArcNode"
      && status.sourceUid === combatantActionKey(attacker))
    : null;
  const artificerNodeBonus = artificerNode ? clamp(artificerNode.deviceDamageBonus || artificerNode.value || 0, 0, 15) / 100 : 0;
  const artificerProfile = artificerNodeBonus > 0
    ? {
        ...warlockProfile,
        min: Math.max(1, Math.round(warlockProfile.min * (1 + artificerNodeBonus))),
        max: Math.max(1, Math.round(warlockProfile.max * (1 + artificerNodeBonus))),
      }
    : warlockProfile;
  const physicalWeaponAttack = artificerProfile.type === "physical" && abilityScaling(def) === "weapon";
  const rangedWeapon = !!(attacker.weapon?.range || ["bow", "crossbow"].includes(attacker.weapon?.category));
  const physicalMeleeAttack = physicalWeaponAttack && !rangedWeapon;
  const monkParry = physicalMeleeAttack
    ? (target.statuses || []).find((status) => status.type === "monkOpenHandParry")
    : null;
  const monkAbsorb = physicalWeaponAttack
    ? (target.statuses || []).find((status) => status.type === "monkAbsorbingFrame")
    : null;
  const veteranReversal = physicalWeaponAttack && hasStatus(target, "warriorVeteranReversal");
  const resolvedWarriorProfile = veteranReversal
    ? {
        ...artificerProfile,
        min: Math.max(1, Math.round(artificerProfile.min * 0.6)),
        max: Math.max(1, Math.round(artificerProfile.max * 0.6)),
      }
    : artificerProfile;
  const monkReactionReduction = Math.max(
    clamp((monkParry?.value || 0) / 100, 0, 0.4),
    clamp((monkAbsorb?.value || 0) / 100, 0, 0.5),
  );
  const resolvedMonkProfile = monkReactionReduction > 0
    ? {
        ...resolvedWarriorProfile,
        min: Math.max(1, Math.round(resolvedWarriorProfile.min * (1 - monkReactionReduction))),
        max: Math.max(1, Math.round(resolvedWarriorProfile.max * (1 - monkReactionReduction))),
      }
    : resolvedWarriorProfile;
  const canopy = rangedWeapon
    ? (target.statuses || []).reduce((best, status) => status.type === "druidLivingCanopy"
      && (!best || (status.value || 0) > (best.value || 0)) ? status : best, null)
    : null;
  const canopyRate = canopy ? clamp((canopy.value || 0) / 100, 0.1, 0.3) : 0;
  const canopyCap = canopy ? Math.max(1, Math.round((target.maxHealth || 1) * clamp(canopy.cap || 0.10, 0.05, 0.12))) : 0;
  const canopyProfile = canopy
    ? {
        ...resolvedMonkProfile,
        min: Math.max(1, resolvedMonkProfile.min - Math.min(canopyCap, Math.round(resolvedMonkProfile.min * canopyRate))),
        max: Math.max(1, resolvedMonkProfile.max - Math.min(canopyCap, Math.round(resolvedMonkProfile.max * canopyRate))),
      }
    : resolvedMonkProfile;
  const automaton = (target.statuses || []).reduce((best, status) => status.type === "artificerInterceptionAutomaton"
    && (!best || (status.share || 0) > (best.share || 0)) ? status : best, null);
  const barricade = rangedWeapon
    ? (target.statuses || []).reduce((best, status) => status.type === "artificerDeployableBarricade"
      && (!best || (status.projectileReduction || 0) > (best.projectileReduction || 0)) ? status : best, null)
    : null;
  const deviceReduction = Math.max(
    clamp(Number(automaton?.share || 0), 0, 0.20),
    clamp(Number(barricade?.projectileReduction || 0), 0, 0.15),
  );
  const deviceCap = automaton
    ? Math.max(1, Math.round((target.maxHealth || 1) * clamp(Number(automaton.cap || 0.08), 0.03, 0.08)))
    : barricade ? Math.max(1, Math.round((target.maxHealth || 1) * clamp(Number(barricade.cap || 0.08), 0.03, 0.08))) : 0;
  const protectedProfile = deviceReduction > 0
    ? {
        ...canopyProfile,
        min: Math.max(1, canopyProfile.min - Math.min(deviceCap, Math.round(canopyProfile.min * deviceReduction))),
        max: Math.max(1, canopyProfile.max - Math.min(deviceCap, Math.round(canopyProfile.max * deviceReduction))),
      }
    : canopyProfile;
  const fearReduced = target.triggers?.dragonHeart && def && FEAR_ABILITY_IDS.has(def.id);
  const resolvedProfile = fearReduced
    ? { ...protectedProfile, min: Math.max(1, Math.round(protectedProfile.min * 0.75)), max: Math.max(1, Math.round(protectedProfile.max * 0.75)) }
    : protectedProfile;
  const blockBefore = target.block || 0;
  const res = resolveHit(attacker, target, resolvedProfile);
  cs.log.push(res.log);
  let dealt = before - target.health;
  if (dealt > 0 && target.health > 0 && nativePaladin && def.paladinRadiantRider && isProfaneEntity(target)) {
    const rider = typeof def.paladinRadiantRider === "object"
      ? def.paladinRadiantRider
      : { value: def.paladinRadiantRider };
    const authored = Number(rider.value ?? rider.ratio ?? 0.25);
    const rawRadiance = authored <= 1 ? Math.max(1, Math.round(dealt * clamp(authored, 0.1, 0.5))) : Math.max(1, Math.round(authored));
    const capped = Math.min(rawRadiance, Math.max(1, Math.round((target.maxHealth || target.health || 1)
      * clamp(Number(rider.cap ?? 0.08), 0.03, 0.08))));
    const radiant = Math.max(0, capped - Math.max(0, target.ward || 0));
    if (radiant > 0) {
      target.health = Math.max(0, target.health - radiant);
      cs.log.push(logEntry(`${attacker.name}'s witnessed oath adds ${radiant} ward-respecting radiance against ${target.name}'s profane nature.`, "hit"));
      dealt = before - target.health;
    } else {
      cs.log.push(logEntry(`${target.name}'s ward turns aside the bounded oath-radiance.`, "status"));
    }
  }
  if (dealt > 0) {
    redirectThroughPaladinOathguard(cs, attacker, target, dealt);
    dealt = before - target.health;
  }
  if (dealt > 0) {
    redistributeWarlockSharedBurden(cs, attacker, target, dealt);
    dealt = before - target.health;
  }
  if (nativePaladin && (def.nonlethal || def.effect?.nonlethal) && target.health <= 0) {
    target.health = 1;
    dealt = Math.max(0, before - target.health);
    cs.log.push(logEntry(`${attacker.name} arrests the final force of ${def.name}; ${target.name} remains alive.`, "status"));
  }
  const targetIsPlayer = target === cs.player;
  if (targetIsPlayer) addProf(cs, "evasion", XP.EVASION); // exercising evasion (even on a dodge)
  gainBarbarianFuryFromDamage(cs, attacker, target, dealt);

  const resolveMonkReaction = ({ contact = true } = {}) => {
    if (!monkParry && !(contact && monkAbsorb)) return;
    if (monkParry) removeStatusType(target, "monkOpenHandParry");
    if (contact && monkAbsorb) removeStatusType(target, "monkAbsorbingFrame");
    gainMonkPosture(cs, target, attacker, 1);
    cs.log.push(logEntry(`${target.name} receives the physical line through trained ${monkParry ? "open-hand redirection" : "body structure"}.`, "status"));
  };

  if (res.dodged) {
    // A parry can turn an otherwise-missed line into deliberate contact.
    // Absorbing Frame, by contrast, must actually receive a landed blow.
    resolveMonkReaction({ contact: false });
    if (physicalWeaponAttack && removeStatusType(target, "warriorTurningParry")) {
      gainWarriorTempo(cs, target, { defensive: true });
      if (attacker.side === "enemy") attacker.distance = Math.min(MAX_DISTANCE, (attacker.distance || 0) + 1);
      addStatus(target, { type: "focus", value: 20, duration: 1 });
      cs.log.push(logEntry(`${target.name} turns the weapon line aside and takes the safer angle.`, "status"));
    }
    fireProcs(cs, target, "onDodge", {});
    return { dealt: 0, crit: false };
  }

  if (physicalWeaponAttack && blockBefore > (target.block || 0) && removeStatusType(target, "warriorGuard")) {
    gainWarriorTempo(cs, target, { defensive: true });
    cs.log.push(logEntry(`${target.name}'s guarded recovery catches part of the answering weapon line.`, "status"));
  }
  if (physicalWeaponAttack && blockBefore > (target.block || 0) && removeStatusType(target, "warriorRiposteGuard")) {
    gainWarriorTempo(cs, target, { defensive: true });
    warriorCounterHit(cs, target, attacker, 0.5, "a bounded riposte");
  }
  if (veteranReversal && removeStatusType(target, "warriorVeteranReversal")) {
    gainWarriorTempo(cs, target, { defensive: true });
    warriorCounterHit(cs, target, attacker, 0.65, "a veteran reversal");
  }
  if (resolvedProfile.type === "physical" && blockBefore > (target.block || 0) && hasStatus(target, "paladinStandFast")) {
    gainPaladinConviction(cs, target, attacker, 1);
  }

  resolveMonkReaction();

  if (dealt > 0 && nativeWarrior && def.warriorSequenceTag && !def.warriorFinisher) {
    gainWarriorTempo(cs, attacker, { sequenceTag: def.warriorSequenceTag });
  }
  if (dealt > 0 && target.health > 0 && nativeRanger && def.rangerQuarryInsightBuild) {
    gainRangerQuarryInsight(cs, attacker, target, def);
  }
  if (dealt > 0 && target.health > 0 && nativeRogue && def.rogueOpeningBuild) {
    gainRogueOpening(cs, attacker, target, def);
  }
  if (dealt > 0 && nativeRanger && def.selfEffect) applySelfEffect(attacker, def.selfEffect, cs, attacker);
  if (dealt > 0 && nativeRanger && def.effect?.target === "self") applySelfEffect(attacker, def.effect, cs, attacker);
  if (dealt > 0 && nativeWarrior && def.selfEffect) applySelfEffect(attacker, def.selfEffect, cs, attacker);
  if (!res.dodged && target.health > 0 && nativeMonk && def.monkPostureBuild) {
    gainMonkPosture(cs, attacker, target, def.monkPostureBuild);
  }
  if (!res.dodged && target.health > 0 && nativeMonk && postureSpent >= (def.monkPostureCost || 0)) {
    applyMonkControl(cs, attacker, target, def, postureSpent);
  }
  if (dealt > 0 && nativeMonk && def.selfEffect) applySelfEffect(attacker, def.selfEffect, cs, attacker);
  if (dealt > 0 && target.health > 0 && nativeBarbarian && def.barbarianControl) {
    applyBarbarianControl(cs, attacker, target, def);
  }
  if (dealt > 0 && nativeBarbarian && def.selfEffect) applySelfEffect(attacker, def.selfEffect, cs, attacker);
  if (dealt > 0 && nativeRogue && def.selfEffect) applySelfEffect(attacker, def.selfEffect, cs, attacker);

  // Execute (Body 30): any landed hit on a foe already below the threshold
  // (pre-damage HP) is an instant kill. The threshold is checked against
  // `before` — the foe must already be in execute range when the swing lands,
  // not arrive there because of it.
  if (dealt > 0 && (attacker.execute || 0) > 0 && target.health > 0
      && before <= Math.round((target.maxHealth || 0) * attacker.execute)) {
    target.health = 0;
    cs.log.push(logEntry(`${attacker.name} executes ${target.name}.`, attacker.side === "player" ? "crit" : "enemy"));
  }

  if (dealt > 0) {
    // Silver prevents lycanthropic flesh from sealing. Refresh one bounded wound
    // marker rather than stacking copies; regeneration resumes after three turns
    // without another silvered strike.
    const silveredStrike = target.race === "lycanthrope"
      && target.triggers?.racialRegeneration
      && (attacker.weapon?.silvered || /\bsilver(?:ed)?\b/i.test(attacker.weapon?.name || ""))
      && (abilityScaling(def) === "weapon" || def?.damageType === "weapon");
    if (silveredStrike) {
      target.statuses = (target.statuses || []).filter((status) => status.type !== "silverWound");
      addStatus(target, { type: "silverWound", duration: 3 });
      cs.log.push(logEntry(`${target.name}'s wound refuses to close around the silver.`, "status"));
    }
    const ls = attacker.triggers?.lifesteal || 0;
    if (ls > 0 && attacker.health > 0) {
      const heal = gainHealth(attacker, Math.max(1, Math.round(dealt * ls / 100)));
      if (heal > 0) cs.log.push(logEntry(`${attacker.name} ${attacker.side === "player" ? "drains" : "leeches"} ${heal} health.`, "status"));
    }
    // Ability-borne life-drain (effect.type "drain"): the cast itself heals the
    // caster for a share of the damage it deals — distinct from the affix lifesteal
    // above, and the reason a drain spell is worth a slot at high tier.
    const drainPct = def?.effect?.type === "drain" ? (def.effect.value || 0) : 0;
    if (drainPct > 0 && attacker.health > 0) {
      const healed = gainHealth(attacker, Math.max(1, Math.round(dealt * drainPct / 100)));
      if (healed > 0) cs.log.push(logEntry(`${attacker.name} drains ${healed} life.`, "status"));
    }
    if (target.side === "enemy") onEnemyDamaged(target, dealt);
    if (targetIsPlayer) {
      addProf(cs, "endurance", XP.ENDURANCE);
      const thorns = cs.player.triggers?.thorns || 0;
      if (thorns > 0 && attacker.health > 0) {
        const ref = Math.max(1, Math.round(dealt * thorns / 100));
        attacker.health = Math.max(0, attacker.health - ref);
        cs.log.push(logEntry(`${attacker.name} takes ${ref} from thornmail.`, "status"));
      }
    }
    fireProcs(cs, attacker, "onHit", { target, dealt, crit: res.crit });
    if (res.crit) fireProcs(cs, attacker, "onCrit", { target, dealt, crit: true });

    // Abjuration's reflection can return only a bounded share of magical damage
    // that actually landed. It never reflects true/physical damage and cannot
    // recursively trigger another reflection.
    if (resolvedProfile.type === "magical" && hasStatus(target, "spellReflection") && attacker.health > 0) {
      const reflectedPct = clamp(sumStatus(target, "spellReflection"), 0, 60);
      const reflected = Math.min(attacker.health, Math.max(1, Math.round(dealt * reflectedPct / 100)));
      attacker.health = Math.max(0, attacker.health - reflected);
      cs.log.push(logEntry(`${target.name}'s ward reflects ${reflected} magical damage into ${attacker.name}.`, "status"));
    }
  }

  if (target.health > 0 && def && def.effect && def.effect.target === "enemy") {
    applyEnemyEffect(cs, attacker, target, def.effect, tier, def);
  }

  if (target.health <= 0 && !targetIsPlayer) fireProcs(cs, attacker, "onKill", { target });
  return { dealt, crit: res.crit };
}

function offensiveAbility(def) {
  return !!def && (def.target === "enemy" || def.target === "all-enemies" || !!def.dmg || def.damageType === "weapon");
}

function consumeSacredMisdirection(cs, actor, def) {
  if (!hasStatus(actor, "misdirected") || !offensiveAbility(def)) return false;
  actor.statuses = (actor.statuses || []).filter((status) => status.type !== "misdirected");
  actor.actionsLeft = Math.max(0, (actor.actionsLeft || 1) - (def?.actionCost || 1));
  cs.log.push(logEntry(`${actor.name}'s hostile action follows the false opening and finds nothing.`, "status"));
  return true;
}

function consumeWarriorWeaponBind(cs, actor, def) {
  if (!hasStatus(actor, "warriorWeaponBound") || abilityScaling(def) !== "weapon" || !offensiveAbility(def)) return false;
  removeStatusType(actor, "warriorWeaponBound");
  actor.actionsLeft = Math.max(0, (actor.actionsLeft || 1) - (def?.actionCost || 1));
  cs.log.push(logEntry(`${actor.name}'s weapon action is lost in the existing bind.`, "status"));
  return true;
}

function consumeMonkActionInterruption(cs, actor, def) {
  if (!hasStatus(actor, "monkActionInterrupted") || !offensiveAbility(def)) return false;
  removeStatusType(actor, "monkActionInterrupted");
  actor.actionsLeft = Math.max(0, (actor.actionsLeft || 1) - effectiveActionCost(actor, def));
  cs.log.push(logEntry(`${actor.name}'s committed action collapses under the earlier physical posture break.`, "status"));
  return true;
}

function consumeBarbarianActionStagger(cs, actor, def) {
  if (!hasStatus(actor, "barbarianActionStaggered") || !offensiveAbility(def)) return false;
  removeStatusType(actor, "barbarianActionStaggered");
  actor.actionsLeft = Math.max(0, (actor.actionsLeft || 1) - effectiveActionCost(actor, def));
  cs.log.push(logEntry(`${actor.name}'s committed action is lost while recovering from the physical collision.`, "status"));
  return true;
}

function warriorDenyApproach(cs, attacker, defender, def) {
  if (!defender || !hasStatus(defender, "warriorDenyApproach") || abilityScaling(def) !== "weapon") return false;
  const weapon = attacker.weapon || {};
  if (weapon.range || ["bow", "crossbow"].includes(weapon.category)) return false;
  if (gap(attacker, defender) <= abilityReach(attacker, def)) return false;
  const status = (defender.statuses || []).find((entry) => entry.type === "warriorDenyApproach");
  removeStatusType(defender, "warriorDenyApproach");
  attacker.actionsLeft = Math.max(0, (attacker.actionsLeft || 1) - (def?.actionCost || 1));
  if (attacker.side === "enemy") attacker.distance = Math.min(MAX_DISTANCE, (attacker.distance || 0) + 1);
  gainWarriorTempo(cs, defender, { defensive: true });
  warriorCounterHit(cs, defender, attacker, clamp((status?.value || 40) / 100, 0.25, 0.6), "a reach-keeping stop");
  cs.log.push(logEntry(`${defender.name} denies the melee approach before the attack can develop.`, "status"));
  return true;
}

function warriorAdvanceIsChecked(cs, actor, def, distanceGap, reach) {
  if (distanceGap <= reach || !hasStatus(actor, "warriorAdvanceChecked") || abilityScaling(def) !== "weapon") return false;
  removeStatusType(actor, "warriorAdvanceChecked");
  actor.actionsLeft = Math.max(0, (actor.actionsLeft || 1) - (def?.actionCost || 1));
  cs.log.push(logEntry(`${actor.name}'s attempted approach stops at the waiting point.`, "status"));
  return true;
}

// A geas does not puppet its subject. It leaves the choice to disobey intact,
// then exacts a bounded price each time the subject takes hostile action. The
// backlash cannot deal the final point of health, so it remains coercion rather
// than a passive execution effect.
function applyGeasBacklash(cs, actor, def) {
  if (!hasStatus(actor, "geas") || !offensiveAbility(def) || actor.health <= 0) return 0;
  const pct = clamp(sumStatus(actor, "geas"), 2, 10) / 100;
  const before = actor.health;
  actor.health = Math.max(1, actor.health - Math.max(1, Math.round((actor.maxHealth || actor.health) * pct)));
  const suffered = before - actor.health;
  if (actor.resolve != null) actor.resolve = Math.max(0, actor.resolve - 2);
  cs.log.push(logEntry(`${actor.name}'s geas punishes the disobedient attack for ${suffered} vitality and 2 Resolve.`, "status"));
  return suffered;
}

// Proc firing condition (beyond hook + chance). targetLow: only badly-wounded
// foes; targetDot: only foes already bleeding/poisoned/burning (Ravage synergy).
function condMet(cond, ctx) {
  if (!cond) return true;
  const t = ctx.target;
  if (cond === "targetLow") return !!(t && t.health > 0 && t.maxHealth && t.health / t.maxHealth < 0.3);
  if (cond === "targetDot") return !!(t && (hasStatus(t, "bleed") || hasStatus(t, "poison") || hasStatus(t, "burn")));
  return true;
}

// Data-driven synergy procs. Iterates the actor's affix procs; on a matching
// hook (and chance roll + condition) applies the effect. Symmetric: the player
// and NPCs carry procs the same way (combatant.procs).
function fireProcs(cs, actor, hook, ctx = {}) {
  const procs = actor.procs || actor.triggers?.procs;
  if (!procs || !procs.length) return;
  for (const p of procs) {
    if (p.hook !== hook) continue;
    if (p.cond && !condMet(p.cond, ctx)) continue;
    if (p.chance != null && p.chance < 1 && rand100() > p.chance * 100) continue;
    applyProc(cs, actor, p, ctx);
  }
}

function applyProc(cs, actor, p, ctx) {
  const target = ctx.target;
  switch (p.kind) {
    case "status": {
      if (!target || target.health <= 0) return;
      if (p.cond === "targetLow" && target.health / target.maxHealth >= 0.3) return;
      addStatus(target, { type: p.status, value: p.value, duration: p.duration, pctMax: p.pctMax });
      if (CONTROL_TYPES.has(p.status) && target.side === "enemy") onEnemyControlled(target);
      cs.log.push(logEntry(`${actor.name}'s ${p.name} afflicts ${target.name} with ${p.status}.`, "status"));
      break;
    }
    case "buff": {
      addStatus(actor, { type: p.status, value: p.value, duration: p.duration });
      break;
    }
    case "execute": {
      if (!target || target.health <= 0) return;
      if (target.health / target.maxHealth >= 0.3) return; // only finishes the badly wounded
      target.health = Math.max(0, target.health - p.value);
      cs.log.push(logEntry(`${actor.name}'s ${p.name} tears into ${target.name} for ${p.value}.`, "hit"));
      break; // onKill is fired by dealHit's post-hit check (avoids a double-trigger)
    }
    case "bonusHit": {
      if (!target || target.health <= 0) return;
      target.health = Math.max(0, target.health - p.value);
      cs.log.push(logEntry(`${actor.name}'s ${p.name} lands a bonus strike for ${p.value}.`, "hit"));
      break; // onKill is fired by dealHit's post-hit check (avoids a double-trigger)
    }
    case "refund": {
      if (p.action) actor.actionsLeft = (actor.actionsLeft || 0) + 1;
      if (p.resolve && actor.resolveMax != null) actor.resolve = Math.min(actor.resolveMax, (actor.resolve || 0) + (p.value || 0));
      // pctMax heals scale with the wearer's pool (Feast on-kill, etc.).
      if (p.heal && actor.health > 0) gainHealth(actor, p.pctMax ? Math.round(actor.maxHealth * (p.value || 0)) : (p.value || 0));
      cs.log.push(logEntry(`${actor.name}'s ${p.name} surges with fresh vigour.`, "status"));
      break;
    }
    case "shield": {
      const amt = p.pctMax ? Math.round(actor.maxHealth * (p.value || 0)) : (p.value || 0);
      actor.shield = (actor.shield || 0) + amt;
      cs.log.push(logEntry(`${actor.name}'s ${p.name} throws up a shield (${amt}).`, "status"));
      break;
    }
  }
}

// Start-of-turn proc tick (turn-ramp buffs, low-health panic procs, and the
// divine invuln cadence). Called once per combatant per round.
function startOfTurn(cs, actor) {
  const procs = actor.procs || actor.triggers?.procs || [];
  for (const p of procs) {
    if (p.hook === "turnRamp") {
      if (p.chance != null && p.chance < 1 && rand100() > p.chance * 100) continue;
      addStatus(actor, { type: p.status, value: p.value, duration: p.duration });
    } else if (p.hook === "lowHealth") {
      if (actor.health > 0 && actor.maxHealth && actor.health / actor.maxHealth < (p.threshold || 0.35)) {
        actor._lowFired = actor._lowFired || {};
        if (!actor._lowFired[p.name]) { actor._lowFired[p.name] = true; applyProc(cs, actor, p, {}); }
      }
    }
  }
  // Aegis Eternal (divine): brief invulnerability when near death, limited charges.
  const invG = actor.triggers?.invulnCharges || 0;
  if (invG > 0 && actor.health > 0 && actor.maxHealth && actor.health / actor.maxHealth < 0.35) {
    actor._invulnUsed = actor._invulnUsed || 0;
    if (actor._invulnUsed < invG && (actor.invuln || 0) <= 0) {
      actor._invulnUsed += 1; actor.invuln = 1;
      cs.log.push(logEntry(`${actor.name} flares with untouchable light.`, "status"));
    }
  }
}

// ----- morale -----

function bardMoraleResistance(combatant) {
  return clamp(
    sumStatus(combatant, "bardHearteningChorus") + sumStatus(combatant, "bardDefiantAnthem") + sumStatus(combatant, "bardOldBallad"),
    0,
    50,
  ) / 100;
}

function onEnemyDamaged(e, dmg) {
  if (e.demeanor === "fanatic" || e.demeanor === "mindless") return;
  const cfg = DEMEANOR_CONFIG[e.demeanor] || DEMEANOR_CONFIG.wary;
  let loss = (dmg / Math.max(1, e.maxHealth)) * 55;
  if (e.health / e.maxHealth <= 0.25) loss += 10;
  if (cfg.proud) loss *= 0.6;
  loss *= 1 - bardMoraleResistance(e);
  e.morale = Math.max(0, e.morale - loss);
}
function onEnemyControlled(e) {
  if (e.demeanor === "fanatic" || e.demeanor === "mindless") return;
  const cfg = DEMEANOR_CONFIG[e.demeanor] || DEMEANOR_CONFIG.wary;
  e.controlPressure = (e.controlPressure || 0) + 1;
  let loss = cfg.proud ? 3 : 6;
  if (e.demeanor === "cowardly") loss = 9;
  loss *= 1 - bardMoraleResistance(e);
  e.morale = Math.max(0, e.morale - loss);
}
// Undying scrubs lingering harm on revive so the cheated-death moment isn't wasted
// re-dying to leftover damage-over-time.
const HARMFUL_STATUS = new Set(["bleed", "poison", "burn", "chill", "curse", "vulnerable", "weaken", "stun", "silence", "slow", "shatter", "geas", "polymorph", "levelDrain", "warlockPactExposure", ...BARD_PRESSURE_STATUS, ...RANGER_PRESSURE_STATUS, ...ROGUE_PRESSURE_STATUS, ...PALADIN_PRESSURE_STATUS, ...DRUID_ENEMY_STATUS, ...WARLOCK_ENEMY_STATUS, ...ARTIFICER_ENEMY_STATUS]);
function cleanseHarm(c) {
  if (Array.isArray(c.statuses)) c.statuses = c.statuses.filter((s) => !HARMFUL_STATUS.has(s.type));
}

function collectDruidHarvest(cs, fallen) {
  if (!cs || !fallen || fallen._druidHarvestCollected) return;
  const marks = (fallen.statuses || []).filter((status) => status.type === "druidHarvestTide" && status.sourceUid);
  for (const mark of marks) {
    const druid = byUid(cs, mark.sourceUid);
    if (!druid || druid.side === fallen.side || druid.health <= 0 || !isDruidCombatant(druid)) continue;
    const cap = clamp(Math.round(mark.resolveCap || 6), 1, 8);
    const already = clamp(Math.round(druid._druidHarvestResolve || 0), 0, cap);
    const available = Math.max(0, cap - already);
    const room = Number.isFinite(Number(druid.resolveMax))
      ? Math.max(0, druid.resolveMax - (druid.resolve || 0))
      : available;
    const restored = Math.min(available, room, clamp(Math.round(mark.value || 3), 1, 4));
    if (restored <= 0) continue;
    druid.resolve = (druid.resolve || 0) + restored;
    druid._druidHarvestResolve = already + restored;
    cs.log.push(logEntry(`${druid.name} reclaims ${restored} Resolve from ${fallen.name}'s released natural energy.`, "status"));
  }
  fallen._druidHarvestCollected = true;
}

// A foe drops to 0. In a lethal fight that means death (lootable corpse); in a
// bare-knuckle brawl it means knocked senseless (alive — nothing to loot).
function downEnemy(cs, e) {
  if (e._dead || e.resolved === "ko") return;
  // Last Stand: a foe with the Presence-30 trigger can't be dropped below 1 HP
  // for 3 turns (held off by any damage path), once per fight.
  if (e.health <= 0 && lastStandHolds(e)) { e.health = 1; return; }
  // Undying (divine): a fabled foe cheats death once, clawing back at a share of
  // health, cleansed and briefly untouchable so the second life isn't instantly lost.
  const rev = e.triggers?.reviveOnce;
  if (rev && !e._revived && e.health <= 0) {
    e._revived = true;
    e.health = Math.max(1, Math.round(e.maxHealth * rev));
    cleanseHarm(e); e.invuln = Math.max(e.invuln || 0, 1);
    cs.log.push(logEntry(`${e.name} should be dead — and rises anyway.`, "enemy"));
    return;
  }
  collectDruidHarvest(cs, e);
  // Cutting down a foe that had thrown down its arms is an execution, not a kill —
  // flag it so the aftermath can weigh the cold-bloodedness of it.
  const wasHelpless = e.resolved === "yielded";
  if (cs.lethal) {
    e._dead = true;
    if (wasHelpless) { e.executed = true; cs.executedCount = (cs.executedCount || 0) + 1; }
    cs.log.push(logEntry(wasHelpless ? `${e.name} is cut down where it kneels.` : `${e.name} falls, dead.`, "system"));
  } else {
    e.resolved = "ko";
    cs.log.push(logEntry(`${e.name} is knocked senseless.`, "system"));
  }
  freeThrallsOf(cs, e.uid); // a dominator's death frees everything it had enthralled
  let lined = false;
  for (const s of cs.enemies) {
    if (s === e || s.health <= 0 || s.resolved) continue;
    const allyLoss = (ALLY_LOSS[s.demeanor] ?? 12) * (1 - bardMoraleResistance(s));
    s.morale = Math.max(0, s.morale - allyLoss);
    if (!lined && !["mindless", "fanatic", "feral"].includes(s.demeanor)) {
      const l = flavorLine("allyFell", s.demeanor, s.name);
      if (l) { cs.log.push(logEntry(l, "enemy")); lined = true; }
    }
  }
}
// An allied companion drops to 0 — dead in a lethal fight, knocked out in a brawl.
function downAlly(cs, a) {
  if (a._dead || a.resolved === "ko") return;
  collectDruidHarvest(cs, a);
  if (cs.lethal) { a._dead = true; cs.log.push(logEntry(`${a.name} falls, slain.`, "enemy")); }
  else { a.resolved = "ko"; cs.log.push(logEntry(`${a.name} is knocked senseless.`, "system")); }
}

// Self-targeted ability effects — shared by the player and NPCs so defensive and
// tempo abilities (shields, ward, invuln, an extra action) work the same for all.
// Living combatants on the actor's own side (for party-target support spells).
function sideAllies(cs, actor) {
  const list = actor.side === "enemy"
    ? cs.enemies
    : [cs.player, ...(cs.allies || [])];
  return list.filter((c) => c && c.health > 0 && !c.resolved && !c._dead);
}

function summonUndead(cs, actor) {
  if (!cs || !actor) return false;
  const side = actor.side === "enemy" ? "enemy" : "player";
  const destination = side === "enemy" ? cs.enemies : cs.allies;
  const maintained = destination.filter((entry) => entry._summonerUid === actor.uid && entry.health > 0 && !entry._dead);
  if (maintained.length >= 2) {
    cs.log.push(logEntry(`${actor.name} already maintains the maximum of two undead retainers.`, "status"));
    return false;
  }
  cs.summonSeq = (cs.summonSeq || 0) + 1;
  const maxHealth = clamp(Math.round((actor.maxHealth || 40) * 0.28), 12, 120);
  const body = Math.max(2, Math.floor((actor.attrs?.mind || actor.attrs?.body || 4) * 0.4));
  const minDamage = clamp(Math.round((actor.weapon?.min || 4) * 0.45), 2, 18);
  const maxDamage = Math.max(minDamage + 1, clamp(Math.round((actor.weapon?.max || 7) * 0.45), 3, 24));
  const summon = {
    uid: `summon-${actor.uid || "caster"}-${cs.summonSeq}`,
    id: `summoned-undead-${cs.summonSeq}`,
    name: "Bound Skeleton",
    kind: "summoned-undead",
    race: "undead",
    tier: "common",
    side,
    health: maxHealth,
    maxHealth,
    resolve: 0,
    resolveMax: 0,
    armor: Math.max(0, Math.round((actor.armor || 0) * 0.25)),
    ward: 0,
    dodge: Math.max(0, Math.round((actor.dodge || 0) * 0.25)),
    accuracy: Math.max(5, Math.round((actor.accuracy || 20) * 0.7)),
    critChance: 0,
    critMult: 1.5,
    speed: 2,
    will: 0,
    attrs: { body, reflex: 2, vigor: body, mind: 0, wit: 1, presence: 0 },
    weapon: { name: "Bone Claws", min: minDamage, max: maxDamage, type: "physical", pen: 0, category: "natural", reach: 1 },
    abilities: [],
    actionsPerTurn: 1,
    actionsLeft: 1,
    cooldowns: {},
    statuses: [],
    demeanor: "mindless",
    morale: 100,
    moraleMax: 100,
    canTalk: false,
    block: 0,
    shield: 0,
    magicShield: 0,
    invuln: 0,
    _summoned: true,
    _summonerUid: actor.uid,
  };
  destination.push(summon);
  cs.log.push(logEntry(`${actor.name} calls a bound skeleton into the battle.`, side === "player" ? "player" : "enemy"));
  return true;
}

function applySelfEffect(actor, effect, cs = null, sourceActor = null) {
  if (!effect) return;
  effect = druidSurgedEffect(sourceActor, effect);
  // `pctMax` heals/shields are a FRACTION of the target's max health, so support
  // stays meaningful at every scale (a flat +16 is noise next to a raid's HP).
  const val = effect.pctMax ? Math.max(1, Math.round((actor.maxHealth || 0) * (effect.value || 0))) : (effect.value || 0);
  switch (effect.type) {
    case "block":       actor.block = (actor.block || 0) + val; break;
    case "shield":      actor.shield = (actor.shield || 0) + val; break;
    case "magicShield": actor.magicShield = (actor.magicShield || 0) + val; break;
    case "invuln":      actor.invuln = Math.max(actor.invuln || 0, effect.duration || 1); break;
    // Unstoppable (BKB): debuff immunity AND damage immunity (invuln already turns
    // aside ALL damage, true included) for the duration — the answer to an alpha.
    case "unstoppable": { const d = effect.duration || 2; actor.invuln = Math.max(actor.invuln || 0, d); addStatus(actor, { type: "unstoppable", duration: d }); break; }
    case "bonusAction": actor.actionsLeft = (actor.actionsLeft || 0) + (effect.value || 1); break;
    case "purify": {
      const before = actor.statuses?.length || 0;
      actor.statuses = (actor.statuses || []).filter((status) => !PURIFIABLE_STATUS.has(status.type));
      const removed = before - actor.statuses.length;
      const restored = gainHealth(actor, Math.max(1, Math.round((actor.maxHealth || 1) * clamp(effect.value || 0.08, 0.03, 0.15))));
      if (cs && (removed > 0 || restored > 0)) {
        cs.log.push(logEntry(`${actor.name} is purified${removed ? ` of ${removed} affliction${removed === 1 ? "" : "s"}` : ""}${restored ? ` and immediately recovers ${restored}` : ""}.`, "status"));
      }
      break;
    }
    case "intercession": {
      const maxHealth = Math.max(1, actor.maxHealth || actor.health || 1);
      const inMortalDanger = actor.health / maxHealth <= clamp(effect.threshold || 0.35, 0.2, 0.5);
      const share = inMortalDanger
        ? clamp(effect.criticalValue || 0.25, 0.15, 0.35)
        : clamp(effect.value || 0.08, 0.04, 0.12);
      const restored = gainHealth(actor, Math.max(1, Math.round(maxHealth * share)));
      const ward = inMortalDanger ? Math.max(1, Math.round(maxHealth * clamp(effect.shield || 0.1, 0.05, 0.15))) : 0;
      if (ward) actor.shield = (actor.shield || 0) + ward;
      if (cs && (restored > 0 || ward > 0)) {
        cs.log.push(logEntry(`${actor.name} receives ${inMortalDanger ? "crisis intercession" : "measured intercession"}: ${restored} health${ward ? ` and ${ward} shield` : ""}.`, "status"));
      }
      break;
    }
    case "verdantAegis": {
      const maxHealth = Math.max(1, actor.maxHealth || actor.health || 1);
      const restored = gainHealth(actor, Math.max(1, Math.round(maxHealth * clamp(effect.heal || 0.07, 0.03, 0.12))));
      const ward = Math.max(1, Math.round(maxHealth * clamp(effect.shield || 0.12, 0.05, 0.18)));
      actor.shield = (actor.shield || 0) + ward;
      if (cs) cs.log.push(logEntry(`${actor.name} is sheltered by patient living roots: ${restored} health and ${ward} shield.`, "status"));
      break;
    }
    case "rangerFieldDressing": {
      const beforeHealth = actor.health;
      const beforeResolve = actor.resolve;
      const beforeBleeds = (actor.statuses || []).filter((status) => status.type === "bleed").length;
      actor.statuses = (actor.statuses || []).filter((status) => status.type !== "bleed");
      addStatus(actor, {
        type: "rangerFieldDressing",
        value: clamp(effect.value || 35, 20, 50),
        duration: clamp(effect.duration || 3, 1, 4),
      });
      let moraleRestored = 0;
      if (Number.isFinite(Number(actor.morale)) && Number.isFinite(Number(actor.moraleMax))) {
        const before = actor.morale;
        actor.morale = Math.min(actor.moraleMax, actor.morale + clamp(effect.morale || 6, 1, 10));
        moraleRestored = actor.morale - before;
      }
      // Explicitly preserve wounds and Resolve: this is pressure, cloth, splints,
      // and calm hands, not healing magic or a second resource pool.
      actor.health = beforeHealth;
      if (beforeResolve != null) actor.resolve = beforeResolve;
      if (cs) cs.log.push(logEntry(`${actor.name} is field-dressed${beforeBleeds ? `; ${beforeBleeds} active bleed${beforeBleeds === 1 ? " is" : "s are"} bound` : ""}${moraleRestored ? ` (+${moraleRestored} morale)` : ""}, without closing the wound.`, "status"));
      break;
    }
    case "rangerEvadingStep": {
      const steps = clamp(effect.steps || 1, 1, 1);
      if (cs) {
        if (actor.side === "enemy") actor.distance = Math.min(MAX_DISTANCE, (actor.distance || 0) + steps);
        else for (const target of cs.enemies || []) target.distance = Math.min(MAX_DISTANCE, (target.distance || 0) + steps);
      }
      addStatus(actor, { type: "rangerEvadingStep", value: clamp(effect.value || effect.dodge || 18, 8, 25), duration: clamp(effect.duration || 2, 1, 2) });
      break;
    }
    case "rangerRelentlessTrail":
      addStatus(actor, { type: "rangerRelentlessTrail", value: clamp(effect.value || 14, 6, 20), duration: clamp(effect.duration || 3, 1, 4) });
      break;
    case "rangerSafePassage":
      addStatus(actor, { type: "rangerSafePassage", value: clamp(effect.value || 16, 8, 24), duration: clamp(effect.duration || 2, 1, 3) });
      break;
    case "rangerRunningShot":
      addStatus(actor, { type: "rangerRunningShot", value: clamp(effect.value || 20, 10, 28), duration: clamp(effect.duration || 2, 1, 2) });
      break;
    case "artificerFieldRefit":
      applyArtificerRefit(cs, actor, effect);
      break;
    case "artificerGuardProjector":
    case "artificerInscribedWard":
    case "artificerLayeredSeal": {
      const cap = Math.max(1, Math.round((actor.maxHealth || 1) * clamp(effect.cap || 0.10, 0.04, 0.12)));
      const ward = Math.min(cap, clamp(Math.round(effect.ward || 8), 4, 16));
      actor.magicShield = (actor.magicShield || 0) + ward;
      addStatus(actor, { ...effect, value: ward, duration: clamp(effect.duration || 2, 1, 3), sourceUid: combatantActionKey(sourceActor || actor) });
      break;
    }
    case "artificerCountermeasure":
    case "artificerRestorativeAerosol": {
      const removable = (actor.statuses || []).find((status) => HARMFUL_STATUS.has(status.type));
      if (removable) actor.statuses = actor.statuses.filter((status) => status !== removable);
      if (effect.ward) actor.magicShield = (actor.magicShield || 0) + clamp(Math.round(effect.ward), 1, 6);
      if (effect.morale && Number.isFinite(Number(actor.morale)) && Number.isFinite(Number(actor.moraleMax))) {
        actor.morale = Math.min(actor.moraleMax, actor.morale + clamp(Math.round(effect.morale), 1, 10));
      }
      addStatus(actor, { ...effect, value: removable ? 1 : 0, duration: clamp(effect.duration || 1, 1, 2), sourceUid: combatantActionKey(sourceActor || actor) });
      break;
    }
    case "artificerAdaptivePlating":
    case "artificerMasterworkArray": {
      actor.block = (actor.block || 0) + clamp(Math.round(effect.block || 0), 0, 12);
      actor.magicShield = (actor.magicShield || 0) + clamp(Math.round(effect.ward || 0), 0, 12);
      addStatus(actor, { ...effect, value: clamp(Math.round(effect.accuracyBonus || 0), 0, 15), duration: clamp(effect.duration || 2, 1, 3), sourceUid: combatantActionKey(sourceActor || actor) });
      break;
    }
    case "artificerClockworkSentinel":
    case "artificerDeployableBarricade":
    case "artificerBulwarkFrame": {
      actor.block = (actor.block || 0) + clamp(Math.round(effect.block || 8), 4, 14);
      addStatus(actor, { ...effect, value: clamp(Math.round(effect.block || 8), 4, 14), duration: clamp(effect.duration || 2, 1, 3), sourceUid: combatantActionKey(sourceActor || actor) });
      break;
    }
    case "artificerRunicEdge":
    case "artificerInterceptionAutomaton":
    case "artificerOverclockServo":
      addStatus(actor, { ...effect, value: clamp(Math.round(effect.value || effect.physicalDamageBonus || effect.accuracyBonus || (effect.share || 0) * 100), 1, 25), duration: clamp(effect.duration || 2, 1, 3), sourceUid: combatantActionKey(sourceActor || actor) });
      break;
    case "warlockOpenCovenant": {
      const sourceUid = combatantActionKey(sourceActor || actor);
      actor.statuses = (actor.statuses || []).filter((status) => !(
        status.type === "warlockOpenCovenant" && status.sourceUid === sourceUid
      ));
      addStatus(actor, {
        ...effect,
        type: "warlockOpenCovenant",
        value: clamp(Math.round(effect.accuracyBonus || effect.value || 10), 5, 15),
        accuracyBonus: clamp(Math.round(effect.accuracyBonus || effect.value || 10), 5, 15),
        duration: clamp(effect.duration || 2, 1, 3),
        sourceUid,
      });
      break;
    }
    case "warlockOwedWard":
    case "warlockBlackBargain": {
      if (effect.type === "warlockBlackBargain" && actor.willing === false) {
        if (cs) cs.log.push(logEntry(`${actor.name} refuses the offered Black Bargain without penalty.`, "status"));
        break;
      }
      const sourceUid = combatantActionKey(sourceActor || actor);
      const ward = clamp(Math.round(effect.ward || effect.value || 10), 4, 18);
      const cap = clamp(Number(effect.cap ?? 0.10), 0.04, 0.10);
      actor.statuses = (actor.statuses || []).filter((status) => !(
        status.type === effect.type && status.sourceUid === sourceUid
      ));
      addStatus(actor, {
        ...effect,
        type: effect.type,
        value: Math.min(ward, Math.max(1, Math.round((actor.maxHealth || 1) * cap))),
        ward,
        cap,
        duration: clamp(effect.duration || 2, 1, 3),
        sourceUid,
      });
      break;
    }
    case "warlockSharedBurden": {
      if (actor.willing === false) {
        if (cs) cs.log.push(logEntry(`${actor.name} declines Shared Burden; no pact link is formed.`, "status"));
        break;
      }
      const sourceUid = combatantActionKey(sourceActor || actor);
      const rawShare = Number(effect.share ?? effect.value ?? 0.20);
      const share = clamp(Math.round(rawShare <= 1 ? rawShare * 100 : rawShare), 5, 20);
      const cap = clamp(Number(effect.cap ?? 0.08), 0.03, 0.08);
      actor.statuses = (actor.statuses || []).filter((status) => !(
        status.type === "warlockSharedBurden" && status.sourceUid === sourceUid
      ));
      addStatus(actor, {
        ...effect,
        type: "warlockSharedBurden",
        value: share,
        share: rawShare,
        cap,
        duration: clamp(effect.duration || 2, 1, 3),
        sourceUid,
      });
      break;
    }
    case "druidRimebark": {
      const ward = clamp(Math.round(effect.ward || effect.value || 10), 4, 18);
      addStatus(actor, {
        type: "druidRimebark",
        value: ward,
        ward,
        forcedMoveResistance: clamp(Math.round(effect.forcedMoveResistance || 20), 8, 30),
        duration: clamp(effect.duration || 2, 1, 3),
      });
      if (cs) cs.log.push(logEntry(`${actor.name} takes on ${ward} temporary rimebark ward.`, "status"));
      break;
    }
    case "druidSaprise": {
      const nature = String(actor.race || actor.kind || "").toLowerCase();
      if (actor.health <= 0 || actor._dead || ["undead", "construct"].includes(nature) || actor.living === false) break;
      const authored = Math.max(1, Math.round(effect.regen || effect.value || 4));
      const cap = Math.max(1, Math.round((actor.maxHealth || 1) * clamp(effect.cap || 0.08, 0.03, 0.12)));
      const sourceUid = combatantActionKey(sourceActor);
      const duration = clamp(effect.duration || 3, 1, 4);
      const regen = Math.min(authored, cap);
      addStatus(actor, { ...effect, type: "druidSaprise", value: regen, regen, cap: effect.cap, duration, sourceUid });
      addStatus(actor, { type: "regen", value: regen, duration, sourceUid });
      break;
    }
    case "druidLivingCanopy": {
      const reduction = Number(effect.projectileReduction ?? effect.value ?? 0.25);
      addStatus(actor, {
        ...effect,
        type: "druidLivingCanopy",
        value: clamp(Math.round(reduction <= 1 ? reduction * 100 : reduction), 10, 30),
        projectileReduction: reduction,
        requiresPresentGrowth: effect.requiresPresentGrowth === true,
        cap: clamp(effect.cap || 0.10, 0.05, 0.12),
        duration: clamp(effect.duration || 3, 1, 3),
        sourceUid: combatantActionKey(sourceActor),
      });
      break;
    }
    case "druidPredatorShape":
    case "druidWolfAspect":
    case "druidBearAspect": {
      const bodyBonus = clamp(Math.round(effect.bodyBonus || 0), 0, 24);
      const reflexBonus = clamp(Math.round(effect.reflexBonus || 0), 0, 24);
      const critBonus = clamp(Math.round(effect.critBonus || 0), 0, 12);
      const block = clamp(Math.round(effect.block || 0), 0, Math.max(1, Math.round((actor.maxHealth || 1) * 0.15)));
      if (block) actor.block = (actor.block || 0) + block;
      actor.statuses = (actor.statuses || []).filter((status) => ![
        "druidPredatorShape", "druidWolfAspect", "druidBearAspect",
      ].includes(status.type));
      addStatus(actor, {
        type: effect.type,
        value: Math.max(bodyBonus, reflexBonus, 1),
        bodyBonus,
        reflexBonus,
        critBonus,
        block,
        pursuitBonus: clamp(Math.round(effect.pursuitBonus || 0), 0, 20),
        forcedMoveResistance: clamp(Math.round(effect.forcedMoveResistance || 0), 0, 30),
        aspect: effect.aspect,
        duration: clamp(effect.duration || 3, 1, 4),
        sourceUid: combatantActionKey(sourceActor || actor),
      });
      if (cs) cs.log.push(logEntry(`${actor.name} reshapes only their own body into the ${effect.aspect || "wild"} aspect.`, "status"));
      break;
    }
    case "druidIronbarkRise": {
      const block = clamp(Math.round(effect.block || 10), 1, Math.max(1, Math.round((actor.maxHealth || 1) * clamp(effect.cap || 0.12, 0.06, 0.15))));
      const ward = clamp(Math.round(effect.ward || 8), 3, 15);
      actor.block = (actor.block || 0) + block;
      addStatus(actor, { type: "druidIronbarkRise", value: ward, duration: clamp(effect.duration || 2, 1, 3), sourceUid: combatantActionKey(sourceActor) });
      break;
    }
    case "druidReclamationBloom": {
      const nature = String(actor.race || actor.kind || "").toLowerCase();
      if (actor.health <= 0 || actor._dead || ["undead", "construct"].includes(nature) || actor.living === false) break;
      const healthCap = Math.max(1, Math.round((actor.maxHealth || 1) * clamp(effect.healthCap || 0.06, 0.03, 0.08)));
      const beforeHealth = actor.health;
      actor.health = Math.min(actor.maxHealth, actor.health + Math.min(Math.round(effect.restoreHealth || 5), healthCap));
      const restoredHealth = actor.health - beforeHealth;
      let restoredResolve = 0;
      if (Number.isFinite(Number(actor.resolve)) && Number.isFinite(Number(actor.resolveMax))) {
        const before = actor.resolve;
        actor.resolve = Math.min(actor.resolveMax, actor.resolve + Math.min(Math.round(effect.restoreResolve || 2), Math.round(effect.resolveCap || 3)));
        restoredResolve = actor.resolve - before;
      }
      if (cs && (restoredHealth || restoredResolve)) cs.log.push(logEntry(`${actor.name} reclaims decay into ${restoredHealth} health and ${restoredResolve} Resolve.`, "status"));
      break;
    }
    case "paladinOathguard":
    case "paladinBearTheBlow":
    case "paladinLastWitness":
    case "paladinOathIncarnate":
    case "paladinShieldCovenant":
    case "paladinRampartExchange":
    case "paladinRedeemingIntercession":
    case "paladinPilgrimAegis": {
      const defaults = {
        paladinOathguard: 30,
        paladinBearTheBlow: 40,
        paladinLastWitness: 55,
        paladinOathIncarnate: 65,
        paladinShieldCovenant: 35,
        paladinRampartExchange: 50,
        paladinRedeemingIntercession: 40,
        paladinPilgrimAegis: 40,
      };
      if (actor?.interceptionLineBlocked || actor?.reachableForInterception === false) {
        if (cs) cs.log.push(logEntry(`${sourceActor?.name || "The Paladin"} has no reachable physical interception line to ${actor.name}.`, "status"));
        break;
      }
      const sourceUid = combatantActionKey(sourceActor || actor);
      const rawShare = Number(effect.share ?? effect.value ?? defaults[effect.type]);
      const share = clamp(Math.round(rawShare <= 1 ? rawShare * 100 : rawShare), 10, 65);
      const cap = clamp(Number(effect.cap ?? 0.15), 0.08, 0.25);
      const duration = clamp(effect.duration || 2, 1, 3);
      actor.statuses = (actor.statuses || []).filter((status) => !(
        status.type === "paladinOathguard" && status.sourceUid === sourceUid
      ));
      addStatus(actor, { type: "paladinOathguard", value: share, cap, duration, sourceUid });
      if (effect.type !== "paladinOathguard") {
        actor.statuses = (actor.statuses || []).filter((status) => !(
          status.type === effect.type && status.sourceUid === sourceUid
        ));
        const ownValue = effect.fearSteadiness ?? effect.forcedMoveResistance ?? share;
        addStatus(actor, { type: effect.type, value: clamp(Math.round(ownValue), 1, 65), duration, sourceUid });
      }
      const blockValue = Number(effect.block || 0);
      if (blockValue > 0) {
        const block = blockValue <= 1
          ? Math.max(1, Math.round((actor.maxHealth || 1) * clamp(blockValue, 0, 0.2)))
          : clamp(Math.round(blockValue), 1, Math.max(1, Math.round((actor.maxHealth || 1) * 0.2)));
        actor.block = (actor.block || 0) + block;
      }
      if (effect.clearFear) {
        actor.statuses = (actor.statuses || []).filter((status) => !["fear", "terrified", "dread"].includes(status.type));
      }
      if (cs && actor !== sourceActor) {
        cs.log.push(logEntry(`${sourceActor?.name || "A Paladin"} places ${actor.name} under a source-owned Oathguard (${share}% bounded redirection).`, "status"));
      }
      break;
    }
    case "paladinStandFast": {
      const blockValue = Number(effect.block ?? effect.value ?? 0.12);
      const block = blockValue <= 1
        ? Math.max(1, Math.round((actor.maxHealth || 1) * clamp(blockValue, 0.05, 0.2)))
        : clamp(Math.round(blockValue), 1, Math.max(1, Math.round((actor.maxHealth || 1) * 0.2)));
      actor.block = (actor.block || 0) + block;
      actor.statuses = (actor.statuses || []).filter((status) => status.type !== "paladinStandFast");
      addStatus(actor, { type: "paladinStandFast", value: 1, duration: clamp(effect.duration || 2, 1, 2) });
      if (cs) cs.log.push(logEntry(`${actor.name} stands fast behind ${block} finite Block.`, "status"));
      break;
    }
    case "paladinSteadfastWord": {
      if (!canReceiveRogueSpeech(actor) || actor.willing === false) {
        if (cs) cs.log.push(logEntry(`${actor.name} cannot willingly hear the steadfast oath.`, "status"));
        break;
      }
      let restored = 0;
      if (Number.isFinite(Number(actor.morale)) && Number.isFinite(Number(actor.moraleMax))) {
        const before = actor.morale;
        actor.morale = Math.min(actor.moraleMax, actor.morale + clamp(effect.morale || effect.value || 12, 4, 20));
        restored = actor.morale - before;
      }
      addStatus(actor, { type: "paladinSteadfastWord", value: clamp(effect.fearSteadiness || effect.fearResist || 20, 8, 30), duration: clamp(effect.duration || 2, 1, 3) });
      if (cs) cs.log.push(logEntry(`${actor.name} is steadied by the witnessed word${restored ? ` (+${restored} morale)` : ""}; no wounds close.`, "status"));
      break;
    }
    case "paladinHoldTheLine": {
      const authored = Number(effect.block || 10);
      const block = authored <= 1
        ? Math.max(1, Math.round((actor.maxHealth || 1) * clamp(authored, 0.05, 0.15)))
        : clamp(Math.round(authored), 1, Math.max(1, Math.round((actor.maxHealth || 1) * 0.15)));
      actor.block = (actor.block || 0) + block;
      addStatus(actor, { type: "paladinHoldTheLine", value: clamp(effect.forcedMoveResistance || effect.value || 15, 5, 25), duration: clamp(effect.duration || 2, 1, 2) });
      break;
    }
    case "paladinBeaconStance": {
      if (actor.canSee === false || actor.blind || actor.canSeeSource === false) {
        if (cs) cs.log.push(logEntry(`${actor.name} cannot see the planted oath-beacon.`, "status"));
        break;
      }
      let restored = 0;
      if (Number.isFinite(Number(actor.morale)) && Number.isFinite(Number(actor.moraleMax))) {
        const before = actor.morale;
        actor.morale = Math.min(actor.moraleMax, actor.morale + clamp(effect.morale || 8, 2, 15));
        restored = actor.morale - before;
      }
      const blockRate = clamp(effect.block || 0, 0, 0.12);
      if (blockRate) actor.block = (actor.block || 0) + Math.max(1, Math.round((actor.maxHealth || 1) * blockRate));
      addStatus(actor, { type: effect.type, value: clamp(effect.value || effect.fearSteadiness || 18, 6, 28), duration: clamp(effect.duration || 2, 1, 3) });
      if (cs && restored) cs.log.push(logEntry(`${actor.name} regains ${restored} morale in the visible oath-beacon.`, "status"));
      break;
    }
    case "paladinBurdenTaken": {
      const reduction = Number(effect.redirectedDamageReduction ?? effect.redirectReduction ?? effect.value ?? 0.25);
      addStatus(actor, {
        type: "paladinBurdenTaken",
        value: clamp(Math.round(reduction <= 1 ? reduction * 100 : reduction), 10, 35),
        cap: clamp(effect.cap || 0.12, 0.08, 0.2),
        duration: clamp(effect.duration || 3, 1, 3),
      });
      break;
    }
    case "rogueSlipLine": {
      if (cs) {
        if (actor.side === "enemy") actor.distance = Math.min(MAX_DISTANCE, (actor.distance || 0) + 1);
        else for (const target of cs.enemies || []) target.distance = Math.min(MAX_DISTANCE, (target.distance || 0) + 1);
      }
      addStatus(actor, {
        type: "rogueSlipLine",
        value: clamp(effect.value || 18, 8, 24),
        duration: clamp(effect.duration || 2, 1, 2),
      });
      if (cs) cs.log.push(logEntry(`${actor.name} uses practiced footwork to leave the expected line without vanishing.`, "status"));
      break;
    }
    case "rogueCrowdGhost": {
      addStatus(actor, {
        type: "rogueCrowdGhost",
        value: clamp(effect.value || 22, 10, 28),
        duration: clamp(effect.duration || 2, 1, 2),
      });
      if (cs) cs.log.push(logEntry(`${actor.name} folds into mundane bodies and cover while remaining physically present.`, "status"));
      break;
    }
    case "barbarianBaitBlow": {
      gainProvokedBarbarianFury(cs, actor);
      addStatus(actor, {
        type: "barbarianExposedGuard",
        value: clamp(effect.exposure || 8, 5, 15),
        duration: clamp(effect.duration || 2, 1, 2),
      });
      if (cs) cs.log.push(logEntry(`${actor.name} baits the next blow with a deliberately exposed physical guard.`, "status"));
      break;
    }
    case "barbarianExposeGuard":
      addStatus(actor, { type: "barbarianExposedGuard", value: clamp(effect.value || 8, 5, 15), duration: clamp(effect.duration || 2, 1, 3) });
      break;
    case "barbarianAbandon": {
      const missing = 1 - actor.health / Math.max(1, actor.maxHealth || 1);
      const offence = clamp(Math.round(missing * (effect.maxOffence || 35)), 0, 35);
      if (offence > 0) addStatus(actor, { type: "barbarianAbandon", value: offence, duration: clamp(effect.duration || 3, 1, 3) });
      addStatus(actor, { type: "barbarianExposedGuard", value: clamp(effect.exposure || 10, 5, 15), duration: clamp(effect.duration || 3, 1, 3) });
      if (cs) cs.log.push(logEntry(`${actor.name} turns existing wounds into ${offence}% bounded offence without healing them.`, "status"));
      break;
    }
    case "barbarianGritThrough": {
      const block = Math.max(1, Math.round((actor.maxHealth || 1) * clamp(effect.block || 0.08, 0.04, 0.12)));
      actor.block = (actor.block || 0) + block;
      addStatus(actor, { type: "barbarianGritThrough", value: clamp(effect.forcedMoveResist || 2, 1, 3), duration: clamp(effect.duration || 2, 1, 2) });
      if (cs) cs.log.push(logEntry(`${actor.name} grits through for ${block} physical Block and a braced stance, without healing.`, "status"));
      break;
    }
    case "barbarianMountainFrame": {
      const block = Math.max(1, Math.round((actor.maxHealth || 1) * clamp(effect.block || 0.12, 0.06, 0.16)));
      actor.block = (actor.block || 0) + block;
      addStatus(actor, { type: "barbarianMountainFrame", value: clamp(effect.forcedMoveResist || 3, 2, 3), duration: clamp(effect.duration || 3, 1, 3) });
      if (cs) cs.log.push(logEntry(`${actor.name} plants a mountain frame for ${block} physical Block.`, "status"));
      break;
    }
    case "barbarianWarCry": {
      const eligible = canPerceiveBardPerformance(actor);
      if (!eligible) {
        if (cs) cs.log.push(logEntry(`${actor.name} cannot receive the audible War Cry.`, "status"));
        break;
      }
      let restored = 0;
      if (Number.isFinite(Number(actor.morale)) && Number.isFinite(Number(actor.moraleMax))) {
        const before = actor.morale;
        actor.morale = Math.min(actor.moraleMax, actor.morale + clamp(effect.value || 20, 5, 25));
        restored = actor.morale - before;
      }
      addStatus(actor, { type: "barbarianWarCry", value: clamp(Math.round((effect.value || 20) / 2), 5, 12), duration: clamp(effect.duration || 2, 1, 2) });
      if (cs) cs.log.push(logEntry(`${actor.name} is steadied by the physical War Cry${restored ? ` (+${restored} morale)` : ""}.`, "status"));
      break;
    }
    case "bardSteadyBeat":
    case "bardRisingTempo":
    case "bardCallResponse":
    case "bardHearteningChorus":
    case "bardWarDrum":
    case "bardLoreCallout":
    case "bardMarchingCadence":
    case "bardDefiantAnthem":
    case "bardOldBallad":
    case "bardBattleChronicle": {
      if (!canPerceiveBardPerformance(actor, { willing: true })) {
        if (cs) cs.log.push(logEntry(`${actor.name} cannot willingly perceive the performance.`, "status"));
        break;
      }
      let restored = 0;
      if (["bardHearteningChorus", "bardDefiantAnthem", "bardOldBallad"].includes(effect.type)
          && Number.isFinite(Number(actor.morale)) && Number.isFinite(Number(actor.moraleMax))) {
        const before = actor.morale;
        actor.morale = Math.min(actor.moraleMax, actor.morale + clamp(effect.value || 20, 5, 30));
        restored = actor.morale - before;
      }
      addStatus(actor, {
        type: effect.type,
        value: clamp(effect.value || 10, 3, 25),
        duration: clamp(effect.duration || 2, 1, 3),
      });
      if (cs) cs.log.push(logEntry(`${actor.name} follows the trained performance${restored ? ` (+${restored} morale)` : ""}.`, "status"));
      break;
    }
    case "monkYieldingGuard": {
      const block = Math.max(1, Math.round((actor.maxHealth || 1) * clamp(effect.block || 0.08, 0.04, 0.12)));
      actor.block = (actor.block || 0) + block;
      addStatus(actor, { type: "monkYieldingGuard", value: clamp(effect.dodge || 22, 10, 30), duration: clamp(effect.duration || 2, 1, 2) });
      if (cs) cs.log.push(logEntry(`${actor.name} keeps an empty-hand yielding guard (${block} Block).`, "status"));
      break;
    }
    case "monkCrossingStep":
      addStatus(actor, { type: "monkCrossingStep", value: clamp(effect.dodge || 20, 10, 30), duration: clamp(effect.duration || 2, 1, 2) });
      break;
    case "monkOpenHandParry":
      addStatus(actor, { type: "monkOpenHandParry", value: clamp(Math.round((effect.reduction || 0.35) * 100), 20, 40), duration: clamp(effect.duration || 2, 1, 2) });
      break;
    case "monkIronBodyBrace": {
      const block = Math.max(1, Math.round((actor.maxHealth || 1) * clamp(effect.block || 0.14, 0.08, 0.18)));
      actor.block = (actor.block || 0) + block;
      addStatus(actor, { type: "monkIronBodyBrace", value: block, duration: clamp(effect.duration || 2, 1, 2) });
      if (cs) cs.log.push(logEntry(`${actor.name} braces conditioned tissue and frame for ${block} physical Block.`, "status"));
      break;
    }
    case "monkBurstStep": {
      const steps = clamp(effect.steps || 2, 1, 2);
      if (cs) {
        if (actor.side === "enemy") actor.distance = Math.max(0, (actor.distance || 0) - steps);
        else for (const target of cs.enemies || []) target.distance = Math.max(0, (target.distance || 0) - steps);
      }
      addStatus(actor, { type: "monkBurstStep", value: clamp(effect.dodge || 18, 10, 25), duration: clamp(effect.duration || 2, 1, 2) });
      if (cs) cs.log.push(logEntry(`${actor.name} covers ${steps} step${steps === 1 ? "" : "s"} in a trained sprint.`, "status"));
      break;
    }
    case "monkAbsorbingFrame":
      addStatus(actor, { type: "monkAbsorbingFrame", value: clamp(Math.round((effect.reduction || 0.45) * 100), 25, 50), duration: clamp(effect.duration || 2, 1, 2) });
      break;
    case "monkReboundStep": {
      const steps = clamp(effect.steps || 1, 1, 1);
      if (cs) {
        if (actor.side === "enemy") actor.distance = Math.min(MAX_DISTANCE, (actor.distance || 0) + steps);
        else for (const target of cs.enemies || []) target.distance = Math.min(MAX_DISTANCE, (target.distance || 0) + steps);
      }
      addStatus(actor, { type: "monkReboundStep", value: clamp(effect.dodge || 24, 12, 32), duration: clamp(effect.duration || 2, 1, 2) });
      if (cs) cs.log.push(logEntry(`${actor.name} rebounds one physical step out of the answering line.`, "status"));
      break;
    }
    case "warriorGuard": {
      const block = Math.max(1, Math.round((actor.maxHealth || 1) * clamp(effect.block || 0.1, 0.05, 0.15)));
      actor.block = (actor.block || 0) + block;
      addStatus(actor, { type: "warriorGuard", value: block, duration: clamp(effect.duration || 2, 1, 2) });
      if (cs) cs.log.push(logEntry(`${actor.name} recovers behind a guarded weapon line (${block} Block).`, "status"));
      break;
    }
    case "warriorPassingStep":
      addStatus(actor, { type: "warriorPassingStep", value: clamp(effect.value || 25, 10, 35), duration: clamp(effect.duration || 2, 1, 2) });
      break;
    case "warriorTurningParry":
      addStatus(actor, { type: "warriorTurningParry", value: clamp(effect.value || 55, 30, 65), duration: clamp(effect.duration || 2, 1, 2) });
      break;
    case "warriorAdaptiveForm": {
      actor.lastWarriorSequenceTag = null;
      const shift = clamp(effect.cooldownShift || 1, 1, 2);
      for (const id of Object.keys(actor.cooldowns || {})) {
        if (isNativeWarriorTechnique(getAbilityDef(id))) actor.cooldowns[id] = Math.max(0, actor.cooldowns[id] - shift);
      }
      const block = Math.max(1, Math.round((actor.maxHealth || 1) * clamp(effect.block || 0.05, 0.03, 0.08)));
      actor.block = (actor.block || 0) + block;
      if (cs) cs.log.push(logEntry(`${actor.name} re-centers an adaptive martial form without creating Tempo.`, "status"));
      break;
    }
    case "warriorVeteranReversal":
      addStatus(actor, { type: "warriorVeteranReversal", value: clamp(Math.round((effect.reduction || 0.4) * 100), 25, 50), duration: clamp(effect.duration || 2, 1, 2) });
      break;
    case "warriorWeaponChange": {
      if (actor.alternateWeapon) {
        const previous = actor.weapon;
        actor.weapon = actor.alternateWeapon;
        actor.alternateWeapon = previous;
        if (cs) cs.log.push(logEntry(`${actor.name} changes to ${actor.weapon?.name || "a prepared weapon"}.`, "status"));
      } else if (cs) {
        cs.log.push(logEntry(`${actor.name} has no alternate weapon prepared, but restores a usable guard.`, "status"));
      }
      actor.actionsLeft = (actor.actionsLeft || 0) + 1;
      addStatus(actor, { type: "warriorWeaponChange", value: clamp(effect.value || 20, 10, 30), duration: clamp(effect.duration || 2, 1, 2) });
      break;
    }
    case "warriorRiposteGuard": {
      const block = Math.max(1, Math.round((actor.maxHealth || 1) * clamp(effect.block || 0.15, 0.08, 0.18)));
      actor.block = (actor.block || 0) + block;
      addStatus(actor, { type: "warriorRiposteGuard", value: block, duration: clamp(effect.duration || 2, 1, 2) });
      break;
    }
    case "warriorBracedAdvance": {
      const steps = clamp(effect.steps || 2, 1, 2);
      if (cs) {
        if (actor.side === "player") for (const target of cs.enemies) target.distance = Math.max(0, (target.distance || 0) - steps);
        else actor.distance = Math.max(0, (actor.distance || 0) - steps);
      }
      const block = Math.max(1, Math.round((actor.maxHealth || 1) * clamp(effect.block || 0.12, 0.06, 0.16)));
      actor.block = (actor.block || 0) + block;
      if (cs) cs.log.push(logEntry(`${actor.name} advances ${steps} step${steps === 1 ? "" : "s"} behind a physical brace.`, "status"));
      break;
    }
    case "warriorSecondBreath": {
      if (actor._warriorSecondBreathUsed) {
        if (cs) cs.log.push(logEntry(`${actor.name} has already spent that reserve of conditioning.`, "status"));
        break;
      }
      actor._warriorSecondBreathUsed = true;
      const recoveryCap = Math.max(1, Math.round((actor.maxHealth || 1) * clamp(effect.value || 0.15, 0.1, 0.2)));
      const before = actor.health;
      gainHealth(actor, recoveryCap);
      actor.health = Math.min(actor.health, before + recoveryCap, actor.maxHealth);
      const restored = actor.health - before;
      if (cs) cs.log.push(logEntry(`${actor.name} takes a second breath and immediately recovers ${restored} health.`, "status"));
      break;
    }
    case "warriorSeizeTempo": {
      actor.actionsLeft = (actor.actionsLeft || 0) + clamp(effect.value || 1, 1, 1);
      const shift = clamp(effect.cooldownShift || 1, 1, 1);
      for (const id of Object.keys(actor.cooldowns || {})) {
        if (isNativeWarriorTechnique(getAbilityDef(id))) actor.cooldowns[id] = Math.max(0, actor.cooldowns[id] - shift);
      }
      if (cs) cs.log.push(logEntry(`${actor.name} converts earned Tempo into immediate martial initiative.`, "status"));
      break;
    }
    case "warriorDenyApproach":
      addStatus(actor, { type: "warriorDenyApproach", value: clamp(Math.round((effect.counter || 0.4) * 100), 25, 60), duration: clamp(effect.duration || 3, 1, 3) });
      break;
    case "warriorShakeOff": {
      const before = actor.statuses?.length || 0;
      actor.statuses = (actor.statuses || []).filter((status) => !WARRIOR_SHAKE_OFF_STATUS.has(status.type));
      const removed = before - actor.statuses.length;
      const block = Math.max(1, Math.round((actor.maxHealth || 1) * clamp(effect.block || 0.06, 0.03, 0.08)));
      actor.block = (actor.block || 0) + block;
      if (cs) cs.log.push(logEntry(`${actor.name} shakes off ${removed} physical hindrance${removed === 1 ? "" : "s"} and braces for ${block}.`, "status"));
      break;
    }
    case "warriorLastStand": {
      if (actor._warriorLastStandUsed || actor.health / Math.max(1, actor.maxHealth || 1) > 0.35) {
        if (cs) cs.log.push(logEntry(`${actor.name} cannot commit another last stand.`, "status"));
        break;
      }
      actor._warriorLastStandUsed = true;
      actor.deathlessTurns = Math.max(actor.deathlessTurns || 0, clamp(effect.duration || 2, 1, 2));
      const block = Math.max(1, Math.round((actor.maxHealth || 1) * clamp(effect.block || 0.08, 0.04, 0.1)));
      actor.block = (actor.block || 0) + block;
      if (cs) cs.log.push(logEntry(`${actor.name} makes a last stand: wounds remain, but the final point will hold briefly.`, "status"));
      break;
    }
    case "summonUndead": summonUndead(cs, actor); break;
    case "spellReflection": addStatus(actor, { ...effect, value: clamp(effect.value || 40, 1, 60) }); break;
    case "arcaneConvergence": addStatus(actor, { ...effect, value: 1 }); break;
    case "antimagicField": addStatus(actor, { ...effect, value: clamp(effect.value || 70, 25, 85), duration: clamp(effect.duration || 2, 1, 3) }); break;
    case "greaterInvisibility": addStatus(actor, { ...effect, value: clamp(effect.value || 60, 25, 80), duration: clamp(effect.duration || 2, 1, 4) }); break;
    case "regen": {     // bank the %-of-max as flat/turn — Wit's abilityCrit lets a heal crit
      let hv = val;
      if (actor.abilityCrit && rand100() <= (actor.critChance || 0)) hv = Math.round(hv * (actor.critMult || 1.5));
      addStatus(actor, { ...effect, value: hv, pctMax: false });
      break;
    }
    default:            addStatus(actor, effect);
  }
}

// Usable abilities for an NPC (ally or enemy): off cooldown AND affordable on the
// actor's resolve (spells drain resolve; martial techniques are gated by action
// points + cooldown only — the same economy the player uses).
function npcCandidates(cs, actor, opponents = []) {
  if (hasStatus(actor, "polymorph")) return []; // transformed foes fall back to basic attacks
  const out = [];
  for (const a of (actor.abilities || [])) {
    if ((actor.cooldowns?.[a.id] || 0) > 0) continue;
    const def = getAbilityDef(a.id);
    if (!def) continue;
    if (hasStatus(actor, "silence") && silenceBlocksAbility(def)) continue;
    if (hasStatus(actor, "antimagicField") && isMagicalCastingDiscipline(def) && !def.innate) continue;
    if (actor.resolve != null && (def.resolveCost || 0) > actor.resolve) continue;
    if (!weaponReqMet(def, actor.weapon)) continue;
    if (!monkMobilityReqMet(actor, def)) continue;
    if (!barbarianEquipmentReqMet(actor, def)) continue;
    if (!druidEnvironmentRequirementMet(cs, actor, def)) continue;
    if ((def.warriorTempoCost || 0) > (actor.martialTempo || 0)) continue;
    if ((def.barbarianFuryCost || 0) > (actor.barbarianFury || 0)) continue;
    if ((def.bardCadenceCost || 0) > (actor.bardCadence || 0)) continue;
    if (!paladinConvictionReady(actor, def)) continue;
    if (!warlockFavorReady(actor, def)) continue;
    if (!warlockPactPricePayable(actor, def)) continue;
    if (!artificerChargesReady(actor, def)) continue;
    if (!paladinPhysicalRequirementMet(cs, actor, def)) continue;
    if (def.monkPostureCost && !opponents.some((target) => canAct(target) && monkPostureReady(target, def, actor))) continue;
    if (!rangerBeastRequirementMet(cs, actor, def)) continue;
    if (def.rangerRequiresCurrentQuarry || def.rangerQuarryInsightCost) {
      const quarry = rangerQuarryTarget(cs, actor);
      if (!rangerQuarryReady(cs, actor, def.target === "enemy" ? quarry : null, def)) continue;
    }
    if (isNativeRogueSubterfuge(def)) {
      if (!roguePhysicalRequirementMet(cs, actor, null, def) && def.target !== "enemy") continue;
      if (def.target === "enemy" && !opponents.some((target) => rogueTargetEligible(cs, actor, target, def))) continue;
    }
    if (isNativePaladinOathcraft(def) && def.target === "enemy"
        && !opponents.some((target) => paladinTargetEligible(actor, target, def))) continue;
    if (isNativeWarlockPactcraft(def) && def.target === "enemy"
        && !opponents.some((target) => warlockTargetEligible(cs, actor, target, def))) continue;
    if (def.healthThreshold != null && actor.health / Math.max(1, actor.maxHealth || 1) > def.healthThreshold) continue;
    if (def.effect?.type === "warriorSecondBreath" && actor._warriorSecondBreathUsed) continue;
    if (def.effect?.type === "warriorLastStand" && actor._warriorLastStandUsed) continue;
    out.push({ id: a.id, tier: a.tier || actor.tier || "common", def });
  }
  return out;
}

// Execute ONE action for an NPC actor (ally or enemy) against `opponents`. The
// caller (advanceQueue) loops this up to the actor's action points — the same
// economy the player uses. Spends resolve (spells) + cooldown + one action.
// Returns true if it acted (so the caller can keep spending action points).
function npcPerform(cs, actor, opponents, opts = {}) {
  if ((actor.actionsLeft || 0) <= 0) return false;
  // A dominated actor gets allies:[] so it won't "support" the side it's now fighting.
  let choice = opts.choice || chooseAction(actor, opponents, npcCandidates(cs, actor, opponents), { allies: opts.allies ?? sideAllies(cs, actor) });
  // A stored deck intent may have been planned before Polymorph landed. Replace
  // that stale spell/technique with the transformed creature's feeble fallback.
  if (hasStatus(actor, "polymorph")) {
    choice = {
      ability: { id: BASIC_ATTACK.id, tier: "common", def: BASIC_ATTACK },
      def: BASIC_ATTACK,
      mode: "single",
      target: opponents.find((entry) => entry.health > 0 && !entry.resolved && !entry._dead) || null,
    };
  }
  if (!choice) return false;
  if ((choice.def?.barbarianFuryCost || 0) > (actor.barbarianFury || 0)) {
    const target = opponents.find((entry) => canAct(entry)) || null;
    choice = {
      ability: { id: BASIC_ATTACK.id, tier: "common", def: BASIC_ATTACK },
      def: BASIC_ATTACK,
      mode: "single",
      target,
    };
  }
  if ((choice.def?.bardCadenceCost || 0) > (actor.bardCadence || 0)) {
    const target = opponents.find((entry) => canAct(entry)) || null;
    choice = {
      ability: { id: BASIC_ATTACK.id, tier: "common", def: BASIC_ATTACK },
      def: BASIC_ATTACK,
      mode: "single",
      target,
    };
  }
  if (!paladinConvictionReady(actor, choice.def)) {
    const target = opponents.find((entry) => canAct(entry)) || null;
    choice = {
      ability: { id: BASIC_ATTACK.id, tier: "common", def: BASIC_ATTACK },
      def: BASIC_ATTACK,
      mode: "single",
      target,
    };
  }
  if (choice.def?.rangerRequiresCurrentQuarry || choice.def?.rangerQuarryInsightCost) {
    const quarry = rangerQuarryTarget(cs, actor);
    if (!rangerQuarryReady(cs, actor, choice.def.target === "enemy" ? quarry : null, choice.def)) {
      const target = opponents.find((entry) => canAct(entry)) || null;
      choice = {
        ability: { id: BASIC_ATTACK.id, tier: "common", def: BASIC_ATTACK },
        def: BASIC_ATTACK,
        mode: "single",
        target,
      };
    } else if (choice.def.target === "enemy") {
      choice = { ...choice, mode: "single", target: quarry };
    }
  }
  if (isNativeRogueSubterfuge(choice.def)) {
    if (choice.def.target === "enemy") {
      const rogueTarget = rogueTargetEligible(cs, actor, choice.target, choice.def)
        ? choice.target
        : opponents.find((target) => rogueTargetEligible(cs, actor, target, choice.def));
      if (rogueTarget) choice = { ...choice, mode: "single", target: rogueTarget };
      else {
        const target = opponents.find((entry) => canAct(entry)) || null;
        choice = {
          ability: { id: BASIC_ATTACK.id, tier: "common", def: BASIC_ATTACK },
          def: BASIC_ATTACK,
          mode: "single",
          target,
        };
      }
    } else if (!roguePhysicalRequirementMet(cs, actor, null, choice.def)) {
      const target = opponents.find((entry) => canAct(entry)) || null;
      choice = {
        ability: { id: BASIC_ATTACK.id, tier: "common", def: BASIC_ATTACK },
        def: BASIC_ATTACK,
        mode: "single",
        target,
      };
    }
  }
  if (isNativePaladinOathcraft(choice.def) && choice.def.target === "enemy") {
    const oathTarget = paladinTargetEligible(actor, choice.target, choice.def)
      ? choice.target
      : opponents.find((target) => paladinTargetEligible(actor, target, choice.def));
    if (oathTarget) choice = { ...choice, mode: "single", target: oathTarget };
    else {
      const target = opponents.find((entry) => canAct(entry)) || null;
      choice = {
        ability: { id: BASIC_ATTACK.id, tier: "common", def: BASIC_ATTACK },
        def: BASIC_ATTACK,
        mode: "single",
        target,
      };
    }
  }
  if (isNativeWarlockPactcraft(choice.def) && choice.def.target === "enemy") {
    const pactTarget = warlockTargetEligible(cs, actor, choice.target, choice.def)
      ? choice.target
      : opponents.find((target) => warlockTargetEligible(cs, actor, target, choice.def));
    if (pactTarget) choice = { ...choice, mode: "single", target: pactTarget };
    else {
      const target = opponents.find((entry) => canAct(entry)) || null;
      choice = {
        ability: { id: BASIC_ATTACK.id, tier: "common", def: BASIC_ATTACK },
        def: BASIC_ATTACK,
        mode: "single",
        target,
      };
    }
  }
  if (!paladinPhysicalRequirementMet(cs, actor, choice.def)) {
    const target = opponents.find((entry) => canAct(entry)) || null;
    choice = {
      ability: { id: BASIC_ATTACK.id, tier: "common", def: BASIC_ATTACK },
      def: BASIC_ATTACK,
      mode: "single",
      target,
    };
  }
  if (!weaponReqMet(choice.def, actor.weapon) || !monkMobilityReqMet(actor, choice.def)
      || !barbarianEquipmentReqMet(actor, choice.def) || !rangerBeastRequirementMet(cs, actor, choice.def)
      || !druidEnvironmentRequirementMet(cs, actor, choice.def)
      || !warlockFavorReady(actor, choice.def) || !warlockPactPricePayable(actor, choice.def)
      || !artificerChargesReady(actor, choice.def)) {
    const target = opponents.find((entry) => canAct(entry)) || null;
    choice = {
      ability: { id: BASIC_ATTACK.id, tier: "common", def: BASIC_ATTACK },
      def: BASIC_ATTACK,
      mode: "single",
      target,
    };
  }
  if (choice.def?.monkPostureCost) {
    const postureTarget = monkPostureReady(choice.target, choice.def, actor)
      ? choice.target
      : opponents.find((target) => canAct(target) && monkPostureReady(target, choice.def, actor));
    if (postureTarget) choice = { ...choice, target: postureTarget, mode: "single" };
    else {
      const target = opponents.find((entry) => canAct(entry)) || null;
      choice = {
        ability: { id: BASIC_ATTACK.id, tier: "common", def: BASIC_ATTACK },
        def: BASIC_ATTACK,
        mode: "single",
        target,
      };
    }
  }
  const { def, ability, mode } = choice;
  const tId = ability.tier || actor.tier || "common";
  if (consumeSacredMisdirection(cs, actor, def)) return true;
  if (consumeWarriorWeaponBind(cs, actor, def)) return true;
  if (consumeMonkActionInterruption(cs, actor, def)) return true;
  if (consumeBarbarianActionStagger(cs, actor, def)) return true;
  // Distance gate: charge the last step (close + strike) when one step out, else
  // spend the action just closing in.
  if (mode === "single") {
    let mt = choice.target;
    if (!mt || mt.health <= 0 || mt.resolved || mt._dead) mt = opponents.find((o) => o.health > 0 && !o.resolved && !o._dead);
    if (mt) {
      const reach = abilityReach(actor, def);
      const distanceGap = gap(actor, mt);
      if (warriorDenyApproach(cs, actor, mt, def)) return true;
      if (warriorAdvanceIsChecked(cs, actor, def, distanceGap, reach)) return true;
      if (distanceGap > reach + 1) {
        actor.actionsLeft = (actor.actionsLeft || 1) - 1;
        closeStep(cs, actor, mt);
        cs.log.push(logEntry(`${actor.name} ${actor.side === "enemy" ? "advances" : "closes in"}.`, actor.side === "player" ? "player" : "enemy"));
        return true;
      }
      if (distanceGap > reach) closeStep(cs, actor, mt); // charge the final step, then strike below
    }
  }
  beginMonkAction(actor);
  beginBarbarianAction(actor);
  beginRangerAction(actor);
  beginRogueAction(actor);
  beginPaladinAction(actor);
  beginDruidAction(actor);
  beginWarlockAction(actor);
  beginArtificerAction(actor);
  if (!consumeRogueOpening(cs, actor, def.target === "enemy" ? choice.target : null, def)) {
    endMonkAction(actor);
    endBarbarianAction(actor);
    endRangerAction(actor);
    endRogueAction(actor);
    endPaladinAction(actor);
    finishDruidAction(cs, actor, false);
    endWarlockAction(actor);
    endArtificerAction(actor);
    return false;
  }
  spendWarriorTempo(cs, actor, def);
  spendBarbarianFury(cs, actor, def);
  spendBardCadence(cs, actor, def);
  spendRangerQuarryInsight(cs, actor, def.target === "enemy" ? choice.target : null, def);
  spendPaladinConviction(cs, actor, def);
  spendWarlockFavor(cs, actor, def);
  spendArtificerCharges(cs, actor, def);
  if (def.cooldown) actor.cooldowns[ability.id] = def.cooldown;
  if (actor.resolve != null) actor.resolve = Math.max(0, actor.resolve - (def.resolveCost || 0));
  actor.actionsLeft = (actor.actionsLeft || 1) - (def.actionCost || 1);
  commitDruidAction(cs, actor, def);
  payWarlockPactPrice(cs, actor, def);
  applyGeasBacklash(cs, actor, def);
  const sideKind = actor.side === "player" ? "player" : "enemy";

  const hitOne = (target) => {
    const profile = attackProfile(actor, def, tId, false);
    if (profile) dealHit(cs, actor, target, profile, def, tId);
    else if (def.effect && def.effect.target === "enemy" && target.health > 0) {
      applyEnemyEffect(cs, actor, target, def.effect, tId, def);
    }
  };

  if (mode === "self") {
    applySelfEffect(actor, def.effect, cs, actor);
    cs.log.push(logEntry(`${actor.name} uses ${def.name}.`, sideKind));
  } else if (mode === "all-allies") {
    cs.log.push(logEntry(`${actor.name} uses ${def.name}.`, sideKind));
    for (const al of sideAllies(cs, actor)) applySelfEffect(al, def.effect, cs, actor);
  } else if (mode === "aoe") {
    cs.log.push(logEntry(`${actor.name} uses ${def.name}.`, sideKind));
    for (const t of opponents) {
      if (t.health <= 0 || t.resolved || t._dead) continue;
      for (let h = 0; h < (def.hits || 1); h++) {
        if (t.health <= 0) break;
        hitOne(t);
      }
    }
  } else {
    let target = choice.target;
    if (!target || target.health <= 0 || target.resolved || target._dead) target = opponents.find((o) => o.health > 0 && !o.resolved && !o._dead);
    if (!target) { actor.actionsLeft = 0; endMonkAction(actor); endBarbarianAction(actor); endRangerAction(actor); endRogueAction(actor); endPaladinAction(actor); finishDruidAction(cs, actor, false); endWarlockAction(actor); endArtificerAction(actor); return false; }
    if (ability.id !== BASIC_ATTACK.id) cs.log.push(logEntry(`${actor.name} uses ${def.name}.`, sideKind));
    // Paired weapons add an extra light strike to the BASIC attack (twin blades).
    const hits = (def.hits || 1) + (ability.id === BASIC_ATTACK.id && actor.weapon?.paired ? 1 : 0);
    for (let h = 0; h < hits; h++) { if (target.health <= 0) break; hitOne(target); }
  }

  // Down anyone reduced to 0 (the player is left for the caller's playerDown).
  for (const t of opponents) {
    if (t.health > 0 || t === cs.player) continue;
    if (t.side === "enemy") downEnemy(cs, t); else downAlly(cs, t);
  }
  delete actor._warriorTempoSpent;
  completeBardPerformance(cs, actor, def);
  finishDruidAction(cs, actor);
  endWarlockAction(actor);
  endArtificerAction(actor);
  endMonkAction(actor);
  endBarbarianAction(actor);
  endRangerAction(actor);
  endRogueAction(actor);
  endPaladinAction(actor);
  return true;
}

function intentForChoice(actor, choice, seq) {
  if (!choice) return null;
  const tier = choice.ability?.tier || actor.tier || "common";
  const def = choice.def || getAbilityDef(choice.ability?.id);
  if (!def) return null;
  const profile = attackProfile(actor, def, tier, false);
  const hits = (def.hits || 1) + (choice.ability?.id === BASIC_ATTACK.id && actor.weapon?.paired ? 1 : 0);
  const estimated = choice.target && profile ? Math.max(0, Math.round(estimateHit(actor, def, tier, choice.target))) : 0;
  const defensive = ["block", "shield", "magicShield", "invuln", "unstoppable", "antimagicField", "greaterInvisibility"].includes(def.effect?.type);
  return {
    id: `${actor.uid}-r${seq}`,
    abilityId: choice.ability.id,
    tier,
    mode: choice.mode,
    targetUid: choice.target?.uid || null,
    name: def.name,
    kind: profile ? "attack" : def.effect?.target === "enemy" ? "debuff" : defensive ? "defend" : "skill",
    damage: profile ? { min: profile.min, max: profile.max, type: profile.type, hits, estimated } : null,
    status: def.effect?.type || null,
    effect: def.effect ? { ...def.effect } : null,
  };
}

// Intents are planned and stored before the player sees their hand. Execution
// reconstructs this exact choice; the AI is never asked to choose again mid-turn.
function planEnemyIntents(cs) {
  for (const enemy of cs.enemies) {
    enemy.intent = null;
    enemy.intents = [];
    if (!canAct(enemy) || enemy.fleeing || hasStatus(enemy, "charmed")) continue;
    if (hasStatus(enemy, "stun")) {
      const pass = {
        id: `${enemy.uid}-r${cs.round || cs.turn}-stunned`,
        abilityId: null,
        tier: enemy.tier || "common",
        mode: "pass",
        targetUid: null,
        name: "Stunned",
        kind: "pass",
        damage: null,
        status: null,
      };
      enemy.intent = pass;
      enemy.intents = [pass];
      continue;
    }
    const sim = clone(enemy);
    // Intents describe the state the enemy will actually have when its turn
    // begins. Simulate that one upcoming cooldown tick without mutating the
    // live actor; beginTurnFor performs the single real decrement at execution.
    decrementCooldowns(sim);
    const actionCount = Math.max(1, sim.actionsPerTurn || 1);
    const opponents = playerSide(cs);
    for (let index = 0; index < actionCount; index += 1) {
      const choice = chooseAction(sim, opponents, npcCandidates(cs, sim, opponents), { allies: sideAllies(cs, enemy) });
      const intent = intentForChoice(enemy, choice, `${cs.round || cs.turn}-${index}`);
      if (!choice || !intent) break;
      enemy.intents.push(intent);
      const def = choice.def;
      if (def.cooldown) sim.cooldowns[choice.ability.id] = def.cooldown;
      if (sim.resolve != null) sim.resolve = Math.max(0, sim.resolve - (def.resolveCost || 0));
    }
    enemy.intent = enemy.intents[0] || null;
  }
}

function choiceFromIntent(cs, actor, intent) {
  const def = getAbilityDef(intent?.abilityId);
  if (!def) return null;
  return {
    ability: { id: intent.abilityId, tier: intent.tier || actor.tier || "common", def },
    def,
    mode: intent.mode,
    target: intent.targetUid ? byUid(cs, intent.targetUid) : null,
  };
}

function resolveYield(cs, e) {
  e.resolved = "yielded";
  e.weapon = null; // disarmed — drops its weapon as it throws up its hands
  cs.log.push(logEntry(flavorLine("yield", e.demeanor, e.name) || `${e.name} yields, throwing down its weapon.`, "enemy"));
}
// How far a foe must get to be clear away, and how the chase reads.
const FLEE_ESCAPE_DISTANCE = 6;
// A foe doesn't vanish — it turns and RUNS, breaking away a step or two. It now
// gains ground each of its turns (fleeStep) until it's clear or run down. The
// player can pursue (advance) or shoot it; companions leave it to the player.
function resolveFlee(cs, e) {
  if (e.fleeing) return;
  e.fleeing = true;
  e.distance = Math.min(FLEE_ESCAPE_DISTANCE - 1, (e.distance || 0) + 2);
  cs.log.push(logEntry(flavorLine("flee", e.demeanor, e.name) || `${e.name} breaks and runs!`, "enemy"));
}
// A fleeing foe's turn: it sprints further off. Faster foes open the gap quicker.
// Once it's past the escape distance it's gone for good.
function fleeStep(cs, e) {
  const step = Math.max(1, Math.round((e.speed || 4) / 3));
  e.distance = (e.distance || 0) + step;
  if (e.distance >= FLEE_ESCAPE_DISTANCE) {
    e.fleeing = false;
    e.resolved = "fled";
    cs.log.push(logEntry(`${e.name} gets clear and escapes.`, "enemy"));
  } else {
    cs.log.push(logEntry(`${e.name} sprints away — ${e.distance}/${FLEE_ESCAPE_DISTANCE} to clear.`, "enemy"));
  }
}
function pushFlavor(cs, e, category) {
  const l = flavorLine(category, e.demeanor, e.name);
  if (l) { cs.log.push(logEntry(l, "enemy")); return true; }
  return false;
}

// A foe is hopelessly placed when its side is badly outnumbered (or it's the lone
// survivor against a group) AND the player's side clearly outclasses it. Proud
// foes only count themselves hopeless once bloodied.
function hopelesslyOutmatched(cs, e) {
  const cfg = DEMEANOR_CONFIG[e.demeanor] || DEMEANOR_CONFIG.wary;
  const opp = playerSide(cs);
  const own = livingEnemies(cs);
  const outnumbered = opp.length >= own.length * 2 || (own.length === 1 && opp.length >= 2);
  const hp = e.health / e.maxHealth;
  const outclassed = (cs.powerRatio || 1) >= 1.5 && (!cfg.proud || hp < 0.6);
  const winning = (hp - sideHpFrac(opp)) > 0.25; // personally well ahead — smells the kill
  return outnumbered && outclassed && !winning;
}

// Break a foe NOW: flee if it can cleanly get away, else yield at the player's
// mercy (or bolt if it can't yield). Returns true if it resolved.
function breakFoe(cs, e) {
  const cfg = DEMEANOR_CONFIG[e.demeanor] || DEMEANOR_CONFIG.wary;
  const canEscape = (e.speed || 4) >= (cs.player.speed || 4) && (cs.powerRatio || 1) < 2.2;
  if (cfg.prefer === "flee" && cfg.canFlee && canEscape) { resolveFlee(cs, e); return true; }
  if (cfg.canYield) { resolveYield(cs, e); return true; }
  if (cfg.canFlee) { resolveFlee(cs, e); return true; }
  return false;
}

// After a foe falls, the survivors take stock. One that's now hopelessly
// outmatched may break on the spot — yielding or fleeing BEFORE the player's
// companions take their turn — so a terrified foe isn't cut down when it would
// have thrown down its arms (and the player keeps the captive). Lethal fights
// only; mindless/fanatic never break, and a foe just goaded to hold stands fast.
function routCheck(cs) {
  if (!cs.lethal) return;
  if (!cs.enemies.some((e) => e._dead)) return; // a rout is triggered by seeing kin die
  for (const e of livingEnemies(cs)) {
    if (e.fleeing) continue; // already running — don't re-resolve it
    const cfg = DEMEANOR_CONFIG[e.demeanor] || DEMEANOR_CONFIG.wary;
    if (e.demeanor === "mindless" || e.demeanor === "fanatic") continue;
    if (!cfg.canYield && !cfg.canFlee) continue;
    if ((e.noFleeUntil || 0) >= cs.turn) continue;
    if (hopelesslyOutmatched(cs, e)) breakFoe(cs, e);
  }
}

// Decide a foe's reaction at the top of its turn. Returns true if it still
// acts (attacks); false if it resolved (fled/yielded) and should be skipped.
function moraleCheck(cs, e) {
  const cfg = DEMEANOR_CONFIG[e.demeanor] || DEMEANOR_CONFIG.wary;
  if (e.demeanor === "mindless" || e.demeanor === "fanatic") return true;
  const hp = e.health / e.maxHealth;

  if (e.demeanor === "feral") {
    if (cfg.canFlee && hp < (cfg.fleeAt ?? 0.22)) { resolveFlee(cs, e); return false; }
    if (hp < 0.3 && cs.turn - (e.lastFlavorTurn || 0) >= 2) { e.lastFlavorTurn = cs.turn; pushFlavor(cs, e, "waver"); }
    return true;
  }

  // People don't surrender because a fight is merely uncertain — they break when
  // they're badly hurt, the situation is hopeless, or they're timid by nature
  // (a craven, a frightened noble). Yielding is gated on HP + hopelessness, not
  // on a morale meter ticking down from a few hits.
  const opp = playerSide(cs);
  const ownSide = livingEnemies(cs);
  const oppHp = sideHpFrac(opp), ownHp = sideHpFrac(ownSide);
  const outnumbered = opp.length >= ownSide.length * 2;
  // Hopeless: heavily outnumbered and not winning the exchange, or the last one
  // standing against a healthy group.
  const hopeless = (outnumbered && oppHp >= ownHp - 0.05) || (ownSide.length === 1 && opp.length >= 2 && oppHp > 0.4);

  const goaded = (e.noFleeUntil || 0) >= cs.turn;
  const winning = (hp - oppHp) > 0.25; // personally well ahead — smells the kill
  const yieldHp = cfg.yieldHp ?? 0.25;
  // Only even consider breaking when actually in trouble — badly hurt, hopeless
  // and bloodied, or simply outnumbered AND clearly outclassed (a lone, doomed
  // foe throws down its arms rather than die for nothing, even at full health).
  const inTrouble = hp <= yieldHp || hp < 0.1 || (hopeless && hp < 0.5) || hopelesslyOutmatched(cs, e);
  const broke = !goaded && !winning && inTrouble;
  if (broke) {
    // A proud foe being bullied with control demands a fair fight before it breaks.
    if (cfg.proud && (e.controlPressure || 0) >= 2 && !e.provoked && hp > 0.15) {
      e.provoked = true;
      addStatus(e, { type: "rally", value: 20, duration: 2 });
      pushFlavor(cs, e, "provoke");
      return true;
    }
    let mode = cfg.prefer;
    if (mode === "either") mode = Math.random() < 0.5 ? "flee" : "yield";
    if (mode === "yield" && !cfg.canYield) mode = cfg.canFlee ? "flee" : "yield";
    if (mode === "flee" && !cfg.canFlee) mode = cfg.canYield ? "yield" : "flee";
    // You can't outrun someone who's already beaten you. A foe only gets away if
    // it's at least as fast AND you're not dominating; otherwise it's cornered
    // and yields (at your mercy) instead of cleanly escaping.
    const canEscape = (e.speed || 4) >= (cs.player.speed || 4) && cs.powerRatio < 1.4;
    if (mode === "flee" && cfg.canFlee && canEscape) { resolveFlee(cs, e); return false; }
    if (cfg.canYield) { resolveYield(cs, e); return false; }   // cornered → at your mercy
    if (cfg.canFlee) { resolveFlee(cs, e); return false; }     // can't yield (e.g. a beast) → bolts anyway
    return true;
  }

  // Warning zone: telegraph the fraying nerve as they near their breaking point.
  if (hp <= yieldHp + 0.18 && cs.turn - (e.lastFlavorTurn || 0) >= 2) {
    e.lastFlavorTurn = cs.turn;
    if (cfg.proud && (e.controlPressure || 0) >= 2 && !e.provoked) {
      e.provoked = true;
      addStatus(e, { type: "rally", value: 15, duration: 2 });
      pushFlavor(cs, e, "provoke");
    } else {
      pushFlavor(cs, e, cfg.canParley && Math.random() < 0.5 ? "plead" : "waver");
    }
  }
  return true;
}

// ----- status ticks -----

function tickStatuses(c) {
  const logs = [];
  const postureCapacity = monkPostureCapacity(c, c);
  c.postureStrain = clamp(Math.floor(c.postureStrain || 0), 0, postureCapacity);
  if (c.postureStrain > 0) {
    if ((c.postureDecayTurns || 0) > 0) c.postureDecayTurns = Math.max(0, c.postureDecayTurns - 1);
    else {
      c.postureStrain = Math.max(0, c.postureStrain - 1);
      if (c.postureStrain > 0) c.postureDecayTurns = 0;
      logs.push(logEntry(`${c.name} recovers balance (${c.postureStrain}/${postureCapacity} Posture Strain).`, "status"));
    }
  } else {
    c.postureDecayTurns = 0;
  }
  // Damage-over-time: bleed/poison/burn (+ lingering deferred wounds). A status can
  // be FLAT (value) or pctMax (a share of the victim's MAX health each turn) — the
  // latter is how a build chips down a huge-pool monster (Vyrnholt) it can't burst.
  let dot = 0;
  for (const s of (c.statuses || [])) {
    if (!["bleed", "poison", "burn", "lingering", "rogueVenomWork", "druidLeafrot", "druidHighSummer", "druidMolderingWave", ...WARLOCK_SCORCH_STATUS, "artificerSnapfire"].includes(s.type)) continue;
    let amount = s.pctMax ? Math.max(1, Math.round(c.maxHealth * (s.value || 0))) : (s.value || 0);
    if (s.type === "bleed") {
      const dressing = clamp(sumStatus(c, "rangerFieldDressing"), 0, 50) / 100;
      amount = Math.max(0, Math.round(amount * (1 - dressing)));
    }
    if (s.type === "rogueVenomWork") amount = Math.max(1, Math.round(amount * 0.5));
    dot += amount;
  }
  if (dot > 0) {
    c.health = Math.max(0, c.health - dot);
    logs.push(logEntry(`${c.name} suffers ${dot} from bleeding, poison, burning, prepared toxin, primal decay, pact scorch, or a prepared device.`, "status"));
  }
  const healAmt = sumStatus(c, "regen");
  if (healAmt > 0 && c.health > 0 && !hasStatus(c, "poison")) {
    const got = gainHealth(c, healAmt);
    if (got > 0) logs.push(logEntry(`${c.name} recovers ${got}.`, "status"));
  } else if (healAmt > 0 && c.health > 0 && hasStatus(c, "poison")) {
    logs.push(logEntry(`${c.name}'s regeneration is suppressed by poison.`, "status"));
  }
  const racialRegen = c.triggers?.racialRegeneration || 0;
  if (racialRegen > 0 && c.health > 0 && c.health < c.maxHealth) {
    let blockedBy = null;
    if (hasStatus(c, "curse")) blockedBy = "a severe curse";
    else if (c.race === "vampire" && c.sunlightExposure) blockedBy = "sunlight";
    else if (c.race === "vampire" && Number.isFinite(Number(c.needs?.hunger)) && Number(c.needs.hunger) <= 30) blockedBy = "blood hunger";
    else if (c.race === "lycanthrope" && hasStatus(c, "silverWound")) blockedBy = "silver";
    if (blockedBy) {
      logs.push(logEntry(`${c.name}'s racial regeneration is suppressed by ${blockedBy}.`, "status"));
    } else {
      const restored = gainHealth(c, Math.max(1, Math.round(c.maxHealth * racialRegen)));
      if (restored > 0) logs.push(logEntry(`${c.name}'s flesh regenerates ${restored}.`, "status"));
    }
  }
  // Shield/ward-shield regenerate from affixes, capped at three turns' worth so a
  // pool can't accumulate without bound. Invulnerability counts down each turn.
  // shieldGen/magicShieldGen are FRACTIONS of max health per turn (scale with the
  // wearer); the pool still caps at three turns' worth so it can't accrue forever.
  const sg = c.triggers?.shieldGen || 0;
  if (sg > 0) { const add = Math.round(c.maxHealth * sg); c.shield = Math.min((c.shield || 0) + add, add * 3); }
  const msg = c.triggers?.magicShieldGen || 0;
  if (msg > 0) { const add = Math.round(c.maxHealth * msg); c.magicShield = Math.min((c.magicShield || 0) + add, add * 3); }
  if ((c.invuln || 0) > 0) c.invuln -= 1;
  // Last Stand window: while it's open, damage-over-time can't kill either; tick it down.
  if (c.health <= 0 && lastStandHolds(c)) c.health = 1;
  if ((c.deathlessTurns || 0) > 0) c.deathlessTurns -= 1;
  c.statuses = (c.statuses || []).map((s) => ({ ...s, duration: s.duration - 1 })).filter((s) => s.duration > 0);
  return logs;
}

// Player at/below 0 — but an Undying passive can cheat death once per fight.
function playerDown(cs) {
  if (cs.player.health > 0) return false;
  // Last Stand (Presence 30): held off by any path, not just direct hits.
  if (lastStandHolds(cs.player)) { cs.player.health = 1; return false; }
  const rev = cs.player.triggers?.reviveOnce;
  if (rev && !cs.revivedUsed) {
    cs.revivedUsed = true;
    cs.player.health = Math.max(1, Math.round(cs.player.maxHealth * rev));
    cleanseHarm(cs.player); cs.player.invuln = Math.max(cs.player.invuln || 0, 1);
    cs.log.push(logEntry(`${cs.player.name} cheats death and rises!`, "status"));
    return false;
  }
  return true;
}

// ----- end-of-combat checks -----

function checkCombatEnd(cs) {
  if (!combatOver(cs)) return cs; // foes still fighting/fleeing, or a captive awaits a verdict
  if (cs.enemies.every((e) => e._dead)) return finishVictory(cs);
  return finishResolved(cs); // some yielded / fled / knocked out (non-lethal)
}

// ----- player actions -----

// A weapon technique HARD-requires a compatible weapon in hand — you can't
// Power Strike with a grimoire or bare fists. (Stat shortfalls stay soft.)
export function weaponReqMet(def, weapon) {
  // Monk discipline owns an explicit empty-hand/Temple-Arms contract even for
  // defensive cards whose scaling is `none`. Generic utility cards normally
  // ignore weaponReq, but that shortcut must not let a sword-wielding Monk use
  // Yielding Guard or another empty-hand form.
  if (["monk", "barbarian"].includes(def?.professionId) && def.weaponReq?.length) return def.weaponReq.includes(weapon?.category);
  if (abilityScaling(def) !== "weapon") return true;       // spells/utility need no weapon
  if (!def.weaponReq || def.weaponReq.length === 0) return true; // basic attack — any weapon/fists
  return def.weaponReq.includes(weapon?.category);
}

function monkMobilityReqMet(actor, def) {
  return !(def?.monkFreedomRequired && actor?.armorClass === "heavy");
}

function barbarianEquipmentReqMet(actor, def) {
  if (def?.professionId !== "barbarian") return true;
  const armorClass = actor?.armorClass || "none";
  if (def.armorReq?.length && !def.armorReq.includes(armorClass)) return false;
  if (def.barbarianMovementRequired && (actor?.movementLocked || actor?.immobilized || hasStatus(actor, "stun"))) return false;
  return true;
}

// The Resolve an ability actually costs the player. SPELLS get the spellcasting-
// proficiency discount (a capped %, never free); martial techniques and innate
// powers pay full. Shared by the usable-gate and the spend.
export function playerResolveCost(cs, def) {
  let base = def?.resolveCost || 0;
  if (base <= 0) return 0;
  const isSpell = abilityCategoryOf(def) === "spell";
  if (cs.player?.spellSurge) base *= 2; // Mind 30: ALL abilities cost double Resolve
  if (hasAbilityMetamagic(cs.player, def, "quickened-signature")) base *= 1.25;
  if (hasAbilityMetamagic(cs.player, def, "perfected-signature")) base *= 0.8;
  if (isSpell && hasStatus(cs.player, "arcaneConvergence")) base *= 0.7;
  const discount = isSpell ? Math.min(0.4, (cs.player.prof?.spellcasting || 0) * 0.02) : 0;
  return Math.max(1, Math.ceil(base * (1 - discount)));
}

function progressionUseAllowed(player, def, abilityId) {
  if (!def) return false;
  if (def.branchExclusive && !(player?.progressionBranchAbilityIds || []).includes(abilityId)) return false;
  if (def.progressionExclusive && !(player?.progressionAbilityIds || []).includes(abilityId)) return false;
  if (hasStatus(player, "polymorph") && abilityId !== BASIC_ATTACK.id && abilityId !== DEFEND.id) return false;
  if (hasStatus(player, "antimagicField") && isMagicalCastingDiscipline(def) && !def.innate) return false;
  return true;
}

export function abilityUsable(cs, abilityId) {
  if (cs.phase !== "player" || isPlayerTurnLocked(cs)) return false;
  const entry = cs.player.abilities.find((a) => a.id === abilityId);
  if (!entry) return false;
  const def = getAbilityDef(abilityId);
  if (!progressionUseAllowed(cs.player, def, abilityId)) return false;
  if ((cs.player.actionsLeft || 0) < effectiveActionCost(cs.player, def)) return false; // action points gate everything now
  if (hasStatus(cs.player, "silence") && abilityId !== BASIC_ATTACK.id && abilityId !== "defend"
      && silenceBlocksAbility(def)) return false;
  if ((cs.player.cooldowns[abilityId] || 0) > 0) return false;
  if ((cs.player.resolve ?? 0) < playerResolveCost(cs, def)) return false;
  if (!weaponReqMet(def, cs.player.weapon)) return false;
  if (!monkMobilityReqMet(cs.player, def)) return false;
  if (!barbarianEquipmentReqMet(cs.player, def)) return false;
  if (!druidEnvironmentRequirementMet(cs, cs.player, def)) return false;
  if (!rangerBeastRequirementMet(cs, cs.player, def)) return false;
  if ((def.warriorTempoCost || 0) > (cs.player.martialTempo || 0)) return false;
  if ((def.barbarianFuryCost || 0) > (cs.player.barbarianFury || 0)) return false;
  if ((def.bardCadenceCost || 0) > (cs.player.bardCadence || 0)) return false;
  if (!paladinConvictionReady(cs.player, def)) return false;
  if (!warlockFavorReady(cs.player, def)) return false;
  if (!warlockPactPricePayable(cs.player, def)) return false;
  if (!artificerChargesReady(cs.player, def)) return false;
  if (!paladinPhysicalRequirementMet(cs, cs.player, def)) return false;
  if (def.monkPostureCost) {
    const selected = cs.enemies?.[cs.target];
    const target = playerTargetable(selected) ? selected : cs.enemies?.find((entry) => playerTargetable(entry));
    if (!monkPostureReady(target, def, cs.player)) return false;
  }
  if (def.rangerRequiresCurrentQuarry || def.rangerQuarryInsightCost) {
    const selected = cs.enemies?.[cs.target];
    const target = def.target === "enemy"
      ? (playerTargetable(selected) ? selected : cs.enemies?.find((entry) => playerTargetable(entry)))
      : null;
    if (!rangerQuarryReady(cs, cs.player, target, def)) return false;
  }
  if (isNativeRogueSubterfuge(def)) {
    if (def.target === "enemy") {
      const selected = cs.enemies?.[cs.target];
      if (!rogueTargetEligible(cs, cs.player, selected, def)) return false;
    } else if (!roguePhysicalRequirementMet(cs, cs.player, null, def)) return false;
  }
  if (isNativePaladinOathcraft(def) && def.target === "enemy") {
    const selected = cs.enemies?.[cs.target];
    if (!paladinTargetEligible(cs.player, selected, def)) return false;
  }
  if (isNativeWarlockPactcraft(def) && def.target === "enemy") {
    const selected = cs.enemies?.[cs.target];
    if (!warlockTargetEligible(cs, cs.player, selected, def)) return false;
  }
  if (def.healthThreshold != null && cs.player.health / Math.max(1, cs.player.maxHealth || 1) > def.healthThreshold) return false;
  if (def.effect?.type === "warriorSecondBreath" && cs.player._warriorSecondBreathUsed) return false;
  if (def.effect?.type === "warriorLastStand" && cs.player._warriorLastStandUsed) return false;
  return true;
}

function cardTargetIndex(cs, card, targetUid) {
  if (["self", "all-enemies", "all-allies"].includes(card.target)) return null;
  const uid = targetUid || cs.targetUid || cs.enemies[cs.target]?.uid;
  return cs.enemies.findIndex((enemy) => enemy.uid === uid && playerTargetable(enemy));
}

export function cardUsable(cs, cardUid, targetUid = null) {
  if (!cs?.deck || cs.phase !== "player" || isPlayerTurnLocked(cs) || !cs.deck.hand.includes(cardUid)) return false;
  const card = cs.deck.cards[cardUid];
  const def = card && getAbilityDef(card.abilityId);
  if (!card || !def) return false;
  if (!progressionUseAllowed(cs.player, def, card.abilityId)) return false;
  if ((cs.player.energy || 0) < card.energyCost) return false;
  if ((cs.player.resolve ?? 0) < playerResolveCost(cs, def)) return false;
  if (!weaponReqMet(def, cs.player.weapon)) return false;
  if (!monkMobilityReqMet(cs.player, def)) return false;
  if (!barbarianEquipmentReqMet(cs.player, def)) return false;
  if (!druidEnvironmentRequirementMet(cs, cs.player, def)) return false;
  if (!rangerBeastRequirementMet(cs, cs.player, def)) return false;
  if ((def.warriorTempoCost || 0) > (cs.player.martialTempo || 0)) return false;
  if ((def.barbarianFuryCost || 0) > (cs.player.barbarianFury || 0)) return false;
  if ((def.bardCadenceCost || 0) > (cs.player.bardCadence || 0)) return false;
  if (!paladinConvictionReady(cs.player, def)) return false;
  if (!warlockFavorReady(cs.player, def)) return false;
  if (!warlockPactPricePayable(cs.player, def)) return false;
  if (!artificerChargesReady(cs.player, def)) return false;
  if (!paladinPhysicalRequirementMet(cs, cs.player, def)) return false;
  if (def.monkPostureCost) {
    const index = cardTargetIndex(cs, card, targetUid);
    if (index < 0 || !monkPostureReady(cs.enemies[index], def, cs.player)) return false;
  }
  if (def.rangerRequiresCurrentQuarry || def.rangerQuarryInsightCost) {
    const index = def.target === "enemy" ? cardTargetIndex(cs, card, targetUid) : -1;
    const target = index >= 0 ? cs.enemies[index] : null;
    if (!rangerQuarryReady(cs, cs.player, target, def)) return false;
  }
  if (isNativeRogueSubterfuge(def)) {
    if (def.target === "enemy") {
      const index = cardTargetIndex(cs, card, targetUid);
      if (index < 0 || !rogueTargetEligible(cs, cs.player, cs.enemies[index], def)) return false;
    } else if (!roguePhysicalRequirementMet(cs, cs.player, null, def)) return false;
  }
  if (isNativePaladinOathcraft(def) && def.target === "enemy") {
    const index = cardTargetIndex(cs, card, targetUid);
    if (index < 0 || !paladinTargetEligible(cs.player, cs.enemies[index], def)) return false;
  }
  if (isNativeWarlockPactcraft(def) && def.target === "enemy") {
    const index = cardTargetIndex(cs, card, targetUid);
    if (index < 0 || !warlockTargetEligible(cs, cs.player, cs.enemies[index], def)) return false;
  }
  if (def.healthThreshold != null && cs.player.health / Math.max(1, cs.player.maxHealth || 1) > def.healthThreshold) return false;
  if (def.effect?.type === "warriorSecondBreath" && cs.player._warriorSecondBreathUsed) return false;
  if (def.effect?.type === "warriorLastStand" && cs.player._warriorLastStandUsed) return false;
  if (hasStatus(cs.player, "silence") && card.abilityId !== BASIC_ATTACK.id && card.abilityId !== DEFEND.id
      && silenceBlocksAbility(def)) return false;
  if (!["self", "all-enemies", "all-allies"].includes(card.target) && cardTargetIndex(cs, card, targetUid) < 0) return false;
  return true;
}

export function playCard(cs0, cardUid, targetUid = null) {
  if (!cardUsable(cs0, cardUid, targetUid)) return cs0;
  const card = cs0.deck.cards[cardUid];
  const def = getAbilityDef(card.abilityId);
  const targetIndex = cardTargetIndex(cs0, card, targetUid);
  const prepared = clone(cs0);
  if (targetIndex >= 0) prepared.target = targetIndex;
  const energyBefore = prepared.player.energy || 0;
  const actionCost = effectiveActionCost(prepared.player, def);
  prepared.player.actionsLeft = Math.max(1, actionCost);
  prepared.player.cooldowns[card.abilityId] = 0; // the pile cycle replaces cooldowns
  const baselineAfter = prepared.player.actionsLeft - actionCost;
  let cs = playerAct(prepared, card.abilityId, targetIndex < 0 ? null : targetIndex);
  const actionBonus = Math.max(0, (cs.player.actionsLeft || 0) - baselineAfter);
  cs.player.energy = Math.max(0, energyBefore - card.energyCost + actionBonus);
  cs.player.actionsLeft = cs.player.energy;
  delete cs.player.cooldowns[card.abilityId];
  cs.targetUid = cs.enemies[cs.target]?.uid || cs.targetUid;

  cs.deck.hand = cs.deck.hand.filter((uid) => uid !== cardUid);
  // Resolve draw before placing this card in its destination, so an empty draw
  // pile cannot immediately reshuffle and redraw the card that created the draw.
  if ((card.draw || 0) > 0) drawCardsInto(cs, card.draw);
  if (card.exhaust) cs.deck.exhaust.push(cardUid);
  else cs.deck.discard.push(cardUid);
  cs.log.push(logEntry(`${card.name} → ${card.exhaust ? "exhaust" : "discard"}${card.draw ? ` · draw ${card.draw}` : ""}.`, "system"));
  return cs;
}

export function playerAct(cs0, abilityId, targetIndex) {
  if (abilityId === TALK.id) return playerTalk(cs0, "surrender", targetIndex);
  const usabilityState = targetIndex != null && playerTargetable(cs0.enemies?.[targetIndex])
    ? { ...cs0, target: targetIndex }
    : cs0;
  if (!abilityUsable(usabilityState, abilityId)) return cs0;
  const cs = clone(cs0);
  const def = getAbilityDef(abilityId);
  const entry = cs.player.abilities.find((a) => a.id === abilityId);
  const tierId = entry.tier || "common";
  const scaling = abilityScaling(def);
  const targetMode = effectiveAbilityTarget(cs.player, def);
  let rangerSpendTarget = null;
  let rogueCommitTarget = null;
  if (def.rangerRequiresCurrentQuarry || def.rangerQuarryInsightCost) {
    if (def.target === "enemy") {
      let quarryIndex = targetIndex;
      if (quarryIndex == null || !playerTargetable(cs.enemies[quarryIndex])) quarryIndex = cs.target;
      const selected = cs.enemies[quarryIndex];
      rangerSpendTarget = playerTargetable(selected) ? selected : null;
    }
    if (!rangerQuarryReady(cs, cs.player, rangerSpendTarget, def)) return cs0;
  }
  if (isNativeRogueSubterfuge(def)) {
    if (def.target === "enemy") {
      let rogueIndex = targetIndex;
      if (rogueIndex == null || !playerTargetable(cs.enemies[rogueIndex])) rogueIndex = cs.target;
      const selected = cs.enemies[rogueIndex];
      rogueCommitTarget = playerTargetable(selected) ? selected : null;
      if (!rogueTargetEligible(cs, cs.player, rogueCommitTarget, def)) return cs0;
    } else if (!roguePhysicalRequirementMet(cs, cs.player, null, def)) return cs0;
  }
  if (def.monkPostureCost && targetMode === "enemy") {
    let postureIndex = targetIndex;
    if (postureIndex == null || !playerTargetable(cs.enemies[postureIndex])) {
      postureIndex = cs.target;
    }
    const selected = cs.enemies[postureIndex];
    const postureTarget = playerTargetable(selected) ? selected : cs.enemies.find((entry) => playerTargetable(entry));
    if (!monkPostureReady(postureTarget, def, cs.player)) return cs0;
  }
  if (consumeSacredMisdirection(cs, cs.player, def)) return cs;
  if (consumeWarriorWeaponBind(cs, cs.player, def)) return cs;
  if (consumeMonkActionInterruption(cs, cs.player, def)) return cs;
  if (consumeBarbarianActionStagger(cs, cs.player, def)) return cs;
  // Distance gate: a single-target action only lands within the ability's
  // reach/range. One step out → CHARGE (close the last step and strike in the
  // same action). Farther → spend the action just closing in (no cost).
  if (targetMode !== "self" && targetMode !== "all-enemies" && targetMode !== "all-allies") {
    let gi = targetIndex;
    if (gi == null || !playerTargetable(cs.enemies[gi])) gi = cs.enemies.findIndex((e) => e.health > 0 && !e.resolved);
    const gt = gi >= 0 ? cs.enemies[gi] : null;
    if (gt) {
      const reach = abilityReach(cs.player, def);
      const distanceGap = gt.distance || 0;
      if (warriorDenyApproach(cs, cs.player, gt, def)) return cs;
      if (warriorAdvanceIsChecked(cs, cs.player, def, distanceGap, reach)) return cs;
      if (distanceGap > reach + 1) {
        cs.player.actionsLeft = (cs.player.actionsLeft || 1) - (def.actionCost || 1);
        closeStep(cs, cs.player, gt);
        cs.log.push(logEntry(`${cs.player.name} closes the distance.`, "player"));
        return cs;
      }
      if (distanceGap > reach) closeStep(cs, cs.player, gt); // charge the final step, then strike
    }
  }
  beginMonkAction(cs.player);
  beginBarbarianAction(cs.player);
  beginRangerAction(cs.player);
  beginRogueAction(cs.player);
  beginPaladinAction(cs.player);
  beginDruidAction(cs.player);
  beginWarlockAction(cs.player);
  beginArtificerAction(cs.player);
  if (!consumeRogueOpening(cs, cs.player, rogueCommitTarget, def)) {
    endMonkAction(cs.player);
    endBarbarianAction(cs.player);
    endRangerAction(cs.player);
    endRogueAction(cs.player);
    endPaladinAction(cs.player);
    finishDruidAction(cs, cs.player, false);
    endWarlockAction(cs.player);
    endArtificerAction(cs.player);
    return cs0;
  }
  // A spell or a real weapon technique is inherently a killing act — using one
  // in a brawl escalates it to lethal on its own (no separate Draw needed).
  const isSpell = scaling === "stat";
  const isSonicTechnique = scaling === "performance" && !!def.dmg;
  const isFieldcraftHarm = scaling === "fieldcraft" && !!def.dmg;
  const isWeaponTech = scaling === "weapon"
    && cs.player.weapon?.category !== "unarmed"
    && def.weaponReq?.some((category) => category !== "unarmed");
  // Innate racial powers (dragon breath, hellfire, etc.) aren't "witchcraft" — they
  // don't trigger the dread-of-magic reaction, though they still escalate a brawl.
  if (isSpell && !def.innate) cs.magicCast = true;
  if (!cs.lethal && (isSpell || isWeaponTech || isSonicTechnique || isFieldcraftHarm)) {
    escalateToLethal(cs, isSpell ? "magic" : isSonicTechnique ? "sonic" : "weapon");
  }
  spendWarriorTempo(cs, cs.player, def);
  spendBarbarianFury(cs, cs.player, def);
  spendBardCadence(cs, cs.player, def);
  spendRangerQuarryInsight(cs, cs.player, rangerSpendTarget, def);
  spendPaladinConviction(cs, cs.player, def);
  spendWarlockFavor(cs, cs.player, def);
  spendArtificerCharges(cs, cs.player, def);
  cs.player.actionsLeft = (cs.player.actionsLeft || 0) - effectiveActionCost(cs.player, def); // action points gate actions
  // Spellcasting proficiency makes casting cheaper on Resolve — a capped %
  // discount that stretches the pool but never makes a spell free (see helper).
  const resoCost = playerResolveCost(cs, def);
  cs.player.resolve = Math.max(0, (cs.player.resolve ?? 0) - resoCost);
  const cooldown = effectiveCooldown(cs.player, def);
  if (cooldown) cs.player.cooldowns[abilityId] = cooldown;
  commitDruidAction(cs, cs.player, def);
  payWarlockPactPrice(cs, cs.player, def);
  applyGeasBacklash(cs, cs.player, def);

  // Train the proficiency this action exercises (do-it-get-better).
  if (scaling === "performance") addProf(cs, "performance", XP.COMMAND);
  else if (def.school === "fieldcraft") {
    addProf(cs, "awareness", XP.AWARENESS);
    if (scaling === "weapon") addProf(cs, weaponMasteryId(cs.player.weapon?.category), XP.WEAPON_HIT);
  } else if (def.dmg || def.damageType === "weapon") {
    if (scaling === "stat") addProf(cs, "spellcasting", XP.SPELL_CAST);
    else if (scaling === "weapon") addProf(cs, weaponMasteryId(cs.player.weapon?.category), XP.WEAPON_HIT);
  }

  const profile = attackProfile(cs.player, def, tierId, true);
  if (profile) profile.eff = abilityEffectiveness(cs.player, def, tierId);

  // Shared resolution path: lifesteal, thorns, statuses, and synergy procs all
  // run through dealHit, exactly as they do for NPCs. No-damage debuffs (Hex,
  // Curse…) have no profile — apply their effect directly.
  const hitEnemy = (target) => {
    if (profile) dealHit(cs, cs.player, target, profile, def, tierId);
    else if (def.effect && def.effect.target === "enemy" && target.health > 0) {
      applyEnemyEffect(cs, cs.player, target, def.effect, tierId, def);
    }
  };

  if (targetMode === "self") {
    applySelfEffect(cs.player, def.effect, cs, cs.player);
    cs.log.push(logEntry(`${cs.player.name} uses ${def.name}.`, "player"));
  } else if (targetMode === "all-allies") {
    cs.log.push(logEntry(`${cs.player.name} uses ${def.name}.`, "player"));
    for (const al of sideAllies(cs, cs.player)) applySelfEffect(al, def.effect, cs, cs.player);
  } else if (targetMode === "all-enemies") {
    cs.log.push(logEntry(`${cs.player.name} uses ${def.name}.`, "player"));
    for (const e of cs.enemies) {
      if (e.health <= 0 || e.resolved) continue;
      for (let h = 0; h < (def.hits || 1); h++) {
        if (e.health <= 0) break;
        hitEnemy(e);
      }
    }
  } else {
    let idx = targetIndex;
    if (idx == null || !playerTargetable(cs.enemies[idx])) {
      idx = cs.enemies.findIndex((e) => e.health > 0 && !e.resolved);
    }
    if (idx < 0) { endMonkAction(cs.player); endBarbarianAction(cs.player); endRangerAction(cs.player); endRogueAction(cs.player); endPaladinAction(cs.player); finishDruidAction(cs, cs.player, false); endWarlockAction(cs.player); endArtificerAction(cs.player); return cs0; }
    const target = cs.enemies[idx];
    if (abilityId !== BASIC_ATTACK.id) cs.log.push(logEntry(`${cs.player.name} uses ${def.name}.`, "player"));
    // Paired weapons add an extra light strike to the BASIC attack (twin blades).
    const twinHits = isTwinnedSignature(cs.player, def) ? 1 : 0;
    const hits = (def.hits || 1) + twinHits + (abilityId === BASIC_ATTACK.id && cs.player.weapon?.paired ? 1 : 0);
    for (let h = 0; h < hits; h++) { if (target.health <= 0) break; hitEnemy(target); }
  }

  for (const e of cs.enemies) if (e.health <= 0) downEnemy(cs, e);
  const firstAlive = cs.enemies.findIndex((e) => e.health > 0 && !e.resolved);
  if (firstAlive >= 0 && (cs.enemies[cs.target]?.health <= 0 || cs.enemies[cs.target]?.resolved)) cs.target = firstAlive;
  delete cs.player._warriorTempoSpent;
  completeBardPerformance(cs, cs.player, def);
  finishDruidAction(cs, cs.player);
  endWarlockAction(cs.player);
  endArtificerAction(cs.player);
  endMonkAction(cs.player);
  endBarbarianAction(cs.player);
  endRangerAction(cs.player);
  endRogueAction(cs.player);
  endPaladinAction(cs.player);
  return checkCombatEnd(cs);
}

const canCommunicate = (e) => e.canTalk !== false && DEMEANOR_CONFIG[e.demeanor]?.canParley;

// Talk to the foe. Intent: "surrender" (demand they yield), "demoralize" (sap
// the will to fight of all who can hear), or "provoke" (goad one foe into a
// reckless fight and keep it from fleeing). Only thinking foes can be reached.
export function playerTalk(cs0, intent = "surrender", targetIndex = null) {
  if (!abilityUsable(cs0, TALK.id)) return cs0;
  const cs = clone(cs0);
  cs.player.actionsLeft = (cs.player.actionsLeft || 1) - 1; // talking is your action this turn
  cs.player.cooldowns[TALK.id] = TALK.cooldown;
  addProf(cs, "command", XP.COMMAND);
  const a = cs.player.attrs || {};
  const presence = mechanicalAttributeValue(a.presence);
  const wit = mechanicalAttributeValue(a.wit);

  if (intent === "demoralize") {
    cs.log.push(logEntry(`${cs.player.name} hurls threats and grim promises.`, "player"));
    const hit = livingEnemies(cs).filter(canCommunicate);
    if (hit.length === 0) cs.log.push(logEntry(`No one here can be cowed.`, "system"));
    const playerHp = cs.player.health / cs.player.maxHealth;
    for (const e of hit) {
      let dmg = 8 + presence * 3 + wit * 1.5;
      if (cs.powerRatio > 1.4) dmg += 10;
      if (e.demeanor === "cowardly") dmg += 8;
      if (DEMEANOR_CONFIG[e.demeanor]?.proud) dmg *= 0.5;
      // A foe who's winning isn't impressed by threats.
      if ((e.health / e.maxHealth) - playerHp > 0.25) dmg *= 0.4;
      e.morale = Math.max(0, e.morale - Math.round(dmg));
      pushFlavor(cs, e, "waver");
    }
    return checkCombatEnd(cs);
  }

  if (intent === "provoke") {
    let idx = targetIndex;
    if (idx == null || !cs.enemies[idx] || cs.enemies[idx].health <= 0 || cs.enemies[idx].resolved) idx = cs.enemies.findIndex((e) => e.health > 0 && !e.resolved);
    const e = cs.enemies[idx];
    if (!e) return cs0;
    if (!canCommunicate(e)) { cs.log.push(logEntry(`${e.name} cannot be goaded.`, "system")); return cs; }
    addStatus(e, { type: "vulnerable", value: 30, duration: 2 });
    addStatus(e, { type: "rally", value: 15, duration: 2 });
    e.noFleeUntil = cs.turn + 2;
    e.provoked = true;
    cs.log.push(logEntry(flavorLine("provoke", e.demeanor, e.name) || `${e.name} is goaded into a reckless fury.`, "enemy"));
    cs.log.push(logEntry(`${e.name} drops its guard in anger.`, "status"));
    return cs;
  }

  // surrender (default)
  cs.log.push(logEntry(`${cs.player.name} calls on the foe to yield.`, "player"));
  const fallen = cs.enemies.filter((e) => e.health <= 0).length;
  const playerHp = cs.player.health / cs.player.maxHealth;
  for (const e of cs.enemies) {
    if (e.health <= 0 || e.resolved) continue;
    const cfg = DEMEANOR_CONFIG[e.demeanor] || DEMEANOR_CONFIG.wary;
    if (!canCommunicate(e)) { cs.log.push(logEntry(`${e.name} cannot be reasoned with.`, "system")); continue; }
    const hp = e.health / e.maxHealth;
    let chance = 6 + presence * 4 + wit * 1.5;
    chance += (e.moraleMax - e.morale) * 0.5;
    if (hp < 0.3) chance += 28; else if (hp < 0.5) chance += 14;
    chance += fallen * 10;
    // Who's actually winning? A foe in better shape than you scoffs at a demand
    // to yield (an unscathed sellsword does not surrender to a half-dead man);
    // a foe doing worse than you is far likelier to give up.
    const standing = hp - playerHp; // >0: foe winning · <0: foe losing
    // The "you outclass them" bonus only counts when you're NOT currently losing
    // the exchange — being stronger on paper means nothing while you're bleeding out.
    if (standing <= 0) {
      if (cs.powerRatio > 1.6) chance += 25; else if (cs.powerRatio > 1.15) chance += 10;
    }
    if (e.demeanor === "cowardly") chance += 18;
    if (e.demeanor === "honorable") chance += (e.controlPressure || 0) >= 2 ? 0 : 18;
    if (cfg.proud && (e.controlPressure || 0) >= 2 && cs.powerRatio < 2) chance -= 35;
    if (standing > 0) chance -= Math.round(standing * 70);
    else chance += Math.round(-standing * 25);
    chance = clamp(chance, 0, 95);
    if (rand100() <= chance) resolveYield(cs, e);
    else { cs.log.push(logEntry(flavorLine("defy", e.demeanor, e.name) || `${e.name} scoffs — you're in no position to make demands.`, "enemy")); e.morale = Math.max(0, e.morale - 2); }
  }
  return checkCombatEnd(cs);
}

export function setTarget(cs0, idx) {
  const targetIndex = typeof idx === "string" ? cs0.enemies.findIndex((e) => e.uid === idx) : idx;
  if (!playerTargetable(cs0.enemies[targetIndex])) return cs0; // alive foes, plus a yielded one to execute
  return { ...cs0, target: targetIndex, targetUid: cs0.enemies[targetIndex].uid };
}

// Apply a narrator-adjudicated improvised action ([COMBAT ACTION]) to the
// fight. The narrator decides WHAT happens and whether it works; the engine
// keeps the NUMBERS in bounds — a magnitude band is scaled to the player's
// strength so a freeform line can't hand out arbitrary damage. Counts as the
// player's action; the caller advances the turn afterward.
export function applyCombatEffect(cs0, effect) {
  if (cs0.phase !== "player" || !effect || isPlayerTurnLocked(cs0)) return cs0;
  const cs = clone(cs0);
  const p = cs.player;
  if (effect.narration) cs.log.push(logEntry(effect.narration, "player"));

  const living = livingEnemies(cs);
  let targets;
  if (effect.target === "all") targets = living;
  else if (effect.target === "self" || effect.target == null) targets = [];
  else {
    const byName = living.find((e) => e.name.toLowerCase() === String(effect.target).toLowerCase());
    const cur = cs.enemies[cs.target];
    targets = byName ? [byName] : (cur && cur.health > 0 && !cur.resolved ? [cur] : (living[0] ? [living[0]] : []));
  }

  const magDmg = (mag) => {
    const w = p.weapon || { min: 2, max: 4 };
    const body = mechanicalAttributeValue(p.attrs?.body);
    const avg = (w.min + w.max) / 2;
    const base = mag === "major" ? avg * 1.6 + body : mag === "moderate" ? avg + body * 0.5 : avg * 0.5;
    return Math.max(1, Math.round(base * (0.85 + Math.random() * 0.3)));
  };

  if ((effect.kind === "attack" || effect.kind === "control") && effect.magnitude) {
    const type = effect.damage_type || "physical";
    for (const t of targets) {
      let dmg = magDmg(effect.magnitude);
      if (type === "physical") dmg = Math.max(0, dmg - (t.armor || 0));
      else if (type === "magical") dmg = Math.max(0, dmg - (t.ward || 0));
      const before = t.health;
      t.health = Math.max(0, t.health - dmg);
      const dealt = before - t.health;
      cs.log.push(logEntry(`${t.name} takes ${dealt}${type === "true" ? " true" : type === "magical" ? " magical" : ""}.`, "hit"));
      if (dealt > 0) onEnemyDamaged(t, dealt);
    }
  }

  // Status from the action (on a target or on the player).
  if (effect.status && effect.status.type) {
    const st = { type: effect.status.type, value: effect.status.value || 0, duration: effect.status.duration || 1 };
    if (effect.status.who === "self") addStatus(p, st);
    else for (const t of targets) { if (t.health > 0) { addStatus(t, st); if (CONTROL_TYPES.has(st.type)) onEnemyControlled(t); } }
  }

  // Social / will outcome the narrator judged earned.
  if (effect.social) {
    for (const t of targets) {
      if (t.health <= 0 || t.resolved) continue;
      if (effect.social === "yield") resolveYield(cs, t);
      else if (effect.social === "flee") resolveFlee(cs, t);
      else if (effect.social === "demoralize") t.morale = Math.max(0, (t.morale || 0) - 30);
      else if (effect.social === "provoke") {
        addStatus(t, { type: "vulnerable", value: 30, duration: 2 });
        addStatus(t, { type: "rally", value: 15, duration: 2 });
        t.noFleeUntil = cs.turn + 2; t.provoked = true;
      }
    }
  }

  if (effect.player_damage > 0) {
    let dmg = Math.round(effect.player_damage);
    if ((p.invuln || 0) > 0) dmg = 0;                       // invulnerability turns it aside
    else if (p.shield > 0) { const ab = Math.min(p.shield, dmg); p.shield -= ab; dmg -= ab; } // shield soaks first
    p.health = Math.max(0, p.health - dmg);
  }

  for (const e of cs.enemies) if (e.health <= 0) downEnemy(cs, e);
  if (playerDown(cs)) return finishDefeat(cs);
  const firstAlive = cs.enemies.findIndex((e) => e.health > 0 && !e.resolved);
  if (firstAlive >= 0 && (cs.enemies[cs.target]?.health <= 0 || cs.enemies[cs.target]?.resolved)) cs.target = firstAlive;
  return checkCombatEnd(cs);
}

// ----- enemy phase + turn advance -----

function resolveDeckEnemyPhase(cs) {
  // Companions remain autonomous and resolve before the visible enemy plans.
  for (const ally of [...(cs.allies || [])]) {
    if (!canAct(ally)) continue;
    const begun = beginTurnFor(cs, ally, { deckMode: true });
    if (begun !== "ok") continue;
    while ((ally.actionsLeft || 0) > 0) {
      const opponents = liveAttackers(cs);
      if (!opponents.length || !npcPerform(cs, ally, opponents)) break;
    }
    const afterAlly = checkCombatEnd(cs);
    if (TERMINAL_PHASES.has(afterAlly.phase)) return afterAlly;
  }

  // Each enemy executes the exact ability/mode stored before the player acted.
  for (const enemy of [...cs.enemies]) {
    if (!canAct(enemy)) continue;
    routCheck(cs);
    if (!canAct(enemy)) continue;
    const begun = beginTurnFor(cs, enemy, { deckMode: true });
    if (begun === "dead") continue;
    if (begun === "stun" || begun === "charmed") { enemy.intent = null; enemy.intents = []; continue; }
    if (enemy.fleeing) { fleeStep(cs, enemy); continue; }
    if (!moraleCheck(cs, enemy)) continue;

    const intents = enemy.intents?.length ? [...enemy.intents] : (enemy.intent ? [enemy.intent] : []);
    enemy.actionsLeft = intents.length;
    for (const intent of intents) {
      if (!canAct(enemy) || cs.player.health <= 0) break;
      if (hasStatus(enemy, "silence") && intent.abilityId !== BASIC_ATTACK.id) {
        cs.log.push(logEntry(`${enemy.name}'s ${intent.name} is smothered by silence.`, "status"));
        enemy.actionsLeft = Math.max(0, enemy.actionsLeft - 1);
        continue;
      }
      const choice = choiceFromIntent(cs, enemy, intent);
      const opponents = playerSide(cs);
      if (!choice || !opponents.length) break;
      npcPerform(cs, enemy, opponents, { choice, allies: sideAllies(cs, enemy) });
      if (playerDown(cs)) return finishDefeat(cs);
    }
    enemy.intent = null;
    enemy.intents = [];
    const afterEnemy = checkCombatEnd(cs);
    if (TERMINAL_PHASES.has(afterEnemy.phase)) return afterEnemy;
  }

  if (playerDown(cs)) return finishDefeat(cs);
  return checkCombatEnd(cs);
}

// Run one or more enemy phases until the player genuinely has agency again.
// Brief charm skips exactly its remaining turns; a permanent binding cannot
// strand React on an inert `phase: enemy` state.
function advanceDeckUntilPlayer(cs) {
  if (isPlayerPermanentlyControlled(cs)) {
    cs.log.push(logEntry("Your will is bound beyond recall; the battle is lost.", "status"));
    return finishDefeat(cs);
  }
  for (let guard = 0; guard < 2000; guard += 1) {
    const afterEnemy = resolveDeckEnemyPhase(cs);
    if (TERMINAL_PHASES.has(afterEnemy.phase)) return afterEnemy;
    const nextRound = startPlayerDeckRound(cs);
    if (TERMINAL_PHASES.has(nextRound.phase) || nextRound.phase === "player") return nextRound;
    if (isPlayerPermanentlyControlled(nextRound)) {
      nextRound.log.push(logEntry("Your will is bound beyond recall; the battle is lost.", "status"));
      return finishDefeat(nextRound);
    }
    // `phase: enemy` here is the internal controlled-turn sentinel. Its intents
    // were planned by startPlayerDeckRound, so resolve them immediately.
  }
  cs.log.push(logEntry("Your will never returns to the field.", "status"));
  return finishDefeat(cs);
}

// The player has finished their turn (spent their cards or chosen to end it).
// Resolve allies and stored enemy intents, including any player rounds that a
// charm or enthrallment automatically skips.
export function endPlayerTurn(cs0) {
  if (cs0.phase !== "player" || !cs0.deck) return cs0;
  const cs = clone(cs0);
  cs.phase = "enemy";
  discardHand(cs);
  return advanceDeckUntilPlayer(cs);
}

export function endTurn(cs0) {
  if (cs0.phase !== "player") return cs0;
  if (cs0.deck) return endPlayerTurn(cs0);
  const cs = clone(cs0);
  cs.orderIdx = (cs.orderIdx || 0) + 1; // move past the player's slot
  return advanceQueue(cs);
}

export function playerFlee(cs0) {
  if (cs0.phase !== "player" || isPlayerTurnLocked(cs0)) return cs0;
  const cs = clone(cs0);
  const speeds = livingEnemies(cs).map((e) => e.speed || 4);
  const enemySpeed = speeds.length ? Math.max(...speeds) : 1;
  const darkBonus = cs.dark ? DARK_FLEE_BONUS : 0; // melt into the black
  const chance = clamp(45 + darkBonus + (cs.player.speed - enemySpeed) * 6, 15, 90);
  if (rand100() <= chance) {
    cs.phase = "playerFled";
    cs.log.push(logEntry(darkBonus ? `You slip into the dark and are gone.` : `You break away and escape.`, "system"));
    return cs;
  }
  cs.log.push(logEntry(`You fail to escape!`, "system"));
  return endTurn(cs);
}

// Reposition: give ground (open the distance from every foe — the ranged kiting
// lever) or close in. Both cost an action point.
export function playerWithdraw(cs0) {
  if (cs0.phase !== "player" || isPlayerTurnLocked(cs0) || (cs0.player.actionsLeft || 0) < 1) return cs0;
  const cs = clone(cs0);
  cs.player.actionsLeft -= 1;
  for (const e of cs.enemies) if (e.health > 0 && !e.resolved) e.distance = Math.min(MAX_DISTANCE, (e.distance || 0) + 1);
  cs.log.push(logEntry(`${cs.player.name} gives ground, opening the distance.`, "player"));
  return cs;
}
export function playerAdvance(cs0) {
  if (cs0.phase !== "player" || isPlayerTurnLocked(cs0) || (cs0.player.actionsLeft || 0) < 1) return cs0;
  const cs = clone(cs0);
  cs.player.actionsLeft -= 1;
  for (const e of cs.enemies) if (e.health > 0 && !e.resolved) e.distance = Math.max(0, (e.distance || 0) - 1);
  cs.log.push(logEntry(`${cs.player.name} closes in.`, "player"));
  return cs;
}

// Whether the player can choose to stop the fight: no foe is still attacking, but
// some foe yielded or is fleeing (so there's a verdict to give — spare them, or
// let the runners go). Used to gate the Stand Down button.
export function canStandDown(cs) {
  if (!cs || cs.phase !== "player" || isPlayerTurnLocked(cs)) return false;
  if (liveAttackers(cs).length > 0) return false;
  return pendingCaptives(cs).length > 0 || livingEnemies(cs).some((e) => e.fleeing);
}

// Once a fight has dragged into a stalemate (CEASEFIRE_TURN), a thinking foe's
// truce offer stays on the table — the player can break off to a wary DRAW.
export function canCeasefire(cs) {
  return !!(cs && cs.phase === "player" && !isPlayerTurnLocked(cs) && cs.ceasefire);
}
// Take the truce: both sides disengage. Foes still standing give ground (no kill,
// no spoils); a foe that had yielded stays a captive. Ends as a standoff.
export function playerCeasefire(cs0) {
  if (!canCeasefire(cs0)) return cs0;
  const cs = clone(cs0);
  for (const e of cs.enemies) if (e.health > 0 && !e._dead && e.resolved !== "yielded") { e.resolved = "fled"; e.fleeing = false; }
  cs.standoff = true;
  cs.log.push(logEntry(`${cs.player.name} lowers their guard; the foe gives ground in kind. A wary draw — no more blood spent today.`, "system"));
  return finishResolved(cs);
}

// Stand down: end the fight without finishing the broken foes. Foes that yielded
// are spared (kept alive, at the player's mercy / as captives); any still fleeing
// are let go. Refused while a foe is still actively fighting.
export function playerStandDown(cs0) {
  if (!canStandDown(cs0)) return cs0;
  const cs = clone(cs0);
  for (const e of cs.enemies) if (e.fleeing) { e.fleeing = false; e.resolved = "fled"; }
  cs.spared = cs.enemies.some((e) => e.resolved === "yielded" && !e._dead);
  cs.log.push(logEntry(`${cs.player.name} lowers their weapon and stands down.`, "player"));
  return finishResolved(cs);
}

// ----- outcomes + loot -----

// Only actual corpses (lethal kills) carry spoils — yielded/fled/knocked-out
// foes are alive and not auto-looted.
function finishVictory(cs) {
  cs.phase = "victory";
  cs.loot = rollLoot(cs.enemies.filter((e) => e._dead), lootCtx(cs));
  cs.log.push(logEntry(`Victory.`, "system"));
  return cs;
}
function finishResolved(cs) {
  cs.phase = "resolved";
  const yielded = cs.enemies.some((e) => e.resolved === "yielded");
  const ko = cs.enemies.some((e) => e.resolved === "ko");
  cs.loot = rollLoot(cs.enemies.filter((e) => e._dead), lootCtx(cs));
  cs.log.push(logEntry(
    ko ? `The brawl is done — they're down but breathing.` :
    yielded ? `The fight is over — they will trouble you no further.` :
    `The field is yours; the rest have scattered.`, "system"));
  return cs;
}
function finishDefeat(cs) {
  cs.phase = "defeat";
  cs.player.health = 0;
  cs.log.push(logEntry(cs.lethal ? `You fall.` : `You're beaten down and the world goes black.`, "system"));
  return cs;
}

