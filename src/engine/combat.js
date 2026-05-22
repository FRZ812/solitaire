// The turn-based combat engine. Pure-ish: every exported action takes a combat
// state and returns a NEW one (deep-cloned), so React can drive the UI by
// swapping state. Resolution is client-side and fast — light RNG (damage
// ranges, %-based dodge/crit), no d20s.
//
// Damage pipeline for one hit:
//   dodge check → roll base damage → rally/weaken → crit → vulnerable
//   → mitigate (physical:armor, magical:ward, true:none, minus penetration)
// Status effects: bleed/poison (true damage-over-time), stun (skip a turn),
// weaken (−outgoing), vulnerable (+incoming), guard (+armour), rally
// (+outgoing), regen (heal-over-time), focus (+crit, consumed on next hit).
//
// Foes are not stat sheets: each carries a demeanor + morale (see
// data/combat-flavor.js). As a fight turns against them — wounds, fallen
// allies, being stun-locked or out-classed — they may waver, plead, demand a
// fair fight, flee, or yield. The player can also Demand Surrender (parley).

import { getAbilityDef, attrFactor, abilityScaling, abilityRequiredStat, BASIC_ATTACK, DEFEND, TALK, randomAbilityId } from "../data/abilities.js";
import { tierMult, rollTier, tierLabel, tier as tierInfo } from "../data/tiers.js";
import { DEMEANOR_CONFIG, flavorLine } from "../data/combat-flavor.js";
import { ITEM_DROP_CHANCE, ABILITY_DROP_CHANCE, UNIQUE_DROP_CHANCE } from "../data/balance.js";
import { rollUniques } from "../data/uniques.js";
import { rollItemPassives } from "../data/passives.js";
import { effectiveAttributes, ratingFromXp, proficiencyName, weaponMasteryId, XP } from "../data/proficiencies.js";
import { ATTR_KEYS, ATTR_LABELS } from "../config.js";
import { deriveCombatStats, reqEffectiveness } from "./combat-stats.js";
import { chooseAction } from "./combat-ai.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const rand100 = () => Math.random() * 100;
const clone = (x) => JSON.parse(JSON.stringify(x));
let LOG_SEQ = 0;
const logEntry = (text, kind = "system") => ({ id: `l${Date.now()}-${LOG_SEQ++}`, text, kind });

const CONTROL_TYPES = new Set(["stun", "weaken", "vulnerable"]);
const ALLY_LOSS = { cowardly: 22, wary: 14, fierce: 8, brutish: 10, honorable: 10, feral: 8, fanatic: 0, mindless: 0 };

function sumStatus(c, type) {
  return (c.statuses || []).filter((s) => s.type === type).reduce((s, x) => s + (x.value || 0), 0);
}
function hasStatus(c, type) { return (c.statuses || []).some((s) => s.type === type); }
function addStatus(c, effect) {
  if (!effect) return;
  c.statuses = c.statuses || [];
  c.statuses.push({ type: effect.type, value: effect.value || 0, duration: effect.duration || 1 });
}
const livingEnemies = (cs) => cs.enemies.filter((e) => e.health > 0 && !e.resolved);
const livingAllies = (cs) => (cs.allies || []).filter((a) => a.health > 0 && !a.resolved && !a._dead);
// The player's side as a target list for enemies: the player plus living allies.
const playerSide = (cs) => [cs.player, ...livingAllies(cs)].filter((c) => c.health > 0);
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

export function initCombat(character, codex, enemies, opts = {}) {
  LOG_SEQ = 0;
  const cs = deriveCombatStats(character, codex);
  const learned = Array.isArray(character.abilities) ? character.abilities : [];
  const abilities = [
    { id: BASIC_ATTACK.id, tier: "common" },
    { id: DEFEND.id, tier: "common" },
    { id: TALK.id, tier: "common" },
    ...learned.map((e) => (typeof e === "string" ? { id: e, tier: "common" } : { id: e.id, tier: e.tier || "common" })),
  ].filter((a) => getAbilityDef(a.id));

  const player = {
    name: character.name || "You",
    health: Math.round(character.vitality),
    maxHealth: cs.maxHealth,
    stamina: cs.maxStamina,
    maxStamina: cs.maxStamina,
    staminaRegen: cs.staminaRegen,
    resolve: Math.round(character.resolve ?? 0),
    resolveMax: character.resolveMax ?? 0,
    armor: cs.armor, ward: cs.ward, dodge: cs.dodge,
    accuracy: cs.accuracy, critChance: cs.critChance, critMult: cs.critMult,
    weapon: cs.weapon, speed: cs.speed,
    triggers: cs.triggers || {},
    prof: cs.prof || {},
    attrs: cs.attrs || { ...character.attributes },
    abilities, cooldowns: {}, statuses: [], side: "player",
  };

  // Allied companions fight at the player's side, AI-driven (engine/combat-ai).
  // They're built by the caller (allyFromCompanion) into the same combatant shape.
  const allies = (opts.allies || []).map((a) => ({ ...clone(a), side: "player", statuses: a.statuses || [], cooldowns: a.cooldowns || {} }));

  const foes = clone(enemies);
  for (const e of foes) e.side = "enemy";
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
    turn: 1,
    phase: "player",
    powerRatio,
    lethal,
    escalated: false,
    maxLootTier: opts.maxLootTier || null,
    region: opts.region || 1,
    ownedUniques: opts.ownedUniques || [],
    coinBonus: opts.coinBonus || 0,
    environment: opts.environment || [],
    revivedUsed: false,
    profGains: {},
    log: [logEntry(lethal ? `Combat begins — ${flavor}.` : `A brawl breaks out — ${flavor}. Bare hands, for now.`, "system")],
    loot: null,
  };
  if (opts.ambush) applyAmbush(combatState, opts.ambush);
  return combatState;
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
      : "Steel is drawn — the brawl turns to a killing matter.", "system"));
}

// Draw steel mid-brawl — escalates to a lethal fight (you and any armed foes
// switch to real weapons; the aftermath gets far worse).
export function playerDrawWeapon(cs0) {
  if (cs0.phase !== "player" || cs0.lethal) return cs0;
  if (!cs0.player.stowedWeapon || cs0.player.stowedWeapon.category === "unarmed") return cs0;
  const cs = clone(cs0);
  escalateToLethal(cs, "weapon");
  return cs;
}

function addProf(cs, id, xp) { cs.profGains[id] = (cs.profGains[id] || 0) + xp; }
const alertness = (d) => ({ feral: 4, honorable: 3, wary: 3, fierce: 2, fanatic: 2, brutish: 1, cowardly: 0, mindless: 0 }[d] ?? 1);

// A surprise strike is CONTESTED, not free — so you can't just ambush everyone.
// Player ambush: your stealth (Reflex + ½Wit + Ambush proficiency) vs the foes'
// awareness (their accuracy + demeanor alertness, harder per extra foe). Win →
// they reel and lose their first turn. Enemy ambush: contested by your Wit + ½
// Reflex + Awareness proficiency; lose the read and they get a free opening
// blow. Either way you train the relevant proficiency.
function applyAmbush(cs, side) {
  const a = cs.player.attrs || {};
  const living = livingEnemies(cs);
  if (side === "player") {
    const stealth = (a.reflex || 0) + Math.floor((a.wit || 0) / 2) + (cs.player.prof?.ambush || 0);
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
    const perception = (a.wit || 0) + Math.floor((a.reflex || 0) / 2) + (cs.player.prof?.awareness || 0);
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
      if (profile) cs.log.push(resolveHit(e, cs.player, profile));
      if (cs.player.health <= 0) break;
    }
    if (cs.player.health <= 0) finishDefeat(cs);
  }
}

// ----- damage resolution -----

// Build the damage profile. Weapon-scaling techniques are built from the
// attacker's weapon (+ a stat modifier that grows with the ability's tier);
// stat-scaling spells are built from the attribute × tier, with a staff/wand
// adding only a small bonus.
function attackProfile(attacker, def, tierId, isPlayer) {
  const scaling = abilityScaling(def);
  const order = tierInfo(tierId).order;

  if (scaling === "weapon" || def.damageType === "weapon") {
    const w = attacker.weapon || { min: 1, max: 2, type: "physical", pen: 0 };
    const techMult = 1 + order * 0.15;
    const govAttr = isPlayer ? (attacker.attrs?.[def.scaleAttr] ?? attacker.attrs?.body ?? 0) : 0;
    const statMod = isPlayer ? Math.round(govAttr * (0.5 + order * 0.25)) : Math.round(order * 1.5);
    const type = def.damageType && def.damageType !== "weapon" ? def.damageType : w.type;
    return {
      min: Math.max(1, Math.round(w.min * techMult) + statMod),
      max: Math.max(1, Math.round(w.max * techMult) + statMod),
      type, pen: (w.pen || 0) + (def.pen || 0), critBonus: def.critBonus || 0,
    };
  }

  if (scaling === "stat") {
    if (!def.dmg) return null;
    const m = tierMult(tierId);
    const f = isPlayer && def.scaleAttr && attacker.attrs ? attrFactor(attacker.attrs[def.scaleAttr]) : 1;
    const castBonus = isPlayer ? 1 + (attacker.prof?.spellcasting || 0) * 0.05 : 1; // Spellcasting proficiency
    let focus = 0;
    if (isPlayer && (attacker.weapon?.category === "staff" || attacker.weapon?.category === "wand")) {
      focus = Math.round((attacker.weapon.max || 0) * 0.3);
    }
    return {
      min: Math.max(1, Math.round(def.dmg[0] * m * f * castBonus) + focus),
      max: Math.max(1, Math.round(def.dmg[1] * m * f * castBonus) + focus),
      type: def.damageType, pen: def.pen || 0, critBonus: def.critBonus || 0,
    };
  }
  return null; // no direct damage
}

// Soft requirement multiplier: stat shortfall scales damage down (floor 20%).
// Weapon-type mismatch is no longer a penalty — it hard-blocks use (see
// weaponReqMet/abilityUsable), so anything that reaches here has its weapon.
function abilityEffectiveness(player, def, tierId) {
  return reqEffectiveness(player.attrs || {}, abilityRequiredStat(def, tierId));
}

function resolveHit(attacker, defender, profile) {
  const hitChance = 100 - clamp((defender.dodge || 0) - (attacker.accuracy || 0), 0, 90);
  if (rand100() > hitChance) {
    return logEntry(`${attacker.name} attacks ${defender.name} — dodged.`, "miss");
  }
  let raw = randInt(profile.min, profile.max);
  if (profile.eff != null) raw *= profile.eff;
  raw *= 1 + sumStatus(attacker, "rally") / 100 - sumStatus(attacker, "weaken") / 100;

  const critChance = (attacker.critChance || 0) + (profile.critBonus || 0) + sumStatus(attacker, "focus");
  const crit = rand100() <= critChance;
  if (crit) raw *= attacker.critMult || 1.5;
  if (hasStatus(attacker, "focus")) attacker.statuses = attacker.statuses.filter((s) => s.type !== "focus");

  raw *= 1 + sumStatus(defender, "vulnerable") / 100;
  raw = Math.max(0, Math.round(raw));

  let mitig = 0;
  if (profile.type === "physical") mitig = Math.max(0, (defender.armor || 0) + sumStatus(defender, "guard") - (profile.pen || 0));
  else if (profile.type === "magical") mitig = Math.max(0, (defender.ward || 0) - (profile.pen || 0));
  const dmg = Math.max(0, raw - mitig);
  defender.health = Math.max(0, defender.health - dmg);

  const typeTag = profile.type === "true" ? " true" : profile.type === "magical" ? " magical" : "";
  const critTag = crit ? " CRIT" : "";
  const tail = dmg === 0 ? " — absorbed." : ".";
  return logEntry(`${attacker.name} hits ${defender.name} for ${dmg}${typeTag}${critTag}${tail}`, crit ? "crit" : "hit");
}

// ----- morale -----

function onEnemyDamaged(e, dmg) {
  if (e.demeanor === "fanatic" || e.demeanor === "mindless") return;
  const cfg = DEMEANOR_CONFIG[e.demeanor] || DEMEANOR_CONFIG.wary;
  let loss = (dmg / Math.max(1, e.maxHealth)) * 55;
  if (e.health / e.maxHealth <= 0.25) loss += 10;
  if (cfg.proud) loss *= 0.6;
  e.morale = Math.max(0, e.morale - loss);
}
function onEnemyControlled(e) {
  if (e.demeanor === "fanatic" || e.demeanor === "mindless") return;
  const cfg = DEMEANOR_CONFIG[e.demeanor] || DEMEANOR_CONFIG.wary;
  e.controlPressure = (e.controlPressure || 0) + 1;
  let loss = cfg.proud ? 3 : 6;
  if (e.demeanor === "cowardly") loss = 9;
  e.morale = Math.max(0, e.morale - loss);
}
// A foe drops to 0. In a lethal fight that means death (lootable corpse); in a
// bare-knuckle brawl it means knocked senseless (alive — nothing to loot).
function downEnemy(cs, e) {
  if (e._dead || e.resolved === "ko") return;
  if (cs.lethal) { e._dead = true; cs.log.push(logEntry(`${e.name} falls, dead.`, "system")); }
  else { e.resolved = "ko"; cs.log.push(logEntry(`${e.name} is knocked senseless.`, "system")); }
  let lined = false;
  for (const s of cs.enemies) {
    if (s === e || s.health <= 0 || s.resolved) continue;
    s.morale = Math.max(0, s.morale - (ALLY_LOSS[s.demeanor] ?? 12));
    if (!lined && !["mindless", "fanatic", "feral"].includes(s.demeanor)) {
      const l = flavorLine("allyFell", s.demeanor, s.name);
      if (l) { cs.log.push(logEntry(l, "enemy")); lined = true; }
    }
  }
}
// An allied companion drops to 0 — dead in a lethal fight, knocked out in a brawl.
function downAlly(cs, a) {
  if (a._dead || a.resolved === "ko") return;
  if (cs.lethal) { a._dead = true; cs.log.push(logEntry(`${a.name} falls, slain.`, "enemy")); }
  else { a.resolved = "ko"; cs.log.push(logEntry(`${a.name} is knocked senseless.`, "system")); }
}

// Usable abilities for an NPC (ally or enemy): off cooldown only — NPCs don't
// track stamina/resolve (consistent with the original enemy turn).
function npcCandidates(actor) {
  const out = [];
  for (const a of (actor.abilities || [])) {
    if ((actor.cooldowns?.[a.id] || 0) > 0) continue;
    const def = getAbilityDef(a.id);
    if (def) out.push({ id: a.id, tier: a.tier || actor.tier || "common", def });
  }
  return out;
}

// Execute one AI turn for an NPC actor (ally or enemy) against `opponents`.
// Shared by both sides so enemies fight as cannily as companions. Mutates cs.
function npcPerform(cs, actor, opponents) {
  const choice = chooseAction(actor, opponents, npcCandidates(actor));
  if (!choice) return;
  const { def, ability, mode } = choice;
  const tId = ability.tier || actor.tier || "common";
  if (def.cooldown) actor.cooldowns[ability.id] = def.cooldown;
  const sideKind = actor.side === "player" ? "player" : "enemy";

  const hitOne = (target) => {
    const profile = attackProfile(actor, def, tId, false);
    const before = target.health;
    if (profile) cs.log.push(resolveHit(actor, target, profile));
    const dealt = before - target.health;
    if (dealt > 0 && target.side === "enemy") onEnemyDamaged(target, dealt);
    if (target.health > 0 && def.effect && def.effect.target === "enemy") {
      addStatus(target, def.effect);
      if (CONTROL_TYPES.has(def.effect.type) && target.side === "enemy") onEnemyControlled(target);
    }
    // Player-only reactions when the player is the one struck.
    if (target === cs.player) {
      addProf(cs, "evasion", XP.EVASION);
      if (dealt > 0) addProf(cs, "endurance", XP.ENDURANCE);
      const thorns = cs.player.triggers?.thorns || 0;
      if (dealt > 0 && thorns > 0 && actor.health > 0) {
        const ref = Math.max(1, Math.round(dealt * thorns / 100));
        actor.health = Math.max(0, actor.health - ref);
        cs.log.push(logEntry(`${actor.name} takes ${ref} from thornmail.`, "status"));
      }
    }
  };

  if (mode === "self") {
    if (def.effect) addStatus(actor, def.effect);
    cs.log.push(logEntry(`${actor.name} uses ${def.name}.`, sideKind));
  } else if (mode === "aoe") {
    cs.log.push(logEntry(`${actor.name} uses ${def.name}.`, sideKind));
    for (const t of opponents) if (t.health > 0 && !t.resolved && !t._dead) hitOne(t);
  } else {
    let target = choice.target;
    if (!target || target.health <= 0 || target.resolved || target._dead) target = opponents.find((o) => o.health > 0 && !o.resolved && !o._dead);
    if (!target) return;
    if (ability.id !== BASIC_ATTACK.id) cs.log.push(logEntry(`${actor.name} uses ${def.name}.`, sideKind));
    const hits = def.hits || 1;
    for (let h = 0; h < hits; h++) { if (target.health <= 0) break; hitOne(target); }
  }

  // Down anyone reduced to 0 (the player is left for the caller's playerDown).
  for (const t of opponents) {
    if (t.health > 0 || t === cs.player) continue;
    if (t.side === "enemy") downEnemy(cs, t); else downAlly(cs, t);
  }
}

function resolveYield(cs, e) {
  e.resolved = "yielded";
  cs.log.push(logEntry(flavorLine("yield", e.demeanor, e.name) || `${e.name} yields.`, "enemy"));
}
function resolveFlee(cs, e) {
  e.resolved = "fled";
  cs.log.push(logEntry(flavorLine("flee", e.demeanor, e.name) || `${e.name} flees.`, "enemy"));
}
function pushFlavor(cs, e, category) {
  const l = flavorLine(category, e.demeanor, e.name);
  if (l) { cs.log.push(logEntry(l, "enemy")); return true; }
  return false;
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
  // Only even consider breaking when actually in trouble.
  const inTrouble = hp <= yieldHp || hp < 0.1 || (hopeless && hp < 0.5);
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
  const dot = sumStatus(c, "bleed") + sumStatus(c, "poison");
  if (dot > 0) {
    c.health = Math.max(0, c.health - dot);
    logs.push(logEntry(`${c.name} suffers ${dot} from bleeding/poison.`, "status"));
  }
  const heal = sumStatus(c, "regen");
  if (heal > 0 && c.health > 0) {
    c.health = Math.min(c.maxHealth, c.health + heal);
    logs.push(logEntry(`${c.name} recovers ${heal}.`, "status"));
  }
  c.statuses = (c.statuses || []).map((s) => ({ ...s, duration: s.duration - 1 })).filter((s) => s.duration > 0);
  return logs;
}

// Player at/below 0 — but an Undying passive can cheat death once per fight.
function playerDown(cs) {
  if (cs.player.health > 0) return false;
  const rev = cs.player.triggers?.reviveOnce;
  if (rev && !cs.revivedUsed) {
    cs.revivedUsed = true;
    cs.player.health = Math.max(1, Math.round(cs.player.maxHealth * rev));
    cs.log.push(logEntry(`${cs.player.name} cheats death and rises!`, "status"));
    return false;
  }
  return true;
}

// ----- end-of-combat checks -----

function checkCombatEnd(cs) {
  if (livingEnemies(cs).length > 0) return cs;
  if (cs.enemies.every((e) => e._dead)) return finishVictory(cs);
  return finishResolved(cs); // some yielded / fled / knocked out (non-lethal)
}

// ----- player actions -----

// A weapon technique HARD-requires a compatible weapon in hand — you can't
// Power Strike with a grimoire or bare fists. (Stat shortfalls stay soft.)
export function weaponReqMet(def, weapon) {
  if (abilityScaling(def) !== "weapon") return true;       // spells/utility need no weapon
  if (!def.weaponReq || def.weaponReq.length === 0) return true; // basic attack — any weapon/fists
  return def.weaponReq.includes(weapon?.category);
}

export function abilityUsable(cs, abilityId) {
  if (cs.phase !== "player") return false;
  const entry = cs.player.abilities.find((a) => a.id === abilityId);
  if (!entry) return false;
  const def = getAbilityDef(abilityId);
  if ((cs.player.cooldowns[abilityId] || 0) > 0) return false;
  if (cs.player.stamina < (def.cost || 0)) return false;
  if ((cs.player.resolve ?? 0) < (def.resolveCost || 0)) return false;
  if (!weaponReqMet(def, cs.player.weapon)) return false;
  return true;
}

export function playerAct(cs0, abilityId, targetIndex) {
  if (abilityId === TALK.id) return playerTalk(cs0, "surrender", targetIndex);
  if (!abilityUsable(cs0, abilityId)) return cs0;
  const cs = clone(cs0);
  const def = getAbilityDef(abilityId);
  const entry = cs.player.abilities.find((a) => a.id === abilityId);
  const tierId = entry.tier || "common";
  const scaling = abilityScaling(def);
  // A spell or a real weapon technique is inherently a killing act — using one
  // in a brawl escalates it to lethal on its own (no separate Draw needed).
  const isSpell = scaling === "stat";
  const isWeaponTech = scaling === "weapon" && def.weaponReq && def.weaponReq.length > 0;
  if (isSpell) cs.magicCast = true;
  if (!cs.lethal && (isSpell || isWeaponTech)) escalateToLethal(cs, isSpell ? "magic" : "weapon");
  cs.player.stamina -= def.cost || 0;
  // Spellcasting proficiency makes casting cheaper on Resolve.
  const resoCost = Math.max(0, (def.resolveCost || 0) - Math.floor((cs.player.prof?.spellcasting || 0) / 4));
  cs.player.resolve = Math.max(0, (cs.player.resolve ?? 0) - resoCost);
  if (def.cooldown) cs.player.cooldowns[abilityId] = def.cooldown;

  // Train the proficiency this action exercises (do-it-get-better).
  if (def.dmg || def.damageType === "weapon") {
    if (scaling === "stat") addProf(cs, "spellcasting", XP.SPELL_CAST);
    else if (scaling === "weapon") addProf(cs, weaponMasteryId(cs.player.weapon?.category), XP.WEAPON_HIT);
  }

  const profile = attackProfile(cs.player, def, tierId, true);
  if (profile) profile.eff = abilityEffectiveness(cs.player, def, tierId);
  const lifesteal = cs.player.triggers?.lifesteal || 0;
  const isControl = def.effect && CONTROL_TYPES.has(def.effect.type) && def.effect.target === "enemy";

  const hitEnemy = (target) => {
    const before = target.health;
    if (profile) cs.log.push(resolveHit(cs.player, target, profile));
    const dealt = before - target.health;
    if (dealt > 0) {
      onEnemyDamaged(target, dealt);
      if (lifesteal > 0 && cs.player.health > 0) {
        const heal = Math.max(1, Math.round(dealt * lifesteal / 100));
        cs.player.health = Math.min(cs.player.maxHealth, cs.player.health + heal);
        cs.log.push(logEntry(`${cs.player.name} drains ${heal} health.`, "status"));
      }
    }
    if (target.health > 0 && def.effect && def.effect.target === "enemy") {
      addStatus(target, def.effect);
      if (isControl) onEnemyControlled(target);
    }
  };

  if (def.target === "self") {
    if (def.effect) addStatus(cs.player, def.effect);
    cs.log.push(logEntry(`${cs.player.name} uses ${def.name}.`, "player"));
  } else if (def.target === "all-enemies") {
    cs.log.push(logEntry(`${cs.player.name} uses ${def.name}.`, "player"));
    for (const e of cs.enemies) { if (e.health > 0 && !e.resolved) hitEnemy(e); }
  } else {
    let idx = targetIndex;
    if (idx == null || !cs.enemies[idx] || cs.enemies[idx].health <= 0 || cs.enemies[idx].resolved) {
      idx = cs.enemies.findIndex((e) => e.health > 0 && !e.resolved);
    }
    if (idx < 0) return cs0;
    const target = cs.enemies[idx];
    if (abilityId !== BASIC_ATTACK.id) cs.log.push(logEntry(`${cs.player.name} uses ${def.name}.`, "player"));
    const hits = def.hits || 1;
    for (let h = 0; h < hits; h++) { if (target.health <= 0) break; hitEnemy(target); }
  }

  for (const e of cs.enemies) if (e.health <= 0) downEnemy(cs, e);
  const firstAlive = cs.enemies.findIndex((e) => e.health > 0 && !e.resolved);
  if (firstAlive >= 0 && (cs.enemies[cs.target]?.health <= 0 || cs.enemies[cs.target]?.resolved)) cs.target = firstAlive;
  return checkCombatEnd(cs);
}

const canCommunicate = (e) => e.canTalk !== false && DEMEANOR_CONFIG[e.demeanor]?.canParley;

// Talk to the foe. Intent: "surrender" (demand they yield), "demoralize" (sap
// the will to fight of all who can hear), or "provoke" (goad one foe into a
// reckless fight and keep it from fleeing). Only thinking foes can be reached.
export function playerTalk(cs0, intent = "surrender", targetIndex = null) {
  if (!abilityUsable(cs0, TALK.id)) return cs0;
  const cs = clone(cs0);
  cs.player.stamina -= TALK.cost || 0;
  cs.player.cooldowns[TALK.id] = TALK.cooldown;
  addProf(cs, "command", XP.COMMAND);
  const a = cs.player.attrs || {};

  if (intent === "demoralize") {
    cs.log.push(logEntry(`${cs.player.name} hurls threats and grim promises.`, "player"));
    const hit = livingEnemies(cs).filter(canCommunicate);
    if (hit.length === 0) cs.log.push(logEntry(`No one here can be cowed.`, "system"));
    const playerHp = cs.player.health / cs.player.maxHealth;
    for (const e of hit) {
      let dmg = 8 + (a.presence || 0) * 3 + (a.wit || 0) * 1.5;
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
    let chance = 6 + (a.presence || 0) * 4 + (a.wit || 0) * 1.5;
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

// Use a battlefield feature (flip a table, hurl a stool, topple a log…).
export function playerUseEnvironment(cs0, featureId, targetIndex = null) {
  if (cs0.phase !== "player") return cs0;
  const f0 = cs0.environment.find((f) => f.id === featureId);
  if (!f0 || f0.uses <= 0) return cs0;
  const ENV_COST = 1;
  if (cs0.player.stamina < ENV_COST) return cs0;
  const cs = clone(cs0);
  const feat = cs.environment.find((f) => f.id === featureId);
  cs.player.stamina -= ENV_COST;
  feat.uses -= 1;
  const act = feat.action;
  cs.log.push(logEntry(`${cs.player.name}: ${feat.name}.`, "player"));

  const hurt = (e, range, type = "physical") => {
    const armor = type === "physical" ? (e.armor || 0) : 0;
    const dmg = Math.max(0, randInt(range[0], range[1]) + Math.floor((cs.player.attrs?.body || 0) / 3) - armor);
    e.health = Math.max(0, e.health - dmg);
    cs.log.push(logEntry(`${e.name} takes ${dmg} from ${feat.name.toLowerCase()}.`, "hit"));
    if (dmg > 0) onEnemyDamaged(e, dmg);
  };
  const pickTarget = () => {
    let idx = targetIndex;
    if (idx == null || !cs.enemies[idx] || cs.enemies[idx].health <= 0 || cs.enemies[idx].resolved) idx = cs.enemies.findIndex((e) => e.health > 0 && !e.resolved);
    return cs.enemies[idx];
  };

  if (act.type === "cover") {
    addStatus(cs.player, { type: "guard", value: act.armor || 5, duration: act.dur || 2 });
    cs.log.push(logEntry(`You take cover — armour raised.`, "status"));
  } else if (act.type === "throw" || act.type === "shove" || act.type === "topple") {
    const e = pickTarget();
    if (e) {
      hurt(e, act.dmg);
      const stun = act.stun || (act.stunChance && Math.random() < act.stunChance ? 1 : 0);
      if (e.health > 0 && stun) { addStatus(e, { type: "stun", value: 1, duration: 1 }); onEnemyControlled(e); cs.log.push(logEntry(`${e.name} is knocked off balance.`, "status")); }
      if (e.health <= 0) downEnemy(cs, e);
    }
  } else if (act.type === "hazard") {
    for (const e of livingEnemies(cs)) {
      hurt(e, act.dmg, "true");
      if (e.health > 0 && act.dot) addStatus(e, { ...act.dot, target: "enemy" });
      if (e.health <= 0) downEnemy(cs, e);
    }
  }
  return checkCombatEnd(cs);
}

export function setTarget(cs0, idx) {
  if (!cs0.enemies[idx] || cs0.enemies[idx].health <= 0 || cs0.enemies[idx].resolved) return cs0;
  return { ...cs0, target: idx };
}

// Apply a narrator-adjudicated improvised action ([COMBAT ACTION]) to the
// fight. The narrator decides WHAT happens and whether it works; the engine
// keeps the NUMBERS in bounds — a magnitude band is scaled to the player's
// strength so a freeform line can't hand out arbitrary damage. Counts as the
// player's action; the caller advances the turn afterward.
export function applyCombatEffect(cs0, effect) {
  if (cs0.phase !== "player" || !effect) return cs0;
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
    const body = p.attrs?.body || 0;
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

  if (effect.player_damage > 0) p.health = Math.max(0, p.health - Math.round(effect.player_damage));

  for (const e of cs.enemies) if (e.health <= 0) downEnemy(cs, e);
  if (playerDown(cs)) return finishDefeat(cs);
  const firstAlive = cs.enemies.findIndex((e) => e.health > 0 && !e.resolved);
  if (firstAlive >= 0 && (cs.enemies[cs.target]?.health <= 0 || cs.enemies[cs.target]?.resolved)) cs.target = firstAlive;
  return checkCombatEnd(cs);
}

// ----- enemy phase + turn advance -----

export function endTurn(cs0) {
  if (cs0.phase !== "player") return cs0;
  const cs = clone(cs0);
  cs.phase = "enemy";

  // --- Ally phase: companions take their own AI turns against the foes ---
  for (const a of cs.allies || []) {
    if (a.health <= 0 || a.resolved || a._dead) continue;
    if (hasStatus(a, "stun")) {
      cs.log.push(logEntry(`${a.name} is stunned and cannot act.`, "status"));
      a.statuses = a.statuses.filter((s) => s.type !== "stun");
      tickStatuses(a).forEach((l) => cs.log.push(l));
      if (a.health <= 0) downAlly(cs, a);
      continue;
    }
    tickStatuses(a).forEach((l) => cs.log.push(l));
    if (a.health <= 0) { downAlly(cs, a); continue; }
    for (const id of Object.keys(a.cooldowns)) a.cooldowns[id] = Math.max(0, a.cooldowns[id] - 1);
    if (livingEnemies(cs).length === 0) break;
    npcPerform(cs, a, livingEnemies(cs));
    if (livingEnemies(cs).length === 0) break;
  }
  if (livingEnemies(cs).length === 0) return checkCombatEnd(cs);

  // --- Enemy phase: foes take AI turns against the player + living allies ---
  for (const e of cs.enemies) {
    if (e.health <= 0 || e.resolved) continue;
    if (hasStatus(e, "stun")) {
      cs.log.push(logEntry(`${e.name} is stunned and cannot act.`, "status"));
      e.statuses = e.statuses.filter((s) => s.type !== "stun");
      tickStatuses(e).forEach((l) => cs.log.push(l));
      if (e.health <= 0) downEnemy(cs, e);
      continue;
    }
    tickStatuses(e).forEach((l) => cs.log.push(l));
    if (e.health <= 0) { downEnemy(cs, e); continue; }
    for (const id of Object.keys(e.cooldowns)) e.cooldowns[id] = Math.max(0, e.cooldowns[id] - 1);

    // React to how the fight is going before deciding to strike.
    if (!moraleCheck(cs, e)) continue;

    npcPerform(cs, e, playerSide(cs));
    if (playerDown(cs)) return finishDefeat(cs);
  }

  // Combat may have ended via flight/yield during the enemy phase.
  if (livingEnemies(cs).length === 0) return checkCombatEnd(cs);

  cs.turn += 1;
  cs.phase = "player";
  tickStatuses(cs.player).forEach((l) => cs.log.push(l));
  if (playerDown(cs)) return finishDefeat(cs);
  const tr = cs.player.triggers || {};
  if (tr.turnRegen && cs.player.health > 0) {
    cs.player.health = Math.min(cs.player.maxHealth, cs.player.health + tr.turnRegen);
    cs.log.push(logEntry(`${cs.player.name} mends ${tr.turnRegen}.`, "status"));
  }
  if (tr.resolveRegen) cs.player.resolve = Math.min(cs.player.resolveMax, (cs.player.resolve || 0) + tr.resolveRegen);
  cs.player.stamina = Math.min(cs.player.maxStamina, cs.player.stamina + cs.player.staminaRegen + (tr.burst || 0));
  for (const id of Object.keys(cs.player.cooldowns)) cs.player.cooldowns[id] = Math.max(0, cs.player.cooldowns[id] - 1);
  if (livingEnemies(cs).length === 0) return checkCombatEnd(cs);
  cs.log.push(logEntry(`— Turn ${cs.turn} —`, "system"));
  return cs;
}

export function playerFlee(cs0) {
  if (cs0.phase !== "player") return cs0;
  const cs = clone(cs0);
  const speeds = livingEnemies(cs).map((e) => e.speed || 4);
  const enemySpeed = speeds.length ? Math.max(...speeds) : 1;
  const chance = clamp(45 + (cs.player.speed - enemySpeed) * 6, 15, 90);
  if (rand100() <= chance) {
    cs.phase = "playerFled";
    cs.log.push(logEntry(`You break away and escape.`, "system"));
    return cs;
  }
  cs.log.push(logEntry(`You fail to escape!`, "system"));
  return endTurn(cs);
}

// ----- outcomes + loot -----

function lootCtx(cs) {
  return { maxLootTier: cs.maxLootTier, region: cs.region, owned: new Set(cs.ownedUniques || []), coinBonus: cs.coinBonus || 0 };
}
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

const LOOT_NAMES = {
  weapon: ["Blade", "Edge", "Fang", "Cleaver", "Spike", "Talon"],
  armor: ["Guard", "Plate", "Hauberk", "Carapace", "Ward"],
  trinket: ["Charm", "Sigil", "Token", "Knot", "Bead"],
};
const TIER_ADJ = {
  common: "Plain", uncommon: "Fine", rare: "Keen", "very-rare": "Runed",
  epic: "Storied", legendary: "Fabled", mythical: "Mythic", divine: "Hallowed",
};

function generateLootItem(tierId) {
  const kinds = ["weapon", "armor", "trinket"];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  const noun = LOOT_NAMES[kind][Math.floor(Math.random() * LOOT_NAMES[kind].length)];
  const name = `${TIER_ADJ[tierId] || "Plain"} ${noun}`;
  const id = `${tierId}-${noun.toLowerCase()}-${Math.random().toString(36).slice(2, 6)}`;
  const m = tierMult(tierId);
  let combat;
  if (kind === "weapon") combat = { damage: { min: Math.round(3 * m), max: Math.round(6 * m), type: "physical", pen: Math.round(m) } };
  else if (kind === "armor") combat = { armor: Math.round(3 * m) };
  else combat = { ward: Math.round(2 * m), dodge: Math.round(1 * m) };
  return {
    id,
    entry: {
      id, name, kind: kind === "trinket" ? "trinket" : kind, tier: tierId,
      appearance: `${tierLabel(tierId)}-grade ${noun.toLowerCase()}, taken in battle.`,
      description: `A ${tierLabel(tierId).toLowerCase()} ${kind} recovered from a foe.`,
      combat,
      passives: rollItemPassives(tierId, { luck: 0.1 }),
    },
  };
}

export function rollLoot(sources, opts = {}) {
  const { maxLootTier = null, region = 1, owned = new Set(), coinBonus = 0 } = opts;
  let copper = 0;
  let maxTier = "common";
  for (const e of sources) {
    const ord = tierInfo(e.tier).order;
    copper += randInt(2, 8) * (1 + ord);
    if (tierInfo(e.tier).order > tierInfo(maxTier).order) maxTier = e.tier;
    if (tierInfo(e.maxLootTier).order > tierInfo(maxTier).order) maxTier = e.maxLootTier;
  }
  // Region ceiling caps the loot tier — a Settled-region foe never drops epic.
  if (maxLootTier && tierInfo(maxTier).order > tierInfo(maxLootTier).order) maxTier = maxLootTier;

  const items = [];
  if (sources.length > 0 && Math.random() < ITEM_DROP_CHANCE) {
    const li = generateLootItem(rollTier(maxTier, 0.1));
    items.push({ itemId: li.id, entry: li.entry, quantity: 1 });
  }
  let ability = null;
  if (sources.length > 0 && Math.random() < ABILITY_DROP_CHANCE) {
    const id = randomAbilityId();
    const def = getAbilityDef(id);
    ability = { id, tier: rollTier(maxTier, 0.2), name: def?.name || id };
  }

  // Named/unique drops from specific foe kinds + deep regions (never the random
  // pool). A unique ability supersedes the random one; a unique item is extra.
  if (sources.length > 0) {
    const uniq = rollUniques({ kinds: sources.map((e) => e.kind), region, owned, mult: UNIQUE_DROP_CHANCE });
    if (uniq.item) items.push(uniq.item);
    if (uniq.ability) ability = uniq.ability;
  }

  copper = Math.round(copper * (1 + coinBonus));
  const silver = Math.floor(copper / 10);
  return { coins: { copper: copper % 10, silver, gold: 0 }, items, ability };
}

// Fold a finished combat back into the campaign state: HP, lingering wounds as
// conditions, loot into inventory/codex, and a learned ability. Returns a new
// state with summary beats appended.
export function applyCombatResult(state, cs, context = {}) {
  const next = clone(state);
  const beats = [];
  const now = Date.now();

  next.character.vitality = clamp(Math.round(cs.player.health), 0, next.character.vitalityMax);
  if (cs.phase === "defeat") next.character.vitality = Math.max(1, next.character.vitality);

  // Proficiency XP earned this fight → ratings up → attribute growth (the only
  // way attributes rise). Surface what improved as growth beats.
  if (cs.profGains && Object.keys(cs.profGains).length) {
    const beforeProf = { ...(next.character.proficiencies || {}) };
    const beforeEff = effectiveAttributes(next.character);
    const profLines = [];
    next.character.proficiencies = { ...beforeProf };
    for (const [id, xp] of Object.entries(cs.profGains)) {
      const before = beforeProf[id] || 0;
      const after = before + xp;
      next.character.proficiencies[id] = after;
      const r0 = ratingFromXp(before), r1 = ratingFromXp(after);
      if (r1 > r0) profLines.push(`${proficiencyName(id)} ${r0} → ${r1}`);
    }
    const afterEff = effectiveAttributes(next.character);
    const attrLines = [];
    for (const k of ATTR_KEYS) if (afterEff[k] > beforeEff[k]) attrLines.push(`${ATTR_LABELS[k]} ${beforeEff[k]} → ${afterEff[k]}`);
    if (profLines.length) beats.push({ id: `pg${now}`, type: "growth", text: profLines.join(" · ") });
    if (attrLines.length) beats.push({ id: `ag${now}`, type: "growth", text: `Attributes — ${attrLines.join(" · ")}` });
  }
  // Spent Resolve (spellcasting drain) persists out of the fight.
  if (typeof cs.player.resolve === "number") {
    next.character.resolve = clamp(Math.round(cs.player.resolve), 0, next.character.resolveMax);
  }

  const conds = new Set((next.character.conditions || []));
  if (hasStatus(cs.player, "bleed")) conds.add("Bleeding");
  if (hasStatus(cs.player, "poison")) conds.add("Poisoned");
  if (cs.phase === "defeat") { conds.add("Gravely Wounded"); conds.add("Bleeding"); }
  next.character.conditions = Array.from(conds);

  // The detailed aftermath is narrated by the narrator ([COMBAT OVER]/[DEFEATED])
  // right after this, so we only drop a brief lead-in for defeat.
  if (cs.phase === "defeat") {
    beats.push({ id: `cb${now}`, type: "narration", content: `The fight goes against you. A last blow lands, your legs fold, and the world tips into black.` });
  }

  // Spoils are NOT auto-granted. Only actual corpses carry anything, and even
  // then the player must deliberately Search the fallen (a timed, public act the
  // narrator can complicate). Stash what's available for that choice.
  const loot = cs.loot;
  const deadCount = cs.enemies.filter((e) => e._dead).length;
  const hasSpoils = loot && deadCount > 0 && ((loot.items && loot.items.length) || loot.ability || loot.coins.silver || loot.coins.copper || loot.coins.gold);
  next.pendingLoot = hasSpoils ? { ...loot, deadCount, flavor: context.flavor || cs.enemies[0]?.name || "the fallen" } : null;

  // Persist named foes' combat state so a re-fight continues from their wounds
  // (no full-HP reset) and a foe who yielded/died stays that way.
  for (const e of cs.enemies) {
    if (!e.npcId) continue;
    const ch = next.world.codex.characters?.[e.npcId];
    if (!ch) continue;
    const status = e._dead ? "dead" : e.resolved === "yielded" ? "yielded" : e.resolved === "fled" ? "fled" : (e.health < e.maxHealth ? "wounded" : "ok");
    ch.combatState = { health: Math.max(0, Math.ceil(e.health)), maxHealth: e.maxHealth, status };
  }

  // A companion slain in a lethal fight is gone — mark the codex character dead
  // and remove them from the party. (Survivors recover fully; we don't carry
  // their wounds, so attrition can't slowly doom the whole company.)
  const fallen = (cs.allies || []).filter((a) => a._dead && a.companionId);
  if (fallen.length) {
    const fallenIds = new Set(fallen.map((a) => a.companionId));
    next.party = (next.party || []).filter((id) => !fallenIds.has(id));
    for (const a of fallen) {
      const ch = next.world.codex.characters?.[a.companionId];
      if (ch) ch.combatState = { health: 0, maxHealth: a.maxHealth, status: "dead" };
    }
  }

  // Hand the narrator a blow-by-blow account so the fight can be referenced
  // afterward (and so a [DEFEATED] follow-up knows exactly what happened).
  next.apiHistory = [...(next.apiHistory || []), { role: "user", content: buildCombatRecap(cs, context) }];

  next.beats = [...next.beats, ...beats];
  return next;
}

// Deliberately loot the fallen (the player chose to search the corpses). Grants
// the stashed spoils, records what was taken, and returns { state, taken } so
// the caller can narrate it + adjudicate fallout. Clears pendingLoot.
export function applyLoot(state, manifest) {
  const next = clone(state);
  next.pendingLoot = null;
  const beats = [];
  const now = Date.now();
  if (!manifest) return { state: { ...next, beats: [...next.beats] }, taken: "" };

  next.world.codex.items = { ...next.world.codex.items };
  const invLines = [];
  const takenParts = [];
  for (const it of (manifest.items || [])) {
    if (it.entry) next.world.codex.items[it.itemId] = it.entry;
    const existing = next.character.inventory.carried.find((c) => c.itemId === it.itemId);
    if (existing) existing.quantity += it.quantity || 1;
    else next.character.inventory.carried.push({ itemId: it.itemId, quantity: it.quantity || 1 });
    invLines.push(`+${it.quantity || 1}× ${it.entry?.name || it.itemId}`);
    takenParts.push(it.entry?.name || it.itemId);
  }
  const coins = manifest.coins || {};
  next.character.inventory.coins.copper += coins.copper || 0;
  next.character.inventory.coins.silver += coins.silver || 0;
  next.character.inventory.coins.gold += coins.gold || 0;
  const coinParts = [];
  if (coins.gold) coinParts.push(`+${coins.gold}gp`);
  if (coins.silver) coinParts.push(`+${coins.silver}sp`);
  if (coins.copper) coinParts.push(`+${coins.copper}cp`);
  if (coinParts.length) { invLines.push(coinParts.join(", ")); takenParts.push(coinParts.join(", ")); }
  if (invLines.length) beats.push({ id: `lt${now}`, type: "inventory_delta", lines: invLines });

  if (manifest.ability) {
    next.character.abilities = Array.isArray(next.character.abilities) ? [...next.character.abilities] : [];
    next.character.abilities.push({ id: manifest.ability.id, tier: manifest.ability.tier });
    const def = getAbilityDef(manifest.ability.id);
    next.world.codex.skills = { ...next.world.codex.skills };
    next.world.codex.skills[manifest.ability.id] = {
      id: manifest.ability.id, name: `${manifest.ability.name} (${tierLabel(manifest.ability.tier)})`,
      description: def?.desc || "A combat ability.", rating: tierInfo(manifest.ability.tier).order + 1,
      combatAbility: true, tier: manifest.ability.tier,
    };
    beats.push({ id: `la${now}`, type: "discovery", items: [{ kind: "ability", name: `${manifest.ability.name} · ${tierLabel(manifest.ability.tier)}` }] });
    takenParts.push(`the technique ${manifest.ability.name}`);
  }

  next.beats = [...next.beats, ...beats];
  return { state: next, taken: takenParts.join(", ") };
}

function buildCombatRecap(cs, context) {
  const outcome =
    cs.phase === "victory" ? "you won" :
    cs.phase === "defeat" ? "you were beaten down and went under" :
    cs.phase === "resolved" ? "it ended without a slaughter" :
    cs.phase === "playerFled" ? "you broke off and fled" : "it ended";
  const foes = cs.enemies.map((e) => {
    const st = e.health <= 0 ? "slain" : e.resolved === "yielded" ? "yielded" : e.resolved === "fled" ? "fled" : `still standing (${Math.ceil(e.health)}/${e.maxHealth})`;
    return `${e.name} [${e.tier}, ${e.demeanor}] — ${st}`;
  }).join("; ");
  const account = cs.log
    .filter((l) => !/^—\s*Turn/.test(l.text))
    .slice(-22)
    .map((l) => l.text)
    .join(" ");
  const magicNote = cs.magicCast
    ? " NOTE: the player WORKED MAGIC in this fight — magic is rare and dreaded, so any ordinary folk who witnessed it should react with shock, panic, even cries of witchcraft, far beyond their reaction to mere violence."
    : "";
  const n = cs.enemies.length;
  const allies = (cs.allies || []);
  const allyNote = allies.length
    ? ` Fighting at your side: ${allies.map((a) => `${a.name} (${a._dead ? "slain" : a.resolved === "ko" ? "knocked out" : a.health < a.maxHealth ? `wounded, ${Math.ceil(a.health)}/${a.maxHealth}` : "unhurt"})`).join("; ")}.`
    : "";
  return `[COMBAT REPORT] ${context.flavor || "A fight"} — ${outcome}. You fought exactly ${n} foe${n === 1 ? "" : "s"} (this is the full roster — narrate only these, by these fates): ${foes}.${allyNote} You ended at ${Math.ceil(cs.player.health)}/${cs.player.maxHealth} HP. Blow-by-blow: ${account}.${magicNote}`.slice(0, 1800);
}
