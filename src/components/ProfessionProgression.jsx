import React, { useEffect, useMemo, useRef, useState } from "react";
import { ATTRIBUTE_CAP, ATTR_KEYS, ATTR_LABELS, CHARACTER_LEVEL_CAP } from "../config.js";
import { PROFESSIONS } from "../data/professions.js";
import {
  PROFESSION_BUILDS,
  PROFESSION_PROFILES,
  PROGRESSION_PATHS,
  PATH_GRADE_CAPS,
  compileProfessionBuild,
  levelTier,
} from "../data/progression-paths.js";
import { ProfessionIcon } from "./ProfessionIcon.jsx";

const GRADE_CAPS = Object.freeze([
  { grade: "standard", cap: PATH_GRADE_CAPS.standard, label: "Standard" },
  { grade: "advanced", cap: PATH_GRADE_CAPS.advanced, label: "Advanced" },
  { grade: "specialized", cap: PATH_GRADE_CAPS.specialized, label: "Specialized" },
]);

function titleCase(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatPrerequisite(requirement, segments = []) {
  if (requirement.pathId) {
    const path = PROGRESSION_PATHS[requirement.pathId];
    const segment = segments.find((entry) => entry.pathId === requirement.pathId);
    return `${path?.name || segment?.pathName || titleCase(requirement.pathId)} rank ${requirement.rank || 1}`;
  }
  if (requirement.totalLevel != null) return `Total level ${requirement.totalLevel}`;
  return "Authored prerequisite";
}

function formatAttributeGains(gains) {
  return Object.entries(gains || {})
    .map(([key, value]) => `+${value} ${ATTR_LABELS[key] || titleCase(key)}`)
    .join(" · ");
}

function compileSafely(professionId, sidePath, archetypeId) {
  try {
    return { compiled: compileProfessionBuild(professionId, { sidePath, archetypeId }), error: null };
  } catch (error) {
    return { compiled: null, error };
  }
}

function bandSummary(rows) {
  const paths = [...new Set(rows.map((row) => row.pathName))];
  return paths.join(" · ");
}

function ProfessionCard({ profession, profile, current = false, currentLevel = 0, currentArchetype = null, onOpen }) {
  const currentArchetypeLabel = currentArchetype === PROFESSION_BUILDS[profession.id]?.archetypePathId
    ? profile.archetype
    : titleCase(currentArchetype);
  return (
    <li className="profession-catalog__item">
      <button
        id={`profession-card-${profession.id}`}
        type="button"
        className="profession-card"
        onClick={onOpen}
        aria-label={`Open ${profession.name}, ${profile.archetype} archetype, 100-level progression`}
      >
        <ProfessionIcon profession={profession.id} size="medium" decorative />
        <span className="profession-card__body">
          <span className="profession-card__eyebrow">
            <span>{titleCase(profile.domain)}</span>
            <span>{current ? `Your path · level ${currentLevel} · ${levelTier(currentLevel).label}` : "100 levels"}</span>
          </span>
          <strong className="profession-card__name">{profession.name}</strong>
          <span className="profession-card__description">{profession.description}</span>
          <span className="profession-card__archetype">
            <small>Specialized archetype</small>
            <strong>{current && currentArchetype ? currentArchetypeLabel : profile.archetype}</strong>
          </span>
          <span className="profession-card__open">View stacked progression <span aria-hidden="true">→</span></span>
        </span>
      </button>
    </li>
  );
}

export function ProfessionProgression({
  profession,
  defaultSidePath = "racial",
  currentProfessionId = null,
  currentLevel = 0,
  currentArchetypeId = null,
  currentPaths = {},
  onBack,
}) {
  const profile = PROFESSION_PROFILES[profession.id];
  const build = PROFESSION_BUILDS[profession.id];
  const [sidePath, setSidePath] = useState(defaultSidePath === "utility" ? "utility" : "racial");
  const [openBands, setOpenBands] = useState(() => new Set([0]));
  const headingRef = useRef(null);
  const { compiled, error } = useMemo(
    () => compileSafely(
      profession.id,
      sidePath,
      currentProfessionId === profession.id ? currentArchetypeId : null,
    ),
    [currentArchetypeId, currentProfessionId, profession.id, sidePath],
  );

  useEffect(() => {
    headingRef.current?.focus();
  }, [profession.id]);

  useEffect(() => {
    setOpenBands(new Set([0]));
  }, [profession.id, sidePath]);

  if (!profile || !build || !compiled) {
    return (
      <section className="profession-progress profession-progress--error" aria-live="polite">
        <button type="button" className="profession-progress__back" onClick={onBack}>← All professions</button>
        <h2 tabIndex={-1} ref={headingRef}>Progression unavailable</h2>
        <p>{error?.message || `${profession.name} does not yet have a canonical progression build.`}</p>
      </section>
    );
  }

  const bands = Array.from({ length: 10 }, (_, index) => compiled.levels.slice(index * 10, index * 10 + 10));
  const allBandsOpen = bands.every((_, index) => openBands.has(index));
  const isCurrentPath = currentProfessionId === profession.id;
  const branchIndex = build.allocations.findIndex((allocation) => allocation.choice === "racial-or-utility");
  const branchSegment = compiled.segments[branchIndex];
  const archetypeIndex = build.allocations.findIndex((allocation) => allocation.role === "archetype");
  const archetypeSegment = compiled.segments[archetypeIndex];
  const ownedSidePath = defaultSidePath === "utility" ? "utility" : "racial";
  const viewingOwnedBranch = isCurrentPath && sidePath === ownedSidePath;

  const toggleBand = (index) => {
    setOpenBands((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <section className="profession-progress" aria-labelledby={`profession-progress-title-${profession.id}`}>
      <button type="button" className="profession-progress__back" onClick={onBack}>← All professions</button>

      <header className="profession-progress__hero">
        <ProfessionIcon profession={profession.id} size="hero" decorative />
        <div className="profession-progress__identity">
          <small>{titleCase(profile.domain)} profession</small>
          <h2 id={`profession-progress-title-${profession.id}`} ref={headingRef} tabIndex={-1}>{profession.name}</h2>
          <p>{profession.description}</p>
        </div>
        <div className="profession-progress__total" aria-label={`${compiled.totalLevels} total levels`}>
          <strong>{compiled.totalLevels}</strong>
          <span>Total levels</span>
          {isCurrentPath && <small>Your level {currentLevel}</small>}
        </div>
      </header>

      <div className="profession-progress__focus">
        <div>
          <small>Specialized archetype</small>
          <strong>{compiled.archetype}</strong>
        </div>
        <p>{archetypeSegment?.description || profile.archetypeDescription}</p>
      </div>

      <section className="profession-progress__grade-section" aria-labelledby={`profession-grade-title-${profession.id}`}>
        <div className="profession-progress__section-heading">
          <div>
            <small>Path law</small>
            <h3 id={`profession-grade-title-${profession.id}`}>Grade rank caps</h3>
          </div>
          <span>No path reaches 100 alone</span>
        </div>
        <div className="profession-progress__grades">
          {GRADE_CAPS.map(({ grade, cap, label }) => (
            <div key={grade} data-grade={grade}>
              <strong>{cap}</strong>
              <span>{label}</span>
              <small>rank cap</small>
            </div>
          ))}
        </div>
      </section>

      <fieldset className="profession-progress__branch">
        <legend>Racial or utility branch</legend>
        <p>
          Levels {branchSegment?.start || 41}–{branchSegment?.end || 50} share one ten-rank budget.
          Choose lineage growth or worldly breadth; both still count toward level 100.
        </p>
        <div>
          <button type="button" aria-pressed={sidePath === "racial"} onClick={() => setSidePath("racial")}>
            <strong>Racial levels</strong>
            <span>{PROGRESSION_PATHS[build.allocations[branchIndex]?.pathId]?.name || "Awakened Lineage"}</span>
          </button>
          <button type="button" aria-pressed={sidePath === "utility"} onClick={() => setSidePath("utility")}>
            <strong>Utility levels</strong>
            <span>{PROGRESSION_PATHS[build.allocations[branchIndex]?.alternatePathId]?.name || "Worldly Versatility"}</span>
          </button>
        </div>
      </fieldset>

      <section className="profession-progress__segments" aria-labelledby={`profession-stack-title-${profession.id}`}>
        <div className="profession-progress__section-heading">
          <div>
            <small>Exact allocation</small>
            <h3 id={`profession-stack-title-${profession.id}`}>Stacked paths</h3>
          </div>
          <span>{compiled.segments.length} paths · {compiled.totalLevels} ranks</span>
        </div>
        <ol>
          {compiled.segments.map((segment, index) => {
            const path = PROGRESSION_PATHS[segment.pathId] || segment;
            const allocation = build.allocations[index];
            const alternativeId = allocation?.choice === "racial-or-utility"
              ? (sidePath === "racial" ? allocation.alternatePathId : allocation.pathId)
              : null;
            const alternative = alternativeId ? PROGRESSION_PATHS[alternativeId] : null;
            return (
              <li key={`${segment.pathId}-${index}`} data-kind={segment.kind} data-grade={segment.grade}>
                <span className="profession-progress__range">{segment.start}–{segment.end}</span>
                <div>
                  <div className="profession-progress__segment-title">
                    <strong>{segment.pathName}</strong>
                    <span>{titleCase(segment.kind)} · {titleCase(segment.grade)} · {segment.ranks}/{path?.maxRank || segment.ranks}</span>
                  </div>
                  {path?.description && <p>{path.description}</p>}
                  {path?.prerequisites?.length > 0 && (
                    <span className="profession-progress__prerequisites">
                      <small>Requires</small> {path.prerequisites.map((requirement) => formatPrerequisite(requirement, compiled.segments)).join(" · ")}
                    </span>
                  )}
                  {alternative && (
                    <span className="profession-progress__alternative">
                      {isCurrentPath
                        ? viewingOwnedBranch
                          ? `Your chosen ${sidePath} branch · alternative: ${alternative.name}`
                          : `Alternative ${sidePath} branch preview · your path uses ${ownedSidePath}`
                        : `Viewing ${sidePath} branch · alternative: ${alternative.name}`}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="profession-progress__attributes" aria-labelledby={`profession-attributes-title-${profession.id}`}>
        <div className="profession-progress__section-heading">
          <div>
            <small>Level 100 projection</small>
            <h3 id={`profession-attributes-title-${profession.id}`}>Final attributes</h3>
          </div>
          <span>Cap {ATTRIBUTE_CAP}</span>
        </div>
        <ul>
          {ATTR_KEYS.map((key) => {
            const value = compiled.finalAttributes[key] || 0;
            return (
              <li key={key}>
                <span><small>{ATTR_LABELS[key]}</small><strong>{value}</strong></span>
                <meter min="0" max={ATTRIBUTE_CAP} value={value} aria-label={`${ATTR_LABELS[key]} ${value} of ${ATTRIBUTE_CAP}`}>{value}</meter>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="profession-progress__timeline" aria-labelledby={`profession-timeline-title-${profession.id}`}>
        <div className="profession-progress__section-heading profession-progress__timeline-heading">
          <div>
            <small>Every rank</small>
            <h3 id={`profession-timeline-title-${profession.id}`}>Levels 1–100</h3>
          </div>
          <button
            type="button"
            onClick={() => setOpenBands(allBandsOpen ? new Set() : new Set(bands.map((_, index) => index)))}
          >
            {allBandsOpen ? "Collapse all" : "Expand all"}
          </button>
        </div>
        <div className="profession-progress__bands">
          {bands.map((rows, index) => {
            const open = openBands.has(index);
            const start = rows[0]?.level || index * 10 + 1;
            const end = rows.at(-1)?.level || start + 9;
            const panelId = `profession-level-band-${profession.id}-${sidePath}-${index}`;
            return (
              <section key={start} className={`profession-progress__band${open ? " is-open" : ""}`}>
                <button
                  type="button"
                  className="profession-progress__band-toggle"
                  onClick={() => toggleBand(index)}
                  aria-expanded={open}
                  aria-controls={panelId}
                >
                  <span><strong>Levels {start}–{end}</strong><small>{bandSummary(rows)}</small></span>
                  <b aria-hidden="true">{open ? "−" : "+"}</b>
                </button>
                {open && (
                  <ol id={panelId} start={start} className="profession-progress__level-list">
                    {rows.map((row) => {
                      const attained = isCurrentPath && (currentPaths[row.pathId] || 0) >= row.rank;
                      return (
                        <li key={row.level} value={row.level} className={attained ? "is-attained" : ""}>
                          <span className="profession-progress__level-number">{row.level}</span>
                          <div>
                            <span className="profession-progress__level-meta">
                              {row.pathName} · {titleCase(row.kind)} {titleCase(row.grade)} · rank {row.rank}/{row.maxRank}
                            </span>
                            <strong>{row.feature}</strong>
                            <span className="profession-progress__level-gains">{formatAttributeGains(row.attributeGains)}</span>
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
    </section>
  );
}

export function ProfessionCatalog({ character }) {
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const returnFocusId = useRef(null);
  const currentProfessionId = character?.progression?.professionId || character?.profession || null;
  const currentArchetypeId = character?.progression?.archetypeId || character?.archetype || null;
  const currentLevel = Math.min(CHARACTER_LEVEL_CAP, Math.max(0, Object.values(character?.progression?.paths || {})
    .reduce((total, rank) => total + Math.max(0, Math.floor(Number(rank) || 0)), 0)));
  const defaultSidePath = character?.progression?.sidePath || (character?.race === "human" ? "utility" : "racial");

  const professions = useMemo(() => Object.values(PROFESSIONS)
    .filter((profession) => PROFESSION_PROFILES[profession.id] && PROFESSION_BUILDS[profession.id])
    .sort((a, b) => a.name.localeCompare(b.name)), []);
  const domains = useMemo(() => [...new Set(professions.map((profession) => PROFESSION_PROFILES[profession.id].domain))]
    .sort((a, b) => a.localeCompare(b)), [professions]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return professions.filter((profession) => {
      const profile = PROFESSION_PROFILES[profession.id];
      if (domain !== "all" && profile.domain !== domain) return false;
      if (!needle) return true;
      return [
        profession.name,
        profession.description,
        profile.domain,
        profile.archetype,
        profile.archetypeDescription,
        profile.utility,
        profile.signature,
      ].filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [domain, professions, query]);

  const openProfession = (professionId) => {
    returnFocusId.current = professionId;
    setSelectedId(professionId);
  };
  const closeProfession = () => {
    const focusId = returnFocusId.current;
    setSelectedId(null);
    requestAnimationFrame(() => document.getElementById(`profession-card-${focusId}`)?.focus());
  };

  if (selectedId && PROFESSIONS[selectedId]) {
    return (
      <ProfessionProgression
        profession={PROFESSIONS[selectedId]}
        defaultSidePath={defaultSidePath}
        currentProfessionId={currentProfessionId}
        currentLevel={currentLevel}
        currentArchetypeId={currentArchetypeId}
        currentPaths={character?.progression?.paths || {}}
        onBack={closeProfession}
      />
    );
  }

  return (
    <section className="profession-catalog fade-in" aria-labelledby="profession-catalog-title">
      <header className="profession-catalog__intro">
        <small>Stacked callings</small>
        <h2 id="profession-catalog-title">Professions & archetypes</h2>
        <p>Every profession reaches level 100 by combining capped standard, advanced, and specialized paths with racial or utility levels.</p>
      </header>

      <div className="profession-catalog__tools">
        <label className="profession-catalog__search">
          <span>Search professions</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, domain, archetype, or focus"
          />
        </label>
        <label className="profession-catalog__filter">
          <span>Domain</span>
          <select value={domain} onChange={(event) => setDomain(event.target.value)}>
            <option value="all">All domains</option>
            {domains.map((entry) => <option key={entry} value={entry}>{titleCase(entry)}</option>)}
          </select>
        </label>
      </div>

      <div className="profession-catalog__result-count" aria-live="polite">
        {visible.length} of {professions.length} canonical professions
      </div>

      {visible.length > 0 ? (
        <ul className="profession-catalog__list">
          {visible.map((profession) => (
            <ProfessionCard
              key={profession.id}
              profession={profession}
              profile={PROFESSION_PROFILES[profession.id]}
              current={currentProfessionId === profession.id}
              currentLevel={currentLevel}
              currentArchetype={currentArchetypeId}
              onOpen={() => openProfession(profession.id)}
            />
          ))}
        </ul>
      ) : (
        <div className="profession-catalog__empty">
          <strong>No professions match this view.</strong>
          <span>Try another domain or a broader search.</span>
        </div>
      )}
    </section>
  );
}
