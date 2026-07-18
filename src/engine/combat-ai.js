// Shared combat AI — picks an action for any non-player combatant (enemy OR
// allied companion), and can also drive the player in the simulation harness.
// The same brain runs both sides, so enemies fight and focus-fire as cannily as
// your companions do. Decision only — execution lives in engine/combat.js.
//
// Heuristics: heal when badly hurt, set up a kill with control/buffs, hit with
// the best affordable option, and FOCUS FIRE — concentrate on the target the
// side can finish (and on dangerous casters), so a group collaborates.

import { getAbilityDef, abilityScaling, BASIC_ATTACK } from "./../data/abilities.js";
import { tierMult, tier as tierInfo } from "./../data/tiers.js";

const sum = (c, type) => (c.statuses || []).filter((s) => s.type === type).reduce((s, x) => s + (x.value || 0), 0);
const has = (c, type) => (c.statuses || []).some((s) => s.type === type);
const FLYING_RANGER_BEASTS = new Set(["hawk", "falcon", "eagle", "owl"]);

function trainedRangerBeastAvailable(party, { flying = false } = {}) {
  return (party || []).some((ally) => {
    if (!ally || ally.health <= 0 || ally._dead || ally.resolved || ally.conscious === false || ally.unconscious) return false;
    if (ally._summoned || ally.summoned === true || ally.magical === true || ally.mundane === false) return false;
    const trained = ally.trained === true || ally.trainedBeast === true || ally.animalCompanion === true || ally.kind === "mount";
    const animal = ally.beast === true || ally.animal === true || ally.mundaneAnimal === true || ally.kind === "mount";
    if (!trained || !animal) return false;
    if (!flying) return true;
    const race = String(ally.race || ally.species || "").toLowerCase();
    return ally.canFly === true || ally.flight === true || ally.flying === true || FLYING_RANGER_BEASTS.has(race);
  });
}

// Rough expected damage of an ability vs a defender (NPC scaling — enough to
// rank targets and abilities; the engine does the exact roll).
export function estimateHit(actor, def, tierId, target) {
  const order = tierInfo(tierId).order;
  const scaling = abilityScaling(def);
  let min, max, type, pen;
  if (scaling === "weapon" || def.damageType === "weapon") {
    const w = actor.weapon || { min: 1, max: 2, type: "physical", pen: 0 };
    const techMult = 1 + order * 0.15;
    const statMod = Math.round(order * 1.5);
    // Authored weapon techniques deliberately trade contact count, reach, and
    // commitment against per-contact force. Keep malformed content bounded so
    // the AI can rank those techniques without inventing unbounded damage.
    const authoredMult = Math.max(0.1, Math.min(3, Number(def.damageMult ?? 1) || 1));
    min = Math.round((w.min * techMult + statMod) * authoredMult);
    max = Math.round((w.max * techMult + statMod) * authoredMult);
    type = def.damageType && def.damageType !== "weapon" ? def.damageType : w.type;
    pen = (w.pen || 0) + (def.pen || 0);
  } else if (["stat", "performance", "fieldcraft"].includes(scaling) && def.dmg) {
    const m = tierMult(tierId);
    min = Math.round(def.dmg[0] * m);
    max = Math.round(def.dmg[1] * m);
    type = def.damageType;
    pen = def.pen || 0;
  } else {
    return 0;
  }
  const avg = (min + max) / 2;
  let mitig = 0;
  if (type === "physical") mitig = Math.max(0, (target.armor || 0) - (pen || 0));
  else if (type === "magical") mitig = Math.max(0, (target.ward || 0) - (pen || 0));
  else if (type === "sonic") {
    const guard = Math.max(0, Number(target.sonicGuard || 0) + Math.round((target.armor || 0) * 0.25));
    const fracture = Math.max(0, Math.min(50, sum(target, "bardSonicFracture") + sum(target, "bardHarmonicWeave"))) / 100;
    const acousticMitigation = Math.max(0, Math.round(guard) - (pen || 0));
    mitig = target.sonicImmune
      ? avg
      : Math.round(Math.min(Math.max(0, Math.round(avg * 0.85)), acousticMitigation) * (1 - fracture));
  }
  const perHit = Math.max(0, avg * (1 + sum(actor, "rally") / 100) - mitig);
  return perHit * (def.hits || 1);
}

function threatOf(c) {
  return (c.weapon?.max || 0) + (c.maxHealth || 0) * 0.15 + (c.critChance || 0) * 0.05 + (c.abilities?.length || 0) * 1.5;
}

// Pick whom to hit: prefer a target this attacker can KILL outright (finish
// dangerous ones first), else weight low health (focus fire) + high threat.
export function pickTarget(actor, opponents, bestHit) {
  let best = null, bestScore = -Infinity;
  for (const o of opponents) {
    const killable = bestHit >= o.health;
    // lower health → higher score (focus fire); add threat; big bonus if killable.
    let score = -o.health * 1.2 + threatOf(o) * 0.8;
    if (killable) score += 1000 + threatOf(o); // finish kills, dangerous first
    if (has(o, "vulnerable")) score += 8; // pile onto a softened target
    if (score > bestScore) { bestScore = score; best = o; }
  }
  return best;
}

// candidates: [{ id, tier, def }] already filtered to USABLE by the caller
// (cooldowns; plus resolve/weaponReq for the player). Returns a chosen
// action: { ability:{id,tier}, def, mode:"self"|"aoe"|"single", target }.
export function chooseAction(actor, opponents, candidates, opts = {}) {
  const living = opponents.filter((o) => o.health > 0 && !o.resolved && !o._dead);
  if (living.length === 0) return null;
  const actorKey = actor.uid || actor.id || actor.name || "actor";
  const hasOwnedRogueOpening = (target) => (target.statuses || []).some((status) =>
    status.type === "rogueOpening" && status.sourceUid === actorKey);
  const hasOwnedPactStatus = (target, type) => (target.statuses || []).some((status) =>
    status.type === type && status.sourceUid === actorKey);
  const canReceivePactTerms = (target) => target && target.health > 0 && !target._dead && !target.resolved
    && target.conscious !== false && !target.unconscious && target.aware !== false
    && target.canHear !== false && target.hearing !== false && !target.deaf
    && target.demeanor !== "mindless" && target.canUnderstand !== false
    && target.understandsSpeech !== false && target.languageUnderstanding !== false;
  // An Opportunity exploit is not merely low priority without its source-owned
  // setup; it is unavailable. Filtering here keeps direct AI planning and the
  // runtime candidate gate on the same contract.
  candidates = candidates.filter((candidate) => !(
    candidate.def.professionId === "rogue" && candidate.def.school === "subterfuge"
    && candidate.def.rogueRequiresOpening && !living.some(hasOwnedRogueOpening)
  ));
  candidates = candidates.filter((candidate) => !(
    candidate.def.professionId === "paladin" && candidate.def.school === "oathcraft"
    && (candidate.def.paladinConvictionCost || 0) > Math.max(0, Math.min(5, Math.floor(actor.paladinConviction || 0)))
  ));
  const warlockFavor = Math.max(0, Math.min(5, Math.floor(actor.warlockFavor || 0)));
  candidates = candidates.filter((candidate) => {
    const def = candidate.def;
    if (def.professionId !== "warlock" || def.school !== "pactcraft") return true;
    if ((def.warlockFavorCost || 0) > warlockFavor) return false;
    if (def.warlockRequiresOwnDebtMark && !living.some((target) => hasOwnedPactStatus(target, "warlockDebtMark"))) return false;
    if (def.warlockRequiresOwnHellfireCovenant
        && !living.some((target) => hasOwnedPactStatus(target, "warlockHellfireCovenant"))) return false;
    if ((def.audible || def.requiresAwareness || def.requiresUnderstanding)
        && !living.some(canReceivePactTerms)) return false;
    if (def.warlockPactPrice?.type === "health") {
      const ratio = Math.max(0.01, Math.min(0.2, Number(def.warlockPactPrice.maxHealth || 0)));
      const cap = Math.max(0.01, Math.min(0.2, Number(def.warlockPactPrice.cap ?? ratio)));
      const price = Math.max(1, Math.min(Math.round(Math.max(1, actor.maxHealth || actor.health || 1) * ratio), Math.round(Math.max(1, actor.maxHealth || actor.health || 1) * cap)));
      if (def.warlockPactPrice.nonlethal ? actor.health <= price : actor.health < price) return false;
    }
    return true;
  });
  const artificerCharges = Math.max(0, Math.min(5, Math.floor(actor.artificerDeviceCharges || 0)));
  candidates = candidates.filter((candidate) => candidate.def.professionId !== "artificer"
    || candidate.def.school !== "devicecraft"
    || (candidate.def.artificerChargeCost || 0) <= artificerCharges);
  const hpFrac = actor.health / Math.max(1, actor.maxHealth);
  const damaging = candidates.filter((c) => {
    const scaling = abilityScaling(c.def);
    return scaling === "weapon" || (["stat", "performance", "fieldcraft"].includes(scaling) && !!c.def.dmg) || c.def.damageType === "weapon";
  });

  // Best single-target hit available (for kill detection + target choice).
  const basic = { id: BASIC_ATTACK.id, tier: "common", def: BASIC_ATTACK };
  const singleHitters = [...damaging.filter((c) => c.def.target !== "all-enemies"), basic];
  let bestSingle = basic, bestSingleDmg = 0;
  // Provisional target by lowest health to gauge the best hitter.
  const provisional = living.reduce((a, b) => (b.health < a.health ? b : a), living[0]);
  for (const c of singleHitters) {
    const d = estimateHit(actor, c.def, c.tier, provisional);
    if (d > bestSingleDmg) { bestSingleDmg = d; bestSingle = c; }
  }
  const target = pickTarget(actor, living, bestSingleDmg) || provisional;

  // 1) Unbreakable Will (BKB): pop debuff-immunity + invuln when disabled (stunned/
  // cursed/silenced) or about to die — the answer to an alpha strike or a curse-lock.
  const bkb = candidates.find((c) => c.def.target === "self" && c.def.effect?.type === "unstoppable");
  if (bkb && (actor.invuln || 0) <= 0 && !has(actor, "unstoppable") &&
      (has(actor, "curse") || has(actor, "stun") || has(actor, "silence") || hpFrac < 0.5)) {
    return { ability: bkb, def: bkb.def, mode: "self", target: null };
  }

  // 1) Heal when badly hurt and a self-regen is ready.
  const heal = candidates.find((c) => c.def.target === "self" && c.def.effect?.type === "regen");
  if (heal && hpFrac < 0.35) return { ability: heal, def: heal.def, mode: "self", target: null };

  // 1b) Defensive cover when hurt: a shield, ward-shield, or brief invulnerability.
  const cover = candidates.find((c) => c.def.target === "self" && ["shield", "magicShield", "invuln"].includes(c.def.effect?.type));
  if (cover && hpFrac < 0.45 && !(cover.def.effect.type === "invuln" && (actor.invuln || 0) > 0) && Math.random() < 0.5) {
    return { ability: cover, def: cover.def, mode: "self", target: null };
  }

  // 1c) PARTY SUPPORT (a healer/support's role): heal/shield/rally the whole side,
  // or spend the costly invulnerability when an ally is about to die. Gated on the
  // actual party state passed in opts.allies.
  const party = (opts.allies && opts.allies.length) ? opts.allies : [actor];
  const woundedAllies = party.filter((a) => a.health > 0 && a.health / Math.max(1, a.maxHealth) < 0.55);
  const direAlly = party.some((a) => a.health > 0 && a.health / Math.max(1, a.maxHealth) < 0.3);
  const partyOf = (type) => candidates.find((c) => c.def.target === "all-allies" && (Array.isArray(type) ? type.includes(c.def.effect?.type) : c.def.effect?.type === type));
  const partyInvuln = partyOf("invuln"), partyHeal = partyOf("regen"), partyShield = partyOf(["shield", "magicShield"]), partyRally = partyOf("rally");
  const warCry = partyOf("barbarianWarCry");
  if (partyInvuln && direAlly) return { ability: partyInvuln, def: partyInvuln.def, mode: "all-allies", target: null };
  if (partyHeal && woundedAllies.length >= 2) return { ability: partyHeal, def: partyHeal.def, mode: "all-allies", target: null };
  if (partyShield && woundedAllies.length >= 1 && Math.random() < 0.6) return { ability: partyShield, def: partyShield.def, mode: "all-allies", target: null };
  const needsWarCry = party.some((ally) => ally.health > 0 && !ally._dead && !ally.resolved
    && ally.conscious !== false && ally.hearing !== false && !has(ally, "deaf") && !has(ally, "unconscious")
    && ((Number.isFinite(Number(ally.morale)) && Number.isFinite(Number(ally.moraleMax)) && ally.morale < ally.moraleMax)
      || !has(ally, "barbarianWarCry")));
  if (warCry && needsWarCry) return { ability: warCry, def: warCry.def, mode: "all-allies", target: null };
  const bardSupportTypes = new Set([
    "bardSteadyBeat", "bardRisingTempo", "bardCallResponse", "bardHearteningChorus",
    "bardWarDrum", "bardLoreCallout", "bardMarchingCadence", "bardDefiantAnthem",
    "bardOldBallad", "bardBattleChronicle",
  ]);
  const bardSupport = candidates.find((candidate) => candidate.def.target === "all-allies"
    && bardSupportTypes.has(candidate.def.effect?.type));
  const needsBardSupport = bardSupport && party.some((ally) => ally.health > 0 && !ally._dead && !ally.resolved
    && ally.conscious !== false && ally.canHear !== false && ally.hearing !== false && !ally.deaf
    && ally.demeanor !== "mindless" && !has(ally, bardSupport.def.effect.type));
  if (needsBardSupport) return { ability: bardSupport, def: bardSupport.def, mode: "all-allies", target: null };
  const fieldDressing = candidates.find((candidate) => candidate.def.effect?.type === "rangerFieldDressing");
  const needsFieldDressing = fieldDressing && party.some((ally) => ally.health > 0 && !ally._dead && !ally.resolved
    && ((ally.statuses || []).some((status) => status.type === "bleed")
      || (Number.isFinite(Number(ally.morale)) && Number.isFinite(Number(ally.moraleMax)) && ally.morale < ally.moraleMax * 0.6)));
  if (needsFieldDressing) return { ability: fieldDressing, def: fieldDressing.def, mode: "all-allies", target: null };
  if (partyRally && hpFrac > 0.5 && !has(actor, "rally") && Math.random() < 0.4) return { ability: partyRally, def: partyRally.def, mode: "all-allies", target: null };

  // Warlock pactcraft has a closed price-and-collection loop. Spend already
  // earned Favor before taking another price, then deliberately establish a
  // paid builder while below the cap. Requirements remain source-owned and
  // semantic; the execution layer revalidates the chosen target.
  const warlockEligible = (candidate) => candidate.def.professionId === "warlock"
    && candidate.def.school === "pactcraft";
  const pactTargetFor = (candidate) => {
    if (candidate.def.warlockRequiresOwnDebtMark) {
      return living.find((foe) => hasOwnedPactStatus(foe, "warlockDebtMark")) || null;
    }
    if (candidate.def.warlockRequiresOwnHellfireCovenant) {
      return living.find((foe) => hasOwnedPactStatus(foe, "warlockHellfireCovenant")) || null;
    }
    if (candidate.def.audible || candidate.def.requiresAwareness || candidate.def.requiresUnderstanding) {
      return living.find(canReceivePactTerms) || null;
    }
    return target;
  };
  const pactSpenders = candidates.filter((candidate) => warlockEligible(candidate)
    && (candidate.def.warlockFavorCost || 0) > 0
    && (candidate.def.warlockFavorCost || 0) <= warlockFavor);
  if (pactSpenders.length) {
    const chosen = pactSpenders.reduce((best, candidate) => {
      const candidateTarget = pactTargetFor(candidate) || target;
      const bestTarget = pactTargetFor(best) || target;
      const score = estimateHit(actor, candidate.def, candidate.tier, candidateTarget)
        + (candidate.def.warlockFavorCost || 0) * 3
        + Object.values(candidate.def.effect || {}).filter((value) => typeof value === "number")
          .reduce((total, value) => total + Math.abs(value), 0) * 0.08;
      const bestScore = estimateHit(actor, best.def, best.tier, bestTarget)
        + (best.def.warlockFavorCost || 0) * 3
        + Object.values(best.def.effect || {}).filter((value) => typeof value === "number")
          .reduce((total, value) => total + Math.abs(value), 0) * 0.08;
      return score > bestScore ? candidate : best;
    });
    const chosenTarget = pactTargetFor(chosen);
    return {
      ability: chosen,
      def: chosen.def,
      mode: chosen.def.target === "all-enemies" ? "aoe" : chosen.def.target === "all-allies" ? "all-allies" : chosen.def.target === "self" ? "self" : "single",
      target: chosen.def.target === "enemy" ? chosenTarget : null,
    };
  }
  const pactBuilders = candidates.filter((candidate) => warlockEligible(candidate)
    && !!candidate.def.warlockPactPrice && (candidate.def.warlockFavorBuild || 0) > 0);
  const safePactBuilders = pactBuilders.filter((candidate) => {
    if (candidate.def.warlockPactPrice.type !== "health") return true;
    const ratio = Number(candidate.def.warlockPactPrice.maxHealth || 0);
    return actor.health - Math.max(1, Math.round(Math.max(1, actor.maxHealth || 1) * ratio))
      > Math.max(1, Math.round(Math.max(1, actor.maxHealth || 1) * 0.15));
  });
  if (warlockFavor < 5 && safePactBuilders.length) {
    const chosen = safePactBuilders.reduce((best, candidate) =>
      estimateHit(actor, candidate.def, candidate.tier, pactTargetFor(candidate) || target)
        > estimateHit(actor, best.def, best.tier, pactTargetFor(best) || target) ? candidate : best);
    return {
      ability: chosen,
      def: chosen.def,
      mode: chosen.def.target === "all-enemies" ? "aoe" : chosen.def.target === "all-allies" ? "all-allies" : chosen.def.target === "self" ? "self" : "single",
      target: chosen.def.target === "enemy" ? pactTargetFor(chosen) : null,
    };
  }

  // Artificer devicecraft is a prepared reserve rather than Resolve casting.
  // Refit when nearly empty; otherwise deliberately spend a feasible device
  // Charge once for the whole action. The execution layer revalidates the cost.
  const artificerEligible = (candidate) => candidate.def.professionId === "artificer"
    && candidate.def.school === "devicecraft";
  const fieldRefit = candidates.find((candidate) => artificerEligible(candidate) && candidate.def.artificerRefit);
  if (artificerCharges <= 1 && fieldRefit) {
    return { ability: fieldRefit, def: fieldRefit.def, mode: "self", target: null };
  }
  const preparedDevices = candidates.filter((candidate) => artificerEligible(candidate)
    && (candidate.def.artificerChargeCost || 0) > 0
    && (candidate.def.artificerChargeCost || 0) <= artificerCharges);
  if (preparedDevices.length) {
    const effectMagnitude = (candidate) => Object.entries(candidate.def.effect || {})
      .filter(([key, value]) => typeof value === "number" && !["duration", "cap", "bossScale"].includes(key))
      .reduce((total, [, value]) => total + Math.abs(value), 0);
    const chosen = preparedDevices.reduce((best, candidate) => {
      const score = estimateHit(actor, candidate.def, candidate.tier, target)
        + effectMagnitude(candidate) * 0.1 + (candidate.def.artificerChargeCost || 0);
      const bestScore = estimateHit(actor, best.def, best.tier, target)
        + effectMagnitude(best) * 0.1 + (best.def.artificerChargeCost || 0);
      return score > bestScore ? candidate : best;
    });
    return {
      ability: chosen,
      def: chosen.def,
      mode: chosen.def.target === "all-enemies" ? "aoe" : chosen.def.target === "all-allies" ? "all-allies" : chosen.def.target === "self" ? "self" : "single",
      target: chosen.def.target === "enemy" ? target : null,
    };
  }

  // A Druid plans around the season already turning inside this fight. Urgent
  // survival/support decisions above still win, but otherwise a current-season
  // Primal Art is deliberately preferred so the bounded surge is not discarded.
  const druidSeason = ["spring", "summer", "autumn", "winter"].includes(String(actor.druidSeason || "spring").toLowerCase())
    ? String(actor.druidSeason || "spring").toLowerCase()
    : "spring";
  const seasonalDruid = candidates.filter((candidate) => candidate.def.professionId === "druid"
    && candidate.def.school === "primalcraft" && candidate.def.druidSeason === druidSeason);
  if (seasonalDruid.length) {
    const effectMagnitude = (candidate) => Object.entries(candidate.def.effect || {})
      .filter(([key, value]) => typeof value === "number" && !["duration", "cap", "healthCap", "resolveCap", "bossScale"].includes(key))
      .reduce((total, [, value]) => total + Math.abs(value), 0);
    const chosen = seasonalDruid.reduce((best, candidate) => {
      const score = estimateHit(actor, candidate.def, candidate.tier, target) + effectMagnitude(candidate) * 0.1;
      const bestScore = estimateHit(actor, best.def, best.tier, target) + effectMagnitude(best) * 0.1;
      return score > bestScore ? candidate : best;
    });
    return {
      ability: chosen,
      def: chosen.def,
      mode: chosen.def.target === "all-enemies" ? "aoe" : chosen.def.target === "all-allies" ? "all-allies" : chosen.def.target === "self" ? "self" : "single",
      target: chosen.def.target === "enemy" ? target : null,
    };
  }

  // A Paladin first establishes a witnessed Oathguard over an exposed ally.
  // Conviction is never granted by choosing this card; it is earned later only
  // if real hostile damage is redirected or Stand Fast actually absorbs a hit.
  const paladinEligible = (candidate) => candidate.def.professionId === "paladin"
    && candidate.def.school === "oathcraft";
  const guardEffects = new Set([
    "paladinOathguard", "paladinBearTheBlow", "paladinLastWitness", "paladinOathIncarnate",
    "paladinShieldCovenant", "paladinRampartExchange", "paladinRedeemingIntercession", "paladinPilgrimAegis",
  ]);
  const exposedAlly = party.find((ally) => ally !== actor && ally.health > 0 && !ally._dead && !ally.resolved
    && !(ally.statuses || []).some((status) => status.type === "paladinOathguard" && status.sourceUid === actorKey));
  const oathguard = candidates.find((candidate) => paladinEligible(candidate)
    && guardEffects.has(candidate.def.effect?.type) && (candidate.def.paladinConvictionCost || 0) === 0);
  if (exposedAlly && oathguard) {
    return { ability: oathguard, def: oathguard.def, mode: "all-allies", target: null };
  }
  const conviction = Math.max(0, Math.min(5, Math.floor(actor.paladinConviction || 0)));
  const oathSpenders = candidates.filter((candidate) => paladinEligible(candidate)
    && (candidate.def.paladinConvictionCost || 0) > 0
    && (candidate.def.paladinConvictionCost || 0) <= conviction);
  if (oathSpenders.length) {
    const offensive = oathSpenders.filter((candidate) => candidate.def.target === "enemy");
    const chosen = (offensive.length ? offensive : oathSpenders).reduce((best, candidate) => {
      const score = estimateHit(actor, candidate.def, candidate.tier, target)
        + (candidate.def.paladinConvictionCost || 0) * 2 + (candidate.def.effect?.value || 0) * 0.2;
      const bestScore = estimateHit(actor, best.def, best.tier, target)
        + (best.def.paladinConvictionCost || 0) * 2 + (best.def.effect?.value || 0) * 0.2;
      return score > bestScore ? candidate : best;
    });
    return {
      ability: chosen,
      def: chosen.def,
      mode: chosen.def.target === "all-allies" ? "all-allies" : chosen.def.target === "self" ? "self" : "single",
      target: chosen.def.target === "enemy" ? target : null,
    };
  }
  const standFast = candidates.find((candidate) => paladinEligible(candidate)
    && candidate.def.effect?.type === "paladinStandFast");
  if (standFast && conviction < 5 && !has(actor, "paladinStandFast") && hpFrac > 0.35) {
    return { ability: standFast, def: standFast.def, mode: "self", target: null };
  }

  // Rogue subterfuge deliberately alternates setup and exploitation. The
  // opening remains on the target and records its creator, so multiple Rogues
  // can reason about the same foe without stealing one another's opportunity.
  const rogueEligible = (candidate) => candidate.def.professionId === "rogue"
    && candidate.def.school === "subterfuge";
  const rogueOpeningTargets = living.filter(hasOwnedRogueOpening);
  const rogueExploits = candidates.filter((candidate) => rogueEligible(candidate)
    && candidate.def.rogueOpeningExploit && rogueOpeningTargets.length > 0);
  if (rogueExploits.length) {
    const exploitTarget = pickTarget(actor, rogueOpeningTargets, bestSingleDmg) || rogueOpeningTargets[0];
    const chosen = rogueExploits.reduce((best, candidate) => {
      const score = estimateHit(actor, candidate.def, candidate.tier, exploitTarget)
        + (candidate.def.effect?.value || 0) * 0.25;
      const bestScore = estimateHit(actor, best.def, best.tier, exploitTarget)
        + (best.def.effect?.value || 0) * 0.25;
      return score > bestScore ? candidate : best;
    });
    return { ability: chosen, def: chosen.def, mode: "single", target: exploitTarget };
  }
  const rogueBuilders = candidates.filter((candidate) => rogueEligible(candidate)
    && candidate.def.rogueOpeningBuild);
  if (rogueBuilders.length && rogueOpeningTargets.length === 0) {
    const chosen = rogueBuilders.find((candidate) => candidate.id === "rogue-assess-mark")
      || rogueBuilders.find((candidate) => candidate.id === "rogue-testing-cut")
      || rogueBuilders[0];
    return { ability: chosen, def: chosen.def, mode: "single", target };
  }

  // Ranger fieldcraft is deliberate information play. Establish a visible
  // quarry before ordinary damage, then cash only affordable Insight into that
  // exact living target. Animal routes enter this ranking only when their
  // already-present trained partner is actually available.
  const quarry = living.find((foe) => foe.uid === actor.rangerQuarryUid) || null;
  const insight = Math.max(0, Math.min(5, Math.floor(actor.rangerQuarryInsight || 0)));
  const rangerEligible = (candidate) => {
    if (candidate.def.school !== "fieldcraft" || candidate.def.professionId !== "ranger") return false;
    if (candidate.def.requiresFlyingBeastAlly && !trainedRangerBeastAvailable(party, { flying: true })) return false;
    if (candidate.def.requiresTrainedBeastAlly && !trainedRangerBeastAvailable(party)) return false;
    return true;
  };
  const rangerSpenders = candidates.filter((candidate) => rangerEligible(candidate)
    && (candidate.def.rangerQuarryInsightCost || 0) > 0
    && (candidate.def.rangerQuarryInsightCost || 0) <= insight && quarry);
  if (rangerSpenders.length) {
    const chosen = rangerSpenders.reduce((best, candidate) => {
      const score = estimateHit(actor, candidate.def, candidate.tier, quarry)
        + (candidate.def.effect?.value || 0) * 0.3 + (candidate.def.rangerQuarryInsightCost || 0) * 3;
      const bestScore = estimateHit(actor, best.def, best.tier, quarry)
        + (best.def.effect?.value || 0) * 0.3 + (best.def.rangerQuarryInsightCost || 0) * 3;
      return score > bestScore ? candidate : best;
    });
    return {
      ability: chosen,
      def: chosen.def,
      mode: chosen.def.target === "all-enemies" ? "aoe" : chosen.def.target === "all-allies" ? "all-allies" : "single",
      target: chosen.def.target === "enemy" ? quarry : null,
    };
  }
  const rangerBuilders = candidates.filter((candidate) => rangerEligible(candidate)
    && (candidate.def.rangerQuarryInsightBuild || 0) > 0);
  if (rangerBuilders.length && (!quarry || insight < 5)) {
    const chosen = rangerBuilders.find((candidate) => candidate.id === "ranger-quarry-sign") || rangerBuilders[0];
    return { ability: chosen, def: chosen.def, mode: "single", target };
  }

  // Barbarian self-side tactics. Bait is the one native deliberate Fury
  // builder and is only worthwhile while healthy enough to accept its exposed
  // guard. Defensive braces and Abandon are spenders, so affordability has
  // already been enforced by the caller's candidate filter.
  const bait = candidates.find((c) => c.def.effect?.type === "barbarianBaitBlow");
  if (bait && (actor.barbarianFury || 0) < 2 && hpFrac > 0.4 && !has(actor, "barbarianExposedGuard")) {
    return { ability: bait, def: bait.def, mode: "self", target: null };
  }
  const brace = candidates.find((c) => ["barbarianGritThrough", "barbarianMountainFrame"].includes(c.def.effect?.type));
  if (brace && hpFrac < 0.5 && !has(actor, brace.def.effect.type)) {
    return { ability: brace, def: brace.def, mode: "self", target: null };
  }
  const abandon = candidates.find((c) => c.def.effect?.type === "barbarianAbandon");
  if (abandon && hpFrac < 0.7 && !has(actor, "barbarianAbandon") && !has(actor, "barbarianExposedGuard")) {
    return { ability: abandon, def: abandon.def, mode: "self", target: null };
  }

  // Audible Clan Champion pressure is tactical, not compulsory targeting. Use
  // the group call for a real crowd and the personal challenge for one fresh,
  // aware opponent; the runtime independently rejects mindless/deaf targets.
  const foeCaller = candidates.find((c) => c.def.effect?.type === "barbarianFoeCaller");
  if (foeCaller && living.length >= 2 && living.some((foe) => !has(foe, "barbarianFoeCalled"))) {
    return { ability: foeCaller, def: foeCaller.def, mode: "aoe", target: null };
  }
  const challenge = candidates.find((c) => c.def.effect?.type === "barbarianChallenge");
  if (challenge && !has(target, "barbarianChallenged")) {
    return { ability: challenge, def: challenge.def, mode: "single", target };
  }

  const bardPressureTypes = new Set([
    "bardCuttingVerse", "bardDissonance", "bardStingingRefrain", "bardSyncopation",
    "bardCounterMelody", "bardPointedSatire", "bardHecklersHook", "bardChorusScorn",
    "bardSonicFracture", "bardHarmonicWeave", "bardGrandFinale",
  ]);
  const bardPressure = candidates.find((candidate) => candidate.def.effect?.target === "enemy"
    && bardPressureTypes.has(candidate.def.effect?.type)
    && !has(target, candidate.def.effect.type));
  if (bardPressure) {
    return {
      ability: bardPressure,
      def: bardPressure.def,
      mode: bardPressure.def.target === "all-enemies" ? "aoe" : "single",
      target: bardPressure.def.target === "all-enemies" ? null : target,
    };
  }

  // 2) Control a dangerous, uncontrolled target (set up the kill).
  const control = candidates.find((c) =>
    c.def.effect && c.def.effect.target === "enemy" &&
    ["stun", "weaken", "vulnerable", "chill", "curse", "charmed", "dominated"].includes(c.def.effect.type) && c.def.target !== "all-enemies");
  if (control && !has(target, "stun") && !has(target, "vulnerable") && !has(target, control.def.effect.type) && living.length >= 1 && Math.random() < 0.6) {
    return { ability: control, def: control.def, mode: "single", target };
  }

  // 3) Self-buff occasionally when healthy (rally/focus); grab an extra action.
  const buff = candidates.find((c) => c.def.target === "self" && ["rally", "focus", "guard"].includes(c.def.effect?.type));
  if (buff && hpFrac > 0.5 && !has(actor, buff.def.effect.type) && Math.random() < 0.3) {
    return { ability: buff, def: buff.def, mode: "self", target: null };
  }
  const haste = candidates.find((c) => c.def.effect?.type === "bonusAction");
  if (haste && hpFrac > 0.4 && (actor.actionsLeft || 1) <= 1 && Math.random() < 0.4) {
    return { ability: haste, def: haste.def, mode: "self", target: null };
  }

  // 4) AoE when it hits 2+ and roughly matches single-target value.
  const aoe = damaging.filter((c) => c.def.target === "all-enemies");
  if (living.length >= 2 && aoe.length) {
    const best = aoe.reduce((a, b) =>
      estimateHit(actor, b.def, b.tier, target) > estimateHit(actor, a.def, a.tier, target) ? b : a);
    if (estimateHit(actor, best.def, best.tier, target) * living.length >= bestSingleDmg) {
      return { ability: best, def: best.def, mode: "aoe", target: null };
    }
  }

  // 5) Best single-target damage (or basic attack).
  return { ability: bestSingle, def: bestSingle.def, mode: "single", target };
}
