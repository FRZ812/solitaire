import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import battleScene from "../../assets/generated/scene-crowsmoor-v2.webp";
import { PROVISIONAL_CONTROL_LIFECYCLE } from "../../gameplay/kernel/status-stack.js";
import { Icon } from "../Icon.jsx";
import {
  combatSkillLegality,
  combatItemLegality,
  controlNullifiesActor,
  declaredIntents,
  priorityAdvantageFor,
  retreatOdds,
} from "../../gameplay/combat/encounter.js";
import {
  CHARACTER_ABILITY_TYPE_LABELS,
  describeCharacterAbilityEffect,
} from "../../gameplay/combat/character-abilities.js";
import {
  getSkill,
  resolveCost,
  skillRarityAtRank,
  UNLIMITED_USES,
  usesPerAct,
} from "../../gameplay/combat/skills.js";
import { abilityTargeting, presentationTier } from "../../gameplay/combat/ability-targeting.js";
import {
  encounterFormations,
  formationCellForActor,
  legalSkillAnchors,
  resolveSkillTargets,
} from "../../gameplay/combat/targeting.js";
import {
  describeCombatItemEffect,
  getCombatItem,
} from "../../gameplay/combat/combat-items.js";
import { normalizeWeaponPresentation } from "../../gameplay/combat/weapon-presentation.js";
import { weaponAttackSummary } from "../../gameplay/combat/weapon-techniques.js";
import { resolveCombatArt } from "./archetype-combat-art.js";
import { resolveCombatAbilityArt, resolveCombatActionName } from "./archetype-combat-ability-art.js";
import { resolveCombatKeepsakeArt } from "./combat-keepsake-art.js";
import {
  combatCueTimeline,
  combatEventReceipt,
  combatTempoReceipt,
  recentCombatReceipts,
} from "./archetype-combat-feedback.js";
import { combatVfxForIntent } from "./archetype-combat-vfx.js";
import { ArchetypeCombatVfxCanvas } from "./ArchetypeCombatVfxCanvas.jsx";
import { FormationBattlefield } from "./FormationBattlefield.jsx";
import { trapModalFocus } from "../exploration/modalFocus.js";
import { combatChoreographyForAction } from "./archetype-combat-choreography.js";
import { combatStatusPresentation } from "./archetype-combat-status.js";
import "./archetype-combat.css";

function percent(value, max) {
  return Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
}

const REFUSALS = {
  "on-cooldown": (skill) => `ready in ${skill.cooldownRemaining}`,
  "no-uses-remaining": () => "spent",
  "insufficient-resolve": () => "not enough Resolve",
  "basic-recovery-required": () => "use a free basic ability first",
  "item-spent": () => "spent",
  "health-full": () => "health is already full",
  "resolve-full": () => "Resolve is already full",
  "turn-already-spent": () => "no action left",
  "action-nullified": () => "control forfeits this turn automatically",
  "priority-preempted": () => "enemy Priority resolves first",
  "invalid-skill-state": () => "unavailable",
  "no-effective-outcome": () => "no useful effect",
};

const HOLD_FOR_DETAILS_MS = 420;
const CONTACT_REACTIONS = new Set(["block", "critical", "evade", "hit", "ward"]);
const VITAL_CONTACT_OFFSET_MS = 150;
// Presentation never holds authority: the outcome is already canonical when the events
// arrive, so the reveal timer only lets the final contact cues land before the tally
// shows. It bounds the wait instead of creating one.
const TERMINAL_REVEAL_PADDING_MS = 620;
const CONTROL_STATUS_TYPES = PROVISIONAL_CONTROL_LIFECYCLE.types;

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

function rarityLabel(value) {
  return String(value || "common")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusPanelId(actorId, statusType) {
  return `combat-status-${domId(actorId)}-${domId(statusType)}`;
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
    <span className={`archetype-combat__ability-art ${className}`.trim()} aria-hidden="true">
      <img src={src} alt="" draggable="false" />
      <span className="archetype-combat__ability-art-shade" />
      <span className="archetype-combat__ability-art-frame" />
      <span className="archetype-combat__ability-art-sheen" />
    </span>
  );
}

function effectDetail(definition, effect, _effectIndex, rank) {
  const described = describeCharacterAbilityEffect(effect, rank);
  return abilityTargeting(definition).anchorSide === "ally"
    ? described.replaceAll("yourself", "the target ally")
    : described;
}

const FOOTPRINT_DETAIL = Object.freeze({
  row: "target row",
  column: "target column",
  "cross-short": "target and adjacent cells",
  "cross-full": "target row and column",
  all: "entire target field",
});

function skillContractClauses(definition) {
  const targeting = abilityTargeting(definition);
  let target = "self";
  if (definition.effects.some((effect) => effect.target === "all")) {
    target = "all combatants";
  } else if (targeting.anchorSide === "ally") {
    target = "one ally (including you)";
  } else if (targeting.anchorSide === "enemy") {
    target = targeting.footprint === "single" ? "one enemy" : "enemy field";
  }
  const clauses = [`Target: ${target}`];
  if (targeting.footprint !== "single") {
    clauses.push(`Area: ${FOOTPRINT_DETAIL[targeting.footprint]}`);
  }
  if (definition.effects.some((effect) => effect.type === "shield")) {
    clauses.push("Ward refreshes instead of stacking and expires after the opposing command window");
  }
  clauses.push(`Cooldown: ${definition.cooldown > 0 ? `${definition.cooldown} rounds` : "none"}`);
  return clauses;
}

export function combatSkillDetail(definition, skillState, weaponPresentation = null) {
  if (definition.id === "strike" && weaponPresentation?.attackSnapshot) {
    return weaponAttackSummary(weaponPresentation.attackSnapshot, skillState.rank);
  }
  const effects = definition.effects.map((effect, index) => (
    effectDetail(definition, effect, index, skillState.rank)
  ));
  if (definition.note) effects.push(definition.note.replace(/-/g, " "));
  effects.push(...skillContractClauses(definition));
  return effects.join(" · ") || "No immediate combat effect";
}

function SkillDetails({
  definition,
  displayName,
  art,
  weaponPresentation,
  skillState,
  legality,
  cost,
  legacyLimit,
  onDismiss,
}) {
  return (
    <aside
      className={`archetype-combat__skill-details archetype-combat__skill-details--${actionKind(definition)}`}
      role="dialog"
      aria-modal="false"
      aria-label={`${displayName} details`}
      data-testid="combat-skill-details"
    >
      <AbilityArt src={art} className="archetype-combat__skill-details-art" />
      <div className="archetype-combat__skill-details-copy">
        <span>{CHARACTER_ABILITY_TYPE_LABELS[definition.abilityType] || rarityLabel(definition.rarity)} · {rarityLabel(skillRarityAtRank(definition, skillState.rank))}</span>
        <strong>{displayName}</strong>
        {definition.id === "strike" ? (
          <b>{weaponPresentation.weaponName} · {weaponPresentation.familyLabel}</b>
        ) : null}
        <p>{combatSkillDetail(definition, skillState, weaponPresentation)}</p>
        <small>
          {definition.consumesTurn ? "Spends the action" : "Swift · keeps the action"}
          {cost !== null
            ? (cost > 0 ? ` · ${cost} Resolve` : " · no Resolve cost")
            : legacyLimit !== UNLIMITED_USES
              ? ` · ${skillState.usesRemaining}/${legacyLimit} legacy uses`
              : " · always ready"}
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
  cost,
  legacyLimit,
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
  const hasLegacyUses = cost === null && legacyLimit !== UNLIMITED_USES;
  const resourceAnnouncement = onCooldown
    ? `Cooldown, ${skillState.cooldownRemaining} turn${skillState.cooldownRemaining === 1 ? "" : "s"} remaining`
    : cost !== null && cost > 0
      ? `${cost} Resolve`
      : hasLegacyUses
        ? `${skillState.usesRemaining} of ${legacyLimit} legacy uses remaining`
        : cost === null ? "Always ready" : "No Resolve cost";

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
    if (legality.ok) onUse(event.currentTarget);
    else onShowDetails();
  }

  useEffect(() => cancelHold, []);

  return (
    <button
      ref={firstActionRef}
      type="button"
      className={`archetype-combat__action production-combat__action archetype-combat__action--${actionKind(definition)}${active ? " is-inspecting" : ""}${committed ? " is-committed" : ""}${onCooldown ? " is-on-cooldown" : ""}${!legality.ok ? " is-unavailable" : ""}`}
      aria-label={`${displayName}. ${combatSkillDetail(definition, skillState, weaponPresentation)}.${resourceAnnouncement ? ` ${resourceAnnouncement}.` : ""} ${busy && committed ? "Resolving; tap for details" : legality.ok ? "Tap to use; hold for details" : refusalText(legality.reason, skillState)}`}
      aria-disabled={busy ? !committed : !legality.ok}
      aria-expanded={active}
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
        <span className="archetype-combat__action-cooldown" aria-hidden="true">
          {skillState.cooldownRemaining}
        </span>
      ) : cost !== null && cost > 0 ? (
        <span className="archetype-combat__action-cost" aria-hidden="true">
          <strong>{cost}</strong><small>RP</small>
        </span>
      ) : hasLegacyUses ? (
        <span className="archetype-combat__action-cost archetype-combat__action-cost--legacy" aria-hidden="true">
          <strong>{skillState.usesRemaining}</strong><small>/{legacyLimit}</small>
        </span>
      ) : null}
      <span className="archetype-combat__sr-only">{displayName}</span>
    </button>
  );
}

function ArtFigure({ actor, src, side, down = actor.hp <= 0 }) {
  return (
    <div className={`archetype-combat__art archetype-combat__art--${side}${down ? " is-down" : ""}`}>
      <span className="archetype-combat__art-reaction">
        {src ? (
          <img className="archetype-combat__art-image" src={src} alt="" aria-hidden="true" draggable="false" />
        ) : (
          <span className="archetype-combat__art-monogram" aria-hidden="true">{monogram(actor.name)}</span>
        )}
        <span className="archetype-combat__art-shadow" aria-hidden="true" />
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

function intentTargetName(intent, primaryTarget = null) {
  if (intent?.target === "area") return intent.targetName || "the formation";
  return primaryTarget?.name || intent?.targetName || "your party";
}

function IntentBadge({ intent, target, source }) {
  if (!intent) return null;
  const visual = combatVfxForIntent(intent);
  const damage = intent.damage > 0
    ? intent.hits > 1 ? `${intent.hits}×${intent.damage}` : intent.damage
    : ({ afflict: "HEX", boon: "BOON", recover: "MEND", ward: "WARD" }[intent.kind] || "ACT");
  const targetName = intentTargetName(intent, target);
  const sourceName = source?.name || "Enemy";
  const outcome = intentOutcomeText(intent);
  const targetText = intent.target === "self" ? "self" : targetName;
  return (
    <span
      className={`archetype-combat__intent archetype-combat__intent--${visual.family}${intent.damage > 0 && intent.hits > 1 ? " is-multi" : ""}`}
      role="img"
      aria-label={`${sourceName}: ${intent.name}, ${outcome}, ${intent.target === "self" ? "used on self" : `targeting ${targetName}`}`}
      title={`${sourceName} · ${intent.name} · ${outcome} · ${targetText}`}
      data-testid="combat-enemy-intent"
      data-enemy-id={intent.enemyId}
      data-ability-id={intent.skillId || intent.attackId || undefined}
    >
      <span className="archetype-combat__intent-sigil" aria-hidden="true">
        <img src={visual.asset} alt="" />
        <i />
      </span>
      <strong aria-hidden="true">{damage}</strong>
    </span>
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
    "--combat-status-icon": `url("${visual.iconAsset || visual.asset}")`,
    "--combat-status-icon-position": visual.iconPosition || "0% 0%",
    "--combat-status-icon-size": visual.iconSize || "cover",
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
    <ul className="archetype-combat__statuses" aria-label={`${actor.name} status effects`}>
      {presented.map((status) => {
        const detail = combatStatusPresentation(status);
        const selected = status.type === selectedType;
        return (
          <li key={status.type} className="archetype-combat__status">
            <button
              type="button"
              className={`archetype-combat__status-button archetype-combat__status-button--${detail.visual.family}`}
              aria-label={`${detail.name}, ${detail.countLabel}. Tap for details.`}
              aria-expanded={selected}
              aria-controls={selected ? statusPanelId(actor.id, status.type) : undefined}
              aria-pressed={selected}
              title={`${detail.name} · ${detail.countLabel}`}
              onClick={() => onToggle?.(status.type)}
            >
              <span className="archetype-combat__status-art" style={statusIconStyle(detail.visual)} aria-hidden="true">
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
  const detail = combatStatusPresentation(status);
  return (
    <aside
      id={statusPanelId(actor.id, status.type)}
      className={`archetype-combat__status-details${enemy ? " archetype-combat__status-details--enemy archetype-combat__status-details--intent-safe" : ""}`}
      data-tone={detail.tone}
      data-testid="combat-status-details"
      role="dialog"
      aria-modal="false"
      aria-label={`${detail.name} status details`}
    >
      <span
        className={`archetype-combat__status-details-art archetype-combat__status-details-art--${detail.visual.family}`}
        style={statusIconStyle(detail.visual)}
        aria-hidden="true"
      >
        <i />
      </span>
      <span className="archetype-combat__status-details-copy">
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

function CombatantDossier({ actor, art, abilityRows, opener, onClose }) {
  const dialogRef = useRef(null);
  const layerRef = useRef(null);
  const hasResolve = Number.isFinite(actor.resolve) && Number.isFinite(actor.resolveMax);
  const stats = [
    ["HP", `${actor.hp}/${actor.maxHp}`],
    ...(hasResolve ? [["Resolve", `${actor.resolve}/${actor.resolveMax}`]] : []),
    ...(hasResolve && Number.isFinite(actor.resolveRegen)
      ? [["Free-basic recovery", `${actor.resolveRegen} Resolve`]]
      : []),
    ["Ward", actor.shield || 0],
    ["Attack", actor.stats?.attack ?? 0],
    ["Defense", actor.stats?.defense ?? 0],
    ["Critical", `${actor.stats?.critRate ?? 0}%`],
    ["Dodge", `${actor.stats?.dodgeRate ?? 0}%`],
  ];

  useLayoutEffect(() => {
    const layer = layerRef.current;
    const dialog = dialogRef.current;
    const siblings = layer?.parentElement
      ? [...layer.parentElement.children].filter((element) => element !== layer)
      : [];
    const previous = siblings.map((element) => ({
      element,
      hadInert: element.hasAttribute("inert"),
      ariaHidden: element.getAttribute("aria-hidden"),
    }));
    for (const element of siblings) {
      element.setAttribute("inert", "");
      element.setAttribute("aria-hidden", "true");
    }
    dialog?.querySelector("button:not(:disabled)")?.focus();
    return () => {
      for (const entry of previous) {
        if (!entry.hadInert) entry.element.removeAttribute("inert");
        if (entry.ariaHidden === null) entry.element.removeAttribute("aria-hidden");
        else entry.element.setAttribute("aria-hidden", entry.ariaHidden);
      }
      const restore = () => {
        if (opener?.isConnected && !opener.disabled) opener.focus();
      };
      if (typeof globalThis.requestAnimationFrame === "function") {
        globalThis.requestAnimationFrame(restore);
      } else {
        queueMicrotask(restore);
      }
    };
  }, [opener]);

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose?.();
      return;
    }
    if (event.key === "Tab") {
      trapModalFocus(event, dialogRef.current);
      event.stopPropagation();
    }
  }

  return (
    <div
      ref={layerRef}
      className="archetype-combat__dossier-backdrop"
      role="presentation"
      data-modal-escape-boundary
      onKeyDown={handleKeyDown}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <aside
        ref={dialogRef}
        className={`archetype-combat__dossier archetype-combat__dossier--${actor.side}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`archetype-combat-dossier-${domId(actor.id)}`}
        data-testid="archetype-combat-dossier"
      >
        <header className="archetype-combat__dossier-hero">
          <span className="archetype-combat__dossier-portrait" aria-hidden="true">
            {art ? <img src={art} alt="" draggable="false" /> : <b>{monogram(actor.name)}</b>}
          </span>
          <span className="archetype-combat__dossier-title">
            <small>{actor.side === "enemy" ? "Opposing combatant" : "Allied combatant"}</small>
            <strong id={`archetype-combat-dossier-${domId(actor.id)}`}>{actor.name}</strong>
            <em>{actor.hp > 0 ? "Standing" : "Defeated"}</em>
          </span>
          <button type="button" onClick={onClose} aria-label={`Close ${actor.name} dossier`}>
            <Icon name="x" size={16} strokeWidth={1.7} />
          </button>
        </header>

        <section className="archetype-combat__dossier-section" aria-labelledby={`archetype-combat-stats-${domId(actor.id)}`}>
          <h3 id={`archetype-combat-stats-${domId(actor.id)}`}>Combat profile</h3>
          <dl className="archetype-combat__dossier-stats">
            {stats.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {actor.statuses?.length ? (
          <section className="archetype-combat__dossier-section" aria-labelledby={`archetype-combat-statuses-${domId(actor.id)}`}>
            <h3 id={`archetype-combat-statuses-${domId(actor.id)}`}>Status effects</h3>
            <ul className="archetype-combat__dossier-statuses">
              {actor.statuses.map((status) => {
                const detail = combatStatusPresentation(status);
                return (
                  <li key={status.type}>
                    <span style={statusIconStyle(detail.visual)} aria-hidden="true"><i /></span>
                    <span><strong>{detail.name}</strong><small>{detail.effect}</small></span>
                    <em>{status.count}</em>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section className="archetype-combat__dossier-section" aria-labelledby={`archetype-combat-abilities-${domId(actor.id)}`}>
          <h3 id={`archetype-combat-abilities-${domId(actor.id)}`}>Abilities</h3>
          {abilityRows.length ? (
            <div className="archetype-combat__dossier-abilities">
              {abilityRows.map((row) => (
                <article key={row.skillState.id}>
                  <AbilityArt src={row.art} className="archetype-combat__dossier-ability-art" />
                  <span>
                    <small>{rarityLabel(row.rarity)} · rank {row.skillState.rank}</small>
                    <strong>{row.displayName}</strong>
                    <p>{row.detail}</p>
                  </span>
                  <em>
                    {row.skillState.cooldownRemaining > 0
                      ? `${row.skillState.cooldownRemaining} turn${row.skillState.cooldownRemaining === 1 ? "" : "s"}`
                      : row.cost > 0 ? `${row.cost} RP` : "Ready"}
                  </em>
                </article>
              ))}
            </div>
          ) : <p className="archetype-combat__dossier-empty">No combat abilities recorded.</p>}
        </section>
      </aside>
    </div>
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
      className={`archetype-combat__vitals${enemy ? " archetype-combat__vitals--enemy" : ""}${reacting ? " is-reacting" : ""}`}
      style={{ "--combat-vitals-delay": `${feedbackDelay}ms` }}
    >
      <div className="archetype-combat__resource archetype-combat__resource--health">
        <span className="archetype-combat__resource-label">HP</span>
        <div
          className="archetype-combat__bar"
          role="meter"
          aria-label={`${actor.name} health`}
          aria-valuemin="0"
          aria-valuemax={presented.maxHp}
          aria-valuenow={presented.hp}
        >
          <span className="archetype-combat__bar-hp" style={{ width: `${percent(presented.hp, presented.maxHp)}%` }} />
          {presented.shield > 0 ? (
            <span
              className="archetype-combat__bar-shield"
              style={{ width: `${percent(presented.shield, presented.maxHp)}%` }}
            />
          ) : null}
        </div>
        <span className="archetype-combat__bar-value">
          <strong>{presented.hp}</strong>
          <span>/{presented.maxHp}</span>
          {presented.shield > 0 ? <em>+{presented.shield}</em> : null}
        </span>
      </div>
      {Number.isFinite(actor.resolve) ? (
        <div className="archetype-combat__resource archetype-combat__resource--resolve">
          <span className="archetype-combat__resource-label">RP</span>
          <div
            className="archetype-combat__bar archetype-combat__bar--resolve"
            role="meter"
            aria-label={`${actor.name} Resolve`}
            aria-valuemin="0"
            aria-valuemax={actor.resolveMax}
            aria-valuenow={actor.resolve}
          >
            <span
              className="archetype-combat__bar-resolve"
              style={{ width: `${percent(actor.resolve, actor.resolveMax)}%` }}
            />
          </div>
          <span className="archetype-combat__bar-value archetype-combat__bar-value--resolve">
            <strong>{actor.resolve}</strong>
            <span>/{actor.resolveMax}</span>
          </span>
        </div>
      ) : null}
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
    <div className={`archetype-combat__plate${enemy ? " archetype-combat__plate--enemy" : " archetype-combat__plate--hero"}`}>
      <div className="archetype-combat__identity">
        <span>{role}</span>
        <h2>{actor.name}</h2>
      </div>
      <Vitals actor={actor} enemy={enemy} feedbackCues={feedbackCues} reacting={reactions.length > 0} />
      {hasTools ? (
        <div className="archetype-combat__status-tools">
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

function actionsLeft(encounter, actorId) {
  if (actorId === encounter.playerId) return encounter.turn.actionsRemaining;
  return encounter.turn.allies?.[actorId] ?? 0;
}

export function eventTouchesStatus(event, actorId, statusType) {
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
  if (event.type === "skill-status-modified") {
    return event.targetId === actorId && event.status === statusType;
  }
  if (["skill-status-amplified", "skill-status-scaled", "skill-cleanse"].includes(event.type)) {
    return event.targetId === actorId && event.statuses?.includes(statusType);
  }
  if (event.type === "initiative-converted") {
    return event.actorId === actorId && ["initiative", "priority"].includes(statusType);
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
    "--combat-attack-delay": `${attacks.length ? Math.min(...attacks.map((cue) => cue.delayMs || 0)) : 0}ms`,
    "--combat-reaction-delay": `${reactions.length ? Math.min(...reactions.map((cue) => cue.delayMs || 0)) : 0}ms`,
    "--combat-reaction-count": Math.max(1, contacts.length),
  };
}

function CombatEffects({ cues }) {
  const effectCues = cues.filter((cue) => cue.kind !== "movement");
  return (
    <div className="archetype-combat__effects" aria-hidden="true">
      <ArchetypeCombatVfxCanvas cues={effectCues} />
      {effectCues.map((cue, index) => {
        const lane = effectCues
          .slice(0, index)
          .filter((priorCue) => priorCue.targetSide === cue.targetSide)
          .length;
        const laneX = [-38, 38, 0][lane % 3];
        const laneY = [0, -18, 14][lane % 3];
        const profile = cue.visual?.profile || {};
        const cell = cue.targetCell || cue.anchorCell || null;
        const row = cell ? Math.floor(cell.index / 3) : null;
        const column = cell ? cell.index % 3 : null;
        const cellLeft = cell ? 16.7 + (column * 33.3) : null;
        const cellTop = cell
          ? cell.side === "enemy" ? 44 - (row * 13.5) : 56 + (row * 13.5)
          : null;
        return (
          <span
            key={cue.id || `${cue.sequence}-${cue.kind}-${cue.targetId || index}`}
            className={`archetype-combat__effect archetype-combat__effect--${cue.kind} archetype-combat__effect--${cue.targetSide} archetype-combat__effect--vfx-${cue.visual?.family || "impact"} archetype-combat__effect--motion-${cue.visual?.motion || "balanced"}`}
            data-vfx-variant={cue.visual?.variant || "unknown"}
            data-hit-index={cue.hitIndex ?? 0}
            data-hit-count={cue.hitCount ?? 1}
            data-action-index={cue.actionIndex ?? 0}
            data-effect-lane={lane}
            data-vfx-profile={profile.key || undefined}
            data-vfx-source={cue.visual?.assetSource || "none"}
            data-vfx-atlas={cue.visual?.flipbook?.id || undefined}
            data-vfx-frames={cue.visual?.flipbook?.frameCount || undefined}
            data-vfx-frame-range={cue.visual?.flipbook?.frameRange?.join("-") || undefined}
            data-vfx-choreography={cue.visual?.choreography || "single-sweep"}
            data-vfx-travel={cue.visual?.travel || "stationary"}
            data-vfx-signature={cue.visual?.signatureKey || undefined}
            style={{
              "--combat-effect-delay": `${cue.delayMs || 0}ms`,
              "--combat-effect-x": `${laneX}px`,
              "--combat-effect-y": `${laneY}px`,
              ...(cell ? {
                top: `${cellTop}%`,
                right: "auto",
                bottom: "auto",
                left: `${cellLeft}%`,
                marginTop: "-4.75rem",
                marginLeft: "-4.75rem",
              } : {}),
            }}
          >
            {cue.outcomeAsset && cue.outcomeAsset !== cue.visual?.asset ? (
              <img className="archetype-combat__effect-outcome" src={cue.outcomeAsset} alt="" />
            ) : null}
            <span className="archetype-combat__effect-particles"><i /><i /><i /></span>
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
      <section className={`archetype-combat__record archetype-combat__record--compact${expanded ? " is-expanded" : ""}`} aria-label="Combat log">
        <button
          type="button"
          className="archetype-combat__record-trigger"
          aria-label={`Combat log. Latest: ${latest.text}`}
          aria-expanded={expanded}
          aria-controls={expanded ? "archetype-combat-record-list" : undefined}
          title="Combat log"
          onClick={onToggle}
        >
          <Icon name="journal" size={25} />
          <b aria-hidden="true">{Math.min(rows.length, 9)}</b>
        </button>
        {expanded ? (
          <ol id="archetype-combat-record-list" className="archetype-combat__record-list">
            {rows.map((receipt, index) => (
              <li key={`${receipt.sequence}-${index}`} data-kind={receipt.kind}>{receipt.text}</li>
            ))}
          </ol>
        ) : null}
      </section>
    );
  }
  return (
    <section className={`archetype-combat__record${expanded ? " is-expanded" : ""}`} aria-label="Combat record">
      <button
        type="button"
        className="archetype-combat__record-summary"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span>Latest</span>
        <p aria-live="polite">{latest.text}</p>
        <b>{expanded ? "Close" : "Details"}</b>
      </button>
      {expanded ? (
        <ol className="archetype-combat__record-list">
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
  actorName,
  side = "player",
  delayMs = 0,
  durationMs = 860,
  testId = null,
}) {
  return (
    <span
      className={`archetype-combat__declaration archetype-combat__declaration--${side} archetype-combat__declaration--${visual.family}`}
      style={{
        "--combat-declaration-delay": `${delayMs}ms`,
        "--combat-declaration-duration": `${durationMs}ms`,
      }}
      data-testid={testId || undefined}
      role={side === "player" ? "status" : undefined}
      aria-live={side === "player" ? "assertive" : undefined}
      aria-hidden={side === "enemy" ? "true" : undefined}
    >
      <span className="archetype-combat__declaration-sigil" aria-hidden="true">
        <i />
      </span>
      <small aria-hidden="true">{side === "enemy" ? actorName : "Declared"}</small>
      <strong aria-hidden="true">{label}</strong>
      {side === "player" ? (
        <span className="archetype-combat__sr-only">
          {actorName === "You" ? "You declare" : `${actorName} declares`} {label}
        </span>
      ) : null}
    </span>
  );
}

function FormationStatusBadges({ actor }) {
  if (!actor.statuses?.length) return null;
  return (
    <span
      className="combat-formation-statuses"
      aria-label={`${actor.name} status effects: ${actor.statuses.map((status) => {
        const detail = combatStatusPresentation(status);
        return `${detail.name} ${detail.countLabel}`;
      }).join(", ")}`}
    >
      {actor.statuses.slice(0, 4).map((status) => {
        const detail = combatStatusPresentation(status);
        return (
          <span
            key={status.type}
            className={`combat-formation-status archetype-combat__status-button--${detail.visual.family}`}
            style={statusIconStyle(detail.visual)}
            title={`${detail.name} · ${detail.countLabel}`}
          >
            <i className="combat-formation-status__art" aria-hidden="true" />
            <strong aria-hidden="true">{status.count}</strong>
          </span>
        );
      })}
      {actor.statuses.length > 4 ? (
        <span className="combat-formation-status combat-formation-status--more" aria-hidden="true">
          +{actor.statuses.length - 4}
        </span>
      ) : null}
    </span>
  );
}

function MythicalAbilityDeclaration({ beat, portrait }) {
  if (!beat || beat.presentationTier !== "mythical" || beat.phase !== "declaration") return null;
  return (
    <section
      className="archetype-combat__mythical-declaration"
      role="status"
      aria-live="assertive"
      data-testid="combat-mythical-declaration"
    >
      <span className="archetype-combat__mythical-aura" aria-hidden="true" />
      {portrait ? <img src={portrait} alt="" aria-hidden="true" draggable="false" /> : null}
      <span className="archetype-combat__mythical-copy">
        <small>Mythical · {beat.actorName}</small>
        <strong>{beat.displayName}</strong>
        <em>Ability declared</em>
      </span>
    </section>
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
    <div className="archetype-combat__declarations" aria-label="Declared actions">
      {beat && beat.presentationTier === "ability" ? (
        <ActionDeclaration
          label={beat.displayName}
          visual={beat.choreography.visual}
          actorName={beat.actorName}
          durationMs={playerDeclarationDuration}
          testId="combat-action-beat"
        />
      ) : null}
      {enemyDeclarations.map(({ cue, actor }) => (
        <ActionDeclaration
          key={`enemy-declaration-${cue.actionIndex}-${cue.sequence}`}
          label={cue.declarationLabel}
          visual={cue.visual}
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

function intentCellsForEncounter(encounter, intents) {
  return intents.flatMap((intent) => {
    if (intent.skillId && getSkill(intent.skillId)) {
      const preview = resolveSkillTargets(encounter, intent.skillId, intent.enemyId, {
        targetId: intent.targetId,
      });
      if (preview.ok) return preview.affectedCells;
    }
    const cell = formationCellForActor(encounter, intent.targetId);
    return cell ? [cell] : [];
  });
}

function encounterBeforeMovementCue(encounter, cue) {
  if (!cue?.formationsBefore) return encounter;
  const intents = { ...encounter.intents };
  for (const event of cue.intentRetargets || []) {
    const held = intents[event.enemyId];
    if (held) intents[event.enemyId] = { ...held, targetId: event.fromTargetId };
  }
  return {
    ...encounter,
    formations: cue.formationsBefore,
    intents,
  };
}

export function ArchetypeCombatView({
  encounter,
  onUseSkill,
  onUseItem,
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
  const combatRef = useRef(null);
  const firstActionRef = useRef(null);
  const targetingActionRef = useRef(null);
  const settleRef = useRef(null);
  const restoreFocusRef = useRef(null);
  const seenEventRef = useRef(encounter.sequence);
  const authoritativePhaseRef = useRef(encounter.phase);
  const impactClearTimerRef = useRef(null);
  const terminalRevealTimerRef = useRef(null);
  const forcedAdvanceRef = useRef(null);
  const satchelRef = useRef(null);
  const satchelTriggerRef = useRef(null);
  const [targetId, setTargetId] = useState(null);
  const [targetingDraft, setTargetingDraft] = useState(null);
  const [previewAnchorCell, setPreviewAnchorCell] = useState(null);
  const [commanderId, setCommanderId] = useState(null);
  const [inspectedSkillId, setInspectedSkillId] = useState(null);
  const [inspectedStatus, setInspectedStatus] = useState(null);
  const [inspectedActorId, setInspectedActorId] = useState(null);
  const dossierOpenerRef = useRef(null);
  const [recordExpanded, setRecordExpanded] = useState(false);
  const [satchelOpen, setSatchelOpen] = useState(false);
  const [impactCues, setImpactCues] = useState([]);
  const [actionBeat, setActionBeat] = useState(null);
  const [terminalRevealed, setTerminalRevealed] = useState(() => encounter.phase !== "player");
  const actionTimersRef = useRef({ declaration: null, commit: null, release: null });

  const player = encounter.actors[encounter.playerId];
  const allies = (encounter.allyIds || []).map((id) => encounter.actors[id]);
  const playerSide = [player, ...allies];
  const enemies = encounter.enemyIds.map((id) => encounter.actors[id]);
  const living = enemies.filter((enemy) => enemy.hp > 0);
  const authoritativeTerminal = encounter.phase !== "player";
  const terminal = authoritativeTerminal && terminalRevealed;
  // The outcome is canonical before it is shown; the reveal hold is a cosmetic beat that
  // lets the final contact cues land before the tally replaces the field.
  const terminalHold = authoritativeTerminal && !terminalRevealed;
  // Visual-only presentation state: dims the scene, marks assistive tech busy, and styles
  // the exchange. It never gates a command.
  const presentationLocked = Boolean(actionBeat) || terminalHold || impactCues.length > 0;
  // Authoritative input gate: only a genuinely undecided moment suppresses commands —
  // the brief mythical cut-in before its commit, or a fight that is already over.
  // Impact cues, windups, recoveries, and open target previews never count: the next
  // command is legal the instant the kernel is, and presentation may not veto it.
  const mythicDeclaring = actionBeat?.phase === "declaration";
  const inputSuppressed = mythicDeclaring || authoritativeTerminal;
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
  const forcedWindow = activeControl && controlNullifiesActor(encounter, activeCommander.id)
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
  function buildForActor(actor) {
    if (!actor) return null;
    if (actor.id === encounter.playerId) return encounter.build;
    return encounter.allyBuilds?.[actor.id] || encounter.enemyBuilds?.[actor.id] || null;
  }
  const commanderBuild = buildForActor(activeCommander);
  function weaponPresentationFor(actor) {
    const actorBuild = buildForActor(actor);
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
  const resolveEconomy = Number.isFinite(activeCommander.resolve);
  const skillRows = (commanderBuild?.skills || []).map((skillState) => {
    const definition = getSkill(skillState.id);
    const legality = forcedWindow
      ? { ok: false, reason: forcedWindow.kind === "control" ? "action-nullified" : "priority-preempted" }
      : combatSkillLegality(encounter, skillState.id, activeCommander.id);
    return {
      art: resolveCombatAbilityArt(definition, commanderWeapon),
      definition,
      displayName: resolveCombatActionName(definition, commanderWeapon),
      legality,
      cost: resolveEconomy ? resolveCost(skillState.id, skillState.rank) : null,
      legacyLimit: resolveEconomy
        ? UNLIMITED_USES
        : usesPerAct(skillState.id, skillState.rank),
      skillState,
      weaponPresentation: commanderWeapon,
    };
  });
  const inspectedActor = encounter.actors[inspectedActorId] || null;
  const inspectedActorBuild = buildForActor(inspectedActor);
  const inspectedActorWeapon = inspectedActor ? weaponPresentationFor(inspectedActor) : null;
  const dossierAbilityRows = (inspectedActorBuild?.skills || []).flatMap((skillState) => {
    const definition = getSkill(skillState.id);
    if (!definition) return [];
    return [{
      art: resolveCombatAbilityArt(definition, inspectedActorWeapon),
      cost: Number.isFinite(inspectedActor?.resolve)
        ? resolveCost(skillState.id, skillState.rank)
        : 0,
      definition,
      detail: combatSkillDetail(definition, skillState, inspectedActorWeapon),
      displayName: resolveCombatActionName(definition, inspectedActorWeapon),
      rarity: skillRarityAtRank(definition, skillState.rank),
      skillState,
    }];
  });
  const targetingRow = targetingDraft
    ? skillRows.find((row) => row.skillState.id === targetingDraft.skillId) || null
    : null;
  const validAnchors = targetingRow
    ? legalSkillAnchors(encounter, targetingRow.definition, activeCommander.id)
    : [];
  const targetPreview = targetingRow && targetingDraft?.anchorCell
    ? resolveSkillTargets(encounter, targetingRow.definition, activeCommander.id, {
      anchorCell: targetingDraft.anchorCell,
    })
    : null;
  const resolvedPreview = targetPreview?.ok ? targetPreview : null;
  const transientTargetPreview = targetingRow && previewAnchorCell
    ? resolveSkillTargets(encounter, targetingRow.definition, activeCommander.id, {
      anchorCell: previewAnchorCell,
    })
    : null;
  const transientPreview = transientTargetPreview?.ok ? transientTargetPreview : null;
  const footprintPreview = transientPreview || resolvedPreview;
  const combatItemRows = (commanderBuild?.combatItems || []).map((held) => {
    const item = getCombatItem(held.id);
    const legality = forcedWindow
      ? { ok: false, reason: forcedWindow.kind === "control" ? "action-nullified" : "priority-preempted" }
      : combatItemLegality(encounter, held.id, activeCommander.id);
    return { item, held, legality };
  }).filter((row) => row.item);
  const combatItemQuantity = combatItemRows.reduce((total, row) => total + row.held.quantity, 0);
  const inspectedSkill = skillRows.find(({ skillState }) => skillState.id === inspectedSkillId) || null;
  const movementCue = impactCues.find((cue) => cue.kind === "movement") || null;
  const preMoveEncounter = movementCue
    ? encounterBeforeMovementCue(encounter, movementCue)
    : encounter;
  const declared = terminal ? [] : declaredIntents(encounter);
  const intents = Object.fromEntries(declared.map((intent) => [intent.enemyId, intent]));
  const intentCells = intentCellsForEncounter(encounter, declared);
  const intentCellsBeforeMove = terminal
    ? []
    : intentCellsForEncounter(preMoveEncounter, declaredIntents(preMoveEncounter));
  const fallen = enemies.filter((enemy) => enemy.hp <= 0).length;
  const staged = enemies.find((enemy) => enemy.id === activeTarget) || enemies[0];
  const retreat = authoritativeTerminal ? null : retreatOdds(encounter);
  const receiptOptions = {
    skillName: (event) => {
      const actor = encounter.actors[event.actorId];
      const definition = getSkill(event.skillId);
      return resolveCombatActionName(definition, actor ? weaponPresentationFor(actor) : commanderWeapon);
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
  const activeIntentTargetName = activeIntent
    ? intentTargetName(activeIntent, encounter.actors[activeIntent.targetId])
    : null;
  const openingReceipt = activeIntent ? {
    sequence: `intent-${encounter.round}-${staged?.id}`,
    kind: "intent",
    text: `${staged.name} declares ${activeIntent.name}${activeIntent.target === "self" ? "" : ` against ${activeIntentTargetName}`}: ${intentOutcomeText(activeIntent)}. ${activeCommander.id === encounter.playerId ? "You have" : `${activeCommander.name} has`} ${actionsLeft(encounter, activeCommander.id)} action${actionsLeft(encounter, activeCommander.id) === 1 ? "" : "s"}.`,
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
      text: `${actor.name}'s ${resolveCombatActionName(definition, weaponPresentationFor(actor))} is Swift; ${left} action${left === 1 ? "" : "s"} kept.`,
    };
  })();
  function combatArt(actor) {
    const supplied = typeof artFor === "function" ? artFor(actor) : null;
    return supplied || resolveCombatArt(actor, {
      playerId: encounter.playerId,
      playerPortraitKey,
      archetypeId: encounter.enemyArchetypes?.[actor.id] || actor.archetypeId || null,
    });
  }

  function renderFormationOverlay(actor, side) {
    const intent = side === "enemy" ? intents[actor.id] : null;
    return (
      <>
        {intent ? (
          <IntentBadge
            intent={intent}
            target={encounter.actors[intent.targetId]}
            source={actor}
          />
        ) : null}
        <FormationStatusBadges actor={actor} />
      </>
    );
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

  function beginSkillTargeting(row, initiatingAction = null) {
    if (inputSuppressed || !row.legality.ok) return;
    targetingActionRef.current = initiatingAction;
    const anchors = legalSkillAnchors(encounter, row.definition, activeCommander.id);
    const profile = abilityTargeting(row.definition);
    const anchorCell = anchors.length === 1 || profile.anchorSide === "self"
      ? anchors[0] || null
      : null;
    const immediatePreview = anchors.length === 1 && anchorCell
      ? resolveSkillTargets(encounter, row.definition, activeCommander.id, { anchorCell })
      : null;
    setInspectedSkillId(null);
    setInspectedStatus(null);
    setInspectedActorId(null);
    setRecordExpanded(false);
    setSatchelOpen(false);
    setPreviewAnchorCell(null);
    // A full-field ability has no meaningful anchor decision. Commit it immediately and do
    // not paint nine redundant target cells before the authored area effect begins.
    if (immediatePreview?.ok
      && (immediatePreview.targetIds.length === 1 || profile.footprint === "all")) {
      queueSkillAction(row, immediatePreview);
      return;
    }
    setTargetingDraft({ skillId: row.skillState.id, anchorCell });
  }

  function inspectCombatant(actor, opener = null) {
    if (!actor || inputSuppressed) return;
    dossierOpenerRef.current = opener || (combatRef.current?.contains(document.activeElement)
      ? document.activeElement
      : null);
    setInspectedSkillId(null);
    setInspectedStatus(null);
    setInspectedActorId(null);
    setRecordExpanded(false);
    setSatchelOpen(false);
    setInspectedActorId(actor.id);
    if (actor.side === "enemy") {
      if (actor.hp > 0) setTargetId(actor.id);
      return;
    }
    if (actor.hp > 0 && actionsLeft(encounter, actor.id) > 0) setCommanderId(actor.id);
  }

  function selectFormationCell(side, index) {
    if (!targetingRow || inputSuppressed) return;
    if (!validAnchors.some((entry) => entry.side === side && entry.index === index)) return;
    const anchorCell = { side, index };
    const formations = encounterFormations(encounter);
    const occupant = formations[side]?.[index];
    if (occupant && encounter.actors[occupant]?.side === "enemy") setTargetId(occupant);
    // Input always uses the current authoritative formation. While no target decision is
    // open, movement may keep showing its pre-move cosmetic frame; opening targeting drops
    // that cosmetic snapshot so visible cells, previews, and the committed anchor agree.
    const preview = resolveSkillTargets(
      encounter,
      targetingRow.definition,
      activeCommander.id,
      { anchorCell },
    );
    if (preview.ok && preview.targetIds.length === 1) {
      queueSkillAction(targetingRow, preview);
      return;
    }
    setTargetingDraft((current) => current ? {
      ...current,
      anchorCell,
    } : current);
  }

  function previewFormationCell(side, index) {
    if (!targetingRow || inputSuppressed) {
      setPreviewAnchorCell(null);
      return;
    }
    if (side === null || index === null) {
      setPreviewAnchorCell(null);
      return;
    }
    if (!validAnchors.some((entry) => entry.side === side && entry.index === index)) return;
    setPreviewAnchorCell({ side, index });
  }

  function cancelSkillTargeting() {
    const returnTarget = targetingActionRef.current;
    targetingActionRef.current = null;
    setTargetingDraft(null);
    setPreviewAnchorCell(null);
    const restoreTarget = () => {
      if (returnTarget?.isConnected && !returnTarget.disabled) returnTarget.focus();
      else firstActionRef.current?.focus();
    };
    if (typeof globalThis.requestAnimationFrame === "function") {
      globalThis.requestAnimationFrame(restoreTarget);
    } else {
      queueMicrotask(restoreTarget);
    }
  }

  function queueSkillAction(row = targetingRow, preview = resolvedPreview) {
    if (inputSuppressed || !row?.legality.ok || !preview?.ok) return;
    const reducedMotion = typeof window !== "undefined"
      && typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const choreography = combatChoreographyForAction(
      row.definition,
      row.weaponPresentation,
      { reducedMotion },
    );
    const target = encounter.actors[preview.primaryTargetId] || activeCommander;
    const tier = presentationTier(row.definition, row.skillState.rank);
    const targetProfile = abilityTargeting(row.definition);
    const hidesRedundantFieldPreview = targetProfile.footprint === "all";
    const declarationMs = tier === "mythical" ? (reducedMotion ? 280 : 1120) : 0;
    const beat = {
      actorId: activeCommander.id,
      actorName: activeCommander.id === encounter.playerId ? "You" : activeCommander.name,
      choreography,
      displayName: row.displayName,
      phase: tier === "mythical" ? "declaration" : "windup",
      presentationTier: tier,
      sequence: encounter.sequence,
      skillId: row.skillState.id,
      anchorCell: hidesRedundantFieldPreview ? null : preview.anchorCell,
      affectedCells: hidesRedundantFieldPreview ? [] : preview.affectedCells,
      targetId: target?.id || preview.primaryTargetId,
      targetName: target?.id === activeCommander.id ? "the stance" : target?.name || "the target",
    };
    setInspectedSkillId(null);
    setInspectedStatus(null);
    setInspectedActorId(null);
    setRecordExpanded(false);
    setSatchelOpen(false);
    setTargetingDraft(null);
    setPreviewAnchorCell(null);
    targetingActionRef.current = null;
    setActionBeat({ ...beat, phase: declarationMs > 0 ? "declaration" : "windup" });
    clearActionTimer("declaration");
    clearActionTimer("commit");
    clearActionTimer("release");
    // Dispatch first, decorate second: the kernel owns truth, so the command leaves for
    // the engine immediately and the declaration/recovery rhythm plays as a cosmetic
    // tail. The player's next legal command is never held hostage to either.
    try {
      onUseSkill(
        row.skillState.id,
        preview.primaryTargetId,
        activeCommander.id,
        preview.anchorCell,
      );
    } finally {
      if (declarationMs > 0) {
        actionTimersRef.current.declaration = setTimeout(() => {
          actionTimersRef.current.declaration = null;
          setActionBeat((current) => current ? { ...current, phase: "resolve" } : current);
        }, declarationMs);
      }
      actionTimersRef.current.release = setTimeout(
        releaseActionBeat,
        declarationMs + choreography.recoveryMs,
      );
    }
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
    clearActionTimer("declaration");
    clearActionTimer("commit");
    clearActionTimer("release");
    clearImpactCueTimer();
    clearTerminalRevealTimer();
  }, []);

  useEffect(() => {
    (terminal ? settleRef.current : firstActionRef.current)?.focus();
  }, [terminal]);

  useEffect(() => {
    if (!targetingDraft?.skillId || inputSuppressed) return;
    combatRef.current
      ?.querySelector(".combat-formation-cell.is-valid-anchor:not(:disabled)")
      ?.focus();
  }, [inputSuppressed, targetingDraft?.skillId]);

  useEffect(() => {
    setInspectedSkillId(null);
    setInspectedStatus(null);
    setRecordExpanded(false);
    setSatchelOpen(false);
    setTargetingDraft(null);
    setPreviewAnchorCell(null);
    targetingActionRef.current = null;
  }, [activeCommander.id, encounter.round, terminal]);

  useEffect(() => {
    if (!satchelOpen) return undefined;
    const closeFromOutside = (event) => {
      if (!satchelRef.current?.contains(event.target)) setSatchelOpen(false);
    };
    document.addEventListener("pointerdown", closeFromOutside);
    return () => document.removeEventListener("pointerdown", closeFromOutside);
  }, [satchelOpen]);

  useEffect(() => {
    if (combatItemRows.length === 0 || inputSuppressed) setSatchelOpen(false);
  }, [combatItemRows.length, inputSuppressed]);

  useLayoutEffect(() => {
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
    const focusedBeforeCues = combatRef.current?.contains(document.activeElement)
      ? document.activeElement
      : null;
    setImpactCues(nextCues);
    if (focusedBeforeCues) {
      queueMicrotask(() => {
        if (combatRef.current?.contains(document.activeElement)) return;
        const preferred = focusedBeforeCues.isConnected && !focusedBeforeCues.matches(":disabled")
          ? focusedBeforeCues
          : firstActionRef.current;
        preferred?.focus?.();
      });
    }
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

  // A controlled or out-prioritised command window is presentation, never input. There
  // is nothing for the player to decide inside it, so the view announces the reason via
  // the command rail and hands the turn straight back instead of holding the round
  // behind an unskippable read delay. The sequence key prevents Strict Mode or a harmless
  // rerender from dispatching the same forced command twice.
  useEffect(() => {
    if (
      terminal
      || !forcedWindow
      || actionsLeft(encounter, activeCommander.id) <= 0
      || typeof onStandDown !== "function"
    ) return undefined;
    const key = `${encounter.sequence}:${activeCommander.id}:${forcedWindow.kind}`;
    if (forcedAdvanceRef.current === key) return undefined;
    forcedAdvanceRef.current = key;
    onStandDown(activeCommander.id);
    return undefined;
  }, [
    activeCommander.id,
    encounter,
    encounter.sequence,
    forcedWindow?.kind,
    onStandDown,
    terminal,
  ]);

  function keepFocusInside(event) {
    if (event.key === "Escape") {
      if (satchelOpen) {
        event.preventDefault();
        setSatchelOpen(false);
        globalThis.requestAnimationFrame?.(() => satchelTriggerRef.current?.focus());
      } else if (inspectedActorId) {
        event.preventDefault();
        setInspectedActorId(null);
      } else if (inspectedSkillId) {
        event.preventDefault();
        setInspectedSkillId(null);
      } else if (inspectedStatus) {
        event.preventDefault();
        setInspectedStatus(null);
      } else if (recordExpanded) {
        event.preventDefault();
        setRecordExpanded(false);
      } else if (targetingDraft) {
        event.preventDefault();
        cancelSkillTargeting();
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

  const formations = encounterFormations(encounter);
  const sceneImage = typeof sceneArt === "string" ? sceneArt : sceneArt?.image || battleScene;
  const sceneStyle = typeof sceneArt === "object" && sceneArt ? {
    "--combat-scene-primary": sceneArt.primary || undefined,
    "--combat-scene-accent": sceneArt.accent || undefined,
    "--combat-scene-deep": sceneArt.deep || undefined,
  } : undefined;

  return (
    <div
      ref={combatRef}
      className={`archetype-combat${terminal ? " is-terminal" : ""}${presentationLocked ? " is-presenting-action" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="archetype-combat-title"
      tabIndex="-1"
      aria-busy={presentationLocked}
      data-presentation-phase={actionBeat?.phase || (terminalHold ? "resolution-hold" : "ready")}
      data-action-motion={actionBeat?.choreography.visual.motion || undefined}
      style={sceneStyle}
      onKeyDown={keepFocusInside}
    >
      <img className="archetype-combat__scene" src={sceneImage} alt="" aria-hidden="true" />
      <div className="archetype-combat__backdrop" aria-hidden="true" />

      <main className="archetype-combat__stage">
        <header className="archetype-combat__header">
          <h1 id="archetype-combat-title" className="archetype-combat__sr-only">
            {terminal
              ? encounter.phase === "victory" ? "Victory" : encounter.phase === "retreated" ? "Retreated" : "Defeat"
              : `Combat, round ${encounter.round}`}
          </h1>
          <p className="archetype-combat__round">
            <span>Round</span>
            <strong>{encounter.round}</strong>
            {!terminal ? (
              <em>{actionBeat?.phase === "declaration"
                ? "Mythical ability"
                : actionBeat ? "Resolving"
                  : forcedWindow ? `${forcedWindow.label}` : "Your move"}</em>
            ) : null}
          </p>
          <p className="archetype-combat__context">
            {terminal
              ? encounter.phase === "victory" ? "Victory" : encounter.phase === "retreated" ? "Retreated" : "Defeat"
              : note}
          </p>
          <div className="archetype-combat__header-controls">
            {!authoritativeTerminal && onRetreat ? (
              <button
                type="button"
                className="archetype-combat__escape archetype-combat__escape--retreat"
                onClick={() => onRetreat(activeCommander.id)}
                disabled={inputSuppressed || Boolean(forcedWindow)}
                aria-label={`Attempt retreat. ${retreat.chancePercent}% chance. Spends ${commanderPossessive} action on failure.`}
              >
                <Icon name="arrowLeft" size={15} />
                <span>Retreat · {retreat.chancePercent}%</span>
              </button>
            ) : null}
            {onEscape ? (
              <button type="button" className="archetype-combat__escape" onClick={onEscape} disabled={mythicDeclaring}>
                <Icon name="x" size={15} />
                <span>{escapeLabel}</span>
              </button>
            ) : null}
          </div>
        </header>

        <section className="archetype-combat__battlefield archetype-combat__battlefield--formation" aria-label="Combatants">
          <span className="archetype-combat__battle-light archetype-combat__battle-light--foe" aria-hidden="true" />
          <span className="archetype-combat__battle-light archetype-combat__battle-light--hero" aria-hidden="true" />

          <FormationBattlefield
            actors={encounter.actors}
            formations={formations}
            artForActor={combatArt}
            validAnchors={!inputSuppressed ? validAnchors : []}
            affectedCells={footprintPreview?.affectedCells
              || (actionBeat?.phase !== "resolve" ? actionBeat?.affectedCells : null)
              || []}
            previewAnchor={transientPreview?.anchorCell || null}
            selectedAnchor={resolvedPreview?.anchorCell
              || targetingDraft?.anchorCell
              || (actionBeat?.phase !== "resolve" ? actionBeat?.anchorCell : null)
              || null}
            intentCells={terminal ? [] : intentCells}
            intentCellsBeforeMove={targetingRow ? [] : intentCellsBeforeMove}
            activeActorId={terminal ? null : activeCommander.id}
            onSelectCell={selectFormationCell}
            onPreviewCell={previewFormationCell}
            onInspectActor={inspectCombatant}
            renderActorOverlay={renderFormationOverlay}
            feedbackCues={impactCues}
            movementCue={targetingRow ? null : movementCue}
          />

          {!terminal ? (
            <CombatDeclarations beat={actionBeat} cues={impactCues} encounter={encounter} />
          ) : null}

          <CombatEffects cues={impactCues} />
        </section>

        <MythicalAbilityDeclaration beat={actionBeat} portrait={combatArt(stagedHero)} />

        {inspectedActor ? (
          <CombatantDossier
            actor={inspectedActor}
            art={combatArt(inspectedActor)}
            abilityRows={dossierAbilityRows}
            opener={dossierOpenerRef.current}
            onClose={() => setInspectedActorId(null)}
          />
        ) : null}

        {error ? <p className="archetype-combat__alert" role="alert">{error}</p> : null}

        {!terminal ? (
          <footer
            className={`archetype-combat__command${presentationLocked ? " is-committed" : ""}${forcedWindow ? " is-forced" : ""}`}
            aria-busy={inputSuppressed || Boolean(forcedWindow)}
          >
            <p className="archetype-combat__sr-only" aria-live="polite">
              {forcedWindow
                ? `${forcedWindow.label}. No player input.`
                : `${activeCommander.name}, ${actionsLeft(encounter, activeCommander.id)} actions remaining.`}
            </p>

            {targetingRow ? (
              <section
                className="archetype-combat__target-confirm"
                aria-label={`${targetingRow.displayName} target confirmation`}
                data-testid="combat-target-confirmation"
              >
                <span>
                  <small>{resolvedPreview ? "Footprint ready" : "Choose a highlighted cell"}</small>
                  <strong>{targetingRow.displayName}</strong>
                  <em>
                    {abilityTargeting(targetingRow.definition).footprint.replace("-", " ")}
                    {resolvedPreview
                      ? ` · ${resolvedPreview.targetIds.length} target${resolvedPreview.targetIds.length === 1 ? "" : "s"}`
                      : " · preview before committing"}
                  </em>
                </span>
                <button type="button" className="archetype-combat__target-cancel" onClick={cancelSkillTargeting}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="archetype-combat__target-commit"
                  disabled={!resolvedPreview || inputSuppressed}
                  onClick={() => queueSkillAction(targetingRow, resolvedPreview)}
                >
                  Confirm
                </button>
              </section>
            ) : null}

            <div className="archetype-combat__actions" aria-label="Combat actions">
              {skillRows.map((row, index) => (
                <CombatAction
                  key={row.skillState.id}
                  firstActionRef={index === 0 ? firstActionRef : null}
                  definition={row.definition}
                  displayName={row.displayName}
                  art={row.art}
                  skillState={row.skillState}
                  cost={row.cost}
                  legacyLimit={row.legacyLimit}
                  weaponPresentation={row.weaponPresentation}
                  legality={row.legality}
                  active={row.skillState.id === inspectedSkillId}
                  busy={inputSuppressed}
                  committed={row.skillState.id === actionBeat?.skillId || row.skillState.id === targetingDraft?.skillId}
                  onShowDetails={() => {
                    setInspectedStatus(null);
                    setRecordExpanded(false);
                    setInspectedSkillId(row.skillState.id);
                  }}
                  onHideDetails={() => setInspectedSkillId(null)}
                  onUse={(initiatingAction) => beginSkillTargeting(row, initiatingAction)}
                />
              ))}
            </div>

            {combatItemRows.length > 0 ? (
              <div className="archetype-combat__command-tools archetype-combat__command-tools--satchel">
              <div className="archetype-combat__satchel-slot">
                {combatItemRows.length > 0 ? (
                  <div className="archetype-combat__satchel" ref={satchelRef}>
                    <button
                      ref={satchelTriggerRef}
                      type="button"
                      className="archetype-combat__satchel-trigger"
                      aria-label={`Open satchel. ${combatItemQuantity} consumable${combatItemQuantity === 1 ? "" : "s"} carried.`}
                      aria-haspopup="dialog"
                      aria-expanded={satchelOpen}
                      aria-controls={satchelOpen ? "archetype-combat-satchel" : undefined}
                      disabled={inputSuppressed || Boolean(forcedWindow)}
                      onClick={() => {
                        setInspectedSkillId(null);
                        setInspectedStatus(null);
                        setInspectedActorId(null);
                        setRecordExpanded(false);
                        setSatchelOpen((current) => !current);
                      }}
                    >
                      <Icon name="bagOpen" size={19} strokeWidth={1.55} />
                      <span aria-hidden="true">{combatItemQuantity}</span>
                    </button>

                    {satchelOpen ? (
                      <section
                        id="archetype-combat-satchel"
                        className="archetype-combat__satchel-panel"
                        role="dialog"
                        aria-label="Combat satchel"
                      >
                        <header>
                          <span><small>Inventory</small><strong>Satchel</strong></span>
                          <span>{combatItemRows.length} kind{combatItemRows.length === 1 ? "" : "s"} · {combatItemQuantity} total</span>
                          <button
                            type="button"
                            aria-label="Close satchel"
                            onClick={() => {
                              setSatchelOpen(false);
                              globalThis.requestAnimationFrame?.(() => satchelTriggerRef.current?.focus());
                            }}
                          >
                            <Icon name="x" size={14} strokeWidth={1.7} />
                          </button>
                        </header>
                        <div className="archetype-combat__satchel-list">
                          {combatItemRows.map(({ item, held, legality }) => {
                            const art = resolveCombatKeepsakeArt(item.id);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                className="archetype-combat__satchel-item"
                                disabled={inputSuppressed || !legality.ok}
                                aria-label={`${item.name}. ${describeCombatItemEffect(item)}. ${held.quantity} left${legality.ok ? ". Use item" : `. ${refusalText(legality.reason, held)}`}`}
                                onClick={() => {
                                  setSatchelOpen(false);
                                  onUseItem?.(item.id, activeTarget, activeCommander.id);
                                }}
                              >
                                <span className="archetype-combat__satchel-art" aria-hidden="true">
                                  {art ? <img src={art} alt="" /> : <Icon name="bag" size={21} />}
                                </span>
                                <span className="archetype-combat__satchel-copy">
                                  <strong>{item.name}</strong>
                                  <small>{describeCombatItemEffect(item)}</small>
                                  {!legality.ok ? <em>{refusalText(legality.reason, held)}</em> : null}
                                </span>
                                <span className="archetype-combat__satchel-quantity" aria-hidden="true">×{held.quantity}</span>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    ) : null}
                  </div>
                ) : null}
              </div>

              </div>
            ) : null}

            {inspectedSkill ? (
              <SkillDetails
                {...inspectedSkill}
                onDismiss={() => setInspectedSkillId(null)}
              />
            ) : null}

            <div className="archetype-combat__command-foot">
              {!forcedWindow && commandable.length > 1 && actionsLeft(encounter, activeCommander.id) > 0 ? (
                <button
                  type="button"
                  className="archetype-combat__hold"
                  aria-disabled={inputSuppressed}
                  onClick={() => {
                    if (!inputSuppressed) onStandDown?.(activeCommander.id);
                  }}
                >
                  {activeCommander.id === encounter.playerId
                    ? "Stand down"
                    : `${activeCommander.name} stands down`}
                </button>
              ) : <span />}
              {saveState ? <p className="archetype-combat__save">{saveState}</p> : null}
            </div>
          </footer>
        ) : (
          <footer className="archetype-combat__outcome production-combat__outcome" aria-live="assertive">
            <div className="archetype-combat__outcome-heading">
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
            <dl className="archetype-combat__tally">
              <div><dt>Rounds</dt><dd>{encounter.round}</dd></div>
              <div><dt>Foes down</dt><dd>{fallen}/{enemies.length}</dd></div>
              <div><dt>Health</dt><dd>{player.hp}/{player.maxHp}</dd></div>
            </dl>
            <div className="archetype-combat__outcome-record">
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
              className="archetype-combat__settle production-combat__settle"
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

export default ArchetypeCombatView;
