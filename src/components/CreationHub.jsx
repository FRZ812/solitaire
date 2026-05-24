import React, { useState } from "react";
import { Icon } from "./Icon.jsx";
import { colors, radius, fonts } from "./tokens.js";
import { ATTR_KEYS, ATTR_LABELS, originLabel } from "../config.js";
import { RACES } from "../data/races.js";
import { itemTemplate } from "../data/catalog.js";
import { getAbilityDef } from "../data/abilities.js";
import { tierColor, tierLabel } from "../data/tiers.js";
import { CHARACTER_TEMPLATES, STANDARD_PROVISIONS } from "../data/templates.js";

const isHumanRace = (r) => r === "human";
function kindredLabel(setup) {
  const r = RACES[setup.race];
  if (setup.subrace && r?.subraces?.[setup.subrace]) return r.subraces[setup.subrace].name;
  return r?.name || setup.race;
}
function metaLine(setup) {
  return [kindredLabel(setup), isHumanRace(setup.race) ? originLabel(setup.origin) : null, setup.age].filter(Boolean).join(" · ");
}

const tagPill = {
  fontSize: "9px", fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase",
  padding: "2px 7px", borderRadius: radius.pill, color: colors.gold,
  backgroundColor: "rgba(215,167,111,0.1)", border: `1px solid rgba(215,167,111,0.25)`,
};
const metaHead = { fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(215,167,111,0.6)", fontWeight: 800, marginBottom: "5px" };

// The full sheet shown when a template is tapped — players meet the character
// (look, story, stats, kit) before committing to begin as them.
function TemplateDetail({ tmpl, finalName, onConfirm, onBack, busy }) {
  const s = tmpl.setup;
  const appr = s.appearance || {};
  const apprChips = ["skin", "hair", "eyes", "build", "facial_hair", "marks"].map((k) => appr[k]).filter(Boolean);
  const worn = (s.items || []).filter((i) => i.worn).map((i) => itemTemplate(i.itemId)?.name || i.itemId);
  const packed = (s.items || []).filter((i) => !i.worn).map((i) => `${i.quantity > 1 ? `${i.quantity}× ` : ""}${itemTemplate(i.itemId)?.name || i.itemId}`);
  const coinStr = [s.coins?.gold && `${s.coins.gold}g`, s.coins?.silver && `${s.coins.silver}s`, s.coins?.copper && `${s.coins.copper}c`].filter(Boolean).join(" ");

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "radial-gradient(120% 90% at 50% 0%, rgba(28,36,40,0.98), rgba(8,11,12,0.995))", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ width: "100%", maxWidth: "640px", margin: "0 auto", padding: "18px 18px 36px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
          <button onClick={onBack} disabled={busy} style={{ display: "flex", alignItems: "center", gap: "4px", padding: "8px 11px", borderRadius: radius.chip, backgroundColor: "rgba(20,29,29,0.6)", border: `1px solid rgba(215,167,111,0.3)`, color: "rgba(215,167,111,0.85)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            <Icon name="arrowLeft" size={13} color="rgba(215,167,111,0.85)" strokeWidth={2} /> Back
          </button>
          <div style={{ flex: 1 }} />
          <span style={{ ...tagPill, color: colors.ink, backgroundColor: colors.gold, fontSize: "10px", padding: "4px 10px" }}>{tmpl.role}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "3px" }}>
          <Icon name={tmpl.icon} size={22} color={colors.gold} strokeWidth={1.8} />
          <h1 style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "28px", color: colors.parchmentLight, margin: 0 }}>{finalName}</h1>
        </div>
        <div style={{ fontSize: "12px", color: "rgba(215,167,111,0.85)", marginBottom: "14px" }}>{metaLine(s)} · {tmpl.label}</div>

        <div style={{ fontSize: "13px", color: "rgba(237,228,208,0.82)", lineHeight: 1.55, fontStyle: "italic", marginBottom: "16px" }}>{s.story}</div>

        <Section title="Appearance">
          <div style={{ fontSize: "12.5px", color: "rgba(237,228,208,0.85)", lineHeight: 1.5, marginBottom: apprChips.length ? "7px" : 0 }}>{s.base_appearance}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
            {apprChips.map((c, i) => <span key={i} style={{ ...tagPill, color: "rgba(237,228,208,0.85)", backgroundColor: "rgba(20,29,29,0.6)", border: `1px solid rgba(215,167,111,0.2)`, textTransform: "none", letterSpacing: 0, fontWeight: 600 }}>{c}</span>)}
          </div>
        </Section>

        <Section title="Drive">
          <div style={{ fontSize: "13px", color: colors.parchmentLight, fontFamily: fonts.serif, fontStyle: "italic", lineHeight: 1.4 }}>“{s.bond}”</div>
        </Section>

        <Section title="Attributes">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
            {ATTR_KEYS.map((k) => {
              const hot = tmpl.highlights.includes(ATTR_LABELS[k]);
              return (
                <div key={k} style={{ padding: "7px 8px", borderRadius: radius.chip, textAlign: "center", backgroundColor: hot ? "rgba(215,167,111,0.14)" : "rgba(20,29,29,0.5)", border: `1px solid ${hot ? "rgba(215,167,111,0.45)" : "rgba(215,167,111,0.16)"}` }}>
                  <div style={{ fontSize: "8px", letterSpacing: "0.1em", textTransform: "uppercase", color: colors.gold, fontWeight: 800 }}>{ATTR_LABELS[k]}</div>
                  <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "20px", color: colors.parchment, lineHeight: 1.1 }}>{s.attributes[k]}</div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="Abilities">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {(s.abilities || []).map((a) => (
              <span key={a.id} style={{ ...tagPill, textTransform: "none", letterSpacing: 0, color: colors.parchmentLight, backgroundColor: "rgba(20,29,29,0.6)", border: `1px solid rgba(215,167,111,0.22)` }}>
                {getAbilityDef(a.id)?.name || a.id} <span style={{ color: tierColor(a.tier), fontWeight: 800 }}>{tierLabel(a.tier)}</span>
              </span>
            ))}
          </div>
        </Section>

        <Section title="Gear">
          {worn.length > 0 && <div style={{ fontSize: "12px", color: "rgba(237,228,208,0.85)", lineHeight: 1.5 }}><span style={{ color: "rgba(215,167,111,0.6)" }}>Worn — </span>{worn.join(", ")}</div>}
          {packed.length > 0 && <div style={{ fontSize: "12px", color: "rgba(237,228,208,0.85)", lineHeight: 1.5, marginTop: "3px" }}><span style={{ color: "rgba(215,167,111,0.6)" }}>Packed — </span>{packed.join(", ")}</div>}
          <div style={{ fontSize: "11px", color: "rgba(237,228,208,0.5)", marginTop: "4px" }}>+ standard provisions{coinStr ? ` · ${coinStr}` : ""}</div>
        </Section>

        <button onClick={() => !busy && onConfirm()} disabled={busy} style={{
          width: "100%", marginTop: "18px", padding: "13px", borderRadius: radius.control, border: "none",
          backgroundColor: colors.gold, color: colors.ink, fontSize: "14px", fontWeight: 800,
          cursor: busy ? "default" : "pointer", fontFamily: "inherit", opacity: busy ? 0.6 : 1,
        }}>{busy ? "Drawing them into the world…" : `Begin as ${finalName}`}</button>
      </div>
    </div>
  );
}

const Section = ({ title, children }) => (
  <div style={{ marginBottom: "14px" }}>
    <div style={metaHead}>{title}</div>
    {children}
  </div>
);

// The first thing a fresh soul sees in limbo: choose a ready-made life (tap a
// card to meet them in full, then begin) or step into the freeform interview to
// author your own. "Leave" returns to the campaigns list so you're never stuck.
export function CreationHub({ onPickTemplate, onCustom, onQuit, busy }) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState(null); // template being previewed

  const finalNameFor = (tmpl) => name.trim() || tmpl.setup.name;
  const begin = (tmpl) => {
    if (busy) return;
    const have = new Set((tmpl.setup.items || []).map((i) => i.itemId));
    const provisions = STANDARD_PROVISIONS.filter((p) => !have.has(p.itemId)).map((p) => ({ itemId: p.itemId, quantity: p.quantity, worn: false }));
    onPickTemplate({ ...tmpl.setup, name: finalNameFor(tmpl), items: [...(tmpl.setup.items || []), ...provisions] });
  };

  if (selected) {
    return <TemplateDetail tmpl={selected} finalName={finalNameFor(selected)} onConfirm={() => begin(selected)} onBack={() => setSelected(null)} busy={busy} />;
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 60, display: "flex", flexDirection: "column",
      background: "radial-gradient(120% 90% at 50% 0%, rgba(28,36,40,0.96), rgba(8,11,12,0.99))",
      overflowY: "auto", WebkitOverflowScrolling: "touch",
    }}>
      <div style={{ width: "100%", maxWidth: "640px", margin: "0 auto", padding: "20px 18px 40px", flex: 1 }}>
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
          Tap a ready-made life to meet them in full, then begin — or step into the limbo to shape your own from nothing.
        </p>

        <div style={{ marginBottom: "18px" }}>
          <label style={{ fontSize: "9px", letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(215,167,111,0.6)", fontWeight: 800 }}>Name <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400, color: "rgba(215,167,111,0.4)" }}>· optional override</span></label>
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Leave blank to keep the template's name"
            style={{
              width: "100%", marginTop: "5px", height: "42px", borderRadius: radius.control,
              border: `1px solid rgba(215,167,111,0.3)`, backgroundColor: "rgba(10,15,15,0.6)",
              padding: "0 14px", fontSize: "14px", color: colors.parchment, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ fontSize: "9px", letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(215,167,111,0.6)", fontWeight: 800, marginBottom: "10px" }}>Ready-made lives <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400, color: "rgba(215,167,111,0.45)" }}>· a party needs one of each</span></div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {CHARACTER_TEMPLATES.map((t) => (
            <button key={t.id} onClick={() => setSelected(t)} disabled={busy} style={{
              display: "flex", flexDirection: "column", padding: "14px", borderRadius: radius.panelCompact, textAlign: "left",
              backgroundColor: "rgba(20,29,29,0.55)", border: `1px solid rgba(215,167,111,0.22)`, cursor: busy ? "default" : "pointer", fontFamily: "inherit",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "6px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(215,167,111,0.12)", border: `1px solid rgba(215,167,111,0.3)` }}>
                  <Icon name={t.icon} size={17} color={colors.gold} strokeWidth={1.8} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "19px", color: colors.parchmentLight, lineHeight: 1.1 }}>{finalNameFor(t)}</div>
                  <div style={{ fontSize: "10.5px", color: "rgba(215,167,111,0.7)", marginTop: "1px" }}>{metaLine(t.setup)}</div>
                </div>
                <span style={{ ...tagPill, flexShrink: 0, color: colors.ink, backgroundColor: colors.gold, padding: "4px 9px" }}>{t.role}</span>
              </div>
              <div style={{ fontSize: "12px", color: "rgba(237,228,208,0.72)", lineHeight: 1.45, marginBottom: "8px" }}>{t.concept}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {t.highlights.map((h) => <span key={h} style={tagPill}>{h}</span>)}
                </div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "rgba(215,167,111,0.7)" }}>View ›</span>
              </div>
            </button>
          ))}
        </div>

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
