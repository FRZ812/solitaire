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

const ATTRIBUTE_VISUALS = {
  body: { icon: "swords", hint: "Force" },
  reflex: { icon: "arrowUp", hint: "Tempo" },
  vigor: { icon: "shield", hint: "Endure" },
  mind: { icon: "book", hint: "Arcana" },
  wit: { icon: "compass", hint: "Instinct" },
  presence: { icon: "sparkle", hint: "Will" },
};

function attributeProgress(score) {
  const thresholds = [5, 10, 15, 20, 25, 30];
  const next = thresholds.find((threshold) => score < threshold);
  if (!next) return { pct: 100, note: "Mastered" };
  const previous = thresholds.filter((threshold) => threshold <= score).at(-1) || 0;
  const pct = ((score - previous) / (next - previous)) * 100;
  return { pct: Math.max(3, Math.min(100, pct)), note: `${next - score} to ${next}` };
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
const barBtn = { ...bareBtn, width: "100%", textAlign: "left", display: "block" };

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

        {/* Conditions — surfaced first. Tap any to learn what it does. */}
        <div>
          <SectionHeader>Conditions</SectionHeader>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {state.character.conditions.length === 0
              ? <span style={{ fontSize: "12px", color: "rgba(237, 228, 208, 0.5)", fontStyle: "italic" }}>None</span>
              : state.character.conditions.map((c) => (
                  <button key={condName(c)} onClick={() => setInfo(conditionInfo(condName(c)))} style={bareBtn}><ConditionPill cond={c} /></button>
                ))}
          </div>
        </div>

        {/* Vitals — light now lives in the always-visible HUD. */}
        <div>
          <SectionHeader>Vitals</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
            <button onClick={() => showInfo("vitality")} style={barBtn}>
              <StatBar label="Vitality" value={state.character.vitality} max={state.character.vitalityMax} />
            </button>
            <button onClick={() => showInfo("resolve")} style={barBtn}>
              <StatBar label="Resolve" value={state.character.resolve} max={state.character.resolveMax}
                       gradient="linear-gradient(90deg, #6d4a8a 0%, #a06fc4 100%)" />
            </button>
          </div>
        </div>

        {/* Needs — tap to learn */}
        <div>
          <SectionHeader>Needs</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
            <button onClick={() => showInfo("hunger")} style={barBtn}><NeedBar label="Hunger" value={state.character.needs.hunger} /></button>
            <button onClick={() => showInfo("thirst")} style={barBtn}><NeedBar label="Thirst" value={state.character.needs.thirst} /></button>
            <button onClick={() => showInfo("sleep")} style={barBtn}><NeedBar label="Sleep" value={state.character.needs.sleep} /></button>
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
