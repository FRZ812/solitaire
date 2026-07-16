import React, { useEffect, useMemo, useRef, useState } from "react";
import * as ContinentData from "../../data/continent.js";
import { WHITEMARCH_CAPITAL } from "../../data/whitemarch-capital.js";
import { sampleContinent } from "../../engine/world-generation.js";
import { getTile, hexDistance } from "../../engine/world.js";
import atlasSpreadArt from "../../assets/generated/world-atlas-spread-v1.jpg";

const {
  COASTAL_FEATURES,
  CONTINENT,
  CONTINENT_ROUTES,
  CONTINENT_SEA_LANES = [],
  LANDMARKS,
  PROVINCES = [],
  PROVINCE_BY_ID = {},
  REALM_CULTURES = [],
  REALM_ECONOMIES = [],
  REALM_FACTIONS = [],
  REALMS,
  REGION_DEFINITIONS,
} = ContinentData;

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 520;
const MAP_PADDING = 22;
const MAP_ZOOM_MIN = 1;
const MAP_ZOOM_MAX = 2.5;
const MAP_ZOOM_STEP = 0.25;
const SAMPLE_COLUMNS = 48;
const SAMPLE_ROWS = 26;
const SQRT_THREE_OVER_TWO = Math.sqrt(3) / 2;
const CENTRAL_REALM = REALMS.find((realm) => realm.id === "central") || REALMS[0];
const REALM_BY_ID = Object.fromEntries(REALMS.map((realm) => [realm.id, realm]));
const CHARTED_SEAS = COASTAL_FEATURES.filter((feature) => feature.kind === "sea");
const CHARTED_PORTS = LANDMARKS.filter((landmark) => landmark.kind === "port");
const CULTURE_BY_REALM_ID = Object.fromEntries(REALM_CULTURES.map((culture) => [culture.realmId, culture]));
const ECONOMY_BY_REALM_ID = Object.fromEntries(REALM_ECONOMIES.map((economy) => [economy.realmId, economy]));
const FACTION_BY_ID = Object.fromEntries(REALM_FACTIONS.map((faction) => [faction.id, faction]));

export const CONTINENT_ATLAS_LANDMARKS = Object.freeze([
  Object.freeze({
    id: WHITEMARCH_CAPITAL.id,
    name: WHITEMARCH_CAPITAL.name,
    knowledge: "reputation",
    kind: "city",
    coord: WHITEMARCH_CAPITAL.center,
    regionId: "whitemarch",
    realmId: "central",
    capitalOfRealmId: "central",
    description: CENTRAL_REALM?.description || "The walled capital at Avarra's inland crossroads.",
  }),
  ...LANDMARKS,
]);

const LANDMARK_GLYPHS = {
  city: "♜",
  fortress: "♜",
  fort: "♜",
  castle: "♜",
  checkpoint: "▣",
  town: "⌂",
  village: "⌂",
  tower: "△",
  temple: "✦",
  shrine: "✦",
  sanctuary: "✦",
  monastery: "✦",
  ruin: "⌁",
  wonder: "✧",
  landmark: "◆",
  lake: "◉",
  mountain: "▲",
  port: "⚓",
  road: "◇",
};

const LANDMARK_KIND_LABELS = Object.freeze({
  city: "City",
  fortress: "Fortress",
  fort: "Fort",
  castle: "Castle",
  checkpoint: "Military checkpoint",
  town: "Town",
  village: "Village",
  settlement: "Settlement",
  temple: "Temple",
  shrine: "Shrine",
  sanctuary: "Sanctuary",
  monastery: "Monastery",
  ruin: "Ruin",
  landmark: "Landmark",
  tower: "Tower",
  bridge: "Bridge",
  lake: "Lake",
  river: "River crossing",
  mountain: "Mountain",
  port: "Port",
  road: "Road waypoint",
});

export const CONTINENT_ATLAS_LAYERS = Object.freeze([
  Object.freeze({ id: "capitals", label: "Capitals", glyph: "♜" }),
  Object.freeze({ id: "settlements", label: "Towns", glyph: "⌂" }),
  Object.freeze({ id: "ports", label: "Ports", glyph: "⚓" }),
  Object.freeze({ id: "strongholds", label: "Forts", glyph: "▣" }),
  Object.freeze({ id: "sanctuaries", label: "Shrines", glyph: "✦" }),
  Object.freeze({ id: "lore", label: "Lore", glyph: "⌁" }),
]);

export function atlasLandmarkLayer(landmark) {
  if (landmark.capitalOfRealmId) return "capitals";
  if (landmark.kind === "port") return "ports";
  if (landmark.role === "border-checkpoint" || ["fortress", "fort", "castle", "checkpoint"].includes(landmark.kind)) return "strongholds";
  if (["city", "town", "village", "settlement"].includes(landmark.kind)) return "settlements";
  if (["temple", "shrine", "sanctuary", "monastery"].includes(landmark.kind)) return "sanctuaries";
  return "lore";
}

export function atlasLandmarkTypeLabel(landmark) {
  if (!landmark) return "Unknown place";
  if (landmark.role === "border-checkpoint") return "Guarded border checkpoint";
  if (landmark.capitalOfRealmId) return "Realm capital";
  return LANDMARK_KIND_LABELS[landmark.kind] || "Point of interest";
}

function isMajorLandmark(landmark) {
  const layer = atlasLandmarkLayer(landmark);
  return layer === "capitals" || layer === "ports" || landmark.role === "border-checkpoint";
}

export function atlasLandmarkIsVisible(landmark, {
  expanded,
  focusedRealmId,
  selectedLandmarkId,
  visibleLayers,
}) {
  const layer = atlasLandmarkLayer(landmark);
  if (!visibleLayers.has(layer)) return false;
  if (!expanded) return isMajorLandmark(landmark);
  if (focusedRealmId && landmark.realmId !== focusedRealmId) {
    return isMajorLandmark(landmark) || landmark.id === selectedLandmarkId;
  }
  return true;
}

export function atlasRouteEmphasis(route, focusedRealmId) {
  if (!focusedRealmId) return "";
  return route.realmIds?.includes(focusedRealmId) ? "is-focused" : "is-muted";
}

export function clampAtlasZoom(value) {
  return Math.max(MAP_ZOOM_MIN, Math.min(MAP_ZOOM_MAX, value));
}

function compactList(value, limit = 3) {
  const items = Array.isArray(value) ? value : (value ? [value] : []);
  if (!items.length) return null;
  const shown = items.slice(0, limit).map((item) => (
    typeof item === "string" ? item : item?.name || item?.label || String(item)
  ));
  return `${shown.join(", ")}${items.length > limit ? ` +${items.length - limit}` : ""}`;
}

export function atlasRoutesForLandmark(landmark) {
  const declaredRouteIds = new Set(landmark.routeIds || []);
  return CONTINENT_ROUTES.filter((route) => (
    declaredRouteIds.has(route.id)
    || route.checkpointIds?.includes(landmark.id)
    || route.waypoints?.some((waypoint) => (
      waypoint.x === landmark.coord.x && waypoint.y === landmark.coord.y
    ))
  ));
}

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

function routePoints(route) {
  return route.waypoints
    .map((waypoint) => {
      const point = mapPoint(waypoint.x, waypoint.y);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");
}

function coastlinePoints() {
  return CONTINENT.coastline
    .map((coord) => {
      const point = mapPoint(coord.x, coord.y);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");
}

function realmFootprintStyle(realm) {
  const center = mapPoint(realm.center.x, realm.center.y);
  const horizontal = mapPoint(realm.center.x + realm.influence.scaleX, realm.center.y);
  const vertical = mapPoint(realm.center.x, realm.center.y + realm.influence.scaleY);
  return {
    left: `${center.x / MAP_WIDTH * 100}%`,
    top: `${center.y / MAP_HEIGHT * 100}%`,
    "--realm-width": `${Math.max(14, Math.abs(horizontal.x - center.x) * 2 / MAP_WIDTH * 100)}%`,
    "--realm-height": `${Math.max(18, Math.abs(vertical.y - center.y) * 2 / MAP_HEIGHT * 100)}%`,
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
  const [expanded, setExpanded] = useState(false);
  const [mapZoom, setMapZoom] = useState(MAP_ZOOM_MIN);
  const [focusedRealmId, setFocusedRealmId] = useState(null);
  const [visibleLayers, setVisibleLayers] = useState(() => new Set(CONTINENT_ATLAS_LAYERS.map((layer) => layer.id)));
  const [selectedLandmarkId, setSelectedLandmarkId] = useState(WHITEMARCH_CAPITAL.id);
  const mapViewportRef = useRef(null);
  const selectedLandmark = CONTINENT_ATLAS_LANDMARKS.find((landmark) => landmark.id === selectedLandmarkId)
    || CONTINENT_ATLAS_LANDMARKS[0];
  const selectedRealm = REALM_BY_ID[selectedLandmark?.realmId] || CENTRAL_REALM;
  const selectedRegion = REGION_DEFINITIONS[selectedLandmark?.regionId];
  const selectedDistance = selectedLandmark?.coord && origin
    ? hexDistance(origin, selectedLandmark.coord)
    : null;
  const selectedProvince = (selectedLandmark?.provinceId && PROVINCE_BY_ID[selectedLandmark.provinceId])
    || PROVINCES.find((province) => province.seatLandmarkId === selectedLandmark?.id)
    || null;
  const selectedFactionId = selectedLandmark?.factionId
    || selectedLandmark?.controllingFactionId
    || selectedProvince?.authorityFactionId
    || selectedRealm?.faction?.id;
  const selectedFaction = FACTION_BY_ID[selectedFactionId]
    || REALM_FACTIONS.find((faction) => faction.realmId === selectedRealm?.id && faction.seatLandmarkId === selectedLandmark?.id)
    || null;
  const selectedCulture = CULTURE_BY_REALM_ID[selectedRealm?.id] || null;
  const selectedEconomy = ECONOMY_BY_REALM_ID[selectedRealm?.id] || null;
  const selectedRoutes = selectedLandmark ? atlasRoutesForLandmark(selectedLandmark) : [];
  const selectedSeaLanes = selectedLandmark?.kind === "port"
    ? CONTINENT_SEA_LANES.filter((lane) => lane.portIds?.includes(selectedLandmark.id))
    : [];
  const selectedLeader = selectedFaction?.leader || selectedProvince?.governor || selectedRealm?.ruler;
  const selectedLandmarkType = atlasLandmarkTypeLabel(selectedLandmark);
  const selectedAreaName = selectedProvince?.name || selectedRegion?.label || selectedRealm?.shortName || "Uncharted lands";
  const cultureSummary = selectedCulture
    ? [selectedCulture.demonym, compactList(selectedCulture.languages, 2)].filter(Boolean).join(" · ")
    : selectedRealm?.biomeName;
  const tradeSummary = compactList(selectedEconomy?.exports)
    || selectedEconomy?.tradeNotes
    || compactList(selectedRegion?.features);
  const resourceSummary = compactList(selectedProvince?.resources || selectedEconomy?.resources);
  const routeSummary = compactList(selectedRoutes.map((route) => route.name), 4) || "No charted road";
  const seaLaneSummary = compactList(selectedSeaLanes.map((lane) => lane.name), 3);

  useEffect(() => {
    const viewport = mapViewportRef.current;
    if (!expanded || !viewport || viewport.scrollWidth <= viewport.clientWidth) return;
    const realm = focusedRealmId ? REALM_BY_ID[focusedRealmId] : null;
    const focusRatio = realm ? mapPoint(realm.center.x, realm.center.y).x / MAP_WIDTH : 0.5;
    const target = viewport.scrollWidth * focusRatio - viewport.clientWidth / 2;
    viewport.scrollLeft = Math.max(0, Math.min(viewport.scrollWidth - viewport.clientWidth, target));
  }, [expanded, focusedRealmId]);

  function chartLandmark(landmark) {
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

  function inspectLandmark(landmark) {
    // Marker inspection is deliberately selection-only. Realm focus owns map
    // filtering and recentering, so coupling it to a POI tap makes the map jump.
    setSelectedLandmarkId(landmark.id);
  }

  function inspectRealm(realm) {
    const capital = CONTINENT_ATLAS_LANDMARKS.find((landmark) => (
      landmark.capitalOfRealmId === realm.id || landmark.id === realm.capital.id
    ));
    if (capital) setSelectedLandmarkId(capital.id);
    setFocusedRealmId(realm.id);
  }

  function changeMapZoom(nextValue) {
    const nextZoom = clampAtlasZoom(nextValue);
    if (nextZoom === mapZoom) return;
    const viewport = mapViewportRef.current;
    const horizontalRatio = viewport?.scrollWidth
      ? (viewport.scrollLeft + viewport.clientWidth / 2) / viewport.scrollWidth
      : 0.5;
    const verticalRatio = viewport?.scrollHeight
      ? (viewport.scrollTop + viewport.clientHeight / 2) / viewport.scrollHeight
      : 0.5;
    setMapZoom(nextZoom);
    if (!viewport || typeof window === "undefined") return;
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      viewport.scrollLeft = horizontalRatio * viewport.scrollWidth - viewport.clientWidth / 2;
      viewport.scrollTop = verticalRatio * viewport.scrollHeight - viewport.clientHeight / 2;
    }));
  }

  function toggleExpanded() {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);
    if (!nextExpanded) {
      setMapZoom(MAP_ZOOM_MIN);
      if (mapViewportRef.current) {
        mapViewportRef.current.scrollLeft = 0;
        mapViewportRef.current.scrollTop = 0;
      }
    }
  }

  function handleMapWheel(event) {
    if (!expanded || event.deltaY === 0) return;
    event.preventDefault();
    changeMapZoom(mapZoom + (event.deltaY < 0 ? MAP_ZOOM_STEP : -MAP_ZOOM_STEP));
  }

  function handleMapKeyDown(event) {
    if (!expanded) return;
    if (["+", "="].includes(event.key)) {
      event.preventDefault();
      changeMapZoom(mapZoom + MAP_ZOOM_STEP);
    } else if (event.key === "-") {
      event.preventDefault();
      changeMapZoom(mapZoom - MAP_ZOOM_STEP);
    } else if (event.key === "0") {
      event.preventDefault();
      changeMapZoom(MAP_ZOOM_MIN);
    }
  }

  function toggleLayer(layerId) {
    setVisibleLayers((current) => {
      const next = new Set(current);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  }

  return (
    <section className={`continent-atlas ${expanded ? "is-expanded" : ""}`} aria-labelledby="continent-atlas-title" aria-describedby="continent-atlas-description continent-atlas-regions">
      <header className="continent-atlas__header">
        <div className="continent-atlas__identity">
          <small>Continental survey · five realms</small>
          <h3 id="continent-atlas-title">{CONTINENT.name}</h3>
        </div>
        <p id="continent-atlas-description">{CONTINENT.description}</p>
        <div className="continent-atlas__scale" aria-label={`${CONTINENT.hexKilometers} kilometers per travel hex`}>
          <i aria-hidden="true" />
          <span>{CONTINENT.hexKilometers} km / hex</span>
        </div>
      </header>

      <nav className="continent-atlas__realm-tabs" aria-label="Five biome realms">
        {REALMS.map((realm) => (
          <button
            key={realm.id}
            type="button"
            className={`is-${realm.id}`}
            aria-pressed={focusedRealmId === realm.id}
            onClick={() => inspectRealm(realm)}
          >
            <i aria-hidden="true" />
            <span><small>{realm.direction}</small><b>{realm.shortName}</b></span>
          </button>
        ))}
      </nav>

      <div className="continent-atlas__layer-controls" role="group" aria-label="Atlas marker layers">
        <button type="button" className="is-all-realms" aria-pressed={!focusedRealmId} onClick={() => setFocusedRealmId(null)}>
          <i aria-hidden="true">◎</i><span>All lands</span>
        </button>
        {CONTINENT_ATLAS_LAYERS.map((layer) => (
          <button key={layer.id} type="button" aria-pressed={visibleLayers.has(layer.id)} onClick={() => toggleLayer(layer.id)}>
            <i aria-hidden="true">{layer.glyph}</i><span>{layer.label}</span>
          </button>
        ))}
      </div>

      <p id="continent-atlas-regions" className="continent-atlas__sr-only">
        Five biome realms: {REALMS.map((realm) => `${realm.name}, ${realm.biomeName}`).join("; ")}. Named local regions: {regions.map((region) => region.label).join(", ")}. Inspect a known landmark for details, then set it on the compass.
        Charted waters: {COASTAL_FEATURES.map((feature) => feature.name).join(", ")}.
      </p>

      <div className="continent-atlas__map-shell">
        <div className="continent-atlas__selection-status" role="status" aria-live="polite" aria-label={`Selected ${selectedLandmark.name}, ${selectedLandmarkType}, ${selectedAreaName}`}>
          <i aria-hidden="true">{LANDMARK_GLYPHS[selectedLandmark.kind] || "◆"}</i>
          <span><small>Selected · {selectedLandmarkType} · {selectedAreaName}</small><strong>{selectedLandmark.name}</strong></span>
        </div>
        <div className="continent-atlas__map-controls">
          <button
            type="button"
            className="continent-atlas__canvas-toggle"
            aria-controls="continent-atlas-world-map"
            aria-expanded={expanded}
            onClick={toggleExpanded}
          >
            <span>{expanded ? "Collapse world view" : "Expand world view"}</span>
          </button>
          {expanded && (
            <div className="continent-atlas__zoom-controls" role="group" aria-label="Map zoom controls">
              <button type="button" onClick={() => changeMapZoom(mapZoom - MAP_ZOOM_STEP)} disabled={mapZoom <= MAP_ZOOM_MIN} aria-label="Zoom map out">−</button>
              <button type="button" onClick={() => changeMapZoom(MAP_ZOOM_MIN)} disabled={mapZoom === MAP_ZOOM_MIN} aria-label="Reset map zoom">{Math.round(mapZoom * 100)}%</button>
              <button type="button" onClick={() => changeMapZoom(mapZoom + MAP_ZOOM_STEP)} disabled={mapZoom >= MAP_ZOOM_MAX} aria-label="Zoom map in">+</button>
            </div>
          )}
        </div>
        <div
          ref={mapViewportRef}
          className="continent-atlas__map-viewport"
          role="region"
          aria-label={expanded ? `Expanded world map at ${Math.round(mapZoom * 100)} percent; scroll or drag to pan` : "Compact world map"}
          tabIndex={expanded ? 0 : undefined}
          onWheel={handleMapWheel}
          onKeyDown={handleMapKeyDown}
        >
          <div
            id="continent-atlas-world-map"
            className="continent-atlas__map"
            style={{
              "--atlas-spread": `url(${atlasSpreadArt})`,
              "--atlas-zoom-width": `${mapZoom * 100}%`,
              "--atlas-mobile-zoom-width": `${720 * mapZoom}px`,
            }}
          >
        <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} preserveAspectRatio="none" shapeRendering="geometricPrecision" aria-hidden="true">
          <defs>
            <clipPath id="continent-atlas-land-clip">
              <polygon points={coastlinePoints()} />
            </clipPath>
          </defs>
          <polygon className="continent-atlas__coastline" points={coastlinePoints()} />
          <g clipPath="url(#continent-atlas-land-clip)">
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
          </g>
          <g className="continent-atlas__sea-lane-layer">
            {CONTINENT_SEA_LANES.map((lane) => (
              <polyline
                key={lane.id}
                className={[
                  "continent-atlas__sea-lane",
                  atlasRouteEmphasis(lane, focusedRealmId),
                ].filter(Boolean).join(" ")}
                points={routePoints(lane)}
              >
                <title>{lane.name}</title>
              </polyline>
            ))}
          </g>
          <g className="continent-atlas__route-layer">
            {CONTINENT_ROUTES.map((route) => (
              <polyline
                key={route.id}
                className={[
                  "continent-atlas__route",
                  atlasRouteEmphasis(route, focusedRealmId),
                ].filter(Boolean).join(" ")}
                points={routePoints(route)}
              >
                <title>{route.name}</title>
              </polyline>
            ))}
          </g>
        </svg>

        <div className="continent-atlas__realm-layer" aria-hidden="true">
          {REALMS.map((realm) => (
            <span key={realm.id} className={`continent-atlas__realm is-${realm.id} ${focusedRealmId ? (focusedRealmId === realm.id ? "is-focused" : "is-muted") : ""}`} style={realmFootprintStyle(realm)}>
              <b>{realm.shortName}</b>
              <small>{realm.biomeName}</small>
            </span>
          ))}
        </div>

        <div className="continent-atlas__water-layer" aria-hidden="true">
          {COASTAL_FEATURES.map((feature) => (
            <span
              key={feature.id}
              className={`continent-atlas__water-label is-${feature.kind} is-${feature.edge} ${focusedRealmId && feature.realmId !== focusedRealmId ? "is-muted" : ""}`}
              style={mapPercent(feature.coord)}
            >
              {feature.name}
            </span>
          ))}
        </div>

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
            const selected = landmark.id === selectedLandmark?.id;
            const layer = atlasLandmarkLayer(landmark);
            const major = isMajorLandmark(landmark);
            const outsideRealmFocus = focusedRealmId && landmark.realmId !== focusedRealmId;
            const hidden = !atlasLandmarkIsVisible(landmark, {
              expanded,
              focusedRealmId,
              selectedLandmarkId: selectedLandmark?.id,
              visibleLayers,
            });
            return (
              <button
                key={landmark.id}
                type="button"
                hidden={hidden}
                className={`continent-atlas__marker is-${knownBy} is-category-${layer} ${selected ? "is-selected" : ""} ${major ? "is-major" : ""} ${outsideRealmFocus ? "is-realm-muted" : ""} ${landmark.capitalOfRealmId ? "is-capital" : ""} ${landmark.kind === "port" ? "is-port" : ""} ${landmark.role === "border-checkpoint" ? "is-checkpoint" : ""}`}
                style={{ ...mapPercent(landmark.coord), "--marker-x": `${nudge[0]}px`, "--marker-y": `${nudge[1]}px` }}
                onClick={() => inspectLandmark(landmark)}
                aria-label={`Inspect ${landmark.name}, ${atlasLandmarkTypeLabel(landmark)}, ${REGION_DEFINITIONS[landmark.regionId]?.label || REALM_BY_ID[landmark.realmId]?.shortName || "uncharted lands"}, known by ${knownBy}`}
                aria-controls="continent-atlas-place-detail"
                aria-pressed={selected}
              >
                <span aria-hidden="true">{LANDMARK_GLYPHS[landmark.kind] || "◆"}</span>
                <b aria-hidden="true"><span>{landmark.name}</span><small>{atlasLandmarkTypeLabel(landmark)} · {REGION_DEFINITIONS[landmark.regionId]?.label || REALM_BY_ID[landmark.realmId]?.shortName}</small></b>
              </button>
            );
          })}
        </div>

        <div className="continent-atlas__position" style={mapPercent(origin)} role="img" aria-label={`Your current position on ${CONTINENT.name}`}>
          <i aria-hidden="true" />
          <span aria-hidden="true">You</span>
        </div>
          </div>
        </div>
      </div>

      {selectedLandmark && (
        <aside id="continent-atlas-place-detail" className="continent-atlas__detail" aria-live="polite" aria-label={`Atlas entry for ${selectedLandmark.name}`}>
          <div className="continent-atlas__detail-copy">
            <small>
              {selectedLandmarkType}
              {selectedProvince ? ` · ${selectedProvince.name}` : selectedRegion ? ` · ${selectedRegion.label}` : ""}
            </small>
            <h4>{selectedLandmark.name}</h4>
            <p>{selectedLandmark.description || selectedRealm?.description}</p>
          </div>
          <dl>
            <div><dt>Site type</dt><dd>{selectedLandmarkType}</dd></div>
            <div><dt>Province</dt><dd title={selectedProvince?.description}>{selectedProvince?.name || selectedRegion?.label || "Uncharted province"}</dd></div>
            <div><dt>Realm</dt><dd>{selectedRealm?.name || "Unclaimed frontier"}</dd></div>
            <div><dt>Authority</dt><dd title={selectedFaction?.description}>{selectedFaction?.name || selectedRealm?.faction?.name || selectedLandmark.controllingFactionId || "Independent"}</dd></div>
            <div><dt>Leader</dt><dd>{selectedLeader ? `${selectedLeader.name}${selectedLeader.title ? ` · ${selectedLeader.title}` : ""}` : "No single ruler"}</dd></div>
            <div><dt>Culture</dt><dd title={selectedCulture?.description}>{cultureSummary || "Mixed frontier traditions"}</dd></div>
            <div><dt>Trade</dt><dd title={selectedEconomy?.tradeNotes}>{tradeSummary || "Local exchange"}</dd></div>
            <div><dt>Resources</dt><dd>{resourceSummary || "Survey incomplete"}</dd></div>
            {selectedLandmark.garrison && <div><dt>Garrison</dt><dd>{selectedLandmark.garrison}</dd></div>}
            <div className="is-wide"><dt>Connected routes</dt><dd title={selectedRoutes.map((route) => route.name).join(", ")}>{routeSummary}</dd></div>
            {seaLaneSummary && <div className="is-wide"><dt>Sea passages</dt><dd title={selectedSeaLanes.map((lane) => lane.description).join(" ")}>{seaLaneSummary}</dd></div>}
          </dl>
          <button type="button" className="continent-atlas__chart" onClick={() => chartLandmark(selectedLandmark)}>
            <span>Set compass</span>
            <small>{selectedDistance === null ? "Known destination" : `${selectedDistance} travel hex${selectedDistance === 1 ? "" : "es"}`}</small>
          </button>
        </aside>
      )}

      <footer className="continent-atlas__legend" aria-label="Map legend">
        <span><i className="is-road" />Great road</span>
        <span><i className="is-sea-lane" />Sea passage</span>
        <span><i className="is-landmark" />Major place</span>
        <small>{REALMS.length} biome realms · {PROVINCES.length} provinces · {regions.length} named regions · {CHARTED_SEAS.length} named seas · {CHARTED_PORTS.length} charted ports · {CONTINENT_SEA_LANES.length} sea lanes · one coast-to-coast world map</small>
      </footer>
    </section>
  );
}
