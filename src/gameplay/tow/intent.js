// Telegraphed enemy turns: what a foe is about to do, shown before you decide.
//
// Until now a foe picked its attack with a uniform draw at the moment it swung. That makes
// a fight unreadable in the strict sense: no information exists before the blow lands, so
// no decision the player makes can be better-informed than a guess. Block and Strike are
// then interchangeable, and a fight is a coin-flip with extra steps.
//
// A telegraph fixes that without making the fight easy. Each foe declares its next attack
// at the start of the round, by name, with its hit count and damage. The player spends
// their turn knowing exactly what is coming and decides what to do about it — guard the
// heavy blow, race the flurry, ignore the jab. The uncertainty moves from "what will it do"
// to "what should I do about it", which is the interesting question.
//
// Two things keep this honest:
//
//   Declarations come off the *intent* stream, not the combat stream. Adding a schedule
//   step or a tie-break cannot shift a damage roll, so a fight recorded yesterday replays
//   the same way today.
//
//   Resolution re-derives the attack from the foe's own immutable attack table by ID and
//   checks it against the declaration. A telegraph the engine does not honour is worse than
//   no telegraph, because the player has been taught to trust it.

import { cloneJsonData } from "../kernel/json-data.js";
import { nextInt } from "../kernel/rng.js";

export const TOW_INTENT_VERSION = 1;

export const MAX_INTENT_SCHEDULE_STEPS = 64;
export const MAX_INTENT_STEP_OPTIONS = 8;

/**
 * What a control status does to a telegraph, as an authored decision.
 *
 * There is no Tower of Winter evidence either way — telegraphs are a Solitaire adaptation —
 * so this is a design choice, recorded rather than buried. A stunned foe does **not**
 * advance its intent: the blow it was winding up still lands, one round later.
 *
 * The alternative, advancing through the skipped step, would make control statuses erase
 * attacks. That reads worse in two ways. It makes the telegraph a lie — the player was
 * shown a heavy blow that then never happens — and it collapses control into raw
 * mitigation. Holding the intent makes Stun about tempo: you buy a round to prepare for
 * exactly the blow you were shown, which is a decision rather than a discount.
 */
export const INTENT_CONTROL_POLICY = Object.freeze({
  nullifiedEnemyAdvancesIntent: false,
  evidence: "authored-adaptation",
});

const SCHEDULE_KEYS = Object.freeze(["id", "steps"]);
const STEP_KEYS = Object.freeze(["attackIds", "id"]);
const INTENT_KEYS = Object.freeze([
  "attackId",
  "declarationIndex",
  "patternId",
  "stepIndex",
  "targetId",
  "version",
].sort());

const MAX_IDENTIFIER_LENGTH = 256;

function identifier(value) {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_IDENTIFIER_LENGTH;
}

function exactKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const own = Object.keys(value).sort();
  const expected = [...keys].sort();
  return own.length === expected.length && own.every((key, index) => key === expected[index]);
}

/**
 * Build a foe's default rotation from its own attack table.
 *
 * Each step offers two adjacent attacks rather than one, so the schedule cannot be memorised
 * into a script — the player still has to read each round's declaration. What they never
 * have to guess is what is coming *this* round; that is always shown.
 */
export function defaultIntentSchedule(enemyId, attacks) {
  const table = Array.isArray(attacks) ? attacks.filter((attack) => identifier(attack?.id)) : [];
  if (table.length === 0) return null;
  if (table.length === 1) {
    return { id: `${enemyId}-rotation`, steps: [{ id: `${enemyId}-step-0`, attackIds: [table[0].id] }] };
  }
  return {
    id: `${enemyId}-rotation`,
    steps: table.slice(0, MAX_INTENT_SCHEDULE_STEPS).map((attack, index) => ({
      id: `${enemyId}-step-${index}`,
      attackIds: [attack.id, table[(index + 1) % table.length].id],
    })),
  };
}

export function isIntentSchedule(value) {
  if (!exactKeys(value, SCHEDULE_KEYS)) return false;
  if (!identifier(value.id)) return false;
  if (!Array.isArray(value.steps)) return false;
  if (value.steps.length < 1 || value.steps.length > MAX_INTENT_SCHEDULE_STEPS) return false;
  const stepIds = new Set();
  for (const step of value.steps) {
    if (!exactKeys(step, STEP_KEYS)) return false;
    if (!identifier(step.id) || stepIds.has(step.id)) return false;
    stepIds.add(step.id);
    if (!Array.isArray(step.attackIds)) return false;
    if (step.attackIds.length < 1 || step.attackIds.length > MAX_INTENT_STEP_OPTIONS) return false;
    if (!step.attackIds.every(identifier)) return false;
  }
  return true;
}

export function isTowIntent(value) {
  return exactKeys(value, INTENT_KEYS)
    && value.version === TOW_INTENT_VERSION
    && identifier(value.patternId)
    && Number.isSafeInteger(value.declarationIndex)
    && value.declarationIndex >= 0
    && Number.isSafeInteger(value.stepIndex)
    && value.stepIndex >= 0
    && identifier(value.attackId)
    && (value.targetId === null || identifier(value.targetId));
}

/**
 * Declare the attack for one step of a schedule.
 *
 * The draw comes off the caller's stream, and the caller threads the advanced stream on to
 * the next enemy, so a group declares in one stable pass and a replay reproduces it.
 */
export function declareTowIntent({ schedule, declarationIndex, targetId, targets, rng }) {
  const stepIndex = declarationIndex % schedule.steps.length;
  const step = schedule.steps[stepIndex];
  const draw = nextInt(rng, 0, step.attackIds.length - 1);

  // Who a foe is coming for is declared alongside what it is bringing, because with allies
  // on the field "a heavy blow" is a different decision depending on whether it is aimed at
  // the player or at the companion already down to their last few points.
  //
  // A single candidate costs no draw at all. That keeps a solo fight's stream identical to
  // what it was before allies existed, so adding a companion to the game did not silently
  // rewrite every fight recorded without one.
  let targetRng = draw.rng;
  let chosen = targetId ?? null;
  if (Array.isArray(targets) && targets.length > 0) {
    if (targets.length === 1) {
      chosen = targets[0];
    } else {
      const pick = nextInt(targetRng, 0, targets.length - 1);
      targetRng = pick.rng;
      chosen = targets[pick.value];
    }
  }

  return {
    rng: targetRng,
    intent: {
      version: TOW_INTENT_VERSION,
      patternId: schedule.id,
      declarationIndex,
      stepIndex,
      attackId: step.attackIds[draw.value],
      targetId: chosen,
    },
  };
}

/** The next declaration after this one, from the same schedule. */
export function advanceTowIntent({ schedule, intent, targetId, targets, rng }) {
  return declareTowIntent({
    schedule,
    declarationIndex: intent.declarationIndex + 1,
    targetId,
    targets,
    rng,
  });
}

/**
 * Check a declaration against the table it claims to come from.
 *
 * Returns the resolved attack, or null when the declaration names something the foe cannot
 * actually do. The reducer refuses to act on a null rather than substituting a swing of its
 * own — a fight whose telegraph and resolution have come apart is a fight whose recorded
 * history no longer describes it, and quietly papering over that would hide the fault at
 * exactly the point it matters.
 */
export function resolveDeclaredAttack(intent, attacks) {
  if (!isTowIntent(intent) || !Array.isArray(attacks)) return null;
  return attacks.find((attack) => attack.id === intent.attackId) ?? null;
}

/**
 * The player-facing reading of a declaration: name, hits, and damage, no hidden rolls.
 *
 * Damage here is the attack's own number, before defence, crit and dodge. That is the right
 * amount to show: it is what the foe is bringing, and how much of it lands is the part the
 * player's decision is supposed to influence.
 */
export function describeTowIntent(intent, attacks) {
  const attack = resolveDeclaredAttack(intent, attacks);
  if (!attack) return null;
  return {
    attackId: attack.id,
    name: attack.name,
    hits: attack.hits,
    damage: attack.damage,
    targetId: intent.targetId,
  };
}

/** Snapshot a schedule map, rejecting anything that is not a valid schedule. */
export function intentSchedulesSnapshot(value) {
  let schedules;
  try {
    schedules = cloneJsonData(value ?? {}, "invalid-intent-schedules");
  } catch {
    return null;
  }
  if (!schedules || typeof schedules !== "object" || Array.isArray(schedules)) return null;
  for (const [enemyId, schedule] of Object.entries(schedules)) {
    if (!identifier(enemyId) || !isIntentSchedule(schedule)) return null;
  }
  return schedules;
}
