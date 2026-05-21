import React from "react";
import { Icon } from "./Icon.jsx";
import { headerButtonStyle } from "./primitives.jsx";
import { colors, radius, fonts, metaStyle } from "./tokens.js";
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
      padding: "calc(env(safe-area-inset-top, 0px) + 12px) 12px 8px 14px",
      display: "flex", alignItems: "center", gap: "10px",
      color: colors.parchment,
    }}>
      {/* Day / time block */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        width: "54px", height: "44px",
        backgroundColor: "rgba(20, 29, 29, 0.6)",
        border: `1px solid rgba(215, 167, 111, 0.28)`,
        borderRadius: radius.panelCompact,
        flexShrink: 0,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.02)",
      }}>
        <span style={{ ...metaStyle, fontSize: "9px", letterSpacing: "0.14em", color: colors.gold, textShadow: "0 0 4px rgba(215, 167, 111, 0.2)" }}>D{state.time.day}</span>
        <span style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: "16px", lineHeight: 1, color: colors.parchment }}>{time}</span>
      </div>

      {/* Scene title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: fonts.serif, fontStyle: "italic",
          fontSize: "22px", color: colors.parchment, lineHeight: "1.05",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          textShadow: "0 2px 10px rgba(0,0,0,0.8)",
        }}>
          {sceneTitle}
        </div>
        <div style={{
          ...metaStyle, fontSize: "9px", letterSpacing: "0.14em",
          color: "rgba(237, 228, 208, 0.72)", marginTop: "4px",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          textShadow: "0 1px 6px rgba(0,0,0,0.8)",
        }}>
          {terrainLabel} / {biome.name}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
        <button onClick={onMap}   style={headerButtonStyle} aria-label="Map">  <Icon name="map"  size={17} color={colors.gold} strokeWidth={1.8} /></button>
        <button onClick={onCodex} style={headerButtonStyle} aria-label="Codex"><Icon name="book" size={17} color={colors.gold} strokeWidth={1.8} /></button>
        <button onClick={onMenu}  style={headerButtonStyle} aria-label="Menu"> <Icon name="woodenBird" size={17} color={colors.gold} strokeWidth={1.8} /></button>
      </div>
    </div>
  );
}
