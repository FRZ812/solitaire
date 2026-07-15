import React from "react";
import { Icon } from "./Icon.jsx";
import { colors } from "./tokens.js";
import { TERRAINS } from "../data/terrains.js";
import { getTile, currentLocationName } from "../engine/world.js";
import { standingNodeTile } from "../engine/place.js";
import { getBiome } from "../data/biomes.js";
import { sceneBiomeId } from "../data/visual-assets.js";
import { formatTime, getCalendarDate } from "../engine/time.js";

export function CompactHeader({ state, onMap, onOpenDeck }) {
  const partyCount = (state.party || []).length;
  const cur = state.world.currentTile;
  const t = standingNodeTile(state) || getTile(state, cur.x, cur.y);
  const sceneTitle = currentLocationName(state);
  const terrainLabel = TERRAINS[t.terrain]?.label || "Wilderness";
  const biome = getBiome(cur.x, cur.y);
  const biomeLabel = sceneBiomeId(biome.id, t) === "whitemarch" ? "Whitemarch" : biome.name;
  const time = formatTime(state.time);
  const date = getCalendarDate(state.time);
  // Compact 3-letter month abbreviation for the header chip. The map view
  // shows the full date + year — this stays tight so the scene title has room.
  const monthAbbr = date.monthName.slice(0, 3);

  return (
    <header className="compact-header">
      <div className="compact-header__date" title={`${date.dayOfMonth} ${date.monthName}, ${date.year}`}>
        <span><b>{date.dayOfMonth}</b> {monthAbbr}</span>
        <time>{time}</time>
      </div>

      <div className="compact-header__scene">
        <div className="compact-header__title">{sceneTitle}</div>
        <div className="compact-header__place">
          <span>{terrainLabel}</span><i aria-hidden="true" /><span>{biomeLabel}</span>
        </div>
      </div>

      <nav className="compact-header__actions" aria-label="World and dossier">
        <button className="compact-header__action" onClick={onMap} aria-label="Map"><Icon name="map" size={17} color={colors.gold} strokeWidth={1.7} /></button>
        <button className="compact-header__action" onClick={onOpenDeck} aria-label="Character, company, abilities, inventory, and codex">
          <Icon name="user" size={16} color={colors.gold} strokeWidth={1.8} />
          {partyCount > 0 && (
            <span className="compact-header__party-count">{partyCount}</span>
          )}
        </button>
      </nav>
    </header>
  );
}
