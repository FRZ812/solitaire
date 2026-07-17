import React, { useEffect, useMemo, useRef, useState } from "react";
import { ATTR_KEYS, ATTR_LABELS } from "../config.js";
import { PROFESSIONS } from "../data/professions.js";
import { RACES } from "../data/races.js";
import * as progressionPaths from "../data/progression-paths.js";
import { getAbilityDef } from "../data/abilities.js";
import { METAMAGIC_FEATURES, PROGRESSION_FEATURES } from "../data/progression-features.js";
import * as progressionEngine from "../engine/progression.js";
import { ProfessionIcon } from "./ProfessionIcon.jsx";

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

function LevelTimeline({ rows, cap, ownedLevel = 0, kind }) {
  const [openBands, setOpenBands] = useState(() => new Set([0]));
  const bands = Array.from({ length: Math.ceil(cap / 10) }, (_, index) => rows.slice(index * 10, index * 10 + 10));
  const allOpen = bands.every((_, index) => openBands.has(index));
  const toggle = (index) => setOpenBands((current) => {
    const next = new Set(current);
    if (next.has(index)) next.delete(index); else next.add(index);
    return next;
  });
  return (
    <section className="profession-progress__timeline" aria-label={`${kind} level progression`}>
      <div className="profession-progress__section-heading profession-progress__timeline-heading">
        <div><small>Every level</small><h3>Levels 1–{cap}</h3></div>
        <button type="button" onClick={() => setOpenBands(allOpen ? new Set() : new Set(bands.map((_, index) => index)))}>
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>
      <div className="profession-progress__bands">
        {bands.map((band, index) => {
          const start = index * 10 + 1;
          const end = Math.min(cap, start + 9);
          const open = openBands.has(index);
          const grantCount = band.reduce((sum, row) => sum + (row?.generalGrants || row?.grants || []).length, 0);
          return (
            <section key={start} className={`profession-progress__band${open ? " is-open" : ""}`}>
              <button type="button" className="profession-progress__band-toggle" onClick={() => toggle(index)} aria-expanded={open}>
                <span><strong>Levels {start}–{end}</strong><small>{grantCount} typed rewards</small></span><b aria-hidden="true">{open ? "−" : "+"}</b>
              </button>
              {open && (
                <ol start={start} className="profession-progress__level-list">
                  {band.map((row, offset) => {
                    const level = row?.trackLevel || row?.level || start + offset;
                    const general = row?.generalGrants || row?.grants || [];
                    return (
                      <li key={level} value={level} className={level <= ownedLevel ? "is-attained" : ""}>
                        <span className="profession-progress__level-number">{level}</span>
                        <div>
                          <span className="profession-progress__level-meta">{row?.pathName || `${titleCase(kind)} training`} · rank {row?.rank || level}</span>
                          <strong>{row?.feature || `${titleCase(kind)} level ${level}`}</strong>
                          <GrantList grants={general} compact />
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          );
        })}
      </div>
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
        <div><small>{trackKind === "Racial" ? "Evolution overlays" : "Specialization overlays"}</small><h3 id={`profession-branches-${profession.id}`}>Branch thresholds</h3></div>
        <span>Never chosen automatically</span>
      </div>
      <p className="profession-progress__branch-intro">General {trackKind.toLowerCase()} rewards always remain visible. Branch rewards layer onto that shared track only after an explicit choice.</p>
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

export function ProfessionProgression({ profession, currentTrack = null, currentLevel = 0, onBack, onChooseProgression }) {
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

  const chooseBranch = (choice, option) => {
    if (!pendingIds.has(choice.id) || !currentTrack) {
      setPreviewChoices((current) => ({ ...current, [choice.id]: option.id }));
      return;
    }
    onChooseProgression?.(profession.id, choice.id, option.id);
  };

  return (
    <section className="profession-progress" aria-labelledby={`profession-progress-title-${profession.id}`}>
      <button type="button" className="profession-progress__back" onClick={onBack}>← Progression catalog</button>
      <header className="profession-progress__hero">
        <ProfessionIcon profession={profession.id} size="hero" decorative />
        <div className="profession-progress__identity">
          <small>Broad profession · 0–{PROFESSION_CAP}</small>
          <h2 id={`profession-progress-title-${profession.id}`} ref={headingRef} tabIndex={-1}>{profession.name}</h2>
          <p>{profession.description}</p>
        </div>
        <div className="profession-progress__total"><strong>{currentLevel}</strong><span>Invested / {PROFESSION_CAP}</span></div>
      </header>

      <section className="profession-progress__focus" aria-label="Specialization preview">
        <div><small>Specialization overlay</small><strong>{previewSpecialization ? (profession.specializations || []).find((entry) => entry.id === previewSpecialization)?.name || titleCase(previewSpecialization) : "General profession"}</strong></div>
        <p>Specializations add rewards at authored thresholds; they do not replace the shared profession track.</p>
        <div className="profession-progress__specialization-options">
          <button type="button" aria-pressed={!previewSpecialization} onClick={() => setPreviewSpecialization(null)}>General rewards</button>
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

      <BranchTree profession={profession} definitions={definitions} choices={previewChoices} pendingIds={pendingIds} onSelect={chooseBranch} />
      <LevelTimeline rows={compiled?.levels || []} cap={PROFESSION_CAP} ownedLevel={currentLevel} kind="profession" />
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
      <button type="button" className="profession-progress__back" onClick={onBack}>← Progression catalog</button>
      <header className="profession-progress__hero">
        <div className="profession-progress__identity"><small>Racial evolution · 0–{RACIAL_CAP}</small><h2>{race?.name || titleCase(raceId)}</h2><p>Metamorphosis, lineage awakening, and racial powers advance separately from the combined profession budget.</p></div>
        <div className="profession-progress__total"><strong>{level}</strong><span>Invested / {RACIAL_CAP}</span></div>
      </header>
      <section className="profession-progress__attributes" aria-label="Racial level 30 attributes">
        <div className="profession-progress__section-heading"><div><small>Racial track projection</small><h3>Level 30 attributes</h3></div><span>Before profession levels</span></div>
        <ul>{ATTR_KEYS.map((key) => <li key={key}><span><small>{ATTR_LABELS[key]}</small><strong>{finalAttributes[key] || 0}</strong></span></li>)}</ul>
      </section>
      <BranchTree profession={{ id: raceId }} definitions={definitions} choices={previewChoices} pendingIds={pendingIds} onSelect={chooseBranch} trackKind="Racial" />
      <LevelTimeline rows={compiled?.levels || []} cap={RACIAL_CAP} ownedLevel={level} kind="racial evolution" />
    </section>
  );
}

export function ProfessionCatalog({ character, onChooseProgression }) {
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const tracks = Array.isArray(character?.progression?.professions) ? character.progression.professions : [];
  const professionLevel = professionProgressionLevel(character);
  const racialLevel = racialProgressionLevel(character);
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

  if (selectedId?.startsWith("__racial__:")) {
    return <RacialProgression character={character} raceId={selectedId.slice("__racial__:".length)} onBack={() => setSelectedId(null)} onChooseProgression={onChooseProgression} />;
  }
  if (selectedId && PROFESSIONS[selectedId]) {
    const track = tracks.find((entry) => entry.professionId === selectedId) || null;
    const currentLevel = track ? Object.values(track.paths || {}).reduce((sum, rank) => sum + (Number(rank) || 0), 0) : 0;
    return <ProfessionProgression profession={PROFESSIONS[selectedId]} currentTrack={track} currentLevel={currentLevel} onBack={() => setSelectedId(null)} onChooseProgression={onChooseProgression} />;
  }

  return (
    <section className="profession-catalog fade-in" aria-labelledby="profession-catalog-title">
      <header className="profession-catalog__intro"><small>Layered progression</small><h2 id="profession-catalog-title">Professions &amp; specializations</h2><p>Up to 70 combined profession levels sit beside a separate 30-level racial evolution track. Multiclass freely; every specialization is an authored branch, never a silent default.</p></header>
      {character?.race && (
        <button type="button" className="profession-catalog__racial-card" onClick={() => setSelectedId(`__racial__:${character.progression?.racial?.raceId || character.race}`)}>
          <span><small>Separate racial track</small><strong>{RACES[character.race]?.name || titleCase(character.race)} evolution</strong><em>{racialLevel} / {RACIAL_CAP} levels</em></span><b>View evolution →</b>
        </button>
      )}
      <section className="profession-catalog__racial-directory" aria-labelledby="racial-evolution-directory-title">
        <div className="profession-progress__section-heading">
          <div><small>Separate 30-level tracks</small><h3 id="racial-evolution-directory-title">Racial evolutions</h3></div>
          <span>{Object.keys(progressionPaths.RACIAL_PROFILES || RACES).length} ancestries</span>
        </div>
        <p>Browse every ancestry's racial abilities, metamorphosis milestones, and nested evolution branches independently of profession levels.</p>
        <ul>
          {Object.entries(progressionPaths.RACIAL_PROFILES || RACES).sort(([, a], [, b]) => a.name.localeCompare(b.name)).map(([raceId, race]) => {
            const current = raceId === (character?.progression?.racial?.raceId || character?.race);
            return (
              <li key={raceId}>
                <button type="button" onClick={() => setSelectedId(`__racial__:${raceId}`)}>
                  <span><strong>{race.name}</strong><small>{current ? `${racialLevel} / ${RACIAL_CAP} invested` : `${RACIAL_CAP} authored levels`}</small></span>
                  <b aria-hidden="true">→</b>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
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
