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

/**
 * The accessible name for a targetable foe.
 *
 * A foe card is a button when there is more than one of them, and a button's aria-label
 * replaces everything inside it — so naming it "Target Wolf 1" meant a screen-reader user
 * heard the name and never the telegraph. The whole point of declaring an attack is that the
 * player knows what is coming before they spend their turn; a player using a screen reader
 * is owed the same information, in the same place.
 */
function targetLabel(actor, intent) {
  const health = `${actor.hp} of ${actor.maxHp} health`;
  if (actor.hp <= 0) return `${actor.name}, down`;
  if (!intent) return `Target ${actor.name}, ${health}`;
  const blow = intent.hits > 1
    ? `${intent.hits} hits of ${intent.damage}`
    : `${intent.damage} damage`;
  return `Target ${actor.name}, ${health}, preparing ${intent.name} for ${blow}`;
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

/** How many actions this actor has left in the current window. */
function actionsLeft(encounter, actorId) {
  if (actorId === encounter.playerId) return encounter.turn.actionsRemaining;
  return encounter.turn.allies?.[actorId] ?? 0;
}

export function TowCombatView({
  encounter,
  onUseSkill,
  onEndTurn,
  onStandDown,
  onSettle,
  note,
  error,
  returnFocusSelector = ".story-input__field",
}) {
  const firstActionRef = useRef(null);
  const settleRef = useRef(null);
  const restoreFocusRef = useRef(null);
  const [targetId, setTargetId] = useState(null);
  const [commanderId, setCommanderId] = useState(null);

  const player = encounter.actors[encounter.playerId];
  const allies = (encounter.allyIds || []).map((id) => encounter.actors[id]);
  const enemies = encounter.enemyIds.map((id) => encounter.actors[id]);
  const living = enemies.filter((enemy) => enemy.hp > 0);
  const terminal = encounter.phase !== "player";
  const activeTarget = living.find((enemy) => enemy.id === targetId)?.id || living[0]?.id || null;
  // One command window covers the whole side. The player picks whose action to spend, and
  // an ally who does nothing did nothing because the player said so.
  const commandable = [player, ...allies].filter((actor) => actor.hp > 0);
  const activeCommander = commandable.find((actor) => actor.id === commanderId)
    || commandable.find((actor) => actionsLeft(encounter, actor.id) > 0)
    || commandable[0]
    || player;
  const commanderBuild = activeCommander.id === encounter.playerId
    ? encounter.build
    : encounter.allyBuilds?.[activeCommander.id];
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
          <div className="production-combat__side">
            <section className="production-combat__fighter" aria-label={`You: ${player.name}`}>
              {fighterBody(player, "You")}
            </section>
            {allies.map((ally) => (
              <section
                key={ally.id}
                className="production-combat__fighter"
                aria-label={`Ally: ${ally.name}`}
              >
                {fighterBody(ally, "Ally")}
              </section>
            ))}
          </div>
          <div className="production-combat__versus" aria-hidden="true">VS</div>
          <div className="production-combat__foes">
            {enemies.map((enemy) => (
              living.length > 1 && !terminal ? (
                <button
                  key={enemy.id}
                  type="button"
                  className={`production-combat__fighter production-combat__fighter--target${enemy.id === activeTarget ? " is-selected" : ""}`}
                  aria-label={targetLabel(enemy, intents[enemy.id])}
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
            {commandable.length > 1 ? (
              <div className="production-combat__commanders" aria-label="Whose action to spend">
                {commandable.map((actor) => (
                  <button
                    key={actor.id}
                    type="button"
                    className={`production-combat__commander${actor.id === activeCommander.id ? " is-selected" : ""}`}
                    aria-pressed={actor.id === activeCommander.id}
                    aria-label={`Act as ${actor.name}, ${actionsLeft(encounter, actor.id)} actions left`}
                    onClick={() => setCommanderId(actor.id)}
                  >
                    <strong>{actor.id === encounter.playerId ? "You" : actor.name}</strong>
                    <span>{actionsLeft(encounter, actor.id)} left</span>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="production-combat__actions" aria-label="Combat actions">
              {(commanderBuild?.skills || []).map((skillState, index) => {
                const definition = getSkill(skillState.id);
                const legality = skillLegality(skillState, {
                  turnAvailable: actionsLeft(encounter, activeCommander.id) > 0,
                });
                return (
                  <button
                    key={skillState.id}
                    ref={index === 0 ? firstActionRef : null}
                    type="button"
                    className="production-combat__action"
                    disabled={!legality.ok}
                    onClick={() => onUseSkill(skillState.id, activeTarget, activeCommander.id)}
                  >
                    <strong>{definition.name}</strong>
                    <span>{skillHint(skillState)}</span>
                  </button>
                );
              })}
            </div>
            {/* Standing an ally down is an explicit command, never hidden AI: a companion
                who does nothing did nothing because the player decided so. */}
            {commandable.length > 1 && actionsLeft(encounter, activeCommander.id) > 0 ? (
              <button
                type="button"
                className="production-combat__stand-down"
                onClick={() => onStandDown?.(activeCommander.id)}
              >
                {activeCommander.id === encounter.playerId
                  ? "Hold your action"
                  : `${activeCommander.name} holds`}
              </button>
            ) : null}
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
