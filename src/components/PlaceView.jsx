import React, { useMemo, useState } from "react";
import { Icon } from "./Icon.jsx";
import { colors } from "./tokens.js";
import { currentPlace, currentNode, canLeave, nodeTile } from "../engine/place.js";
import { buildingForTile, isBuildingOpen } from "../data/town.js";
import { biomeVisual, terrainVisual } from "../data/visual-assets.js";
import { coinsToCopper, formatCopper } from "../engine/economy.js";
import { formatDate, formatTime } from "../engine/time.js";
import {
  buildPlaceViewport,
  cityDirection,
} from "./exploration/placeModel.js";
import { MapCanvas } from "./exploration/MapCanvas.jsx";
import { buildCityMapScene } from "./exploration/mapSceneModel.js";
import cityArt from "../assets/generated/scene-whitemarch-v2.webp";
import "./exploration/exploration.css";

const NODE_GLYPHS = {
  gate: "◇", hall: "▤", market: "◈", smithy: "⚒", healer: "+", shrine: "✦",
  dock: "≈", stair: "≋", plaza: "◆", court: "§", prison: "▦", slavemarket: "⛓",
  palace: "♜", barracks: "⚔", stable: "♞", yard: "□", town: "⌂", bldg: "⌂", hidden: "?",
};

const DISTRICT_COLORS = {
  "Crown Gate Ward": "#f0bd59",
  "The Caravanserai": "#dd8f50",
  "The Grand Market": "#7edfb8",
  "The Low Wards": "#ce7d83",
  "The River Docks": "#6bc5df",
  "The Guild Court": "#a9a0e9",
  "The Chain Ward": "#d48e9d",
  "The Citadel": "#f1df8b",
};

function displayType(type) {
  if (!type) return "place";
  if (type === "bldg") return "building";
  if (type === "slavemarket") return "auction steps";
  return type;
}

function nodeGlyph(node) {
  return NODE_GLYPHS[node?.type] || "•";
}

function PlaceHeader({ state, place, node, onClose, onGuide }) {
  const vitality = state.character.vitality ?? 0;
  const vitalityMax = Math.max(1, state.character.vitalityMax ?? vitality);
  const resolve = state.character.resolve ?? 0;
  const resolveMax = Math.max(1, state.character.resolveMax ?? resolve);
  const coin = coinsToCopper(state.character.inventory?.coins || {});
  return (
    <header className="rpg-map-header">
      <button onClick={onClose} className="rpg-square-button" aria-label="Return to story"><Icon name="arrowLeft" size={17} color={colors.parchmentMuted} /></button>
      <div className="rpg-location-lockup">
        <span>{place.name} · city exploration</span>
        <h1>{node.name}</h1>
        <small>{formatDate(state.time)} · {formatTime(state.time)} · {node.district}</small>
      </div>
      <div className="rpg-vitals" aria-label="Party status">
        <div className="rpg-vital rpg-vital--hp" role="meter" aria-label="Health" aria-valuemin="0" aria-valuemax={Math.ceil(vitalityMax)} aria-valuenow={Math.ceil(vitality)}><span>HP</span><i aria-hidden="true"><b style={{ width: `${Math.min(100, vitality / vitalityMax * 100)}%` }} /></i><strong>{Math.ceil(vitality)}/{Math.ceil(vitalityMax)}</strong></div>
        <div className="rpg-vital rpg-vital--mp" role="meter" aria-label="Resolve" aria-valuemin="0" aria-valuemax={Math.ceil(resolveMax)} aria-valuenow={Math.ceil(resolve)}><span>RP</span><i aria-hidden="true"><b style={{ width: `${Math.min(100, resolve / resolveMax * 100)}%` }} /></i><strong>{Math.ceil(resolve)}/{Math.ceil(resolveMax)}</strong></div>
        <div className="rpg-coin"><span>◆</span>{formatCopper(coin)}</div>
      </div>
      <button onClick={onGuide} className="rpg-square-button" aria-label="Open city guide"><Icon name="map" size={17} color="#fff4c7" /></button>
    </header>
  );
}

function CityGrid({ model, current, selected, onPick, onCenter, onGuide, night }) {
  const selectedDirection = selected && cityDirection(model.currentPosition, model.selectedPosition);
  const mapScene = useMemo(() => buildCityMapScene({ model, current, selected, districtColors: DISTRICT_COLORS, night }), [model, current, selected, night]);
  const accessibleCells = useMemo(() => model.viewport
    .filter((cell) => cell.node && cell.node.id !== current.id)
    .map((cell) => ({ key: cell.key, label: `${cell.node.name}, ${cell.node.district}, ${displayType(cell.node.type)}` })), [model, current.id]);

  function selectMapCell(key) {
    const node = model.viewport.find((cell) => cell.key === key)?.node;
    if (node && node.id !== current.id) onPick(node);
  }

  return (
    <main className={`rpg-world-stage place-world-stage canvas-city-stage ${night ? "is-night" : ""}`}>
      <MapCanvas scene={mapScene} onSelect={selectMapCell} label="Interactive Whitemarch city map" choices={accessibleCells} selectedKey={model.selectedPosition ? `${model.selectedPosition.x},${model.selectedPosition.y}` : ""} />
      <div className="rpg-quickbar place-quickbar">
        <button onClick={onGuide} aria-label="Open city guide"><Icon name="map" size={15} color="#fff4c7" /><span>Guide</span></button>
        <button onClick={onCenter} aria-label="Center map on current location"><span className="place-center-glyph" aria-hidden="true">◆</span><span>Center</span></button>
      </div>
      {selected && !model.selectedVisible && <div className="rpg-offscreen-target place-offscreen-target"><span>{nodeGlyph(selected)}</span><b>{selected.name}</b><small>{selectedDirection?.replace("-", " ")}</small></div>}

      <div className="place-ward-chip"><span style={{ background: DISTRICT_COLORS[current.district] }} />{current.district}</div>
    </main>
  );
}

function LocationPanel({ state, place, current, selected, model, time, onCenter, onWalk, onLeave, onService, onGuide }) {
  const focus = selected || current;
  const focusTile = nodeTile(place, focus);
  const building = buildingForTile(focusTile);
  const open = building ? isBuildingOpen(building, time?.hour ?? 12) : false;
  const isCurrent = focus.id === current.id;
  const route = isCurrent ? [current.id] : model.route;
  const routeNodes = (route || []).map((id) => place.nodes[id]).filter(Boolean);
  const wardCount = new Set(routeNodes.map((routeNode) => routeNode.district)).size;
  const focusVisual = terrainVisual(focus.terrain);
  const rewardTitle = building ? (open ? "Service available" : "Closed for now") : isCurrent ? "Current landmark" : "Route prepared";
  const rewardValue = building?.label || (isCurrent ? focus.district : `${Math.max(0, routeNodes.length - 1)} city stops`);
  return (
    <section className="rpg-command-panel place-command-panel">
      <div className="rpg-party-card place-party-card">
        <div className="rpg-party-portrait place-district-seal" style={{ "--district-color": DISTRICT_COLORS[current.district] || "#f0c45e" }}>{nodeGlyph(current)}</div>
        <div><small>Current ward</small><b>{current.district}</b><span>{place.name} · {displayType(current.type)}</span></div>
        <i>CITY</i>
      </div>

      <div className="rpg-command-scroll">
        <div className="rpg-destination place-destination" aria-live="polite">
          <div className="rpg-destination-banner place-destination-banner" style={{ backgroundImage: `linear-gradient(180deg, transparent, rgba(5,13,34,.94)), url(${cityArt})`, "--focus-accent": focusVisual.accent }}>
            {!isCurrent && <button onClick={onCenter} aria-label="Clear city destination"><Icon name="x" size={13} color="#fff7d6" /></button>}
            <span>{isCurrent ? "You are here" : `Route · ${cityDirection(model.currentPosition, model.selectedPosition).replace("-", " ")}`}</span>
            <h2>{focus.name}</h2>
            <small>{focus.district} · {displayType(focus.type)} · {focus.access || "public"}</small>
          </div>

          <p className="rpg-destination-copy place-destination-copy">{focus.description}</p>

          <div className="rpg-reward-card place-service-card" style={{ "--reward-art": `url(${cityArt})` }}>
            <div><small>{rewardTitle}</small><b>{rewardValue}</b></div>
            <span>{building ? (open ? "+" : "×") : isCurrent ? "◆" : "›"}</span>
          </div>

          {!isCurrent && route ? (
            <>
              <div className="rpg-route-stats place-route-stats">
                <div><small>Stops</small><b>{route.length - 1}</b><span>landmarks</span></div>
                <div><small>Wards</small><b>{wardCount}</b><span>crossed</span></div>
                <div><small>Access</small><b>{focus.access === "public" ? "Open" : "Check"}</b><span>{focus.access || "public"}</span></div>
              </div>
              <div className="place-itinerary" aria-label="Planned city route">
                {routeNodes.map((routeNode, index) => <span key={routeNode.id} className={index === 0 ? "is-start" : index === routeNodes.length - 1 ? "is-end" : ""} title={routeNode.name}><i>{nodeGlyph(routeNode)}</i><small>{routeNode.name}</small></span>)}
              </div>
            </>
          ) : !isCurrent ? <div className="rpg-route-blocked">No walkable city route reaches this landmark.</div> : (
            <div className="rpg-map-tap-hint rpg-map-tap-hint--city" aria-label="Tap a landmark on the map to preview a street route">
              <span>1</span><b>Tap a landmark</b><i>→</i><span>2</span><b>Confirm the walk</b>
            </div>
          )}
        </div>
      </div>

      <div className="rpg-command-actions place-command-actions">
        {isCurrent && building && <button onClick={() => open && onService?.(current, building)} disabled={!open} className="place-enter-button"><span aria-hidden="true">{open ? "↗" : "×"}</span>{open ? `Enter ${building.label}` : `${building.label} opens at ${building.hours?.open}:00`}</button>}
        {isCurrent && canLeave(state) && <button onClick={onLeave} className="place-leave-button">Beyond the Crown Gate · leave {place.name}</button>}
        {!isCurrent && <button onClick={onWalk} disabled={!route || route.length < 2} className="rpg-travel-button"><span aria-hidden="true">✓</span>{route ? `Walk to ${focus.name}` : "Route unavailable"}<small>{route ? `${route.length - 1} stops` : ""}</small></button>}
        {isCurrent && !building && !canLeave(state) && <button onClick={onGuide} className="rpg-travel-button place-guide-button"><span aria-hidden="true">◇</span>Choose from the city guide<small>{Object.keys(place.nodes).length} landmarks</small></button>}
      </div>
    </section>
  );
}

function CityGuide({ place, current, landmarks, onClose, onPick }) {
  return (
    <div className="rpg-overlay place-guide" role="dialog" aria-modal="true" aria-label="Whitemarch city guide" style={{ "--reward-art": `url(${cityArt})` }}>
      <div className="rpg-overlay-head"><div><span className="rpg-kicker">Wards and landmarks</span><h2>{place.name} city guide</h2><p>Choose any landmark to chart a street route from {current.name}.</p></div><button onClick={onClose} className="rpg-square-button" aria-label="Close city guide"><Icon name="x" size={15} color="#fff4c7" /></button></div>
      <div className="rpg-ledger-grid rpg-ledger-grid--places place-guide-grid">
        {landmarks.map((landmark) => (
          <button key={landmark.id} onClick={() => onPick(landmark)} className={`rpg-place-card place-guide-card ${landmark.id === current.id ? "is-current" : ""}`} style={{ "--place-art": `url(${cityArt})`, "--place-accent": DISTRICT_COLORS[landmark.district] || "#f0c45e" }}>
            <span>{nodeGlyph(landmark)}</span>
            <div><small>{landmark.district} · {displayType(landmark.type)}</small><b>{landmark.name}</b><em>{landmark.id === current.id ? "Current location" : landmark.service ? "Service landmark" : landmark.access || "public"}</em></div>
            <i>›</i>
          </button>
        ))}
      </div>
    </div>
  );
}

export function PlaceView({ state, time, onMove, onLeave, onService, onClose }) {
  const place = currentPlace(state);
  const current = currentNode(state);
  const [selectedId, setSelectedId] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const selected = selectedId && place?.nodes?.[selectedId] ? place.nodes[selectedId] : null;
  const model = useMemo(() => place && current ? buildPlaceViewport(place, current.id, selected?.id) : null, [place, current, selected]);
  if (!place || !current || !model) return null;

  const placeVisual = biomeVisual(place.biomeId || "far-wild");
  const hour = time?.hour ?? 12;

  function pick(destination) {
    setSelectedId(destination.id === current.id ? null : destination.id);
    setGuideOpen(false);
  }

  function walkRoute() {
    if (!selected || !model.route || model.route.length < 2) return;
    onMove?.(selected.id, model.route.slice(1));
    setSelectedId(null);
  }

  return (
    <div className="exploration-shell rpg-exploration-shell place-shell" style={{ "--rpg-accent": placeVisual.accent, "--rpg-primary": placeVisual.primary, "--rpg-deep": placeVisual.deep }}>
      <PlaceHeader state={state} place={place} node={current} onClose={onClose} onGuide={() => setGuideOpen(true)} />
      <div className="rpg-exploration-body place-exploration-body">
        <CityGrid model={model} current={current} selected={selected} onPick={pick} onCenter={() => setSelectedId(null)} onGuide={() => setGuideOpen(true)} night={hour < 6 || hour >= 20} />
        <LocationPanel state={state} place={place} current={current} selected={selected} model={model} time={time} onCenter={() => setSelectedId(null)} onWalk={walkRoute} onLeave={onLeave} onService={onService} onGuide={() => setGuideOpen(true)} />
      </div>
      {guideOpen && <CityGuide place={place} current={current} landmarks={model.landmarks} onClose={() => setGuideOpen(false)} onPick={pick} />}
    </div>
  );
}
