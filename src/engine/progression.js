import { ATTRIBUTE_CAP, ATTR_KEYS, CHARACTER_LEVEL_CAP } from "../config.js";
import { CHARACTER_TEMPLATES } from "../data/templates.js";
import {
  PROFESSION_LEVEL_CAP,
  PROFESSION_PROFILES,
  RACIAL_PROFILES,
  PROGRESSION_PATHS,
  RACIAL_LEVEL_CAP,
  LEVEL_TIER_BANDS,
  STARTING_LEVEL_BY_POWER_TIER,
  attributeCeilingForLevel,
  canonicalProfessionId,
  canonicalProfessionIdentity,
  compileCharacterProgression,
  compileProfessionTrack,
  compileRacialTrack,
  expandLegacyAttributes,
  isBroadProfessionName,
  pendingProfessionChoices as pendingTrackChoices,
  pendingRacialBranchChoices,
  professionBranchChoices,
  progressionAtLevel,
  progressionXpForLevel,
  normalizeRacialBranchChoices,
  resolveRacialBranchChoice,
  slug,
} from "../data/progression-paths.js";
import { normalizeBranchChoices } from "../data/profession-branches.js";
import { recomputeCarryCapacity, recomputeResolveMax, recomputeVitalityMax } from "./attributes.js";

export const PROGRESSION_VERSION = 2;
export const ATTRIBUTE_SCALE_VERSION = 2;
export const LIVING_WORLD_LEVEL_CAP = 60;
export { PROFESSION_LEVEL_CAP, RACIAL_LEVEL_CAP, attributeCeilingForLevel };

export const AUTHORED_WORLD_LEVELS = Object.freeze({
  "demon-king": 100, "vale-king-asar": 48, "goblin-king": 52, "selenyan-speaker": 58,
  "glass-spire-master": 60, "great-wyrm": 100, "hawthorn-lord": 60, "witch-queen": 78,
  "crowsmoor-baron": 34, "whitemarch-treasurer": 48, "cinder-chapter-master": 50,
  "stonebrook-hold-father": 44, "halfborn-matriarch": 46, "heron-master": 48, "the-hag": 55,
  "king-of-three": 28, "vale-king-asar-vi": 38, "halfborn-matriarch-elect-brann": 40,
  "stonebrook-hold-father-korro": 38, "whitemarch-treasurer-halen": 35,
  "cinder-chapter-master-tovar": 43, "crowsmoor-baron-heir": 28, "heron-master-apprentice": 24,
});

// Individually authored instead of snapping every mount in a rarity family to
// the same hidden power-band anchor.
export const AUTHORED_MOUNT_LEVELS = Object.freeze({
  pony: 7, horse: 9, mule: 8, camel: 13, warhorse: 24, nag: 5,
  "marsh-pony": 11, "ridge-pony": 12, courser: 28, "war-stag": 19,
  "fen-strider": 18, "mountain-ram": 26, "axe-beak": 31, "dire-boar": 33,
  "giant-lizard": 42, "dire-wolf": 36, "ground-drake": 48, griffon: 55,
  wyvern: 67, drake: 84, dragon: 100,
});

export const AUTHORED_APEX_LEVELS = Object.freeze({ "demon-king": 100, "great-wyrm": 100, "witch-queen": 78 });

const TEMPLATE_BY_ID = new Map(CHARACTER_TEMPLATES.map((template) => [template.id, template]));

function boundedLevel(level, cap = CHARACTER_LEVEL_CAP, floor = 1) {
  return Math.max(floor, Math.min(cap, Math.floor(Number(level) || floor)));
}

function stableHash(value) {
  let result = 2166136261;
  for (const character of String(value || "")) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}

function spreadLevelForPowerTier(tierId, character) {
  const normalizedTier = tierId === "mid" ? "mid" : tierId;
  const band = LEVEL_TIER_BANDS.find((entry) => entry.id === normalizedTier);
  if (!band) return null;
  const width = band.max - band.min + 1;
  return band.min + (stableHash(character?.id || character?.name || tierId) % width);
}

function rankTotal(paths = {}, cap = CHARACTER_LEVEL_CAP) {
  return Math.max(0, Math.min(cap, Object.values(paths).reduce((sum, rank) => sum + Math.max(0, Math.floor(Number(rank) || 0)), 0)));
}

function cloneChoices(choices = {}) {
  const grantSelections = choices?.grantSelections && typeof choices.grantSelections === "object"
    ? Object.fromEntries(Object.entries(choices.grantSelections).map(([grantId, selected]) => [grantId, Array.isArray(selected) ? [...selected] : selected]))
    : undefined;
  const metamagicProfiles = choices?.metamagicProfiles && typeof choices.metamagicProfiles === "object"
    ? Object.fromEntries(Object.entries(choices.metamagicProfiles).map(([profileId, selected]) => [profileId, Array.isArray(selected) ? [...selected] : selected]))
    : undefined;
  return {
    ...(choices || {}),
    ...(Array.isArray(choices?.metamagicIds) ? { metamagicIds: [...choices.metamagicIds] } : {}),
    ...(grantSelections ? { grantSelections } : {}),
    ...(metamagicProfiles ? { metamagicProfiles } : {}),
  };
}

function selectedGrantOptions(track, grant, level) {
  if (grant.replace) {
    const selected = track.choices?.signatureExchanges?.[String(level)];
    return selected ? [selected] : [];
  }
  if (grant.selectionKey) {
    const selected = track.choices?.[grant.selectionKey];
    return Array.isArray(selected) ? selected.filter(Boolean) : selected ? [selected] : [];
  }
  const selected = track.choices?.grantSelections?.[grant.id];
  return Array.isArray(selected) ? selected.filter(Boolean) : selected ? [selected] : [];
}

function selectedMetamagicOption(track, grant) {
  return grant.profileId
    ? track.choices?.metamagicProfiles?.[grant.profileId]?.[grant.slot]
    : track.choices?.metamagicIds?.[grant.slot];
}

function occupiedSorcererSpellIds(track, excludingGrantId = null) {
  const occupied = new Set();
  if (track.choices?.signatureSpellId) occupied.add(track.choices.signatureSpellId);
  for (const [grantId, selected] of Object.entries(track.choices?.grantSelections || {})) {
    if (grantId === excludingGrantId) continue;
    for (const spellId of (Array.isArray(selected) ? selected : [selected])) if (spellId) occupied.add(spellId);
  }
  return occupied;
}

function availableGrantOptions(track, grant) {
  // Signature exchange is a focus decision, so selecting the current primary
  // remains valid. Compact repertoire and woven-profile slots, by contrast,
  // cannot duplicate the current primary or another independently held spell.
  if (track.professionId !== "sorcerer" || grant.type !== "ability-choice" || grant.replace || grant.selectionKey) return grant.options;
  const occupied = occupiedSorcererSpellIds(track, grant.id);
  return grant.options.filter((spellId) => !occupied.has(spellId));
}

function isV2(progression) {
  return progression?.version === PROGRESSION_VERSION && Array.isArray(progression.professions) && progression.racial;
}

export function professionProgressionLevel(value) {
  const progression = value?.progression || value;
  if (isV2(progression)) return Math.min(PROFESSION_LEVEL_CAP, progression.professions.reduce((sum, track) => sum + rankTotal(track.paths, PROFESSION_LEVEL_CAP), 0));
  if (!progression?.paths) return 0;
  return Math.min(PROFESSION_LEVEL_CAP, Object.entries(progression.paths).reduce((sum, [pathId, rank]) => {
    const isRacial = PROGRESSION_PATHS[pathId]?.kind === "racial" || pathId === "awakened-lineage" || pathId.startsWith("dragon-ascendant-");
    return sum + (isRacial ? 0 : Math.max(0, Math.floor(Number(rank) || 0)));
  }, 0));
}

export function racialProgressionLevel(value) {
  const progression = value?.progression || value;
  if (isV2(progression)) return rankTotal(progression.racial.paths, RACIAL_LEVEL_CAP);
  if (!progression?.paths) return 0;
  return Math.min(RACIAL_LEVEL_CAP, Object.entries(progression.paths).reduce((sum, [pathId, rank]) => {
    const isRacial = PROGRESSION_PATHS[pathId]?.kind === "racial" || pathId === "awakened-lineage" || pathId.startsWith("dragon-ascendant-");
    return sum + (isRacial ? Math.max(0, Math.floor(Number(rank) || 0)) : 0);
  }, 0));
}

export function allocatedProgressionLevel(value) {
  const progression = value?.progression || value;
  if (isV2(progression)) return Math.min(CHARACTER_LEVEL_CAP, professionProgressionLevel(progression) + racialProgressionLevel(progression));
  return rankTotal(progression?.paths, CHARACTER_LEVEL_CAP);
}

export function progressionLevel(value) {
  const progression = value?.progression || value;
  const allocated = allocatedProgressionLevel(progression);
  return isV2(progression) ? Math.max(allocated, progressionLevelFromXp(progression.xp, CHARACTER_LEVEL_CAP)) : allocated;
}

export function progressionLevelFromXp(xp, cap = CHARACTER_LEVEL_CAP) {
  return Math.max(0, Math.min(cap, Math.floor(Math.sqrt(Math.max(0, Number(xp) || 0) / 20))));
}

export function earnedProgressionLevel(value) {
  const progression = value?.progression || value;
  const allocated = allocatedProgressionLevel(progression);
  return Math.max(allocated, progressionLevelFromXp(progression?.xp, CHARACTER_LEVEL_CAP));
}

export function earnedLevelGrowthText(progress) {
  const earned = Math.max(0, Math.floor(Number(progress?.earnedLevels) || 0));
  if (earned <= 0) return null;
  const first = Math.max(1, progress.afterEarnedLevel - earned + 1);
  const earnedLabel = earned === 1
    ? `Character level ${progress.afterEarnedLevel} earned`
    : `Character levels ${first}-${progress.afterEarnedLevel} earned`;
  const unspent = Math.max(earned, Math.floor(Number(progress.unspentLevels) || 0));
  return `${earnedLabel} · ${unspent} unspent ${unspent === 1 ? "level" : "levels"} must be allocated to racial evolution or a profession.`;
}

function allocatedRanks(compiled, levels) {
  const ranks = {};
  for (const row of compiled.levels.slice(0, levels)) ranks[row.pathId] = row.rank;
  return ranks;
}

function normalizeProfessionInput(input, fallback = {}) {
  const professionValue = input?.professionId || input?.profession || fallback.professionId || fallback.profession || "wanderer";
  const specializationValue = input?.specializationId || input?.specialization || input?.archetypeId || input?.archetype || fallback.specializationId || fallback.archetypeId || null;
  const identity = canonicalProfessionIdentity(professionValue, specializationValue) || canonicalProfessionIdentity("wanderer");
  return {
    professionId: identity.professionId,
    specializationId: identity.specializationId,
    requestedLevels: Math.max(0, Math.floor(Number(input?.levels) || 0)),
    choices: cloneChoices(input?.choices),
    branchChoices: normalizeBranchChoices(identity.professionId, input?.branchChoices || input?.branch_choices, input?.specializationPath || input?.specialization_path),
  };
}

function flattenPaths(professions, racial) {
  return Object.assign({}, racial?.paths || {}, ...professions.map((track) => track.paths || {}));
}

function syncCompatibility(progression) {
  const active = progression.professions.find((track) => track.professionId === progression.activeProfessionId) || progression.professions[0];
  progression.activeProfessionId = active?.professionId || "wanderer";
  progression.professionId = progression.activeProfessionId;
  progression.archetypeId = active?.specializationId || null;
  progression.paths = flattenPaths(progression.professions, progression.racial);
  return progression;
}

export function createProgression({
  professionId = "wanderer",
  archetypeId = null,
  specializationId = null,
  raceId = "human",
  level = null,
  professionLevels = null,
  racialLevels = null,
  professions = null,
  racial = null,
  choices = {},
  branchChoices = {},
  specializationPath = [],
  signatureSpellId = null,
  metamagicIds = null,
  xp = null,
  activeProfessionId = null,
} = {}) {
  const sourceTracks = Array.isArray(professions) && professions.length
    ? professions
    : [{ professionId, specializationId: specializationId || archetypeId, choices, branchChoices, specializationPath }];
  const normalized = sourceTracks.map((track, index) => normalizeProfessionInput(track, index === 0 ? { professionId, specializationId: specializationId || archetypeId } : {}));
  const sorcererTrack = normalized.find((track) => track.professionId === "sorcerer") || normalized[0];
  if (signatureSpellId) sorcererTrack.choices.signatureSpellId = signatureSpellId;
  if (Array.isArray(metamagicIds)) sorcererTrack.choices.metamagicIds = [...metamagicIds];

  const explicitProfessionTotal = normalized.reduce((sum, track) => sum + track.requestedLevels, 0);
  const explicitRacial = racialLevels ?? racial?.levels;
  const declaredTotal = level == null
    ? Math.max(1, explicitProfessionTotal + Math.max(0, Number(explicitRacial) || 0))
    : boundedLevel(level);
  const targetRacial = Math.max(0, Math.min(RACIAL_LEVEL_CAP,
    explicitRacial == null ? Math.max(0, declaredTotal - PROFESSION_LEVEL_CAP) : Math.floor(Number(explicitRacial) || 0)));
  const targetProfession = professionLevels == null
    ? Math.min(PROFESSION_LEVEL_CAP, declaredTotal - targetRacial)
    : Math.max(0, Math.min(PROFESSION_LEVEL_CAP, Math.floor(Number(professionLevels) || 0)));
  if (explicitProfessionTotal > targetProfession) throw new Error(`Profession allocation ${explicitProfessionTotal} exceeds target ${targetProfession}`);
  let unallocated = targetProfession - explicitProfessionTotal;
  if (unallocated > 0) normalized[0].requestedLevels += unallocated;
  if (normalized.reduce((sum, track) => sum + track.requestedLevels, 0) > PROFESSION_LEVEL_CAP) throw new Error(`Profession levels exceed ${PROFESSION_LEVEL_CAP}`);
  if (targetProfession + targetRacial > CHARACTER_LEVEL_CAP) throw new Error(`Character levels exceed ${CHARACTER_LEVEL_CAP}`);

  const builtTracks = normalized.map((track) => {
    const compiled = compileProfessionTrack(track.professionId, {
      specializationId: track.specializationId,
      choices: track.choices,
      branchChoices: track.branchChoices,
    });
    return {
      professionId: track.professionId,
      specializationId: track.specializationId,
      paths: allocatedRanks(compiled, track.requestedLevels),
      choices: cloneChoices(track.choices),
      branchChoices: { ...compiled.branchChoices },
    };
  });
  const racialId = slug(racial?.raceId || raceId) || "human";
  const racialCompiled = compileRacialTrack(racialId, { evolutionId: racial?.evolutionId, branchChoices: racial?.branchChoices, evolutionPath: racial?.evolutionPath });
  const builtRacial = {
    raceId: racialId,
    evolutionId: racial?.evolutionId || racialCompiled.evolutionId,
    paths: allocatedRanks(racialCompiled, targetRacial),
    choices: { ...(racial?.choices || {}) },
    branchChoices: { ...racialCompiled.branchChoices },
  };
  const legacyXpLevel = typeof xp === "object"
    ? Math.max(progressionLevelFromXp(xp?.profession, PROFESSION_LEVEL_CAP), progressionLevelFromXp(xp?.racial, RACIAL_LEVEL_CAP))
    : 0;
  const allocatedTotal = targetProfession + targetRacial;
  const resolvedXp = Math.max(progressionXpForLevel(allocatedTotal), progressionXpForLevel(legacyXpLevel), Math.floor(Number(xp) || 0));
  return syncCompatibility({
    version: PROGRESSION_VERSION,
    activeProfessionId: canonicalProfessionId(activeProfessionId) || builtTracks[0]?.professionId || "wanderer",
    xp: resolvedXp,
    unspentLevels: Math.max(0, progressionLevelFromXp(resolvedXp) - allocatedTotal),
    professions: builtTracks,
    racial: builtRacial,
  });
}

function isAuthoredPlayable(character) {
  return !!(character?.templateId && TEMPLATE_BY_ID.has(character.templateId));
}

function worldBoundedLevel(character, level) {
  const authoredApex = AUTHORED_APEX_LEVELS[character?.id];
  if (authoredApex) return boundedLevel(authoredApex);
  if (isAuthoredPlayable(character)) return boundedLevel(level);
  return Math.min(LIVING_WORLD_LEVEL_CAP, boundedLevel(level));
}

function defaultProfession(character) {
  if (character?.id === "great-wyrm") return "sorcerer";
  return canonicalProfessionId(character?.profession) || "wanderer";
}

function defaultSpecialization(character, professionId) {
  const legacyKey = "sub" + "class";
  const template = TEMPLATE_BY_ID.get(character?.templateId);
  const originalId = slug(character?.profession);
  return character?.archetype || character?.[legacyKey] || template?.setup?.archetype
    || (originalId && !isBroadProfessionName(originalId, professionId) ? originalId : null);
}

export function inferProgressionLevel(character, { legacyScale = false } = {}) {
  if (AUTHORED_WORLD_LEVELS[character?.id]) return AUTHORED_WORLD_LEVELS[character.id];
  if (character?.kind === "mount" && AUTHORED_MOUNT_LEVELS[character?.id]) return AUTHORED_MOUNT_LEVELS[character.id];
  const template = TEMPLATE_BY_ID.get(character?.templateId);
  if (Number.isFinite(Number(character?.level))) return worldBoundedLevel(character, Number(character.level));
  const tier = character?.powerTier || template?.tier;
  if (tier && STARTING_LEVEL_BY_POWER_TIER[tier]) return worldBoundedLevel(character, spreadLevelForPowerTier(tier, character) || STARTING_LEVEL_BY_POWER_TIER[tier]);
  const values = ATTR_KEYS.map((key) => Number(character?.attributes?.[key]) || 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  const peak = Math.max(0, ...values);
  if (legacyScale) {
    if (character?.id === "wanderer" || character?.kind === "player") {
      if (total <= 14) return 3; if (total <= 18) return 8; if (total <= 22) return 10;
      if (total <= 30) return 25; if (total <= 45) return 45; if (total <= 80) return 50;
      return LIVING_WORLD_LEVEL_CAP;
    }
    if (Number(character?.age) > 0 && Number(character.age) <= 13) return Math.min(5, Math.max(1, Math.round(Number(character.age) / 3)));
    let inferred = total <= 10 ? 5 : total <= 12 ? 8 : total <= 14 ? 12 : total <= 18 ? 20 : total <= 22 ? 28 : total <= 30 ? 35 : total <= 45 ? 45 : total <= 80 ? 50 : 60;
    const mastery = Math.max(0, ...(character?.skills || []).map((skill) => Number(skill?.rating) || 0));
    if (mastery >= 4) inferred = Math.max(inferred, 22); else if (mastery >= 3) inferred = Math.max(inferred, 18);
    return Math.min(LIVING_WORLD_LEVEL_CAP, inferred);
  }
  let inferred = total <= 15 && peak <= 4 ? 3 : total <= 30 ? 10 : total <= 65 ? 25 : total <= 110 ? 45 : total <= 170 ? 50 : 60;
  if (character?.id === "wanderer" || character?.kind === "player") return inferred;
  const age = Number(character?.age);
  if (Number.isFinite(age) && age > 0 && age <= 13) return Math.min(5, Math.max(1, inferred, Math.round(age / 3)));
  if (Number.isFinite(age) && age >= 16) inferred = Math.max(inferred, 8);
  if (character?.profession) inferred = Math.max(inferred, 10);
  const mastery = Math.max(0, ...(character?.skills || []).map((skill) => Number(skill?.rating) || 0));
  if (mastery >= 4) inferred = Math.max(inferred, 22); else if (mastery >= 3) inferred = Math.max(inferred, 18);
  return Math.min(LIVING_WORLD_LEVEL_CAP, inferred);
}

function progressionAllocations(progression) {
  return {
    professions: progression.professions.map((track) => ({
      professionId: track.professionId, specializationId: track.specializationId,
      levels: rankTotal(track.paths, PROFESSION_LEVEL_CAP), choices: track.choices,
      branchChoices: track.branchChoices,
    })),
    racial: { raceId: progression.racial.raceId, evolutionId: progression.racial.evolutionId, levels: rankTotal(progression.racial.paths, RACIAL_LEVEL_CAP), branchChoices: progression.racial.branchChoices },
  };
}

function projectedAttributes(progression) {
  return compileCharacterProgression(progressionAllocations(progression)).finalAttributes;
}

function routeScaledAttributes(attributes, projected, level, { preserveValidShape = false } = {}) {
  const ceiling = attributeCeilingForLevel(level);
  const projectedValues = ATTR_KEYS.map((key) => Math.max(0, Math.min(ceiling, Number(projected[key]) || 0)));
  const projectedTotal = projectedValues.reduce((sum, value) => sum + value, 0);
  const suppliedValues = ATTR_KEYS.map((key, index) => {
    const value = Number(attributes?.[key]);
    return Math.max(0, Math.min(ceiling, Number.isFinite(value) ? value : projectedValues[index]));
  });
  const suppliedTotal = suppliedValues.reduce((sum, value) => sum + value, 0);
  if (projectedTotal <= 0) return Object.fromEntries(ATTR_KEYS.map((key) => [key, 0]));
  const lowerBudget = Math.round(projectedTotal * 0.85);
  const upperBudget = Math.round(projectedTotal * 1.15);
  const hasCompleteSheet = ATTR_KEYS.every((key) => Number.isFinite(Number(attributes?.[key])));
  if (preserveValidShape && hasCompleteSheet && suppliedTotal >= lowerBudget && suppliedTotal <= upperBudget) {
    return Object.fromEntries(ATTR_KEYS.map((key, index) => [key, Math.round(suppliedValues[index])]));
  }
  const targetBudget = Math.min(ceiling * ATTR_KEYS.length, Math.max(lowerBudget, Math.min(upperBudget, suppliedTotal || projectedTotal)));
  const weighted = ATTR_KEYS.map((_, index) => targetBudget * ((projectedValues[index] / projectedTotal * 0.7) + ((suppliedTotal > 0 ? suppliedValues[index] / suppliedTotal : projectedValues[index] / projectedTotal) * 0.3)));
  const allocated = weighted.map((value) => Math.min(ceiling, Math.floor(value)));
  let remaining = targetBudget - allocated.reduce((sum, value) => sum + value, 0);
  const order = weighted.map((value, index) => ({ index, remainder: value - Math.floor(value) })).sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  while (remaining > 0) {
    let changed = false;
    for (const { index } of order) {
      if (remaining <= 0) break;
      if (allocated[index] >= ceiling) continue;
      allocated[index]++; remaining--; changed = true;
    }
    if (!changed) break;
  }
  return Object.fromEntries(ATTR_KEYS.map((key, index) => [key, allocated[index]]));
}

export function attributesForProgression(options = {}) {
  const progression = options.progression || createProgression(options);
  const level = Math.max(1, allocatedProgressionLevel(progression));
  return routeScaledAttributes(options.attributes, projectedAttributes(progression), level, { preserveValidShape: options.preserveValidShape !== false });
}

function oldRacialRanks(progression) {
  return Object.entries(progression?.paths || {}).reduce((sum, [pathId, rank]) => {
    const racial = pathId === "awakened-lineage" || pathId.startsWith("dragon-ascendant-") || PROGRESSION_PATHS[pathId]?.kind === "racial";
    return sum + (racial ? Math.max(0, Math.floor(Number(rank) || 0)) : 0);
  }, 0);
}

function cloneProgression(progression) {
  return {
    ...progression,
    xp: Math.max(0, Number(progression.xp) || 0),
    professions: progression.professions.map((track) => ({
      ...track, paths: { ...(track.paths || {}) }, choices: cloneChoices(track.choices), branchChoices: { ...(track.branchChoices || {}) },
    })),
    racial: { ...progression.racial, paths: { ...(progression.racial?.paths || {}) }, choices: { ...(progression.racial?.choices || {}) }, branchChoices: { ...(progression.racial?.branchChoices || {}) } },
    paths: { ...(progression.paths || {}) },
  };
}

export function normalizeCharacterProgression(character, {
  convertLegacyAttributes = false,
  enforceLevelAttributeScale = false,
  alignAttributesToProgression = false,
  preserveValidAttributeShape = false,
} = {}) {
  if (!character) return character;
  const legacyKey = "sub" + "class";
  const oldProgression = character.progression;
  const hadV2 = isV2(oldProgression);
  const inferredLevel = hadV2 ? Math.max(1, allocatedProgressionLevel(oldProgression)) : (oldProgression ? Math.max(1, allocatedProgressionLevel(oldProgression)) : inferProgressionLevel(character, { legacyScale: convertLegacyAttributes }));
  let attributesMutated = false;
  if (convertLegacyAttributes && !hadV2 && oldProgression?.version !== 1 && character.attributes) {
    character.attributes = expandLegacyAttributes(character.attributes);
    attributesMutated = true;
  }
  if (!character.archetype && character[legacyKey]) character.archetype = character[legacyKey];
  if (Object.prototype.hasOwnProperty.call(character, legacyKey)) delete character[legacyKey];
  const professionId = defaultProfession(character);
  const specializationId = defaultSpecialization(character, professionId);
  const plan = character.professionPlan || character.profession_plan;
  const explicitPlan = Array.isArray(plan) ? plan : null;
  const racialLevels = character.racialLevels ?? character.racial_levels;
  const signatureSpellId = character.signatureSpell || character.signature_spell;
  const metamagicIds = character.metamagicIds || character.metamagic_ids;
  if (hadV2 && !explicitPlan && racialLevels == null && !signatureSpellId && !metamagicIds) {
    character.progression = createProgression({
      level: inferredLevel,
      professions: oldProgression.professions.map((track) => ({
        professionId: track.professionId, specializationId: track.specializationId,
        levels: rankTotal(track.paths, PROFESSION_LEVEL_CAP), choices: track.choices,
        branchChoices: track.branchChoices,
      })),
      racial: { ...oldProgression.racial, levels: rankTotal(oldProgression.racial.paths, RACIAL_LEVEL_CAP), branchChoices: oldProgression.racial.branchChoices },
      racialLevels: rankTotal(oldProgression.racial.paths, RACIAL_LEVEL_CAP),
      xp: oldProgression.xp,
      activeProfessionId: oldProgression.activeProfessionId,
    });
  } else {
    const migratedRacial = racialLevels ?? Math.min(RACIAL_LEVEL_CAP, Math.max(oldRacialRanks(oldProgression), inferredLevel - PROFESSION_LEVEL_CAP));
    character.progression = createProgression({
      professionId, specializationId, raceId: character.race || "human", level: inferredLevel,
      racialLevels: migratedRacial,
      professions: explicitPlan?.map((entry) => ({
        professionId: entry.professionId || entry.profession,
        specializationId: entry.specializationId || entry.specialization,
        levels: entry.levels,
        choices: entry.choices,
        branchChoices: entry.branchChoices || entry.branch_choices,
        specializationPath: entry.specializationPath || entry.specialization_path,
      })),
      signatureSpellId, metamagicIds,
      xp: oldProgression?.xp,
    });
  }
  character.profession = character.progression.professionId;
  character.archetype = character.progression.archetypeId || null;
  if (enforceLevelAttributeScale || alignAttributesToProgression) {
    const level = Math.max(1, allocatedProgressionLevel(character));
    const projected = projectedAttributes(character.progression);
    character.attributes = alignAttributesToProgression ? { ...projected } : routeScaledAttributes(character.attributes, projected, level, { preserveValidShape: preserveValidAttributeShape });
    attributesMutated = true;
  }
  if (attributesMutated) {
    recomputeVitalityMax(character); recomputeResolveMax(character); recomputeCarryCapacity(character);
  }
  for (const key of ["level", "professionPlan", "profession_plan", "racialLevels", "racial_levels", "signatureSpell", "signature_spell", "metamagicIds", "metamagic_ids"]) {
    if (Object.prototype.hasOwnProperty.call(character, key)) delete character[key];
  }
  return character;
}

export function migrateProgressionState(state, { alignAuthoredAttributes = false } = {}) {
  if (!state) return state;
  const previousProgressionVersion = Number(state.progressionVersion) || 0;
  const previousAttributeVersion = state.attributeScaleVersion ?? (previousProgressionVersion >= 1 ? ATTRIBUTE_SCALE_VERSION : 1);
  const convertAttributes = previousAttributeVersion < ATTRIBUTE_SCALE_VERSION;
  const migrate = (character, isPlayerProjection = false) => normalizeCharacterProgression(character, {
    convertLegacyAttributes: convertAttributes,
    enforceLevelAttributeScale: convertAttributes && !alignAuthoredAttributes,
    alignAttributesToProgression: alignAuthoredAttributes && !isPlayerProjection && character?.kind !== "mount",
  });
  if (state.character) {
    if (!state.character.id) state.character.id = "wanderer";
    if (!state.character.kind) state.character.kind = "player";
    migrate(state.character, true);
  }
  for (const character of Object.values(state.world?.codex?.characters || {})) {
    const playerProjection = character?.id === "wanderer";
    migrate(character, playerProjection);
    if (playerProjection && state.character?.progression) {
      character.profession = state.character.profession;
      character.archetype = state.character.archetype;
      character.attributes = { ...(state.character.attributes || {}) };
      character.progression = cloneProgression(state.character.progression);
    }
  }
  for (const turn of state.turns || []) {
    if (turn?.char) migrate(turn.char, true);
    for (const character of Object.values(turn?.world?.codex?.characters || {})) migrate(character);
  }
  for (const pooledCodex of state.pools?.codex || []) for (const character of Object.values(pooledCodex?.characters || {})) migrate(character);
  state.progressionVersion = PROGRESSION_VERSION;
  state.attributeScaleVersion = ATTRIBUTE_SCALE_VERSION;
  return state;
}

function applyRowAttributes(character, row, totalLevel) {
  character.attributes = { ...(character.attributes || {}) };
  for (const [key, amount] of Object.entries(row.attributeGains || {})) {
    character.attributes[key] = Math.min(ATTRIBUTE_CAP, attributeCeilingForLevel(totalLevel), Math.max(0, (character.attributes[key] || 0) + amount));
  }
}

function pendingBranchesForProgression(progression) {
  const professionChoices = progression.professions.flatMap((track) => pendingTrackChoices({
    professionId: track.professionId, paths: track.paths, branchChoices: track.branchChoices,
  }).map((choice) => ({ ...choice, kind: "branch", professionId: track.professionId })));
  const racialChoices = pendingRacialBranchChoices(
    progression.racial.raceId,
    racialProgressionLevel(progression),
    progression.racial.branchChoices,
  ).map((choice) => ({ ...choice, kind: "racial-branch", raceId: progression.racial.raceId }));
  return [...professionChoices, ...racialChoices];
}

export function pendingProfessionChoices(value, professionId = null) {
  const progression = value?.progression || value;
  if (!isV2(progression)) return [];
  return pendingBranchesForProgression(progression).filter((choice) => !professionId || choice.professionId === canonicalProfessionId(professionId));
}

export function pendingProgressionChoices(value) {
  const progression = value?.progression || value;
  if (!isV2(progression)) return [];
  const pending = [...pendingBranchesForProgression(progression)];
  for (const track of progression.professions) {
    const level = rankTotal(track.paths, PROFESSION_LEVEL_CAP);
    const compiled = compileProfessionTrack(track.professionId, {
      specializationId: track.specializationId, choices: track.choices, branchChoices: track.branchChoices,
    });
    for (const row of compiled.levels.slice(0, level)) {
      // Branch rewards may themselves be bounded choices (for example a
      // Universalist Wizard adding one or two selected formulae). Scan the
      // complete row, while each grant id retains its own storage key.
      for (const grant of row.grants || []) {
        if (grant.type === "ability-choice") {
          const selectedOptions = selectedGrantOptions(track, grant, row.trackLevel);
          const count = Math.max(1, Math.floor(Number(grant.count) || 1));
          const options = availableGrantOptions(track, grant);
          if (selectedOptions.length < count) pending.push({
            kind: "grant", professionId: track.professionId, level: row.trackLevel,
            ...grant, options: Object.freeze([...options]), count,
            selectedOptions: Object.freeze([...selectedOptions]), remainingCount: count - selectedOptions.length,
          });
        }
        if (grant.type === "metamagic-choice" && !selectedMetamagicOption(track, grant)) {
          pending.push({ kind: "grant", professionId: track.professionId, level: row.trackLevel, ...grant });
        }
      }
    }
  }
  if (pending.length) return pending;
  const allocation = pendingLevelAllocations(progression);
  return allocation ? [allocation] : [];
}

export function pendingLevelAllocations(value) {
  const progression = value?.progression || value;
  if (!isV2(progression)) return null;
  const allocatedLevel = allocatedProgressionLevel(progression);
  const earnedLevel = earnedProgressionLevel(progression);
  const unspentLevels = Math.max(0, Math.min(CHARACTER_LEVEL_CAP - allocatedLevel, earnedLevel - allocatedLevel));
  if (unspentLevels <= 0) return null;
  const professionLevel = professionProgressionLevel(progression);
  const racialLevel = racialProgressionLevel(progression);
  const options = [];
  if (professionLevel < PROFESSION_LEVEL_CAP) {
    const existing = new Map(progression.professions.map((track) => [track.professionId, track]));
    for (const professionId of Object.keys(PROFESSION_PROFILES)) {
      const track = existing.get(professionId);
      const professionName = PROFESSION_PROFILES[professionId]?.name || professionId;
      options.push(Object.freeze({
        optionId: `profession:${professionId}`,
        track: "profession",
        professionId,
        name: track ? `Advance ${professionName}` : `Begin ${professionName}`,
        description: track ? `Invest one rank in the existing ${professionName} profession track.` : `Begin a new ${professionName} multiclass track.`,
        currentTrackLevel: track ? rankTotal(track.paths, PROFESSION_LEVEL_CAP) : 0,
      }));
    }
  }
  if (racialLevel < RACIAL_LEVEL_CAP) options.push(Object.freeze({
    optionId: "racial:evolution",
    track: "racial",
    raceId: progression.racial.raceId,
    name: `Evolve ${RACIAL_PROFILES[progression.racial.raceId]?.name || progression.racial.raceId}`,
    description: "Invest one rank in racial evolution or metamorphosis.",
    currentTrackLevel: racialLevel,
  }));
  return Object.freeze({
    id: `level-allocation-${allocatedLevel + 1}`,
    choiceId: `level-allocation-${allocatedLevel + 1}`,
    kind: "level-allocation",
    level: allocatedLevel + 1,
    threshold: allocatedLevel + 1,
    name: `Allocate level ${allocatedLevel + 1}`,
    description: "Choose racial evolution or one specific profession track for this earned level.",
    allocatedLevel,
    earnedLevel,
    unspentLevels,
    options: Object.freeze(options),
  });
}

export function resolveProfessionChoice(value, { professionId, choiceId, optionId }) {
  const character = value?.progression ? value : null;
  const progression = cloneProgression(character?.progression || value);
  const canonical = canonicalProfessionId(professionId || progression.activeProfessionId);
  const track = progression.professions.find((entry) => entry.professionId === canonical);
  if (!track) throw new Error(`Character has no ${canonical} profession track`);
  const definition = professionBranchChoices(canonical).find((entry) => entry.id === choiceId);
  const level = rankTotal(track.paths, PROFESSION_LEVEL_CAP);
  if (!definition || level < definition.threshold) throw new Error(`Branch choice ${choiceId} is not available`);
  if (definition.parentChoiceId && track.branchChoices[definition.parentChoiceId] !== definition.parentOptionId) throw new Error(`Branch choice ${choiceId} prerequisite is not met`);
  if (!definition.options.some((entry) => entry.id === optionId)) throw new Error(`Invalid option ${optionId} for ${choiceId}`);
  track.branchChoices[choiceId] = optionId;
  syncCompatibility(progression);
  if (character) character.progression = progression;
  return progression;
}

export function resolveRacialProgressionChoice(value, { choiceId, optionId }) {
  const character = value?.progression ? value : null;
  const progression = cloneProgression(character?.progression || value);
  progression.racial.branchChoices = { ...resolveRacialBranchChoice(
    progression.racial.raceId,
    racialProgressionLevel(progression),
    progression.racial.branchChoices,
    choiceId,
    optionId,
  ) };
  syncCompatibility(progression);
  if (character) character.progression = progression;
  return progression;
}

export function resolveProgressionGrantChoice(value, { professionId, grantId, optionId }) {
  const character = value?.progression ? value : null;
  const progression = cloneProgression(character?.progression || value);
  const canonical = canonicalProfessionId(professionId || progression.activeProfessionId);
  const track = progression.professions.find((entry) => entry.professionId === canonical);
  const pending = pendingProgressionChoices(progression).find((entry) => entry.kind === "grant" && entry.professionId === canonical && entry.id === grantId);
  if (!track || !pending || !pending.options.includes(optionId)) throw new Error(`Progression choice ${grantId} is not available`);
  if (pending.type === "metamagic-choice") {
    if (pending.profileId) {
      const profiles = { ...(track.choices.metamagicProfiles || {}) };
      const selected = [...(profiles[pending.profileId] || [])];
      selected[pending.slot] = optionId;
      profiles[pending.profileId] = selected;
      track.choices.metamagicProfiles = profiles;
    } else {
      const selected = [...(track.choices.metamagicIds || [])];
      selected[pending.slot] = optionId;
      track.choices.metamagicIds = selected;
    }
  } else if (pending.replace) {
    track.choices.signatureSpellId = optionId;
    track.choices.signatureExchanges = { ...(track.choices.signatureExchanges || {}), [String(pending.level)]: optionId };
  } else if (pending.selectionKey) {
    track.choices[pending.selectionKey] = pending.count > 1
      ? [...new Set([...selectedGrantOptions(track, pending, pending.level), optionId])]
      : optionId;
  } else {
    const selected = selectedGrantOptions(track, pending, pending.level);
    if (selected.includes(optionId)) throw new Error(`Progression choice ${grantId} already selected ${optionId}`);
    track.choices.grantSelections = { ...(track.choices.grantSelections || {}) };
    track.choices.grantSelections[grantId] = [...selected, optionId].slice(0, pending.count);
  }
  if (character) character.progression = progression;
  return progression;
}

export function advanceProgression(character, xpGain) {
  const beforeAllocated = allocatedProgressionLevel(character);
  const beforeEarnedLevel = earnedProgressionLevel(character);
  if (!character || !(Number(xpGain) > 0)) return {
    character, beforeLevel: beforeAllocated, afterLevel: beforeAllocated,
    beforeEarnedLevel, afterEarnedLevel: beforeEarnedLevel, earnedLevels: 0,
    unspentLevels: Math.max(0, beforeEarnedLevel - beforeAllocated), gained: [], pendingChoices: character ? pendingProgressionChoices(character) : [],
  };
  normalizeCharacterProgression(character);
  const progression = cloneProgression(character.progression);
  progression.xp = Math.min(progressionXpForLevel(CHARACTER_LEVEL_CAP), Math.max(progressionXpForLevel(beforeEarnedLevel), Number(progression.xp) || 0) + Math.floor(Number(xpGain) || 0));
  const afterEarnedLevel = earnedProgressionLevel(progression);
  progression.unspentLevels = Math.max(0, afterEarnedLevel - allocatedProgressionLevel(progression));
  character.progression = progression;
  return {
    character,
    beforeLevel: beforeAllocated,
    afterLevel: allocatedProgressionLevel(progression),
    beforeEarnedLevel,
    afterEarnedLevel,
    earnedLevels: Math.max(0, afterEarnedLevel - beforeEarnedLevel),
    unspentLevels: progression.unspentLevels,
    gained: [],
    pendingChoices: pendingProgressionChoices(progression),
  };
}

// Compatibility wrappers now earn unspent character levels only. The source of
// XP never chooses where a rank is invested.
export function advanceProfessionProgression(character, xpGain) {
  return advanceProgression(character, xpGain);
}

export function advanceRacialProgression(character, xpGain) {
  return advanceProgression(character, xpGain);
}

function allocateOneLevel(value, option, specializationId = null) {
  const character = value?.progression ? value : null;
  const progression = cloneProgression(character?.progression || value);
  const allocation = pendingLevelAllocations(progression);
  if (!allocation) throw new Error("No earned level is waiting for allocation");
  const unresolved = pendingProgressionChoices(progression).filter((choice) => choice.kind !== "level-allocation");
  if (unresolved.length) throw new Error(`Resolve ${unresolved[0].id} before allocating another level`);
  const allocatedBefore = allocatedProgressionLevel(progression);
  let row;
  if (option.track === "racial") {
    const level = racialProgressionLevel(progression);
    if (level >= RACIAL_LEVEL_CAP) throw new Error(`Racial progression is capped at ${RACIAL_LEVEL_CAP}`);
    const compiled = compileRacialTrack(progression.racial.raceId, { evolutionId: progression.racial.evolutionId, branchChoices: progression.racial.branchChoices });
    row = compiled.levels[level];
    progression.racial.paths[row.pathId] = row.rank;
  } else {
    if (professionProgressionLevel(progression) >= PROFESSION_LEVEL_CAP) throw new Error(`Profession progression is capped at ${PROFESSION_LEVEL_CAP}`);
    const professionId = canonicalProfessionId(option.professionId);
    let track = progression.professions.find((entry) => entry.professionId === professionId);
    if (!track) {
      track = { professionId, specializationId: specializationId ? slug(specializationId) : null, paths: {}, choices: {}, branchChoices: {} };
      progression.professions.push(track);
    }
    const trackChoices = pendingTrackChoices(track);
    if (trackChoices.length) throw new Error(`Resolve ${trackChoices[0].id} before advancing ${professionId}`);
    const level = rankTotal(track.paths, PROFESSION_LEVEL_CAP);
    const compiled = compileProfessionTrack(professionId, { specializationId: track.specializationId, choices: track.choices, branchChoices: track.branchChoices });
    row = compiled.levels[level];
    if (!row) throw new Error(`${professionId} cannot take another rank`);
    track.paths[row.pathId] = row.rank;
    progression.activeProfessionId = professionId;
  }
  syncCompatibility(progression);
  progression.unspentLevels = Math.max(0, earnedProgressionLevel(progression) - allocatedProgressionLevel(progression));
  if (character) {
    applyRowAttributes(character, row, allocatedBefore + 1);
    character.progression = progression;
    character.profession = progression.professionId;
    character.archetype = progression.archetypeId;
    recomputeVitalityMax(character); recomputeResolveMax(character); recomputeCarryCapacity(character);
  }
  return progression;
}

export function resolveLevelAllocationChoice(value, { choiceId, optionId, specializationId = null }) {
  const progression = value?.progression || value;
  const pending = pendingLevelAllocations(progression);
  if (!pending || pending.choiceId !== choiceId) throw new Error(`Level allocation ${choiceId} is not pending`);
  const option = pending.options.find((entry) => entry.optionId === optionId);
  if (!option) throw new Error(`Invalid level allocation option ${optionId}`);
  return allocateOneLevel(value, option, specializationId);
}

export function resolveLevelAllocation(value, selection) {
  const pending = pendingLevelAllocations(value);
  if (!pending) throw new Error("No earned level is waiting for allocation");
  const optionId = selection.optionId || (selection.track === "racial" ? "racial:evolution" : `profession:${canonicalProfessionId(selection.professionId)}`);
  return resolveLevelAllocationChoice(value, { choiceId: pending.choiceId, optionId, specializationId: selection.specializationId });
}

export function progressionGrants(value) {
  const progression = value?.progression || value;
  if (!isV2(progression)) return [];
  const grants = [];
  for (const track of progression.professions) {
    const compiled = compileProfessionTrack(track.professionId, { specializationId: track.specializationId, choices: track.choices, branchChoices: track.branchChoices });
    for (const row of compiled.levels.slice(0, rankTotal(track.paths, PROFESSION_LEVEL_CAP))) {
      for (const grant of row.grants) {
        grants.push({ ...grant, source: "profession", professionId: track.professionId, level: row.trackLevel, pathId: row.pathId });
        if (grant.type === "ability-choice") {
          for (const abilityId of selectedGrantOptions(track, grant, row.trackLevel)) grants.push({
            type: "ability", id: abilityId, source: "profession-choice", professionId: track.professionId,
            level: row.trackLevel, pathId: row.pathId, grantId: grant.id,
          });
        }
        if (grant.type === "metamagic-choice") {
          const metamagicId = selectedMetamagicOption(track, grant);
          if (metamagicId) grants.push({
            type: "metamagic", id: metamagicId, source: "profession-choice", professionId: track.professionId,
            level: row.trackLevel, pathId: row.pathId, grantId: grant.id,
            ...(grant.profileId ? { profileId: grant.profileId } : {}),
            ...(grant.spellGrantId ? { spellGrantId: grant.spellGrantId } : {}),
            appliesTo: grant.appliesTo,
          });
        }
      }
    }
  }
  const racialCompiled = compileRacialTrack(progression.racial.raceId, { evolutionId: progression.racial.evolutionId, branchChoices: progression.racial.branchChoices });
  for (const row of racialCompiled.levels.slice(0, racialProgressionLevel(progression))) {
    for (const grant of row.grants) grants.push({ ...grant, source: "racial", raceId: progression.racial.raceId, level: row.trackLevel, pathId: row.pathId });
  }
  return grants;
}

export function progressionEntitlements(value) {
  const grants = progressionGrants(value);
  const unique = (type) => [...new Set(grants.filter((grant) => grant.type === type).map((grant) => grant.id))];
  return Object.freeze({
    grants: Object.freeze(grants),
    abilities: Object.freeze(unique("ability")),
    metamagic: Object.freeze(unique("metamagic")),
    passives: Object.freeze(unique("passive")),
    proficiencies: Object.freeze(unique("proficiency")),
    recipes: Object.freeze(unique("recipe")),
    actions: Object.freeze(unique("action")),
    evolutions: Object.freeze(unique("evolution")),
    pendingChoices: Object.freeze(pendingProgressionChoices(value)),
  });
}

export function projectCharacterProgression(state) {
  const character = state?.character;
  const wanderer = state?.world?.codex?.characters?.wanderer;
  if (!character?.progression || !wanderer) return state;
  return {
    ...state,
    world: { ...state.world, codex: { ...state.world.codex, characters: {
      ...state.world.codex.characters,
      wanderer: { ...wanderer, profession: character.profession, archetype: character.archetype, attributes: { ...(character.attributes || {}) }, progression: cloneProgression(character.progression) },
    } } },
  };
}

export function progressionSummary(character) {
  if (!character) return null;
  normalizeCharacterProgression(character);
  const progression = character.progression;
  const professionLevel = professionProgressionLevel(progression);
  const racialLevel = racialProgressionLevel(progression);
  const allocatedLevel = professionLevel + racialLevel;
  const earnedLevel = earnedProgressionLevel(progression);
  const grants = progressionEntitlements(progression);
  return {
    level: earnedLevel,
    earnedLevel,
    allocatedLevel,
    unspentLevels: Math.max(0, earnedLevel - allocatedLevel),
    cap: CHARACTER_LEVEL_CAP,
    professionLevel,
    professionCap: PROFESSION_LEVEL_CAP,
    racialLevel,
    racialCap: RACIAL_LEVEL_CAP,
    professionId: progression.professionId,
    archetypeId: progression.archetypeId,
    activeProfessionId: progression.activeProfessionId,
    professions: progression.professions.map((track) => ({
      professionId: track.professionId, specializationId: track.specializationId,
      level: rankTotal(track.paths, PROFESSION_LEVEL_CAP), paths: { ...track.paths },
      choices: { ...track.choices }, branchChoices: { ...track.branchChoices },
      pendingChoices: pendingTrackChoices(track),
    })),
    racial: { ...progression.racial, level: racialLevel, paths: { ...progression.racial.paths }, branchChoices: { ...(progression.racial.branchChoices || {}) }, pendingChoices: pendingRacialBranchChoices(progression.racial.raceId, racialLevel, progression.racial.branchChoices) },
    paths: { ...progression.paths },
    grants,
    xp: progression.xp,
    nextLevelXp: earnedLevel < CHARACTER_LEVEL_CAP ? progressionXpForLevel(earnedLevel + 1) : null,
  };
}

// Compatibility export for older route-preview consumers.
export { progressionAtLevel };
