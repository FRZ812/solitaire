// The single new-campaign start surface.
//
// Browse complete authored characters, then preview one. Identity and mechanics are fixed
// together; there is no name, portrait, or build assembly step. The controlled draft lives
// in App so a disposable practice fight returns to the same character preview.

import "./archetype-start.css";
import "./character-select-polish.css";
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import winterScene from "../../assets/generated/scene-whitemarch-v2.webp";
import { resolveCharacterPortrait } from "../character-portrait-assets.js";
import { resolvePlayerCombatCutout } from "../combat/tow-combat-art.js";
import { Icon } from "../Icon.jsx";
import {
  CHARACTER_ABILITY_TYPE_LABELS,
  characterAbilitiesFor,
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
import { useModalFocus } from "../exploration/modalFocus.js";
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

function nonStrikeSummary(definition, rank = 1) {
  const readable = (definition.effects || []).map((effect, index) => {
    const table = effect.percentByRank || effect.countByRank;
    const amount = Array.isArray(table) ? table[Math.min(table.length - 1, Math.max(0, rank - 1))] : null;
    if (effect.type === "damage") return `${amount}% ${effect.scale.toUpperCase()} damage`;
    if (effect.type === "damage-enemy-lost-hp") return `${amount}% of enemy missing health`;
    if (effect.type === "damage-self-lost-hp") return `${amount}% of own missing health`;
    if (effect.type === "shield") return `${amount}% ${effect.scale.toUpperCase()} ward`;
    if (effect.type === "heal") return `Restore ${amount}% ${effect.scale.toUpperCase()} health`;
    if (effect.type === "heal-lost-fraction") return `Restore ${amount}% of lost health`;
    if (effect.type === "scaled-status") return `${amount}% ${effect.scale.toUpperCase()} ${effect.status}`;
    if (effect.type === "status") return `${amount} ${effect.status}`;
    if (effect.type === "reduce-statuses") return `${effect.target === "enemy" ? "Consume" : "Cleanse"} ${effect.statuses.join(", ")}`;
    if (effect.type === "amplify-statuses") return `Raise ${effect.statuses.join(", ")} to ${amount}%`;
    if (effect.type === "consume-status") return `Spend ${amount} ${effect.status}`;
    return effect.type.replace(/-/g, " ");
  });
  return readable.join(" · ") || "Passive combat effect";
}

function StartingAbilityCard({ definition, compact = false, availability = null }) {
  const state = createSkillState(definition.id, 1);
  const name = resolveTowActionName(definition);
  const summary = definition.description || nonStrikeSummary(definition, state.rank);
  const typeLabel = CHARACTER_ABILITY_TYPE_LABELS[definition.abilityType]
    || (definition.consumesTurn ? "Action" : "Swift");
  return (
    <article
      className={`starting-ability${compact ? " is-compact" : ""}`}
      data-skill-id={definition.id}
      data-ability-type={definition.abilityType || undefined}
    >
      <span className="starting-ability__art">
        <img src={resolveTowAbilityArt(definition)} alt="" />
        <span aria-hidden="true" />
      </span>
      <div>
        <span>{availability || typeLabel}{definition.consumesTurn ? "" : " · keeps action"}</span>
        <strong>{name}</strong>
        <p>{summary}</p>
        {definition.source ? (
          <small className="starting-ability__source">
            {definition.source.fidelity === "direct" ? "Source mechanic" : "Source-guided remake"}
            {` · ${definition.source.sourceName}`}
          </small>
        ) : null}
      </div>
    </article>
  );
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

function AbilityLibraryGroup({ label, abilities, availability }) {
  return (
    <details className="character-ability-library__group" open={abilities.length <= 3}>
      <summary><span>{label}</span><small>{abilities.length}</small></summary>
      <div className="general-ability-library">
        {abilities.map((skill) => (
          <StartingAbilityCard
            key={skill.id}
            definition={skill}
            compact
            availability={availability}
          />
        ))}
      </div>
    </details>
  );
}

const PRACTICE_SLOT_LABELS = Object.freeze([
  "Basic attack",
  "Defensive",
  "Flexible 1",
  "Flexible 2",
  "Flexible 3",
]);

function PracticeLoadoutEditor({ selected, skillIds, onSkillChange, onReset }) {
  const fieldId = useId();
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
  const changed = skillIds.some((id, index) => id !== selected.build.skills[index]);
  const isChosenElsewhere = (skillId, slotIndex) => skillIds.some(
    (chosenId, chosenIndex) => chosenIndex !== slotIndex && chosenId === skillId,
  );

  const renderOptions = (options, slotIndex) => options.map((skill) => (
    <option
      key={skill.id}
      value={skill.id}
      disabled={isChosenElsewhere(skill.id, slotIndex)}
    >
      {skill.name} · {titleCase(skill.rarity)}
    </option>
  ));

  return (
    <section className="character-details__test-loadout">
      <div className="character-details__section-heading">
        <div>
          <span className="character-details__label">Practice loadout</span>
          <p>Swap any legal ability for combat testing. Journey starts keep the authored kit above.</p>
        </div>
        <button type="button" disabled={!changed} onClick={onReset}>Reset kit</button>
      </div>

      <div className="practice-loadout-editor" aria-label="Practice loadout">
        {skillIds.map((skillId, slotIndex) => {
          const definition = getSkill(skillId);
          const fixedOptions = slotIndex === 0 ? basicOptions : defensiveOptions;
          const flexible = slotIndex >= 2;
          const selectId = `${fieldId}-slot-${slotIndex}`;
          return (
            <div
              className="practice-loadout-editor__slot"
              data-slot-index={slotIndex + 1}
              data-slot-role={flexible ? "flexible" : "fixed"}
              key={`${slotIndex}-${skillId}`}
            >
              <img src={resolveTowAbilityArt(definition)} alt="" />
              <label htmlFor={selectId}>
                <span><strong>{slotIndex + 1}</strong> {PRACTICE_SLOT_LABELS[slotIndex]}</span>
                <select
                  id={selectId}
                  aria-label={`Practice slot ${slotIndex + 1}, ${PRACTICE_SLOT_LABELS[slotIndex]}`}
                  value={skillId}
                  onChange={(event) => onSkillChange(slotIndex, event.target.value)}
                >
                  {flexible ? (
                    <>
                      <optgroup label={`${selected.character.name} exclusives`}>
                        {renderOptions(flexibleOptions, slotIndex)}
                      </optgroup>
                      <optgroup label="General abilities">
                        {renderOptions(generalOptions, slotIndex)}
                      </optgroup>
                    </>
                  ) : renderOptions(fixedOptions, slotIndex)}
                </select>
              </label>
            </div>
          );
        })}
      </div>
      <small className="practice-loadout-editor__note">
        {changed ? "Modified test kit · nothing is saved" : "Authored starting kit selected · nothing is saved"}
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
  const skills = selected.build.skills.map((id) => getSkill(id)).filter(Boolean);
  const equippedIds = useMemo(() => new Set(selected.build.skills), [selected.build.skills]);
  const futureExclusiveAbilities = useMemo(
    () => characterAbilitiesFor(selected.id).filter((ability) => !equippedIds.has(ability.id)),
    [equippedIds, selected.id],
  );
  const exclusiveGroups = useMemo(() => ({
    basics: futureExclusiveAbilities.filter((ability) => ability.abilityType === "basic-attack"),
    defenses: futureExclusiveAbilities.filter((ability) => ability.abilityType === "defensive"),
    flexible: futureExclusiveAbilities.filter((ability) => ability.abilityType === "archetype"),
  }), [futureExclusiveAbilities]);
  const generalAbilities = useMemo(
    () => generalAbilityIds().map((id) => getSkill(id)).filter(Boolean),
    [],
  );
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

          <section>
            <span className="character-details__label">How {selected.character.name.split(" ")[0]} fights</span>
            <p>{selected.playstyle}</p>
            <small>Attention · {selected.attention}</small>
          </section>

          <section className="character-details__loadout">
            <div className="character-details__section-heading">
              <span className="character-details__label">Starting abilities</span>
              <small>5 active · no shared abilities equipped</small>
            </div>
            <div className="ability-slot-contract" aria-label="Five active ability slots">
              <span><strong>1</strong> Basic attack <small>same-family replacement</small></span>
              <span><strong>2</strong> Defensive <small>same-family replacement</small></span>
              <span><strong>3–5</strong> Exclusive <small>flexible</small></span>
            </div>
            <div className="starting-abilities">
              {skills.map((skill) => (
                <StartingAbilityCard
                  key={skill.id}
                  definition={skill}
                />
              ))}
            </div>
          </section>

          <PracticeLoadoutEditor
            selected={selected}
            skillIds={testSkillIds}
            onSkillChange={onTestSkillChange}
            onReset={onResetTestSkills}
          />

          <section className="character-details__ability-library">
            <div className="character-details__section-heading">
              <span className="character-details__label">Character ability library</span>
              <small>{futureExclusiveAbilities.length} unequipped exclusives</small>
            </div>
            <p>
              Basic Attack rewards replace only slot 1; Defensive rewards replace only slot
              2. Every other character-exclusive reward can replace one of slots 3–5.
            </p>
            <div className="character-exclusive-library" aria-label={`${selected.character.name} abilities available later`}>
              <AbilityLibraryGroup label="Basic Attack replacements" abilities={exclusiveGroups.basics} availability="Exclusive Basic · available later" />
              <AbilityLibraryGroup label="Defensive replacements" abilities={exclusiveGroups.defenses} availability="Exclusive Defense · available later" />
              <AbilityLibraryGroup label="Flexible exclusive abilities" abilities={exclusiveGroups.flexible} availability="Exclusive · slots 3–5" />
            </div>
          </section>

          <section className="character-details__ability-library">
            <div className="character-details__section-heading">
              <span className="character-details__label">General ability library</span>
              <small>{generalAbilities.length} shared replacements</small>
            </div>
            <p>General rewards are never equipped at the start and may replace only slots 3–5.</p>
            <details className="character-ability-library__group">
              <summary><span>View all General abilities</span><small>{generalAbilities.length}</small></summary>
              <div className="general-ability-library" aria-label="General abilities available later">
                {generalAbilities.map((skill) => (
                  <StartingAbilityCard
                    key={skill.id}
                    definition={skill}
                    compact
                    availability="General · available later"
                  />
                ))}
              </div>
            </details>
          </section>

          <section className="character-details__passives">
            <div className="character-details__section-heading">
              <span className="character-details__label">Passive traits</span>
              <small>10 maximum · 7 ranks each</small>
            </div>
            <TraitCard definition={baseTrait} rank={baseTraitRank} />
            <div className="character-details__split">
              <div>
                <span className="character-details__label">Starting passive</span>
                <strong>{baseTrait?.name || baseTraitId} · Rank {baseTraitRank}</strong>
              </div>
              <div>
              <span className="character-details__label">Combat identity</span>
              <strong>{selected.role}</strong>
              </div>
            </div>
            <details className="character-ability-library__group">
              <summary><span>Shared and event trait pool</span><small>{sharedTraits.length}</small></summary>
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
  const changeTestSkill = (slotIndex, skillId) => {
    const nextSkillIds = [...testSkillIds];
    if (nextSkillIds.some((selectedId, index) => index !== slotIndex && selectedId === skillId)) return;
    nextSkillIds[slotIndex] = skillId;
    change({ testSkillIds: nextSkillIds });
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
          onTestSkillChange={changeTestSkill}
          onResetTestSkills={() => change({ testSkillIds: null })}
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
