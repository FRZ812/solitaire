// Solitaire's world → Tower of Winter actors.
//
// The kernel is a faithful port of Tower of Winter's mechanics, but the fights it has to
// run are Solitaire's: characters built from attributes, proficiencies and worn gear, and
// enemies from the bestiary. This module is the only place the two vocabularies meet, so
// the kernel never learns about attributes and the world never learns about Steelskin.
//
// Every mapping choice below is a judgement, not evidence, and is marked as such.

import { deriveCombatStats } from "../../engine/combat-stats.js";
import { createStatusStack } from "../kernel/status-stack.js";

export const PROVISIONAL_BRIDGE_POLICY = Object.freeze({
  // Tower of Winter actors have one attack number; Solitaire weapons have a damage band.
  // The midpoint keeps expected damage identical while the kernel's own variance and crit
  // supply the swing.
  attackFromWeapon: "midpoint",

  // DEF in Tower of Winter is what Block turns into shield and what Tenacity raises. It is
  // not flat mitigation — Steelskin and Protection are. So armour and ward sum into DEF
  // and express themselves through Block rather than silently soaking every hit. If real
  // fights read too swingy, granting opening Steelskin from armour is the lever to pull,
  // and it belongs here rather than inside the resolver.
  defenseFromArmourAndWard: "sum",
  armourGrantsOpeningSteelskin: false,

  // Solitaire dodge is capped at 70 and crit at 100 upstream; both already sit inside the
  // kernel's 0..100 rate range, so they carry across unchanged.
  ratesCarryAcross: true,

  evidence: "bridge-policy",
});

function clampRate(value) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
}

function positiveInt(value, fallback = 1) {
  const rounded = Math.round(Number(value));
  return Number.isFinite(rounded) && rounded > 0 ? rounded : fallback;
}

function nonNegativeInt(value) {
  const rounded = Math.round(Number(value));
  return Number.isFinite(rounded) && rounded > 0 ? rounded : 0;
}

/**
 * Build the Tower of Winter player actor for a Solitaire character.
 *
 * @param {object} character
 * @param {object} codex world codex, for equipped gear
 * @param {{id?: string}} options
 */
export function towPlayerFromCharacter(character, codex = {}, { id = "player" } = {}) {
  const stats = deriveCombatStats(character, codex);
  const maxHp = positiveInt(stats.maxHealth);
  // Current vitality carries over, lifted by whatever the gear adds above the base pool so
  // equipping armour does not read as arriving already wounded.
  const baseMaxHp = positiveInt(character.vitalityMax, maxHp);
  const healthBonus = Math.max(0, maxHp - baseMaxHp);
  const hp = Math.max(0, Math.min(maxHp, Math.round(character.vitality ?? maxHp) + healthBonus));

  return {
    id,
    name: character.name || "Wanderer",
    side: "player",
    hp,
    maxHp,
    shield: 0,
    stats: {
      attack: positiveInt((stats.weapon.min + stats.weapon.max) / 2),
      defense: nonNegativeInt((stats.armor || 0) + (stats.ward || 0)),
      critRate: clampRate(stats.critChance),
      dodgeRate: clampRate(stats.dodge),
    },
    statuses: createStatusStack(),
  };
}

/**
 * Build a Tower of Winter enemy actor, with an attack table, from a bestiary entry.
 *
 * The band becomes a two-entry table rather than one averaged swing: a light, faster
 * attack and a heavy one. That is how the reference enemies read — the Gatekeeper has six
 * named attacks from 11 to 50 — and it gives the player something to answer.
 */
export function towEnemyFromBestiary(enemy, { id } = {}) {
  if (!enemy || typeof enemy !== "object") throw new TypeError("invalid-enemy");
  const actorId = id || enemy.npcId || enemy.id;
  if (typeof actorId !== "string" || actorId.length === 0) throw new TypeError("invalid-enemy-id");

  const maxHp = positiveInt(enemy.maxHealth ?? enemy.health);
  const hp = Math.max(0, Math.min(maxHp, positiveInt(enemy.health ?? maxHp)));
  const min = nonNegativeInt(enemy.weapon?.min);
  const max = Math.max(min, nonNegativeInt(enemy.weapon?.max));

  return {
    id: actorId,
    name: enemy.name || "Hostile foe",
    side: "enemy",
    hp,
    maxHp,
    shield: 0,
    stats: {
      attack: positiveInt((min + max) / 2),
      defense: nonNegativeInt((enemy.armor || 0) + (enemy.ward || 0)),
      critRate: clampRate(enemy.critChance || 0),
      dodgeRate: clampRate(enemy.dodge || 0),
    },
    statuses: createStatusStack(),
    attacks: min === max
      ? [{ id: `${actorId}-strike`, name: "Strike", hits: 1, damage: max }]
      : [
        { id: `${actorId}-jab`, name: "Jab", hits: 1, damage: min },
        { id: `${actorId}-swing`, name: "Swing", hits: 1, damage: max },
      ],
  };
}

/**
 * Whether a Solitaire encounter can run on the Tower of Winter kernel as it stands.
 *
 * This is deliberately narrower than "has enemies". Mechanics with no port yet — player
 * abilities, conditions, racial passives, companions — must keep their old behaviour
 * rather than being silently dropped on the floor by a kernel that cannot express them.
 */
export function towEncounterSupport({ character, party, enemies } = {}) {
  if (!Array.isArray(enemies) || enemies.length === 0) return { ok: false, reason: "no-enemies" };
  if (Array.isArray(party) && party.length > 0) return { ok: false, reason: "unsupported-companions" };
  if (character?.abilities?.length) return { ok: false, reason: "unsupported-player-abilities" };
  if (character?.conditions?.length) return { ok: false, reason: "unsupported-player-conditions" };
  if (character?.racialPassives?.length) return { ok: false, reason: "unsupported-racial-passives" };
  const unsupported = enemies.find((enemy) => (
    enemy?.abilities?.length || enemy?.statuses?.length || enemy?.procs?.length
  ));
  if (unsupported) return { ok: false, reason: "unsupported-enemy-mechanics" };
  return { ok: true, reason: null };
}
