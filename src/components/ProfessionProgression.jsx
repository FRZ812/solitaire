import React, { useEffect, useMemo, useRef, useState } from "react";
import { ATTR_KEYS, ATTR_LABELS } from "../config.js";
import { PROFESSIONS } from "../data/professions.js";
import { RACES } from "../data/races.js";
import * as progressionPaths from "../data/progression-paths.js";
import { getAbilityDef } from "../data/abilities.js";
import { METAMAGIC_FEATURES, PROGRESSION_FEATURES } from "../data/progression-features.js";
import * as progressionEngine from "../engine/progression.js";
import { ProfessionIcon } from "./ProfessionIcon.jsx";
import { DeckPage, DeckPageHeader } from "./DeckPage.jsx";

const PROFESSION_CAP = 70;
const RACIAL_CAP = 30;
const compileProfessionTrack = progressionPaths.compileProfessionTrack || ((professionId, options) => {
  const legacy = progressionPaths.compileProfessionBuild?.(professionId, {
    archetypeId: options?.specializationId,
    sidePath: "utility",
  });
  return legacy ? { ...legacy, totalLevels: PROFESSION_CAP, levels: legacy.levels.slice(0, PROFESSION_CAP), pendingChoices: [] } : null;
});
const compileRacialTrack = progressionPaths.compileRacialTrack || (() => ({ totalLevels: RACIAL_CAP, levels: [] }));
const professionBranchChoices = progressionPaths.professionBranchChoices || (() => []);
const professionProgressionLevel = progressionEngine.professionProgressionLevel || ((character) => {
  const tracks = character?.progression?.professions;
  if (Array.isArray(tracks)) return tracks.reduce((sum, track) => sum + Object.values(track.paths || {}).reduce((n, rank) => n + (Number(rank) || 0), 0), 0);
  return progressionEngine.progressionLevel(character);
});
const racialProgressionLevel = progressionEngine.racialProgressionLevel || ((character) => Object.values(character?.progression?.racial?.paths || {}).reduce((sum, rank) => sum + (Number(rank) || 0), 0));
const pendingLevelAllocations = progressionEngine.pendingLevelAllocations || (() => null);
const pendingProgressionChoices = progressionEngine.pendingProgressionChoices || (() => []);

function titleCase(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function grantDetails(grant) {
  if (!grant) return { name: "Unknown feature", description: "" };
  if (grant.type === "ability-choice") {
    const names = (grant.options || []).map((id) => getAbilityDef(id)?.name || titleCase(id));
    return {
      name: grant.name || `Choose ${grant.count || 1} ${grant.count === 1 ? "ability" : "abilities"}`,
      description: [grant.description, names.length ? `Options: ${names.join(" · ")}` : null].filter(Boolean).join(" "),
    };
  }
  if (grant.type === "metamagic-choice") {
    const names = (grant.options || []).map((id) => METAMAGIC_FEATURES[id]?.name || titleCase(id));
    return {
      name: grant.name || `Choose ${grant.count || 1} metamagic`,
      description: [grant.description, names.length ? `Options: ${names.join(" · ")}` : null].filter(Boolean).join(" "),
    };
  }
  if (grant.name || grant.label) return { name: grant.name || grant.label, description: grant.description || "" };
  if (grant.type === "ability") {
    const ability = getAbilityDef(grant.id);
    return { name: ability?.name || titleCase(grant.id), description: grant.description || ability?.desc || "" };
  }
  if (grant.type === "metamagic") {
    const feature = METAMAGIC_FEATURES[grant.id];
    return { name: feature?.name || titleCase(grant.id), description: grant.description || feature?.description || "" };
  }
  const feature = PROGRESSION_FEATURES[grant.id];
  return { name: feature?.name || titleCase(grant.id || grant.type), description: grant.description || feature?.description || "" };
}

function GrantList({ grants, empty = null, compact = false }) {
  if (!grants?.length) return empty;
  return (
    <ul className={`profession-progress__grant-list${compact ? " is-compact" : ""}`}>
      {grants.map((grant, index) => {
        const details = grantDetails(grant);
        return (
          <li key={`${grant.type || "feature"}-${grant.id || index}`} data-grant-type={grant.type || "feature"}>
            <small>{titleCase(grant.type || "feature")}</small>
            <strong>{details.name}</strong>
            {details.description && <span>{details.description}</span>}
          </li>
        );
      })}
    </ul>
  );
}

function treeLayout(rows) {
  const perRing = 10;
  const rings = Math.max(1, Math.ceil(rows.length / perRing));
  const size = rows.length > 30 ? 900 : 540;
  const center = size / 2;
  const ringGap = rows.length > 30 ? 53 : 58;
  const firstRadius = rows.length > 30 ? 68 : 72;
  const nodes = rows.map((row, index) => {
    const ring = Math.floor(index / perRing);
    const ringStart = ring * perRing;
    const count = Math.min(perRing, rows.length - ringStart);
    const slot = index - ringStart;
    const radius = firstRadius + ring * ringGap;
    const angle = (-Math.PI / 2) + ((slot / count) * Math.PI * 2) + ring * 0.16;
    return { row, x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius };
  });
  return { size, center, nodes };
}

function NodeSkillTree({
  rows, cap, ownedLevel = 0, kind, trackName, allocationChoice,
  allocationOptionId, unresolvedChoices = [], onSpendPoint,
}) {
  const viewportRef = useRef(null);
  const [selectedLevel, setSelectedLevel] = useState(() => Math.min(cap, Math.max(1, ownedLevel + 1)));
  const layout = useMemo(() => treeLayout(rows), [rows]);
  const selected = rows[Math.max(0, selectedLevel - 1)] || rows[0] || null;
  const option = allocationChoice?.options?.find((entry) => entry.optionId === allocationOptionId) || null;
  const blockingChoice = unresolvedChoices.find((choice) => choice.kind !== "level-allocation") || null;
  const points = allocationChoice?.unspentLevels || 0;
  const nextLevel = ownedLevel + 1;
  const canSpend = !!option && points > 0 && !blockingChoice && nextLevel <= cap;

  useEffect(() => {
    setSelectedLevel(Math.min(cap, Math.max(1, ownedLevel + 1)));
  }, [cap, ownedLevel, trackName]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
    viewport.scrollTop = Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2);
  }, [layout.size, trackName]);

  return (
    <section className="progression-tree" aria-label={`${kind} node skill tree`}>
      <div className="profession-progress__section-heading progression-tree__heading">
        <div><small>Center-out node tree</small><h3>Levels 1–{cap}</h3></div>
        <span>{ownedLevel} allocated · {points} available</span>
      </div>
      <p className="progression-tree__guide">Begin at the core and move outward. Select any node to inspect it; only the next connected node can consume a point.</p>
      <div className="progression-tree__viewport" ref={viewportRef} tabIndex={0} aria-label={`Scrollable ${trackName} tree`}>
        <div className="progression-tree__canvas" style={{ width: layout.size, height: layout.size }}>
          <svg className="progression-tree__connections" viewBox={`0 0 ${layout.size} ${layout.size}`} aria-hidden="true">
            {layout.nodes.length > 0 && (
              <line
                x1={layout.center} y1={layout.center}
                x2={layout.nodes[0].x} y2={layout.nodes[0].y}
                className={ownedLevel >= 1 ? "is-owned" : canSpend ? "is-available" : ""}
              />
            )}
            {layout.nodes.slice(1).map((node, index) => {
              const previous = layout.nodes[index];
              const targetLevel = index + 2;
              return (
                <line
                  key={`edge-${targetLevel}`}
                  x1={previous.x} y1={previous.y} x2={node.x} y2={node.y}
                  className={targetLevel <= ownedLevel ? "is-owned" : targetLevel === nextLevel && canSpend ? "is-available" : ""}
                />
              );
            })}
          </svg>
          <button type="button" className="progression-tree__core" onClick={() => setSelectedLevel(Math.max(1, Math.min(cap, ownedLevel || 1)))}>
            <strong>CORE</strong><span>{trackName}</span>
          </button>
          {layout.nodes.map(({ row, x, y }, index) => {
            const level = row?.trackLevel || row?.level || index + 1;
            const owned = level <= ownedLevel;
            const available = level === nextLevel && canSpend;
            const milestone = level % 5 === 0 || (row?.grants || row?.generalGrants || []).length > 1;
            return (
              <button
                key={`${row?.pathId || kind}-${level}`}
                type="button"
                className={`progression-tree__node${owned ? " is-owned" : available ? " is-available" : " is-locked"}${milestone ? " is-milestone" : ""}${selectedLevel === level ? " is-selected" : ""}`}
                style={{ left: x, top: y }}
                aria-label={`Level ${level} — ${row?.feature || `${titleCase(kind)} level ${level}`} — ${owned ? "allocated" : available ? "available" : "locked"}`}
                aria-pressed={selectedLevel === level}
                onClick={() => setSelectedLevel(level)}
              >
                <span>{level}</span>
                <i className="sr-only">{row?.feature || `${titleCase(kind)} level ${level}`}</i>
              </button>
            );
          })}
        </div>
      </div>
      {selected && (
        <article className="progression-tree__inspector" aria-live="polite">
          <header>
            <span>Level {selected.trackLevel || selected.level} · {selected.pathName || titleCase(selected.pathId || kind)}</span>
            <strong>{selected.feature || `${titleCase(kind)} level ${selected.trackLevel || selected.level}`}</strong>
            {selected.featureDescription && <p>{selected.featureDescription}</p>}
          </header>
          <GrantList grants={selected.generalGrants || selected.grants || []} empty={<p className="progression-tree__empty">This node advances the path without a separate grant.</p>} />
          {(selected.trackLevel || selected.level) === nextLevel && (
            <div className="progression-tree__investment">
              {blockingChoice ? (
                <span>Resolve <strong>{blockingChoice.name || titleCase(blockingChoice.id)}</strong> before moving farther.</span>
              ) : canSpend ? (
                <button type="button" onClick={() => onSpendPoint?.(allocationChoice.choiceId, allocationOptionId)}>
                  Invest 1 point in {trackName}
                </button>
              ) : (
                <span>Earn another character level to unlock this connected node.</span>
              )}
            </div>
          )}
        </article>
      )}
    </section>
  );
}

function choiceOptionDetails(choice, option) {
  const id = typeof option === "string" ? option : (option.id || option.optionId);
  if (typeof option !== "string") return { id, name: option.name || option.label || titleCase(id), description: option.description || "", grants: option.grants || option.rewards || [] };
  if (choice.type === "metamagic-choice") {
    const feature = METAMAGIC_FEATURES[id];
    return { id, name: feature?.name || titleCase(id), description: feature?.description || "", grants: [] };
  }
  const ability = getAbilityDef(id);
  return { id, name: ability?.name || PROGRESSION_FEATURES[id]?.name || titleCase(id), description: ability?.desc || PROGRESSION_FEATURES[id]?.description || "", grants: [] };
}

function PendingGrantChoices({ choices, onSelect }) {
  if (!choices.length) return null;
  return (
    <section className="progression-tree__pending" aria-label="Required node choices">
      <div className="profession-progress__section-heading"><div><small>Node decisions</small><h3>Choose before advancing</h3></div><span>{choices.length} pending</span></div>
      {choices.map((choice) => {
        const selected = new Set(choice.selectedOptions || []);
        return (
          <article key={choice.id} data-choice-id={choice.id}>
            <header><small>Level {choice.level}</small><strong>{choice.name || titleCase(choice.id)}</strong>{choice.description && <p>{choice.description}</p>}</header>
            <div>
              {(choice.options || []).map((option) => {
                const details = choiceOptionDetails(choice, option);
                return (
                  <button key={details.id} type="button" disabled={selected.has(details.id)} aria-pressed={selected.has(details.id)} onClick={() => onSelect(choice, details.id)}>
                    <strong>{details.name}</strong>{details.description && <span>{details.description}</span>}<GrantList grants={details.grants} compact />
                  </button>
                );
              })}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function BranchTree({ profession, definitions, choices, pendingIds, onSelect, trackKind = "Profession" }) {
  if (!definitions.length) return null;
  const depths = new Map();
  const depthOf = (definition) => {
    if (!definition?.parentChoiceId) return 0;
    if (depths.has(definition.id)) return depths.get(definition.id);
    const depth = 1 + depthOf(definitions.find((entry) => entry.id === definition.parentChoiceId));
    depths.set(definition.id, depth);
    return depth;
  };
  return (
    <section className="profession-progress__branches" aria-labelledby={`profession-branches-${profession.id}`}>
      <div className="profession-progress__section-heading">
        <div><small>{trackKind === "Racial" ? "Evolution branches" : "Specialization branches"}</small><h3 id={`profession-branches-${profession.id}`}>Specialized paths</h3></div>
        <span>Explicit node choices</span>
      </div>
      <p className="profession-progress__branch-intro">The shared core remains intact while these threshold nodes branch into increasingly specialized paths.</p>
      <ol className="profession-progress__branch-tree">
        {definitions.map((choice) => {
          const selected = choices[choice.id] || null;
          const pending = pendingIds.has(choice.id);
          const parentSatisfied = !choice.parentChoiceId || choices[choice.parentChoiceId] === choice.parentOptionId;
          return (
            <li
              key={choice.id}
              data-choice-id={choice.id}
              data-parent-choice={choice.parentChoiceId || undefined}
              className={`${pending ? "is-pending" : ""}${!parentSatisfied ? " is-locked" : ""}`}
              style={{ "--branch-depth": depthOf(choice) }}
            >
              <header>
                <span>{trackKind} level {choice.threshold}</span>
                <strong>{choice.name}</strong>
                {choice.description && <p>{choice.description}</p>}
                {pending && <em>Choice required</em>}
                {!parentSatisfied && <em>Requires {titleCase(choice.parentOptionId)}</em>}
              </header>
              <div>
                {(choice.options || []).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selected === option.id}
                    disabled={!parentSatisfied || (!!selected && !pending)}
                    onClick={() => onSelect(choice, option)}
                  >
                    <strong>{option.name || titleCase(option.id)}</strong>
                    {option.description && <span>{option.description}</span>}
                    <GrantList grants={option.grants || []} compact />
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ProfessionCard({ profession, currentLevel = 0, currentSpecializations = [], onOpen }) {
  const names = (profession.specializations || []).map((entry) => entry.name);
  return (
    <li className="profession-catalog__item">
      <button id={`profession-card-${profession.id}`} type="button" className="profession-card" onClick={onOpen}>
        <ProfessionIcon profession={profession.id} size="medium" decorative />
        <span className="profession-card__body">
          <span className="profession-card__eyebrow"><span>{profession.role || profession.domain || "Profession"}</span><span>{currentLevel > 0 ? `Your investment · ${currentLevel} / ${PROFESSION_CAP}` : `0–${PROFESSION_CAP} levels`}</span></span>
          <strong className="profession-card__name">{profession.name}</strong>
          <span className="profession-card__description">{profession.description}</span>
          <span className="profession-card__archetype"><small>Specialization branches</small><strong>{currentSpecializations.length ? currentSpecializations.join(" · ") : names.slice(0, 3).join(" · ") || "Authored focus paths"}</strong></span>
          <span className="profession-card__open">View profession and branches <span aria-hidden="true">→</span></span>
        </span>
      </button>
    </li>
  );
}

export function ProfessionProgression({ profession, character = null, currentTrack = null, currentLevel = 0, onBack, onChooseProgression }) {
  const [previewSpecialization, setPreviewSpecialization] = useState(currentTrack?.specializationId || null);
  const [previewChoices, setPreviewChoices] = useState(() => ({ ...(currentTrack?.branchChoices || currentTrack?.choices || {}) }));
  const headingRef = useRef(null);
  useEffect(() => headingRef.current?.focus(), [profession.id]);
  useEffect(() => {
    setPreviewSpecialization(currentTrack?.specializationId || null);
    setPreviewChoices({ ...(currentTrack?.branchChoices || currentTrack?.choices || {}) });
  }, [currentTrack, profession.id]);

  const compiled = useMemo(() => compileProfessionTrack(profession.id, {
    specializationId: previewSpecialization,
    choices: previewChoices,
    branchChoices: previewChoices,
  }), [previewChoices, previewSpecialization, profession.id]);
  const definitions = professionBranchChoices(profession.id) || [];
  const pendingChoices = currentTrack && progressionPaths.pendingProfessionChoices
    ? progressionPaths.pendingProfessionChoices(currentTrack)
    : [];
  const pendingIds = new Set(pendingChoices.map((choice) => choice.id || choice.choiceId));
  const finalAttributes = compiled?.finalAttributes || {};
  const allocationChoice = character ? pendingLevelAllocations(character) : null;
  const unresolvedChoices = character ? pendingProgressionChoices(character).filter((choice) => choice.kind !== "level-allocation") : [];
  const trackChoices = unresolvedChoices.filter((choice) => choice.professionId === profession.id);
  const grantChoices = trackChoices.filter((choice) => choice.kind === "grant");

  const chooseBranch = (choice, option) => {
    if (!pendingIds.has(choice.id) || !currentTrack) {
      setPreviewChoices((current) => ({ ...current, [choice.id]: option.id }));
      return;
    }
    onChooseProgression?.(profession.id, choice.id, option.id);
  };

  return (
    <section className="profession-progress" aria-labelledby={`profession-progress-title-${profession.id}`}>
      {onBack && <button type="button" className="profession-progress__back" onClick={onBack}>← All professions</button>}
      <header className="profession-progress__hero">
        <ProfessionIcon profession={profession.id} size="hero" decorative />
        <div className="profession-progress__identity">
          <small>Profession tree · 0–{PROFESSION_CAP}</small>
          <h2 id={`profession-progress-title-${profession.id}`} ref={headingRef} tabIndex={-1}>{profession.name}</h2>
          <p>{profession.description}</p>
        </div>
        <div className="profession-progress__total"><strong>{currentLevel}</strong><span>Invested / {PROFESSION_CAP}</span></div>
      </header>

      <section className="profession-progress__focus" aria-label="Specialization preview">
        <div><small>Branch preview</small><strong>{previewSpecialization ? (profession.specializations || []).find((entry) => entry.id === previewSpecialization)?.name || titleCase(previewSpecialization) : "General core"}</strong></div>
        <p>Preview a path, then commit to its authored specialization node when its threshold is reached.</p>
        <div className="profession-progress__specialization-options">
          <button type="button" aria-pressed={!previewSpecialization} onClick={() => setPreviewSpecialization(null)}>General core</button>
          {(profession.specializations || []).map((specialization) => (
            <button key={specialization.id} type="button" aria-pressed={previewSpecialization === specialization.id} onClick={() => setPreviewSpecialization(specialization.id)}>
              <strong>{specialization.name}</strong><span>{specialization.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="profession-progress__attributes" aria-label="Profession level 70 attributes">
        <div className="profession-progress__section-heading"><div><small>General track projection</small><h3>Level 70 attributes</h3></div><span>Before racial evolution</span></div>
        <ul>{ATTR_KEYS.map((key) => <li key={key}><span><small>{ATTR_LABELS[key]}</small><strong>{finalAttributes[key] || 0}</strong></span></li>)}</ul>
      </section>

      <NodeSkillTree
        rows={compiled?.levels || []}
        cap={PROFESSION_CAP}
        ownedLevel={currentLevel}
        kind="profession"
        trackName={profession.name}
        allocationChoice={allocationChoice}
        allocationOptionId={`profession:${profession.id}`}
        unresolvedChoices={unresolvedChoices}
        onSpendPoint={(choiceId, optionId) => onChooseProgression?.(profession.id, choiceId, optionId)}
      />
      <BranchTree profession={profession} definitions={definitions} choices={previewChoices} pendingIds={pendingIds} onSelect={chooseBranch} />
      <PendingGrantChoices choices={grantChoices} onSelect={(choice, optionId) => onChooseProgression?.(profession.id, choice.id, optionId)} />
    </section>
  );
}

export function RacialProgression({ character, raceId: raceIdOverride = null, onBack, onChooseProgression }) {
  const ownedRaceId = character?.progression?.racial?.raceId || character?.race;
  const raceId = raceIdOverride || ownedRaceId;
  const ownsRace = !!raceId && raceId === ownedRaceId;
  const racial = ownsRace ? character?.progression?.racial || null : null;
  const level = ownsRace ? racialProgressionLevel(character) : 0;
  const [previewChoices, setPreviewChoices] = useState(() => ({ ...(racial?.branchChoices || racial?.choices || {}) }));
  useEffect(() => setPreviewChoices({ ...(racial?.branchChoices || racial?.choices || {}) }), [raceId, racial?.branchChoices, racial?.choices]);
  const compiled = useMemo(() => compileRacialTrack(raceId, {
    evolutionId: racial?.evolutionId || character?.subrace || null,
    choices: previewChoices,
    branchChoices: previewChoices,
  }), [character?.subrace, previewChoices, raceId, racial?.evolutionId]);
  const definitions = progressionPaths.racialBranchChoices?.(raceId) || [];
  const pendingChoices = progressionPaths.pendingRacialBranchChoices?.(raceId, level, racial?.branchChoices || {}) || [];
  const pendingIds = new Set(pendingChoices.map((choice) => choice.id || choice.choiceId));
  const finalAttributes = compiled?.finalAttributes || {};
  const allocationChoice = character ? pendingLevelAllocations(character) : null;
  const unresolvedChoices = character ? pendingProgressionChoices(character).filter((choice) => choice.kind !== "level-allocation") : [];
  const chooseBranch = (choice, option) => {
    if (!pendingIds.has(choice.id)) {
      setPreviewChoices((current) => ({ ...current, [choice.id]: option.id }));
      return;
    }
    if (ownsRace) onChooseProgression?.(null, choice.id, option.id);
    else setPreviewChoices((current) => ({ ...current, [choice.id]: option.id }));
  };
  const race = RACES[raceId];
  return (
    <section className="profession-progress profession-progress--racial">
      {onBack && <button type="button" className="profession-progress__back" onClick={onBack}>← Race tree</button>}
      <header className="profession-progress__hero">
        <div className="profession-progress__identity"><small>Race tree · 0–{RACIAL_CAP}</small><h2>{race?.name || titleCase(raceId)}</h2><p>Lineage awakening and racial powers share the character point bank while advancing on their own dedicated tree.</p></div>
        <div className="profession-progress__total"><strong>{level}</strong><span>Invested / {RACIAL_CAP}</span></div>
      </header>
      <section className="profession-progress__attributes" aria-label="Racial level 30 attributes">
        <div className="profession-progress__section-heading"><div><small>Racial track projection</small><h3>Level 30 attributes</h3></div><span>Before profession levels</span></div>
        <ul>{ATTR_KEYS.map((key) => <li key={key}><span><small>{ATTR_LABELS[key]}</small><strong>{finalAttributes[key] || 0}</strong></span></li>)}</ul>
      </section>
      <NodeSkillTree
        rows={compiled?.levels || []}
        cap={RACIAL_CAP}
        ownedLevel={level}
        kind="racial evolution"
        trackName={`${race?.name || titleCase(raceId)} lineage`}
        allocationChoice={allocationChoice}
        allocationOptionId="racial:evolution"
        unresolvedChoices={unresolvedChoices}
        onSpendPoint={(choiceId, optionId) => onChooseProgression?.(null, choiceId, optionId)}
      />
      <BranchTree profession={{ id: raceId }} definitions={definitions} choices={previewChoices} pendingIds={pendingIds} onSelect={chooseBranch} trackKind="Racial" />
    </section>
  );
}

export function ProfessionCatalog({ character, onChooseProgression, initialProfessionId = null }) {
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("all");
  const [selectedId, setSelectedId] = useState(initialProfessionId);
  const tracks = Array.isArray(character?.progression?.professions) ? character.progression.professions : [];
  const professionLevel = professionProgressionLevel(character);
  const professions = useMemo(() => Object.values(PROFESSIONS).sort((a, b) => a.name.localeCompare(b.name)), []);
  const domains = useMemo(() => [...new Set(professions.map((entry) => entry.role || entry.domain || "general"))].sort(), [professions]);
  const visible = professions.filter((profession) => {
    const group = profession.role || profession.domain || "general";
    if (domain !== "all" && group !== domain) return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return [profession.name, profession.description, group, ...(profession.specializations || []).flatMap((entry) => [entry.name, entry.description])]
      .filter(Boolean).join(" ").toLowerCase().includes(needle);
  });

  if (selectedId && PROFESSIONS[selectedId]) {
    const track = tracks.find((entry) => entry.professionId === selectedId) || null;
    const currentLevel = track ? Object.values(track.paths || {}).reduce((sum, rank) => sum + (Number(rank) || 0), 0) : 0;
    return <ProfessionProgression profession={PROFESSIONS[selectedId]} character={character} currentTrack={track} currentLevel={currentLevel} onBack={() => setSelectedId(null)} onChooseProgression={onChooseProgression} />;
  }

  return (
    <section className="profession-catalog fade-in" aria-labelledby="profession-catalog-title">
      <header className="profession-catalog__intro"><small>Profession constellation</small><h2 id="profession-catalog-title">Choose a profession tree</h2><p>Spend up to 70 profession points across broad callings. Every calling begins at its own core and branches into authored specializations at levels 10, 30, and 50.</p></header>
      <div className="profession-catalog__tools">
        <label className="profession-catalog__search"><span>Search professions</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Profession, specialization, branch, or focus" /></label>
        <label className="profession-catalog__filter"><span>Discipline</span><select value={domain} onChange={(event) => setDomain(event.target.value)}><option value="all">All disciplines</option>{domains.map((entry) => <option key={entry} value={entry}>{titleCase(entry)}</option>)}</select></label>
      </div>
      <div className="profession-catalog__result-count" aria-live="polite">{visible.length} of {professions.length} broad professions · {professionLevel} / {PROFESSION_CAP} levels invested</div>
      <ul className="profession-catalog__list">
        {visible.map((profession) => {
          const owned = tracks.filter((entry) => entry.professionId === profession.id);
          const ownedLevel = owned.reduce((sum, track) => sum + Object.values(track.paths || {}).reduce((trackSum, rank) => trackSum + (Number(rank) || 0), 0), 0);
          const specializations = owned.map((track) => (profession.specializations || []).find((entry) => entry.id === track.specializationId)?.name || titleCase(track.specializationId)).filter(Boolean);
          return <ProfessionCard key={profession.id} profession={profession} currentLevel={ownedLevel} currentSpecializations={specializations} onOpen={() => setSelectedId(profession.id)} />;
        })}
      </ul>
    </section>
  );
}

export function ProfessionTreePage({ state, onChooseProgression }) {
  const character = state?.character;
  const activeProfessionId = progressionPaths.canonicalProfessionId?.(character?.progression?.activeProfessionId || character?.profession)
    || character?.progression?.activeProfessionId
    || character?.profession
    || null;
  const points = pendingLevelAllocations(character)?.unspentLevels || 0;
  return (
    <DeckPage className="progression-tree-page progression-tree-page--profession">
      <DeckPageHeader icon="progress" title="Profession" subtitle={`${points} unspent ${points === 1 ? "point" : "points"} · core skills · specializations`} />
      <ProfessionCatalog character={character} onChooseProgression={onChooseProgression} initialProfessionId={activeProfessionId} />
    </DeckPage>
  );
}

export function RaceTreePage({ state, onChooseProgression }) {
  const character = state?.character;
  const points = pendingLevelAllocations(character)?.unspentLevels || 0;
  return (
    <DeckPage className="progression-tree-page progression-tree-page--race">
      <DeckPageHeader icon="world" title="Race" subtitle={`${points} unspent ${points === 1 ? "point" : "points"} · lineage · evolution`} />
      <RacialProgression character={character} onChooseProgression={onChooseProgression} />
    </DeckPage>
  );
}
