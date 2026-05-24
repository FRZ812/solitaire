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
import { ITEM_DROP_CHANCE, ABILITY_DROP_CHANCE, UNIQUE_DROP_CHANCE, RUNE_DROP_CHANCE, RUNE_DROP_MIN_REGION } from "../data/balance.js";
import { rollUniques } from "../data/uniques.js";
import { rollItemPassives, RUNES } from "../data/passives.js";
import { effectiveAttributes, ratingFromXp, proficiencyName, weaponMasteryId, XP } from "../data/proficiencies.js";
import { ATTR_KEYS, ATTR_LABELS } from "../config.js";
import { deriveCombatStats, reqEffectiveness } from "./combat-stats.js";
import { chooseAction } from "./combat-ai.js";
import { DARK_ACC_PENALTY } from "./light.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const rand100 = () => Math.random() * 100;
const clone = (x) => JSON.parse(JSON.stringify(x));
let LOG_SEQ = 0;
const logEntry = (text, kind = "system") => ({ id: `l${Date.now()}-${LOG_SEQ++}`, text, kind });

const CONTROL_TYPES = new Set(["stun", "weaken", "vulnerable", "chill", "curse", "slow", "silence"]);
const RESISTABLE_CONTROL = new Set(["stun", "slow"]); // hard controls Unbowed (controlResist) can shrug off
// Debuffs an "unstoppable" combatant (BKB) is flat-out immune to — disables and the
// anti-heal curse, NOT damage-over-time (a wound still bleeds; you just can't be
// disabled or cursed). Damage immunity (incl. true) is invuln's job, separately.
const BKB_BLOCKS = new Set(["stun", "weaken", "vulnerable", "chill", "curse", "slow", "silence"]);
const ALLY_LOSS = { cowardly: 22, wary: 14, fierce: 8, brutish: 10, honorable: 10, feral: 8, fanatic: 0, mindless: 0 };

function sumStatus(c, type) {
  return (c.statuses || []).filter((s) => s.type === type).reduce((s, x) => s + (x.value || 0), 0);
}
function hasStatus(c, type) { return (c.statuses || []).some((s) => s.type === type); }

// Curse is distinct from vulnerable: as well as amplifying damage taken, a cursed
// creature's wounds barely knit — ALL healing it receives is halved. Every heal
// path routes through gainHealth so the suppression (and the maxHealth clamp) lives
// in one place. Returns the health actually restored (for honest logs).
const CURSE_HEAL_MULT = 0.5;
const DEFER_TURNS = 3; // turns a deferred (dmgDefer) wound bleeds out over
const CEASEFIRE_TURN = 50; // a grindingly long fight: a thinking foe offers a truce
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

function addStatus(c, effect) {
  if (!effect) return;
  // Debuff immunity (Unstoppable / BKB): control, silence, and curse are rejected
  // outright while it's up.
  if (c && BKB_BLOCKS.has(effect.type) && hasStatus(c, "unstoppable")) return;
  // Hard control (stun/slow) has DIMINISHING RETURNS: Unbowed (controlResist) plus
  // a stacking resist from how often this foe has already been controlled this
  // fight (+20% per prior control, capped). So you can chain a couple of locks to
  // set up a kill, but you can't perma-stun a boss out of the fight.
  if (c && RESISTABLE_CONTROL.has(effect.type)) {
    const resist = Math.min(0.8, (c.controlResist || 0) + (c.controlPressure || 0) * 0.2);
    if (resist > 0 && Math.random() < resist) return;
  }
  c.statuses = c.statuses || [];
  c.statuses.push({ type: effect.type, value: effect.value || 0, duration: effect.duration || 1, pctMax: !!effect.pctMax });
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
// Combat is over only when nothing's left fighting or fleeing AND no captive waits.
const combatOver = (cs) => livingEnemies(cs).length === 0 && pendingCaptives(cs).length === 0;
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

  // +life affixes (cs.maxHealth above character.vitalityMax) are granted filled,
  // so a wounded player still benefits from extra health gear at full value.
  const healthBonus = Math.max(0, cs.maxHealth - (character.vitalityMax || cs.maxHealth));
  const player = {
    uid: "p",
    name: character.name || "You",
    health: Math.min(cs.maxHealth, Math.round(character.vitality) + healthBonus),
    maxHealth: cs.maxHealth,
    resolve: Math.round(character.resolve ?? 0),
    resolveMax: character.resolveMax ?? 0,
    resolveRegen: cs.resolveRegen || 0,
    dr: cs.dr || 0, fortify: cs.fortify || 0,
    damageCap: cs.damageCap || 0, controlResist: cs.controlResist || 0,
    healPower: cs.healPower || 0, dmgDefer: cs.dmgDefer || 0,
    armor: cs.armor, ward: cs.ward, dodge: cs.dodge,
    accuracy: cs.accuracy, critChance: cs.critChance, critMult: cs.critMult,
    weapon: cs.weapon, speed: cs.speed, swiftChance: cs.swiftChance || 0, reloadLeft: 0,
    triggers: cs.triggers || {},
    procs: cs.triggers?.procs || [],
    actionsPerTurn: cs.actionsPerTurn || 1,
    actionsLeft: cs.actionsPerTurn || 1,
    cooldownReduction: cs.cooldownReduction || 0,
    shield: 0, magicShield: 0, invuln: 0,
    prof: cs.prof || {},
    attrs: cs.attrs || { ...character.attributes },
    abilities, cooldowns: {}, statuses: [], side: "player",
  };

  // Allied companions fight at the player's side, AI-driven (engine/combat-ai).
  // They're built by the caller (allyFromCompanion) into the same combatant shape.
  const allies = (opts.allies || []).map((a, i) => ({
    ...clone(a), uid: `a${i}`, side: "player", statuses: a.statuses || [], cooldowns: a.cooldowns || {},
    actionsPerTurn: a.actionsPerTurn || 1, actionsLeft: a.actionsPerTurn || 1,
    speed: a.speed ?? 4, swiftChance: a.swiftChance || 0, resolveRegen: a.resolveRegen || 0, reloadLeft: 0,
    procs: a.procs || a.triggers?.procs || [], shield: 0, magicShield: 0, invuln: 0,
  }));

  // Fighting blind: in the dark with no torch lit, your side's aim suffers.
  // Monsters that haunt the dark are not so hampered, so only the player/allies pay.
  if (opts.dark) {
    player.darkPenalty = DARK_ACC_PENALTY;
    for (const a of allies) a.darkPenalty = DARK_ACC_PENALTY;
  }

  const foes = clone(enemies);
  foes.forEach((e, i) => {
    e.uid = `e${i}`;
    e.side = "enemy";
    e.actionsPerTurn = e.actionsPerTurn || 1;
    e.actionsLeft = e.actionsPerTurn;
    e.speed = e.speed ?? 4; e.swiftChance = e.swiftChance || 0; e.resolveRegen = e.resolveRegen || 0; e.reloadLeft = 0;
    // Engagement distance from the player. Most foes open a step out (melee must
    // close; ranged & reach weapons can already strike). An ambush starts closer.
    e.distance = e.distance ?? (opts.startDistance ?? (opts.ambush === "player" ? 1 : 2));
    e.procs = e.procs || e.triggers?.procs || [];
    e.shield = e.shield || 0; e.magicShield = e.magicShield || 0; e.invuln = e.invuln || 0;
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
    turn: 1,
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
    environment: opts.environment || [],
    revivedUsed: false,
    profGains: {},
    log: [logEntry(lethal ? `Combat begins — ${flavor}.` : `A brawl breaks out — ${flavor}. Bare hands, for now.`, "system")],
    loot: null,
  };
  if (opts.ambush) applyAmbush(combatState, opts.ambush);
  // Roll initiative and let any faster foes open before the player's first turn.
  if (combatState.phase === "player") {
    rollInitiative(combatState);
    return advanceQueue(combatState);
  }
  return combatState;
}

// ----- initiative -----

const allCombatants = (cs) => [cs.player, ...(cs.allies || []), ...cs.enemies];
const byUid = (cs, uid) => allCombatants(cs).find((c) => c.uid === uid);
const canAct = (c) => c && c.health > 0 && !c.resolved && !c._dead;

// ----- distance / reach -----

const MAX_DISTANCE = 6;

// The reach (melee) / range (ranged) of an action: an explicit ability range, a
// medium range for spells, else the wielded weapon's reach/range.
function abilityReach(actor, def) {
  if (def.range != null) return def.range;
  if (abilityScaling(def) === "stat") return 3; // spells carry at medium range
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

// Begin one combatant's turn: tick statuses/cooldowns/reload, regen resolve and
// turn-heal, fire start-of-turn procs, resolve stun, and set action points
// (base + swift "act-again" rolls). Returns "dead" | "stun" | "ok".
function beginTurnFor(cs, actor) {
  tickStatuses(actor).forEach((l) => cs.log.push(l));
  if (actor.health <= 0) {
    if (actor === cs.player) { if (playerDown(cs)) return "dead"; }
    else { downActor(cs, actor); return "dead"; }
  }
  const cdr = 1 + (actor.cooldownReduction || 0);
  for (const id of Object.keys(actor.cooldowns || {})) actor.cooldowns[id] = Math.max(0, actor.cooldowns[id] - cdr);
  if (actor.reloadLeft > 0) actor.reloadLeft = Math.max(0, actor.reloadLeft - 1);
  startOfTurn(cs, actor);
  const rr = actor.resolveRegen != null ? actor.resolveRegen : (actor.triggers?.resolveRegen || 0);
  if (actor.resolveMax != null) actor.resolve = Math.min(actor.resolveMax, (actor.resolve || 0) + rr);
  const tr = actor.triggers || {};
  if (tr.turnRegen && actor.health > 0) {
    // turnRegen is a FRACTION of max health (scales with the wearer at every tier).
    const mended = gainHealth(actor, Math.max(1, Math.round(actor.maxHealth * tr.turnRegen)));
    if (mended > 0) cs.log.push(logEntry(`${actor.name} mends ${mended}.`, "status"));
  }
  if (hasStatus(actor, "stun")) {
    cs.log.push(logEntry(`${actor.name} is stunned and cannot act.`, "status"));
    actor.statuses = actor.statuses.filter((s) => s.type !== "stun");
    return "stun";
  }
  // Action points: base + swift "act-again" rolls (each less likely, capped).
  // Slow denies the act-again rolls entirely (and docks initiative, above).
  let extra = 0, chance = hasStatus(actor, "slow") ? 0 : (actor.swiftChance || 0);
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
      cs.phase = "player";
      return cs; // hand control to the UI
    }

    // NPC turn (ally or enemy)
    const r = beginTurnFor(cs, actor);
    cs.orderIdx += 1;
    if (r === "dead") { if (playerDown(cs)) return finishDefeat(cs); continue; }
    if (r === "stun") continue;
    // A fleeing foe spends its turn putting ground between it and the field; once
    // it's far enough it's gone. It doesn't fight — the player must run it down.
    if (actor.side === "enemy" && actor.fleeing) { fleeStep(cs, actor); continue; }
    if (actor.side === "enemy" && !moraleCheck(cs, actor)) continue;
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
    if (isPlayer && attacker.weapon?.category === "arcane") {
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

// Resolve a single hit. Returns { log, dmg, crit, dodged } so callers can fire
// procs (on-crit / on-hit / on-dodge / on-kill) off the outcome.
function resolveHit(attacker, defender, profile) {
  // Chill saps the attacker's accuracy; dodge-stacks add to the defender's dodge.
  const acc = (attacker.accuracy || 0) - sumStatus(attacker, "chill") - (attacker.darkPenalty || 0);
  const dodge = (defender.dodge || 0) + sumStatus(defender, "dodgeStack");
  const hitChance = 100 - clamp(dodge - acc, 0, 90);
  if (rand100() > hitChance) {
    return { log: logEntry(`${attacker.name} attacks ${defender.name} — dodged.`, "miss"), dmg: 0, crit: false, dodged: true };
  }
  let raw = randInt(profile.min, profile.max);
  if (profile.eff != null) raw *= profile.eff;
  raw *= 1 + sumStatus(attacker, "rally") / 100 - sumStatus(attacker, "weaken") / 100;

  const critChance = (attacker.critChance || 0) + (profile.critBonus || 0) + sumStatus(attacker, "focus");
  const crit = rand100() <= critChance;
  if (crit) raw *= attacker.critMult || 1.5;
  if (hasStatus(attacker, "focus")) attacker.statuses = attacker.statuses.filter((s) => s.type !== "focus");

  // Vulnerable and Curse both amplify incoming damage.
  raw *= 1 + (sumStatus(defender, "vulnerable") + sumStatus(defender, "curse")) / 100;
  raw = Math.max(0, Math.round(raw));

  let mitig = 0;
  // Shatter (sundered armour) eats into physical mitigation while it lasts.
  if (profile.type === "physical") mitig = Math.max(0, (defender.armor || 0) + sumStatus(defender, "guard") - sumStatus(defender, "shatter") - (profile.pen || 0));
  else if (profile.type === "magical") mitig = Math.max(0, (defender.ward || 0) - (profile.pen || 0));
  // Flat % damage-reduction (Stoneskin / Godward), plus Bastion fortify while
  // badly wounded. Capped so it can never fully negate a blow.
  let dmg = Math.max(0, raw - mitig);
  let dr = defender.dr || 0;
  if (defender.fortify && defender.maxHealth && defender.health / defender.maxHealth < 0.35) dr += defender.fortify;
  if (dr) dmg = Math.max(0, Math.round(dmg * (1 - Math.min(0.85, dr))));
  // Per-hit cap (damageCap): no single blow may exceed a share of max health.
  // Same rule for every creature — the cap is earned, from a Stonewall affix or a
  // high-vigor threshold. Nothing is boss-specific; Senna and a great-wyrm obey
  // the identical line.
  if (defender.damageCap && defender.maxHealth) dmg = Math.min(dmg, Math.max(1, Math.round(defender.maxHealth * defender.damageCap)));

  // Invulnerability turns the blow aside entirely; otherwise a shield pool soaks
  // it before health (physical → shield, magical → magicShield).
  let blocked = false, absorbed = 0;
  if ((defender.invuln || 0) > 0) { blocked = true; dmg = 0; }
  else if (dmg > 0) {
    if (profile.type === "magical" && (defender.magicShield || 0) > 0) {
      absorbed = Math.min(defender.magicShield, dmg); defender.magicShield -= absorbed; dmg -= absorbed;
    } else if (profile.type !== "magical" && (defender.shield || 0) > 0) {
      absorbed = Math.min(defender.shield, dmg); defender.shield -= absorbed; dmg -= absorbed;
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
  defender.health = Math.max(0, defender.health - dmg);

  const typeTag = profile.type === "true" ? " true" : profile.type === "magical" ? " magical" : "";
  const critTag = crit ? " CRIT" : "";
  const tail = blocked ? " — turned aside (invulnerable)." : (absorbed > 0 && dmg === 0) ? " — shielded." : dmg === 0 ? " — absorbed." : ".";
  return { log: logEntry(`${attacker.name} hits ${defender.name} for ${dmg}${typeTag}${critTag}${tail}`, crit ? "crit" : "hit"), dmg, crit, dodged: false };
}

// The shared per-hit resolution used by BOTH the player and NPCs (the unified
// combat path). Pushes the hit log, applies lifesteal/thorns, fires the
// attacker's on-hit/on-crit/on-kill procs and the defender's on-dodge procs, and
// applies any ability-borne status. Returns { dealt, crit }.
function dealHit(cs, attacker, target, profile, def) {
  const before = target.health;
  const res = resolveHit(attacker, target, profile);
  cs.log.push(res.log);
  const dealt = before - target.health;
  const targetIsPlayer = target === cs.player;
  if (targetIsPlayer) addProf(cs, "evasion", XP.EVASION); // exercising evasion (even on a dodge)

  if (res.dodged) {
    fireProcs(cs, target, "onDodge", {});
    return { dealt: 0, crit: false };
  }

  if (dealt > 0) {
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
  }

  if (target.health > 0 && def && def.effect && def.effect.target === "enemy") {
    addStatus(target, def.effect);
    if (CONTROL_TYPES.has(def.effect.type) && target.side === "enemy") onEnemyControlled(target);
  }

  if (target.health <= 0 && !targetIsPlayer) fireProcs(cs, attacker, "onKill", { target });
  return { dealt, crit: res.crit };
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
  // Undying (divine): a fabled foe cheats death once, clawing back at half health.
  const rev = e.triggers?.reviveOnce;
  if (rev && !e._revived && e.health <= 0) {
    e._revived = true;
    e.health = Math.max(1, Math.round(e.maxHealth * rev));
    cs.log.push(logEntry(`${e.name} should be dead — and rises anyway.`, "enemy"));
    return;
  }
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

// Self-targeted ability effects — shared by the player and NPCs so defensive and
// tempo abilities (shields, ward, invuln, an extra action) work the same for all.
// Living combatants on the actor's own side (for party-target support spells).
function sideAllies(cs, actor) {
  const list = actor.side === "enemy"
    ? cs.enemies
    : [cs.player, ...(cs.allies || [])];
  return list.filter((c) => c && c.health > 0 && !c.resolved && !c._dead);
}

function applySelfEffect(actor, effect) {
  if (!effect) return;
  // `pctMax` heals/shields are a FRACTION of the target's max health, so support
  // stays meaningful at every scale (a flat +16 is noise next to a raid's HP).
  const val = effect.pctMax ? Math.max(1, Math.round((actor.maxHealth || 0) * (effect.value || 0))) : (effect.value || 0);
  switch (effect.type) {
    case "shield":      actor.shield = (actor.shield || 0) + val; break;
    case "magicShield": actor.magicShield = (actor.magicShield || 0) + val; break;
    case "invuln":      actor.invuln = Math.max(actor.invuln || 0, effect.duration || 1); break;
    // Unstoppable (BKB): debuff immunity AND damage immunity (invuln already turns
    // aside ALL damage, true included) for the duration — the answer to an alpha.
    case "unstoppable": { const d = effect.duration || 2; actor.invuln = Math.max(actor.invuln || 0, d); addStatus(actor, { type: "unstoppable", duration: d }); break; }
    case "bonusAction": actor.actionsLeft = (actor.actionsLeft || 0) + (effect.value || 1); break;
    case "regen":       addStatus(actor, { ...effect, value: val, pctMax: false }); break; // bank the %-of-max as flat/turn
    default:            addStatus(actor, effect);
  }
}

// Usable abilities for an NPC (ally or enemy): off cooldown AND affordable on the
// actor's resolve (spells drain resolve; martial techniques are gated by action
// points + cooldown only — the same economy the player uses).
function npcCandidates(actor) {
  if (hasStatus(actor, "silence")) return []; // silenced foes fall back to basic attacks
  const out = [];
  for (const a of (actor.abilities || [])) {
    if ((actor.cooldowns?.[a.id] || 0) > 0) continue;
    const def = getAbilityDef(a.id);
    if (!def) continue;
    if (actor.resolve != null && (def.resolveCost || 0) > actor.resolve) continue;
    out.push({ id: a.id, tier: a.tier || actor.tier || "common", def });
  }
  return out;
}

// Execute ONE action for an NPC actor (ally or enemy) against `opponents`. The
// caller (advanceQueue) loops this up to the actor's action points — the same
// economy the player uses. Spends resolve (spells) + cooldown + one action.
// Returns true if it acted (so the caller can keep spending action points).
function npcPerform(cs, actor, opponents) {
  if ((actor.actionsLeft || 0) <= 0) return false;
  const choice = chooseAction(actor, opponents, npcCandidates(actor), { allies: sideAllies(cs, actor) });
  if (!choice) return false;
  const { def, ability, mode } = choice;
  const tId = ability.tier || actor.tier || "common";
  // Distance gate: charge the last step (close + strike) when one step out, else
  // spend the action just closing in.
  if (mode === "single") {
    let mt = choice.target;
    if (!mt || mt.health <= 0 || mt.resolved || mt._dead) mt = opponents.find((o) => o.health > 0 && !o.resolved && !o._dead);
    if (mt) {
      const reach = abilityReach(actor, def);
      if (gap(actor, mt) > reach + 1) {
        actor.actionsLeft = (actor.actionsLeft || 1) - 1;
        closeStep(cs, actor, mt);
        cs.log.push(logEntry(`${actor.name} ${actor.side === "enemy" ? "advances" : "closes in"}.`, actor.side === "player" ? "player" : "enemy"));
        return true;
      }
      if (gap(actor, mt) > reach) closeStep(cs, actor, mt); // charge the final step, then strike below
    }
  }
  if (def.cooldown) actor.cooldowns[ability.id] = def.cooldown;
  if (actor.resolve != null) actor.resolve = Math.max(0, actor.resolve - (def.resolveCost || 0));
  actor.actionsLeft = (actor.actionsLeft || 1) - (def.actionCost || 1);
  const sideKind = actor.side === "player" ? "player" : "enemy";

  const hitOne = (target) => {
    const profile = attackProfile(actor, def, tId, false);
    if (profile) dealHit(cs, actor, target, profile, def);
    else if (def.effect && def.effect.target === "enemy" && target.health > 0) {
      addStatus(target, def.effect);
      if (CONTROL_TYPES.has(def.effect.type) && target.side === "enemy") onEnemyControlled(target);
    }
  };

  if (mode === "self") {
    applySelfEffect(actor, def.effect);
    cs.log.push(logEntry(`${actor.name} uses ${def.name}.`, sideKind));
  } else if (mode === "all-allies") {
    cs.log.push(logEntry(`${actor.name} uses ${def.name}.`, sideKind));
    for (const al of sideAllies(cs, actor)) applySelfEffect(al, def.effect);
  } else if (mode === "aoe") {
    cs.log.push(logEntry(`${actor.name} uses ${def.name}.`, sideKind));
    for (const t of opponents) if (t.health > 0 && !t.resolved && !t._dead) hitOne(t);
  } else {
    let target = choice.target;
    if (!target || target.health <= 0 || target.resolved || target._dead) target = opponents.find((o) => o.health > 0 && !o.resolved && !o._dead);
    if (!target) { actor.actionsLeft = 0; return false; }
    if (ability.id !== BASIC_ATTACK.id) cs.log.push(logEntry(`${actor.name} uses ${def.name}.`, sideKind));
    const hits = def.hits || 1;
    for (let h = 0; h < hits; h++) { if (target.health <= 0) break; hitOne(target); }
  }

  // Down anyone reduced to 0 (the player is left for the caller's playerDown).
  for (const t of opponents) {
    if (t.health > 0 || t === cs.player) continue;
    if (t.side === "enemy") downEnemy(cs, t); else downAlly(cs, t);
  }
  return true;
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
  // Damage-over-time: bleed/poison/burn (+ lingering deferred wounds). A status can
  // be FLAT (value) or pctMax (a share of the victim's MAX health each turn) — the
  // latter is how a build chips down a huge-pool monster (Vyrnholt) it can't burst.
  let dot = 0;
  for (const s of (c.statuses || [])) {
    if (!["bleed", "poison", "burn", "lingering"].includes(s.type)) continue;
    dot += s.pctMax ? Math.max(1, Math.round(c.maxHealth * (s.value || 0))) : (s.value || 0);
  }
  if (dot > 0) {
    c.health = Math.max(0, c.health - dot);
    logs.push(logEntry(`${c.name} suffers ${dot} from bleed/poison/burn.`, "status"));
  }
  const healAmt = sumStatus(c, "regen");
  if (healAmt > 0 && c.health > 0) {
    const got = gainHealth(c, healAmt);
    if (got > 0) logs.push(logEntry(`${c.name} recovers ${got}.`, "status"));
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
  if (!combatOver(cs)) return cs; // foes still fighting/fleeing, or a captive awaits a verdict
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
  if ((cs.player.actionsLeft || 0) < (def.actionCost || 1)) return false; // action points gate everything now
  // Silenced: only the basic strike and brace remain — no learned abilities.
  if (hasStatus(cs.player, "silence") && abilityId !== BASIC_ATTACK.id && abilityId !== "defend") return false;
  if ((cs.player.cooldowns[abilityId] || 0) > 0) return false;
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
  // Distance gate: a single-target action only lands within the ability's
  // reach/range. One step out → CHARGE (close the last step and strike in the
  // same action). Farther → spend the action just closing in (no cost).
  if (def.target !== "self" && def.target !== "all-enemies" && def.target !== "all-allies") {
    let gi = targetIndex;
    if (gi == null || !playerTargetable(cs.enemies[gi])) gi = cs.enemies.findIndex((e) => e.health > 0 && !e.resolved);
    const gt = gi >= 0 ? cs.enemies[gi] : null;
    if (gt) {
      const reach = abilityReach(cs.player, def);
      if ((gt.distance || 0) > reach + 1) {
        cs.player.actionsLeft = (cs.player.actionsLeft || 1) - (def.actionCost || 1);
        closeStep(cs, cs.player, gt);
        cs.log.push(logEntry(`${cs.player.name} closes the distance.`, "player"));
        return cs;
      }
      if ((gt.distance || 0) > reach) closeStep(cs, cs.player, gt); // charge the final step, then strike
    }
  }
  // A spell or a real weapon technique is inherently a killing act — using one
  // in a brawl escalates it to lethal on its own (no separate Draw needed).
  const isSpell = scaling === "stat";
  const isWeaponTech = scaling === "weapon" && def.weaponReq && def.weaponReq.length > 0;
  // Innate racial powers (dragon breath, hellfire, etc.) aren't "witchcraft" — they
  // don't trigger the dread-of-magic reaction, though they still escalate a brawl.
  if (isSpell && !def.innate) cs.magicCast = true;
  if (!cs.lethal && (isSpell || isWeaponTech)) escalateToLethal(cs, isSpell ? "magic" : "weapon");
  cs.player.actionsLeft = (cs.player.actionsLeft || 1) - (def.actionCost || 1); // action points gate actions
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

  // Shared resolution path: lifesteal, thorns, statuses, and synergy procs all
  // run through dealHit, exactly as they do for NPCs. No-damage debuffs (Hex,
  // Curse…) have no profile — apply their effect directly.
  const hitEnemy = (target) => {
    if (profile) dealHit(cs, cs.player, target, profile, def);
    else if (def.effect && def.effect.target === "enemy" && target.health > 0) {
      addStatus(target, def.effect);
      if (CONTROL_TYPES.has(def.effect.type) && target.side === "enemy") onEnemyControlled(target);
    }
  };

  if (def.target === "self") {
    applySelfEffect(cs.player, def.effect);
    cs.log.push(logEntry(`${cs.player.name} uses ${def.name}.`, "player"));
  } else if (def.target === "all-allies") {
    cs.log.push(logEntry(`${cs.player.name} uses ${def.name}.`, "player"));
    for (const al of sideAllies(cs, cs.player)) applySelfEffect(al, def.effect);
  } else if (def.target === "all-enemies") {
    cs.log.push(logEntry(`${cs.player.name} uses ${def.name}.`, "player"));
    for (const e of cs.enemies) { if (e.health > 0 && !e.resolved) hitEnemy(e); }
  } else {
    let idx = targetIndex;
    if (idx == null || !playerTargetable(cs.enemies[idx])) {
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
  cs.player.actionsLeft = (cs.player.actionsLeft || 1) - 1; // talking is your action this turn
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
  if ((cs0.player.actionsLeft || 0) < 1) return cs0; // costs an action point
  const cs = clone(cs0);
  const feat = cs.environment.find((f) => f.id === featureId);
  cs.player.actionsLeft = (cs.player.actionsLeft || 1) - 1;
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
  if (!playerTargetable(cs0.enemies[idx])) return cs0; // alive foes, plus a yielded one to execute
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

// The player has finished their turn (spent their actions or chose to end it).
// Step past the player's slot and resolve the rest of the initiative order —
// allies and foes acting in speed order, round after round — until it's the
// player's turn again or the fight ends.
export function endTurn(cs0) {
  if (cs0.phase !== "player") return cs0;
  const cs = clone(cs0);
  cs.orderIdx = (cs.orderIdx || 0) + 1; // move past the player's slot
  return advanceQueue(cs);
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

// Reposition: give ground (open the distance from every foe — the ranged kiting
// lever) or close in. Both cost an action point.
export function playerWithdraw(cs0) {
  if (cs0.phase !== "player" || (cs0.player.actionsLeft || 0) < 1) return cs0;
  const cs = clone(cs0);
  cs.player.actionsLeft -= 1;
  for (const e of cs.enemies) if (e.health > 0 && !e.resolved) e.distance = Math.min(MAX_DISTANCE, (e.distance || 0) + 1);
  cs.log.push(logEntry(`${cs.player.name} gives ground, opening the distance.`, "player"));
  return cs;
}
export function playerAdvance(cs0) {
  if (cs0.phase !== "player" || (cs0.player.actionsLeft || 0) < 1) return cs0;
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
  if (!cs || cs.phase !== "player") return false;
  if (liveAttackers(cs).length > 0) return false;
  return pendingCaptives(cs).length > 0 || livingEnemies(cs).some((e) => e.fleeing);
}

// Once a fight has dragged into a stalemate (CEASEFIRE_TURN), a thinking foe's
// truce offer stays on the table — the player can break off to a wary DRAW.
export function canCeasefire(cs) {
  return !!(cs && cs.phase === "player" && cs.ceasefire);
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

const TIER_ADJ = {
  common: "Plain", uncommon: "Fine", rare: "Keen", "very-rare": "Runed",
  epic: "Storied", legendary: "Fabled", mythical: "Mythic", divine: "Hallowed",
};

// Every wearable slot is droppable at every tier, so loot can fill the whole
// paper-doll — not just weapon/armor/trinket. Each entry carries its `kind`,
// explicit `slot`, name nouns, and a tier-scaled stat block (m = tier multiplier).
const r = (v) => Math.max(1, Math.round(v));
const LOOT_TYPES = [
  { kind: "weapon",   slot: "mainhand", nouns: ["Blade", "Edge", "Fang", "Cleaver", "Spike", "Talon"], combat: (m) => ({ damage: { min: r(3 * m), max: r(6 * m), type: "physical", pen: Math.round(m) } }) },
  { kind: "shield",   slot: "offhand",  nouns: ["Buckler", "Targe", "Roundshield", "Wall"],            combat: (m) => ({ armor: r(2.4 * m) }) },
  { kind: "armor",    slot: "body",     nouns: ["Hauberk", "Cuirass", "Carapace", "Brigandine"],       combat: (m) => ({ armor: r(3 * m) }) },
  { kind: "clothing", slot: "head",     nouns: ["Helm", "Cap", "Coif", "Circlet"],                     combat: (m) => ({ armor: r(1.2 * m) }) },
  { kind: "clothing", slot: "hands",    nouns: ["Gauntlets", "Bracers", "Gloves"],                     combat: (m) => ({ armor: r(1 * m) }) },
  { kind: "clothing", slot: "legs",     nouns: ["Greaves", "Leggings", "Chausses"],                    combat: (m) => ({ armor: r(1.5 * m) }) },
  { kind: "clothing", slot: "feet",     nouns: ["Boots", "Sabatons", "Treads"],                        combat: (m) => ({ armor: r(0.8 * m), dodge: r(0.6 * m) }) },
  { kind: "clothing", slot: "back",     nouns: ["Cloak", "Cape", "Mantle"],                            combat: (m) => ({ ward: r(1 * m), dodge: r(0.8 * m) }) },
  { kind: "clothing", slot: "over",     nouns: ["Robe", "Vestment", "Surcoat"],                        combat: (m) => ({ ward: r(2 * m) }) },
  { kind: "clothing", slot: "torso",    nouns: ["Tunic", "Jerkin", "Gambeson"],                        combat: (m) => ({ armor: r(1 * m), ward: r(1 * m) }) },
  { kind: "trinket",  slot: "neck",     nouns: ["Amulet", "Pendant", "Torc", "Charm"],                 combat: (m) => ({ ward: r(2 * m) }) },
  { kind: "trinket",  slot: "ring",     nouns: ["Ring", "Band", "Signet"],                             combat: (m) => ({ ward: r(1 * m), dodge: r(0.8 * m) }) },
];

function generateLootItem(tierId) {
  const t = LOOT_TYPES[Math.floor(Math.random() * LOOT_TYPES.length)];
  const noun = t.nouns[Math.floor(Math.random() * t.nouns.length)];
  const name = `${TIER_ADJ[tierId] || "Plain"} ${noun}`;
  const id = `${tierId}-${noun.toLowerCase()}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    entry: {
      id, name, kind: t.kind, slot: t.slot, tier: tierId,
      appearance: `${tierLabel(tierId)}-grade ${noun.toLowerCase()}, taken in battle.`,
      description: `A ${tierLabel(tierId).toLowerCase()} ${noun.toLowerCase()} recovered from a foe.`,
      combat: t.combat(tierMult(tierId)),
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
    // Floor-gated apex abilities only drop where the loot ceiling can support
    // their minimum grade — never as a weak low-tier copy; otherwise clamp up.
    const minOrd = def?.minTier ? tierInfo(def.minTier).order : 0;
    if (tierInfo(maxTier).order >= minOrd) {
      let tier = rollTier(maxTier, 0.2);
      if (tierInfo(tier).order < minOrd) tier = def.minTier;
      ability = { id, tier, name: def?.name || id };
    }
  }

  // Named/unique drops from specific foe kinds + deep regions (never the random
  // pool). A unique ability supersedes the random one; a unique item is extra.
  if (sources.length > 0) {
    const uniq = rollUniques({ kinds: sources.map((e) => e.kind), region, owned, mult: UNIQUE_DROP_CHANCE });
    if (uniq.item) items.push(uniq.item);
    if (uniq.ability) ability = uniq.ability;
  }

  // Forge-runes (affix-Fusion catalyst) — rare trophies of the mighty: deep
  // regions, epic+ loot ceiling, low chance. Never bought; only earned.
  if (sources.length > 0 && region >= RUNE_DROP_MIN_REGION && tierInfo(maxTier).order >= tierInfo("epic").order && Math.random() < RUNE_DROP_CHANCE) {
    const runeIds = Object.keys(RUNES).filter((id) => id !== "greater-rune-of-ascension");
    const rune = RUNES[runeIds[Math.floor(Math.random() * runeIds.length)]];
    items.push({ itemId: rune.id, entry: rune, quantity: 1 });
  }
  // The god-forged apex rune (divine-tier fusion catalyst) — only off divine-grade
  // kills, vanishingly rare. The reward for slaying the fabled.
  if (sources.length > 0 && tierInfo(maxTier).order >= tierInfo("divine").order && Math.random() < RUNE_DROP_CHANCE * 0.4) {
    const gr = RUNES["greater-rune-of-ascension"];
    items.push({ itemId: gr.id, entry: gr, quantity: 1 });
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
    const status = e._dead ? "dead" : e.resolved === "yielded" ? "yielded" : (e.resolved === "fled" || e.fleeing) ? "fled" : (e.health < e.maxHealth ? "wounded" : "ok");
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
    cs.standoff ? "it ground to a STALEMATE — neither side could best the other, and both broke off in a wary, exhausted draw (no victor, no spoils)" :
    cs.phase === "victory" ? "you won" :
    cs.phase === "defeat" ? "you were beaten down and went under" :
    cs.phase === "resolved" ? "it ended without a slaughter" :
    cs.phase === "playerFled" ? "you broke off and fled" : "it ended";
  // Fate is the foe's ACTUAL resolution, not raw HP — a foe that yielded, fled,
  // or was knocked out is ALIVE even at 0-ish health, and must never be narrated
  // (or have a companion narrated) as killed.
  const foes = cs.enemies.map((e) => {
    const st = e.executed ? "EXECUTED — cut down by the player AFTER it had surrendered, disarmed and defenceless (a cold, deliberate killing)"
      : e._dead ? "slain in the fighting"
      : e.resolved === "yielded" ? "YIELDED then SPARED — alive, disarmed, a captive at the player's mercy (do NOT kill it)"
      : e.resolved === "fled" ? "FLED — escaped alive, off the field"
      : e.fleeing ? "FLEEING — broke and ran"
      : e.resolved === "ko" ? "knocked out — alive, unconscious"
      : e.health <= 0 ? "down, gravely wounded but not dead"
      : `still standing (${Math.ceil(e.health)}/${e.maxHealth})`;
    return `${e.name} [${e.tier}, ${e.demeanor}] — ${st}`;
  }).join("; ");
  const executeNote = cs.executedCount
    ? ` NOTE: the player EXECUTED ${cs.executedCount} foe${cs.executedCount === 1 ? "" : "s"} who had already surrendered and were defenceless — a cold, ugly act. Any companions and witnesses should react accordingly (unease, horror, judgement, fear of the player), and it may stain the player's standing or conscience.`
    : "";
  const spareNote = cs.spared ? " The player SPARED the foe(s) who yielded — they live, disarmed and at the player's mercy (captive, free to be questioned, ransomed, recruited, or released)." : "";
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
  return `[COMBAT REPORT] ${context.flavor || "A fight"} — ${outcome}. You fought exactly ${n} foe${n === 1 ? "" : "s"} (this is the full roster — narrate only these, by these EXACT fates): ${foes}.${allyNote} Honour each fate precisely: do NOT kill a foe that yielded, fled, or was knocked out, do not have a companion finish one off, and do not raise, revive, or invent foes. Only foes marked "slain" or "executed" died.${executeNote}${spareNote} You ended at ${Math.ceil(cs.player.health)}/${cs.player.maxHealth} HP. Blow-by-blow: ${account}.${magicNote}`.slice(0, 1800);
}
