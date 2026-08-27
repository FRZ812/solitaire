import React, { useEffect, useMemo, useRef, useState } from "react";
import { getAbilityDef } from "../../data/abilities.js";
import { tierLabel } from "../../data/tiers.js";
import { abilityTaxonomy } from "../../data/ability-taxonomy.js";
import { cardUsable, isPlayerTurnLocked, playerResolveCost } from "../../engine/combat.js";
import { AbilityIcon } from "../AbilityIcon.jsx";
import { ItemIcon } from "../Icon.jsx";
import { CombatCard } from "./CombatCard.jsx";
import "./combat.css";

const TERMINAL = new Set(["victory", "defeat", "resolved", "playerFled"]);
const ATTRIBUTES = [
  ["body", "Body"], ["reflex", "Reflex"], ["vigor", "Vigor"],
  ["mind", "Mind"], ["wit", "Wit"], ["presence", "Presence"],
];

const STATUS_INFO = {
  bleed: "Takes physical damage at the start of its turn.",
  poison: "Takes damage at the start of its turn and cannot rely on regeneration.",
  burn: "Takes fire damage at the start of its turn.",
  lingering: "Deferred damage that arrives over the next turns.",
  vulnerable: "Takes increased damage from every source.",
  curse: "Takes increased damage and receives less healing.",
  weaken: "Deals less outgoing damage.",
  rally: "Deals increased outgoing damage.",
  focus: "Gains critical chance on the next attack.",
  stun: "Loses the next covered turn.",
  slow: "Cannot gain swift extra actions and acts later.",
  silence: "Cannot use learned abilities.",
  chill: "Fights with impaired accuracy.",
  charmed: "Stands down while the charm holds.",
  dominated: "Its will and allegiance have been seized.",
  enthralled: "Its body is bound to another will.",
  guard: "Temporarily adds physical mitigation.",
  regen: "Recovers health at the start of its turn.",
  unstoppable: "Ignores debuffs and damage while active.",
};

const EFFECT_LABELS = {
  bonusAction: "Bonus action", magicShield: "Magic shield", shield: "Shield",
  invuln: "Invulnerable", unstoppable: "Unstoppable", regen: "Regeneration",
  rally: "Rally", focus: "Focus", weaken: "Weaken", vulnerable: "Vulnerable",
  curse: "Curse", bleed: "Bleed", poison: "Poison", burn: "Burn", chill: "Chill",
  stun: "Stun", slow: "Slow", silence: "Silence", drain: "Drain", block: "Block",
  charmed: "Charm", dominated: "Domination", dispel: "Dispel",
};

const PILE_COPY = {
  deck: {
    label: "Full deck",
    shortLabel: "Deck",
    description: "Every card in this encounter, grouped by ability and tier.",
  },
  draw: {
    label: "Not yet drawn",
    shortLabel: "Draw",
    description: "Cards still available to draw. Contents are grouped; draw order remains unknown.",
  },
  discard: {
    label: "Discard pile",
    shortLabel: "Discard",
    description: "Played and unretained cards waiting for the next shuffle.",
  },
  exhaust: {
    label: "Exhaust pile",
    shortLabel: "Exhaust",
    description: "Cards removed until this encounter ends.",
  },
};

function pct(value, max) {
  return `${Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))}%`;
}

function titleCase(value) {
  return String(value || "Unknown").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function Meter({ label, value, max, tone = "health", compact = false }) {
  const safeValue = Math.max(0, Math.ceil(value || 0));
  const safeMax = Math.max(1, Math.ceil(max || 0));
  return (
    <div className={`combat-meter combat-meter--${tone}${compact ? " is-compact" : ""}`}>
      <span className="combat-meter__label"><span>{label}</span><b>{safeValue}/{safeMax}</b></span>
      <span
        className="combat-meter__track"
        role="meter"
        aria-label={label}
        aria-valuemin="0"
        aria-valuemax={safeMax}
        aria-valuenow={safeValue}
      >
        <span style={{ width: pct(safeValue, safeMax) }} />
      </span>
    </div>
  );
}

function Statuses({ statuses, detailed = false }) {
  if (!statuses?.length) return detailed ? <p className="combat-empty-copy">No active conditions.</p> : null;
  if (detailed) {
    return (
      <div className="combat-status-list">
        {statuses.map((status, index) => (
          <article key={`${status.type}-${index}`} className="combat-status-detail">
            <div><strong>{titleCase(status.type)}</strong><span>{status.duration || 1} turn{status.duration === 1 ? "" : "s"}</span></div>
            <p>{STATUS_INFO[status.type] || "A live combat condition."}{status.value ? ` Magnitude ${status.value}${status.pctMax ? "% max" : ""}.` : ""}</p>
          </article>
        ))}
      </div>
    );
  }
  return (
    <div className="combat-statuses" aria-label="Active conditions">
      {statuses.map((status, index) => (
        <span className="combat-status" key={`${status.type}-${index}`} title={STATUS_INFO[status.type]}>
          {titleCase(status.type)}{status.value ? ` ${status.value}` : ""}{status.duration > 1 ? ` · ${status.duration}t` : ""}
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
  }
  if (intent.effect?.type) {
    const effect = intent.effect;
    const label = EFFECT_LABELS[effect.type] || titleCase(effect.type);
    const value = effect.value == null ? "" : effect.pctMax
      ? ` ${Math.round(effect.value * 100)}% max`
      : ` ${effect.value}`;
    const duration = effect.duration ? ` · ${effect.duration}t` : "";
    detail += ` · ${label}${value}${duration}`;
  } else if (intent.status) {
    detail += ` · ${EFFECT_LABELS[intent.status] || titleCase(intent.status)}`;
  }
  return `Intent · ${detail}`;
}

function IntentBadge({ intent, enemy, targetNames }) {
  return (
    <span className={`combat-intent combat-intent--${intent?.kind || "unknown"}`}>
      <span className="combat-intent__kind" aria-hidden="true">
        {intent?.kind === "attack" ? "!" : intent?.kind === "defend" ? "+" : intent?.kind === "debuff" ? "−" : "•"}
      </span>
      <span>{intentLine(intent, enemy, targetNames.get(intent?.targetUid))}</span>
    </span>
  );
}

function EnemyCard({ enemy, selected, onSelect, onInspect, targetNames }) {
  const inactive = enemy._dead || enemy.resolved === "fled" || enemy.resolved === "ko";
  const intents = enemy.intents?.length ? enemy.intents : (enemy.intent ? [enemy.intent] : []);
  const domId = String(enemy.uid || enemy.id).replace(/[^a-zA-Z0-9_-]/g, "-");
  const labelId = `combat-enemy-${domId}-inspect`;
  const summaryId = `combat-enemy-${domId}-summary`;
  const spokenSummary = [
    `Vitality ${Math.max(0, enemy.health || 0)} of ${Math.max(1, enemy.maxHealth || 0)}`,
    `Armor ${enemy.armor || 0}`, `Ward ${enemy.ward || 0}`,
    (enemy.block || 0) > 0 ? `Block ${enemy.block}` : "",
    ...intents.map((intent) => intentLine(intent, enemy, targetNames.get(intent?.targetUid))),
    ...(enemy.statuses || []).map((status) => `${titleCase(status.type)} ${status.value || ""} for ${status.duration || 1} turn${status.duration === 1 ? "" : "s"}`),
  ].filter(Boolean).join(". ");
  return (
    <article className={`combat-enemy${selected ? " is-selected" : ""}${inactive ? " is-inactive" : ""}`}>
      <button
        type="button"
        className="combat-enemy__inspect"
        onClick={() => onInspect(enemy.uid)}
        aria-haspopup="dialog"
        aria-labelledby={labelId}
        aria-describedby={summaryId}
      >
        <span id={labelId} className="combat-sr-only">Inspect {enemy.name}</span>
        <span id={summaryId} className="combat-sr-only">{spokenSummary}</span>
        <span className="combat-unit__top">
          <strong className="combat-unit__name">{enemy.name}</strong>
          <span className="combat-unit__tier">{tierLabel(enemy.tier)}</span>
        </span>
        <Meter label="Vitality" value={enemy.health} max={enemy.maxHealth} tone="enemy" compact />
        <span className="combat-unit__meta">
          <span>{enemy.armor ? `Armor ${enemy.armor}` : "No armor"}</span>
          <span>{enemy.ward ? `Ward ${enemy.ward}` : "No ward"}</span>
          {(enemy.block || 0) > 0 && <span>Block {enemy.block}</span>}
        </span>
        {enemy.resolved === "yielded" ? (
          <span className="combat-intent">Yielded · at your mercy</span>
        ) : intents.length > 0 ? intents.map((intent) => (
          <IntentBadge key={intent.id} intent={intent} enemy={enemy} targetNames={targetNames} />
        )) : (
          <IntentBadge intent={null} enemy={enemy} targetNames={targetNames} />
        )}
        <Statuses statuses={enemy.statuses} />
        <span className="combat-enemy__inspect-label">Open dossier</span>
      </button>
      <button
        type="button"
        className="combat-enemy__target"
        onClick={() => onSelect(enemy.uid)}
        disabled={inactive}
        aria-pressed={selected}
      >
        {selected ? "Targeted" : "Set target"}
      </button>
    </article>
  );
}

function AllyCard({ ally }) {
  const down = ally._dead || ally.resolved === "ko";
  return (
    <article className={`combat-ally${down ? " is-inactive" : ""}`}>
      <span className="combat-unit__top">
        <strong className="combat-unit__name">{ally.name}</strong>
        <span className="combat-unit__tier">{down ? "Down" : "Ally"}</span>
      </span>
      <Meter label="Vitality" value={ally.health} max={ally.maxHealth} tone="ally" compact />
      {(ally.block || 0) > 0 && <span className="combat-unit__meta">Block {ally.block}</span>}
      <Statuses statuses={ally.statuses} />
    </article>
  );
}

export function groupCombatCards(deck, pile) {
  const ids = pile === "deck" ? Object.keys(deck.cards) : [...(deck[pile] || [])];
  const groups = new Map();
  for (const uid of ids) {
    const card = deck.cards[uid];
    if (!card) continue;
    const key = `${card.abilityId}:${card.tier || "common"}`;
    const existing = groups.get(key);
    if (existing) existing.count += 1;
    else groups.set(key, { card, count: 1 });
  }
  return [...groups.values()].sort((a, b) => a.card.name.localeCompare(b.card.name) || a.card.tier.localeCompare(b.card.tier));
}

function Sheet({ title, eyebrow, onClose, children, wide = false }) {
  const headingId = `combat-sheet-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || typeof document === "undefined") return undefined;
    const previouslyFocused = document.activeElement;
    const focusable = () => [...dialog.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
    (dialog.querySelector("[data-sheet-close]") || dialog).focus();
    const trapFocus = (event) => {
      if (event.key !== "Tab") return;
      const controls = focusable();
      if (!controls.length) { event.preventDefault(); dialog.focus(); return; }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener("keydown", trapFocus);
    return () => {
      dialog.removeEventListener("keydown", trapFocus);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, []);
  return (
    <div className="combat-sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} tabIndex="-1" className={`combat-sheet${wide ? " combat-sheet--wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={headingId}>
        <header className="combat-sheet__header">
          <div><span>{eyebrow}</span><h2 id={headingId}>{title}</h2></div>
          <button type="button" data-sheet-close onClick={onClose} aria-label={`Close ${title}`}>Close</button>
        </header>
        <div className="combat-sheet__body custom-scroll">{children}</div>
      </section>
    </div>
  );
}

export function PileSheet({ deck, pile, onClose }) {
  const copy = PILE_COPY[pile];
  const groups = useMemo(() => groupCombatCards(deck, pile), [deck, pile]);
  return (
    <Sheet title={copy.label} eyebrow="Combat deck" onClose={onClose} wide>
      <p className="combat-sheet__intro">{copy.description}</p>
      {groups.length ? (
        <div className="combat-pile-list">
          {groups.map(({ card, count }) => {
            const ability = getAbilityDef(card.abilityId);
            const taxonomy = abilityTaxonomy(ability, card.tier);
            return (
              <article className="combat-pile-card" key={`${card.abilityId}-${card.tier}`}>
                <AbilityIcon ability={ability} tierId={card.tier} size="medium" />
                <div>
                  <strong>{card.name}</strong>
                  <span>{card.magicSchoolLabel || card.categoryLabel || taxonomy.magicSchool?.label || taxonomy.category.label} · {tierLabel(card.tier)} · {card.energyCost} energy</span>
                  <p>{card.statLine || card.description}</p>
                </div>
                <b className="combat-pile-card__count" aria-label={`${count} copies`}>×{count}</b>
              </article>
            );
          })}
        </div>
      ) : <p className="combat-empty-copy">This pile is empty.</p>}
    </Sheet>
  );
}

function DossierSection({ title, children }) {
  return <section className="combat-dossier__section"><h3>{title}</h3>{children}</section>;
}

export function EnemyDossier({ enemy, targetNames, onClose }) {
  const intents = enemy.intents?.length ? enemy.intents : (enemy.intent ? [enemy.intent] : []);
  const weapon = enemy.weapon || enemy.stowedWeapon;
  const gear = enemy.gear || [];
  const disposition = enemy._dead ? "Dead" : enemy.resolved ? titleCase(enemy.resolved) : enemy.fleeing ? "Fleeing" : "Fighting";
  const stats = [
    ["Armor", enemy.armor || 0], ["Ward", enemy.ward || 0], ["Dodge", `${Math.round(enemy.dodge || 0)}%`],
    ["Accuracy", enemy.accuracy || 0], ["Critical", `${Math.round(enemy.critChance || 0)}%`],
    ["Speed", enemy.speed || 0], ["Will", enemy.will || 0], ["Actions", enemy.actionsPerTurn || 1],
  ];
  return (
    <Sheet title={enemy.name} eyebrow={`${tierLabel(enemy.tier)} ${enemy.race || enemy.kind || "foe"}`} onClose={onClose}>
      <div className="combat-dossier__identity">
        <div className="combat-dossier__monogram" aria-hidden="true">{enemy.name.slice(0, 1)}</div>
        <div><strong>{titleCase(enemy.demeanor)} bearing</strong><span>{disposition} · {enemy.canTalk === false ? "Cannot be reasoned with" : "Can be reasoned with"}</span></div>
      </div>

      <div className="combat-dossier__meters">
        <Meter label="Vitality" value={enemy.health} max={enemy.maxHealth} tone="enemy" />
        <Meter label="Morale" value={enemy.morale} max={enemy.moraleMax} tone="morale" />
        {(enemy.resolveMax || 0) > 0 && <Meter label="Resolve" value={enemy.resolve} max={enemy.resolveMax} tone="resolve" />}
      </div>
      <div className="combat-resource-chips">
        <span>Block <b>{enemy.block || 0}</b></span><span>Physical shield <b>{enemy.shield || 0}</b></span><span>Magic shield <b>{enemy.magicShield || 0}</b></span>
      </div>

      <DossierSection title="Combat profile">
        <div className="combat-dossier__stats">{stats.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>
      </DossierSection>

      <DossierSection title="Attributes">
        <div className="combat-dossier__attributes">
          {ATTRIBUTES.map(([key, label]) => <div key={key}><span>{label}</span><b>{enemy.attrs?.[key] ?? 0}</b></div>)}
        </div>
      </DossierSection>

      <DossierSection title="Equipment">
        {weapon ? (
          <article className="combat-equipment-card">
            <ItemIcon item={{ ...weapon, kind: "weapon", combat: { weaponType: weapon.category } }} size={34} />
            <div><strong>{weapon.name || titleCase(weapon.category)}</strong>
              <span>{weapon.min}–{weapon.max} {weapon.type || "physical"} damage · penetration {weapon.pen || 0}</span>
              <p>{weapon.range ? `Range ${weapon.range}` : `Reach ${weapon.reach || 1}`}{weapon.paired ? " · Paired" : ""}{weapon.reload ? ` · Reload ${weapon.reload}` : ""}</p>
            </div>
          </article>
        ) : <p className="combat-empty-copy">Disarmed.</p>}
        <div className="combat-gear-list">
          {gear.length ? gear.map((item, index) => (
            <article key={`${item.id}-${index}`}>
              <ItemIcon item={item} itemId={item.id} size={30} />
              <div><strong>{item.name || titleCase(item.id)}</strong><span>{titleCase(item.kind)} · {tierLabel(item.tier)}</span>
                <p>{[item.armor ? `Armor ${item.armor}` : "", item.ward ? `Ward ${item.ward}` : "", item.dodge ? `Dodge ${item.dodge}` : ""].filter(Boolean).join(" · ") || "Equipped"}</p>
              </div>
            </article>
          )) : <p className="combat-empty-copy">Natural protection or no worn equipment.</p>}
        </div>
      </DossierSection>

      <DossierSection title="Known abilities">
        <div className="combat-ability-list">
          {(enemy.abilities || []).length ? enemy.abilities.map((entry) => {
            const ability = getAbilityDef(entry.id);
            return (
              <article key={entry.id}>
                <AbilityIcon ability={ability} tierId={entry.tier || enemy.tier} size="small" />
                <div><strong>{ability?.name || titleCase(entry.id)}</strong><span>{ability?.desc || "A combat technique."}</span></div>
              </article>
            );
          }) : <p className="combat-empty-copy">Relies on basic attacks.</p>}
        </div>
      </DossierSection>

      <DossierSection title="Queued intent">
        <div className="combat-dossier__intents">
          {intents.length ? intents.map((intent) => <IntentBadge key={intent.id} intent={intent} enemy={enemy} targetNames={targetNames} />) : <IntentBadge intent={null} enemy={enemy} targetNames={targetNames} />}
        </div>
      </DossierSection>

      <DossierSection title="Active conditions"><Statuses statuses={enemy.statuses} detailed /></DossierSection>
    </Sheet>
  );
}

function LogSheet({ log, onClose }) {
  return (
    <Sheet title="Battle chronicle" eyebrow="Encounter log" onClose={onClose} wide>
      <div className="combat-log-sheet" role="log" aria-label="Full combat log">
        {log.map((entry) => <p key={entry.id} className={`is-${entry.kind}`}>{entry.text}</p>)}
      </div>
    </Sheet>
  );
}

function ResultOverlay({ combat, onResolve }) {
  const continueRef = useRef(null);
  useEffect(() => { continueRef.current?.focus(); }, []);
  const title = combat.standoff ? "Standoff"
    : combat.phase === "victory" ? "Victory"
      : combat.phase === "resolved" ? "Stood Down"
        : combat.phase === "playerFled" ? "Escaped" : "Defeat";
  return (
    <div className="combat-result" role="dialog" aria-modal="true" aria-labelledby="combat-result-title" onKeyDown={(event) => { if (event.key === "Tab") { event.preventDefault(); continueRef.current?.focus(); } }}>
      <span>The encounter is settled</span>
      <h2 id="combat-result-title">{title}</h2>
      <p>Its wounds, spoils, and choices will follow you back into the world.</p>
      <button ref={continueRef} type="button" className="combat-action-button combat-action-button--end" onClick={onResolve}>Continue</button>
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
  const [overlay, setOverlay] = useState(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [combat.log.length]);
  useEffect(() => {
    if (!overlay) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") setOverlay(null); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [overlay]);

  const { player, deck } = combat;
  const over = TERMINAL.has(combat.phase);
  const turnLocked = isPlayerTurnLocked(combat);
  const playerTurn = combat.phase === "player" && !turnLocked;
  const targetNames = new Map([player, ...(combat.allies || [])].map((actor) => [actor.uid, actor.name]));
  const liveAttacker = combat.enemies.some((enemy) => enemy.health > 0 && !enemy.resolved && !enemy.fleeing && !enemy._dead);
  const brokenPresent = combat.enemies.some((enemy) => (enemy.resolved === "yielded" && !enemy._dead) || enemy.fleeing);
  const canStand = playerTurn && !liveAttacker && brokenPresent;
  const deckCount = Object.keys(deck.cards).length;
  const inspectedEnemy = overlay?.type === "enemy" ? combat.enemies.find((enemy) => enemy.uid === overlay.uid) : null;
  const phaseLabel = playerTurn ? "Your move" : turnLocked ? "Turn interrupted" : "Foes acting";
  const stageBlocked = !!overlay || over;

  return (
    <main className="deck-combat" aria-label="Card combat">
      <div className="combat-stage" aria-hidden={stageBlocked ? "true" : undefined} inert={stageBlocked ? "" : undefined}>
      <header className="combat-command-bar">
        <div className="combat-round-mark"><span>Round</span><b>{combat.round}</b></div>
        <div className="combat-command-bar__title">
          <span>{phaseLabel}</span>
          <strong>{combat.enemies.filter((enemy) => enemy.health > 0 && !enemy._dead).length} foe{combat.enemies.filter((enemy) => enemy.health > 0 && !enemy._dead).length === 1 ? "" : "s"} remain</strong>
        </div>
        <nav className="combat-pile-buttons" aria-label="Combat card piles">
          {[
            ["deck", deckCount], ["draw", deck.draw.length], ["discard", deck.discard.length], ["exhaust", deck.exhaust.length],
          ].map(([pile, count]) => (
            <button key={pile} type="button" onClick={() => setOverlay({ type: "pile", pile })} aria-label={`${PILE_COPY[pile].shortLabel} ${count} · ${PILE_COPY[pile].label}`}>
              <span>{PILE_COPY[pile].shortLabel}</span><b>{count}</b>
            </button>
          ))}
        </nav>
      </header>

      <section className={`combat-arena${combat.allies?.length ? " has-allies" : " is-solo"}`} aria-label="Battlefield">
        <div className="combat-arena__heading">
          <span>Opposition</span>
          <button type="button" className="combat-arena__log-button" onClick={() => setOverlay({ type: "log" })}>Battle log · {combat.log.length}</button>
        </div>
        <section className="combat-enemies" aria-label="Enemies and intents">
          {combat.enemies.map((enemy) => (
            <EnemyCard
              key={enemy.uid}
              enemy={enemy}
              selected={combat.targetUid === enemy.uid}
              onSelect={onSetTarget}
              onInspect={(uid) => setOverlay({ type: "enemy", uid })}
              targetNames={targetNames}
            />
          ))}
        </section>

        {combat.allies?.length > 0 && (
          <section className="combat-allies" aria-label="Allies">
            {combat.allies.map((ally) => <AllyCard key={ally.uid} ally={ally} />)}
          </section>
        )}

        <section className="combat-log-panel" aria-label="Recent combat events">
          <div className="combat-log-panel__head"><span>Recent actions</span><button type="button" onClick={() => setOverlay({ type: "log" })}>Full log · {combat.log.length}</button></div>
          <div ref={logRef} className="combat-log custom-scroll" role="log" aria-label="Recent combat log">
            {combat.log.slice(-6).map((entry) => <p key={entry.id} className={`is-${entry.kind}`}>{entry.text}</p>)}
          </div>
        </section>
      </section>

      <section className="combat-player" aria-label="Player combat state">
        <div className="combat-player__identity">
          <span className="combat-energy" title="Energy" aria-label={`Energy ${player.energy}/${player.maxEnergy}`}><b>{player.energy}</b><small>/{player.maxEnergy}</small></span>
          <div><strong className="combat-player__name">{player.name}</strong><span>{phaseLabel}</span></div>
        </div>
        <div className="combat-player__vitals">
          <Meter label="Vitality" value={player.health} max={player.maxHealth} tone="player" />
          <div className="combat-resource-chips">
            <span className={(player.block || 0) > 0 ? "is-active" : ""}>Block <b>{player.block || 0}</b></span>
            {(player.resolveMax || 0) > 0 && <span>Resolve <b>{player.resolve}/{player.resolveMax}</b></span>}
            {(player.shield || 0) > 0 && <span>Shield <b>{player.shield}</b></span>}
            {(player.magicShield || 0) > 0 && <span>Ward shield <b>{player.magicShield}</b></span>}
          </div>
          <Statuses statuses={player.statuses} />
        </div>
      </section>

      <section className="combat-hand-wrap" aria-label="Card hand">
        <div className="combat-hand-label">
          <span>Hand · {deck.hand.length}</span>
          <span>{playerTurn ? "Read the intent, then commit" : "Foes are resolving their intent"}</span>
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
      </div>

      {overlay?.type === "pile" && <PileSheet deck={deck} pile={overlay.pile} onClose={() => setOverlay(null)} />}
      {overlay?.type === "log" && <LogSheet log={combat.log} onClose={() => setOverlay(null)} />}
      {inspectedEnemy && <EnemyDossier enemy={inspectedEnemy} targetNames={targetNames} onClose={() => setOverlay(null)} />}
      {over && <ResultOverlay combat={combat} onResolve={onResolve} />}
    </main>
  );
}
