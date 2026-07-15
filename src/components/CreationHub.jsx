import React, { useState } from "react";
import { Icon } from "./Icon.jsx";
import { colors, radius, fonts } from "./tokens.js";
import { ATTR_KEYS, ATTR_LABELS, originLabel } from "../config.js";
import { RACES } from "../data/races.js";
import { itemTemplate } from "../data/catalog.js";
import { getAbilityDef, abilityStatLine, abilityReqLine } from "../data/abilities.js";
import { itemCombatStats, itemRequirement } from "../engine/combat-stats.js";
import { tierColor, tierLabel } from "../data/tiers.js";
import { CHARACTER_TEMPLATES, STANDARD_PROVISIONS } from "../data/templates.js";
import { InfoModal } from "./InfoTip.jsx";
import { AttributeDetail } from "./AttributeDetail.jsx";

const isHumanRace = (r) => r === "human";

// Power rungs for the pick-and-play roster: [tier, heading, blurb, accent hue].
// Standard is the intended start; everything above begins you already powerful.
const TEMPLATE_TIERS = [
  ["standard",  "Standard",  "an ordinary life — the Mire bites",          "#c9a26a"],
  ["mid",       "Veteran",   "road-tested and capable",                    "#7fb88a"],
  ["epic",      "Champion",  "a serious power — a softer, faster game",    "#b072e6"],
  ["legendary", "Legend",    "renowned across the land",                   "#e0913f"],
  ["mythical",  "Mythic",    "near-divine — the early world cannot hold you", "#54c7c7"],
  ["divine",    "Divine",    "a god walks the world — pure power fantasy",  "#f2d27a"],
];

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
  const [info, setInfo] = useState(null);   // tapped ability/gear explanation
  const [openAttr, setOpenAttr] = useState(null); // tapped attribute → threshold detail
  const appr = s.appearance || {};
  const apprChips = ["skin", "hair", "eyes", "build", "facial_hair", "marks"].map((k) => appr[k]).filter(Boolean);
  const wornItems = (s.items || []).filter((i) => i.worn).map((i) => ({ ...i, def: itemTemplate(i.itemId) }));
  const packedItems = (s.items || []).filter((i) => !i.worn).map((i) => ({ ...i, def: itemTemplate(i.itemId) }));
  const coinStr = [s.coins?.gold && `${s.coins.gold}g`, s.coins?.silver && `${s.coins.silver}s`, s.coins?.copper && `${s.coins.copper}c`].filter(Boolean).join(" ");
  const detailRows = (rows) => rows.length ? (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px", paddingTop: "2px" }}>
      {rows.map((r, i) => <div key={i} style={{ fontSize: "12px", color: colors.parchment }}>{r}</div>)}
    </div>
  ) : null;
  const itemInfo = (it) => {
    const def = it.def;
    const cs = def ? itemCombatStats(def) : null;
    const req = def ? itemRequirement(def) : null;
    const rows = [];
    if (cs?.damage) rows.push(`Damage ${cs.damage.min}–${cs.damage.max} ${cs.damage.type}${cs.damage.pen ? ` · pen ${cs.damage.pen}` : ""}`);
    if (cs?.weaponType) rows.push(`Type: ${cs.weaponType}`);
    if (cs?.armor > 0) rows.push(`Armor +${cs.armor}`);
    if (cs?.ward > 0) rows.push(`Ward +${cs.ward}`);
    if (cs?.dodge > 0) rows.push(`Dodge +${cs.dodge}%`);
    if (req?.value > 0) rows.push(`Requires ${ATTR_LABELS[req.attr]} ${req.value}`);
    setInfo({ term: it.def?.name || it.itemId, text: it.def?.description || it.def?.appearance || "A piece of your kit.", extra: detailRows(rows) });
  };
  const abilityInfo = (a) => {
    const def = getAbilityDef(a.id);
    const stat = def ? abilityStatLine(def, a.tier) : "";
    const reqs = def ? abilityReqLine(def) : "";
    setInfo({
      term: `${def?.name || a.id} · ${tierLabel(a.tier)}`,
      text: def?.desc || "A learned technique.",
      extra: (stat || reqs) ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "3px", paddingTop: "2px" }}>
          {stat && <div style={{ fontSize: "12px", color: colors.parchment }}>{stat}</div>}
          {reqs && <div style={{ fontSize: "11px", color: "rgba(237,228,208,0.6)" }}>{reqs}</div>}
        </div>
      ) : null,
    });
  };

  return (
    <div className="template-detail" style={{ position: "fixed", inset: 0, zIndex: 70, background: "radial-gradient(120% 90% at 50% 0%, rgba(28,36,40,0.98), rgba(8,11,12,0.995))", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      <div className="template-detail__inner" style={{ width: "100%", maxWidth: "640px", margin: "0 auto", padding: "18px 18px 36px" }}>
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
        <div style={{ fontSize: "12px", color: "rgba(215,167,111,0.85)", marginBottom: "12px" }}>{metaLine(s)} · {tmpl.label} · {tmpl.concept}</div>

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

        <Section title="Attributes" hint="tap for what each grants">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
            {ATTR_KEYS.map((k) => {
              const hot = tmpl.highlights.includes(ATTR_LABELS[k]);
              const active = openAttr === k;
              return (
                <button key={k} onClick={() => setOpenAttr((p) => (p === k ? null : k))} style={{ padding: "7px 8px", borderRadius: radius.chip, textAlign: "center", cursor: "pointer", fontFamily: "inherit", backgroundColor: active ? "rgba(215,167,111,0.2)" : hot ? "rgba(215,167,111,0.14)" : "rgba(20,29,29,0.5)", border: `1px solid ${active || hot ? "rgba(215,167,111,0.45)" : "rgba(215,167,111,0.16)"}` }}>
                  <div style={{ fontSize: "8px", letterSpacing: "0.1em", textTransform: "uppercase", color: colors.gold, fontWeight: 800 }}>{ATTR_LABELS[k]}</div>
                  <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "20px", color: colors.parchment, lineHeight: 1.1 }}>{s.attributes[k]}</div>
                </button>
              );
            })}
          </div>
          {openAttr && <AttributeDetail attrKey={openAttr} value={s.attributes[openAttr] ?? 0} />}
        </Section>

        <Section title="Abilities" hint="tap for what they do">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {(s.abilities || []).map((a) => {
              const def = getAbilityDef(a.id);
              return (
                <button key={a.id} onClick={() => abilityInfo(a)} style={{ ...tagPill, cursor: "pointer", fontFamily: "inherit", textTransform: "none", letterSpacing: 0, color: colors.parchmentLight, backgroundColor: "rgba(20,29,29,0.6)", border: `1px solid rgba(215,167,111,0.22)` }}>
                  {def?.name || a.id} <span style={{ color: tierColor(a.tier), fontWeight: 800 }}>{tierLabel(a.tier)}</span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Gear" hint="tap an item">
          {[["Worn", wornItems], ["Packed", packedItems]].map(([label, list]) => list.length > 0 && (
            <div key={label} style={{ marginBottom: "6px" }}>
              <div style={{ fontSize: "10px", color: "rgba(215,167,111,0.6)", marginBottom: "4px" }}>{label}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                {list.map((it) => (
                  <button key={it.itemId} onClick={() => itemInfo(it)} style={{ ...tagPill, cursor: "pointer", fontFamily: "inherit", textTransform: "none", letterSpacing: 0, color: "rgba(237,228,208,0.85)", backgroundColor: "rgba(20,29,29,0.6)", border: `1px solid rgba(215,167,111,0.2)`, fontWeight: 600 }}>
                    {it.quantity > 1 ? `${it.quantity}× ` : ""}{it.def?.name || it.itemId}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div style={{ fontSize: "11px", color: "rgba(237,228,208,0.5)", marginTop: "4px" }}>+ standard provisions{coinStr ? ` · ${coinStr}` : ""}</div>
        </Section>

        <button onClick={() => !busy && onConfirm()} disabled={busy} style={{
          width: "100%", marginTop: "18px", padding: "13px", borderRadius: radius.control, border: "none",
          backgroundColor: colors.gold, color: colors.ink, fontSize: "14px", fontWeight: 800,
          cursor: busy ? "default" : "pointer", fontFamily: "inherit", opacity: busy ? 0.6 : 1,
        }}>{busy ? "Drawing them into the world…" : `Begin as ${finalName}`}</button>
      </div>
      {info && <InfoModal info={info} onClose={() => setInfo(null)} />}
    </div>
  );
}

const Section = ({ title, hint, children }) => (
  <div style={{ marginBottom: "14px" }}>
    <div style={metaHead}>{title}{hint && <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: "none", color: "rgba(215,167,111,0.45)" }}> · {hint}</span>}</div>
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
    // Pass the backstory so the narrator can ground the opening scene (now a live
    // narrator call that arrives the character inside Whitemarch, like the custom path).
    onPickTemplate({ ...tmpl.setup, name: finalNameFor(tmpl), backstory: tmpl.story, items: [...(tmpl.setup.items || []), ...provisions] });
  };

  if (selected) {
    return <TemplateDetail tmpl={selected} finalName={finalNameFor(selected)} onConfirm={() => begin(selected)} onBack={() => setSelected(null)} busy={busy} />;
  }

  return (
    <div className="creation-hub" style={{
      position: "fixed", inset: 0, zIndex: 60, display: "flex", flexDirection: "column",
      background: "radial-gradient(120% 90% at 50% 0%, rgba(28,36,40,0.96), rgba(8,11,12,0.99))",
      overflowY: "auto", WebkitOverflowScrolling: "touch",
    }}>
      <div className="creation-hub__inner" style={{ width: "100%", maxWidth: "640px", margin: "0 auto", padding: "20px 18px 40px", flex: 1 }}>
        <div className="creation-hub__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
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

        <div style={{ fontSize: "9px", letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(215,167,111,0.6)", fontWeight: 800, marginBottom: "4px" }}>Ready-made lives <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400, color: "rgba(215,167,111,0.45)" }}>· a party needs one of each</span></div>
        <div style={{ fontSize: "10.5px", color: "rgba(215,167,111,0.55)", fontStyle: "italic", lineHeight: 1.4, marginBottom: "12px" }}>Standard is the intended start. Everything above it begins you already powerful — a different, easier experience by choice.</div>
        {TEMPLATE_TIERS.map(([tier, label, blurb, hue]) => {
          const list = CHARACTER_TEMPLATES.filter((t) => (t.tier || "standard") === tier);
          if (!list.length) return null;
          return (
            <div key={tier} style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "9px", paddingBottom: "5px", borderBottom: `1px solid ${hue}33` }}>
                <span style={{ fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", color: hue, fontWeight: 800 }}>{label}</span>
                <span style={{ fontSize: "10px", color: "rgba(215,167,111,0.5)", fontStyle: "italic" }}>{blurb}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {list.map((t) => (
                  <button className="creation-card" key={t.id} onClick={() => setSelected(t)} disabled={busy} style={{
                    display: "flex", alignItems: "center", gap: "11px", padding: "13px 14px", borderRadius: radius.panelCompact, textAlign: "left", width: "100%",
                    backgroundColor: "rgba(20,29,29,0.55)", border: `1px solid ${hue}33`, cursor: busy ? "default" : "pointer", fontFamily: "inherit",
                  }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: `${hue}1f`, border: `1px solid ${hue}4d` }}>
                      <Icon name={t.icon} size={18} color={hue} strokeWidth={1.8} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "7px", flexWrap: "wrap" }}>
                        <span style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "19px", color: colors.parchmentLight, lineHeight: 1.15 }}>{finalNameFor(t)}</span>
                        <span style={{ ...tagPill, color: colors.ink, backgroundColor: colors.gold }}>{t.role}</span>
                      </div>
                      <div style={{ fontSize: "10.5px", color: "rgba(215,167,111,0.7)", marginTop: "2px" }}>{metaLine(t.setup)}</div>
                      <div style={{ display: "flex", gap: "4px", marginTop: "6px", flexWrap: "wrap" }}>
                        {t.highlights.map((h) => <span key={h} style={tagPill}>{h}</span>)}
                      </div>
                    </div>
                    <span style={{ flexShrink: 0, fontSize: "20px", color: "rgba(215,167,111,0.55)", lineHeight: 1 }}>›</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        <div className="creation-custom" style={{ marginTop: "20px", padding: "15px", borderRadius: radius.panelCompact, backgroundColor: "rgba(176,114,230,0.08)", border: `1px solid rgba(176,114,230,0.32)` }}>
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
