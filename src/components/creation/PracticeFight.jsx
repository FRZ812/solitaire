// A practice fight, and the receipt that proves it was one.
//
// This is deliberately thin. It owns the practice session in component state — which is
// correct here and wrong everywhere else, because a practice fight is disposable by design
// and must not reach a save — and it drives that session through exactly the same command
// dispatcher a campaign fight uses. Nothing about the fight branches on being practice.
//
// When it ends, the result screen shows the things that make the result reproducible rather
// than just impressive: the scenario version, the derived seed, both checksums, and whether
// replay verified. A player will not read those. Anyone diagnosing a report of "my build
// felt wrong" will, and without them there is nothing to diagnose from.

import "./quick-start.css";
import React, { useCallback, useMemo, useState } from "react";
import { ArchetypeCombatView } from "../combat/ArchetypeCombatView.jsx";
import { resolvePlayerCombatCutout } from "../combat/archetype-combat-art.js";
import {
  dispatchCombatRuntimePlayerAction,
  sealCombatRuntimeTerminalReceipt,
} from "../../gameplay/combat/runtime.js";
import { chronicleSummary } from "../../gameplay/combat/chronicle.js";
import {
  DEFAULT_PRACTICE_ALLY_GROUP_ID,
  createPracticeSession,
  getPracticeAllyGroup,
  practiceResult,
} from "../../gameplay/combat/practice-scenarios.js";
import { getStartingArchetype } from "../../gameplay/combat/starting-archetypes.js";
import { weaponPresentationFromItemIds } from "../../gameplay/combat/weapon-presentation.js";

export function PracticeFight({
  receipt,
  scenarioId,
  allyGroupId = DEFAULT_PRACTICE_ALLY_GROUP_ID,
  skillRarities = null,
  keepsakeId = null,
  onExit,
}) {
  const archetype = getStartingArchetype(receipt?.archetypeId);
  const playerPortraitKey = archetype?.character?.portraitKey ?? null;
  const weaponPresentation = weaponPresentationFromItemIds(archetype?.gear || []);
  const [attemptIndex, setAttemptIndex] = useState(0);
  const [practice, setPractice] = useState(
    () => createPracticeSession(receipt, scenarioId, 0, { skillRarities, keepsakeId, allyGroupId }),
  );
  const [feedback, setFeedback] = useState(null);

  const allyGroup = useMemo(() => {
    const definition = getPracticeAllyGroup(allyGroupId);
    if (!practice?.allyGroup) return definition;
    return {
      ...definition,
      ...practice.allyGroup,
      allies: (practice.allyGroup.allies || definition?.allies || []).map((member) => ({
        ...(definition?.allies || []).find((entry) => entry.id === member.id),
        ...member,
      })),
    };
  }, [allyGroupId, practice?.allyGroup]);

  const allyPresentation = useMemo(() => new Map((allyGroup?.allies || []).map((member) => {
    const allyArchetype = getStartingArchetype(member.archetypeId);
    return [member.id, {
      art: resolvePlayerCombatCutout(
        allyArchetype?.character?.portraitKey,
        allyArchetype?.character,
      ),
      weapon: weaponPresentationFromItemIds(allyArchetype?.gear || []),
    }];
  })), [allyGroup]);

  const start = useCallback((index) => {
    setFeedback(null);
    setAttemptIndex(index);
    setPractice(createPracticeSession(receipt, scenarioId, index, {
      skillRarities,
      keepsakeId,
      allyGroupId,
    }));
  }, [receipt, scenarioId, skillRarities, keepsakeId, allyGroupId]);

  const dispatch = useCallback((input) => {
    setPractice((current) => {
      if (!current?.ok) return current;
      const session = current.session;
      const actorId = input.actorId ?? session.encounter.playerId;
      const result = dispatchCombatRuntimePlayerAction(session, {
        ...input,
        id: [session.sessionId, session.revision, input.type, actorId, input.skillId, input.itemId]
          .filter((part) => part !== null && part !== undefined)
          .join(":"),
        expectedRevision: session.revision,
        actorId,
      });
      if (!result.ok) {
        setFeedback(`That move was refused: ${result.reason}.`);
        return current;
      }
      setFeedback(null);
      // The verdict is sealed the moment the fight ends, exactly as in a campaign, so the
      // result screen reads a decided fight rather than judging one itself.
      const sealed = result.session.encounter.phase === "player"
        ? { ok: true, session: result.session }
        : sealCombatRuntimeTerminalReceipt(result.session);
      return { ...current, session: sealed.ok ? sealed.session : result.session };
    });
  }, []);

  const terminal = practice?.ok && practice.session.encounter.phase !== "player";
  const result = useMemo(
    () => (terminal ? practiceResult(practice) : null),
    [terminal, practice],
  );

  if (!practice?.ok) {
    return (
      <div className="practice-fight practice-fight--failed" role="alert">
        <p>That build could not open a practice fight ({practice?.reason || "unknown"}).</p>
        <button type="button" onClick={onExit}>Back</button>
      </div>
    );
  }

  if (result) {
    return (
      <section className="practice-fight practice-fight--result" aria-label="Practice result">
        <h2>
          {result.outcome === "victory"
            ? "You won that one"
            : result.outcome === "retreated" ? "You got clear" : "That one went against you"}
        </h2>
        <p className="practice-fight__summary">{chronicleSummary(result.chronicle)}</p>
        <p className="practice-fight__note">
          Nothing here was written down. Your character is exactly as you left them.
        </p>

        {/* Not for the player — for whoever has to reproduce this fight later. */}
        <dl className="practice-fight__receipt">
          <dt>Scenario</dt><dd>{result.scenarioId} v{result.scenarioVersion}</dd>
          <dt>Allied formation</dt>
          <dd>{allyGroup?.name || allyGroupId}{allyGroup?.version ? ` v${allyGroup.version}` : ""}</dd>
          <dt>Attempt</dt><dd>{result.attemptIndex}</dd>
          <dt>Seed</dt><dd><code>{result.seed}</code></dd>
          <dt>Genesis</dt><dd><code>{result.genesisChecksum}</code></dd>
          <dt>Terminal</dt><dd><code>{result.terminalChecksum}</code></dd>
          <dt>Replay</dt>
          <dd>{result.replayVerified ? "verified" : `diverged at ${result.replayDivergence?.path}`}</dd>
        </dl>

        <div className="practice-fight__actions">
          <button type="button" onClick={() => start(attemptIndex)}>Retry same seed</button>
          <button type="button" onClick={() => start(attemptIndex + 1)}>Try another seed</button>
          <button type="button" onClick={onExit}>Back to your build</button>
        </div>
      </section>
    );
  }

  return (
    <ArchetypeCombatView
      encounter={practice.session.encounter}
      note={`Practice — ${practice.scenario.name}. Nothing here is written down.`}
      playerPortraitKey={playerPortraitKey}
      artFor={(actor) => allyPresentation.get(actor.id)?.art || null}
      weaponFor={(actor) => (
        actor.id === practice.session.encounter.playerId
          ? weaponPresentation
          : allyPresentation.get(actor.id)?.weapon || null
      )}
      error={feedback}
      onEscape={onExit}
      escapeLabel="Leave practice"
      onRetreat={(actorId) => dispatch({ type: "attempt-retreat", actorId: actorId ?? null })}
      onUseSkill={(skillId, targetId, actorId, anchorCell = null) => dispatch({
        type: "use-skill", skillId, targetId: targetId ?? null, actorId: actorId ?? null, anchorCell,
      })}
      onUseItem={(itemId, targetId, actorId) => dispatch({
        type: "use-item", itemId, targetId: targetId ?? null, actorId: actorId ?? null,
      })}
      onStandDown={(actorId) => dispatch({ type: "stand-down", actorId: actorId ?? null })}
      onSettle={() => {}}
    />
  );
}

export default PracticeFight;
