import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../Icon.jsx";
import { FLY_MIN_PER_HEX, FLY_TRAVEL_HEXES, WORLD_MARCH_LIMIT } from "../../config.js";
import { TERRAINS } from "../../data/terrains.js";
import { getBiome, getBiomeById } from "../../data/biomes.js";
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
import { pathRiskPercent } from "../../engine/encounters.js";
import { flyMulticastPlan, assignmentCost, assignmentValid } from "../../engine/fly.js";
import { playerFlightMount } from "../../engine/riding.js";
import { formatDate, formatTime } from "../../engine/time.js";
import { coinsToCopper, formatCopper } from "../../engine/economy.js";
import { poiPartName, poiPlaceName } from "../../engine/location.js";
import { MARKET_PRICE_TIERS } from "../../data/town.js";
import { POI_LEGEND_GROUPS } from "../../data/poi-icons.js";
import { PoiIcon, PoiTierMarker } from "../PoiIcon.jsx";
import {
  TERRAIN_INK,
  buildExplorationModel,
  directionLabel,
  planAtlasJourney,
} from "./atlasModel.js";
import { MapCanvas } from "./MapCanvas.jsx";
import { WorldAtlas } from "./WorldAtlas.jsx";
import { formatTravelDuration, journeyWaypoints } from "./worldAtlasModel.js";
import { buildWorldMapScene } from "./mapSceneModel.js";
import partyArt from "../../assets/generated/scene-tellmar-road-v2.webp";
import seekEncounterIcon from "../../assets/generated/ui-seek-encounter.png";
import rewardArt from "../../assets/generated/scene-whitemarch-march-v2.webp";
import questJournalFolioHero from "../../assets/generated/quest-journal-folio-hero-v1.png";
import "./exploration.css";

const QUEST_TYPE_LABEL = { errand: "Errand", delivery: "Delivery", hunt: "Hunt", bounty: "Bounty" };
const POI_LEGEND_HELP = Object.freeze({
  trade: "Places that sell goods or provide a practical service. Their icon tells you the specialty; a lettered ring shows the market tier and expected stock quality.",
  city: "Civic, social, and landmark venues. These are usually places for access, information, work, recovery, or story interactions rather than ordinary shopping.",
  wilderness: "Sites beyond the streets. Some offer shelter, trade, or a safer route; places labeled Danger in this guide are especially likely to involve a hostile encounter.",
});
const POI_LEGEND_ACTIONS = Object.freeze({
  "trade-general": "Everyday tools, household wares, and basic supplies.",
  "trade-provisions": "Rations, drink, camping gear, and journey supplies.",
  "trade-equipment": "Weapons, armor, clothing, and adventuring kit.",
  "trade-stable": "Mounts, stable animals, tack, feed, and care.",
  "trade-magic": "Enchanted equipment, magical foci, and arcane goods.",
  "trade-herbalist": "Herbs, field remedies, and natural ingredients.",
  "trade-alchemist": "Prepared potions, reagents, and specialist mixtures.",
  "trade-priest": "Worship, healing, offerings, and religious rites.",
  "trade-healer": "Restore health and receive treatment for wounds.",
  "trade-smith": "Buy, repair, commission, or forge equipment.",
  "trade-transport": "Hire carts, arrange passage, and discuss routes.",
  "trade-money": "Exchange coin or use secure currency services.",
  "trade-tavern": "Rest, eat, drink, hear rumors, and find work.",
  "trade-fish": "Fresh or preserved catch and local provisions.",
  "trade-chandler": "Rope, lamps, wax, oil, and practical ship goods.",
  "trade-foreign": "Imported wares, unusual materials, and rare goods.",
  "poi-palace": "Court, government offices, petitions, and royal business.",
  "poi-prison": "Wardens, prisoners, legal custody, and official access.",
  "poi-slave-market": "Bond sales, captive trade, and its interested parties.",
  "poi-inn": "Beds, meals, stabling, and services for travelers.",
  "poi-restaurant": "Prepared meals, local dining, and conversation.",
  "poi-park": "A public garden for respite, meetings, and gatherings.",
  "poi-brothel": "Paid company, entertainment, and social encounters.",
  "poi-bathhouse": "Bathing, recovery, gossip, and socializing.",
  "poi-courthouse": "Hearings, public records, petitions, and civil law.",
  "poi-guildhall": "Guild business, contracts, training, and work.",
  "poi-library": "Research, archives, records, and learned assistance.",
  "poi-barracks": "Guards, military authority, security, and restricted access.",
  "poi-docks": "Ships, ferries, cargo, crews, and onward passage.",
  "poi-warehouse": "Stored cargo, merchants, labor, and trade goods.",
  "poi-theatre": "Performances, contests, games, and public crowds.",
  "poi-cemetery": "Burials, memorials, mourners, and grave sites.",
  "wild-shrine": "Offerings, rites, local faith, and possible sanctuary.",
  "wild-monster-den": "A creature lair; expect a dangerous encounter nearby.",
  "wild-bandit-camp": "A hostile outlaw camp; approach prepared for combat.",
  "wild-merchant": "A roaming seller with limited, changing goods.",
  "wild-caravan": "Travelers offering trade, passage, and fresh road news.",
  "wild-cave": "An underground site that may hide hazards or discoveries.",
  "wild-dungeon": "A dangerous delve promising opposition and possible treasure.",
  "wild-checkpoint": "Controlled passage, inspections, tolls, or questioning.",
  "wild-ruin": "Old remains that may conceal history, hazards, or salvage.",
  "wild-fortress": "A defended stronghold with authority and armed occupants.",
  "wild-manor": "An estate, household, and seat of local authority.",
  "wild-watchtower": "A lookout for patrols, warnings, signals, and surveillance.",
  "wild-village": "Homes, local people, modest goods, and basic services.",
  "wild-mine": "Mineral workings, labor, trade, and underground access.",
  "wild-campsite": "A known place to pause, shelter, or make camp.",
  "wild-bridge": "A recognized crossing and safer route through terrain.",
});

const POI_LEGEND_TAGS = Object.freeze({
  "trade-general": ["Goods", "goods"],
  "trade-provisions": ["Supplies", "goods"],
  "trade-equipment": ["Equipment", "goods"],
  "trade-stable": ["Mounts", "travel"],
  "trade-magic": ["Arcane goods", "goods"],
  "trade-herbalist": ["Remedies", "service"],
  "trade-alchemist": ["Remedies", "service"],
  "trade-priest": ["Rites", "service"],
  "trade-healer": ["Healing", "service"],
  "trade-smith": ["Craft", "service"],
  "trade-transport": ["Travel", "travel"],
  "trade-money": ["Finance", "service"],
  "trade-tavern": ["Rest & rumors", "social"],
  "trade-fish": ["Food", "goods"],
  "trade-chandler": ["Ship goods", "goods"],
  "trade-foreign": ["Rare goods", "goods"],
  "poi-palace": ["Authority", "authority"],
  "poi-prison": ["Custody", "authority"],
  "poi-slave-market": ["Trade", "goods"],
  "poi-inn": ["Lodging", "service"],
  "poi-restaurant": ["Food", "goods"],
  "poi-park": ["Social", "social"],
  "poi-brothel": ["Social", "social"],
  "poi-bathhouse": ["Recovery", "service"],
  "poi-courthouse": ["Law", "authority"],
  "poi-guildhall": ["Work", "social"],
  "poi-library": ["Knowledge", "service"],
  "poi-barracks": ["Authority", "authority"],
  "poi-docks": ["Travel", "travel"],
  "poi-warehouse": ["Goods", "goods"],
  "poi-theatre": ["Entertainment", "social"],
  "poi-cemetery": ["Memorial", "social"],
  "wild-shrine": ["Sanctuary", "service"],
  "wild-monster-den": ["Danger", "danger"],
  "wild-bandit-camp": ["Danger", "danger"],
  "wild-merchant": ["Goods", "goods"],
  "wild-caravan": ["Trade & news", "goods"],
  "wild-cave": ["Explore", "explore"],
  "wild-dungeon": ["Danger", "danger"],
  "wild-checkpoint": ["Access", "authority"],
  "wild-ruin": ["Explore", "explore"],
  "wild-fortress": ["Defended", "danger"],
  "wild-manor": ["Authority", "authority"],
  "wild-watchtower": ["Warning", "authority"],
  "wild-village": ["Services", "service"],
  "wild-mine": ["Resources", "goods"],
  "wild-campsite": ["Shelter", "service"],
  "wild-bridge": ["Route", "travel"],
});

const MAP_GUIDE_ITEMS = Object.freeze([
  Object.freeze({ icon: "map", label: "Choose a destination", tag: "Map", tone: "travel", description: "Tap a revealed, walkable tile to select it. The bright outline is your destination; the gold line is the route you will take." }),
  Object.freeze({ icon: "compass", label: "Route preview", tag: "Journey", tone: "travel", description: "Steps and time describe the next march. A long journey pauses at the march limit so the party can reassess before continuing." }),
  Object.freeze({ icon: "alert", label: "Danger", tag: "Route risk", tone: "danger", description: "The percentage is the cumulative chance of at least one encounter along the shown ground route. Darkness can make the actual journey more dangerous." }),
  Object.freeze({ icon: "swords", label: "Encounters", tag: "Combat", tone: "danger", description: "Travel may trigger an encounter on its own. The encounter button deliberately looks for a fight at your current location." }),
  Object.freeze({ icon: "bag", label: "Goods", tag: "Trade", tone: "goods", description: "Goods markers indicate wares to buy or sell. Selection and quality depend on the specialty and the marker's lettered market tier." }),
  Object.freeze({ icon: "sparkle", label: "Services", tag: "Assistance", tone: "service", description: "Services provide help such as healing, lodging, repairs, transport, rites, research, or access; they may not carry a normal shop inventory." }),
  Object.freeze({ icon: "eye", label: "Visibility", tag: "Exploration", tone: "explore", description: "Clear tiles are currently visible, dim tiles are remembered, and black tiles remain unknown. Visiting and scouting keep geography on your map." }),
  Object.freeze({ icon: "alert", label: "Quest marks", tag: "Objective", tone: "social", description: "A gold exclamation mark on a destination means a known quest objective is tied to that place." }),
]);

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

function headerLocationName(tile) {
  return poiPartName(tile?.poi)
    || tile?.poi?.name
    || poiPlaceName(tile?.poi)
    || TERRAINS[tile?.terrain]?.label
    || "Wilderness";
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
        <h1>{headerLocationName(tile)}</h1>
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

export function MapLegend({ onClose, initialSection = "guide" }) {
  const [sectionId, setSectionId] = useState(initialSection);
  const contentRef = useRef(null);
  const poiGroup = POI_LEGEND_GROUPS.find((group) => group.id === sectionId) || null;
  const sections = [
    { id: "guide", label: "Map signs" },
    { id: "tiers", label: "Shop grades" },
    ...POI_LEGEND_GROUPS.map((group) => ({
      id: group.id,
      label: group.id === "city" ? "City" : group.id === "wilderness" ? "Wilds" : group.label,
    })),
  ];

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [sectionId]);

  return (
    <section id="rpg-map-legend-dialog" className="rpg-map-legend-panel" role="dialog" aria-modal="true" aria-labelledby="rpg-map-legend-title" onMouseDown={(event) => event.stopPropagation()}>
      <header className="rpg-map-legend-head">
        <div><small>Traveler's field guide</small><h2 id="rpg-map-legend-title">Map legend</h2><p>Read the signs before you march.</p></div>
        <button type="button" onClick={onClose} aria-label="Close map legend"><Icon name="x" size={17} /></button>
      </header>
      <div className="rpg-map-legend-tabs" role="tablist" aria-label="Legend sections">
        {sections.map((section) => (
          <button
            key={section.id}
            id={`rpg-map-legend-tab-${section.id}`}
            type="button"
            className={sectionId === section.id ? "is-active" : ""}
            onClick={() => setSectionId(section.id)}
            role="tab"
            aria-selected={sectionId === section.id}
            aria-controls="rpg-map-legend-content"
          >
            {section.label}
          </button>
        ))}
      </div>
      <div ref={contentRef} id="rpg-map-legend-content" className="rpg-map-legend-content" role="tabpanel" aria-labelledby={`rpg-map-legend-tab-${sectionId}`}>
        {sectionId === "guide" ? (
          <>
            <p>The local map combines travel planning, destination types, and encounter risk. These are the signals used across both city streets and the wilderness.</p>
            <div className="rpg-map-guide-grid">
              {MAP_GUIDE_ITEMS.map((item) => (
                <div key={item.label} className={`rpg-map-guide-item is-${item.tone}`}>
                  <span className="rpg-map-guide-icon"><Icon name={item.icon} size={19} /></span>
                  <span><em>{item.tag}</em><b>{item.label}</b><small>{item.description}</small></span>
                </div>
              ))}
            </div>
            <div className="rpg-map-risk-guide" aria-label="Danger levels">
              <strong>Danger levels</strong>
              <div>
                <span className="is-calm"><b>0–19%</b><small>Calm</small></span>
                <span className="is-wary"><b>20–39%</b><small>Wary</small></span>
                <span className="is-dangerous"><b>40–64%</b><small>Dangerous</small></span>
                <span className="is-deadly"><b>65%+</b><small>Deadly</small></span>
              </div>
            </div>
          </>
        ) : sectionId === "tiers" ? (
          <>
            <p>Lettered rings on shop and service icons compare local prices and the best quality of stock the establishment normally carries—not the danger of the area.</p>
            <div className="rpg-map-tier-grid">
              {Object.values(MARKET_PRICE_TIERS).map((tier) => (
                <div key={tier.id} className="rpg-map-tier-item">
                  <PoiTierMarker marketTier={tier.id} size={24} />
                  <span><b>{tier.label}</b><small>{tier.summary} · {tier.qualityTier.replace("-", " ")} stock</small></span>
                </div>
              ))}
            </div>
          </>
        ) : poiGroup ? (
          <>
            <p>{POI_LEGEND_HELP[poiGroup.id]}</p>
            <div className="rpg-map-poi-grid">
              {poiGroup.items.map((item) => {
                const [tag, tone] = POI_LEGEND_TAGS[item.key] || ["Place", "social"];
                return (
                  <div key={item.key} className={`rpg-map-poi-item is-${tone}`}>
                    <PoiIcon iconKey={item.key} size={42} title={item.label} />
                    <span><em>{tag}</em><b>{item.label}</b><small>{POI_LEGEND_ACTIONS[item.key]}</small></span>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

function WorldGrid({ model, selection, journey, onPick, onSeekCombat, loading, night, city }) {
  const [legendOpen, setLegendOpen] = useState(false);
  const mapScene = useMemo(() => buildWorldMapScene({ model, selection, journey, night }), [model, selection, journey, night]);
  const accessibleCells = useMemo(() => model.viewport
    .filter((cell) => cell.explored && cell.passable && !cell.current)
    .map((cell) => ({
      key: cell.key,
      label: `${nameForDestination(cell, model.origin)}, ${directionLabel(model.origin, cell).replace("-", " ")}${cell.quest ? `, quest: ${cell.quest.title}` : ""}`,
    })), [model]);

  function selectMapCell(key) {
    const cell = model.viewport.find((candidate) => candidate.key === key);
    if (cell?.explored && cell.passable && !cell.current) onPick(cell);
  }

  useEffect(() => {
    if (!legendOpen) return undefined;
    const onKeyDown = (event) => event.key === "Escape" && setLegendOpen(false);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [legendOpen]);

  return (
    <>
      <main className={`rpg-world-stage canvas-world-stage ${city ? "is-capital" : ""} ${night ? "is-night" : ""}`}>
        <MapCanvas scene={mapScene} onSelect={selectMapCell} label="Interactive world exploration map" choices={accessibleCells} selectedKey={selection?.key} />
        {selection && !model.viewport.some((cell) => cell.key === selection.key) && <div className="rpg-offscreen-target"><span>✦</span><b>Compass locked</b><small>{directionLabel(model.origin, selection).replace("-", " ")}</small></div>}

        <button
          type="button"
          className="rpg-map-legend-toggle"
          onClick={() => setLegendOpen(true)}
          aria-label="Open map legend"
          aria-expanded={legendOpen}
          aria-controls="rpg-map-legend-dialog"
        >
          <Icon name="book" size={16} /><span>Legend</span>
        </button>

        {onSeekCombat && (
          <div className="rpg-map-corner-controls">
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
          </div>
        )}
      </main>

      {legendOpen && (
        <div className="rpg-map-legend-backdrop" onMouseDown={() => setLegendOpen(false)}>
          <MapLegend onClose={() => setLegendOpen(false)} />
        </div>
      )}
    </>
  );
}

function DestinationPanel({ state, model, selection, selectedName, journey, routeMinutes, risk, focusBiome, focusVisual, onClear, onTravel, canFly, teleOption, onFly, onTeleport, flightMount, flyPlan, resolve, loading }) {
  const distance = selection ? hexDistance(model.origin, selection) : 0;
  // Named waypoints come from authored landmark data only — cheap lookups, no
  // tile generation — so long continental previews stay responsive.
  const journeyVia = useMemo(() => (journey ? journeyWaypoints(journey.fullPath, { cap: 4 }) : []), [journey]);
  const isSelf = selection && selection.x === model.origin.x && selection.y === model.origin.y;
  const description = selection?.tile?.poi?.description || (selection ? TERRAINS[selection.tile?.terrain]?.flavor : null);
  const rewardTitle = selection?.quest ? "Quest reward" : selection?.visited ? "Known waypoint" : "Discovery ahead";
  const rewardValue = selection?.quest ? formatCopper(selection.quest.rewardCp || 0) : selection?.visited ? "Route recorded" : "New atlas entry";
  const focusDistrict = cityDistrict(selection?.tile);
  const focusMarketTier = selection?.tile?.poi?.marketTier || null;
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

            {focusMarketTier && (
              <div className="rpg-destination-poi-tier">
                <small>Shop tier</small>
                <PoiTierMarker marketTier={focusMarketTier} size={18} showLabel />
              </div>
            )}

            {description && <p className="rpg-destination-copy">{description}</p>}

            <div className="rpg-reward-card" style={{ "--reward-art": `url(${rewardArt})` }}>
              <div><small>{rewardTitle}</small><b>{rewardValue}</b></div>
              <span>{selection.quest ? "✦" : selection.visited ? "✓" : "+"}</span>
            </div>

            {journey ? (
              <>
                <div className="rpg-route-stats">
                  <div><small>{urbanRoute ? "Blocks" : "Steps"}</small><b>{journey.legSteps}</b><span>of {journey.totalSteps}</span></div>
                  <div><small>Time</small><b>{formatTravelDuration(routeMinutes)}</b><span>this march</span></div>
                  <div className={risk >= 40 ? "is-danger" : ""}><small>Danger</small><b>{risk}%</b><span>{dangerLabel(risk)}</span></div>
                </div>
                <div className="rpg-terrain-route">
                  {journey.terrainLabels.map((terrain) => <span key={terrain.id} style={{ "--segment-color": TERRAIN_INK[terrain.id], "--segment-size": terrain.count }} title={`${terrain.label}: ${terrain.count} steps`}><i /><small>{terrain.label} ×{terrain.count}</small></span>)}
                </div>
                {journeyVia.length > 0 && (
                  <p className="rpg-route-via">Via {journeyVia.map((waypoint) => waypoint.name).join(" · ")}</p>
                )}
                {!journey.arrived && (
                  <p className="rpg-leg-note">
                    This march reaches {journey.legSteps} of {journey.totalSteps} steps before the party reassesses.
                    Full journey ≈ {formatTravelDuration(journey.legSteps > 0 ? Math.round(routeMinutes / journey.legSteps * journey.totalSteps) : routeMinutes)}.
                  </p>
                )}
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

function WorldAtlasPage({
  state,
  origin,
  onPick,
  onTravel,
  travelMarch,
  onTravelMarchFinish,
  toolbarActions,
}) {
  return (
    <div className="rpg-folio-page rpg-folio-page--atlas">
      <WorldAtlas
        state={state}
        origin={origin}
        onPick={onPick}
        onTravel={onTravel}
        travelMarch={travelMarch}
        onTravelMarchFinish={onTravelMarchFinish}
        toolbarActions={toolbarActions}
      />
    </div>
  );
}

export function AdventureFolio({
  state,
  page,
  quests,
  landmarks,
  origin,
  onPage,
  onClose,
  onPick,
  onTravel,
  travelMarch,
  onTravelMarchFinish,
}) {
  const tabs = [
    { id: "atlas", label: "World atlas", icon: "atlas", count: landmarks.filter((landmark) => landmark.quest || landmark.name || poiPlaceName(landmark.tile?.poi)).length },
    { id: "quests", label: "Quest journal", icon: "journal", count: quests.length },
  ];
  const isAtlas = page !== "quests";
  const atlasToolbarActions = isAtlas ? (
    <>
      <button
        type="button"
        className="rpg-folio-map-journal"
        onClick={() => onPage("quests")}
        aria-label={`Open quest journal, ${quests.length} active ${quests.length === 1 ? "quest" : "quests"}`}
      >
        <Icon name="journal" size={15} strokeWidth={1.5} />
        <span>Quest journal</span>
        <b aria-hidden="true">{quests.length}</b>
      </button>
      <button type="button" onClick={onClose} className="rpg-square-button rpg-folio-close" aria-label="Close world atlas"><Icon name="close" size={20} /></button>
    </>
  ) : null;
  return (
    <div className="rpg-folio-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section
        className={`rpg-folio${isAtlas ? " rpg-folio--map" : ""}`}
        role="dialog"
        aria-modal="true"
        {...(isAtlas ? { "aria-label": "World Atlas" } : { "aria-labelledby": "rpg-folio-title" })}
      >
        {!isAtlas && (
          <header className="rpg-folio-hero rpg-folio-hero--quests" style={{ "--folio-hero-art": `url(${questJournalFolioHero})` }}>
            <button type="button" onClick={onClose} className="rpg-square-button rpg-folio-close" aria-label="Close quest journal"><Icon name="close" size={20} /></button>
            <div className="rpg-folio-identity">
              <small>Wayfinder's folio</small>
              <h2 id="rpg-folio-title">Quest Journal</h2>
              <p>Open obligations, promised rewards, and the next trail to follow.</p>
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
        )}
        <div
          key={page}
          id={`rpg-folio-panel-${page}`}
          className={`rpg-folio-body rpg-folio-body--${page}`}
          {...(isAtlas ? { "aria-label": "World Atlas" } : { role: "tabpanel", "aria-labelledby": `rpg-folio-tab-${page}` })}
        >
          {page === "quests"
            ? <QuestJournalPage quests={quests} current={origin} onPick={onPick} />
            : (
              <WorldAtlasPage
                state={state}
                origin={origin}
                onPick={onPick}
                onTravel={onTravel}
                travelMarch={travelMarch}
                onTravelMarchFinish={onTravelMarchFinish}
                toolbarActions={atlasToolbarActions}
              />
            )}
        </div>
      </section>
    </div>
  );
}

export function WorldExploration({
  state,
  onClose,
  onTravel,
  travelMarch = null,
  onTravelMarchFinish,
  onFly,
  onTeleport,
  onSeekCombat,
  loading,
}) {
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
  const focusDestination = selection || model.current;
  const focusBiome = biomeAt(focusDestination, state.world.seed);
  const focusVisual = biomeVisual(focusBiome.id);
  const hour = state.time?.hour ?? 12;

  useEffect(() => {
    if (!folioPage && !flyPanelDest) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (flyPanelDest) setFlyPanelDest(null);
      else setFolioPage(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flyPanelDest, folioPage]);

  function pick(destination) {
    setSelected({ x: destination.x, y: destination.y, ...(destination.name ? { name: destination.name } : {}) });
    setFolioPage(null);
  }

  function handleFlySelection() {
    if (flightMount || flyPlan.casts <= 1) onFly(selected);
    else setFlyPanelDest(selected);
  }

  function handleGroundTravel() {
    if (!journey || loading) return;
    // Ground travel is presented on the atlas even when it was confirmed from
    // the local map. React keeps this folio mounted while App starts narration.
    setFolioPage("atlas");
    onTravel(selected, journey.fullPath);
  }

  return (
    <div className={`exploration-shell rpg-exploration-shell ${currentCity ? "is-capital-map" : ""}`} style={{ "--rpg-accent": currentVisual.accent, "--rpg-primary": currentVisual.primary, "--rpg-deep": currentVisual.deep }}>
      <RpgHeader state={state} biome={currentBiome} tile={model.current.tile} onClose={onClose} onWayfinder={() => setFolioPage("atlas")} />
      <div className="rpg-exploration-body">
        <WorldGrid model={model} selection={selection} journey={journey} onPick={pick} onSeekCombat={onSeekCombat} loading={loading} night={hour < 6 || hour >= 20} city={currentCity} />
        <DestinationPanel state={state} model={model} selection={selection} selectedName={selectedName} journey={journey} routeMinutes={routeMinutes} risk={risk} focusBiome={focusBiome} focusVisual={focusVisual} onClear={() => setSelected(null)} onTravel={handleGroundTravel} canFly={canFly} teleOption={teleOption} onFly={handleFlySelection} onTeleport={(spell) => onTeleport(selected, spell.id)} flightMount={flightMount} flyPlan={flyPlan} resolve={state.character.resolve ?? 0} loading={loading} />
      </div>
      {folioPage && (
        <AdventureFolio
          state={state}
          page={folioPage}
          quests={activeQuests}
          landmarks={model.landmarks}
          origin={model.origin}
          onPage={setFolioPage}
          onClose={() => setFolioPage(null)}
          onPick={pick}
          onTravel={onTravel}
          travelMarch={travelMarch}
          onTravelMarchFinish={onTravelMarchFinish}
        />
      )}
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
