// The single new-campaign start surface.
//
// Browse complete authored characters, then preview one. Identity and mechanics are fixed
// together; there is no name, portrait, or build assembly step. The controlled draft lives
// in App so a disposable practice fight returns to the same character preview.

import "./archetype-start.css";
import "./character-select-polish.css";
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import winterScene from "../../assets/generated/scene-whitemarch-v2.webp";
import { resolveCharacterPortrait } from "../character-portrait-assets.js";
import { resolvePlayerCombatCutout } from "../combat/tow-combat-art.js";
import { Icon } from "../Icon.jsx";
import {
  CHARACTER_ABILITY_TYPE_LABELS,
  characterAbilitiesFor,
  describeCharacterAbilityEffect,
} from "../../gameplay/tow/character-abilities.js";
import { createSkillState, generalAbilityIds, getSkill } from "../../gameplay/tow/skills.js";
import {
  describeTraitAtRank,
  getFusion,
  getTrait,
  traitIds,
} from "../../gameplay/tow/traits.js";
import { PRACTICE_SCENARIOS } from "../../gameplay/tow/practice-scenarios.js";
import { resolveTowAbilityArt, resolveTowActionName } from "../combat/tow-combat-ability-art.js";
import { trapModalFocus, useModalFocus } from "../exploration/modalFocus.js";
import {
  STARTING_ARCHETYPES,
  archetypeFusionIds,
  archetypeItemRows,
  createDefaultArchetypeDraft,
  getStartingArchetype,
  normalizeArchetypeDraft,
} from "../../gameplay/tow/starting-archetypes.js";

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
  return [ancestry, entry?.name].filter(Boolean).join(" · ");
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

function abilityUsesLabel(definition, rank = 1) {
  const uses = createSkillState(definition.id, rank).usesRemaining;
  return uses == null ? "Unlimited" : `${uses} / act`;
}

function AbilitySwapPicker({
  slotIndex,
  slotLabel,
  value,
  rank,
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
  const [pendingRank, setPendingRank] = useState(rank);
  const activeGroup = groups.find((group) => group.id === activeGroupId) || groups[0];
  const options = activeGroup?.options || [];
  const pendingSkill = groups.flatMap((group) => group.options)
    .find((skill) => skill.id === pendingSkillId) || selected;
  const pendingRankCap = pendingSkill?.rankCount || 1;

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
    setPendingRank(rank);
    setOpen(true);
  };

  const closePicker = ({ restoreFocus = true } = {}) => {
    setOpen(false);
    if (restoreFocus) globalThis.requestAnimationFrame?.(() => triggerRef.current?.focus());
  };

  const selectCandidate = (skill) => {
    if (!skill || isUnavailable(skill.id)) return;
    setPendingSkillId(skill.id);
    setPendingRank(skill.id === value ? rank : 1);
  };

  const confirmCandidate = () => {
    if (!pendingSkill || isUnavailable(pendingSkill.id)) return;
    onChange(pendingSkill.id, pendingRank);
    closePicker();
  };

  const changePendingRank = (delta) => {
    setPendingRank((current) => Math.max(1, Math.min(pendingRankCap, current + delta)));
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
  const selectedSummary = abilityMechanicalSummary(selected, rank);
  const candidateUnchanged = pendingSkillId === value && pendingRank === rank;

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
        data-rarity={selected.rarity}
        onClick={openPicker}
      >
        <span className="ability-swap-picker__trigger-art">
          <img src={resolveTowAbilityArt(selected)} alt="" />
        </span>
        <span className="ability-swap-picker__trigger-copy">
          <span className="ability-swap-picker__trigger-title">
            <strong>{resolveTowActionName(selected)}</strong>
            <small>{titleCase(selected.rarity)} · Rank {rank}</small>
          </span>
          <span className="ability-swap-picker__trigger-summary">{selectedSummary}</span>
          <span className="ability-swap-picker__trigger-uses">
            {abilityUsesLabel(selected, rank)}{selected.consumesTurn ? "" : " · swift"}
          </span>
        </span>
        <span className="ability-swap-picker__change" aria-hidden="true">
          <small>Change</small>
          <svg viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg>
        </span>
      </button>

      {open && typeof document !== "undefined" ? createPortal((
        <div
          className="ability-swap-picker__overlay"
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
                const previewRank = candidate ? pendingRank : (equipped ? rank : 1);
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
                    data-rarity={skill.rarity}
                    data-skill-id={skill.id}
                    key={skill.id}
                    onFocus={() => !unavailable && setActiveIndex(index)}
                    onPointerEnter={() => !unavailable && setActiveIndex(index)}
                    onClick={() => selectCandidate(skill)}
                  >
                    <span className="ability-swap-picker__option-art">
                      <img src={resolveTowAbilityArt(skill)} alt="" />
                    </span>
                    <span className="ability-swap-picker__option-copy">
                      <span className="ability-swap-picker__option-title">
                        <strong>{resolveTowActionName(skill)}</strong>
                        <small>{titleCase(skill.rarity)} · Rank {previewRank}/{skill.rankCount}</small>
                      </span>
                      <span className="ability-swap-picker__option-summary">{summary}</span>
                      <span className="ability-swap-picker__option-meta">
                        {abilityUsesLabel(skill, previewRank)}{skill.consumesTurn ? " · uses action" : " · swift action"}
                      </span>
                    </span>
                    <span className="ability-swap-picker__availability">
                      {candidate ? "Selected" : equipped ? "Equipped" : unavailable ? `In slot ${unavailableSlot + 1}` : "Available"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div
              className="ability-swap-picker__rank-bar"
              data-skill-id={pendingSkill.id}
              data-rank={pendingRank}
            >
              <span className="ability-swap-picker__rank-copy">
                <small>Starting rank</small>
                <strong>{resolveTowActionName(pendingSkill)}</strong>
                <span>{pendingRankCap === 1 ? "Fixed at Rank 1" : `Choose Rank 1–${pendingRankCap}`}</span>
              </span>
              <span className="ability-swap-picker__rank-stepper" aria-label={`${resolveTowActionName(pendingSkill)} starting rank`}>
                <button
                  type="button"
                  data-action="decrease-rank"
                  aria-label={`Lower ${resolveTowActionName(pendingSkill)} starting rank`}
                  disabled={pendingRank <= 1}
                  onClick={() => changePendingRank(-1)}
                >−</button>
                <output aria-live="polite">
                  <strong>Rank {pendingRank}</strong>
                  <small>of {pendingRankCap}</small>
                </output>
                <button
                  type="button"
                  data-action="increase-rank"
                  aria-label={`Raise ${resolveTowActionName(pendingSkill)} starting rank`}
                  disabled={pendingRank >= pendingRankCap}
                  onClick={() => changePendingRank(1)}
                >+</button>
              </span>
              <button
                type="button"
                className="ability-swap-picker__confirm"
                data-action="confirm-ability-swap"
                disabled={candidateUnchanged}
                onClick={confirmCandidate}
              >
                {candidateUnchanged ? "Current selection" : `Equip Rank ${pendingRank}`}
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

function SelectLoadoutEditor({ selected, skillIds, skillRanks, onSkillChange, onReset }) {
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
    || skillRanks.some((rank) => rank !== 1);

  return (
    <section className="character-details__test-loadout">
      <div className="character-details__section-heading">
        <div>
          <span className="character-details__label">Select loadout</span>
          <p>Choose each practice ability and the source rank it starts at.</p>
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
              label: `${selected.character.name} exclusives`,
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
              ? `${selected.character.name} Basic Attacks`
              : `${selected.character.name} Defenses`,
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
                rank={skillRanks[slotIndex]}
                groups={groups}
                skillIds={skillIds}
                accent={selected.color}
                onChange={(nextSkillId, nextRank) => onSkillChange(slotIndex, nextSkillId, nextRank)}
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

function ScenarioPicker({ value, onChange }) {
  const listboxId = useId();
  const rootRef = useRef(null);
  const selectedIndex = Math.max(0, PRACTICE_SCENARIOS.findIndex((entry) => entry.id === value));
  const selected = PRACTICE_SCENARIOS[selectedIndex];
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
    const scenario = PRACTICE_SCENARIOS[index];
    if (!scenario) return;
    onChange?.(scenario.id);
    setActiveIndex(index);
    setOpen(false);
  };

  const onKeyDown = (event) => {
    const last = PRACTICE_SCENARIOS.length - 1;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(selectedIndex);
        return;
      }
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => (index + delta + PRACTICE_SCENARIOS.length) % PRACTICE_SCENARIOS.length);
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
    <div className="scenario-picker" ref={rootRef}>
      <span className="scenario-picker__label">Practice opponent</span>
      <button
        type="button"
        className="scenario-picker__trigger"
        role="combobox"
        aria-label="Practice opponent"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open ? `${listboxId}-option-${activeIndex}` : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onKeyDown}
      >
        <span>
          <strong>{selected.name}</strong>
          <small>{selected.difficulty} · {selected.enemies.length === 1 ? selected.enemies[0].name : `${selected.enemies.length} opponents`}</small>
        </span>
        <svg aria-hidden="true" viewBox="0 0 16 16" className={open ? "is-open" : ""}>
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>

      {open ? (
        <div className="scenario-picker__list" id={listboxId} role="listbox" aria-label="Practice opponents">
          {PRACTICE_SCENARIOS.map((scenario, index) => (
            <button
              type="button"
              role="option"
              id={`${listboxId}-option-${index}`}
              aria-selected={scenario.id === selected.id}
              className={`${index === activeIndex ? "is-active" : ""}${scenario.id === selected.id ? " is-selected" : ""}`}
              key={scenario.id}
              onPointerEnter={() => setActiveIndex(index)}
              onClick={() => choose(index)}
            >
              <span><strong>{scenario.name}</strong><small>{scenario.difficulty}</small></span>
              <p>{scenario.summary}</p>
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
  testSkillRanks,
  onTestSkillChange,
  onResetTestSkills,
  scenarioId,
  onScenarioChange,
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
      <button type="button" className="character-details__scrim" aria-label="Close character details" onClick={onClose} />
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
            <h2 id={headingId}>Character details</h2>
          </div>
          <button type="button" className="character-details__close" aria-label="Close character details" onClick={onClose}>
            <Icon name="x" size={16} strokeWidth={1.6} />
          </button>
        </header>

        <div className="character-details__body">
          <section className="character-details__story">
            <h3>{selected.character.epithet}</h3>
            <p>{selected.character.history}</p>
            <small>Source identity · {selected.character.sourceName}</small>
          </section>

          <section className="character-details__stats" aria-label="Base combat stats">
            {[
              ["HP", selected.baseStats.maxHp],
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
              <span className="character-details__label">How {selected.character.name.split(" ")[0]} fights</span>
              <small>{selected.role}</small>
            </div>
            <p>{selected.playstyle}</p>
            <small>Watch for · {selected.attention}</small>
          </section>

          <SelectLoadoutEditor
            selected={selected}
            skillIds={testSkillIds}
            skillRanks={testSkillRanks}
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

          <section>
            <span className="character-details__label">Starting fusions</span>
            {fusionIds.length ? (
              <div className="character-details__chips is-fusion">
                {fusionIds.map((id) => <span key={id}>{getFusion(id)?.name || id}</span>)}
              </div>
            ) : <p>None forged yet. This character earns them in play.</p>}
          </section>

          <section className="character-details__practice">
            <ScenarioPicker value={scenarioId} onChange={onScenarioChange} />
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
}) {
  const normalized = normalizeArchetypeDraft(draft);
  const selected = getStartingArchetype(normalized.archetypeId) || STARTING_ARCHETYPES[0];
  const selectedIndex = STARTING_ARCHETYPES.findIndex((entry) => entry.id === selected.id);
  const [scenarioId, setScenarioId] = useState(PRACTICE_SCENARIOS[0].id);
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
  const testSkillRanks = normalized.testSkillRanks || testSkillIds.map(() => 1);

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
  const changeTestSkill = (slotIndex, skillId, rank) => {
    const nextSkillIds = [...testSkillIds];
    if (nextSkillIds.some((selectedId, index) => index !== slotIndex && selectedId === skillId)) return;
    nextSkillIds[slotIndex] = skillId;
    const nextSkillRanks = [...testSkillRanks];
    nextSkillRanks[slotIndex] = rank;
    change({ testSkillIds: nextSkillIds, testSkillRanks: nextSkillRanks });
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
      <section ref={rootRef} className="archetype-start character-select is-grid" role="dialog" aria-modal="true" aria-label="Choose a character">
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
              <h1>Select a character</h1>
              <p>{STARTING_ARCHETYPES.length} lives. One road north.</p>
            </div>
            <span aria-hidden="true" />
          </header>

          <div className="character-choice-grid" aria-label="Available characters">
            {STARTING_ARCHETYPES.map((entry, index) => (
              <button
                type="button"
                aria-label={`${entry.character.name}, ${characterKind(entry)}`}
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
                  <strong>{entry.character.name}</strong>
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
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${selected.character.name}`}
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
            <Icon name="arrowLeft" size={15} strokeWidth={1.7} /> Characters
          </button>
          <span aria-label={`Character ${selectedIndex + 1} of ${STARTING_ARCHETYPES.length}`}>
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
              alt={`${selected.character.name}, ${selected.character.epithet}`}
            />
            <span aria-hidden="true" />
          </figure>

          <div className="character-preview__copy">
            <p className="character-preview__kind">{characterKind(selected)}</p>
            <h1>{selected.character.name}</h1>
            <h2>{selected.character.epithet}</h2>
            <p className="character-preview__summary">{selected.character.summary}</p>
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
                  const actionName = resolveTowActionName(definition);
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
                      <img src={resolveTowAbilityArt(definition)} alt="" />
                      <span>{slotLabel}</span>
                    </button>
                  );
                })}
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
                onClick={() => onBegin?.({ archetypeId: normalized.archetypeId, preview: normalized.preview })}
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
          <div className="character-preview__carousel" ref={railRef} role="radiogroup" aria-label="Character carousel">
            {STARTING_ARCHETYPES.map((entry, index) => {
              const active = entry.id === selected.id;
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`${entry.character.name}, ${entry.name}`}
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
          testSkillRanks={testSkillRanks}
          onTestSkillChange={changeTestSkill}
          onResetTestSkills={() => change({ testSkillIds: null, testSkillRanks: null })}
          scenarioId={scenarioId}
          onScenarioChange={setScenarioId}
          onPractice={() => onPractice?.(normalized, scenarioId)}
          onClose={() => setDetailsOpen(false)}
          busy={busy}
        />
      ) : null}
    </section>
  );
}

export default QuickStartLane;
