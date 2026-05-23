import React, { useState, useMemo } from "react";
import { Icon } from "./Icon.jsx";
import { iconButtonStyle } from "./primitives.jsx";
import { colors, shadow, radius, fonts, metaStyle } from "./tokens.js";
import { ATTR_KEYS, ATTR_LABELS, originLabel } from "../config.js";
import { relationshipTier } from "../engine/relationships.js";
import { itemTemplate } from "../data/catalog.js";
import { EQUIPMENT, MATERIALS } from "../data/equipment.js";
import { tier as tierInfo, tierLabel, tierOrder } from "../data/tiers.js";
import { weaponCategory, armorClass, itemCombatStats, itemRequirement } from "../engine/combat-stats.js";
import { passiveLabel, passiveDef, isFusionRune } from "../data/passives.js";
import { getAbilityDef } from "../data/abilities.js";
import { RACES } from "../data/races.js";

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

function TierChip({ tierId }) {
  const t = tierInfo(tierId || "common");
  return (
    <span style={{ fontSize: "8px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", padding: "1px 6px", borderRadius: "6px", color: t.color, border: `1px solid ${t.color}55`, backgroundColor: `${t.color}14`, flexShrink: 0 }}>
      {t.label}
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
  const desc = def?.desc || "";
  const accent = kind === "ability" ? "127,199,224" : "176,114,230";
  return (
    <>
      <span onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} title={desc}
        style={{ fontSize: "8px", padding: "1px 5px", borderRadius: "5px", cursor: "pointer",
          backgroundColor: `rgba(${accent},0.12)`, color: `rgba(${accent},0.95)`, border: `1px solid rgba(${accent},0.3)` }}>
        {label}{desc ? <span style={{ opacity: 0.55, marginLeft: "3px", fontSize: "8px" }}>{open ? "▾" : "ⓘ"}</span> : null}
      </span>
      {open && desc && (
        <span style={{ flexBasis: "100%", width: "100%", fontSize: "9px", color: "rgba(237,228,208,0.62)", lineHeight: 1.4, margin: "1px 0 2px 3px" }}>{desc}</span>
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
          <span style={{ color: "rgba(215,167,111,0.45)", marginRight: "5px", fontSize: "9px", fontStyle: "normal" }}>{open ? "▾" : "▸"}</span>{item.name}
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

function ItemCatalog({ codex }) {
  const [type, setType] = useState("all");
  const [discoveredOnly, setDiscoveredOnly] = useState(false);
  const [openSecs, setOpenSecs] = useState(() => new Set());
  const seen = useMemo(() => new Set(Object.keys(codex.items || {})), [codex.items]);
  const sections = useMemo(() => buildCatalogSections(), []);

  const visible = sections
    .filter((s) => type === "all" || s.group === type)
    .map((s) => ({ ...s, items: discoveredOnly ? s.items.filter((it) => seen.has(it.id)) : s.items }))
    .filter((s) => s.items.length);
  const total = visible.reduce((n, s) => n + s.items.length, 0);
  const allKeys = visible.map((s) => s.key);
  const allOpen = allKeys.length > 0 && allKeys.every((k) => openSecs.has(k));
  const toggleSec = (k) => setOpenSecs((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* content-type filter + discovered toggle */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
        {TYPE_FILTERS.map((f) => {
          const active = f.key === type;
          return (
            <button key={f.key} onClick={() => setType(f.key)} style={{
              padding: "5px 10px", borderRadius: radius.panelCompact, border: "1px solid",
              borderColor: active ? "rgba(215,167,111,0.45)" : "rgba(215,167,111,0.1)",
              backgroundColor: active ? "rgba(215,167,111,0.14)" : "rgba(10,15,15,0.4)",
              color: active ? colors.parchmentLight : "rgba(215,167,111,0.55)",
              fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}>{f.label}</button>
          );
        })}
        <button onClick={() => setDiscoveredOnly((v) => !v)} title="Show only items discovered in play" style={{
          marginLeft: "auto", padding: "5px 10px", borderRadius: radius.panelCompact, border: "1px solid",
          borderColor: discoveredOnly ? "rgba(215,167,111,0.45)" : "rgba(215,167,111,0.1)",
          backgroundColor: discoveredOnly ? "rgba(215,167,111,0.14)" : "rgba(10,15,15,0.4)",
          color: discoveredOnly ? colors.gold : "rgba(215,167,111,0.5)",
          fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        }}>{discoveredOnly ? "● Discovered" : "○ Discovered"}</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ ...accentMeta, fontSize: "9px" }}>{total} item{total === 1 ? "" : "s"}{discoveredOnly ? " discovered" : " in catalog"} · {visible.length} categor{visible.length === 1 ? "y" : "ies"}</div>
        {visible.length > 0 && (
          <button onClick={() => setOpenSecs(allOpen ? new Set() : new Set(allKeys))} style={{ marginLeft: "auto", padding: "4px 9px", borderRadius: radius.panelCompact, border: "1px solid rgba(215,167,111,0.2)", backgroundColor: "rgba(10,15,15,0.4)", color: "rgba(215,167,111,0.7)", fontSize: "10px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>

      {total === 0 ? (
        <div style={{ marginTop: "40px", textAlign: "center", fontFamily: fonts.serif, fontStyle: "italic", color: "rgba(215,167,111,0.45)", fontSize: "15px" }}>
          Nothing to show here.
        </div>
      ) : visible.map((s) => {
        const isOpen = openSecs.has(s.key);
        return (
          <div key={s.key} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <button onClick={() => toggleSec(s.key)} style={{
              display: "flex", alignItems: "center", gap: "8px", width: "100%", textAlign: "left",
              backgroundColor: "rgba(20,29,29,0.5)", border: "1px solid rgba(215,167,111,0.18)",
              borderRadius: radius.panelCompact, padding: "8px 10px", cursor: "pointer", fontFamily: "inherit",
            }}>
              <span style={{ color: "rgba(215,167,111,0.6)", fontSize: "10px" }}>{isOpen ? "▾" : "▸"}</span>
              <span style={{ ...subtleMeta, fontSize: "10px", letterSpacing: "0.1em", color: "rgba(215,167,111,0.9)" }}>{s.label}</span>
              <span style={{ flex: 1 }} />
              <span style={{ ...accentMeta, fontSize: "8px" }}>{s.items.length}</span>
            </button>
            {isOpen && s.items.map((it, i) => {
              const prev = s.items[i - 1];
              const showTier = !prev || (prev.tier || "common") !== (it.tier || "common");
              return (
                <React.Fragment key={it.id}>
                  {showTier && (
                    <div style={{ ...accentMeta, fontSize: "8px", letterSpacing: "0.14em", color: tierInfo(it.tier || "common").color, marginTop: i ? "4px" : 0, opacity: 0.8, paddingLeft: "4px" }}>
                      {tierLabel(it.tier || "common")}
                    </div>
                  )}
                  <CatalogRow item={it} seen={seen.has(it.id)} />
                </React.Fragment>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function CodexEntry({ entry, kind, codex }) {
  const [open, setOpen] = useState(false);
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
    ? [codex.races?.[entry.race]?.name || entry.race, codex.professions?.[entry.profession]?.name || entry.profession, originLabel(entry.origin)].filter(Boolean).join(" · ")
    : "";
  const trunc = (s, n = 100) => { const t = (s || "").trim(); return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t; };
  const preview = metaLine || trunc(entry.description || narrativeAppearance || "");

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
      <div onClick={() => setOpen((o) => !o)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "7px", minWidth: 0 }}>
          <span style={{ color: "rgba(215,167,111,0.5)", fontSize: "10px", flexShrink: 0 }}>{open ? "▾" : "▸"}</span>
          <div style={{
            fontFamily: fonts.serif, fontStyle: "italic",
            fontSize: "17px", color: colors.parchmentLight,
            textShadow: "0 1px 4px rgba(0,0,0,0.25)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {entry.name}
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {bondTier && (
            <span style={{ fontSize: "9px", fontWeight: 800, padding: "2px 8px", borderRadius: "8px", color: bondTier.color, border: `1px solid ${bondTier.color}55`, backgroundColor: `${bondTier.color}14` }}>
              {bondTier.label} {(entry.relationship || 0) > 0 ? "+" : ""}{entry.relationship || 0}
            </span>
          )}
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

      {!open && preview && (
        <div onClick={() => setOpen(true)} style={{ fontSize: "10px", color: "rgba(237,228,208,0.5)", lineHeight: 1.4, marginTop: "4px", marginLeft: "17px", cursor: "pointer" }}>{preview}</div>
      )}
      {open && (<>

      {kind === "characters" && (entry.race || entry.profession || entry.origin) && (
        <div style={{ ...accentMeta, fontSize: "9px", letterSpacing: "0.10em", marginTop: "6px", marginBottom: "6px" }}>
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
      </>)}
    </div>
  );
}

export function CodexView({ state, onClose }) {
  const codex = state.world.codex;
  const [activeTab, setActiveTab] = useState("characters");
  let entries = Object.values(codex[activeTab] || {});
  // Characters: always pin the player (self) to the very top.
  if (activeTab === "characters") {
    entries = [...entries].sort((a, b) => (a.kind === "player" ? -1 : 0) - (b.kind === "player" ? -1 : 0));
  }

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
          const count = tab.key === "items" ? CATALOG_ITEM_COUNT : Object.keys(codex[tab.key] || {}).length;
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
        {activeTab === "items" ? (
          <ItemCatalog codex={codex} />
        ) : entries.length === 0 ? (
          <div style={{ marginTop: "80px", textAlign: "center", fontFamily: fonts.serif, fontStyle: "italic", color: "rgba(215, 167, 111, 0.45)", fontSize: "16px", lineHeight: "1.6", padding: "0 24px" }}>
            Nothing recorded here yet.<br />
            <span style={{ fontSize: "13px", color: "rgba(215, 167, 111, 0.3)" }}>Discover lore by wandering the realm.</span>
          </div>
        ) : (
          <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
            {entries.map((e) => <CodexEntry key={e.id} entry={e} kind={activeTab} codex={codex} />)}
          </div>
        )}
      </div>
    </div>
  );
}
