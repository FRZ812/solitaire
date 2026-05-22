import React from "react";
import { Icon } from "./Icon.jsx";
import { iconButtonStyle, Panel, SectionHeader } from "./primitives.jsx";
import { colors, radius, fonts, metaStyle } from "./tokens.js";
import { ATTR_KEYS, ATTR_LABELS } from "../config.js";
import { partyMembers } from "../engine/party.js";
import { relationshipTier } from "../engine/relationships.js";

// The party roster: every recruited companion as a full person — appearance,
// attributes, gear, and what they know — with the option to part ways.
export function PartyView({ state, onDismiss, onClose }) {
  const members = partyMembers(state);
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 30,
      backgroundColor: "#0d1312",
      display: "flex", flexDirection: "column",
      maxWidth: "480px", margin: "0 auto",
      borderLeft: "1px solid rgba(215, 167, 111, 0.12)",
      borderRight: "1px solid rgba(215, 167, 111, 0.12)",
      boxShadow: "0 0 50px rgba(0,0,0,0.9)",
    }}>
      <div style={{
        padding: "calc(env(safe-area-inset-top, 0px) + 14px) 16px 12px 16px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: "1px solid rgba(215, 167, 111, 0.15)",
        backgroundColor: "rgba(20, 29, 29, 0.95)",
      }}>
        <button onClick={onClose} aria-label="Close" style={{
          ...iconButtonStyle, width: "30px", height: "30px", borderRadius: "50%",
          backgroundColor: "rgba(215, 167, 111, 0.08)", border: "1px solid rgba(215, 167, 111, 0.2)",
        }}>
          <Icon name="arrowLeft" size={13} color="#e6b98c" strokeWidth={2} />
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "22px", color: colors.parchmentLight }}>Your Company</div>
          <div style={{ ...metaStyle, fontSize: "9px", letterSpacing: "0.16em", color: "rgba(215, 167, 111, 0.78)", marginTop: "3px" }}>
            {members.length === 0 ? "Travelling alone" : `${members.length} companion${members.length === 1 ? "" : "s"}`}
          </div>
        </div>
        <div style={{ width: "30px" }} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 16px", WebkitOverflowScrolling: "touch" }}>
        {members.length === 0 ? (
          <div style={{ padding: "28px 8px", textAlign: "center", fontStyle: "italic", fontSize: "13px", color: "rgba(237,228,208,0.5)", lineHeight: 1.5 }}>
            You travel alone. Folk looking for a road to walk gather at taverns — find the quest board and see who's willing.
          </div>
        ) : members.map((c) => (
          <Panel key={c.id} tone="default" style={{ marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "19px", color: colors.parchmentLight, lineHeight: 1.1 }}>{c.name}</div>
                <div style={{ ...metaStyle, fontSize: "8px", color: colors.parchmentMuted, marginTop: "3px" }}>{c.race} · {c.profession}</div>
                {(() => { const t = relationshipTier(c.relationship || 0); return (
                  <span style={{ display: "inline-block", marginTop: "5px", fontSize: "9px", fontWeight: 800, letterSpacing: "0.04em", padding: "2px 8px", borderRadius: radius.pill, color: t.color, border: `1px solid ${t.color}55`, backgroundColor: `${t.color}14` }}>
                    {t.label} · {(c.relationship || 0) > 0 ? "+" : ""}{c.relationship || 0}
                  </span>
                ); })()}
              </div>
              <button onClick={() => onDismiss(c.id)} style={{
                padding: "6px 12px", borderRadius: radius.pill, flexShrink: 0,
                border: "1px solid rgba(215,167,111,0.3)", backgroundColor: "transparent",
                color: "rgba(215,167,111,0.8)", fontSize: "11px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
              }}>Part ways</button>
            </div>

            <div style={{ fontSize: "12px", fontStyle: "italic", color: "rgba(237,228,208,0.7)", lineHeight: 1.45, margin: "8px 0" }}>{c.base_appearance}</div>
            <div style={{ fontSize: "12px", color: colors.parchment, lineHeight: 1.45, marginBottom: "10px" }}>{c.description}</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "4px", marginBottom: "8px" }}>
              {ATTR_KEYS.map((k) => (
                <div key={k} style={{ textAlign: "center", padding: "5px 2px", borderRadius: radius.chip, backgroundColor: "rgba(20,29,29,0.5)", border: "1px solid rgba(215,167,111,0.14)" }}>
                  <div style={{ ...metaStyle, fontSize: "7px", color: colors.gold }}>{ATTR_LABELS[k].slice(0, 3)}</div>
                  <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "16px", color: colors.parchment }}>{c.attributes?.[k] ?? 0}</div>
                </div>
              ))}
            </div>

            {(c.worn?.length > 0) && (
              <div style={{ fontSize: "11px", color: "rgba(237,228,208,0.6)", lineHeight: 1.4 }}>
                <span style={{ ...metaStyle, fontSize: "8px", color: colors.parchmentMuted }}>Carries </span>
                {c.worn.map((w) => w.replace(/-/g, " ")).join(", ")}
              </div>
            )}
            {(c.memories?.length > 0) && (
              <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px dashed rgba(215,167,111,0.2)" }}>
                <div style={{ ...metaStyle, fontSize: "8px", color: colors.gold, marginBottom: "5px" }}>Shared history</div>
                <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "12px", color: colors.parchment, lineHeight: 1.5 }}>
                  {c.memories.slice(-8).map((m, i) => (
                    <li key={i} style={{ fontFamily: fonts.serif, fontStyle: "italic", marginBottom: "2px", color: colors.parchmentLight }}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
        ))}
      </div>
    </div>
  );
}
