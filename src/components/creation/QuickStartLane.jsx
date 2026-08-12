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
import { startingPackage, startingPackageIds } from "../../gameplay/tow/starting-packages.js";
import { PRACTICE_SCENARIOS } from "../../gameplay/tow/practice-scenarios.js";

/**
 * The six the plan names as the field-ready Quick Start cohort.
 *
 * Ordered from the most legible topology to the most demanding, because the first card is
 * the one preselected and it should be the one that explains itself fastest.
 */
export const FIELD_READY_PACKAGE_IDS = Object.freeze([
  "fighter",
  "paladin",
  "ranger",
  "rogue",
  "cleric",
  "wizard",
]);

const ROLE_BY_PACKAGE = Object.freeze({
  fighter: "Front line",
  paladin: "Shield",
  ranger: "Skirmisher",
  rogue: "Killer",
  cleric: "Sustainer",
  wizard: "Artillery",
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

export function fieldReadyPackages({ level = 1 } = {}) {
  const known = new Set(startingPackageIds());
  return FIELD_READY_PACKAGE_IDS
    .filter((id) => known.has(id))
    .map((id) => startingPackage(id, { level }))
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
  level = 1,
  onPractice,
  onBegin,
  onOtherLanes,
  busy = false,
  error = null,
}) {
  const packages = useMemo(() => fieldReadyPackages({ level }), [level]);
  const [selectedId, setSelectedId] = useState(packages[0]?.professionId ?? null);
  const [scenarioId, setScenarioId] = useState(PRACTICE_SCENARIOS[0].id);
  const selected = packages.find((pkg) => pkg.professionId === selectedId) || packages[0];

  if (!selected) return null;

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
        {packages.map((pkg) => (
          <button
            key={pkg.professionId}
            type="button"
            role="radio"
            aria-checked={pkg.professionId === selected.professionId}
            className={`quick-start__choice${pkg.professionId === selected.professionId ? " is-selected" : ""}`}
            onClick={() => setSelectedId(pkg.professionId)}
          >
            <strong>{ROLE_BY_PACKAGE[pkg.professionId] || "Fighter"}</strong>
            <span>{pkg.trait.name}</span>
          </button>
        ))}
      </div>

      {/* The five facts the plan asks for, above anything else on the card. */}
      <div className="quick-start__facts" aria-live="polite">
        <Fact label="Role">{ROLE_BY_PACKAGE[selected.professionId] || "Fighter"}</Fact>
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
          onClick={() => onPractice?.(selected.professionId, scenario.id)}
        >
          Test this build
        </button>
        <button
          type="button"
          className="quick-start__begin"
          disabled={busy}
          onClick={() => onBegin?.(selected.professionId)}
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
