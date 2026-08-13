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
import { admitTowEncounter } from "./admission.js";

export const PROVISIONAL_BRIDGE_POLICY = Object.freeze({
  // Tower of Winter actors have one attack number; Solitaire weapons have a damage band.
  // The midpoint keeps expected damage identical while the kernel's own variance and crit
  // supply the swing.
  //
  // The midpoint alone was not enough, and the shortfall was structural rather than a matter
  // of taste. Tower of Winter skills scale off ATK as a percentage — Strike is "100% of ATK"
  // — so ATK has to carry the whole of an actor's offence. Solitaire's old resolver added
  // weapon dice *and* ability damage *and* attribute bonuses on top of each other, so its
  // weapon band was only ever one term of several. Carrying just that term across left a
  // starting character swinging for four against a common bandit pair holding seventy health
  // between them: an eighteen-round race that a thirty-health character cannot finish.
  //
  // So the person swinging is part of the number, as they are in the reference actors. Body
  // and Reflex are added to the band's midpoint. The contribution is flat, so it matters
  // most to a barely-armed traveller and fades as real weapons take over — which is the
  // right shape for it.
  attackFromWeapon: "midpoint-plus-frame",

  // DEF in Tower of Winter is what Block turns into shield and what Tenacity raises. It is
  // not flat mitigation — Steelskin and Protection are. So armour and ward sum into DEF
  // and express themselves through Block rather than silently soaking every hit. If real
  // fights read too swingy, granting opening Steelskin from armour is the lever to pull,
  // and it belongs here rather than inside the resolver.
  defenseFromArmourAndWard: "sum",
  armourGrantsOpeningSteelskin: false,

  // Armour and ward alone are not enough, and the omission was not a balance question but a
  // broken mapping. Solitaire's armour is a mitigation number that is legitimately zero for
  // someone in cloth; Tower of Winter's DEF is a stat every actor carries — the Arctic
  // Knight's 13 sits beside their ATK of 12. Mapping one onto the other directly produced a
  // starting character with DEF 0, which meant Block granted a zero-point shield and the
  // entire defensive half of every package did nothing at all.
  //
  // So DEF has a floor at the actor's own offensive scale, in the reference actors' shape,
  // and worn armour adds on top. An unarmoured person still has a frame that takes a blow.
  defenseFloorFromAttack: true,

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

  // See PROVISIONAL_BRIDGE_POLICY.attackFromWeapon: the weapon's midpoint plus the frame
  // behind it, because a Tower of Winter skill scales off ATK alone.
  const frame = nonNegativeInt(stats.attrs?.body) + nonNegativeInt(stats.attrs?.reflex);
  const attack = positiveInt((stats.weapon.min + stats.weapon.max) / 2) + frame;
  return {
    id,
    name: character.name || "Wanderer",
    side: "player",
    hp,
    maxHp,
    shield: 0,
    stats: {
      attack,
      // See PROVISIONAL_BRIDGE_POLICY.defenseFloorFromAttack: worn protection adds to a
      // floor set by the actor's own scale, so Block is never worth nothing.
      defense: nonNegativeInt((stats.armor || 0) + (stats.ward || 0)) + attack,
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
    attacks: attackTableFor(actorId, min, max),
  };
}

// A damage band becomes a move set, not one averaged swing. Reference enemies read this
// way — the Gatekeeper has six named attacks from 11 to 50 — and it is what puts multi-hit
// in front of the player, where Steelskin, Thorn and Burn all behave differently to a
// single heavy blow.
function attackTableFor(actorId, min, max) {
  if (min === max) {
    return [{ id: `${actorId}-strike`, name: "Strike", hits: 1, damage: max }];
  }
  const mid = Math.max(min, Math.round((min + max) / 2));
  const table = [
    { id: `${actorId}-jab`, name: "Jab", hits: 1, damage: min },
    { id: `${actorId}-swing`, name: "Swing", hits: 1, damage: mid },
    { id: `${actorId}-heavy`, name: "Heavy blow", hits: 1, damage: max },
  ];
  // A flurry only exists where the band is wide enough for each hit to still land for
  // something; below that it would read as a weaker single swing rather than a threat.
  const flurryDamage = Math.round(min * 0.6);
  if (flurryDamage >= 1 && max - min >= 2) {
    table.push({ id: `${actorId}-flurry`, name: "Flurry", hits: 2, damage: flurryDamage });
  }
  return table;
}

/**
 * Whether a Solitaire encounter can run on the Tower of Winter kernel as it stands.
 *
 * This used to answer for itself, with its own list of what the kernel could not express.
 * That made it a second source of truth beside the support matrix, and the two drifted the
 * moment conditions gained adapters — one file said a wounded character could not fight
 * while the other carried their wounds into the fight.
 *
 * So it delegates. `admitTowEncounter` decides, this reports the first objective blocker,
 * and there is one answer to the question rather than two that agree by luck.
 */
export function towEncounterSupport({ character, party, enemies } = {}) {
  const admission = admitTowEncounter({ character, party: party || [], enemies });
  if (admission.supported) return { ok: true, reason: null };
  return { ok: false, reason: admission.blockers[0].code };
}
