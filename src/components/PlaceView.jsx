import React, { useMemo } from "react";
import { Icon } from "./Icon.jsx";
import { colors } from "./tokens.js";
import { currentPlace, currentNode, currentExits, canLeave, nodeTile } from "../engine/place.js";
import { buildingForTile, isBuildingOpen } from "../data/town.js";
import { biomeVisual, terrainVisual } from "../data/visual-assets.js";
import "./exploration/exploration.css";

// Curated positions turn Whitemarch's declarative node graph into a legible
// city plan. Other authored places receive a stable district-based fallback so
// they are immediately playable before bespoke art direction is added.
const WHITEMARCH_LAYOUT = {
  "crown-gate": [258, 66], "toll-hall": [157, 58], "caravan-yard": [365, 82], "great-stable": [448, 56],
  "grand-concourse": [270, 153], "grain-square": [238, 221], "smith-row": [137, 218], "apothecary-stall": [343, 220],
  "low-wards": [130, 316], "leaning-tankard": [54, 359], "bonepicker-chapel": [106, 414], "almshouse": [175, 405], "chandlery": [52, 288],
  "river-stair": [349, 294], "high-quay": [432, 330], "warehouse-row": [463, 400], "smuggler-stairs": [351, 388],
  "guild-court": [255, 336], "registry-hall": [245, 408], "chain-steps": [161, 474], "holding-cells": [73, 492],
  "inner-gate": [319, 450], "muster-court": [353, 520], "iron-palace": [433, 552],
};

const DISTRICT_TONES = ["#6a6043", "#536a48", "#365552", "#66513e", "#5c514c", "#4d5961", "#684f46"];
const NODE_GLYPHS = {
  gate: "◇", hall: "▤", market: "◈", smithy: "⚒", healer: "+", shrine: "✦",
  dock: "≈", stair: "≋", plaza: "◆", court: "§", prison: "▦", slavemarket: "⛓",
  palace: "♜", barracks: "⚔", stable: "♞", yard: "□", town: "⌂", bldg: "⌂", hidden: "?",
};

function fallbackLayout(place) {
  const groups = new Map();
  for (const node of Object.values(place.nodes)) {
    const district = node.district || "The outskirts";
    if (!groups.has(district)) groups.set(district, []);
    groups.get(district).push(node);
  }
  const out = {};
  const districts = [...groups.values()];
  districts.forEach((nodes, districtIndex) => {
    const angle = -Math.PI / 2 + districtIndex * Math.PI * 2 / Math.max(1, districts.length);
    const cx = 260 + Math.cos(angle) * 150;
    const cy = 305 + Math.sin(angle) * 205;
    nodes.forEach((node, nodeIndex) => {
      const a = nodeIndex * Math.PI * 2 / Math.max(1, nodes.length);
      out[node.id] = [cx + Math.cos(a) * 48, cy + Math.sin(a) * 42];
    });
  });
  return out;
}
function placeLayout(place) {
  if (place.id === "whitemarch") return WHITEMARCH_LAYOUT;
  return fallbackLayout(place);
}

function edgePath(a, b) {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const bend = Math.min(12, Math.hypot(dx, dy) * .07);
  return `M${a[0]} ${a[1]} Q${(mx - dy * bend / 100).toFixed(1)} ${(my + dx * bend / 100).toFixed(1)} ${b[0]} ${b[1]}`;
}

function buildDistricts(place, layout) {
  const groups = new Map();
  for (const node of Object.values(place.nodes)) {
    if (!layout[node.id]) continue;
    const name = node.district || "The outskirts";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(layout[node.id]);
  }
  return [...groups.entries()].map(([name, points], index) => {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const minX = Math.min(...xs) - 35;
    const maxX = Math.max(...xs) + 35;
    const minY = Math.min(...ys) - 31;
    const maxY = Math.max(...ys) + 31;
    return { name, x: minX, y: minY, width: maxX - minX, height: maxY - minY, tone: DISTRICT_TONES[index % DISTRICT_TONES.length] };
  });
}

function displayType(type) {
  if (!type) return "place";
  if (type === "bldg") return "building";
  if (type === "slavemarket") return "auction steps";
  return type;
}

export function PlaceView({ state, time, onMove, onLeave, onService, onClose }) {
  const place = currentPlace(state);
  const node = currentNode(state);
  const exits = currentExits(state);
  const leavable = canLeave(state);
  const layout = useMemo(() => place ? placeLayout(place) : {}, [place]);
  const districts = useMemo(() => place ? buildDistricts(place, layout) : [], [place, layout]);
  if (!place || !node) return null;

  const directIds = new Set(exits.map((e) => e.id));
  const tile = nodeTile(place, node);
  const placeVisual = biomeVisual(place.biomeId || "far-wild");
  const nodeVisual = terrainVisual(tile.terrain);
  const building = buildingForTile(tile);
  const open = building ? isBuildingOpen(building, time?.hour ?? 12) : false;
  const edges = [];
  const seenEdges = new Set();
  for (const [id, n] of Object.entries(place.nodes)) {
    for (const target of n.exits || []) {
      if (!layout[id] || !layout[target]) continue;
      const key = [id, target].sort().join("|");
      if (seenEdges.has(key)) continue;
      seenEdges.add(key);
      edges.push({ key, from: id, to: target, direct: id === node.id || target === node.id });
    }
  }

  return (
    <div className="exploration-shell place-shell" style={{
      "--atlas-accent": placeVisual.accent,
      "--atlas-primary": placeVisual.primary,
      "--atlas-deep": placeVisual.deep,
      "--place-node": nodeVisual.tint,
    }}>
      <header className="exploration-header">
        <button onClick={onClose} className="atlas-icon-button" aria-label="Return to story"><Icon name="arrowLeft" size={14} color={colors.parchmentMuted} /></button>
        <div className="exploration-title"><span className="atlas-kicker">City wayfinder</span><h1>{place.name}</h1><small>{node.district || place.kind} · {displayType(node.type)}</small></div>
        <div className="atlas-header-mark" aria-hidden="true">⌂</div>
      </header>

      <main className="place-viewport">
        <div className="place-scene-wash" style={{ backgroundImage: `url(${placeVisual.image})` }} />
        <svg className="place-map" viewBox="0 0 520 620" role="img" aria-label={`${place.name} exploration map`}>
          <defs>
            <pattern id="placeGrain" width="61" height="61" patternUnits="userSpaceOnUse"><path d="M4 9l1 1m27 12l2-1m20 28l1 1M11 54l2-1" stroke="rgba(237,228,208,.07)" /></pattern>
            <filter id="placeGlow"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <rect width="520" height="620" fill="url(#placeGrain)" />
          {place.id === "whitemarch" && <g pointerEvents="none"><path d="M36 250Q22 365 36 570Q185 604 338 588Q454 576 492 470" className="place-wall" /><path d="M505 258Q413 274 344 310T265 620" className="place-river" /><path d="M505 258Q413 274 344 310T265 620" className="place-river-shine" /></g>}
          <g pointerEvents="none">{districts.map((d) => <g key={d.name}><rect x={d.x} y={d.y} width={d.width} height={d.height} rx="38" className="place-district" style={{ fill: `${d.tone}16`, stroke: `${d.tone}66` }} /><text x={d.x + 12} y={d.y + 16} className="place-district-label">{d.name.toUpperCase()}</text></g>)}</g>
          <g pointerEvents="none">{edges.map((edge) => <path key={edge.key} d={edgePath(layout[edge.from], layout[edge.to])} className={`place-route ${edge.direct ? "is-direct" : ""}`} />)}</g>
          <g>{Object.values(place.nodes).map((mapNode) => {
            const pos = layout[mapNode.id];
            if (!pos) return null;
            const current = mapNode.id === node.id;
            const direct = directIds.has(mapNode.id);
            const interactive = direct;
            return <g key={mapNode.id} transform={`translate(${pos[0]} ${pos[1]})`} className={`place-node ${current ? "is-current" : ""} ${direct ? "is-direct" : ""}`} role={interactive ? "button" : undefined} tabIndex={interactive ? 0 : undefined} aria-label={interactive ? `Go to ${mapNode.name}` : mapNode.name} onClick={interactive ? () => onMove?.(mapNode.id) : undefined} onKeyDown={interactive ? (e) => { if (e.key === "Enter" || e.key === " ") onMove?.(mapNode.id); } : undefined}>
              <circle r="24" className="place-node-hit" />
              {direct && <circle r="17" className="place-direct-pulse" />}
              <circle r={current ? 14 : 11} className="place-node-ring" />
              <text y="4" textAnchor="middle" className="place-node-glyph">{NODE_GLYPHS[mapNode.type] || "•"}</text>
              {mapNode.service && <circle cx="10" cy="-10" r="4" className="place-service-dot" />}
              <text y={current ? 31 : 28} textAnchor="middle" className="place-node-label">{mapNode.name}</text>
            </g>;
          })}</g>
        </svg>
      </main>

      <section className="place-sheet">
        <div className="place-scene-note"><span>{placeVisual.symbol}</span><div><small>{node.district || place.kind}</small><b>{placeVisual.mood}</b></div></div>
        <div className="place-breadcrumbs">{place.name} › {node.district || "The outskirts"}<span className="place-access">{node.access || "public"}</span></div>
        <h2 className="place-heading">{node.name}</h2>
        <p className="place-description">{node.description}</p>
        <div className="atlas-section-label">Ways from here</div>
        <div className="place-actions">
          {exits.map((exit) => <button key={exit.id} onClick={() => onMove?.(exit.id)} className="place-route-choice"><b>{exit.name}</b><small>{exit.district || place.name} · {exit.access || "public"}</small></button>)}
          {leavable && <button onClick={onLeave} className="place-route-choice place-leave"><b>Beyond the gate</b><small>Leave {place.name} for the open road</small></button>}
        </div>
        {building && <button onClick={() => onService?.(node, building)} className="place-service">{open ? `Enter ${building.label}` : `${building.label} is closed · ${building.hours?.open}:00–${building.hours?.close}:00`}</button>}
      </section>
    </div>
  );
}
