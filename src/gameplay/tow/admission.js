// What the fight is allowed to ignore, and what it is not.
//
// The support matrix has always said that abilities, conditions and companions are not
// carried into a Tower of Winter fight. The live path never asked it. So a character walked
// into combat bleeding and did not bleed, walked in blessed and got nothing for it, and
// walked in with a companion who never appeared — and none of it was recorded anywhere a
// player or a developer could see.
//
// Admission is where that stops. Every fight is now projected through this module before it
// starts, and each part of the projection lands in exactly one of three places:
//
//   adapted     — carried into the fight in a changed shape, with the change recorded.
//                 Conditions become opening statuses here: a bleeding character bleeds.
//   superseded  — deliberately not carried, because something else is the combat identity.
//                 The profession's Tower of Winter package replaces the ability list; that
//                 is the design, not an omission, and saying so is different from silence.
//   blocked     — cannot run, so the fight does not start. Objective code, named entity.
//
// The rule is that nothing may fall outside those three. A capability with no entry blocks
// admission rather than evaporating, which means authoring a new condition without deciding
// what it does in a fight fails loudly instead of quietly making the player stronger.

import { CONDITIONS, condName } from "../../data/conditions.js";
import { getStatusDefinition } from "../kernel/status-stack.js";

export const TOW_ADMISSION_VERSION = 1;

/** Where a piece of the projection ended up. */
export const ADMISSION_DISPOSITION = Object.freeze({
  ADAPTED: "adapted",
  SUPERSEDED: "superseded",
  BLOCKED: "blocked",
});

function statusEffect(status, count) {
  return Object.freeze({ kind: "status", status, count });
}

/** Present in the world, real elsewhere, with nothing to say inside a fight. */
function noCombatEffect(reason) {
  return Object.freeze({ kind: "none", reason });
}

/**
 * What each authored condition does once blades are out.
 *
 * Most of these are near-direct: Solitaire named its conditions and Tower of Winter named
 * its statuses, and the two vocabularies agree more often than not — Bleeding is Bleed,
 * Hastened is Haste, Guarded is Guard. Where they agree, the mapping is the obvious one.
 *
 * Counts are opening magnitudes, not durations, because Tower of Winter statuses are counts.
 * They are deliberately modest: a condition is a state the world put you in, not a build
 * choice, and it should tilt a fight rather than decide it.
 *
 * Needs and travel states map to nothing on purpose and say so. Being Thirsty matters a
 * great deal on the road and nothing at all in the ten seconds someone is swinging at you.
 */
export const CONDITION_COMBAT_EFFECTS = Object.freeze({
  // --- Wounds and poisons: the body still failing while you fight ------------
  "Bleeding": statusEffect("bleed", 4),
  "Poisoned": statusEffect("poison", 4),
  "Burning": statusEffect("burn", 5),
  "Infected": statusEffect("poison", 3),
  "Festering Wound": statusEffect("bleed", 5),
  "Diseased": statusEffect("weak", 3),
  "Plague-Ridden": statusEffect("weak", 5),
  "Withering Curse": statusEffect("doom", 4),
  "Gravely Wounded": statusEffect("vulnerable", 6),
  "Severed Limb": statusEffect("cripple", 5),

  // --- Blows that land before the first swing --------------------------------
  "Bruised": statusEffect("weak", 2),
  "Winded": statusEffect("lethargy", 3),
  "Weakened": statusEffect("weak", 4),
  "Enfeebled": statusEffect("weak", 6),
  "Vulnerable": statusEffect("vulnerable", 4),
  "Slowed": statusEffect("limp", 3),
  "Chilled": statusEffect("limp", 2),
  "Stunned": statusEffect("stun", 1),
  "Dazed": statusEffect("lethargy", 4),
  "Petrified": statusEffect("paralyze", 2),
  "Blinded": statusEffect("misfortune", 5),

  // --- The mind under pressure ----------------------------------------------
  "Frightened": statusEffect("weak", 3),
  "Hexed": statusEffect("misfortune", 4),
  "Cursed": statusEffect("misfortune", 6),
  "Doomed": statusEffect("doom", 6),
  "Damned": statusEffect("doom", 8),
  "Soul-Bound": statusEffect("misfortune", 3),

  // --- States the fight cannot express, and why ------------------------------
  "Wet": noCombatEffect("A soaking slows a march and invites Chilled; inside a fight it is "
    + "discomfort, not a mechanic."),
  "Silenced": noCombatEffect("The Tower of Winter package has no spoken component to cut off; "
    + "skills are physical actions, so there is nothing for silence to bite on."),
  "Charmed": noCombatEffect("Whose side someone is on is settled before admission. A charmed "
    + "character who fights anyway is fighting willingly as far as the encounter is concerned."),
  "Dominated": noCombatEffect("As Charmed: allegiance is an admission fact, not a combat status."),
  "Enthralled": noCombatEffect("As Charmed: allegiance is an admission fact, not a combat status."),

  // --- Needs: enormous on the road, silent in a brawl -----------------------
  "Hungry": noCombatEffect("A need, tracked in hours. It does not reach into the seconds a "
    + "fight takes."),
  "Starving": noCombatEffect("A need, tracked in hours; its cost is paid in travel and "
    + "recovery, not in a swing."),
  "Thirsty": noCombatEffect("A need, tracked in hours. Thirst is paid on the road, not in "
    + "the seconds a fight takes."),
  "Parched": noCombatEffect("A need, tracked in hours. Severe thirst governs travel and "
    + "recovery, both of which settlement still applies."),
  "Tired": noCombatEffect("A need, tracked in hours. Tiredness shapes what a day can hold "
    + "rather than what a single exchange does."),
  "Exhausted": noCombatEffect("A need, tracked in hours. Exhaustion's real cost is what it "
    + "does to a march and to healing, both of which settlement still applies."),

  // --- Blessings and boons ---------------------------------------------------
  "Well-Fed": noCombatEffect("A satisfied need rather than a combat boon; being fed keeps "
    + "hunger away, it does not make a swing land harder."),
  "Rested": noCombatEffect("A satisfied need rather than a combat boon; rest is what lets a "
    + "day be walked, not what wins an exchange."),
  "Warmed": noCombatEffect("Comfort against the cold. It holds Chilled off on the road and "
    + "has nothing to add once blades are out."),
  "Rallied": statusEffect("strength", 2),
  "Focused": statusEffect("focus", 3),
  "Emboldened": statusEffect("strength", 3),
  "Guarded": statusEffect("guard", 3),
  "Blessed": statusEffect("protection", 3),
  "Inspired": statusEffect("strength", 4),
  "Regenerating": statusEffect("lifesteal", 3),
  "Hardy": statusEffect("tenacity", 4),
  "Warded": statusEffect("protection", 5),
  "Hastened": statusEffect("haste", 1),
  "Bear's Strength": statusEffect("strength", 6),
  "Empowered": statusEffect("strength", 5),
  "Heroic": statusEffect("strength", 7),
  "Anointed": statusEffect("protection", 6),
  "Divine Favor": statusEffect("protection", 7),
  "Berserk": statusEffect("berserk", 4),
  "Dragon-Heart": statusEffect("tenacity", 7),
  "Ascendant": statusEffect("overload", 6),
});

/** Every authored condition that has no combat entry yet. Should always be empty. */
export function unmappedConditionNames() {
  return Object.keys(CONDITIONS).filter((name) => !Object.hasOwn(CONDITION_COMBAT_EFFECTS, name));
}

function blocker(code, detail) {
  return Object.freeze({ code, ...detail });
}

function note(disposition, code, detail) {
  return Object.freeze({ disposition, code, ...detail });
}

/**
 * Project a character's conditions into opening statuses.
 *
 * A condition with no entry is a blocker, not a shrug. That is the whole safety property:
 * someone authoring a new condition has to decide what it means in a fight, and finds out
 * at admission rather than after shipping a debuff that silently did nothing.
 */
export function conditionAdmission(conditions = []) {
  const statuses = [];
  const notes = [];
  const blockers = [];

  for (const entry of conditions) {
    const name = condName(entry);
    if (!name) continue;
    const effect = CONDITION_COMBAT_EFFECTS[name];
    if (!effect) {
      blockers.push(blocker("unsupported-condition", { conditionName: name }));
      continue;
    }
    if (effect.kind === "none") {
      notes.push(note(ADMISSION_DISPOSITION.SUPERSEDED, "condition-has-no-combat-expression", {
        conditionName: name,
        reason: effect.reason,
      }));
      continue;
    }
    // A status the kernel does not define would fail deep inside the reducer; catching it
    // here keeps the failure at the boundary where it can be reported.
    if (!getStatusDefinition(effect.status)) {
      blockers.push(blocker("unknown-condition-status", {
        conditionName: name,
        status: effect.status,
      }));
      continue;
    }
    statuses.push({ type: effect.status, count: effect.count });
    notes.push(note(ADMISSION_DISPOSITION.ADAPTED, "condition-adapted-to-status", {
      conditionName: name,
      status: effect.status,
      count: effect.count,
    }));
  }

  return { statuses: mergeStatuses(statuses), notes, blockers };
}

// Two conditions can land on the same status — Bruised and Weakened both make you weak — and
// counts accumulate, so they are summed rather than one silently winning.
function mergeStatuses(statuses) {
  const totals = new Map();
  for (const entry of statuses) {
    totals.set(entry.type, (totals.get(entry.type) || 0) + entry.count);
  }
  return [...totals.entries()].map(([type, count]) => ({ type, count }));
}

/**
 * Decide whether this encounter can run, and record everything it will not carry.
 *
 * @param {object} input
 * @param {object} input.character the Solitaire character
 * @param {Array} input.party companions currently travelling with the player
 * @param {Array} input.enemies bestiary entries for the foes
 * @returns {{supported: boolean, blockers: Array, notes: Array, openingStatuses: Array}}
 */
export function admitTowEncounter({ character = {}, party = [], enemies = [] } = {}) {
  const blockers = [];
  const notes = [];

  if (!Array.isArray(enemies) || enemies.length === 0) {
    blockers.push(blocker("no-enemies", {}));
  }

  const conditions = conditionAdmission(character.conditions || []);
  blockers.push(...conditions.blockers);
  notes.push(...conditions.notes);

  // The profession's Tower of Winter package *is* the combat identity — that is the whole
  // shape of the port, not a gap in it. Recording each superseded ability by name is what
  // separates a design decision from a silent drop.
  for (const ability of character.abilities || []) {
    const abilityId = typeof ability === "string" ? ability : ability?.id;
    if (!abilityId) continue;
    notes.push(note(ADMISSION_DISPOSITION.SUPERSEDED, "ability-superseded-by-package", {
      abilityId,
      reason: "The profession's Tower of Winter trait and skill loadout replaces the legacy "
        + "ability list in combat; the ability remains real everywhere else.",
    }));
  }

  for (const passive of character.racialPassives || []) {
    const passiveId = typeof passive === "string" ? passive : passive?.id;
    if (!passiveId) continue;
    notes.push(note(ADMISSION_DISPOSITION.SUPERSEDED, "racial-passive-superseded-by-package", {
      passiveId,
      reason: "Racial passives are computed in progression code with no combat rule attached; "
        + "they shape the world character, not the encounter.",
    }));
  }

  // Companions fight now, as allied actors under the player's command. Each is admitted on
  // their own terms: their own conditions become their own opening statuses, and a companion
  // carrying something the encounter cannot express blocks the fight rather than walking in
  // with part of themselves missing.
  const allies = [];
  for (const companion of party) {
    const entity = typeof companion === "string" ? { id: companion } : companion;
    const companionId = entity?.id;
    if (!companionId) continue;
    if (entity.combatCapable === false) {
      notes.push(note(ADMISSION_DISPOSITION.SUPERSEDED, "companion-not-a-combatant", {
        companionId,
        reason: "This companion travels with the player but does not fight. Fielding them "
          + "would put someone into a battle line they were never described as belonging to.",
      }));
      continue;
    }
    const companionConditions = conditionAdmission(entity.conditions || []);
    if (companionConditions.blockers.length > 0) {
      blockers.push(...companionConditions.blockers.map(
        (entry) => blocker(entry.code, { ...entry, companionId }),
      ));
      continue;
    }
    notes.push(...companionConditions.notes.map(
      (entry) => note(entry.disposition, entry.code, { ...entry, companionId }),
    ));
    notes.push(note(ADMISSION_DISPOSITION.ADAPTED, "companion-admitted", {
      companionId,
      reason: "Fielded as an allied actor under player command, with a build of their own.",
    }));
    allies.push({ companionId, entity, openingStatuses: companionConditions.statuses });
  }

  const hostile = Array.isArray(enemies) ? enemies : [];
  for (const enemy of hostile) {
    if (enemy?.abilities?.length || enemy?.procs?.length) {
      blockers.push(blocker("unsupported-enemy-mechanics", { enemyName: enemy.name || null }));
    }
  }

  return {
    version: TOW_ADMISSION_VERSION,
    supported: blockers.length === 0,
    blockers,
    notes,
    openingStatuses: conditions.statuses,
    allies,
  };
}

/** The notes worth telling the player about, as one plain sentence or null. */
export function admissionPlayerNotice(admission) {
  const held = (admission?.notes || [])
    .filter((entry) => entry.code === "companion-not-a-combatant");
  if (held.length === 0) return null;
  return held.length === 1
    ? "Your companion is no fighter, and stays out of it."
    : `${held.length} of your companions are no fighters, and stay out of it.`;
}
