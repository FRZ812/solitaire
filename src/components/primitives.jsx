import React from "react";
import { Icon } from "./Icon.jsx";
import { colors, alert, shadow, radius, glass, fonts, metaStyle } from "./tokens.js";
import { condName, conditionMeta } from "../data/conditions.js";
import { visibilityStatus } from "../engine/light.js";
import {
  NARRATOR_MODELS, NARRATOR_EFFORTS,
  getNarratorModel, setNarratorModel,
  getNarratorEffort, setNarratorEffort,
} from "../engine/narrator-models.js";

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
    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 2px", opacity: 0.78 }}>
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

// Small caps section label used inside the narrator popover.
function PickerLabel({ children }) {
  return (
    <div style={{ ...metaStyle, fontSize: "8px", letterSpacing: "0.16em", color: "rgba(215,167,111,0.7)", padding: "6px 9px 5px" }}>
      {children}
    </div>
  );
}

// The narrator switch that sits to the left of the composer. A compact button
// showing the active model; tap to open a popover and change the model and (for
// reasoning-capable OpenRouter models) its reasoning effort on the fly. Self-contained:
// it reads/writes the persisted choices directly (see engine/narrator-models.js),
// which callNarrator picks up on the next turn. The popover stays open across
// selections so both settings can be tweaked at once; an outside tap closes it.
function NarratorPicker() {
  const [open, setOpen] = React.useState(false);
  const [model, setModel] = React.useState(getNarratorModel);
  const [effort, setEffort] = React.useState(getNarratorEffort);
  const active = NARRATOR_MODELS.find((m) => m.id === model) || NARRATOR_MODELS[0];

  function chooseModel(id) { setNarratorModel(id); setModel(id); }
  function chooseEffort(id) { setNarratorEffort(id); setEffort(id); }

  const effortLabel = active.efforts
    ? ` · ${(NARRATOR_EFFORTS.find((e) => e.id === effort) || {}).label ?? effort}`
    : "";
  const compactLabel = active.label
    .replace("DeepSeek", "DS")
    .replace("Gemini", "Gem")
    .replace("GPT-", "GPT ")
    .split(" ")
    .slice(0, 2)
    .join(" ");

  return (
    <div className={`narrator-picker${open ? " is-open" : ""}`} style={{ position: "relative", flexShrink: 0 }}>
      {open && (
        <>
          {/* Click-away backdrop — closes the popover on any outside tap. */}
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          {/* Popover, anchored above the button (composer sits at screen bottom). */}
          <div className="narrator-picker__popover" style={{
            position: "absolute", bottom: "calc(100% + 8px)", left: 0, zIndex: 41,
            minWidth: "212px", padding: "5px",
            background: "rgba(13, 19, 18, 0.97)",
            backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
            border: `1px solid rgba(215, 167, 111, 0.22)`,
            borderRadius: radius.panelCompact, boxShadow: shadow.panel,
          }}>
            <PickerLabel>Narrator</PickerLabel>
            {NARRATOR_MODELS.map((m) => {
              const on = m.id === model;
              return (
                <button className={`narrator-picker__option${on ? " is-active" : ""}`} key={m.id} onClick={() => chooseModel(m.id)} aria-pressed={on} style={{
                  width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: "9px",
                  padding: "9px", borderRadius: radius.chip, fontFamily: "inherit", cursor: "pointer",
                  border: "none", background: on ? "rgba(215, 167, 111, 0.14)" : "transparent",
                }}>
                  <span style={{
                    width: "7px", height: "7px", borderRadius: radius.pill, flexShrink: 0,
                    background: on ? colors.gold : "transparent",
                    border: on ? "none" : `1px solid rgba(215,167,111,0.35)`,
                  }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: "13px", fontWeight: on ? 700 : 500, color: colors.parchment }}>{m.label}</span>
                    {m.note && <span style={{ fontSize: "11px", color: "rgba(237,228,208,0.55)" }}>{m.note}</span>}
                  </span>
                </button>
              );
            })}

            {/* Thinking effort — only for models that expose it. */}
            {active.efforts && (
              <>
                <div style={{ height: "1px", margin: "5px 6px", background: "rgba(215,167,111,0.16)" }} />
                <PickerLabel>Thinking effort</PickerLabel>
                <div style={{ display: "flex", gap: "6px", padding: "1px 5px 4px" }}>
                  {active.efforts.map((eid) => {
                    const on = eid === effort;
                    const lbl = (NARRATOR_EFFORTS.find((e) => e.id === eid) || {}).label ?? eid;
                    return (
                      <button key={eid} onClick={() => chooseEffort(eid)} style={{
                        flex: 1, padding: "8px", borderRadius: radius.chip, fontFamily: "inherit",
                        cursor: "pointer", fontSize: "12px", fontWeight: on ? 700 : 600,
                        border: `1px solid rgba(215,167,111,${on ? 0.5 : 0.2})`,
                        background: on ? "rgba(215,167,111,0.16)" : "transparent",
                        color: on ? colors.parchment : "rgba(237,228,208,0.7)",
                      }}>{lbl}</button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      )}
      <button
        type="button"
        className="narrator-picker__trigger"
        onClick={() => setOpen((o) => !o)}
        title={`Narrator: ${active.label}${effortLabel}`}
        aria-label={`Narrator: ${active.label}${effortLabel}. Tap to change model or thinking effort.`}
        style={{
          height: "48px", borderRadius: radius.control,
          backgroundColor: open ? "rgba(215, 167, 111, 0.16)" : "rgba(10, 15, 15, 0.65)",
          backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          border: `1px solid rgba(215, 167, 111, ${open ? 0.5 : 0.22})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", flexShrink: 0,
          boxShadow: "0 10px 24px rgba(0,0,0,0.3)",
        }}
      >
        <Icon name="sparkle" size={16} color={colors.gold} strokeWidth={1.8} />
        <span><small>Narrator</small><strong>{compactLabel}</strong></span>
      </button>
    </div>
  );
}

export function InputBar({ value, onChange, onSubmit, onRun, queuedCount = 0, loading }) {
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
  return (
    <div className={`story-input${focused ? " is-focused" : ""}${value.trim() ? " has-value" : ""}${queuedCount ? " has-queued" : ""}${loading ? " is-sending" : ""}`} style={{
      padding: "10px 12px calc(env(safe-area-inset-bottom, 0px) + 12px) 12px",
      background: "linear-gradient(180deg, rgba(7,25,40,0) 0%, rgba(7,25,40,0.48) 20%, rgba(7,25,40,0.84) 100%)",
      display: "block",
    }}>
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
