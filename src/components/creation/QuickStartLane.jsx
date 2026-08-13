// The single new-campaign start surface.
//
// Browse complete authored characters, then preview one. Identity and mechanics are fixed
// together; there is no name, portrait, or build assembly step. The controlled draft lives
// in App so a disposable practice fight returns to the same character preview.

import "./archetype-start.css";
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import winterScene from "../../assets/generated/scene-whitemarch-v2.webp";
import { resolveCharacterPortrait } from "../character-portrait-assets.js";
import { getSkill } from "../../gameplay/tow/skills.js";
import { getFusion, getTrait } from "../../gameplay/tow/traits.js";
import { PRACTICE_SCENARIOS } from "../../gameplay/tow/practice-scenarios.js";
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

  return (
    <>
      <button type="button" className="character-details__scrim" aria-label="Close character details" onClick={onClose} />
      <aside className="character-details" aria-label={`${selected.character.name} details`}>
        <header>
          <div>
            <span>{selected.power} · {selected.name}</span>
            <h2>Character details</h2>
          </div>
          <button type="button" className="character-details__close" aria-label="Close character details" onClick={onClose}>×</button>
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

          <section className="character-details__split">
            <div>
              <span className="character-details__label">Core actions</span>
              <div className="character-details__chips">
                {skills.map((skill) => <span key={skill.id}>{skill.name}</span>)}
              </div>
            </div>
            <div>
              <span className="character-details__label">Innate passive</span>
              <strong>{baseTrait?.name || baseTraitId}</strong>
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

  useEffect(() => setDetailsOpen(false), [selected.id]);
  useEffect(() => {
    if (!normalized.preview) return;
    rootRef.current?.scrollTo?.({ top: 0, behavior: "auto" });
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
                <ArrowIcon direction="left" /> Journeys
              </button>
            ) : <span />}
            <div>
              <span>Begin a new journey</span>
              <h1>Choose your character</h1>
              <p>Eight complete lives. Each carries a fixed story, combat style, equipment, and fusions.</p>
            </div>
            <span aria-hidden="true" />
          </header>

          <div className="character-choice-grid" role="listbox" aria-label="Available characters">
            {STARTING_ARCHETYPES.map((entry, index) => (
              <button
                type="button"
                role="option"
                aria-selected="false"
                className="character-choice-card"
                style={{ "--character-accent": entry.color }}
                key={entry.id}
                onClick={() => selectCharacter(entry, index, true)}
              >
                <img src={portraitFor(entry)} alt="" />
                <span className="character-choice-card__shade" />
                <span className="character-choice-card__copy">
                  <small>{entry.power} · {entry.name}</small>
                  <strong>{entry.character.name}</strong>
                  <span>{entry.character.epithet}</span>
                </span>
                <span className="character-choice-card__open" aria-hidden="true"><ArrowIcon /></span>
              </button>
            ))}
          </div>

          <p className="character-grid-view__hint">Select a portrait to preview the complete character.</p>
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
            <ArrowIcon direction="left" /> All characters
          </button>
          <span>{selected.power} origin</span>
          {onQuit ? <button type="button" className="character-preview__close" aria-label="Back to journeys" onClick={onQuit}>×</button> : <span />}
        </header>

        <main className="character-preview__stage">
          <figure className="character-preview__portrait">
            <img src={portraitFor(selected)} alt={`${selected.character.name}, ${selected.character.epithet}`} />
            <span aria-hidden="true" />
          </figure>

          <div className="character-preview__copy">
            <p className="character-preview__kind">{selected.name} · {selected.role}</p>
            <h1>{selected.character.name}</h1>
            <h2>{selected.character.epithet}</h2>
            <p className="character-preview__summary">{selected.character.summary}</p>
            <div className="character-preview__trait">
              <span>Starting trait</span>
              <strong>{baseTrait?.name || Object.keys(selected.build.traits)[0]}</strong>
              <small>Rank {Object.values(selected.build.traits)[0]}</small>
            </div>

            {error ? <p className="character-preview__alert" role="alert">{error}</p> : null}

            <div className="character-preview__actions">
              <button type="button" className="character-preview__details-button" aria-expanded={detailsOpen} onClick={() => setDetailsOpen(true)}>
                Details & practice
              </button>
              <button type="button" className="character-preview__begin" disabled={busy} onClick={() => onBegin?.(normalized)}>
                <span>Start journey</span>
                <small>Enter Whitemarch</small>
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
                  <img src={portraitFor(entry)} alt="" />
                  <span>{entry.character.name}</span>
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
