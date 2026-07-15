import React, { useState, useMemo } from "react";
import { Icon, ItemIcon } from "./Icon.jsx";
import { iconButtonStyle, conditionPalette, fmtRemaining } from "./primitives.jsx";
import { colors, shadow, radius, fonts, metaStyle } from "./tokens.js";
import { ATTR_KEYS, ATTR_LABELS, originLabel } from "../config.js";
import { GLOSSARY, GLOSSARY_CATEGORIES } from "../data/glossary.js";
import { CONDITIONS } from "../data/conditions.js";
import { hasCombatEffect } from "../engine/condition-combat.js";
import { relationshipTier } from "../engine/relationships.js";
import { itemTemplate } from "../data/catalog.js";
import { canScry } from "../engine/positions.js";
import { EQUIPMENT, MATERIALS } from "../data/equipment.js";
import { tier as tierInfo, tierLabel, tierOrder, tierColor } from "../data/tiers.js";
import { weaponCategory, armorClass, itemCombatStats, itemRequirement } from "../engine/combat-stats.js";
import { passiveLabel, passiveDef, passiveEffectText, passiveEffectRange, PASSIVES, FUSIONS, RUNES, isFusionRune } from "../data/passives.js";
import { getAbilityDef, ABILITY_CATALOG, abilityCategoryOf, abilityStatLine, abilityReqLine } from "../data/abilities.js";
import { RACES } from "../data/races.js";
import { descriptorFor } from "../data/attractiveness.js";

function attractivenessLabel(n) {
  if (typeof n !== "number") return null;
  const d = descriptorFor(n);
  return d ? `${n} / 10 · ${d}` : `${n} / 10`;
}

// Aging-mode renderer for the character meta line. Only emits a short tag
// when the mode is non-default ("mortal" stays implicit). Ageless folk display
// their frozen biological age; power-extended folk show their multiplier.
function agingModeLabel(mode, ch) {
  if (!mode || mode === "mortal") return null;
  if (mode === "ageless") {
    const a = ch?.age;
    return a != null ? `ageless · frozen at ${a}` : "ageless";
  }
  if (mode === "power-extended") {
    const m = ch?.lifespanMultiplier;
    return m != null ? `power-extended ×${Number(m).toFixed(1)}` : "power-extended";
  }
  if (mode === "out-of-time") return "out-of-time";
  return mode;
}

// Two kinds of content: "lore" you discover in play, and the full "compendium"
// catalogs that are always complete. The tabstrip divides them visually.
const CODEX_TABS = [
  { key: "characters",  label: "Characters",  group: "lore",       icon: "users" },
  { key: "races",       label: "Races",       group: "lore",       icon: "globe" },
  { key: "professions", label: "Professions", group: "lore",       icon: "swords" },
  { key: "items",       label: "Items",       group: "compendium", icon: "bag" },
  { key: "abilities",   label: "Abilities",   group: "compendium", icon: "sparkle" },
  { key: "passives",    label: "Passives",    group: "compendium", icon: "shield" },
  { key: "conditions",  label: "Conditions",  group: "reference",  icon: "heart" },
  { key: "glossary",    label: "Glossary",    group: "reference",  icon: "book" },
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

function portraitInitials(name) {
  const words = String(name || "Unknown").replace(/^the\s+/i, "").trim().split(/\s+/);
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function portraitHue(id) {
  const hash = [...String(id || "unknown")].reduce((total, char) => ((total * 31) + char.charCodeAt(0)) >>> 0, 0);
  return 184 + (hash % 72);
}

function characterKindLabel(entry) {
  if (entry.kind === "player") return "Player character";
  if (entry.kind === "companion") return "Companion";
  if (entry.kind === "mount") return "Mount";
  return "Known character";
}

function CharacterPortrait({ entry }) {
  const [imageFailed, setImageFailed] = useState(false);
  const portrait = !imageFailed && typeof entry.portrait === "string" && entry.portrait.trim() ? entry.portrait : null;
  return (
    <div
      className={`codex-entry__portrait${portrait ? " has-image" : " is-placeholder"}`}
      data-portrait-slot={entry.id}
      style={{ "--portrait-hue": portraitHue(entry.id) }}
      role={portrait ? undefined : "img"}
      aria-label={portrait ? undefined : `${entry.name} portrait placeholder`}
    >
      {portrait
        ? <img src={portrait} alt={`${entry.name} portrait`} draggable="false" onError={() => setImageFailed(true)} />
        : <><Icon name={entry.kind === "mount" ? "compass" : "user"} size={25} strokeWidth={1.25} /><strong>{portraitInitials(entry.name)}</strong></>}
      <span aria-hidden="true" />
    </div>
  );
}

// ===========================================================================
// ITEM CATALOG — the full gear table (EQUIPMENT + MATERIALS), grouped by content
// type (weapon family, light/heavy armour, shields, clothing, trinkets, runes,
// materials) and, within each, by TIER. Lets you review every added item in one
// place, whether or not it's been discovered in play.
// ===========================================================================

const TYPE_FILTERS = [
  { key: "all", label: "All" },
  { key: "weapon", label: "Weapons" },
  { key: "armor", label: "Armour" },
  { key: "shield", label: "Shields" },
  { key: "clothing", label: "Clothing" },
  { key: "trinket", label: "Trinkets" },
  { key: "rune", label: "Runes" },
  { key: "material", label: "Materials" },
];

const WEAPON_FAMILY_ORDER = ["dagger", "sword", "axe", "mace", "spear", "bow", "crossbow", "arcane", "unarmed"];
const WEAPON_FAMILY_LABEL = {
  dagger: "Daggers & Knives", sword: "Swords", axe: "Axes", mace: "Maces & Hammers",
  spear: "Spears & Polearms", bow: "Bows", crossbow: "Crossbows", arcane: "Arcane Foci", unarmed: "Other",
};

const sortByTier = (items) =>
  items.slice().sort((a, b) => (tierOrder(a.tier || "common") - tierOrder(b.tier || "common")) || a.name.localeCompare(b.name));

const CATALOG_ITEM_COUNT = Object.keys({ ...EQUIPMENT, ...MATERIALS }).length;

function buildCatalogSections() {
  const all = Object.values({ ...EQUIPMENT, ...MATERIALS });
  const sections = [];
  for (const fam of WEAPON_FAMILY_ORDER) {
    const items = all.filter((it) => it.kind === "weapon" && weaponCategory(it) === fam);
    if (items.length) sections.push({ group: "weapon", key: `weapon-${fam}`, label: `Weapons · ${WEAPON_FAMILY_LABEL[fam]}`, items: sortByTier(items) });
  }
  for (const band of ["light", "heavy"]) {
    const items = all.filter((it) => it.kind === "armor" && (armorClass(it) || "light") === band);
    if (items.length) sections.push({ group: "armor", key: `armor-${band}`, label: `Armour · ${band === "light" ? "Light" : "Heavy"}`, items: sortByTier(items) });
  }
  for (const [kind, label] of [["shield", "Shields"], ["clothing", "Clothing"], ["trinket", "Trinkets"]]) {
    const items = all.filter((it) => it.kind === kind);
    if (items.length) sections.push({ group: kind, key: kind, label, items: sortByTier(items) });
  }
  const runes = all.filter((it) => it.kind === "material" && isFusionRune(it.id));
  if (runes.length) sections.push({ group: "rune", key: "rune", label: "Runes · Fusion", items: sortByTier(runes) });
  const mats = all.filter((it) => it.kind === "material" && !isFusionRune(it.id));
  if (mats.length) sections.push({ group: "material", key: "material", label: "Materials", items: sortByTier(mats) });
  return sections;
}

// One-line stat summary for a catalog item, drawn from the same inference the
// combat engine uses (tier-scaled), so the table reads as the item really plays.
function catalogStatLine(item) {
  const cs = itemCombatStats(item);
  if (cs.damage) {
    const d = cs.damage;
    const reach = (d.range || 0) > 0 ? `rng ${d.range}` : `reach ${d.reach || 1}`;
    const spd = `spd ${(d.speed || 0) >= 0 ? "+" : ""}${d.speed || 0}`;
    return `dmg ${d.min}–${d.max} · pen ${d.pen || 0} · ${reach} · ${spd} · ${d.type}`;
  }
  if (item.kind === "armor") {
    const cls = armorClass(item);
    return [`AR ${cs.armor}`, cls ? cls : null, cs.ward ? `WD ${cs.ward}` : null].filter(Boolean).join(" · ");
  }
  if (item.kind === "shield") return `AR ${cs.armor} (offhand)`;
  if (item.kind === "clothing") return [cs.armor ? `AR ${cs.armor}` : null, cs.ward ? `WD ${cs.ward}` : null, cs.dodge ? `dodge ${cs.dodge}` : null].filter(Boolean).join(" · ") || "worn";
  if (item.kind === "trinket") return [cs.ward ? `WD ${cs.ward}` : null, cs.dodge ? `dodge ${cs.dodge}` : null].filter(Boolean).join(" · ") || "trinket";
  if (item.kind === "material") return `${item.value || 0}cp`;
  return null;
}

function TierChip({ tierId, min }) {
  const t = tierInfo(tierId || "common");
  return (
    <span title={min ? "Lowest grade this can be — its tier floor" : undefined} style={{ fontSize: "8px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", padding: "1px 6px", borderRadius: "6px", color: t.color, border: `1px solid ${t.color}55`, backgroundColor: `${t.color}14`, flexShrink: 0 }}>
      {min ? "≥ " : ""}{t.label}
    </span>
  );
}

// Explicit gear requirement (the attribute + minimum score the item demands),
// shown structurally instead of buried in flavour text.
function reqLine(item) {
  const r = itemRequirement(item);
  if (!r || !r.value) return null;
  return `Requires ${ATTR_LABELS[r.attr] || r.attr} ${r.value}`;
}

// A tappable affix/ability chip: shows its label (with magnitude for affixes) and,
// on click, reveals what it ACTUALLY does (passiveDef/getAbilityDef desc). Used by
// the item catalog and the racial kits so no chip is an opaque label.
function EffectChip({ kind, id, tier }) {
  const [open, setOpen] = useState(false);
  const def = kind === "ability" ? getAbilityDef(id) : passiveDef(id);
  const label = kind === "ability" ? (def?.name || id) : (passiveLabel(id, tier) || id);
  // Abilities reveal their flavour; passives reveal the EXACT effect first, then flavour.
  const effect = kind === "ability" ? "" : passiveEffectText(id, tier);
  const flavour = def?.desc || "";
  const hasDetail = !!(effect || flavour);
  const accent = kind === "ability" ? "127,199,224" : "176,114,230";
  return (
    <>
      <span onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} title={effect || flavour}
        style={{ fontSize: "8px", padding: "1px 5px", borderRadius: "5px", cursor: "pointer",
          backgroundColor: `rgba(${accent},0.12)`, color: `rgba(${accent},0.95)`, border: `1px solid rgba(${accent},0.3)` }}>
        {label}{hasDetail ? <span style={{ opacity: 0.55, marginLeft: "3px", fontSize: "8px" }}>{open ? "▾" : "ⓘ"}</span> : null}
      </span>
      {open && hasDetail && (
        <span style={{ flexBasis: "100%", width: "100%", fontSize: "9px", color: "rgba(237,228,208,0.62)", lineHeight: 1.4, margin: "1px 0 2px 3px" }}>
          {effect && <span style={{ color: `rgba(${accent},0.95)`, fontWeight: 600 }}>{effect}</span>}
          {effect && flavour ? " — " : ""}{flavour}
        </span>
      )}
    </>
  );
}

const ATTR_FULL = { body: "Body", reflex: "Reflex", vigor: "Vigor", mind: "Mind", wit: "Wit", presence: "Presence" };
function fmtMods(mods) {
  return Object.entries(mods || {}).filter(([, v]) => v).map(([k, v]) => `${ATTR_FULL[k] || k} ${v > 0 ? "+" : ""}${v}`).join(" · ");
}
function KitList({ label, items, color }) {
  return (
    <div style={{ marginBottom: "4px" }}>
      <span style={{ ...subtleMeta, fontSize: "8px" }}>{label}</span>
      <ul style={{ margin: "2px 0 0", paddingLeft: "16px", fontSize: "10px", color, lineHeight: 1.4 }}>
        {items.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
    </div>
  );
}

// The mechanical kit of a playable race (from data/races.js), shown in the Races
// codex tab so the player can review every species/lineage by content.
function RaceKit({ raceId }) {
  const race = RACES[raceId];
  if (!race) return null;
  const mods = fmtMods(race.attributeModifiers);
  const Chips = ({ items, kind }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "3px" }}>
      {items.map((a, i) => <EffectChip key={i} kind={kind} id={a.id} tier={a.tier} />)}
    </div>
  );
  return (
    <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: `1px dashed rgba(215,167,111,0.2)` }}>
      <div style={{ ...accentMeta, marginBottom: "6px", fontWeight: 600 }}>Racial kit</div>
      <div style={{ fontSize: "10px", color: "rgba(237,228,208,0.7)", marginBottom: "6px" }}>
        Magic: {race.magic === "innate" ? "born attuned — casts from the start" : "must be learned in play"}
        {race.social && race.social !== "normal" ? ` · ${race.social} by strangers` : ""}
        {race.proficiencyGrowthMult && race.proficiencyGrowthMult !== 1 ? ` · learns ${Math.round((race.proficiencyGrowthMult - 1) * 100)}% faster` : ""}
      </div>
      {mods && <div style={{ fontSize: "10px", color: "rgba(127,199,224,0.85)", marginBottom: "6px" }}>Attributes: {mods}</div>}
      {race.innateAbilities?.length > 0 && (<div style={{ marginBottom: "6px" }}><span style={{ ...subtleMeta, fontSize: "8px" }}>Innate abilities</span><Chips items={race.innateAbilities} kind="ability" /></div>)}
      {race.startingSpells?.length > 0 && (<div style={{ marginBottom: "6px" }}><span style={{ ...subtleMeta, fontSize: "8px" }}>Starting magic</span><Chips items={race.startingSpells.map((id) => ({ id }))} kind="ability" /></div>)}
      {race.racialPassives?.length > 0 && (<div style={{ marginBottom: "6px" }}><span style={{ ...subtleMeta, fontSize: "8px" }}>Racial passives</span><Chips items={race.racialPassives} kind="passive" /></div>)}
      {race.traits?.length > 0 && <KitList label="Traits" items={race.traits} color="rgba(116,198,107,0.85)" />}
      {race.flaws?.length > 0 && <KitList label="Flaws" items={race.flaws} color="rgba(199,91,72,0.85)" />}
      {race.subraces && Object.keys(race.subraces).length > 0 && (
        <div style={{ marginTop: "6px" }}>
          <span style={{ ...subtleMeta, fontSize: "8px" }}>Lineages</span>
          {Object.entries(race.subraces).map(([sid, sub]) => (
            <div key={sid} style={{ marginTop: "5px", paddingLeft: "8px", borderLeft: `1px solid rgba(215,167,111,0.2)` }}>
              <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "12px", color: colors.parchmentLight }}>{sub.name}{sub.magic === "innate" ? " · born to magic" : ""}</div>
              {fmtMods(sub.attributeModifiers) && <div style={{ fontSize: "9px", color: "rgba(127,199,224,0.8)" }}>{fmtMods(sub.attributeModifiers)}</div>}
              {((sub.innateAbilities?.length || 0) + (sub.racialPassives?.length || 0) + (sub.startingSpells?.length || 0)) > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "2px" }}>
                  {(sub.innateAbilities || []).map((a, i) => <EffectChip key={`a${i}`} kind="ability" id={a.id} tier={a.tier} />)}
                  {(sub.startingSpells || []).map((s, i) => <EffectChip key={`s${i}`} kind="ability" id={s} />)}
                  {(sub.racialPassives || []).map((p, i) => <EffectChip key={`p${i}`} kind="passive" id={p.id} tier={p.tier} />)}
                </div>
              )}
              {sub.traits?.length > 0 && <div style={{ fontSize: "9px", color: "rgba(116,198,107,0.8)", marginTop: "1px" }}>{sub.traits.join(" ")}</div>}
              {sub.flaws?.length > 0 && <div style={{ fontSize: "9px", color: "rgba(199,91,72,0.8)" }}>{sub.flaws.join(" ")}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// A catalog row. Collapsed: name + tier + stat line + requirement + affix chips.
// Click to expand the appearance + description (so the list stays scannable).
function CatalogRow({ item, seen }) {
  const [open, setOpen] = useState(false);
  const t = tierInfo(item.tier || "common");
  const stat = catalogStatLine(item);
  const req = reqLine(item);
  const passives = item.passives || [];
  return (
    <div onClick={() => setOpen((o) => !o)} style={{ padding: "8px 10px", borderRadius: radius.panelCompact, backgroundColor: "rgba(20,29,29,0.6)", border: `1px solid ${t.color}33`, display: "flex", flexDirection: "column", gap: "3px", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "space-between" }}>
        <span style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "13px", color: t.color }}>
          <span style={{ color: "rgba(215,167,111,0.45)", marginRight: "5px", fontSize: "9px", fontStyle: "normal" }}>{open ? "▾" : "▸"}</span><ItemIcon item={item} size={13} />{item.name}
        </span>
        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
          {seen && <span title="Discovered in play" style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: colors.gold }} />}
          <TierChip tierId={item.tier} />
        </div>
      </div>
      {stat && <div style={{ fontSize: "9px", color: "rgba(237,228,208,0.6)", letterSpacing: "0.03em" }}>{stat}</div>}
      {req && <div style={{ fontSize: "9px", color: "rgba(127,199,224,0.8)", letterSpacing: "0.03em" }}>{req}</div>}
      {passives.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {passives.map((p, i) => <EffectChip key={i} kind="passive" id={p.id} tier={p.tier} />)}
        </div>
      )}
      {open && item.appearance && <div style={{ fontSize: "10px", fontStyle: "italic", color: "rgba(237,228,208,0.6)", lineHeight: 1.4, marginTop: "2px" }}>{item.appearance}</div>}
      {open && item.description && <div style={{ fontSize: "10px", color: "rgba(237,228,208,0.85)", lineHeight: 1.45 }}>{item.description}</div>}
    </div>
  );
}

// ===========================================================================
// SHARED CATALOG SCAFFOLDING — the Items / Abilities / Passives tabs are all the
// same shape: a filter-chip row (+ optional discovered/known toggle), a count
// line with expand/collapse-all, then collapsible sections whose rows are grouped
// by tier with a tier subheader. CatalogShell owns all of that; each catalog just
// supplies its filtered sections, a tier accessor, and a row renderer.
// ===========================================================================

const chipBtn = (active) => ({
  padding: "5px 10px", borderRadius: radius.panelCompact, border: "1px solid",
  borderColor: active ? "rgba(215,167,111,0.45)" : "rgba(215,167,111,0.1)",
  backgroundColor: active ? "rgba(215,167,111,0.14)" : "rgba(10,15,15,0.4)",
  color: active ? colors.parchmentLight : "rgba(215,167,111,0.55)",
  fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
});
const smallBtn = {
  padding: "4px 9px", borderRadius: radius.panelCompact, border: "1px solid rgba(215,167,111,0.2)",
  backgroundColor: "rgba(10,15,15,0.4)", color: "rgba(215,167,111,0.7)", fontSize: "10px",
  fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
};
const sectionHeadStyle = {
  display: "flex", alignItems: "center", gap: "8px", width: "100%", textAlign: "left",
  backgroundColor: "rgba(20,29,29,0.5)", border: "1px solid rgba(215,167,111,0.18)",
  borderRadius: radius.panelCompact, padding: "8px 10px", cursor: "pointer", fontFamily: "inherit",
};
const plurCat = (n) => (n === 1 ? "category" : "categories");

function FilterChips({ filters, value, onChange }) {
  return filters.map((f) => (
    <button key={f.key} onClick={() => onChange(f.key)} style={chipBtn(f.key === value)}>{f.label}</button>
  ));
}
function ToggleChip({ active, label, title, onClick }) {
  return (
    <button onClick={onClick} title={title} style={{ ...chipBtn(active), marginLeft: "auto", color: active ? colors.gold : "rgba(215,167,111,0.5)" }}>
      {active ? "● " : "○ "}{label}
    </button>
  );
}
function TierSubhead({ tierId, first, suffix }) {
  return (
    <div style={{ ...accentMeta, fontSize: "8px", letterSpacing: "0.14em", color: tierInfo(tierId).color, marginTop: first ? 0 : "4px", opacity: 0.8, paddingLeft: "4px" }}>
      {tierLabel(tierId)}{suffix || ""}
    </div>
  );
}
const EmptyState = (
  <div style={{ marginTop: "40px", textAlign: "center", fontFamily: fonts.serif, fontStyle: "italic", color: "rgba(215,167,111,0.45)", fontSize: "15px" }}>
    Nothing to show here.
  </div>
);

// sections: [{ key, label, color?, items[] }] already filtered by the caller.
// tierOf(item) → tier id used to sort + group rows; renderRow(item, tierId) → row.
function CatalogShell({ filters, filter, setFilter, toggle, sections, summary, tierOf, tierSuffix, renderRow, defaultOpen = false }) {
  const [openSecs, setOpenSecs] = useState(() => (defaultOpen ? new Set(sections.map((s) => s.key)) : new Set()));
  const total = sections.reduce((n, s) => n + s.items.length, 0);
  const allKeys = sections.map((s) => s.key);
  const allOpen = allKeys.length > 0 && allKeys.every((k) => openSecs.has(k));
  const toggleSec = (k) => setOpenSecs((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
        <FilterChips filters={filters} value={filter} onChange={setFilter} />
        {toggle}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ ...accentMeta, fontSize: "9px" }}>{summary(total, sections.length)}</div>
        {sections.length > 0 && (
          <button onClick={() => setOpenSecs(allOpen ? new Set() : new Set(allKeys))} style={{ ...smallBtn, marginLeft: "auto" }}>
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>

      {total === 0 ? EmptyState : sections.map((s) => {
        const isOpen = openSecs.has(s.key);
        const sorted = s.items.slice().sort((a, b) => (tierOrder(tierOf(a)) - tierOrder(tierOf(b))) || a.name.localeCompare(b.name));
        return (
          <div key={s.key} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <button onClick={() => toggleSec(s.key)} style={sectionHeadStyle}>
              <span style={{ color: "rgba(215,167,111,0.6)", fontSize: "10px" }}>{isOpen ? "▾" : "▸"}</span>
              <span style={{ ...subtleMeta, fontSize: "10px", letterSpacing: "0.1em", color: s.color || "rgba(215,167,111,0.9)" }}>{s.label}</span>
              <span style={{ flex: 1 }} />
              <span style={{ ...accentMeta, fontSize: "8px" }}>{s.items.length}</span>
            </button>
            {isOpen && sorted.map((it, i) => {
              const t = tierOf(it);
              const showTier = i === 0 || tierOf(sorted[i - 1]) !== t;
              return (
                <React.Fragment key={it.id}>
                  {showTier && <TierSubhead tierId={t} first={i === 0} suffix={tierSuffix} />}
                  {renderRow(it, t)}
                </React.Fragment>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function ItemCatalog({ codex }) {
  const [type, setType] = useState("all");
  const [discoveredOnly, setDiscoveredOnly] = useState(false);
  const seen = useMemo(() => new Set(Object.keys(codex.items || {})), [codex.items]);
  const allSections = useMemo(() => buildCatalogSections(), []);
  const sections = allSections
    .filter((s) => type === "all" || s.group === type)
    .map((s) => ({ ...s, items: discoveredOnly ? s.items.filter((it) => seen.has(it.id)) : s.items }))
    .filter((s) => s.items.length);

  return (
    <CatalogShell
      filters={TYPE_FILTERS} filter={type} setFilter={setType}
      toggle={<ToggleChip active={discoveredOnly} label="Discovered" title="Show only items discovered in play" onClick={() => setDiscoveredOnly((v) => !v)} />}
      sections={sections}
      summary={(total, cats) => `${total} item${total === 1 ? "" : "s"}${discoveredOnly ? " discovered" : " in catalog"} · ${cats} ${plurCat(cats)}`}
      tierOf={(it) => it.tier || "common"}
      renderRow={(it) => <CatalogRow item={it} seen={seen.has(it.id)} />}
    />
  );
}

// ===========================================================================
// ABILITY CATALOG — every DEFINED ability (martial / spell / racial-innate) with
// its full combat details, so the player can audit exactly what each does and
// which they know. Mirrors the item catalog (collapsible, Known toggle, click).
// ===========================================================================

const ABILITY_CATEGORIES = [
  { key: "martial", label: "Martial Techniques", color: "#e9d8b8" },
  { key: "spell", label: "Spells (Magic)", color: "#c4a6f0" },
  { key: "racial", label: "Racial & Innate", color: "#86d27a" },
];

function AbilityRow({ def, known, tier, owned }) {
  const [open, setOpen] = useState(false);
  const color = tierInfo(tier || "common").color; // name reads as its tier (school is the section)
  const stat = abilityStatLine(def, tier);
  const req = abilityReqLine(def);
  return (
    <div onClick={() => setOpen((o) => !o)} style={{ padding: "8px 10px", borderRadius: radius.panelCompact, backgroundColor: "rgba(20,29,29,0.6)", border: `1px solid rgba(215,167,111,0.16)`, display: "flex", flexDirection: "column", gap: "3px", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <span style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "13px", color }}>
          <span style={{ color: "rgba(215,167,111,0.45)", marginRight: "5px", fontSize: "9px", fontStyle: "normal" }}>{open ? "▾" : "▸"}</span>{def.name}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
          <TierChip tierId={tier} min={!owned && !!def.minTier} />
          {known && <span title="Known" style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: colors.gold, flexShrink: 0 }} />}
        </div>
      </div>
      {stat && <div style={{ fontSize: "9px", color: "rgba(237,228,208,0.6)", letterSpacing: "0.03em" }}>{stat}</div>}
      {req && <div style={{ fontSize: "9px", color: "rgba(127,199,224,0.8)", letterSpacing: "0.03em" }}>{req}</div>}
      {open && def.desc && <div style={{ fontSize: "10px", color: "rgba(237,228,208,0.85)", lineHeight: 1.45 }}>{def.desc}</div>}
    </div>
  );
}

function AbilityCatalog({ codex, character }) {
  const [cat, setCat] = useState("all");
  const [knownOnly, setKnownOnly] = useState(false);
  const known = useMemo(() => new Set([
    ...((character?.abilities) || []).map((a) => (typeof a === "string" ? a : a.id)),
    ...Object.keys(codex.skills || {}),
    ...Object.keys(codex.spells || {}),
  ]), [character, codex.skills, codex.spells]);
  // The tier the PLAYER actually holds an ability at (their usable list wins, then
  // a taught codex skill). Undiscovered abilities have no entry here — they show
  // their tier FLOOR (lowest possible grade) instead.
  const ownedTier = useMemo(() => {
    const m = {};
    for (const a of (character?.abilities || [])) {
      const id = typeof a === "string" ? a : a.id;
      if (id && !(id in m)) m[id] = typeof a === "string" ? "common" : (a.tier || "common");
    }
    for (const [id, s] of Object.entries(codex.skills || {})) {
      if (s?.combatAbility && s.tier && !(id in m)) m[id] = s.tier;
    }
    return m;
  }, [character, codex.skills]);
  const dispTier = (d) => ownedTier[d.id] || d.minTier || d.tier || "common";
  const sections = useMemo(() => ABILITY_CATEGORIES.map((c) => ({
    ...c, items: ABILITY_CATALOG.filter((d) => abilityCategoryOf(d) === c.key),
  })).filter((s) => s.items.length), []);
  const visible = sections
    .filter((s) => cat === "all" || s.key === cat)
    .map((s) => ({ ...s, items: knownOnly ? s.items.filter((d) => known.has(d.id)) : s.items }))
    .filter((s) => s.items.length);
  const FILTERS = [{ key: "all", label: "All" }, ...ABILITY_CATEGORIES.map((c) => ({ key: c.key, label: c.label.split(" ")[0] }))];

  return (
    <CatalogShell
      filters={FILTERS} filter={cat} setFilter={setCat}
      toggle={<ToggleChip active={knownOnly} label="Known" title="Show only abilities you know" onClick={() => setKnownOnly((v) => !v)} />}
      sections={visible}
      summary={(total, cats) => `${total} ${knownOnly ? "known" : "defined"} · ${cats} ${plurCat(cats)}`}
      tierOf={dispTier}
      renderRow={(d, t) => <AbilityRow def={d} known={known.has(d.id)} tier={t} owned={ownedTier[d.id] != null} />}
    />
  );
}

// ===========================================================================
// PASSIVE CATALOG — every affix the game can roll or forge, grouped by role, with
// its EXACT effect across its whole grade range (tier floor → divine), its tier
// floor, scope, and fusion lineage. Built for review/audit: no chip is opaque,
// no number is guessed at. Mirrors the item & ability catalogs (collapsible).
// ===========================================================================

const PASSIVE_CATEGORIES = [
  { key: "offence",  label: "Offence",          short: "Offence",  color: "#e0a3a3" },
  { key: "defence",  label: "Defence",          short: "Defence",  color: "#9fc7e0" },
  { key: "sustain",  label: "Sustain",          short: "Sustain",  color: "#a7f3d0" },
  { key: "tempo",    label: "Tempo & Action",   short: "Tempo",    color: "#e6c878" },
  { key: "resource", label: "Resource",         short: "Resource", color: "#c4a6f0" },
  { key: "control",  label: "Control",          short: "Control",  color: "#86d27a" },
  { key: "power",    label: "Legendary Powers",  short: "Powers",   color: "#f5d76e" },
  { key: "paragon",  label: "Paragon (Attribute)", short: "Paragon", color: "#f0c674" },
  { key: "divine",   label: "Divine Powers",     short: "Divine",   color: "#fbf5e3" },
  { key: "fusion",   label: "Fusion (Forged)",   short: "Fusion",   color: "#c79be0" },
  { key: "world",    label: "World & Travel",     short: "World",    color: "#8fd0c0" },
];

// Fusion lineage of an affix: forged-from recipe, or what it can be forged into.
function fusionNote(id) {
  const result = FUSIONS.find((f) => f.result === id);
  if (result) {
    const a = passiveDef(result.a)?.name || result.a;
    const b = passiveDef(result.b)?.name || result.b;
    const rune = RUNES[result.rune]?.name || result.rune;
    return `Forged from ${a} + ${b} + ${rune}.`;
  }
  const parts = FUSIONS.filter((f) => f.a === id || f.b === id).map((f) => {
    const other = passiveDef(f.a === id ? f.b : f.a)?.name || (f.a === id ? f.b : f.a);
    return `${passiveDef(f.result)?.name || f.result} (with ${other})`;
  });
  return parts.length ? `Fuses into ${parts.join("; ")}.` : null;
}

function PassiveRow({ def }) {
  const [open, setOpen] = useState(false);
  const color = tierInfo(def.minTier || "common").color; // name reads as its tier floor (role is the section)
  const effect = passiveEffectRange(def.id);
  const fnote = fusionNote(def.id);
  return (
    <div onClick={() => setOpen((o) => !o)} style={{ padding: "8px 10px", borderRadius: radius.panelCompact, backgroundColor: "rgba(20,29,29,0.6)", border: "1px solid rgba(215,167,111,0.16)", display: "flex", flexDirection: "column", gap: "3px", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <span style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "13px", color }}>
          <span style={{ color: "rgba(215,167,111,0.45)", marginRight: "5px", fontSize: "9px", fontStyle: "normal" }}>{open ? "▾" : "▸"}</span>{def.name}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
          {def.noRoll && <span title="Forged only — never drops as loot" style={{ fontSize: "8px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", padding: "1px 6px", borderRadius: "6px", color: "#c79be0", border: "1px solid #c79be055", backgroundColor: "#c79be014" }}>Forged</span>}
          <TierChip tierId={def.minTier} min />
        </div>
      </div>
      {effect && <div style={{ fontSize: "10px", color: "rgba(237,228,208,0.78)", lineHeight: 1.4 }}>{effect}</div>}
      <div style={{ ...accentMeta, fontSize: "8px" }}>{def.scope === "world" ? "Exploration" : "Combat"} · {def.type}</div>
      {open && def.desc && <div style={{ fontSize: "10px", fontStyle: "italic", color: "rgba(237,228,208,0.6)", lineHeight: 1.45, marginTop: "2px" }}>{def.desc}</div>}
      {open && fnote && <div style={{ fontSize: "10px", color: "#c79be0", lineHeight: 1.4 }}>{fnote}</div>}
    </div>
  );
}

function PassiveCatalog() {
  const [cat, setCat] = useState("all");
  const sections = useMemo(() => PASSIVE_CATEGORIES.map((c) => ({
    ...c, items: PASSIVES.filter((p) => p.cat === c.key),
  })).filter((s) => s.items.length), []);
  const visible = sections.filter((s) => cat === "all" || s.key === cat);
  const FILTERS = [{ key: "all", label: "All" }, ...PASSIVE_CATEGORIES.map((c) => ({ key: c.key, label: c.short }))];

  return (
    <CatalogShell
      filters={FILTERS} filter={cat} setFilter={setCat}
      sections={visible}
      summary={(total, cats) => `${total} affix${total === 1 ? "" : "es"} · ${cats} ${plurCat(cats)} · tap any for detail`}
      tierOf={(d) => d.minTier || "common"}
      tierSuffix=" floor"
      renderRow={(d) => <PassiveRow def={d} />}
    />
  );
}

// Reference glossary — plain-language explanations of the game's concepts,
// grouped by category, each row tapping open to its detail.
function GlossaryRow({ term, text }) {
  const [open, setOpen] = useState(false);
  return (
    <button onClick={() => setOpen((o) => !o)} style={{
      width: "100%", textAlign: "left", fontFamily: "inherit", cursor: "pointer",
      background: "rgba(20,29,29,0.5)", border: `1px solid rgba(215,167,111,0.18)`,
      borderRadius: radius.panelCompact, padding: "11px 13px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "16px", color: colors.parchmentLight }}>{term}</span>
        <span style={{ color: "rgba(215,167,111,0.6)", fontSize: "13px" }}>{open ? "▾" : "▸"}</span>
      </div>
      {open && <div style={{ fontSize: "13px", color: "rgba(237,228,208,0.85)", lineHeight: 1.5, marginTop: "7px" }}>{text}</div>}
    </button>
  );
}

// Reference list of every buff and debuff the game can place on you — drawn
// from the condition registry, grouped by polarity and SORTED BY TIER (rarity),
// each tapping open to what triggers it, what it does mechanically, and its
// engine tags (timer / stops-healing / damage- or heal-per-hour).
function conditionTags(meta) {
  const tags = [];
  tags.push(meta.duration != null ? `lasts ~${fmtRemaining(meta.duration)}` : (meta.isNeed ? "while the need lasts" : "until treated"));
  if (meta.blocksHealing) tags.push("stops natural healing");
  if (meta.dotPerHour) tags.push(`−${meta.dotPerHour} vitality/hour`);
  if (meta.regenPerHour) tags.push(`+${meta.regenPerHour} vitality/hour`);
  return tags.join(" · ");
}

function ConditionRow({ name, meta }) {
  const [open, setOpen] = useState(false);
  const pal = conditionPalette(meta.polarity);
  const tc = tierColor(meta.tier);
  return (
    <button onClick={() => setOpen((o) => !o)} style={{
      width: "100%", textAlign: "left", fontFamily: "inherit", cursor: "pointer",
      background: "rgba(20,29,29,0.5)", border: `1px solid rgba(215,167,111,0.18)`,
      borderRadius: radius.panelCompact, padding: "11px 13px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: 0, flexWrap: "wrap" }}>
          <span style={{
            ...metaStyle, fontSize: "11px", letterSpacing: "0.12em",
            color: pal.color, background: pal.bg, border: `1px solid ${pal.border}`,
            padding: "3px 9px", borderRadius: radius.pill, textShadow: `0 0 6px ${pal.glow}`,
          }}>{name}</span>
          <span style={{
            ...metaStyle, fontSize: "8px", letterSpacing: "0.14em",
            color: tc, border: `1px solid ${tc}66`, background: `${tc}14`,
            padding: "2px 7px", borderRadius: radius.pill,
          }}>{tierLabel(meta.tier)}</span>
        </div>
        <span style={{ color: "rgba(215,167,111,0.6)", fontSize: "13px", flexShrink: 0 }}>{open ? "▾" : "▸"}</span>
      </div>
      <div style={{ ...subtleMeta, marginTop: "6px", letterSpacing: "0.06em", textTransform: "none" }}>
        {conditionTags(meta)}{hasCombatEffect(name) ? " · ⚔ takes effect in battle" : ""}
      </div>
      {open && (
        <div style={{ marginTop: "9px", display: "flex", flexDirection: "column", gap: "7px" }}>
          {meta.effect && (
            <div style={{ fontSize: "13px", color: "rgba(237,228,208,0.9)", lineHeight: 1.5 }}>
              <span style={{ ...subtleMeta, color: pal.color, marginRight: "6px", textTransform: "uppercase" }}>Effect</span>{meta.effect}
            </div>
          )}
          {meta.trigger && (
            <div style={{ fontSize: "13px", color: "rgba(237,228,208,0.78)", lineHeight: 1.5 }}>
              <span style={{ ...subtleMeta, marginRight: "6px", textTransform: "uppercase" }}>Triggered by</span>{meta.trigger}
            </div>
          )}
          {meta.desc && (
            <div style={{ fontSize: "13px", fontFamily: fonts.serif, fontStyle: "italic", color: "rgba(237,228,208,0.7)", lineHeight: 1.5 }}>{meta.desc}</div>
          )}
        </div>
      )}
    </button>
  );
}

function ConditionsView() {
  const all = Object.entries(CONDITIONS).map(([name, meta]) => ({ name, meta }));
  const byTier = (a, b) => tierOrder(a.meta.tier) - tierOrder(b.meta.tier) || a.name.localeCompare(b.name);
  const groups = [
    { label: "Buffs", items: all.filter((c) => c.meta.polarity === "buff").sort(byTier) },
    { label: "Debuffs", items: all.filter((c) => c.meta.polarity !== "buff").sort(byTier) },
  ];
  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {groups.map((g) => g.items.length ? (
        <div key={g.label}>
          <div style={{ ...accentMeta, marginBottom: "8px", fontWeight: 700 }}>{g.label} · {g.items.length}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
            {g.items.map((c) => <ConditionRow key={c.name} name={c.name} meta={c.meta} />)}
          </div>
        </div>
      ) : null)}
    </div>
  );
}

function GlossaryView() {
  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {GLOSSARY_CATEGORIES.map((cat) => {
        const items = GLOSSARY.filter((g) => g.category === cat);
        if (!items.length) return null;
        return (
          <div key={cat}>
            <div style={{ ...accentMeta, marginBottom: "8px", fontWeight: 700 }}>{cat}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
              {items.map((g) => <GlossaryRow key={g.id} term={g.term} text={g.text} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CodexEntry({ entry, kind, codex, onScry, onRename }) {
  const [open, setOpen] = useState(false);
  // Alt+click the header to reveal hidden audit fields (attractiveness int +
  // lifespanMultiplier value). These bias the narrator if they leak into prose,
  // so they're hidden by default and surfaced only on deliberate dev inspect.
  // Per-entry; persists across sessions in localStorage.codexAudit.
  const [audit, setAudit] = useState(() => {
    try { return !!JSON.parse(localStorage.getItem("codexAudit") || "{}")[entry.id]; } catch { return false; }
  });
  const toggleAudit = () => setAudit((prev) => {
    const next = !prev;
    try {
      const s = JSON.parse(localStorage.getItem("codexAudit") || "{}");
      if (next) s[entry.id] = true; else delete s[entry.id];
      localStorage.setItem("codexAudit", JSON.stringify(s));
    } catch {}
    return next;
  });
  const wornNames = (kind === "characters" && entry.worn?.length)
    ? entry.worn.map(id => (codex.items[id] || itemTemplate(id))?.name || id) : [];
  const knowsList = (kind === "characters" && entry.knows?.length) ? entry.knows : [];
  const memoriesList = (kind === "characters" && entry.memories?.length) ? entry.memories : [];
  const hasBond = kind === "characters" && entry.kind !== "player" && ((entry.relationship || 0) !== 0 || memoriesList.length > 0);
  const bondTier = hasBond ? relationshipTier(entry.relationship || 0) : null;
  const hasAttrs = kind === "characters" && entry.attributes;
  const narrativeAppearance = entry.base_appearance || (typeof entry.appearance === "string" ? entry.appearance : null);
  const structuredAppearance = kind === "characters" && entry.appearance && typeof entry.appearance === "object" ? entry.appearance : null;

  // Brief one-line preview shown while collapsed (keeps the list scannable).
  const metaLine = kind === "characters"
    ? [codex.races?.[entry.race]?.name || entry.race, entry.kind === "mount" ? entry.species : (codex.professions?.[entry.profession]?.name || entry.profession), originLabel(entry.origin)].filter(Boolean).join(" · ")
    : "";
  const trunc = (s, n = 100) => { const t = (s || "").trim(); return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t; };
  const isCharacter = kind === "characters";
  const summaryText = trunc(entry.description || narrativeAppearance || "", isCharacter ? 138 : 100);
  const preview = isCharacter ? summaryText : (metaLine || summaryText);
  const recordLabel = CODEX_TABS.find((tab) => tab.key === kind)?.label || kind;
  const onToggle = (event) => {
    if (event.altKey && isCharacter) {
      event.preventDefault();
      toggleAudit();
      return;
    }
    setOpen((current) => !current);
  };

  return (
    <article className={`codex-entry${isCharacter ? " codex-entry--character" : " codex-entry--record"}${open ? " is-open" : ""}`}>
      <div className="codex-entry__header">
        {isCharacter && <CharacterPortrait entry={entry} />}
        <button
          type="button"
          className="codex-entry__summary"
          onClick={onToggle}
          title={isCharacter ? "Alt-click to toggle audit fields" : undefined}
          aria-expanded={open}
        >
          <span className="codex-entry__eyebrow">{isCharacter ? (metaLine || characterKindLabel(entry)) : recordLabel}</span>
          <span className="codex-entry__name-row">
            <strong>{entry.name}</strong>
            {audit && <span>Dev audit</span>}
          </span>
          <span className="codex-entry__badges">
            {bondTier && (
              <span style={{ "--badge-color": bondTier.color }}>
                {bondTier.label} {(entry.relationship || 0) > 0 ? "+" : ""}{entry.relationship || 0}
              </span>
            )}
            {entry.common && <span>Baseline</span>}
            {entry.kind === "player" && <span>You</span>}
            {kind === "skills" && typeof entry.rating === "number" && <span>Rating {entry.rating}</span>}
          </span>
          {!open && preview && <span className="codex-entry__preview">{preview}</span>}
        </button>

        <div className="codex-entry__actions">
          {onRename && (
            <button type="button" onClick={onRename}>Rename</button>
          )}
          {onScry && (
            <button type="button" className="is-scry" onClick={onScry}>Scry</button>
          )}
          <span className="codex-entry__chevron" aria-hidden="true">{open ? "−" : "+"}</span>
        </div>
      </div>

      {open && (<div className="codex-entry__details">

      {kind === "characters" && (entry.race || entry.profession || entry.origin) && (
        <div style={{ ...accentMeta, fontSize: "9px", letterSpacing: "0.10em", marginTop: "6px", marginBottom: "6px" }}>
          {[
            codex.races[entry.race]?.name || entry.race,
            codex.professions[entry.profession]?.name || entry.profession,
            originLabel(entry.origin),
          ].filter(Boolean).join(" · ")}
        </div>
      )}

      {kind === "characters" && (entry.age != null || entry.gender || (entry.agingMode && entry.agingMode !== "mortal") || audit) && (
        <div style={{ fontSize: "12px", color: "rgba(215, 167, 111, 0.7)", marginBottom: "8px", fontFamily: fonts.serif, fontStyle: "italic" }}>
          {[
            entry.age != null ? entry.age : null,
            entry.gender,
            // Attractiveness int + descriptor: hidden by default (would bias narration if surfaced).
            // Alt+click the entry header to reveal — see toggleAudit above.
            audit ? attractivenessLabel(entry.attractiveness) : null,
            // Aging-mode label: terse by default (just the mode name);
            // the lifespanMultiplier number is dev-only.
            audit
              ? agingModeLabel(entry.agingMode, entry)
              : (entry.agingMode && entry.agingMode !== "mortal" ? entry.agingMode : null),
          ].filter(Boolean).join(" · ")}
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

      {kind === "races" && RACES[entry.id] && <RaceKit raceId={entry.id} />}

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

      {memoriesList.length > 0 && (
        <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: `1px dashed rgba(215, 167, 111, 0.2)` }}>
          <div style={{ ...accentMeta, marginBottom: "6px", fontWeight: 600 }}>Shared history</div>
          <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "13px", color: colors.parchment, lineHeight: "1.5" }}>
            {memoriesList.map((m, i) => (
              <li key={i} style={{ fontFamily: fonts.serif, fontStyle: "italic", marginBottom: "2px", color: colors.parchmentLight }}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      </div>)}
    </article>
  );
}

export function CodexView({ state, onClose, onScry, onRenameMount, embedded = false }) {
  const codex = state.world.codex;
  const scryable = onScry && canScry(state);
  const partyIds = new Set(state.party || []);
  const [activeTab, setActiveTab] = useState("characters");
  let entries = Object.values(codex[activeTab] || {});
  // Characters: always pin the player (self) to the very top.
  if (activeTab === "characters") {
    entries = [...entries].sort((a, b) => (a.kind === "player" ? -1 : 0) - (b.kind === "player" ? -1 : 0));
  }

  return (
    <div className={`codex-view${embedded ? " codex-view--embedded deck-view" : " fade-in"}`} data-tab={activeTab} style={{ position: embedded ? "relative" : "absolute", inset: embedded ? "auto" : 0, backgroundColor: "#0b0f0e", zIndex: embedded ? 1 : 30, display: "flex", flexDirection: "column" }}>
      {!embedded && (
        <div className="codex-view__header" style={{
          padding: "calc(env(safe-area-inset-top, 0px) + 14px) 16px 12px 16px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          borderBottom: `1px solid rgba(215, 167, 111, 0.15)`,
          backgroundColor: "rgba(20, 29, 29, 0.95)",
        }}>
          <button
            onClick={onClose}
            aria-label="Close lore codex"
            style={{
              ...iconButtonStyle,
              width: "30px", height: "30px",
              backgroundColor: "rgba(215, 167, 111, 0.08)",
              border: `1px solid rgba(215, 167, 111, 0.2)`,
            }}
          >
            <Icon name="arrowLeft" size={13} color={colors.parchmentMuted} strokeWidth={2} />
          </button>
          <div className="codex-view__title">
            <span aria-hidden="true"><Icon name="book" size={21} color={colors.gold} strokeWidth={1.45} /></span>
            <div>
              <small>Living archive</small>
              <strong style={{ fontFamily: fonts.serif, fontSize: "24px", fontStyle: "italic", color: colors.parchmentLight }}>Lore Codex</strong>
            </div>
          </div>
          <div style={{ width: "30px" }} />
        </div>
      )}

      {embedded && (
        <div className="codex-panel__intro">
          <span className="codex-panel__intro-icon" aria-hidden="true"><Icon name="book" size={21} color={colors.gold} strokeWidth={1.4} /></span>
          <div className="codex-panel__intro-copy">
            <small>Living archive</small>
            <h3>Lore Codex</h3>
            <p>People, lore, and hard-won knowledge gathered on the road.</p>
          </div>
          <div className="codex-panel__intro-count" aria-label={`${Object.keys(codex.characters || {}).length} known characters`}>
            <strong>{Object.keys(codex.characters || {}).length}</strong>
            <span>Known</span>
          </div>
        </div>
      )}

      <div className="codex-view__tabs" role="tablist" aria-label="Codex sections">
        {CODEX_TABS.map((tab) => {
          const count = tab.key === "items" ? CATALOG_ITEM_COUNT : tab.key === "abilities" ? ABILITY_CATALOG.length : tab.key === "passives" ? PASSIVES.length : tab.key === "glossary" ? GLOSSARY.length : tab.key === "conditions" ? Object.keys(CONDITIONS).length : Object.keys(codex[tab.key] || {}).length;
          const active = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              id={`codex-tab-${tab.key}`}
              className={active ? "is-active" : ""}
              data-group={tab.group}
              onClick={() => setActiveTab(tab.key)}
              role="tab"
              aria-selected={active}
              aria-controls={`codex-panel-${tab.key}`}
              tabIndex={active ? 0 : -1}
            >
              <Icon name={tab.icon} size={15} strokeWidth={1.5} />
              <span>{tab.label}</span>
              {count > 0 && <strong>{count}</strong>}
            </button>
          );
        })}
      </div>

      <div className="codex-view__content" style={{ flex: 1, overflowY: embedded ? "visible" : "auto" }}>
        <div
          key={activeTab}
          id={`codex-panel-${activeTab}`}
          className="codex-view__tab-panel"
          role="tabpanel"
          aria-labelledby={`codex-tab-${activeTab}`}
        >
        {activeTab === "items" ? (
          <ItemCatalog codex={codex} />
        ) : activeTab === "abilities" ? (
          <AbilityCatalog codex={codex} character={state.character} />
        ) : activeTab === "passives" ? (
          <PassiveCatalog />
        ) : activeTab === "conditions" ? (
          <ConditionsView />
        ) : activeTab === "glossary" ? (
          <GlossaryView />
        ) : entries.length === 0 ? (
          <div style={{ marginTop: "80px", textAlign: "center", fontFamily: fonts.serif, fontStyle: "italic", color: "rgba(215, 167, 111, 0.45)", fontSize: "16px", lineHeight: "1.6", padding: "0 24px" }}>
            Nothing recorded here yet.<br />
            <span style={{ fontSize: "13px", color: "rgba(215, 167, 111, 0.3)" }}>Discover lore by wandering the realm.</span>
          </div>
        ) : (
          <div className={`codex-entry-list fade-in${activeTab === "characters" ? " is-characters" : ""}`}>
            {entries.map((e) => <CodexEntry key={e.id} entry={e} kind={activeTab} codex={codex}
              onScry={scryable && activeTab === "characters" && e.kind !== "player" && !partyIds.has(e.id) ? () => onScry(e.id) : null}
              onRename={onRenameMount && activeTab === "characters" && e.kind === "mount" ? () => onRenameMount(e.id) : null} />)}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
