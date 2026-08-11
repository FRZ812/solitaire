import React, { useEffect, useMemo, useRef } from "react";
import "./production-combat.css";

function hpPercent(actor) {
  return Math.max(0, Math.min(100, (actor.hp / actor.maxHp) * 100));
}

function FighterCard({ actor, label }) {
  return (
    <section className="production-combat__fighter" aria-label={`${label}: ${actor.name}`}>
      <span className="production-combat__eyebrow">{label}</span>
      <h2>{actor.name}</h2>
      <div
        className="production-combat__health"
        role="meter"
        aria-label={`${actor.name} health`}
        aria-valuemin="0"
        aria-valuemax={actor.maxHp}
        aria-valuenow={actor.hp}
      >
        <span style={{ width: `${hpPercent(actor)}%` }} />
      </div>
      <p className="production-combat__vital">
        <strong>{actor.hp} / {actor.maxHp}</strong> HP
        {actor.guard > 0 ? <span> · {actor.guard} guard</span> : null}
      </p>
    </section>
  );
}

function latestEventText(session) {
  const event = [...session.encounter.events].reverse().find((candidate) => (
    candidate.type === "damage-resolved"
      || candidate.type === "defense-gained"
      || candidate.type === "encounter-ended"
  ));
  if (!event) return "The fight is waiting for your decision.";
  if (event.type === "damage-resolved") {
    return `${event.targetId === session.encounter.playerId ? "You take" : "The foe takes"} ${event.amount} damage.`;
  }
  if (event.type === "defense-gained") return `You brace for ${event.amount} guard.`;
  return event.outcome === "victory" ? "The foe falls." : "You fall.";
}

export default function ProductionCombatView({
  session,
  onCommand,
  onSettle,
  error,
  returnFocusSelector = ".story-input__field",
}) {
  const dialogRef = useRef(null);
  const strikeRef = useRef(null);
  const settleRef = useRef(null);
  const restoreFocusRef = useRef(null);
  const encounter = session.encounter;
  const player = encounter.actors[encounter.playerId];
  const enemy = encounter.actors[encounter.enemyIds[0]];
  const terminal = session.status !== "active";
  const intent = enemy.intentState?.intent;
  const eventText = useMemo(() => latestEventText(session), [session]);
  const strikeRule = session.initial.rules.actions.find((action) => action.id === "strike");
  const guardRule = session.initial.rules.actions.find((action) => action.id === "guard");
  const strikeDamage = Math.max(
    player.stats.attack > 0 ? 1 : 0,
    player.stats.attack * strikeRule.effect.multiplier - enemy.stats.defense,
  );
  const guardAmount = guardRule.effect.base
    + player.stats[guardRule.effect.stat] * guardRule.effect.multiplier;

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
          const fallbackTarget = typeof returnFocusSelector === "string"
            ? document.querySelector(returnFocusSelector)
            : null;
          fallbackTarget?.focus?.();
        });
      });
    };
  }, [returnFocusSelector]);

  useEffect(() => {
    (terminal ? settleRef.current : strikeRef.current)?.focus();
  }, [session.sessionId, session.status, terminal]);

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

  const command = (actionId, targetId) => onCommand({
    type: "use-action",
    actorId: player.id,
    actionId,
    targetId,
  });

  return (
    <div
      ref={dialogRef}
      className="production-combat"
      role="dialog"
      aria-modal="true"
      aria-labelledby="production-combat-title"
      tabIndex="-1"
      onKeyDown={keepFocusInside}
    >
      <div className="production-combat__backdrop" aria-hidden="true" />
      <main className="production-combat__panel">
        <header className="production-combat__header">
          <span className="production-combat__eyebrow">Deterministic encounter</span>
          <h1 id="production-combat-title">{terminal ? (session.status === "victory" ? "Victory" : "Defeat") : "Combat"}</h1>
          <p>{session.source.note}</p>
        </header>

        <div className="production-combat__fighters">
          <FighterCard actor={player} label="You" />
          <div className="production-combat__versus" aria-hidden="true">VS</div>
          <FighterCard actor={enemy} label="Foe" />
        </div>

        {!terminal ? (
          <>
            <section className="production-combat__intent" aria-live="polite">
              <span className="production-combat__eyebrow">Declared intent</span>
              <strong>Incoming strike: {intent?.damage ?? 0} damage</strong>
            </section>
            <p className="production-combat__event" aria-live="polite">{eventText}</p>
            {error ? <p className="production-combat__alert" role="alert">{error}</p> : null}
            <div className="production-combat__actions" aria-label="Combat actions">
              <button
                ref={strikeRef}
                type="button"
                className="production-combat__action production-combat__action--primary"
                onClick={() => command("strike", enemy.id)}
              >
                <strong>Strike</strong>
                <span>Deal {strikeDamage} damage</span>
              </button>
              <button
                type="button"
                className="production-combat__action"
                onClick={() => command("guard", player.id)}
              >
                <strong>Guard</strong>
                <span>Raise {guardAmount} guard</span>
              </button>
            </div>
          </>
        ) : (
          <section className="production-combat__outcome" aria-live="assertive">
            <p>{eventText}</p>
            <p>Apply the authoritative aftermath to vitality, progression, and the named foe before returning to the story.</p>
            {error ? <p className="production-combat__alert" role="alert">{error}</p> : null}
            <button ref={settleRef} type="button" className="production-combat__settle" onClick={onSettle}>
              Apply aftermath
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
