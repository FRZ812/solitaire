import React, { useEffect, useState, useMemo, useRef } from "react";
import { Icon, ItemIcon } from "./Icon.jsx";
import { AbilityIcon } from "./AbilityIcon.jsx";
import { AtlasIcon } from "./AtlasIcon.jsx";
import { DeckPage, DeckPageHeader } from "./DeckPage.jsx";
import { iconButtonStyle, conditionPalette, fmtRemaining } from "./primitives.jsx";
import { colors, shadow, radius, fonts, metaStyle } from "./tokens.js";
import { ATTR_KEYS, ATTR_LABELS, originLabel } from "../config.js";
import { GLOSSARY, GLOSSARY_CATEGORIES } from "../data/glossary.js";
import { CONDITIONS } from "../data/conditions.js";
import { hasCombatEffect } from "../engine/condition-combat.js";
import { relationshipTier } from "../engine/relationships.js";
import { ALL_ITEMS, itemTemplate } from "../data/catalog.js";
import { canScry, canTrackCharacter } from "../engine/positions.js";
import { tier as tierInfo, tierLabel, tierOrder, tierColor } from "../data/tiers.js";
import { weaponCategory, armorClass, itemCombatStats, itemRequirement } from "../engine/combat-stats.js";
import { passiveLabel, passiveDef, passiveEffectText, passiveEffectRange, PASSIVES, FUSIONS, RUNES, isFusionRune } from "../data/passives.js";
import { getAbilityDef, ABILITY_CATALOG, abilityStatLine, abilityReqLine } from "../data/abilities.js";
import { MAGIC_SCHOOLS, abilityTaxonomy } from "../data/ability-taxonomy.js";
import { RACES } from "../data/races.js";
import { PROFESSIONS } from "../data/professions.js";
import { descriptorFor } from "../data/attractiveness.js";
import {
  createPortraitVariantToken,
  isPortraitVariantToken,
  portraitVariantsFor,
  resolveCharacterPortrait,
  selectedPortraitVariantNumber,
} from "./character-portrait-assets.js";
import { ProfessionIcon } from "./ProfessionIcon.jsx";
import { characterDossierBackground } from "./character-dossier-background.js";
import { characterArchetype } from "../data/character-archetypes.js";
import * as progressionEngine from "../engine/progression.js";
import {
  PROFESSION_LEVEL_CAP,
  canonicalProfessionId,
  compileProfessionTrack,
  professionBranchChoices,
} from "../data/progression-paths.js";
import codexCategoryAtlas from "../assets/generated/icon-atlases/codex-categories-atlas-v1.png";
import { CODEX_PORTRAIT_IDS, resolveCodexPortrait } from "./codex-portrait-assets.js";
import {
  REGIONAL_ESTABLISHMENT_PORTRAIT_IDENTITIES,
  REPURPOSED_CODEX_PORTRAIT_IDENTITIES,
} from "./character-portrait-roster.js";
import { normalizePortraitFile, PORTRAIT_ACCEPT } from "../engine/portrait.js";

const progressionLevel = progressionEngine.progressionLevel;

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
  { key: "characters",  label: "Characters",  group: "lore",       column: 0, row: 0 },
  { key: "races",       label: "Races",       group: "lore",       column: 1, row: 0 },
  { key: "professions", label: "Professions", group: "compendium", column: 2, row: 0 },
  { key: "items",       label: "Items",       group: "compendium", column: 0, row: 1 },
  { key: "abilities",   label: "Abilities",   group: "compendium", column: 1, row: 1 },
  { key: "passives",    label: "Passives",    group: "compendium", column: 2, row: 1 },
  { key: "conditions",  label: "Conditions",  group: "reference",  column: 0, row: 2 },
  { key: "glossary",    label: "Glossary",    group: "reference",  column: 1, row: 2 },
];

const IMPORTANT_CHARACTER_IDS = new Set([
  ...CODEX_PORTRAIT_IDS,
  ...REPURPOSED_CODEX_PORTRAIT_IDENTITIES.map(({ id }) => id),
  ...REGIONAL_ESTABLISHMENT_PORTRAIT_IDENTITIES.map(({ id }) => id),
]);

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

function CharacterPortrait({ entry, portraitOverride, detail = false }) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [portraitOverride, detail]);
  const portrait = !imageFailed ? resolveCharacterPortrait(entry, null, portraitOverride) : null;
  const atlasPortrait = !portrait ? resolveCodexPortrait(entry) : null;
  const detailPortrait = detail && !imageFailed ? atlasPortrait?.detailSrc : null;
  const resolvedImage = portrait || detailPortrait;
  const backdrop = characterDossierBackground(entry);
  const customPortrait = typeof portraitOverride === "string"
    && portraitOverride.trim()
    && !isPortraitVariantToken(portraitOverride);
  return (
    <div
      className={`codex-entry__portrait${resolvedImage ? " has-image" : atlasPortrait ? " has-atlas" : " is-placeholder"}`}
      data-portrait-slot={entry.id}
      data-portrait-atlas={atlasPortrait?.atlasId}
      data-portrait-source={detailPortrait ? "detail" : portrait ? "character" : atlasPortrait ? "atlas" : "placeholder"}
      style={{ "--portrait-hue": portraitHue(entry.id) }}
      role={!resolvedImage && !atlasPortrait ? "img" : undefined}
      aria-label={!resolvedImage && !atlasPortrait ? `${entry.name} portrait placeholder` : undefined}
    >
      <img
        className="codex-entry__portrait-backdrop"
        src={backdrop}
        alt=""
        aria-hidden="true"
        draggable="false"
        loading={detail ? "eager" : "lazy"}
        decoding="async"
        data-dossier-background-for={entry.id}
      />
      {resolvedImage
        ? <img className={`codex-entry__portrait-figure${customPortrait ? " is-custom" : ""}`} src={resolvedImage} alt={`${entry.name} portrait`} draggable="false" loading={detail ? "eager" : "lazy"} decoding="async" onError={() => setImageFailed(true)} />
        : atlasPortrait
          ? <AtlasIcon src={atlasPortrait.atlas} columns={atlasPortrait.grid.columns} rows={atlasPortrait.grid.rows} column={atlasPortrait.cell.column} row={atlasPortrait.cell.row} size="100%" shape="portrait" label={`${entry.name} portrait`} iconKey={`codex-portrait:${entry.id}`} className="codex-entry__portrait-sprite" />
          : <><Icon name={entry.kind === "mount" ? "compass" : "user"} size={25} strokeWidth={1.25} /><strong>{portraitInitials(entry.name)}</strong></>}
      <span aria-hidden="true" />
    </div>
  );
}

export function CharacterPortraitEditor({ entry, portraitOverride, onPortraitChange }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const variants = portraitVariantsFor(entry);
  const selectedVariant = selectedPortraitVariantNumber(entry, portraitOverride);
  const customPortrait = typeof portraitOverride === "string"
    && portraitOverride.trim()
    && !isPortraitVariantToken(portraitOverride);

  async function chooseBuiltInPortrait(variantNumber) {
    if (!onPortraitChange) return;
    const token = createPortraitVariantToken(entry, variantNumber);
    if (!token) return;
    setError("");
    setBusy(true);
    try {
      await onPortraitChange(entry.id, token);
    } catch (reason) {
      setError(reason?.message || "That portrait choice could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function choosePortrait(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !onPortraitChange) return;
    setError("");
    setBusy(true);
    try {
      const prepared = await normalizePortraitFile(file);
      await onPortraitChange(entry.id, prepared);
    } catch (reason) {
      setError(reason?.message || "That portrait could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPortrait() {
    if (!onPortraitChange) return;
    setError("");
    setBusy(true);
    try {
      await onPortraitChange(entry.id, null);
    } catch (reason) {
      setError(reason?.message || "That portrait could not be reset.");
    } finally {
      setBusy(false);
    }
  }

  if (!onPortraitChange) return null;
  return (
    <div className="codex-entry__portrait-editor">
      <div>
        <small>Portrait</small>
      </div>
      {variants.length > 1 && (
        <div
          role="group"
          aria-label={`Portrait choice for ${entry.name}`}
          style={{ minWidth: "auto", flex: "0 0 auto", display: "flex", gridAutoFlow: "column", gap: 5 }}
        >
          {variants.map((src, index) => {
            const variantNumber = index + 1;
            const selected = selectedVariant === variantNumber;
            return (
              <button
                type="button"
                key={variantNumber}
                aria-label={`${entry.name} portrait ${variantNumber}`}
                aria-pressed={selected}
                title={`Portrait ${variantNumber}`}
                data-portrait-choice={variantNumber}
                data-portrait-variant-token={createPortraitVariantToken(entry, variantNumber)}
                onClick={() => chooseBuiltInPortrait(variantNumber)}
                disabled={busy}
                style={{
                  width: 42,
                  height: 54,
                  minHeight: 54,
                  padding: 2,
                  display: "grid",
                  placeItems: "center",
                  overflow: "hidden",
                  borderColor: selected ? "rgba(240, 207, 141, .86)" : "rgba(231, 185, 94, .24)",
                  background: selected ? "rgba(231, 185, 94, .18)" : "rgba(4, 11, 20, .55)",
                  boxShadow: selected ? "inset 0 0 0 1px rgba(240, 207, 141, .22)" : "none",
                  letterSpacing: 0,
                }}
              >
                <img
                  src={src}
                  alt=""
                  draggable="false"
                  loading="lazy"
                  decoding="async"
                  style={{ width: 36, height: 48, display: "block", objectFit: "contain", objectPosition: "50% 50%" }}
                />
              </button>
            );
          })}
        </div>
      )}
      <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? "Preparing…" : customPortrait ? "Change upload" : "Upload portrait"}
      </button>
      {portraitOverride && <button type="button" className="is-reset" onClick={resetPortrait} disabled={busy}>Use original</button>}
      <input ref={inputRef} type="file" accept={PORTRAIT_ACCEPT} onChange={choosePortrait} tabIndex={-1} aria-hidden="true" />
      {error && <span role="alert">{error}</span>}
    </div>
  );
}

function CharacterDetailSection({ label, title, className = "", children }) {
  return (
    <section className={`codex-entry__detail-card${className ? ` ${className}` : ""}`}>
      <header className="codex-entry__detail-heading">
        <small>{label}</small>
        {title && <h3>{title}</h3>}
      </header>
      {children}
    </section>
  );
}

function CharacterFact({ label, value }) {
  if (value == null || value === "") return null;
  return (
    <div className="codex-entry__fact">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

// ===========================================================================
// ITEM CATALOG — the full canonical catalog, grouped by content type and, within
// each group, by tier. Equipment, provisions, field tools, and materials all use
// the same normalized atlas identities as the inventory and combat UI.
// ===========================================================================

const TYPE_FILTERS = [
  { key: "all", label: "All" },
  { key: "weapon", label: "Weapons" },
  { key: "armor", label: "Armour" },
  { key: "shield", label: "Shields" },
  { key: "clothing", label: "Clothing" },
  { key: "trinket", label: "Trinkets" },
  { key: "consumable", label: "Provisions" },
  { key: "tool", label: "Tools" },
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

const CATALOG_ITEM_COUNT = Object.keys(ALL_ITEMS).length;

function buildCatalogSections() {
  const all = Object.values(ALL_ITEMS);
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
  for (const [kind, label] of [["remedy", "Remedies"], ["food", "Food"], ["drink", "Drink"], ["feed", "Mount feed"]]) {
    const items = all.filter((it) => it.kind === kind);
    if (items.length) sections.push({ group: "consumable", key: `consumable-${kind}`, label: `Provisions · ${label}`, items: sortByTier(items) });
  }
  const tools = all.filter((it) => it.kind === "tool");
  if (tools.length) sections.push({ group: "tool", key: "tool", label: "Tools & field kit", items: sortByTier(tools) });
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
    <button type="button" className="codex-catalog-row" aria-expanded={open} onClick={() => setOpen((o) => !o)} style={{ padding: "8px 10px", borderRadius: radius.panelCompact, backgroundColor: "rgba(20,29,29,0.6)", border: `1px solid ${t.color}33`, display: "flex", flexDirection: "column", gap: "3px", cursor: "pointer" }}>
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
    </button>
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
    <button type="button" key={f.key} aria-pressed={f.key === value} onClick={() => onChange(f.key)} style={chipBtn(f.key === value)}>{f.label}</button>
  ));
}
function ToggleChip({ active, label, title, onClick }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} title={title} style={{ ...chipBtn(active), marginLeft: "auto", color: active ? colors.gold : "rgba(215,167,111,0.5)" }}>
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

const ABILITY_FILTERS = [
  { key: "martial", label: "Martial", color: "#e9d8b8" },
  { key: "magic", label: "Magic", color: "#c4a6f0" },
  { key: "survival", label: "Survival", color: "#86c997" },
  { key: "social", label: "Social", color: "#e0ba7b" },
  { key: "innate", label: "Innate", color: "#86d27a" },
];

function AbilityRow({ def, known, tier, owned }) {
  const [open, setOpen] = useState(false);
  const color = tierInfo(tier || "common").color; // name reads as its tier (school is the section)
  const stat = abilityStatLine(def, tier);
  const req = abilityReqLine(def);
  const taxonomy = abilityTaxonomy(def, tier);
  return (
    <button type="button" className="codex-catalog-row" aria-expanded={open} onClick={() => setOpen((o) => !o)} style={{ padding: "8px 10px", borderRadius: radius.panelCompact, backgroundColor: "rgba(20,29,29,0.6)", border: `1px solid rgba(215,167,111,0.16)`, display: "flex", flexDirection: "column", gap: "3px", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
          <AbilityIcon ability={def} tierId={tier} size="small" />
          <span style={{ display: "grid", minWidth: 0, fontFamily: fonts.serif, fontStyle: "italic", fontSize: "13px", color }}>
            <span><span style={{ color: "rgba(215,167,111,0.45)", marginRight: "5px", fontSize: "9px", fontStyle: "normal" }}>{open ? "▾" : "▸"}</span>{def.name}</span>
            <small style={{ color: "rgba(215,167,111,0.55)", fontFamily: "inherit", fontSize: "7px", fontStyle: "normal", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>{taxonomy.label}</small>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
          <TierChip tierId={tier} min={!owned && !!def.minTier} />
          {known && <span title="Known" style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: colors.gold, flexShrink: 0 }} />}
        </div>
      </div>
      {stat && <div style={{ fontSize: "9px", color: "rgba(237,228,208,0.6)", letterSpacing: "0.03em" }}>{stat}</div>}
      {req && <div style={{ fontSize: "9px", color: "rgba(127,199,224,0.8)", letterSpacing: "0.03em" }}>{req}</div>}
      {open && def.desc && <div style={{ fontSize: "10px", color: "rgba(237,228,208,0.85)", lineHeight: 1.45 }}>{def.desc}</div>}
    </button>
  );
}

// Tower archetypes use their separate five-action combat kit. The legacy
// ability catalog remains useful as a rules reference, but residue in an old
// save must never make those cards look equipped or learned. This also keeps a
// world-layer Haste boon from claiming the distinct legacy Haste combat card.
export function abilityCatalogOwnership(character, codex) {
  if (character?.progressionModel === "tow-archetype") {
    return { known: new Set(), ownedTier: {} };
  }

  const known = new Set([
    ...((character?.abilities) || []).map((ability) => (typeof ability === "string" ? ability : ability.id)),
    ...Object.keys(codex?.skills || {}),
    ...Object.keys(codex?.spells || {}),
  ]);
  const ownedTier = {};
  for (const ability of character?.abilities || []) {
    const id = typeof ability === "string" ? ability : ability.id;
    if (id && !(id in ownedTier)) {
      ownedTier[id] = typeof ability === "string" ? "common" : (ability.tier || "common");
    }
  }
  for (const [id, skill] of Object.entries(codex?.skills || {})) {
    if (skill?.combatAbility && skill.tier && !(id in ownedTier)) ownedTier[id] = skill.tier;
  }
  return { known, ownedTier };
}

function AbilityCatalog({ codex, character }) {
  const [cat, setCat] = useState("all");
  const [knownOnly, setKnownOnly] = useState(false);
  // The tier the PLAYER actually holds an ability at (their usable list wins,
  // then a taught codex skill). Undiscovered abilities have no entry here —
  // they show their tier FLOOR (lowest possible grade) instead.
  const { known, ownedTier } = useMemo(
    () => abilityCatalogOwnership(character, codex),
    [character, codex.skills, codex.spells],
  );
  const dispTier = (d) => ownedTier[d.id] || d.minTier || d.tier || "common";
  const sections = useMemo(() => [
    ...ABILITY_FILTERS.filter((c) => c.key !== "magic").map((c) => ({
      ...c,
      category: c.key,
      items: ABILITY_CATALOG.filter((d) => abilityTaxonomy(d).categoryId === c.key),
    })),
    ...Object.values(MAGIC_SCHOOLS).map((school) => ({
      key: `magic-${school.id}`,
      category: "magic",
      label: `${school.label} magic`,
      color: "#c4a6f0",
      items: ABILITY_CATALOG.filter((d) => {
        const taxonomy = abilityTaxonomy(d);
        return taxonomy.categoryId === "magic" && taxonomy.magicSchoolId === school.id;
      }),
    })),
  ].filter((s) => s.items.length), []);
  const visible = sections
    .filter((s) => cat === "all" || s.category === cat)
    .map((s) => ({ ...s, items: knownOnly ? s.items.filter((d) => known.has(d.id)) : s.items }))
    .filter((s) => s.items.length);
  const FILTERS = [{ key: "all", label: "All" }, ...ABILITY_FILTERS.map((c) => ({ key: c.key, label: c.label }))];

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

const PROFESSION_GLOSSARY_ENTRIES = Object.freeze(
  Object.values(PROFESSIONS).sort((a, b) => a.name.localeCompare(b.name)),
);

function progressionLabel(value) {
  const raw = String(value || "");
  if (/\s/.test(raw)) return raw.charAt(0).toUpperCase() + raw.slice(1);
  return raw
    .replace(/^[^:]+:/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function professionGrantLabel(grant) {
  if (!grant) return null;
  if (grant.name || grant.label) return grant.name || grant.label;
  if (grant.type === "ability") return getAbilityDef(grant.id)?.name || progressionLabel(grant.id);
  return progressionLabel(grant.id || grant.type);
}

function ProfessionStage({ segment, levels, initiallyOpen = false }) {
  const [open, setOpen] = useState(initiallyOpen);
  const stageLevels = levels.slice(segment.start - 1, segment.end);
  return (
    <details
      className="profession-glossary__disclosure profession-glossary__stage"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span>
          <small>Levels {segment.start}–{segment.end}</small>
          <strong>{segment.pathName}</strong>
        </span>
        <b>{stageLevels.length}</b>
      </summary>
      {open && <div className="profession-glossary__levels">
        {stageLevels.map((row) => {
          const grants = [...new Set((row.grants || []).map(professionGrantLabel).filter(Boolean))].slice(0, 4);
          return (
            <article key={row.trackLevel} className="profession-glossary__level">
              <em>{row.trackLevel}</em>
              <div>
                <strong>{progressionLabel(row.feature) || segment.pathName}</strong>
                {row.featureDescription && <p>{row.featureDescription}</p>}
                {grants.length > 0 && (
                  <span>{grants.join(" · ")}</span>
                )}
              </div>
            </article>
          );
        })}
      </div>}
    </details>
  );
}

function ProfessionBranchOptionDetail({ option }) {
  const grants = [...new Set((option.grants || []).map(professionGrantLabel).filter(Boolean))];
  return (
    <div className="profession-glossary__branch-detail">
      <p>{option.description}</p>
      {grants.length > 0 && <div aria-label={`${option.name} rewards`}>
        {grants.map((grant) => <span key={grant}>{grant}</span>)}
      </div>}
    </div>
  );
}

function ProfessionBranchChoice({ choice, choices, prerequisite, inspection, onInspect, depth = 1 }) {
  return (
    <section
      className="profession-glossary__branch-choice"
      data-branch-choice-id={choice.id}
      data-parent-choice={choice.parentChoiceId || undefined}
      data-parent-option={choice.parentOptionId || undefined}
      data-branch-depth={depth}
    >
      <header>
        <span>
          <small>Level {choice.threshold}</small>
          <strong>{choice.name}</strong>
        </span>
        <b>Choose 1</b>
      </header>
      <p className="profession-glossary__branch-requires">Requires {prerequisite}</p>
      <ol className="profession-glossary__branch-options">
        {choice.options.map((option) => {
          const optionKey = `${choice.id}:${option.id}`;
          const inspected = inspection === optionKey;
          const childChoices = choices.filter((candidate) => (
            candidate.parentChoiceId === choice.id && candidate.parentOptionId === option.id
          ));
          return (
            <li key={option.id} data-branch-option-id={option.id}>
              <button
                type="button"
                className={inspected ? "is-inspected" : undefined}
                aria-expanded={inspected}
                onClick={() => onInspect(inspected ? null : optionKey)}
              >
                <span>
                  <strong>{option.name}</strong>
                  <small>{childChoices.length > 0
                    ? `Unlocks level ${Math.min(...childChoices.map((entry) => entry.threshold))}`
                    : "Final path"}</small>
                </span>
                <b aria-hidden="true">{inspected ? "−" : "+"}</b>
              </button>
              {inspected && <ProfessionBranchOptionDetail option={option} />}
              {childChoices.length > 0 && <div className="profession-glossary__branch-descendants">
                {childChoices.map((childChoice) => (
                  <ProfessionBranchChoice
                    key={childChoice.id}
                    choice={childChoice}
                    choices={choices}
                    prerequisite={option.name}
                    inspection={inspection}
                    onInspect={onInspect}
                    depth={depth + 1}
                  />
                ))}
              </div>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ProfessionPathChoices({ professionId, initiallyOpen = false, initialRootOptionId = null }) {
  const [open, setOpen] = useState(initiallyOpen);
  const [activeRootOptionId, setActiveRootOptionId] = useState(initialRootOptionId);
  const [inspection, setInspection] = useState(null);
  const choices = professionBranchChoices(professionId);
  if (choices.length === 0) return null;
  const root = choices.find((choice) => !choice.parentChoiceId);
  if (!root) return null;
  const activeRootOption = root.options.find((option) => option.id === activeRootOptionId)
    || root.options.find((option) => option.id === initialRootOptionId)
    || root.options[0];
  const nextChoices = choices.filter((choice) => (
    choice.parentChoiceId === root.id && choice.parentOptionId === activeRootOption?.id
  ));
  return (
    <details
      className="profession-glossary__disclosure profession-glossary__choice-book"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span>
          <small>Exclusive advancement</small>
          <strong>Specialization tree</strong>
        </span>
        <b>{root.options.length}</b>
      </summary>
      {open && <div className="profession-glossary__branch-map">
        <div className="profession-glossary__branch-note">
          <span>Preview only</span>
          <p>Choose one option at each split. Every later node requires the path directly above it.</p>
        </div>
        <section className="profession-glossary__branch-root" data-branch-choice-id={root.id}>
          <header>
            <span>
              <small>Level {root.threshold}</small>
              <strong>{root.name}</strong>
            </span>
            <b>Choose 1</b>
          </header>
          <div className="profession-glossary__branch-root-options" aria-label={`${root.name} path preview`}>
            {root.options.map((option) => {
              const active = option.id === activeRootOption?.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={active ? "is-active" : undefined}
                  aria-pressed={active}
                  data-branch-option-id={option.id}
                  onClick={() => {
                    setActiveRootOptionId(option.id);
                    setInspection(null);
                  }}
                >
                  <strong>{option.name}</strong>
                  <small>{active ? "Viewing path" : "View path"}</small>
                </button>
              );
            })}
          </div>
          {activeRootOption && <div className="profession-glossary__branch-root-summary">
            <strong>{activeRootOption.name}</strong>
            <p>{activeRootOption.description}</p>
            {(activeRootOption.grants || []).length > 0 && <span>
              {[...new Set(activeRootOption.grants.map(professionGrantLabel).filter(Boolean))].join(" · ")}
            </span>}
          </div>}
        </section>
        {nextChoices.length > 0 && <div className="profession-glossary__branch-trunk" aria-hidden="true" />}
        <div className="profession-glossary__branch-subtree">
          {nextChoices.map((choice) => (
            <ProfessionBranchChoice
              key={choice.id}
              choice={choice}
              choices={choices}
              prerequisite={activeRootOption.name}
              inspection={inspection}
              onInspect={setInspection}
            />
          ))}
        </div>
      </div>}
    </details>
  );
}

function ProfessionSpecializations({ specializations }) {
  const [open, setOpen] = useState(false);
  if (specializations.length === 0) return null;
  return (
    <details
      className="profession-glossary__disclosure profession-glossary__specializations"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span>
          <small>Character identities · not branch choices</small>
          <strong>Known archetypes</strong>
        </span>
        <b>{specializations.length}</b>
      </summary>
      {open && <div>
        {specializations.map((specialization) => (
          <article key={specialization.id}>
            <strong>{specialization.name}</strong>
            <span>{specialization.description}</span>
          </article>
        ))}
      </div>}
    </details>
  );
}

export function ProfessionGlossary({
  initialProfessionId = null,
  initialOpenStageId = null,
  initialOpenChoices = false,
  initialBranchOptionId = null,
}) {
  const [query, setQuery] = useState("");
  const [selectedProfessionId, setSelectedProfessionId] = useState(() => (
    initialProfessionId && PROFESSIONS[initialProfessionId] ? initialProfessionId : null
  ));
  const detailRef = useRef(null);
  const detailTitleRef = useRef(null);
  const returnFocusIdRef = useRef(null);
  const selectedProfession = selectedProfessionId ? PROFESSIONS[selectedProfessionId] : null;
  const track = useMemo(
    () => (selectedProfession ? compileProfessionTrack(selectedProfession.id) : null),
    [selectedProfession],
  );
  const visibleProfessions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return PROFESSION_GLOSSARY_ENTRIES;
    return PROFESSION_GLOSSARY_ENTRIES.filter((profession) => [
      profession.name,
      profession.role,
      profession.domain,
      profession.description,
      ...(profession.specializations || []).flatMap((entry) => [entry.name, entry.description]),
    ].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [query]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.requestAnimationFrame) return undefined;
    const frame = window.requestAnimationFrame(() => {
      if (selectedProfession) {
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        detailTitleRef.current?.focus({ preventScroll: true });
        return;
      }
      const returnId = returnFocusIdRef.current;
      if (!returnId) return;
      const card = document.getElementById(`profession-card-${returnId}`);
      card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      card?.focus({ preventScroll: true });
      returnFocusIdRef.current = null;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedProfession]);

  if (selectedProfession && track) {
    const specializations = selectedProfession.specializations || [];
    return (
      <div ref={detailRef} className="profession-glossary profession-glossary--detail fade-in">
        <button
          type="button"
          className="profession-glossary__back"
          onClick={() => {
            returnFocusIdRef.current = selectedProfession.id;
            setSelectedProfessionId(null);
          }}
        >
          <Icon name="arrowLeft" size={14} />
          All professions
        </button>

        <header className="profession-glossary__hero">
          <ProfessionIcon profession={selectedProfession.id} size="hero" decorative />
          <div>
            <small>{selectedProfession.role}</small>
            <h4 ref={detailTitleRef} tabIndex={-1}>{selectedProfession.name}</h4>
            <p>{selectedProfession.description}</p>
          </div>
        </header>

        <div className="profession-glossary__stats" aria-label={`${selectedProfession.name} progression summary`}>
          <span><strong>{PROFESSION_LEVEL_CAP}</strong> levels</span>
          <span><strong>{track.segments.length}</strong> stages</span>
          <span><strong>{professionBranchChoices(selectedProfession.id).length}</strong> choices</span>
        </div>

        <section className="profession-glossary__section" aria-labelledby={`profession-${selectedProfession.id}-progression`}>
          <div className="profession-glossary__section-title">
            <small>Progression at a glance</small>
            <h4 id={`profession-${selectedProfession.id}-progression`}>Open a stage to inspect its levels</h4>
          </div>
          <div className="profession-glossary__stages">
            {track.segments.map((segment) => (
              <ProfessionStage
                key={segment.pathId}
                segment={segment}
                levels={track.levels}
                initiallyOpen={segment.pathId === initialOpenStageId}
              />
            ))}
          </div>
        </section>

        <ProfessionPathChoices
          professionId={selectedProfession.id}
          initiallyOpen={initialOpenChoices}
          initialRootOptionId={initialBranchOptionId}
        />

        <ProfessionSpecializations specializations={specializations} />
      </div>
    );
  }

  return (
    <div className="profession-glossary fade-in">
      <header className="profession-glossary__intro">
        <div>
          <small>Profession glossary</small>
          <h4>Every calling, one compact index</h4>
        </div>
        <p>Choose a profession to see its stages, level rewards, and branching decisions.</p>
      </header>
      <label className="profession-glossary__search">
        <span>Find</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search profession or role"
          aria-label="Search professions"
        />
        <b aria-live="polite">{visibleProfessions.length}</b>
      </label>
      {visibleProfessions.length > 0 ? (
        <div className="profession-glossary__grid">
          {visibleProfessions.map((profession) => (
            <button
              key={profession.id}
              id={`profession-card-${profession.id}`}
              type="button"
              className="profession-glossary__card"
              onClick={() => setSelectedProfessionId(profession.id)}
              aria-label={`View ${profession.name} progression`}
            >
              <ProfessionIcon profession={profession.id} size="small" decorative />
              <span>
                <strong>{profession.name}</strong>
                <small>{profession.role}</small>
                <em>{profession.description}</em>
              </span>
              <b aria-hidden="true">›</b>
            </button>
          ))}
        </div>
      ) : (
        <div className="profession-glossary__empty">No professions match that search.</div>
      )}
    </div>
  );
}

export function CodexEntry({ entry, kind, codex, onScry, onTrack, isTracked = false, onRename, portraitOverride, onPortraitChange, detailMode = false, onOpen, onBack }) {
  const [expanded, setExpanded] = useState(false);
  const open = detailMode || expanded;
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
  const isCharacter = kind === "characters";
  const archetype = isCharacter ? characterArchetype(entry) : null;
  const broadProfessionId = isCharacter ? (canonicalProfessionId(entry.profession) || entry.profession) : null;
  const broadProfessionName = isCharacter ? (codex.professions?.[broadProfessionId]?.name || PROFESSIONS[broadProfessionId]?.name || broadProfessionId) : null;
  const raceLabel = isCharacter ? (codex.races?.[entry.race]?.name || entry.race) : null;
  const callingLabel = archetype?.label || broadProfessionName;
  const identityCallingLabel = entry.kind === "mount" ? entry.species : callingLabel;
  const towArchetype = isCharacter && entry.progressionModel === "tow-archetype";
  const totalProgressionLevel = isCharacter && !towArchetype ? progressionLevel(entry) : 0;

  const trunc = (s, n = 100) => { const t = (s || "").trim(); return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t; };
  const summaryText = trunc(entry.description || narrativeAppearance || "", isCharacter ? 138 : 100);
  const preview = summaryText;
  const onToggle = (event) => {
    if (event.altKey && isCharacter) {
      event.preventDefault();
      toggleAudit();
      return;
    }
    if (detailMode) return;
    if (isCharacter && onOpen) {
      onOpen(entry.id);
      return;
    }
    setExpanded((current) => !current);
  };
  const SummaryElement = detailMode ? "div" : "button";

  return (
    <article className={`codex-entry${isCharacter ? " codex-entry--character" : " codex-entry--record"}${detailMode ? " codex-entry--dossier" : ""}${open ? " is-open" : ""}`}>
      <div className="codex-entry__header">
        {detailMode && onBack && (
          <button type="button" className="codex-entry__dossier-back" onClick={onBack}>
            <Icon name="back" size={15} />
            <span>Back to roster</span>
          </button>
        )}
        {isCharacter && (detailMode ? (
          <div className="codex-entry__portrait-button is-static" aria-hidden="true">
            <CharacterPortrait entry={entry} portraitOverride={portraitOverride} detail />
          </div>
        ) : (
          <button type="button" className="codex-entry__portrait-button" onClick={onToggle} aria-label={`${open ? "Collapse" : "Open"} ${entry.name} dossier`} aria-expanded={open}>
            <CharacterPortrait entry={entry} portraitOverride={portraitOverride} />
          </button>
        ))}
        <SummaryElement
          className={`codex-entry__summary${kind === "professions" ? " is-profession" : ""}`}
          {...(!detailMode ? {
            type: "button",
            onClick: onToggle,
            title: isCharacter ? "Alt-click to toggle audit fields" : undefined,
            "aria-expanded": open,
          } : {})}
        >
          {kind === "professions" && <ProfessionIcon profession={entry.id} size="small" decorative />}
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
            {raceLabel && <span>{raceLabel}</span>}
            {identityCallingLabel && <span>{identityCallingLabel}</span>}
            {isTracked && <span>Tracked</span>}
            {totalProgressionLevel > 0 && <span>Level {totalProgressionLevel}</span>}
            {kind === "skills" && typeof entry.rating === "number" && <span>Rating {entry.rating}</span>}
          </span>
          {!open && preview && <span className="codex-entry__preview">{preview}</span>}
          {detailMode && summaryText && <span className="codex-entry__hero-summary">{summaryText}</span>}
        </SummaryElement>

        <div className="codex-entry__actions">
          {onTrack && (
            <button type="button" className={`is-track${isTracked ? " is-active" : ""}`} aria-pressed={isTracked} onClick={onTrack}>{isTracked ? "Tracking" : "Track"}</button>
          )}
          {onRename && (
            <button type="button" onClick={onRename}>Rename</button>
          )}
          {onScry && (
            <button type="button" className="is-scry" onClick={onScry}>Scry</button>
          )}
          {!detailMode && <button type="button" className="codex-entry__chevron" onClick={onToggle} aria-label={`${open ? "Collapse" : "Expand"} ${entry.name}`} aria-expanded={open}>{open ? "−" : "+"}</button>}
        </div>
      </div>

      {open && (<div className="codex-entry__details">
        {isCharacter ? (
          <>
            <CharacterPortraitEditor
              entry={entry}
              portraitOverride={portraitOverride}
              onPortraitChange={onPortraitChange}
            />

            <div className="codex-entry__detail-grid">
              <CharacterDetailSection label="Profile" title={towArchetype ? "Identity and combat build" : "Identity and progression"} className="is-wide">
                <div className="codex-entry__identity-values">
                  <strong>{raceLabel}</strong>
                  {identityCallingLabel && <strong>{identityCallingLabel}</strong>}
                </div>
                <div className="codex-entry__fact-grid">
                  <CharacterFact label="Origin" value={originLabel(entry.origin)} />
                  <CharacterFact label="Age" value={entry.age} />
                  <CharacterFact label="Gender" value={entry.gender} />
                  {towArchetype
                    ? <CharacterFact label="Power" value={entry.profile?.power || "Chosen"} />
                    : <CharacterFact label="Level" value={totalProgressionLevel > 0 ? `${totalProgressionLevel}` : null} />}
                  <CharacterFact label="Bond" value={bondTier ? `${bondTier.label} ${(entry.relationship || 0) > 0 ? "+" : ""}${entry.relationship || 0}` : null} />
                  <CharacterFact
                    label="Aging"
                    value={audit
                      ? agingModeLabel(entry.agingMode, entry)
                      : (entry.agingMode && entry.agingMode !== "mortal" ? entry.agingMode : null)}
                  />
                  {audit && <CharacterFact label="Attractiveness" value={attractivenessLabel(entry.attractiveness)} />}
                </div>
              </CharacterDetailSection>

              {(narrativeAppearance || structuredAppearance) && (
                <CharacterDetailSection label="Appearance" title="Visible details" className="is-wide">
                  {narrativeAppearance && <p className="codex-entry__detail-prose is-appearance">{narrativeAppearance}</p>}
                  {structuredAppearance && (
                    <div className="codex-entry__fact-grid is-compact">
                      <CharacterFact label="Skin" value={structuredAppearance.skin} />
                      <CharacterFact label="Hair" value={structuredAppearance.hair} />
                      <CharacterFact label="Eyes" value={structuredAppearance.eyes} />
                      <CharacterFact label="Build" value={structuredAppearance.build} />
                      <CharacterFact label="Facial hair" value={structuredAppearance.facial_hair} />
                      <CharacterFact label="Marks" value={structuredAppearance.marks} />
                    </div>
                  )}
                </CharacterDetailSection>
              )}

              {hasAttrs && (
                <CharacterDetailSection label="Capabilities" title="Attributes" className="is-wide">
                  <div className="codex-entry__attribute-grid">
                    {ATTR_KEYS.map((key) => (
                      <div key={key}>
                        <small>{ATTR_LABELS[key]}</small>
                        <strong>{entry.attributes[key] ?? 0}</strong>
                      </div>
                    ))}
                  </div>
                </CharacterDetailSection>
              )}

              {entry.description && (
                <CharacterDetailSection label="Dossier" title="Known story" className="is-wide">
                  <p className="codex-entry__detail-prose">{entry.description}</p>
                </CharacterDetailSection>
              )}

              {wornNames.length > 0 && (
                <CharacterDetailSection label="Equipment" title="Wearing">
                  <p className="codex-entry__detail-prose is-list">{wornNames.join(", ")}</p>
                </CharacterDetailSection>
              )}

              {knowsList.length > 0 && (
                <CharacterDetailSection label="Knowledge" title="What they know">
                  <ul className="codex-entry__detail-list">
                    {knowsList.map((fact, index) => <li key={index}>{fact}</li>)}
                  </ul>
                </CharacterDetailSection>
              )}

              {memoriesList.length > 0 && (
                <CharacterDetailSection label="Relationship" title="Shared history" className="is-wide">
                  <ul className="codex-entry__detail-list">
                    {memoriesList.map((memory, index) => <li key={index}>{memory}</li>)}
                  </ul>
                </CharacterDetailSection>
              )}
            </div>
          </>
        ) : (
          <>
            {kind === "items" && entry.kind && (
              <div style={{ ...accentMeta, fontSize: "9px", letterSpacing: "0.10em", marginBottom: "6px" }}>{entry.kind}</div>
            )}
            {narrativeAppearance && (
              <div style={{ fontSize: "12px", color: colors.parchment, lineHeight: "1.5", marginBottom: "8px" }}>
                <span style={{ ...subtleMeta, marginRight: "6px" }}>Appearance</span>
                <span style={serifInlineValue}>{narrativeAppearance}</span>
              </div>
            )}
            {entry.description && (
              <div style={{ fontSize: "13px", color: "rgba(237, 228, 208, 0.88)", lineHeight: "1.5" }}>{entry.description}</div>
            )}
            {kind === "races" && RACES[entry.id] && <RaceKit raceId={entry.id} />}
            {kind === "spells" && entry.acquisition && (
              <div style={{ fontSize: "11px", color: "rgba(215, 167, 111, 0.6)", marginTop: "4px", fontStyle: "italic" }}>Acquired: {entry.acquisition}</div>
            )}
          </>
        )}
      </div>)}
    </article>
  );
}

export function CodexView({ state, onClose, onScry, onTrackCharacter, onRenameMount, onPortraitChange, embedded = false }) {
  const codex = state.world.codex;
  const scryable = onScry && canScry(state);
  const partyIds = new Set(state.party || []);
  const [activeTab, setActiveTab] = useState("characters");
  const [characterQuery, setCharacterQuery] = useState("");
  const [characterScope, setCharacterScope] = useState("all");
  const [selectedCharacterId, setSelectedCharacterId] = useState(null);
  const selectedDossierRef = useRef(null);
  const selectedCharacter = activeTab === "characters" && selectedCharacterId
    ? codex.characters?.[selectedCharacterId]
    : null;

  useEffect(() => {
    if (activeTab !== "characters") setSelectedCharacterId(null);
  }, [activeTab]);

  useEffect(() => {
    if (!selectedCharacter) return;
    const frame = window.requestAnimationFrame(() => {
      selectedDossierRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedCharacter]);

  let entries = Object.values(codex[activeTab] || {});
  if (activeTab === "characters") {
    const query = characterQuery.trim().toLowerCase();
    const rank = (entry) => {
      if (entry.kind === "player") return 0;
      if (partyIds.has(entry.id)) return 1;
      if (entry.playable) return 2;
      if (IMPORTANT_CHARACTER_IDS.has(entry.id)) return 3;
      if (entry.kind === "mount") return 4;
      return 5;
    };
    entries = [...entries]
      .filter((entry) => {
        if (characterScope === "company" && entry.kind !== "player" && !partyIds.has(entry.id)) return false;
        if (characterScope === "playable" && !entry.playable) return false;
        if (characterScope === "notable" && !IMPORTANT_CHARACTER_IDS.has(entry.id)) return false;
        if (characterScope === "mounts" && entry.kind !== "mount") return false;
        if (!query) return true;
        const archetype = characterArchetype(entry);
        const level = progressionLevel(entry);
        return [entry.name, entry.race, entry.profession, entry.archetype, archetype?.label, level > 0 ? `level ${level}` : null, entry.origin, entry.description, entry.base_appearance]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => rank(a) - rank(b) || String(a.name || a.id).localeCompare(String(b.name || b.id)));
  }

  const handleTabKeyDown = (event, tabIndex) => {
    const last = CODEX_TABS.length - 1;
    let next = null;
    if (event.key === "ArrowRight") next = tabIndex === last ? 0 : tabIndex + 1;
    if (event.key === "ArrowLeft") next = tabIndex === 0 ? last : tabIndex - 1;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = last;
    if (next == null) return;
    event.preventDefault();
    setActiveTab(CODEX_TABS[next].key);
    requestAnimationFrame(() => document.getElementById(`codex-tab-${CODEX_TABS[next].key}`)?.focus());
  };

  return (
    <DeckPage enabled={embedded} className={`codex-view${embedded ? " codex-view--embedded" : " fade-in"}`} data-tab={activeTab} style={{ position: embedded ? "relative" : "absolute", inset: embedded ? "auto" : 0, backgroundColor: "#0b0f0e", zIndex: embedded ? 1 : 30, display: "flex", flexDirection: "column" }}>
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
            <Icon name="back" size={17} />
          </button>
          <div className="codex-view__title">
            <span aria-hidden="true"><Icon name="codex" size={25} /></span>
            <div>
              <small>Living archive</small>
              <strong style={{ fontFamily: fonts.serif, fontSize: "24px", fontStyle: "italic", color: colors.parchmentLight }}>Lore Codex</strong>
            </div>
          </div>
          <div style={{ width: "30px" }} />
        </div>
      )}

      {embedded && (
        <DeckPageHeader
          icon="codex"
          title="Codex"
          subtitle={`${Object.keys(codex.characters || {}).length} known characters · people · places · lore`}
        />
      )}

      <div className="codex-view__tabs" role="tablist" aria-label="Codex sections">
        {CODEX_TABS.map((tab, tabIndex) => {
          const count = tab.key === "professions" ? PROFESSION_GLOSSARY_ENTRIES.length : tab.key === "items" ? CATALOG_ITEM_COUNT : tab.key === "abilities" ? ABILITY_CATALOG.length : tab.key === "passives" ? PASSIVES.length : tab.key === "glossary" ? GLOSSARY.length : tab.key === "conditions" ? Object.keys(CONDITIONS).length : Object.keys(codex[tab.key] || {}).length;
          const active = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              id={`codex-tab-${tab.key}`}
              className={active ? "is-active" : ""}
              data-group={tab.group}
              onClick={() => setActiveTab(tab.key)}
              onKeyDown={(event) => handleTabKeyDown(event, tabIndex)}
              role="tab"
              aria-selected={active}
              aria-controls={`codex-panel-${tab.key}`}
              tabIndex={active ? 0 : -1}
            >
              <span className="codex-tab-icon-slot" aria-hidden="true">
                <AtlasIcon src={codexCategoryAtlas} columns={3} rows={3} column={tab.column} row={tab.row} size="100%" decorative iconKey={`codex:${tab.key}`} className="codex-tab-icon" />
              </span>
              <span className="codex-tab-label">{tab.label}</span>
              {count > 0 && <strong>{count}</strong>}
            </button>
          );
        })}
      </div>

      {activeTab === "characters" && !selectedCharacter && (
        <div className="codex-character-tools">
          <label className="codex-character-search">
            <AtlasIcon src={codexCategoryAtlas} columns={3} rows={3} column={2} row={2} size={18} decorative shape="round" />
            <input
              type="search"
              value={characterQuery}
              onChange={(event) => setCharacterQuery(event.target.value)}
              placeholder="Search names, origins, or lore"
              aria-label="Search Codex characters"
            />
            <span aria-live="polite">{entries.length}</span>
          </label>
          <div className="codex-character-scopes" role="group" aria-label="Character filters">
            {[
              ["all", "All"],
              ["company", "Company"],
              ["playable", "Playable"],
              ["notable", "Notable"],
              ["mounts", "Mounts"],
            ].map(([key, label]) => (
              <button type="button" key={key} aria-pressed={characterScope === key} onClick={() => setCharacterScope(key)}>{label}</button>
            ))}
          </div>
        </div>
      )}

      <div className="codex-view__content" style={{ flex: 1, overflowY: embedded ? "visible" : "auto" }}>
        <div
          key={activeTab}
          id={`codex-panel-${activeTab}`}
          className="codex-view__tab-panel"
          role="tabpanel"
          aria-labelledby={`codex-tab-${activeTab}`}
        >
        {activeTab === "characters" && selectedCharacter ? (
          <div ref={selectedDossierRef} className="codex-character-dossier fade-in">
            <CodexEntry
              entry={selectedCharacter}
              kind="characters"
              codex={codex}
              detailMode
              onBack={() => setSelectedCharacterId(null)}
              portraitOverride={state.portraitOverrides?.[selectedCharacter.id]}
              onPortraitChange={onPortraitChange}
              isTracked={state.world.trackedCharacterId === selectedCharacter.id}
              onTrack={onTrackCharacter && (state.world.trackedCharacterId === selectedCharacter.id || canTrackCharacter(state, selectedCharacter.id)) ? () => onTrackCharacter(selectedCharacter.id) : null}
              onScry={scryable && selectedCharacter.kind !== "player" && !partyIds.has(selectedCharacter.id) ? () => onScry(selectedCharacter.id) : null}
              onRename={onRenameMount && selectedCharacter.kind === "mount" ? () => onRenameMount(selectedCharacter.id) : null}
            />
          </div>
        ) : activeTab === "items" ? (
          <ItemCatalog codex={codex} />
        ) : activeTab === "professions" ? (
          <ProfessionGlossary />
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
            {activeTab === "characters" && (characterQuery || characterScope !== "all") ? "No characters match this view." : "Nothing recorded here yet."}<br />
            <span style={{ fontSize: "13px", color: "rgba(215, 167, 111, 0.3)" }}>{activeTab === "characters" && (characterQuery || characterScope !== "all") ? "Clear the search or choose another group." : "Discover lore by wandering the realm."}</span>
          </div>
        ) : (
          <div className={`codex-entry-list fade-in${activeTab === "characters" ? " is-characters" : ""}`}>
            {entries.map((e) => <CodexEntry key={e.id} entry={e} kind={activeTab} codex={codex}
              portraitOverride={state.portraitOverrides?.[e.id]}
              onPortraitChange={activeTab === "characters" ? onPortraitChange : null}
              onOpen={activeTab === "characters" ? setSelectedCharacterId : null}
              isTracked={activeTab === "characters" && state.world.trackedCharacterId === e.id}
              onTrack={onTrackCharacter && activeTab === "characters" && (state.world.trackedCharacterId === e.id || canTrackCharacter(state, e.id)) ? () => onTrackCharacter(e.id) : null}
              onScry={scryable && activeTab === "characters" && e.kind !== "player" && !partyIds.has(e.id) ? () => onScry(e.id) : null}
              onRename={onRenameMount && activeTab === "characters" && e.kind === "mount" ? () => onRenameMount(e.id) : null} />)}
          </div>
        )}
        </div>
      </div>
    </DeckPage>
  );
}
