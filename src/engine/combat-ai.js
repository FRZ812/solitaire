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
    min = Math.round(w.min * techMult) + statMod;
    max = Math.round(w.max * techMult) + statMod;
    type = def.damageType && def.damageType !== "weapon" ? def.damageType : w.type;
    pen = (w.pen || 0) + (def.pen || 0);
  } else if (scaling === "stat" && def.dmg) {
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
  const hpFrac = actor.health / Math.max(1, actor.maxHealth);
  const damaging = candidates.filter((c) => c.def.dmg || c.def.damageType === "weapon");

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
  if (partyInvuln && direAlly) return { ability: partyInvuln, def: partyInvuln.def, mode: "all-allies", target: null };
  if (partyHeal && woundedAllies.length >= 2) return { ability: partyHeal, def: partyHeal.def, mode: "all-allies", target: null };
  if (partyShield && woundedAllies.length >= 1 && Math.random() < 0.6) return { ability: partyShield, def: partyShield.def, mode: "all-allies", target: null };
  if (partyRally && hpFrac > 0.5 && !has(actor, "rally") && Math.random() < 0.4) return { ability: partyRally, def: partyRally.def, mode: "all-allies", target: null };

  // 2) Control a dangerous, uncontrolled target (set up the kill).
  const control = candidates.find((c) =>
    c.def.effect && c.def.effect.target === "enemy" &&
    ["stun", "weaken", "vulnerable", "chill", "curse"].includes(c.def.effect.type) && c.def.target !== "all-enemies");
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
