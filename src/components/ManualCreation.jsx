import React, { useState, useMemo } from "react";
import { Icon } from "./Icon.jsx";
import { colors, radius, fonts } from "./tokens.js";
import { ATTR_KEYS, ATTR_LABELS, ORIGIN_LABEL } from "../config.js";
import { RACES } from "../data/races.js";
import { ABILITY_CATALOG, abilityCategoryOf, getAbilityDef } from "../data/abilities.js";
import { ALL_ITEMS } from "../data/catalog.js";
import { equipSlot } from "../engine/combat-stats.js";
import { TIERS, tier as tierInfo, tierColor, tierLabel, tierOrder } from "../data/tiers.js";
import { CHARACTER_TEMPLATES, STANDARD_PROVISIONS } from "../data/templates.js";
import { descriptorFor } from "../data/attractiveness.js";

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
const PROFESSION_OPTS = ["sellsword", "knight", "ranger", "hunter", "thief", "assassin", "hedge-mage", "sorcerer", "scholar", "priest", "healer", "envoy", "courtier", "bard", "merchant", "outlaw", "noble", "barbarian", "monk"];
const SUBCLASS_OPTS = [...new Set(CHARACTER_TEMPLATES.map((template) => template.setup.subclass).filter(Boolean))];
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

// Tiers a granted ability may take: from its floor up to divine.
function tiersAtOrAbove(floorId) {
  const f = tierOrder(floorId || "common");
  return TIERS.filter((t) => t.order >= f);
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
  const [subclass, setSubclass] = useState("");
  const [race, setRace] = useState("human");
  const [subrace, setSubrace] = useState(null);
  const [origin, setOrigin] = useState("north");
  const [appearance, setAppearance] = useState({ skin: "", hair: "", eyes: "", build: "", facial_hair: "", marks: "" });
  const [attractiveness, setAttractiveness] = useState(5);
  const [gender, setGender] = useState("male");
  const [baseAppearance, setBaseAppearance] = useState("");
  const [attrs, setAttrs] = useState({ body: 3, reflex: 3, vigor: 3, mind: 3, wit: 3, presence: 3 });
  const [abilities, setAbilities] = useState([]); // [{id, tier}]
  const [items, setItems] = useState([]); // [{itemId, quantity, worn}]
  const [itemSearch, setItemSearch] = useState("");
  const [itemKind, setItemKind] = useState("weapon");

  const raceDef = RACES[race] || {};
  const subraceMap = raceDef.subraces || null;
  const isHuman = race === "human";

  const setAttr = (k, d) => setAttrs((a) => ({ ...a, [k]: Math.max(1, Math.min(30, (a[k] || 0) + d)) }));
  const attrTotal = ATTR_KEYS.reduce((s, k) => s + (attrs[k] || 0), 0);

  const pickRace = (id) => {
    setRace(id);
    setSubrace(null);
    setOrigin(id === "human" ? "north" : id);
  };

  // ---- abilities ----
  const grantable = useMemo(() => {
    const g = ABILITY_CATALOG.filter((a) => !a.innate && !a.unique);
    const groups = { martial: [], spell: [] };
    for (const a of g) (groups[abilityCategoryOf(a)] || groups.martial).push(a);
    return groups;
  }, []);
  const hasAbility = (id) => abilities.some((a) => a.id === id);
  const addAbility = (def) => { if (!hasAbility(def.id)) setAbilities((l) => [...l, { id: def.id, tier: def.minTier || "common" }]); };
  const setAbilityTier = (id, t) => setAbilities((l) => l.map((a) => (a.id === id ? { ...a, tier: t } : a)));
  const removeAbility = (id) => setAbilities((l) => l.filter((a) => a.id !== id));

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

  const canBegin = name.trim().length > 0 && !!race && !busy;

  const begin = () => {
    if (!canBegin) return;
    const appr = {};
    for (const k of ["skin", "hair", "eyes", "build", "facial_hair", "marks"]) if (appearance[k]?.trim()) appr[k] = appearance[k].trim();
    onBegin({
      name: name.trim(),
      bond: bond.trim() || "A past unspoken — yours to reveal in the telling.",
      age,
      agingMode,
      lifespanMultiplier: agingMode === "power-extended" ? lifespanMultiplier : undefined,
      attractiveness, gender,
      profession: profession.trim() || "wanderer",
      subclass: subclass.trim() || null,
      race, subrace: subrace || null, origin: isHuman ? origin : race,
      attributes: attrs,
      appearance: Object.keys(appr).length ? appr : undefined,
      base_appearance: baseAppearance.trim() || undefined,
      abilities,
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
          <SectionHeader icon="user" title="Identity" sub={name.trim() ? `${name}${profession ? ` · ${profession}` : ""}${subclass ? ` · ${subclass}` : ""}` : "name, drive, age, class, subclass"} open={open === "identity"} onToggle={() => toggle("identity")} />
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
                  <input list="prof-opts" value={profession} onChange={(e) => setProfession(e.target.value)} placeholder="e.g. sellsword" style={inputStyle} />
                  <datalist id="prof-opts">{PROFESSION_OPTS.map((o) => <option key={o} value={o} />)}</datalist>
                </div>
              </div>
              <div>
                <label style={fieldLabel}>Subclass / specialization</label>
                <input list="subclass-opts" value={subclass} onChange={(e) => setSubclass(e.target.value)} placeholder="e.g. shadowblade" style={inputStyle} />
                <datalist id="subclass-opts">{SUBCLASS_OPTS.map((o) => <option key={o} value={o} />)}</datalist>
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
                    {Object.entries(subraceMap).map(([id, s]) => <button key={id} onClick={() => setSubrace(subrace === id ? null : id)} style={chip(subrace === id)}>{s.name}</button>)}
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
          <SectionHeader icon="heart" title="Attributes" sub={`total ${attrTotal} · no cap`} open={open === "attributes"} onToggle={() => toggle("attributes")} />
          {open === "attributes" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "7px", padding: "4px 2px 8px" }}>
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
          <SectionHeader icon="swords" title="Abilities" sub={abilities.length ? `${abilities.length} chosen` : "techniques & spells"} open={open === "abilities"} onToggle={() => toggle("abilities")} />
          {open === "abilities" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "4px 2px 8px" }}>
              {abilities.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {abilities.map((a) => {
                    const def = getAbilityDef(a.id);
                    return (
                      <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 9px", borderRadius: radius.chip, backgroundColor: "rgba(215,167,111,0.08)", border: `1px solid rgba(215,167,111,0.25)` }}>
                        <div style={{ flex: 1, fontSize: "12px", color: colors.parchmentLight, fontWeight: 600 }}>{def?.name || a.id}</div>
                        <select value={a.tier} onChange={(e) => setAbilityTier(a.id, e.target.value)} style={{ ...inputStyle, width: "auto", height: "30px", padding: "0 8px", fontSize: "11px", color: tierColor(a.tier) }}>
                          {tiersAtOrAbove(def?.minTier).map((t) => <option key={t.id} value={t.id} style={{ color: colors.ink }}>{t.label}</option>)}
                        </select>
                        <button onClick={() => removeAbility(a.id)} style={removeBtn}><Icon name="x" size={12} color="#fca5a5" strokeWidth={2.5} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
              {["martial", "spell"].map((cat) => (
                <div key={cat}>
                  <div style={fieldLabel}>{cat === "martial" ? "Martial techniques" : "Spells"}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {grantable[cat].map((def) => (
                      <button key={def.id} onClick={() => addAbility(def)} disabled={hasAbility(def.id)} title={def.desc} style={{
                        ...chip(false), opacity: hasAbility(def.id) ? 0.35 : 1, fontSize: "11px", padding: "5px 9px",
                      }}>
                        {def.name}{def.minTier ? <span style={{ color: tierColor(def.minTier), marginLeft: 4 }}>≥{tierInfo(def.minTier).label}</span> : null}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
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
