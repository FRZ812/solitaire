import React, { useEffect, useRef, useState } from "react";
import battleScene from "../../assets/generated/scene-crowsmoor-v2.webp";
import { Icon } from "../Icon.jsx";
import { declaredIntents, retreatOdds } from "../../gameplay/tow/encounter.js";
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
  combatTempoReceipt,
  recentCombatReceipts,
} from "./tow-combat-feedback.js";
import { combatVfxForIntent } from "./tow-combat-vfx.js";
import { combatChoreographyForAction } from "./tow-combat-choreography.js";
import "./tow-combat.css";

function percent(value, max) {
  return Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
}

const REFUSALS = {
  "on-cooldown": (skill) => `ready in ${skill.cooldownRemaining}`,
  "no-uses-remaining": () => "spent",
  "turn-already-spent": () => "no action left",
  "invalid-skill-state": () => "unavailable",
};

const HOLD_FOR_DETAILS_MS = 420;
const CONTACT_REACTIONS = new Set(["block", "critical", "evade", "hit", "ward"]);

function refusalText(reason, skillState) {
  const render = REFUSALS[reason];
  return render ? render(skillState) : "unavailable";
}

function monogram(name) {
  return (String(name || "?").trim()[0] || "?").toUpperCase();
}

function actionKind(definition) {
  if (definition.abilityType === "basic-attack") return "attack";
  if (definition.abilityType === "defensive") return "guard";
  if (definition.abilityType === "ultimate") return "ultimate";
  if (definition.abilityType === "special") return definition.consumesTurn ? "technique" : "swift";
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
  if (effect.type === "shield") return `${amount}% ${effect.scale} ward`;
  if (effect.type === "heal") return `Restore ${amount}% ${effect.scale} health`;
  if (effect.type === "heal-lost-fraction") return `Restore ${amount}% of lost health`;
  if (effect.type === "scaled-status") {
    return `${amount}% ${effect.scale} ${effect.status.replace(/-/g, " ")}`;
  }
  if (effect.type === "status") return `${amount} ${effect.status.replace(/-/g, " ")}`;
  if (effect.type === "reduce-statuses") {
    return `Reduce ${effect.statuses.join(", ")} to ${effect.toPercent}%`;
  }
  if (effect.type === "amplify-statuses") {
    return `Raise ${effect.statuses.join(", ")} to ${amount}%`;
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
    if (legality.ok) onUse();
    else onShowDetails();
  }

  useEffect(() => cancelHold, []);

  return (
    <button
      ref={firstActionRef}
      type="button"
      className={`tow-combat__action production-combat__action tow-combat__action--${actionKind(definition)}${active ? " is-inspecting" : ""}${committed ? " is-committed" : ""}${!legality.ok ? " is-unavailable" : ""}`}
      aria-label={`${displayName}. ${towSkillDetail(definition, skillState, weaponPresentation)}. ${legality.ok ? "Tap to use; hold for details" : refusalText(legality.reason, skillState)}`}
      aria-disabled={busy || !legality.ok}
      aria-expanded={active}
      disabled={busy}
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
      <span className="tow-combat__sr-only">{displayName}</span>
    </button>
  );
}

function ArtFigure({ actor, src, side }) {
  return (
    <div className={`tow-combat__art tow-combat__art--${side}${actor.hp <= 0 ? " is-down" : ""}`}>
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

function IntentBadge({ intent, target, playerId }) {
  if (!intent) return null;
  const visual = combatVfxForIntent(intent);
  const damage = intent.hits > 1 ? `${intent.hits}×${intent.damage}` : intent.damage;
  const targetName = target?.name || intent.targetName || "your party";
  return (
    <div
      className={`tow-combat__intent tow-combat__intent--${visual.family}${intent.hits > 1 ? " is-multi" : ""}`}
      role="img"
      aria-label={`${intent.name}, ${intent.hits > 1 ? `${intent.hits} hits of ${intent.damage}` : `${intent.damage} damage`}, targeting ${targetName}`}
      title={`${intent.name} · ${damage} damage · ${targetName}`}
      data-testid="tow-enemy-intent"
    >
      <span className="tow-combat__intent-sigil" aria-hidden="true">
        <img src={visual.asset} alt="" />
        <i />
      </span>
      <strong aria-hidden="true">{damage}</strong>
      <span className="tow-combat__intent-target" aria-hidden="true">→ {target?.id === playerId ? "You" : targetName}</span>
      <span className="tow-combat__sr-only">Incoming: {intent.name}</span>
    </div>
  );
}

function Statuses({ actor }) {
  if (actor.statuses.length === 0) return null;
  return (
    <ul className="tow-combat__statuses" aria-label={`${actor.name} statuses`}>
      {actor.statuses.map((status) => (
        <li key={status.type} className="tow-combat__status">
          <span>{status.type.replace(/-/g, " ")}</span>
          <strong>{status.count}</strong>
        </li>
      ))}
    </ul>
  );
}

function Vitals({ actor, enemy = false, feedbackDelay = 0, reacting = false }) {
  const [presented, setPresented] = useState({ hp: actor.hp, maxHp: actor.maxHp, shield: actor.shield });

  useEffect(() => {
    const delay = Math.max(0, feedbackDelay);
    const update = setTimeout(() => setPresented({
      hp: actor.hp,
      maxHp: actor.maxHp,
      shield: actor.shield,
    }), delay);
    return () => clearTimeout(update);
  }, [actor.hp, actor.maxHp, actor.shield, feedbackDelay]);

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

function CombatantPlate({ actor, role, enemy = false, feedbackCues = [] }) {
  const reactions = feedbackCues.filter((cue) => cue.targetId === actor.id);
  const feedbackDelay = reactions.length > 0
    ? Math.max(...reactions.map((cue) => cue.delayMs || 0))
    : 0;
  return (
    <div className={`tow-combat__plate${enemy ? " tow-combat__plate--enemy" : " tow-combat__plate--hero"}`}>
      <div className="tow-combat__identity">
        <span>{role}</span>
        <h2>{actor.name}</h2>
      </div>
      <Vitals actor={actor} enemy={enemy} feedbackDelay={feedbackDelay} reacting={reactions.length > 0} />
      <Statuses actor={actor} />
    </div>
  );
}

function targetLabel(actor, intent) {
  if (actor.hp <= 0) return `${actor.name}, down`;
  const health = `${actor.hp} of ${actor.maxHp} health`;
  if (!intent) return `Target ${actor.name}, ${health}`;
  const blow = intent.hits > 1
    ? `${intent.hits} hits of ${intent.damage}`
    : `${intent.damage} damage`;
  return `Target ${actor.name}, ${health}, preparing ${intent.name} for ${blow}`;
}

function actionsLeft(encounter, actorId) {
  if (actorId === encounter.playerId) return encounter.turn.actionsRemaining;
  return encounter.turn.allies?.[actorId] ?? 0;
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
        return (
          <span
            key={cue.id || `${cue.sequence}-${cue.kind}-${cue.targetId || index}`}
            className={`tow-combat__effect tow-combat__effect--${cue.kind} tow-combat__effect--${cue.targetSide} tow-combat__effect--vfx-${cue.visual?.family || "impact"} tow-combat__effect--motion-${cue.visual?.motion || "balanced"}`}
            data-vfx-variant={cue.visual?.variant || "unknown"}
            data-hit-index={cue.hitIndex ?? 0}
            data-hit-count={cue.hitCount ?? 1}
            data-action-index={cue.actionIndex ?? 0}
            data-effect-lane={lane}
            style={{
              "--tow-effect-delay": `${cue.delayMs || 0}ms`,
              "--tow-effect-x": `${laneX}px`,
              "--tow-effect-y": `${laneY}px`,
            }}
          >
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

function CombatRecord({ receipts, tempo, opening, expanded, onToggle }) {
  const latest = receipts.at(-1) || tempo || opening;
  if (!latest) return null;
  const rows = [tempo, opening, ...receipts].filter(Boolean);
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

function ActionBeat({ beat, receipt }) {
  const resolving = beat.phase === "resolve";
  return (
    <section
      className={`tow-combat__action-beat tow-combat__action-beat--${beat.choreography.visual.family}`}
      data-motion={beat.choreography.visual.motion}
      data-testid="tow-action-beat"
      aria-live="assertive"
    >
      <span className="tow-combat__action-beat-art" aria-hidden="true">
        <img src={beat.art} alt="" />
        <i><img src={beat.choreography.visual.asset} alt="" /></i>
      </span>
      <span className="tow-combat__action-beat-copy">
        <small>{resolving ? "Consequence" : beat.choreography.paceLabel}</small>
        <strong>{beat.displayName}</strong>
        <span>
          {resolving && receipt
            ? receipt.text
            : `${beat.actorName} ${beat.choreography.windupVerb} ${beat.targetName}.`}
        </span>
      </span>
      <span className={`tow-combat__cadence${resolving ? " is-resolving" : ""}`} aria-hidden="true">
        <i /><i /><i />
      </span>
    </section>
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
  const [targetId, setTargetId] = useState(null);
  const [commanderId, setCommanderId] = useState(null);
  const [inspectedSkillId, setInspectedSkillId] = useState(null);
  const [recordExpanded, setRecordExpanded] = useState(false);
  const [impactCues, setImpactCues] = useState([]);
  const [actionBeat, setActionBeat] = useState(null);
  const actionTimersRef = useRef({ commit: null, release: null });

  const player = encounter.actors[encounter.playerId];
  const allies = (encounter.allyIds || []).map((id) => encounter.actors[id]);
  const playerSide = [player, ...allies];
  const enemies = encounter.enemyIds.map((id) => encounter.actors[id]);
  const living = enemies.filter((enemy) => enemy.hp > 0);
  const terminal = encounter.phase !== "player";
  const activeTarget = living.find((enemy) => enemy.id === targetId)?.id || living[0]?.id || null;
  const commandable = playerSide.filter((actor) => actor.hp > 0);
  const activeCommander = commandable.find((actor) => (
    actor.id === commanderId && actionsLeft(encounter, actor.id) > 0
  ))
    || commandable.find((actor) => actionsLeft(encounter, actor.id) > 0)
    || commandable.find((actor) => actor.id === commanderId)
    || commandable[0]
    || player;
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
    return {
      art: resolveTowAbilityArt(definition, commanderWeapon),
      definition,
      displayName: resolveTowActionName(definition, commanderWeapon),
      legality: skillLegality(skillState, {
        turnAvailable: actionsLeft(encounter, activeCommander.id) > 0,
      }),
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
  const retreat = terminal ? null : retreatOdds(encounter);
  const receiptOptions = {
    skillName: (event) => {
      const actor = encounter.actors[event.actorId];
      const definition = getSkill(event.skillId);
      return resolveTowActionName(definition, actor ? weaponPresentationFor(actor) : commanderWeapon);
    },
  };
  const receipts = recentCombatReceipts(encounter, receiptOptions);
  const tempoReceipt = combatTempoReceipt(encounter, activeCommander.id);
  const activeIntent = intents[staged?.id];
  const openingReceipt = activeIntent ? {
    sequence: `intent-${encounter.round}-${staged?.id}`,
    kind: "intent",
    text: `${staged.name} declares ${activeIntent.name} against ${encounter.actors[activeIntent.targetId]?.name || activeIntent.targetName || "the party"}: ${activeIntent.hits > 1 ? `${activeIntent.hits} hits of ${activeIntent.damage}` : `${activeIntent.damage} damage`}. ${activeCommander.name} has ${actionsLeft(encounter, activeCommander.id)} action${actionsLeft(encounter, activeCommander.id) === 1 ? "" : "s"}.`,
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
  const actionBeatReceipt = (() => {
    if (!actionBeat || encounter.sequence <= actionBeat.sequence) return null;
    const actionEvents = encounter.events.filter((event) => (
      event.sequence > actionBeat.sequence
      && event.actorId === actionBeat.actorId
      && event.skillId === actionBeat.skillId
    ));
    const primary = actionEvents.find((event) => event.type === "skill-damage")
      || actionEvents.find((event) => [
        "skill-shield",
        "skill-heal",
        "skill-cleanse",
        "skill-status",
        "skill-status-amplified",
      ].includes(event.type));
    return receipts.find((receipt) => receipt.sequence === primary?.sequence)
      || swiftReceipt
      || receipts.at(-1)
      || null;
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

  function releaseActionBeat() {
    clearActionTimer("release");
    setActionBeat(null);
  }

  function queueSkillAction(row) {
    if (actionBeat || !row.legality.ok) return;
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
  }, []);

  useEffect(() => {
    (terminal ? settleRef.current : firstActionRef.current)?.focus();
  }, [terminal]);

  useEffect(() => {
    setInspectedSkillId(null);
  }, [activeCommander.id, encounter.round, terminal]);

  useEffect(() => {
    if (encounter.sequence <= seenEventRef.current) {
      seenEventRef.current = encounter.sequence;
      return undefined;
    }
    const nextCues = combatCueTimeline(
      encounter,
      encounter.events.filter((entry) => entry.sequence > seenEventRef.current),
    );
    seenEventRef.current = encounter.sequence;
    if (nextCues.length === 0) return undefined;
    setImpactCues(nextCues);
    const finalDelay = Math.max(0, ...nextCues.map((cue) => cue.delayMs || 0));
    const clear = setTimeout(() => setImpactCues([]), finalDelay + 1450);
    if (actionBeat) {
      setActionBeat((current) => current ? { ...current, phase: "resolve" } : current);
      clearActionTimer("release");
      actionTimersRef.current.release = setTimeout(releaseActionBeat, finalDelay + 1050);
    }
    return () => clearTimeout(clear);
  }, [encounter, encounter.sequence]);

  function keepFocusInside(event) {
    if (event.key === "Escape") {
      if (actionBeat) {
        event.preventDefault();
        return;
      }
      if (inspectedSkillId) {
        event.preventDefault();
        setInspectedSkillId(null);
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
        disabled={Boolean(actionBeat)}
        onClick={() => setTargetId(enemy.id)}
      >
        {body}
      </button>
    ) : (
      <article key={enemy.id} className="tow-combat__foe-token is-down" aria-label={`Foe: ${enemy.name}`}>
        {body}
      </article>
    );
  }

  return (
    <div
      className={`tow-combat${terminal ? " is-terminal" : ""}${actionBeat ? " is-presenting-action" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tow-combat-title"
      tabIndex="-1"
      aria-busy={Boolean(actionBeat)}
      data-presentation-phase={actionBeat?.phase || "ready"}
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
              <em>{actionBeat
                ? actionBeat.phase === "windup" ? "Action committed" : "Reading the exchange"
                : activeCommander.id === encounter.playerId ? "Your move" : `${activeCommander.name}'s move`}</em>
            ) : null}
          </p>
          <p className="tow-combat__context">
            {terminal
              ? encounter.phase === "victory" ? "Victory" : encounter.phase === "retreated" ? "Retreated" : "Defeat"
              : note}
          </p>
          <div className="tow-combat__header-controls">
            {!terminal && onRetreat ? (
              <button
                type="button"
                className="tow-combat__escape tow-combat__escape--retreat"
                onClick={() => onRetreat(activeCommander.id)}
                disabled={Boolean(actionBeat)}
                aria-label={`Attempt retreat. ${retreat.chancePercent}% chance. Spends ${commanderPossessive} action on failure.`}
              >
                <Icon name="arrowLeft" size={15} />
                <span>Retreat · {retreat.chancePercent}%</span>
              </button>
            ) : null}
            {onEscape ? (
              <button type="button" className="tow-combat__escape" onClick={onEscape} disabled={Boolean(actionBeat)}>
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
              className={`tow-combat__threat${staged.hp <= 0 ? " is-down" : ""}${actionBeat?.targetId === staged.id ? " is-action-targeted" : ""} ${actorFeedbackClasses(staged.id, impactCues)}`.trim()}
              style={actorFeedbackStyle(staged.id, impactCues)}
              aria-label={`Foe: ${staged.name}`}
            >
              <ArtFigure actor={staged} src={combatArt(staged)} side="foe" />
              {!terminal ? <IntentBadge intent={intents[staged.id]} target={encounter.actors[intents[staged.id]?.targetId]} playerId={encounter.playerId} /> : null}
              <CombatantPlate actor={staged} role={actionBeat?.targetId === staged.id ? "Marked foe" : "Foe"} enemy feedbackCues={impactCues} />
            </article>
          ) : null}

          {enemies.length > 1 ? (
            <section className="tow-combat__foe-rail" aria-label="Choose a foe">
              {enemies.map(enemyToken)}
            </section>
          ) : null}

          {!terminal && actionBeat ? (
            <section className="tow-combat__exchange" aria-label="Resolving action">
              <ActionBeat
                beat={actionBeat}
                receipt={actionBeatReceipt}
              />
            </section>
          ) : null}

          {!terminal && !actionBeat ? (
            <section className="tow-combat__exchange" aria-label="Combat record">
              <CombatRecord
                receipts={swiftReceipt ? [...receipts, swiftReceipt] : receipts}
                tempo={tempoReceipt}
                opening={openingReceipt}
                expanded={recordExpanded}
                onToggle={() => setRecordExpanded((value) => !value)}
              />
            </section>
          ) : null}

          <CombatEffects cues={impactCues} />

          <article
            className={`tow-combat__hero${stagedHero.hp <= 0 ? " is-down" : ""}${actionBeat?.actorId === stagedHero.id && actionBeat.phase === "windup" ? ` is-action-windup is-action-motion-${actionBeat.choreography.visual.motion}` : ""} ${actorFeedbackClasses(stagedHero.id, impactCues)}`.trim()}
            style={{
              ...actorFeedbackStyle(stagedHero.id, impactCues),
              "--tow-action-windup": `${actionBeat?.choreography.windupMs || 0}ms`,
            }}
            aria-label={stagedHero.id === encounter.playerId ? `You: ${stagedHero.name}` : `Ally: ${stagedHero.name}`}
          >
            <ArtFigure actor={stagedHero} src={combatArt(stagedHero)} side="hero" />
            <CombatantPlate
              key={stagedHero.id}
              actor={stagedHero}
              role={stagedHero.id === encounter.playerId ? "You" : "Ally acting"}
              feedbackCues={impactCues}
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
          <footer className={`tow-combat__command${actionBeat ? " is-committed" : ""}`} aria-busy={Boolean(actionBeat)}>
            <div className="tow-combat__command-heading">
              <div>
                <span>{actionBeat ? actionBeat.phase === "windup" ? "Committed" : "Resolving" : stagedHero.id === encounter.playerId ? "Your command" : stagedHero.name}</span>
                <strong>{actionBeat ? actionBeat.displayName : "Choose an action"}</strong>
              </div>
              <p>
                <strong>{actionsLeft(encounter, activeCommander.id)}</strong>
                <span>action{actionsLeft(encounter, activeCommander.id) === 1 ? "" : "s"}</span>
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
                    disabled={Boolean(actionBeat)}
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
                  weaponPresentation={row.weaponPresentation}
                  legality={row.legality}
                  active={row.skillState.id === inspectedSkillId}
                  busy={Boolean(actionBeat)}
                  committed={row.skillState.id === actionBeat?.skillId}
                  onShowDetails={() => setInspectedSkillId(row.skillState.id)}
                  onHideDetails={() => setInspectedSkillId(null)}
                  onUse={() => queueSkillAction(row)}
                />
              ))}
            </div>

            <p className="tow-combat__action-hint">
              {actionBeat
                ? actionBeat.phase === "windup" ? "Commitment set · awaiting contact" : "Resolve · read the consequence"
                : "Tap to commit · hold for details"}
            </p>

            {inspectedSkill ? (
              <SkillDetails
                {...inspectedSkill}
                onDismiss={() => setInspectedSkillId(null)}
              />
            ) : null}

            <div className="tow-combat__command-foot">
              {commandable.length > 1 && actionsLeft(encounter, activeCommander.id) > 0 ? (
                <button
                  type="button"
                  className="tow-combat__hold"
                  disabled={Boolean(actionBeat)}
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
