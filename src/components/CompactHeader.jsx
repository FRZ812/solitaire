import React from "react";
import { Icon } from "./Icon.jsx";
import { headerButtonStyle } from "./primitives.jsx";
import { colors, radius, fonts, metaStyle } from "./tokens.js";
import { TERRAINS } from "../data/terrains.js";
import { getTile, currentLocationName } from "../engine/world.js";
import { getBiome } from "../data/biomes.js";
import { formatTime, getCalendarDate } from "../engine/time.js";

export function CompactHeader({ state, onMap, onMenu, onParty }) {
  const partyCount = (state.party || []).length;
  const cur = state.world.currentTile;
  const t = getTile(state, cur.x, cur.y);
  const sceneTitle = currentLocationName(state);
  const terrainLabel = TERRAINS[t.terrain]?.label || "Wilderness";
  const biome = getBiome(cur.x, cur.y);
  const time = formatTime(state.time);
  const date = getCalendarDate(state.time);
  // Compact 3-letter month abbreviation for the header chip. The map view
  // shows the full date + year — this stays tight so the scene title has room.
  const monthAbbr = date.monthName.slice(0, 3);

  return (
    <div style={{
      padding: "calc(env(safe-area-inset-top, 0px) + 8px) 12px 6px 12px",
      display: "flex", alignItems: "center", gap: "9px",
      color: colors.parchment,
    }}>
      {/* Date / time block — kept compact (full date is on the map). */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        width: "54px", height: "36px",
        backgroundColor: "rgba(20, 29, 29, 0.6)",
        border: `1px solid rgba(215, 167, 111, 0.28)`,
        borderRadius: radius.panelCompact,
        flexShrink: 0,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.02)",
        lineHeight: 1,
      }} title={`${date.dayOfMonth} ${date.monthName}, ${date.year}`}>
        <span style={{
          ...metaStyle, fontSize: "8px", letterSpacing: "0.1em",
          color: colors.gold, textShadow: "0 0 4px rgba(215, 167, 111, 0.2)",
          whiteSpace: "nowrap",
        }}>{date.dayOfMonth} {monthAbbr}</span>
        <span style={{
          fontFamily: fonts.serif, fontStyle: "italic",
          fontSize: "14px", color: colors.parchment, marginTop: "2px",
        }}>{time}</span>
      </div>

      {/* Scene title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: fonts.serif, fontStyle: "italic",
          fontSize: "19px", color: colors.parchment, lineHeight: "1.05",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          textShadow: "0 2px 10px rgba(0,0,0,0.8)",
        }}>
          {sceneTitle}
        </div>
        <div style={{
          ...metaStyle, fontSize: "8px", letterSpacing: "0.14em",
          color: "rgba(237, 228, 208, 0.72)", marginTop: "3px",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          textShadow: "0 1px 6px rgba(0,0,0,0.8)",
        }}>
          {terrainLabel} / {biome.name}
        </div>
      </div>

      {/* Action buttons — codex dropped (it's reachable from the menu sheet) */}
      <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
        {partyCount > 0 && (
          <button onClick={onParty} style={{ ...headerButtonStyle, position: "relative" }} aria-label="Company">
            <Icon name="users" size={16} color={colors.gold} strokeWidth={1.8} />
            <span style={{
              position: "absolute", top: "-4px", right: "-4px", minWidth: "16px", height: "16px",
              padding: "0 4px", borderRadius: "999px", backgroundColor: colors.gold, color: colors.ink,
              fontSize: "9px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
            }}>{partyCount}</span>
          </button>
        )}
        <button onClick={onMap}  style={headerButtonStyle} aria-label="Map">  <Icon name="map"        size={16} color={colors.gold} strokeWidth={1.8} /></button>
        <button onClick={onMenu} style={headerButtonStyle} aria-label="Character"> <Icon name="user" size={16} color={colors.gold} strokeWidth={1.8} /></button>
      </div>
    </div>
  );
}
