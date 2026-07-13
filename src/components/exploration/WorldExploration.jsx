import React, { useMemo, useState } from "react";
import { Icon } from "../Icon.jsx";
import { colors } from "../tokens.js";
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
import { formatCopper } from "../../engine/economy.js";
import { poiPlaceName } from "../../engine/location.js";
import {
  TERRAIN_INK,
  buildExplorationModel,
  directionLabel,
  directionShort,
  planAtlasJourney,
} from "./atlasModel.js";
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
  if (risk >= 65) return "Severe";
  if (risk >= 40) return "Unsettled";
  if (risk >= 20) return "Watchful";
  return "Favorable";
}

function trailPath(scene) {
  const x = scene.x * 10;
  const y = scene.y * 6.2;
  const bend = (x - 500) * 0.18;
  return `M 500 650 C ${500 - bend} 560, ${x - bend} ${Math.max(y + 86, 390)}, ${x} ${y}`;
}

function biomeAt(destination) {
  const coordinateBiome = getBiome(destination.x, destination.y);
  const id = sceneBiomeId(coordinateBiome.id, destination.tile);
  return id === "whitemarch" ? { ...coordinateBiome, id, name: "Whitemarch" } : coordinateBiome;
}

function QuestJournal({ quests, current, onClose, onPick }) {
  return (
    <div className="trail-overlay" role="dialog" aria-modal="true" aria-label="Quest journal">
      <div className="trail-overlay-head">
        <div><span className="atlas-kicker">Pinned objectives</span><h2>Quest journal</h2><p>Choose an objective to set it on your compass.</p></div>
        <button onClick={onClose} className="atlas-icon-button" aria-label="Close quest journal"><Icon name="x" size={14} color={colors.parchmentMuted} /></button>
      </div>
      <div className="trail-ledger-list">
        {quests.length === 0 ? <p className="atlas-empty">No active trails. Read the boards at taverns and gaols.</p> : quests.map((quest) => (
          <button key={quest.id} className="trail-ledger-card trail-ledger-card--quest" onClick={() => quest.loc && onPick(quest.loc)} disabled={!quest.loc}>
            <span className="trail-ledger-glyph">✦</span>
            <span className="trail-ledger-copy"><b>{quest.title}</b><small>{QUEST_TYPE_LABEL[quest.type] || "Task"} · {quest.giver}{quest.loc ? ` · ${hexDistance(current, quest.loc)} steps` : ""}</small></span>
            <span className="trail-ledger-reward">{formatCopper(quest.rewardCp || 0)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Wayfinder({ landmarks, origin, onClose, onPick }) {
  return (
    <div className="trail-overlay" role="dialog" aria-modal="true" aria-label="Known destinations">
      <div className="trail-overlay-head">
        <div><span className="atlas-kicker">Your remembered world</span><h2>Known horizons</h2><p>Landmarks, sanctuaries, and objectives you can navigate toward.</p></div>
        <button onClick={onClose} className="atlas-icon-button" aria-label="Close known destinations"><Icon name="x" size={14} color={colors.parchmentMuted} /></button>
      </div>
      <div className="trail-ledger-list trail-ledger-list--places">
        {landmarks.length === 0 ? <p className="atlas-empty">The horizon is still blank. Follow a trail to begin charting it.</p> : landmarks.map((landmark) => {
          const biome = biomeAt(landmark);
          const visual = biomeVisual(biome.id);
          return (
            <button key={landmark.key} className="trail-ledger-card" onClick={() => onPick(landmark)} style={{ "--ledger-image": `url(${visual.image})`, "--ledger-accent": visual.accent }}>
              <span className="trail-ledger-glyph">{landmark.quest ? "✦" : glyphFor(landmark.tile)}</span>
              <span className="trail-ledger-copy"><b>{nameForDestination(landmark, origin)}</b><small>{directionLabel(origin, landmark).replace("-", " ")} · {landmark.distance} steps · {biome.name}</small></span>
              <span className="trail-ledger-tag">{landmark.quest ? "objective" : landmark.anchor ? "anchor" : "known"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TrailStage({ model, currentName, currentVisual, selectedKey, onPick, onOpenWayfinder, onOpenJournal, onSeekCombat, questCount, loading, night }) {
  const choiceKeys = new Set(model.choices.map((choice) => choice.key));
  const distantSelection = selectedKey && !choiceKeys.has(selectedKey);
  return (
    <main className={`trail-stage ${night ? "is-night" : ""}`} style={{ backgroundImage: `url(${currentVisual.image})` }}>
      <div className="trail-atmosphere" />
      <div className="trail-top-actions">
        <button onClick={onOpenWayfinder} className="trail-tool" aria-label="Known horizons"><Icon name="map" size={14} color="#ffe2a7" /><span>Known horizons</span></button>
        <button onClick={onOpenJournal} className="trail-tool" aria-label="Quests"><Icon name="book" size={14} color="#ffe2a7" /><span>Quests</span>{questCount > 0 && <b>{questCount}</b>}</button>
        {onSeekCombat && <button onClick={onSeekCombat} disabled={loading} className="trail-tool trail-tool--danger" aria-label="Seek trouble"><Icon name="swords" size={14} color="#ffc1b7" /><span>Seek trouble</span></button>}
      </div>

      <svg className="trail-route-field" viewBox="0 0 1000 650" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <filter id="trailGlow"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {model.choices.map((choice) => <path key={`shadow-${choice.key}`} d={trailPath(choice.scene)} className="trail-route-shadow" />)}
        {model.choices.map((choice) => <path key={choice.key} d={trailPath(choice.scene)} className={`trail-route-line ${selectedKey === choice.key ? "is-selected" : ""}`} filter={selectedKey === choice.key ? "url(#trailGlow)" : undefined} />)}
      </svg>

      <div className="trail-route-markers" aria-label="Paths from here">
        {model.choices.map((choice) => {
          const chosen = selectedKey === choice.key;
          const title = nameForDestination(choice, model.origin);
          return (
            <button key={choice.key} onClick={() => onPick(choice)} className={`trail-marker ${chosen ? "is-selected" : ""}`} style={{ "--route-x": choice.scene.x, "--route-y": choice.scene.y }} aria-pressed={chosen} aria-label={`${title}, ${choice.direction}, ${choice.steps} ${choice.steps === 1 ? "step" : "steps"}`}>
              {choice.quest && <span className="trail-marker-quest">✦</span>}
              <span className="trail-marker-icon">{glyphFor(choice.tile)}</span>
              <span className="trail-marker-copy"><b>{title}</b><small>{directionShort(choice.direction)} · {choice.steps} {choice.steps === 1 ? "step" : "steps"}</small></span>
            </button>
          );
        })}
      </div>

      {distantSelection && <div className="trail-distant-beacon"><span>✦</span><small>Compass set beyond the horizon</small></div>}

      <div className="trail-party">
        <span className="trail-party-avatar">♟</span>
        <div><small>You are here</small><b>{currentName}</b></div>
      </div>
      {model.choices.length === 0 && <div className="trail-no-path"><b>No visible trail</b><span>Darkness or hard terrain hides every way forward.</span></div>}
    </main>
  );
}

function ExpeditionPanel({ state, model, selection, selectedName, journey, routeMinutes, risk, focusBiome, focusVisual, onClear, onPick, onTravel, canFly, teleOption, onFly, onTeleport, flightMount, flyPlan, resolve, loading }) {
  const selected = !!selection;
  const isSelf = selection && selection.x === model.origin.x && selection.y === model.origin.y;
  const distance = selection ? hexDistance(model.origin, selection) : 0;
  const description = selection?.tile?.poi?.description
    || (selection ? TERRAINS[selection.tile?.terrain]?.flavor : `${currentLocationName(state)}. Read the landscape and choose how the expedition continues.`);
  return (
    <section className="expedition-panel">
      <div className="expedition-scroll">
        {!selected ? (
          <div className="expedition-intro">
            <span className="atlas-kicker">The road is the map</span>
            <h2>Choose what lies ahead</h2>
            <p>Each signpost follows the visible trail several steps into the country. Push onward, or set your compass to a known horizon.</p>
            <div className="expedition-choice-list">
              {model.choices.map((choice) => (
                <button key={choice.key} onClick={() => onPick(choice)} className="expedition-choice">
                  <span style={{ "--choice-color": terrainVisual(choice.tile.terrain).tint }}>{glyphFor(choice.tile)}</span>
                  <div><small>{choice.direction.replace("-", " ")} · {choice.steps} {choice.steps === 1 ? "step" : "steps"}</small><b>{nameForDestination(choice, model.origin)}</b><em>{describeEncounterPotential(choice.tile, choice.x, choice.y) || "open trail"}</em></div>
                  <i>›</i>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="expedition-destination">
            <div className="expedition-poster" style={{ backgroundImage: `url(${focusVisual.image})`, "--focus-accent": focusVisual.accent }}>
              <button onClick={onClear} className="expedition-clear" aria-label="Clear destination"><Icon name="x" size={13} color="#fff1d0" /></button>
              <div className="expedition-poster-copy"><span>{selection.quest ? "✦" : focusVisual.symbol}</span><small>{selection.quest ? "Quest trail" : focusBiome.name}</small><h2>{selectedName}</h2><p>{focusVisual.mood}</p></div>
            </div>

            <p className="expedition-description">{description}</p>
            {journey ? (
              <>
                <div className="expedition-stats">
                  <div><small>Distance</small><b>{journey.legSteps}</b><span>steps</span></div>
                  <div><small>Travel</small><b>{routeMinutes}</b><span>minutes</span></div>
                  <div className={risk >= 45 ? "is-danger" : ""}><small>Outlook</small><b>{risk}%</b><span>{dangerLabel(risk)}</span></div>
                </div>
                <div className="expedition-route-preview" aria-label="Route terrain">
                  {journey.terrainLabels.map((terrain) => <span key={terrain.id} style={{ "--segment-color": TERRAIN_INK[terrain.id], "--segment-size": terrain.count }} title={`${terrain.label}: ${terrain.count} steps`}><i /> <small>{terrain.label} ×{terrain.count}</small></span>)}
                </div>
                {!journey.arrived && <p className="expedition-leg-note">A single march reaches the first {journey.legSteps} of {journey.totalSteps} steps. You can reassess from there.</p>}
              </>
            ) : <div className="expedition-blocked">No safe remembered route reaches this destination yet.</div>}
          </div>
        )}
      </div>

      <div className="expedition-actions">
        {(canFly || teleOption) && <div className="atlas-magic-row">
          {canFly && <button onClick={onFly} className="atlas-action atlas-action--fly">Fly · ~{Math.min(distance, FLY_TRAVEL_HEXES) * FLY_MIN_PER_HEX} min{flightMount ? ` · ${flightMount.name}` : ` · ${flyPlan.totalCost} resolve`}</button>}
          {teleOption && <button onClick={() => resolve >= teleOption.resolveCost && onTeleport(teleOption)} disabled={resolve < teleOption.resolveCost} className="atlas-action atlas-action--teleport">{teleOption.name} · {teleOption.resolveCost} resolve</button>}
        </div>}
        <button onClick={onTravel} disabled={!journey || loading} className="atlas-primary-action">
          {!selected ? "Choose a trail" : isSelf ? "You are here" : !journey ? "Route undiscovered" : journey.arrived ? `Begin expedition · ${risk}% danger` : `March ${journey.legSteps} steps toward ${selectedName}`}
        </button>
      </div>
    </section>
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

  function handleFlySelection() {
    if (flightMount || flyPlan.casts <= 1) onFly(selected);
    else setFlyPanelDest(selected);
  }

  return (
    <div className="exploration-shell trail-shell" style={{
      "--atlas-accent": currentVisual.accent,
      "--atlas-primary": currentVisual.primary,
      "--atlas-secondary": currentVisual.secondary,
      "--atlas-deep": currentVisual.deep,
    }}>
      <header className="exploration-header trail-header">
        <button onClick={onClose} className="atlas-icon-button" aria-label="Return to story"><Icon name="arrowLeft" size={15} color={colors.parchmentMuted} /></button>
        <div className="exploration-title"><span className="atlas-kicker">Expedition · {currentBiome.name}</span><h1>{currentLocationName(state)}</h1><small>{formatDate(state.time)} · {formatTime(state.time)}</small></div>
        <button onClick={() => setWayfinderOpen(true)} className="atlas-icon-button" aria-label="Open known horizons"><Icon name="map" size={15} color={colors.parchmentMuted} /></button>
      </header>

      <div className="trail-body">
        <TrailStage
          model={model}
          currentName={currentLocationName(state)}
          currentVisual={currentVisual}
          selectedKey={selection?.key}
          onPick={pick}
          onOpenWayfinder={() => setWayfinderOpen(true)}
          onOpenJournal={() => setJournalOpen(true)}
          onSeekCombat={onSeekCombat}
          questCount={activeQuests.length}
          loading={loading}
          night={hour < 6 || hour >= 20}
        />
        <ExpeditionPanel
          state={state}
          model={model}
          selection={selection}
          selectedName={selectedName}
          journey={journey}
          routeMinutes={routeMinutes}
          risk={risk}
          focusBiome={focusBiome}
          focusVisual={focusVisual}
          onClear={() => setSelected(null)}
          onPick={pick}
          onTravel={() => journey && !loading && onTravel(selected, journey.fullPath)}
          canFly={canFly}
          teleOption={teleOption}
          onFly={handleFlySelection}
          onTeleport={(spell) => onTeleport(selected, spell.id)}
          flightMount={flightMount}
          flyPlan={flyPlan}
          resolve={state.character.resolve ?? 0}
          loading={loading}
        />
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
        <div className="trail-overlay-head"><div><span className="atlas-kicker">Arcane passage</span><h2>Take wing</h2></div><button onClick={onCancel} className="atlas-icon-button"><Icon name="x" size={13} color="#bfe3f2" /></button></div>
        <p>To {destination}. One casting bears one soul; choose who carries each traveller.</p>
        {plan.passengers.map((passenger) => <label key={passenger.id} className="atlas-assign-row"><span>{passenger.name}{passenger.kind === "player" ? " (you)" : ""}</span><select value={assign[passenger.id] ?? ""} onChange={(event) => setAssign({ ...assign, [passenger.id]: event.target.value })}>{plan.casters.map((caster) => <option key={caster.id} value={caster.id}>flown by {caster.name}</option>)}</select></label>)}
        <div className="atlas-caster-costs">{plan.casters.map((caster) => <span key={caster.id}>{caster.name}: {caster.resolve} → {caster.resolve - (costs[caster.id] || 0)}</span>)}</div>
        <button onClick={() => valid && onConfirm(assign)} disabled={!valid} className="atlas-primary-action atlas-primary-action--sky">{valid ? `Take wing · ${plan.totalCost} resolve` : "Not enough resolve"}</button>
      </div>
    </div>
  );
}
