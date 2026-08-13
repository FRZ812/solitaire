// The single new-campaign start surface.
//
// A combat archetype is not a legacy template person: mechanics, face, and name are three
// independent choices. The whole draft is controlled by App so entering practice and coming
// back cannot reset it.

import "./archetype-start.css";
import React, { useMemo, useState } from "react";
import { resolveCharacterPortrait } from "../character-portrait-assets.js";
import { getSkill } from "../../gameplay/tow/skills.js";
import { getFusion, getTrait } from "../../gameplay/tow/traits.js";
import { PRACTICE_SCENARIOS } from "../../gameplay/tow/practice-scenarios.js";
import {
  STARTING_ARCHETYPES,
  STARTING_VISAGES,
  archetypeFusionIds,
  archetypeItemRows,
  createDefaultArchetypeDraft,
  getStartingArchetype,
  getStartingVisage,
  normalizeArchetypeDraft,
} from "../../gameplay/tow/starting-archetypes.js";

function portraitFor(visage) {
  return resolveCharacterPortrait({ portraitKey: visage?.portraitKey });
}

function updateDraft(current, patch) {
  return normalizeArchetypeDraft({ ...current, ...patch });
}

function DetailLabel({ children }) {
  return <span className="archetype-start__label">{children}</span>;
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
  const visage = getStartingVisage(normalized.visageId) || STARTING_VISAGES[0];
  const [scenarioId, setScenarioId] = useState(PRACTICE_SCENARIOS[0].id);

  const items = useMemo(() => archetypeItemRows(selected.id), [selected.id]);
  const fusionIds = useMemo(() => archetypeFusionIds(selected.id), [selected.id]);
  const baseTraitId = Object.keys(selected.build.traits)[0];
  const baseTrait = getTrait(baseTraitId);
  const skills = selected.build.skills.map((id) => getSkill(id)).filter(Boolean);
  const canBegin = normalized.name.length > 0 && !busy;

  const change = (patch) => onDraftChange?.(updateDraft(normalized, patch));

  return (
    <section className="archetype-start" role="dialog" aria-modal="true" aria-label="Choose your beginning">
      <div className="archetype-start__mist" aria-hidden="true" />
      <div className="archetype-start__shell">
        <header className="archetype-start__header">
          <div>
            <p className="archetype-start__eyebrow">A new soul enters Avarra</p>
            <h1>Choose what you become</h1>
            <p>
              Pick a combat archetype, then make the person your own. Power comes from
              equipment, passives, and forged fusions—not a character level.
            </p>
          </div>
          {onQuit ? (
            <button type="button" className="archetype-start__leave" onClick={onQuit}>
              Back to journeys
            </button>
          ) : null}
        </header>

        <div className="archetype-start__layout">
          <div className="archetype-start__catalog">
            <div className="archetype-start__section-heading">
              <div><span>01</span><h2>Choose your archetype</h2></div>
              <p>Every path is complete and ready to test.</p>
            </div>

            <div className="archetype-start__cards" role="radiogroup" aria-label="Combat archetype">
              {STARTING_ARCHETYPES.map((entry) => {
                const portrait = portraitFor(getStartingVisage(entry.portraitId));
                const active = entry.id === selected.id;
                return (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    key={entry.id}
                    className={`archetype-card${active ? " is-selected" : ""}`}
                    style={{ "--archetype-accent": entry.color }}
                    onClick={() => change({ archetypeId: entry.id })}
                  >
                    {portrait ? <img src={portrait} alt="" /> : <span className="archetype-card__empty" />}
                    <span className="archetype-card__shade" />
                    <span className="archetype-card__copy">
                      <span className="archetype-card__power">{entry.power}</span>
                      <strong>{entry.name}</strong>
                      <small>{entry.role}</small>
                    </span>
                    <span className="archetype-card__check" aria-hidden="true">✓</span>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="archetype-start__review" style={{ "--archetype-accent": selected.color }}>
            <div className="archetype-start__hero">
              {portraitFor(visage) ? <img src={portraitFor(visage)} alt={`Selected ${visage.label} appearance`} /> : null}
              <div className="archetype-start__hero-shade" />
              <div className="archetype-start__hero-copy">
                <span>{selected.power} · {selected.role}</span>
                <h2>{selected.name}</h2>
                <p>{selected.tagline}</p>
              </div>
            </div>

            <div className="archetype-start__review-body">
              <div className="archetype-start__identity">
                <div className="archetype-start__identity-heading">
                  <div><span>02</span><h3>Name and face</h3></div>
                  <small>Appearance never changes mechanics.</small>
                </div>
                <label className="archetype-start__name">
                  <span>Your name</span>
                  <input
                    value={normalized.name}
                    maxLength={48}
                    autoComplete="off"
                    placeholder="Name this character"
                    onChange={(event) => change({ name: event.target.value })}
                  />
                </label>
                <div className="archetype-start__faces" role="radiogroup" aria-label="Character appearance">
                  {STARTING_VISAGES.map((entry) => {
                    const portrait = portraitFor(entry);
                    const active = entry.id === visage.id;
                    return (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={entry.label}
                        title={entry.label}
                        className={active ? "is-selected" : ""}
                        key={entry.id}
                        onClick={() => change({ visageId: entry.id })}
                      >
                        {portrait ? <img src={portrait} alt="" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="archetype-start__mechanics">
                <div className="archetype-start__playstyle">
                  <DetailLabel>How it plays</DetailLabel>
                  <p>{selected.playstyle}</p>
                  <span className="archetype-start__attention">Attention · {selected.attention}</span>
                </div>

                <div className="archetype-start__loadout">
                  <DetailLabel>Core actions</DetailLabel>
                  <div className="archetype-start__chips">
                    {skills.map((skill) => <span key={skill.id}>{skill.name}</span>)}
                  </div>
                </div>

                <div className="archetype-start__trait">
                  <DetailLabel>Innate passive</DetailLabel>
                  <strong>{baseTrait?.name || baseTraitId}</strong>
                  <p>{baseTrait?.effect?.status?.replace(/-/g, " ")} · {baseTrait?.cadence?.type?.replace(/-/g, " ")}</p>
                </div>

                <div className="archetype-start__relics">
                  <div className="archetype-start__relic-heading">
                    <DetailLabel>Starting equipment</DetailLabel>
                    <span>{items.length} worn</span>
                  </div>
                  <div className="archetype-start__item-list">
                    {items.map((item) => (
                      <article key={item.id}>
                        <div><strong>{item.name}</strong><span>{item.tier.replace(/-/g, " ")}</span></div>
                        <p>{item.passive}</p>
                      </article>
                    ))}
                  </div>
                </div>

                <div className={`archetype-start__fusions${fusionIds.length ? " has-fusions" : ""}`}>
                  <DetailLabel>Starting fusions</DetailLabel>
                  {fusionIds.length ? (
                    <div>
                      {fusionIds.map((id) => {
                        const fusion = getFusion(id);
                        return <span key={id}>{fusion?.name || id}</span>;
                      })}
                    </div>
                  ) : <p>None forged yet. This path earns them in play.</p>}
                </div>
              </div>

              <div className="archetype-start__practice">
                <label htmlFor="archetype-practice">Practice encounter</label>
                <select
                  id="archetype-practice"
                  value={scenarioId}
                  onChange={(event) => setScenarioId(event.target.value)}
                >
                  {PRACTICE_SCENARIOS.map((scenario) => (
                    <option key={scenario.id} value={scenario.id}>{scenario.name} · {scenario.difficulty}</option>
                  ))}
                </select>
              </div>

              {error ? <p className="archetype-start__alert" role="alert">{error}</p> : null}

              <div className="archetype-start__actions">
                <button
                  type="button"
                  className="archetype-start__test"
                  disabled={busy}
                  onClick={() => onPractice?.(normalized, scenarioId)}
                >
                  Test this build
                  <span>Disposable practice</span>
                </button>
                <button
                  type="button"
                  className="archetype-start__begin"
                  disabled={!canBegin}
                  onClick={() => onBegin?.(normalized)}
                >
                  Enter Whitemarch
                  <span>{canBegin ? `as ${normalized.name}` : "Name required"}</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

export default QuickStartLane;
