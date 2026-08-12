// The Combat Lab: drive the real fight by hand, and take a fixture away with you.
//
// This is not a debug resolver. It has no rules of its own — it opens a production session,
// dispatches production commands, and reads the production Chronicle. That constraint is the
// whole point: a lab with its own shortcut resolver tells you about the lab, and the bug you
// were chasing stays where it was.
//
// What it adds is visibility and portability. Ruleset, seed, revision, checksum, the command
// list, every foe's declared intent, and the Chronicle are all on screen at once, and the
// session can be exported to JSON and read back through the same strict codec a save uses.
// A fixture exported here drops straight into an automated test, which is how a fight found
// by hand becomes a fight that stays fixed.
//
// It cannot ship. `COMBAT_LAB_ENABLED` is a build-time constant that is false in any
// production build even when the flag is set, so the whole tree is dropped from the bundle.

import "./production-combat.css";
import React, { useCallback, useMemo, useState } from "react";
import { TowCombatView } from "./TowCombatView.jsx";
import { dispatchTowCommand, towSessionEvents } from "../../gameplay/tow/commands.js";
import { buildCombatChronicle, renderCombatChronicle } from "../../gameplay/tow/chronicle.js";
import { compileCharacterBootstrap } from "../../gameplay/tow/character-bootstrap.js";
import { declaredIntents } from "../../gameplay/tow/encounter.js";
import { sealTowTerminalReceipt } from "../../gameplay/tow/outcomes.js";
import { decodeTowSession, encodeTowSession } from "../../gameplay/tow/persistence.js";
import {
  PRACTICE_SCENARIOS,
  createPracticeSession,
} from "../../gameplay/tow/practice-scenarios.js";
import { verifyTowSession } from "../../gameplay/tow/replay.js";
import { startingPackageIds } from "../../gameplay/tow/starting-packages.js";

/**
 * Open a lab session for a package and scenario.
 *
 * Exported separately from the component so fixture tests can drive the same entry point the
 * Lab's own buttons do — the plan's requirement that the Lab powers automated tests rather
 * than becoming a parallel path.
 */
export function openLabSession({ packageId, scenarioId, attemptIndex = 0 }) {
  const compiled = compileCharacterBootstrap({ professionId: packageId, origin: "fixture" });
  if (!compiled.ok) return { ok: false, reason: compiled.reason, session: null };
  const practice = createPracticeSession(compiled.receipt, scenarioId, attemptIndex);
  if (!practice.ok) return { ok: false, reason: practice.reason, session: null };
  return { ok: true, reason: null, session: practice.session, seed: practice.seed };
}

/** A session as a portable fixture, through the same codec a save crosses. */
export function exportLabFixture(session) {
  const encoded = encodeTowSession(session);
  if (!encoded.ok) return { ok: false, reason: encoded.reason, json: null };
  return { ok: true, reason: null, json: JSON.stringify(encoded.payload, null, 1) };
}

/** And back again, refusing anything the codec would refuse on load. */
export function importLabFixture(json) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: "invalid-fixture-json", session: null };
  }
  return decodeTowSession(parsed);
}

export function CombatLab({ onExit }) {
  const packages = useMemo(() => startingPackageIds().slice().sort(), []);
  const [packageId, setPackageId] = useState(packages[0]);
  const [scenarioId, setScenarioId] = useState(PRACTICE_SCENARIOS[0].id);
  const [attemptIndex, setAttemptIndex] = useState(0);
  const [opened, setOpened] = useState(() => openLabSession({
    packageId: packages[0], scenarioId: PRACTICE_SCENARIOS[0].id,
  }));
  const [fixture, setFixture] = useState("");
  const [feedback, setFeedback] = useState(null);

  const reopen = useCallback((next = {}) => {
    const request = {
      packageId: next.packageId ?? packageId,
      scenarioId: next.scenarioId ?? scenarioId,
      attemptIndex: next.attemptIndex ?? attemptIndex,
    };
    const result = openLabSession(request);
    setFeedback(result.ok ? null : `Could not open: ${result.reason}.`);
    if (result.ok) setOpened(result);
  }, [packageId, scenarioId, attemptIndex]);

  const dispatch = useCallback((input) => {
    setOpened((current) => {
      if (!current?.ok) return current;
      const session = current.session;
      const actorId = input.actorId ?? session.encounter.playerId;
      const result = dispatchTowCommand(session, {
        ...input,
        id: [session.sessionId, session.revision, input.type, actorId, input.skillId]
          .filter((part) => part !== null && part !== undefined)
          .join(":"),
        expectedRevision: session.revision,
        actorId,
      });
      if (!result.ok) {
        setFeedback(`Refused: ${result.reason}.`);
        return current;
      }
      setFeedback(null);
      const sealed = result.session.encounter.phase === "player"
        ? { ok: true, session: result.session }
        : sealTowTerminalReceipt(result.session);
      return { ...current, session: sealed.ok ? sealed.session : result.session };
    });
  }, []);

  if (!opened?.ok) {
    return (
      <div className="combat-lab" role="alert">
        <p>The lab could not open a session ({opened?.reason || "unknown"}).</p>
        <button type="button" onClick={onExit}>Close</button>
      </div>
    );
  }

  const { session } = opened;
  const verification = verifyTowSession(session);
  const chronicle = session.terminalReceipt
    ? buildCombatChronicle(session, session.terminalReceipt)
    : null;

  return (
    <div className="combat-lab" aria-label="Combat lab">
      <header className="combat-lab__bar">
        <strong>Combat Lab</strong>
        <label>
          Package
          <select
            value={packageId}
            onChange={(event) => { setPackageId(event.target.value); reopen({ packageId: event.target.value }); }}
          >
            {packages.map((id) => <option key={id} value={id}>{id}</option>)}
          </select>
        </label>
        <label>
          Fixture
          <select
            value={scenarioId}
            onChange={(event) => { setScenarioId(event.target.value); reopen({ scenarioId: event.target.value }); }}
          >
            {PRACTICE_SCENARIOS.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.name}</option>
            ))}
          </select>
        </label>
        <label>
          Attempt
          <input
            type="number"
            min="0"
            value={attemptIndex}
            onChange={(event) => {
              const next = Math.max(0, Number(event.target.value) || 0);
              setAttemptIndex(next);
              reopen({ attemptIndex: next });
            }}
          />
        </label>
        <button type="button" onClick={() => reopen()}>Reopen</button>
        <button type="button" onClick={onExit}>Close</button>
      </header>

      {feedback ? <p className="combat-lab__alert" role="alert">{feedback}</p> : null}

      <div className="combat-lab__panels">
        <section className="combat-lab__state" aria-label="Session state">
          <dl>
            <dt>Ruleset</dt><dd>{session.rulesetId}</dd>
            <dt>Mode</dt><dd>{session.mode}</dd>
            <dt>Seed</dt><dd><code>{opened.seed}</code></dd>
            <dt>Revision</dt><dd>{session.revision}</dd>
            <dt>Status</dt><dd>{session.status}</dd>
            <dt>Checksum</dt><dd><code>{session.checksum}</code></dd>
            <dt>Replay</dt>
            <dd>{verification.ok ? "verified" : `diverged at ${verification.divergence?.path}`}</dd>
          </dl>

          <h3>Declared intents</h3>
          <ul className="combat-lab__intents">
            {declaredIntents(session.encounter).map((intent) => (
              <li key={intent.enemyId}>
                {intent.enemyId} → {intent.name} ({intent.hits}×{intent.damage}) at {intent.targetName}
              </li>
            ))}
          </ul>

          <h3>Commands</h3>
          <ol className="combat-lab__commands">
            {session.commands.map((command) => (
              <li key={command.id}>
                <code>{command.seq}</code> {command.type}
                {command.skillId ? ` ${command.skillId}` : ""}
                {command.targetId ? ` → ${command.targetId}` : ""}
                {" "}<code>{command.stateChecksum}</code>
              </li>
            ))}
          </ol>

          <h3>Events</h3>
          <ol className="combat-lab__events">
            {towSessionEvents(session).slice(-12).map((event) => (
              <li key={event.eventSequence}>
                r{event.round} {event.type} <code>{event.commandId ?? "opening"}</code>
              </li>
            ))}
          </ol>

          {chronicle ? (
            <>
              <h3>Chronicle</h3>
              <pre className="combat-lab__chronicle">{renderCombatChronicle(chronicle)}</pre>
            </>
          ) : null}

          <h3>Fixture</h3>
          <div className="combat-lab__fixture">
            <button
              type="button"
              onClick={() => {
                const exported = exportLabFixture(session);
                setFeedback(exported.ok ? null : `Export refused: ${exported.reason}.`);
                if (exported.ok) setFixture(exported.json);
              }}
            >
              Export
            </button>
            <button
              type="button"
              onClick={() => {
                const imported = importLabFixture(fixture);
                setFeedback(imported.ok ? null : `Import refused: ${imported.reason}.`);
                if (imported.ok) setOpened({ ok: true, session: imported.session, seed: opened.seed });
              }}
            >
              Import
            </button>
            <textarea
              aria-label="Fixture JSON"
              value={fixture}
              onChange={(event) => setFixture(event.target.value)}
              rows={6}
            />
          </div>
        </section>

        <TowCombatView
          encounter={session.encounter}
          note={`Lab — ${packageId} vs ${scenarioId}`}
          error={feedback}
          onUseSkill={(skillId, targetId, actorId) => dispatch({
            type: "use-skill", skillId, targetId: targetId ?? null, actorId: actorId ?? null,
          })}
          onEndTurn={() => dispatch({ type: "end-turn" })}
          onStandDown={(actorId) => dispatch({ type: "stand-down", actorId: actorId ?? null })}
          onSettle={() => {}}
        />
      </div>
    </div>
  );
}

export default CombatLab;
