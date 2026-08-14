import React, { useEffect, useRef, useState } from "react";
import battleScene from "../../assets/generated/scene-crowsmoor-v2.webp";
import { Icon } from "../Icon.jsx";
import {
  declaredIntents,
  priorityAdvantageFor,
  retreatOdds,
} from "../../gameplay/tow/encounter.js";
import { CHARACTER_ABILITY_TYPE_LABELS } from "../../gameplay/tow/character-abilities.js";
import {
  effectMagnitude,
  getSkill,
  skillLegality,
  usesPerAct,
  UNLIMITED_USES,
} from "../../gameplay/tow/skills.js";
import { normalizeWeaponPresentation } from "../../gameplay/tow/weapon-presentation.js";
import { weaponAttackSummary } from "../../gameplay/tow/weapon-techniques.js";
import { resolveTowCombatArt } from "./tow-combat-art.js";
import { resolveTowAbilityArt, resolveTowActionName } from "./tow-combat-ability-art.js";
import {
  combatCueTimeline,
  combatEventReceipt,
  combatTempoReceipt,
  recentCombatReceipts,
} from "./tow-combat-feedback.js";
import { combatVfxForIntent } from "./tow-combat-vfx.js";
import { combatChoreographyForAction } from "./tow-combat-choreography.js";
import { towStatusPresentation } from "./tow-combat-status.js";
import "./tow-combat.css";

function percent(value, max) {
  return Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
}

const REFUSALS = {
  "on-cooldown": (skill) => `ready in ${skill.cooldownRemaining}`,
  "no-uses-remaining": () => "spent",
  "turn-already-spent": () => "no action left",
  "action-nullified": () => "control forfeits this turn automatically",
  "priority-preempted": () => "enemy Priority resolves first",
  "invalid-skill-state": () => "unavailable",
};

const HOLD_FOR_DETAILS_MS = 420;
const CONTACT_REACTIONS = new Set(["block", "critical", "evade", "hit", "ward"]);
const VITAL_CONTACT_OFFSET_MS = 150;
const TERMINAL_REVEAL_PADDING_MS = 1450;
const FORCED_WINDOW_READ_MS = 900;
const CONTROL_STATUS_TYPES = Object.freeze(["stun", "paralyze", "sleep"]);

function refusalText(reason, skillState) {
  const render = REFUSALS[reason];
  return render ? render(skillState) : "unavailable";
}

function monogram(name) {
  return (String(name || "?").trim()[0] || "?").toUpperCase();
}

function activeControlFor(actor) {
  if (!actor || actor.statuses.some((status) => status.type === "unstoppable" && status.count > 0)) {
    return null;
  }
  return CONTROL_STATUS_TYPES
    .map((type) => actor.statuses.find((status) => status.type === type && status.count > 0))
    .find(Boolean) || null;
}

function domId(value) {
  return String(value || "unknown").replace(/[^a-z0-9_-]+/gi, "-");
}

function statusPanelId(actorId, statusType) {
  return `tow-status-${domId(actorId)}-${domId(statusType)}`;
}

function actionKind(definition) {
  if (definition.abilityType === "basic-attack") return "attack";
  if (definition.abilityType === "defensive") return "guard";
  if (definition.abilityType === "archetype" || definition.abilityType === "general") {
    return definition.consumesTurn ? "technique" : "swift";
  }
  const types = new Set((definition.effects || []).map((effect) => effect.type));
  if (types.has("damage")) return "attack";
  if (types.has("heal") || types.has("heal-lost-fraction")) return "recover";
  if (types.has("shield")) return "guard";
  if ((definition.effects || []).some((effect) => (
    effect.target === "self" && ["guard", "evade", "invincible", "tenacity"].includes(effect.status)
  ))) return "guard";
  return definition.consumesTurn ? "technique" : "swift";
}

function AbilityArt({ src, className = "" }) {
  return (
    <span className={`tow-combat__ability-art ${className}`.trim()} aria-hidden="true">
      <img src={src} alt="" draggable="false" />
      <span className="tow-combat__ability-art-shade" />
      <span className="tow-combat__ability-art-frame" />
      <span className="tow-combat__ability-art-sheen" />
    </span>
  );
}

function effectDetail(definition, effect, effectIndex, rank) {
  const ranked = Array.isArray(effect.percentByRank) || Array.isArray(effect.countByRank);
  const amount = ranked ? effectMagnitude(definition.id, effectIndex, rank) : null;
  if (effect.type === "damage") return `${amount}% ${effect.scale} damage${effect.hits > 1 ? ` × ${effect.hits} hits` : ""}`;
  if (effect.type === "damage-enemy-lost-hp") return `${amount}% of enemy missing health as damage`;
  if (effect.type === "damage-self-lost-hp") return `${amount}% of own missing health as damage`;
  if (effect.type === "damage-enemy-max-hp") return `${amount}% of enemy maximum health as damage`;
  if (effect.type === "delayed-damage") return `${amount} special damage after ${effect.turns} turns`;
  if (effect.type === "temporary-max-hp") {
    return `Gain ${amount} maximum health for ${effect.turns} turns${effect.fatal ? ", then die" : ""}`;
  }
  if (effect.type === "shield") return `${amount}% ${effect.scale} ward`;
  if (effect.type === "heal") return `Restore ${amount}% ${effect.scale} health`;
  if (effect.type === "heal-lost-fraction") return `Restore ${amount}% of lost health`;
  if (effect.type === "scaled-status") {
    return `${amount}% ${effect.scale} ${effect.status.replace(/-/g, " ")}`;
  }
  if (effect.type === "status") return `${amount} ${effect.status.replace(/-/g, " ")}`;
  if (effect.type === "reduce-statuses") {
    const ward = effect.clearShield ? "ward, " : "";
    return `${effect.toPercent === 0 ? "Remove" : "Reduce"} ${ward}${effect.statuses.join(", ")}${effect.toPercent === 0 ? "" : ` to ${effect.toPercent}%`}`;
  }
  if (effect.type === "amplify-statuses") {
    return `Raise ${effect.target === "self" ? "own " : "enemy "}${effect.statuses.join(", ")} to ${amount}%`;
  }
  if (effect.type === "scaled-status-enemy-lost-hp") {
    return `${amount}% of enemy lost health as ${effect.status.replace(/-/g, " ")}`;
  }
  return effect.type.replace(/-/g, " ");
}

export function towSkillDetail(definition, skillState, weaponPresentation = null) {
  if (definition.id === "strike" && weaponPresentation?.attackSnapshot) {
    return weaponAttackSummary(weaponPresentation.attackSnapshot, skillState.rank);
  }
  const effects = definition.effects.map((effect, index) => (
    effectDetail(definition, effect, index, skillState.rank)
  ));
  if (definition.note) effects.push(definition.note.replace(/-/g, " "));
  return effects.join(" · ") || "No immediate combat effect";
}

function SkillDetails({
  definition,
  displayName,
  art,
  weaponPresentation,
  skillState,
  legality,
  limit,
  onDismiss,
}) {
  return (
    <aside
      className={`tow-combat__skill-details tow-combat__skill-details--${actionKind(definition)}`}
      role="dialog"
      aria-modal="false"
      aria-label={`${displayName} details`}
      data-testid="tow-skill-details"
    >
      <AbilityArt src={art} className="tow-combat__skill-details-art" />
      <div className="tow-combat__skill-details-copy">
        <span>{CHARACTER_ABILITY_TYPE_LABELS[definition.abilityType] || definition.rarity} · {definition.rarity} · rank {skillState.rank}</span>
        <strong>{displayName}</strong>
        {definition.id === "strike" ? (
          <b>{weaponPresentation.weaponName} · {weaponPresentation.familyLabel}</b>
        ) : null}
        <p>{towSkillDetail(definition, skillState, weaponPresentation)}</p>
        <small>
          {definition.consumesTurn ? "Spends the action" : "Swift · keeps the action"}
          {limit !== UNLIMITED_USES ? ` · ${skillState.usesRemaining}/${limit} uses` : " · always ready"}
        </small>
        {!legality.ok ? <em>{refusalText(legality.reason, skillState)}</em> : null}
      </div>
      <button type="button" onClick={onDismiss} aria-label="Close skill details">×</button>
    </aside>
  );
}

function CombatAction({
  definition,
  displayName,
  art,
  skillState,
  limit,
  weaponPresentation,
  legality,
  active,
  busy,
  committed,
  firstActionRef,
  onShowDetails,
  onHideDetails,
  onUse,
}) {
  const holdTimerRef = useRef(null);
  const holdTargetRef = useRef(null);
  const heldRef = useRef(false);
  const onCooldown = skillState.cooldownRemaining > 0;
  const hasLimitedUses = limit !== UNLIMITED_USES;
  const resourceAnnouncement = onCooldown
    ? `Cooldown, ${skillState.cooldownRemaining} turn${skillState.cooldownRemaining === 1 ? "" : "s"} remaining`
    : hasLimitedUses
      ? `${skillState.usesRemaining} of ${limit} uses remaining`
      : null;

  function cancelHold() {
    if (holdTimerRef.current !== null) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
    holdTargetRef.current?.removeAttribute("data-held");
    holdTargetRef.current = null;
  }

  function beginHold(event) {
    if (busy) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    cancelHold();
    heldRef.current = false;
    holdTargetRef.current = event.currentTarget;
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      heldRef.current = true;
      onShowDetails();
      holdTargetRef.current?.setAttribute("data-held", "true");
    }, HOLD_FOR_DETAILS_MS);
  }

  function finishHold() {
    if (!heldRef.current) cancelHold();
  }

  function useSkill(event) {
    if (heldRef.current) {
      heldRef.current = false;
      event.preventDefault();
      return;
    }
    if (busy) {
      if (committed) onShowDetails();
      return;
    }
    if (legality.ok) onUse();
    else onShowDetails();
  }

  useEffect(() => cancelHold, []);

  return (
    <button
      ref={firstActionRef}
      type="button"
      className={`tow-combat__action production-combat__action tow-combat__action--${actionKind(definition)}${active ? " is-inspecting" : ""}${committed ? " is-committed" : ""}${onCooldown ? " is-on-cooldown" : ""}${!legality.ok ? " is-unavailable" : ""}`}
      aria-label={`${displayName}. ${towSkillDetail(definition, skillState, weaponPresentation)}.${resourceAnnouncement ? ` ${resourceAnnouncement}.` : ""} ${busy && committed ? "Resolving; tap for details" : legality.ok ? "Tap to use; hold for details" : refusalText(legality.reason, skillState)}`}
      aria-disabled={busy ? !committed : !legality.ok}
      aria-expanded={active}
      disabled={busy && !committed}
      data-skill-id={definition.id}
      onClick={useSkill}
      onPointerDown={beginHold}
      onPointerUp={finishHold}
      onPointerCancel={finishHold}
      onPointerLeave={finishHold}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === "F1" || event.key.toLowerCase() === "i") {
          event.preventDefault();
          onShowDetails();
        }
        if (event.key === "Escape" && active) onHideDetails();
      }}
    >
      <AbilityArt src={art} />
      {onCooldown ? (
        <span className="tow-combat__action-cooldown" aria-hidden="true">
          {skillState.cooldownRemaining}
        </span>
      ) : hasLimitedUses ? (
        <span className="tow-combat__action-uses" aria-hidden="true">
          {skillState.usesRemaining}/{limit}
        </span>
      ) : null}
      <span className="tow-combat__sr-only">{displayName}</span>
    </button>
  );
}

function ArtFigure({ actor, src, side, down = actor.hp <= 0 }) {
  return (
    <div className={`tow-combat__art tow-combat__art--${side}${down ? " is-down" : ""}`}>
      <span className="tow-combat__art-reaction">
        {src ? (
          <img className="tow-combat__art-image" src={src} alt="" aria-hidden="true" draggable="false" />
        ) : (
          <span className="tow-combat__art-monogram" aria-hidden="true">{monogram(actor.name)}</span>
        )}
        <span className="tow-combat__art-shadow" aria-hidden="true" />
      </span>
    </div>
  );
}

function intentOutcomeText(intent) {
  if (intent.damage > 0) {
    return intent.hits > 1 ? `${intent.hits} hits of ${intent.damage}` : `${intent.damage} damage`;
  }
  return `${intent.kind || "ability"} effect`;
}

function IntentBadge({ intent, target, playerId }) {
  if (!intent) return null;
  const visual = combatVfxForIntent(intent);
  const damage = intent.damage > 0
    ? intent.hits > 1 ? `${intent.hits}×${intent.damage}` : intent.damage
    : ({ afflict: "HEX", boon: "BOON", recover: "MEND", ward: "WARD" }[intent.kind] || "ACT");
  const targetName = target?.name || intent.targetName || "your party";
  const outcome = intentOutcomeText(intent);
  const targetText = intent.target === "self" ? "self" : targetName;
  return (
    <div
      className={`tow-combat__intent tow-combat__intent--${visual.family}${intent.damage > 0 && intent.hits > 1 ? " is-multi" : ""}`}
      role="img"
      aria-label={`${intent.name}, ${outcome}, ${intent.target === "self" ? "used on self" : `targeting ${targetName}`}`}
      title={`${intent.name} · ${outcome} · ${targetText}`}
      data-testid="tow-enemy-intent"
      data-ability-id={intent.skillId || intent.attackId || undefined}
    >
      <span className="tow-combat__intent-sigil" aria-hidden="true">
        <img src={visual.asset} alt="" />
        <i />
      </span>
      <strong aria-hidden="true">{damage}</strong>
      <span className="tow-combat__intent-target" aria-hidden="true">
        {intent.target === "self" ? "Self" : `→ ${target?.id === playerId ? "You" : targetName}`}
      </span>
      <span className="tow-combat__intent-name" aria-hidden="true">{intent.name}</span>
      <span className="tow-combat__sr-only">Incoming: {intent.name}</span>
    </div>
  );
}

function statusMap(statuses) {
  return new Map((statuses || []).map((status) => [status.type, status.count]));
}

function statusList(map) {
  return [...map.entries()]
    .filter(([, count]) => count > 0)
    .map(([type, count]) => ({ type, count }));
}

function statusIconStyle(visual) {
  return {
    "--tow-status-icon": `url("${visual.iconAsset || visual.asset}")`,
    "--tow-status-icon-position": visual.iconPosition || "0% 0%",
    "--tow-status-icon-size": visual.iconSize || "cover",
  };
}

function Statuses({ actor, feedbackCues = [], selectedType = null, onToggle }) {
  const [presented, setPresented] = useState(() => actor.statuses.map((status) => ({ ...status })));

  useEffect(() => {
    const exact = actor.statuses.map((status) => ({ ...status }));
    const timed = feedbackCues
      .flatMap((cue) => (cue.statusChanges || [])
        .filter((change) => change.actorId === actor.id)
        .map((change) => ({ ...change, delayMs: cue.delayMs || 0 })))
      .sort((left, right) => left.delayMs - right.delayMs);
    if (timed.length === 0) {
      setPresented(exact);
      return undefined;
    }

    // The encounter is already authoritative and therefore carries the final stack. Walk
    // the hit receipts backwards to reconstruct the pre-action rail, then replay each
    // mutation at the same contact beat as HP and Ward.
    const initial = statusMap(exact);
    for (let index = timed.length - 1; index >= 0; index -= 1) {
      const change = timed[index];
      if (change.before > 0) initial.set(change.type, change.before);
      else initial.delete(change.type);
    }
    setPresented(statusList(initial));

    const grouped = new Map();
    for (const change of timed) {
      if (!grouped.has(change.delayMs)) grouped.set(change.delayMs, []);
      grouped.get(change.delayMs).push(change);
    }
    const timers = [];
    const current = new Map(initial);
    for (const [delayMs, changes] of grouped) {
      for (const change of changes) {
        if (change.after > 0) current.set(change.type, change.after);
        else current.delete(change.type);
      }
      const snapshot = statusList(current);
      timers.push(setTimeout(
        () => setPresented(snapshot),
        Math.max(0, delayMs) + VITAL_CONTACT_OFFSET_MS,
      ));
    }
    const settleDelay = Math.max(...timed.map((change) => change.delayMs))
      + VITAL_CONTACT_OFFSET_MS + 1;
    timers.push(setTimeout(() => setPresented(exact), settleDelay));
    return () => timers.forEach(clearTimeout);
  }, [actor.id, actor.statuses, feedbackCues]);

  if (presented.length === 0) return null;
  return (
    <ul className="tow-combat__statuses" aria-label={`${actor.name} status effects`}>
      {presented.map((status) => {
        const detail = towStatusPresentation(status);
        const selected = status.type === selectedType;
        return (
          <li key={status.type} className="tow-combat__status">
            <button
              type="button"
              className={`tow-combat__status-button tow-combat__status-button--${detail.visual.family}`}
              aria-label={`${detail.name}, ${detail.countLabel}. Tap for details.`}
              aria-expanded={selected}
              aria-controls={selected ? statusPanelId(actor.id, status.type) : undefined}
              aria-pressed={selected}
              title={`${detail.name} · ${detail.countLabel}`}
              onClick={() => onToggle?.(status.type)}
            >
              <span className="tow-combat__status-art" style={statusIconStyle(detail.visual)} aria-hidden="true">
                <i />
              </span>
              <strong aria-hidden="true">{status.count}</strong>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function StatusDetails({ actor, status, source, enemy = false, onDismiss }) {
  const detail = towStatusPresentation(status);
  return (
    <aside
      id={statusPanelId(actor.id, status.type)}
      className={`tow-combat__status-details${enemy ? " tow-combat__status-details--enemy tow-combat__status-details--intent-safe" : ""}`}
      data-tone={detail.tone}
      data-testid="tow-status-details"
      role="dialog"
      aria-modal="false"
      aria-label={`${detail.name} status details`}
    >
      <span
        className={`tow-combat__status-details-art tow-combat__status-details-art--${detail.visual.family}`}
        style={statusIconStyle(detail.visual)}
        aria-hidden="true"
      >
        <i />
      </span>
      <span className="tow-combat__status-details-copy">
        <small>{detail.toneLabel} · {detail.countLabel}</small>
        <strong>{detail.name}</strong>
        <p>{detail.effect}</p>
        <span>{detail.lifecycle}</span>
        {source ? <em>Latest · {source.text}</em> : null}
      </span>
      <button type="button" onClick={onDismiss} aria-label={`Close ${detail.name} details`}>×</button>
    </aside>
  );
}

function Vitals({ actor, enemy = false, feedbackCues = [], reacting = false }) {
  const [presented, setPresented] = useState({
    actorId: actor.id,
    hp: actor.hp,
    maxHp: actor.maxHp,
    shield: actor.shield,
  });
  const presentedRef = useRef(presented);
  const reactions = feedbackCues.filter((cue) => cue.targetId === actor.id);
  const feedbackDelay = reactions.length > 0
    ? Math.max(...reactions.map((cue) => cue.delayMs || 0))
    : 0;

  useEffect(() => {
    const changes = feedbackCues
      .filter((cue) => cue.targetId === actor.id && (cue.hpChange || cue.shieldChange))
      .sort((left, right) => (left.delayMs || 0) - (right.delayMs || 0));
    const timers = [];
    const exact = { actorId: actor.id, hp: actor.hp, maxHp: actor.maxHp, shield: actor.shield };
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
      && previous.maxHp === actor.maxHp
      && Math.max(0, Math.min(actor.maxHp, previous.hp + totalHpChange)) === actor.hp
      && Math.max(0, previous.shield + totalShieldChange) === actor.shield;
    let hp = previousReconciles
      ? previous.hp
      : Math.max(0, Math.min(actor.maxHp, actor.hp - totalHpChange));
    let shield = previousReconciles
      ? previous.shield
      : Math.max(0, actor.shield - totalShieldChange);
    present({ actorId: actor.id, hp, maxHp: actor.maxHp, shield });

    for (const cue of changes) {
      hp = Math.max(0, Math.min(actor.maxHp, hp + (cue.hpChange || 0)));
      shield = Math.max(0, shield + (cue.shieldChange || 0));
      const snapshot = { actorId: actor.id, hp, maxHp: actor.maxHp, shield };
      timers.push(setTimeout(
        () => present(snapshot),
        Math.max(0, cue.delayMs || 0) + VITAL_CONTACT_OFFSET_MS,
      ));
    }

    const settleDelay = Math.max(...changes.map((cue) => cue.delayMs || 0))
      + VITAL_CONTACT_OFFSET_MS + 1;
    timers.push(setTimeout(() => present(exact), settleDelay));
    return () => timers.forEach(clearTimeout);
  }, [actor.id, actor.hp, actor.maxHp, actor.shield, feedbackCues, feedbackDelay]);

  return (
    <div
      className={`tow-combat__vitals${enemy ? " tow-combat__vitals--enemy" : ""}${reacting ? " is-reacting" : ""}`}
      style={{ "--tow-vitals-delay": `${feedbackDelay}ms` }}
    >
      <div
        className="tow-combat__bar"
        role="meter"
        aria-label={`${actor.name} health`}
        aria-valuemin="0"
        aria-valuemax={presented.maxHp}
        aria-valuenow={presented.hp}
      >
        <span className="tow-combat__bar-hp" style={{ width: `${percent(presented.hp, presented.maxHp)}%` }} />
        {presented.shield > 0 ? (
          <span
            className="tow-combat__bar-shield"
            style={{ width: `${percent(presented.shield, presented.maxHp)}%` }}
          />
        ) : null}
        <span className="tow-combat__bar-value">
          <strong>{presented.hp}</strong>
          <span>/ {presented.maxHp}</span>
          {presented.shield > 0 ? <em>+{presented.shield} ward</em> : null}
        </span>
      </div>
    </div>
  );
}

function CombatantPlate({
  actor,
  role,
  enemy = false,
  feedbackCues = [],
  selectedStatusType = null,
  statusSource = null,
  onToggleStatus = null,
  record = null,
}) {
  const reactions = feedbackCues.filter((cue) => cue.targetId === actor.id);
  const selectedStatus = actor.statuses.find((status) => status.type === selectedStatusType) || null;
  const hasStagedStatuses = feedbackCues.some((cue) => (
    cue.statusChanges || []
  ).some((change) => change.actorId === actor.id));
  const hasTools = actor.statuses.length > 0 || hasStagedStatuses || record;
  return (
    <div className={`tow-combat__plate${enemy ? " tow-combat__plate--enemy" : " tow-combat__plate--hero"}`}>
      <div className="tow-combat__identity">
        <span>{role}</span>
        <h2>{actor.name}</h2>
      </div>
      <Vitals actor={actor} enemy={enemy} feedbackCues={feedbackCues} reacting={reactions.length > 0} />
      {hasTools ? (
        <div className="tow-combat__status-tools">
          {record ? <CombatRecord {...record} compact /> : null}
          <Statuses
            actor={actor}
            feedbackCues={feedbackCues}
            selectedType={selectedStatusType}
            onToggle={onToggleStatus}
          />
        </div>
      ) : null}
      {selectedStatus ? (
        <StatusDetails
          actor={actor}
          status={selectedStatus}
          source={statusSource}
          enemy={enemy}
          onDismiss={() => onToggleStatus?.(selectedStatus.type)}
        />
      ) : null}
    </div>
  );
}

function targetLabel(actor, intent) {
  if (actor.hp <= 0) return `${actor.name}, down`;
  const health = `${actor.hp} of ${actor.maxHp} health`;
  if (!intent) return `Target ${actor.name}, ${health}`;
  const blow = intentOutcomeText(intent);
  return `Target ${actor.name}, ${health}, preparing ${intent.name} for ${blow}`;
}

function actionsLeft(encounter, actorId) {
  if (actorId === encounter.playerId) return encounter.turn.actionsRemaining;
  return encounter.turn.allies?.[actorId] ?? 0;
}

function eventTouchesStatus(event, actorId, statusType) {
  if (event.type === "trait-fired") {
    const targetMatches = Array.isArray(event.targetIds)
      ? event.targetIds.includes(actorId)
      : event.actorId === actorId;
    return targetMatches && event.status === statusType;
  }
  if (event.type === "skill-status") {
    const targetId = event.targetId || (event.target === "self" ? event.actorId : null);
    return targetId === actorId && event.status === statusType;
  }
  if (event.type === "skill-status-amplified") {
    return event.targetId === actorId && event.statuses?.includes(statusType);
  }
  return false;
}

function actorFeedbackClasses(actorId, cues) {
  const classes = [];
  if (cues.some((cue) => cue.attackerId === actorId && cue.targetId !== actorId)) {
    classes.push("is-feedback-attacking");
  }
  for (const cue of cues) {
    if (cue.targetId !== actorId) continue;
    classes.push(`is-feedback-${cue.kind}`);
    if (cue.visual?.family) classes.push(`is-feedback-vfx-${cue.visual.family}`);
  }
  if (cues.filter((cue) => cue.targetId === actorId && CONTACT_REACTIONS.has(cue.kind)).length > 1) {
    classes.push("is-feedback-multi-hit");
  }
  return [...new Set(classes)].join(" ");
}

function actorFeedbackStyle(actorId, cues) {
  const attacks = cues.filter((cue) => cue.attackerId === actorId && cue.targetId !== actorId);
  const reactions = cues.filter((cue) => cue.targetId === actorId);
  const contacts = reactions.filter((cue) => CONTACT_REACTIONS.has(cue.kind));
  return {
    "--tow-attack-delay": `${attacks.length ? Math.min(...attacks.map((cue) => cue.delayMs || 0)) : 0}ms`,
    "--tow-reaction-delay": `${reactions.length ? Math.min(...reactions.map((cue) => cue.delayMs || 0)) : 0}ms`,
    "--tow-reaction-count": Math.max(1, contacts.length),
  };
}

function CombatEffects({ cues }) {
  if (cues.length === 0) return null;
  return (
    <div className="tow-combat__effects" aria-hidden="true">
      {cues.map((cue, index) => {
        const lane = cues
          .slice(0, index)
          .filter((priorCue) => priorCue.targetSide === cue.targetSide)
          .length;
        const laneX = [-38, 38, 0][lane % 3];
        const laneY = [0, -18, 14][lane % 3];
        const profile = cue.visual?.profile || {};
        return (
          <span
            key={cue.id || `${cue.sequence}-${cue.kind}-${cue.targetId || index}`}
            className={`tow-combat__effect tow-combat__effect--${cue.kind} tow-combat__effect--${cue.targetSide} tow-combat__effect--vfx-${cue.visual?.family || "impact"} tow-combat__effect--motion-${cue.visual?.motion || "balanced"}`}
            data-vfx-variant={cue.visual?.variant || "unknown"}
            data-hit-index={cue.hitIndex ?? 0}
            data-hit-count={cue.hitCount ?? 1}
            data-action-index={cue.actionIndex ?? 0}
            data-effect-lane={lane}
            data-vfx-profile={profile.key || undefined}
            data-vfx-source={cue.visual?.assetSource || "family"}
            style={{
              "--tow-effect-delay": `${cue.delayMs || 0}ms`,
              "--tow-effect-x": `${laneX}px`,
              "--tow-effect-y": `${laneY}px`,
              "--tow-signature-rotate": profile.rotate || "0deg",
              "--tow-signature-scale": profile.scale || 1,
              "--tow-signature-x": profile.x || "0%",
              "--tow-signature-y": profile.y || "0%",
              "--tow-signature-delay": profile.delay || "0ms",
              "--tow-signature-mirror": profile.mirror || 1,
            }}
          >
            {cue.visual?.signatureAsset && cue.visual.signatureAsset !== cue.visual.asset ? (
              <img className="tow-combat__effect-signature" src={cue.visual.signatureAsset} alt="" />
            ) : null}
            {cue.visual?.asset ? <img className="tow-combat__effect-asset" src={cue.visual.asset} alt="" /> : null}
            {cue.outcomeAsset && cue.outcomeAsset !== cue.visual?.asset ? (
              <img className="tow-combat__effect-outcome" src={cue.outcomeAsset} alt="" />
            ) : null}
            <span className="tow-combat__effect-particles"><i /><i /><i /></span>
            <b>
              {cue.kicker ? <small>{cue.kicker}</small> : null}
              <span>{cue.label}</span>
            </b>
            {(cue.hitCount || 1) > 1 ? <em>{(cue.hitIndex || 0) + 1}/{cue.hitCount}</em> : null}
          </span>
        );
      })}
    </div>
  );
}

function CombatRecord({ receipts, tempo, opening, expanded, onToggle, compact = false }) {
  const latest = receipts.at(-1) || tempo || opening;
  if (!latest) return null;
  const rows = [tempo, opening, ...receipts].filter(Boolean);
  if (compact) {
    return (
      <section className={`tow-combat__record tow-combat__record--compact${expanded ? " is-expanded" : ""}`} aria-label="Combat log">
        <button
          type="button"
          className="tow-combat__record-trigger"
          aria-label={`Combat log. Latest: ${latest.text}`}
          aria-expanded={expanded}
          aria-controls={expanded ? "tow-combat-record-list" : undefined}
          title="Combat log"
          onClick={onToggle}
        >
          <Icon name="journal" size={25} />
          <b aria-hidden="true">{Math.min(rows.length, 9)}</b>
        </button>
        {expanded ? (
          <ol id="tow-combat-record-list" className="tow-combat__record-list">
            {rows.map((receipt, index) => (
              <li key={`${receipt.sequence}-${index}`} data-kind={receipt.kind}>{receipt.text}</li>
            ))}
          </ol>
        ) : null}
      </section>
    );
  }
  return (
    <section className={`tow-combat__record${expanded ? " is-expanded" : ""}`} aria-label="Combat record">
      <button
        type="button"
        className="tow-combat__record-summary"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span>Latest</span>
        <p aria-live="polite">{latest.text}</p>
        <b>{expanded ? "Close" : "Details"}</b>
      </button>
      {expanded ? (
        <ol className="tow-combat__record-list">
          {rows.map((receipt, index) => (
            <li key={`${receipt.sequence}-${index}`} data-kind={receipt.kind}>{receipt.text}</li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function ActionDeclaration({
  label,
  visual,
  art = null,
  actorName,
  side = "player",
  delayMs = 0,
  durationMs = 860,
  testId = null,
}) {
  return (
    <span
      className={`tow-combat__declaration tow-combat__declaration--${side} tow-combat__declaration--${visual.family}`}
      style={{
        "--tow-declaration-delay": `${delayMs}ms`,
        "--tow-declaration-duration": `${durationMs}ms`,
      }}
      data-testid={testId || undefined}
      role={side === "player" ? "status" : undefined}
      aria-live={side === "player" ? "assertive" : undefined}
      aria-hidden={side === "enemy" ? "true" : undefined}
    >
      <span className="tow-combat__declaration-sigil" aria-hidden="true">
        <img src={art || visual.asset} alt="" />
        <i />
      </span>
      <small aria-hidden="true">{side === "enemy" ? actorName : "Declared"}</small>
      <strong aria-hidden="true">{label}</strong>
      {side === "player" ? (
        <span className="tow-combat__sr-only">
          {actorName === "You" ? "You declare" : `${actorName} declares`} {label}
        </span>
      ) : null}
    </span>
  );
}

function CombatDeclarations({ beat, cues, encounter }) {
  const seenActions = new Set();
  const enemyDeclarations = [];
  const playerDeclarationDuration = beat
    ? Math.max(820, beat.choreography.windupMs + 520)
    : 0;
  for (const cue of cues) {
    const actor = encounter.actors[cue.attackerId];
    if (actor?.side !== "enemy" || seenActions.has(cue.actionIndex)) continue;
    seenActions.add(cue.actionIndex);
    enemyDeclarations.push({ cue, actor });
  }
  if (!beat && enemyDeclarations.length === 0) return null;
  return (
    <div className="tow-combat__declarations" aria-label="Declared actions">
      {beat ? (
        <ActionDeclaration
          label={beat.displayName}
          visual={beat.choreography.visual}
          art={beat.art}
          actorName={beat.actorName}
          durationMs={playerDeclarationDuration}
          testId="tow-action-beat"
        />
      ) : null}
      {enemyDeclarations.map(({ cue, actor }) => (
        <ActionDeclaration
          key={`enemy-declaration-${cue.actionIndex}-${cue.sequence}`}
          label={cue.declarationLabel}
          visual={cue.visual}
          art={cue.skillId ? resolveTowAbilityArt(getSkill(cue.skillId), null) : null}
          actorName={actor.name}
          side="enemy"
          // The enemy answers after the committed action has had its own title beat. Their
          // declarations share one language, but never print on top of each other.
          delayMs={beat
            ? Math.max(cue.delayMs || 0, playerDeclarationDuration)
            : cue.delayMs || 0}
        />
      ))}
    </div>
  );
}

export function TowCombatView({
  encounter,
  onUseSkill,
  onStandDown,
  onSettle,
  onRetreat = null,
  onEscape = null,
  escapeLabel = "Leave fight",
  note,
  error,
  saveState = null,
  artFor = null,
  weaponFor = null,
  playerPortraitKey = null,
  sceneArt = battleScene,
  returnFocusSelector = ".story-input__field",
}) {
  const firstActionRef = useRef(null);
  const settleRef = useRef(null);
  const restoreFocusRef = useRef(null);
  const seenEventRef = useRef(encounter.sequence);
  const authoritativePhaseRef = useRef(encounter.phase);
  const impactClearTimerRef = useRef(null);
  const terminalRevealTimerRef = useRef(null);
  const forcedAdvanceRef = useRef(null);
  const [targetId, setTargetId] = useState(null);
  const [commanderId, setCommanderId] = useState(null);
  const [inspectedSkillId, setInspectedSkillId] = useState(null);
  const [inspectedStatus, setInspectedStatus] = useState(null);
  const [recordExpanded, setRecordExpanded] = useState(false);
  const [impactCues, setImpactCues] = useState([]);
  const [actionBeat, setActionBeat] = useState(null);
  const [terminalRevealed, setTerminalRevealed] = useState(() => encounter.phase !== "player");
  const actionTimersRef = useRef({ commit: null, release: null });

  const player = encounter.actors[encounter.playerId];
  const allies = (encounter.allyIds || []).map((id) => encounter.actors[id]);
  const playerSide = [player, ...allies];
  const enemies = encounter.enemyIds.map((id) => encounter.actors[id]);
  const living = enemies.filter((enemy) => enemy.hp > 0);
  const authoritativeTerminal = encounter.phase !== "player";
  const terminal = authoritativeTerminal && terminalRevealed;
  const terminalHold = authoritativeTerminal && !terminalRevealed;
  const presentationLocked = Boolean(actionBeat) || terminalHold || impactCues.length > 0;
  const activeTarget = living.find((enemy) => enemy.id === targetId)?.id || living[0]?.id || null;
  const commandable = playerSide.filter((actor) => actor.hp > 0);
  const activeCommander = commandable.find((actor) => (
    actor.id === commanderId && actionsLeft(encounter, actor.id) > 0
  ))
    || commandable.find((actor) => actionsLeft(encounter, actor.id) > 0)
    || commandable.find((actor) => actor.id === commanderId)
    || commandable[0]
    || player;
  const activeControl = activeControlFor(activeCommander);
  const hostilePriority = enemies.reduce(
    (most, enemy) => Math.max(most, priorityAdvantageFor(encounter, enemy.id)),
    0,
  );
  const forcedWindow = activeControl
    ? { kind: "control", label: activeControl.type.replace(/\b\w/g, (letter) => letter.toUpperCase()) }
    : hostilePriority > 0
      ? { kind: "priority", label: `Enemy Priority ${hostilePriority}` }
      : null;
  const stagedHero = playerSide.find((actor) => actor.id === actionBeat?.actorId)
    || activeCommander
    || player;
  const reserves = playerSide.filter((actor) => actor.id !== stagedHero.id);
  const commanderPossessive = activeCommander.id === encounter.playerId
    ? "your"
    : `${activeCommander.name}'s`;
  const commanderBuild = activeCommander.id === encounter.playerId
    ? encounter.build
    : encounter.allyBuilds?.[activeCommander.id];
  function weaponPresentationFor(actor) {
    const actorBuild = actor.id === encounter.playerId
      ? encounter.build
      : encounter.allyBuilds?.[actor.id];
    const supplied = typeof weaponFor === "function" ? weaponFor(actor) : null;
    return normalizeWeaponPresentation({
      ...supplied,
      ...(actorBuild?.basicAttack ? {
        activeFormId: actorBuild.basicAttack.formId,
        attackSnapshot: actorBuild.basicAttack,
      } : {}),
    });
  }
  const commanderWeapon = weaponPresentationFor(activeCommander);
  const skillRows = (commanderBuild?.skills || []).map((skillState) => {
    const definition = getSkill(skillState.id);
    const legality = forcedWindow
      ? { ok: false, reason: forcedWindow.kind === "control" ? "action-nullified" : "priority-preempted" }
      : skillLegality(skillState, {
        turnAvailable: actionsLeft(encounter, activeCommander.id) > 0,
      });
    return {
      art: resolveTowAbilityArt(definition, commanderWeapon),
      definition,
      displayName: resolveTowActionName(definition, commanderWeapon),
      legality,
      limit: usesPerAct(skillState.id, skillState.rank),
      skillState,
      weaponPresentation: commanderWeapon,
    };
  });
  const inspectedSkill = skillRows.find(({ skillState }) => skillState.id === inspectedSkillId) || null;
  const declared = terminal ? [] : declaredIntents(encounter);
  const intents = Object.fromEntries(declared.map((intent) => [intent.enemyId, intent]));
  const fallen = enemies.filter((enemy) => enemy.hp <= 0).length;
  const staged = enemies.find((enemy) => enemy.id === activeTarget) || enemies[0];
  const retreat = authoritativeTerminal ? null : retreatOdds(encounter);
  const receiptOptions = {
    skillName: (event) => {
      const actor = encounter.actors[event.actorId];
      const definition = getSkill(event.skillId);
      return resolveTowActionName(definition, actor ? weaponPresentationFor(actor) : commanderWeapon);
    },
  };
  function statusReceiptFor(actorId, statusType) {
    const event = [...encounter.events].reverse().find((entry) => (
      eventTouchesStatus(entry, actorId, statusType)
    ));
    return event ? combatEventReceipt(encounter, event, receiptOptions) : null;
  }
  function toggleStatus(actorId, statusType) {
    setInspectedSkillId(null);
    setRecordExpanded(false);
    setInspectedStatus((current) => (
      current?.actorId === actorId && current?.type === statusType
        ? null
        : { actorId, type: statusType }
    ));
  }
  const receipts = recentCombatReceipts(encounter, receiptOptions);
  const tempoReceipt = combatTempoReceipt(encounter, activeCommander.id);
  const activeIntent = intents[staged?.id];
  const openingReceipt = activeIntent ? {
    sequence: `intent-${encounter.round}-${staged?.id}`,
    kind: "intent",
    text: `${staged.name} declares ${activeIntent.name}${activeIntent.target === "self" ? "" : ` against ${encounter.actors[activeIntent.targetId]?.name || activeIntent.targetName || "the party"}`}: ${intentOutcomeText(activeIntent)}. ${activeCommander.id === encounter.playerId ? "You have" : `${activeCommander.name} has`} ${actionsLeft(encounter, activeCommander.id)} action${actionsLeft(encounter, activeCommander.id) === 1 ? "" : "s"}.`,
  } : null;
  const swiftReceipt = (() => {
    if (receipts.length === 0) return null;
    const latestCommandEvents = encounter.events.filter((event) => (
      event.sequence > Math.max(0, encounter.sequence - 8)
    ));
    const lastSkillEffect = [...latestCommandEvents].reverse().find((event) => (
      event.skillId && ["skill-damage", "skill-shield", "skill-heal", "skill-cleanse", "skill-status"].includes(event.type)
    ));
    if (!lastSkillEffect) return null;
    const build = lastSkillEffect.actorId === encounter.playerId
      ? encounter.build
      : encounter.allyBuilds?.[lastSkillEffect.actorId];
    const definition = getSkill(lastSkillEffect.skillId);
    if (definition.consumesTurn || !build?.skills?.some((skill) => skill.id === lastSkillEffect.skillId)) return null;
    const actor = encounter.actors[lastSkillEffect.actorId];
    const left = actionsLeft(encounter, lastSkillEffect.actorId);
    return {
      sequence: `swift-${lastSkillEffect.sequence}`,
      kind: "swift",
      text: `${actor.name}'s ${resolveTowActionName(definition, weaponPresentationFor(actor))} is Swift; ${left} action${left === 1 ? "" : "s"} kept.`,
    };
  })();
  function combatArt(actor) {
    const supplied = typeof artFor === "function" ? artFor(actor) : null;
    return supplied || resolveTowCombatArt(actor, {
      playerId: encounter.playerId,
      playerPortraitKey,
    });
  }

  function clearActionTimer(name) {
    if (actionTimersRef.current[name] !== null) clearTimeout(actionTimersRef.current[name]);
    actionTimersRef.current[name] = null;
  }

  function clearTerminalRevealTimer() {
    if (terminalRevealTimerRef.current !== null) clearTimeout(terminalRevealTimerRef.current);
    terminalRevealTimerRef.current = null;
  }

  function clearImpactCueTimer() {
    if (impactClearTimerRef.current !== null) clearTimeout(impactClearTimerRef.current);
    impactClearTimerRef.current = null;
  }

  function releaseActionBeat() {
    clearActionTimer("release");
    setActionBeat(null);
  }

  function queueSkillAction(row) {
    if (presentationLocked || !row.legality.ok) return;
    const reducedMotion = typeof window !== "undefined"
      && typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const choreography = combatChoreographyForAction(
      row.definition,
      row.weaponPresentation,
      { reducedMotion },
    );
    const target = choreography.target === "enemy"
      ? encounter.actors[activeTarget]
      : activeCommander;
    const beat = {
      actorId: activeCommander.id,
      actorName: activeCommander.id === encounter.playerId ? "You" : activeCommander.name,
      art: row.art,
      choreography,
      displayName: row.displayName,
      phase: "windup",
      sequence: encounter.sequence,
      skillId: row.skillState.id,
      targetId: target?.id || activeTarget,
      targetName: target?.id === activeCommander.id ? "the stance" : target?.name || "the target",
    };
    setInspectedSkillId(null);
    setInspectedStatus(null);
    setRecordExpanded(false);
    setActionBeat(beat);
    clearActionTimer("commit");
    actionTimersRef.current.commit = setTimeout(() => {
      actionTimersRef.current.commit = null;
      try {
        onUseSkill(row.skillState.id, activeTarget, activeCommander.id);
      } finally {
        setActionBeat((current) => current ? { ...current, phase: "resolve" } : current);
        clearActionTimer("release");
        actionTimersRef.current.release = setTimeout(releaseActionBeat, choreography.recoveryMs);
      }
    }, choreography.windupMs);
  }

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

  useEffect(() => () => {
    clearActionTimer("commit");
    clearActionTimer("release");
    clearImpactCueTimer();
    clearTerminalRevealTimer();
  }, []);

  useEffect(() => {
    (terminal ? settleRef.current : firstActionRef.current)?.focus();
  }, [terminal]);

  useEffect(() => {
    setInspectedSkillId(null);
    setInspectedStatus(null);
    setRecordExpanded(false);
  }, [activeCommander.id, encounter.round, terminal]);

  useEffect(() => {
    const previousPhase = authoritativePhaseRef.current;
    const enteringTerminal = previousPhase === "player" && encounter.phase !== "player";
    authoritativePhaseRef.current = encounter.phase;
    if (encounter.phase === "player") {
      clearTerminalRevealTimer();
      setTerminalRevealed(false);
    }
    if (encounter.sequence <= seenEventRef.current) {
      seenEventRef.current = encounter.sequence;
      if (enteringTerminal) setTerminalRevealed(true);
      return undefined;
    }
    const nextCues = combatCueTimeline(
      encounter,
      encounter.events.filter((entry) => entry.sequence > seenEventRef.current),
    );
    seenEventRef.current = encounter.sequence;
    if (nextCues.length === 0) {
      if (enteringTerminal) setTerminalRevealed(true);
      return undefined;
    }
    setImpactCues(nextCues);
    const finalDelay = Math.max(0, ...nextCues.map((cue) => cue.delayMs || 0));
    clearImpactCueTimer();
    impactClearTimerRef.current = setTimeout(() => {
      impactClearTimerRef.current = null;
      setImpactCues([]);
    }, finalDelay + TERMINAL_REVEAL_PADDING_MS);
    if (enteringTerminal) {
      setTerminalRevealed(false);
      clearTerminalRevealTimer();
      terminalRevealTimerRef.current = setTimeout(() => {
        terminalRevealTimerRef.current = null;
        setTerminalRevealed(true);
      }, finalDelay + TERMINAL_REVEAL_PADDING_MS);
    }
    if (actionBeat) {
      setActionBeat((current) => current ? { ...current, phase: "resolve" } : current);
      clearActionTimer("release");
      actionTimersRef.current.release = setTimeout(
        releaseActionBeat,
        finalDelay + (enteringTerminal ? TERMINAL_REVEAL_PADDING_MS : 1050),
      );
    }
    return undefined;
  }, [encounter, encounter.sequence]);

  // A controlled or out-prioritised command window is presentation, never input. Keeping
  // the authoritative Stand Down command means the skipped window remains replayable; the
  // short read hold lets the status rail and declaration explain why before the enemy line
  // advances on its own. The sequence key prevents Strict Mode or a harmless rerender from
  // dispatching the same forced command twice.
  useEffect(() => {
    if (
      terminal
      || presentationLocked
      || !forcedWindow
      || actionsLeft(encounter, activeCommander.id) <= 0
      || typeof onStandDown !== "function"
    ) return undefined;
    const key = `${encounter.sequence}:${activeCommander.id}:${forcedWindow.kind}`;
    if (forcedAdvanceRef.current === key) return undefined;
    const timer = setTimeout(() => {
      forcedAdvanceRef.current = key;
      onStandDown(activeCommander.id);
    }, FORCED_WINDOW_READ_MS);
    return () => clearTimeout(timer);
  }, [
    activeCommander.id,
    encounter,
    encounter.sequence,
    forcedWindow?.kind,
    onStandDown,
    presentationLocked,
    terminal,
  ]);

  function keepFocusInside(event) {
    if (event.key === "Escape") {
      if (inspectedSkillId) {
        event.preventDefault();
        setInspectedSkillId(null);
      } else if (inspectedStatus) {
        event.preventDefault();
        setInspectedStatus(null);
      } else if (recordExpanded) {
        event.preventDefault();
        setRecordExpanded(false);
      } else if (presentationLocked) {
        event.preventDefault();
      } else if (onEscape) {
        event.preventDefault();
        onEscape();
      }
      return;
    }
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

  function enemyToken(enemy) {
    const targetable = !terminal && enemy.hp > 0;
    const body = (
      <>
        <span className="tow-combat__foe-token-state" aria-hidden="true" />
        <span className="tow-combat__foe-token-name">{enemy.name}</span>
        <span className="tow-combat__foe-token-hp">{enemy.hp}/{enemy.maxHp}</span>
      </>
    );
    return targetable ? (
      <button
        key={enemy.id}
        type="button"
        className="tow-combat__foe-token production-combat__fighter--target"
        aria-label={targetLabel(enemy, intents[enemy.id])}
        aria-pressed={enemy.id === activeTarget}
        disabled={presentationLocked}
        onClick={() => setTargetId(enemy.id)}
      >
        {body}
      </button>
    ) : (
      <article
        key={enemy.id}
        className={`tow-combat__foe-token${enemy.hp <= 0 && terminal ? " is-down" : ""}`}
        aria-label={`Foe: ${enemy.name}`}
      >
        {body}
      </article>
    );
  }

  return (
    <div
      className={`tow-combat${terminal ? " is-terminal" : ""}${presentationLocked ? " is-presenting-action" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tow-combat-title"
      tabIndex="-1"
      aria-busy={presentationLocked}
      data-presentation-phase={actionBeat?.phase || (terminalHold ? "resolution-hold" : "ready")}
      data-action-motion={actionBeat?.choreography.visual.motion || undefined}
      onKeyDown={keepFocusInside}
    >
      <img className="tow-combat__scene" src={sceneArt} alt="" aria-hidden="true" />
      <div className="tow-combat__backdrop" aria-hidden="true" />

      <main className="tow-combat__stage">
        <header className="tow-combat__header">
          <h1 id="tow-combat-title" className="tow-combat__sr-only">
            {terminal
              ? encounter.phase === "victory" ? "Victory" : encounter.phase === "retreated" ? "Retreated" : "Defeat"
              : `Combat, round ${encounter.round}`}
          </h1>
          <p className="tow-combat__round">
            <span>Round</span>
            <strong>{encounter.round}</strong>
            {!terminal ? (
              <em>{presentationLocked
                ? actionBeat?.phase === "windup" ? "Action committed" : "Reading the exchange"
                : activeCommander.id === encounter.playerId ? "Your move" : `${activeCommander.name}'s move`}</em>
            ) : null}
          </p>
          <p className="tow-combat__context">
            {terminal
              ? encounter.phase === "victory" ? "Victory" : encounter.phase === "retreated" ? "Retreated" : "Defeat"
              : note}
          </p>
          <div className="tow-combat__header-controls">
            {!authoritativeTerminal && onRetreat ? (
              <button
                type="button"
                className="tow-combat__escape tow-combat__escape--retreat"
                onClick={() => onRetreat(activeCommander.id)}
                disabled={presentationLocked || Boolean(forcedWindow)}
                aria-label={`Attempt retreat. ${retreat.chancePercent}% chance. Spends ${commanderPossessive} action on failure.`}
              >
                <Icon name="arrowLeft" size={15} />
                <span>Retreat · {retreat.chancePercent}%</span>
              </button>
            ) : null}
            {onEscape ? (
              <button type="button" className="tow-combat__escape" onClick={onEscape} disabled={presentationLocked}>
                <Icon name="x" size={15} />
                <span>{escapeLabel}</span>
              </button>
            ) : null}
          </div>
        </header>

        <section className="tow-combat__battlefield" aria-label="Combatants">
          <span className="tow-combat__battle-light tow-combat__battle-light--foe" aria-hidden="true" />
          <span className="tow-combat__battle-light tow-combat__battle-light--hero" aria-hidden="true" />

          {staged ? (
            <article
              className={`tow-combat__threat${staged.hp <= 0 && terminal ? " is-down" : ""}${actionBeat?.targetId === staged.id ? " is-action-targeted" : ""} ${actorFeedbackClasses(staged.id, impactCues)}`.trim()}
              style={actorFeedbackStyle(staged.id, impactCues)}
              aria-label={`Foe: ${staged.name}`}
            >
              <ArtFigure actor={staged} src={combatArt(staged)} side="foe" down={staged.hp <= 0 && terminal} />
              {!terminal ? <IntentBadge intent={intents[staged.id]} target={encounter.actors[intents[staged.id]?.targetId]} playerId={encounter.playerId} /> : null}
              <CombatantPlate
                actor={staged}
                role={actionBeat?.targetId === staged.id ? "Marked foe" : "Foe"}
                enemy
                feedbackCues={impactCues}
                selectedStatusType={inspectedStatus?.actorId === staged.id ? inspectedStatus.type : null}
                statusSource={inspectedStatus?.actorId === staged.id
                  ? statusReceiptFor(staged.id, inspectedStatus.type)
                  : null}
                onToggleStatus={(statusType) => toggleStatus(staged.id, statusType)}
              />
            </article>
          ) : null}

          {enemies.length > 1 ? (
            <section className="tow-combat__foe-rail" aria-label="Choose a foe">
              {enemies.map(enemyToken)}
            </section>
          ) : null}

          {!terminal ? (
            <CombatDeclarations beat={actionBeat} cues={impactCues} encounter={encounter} />
          ) : null}

          <CombatEffects cues={impactCues} />

          <article
            className={`tow-combat__hero${stagedHero.hp <= 0 && terminal ? " is-down" : ""}${actionBeat?.actorId === stagedHero.id && actionBeat.phase === "windup" ? ` is-action-windup is-action-motion-${actionBeat.choreography.visual.motion}` : ""} ${actorFeedbackClasses(stagedHero.id, impactCues)}`.trim()}
            style={{
              ...actorFeedbackStyle(stagedHero.id, impactCues),
              "--tow-action-windup": `${actionBeat?.choreography.windupMs || 0}ms`,
            }}
            aria-label={stagedHero.id === encounter.playerId ? `You: ${stagedHero.name}` : `Ally: ${stagedHero.name}`}
          >
            <ArtFigure actor={stagedHero} src={combatArt(stagedHero)} side="hero" down={stagedHero.hp <= 0 && terminal} />
            <CombatantPlate
              key={stagedHero.id}
              actor={stagedHero}
              role={stagedHero.id === encounter.playerId ? "You" : "Ally acting"}
              feedbackCues={impactCues}
              selectedStatusType={inspectedStatus?.actorId === stagedHero.id ? inspectedStatus.type : null}
              statusSource={inspectedStatus?.actorId === stagedHero.id
                ? statusReceiptFor(stagedHero.id, inspectedStatus.type)
                : null}
              onToggleStatus={(statusType) => toggleStatus(stagedHero.id, statusType)}
              record={{
                receipts: swiftReceipt ? [...receipts, swiftReceipt] : receipts,
                tempo: tempoReceipt,
                opening: openingReceipt,
                expanded: recordExpanded,
                onToggle: () => {
                  setInspectedSkillId(null);
                  setInspectedStatus(null);
                  setRecordExpanded((value) => !value);
                },
              }}
            />
          </article>

          {reserves.length > 0 ? (
            <section className="tow-combat__reserves" aria-label="Other allies">
              {reserves.map((actor) => (
                <article
                  key={actor.id}
                  className={`tow-combat__reserve${actor.hp <= 0 ? " is-down" : ""} ${actorFeedbackClasses(actor.id, impactCues)}`.trim()}
                  style={actorFeedbackStyle(actor.id, impactCues)}
                  aria-label={actor.id === encounter.playerId ? `You: ${actor.name}` : `Ally: ${actor.name}`}
                >
                  <span>{actor.id === encounter.playerId ? "You" : actor.name}</span>
                  <strong>{actor.hp}/{actor.maxHp}</strong>
                </article>
              ))}
            </section>
          ) : null}
        </section>

        {error ? <p className="tow-combat__alert" role="alert">{error}</p> : null}

        {!terminal ? (
          <footer
            className={`tow-combat__command${presentationLocked ? " is-committed" : ""}${forcedWindow ? " is-forced" : ""}`}
            aria-busy={presentationLocked || Boolean(forcedWindow)}
          >
            <div className="tow-combat__command-heading">
              <div>
                <span>{actionBeat
                  ? actionBeat.phase === "windup" ? "Committed" : "Resolving"
                  : forcedWindow?.kind === "control" ? "Control takes hold"
                    : forcedWindow?.kind === "priority" ? "Enemy moves first"
                      : stagedHero.id === encounter.playerId ? "Your command" : stagedHero.name}</span>
                <strong>{actionBeat
                  ? actionBeat.displayName
                  : forcedWindow ? `${forcedWindow.label} · turn forfeited` : "Choose an action"}</strong>
              </div>
              <p>
                <strong>{forcedWindow ? 0 : actionsLeft(encounter, activeCommander.id)}</strong>
                <span>{forcedWindow ? "input" : `action${actionsLeft(encounter, activeCommander.id) === 1 ? "" : "s"}`}</span>
              </p>
            </div>

            {commandable.length > 1 ? (
              <div className="tow-combat__commanders" aria-label="Whose action to spend">
                {commandable.map((actor) => (
                  <button
                    key={actor.id}
                    type="button"
                    className={`tow-combat__commander production-combat__commander${actor.id === activeCommander.id ? " is-selected" : ""}`}
                    aria-pressed={actor.id === activeCommander.id}
                    aria-label={`Act as ${actor.name}, ${actionsLeft(encounter, actor.id)} actions left`}
                    disabled={presentationLocked || Boolean(forcedWindow)}
                    onClick={() => setCommanderId(actor.id)}
                  >
                    <span>{actor.id === encounter.playerId ? "You" : actor.name}</span>
                    <strong>{actionsLeft(encounter, actor.id)}</strong>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="tow-combat__actions" aria-label="Combat actions">
              {skillRows.map((row, index) => (
                <CombatAction
                  key={row.skillState.id}
                  firstActionRef={index === 0 ? firstActionRef : null}
                  definition={row.definition}
                  displayName={row.displayName}
                  art={row.art}
                  skillState={row.skillState}
                  limit={row.limit}
                  weaponPresentation={row.weaponPresentation}
                  legality={row.legality}
                  active={row.skillState.id === inspectedSkillId}
                  busy={presentationLocked}
                  committed={row.skillState.id === actionBeat?.skillId}
                  onShowDetails={() => {
                    setInspectedStatus(null);
                    setRecordExpanded(false);
                    setInspectedSkillId(row.skillState.id);
                  }}
                  onHideDetails={() => setInspectedSkillId(null)}
                  onUse={() => queueSkillAction(row)}
                />
              ))}
            </div>

            <p className="tow-combat__action-hint">
              {actionBeat
                ? actionBeat.phase === "windup" ? "Commitment set · awaiting contact" : "Resolve · watch the exchange"
                : forcedWindow?.kind === "control"
                  ? "No input needed · the skipped command advances automatically"
                  : forcedWindow?.kind === "priority"
                    ? "No input needed · enemy Priority resolves automatically"
                    : "Tap to commit · hold for details"}
            </p>

            {inspectedSkill ? (
              <SkillDetails
                {...inspectedSkill}
                onDismiss={() => setInspectedSkillId(null)}
              />
            ) : null}

            <div className="tow-combat__command-foot">
              {!forcedWindow && commandable.length > 1 && actionsLeft(encounter, activeCommander.id) > 0 ? (
                <button
                  type="button"
                  className="tow-combat__hold"
                  disabled={presentationLocked}
                  onClick={() => onStandDown?.(activeCommander.id)}
                >
                  {activeCommander.id === encounter.playerId
                    ? "Stand down"
                    : `${activeCommander.name} stands down`}
                </button>
              ) : <span />}
              {saveState ? <p className="tow-combat__save">{saveState}</p> : null}
            </div>
          </footer>
        ) : (
          <footer className="tow-combat__outcome production-combat__outcome" aria-live="assertive">
            <div className="tow-combat__outcome-heading">
              <span>
                {encounter.phase === "victory"
                  ? "The field is yours"
                  : encounter.phase === "retreated" ? "The party breaks contact" : "The light leaves the field"}
              </span>
              <strong>
                {encounter.phase === "victory"
                  ? "Stand victorious"
                  : encounter.phase === "retreated" ? "You escaped" : "The fight is lost"}
              </strong>
            </div>
            <dl className="tow-combat__tally">
              <div><dt>Rounds</dt><dd>{encounter.round}</dd></div>
              <div><dt>Foes down</dt><dd>{fallen}/{enemies.length}</dd></div>
              <div><dt>Health</dt><dd>{player.hp}/{player.maxHp}</dd></div>
            </dl>
            <div className="tow-combat__outcome-record">
              <CombatRecord
                receipts={receipts}
                tempo={null}
                opening={null}
                expanded={recordExpanded}
                onToggle={() => setRecordExpanded((value) => !value)}
              />
            </div>
            <button
              ref={settleRef}
              type="button"
              className="tow-combat__settle production-combat__settle"
              onClick={onSettle}
            >
              Apply aftermath
              <span aria-hidden="true">→</span>
            </button>
          </footer>
        )}
      </main>
    </div>
  );
}

export default TowCombatView;
