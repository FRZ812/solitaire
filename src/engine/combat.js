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

import { getAbilityDef, attrFactor, BASIC_ATTACK, DEFEND, randomAbilityId } from "../data/abilities.js";
import { tierMult, rollTier, tierLabel, tier as tierInfo } from "../data/tiers.js";
import { deriveCombatStats } from "./combat-stats.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const rand100 = () => Math.random() * 100;
const clone = (x) => JSON.parse(JSON.stringify(x));
let LOG_SEQ = 0;
const logEntry = (text, kind = "system") => ({ id: `l${Date.now()}-${LOG_SEQ++}`, text, kind });

function sumStatus(c, type) {
  return (c.statuses || []).filter((s) => s.type === type).reduce((s, x) => s + (x.value || 0), 0);
}
function hasStatus(c, type) { return (c.statuses || []).some((s) => s.type === type); }
function addStatus(c, effect) {
  if (!effect) return;
  c.statuses = c.statuses || [];
  c.statuses.push({ type: effect.type, value: effect.value || 0, duration: effect.duration || 1 });
}

// ----- setup -----

export function initCombat(character, codex, enemies) {
  LOG_SEQ = 0;
  const cs = deriveCombatStats(character, codex);
  const learned = Array.isArray(character.abilities) ? character.abilities : [];
  const abilities = [
    { id: BASIC_ATTACK.id, tier: "common" },
    { id: DEFEND.id, tier: "common" },
    ...learned.map((e) => (typeof e === "string" ? { id: e, tier: "common" } : { id: e.id, tier: e.tier || "common" })),
  ].filter((a) => getAbilityDef(a.id));

  const player = {
    name: character.name || "You",
    health: Math.round(character.vitality),
    maxHealth: cs.maxHealth,
    stamina: cs.maxStamina,
    maxStamina: cs.maxStamina,
    staminaRegen: cs.staminaRegen,
    armor: cs.armor, ward: cs.ward, dodge: cs.dodge,
    accuracy: cs.accuracy, critChance: cs.critChance, critMult: cs.critMult,
    weapon: cs.weapon, speed: cs.speed,
    attrs: { ...character.attributes },
    abilities, cooldowns: {}, statuses: [],
  };

  const flavor = enemies.length === 1 ? enemies[0].name : `${enemies.length} foes`;
  return {
    player,
    enemies: clone(enemies),
    target: 0,
    turn: 1,
    phase: "player",
    log: [logEntry(`Combat begins — ${flavor}.`, "system")],
    loot: null,
  };
}

// ----- damage resolution -----

function attackProfile(attacker, def, tierId, isPlayer) {
  if (def.damageType === "weapon") {
    const w = attacker.weapon || { min: 1, max: 2, type: "physical", pen: 0 };
    return { min: w.min, max: w.max, type: w.type, pen: w.pen || 0, critBonus: def.critBonus || 0 };
  }
  if (!def.dmg) return null;
  const m = tierMult(tierId);
  const f = isPlayer && def.scaleAttr && attacker.attrs ? attrFactor(attacker.attrs[def.scaleAttr]) : 1;
  return {
    min: Math.max(1, Math.round(def.dmg[0] * m * f)),
    max: Math.max(1, Math.round(def.dmg[1] * m * f)),
    type: def.damageType, pen: def.pen || 0, critBonus: def.critBonus || 0,
  };
}

// Resolve a single hit; mutates defender + attacker (focus consumed). Returns a
// log line.
function resolveHit(attacker, defender, profile) {
  const hitChance = 100 - clamp((defender.dodge || 0) - (attacker.accuracy || 0), 0, 90);
  if (rand100() > hitChance) {
    return logEntry(`${attacker.name} attacks ${defender.name} — dodged.`, "miss");
  }
  let raw = randInt(profile.min, profile.max);
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
  const tail = dmg === 0 ? " — absorbed." : `.`;
  return logEntry(`${attacker.name} hits ${defender.name} for ${dmg}${typeTag}${critTag}${tail}`, crit ? "crit" : (attacker === undefined ? "system" : "hit"));
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

// ----- player actions -----

export function abilityUsable(cs, abilityId) {
  if (cs.phase !== "player") return false;
  const entry = cs.player.abilities.find((a) => a.id === abilityId);
  if (!entry) return false;
  const def = getAbilityDef(abilityId);
  if ((cs.player.cooldowns[abilityId] || 0) > 0) return false;
  if (cs.player.stamina < (def.cost || 0)) return false;
  return true;
}

export function playerAct(cs0, abilityId, targetIndex) {
  if (!abilityUsable(cs0, abilityId)) return cs0;
  const cs = clone(cs0);
  const def = getAbilityDef(abilityId);
  const entry = cs.player.abilities.find((a) => a.id === abilityId);
  const tierId = entry.tier || "common";
  cs.player.stamina -= def.cost || 0;
  if (def.cooldown) cs.player.cooldowns[abilityId] = def.cooldown;

  // Brace recovers a little stamina alongside the guard buff.
  if (abilityId === DEFEND.id) {
    cs.player.stamina = Math.min(cs.player.maxStamina, cs.player.stamina + 2);
  }

  const profile = attackProfile(cs.player, def, tierId, true);
  const living = () => cs.enemies.filter((e) => e.health > 0);

  if (def.target === "self") {
    if (def.effect) addStatus(cs.player, def.effect);
    cs.log.push(logEntry(`${cs.player.name} uses ${def.name}.`, "player"));
  } else if (def.target === "all-enemies") {
    cs.log.push(logEntry(`${cs.player.name} uses ${def.name}.`, "player"));
    for (const e of cs.enemies) {
      if (e.health <= 0) continue;
      if (profile) cs.log.push(resolveHit(cs.player, e, profile));
      if (e.health > 0 && def.effect && def.effect.target === "enemy") addStatus(e, def.effect);
    }
  } else {
    // single enemy target
    let idx = targetIndex;
    if (idx == null || !cs.enemies[idx] || cs.enemies[idx].health <= 0) {
      const firstAlive = cs.enemies.findIndex((e) => e.health > 0);
      idx = firstAlive;
    }
    if (idx < 0) return cs0;
    const target = cs.enemies[idx];
    if (abilityId !== BASIC_ATTACK.id) cs.log.push(logEntry(`${cs.player.name} uses ${def.name}.`, "player"));
    const hits = def.hits || 1;
    for (let h = 0; h < hits; h++) {
      if (target.health <= 0) break;
      if (profile) cs.log.push(resolveHit(cs.player, target, profile));
    }
    if (target.health > 0 && def.effect && def.effect.target === "enemy") addStatus(target, def.effect);
  }

  // Drop dead enemies' lingering note + retarget.
  for (const e of cs.enemies) if (e.health <= 0 && !e._dead) { e._dead = true; cs.log.push(logEntry(`${e.name} falls.`, "system")); }
  if (living().length === 0) return finishVictory(cs);
  const firstAlive = cs.enemies.findIndex((e) => e.health > 0);
  if (cs.enemies[cs.target]?.health <= 0 && firstAlive >= 0) cs.target = firstAlive;
  return cs;
}

export function setTarget(cs0, idx) {
  if (!cs0.enemies[idx] || cs0.enemies[idx].health <= 0) return cs0;
  return { ...cs0, target: idx };
}

// ----- enemy phase + turn advance -----

function enemyChooseAbility(enemy) {
  const usable = (enemy.abilities || []).filter((a) => (enemy.cooldowns[a.id] || 0) <= 0 && getAbilityDef(a.id));
  // Prefer a self-heal when hurt.
  const heal = usable.find((a) => { const d = getAbilityDef(a.id); return d.effect?.type === "regen"; });
  if (heal && enemy.health < enemy.maxHealth * 0.4) return heal;
  const offensive = usable.filter((a) => { const d = getAbilityDef(a.id); return d.target !== "self"; });
  if (offensive.length && Math.random() < 0.6) return offensive[Math.floor(Math.random() * offensive.length)];
  return null; // basic attack
}

export function endTurn(cs0) {
  if (cs0.phase !== "player") return cs0;
  const cs = clone(cs0);
  cs.phase = "enemy";

  for (let i = 0; i < cs.enemies.length; i++) {
    const e = cs.enemies[i];
    if (e.health <= 0) continue;
    // Stun: lose the turn (then let it tick off).
    if (hasStatus(e, "stun")) {
      cs.log.push(logEntry(`${e.name} is stunned and cannot act.`, "status"));
      e.statuses = e.statuses.filter((s) => s.type !== "stun");
      tickStatuses(e).forEach((l) => cs.log.push(l));
      if (e.health <= 0 && !e._dead) { e._dead = true; cs.log.push(logEntry(`${e.name} falls.`, "system")); }
      continue;
    }
    tickStatuses(e).forEach((l) => cs.log.push(l));
    if (e.health <= 0) { if (!e._dead) { e._dead = true; cs.log.push(logEntry(`${e.name} falls.`, "system")); } continue; }
    for (const id of Object.keys(e.cooldowns)) e.cooldowns[id] = Math.max(0, e.cooldowns[id] - 1);

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
      if (profile) cs.log.push(resolveHit(e, cs.player, profile));
      if (cs.player.health > 0 && def.effect && def.effect.target === "enemy") addStatus(cs.player, def.effect);
    }
    if (cs.player.health <= 0) return finishDefeat(cs);
  }

  // Advance to the next player turn.
  cs.turn += 1;
  cs.phase = "player";
  tickStatuses(cs.player).forEach((l) => cs.log.push(l));
  if (cs.player.health <= 0) return finishDefeat(cs);
  cs.player.stamina = Math.min(cs.player.maxStamina, cs.player.stamina + cs.player.staminaRegen);
  for (const id of Object.keys(cs.player.cooldowns)) cs.player.cooldowns[id] = Math.max(0, cs.player.cooldowns[id] - 1);
  if (cs.enemies.every((e) => e.health <= 0)) return finishVictory(cs);
  cs.log.push(logEntry(`— Turn ${cs.turn} —`, "system"));
  return cs;
}

export function playerFlee(cs0) {
  if (cs0.phase !== "player") return cs0;
  const cs = clone(cs0);
  const enemySpeed = Math.max(...cs.enemies.filter((e) => e.health > 0).map((e) => e.speed || 4), 1);
  const chance = clamp(45 + (cs.player.speed - enemySpeed) * 6, 15, 90);
  if (rand100() <= chance) {
    cs.phase = "fled";
    cs.log.push(logEntry(`You break away and escape.`, "system"));
    return cs;
  }
  cs.log.push(logEntry(`You fail to escape!`, "system"));
  return endTurn(cs); // enemies get a free round
}

// ----- outcomes + loot -----

function finishVictory(cs) {
  cs.phase = "victory";
  cs.loot = rollLoot(cs.enemies);
  cs.log.push(logEntry(`Victory.`, "system"));
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
      description: `A ${tierLabel(tierId).toLowerCase()} ${kind} recovered from a defeated foe.`,
      combat,
    },
  };
}

export function rollLoot(enemies) {
  let copper = 0;
  let maxTier = "common";
  for (const e of enemies) {
    const ord = tierInfo(e.tier).order;
    copper += randInt(2, 8) * (1 + ord);
    if (tierInfo(e.tier).order > tierInfo(maxTier).order) maxTier = e.tier;
    if (tierInfo(e.maxLootTier).order > tierInfo(maxTier).order) maxTier = e.maxLootTier;
  }
  const items = [];
  if (Math.random() < 0.55) {
    const t = rollTier(maxTier, 0.1);
    const li = generateLootItem(t);
    items.push({ itemId: li.id, entry: li.entry, quantity: 1 });
  }
  let ability = null;
  if (Math.random() < 0.22) {
    const t = rollTier(maxTier, 0.2);
    const id = randomAbilityId();
    const def = getAbilityDef(id);
    ability = { id, tier: t, name: def?.name || id };
  }
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
  // A loss leaves you gravely wounded, not dead — the story goes on.
  if (cs.phase === "defeat") next.character.vitality = Math.max(1, next.character.vitality);

  // Lingering damage-over-time becomes a narrative condition.
  const conds = new Set((next.character.conditions || []).filter((c) => c !== "Wet"));
  for (const c of (next.character.conditions || [])) conds.add(c);
  if (hasStatus(cs.player, "bleed")) conds.add("Bleeding");
  if (hasStatus(cs.player, "poison")) conds.add("Poisoned");
  if (cs.phase === "defeat") { conds.add("Gravely Wounded"); conds.add("Bleeding"); }
  next.character.conditions = Array.from(conds);

  const enemyName = context.flavor || (cs.enemies[0]?.name) || "the enemy";
  if (cs.phase === "victory") {
    beats.push({ id: `cb${now}`, type: "narration", content: `The fight ends. ${enemyName} lies defeated. You stand, breathing hard, and take stock of your wounds.` });
  } else if (cs.phase === "fled") {
    beats.push({ id: `cb${now}`, type: "narration", content: `You break off the fight and slip away, heart pounding, before it can be finished.` });
  } else if (cs.phase === "defeat") {
    beats.push({ id: `cb${now}`, type: "narration", content: `The fight goes against you. You fall — and the world narrows to dark. That you draw breath at all is its own small mercy.` });
  }

  if (cs.phase === "victory" && cs.loot) {
    const loot = cs.loot;
    // Items into codex + inventory.
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

    // Learned ability.
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
