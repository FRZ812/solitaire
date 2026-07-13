import React, { useRef, useState } from "react";
import { Icon } from "../Icon.jsx";
import { colors } from "../tokens.js";
import { useZoomPan } from "../useZoomPan.js";
import { FLY_MIN_PER_HEX, FLY_TRAVEL_HEXES, WORLD_MARCH_LIMIT } from "../../config.js";
import { TERRAINS } from "../../data/terrains.js";
import { getBiome } from "../../data/biomes.js";
import { biomeVisual, sceneBiomeId } from "../../data/visual-assets.js";
import { knownTravelSpells } from "../../data/travel-spells.js";
import {
  currentLocationName,
  getTile,
  hexDistance,
  isSeen,
  isTeleportAnchor,
  pathMinutes,
} from "../../engine/world.js";
import { pathRiskPercent, describeEncounterPotential } from "../../engine/encounters.js";
import { flyMulticastPlan, assignmentCost, assignmentValid } from "../../engine/fly.js";
import { playerFlightMount } from "../../engine/riding.js";
import { formatDate, formatTime } from "../../engine/time.js";
import { formatCopper } from "../../engine/economy.js";
import { poiPlaceName } from "../../engine/location.js";
import {
  ATLAS_CENTER,
  ATLAS_SIZE,
  TERRAIN_INK,
  atlasPoint,
  buildAtlasModel,
  directionLabel,
  planAtlasJourney,
} from "./atlasModel.js";
import "./exploration.css";

const QUEST_TYPE_LABEL = { errand: "Errand", delivery: "Delivery", hunt: "Hunt", bounty: "Bounty" };
const MAJOR_POI_TYPES = new Set(["city", "town", "village", "fortress", "gate", "palace", "temple", "shrine", "ruin", "landmark"]);

const GLYPHS = {
  city: "♜", village: "⌂", town: "⌂", settlement: "⌂", fortress: "♜",
  ruin: "⌁", temple: "✦", shrine: "✦", landmark: "◆", gate: "◇",
  camp: "△", river: "≈", lake: "≈", mountains: "▲", hidden: "?",
  market: "◈", bldg: "⌂", smithy: "⚒", healer: "+",
};

function glyphFor(tile) {
  return GLYPHS[tile?.poi?.type] || (tile?.terrain === "settlement" ? "⌂" : "•");
}

function nameForCell(cell, origin) {
  const named = poiPlaceName(cell.tile?.poi);
  if (named) return named;
  const terrain = TERRAINS[cell.tile?.terrain]?.label || "Trail";
  const direction = directionLabel(origin, cell);
  return `${direction.charAt(0).toUpperCase()}${direction.slice(1)} ${terrain}`;
}

function curvePath(points) {
  if (!points?.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const bend = ((i % 2) * 2 - 1) * Math.min(12, Math.hypot(b.x - a.x, b.y - a.y) * 0.08);
    const mx = (a.x + b.x) / 2 - (b.y - a.y) * bend / 90;
    const my = (a.y + b.y) / 2 + (b.x - a.x) * bend / 90;
    d += ` Q ${mx.toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }
  return d;
}

function TerrainGlyph({ cell }) {
  if (!cell.seen) return null;
  const { x, y } = cell.point;
  const { terrain } = cell.tile;
  const m = cell.mark;
  const alpha = 0.55;
  const transform = `translate(${x + m.offsetX} ${y + m.offsetY}) rotate(${m.rotation}) scale(${m.scale})`;
  if (terrain === "forest") {
    return <g transform={transform} opacity={alpha} className="atlas-terrain-glyph"><path d="M-18 12L-8-8 0 12M-3 13L8-12 19 13M-12 20v-7M9 20v-7" /></g>;
  }
  if (terrain === "mountains") {
    return <g transform={transform} opacity={alpha} className="atlas-terrain-glyph"><path d="M-24 17L-8-13 3 7 10-6 25 17M-14-2l6-11 4 9M4 7l6-13 5 9" /></g>;
  }
  if (terrain === "hills") {
    return <g transform={transform} opacity={alpha} className="atlas-terrain-glyph"><path d="M-25 13Q-13-11 0 13Q12-7 26 13M-20 19Q-5 4 8 19" /></g>;
  }
  if (terrain === "marsh") {
    return <g transform={transform} opacity={alpha} className="atlas-terrain-glyph"><path d="M-23 14Q-10 9 3 14T27 14M-12 9V-7M-17-2l5 6 5-7M12 11V-3M7 2l5 5 5-6" /></g>;
  }
  if (terrain === "water") {
    return <g transform={transform} opacity={alpha} className="atlas-terrain-glyph"><path d="M-25 4q8-7 16 0t16 0t16 0M-18 14q7-6 14 0t14 0t14 0" /></g>;
  }
  if (terrain === "plains") {
    return <g transform={transform} opacity={alpha * 0.65} className="atlas-terrain-glyph"><path d="M-15 14V0m0 7l-7-6m7 3 7-7M10 17V5m0 7l-6-5m6 2 6-5" /></g>;
  }
  return null;
}

function CompassRose() {
  return (
    <g transform={`translate(${ATLAS_CENTER - 410} ${ATLAS_CENTER - 390})`} opacity="0.56" pointerEvents="none">
      <circle r="34" fill="none" stroke="rgba(230,185,140,.45)" strokeWidth="1" />
      <path d="M0-42L7-7 0 0-7-7ZM0 42L-5 8 0 2 5 8ZM-42 0L-8-5 0 0-8 5ZM42 0L8-5 1 0 8 5Z" fill="rgba(215,167,111,.5)" />
      <text y="-49" textAnchor="middle" className="atlas-compass-letter">N</text>
    </g>
  );
}

function QuestJournal({ quests, current, onClose, onPick }) {
  return (
    <div className="atlas-popover atlas-journal" role="dialog" aria-label="Quest journal">
      <div className="atlas-popover-head">
        <div><span className="atlas-kicker">Field notes</span><h2>Quest journal</h2></div>
        <button onClick={onClose} className="atlas-icon-button" aria-label="Close quest journal"><Icon name="x" size={13} color={colors.parchmentMuted} /></button>
      </div>
      {quests.length === 0 ? <p className="atlas-empty">No active trails. Read the boards at taverns and gaols.</p> : quests.map((q) => (
        <button key={q.id} className="atlas-quest-row" onClick={() => q.loc && onPick(q.loc)} disabled={!q.loc}>
          <span className="atlas-quest-glyph">✦</span>
          <span className="atlas-quest-copy"><b>{q.title}</b><small>{QUEST_TYPE_LABEL[q.type] || "Task"} · {q.giver}{q.loc ? ` · ${hexDistance(current, q.loc)} steps` : ""}</small></span>
          <span className="atlas-quest-reward">{q.type === "bounty" ? formatCopper(q.rewardCp) : formatCopper(q.rewardCp || 0)}</span>
        </button>
      ))}
    </div>
  );
}

export function WorldExploration({ state, onClose, onTravel, onFly, onTeleport, onSeekCombat, loading }) {
  const [selected, setSelected] = useState(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [flyPanelDest, setFlyPanelDest] = useState(null);
  const containerRef = useRef(null);
  const { zoom, transformRef, reset, lastWasDragRef, mouseHandlers } = useZoomPan(containerRef);
  const model = buildAtlasModel(state);
  const activeQuests = (state.world.quests || []).filter((q) => q.status === "active");
  const questAt = new Map(activeQuests.filter((q) => q.loc).map((q) => [`${q.loc.x},${q.loc.y}`, q]));
  const selection = selected ? model.byKey.get(`${selected.x},${selected.y}`) || {
    ...selected,
    key: `${selected.x},${selected.y}`,
    tile: getTile(state, selected.x, selected.y),
    point: atlasPoint(selected, model.origin),
    seen: isSeen(state, selected.x, selected.y),
  } : null;
  const journey = planAtlasJourney(state, selected, WORLD_MARCH_LIMIT);
  const pathPoints = journey?.legPath.map((p) => atlasPoint(p, model.origin)) || [];
  const routeMinutes = journey ? pathMinutes(state, journey.legPath) : 0;
  const risk = journey ? pathRiskPercent(state, journey.legPath) : 0;
  const selectedTile = selection?.tile;
  const selectedName = selection ? nameForCell(selection, model.origin) : currentLocationName(state);
  const isSelf = selection && selection.x === model.origin.x && selection.y === model.origin.y;

  const resolve = state.character.resolve ?? 0;
  const spells = knownTravelSpells(state.character);
  const teleSpells = spells.filter((s) => s.mode === "teleport");
  const flyPlan = flyMulticastPlan(state);
  const flightMount = playerFlightMount(state);
  const distance = selected ? hexDistance(model.origin, selected) : 0;
  const canFly = !!selected && !isSelf && !loading && (flyPlan.casters.length > 0 || flightMount);
  const teleOption = selected && !isSelf && !loading
    ? teleSpells.find((s) => (isFinite(s.range) ? (selection?.seen && distance <= s.range) : isTeleportAnchor(state, selected.x, selected.y)))
    : null;
  const coordinateBiome = getBiome(model.origin.x, model.origin.y);
  const currentBiome = sceneBiomeId(coordinateBiome.id, model.current.tile) === "whitemarch"
    ? { ...coordinateBiome, id: "whitemarch", name: "Whitemarch" }
    : coordinateBiome;
  const currentVisual = biomeVisual(currentBiome.id);
  const coordinateFocusBiome = getBiome(selection?.x ?? model.origin.x, selection?.y ?? model.origin.y);
  const focusBiome = sceneBiomeId(coordinateFocusBiome.id, selection?.tile || model.current.tile) === "whitemarch"
    ? { ...coordinateFocusBiome, id: "whitemarch", name: "Whitemarch" }
    : coordinateFocusBiome;
  const focusVisual = biomeVisual(focusBiome.id);

  function pick(coord) {
    if (lastWasDragRef.current) { lastWasDragRef.current = false; return; }
    setSelected({ x: coord.x, y: coord.y });
  }

  return (
    <div className="exploration-shell atlas-shell" style={{
      "--atlas-accent": currentVisual.accent,
      "--atlas-primary": currentVisual.primary,
      "--atlas-secondary": currentVisual.secondary,
      "--atlas-deep": currentVisual.deep,
    }}>
      <header className="exploration-header">
        <button onClick={onClose} className="atlas-icon-button" aria-label="Return to story"><Icon name="arrowLeft" size={14} color={colors.parchmentMuted} /></button>
        <div className="exploration-title">
          <span className="atlas-kicker">The wayfarer's atlas</span>
          <h1>{currentBiome.name}</h1>
          <small>{formatDate(state.time)} · {formatTime(state.time)}</small>
        </div>
        <div className="atlas-header-mark" aria-hidden="true">✦</div>
      </header>

      <main ref={containerRef} {...mouseHandlers} className="atlas-viewport">
        <div className="atlas-vignette" />
        <div ref={transformRef} className="atlas-transform">
          <svg width={ATLAS_SIZE} height={ATLAS_SIZE} viewBox={`0 0 ${ATLAS_SIZE} ${ATLAS_SIZE}`} className="atlas-canvas" aria-label="Exploration atlas">
            <defs>
              <radialGradient id="atlasPaper" cx="50%" cy="48%" r="68%"><stop offset="0" stopColor={currentVisual.primary} stopOpacity=".24" /><stop offset=".58" stopColor="#173c50" stopOpacity=".66" /><stop offset="1" stopColor={currentVisual.deep} stopOpacity=".9" /></radialGradient>
              <filter id="atlasBlur"><feGaussianBlur stdDeviation="24" /></filter>
              <filter id="atlasGlow"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              <pattern id="atlasGrain" width="67" height="67" patternUnits="userSpaceOnUse"><path d="M2 13l1 1m31-8l1-1m21 27l2 1M10 56l2-1m31 4l1 2" stroke="rgba(237,228,208,.09)" strokeWidth=".7" /></pattern>
            </defs>
            <rect width={ATLAS_SIZE} height={ATLAS_SIZE} fill={currentVisual.deep} />
            <image href={currentVisual.image} x="0" y="0" width={ATLAS_SIZE} height={ATLAS_SIZE} preserveAspectRatio="xMidYMid slice" opacity=".24" className="atlas-region-wash" />
            <rect width={ATLAS_SIZE} height={ATLAS_SIZE} fill="url(#atlasPaper)" />
            <rect width={ATLAS_SIZE} height={ATLAS_SIZE} fill="url(#atlasGrain)" />

            <g filter="url(#atlasBlur)" pointerEvents="none">
              {model.terrain.map((cell) => <circle key={cell.key} cx={cell.point.x} cy={cell.point.y} r={98 * cell.mark.scale} fill={cell.seen ? biomeVisual(sceneBiomeId(getBiome(cell.x, cell.y).id, cell.tile)).primary : "#183247"} opacity={cell.seen ? .24 : .12} />)}
            </g>
            <g fill="none" stroke="rgba(230,185,140,.34)" strokeWidth="2" pointerEvents="none">
              {model.terrain.map((cell) => <TerrainGlyph key={`glyph-${cell.key}`} cell={cell} />)}
            </g>

            <g className="atlas-routes" pointerEvents="none">
              {model.edges.map((edge) => {
                const d = curvePath([edge.from.point, edge.to.point]);
                return <g key={edge.key} opacity={edge.seen ? 1 : .34}><path d={d} className="atlas-route-shadow" /><path d={d} className={edge.visited ? "atlas-route atlas-route--walked" : "atlas-route"} /></g>;
              })}
            </g>

            {journey && <g pointerEvents="none" filter="url(#atlasGlow)"><path d={curvePath(pathPoints)} className="atlas-planned-route-back" /><path d={curvePath(pathPoints)} className="atlas-planned-route" /></g>}

            <g className="atlas-waypoints">
              {model.cells.map((cell) => {
                const quest = questAt.get(cell.key);
                const chosen = selected && selected.x === cell.x && selected.y === cell.y;
                const stepsAway = hexDistance(model.origin, cell);
                // Dense authored settlements can contain hundreds of named
                // stalls and rooms. Keep those discoverable as points, but
                // reserve always-visible labels for true landmarks in the
                // nearby map; immediate exits are already named in the sheet.
                const majorNamed = cell.named && stepsAway > 1 && stepsAway <= 12 && MAJOR_POI_TYPES.has(cell.tile?.poi?.type);
                const important = majorNamed || quest || cell.key === model.current.key;
                return (
                  <g key={cell.key} transform={`translate(${cell.point.x} ${cell.point.y})`} role="button" tabIndex="0" aria-label={`${nameForCell(cell, model.origin)} · ${hexDistance(model.origin, cell)} steps`} aria-pressed={chosen} onClick={() => pick(cell)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") pick(cell); }} className={`atlas-waypoint ${important ? "atlas-waypoint--major" : ""} ${chosen ? "is-selected" : ""}`}>
                    <circle r={important ? 32 : 24} className="atlas-hit" />
                    {!important && <circle r={cell.visited ? 3.4 : 2.2} className={cell.seen ? "atlas-trail-dot" : "atlas-trail-dot atlas-trail-dot--unknown"} />}
                    {important && cell.key !== model.current.key && <><circle r="17" className="atlas-landmark-halo" /><circle r="11" className="atlas-landmark-core" /><text y="5" textAnchor="middle" className="atlas-landmark-glyph">{glyphFor(cell.tile)}</text></>}
                    {quest && <><circle r="24" className="atlas-quest-ring" /><text y="-30" textAnchor="middle" className="atlas-quest-star">✦</text></>}
                    {majorNamed && cell.key !== model.current.key && <text y="38" textAnchor="middle" className="atlas-place-label">{poiPlaceName(cell.tile.poi)}</text>}
                  </g>
                );
              })}
            </g>

            <g transform={`translate(${model.current.point.x} ${model.current.point.y})`} pointerEvents="none" filter="url(#atlasGlow)">
              <circle r="25" className="atlas-party-pulse" />
              <path d="M0-18L11 9 0 5-11 9Z" className="atlas-party-marker" />
              <circle cy="2" r="4" fill="#f5dcb8" />
              <text y="38" textAnchor="middle" className="atlas-you-label">YOU ARE HERE</text>
            </g>
            {selection && !isSelf && <g transform={`translate(${selection.point.x} ${selection.point.y})`} pointerEvents="none"><circle r="24" className="atlas-selection-ring" /><path d="M0-31v14M-7-24H7" className="atlas-selection-tick" /></g>}
            <CompassRose />
          </svg>
        </div>

        <div className="atlas-controls">
          {onSeekCombat && <button onClick={onSeekCombat} disabled={loading} className="atlas-icon-button atlas-icon-button--danger" aria-label="Look for a fight"><Icon name="swords" size={15} color="#efaaa0" /></button>}
          <button onClick={() => setJournalOpen((v) => !v)} className={`atlas-icon-button ${journalOpen ? "is-active" : ""}`} aria-label="Quest journal"><Icon name="book" size={15} color={colors.parchmentMuted} />{activeQuests.length > 0 && <span className="atlas-count">{activeQuests.length}</span>}</button>
          <button onClick={reset} className="atlas-icon-button" aria-label="Recenter atlas"><Icon name="crosshair" size={15} color={colors.parchmentMuted} /></button>
        </div>
        <div className="atlas-zoom">{Math.round(zoom * 100)}%</div>
        {journalOpen && <QuestJournal quests={activeQuests} current={model.origin} onClose={() => setJournalOpen(false)} onPick={(coord) => { setSelected(coord); setJournalOpen(false); }} />}
      </main>

      <section className="atlas-sheet">
        {!selected && model.choices.length > 0 && <div className="atlas-next-steps"><div className="atlas-section-label">Paths from here</div><div className="atlas-choice-row">{model.choices.map((choice) => <button key={choice.key} onClick={() => setSelected({ x: choice.x, y: choice.y })} className="atlas-choice"><span>{directionLabel(model.origin, choice).replace("-", " ")}</span><b>{poiPlaceName(choice.tile.poi) || TERRAINS[choice.tile.terrain]?.label}</b><small>{describeEncounterPotential(choice.tile, choice.x, choice.y) || "open trail"}</small></button>)}</div></div>}

        <div className="atlas-destination">
          <div className="atlas-destination-art" style={{ backgroundImage: `url(${focusVisual.image})`, "--focus-accent": focusVisual.accent }}>
            <div><span>{focusVisual.symbol}</span><small>{focusBiome.name}</small><b>{focusVisual.mood}</b></div>
          </div>
          <div className="atlas-destination-heading"><div><span className="atlas-kicker">{selected ? "Chosen destination" : "Present position"}</span><h2>{selectedName}</h2></div>{selected && <button onClick={() => setSelected(null)} className="atlas-clear">Clear</button>}</div>
          <p>{selectedTile?.poi?.description || (selected ? TERRAINS[selectedTile?.terrain]?.flavor : `${currentLocationName(state)}. Choose a waypoint or one of the paths from here.`)}</p>
          <div className="atlas-facts">
            <span>{focusBiome.name}</span>
            {journey && <><span>{journey.legSteps} step{journey.legSteps === 1 ? "" : "s"}</span><span>~{routeMinutes} min</span><span className={risk >= 45 ? "is-danger" : ""}>{risk}% danger</span></>}
          </div>
          {journey && <div className="atlas-terrain-mix">{journey.terrainLabels.map((t) => <span key={t.id} style={{ "--terrain": TERRAIN_INK[t.id] }}>{t.label} ×{t.count}</span>)}</div>}
        </div>

        {(canFly || teleOption) && <div className="atlas-magic-row">
          {canFly && <button onClick={() => { if (flightMount || flyPlan.casts <= 1) onFly(selected); else setFlyPanelDest(selected); }} className="atlas-action atlas-action--fly">Fly · ~{Math.min(distance, FLY_TRAVEL_HEXES) * FLY_MIN_PER_HEX} min{flightMount ? ` · ${flightMount.name}` : ` · ${flyPlan.totalCost} resolve`}</button>}
          {teleOption && <button onClick={() => resolve >= teleOption.resolveCost && onTeleport(selected, teleOption.id)} disabled={resolve < teleOption.resolveCost} className="atlas-action atlas-action--teleport">{teleOption.name} · {teleOption.resolveCost} resolve</button>}
        </div>}
        <button onClick={() => journey && !loading && onTravel(selected, journey.fullPath)} disabled={!journey || loading} className="atlas-primary-action">
          {!selected ? "Choose a trail" : isSelf ? "You are here" : !journey ? "No open route" : journey.arrived ? `Set out · ${journey.legSteps} step${journey.legSteps === 1 ? "" : "s"} · ${risk}% danger` : `Follow the trail · first ${journey.legSteps} of ${journey.totalSteps}`}
        </button>
      </section>

      {flyPanelDest && <AtlasFlyPanel plan={flyPlan} destination={selectedName} onCancel={() => setFlyPanelDest(null)} onConfirm={(assign) => { const dest = flyPanelDest; setFlyPanelDest(null); onFly(dest, assign); }} />}
    </div>
  );
}

function AtlasFlyPanel({ plan, destination, onCancel, onConfirm }) {
  const [assign, setAssign] = useState(plan.autoAssign);
  const costs = assignmentCost(assign, plan.flyCost);
  const valid = assignmentValid(assign, plan.casters, plan.flyCost);
  return (
    <div className="atlas-modal-backdrop" onClick={onCancel}>
      <div className="atlas-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Assign flight casters">
        <div className="atlas-popover-head"><div><span className="atlas-kicker">Arcane passage</span><h2>Take wing</h2></div><button onClick={onCancel} className="atlas-icon-button"><Icon name="x" size={13} color="#bfe3f2" /></button></div>
        <p>To {destination}. One casting bears one soul; choose who carries each traveller.</p>
        {plan.passengers.map((p) => <label key={p.id} className="atlas-assign-row"><span>{p.name}{p.kind === "player" ? " (you)" : ""}</span><select value={assign[p.id] ?? ""} onChange={(e) => setAssign({ ...assign, [p.id]: e.target.value })}>{plan.casters.map((c) => <option key={c.id} value={c.id}>flown by {c.name}</option>)}</select></label>)}
        <div className="atlas-caster-costs">{plan.casters.map((c) => <span key={c.id}>{c.name}: {c.resolve} → {c.resolve - (costs[c.id] || 0)}</span>)}</div>
        <button onClick={() => valid && onConfirm(assign)} disabled={!valid} className="atlas-primary-action atlas-primary-action--sky">{valid ? `Take wing · ${plan.totalCost} resolve` : "Not enough resolve"}</button>
      </div>
    </div>
  );
}
