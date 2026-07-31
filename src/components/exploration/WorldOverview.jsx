import React, { useMemo, useRef, useState } from "react";
import {
  WORLD_OVERVIEW_VIEWBOX,
  buildWorldOverviewModel,
  clampWorldOverviewCamera,
  overviewCameraForRealm,
  overviewCameraViewBox,
  overviewDestinationTarget,
  panWorldOverviewCamera,
  zoomWorldOverviewCamera,
} from "./worldOverviewModel.js";

const FIT_CAMERA = Object.freeze({
  x: WORLD_OVERVIEW_VIEWBOX.width / 2,
  y: WORLD_OVERVIEW_VIEWBOX.height / 2,
  zoom: 1,
});

const PLACE_FILTERS = Object.freeze([
  Object.freeze({ id: "all", label: "Everything" }),
  Object.freeze({ id: "settlements", label: "Settlements" }),
  Object.freeze({ id: "strongholds", label: "Strongholds" }),
  Object.freeze({ id: "sacred", label: "Sacred sites" }),
  Object.freeze({ id: "mysteries", label: "Ruins & wonders" }),
  Object.freeze({ id: "wilds", label: "Wild places" }),
]);

const PLACE_GLYPHS = Object.freeze({
  city: "◆",
  town: "●",
  village: "•",
  port: "⚓",
  fortress: "♜",
  ruin: "◇",
  wonder: "✦",
  tower: "▲",
  monastery: "✛",
  sanctuary: "✛",
  shrine: "✛",
  temple: "✛",
  lake: "≈",
});

function pointsAttribute(points = []) {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
}

function pathAttribute(points = []) {
  if (!points.length) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
}

function placeTypeLabel(place) {
  const labels = {
    city: "City",
    town: "Town",
    village: "Village",
    port: "Port",
    fortress: "Stronghold",
    ruin: "Ruin",
    wonder: "Wonder",
    tower: "Tower",
    monastery: "Monastery",
    sanctuary: "Sanctuary",
    shrine: "Shrine",
    temple: "Temple",
    lake: "Lake",
  };
  return labels[place?.kind] || "Destination";
}

function knowledgeLabel(place) {
  if (place.current) return "Party here";
  if (place.visited) return "Visited";
  if (place.charted) return "Charted";
  if (place.knownBy === "reputation") return "Known by reputation";
  return "Known by legend";
}

function markerClass(place, selected) {
  return [
    "world-overview__marker",
    place.current ? "is-current" : "",
    selected ? "is-selected" : "",
  ].filter(Boolean).join(" ");
}

function markerPosition(point, viewBox) {
  return {
    left: `${((point.x - viewBox.x) / viewBox.width) * 100}%`,
    top: `${((point.y - viewBox.y) / viewBox.height) * 100}%`,
  };
}

function pointInsideView(point, viewBox) {
  const marginX = viewBox.width * 0.04;
  const marginY = viewBox.height * 0.05;
  return point.x >= viewBox.x - marginX
    && point.x <= viewBox.x + viewBox.width + marginX
    && point.y >= viewBox.y - marginY
    && point.y <= viewBox.y + viewBox.height + marginY;
}

function initialSelection(model, inspectedCoord) {
  const inspected = inspectedCoord && model.places.find(
    (place) => place.coord.x === inspectedCoord.x && place.coord.y === inspectedCoord.y,
  );
  return inspected?.id || model.places.find((place) => place.current)?.id || "whitemarch";
}

export function WorldOverview({ state, inspectedCoord, onSelect, onClose }) {
  const model = useMemo(() => buildWorldOverviewModel(state), [state]);
  const [camera, setCamera] = useState(FIT_CAMERA);
  const [selectedId, setSelectedId] = useState(() => initialSelection(model, inspectedCoord));
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const stageRef = useRef(null);
  const dragRef = useRef(null);

  const viewBox = overviewCameraViewBox(camera);
  const selected = model.places.find((place) => place.id === selectedId)
    || model.places.find((place) => place.current)
    || model.places[0];
  const normalizedQuery = query.trim().toLowerCase();
  const visiblePlaces = model.places.filter((place) => {
    const categoryMatches = filter === "all" || place.category === filter;
    if (!categoryMatches) return false;
    if (!normalizedQuery) return true;
    return [
      place.name,
      place.realmName,
      place.provinceName,
      place.factionName,
      place.kind,
      ...place.interests,
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedQuery));
  });
  const visibleIds = new Set(visiblePlaces.map((place) => place.id));
  const placesInView = visiblePlaces.filter((place) => pointInsideView(place.point, viewBox));
  const realmButtonsVisible = camera.zoom < 1.55 && !normalizedQuery && filter === "all";

  function focusPlace(place) {
    setCamera(clampWorldOverviewCamera({ x: place.point.x, y: place.point.y, zoom: Math.max(camera.zoom, 2.25) }));
  }

  function handlePointerDown(event) {
    if (event.button !== 0 || event.target.closest?.("button, input")) return;
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event) {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const width = stageRef.current?.clientWidth || 1;
    const height = stageRef.current?.clientHeight || 1;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    dragRef.current = { ...drag, x: event.clientX, y: event.clientY };
    setCamera((current) => {
      const box = overviewCameraViewBox(current);
      return panWorldOverviewCamera(current, {
        x: -(dx / width) * box.width,
        y: -(dy / height) * box.height,
      });
    });
  }

  function endPointer(event) {
    if (dragRef.current?.id !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function handleWheel(event) {
    event.preventDefault();
    setCamera((current) => zoomWorldOverviewCamera(current, event.deltaY < 0 ? 1.2 : 1 / 1.2));
  }

  function handleKeyDown(event) {
    const box = overviewCameraViewBox(camera);
    const stepX = box.width * 0.08;
    const stepY = box.height * 0.08;
    if (event.key === "ArrowLeft") setCamera((current) => panWorldOverviewCamera(current, { x: -stepX }));
    else if (event.key === "ArrowRight") setCamera((current) => panWorldOverviewCamera(current, { x: stepX }));
    else if (event.key === "ArrowUp") setCamera((current) => panWorldOverviewCamera(current, { y: -stepY }));
    else if (event.key === "ArrowDown") setCamera((current) => panWorldOverviewCamera(current, { y: stepY }));
    else if (event.key === "+" || event.key === "=") setCamera((current) => zoomWorldOverviewCamera(current, 1.2));
    else if (event.key === "-") setCamera((current) => zoomWorldOverviewCamera(current, 1 / 1.2));
    else if (event.key === "0") setCamera(FIT_CAMERA);
    else if (event.key === "Escape") onClose?.();
    else return;
    event.preventDefault();
  }

  function chooseDestination() {
    const target = overviewDestinationTarget(selected);
    if (target) onSelect?.(target);
  }

  return (
    <section className="world-overview" role="dialog" aria-modal="true" aria-labelledby="world-overview-title">
      <header className="world-overview__header">
        <div>
          <div className="world-overview__eyebrow">The known world</div>
          <h1 id="world-overview-title">Avarra from above</h1>
          <p>Read the land, follow its roads, and choose what looks worth the journey.</p>
        </div>
        <button className="world-overview__close" type="button" onClick={onClose} aria-label="Close world overview">×</button>
      </header>

      <div className="world-overview__toolbar">
        <label className="world-overview__search">
          <span>Find on map</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="A ruin, port, faction, or place…"
            aria-label="Search places on the world map"
          />
        </label>
        <div className="world-overview__filters" role="group" aria-label="Filter atlas places">
          {PLACE_FILTERS.map((item) => {
            const count = item.id === "all"
              ? model.places.length
              : model.places.filter((place) => place.category === item.id).length;
            return (
              <button
                key={item.id}
                type="button"
                className={filter === item.id ? "is-active" : ""}
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
              >
                {item.label}<span>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="world-overview__body">
        <div
          ref={stageRef}
          className="world-overview__stage"
          role="application"
          aria-label="World overview of Avarra"
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onWheel={handleWheel}
          onKeyDown={handleKeyDown}
        >
          <svg
            className="world-overview__map"
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <defs>
              <clipPath id="world-overview-land-clip">
                <polygon points={pointsAttribute(model.coastline)} />
              </clipPath>
              <filter id="world-overview-relief-shadow" x="-20%" y="-20%" width="140%" height="150%">
                <feDropShadow dx="0" dy="7" stdDeviation="9" floodColor="#08181d" floodOpacity=".68" />
              </filter>
              <pattern id="world-overview-paper-grain" width="28" height="28" patternUnits="userSpaceOnUse">
                <circle cx="5" cy="7" r="1" fill="rgba(255,255,255,.045)" />
                <circle cx="19" cy="21" r=".8" fill="rgba(0,0,0,.09)" />
              </pattern>
            </defs>
            <rect className="world-overview__sea" x="0" y="0" width={WORLD_OVERVIEW_VIEWBOX.width} height={WORLD_OVERVIEW_VIEWBOX.height} />
            <g filter="url(#world-overview-relief-shadow)">
              <polygon className="world-overview__coast" points={pointsAttribute(model.coastline)} />
              <g clipPath="url(#world-overview-land-clip)">
                {model.realms.map((realm) => (
                  <ellipse
                    key={realm.id}
                    className={`world-overview__realm-fill world-overview__realm-fill--${realm.id}`}
                    cx={realm.point.x}
                    cy={realm.point.y}
                    rx={realm.radiusX * 1.05}
                    ry={realm.radiusY * 1.08}
                    fill={realm.visual.fill}
                  />
                ))}
                <rect className="world-overview__grain" x="0" y="0" width={WORLD_OVERVIEW_VIEWBOX.width} height={WORLD_OVERVIEW_VIEWBOX.height} fill="url(#world-overview-paper-grain)" />
                <path className="world-overview__mountains" d={pathAttribute(model.mountainSpine.points)} />
                {model.northernRidges.map((ridge) => (
                  <path key={ridge.id} className="world-overview__ridge" d={pathAttribute(ridge.points)} />
                ))}
              </g>
            </g>
            {model.lakes.map((lake) => (
              <ellipse key={lake.id} className="world-overview__lake" cx={lake.point.x} cy={lake.point.y} rx={lake.radius * 1.45} ry={lake.radius} />
            ))}
            {model.waterways.map((waterway) => (
              <path key={waterway.id} className="world-overview__waterway" d={pathAttribute(waterway.points)} />
            ))}
            {model.routes.map((route) => (
              <path key={route.id} className="world-overview__route" d={pathAttribute(route.points)} />
            ))}
            {model.seaLanes.map((lane) => (
              <path key={lane.id} className="world-overview__sea-lane" d={pathAttribute(lane.points)} />
            ))}
            {model.places.map((place) => visibleIds.has(place.id) && (
              <circle
                key={place.id}
                className={`world-overview__place-dot world-overview__place-dot--${place.category}`}
                cx={place.point.x}
                cy={place.point.y}
                r={place.capital ? 5.5 : place.major ? 4.2 : 2.8}
              />
            ))}
            <circle className="world-overview__party-pulse" cx={model.party.point.x} cy={model.party.point.y} r="12" />
          </svg>

          <div className="world-overview__overlay" aria-live="polite">
            {realmButtonsVisible && model.realms.map((realm) => {
              const style = markerPosition(realm.point, viewBox);
              return (
                <button
                  key={realm.id}
                  type="button"
                  className={`world-overview__realm-label world-overview__realm-label--${realm.id}`}
                  style={style}
                  onClick={() => setCamera(overviewCameraForRealm(realm))}
                  aria-label={`Explore ${realm.shortName || realm.name}: ${realm.placeCount} mapped places`}
                >
                  <span aria-hidden="true">{realm.visual.glyph}</span>
                  <strong>{realm.shortName || realm.name}</strong>
                  <small>{realm.placeCount} places</small>
                </button>
              );
            })}
            {placesInView.map((place) => {
              const isSelected = selected?.id === place.id;
              const showLabel = isSelected || place.current || (place.major && camera.zoom >= 1.35) || camera.zoom >= 2.45;
              return (
                <button
                  key={place.id}
                  type="button"
                  className={markerClass(place, isSelected)}
                  style={markerPosition(place.point, viewBox)}
                  data-world-place={place.id}
                  aria-label={`Inspect ${place.name} on the world map`}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedId(place.id)}
                  onDoubleClick={() => focusPlace(place)}
                >
                  <span className="world-overview__marker-glyph" aria-hidden="true">{PLACE_GLYPHS[place.kind] || "•"}</span>
                  {showLabel && <span className="world-overview__marker-label">{place.name}</span>}
                </button>
              );
            })}
          </div>

          <div className="world-overview__map-controls" aria-label="World map controls">
            <button type="button" onClick={() => setCamera((current) => zoomWorldOverviewCamera(current, 1.25))} aria-label="Zoom in">+</button>
            <button type="button" onClick={() => setCamera((current) => zoomWorldOverviewCamera(current, 1 / 1.25))} aria-label="Zoom out">−</button>
            <button type="button" onClick={() => setCamera(FIT_CAMERA)} aria-label="Fit entire continent">⌂</button>
            <button type="button" onClick={() => setCamera(clampWorldOverviewCamera({ ...camera, x: model.party.point.x, y: model.party.point.y, zoom: Math.max(2.35, camera.zoom) }))} aria-label="Find the party">◎</button>
          </div>
          <div className="world-overview__map-scale">{Math.round(viewBox.width / WORLD_OVERVIEW_VIEWBOX.width * 4_800)} km across</div>
        </div>

        <aside className="world-overview__dossier" aria-label="Selected destination">
          {selected ? (
            <>
              <div className="world-overview__dossier-kicker">
                <span>{placeTypeLabel(selected)}</span>
                <span>{knowledgeLabel(selected)}</span>
              </div>
              <h2>{selected.name}</h2>
              <p className="world-overview__location-line">
                {[selected.provinceName, selected.realmName].filter(Boolean).join(" · ")}
              </p>
              <p className="world-overview__description">{selected.description}</p>

              <div className="world-overview__journey-facts">
                <div><span>From the party</span><strong>{selected.distanceHexes === 0 ? "You are here" : `${selected.distanceKilometers.toLocaleString()} km`}</strong></div>
                <div><span>Authority</span><strong>{selected.factionName || "Contested ground"}</strong></div>
              </div>

              <section className="world-overview__interests" aria-labelledby="world-overview-interests-title">
                <h3 id="world-overview-interests-title">Why go</h3>
                <div>{selected.interests.map((interest) => <span key={interest}>{interest}</span>)}</div>
              </section>

              {selected.routeNames.length > 0 && (
                <section className="world-overview__routes-list">
                  <h3>Ways in</h3>
                  <p>{selected.routeNames.join(" · ")}</p>
                </section>
              )}

              <div className="world-overview__dossier-actions">
                <button type="button" className="world-overview__focus" onClick={() => focusPlace(selected)}>Look closer</button>
                <button type="button" className="world-overview__open-region" onClick={chooseDestination}>
                  Open regional map at {selected.name}
                </button>
              </div>
              <p className="world-overview__travel-note">Opening a destination inspects it on the travel map; it does not move or teleport the party.</p>
            </>
          ) : (
            <p>Select any mark on the map to inspect it.</p>
          )}
        </aside>
      </div>
    </section>
  );
}

export default WorldOverview;
