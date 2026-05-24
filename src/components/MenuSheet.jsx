import React, { useState } from "react";
import { Icon } from "./Icon.jsx";
import {
  iconButtonStyle, ConditionPill, NeedBar, StatBar, AttrBlock,
  SectionHeader, ErrorBanner,
} from "./primitives.jsx";
import { colors, alert, shadow, radius, glass, fonts, metaStyle } from "./tokens.js";
import { ATTR_KEYS, ATTR_LABELS } from "../config.js";
import { deriveCombatStats, itemCombatStats, itemRequirement, equipSlot, slotCapacity, SLOTS } from "../engine/combat-stats.js";
import { EQUIPPABLE } from "../engine/inventory.js";
import { itemTemplate } from "../data/catalog.js";
import { getAbilityDef } from "../data/abilities.js";
import { tierColor, tierLabel, tierOrder } from "../data/tiers.js";
import { passiveLabel, passiveEffectText, passiveDef, isFusionRune } from "../data/passives.js";
import { effectiveAttributes, PROFICIENCIES, ratingFromXp } from "../data/proficiencies.js";
import { useEffectChips } from "../data/goods.js";
import { freshnessLabel, perishDescriptor } from "../engine/spoilage.js";
import { ArsenalView } from "./ArsenalView.jsx";
import { AttributeDetail } from "./AttributeDetail.jsx";
import { InfoButton, InfoModal } from "./InfoTip.jsx";
import { glossaryById, conditionInfo } from "../data/glossary.js";
import { lightStatus } from "../engine/light.js";
import { canHeal } from "../engine/healing.js";

// Item-specific inline icon. The wooden bird is a meaningful in-fiction
// item, so it gets a custom glyph; everything else falls back to a
// pouch/scroll outline.
function renderItemIcon(itemId) {
  if (itemId === "wooden-bird") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px", display: "inline-block", verticalAlign: "middle" }}>
        <path d="M20 4 C16 4 13 7 11 9 C9 7 6 4 2 4 C5 9 8 11 11 12 C11 15 13 18 16 20 C16 16 15 13 14 11 C16 9 19 6 20 4 Z" fill="rgba(215, 167, 111, 0.25)" />
        <line x1="16" y1="10" x2="19" y2="7" stroke={colors.parchmentMuted} strokeWidth="1.2" />
        <line x1="15" y1="12" x2="17.5" y2="9.5" stroke={colors.parchmentMuted} strokeWidth="1.2" />
        <circle cx="11.5" cy="11.5" r="0.75" fill={colors.parchmentLight} />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(215, 167, 111, 0.75)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px", display: "inline-block", verticalAlign: "middle" }}>
      <path d="M6 20a6 6 0 0 0 12 0V10a6 6 0 0 0-12 0v10z" fill="rgba(215, 167, 111, 0.05)" />
      <path d="M6 10c0-2.5 1.5-4 6-4s6 1.5 6 4" />
      <path d="M9 6a3 3 0 0 1 6 0" />
      <line x1="8" x2="16" y1="12" y2="12" />
    </svg>
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

// Tier-coloured passive (affix) pill. Tap to reveal exactly what it does and by
// how much at this item's grade — the magnitude is otherwise opaque on the chip.
function PassiveChip({ id, tier }) {
  const [open, setOpen] = useState(false);
  const c = tierColor(tier);
  const effect = passiveEffectText(id, tier);
  const flavour = passiveDef(id)?.desc;
  return (
    <div style={{ width: open ? "100%" : "auto" }}>
      <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} title={effect}
        style={{
          fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: radius.pill,
          color: c, border: `1px solid ${c}`, cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: "4px",
        }}>
        {passiveLabel(id, tier)}
        {effect && <span style={{ opacity: 0.65, fontSize: "9px" }}>{open ? "▾" : "ⓘ"}</span>}
      </span>
      {open && effect && (
        <div style={{ margin: "5px 2px 2px", lineHeight: 1.45 }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: c }}>{effect}</div>
          {flavour && <div style={{ fontSize: "11px", fontStyle: "italic", color: "rgba(237,228,208,0.6)", marginTop: "2px" }}>{flavour}</div>}
        </div>
      )}
    </div>
  );
}

// Inset gold-tinted container reused for Wealth / Wearing / Carrying.
const insetBoxStyle = {
  background: "rgba(215, 167, 111, 0.03)",
  border: `1px solid rgba(215, 167, 111, 0.08)`,
  borderRadius: radius.chip,
  padding: "8px 12px",
};

// Small "· tap to learn" hint appended to section headers.
const tapHint = { fontWeight: 400, fontSize: "9px", color: "rgba(215,167,111,0.5)", letterSpacing: 0, textTransform: "none" };
// Transparent button wrappers so existing display components become tappable.
const bareBtn = { background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" };
const barBtn = { ...bareBtn, width: "100%", textAlign: "left", display: "block" };

// Tappable inventory row.
const itemRowStyle = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  width: "100%", textAlign: "left", gap: "8px",
  fontSize: "13px", color: colors.parchment,
  padding: "6px 2px", background: "transparent",
  border: "none", borderBottom: `1px dotted rgba(215, 167, 111, 0.1)`,
  cursor: "pointer", fontFamily: "inherit",
};

// Item detail modal: stats, requirement, passives, and equip/unequip.
function ItemDetail({ item, id, location, attrs, freshUntil, day, onEquip, onUnequip, onUse, onLightTorch, onLightLantern, onRest, onBindRune, onClose }) {
  if (!item) return null;
  const cs = itemCombatStats(item);
  const req = itemRequirement(item);
  const reqMet = (attrs[req.attr] || 0) >= req.value;
  const equippable = EQUIPPABLE.has(item.kind);
  const worn = location === "worn";
  const usable = !worn && !!item.use;
  const bindable = isFusionRune(id);
  const tcolor = tierColor(item.tier || "common");
  const effectChips = useEffectChips(item);
  const keeps = perishDescriptor(item);
  const fresh = freshnessLabel(freshUntil, day);
  const freshColor = fresh ? (fresh.tone === "bad" ? "#fca5a5" : fresh.tone === "warn" ? "#e6a878" : "#a7f3d0") : null;
  const statLine = (label, value) => (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: colors.parchment, padding: "2px 0" }}>
      <span style={{ color: colors.parchmentMuted }}>{label}</span><span>{value}</span>
    </div>
  );
  return (
    <div onClick={(e) => { e.stopPropagation(); onClose(); }} style={{
      position: "absolute", inset: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center",
      backgroundColor: "rgba(8,12,12,0.7)", backdropFilter: "blur(4px)", padding: "20px",
    }}>
      <div onClick={(e) => e.stopPropagation()} className="scale-in" style={{
        width: "100%", maxWidth: "340px", maxHeight: "80%", overflowY: "auto",
        backgroundColor: "rgba(20,29,29,0.96)", border: `1px solid ${tcolor}`,
        borderRadius: radius.panel, padding: "18px", boxShadow: shadow.sheet,
        display: "flex", flexDirection: "column", gap: "10px", ...glass,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "20px", color: tcolor, lineHeight: 1.1 }}>{item.name || id}</div>
            <div style={{ ...metaStyle, fontSize: "8px", color: colors.parchmentMuted, marginTop: "3px" }}>{tierLabel(item.tier || "common")} · {item.kind || "item"}</div>
          </div>
          <button onClick={onClose} style={{ ...iconButtonStyle, width: "28px", height: "28px", flexShrink: 0, backgroundColor: "rgba(215,167,111,0.08)", border: `1px solid rgba(215,167,111,0.2)` }}>
            <Icon name="x" size={12} color={colors.parchmentMuted} strokeWidth={2} />
          </button>
        </div>

        {item.appearance && <div style={{ fontSize: "12px", fontStyle: "italic", color: "rgba(237,228,208,0.7)", lineHeight: 1.45 }}>{item.appearance}</div>}
        {item.description && <div style={{ fontSize: "12px", color: colors.parchment, lineHeight: 1.45 }}>{item.description}</div>}

        {(cs.damage || cs.armor > 0 || cs.ward > 0 || cs.dodge > 0) && (
          <div style={insetBoxStyle}>
            {cs.damage && statLine("Damage", `${cs.damage.min}–${cs.damage.max} ${cs.damage.type}${cs.damage.pen ? ` · pen ${cs.damage.pen}` : ""}`)}
            {cs.weaponType && statLine("Type", cs.weaponType)}
            {cs.armor > 0 && statLine("Armor", `+${cs.armor}`)}
            {cs.ward > 0 && statLine("Ward", `+${cs.ward}`)}
            {cs.dodge > 0 && statLine("Dodge", `+${cs.dodge}%`)}
            {req.value > 0 && (
              <div style={{ fontSize: "11px", marginTop: "5px", color: reqMet ? "#a7f3d0" : "#fca5a5" }}>
                Requires {ATTR_LABELS[req.attr]} {req.value}{reqMet ? "" : " — under-req: reduced, passives off"}
              </div>
            )}
          </div>
        )}

        {(item.passives && item.passives.length > 0) && (
          <div>
            <div style={{ ...metaStyle, fontSize: "8px", color: colors.gold, marginBottom: "5px" }}>Passives <span style={{ color: colors.parchmentMuted, fontWeight: 400 }}>· tap for detail</span></div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
              {item.passives.map((p, i) => (
                <PassiveChip key={i} id={p.id} tier={p.tier} />
              ))}
            </div>
          </div>
        )}

        {item.grants && (
          <div style={{ ...insetBoxStyle, border: `1px solid rgba(176,114,230,0.4)` }}>
            <div style={{ ...metaStyle, fontSize: "8px", color: "#b072e6", marginBottom: "5px" }}>{worn ? "Granting (while equipped)" : "On equip — awakens magic"}</div>
            {(item.grants.abilities?.length > 0) && (
              <div style={{ fontSize: "11px", color: colors.parchment, marginBottom: "4px" }}>
                Spells in battle: {item.grants.abilities.map((a) => getAbilityDef(a.id)?.name || a.id).join(", ")}
              </div>
            )}
            {(item.grants.spells?.length > 0) && (
              <div style={{ fontSize: "11px", color: colors.parchment }}>
                Cantrips: {item.grants.spells.map((s) => s.name).join(", ")}
              </div>
            )}
            <div style={{ fontSize: "10px", color: "rgba(237,228,208,0.5)", fontStyle: "italic", marginTop: "5px" }}>
              {worn ? "Unequip to set the gift aside." : "Spells scale with Mind — grind Spellcasting to grow it."}
            </div>
          </div>
        )}

        {effectChips.length > 0 && (
          <div style={insetBoxStyle}>
            <div style={{ ...metaStyle, fontSize: "8px", color: colors.gold, marginBottom: "6px" }}>When used</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
              {effectChips.map((c, i) => (
                <span key={i} style={{ fontSize: "11px", fontWeight: 700, color: "#a7f3d0", border: "1px solid rgba(167,243,208,0.35)", padding: "2px 8px", borderRadius: radius.pill }}>{c}</span>
              ))}
            </div>
            {(keeps || fresh) && (
              <div style={{ fontSize: "11px", marginTop: "8px", color: freshColor || "rgba(237,228,208,0.55)" }}>
                {fresh ? `Freshness: ${fresh.text}` : keeps}
              </div>
            )}
          </div>
        )}

        {usable && (
          <button onClick={() => { onUse(id); onClose(); }} style={actionButtonStyle()}>{item.use.verb || "Use"}</button>
        )}
        {id === "torch" && (
          <>
            <div style={{ fontSize: "11px", fontStyle: "italic", color: "rgba(237,228,208,0.6)", margin: "2px 2px 0", lineHeight: 1.4 }}>Needs a tinderbox to strike the flame. Burns ~1h; sheds a modest pool of light.</div>
            <button onClick={() => { onLightTorch?.(); onClose(); }} style={actionButtonStyle()}>Light a torch</button>
          </>
        )}
        {id === "lantern" && (
          <>
            <div style={{ fontSize: "11px", fontStyle: "italic", color: "rgba(237,228,208,0.6)", margin: "2px 2px 0", lineHeight: 1.4 }}>Burns a flask of lamp-oil for ~4h of steady, bright light you can hood at will.</div>
            <button onClick={() => { onLightLantern?.(); onClose(); }} style={actionButtonStyle()}>Light the lantern</button>
          </>
        )}
        {((item.tool?.uses || []).includes("rest") || (item.tool?.uses || []).includes("camp")) && (
          <RestButton onRest={onRest} onClose={onClose} />
        )}
        {bindable && (
          <>
            <div style={{ fontSize: "11px", fontStyle: "italic", color: "rgba(199,155,224,0.8)", margin: "2px 2px 6px", lineHeight: 1.4 }}>
              Bind this rune to gear that bears two enchantments it can fuse.
            </div>
            <button onClick={() => { onBindRune?.(id); onClose(); }} style={actionButtonStyle()}>Bind Rune…</button>
          </>
        )}
        {equippable && (
          worn
            ? <button onClick={() => { onUnequip(id); onClose(); }} style={actionButtonStyle()}>Unequip</button>
            : <button onClick={() => { onEquip(id); onClose(); }} style={actionButtonStyle()}>Equip</button>
        )}
      </div>
    </div>
  );
}

// Bedroll rest: tap to reveal duration presets; each skips time and restores sleep.
function RestButton({ onRest, onClose }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button onClick={() => setOpen(true)} style={actionButtonStyle()}>Rest…</button>;
  const opt = (label, hours) => (
    <button onClick={() => { onRest?.(hours); onClose(); }} style={{
      flex: 1, padding: "10px 6px", borderRadius: radius.panelCompact, border: `1px solid rgba(215,167,111,0.35)`,
      background: "rgba(215,167,111,0.1)", color: colors.parchmentLight, fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
    }}>{label}</button>
  );
  return (
    <div style={{ display: "flex", gap: "6px" }}>
      {opt("Nap · 1h", 1)}
      {opt("Rest · 4h", 4)}
      {opt("Night · 8h", 8)}
    </div>
  );
}

// Pill-shaped action button at the foot of the sheet.
function actionButtonStyle({ danger = false, ghost = false } = {}) {
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

export function MenuSheet({ state, user, onClose, onReset, onOpenCodex, onBackToCampaigns, onSignOut, onLinkEmail, onEquip, onUnequip, onUse, onLightTorch, onLightLantern, onExtinguish, onRest, onBindRune }) {
  const [detail, setDetail] = useState(null); // { id, location: "worn"|"carried" }
  const [arsenalOpen, setArsenalOpen] = useState(false);
  const [openAttr, setOpenAttr] = useState(null); // attribute key whose threshold detail is expanded
  const [info, setInfo] = useState(null); // glossary explanation popover { term, text, extra }
  const inv = state.character.inventory;
  const codex = state.world.codex;
  const wornIds = codex.characters.wanderer?.worn || [];
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
      const r = combat.resolveRegen;
      extra = <div style={liveStyle}>Right now: <b>{r}/turn</b>{r > 1 ? " — quickened by your gear or traits." : r < 1 ? " — slowed (heavy armour)." : " (the base rate)."}</div>;
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
  ].filter((a) => getAbilityDef(a.id)).sort((x, y) => tierOrder(y.tier || "common") - tierOrder(x.tier || "common"));
  const PREVIEW = 4;

  const showGuestNag = user?.is_anonymous && onLinkEmail;

  return (
    <div
      style={{
        position: "absolute", inset: 0,
        backgroundColor: "rgba(11, 15, 14, 0.65)",
        backdropFilter: "blur(6px)",
        zIndex: 20,
        display: "flex", flexDirection: "column", justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="slide-up no-scrollbar"
        style={{
          backgroundColor: "rgba(20, 29, 29, 0.92)",
          border: `1px solid rgba(215, 167, 111, 0.22)`,
          borderBottom: "none",
          borderTopLeftRadius: "24px",
          borderTopRightRadius: "24px",
          padding: "20px 22px calc(env(safe-area-inset-bottom, 0px) + 24px) 22px",
          display: "flex", flexDirection: "column", gap: "15px",
          maxHeight: "85dvh", overflowY: "auto",
          ...glass,
          boxShadow: shadow.sheet,
          color: colors.parchment,
        }}
      >
        {/* Grab handle — reads as a dismissable bottom sheet. */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: "-8px", marginBottom: "2px" }}>
          <div style={{ width: "38px", height: "4px", borderRadius: radius.pill, backgroundColor: "rgba(215, 167, 111, 0.28)" }} />
        </div>

        {/* Header — character name + bond. */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
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
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              ...iconButtonStyle,
              width: "30px", height: "30px", flexShrink: 0,
              backgroundColor: "rgba(215, 167, 111, 0.08)",
              border: `1px solid rgba(215, 167, 111, 0.2)`,
            }}
          >
            <Icon name="x" size={13} color={colors.parchmentMuted} strokeWidth={2} />
          </button>
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
                  <button key={c} onClick={() => setInfo(conditionInfo(c))} style={bareBtn}><ConditionPill label={c} /></button>
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

        {/* Wealth */}
        <div>
          <SectionHeader>Wealth <button onClick={() => showInfo("currency")} style={{ ...bareBtn, verticalAlign: "middle", marginLeft: "2px" }}><InfoButton onClick={() => showInfo("currency")} /></button></SectionHeader>
          <div style={{
            ...insetBoxStyle,
            fontFamily: fonts.serif, fontStyle: "italic",
            fontSize: "17px", color: colors.parchmentLight,
            display: "grid", gridTemplateColumns: "1fr 1px 1fr 1px 1fr",
            alignItems: "center", textAlign: "center",
          }}>
            <span><strong style={{ color: "#ffd700", fontWeight: "bold" }}>{inv.coins.gold}</strong> gp</span>
            <span style={{ width: "1px", height: "16px", background: "rgba(215, 167, 111, 0.18)", justifySelf: "center" }} />
            <span><strong style={{ color: "#d1d5db", fontWeight: "bold" }}>{inv.coins.silver}</strong> sp</span>
            <span style={{ width: "1px", height: "16px", background: "rgba(215, 167, 111, 0.18)", justifySelf: "center" }} />
            <span><strong style={{ color: "#cd7f32", fontWeight: "bold" }}>{inv.coins.copper}</strong> cp</span>
          </div>
        </div>

        {/* Wearing — a paper-doll of every slot, filled or empty, so you can see
            at a glance what's equipped and where there's room. Tap a filled slot
            for details / to unequip. */}
        <div>
          <SectionHeader>Wearing</SectionHeader>
          <div style={{ ...insetBoxStyle, display: "flex", flexDirection: "column", gap: "3px" }}>
            {SLOTS.map((slot) => {
              const inSlot = wornIds.filter((id) => equipSlot(codex.items[id]) === slot.id);
              const cap = slotCapacity(slot.id);
              // One row per capacity unit: an occupant, or an empty placeholder.
              const cells = [];
              for (let i = 0; i < cap; i++) cells.push(inSlot[i] || null);
              return cells.map((id, i) => (
                <div key={`${slot.id}-${i}`} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ ...metaStyle, fontSize: "8px", width: "62px", flexShrink: 0, color: "rgba(215,167,111,0.55)", textAlign: "right" }}>
                    {cap > 1 ? `${slot.label.replace(/s$/, "")} ${i + 1}` : slot.label}
                  </span>
                  {id ? (
                    <button onClick={() => setDetail({ id, location: "worn" })} style={{ ...itemRowStyle, flex: 1, minWidth: 0 }}>
                      <span style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
                        {renderItemIcon(id)}
                        <span style={{ color: tierColor(codex.items[id]?.tier || "common"), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{codex.items[id]?.name || id}</span>
                      </span>
                      <Icon name="arrowLeft" size={11} color="rgba(215,167,111,0.4)" strokeWidth={2} />
                    </button>
                  ) : (
                    <span style={{ flex: 1, fontSize: "11px", fontStyle: "italic", color: "rgba(237,228,208,0.28)", padding: "6px 4px" }}>— empty —</span>
                  )}
                </div>
              ));
            })}
          </div>
        </div>

        {/* Carrying — tap an item for details / to equip. */}
        <div>
          <SectionHeader>Carrying (Pack)</SectionHeader>
          <div style={{ ...insetBoxStyle, display: "flex", flexDirection: "column", gap: "2px" }}>
            {inv.carried.length === 0
              ? <span style={{ fontSize: "12px", color: "rgba(237, 228, 208, 0.4)", fontStyle: "italic" }}>Pack is empty.</span>
              : inv.carried.map((c) => {
                  const fresh = freshnessLabel(c.freshUntil, state.time?.day || 0);
                  const fc = fresh ? (fresh.tone === "bad" ? "#fca5a5" : fresh.tone === "warn" ? "#e6a878" : "rgba(167,243,208,0.65)") : null;
                  return (
                    <button key={c.itemId} onClick={() => setDetail({ id: c.itemId, location: "carried" })} style={itemRowStyle}>
                      <span style={{ display: "flex", alignItems: "center", minWidth: 0, gap: "6px" }}>
                        {renderItemIcon(c.itemId)}
                        <span style={{ color: tierColor(codex.items[c.itemId]?.tier || "common"), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{codex.items[c.itemId]?.name || c.itemId}</span>
                        {fresh && fresh.tone !== "ok" && (
                          <span style={{ fontSize: "9px", fontStyle: "italic", color: fc, flexShrink: 0 }}>· {fresh.text}</span>
                        )}
                      </span>
                      <span style={{ color: colors.parchmentMuted, fontWeight: "bold", flexShrink: 0 }}>×{c.quantity}</span>
                    </button>
                  );
                })}
          </div>
        </div>

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
      </div>

      {detail && (
        <ItemDetail
          item={{ ...itemTemplate(detail.id), ...codex.items[detail.id] }}
          id={detail.id}
          location={detail.location}
          attrs={attrs}
          freshUntil={inv.carried.find((c) => c.itemId === detail.id)?.freshUntil}
          day={state.time?.day || 0}
          onEquip={onEquip}
          onUnequip={onUnequip}
          onUse={onUse}
          onLightTorch={onLightTorch}
          onLightLantern={onLightLantern}
          onRest={onRest}
          onBindRune={onBindRune}
          onClose={() => setDetail(null)}
        />
      )}
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
