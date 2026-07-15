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
import rosterArtwork from "../assets/generated/character-roster-threshold-v1.webp";
import { ProfessionIcon } from "./ProfessionIcon.jsx";
import { resolveCharacterPortrait } from "./character-portrait-assets.js";
import { professionRecord } from "../data/professions.js";

const isHumanRace = (r) => r === "human";

// Power rungs for the pick-and-play roster. The full authored company is the
// default view; these become quick filters for players who want a power band.
const TEMPLATE_TIERS = [
  { id: "standard", label: "Standard", flavor: "Grounded", eyebrow: "The intended beginning", blurb: "An ordinary life. Every mile and hard-won victory matters.", accent: "#d7b477" },
  { id: "mid", label: "Veteran", flavor: "Seasoned", eyebrow: "Road-tested", blurb: "Capable from the outset, with room to become exceptional.", accent: "#87b995" },
  { id: "epic", label: "Champion", flavor: "Heroic", eyebrow: "Already formidable", blurb: "A stronger, faster opening with fewer early hardships.", accent: "#b894df" },
  { id: "legendary", label: "Legend", flavor: "Fabled", eyebrow: "Known across the land", blurb: "Begin with the power and reputation others spend lives earning.", accent: "#df9d55" },
  { id: "mythical", label: "Mythic", flavor: "Unbound", eyebrow: "Beyond mortal measure", blurb: "The early world will struggle to contain what you already are.", accent: "#62c3c4" },
  { id: "divine", label: "Divine", flavor: "Godlike", eyebrow: "Pure power fantasy", blurb: "A god walks the road. Choose this for dominion, not survival.", accent: "#efd887" },
];

const ALL_TIER = {
  id: "all", label: "All", flavor: `${CHARACTER_TEMPLATES.length} lives`, eyebrow: "Every authored road",
  blurb: "Browse the complete company, then narrow by power, role, or name.", accent: "#efca7e",
};
const ROSTER_TIERS = [ALL_TIER, ...TEMPLATE_TIERS];
const ROLE_FILTERS = ["all", ...new Set(CHARACTER_TEMPLATES.map((template) => template.role))];

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
  const tierMeta = TEMPLATE_TIERS.find((tier) => tier.id === (tmpl.tier || "standard")) || TEMPLATE_TIERS[0];
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
    <div className="template-detail" style={{ "--tier-accent": tierMeta.accent }}>
      <div className="template-detail__inner">
        <header className="template-detail__hero">
          <img src={resolveCharacterPortrait(tmpl, rosterArtwork)} alt="" draggable="false" decoding="async" />
          <div className="template-detail__hero-wash" aria-hidden="true" />
          <div className="template-detail__toolbar">
            <button className="creation-back" type="button" onClick={onBack} disabled={busy}>
              <Icon name="arrowLeft" size={14} strokeWidth={2} /> Back to roster
            </button>
            <span className="template-detail__role">{tmpl.role}</span>
          </div>
          <div className="template-detail__identity">
            <span className="template-detail__sigil" aria-hidden="true">
              <ProfessionIcon templateId={tmpl.id} profession={s.profession} size="large" decorative />
            </span>
            <p>{tierMeta.label} · {tmpl.label}</p>
            <h1>{finalName}</h1>
            <div>{metaLine(s)}</div>
            <span>{tmpl.concept}</span>
          </div>
        </header>

        <div className="template-detail__body">
          <p className="template-detail__story">{tmpl.story || s.story}</p>

          <Section title="A person, not a preset">
            <div className="template-character-hooks">
              <CharacterHook label="Voice" value={tmpl.voice} />
              <CharacterHook label="Unfinished business" value={tmpl.complication} />
              <CharacterHook label="Telltale habit" value={tmpl.signature} />
            </div>
          </Section>

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

          <button className="template-detail__begin" onClick={() => !busy && onConfirm()} disabled={busy}>
            <Icon name="compass" size={18} strokeWidth={1.7} />
            {busy ? "Drawing them into the world…" : `Begin as ${finalName}`}
          </button>
        </div>
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

const CharacterHook = ({ label, value }) => value ? (
  <div className="template-character-hook">
    <small>{label}</small>
    <p>{value}</p>
  </div>
) : null;

// The first thing a fresh soul sees in limbo: choose a ready-made life (tap a
// card to meet them in full, then begin) or step into the freeform interview to
// author your own. "Leave" returns to the campaigns list so you're never stuck.
export function CreationHub({ onPickTemplate, onCustom, onQuit, busy }) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState(null); // template being previewed
  const [tierId, setTierId] = useState("all");
  const [role, setRole] = useState("all");
  const [search, setSearch] = useState("");

  const finalNameFor = (tmpl) => name.trim() || tmpl.setup.name;
  const activeTier = ROSTER_TIERS.find((tier) => tier.id === tierId) || ALL_TIER;
  const normalizedSearch = search.trim().toLowerCase();
  const activeTemplates = CHARACTER_TEMPLATES.filter((tmpl) => {
    if (activeTier.id !== "all" && (tmpl.tier || "standard") !== activeTier.id) return false;
    if (role !== "all" && tmpl.role !== role) return false;
    if (!normalizedSearch) return true;
    return [tmpl.label, tmpl.role, tmpl.concept, tmpl.story, tmpl.setup.name, tmpl.setup.profession, tmpl.setup.race]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch));
  });
  const begin = (tmpl) => {
    if (busy) return;
    const have = new Set((tmpl.setup.items || []).map((i) => i.itemId));
    const provisions = STANDARD_PROVISIONS.filter((p) => !have.has(p.itemId)).map((p) => ({ itemId: p.itemId, quantity: p.quantity, worn: false }));
    // Pass the backstory so the narrator can ground the opening scene (now a live
    // narrator call that arrives the character inside Whitemarch, like the custom path).
    const profile = { voice: tmpl.voice, complication: tmpl.complication, signature: tmpl.signature };
    const backstory = [
      tmpl.story,
      tmpl.voice && `Voice: ${tmpl.voice}`,
      tmpl.complication && `Unfinished business: ${tmpl.complication}`,
      tmpl.signature && `Telltale habit: ${tmpl.signature}`,
    ].filter(Boolean).join(" ");
    onPickTemplate({
      ...tmpl.setup,
      name: finalNameFor(tmpl),
      templateId: tmpl.id,
      portraitKey: tmpl.portraitKey,
      profile,
      backstory,
      items: [...(tmpl.setup.items || []), ...provisions],
    });
  };

  if (selected) {
    return <TemplateDetail tmpl={selected} finalName={finalNameFor(selected)} onConfirm={() => begin(selected)} onBack={() => setSelected(null)} busy={busy} />;
  }

  return (
    <div className="creation-hub" style={{ "--tier-accent": activeTier.accent }}>
      <div className="creation-hub__inner">
        <header className="creation-roster-hero">
          <img className="creation-roster-hero__art" src={rosterArtwork} alt="" draggable="false" decoding="async" />
          <div className="creation-roster-hero__wash" aria-hidden="true" />
          <div className="creation-roster-hero__toolbar">
            <button className="creation-back" type="button" onClick={onQuit} disabled={busy}>
              <Icon name="arrowLeft" size={14} strokeWidth={2} /> Campaigns
            </button>
            <span>The threshold</span>
          </div>
          <div className="creation-roster-hero__copy">
            <p>Choose a life</p>
            <h1>Who will walk the road?</h1>
            <span>Meet a ready-made traveller, or shape your own from nothing.</span>
          </div>
        </header>

        <main className="creation-roster">
          <section className="creation-tier-picker" aria-labelledby="power-heading">
            <div className="creation-section-heading">
              <div>
                <p>Campaign-defining choice</p>
                <h2 id="power-heading">Choose your power fantasy</h2>
              </div>
              <span>Sets tone &amp; challenge</span>
            </div>
            <p className="creation-tier-picker__intro">
              Starting power changes the danger curve, pace of growth, and how the world reads your arrival.
            </p>
            <div className="creation-tier-tabs no-scrollbar" role="tablist" aria-label="Starting power">
              {ROSTER_TIERS.map((tier, index) => (
                <button
                  type="button"
                  key={tier.id}
                  id={`creation-tier-${tier.id}`}
                  role="tab"
                  aria-selected={tier.id === activeTier.id}
                  aria-controls="creation-roster-panel"
                  className={tier.id === activeTier.id ? "is-active" : ""}
                  style={{ "--tab-accent": tier.accent }}
                  onClick={() => setTierId(tier.id)}
                  disabled={busy}
                  aria-label={`${tier.label}: ${tier.flavor}`}
                >
                  <small>{tier.id === "all" ? "∞" : String(index).padStart(2, "0")}</small>
                  <strong>{tier.label}</strong>
                  <span>{tier.flavor}</span>
                  <i aria-hidden="true">✓</i>
                </button>
              ))}
            </div>

            <div className="creation-tier-summary">
              <span className="creation-tier-summary__mark" aria-hidden="true"><Icon name={activeTier.id === "standard" || activeTier.id === "all" ? "compass" : "sparkle"} size={20} strokeWidth={1.65} /></span>
              <div>
                <small>Selected · {activeTier.eyebrow}</small>
                <strong>{activeTier.label}</strong>
                <p>{activeTier.blurb}</p>
              </div>
              <span className="creation-tier-summary__roster">{activeTemplates.length}<small>{activeTemplates.length === 1 ? "traveller" : "travellers"}</small></span>
            </div>
          </section>

          <section className="creation-roster-tools" aria-label="Filter character roster">
            <label htmlFor="creation-roster-search">
              <Icon name="target" size={17} />
              <span className="sr-only">Search characters</span>
              <input
                id="creation-roster-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, profession, kindred…"
              />
            </label>
            <div className="creation-role-filters no-scrollbar" role="toolbar" aria-label="Filter by combat role">
              {ROLE_FILTERS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={role === value ? "is-active" : ""}
                  aria-pressed={role === value}
                  onClick={() => setRole(value)}
                >{value === "all" ? "All roles" : value}</button>
              ))}
            </div>
          </section>

          <section className="creation-name-field">
            <span className="creation-name-field__sigil" aria-hidden="true"><Icon name="user" size={18} strokeWidth={1.65} /></span>
            <label htmlFor="creation-name-override">
              <span>Name your traveller</span>
              <small>Optional — leave blank to keep each character's name</small>
            </label>
            <input
              id="creation-name-override"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Use the character's own name"
            />
          </section>

          <section
            id="creation-roster-panel"
            className="creation-grid"
            role="tabpanel"
            aria-labelledby={`creation-tier-${activeTier.id}`}
          >
            {activeTemplates.map((tmpl) => (
              <button
                type="button"
                className="creation-card"
                key={tmpl.id}
                onClick={() => setSelected(tmpl)}
                disabled={busy}
              >
                <span className="creation-card__portrait" aria-hidden="true">
                  <img src={resolveCharacterPortrait(tmpl, rosterArtwork)} alt="" draggable="false" loading="lazy" decoding="async" />
                  <ProfessionIcon templateId={tmpl.id} profession={tmpl.setup.profession} size="small" decorative />
                </span>
                <span className="creation-card__body">
                  <span className="creation-card__topline">
                    <small>{tmpl.role}</small>
                    <em>{professionRecord(tmpl.setup.profession)?.name || tmpl.label}</em>
                  </span>
                  <strong>{finalNameFor(tmpl)}</strong>
                  <span className="creation-card__meta">{metaLine(tmpl.setup)}</span>
                  <span className="creation-card__concept">{tmpl.concept}</span>
                  <span className="creation-card__highlights">
                    {tmpl.highlights.map((highlight) => <i key={highlight}>{highlight}</i>)}
                  </span>
                </span>
                <span className="creation-card__meet" aria-hidden="true">Meet them <b>›</b></span>
              </button>
            ))}
            {activeTemplates.length === 0 && (
              <div className="creation-roster-empty" role="status">
                <Icon name="character" size={28} />
                <strong>No traveller answers that description.</strong>
                <button type="button" onClick={() => { setSearch(""); setRole("all"); setTierId("all"); }}>Clear filters</button>
              </div>
            )}
          </section>

          <section className="creation-custom">
            <span className="creation-custom__sigil" aria-hidden="true"><Icon name="sparkle" size={22} strokeWidth={1.7} /></span>
            <div>
              <p>Write your own beginning</p>
              <h2>Create a custom traveller</h2>
              <span>Step into the limbo and shape identity, history, and purpose through conversation.</span>
            </div>
            <button type="button" onClick={() => !busy && onCustom()} disabled={busy}>
              Enter the limbo <span aria-hidden="true">›</span>
            </button>
          </section>
        </main>
      </div>
    </div>
  );
}
