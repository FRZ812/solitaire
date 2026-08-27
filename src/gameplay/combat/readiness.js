// Legacy v1 readiness adapter.
//
// Captured fights and saves from before the Resolve economy recorded Solitaire combat's
// per-ability allowances here. Current actors carry Resolve instead and current encounter
// builds normalize those allowances away. Keep this module deterministic so old replays can
// still be opened, settled, and migrated without silently changing their recorded rules.

import { UNLIMITED_USES, getSkill, usesPerAct } from "./skills.js";

export const COMBAT_READINESS_VERSION = 1;

/** A character who has not spent anything yet. */
export function emptyReadiness() {
  return {};
}

function limitFor(skillId, rank) {
  return getSkill(skillId) ? usesPerAct(skillId, rank) : null;
}

/**
 * Whether a stored readiness map is usable.
 *
 * Unknown skills and impossible counts fail rather than being coerced: a readiness map that
 * has drifted from the loadout is a save that would quietly hand out uses nobody earned.
 */
export function isReadiness(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(([skillId, remaining]) => (
    Boolean(getSkill(skillId))
    && Number.isSafeInteger(remaining)
    && remaining >= 0
  ));
}

/**
 * The skill states a fight should open with.
 *
 * A skill with no readiness entry opens full — that is the right reading for one just
 * learned, and it means adding a skill to a loadout never has to remember to seed a map.
 * Anything above its own limit is clamped, so a stale or edited entry cannot mint uses.
 */
export function skillStatesForReadiness(skills, readiness = {}) {
  return skills.map((entry) => {
    const state = typeof entry === "string" ? { id: entry, rank: 1 } : { ...entry };
    const limit = limitFor(state.id, state.rank ?? 1);
    if (limit === UNLIMITED_USES || limit === null) {
      return { ...state, usesRemaining: UNLIMITED_USES, cooldownRemaining: 0 };
    }
    const stored = readiness[state.id];
    const remaining = Number.isSafeInteger(stored) ? Math.min(limit, Math.max(0, stored)) : limit;
    // Cooldowns are tactical and belong inside one encounter; a fight never opens on a
    // cooldown left over from the last one.
    return { ...state, usesRemaining: remaining, cooldownRemaining: 0 };
  });
}

function readinessFromSkills(skills) {
  const readiness = {};
  for (const state of skills || []) {
    if (state.usesRemaining === UNLIMITED_USES) continue;
    if (!Number.isSafeInteger(state.usesRemaining)) continue;
    readiness[state.id] = Math.max(0, state.usesRemaining);
  }
  return readiness;
}

/** What a finished fight leaves in the player's pack. */
export function readinessFromEncounter(encounter) {
  return readinessFromSkills(encounter?.build?.skills);
}

/**
 * What the fight left in each ally's pack, keyed by the actor id they fought under.
 *
 * A companion's readiness settles on its own terms, like the rest of their fate. Refilling
 * them every fight while the player carried their depletion would make bringing someone
 * along a way to launder the scarcity the whole model exists for.
 */
export function allyReadinessFromEncounter(encounter) {
  const out = {};
  for (const [allyId, build] of Object.entries(encounter?.allyBuilds || {})) {
    out[allyId] = readinessFromSkills(build.skills);
  }
  return out;
}

/** Whether a stored map of per-companion readiness is usable. */
export function isCompanionReadiness(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every(isReadiness);
}

/**
 * Drop entries for skills the character no longer carries.
 *
 * Otherwise a readiness map grows forever and, worse, a skill dropped and later re-learned
 * would come back as depleted as it was when it left.
 */
export function pruneReadiness(readiness, skills) {
  const held = new Set(skills.map((entry) => (typeof entry === "string" ? entry : entry?.id)));
  return Object.fromEntries(
    Object.entries(readiness || {}).filter(([skillId]) => held.has(skillId)),
  );
}

/**
 * A completed safe rest: everything back.
 *
 * Deliberately a full restore rather than a partial one. Solitaire combat refills a whole act
 * at once, and a partial trickle would turn every night into arithmetic about whether it was
 * worth stopping.
 */
export function restoreReadiness() {
  return emptyReadiness();
}

/** How spent the character is, for a UI that wants to say so before a fight starts. */
export function readinessSummary(skills, readiness = {}) {
  let remaining = 0;
  let capacity = 0;
  for (const entry of skills) {
    const skillId = typeof entry === "string" ? entry : entry?.id;
    const rank = typeof entry === "string" ? 1 : entry?.rank ?? 1;
    const limit = limitFor(skillId, rank);
    if (limit === UNLIMITED_USES || limit === null) continue;
    capacity += limit;
    const stored = readiness[skillId];
    remaining += Number.isSafeInteger(stored) ? Math.min(limit, Math.max(0, stored)) : limit;
  }
  return { remaining, capacity, fraction: capacity > 0 ? remaining / capacity : 1 };
}
