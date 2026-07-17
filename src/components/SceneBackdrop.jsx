import React from "react";
import { TERRAINS } from "../data/terrains.js";
import { getBiome } from "../data/biomes.js";
import { poiSceneVisual } from "../data/poi-scene-assets.js";
import { biomeVisual, sceneBiomeId, terrainVisual } from "../data/visual-assets.js";
import { currentLocationName, getTile } from "../engine/world.js";
import { useParallaxMotion } from "../hooks/useParallaxMotion.js";

const SCENE_MOTES = [12, 25, 41, 59, 73, 88];

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
  const backdropRef = useParallaxMotion({ strength: 0.72 });
  const cur = state.world.currentTile;
  const tile = getTile(state, cur.x, cur.y);
  const terrain = tile?.terrain || "plains";
  const biome = getBiome(cur.x, cur.y, state.world.seed);
  const visualBiomeId = sceneBiomeId(biome.id, tile);
  const visual = biomeVisual(visualBiomeId);
  const poiScene = poiSceneVisual(tile);
  const terrainTheme = terrainVisual(terrain);
  const phase = phaseForHour(state.time.hour);
  const location = currentLocationName(state);
  const terrainLabel = TERRAINS[terrain]?.label || terrain;
  const sceneImage = poiScene?.image || visual.image;
  const scenePosition = poiScene ? "50% 50%" : (TERRAIN_POSITION[terrain] || "50% 48%");
  const sceneKey = poiScene
    ? `poi-${poiScene.family}-${poiScene.variant}`
    : `biome-${visualBiomeId}`;

  return (
    <div
      ref={backdropRef}
      className={`scene-backdrop scene-backdrop--${phase}`}
      data-terrain={terrain}
      data-scene-family={poiScene?.family || undefined}
      data-scene-variant={poiScene?.variant || undefined}
      data-poi-tier={poiScene?.tierId || undefined}
      aria-label={`${location}, ${terrainLabel}, ${visualBiomeId === "whitemarch" ? "Whitemarch" : biome.name}`}
      style={{
        "--scene-accent": visual.accent,
        "--scene-highlight": visual.secondary,
        "--scene-primary": visual.primary,
        "--scene-deep": visual.deep,
        "--terrain-tint": terrainTheme.tint,
        "--poi-tier-opacity": poiScene?.tier?.opacity ?? 0,
      }}
    >
      <div className="scene-backdrop__layer scene-backdrop__layer--far" key={`far-${sceneKey}-${phase}`}>
        <img src={sceneImage} alt="" draggable="false" style={{ objectPosition: scenePosition }} />
      </div>
      {poiScene?.tier && (
        <div className="scene-backdrop__tier" key={`tier-${poiScene.tierId}-${sceneKey}`}>
          <img src={poiScene.tier.image} alt="" draggable="false" />
        </div>
      )}
      {/* Keep the architectural scene plate singular. The optional tier layer is
          an abstract material-and-light treatment, not duplicated architecture. */}
      <div className="scene-backdrop__terrain" />
      <div className="scene-backdrop__light" />
      <div className="scene-backdrop__motes">
        {SCENE_MOTES.map((left, index) => <span key={left} style={{ left: `${left}%`, animationDelay: `${index * 1.4}s` }} />)}
      </div>
      <div className="scene-backdrop__grain" />
    </div>
  );
}
