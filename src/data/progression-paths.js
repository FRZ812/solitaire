import { ATTRIBUTE_CAP, ATTR_KEYS, CHARACTER_LEVEL_CAP } from "../config.js";
import { getAbilityDef } from "./abilities.js";
import {
  PROFESSION_ALIASES,
  PROFESSION_PROFILES,
} from "./profession-progressions.js";
import {
  RACIAL_PROFILES,
  racialProfileFor,
  racialProgressionAtLevel,
} from "./racial-progressions.js";
import {
  PROFESSION_BRANCHES,
  branchGrantsAtLevel,
  normalizeBranchChoices,
  pendingBranchChoices,
  professionBranchChoices,
} from "./profession-branches.js";
import {
  METAMAGIC_FEATURES,
  PROGRESSION_FEATURES,
  progressionGrant,
  validateProgressionGrant,
} from "./progression-features.js";
import {
  PROFESSION_CONTENT_STATUS,
  PROFESSION_LEVEL_TABLES,
  professionContentStatus,
  professionLevelTable,
} from "./profession-level-tables.js";
import {
  RACIAL_BRANCHES,
  normalizeRacialBranchChoices,
  pendingRacialBranchChoices,
  racialBranchChoices,
  racialBranchGrantsAtLevel,
  resolveRacialBranchChoice,
} from "./racial-branches.js";

export const PROFESSION_LEVEL_CAP = 70;
export const RACIAL_LEVEL_CAP = 30;

export const PATH_GRADE_CAPS = Object.freeze({ standard: 15, advanced: 10, specialized: 5 });
export const PATH_KINDS = Object.freeze(["profession", "racial", "utility"]);

// Deprecated compatibility anchors. Character templates now own exact levels;
// these numeric bands remain useful for world-generation calibration only.
export const STARTING_LEVEL_BY_POWER_TIER = Object.freeze({ standard: 10, mid: 25, epic: 45, legendary: 65, mythical: 85, divine: 100 });
export const LEVEL_TIER_BANDS = Object.freeze([
  Object.freeze({ id: "standard", label: "Standard", min: 1, max: 20 }),
  Object.freeze({ id: "mid", label: "Veteran", min: 21, max: 40 }),
  Object.freeze({ id: "epic", label: "Epic", min: 41, max: 60 }),
  Object.freeze({ id: "legendary", label: "Legendary", min: 61, max: 70 }),
  Object.freeze({ id: "mythical", label: "Mythical", min: 71, max: 85 }),
  Object.freeze({ id: "divine", label: "Divine", min: 86, max: 100 }),
]);

export function levelTier(level) {
  const value = Math.max(1, Math.min(CHARACTER_LEVEL_CAP, Math.floor(Number(level) || 1)));
  return LEVEL_TIER_BANDS.find((band) => value >= band.min && value <= band.max) || LEVEL_TIER_BANDS[0];
}

export function progressionXpForLevel(level) {
  const bounded = Math.max(0, Math.min(CHARACTER_LEVEL_CAP, Math.floor(Number(level) || 0)));
  return bounded * bounded * 20;
}

export function attributeCeilingForLevel(level) {
  const bounded = Math.max(1, Math.min(CHARACTER_LEVEL_CAP, Math.floor(Number(level) || 1)));
  const mortalCurve = 10 + Math.floor(bounded * 0.8);
  const divineCurve = bounded >= 85 ? 79 + Math.ceil(((bounded - 85) * 11) / 9) : 0;
  return Math.min(ATTRIBUTE_CAP, Math.max(mortalCurve, divineCurve));
}

export function expandLegacyAttribute(value) {
  const old = Math.max(0, Math.min(30, Number(value) || 0));
  if (old === 0) return 0;
  return Math.min(ATTRIBUTE_CAP, Math.round(old * (1 + 2 * Math.pow(old / 30, 1.5))));
}

export function expandLegacyAttributes(attributes = {}) {
  return Object.fromEntries(ATTR_KEYS.map((key) => [key, expandLegacyAttribute(attributes[key])]));
}

export { METAMAGIC_FEATURES, PROFESSION_ALIASES, PROFESSION_BRANCHES, PROFESSION_CONTENT_STATUS, PROFESSION_LEVEL_TABLES, PROFESSION_PROFILES, PROGRESSION_FEATURES, RACIAL_BRANCHES, RACIAL_PROFILES, normalizeRacialBranchChoices, pendingRacialBranchChoices, professionBranchChoices, professionContentStatus, professionLevelTable, racialBranchChoices, racialProgressionAtLevel, resolveRacialBranchChoice };

export function slug(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function labelize(value) {
  return String(value || "").replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function canonicalProfessionId(value) {
  const id = slug(value);
  if (!id) return null;
  if (PROFESSION_PROFILES[id]) return id;
  return PROFESSION_ALIASES[id] || null;
}

// Broad public names are allowed to differ from their durable save ids. This
// matters for renamed professions such as Warrior, whose persisted id remains
// `fighter`: entering the public name must not accidentally create a
// specialization called "warrior". Exact vocation aliases such as Sellsword
// still become specializations through canonicalProfessionIdentity below.
export function isBroadProfessionName(value, professionId = null) {
  const requestedId = slug(value);
  const canonicalId = canonicalProfessionId(professionId || requestedId);
  if (!requestedId || !canonicalId) return false;
  return requestedId === canonicalId || requestedId === slug(PROFESSION_PROFILES[canonicalId]?.name);
}

export function canonicalProfessionIdentity(value, specializationId = null) {
  const requestedId = slug(value);
  const professionId = canonicalProfessionId(requestedId);
  if (!professionId) return null;
  return Object.freeze({
    professionId,
    specializationId: slug(specializationId) || (isBroadProfessionName(requestedId, professionId) ? null : requestedId),
  });
}

function weightsFor(attributes, offset = 0) {
  const weights = Object.fromEntries(ATTR_KEYS.map((key) => [key, 1]));
  [7, 5, 3, 2].forEach((weight, index) => {
    if (attributes[index]) weights[attributes[index]] = weight;
  });
  const emphasis = attributes[offset % Math.max(1, attributes.length)];
  if (emphasis && offset) weights[emphasis] += 3;
  return weights;
}

function pathRecord({ id, name, kind, grade, description, weights, prerequisites = {}, role }) {
  return Object.freeze({
    id,
    name,
    kind,
    grade,
    role,
    maxRank: PATH_GRADE_CAPS[grade],
    description,
    weights: Object.freeze({ ...weights }),
    prerequisites: Object.freeze({ ...prerequisites }),
  });
}

const PROFESSION_SEGMENTS = Object.freeze([
  Object.freeze({ role: "foundation", grade: "standard", ranks: 15 }),
  Object.freeze({ role: "practice", grade: "standard", ranks: 15 }),
  Object.freeze({ role: "specialization", grade: "advanced", ranks: 10 }),
  Object.freeze({ role: "mastery", grade: "advanced", ranks: 10 }),
  Object.freeze({ role: "synthesis", grade: "advanced", ranks: 10 }),
  Object.freeze({ role: "exemplar", grade: "specialized", ranks: 5 }),
  Object.freeze({ role: "apogee", grade: "specialized", ranks: 5 }),
]);

const RACIAL_SEGMENTS = Object.freeze([
  Object.freeze({ role: "lineage", grade: "standard", ranks: 15 }),
  Object.freeze({ role: "evolution", grade: "advanced", ranks: 10 }),
  Object.freeze({ role: "apotheosis", grade: "specialized", ranks: 5 }),
]);

function professionPathName(profile, role) {
  if (role === "foundation") return `${profile.name} Foundation`;
  if (role === "practice") return `${labelize(profile.domain)} Practice`;
  if (role === "specialization") return `${profile.name} Specialization`;
  if (role === "mastery") return `${profile.name} Mastery`;
  if (role === "synthesis") return `${profile.name} Synthesis`;
  if (role === "exemplar") return `${profile.name} Exemplar`;
  return `${profile.name} Apogee`;
}

function buildProfessionCatalog() {
  const paths = {};
  const builds = {};
  for (const [professionId, profile] of Object.entries(PROFESSION_PROFILES)) {
    const allocations = [];
    let previousPathId = null;
    let total = 0;
    for (const [index, segment] of PROFESSION_SEGMENTS.entries()) {
      const pathId = `${professionId}-${segment.role}`;
      const name = professionPathName(profile, segment.role);
      paths[pathId] = pathRecord({
        id: pathId,
        name,
        kind: "profession",
        grade: segment.grade,
        role: segment.role,
        description: `${name} continues the general ${profile.name} progression${segment.role === "specialization" ? " while a chosen branch overlays it" : ""}.`,
        weights: weightsFor(profile.attributes, index),
        prerequisites: previousPathId ? { pathId: previousPathId, rank: PROFESSION_SEGMENTS[index - 1].ranks, trackLevel: total } : {},
      });
      allocations.push(Object.freeze({ role: segment.role, pathId, ranks: segment.ranks }));
      previousPathId = pathId;
      total += segment.ranks;
    }
    builds[professionId] = Object.freeze({
      id: professionId,
      professionId,
      archetype: profile.specialization,
      archetypePathId: `${professionId}-${slug(profile.specialization)}`,
      description: profile.description,
      allocations: Object.freeze(allocations),
      totalLevels: PROFESSION_LEVEL_CAP,
      contentStatus: professionContentStatus(professionId),
      branches: professionBranchChoices(professionId),
    });
  }
  return { paths: Object.freeze(paths), builds: Object.freeze(builds) };
}

function buildRacialCatalog() {
  const paths = {};
  const builds = {};
  for (const [raceId, profile] of Object.entries(RACIAL_PROFILES)) {
    const allocations = [];
    let previousPathId = null;
    let total = 0;
    for (const [index, segment] of RACIAL_SEGMENTS.entries()) {
      const pathId = `${raceId}-racial-${segment.role}`;
      const stageName = profile.stages[index];
      paths[pathId] = pathRecord({
        id: pathId,
        name: stageName,
        kind: "racial",
        grade: segment.grade,
        role: segment.role,
        description: `${profile.name} racial ${segment.role}: ${stageName}.`,
        weights: weightsFor(profile.attributes, index),
        prerequisites: previousPathId ? { pathId: previousPathId, rank: RACIAL_SEGMENTS[index - 1].ranks, trackLevel: total } : {},
      });
      allocations.push(Object.freeze({ role: segment.role, pathId, ranks: segment.ranks, stageName }));
      previousPathId = pathId;
      total += segment.ranks;
    }
    builds[raceId] = Object.freeze({ id: raceId, raceId, evolutionId: slug(profile.evolution), allocations: Object.freeze(allocations), totalLevels: RACIAL_LEVEL_CAP });
  }
  return { paths: Object.freeze(paths), builds: Object.freeze(builds) };
}

const professionCatalog = buildProfessionCatalog();
const racialCatalog = buildRacialCatalog();
export const PROFESSION_BUILDS = professionCatalog.builds;
export const RACIAL_BUILDS = racialCatalog.builds;
export const PROGRESSION_PATHS = Object.freeze({ ...professionCatalog.paths, ...racialCatalog.paths });

export function professionProfile(professionId) {
  return PROFESSION_PROFILES[canonicalProfessionId(professionId)] || null;
}

export function professionBuild(professionId) {
  return PROFESSION_BUILDS[canonicalProfessionId(professionId)] || null;
}

export function progressionPath(pathId) {
  return PROGRESSION_PATHS[pathId] || null;
}

function hash(value) {
  let result = 2166136261;
  for (const char of String(value)) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
}

function attributeGains(path, rank) {
  const points = path.grade === "standard" ? 3 : path.grade === "advanced" ? 4 : 5;
  const tickets = [];
  for (const key of ATTR_KEYS) for (let index = 0; index < Math.max(1, path.weights[key] || 1); index++) tickets.push(key);
  const gains = Object.fromEntries(ATTR_KEYS.map((key) => [key, 0]));
  const start = (hash(path.id) + rank * 7) % tickets.length;
  for (let point = 0; point < points; point++) gains[tickets[(start + point * 5) % tickets.length]] += 1;
  return Object.fromEntries(Object.entries(gains).filter(([, value]) => value > 0));
}

function scheduledIndex(level, count, maxLevel) {
  if (count === 0) return -1;
  if (count <= 1) return level === 1 ? 0 : -1;
  for (let index = 0; index < count; index++) {
    if (Math.round(1 + index * ((maxLevel - 1) / (count - 1))) === level) return index;
  }
  return -1;
}

function generalProfessionGrants(profile, professionId, level, choices = {}) {
  const grants = [];
  if (level === 1) grants.push(progressionGrant("proficiency", profile.domain));
  if (professionId === "sorcerer") {
    const signature = choices.signatureSpellId || choices.signature_spell || null;
    if (level === 1) {
      grants.push(signature && profile.abilities.includes(signature)
        ? progressionGrant("ability", signature, { source: "signature-spell", signature: true })
        : progressionGrant("ability-choice", "sorcerer-signature-spell", { options: profile.abilities, count: 1, selectionKey: "signatureSpellId", signature: true }));
    }
    const metamagicIds = Object.keys(METAMAGIC_FEATURES);
    const metaIndex = [10, 20, 30, 40, 50, 60].indexOf(level);
    if (metaIndex >= 0) {
      const selected = Array.isArray(choices.metamagicIds) ? choices.metamagicIds[metaIndex] : null;
      grants.push(selected && METAMAGIC_FEATURES[selected]
        ? progressionGrant("metamagic", selected, { appliesTo: "signature-spell", slot: metaIndex })
        : progressionGrant("metamagic-choice", `sorcerer-metamagic-${metaIndex + 1}`, {
          options: metamagicIds, count: 1, selectionKey: "metamagicIds", slot: metaIndex, appliesTo: "signature-spell",
        }));
    }
    if ([25, 45, 65].includes(level)) grants.push(progressionGrant("ability-choice", `sorcerer-signature-exchange-${level}`, {
      options: profile.abilities, count: 1, selectionKey: "signatureSpellId", replace: true, signature: true,
    }));
  } else {
    const abilityIndex = scheduledIndex(level, profile.abilities.length, PROFESSION_LEVEL_CAP);
    if (abilityIndex >= 0) grants.push(progressionGrant("ability", profile.abilities[abilityIndex]));
  }
  const actionIndex = scheduledIndex(level, profile.actions.length, 55);
  if (actionIndex >= 0) grants.push(progressionGrant("action", profile.actions[actionIndex]));
  return grants;
}

function resolveAuthoredGrant(grant, choices = {}, level) {
  if (grant.type === "metamagic-choice") {
    const selected = Array.isArray(choices.metamagicIds) ? choices.metamagicIds[grant.slot] : null;
    return selected && grant.options.includes(selected)
      ? progressionGrant("metamagic", selected, { appliesTo: grant.appliesTo, slot: grant.slot })
      : grant;
  }
  if (grant.type !== "ability-choice" || !grant.selectionKey) return grant;
  const selected = grant.replace
    ? choices.signatureExchanges?.[String(level)]
    : choices[grant.selectionKey];
  if (grant.replace && selected && selected !== choices.signatureSpellId) return progressionGrant("proficiency", `sorcerer:signature-focus-history-${level}`, {
    name: `Former Signature Focus: ${labelize(selected)}`,
    description: "Records a replaced primary focus; the former spell is not retained unless it was independently chosen for the personal repertoire.",
    formerSignatureSpellId: selected,
  });
  return selected && grant.options.includes(selected)
    ? progressionGrant("ability", selected, {
      source: grant.replace ? "signature-exchange" : "signature-spell",
      signature: Boolean(grant.signature),
      ...(grant.replace ? { replacesSignatureAt: level } : {}),
    })
    : grant;
}

function pathVariant(path, specializationId, professionId) {
  const defaultId = slug(PROFESSION_PROFILES[professionId].specialization);
  if (!specializationId || specializationId === defaultId || !["specialization", "synthesis", "exemplar", "apogee"].includes(path.role)) return path;
  const label = labelize(specializationId);
  const names = {
    specialization: label,
    synthesis: `${label} Synthesis`,
    exemplar: `${label} Exemplar`,
    apogee: `${label} Apogee`,
  };
  const weights = { ...path.weights };
  const seed = hash(`${professionId}:${specializationId}:${path.role}`);
  weights[ATTR_KEYS[seed % ATTR_KEYS.length]] += 4;
  return { ...path, id: `${path.id}--${specializationId}`, name: names[path.role], weights };
}

export function compileProfessionTrack(professionValue, {
  specializationId = null,
  archetypeId = null,
  choices = {},
  branchChoices = {},
  specializationPath = [],
} = {}) {
  const identity = canonicalProfessionIdentity(professionValue, specializationId || archetypeId);
  if (!identity) return null;
  const { professionId } = identity;
  const resolvedSpecialization = identity.specializationId;
  const profile = PROFESSION_PROFILES[professionId];
  const build = PROFESSION_BUILDS[professionId];
  const selections = normalizeBranchChoices(professionId, branchChoices, specializationPath);
  const attributes = Object.fromEntries(ATTR_KEYS.map((key) => [key, 1]));
  const ranks = {};
  const levels = [];
  const segments = [];
  for (const allocation of build.allocations) {
    const basePath = PROGRESSION_PATHS[allocation.pathId];
    const path = pathVariant(basePath, resolvedSpecialization, professionId);
    const start = levels.length + 1;
    for (let rank = 1; rank <= allocation.ranks; rank++) {
      const trackLevel = levels.length + 1;
      const proposedGains = attributeGains(path, rank);
      const gains = {};
      for (const [key, amount] of Object.entries(proposedGains)) {
        const before = attributes[key];
        attributes[key] = Math.min(ATTRIBUTE_CAP, attributeCeilingForLevel(trackLevel), before + amount);
        if (attributes[key] > before) gains[key] = attributes[key] - before;
      }
      const authoredLevel = professionLevelTable(professionId)?.[trackLevel - 1] || null;
      const generalGrants = authoredLevel
        ? authoredLevel.grants.map((grant) => resolveAuthoredGrant(grant, choices, trackLevel))
        : generalProfessionGrants(profile, professionId, trackLevel, choices);
      const branchGrants = branchGrantsAtLevel(professionId, trackLevel, selections);
      ranks[path.id] = rank;
      levels.push(Object.freeze({
        level: trackLevel,
        trackLevel,
        professionId,
        specializationId: resolvedSpecialization,
        archetypeId: resolvedSpecialization,
        pathId: path.id,
        pathName: path.name,
        kind: "profession",
        grade: path.grade,
        rank,
        maxRank: path.maxRank,
        attributeGains: Object.freeze({ ...proposedGains }),
        cumulativeAttributes: Object.freeze({ ...attributes }),
        feature: authoredLevel?.name || generalGrants[0]?.id || `Deepens ${path.name}`,
        featureDescription: authoredLevel?.description || null,
        authoredContent: !!authoredLevel,
        generalGrants: Object.freeze(generalGrants),
        branchGrants: Object.freeze(branchGrants),
        grants: Object.freeze([...generalGrants, ...branchGrants]),
      }));
    }
    segments.push(Object.freeze({
      pathId: path.id, pathName: path.name, kind: "profession", grade: path.grade, role: allocation.role,
      maxRank: path.maxRank, description: path.description, prerequisites: path.prerequisites,
      ranks: allocation.ranks, start, end: levels.length,
    }));
  }
  return Object.freeze({
    ...build,
    professionId,
    specializationId: resolvedSpecialization,
    archetypeId: resolvedSpecialization,
    archetype: resolvedSpecialization ? labelize(resolvedSpecialization) : null,
    branchChoices: Object.freeze({ ...selections }),
    pendingChoices: Object.freeze(pendingBranchChoices(professionId, PROFESSION_LEVEL_CAP, selections)),
    totalLevels: levels.length,
    levels: Object.freeze(levels),
    segments: Object.freeze(segments),
    ranks: Object.freeze(ranks),
    finalAttributes: Object.freeze({ ...attributes }),
  });
}

// Compatibility name: a profession build is now a 70-rank profession track,
// never a complete 100-level character route.
export function compileProfessionBuild(professionId, options = {}) {
  return compileProfessionTrack(professionId, options);
}

export function compileRacialTrack(raceId = "human", { evolutionId = null, branchChoices = {}, evolutionPath = [] } = {}) {
  const id = slug(raceId) || "human";
  // Narrated creatures can carry an uncatalogued race id. Keep those saves
  // loadable with a deliberately generic ladder; every catalogued playable
  // race uses its fully authored thirty-row progression below.
  const profile = racialProfileFor(id) || Object.freeze({
    name: labelize(id),
    stages: Object.freeze([labelize(id), `Greater ${labelize(id)}`, `${labelize(id)} Exemplar`]),
    evolution: `${labelize(id)} Exemplar`,
    attributes: Object.freeze(["vigor", "body", "wit", "presence"]),
  });
  const build = RACIAL_BUILDS[id] || (() => {
    const allocations = RACIAL_SEGMENTS.map((segment, index) => ({ role: segment.role, pathId: `${id}-racial-${segment.role}`, ranks: segment.ranks, stageName: profile.stages[index] }));
    return { id, raceId: id, evolutionId: slug(profile.evolution), allocations, totalLevels: RACIAL_LEVEL_CAP };
  })();
  const attributes = Object.fromEntries(ATTR_KEYS.map((key) => [key, 1]));
  const selections = normalizeRacialBranchChoices(id, branchChoices, evolutionPath);
  const ranks = {};
  const levels = [];
  const segments = [];
  for (const [index, allocation] of build.allocations.entries()) {
    const basePath = PROGRESSION_PATHS[allocation.pathId] || pathRecord({
      id: allocation.pathId, name: allocation.stageName, kind: "racial", grade: RACIAL_SEGMENTS[index].grade,
      role: allocation.role, description: `${profile.name} racial ${allocation.role}.`, weights: weightsFor(profile.attributes, index),
    });
    const start = levels.length + 1;
    for (let rank = 1; rank <= allocation.ranks; rank++) {
      const trackLevel = levels.length + 1;
      const gains = attributeGains(basePath, rank);
      for (const [key, amount] of Object.entries(gains)) attributes[key] = Math.min(ATTRIBUTE_CAP, attributeCeilingForLevel(trackLevel), attributes[key] + amount);
      const authored = racialProgressionAtLevel(id, trackLevel);
      const generalGrants = authored
        ? [...authored.grants]
        : [progressionGrant("proficiency", `${id}:racial-level-${trackLevel}`, {
          name: `${profile.name} ${trackLevel}`,
          description: `Deepens the uncatalogued ${profile.name} racial progression.`,
          source: "racial-progression-fallback",
        })];
      if (!authored && [1, 16, 26].includes(trackLevel)) {
        const stage = [1, 16, 26].indexOf(trackLevel);
        generalGrants.push(progressionGrant("evolution", slug(profile.stages[stage]), { name: profile.stages[stage], stage: stage + 1 }));
      }
      const branchGrants = racialBranchGrantsAtLevel(id, trackLevel, selections);
      const grants = [...generalGrants, ...branchGrants];
      ranks[basePath.id] = rank;
      levels.push(Object.freeze({
        level: trackLevel, trackLevel, raceId: id, evolutionId: evolutionId || build.evolutionId,
        pathId: basePath.id, pathName: basePath.name, kind: "racial", grade: basePath.grade,
        rank, maxRank: basePath.maxRank, attributeGains: Object.freeze(gains), cumulativeAttributes: Object.freeze({ ...attributes }),
        feature: authored?.name || grants[0]?.id || `Deepens ${basePath.name}`,
        featureDescription: authored?.description || `Deepens the ${basePath.name} racial progression.`,
        authoredContent: Boolean(authored),
        generalGrants: Object.freeze(generalGrants), branchGrants: Object.freeze(branchGrants), grants: Object.freeze(grants),
      }));
    }
    segments.push(Object.freeze({ pathId: basePath.id, pathName: basePath.name, kind: "racial", grade: basePath.grade, role: allocation.role, maxRank: basePath.maxRank, description: basePath.description, prerequisites: basePath.prerequisites, ranks: allocation.ranks, start, end: levels.length }));
  }
  return Object.freeze({
    ...build, raceId: id, evolutionId: evolutionId || build.evolutionId, stages: profile.stages,
    branches: racialBranchChoices(id), branchChoices: selections,
    pendingChoices: pendingRacialBranchChoices(id, RACIAL_LEVEL_CAP, selections),
    totalLevels: levels.length, levels: Object.freeze(levels), segments: Object.freeze(segments),
    ranks: Object.freeze(ranks), finalAttributes: Object.freeze({ ...attributes }),
  });
}

export function compileCharacterProgression({ professions = [], racial = null } = {}) {
  const professionTotal = professions.reduce((sum, track) => sum + Math.max(0, Math.floor(Number(track.levels) || 0)), 0);
  const racialLevels = Math.max(0, Math.floor(Number(racial?.levels) || 0));
  if (professionTotal > PROFESSION_LEVEL_CAP) throw new Error(`Profession levels ${professionTotal} exceed ${PROFESSION_LEVEL_CAP}`);
  if (racialLevels > RACIAL_LEVEL_CAP) throw new Error(`Racial levels ${racialLevels} exceed ${RACIAL_LEVEL_CAP}`);
  if (professionTotal + racialLevels > CHARACTER_LEVEL_CAP) throw new Error(`Character levels exceed ${CHARACTER_LEVEL_CAP}`);
  const trackResults = professions.map((track) => ({
    requested: track,
    compiled: compileProfessionTrack(track.professionId || track.profession, {
      specializationId: track.specializationId || track.specialization || track.archetypeId,
      choices: track.choices,
      branchChoices: track.branchChoices,
      specializationPath: track.specializationPath,
    }),
  }));
  if (trackResults.some(({ compiled }) => !compiled)) throw new Error("Unknown profession allocation");
  const racialCompiled = racialLevels > 0 ? compileRacialTrack(racial?.raceId || "human", { evolutionId: racial?.evolutionId, branchChoices: racial?.branchChoices, evolutionPath: racial?.evolutionPath }) : null;
  const sourceRows = [
    ...(racialCompiled ? racialCompiled.levels.slice(0, racialLevels) : []),
    ...trackResults.flatMap(({ requested, compiled }) => compiled.levels.slice(0, requested.levels)),
  ];
  const attributes = Object.fromEntries(ATTR_KEYS.map((key) => [key, 1]));
  const levels = sourceRows.map((row, index) => {
    const level = index + 1;
    const gains = {};
    for (const [key, amount] of Object.entries(row.attributeGains || {})) {
      const before = attributes[key];
      attributes[key] = Math.min(ATTRIBUTE_CAP, attributeCeilingForLevel(level), before + amount);
      if (attributes[key] > before) gains[key] = attributes[key] - before;
    }
    return Object.freeze({ ...row, level, attributeGains: Object.freeze(gains), cumulativeAttributes: Object.freeze({ ...attributes }) });
  });
  const ranks = {};
  for (const row of levels) ranks[row.pathId] = row.rank;
  return Object.freeze({
    totalLevels: levels.length,
    professionLevels: professionTotal,
    racialLevels,
    professions: Object.freeze(trackResults.map(({ requested, compiled }) => Object.freeze({ ...compiled, investedLevels: requested.levels }))),
    racial: racialCompiled ? Object.freeze({ ...racialCompiled, investedLevels: racialLevels }) : null,
    levels: Object.freeze(levels), ranks: Object.freeze(ranks), finalAttributes: Object.freeze({ ...attributes }),
  });
}

export function progressionAtLevel(professionId, level, options = {}) {
  const target = Math.max(0, Math.min(CHARACTER_LEVEL_CAP, Math.floor(Number(level) || 0)));
  const racialLevels = Math.max(0, Math.min(RACIAL_LEVEL_CAP, options.racialLevels ?? Math.max(0, target - PROFESSION_LEVEL_CAP)));
  const professionLevels = Math.min(PROFESSION_LEVEL_CAP, target - racialLevels);
  const compiled = compileCharacterProgression({
    professions: [{
      professionId,
      specializationId: options.specializationId || options.archetypeId,
      levels: professionLevels,
      choices: options.choices,
      branchChoices: options.branchChoices,
      specializationPath: options.specializationPath,
    }],
    racial: racialLevels > 0 ? { raceId: options.raceId || "human", evolutionId: options.evolutionId, levels: racialLevels, branchChoices: options.racialBranchChoices, evolutionPath: options.evolutionPath } : null,
  });
  return Object.freeze({
    professionId: canonicalProfessionId(professionId), level: target,
    professionLevel: professionLevels, racialLevel: racialLevels, ranks: compiled.ranks,
    latest: compiled.levels.at(-1) || null, attributes: compiled.finalAttributes, levels: compiled.levels,
  });
}

export function pendingProfessionChoices(track) {
  const professionId = canonicalProfessionId(track?.professionId || track?.profession);
  if (!professionId) return [];
  const levels = track?.levels ?? Object.values(track?.paths || {}).reduce((sum, rank) => sum + Math.max(0, Number(rank) || 0), 0);
  return pendingBranchChoices(professionId, levels, normalizeBranchChoices(professionId, track?.branchChoices, track?.specializationPath));
}

export function validateProgressionCatalog() {
  const errors = [];
  for (const [id, path] of Object.entries(PROGRESSION_PATHS)) {
    if (!PATH_KINDS.includes(path.kind)) errors.push(`${id}: invalid kind ${path.kind}`);
    if (path.maxRank !== PATH_GRADE_CAPS[path.grade]) errors.push(`${id}: invalid ${path.grade} cap`);
  }
  const validateGrant = (grant, owner) => {
    const error = validateProgressionGrant(grant, { abilityExists: (id) => !!getAbilityDef(id) });
    if (error) errors.push(`${owner}: ${error}`);
  };
  for (const professionId of Object.keys(PROFESSION_PROFILES)) {
    try {
      const compiled = compileProfessionTrack(professionId);
      if (compiled.totalLevels !== PROFESSION_LEVEL_CAP) errors.push(`${professionId}: not ${PROFESSION_LEVEL_CAP} levels`);
      for (const row of compiled.levels) for (const grant of row.grants) validateGrant(grant, `${professionId}/L${row.level}`);
      for (const branchChoice of professionBranchChoices(professionId)) {
        for (const branchOption of branchChoice.options) for (const grant of branchOption.grants) validateGrant(grant, `${professionId}/${branchOption.id}`);
      }
    } catch (error) { errors.push(`${professionId}: ${error.message}`); }
  }
  for (const raceId of Object.keys(RACIAL_PROFILES)) {
    try {
      const compiled = compileRacialTrack(raceId);
      if (compiled.totalLevels !== RACIAL_LEVEL_CAP) errors.push(`${raceId}: not ${RACIAL_LEVEL_CAP} racial levels`);
      for (const row of compiled.levels) for (const grant of row.grants) validateGrant(grant, `${raceId}/L${row.level}`);
      for (const branchChoice of racialBranchChoices(raceId)) {
        for (const branchOption of branchChoice.options) for (const grant of branchOption.grants) validateGrant(grant, `${raceId}/${branchOption.id}`);
      }
    } catch (error) { errors.push(`${raceId}: ${error.message}`); }
  }
  return errors;
}
