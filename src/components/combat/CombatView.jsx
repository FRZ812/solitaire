import React, { useEffect, useRef } from "react";
import { getAbilityDef } from "../../data/abilities.js";
import { tierLabel } from "../../data/tiers.js";
import { cardUsable, isPlayerTurnLocked, playerResolveCost } from "../../engine/combat.js";
import { CombatCard } from "./CombatCard.jsx";
import "./combat.css";

const TERMINAL = new Set(["victory", "defeat", "resolved", "playerFled"]);

function pct(value, max) {
  return `${Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))}%`;
}

function Statuses({ statuses }) {
  if (!statuses?.length) return null;
  return (
    <div className="combat-statuses">
      {statuses.map((status, index) => (
        <span className="combat-status" key={`${status.type}-${index}`}>
          {status.type}{status.duration > 1 ? ` ${status.duration}` : ""}
        </span>
      ))}
    </div>
  );
}

function intentLine(intent, enemy, targetName) {
  if (!intent) return enemy.fleeing ? "Intent · Escape" : "Intent · Watching";
  let detail = intent.name;
  if (targetName && intent.mode === "single") detail += ` → ${targetName}`;
  if (intent.damage) {
    const amount = intent.damage.min === intent.damage.max
      ? intent.damage.min
      : `${intent.damage.min}–${intent.damage.max}`;
    detail += ` · ${amount}${intent.damage.hits > 1 ? ` × ${intent.damage.hits}` : ""}`;
  } else if (intent.status) {
    detail += ` · ${intent.status}`;
  }
  return `Intent · ${detail}`;
}

function EnemyCard({ enemy, selected, onSelect, targetNames }) {
  const inactive = enemy._dead || enemy.resolved === "fled" || enemy.resolved === "ko";
  const intents = enemy.intents?.length ? enemy.intents : (enemy.intent ? [enemy.intent] : []);
  return (
    <button
      type="button"
      className={`combat-enemy${selected ? " is-selected" : ""}`}
      onClick={() => !inactive && onSelect(enemy.uid)}
      disabled={inactive}
      aria-pressed={selected}
    >
      <span className="combat-unit__top">
        <strong className="combat-unit__name">{enemy.name}</strong>
        <span className="combat-unit__tier">{tierLabel(enemy.tier)}</span>
      </span>
      <span className="combat-bar combat-bar--enemy"><span style={{ width: pct(enemy.health, enemy.maxHealth) }} /></span>
      <span className="combat-unit__meta">
        <span>{Math.ceil(enemy.health)}/{enemy.maxHealth} HP</span>
        <span>{enemy.armor ? `AR ${enemy.armor}` : ""}{enemy.ward ? ` · WD ${enemy.ward}` : ""}</span>
      </span>
      {enemy.resolved === "yielded" ? (
        <span className="combat-intent">Yielded · at your mercy</span>
      ) : intents.length > 0 ? intents.map((intent) => (
        <span className="combat-intent" key={intent.id}>{intentLine(intent, enemy, targetNames.get(intent.targetUid))}</span>
      )) : (
        <span className="combat-intent">{intentLine(null, enemy, null)}</span>
      )}
      <Statuses statuses={enemy.statuses} />
    </button>
  );
}

function AllyCard({ ally }) {
  const down = ally._dead || ally.resolved === "ko";
  return (
    <div className="combat-ally">
      <span className="combat-unit__top">
        <strong className="combat-unit__name">{ally.name}</strong>
        <span className="combat-unit__tier">{down ? "Down" : "Ally"}</span>
      </span>
      <span className="combat-bar combat-bar--ally"><span style={{ width: pct(ally.health, ally.maxHealth) }} /></span>
      <span className="combat-unit__meta"><span>{Math.ceil(ally.health)}/{ally.maxHealth} HP</span></span>
      <Statuses statuses={ally.statuses} />
    </div>
  );
}

function ResultOverlay({ combat, onResolve }) {
  const title = combat.standoff ? "Standoff"
    : combat.phase === "victory" ? "Victory"
      : combat.phase === "resolved" ? "Stood Down"
        : combat.phase === "playerFled" ? "Escaped" : "Defeat";
  return (
    <div className="combat-result">
      <h2>{title}</h2>
      <p>The field is settled. Its wounds and choices will follow you back into the world.</p>
      <button type="button" className="combat-action-button combat-action-button--end" onClick={onResolve}>Continue</button>
    </div>
  );
}

export function CombatView({
  combat,
  onPlayCard,
  onSetTarget,
  onEndTurn,
  onFlee,
  onStandDown,
  onCeasefire,
  onResolve,
}) {
  const logRef = useRef(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [combat.log.length]);

  const { player, deck } = combat;
  const over = TERMINAL.has(combat.phase);
  const turnLocked = isPlayerTurnLocked(combat);
  const playerTurn = combat.phase === "player" && !turnLocked;
  const targetNames = new Map([player, ...(combat.allies || [])].map((actor) => [actor.uid, actor.name]));
  const liveAttacker = combat.enemies.some((enemy) => enemy.health > 0 && !enemy.resolved && !enemy.fleeing && !enemy._dead);
  const brokenPresent = combat.enemies.some((enemy) => (enemy.resolved === "yielded" && !enemy._dead) || enemy.fleeing);
  const canStand = playerTurn && !liveAttacker && brokenPresent;

  return (
    <main className="deck-combat" aria-label="Card combat">
      <div className="combat-field">
        <section className="combat-enemies" aria-label="Enemies and intents">
          {combat.enemies.map((enemy) => (
            <EnemyCard
              key={enemy.uid}
              enemy={enemy}
              selected={combat.targetUid === enemy.uid}
              onSelect={onSetTarget}
              targetNames={targetNames}
            />
          ))}
        </section>

        {combat.allies?.length > 0 && (
          <section className="combat-allies" aria-label="Allies">
            {combat.allies.map((ally) => <AllyCard key={ally.uid} ally={ally} />)}
          </section>
        )}
      </div>

      <section ref={logRef} className="combat-log custom-scroll" aria-label="Combat log">
        {combat.log.slice(-28).map((entry) => (
          <p key={entry.id} className={`is-${entry.kind}`}>{entry.text}</p>
        ))}
      </section>

      <section className="combat-player" aria-label="Player combat state">
        <div className="combat-player__top">
          <span className="combat-energy" title="Energy">{player.energy}/{player.maxEnergy}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="combat-player__top">
              <strong className="combat-player__name">{player.name}</strong>
              <span className="combat-player__health">{Math.ceil(player.health)}/{player.maxHealth} HP</span>
            </div>
            <div className="combat-bar combat-bar--player"><span style={{ width: pct(player.health, player.maxHealth) }} /></div>
          </div>
        </div>
        <div className="combat-piles" aria-label="Card piles">
          <span className="combat-pile">Draw {deck.draw.length}</span>
          <span className="combat-pile">Discard {deck.discard.length}</span>
          <span className="combat-pile">Exhaust {deck.exhaust.length}</span>
          {player.resolveMax > 0 && <span className="combat-pile">Resolve {player.resolve}/{player.resolveMax}</span>}
        </div>
        <Statuses statuses={player.statuses} />
      </section>

      <section className="combat-hand-wrap" aria-label="Card hand">
        <div className="combat-hand-label">
          <span>Round {combat.round}</span>
          <span>{playerTurn ? "Choose your cards" : "Foes are acting"}</span>
        </div>
        <div className="combat-hand custom-scroll">
          {deck.hand.length ? deck.hand.map((uid) => {
            const card = deck.cards[uid];
            return (
              <CombatCard
                key={uid}
                card={card}
                playable={cardUsable(combat, uid, combat.targetUid)}
                onPlay={() => onPlayCard(uid, combat.targetUid)}
                effectiveResolveCost={playerResolveCost(combat, getAbilityDef(card.abilityId))}
              />
            );
          }) : <div className="combat-hand__empty">No cards in hand. End the round to draw again.</div>}
        </div>

        {playerTurn && combat.ceasefire && (
          <button type="button" className="combat-action-button" onClick={onCeasefire}>Accept the offered truce</button>
        )}
        <div className="combat-turn-controls">
          <button type="button" className="combat-action-button combat-action-button--end" onClick={onEndTurn} disabled={!playerTurn}>End Round</button>
          {canStand ? (
            <button type="button" className="combat-action-button" onClick={onStandDown}>Stand Down</button>
          ) : (
            <button type="button" className="combat-action-button" onClick={onFlee} disabled={!playerTurn}>Flee</button>
          )}
        </div>
      </section>

      {over && <ResultOverlay combat={combat} onResolve={onResolve} />}
    </main>
  );
}
