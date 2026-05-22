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

// ----- setup -----

function playerThreat(p) {
  return p.weapon.max + p.maxHealth * 0.2 + p.critChance * 0.1 + (p.abilities?.length || 0) * 1.5;
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
    abilities, cooldowns: {}, statuses: [],
  };

  const foes = clone(enemies);
  // How outmatched are they? Lower the nerve of foes who can see they're outclassed.
  const pThreat = playerThreat(player);
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

  const flavor = foes.length === 1 ? foes[0].name : `${foes.length} foes`;
  const combatState = {
    player,
    enemies: foes,
    target: 0,
    turn: 1,
    phase: "player",
    powerRatio,
    maxLootTier: opts.maxLootTier || null,
    region: opts.region || 1,
    ownedUniques: opts.ownedUniques || [],
    coinBonus: opts.coinBonus || 0,
    environment: opts.environment || [],
    revivedUsed: false,
    profGains: {},
    log: [logEntry(`Combat begins — ${flavor}.`, "system")],
    loot: null,
  };
  if (opts.ambush) applyAmbush(combatState, opts.ambush);
  return combatState;
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

// Soft requirement multiplier for a player's ability use: stat shortfall scales
// damage down (floor 20%), and an off-type weapon technique is penalised.
function abilityEffectiveness(player, def, tierId) {
  const statEff = reqEffectiveness(player.attrs || {}, abilityRequiredStat(def, tierId));
  let weaponEff = 1;
  if (abilityScaling(def) === "weapon" && def.weaponReq && def.weaponReq.length) {
    if (!def.weaponReq.includes(player.weapon?.category)) weaponEff = 0.6;
  }
  return statEff * weaponEff;
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
function markDead(cs, e) {
  if (e._dead) return;
  e._dead = true;
  cs.log.push(logEntry(`${e.name} falls.`, "system"));
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
    if (cfg.canFlee && hp < cfg.fleeAt && e.morale < 50) { resolveFlee(cs, e); return false; }
    if (hp < 0.3 && cs.turn - (e.lastFlavorTurn || 0) >= 2) { e.lastFlavorTurn = cs.turn; pushFlavor(cs, e, "waver"); }
    return true;
  }

  // A goaded foe is too enraged to flee or yield for a couple of turns.
  const goaded = (e.noFleeUntil || 0) >= cs.turn;
  const broke = !goaded && (e.morale <= cfg.breakAt || hp < 0.12);
  if (broke) {
    // A proud foe being bullied with control demands a fair fight before it breaks.
    if (cfg.proud && (e.controlPressure || 0) >= 2 && !e.provoked && e.morale > cfg.breakAt - 12 && hp > 0.15) {
      e.provoked = true;
      addStatus(e, { type: "rally", value: 20, duration: 2 });
      pushFlavor(cs, e, "provoke");
      return true;
    }
    let mode = cfg.prefer;
    if (mode === "either") mode = Math.random() < 0.5 ? "flee" : "yield";
    if (mode === "yield" && !cfg.canYield) mode = cfg.canFlee ? "flee" : "yield";
    if (mode === "flee" && !cfg.canFlee) mode = cfg.canYield ? "yield" : "flee";
    if (mode === "flee" && cfg.canFlee) { resolveFlee(cs, e); return false; }
    if (cfg.canYield) { resolveYield(cs, e); return false; }
    return true;
  }

  // Warning zone: telegraph the fraying nerve so the player sees it coming.
  if (e.morale <= cfg.breakAt + 20 && cs.turn - (e.lastFlavorTurn || 0) >= 2) {
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
  if (cs.enemies.every((e) => e.health <= 0)) return finishVictory(cs);
  return finishResolved(cs);
}

// ----- player actions -----

export function abilityUsable(cs, abilityId) {
  if (cs.phase !== "player") return false;
  const entry = cs.player.abilities.find((a) => a.id === abilityId);
  if (!entry) return false;
  const def = getAbilityDef(abilityId);
  if ((cs.player.cooldowns[abilityId] || 0) > 0) return false;
  if (cs.player.stamina < (def.cost || 0)) return false;
  if ((cs.player.resolve ?? 0) < (def.resolveCost || 0)) return false;
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
  cs.player.stamina -= def.cost || 0;
  // Spellcasting proficiency makes casting cheaper on Resolve.
  const resoCost = Math.max(0, (def.resolveCost || 0) - Math.floor((cs.player.prof?.spellcasting || 0) / 4));
  cs.player.resolve = Math.max(0, (cs.player.resolve ?? 0) - resoCost);
  if (def.cooldown) cs.player.cooldowns[abilityId] = def.cooldown;
  if (abilityId === DEFEND.id) cs.player.stamina = Math.min(cs.player.maxStamina, cs.player.stamina + 2);

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

  for (const e of cs.enemies) if (e.health <= 0) markDead(cs, e);
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
    for (const e of hit) {
      let dmg = 8 + (a.presence || 0) * 3 + (a.wit || 0) * 1.5;
      if (cs.powerRatio > 1.4) dmg += 10;
      if (e.demeanor === "cowardly") dmg += 8;
      if (DEMEANOR_CONFIG[e.demeanor]?.proud) dmg *= 0.5;
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
  for (const e of cs.enemies) {
    if (e.health <= 0 || e.resolved) continue;
    const cfg = DEMEANOR_CONFIG[e.demeanor] || DEMEANOR_CONFIG.wary;
    if (!canCommunicate(e)) { cs.log.push(logEntry(`${e.name} cannot be reasoned with.`, "system")); continue; }
    const hp = e.health / e.maxHealth;
    let chance = 6 + (a.presence || 0) * 4 + (a.wit || 0) * 1.5;
    chance += (e.moraleMax - e.morale) * 0.5;
    if (hp < 0.3) chance += 28; else if (hp < 0.5) chance += 14;
    chance += fallen * 10;
    if (cs.powerRatio > 1.6) chance += 25; else if (cs.powerRatio > 1.15) chance += 10;
    if (e.demeanor === "cowardly") chance += 18;
    if (e.demeanor === "honorable") chance += (e.controlPressure || 0) >= 2 ? 0 : 18;
    if (cfg.proud && (e.controlPressure || 0) >= 2 && cs.powerRatio < 2) chance -= 35;
    chance = clamp(chance, 0, 95);
    if (rand100() <= chance) resolveYield(cs, e);
    else { cs.log.push(logEntry(flavorLine("defy", e.demeanor, e.name) || `${e.name} refuses to yield.`, "enemy")); e.morale = Math.max(0, e.morale - 3); }
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
      if (e.health <= 0) markDead(cs, e);
    }
  } else if (act.type === "hazard") {
    for (const e of livingEnemies(cs)) {
      hurt(e, act.dmg, "true");
      if (e.health > 0 && act.dot) addStatus(e, { ...act.dot, target: "enemy" });
      if (e.health <= 0) markDead(cs, e);
    }
  }
  return checkCombatEnd(cs);
}

export function setTarget(cs0, idx) {
  if (!cs0.enemies[idx] || cs0.enemies[idx].health <= 0 || cs0.enemies[idx].resolved) return cs0;
  return { ...cs0, target: idx };
}

// ----- enemy phase + turn advance -----

function enemyChooseAbility(enemy) {
  const usable = (enemy.abilities || []).filter((a) => (enemy.cooldowns[a.id] || 0) <= 0 && getAbilityDef(a.id));
  const heal = usable.find((a) => getAbilityDef(a.id).effect?.type === "regen");
  if (heal && enemy.health < enemy.maxHealth * 0.4) return heal;
  const offensive = usable.filter((a) => getAbilityDef(a.id).target !== "self");
  if (offensive.length && Math.random() < 0.6) return offensive[Math.floor(Math.random() * offensive.length)];
  return null;
}

export function endTurn(cs0) {
  if (cs0.phase !== "player") return cs0;
  const cs = clone(cs0);
  cs.phase = "enemy";

  for (const e of cs.enemies) {
    if (e.health <= 0 || e.resolved) continue;
    if (hasStatus(e, "stun")) {
      cs.log.push(logEntry(`${e.name} is stunned and cannot act.`, "status"));
      e.statuses = e.statuses.filter((s) => s.type !== "stun");
      tickStatuses(e).forEach((l) => cs.log.push(l));
      if (e.health <= 0) markDead(cs, e);
      continue;
    }
    tickStatuses(e).forEach((l) => cs.log.push(l));
    if (e.health <= 0) { markDead(cs, e); continue; }
    for (const id of Object.keys(e.cooldowns)) e.cooldowns[id] = Math.max(0, e.cooldowns[id] - 1);

    // React to how the fight is going before deciding to strike.
    if (!moraleCheck(cs, e)) continue;

    const choice = enemyChooseAbility(e);
    const def = choice ? getAbilityDef(choice.id) : BASIC_ATTACK;
    const tId = choice ? (choice.tier || e.tier) : e.tier;
    if (choice && def.cooldown) e.cooldowns[choice.id] = def.cooldown;

    if (def.target === "self") {
      if (def.effect) addStatus(e, def.effect);
      cs.log.push(logEntry(`${e.name} uses ${def.name}.`, "enemy"));
    } else {
      if (choice) cs.log.push(logEntry(`${e.name} uses ${def.name}.`, "enemy"));
      const profile = attackProfile(e, def, tId, false);
      const before = cs.player.health;
      if (profile) cs.log.push(resolveHit(e, cs.player, profile));
      const dealt = before - cs.player.health;
      addProf(cs, "evasion", XP.EVASION);
      if (dealt > 0) addProf(cs, "endurance", XP.ENDURANCE);
      if (cs.player.health > 0 && def.effect && def.effect.target === "enemy") addStatus(cs.player, def.effect);
      // Thornmail reflects a share of damage taken back at the attacker.
      const thorns = cs.player.triggers?.thorns || 0;
      if (dealt > 0 && thorns > 0 && e.health > 0) {
        const ref = Math.max(1, Math.round(dealt * thorns / 100));
        e.health = Math.max(0, e.health - ref);
        cs.log.push(logEntry(`${e.name} takes ${ref} from thornmail.`, "status"));
        if (e.health <= 0) markDead(cs, e);
      }
    }
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
function finishVictory(cs) {
  cs.phase = "victory";
  cs.loot = rollLoot(cs.enemies, lootCtx(cs));
  cs.log.push(logEntry(`Victory.`, "system"));
  return cs;
}
function finishResolved(cs) {
  cs.phase = "resolved";
  const yielded = cs.enemies.some((e) => e.resolved === "yielded");
  const sources = cs.enemies.filter((e) => e.health <= 0 || e.resolved === "yielded");
  cs.loot = rollLoot(sources, lootCtx(cs));
  cs.log.push(logEntry(yielded ? `The fight is over — they will trouble you no further.` : `The field is yours; the rest have scattered.`, "system"));
  return cs;
}
function finishDefeat(cs) {
  cs.phase = "defeat";
  cs.player.health = 0;
  cs.log.push(logEntry(`You fall.`, "system"));
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

  const enemyName = context.flavor || cs.enemies[0]?.name || "the enemy";
  const yielded = cs.enemies.filter((e) => e.resolved === "yielded").length;
  const fled = cs.enemies.filter((e) => e.resolved === "fled").length;

  if (cs.phase === "victory") {
    beats.push({ id: `cb${now}`, type: "narration", content: `The fight ends. ${enemyName} lies defeated. You stand, breathing hard, and take stock of your wounds.` });
  } else if (cs.phase === "resolved") {
    const parts = [];
    if (yielded) parts.push(`${yielded === 1 ? "one foe lays" : `${yielded} foes lay`} down arms`);
    if (fled) parts.push(`${fled === 1 ? "another flees" : `${fled} flee`} into the distance`);
    beats.push({ id: `cb${now}`, type: "narration", content: `The fighting stops without a slaughter — ${parts.join(", ") || "the foe stands down"}. You let out a breath and lower your guard.` });
  } else if (cs.phase === "playerFled") {
    beats.push({ id: `cb${now}`, type: "narration", content: `You break off the fight and slip away, heart pounding, before it can be finished.` });
  } else if (cs.phase === "defeat") {
    beats.push({ id: `cb${now}`, type: "narration", content: `The fight goes against you. You fall — and the world narrows to dark. That you draw breath at all is its own small mercy.` });
  }

  const loot = cs.loot;
  if ((cs.phase === "victory" || cs.phase === "resolved") && loot) {
    next.world.codex.items = { ...next.world.codex.items };
    const invLines = [];
    for (const it of (loot.items || [])) {
      if (it.entry) next.world.codex.items[it.itemId] = it.entry;
      const existing = next.character.inventory.carried.find((c) => c.itemId === it.itemId);
      if (existing) existing.quantity += it.quantity || 1;
      else next.character.inventory.carried.push({ itemId: it.itemId, quantity: it.quantity || 1 });
      invLines.push(`+${it.quantity || 1}× ${it.entry?.name || it.itemId}`);
    }
    const coins = loot.coins || {};
    next.character.inventory.coins.copper += coins.copper || 0;
    next.character.inventory.coins.silver += coins.silver || 0;
    next.character.inventory.coins.gold += coins.gold || 0;
    const coinParts = [];
    if (coins.silver) coinParts.push(`+${coins.silver}sp`);
    if (coins.copper) coinParts.push(`+${coins.copper}cp`);
    if (coinParts.length) invLines.push(coinParts.join(", "));
    if (invLines.length) beats.push({ id: `cl${now}`, type: "inventory_delta", lines: invLines });

    if (loot.ability) {
      next.character.abilities = Array.isArray(next.character.abilities) ? [...next.character.abilities] : [];
      next.character.abilities.push({ id: loot.ability.id, tier: loot.ability.tier });
      const def = getAbilityDef(loot.ability.id);
      next.world.codex.skills = { ...next.world.codex.skills };
      next.world.codex.skills[loot.ability.id] = {
        id: loot.ability.id, name: `${loot.ability.name} (${tierLabel(loot.ability.tier)})`,
        description: def?.desc || "A combat ability.", rating: tierInfo(loot.ability.tier).order + 1,
        combatAbility: true, tier: loot.ability.tier,
      };
      beats.push({ id: `ca${now}`, type: "discovery", items: [{ kind: "ability", name: `${loot.ability.name} · ${tierLabel(loot.ability.tier)}` }] });
    }
  }

  next.beats = [...next.beats, ...beats];
  return next;
}
