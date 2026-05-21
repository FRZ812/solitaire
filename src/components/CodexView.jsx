import React, { useState } from "react";
import { Icon } from "./Icon.jsx";
import { iconButtonStyle } from "./primitives.jsx";
import { colors, shadow, radius, fonts, metaStyle } from "./tokens.js";
import { ATTR_KEYS, ATTR_LABELS, originLabel } from "../config.js";

const CODEX_TABS = [
  { key: "characters",  label: "Characters" },
  { key: "races",       label: "Races" },
  { key: "professions", label: "Professions" },
  { key: "items",       label: "Items" },
  { key: "spells",      label: "Spells" },
  { key: "skills",      label: "Skills" },
];

// Reusable styles inside this view.
const subtleMeta = {
  ...metaStyle,
  fontSize: "9px",
  letterSpacing: "0.10em",
  color: "rgba(215, 167, 111, 0.6)",
  fontWeight: 700,
};
const accentMeta = {
  ...metaStyle,
  fontSize: "9px",
  letterSpacing: "0.14em",
  color: colors.parchmentMuted,
  fontWeight: 700,
};
const serifInlineValue = {
  fontStyle: "italic",
  fontFamily: fonts.serif,
  fontSize: "14px",
  color: colors.parchmentLight,
};

export function CodexEntry({ entry, kind, codex }) {
  const wornNames = (kind === "characters" && entry.worn?.length)
    ? entry.worn.map(id => codex.items[id]?.name || id) : [];
  const knowsList = (kind === "characters" && entry.knows?.length) ? entry.knows : [];
  const hasAttrs = kind === "characters" && entry.attributes;
  const narrativeAppearance = entry.base_appearance || (typeof entry.appearance === "string" ? entry.appearance : null);
  const structuredAppearance = kind === "characters" && entry.appearance && typeof entry.appearance === "object" ? entry.appearance : null;

  return (
    <div style={{
      padding: "14px 16px",
      backgroundColor: "rgba(20, 29, 29, 0.75)",
      backdropFilter: "blur(12px)",
      border: `1px solid rgba(215, 167, 111, 0.18)`,
      borderRadius: radius.control,
      boxShadow: shadow.cardDeep,
      color: colors.parchment,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px", gap: "8px" }}>
        <div style={{
          fontFamily: fonts.serif, fontStyle: "italic",
          fontSize: "20px", color: colors.parchmentLight,
          textShadow: "0 1px 4px rgba(0,0,0,0.25)",
        }}>
          {entry.name}
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          {entry.common && <span style={{ ...subtleMeta, fontSize: "8px", letterSpacing: "0.12em" }}>Baseline</span>}
          {entry.kind === "player" && <span style={{ ...accentMeta, fontSize: "8px" }}>You</span>}
          {kind === "skills" && typeof entry.rating === "number" && (
            <span style={{
              fontSize: "10px", padding: "2px 8px",
              backgroundColor: "rgba(215, 167, 111, 0.15)",
              color: colors.parchmentLight,
              border: `1px solid rgba(215, 167, 111, 0.3)`,
              borderRadius: "8px",
              fontFamily: fonts.serif, fontStyle: "italic",
            }}>
              Rating {entry.rating}
            </span>
          )}
        </div>
      </div>

      {kind === "characters" && (entry.race || entry.profession || entry.origin) && (
        <div style={{ ...accentMeta, fontSize: "9px", letterSpacing: "0.10em", marginBottom: "6px" }}>
          {[
            codex.races[entry.race]?.name || entry.race,
            codex.professions[entry.profession]?.name || entry.profession,
            originLabel(entry.origin),
          ].filter(Boolean).join(" · ")}
        </div>
      )}

      {kind === "characters" && (entry.age || entry.attractiveness) && (
        <div style={{ fontSize: "12px", color: "rgba(215, 167, 111, 0.7)", marginBottom: "8px", fontFamily: fonts.serif, fontStyle: "italic" }}>
          {[entry.age, entry.attractiveness].filter(Boolean).join(" · ")}
        </div>
      )}

      {kind === "items" && entry.kind && (
        <div style={{ ...accentMeta, fontSize: "9px", letterSpacing: "0.10em", marginBottom: "6px" }}>{entry.kind}</div>
      )}

      {narrativeAppearance && (
        <div style={{ fontSize: "12px", color: colors.parchment, lineHeight: "1.5", marginBottom: "8px" }}>
          <span style={{ ...subtleMeta, marginRight: "6px" }}>Appearance</span>
          <span style={serifInlineValue}>{narrativeAppearance}</span>
        </div>
      )}

      {structuredAppearance && (
        <div style={{
          fontSize: "11px", color: "rgba(237, 228, 208, 0.75)",
          lineHeight: "1.55", marginBottom: "8px",
          paddingLeft: "10px", borderLeft: `1px solid rgba(215, 167, 111, 0.25)`,
        }}>
          {[
            structuredAppearance.skin && `Skin: ${structuredAppearance.skin}`,
            structuredAppearance.hair && `Hair: ${structuredAppearance.hair}`,
            structuredAppearance.eyes && `Eyes: ${structuredAppearance.eyes}`,
            structuredAppearance.build && `Build: ${structuredAppearance.build}`,
            structuredAppearance.facial_hair && `Beard: ${structuredAppearance.facial_hair}`,
            structuredAppearance.marks && `Marks: ${structuredAppearance.marks}`,
          ].filter(Boolean).join(" · ")}
        </div>
      )}

      {kind === "characters" && wornNames.length > 0 && (
        <div style={{ fontSize: "12px", color: colors.parchment, lineHeight: "1.5", marginBottom: "8px" }}>
          <span style={{ ...subtleMeta, marginRight: "6px" }}>Wearing</span>
          <span style={serifInlineValue}>{wornNames.join(", ")}</span>
        </div>
      )}

      {hasAttrs && (
        <div style={{ marginBottom: "8px", paddingTop: "8px", borderTop: `1px dashed rgba(215, 167, 111, 0.2)` }}>
          <div style={{ ...accentMeta, marginBottom: "6px", fontWeight: 600 }}>Attributes</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", fontSize: "12px", color: colors.parchment }}>
            {ATTR_KEYS.map(k => (
              <div key={k}>
                <span style={{ color: "rgba(215, 167, 111, 0.6)" }}>{ATTR_LABELS[k]}</span>{" "}
                <span style={{ fontWeight: 600, color: colors.parchmentLight }}>{entry.attributes[k] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {entry.description && (
        <div style={{ fontSize: "13px", color: "rgba(237, 228, 208, 0.88)", lineHeight: "1.5", marginBottom: knowsList.length ? "10px" : 0 }}>{entry.description}</div>
      )}

      {kind === "spells" && entry.acquisition && (
        <div style={{ fontSize: "11px", color: "rgba(215, 167, 111, 0.6)", marginTop: "4px", fontStyle: "italic" }}>Acquired: {entry.acquisition}</div>
      )}

      {knowsList.length > 0 && (
        <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: `1px dashed rgba(215, 167, 111, 0.2)` }}>
          <div style={{ ...accentMeta, marginBottom: "6px", fontWeight: 600 }}>Knows</div>
          <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "13px", color: colors.parchment, lineHeight: "1.5" }}>
            {knowsList.map((f, i) => (
              <li key={i} style={{ fontFamily: fonts.serif, fontStyle: "italic", marginBottom: "2px", color: colors.parchmentLight }}>{f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function CodexView({ state, onClose }) {
  const codex = state.world.codex;
  const [activeTab, setActiveTab] = useState("characters");
  const entries = Object.values(codex[activeTab] || {});

  return (
    <div style={{ position: "absolute", inset: 0, backgroundColor: "#0b0f0e", zIndex: 30, display: "flex", flexDirection: "column" }}>
      <div style={{
        padding: "calc(env(safe-area-inset-top, 0px) + 14px) 16px 12px 16px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: `1px solid rgba(215, 167, 111, 0.15)`,
        backgroundColor: "rgba(20, 29, 29, 0.95)",
      }}>
        <button
          onClick={onClose}
          style={{
            ...iconButtonStyle,
            width: "30px", height: "30px",
            backgroundColor: "rgba(215, 167, 111, 0.08)",
            border: `1px solid rgba(215, 167, 111, 0.2)`,
          }}
        >
          <Icon name="arrowLeft" size={13} color={colors.parchmentMuted} strokeWidth={2} />
        </button>
        <div style={{ fontFamily: fonts.serif, fontSize: "24px", fontStyle: "italic", color: colors.parchmentLight }}>Lore Codex</div>
        <div style={{ width: "30px" }} />
      </div>

      <div className="tabstrip" style={{ display: "flex", overflowX: "auto", borderBottom: `1px solid rgba(215, 167, 111, 0.12)`, backgroundColor: "rgba(20, 29, 29, 0.95)", padding: "8px 12px", gap: "6px" }}>
        {CODEX_TABS.map((tab) => {
          const count = Object.keys(codex[tab.key] || {}).length;
          const active = tab.key === activeTab;
          return (
            <button
              key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "8px 14px",
                borderRadius: radius.panelCompact,
                border: "1px solid",
                borderColor: active ? `rgba(215, 167, 111, 0.45)` : `rgba(215, 167, 111, 0.08)`,
                backgroundColor: active ? "rgba(215, 167, 111, 0.12)" : "rgba(10, 15, 15, 0.4)",
                color: active ? colors.parchmentLight : "rgba(215, 167, 111, 0.55)",
                textShadow: active ? "0 0 8px rgba(215, 167, 111, 0.4)" : "none",
                fontSize: "12px", fontWeight: 700,
                whiteSpace: "nowrap", cursor: "pointer", flexShrink: 0,
                transition: "all 0.2s",
              }}
            >
              {tab.label}{count > 0 ? ` · ${count}` : ""}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px calc(env(safe-area-inset-bottom, 0px) + 24px) 14px", background: "linear-gradient(180deg, #111716 0%, #0b0f0e 100%)" }}>
        {entries.length === 0 ? (
          <div style={{ marginTop: "80px", textAlign: "center", fontFamily: fonts.serif, fontStyle: "italic", color: "rgba(215, 167, 111, 0.45)", fontSize: "16px", lineHeight: "1.6", padding: "0 24px" }}>
            Nothing recorded here yet.<br />
            <span style={{ fontSize: "13px", color: "rgba(215, 167, 111, 0.3)" }}>Discover lore by wandering the realm.</span>
          </div>
        ) : (
          <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {entries.map((e) => <CodexEntry key={e.id} entry={e} kind={activeTab} codex={codex} />)}
          </div>
        )}
      </div>
    </div>
  );
}
