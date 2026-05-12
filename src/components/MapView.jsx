import React, { useState, useRef } from "react";
import { Icon } from "./Icon.jsx";
import { iconButtonStyle } from "./primitives.jsx";
import { MAP_VIEW_RADIUS } from "../config.js";
import { TERRAINS } from "../data/terrains.js";
import { getRumored, RUMORED } from "../data/rumored.js";
import { FABLED, FABLED_BY_COORD } from "../data/fabled.js";
import { RIVERS } from "../data/rivers.js";
import { getBiome } from "../data/biomes.js";
import {
  getTile, isSeen, isVisited,
  currentLocationName, hexDistance,
  findPath, pathMinutes,
  HEX_DIRECTIONS,
} from "../engine/world.js";
import { describeEncounterPotential, pathRiskPercent } from "../engine/encounters.js";
import { useZoomPan } from "./useZoomPan.js";

// Pointy-top hex geometry.
const HEX_SIZE = 22;
const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;      // ≈ 38.1
const HEX_HEIGHT = 2 * HEX_SIZE;                // 44
const HSPACING = HEX_WIDTH;
const VSPACING = 1.5 * HEX_SIZE;

// The SVG canvas needs to fit the player's view hex plus every landmark patch
// (some of which sit 140 hexes from origin). 12000×12000 leaves headroom for
// any fabled coord and a generous margin without blowing memory.
const SVG_SIZE = 12000;
const SVG_CENTER = SVG_SIZE / 2;

const LANDMARK_REVEAL_RADIUS_RUMORED = 2;
const LANDMARK_REVEAL_RADIUS_FABLED = 3;

function hexCornerPoints(cx, cy) {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const x = cx + HEX_SIZE * Math.cos(angle);
    const y = cy + HEX_SIZE * Math.sin(angle);
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return points.join(" ");
}

function glyphForTile(tile) {
  if (!tile.poi) return null;
  const t = tile.poi.type;
  if (t === "hidden") return "?";
  if (tile.terrain === "indoor") {
    if (t === "inn" || t === "tavern") return "⌂";
    if (t === "smithy") return "⚒";
    if (t === "temple") return "✦";
    if (t === "stable") return "♞";
    if (t === "mill") return "✻";
    if (t === "shop") return "▤";
    return "⌂";
  }
  if (t === "town") return "■";
  if (t === "hall") return "■";
  if (t === "gate") return "║";
  if (t === "square") return "◇";
  if (t === "garden") return "❀";
  if (t === "landmark" || t === "camp") return "◆";
  if (t === "yard") return "·";
  if (t === "shrine") return "✦";
  if (t === "cathedral") return "✚";
  if (t === "palace") return "▣";
  if (t === "mint") return "◉";
  // Landmark kinds — rumored and fabled tiles route through here too once
  // they're seen.
  if (t === "city") return "▦";
  if (t === "village") return "▪";
  if (t === "lake") return "◯";
  if (t === "mountains") return "▲";
  if (t === "ruin") return "⛌";
  if (t === "river") return "≈";
  if (t === "fortress") return "✦";
  return "•";
}

function MapLegend() {
  const items = [
    { glyph: "⌂", label: "bldg" }, { glyph: "⚒", label: "smithy" },
    { glyph: "✦", label: "temple" }, { glyph: "■", label: "town" },
    { glyph: "║", label: "gate" }, { glyph: "◆", label: "site" },
    { glyph: "?", label: "unknown" }, { glyph: "▦", label: "city" },
    { glyph: "≈", label: "river" }, { glyph: "▲", label: "mtns" },
    { glyph: "⛌", label: "ruin" }, { glyph: "◯", label: "lake" },
  ];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 12px", padding: "8px 12px", borderTop: "1px solid #EBE5D6", borderBottom: "1px solid #EBE5D6", backgroundColor: "#F7F1E2", fontSize: "11px", color: "#6B655B", justifyContent: "center" }}>
      {items.map((it) => (
        <span key={it.glyph + it.label} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
          <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: "14px", color: "#1A1A1A" }}>{it.glyph}</span>
          {it.label}
        </span>
      ))}
    </div>
  );
}

// Build the list of axial coords to render: the player's view radius plus
// pre-revealed patches around every named landmark. Returns each as
// { x, y, px, py } where (px, py) is the SVG pixel position.
function collectHexes(cur) {
  const set = new Set();
  const out = [];

  function add(centerX_axial, centerY_axial, R) {
    for (let dq = -R; dq <= R; dq++) {
      const drLow = Math.max(-R, -dq - R);
      const drHigh = Math.min(R, -dq + R);
      for (let dr = drLow; dr <= drHigh; dr++) {
        const x = centerX_axial + dq;
        const y = centerY_axial + dr;
        const key = `${x},${y}`;
        if (set.has(key)) continue;
        set.add(key);
        const dpq = x - cur.x;
        const dpr = y - cur.y;
        const px = SVG_CENTER + HSPACING * (dpq + dpr / 2);
        const py = SVG_CENTER + VSPACING * dpr;
        out.push({ x, y, px, py });
      }
    }
  }

  add(cur.x, cur.y, MAP_VIEW_RADIUS);
  for (const r of RIVERS) {
    for (const p of r.path) {
      add(p.x, p.y, 1);
    }
  }
  for (const k of Object.keys(RUMORED)) {
    const [rx, ry] = k.split(",").map(Number);
    add(rx, ry, LANDMARK_REVEAL_RADIUS_RUMORED);
  }
  for (const f of Object.values(FABLED)) {
    add(f.coord.x, f.coord.y, LANDMARK_REVEAL_RADIUS_FABLED);
  }
  return out;
}

export function MapView({ state, onClose, onTravel, loading }) {
  const [selected, setSelected] = useState(null);
  const containerRef = useRef(null);
  const { zoom, pan, reset, lastWasDragRef, mouseHandlers } = useZoomPan(containerRef);
  const cur = state.world.currentTile;

  const hexes = collectHexes(cur);

  // Road segments connect adjacent seen tiles in the road network. At least
  // one end must be road or settlement, and both must be connectable
  // (road / settlement / indoor). That draws roads between hexes, town squares
  // to their gates, and gates to outer roads — while skipping pairs of
  // adjacent indoor buildings that don't share a street between them.
  function isConnectable(t) {
    return t.terrain === "road" || t.terrain === "settlement" || t.terrain === "indoor";
  }
  function isStreet(t) {
    return t.terrain === "road" || t.terrain === "settlement";
  }
  const segmentSet = new Set();
  const roadSegments = [];
  for (const h of hexes) {
    if (!isSeen(state, h.x, h.y)) continue;
    const tile = getTile(state, h.x, h.y);
    if (!isConnectable(tile)) continue;
    for (const dir of HEX_DIRECTIONS) {
      const nx = h.x + dir.x;
      const ny = h.y + dir.y;
      if (!isSeen(state, nx, ny)) continue;
      const nTile = getTile(state, nx, ny);
      if (!isConnectable(nTile)) continue;
      if (!isStreet(tile) && !isStreet(nTile)) continue;
      const key = (h.x < nx || (h.x === nx && h.y < ny))
        ? `${h.x},${h.y}|${nx},${ny}`
        : `${nx},${ny}|${h.x},${h.y}`;
      if (segmentSet.has(key)) continue;
      segmentSet.add(key);
      const npx = SVG_CENTER + HSPACING * ((nx - cur.x) + (ny - cur.y) / 2);
      const npy = SVG_CENTER + VSPACING * (ny - cur.y);
      roadSegments.push({ x1: h.px, y1: h.py, x2: npx, y2: npy });
    }
  }

  // Landmark labels — named places that read at a glance on the map. Built
  // from getTile so handcrafted city/village/town centres surface here, and
  // rumored/fabled coords fall through getTile to the same poi types.
  const LABELABLE_TYPES = new Set(["city", "village", "town", "fortress", "ruin", "mountains", "lake"]);
  const labels = [];
  for (const { x, y, px, py } of hexes) {
    if (!isSeen(state, x, y)) continue;
    const tile = getTile(state, x, y);
    if (!tile.poi || !LABELABLE_TYPES.has(tile.poi.type)) continue;
    labels.push({ key: `lbl-${x},${y}`, x: px, y: py - 22, name: tile.poi.name, fill: "#1A1A1A" });
  }
  // One label per river at its midpoint, painted in a watery hue.
  for (const r of RIVERS) {
    const mid = r.path[Math.floor(r.path.length / 2)];
    if (!isSeen(state, mid.x, mid.y)) continue;
    const mpx = SVG_CENTER + HSPACING * ((mid.x - cur.x) + (mid.y - cur.y) / 2);
    const mpy = SVG_CENTER + VSPACING * (mid.y - cur.y);
    labels.push({ key: `lbl-river-${r.id}`, x: mpx, y: mpy - 14, name: r.name, fill: "#2E4A6E" });
  }

  const selTile = selected ? getTile(state, selected.x, selected.y) : null;
  const selRumored = selected ? getRumored(selected.x, selected.y) : null;
  const selSeen = selected ? isSeen(state, selected.x, selected.y) : false;
  const isSelf = selected && selected.x === cur.x && selected.y === cur.y;
  const curTile = getTile(state, cur.x, cur.y);
  const path = (selected && selSeen && !isSelf) ? findPath(state, cur, selected) : null;
  const canTravel = !!path && path.length > 1 && !loading;
  const totalMins = canTravel ? pathMinutes(state, path) : 0;
  const riskPct = canTravel ? pathRiskPercent(state, path) : 0;

  let bottomLabel = "Tap a tile to inspect; drag to pan, pinch / wheel to zoom.";
  let bottomDetail = currentLocationName(state) + " · You are here.";
  let biomeLabel = null;
  let encounterHint = null;
  if (selected) {
    if (selRumored && !selSeen) {
      bottomLabel = `${selRumored.name} · ${selRumored.kind}`;
      bottomDetail = `Known by reputation, never visited. ${selRumored.description}`;
    } else if (!selSeen) {
      bottomLabel = `Unknown (${selected.x},${selected.y})`;
      bottomDetail = "Beyond your sight. Step closer to learn what's there.";
    } else {
      const T = TERRAINS[selTile.terrain];
      let name = selTile.poi?.name || T?.label || "Wilderness";
      if (selTile.poi?.type === "hidden") name = `? · ${T?.label}`;
      bottomLabel = `${name} (${selected.x},${selected.y})`;
      if (selTile.poi?.description) bottomDetail = selTile.poi.description;
      else if (selTile.poi?.type === "hidden") bottomDetail = "Something here, not yet known.";
      else bottomDetail = T?.flavor || "";
      biomeLabel = getBiome(selected.x, selected.y).name;
      encounterHint = describeEncounterPotential(selTile, selected.x, selected.y);
    }
  } else {
    biomeLabel = getBiome(cur.x, cur.y).name;
    encounterHint = describeEncounterPotential(curTile, cur.x, cur.y);
  }

  return (
    <div style={{ position: "absolute", inset: 0, backgroundColor: "#FBF8F2", zIndex: 30, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 14px) 20px 12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #EBE5D6" }}>
        <button onClick={onClose} style={iconButtonStyle}>
          <Icon name="arrowLeft" size={15} color="#1A1A1A" strokeWidth={1.5} />
        </button>
        <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: "20px", fontStyle: "italic", color: "#1A1A1A" }}>
          Map{zoom !== 1 ? ` · ${(zoom * 100).toFixed(0)}%` : ""}
        </div>
        <button
          onClick={reset}
          style={iconButtonStyle}
          aria-label="Recenter on player"
        >
          <Icon name="crosshair" size={14} color="#1A1A1A" strokeWidth={1.5} />
        </button>
      </div>

      <div
        ref={containerRef}
        {...mouseHandlers}
        style={{
          flex: 1,
          overflow: "hidden",
          backgroundColor: "#F4EEDC",
          touchAction: "none",
          position: "relative",
          cursor: "grab",
          userSelect: "none",
        }}
      >
        <div style={{
          position: "absolute",
          top: "50%", left: "50%",
          transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "center center",
          willChange: "transform",
        }}>
          <svg width={SVG_SIZE} height={SVG_SIZE} style={{ display: "block" }}>
            {hexes.map(({ x, y, px, py }) => {
              const tile = getTile(state, x, y);
              const seen = isSeen(state, x, y);
              const visited = isVisited(state, x, y);
              const isCurrent = x === cur.x && y === cur.y;
              const isSel = selected && selected.x === x && selected.y === y;
              const T = TERRAINS[tile.terrain];

              // Fog of war shows the same terrain colour at low opacity — the
              // shape of the country bleeds through the fog. Seen tiles are
              // fully saturated; visited ones a touch brighter than just-seen.
              let fill = T?.color || "#888";
              let textColor = T?.dark ? "#FBF4DE" : "#1F1611";
              let glyph = null;
              let opacity;
              let stroke = "rgba(0,0,0,0.08)";
              let strokeWidth = 1;

              if (seen) {
                opacity = visited ? 1 : 0.85;
                glyph = glyphForTile(tile);
              } else {
                opacity = 0.32;
              }

              if (isCurrent) {
                stroke = "#E8B98C";
                strokeWidth = 3;
                opacity = 1;
              } else if (isSel) {
                stroke = "#1A1A1A";
                strokeWidth = 2.25;
                opacity = Math.max(opacity, 0.7);
              }

              return (
                <g
                  key={`${x},${y}`}
                  onClick={() => {
                    if (lastWasDragRef.current) {
                      lastWasDragRef.current = false;
                      return;
                    }
                    setSelected({ x, y });
                  }}
                  style={{ cursor: "pointer", opacity }}
                >
                  <polygon
                    points={hexCornerPoints(px, py)}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeLinejoin="round"
                  />
                  {glyph && (
                    <text
                      x={px}
                      y={py + 7}
                      textAnchor="middle"
                      fontFamily="'Instrument Serif', serif"
                      fontStyle={glyph === "?" ? "italic" : "normal"}
                      fontSize="19"
                      fontWeight="500"
                      fill={textColor}
                      pointerEvents="none"
                    >
                      {glyph}
                    </text>
                  )}
                </g>
              );
            })}
            {roadSegments.map((s, i) => (
              <line
                key={`road-${i}`}
                x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                stroke="#6B4A2E"
                strokeWidth={4}
                strokeOpacity={0.78}
                strokeLinecap="round"
                pointerEvents="none"
              />
            ))}
            {path && path.length > 1 && (
              <polyline
                points={path.map(p => {
                  const dq = p.x - cur.x;
                  const dr = p.y - cur.y;
                  const ppx = SVG_CENTER + HSPACING * (dq + dr / 2);
                  const ppy = SVG_CENTER + VSPACING * dr;
                  return `${ppx.toFixed(2)},${ppy.toFixed(2)}`;
                }).join(" ")}
                fill="none"
                stroke="#E8B98C"
                strokeWidth={3}
                strokeOpacity={0.9}
                strokeLinejoin="round"
                strokeLinecap="round"
                pointerEvents="none"
              />
            )}
            {labels.map((l) => (
              <text
                key={l.key}
                x={l.x} y={l.y}
                textAnchor="middle"
                fontFamily="'Instrument Serif', serif"
                fontStyle="italic"
                fontSize="12"
                fontWeight="600"
                fill={l.fill}
                pointerEvents="none"
                paintOrder="stroke"
                stroke="#FBF8F2"
                strokeWidth="2.4"
                strokeOpacity={0.9}
                strokeLinejoin="round"
              >
                {l.name}
              </text>
            ))}
          </svg>
        </div>
      </div>

      <MapLegend />

      <div style={{ padding: "12px 20px calc(env(safe-area-inset-bottom, 0px) + 14px) 20px", backgroundColor: "rgba(251, 248, 242, 0.98)" }}>
        <div style={{ fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#8B5A2B", marginBottom: "4px", fontWeight: 500 }}>
          {selected ? "Selected" : "You are here"}
        </div>
        <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "16px", color: "#1A1A1A", lineHeight: "1.3" }}>
          {bottomLabel}
        </div>
        <div style={{ fontSize: "12px", color: "#6B655B", lineHeight: "1.45", marginTop: "4px" }}>{bottomDetail}</div>
        {biomeLabel && (
          <div style={{ fontSize: "10px", color: "#8B857A", letterSpacing: "0.08em", marginTop: "4px", fontStyle: "italic" }}>in {biomeLabel}</div>
        )}
        {encounterHint && (
          <div style={{ fontSize: "10px", color: "#8B5A2B", letterSpacing: "0.06em", marginTop: "4px", fontWeight: 500 }}>{encounterHint}</div>
        )}
        <div style={{ marginBottom: "10px" }} />
        <button
          onClick={() => canTravel && onTravel(selected, path)} disabled={!canTravel}
          style={{
            width: "100%", height: "40px", borderRadius: "20px", border: "none",
            backgroundColor: canTravel ? "#1A1A1A" : "#D7D1C2",
            color: canTravel ? "#FBF8F2" : "#8B857A",
            fontSize: "13px", fontWeight: 500,
            cursor: canTravel ? "pointer" : "not-allowed",
          }}
        >
          {!selected ? "Tap a tile" :
            isSelf ? "You are here" :
            selRumored && !selSeen ? `Too far · ${hexDistance(cur, selected)} hexes by reputation` :
            !selSeen ? "Beyond sight" :
            !canTravel ? "No route" :
            `Travel · ${path.length - 1} hex${path.length - 1 === 1 ? "" : "es"} · ~${totalMins} min · risk ${riskPct}%`}
        </button>
      </div>
    </div>
  );
}
