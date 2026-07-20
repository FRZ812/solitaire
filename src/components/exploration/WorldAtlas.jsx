import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  COASTAL_FEATURES,
  CONTINENT,
  CONTINENT_SEA_LANES,
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
import { trackedCharacterResult } from "../../engine/positions.js";
import { TERRAINS } from "../../data/terrains.js";
import { poiIconKeyForLandmark } from "../../data/poi-icons.js";
import { PoiIcon, PoiTierMarker } from "../PoiIcon.jsx";
import { LoadingDots } from "../primitives.jsx";
import { ATLAS_QUALITY_EVENT, getAtlasQuality } from "../../engine/preferences.js";
import { resolveAtlasQuality } from "./atlasQuality.js";
import { WorldAtlas3DScene } from "./WorldAtlas3DScene.jsx";
import { AtlasPaperMap } from "./AtlasPaperMap.jsx";
import {
  atlasPaperMarkerVisible,
  atlasPaperWorldToScreen,
  centerAtlasPaperCamera,
  clampAtlasPaperCamera,
  fitAtlasPaperCamera,
  panAtlasPaperCamera,
  zoomAtlasPaperCamera,
} from "./atlasPaperMapModel.js";
import { createAtlasTween } from "./atlasTween.js";
import {
  ATLAS_3D_MAX_ZOOM,
  atlas3dCameraFrame,
  atlas3dProject,
  atlas3dScreenToGround,
  atlas3dTerrainHeightAt,
  atlas3dWindowFloor,
  centerAtlas3dCamera,
  clampAtlas3dCamera,
  panAtlas3dCamera,
  zoomAtlas3dCamera,
} from "./worldAtlas3dModel.js";
import {
  ATLAS_KNOWLEDGE_LABELS,
  ATLAS_LANDMARK_GLYPHS,
  ATLAS_LAYERS,
  atlasLandmarkLayer,
  atlasLandmarkTypeLabel,
  atlasFitZoom,
  atlasMarkerVisible,
  atlasQuestMarkers,
  atlasRoutesForLandmark,
  axialRound,
  buildAtlasLandmarks,
  journeyLegBreaks,
  landmarkKnowledge,
  summarizeAtlasJourney,
} from "./worldAtlasModel.js";

const useAtlasLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

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

const INITIAL_ATLAS_VIEWPORT = Object.freeze({ width: 960, height: 540 });
const ATLAS_OPEN_ZOOM_RATIO = 1.16;
const ATLAS_WHEEL_ZOOM_STEP = 1.22;
const ATLAS_WHEEL_STEP_PIXELS = 100;
const ATLAS_WHEEL_MAX_FRAME_DELTA = 240;
const ATLAS_WHEEL_IGNORE_SELECTOR = "[data-atlas-wheel-ignore]";
export const ATLAS_PAPER_ENTER_RATIO = 8;
export const ATLAS_3D_ENTER_RATIO = 8.6;

function atlasOpeningZoom(viewport, seed = CONTINENT.seed) {
  const portrait = viewport.height > viewport.width * 1.3;
  const localFloor = atlas3dWindowFloor(viewport, seed);
  return Math.min(
    ATLAS_3D_MAX_ZOOM,
    Math.max(localFloor * (portrait ? 1.28 : ATLAS_OPEN_ZOOM_RATIO), localFloor),
  );
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Mouse wheels usually report roughly 100 CSS pixels per notch, while smooth
// trackpads emit a stream of much smaller deltas. Mapping the delta onto the
// old 1.22x wheel step keeps mouse behavior familiar without making every tiny
// trackpad event a full zoom step.
export function atlasWheelZoomFactor(deltaY, deltaMode = 0, pageSize = INITIAL_ATLAS_VIEWPORT.height) {
  const pixels = deltaY * (deltaMode === 1 ? 32 : deltaMode === 2 ? Math.max(1, pageSize) : 1);
  const bounded = clamp(pixels, -ATLAS_WHEEL_MAX_FRAME_DELTA, ATLAS_WHEEL_MAX_FRAME_DELTA);
  return ATLAS_WHEEL_ZOOM_STEP ** (-bounded / ATLAS_WHEEL_STEP_PIXELS);
}

// The search, filters, map key, and place dossier live inside the stage. Their
// wheel events bubble to the stage too, but scrolling map UI must never zoom
// and repaint the terrain underneath it.
export function atlasWheelZoomAllowed(target) {
  const element = target?.nodeType === 1 ? target : target?.parentElement || target;
  return !element?.closest?.(ATLAS_WHEEL_IGNORE_SELECTOR);
}

// Pointer capture keeps delivering a marker's synthetic click after the map
// has been dragged. Keyboard activation has detail === 0 and must continue to
// work, while pointer clicks are ignored until the next clean pointerdown.
export function atlasSelectionClickAllowed(event, gesture) {
  return event?.detail === 0 || !gesture?.suppressClick;
}

export function atlasKeyboardShortcutAllowed(target) {
  const element = target?.nodeType === 1 ? target : target?.parentElement || target;
  return !element?.closest?.("button, a, input, select, textarea, [contenteditable='true']");
}

export function atlasModeForZoom(currentMode, zoom, fitZoom, windowFloor = null) {
  const ratio = zoom / Math.max(0.0001, fitZoom);
  const threeEnterRatio = Number.isFinite(windowFloor)
    ? Math.max(ATLAS_3D_ENTER_RATIO, windowFloor / Math.max(0.0001, fitZoom))
    : ATLAS_3D_ENTER_RATIO;
  if (currentMode === "paper") return ratio >= threeEnterRatio ? "3d" : "paper";
  return ratio < ATLAS_PAPER_ENTER_RATIO ? "paper" : "3d";
}

export function atlasModeForScene(currentMode, sceneState, zoom, fitZoom, windowFloor = null) {
  if (sceneState === "error") return "paper";
  if (sceneState === "loading") return currentMode;
  return atlasModeForZoom(currentMode, zoom, fitZoom, windowFloor);
}

export function atlasMarchDuration(path) {
  const steps = Math.max(0, (path?.length || 0) - 1);
  return Math.max(1_800, Math.min(6_000, steps * 120));
}

export function atlasMarchCoordAt(path, progress) {
  if (!Array.isArray(path) || path.length === 0) return null;
  if (path.length === 1) return { x: path[0].x, y: path[0].y };
  const position = clamp(progress, 0, 1) * (path.length - 1);
  const index = Math.min(path.length - 2, Math.floor(position));
  const mix = Math.min(1, position - index);
  return {
    x: path[index].x + (path[index + 1].x - path[index].x) * mix,
    y: path[index].y + (path[index + 1].y - path[index].y) * mix,
  };
}

export function centerAtlasMarchCamera(camera, coord, {
  viewport,
  fitZoom,
  windowFloor,
  seed = CONTINENT.seed,
  sceneState = "loading",
} = {}) {
  if (sceneState === "ready") {
    const zoom = Math.max(
      camera.zoom,
      windowFloor * 1.12,
      1.2,
      fitZoom * ATLAS_3D_ENTER_RATIO,
    );
    return {
      mode: "3d",
      camera: centerAtlas3dCamera(camera, viewport, coord, zoom, seed),
    };
  }
  const zoom = Math.min(camera.zoom, fitZoom * (ATLAS_PAPER_ENTER_RATIO - 0.5));
  return {
    mode: "paper",
    camera: centerAtlasPaperCamera(camera, viewport, coord, zoom),
  };
}

export function atlasDisplayedPartyCoord(marchCoord, partyCoord, visualDone = false) {
  return !visualDone && marchCoord ? marchCoord : partyCoord;
}

function sameCamera(a, b) {
  return a.x === b.x
    && a.y === b.y
    && a.zoom === b.zoom
    && (a.targetHeight ?? null) === (b.targetHeight ?? null);
}

function compactList(value, limit = 3) {
  const items = Array.isArray(value) ? value : (value ? [value] : []);
  if (!items.length) return null;
  const shown = items.slice(0, limit).map((item) => (
    typeof item === "string" ? item : item?.name || item?.label || String(item)
  ));
  return `${shown.join(", ")}${items.length > limit ? ` +${items.length - limit}` : ""}`;
}

const KNOWLEDGE_SHORT_LABELS = Object.freeze({
  charted: "Charted",
  sighted: "Sighted",
  reputation: "Reputation",
  legend: "Legend",
});

function stopStagePointer(event) {
  // Chrome overlays (search, chips, rail, place card) sit on the map stage;
  // swallowing pointerdown keeps taps and scrolls inside them from panning
  // the table or charting the ground underneath.
  event.stopPropagation();
}

const AtlasPlaceCard = memo(function AtlasPlaceCard({ entry, onChart, onTravel, travelDisabled = false }) {
  const [expanded, setExpanded] = useState(false);
  const {
    areaName,
    culture,
    cultureSummary,
    economy,
    faction,
    journey,
    knowledge,
    landmark,
    leader,
    province,
    realm,
    region,
    routeSummary,
    routes,
    seaLaneSummary,
    selectionIsParty,
    title,
    trackedDescription,
    tradeSummary,
    typeLabel,
  } = entry;

  return (
    <aside
      id="world-atlas-detail"
      className={`world-atlas__placecard${expanded ? " is-expanded" : ""}${journey && journey.risk >= 40 ? " is-danger" : ""}`}
      data-atlas-selection-key={entry.selectionKey}
      aria-live="polite"
      aria-label={`Atlas entry for ${title}`}
      onPointerDown={stopStagePointer}
    >
      <header className="world-atlas__placecard-head">
        <div className="world-atlas__placecard-copy">
          <small>
            {typeLabel}
            {knowledge ? ` · ${ATLAS_KNOWLEDGE_LABELS[knowledge]}` : ""}
            {areaName ? ` · ${areaName}` : ""}
          </small>
          <h4>{title}</h4>
          {journey ? (
            <span className="world-atlas__placecard-journey">
              <small>Route preview</small>
              <b>{journey.kilometers.toLocaleString()} km · ≈{journey.duration}</b>
              <em className={journey.risk >= 40 ? "is-danger" : ""}>{journey.risk}% next-leg risk</em>
            </span>
          ) : (
            <span className="world-atlas__placecard-journey is-blocked">
              {selectionIsParty ? "The party is already here." : "No ground route reaches this point from the party's position."}
            </span>
          )}
        </div>
        <div className="world-atlas__placecard-actions">
          <button
            type="button"
            className="world-atlas__more"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            aria-controls="world-atlas-detail-body"
          >
            {expanded ? "Hide details" : "Details"}
          </button>
          {!selectionIsParty && journey && (
            <button type="button" className="world-atlas__chart" onClick={onChart}>
              <span>Set destination</span>
            </button>
          )}
          {!selectionIsParty && journey && onTravel && (
            <button
              type="button"
              className="world-atlas__march"
              onClick={onTravel}
              disabled={travelDisabled}
            >
              <span>{travelDisabled ? "Marching…" : "March now"}</span>
            </button>
          )}
        </div>
      </header>

      <div id="world-atlas-detail-body" className="world-atlas__placecard-body" hidden={!expanded}>
        <p>{trackedDescription || landmark?.description || realm?.description || "Unsurveyed ground."}</p>
        <dl>
          <div><dt>Site type</dt><dd>{typeLabel}</dd></div>
          <div><dt>Province</dt><dd title={province?.description}>{province?.name || region?.label || "Uncharted province"}</dd></div>
          <div><dt>Realm</dt><dd>{realm?.name || "Unclaimed frontier"}</dd></div>
          <div><dt>Authority</dt><dd title={faction?.description}>{faction?.name || realm?.faction?.name || "Independent"}</dd></div>
          <div><dt>Leader</dt><dd>{leader ? `${leader.name}${leader.title ? ` · ${leader.title}` : ""}` : "No single ruler"}</dd></div>
          <div><dt>Culture</dt><dd title={culture?.description}>{cultureSummary || "Mixed frontier traditions"}</dd></div>
          <div><dt>Trade</dt><dd title={economy?.tradeNotes}>{tradeSummary || "Local exchange"}</dd></div>
          {landmark?.marketTier && <div><dt>Trade house</dt><dd><PoiTierMarker marketTier={landmark.marketTier} size={15} showLabel /></dd></div>}
          {landmark?.garrison && <div><dt>Garrison</dt><dd>{landmark.garrison}</dd></div>}
          <div className="is-wide"><dt>Connected routes</dt><dd title={routes.map((route) => route.name).join(", ")}>{routeSummary}</dd></div>
          {seaLaneSummary && <div className="is-wide"><dt>Sea passages</dt><dd>{seaLaneSummary}</dd></div>}
        </dl>

        {journey && (
          <div className="world-atlas__journey-plan" aria-label={`Journey plan to ${title}`}>
            {journey.waypoints.length > 0 && (
              <p className="world-atlas__journey-via">Via {journey.waypoints.map((waypoint) => waypoint.name).join(" · ")}</p>
            )}
            {journey.checkpoints.length > 0 && (
              <p className="world-atlas__journey-gates">Border checkpoints: {journey.checkpoints.map((checkpoint) => checkpoint.name).join(" · ")}</p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
});

export function WorldAtlas({
  state,
  origin,
  onPick,
  onTravel = null,
  travelMarch = null,
  onTravelMarchFinish = null,
  initialSelection = null,
  toolbarActions = null,
}) {
  const seed = state?.world?.seed || CONTINENT.seed;
  const partyCoord = origin || state?.world?.currentTile || CONTINENT.start.coord;
  const stageRef = useRef(null);
  const scene3dRef = useRef(null);
  const paperMapRef = useRef(null);
  const marchTweenRef = useRef(null);
  const marchFollowRef = useRef(true);
  const marchFinishRef = useRef(onTravelMarchFinish);
  const marchRuntimeRef = useRef(null);
  const sceneRecoveryModeRef = useRef(null);
  const searchInputRef = useRef(null);
  const gestureRef = useRef({
    pointers: new Map(),
    moved: false,
    dragDistance: 0,
    suppressClick: false,
    startedOnInteractive: false,
    hadMultiplePointers: false,
  });
  const cameraFrameRef = useRef({ frame: 0, operations: [] });
  const wheelRef = useRef({ frame: 0, deltaY: 0, anchor: null });
  const didInitialFitRef = useRef(false);
  const [viewport, setViewport] = useState(INITIAL_ATLAS_VIEWPORT);
  const [stageMeasured, setStageMeasured] = useState(false);
  // WebGL owns the permanent terrain geometry. Loading and error states keep
  // the same 3D stage mounted behind their status UI.
  const planeViewport = viewport;
  const [camera, setCamera] = useState(() => {
    const plane = INITIAL_ATLAS_VIEWPORT;
    const openingZoom = atlasOpeningZoom(plane, seed);
    return centerAtlas3dCamera(
      { x: partyCoord.x, y: partyCoord.y, zoom: openingZoom },
      plane,
      partyCoord,
      openingZoom,
      seed,
    );
  });
  const [atlasMode, setAtlasMode] = useState("3d");
  const [paperReady, setPaperReady] = useState(false);
  const [marchCoord, setMarchCoord] = useState(null);
  const [visibleLayers, setVisibleLayers] = useState(() => new Set(ATLAS_LAYERS.map((layer) => layer.id)));
  const [focusedRealmId, setFocusedRealmId] = useState(null);
  // The party marker already communicates the opening position. Keep the map
  // clear until the player intentionally asks about a destination.
  const [selection, setSelection] = useState(initialSelection);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sceneState, setSceneState] = useState("loading");
  const [sceneError, setSceneError] = useState("");
  const [qualityMode, setQualityMode] = useState(getAtlasQuality);
  const quality = useMemo(() => resolveAtlasQuality(qualityMode), [qualityMode]);

  marchFinishRef.current = onTravelMarchFinish;

  useEffect(() => {
    const applyQuality = (event) => setQualityMode(event?.detail || getAtlasQuality());
    window.addEventListener(ATLAS_QUALITY_EVENT, applyQuality);
    return () => window.removeEventListener(ATLAS_QUALITY_EVENT, applyQuality);
  }, []);

  // A resolved-tier change remounts the scene (key={quality.id}); surface the
  // loading veil for that rebuild instead of freezing the last frame.
  const qualityIdRef = useRef(quality.id);
  useEffect(() => {
    if (qualityIdRef.current === quality.id) return;
    qualityIdRef.current = quality.id;
    setSceneError("");
    setSceneState("loading");
  }, [quality.id]);

  const fit = atlasFitZoom(planeViewport);
  const windowFloor = atlas3dWindowFloor(planeViewport, seed);
  const zoomRatio = camera.zoom / fit;
  const hexKilometers = CONTINENT.hexKilometers || 6;
  const landmarks = useMemo(() => buildAtlasLandmarks(state, partyCoord), [state, partyCoord]);
  const partyLandmark = useMemo(
    () => landmarks.find((landmark) => landmark.coord.x === partyCoord.x && landmark.coord.y === partyCoord.y) || null,
    [landmarks, partyCoord.x, partyCoord.y],
  );
  const questMarkers = useMemo(() => atlasQuestMarkers(state), [state]);
  const trackedCharacter = useMemo(() => trackedCharacterResult(state), [state]);

  marchRuntimeRef.current = {
    viewport: planeViewport,
    fitZoom: fit,
    windowFloor,
    seed,
    sceneState,
  };

  function clampActiveCamera(current) {
    return atlasMode === "paper"
      ? clampAtlasPaperCamera(current, planeViewport)
      : clampAtlas3dCamera(current, planeViewport, seed);
  }

  function centerActiveCamera(current, coord, zoom = current.zoom) {
    return sceneState === "ready"
      && zoom >= Math.max(fit * ATLAS_3D_ENTER_RATIO, windowFloor)
      ? centerAtlas3dCamera(current, planeViewport, coord, Math.max(zoom, windowFloor), seed)
      : centerAtlasPaperCamera(current, planeViewport, coord, zoom);
  }

  function fitActiveCamera(current) {
    return fitAtlasPaperCamera(current, planeViewport);
  }

  function showPaperOverview() {
    cancelMarchFollow();
    setAtlasMode("paper");
    setCamera((current) => fitActiveCamera(current));
  }

  function cancelMarchFollow() {
    marchFollowRef.current = false;
  }

  const selectedLandmark = selection?.kind === "landmark"
    ? landmarks.find((landmark) => landmark.id === selection.id) || null
    : null;
  const selectedCoord = selection?.kind === "landmark"
    ? selectedLandmark?.coord || null
    : selection
    ? { x: selection.x, y: selection.y }
    : null;
  const selectedSurvey = useMemo(
    () => (selectedCoord ? surveyAtlas(selectedCoord.x, selectedCoord.y, seed) : null),
    [selectedCoord?.x, selectedCoord?.y, seed],
  );
  const journey = useMemo(
    () => (selectedCoord && state ? summarizeAtlasJourney(state, selectedCoord) : null),
    [state, selectedCoord?.x, selectedCoord?.y],
  );
  const selectionKey = !selection
    ? ""
    : selection.kind === "landmark"
    ? selection.id
    : `${selection.x},${selection.y}`;

  // Measure the stage.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const measure = () => {
      const bounds = stage.getBoundingClientRect();
      const width = Math.max(1, Math.round(bounds.width));
      const height = Math.max(1, Math.round(bounds.height));
      setViewport((current) => (current.width === width && current.height === height ? current : { width, height }));
      setStageMeasured(true);
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

  // Fit once after the real stage measurement, then preserve the user's view
  // while merely keeping it legal on later resizes.
  useEffect(() => {
    if (!stageMeasured) return;
    setCamera((current) => {
      if (!didInitialFitRef.current) {
        didInitialFitRef.current = true;
        const openingZoom = atlasOpeningZoom(planeViewport, seed);
        return centerAtlas3dCamera(current, planeViewport, partyCoord, openingZoom, seed);
      }
      return clampActiveCamera(current);
    });
  }, [atlasMode, fit, seed, stageMeasured, planeViewport.width, planeViewport.height, partyCoord.x, partyCoord.y]);

  useEffect(() => {
    // Keep the intended presentation while chunks warm in the background.
    // Forcing paper here loses the initial 3D intent because the opening zoom
    // deliberately sits inside the hysteresis band.
    setAtlasMode((current) => atlasModeForScene(current, sceneState, camera.zoom, fit, windowFloor));
  }, [camera.zoom, fit, windowFloor, sceneState]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const seenMap = state?.world?.seen;
  const seenKeys = useMemo(() => Object.keys(seenMap || {}), [seenMap]);

  useEffect(() => {
    const path = travelMarch?.path;
    if (!travelMarch?.id || !Array.isArray(path) || path.length === 0) {
      marchTweenRef.current?.cancel?.();
      marchTweenRef.current = null;
      setMarchCoord(null);
      return undefined;
    }

    if (travelMarch.visualDone) {
      setMarchCoord(null);
      return undefined;
    }

    if (!stageMeasured) return undefined;

    let settled = false;
    const finish = (reason) => {
      if (settled) return;
      settled = true;
      setMarchCoord(null);
      marchFinishRef.current?.(travelMarch.id, { reason });
    };
    const prefersReducedMotion = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    marchFollowRef.current = true;
    const startingMode = marchRuntimeRef.current?.sceneState === "ready" ? "3d" : "paper";
    setAtlasMode(startingMode);
    setCamera((current) => centerAtlasMarchCamera(
      current,
      path[0],
      marchRuntimeRef.current,
    ).camera);

    const controller = createAtlasTween({
      duration: atlasMarchDuration(path),
      reducedMotion: prefersReducedMotion,
      onUpdate(progress) {
        const coord = atlasMarchCoordAt(path, progress);
        if (!coord) return;
        setMarchCoord(coord);
        if (marchFollowRef.current) {
          const mode = marchRuntimeRef.current?.sceneState === "ready" ? "3d" : "paper";
          setAtlasMode(mode);
          setCamera((current) => centerAtlasMarchCamera(
            current,
            coord,
            marchRuntimeRef.current,
          ).camera);
        }
      },
      onFinish: ({ reason }) => finish(reason),
    });
    marchTweenRef.current = controller;

    return () => {
      controller.cancel();
      if (marchTweenRef.current === controller) marchTweenRef.current = null;
      finish("unmount");
    };
  }, [stageMeasured, travelMarch?.id, travelMarch?.visualDone]);

  function pickAtlas3dGround(modelCamera, point) {
    return scene3dRef.current?.pickGround(point, modelCamera) || null;
  }

  // Wheel zoom needs a non-passive listener so the chart, rather than the page,
  // owns a wheel gesture made over open map terrain.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const onWheel = (event) => {
      if (atlasMode === "3d" && sceneState !== "ready") return;
      if (atlasMode === "paper" && !paperReady) return;
      if (!atlasWheelZoomAllowed(event.target) || event.deltaY === 0) return;
      event.preventDefault();
      cancelMarchFollow();
      const bounds = stage.getBoundingClientRect();
      const anchor = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      const wheel = wheelRef.current;
      wheel.deltaY += event.deltaY * (event.deltaMode === 1 ? 32 : event.deltaMode === 2 ? viewport.height : 1);
      wheel.anchor = anchor;
      if (wheel.frame) return;
      wheel.frame = requestAnimationFrame(() => {
        wheel.frame = 0;
        const deltaY = wheel.deltaY;
        const nextAnchor = wheel.anchor;
        wheel.deltaY = 0;
        wheel.anchor = null;
        if (deltaY === 0) return;
        const factor = atlasWheelZoomFactor(deltaY);
        if (atlasMode === "3d" && factor < 1 && camera.zoom * factor < windowFloor * 1.01) {
          setAtlasMode("paper");
        } else if (sceneState === "ready" && atlasMode === "paper" && factor > 1 && camera.zoom * factor >= Math.max(fit * ATLAS_3D_ENTER_RATIO, windowFloor)) {
          setAtlasMode("3d");
        }
        setCamera((current) => {
          const enterPaper = atlasMode === "3d"
            && factor < 1
            && current.zoom * factor < windowFloor * 1.01;
          const next = atlasMode === "paper" || enterPaper
            ? zoomAtlasPaperCamera(current, planeViewport, factor, nextAnchor)
            : zoomAtlas3dCamera(
              current,
              planeViewport,
              factor,
              nextAnchor,
              seed,
              pickAtlas3dGround,
            );
          return sameCamera(current, next) ? current : next;
        });
      });
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      stage.removeEventListener("wheel", onWheel);
      const wheel = wheelRef.current;
      if (wheel.frame) cancelAnimationFrame(wheel.frame);
      wheel.frame = 0;
      wheel.deltaY = 0;
      wheel.anchor = null;
    };
  }, [viewport, planeViewport, sceneState, paperReady, atlasMode, seed, windowFloor, fit, camera.zoom]);

  // Coalesce pointer camera updates to one React render per animation frame.
  // Raw mobile pointermove streams can be much faster than the display.
  function queueCameraOperations(operations) {
    const pending = cameraFrameRef.current;
    for (const operation of operations) {
      if (operation.type === "zoom"
        && atlasMode === "3d"
        && operation.factor < 1
        && camera.zoom * operation.factor < windowFloor * 1.01) {
        setAtlasMode("paper");
      } else if (sceneState === "ready"
        && operation.type === "zoom"
        && atlasMode === "paper"
        && operation.factor > 1
        && camera.zoom * operation.factor >= Math.max(fit * ATLAS_3D_ENTER_RATIO, windowFloor)) {
        setAtlasMode("3d");
      }
      const existing = pending.operations.find((item) => item.type === operation.type);
      if (operation.type === "pan" && existing) {
        existing.dx += operation.dx;
        existing.dy += operation.dy;
      } else if (operation.type === "zoom" && existing) {
        existing.factor *= operation.factor;
        existing.anchor = operation.anchor;
      } else {
        pending.operations.push({ ...operation });
      }
    }
    if (pending.frame || typeof requestAnimationFrame === "undefined") return;
    pending.frame = requestAnimationFrame(() => {
      pending.frame = 0;
      const queued = pending.operations.splice(0);
      setCamera((current) => {
        let next = current;
        for (const operation of queued) {
          if (operation.type === "zoom") {
            const enterPaper = atlasMode === "3d"
              && operation.factor < 1
              && next.zoom * operation.factor < windowFloor * 1.01;
            next = atlasMode === "paper" || enterPaper
              ? zoomAtlasPaperCamera(next, planeViewport, operation.factor, operation.anchor)
              : zoomAtlas3dCamera(next, planeViewport, operation.factor, operation.anchor, seed, pickAtlas3dGround);
          } else if (operation.dx || operation.dy) {
            next = atlasMode === "paper"
              ? panAtlasPaperCamera(next, planeViewport, operation.dx, operation.dy)
              : panAtlas3dCamera(next, planeViewport, operation.dx, operation.dy, seed, pickAtlas3dGround, operation.anchor);
          }
        }
        return sameCamera(current, next) ? current : next;
      });
    });
  }

  function cancelQueuedCameraOperations() {
    const pending = cameraFrameRef.current;
    if (pending.frame) cancelAnimationFrame(pending.frame);
    pending.frame = 0;
    pending.operations.length = 0;
  }

  useAtlasLayoutEffect(() => {
    cancelQueuedCameraOperations();
    return () => cancelQueuedCameraOperations();
  }, [planeViewport.height, planeViewport.width, seed]);

  function planePoint(event) {
    const bounds = stageRef.current.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }

  function handlePointerDown(event) {
    if ((atlasMode === "3d" && sceneState !== "ready") || (atlasMode === "paper" && !paperReady)) return;
    const gesture = gestureRef.current;
    gesture.pointers.set(event.pointerId, planePoint(event));
    if (gesture.pointers.size === 1) {
      gesture.suppressClick = false;
      gesture.moved = false;
      gesture.dragDistance = 0;
      gesture.startedOnInteractive = !!event.target.closest?.("button, a, input, select, textarea");
      gesture.hadMultiplePointers = false;
    }
    if (gesture.pointers.size > 1) {
      gesture.hadMultiplePointers = true;
      gesture.moved = true;
      gesture.suppressClick = true;
    }
    stageRef.current.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event) {
    const gesture = gestureRef.current;
    if (!gesture.pointers.has(event.pointerId)) return;
    const point = planePoint(event);
    const previous = gesture.pointers.get(event.pointerId);

    if (gesture.pointers.size === 2) {
      const [beforeA, beforeB] = [...gesture.pointers.values()];
      const beforeDistance = Math.hypot(beforeA.x - beforeB.x, beforeA.y - beforeB.y);
      const beforeMidpoint = { x: (beforeA.x + beforeB.x) / 2, y: (beforeA.y + beforeB.y) / 2 };
      gesture.pointers.set(event.pointerId, point);
      const [afterA, afterB] = [...gesture.pointers.values()];
      const distance = Math.hypot(afterA.x - afterB.x, afterA.y - afterB.y);
      const midpoint = { x: (afterA.x + afterB.x) / 2, y: (afterA.y + afterB.y) / 2 };
      const dx = midpoint.x - beforeMidpoint.x;
      const dy = midpoint.y - beforeMidpoint.y;
      const factor = beforeDistance > 0 ? distance / beforeDistance : 1;
      if (Math.hypot(dx, dy) > 0.25 || Math.abs(distance - beforeDistance) > 0.5) {
        cancelMarchFollow();
        gesture.moved = true;
        gesture.suppressClick = true;
        const operations = [];
        if (dx || dy) operations.push({ type: "pan", dx, dy, anchor: beforeMidpoint });
        if (factor !== 1) operations.push({ type: "zoom", factor, anchor: midpoint });
        queueCameraOperations(operations);
      }
      return;
    }
    gesture.pointers.set(event.pointerId, point);
    if (gesture.pointers.size > 2) return;

    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    gesture.dragDistance += Math.hypot(dx, dy);
    if (!gesture.moved && gesture.dragDistance < 4) return;
    cancelMarchFollow();
    gesture.moved = true;
    gesture.suppressClick = true;
    queueCameraOperations([{ type: "pan", dx, dy, anchor: previous }]);
  }

  function handlePointerUp(event) {
    const gesture = gestureRef.current;
    const hadPointer = gesture.pointers.delete(event.pointerId);
    stageRef.current?.releasePointerCapture?.(event.pointerId);
    if (!hadPointer) return;
    if (gesture.moved || gesture.hadMultiplePointers) {
      gesture.suppressClick = true;
      return;
    }
    if (gesture.pointers.size > 0) return;
    if (gesture.startedOnInteractive || event.target.closest?.("button, a, input, select, textarea")) return;
    // A clean tap on open ground charts that coordinate.
    const point = planePoint(event);
    const fractional = atlasMode === "paper"
      ? paperMapRef.current?.pickFractional(point, camera)
      : (scene3dRef.current?.pick(point)
        || atlas3dScreenToGround(camera, planeViewport, point, seed));
    if (!fractional) return;
    const coord = axialRound(fractional.x, fractional.y);
    const sample = surveyAtlas(coord.x, coord.y, seed);
    if (!sample.land) return;
    setSelection({ kind: "point", x: coord.x, y: coord.y });
  }

  function handlePointerCancel(event) {
    const gesture = gestureRef.current;
    const hadPointer = gesture.pointers.delete(event.pointerId);
    stageRef.current?.releasePointerCapture?.(event.pointerId);
    if (!hadPointer) return;
    cancelQueuedCameraOperations();
    gesture.moved = true;
    gesture.suppressClick = true;
  }

  function handleKeyDown(event) {
    if (travelMarch?.id && event.key === "Escape") {
      marchTweenRef.current?.finish?.();
      event.preventDefault();
      return;
    }
    if (!atlasKeyboardShortcutAllowed(event.target)) {
      if (event.key === "Escape" && (searchOpen || filtersOpen)) {
        setSearchOpen(false);
        setFiltersOpen(false);
        event.preventDefault();
      }
      return;
    }
    const pan = 72;
    const panCamera = (current, dx, dy) => (atlasMode === "paper"
      ? panAtlasPaperCamera(current, planeViewport, dx, dy)
      : panAtlas3dCamera(current, planeViewport, dx, dy, seed, pickAtlas3dGround));
    const zoomCamera = (current, factor) => {
      const enterPaper = atlasMode === "3d"
        && factor < 1
        && current.zoom * factor < windowFloor * 1.01;
      return atlasMode === "paper" || enterPaper
        ? zoomAtlasPaperCamera(current, planeViewport, factor)
        : zoomAtlas3dCamera(current, planeViewport, factor, null, seed, pickAtlas3dGround);
    };
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "0", "Home"].includes(event.key)) {
      cancelMarchFollow();
    }
    if (event.key === "ArrowLeft") setCamera((current) => panCamera(current, pan, 0));
    else if (event.key === "ArrowRight") setCamera((current) => panCamera(current, -pan, 0));
    else if (event.key === "ArrowUp") setCamera((current) => panCamera(current, 0, pan));
    else if (event.key === "ArrowDown") setCamera((current) => panCamera(current, 0, -pan));
    else if (event.key === "+" || event.key === "=") setCamera((current) => zoomCamera(current, 1.25));
    else if (event.key === "-") setCamera((current) => zoomCamera(current, 1 / 1.25));
    else if (event.key === "0") showPaperOverview();
    else if (event.key === "Home") setCamera((current) => centerActiveCamera(current, partyCoord, Math.max(current.zoom, windowFloor * 1.12)));
    else if (event.key === "Escape" && (searchOpen || filtersOpen)) {
      setSearchOpen(false);
      setFiltersOpen(false);
    }
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
    setCamera((current) => centerActiveCamera(current, realm.center, Math.max(fit * 2.1, current.zoom)));
    setFiltersOpen(false);
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
    setCamera((current) => centerActiveCamera(current, partyCoord, Math.max(current.zoom, windowFloor * 1.12)));
  }

  function centerOnTrackedCharacter() {
    if (!trackedCharacter) return;
    const { x, y } = trackedCharacter.pos;
    setSelection({ kind: "point", x, y });
    setCamera((current) => centerActiveCamera(current, { x, y }, Math.max(current.zoom, windowFloor * 1.12)));
  }

  function pickSearchResult(landmark) {
    setSelection({ kind: "landmark", id: landmark.id });
    setCamera((current) => centerActiveCamera(current, landmark.coord, Math.max(current.zoom, windowFloor * 1.12)));
    setSearchOpen(false);
    setQuery("");
  }

  const searchResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = landmarks.filter((landmark) => !needle
      || landmark.name.toLowerCase().includes(needle)
      || atlasLandmarkTypeLabel(landmark).toLowerCase().includes(needle)
      || (REGION_DEFINITIONS[landmark.regionId]?.label || "").toLowerCase().includes(needle)
      || (REALM_BY_ID[landmark.realmId]?.shortName || "").toLowerCase().includes(needle));
    return matches
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
      .slice(0, needle ? 40 : 8);
  }, [landmarks, query]);

  // ---- Derived presentation ----
  const planeOffset = {
    left: (viewport.width - planeViewport.width) / 2,
    top: (viewport.height - planeViewport.height) / 2,
  };
  const projectMapCoord = (coord, lift = 0) => (atlasMode === "paper"
    ? atlasPaperWorldToScreen(camera, planeViewport, coord)
    : atlas3dProject(camera, planeViewport, coord, atlas3dTerrainHeightAt(coord, seed) + lift, seed));
  const displayedPartyCoord = atlasDisplayedPartyCoord(
    marchCoord,
    partyCoord,
    !!travelMarch?.visualDone,
  );
  const partyScreen = projectMapCoord(displayedPartyCoord, 1.4);
  const partyOffstage = partyScreen.x < -32
    || partyScreen.y < -32
    || partyScreen.x > planeViewport.width + 32
    || partyScreen.y > planeViewport.height + 32;
  const visibleHexesAcross = atlasMode === "3d"
    ? atlas3dCameraFrame(camera, planeViewport, seed).visibleWidth
    : viewport.width / camera.zoom;
  const kmAcross = Math.round(visibleHexesAcross * hexKilometers);
  const journeyBreaks = useMemo(
    () => (journey ? journeyLegBreaks(journey.fullPath, journey.legSteps) : []),
    [journey],
  );
  const showRegionLabels = zoomRatio >= 3;
  const showRealmLabels = zoomRatio < 1.45;
  const trackedAtSelection = !!(
    trackedCharacter
    && selectedCoord
    && trackedCharacter.pos.x === selectedCoord.x
    && trackedCharacter.pos.y === selectedCoord.y
  );

  // The dossier deliberately excludes camera state. React.memo can therefore
  // leave the expanded card and its scroll position untouched while a drag or
  // wheel gesture updates the map behind it.
  const detailEntry = useMemo(() => {
    if (!selectedCoord) return null;
    const realm = REALM_BY_ID[selectedLandmark?.realmId || selectedSurvey?.realmId] || null;
    const region = REGION_DEFINITIONS[selectedLandmark?.regionId || selectedSurvey?.regionId] || null;
    const province = (selectedLandmark?.provinceId && PROVINCE_BY_ID[selectedLandmark.provinceId])
      || PROVINCES.find((item) => item.seatLandmarkId === selectedLandmark?.id)
      || null;
    const factionId = selectedLandmark?.factionId
      || selectedLandmark?.controllingFactionId
      || province?.authorityFactionId
      || realm?.faction?.id;
    const faction = FACTION_BY_ID[factionId] || null;
    const culture = CULTURE_BY_REALM_ID[realm?.id] || null;
    const economy = ECONOMY_BY_REALM_ID[realm?.id] || null;
    const leader = faction?.leader || province?.governor || realm?.ruler;
    const routes = selectedLandmark ? atlasRoutesForLandmark(selectedLandmark) : [];
    const seaLanes = selectedLandmark?.kind === "port"
      ? CONTINENT_SEA_LANES.filter((lane) => lane.portIds?.includes(selectedLandmark.id))
      : [];
    const typeLabel = trackedAtSelection
      ? "Tracked playable character"
      : selectedLandmark
      ? atlasLandmarkTypeLabel(selectedLandmark)
      : (selectedSurvey ? (TERRAINS[selectedSurvey.terrain]?.label || "Open country") : "Unknown ground");
    const title = (trackedAtSelection ? trackedCharacter.name : null)
      || selectedLandmark?.name
      || (selectedSurvey ? `${TERRAINS[selectedSurvey.terrain]?.label || "Open country"} (${selectedCoord.x}, ${selectedCoord.y})` : "Uncharted");
    const cultureSummary = culture
      ? [culture.demonym, compactList(culture.languages, 2)].filter(Boolean).join(" · ")
      : realm?.biomeName;
    const tradeSummary = compactList(economy?.exports)
      || economy?.tradeNotes
      || compactList(region?.features);
    return {
      selectionKey,
      coord: { x: selectedCoord.x, y: selectedCoord.y },
      landmark: selectedLandmark,
      realm,
      region,
      province,
      faction,
      culture,
      economy,
      leader,
      routes,
      typeLabel,
      title,
      journey,
      knowledge: selectedLandmark ? landmarkKnowledge(state, selectedLandmark) : null,
      areaName: province?.name || region?.label || realm?.shortName || "Uncharted lands",
      cultureSummary,
      tradeSummary,
      routeSummary: compactList(routes.map((route) => route.name), 4) || "No charted road",
      seaLaneSummary: compactList(seaLanes.map((lane) => lane.name), 3),
      selectionIsParty: selectedCoord.x === partyCoord.x && selectedCoord.y === partyCoord.y,
      trackedDescription: trackedAtSelection
        ? `The Codex trail currently points toward ${trackedCharacter.name} here. It is a moving lead, not a guarantee; scrying can provide a clearer live reading.`
        : null,
    };
  }, [
    journey,
    partyCoord.x,
    partyCoord.y,
    selectedCoord?.x,
    selectedCoord?.y,
    selectedLandmark,
    selectedSurvey,
    selectionKey,
    state,
    trackedAtSelection,
    trackedCharacter,
  ]);

  const chartSelection = useCallback(() => {
    if (!detailEntry) return;
    const { coord, landmark } = detailEntry;
    const tile = getTile(state, coord.x, coord.y);
    onPick({
      x: coord.x,
      y: coord.y,
      key: `${coord.x},${coord.y}`,
      tile,
      name: landmark?.name || (trackedAtSelection ? trackedCharacter.name : null),
      knownBy: landmark ? landmarkKnowledge(state, landmark) : null,
    });
  }, [detailEntry, onPick, state, trackedAtSelection, trackedCharacter]);

  const travelSelection = useCallback(() => {
    if (!detailEntry?.journey || !onTravel || travelMarch?.id) return;
    onTravel({
      x: detailEntry.coord.x,
      y: detailEntry.coord.y,
      ...(detailEntry.landmark?.name ? { name: detailEntry.landmark.name } : {}),
    }, detailEntry.journey.fullPath);
  }, [detailEntry, onTravel, travelMarch?.id]);

  const activeFilterCount = (focusedRealmId ? 1 : 0) + (ATLAS_LAYERS.length - visibleLayers.size);
  const zoomControlCamera = (current, factor) => (
    atlasMode === "paper" || (factor < 1 && current.zoom * factor < windowFloor * 1.01)
      ? zoomAtlasPaperCamera(current, planeViewport, factor)
      : zoomAtlas3dCamera(current, planeViewport, factor, null, seed, pickAtlas3dGround)
  );

  return (
    <section
      className="world-atlas"
      aria-labelledby="world-atlas-title"
    >
      <div
        ref={stageRef}
        className="world-atlas__stage"
      role="application"
      aria-label={`Interactive map of ${CONTINENT.name}. Arrow keys pan, plus and minus zoom, zero fits the continent, Home returns to the party.`}
      aria-busy={(atlasMode === "3d" && sceneState === "loading") || (atlasMode === "paper" && !paperReady)}
      tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onKeyDown={handleKeyDown}
      >
        <div className="world-atlas__scene">
          <div
            className={`world-atlas__plane is-${atlasMode}${((atlasMode === "3d" && sceneState === "ready") || (atlasMode === "paper" && paperReady)) ? " is-ready" : ""}${sceneState === "error" ? " has-error" : ""}`}
            data-atlas-mode={atlasMode}
            style={{
              width: `${planeViewport.width}px`,
              height: `${planeViewport.height}px`,
              left: `${planeOffset.left}px`,
              top: `${planeOffset.top}px`,
            }}
          >
            <AtlasPaperMap
              ref={paperMapRef}
              active={atlasMode === "paper"}
              camera={camera}
              viewport={planeViewport}
              seed={seed}
              landmarks={landmarks}
              partyCoord={displayedPartyCoord}
              journey={journey}
              journeyBreaks={journeyBreaks}
              selection={selection}
              questMarkers={questMarkers}
              visibleLayers={visibleLayers}
              focusedRealmId={focusedRealmId}
              className={atlasMode === "paper" ? "is-active" : ""}
              onReady={() => setPaperReady(true)}
            />
            <WorldAtlas3DScene
              key={quality.id}
              ref={scene3dRef}
              camera={camera}
              viewport={planeViewport}
              seed={seed}
              quality={quality}
              focusedRealmId={focusedRealmId}
              journey={journey}
              journeyBreaks={journeyBreaks}
              seenKeys={seenKeys}
              worldTime={state?.time}
              active={sceneState === "loading" || atlasMode === "3d"}
              corridor={travelMarch?.path || null}
              onReady={(details) => {
                setSceneError("");
                setSceneState("ready");
                if (details?.restored && sceneRecoveryModeRef.current) {
                  setAtlasMode(sceneRecoveryModeRef.current);
                  sceneRecoveryModeRef.current = null;
                }
              }}
              onError={(message, details) => {
                const recoverable = details?.recoverable === true;
                sceneRecoveryModeRef.current = recoverable ? atlasMode : null;
                setSceneError(message || "The 3D atlas could not start.");
                setSceneState("error");
                setAtlasMode("paper");
                if (!recoverable) {
                  setCamera((current) => fitAtlasPaperCamera(current, planeViewport));
                }
              }}
            />
            {atlasMode === "3d" && sceneState !== "ready" && (
              <div className={`world-atlas__scene-status${sceneState === "error" ? " is-error" : ""}`} role="status" aria-live="polite">
                {sceneState === "error" ? (
                  <>
                    <strong>3D atlas unavailable</strong>
                    <span>{sceneError}</span>
                  </>
                ) : (
                  <>
                    <LoadingDots />
                    <strong>Raising the realm</strong>
                    <span>Preparing persistent terrain</span>
                  </>
                )}
              </div>
            )}
            {atlasMode === "paper" && !paperReady && (
              <div className="world-atlas__scene-status" role="status" aria-live="polite">
                <LoadingDots />
                <strong>Unrolling the chart</strong>
                <span>Inking roads and coastlines</span>
              </div>
            )}

            {travelMarch?.id && !travelMarch.visualDone && (
              <button
                type="button"
                className="world-atlas__march-skip"
                data-atlas-wheel-ignore="true"
                onPointerDown={stopStagePointer}
                onClick={() => marchTweenRef.current?.finish?.()}
              >
                <span>Party marching</span>
                <b>Skip</b>
              </button>
            )}

            {showRealmLabels && (
              <div className="world-atlas__realm-labels" aria-hidden="true">
                {REALMS.map((realm) => {
                  const screen = projectMapCoord(realm.center, 1.1);
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
              {COASTAL_FEATURES.filter((feature) => zoomRatio >= 2 || feature.kind === "sea").map((feature) => {
                const screen = projectMapCoord(feature.coord, feature.kind === "sea" ? 1.6 : 0.7);
                return (
                  <span key={feature.id} className={`is-${feature.kind}`} style={{ left: `${screen.x}px`, top: `${screen.y}px` }}>
                    {feature.name}
                  </span>
                );
              })}
            </div>

            {showRegionLabels && (
              <div className="world-atlas__region-labels" aria-hidden="true">
                {Object.values(REGION_DEFINITIONS).map((region) => {
                  const site = region.sites[Math.floor(region.sites.length / 2)];
                  if (!site) return null;
                  const screen = projectMapCoord(site, 0.8);
                  return (
                    <span key={region.id} style={{ left: `${screen.x}px`, top: `${screen.y}px` }}>
                      {region.label}
                    </span>
                  );
                })}
              </div>
            )}

            {sceneState === "ready" && journeyBreaks.map((stop, index) => {
              const screen = projectMapCoord(stop, 2.2);
              const offstage = screen.x < -20 || screen.y < -20 || screen.x > planeViewport.width + 20 || screen.y > planeViewport.height + 20;
              return (
                <span
                  key={`journey-stop-${stop.x},${stop.y}`}
                  className="world-atlas__leg-stop-label"
                  style={{ left: `${screen.x}px`, top: `${screen.y}px` }}
                  hidden={offstage}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
              );
            })}

            <div className="world-atlas__marker-layer" role="group" aria-label={`${landmarks.length} known landmarks`}>
              {landmarks.map((landmark) => {
                const selected = selection?.kind === "landmark" && selection.id === landmark.id;
                const visible = atlasPaperMarkerVisible(landmark, {
                  zoomRatio,
                  viewportWidth: planeViewport.width,
                  visibleLayers,
                  focusedRealmId,
                  selectedLandmarkId: selection?.kind === "landmark" ? selection.id : null,
                });
                const screen = visible ? projectMapCoord(landmark.coord, 1.6) : { x: -10000, y: -10000 };
                const offstage = !visible || screen.x < -40 || screen.y < -40 || screen.x > planeViewport.width + 40 || screen.y > planeViewport.height + 40;
                const atParty = landmark.coord.x === partyCoord.x && landmark.coord.y === partyCoord.y;
                const poiIconKey = poiIconKeyForLandmark(landmark);
                return (
                  <button
                    key={landmark.id}
                    type="button"
                    hidden={offstage || atParty}
                    className={`world-atlas__marker is-${landmark.knowledgeTier} is-category-${atlasLandmarkLayer(landmark)} ${poiIconKey ? "has-poi-icon" : ""} ${selected ? "is-selected" : ""} ${landmark.capitalOfRealmId ? "is-capital" : ""} ${landmark.quest ? "has-quest" : ""}`}
                    style={{ left: `${screen.x}px`, top: `${screen.y}px` }}
                    onClick={(event) => {
                      if (atlasSelectionClickAllowed(event, gestureRef.current)) inspectLandmark(landmark);
                    }}
                    aria-label={`Inspect ${landmark.name}, ${atlasLandmarkTypeLabel(landmark)}, ${REGION_DEFINITIONS[landmark.regionId]?.label || REALM_BY_ID[landmark.realmId]?.shortName || "uncharted lands"}, ${ATLAS_KNOWLEDGE_LABELS[landmark.knowledgeTier]}`}
                    aria-pressed={selected}
                    aria-controls="world-atlas-detail"
                  >
                    <span aria-hidden="true">
                      {poiIconKey
                        ? <PoiIcon iconKey={poiIconKey} size={landmark.capitalOfRealmId ? 43 : 35} marketTier={landmark.marketTier} />
                        : (ATLAS_LANDMARK_GLYPHS[landmark.kind] || "◆")}
                    </span>
                    {landmark.quest && <i className="world-atlas__quest-pip" aria-hidden="true">!</i>}
                    {(zoomRatio >= 1.5 || landmark.capitalOfRealmId || selected) && (
                      <b aria-hidden="true">{landmark.name}</b>
                    )}
                  </button>
                );
              })}
              {questMarkers.map((quest) => {
                const screen = projectMapCoord(quest.coord, 1.8);
                const offstage = screen.x < -40 || screen.y < -40 || screen.x > planeViewport.width + 40 || screen.y > planeViewport.height + 40;
                return (
                  <button
                    key={quest.id}
                    type="button"
                    hidden={offstage}
                    className="world-atlas__marker is-quest"
                    style={{ left: `${screen.x}px`, top: `${screen.y}px` }}
                    onClick={(event) => {
                      if (atlasSelectionClickAllowed(event, gestureRef.current)) {
                        setSelection({ kind: "point", x: quest.coord.x, y: quest.coord.y });
                      }
                    }}
                    aria-label={`Quest objective: ${quest.title}`}
                  >
                    <span aria-hidden="true">✦</span>
                    <b aria-hidden="true">{quest.title}</b>
                  </button>
                );
              })}
              {trackedCharacter && (() => {
                const screen = projectMapCoord(trackedCharacter.pos, 1.8);
                const offstage = screen.x < -40 || screen.y < -40 || screen.x > planeViewport.width + 40 || screen.y > planeViewport.height + 40;
                return (
                  <button
                    type="button"
                    hidden={offstage}
                    className={`world-atlas__marker is-tracked-character${trackedAtSelection ? " is-selected" : ""}`}
                    style={{ left: `${screen.x}px`, top: `${screen.y}px` }}
                    onClick={(event) => {
                      if (atlasSelectionClickAllowed(event, gestureRef.current)) centerOnTrackedCharacter();
                    }}
                    aria-label={`Tracked lead for ${trackedCharacter.name}`}
                    aria-pressed={trackedAtSelection}
                    aria-controls="world-atlas-detail"
                  >
                    <span aria-hidden="true">⌖</span>
                    <b aria-hidden="true">{trackedCharacter.name}</b>
                  </button>
                );
              })()}
            </div>

            {selection?.kind === "point" && (() => {
              const screen = projectMapCoord(selectedCoord, 1.3);
              return (
                <span className="world-atlas__point-pin" style={{ left: `${screen.x}px`, top: `${screen.y}px` }} aria-hidden="true">
                  <i /><b />
                </span>
              );
            })()}

            <button
              type="button"
              hidden={partyOffstage}
              className={`world-atlas__party${travelMarch?.id ? " is-marching" : ""}`}
              disabled={!!travelMarch?.id}
              style={{ left: `${partyScreen.x}px`, top: `${partyScreen.y}px` }}
              onClick={(event) => {
                if (!atlasSelectionClickAllowed(event, gestureRef.current)) return;
                if (partyLandmark) inspectLandmark(partyLandmark);
                else setSelection({ kind: "point", x: partyCoord.x, y: partyCoord.y });
              }}
              aria-label={travelMarch?.id
                ? "Party marching along the selected route"
                : partyLandmark
                ? `Inspect ${partyLandmark.name} at your current position`
                : `Inspect your current position on ${CONTINENT.name}`}
              aria-pressed={!!(
                (partyLandmark && selection?.kind === "landmark" && selection.id === partyLandmark.id)
                || (!partyLandmark && selection?.kind === "point" && selectedCoord?.x === partyCoord.x && selectedCoord?.y === partyCoord.y)
              )}
              aria-controls="world-atlas-detail"
            >
              <i aria-hidden="true" />
              <span aria-hidden="true">{travelMarch?.id ? "Marching" : "You"}</span>
            </button>
          </div>
        </div>

        <div className="world-atlas__chrome-top" data-atlas-wheel-ignore="true" onPointerDown={stopStagePointer}>
          <div className="world-atlas__topline">
            <div className="world-atlas__title-chip">
              <small>Wayfinder's survey</small>
              <h3 id="world-atlas-title">{CONTINENT.name}</h3>
            </div>
            <button
              type="button"
              className="world-atlas__search-pill"
              onClick={() => {
                setSearchOpen((open) => !open);
                setFiltersOpen(false);
              }}
              aria-expanded={searchOpen}
              aria-controls="world-atlas-search"
              aria-label={`Search ${landmarks.length} charted places`}
            >
              <i aria-hidden="true">⌕</i>
              <span>Find a place</span>
            </button>
            <button
              type="button"
              className="world-atlas__filter-pill"
              onClick={() => {
                setFiltersOpen((open) => !open);
                setSearchOpen(false);
              }}
              aria-expanded={filtersOpen}
              aria-controls="world-atlas-filters"
              aria-label={activeFilterCount > 0 ? `Map filters, ${activeFilterCount} active` : "Map filters"}
            >
              <i aria-hidden="true">☷</i>
              <span>Map filters</span>
              {activeFilterCount > 0 && <b aria-hidden="true">{activeFilterCount}</b>}
            </button>
            {toolbarActions && <div className="world-atlas__toolbar-actions">{toolbarActions}</div>}
          </div>

          {filtersOpen && (
            <aside id="world-atlas-filters" className="world-atlas__filters" aria-label="Map filters">
              <header>
                <span><small>Map display</small><b>Choose what earns attention</b></span>
                <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close map filters">×</button>
              </header>
              <section>
                <h4>Focus a realm</h4>
                <nav className="world-atlas__chips world-atlas__chips--realms" aria-label="Five biome realms">
                  <button
                    type="button"
                    className="is-all-realms"
                    aria-pressed={!focusedRealmId}
                    onClick={() => {
                      setFocusedRealmId(null);
                      showPaperOverview();
                      setFiltersOpen(false);
                    }}
                  >
                    <i aria-hidden="true">◎</i><span>Whole continent</span>
                  </button>
                  {REALMS.map((realm) => (
                    <button
                      key={realm.id}
                      type="button"
                      className={`is-${realm.id}`}
                      aria-pressed={focusedRealmId === realm.id}
                      onClick={() => inspectRealm(realm)}
                      aria-label={`Focus ${realm.shortName}`}
                    >
                      <i aria-hidden="true" /><span>{realm.shortName}</span>
                    </button>
                  ))}
                </nav>
              </section>
              <section>
                <h4>Show destinations</h4>
                <div className="world-atlas__chips world-atlas__chips--layers" role="group" aria-label="Atlas marker layers">
                  {ATLAS_LAYERS.map((layer) => (
                    <button key={layer.id} type="button" aria-pressed={visibleLayers.has(layer.id)} onClick={() => toggleLayer(layer.id)}>
                      <i aria-hidden="true">{layer.glyph}</i><span>{layer.label}</span>
                    </button>
                  ))}
                </div>
              </section>
              <section className="world-atlas__map-key">
                <h4>Map key</h4>
                <div>
                  <span><i className="is-road" />Great road</span>
                  <span><i className="is-sea-lane" />Sea passage</span>
                  <span><i className="is-trail" />Travelled trail</span>
                  <span><i className="is-journey" />Next leg</span>
                  <span><i className="is-continuation" />Later legs</span>
                  <span><i className="is-character" />Tracked character</span>
                  <span><PoiTierMarker marketTier="royal" size={12} />Royal shop</span>
                  <span><PoiTierMarker marketTier="mastercraft" size={12} />Mastercraft</span>
                </div>
              </section>
            </aside>
          )}

          {searchOpen && (
            <div id="world-atlas-search" className="world-atlas__search" role="search">
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.key === "Escape" && setSearchOpen(false)}
                placeholder="Find a city, port, fort, or shrine…"
                aria-label={`Search ${CONTINENT.name} landmarks`}
              />
              <ul className="world-atlas__search-results">
                {searchResults.map((landmark) => {
                  const poiIconKey = poiIconKeyForLandmark(landmark);
                  return (
                    <li key={landmark.id}>
                      <button type="button" onClick={() => pickSearchResult(landmark)}>
                        <i aria-hidden="true">
                          {poiIconKey
                            ? <PoiIcon iconKey={poiIconKey} size={26} marketTier={landmark.marketTier} />
                            : (ATLAS_LANDMARK_GLYPHS[landmark.kind] || "◆")}
                        </i>
                        <span>
                          <b>{landmark.name}</b>
                          <small>
                            {atlasLandmarkTypeLabel(landmark)}
                            {" · "}
                            {REGION_DEFINITIONS[landmark.regionId]?.label || REALM_BY_ID[landmark.realmId]?.shortName || "Uncharted lands"}
                            {Number.isFinite(landmark.distance) ? ` · ${(landmark.distance * hexKilometers).toLocaleString()} km` : ""}
                          </small>
                        </span>
                        <em className={`is-${landmark.knowledgeTier}`}>{KNOWLEDGE_SHORT_LABELS[landmark.knowledgeTier]}</em>
                      </button>
                    </li>
                  );
                })}
                {searchResults.length === 0 && <li className="is-empty">No charted place matches that name.</li>}
              </ul>
            </div>
          )}
        </div>

        <div className="world-atlas__map-controls" data-atlas-wheel-ignore="true" onPointerDown={stopStagePointer}>
          <div role="group" aria-label="Map zoom controls">
            <button type="button" onClick={() => setCamera((current) => zoomControlCamera(current, 1.4))} disabled={camera.zoom >= ATLAS_3D_MAX_ZOOM * 0.99} aria-label="Zoom map in">+</button>
            <button type="button" onClick={showPaperOverview} aria-label="Fit the whole continent">{Math.round(zoomRatio * 100)}%</button>
            <button type="button" onClick={() => setCamera((current) => zoomControlCamera(current, 1 / 1.4))} disabled={camera.zoom <= fit * 1.01} aria-label="Zoom map out">−</button>
          </div>
          <button type="button" className="world-atlas__locate" onClick={centerOnParty} aria-label="Center map on the party">
            <i aria-hidden="true">◎</i><span>Party</span>
          </button>
          {trackedCharacter && (
            <button type="button" className="world-atlas__locate" onClick={centerOnTrackedCharacter} aria-label={`Center map on tracked character ${trackedCharacter.name}`} title={trackedCharacter.name}>
              <i aria-hidden="true">⌖</i><span>Track</span>
            </button>
          )}
        </div>

        <div className="world-atlas__chrome-bottom" data-atlas-wheel-ignore="true">
        <div className="world-atlas__foot" onPointerDown={stopStagePointer}>
          <div className="world-atlas__scale" role="img" aria-label={`View spans about ${kmAcross} kilometers; ${hexKilometers} kilometers per travel hex`}>
            <i aria-hidden="true" />
            <span>≈ {kmAcross.toLocaleString()} km across</span>
          </div>
        </div>

        {detailEntry && (
          <AtlasPlaceCard
            key={detailEntry.selectionKey}
            entry={detailEntry}
            onChart={chartSelection}
            onTravel={onTravel ? travelSelection : null}
            travelDisabled={!!travelMarch?.id}
          />
        )}
        </div>
      </div>
    </section>
  );
}
