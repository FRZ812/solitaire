// Phase 0 support matrix: one classification for every capability the game can present
// to a fight.
//
// The point of this file is that nothing is quietly unsupported. Every ability, condition,
// trait, skill, status and profession resolves to exactly one entry saying whether the
// Tower of Winter kernel runs it, runs an adapted form of it, or refuses the encounter
// outright — and, where a number is not captured evidence, saying so.
//
// Coverage is expressed as domain rules plus per-id overrides rather than hundreds of
// hand-written rows, so a new ability cannot appear in the catalogue without inheriting a
// classification. compatibility.test.js derives the id lists from the live modules, so the
// matrix cannot drift away from what the game actually contains.

import { ABILITY_CATALOG } from "../../data/abilities.js";
import { CONDITIONS } from "../../data/conditions.js";
import { statusTypes, getStatusDefinition } from "../kernel/status-stack.js";
import { fusionIds, getTrait, traitIds } from "./traits.js";
import { passiveSkillIds, skillIds } from "./skills.js";
import { mappedProfessionIds } from "./professions.js";

/** What the kernel does with a capability when a fight starts. */
export const SUPPORT = Object.freeze({
  /** Resolves on the kernel today. */
  SUPPORTED: "supported",
  /** Resolves, but in a shape changed from its source. */
  ADAPTED: "adapted",
  /** Admission refuses the encounter rather than dropping the capability silently. */
  REFUSED: "refused",
  /** Exists in the world and is real elsewhere, but has no combat expression. */
  ABSENT: "absent",
});

/** How close a supported behaviour is to captured Tower of Winter evidence. */
export const FIDELITY = Object.freeze({
  /** Matches a captured value or rule in docs/design/TOW_EVIDENCE.md. */
  EXACT: "exact",
  /** A Tower of Winter mechanic reshaped to fit Solitaire's persistent world. */
  ADAPTED: "adapted",
  /** Solitaire-native, with no Tower of Winter counterpart. */
  EXTENDED: "extended",
  /** Provisional number standing in for evidence not yet captured. */
  BALANCE: "balance",
});

const SUPPORT_VALUES = new Set(Object.values(SUPPORT));
const FIDELITY_VALUES = new Set(Object.values(FIDELITY));

function rule({ domain, support, fidelity, reason, source }) {
  return Object.freeze({ domain, support, fidelity, reason, source });
}

/**
 * Default classification per domain. An id with no override inherits its domain rule.
 *
 * `reason` on a REFUSED domain is the objective block reason the Phase 0 gate requires:
 * it names the admission check that turns the capability away, so "unsupported" is always
 * traceable to code rather than to an omission.
 */
export const DOMAIN_RULES = Object.freeze({
  "tow-trait": rule({
    domain: "tow-trait",
    support: SUPPORT.SUPPORTED,
    fidelity: FIDELITY.BALANCE,
    reason: "Trait effect and cadence are captured; the rank 1-7 interpolation between the "
      + "captured endpoints is PROVISIONAL_RANK_SCALING.",
    source: "src/gameplay/tow/traits.js",
  }),
  "tow-fusion": rule({
    domain: "tow-fusion",
    support: SUPPORT.SUPPORTED,
    fidelity: FIDELITY.EXACT,
    reason: "Pairing, rank-7 requirement and consume-both semantics are captured. A fusion "
      + "whose rune is not captured refuses to fire rather than inventing a rune id.",
    source: "src/gameplay/tow/traits.js",
  }),
  "tow-skill": rule({
    domain: "tow-skill",
    support: SUPPORT.SUPPORTED,
    fidelity: FIDELITY.EXACT,
    reason: "Per-rank magnitudes are transcribed verbatim from the evidence ledger.",
    source: "src/gameplay/tow/skills.js",
  }),
  "tow-passive-skill": rule({
    domain: "tow-passive-skill",
    support: SUPPORT.SUPPORTED,
    fidelity: FIDELITY.EXACT,
    reason: "Flat stat increases, transcribed verbatim; they consume no slot.",
    source: "src/gameplay/tow/skills.js",
  }),
  "tow-status": rule({
    domain: "tow-status",
    support: SUPPORT.SUPPORTED,
    fidelity: FIDELITY.EXACT,
    reason: "Lifecycle flags read directly from the wiki status table.",
    source: "src/gameplay/kernel/status-stack.js",
  }),
  profession: rule({
    domain: "profession",
    support: SUPPORT.ADAPTED,
    fidelity: FIDELITY.EXTENDED,
    reason: "Solitaire professions have no Tower of Winter counterpart. Each maps to a "
      + "starting trait plus a skill loadout; the profession itself is not a combat entity.",
    source: "src/gameplay/tow/professions.js",
  }),
  "player-ability": rule({
    domain: "player-ability",
    support: SUPPORT.ABSENT,
    fidelity: FIDELITY.EXTENDED,
    reason: "Superseded by the profession's Tower of Winter package, which is the combat "
      + "identity by design rather than by omission. admitTowEncounter records each "
      + "superseded ability by name, so the substitution is inspectable instead of silent; "
      + "the ability stays fully real everywhere outside a fight.",
    source: "src/gameplay/tow/admission.js",
  }),
  "racial-passive": rule({
    domain: "racial-passive",
    support: SUPPORT.ABSENT,
    fidelity: FIDELITY.EXTENDED,
    reason: "Racial passives are computed in progression code with no combat rule attached. "
      + "admitTowEncounter records each one as superseded by the package rather than letting "
      + "it disappear between the character sheet and the fight.",
    source: "src/gameplay/tow/admission.js",
  }),
  companion: rule({
    domain: "companion",
    support: SUPPORT.ADAPTED,
    fidelity: FIDELITY.EXTENDED,
    reason: "A combat-capable companion is fielded as an allied Tower of Winter actor under "
      + "player command, with a build and a fate of their own. Their conditions are admitted "
      + "as their own opening statuses, and one carrying something the encounter cannot "
      + "express blocks the fight rather than walking in with part of themselves missing.",
    source: "src/gameplay/tow/admission.js",
  }),
  condition: rule({
    domain: "condition",
    support: SUPPORT.ADAPTED,
    fidelity: FIDELITY.EXTENDED,
    reason: "Each authored condition maps to an opening Tower of Winter status, or is "
      + "recorded as having no combat expression with a stated reason. A condition with no "
      + "entry blocks admission, so a newly authored debuff cannot silently do nothing.",
    source: "src/gameplay/tow/admission.js",
  }),
});

/**
 * Per-id exceptions to the domain rule, keyed `domain:id`.
 *
 * The key carries the domain because ids collide across domains — `charge` is both a
 * trait and the status that trait grants — and an unscoped override would reclassify the
 * wrong capability.
 *
 * Kept deliberately small. An entry here is a claim that this specific id behaves
 * differently from its domain, and it must say why.
 */
export const OVERRIDES = Object.freeze({
  // Charge and Shocker scale an interval rather than an amount, so the rank ramp is not
  // the shared linear one; both endpoints are captured.
  "tow-trait:charge": rule({
    domain: "tow-trait",
    support: SUPPORT.SUPPORTED,
    fidelity: FIDELITY.EXACT,
    reason: "Interval scales 5 down to 2 turns; both endpoints captured.",
    source: "src/gameplay/tow/traits.js",
  }),
  "tow-trait:shocker": rule({
    domain: "tow-trait",
    support: SUPPORT.SUPPORTED,
    fidelity: FIDELITY.EXACT,
    reason: "Interval scales 7 down to 4 turns; both endpoints captured.",
    source: "src/gameplay/tow/traits.js",
  }),
});

/** Statuses named by the catalogue whose lifecycle the wiki table does not record. */
export function gapLifecycleStatusTypes() {
  return statusTypes().filter((type) => getStatusDefinition(type).lifecycleEvidence === "gap");
}

/** Traits restricted to one authored character rather than generally acquirable. */
export function exclusiveTraitIds() {
  return traitIds().filter((id) => getTrait(id).exclusiveTo !== null);
}

function domainOf(id, fallbackDomain) {
  const key = `${fallbackDomain}:${id}`;
  if (Object.hasOwn(OVERRIDES, key)) return OVERRIDES[key];
  return Object.hasOwn(DOMAIN_RULES, fallbackDomain) ? DOMAIN_RULES[fallbackDomain] : null;
}

/**
 * The single classification for one capability.
 *
 * @param {string} id
 * @param {string} domain one of the DOMAIN_RULES keys
 * @returns {{id, domain, support, fidelity, reason, source}|null}
 */
export function supportFor(id, domain) {
  if (typeof id !== "string" || id.length === 0) return null;
  const resolved = domainOf(id, domain);
  if (!resolved) return null;
  return Object.freeze({ id, ...resolved });
}

/** Every capability the live catalogues contain, each with exactly one classification. */
export function capabilityInventory() {
  const rows = [];
  const add = (ids, domain) => {
    for (const id of ids) {
      const entry = supportFor(id, domain);
      if (entry) rows.push(entry);
    }
  };
  add(traitIds(), "tow-trait");
  add(fusionIds(), "tow-fusion");
  add(skillIds(), "tow-skill");
  add(passiveSkillIds(), "tow-passive-skill");
  add(statusTypes(), "tow-status");
  add(mappedProfessionIds(), "profession");
  add(ABILITY_CATALOG.map((ability) => ability.id), "player-ability");
  add(Object.keys(CONDITIONS), "condition");
  return rows;
}

/** Domains this matrix does not yet enumerate, each with why. */
export const UNCOVERED_DOMAINS = Object.freeze([
  Object.freeze({
    domain: "summon",
    reason: "Summons would be temporary allied actors, and the allied side now exists — but "
      + "a summon needs an authored lifecycle, command, targeting and settlement rule before "
      + "one can be fielded, and none of the abilities that would create them are ported. "
      + "Mounts are the same question and are support modifiers rather than actors.",
  }),
  Object.freeze({
    domain: "enemy-mechanic",
    reason: "towEncounterSupport returns unsupported-enemy-mechanics for any foe carrying "
      + "abilities, statuses or procs. Bestiary foes are generated rather than enumerated "
      + "from a fixed id list, so coverage is per-encounter, not per-id.",
  }),
  Object.freeze({
    domain: "reward",
    reason: "No reward loop is wired to the live kernel yet; reward ids belong to the "
      + "preview stack and are classified when that loop is ported.",
  }),
]);

export function isValidSupport(value) {
  return SUPPORT_VALUES.has(value);
}

export function isValidFidelity(value) {
  return FIDELITY_VALUES.has(value);
}
