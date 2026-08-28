// The single new-campaign start surface.
//
// Browse reusable combat archetypes, then preview one. Each entry is a rules kit with a
// representative portrait; authored character identity remains separate from its mechanics.
// The controlled draft lives in App so a disposable practice fight returns to the preview.

import "./archetype-start.css";
import "./character-select-polish.css";
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import winterScene from "../../assets/generated/scene-whitemarch-v2.webp";
import { resolveCharacterPortrait } from "../character-portrait-assets.js";
import { resolvePlayerCombatCutout } from "../combat/archetype-combat-art.js";
import { Icon } from "../Icon.jsx";
import {
  CHARACTER_ABILITY_TYPE_LABELS,
  characterAbilitiesFor,
  describeCharacterAbilityEffect,
} from "../../gameplay/combat/character-abilities.js";
import {
  abilityProfile,
  abilityRoleLabel,
} from "../../gameplay/combat/ability-profile.js";
import {
  generalAbilityIds,
  getSkill,
  resolveCost,
  skillRankForRarity,
  skillRarityChoices,
} from "../../gameplay/combat/skills.js";
import {
  KEEPSAKE_FAMILIES,
  STARTING_KEEPSAKES,
  getStartingKeepsake,
  isKeepsakeUnlocked,
  startingKeepsakesForFamily,
} from "../../gameplay/combat/keepsakes.js";
import {
  describeTraitAtRank,
  getFusion,
  getTrait,
  traitIds,
} from "../../gameplay/combat/traits.js";
import {
  DEFAULT_PRACTICE_ALLY_GROUP_ID,
  PRACTICE_ALLY_GROUPS,
  PRACTICE_SCENARIOS,
} from "../../gameplay/combat/practice-scenarios.js";
import { resolveCombatAbilityArt, resolveCombatActionName } from "../combat/archetype-combat-ability-art.js";
import { resolveCombatKeepsakeArt } from "../combat/combat-keepsake-art.js";
import { trapModalFocus, useModalFocus } from "../exploration/modalFocus.js";
import {
  STARTING_ARCHETYPES,
  archetypeFusionIds,
  archetypeItemRows,
  createDefaultArchetypeDraft,
  getStartingArchetype,
  normalizeArchetypeDraft,
} from "../../gameplay/combat/starting-archetypes.js";

function portraitFor(entry) {
  return resolveCharacterPortrait({ portraitKey: entry?.character?.portraitKey });
}

function combatArtFor(entry) {
  return resolvePlayerCombatCutout(entry?.character?.portraitKey, entry?.character) || portraitFor(entry);
}

function titleCase(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function characterKind(entry) {
  const ancestry = entry?.character?.kindLabel || (entry?.character?.subrace
    ? `${titleCase(entry.character.subrace)} ${titleCase(entry.character.race)}`
    : titleCase(entry?.character?.race));
  return [ancestry, entry?.descriptor].filter(Boolean).join(" · ");
}

function updateDraft(current, patch) {
  return normalizeArchetypeDraft({ ...current, ...patch });
}

function ArrowIcon({ direction = "right" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={`character-select__arrow-icon is-${direction}`}>
      <path d="M4 10h11M11 5l5 5-5 5" />
    </svg>
  );
}

function abilityMechanicalSummary(definition, rank = 1) {
  const readable = (definition.effects || [])
    .map((effect) => describeCharacterAbilityEffect(effect, rank));
  if (definition.cooldown > 0) readable.push(`${definition.cooldown}-turn cooldown`);
  return readable.join(" · ") || "No immediate combat effect";
}

function TraitCard({ definition, rank = 1, compact = false, availability = null }) {
  if (!definition) return null;
  return (
    <article
      className={`starting-trait${compact ? " is-compact" : ""}`}
      data-trait-id={definition.id}
    >
      <span aria-hidden="true">✦</span>
      <div>
        <small>{availability || `Innate passive · Rank ${rank}`}</small>
        <strong>{definition.name}</strong>
        <p>{describeTraitAtRank(definition.id, rank)}</p>
      </div>
    </article>
  );
}

const PRACTICE_SLOT_LABELS = Object.freeze([
  "Basic attack",
  "Defensive",
  "Flexible 1",
  "Flexible 2",
  "Flexible 3",
]);

function abilityResolveLabel(definition, rank = 1) {
  const cost = resolveCost(definition.id, rank);
  return cost > 0 ? `${cost} Resolve` : "No Resolve";
}

function abilityTargetLabel(targeting) {
  if (targeting.anchorSide === "self") {
    return targeting.footprint === "all" ? "All combatants" : "Self";
  }
  const ally = targeting.anchorSide === "ally";
  const singular = ally ? "party member" : "enemy";
  const adjective = ally ? "allied" : "enemy";
  if (targeting.footprint === "single") return `One ${singular}`;
  if (targeting.footprint === "all") return ally ? "All allies" : "All enemies";
  if (targeting.footprint === "row") return `${adjective} row`;
  if (targeting.footprint === "column") return `${adjective} column`;
  if (targeting.footprint === "cross-short") return `Nearby ${adjective} cross`;
  return `Full ${adjective} cross`;
}

function AbilityTacticalMeta({ definition, rank = 1, actionLabel = null, className = "" }) {
  const profile = abilityProfile(definition, rank);
  const roleLabels = profile.roles.map((role) => abilityRoleLabel(role, definition, rank));
  const roleText = roleLabels.join(" + ") || "No active effect";
  const cost = abilityResolveLabel(definition, rank);
  const target = abilityTargetLabel(profile.targeting);
  const fullLabel = [cost, roleText, target, actionLabel].filter(Boolean).join(" · ");
  return (
    <span className={`ability-tactical-meta ${className}`.trim()} aria-label={fullLabel}>
      <span className="ability-tactical-meta__cost" aria-hidden="true">{cost}</span>
      <span className="ability-tactical-meta__separator" aria-hidden="true"> · </span>
      <span className="ability-tactical-meta__roles" aria-hidden="true">
        {roleLabels.length > 0 ? roleLabels.map((label, index) => (
          <React.Fragment key={`${profile.roles[index]}-${label}`}>
            {index > 0 ? <span className="ability-tactical-meta__join"> + </span> : null}
            <span className="ability-tactical-meta__role">{label}</span>
          </React.Fragment>
        )) : <span className="ability-tactical-meta__role">No active effect</span>}
      </span>
      <span className="ability-tactical-meta__separator" aria-hidden="true"> · </span>
      <span className="ability-tactical-meta__target" aria-hidden="true">{target}</span>
      {actionLabel ? (
        <>
          <span className="ability-tactical-meta__separator" aria-hidden="true"> · </span>
          <span className="ability-tactical-meta__action" aria-hidden="true">{actionLabel}</span>
        </>
      ) : null}
    </span>
  );
}

function AbilitySwapPicker({
  slotIndex,
  slotLabel,
  value,
  rarity,
  groups,
  skillIds,
  accent,
  onChange,
}) {
  const listboxId = useId();
  const headingId = useId();
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const optionRefs = useRef([]);
  const selected = getSkill(value);
  const selectedGroup = groups.find((group) => group.options.some((skill) => skill.id === value))
    || groups[0];
  const [open, setOpen] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState(selectedGroup.id);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pendingSkillId, setPendingSkillId] = useState(value);
  const [pendingRarity, setPendingRarity] = useState(rarity);
  const activeGroup = groups.find((group) => group.id === activeGroupId) || groups[0];
  const options = activeGroup?.options || [];
  const pendingSkill = groups.flatMap((group) => group.options)
    .find((skill) => skill.id === pendingSkillId) || selected;
  const pendingRarityChoices = pendingSkill ? skillRarityChoices(pendingSkill) : [];
  const pendingRarityIndex = pendingRarityChoices.indexOf(pendingRarity);

  const equippedSlot = (skillId) => skillIds.findIndex(
    (chosenId, chosenIndex) => chosenIndex !== slotIndex && chosenId === skillId,
  );
  const isUnavailable = (skillId) => equippedSlot(skillId) >= 0;
  const firstAvailableIndex = (entries, preferred = -1) => {
    if (preferred >= 0 && !isUnavailable(entries[preferred]?.id)) return preferred;
    return Math.max(0, entries.findIndex((skill) => !isUnavailable(skill.id)));
  };

  const focusOption = (index) => {
    setActiveIndex(index);
    globalThis.requestAnimationFrame?.(() => optionRefs.current[index]?.focus());
  };

  useEffect(() => {
    if (!open) return undefined;
    const preferred = options.findIndex((skill) => skill.id === pendingSkillId);
    const nextIndex = firstAvailableIndex(options, preferred);
    setActiveIndex(nextIndex);
    const frame = globalThis.requestAnimationFrame?.(() => optionRefs.current[nextIndex]?.focus());
    return () => globalThis.cancelAnimationFrame?.(frame);
  // Opening, choosing a candidate, or changing category keeps focus in the visible option set.
  }, [activeGroupId, open, pendingSkillId]);

  const openPicker = () => {
    setActiveGroupId(selectedGroup.id);
    setPendingSkillId(value);
    setPendingRarity(rarity);
    setOpen(true);
  };

  const closePicker = ({ restoreFocus = true } = {}) => {
    setOpen(false);
    if (restoreFocus) globalThis.requestAnimationFrame?.(() => triggerRef.current?.focus());
  };

  const selectCandidate = (skill) => {
    if (!skill || isUnavailable(skill.id)) return;
    setPendingSkillId(skill.id);
    setPendingRarity(skill.id === value ? rarity : skill.rarity);
  };

  const confirmCandidate = () => {
    if (!pendingSkill || isUnavailable(pendingSkill.id)) return;
    onChange(pendingSkill.id, pendingRarity);
    closePicker();
  };

  const changePendingRarity = (delta) => {
    const nextIndex = Math.max(0, Math.min(
      pendingRarityChoices.length - 1,
      pendingRarityIndex + delta,
    ));
    setPendingRarity(pendingRarityChoices[nextIndex]);
  };

  const moveActive = (direction) => {
    if (!options.length) return;
    let next = activeIndex;
    for (let attempt = 0; attempt < options.length; attempt += 1) {
      next = (next + direction + options.length) % options.length;
      if (!isUnavailable(options[next].id)) {
        focusOption(next);
        return;
      }
    }
  };

  const onPanelKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closePicker();
      return;
    }
    if (event.key === "Tab") {
      trapModalFocus(event, panelRef.current);
      return;
    }
    if ((event.key === "ArrowDown" || event.key === "ArrowUp")
      && event.target?.getAttribute?.("role") === "option") {
      event.preventDefault();
      moveActive(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if ((event.key === "Home" || event.key === "End")
      && event.target?.getAttribute?.("role") === "option") {
      event.preventDefault();
      const direction = event.key === "Home" ? 1 : -1;
      const start = event.key === "Home" ? -1 : options.length;
      let next = start;
      for (let attempt = 0; attempt < options.length; attempt += 1) {
        next += direction;
        if (!isUnavailable(options[next]?.id)) {
          focusOption(next);
          break;
        }
      }
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && event.target?.getAttribute?.("role") === "option") {
      event.preventDefault();
      selectCandidate(options[activeIndex]);
    }
  };

  if (!selected || !activeGroup) return null;
  const selectedRank = skillRankForRarity(selected, rarity);
  const selectedSummary = abilityMechanicalSummary(selected, selectedRank);
  const candidateUnchanged = pendingSkillId === value && pendingRarity === rarity;

  return (
    <div className="ability-swap-picker">
      <button
        ref={triggerRef}
        type="button"
        className="ability-swap-picker__trigger"
        role="combobox"
        aria-label={`Practice slot ${slotIndex + 1}, ${slotLabel}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${listboxId}-panel` : undefined}
        data-rarity={rarity}
        onClick={openPicker}
      >
        <span className="ability-swap-picker__trigger-art">
          <img src={resolveCombatAbilityArt(selected)} alt="" />
        </span>
        <span className="ability-swap-picker__trigger-copy">
          <span className="ability-swap-picker__trigger-title">
            <strong>{resolveCombatActionName(selected)}</strong>
            <small>{titleCase(rarity)}</small>
          </span>
          <span className="ability-swap-picker__trigger-summary">{selectedSummary}</span>
          <AbilityTacticalMeta
            className="ability-swap-picker__trigger-uses"
            definition={selected}
            rank={selectedRank}
            actionLabel={selected.consumesTurn ? null : "swift"}
          />
        </span>
        <span className="ability-swap-picker__change" aria-hidden="true">
          <small>Change</small>
          <svg viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg>
        </span>
      </button>

      {open && typeof document !== "undefined" ? createPortal((
        <div
          className="ability-swap-picker__overlay"
          data-app-exclusive-surface
          data-modal-escape-boundary
          style={{ "--character-accent": accent }}
          onKeyDown={onPanelKeyDown}
        >
          <div className="ability-swap-picker__backdrop" aria-hidden="true" onPointerDown={() => closePicker()} />
          <section
            ref={panelRef}
            id={`${listboxId}-panel`}
            className="ability-swap-picker__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
          >
            <header className="ability-swap-picker__header">
              <div>
                <span>Loadout slot {slotIndex + 1}</span>
                <h3 id={headingId}>{slotLabel}</h3>
                <p>{slotIndex < 2 ? "Choose a same-family replacement." : "Choose one exclusive or shared General ability."}</p>
              </div>
              <button type="button" aria-label="Close ability selector" onClick={() => closePicker()}>
                <Icon name="x" size={17} strokeWidth={1.7} />
              </button>
            </header>

            {groups.length > 1 ? (
              <div className="ability-swap-picker__tabs" role="tablist" aria-label="Ability source">
                {groups.map((group) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={group.id === activeGroup.id}
                    className={group.id === activeGroup.id ? "is-active" : ""}
                    data-group-id={group.id}
                    key={group.id}
                    onClick={() => setActiveGroupId(group.id)}
                  >
                    <span>{group.label}</span>
                    <small>{group.options.length}</small>
                  </button>
                ))}
              </div>
            ) : (
              <div className="ability-swap-picker__single-group">
                <span>{activeGroup.label}</span><small>{options.length} choices</small>
              </div>
            )}

            <div
              className="ability-swap-picker__list"
              id={listboxId}
              role="listbox"
              aria-label={`Abilities for practice slot ${slotIndex + 1}`}
            >
              {options.map((skill, index) => {
                const unavailableSlot = equippedSlot(skill.id);
                const unavailable = unavailableSlot >= 0;
                const equipped = skill.id === value;
                const candidate = skill.id === pendingSkillId;
                const previewRarity = candidate ? pendingRarity : (equipped ? rarity : skill.rarity);
                const previewRank = skillRankForRarity(skill, previewRarity);
                const summary = abilityMechanicalSummary(skill, previewRank);
                return (
                  <button
                    ref={(node) => { optionRefs.current[index] = node; }}
                    type="button"
                    role="option"
                    aria-selected={candidate}
                    aria-disabled={unavailable}
                    tabIndex={index === activeIndex ? 0 : -1}
                    className={`${index === activeIndex ? "is-active" : ""}${candidate ? " is-selected" : ""}${equipped ? " is-equipped" : ""}${unavailable ? " is-unavailable" : ""}`}
                    data-rarity={previewRarity}
                    data-skill-id={skill.id}
                    key={skill.id}
                    onFocus={() => !unavailable && setActiveIndex(index)}
                    onPointerEnter={() => !unavailable && setActiveIndex(index)}
                    onClick={() => selectCandidate(skill)}
                  >
                    <span className="ability-swap-picker__option-art">
                      <img src={resolveCombatAbilityArt(skill)} alt="" />
                    </span>
                    <span className="ability-swap-picker__option-copy">
                      <span className="ability-swap-picker__option-title">
                        <strong>{resolveCombatActionName(skill)}</strong>
                        <small>{titleCase(previewRarity)}</small>
                      </span>
                      <span className="ability-swap-picker__option-summary">{summary}</span>
                      <AbilityTacticalMeta
                        className="ability-swap-picker__option-meta"
                        definition={skill}
                        rank={previewRank}
                        actionLabel={skill.consumesTurn ? "uses action" : "swift action"}
                      />
                    </span>
                    <span className="ability-swap-picker__availability">
                      {candidate ? "Selected" : equipped ? "Equipped" : unavailable ? `In slot ${unavailableSlot + 1}` : "Available"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div
              className="ability-swap-picker__rarity-bar"
              data-skill-id={pendingSkill.id}
              data-rarity={pendingRarity}
            >
              <span className="ability-swap-picker__rarity-copy">
                <small>Starting rarity</small>
                <strong>{resolveCombatActionName(pendingSkill)}</strong>
                <span>{pendingRarityChoices.length === 1
                  ? `Fixed at ${titleCase(pendingRarity)}`
                  : `${titleCase(pendingRarityChoices[0])} → ${titleCase(pendingRarityChoices.at(-1))}`}</span>
              </span>
              <span className="ability-swap-picker__rarity-stepper" aria-label={`${resolveCombatActionName(pendingSkill)} starting rarity`}>
                <button
                  type="button"
                  data-action="lower-rarity"
                  aria-label={`Lower ${resolveCombatActionName(pendingSkill)} starting rarity`}
                  disabled={pendingRarityIndex <= 0}
                  onClick={() => changePendingRarity(-1)}
                >−</button>
                <output aria-live="polite">
                  <strong>{titleCase(pendingRarity)}</strong>
                </output>
                <button
                  type="button"
                  data-action="promote-rarity"
                  aria-label={`Promote ${resolveCombatActionName(pendingSkill)} starting rarity`}
                  disabled={pendingRarityIndex >= pendingRarityChoices.length - 1}
                  onClick={() => changePendingRarity(1)}
                >+</button>
              </span>
              <button
                type="button"
                className="ability-swap-picker__confirm"
                data-action="confirm-ability-swap"
                disabled={candidateUnchanged}
                onClick={confirmCandidate}
              >
                {candidateUnchanged ? "Current selection" : `Equip ${titleCase(pendingRarity)}`}
              </button>
            </div>

            <footer>
              <span><i aria-hidden="true" /> Current loadout</span>
              <small>{options.length} {activeGroup.label.toLowerCase()}</small>
            </footer>
          </section>
        </div>
      ), document.body) : null}
    </div>
  );
}

const KEEPSAKE_GROUPS = Object.freeze([
  Object.freeze({
    id: "relic",
    label: KEEPSAKE_FAMILIES.relic,
    description: "A permanent effect that travels with this character.",
  }),
  Object.freeze({
    id: "supply",
    label: KEEPSAKE_FAMILIES.supply,
    description: "A one-use answer carried into the opening fight.",
  }),
]);

function KeepsakePicker({
  value,
  accent,
  unlockedAchievementIds = [],
  compact = false,
  onChange,
}) {
  const listboxId = useId();
  const headingId = useId();
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const optionRefs = useRef([]);
  const selected = getStartingKeepsake(value) || STARTING_KEEPSAKES[0];
  const [open, setOpen] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState(selected.family);
  const [activeIndex, setActiveIndex] = useState(0);
  const [inspectedId, setInspectedId] = useState(selected.id);
  const activeGroup = KEEPSAKE_GROUPS.find((group) => group.id === activeGroupId)
    || KEEPSAKE_GROUPS[0];
  const options = startingKeepsakesForFamily(activeGroup.id);
  const inspected = getStartingKeepsake(inspectedId) || selected;
  const inspectedUnlocked = isKeepsakeUnlocked(inspected, unlockedAchievementIds);
  const unchanged = inspected.id === selected.id;

  useEffect(() => {
    if (!open) return undefined;
    const preferred = options.findIndex((item) => item.id === inspected.id);
    const nextIndex = Math.max(0, preferred);
    setActiveIndex(nextIndex);
    const frame = globalThis.requestAnimationFrame?.(() => optionRefs.current[nextIndex]?.focus());
    return () => globalThis.cancelAnimationFrame?.(frame);
  }, [activeGroupId, inspected.id, open]);

  const openPicker = () => {
    setActiveGroupId(selected.family);
    setInspectedId(selected.id);
    setOpen(true);
  };

  const closePicker = ({ restoreFocus = true } = {}) => {
    setOpen(false);
    if (restoreFocus) globalThis.requestAnimationFrame?.(() => triggerRef.current?.focus());
  };

  const switchGroup = (groupId) => {
    const first = startingKeepsakesForFamily(groupId)[0];
    setActiveGroupId(groupId);
    if (first) setInspectedId(first.id);
  };

  const focusOption = (index) => {
    setActiveIndex(index);
    globalThis.requestAnimationFrame?.(() => optionRefs.current[index]?.focus());
  };

  const moveActive = (direction) => {
    if (!options.length) return;
    focusOption((activeIndex + direction + options.length) % options.length);
  };

  const confirm = () => {
    if (!inspectedUnlocked || unchanged) return;
    onChange?.(inspected.id);
    closePicker();
  };

  const onPanelKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closePicker();
      return;
    }
    if (event.key === "Tab") {
      trapModalFocus(event, panelRef.current);
      return;
    }
    if ((event.key === "ArrowDown" || event.key === "ArrowUp")
      && event.target?.getAttribute?.("role") === "option") {
      event.preventDefault();
      moveActive(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if ((event.key === "Home" || event.key === "End")
      && event.target?.getAttribute?.("role") === "option") {
      event.preventDefault();
      focusOption(event.key === "Home" ? 0 : options.length - 1);
      return;
    }
    if ((event.key === "Enter" || event.key === " ")
      && event.target?.getAttribute?.("role") === "option") {
      event.preventDefault();
      setInspectedId(options[activeIndex].id);
    }
  };

  return (
    <div className={`keepsake-picker${compact ? " is-compact" : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className="ability-swap-picker__trigger keepsake-picker__trigger"
        role="combobox"
        aria-label={`Starting keepsake, ${selected.name}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${listboxId}-panel` : undefined}
        data-rarity={selected.rarity}
        onClick={openPicker}
      >
        <span className="ability-swap-picker__trigger-art keepsake-picker__trigger-art">
          <img src={resolveCombatKeepsakeArt(selected)} alt="" />
        </span>
        <span className="ability-swap-picker__trigger-copy keepsake-picker__trigger-copy">
          <span className="ability-swap-picker__trigger-title">
            <strong>{selected.name}</strong>
            <small>{titleCase(selected.rarity)}</small>
          </span>
          <span className="ability-swap-picker__trigger-summary">{selected.effect}</span>
          <span className="ability-swap-picker__trigger-uses">
            {selected.permanent ? "Permanent keepsake" : "One-use supply"}
          </span>
        </span>
        <span className="ability-swap-picker__change" aria-hidden="true">
          <small>Change</small>
          <svg viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg>
        </span>
      </button>

      {open && typeof document !== "undefined" ? createPortal((
        <div
          className="ability-swap-picker__overlay keepsake-picker__overlay"
          data-app-exclusive-surface
          data-modal-escape-boundary
          style={{ "--character-accent": accent }}
          onKeyDown={onPanelKeyDown}
        >
          <div className="ability-swap-picker__backdrop" aria-hidden="true" onPointerDown={() => closePicker()} />
          <section
            ref={panelRef}
            id={`${listboxId}-panel`}
            className="ability-swap-picker__panel keepsake-picker__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
          >
            <header className="ability-swap-picker__header">
              <div>
                <span>Before the road north</span>
                <h3 id={headingId}>Choose a keepsake</h3>
                <p>Take one permanent relic or one emergency supply. Achievement relics remain visible until earned.</p>
              </div>
              <button type="button" aria-label="Close keepsake selector" onClick={() => closePicker()}>
                <Icon name="x" size={17} strokeWidth={1.7} />
              </button>
            </header>

            <div className="ability-swap-picker__tabs" role="tablist" aria-label="Keepsake family">
              {KEEPSAKE_GROUPS.map((group) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={group.id === activeGroup.id}
                  className={group.id === activeGroup.id ? "is-active" : ""}
                  data-group-id={group.id}
                  key={group.id}
                  onClick={() => switchGroup(group.id)}
                >
                  <span>{group.label}</span>
                  <small>{startingKeepsakesForFamily(group.id).length}</small>
                </button>
              ))}
            </div>

            <div
              className="ability-swap-picker__list keepsake-picker__list"
              id={listboxId}
              role="listbox"
              aria-label={activeGroup.label}
            >
              {options.map((item, index) => {
                const unlocked = isKeepsakeUnlocked(item, unlockedAchievementIds);
                const current = item.id === selected.id;
                const inspecting = item.id === inspected.id;
                return (
                  <button
                    ref={(node) => { optionRefs.current[index] = node; }}
                    type="button"
                    role="option"
                    aria-selected={current}
                    tabIndex={index === activeIndex ? 0 : -1}
                    className={`keepsake-picker__option${index === activeIndex ? " is-active" : ""}${inspecting ? " is-inspected" : ""}${current ? " is-selected" : ""}${unlocked ? "" : " is-locked"}`}
                    data-rarity={item.rarity}
                    data-keepsake-id={item.id}
                    key={item.id}
                    onFocus={() => setActiveIndex(index)}
                    onPointerEnter={() => setActiveIndex(index)}
                    onClick={() => {
                      setActiveIndex(index);
                      setInspectedId(item.id);
                    }}
                  >
                    <span className="ability-swap-picker__option-art">
                      <img src={resolveCombatKeepsakeArt(item)} alt="" />
                    </span>
                    <span className="ability-swap-picker__option-copy">
                      <span className="ability-swap-picker__option-title">
                        <strong>{item.name}</strong>
                        <small>{titleCase(item.rarity)}</small>
                      </span>
                      <span className="ability-swap-picker__option-summary">{item.description}</span>
                      <span className="ability-swap-picker__option-meta">{item.effect}</span>
                    </span>
                    <span className="ability-swap-picker__availability">
                      {current ? "Chosen" : !unlocked ? "Locked" : inspecting ? "Inspecting" : "Available"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="keepsake-picker__selection-bar" data-rarity={inspected.rarity}>
              <span className="keepsake-picker__selection-copy">
                <small>{inspected.permanent ? "Permanent relic" : "Emergency supply"}</small>
                <strong>{inspected.name}</strong>
                <span>{inspected.effect}</span>
              </span>
              {inspected.unlock ? (
                <span className="keepsake-picker__unlock">
                  <Icon name="shield" size={14} strokeWidth={1.6} />
                  <span><strong>{inspected.unlock.name}</strong><small>{inspected.unlock.requirement}</small></span>
                </span>
              ) : null}
              <button
                type="button"
                className="ability-swap-picker__confirm keepsake-picker__confirm"
                data-action="confirm-keepsake"
                disabled={unchanged || !inspectedUnlocked}
                onClick={confirm}
              >
                {!inspectedUnlocked ? "Achievement locked" : unchanged ? "Current keepsake" : "Take this keepsake"}
              </button>
            </div>

            <footer>
              <span><i aria-hidden="true" /> One starting keepsake</span>
              <small>{activeGroup.description}</small>
            </footer>
          </section>
        </div>
      ), document.body) : null}
    </div>
  );
}

function SelectLoadoutEditor({ selected, skillIds, skillRarities, onSkillChange, onReset }) {
  const exclusiveAbilities = useMemo(() => characterAbilitiesFor(selected.id), [selected.id]);
  const basicOptions = useMemo(
    () => exclusiveAbilities.filter((skill) => skill.abilityType === "basic-attack"),
    [exclusiveAbilities],
  );
  const defensiveOptions = useMemo(
    () => exclusiveAbilities.filter((skill) => skill.abilityType === "defensive"),
    [exclusiveAbilities],
  );
  const flexibleOptions = useMemo(
    () => exclusiveAbilities.filter((skill) => skill.abilityType === "archetype"),
    [exclusiveAbilities],
  );
  const generalOptions = useMemo(
    () => generalAbilityIds().map((id) => getSkill(id)).filter(Boolean),
    [],
  );
  const changed = skillIds.some((id, index) => id !== selected.build.skills[index])
    || skillRarities.some((rarity, index) => rarity !== getSkill(skillIds[index]).rarity);

  return (
    <section className="character-details__test-loadout">
      <div className="character-details__section-heading">
        <div>
          <span className="character-details__label">Select loadout</span>
          <p>Choose each practice ability and the rarity it starts at.</p>
        </div>
        <button type="button" disabled={!changed} onClick={onReset}>Reset kit</button>
      </div>

      <div className="practice-loadout-editor" aria-label="Selectable loadout">
        {skillIds.map((skillId, slotIndex) => {
          const fixedOptions = slotIndex === 0 ? basicOptions : defensiveOptions;
          const flexible = slotIndex >= 2;
          const groups = flexible ? [
            {
              id: "exclusive",
              label: `${selected.name} abilities`,
              options: flexibleOptions,
            },
            {
              id: "general",
              label: "General abilities",
              options: generalOptions,
            },
          ] : [{
            id: slotIndex === 0 ? "basic" : "defensive",
            label: slotIndex === 0
              ? `${selected.name} Basic Attacks`
              : `${selected.name} Defenses`,
            options: fixedOptions,
          }];
          return (
            <div
              className="practice-loadout-editor__slot"
              data-slot-index={slotIndex + 1}
              data-slot-role={flexible ? "flexible" : "fixed"}
              key={slotIndex}
            >
              <span className="practice-loadout-editor__slot-label">
                <strong>{String(slotIndex + 1).padStart(2, "0")}</strong>
                <span>{PRACTICE_SLOT_LABELS[slotIndex]}</span>
                <small>{flexible ? "Exclusive / General" : "Same family"}</small>
              </span>
              <AbilitySwapPicker
                slotIndex={slotIndex}
                slotLabel={PRACTICE_SLOT_LABELS[slotIndex]}
                value={skillId}
                rarity={skillRarities[slotIndex]}
                groups={groups}
                skillIds={skillIds}
                accent={selected.color}
                onChange={(nextSkillId, nextRarity) => onSkillChange(slotIndex, nextSkillId, nextRarity)}
              />
            </div>
          );
        })}
      </div>
      <small className="practice-loadout-editor__note">
        {changed ? "Practice loadout modified · journey kit unchanged" : "Authored journey loadout · practice only"}
      </small>
    </section>
  );
}

function practiceFormationCount(option, kind) {
  if (kind === "allies") return (option?.allies?.length || 0) + 1;
  return option?.enemies?.length || 0;
}

function practiceFormationMeta(option, kind) {
  const count = practiceFormationCount(option, kind);
  if (kind === "allies") return `${count} combatant${count === 1 ? "" : "s"}`;
  return [
    option?.difficulty,
    `${count} opponent${count === 1 ? "" : "s"}`,
  ].filter(Boolean).join(" · ");
}

function PracticeFormationPicker({ label, value, options, kind, onChange }) {
  const listboxId = useId();
  const rootRef = useRef(null);
  const selectedIndex = Math.max(0, options.findIndex((entry) => entry.id === value));
  const selected = options[selectedIndex];
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  useEffect(() => {
    if (!open) setActiveIndex(selectedIndex);
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open) return undefined;
    const closeFromOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeFromOutside);
    return () => document.removeEventListener("pointerdown", closeFromOutside);
  }, [open]);

  const choose = (index) => {
    const option = options[index];
    if (!option) return;
    onChange?.(option.id);
    setActiveIndex(index);
    setOpen(false);
  };

  const onKeyDown = (event) => {
    const last = options.length - 1;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(selectedIndex);
        return;
      }
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => (index + delta + options.length) % options.length);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(event.key === "Home" ? 0 : last);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) choose(activeIndex);
      else setOpen(true);
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className="practice-formation-picker" ref={rootRef}>
      <span className="practice-formation-picker__label">{label}</span>
      <button
        type="button"
        className="practice-formation-picker__trigger"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open ? `${listboxId}-option-${activeIndex}` : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onKeyDown}
      >
        <span>
          <strong>{selected.name}</strong>
          <small>{practiceFormationMeta(selected, kind)}</small>
        </span>
        <svg aria-hidden="true" viewBox="0 0 16 16" className={open ? "is-open" : ""}>
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>

      {open ? (
        <div className="practice-formation-picker__list" id={listboxId} role="listbox" aria-label={`${label} choices`}>
          {options.map((option, index) => (
            <button
              type="button"
              role="option"
              id={`${listboxId}-option-${index}`}
              aria-selected={option.id === selected.id}
              className={`${index === activeIndex ? "is-active" : ""}${option.id === selected.id ? " is-selected" : ""}`}
              key={option.id}
              onPointerEnter={() => setActiveIndex(index)}
              onClick={() => choose(index)}
            >
              <span><strong>{option.name}</strong><small>{practiceFormationMeta(option, kind)}</small></span>
              <p>{option.summary}</p>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CharacterDetails({
  selected,
  testSkillIds,
  testSkillRarities,
  onTestSkillChange,
  onResetTestSkills,
  keepsakeId,
  onKeepsakeChange,
  unlockedAchievementIds,
  scenarioId,
  onScenarioChange,
  allyGroupId,
  onAllyGroupChange,
  onPractice,
  onClose,
  busy,
}) {
  const headingId = useId();
  const dialogRef = useModalFocus(onClose);
  const items = useMemo(() => archetypeItemRows(selected.id), [selected.id]);
  const fusionIds = useMemo(() => archetypeFusionIds(selected.id), [selected.id]);
  const baseTraitId = Object.keys(selected.build.traits)[0];
  const baseTrait = getTrait(baseTraitId);
  const baseTraitRank = selected.build.traits[baseTraitId];
  const sharedTraits = useMemo(
    () => traitIds()
      .map((id) => getTrait(id))
      .filter((trait) => trait && trait.id !== baseTraitId && trait.exclusiveTo === null),
    [baseTraitId],
  );

  return (
    <>
      <button type="button" className="character-details__scrim" aria-label="Close archetype details" onClick={onClose} />
      <aside
        ref={dialogRef}
        className="character-details"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
      >
        <header>
          <div>
            <span>{selected.power} · {selected.name}</span>
            <h2 id={headingId}>Archetype details</h2>
          </div>
          <button type="button" className="character-details__close" aria-label="Close archetype details" onClick={onClose}>
            <Icon name="x" size={16} strokeWidth={1.6} />
          </button>
        </header>

        <div className="character-details__body">
          <section className="character-details__story">
            <h3>{selected.descriptor}</h3>
            <p>{selected.design}</p>
            <small>Reusable combat kit · character identity remains independent</small>
          </section>

          <section className="character-details__stats" aria-label="Base combat stats">
            {[
              ["HP", selected.baseStats.maxHp],
              ["RES", selected.baseStats.resolveMax],
              ["ATK", selected.baseStats.attack],
              ["DEF", selected.baseStats.defense],
              ["CRIT", `${selected.baseStats.critRate}%`],
              ["DODGE", `${selected.baseStats.dodgeRate}%`],
            ].map(([label, value]) => (
              <div key={label}><span>{label}</span><strong>{value}</strong></div>
            ))}
          </section>

          <section className="character-details__combat-style">
            <div className="character-details__section-heading">
              <span className="character-details__label">How {selected.name} fights</span>
              <small>{selected.role}</small>
            </div>
            <p>{selected.playstyle}</p>
            <small>Watch for · {selected.attention}</small>
          </section>

          <SelectLoadoutEditor
            selected={selected}
            skillIds={testSkillIds}
            skillRarities={testSkillRarities}
            onSkillChange={onTestSkillChange}
            onReset={onResetTestSkills}
          />

          <section className="character-details__passives">
            <div className="character-details__section-heading">
              <span className="character-details__label">Passive trait</span>
              <small>Innate · 7 ranks</small>
            </div>
            <TraitCard definition={baseTrait} rank={baseTraitRank} />
            <details className="character-ability-library__group">
              <summary><span>Explore other traits</span><small>{sharedTraits.length}</small></summary>
              <div className="shared-trait-library" aria-label="Passive traits available later">
                {sharedTraits.map((trait) => (
                  <TraitCard
                    key={trait.id}
                    definition={trait}
                    compact
                    availability="Passive · available later"
                  />
                ))}
              </div>
            </details>
          </section>

          <section>
            <div className="character-details__section-heading">
              <span className="character-details__label">Starting equipment</span>
              <small>{items.length} worn</small>
            </div>
            <div className="character-details__items">
              {items.map((item) => (
                <article key={item.id}>
                  <div><strong>{item.name}</strong><span>{item.tier.replace(/-/g, " ")}</span></div>
                  <p>{item.passive}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="character-details__keepsakes">
            <div className="character-details__section-heading">
              <span className="character-details__label">Starting keepsake</span>
              <small>Permanent relic or one-use supply</small>
            </div>
            <KeepsakePicker
              value={keepsakeId}
              accent={selected.color}
              unlockedAchievementIds={unlockedAchievementIds}
              onChange={onKeepsakeChange}
            />
          </section>

          <section>
            <span className="character-details__label">Starting fusions</span>
            {fusionIds.length ? (
              <div className="character-details__chips is-fusion">
                {fusionIds.map((id) => <span key={id}>{getFusion(id)?.name || id}</span>)}
              </div>
            ) : <p>None forged yet. This character earns them in play.</p>}
          </section>

          <section className="character-details__practice">
            <div className="character-details__practice-pickers">
              <PracticeFormationPicker
                label="Allied formation"
                value={allyGroupId}
                options={PRACTICE_ALLY_GROUPS}
                kind="allies"
                onChange={onAllyGroupChange}
              />
              <PracticeFormationPicker
                label="Enemy formation"
                value={scenarioId}
                options={PRACTICE_SCENARIOS}
                kind="enemies"
                onChange={onScenarioChange}
              />
            </div>
            <button type="button" disabled={busy} onClick={onPractice}>
              Test in combat
              <span>Nothing is saved</span>
            </button>
          </section>
        </div>
      </aside>
    </>
  );
}

export function QuickStartLane({
  draft = createDefaultArchetypeDraft(),
  onDraftChange,
  onPractice,
  onBegin,
  onQuit,
  busy = false,
  error = null,
  unlockedAchievementIds = [],
}) {
  const normalized = normalizeArchetypeDraft(draft);
  const selected = getStartingArchetype(normalized.archetypeId) || STARTING_ARCHETYPES[0];
  const selectedIndex = STARTING_ARCHETYPES.findIndex((entry) => entry.id === selected.id);
  const [scenarioId, setScenarioId] = useState(PRACTICE_SCENARIOS[0].id);
  const [allyGroupId, setAllyGroupId] = useState(DEFAULT_PRACTICE_ALLY_GROUP_ID);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const rootRef = useRef(null);
  const railRef = useRef(null);
  const thumbnailRefs = useRef([]);
  const gridChoiceRefs = useRef([]);
  const wasPreviewRef = useRef(normalized.preview);
  const baseTrait = getTrait(Object.keys(selected.build.traits)[0]);
  const previewTraitRank = selected.build.traits[baseTrait?.id] || 1;
  const previewTraitSummary = baseTrait ? describeTraitAtRank(baseTrait.id, previewTraitRank) : "";
  const testSkillIds = normalized.testSkillIds || selected.build.skills;
  const testSkillRarities = normalized.testSkillRarities
    || testSkillIds.map((skillId) => getSkill(skillId).rarity);

  useEffect(() => setDetailsOpen(false), [selected.id]);
  useEffect(() => {
    const wasPreview = wasPreviewRef.current;
    wasPreviewRef.current = normalized.preview;
    if (wasPreview && !normalized.preview) {
      requestAnimationFrame(() => gridChoiceRefs.current[selectedIndex]?.focus?.());
    }
  }, [normalized.preview, selectedIndex]);
  useEffect(() => {
    if (!normalized.preview) return;
    rootRef.current?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
  }, [normalized.preview, selected.id]);

  const change = (patch) => onDraftChange?.(updateDraft(normalized, patch));
  const changeTestSkill = (slotIndex, skillId, rarity) => {
    const nextSkillIds = [...testSkillIds];
    if (nextSkillIds.some((selectedId, index) => index !== slotIndex && selectedId === skillId)) return;
    nextSkillIds[slotIndex] = skillId;
    const nextSkillRarities = [...testSkillRarities];
    nextSkillRarities[slotIndex] = rarity;
    change({ testSkillIds: nextSkillIds, testSkillRarities: nextSkillRarities });
  };
  const focusCarouselChoice = (index) => {
    const node = thumbnailRefs.current[index];
    if (!node?.scrollIntoView) return;
    const reduced = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    node.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest", inline: "center" });
  };
  const selectCharacter = (entry, index, preview = true) => {
    change({ archetypeId: entry.id, preview });
    if (preview) requestAnimationFrame(() => focusCarouselChoice(index));
  };
  const moveCharacter = (delta) => {
    const index = (selectedIndex + delta + STARTING_ARCHETYPES.length) % STARTING_ARCHETYPES.length;
    selectCharacter(STARTING_ARCHETYPES[index], index, true);
  };

  if (!normalized.preview) {
    return (
      <section ref={rootRef} data-app-exclusive-surface className="archetype-start character-select is-grid" role="dialog" aria-modal="true" aria-label="Choose an archetype">
        <img className="character-select__world" src={winterScene} alt="" />
        <div className="character-select__veil" aria-hidden="true" />
        <div className="character-grid-view">
          <header className="character-grid-view__header">
            {onQuit ? (
              <button type="button" className="character-select__quiet-action" onClick={onQuit}>
                <Icon name="arrowLeft" size={15} strokeWidth={1.7} /> Journeys
              </button>
            ) : <span />}
            <div>
              <span>New journey</span>
              <h1>Select an archetype</h1>
              <p>{STARTING_ARCHETYPES.length} reusable combat kits. One road north.</p>
            </div>
            <span aria-hidden="true" />
          </header>

          <div className="character-choice-grid" aria-label="Available archetypes">
            {STARTING_ARCHETYPES.map((entry, index) => (
              <button
                type="button"
                aria-label={`${entry.name}, ${characterKind(entry)}`}
                className="character-choice-card"
                style={{
                  "--character-accent": entry.color,
                  "--portrait-scale": entry.portrait.scale,
                  "--portrait-x": entry.portrait.x,
                  "--portrait-y": entry.portrait.y,
                }}
                key={entry.id}
                ref={(node) => { gridChoiceRefs.current[index] = node; }}
                onClick={() => selectCharacter(entry, index, true)}
              >
                <img className="character-choice-card__art" src={combatArtFor(entry)} alt="" />
                <span className="character-choice-card__shade" />
                <span className="character-choice-card__copy">
                  <strong>{entry.name}</strong>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="archetype-start character-select is-preview"
      ref={rootRef}
      data-app-exclusive-surface
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${selected.name} archetype`}
      style={{
        "--character-accent": selected.color,
        "--portrait-scale": selected.portrait.scale,
        "--portrait-x": selected.portrait.x,
        "--portrait-y": selected.portrait.y,
      }}
    >
      <img className="character-select__world" src={winterScene} alt="" />
      <div className="character-select__veil" aria-hidden="true" />
      <div className="character-preview">
        <header className="character-preview__nav">
          <button type="button" className="character-select__quiet-action" onClick={() => change({ preview: false })}>
            <Icon name="arrowLeft" size={15} strokeWidth={1.7} /> Archetypes
          </button>
          <span aria-label={`Archetype ${selectedIndex + 1} of ${STARTING_ARCHETYPES.length}`}>
            {String(selectedIndex + 1).padStart(2, "0")} / {String(STARTING_ARCHETYPES.length).padStart(2, "0")}
          </span>
        </header>

        <main className="character-preview__stage">
          <figure
            className="character-preview__portrait"
            style={{ "--character-portrait": `url("${portraitFor(selected)}")` }}
          >
            <img
              className="character-preview__cutout"
              src={combatArtFor(selected)}
              alt={`${selected.name} archetype representative, ${selected.descriptor}`}
            />
            <span aria-hidden="true" />
          </figure>

          <div className="character-preview__copy">
            <p className="character-preview__kind">{characterKind(selected)}</p>
            <h1>{selected.name}</h1>
            <h2>{selected.descriptor}</h2>
            <p className="character-preview__summary">{selected.summary}</p>
            <div className="character-preview__kit">
              <div
                className="character-preview__trait"
                aria-label={`Starting passive: ${baseTrait?.name || Object.keys(selected.build.traits)[0]}. ${previewTraitSummary}`}
                title={previewTraitSummary}
              >
                <span aria-hidden="true">✦</span>
                <strong>{baseTrait?.name || Object.keys(selected.build.traits)[0]}</strong>
                <small>Rank {previewTraitRank} passive</small>
              </div>

              <div className="character-preview__ability-strip" aria-label="Starting abilities">
                {selected.build.skills.map((skillId, index) => {
                  const definition = getSkill(skillId);
                  if (!definition) return null;
                  const actionName = resolveCombatActionName(definition);
                  const typeLabel = CHARACTER_ABILITY_TYPE_LABELS[definition.abilityType] || "Ability";
                  const flexible = definition.abilityType === "archetype" || definition.abilityType === "general";
                  const slotLabel = flexible ? `Flex ${index - 1}` : typeLabel;
                  return (
                    <button
                      type="button"
                      key={skillId}
                      className="character-preview__ability-slot"
                      data-ability-type={definition.abilityType}
                      data-slot-role={flexible ? "flexible" : "fixed"}
                      title={`${flexible ? `${slotLabel} · ${typeLabel}` : typeLabel}: ${actionName}`}
                      onClick={() => setDetailsOpen(true)}
                      aria-label={`View ${flexible ? `${slotLabel}, ${typeLabel}` : typeLabel} ability, ${actionName}`}
                    >
                      <img src={resolveCombatAbilityArt(definition)} alt="" />
                      <span>{slotLabel}</span>
                    </button>
                  );
                })}
              </div>
              <div className="character-preview__keepsake">
                <KeepsakePicker
                  value={normalized.keepsakeId}
                  accent={selected.color}
                  unlockedAchievementIds={unlockedAchievementIds}
                  compact
                  onChange={(keepsakeId) => change({ keepsakeId })}
                />
              </div>
            </div>

            {error ? <p className="character-preview__alert" role="alert">{error}</p> : null}

            <div className="character-preview__actions">
              <button type="button" className="character-preview__details-button" aria-expanded={detailsOpen} onClick={() => setDetailsOpen(true)}>
                Details
              </button>
              <button
                type="button"
                className="character-preview__begin"
                disabled={busy}
                onClick={() => onBegin?.({
                  archetypeId: normalized.archetypeId,
                  keepsakeId: normalized.keepsakeId,
                  preview: true,
                })}
              >
                <span>Begin journey</span>
                <ArrowIcon />
              </button>
            </div>
          </div>
        </main>

        <footer className="character-preview__rail">
          <button type="button" className="character-preview__rail-arrow is-left" aria-label="Previous character" onClick={() => moveCharacter(-1)}>
            <ArrowIcon direction="left" />
          </button>
          <div className="character-preview__carousel" ref={railRef} role="radiogroup" aria-label="Archetype carousel">
            {STARTING_ARCHETYPES.map((entry, index) => {
              const active = entry.id === selected.id;
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`${entry.name}, ${entry.descriptor}`}
                  className={active ? "is-selected" : ""}
                  style={{
                    "--character-accent": entry.color,
                    "--portrait-scale": entry.portrait.scale,
                    "--portrait-x": entry.portrait.x,
                    "--portrait-y": entry.portrait.y,
                  }}
                  key={entry.id}
                  ref={(node) => { thumbnailRefs.current[index] = node; }}
                  tabIndex={active ? 0 : -1}
                  onClick={() => selectCharacter(entry, index, true)}
                  onKeyDown={(event) => {
                    let target = null;
                    if (event.key === "ArrowLeft") target = (index - 1 + STARTING_ARCHETYPES.length) % STARTING_ARCHETYPES.length;
                    if (event.key === "ArrowRight") target = (index + 1) % STARTING_ARCHETYPES.length;
                    if (event.key === "Home") target = 0;
                    if (event.key === "End") target = STARTING_ARCHETYPES.length - 1;
                    if (target == null) return;
                    event.preventDefault();
                    selectCharacter(STARTING_ARCHETYPES[target], target, true);
                    requestAnimationFrame(() => thumbnailRefs.current[target]?.focus?.());
                  }}
                >
                  <img src={combatArtFor(entry)} alt="" />
                </button>
              );
            })}
          </div>
          <button type="button" className="character-preview__rail-arrow is-right" aria-label="Next character" onClick={() => moveCharacter(1)}>
            <ArrowIcon />
          </button>
        </footer>
      </div>

      {detailsOpen ? (
        <CharacterDetails
          selected={selected}
          testSkillIds={testSkillIds}
          testSkillRarities={testSkillRarities}
          onTestSkillChange={changeTestSkill}
          onResetTestSkills={() => change({ testSkillIds: null, testSkillRarities: null })}
          keepsakeId={normalized.keepsakeId}
          onKeepsakeChange={(keepsakeId) => change({ keepsakeId })}
          unlockedAchievementIds={unlockedAchievementIds}
          scenarioId={scenarioId}
          onScenarioChange={setScenarioId}
          allyGroupId={allyGroupId}
          onAllyGroupChange={setAllyGroupId}
          onPractice={() => onPractice?.(normalized, scenarioId, allyGroupId)}
          onClose={() => setDetailsOpen(false)}
          busy={busy}
        />
      ) : null}
    </section>
  );
}

export default QuickStartLane;
