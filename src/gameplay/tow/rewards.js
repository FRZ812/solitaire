// What a fight is worth, decided by the engine.
//
// Winning has, until now, been worth proficiency and a little coin. The build a character
// carries could not grow from it at all: traits and skills were recomputed from profession
// and level every time a fight started, so a reward would have evaporated on the next
// encounter. The durable build fixed the storage; this is the thing that fills it.
//
// The shape is deliberately narrow. An offer is three eligible choices drawn from a seeded
// stream against the registries as they stand, with an objective reason recorded for every
// candidate that was ruled out. A claim is idempotent and writes to the build with
// provenance — which offer, which receipt, which ruleset. There is one optional reroll, and
// it is a recorded step rather than a fresh roll of the dice.
//
// The narrator is not in this file, and that is the point. It may say a fight felt like it
// should be worth something. It cannot mint an id, choose a rank, or decide a reward is
// available: every one of those is a registry lookup and an engine rule, because a model
// that can name its own rewards is a model that can hand out anything it can spell.

import { cloneJsonData, equalJsonData } from "../kernel/json-data.js";
import { gameplayChecksum } from "../kernel/replay.js";
import { createRng, nextInt } from "../kernel/rng.js";
import { acquireRune, acquireTrait, createTowBuild, isTowBuild } from "./build.js";
import {
  MAX_TOW_REWARD_REROLLS,
  TOW_RULESET_ID,
} from "./session.js";
import {
  SKILL_SLOTS,
  abilityReplacementFamily,
  getSkill,
  loadoutCharacterId,
  maxRankOf,
  replacementSkillIds,
  skillIds,
} from "./skills.js";
import { TRAIT_CAPACITY, TRAIT_RANK_CAP, getTrait, traitIds } from "./traits.js";

export const TOW_REWARD_VERSION = 1;

/** Three is enough to be a decision and few enough to be read at a glance. */
export const REWARD_CHOICE_COUNT = 3;
export const MAX_REWARD_REROLLS = MAX_TOW_REWARD_REROLLS;

export const REWARD_KINDS = Object.freeze(["trait", "skill"]);

export function rewardOfferIdFor(sourceReceiptId, seed) {
  if (!identifier(sourceReceiptId) || !identifier(seed)) return null;
  return `reward-${gameplayChecksum({ sourceReceiptId, seed })}`;
}

const OFFER_KEYS = Object.freeze([
  "candidates",
  "checksum",
  "claimedId",
  "id",
  "ineligible",
  "rerolled",
  "rerollsRemaining",
  "replacedSkill",
  "rulesetId",
  "seed",
  "sourceReceiptId",
  "version",
].sort());
const LEGACY_OFFER_KEYS = Object.freeze(
  OFFER_KEYS.filter((key) => key !== "replacedSkill"),
);

function exactKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const own = Object.keys(value).sort();
  return own.length === keys.length && own.every((key, index) => key === keys[index]);
}

function identifier(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 256;
}

function rewardOfferChecksum(value) {
  const { checksum: _checksum, ...payload } = value;
  return gameplayChecksum(payload);
}

function sealRewardOffer(value) {
  const offer = { ...value, checksum: null };
  offer.checksum = rewardOfferChecksum(offer);
  return offer;
}

/**
 * Why a candidate cannot be offered.
 *
 * Recorded rather than filtered silently, because "there was nothing to give you" and "you
 * already have all of it" are different answers, and only one of them is a bug.
 */
function ineligibility(build, candidate) {
  const characterId = loadoutCharacterId(build.skills);
  if (candidate.kind === "trait") {
    const trait = getTrait(candidate.id);
    if (!trait) return "unknown-trait";
    if (trait.exclusiveTo && trait.exclusiveTo !== characterId) {
      return "trait-exclusive-to-another-character";
    }
    const held = build.traits[candidate.id];
    if (held !== undefined && held >= TRAIT_RANK_CAP) return "trait-at-rank-cap";
    if (held === undefined && Object.keys(build.traits).length >= TRAIT_CAPACITY) {
      return "trait-capacity-full";
    }
    return null;
  }
  const skill = getSkill(candidate.id);
  if (!skill) return "unknown-skill";
  if (skill.slot !== "slotted") return "skill-has-no-slot";
  if (skill.exclusiveTo && skill.exclusiveTo !== characterId) {
    return "skill-exclusive-to-another-character";
  }
  const held = build.skills.find((entry) => entry.id === candidate.id);
  if (held?.rank >= maxRankOf(candidate.id)) return "skill-at-rank-cap";
  if (held) return null;
  if (build.skills.length >= SKILL_SLOTS) {
    if (replacementSkillIds(build.skills, skill).length === 0) {
      return "no-compatible-ability-slot";
    }
  }
  return null;
}

/**
 * Everything the registries could offer, in a stable order.
 *
 * Derived from the live catalogues rather than a curated list, so a trait or skill added to
 * the game becomes reachable without anyone remembering to add it here — and the
 * ineligibility rules above are the only gate.
 */
export function rewardCandidates() {
  return [
    ...traitIds().slice().sort().map((id) => ({ kind: "trait", id })),
    ...skillIds().slice().sort().map((id) => ({ kind: "skill", id })),
  ];
}

function describe(candidate, build) {
  if (candidate.kind === "trait") {
    const trait = getTrait(candidate.id);
    return {
      kind: "trait",
      id: candidate.id,
      name: trait.name,
      detail: `${trait.effect.status} on ${trait.cadence.type.replace(/-/g, " ")}`,
    };
  }
  const skill = getSkill(candidate.id);
  const held = build.skills.find((entry) => entry.id === candidate.id);
  const requiresReplacement = !held && build.skills.length >= SKILL_SLOTS;
  const family = skill.abilityType === "basic-attack"
    ? "Basic Attack"
    : skill.abilityType === "defensive"
      ? "Defensive"
      : "flexible";
  return {
    kind: "skill",
    id: candidate.id,
    name: skill.name,
    detail: `${skill.rarity} ${skill.abilityType === "general" ? "general ability" : skill.exclusiveTo ? "archetype ability" : "action"}${
      skill.consumesTurn ? "" : ", keeps action"
    }${requiresReplacement ? ` · replaces the ${family} slot` : ""}`,
    requiresReplacement,
    ...(held ? { currentRank: held.rank, nextRank: held.rank + 1 } : {}),
  };
}

/**
 * Draw the choices.
 *
 * A seeded shuffle over the eligible pool rather than repeated independent draws, so the
 * three are always distinct and the same seed always produces the same three.
 */
function drawChoices(pool, rng, count) {
  const remaining = [...pool];
  const chosen = [];
  let current = rng;
  while (chosen.length < count && remaining.length > 0) {
    const pick = nextInt(current, 0, remaining.length - 1);
    current = pick.rng;
    chosen.push(remaining.splice(pick.value, 1)[0]);
  }
  return { chosen, rng: current };
}

/**
 * Compile a reward offer for a settled expedition.
 *
 * @param {object} build the durable build the reward would be written into
 * @param {{sourceReceiptId: string, seed: string, rerolls?: number}} context
 */
export function compileRewardOffer(build, { sourceReceiptId, seed, rerolls = 0 } = {}) {
  if (!build || typeof build !== "object") {
    return { ok: false, reason: "invalid-build", offer: null };
  }
  if (!identifier(sourceReceiptId)) {
    return { ok: false, reason: "invalid-reward-source", offer: null };
  }
  if (!identifier(seed)) return { ok: false, reason: "invalid-reward-seed", offer: null };
  if (!Number.isSafeInteger(rerolls) || rerolls < 0 || rerolls > MAX_REWARD_REROLLS) {
    return { ok: false, reason: "invalid-reward-rerolls", offer: null };
  }

  const ineligible = [];
  const pool = [];
  for (const candidate of rewardCandidates()) {
    const reason = ineligibility(build, candidate);
    if (reason) ineligible.push({ ...candidate, reason });
    else pool.push(candidate);
  }
  if (pool.length === 0) {
    // Nothing left to give is a real, reportable state rather than an empty offer: a build
    // at every cap has earned the right to be told so.
    return { ok: false, reason: "no-eligible-rewards", offer: null, ineligible };
  }

  const { chosen } = drawChoices(pool, createRng(seed), REWARD_CHOICE_COUNT);
  const offer = sealRewardOffer({
    version: TOW_REWARD_VERSION,
    id: rewardOfferIdFor(sourceReceiptId, seed),
    rulesetId: TOW_RULESET_ID,
    sourceReceiptId,
    seed,
    candidates: chosen.map((candidate) => describe(candidate, build)),
    // Only the reasons that would surprise someone: the full list of every skill in the game
    // they do not have room for is noise, not information.
    ineligible: ineligible.filter((entry) => entry.reason !== "skill-exclusive-to-another-character"
      && entry.reason !== "trait-exclusive-to-another-character"),
    rerollsRemaining: rerolls,
    rerolled: false,
    replacedSkill: null,
    claimedId: null,
  });
  return { ok: true, reason: null, offer };
}

function isRewardOfferForRuleset(value, rulesetId) {
  if (!exactKeys(value, OFFER_KEYS)) return false;
  return value.version === TOW_REWARD_VERSION
    && identifier(value.id)
    && identifier(value.checksum)
    && value.rulesetId === rulesetId
    && identifier(value.sourceReceiptId)
    && identifier(value.seed)
    && Array.isArray(value.candidates)
    && value.candidates.length > 0
    && value.candidates.every((entry) => REWARD_KINDS.includes(entry.kind)
      && identifier(entry.id)
      && (entry.requiresReplacement === undefined || typeof entry.requiresReplacement === "boolean"))
    && Array.isArray(value.ineligible)
    && Number.isSafeInteger(value.rerollsRemaining)
    && value.rerollsRemaining >= 0
    && typeof value.rerolled === "boolean"
    && (value.replacedSkill === null
      || (value.claimedId !== null
        && exactKeys(value.replacedSkill, ["id", "rank"])
        && identifier(value.replacedSkill.id)
        && Boolean(getSkill(value.replacedSkill.id))
        && Number.isSafeInteger(value.replacedSkill.rank)
        && value.replacedSkill.rank >= 1
        && value.replacedSkill.rank <= maxRankOf(value.replacedSkill.id)))
    && (value.claimedId === null || identifier(value.claimedId))
    && value.checksum === rewardOfferChecksum(value);
}

export function isRewardOffer(value) {
  return isRewardOfferForRuleset(value, TOW_RULESET_ID);
}

function matchesDeterministicOffer(build, offer) {
  const compiled = compileRewardOffer(build, {
    sourceReceiptId: offer.sourceReceiptId,
    seed: offer.seed,
    rerolls: offer.rerollsRemaining,
  });
  if (!compiled.ok) return false;
  if (!offer.rerolled && offer.id !== compiled.offer.id) return false;
  try {
    return equalJsonData(offer.candidates, compiled.offer.candidates)
      && equalJsonData(offer.ineligible, compiled.offer.ineligible);
  } catch {
    return false;
  }
}

export function isDeterministicRewardOffer(build, offer) {
  return isTowBuild(build) && isRewardOffer(offer) && matchesDeterministicOffer(build, offer);
}

export function migrateRewardOfferToCurrentRuleset(build, offer) {
  const sourceRulesetId = offer?.rulesetId;
  let normalized = offer;
  if (identifier(sourceRulesetId)
    && exactKeys(offer, LEGACY_OFFER_KEYS)
    && offer.checksum === rewardOfferChecksum(offer)) {
    normalized = sealRewardOffer({ ...offer, replacedSkill: null });
  }
  if (!isTowBuild(build)
    || !identifier(sourceRulesetId)
    || sourceRulesetId === TOW_RULESET_ID
    || !isRewardOfferForRuleset(normalized, sourceRulesetId)
    || normalized.claimedId !== null) {
    return { ok: false, reason: "invalid-retired-reward-offer", offer: null };
  }
  const migrated = sealRewardOffer({ ...normalized, rulesetId: TOW_RULESET_ID });
  if (!matchesDeterministicOffer(build, migrated)) {
    return { ok: false, reason: "invalid-retired-reward-offer", offer: null };
  }
  return { ok: true, reason: null, offer: migrated };
}

export function recompileRetiredRewardOffer(build, offer) {
  const compiled = compileRewardOffer(build, {
    sourceReceiptId: offer?.sourceReceiptId,
    seed: offer?.seed,
    rerolls: offer?.rerollsRemaining,
  });
  if (!compiled.ok || typeof offer?.id !== "string" || typeof offer?.rerolled !== "boolean") {
    return { ok: false, reason: "invalid-retired-reward-offer", offer: null };
  }
  return {
    ok: true,
    reason: null,
    offer: sealRewardOffer({
      ...compiled.offer,
      id: offer.id,
      rerolled: offer.rerolled,
    }),
  };
}

function buildContainsClaimedReward(build, offer, candidateId) {
  if (!isTowBuild(build)) return false;
  const candidate = offer.candidates.find((entry) => entry.id === candidateId);
  if (!candidate) return false;
  let before;
  try {
    if (candidate.kind === "trait") {
      const rank = build.traits[candidateId];
      if (!Number.isSafeInteger(rank) || rank < 1) return false;
      const traits = { ...build.traits };
      if (rank === 1) delete traits[candidateId];
      else traits[candidateId] = rank - 1;
      before = createTowBuild({ ...build, traits });
    } else if (offer.replacedSkill !== null) {
      const held = build.skills.find((entry) => entry.id === candidateId);
      if (!held || held.rank !== 1) return false;
      const skills = build.skills.map((entry) => (
        entry.id === candidateId ? { ...offer.replacedSkill } : entry
      ));
      before = createTowBuild({ ...build, skills });
    } else {
      const held = build.skills.find((entry) => entry.id === candidateId);
      if (!held) return false;
      const skills = held.rank > 1
        ? build.skills.map((entry) => (
          entry.id === candidateId ? { ...entry, rank: entry.rank - 1 } : entry
        ))
        : build.skills.filter((entry) => entry.id !== candidateId);
      before = createTowBuild({ ...build, skills });
    }
  } catch {
    return false;
  }
  return matchesDeterministicOffer(before, offer);
}

/**
 * Spend the reroll.
 *
 * Derives a new seed from the old one rather than drawing a fresh one, so a rerolled offer
 * is still reproducible from the settlement that produced it — and so "reroll" cannot become
 * an unlimited retry by anyone who can call it twice.
 */
export function rerollRewardOffer(build, offer) {
  if (!isRewardOffer(offer)) return { ok: false, reason: "invalid-reward-offer", offer: null };
  if (offer.claimedId) return { ok: false, reason: "reward-already-claimed", offer };
  if (!matchesDeterministicOffer(build, offer)) {
    return { ok: false, reason: "invalid-reward-offer", offer: null };
  }
  if (offer.rerollsRemaining <= 0) return { ok: false, reason: "no-rerolls-remaining", offer };

  const rerolled = compileRewardOffer(build, {
    sourceReceiptId: offer.sourceReceiptId,
    seed: `${offer.seed}::reroll::${offer.rerollsRemaining}`,
    rerolls: offer.rerollsRemaining - 1,
  });
  if (!rerolled.ok) return { ok: false, reason: rerolled.reason, offer };
  return {
    ok: true,
    reason: null,
    // The id follows the original, so a claim against the reward for this fight is still a
    // claim against one offer rather than two.
    offer: sealRewardOffer({ ...rerolled.offer, id: offer.id, rerolled: true }),
  };
}

/**
 * Take one of the three.
 *
 * Idempotent by claim id: claiming the same choice twice returns the build unchanged, which
 * is what a double-tap or a resumed save needs. Claiming a *different* choice after one is
 * taken is refused rather than applied, because that is not a retry, it is a second reward.
 */
export function claimReward(build, offer, candidateId, { replacingId = null } = {}) {
  if (!isRewardOffer(offer)) return { ok: false, reason: "invalid-reward-offer", build: null, offer };
  if (offer.claimedId) {
    if (offer.claimedId !== candidateId) {
      return { ok: false, reason: "reward-already-claimed", build: null, offer };
    }
    return buildContainsClaimedReward(build, offer, candidateId)
      ? { ok: true, reason: null, build, offer, duplicate: true }
      : { ok: false, reason: "claimed-reward-build-mismatch", build: null, offer };
  }
  const candidate = offer.candidates.find((entry) => entry.id === candidateId);
  if (!candidate) return { ok: false, reason: "reward-not-offered", build: null, offer };

  // Re-checked at claim time, not merely at offer time: the build can have moved between the
  // two, and a reward that was legal an hour ago must not write an illegal build now.
  const blocked = ineligibility(build, candidate);
  if (blocked) return { ok: false, reason: blocked, build: null, offer };
  if (!matchesDeterministicOffer(build, offer)) {
    return { ok: false, reason: "invalid-reward-offer", build: null, offer };
  }

  const heldSkill = candidate.kind === "skill"
    ? build.skills.find((entry) => entry.id === candidate.id)
    : null;
  const applied = candidate.kind === "trait"
    ? acquireTrait(build, candidate.id)
    : acquireSkillReward(build, candidate.id, { replacingId });
  if (!applied.ok) return { ok: false, reason: applied.reason, build: null, offer };

  return {
    ok: true,
    reason: null,
    build: applied.build,
    offer: sealRewardOffer({
      ...offer,
      claimedId: candidateId,
      replacedSkill: candidate.kind === "skill" && !heldSkill
        ? applied.replacedSkill
        : null,
    }),
    duplicate: false,
    // Provenance: which offer, which fight, which rules. A build that grew without a record
    // of where it grew from cannot be audited when someone reports an impossible character.
    provenance: {
      offerId: offer.id,
      sourceReceiptId: offer.sourceReceiptId,
      rulesetId: offer.rulesetId,
      kind: candidate.kind,
      id: candidate.id,
      rank: candidate.kind === "skill"
        ? applied.build.skills.find((entry) => entry.id === candidate.id).rank
        : applied.build.traits[candidate.id],
      replacedId: candidate.kind === "skill" && !heldSkill
        ? applied.replacedSkill?.id ?? null
        : null,
    },
  };
}

function acquireSkillReward(build, skillId, { replacingId = null } = {}) {
  const definition = getSkill(skillId);
  if (!definition) return { ok: false, reason: "unknown-skill", build: null };
  const held = build.skills.find((entry) => entry.id === skillId);
  if (held) {
    if (held.rank >= maxRankOf(skillId)) {
      return { ok: false, reason: "skill-at-rank-cap", build: null };
    }
    return {
      ok: true,
      reason: null,
      build: createTowBuild({
        ...build,
        skills: build.skills.map((entry) => (
          entry.id === skillId ? { ...entry, rank: entry.rank + 1 } : entry
        )),
      }),
      replacedSkill: null,
    };
  }
  let skills;
  let replacedSkill = null;
  const family = abilityReplacementFamily(definition);
  const compatible = replacementSkillIds(build.skills, definition);
  if ((family === "basic-attack" || family === "defensive") && compatible.length > 0) {
    const replacement = replacingId || compatible[0];
    if (!compatible.includes(replacement)) {
      return { ok: false, reason: "incompatible-ability-slot", build: null };
    }
    replacedSkill = { ...build.skills.find((entry) => entry.id === replacement) };
    skills = build.skills.map((entry) => (
      entry.id === replacement ? { id: skillId, rank: 1 } : entry
    ));
  } else if (build.skills.length >= SKILL_SLOTS) {
    if (replacingId === null) return { ok: false, reason: "replacement-required", build: null };
    const replaceAt = build.skills.findIndex((entry) => entry.id === replacingId);
    if (replaceAt < 0) return { ok: false, reason: "unknown-replacement", build: null };
    if (!replacementSkillIds(build.skills, definition).includes(replacingId)) {
      const incomingFamily = family;
      const replacedFamily = abilityReplacementFamily(getSkill(replacingId));
      const reason = incomingFamily === "flexible" && replacedFamily !== "flexible"
        ? "protected-ability-slot"
        : "incompatible-ability-slot";
      return { ok: false, reason, build: null };
    }
    replacedSkill = { ...build.skills[replaceAt] };
    skills = build.skills.map((entry, index) => (
      index === replaceAt ? { id: skillId, rank: 1 } : entry
    ));
  } else {
    skills = [...build.skills, { id: skillId, rank: 1 }];
  }
  let next;
  try {
    next = createTowBuild(cloneJsonData({ ...build, skills }, "invalid-build"));
  } catch {
    return { ok: false, reason: "invalid-build", build: null };
  }
  return { ok: true, reason: null, build: next, replacedSkill };
}

/** A rune grant, for the open-world channel. Same build, same provenance shape. */
export function grantRune(build, runeId, { sourceReceiptId }) {
  const applied = acquireRune(build, runeId);
  if (!applied.ok) return { ok: false, reason: applied.reason, build: null };
  return {
    ok: true,
    reason: null,
    build: applied.build,
    provenance: { sourceReceiptId, rulesetId: TOW_RULESET_ID, kind: "rune", id: runeId },
  };
}

/** The seed a settlement's offer is drawn from: derived, recorded, reproducible. */
export function rewardSeedFor(sessionId, streamEndpoint) {
  return `${sessionId}::reward::${streamEndpoint?.state ?? 0}`;
}
