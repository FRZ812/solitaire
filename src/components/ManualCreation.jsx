import React, { useState, useMemo } from "react";
import { Icon } from "./Icon.jsx";
import { colors, radius, fonts } from "./tokens.js";
import { ATTR_KEYS, ATTR_LABELS, CHARACTER_LEVEL_CAP, ORIGIN_LABEL } from "../config.js";
import { RACES } from "../data/races.js";
import { getAbilityDef } from "../data/abilities.js";
import { ALL_ITEMS } from "../data/catalog.js";
import { equipSlot } from "../engine/combat-stats.js";
import { tierColor, tierLabel } from "../data/tiers.js";
import { CHARACTER_TEMPLATES, STANDARD_PROVISIONS } from "../data/templates.js";
import { descriptorFor } from "../data/attractiveness.js";
import { PROFESSIONS } from "../data/professions.js";
import {
  attributeCeilingForLevel,
  canonicalProfessionId,
  compileCharacterProgression,
  isBroadProfessionName,
  professionBuild,
  professionProfile,
} from "../data/progression-paths.js";
import { METAMAGIC_FEATURES, PROGRESSION_FEATURES } from "../data/progression-features.js";
import { createProgression } from "../engine/progression.js";

const APPEARANCE_OPTS = {
  skin: ["pale", "fair", "tanned", "olive", "brown", "deep brown", "ashen", "grey", "ruddy"],
  hair: ["black", "dark brown", "brown", "auburn", "red", "blond", "ash-blond", "grey", "white", "bald"],
  eyes: ["brown", "hazel", "green", "blue", "grey", "amber", "black", "violet"],
  build: ["slight", "lean", "wiry", "average", "athletic", "broad", "stocky", "tall", "huge", "heavyset"],
};
const AGING_MODES = [
  { id: "mortal", label: "Mortal" },
  { id: "power-extended", label: "Power-Extended" },
  { id: "ageless", label: "Ageless" },
  { id: "out-of-time", label: "Out-of-Time" },
];
const PROFESSION_OPTS = Object.keys(PROFESSIONS);
const PROFESSION_DATALIST = Object.values(PROFESSIONS).map((profession) => ({
  id: profession.id,
  name: profession.name,
}));
const ARCHETYPE_OPTS = [...new Set([
  ...CHARACTER_TEMPLATES.map((template) => template.setup.archetype),
  ...Object.values(PROFESSIONS).flatMap((profession) => (profession.specializations || []).map((entry) => entry.id)),
  ...PROFESSION_OPTS.map((id) => professionBuild(id)?.archetypePathId),
].filter(Boolean))];
const ITEM_KINDS = [
  { id: "weapon", label: "Weapons", kinds: ["weapon"] },
  { id: "armor", label: "Armour", kinds: ["armor"] },
  { id: "clothing", label: "Worn", kinds: ["clothing"] },
  { id: "shield", label: "Shields", kinds: ["shield"] },
  { id: "trinket", label: "Trinkets", kinds: ["trinket"] },
  { id: "provisions", label: "Food & Drink", kinds: ["food", "drink", "remedy"] },
  { id: "tool", label: "Tools", kinds: ["tool"] },
  { id: "material", label: "Materials", kinds: ["material"] },
];

const slug = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const sameAttributes = (left, right) => ATTR_KEYS.every((key) => Number(left?.[key]) === Number(right?.[key]));
const archetypeFor = (professionValue, archetypeValue, professionId) => archetypeValue.trim()
  || (slug(professionValue) && !isBroadProfessionName(professionValue, professionId) ? professionValue.trim() : null)
  || null;

function fitAttributesToRoute(attributes, projected, level, { preserveValidShape = true } = {}) {
  const ceiling = attributeCeilingForLevel(level);
  const projectedValues = ATTR_KEYS.map((key) => Math.max(0, Math.min(ceiling, Number(projected?.[key]) || 0)));
  const projectedTotal = projectedValues.reduce((sum, value) => sum + value, 0);
  const suppliedValues = ATTR_KEYS.map((key, index) => {
    const value = Number(attributes?.[key]);
    return Math.max(0, Math.min(ceiling, Number.isFinite(value) ? value : projectedValues[index]));
  });
  const suppliedTotal = suppliedValues.reduce((sum, value) => sum + value, 0);
  if (projectedTotal <= 0) return Object.fromEntries(ATTR_KEYS.map((key) => [key, 0]));

  const lowerBudget = Math.round(projectedTotal * 0.85);
  const upperBudget = Math.round(projectedTotal * 1.15);
  const hasCompleteSheet = ATTR_KEYS.every((key) => Number.isFinite(Number(attributes?.[key])));
  if (preserveValidShape && hasCompleteSheet && suppliedTotal >= lowerBudget && suppliedTotal <= upperBudget) {
    return Object.fromEntries(ATTR_KEYS.map((key, index) => [key, Math.round(suppliedValues[index])]));
  }

  const targetBudget = Math.min(ceiling * ATTR_KEYS.length, Math.max(
    lowerBudget,
    Math.min(upperBudget, suppliedTotal || projectedTotal),
  ));
  const weighted = ATTR_KEYS.map((_, index) => {
    const routeShare = projectedValues[index] / projectedTotal;
    const suppliedShare = suppliedTotal > 0 ? suppliedValues[index] / suppliedTotal : routeShare;
    return targetBudget * ((routeShare * 0.7) + (suppliedShare * 0.3));
  });
  const allocated = weighted.map((value) => Math.min(ceiling, Math.floor(value)));
  let remaining = targetBudget - allocated.reduce((sum, value) => sum + value, 0);
  const order = weighted
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);
  while (remaining > 0) {
    let changed = false;
    for (const { index } of order) {
      if (remaining <= 0) break;
      if (allocated[index] >= ceiling) continue;
      allocated[index] += 1;
      remaining -= 1;
      changed = true;
    }
    if (!changed) break;
  }
  return Object.fromEntries(ATTR_KEYS.map((key, index) => [key, allocated[index]]));
}

const INITIAL_ATTRIBUTES = compileCharacterProgression({
  professions: [{ professionId: "wanderer", levels: 10 }],
}).finalAttributes;

function titleCase(value) {
  return String(value || "").replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function routeGrantDetails(grant) {
  if (grant.type === "ability") {
    const ability = getAbilityDef(grant.id);
    return { name: ability?.name || titleCase(grant.id), description: grant.description || ability?.desc || "" };
  }
  if (grant.type === "ability-choice") {
    const options = (grant.options || []).map((id) => getAbilityDef(id)?.name || titleCase(id));
    return { name: grant.replace ? "Signature spell exchange" : "Ability choice pending", description: options.join(" · ") };
  }
  if (grant.type === "metamagic" || grant.type === "metamagic-choice") {
    const feature = METAMAGIC_FEATURES[grant.id];
    const options = (grant.options || []).map((id) => METAMAGIC_FEATURES[id]?.name || titleCase(id));
    return {
      name: feature?.name || (grant.type === "metamagic-choice" ? "Metamagic choice pending" : titleCase(grant.id)),
      description: grant.description || feature?.description || options.join(" · "),
    };
  }
  const feature = PROGRESSION_FEATURES[grant.id];
  return { name: feature?.name || titleCase(grant.id || grant.type), description: grant.description || feature?.description || "" };
}

const SectionHeader = ({ icon, title, sub, open, onToggle }) => (
  <button onClick={onToggle} style={{
    width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px",
    backgroundColor: open ? "rgba(215,167,111,0.1)" : "rgba(20,29,29,0.5)",
    border: `1px solid rgba(215,167,111,0.22)`, borderRadius: radius.panelCompact,
    cursor: "pointer", fontFamily: "inherit", textAlign: "left",
  }}>
    <Icon name={icon} size={16} color={colors.gold} strokeWidth={1.8} />
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: "13px", fontWeight: 800, color: colors.parchmentLight }}>{title}</div>
      {sub && <div style={{ fontSize: "10px", color: "rgba(237,228,208,0.55)", marginTop: "1px" }}>{sub}</div>}
    </div>
    <span style={{ color: "rgba(215,167,111,0.7)", fontSize: "13px" }}>{open ? "▾" : "▸"}</span>
  </button>
);

const fieldLabel = { fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(215,167,111,0.6)", fontWeight: 800, marginBottom: "4px", display: "block" };
const inputStyle = {
  width: "100%", height: "38px", borderRadius: radius.panelCompact, boxSizing: "border-box",
  border: `1px solid rgba(215,167,111,0.28)`, backgroundColor: "rgba(10,15,15,0.6)",
  padding: "0 12px", fontSize: "13px", color: colors.parchment, outline: "none", fontFamily: "inherit",
};
const chip = (active) => ({
  padding: "6px 11px", borderRadius: radius.pill, fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  backgroundColor: active ? "rgba(215,167,111,0.18)" : "rgba(20,29,29,0.5)",
  color: active ? colors.parchmentLight : "rgba(237,228,208,0.7)",
  border: `1px solid ${active ? "rgba(215,167,111,0.55)" : "rgba(215,167,111,0.2)"}`,
});

export function ManualCreation({ onBegin, onCancel, onQuit, busy }) {
  const [open, setOpen] = useState("identity");
  const toggle = (id) => setOpen((o) => (o === id ? null : id));

  const [name, setName] = useState("");
  const [bond, setBond] = useState("");
  const [age, setAge] = useState(25);
  const [agingMode, setAgingMode] = useState("mortal");
  const [lifespanMultiplier, setLifespanMultiplier] = useState(2.0);
  const [profession, setProfession] = useState("");
  const [archetype, setArchetype] = useState("");
  const [signatureSpellId, setSignatureSpellId] = useState("");
  const [racialLevels, setRacialLevels] = useState(0);
  const [primaryProfessionLevels, setPrimaryProfessionLevels] = useState(10);
  const [multiclassAllocations, setMulticlassAllocations] = useState([]);
  const [race, setRace] = useState("human");
  const [subrace, setSubrace] = useState(null);
  const [origin, setOrigin] = useState("north");
  const [appearance, setAppearance] = useState({ skin: "", hair: "", eyes: "", build: "", facial_hair: "", marks: "" });
  const [attractiveness, setAttractiveness] = useState(5);
  const [gender, setGender] = useState("male");
  const [baseAppearance, setBaseAppearance] = useState("");
  const [attrs, setAttrs] = useState(() => ({ ...INITIAL_ATTRIBUTES }));
  const [items, setItems] = useState([]); // [{itemId, quantity, worn}]
  const [itemSearch, setItemSearch] = useState("");
  const [itemKind, setItemKind] = useState("weapon");

  const raceDef = RACES[race] || {};
  const subraceMap = raceDef.subraces || null;
  const isHuman = race === "human";
  const professionId = canonicalProfessionId(profession) || "wanderer";
  const archetypeId = archetypeFor(profession, archetype, professionId);
  const multiclassLevels = multiclassAllocations.reduce((sum, allocation) => sum + (Number(allocation.levels) || 0), 0);
  const professionLevels = primaryProfessionLevels + multiclassLevels;
  const level = Math.max(1, racialLevels + professionLevels);

  const compileCreationRoute = (overrides = {}) => {
    const nextProfessionId = overrides.professionId ?? professionId;
    const nextArchetypeId = overrides.archetypeId ?? archetypeId;
    const nextPrimaryLevels = overrides.primaryProfessionLevels ?? primaryProfessionLevels;
    const nextMulticlass = overrides.multiclassAllocations ?? multiclassAllocations;
    const nextRacialLevels = overrides.racialLevels ?? racialLevels;
    const nextRace = overrides.raceId ?? race;
    const nextEvolution = Object.prototype.hasOwnProperty.call(overrides, "evolutionId") ? overrides.evolutionId : subrace;
    const professions = [
      {
        professionId: nextProfessionId,
        specializationId: nextArchetypeId,
        levels: nextPrimaryLevels,
        choices: nextProfessionId === "sorcerer" && signatureSpellId ? { signatureSpellId } : {},
      },
      ...nextMulticlass.map((allocation) => ({
        professionId: canonicalProfessionId(allocation.profession) || "wanderer",
        specializationId: allocation.archetype || null,
        levels: Number(allocation.levels) || 0,
      })),
    ].filter((allocation) => allocation.levels > 0);
    return compileCharacterProgression({
      professions,
      racial: nextRacialLevels > 0 ? {
        raceId: nextRace,
        evolutionId: nextEvolution || null,
        levels: nextRacialLevels,
      } : null,
    });
  };

  const routeProjection = compileCreationRoute();
  const routeBaseline = routeProjection.finalAttributes;
  const routeTotal = ATTR_KEYS.reduce((sum, key) => sum + (routeBaseline[key] || 0), 0);
  const routeBudgetMin = Math.round(routeTotal * 0.85);
  const routeBudgetMax = Math.round(routeTotal * 1.15);

  const fitAttributes = (candidate, overrides = {}) => {
    const route = compileCreationRoute(overrides);
    return fitAttributesToRoute(candidate, route.finalAttributes, Math.max(1, route.totalLevels));
  };

  const attributeCeiling = attributeCeilingForLevel(level);
  const setAttr = (k, d) => setAttrs((current) => fitAttributes({
    ...current,
    [k]: Math.max(0, Math.min(attributeCeiling, (current[k] || 0) + d)),
  }));
  const attrTotal = ATTR_KEYS.reduce((s, k) => s + (attrs[k] || 0), 0);
  const isPrimarySorcerer = professionId === "sorcerer" && primaryProfessionLevels > 0;
  const signatureSpellOptions = professionProfile("sorcerer")?.abilities || [];
  const earnedRouteGrants = [];
  const seenRouteGrants = new Set();
  for (const row of routeProjection.levels) {
    for (const grant of row.grants || []) {
      const key = `${grant.type}:${grant.id || (grant.options || []).join("|")}:${grant.slot ?? ""}:${grant.replace ? "replace" : ""}`;
      if (seenRouteGrants.has(key)) continue;
      seenRouteGrants.add(key);
      earnedRouteGrants.push({ grant, level: row.level, source: row.pathName });
    }
  }

  const refitForRoute = (overrides) => {
    const nextBaseline = compileCreationRoute(overrides).finalAttributes;
    setAttrs((current) => sameAttributes(current, routeBaseline)
      ? { ...nextBaseline }
      : fitAttributes(current, overrides));
  };

  const pickRacialLevels = (raw) => {
    const next = Math.max(0, Math.min(30, Math.round(Number(raw) || 0)));
    setRacialLevels(next);
    refitForRoute({ racialLevels: next });
  };

  const pickPrimaryProfessionLevels = (raw) => {
    const next = Math.max(0, Math.min(70 - multiclassLevels, Math.round(Number(raw) || 0)));
    setPrimaryProfessionLevels(next);
    refitForRoute({ primaryProfessionLevels: next });
  };

  const addMulticlass = () => {
    const fallbackId = PROFESSION_OPTS.find((id) => id !== professionId) || "wanderer";
    const fallback = PROFESSIONS[fallbackId]?.name || fallbackId;
    setMulticlassAllocations((current) => [...current, {
      key: `${Date.now()}-${current.length}`,
      profession: fallback,
      archetype: "",
      levels: 0,
    }]);
  };

  const updateMulticlass = (key, patch) => {
    const nextAllocations = multiclassAllocations.map((allocation) => {
      if (allocation.key !== key) return allocation;
      const next = { ...allocation, ...patch };
      if (patch.profession != null) {
        next.archetype = "";
      }
      if (patch.levels != null) {
        const otherLevels = multiclassAllocations.reduce((sum, entry) => sum + (entry.key === key ? 0 : Number(entry.levels) || 0), 0);
        next.levels = Math.max(0, Math.min(70 - primaryProfessionLevels - otherLevels, Math.round(Number(patch.levels) || 0)));
      }
      return next;
    });
    setMulticlassAllocations(nextAllocations);
    refitForRoute({ multiclassAllocations: nextAllocations });
  };

  const removeMulticlass = (key) => {
    const nextAllocations = multiclassAllocations.filter((allocation) => allocation.key !== key);
    setMulticlassAllocations(nextAllocations);
    refitForRoute({ multiclassAllocations: nextAllocations });
  };

  const pickRace = (id) => {
    setRace(id);
    setSubrace(null);
    setOrigin(id === "human" ? "north" : id);
    refitForRoute({ raceId: id, evolutionId: null });
  };

  const pickProfession = (value) => {
    const nextProfessionId = canonicalProfessionId(value) || "wanderer";
    const nextArchetypeId = archetypeFor(value, archetype, nextProfessionId);
    if (nextProfessionId !== "sorcerer") setSignatureSpellId("");
    setProfession(value);
    refitForRoute({ professionId: nextProfessionId, archetypeId: nextArchetypeId });
  };

  const pickArchetype = (value) => {
    const nextArchetypeId = archetypeFor(profession, value, professionId);
    setArchetype(value);
    refitForRoute({ archetypeId: nextArchetypeId });
  };

  const pickSubrace = (value) => {
    const next = subrace === value ? null : value;
    setSubrace(next);
    refitForRoute({ evolutionId: next });
  };

  // ---- items ----
  const itemList = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    const kindSet = ITEM_KINDS.find((k) => k.id === itemKind)?.kinds || [itemKind];
    return Object.values(ALL_ITEMS).filter((it) => {
      if (q) return (it.name || it.id).toLowerCase().includes(q);
      return kindSet.includes(it.kind);
    }).slice(0, 120);
  }, [itemSearch, itemKind]);
  const hasItem = (id) => items.some((i) => i.itemId === id);
  const addItem = (it) => {
    if (hasItem(it.id)) return;
    setItems((l) => [...l, { itemId: it.id, quantity: 1, worn: !!equipSlot(it) }]);
  };
  const removeItem = (id) => setItems((l) => l.filter((i) => i.itemId !== id));
  const setItemQty = (id, d) => setItems((l) => l.map((i) => (i.itemId === id ? { ...i, quantity: Math.max(1, i.quantity + d) } : i)));
  const toggleWorn = (id) => setItems((l) => l.map((i) => (i.itemId === id ? { ...i, worn: !i.worn } : i)));
  const addProvisions = () => setItems((l) => {
    const have = new Set(l.map((i) => i.itemId));
    return [...l, ...STANDARD_PROVISIONS.filter((p) => !have.has(p.itemId)).map((p) => ({ itemId: p.itemId, quantity: p.quantity, worn: false }))];
  });

  const canBegin = name.trim().length > 0 && !!race && (!isPrimarySorcerer || !!signatureSpellId) && !busy;

  const begin = () => {
    if (!canBegin) return;
    const appr = {};
    for (const k of ["skin", "hair", "eyes", "build", "facial_hair", "marks"]) if (appearance[k]?.trim()) appr[k] = appearance[k].trim();
    const professionAllocations = [
      {
        professionId,
        specializationId: archetypeId,
        levels: primaryProfessionLevels,
        choices: isPrimarySorcerer && signatureSpellId ? { signatureSpellId } : {},
      },
      ...multiclassAllocations
        .filter((allocation) => Number(allocation.levels) > 0)
        .map((allocation) => ({
          professionId: canonicalProfessionId(allocation.profession) || "wanderer",
          specializationId: allocation.archetype || null,
          levels: Number(allocation.levels) || 0,
        })),
    ].filter((allocation) => allocation.levels > 0);
    const progression = createProgression({
      professionId,
      archetypeId,
      raceId: race,
      evolutionId: subrace || null,
      level,
      racialLevels,
      professions: professionAllocations,
      signatureSpellId: isPrimarySorcerer ? signatureSpellId : null,
    });
    onBegin({
      name: name.trim(),
      bond: bond.trim() || "A past unspoken — yours to reveal in the telling.",
      age,
      agingMode,
      lifespanMultiplier: agingMode === "power-extended" ? lifespanMultiplier : undefined,
      attractiveness, gender,
      profession: professionId,
      archetype: archetypeId,
      level,
      progression,
      signatureSpell: isPrimarySorcerer ? signatureSpellId : null,
      race, subrace: subrace || null, origin: isHuman ? origin : race,
      attributes: fitAttributes(attrs),
      appearance: Object.keys(appr).length ? appr : undefined,
      base_appearance: baseAppearance.trim() || undefined,
      abilities: [],
      items,
      knows: [],
    });
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 65, display: "flex", flexDirection: "column",
      background: "radial-gradient(120% 90% at 50% 0%, rgba(28,36,40,0.97), rgba(8,11,12,0.99))",
    }}>
      <div style={{ width: "100%", maxWidth: "640px", margin: "0 auto", display: "flex", flexDirection: "column", height: "100%" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 10px", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: "9px", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(215,167,111,0.6)", fontWeight: 800 }}>Manual builder</div>
            <h1 style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "24px", color: colors.parchmentLight, margin: "1px 0 0" }}>Forge yourself</h1>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <button onClick={onCancel} disabled={busy} style={{ ...chip(false), padding: "8px 11px" }}>Back</button>
            <button onClick={onQuit} disabled={busy} style={{ ...chip(false), padding: "8px 11px" }}>Leave</button>
          </div>
        </div>

        {/* scroll body */}
        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {/* IDENTITY */}
          <SectionHeader icon="user" title="Identity" sub={name.trim() ? `${name}${profession ? ` · ${profession}` : ""}${archetype ? ` · ${archetype}` : ""}` : "name, drive, age, profession, specialization"} open={open === "identity"} onToggle={() => toggle("identity")} />
          {open === "identity" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "11px", padding: "4px 2px 8px" }}>
              <div><label style={fieldLabel}>Name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" style={inputStyle} /></div>
              <div><label style={fieldLabel}>Driving bond</label><input value={bond} onChange={(e) => setBond(e.target.value)} placeholder="What drives you?" style={inputStyle} /></div>
              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{ flex: 1 }}>
                  <label style={fieldLabel}>Age (years)</label>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button onClick={() => setAge((a) => Math.max(1, a - 1))} style={stepBtn}>−</button>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={age}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (Number.isFinite(n)) setAge(Math.max(1, Math.min(999, n)));
                      }}
                      style={{ ...inputStyle, textAlign: "center", padding: "0 6px" }}
                    />
                    <button onClick={() => setAge((a) => Math.min(999, a + 1))} style={stepBtn}>+</button>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={fieldLabel}>Profession</label>
                  <input list="prof-opts" value={profession} onChange={(e) => pickProfession(e.target.value)} placeholder="e.g. Warrior" style={inputStyle} />
                  <datalist id="prof-opts">{PROFESSION_DATALIST.map((option) => <option key={option.id} value={option.name} />)}</datalist>
                </div>
              </div>
              <div>
                <label style={fieldLabel}>Specialization</label>
                <input list="archetype-opts" value={archetype} onChange={(e) => pickArchetype(e.target.value)} placeholder="e.g. shadowblade" style={inputStyle} />
                <datalist id="archetype-opts">{ARCHETYPE_OPTS.map((o) => <option key={o} value={o} />)}</datalist>
              </div>
              <div>
                <label style={fieldLabel}>Level investment</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <label style={{ ...fieldLabel, margin: 0 }}>
                    <span>Racial evolution · {racialLevels} / 30</span>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={racialLevels}
                      onChange={(event) => pickRacialLevels(event.target.value)}
                      style={{ ...inputStyle, marginTop: "4px", textAlign: "center", padding: "0 6px" }}
                    />
                  </label>
                  <label style={{ ...fieldLabel, margin: 0 }}>
                    <span>Professions · {professionLevels} / 70</span>
                    <input
                      type="number"
                      min={0}
                      max={70 - multiclassLevels}
                      value={primaryProfessionLevels}
                      onChange={(event) => pickPrimaryProfessionLevels(event.target.value)}
                      style={{ ...inputStyle, marginTop: "4px", textAlign: "center", padding: "0 6px" }}
                    />
                  </label>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "10px", color: "rgba(237,228,208,0.55)", marginTop: "6px" }}>
                  <span>Total level {level} / {CHARACTER_LEVEL_CAP}</span>
                  <span>Attribute ceiling {attributeCeiling}</span>
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                  <label style={{ ...fieldLabel, margin: 0 }}>Multiclass professions</label>
                  <button type="button" onClick={addMulticlass} disabled={professionLevels >= 70} style={chip(false)}>Add profession</button>
                </div>
                {multiclassAllocations.map((allocation) => (
                  <div key={allocation.key} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 72px 30px", gap: "6px", alignItems: "center", marginTop: "7px" }}>
                    <input
                      list="prof-opts"
                      value={allocation.profession}
                      onChange={(event) => updateMulticlass(allocation.key, { profession: event.target.value })}
                      aria-label="Multiclass profession"
                      style={{ ...inputStyle, minWidth: 0 }}
                    />
                    <input
                      list="archetype-opts"
                      value={allocation.archetype}
                      onChange={(event) => updateMulticlass(allocation.key, { archetype: event.target.value })}
                      aria-label="Multiclass specialization"
                      style={{ ...inputStyle, minWidth: 0 }}
                    />
                    <input
                      type="number"
                      min={0}
                      max={70 - primaryProfessionLevels}
                      value={allocation.levels}
                      onChange={(event) => updateMulticlass(allocation.key, { levels: event.target.value })}
                      aria-label="Multiclass levels"
                      style={{ ...inputStyle, textAlign: "center", padding: "0 5px" }}
                    />
                    <button type="button" onClick={() => removeMulticlass(allocation.key)} aria-label="Remove multiclass profession" style={removeBtn}>×</button>
                  </div>
                ))}
              </div>
              <div>
                <label style={fieldLabel}>Gender</label>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button onClick={() => setGender("male")} style={chip(gender === "male")}>Male</button>
                  <button onClick={() => setGender("female")} style={chip(gender === "female")}>Female</button>
                </div>
              </div>
              <div>
                <label style={fieldLabel}>Aging mode</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {AGING_MODES.map((m) => (
                    <button key={m.id} onClick={() => setAgingMode(m.id)} style={chip(agingMode === m.id)}>{m.label}</button>
                  ))}
                </div>
              </div>
              {agingMode === "power-extended" && (
                <div>
                  <label style={fieldLabel}>Lifespan multiplier (×racial elder/max)</label>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button onClick={() => setLifespanMultiplier((m) => Math.max(1.5, Math.round((m - 0.5) * 10) / 10))} style={stepBtn}>−</button>
                    <div style={{ flex: 1, textAlign: "center", fontSize: "14px", color: colors.parchmentLight, fontFamily: fonts.serif, fontWeight: 700 }}>
                      ×{lifespanMultiplier.toFixed(1)}
                    </div>
                    <button onClick={() => setLifespanMultiplier((m) => Math.min(10.0, Math.round((m + 0.5) * 10) / 10))} style={stepBtn}>+</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* KINDRED */}
          <SectionHeader icon="users" title="Kindred" sub={`${raceDef.name || race}${subrace && subraceMap?.[subrace] ? ` · ${subraceMap[subrace].name}` : ""}`} open={open === "kindred"} onToggle={() => toggle("kindred")} />
          {open === "kindred" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "11px", padding: "4px 2px 8px" }}>
              <div>
                <label style={fieldLabel}>Race</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {Object.values(RACES).map((r) => <button key={r.id} onClick={() => pickRace(r.id)} style={chip(race === r.id)}>{r.name}</button>)}
                </div>
              </div>
              {subraceMap && (
                <div>
                  <label style={fieldLabel}>Lineage</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {Object.entries(subraceMap).map(([id, s]) => <button key={id} onClick={() => pickSubrace(id)} style={chip(subrace === id)}>{s.name}</button>)}
                  </div>
                </div>
              )}
              {isHuman && (
                <div>
                  <label style={fieldLabel}>Origin</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {Object.entries(ORIGIN_LABEL).map(([id, label]) => <button key={id} onClick={() => setOrigin(id)} style={chip(origin === id)}>{label}</button>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* APPEARANCE */}
          <SectionHeader icon="sparkle" title="Appearance" sub="optional flavour" open={open === "appearance"} onToggle={() => toggle("appearance")} />
          {open === "appearance" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "11px", padding: "4px 2px 8px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {Object.entries(APPEARANCE_OPTS).map(([k, opts]) => (
                  <div key={k}>
                    <label style={fieldLabel}>{k}</label>
                    <select value={appearance[k]} onChange={(e) => setAppearance((a) => ({ ...a, [k]: e.target.value }))} style={inputStyle}>
                      <option value="">—</option>
                      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div><label style={fieldLabel}>Distinguishing marks</label><input value={appearance.marks} onChange={(e) => setAppearance((a) => ({ ...a, marks: e.target.value }))} placeholder="scars, tattoos…" style={inputStyle} /></div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", color: colors.parchment, fontWeight: 600 }}>Attractiveness</div>
                  <div style={{ fontSize: "10px", color: "rgba(237,228,208,0.55)", marginTop: "1px" }}>1 grotesque · 5 plain · 10 breathtaking</div>
                </div>
                <button onClick={() => setAttractiveness((v) => Math.max(1, v - 1))} style={stepBtn}>−</button>
                <div style={{ width: "70px", textAlign: "center", fontSize: "14px", fontWeight: 800, color: colors.parchmentLight, fontFamily: fonts.serif }}>{attractiveness} <span style={{ fontSize: "10px", fontWeight: 600, color: "rgba(237,228,208,0.6)" }}>{descriptorFor(attractiveness)}</span></div>
                <button onClick={() => setAttractiveness((v) => Math.min(10, v + 1))} style={stepBtn}>+</button>
              </div>
              <div><label style={fieldLabel}>In your own words</label><textarea value={baseAppearance} onChange={(e) => setBaseAppearance(e.target.value)} placeholder="A line describing how you look" rows={2} style={{ ...inputStyle, height: "auto", padding: "9px 12px", resize: "vertical" }} /></div>
            </div>
          )}

          {/* ATTRIBUTES */}
          <SectionHeader icon="heart" title="Attributes" sub={`total ${attrTotal} · route budget ${routeBudgetMin}–${routeBudgetMax} · score ceiling ${attributeCeiling}`} open={open === "attributes"} onToggle={() => toggle("attributes")} />
          {open === "attributes" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "7px", padding: "4px 2px 8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                <span style={{ flex: 1, fontSize: "10px", color: "rgba(237,228,208,0.55)", lineHeight: 1.4 }}>
                  This is the saved sheet. Valid custom shapes remain exact; out-of-band changes are reconciled immediately with the selected route.
                </span>
                <button onClick={() => setAttrs({ ...routeBaseline })} style={{ ...chip(false), fontSize: "10px", padding: "5px 8px" }}>Route baseline</button>
              </div>
              {ATTR_KEYS.map((k) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ flex: 1, fontSize: "13px", color: colors.parchment, fontWeight: 600 }}>{ATTR_LABELS[k]}</div>
                  <button onClick={() => setAttr(k, -1)} style={stepBtn}>−</button>
                  <div style={{ width: "30px", textAlign: "center", fontSize: "16px", fontWeight: 800, color: colors.parchmentLight, fontFamily: fonts.serif }}>{attrs[k]}</div>
                  <button onClick={() => setAttr(k, +1)} style={stepBtn}>+</button>
                </div>
              ))}
            </div>
          )}

          {/* ABILITIES */}
          <SectionHeader icon="swords" title="Progression grants" sub={`${earnedRouteGrants.length} earned abilities & features`} open={open === "abilities"} onToggle={() => toggle("abilities")} />
          {open === "abilities" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "4px 2px 8px" }}>
              <div style={{ fontSize: "11px", lineHeight: 1.5, color: "rgba(237,228,208,0.6)" }}>
                Your invested professions and racial evolution grant these automatically. Specialization and metamagic decisions unlock at their thresholds and cannot be bypassed here.
              </div>
              {isPrimarySorcerer && (
                <div style={{ padding: "9px", borderRadius: radius.chip, backgroundColor: "rgba(215,167,111,0.08)", border: "1px solid rgba(215,167,111,0.25)" }}>
                  <label style={fieldLabel}>Signature spell · required</label>
                  <select
                    value={signatureSpellId}
                    onChange={(event) => setSignatureSpellId(event.target.value)}
                    aria-label="Sorcerer signature spell"
                    style={inputStyle}
                  >
                    <option value="">Choose a favourite spell</option>
                    {signatureSpellOptions.map((id) => {
                      const ability = getAbilityDef(id);
                      return <option key={id} value={id}>{ability?.name || titleCase(id)}</option>;
                    })}
                  </select>
                  <div style={{ marginTop: "6px", fontSize: "10px", lineHeight: 1.4, color: "rgba(237,228,208,0.55)" }}>
                    Sorcerers build a small repertoire, while this primary signature anchors early metamagic and later exchange choices.
                  </div>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {earnedRouteGrants.map(({ grant, level: grantLevel, source }, index) => {
                  const details = routeGrantDetails(grant);
                  return (
                    <div key={`${grant.type}-${grant.id || index}-${grantLevel}`} style={{ padding: "8px 9px", borderRadius: radius.chip, backgroundColor: "rgba(20,29,29,0.5)", border: "1px solid rgba(215,167,111,0.18)" }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px" }}>
                        <strong style={{ fontSize: "12px", color: colors.parchmentLight }}>{details.name}</strong>
                        <span style={{ flexShrink: 0, fontSize: "9px", fontWeight: 800, color: "rgba(215,167,111,0.62)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Level {grantLevel} · {titleCase(grant.type)}</span>
                      </div>
                      {details.description && <div style={{ marginTop: "3px", fontSize: "10px", lineHeight: 1.4, color: "rgba(237,228,208,0.55)" }}>{details.description}</div>}
                      {source && <div style={{ marginTop: "3px", fontSize: "9px", color: "rgba(215,167,111,0.48)" }}>{source}</div>}
                    </div>
                  );
                })}
                {earnedRouteGrants.length === 0 && (
                  <div style={{ padding: "10px", fontSize: "11px", color: "rgba(237,228,208,0.5)", border: "1px dashed rgba(215,167,111,0.2)", borderRadius: radius.chip }}>
                    Invest a level in a profession or racial evolution to earn its first grant.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* GEAR */}
          <SectionHeader icon="shield" title="Gear" sub={items.length ? `${items.length} item${items.length === 1 ? "" : "s"}` : "weapons, armour, kit"} open={open === "gear"} onToggle={() => toggle("gear")} />
          {open === "gear" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "4px 2px 8px" }}>
              {items.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {items.map((i) => {
                    const def = ALL_ITEMS[i.itemId];
                    const wearable = !!equipSlot(def);
                    return (
                      <div key={i.itemId} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 9px", borderRadius: radius.chip, backgroundColor: "rgba(215,167,111,0.08)", border: `1px solid rgba(215,167,111,0.25)` }}>
                        <div style={{ flex: 1, fontSize: "12px", color: colors.parchmentLight, fontWeight: 600 }}>{def?.name || i.itemId}</div>
                        {wearable ? (
                          <button onClick={() => toggleWorn(i.itemId)} style={chip(i.worn)}>{i.worn ? "Worn" : "Packed"}</button>
                        ) : (
                          <>
                            <button onClick={() => setItemQty(i.itemId, -1)} style={stepBtn}>−</button>
                            <div style={{ width: "20px", textAlign: "center", fontSize: "13px", color: colors.parchmentLight }}>{i.quantity}</div>
                            <button onClick={() => setItemQty(i.itemId, +1)} style={stepBtn}>+</button>
                          </>
                        )}
                        <button onClick={() => removeItem(i.itemId)} style={removeBtn}><Icon name="x" size={12} color="#fca5a5" strokeWidth={2.5} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
              <button onClick={addProvisions} style={{ ...chip(false), alignSelf: "flex-start", fontSize: "11px" }}>+ Standard provisions</button>
              <input value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} placeholder="Search the catalogue…" style={inputStyle} />
              {!itemSearch.trim() && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {ITEM_KINDS.map((k) => <button key={k.id} onClick={() => setItemKind(k.id)} style={{ ...chip(itemKind === k.id), fontSize: "11px", padding: "5px 9px" }}>{k.label}</button>)}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "260px", overflowY: "auto" }}>
                {itemList.map((it) => (
                  <button key={it.id} onClick={() => addItem(it)} disabled={hasItem(it.id)} style={{
                    display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px", borderRadius: radius.chip,
                    backgroundColor: "rgba(20,29,29,0.5)", border: `1px solid rgba(215,167,111,0.18)`,
                    cursor: hasItem(it.id) ? "default" : "pointer", fontFamily: "inherit", textAlign: "left", opacity: hasItem(it.id) ? 0.35 : 1,
                  }}>
                    <span style={{ flex: 1, fontSize: "12px", color: colors.parchment }}>{it.name}</span>
                    {it.tier && it.tier !== "common" && <span style={{ fontSize: "9px", fontWeight: 800, color: tierColor(it.tier) }}>{tierLabel(it.tier)}</span>}
                    <span style={{ fontSize: "16px", color: colors.gold, lineHeight: 1 }}>+</span>
                  </button>
                ))}
                {itemList.length === 0 && <div style={{ fontSize: "12px", color: "rgba(237,228,208,0.5)", padding: "8px" }}>Nothing matches.</div>}
              </div>
            </div>
          )}
        </div>

        {/* footer */}
        <div style={{ flexShrink: 0, padding: "12px 16px", borderTop: `1px solid rgba(215,167,111,0.18)`, backgroundColor: "rgba(8,11,12,0.6)" }}>
          <button onClick={begin} disabled={!canBegin} style={{
            width: "100%", padding: "13px", borderRadius: radius.control, border: "none",
            backgroundColor: canBegin ? colors.gold : "rgba(215,167,111,0.18)",
            color: canBegin ? colors.ink : "rgba(215,167,111,0.5)",
            fontSize: "14px", fontWeight: 800, cursor: canBegin ? "pointer" : "default", fontFamily: "inherit",
          }}>{busy ? "Drawing you into the world…" : name.trim() ? `Begin as ${name.trim()}` : "Name yourself to begin"}</button>
        </div>
      </div>
    </div>
  );
}

const stepBtn = {
  width: "30px", height: "30px", borderRadius: 8, flexShrink: 0, fontSize: "16px", fontWeight: 800,
  backgroundColor: "rgba(215,167,111,0.12)", color: colors.gold, border: `1px solid rgba(215,167,111,0.3)`,
  cursor: "pointer", fontFamily: "inherit", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center",
};
const removeBtn = {
  width: "26px", height: "26px", borderRadius: 7, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
  backgroundColor: "rgba(239,68,68,0.1)", border: `1px solid rgba(239,68,68,0.3)`, cursor: "pointer", fontFamily: "inherit",
};
