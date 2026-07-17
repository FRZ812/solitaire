import { ATTRIBUTE_CAP, ATTR_KEYS, CHARACTER_LEVEL_CAP } from "../config.js";
import { CHARACTER_TEMPLATES } from "../data/templates.js";
import {
  PROFESSION_BUILDS,
  STARTING_LEVEL_BY_POWER_TIER,
  attributeCeilingForLevel,
  canonicalProfessionId,
  compileProfessionBuild,
  expandLegacyAttributes,
  levelTier,
  professionBuild,
  progressionAtLevel,
  progressionXpForLevel,
} from "../data/progression-paths.js";
import { recomputeCarryCapacity, recomputeResolveMax, recomputeVitalityMax } from "./attributes.js";

export const PROGRESSION_VERSION = 1;
export const LIVING_WORLD_LEVEL_CAP = 60;

// Fixed Codex figures receive deliberate levels from their authored history,
// not an accidental conversion of the retired six-stat scale. Most established
// leaders remain below Epic, true masters sit around 50, living legends stop at
// 60, and only the three end-game exceptions cross that boundary.
export const AUTHORED_WORLD_LEVELS = Object.freeze({
  "demon-king": 100,
  "vale-king-asar": 48,
  "goblin-king": 52,
  "selenyan-speaker": 58,
  "glass-spire-master": 60,
  "great-wyrm": 100,
  "hawthorn-lord": 60,
  "witch-queen": 78,
  "crowsmoor-baron": 34,
  "whitemarch-treasurer": 48,
  "cinder-chapter-master": 50,
  "stonebrook-hold-father": 44,
  "halfborn-matriarch": 46,
  "heron-master": 48,
  "the-hag": 55,
  "king-of-three": 28,
  "vale-king-asar-vi": 38,
  "halfborn-matriarch-elect-brann": 40,
  "stonebrook-hold-father-korro": 38,
  "whitemarch-treasurer-halen": 35,
  "cinder-chapter-master-tovar": 43,
  "crowsmoor-baron-heir": 28,
  "heron-master-apprentice": 24,
});

// Engine-authored mount ids use the same rank system. Mundane beasts occupy
// ordinary bands; quest-scale flying beasts can cross 60 because they are
// explicitly authored high-tier party characters, never random inhabitants.
export const AUTHORED_MOUNT_LEVELS = Object.freeze({
  pony: 10,
  horse: 10,
  mule: 10,
  camel: 15,
  warhorse: 25,
  nag: 10,
  "marsh-pony": 10,
  "ridge-pony": 10,
  courser: 25,
  "war-stag": 15,
  "fen-strider": 15,
  "mountain-ram": 25,
  "axe-beak": 25,
  "dire-boar": 25,
  "giant-lizard": 45,
  "dire-wolf": 25,
  "ground-drake": 45,
  griffon: 45,
  wyvern: 65,
  drake: 85,
  dragon: 100,
});

// Crossing level 60 is a setting event, never a side effect of the narrator
// producing generous attributes. Authored playable templates already carry an
// explicit progression stack; this table is for fixed end-game figures that
// exist independently in the Codex.
export const AUTHORED_APEX_LEVELS = Object.freeze({
  "demon-king": 100,
  "great-wyrm": 100,
  "witch-queen": 78,
});

export { attributeCeilingForLevel };

const TEMPLATE_BY_ID = new Map(CHARACTER_TEMPLATES.map((template) => [template.id, template]));

function boundedLevel(level) {
  return Math.max(1, Math.min(CHARACTER_LEVEL_CAP, Math.floor(Number(level) || 1)));
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

export function progressionLevel(value) {
  const progression = value?.progression || value;
  const paths = progression?.paths || {};
  return Math.max(0, Math.min(CHARACTER_LEVEL_CAP, Object.values(paths)
    .reduce((total, rank) => total + Math.max(0, Math.floor(Number(rank) || 0)), 0)));
}

export function progressionLevelFromXp(xp) {
  return boundedLevel(Math.floor(Math.sqrt(Math.max(0, Number(xp) || 0) / 20)) + 1);
}

function defaultProfession(character) {
  if (character?.id === "great-wyrm") return "dragon-ascendant";
  return canonicalProfessionId(character?.profession) || "wanderer";
}

function defaultArchetype(character, professionId) {
  const legacyKey = "sub" + "class";
  const template = TEMPLATE_BY_ID.get(character?.templateId);
  return character?.archetype
    || character?.[legacyKey]
    || template?.setup?.archetype
    || professionBuild(professionId)?.archetypePathId
    || null;
}

function sidePathFor(character) {
  return character?.race === "human" || !character?.race ? "utility" : "racial";
}

export function createProgression({ professionId = "wanderer", archetypeId = null, level = 1, sidePath = "racial", xp } = {}) {
  const canonicalProfession = canonicalProfessionId(professionId) || "wanderer";
  const originalProfessionKey = String(professionId || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  const target = boundedLevel(level);
  const resolvedArchetype = archetypeId
    || (originalProfessionKey && originalProfessionKey !== canonicalProfession ? professionId : null)
    || professionBuild(canonicalProfession)?.archetypePathId
    || null;
  const snapshot = progressionAtLevel(canonicalProfession, target, { sidePath, archetypeId: resolvedArchetype });
  return {
    version: PROGRESSION_VERSION,
    professionId: canonicalProfession,
    archetypeId: resolvedArchetype,
    sidePath,
    xp: Math.max(progressionXpForLevel(target), Math.floor(Number(xp) || 0)),
    paths: { ...(snapshot?.ranks || {}) },
  };
}

// Used only while a character without progression is being migrated or first
// authored. The thresholds mirror the world's intended social power bands.
export function inferProgressionLevel(character, { legacyScale = false } = {}) {
  if (AUTHORED_WORLD_LEVELS[character?.id]) return AUTHORED_WORLD_LEVELS[character.id];
  if (character?.kind === "mount" && AUTHORED_MOUNT_LEVELS[character?.id]) return AUTHORED_MOUNT_LEVELS[character.id];
  const template = TEMPLATE_BY_ID.get(character?.templateId);
  const tier = character?.powerTier || template?.tier;
  if (tier && STARTING_LEVEL_BY_POWER_TIER[tier]) {
    return worldBoundedLevel(character, STARTING_LEVEL_BY_POWER_TIER[tier]);
  }
  if (Number.isFinite(Number(character?.level))) {
    return worldBoundedLevel(character, Number(character.level));
  }
  const values = ATTR_KEYS.map((key) => Number(character?.attributes?.[key]) || 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  const peak = Math.max(0, ...values);
  if (legacyScale) {
    // Preserve the intentionally unformed player-save baseline, but place
    // authored inhabitants by vocation and demonstrated skill as well as an
    // old six-stat total. A skilled hunter or cooper should not become level 3
    // merely because the retired scale used compact numbers.
    if (character?.id === "wanderer" || character?.kind === "player") {
      if (total <= 14) return 3;
      if (total <= 18) return 8;
      if (total <= 22) return 10;
      if (total <= 30) return 25;
      if (total <= 45) return 45;
      if (total <= 80) return 50;
      return LIVING_WORLD_LEVEL_CAP;
    }
    if (Number(character?.age) > 0 && Number(character.age) <= 13) return Math.min(5, Math.max(1, Math.round(Number(character.age) / 3)));
    let inferred = total <= 10 ? 5
      : total <= 12 ? 8
        : total <= 14 ? 12
          : total <= 18 ? 20
            : total <= 22 ? 28
              : total <= 30 ? 35
                : total <= 45 ? 45
                  : total <= 80 ? 50
                    : LIVING_WORLD_LEVEL_CAP;
    const ratings = Array.isArray(character?.skills)
      ? character.skills.map((skill) => Number(skill?.rating) || 0)
      : [];
    const mastery = Math.max(0, ...ratings);
    if (mastery >= 4) inferred = Math.max(inferred, 22);
    else if (mastery >= 3) inferred = Math.max(inferred, 18);
    if (character?.profession && !PROFESSION_BUILDS[character.profession]) inferred = Math.max(inferred, 15);
    return Math.min(LIVING_WORLD_LEVEL_CAP, inferred);
  }
  let inferred = total <= 15 && peak <= 4 ? 3
    : total <= 30 ? 10
      : total <= 65 ? 25
        : total <= 110 ? 45
          : total <= 170 ? 50
            : LIVING_WORLD_LEVEL_CAP;
  if (character?.id === "wanderer" || character?.kind === "player") return inferred;
  const age = Number(character?.age);
  if (Number.isFinite(age) && age > 0 && age <= 13) {
    return Math.min(5, Math.max(1, inferred, Math.round(age / 3)));
  }
  if (Number.isFinite(age) && age >= 16) inferred = Math.max(inferred, 8);
  if (character?.profession) {
    const canonical = canonicalProfessionId(character.profession);
    inferred = Math.max(inferred, canonical ? 10 : 15);
  }
  const mastery = Math.max(0, ...(Array.isArray(character?.skills)
    ? character.skills.map((skill) => Number(skill?.rating) || 0)
    : []));
  if (mastery >= 4) inferred = Math.max(inferred, 22);
  else if (mastery >= 3) inferred = Math.max(inferred, 18);
  return Math.min(LIVING_WORLD_LEVEL_CAP, inferred);
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

  // A declared level represents ranks already earned, so even an underspecified
  // narrator sheet must carry most of those ranks' attribute budget. The blend
  // keeps the profession route dominant while preserving authored strengths and
  // weaknesses. Total variation is bounded to +/-15% of the canonical route.
  const lowerBudget = Math.round(projectedTotal * 0.85);
  const upperBudget = Math.round(projectedTotal * 1.15);
  const hasCompleteSheet = ATTR_KEYS.every((key) => Number.isFinite(Number(attributes?.[key])));
  if (preserveValidShape && hasCompleteSheet && suppliedTotal >= lowerBudget && suppliedTotal <= upperBudget) {
    return Object.fromEntries(ATTR_KEYS.map((key, index) => [key, Math.round(suppliedValues[index])]));
  }
  const targetBudget = Math.min(ceiling * ATTR_KEYS.length, Math.max(
    lowerBudget,
    Math.min(upperBudget, suppliedTotal || projectedTotal),
  ));
  const weighted = ATTR_KEYS.map((_, index) => {
    const routeShare = projectedValues[index] / projectedTotal;
    const suppliedShare = suppliedTotal > 0 ? suppliedValues[index] / suppliedTotal : routeShare;
    return targetBudget * ((routeShare * 0.7) + (suppliedShare * 0.3));
  });
  const allocated = weighted.map((value) => Math.min(ceiling, Math.floor(value)));
  let remaining = targetBudget - allocated.reduce((sum, value) => sum + value, 0);
  const order = weighted
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  while (remaining > 0) {
    let changed = false;
    for (const { index } of order) {
      if (remaining <= 0) break;
      if (allocated[index] >= ceiling) continue;
      allocated[index] += 1;
      remaining -= 1;
      changed = true;
    }
    if (!changed) break;
  }
  return Object.fromEntries(ATTR_KEYS.map((key, index) => [key, allocated[index]]));
}

export function attributesForProgression({
  attributes,
  professionId = "wanderer",
  archetypeId = null,
  level = 1,
  sidePath = "utility",
  preserveValidShape = true,
} = {}) {
  const canonicalProfession = canonicalProfessionId(professionId) || "wanderer";
  const targetLevel = boundedLevel(level);
  const projected = progressionAtLevel(canonicalProfession, targetLevel, { sidePath, archetypeId })?.attributes
    || Object.fromEntries(ATTR_KEYS.map((key) => [key, 1]));
  return routeScaledAttributes(attributes, projected, targetLevel, { preserveValidShape });
}

export function normalizeCharacterProgression(character, {
  convertLegacyAttributes = false,
  enforceLevelAttributeScale = false,
  alignAttributesToProgression = false,
  preserveValidAttributeShape = false,
} = {}) {
  if (!character) return character;
  const legacyKey = "sub" + "class";
  const hadProgression = character.progression?.version === PROGRESSION_VERSION;
  let attributesMutated = false;
  const inferredLevel = hadProgression
    ? Math.max(1, progressionLevel(character))
    : inferProgressionLevel(character, { legacyScale: convertLegacyAttributes });
  if (convertLegacyAttributes && !hadProgression && character.attributes) {
    character.attributes = expandLegacyAttributes(character.attributes);
    attributesMutated = true;
  }
  if (!character.archetype && character[legacyKey]) character.archetype = character[legacyKey];
  if (Object.prototype.hasOwnProperty.call(character, legacyKey)) delete character[legacyKey];
  const originalProfession = character.profession;
  const professionId = defaultProfession(character);
  const originalProfessionKey = String(originalProfession || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (!character.archetype && originalProfession && originalProfessionKey !== professionId) {
    character.archetype = originalProfession;
  }
  character.profession = professionId;
  const archetypeId = defaultArchetype(character, professionId);
  const sidePath = character.progression?.sidePath || sidePathFor(character);
  character.progression = createProgression({
    professionId,
    archetypeId,
    level: inferredLevel,
    sidePath,
    xp: character.progression?.xp,
  });
  if (enforceLevelAttributeScale || alignAttributesToProgression) {
    const level = Math.max(1, progressionLevel(character));
    const projected = progressionAtLevel(professionId, level, { sidePath, archetypeId })?.attributes
      || Object.fromEntries(ATTR_KEYS.map((key) => [key, 1]));
    if (alignAttributesToProgression) {
      character.attributes = { ...projected };
    } else character.attributes = routeScaledAttributes(character.attributes, projected, level, {
      preserveValidShape: preserveValidAttributeShape,
    });
    attributesMutated = true;
  }
  if (attributesMutated) {
    recomputeVitalityMax(character);
    recomputeResolveMax(character);
    recomputeCarryCapacity(character);
  }
  // Narrator-authored `level` is an input hint only. The durable total is
  // always derived from the ranks above, preventing it from drifting away.
  if (Object.prototype.hasOwnProperty.call(character, "level")) delete character.level;
  if (!character.archetype) character.archetype = character.progression.archetypeId;
  return character;
}

// Mutates the already-cloned campaign passed by migrateCodex/makeInitialState.
// Progression is normalized in timeline character snapshots too so rewinding an
// old campaign cannot resurrect the retired identity or attribute scale.
export function migrateProgressionState(state, { alignAuthoredAttributes = false } = {}) {
  if (!state) return state;
  const legacyState = state.progressionVersion !== PROGRESSION_VERSION;
  if (state.character) {
    if (!state.character.id) state.character.id = "wanderer";
    if (!state.character.kind) state.character.kind = "player";
    normalizeCharacterProgression(state.character, {
      convertLegacyAttributes: legacyState,
      enforceLevelAttributeScale: legacyState,
    });
  }
  const characters = state.world?.codex?.characters || {};
  for (const character of Object.values(characters)) {
    const isPlayerProjection = character?.id === "wanderer";
    normalizeCharacterProgression(character, {
      convertLegacyAttributes: legacyState && character?.progression?.version !== PROGRESSION_VERSION,
      enforceLevelAttributeScale: legacyState && !alignAuthoredAttributes,
      alignAttributesToProgression: alignAuthoredAttributes && !isPlayerProjection && character?.kind !== "mount",
    });
    // The compact state.character remains the canonical progression owner for
    // the player. Keep only identity/level projection on the Codex duplicate.
    if (isPlayerProjection && state.character?.progression) {
      character.archetype = state.character.archetype || state.character.progression.archetypeId;
      character.attributes = { ...(state.character.attributes || {}) };
      character.progression = {
        ...state.character.progression,
        paths: { ...state.character.progression.paths },
      };
    }
  }
  for (const turn of (state.turns || [])) {
    if (turn?.char) {
      if (!turn.char.id) turn.char.id = "wanderer";
      if (!turn.char.kind) turn.char.kind = "player";
      normalizeCharacterProgression(turn.char, {
        convertLegacyAttributes: legacyState,
        enforceLevelAttributeScale: legacyState,
      });
    }
    for (const character of Object.values(turn?.world?.codex?.characters || {})) {
      normalizeCharacterProgression(character, {
        convertLegacyAttributes: legacyState,
        enforceLevelAttributeScale: legacyState,
      });
    }
  }
  // Current timeline checkpoints reference heavy Codex snapshots through a
  // deduplicated pool. Migrate every pooled person as well or a rewind could
  // restore retired identity fields and the old attribute scale.
  for (const pooledCodex of (state.pools?.codex || [])) {
    for (const character of Object.values(pooledCodex?.characters || {})) {
      normalizeCharacterProgression(character, {
        convertLegacyAttributes: legacyState,
        enforceLevelAttributeScale: legacyState,
      });
    }
  }
  state.progressionVersion = PROGRESSION_VERSION;
  return state;
}

export function advanceProgression(character, xpGain) {
  if (!character || !(Number(xpGain) > 0)) {
    return { character, beforeLevel: progressionLevel(character), afterLevel: progressionLevel(character), gained: [] };
  }
  normalizeCharacterProgression(character);
  const beforeLevel = Math.max(1, progressionLevel(character));
  const progression = { ...character.progression, paths: { ...character.progression.paths } };
  progression.xp = Math.max(progressionXpForLevel(beforeLevel), Number(progression.xp) || 0) + Math.floor(Number(xpGain) || 0);
  const afterLevel = Math.max(beforeLevel, progressionLevelFromXp(progression.xp));
  const compiled = compileProfessionBuild(progression.professionId, {
    sidePath: progression.sidePath,
    archetypeId: progression.archetypeId,
  });
  const gained = [];
  for (let level = beforeLevel + 1; level <= afterLevel; level++) {
    const row = compiled?.levels[level - 1];
    if (!row) break;
    progression.paths[row.pathId] = row.rank;
    character.attributes = { ...(character.attributes || {}) };
    for (const [key, amount] of Object.entries(row.attributeGains)) {
      character.attributes[key] = Math.min(
        ATTRIBUTE_CAP,
        attributeCeilingForLevel(row.level),
        Math.max(0, (character.attributes[key] || 0) + amount),
      );
    }
    gained.push(row);
  }
  character.progression = progression;
  if (gained.length) {
    recomputeVitalityMax(character);
    recomputeResolveMax(character);
    recomputeCarryCapacity(character);
  }
  return { character, beforeLevel, afterLevel: progressionLevel(character), gained };
}

// Keep the full Codex dossier's player projection aligned with the compact
// state.character owner after any deterministic progression source.
export function projectCharacterProgression(state) {
  const character = state?.character;
  const wanderer = state?.world?.codex?.characters?.wanderer;
  if (!character?.progression || !wanderer) return state;
  return {
    ...state,
    world: {
      ...state.world,
      codex: {
        ...state.world.codex,
        characters: {
          ...state.world.codex.characters,
          wanderer: {
            ...wanderer,
            profession: character.profession,
            archetype: character.archetype,
            attributes: { ...(character.attributes || {}) },
            progression: {
              ...character.progression,
              paths: { ...character.progression.paths },
            },
          },
        },
      },
    },
  };
}

export function progressionSummary(character) {
  if (!character) return null;
  normalizeCharacterProgression(character);
  const level = Math.max(1, progressionLevel(character));
  const compiled = compileProfessionBuild(character.progression.professionId, {
    sidePath: character.progression.sidePath,
    archetypeId: character.progression.archetypeId,
  });
  const current = compiled?.levels[level - 1] || null;
  return {
    level,
    tier: levelTier(level),
    cap: CHARACTER_LEVEL_CAP,
    professionId: character.progression.professionId,
    archetypeId: character.progression.archetypeId,
    sidePath: character.progression.sidePath,
    current,
    paths: { ...character.progression.paths },
    xp: character.progression.xp,
    nextLevelXp: level < CHARACTER_LEVEL_CAP ? progressionXpForLevel(level + 1) : null,
  };
}
