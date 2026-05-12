import React, { useState } from "react";
import { Icon } from "./Icon.jsx";
import { iconButtonStyle } from "./primitives.jsx";
import { ATTR_KEYS, ATTR_LABELS, originLabel } from "../config.js";

const CODEX_TABS = [
  { key: "characters",  label: "Characters" },
  { key: "races",       label: "Races" },
  { key: "professions", label: "Professions" },
  { key: "items",       label: "Items" },
  { key: "spells",      label: "Spells" },
  { key: "skills",      label: "Skills" },
];

export function CodexEntry({ entry, kind, codex }) {
  const wornNames = (kind === "characters" && entry.worn?.length)
    ? entry.worn.map(id => codex.items[id]?.name || id) : [];
  const knowsList = (kind === "characters" && entry.knows?.length) ? entry.knows : [];
  const hasAttrs = kind === "characters" && entry.attributes;
  const narrativeAppearance = entry.base_appearance || (typeof entry.appearance === "string" ? entry.appearance : null);
  const structuredAppearance = kind === "characters" && entry.appearance && typeof entry.appearance === "object" ? entry.appearance : null;

  return (
    <div style={{ padding: "12px 14px", backgroundColor: "#F7F1E2", border: "1px solid #EBE5D6", borderRadius: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px", gap: "8px" }}>
        <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "17px", color: "#1A1A1A" }}>{entry.name}</div>
        <div style={{ display: "flex", gap: "6px" }}>
          {entry.common && <span style={{ fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#8B857A" }}>Baseline</span>}
          {entry.kind === "player" && <span style={{ fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#8B5A2B", fontWeight: 600 }}>You</span>}
          {kind === "skills" && typeof entry.rating === "number" && (
            <span style={{ fontSize: "10px", padding: "2px 7px", backgroundColor: "#1A1A1A", color: "#E8B98C", borderRadius: "6px", fontFamily: "'Instrument Serif', serif", fontStyle: "italic" }}>Rating {entry.rating}</span>
          )}
        </div>
      </div>

      {kind === "characters" && (entry.race || entry.profession || entry.origin) && (
        <div style={{ fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#8B857A", marginBottom: "4px" }}>
          {[
            codex.races[entry.race]?.name || entry.race,
            codex.professions[entry.profession]?.name || entry.profession,
            originLabel(entry.origin),
          ].filter(Boolean).join(" · ")}
        </div>
      )}

      {kind === "characters" && (entry.age || entry.attractiveness) && (
        <div style={{ fontSize: "11px", color: "#6B655B", marginBottom: "6px", fontFamily: "'Instrument Serif', serif", fontStyle: "italic" }}>
          {[entry.age, entry.attractiveness].filter(Boolean).join(" · ")}
        </div>
      )}

      {kind === "items" && entry.kind && (
        <div style={{ fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#8B857A", marginBottom: "6px" }}>{entry.kind}</div>
      )}

      {narrativeAppearance && (
        <div style={{ fontSize: "12px", color: "#3A3A3A", lineHeight: "1.5", marginBottom: "6px" }}>
          <span style={{ fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#8B857A", marginRight: "6px" }}>Appearance</span>
          <span style={{ fontStyle: "italic", fontFamily: "'Instrument Serif', serif", fontSize: "13px" }}>{narrativeAppearance}</span>
        </div>
      )}

      {structuredAppearance && (
        <div style={{ fontSize: "11px", color: "#6B655B", lineHeight: "1.55", marginBottom: "8px", paddingLeft: "10px", borderLeft: "1px solid #D9D2BF" }}>
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
        <div style={{ fontSize: "12px", color: "#3A3A3A", lineHeight: "1.5", marginBottom: "6px" }}>
          <span style={{ fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#8B857A", marginRight: "6px" }}>Wearing</span>
          <span style={{ fontStyle: "italic", fontFamily: "'Instrument Serif', serif", fontSize: "13px" }}>{wornNames.join(", ")}</span>
        </div>
      )}

      {hasAttrs && (
        <div style={{ marginBottom: "6px", paddingTop: "6px", borderTop: "1px dashed #D9D2BF" }}>
          <div style={{ fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#8B857A", marginBottom: "4px", fontWeight: 600 }}>Attributes</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px", fontSize: "11px", color: "#3A3A3A" }}>
            {ATTR_KEYS.map(k => (
              <div key={k}>
                <span style={{ color: "#8B857A" }}>{ATTR_LABELS[k]}</span>{" "}
                <span style={{ fontWeight: 600 }}>{entry.attributes[k] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {entry.description && (
        <div style={{ fontSize: "13px", color: "#3A3A3A", lineHeight: "1.5", marginBottom: knowsList.length ? "10px" : 0 }}>{entry.description}</div>
      )}

      {kind === "spells" && entry.acquisition && (
        <div style={{ fontSize: "11px", color: "#8B857A", marginTop: "4px", fontStyle: "italic" }}>Acquired: {entry.acquisition}</div>
      )}

      {knowsList.length > 0 && (
        <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px dashed #D9D2BF" }}>
          <div style={{ fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#8B857A", marginBottom: "4px", fontWeight: 600 }}>Knows</div>
          <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "12px", color: "#3A3A3A", lineHeight: "1.5" }}>
            {knowsList.map((f, i) => (
              <li key={i} style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", marginBottom: "2px" }}>{f}</li>
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
    <div style={{ position: "absolute", inset: 0, backgroundColor: "#FBF8F2", zIndex: 30, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 14px) 20px 12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #EBE5D6" }}>
        <button onClick={onClose} style={iconButtonStyle}>
          <Icon name="arrowLeft" size={15} color="#1A1A1A" strokeWidth={1.5} />
        </button>
        <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: "20px", fontStyle: "italic", color: "#1A1A1A" }}>Codex</div>
        <div style={{ width: "34px" }} />
      </div>
      <div className="tabstrip" style={{ display: "flex", overflowX: "auto", borderBottom: "1px solid #EBE5D6", backgroundColor: "#F4EFE3", padding: "6px 12px", gap: "4px" }}>
        {CODEX_TABS.map((tab) => {
          const count = Object.keys(codex[tab.key] || {}).length;
          const active = tab.key === activeTab;
          return (
            <button
              key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{ padding: "8px 14px", borderRadius: "16px", border: "1px solid", borderColor: active ? "#1A1A1A" : "transparent", backgroundColor: active ? "#1A1A1A" : "transparent", color: active ? "#FBF8F2" : "#1A1A1A", fontSize: "12px", fontWeight: 500, whiteSpace: "nowrap", cursor: "pointer", flexShrink: 0 }}
            >
              {tab.label}{count > 0 ? ` · ${count}` : ""}
            </button>
          );
        })}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px calc(env(safe-area-inset-bottom, 0px) + 24px) 20px" }}>
        {entries.length === 0 ? (
          <div style={{ marginTop: "60px", textAlign: "center", fontFamily: "'Instrument Serif', serif", fontStyle: "italic", color: "#8B857A", fontSize: "15px", lineHeight: "1.6", padding: "0 24px" }}>
            Nothing recorded here yet.<br />
            <span style={{ fontSize: "12px" }}>Discover by playing.</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {entries.map((e) => <CodexEntry key={e.id} entry={e} kind={activeTab} codex={codex} />)}
          </div>
        )}
      </div>
    </div>
  );
}
