// Quick Start: pick a way of fighting, try it, then go.
//
// The old creation hub asks a player to choose a combat identity from a description and
// find out what it means twenty minutes later, in a fight they cannot leave. This lane puts
// the five things that actually decide the choice above the fold — role, opening trait,
// the actions you will be pressing, how rationed they are, and how much attention the build
// wants — and then offers to let them go and use it.
//
// The field-ready set is a release cohort, not a list of favourites. A package appears here
// only when every capability it starts with has an executable support entry, which is why
// the component derives the list by asking rather than by holding a hand-written array: a
// package that loses support stops being offered instead of silently shipping broken.

import "./quick-start.css";
import React, { useMemo, useState } from "react";
import { getSkill, usesPerAct, UNLIMITED_USES } from "../../gameplay/tow/skills.js";
import { startingPackage } from "../../gameplay/tow/starting-packages.js";
import { PRACTICE_SCENARIOS } from "../../gameplay/tow/practice-scenarios.js";
import { CHARACTER_TEMPLATES } from "../../data/templates.js";

/**
 * The six the plan names as the field-ready Quick Start cohort.
 *
 * These are authored people, not bare packages: each carries its own identity, origin and
 * actual level, and Quick Start commits that person rather than a normalised stand-in.
 * Sellsword leads because its Strike/Block/Ironclad topology is the most legible, and the
 * first card is the one preselected.
 */
export const FIELD_READY_TEMPLATE_IDS = Object.freeze([
  "sellsword",
  "knight-errant",
  "ranger",
  "cutthroat",
  "devout",
  "hedge-mage",
]);

const ROLE_BY_TEMPLATE = Object.freeze({
  sellsword: "Front line",
  "knight-errant": "Shield",
  ranger: "Skirmisher",
  cutthroat: "Killer",
  devout: "Sustainer",
  "hedge-mage": "Artillery",
});

/**
 * How rationed a package's actions are, in words.
 *
 * The number that matters to a player is not "thirty uses of Block" but "you will run out
 * of the good options before the day is over, and only a real night's rest gives them back".
 */
function resourceCadence(pkg) {
  const limited = pkg.skills.filter((skill) => usesPerAct(skill.id, 1) !== UNLIMITED_USES);
  if (limited.length === 0) return "Nothing rationed — every action is always available.";
  const total = limited.reduce((sum, skill) => sum + usesPerAct(skill.id, 1), 0);
  return `${total} rationed uses across ${limited.length} action${limited.length === 1 ? "" : "s"}, back only after a full rest.`;
}

/** How much attention the build wants, derived from its own shape rather than asserted. */
function complexity(pkg) {
  const turnFree = pkg.skills.filter((skill) => !skill.consumesTurn).length;
  const cooldowns = pkg.skills.filter((skill) => skill.cooldown > 0).length;
  const score = pkg.skills.length + turnFree * 2 + cooldowns;
  if (score <= 5) return "Straightforward";
  if (score <= 8) return "Some upkeep";
  return "Demanding";
}

/** A template's actual authored level; practice scales by fixture, never by flattening people. */
export function templateLevel(template) {
  const paths = template.setup.progression?.paths || {};
  return Object.values(paths).reduce((total, rank) => total + (Number(rank) || 0), 0) || 1;
}

/**
 * The cohort, each template paired with the Tower of Winter package it will actually fight
 * with. A template whose package cannot be resolved is dropped rather than offered, so
 * losing support for something stops the advertisement instead of shipping it broken.
 */
export function fieldReadyStarts() {
  return FIELD_READY_TEMPLATE_IDS
    .map((id) => CHARACTER_TEMPLATES.find((template) => template.id === id))
    .filter(Boolean)
    .map((template) => {
      const level = templateLevel(template);
      const pkg = startingPackage(template.setup.profession, { level });
      return pkg ? { template, package: pkg, level } : null;
    })
    .filter(Boolean);
}

function Fact({ label, children }) {
  return (
    <div className="quick-start__fact">
      <span className="quick-start__fact-label">{label}</span>
      <span className="quick-start__fact-value">{children}</span>
    </div>
  );
}

export function QuickStartLane({
  onPractice,
  onBegin,
  onOtherLanes,
  busy = false,
  error = null,
}) {
  const starts = useMemo(() => fieldReadyStarts(), []);
  const [selectedId, setSelectedId] = useState(starts[0]?.template.id ?? null);
  const [scenarioId, setScenarioId] = useState(PRACTICE_SCENARIOS[0].id);
  const start = starts.find((entry) => entry.template.id === selectedId) || starts[0];

  if (!start) return null;

  const selected = start.package;
  const trait = selected.trait;
  const scenario = PRACTICE_SCENARIOS.find((entry) => entry.id === scenarioId)
    || PRACTICE_SCENARIOS[0];

  return (
    <section className="quick-start" aria-label="Quick start">
      <header className="quick-start__header">
        <h2>Start fighting</h2>
        <p>
          Six ways of handling yourself, each ready to play. Try one before you commit to it —
          the practice fight runs on the same rules as the real thing and changes nothing.
        </p>
      </header>

      <div className="quick-start__choices" role="radiogroup" aria-label="Starting package">
        {starts.map((entry) => (
          <button
            key={entry.template.id}
            type="button"
            role="radio"
            aria-checked={entry.template.id === start.template.id}
            className={`quick-start__choice${entry.template.id === start.template.id ? " is-selected" : ""}`}
            onClick={() => setSelectedId(entry.template.id)}
          >
            <strong>{entry.template.label}</strong>
            <span>{ROLE_BY_TEMPLATE[entry.template.id]} · {entry.package.trait.name}</span>
          </button>
        ))}
      </div>

      {/* The five facts the plan asks for, above anything else on the card. */}
      <div className="quick-start__facts" aria-live="polite">
        <Fact label="Role">{ROLE_BY_TEMPLATE[start.template.id]} — {start.template.label}, level {start.level}</Fact>
        <Fact label="Opens with">
          {trait.name} at rank {trait.rank} — {trait.effect.status} on {trait.cadence.type.replace(/-/g, " ")}
        </Fact>
        <Fact label="Your actions">
          {selected.skills.map((skill) => getSkill(skill.id)?.name || skill.name).join(" · ")}
        </Fact>
        <Fact label="How rationed">{resourceCadence(selected)}</Fact>
        <Fact label="Attention">{complexity(selected)}</Fact>
      </div>

      <div className="quick-start__scenario">
        <label htmlFor="quick-start-scenario">Practice against</label>
        <select
          id="quick-start-scenario"
          value={scenario.id}
          onChange={(event) => setScenarioId(event.target.value)}
        >
          {PRACTICE_SCENARIOS.map((entry) => (
            <option key={entry.id} value={entry.id}>{entry.name} — {entry.summary}</option>
          ))}
        </select>
      </div>

      {error ? <p className="quick-start__alert" role="alert">{error}</p> : null}

      <div className="quick-start__actions">
        <button
          type="button"
          className="quick-start__try"
          disabled={busy}
          onClick={() => onPractice?.(start, scenario.id)}
        >
          Test this build
        </button>
        <button
          type="button"
          className="quick-start__begin"
          disabled={busy}
          onClick={() => onBegin?.(start)}
        >
          Begin the journey
        </button>
      </div>

      {onOtherLanes ? (
        <button type="button" className="quick-start__other" onClick={onOtherLanes}>
          Choose a life, or forge your own
        </button>
      ) : null}
    </section>
  );
}

export default QuickStartLane;
