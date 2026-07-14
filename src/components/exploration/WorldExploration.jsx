import React, { useMemo, useState } from "react";
import { Icon } from "../Icon.jsx";
import { FLY_MIN_PER_HEX, FLY_TRAVEL_HEXES, WORLD_MARCH_LIMIT } from "../../config.js";
import { TERRAINS } from "../../data/terrains.js";
import { getBiome } from "../../data/biomes.js";
import { biomeVisual, sceneBiomeId, terrainVisual } from "../../data/visual-assets.js";
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
import { coinsToCopper, formatCopper } from "../../engine/economy.js";
import { poiPlaceName } from "../../engine/location.js";
import {
  TERRAIN_INK,
  buildExplorationModel,
  directionLabel,
  directionShort,
  planAtlasJourney,
} from "./atlasModel.js";
import { GodotMapFrame } from "./GodotMapFrame.jsx";
import { buildWorldGodotScene } from "./godotSceneModel.js";
import playerArt from "../../assets/generated/rpg-player-marker-v1.webp";
import monsterArt from "../../assets/generated/rpg-monster-v1.webp";
import weaponArt from "../../assets/generated/rpg-weapon-v1.webp";
import rewardFrame from "../../assets/generated/rpg-reward-frame-v1.webp";
import "./exploration.css";

const QUEST_TYPE_LABEL = { errand: "Errand", delivery: "Delivery", hunt: "Hunt", bounty: "Bounty" };
const POI_GLYPHS = {
  city: "♜", village: "⌂", town: "⌂", settlement: "⌂", fortress: "♜",
  ruin: "⌁", temple: "✦", shrine: "✦", landmark: "◆", gate: "◇",
  camp: "△", market: "◈", bldg: "⌂", smithy: "⚒", healer: "+",
};

function glyphFor(tile) {
  return POI_GLYPHS[tile?.poi?.type] || terrainVisual(tile?.terrain).glyph || "•";
}

function nameForDestination(destination, origin) {
  const named = destination?.name || poiPlaceName(destination?.tile?.poi);
  if (named) return named;
  if (destination?.quest) return destination.quest.title;
  const terrain = TERRAINS[destination?.tile?.terrain]?.label || "Trail";
  const direction = directionLabel(origin, destination);
  return `${direction.charAt(0).toUpperCase()}${direction.slice(1).replace("-", " ")} ${terrain}`;
}

function dangerLabel(risk) {
  if (risk >= 65) return "Deadly";
  if (risk >= 40) return "Dangerous";
  if (risk >= 20) return "Wary";
  return "Calm";
}

function biomeAt(destination) {
  const coordinateBiome = getBiome(destination.x, destination.y);
  const id = sceneBiomeId(coordinateBiome.id, destination.tile);
  return id === "whitemarch" ? { ...coordinateBiome, id, name: "Whitemarch" } : coordinateBiome;
}

function RpgHeader({ state, biome, onClose, onWayfinder }) {
  const vitality = state.character.vitality ?? 0;
  const vitalityMax = Math.max(1, state.character.vitalityMax ?? vitality);
  const resolve = state.character.resolve ?? 0;
  const resolveMax = Math.max(1, state.character.resolveMax ?? resolve);
  const vitalityDisplay = Math.ceil(vitality);
  const vitalityMaxDisplay = Math.ceil(vitalityMax);
  const resolveDisplay = Math.ceil(resolve);
  const resolveMaxDisplay = Math.ceil(resolveMax);
  const coin = coinsToCopper(state.character.inventory?.coins || {});
  return (
    <header className="rpg-map-header">
      <button onClick={onClose} className="rpg-square-button" aria-label="Return to story"><Icon name="arrowLeft" size={17} color="#fff4c7" /></button>
      <div className="rpg-location-lockup">
        <span>{biome.name} · overworld</span>
        <h1>{currentLocationName(state)}</h1>
        <small>{formatDate(state.time)} · {formatTime(state.time)}</small>
      </div>
      <div className="rpg-vitals" aria-label="Party status">
        <div className="rpg-vital rpg-vital--hp"><span>HP</span><i><b style={{ width: `${Math.min(100, vitality / vitalityMax * 100)}%` }} /></i><strong>{vitalityDisplay}/{vitalityMaxDisplay}</strong></div>
        <div className="rpg-vital rpg-vital--mp"><span>RP</span><i><b style={{ width: `${Math.min(100, resolve / resolveMax * 100)}%` }} /></i><strong>{resolveDisplay}/{resolveMaxDisplay}</strong></div>
        <div className="rpg-coin"><span>◆</span>{formatCopper(coin)}</div>
      </div>
      <button onClick={onWayfinder} className="rpg-square-button" aria-label="Open world atlas"><Icon name="map" size={17} color="#fff4c7" /></button>
    </header>
  );
}

function RpgDpad({ onStep, onClear }) {
  return (
    <div className="rpg-dpad" aria-label="Map cursor controls">
      <button className="is-nw" onClick={() => onStep(0, -1)} aria-label="Move cursor northwest">↖</button>
      <button className="is-ne" onClick={() => onStep(1, -1)} aria-label="Move cursor northeast">↗</button>
      <button className="is-west" onClick={() => onStep(-1, 0)} aria-label="Move cursor west">◀</button>
      <button className="is-center" onClick={onClear} aria-label="Center on party">◆</button>
      <button className="is-east" onClick={() => onStep(1, 0)} aria-label="Move cursor east">▶</button>
      <button className="is-sw" onClick={() => onStep(-1, 1)} aria-label="Move cursor southwest">↙</button>
      <button className="is-se" onClick={() => onStep(0, 1)} aria-label="Move cursor southeast">↘</button>
    </div>
  );
}

function WorldGrid({ model, selection, journey, onPick, onStep, onClear, onJournal, onWayfinder, onSeekCombat, questCount, loading, night }) {
  const godotScene = useMemo(() => buildWorldGodotScene({ model, selection, journey, night }), [model, selection, journey, night]);
  const accessibleCells = useMemo(() => model.viewport
    .filter((cell) => cell.seen && cell.passable && !cell.current)
    .map((cell) => ({
      key: cell.key,
      label: `${nameForDestination(cell, model.origin)}, ${directionLabel(model.origin, cell).replace("-", " ")}${cell.quest ? `, quest: ${cell.quest.title}` : ""}`,
    })), [model]);

  function selectGodotCell(key) {
    const cell = model.viewport.find((candidate) => candidate.key === key);
    if (cell?.seen && cell.passable && !cell.current) onPick(cell);
  }

  return (
    <main className={`rpg-world-stage godot-world-stage ${night ? "is-night" : ""}`}>
      <GodotMapFrame scene={godotScene} onSelect={selectGodotCell} label="Interactive world exploration map" choices={accessibleCells} selectedKey={selection?.key} />
      <div className="rpg-quickbar">
        <button onClick={onWayfinder}><Icon name="map" size={15} color="#fff4c7" /><span>Atlas</span></button>
        <button onClick={onJournal}><Icon name="book" size={15} color="#fff4c7" /><span>Quests</span>{questCount > 0 && <b>{questCount}</b>}</button>
      </div>

      {selection && !model.viewport.some((cell) => cell.key === selection.key) && <div className="rpg-offscreen-target"><span>✦</span><b>Compass locked</b><small>{directionLabel(model.origin, selection).replace("-", " ")}</small></div>}

      <RpgDpad onStep={onStep} onClear={onClear} />
      {onSeekCombat && (
        <button onClick={onSeekCombat} disabled={loading} className="rpg-wild-encounter">
          <img src={monsterArt} alt="" />
          <span><small>Wild encounter</small><b>Seek a foe</b></span>
          <img src={weaponArt} alt="" className="rpg-encounter-weapon" />
        </button>
      )}
    </main>
  );
}

function TrailChoices({ model, onPick }) {
  return (
    <div className="rpg-trail-choices">
      {model.choices.slice(0, 5).map((choice) => {
        const visual = terrainVisual(choice.tile.terrain);
        return (
          <button key={choice.key} onClick={() => onPick(choice)} style={{ "--choice-color": visual.tint }}>
            <span>{glyphFor(choice.tile)}</span>
            <div><small>{directionShort(choice.direction)} · {choice.steps} {choice.steps === 1 ? "step" : "steps"}</small><b>{nameForDestination(choice, model.origin)}</b><em>{describeEncounterPotential(choice.tile, choice.x, choice.y) || "open trail"}</em></div>
            <i>›</i>
          </button>
        );
      })}
      {model.choices.length === 0 && <p className="rpg-empty">No safe road is visible from here.</p>}
    </div>
  );
}

function DestinationPanel({ state, model, selection, selectedName, journey, routeMinutes, risk, focusBiome, focusVisual, onClear, onPick, onTravel, canFly, teleOption, onFly, onTeleport, flightMount, flyPlan, resolve, loading }) {
  const distance = selection ? hexDistance(model.origin, selection) : 0;
  const isSelf = selection && selection.x === model.origin.x && selection.y === model.origin.y;
  const description = selection?.tile?.poi?.description || (selection ? TERRAINS[selection.tile?.terrain]?.flavor : null);
  const rewardTitle = selection?.quest ? "Quest reward" : selection?.visited ? "Known waypoint" : "Discovery ahead";
  const rewardValue = selection?.quest ? formatCopper(selection.quest.rewardCp || 0) : selection?.visited ? "Route recorded" : "New atlas entry";
  return (
    <section className="rpg-command-panel">
      <div className="rpg-party-card">
        <div className="rpg-party-portrait"><img src={playerArt} alt="" /></div>
        <div><small>Party leader</small><b>{state.character.name || "Wanderer"}</b><span>{state.character.race || "Adventurer"} · ready</span></div>
        <i>SOLO</i>
      </div>

      <div className="rpg-command-scroll">
        {!selection ? (
          <div className="rpg-route-intro">
            <span className="rpg-kicker">Choose a destination</span>
            <h2>The road is yours</h2>
            <p>Tap any open tile, use the direction pad, or choose a visible trail. Every step advances time and can trigger an encounter.</p>
            <TrailChoices model={model} onPick={onPick} />
          </div>
        ) : (
          <div className="rpg-destination">
            <div className="rpg-destination-banner" style={{ backgroundImage: `linear-gradient(180deg, transparent, rgba(5,13,34,.92)), url(${focusVisual.image})`, "--focus-accent": focusVisual.accent }}>
              <button onClick={onClear} aria-label="Clear destination"><Icon name="x" size={13} color="#fff7d6" /></button>
              <span>{selection.quest ? "Quest objective" : focusBiome.name}</span>
              <h2>{selectedName}</h2>
              <small>{focusVisual.mood}</small>
            </div>

            {description && <p className="rpg-destination-copy">{description}</p>}

            <div className="rpg-reward-card" style={{ "--reward-art": `url(${rewardFrame})` }}>
              <div><small>{rewardTitle}</small><b>{rewardValue}</b></div>
              <span>{selection.quest ? "✦" : selection.visited ? "✓" : "+"}</span>
            </div>

            {journey ? (
              <>
                <div className="rpg-route-stats">
                  <div><small>Steps</small><b>{journey.legSteps}</b><span>of {journey.totalSteps}</span></div>
                  <div><small>Time</small><b>{routeMinutes}</b><span>minutes</span></div>
                  <div className={risk >= 40 ? "is-danger" : ""}><small>Danger</small><b>{risk}%</b><span>{dangerLabel(risk)}</span></div>
                </div>
                <div className="rpg-terrain-route">
                  {journey.terrainLabels.map((terrain) => <span key={terrain.id} style={{ "--segment-color": TERRAIN_INK[terrain.id], "--segment-size": terrain.count }} title={`${terrain.label}: ${terrain.count} steps`}><i /><small>{terrain.label} ×{terrain.count}</small></span>)}
                </div>
                {!journey.arrived && <p className="rpg-leg-note">This march reaches {journey.legSteps} of {journey.totalSteps} steps before the party reassesses.</p>}
              </>
            ) : <div className="rpg-route-blocked">No ground route reaches this tile from here.</div>}
          </div>
        )}
      </div>

      <div className="rpg-command-actions">
        {(canFly || teleOption) && <div className="rpg-magic-actions">
          {canFly && <button onClick={onFly}>Fly · ~{Math.min(distance, FLY_TRAVEL_HEXES) * FLY_MIN_PER_HEX} min{flightMount ? ` · ${flightMount.name}` : ` · ${flyPlan.totalCost} RP`}</button>}
          {teleOption && <button onClick={() => resolve >= teleOption.resolveCost && onTeleport(teleOption)} disabled={resolve < teleOption.resolveCost}>{teleOption.name} · {teleOption.resolveCost} RP</button>}
        </div>}
        <button onClick={onTravel} disabled={!journey || loading} className="rpg-travel-button">
          <span>{loading ? "…" : "A"}</span>
          {!selection ? "Choose a destination" : isSelf ? "You are here" : !journey ? "Route unavailable" : journey.arrived ? `Travel to ${selectedName}` : `March toward ${selectedName}`}
          <small>{journey ? `${risk}% danger` : ""}</small>
        </button>
      </div>
    </section>
  );
}

function QuestJournal({ quests, current, onClose, onPick }) {
  return (
    <div className="rpg-overlay" role="dialog" aria-modal="true" aria-label="Quest journal" style={{ "--reward-art": `url(${rewardFrame})` }}>
      <div className="rpg-overlay-head"><div><span className="rpg-kicker">Adventure log</span><h2>Quest journal</h2><p>Choose an objective to set it on your compass.</p></div><button onClick={onClose} className="rpg-square-button" aria-label="Close quest journal"><Icon name="x" size={15} color="#fff4c7" /></button></div>
      <div className="rpg-ledger-grid">
        {quests.length === 0 ? <p className="rpg-empty">No active quests. Check taverns, gaols, and village boards.</p> : quests.map((quest) => (
          <button key={quest.id} onClick={() => quest.loc && onPick(quest.loc)} disabled={!quest.loc} className="rpg-quest-card">
            <span className="rpg-card-rank">{QUEST_TYPE_LABEL[quest.type]?.[0] || "Q"}</span>
            <div><small>{QUEST_TYPE_LABEL[quest.type] || "Task"} · {quest.giver}</small><b>{quest.title}</b><em>{quest.loc ? `${hexDistance(current, quest.loc)} steps away` : "Location unknown"}</em></div>
            <strong><span>◆</span>{formatCopper(quest.rewardCp || 0)}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

function Wayfinder({ landmarks, origin, onClose, onPick }) {
  const usefulLandmarks = landmarks.filter((landmark) => landmark.quest || landmark.name || poiPlaceName(landmark.tile?.poi));
  return (
    <div className="rpg-overlay" role="dialog" aria-modal="true" aria-label="World atlas" style={{ "--reward-art": `url(${rewardFrame})` }}>
      <div className="rpg-overlay-head"><div><span className="rpg-kicker">Known world</span><h2>World atlas</h2><p>Landmarks, sanctuaries, and objectives remembered by the party.</p></div><button onClick={onClose} className="rpg-square-button" aria-label="Close world atlas"><Icon name="x" size={15} color="#fff4c7" /></button></div>
      <div className="rpg-ledger-grid rpg-ledger-grid--places">
        {usefulLandmarks.length === 0 ? <p className="rpg-empty">The horizon is still blank. Follow a road to begin charting it.</p> : usefulLandmarks.map((landmark) => {
          const biome = biomeAt(landmark);
          const visual = biomeVisual(biome.id);
          return (
            <button key={landmark.key} onClick={() => onPick(landmark)} className="rpg-place-card" style={{ "--place-art": `url(${visual.image})`, "--place-accent": visual.accent }}>
              <span>{landmark.quest ? "✦" : glyphFor(landmark.tile)}</span>
              <div><small>{landmark.quest ? "Objective" : landmark.anchor ? "Warp anchor" : biome.name}</small><b>{nameForDestination(landmark, origin)}</b><em>{directionLabel(origin, landmark).replace("-", " ")} · {landmark.distance} steps</em></div>
              <i>›</i>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WorldExploration({ state, onClose, onTravel, onFly, onTeleport, onSeekCombat, loading }) {
  const [selected, setSelected] = useState(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [wayfinderOpen, setWayfinderOpen] = useState(false);
  const [flyPanelDest, setFlyPanelDest] = useState(null);
  const model = useMemo(() => buildExplorationModel(state), [state]);
  const activeQuests = (state.world.quests || []).filter((quest) => quest.status === "active");
  const selection = selected ? model.byKey.get(`${selected.x},${selected.y}`) || {
    ...selected,
    key: `${selected.x},${selected.y}`,
    tile: getTile(state, selected.x, selected.y),
    seen: isSeen(state, selected.x, selected.y),
    visited: !!state.world.tiles?.[`${selected.x},${selected.y}`],
  } : null;
  const journey = planAtlasJourney(state, selected, WORLD_MARCH_LIMIT);
  const routeMinutes = journey ? pathMinutes(state, journey.legPath) : 0;
  const risk = journey ? pathRiskPercent(state, journey.legPath) : 0;
  const selectedName = selection ? nameForDestination(selection, model.origin) : currentLocationName(state);
  const isSelf = selection && selection.x === model.origin.x && selection.y === model.origin.y;

  const spells = knownTravelSpells(state.character);
  const teleSpells = spells.filter((spell) => spell.mode === "teleport");
  const flyPlan = flyMulticastPlan(state);
  const flightMount = playerFlightMount(state);
  const distance = selected ? hexDistance(model.origin, selected) : 0;
  const canFly = !!selected && !isSelf && !loading && (flyPlan.casters.length > 0 || flightMount);
  const teleOption = selected && !isSelf && !loading
    ? teleSpells.find((spell) => (isFinite(spell.range) ? (selection?.seen && distance <= spell.range) : isTeleportAnchor(state, selected.x, selected.y)))
    : null;

  const currentCoordinateBiome = getBiome(model.origin.x, model.origin.y);
  const currentBiomeId = sceneBiomeId(currentCoordinateBiome.id, model.current.tile);
  const currentBiome = currentBiomeId === "whitemarch" ? { ...currentCoordinateBiome, id: "whitemarch", name: "Whitemarch" } : currentCoordinateBiome;
  const currentVisual = biomeVisual(currentBiome.id);
  const focusDestination = selection || model.current;
  const focusBiome = biomeAt(focusDestination);
  const focusVisual = biomeVisual(focusBiome.id);
  const hour = state.time?.hour ?? 12;

  function pick(destination) {
    setSelected({ x: destination.x, y: destination.y });
    setJournalOpen(false);
    setWayfinderOpen(false);
  }

  function stepCursor(dx, dy) {
    const base = selected || model.origin;
    const next = model.viewport.find((cell) => cell.x === base.x + dx && cell.y === base.y + dy);
    if (next?.seen && next.passable && !next.current) pick(next);
  }

  function handleFlySelection() {
    if (flightMount || flyPlan.casts <= 1) onFly(selected);
    else setFlyPanelDest(selected);
  }

  return (
    <div className="exploration-shell rpg-exploration-shell" style={{ "--rpg-accent": currentVisual.accent, "--rpg-primary": currentVisual.primary, "--rpg-deep": currentVisual.deep }}>
      <RpgHeader state={state} biome={currentBiome} onClose={onClose} onWayfinder={() => setWayfinderOpen(true)} />
      <div className="rpg-exploration-body">
        <WorldGrid model={model} selection={selection} journey={journey} onPick={pick} onStep={stepCursor} onClear={() => setSelected(null)} onJournal={() => setJournalOpen(true)} onWayfinder={() => setWayfinderOpen(true)} onSeekCombat={onSeekCombat} questCount={activeQuests.length} loading={loading} night={hour < 6 || hour >= 20} />
        <DestinationPanel state={state} model={model} selection={selection} selectedName={selectedName} journey={journey} routeMinutes={routeMinutes} risk={risk} focusBiome={focusBiome} focusVisual={focusVisual} onClear={() => setSelected(null)} onPick={pick} onTravel={() => journey && !loading && onTravel(selected, journey.fullPath)} canFly={canFly} teleOption={teleOption} onFly={handleFlySelection} onTeleport={(spell) => onTeleport(selected, spell.id)} flightMount={flightMount} flyPlan={flyPlan} resolve={state.character.resolve ?? 0} loading={loading} />
      </div>
      {journalOpen && <QuestJournal quests={activeQuests} current={model.origin} onClose={() => setJournalOpen(false)} onPick={pick} />}
      {wayfinderOpen && <Wayfinder landmarks={model.landmarks} origin={model.origin} onClose={() => setWayfinderOpen(false)} onPick={pick} />}
      {flyPanelDest && <AtlasFlyPanel plan={flyPlan} destination={selectedName} onCancel={() => setFlyPanelDest(null)} onConfirm={(assign) => { const destination = flyPanelDest; setFlyPanelDest(null); onFly(destination, assign); }} />}
    </div>
  );
}

function AtlasFlyPanel({ plan, destination, onCancel, onConfirm }) {
  const [assign, setAssign] = useState(plan.autoAssign);
  const costs = assignmentCost(assign, plan.flyCost);
  const valid = assignmentValid(assign, plan.casters, plan.flyCost);
  return (
    <div className="atlas-modal-backdrop" onClick={onCancel}>
      <div className="atlas-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Assign flight casters">
        <div className="rpg-overlay-head"><div><span className="rpg-kicker">Arcane passage</span><h2>Take wing</h2></div><button onClick={onCancel} className="rpg-square-button"><Icon name="x" size={13} color="#d7f5ff" /></button></div>
        <p>To {destination}. One casting bears one soul; choose who carries each traveller.</p>
        {plan.passengers.map((passenger) => <label key={passenger.id} className="atlas-assign-row"><span>{passenger.name}{passenger.kind === "player" ? " (you)" : ""}</span><select value={assign[passenger.id] ?? ""} onChange={(event) => setAssign({ ...assign, [passenger.id]: event.target.value })}>{plan.casters.map((caster) => <option key={caster.id} value={caster.id}>flown by {caster.name}</option>)}</select></label>)}
        <div className="atlas-caster-costs">{plan.casters.map((caster) => <span key={caster.id}>{caster.name}: {caster.resolve} → {caster.resolve - (costs[caster.id] || 0)}</span>)}</div>
        <button onClick={() => valid && onConfirm(assign)} disabled={!valid} className="rpg-travel-button rpg-travel-button--sky"><span>A</span>{valid ? `Take wing · ${plan.totalCost} resolve` : "Not enough resolve"}</button>
      </div>
    </div>
  );
}
