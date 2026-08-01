import React from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon.jsx";
import { colors, alert, shadow, radius, glass, fonts, metaStyle } from "./tokens.js";
import { condName, conditionMeta } from "../data/conditions.js";
import { visibilityStatus } from "../engine/light.js";
import {
  NARRATOR_MODELS, NARRATOR_EFFORTS, NARRATOR_SORT_OPTIONS,
  getNarratorModel, setNarratorModel,
  getNarratorEffort, setNarratorEffort,
  normalizeNarratorEffort,
  narratorEffortDisplayLabel,
  narratorModelLabel,
  narratorModelIntelligenceLabel,
  narratorModelIntelligenceSourceLabel,
  narratorModelPriceLabel,
  narratorModelPricingNote,
  sortNarratorModels,
} from "../engine/narrator-models.js";
import { formatTokenCount } from "./chatContextModel.js";
import { ChatContextPreview } from "./ChatContextPreview.jsx";
import { useModalFocus } from "./exploration/modalFocus.js";

// Short "time left" label for a timed condition (e.g. "2.5h", "12m").
export function fmtRemaining(minutes) {
  if (minutes == null) return "";
  return minutes >= 60 ? `${Math.round((minutes / 60) * 10) / 10}h` : `${Math.max(1, Math.round(minutes))}m`;
}

// ----- Buttons -----

// 36px circular glass button (menu sheet close, codex/map controls).
export const iconButtonStyle = {
  width: "36px", height: "36px",
  borderRadius: radius.pill,
  border: `1px solid rgba(215, 167, 111, 0.28)`,
  backgroundColor: "rgba(12, 42, 60, 0.56)",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", flexShrink: 0,
  boxShadow: `${shadow.subtle}, inset 0 1px 0 rgba(255,255,255,0.05)`,
  transition: "background-color 0.2s, border-color 0.2s, transform 0.1s",
};

// 44px rounded-square glass button (top header: map / codex / menu).
export const headerButtonStyle = {
  width: "44px", height: "44px",
  borderRadius: radius.panelCompact,
  border: `1px solid rgba(215, 167, 111, 0.28)`,
  backgroundColor: "rgba(12, 42, 60, 0.56)",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", flexShrink: 0,
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  boxShadow: `${shadow.subtle}, inset 0 1px 0 rgba(255, 255, 255, 0.05)`,
  transition: "background-color 0.2s, border-color 0.2s, transform 0.1s",
};

// ----- Panels -----

// Inset gold-tinted container reused for Wealth / Wearing / Carrying / item cards.
export const insetBoxStyle = {
  background: "rgba(215, 167, 111, 0.03)",
  border: `1px solid rgba(215, 167, 111, 0.08)`,
  borderRadius: radius.chip,
  padding: "8px 12px",
};

// Pill/standard action button at the foot of sheets and in the item detail modal.
export function actionButtonStyle({ danger = false, ghost = false } = {}) {
  if (ghost) {
    return {
      display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
      padding: "12px",
      border: "none", borderRadius: radius.panelCompact,
      backgroundColor: "transparent",
      color: "rgba(215, 167, 111, 0.6)",
      fontSize: "12px", fontWeight: 700,
      cursor: "pointer", fontFamily: "inherit",
    };
  }
  if (danger) {
    return {
      display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
      padding: "13px",
      border: `1px solid rgba(239, 68, 68, 0.35)`,
      borderRadius: radius.panelCompact,
      backgroundColor: "rgba(239, 68, 68, 0.08)",
      color: alert.dangerAccent,
      fontSize: "13px", fontWeight: 700,
      cursor: "pointer", fontFamily: "inherit",
    };
  }
  return {
    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
    padding: "13px",
    border: `1px solid rgba(215, 167, 111, 0.25)`,
    borderRadius: radius.panelCompact,
    backgroundColor: "rgba(215, 167, 111, 0.08)",
    color: colors.parchmentLight,
    fontSize: "13px", fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit",
  };
}

const panelShell = {
  marginBottom: "12px",
  boxShadow: shadow.panel,
  ...glass,
};

const panelTones = {
  default: {
    backgroundColor: "rgba(10, 38, 56, 0.65)",
    color: colors.parchment,
    border: "1px solid rgba(215, 167, 111, 0.15)",
  },
  warm: {
    backgroundColor: "rgba(71, 51, 38, 0.58)",
    color: colors.parchment,
    border: "1px solid rgba(215, 167, 111, 0.25)",
  },
  pale: {
    backgroundColor: "rgba(21, 48, 64, 0.7)",
    color: colors.parchmentLight,
    border: "1px solid rgba(215, 167, 111, 0.20)",
  },
  dark: {
    backgroundColor: "rgba(8, 29, 46, 0.76)",
    color: colors.parchment,
    border: "1px solid rgba(215, 167, 111, 0.22)",
  },
  encounter: {
    backgroundColor: "rgba(35, 15, 15, 0.72)",
    color: alert.dangerAccent,
    border: "1px solid rgba(239, 68, 68, 0.35)",
    boxShadow: `inset 0 0 10px rgba(239, 68, 68, 0.1), ${shadow.cardDeep}`,
  },
  discovery: {
    backgroundColor: "rgba(15, 35, 25, 0.72)",
    color: alert.successText,
    border: "1px solid rgba(52, 211, 153, 0.35)",
    boxShadow: `inset 0 0 10px rgba(52, 211, 153, 0.1), ${shadow.cardDeep}`,
  },
};

// Glass panel used for narration, dialogue, encounters, etc. Tones cover
// the standard game palette plus encounter/discovery accents.
export function Panel({ children, tone = "default", compact = false, className = "", style }) {
  return (
    <div className={`game-panel game-panel--${tone} fade-in ${className}`.trim()} style={{
      ...panelShell,
      ...(panelTones[tone] || panelTones.default),
      borderRadius: compact ? radius.panelCompact : radius.panel,
      padding: compact ? "10px 12px" : "14px 16px",
      ...style,
    }}>
      {children}
    </div>
  );
}

// "◆ Label" section header used throughout MenuSheet.
export function SectionHeader({ children, color = colors.gold, className = "" }) {
  return (
    <div className={`section-header ${className}`.trim()} style={{
      ...metaStyle,
      fontSize: "10px",
      letterSpacing: "0.14em",
      color,
      marginBottom: "8px",
      display: "flex", alignItems: "center", gap: "6px",
    }}>
      <span style={{ color, opacity: 0.6 }}>◆</span>
      {children}
    </div>
  );
}

// Unified error/danger banner. Replaces the bespoke error boxes each
// screen invented during the polish pass.
export function ErrorBanner({ children, style }) {
  return (
    <div style={{
      margin: "8px 0 12px",
      padding: "11px 13px",
      borderRadius: radius.panelCompact,
      backgroundColor: alert.dangerBg,
      border: `1px solid ${alert.dangerBorder}`,
      color: alert.dangerText,
      fontSize: "12px", lineHeight: 1.4,
      boxShadow: shadow.cardDeep,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ----- Vitals strip -----

export function Vital({ icon, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <div style={{ display: "flex", filter: "drop-shadow(0 0 4px rgba(215,167,111,0.25))" }}>
        {icon}
      </div>
      <span style={{ color: "rgba(237,228,208,0.54)", textTransform: "uppercase", fontSize: "9px", letterSpacing: "0.14em", fontWeight: 700 }}>{label}</span>
      <span style={{ fontWeight: 800, color: colors.parchment, textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>{value}</span>
    </div>
  );
}

// Polarity-driven palette: buffs read green, debuffs red, anything else gold.
export function conditionPalette(polarity) {
  if (polarity === "buff") return { color: alert.successText, border: "rgba(16, 185, 129, 0.34)", bg: "rgba(16, 185, 129, 0.10)", glow: "rgba(16, 185, 129, 0.2)" };
  if (polarity === "debuff") return { color: alert.dangerAccent, border: "rgba(252, 165, 165, 0.34)", bg: "rgba(120, 30, 30, 0.16)", glow: "rgba(252, 165, 165, 0.18)" };
  return { color: colors.gold, border: "rgba(215, 167, 111, 0.24)", bg: "rgba(215, 167, 111, 0.07)", glow: "rgba(215, 167, 111, 0.2)" };
}

export function ConditionPill({ cond }) {
  const name = condName(cond);
  const remaining = typeof cond === "object" && cond ? cond.remaining : null;
  const pal = conditionPalette(conditionMeta(name).polarity);
  return (
    <div style={{
      padding: "4px 9px",
      borderRadius: radius.pill,
      backgroundColor: pal.bg,
      border: `1px solid ${pal.border}`,
      color: pal.color,
      ...metaStyle,
      letterSpacing: "0.12em",
      textShadow: `0 0 6px ${pal.glow}`,
      boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
    }}>
      {name}{remaining != null ? ` · ${fmtRemaining(remaining)}` : ""}
    </div>
  );
}

export function VitalsStrip({ state, onExtinguish }) {
  const character = state.character;
  const needs = character.needs || { hunger: 100, thirst: 100, sleep: 100 };
  const vitMax = character.vitalityMax || 1;
  const resMax = character.resolveMax || 1;
  const visibility = visibilityStatus(state);
  return (
    <section className="vitals-strip" aria-label="Travel status">
      <div className="vitals-strip__main">
        <button
          type="button"
          className={`visibility-status visibility-status--${visibility.obscurity}`}
          onClick={visibility.canExtinguish ? onExtinguish : undefined}
          disabled={!visibility.canExtinguish}
          title={visibility.canExtinguish ? `${visibility.detail}. Tap to extinguish.` : visibility.detail}
          aria-label={`${visibility.label}. ${visibility.detail}${visibility.canExtinguish ? ". Tap to extinguish." : ""}`}
        >
          <span className="visibility-status__medallion" aria-hidden="true">
            <Icon name={visibility.icon} size={31} />
          </span>
          <span className="visibility-status__copy">
            <small>Obscurity</small>
            <strong>{visibility.label}</strong>
            <em>{visibility.detail}</em>
          </span>
        </button>

        <div className="vitals-strip__meters">
        <RadialMeter
          className="radial-meter--vitality"
          iconName="heart" iconFill={colors.gold}
          value={character.vitality} max={vitMax}
          label={`${Math.round(character.vitality)}/${vitMax}`}
          ariaLabel={`Vitality ${Math.round(character.vitality)} of ${vitMax}`}
        />
        <RadialMeter
          iconName="flame"
          value={character.resolve} max={resMax}
          label={`${character.resolve}/${resMax}`}
          ariaLabel={`Resolve ${character.resolve} of ${resMax}`}
        />
        <RadialMeter
          iconName="hunger"
          value={needs.hunger} max={100}
          label={Math.round(needs.hunger)}
          ariaLabel={`Hunger ${Math.round(needs.hunger)} of 100`}
        />
        <RadialMeter
          iconName="droplet"
          value={needs.thirst} max={100}
          label={Math.round(needs.thirst)}
          ariaLabel={`Thirst ${Math.round(needs.thirst)} of 100`}
        />
        <RadialMeter
          iconName="moon"
          value={needs.sleep} max={100}
          label={Math.round(needs.sleep)}
          ariaLabel={`Sleep ${Math.round(needs.sleep)} of 100`}
        />
        </div>
      </div>

      {character.conditions.length > 0 && (
        <div className="vitals-strip__conditions">
          {character.conditions.map((c) => <ConditionPill key={condName(c)} cond={c} />)}
        </div>
      )}
    </section>
  );
}

// Circular pool/needs meter: a faint background ring, a coloured arc whose
// length is value/max, and the icon centred. Numeric value below in tiny
// uppercase. Colour follows the engine's need-threshold convention so all
// five gauges read consistently:
//   ≤10% → red    (Starving / Parched / Exhausted / near-death vitality)
//   ≤30% → amber  (Hungry / Thirsty / Tired / wounded vitality)
//   else → gold
function RadialMeter({ className = "", iconName, iconFill, value, max, label, ariaLabel }) {
  const v = Number.isFinite(value) ? value : 0;
  const m = Math.max(1, max);
  const pct = Math.max(0, Math.min(100, (v / m) * 100));
  const color =
    pct <= 10 ? "#fca5a5" :
    pct <= 30 ? "#f5b97a" :
    colors.gold;

  // A compact instrument dial with enough interior space for unmistakable
  // silhouettes (especially hunger's bread loaf) at phone scale.
  const SIZE = 36;
  const R = 15;
  const C = 2 * Math.PI * R;
  const dashOffset = C * (1 - pct / 100);

  return (
    <div
      className={`radial-meter ${className}`}
      title={ariaLabel}
      role="meter"
      aria-label={ariaLabel}
      aria-valuemin="0"
      aria-valuemax={m}
      aria-valuenow={v}
    >
      <div className="radial-meter__dial" style={{ width: SIZE, height: SIZE }}>
        <svg
          className="radial-meter__ring"
          width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ transform: "rotate(-90deg)", display: "block" }}
        >
          {/* faint background ring */}
          <circle cx={SIZE/2} cy={SIZE/2} r={R}
                  fill="none" stroke="rgba(215, 167, 111, 0.12)" strokeWidth="2" />
          {/* progress arc */}
          <circle cx={SIZE/2} cy={SIZE/2} r={R}
                  fill="none" stroke={color} strokeWidth="2.35" strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={dashOffset}
                  style={{
                    transition: "stroke-dashoffset 0.4s cubic-bezier(0.16,1,0.3,1), stroke 0.2s",
                    filter: `drop-shadow(0 0 3px ${color}66)`,
                  }} />
        </svg>
        <div className="radial-meter__icon">
          <Icon name={iconName} size={21} color={color} fill={iconFill || "none"} strokeWidth={1.75} />
        </div>
      </div>
      <span className="radial-meter__value" style={{ color }}>{label}</span>
    </div>
  );
}

// ----- Loading / live thinking -----

export function LoadingDots() {
  return (
    <div className="loading-dots" style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 2px", opacity: 0.78 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          width: "6px", height: "6px", borderRadius: "50%",
          backgroundColor: "var(--scene-highlight, #d7a76f)",
          animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

export function LiveThinking({ thinking }) {
  return (
    <div style={{ marginBottom: "12px", paddingLeft: "2px" }}>
      <LoadingDots />
      {thinking && (
        <details style={{ marginTop: "2px" }} open>
          <summary style={{
            ...metaStyle,
            letterSpacing: "0.18em",
            color: "rgba(215, 167, 111, 0.64)",
            cursor: "pointer", userSelect: "none",
          }}>
            Thinking
          </summary>
          <div style={{
            marginTop: "4px",
            fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
            color: "rgba(215, 167, 111, 0.58)",
          }}>
            {narratorModelLabel(getNarratorModel())}
          </div>
          <div style={{
            marginTop: "6px",
            padding: "12px 14px",
            backgroundColor: "rgba(8, 31, 48, 0.66)",
            border: `1px solid rgba(215, 167, 111, 0.14)`,
            borderRadius: radius.panelCompact,
            fontSize: "12px", lineHeight: "1.52",
            color: "rgba(237, 228, 208, 0.85)",
            whiteSpace: "pre-wrap",
            backdropFilter: "blur(10px)",
            boxShadow: "inset 0 10px 24px rgba(4,18,31,0.26)",
          }}>
            {thinking}
          </div>
        </details>
      )}
    </div>
  );
}

// ----- Input bar -----

export function NarratorPickerPanel({
  model,
  effort,
  query,
  sort = "recommended",
  onQueryChange,
  onSortChange = () => {},
  onChooseModel,
  onChooseEffort,
  onClose,
}) {
  const dialogRef = useModalFocus(onClose);
  const active = NARRATOR_MODELS.find((entry) => entry.id === model) || NARRATOR_MODELS[0];
  const effortDisplay = narratorEffortDisplayLabel(active.id, effort);
  const effortIndex = Math.max(0, NARRATOR_EFFORTS.findIndex((entry) => entry.id === effort));
  const normalizedQuery = query.trim().toLowerCase();
  const visibleModels = sortNarratorModels(
    NARRATOR_MODELS.filter((entry) => (
      !normalizedQuery
      || `${entry.label} ${entry.note || ""} ${entry.provider || ""} ${narratorModelIntelligenceLabel(entry)}`.toLowerCase().includes(normalizedQuery)
    )),
    sort,
  );

  const panel = (
    <div className="narrator-picker__overlay">
      <div className="narrator-picker__backdrop" onClick={onClose} aria-hidden="true" />
      <section
        ref={dialogRef}
        className="narrator-picker__sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Choose narrator model"
        aria-description="OpenRouter prices are input and output per million tokens. Intelligence uses the Artificial Analysis Intelligence Index where published. Thinking effort is under collapsed advanced settings."
        tabIndex={-1}
      >
        <header className="narrator-picker__header">
          <div>
            <span>Storyteller</span>
            <h2>Narrator model</h2>
            <p>OpenRouter prices are input / output per 1M tokens; long-context rates are shown inline.</p>
          </div>
          <button
            type="button"
            className="narrator-picker__close"
            onClick={onClose}
            aria-label="Close narrator picker"
            data-modal-autofocus
          >
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="narrator-picker__toolbar">
          <label className="narrator-picker__search">
            <Icon name="zoomOut" size={16} />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search models…"
              aria-label="Search narrator models"
            />
          </label>
          <label className="narrator-picker__sort">
            <span>Sort by</span>
            <select value={sort} onChange={(event) => onSortChange(event.target.value)} aria-label="Sort narrator models">
              {NARRATOR_SORT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            <i aria-hidden="true">⌄</i>
          </label>
        </div>

        <div className="narrator-picker__columns" aria-hidden="true">
          <span className="narrator-picker__column narrator-picker__column--model">MODEL</span>
          <span className="narrator-picker__column narrator-picker__column--price">PRICE <small>INPUT / OUTPUT · $ / 1M</small></span>
          <span className="narrator-picker__column narrator-picker__column--intelligence">INTELLIGENCE <small>AA INDEX</small></span>
        </div>
        <div className="narrator-picker__options">
          {visibleModels.map((entry) => {
            const selected = entry.id === model;
            const price = narratorModelPriceLabel(entry);
            const pricingNote = narratorModelPricingNote(entry);
            const freePrimary = entry.price?.input === 0 && entry.price?.output === 0;
            const fallbackPrice = entry.fallbackPrice
              ? narratorModelPriceLabel({ price: entry.fallbackPrice })
              : null;
            const fallbackPricingNote = entry.fallbackPrice
              ? narratorModelPricingNote({ price: entry.fallbackPrice })
              : null;
            const visiblePricingNotes = [
              fallbackPrice ? `${fallbackPrice} fallback` : null,
              ...(entry.price?.overrides || []).map((override) => (
                `${Math.round(override.minInputTokens / 1000)}K+ ${narratorModelPriceLabel({ price: override })}`
              )),
            ].filter(Boolean);
            const accessiblePricing = fallbackPrice
              ? `Free primary: ${pricingNote}; paid fallback ${fallbackPrice}: ${fallbackPricingNote}`
              : `${price} per million tokens; ${pricingNote}`;
            const intelligence = narratorModelIntelligenceLabel(entry);
            const intelligenceRated = Number.isFinite(entry.intelligence);
            const intelligenceGuided = !intelligenceRated && !!entry.intelligenceGuidance;
            const intelligenceSource = narratorModelIntelligenceSourceLabel(entry);
            return (
              <button
                type="button"
                className={`narrator-picker__option${selected ? " is-active" : ""}`}
                key={entry.id}
                onClick={() => onChooseModel(entry.id)}
                aria-pressed={selected}
                aria-label={`${entry.label}. ${accessiblePricing}. ${intelligenceRated ? `${intelligence} Artificial Analysis Intelligence Index` : intelligenceGuided ? `${intelligence} product guidance; no Artificial Analysis score is published` : "No Artificial Analysis Intelligence Index"}.`}
              >
                <span className="narrator-picker__option-copy">
                  <strong>{entry.label}</strong>
                  {selected && <small>Selected</small>}
                </span>
                <span className="narrator-picker__price">
                  <strong>{freePrimary ? "Free primary" : price}</strong>
                  {!!visiblePricingNotes.length && <small>{visiblePricingNotes.join(" · ")}</small>}
                </span>
                <span className={`narrator-picker__intelligence ${intelligenceRated ? "is-rated" : intelligenceGuided ? "is-guided" : "is-unrated"}`}>
                  <strong>{intelligence}</strong>
                  <small>{intelligenceSource}</small>
                </span>
              </button>
            );
          })}
          {!visibleModels.length && <div className="narrator-picker__empty">No narrator models match that search.</div>}
        </div>

        <details className="narrator-picker__effort-panel">
          <summary>
            <span>
              <strong>Advanced settings</strong>
              <small>Thinking effort for {active.label}</small>
            </span>
            <b>{effortDisplay}</b>
          </summary>
          <div className="narrator-picker__effort-content">
            <div
              className="narrator-picker__effort-control"
              style={{ "--effort-progress": `${(effortIndex / (NARRATOR_EFFORTS.length - 1)) * 100}%` }}
            >
              <input
                className="narrator-picker__effort-slider"
                type="range"
                min="0"
                max={NARRATOR_EFFORTS.length - 1}
                step="1"
                value={effortIndex}
                onChange={(event) => onChooseEffort(NARRATOR_EFFORTS[Number(event.target.value)].id)}
                aria-label={`Thinking effort for ${active.label}`}
                aria-valuetext={effortDisplay}
              />
              <div className="narrator-picker__effort-ticks" aria-hidden="true">
                {NARRATOR_EFFORTS.map((effortEntry, index) => (
                  <span
                    key={effortEntry.id}
                    className={effortEntry.id === effort ? "is-active" : ""}
                    style={{ left: `${(index / (NARRATOR_EFFORTS.length - 1)) * 100}%` }}
                  >
                    <i />
                    {effortEntry.label}
                  </span>
                ))}
              </div>
            </div>
            <p>Unsupported tiers use the nearest available effort; token-budget models translate the same scale proportionally.</p>
          </div>
        </details>
      </section>
    </div>
  );
  if (typeof document === "undefined") return panel;
  return createPortal(panel, document.body);
}

// The narrator switch beside the composer persists the model and effort used
// by the next turn. The panel mounts only while open so modal focus capture and
// exact opener restoration remain reliable.
function NarratorPicker() {
  const [open, setOpen] = React.useState(false);
  const [model, setModel] = React.useState(getNarratorModel);
  const [effort, setEffort] = React.useState(() => getNarratorEffort(model));
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState("recommended");
  const active = NARRATOR_MODELS.find((entry) => entry.id === model) || NARRATOR_MODELS[0];

  function chooseModel(id) {
    const nextEffort = normalizeNarratorEffort(id, effort);
    setNarratorModel(id);
    setModel(id);
    setNarratorEffort(nextEffort);
    setEffort(nextEffort);
  }

  function chooseEffort(id) {
    setNarratorEffort(id);
    setEffort(id);
  }

  const effortLabel = ` · ${narratorEffortDisplayLabel(active.id, effort)}`;
  const compactLabel = active.label
    .replace("DeepSeek", "DS")
    .replace("Gemini", "Gem")
    .replace("GPT-", "GPT ")
    .split(" ")
    .slice(0, 2)
    .join(" ");

  return (
    <div className={`narrator-picker${open ? " is-open" : ""}`}>
      {open && (
        <NarratorPickerPanel
          model={model}
          effort={effort}
          query={query}
          sort={sort}
          onQueryChange={setQuery}
          onSortChange={setSort}
          onChooseModel={chooseModel}
          onChooseEffort={chooseEffort}
          onClose={() => setOpen(false)}
        />
      )}
      <button
        type="button"
        className="narrator-picker__trigger"
        onClick={() => setOpen((value) => !value)}
        title={`Narrator: ${active.label}${effortLabel}`}
        aria-label={`Narrator: ${active.label}${effortLabel}. Tap to change model or thinking effort.`}
      >
        <Icon name="sparkle" size={16} color={colors.gold} strokeWidth={1.8} />
        <span><small>Narrator</small><strong>{compactLabel}</strong></span>
      </button>
    </div>
  );
}

export function InputBar({
  value, onChange, onSubmit, onRun, queuedCount = 0, loading,
  advancementCount = 0, advancementNeedsChoice = false, onOpenProgression,
  contextPreview = null, contextOpen = false, activeModel = "", onToggleContext,
}) {
  const hasDraft = Boolean(value.trim());
  const actionLabel = hasDraft
    ? "Queue message"
    : queuedCount
      ? `Run narrator with ${queuedCount} queued message${queuedCount === 1 ? "" : "s"}`
      : "Continue story without a new action";
  const actionTitle = hasDraft
    ? "Queue message"
    : queuedCount
      ? `Play ${queuedCount} queued message${queuedCount === 1 ? "" : "s"}`
      : "Continue story";
  const ref = React.useRef(null);
  const [focused, setFocused] = React.useState(false);
  // Grow the field with its content (up to a cap, then it scrolls), so a longer
  // action is easy to write and read back before sending.
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);
  const showAdvancement = Boolean(onOpenProgression && (advancementCount > 0 || advancementNeedsChoice));
  const advancementLabel = advancementNeedsChoice
    ? "Finish advancement"
    : `${advancementCount} advancement${advancementCount === 1 ? "" : "s"} ready`;
  return (
    <div className={`story-input${focused ? " is-focused" : ""}${value.trim() ? " has-value" : ""}${queuedCount ? " has-queued" : ""}${loading ? " is-sending" : ""}`} style={{
      padding: "10px 12px calc(env(safe-area-inset-bottom, 0px) + 12px) 12px",
      background: "linear-gradient(180deg, rgba(7,25,40,0) 0%, rgba(7,25,40,0.48) 20%, rgba(7,25,40,0.84) 100%)",
      display: "block",
    }}>
      {showAdvancement && (
        <button
          type="button"
          className="story-input__advancement"
          onClick={onOpenProgression}
          aria-label={`${advancementLabel}. Open Progression.`}
        >
          <Icon name="progression" size={25} />
          <span><strong>{advancementLabel}</strong><small>Open Progression</small></span>
          {advancementCount > 0 && <b aria-hidden="true">{advancementCount}</b>}
        </button>
      )}
      <div
        className={`story-input__surface${contextOpen ? " is-context-open" : ""}`}
        onKeyDown={(event) => {
          if (contextOpen && event.key === "Escape" && onToggleContext) {
            event.stopPropagation();
            onToggleContext();
          }
        }}
      >
        {onToggleContext && contextPreview && (
          <button
            type="button"
            className="story-input__context"
            onClick={onToggleContext}
            aria-label={`${contextOpen ? "Collapse" : "Expand"} context preview. ${formatTokenCount(contextPreview.total)} estimated tokens`}
            aria-expanded={contextOpen}
            aria-controls="chat-context-inspector"
          >
            <span className="story-input__context-dot" aria-hidden="true" />
            <span><strong>{formatTokenCount(contextPreview.total)} tokens</strong><small>Next turn context</small></span>
            <span className="story-input__context-arrow" aria-hidden="true"><Icon name="arrowUp" size={13} /></span>
          </button>
        )}
        {contextOpen && contextPreview && (
          <ChatContextPreview preview={contextPreview} activeModel={activeModel} />
        )}
        <div className="story-input__composer">
          <NarratorPicker />
          <div className="story-input__bubble">
            <textarea
              className="story-input__field"
              ref={ref}
              rows={1}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              // Enter adds a new line; ⌘/Ctrl+Enter queues this message without
              // starting the narrator. With an empty draft, the same control plays.
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (!loading && hasDraft) onSubmit(); } }}
              placeholder={loading ? "The narrator is answering…" : "Queue what you do…"}
              disabled={loading}
              style={{
                flex: 1, minHeight: "46px", maxHeight: "160px",
                boxSizing: "border-box", resize: "none", overflowY: "auto",
                padding: "12px 10px 11px", fontSize: "15px", lineHeight: 1.4, color: colors.parchment,
                outline: "none", fontFamily: "inherit",
              }}
            />
            <span className="story-input__hint">Ctrl ↵ to queue</span>
          </div>
          <button
            type="button"
            className={`story-input__action${hasDraft ? " is-send" : " is-play"}`}
            onClick={hasDraft ? onSubmit : onRun}
            disabled={loading}
            aria-label={actionLabel}
            title={actionTitle}
          >
            {loading ? (
              <span className="story-input__sending" aria-hidden="true"><i /><i /><i /></span>
            ) : (
              <>
                <Icon name={hasDraft ? "send" : "play"} size={21} />
                {!hasDraft && queuedCount > 0 && <span className="story-input__queued-count" aria-hidden="true">{queuedCount}</span>}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ----- Character sheet blocks -----

export function StatBlock({ label, value }) {
  return (
    <div style={{
      padding: "10px 14px",
      backgroundColor: "rgba(20, 29, 29, 0.42)",
      border: `1px solid rgba(215, 167, 111, 0.16)`,
      borderRadius: radius.panelCompact,
      boxShadow: `${shadow.subtle}, inset 0 1px 0 rgba(255,255,255,0.02)`,
    }}>
      <div style={{ ...metaStyle, fontSize: "9px", letterSpacing: "0.14em", color: colors.gold, marginBottom: "3px" }}>{label}</div>
      <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "20px", color: colors.parchment }}>{value}</div>
    </div>
  );
}

export function AttrBlock({ label, score, active, onClick }) {
  return (
    <button onClick={onClick} disabled={!onClick} style={{
      padding: "9px 10px", width: "100%", fontFamily: "inherit",
      backgroundColor: active ? "rgba(215, 167, 111, 0.16)" : "rgba(20, 29, 29, 0.35)",
      border: `1px solid ${active ? "rgba(215, 167, 111, 0.5)" : "rgba(215, 167, 111, 0.14)"}`,
      borderRadius: "12px",
      display: "flex", flexDirection: "column", alignItems: "center",
      boxShadow: "0 4px 10px rgba(0,0,0,0.12)", cursor: onClick ? "pointer" : "default",
    }}>
      <div style={{ ...metaStyle, fontSize: "9px", letterSpacing: "0.12em", color: colors.gold }}>{label}</div>
      <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "22px", color: colors.parchment, lineHeight: "1.1", marginTop: "2px" }}>{score ?? 0}</div>
    </button>
  );
}

export function NeedBar({ label, value, ...props }) {
  return <StatBar label={label} value={value} max={100} {...props} />;
}

const STAT_TONES = {
  vitality: "#d88a78",
  resolve: "#b48bd3",
  hunger: "#d8ad61",
  thirst: "#68b9d1",
  sleep: "#8f9fd2",
};

// A compact status card used by the character dossier. The number, state,
// icon, and track all share one colour language; warning thresholds override
// the decorative tone so an urgent need can never look healthy.
export function StatBar({ label, value, max = 100, gradient, icon, detail, tone, className = "" }) {
  const v = Math.round(Number.isFinite(value) ? value : 0);
  const m = Math.max(1, max);
  const pct = Math.max(0, Math.min(100, (v / m) * 100));
  const toneColor = STAT_TONES[tone] || colors.gold;
  const meterColor = pct <= 10 ? "#f38b80" : pct <= 30 ? "#e1a35f" : toneColor;
  const barColor = gradient || `linear-gradient(90deg, color-mix(in srgb, ${meterColor} 68%, #18303b), ${meterColor})`;

  return (
    <div
      className={`stat-meter${tone ? ` stat-meter--${tone}` : ""}${className ? ` ${className}` : ""}`}
      style={{ "--meter-color": meterColor, "--meter-fill": barColor }}
      role="meter"
      aria-label={`${label} ${v} of ${m}`}
      aria-valuemin="0"
      aria-valuemax={m}
      aria-valuenow={v}
    >
      <div className="stat-meter__head">
        {icon && <span className="stat-meter__icon" aria-hidden="true"><Icon name={icon} size={16} strokeWidth={1.65} /></span>}
        <span className="stat-meter__copy">
          <span className="stat-meter__label">{label}</span>
          {detail && <span className="stat-meter__detail">{detail}</span>}
        </span>
        <strong className="stat-meter__value">{v}<span>/{m}</span></strong>
      </div>
      <div className="stat-meter__track" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
