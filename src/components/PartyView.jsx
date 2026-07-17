import React from "react";
import { Panel, SectionHeader } from "./primitives.jsx";
import { DeckPage, DeckPageHeader } from "./DeckPage.jsx";
import { colors, radius, fonts, metaStyle } from "./tokens.js";
import { ATTR_KEYS, ATTR_LABELS } from "../config.js";
import { partyMembers, mountMembers, nonMountPartyMembers } from "../engine/party.js";
import { relationshipTier } from "../engine/relationships.js";
import { currentRideLoad, effectiveLoad, canMount, rideCapacityOf } from "../engine/riding.js";
import { loadOf } from "../engine/weight.js";
import { itemTemplate } from "../data/catalog.js";

// The party roster: every recruited companion AND mount as a full creature —
// appearance, attributes, gear — with the option to part ways, and (for mounts)
// to seat riders by weight (engine/riding.js) and ride/dismount.
// Party page of the panel deck — companions and mounts as full creatures, with
// part-ways and (for mounts) weight-bound seat/ride controls. Content only; the
// deck supplies the sheet chrome, scroll, and dismissal.
//
// `onOpenInventory(id)` hands control up so the parent (App.jsx) can switch the
// PanelDeck to Inventory and preselect that party member as the target.
export function PartyView({ state, onDismiss, onMount, onDismount, onOpenInventory }) {
  const chars = state.world.codex.characters;
  const members = partyMembers(state);
  const mounts = mountMembers(state);
  const people = nonMountPartyMembers(state);
  const wanderer = chars.wanderer;
  const codexItems = state.world.codex.items;

  // Everyone who could be seated on a mount: the player, companions, other mounts.
  const candidates = [wanderer, ...members];
  const nameOf = (id) => chars[id]?.name || (id === "wanderer" ? "You" : id);

  // Pack preview + Open-pack affordance. Folded in here so it reads inline with
  // the surrounding panel layout — mounts use the same component with a label of
  // "Open saddlebag" instead of "Open pack".
  const renderPackPanel = (c, { mount }) => {
    const wornList = c.worn || [];
    const carriedList = c.inventory?.carried || [];
    const cap = c.carryCapacityMax ?? 0;
    const load = Math.round(loadOf(c, c.inventory, codexItems));
    const pct = cap ? Math.min(999, Math.round((load / cap) * 100)) : 0;
    // Preview: first 2–3 visible items (worn first, then pack) by name.
    const previewItems = [];
    for (const id of wornList) {
      const def = codexItems[id] || itemTemplate(id);
      previewItems.push(def?.name || id.replace(/-/g, " "));
      if (previewItems.length >= 3) break;
    }
    if (previewItems.length < 3) {
      for (const ci of carriedList) {
        const def = codexItems[ci.itemId] || itemTemplate(ci.itemId);
        previewItems.push(def?.name || ci.itemId.replace(/-/g, " "));
        if (previewItems.length >= 3) break;
      }
    }
    const totalItems = wornList.length + carriedList.length;
    const tail = totalItems > previewItems.length ? "…" : "";
    return (
      <div className="company-pack" style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "140px", fontSize: "11px", color: "rgba(237,228,208,0.6)", lineHeight: 1.4 }}>
          {previewItems.length > 0 ? (
            <>
              <span style={{ ...metaStyle, fontSize: "8px", color: colors.parchmentMuted }}>{mount ? "Bears " : "Carries "}</span>
              {previewItems.join(", ")}{tail}
            </>
          ) : (
            <span style={{ fontStyle: "italic", color: "rgba(237,228,208,0.4)" }}>{mount ? "Saddlebag empty." : "Empty-handed."}</span>
          )}
        </div>
        {cap > 0 && (
          <div style={{ minWidth: "84px" }}>
            <div style={{ ...metaStyle, fontSize: "8px", color: pct >= 100 ? "#d98a6a" : colors.parchmentMuted, textAlign: "right", marginBottom: "2px" }}>{load} / {cap}</div>
            <div style={{ height: "5px", borderRadius: "3px", backgroundColor: "rgba(20,29,29,0.7)", overflow: "hidden", border: "1px solid rgba(215,167,111,0.14)" }}>
              <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", backgroundColor: pct >= 100 ? "#d98a6a" : colors.gold }} />
            </div>
          </div>
        )}
        {onOpenInventory && (
          <button onClick={() => onOpenInventory(c.id)} style={openPackBtn}>{mount ? "Open saddlebag" : "Open pack"}</button>
        )}
      </div>
    );
  };

  return (
    <DeckPage className="company-view">
      <DeckPageHeader
        icon="company"
        title="Company"
        subtitle={members.length === 0 ? "Travelling alone" : `${people.length} companion${people.length === 1 ? "" : "s"}${mounts.length ? ` · ${mounts.length} mount${mounts.length === 1 ? "" : "s"}` : ""}`}
      />

      <div>
        {members.length === 0 && (
          <div style={{ padding: "28px 8px", textAlign: "center", fontStyle: "italic", fontSize: "13px", color: "rgba(237,228,208,0.5)", lineHeight: 1.5 }}>
            You travel alone. Folk for hire gather at taverns; mounts are bought at a stable or won on the road.
          </div>
        )}

        {mounts.length > 0 && <SectionHeader>Mounts</SectionHeader>}
        {mounts.map((m) => {
          const load = currentRideLoad(m, state);
          const cap = rideCapacityOf(m);
          const pct = cap ? Math.min(100, Math.round((load / cap) * 100)) : 0;
          const seatable = candidates.filter((c) => c && c.id !== m.id && c.ridingOn !== m.id && canMount(state, c.id, m.id).ok);
          return (
            <Panel key={m.id} className="company-card company-card--mount" tone="warm" style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <div className="company-avatar company-avatar--mount" aria-hidden="true">{(m.name || "M").slice(0, 1).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "19px", color: colors.parchmentLight, lineHeight: 1.1 }}>{m.name}</div>
                  <div style={{ ...metaStyle, fontSize: "8px", color: colors.parchmentMuted, marginTop: "3px" }}>
                    {m.race} · {m.tier} · {m.moveProfile?.canFly ? "flies" : `ground ×${m.moveProfile?.ground ?? 1}`}
                    {m.ridingOn ? ` · riding ${nameOf(m.ridingOn)}` : ""}
                  </div>
                </div>
                <button onClick={() => onDismiss(m.id)} style={partWaysStyle}>Set loose</button>
              </div>

              <div style={{ fontSize: "12px", fontStyle: "italic", color: "rgba(237,228,208,0.7)", lineHeight: 1.45, margin: "8px 0" }}>{m.description}</div>

              {/* Ride-load gauge */}
              <div style={{ margin: "6px 0 4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", ...metaStyle, color: colors.parchmentMuted, marginBottom: "3px" }}>
                  <span>Bears</span><span>{Math.round(load)} / {cap}</span>
                </div>
                <div style={{ height: "6px", borderRadius: "3px", backgroundColor: "rgba(20,29,29,0.7)", overflow: "hidden", border: "1px solid rgba(215,167,111,0.14)" }}>
                  <div style={{ width: `${pct}%`, height: "100%", backgroundColor: pct >= 100 ? "#d98a6a" : colors.gold }} />
                </div>
              </div>

              {/* Needs */}
              <div style={{ ...metaStyle, fontSize: "8px", color: colors.parchmentMuted, marginBottom: "6px" }}>
                hunger {Math.round(m.needs?.hunger ?? 0)} · rest {Math.round(m.needs?.sleep ?? 0)} · eats {m.feed}
              </div>

              {/* Current riders */}
              {(m.riders?.length > 0) && (
                <div style={{ marginBottom: "6px" }}>
                  {m.riders.map((rid) => (
                    <div key={rid} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 8px", marginBottom: "4px", borderRadius: radius.chip, backgroundColor: "rgba(20,29,29,0.5)", border: "1px solid rgba(215,167,111,0.14)" }}>
                      <span style={{ fontSize: "12px", color: colors.parchment }}>{nameOf(rid)} <span style={{ ...metaStyle, fontSize: "8px", color: colors.parchmentMuted }}>· {Math.round(effectiveLoad(chars[rid], state))}</span></span>
                      <button onClick={() => onDismount(rid)} style={miniBtn}>Dismount</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Seat someone aboard */}
              {seatable.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                  {seatable.map((c) => (
                    <button key={c.id} onClick={() => onMount(c.id, m.id)} style={seatBtn}>+ {c.id === "wanderer" ? "Ride" : `Seat ${c.name}`}</button>
                  ))}
                </div>
              )}

              {/* Saddlebag — preview, capacity, Open saddlebag. */}
              {renderPackPanel(m, { mount: true })}
            </Panel>
          );
        })}

        {people.length > 0 && <SectionHeader>Companions</SectionHeader>}
        {people.map((c) => (
          <Panel key={c.id} className="company-card company-card--companion" tone="default" style={{ marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <div className="company-avatar" aria-hidden="true">{(c.name || "C").slice(0, 1).toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "19px", color: colors.parchmentLight, lineHeight: 1.1 }}>{c.name}</div>
                <div style={{ ...metaStyle, fontSize: "8px", color: colors.parchmentMuted, marginTop: "3px" }}>{c.race} · {c.profession}{c.ridingOn ? ` · riding ${nameOf(c.ridingOn)}` : ""}</div>
                {(() => { const t = relationshipTier(c.relationship || 0); return (
                  <span style={{ display: "inline-block", marginTop: "5px", fontSize: "9px", fontWeight: 800, letterSpacing: "0.04em", padding: "2px 8px", borderRadius: radius.pill, color: t.color, border: `1px solid ${t.color}55`, backgroundColor: `${t.color}14` }}>
                    {t.label} · {(c.relationship || 0) > 0 ? "+" : ""}{c.relationship || 0}
                  </span>
                ); })()}
                {(c.kind === "thrall" || (c.conditions || []).some((x) => (x.name || x) === "Enthralled")) && (
                  <span style={{ display: "inline-block", marginLeft: "6px", marginTop: "5px", fontSize: "9px", fontWeight: 800, letterSpacing: "0.04em", padding: "2px 8px", borderRadius: radius.pill, color: "#c98bdb", border: "1px solid #c98bdb55", backgroundColor: "#c98bdb14" }}>
                    ⛓ Enthralled
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "5px", alignItems: "flex-end", flexShrink: 0 }}>
                <button onClick={() => onDismiss(c.id)} style={partWaysStyle}>{c.kind === "thrall" ? "Release" : "Part ways"}</button>
                {c.ridingOn && <button onClick={() => onDismount(c.id)} style={miniBtn}>Dismount</button>}
              </div>
            </div>

            <div style={{ fontSize: "12px", fontStyle: "italic", color: "rgba(237,228,208,0.7)", lineHeight: 1.45, margin: "8px 0" }}>{c.base_appearance}</div>
            <div style={{ fontSize: "12px", color: colors.parchment, lineHeight: 1.45, marginBottom: "10px" }}>{c.description}</div>

            <div className="company-attributes" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "4px", marginBottom: "8px" }}>
              {ATTR_KEYS.map((k) => (
                <div key={k} style={{ textAlign: "center", padding: "5px 2px", borderRadius: radius.chip, backgroundColor: "rgba(20,29,29,0.5)", border: "1px solid rgba(215,167,111,0.14)" }}>
                  <div style={{ ...metaStyle, fontSize: "7px", color: colors.gold }}>{ATTR_LABELS[k].slice(0, 3)}</div>
                  <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "16px", color: colors.parchment }}>{c.attributes?.[k] ?? 0}</div>
                </div>
              ))}
            </div>

            {/* Pack — preview, capacity, Open pack. Replaces the old worn comma-list. */}
            {renderPackPanel(c, { mount: false })}
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
    </DeckPage>
  );
}

const partWaysStyle = {
  padding: "6px 12px", borderRadius: radius.pill, flexShrink: 0,
  border: "1px solid rgba(215,167,111,0.3)", backgroundColor: "transparent",
  color: "rgba(215,167,111,0.8)", fontSize: "11px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
};
const miniBtn = {
  padding: "4px 10px", borderRadius: radius.pill, border: "1px solid rgba(215,167,111,0.25)",
  backgroundColor: "transparent", color: "rgba(215,167,111,0.75)", fontSize: "10px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
};
const seatBtn = {
  padding: "5px 11px", borderRadius: radius.pill, border: "none",
  backgroundColor: colors.gold, color: colors.ink, fontSize: "11px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
};
const openPackBtn = {
  padding: "5px 11px", borderRadius: radius.pill,
  border: `1px solid ${colors.gold}55`, backgroundColor: "rgba(215,167,111,0.10)",
  color: colors.parchmentLight, fontSize: "11px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
};
