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
import { createSkillState, getSkill } from "../../gameplay/tow/skills.js";
import { getFusion, getTrait } from "../../gameplay/tow/traits.js";
import { PRACTICE_SCENARIOS } from "../../gameplay/tow/practice-scenarios.js";
import {
  weaponPresentationForForm,
  weaponPresentationFromItemIds,
} from "../../gameplay/tow/weapon-presentation.js";
import { weaponAttackSummary } from "../../gameplay/tow/weapon-techniques.js";
import { resolveTowAbilityArt, resolveTowActionName } from "../combat/tow-combat-ability-art.js";
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
  const ancestry = entry?.character?.subrace
    ? `${titleCase(entry.character.subrace)} ${titleCase(entry.character.race)}`
    : titleCase(entry?.character?.race);
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
    if (effect.type === "shield") return `${amount}% ${effect.scale.toUpperCase()} ward`;
    if (effect.type === "heal-lost-fraction") return `Restore ${amount}% of lost health`;
    if (effect.type === "scaled-status") return `${amount}% ${effect.scale.toUpperCase()} ${effect.status}`;
    if (effect.type === "status") return `${amount} ${effect.status}`;
    if (effect.type === "reduce-statuses") return `Cleanse ${effect.statuses.join(", ")}`;
    return effect.type.replace(/-/g, " ");
  });
  return readable.join(" · ") || "Passive combat effect";
}

function StartingAbilityCard({ definition, weaponPresentation = null, compact = false }) {
  const state = createSkillState(definition.id, 1);
  const name = resolveTowActionName(definition, weaponPresentation);
  const summary = definition.id === "strike"
    ? weaponAttackSummary(weaponPresentation?.attackSnapshot, state.rank)
    : nonStrikeSummary(definition, state.rank);
  return (
    <article className={`starting-ability${compact ? " is-compact" : ""}`} data-skill-id={definition.id}>
      <span className="starting-ability__art">
        <img src={resolveTowAbilityArt(definition, weaponPresentation)} alt="" />
        <span aria-hidden="true" />
      </span>
      <div>
        <span>{definition.consumesTurn ? "Action" : "Swift · keeps action"}</span>
        <strong>{name}</strong>
        <p>{summary}</p>
      </div>
    </article>
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

function CharacterDetails({ selected, scenarioId, onScenarioChange, onPractice, onClose, busy }) {
  const items = useMemo(() => archetypeItemRows(selected.id), [selected.id]);
  const fusionIds = useMemo(() => archetypeFusionIds(selected.id), [selected.id]);
  const baseTraitId = Object.keys(selected.build.traits)[0];
  const baseTrait = getTrait(baseTraitId);
  const skills = selected.build.skills.map((id) => getSkill(id)).filter(Boolean);
  const weaponPresentation = useMemo(
    () => weaponPresentationFromItemIds(selected.gear),
    [selected.gear],
  );
  const refinements = weaponPresentation.forms.filter((entry) => entry.id !== weaponPresentation.activeFormId);

  return (
    <>
      <button type="button" className="character-details__scrim" aria-label="Close character details" onClick={onClose} />
      <aside className="character-details" aria-label={`${selected.character.name} details`}>
        <header>
          <div>
            <span>{selected.power} · {selected.name}</span>
            <h2>Character details</h2>
          </div>
          <button type="button" className="character-details__close" aria-label="Close character details" onClick={onClose}>
            <Icon name="x" size={16} strokeWidth={1.6} />
          </button>
        </header>

        <div className="character-details__body">
          <section className="character-details__story">
            <h3>{selected.character.epithet}</h3>
            <p>{selected.character.history}</p>
          </section>

          <section>
            <span className="character-details__label">How {selected.character.name.split(" ")[0]} fights</span>
            <p>{selected.playstyle}</p>
            <small>Attention · {selected.attention}</small>
          </section>

          <section className="character-details__loadout">
            <div className="character-details__section-heading">
              <span className="character-details__label">Starting abilities</span>
              <small>Exact combat loadout</small>
            </div>
            <div className="starting-abilities">
              {skills.map((skill) => (
                <StartingAbilityCard
                  key={skill.id}
                  definition={skill}
                  weaponPresentation={skill.id === "strike" ? weaponPresentation : null}
                />
              ))}
            </div>
          </section>

          <section className="character-details__refinements">
            <div className="character-details__section-heading">
              <span className="character-details__label">Basic attack lineage</span>
              <small>Choices, not mandatory replacements</small>
            </div>
            <div className="weapon-lineage-current">
              <span>Equipped now · ranks 1–6</span>
              <strong>{weaponPresentation.actionName}</strong>
              <p>{weaponPresentation.activeForm.description}</p>
            </div>
            {refinements.length ? (
              <div className="weapon-refinements">
                {refinements.map((form) => {
                  const preview = weaponPresentationForForm(weaponPresentation, form.id);
                  return (
                    <article key={form.id}>
                      <img src={resolveTowAbilityArt(getSkill("strike"), preview)} alt="" />
                      <div>
                        <span>Possible refinement · {form.role}</span>
                        <strong>{form.name}</strong>
                        <p>{weaponAttackSummary(preview.attackSnapshot, 1)}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </section>

          <section className="character-details__split">
            <div>
              <span className="character-details__label">Innate passive</span>
              <strong>{baseTrait?.name || baseTraitId}</strong>
            </div>
            <div>
              <span className="character-details__label">Combat identity</span>
              <strong>{weaponPresentation.weaponName}</strong>
            </div>
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
  const baseTrait = getTrait(Object.keys(selected.build.traits)[0]);
  const previewWeapon = useMemo(
    () => weaponPresentationFromItemIds(selected.gear),
    [selected.gear],
  );

  useEffect(() => setDetailsOpen(false), [selected.id]);
  useEffect(() => {
    if (!normalized.preview) return;
    rootRef.current?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
  }, [normalized.preview, selected.id]);

  const change = (patch) => onDraftChange?.(updateDraft(normalized, patch));
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
              <p>Eight lives. One road north.</p>
            </div>
            <span aria-hidden="true" />
          </header>

          <div className="character-choice-grid" role="listbox" aria-label="Available characters">
            {STARTING_ARCHETYPES.map((entry, index) => (
              <button
                type="button"
                role="option"
                aria-selected="false"
                aria-label={`${entry.character.name}, ${characterKind(entry)}`}
                className="character-choice-card"
                style={{ "--character-accent": entry.color }}
                key={entry.id}
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
      style={{ "--character-accent": selected.color }}
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
                aria-label={`Starting trait: ${baseTrait?.name || Object.keys(selected.build.traits)[0]}`}
              >
                <span aria-hidden="true">✦</span>
                <strong>{baseTrait?.name || Object.keys(selected.build.traits)[0]}</strong>
              </div>

              <div className="character-preview__starting-actions" aria-label="Starting abilities">
                {selected.build.skills.slice(0, 3).map((skillId) => {
                  const definition = getSkill(skillId);
                  if (!definition) return null;
                  const weapon = skillId === "strike" ? previewWeapon : null;
                  const actionName = resolveTowActionName(definition, weapon);
                  return (
                    <button
                      type="button"
                      key={skillId}
                      title={actionName}
                      onClick={() => setDetailsOpen(true)}
                      aria-label={`View ${actionName} details`}
                    >
                      <img src={resolveTowAbilityArt(definition, weapon)} alt="" />
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="is-more"
                  title="Full loadout"
                  aria-label="Open full loadout"
                  onClick={() => setDetailsOpen(true)}
                >
                  <Icon name="alert" size={16} strokeWidth={1.7} />
                </button>
              </div>
            </div>

            {error ? <p className="character-preview__alert" role="alert">{error}</p> : null}

            <div className="character-preview__actions">
              <button type="button" className="character-preview__details-button" aria-expanded={detailsOpen} onClick={() => setDetailsOpen(true)}>
                Details
              </button>
              <button type="button" className="character-preview__begin" disabled={busy} onClick={() => onBegin?.(normalized)}>
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
                  style={{ "--character-accent": entry.color }}
                  key={entry.id}
                  ref={(node) => { thumbnailRefs.current[index] = node; }}
                  onClick={() => selectCharacter(entry, index, true)}
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
