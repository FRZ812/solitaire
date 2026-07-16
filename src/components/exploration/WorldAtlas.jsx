import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  COASTAL_FEATURES,
  CONTINENT,
  CONTINENT_LAKES,
  CONTINENT_ROUTES,
  CONTINENT_SEA_LANES,
  CONTINENT_WATERWAYS,
  PROVINCES,
  PROVINCE_BY_ID,
  REALM_CULTURES,
  REALM_ECONOMIES,
  REALM_FACTIONS,
  REALMS,
  REGION_DEFINITIONS,
} from "../../data/continent.js";
import { surveyAtlas } from "../../engine/world-generation.js";
import { getTile } from "../../engine/world.js";
import { TERRAINS } from "../../data/terrains.js";
import { TERRAIN_INK } from "./atlasModel.js";
import {
  ATLAS_KNOWLEDGE_LABELS,
  ATLAS_LANDMARK_GLYPHS,
  ATLAS_LAYERS,
  ATLAS_MAX_ZOOM,
  atlasFitZoom,
  atlasLandmarkLayer,
  atlasLandmarkTypeLabel,
  atlasMarkerVisible,
  atlasQuestMarkers,
  atlasRoutesForLandmark,
  atlasScreenToWorld,
  atlasWorldToScreen,
  axialRound,
  buildAtlasLandmarks,
  centerAtlasCamera,
  clampAtlasCamera,
  landmarkKnowledge,
  panAtlasCamera,
  summarizeAtlasJourney,
  zoomAtlasCamera,
} from "./worldAtlasModel.js";

export {
  atlasLandmarkLayer,
  atlasLandmarkTypeLabel,
  atlasMarkerVisible,
  atlasRoutesForLandmark,
} from "./worldAtlasModel.js";

const REALM_BY_ID = Object.fromEntries(REALMS.map((realm) => [realm.id, realm]));
const CULTURE_BY_REALM_ID = Object.fromEntries(REALM_CULTURES.map((culture) => [culture.realmId, culture]));
const ECONOMY_BY_REALM_ID = Object.fromEntries(REALM_ECONOMIES.map((economy) => [economy.realmId, economy]));
const FACTION_BY_ID = Object.fromEntries(REALM_FACTIONS.map((faction) => [faction.id, faction]));

// Raster palette: land terrain from the shared ink map, plus sea/coast tones.
const SEA_INK = "#173d56";
const SEA_DEEP_INK = "#10293f";
const COAST_INK = "#3f7d86";

const SAMPLE_CACHE = new Map();
const SAMPLE_CACHE_LIMIT = 300000;

function cachedSurvey(x, y, seed) {
  const key = `${seed}|${x},${y}`;
  let sample = SAMPLE_CACHE.get(key);
  if (!sample) {
    const survey = surveyAtlas(x, y, seed);
    sample = {
      land: survey.land,
      coast: survey.coast,
      terrain: survey.terrain,
      elevation: survey.elevation,
    };
    if (SAMPLE_CACHE.size >= SAMPLE_CACHE_LIMIT) SAMPLE_CACHE.clear();
    SAMPLE_CACHE.set(key, sample);
  }
  return sample;
}

function shade(hex, amount) {
  const value = parseInt(hex.slice(1), 16);
  const channel = (offset) => {
    const base = (value >> offset) & 255;
    return Math.max(0, Math.min(255, Math.round(base * (1 + amount))));
  };
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

function cellColor(sample) {
  if (!sample.land) return sample.elevation > 0.55 ? SEA_INK : SEA_DEEP_INK;
  const base = TERRAIN_INK[sample.terrain] || TERRAIN_INK.plains;
  const relief = (sample.elevation - 0.45) * 0.5;
  if (sample.coast && sample.terrain !== "road") return shade(COAST_INK, relief * 0.4);
  return shade(base, relief);
}

// Sample step in whole hexes, chosen so painted cells stay chunky enough to
// keep a full repaint around ~15k survey samples.
function rasterStep(zoom) {
  let step = 1;
  while (step < 16 && step * zoom < 6) step *= 2;
  return step;
}

function thinPath(path, maxPoints = 240) {
  if (!path || path.length <= maxPoints) return path || [];
  const stride = Math.ceil(path.length / maxPoints);
  const out = [];
  for (let index = 0; index < path.length; index += stride) out.push(path[index]);
  if (out[out.length - 1] !== path[path.length - 1]) out.push(path[path.length - 1]);
  return out;
}

function compactList(value, limit = 3) {
  const items = Array.isArray(value) ? value : (value ? [value] : []);
  if (!items.length) return null;
  const shown = items.slice(0, limit).map((item) => (
    typeof item === "string" ? item : item?.name || item?.label || String(item)
  ));
  return `${shown.join(", ")}${items.length > limit ? ` +${items.length - limit}` : ""}`;
}

function svgPoints(camera, viewport, waypoints) {
  return waypoints
    .map((point) => {
      const screen = atlasWorldToScreen(camera, viewport, point);
      return `${screen.x.toFixed(1)},${screen.y.toFixed(1)}`;
    })
    .join(" ");
}

// ---- Raster painter ----
//
// Paints the physical survey into an offscreen canvas in time-budgeted chunks,
// compositing after each chunk so panning never blocks the main thread. The
// party's remembered trail (seen tiles) is drawn over the finished raster.
function paintAtlas({ canvas, camera, viewport, seed, seenKeys, token }) {
  const ratio = typeof window !== "undefined"
    ? Math.max(1, Math.min(2, window.devicePixelRatio || 1))
    : 1;
  canvas.width = Math.max(1, Math.round(viewport.width * ratio));
  canvas.height = Math.max(1, Math.round(viewport.height * ratio));
  const context = canvas.getContext("2d", { alpha: false });
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  const step = rasterStep(camera.zoom);
  const cellPx = step * camera.zoom;
  const columns = Math.ceil(viewport.width / cellPx) + 1;
  const rows = Math.ceil(viewport.height / cellPx) + 1;

  context.fillStyle = SEA_DEEP_INK;
  context.fillRect(0, 0, viewport.width, viewport.height);

  let row = 0;
  const paintChunk = () => {
    if (token.cancelled) return;
    const start = typeof performance !== "undefined" ? performance.now() : Date.now();
    while (row < rows) {
      for (let column = 0; column < columns; column++) {
        const px = column * cellPx + cellPx / 2;
        const py = row * cellPx + cellPx / 2;
        const fractional = atlasScreenToWorld(camera, viewport, { x: px, y: py });
        const coord = axialRound(fractional.x, fractional.y);
        const sample = cachedSurvey(coord.x, coord.y, seed);
        context.fillStyle = cellColor(sample);
        context.fillRect(column * cellPx, row * cellPx, cellPx + 0.5, cellPx + 0.5);
      }
      row += 1;
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (now - start > 9) break;
    }
    if (row < rows) {
      token.frame = requestAnimationFrame(paintChunk);
      return;
    }
    // Remembered trail: a faint amber dust over every hex the party has seen.
    context.fillStyle = "rgba(255, 224, 138, .30)";
    const dot = Math.max(1.2, camera.zoom * 0.24);
    for (const key of seenKeys) {
      const comma = key.indexOf(",");
      const x = Number(key.slice(0, comma));
      const y = Number(key.slice(comma + 1));
      const screen = atlasWorldToScreen(camera, viewport, { x, y });
      if (screen.x < -4 || screen.y < -4 || screen.x > viewport.width + 4 || screen.y > viewport.height + 4) continue;
      context.fillRect(screen.x - dot / 2, screen.y - dot / 2, dot, dot);
    }
    // Soft vignette keeps the chart readable against the folio.
    const vignette = context.createRadialGradient(
      viewport.width / 2, viewport.height / 2, Math.min(viewport.width, viewport.height) * 0.42,
      viewport.width / 2, viewport.height / 2, Math.max(viewport.width, viewport.height) * 0.78,
    );
    vignette.addColorStop(0, "rgba(2, 10, 22, 0)");
    vignette.addColorStop(1, "rgba(2, 10, 22, .5)");
    context.fillStyle = vignette;
    context.fillRect(0, 0, viewport.width, viewport.height);
  };
  paintChunk();
}

export function WorldAtlas({ state, origin, onPick }) {
  const seed = state?.world?.seed || CONTINENT.seed;
  const partyCoord = origin || state?.world?.currentTile || CONTINENT.start.coord;
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const gestureRef = useRef({ pointers: new Map(), moved: false, pinchDistance: 0 });
  const [viewport, setViewport] = useState({ width: 960, height: 540 });
  const [camera, setCamera] = useState(() => clampAtlasCamera(
    centerAtlasCamera({ x: 0, y: 0, zoom: 2.4 }, { width: 960, height: 540 }, partyCoord, 2.4),
    { width: 960, height: 540 },
  ));
  const [visibleLayers, setVisibleLayers] = useState(() => new Set(ATLAS_LAYERS.map((layer) => layer.id)));
  const [focusedRealmId, setFocusedRealmId] = useState(null);
  const [selection, setSelection] = useState({ kind: "landmark", id: "whitemarch" });

  const fit = atlasFitZoom(viewport);
  const zoomRatio = camera.zoom / fit;
  const landmarks = useMemo(() => buildAtlasLandmarks(state, partyCoord), [state, partyCoord]);
  const questMarkers = useMemo(() => atlasQuestMarkers(state), [state]);

  const selectedLandmark = selection.kind === "landmark"
    ? landmarks.find((landmark) => landmark.id === selection.id) || null
    : null;
  const selectedCoord = selection.kind === "landmark"
    ? selectedLandmark?.coord || null
    : { x: selection.x, y: selection.y };
  const selectedSurvey = useMemo(
    () => (selectedCoord ? surveyAtlas(selectedCoord.x, selectedCoord.y, seed) : null),
    [selectedCoord?.x, selectedCoord?.y, seed],
  );
  const journey = useMemo(
    () => (selectedCoord && state ? summarizeAtlasJourney(state, selectedCoord) : null),
    [state, selectedCoord?.x, selectedCoord?.y],
  );

  // Measure the stage.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const measure = () => {
      const bounds = stage.getBoundingClientRect();
      const width = Math.max(1, Math.round(bounds.width));
      const height = Math.max(1, Math.round(bounds.height));
      setViewport((current) => (current.width === width && current.height === height ? current : { width, height }));
    };
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(measure);
      observer.observe(stage);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Keep the camera legal when the stage resizes.
  useEffect(() => {
    setCamera((current) => clampAtlasCamera(current, viewport));
  }, [viewport.width, viewport.height]);

  // Paint the raster whenever the camera, seed, or discoveries change.
  const seenKeys = useMemo(() => Object.keys(state?.world?.seen || {}), [state?.world?.seen]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof requestAnimationFrame === "undefined") return undefined;
    const token = { cancelled: false, frame: 0 };
    paintAtlas({ canvas, camera, viewport, seed, seenKeys, token });
    return () => {
      token.cancelled = true;
      if (token.frame) cancelAnimationFrame(token.frame);
    };
  }, [camera, viewport, seed, seenKeys]);

  // Wheel zoom needs a non-passive listener.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      const bounds = stage.getBoundingClientRect();
      const anchor = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      setCamera((current) => zoomAtlasCamera(current, viewport, event.deltaY < 0 ? 1.22 : 1 / 1.22, anchor));
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [viewport]);

  function stagePoint(event) {
    const bounds = stageRef.current.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }

  function handlePointerDown(event) {
    const gesture = gestureRef.current;
    gesture.pointers.set(event.pointerId, stagePoint(event));
    if (gesture.pointers.size === 1) gesture.moved = false;
    if (gesture.pointers.size === 2) {
      const [a, b] = [...gesture.pointers.values()];
      gesture.pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
    }
    stageRef.current.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event) {
    const gesture = gestureRef.current;
    if (!gesture.pointers.has(event.pointerId)) return;
    const point = stagePoint(event);
    const previous = gesture.pointers.get(event.pointerId);
    gesture.pointers.set(event.pointerId, point);

    if (gesture.pointers.size === 2) {
      const [a, b] = [...gesture.pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (gesture.pinchDistance > 0 && Math.abs(distance - gesture.pinchDistance) > 1) {
        const factor = distance / gesture.pinchDistance;
        gesture.pinchDistance = distance;
        gesture.moved = true;
        setCamera((current) => zoomAtlasCamera(current, viewport, factor, midpoint));
      }
      return;
    }

    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    if (!gesture.moved && Math.hypot(dx, dy) < 4) return;
    gesture.moved = true;
    setCamera((current) => panAtlasCamera(current, viewport, dx, dy));
  }

  function handlePointerUp(event) {
    const gesture = gestureRef.current;
    const hadPointer = gesture.pointers.delete(event.pointerId);
    stageRef.current?.releasePointerCapture?.(event.pointerId);
    if (!hadPointer || gesture.moved || gesture.pointers.size > 0) return;
    if (event.target.closest?.("button")) return; // marker buttons select themselves
    // A clean tap on open ground charts that coordinate.
    const fractional = atlasScreenToWorld(camera, viewport, stagePoint(event));
    const coord = axialRound(fractional.x, fractional.y);
    const sample = cachedSurvey(coord.x, coord.y, seed);
    if (!sample.land) return;
    setSelection({ kind: "point", x: coord.x, y: coord.y });
  }

  function handleKeyDown(event) {
    const pan = 72;
    if (event.key === "ArrowLeft") setCamera((current) => panAtlasCamera(current, viewport, pan, 0));
    else if (event.key === "ArrowRight") setCamera((current) => panAtlasCamera(current, viewport, -pan, 0));
    else if (event.key === "ArrowUp") setCamera((current) => panAtlasCamera(current, viewport, 0, pan));
    else if (event.key === "ArrowDown") setCamera((current) => panAtlasCamera(current, viewport, 0, -pan));
    else if (event.key === "+" || event.key === "=") setCamera((current) => zoomAtlasCamera(current, viewport, 1.25));
    else if (event.key === "-") setCamera((current) => zoomAtlasCamera(current, viewport, 1 / 1.25));
    else if (event.key === "0") setCamera((current) => clampAtlasCamera({ ...current, zoom: fit }, viewport));
    else if (event.key === "Home") setCamera((current) => centerAtlasCamera(current, viewport, partyCoord, Math.max(current.zoom, fit * 3)));
    else return;
    event.preventDefault();
  }

  function inspectLandmark(landmark) {
    setSelection({ kind: "landmark", id: landmark.id });
  }

  function inspectRealm(realm) {
    setFocusedRealmId((current) => (current === realm.id ? null : realm.id));
    const capital = landmarks.find((landmark) => landmark.capitalOfRealmId === realm.id || landmark.id === realm.capital.id);
    if (capital) setSelection({ kind: "landmark", id: capital.id });
    setCamera((current) => centerAtlasCamera(current, viewport, realm.center, Math.max(fit * 2.1, current.zoom)));
  }

  function toggleLayer(layerId) {
    setVisibleLayers((current) => {
      const next = new Set(current);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  }

  function centerOnParty() {
    setCamera((current) => centerAtlasCamera(current, viewport, partyCoord, Math.max(current.zoom, fit * 3)));
  }

  function chartSelection() {
    if (!selectedCoord) return;
    const tile = getTile(state, selectedCoord.x, selectedCoord.y);
    onPick({
      x: selectedCoord.x,
      y: selectedCoord.y,
      key: `${selectedCoord.x},${selectedCoord.y}`,
      tile,
      name: selectedLandmark?.name || null,
      knownBy: selectedLandmark ? landmarkKnowledge(state, selectedLandmark) : null,
    });
  }

  // ---- Derived presentation ----
  const partyScreen = atlasWorldToScreen(camera, viewport, partyCoord);
  const kmAcross = Math.round((viewport.width / camera.zoom) * (CONTINENT.hexKilometers || 6));
  const journeyPoints = journey ? svgPoints(camera, viewport, thinPath(journey.fullPath)) : "";
  const coastPoints = useMemo(() => svgPoints(camera, viewport, CONTINENT.coastline), [camera, viewport]);
  const showRegionLabels = zoomRatio >= 1.7;
  const showRealmLabels = zoomRatio < 1.7;

  const detailRealm = REALM_BY_ID[selectedLandmark?.realmId || selectedSurvey?.realmId] || null;
  const detailRegion = REGION_DEFINITIONS[selectedLandmark?.regionId || selectedSurvey?.regionId] || null;
  const detailProvince = (selectedLandmark?.provinceId && PROVINCE_BY_ID[selectedLandmark.provinceId])
    || PROVINCES.find((province) => province.seatLandmarkId === selectedLandmark?.id)
    || null;
  const detailFactionId = selectedLandmark?.factionId
    || selectedLandmark?.controllingFactionId
    || detailProvince?.authorityFactionId
    || detailRealm?.faction?.id;
  const detailFaction = FACTION_BY_ID[detailFactionId] || null;
  const detailCulture = CULTURE_BY_REALM_ID[detailRealm?.id] || null;
  const detailEconomy = ECONOMY_BY_REALM_ID[detailRealm?.id] || null;
  const detailLeader = detailFaction?.leader || detailProvince?.governor || detailRealm?.ruler;
  const detailRoutes = selectedLandmark ? atlasRoutesForLandmark(selectedLandmark) : [];
  const detailSeaLanes = selectedLandmark?.kind === "port"
    ? CONTINENT_SEA_LANES.filter((lane) => lane.portIds?.includes(selectedLandmark.id))
    : [];
  const detailTypeLabel = selectedLandmark
    ? atlasLandmarkTypeLabel(selectedLandmark)
    : (selectedSurvey ? (TERRAINS[selectedSurvey.terrain]?.label || "Open country") : "Unknown ground");
  const detailTitle = selectedLandmark?.name
    || (selectedSurvey ? `${TERRAINS[selectedSurvey.terrain]?.label || "Open country"} (${selectedCoord.x}, ${selectedCoord.y})` : "Uncharted");
  const detailKnowledge = selectedLandmark ? landmarkKnowledge(state, selectedLandmark) : null;
  const detailAreaName = detailProvince?.name || detailRegion?.label || detailRealm?.shortName || "Uncharted lands";
  const cultureSummary = detailCulture
    ? [detailCulture.demonym, compactList(detailCulture.languages, 2)].filter(Boolean).join(" · ")
    : detailRealm?.biomeName;
  const tradeSummary = compactList(detailEconomy?.exports)
    || detailEconomy?.tradeNotes
    || compactList(detailRegion?.features);
  const routeSummary = compactList(detailRoutes.map((route) => route.name), 4) || "No charted road";
  const seaLaneSummary = compactList(detailSeaLanes.map((lane) => lane.name), 3);
  const selectionIsParty = selectedCoord && selectedCoord.x === partyCoord.x && selectedCoord.y === partyCoord.y;

  return (
    <section className="world-atlas" aria-labelledby="world-atlas-title" aria-describedby="world-atlas-guide">
      <header className="world-atlas__header">
        <div className="world-atlas__identity">
          <small>Continental survey · five realms</small>
          <h3 id="world-atlas-title">{CONTINENT.name}</h3>
        </div>
        <p id="world-atlas-guide">
          Drag to pan, pinch or scroll to zoom, and tap any marker or open ground to survey it before setting the compass.
        </p>
        <div className="world-atlas__scale" role="img" aria-label={`View spans about ${kmAcross} kilometers; ${CONTINENT.hexKilometers} kilometers per travel hex`}>
          <i aria-hidden="true" />
          <span>≈ {kmAcross.toLocaleString()} km across</span>
        </div>
      </header>

      <nav className="world-atlas__realm-tabs" aria-label="Five biome realms">
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

      <div className="world-atlas__layer-controls" role="group" aria-label="Atlas marker layers">
        <button type="button" className="is-all-realms" aria-pressed={!focusedRealmId} onClick={() => setFocusedRealmId(null)}>
          <i aria-hidden="true">◎</i><span>All lands</span>
        </button>
        {ATLAS_LAYERS.map((layer) => (
          <button key={layer.id} type="button" aria-pressed={visibleLayers.has(layer.id)} onClick={() => toggleLayer(layer.id)}>
            <i aria-hidden="true">{layer.glyph}</i><span>{layer.label}</span>
          </button>
        ))}
      </div>

      <div className="world-atlas__map-shell">
        <div
          ref={stageRef}
          className="world-atlas__stage"
          role="application"
          aria-label={`Interactive map of ${CONTINENT.name}. Arrow keys pan, plus and minus zoom, zero fits the continent, Home returns to the party.`}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={handleKeyDown}
        >
          <canvas ref={canvasRef} className="world-atlas__canvas" aria-hidden="true" />

          <svg className="world-atlas__vector" viewBox={`0 0 ${viewport.width} ${viewport.height}`} aria-hidden="true">
            <polygon className="world-atlas__coastline" points={coastPoints} />
            {CONTINENT_WATERWAYS.map((river) => (
              <polyline key={river.id} className="world-atlas__river" points={svgPoints(camera, viewport, river.waypoints)}>
                <title>{river.name}</title>
              </polyline>
            ))}
            {CONTINENT_LAKES.map((lake) => {
              const center = atlasWorldToScreen(camera, viewport, lake.center);
              return <circle key={lake.id} className="world-atlas__lake" cx={center.x} cy={center.y} r={Math.max(3, lake.radius * camera.zoom * 0.85)} />;
            })}
            {CONTINENT_SEA_LANES.map((lane) => (
              <polyline
                key={lane.id}
                className={`world-atlas__sea-lane ${focusedRealmId && !lane.realmIds?.includes(focusedRealmId) ? "is-muted" : ""}`}
                points={svgPoints(camera, viewport, lane.waypoints)}
              >
                <title>{lane.name}</title>
              </polyline>
            ))}
            {CONTINENT_ROUTES.map((route) => (
              <polyline
                key={route.id}
                className={`world-atlas__route ${route.kind === "regional-road" ? "is-regional" : "is-great"} ${focusedRealmId && !route.realmIds?.includes(focusedRealmId) ? "is-muted" : ""}`}
                points={svgPoints(camera, viewport, route.waypoints)}
              >
                <title>{route.name}</title>
              </polyline>
            ))}
            {journeyPoints && (
              <>
                <polyline className="world-atlas__journey-halo" points={journeyPoints} />
                <polyline className="world-atlas__journey" points={journeyPoints} />
              </>
            )}
          </svg>

          {showRealmLabels && (
            <div className="world-atlas__realm-labels" aria-hidden="true">
              {REALMS.map((realm) => {
                const screen = atlasWorldToScreen(camera, viewport, realm.center);
                return (
                  <span key={realm.id} className={`is-${realm.id}`} style={{ left: `${screen.x}px`, top: `${screen.y}px` }}>
                    <b>{realm.shortName}</b>
                    <small>{realm.biomeName}</small>
                  </span>
                );
              })}
            </div>
          )}

          <div className="world-atlas__water-labels" aria-hidden="true">
            {COASTAL_FEATURES.map((feature) => {
              const screen = atlasWorldToScreen(camera, viewport, feature.coord);
              return (
                <span key={feature.id} className={`is-${feature.kind}`} style={{ left: `${screen.x}px`, top: `${screen.y}px` }}>
                  {feature.name}
                </span>
              );
            })}
          </div>

          {showRegionLabels && (
            <div className="world-atlas__region-labels" aria-hidden="true">
              {Object.values(REGION_DEFINITIONS).flatMap((region) => region.sites.map((site, index) => {
                const screen = atlasWorldToScreen(camera, viewport, site);
                return (
                  <span key={`${region.id}:${index}`} style={{ left: `${screen.x}px`, top: `${screen.y}px` }}>
                    {region.label}
                  </span>
                );
              }))}
            </div>
          )}

          <div className="world-atlas__marker-layer" role="group" aria-label={`${landmarks.length} known landmarks`}>
            {landmarks.map((landmark) => {
              const visible = atlasMarkerVisible(landmark, {
                zoomRatio,
                visibleLayers,
                focusedRealmId,
                selectedLandmarkId: selection.kind === "landmark" ? selection.id : null,
              }) || !!landmark.quest;
              const screen = atlasWorldToScreen(camera, viewport, landmark.coord);
              const offstage = screen.x < -40 || screen.y < -40 || screen.x > viewport.width + 40 || screen.y > viewport.height + 40;
              const selected = selection.kind === "landmark" && selection.id === landmark.id;
              return (
                <button
                  key={landmark.id}
                  type="button"
                  hidden={!visible || offstage}
                  className={`world-atlas__marker is-${landmark.knowledgeTier} is-category-${atlasLandmarkLayer(landmark)} ${selected ? "is-selected" : ""} ${landmark.capitalOfRealmId ? "is-capital" : ""} ${landmark.quest ? "has-quest" : ""}`}
                  style={{ left: `${screen.x}px`, top: `${screen.y}px` }}
                  onClick={() => inspectLandmark(landmark)}
                  aria-label={`Inspect ${landmark.name}, ${atlasLandmarkTypeLabel(landmark)}, ${REGION_DEFINITIONS[landmark.regionId]?.label || REALM_BY_ID[landmark.realmId]?.shortName || "uncharted lands"}, ${ATLAS_KNOWLEDGE_LABELS[landmark.knowledgeTier]}`}
                  aria-pressed={selected}
                  aria-controls="world-atlas-detail"
                >
                  <span aria-hidden="true">{ATLAS_LANDMARK_GLYPHS[landmark.kind] || "◆"}</span>
                  {landmark.quest && <i className="world-atlas__quest-pip" aria-hidden="true">!</i>}
                  {(zoomRatio >= 1.5 || landmark.capitalOfRealmId || selected) && (
                    <b aria-hidden="true">{landmark.name}</b>
                  )}
                </button>
              );
            })}
            {questMarkers.map((quest) => {
              const screen = atlasWorldToScreen(camera, viewport, quest.coord);
              const offstage = screen.x < -40 || screen.y < -40 || screen.x > viewport.width + 40 || screen.y > viewport.height + 40;
              return (
                <button
                  key={quest.id}
                  type="button"
                  hidden={offstage}
                  className="world-atlas__marker is-quest"
                  style={{ left: `${screen.x}px`, top: `${screen.y}px` }}
                  onClick={() => setSelection({ kind: "point", x: quest.coord.x, y: quest.coord.y })}
                  aria-label={`Quest objective: ${quest.title}`}
                >
                  <span aria-hidden="true">✦</span>
                  <b aria-hidden="true">{quest.title}</b>
                </button>
              );
            })}
          </div>

          {selection.kind === "point" && (() => {
            const screen = atlasWorldToScreen(camera, viewport, selectedCoord);
            return (
              <span className="world-atlas__point-pin" style={{ left: `${screen.x}px`, top: `${screen.y}px` }} aria-hidden="true">◈</span>
            );
          })()}

          <div
            className="world-atlas__party"
            style={{ left: `${partyScreen.x}px`, top: `${partyScreen.y}px` }}
            role="img"
            aria-label={`Your current position on ${CONTINENT.name}`}
          >
            <i aria-hidden="true" />
            <span aria-hidden="true">You</span>
          </div>

          <div className="world-atlas__map-controls">
            <button type="button" onClick={centerOnParty} aria-label="Center map on the party">◎ Party</button>
            <div role="group" aria-label="Map zoom controls">
              <button type="button" onClick={() => setCamera((current) => zoomAtlasCamera(current, viewport, 1 / 1.4))} disabled={camera.zoom <= fit * 1.01} aria-label="Zoom map out">−</button>
              <button type="button" onClick={() => setCamera((current) => clampAtlasCamera({ ...current, zoom: fit }, viewport))} aria-label="Fit the whole continent">{Math.round(zoomRatio * 100)}%</button>
              <button type="button" onClick={() => setCamera((current) => zoomAtlasCamera(current, viewport, 1.4))} disabled={camera.zoom >= ATLAS_MAX_ZOOM * 0.99} aria-label="Zoom map in">+</button>
            </div>
          </div>
        </div>
      </div>

      {selectedCoord && (
        <aside id="world-atlas-detail" className="world-atlas__detail" aria-live="polite" aria-label={`Atlas entry for ${detailTitle}`}>
          <div className="world-atlas__detail-copy">
            <small>
              {detailTypeLabel}
              {detailKnowledge ? ` · ${ATLAS_KNOWLEDGE_LABELS[detailKnowledge]}` : ""}
              {detailAreaName ? ` · ${detailAreaName}` : ""}
            </small>
            <h4>{detailTitle}</h4>
            <p>{selectedLandmark?.description || detailRealm?.description || "Unsurveyed ground."}</p>
          </div>
          <dl>
            <div><dt>Site type</dt><dd>{detailTypeLabel}</dd></div>
            <div><dt>Province</dt><dd title={detailProvince?.description}>{detailProvince?.name || detailRegion?.label || "Uncharted province"}</dd></div>
            <div><dt>Realm</dt><dd>{detailRealm?.name || "Unclaimed frontier"}</dd></div>
            <div><dt>Authority</dt><dd title={detailFaction?.description}>{detailFaction?.name || detailRealm?.faction?.name || "Independent"}</dd></div>
            <div><dt>Leader</dt><dd>{detailLeader ? `${detailLeader.name}${detailLeader.title ? ` · ${detailLeader.title}` : ""}` : "No single ruler"}</dd></div>
            <div><dt>Culture</dt><dd title={detailCulture?.description}>{cultureSummary || "Mixed frontier traditions"}</dd></div>
            <div><dt>Trade</dt><dd title={detailEconomy?.tradeNotes}>{tradeSummary || "Local exchange"}</dd></div>
            {selectedLandmark?.garrison && <div><dt>Garrison</dt><dd>{selectedLandmark.garrison}</dd></div>}
            <div className="is-wide"><dt>Connected routes</dt><dd title={detailRoutes.map((route) => route.name).join(", ")}>{routeSummary}</dd></div>
            {seaLaneSummary && <div className="is-wide"><dt>Sea passages</dt><dd>{seaLaneSummary}</dd></div>}
          </dl>

          {journey && (
            <div className="world-atlas__journey-plan" aria-label={`Journey plan to ${detailTitle}`}>
              <div className="world-atlas__journey-stats">
                <span><small>Distance</small><b>{journey.totalSteps}</b><em>hexes · ≈{journey.kilometers.toLocaleString()} km</em></span>
                <span><small>March time</small><b>≈{journey.duration}</b><em>first leg {journey.legDuration}</em></span>
                <span className={journey.risk >= 40 ? "is-danger" : ""}><small>Leg danger</small><b>{journey.risk}%</b><em>{journey.arrived ? "single march" : `${Math.ceil(journey.totalSteps / Math.max(1, journey.legSteps))} legs`}</em></span>
              </div>
              {journey.waypoints.length > 0 && (
                <p className="world-atlas__journey-via">Via {journey.waypoints.map((waypoint) => waypoint.name).join(" · ")}</p>
              )}
              {journey.checkpoints.length > 0 && (
                <p className="world-atlas__journey-gates">Border checkpoints: {journey.checkpoints.map((checkpoint) => checkpoint.name).join(" · ")}</p>
              )}
            </div>
          )}
          {!journey && !selectionIsParty && <p className="world-atlas__journey-blocked">No ground route reaches this point from the party's position.</p>}
          {selectionIsParty && <p className="world-atlas__journey-blocked">The party is already here.</p>}

          <button type="button" className="world-atlas__chart" onClick={chartSelection} disabled={selectionIsParty}>
            <span>Set compass</span>
            <small>{journey ? `${journey.totalSteps} travel hex${journey.totalSteps === 1 ? "" : "es"}` : "Known destination"}</small>
          </button>
        </aside>
      )}

      <footer className="world-atlas__legend" aria-label="Map legend">
        <span><i className="is-road" />Great road</span>
        <span><i className="is-sea-lane" />Sea passage</span>
        <span><i className="is-trail" />Party trail</span>
        <span><i className="is-journey" />Planned route</span>
        <small>{REALMS.length} realms · {Object.keys(REGION_DEFINITIONS).length} named regions · {CONTINENT_ROUTES.length} charted roads · {CONTINENT_SEA_LANES.length} sea lanes · one coast-to-coast world map</small>
      </footer>
    </section>
  );
}
