import React, { useEffect, useRef } from "react";
import {
  getActionProgressionOffer,
  getReferenceAction,
} from "../../gameplay/reference/actions.js";
import { getReferenceTrait, TRAIT_LEVEL_CAP } from "../../gameplay/reference/abilities.js";
import { getReferenceItem } from "../../gameplay/reference/items.js";
import { getReferenceReward } from "../../gameplay/reference/rewards.js";
import { getReferenceSkill, MAX_SKILL_SLOTS } from "../../gameplay/reference/skills.js";
import { deriveBuild } from "../../gameplay/run/build.js";
import "./reference-combat.css";

function titleCase(value) {
  return String(value || "Unknown")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function Meter({ label, value, max, tone }) {
  const safeMax = Math.max(1, max);
  const safeValue = Math.max(0, Math.min(safeMax, value));
  return (
    <div className={`reference-meter reference-meter--${tone}`}>
      <span><strong>{label}</strong><b>{safeValue}/{safeMax}</b></span>
      <span
        className="reference-meter__track"
        role="meter"
        aria-label={`${label} vitality`}
        aria-valuemin="0"
        aria-valuemax={safeMax}
        aria-valuenow={safeValue}
      >
        <span style={{ width: `${(safeValue / safeMax) * 100}%` }} />
      </span>
    </div>
  );
}

function intentDamage(intent) {
  if (intent.damage.min === intent.damage.max) return String(intent.damage.min);
  return `${intent.damage.min}–${intent.damage.max}`;
}

function eventText(event, actors) {
  const actor = event.actorId ? actors[event.actorId]?.name || event.actorId : null;
  const source = event.sourceId ? actors[event.sourceId]?.name || event.sourceId : actor;
  const target = event.targetId ? actors[event.targetId]?.name || event.targetId : actor;
  const status = titleCase(event.status);
  if (event.type === "action-used") return `${actor} uses ${titleCase(event.actionId)}.`;
  if (event.type === "skill-used") return `${actor} uses ${titleCase(event.skillId)}.`;
  if (event.type === "damage-resolved") {
    const blocked = event.guardSpent > 0 ? ` ${event.guardSpent} damage blocked.` : "";
    return `${source} deals ${event.amount} damage to ${target}.${blocked}`;
  }
  if (event.type === "damage-avoided") return `${target} avoids ${event.rawAmount} damage.`;
  if (event.type === "defense-gained") return `${actor} gains ${event.amount} guard.`;
  if (event.type === "defense-expired") return `${actor}'s remaining ${event.amount} guard expires.`;
  if (event.type === "intent-resolved") return `${actor} resolves ${titleCase(event.intentId)}.`;
  if (event.type === "intent-declared") return `${actor} declares ${titleCase(event.intentId)}.`;
  if (event.type === "intent-skipped") return `${actor}'s ${titleCase(event.intentId)} is skipped: ${titleCase(event.reason)}.`;
  if (event.type === "intent-cancelled") return `${actor}'s ${titleCase(event.intentId)} is cancelled.`;
  if (event.type === "intent-consumed") return `${actor}'s ${titleCase(event.intentId)} is consumed.`;
  if (event.type === "status-applied") return `${actor} gains ${status}.`;
  if (event.type === "status-blocked") return `${actor} resists ${status}: ${titleCase(event.reason)}.`;
  if (event.type === "status-removed") return `${actor} loses ${status}: ${titleCase(event.reason)}.`;
  if (event.type === "skill-use-spent") return `${actor} has ${event.after} ${titleCase(event.skillId)} uses remaining.`;
  if (event.type === "cooldown-set") return `${titleCase(event.skillId)} cooldown set to ${event.amount}.`;
  if (event.type === "cooldown-ticked") return `${titleCase(event.skillId)} cooldown: ${event.after}.`;
  if (event.type === "encounter-ended") return `Encounter ended: ${event.outcome}.`;
  return titleCase(event.type);
}

function command(run, kind, definition, actorId, enemyId) {
  const isAction = kind === "action";
  return {
    expectedRunSequence: run.sequence,
    type: isAction ? "use-action" : "use-skill",
    actorId,
    ...(isAction ? { actionId: definition.id } : { skillId: definition.id }),
    targetId: definition.target === "self" ? actorId : enemyId,
  };
}

function BuildSheet({ run }) {
  const build = deriveBuild(run.build);
  const attackState = run.actionProgression.actions.attack;
  const attack = getReferenceAction(attackState.actionId);
  const traits = Object.entries(build.traits);
  const items = build.items.map((instance) => getReferenceItem(instance.itemId));

  return (
    <details className="reference-build">
      <summary>
        <span>Current build</span>
        <strong>{attack?.name ?? titleCase(attackState.actionId)}</strong>
      </summary>
      <div className="reference-build__grid">
        <section aria-label="Derived combat statistics">
          <h3>Stats</h3>
          <p><span>Attack</span> <b>{build.stats.attack ?? 0}</b></p>
          <p><span>Defense</span> <b>{build.stats.defense ?? 0}</b></p>
        </section>
        <section aria-label="Acquired traits">
          <h3>Traits</h3>
          {traits.length === 0
            ? <p>No traits acquired</p>
            : traits.map(([traitId, level]) => (
              <p key={traitId}>
                <span>{getReferenceTrait(traitId)?.name ?? titleCase(traitId)}</span>
                {" "}<b>{level}/{TRAIT_LEVEL_CAP}</b>
              </p>
            ))}
        </section>
        <section aria-label="Equipped items">
          <h3>Items</h3>
          {items.length === 0
            ? <p>No items equipped</p>
            : items.map((item, index) => <p key={`${item.id}:${index}`}>{item.name}</p>)}
        </section>
        <section aria-label="Action family and active fusions">
          <h3>Action &amp; fusions</h3>
          <p>{run.actionProgression.actionFamilyLocks.attack
            ? `Family: ${titleCase(run.actionProgression.actionFamilyLocks.attack)}`
            : "Action family open"}</p>
          {attackState.upgrades.map((upgrade) => (
            <p key={upgrade.offerId}>
              {getActionProgressionOffer(upgrade.offerId)?.name ?? titleCase(upgrade.offerId)}
              {" "}<b>×{upgrade.level}</b>
            </p>
          ))}
          <p>{build.fusions.length === 0 ? "No active fusions" : build.fusions.map(titleCase).join(", ")}</p>
        </section>
      </div>
    </details>
  );
}

function EncounterView({ run, onCommand, onExit }) {
  const encounter = run.encounter;
  const player = encounter.actors[encounter.playerId];
  const enemy = encounter.actors[encounter.enemyIds[0]];
  const intent = enemy.intent;
  return (
    <>
      <header className="reference-combat__header">
        <div><span>Gatekeeper vertical slice</span><h1>Round {encounter.round}</h1></div>
        <div className="reference-combat__header-actions">
          <p>
            Developer sandbox · public-evidence baseline with versioned inference gaps.
            Accepted moves update campaign state immediately; browser cache and server durability follow autosave and can fail.
          </p>
          <button type="button" className="reference-combat__leave" onClick={onExit}>Leave trial</button>
        </div>
      </header>

      <section className="reference-combat__arena" aria-label="Reference battlefield">
        <article className="reference-unit reference-unit--enemy">
          <span className="reference-unit__role">Gatekeeper trial · placement inferred</span>
          <Meter label={enemy.name} value={enemy.hp} max={enemy.maxHp} tone="enemy" />
          <div className="reference-intent">
            <span>Declared intent</span>
            <strong>{titleCase(intent.id)}</strong>
            <p>{intentDamage(intent)} damage → {player.name}</p>
          </div>
          {enemy.statuses.length > 0 && (
            <div className="reference-statuses" aria-label="Enemy statuses">
              {enemy.statuses.map((status, index) => (
                <span key={`${status.type}-${index}`}>{titleCase(status.type)}</span>
              ))}
            </div>
          )}
        </article>

        <article className="reference-unit reference-unit--player">
          <span className="reference-unit__role">Arctic Knight</span>
          <Meter label={player.name} value={player.hp} max={player.maxHp} tone="player" />
          <div className="reference-resources">
            <span>Guard <b>{player.guard}</b></span>
            <span>Attack <b>{player.stats.attack}</b></span>
            <span>Defense <b>{player.stats.defense}</b></span>
          </div>
          {player.statuses.length > 0 && (
            <div className="reference-statuses" aria-label="Player statuses">
              {player.statuses.map((status, index) => (
                <span key={`${status.type}-${index}`}>{titleCase(status.type)}</span>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="reference-commands" aria-label="Combat commands">
        <div className="reference-commands__heading">
          <div><span>Primary actions</span><h2>Read the intent, then commit</h2></div>
          <span>Turn-consuming</span>
        </div>
        <div className="reference-action-grid">
          {player.actions.map((actionId) => {
            const definition = getReferenceAction(actionId);
            return (
              <button
                type="button"
                key={actionId}
                className="reference-action"
                onClick={() => onCommand(command(run, "action", definition, player.id, enemy.id))}
              >
                <span>{definition.target === "self" ? "Protect" : "Strike"}</span>
                <strong>{definition.name}</strong>
                <small>{definition.target === "self" ? "Build guard against the declared intent" : "Resolve a seeded attack roll"}</small>
              </button>
            );
          })}
        </div>

        <div className="reference-commands__heading reference-commands__heading--skills">
          <div><span>Skills · {player.skills.length}/{MAX_SKILL_SLOTS} equipped</span><h2>Separate tactical tools</h2></div>
          <span>Uses and cooldowns persist in this fight</span>
        </div>
        <div className="reference-skill-grid">
          {player.skills.map((skill) => {
            const definition = getReferenceSkill(skill.id);
            const exhausted = skill.usesRemaining === 0;
            const coolingDown = skill.cooldownRemaining > 0;
            const disabled = exhausted || coolingDown;
            const availability = coolingDown
              ? `${skill.cooldownRemaining} rounds cooldown`
              : skill.usesRemaining === null
                ? "Ready"
                : `${skill.usesRemaining} uses left`;
            return (
              <button
                type="button"
                key={skill.id}
                className="reference-skill"
                disabled={disabled}
                onClick={() => onCommand(command(run, "skill", definition, player.id, enemy.id))}
              >
                <span>{definition.consumesTurn ? "Consumes turn" : "Free skill"}</span>
                <strong>{definition.name}</strong>
                <small>{availability}</small>
              </button>
            );
          })}
          {Array.from({ length: Math.max(0, MAX_SKILL_SLOTS - player.skills.length) }, (_, index) => (
            <div className="reference-skill reference-skill--empty" key={`empty-${index}`}>
              <span>Empty slot</span><strong>Unequipped</strong><small>Provisional 3-slot policy</small>
            </div>
          ))}
        </div>
      </section>

      <section className="reference-history" aria-label="Encounter event trace">
        <div><span>Deterministic trace</span><b>{encounter.events.length} events</b></div>
        <ol aria-live="polite">
          {encounter.events.slice(-6).map((event) => (
            <li key={event.sequence}>{eventText(event, encounter.actors)}</li>
          ))}
          {encounter.events.length === 0 && <li>The Gatekeeper declares the opening intent.</li>}
        </ol>
      </section>
      <BuildSheet run={run} />
    </>
  );
}

function RewardView({ run, onRefresh, onClaim, onExit }) {
  const offer = run.rewardOffer;
  return (
    <section className="reference-rewards" aria-labelledby="reference-reward-title">
      <span>Gatekeeper defeated</span>
      <h1 id="reference-reward-title">Choose one reward</h1>
      <p>The offer, refresh budget, and settlement revision are bound to this run.</p>
      <button type="button" className="reference-combat__leave" onClick={onExit}>Leave trial</button>
      <div className="reference-reward-grid">
        {offer.choices.map((rewardId) => {
          const reward = getReferenceReward(rewardId);
          return (
            <button
              type="button"
              key={rewardId}
              onClick={() => onClaim({
                offerId: offer.offerId,
                expectedRevision: offer.revision,
                expectedRunSequence: run.sequence,
                rewardId,
              })}
            >
              <span>{titleCase(reward.kind)}</span>
              <strong>{reward.name}</strong>
              <small>{reward.id}</small>
            </button>
          );
        })}
      </div>
      <div className="reference-reward-controls">
        <button
          type="button"
          disabled={offer.refreshesRemaining === 0}
          onClick={() => onRefresh({
            offerId: offer.offerId,
            expectedRevision: offer.revision,
            expectedRunSequence: run.sequence,
          })}
        >
          Refresh · {offer.refreshesRemaining} remaining
        </button>
        <span>Offer revision {offer.revision}</span>
      </div>
      <BuildSheet run={run} />
    </section>
  );
}

function CompleteView({ run, onExit }) {
  const won = run.status === "completed";
  const claim = run.rewardClaims.at(-1);
  return (
    <section className="reference-complete" aria-labelledby="reference-complete-title">
      <span>Reference run settled</span>
      <h1 id="reference-complete-title">{won ? "Gatekeeper defeated" : "The Arctic Knight fell"}</h1>
      <p>
        {won
          ? "Preview reward recorded only in this reference trial. Browser and server persistence may still be pending."
          : "No reward was drafted after defeat"}
      </p>
      {claim && <code>{claim.rewardId}</code>}
      <BuildSheet run={run} />
      <button type="button" onClick={onExit}>Return to Solitaire</button>
    </section>
  );
}

function ContentGapView({ run, onExit }) {
  const settled = run.status === "completed";
  const rewardGap = !settled && run.encounter?.phase === "victory";
  const claim = settled ? run.rewardClaims.at(-1) : null;
  return (
    <section className="reference-complete" aria-labelledby="reference-gap-title">
      <span>{settled ? "Trial boundary" : "Evidence gap"}</span>
      <h1 id="reference-gap-title">
        {settled
          ? "Gatekeeper trial complete"
          : rewardGap
            ? "Reward eligibility is exhausted"
            : "Standard encounter data is unresolved"}
      </h1>
      <p>
        {settled
          ? "Preview reward recorded only in this reference trial. Browser and server persistence may still be pending. Further Act 1 content remains unresolved."
          : rewardGap
            ? "This baseline cannot produce a refreshable three-choice offer without inventing rewards."
            : "This baseline will not invent the missing Act 1 enemy catalogue."}
      </p>
      {claim && <code>{claim.rewardId}</code>}
      <BuildSheet run={run} />
      <button type="button" onClick={onExit}>Return to Solitaire</button>
    </section>
  );
}

export function ReferenceCombatView({
  run,
  feedback,
  returnFocusSelector,
  onCommand,
  onRefresh,
  onClaim,
  onExit,
}) {
  const dialogRef = useRef(null);
  const restoreFocusRef = useRef(null);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement;
    dialogRef.current?.focus();
    return () => {
      const restoreTarget = restoreFocusRef.current;
      queueMicrotask(() => {
        if (restoreTarget?.isConnected && typeof restoreTarget.focus === "function") {
          restoreTarget.focus();
          return;
        }
        requestAnimationFrame(() => {
          const fallbackTarget = typeof returnFocusSelector === "string"
            ? document.querySelector(returnFocusSelector)
            : null;
          if (typeof fallbackTarget?.focus === "function") fallbackTarget.focus();
        });
      });
    };
  }, [returnFocusSelector]);

  useEffect(() => { dialogRef.current?.focus(); }, [run.phase]);

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
    <main
      ref={dialogRef}
      className="reference-combat"
      role="dialog"
      aria-modal="true"
      aria-label="Solitaire combat reference combat"
      tabIndex="-1"
      onKeyDown={keepFocusInside}
    >
      <div
        className="reference-combat__focus"
        role="status"
        aria-live="polite"
      >
        Reference trial view: {titleCase(run.phase)}
      </div>
      {feedback && (
        <div className="reference-combat__feedback" role="alert">
          {feedback}
        </div>
      )}
      {run.phase === "encounter" && <EncounterView run={run} onCommand={onCommand} onExit={onExit} />}
      {run.phase === "reward" && <RewardView run={run} onRefresh={onRefresh} onClaim={onClaim} onExit={onExit} />}
      {run.phase === "complete" && <CompleteView run={run} onExit={onExit} />}
      {run.phase === "content-gap" && <ContentGapView run={run} onExit={onExit} />}
    </main>
  );
}
