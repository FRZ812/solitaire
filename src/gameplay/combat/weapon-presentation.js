// Visual identity for equipment-owned basic attacks inside Solitaire.
//
// The combat kernel deliberately keeps the evidence-backed `strike` skill id: saves,
// replays, cooldowns, and replacements all depend on that stable mechanic. Solitaire's
// fiction is equipment-led, though, so the UI resolves the slot from the weapon currently
// worn by the acting character. The active form's compact mechanical snapshot travels in
// the encounter build; this richer presentation and its optional branches do not enter the
// strict Archetype actor schema.

import { itemTemplate } from "../../data/catalog.js";
import { wornItemIds } from "./start-items.js";
import {
  COMBAT_WEAPON_FAMILIES,
  isWeaponAttackSnapshot,
  weaponAttackSnapshot,
  weaponTechniqueFromItemIds,
} from "./weapon-techniques.js";

const FAMILY_PRESENTATION = Object.freeze({
  dagger: Object.freeze({ actionName: "Quick Cut", familyLabel: "Dagger" }),
  sword: Object.freeze({ actionName: "Slash", familyLabel: "Sword" }),
  axe: Object.freeze({ actionName: "Cleave", familyLabel: "Axe" }),
  mace: Object.freeze({ actionName: "Crushing Blow", familyLabel: "Mace" }),
  spear: Object.freeze({ actionName: "Thrust", familyLabel: "Spear" }),
  bow: Object.freeze({ actionName: "Loose Arrow", familyLabel: "Bow" }),
  crossbow: Object.freeze({ actionName: "Loose Bolt", familyLabel: "Crossbow" }),
  arcane: Object.freeze({ actionName: "Arcane Bolt", familyLabel: "Arcane focus" }),
  unarmed: Object.freeze({ actionName: "Unarmed Strike", familyLabel: "Unarmed" }),
});

export { COMBAT_WEAPON_FAMILIES };

function canonicalItem(itemId, codex) {
  return codex?.items?.[itemId] || itemTemplate(itemId) || null;
}

/**
 * Resolve one equipped weapon from a list of worn item ids.
 *
 * `itemCombatStats(...).damage` is the same test the actual Solitaire combat-stat bridge
 * uses, so the icon cannot silently disagree with which worn object supplies the attack.
 */
export function weaponPresentationFromItemIds(itemIds = [], codex = {}) {
  const technique = weaponTechniqueFromItemIds(itemIds, codex);
  const selected = technique.itemId ? canonicalItem(technique.itemId, codex) : null;
  const familyPresentation = FAMILY_PRESENTATION[technique.family] || FAMILY_PRESENTATION.unarmed;
  return Object.freeze({
    family: technique.family,
    familyLabel: familyPresentation.familyLabel,
    itemId: technique.itemId,
    weaponName: selected?.name || "Unarmed",
    lineageId: technique.lineageId,
    activeFormId: technique.activeFormId,
    activeForm: technique.activeForm,
    forms: technique.forms,
    attackSnapshot: weaponAttackSnapshot(technique),
    actionName: technique.activeForm?.name || familyPresentation.actionName,
  });
}

/** Resolve the presentation from the character's canonical worn equipment. */
export function weaponPresentationForCharacter(character, codex = {}) {
  return weaponPresentationFromItemIds(wornItemIds(character, codex), codex);
}

/** Defensive normalizer for fixtures and old callers that do not yet supply equipment. */
export function normalizeWeaponPresentation(value) {
  const family = typeof value?.family === "string" && Object.hasOwn(FAMILY_PRESENTATION, value.family)
    ? value.family
    : "unarmed";
  const fallback = FAMILY_PRESENTATION[family];
  const defaultTechnique = weaponTechniqueFromItemIds([]);
  const hasAuthoredForms = Array.isArray(value?.forms) && value.forms.length > 0;
  const forms = hasAuthoredForms
    ? value.forms
    : defaultTechnique.forms;
  const requestedFormId = typeof value?.attackSnapshot?.formId === "string"
    ? value.attackSnapshot.formId
    : value?.activeFormId;
  const activeForm = forms.find((entry) => entry?.id === requestedFormId)
    || value?.activeForm
    || forms[0];
  const technique = {
    lineageId: typeof value?.lineageId === "string" ? value.lineageId : defaultTechnique.lineageId,
    activeFormId: activeForm?.id || defaultTechnique.activeFormId,
    activeForm,
    forms,
  };
  const attackSnapshot = isWeaponAttackSnapshot(value?.attackSnapshot)
    ? value.attackSnapshot
    : weaponAttackSnapshot(technique);
  return {
    family,
    familyLabel: typeof value?.familyLabel === "string" ? value.familyLabel : fallback.familyLabel,
    itemId: typeof value?.itemId === "string" ? value.itemId : null,
    weaponName: typeof value?.weaponName === "string" ? value.weaponName : fallback.familyLabel,
    lineageId: technique.lineageId,
    activeFormId: technique.activeFormId,
    activeForm,
    forms,
    attackSnapshot,
    actionName: !hasAuthoredForms && typeof value?.actionName === "string"
      ? value.actionName
      : activeForm?.name || fallback.actionName,
  };
}

/** A preview of a sibling form without mutating which form is equipped. */
export function weaponPresentationForForm(value, formId) {
  const normalized = normalizeWeaponPresentation(value);
  const activeForm = normalized.forms.find((entry) => entry.id === formId) || normalized.activeForm;
  const technique = {
    lineageId: normalized.lineageId,
    activeFormId: activeForm.id,
    activeForm,
    forms: normalized.forms,
  };
  return {
    ...normalized,
    activeFormId: activeForm.id,
    activeForm,
    actionName: activeForm.name,
    attackSnapshot: weaponAttackSnapshot(technique),
  };
}
