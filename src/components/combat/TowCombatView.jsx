import React, { useEffect, useRef, useState } from "react";
import { declaredIntents } from "../../gameplay/tow/encounter.js";
import { getSkill, skillLegality, usesPerAct, UNLIMITED_USES } from "../../gameplay/tow/skills.js";
import "./production-combat.css";

function percent(value, max) {
  return Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
}

/**
 * What this foe has declared for the coming round.
 *
 * The point of the whole telegraph is that this is readable before the player spends their
 * turn, so it says the attack's name, how many times it lands, and for how much — and stops
 * there. Crit, dodge and the player's own defence are still live, which is the part their
 * decision is meant to influence.
 */
function IntentLine({ intent }) {
  if (!intent) return null;
  const total = intent.hits > 1 ? ` (${intent.hits} × ${intent.damage})` : "";
  return (
    <p className="production-combat__intent">
      <span className="production-combat__eyebrow">Next</span>
      <strong>{intent.name}</strong>
      <span>
        {intent.hits > 1 ? `${intent.hits} hits${total}` : `${intent.damage} damage`}
      </span>
    </p>
  );
}

function StatusList({ actor }) {
  if (actor.statuses.length === 0) return null;
  return (
    <ul className="production-combat__statuses" aria-label={`${actor.name} statuses`}>
      {actor.statuses.map((status) => (
        <li key={status.type}>{status.type.replace(/-/g, " ")} <strong>{status.count}</strong></li>
      ))}
    </ul>
  );
}

function fighterBody(actor, label, intent = null) {
  return (
    <>
      <span className="production-combat__eyebrow">{label}</span>
      <h2>{actor.name}</h2>
      <IntentLine intent={intent} />
      <div
        className="production-combat__health"
        role="meter"
        aria-label={`${actor.name} health`}
        aria-valuemin="0"
        aria-valuemax={actor.maxHp}
        aria-valuenow={actor.hp}
      >
        <span style={{ width: `${percent(actor.hp, actor.maxHp)}%` }} />
      </div>
      <p className="production-combat__vital">
        <strong>{actor.hp} / {actor.maxHp}</strong> HP
        {actor.shield > 0 ? <span> · {actor.shield} shield</span> : null}
        {actor.hp <= 0 ? <span> · down</span> : null}
      </p>
      <StatusList actor={actor} />
    </>
  );
}

function skillHint(skillState) {
  const definition = getSkill(skillState.id);
  const limit = usesPerAct(skillState.id, skillState.rank);
  const parts = [];
  if (limit !== UNLIMITED_USES) parts.push(`${skillState.usesRemaining}/${limit}`);
  if (skillState.cooldownRemaining > 0) parts.push(`cd ${skillState.cooldownRemaining}`);
  if (!definition.consumesTurn) parts.push("free");
  return parts.join(" · ");
}

export function TowCombatView({
  encounter,
  onUseSkill,
  onEndTurn,
  onSettle,
  note,
  error,
  returnFocusSelector = ".story-input__field",
}) {
  const firstActionRef = useRef(null);
  const settleRef = useRef(null);
  const restoreFocusRef = useRef(null);
  const [targetId, setTargetId] = useState(null);

  const player = encounter.actors[encounter.playerId];
  const enemies = encounter.enemyIds.map((id) => encounter.actors[id]);
  const living = enemies.filter((enemy) => enemy.hp > 0);
  const terminal = encounter.phase !== "player";
  const activeTarget = living.find((enemy) => enemy.id === targetId)?.id || living[0]?.id || null;
  // Once the fight is over there is nothing coming, so the telegraphs go quiet rather than
  // advertising a round that will never be played.
  const intents = terminal
    ? {}
    : Object.fromEntries(declaredIntents(encounter).map((intent) => [intent.enemyId, intent]));

  useEffect(() => {
    restoreFocusRef.current = document.activeElement;
    return () => {
      const restoreTarget = restoreFocusRef.current;
      queueMicrotask(() => {
        if (
          restoreTarget?.isConnected
          && restoreTarget !== document.body
          && restoreTarget !== document.documentElement
          && typeof restoreTarget.focus === "function"
        ) {
          restoreTarget.focus();
          return;
        }
        requestAnimationFrame(() => {
          const fallback = typeof returnFocusSelector === "string"
            ? document.querySelector(returnFocusSelector)
            : null;
          fallback?.focus?.();
        });
      });
    };
  }, [returnFocusSelector]);

  useEffect(() => {
    (terminal ? settleRef.current : firstActionRef.current)?.focus();
  }, [terminal]);

  function keepFocusInside(event) {
    if (event.key !== "Tab") return;
    const focusable = [...event.currentTarget.querySelectorAll(
      "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex='-1'])",
    )].filter((element) => !element.closest("[inert]") && element.getAttribute("aria-hidden") !== "true");
    if (focusable.length === 0) {
      event.preventDefault();
      event.currentTarget.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && (document.activeElement === first || !event.currentTarget.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="production-combat tow-combat"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tow-combat-title"
      tabIndex="-1"
      onKeyDown={keepFocusInside}
    >
      <div className="production-combat__backdrop" aria-hidden="true" />
      <main className="production-combat__panel">
        <header className="production-combat__header">
          <span className="production-combat__eyebrow">
            Round {encounter.round}
            {!terminal && encounter.turn.actionsRemaining > 1
              ? ` · ${encounter.turn.actionsRemaining} actions`
              : null}
          </span>
          <h1 id="tow-combat-title">
            {terminal ? (encounter.phase === "victory" ? "Victory" : "Defeat") : "Combat"}
          </h1>
          {note ? <p>{note}</p> : null}
        </header>

        <div className="production-combat__fighters">
          <section className="production-combat__fighter" aria-label={`You: ${player.name}`}>
            {fighterBody(player, "You")}
          </section>
          <div className="production-combat__versus" aria-hidden="true">VS</div>
          <div className="production-combat__foes">
            {enemies.map((enemy) => (
              living.length > 1 && !terminal ? (
                <button
                  key={enemy.id}
                  type="button"
                  className={`production-combat__fighter production-combat__fighter--target${enemy.id === activeTarget ? " is-selected" : ""}`}
                  aria-label={`Target ${enemy.name}`}
                  aria-pressed={enemy.id === activeTarget}
                  disabled={enemy.hp <= 0}
                  onClick={() => setTargetId(enemy.id)}
                >
                  {fighterBody(enemy, "Foe", intents[enemy.id])}
                </button>
              ) : (
                <section key={enemy.id} className="production-combat__fighter" aria-label={`Foe: ${enemy.name}`}>
                  {fighterBody(enemy, "Foe", intents[enemy.id])}
                </section>
              )
            ))}
          </div>
        </div>

        {error ? <p className="production-combat__alert" role="alert">{error}</p> : null}

        {!terminal ? (
          <>
            <div className="production-combat__actions" aria-label="Combat actions">
              {encounter.build.skills.map((skillState, index) => {
                const definition = getSkill(skillState.id);
                const legality = skillLegality(skillState, {
                  turnAvailable: encounter.turn.actionsRemaining > 0,
                });
                return (
                  <button
                    key={skillState.id}
                    ref={index === 0 ? firstActionRef : null}
                    type="button"
                    className="production-combat__action"
                    disabled={!legality.ok}
                    onClick={() => onUseSkill(skillState.id, activeTarget)}
                  >
                    <strong>{definition.name}</strong>
                    <span>{skillHint(skillState)}</span>
                  </button>
                );
              })}
            </div>
            <button type="button" className="production-combat__settle" onClick={onEndTurn}>
              End turn
            </button>
          </>
        ) : (
          <section className="production-combat__outcome" aria-live="assertive">
            <p>
              {encounter.phase === "victory"
                ? "The last of them goes down."
                : "A last blow lands, and the world tips into black."}
            </p>
            <button ref={settleRef} type="button" className="production-combat__settle" onClick={onSettle}>
              Apply aftermath
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

export default TowCombatView;
