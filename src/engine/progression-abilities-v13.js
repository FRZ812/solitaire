// Frozen verifier-only Tower v1.3 semantics from deployed commit 1dd86f8.
// Never route playable/current combat through this module.
// Runtime projection of the progression ledger into a usable combat kit.
//
// The ledger remains authoritative: general profession rows grant general
// abilities, and branch rows grant branch-exclusive abilities only after a
// durable choice exists. Nothing is copied back into `character.abilities`, so
// changing a loadout or migrating a save cannot silently mint progression.

import {
  canonicalProfessionId,
  compileProfessionTrack,
  compileRacialTrack,
} from "../data/progression-paths-v13.js";
import { abilityCategoryOf, clampAbilityTier, getAbilityDef } from "../data/abilities-v13.js";
import { clampPassiveTier, passiveDef } from "../data/passives-v13.js";
import { METAMAGIC_FEATURES, PROGRESSION_FEATURES } from "../data/progression-features.js";
import { tier as tierInfo } from "../data/tiers.js";

const METAMAGIC_THRESHOLDS = Object.freeze([10, 20, 30, 40, 50, 60]);
const CORE_METAMAGIC_IDS = new Set([
  "empowered-signature", "shaped-signature", "quickened-signature",
  "twinned-signature", "piercing-signature", "transmuted-signature",
  "perfected-signature",
]);
const GENERAL_SORCERER_REPERTOIRE_GRANTS = new Set([
  "sorcerer-secondary-spell",
  "sorcerer-tertiary-spell",
  "sorcerer-final-repertoire-spell",
]);
const EMPTY_TOW_COMBAT_ENTITLEMENTS = Object.freeze({
  abilities: Object.freeze([]),
  passives: Object.freeze([]),
  signatureSpellIds: Object.freeze([]),
  metamagicIds: Object.freeze([]),
  metamagicByAbilityId: Object.freeze({}),
  progressionCapabilities: Object.freeze([]),
  branchCapabilities: Object.freeze([]),
  progressionAbilityIds: Object.freeze([]),
  selectedBranchAbilityIds: Object.freeze([]),
});

function rankTotal(paths) {
  return Object.values(paths || {}).reduce((sum, rank) => sum + Math.max(0, Math.floor(Number(rank) || 0)), 0);
}

function list(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function normalizedLearned(entry) {
  if (typeof entry === "string") return { id: entry, tier: "common", source: "learned" };
  if (!entry?.id) return null;
  return { ...entry, tier: entry.tier || "common", source: entry.source || "learned" };
}

function professionTracks(character) {
  const progression = character?.progression || {};
  if (Array.isArray(progression.professions)) return progression.professions;
  // Retired ledgers had one combined 100-level path map. Preserve their learned
  // kits instead of guessing which old ranks were racial versus professional.
  return [];
}

function trackLevel(track) {
  // Once a ledger owns a path map, spent ranks are authoritative. Earned but
  // unallocated levels deliberately do not unlock spells or branch rewards.
  if (track && Object.prototype.hasOwnProperty.call(track, "paths")) return Math.max(0, Math.min(70, rankTotal(track.paths)));
  if (Number.isFinite(Number(track?.investedLevels))) return Math.max(0, Math.min(70, Math.floor(Number(track.investedLevels))));
  if (Number.isFinite(Number(track?.levels))) return Math.max(0, Math.min(70, Math.floor(Number(track.levels))));
  return 0;
}

function progressionSignatureIds(character, track) {
  const progression = character?.progression || {};
  const candidates = [
    track?.choices?.signatureSpellId,
    track?.choices?.signature_spell,
    track?.signatureSpellId,
    track?.signature_spell,
    ...list(track?.signatureSpellIds),
    ...list(track?.signatureSpells),
    progression.signatureSpellId,
    progression.signature_spell,
    ...list(progression.signatureSpellIds),
    ...list(progression.signatureSpells),
    character?.signatureSpellId,
    character?.signature_spell,
  ].filter(Boolean);
  const current = candidates.find((id) => getAbilityDef(id));
  return current ? [current] : [];
}

function metamagicSlots(character, track) {
  const progression = character?.progression || {};
  const sources = [
    character?.metamagic,
    character?.metamagicIds,
    progression.metamagic,
    progression.metamagicIds,
    track?.metamagic,
    track?.metamagicIds,
    track?.choices?.metamagic,
    track?.choices?.metamagicIds,
  ];
  const slots = [];
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (let index = 0; index < source.length; index += 1) {
      if (source[index] && METAMAGIC_FEATURES[source[index]]) slots[index] = source[index];
    }
  }
  return slots;
}

function selectedGrantOptions(track, grant, level) {
  const choices = track?.choices || {};
  let selected;
  if (grant?.replace) selected = choices.signatureExchanges?.[String(level)];
  else if (grant?.selectionKey) selected = choices[grant.selectionKey];
  else selected = choices.grantSelections?.[grant?.id];
  return list(selected).filter((id) => grant?.options?.includes(id));
}

function sorcererMetamagicScope(levels) {
  if (levels >= 60) return 4;
  if (levels >= 40) return 3;
  if (levels >= 20) return 2;
  return 1;
}

function addMetamagic(map, abilityId, metamagicId) {
  if (!getAbilityDef(abilityId) || !METAMAGIC_FEATURES[metamagicId]) return;
  if (!map.has(abilityId)) map.set(abilityId, new Set());
  map.get(abilityId).add(metamagicId);
}

function addGrantAbility(map, grant, source) {
  if (grant?.type !== "ability" || !getAbilityDef(grant.id)) return;
  const entry = { id: grant.id, tier: grant.tier || "common", source };
  const current = map.get(entry.id);
  const nextTier = clampAbilityTier(entry.id, entry.tier);
  if (!current || tierInfo(nextTier).order > tierInfo(current.tier).order) map.set(entry.id, { ...entry, tier: nextTier });
}

function addGrantPassive(map, grant, source) {
  if (grant?.type !== "passive" || !passiveDef(grant.id)) return;
  const tier = clampPassiveTier(grant.id, grant.tier || "common");
  const entry = { id: grant.id, tier, source };
  const current = map.get(entry.id);
  if (!current || tierInfo(tier).order > tierInfo(current.tier).order) map.set(entry.id, entry);
}

function addProgressionCapability(map, grant, source, scope) {
  if (!grant?.id || !["action", "passive", "proficiency", "recipe"].includes(grant.type)) return;
  const catalogued = PROGRESSION_FEATURES[grant.id];
  // Unnamed proficiency markers are bookkeeping rather than player-facing
  // capabilities. Authored branch actions/passives and explicit capability
  // grants retain their exact descriptions for UI and narrative consumers.
  if (!grant.branchCapability && !grant.name && !grant.description && !catalogued) return;
  const name = grant.name || grant.label || catalogued?.name || String(grant.id)
    .replace(/[-_:]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const description = grant.description || catalogued?.description || "";
  map.set(`${grant.type}:${grant.id}`, Object.freeze({
    id: grant.id,
    type: grant.type,
    name,
    description,
    source,
    scope,
  }));
}

function addEntry(map, raw) {
  const entry = normalizedLearned(raw);
  if (!entry || !getAbilityDef(entry.id)) return;
  const tier = clampAbilityTier(entry.id, entry.tier);
  const current = map.get(entry.id);
  if (!current || tierInfo(tier).order > tierInfo(current.tier).order) map.set(entry.id, { ...entry, tier });
}

function racialRows(character) {
  const racial = character?.progression?.racial;
  if (!racial) return [];
  const levels = Object.prototype.hasOwnProperty.call(racial, "paths")
    ? Math.max(0, Math.min(30, rankTotal(racial.paths)))
    : Number.isFinite(Number(racial.investedLevels))
      ? Math.max(0, Math.min(30, Math.floor(Number(racial.investedLevels))))
      : Math.max(0, Math.min(30, Math.floor(Number(racial.levels) || 0)));
  if (levels <= 0) return [];
  const compiled = compileRacialTrack(racial.raceId || character?.race || "human", {
    evolutionId: racial.evolutionId,
    branchChoices: racial.branchChoices || racial.choices?.branchChoices || {},
    evolutionPath: racial.evolutionPath || racial.choices?.evolutionPath || [],
  });
  return compiled?.levels?.slice(0, levels) || [];
}

/**
 * Project all general and selected-branch progression rewards into combat.
 * The returned arrays are safe to serialize into combat state.
 */
export function progressionCombatEntitlements(character) {
  // Tower archetypes own a separate, formation-combat ability model. Treat any
  // legacy learned kit or progression ledger still present during hydration as
  // contaminated save data: neither world powers nor old profession rewards
  // may become combat cards, passives, metamagic, or narrator capabilities.
  if (character?.progressionModel === "tow-archetype") return EMPTY_TOW_COMBAT_ENTITLEMENTS;

  const learned = new Map();
  for (const entry of character?.abilities || []) addEntry(learned, entry);

  const granted = new Map();
  const racialPassives = new Map();
  const selectedBranchAbilities = new Set();
  const progressionCapabilities = new Map();
  const signatureSpellIds = new Set();
  const metamagicByAbility = new Map();
  let hasSorcerer = false;
  let hasWizard = false;

  for (const track of professionTracks(character)) {
    const professionId = canonicalProfessionId(track?.professionId || track?.profession);
    const levels = trackLevel(track);
    if (!professionId || levels <= 0) continue;
    hasSorcerer ||= professionId === "sorcerer";
    hasWizard ||= professionId === "wizard";

    const signatures = professionId === "sorcerer" ? progressionSignatureIds(character, track) : [];
    const signatureId = signatures[0] || null;
    if (signatureId) signatureSpellIds.add(signatureId);
    const choices = {
      ...(track?.choices || {}),
      signatureSpellId: signatureId || track?.choices?.signatureSpellId || null,
    };
    const branchChoices = track?.branchChoices || track?.choices?.branchChoices || {};
    const compiled = compileProfessionTrack(professionId, {
      specializationId: track?.specializationId || track?.archetypeId,
      choices,
      branchChoices,
      specializationPath: track?.specializationPath || track?.specializationPathId || [],
    });
    const rows = compiled?.levels?.slice(0, levels) || [];
    const generalRepertoire = signatureId ? [signatureId] : [];
    const slots = professionId === "sorcerer" ? metamagicSlots(character, track) : [];
    const coreMetamagic = new Set();

    for (const row of rows) {
      for (const grant of row.generalGrants || []) {
        // Authored general actions and passives are real progression, not filler
        // between combat cards. Preserve them for every profession; the helper
        // still suppresses unnamed bookkeeping proficiency markers.
        addProgressionCapability(progressionCapabilities, grant, `${professionId}:general`, "general");
        // A signature exchange replaces the favourite; it does not mint every
        // historic favourite as a fifth/sixth repertoire spell.
        const obsoleteExchange = professionId === "sorcerer"
          && grant.source === "signature-exchange" && grant.id !== signatureId;
        if (!obsoleteExchange && (professionId !== "sorcerer" || grant.signature || grant.source === "signature-spell")) {
          addGrantAbility(granted, grant, `${professionId}:general`);
        }
        if (grant.type === "ability-choice") {
          const selected = selectedGrantOptions(track, grant, row.trackLevel);
          for (const id of selected) addGrantAbility(granted, { type: "ability", id }, `${professionId}:general-choice`);
          if (professionId === "sorcerer" && GENERAL_SORCERER_REPERTOIRE_GRANTS.has(grant.id)) {
            for (const id of selected) if (!generalRepertoire.includes(id)) generalRepertoire.push(id);
          }
        }
        if (professionId === "sorcerer" && grant.type === "metamagic" && CORE_METAMAGIC_IDS.has(grant.id)) {
          coreMetamagic.add(grant.id);
        }
      }
      for (const grant of row.branchGrants || []) {
        addProgressionCapability(progressionCapabilities, grant, `${professionId}:branch`, "branch");
        addGrantAbility(granted, grant, `${professionId}:branch`);
        if (grant.type === "ability") selectedBranchAbilities.add(grant.id);
        if (grant.type === "ability-choice") {
          for (const id of selectedGrantOptions(track, grant, row.trackLevel)) {
            addGrantAbility(granted, { type: "ability", id }, `${professionId}:branch-choice`);
            if (getAbilityDef(id)?.branchExclusive) selectedBranchAbilities.add(id);
            if (professionId === "sorcerer" && !metamagicByAbility.has(id)) metamagicByAbility.set(id, new Set());
          }
        }
        if (professionId === "sorcerer" && grant.type === "metamagic-choice") {
          const selected = grant.profileId
            ? choices.metamagicProfiles?.[grant.profileId]?.[grant.slot]
            : slots[grant.slot];
          if (!selected || !grant.options?.includes(selected)) continue;
          if (grant.profileId && grant.spellGrantId) {
            const wovenSpellId = list(choices.grantSelections?.[grant.spellGrantId])
              .find((id) => getAbilityDef(id));
            if (wovenSpellId) addMetamagic(metamagicByAbility, wovenSpellId, selected);
          } else if (signatureId) {
            // Singular Savant's extra utility slots are deliberately attached
            // only to the current signature, never to the scoped repertoire.
            addMetamagic(metamagicByAbility, signatureId, selected);
          }
        }
      }
    }
    if (professionId === "sorcerer") {
      for (let slot = 0; slot < METAMAGIC_THRESHOLDS.length; slot += 1) {
        if (levels < METAMAGIC_THRESHOLDS[slot]) continue;
        const selected = slots[slot];
        if (CORE_METAMAGIC_IDS.has(selected)) coreMetamagic.add(selected);
      }
      // Singular Savant deliberately trades the widening 2/3/4-spell scope for
      // absolute focus: secondary repertoire spells remain castable, but every
      // general and bonus metamagic stays on the one current signature.
      const scope = branchChoices["sorcerous-focus"] === "singular-savant"
        ? 1
        : sorcererMetamagicScope(levels);
      const scopedSpells = generalRepertoire.slice(0, scope);
      for (const abilityId of generalRepertoire) {
        if (!metamagicByAbility.has(abilityId)) metamagicByAbility.set(abilityId, new Set());
      }
      for (const abilityId of scopedSpells) {
        for (const metamagicId of coreMetamagic) addMetamagic(metamagicByAbility, abilityId, metamagicId);
      }
    }
  }

  for (const row of racialRows(character)) {
    for (const grant of row.grants || []) {
      addGrantAbility(granted, grant, grant.source || "racial");
      addGrantPassive(racialPassives, grant, grant.source || "racial");
    }
  }

  // A Sorcerer's arcane identity is deliberately narrow. A manually-authored
  // spell remains usable when it is the current signature, an independently
  // selected repertoire/woven spell, or another invested profession granted
  // it. Martial and racial powers are untouched. A Wizard multiclass naturally
  // restores broad arcane access.
  if (hasSorcerer && !hasWizard) {
    for (const [id, entry] of learned) {
      const def = getAbilityDef(id);
      const isArcaneSpell = abilityCategoryOf(def) === "spell" && def?.school === "arcane" && !def?.innate;
      if (isArcaneSpell && !signatureSpellIds.has(id) && !granted.has(id)) learned.delete(id);
      else learned.set(id, entry);
    }
  }

  // Branch-exclusive abilities can never be smuggled in through a narrator
  // grant or an old freeform kit. The chosen option's typed grant is the key.
  for (const [id] of learned) {
    const def = getAbilityDef(id);
    if (def?.branchExclusive && !selectedBranchAbilities.has(id)) learned.delete(id);
    else if (def?.progressionExclusive && !granted.has(id)) learned.delete(id);
  }
  for (const [id] of granted) {
    const def = getAbilityDef(id);
    if (def?.branchExclusive && !selectedBranchAbilities.has(id)) granted.delete(id);
  }

  const abilities = new Map(learned);
  for (const entry of granted.values()) addEntry(abilities, entry);
  const progressionAbilityIds = Object.freeze([...granted.keys()]
    .filter((id) => getAbilityDef(id)?.progressionExclusive && abilities.has(id)));

  const metamagicByAbilityId = Object.freeze(Object.fromEntries(
    [...metamagicByAbility.entries()]
      .filter(([abilityId]) => abilities.has(abilityId))
      .map(([abilityId, ids]) => [abilityId, Object.freeze([...ids])]),
  ));
  const metamagicIds = new Set();
  for (const signatureId of signatureSpellIds) {
    for (const id of metamagicByAbilityId[signatureId] || []) metamagicIds.add(id);
  }
  return Object.freeze({
    abilities: Object.freeze([...abilities.values()]),
    passives: Object.freeze([...racialPassives.values()]),
    signatureSpellIds: Object.freeze([...signatureSpellIds]),
    metamagicIds: Object.freeze([...metamagicIds]),
    metamagicByAbilityId,
    progressionCapabilities: Object.freeze([...progressionCapabilities.values()]),
    branchCapabilities: Object.freeze([...progressionCapabilities.values()].filter((entry) => entry.scope === "branch")),
    progressionAbilityIds,
    selectedBranchAbilityIds: Object.freeze([...selectedBranchAbilities]),
  });
}

/**
 * Player/narrator projection of earned progression. Unlike the combat return,
 * this preserves authored descriptions for noncombat branch capabilities and
 * metamagic modes while still using the same entitlement gate.
 */
export function progressionNarrativeProjection(character) {
  const entitlements = progressionCombatEntitlements(character);
  const signatureIds = new Set(entitlements.signatureSpellIds);
  const metamagicProfiles = Object.freeze(Object.entries(entitlements.metamagicByAbilityId)
    .filter(([, metamagicIds]) => metamagicIds.length > 0)
    .map(([abilityId, metamagicIds]) => Object.freeze({
      abilityId,
      abilityName: getAbilityDef(abilityId)?.name || abilityId,
      primarySignature: signatureIds.has(abilityId),
      features: Object.freeze(metamagicIds
        .map((id) => METAMAGIC_FEATURES[id])
        .filter(Boolean)),
    })));
  return Object.freeze({
    abilities: entitlements.abilities,
    metamagicProfiles,
    progressionCapabilities: entitlements.progressionCapabilities,
    branchCapabilities: entitlements.branchCapabilities,
  });
}

export function progressionAbilityEntries(character) {
  return progressionCombatEntitlements(character).abilities;
}

export function progressionPassiveEntries(character) {
  return progressionCombatEntitlements(character).passives;
}

export function signatureMetamagicFor(character) {
  const { signatureSpellIds, metamagicIds, metamagicByAbilityId } = progressionCombatEntitlements(character);
  return { signatureSpellIds, metamagicIds, metamagicByAbilityId };
}
