import React, { useState } from "react";
import { Icon } from "./Icon.jsx";
import {
  ConditionPill, NeedBar, StatBar,
  SectionHeader, ErrorBanner, actionButtonStyle, insetBoxStyle,
} from "./primitives.jsx";
import { colors, alert, radius, fonts, metaStyle } from "./tokens.js";
import { ATTR_KEYS, ATTR_LABELS } from "../config.js";
import { deriveCombatStats } from "../engine/combat-stats.js";
import { effectiveAttributes, PROFICIENCIES, ratingFromXp } from "../data/proficiencies.js";
import { attrDescriptor } from "../data/attribute-tiers.js";
import { AttributeDetail } from "./AttributeDetail.jsx";
import { InfoModal } from "./InfoTip.jsx";
import { glossaryById, conditionInfo } from "../data/glossary.js";
import { condName } from "../data/conditions.js";
import { canHeal } from "../engine/healing.js";
import { STORY_FONT_SCALES, getStoryFontScale, setStoryFontScale } from "../engine/preferences.js";

const ATTRIBUTE_VISUALS = {
  body: { icon: "combat", hint: "Force" },
  reflex: { icon: "progress", hint: "Tempo" },
  vigor: { icon: "condition", hint: "Endure" },
  mind: { icon: "codex", hint: "Arcana" },
  wit: { icon: "compass", hint: "Instinct" },
  presence: { icon: "abilities", hint: "Will" },
};

function attributeProgress(score) {
  const thresholds = [5, 10, 15, 20, 25, 30];
  const next = thresholds.find((threshold) => score < threshold);
  if (!next) return { pct: 100, note: "Mastered" };
  const previous = thresholds.filter((threshold) => threshold <= score).at(-1) || 0;
  const pct = ((score - previous) / (next - previous)) * 100;
  return { pct: Math.max(3, Math.min(100, pct)), note: `${next - score} to ${next}` };
}

function meterDetail(kind, value, max = 100) {
  const pct = Math.max(0, Math.min(100, ((value || 0) / Math.max(1, max)) * 100));
  if (pct <= 10) return "Critical";
  if (pct <= 30) return "Low";
  if (pct <= 60) return "Waning";
  if (pct <= 85) return "Steady";
  return ({ vitality: "Healthy", resolve: "Focused", hunger: "Fed", thirst: "Hydrated", sleep: "Rested" })[kind] || "Full";
}

function AttributeCard({ attrKey, score, active, onClick }) {
  const visual = ATTRIBUTE_VISUALS[attrKey];
  const progress = attributeProgress(score);
  return (
    <button
      type="button"
      className={`attribute-card${active ? " is-active" : ""}`}
      onClick={onClick}
      aria-expanded={active}
      aria-controls={`attribute-detail-${attrKey}`}
    >
      <span className="attribute-card__sigil" aria-hidden="true">
        <Icon name={visual.icon} size={17} strokeWidth={1.55} />
      </span>
      <span className="attribute-card__copy">
        <span className="attribute-card__label">{ATTR_LABELS[attrKey]}</span>
        <span className="attribute-card__rank">{attrDescriptor(attrKey, score)}</span>
      </span>
      <strong className="attribute-card__score">{score}</strong>
      <span className="attribute-card__track" aria-hidden="true"><i style={{ width: `${progress.pct}%` }} /></span>
      <span className="attribute-card__footer"><span>{visual.hint}</span><span>{progress.note}</span></span>
    </button>
  );
}

// Compact label/value cell for the derived combat stats grid. Tappable to explain.
function CombatStat({ label, value, onClick }) {
  return (
    <button onClick={onClick} disabled={!onClick} style={{
      padding: "7px 8px", width: "100%", fontFamily: "inherit",
      backgroundColor: "rgba(20, 29, 29, 0.35)",
      border: `1px solid rgba(215, 167, 111, 0.14)`,
      borderRadius: "10px", cursor: onClick ? "pointer" : "default",
      display: "flex", flexDirection: "column", alignItems: "center",
    }}>
      <div style={{ ...metaStyle, fontSize: "8px", letterSpacing: "0.1em", color: colors.gold }}>{label}</div>
      <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "17px", color: colors.parchment, lineHeight: 1.1, marginTop: "2px" }}>{value}</div>
    </button>
  );
}

// "View all N →" link to open the Arsenal panel.
function ViewAll({ label, onClick }) {
  return (
    <button onClick={onClick} style={{
      marginTop: "8px", display: "flex", alignItems: "center", gap: "5px",
      background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit",
      color: "rgba(215, 167, 111, 0.85)", fontSize: "11px", fontWeight: 700,
      letterSpacing: "0.04em", padding: 0,
    }}>
      {label} <span style={{ fontSize: "13px" }}>→</span>
    </button>
  );
}

// Transparent button wrappers so existing display components become tappable.
const bareBtn = { background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" };

// Hairline rule used to separate the sheet's major groups (identity /
// stats / possessions / actions) so the section headers don't all read as
// one undifferentiated stack.
function Divider() {
  return (
    <div style={{
      height: "1px",
      margin: "2px 0",
      background: "linear-gradient(90deg, transparent, rgba(215, 167, 111, 0.2), transparent)",
    }} />
  );
}

// Character page of the panel deck — identity, conditions, vitals, needs,
// attributes, proficiencies, combat, and campaign actions. Content only;
// the deck supplies the sheet chrome, scroll, and dismissal. (Wealth + gear now
// live on the Inventory page.)
export function MenuSheet({ state, user, onReset, onBackToCampaigns, onSignOut, onLinkEmail }) {
  const [showAllProficiencies, setShowAllProficiencies] = useState(false);
  const [openAttr, setOpenAttr] = useState(null); // attribute key whose threshold detail is expanded
  const [info, setInfo] = useState(null); // glossary explanation popover { term, text, extra }
  const codex = state.world.codex;
  const attrs = effectiveAttributes(state.character);
  const combat = deriveCombatStats(state.character, codex);
  const conditions = state.character.conditions || [];
  const needs = state.character.needs || { hunger: 100, thirst: 100, sleep: 100 };
  // Tap-to-explain: open a glossary entry, appending a LIVE line for the
  // concepts whose state actually varies (resolve regen and healing).
  const liveStyle = { fontSize: "12px", color: colors.parchmentMuted, background: "rgba(215,167,111,0.08)", border: "1px solid rgba(215,167,111,0.2)", borderRadius: radius.chip, padding: "6px 9px" };
  function showInfo(id) {
    const g = glossaryById(id);
    if (!g) return;
    let extra = null;
    if (id === "resolve") {
      const max = state.character.resolveMax ?? 0;
      const cur = Math.round(state.character.resolve ?? 0);
      const rr = combat.triggers?.resolveRegen || 0;
      extra = <div style={liveStyle}>Right now: <b>{cur}/{max}</b>{rr > 0 ? ` — and ${rr} back each turn from your traits` : " — restored by rest or a drink"}.</div>;
    } else if (id === "vitality") {
      extra = <div style={liveStyle}>{canHeal(state.character.conditions) ? "Right now: healing normally." : "Right now: NOT healing — a wound or need is blocking it."}</div>;
    }
    setInfo({ term: g.term, text: g.text, extra });
  }
  const trainedProfs = PROFICIENCIES
    .map((p) => ({ name: p.name, rating: ratingFromXp(state.character.proficiencies?.[p.id] || 0), xp: state.character.proficiencies?.[p.id] || 0 }))
    .filter((p) => p.xp > 0)
    .sort((a, b) => b.rating - a.rating || b.xp - a.xp);
  const PREVIEW = 4;

  const showGuestNag = user?.is_anonymous && onLinkEmail;
  return (
    <div className="menu-sheet deck-view" style={{ padding: "18px 16px 8px", display: "flex", flexDirection: "column", gap: "17px", color: colors.parchment }}>

        {/* A single at-a-glance state card keeps conditions visually connected
            to the pools they affect without flattening everything into bars. */}
        <section className={`character-status-overview${conditions.length ? " has-conditions" : " is-clear"}`}>
          <div className="character-status-overview__heading">
            <div>
              <small>Current state</small>
              <h3>{conditions.length ? `${conditions.length} active ${conditions.length === 1 ? "condition" : "conditions"}` : "Ready for the road"}</h3>
            </div>
            <span>{conditions.length ? "Affected" : "Clear"}</span>
          </div>
          <div className="character-condition-shelf">
            <span className="character-condition-shelf__sigil" aria-hidden="true"><Icon name="shield" size={18} strokeWidth={1.55} /></span>
            <div className="character-condition-shelf__copy">
              <strong>Conditions</strong>
              {conditions.length === 0
                ? <p>No wounds, afflictions, or active boons.</p>
                : (
                  <div className="character-condition-shelf__pills">
                    {conditions.map((c) => (
                      <button key={condName(c)} onClick={() => setInfo(conditionInfo(condName(c)))} style={bareBtn}><ConditionPill cond={c} /></button>
                    ))}
                  </div>
                )}
            </div>
          </div>
        </section>

        {/* Vitals — light now lives in the always-visible HUD. */}
        <div className="character-status-group">
          <SectionHeader>Vitals</SectionHeader>
          <div className="status-meter-grid status-meter-grid--vitals">
            <button className="status-meter-button" aria-label={`Learn about Vitality — ${Math.round(state.character.vitality)} of ${state.character.vitalityMax}`} onClick={() => showInfo("vitality")}>
              <StatBar
                label="Vitality" icon="heart" tone="vitality"
                value={state.character.vitality} max={state.character.vitalityMax}
                detail={meterDetail("vitality", state.character.vitality, state.character.vitalityMax)}
              />
            </button>
            <button className="status-meter-button" aria-label={`Learn about Resolve — ${Math.round(state.character.resolve)} of ${state.character.resolveMax}`} onClick={() => showInfo("resolve")}>
              <StatBar
                label="Resolve" icon="flame" tone="resolve"
                value={state.character.resolve} max={state.character.resolveMax}
                detail={meterDetail("resolve", state.character.resolve, state.character.resolveMax)}
              />
            </button>
          </div>
        </div>

        {/* Needs — tap to learn */}
        <div className="character-status-group">
          <SectionHeader>Needs</SectionHeader>
          <div className="status-meter-grid status-meter-grid--needs">
            <button className="status-meter-button" aria-label={`Learn about Hunger — ${Math.round(needs.hunger)} of 100`} onClick={() => showInfo("hunger")}>
              <NeedBar label="Hunger" icon="hunger" tone="hunger" value={needs.hunger} detail={meterDetail("hunger", needs.hunger)} />
            </button>
            <button className="status-meter-button" aria-label={`Learn about Thirst — ${Math.round(needs.thirst)} of 100`} onClick={() => showInfo("thirst")}>
              <NeedBar label="Thirst" icon="droplet" tone="thirst" value={needs.thirst} detail={meterDetail("thirst", needs.thirst)} />
            </button>
            <button className="status-meter-button" aria-label={`Learn about Sleep — ${Math.round(needs.sleep)} of 100`} onClick={() => showInfo("sleep")}>
              <NeedBar label="Sleep" icon="moon" tone="sleep" value={needs.sleep} detail={meterDetail("sleep", needs.sleep)} />
            </button>
          </div>
        </div>

        {/* Attributes — effective (base + growth earned by grinding proficiencies).
            Tap one to see its always-on bonuses + the threshold-unlock ladder. */}
        <div>
          <SectionHeader>Attributes</SectionHeader>
          <div className="attribute-grid">
            {ATTR_KEYS.map((key) => (
              <AttributeCard
                key={key}
                attrKey={key}
                score={attrs[key]}
                active={openAttr === key}
                onClick={() => setOpenAttr((current) => (current === key ? null : key))}
              />
            ))}
          </div>
          {openAttr && <AttributeDetail attrKey={openAttr} value={attrs[openAttr] ?? 0} />}
        </div>

        {/* Proficiencies — what you've trained by doing. Raise these to grow attributes. */}
        <div>
          <SectionHeader>Proficiencies</SectionHeader>
          <div style={insetBoxStyle}>
            {trainedProfs.length === 0
              ? <span style={{ fontSize: "12px", color: "rgba(237, 228, 208, 0.45)", fontStyle: "italic" }}>None yet — fight, cast, and survive to improve.</span>
              : (
                <>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {(showAllProficiencies ? trainedProfs : trainedProfs.slice(0, PREVIEW)).map((p) => (
                      <span key={p.name} style={{
                        fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: radius.pill,
                        color: colors.parchment, border: `1px solid rgba(215, 167, 111, 0.28)`,
                        backgroundColor: "rgba(215, 167, 111, 0.08)",
                      }}>
                        {p.name} <span style={{ color: colors.gold }}>{p.rating}</span>
                      </span>
                    ))}
                  </div>
                  {trainedProfs.length > PREVIEW && (
                    <ViewAll
                      label={showAllProficiencies ? "Show fewer proficiencies" : `All ${trainedProfs.length} proficiencies`}
                      onClick={() => setShowAllProficiencies((value) => !value)}
                    />
                  )}
                </>
              )}
          </div>
        </div>

        {/* Combat — stats derived from attributes + equipped gear. */}
        <div>
          <SectionHeader>Combat</SectionHeader>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginBottom: "8px" }}>
            <CombatStat label="Armor" value={combat.armor} onClick={() => showInfo("armor")} />
            <CombatStat label="Ward" value={combat.ward} onClick={() => showInfo("ward")} />
            <CombatStat label="Dodge" value={`${combat.dodge}%`} onClick={() => showInfo("dodge")} />
            <CombatStat label="Crit" value={`${combat.critChance}%`} onClick={() => showInfo("crit")} />
            <CombatStat label="Pen" value={combat.weapon.pen} onClick={() => showInfo("penetration")} />
            <CombatStat label="Damage" value={`${combat.weapon.min}–${combat.weapon.max}`} onClick={() => showInfo("damage")} />
          </div>
          <div style={{ ...insetBoxStyle, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
            <span style={{ ...metaStyle, fontSize: "9px", letterSpacing: "0.12em", color: "rgba(215, 167, 111, 0.7)" }}>Readied weapon</span>
            <span style={{ fontFamily: fonts.serif, fontStyle: "italic", color: colors.parchmentLight }}>{combat.weapon.name}</span>
          </div>
        </div>

        <Divider />

        <SettingsSection />

        <Divider />

        {showGuestNag && <GuestNagSection onLinkEmail={onLinkEmail} />}

        <Divider />

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {onBackToCampaigns && (
            <button className="menu-action" onClick={onBackToCampaigns} style={actionButtonStyle()}>
              <Icon name="arrowLeft" size={14} strokeWidth={1.5} />
              Back to Campaigns
            </button>
          )}
          <button className="menu-action" onClick={onReset} style={actionButtonStyle({ danger: true })}>
            <Icon name="reset" size={14} strokeWidth={1.5} />
            Reset Campaign
          </button>
          {onSignOut && (
            <button className="menu-action" onClick={onSignOut} style={actionButtonStyle({ ghost: true })}>
              Sign Out
            </button>
          )}
        </div>

      {info && <InfoModal info={info} onClose={() => setInfo(null)} />}
    </div>
  );
}

// Story text size — persisted via preferences.js, applied live as a CSS var
// so every open bubble resizes immediately without a reload.
function SettingsSection() {
  const [fontScale, setFontScale] = useState(getStoryFontScale());
  function chooseFontScale(id) {
    setStoryFontScale(id);
    setFontScale(id);
  }
  return (
    <div>
      <SectionHeader>Settings</SectionHeader>
      <div style={insetBoxStyle}>
        <div style={{ ...metaStyle, fontSize: "9px", letterSpacing: "0.12em", color: "rgba(215, 167, 111, 0.7)", marginBottom: "8px" }}>
          Story text size
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          {STORY_FONT_SCALES.map((s) => {
            const on = s.id === fontScale;
            return (
              <button key={s.id} onClick={() => chooseFontScale(s.id)} aria-pressed={on} style={{
                flex: 1, padding: "8px 4px", borderRadius: radius.chip, fontFamily: "inherit",
                cursor: "pointer", fontSize: "12px", fontWeight: on ? 700 : 600,
                border: `1px solid rgba(215,167,111,${on ? 0.5 : 0.2})`,
                background: on ? "rgba(215,167,111,0.16)" : "transparent",
                color: on ? colors.parchment : "rgba(237,228,208,0.7)",
              }}>{s.label}</button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GuestNagSection({ onLinkEmail }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const addr = email.trim();
    if (!addr || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onLinkEmail(addr);
      setSent(true);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      marginTop: "4px",
      padding: "14px 16px",
      backgroundColor: "rgba(215, 167, 111, 0.06)",
      border: `1px solid rgba(215, 167, 111, 0.22)`,
      borderRadius: radius.panelCompact,
    }}>
      <div style={{
        ...metaStyle, fontSize: "10px", letterSpacing: "0.12em",
        color: colors.parchmentMuted, fontWeight: 700, marginBottom: "6px",
      }}>
        Playing as guest
      </div>
      <p style={{ margin: "0 0 10px 0", fontSize: "12px", color: "rgba(237, 228, 208, 0.75)", lineHeight: "1.45" }}>
        Link an email so you can resume your campaigns from another device.
      </p>
      {sent ? (
        <div style={{
          fontSize: "12px",
          color: alert.successText,
          padding: "8px 12px",
          backgroundColor: alert.successBg,
          border: `1px solid ${alert.successBorder}`,
          borderRadius: radius.chip,
        }}>
          Check <strong>{email}</strong> for a confirmation link.
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: "8px" }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={busy}
            required
            className="custom-input"
            style={{
              flex: 1, padding: "9px 12px", fontSize: "13px",
              backgroundColor: "rgba(10, 15, 15, 0.65)", color: colors.parchment,
              border: `1px solid rgba(215, 167, 111, 0.2)`,
              borderRadius: radius.chip,
              fontFamily: "inherit", outline: "none", minWidth: 0,
            }}
          />
          <button
            type="submit"
            disabled={busy || !email.trim()}
            style={{
              padding: "9px 15px", fontSize: "12px", fontWeight: 700,
              backgroundColor: colors.gold, color: colors.ink,
              border: "none", borderRadius: radius.chip,
              cursor: (busy || !email.trim()) ? "default" : "pointer",
              opacity: (busy || !email.trim()) ? 0.4 : 1,
              fontFamily: "inherit", whiteSpace: "nowrap",
            }}
          >
            {busy ? "..." : "Link"}
          </button>
        </form>
      )}
      {error && <ErrorBanner style={{ margin: "8px 0 0" }}>{error}</ErrorBanner>}
    </div>
  );
}
