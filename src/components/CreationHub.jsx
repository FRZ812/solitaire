import React, { useState } from "react";
import { Icon } from "./Icon.jsx";
import { colors, radius, fonts } from "./tokens.js";
import { CHARACTER_TEMPLATES, STANDARD_PROVISIONS } from "../data/templates.js";

// The first thing a fresh soul sees in limbo: choose a ready-made life (a
// template — pick and play) or step into the freeform interview to author your
// own. A quiet "Leave" sends you back to the campaigns list so you're never
// trapped here.
export function CreationHub({ onPickTemplate, onCustom, onQuit, busy }) {
  const [name, setName] = useState("");

  const begin = (tmpl) => {
    if (busy) return;
    const finalName = name.trim() || tmpl.setup.name;
    // A ready-made life still gets the everyday traveller's kit, like any new soul.
    const have = new Set((tmpl.setup.items || []).map((i) => i.itemId));
    const provisions = STANDARD_PROVISIONS.filter((p) => !have.has(p.itemId)).map((p) => ({ itemId: p.itemId, quantity: p.quantity, worn: false }));
    onPickTemplate({ ...tmpl.setup, name: finalName, items: [...(tmpl.setup.items || []), ...provisions] });
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 60, display: "flex", flexDirection: "column",
      background: "radial-gradient(120% 90% at 50% 0%, rgba(28,36,40,0.96), rgba(8,11,12,0.99))",
      overflowY: "auto", WebkitOverflowScrolling: "touch",
    }}>
      <div style={{ width: "100%", maxWidth: "640px", margin: "0 auto", padding: "20px 18px 40px", flex: 1 }}>
        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
          <div>
            <div style={{ fontSize: "9px", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(215,167,111,0.6)", fontWeight: 800 }}>The threshold</div>
            <h1 style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "30px", color: colors.parchmentLight, margin: "2px 0 0" }}>Who will you be?</h1>
          </div>
          <button onClick={onQuit} disabled={busy} style={{
            display: "flex", alignItems: "center", gap: "5px", padding: "8px 12px", borderRadius: radius.chip,
            backgroundColor: "rgba(20,29,29,0.6)", border: `1px solid rgba(215,167,111,0.3)`, color: "rgba(215,167,111,0.85)",
            fontSize: "12px", fontWeight: 700, cursor: busy ? "default" : "pointer", fontFamily: "inherit", flexShrink: 0,
          }}>
            <Icon name="arrowLeft" size={13} color="rgba(215,167,111,0.85)" strokeWidth={2} /> Leave
          </button>
        </div>
        <p style={{ fontSize: "13px", color: "rgba(237,228,208,0.7)", lineHeight: 1.5, margin: "8px 0 18px" }}>
          Pick a ready-made life to begin at once, or step into the limbo to shape your own from nothing.
        </p>

        {/* shared name */}
        <div style={{ marginBottom: "18px" }}>
          <label style={{ fontSize: "9px", letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(215,167,111,0.6)", fontWeight: 800 }}>Name <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400, color: "rgba(215,167,111,0.4)" }}>· optional</span></label>
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Leave blank to take the template's name"
            style={{
              width: "100%", marginTop: "5px", height: "42px", borderRadius: radius.control,
              border: `1px solid rgba(215,167,111,0.3)`, backgroundColor: "rgba(10,15,15,0.6)",
              padding: "0 14px", fontSize: "14px", color: colors.parchment, outline: "none", fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* templates */}
        <div style={{ fontSize: "9px", letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(215,167,111,0.6)", fontWeight: 800, marginBottom: "10px" }}>Ready-made lives <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400, color: "rgba(215,167,111,0.45)" }}>· a party needs one of each</span></div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {CHARACTER_TEMPLATES.map((t) => (
            <div key={t.id} style={{
              display: "flex", flexDirection: "column", padding: "14px", borderRadius: radius.panelCompact,
              backgroundColor: "rgba(20,29,29,0.55)", border: `1px solid rgba(215,167,111,0.22)`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "7px" }}>
                <div style={{
                  width: "32px", height: "32px", borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  backgroundColor: "rgba(215,167,111,0.12)", border: `1px solid rgba(215,167,111,0.3)`,
                }}>
                  <Icon name={t.icon} size={17} color={colors.gold} strokeWidth={1.8} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "19px", color: colors.parchmentLight, lineHeight: 1.1 }}>{t.label}</div>
                  <div style={{ fontSize: "11px", color: "rgba(237,228,208,0.6)", marginTop: "1px" }}>{t.concept}</div>
                </div>
                <span style={{
                  flexShrink: 0, fontSize: "9px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase",
                  padding: "4px 9px", borderRadius: radius.pill, color: colors.ink, backgroundColor: colors.gold,
                }}>{t.role}</span>
              </div>
              <div style={{ fontSize: "12px", color: "rgba(237,228,208,0.75)", lineHeight: 1.5, marginBottom: "9px", fontStyle: "italic" }}>{t.story}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "11px" }}>
                {t.highlights.map((h) => (
                  <span key={h} style={{
                    fontSize: "9px", fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase",
                    padding: "2px 7px", borderRadius: radius.pill, color: colors.gold,
                    backgroundColor: "rgba(215,167,111,0.1)", border: `1px solid rgba(215,167,111,0.25)`,
                  }}>{h}</span>
                ))}
              </div>
              <button onClick={() => begin(t)} disabled={busy} style={{
                width: "100%", padding: "10px", borderRadius: radius.panelCompact,
                backgroundColor: colors.gold, color: colors.ink, border: "none",
                fontSize: "13px", fontWeight: 800, cursor: busy ? "default" : "pointer", fontFamily: "inherit", opacity: busy ? 0.5 : 1,
              }}>Begin as {(name.trim() || t.setup.name)}</button>
            </div>
          ))}
        </div>

        {/* custom / limbo */}
        <div style={{ marginTop: "20px", padding: "15px", borderRadius: radius.panelCompact, backgroundColor: "rgba(176,114,230,0.08)", border: `1px solid rgba(176,114,230,0.32)` }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
            <Icon name="sparkle" size={16} color="#c9a6ef" strokeWidth={1.8} />
            <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "18px", color: "#d9c2f2" }}>Create your own</div>
          </div>
          <div style={{ fontSize: "12px", color: "rgba(237,228,208,0.72)", lineHeight: 1.5, marginBottom: "11px" }}>
            Step into the limbo and shape every detail in conversation — or type the expert token there to open the full manual builder.
          </div>
          <button onClick={() => !busy && onCustom()} disabled={busy} style={{
            width: "100%", padding: "11px", borderRadius: radius.panelCompact,
            backgroundColor: "rgba(176,114,230,0.16)", color: "#d9c2f2", border: `1px solid rgba(176,114,230,0.45)`,
            fontSize: "13px", fontWeight: 800, cursor: busy ? "default" : "pointer", fontFamily: "inherit", opacity: busy ? 0.5 : 1,
          }}>Enter the limbo</button>
        </div>
      </div>
    </div>
  );
}
