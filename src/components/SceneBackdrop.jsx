import React from "react";
import { TERRAINS } from "../data/terrains.js";
import { getBiome } from "../data/biomes.js";
import { biomeVisual, sceneBiomeId, terrainVisual } from "../data/visual-assets.js";
import { currentLocationName, getTile } from "../engine/world.js";
import { currentNode, standingNodeTile } from "../engine/place.js";

function phaseForHour(hour) {
  if (hour < 5 || hour >= 21) return "night";
  if (hour < 8) return "dawn";
  if (hour >= 17 && hour < 21) return "dusk";
  return "day";
}

const TERRAIN_POSITION = {
  indoor: "50% 72%",
  street: "50% 66%",
  wall: "50% 24%",
  settlement: "50% 56%",
  water: "65% 45%",
  marsh: "50% 48%",
  forest: "50% 42%",
  mountains: "50% 32%",
};

export function SceneBackdrop({ state }) {
  const cur = state.world.currentTile;
  const tile = standingNodeTile(state) || getTile(state, cur.x, cur.y);
  const node = currentNode(state);
  const terrain = tile?.terrain || "plains";
  const biome = getBiome(cur.x, cur.y);
  const visualBiomeId = sceneBiomeId(biome.id, tile);
  const visual = biomeVisual(visualBiomeId);
  const terrainTheme = terrainVisual(terrain);
  const phase = phaseForHour(state.time.hour);
  const location = currentLocationName(state);
  const terrainLabel = TERRAINS[terrain]?.label || terrain;

  return (
    <div
      className={`scene-backdrop scene-backdrop--${phase}`}
      data-terrain={terrain}
      data-node={node?.id || undefined}
      aria-label={`${location}, ${terrainLabel}, ${visualBiomeId === "whitemarch" ? "Whitemarch" : biome.name}`}
      style={{
        "--scene-accent": visual.accent,
        "--scene-highlight": visual.secondary,
        "--scene-primary": visual.primary,
        "--scene-deep": visual.deep,
        "--terrain-tint": terrainTheme.tint,
      }}
    >
      <img src={visual.image} alt="" draggable="false" style={{ objectPosition: TERRAIN_POSITION[terrain] || "50% 48%" }} />
      <div className="scene-backdrop__terrain" />
      <div className="scene-backdrop__light" />
      <div className="scene-backdrop__grain" />
    </div>
  );
}
