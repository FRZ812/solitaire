import React from "react";
import { Icon } from "./Icon.jsx";
import { iconButtonStyle } from "./primitives.jsx";
import { TERRAINS } from "../data/terrains.js";
import { getTile, currentLocationName } from "../engine/world.js";
import { getBiome } from "../data/biomes.js";
import { formatTime } from "../engine/time.js";

export function CompactHeader({ state, onMap, onCodex, onMenu }) {
  const cur = state.world.currentTile;
  const t = getTile(state, cur.x, cur.y);
  const sceneTitle = currentLocationName(state);
  const terrainLabel = TERRAINS[t.terrain]?.label || "Wilderness";
  const biome = getBiome(cur.x, cur.y);
  const time = formatTime(state.time);
  return (
    <div style={{
      padding: "calc(env(safe-area-inset-top, 0px) + 10px) 12px 10px 14px",
      display: "flex", alignItems: "center", gap: "10px",
      borderBottom: "1px solid #EBE5D6",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 11px", backgroundColor: "#1A1A1A", borderRadius: "9px", color: "#FBF8F2", flexShrink: 0 }}>
        <Icon name="sun" size={11} color="#E8B98C" strokeWidth={2} />
        <span style={{ fontSize: "10px", letterSpacing: "0.14em", opacity: 0.65, fontWeight: 500 }}>D{state.time.day}</span>
        <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "14px" }}>{time}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "17px", color: "#1A1A1A", lineHeight: "1.1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {sceneTitle}
        </div>
        <div style={{ fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#8B5A2B", marginTop: "2px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {terrainLabel} · {biome.name} · ({cur.x},{cur.y})
        </div>
      </div>
      <div style={{ display: "flex", gap: "5px", flexShrink: 0 }}>
        <button onClick={onMap}   style={iconButtonStyle} aria-label="Map">  <Icon name="map"  size={14} color="#1A1A1A" strokeWidth={1.5} /></button>
        <button onClick={onCodex} style={iconButtonStyle} aria-label="Codex"><Icon name="book" size={14} color="#1A1A1A" strokeWidth={1.5} /></button>
        <button onClick={onMenu}  style={iconButtonStyle} aria-label="Menu"> <Icon name="menu" size={14} color="#1A1A1A" strokeWidth={1.5} /></button>
      </div>
    </div>
  );
}
