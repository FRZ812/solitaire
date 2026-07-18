import React, { useEffect, useMemo, useState } from "react";
import { PROFESSIONS } from "../data/professions.js";
import { RACES } from "../data/races.js";
import {
  PROFESSION_LEVEL_CAP,
  RACIAL_LEVEL_CAP,
  compileProfessionTrack,
  compileRacialTrack,
} from "../data/progression-paths.js";
import { getAbilityDef } from "../data/abilities.js";
import { METAMAGIC_FEATURES, PROGRESSION_FEATURES } from "../data/progression-features.js";
import * as progressionEngine from "../engine/progression.js";
import { DeckPage, DeckPageHeader } from "./DeckPage.jsx";
import { Icon } from "./Icon.jsx";
import { ProfessionIcon } from "./ProfessionIcon.jsx";

const pendingLevelAllocations = progressionEngine.pendingLevelAllocations || (() => null);
const pendingProgressionChoices = progressionEngine.pendingProgressionChoices || (() => []);
const professionProgressionLevel = progressionEngine.professionProgressionLevel || (() => 0);
const racialProgressionLevel = progressionEngine.racialProgressionLevel || (() => 0);

function titleCase(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function rankTotal(paths) {
  return Object.values(paths || {}).reduce((sum, rank) => sum + Math.max(0, Number(rank) || 0), 0);
}

function professionName(professionId) {
  return PROFESSIONS[professionId]?.name || titleCase(professionId);
}

function raceName(raceId) {
  return RACES[raceId]?.name || titleCase(raceId);
}

function choiceOptionId(option) {
  return typeof option === "string" ? option : option?.id || option?.optionId;
}

function choiceOptionName(option) {
  const id = choiceOptionId(option);
  if (typeof option !== "string" && (option?.name || option?.label)) return option.name || option.label;
  return getAbilityDef(id)?.name || METAMAGIC_FEATURES[id]?.name || PROGRESSION_FEATURES[id]?.name || titleCase(id);
}

function grantName(grant) {
  if (!grant) return null;
  if (grant.name || grant.label) return grant.name || grant.label;
  if (grant.type === "ability") return getAbilityDef(grant.id)?.name || titleCase(grant.id);
  if (grant.type === "metamagic") return METAMAGIC_FEATURES[grant.id]?.name || titleCase(grant.id);
  return PROGRESSION_FEATURES[grant.id]?.name || titleCase(grant.id || grant.type);
}

function currentProfessionTracks(character) {
  return Array.isArray(character?.progression?.professions) ? character.progression.professions : [];
}

function rowForOption(character, option) {
  if (!option) return null;
  if (option.track === "racial") {
    const racial = character?.progression?.racial || {};
    return compileRacialTrack(option.raceId || racial.raceId || character?.race, {
      evolutionId: racial.evolutionId || character?.subrace || null,
      branchChoices: racial.branchChoices || {},
    })?.levels?.[option.currentTrackLevel || 0] || null;
  }
  const track = currentProfessionTracks(character).find((entry) => entry.professionId === option.professionId);
  return compileProfessionTrack(option.professionId, {
    specializationId: track?.specializationId || null,
    choices: track?.choices || {},
    branchChoices: track?.branchChoices || {},
  })?.levels?.[option.currentTrackLevel || 0] || null;
}

function compactGrantNames(row) {
  return [...new Set((row?.grants || []).map(grantName).filter(Boolean))].slice(0, 4);
}

function RequiredChoice({ choice, onChooseProgression }) {
  const selected = new Set(choice.selectedOptions || []);
  const remaining = Math.max(1, Number(choice.remainingCount) || 1);
  const options = choice.options || [];
  const choiceId = choice.id || choice.choiceId;
  const owner = choice.kind === "racial-branch"
    ? raceName(choice.raceId)
    : professionName(choice.professionId);

  return (
    <section className="advancement-required" aria-labelledby={`advancement-choice-${choiceId}`}>
      <header>
        <span><Icon name="alert" size={20} /></span>
        <div>
          <small>{choice.kind === "grant" ? `${remaining} selection${remaining === 1 ? "" : "s"} remaining` : `${owner} decision`}</small>
          <h4 id={`advancement-choice-${choiceId}`}>{choice.name || "Finish advancement"}</h4>
        </div>
      </header>
      <div className="advancement-required__options">
        {options.map((option) => {
          const optionId = choiceOptionId(option);
          const optionGrants = typeof option === "string" ? [] : (option.grants || []);
          return (
            <button
              type="button"
              key={optionId}
              disabled={selected.has(optionId) || !onChooseProgression}
              onClick={() => onChooseProgression?.(choice.professionId || null, choiceId, optionId)}
            >
              <strong>{choiceOptionName(option)}</strong>
              {optionGrants.length > 0 && (
                <span>{optionGrants.map(grantName).filter(Boolean).slice(0, 3).join(" · ")}</span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function BuildSummary({ character }) {
  const tracks = currentProfessionTracks(character);
  const racial = character?.progression?.racial;
  const racialLevel = racialProgressionLevel(character);
  return (
    <div className="advancement-build" aria-label="Current character progression">
      {tracks.map((track) => (
        <span key={`${track.professionId}:${track.specializationId || "general"}`}>
          <ProfessionIcon profession={track.professionId} size="small" decorative />
          <strong>{professionName(track.professionId)}</strong>
          <b>{rankTotal(track.paths)}</b>
        </span>
      ))}
      {racial && (
        <span className="is-lineage">
          <Icon name="world" size={17} />
          <strong>{raceName(racial.raceId)}</strong>
          <b>{racialLevel}</b>
        </span>
      )}
    </div>
  );
}

function ProgressionDetails({ character, selectedOption }) {
  const tracks = currentProfessionTracks(character);
  const racial = character?.progression?.racial;
  const selectedRow = rowForOption(character, selectedOption);
  const selectedGrants = compactGrantNames(selectedRow);

  return (
    <section className="advancement-details" aria-label="Character progression details">
      {selectedOption && (
        <article className="advancement-details__selected">
          <small>Selected next level</small>
          <strong>{selectedRow?.feature || "Track advancement"}</strong>
          {selectedGrants.length > 0 && <span>{selectedGrants.join(" · ")}</span>}
        </article>
      )}
      <ul>
        {tracks.map((track) => {
          const level = rankTotal(track.paths);
          const compiled = compileProfessionTrack(track.professionId, {
            specializationId: track.specializationId || null,
            choices: track.choices || {},
            branchChoices: track.branchChoices || {},
          });
          const next = compiled?.levels?.[level];
          const specialization = PROFESSIONS[track.professionId]?.specializations?.find((entry) => entry.id === track.specializationId)?.name;
          return (
            <li key={`${track.professionId}:${track.specializationId || "general"}`}>
              <span><strong>{professionName(track.professionId)} {level}</strong>{specialization && <small>{specialization}</small>}</span>
              <em>{next ? `Next · ${next.feature}` : "Profession complete"}</em>
            </li>
          );
        })}
        {racial && (() => {
          const level = racialProgressionLevel(character);
          const next = compileRacialTrack(racial.raceId, {
            evolutionId: racial.evolutionId,
            branchChoices: racial.branchChoices || {},
          })?.levels?.[level];
          return (
            <li className="is-lineage">
              <span><strong>{raceName(racial.raceId)} {level}</strong><small>Lineage</small></span>
              <em>{next ? `Next · ${next.feature}` : "Lineage complete"}</em>
            </li>
          );
        })()}
      </ul>
    </section>
  );
}

function initialAllocationOption(allocation, character) {
  if (!allocation?.options?.length) return null;
  const activeProfession = character?.progression?.activeProfessionId || character?.profession;
  return allocation.options.find((option) => option.professionId === activeProfession)
    || allocation.options.find((option) => option.track === "profession" && option.currentTrackLevel > 0)
    || allocation.options[0];
}

function AdvancementChooser({ character, allocation, onChooseProgression }) {
  const ownedOptions = allocation.options.filter((option) => option.track === "profession" && option.currentTrackLevel > 0);
  const multiclassOptions = allocation.options.filter((option) => option.track === "profession" && option.currentTrackLevel === 0);
  const racialOption = allocation.options.find((option) => option.track === "racial") || null;
  const initial = initialAllocationOption(allocation, character);
  const [selectedId, setSelectedId] = useState(initial?.optionId || null);
  const [multiclassId, setMulticlassId] = useState(multiclassOptions[0]?.optionId || "");

  useEffect(() => {
    const next = initialAllocationOption(allocation, character);
    setSelectedId(next?.optionId || null);
    setMulticlassId(allocation.options.find((option) => option.track === "profession" && option.currentTrackLevel === 0)?.optionId || "");
  }, [allocation.choiceId, character]);

  const selectedOption = allocation.options.find((option) => option.optionId === selectedId) || null;
  const nextRow = rowForOption(character, selectedOption);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const selectedProfessionName = selectedOption?.professionId ? professionName(selectedOption.professionId) : null;
  const confirmLabel = selectedOption?.track === "racial"
    ? `Advance ${raceName(selectedOption.raceId)} lineage to level ${selectedOption.currentTrackLevel + 1}`
    : selectedOption
      ? `${selectedOption.currentTrackLevel > 0 ? "Take" : "Multiclass into"} ${selectedProfessionName}${selectedOption.currentTrackLevel > 0 ? ` level ${selectedOption.currentTrackLevel + 1}` : ""}`
      : "Choose an advancement";

  return (
    <section className="advancement-choice" aria-labelledby="advancement-choice-title">
      <header>
        <div><small>Level {allocation.level}</small><h4 id="advancement-choice-title">Choose your advancement</h4></div>
        <strong>{allocation.unspentLevels} ready</strong>
      </header>

      <div className="advancement-choice__owned" aria-label="Advance an existing profession">
        {ownedOptions.map((option) => (
          <button
            type="button"
            key={option.optionId}
            aria-pressed={selectedId === option.optionId}
            onClick={() => setSelectedId(option.optionId)}
          >
            <ProfessionIcon profession={option.professionId} size="small" decorative />
            <span><small>Advance</small><strong>{professionName(option.professionId)} {option.currentTrackLevel} → {option.currentTrackLevel + 1}</strong></span>
          </button>
        ))}
      </div>

      {multiclassOptions.length > 0 && (
        <label className={`advancement-choice__multiclass${selectedId === multiclassId ? " is-selected" : ""}`}>
          <ProfessionIcon profession={multiclassOptions.find((option) => option.optionId === multiclassId)?.professionId} size="small" decorative />
          <span>
            <small>Multiclass</small>
            <select
              aria-label="Choose a new profession to multiclass"
              value={multiclassId}
              onFocus={() => setSelectedId(multiclassId)}
              onClick={() => setSelectedId(multiclassId)}
              onChange={(event) => { setMulticlassId(event.target.value); setSelectedId(event.target.value); }}
            >
              {multiclassOptions.map((option) => <option key={option.optionId} value={option.optionId}>{professionName(option.professionId)}</option>)}
            </select>
          </span>
        </label>
      )}

      {racialOption && (
        <button
          type="button"
          className="advancement-choice__lineage"
          aria-pressed={selectedId === racialOption.optionId}
          onClick={() => setSelectedId(racialOption.optionId)}
        >
          <Icon name="world" size={25} />
          <span><small>Lineage</small><strong>{raceName(racialOption.raceId)} {racialOption.currentTrackLevel} → {racialOption.currentTrackLevel + 1}</strong></span>
        </button>
      )}

      <div className="advancement-choice__actions">
        <button
          type="button"
          className="advancement-choice__details-toggle"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((open) => !open)}
        >{detailsOpen ? "Hide details" : "View details"}</button>
        <button
          type="button"
          className="advancement-choice__confirm"
          disabled={!selectedOption || !onChooseProgression}
          aria-label={confirmLabel}
          onClick={() => onChooseProgression?.(
            selectedOption?.professionId || null,
            allocation.choiceId,
            selectedOption?.optionId,
          )}
        >
          <span>{selectedOption?.track === "racial" ? "Advance lineage" : selectedOption?.currentTrackLevel > 0 ? `Take ${selectedProfessionName} ${selectedOption.currentTrackLevel + 1}` : `Multiclass ${selectedProfessionName || ""}`}</span>
          <Icon name="arrowUp" size={18} />
        </button>
      </div>

      {!detailsOpen && nextRow && <p className="advancement-choice__next">Next · {nextRow.feature}</p>}
      {detailsOpen && <ProgressionDetails character={character} selectedOption={selectedOption} />}
    </section>
  );
}

export function ProgressionPanel({ character, onChooseProgression }) {
  const allocation = pendingLevelAllocations(character);
  const requiredChoices = pendingProgressionChoices(character).filter((choice) => choice.kind !== "level-allocation");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const emptyDetailsOption = useMemo(() => {
    const activeProfession = character?.progression?.activeProfessionId || character?.profession;
    const track = currentProfessionTracks(character).find((entry) => entry.professionId === activeProfession) || currentProfessionTracks(character)[0];
    return track ? { track: "profession", professionId: track.professionId, currentTrackLevel: rankTotal(track.paths) } : null;
  }, [character]);

  return (
    <section className="advancement-panel fade-in">
      <BuildSummary character={character} />
      {requiredChoices.length > 0 ? (
        <RequiredChoice choice={requiredChoices[0]} onChooseProgression={onChooseProgression} />
      ) : allocation ? (
        <AdvancementChooser character={character} allocation={allocation} onChooseProgression={onChooseProgression} />
      ) : (
        <section className="advancement-complete">
          <Icon name="resolve" size={28} />
          <span><strong>Progression is current</strong><small>Your next choice appears here when you level up.</small></span>
          <button type="button" aria-expanded={detailsOpen} onClick={() => setDetailsOpen((open) => !open)}>{detailsOpen ? "Hide details" : "View details"}</button>
        </section>
      )}
      {!allocation && requiredChoices.length === 0 && detailsOpen && (
        <ProgressionDetails character={character} selectedOption={emptyDetailsOption} />
      )}
    </section>
  );
}

export function ProgressionPage({ state, onChooseProgression }) {
  const character = state?.character;
  const allocation = pendingLevelAllocations(character);
  const requiredChoices = pendingProgressionChoices(character).filter((choice) => choice.kind !== "level-allocation");
  const ready = allocation?.unspentLevels || 0;
  const invested = professionProgressionLevel(character) + racialProgressionLevel(character);
  const subtitle = requiredChoices.length > 0
    ? "Finish your pending advancement"
    : ready > 0
      ? `${ready} advancement${ready === 1 ? "" : "s"} ready · ${invested} allocated`
      : `${invested} allocated · details available`;

  return (
    <DeckPage className="progression-page">
      <DeckPageHeader icon="progression" title="Progression" subtitle={subtitle} />
      <ProgressionPanel character={character} onChooseProgression={onChooseProgression} />
    </DeckPage>
  );
}
