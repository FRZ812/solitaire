import React, { useMemo } from "react";
import { CONTINENT, LANDMARKS, REGION_DEFINITIONS } from "../../data/continent.js";
import { WHITEMARCH_CAPITAL } from "../../data/whitemarch-capital.js";
import { sampleContinent } from "../../engine/world-generation.js";
import { getTile } from "../../engine/world.js";

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 520;
const MAP_PADDING = 22;
const SAMPLE_COLUMNS = 48;
const SAMPLE_ROWS = 26;
const SQRT_THREE_OVER_TWO = Math.sqrt(3) / 2;

export const CONTINENT_ATLAS_LANDMARKS = Object.freeze([
  Object.freeze({
    id: WHITEMARCH_CAPITAL.id,
    name: WHITEMARCH_CAPITAL.name,
    knowledge: "reputation",
    kind: "city",
    coord: WHITEMARCH_CAPITAL.center,
  }),
  ...LANDMARKS,
]);

const LANDMARK_GLYPHS = {
  city: "♜",
  fortress: "♜",
  town: "⌂",
  village: "⌂",
  tower: "△",
  temple: "✦",
  shrine: "✦",
  ruin: "⌁",
  lake: "◉",
  mountain: "▲",
  road: "◇",
};

// At continental scale the old basin's landmarks share only a few pixels.
// These cartographic nudges keep every marker operable without changing its
// underlying coordinate or destination.
const MARKER_NUDGES = {
  mirecross: [8, 5],
  "tannic-ford": [-8, -7],
  crowsmoor: [5, -9],
  "halfborn-hold": [10, 9],
  "pale-shrine": [18, 1],
  greenshaw: [-10, 8],
  stonebrook: [2, 10],
  "heron-tower": [12, 2],
};

function projectAxial(x, y) {
  return { x: x + y * 0.5, y: y * SQRT_THREE_OVER_TWO };
}

function unprojectAxial(x, y) {
  const axialY = y / SQRT_THREE_OVER_TWO;
  return { x: x - axialY * 0.5, y: axialY };
}

const projectedCorners = [
  projectAxial(CONTINENT.bounds.xmin, CONTINENT.bounds.ymin),
  projectAxial(CONTINENT.bounds.xmin, CONTINENT.bounds.ymax),
  projectAxial(CONTINENT.bounds.xmax, CONTINENT.bounds.ymin),
  projectAxial(CONTINENT.bounds.xmax, CONTINENT.bounds.ymax),
];

const projectionBounds = {
  xmin: Math.min(...projectedCorners.map((corner) => corner.x)),
  xmax: Math.max(...projectedCorners.map((corner) => corner.x)),
  ymin: Math.min(...projectedCorners.map((corner) => corner.y)),
  ymax: Math.max(...projectedCorners.map((corner) => corner.y)),
};

function mapPoint(x, y) {
  const projected = projectAxial(x, y);
  return {
    x: MAP_PADDING + ((projected.x - projectionBounds.xmin) / (projectionBounds.xmax - projectionBounds.xmin)) * (MAP_WIDTH - MAP_PADDING * 2),
    y: MAP_PADDING + ((projected.y - projectionBounds.ymin) / (projectionBounds.ymax - projectionBounds.ymin)) * (MAP_HEIGHT - MAP_PADDING * 2),
  };
}

function mapPercent(coord) {
  const point = mapPoint(coord.x, coord.y);
  return {
    left: `${Math.max(1, Math.min(99, point.x / MAP_WIDTH * 100))}%`,
    top: `${Math.max(1, Math.min(99, point.y / MAP_HEIGHT * 100))}%`,
  };
}

function buildTerrainCells(seed) {
  const cellWidth = MAP_WIDTH / SAMPLE_COLUMNS;
  const cellHeight = MAP_HEIGHT / SAMPLE_ROWS;
  const projectedWidth = projectionBounds.xmax - projectionBounds.xmin;
  const projectedHeight = projectionBounds.ymax - projectionBounds.ymin;
  const cells = [];

  for (let row = 0; row < SAMPLE_ROWS; row += 1) {
    for (let column = 0; column < SAMPLE_COLUMNS; column += 1) {
      const mapX = (column + 0.5) * cellWidth;
      const mapY = (row + 0.5) * cellHeight;
      const projectedX = projectionBounds.xmin + (mapX / MAP_WIDTH) * projectedWidth;
      const projectedY = projectionBounds.ymin + (mapY / MAP_HEIGHT) * projectedHeight;
      const axial = unprojectAxial(projectedX, projectedY);
      const x = Math.round(axial.x);
      const y = Math.round(axial.y);
      const insideBounds = x >= CONTINENT.bounds.xmin && x <= CONTINENT.bounds.xmax
        && y >= CONTINENT.bounds.ymin && y <= CONTINENT.bounds.ymax;

      if (!insideBounds) {
        cells.push({ column, row, terrain: "water", land: false, coast: false, elevation: 0 });
        continue;
      }

      // Keep only physical survey fields. The generator may calculate a hidden
      // site internally, but it is deliberately neither retained nor rendered.
      const { land, coast, terrain, elevation } = sampleContinent(x, y, seed);
      cells.push({ column, row, land, coast, terrain, elevation });
    }
  }

  return { cells, cellWidth, cellHeight };
}

function terrainClass(cell) {
  if (!cell.land) return "is-sea";
  return [
    "is-land",
    `is-${cell.terrain || "plains"}`,
    cell.coast ? "is-coast" : "",
    cell.elevation > 0.55 ? "is-high" : "",
    cell.elevation < -0.2 ? "is-low" : "",
  ].filter(Boolean).join(" ");
}

function landmarkKnowledge(landmark) {
  return landmark.knowledge === "legend" ? "legend" : "reputation";
}

export function ContinentAtlas({ state, origin, onPick }) {
  const seed = state?.world?.seed || CONTINENT.seed;
  const terrain = useMemo(() => buildTerrainCells(seed), [seed]);
  const regions = Object.values(REGION_DEFINITIONS);

  function pickLandmark(landmark) {
    const { x, y } = landmark.coord;
    onPick({
      x,
      y,
      key: `${x},${y}`,
      tile: getTile(state, x, y),
      name: landmark.name,
      knownBy: landmarkKnowledge(landmark),
    });
  }

  return (
    <section className="continent-atlas" aria-labelledby="continent-atlas-title" aria-describedby="continent-atlas-description continent-atlas-regions">
      <header className="continent-atlas__header">
        <div className="continent-atlas__identity">
          <small>Continental survey · western chart</small>
          <h3 id="continent-atlas-title">{CONTINENT.name}</h3>
        </div>
        <p id="continent-atlas-description">{CONTINENT.description}</p>
        <div className="continent-atlas__scale" aria-label={`${CONTINENT.hexKilometers} kilometers per travel hex`}>
          <i aria-hidden="true" />
          <span>{CONTINENT.hexKilometers} km / hex</span>
        </div>
      </header>

      <p id="continent-atlas-regions" className="continent-atlas__sr-only">
        Named regions: {regions.map((region) => region.label).join(", ")}. Known landmark markers can be used to set the compass.
      </p>

      <div className="continent-atlas__map">
        <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true">
          {terrain.cells.map((cell) => (
            <rect
              key={`${cell.column}:${cell.row}`}
              className={`continent-atlas__cell ${terrainClass(cell)}`}
              x={cell.column * terrain.cellWidth}
              y={cell.row * terrain.cellHeight}
              width={terrain.cellWidth + 0.7}
              height={terrain.cellHeight + 0.7}
            />
          ))}
        </svg>

        <div className="continent-atlas__region-layer" aria-hidden="true">
          {regions.flatMap((region) => region.sites.map((site, siteIndex) => (
            <span
              key={`${region.id}:${siteIndex}`}
              className={`continent-atlas__region-label ${region.id === "far-wild" ? "is-frontier" : ""}`}
              style={mapPercent(site)}
            >
              {region.label}
            </span>
          )))}
        </div>

        <div className="continent-atlas__landmark-layer" role="group" aria-label={`${CONTINENT_ATLAS_LANDMARKS.length} known landmarks`}>
          {CONTINENT_ATLAS_LANDMARKS.map((landmark) => {
            const nudge = MARKER_NUDGES[landmark.id] || [0, 0];
            const knownBy = landmarkKnowledge(landmark);
            return (
              <button
                key={landmark.id}
                type="button"
                className={`continent-atlas__marker is-${knownBy}`}
                style={{ ...mapPercent(landmark.coord), "--marker-x": `${nudge[0]}px`, "--marker-y": `${nudge[1]}px` }}
                onClick={() => pickLandmark(landmark)}
                aria-label={`Set compass for ${landmark.name}, known by ${knownBy}`}
              >
                <span aria-hidden="true">{LANDMARK_GLYPHS[landmark.kind] || "◆"}</span>
                <b aria-hidden="true">{landmark.name}</b>
              </button>
            );
          })}
        </div>

        <div className="continent-atlas__position" style={mapPercent(origin)} role="img" aria-label={`Your current position on ${CONTINENT.name}`}>
          <i aria-hidden="true" />
          <span aria-hidden="true">You</span>
        </div>
      </div>

      <footer className="continent-atlas__legend" aria-label="Map legend">
        <span><i className="is-plains" />Grassland</span>
        <span><i className="is-forest" />Forest</span>
        <span><i className="is-marsh" />Wetland</span>
        <span><i className="is-mountains" />Highlands</span>
        <span><i className="is-landmark" />Known place</span>
        <small>{regions.length} named regions · coast-to-coast terrain generated from your world seed</small>
      </footer>
    </section>
  );
}
