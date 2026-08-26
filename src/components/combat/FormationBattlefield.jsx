import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "./tow-combat-formation.css";

export const FORMATION_CELL_COUNT = 9;
const VITAL_CONTACT_OFFSET_MS = 150;
const DEFAULT_MOVE_DURATION_MS = 200;
const BASIC_MELEE_LUNGE_DURATION_MS = 620;
const NO_FEEDBACK_CUES = Object.freeze([]);

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

function combatCell(value) {
  return SIDES.includes(value?.side)
    && Number.isSafeInteger(value.index)
    && value.index >= 0
    && value.index < FORMATION_CELL_COUNT;
}

/** Collapse one basic-melee action's hit receipts into one out-and-back unit-card lunge. */
export function basicMeleeLungeCues(cues = []) {
  const groups = new Map();
  for (const cue of cues) {
    if (!cue?.basicMelee || typeof cue.attackerId !== "string"
      || !combatCell(cue.sourceCell) || !combatCell(cue.targetCell)
      || cellKey(cue.sourceCell.side, cue.sourceCell.index)
        === cellKey(cue.targetCell.side, cue.targetCell.index)) continue;
    const actionIdentity = Number.isSafeInteger(cue.actionIndex)
      ? `action:${cue.actionIndex}`
      : `sequence:${cue.sequence ?? cue.id}`;
    const key = `${cue.attackerId}:${actionIdentity}`;
    const group = groups.get(key) || [];
    group.push(cue);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => {
    const ordered = [...group].sort((left, right) => (
      (left.delayMs || 0) - (right.delayMs || 0)
    ));
    const first = ordered[0];
    const last = ordered.at(-1);
    return {
      id: `${first.id || first.sequence}-basic-melee-lunge`,
      actorId: first.attackerId,
      sourceCell: { ...first.sourceCell },
      targetCell: { ...first.targetCell },
      delayMs: Math.max(0, Number(first.delayMs) || 0),
      durationMs: Math.max(
        BASIC_MELEE_LUNGE_DURATION_MS,
        ((Number(last.delayMs) || 0) - (Number(first.delayMs) || 0))
          + BASIC_MELEE_LUNGE_DURATION_MS,
      ),
    };
  });
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

function prefersReducedMotion() {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function movementDuration(cue) {
  return Math.max(160, Math.min(220, Number(cue?.durationMs) || DEFAULT_MOVE_DURATION_MS));
}

function movementList(cue) {
  return Array.isArray(cue?.moves) ? cue.moves.filter((move) => (
    SIDES.includes(move?.side)
    && typeof move.actorId === "string"
    && Number.isSafeInteger(move.fromCell)
    && Number.isSafeInteger(move.toCell)
  )) : [];
}

function formationBeforeMovement(formations, cue) {
  if (Array.isArray(cue?.formationsBefore?.player)
    && Array.isArray(cue?.formationsBefore?.enemy)) {
    return cue.formationsBefore;
  }
  const previous = {
    ...formations,
    player: normalizedFormation(formations, "player"),
    enemy: normalizedFormation(formations, "enemy"),
  };
  for (const move of movementList(cue)) previous[move.side][move.toCell] = null;
  for (const move of movementList(cue)) previous[move.side][move.fromCell] = move.actorId;
  return previous;
}

function visualRow(side, cell) {
  const row = Math.floor(cell / 3);
  return side === "enemy" ? 2 - row : row;
}

function movementAnnouncement(actors, moves) {
  return moves.map((move) => {
    const actor = actorLookup(actors, move.actorId);
    const name = actor?.name || "Combatant";
    const fromRow = Math.floor(move.fromCell / 3) + 1;
    const fromColumn = (move.fromCell % 3) + 1;
    const toRow = Math.floor(move.toCell / 3) + 1;
    const toColumn = (move.toCell % 3) + 1;
    return `${name} moves from ${move.side} row ${fromRow} column ${fromColumn} to row ${toRow} column ${toColumn}.`;
  }).join(" ");
}

function unitLabel(actor) {
  if (!actor) return "empty";
  const health = `${Math.max(0, Number(actor.hp) || 0)} of ${Math.max(0, Number(actor.maxHp) || 0)} health`;
  const resolve = Number.isFinite(actor.resolve) && Number.isFinite(actor.resolveMax)
    ? `, ${Math.max(0, actor.resolve)} of ${Math.max(0, actor.resolveMax)} Resolve`
    : "";
  return `${actor.name || "Unknown combatant"}, ${health}${resolve}`;
}

function cellLabel({ side, index, actor, valid, affected, previewed, selected, intent }) {
  const row = Math.floor(index / 3) + 1;
  const column = (index % 3) + 1;
  const states = [
    valid ? "valid target" : null,
    previewed ? "previewing the ability footprint" : null,
    selected ? "selected target" : null,
    affected ? "inside the ability footprint" : null,
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

function FormationUnit({
  actor,
  art,
  side,
  active,
  overlay = null,
  feedbackCues,
  movement = null,
  lunge = null,
}) {
  const { presented, reacting } = usePresentedVitals(actor, feedbackCues);
  const down = presented.hp <= 0;
  const moveOffset = movement
    ? visualRow(side, movement.fromCell) - visualRow(side, movement.toCell)
    : 0;
  const distance = lunge ? Math.hypot(lunge.dx, lunge.dy) : 0;
  const leap = Math.max(8, Math.min(24, distance * 0.08));
  const presentationStyle = {
    ...(movement ? {
      "--tow-move-offset": moveOffset,
      "--tow-move-duration": `${movement.durationMs}ms`,
    } : {}),
    ...(lunge ? {
      "--tow-lunge-x": `${lunge.dx}px`,
      "--tow-lunge-y": `${lunge.dy}px`,
      "--tow-lunge-mid-x": `${lunge.dx * 0.74}px`,
      "--tow-lunge-mid-y": `${(lunge.dy * 0.74) - leap}px`,
      "--tow-lunge-wind-x": `${lunge.dx * -0.04}px`,
      "--tow-lunge-wind-y": `${lunge.dy * -0.04}px`,
      "--tow-lunge-delay": `${lunge.delayMs}ms`,
      "--tow-lunge-duration": `${lunge.durationMs}ms`,
    } : {}),
  };
  return (
    <span
      className={`tow-formation-unit${active ? " is-active" : ""}${down ? " is-down" : ""}${reacting ? " is-reacting" : ""}${movement ? " is-arriving" : ""}${lunge ? " is-lunging" : ""}`}
      style={Object.keys(presentationStyle).length > 0 ? presentationStyle : undefined}
      data-actor-id={actor.id}
      data-lunge-id={lunge?.id || undefined}
    >
      {overlay ? (
        <span className="tow-formation-cell__overlays">
          {overlay}
        </span>
      ) : null}
      {active && !down ? (
        <span className="tow-formation-unit__active-label" aria-hidden="true">
          <strong>Acting</strong>
          <em>{actor.name}</em>
        </span>
      ) : null}
      {down ? (
        <span className="tow-formation-unit__down-label" aria-hidden="true">Defeated</span>
      ) : null}
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
  previewed,
  selected,
  intent,
  activeActorId,
  onSelectCell,
  onPreviewCell,
  onInspectActor,
  renderActorOverlay,
  feedbackCues,
  moveDestinations,
  arrivingMoves,
  consumedFeedbackActorIds,
  lungeMotions,
}) {
  const title = side === "enemy" ? "Enemy formation" : "Player formation";
  const sideIsLunging = Object.values(lungeMotions).some((motion) => (
    motion.sourceCell.side === side
  ));
  return (
    <section
      className={`tow-formation-grid tow-formation-grid--${side}${sideIsLunging ? " has-lunging-unit" : ""}`}
      aria-label={title}
    >
      {formation.map((entry, index) => {
        const actor = actorLookup(actors, entry);
        const key = cellKey(side, index);
        const isValid = valid.has(key);
        const isAffected = affected.has(key);
        const isPreviewed = previewed === key;
        const isSelected = selected === key;
        // An intent threatens combatants, not vacant floor. Keeping the logical footprint
        // on occupied cells removes the permanent red landing circles that made an empty
        // party formation read like six additional units.
        const isIntent = Boolean(actor) && intent.has(key);
        const destinationMove = moveDestinations.get(key) || null;
        const arrivingMove = actor ? arrivingMoves.get(actor.id) || null : null;
        const lunge = actor ? lungeMotions[actor.id] || null : null;
        const art = actor && typeof artForActor === "function" ? artForActor(actor) : null;
        const stateClasses = [
          actor ? "has-unit" : "is-empty",
          isValid ? "is-valid-anchor" : null,
          isAffected ? "is-affected" : null,
          isPreviewed ? "is-preview-anchor" : null,
          isSelected ? "is-selected-anchor" : null,
          isIntent ? "is-intent-target" : null,
          destinationMove ? "is-move-destination" : null,
          lunge ? "has-lunging-unit" : null,
        ].filter(Boolean).join(" ");

        const canInspect = Boolean(actor) && typeof onInspectActor === "function";
        const enabled = isValid || canInspect;

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
              previewed: isPreviewed,
              selected: isSelected,
              intent: isIntent,
            })}
            aria-pressed={isSelected}
            disabled={!enabled}
            aria-haspopup={!isValid && canInspect ? "dialog" : undefined}
            onClick={() => {
              if (isValid) onSelectCell?.(side, index);
              else if (canInspect) onInspectActor(actor);
            }}
            onFocus={() => {
              if (isValid) onPreviewCell?.(side, index);
            }}
            onBlur={(event) => {
              if (!isValid || event.currentTarget.matches(":hover")) return;
              const next = event.relatedTarget;
              if (next?.matches?.(".tow-formation-cell.is-valid-anchor:not(:disabled)")) {
                onPreviewCell?.(next.dataset.side, Number(next.dataset.cellIndex));
              } else {
                onPreviewCell?.(null, null);
              }
            }}
            onMouseEnter={() => {
              if (isValid) onPreviewCell?.(side, index);
            }}
            onMouseLeave={(event) => {
              if (!isValid || document.activeElement === event.currentTarget) return;
              const focused = event.currentTarget.ownerDocument.activeElement;
              if (focused?.matches?.(".tow-formation-cell.is-valid-anchor:not(:disabled)")) {
                onPreviewCell?.(focused.dataset.side, Number(focused.dataset.cellIndex));
              } else {
                onPreviewCell?.(null, null);
              }
            }}
            style={destinationMove ? {
              "--tow-move-duration": `${destinationMove.durationMs}ms`,
            } : undefined}
          >
            {destinationMove ? (
              <span
                className="tow-formation-cell__move-marker"
                data-moving-actor={destinationMove.actorId}
                aria-hidden="true"
              />
            ) : null}
            {actor ? (
              <FormationUnit
                actor={actor}
                art={art}
                side={side}
                active={actor.id === activeActorId}
                overlay={typeof renderActorOverlay === "function"
                  ? renderActorOverlay(actor, side)
                  : null}
                feedbackCues={consumedFeedbackActorIds.has(actor.id)
                  ? NO_FEEDBACK_CUES
                  : feedbackCues}
                movement={arrivingMove}
                lunge={lunge}
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
  previewAnchor = null,
  selectedAnchor = null,
  intentCells = [],
  activeActorId = null,
  onSelectCell = null,
  onPreviewCell = null,
  onInspectActor = null,
  renderActorOverlay = null,
  feedbackCues = NO_FEEDBACK_CUES,
  movementCue = null,
  intentCellsBeforeMove = [],
  className = "",
}) {
  const movementId = movementCue?.id || null;
  const [movementState, setMovementState] = useState({
    id: null,
    phase: "idle",
    reducedMotion: false,
    durationMs: DEFAULT_MOVE_DURATION_MS,
  });
  const [announcement, setAnnouncement] = useState("");
  const battlefieldRef = useRef(null);
  const lungePlans = useMemo(() => basicMeleeLungeCues(feedbackCues), [feedbackCues]);
  const [lungeMotions, setLungeMotions] = useState({});
  const movementPhase = !movementId
    ? "idle"
    : movementState.id === movementId ? movementState.phase : "pending";
  const reducedMotion = movementState.id === movementId
    ? movementState.reducedMotion
    : prefersReducedMotion();
  const durationMs = movementState.id === movementId
    ? movementState.durationMs
    : movementDuration(movementCue);
  const moves = movementList(movementCue);
  const presentedFormations = movementPhase === "pending"
    ? formationBeforeMovement(formations, movementCue)
    : formations;
  const presentedIntentCells = movementPhase === "pending"
    ? intentCellsBeforeMove
    : intentCells;
  const settling = movementPhase === "settling";
  const moveDestinations = new Map(settling ? moves.map((move) => [
    cellKey(move.side, move.toCell),
    { ...move, durationMs },
  ]) : []);
  const arrivingMoves = new Map(settling && !reducedMotion ? moves.map((move) => [
    move.actorId,
    { ...move, durationMs },
  ]) : []);
  // A moving unit is reparented from its source cell to its destination cell. Once the
  // atomic swap happens, do not let that fresh component instance replay hit receipts that
  // already resolved before movement; it should mount at the authoritative final vitals.
  const consumedFeedbackActorIds = new Set(movementId && movementPhase !== "pending"
    ? moves.map((move) => move.actorId)
    : []);

  useLayoutEffect(() => {
    const battlefield = battlefieldRef.current;
    if (!battlefield || lungePlans.length === 0) {
      setLungeMotions((current) => (
        Object.keys(current).length === 0 ? current : {}
      ));
      return undefined;
    }
    const measure = () => {
      const measured = {};
      for (const plan of lungePlans) {
        const source = battlefield.querySelector(
          `[data-side="${plan.sourceCell.side}"][data-cell-index="${plan.sourceCell.index}"]`,
        );
        const target = battlefield.querySelector(
          `[data-side="${plan.targetCell.side}"][data-cell-index="${plan.targetCell.index}"]`,
        );
        if (!source || !target) continue;
        const sourceRect = source.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const fullDx = (targetRect.left + (targetRect.width / 2))
          - (sourceRect.left + (sourceRect.width / 2));
        const fullDy = (targetRect.top + (targetRect.height / 2))
          - (sourceRect.top + (sourceRect.height / 2));
        const distance = Math.hypot(fullDx, fullDy);
        if (distance < 1) continue;
        const stopShort = Math.max(
          16,
          Math.min(46, Math.min(targetRect.width, targetRect.height) * 0.38),
        );
        const approach = Math.max(0, (distance - stopShort) / distance);
        measured[plan.actorId] = {
          ...plan,
          dx: fullDx * approach,
          dy: fullDy * approach,
        };
      }
      setLungeMotions(measured);
    };
    measure();
    if (typeof ResizeObserver !== "function") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(battlefield);
    return () => observer.disconnect();
  }, [lungePlans, movementPhase]);

  useEffect(() => {
    if (!movementId) {
      setMovementState((current) => current.phase === "idle"
        ? current
        : { ...current, id: null, phase: "idle" });
      setAnnouncement("");
      return undefined;
    }
    const nextReducedMotion = prefersReducedMotion();
    const nextDurationMs = movementDuration(movementCue);
    const delayMs = Math.max(0, Number(movementCue.delayMs) || 0);
    setMovementState({
      id: movementId,
      phase: "pending",
      reducedMotion: nextReducedMotion,
      durationMs: nextDurationMs,
    });
    setAnnouncement("");
    const swapTimer = setTimeout(() => {
      setMovementState({
        id: movementId,
        phase: "settling",
        reducedMotion: nextReducedMotion,
        durationMs: nextDurationMs,
      });
      setAnnouncement(movementAnnouncement(actors, moves));
    }, delayMs);
    const settleTimer = setTimeout(() => {
      setMovementState({
        id: movementId,
        phase: "settled",
        reducedMotion: nextReducedMotion,
        durationMs: nextDurationMs,
      });
    }, delayMs + nextDurationMs);
    return () => {
      clearTimeout(swapTimer);
      clearTimeout(settleTimer);
    };
  }, [movementId]);

  const valid = cellSet(validAnchors);
  const affected = cellSet(affectedCells);
  const intent = cellSet(presentedIntentCells);
  const previewed = SIDES.includes(previewAnchor?.side) && Number.isInteger(previewAnchor?.index)
    ? cellKey(previewAnchor.side, previewAnchor.index)
    : null;
  const selected = SIDES.includes(selectedAnchor?.side) && Number.isInteger(selectedAnchor?.index)
    ? cellKey(selectedAnchor.side, selectedAnchor.index)
    : null;

  return (
    <section
      ref={battlefieldRef}
      className={`tow-formation-battlefield ${className}`.trim()}
      aria-label="Battle formations"
      aria-busy={movementPhase === "pending" || movementPhase === "settling"}
      data-movement-phase={movementPhase}
      data-reduced-motion={reducedMotion ? "true" : "false"}
    >
      <span
        className="tow-formation-battlefield__announcement"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </span>
      <FormationGrid
        side="enemy"
        actors={actors}
        formation={normalizedFormation(presentedFormations, "enemy")}
        artForActor={artForActor}
        valid={valid}
        affected={affected}
        previewed={previewed}
        selected={selected}
        intent={intent}
        activeActorId={activeActorId}
        onSelectCell={onSelectCell}
        onPreviewCell={onPreviewCell}
        onInspectActor={onInspectActor}
        renderActorOverlay={renderActorOverlay}
        feedbackCues={feedbackCues}
        moveDestinations={moveDestinations}
        arrivingMoves={arrivingMoves}
        consumedFeedbackActorIds={consumedFeedbackActorIds}
        lungeMotions={lungeMotions}
      />
      <span className="tow-formation-battlefield__divide" aria-hidden="true" />
      <FormationGrid
        side="player"
        actors={actors}
        formation={normalizedFormation(presentedFormations, "player")}
        artForActor={artForActor}
        valid={valid}
        affected={affected}
        previewed={previewed}
        selected={selected}
        intent={intent}
        activeActorId={activeActorId}
        onSelectCell={onSelectCell}
        onPreviewCell={onPreviewCell}
        onInspectActor={onInspectActor}
        renderActorOverlay={renderActorOverlay}
        feedbackCues={feedbackCues}
        moveDestinations={moveDestinations}
        arrivingMoves={arrivingMoves}
        consumedFeedbackActorIds={consumedFeedbackActorIds}
        lungeMotions={lungeMotions}
      />
    </section>
  );
}

export default FormationBattlefield;
