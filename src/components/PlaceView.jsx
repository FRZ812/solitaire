import React, { useMemo } from "react";
import { currentPlace, currentNode, currentExits, canLeave } from "../engine/place.js";
import { buildingForTile, isBuildingOpen } from "../data/town.js";
import { nodeTile } from "../engine/place.js";

// Place (scale-2) view — the "local map" for a node-graph place (a city, a big
// dungeon). The party stands in one node; exits are tappable; a node with a
// service opens the same trader/tavern/etc. counters the world tiles use; a
// worldExit node steps back out onto the world hex.
//
// Movement between nodes is a light UI-only state change (the narrator learns the
// new location on your next action) — local navigation, not a regional journey.

const GOLD = "#d7a76f";
const CREAM = "#f5dcb8";
const AMBER = "#e6b98c";
const PANEL = "#141d1d";
const INK = "#0c1111";

const ACCESS_TONE = {
  public: "#7fae7f",
  guarded: "#d9b36a",
  conditional: "#d9b36a",
  restricted: "#cf8a6a",
  hidden: "#9a86c4",
};

function TypeGlyph({ type }) {
  // A tiny unicode glyph per node type — cheap, legible, no asset pipeline.
  const G = {
    gate: "⛩", hall: "▤", market: "⚖", smithy: "⚒", healer: "✚", shrine: "✦",
    dock: "⚓", stair: "≣", plaza: "◇", court: "§", prison: "▦", slavemarket: "⛓",
    palace: "♚", barracks: "⚔", stable: "🐎", yard: "▢", town: "⌂", bldg: "⌂",
    hidden: "◈", tower: "♜",
  };
  return <span style={{ fontSize: 15, opacity: 0.9 }}>{G[type] || "•"}</span>;
}

export function PlaceView({ state, time, onMove, onLeave, onService, onClose }) {
  const place = currentPlace(state);
  const node = currentNode(state);
  const exits = currentExits(state);
  const leavable = canLeave(state);

  // Group all nodes by district for the orientation panel.
  const districts = useMemo(() => {
    if (!place) return [];
    const m = new Map();
    for (const [id, n] of Object.entries(place.nodes)) {
      const d = n.district || "—";
      if (!m.has(d)) m.set(d, []);
      m.get(d).push({ id, name: n.name, type: n.type });
    }
    return [...m.entries()];
  }, [place]);

  if (!place || !node) return null;

  const tile = nodeTile(place, node);
  const building = buildingForTile(tile);
  const open = building ? isBuildingOpen(building, time?.hour ?? 12) : false;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 40, background: INK,
      display: "flex", flexDirection: "column", color: CREAM,
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
        borderBottom: `1px solid rgba(215,167,111,0.18)`, background: PANEL,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: AMBER, opacity: 0.85 }}>
            {place.name}{node.district ? ` · ${node.district}` : ""}
          </div>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 26, color: CREAM, lineHeight: 1.1 }}>
            {node.name}
          </div>
        </div>
        <button onClick={onClose} style={btnGhost}>Close</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Current vantage */}
        <div style={{ background: PANEL, borderRadius: 10, padding: "14px 16px", border: `1px solid rgba(215,167,111,0.12)` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <TypeGlyph type={node.type} />
            {node.access && (
              <span style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: ACCESS_TONE[node.access] || AMBER }}>
                {node.access}
              </span>
            )}
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.55, color: "rgba(245,220,184,0.92)" }}>
            {node.description}
          </div>

          {building && (
            <button
              onClick={() => onService?.(node, building)}
              style={{ ...btnPrimary, marginTop: 12, opacity: open ? 1 : 0.6 }}
            >
              {open ? `Step into ${building.label}` : `${building.label} — closed (${building.hours?.open}:00–${building.hours?.close}:00)`}
            </button>
          )}
        </div>

        {/* Exits */}
        <div>
          <div style={sectionLabel}>Ways from here</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
            {exits.map((ex) => (
              <button key={ex.id} onClick={() => onMove?.(ex.id)} style={exitCard}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <TypeGlyph type={ex.type} />
                  <span style={{ fontSize: 14, color: CREAM, fontWeight: 600 }}>{ex.name}</span>
                </div>
                {ex.district && <div style={{ fontSize: 11, color: AMBER, opacity: 0.8 }}>{ex.district}</div>}
              </button>
            ))}
            {leavable && (
              <button onClick={onLeave} style={{ ...exitCard, borderColor: "rgba(207,138,106,0.5)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 15 }}>⤴</span>
                  <span style={{ fontSize: 14, color: "#cf8a6a", fontWeight: 600 }}>Out the gate</span>
                </div>
                <div style={{ fontSize: 11, color: AMBER, opacity: 0.8 }}>Leave {place.name} for the road</div>
              </button>
            )}
          </div>
        </div>

        {/* District orientation map */}
        <div>
          <div style={sectionLabel}>{place.name} at a glance</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {districts.map(([d, ns]) => (
              <div key={d} style={{ background: "rgba(20,29,29,0.6)", borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: AMBER, marginBottom: 4, opacity: 0.85 }}>{d}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ns.map((n) => {
                    const here = n.id === node.id;
                    return (
                      <span key={n.id} style={{
                        fontSize: 12, padding: "2px 8px", borderRadius: 999,
                        background: here ? "rgba(215,167,111,0.22)" : "rgba(215,167,111,0.06)",
                        color: here ? CREAM : "rgba(245,220,184,0.7)",
                        border: here ? `1px solid ${GOLD}` : "1px solid transparent",
                      }}>{n.name}</span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const sectionLabel = { fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: AMBER, opacity: 0.8, marginBottom: 8 };
const btnGhost = {
  background: "transparent", border: `1px solid rgba(215,167,111,0.3)`, color: CREAM,
  borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13,
};
const btnPrimary = {
  background: "rgba(215,167,111,0.16)", border: `1px solid ${GOLD}`, color: CREAM,
  borderRadius: 8, padding: "9px 14px", cursor: "pointer", fontSize: 14, width: "100%",
};
const exitCard = {
  background: "rgba(20,29,29,0.85)", border: `1px solid rgba(215,167,111,0.22)`,
  color: CREAM, borderRadius: 10, padding: "10px 12px", cursor: "pointer",
  textAlign: "left", display: "flex", flexDirection: "column",
};
