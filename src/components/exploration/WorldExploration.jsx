import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "../Icon.jsx";
import { FLY_MIN_PER_HEX, FLY_TRAVEL_HEXES, WORLD_MARCH_LIMIT } from "../../config.js";
import { TERRAINS } from "../../data/terrains.js";
import { getBiome, getBiomeById } from "../../data/biomes.js";
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
import { pathRiskPercent } from "../../engine/encounters.js";
import { flyMulticastPlan, assignmentCost, assignmentValid } from "../../engine/fly.js";
import { playerFlightMount } from "../../engine/riding.js";
import { formatDate, formatTime } from "../../engine/time.js";
import { coinsToCopper, formatCopper } from "../../engine/economy.js";
import { poiPlaceName } from "../../engine/location.js";
import {
  TERRAIN_INK,
  buildExplorationModel,
  directionLabel,
  planAtlasJourney,
} from "./atlasModel.js";
import { MapCanvas } from "./MapCanvas.jsx";
import { ContinentAtlas } from "./ContinentAtlas.jsx";
import { buildWorldMapScene } from "./mapSceneModel.js";
import partyArt from "../../assets/generated/scene-tellmar-road-v2.webp";
import seekEncounterIcon from "../../assets/generated/ui-seek-encounter.png";
import rewardArt from "../../assets/generated/scene-whitemarch-march-v2.webp";
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

function cityDistrict(tile) {
  return tile?.districtName
    || tile?.district
    || tile?.poi?.districtName
    || tile?.poi?.parentName
    || null;
}

function capitalName(tile) {
  if (!tile?.cityId) return null;
  return tile.cityName || (tile.cityId === "whitemarch" ? "Whitemarch" : tile.cityId);
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

function biomeAt(destination, seed) {
  const coordinateBiome = getBiomeById(destination.tile?.regionId) || getBiome(destination.x, destination.y, seed);
  const id = sceneBiomeId(coordinateBiome.id, destination.tile);
  return id === "whitemarch" ? { ...coordinateBiome, id, name: "Whitemarch" } : coordinateBiome;
}

function RpgHeader({ state, biome, tile, onClose, onWayfinder }) {
  const vitality = state.character.vitality ?? 0;
  const vitalityMax = Math.max(1, state.character.vitalityMax ?? vitality);
  const resolve = state.character.resolve ?? 0;
  const resolveMax = Math.max(1, state.character.resolveMax ?? resolve);
  const vitalityDisplay = Math.ceil(vitality);
  const vitalityMaxDisplay = Math.ceil(vitalityMax);
  const resolveDisplay = Math.ceil(resolve);
  const resolveMaxDisplay = Math.ceil(resolveMax);
  const coin = coinsToCopper(state.character.inventory?.coins || {});
  const city = capitalName(tile);
  const district = cityDistrict(tile);
  return (
    <header className="rpg-map-header">
      <button onClick={onClose} className="rpg-square-button" aria-label="Return to story"><Icon name="back" size={21} /></button>
      <div className="rpg-location-lockup">
        <span>{city ? `${city} · unified city map` : `${biome.name} · overworld`}</span>
        <h1>{currentLocationName(state)}</h1>
        <small>{formatDate(state.time)} · {formatTime(state.time)}{district ? ` · ${district}` : ""}</small>
      </div>
      <div className="rpg-vitals" aria-label="Party status">
        <div className="rpg-vital rpg-vital--hp" role="meter" aria-label="Health" aria-valuemin="0" aria-valuemax={vitalityMaxDisplay} aria-valuenow={vitalityDisplay}><span>HP</span><i aria-hidden="true"><b style={{ width: `${Math.min(100, vitality / vitalityMax * 100)}%` }} /></i><strong>{vitalityDisplay}/{vitalityMaxDisplay}</strong></div>
        <div className="rpg-vital rpg-vital--mp" role="meter" aria-label="Resolve" aria-valuemin="0" aria-valuemax={resolveMaxDisplay} aria-valuenow={resolveDisplay}><span>RP</span><i aria-hidden="true"><b style={{ width: `${Math.min(100, resolve / resolveMax * 100)}%` }} /></i><strong>{resolveDisplay}/{resolveMaxDisplay}</strong></div>
        <div className="rpg-coin"><span>◆</span>{formatCopper(coin)}</div>
      </div>
      <button onClick={onWayfinder} className="rpg-square-button" aria-label="Open world atlas"><Icon name="atlas" size={22} /></button>
    </header>
  );
}

function WorldGrid({ model, selection, journey, onPick, onJournal, onWayfinder, onSeekCombat, questCount, loading, night, city, district }) {
  const mapScene = useMemo(() => buildWorldMapScene({ model, selection, journey, night }), [model, selection, journey, night]);
  const accessibleCells = useMemo(() => model.viewport
    .filter((cell) => cell.seen && cell.passable && !cell.current)
    .map((cell) => ({
      key: cell.key,
      label: `${nameForDestination(cell, model.origin)}, ${directionLabel(model.origin, cell).replace("-", " ")}${cell.quest ? `, quest: ${cell.quest.title}` : ""}`,
    })), [model]);

  function selectMapCell(key) {
    const cell = model.viewport.find((candidate) => candidate.key === key);
    if (cell?.seen && cell.passable && !cell.current) onPick(cell);
  }

  return (
    <main className={`rpg-world-stage canvas-world-stage ${city ? "is-capital" : ""} ${night ? "is-night" : ""}`}>
      <MapCanvas scene={mapScene} onSelect={selectMapCell} label="Interactive world exploration map" choices={accessibleCells} selectedKey={selection?.key} />
      <div className="rpg-quickbar" aria-label="Exploration tools">
        <button onClick={onWayfinder} aria-label="Open world atlas">
          <Icon name="atlas" size={22} />
          <span><small>Known world</small><strong>Atlas</strong></span>
        </button>
        <button onClick={onJournal} aria-label={questCount > 0 ? `Open quest journal, ${questCount} active ${questCount === 1 ? "quest" : "quests"}` : "Open quest journal"}>
          <Icon name="journal" size={22} />
          <span><small>Adventure log</small><strong>Journal</strong></span>
          {questCount > 0 && <b className="rpg-tool-count" aria-hidden="true">{questCount}</b>}
        </button>
      </div>

      {selection && !model.viewport.some((cell) => cell.key === selection.key) && <div className="rpg-offscreen-target"><span>✦</span><b>Compass locked</b><small>{directionLabel(model.origin, selection).replace("-", " ")}</small></div>}

      {(city && district || onSeekCombat) && (
        <div className="rpg-map-corner-controls">
          {city && district && <div className="rpg-city-district-chip"><span aria-hidden="true">◆</span><small>{city}</small><b>{district}</b></div>}
          {onSeekCombat && (
            <button
              onClick={onSeekCombat}
              disabled={loading}
              className="rpg-wild-encounter"
              aria-label={city ? "Look for trouble in the city" : "Seek a hostile encounter"}
              title={city ? "Look for trouble in the city" : "Seek a hostile encounter"}
            >
              <img src={seekEncounterIcon} alt="" />
              <span><small>{city ? "Street encounter" : "Wild encounter"}</small><b>{city ? "Seek trouble" : "Seek a fight"}</b></span>
            </button>
          )}
        </div>
      )}
    </main>
  );
}

function DestinationPanel({ state, model, selection, selectedName, journey, routeMinutes, risk, focusBiome, focusVisual, onClear, onTravel, canFly, teleOption, onFly, onTeleport, flightMount, flyPlan, resolve, loading }) {
  const distance = selection ? hexDistance(model.origin, selection) : 0;
  const isSelf = selection && selection.x === model.origin.x && selection.y === model.origin.y;
  const description = selection?.tile?.poi?.description || (selection ? TERRAINS[selection.tile?.terrain]?.flavor : null);
  const rewardTitle = selection?.quest ? "Quest reward" : selection?.visited ? "Known waypoint" : "Discovery ahead";
  const rewardValue = selection?.quest ? formatCopper(selection.quest.rewardCp || 0) : selection?.visited ? "Route recorded" : "New atlas entry";
  const focusDistrict = cityDistrict(selection?.tile);
  const urbanRoute = !!selection?.tile?.cityId && selection.tile.cityId === model.current.tile?.cityId;
  return (
    <section className={`rpg-command-panel ${selection ? "has-selection" : "is-awaiting-destination"}`}>
      <div className="rpg-party-card">
        <div className="rpg-party-portrait"><img src={partyArt} alt="" /></div>
        <div><small>Party leader</small><b>{state.character.name || "Wanderer"}</b><span>{state.character.race || "Adventurer"} · ready</span></div>
        <i>SOLO</i>
      </div>

      <div className="rpg-command-scroll">
        {!selection ? (
          <div className="rpg-route-intro">
            <span className="rpg-kicker">Plan a journey</span>
            <h2>Choose on the map</h2>
            <p>Tap any revealed, walkable tile to preview its route, travel time, and danger before committing.</p>
            <div className="rpg-map-tap-hint" aria-label="Travel in two steps: tap a tile, then confirm travel">
              <span>1</span><b>Tap a tile</b><i>→</i><span>2</span><b>Confirm travel</b>
            </div>
          </div>
        ) : (
          <div className="rpg-destination" aria-live="polite">
            <div className="rpg-destination-banner" style={{ backgroundImage: `linear-gradient(180deg, transparent, rgba(5,13,34,.92)), url(${focusVisual.image})`, "--focus-accent": focusVisual.accent }}>
              <button onClick={onClear} aria-label="Clear destination"><Icon name="x" size={13} color="#fff7d6" /></button>
              <span>{selection.quest ? "Quest objective" : focusDistrict || focusBiome.name}</span>
              <h2>{selectedName}</h2>
              <small>{focusVisual.mood}</small>
            </div>

            {description && <p className="rpg-destination-copy">{description}</p>}

            <div className="rpg-reward-card" style={{ "--reward-art": `url(${rewardArt})` }}>
              <div><small>{rewardTitle}</small><b>{rewardValue}</b></div>
              <span>{selection.quest ? "✦" : selection.visited ? "✓" : "+"}</span>
            </div>

            {journey ? (
              <>
                <div className="rpg-route-stats">
                  <div><small>{urbanRoute ? "Blocks" : "Steps"}</small><b>{journey.legSteps}</b><span>of {journey.totalSteps}</span></div>
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

      {selection && <div className="rpg-command-actions">
        {(canFly || teleOption) && <div className="rpg-magic-actions">
          {canFly && <button onClick={onFly}>Fly · ~{Math.min(distance, FLY_TRAVEL_HEXES) * FLY_MIN_PER_HEX} min{flightMount ? ` · ${flightMount.name}` : ` · ${flyPlan.totalCost} RP`}</button>}
          {teleOption && <button onClick={() => resolve >= teleOption.resolveCost && onTeleport(teleOption)} disabled={resolve < teleOption.resolveCost}>{teleOption.name} · {teleOption.resolveCost} RP</button>}
        </div>}
        <button onClick={onTravel} disabled={!journey || loading} className="rpg-travel-button">
          <span aria-hidden="true">{loading ? "…" : "✓"}</span>
          {!selection ? "Choose a destination" : isSelf ? "You are here" : !journey ? "Route unavailable" : journey.arrived ? `Travel to ${selectedName}` : `March toward ${selectedName}`}
          <small>{journey ? `${risk}% danger` : ""}</small>
        </button>
      </div>}
    </section>
  );
}

function FolioOverview({ items }) {
  return (
    <div className="rpg-folio-overview" aria-label="Page summary">
      {items.map((item) => (
        <div key={item.label}>
          <span aria-hidden="true"><Icon name={item.icon} size={16} strokeWidth={1.5} /></span>
          <p><small>{item.label}</small><b>{item.value}</b></p>
        </div>
      ))}
    </div>
  );
}

function QuestJournalPage({ quests, current, onPick }) {
  const located = quests.filter((quest) => quest.loc).length;
  const rewards = quests.reduce((sum, quest) => sum + (quest.rewardCp || 0), 0);
  return (
    <div className="rpg-folio-page rpg-folio-page--quests">
      <FolioOverview items={[
        { label: "Active", value: quests.length, icon: "journal" },
        { label: "Charted", value: `${located}/${quests.length || 0}`, icon: "compass" },
        { label: "Rewards", value: formatCopper(rewards), icon: "sparkle" },
      ]} />
      {quests.length === 0 ? (
        <div className="rpg-folio-empty"><Icon name="journal" size={30} /><h3>No open entries</h3><p>Check taverns, gaols, and village boards for work worth recording.</p></div>
      ) : (
        <div className="rpg-folio-grid rpg-folio-grid--quests">
          {quests.map((quest) => {
            const type = QUEST_TYPE_LABEL[quest.type] || "Task";
            const distance = quest.loc ? hexDistance(current, quest.loc) : null;
            return (
              <button key={quest.id} onClick={() => quest.loc && onPick(quest.loc)} disabled={!quest.loc} className="rpg-folio-card rpg-folio-quest">
                <span className="rpg-folio-quest__sigil" aria-hidden="true">{type[0]}</span>
                <span className="rpg-folio-card__copy">
                  <small>{type} · {quest.giver || "Unknown patron"}</small>
                  <strong>{quest.title}</strong>
                  <em>{distance === null ? "Location not yet charted" : `${distance} ${distance === 1 ? "step" : "steps"} from your camp`}</em>
                  <span className="rpg-folio-card__action"><Icon name="compass" size={13} />{quest.loc ? "Set on compass" : "Awaiting a lead"}</span>
                </span>
                <span className="rpg-folio-quest__reward"><small>Reward</small><b>◆ {formatCopper(quest.rewardCp || 0)}</b></span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WorldAtlasPage({ state, landmarks, origin, onPick }) {
  const usefulLandmarks = landmarks.filter((landmark) => landmark.quest || landmark.name || poiPlaceName(landmark.tile?.poi));
  const anchors = usefulLandmarks.filter((landmark) => landmark.anchor).length;
  const objectives = usefulLandmarks.filter((landmark) => landmark.quest).length;
  return (
    <div className="rpg-folio-page rpg-folio-page--atlas">
      <ContinentAtlas state={state} origin={origin} onPick={onPick} />
      <FolioOverview items={[
        { label: "Known places", value: usefulLandmarks.length, icon: "atlas" },
        { label: "Warp anchors", value: anchors, icon: "sparkle" },
        { label: "Objectives", value: objectives, icon: "compass" },
      ]} />
      {usefulLandmarks.length === 0 ? (
        <div className="rpg-folio-empty"><Icon name="atlas" size={30} /><h3>An unmarked horizon</h3><p>Follow a road or climb to high ground to begin charting the world.</p></div>
      ) : (
        <div className="rpg-folio-grid rpg-folio-grid--places">
          {usefulLandmarks.map((landmark) => {
            const biome = biomeAt(landmark, state.world.seed);
            const visual = biomeVisual(biome.id);
            const kind = landmark.quest ? "Objective" : landmark.anchor ? "Warp anchor" : biome.name;
            return (
              <button key={landmark.key} onClick={() => onPick(landmark)} className="rpg-folio-card rpg-folio-place" style={{ "--place-art": `url(${visual.image})`, "--place-accent": visual.accent }}>
                <span className="rpg-folio-place__art" aria-hidden="true"><i>{landmark.quest ? "✦" : glyphFor(landmark.tile)}</i></span>
                <span className="rpg-folio-card__copy">
                  <small>{kind}</small>
                  <strong>{nameForDestination(landmark, origin)}</strong>
                  <em>{directionLabel(origin, landmark).replace("-", " ")} · {landmark.distance} {landmark.distance === 1 ? "step" : "steps"}</em>
                  <span className="rpg-folio-card__action"><Icon name="compass" size={13} />Chart a route</span>
                </span>
                <span className="rpg-folio-card__arrow" aria-hidden="true">›</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AdventureFolio({ state, page, quests, landmarks, origin, onPage, onClose, onPick }) {
  const tabs = [
    { id: "atlas", label: "World atlas", icon: "atlas", count: landmarks.filter((landmark) => landmark.quest || landmark.name || poiPlaceName(landmark.tile?.poi)).length },
    { id: "quests", label: "Quest journal", icon: "journal", count: quests.length },
  ];
  const title = page === "quests" ? "Quest Journal" : "World Atlas";
  const description = page === "quests"
    ? "Open obligations, promised rewards, and the next trail to follow."
    : "Landmarks, sanctuaries, and roads remembered by the party.";
  return (
    <div className="rpg-folio-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="rpg-folio" role="dialog" aria-modal="true" aria-labelledby="rpg-folio-title">
        <header className="rpg-folio-hero">
          <button onClick={onClose} className="rpg-square-button rpg-folio-close" aria-label={`Close ${title.toLowerCase()}`}><Icon name="close" size={20} /></button>
          <div className="rpg-folio-identity">
            <small>Wayfinder's folio</small>
            <h2 id="rpg-folio-title">{title}</h2>
            <p>{description}</p>
          </div>
          <div className="rpg-folio-tabs" role="tablist" aria-label="Folio sections">
            {tabs.map((tab) => (
              <button key={tab.id} id={`rpg-folio-tab-${tab.id}`} type="button" className={page === tab.id ? "is-active" : ""} onClick={() => onPage(tab.id)} role="tab" aria-selected={page === tab.id} aria-controls={`rpg-folio-panel-${tab.id}`}>
                <Icon name={tab.icon} size={16} strokeWidth={1.5} />
                <span>{tab.label}</span>
                <b>{tab.count}</b>
              </button>
            ))}
          </div>
        </header>
        <div key={page} id={`rpg-folio-panel-${page}`} className={`rpg-folio-body rpg-folio-body--${page}`} role="tabpanel" aria-labelledby={`rpg-folio-tab-${page}`}>
          {page === "quests"
            ? <QuestJournalPage quests={quests} current={origin} onPick={onPick} />
            : <WorldAtlasPage state={state} landmarks={landmarks} origin={origin} onPick={onPick} />}
        </div>
      </section>
    </div>
  );
}

export function WorldExploration({ state, onClose, onTravel, onFly, onTeleport, onSeekCombat, loading }) {
  const [selected, setSelected] = useState(null);
  const [folioPage, setFolioPage] = useState(null);
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
  const journey = useMemo(
    () => planAtlasJourney(state, selected, WORLD_MARCH_LIMIT),
    [state, selected],
  );
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

  const currentCoordinateBiome = getBiomeById(model.current.tile?.regionId) || getBiome(model.origin.x, model.origin.y, state.world.seed);
  const currentBiomeId = sceneBiomeId(currentCoordinateBiome.id, model.current.tile);
  const currentBiome = currentBiomeId === "whitemarch" ? { ...currentCoordinateBiome, id: "whitemarch", name: "Whitemarch" } : currentCoordinateBiome;
  const currentVisual = biomeVisual(currentBiome.id);
  const currentCity = capitalName(model.current.tile);
  const currentDistrict = cityDistrict(model.current.tile);
  const focusDestination = selection || model.current;
  const focusBiome = biomeAt(focusDestination, state.world.seed);
  const focusVisual = biomeVisual(focusBiome.id);
  const hour = state.time?.hour ?? 12;

  useEffect(() => {
    if (!folioPage && !flyPanelDest) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (flyPanelDest) setFlyPanelDest(null);
      else setFolioPage(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flyPanelDest, folioPage]);

  function pick(destination) {
    setSelected({ x: destination.x, y: destination.y });
    setFolioPage(null);
  }

  function handleFlySelection() {
    if (flightMount || flyPlan.casts <= 1) onFly(selected);
    else setFlyPanelDest(selected);
  }

  return (
    <div className={`exploration-shell rpg-exploration-shell ${currentCity ? "is-capital-map" : ""}`} style={{ "--rpg-accent": currentVisual.accent, "--rpg-primary": currentVisual.primary, "--rpg-deep": currentVisual.deep }}>
      <RpgHeader state={state} biome={currentBiome} tile={model.current.tile} onClose={onClose} onWayfinder={() => setFolioPage("atlas")} />
      <div className="rpg-exploration-body">
        <WorldGrid model={model} selection={selection} journey={journey} onPick={pick} onJournal={() => setFolioPage("quests")} onWayfinder={() => setFolioPage("atlas")} onSeekCombat={onSeekCombat} questCount={activeQuests.length} loading={loading} night={hour < 6 || hour >= 20} city={currentCity} district={currentDistrict} />
        <DestinationPanel state={state} model={model} selection={selection} selectedName={selectedName} journey={journey} routeMinutes={routeMinutes} risk={risk} focusBiome={focusBiome} focusVisual={focusVisual} onClear={() => setSelected(null)} onTravel={() => journey && !loading && onTravel(selected, journey.fullPath)} canFly={canFly} teleOption={teleOption} onFly={handleFlySelection} onTeleport={(spell) => onTeleport(selected, spell.id)} flightMount={flightMount} flyPlan={flyPlan} resolve={state.character.resolve ?? 0} loading={loading} />
      </div>
      {folioPage && <AdventureFolio state={state} page={folioPage} quests={activeQuests} landmarks={model.landmarks} origin={model.origin} onPage={setFolioPage} onClose={() => setFolioPage(null)} onPick={pick} />}
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
        <button onClick={() => valid && onConfirm(assign)} disabled={!valid} className="rpg-travel-button rpg-travel-button--sky"><span aria-hidden="true">↑</span>{valid ? `Take wing · ${plan.totalCost} resolve` : "Not enough resolve"}</button>
      </div>
    </div>
  );
}
