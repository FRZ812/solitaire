import React, { useState } from "react";
import { Icon } from "./Icon.jsx";
import {
  ConditionPill, NeedBar, StatBar, AttrBlock,
  SectionHeader, ErrorBanner, actionButtonStyle, insetBoxStyle,
} from "./primitives.jsx";
import { colors, alert, radius, fonts, metaStyle } from "./tokens.js";
import { ATTR_KEYS, ATTR_LABELS } from "../config.js";
import { deriveCombatStats } from "../engine/combat-stats.js";
import { getAbilityDef } from "../data/abilities.js";
import { tierColor, tierLabel, tierOrder } from "../data/tiers.js";
import { effectiveAttributes, PROFICIENCIES, ratingFromXp } from "../data/proficiencies.js";
import { knownBuffSpells } from "../data/buff-spells.js";
import { ArsenalView } from "./ArsenalView.jsx";
import { AttributeDetail } from "./AttributeDetail.jsx";
import { InfoButton, InfoModal } from "./InfoTip.jsx";
import { glossaryById, conditionInfo } from "../data/glossary.js";
import { condName, condNames } from "../data/conditions.js";
import { lightStatus } from "../engine/light.js";
import { canHeal } from "../engine/healing.js";

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

// Tier-coloured ability pill.
function AbilityChip({ name, tier }) {
  const c = tierColor(tier);
  return (
    <span title={tierLabel(tier)} style={{
      fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: radius.pill,
      color: c, border: `1px solid ${c}`, backgroundColor: `${c}18`,
    }}>{name}</span>
  );
}

// Small "· tap to learn" hint appended to section headers.
const tapHint = { fontWeight: 400, fontSize: "9px", color: "rgba(215,167,111,0.5)", letterSpacing: 0, textTransform: "none" };
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
// attributes, proficiencies, combat, boons, and campaign actions. Content only;
// the deck supplies the sheet chrome, scroll, and dismissal. (Wealth + gear now
// live on the Inventory page.)
export function MenuSheet({ state, user, onReset, onOpenCodex, onBackToCampaigns, onSignOut, onLinkEmail, onExtinguish, onCastBuff }) {
  const [arsenalOpen, setArsenalOpen] = useState(false);
  const [openAttr, setOpenAttr] = useState(null); // attribute key whose threshold detail is expanded
  const [info, setInfo] = useState(null); // glossary explanation popover { term, text, extra }
  const codex = state.world.codex;
  const attrs = effectiveAttributes(state.character);
  const combat = deriveCombatStats(state.character, codex);
  // Tap-to-explain: open a glossary entry, appending a LIVE line for the
  // concepts whose state actually varies (resolve regen, healing, light).
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
    } else if (id === "light") {
      extra = <div style={liveStyle}>Right now: <b>{lightStatus(state).text}</b>.</div>;
    }
    setInfo({ term: g.term, text: g.text, extra });
  }
  const learnedAbilities = state.character.abilities || [];
  const trainedProfs = PROFICIENCIES
    .map((p) => ({ name: p.name, rating: ratingFromXp(state.character.proficiencies?.[p.id] || 0), xp: state.character.proficiencies?.[p.id] || 0 }))
    .filter((p) => p.xp > 0)
    .sort((a, b) => b.rating - a.rating || b.xp - a.xp);

  // Abilities, highest tier first — the panel shows a short preview; the full
  // sorted list lives in the Arsenal panel.
  const sortedAbilities = [
    { id: "basic-attack", tier: "common" }, { id: "defend", tier: "common" }, { id: "talk", tier: "common" },
    ...learnedAbilities.map((a) => (typeof a === "string" ? { id: a, tier: "common" } : a)),
  ].filter((a) => { const d = getAbilityDef(a.id); return d && !d.noncombat; }).sort((x, y) => tierOrder(y.tier || "common") - tierOrder(x.tier || "common"));
  const PREVIEW = 4;

  const showGuestNag = user?.is_anonymous && onLinkEmail;

  return (
    <div style={{ padding: "2px 16px 8px", display: "flex", flexDirection: "column", gap: "15px", color: colors.parchment }}>
        {/* Header — character name. */}
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: fonts.serif, fontStyle: "italic",
            fontSize: "26px", color: colors.parchmentLight, lineHeight: 1.05,
            textShadow: "0 2px 10px rgba(0,0,0,0.3)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {state.character.name}
          </div>
        </div>

        {/* Bond */}
        <div style={{
          fontFamily: fonts.serif, fontStyle: "italic",
          fontSize: "15px", lineHeight: "1.5",
          color: colors.parchmentMuted,
          paddingLeft: "12px",
          borderLeft: `2px solid rgba(215, 167, 111, 0.4)`,
          opacity: 0.95,
        }}>
          {state.character.bond}
        </div>

        <Divider />

        {/* Conditions — surfaced first. Tap any to learn what it does. */}
        <div>
          <SectionHeader>Conditions <span style={tapHint}>· tap to learn</span></SectionHeader>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {state.character.conditions.length === 0
              ? <span style={{ fontSize: "12px", color: "rgba(237, 228, 208, 0.5)", fontStyle: "italic" }}>None</span>
              : state.character.conditions.map((c) => (
                  <button key={condName(c)} onClick={() => setInfo(conditionInfo(condName(c)))} style={bareBtn}><ConditionPill cond={c} /></button>
                ))}
          </div>
        </div>

        {/* Vitals — Vitality + Resolve (+ light), grouped with the needs below. Tap to learn. */}
        <div>
          <SectionHeader>Vitals <span style={tapHint}>· tap to learn</span></SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
            <button onClick={() => showInfo("vitality")} style={barBtn}>
              <StatBar label="Vitality" value={state.character.vitality} max={state.character.vitalityMax} />
            </button>
            <button onClick={() => showInfo("resolve")} style={barBtn}>
              <StatBar label="Resolve" value={state.character.resolve} max={state.character.resolveMax}
                       gradient="linear-gradient(90deg, #6d4a8a 0%, #a06fc4 100%)" />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "7px", padding: "4px 2px" }}>
              <button onClick={() => showInfo("light")} style={{ ...bareBtn, display: "flex", alignItems: "center", gap: "7px", flex: 1, minWidth: 0 }}>
                <span style={{ ...metaStyle, fontSize: "9px", letterSpacing: "0.12em", color: colors.gold }}>Light</span>
                <span style={{ fontSize: "12px", color: colors.parchment }}>{lightStatus(state).text}</span>
                <InfoButton onClick={() => showInfo("light")} />
              </button>
              {lightStatus(state).lit && (
                <button onClick={() => onExtinguish?.()} style={{
                  flexShrink: 0, padding: "4px 10px", borderRadius: radius.pill, fontFamily: "inherit",
                  background: "rgba(20,29,29,0.6)", border: `1px solid rgba(215,167,111,0.3)`,
                  color: "rgba(215,167,111,0.85)", fontSize: "11px", fontWeight: 700, cursor: "pointer",
                }}>Extinguish</button>
              )}
            </div>
          </div>
        </div>

        {/* Needs — tap to learn */}
        <div>
          <SectionHeader>Needs <span style={tapHint}>· tap to learn</span></SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
            <button onClick={() => showInfo("hunger")} style={barBtn}><NeedBar label="Hunger" value={state.character.needs.hunger} /></button>
            <button onClick={() => showInfo("thirst")} style={barBtn}><NeedBar label="Thirst" value={state.character.needs.thirst} /></button>
            <button onClick={() => showInfo("sleep")} style={barBtn}><NeedBar label="Sleep" value={state.character.needs.sleep} /></button>
          </div>
        </div>

        {/* Attributes — effective (base + growth earned by grinding proficiencies).
            Tap one to see its always-on bonuses + the threshold-unlock ladder. */}
        <div>
          <SectionHeader>Attributes <span style={{ fontWeight: 400, fontSize: "9px", color: "rgba(215,167,111,0.5)", letterSpacing: 0, textTransform: "none" }}>· tap for thresholds</span></SectionHeader>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
            {ATTR_KEYS.map(k => <AttrBlock key={k} label={ATTR_LABELS[k]} score={attrs[k]} active={openAttr === k} onClick={() => setOpenAttr((p) => (p === k ? null : k))} />)}
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
                    {trainedProfs.slice(0, PREVIEW).map((p) => (
                      <span key={p.name} style={{
                        fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: radius.pill,
                        color: colors.parchment, border: `1px solid rgba(215, 167, 111, 0.28)`,
                        backgroundColor: "rgba(215, 167, 111, 0.08)",
                      }}>
                        {p.name} <span style={{ color: colors.gold }}>{p.rating}</span>
                      </span>
                    ))}
                  </div>
                  {trainedProfs.length > PREVIEW && <ViewAll label={`All ${trainedProfs.length} proficiencies`} onClick={() => setArsenalOpen(true)} />}
                </>
              )}
          </div>
        </div>

        {/* Combat — stats derived from attributes + equipped gear. */}
        <div>
          <SectionHeader>Combat <span style={tapHint}>· tap to learn</span></SectionHeader>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginBottom: "8px" }}>
            <CombatStat label="Armor" value={combat.armor} onClick={() => showInfo("armor")} />
            <CombatStat label="Ward" value={combat.ward} onClick={() => showInfo("ward")} />
            <CombatStat label="Dodge" value={`${combat.dodge}%`} onClick={() => showInfo("dodge")} />
            <CombatStat label="Crit" value={`${combat.critChance}%`} onClick={() => showInfo("crit")} />
            <CombatStat label="Pen" value={combat.weapon.pen} onClick={() => showInfo("penetration")} />
            <CombatStat label="Damage" value={`${combat.weapon.min}–${combat.weapon.max}`} onClick={() => showInfo("damage")} />
          </div>
          <div style={insetBoxStyle}>
            <div style={{ ...metaStyle, fontSize: "9px", letterSpacing: "0.12em", color: "rgba(215, 167, 111, 0.7)", marginBottom: "7px" }}>
              Abilities · {combat.weapon.name}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {sortedAbilities.slice(0, PREVIEW).map((a, i) => {
                const def = getAbilityDef(a.id);
                if (!def) return null;
                return <AbilityChip key={i} name={def.name} tier={a.tier || "common"} />;
              })}
            </div>
            {sortedAbilities.length > PREVIEW && <ViewAll label={`All ${sortedAbilities.length} abilities`} onClick={() => setArsenalOpen(true)} />}
          </div>
        </div>

        <Divider />

        {/* Boons — castable self-buffs (Haste, Bear's Strength). Spend resolve to
            lay a timed boon that speeds travel / lifts carrying limits. */}
        {(() => {
          const boons = knownBuffSpells(state.character);
          if (!boons.length) return null;
          const active = new Set(condNames(state.character.conditions));
          return (
            <div>
              <SectionHeader>Boons</SectionHeader>
              <div style={{ ...insetBoxStyle, display: "flex", flexDirection: "column", gap: "8px" }}>
                {boons.map((sp) => {
                  const on = active.has(sp.applies.condition);
                  const afford = (state.character.resolve ?? 0) >= sp.resolveCost;
                  return (
                    <div key={sp.id} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "15px", color: colors.parchmentLight }}>{sp.name}{on && <span style={{ ...metaStyle, fontSize: "8px", color: "#a7f3d0", marginLeft: "6px" }}>active</span>}</div>
                        <div style={{ fontSize: "11px", color: "rgba(237,228,208,0.6)", lineHeight: 1.35 }}>{sp.description}</div>
                      </div>
                      <button onClick={() => (afford ? onCastBuff?.(sp.id) : null)} disabled={!afford} style={{
                        flexShrink: 0, padding: "7px 14px", borderRadius: radius.pill, border: "none",
                        backgroundColor: afford ? colors.gold : "rgba(215,167,111,0.1)",
                        color: afford ? colors.ink : "rgba(215,167,111,0.4)",
                        fontSize: "12px", fontWeight: 800, cursor: afford ? "pointer" : "not-allowed", fontFamily: "inherit",
                      }}>{on ? "Renew" : "Cast"} · {sp.resolveCost}</button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {showGuestNag && <GuestNagSection onLinkEmail={onLinkEmail} />}

        <Divider />

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button onClick={onOpenCodex} style={actionButtonStyle()}>
            <Icon name="book" size={14} strokeWidth={1.5} />
            Open Codex
          </button>
          {onBackToCampaigns && (
            <button onClick={onBackToCampaigns} style={actionButtonStyle()}>
              <Icon name="arrowLeft" size={14} strokeWidth={1.5} />
              Back to Campaigns
            </button>
          )}
          <button onClick={onReset} style={actionButtonStyle({ danger: true })}>
            <Icon name="reset" size={14} strokeWidth={1.5} />
            Reset Campaign
          </button>
          {onSignOut && (
            <button onClick={onSignOut} style={actionButtonStyle({ ghost: true })}>
              Sign Out
            </button>
          )}
        </div>

      {info && <InfoModal info={info} onClose={() => setInfo(null)} />}
      {arsenalOpen && <ArsenalView character={state.character} onClose={() => setArsenalOpen(false)} />}
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
