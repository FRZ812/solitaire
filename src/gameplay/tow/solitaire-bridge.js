// Solitaire's world → Tower of Winter actors.
//
// The kernel is a faithful port of Tower of Winter's mechanics, but the fights it has to
// run are Solitaire's: characters built from attributes, proficiencies and worn gear, and
// enemies from the bestiary. This module is the only place the two vocabularies meet, so
// the kernel never learns about attributes and the world never learns about Steelskin.
//
// Every mapping choice below is a judgement, not evidence, and is marked as such.

import { deriveCombatStats } from "../../engine/combat-stats.js";
import { resolvePoolForMind } from "../../engine/attributes.js";
import { createStatusStack } from "../kernel/status-stack.js";
import { admitTowEncounter } from "./admission.js";
import { getStartingArchetype } from "./starting-archetypes.js";
import { towItemActorBonuses, wornItemIds } from "./start-items.js";

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

// Foes speak the same combat language as playable characters. World professions select
// one of the authored Tower archetypes; identity and stats still belong to the world actor,
// while the archetype supplies the trait and five-ability kit used inside the encounter.
const ENEMY_ARCHETYPE_BY_PROFESSION = Object.freeze({
  artificer: "owner-of-clocktower",
  barbarian: "old-king-of-northland",
  bard: "wandering-blade",
  cleric: "exiled-priestess",
  commander: "arctic-knight",
  druid: "sleepless-one",
  fighter: "arctic-knight",
  monk: "wandering-blade",
  paladin: "exiled-priestess",
  ranger: "demon-slayer",
  rogue: "last-assassin",
  sorcerer: "sleepless-one",
  warlock: "witch-of-eternity",
  wizard: "tenacious-mage",
});

// World threat tier is the enemy-side progression gate over the same fixed five-slot kit:
// common foes know the protected attack and defence, uncommon foes add one flexible skill,
// and rare+ characters bring all three flexible skills. Named fixtures with no tier are
// authored directly and therefore keep all five.
const ENEMY_SKILL_COUNT_BY_TIER = Object.freeze({
  common: 2,
  uncommon: 3,
  rare: 5,
  "very-rare": 5,
  epic: 5,
  legendary: 5,
  mythical: 5,
  divine: 5,
});

function abilityIds(enemy) {
  return (enemy?.abilities || [])
    .map((entry) => (typeof entry === "string" ? entry : entry?.id))
    .filter(Boolean);
}

/** Resolve the playable archetype whose combat kit a world enemy uses. */
export function towArchetypeForEnemy(enemy = {}) {
  const explicit = getStartingArchetype(enemy.towArchetypeId)
    || getStartingArchetype(enemy.combatArchetypeId)
    || getStartingArchetype(enemy.progression?.combatArchetypeId)
    || getStartingArchetype(enemy.archetype);
  if (explicit) return explicit;

  const identity = `${enemy.name || ""} ${enemy.kind || ""} ${enemy.race || ""}`.toLowerCase();
  const abilities = abilityIds(enemy).join(" ").toLowerCase();
  const category = String(enemy.weapon?.category || "").toLowerCase();
  if (/(automaton|construct|clockwork)/.test(identity)) return getStartingArchetype("forsaken-automaton");
  if (/(undead|skeleton|wight|ghoul|thrall)/.test(identity)) return getStartingArchetype("witch-of-eternity");
  if (/(fire|flame|burn)/.test(abilities)) return getStartingArchetype("sleepless-one");
  if (/(poison|venom)/.test(abilities) || /(bow|crossbow)/.test(category)) {
    return getStartingArchetype("demon-slayer");
  }
  if (/(rend|flurry|piercing-thrust)/.test(abilities)) return getStartingArchetype("last-assassin");
  if (/(power-strike|shield-bash|guard)/.test(abilities)) return getStartingArchetype("arctic-knight");

  const professionId = enemy.professionId
    || enemy.progression?.activeProfessionId
    || enemy.progression?.professionId
    || enemy.profession;
  const mapped = getStartingArchetype(ENEMY_ARCHETYPE_BY_PROFESSION[professionId]);
  if (mapped) return mapped;

  const body = Number(enemy.attrs?.body ?? enemy.attributes?.body ?? 0);
  const reflex = Number(enemy.attrs?.reflex ?? enemy.attributes?.reflex ?? 0);
  if (Number.isFinite(body) && Number.isFinite(reflex) && body >= reflex + 2) {
    return getStartingArchetype("old-king-of-northland");
  }
  if (Number.isFinite(body) && Number.isFinite(reflex) && reflex > body) {
    return getStartingArchetype("last-assassin");
  }
  return getStartingArchetype("arctic-knight");
}

function enemyTowBuild(enemy) {
  const archetype = towArchetypeForEnemy(enemy);
  const skillCount = ENEMY_SKILL_COUNT_BY_TIER[enemy?.tier] ?? archetype.build.skills.length;
  return {
    archetypeId: archetype.id,
    build: {
      traits: { ...archetype.build.traits },
      skills: archetype.build.skills.slice(0, skillCount),
      runes: [...archetype.build.runes],
    },
  };
}

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

function resolveSnapshot(character, fallbackMind = 0) {
  const authoredMax = Number(character?.resolveMax);
  const baseMax = positiveInt(
    Number.isFinite(authoredMax) ? authoredMax : resolvePoolForMind(fallbackMind),
  );
  const authoredCurrent = Number(character?.resolve);
  const baseCurrent = Number.isFinite(authoredCurrent)
    ? Math.max(0, Math.min(baseMax, Math.round(authoredCurrent)))
    : baseMax;
  return { resolve: baseCurrent, resolveMax: baseMax };
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
  const itemBonus = towItemActorBonuses(wornItemIds(character, codex));
  const sourceBase = character.progressionModel === "tow-archetype" && character.towBaseStats;
  if (sourceBase
    && Number.isFinite(sourceBase.maxHp)
    && Number.isFinite(sourceBase.attack)
    && Number.isFinite(sourceBase.defense)) {
    const maxHp = positiveInt(sourceBase.maxHp + itemBonus.maxHp);
    const vitalityMax = positiveInt(character.vitalityMax, maxHp);
    const vitality = Math.max(0, Math.min(vitalityMax, Number(character.vitality ?? vitalityMax)));
    const hp = Math.max(0, Math.min(maxHp, Math.round(maxHp * (vitality / vitalityMax))));
    const resolve = resolveSnapshot(character, character.attributes?.mind ?? 0);
    return {
      id,
      name: character.name || "Wanderer",
      side: "player",
      hp,
      maxHp,
      ...resolve,
      shield: 0,
      stats: {
        attack: positiveInt(sourceBase.attack + itemBonus.attack),
        defense: nonNegativeInt(sourceBase.defense + itemBonus.defense),
        critRate: clampRate(sourceBase.critRate + itemBonus.critRate),
        dodgeRate: clampRate(sourceBase.dodgeRate + itemBonus.dodgeRate),
      },
      statuses: createStatusStack(),
    };
  }
  const maxHp = positiveInt(stats.maxHealth + itemBonus.maxHp);
  // Current vitality carries over, lifted by whatever the gear adds above the base pool so
  // equipping armour does not read as arriving already wounded.
  const baseMaxHp = positiveInt(character.vitalityMax, maxHp);
  const healthBonus = Math.max(0, maxHp - baseMaxHp);
  const hp = Math.max(0, Math.min(maxHp, Math.round(character.vitality ?? maxHp) + healthBonus));
  const resolve = resolveSnapshot(character, stats.attrs?.mind ?? character.attributes?.mind ?? 0);

  // See PROVISIONAL_BRIDGE_POLICY.attackFromWeapon: the weapon's midpoint plus the frame
  // behind it, because a Tower of Winter skill scales off ATK alone.
  const frame = nonNegativeInt(stats.attrs?.body) + nonNegativeInt(stats.attrs?.reflex);
  const attack = positiveInt((stats.weapon.min + stats.weapon.max) / 2) + frame + itemBonus.attack;
  return {
    id,
    name: character.name || "Wanderer",
    side: "player",
    hp,
    maxHp,
    ...resolve,
    shield: 0,
    stats: {
      attack,
      // See PROVISIONAL_BRIDGE_POLICY.defenseFloorFromAttack: worn protection adds to a
      // floor set by the actor's own scale, so Block is never worth nothing.
      defense: nonNegativeInt((stats.armor || 0) + (stats.ward || 0)) + attack + itemBonus.defense,
      critRate: clampRate(stats.critChance + itemBonus.critRate),
      dodgeRate: clampRate(stats.dodge + itemBonus.dodgeRate),
    },
    statuses: createStatusStack(),
  };
}

/**
 * Build a Tower of Winter enemy actor from a bestiary entry.
 *
 * The world actor keeps their own health and stats, but their combat decisions now come
 * from the same authored archetype, trait, skill-state, cooldown and status machinery used
 * by the player. There is no parallel Jab/Swing/Heavy table for new fights.
 */
export function towEnemyFromBestiary(enemy, { id } = {}) {
  if (!enemy || typeof enemy !== "object") throw new TypeError("invalid-enemy");
  const actorId = id || enemy.npcId || enemy.id;
  if (typeof actorId !== "string" || actorId.length === 0) throw new TypeError("invalid-enemy-id");

  const maxHp = positiveInt(enemy.maxHealth ?? enemy.health);
  const hp = Math.max(0, Math.min(maxHp, positiveInt(enemy.health ?? maxHp)));
  const min = nonNegativeInt(enemy.weapon?.min);
  const max = Math.max(min, nonNegativeInt(enemy.weapon?.max));
  const attack = positiveInt((min + max) / 2);
  const identity = enemyTowBuild(enemy);
  const resolve = resolveSnapshot(enemy, enemy.attrs?.mind ?? enemy.attributes?.mind ?? 0);

  return {
    id: actorId,
    name: enemy.name || "Hostile foe",
    side: "enemy",
    hp,
    maxHp,
    ...resolve,
    shield: 0,
    stats: {
      attack,
      // A world foe's DEF is its authored protection rather than a second copy of offence.
      // The one-point floor keeps defensive archetype abilities real for an unarmoured beast
      // without turning every common enemy's Block into a player-scale wall.
      defense: Math.max(1, nonNegativeInt((enemy.armor || 0) + (enemy.ward || 0))),
      critRate: clampRate(enemy.critChance || 0),
      dodgeRate: clampRate(enemy.dodge || 0),
    },
    statuses: createStatusStack(),
    ...identity,
  };
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
