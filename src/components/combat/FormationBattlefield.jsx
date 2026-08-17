import React, { useEffect, useRef, useState } from "react";
import "./tow-combat-formation.css";

export const FORMATION_CELL_COUNT = 9;
const VITAL_CONTACT_OFFSET_MS = 150;

const SIDES = Object.freeze(["enemy", "player"]);

function clampPercent(value, maximum) {
  const current = Number(value);
  const max = Number(maximum);
  if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.max(0, Math.min(100, (current / max) * 100));
}

function vitalText(value) {
  const numeric = Math.max(0, Number(value) || 0);
  return Number.isInteger(numeric)
    ? String(numeric)
    : numeric.toFixed(1).replace(/\.0$/, "");
}

function cellKey(side, index) {
  return `${side}:${index}`;
}

function cellSet(cells) {
  return new Set((cells || []).flatMap((cell) => (
    SIDES.includes(cell?.side) && Number.isInteger(cell?.index)
      ? [cellKey(cell.side, cell.index)]
      : []
  )));
}

function actorLookup(actors, entry) {
  if (!entry) return null;
  if (typeof entry === "object") return entry;
  if (Array.isArray(actors)) return actors.find((actor) => actor?.id === entry) || null;
  return actors?.[entry] || null;
}

function normalizedFormation(formations, side) {
  const supplied = Array.isArray(formations?.[side]) ? formations[side] : [];
  return Array.from({ length: FORMATION_CELL_COUNT }, (_, index) => supplied[index] || null);
}

function unitLabel(actor) {
  if (!actor) return "empty";
  const health = `${Math.max(0, Number(actor.hp) || 0)} of ${Math.max(0, Number(actor.maxHp) || 0)} health`;
  const resolve = Number.isFinite(actor.resolve) && Number.isFinite(actor.resolveMax)
    ? `, ${Math.max(0, actor.resolve)} of ${Math.max(0, actor.resolveMax)} Resolve`
    : "";
  return `${actor.name || "Unknown combatant"}, ${health}${resolve}`;
}

function cellLabel({ side, index, actor, valid, affected, selected, intent }) {
  const row = Math.floor(index / 3) + 1;
  const column = (index % 3) + 1;
  const states = [
    valid ? "valid target" : null,
    selected ? "selected target" : null,
    affected ? "affected by the selected ability" : null,
    intent ? "threatened by an enemy intent" : null,
  ].filter(Boolean);
  return `${side === "enemy" ? "Enemy" : "Player"} formation, row ${row}, column ${column}: ${unitLabel(actor)}${states.length ? `. ${states.join(", ")}` : ""}`;
}

function usePresentedVitals(actor, feedbackCues) {
  const exact = {
    actorId: actor.id,
    hp: Math.max(0, Number(actor.hp) || 0),
    maxHp: Math.max(0, Number(actor.maxHp) || 0),
    shield: Math.max(0, Number(actor.shield) || 0),
  };
  const [presented, setPresented] = useState(exact);
  const presentedRef = useRef(presented);
  const reactions = (feedbackCues || []).filter((cue) => cue.targetId === actor.id);
  const feedbackDelay = reactions.length > 0
    ? Math.max(...reactions.map((cue) => cue.delayMs || 0))
    : 0;

  useEffect(() => {
    const changes = (feedbackCues || [])
      .filter((cue) => cue.targetId === actor.id && (cue.hpChange || cue.shieldChange))
      .sort((left, right) => (left.delayMs || 0) - (right.delayMs || 0));
    const timers = [];
    const present = (snapshot) => {
      presentedRef.current = snapshot;
      setPresented(snapshot);
    };

    if (changes.length === 0) {
      timers.push(setTimeout(() => present(exact), Math.max(0, feedbackDelay)));
      return () => timers.forEach(clearTimeout);
    }

    const totalHpChange = changes.reduce((total, cue) => total + (cue.hpChange || 0), 0);
    const totalShieldChange = changes.reduce((total, cue) => total + (cue.shieldChange || 0), 0);
    const previous = presentedRef.current;
    const previousReconciles = previous.actorId === actor.id
      && previous.maxHp === exact.maxHp
      && Math.max(0, Math.min(exact.maxHp, previous.hp + totalHpChange)) === exact.hp
      && Math.max(0, previous.shield + totalShieldChange) === exact.shield;
    let hp = previousReconciles
      ? previous.hp
      : Math.max(0, Math.min(exact.maxHp, exact.hp - totalHpChange));
    let shield = previousReconciles
      ? previous.shield
      : Math.max(0, exact.shield - totalShieldChange);
    present({ ...exact, hp, shield });

    for (const cue of changes) {
      hp = Math.max(0, Math.min(exact.maxHp, hp + (cue.hpChange || 0)));
      shield = Math.max(0, shield + (cue.shieldChange || 0));
      const snapshot = { ...exact, hp, shield };
      timers.push(setTimeout(
        () => present(snapshot),
        Math.max(0, cue.delayMs || 0) + VITAL_CONTACT_OFFSET_MS,
      ));
    }

    const settleDelay = Math.max(...changes.map((cue) => cue.delayMs || 0))
      + VITAL_CONTACT_OFFSET_MS + 1;
    timers.push(setTimeout(() => present(exact), settleDelay));
    return () => timers.forEach(clearTimeout);
  }, [actor.id, exact.hp, exact.maxHp, exact.shield, feedbackCues, feedbackDelay]);

  return {
    presented: presented.actorId === actor.id ? presented : exact,
    reacting: reactions.length > 0,
  };
}

function UnitVitals({ actor, enemy, presented }) {
  const hp = presented.hp;
  const maxHp = presented.maxHp;
  const hasResolve = Number.isFinite(actor.resolve) && Number.isFinite(actor.resolveMax);
  const resolve = hasResolve ? Math.max(0, actor.resolve) : 0;
  const resolveMax = hasResolve ? Math.max(0, actor.resolveMax) : 0;

  return (
    <span className="tow-formation-unit__vitals">
      <span className="tow-formation-unit__name">{actor.name || "Unknown"}</span>
      <span
        className={`tow-formation-unit__meter tow-formation-unit__meter--hp${enemy ? " is-enemy" : ""}`}
        role="meter"
        aria-label={`${actor.name || "Combatant"} health`}
        aria-valuemin="0"
        aria-valuemax={maxHp}
        aria-valuenow={hp}
      >
        <i style={{ width: `${clampPercent(hp, maxHp)}%` }} />
        <span className="tow-formation-unit__meter-label" aria-hidden="true">HP</span>
        <span className="tow-formation-unit__meter-value" aria-hidden="true">
          <strong>{vitalText(hp)}</strong>/{vitalText(maxHp)}
        </span>
      </span>
      {hasResolve ? (
        <span
          className="tow-formation-unit__meter tow-formation-unit__meter--resolve"
          role="meter"
          aria-label={`${actor.name || "Combatant"} Resolve`}
          aria-valuemin="0"
          aria-valuemax={resolveMax}
          aria-valuenow={resolve}
        >
          <i style={{ width: `${clampPercent(resolve, resolveMax)}%` }} />
          <span className="tow-formation-unit__meter-label" aria-hidden="true">RP</span>
          <span className="tow-formation-unit__meter-value" aria-hidden="true">
            <strong>{vitalText(resolve)}</strong>/{vitalText(resolveMax)}
          </span>
        </span>
      ) : null}
    </span>
  );
}

function FormationUnit({ actor, art, side, active, feedbackCues }) {
  const { presented, reacting } = usePresentedVitals(actor, feedbackCues);
  const down = presented.hp <= 0;
  return (
    <span className={`tow-formation-unit${active ? " is-active" : ""}${down ? " is-down" : ""}${reacting ? " is-reacting" : ""}`}>
      <span className="tow-formation-unit__figure" aria-hidden="true">
        {art ? (
          <img src={art} alt="" draggable="false" decoding="async" />
        ) : (
          <span className="tow-formation-unit__monogram">
            {(String(actor.name || "?").trim()[0] || "?").toUpperCase()}
          </span>
        )}
      </span>
      <UnitVitals actor={actor} enemy={side === "enemy"} presented={presented} />
    </span>
  );
}

function FormationGrid({
  side,
  actors,
  formation,
  artForActor,
  valid,
  affected,
  selected,
  intent,
  activeActorId,
  onSelectCell,
  feedbackCues,
}) {
  const title = side === "enemy" ? "Enemy formation" : "Player formation";
  return (
    <section className={`tow-formation-grid tow-formation-grid--${side}`} aria-label={title}>
      {formation.map((entry, index) => {
        const actor = actorLookup(actors, entry);
        const key = cellKey(side, index);
        const isValid = valid.has(key);
        const isAffected = affected.has(key);
        const isSelected = selected === key;
        const isIntent = intent.has(key);
        const art = actor && typeof artForActor === "function" ? artForActor(actor) : null;
        const stateClasses = [
          actor ? "has-unit" : "is-empty",
          isValid ? "is-valid-anchor" : null,
          isAffected ? "is-affected" : null,
          isSelected ? "is-selected-anchor" : null,
          isIntent ? "is-intent-target" : null,
        ].filter(Boolean).join(" ");

        return (
          <button
            key={key}
            type="button"
            className={`tow-formation-cell ${stateClasses}`}
            data-side={side}
            data-cell-index={index}
            data-row={Math.floor(index / 3)}
            data-column={index % 3}
            aria-label={cellLabel({
              side,
              index,
              actor,
              valid: isValid,
              affected: isAffected,
              selected: isSelected,
              intent: isIntent,
            })}
            aria-pressed={isSelected}
            disabled={!isValid}
            onClick={() => onSelectCell?.(side, index)}
          >
            {actor ? (
              <FormationUnit
                actor={actor}
                art={art}
                side={side}
                active={actor.id === activeActorId}
                feedbackCues={feedbackCues}
              />
            ) : null}
          </button>
        );
      })}
    </section>
  );
}

/**
 * Static two-sided combat formation. Target legality and footprints are supplied by the
 * authoritative combat domain; this component only presents them and reports cell choices.
 */
export function FormationBattlefield({
  actors = {},
  formations = {},
  artForActor = null,
  validAnchors = [],
  affectedCells = [],
  selectedAnchor = null,
  intentCells = [],
  activeActorId = null,
  onSelectCell = null,
  feedbackCues = [],
  className = "",
}) {
  const valid = cellSet(validAnchors);
  const affected = cellSet(affectedCells);
  const intent = cellSet(intentCells);
  const selected = SIDES.includes(selectedAnchor?.side) && Number.isInteger(selectedAnchor?.index)
    ? cellKey(selectedAnchor.side, selectedAnchor.index)
    : null;

  return (
    <section
      className={`tow-formation-battlefield ${className}`.trim()}
      aria-label="Battle formations"
    >
      <FormationGrid
        side="enemy"
        actors={actors}
        formation={normalizedFormation(formations, "enemy")}
        artForActor={artForActor}
        valid={valid}
        affected={affected}
        selected={selected}
        intent={intent}
        activeActorId={activeActorId}
        onSelectCell={onSelectCell}
        feedbackCues={feedbackCues}
      />
      <span className="tow-formation-battlefield__divide" aria-hidden="true" />
      <FormationGrid
        side="player"
        actors={actors}
        formation={normalizedFormation(formations, "player")}
        artForActor={artForActor}
        valid={valid}
        affected={affected}
        selected={selected}
        intent={intent}
        activeActorId={activeActorId}
        onSelectCell={onSelectCell}
        feedbackCues={feedbackCues}
      />
    </section>
  );
}

export default FormationBattlefield;
