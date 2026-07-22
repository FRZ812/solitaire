import React, { useState, useEffect, useLayoutEffect, useRef } from "react";

import { STORAGE_KEY, originLabel, SIGHT_RADIUS, FLY_TRAVEL_HEXES, FLY_REVEAL_RADIUS, OVERBURDENED_TRAVEL_MULT, MOUNT_FLIGHT_NEED_PER_HOUR, MOUNT_FLIGHT_MIN_NEED, WORLD_MARCH_LIMIT } from "./config.js";
import { TERRAINS } from "./data/terrains.js";
import { makeInitialState, migrateCodex } from "./data/initial-state.js";

import { storeGet, storeDel } from "./engine/storage.js";
import { callNarrator } from "./engine/api-supabase.js";
import { onAuthChange, signOut, linkEmail, isSubscribed } from "./engine/auth-supabase.js";
import { listCampaigns, loadCampaignRecord, saveCampaign, deleteCampaign, renameCampaign } from "./engine/campaigns-supabase.js";
import {
  clearCampaignResume,
  readLastCampaignId,
  readResumeSnapshot,
  rememberLastCampaignId,
  shouldRecoverResumeSnapshot,
  writeResumeSnapshot,
} from "./engine/campaign-resume.js";
import { applyBeat } from "./engine/beat.js";
import {
  deleteBeat, editBeat, narratorMessageForPendingPlayers, pendingPlayerBeats,
  recordTurn, rewindToPlayerBeat, stateBeforeTurn, stateAfterTurn,
  turnForBeatIndex, turnStartedAt,
} from "./engine/timeline.js";
import { withPortraitOverride } from "./engine/portrait-overrides.js";
import { applyStoryFontScale } from "./engine/preferences.js";
import { createTravelMarchWaiter } from "./engine/travel-lifecycle.js";
import { normalizeMemoryBank } from "./engine/memory.js";
import { normalizeNarratorSettings } from "./engine/narrator-settings.js";
import { MEMORY_CAP } from "./engine/relationships.js";
import { recomputeVitalityMax, recomputeResolveMax, recomputeCarryCapacity } from "./engine/attributes.js";
import { equipItem, transferItem, unequipItem } from "./engine/inventory.js";
import { buyGood, sellGood, formatCopper, coinsToCopper } from "./engine/economy.js";
import { useConsumable } from "./engine/consumables.js";
import { lightTorch, lightLantern, extinguish, applyRest } from "./engine/tools.js";
import { inTheDark, isNight, isLit, isHidden, isBeacon, locationLightStatus, sightRadius } from "./engine/light.js";
import { applyForge, applyApprentice, blacksmithRank } from "./engine/forge.js";
import { applyFusionToItem, fusionOptionsForRune } from "./engine/fusion.js";
import { generateBoard, acceptTask, abandonTask, applyDayLabour } from "./engine/quests.js";
import { generateGaol, acceptBounty } from "./engine/gaol.js";
import { generateSlaveMarket } from "./engine/slaves.js";
import { partyStanding, recruitOutlook, isRecruited, partyMembers } from "./engine/party.js";
import { applyTraining, trainingOffer } from "./engine/training.js";
import { buildingForTile, isBuildingOpen, buildingHours, TRAIN_CAP } from "./data/town.js";
import { schematicsForBuilding } from "./data/schematics.js";
import { tierLabel, tierOrder } from "./data/tiers.js";
import { rollShopStock, rollStableMounts } from "./engine/town-gen.js";
import { stableStockFor, mountTemplate } from "./data/mounts.js";
import { scryResult, toggleTrackedCharacter } from "./engine/positions.js";
import {
  getTile, currentLocationName,
  squareToAxial, computeSightFrom, computeSightFromRadius,
  pathMinutes, isSeen, flightPath, flightMinutes, findWorldRoute, persistedTileDelta,
} from "./engine/world.js";
import { knownTravelSpells } from "./data/travel-spells.js";
import { knownBuffSpells } from "./data/buff-spells.js";
import { buffTravelSpeedMult, hastedGroundMinutes, hastedFlightHexes, hastedFlightMinutes } from "./engine/buffs.js";
import { condNames, hasCondition, normalizeConditions } from "./data/conditions.js";
import { flyMulticastPlan, assignmentCost, assignmentValid } from "./engine/fly.js";
import { playerFlightMount, playerGroundMount, mount as mountRider, dismount as dismountRider, isOverloaded } from "./engine/riding.js";
import { rollPathEncounter, rollAerialEncounter, pathThroughEncounter } from "./engine/encounters.js";
import { SPAWN_TABLES } from "./data/spawn-tables.js";
import { getBiome, getBiomeById } from "./data/biomes.js";
import { ECOLOGIES } from "./data/continent.js";
import { biomeVisual, sceneBiomeId } from "./data/visual-assets.js";
import { generateEnemyGroup, enemyFromNPC, allyFromCompanion } from "./data/bestiary.js";
import { regionDifficulty } from "./data/regions.js";
import { initCombat, playCard, setTarget, endPlayerTurn, playerFlee, playerStandDown, playerCeasefire } from "./engine/combat.js";
import { hashSeed } from "./engine/combat-rng.js";
import { applyCombatResult, applyLoot } from "./engine/combat-result.js";
import {
  pendingLevelAllocations,
  pendingProgressionChoices,
  projectCharacterProgression,
  resolveLevelAllocationChoice,
  resolveProfessionChoice,
  resolveProgressionGrantChoice,
  resolveRacialProgressionChoice,
} from "./engine/progression.js";
import { activeWorldPassives } from "./engine/combat-stats.js";
import { poiPlaceName } from "./engine/location.js";

import { CompactHeader } from "./components/CompactHeader.jsx";
import { CombatView } from "./components/combat/CombatView.jsx";
import { VitalsStrip, InputBar, ErrorBanner } from "./components/primitives.jsx";
import { LiveNarratorStream } from "./components/LiveNarratorStream.jsx";
import { BeatActionSheet } from "./components/BeatActionSheet.jsx";
import { colors } from "./components/tokens.js";
import { BeatRender } from "./components/beats/BeatRender.jsx";
import { PanelDeck } from "./components/PanelDeck.jsx";
import { WorldExploration } from "./components/exploration/WorldExploration.jsx";
import { TraderView } from "./components/TraderView.jsx";
import { StableView } from "./components/StableView.jsx";
import { ForgeView } from "./components/ForgeView.jsx";
import { RuneFusionView } from "./components/RuneFusionView.jsx";
import { itemTemplate } from "./data/catalog.js";
import { QuestBoardView } from "./components/QuestBoardView.jsx";
import { PrisonView } from "./components/PrisonView.jsx";
import { SlaveMarketView } from "./components/SlaveMarketView.jsx";
import { ConfirmDialog } from "./components/ConfirmDialog.jsx";
import { NamePrompt } from "./components/NamePrompt.jsx";
import { AuthScreen } from "./components/AuthScreen.jsx";
import { SubscriptionScreen } from "./components/SubscriptionScreen.jsx";
import { TitleScreen } from "./components/TitleScreen.jsx";
import { CampaignsList } from "./components/CampaignsList.jsx";
import { GameOverScreen } from "./components/GameOverScreen.jsx";
import { InitialBackdrop } from "./components/InitialBackdrop.jsx";
import { SceneBackdrop } from "./components/SceneBackdrop.jsx";
import { CreationHub } from "./components/CreationHub.jsx";
import { ManualCreation } from "./components/ManualCreation.jsx";
import { Icon } from "./components/Icon.jsx";
import { JourneyLoader, JourneyResumeOverlay } from "./components/JourneyLoader.jsx";
import { advanceLiveNarrator, emptyLiveNarrator } from "./engine/live-narrator.js";
import { pinStoryToBottom, storyDistanceFromBottom, touchRequestsOlder, wheelRequestsOlder } from "./components/storyScroll.js";
import "./components/chat-scene.css";

// Difficulty profile of the current location (region-gated, not level-scaled).
function regionHere(state) {
  const cur = state.world.currentTile;
  return regionDifficulty(cur.x, cur.y, state.world.seed);
}
// Unique ids the character already holds, so the same named drop can't repeat.
function ownedUniqueIds(state) {
  const set = new Set();
  for (const c of state.character.inventory.carried) set.add(c.itemId);
  for (const id of (state.world.codex.characters.wanderer?.worn || [])) set.add(id);
  for (const a of (state.character.abilities || [])) set.add(typeof a === "string" ? a : a.id);
  return Array.from(set);
}
// Hostile spawn entries available at the current tile (terrain base + biome extras).
function hostileEntriesHere(state) {
  const cur = state.world.currentTile;
  const tile = getTile(state, cur.x, cur.y);
  const base = SPAWN_TABLES[tile.terrain];
  if (!base) return [];
  const region = getBiomeById(tile.regionId) || getBiome(cur.x, cur.y, state.world.seed);
  const regional = region.extraSpawns?.[tile.terrain] || [];
  const ecological = ECOLOGIES[tile.ecology]?.encounters || [];
  return [...base.entries, ...regional, ...ecological].filter((e) => e.posture === "hostile");
}
function pickHostileKind(state) {
  const hostile = hostileEntriesHere(state);
  if (hostile.length === 0) return "bandits";
  const total = hostile.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const e of hostile) { r -= e.weight; if (r <= 0) return e.kind; }
  return hostile[0].kind;
}
function groupFlavor(enemies) {
  if (enemies.length === 1) return enemies[0].name;
  const base = enemies[0].name.replace(/\s+\d+$/, "");
  return `${enemies.length} ${base}s`;
}

// An "important" fight where death is allowed to be real and final: the toughest
// foe is legendary-tier or above (the Demon King, a fabled beast, etc.). Ordinary
// bandits/goblins never kill — they rob, abduct, or enslave instead.
function isEpicEncounter(cs) {
  return (cs.enemies || []).some((e) => tierOrder(e.tier) >= tierOrder("legendary"));
}

// Snapshot a pack as { itemId: quantity } so two snapshots can be diffed into a
// bought/sold list (used to flavor the trader's parting reaction).
function invQtyMap(carried) {
  const m = {};
  for (const c of carried || []) m[c.itemId] = (m[c.itemId] || 0) + c.quantity;
  return m;
}

// Apply a travel narration to `base`: clamp the journey time, move the player to
// the destination, expand sight along the whole route, and reveal any vista at
// arrival. Shared by the live travel handler and the Rewrite path so a rewritten
// journey still lands the player where they were headed (travel = the context
// recorded with the turn: from/to names, dest coords, route path, minutes).
function applyTravelArrival(base, beat, travel) {
  const mins = travel.totalMins;
  if (!beat.minutes_passed || Math.abs(beat.minutes_passed - mins) > mins * 0.5) {
    beat.minutes_passed = mins;
  }
  let next = applyBeat(base, beat, {
    travelFrom: travel.fromName,
    travelTo: travel.toName,
    travelToCoords: { x: travel.dest.x, y: travel.dest.y },
  });
  const path = travel.path || [];
  // Reveal radius: flight takes in a wide view from the air; otherwise normal
  // sight, shrunk by darkness (engine/light.js).
  const r = travel.mode === "fly" ? FLY_REVEAL_RADIUS : sightRadius(next);
  // Mark path tiles visited and refresh sight from each (flight reveals the whole
  // corridor it crossed; walk reveals what the party trudged past).
  if (path.length > 1) {
    const newTiles = { ...next.world.tiles };
    let newSeen = next.world.seen;
    for (let i = 1; i < path.length; i++) {
      const p = path[i];
      const k = `${p.x},${p.y}`;
      if (!newTiles[k]) newTiles[k] = persistedTileDelta(getTile(base, p.x, p.y));
      newSeen = computeSightFromRadius(p.x, p.y, r, newSeen);
    }
    next = { ...next, world: { ...next.world, tiles: newTiles, seen: newSeen } };
  }
  // Vista: a high point reveals a wide hex — but only if you can actually see far
  // (daylight/lantern/darkvision). In the dark the grand view is just more black.
  const destTile = getTile(base, travel.dest.x, travel.dest.y);
  if (destTile?.vistaRadius && destTile.vistaRadius > 0) {
    const vr = r >= SIGHT_RADIUS ? destTile.vistaRadius : r;
    const wider = computeSightFromRadius(travel.dest.x, travel.dest.y, vr, next.world.seen);
    next = { ...next, world: { ...next.world, seen: wider } };
  }

  // Ancient-site cache: a forge-rune (the Fusion catalyst) lies at a few old
  // places, claimed once on first arrival.
  const cacheKey = `${travel.dest.x},${travel.dest.y}`;
  const looted = next.world.lootedCaches || {};
  const tmpl = destTile?.cache?.itemId ? itemTemplate(destTile.cache.itemId) : null;
  if (tmpl && !looted[cacheKey]) {
    const runeId = destTile.cache.itemId;
    const carried = next.character.inventory.carried.map((c) => ({ ...c }));
    const ex = carried.find((c) => c.itemId === runeId);
    if (ex) ex.quantity += 1; else carried.push({ itemId: runeId, quantity: 1 });
    const now = Date.now();
    next = {
      ...next,
      beats: [
        ...next.beats,
        { id: `cache${now}`, type: "narration", content: `Among the old stones something waits, left for whoever should find it: a ${tmpl.name}. You take it.` },
        { id: `cachei${now}`, type: "inventory_delta", lines: [`+1× ${tmpl.name}`] },
      ],
      character: { ...next.character, inventory: { ...next.character.inventory, carried } },
      world: { ...next.world, codex: { ...next.world.codex, items: { ...next.world.codex.items, [runeId]: tmpl } }, lootedCaches: { ...looted, [cacheKey]: true } },
    };
  }
  return next;
}

// One-shot migrator for legacy v10 single-save blobs (square odd-r offset coords).
// Re-keys world.tiles + world.seen and bumps currentTile into axial space, then
// refreshes hex-sight from the migrated position so the visible area is
// hex-shaped going forward.
function convertLegacyV10ToHex(legacy) {
  const out = JSON.parse(JSON.stringify(legacy));
  const w = out.world;
  const newCur = squareToAxial(w.currentTile.x, w.currentTile.y);
  w.currentTile = newCur;
  const newTiles = {};
  for (const [key, tile] of Object.entries(w.tiles || {})) {
    const [x, y] = key.split(",").map(Number);
    const a = squareToAxial(x, y);
    newTiles[`${a.x},${a.y}`] = tile;
  }
  w.tiles = newTiles;
  const newSeen = {};
  for (const key of Object.keys(w.seen || {})) {
    const [x, y] = key.split(",").map(Number);
    const a = squareToAxial(x, y);
    newSeen[`${a.x},${a.y}`] = true;
  }
  w.seen = computeSightFrom(newCur.x, newCur.y, newSeen);
  return out;
}

function prepareCampaignState(loaded) {
  // Pull forward any codex entries (races, professions, named NPCs) added to
  // initial-state.js since the snapshot was written.
  const migrated = migrateCodex(loaded);
  if (migrated?.character) {
    recomputeVitalityMax(migrated.character);
    recomputeResolveMax(migrated.character);
    recomputeCarryCapacity(migrated.character);
  }
  for (const id of (migrated?.party || [])) {
    const companion = migrated.world?.codex?.characters?.[id];
    if (companion && companion.resolveMax == null) recomputeResolveMax(companion);
  }
  return migrated;
}

function CenteredLoader({ title, detail }) {
  return <JourneyLoader title={title} detail={detail} />;
}

export function Solitaire() {
  // Auth — web-only mode; always start unauthed and wait for the auth
  // subscription below to deliver the user (or null if signed out).
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const authUserIdRef = useRef(null);

  // Subscription gate.
  const [subChecked, setSubChecked] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [subBusy, setSubBusy] = useState(false);

  // Campaigns
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoaded, setCampaignsLoaded] = useState(false);
  const [currentCampaignId, setCurrentCampaignId] = useState(null);
  const currentCampaignIdRef = useRef(currentCampaignId);
  currentCampaignIdRef.current = currentCampaignId;
  const [campaignBusy, setCampaignBusy] = useState(false);
  const [campaignError, setCampaignError] = useState(null);
  const [menuEntered, setMenuEntered] = useState(false);
  const [resumeChecked, setResumeChecked] = useState(false);
  const campaignsPreparedRef = useRef(false);
  const resumeAttemptedForRef = useRef(null);

  // Game
  const [state, setState] = useState(makeInitialState());
  const liveStateRef = useRef(state);
  liveStateRef.current = state;
  const lastSyncedStateRef = useRef(null);
  const lastServerUpdatedAtRef = useRef(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // A failed player-message send, kept so it can be retried (e.g. the app was
  // backgrounded mid-request and the connection dropped). { base, message }.
  const [retry, setRetry] = useState(null);
  const [deckOpen, setDeckOpen] = useState(false);     // unified dossier deck
  const [deckPage, setDeckPage] = useState("character"); // which page it opens to
  // Character creation UI: the hub (templates vs limbo) shows first on a fresh
  // campaign; `creationEntered` flips once the player chooses the freeform limbo
  // path; `manualCreation` opens the FRZKHRX full-manual builder (lives in limbo).
  const [creationEntered, setCreationEntered] = useState(false);
  const [manualCreation, setManualCreation] = useState(false);
  const [fusionRune, setFusionRune] = useState(null); // forge-rune id being bound in the fusion ritual
  const [mapOpen, setMapOpen] = useState(false);
  // Ground travel is narrated and animated concurrently. Canonical world
  // state still lands only through finishTravel; this object is transient UI
  // state and is deliberately excluded from campaign persistence.
  const [travelMarch, setTravelMarch] = useState(null);
  const travelMarchWaitersRef = useRef(new Map());
  // Async travel may outlive the campaign that launched it (sign-out, reset,
  // opening another save). Every travel tail checks this generation before it
  // is allowed to land the party or surface an encounter.
  const travelLifecycleRef = useRef({ generation: 0, controller: null });
  const [shopTile, setShopTile] = useState(null); // {x,y} of an open building, or null
  const [shopView, setShopView] = useState("trade"); // "trade" | "forge" within a building

  // Travel and interaction share the same world-map tile. A POI's service opens a
  // dedicated panel; movement always happens through WorldExploration.
  function standingTile(s = state) {
    return getTile(s, s.world.currentTile.x, s.world.currentTile.y);
  }
  function standingKey(s = state) {
    return `${s.world.currentTile.x},${s.world.currentTile.y}`;
  }
  // Recent purchases at the current shop, for full refunds until you leave the
  // scene: { tileKey, items: { [itemId]: [pricePaid, ...] } }.
  const [receipts, setReceipts] = useState({ tileKey: null, items: {} });
  // Themed confirm dialog (replaces window.confirm). askConfirm() resolves a
  // promise when the player chooses; the component is rendered near the root.
  const [confirmDialog, setConfirmDialog] = useState(null);
  function askConfirm(opts) {
    return new Promise((resolve) => setConfirmDialog({ ...opts, resolve }));
  }
  // Themed single-line text prompt (name a joining mount). Resolves the string or null.
  const [namePrompt, setNamePrompt] = useState(null);
  function askName(opts) {
    return new Promise((resolve) => setNamePrompt({ ...opts, resolve }));
  }
  const [hydrated, setHydrated] = useState(false);
  const resumeCacheTimerRef = useRef(null);
  // Transient stream projection. Raw partial JSON never enters saved beats;
  // only its currently recoverable ordered story entries and reasoning are shown.
  const [liveNarrator, setLiveNarrator] = useState(emptyLiveNarrator);
  const logRef = useRef(null);
  const storyFollowRef = useRef(true);
  const storyTouchYRef = useRef(null);
  const [storyFollowing, setStoryFollowing] = useState(true);
  const [storyAtBottom, setStoryAtBottom] = useState(true);

  function captureTravelLifecycle(baseState = liveStateRef.current) {
    const controller = new AbortController();
    travelLifecycleRef.current.controller?.abort(new Error("Travel superseded."));
    travelLifecycleRef.current.controller = controller;
    return {
      generation: travelLifecycleRef.current.generation,
      campaignId: currentCampaignIdRef.current,
      baseState,
      controller,
    };
  }

  function isTravelLifecycleCurrent(lifecycle) {
    return !!lifecycle
      && lifecycle.generation === travelLifecycleRef.current.generation
      && lifecycle.campaignId === currentCampaignIdRef.current;
  }

  function abortActiveTravel(reason = "Travel cancelled.") {
    const controller = travelLifecycleRef.current.controller;
    travelLifecycleRef.current.controller = null;
    if (controller && !controller.signal.aborted) controller.abort(new Error(reason));
  }

  function cancelTravelLifecycle({ closeMap = true } = {}) {
    travelLifecycleRef.current.generation += 1;
    abortActiveTravel();
    for (const waiter of travelMarchWaitersRef.current.values()) {
      waiter.resolve?.("cancelled");
    }
    travelMarchWaitersRef.current.clear();
    setTravelMarch(null);
    setLiveNarrator(emptyLiveNarrator());
    setPendingCombat(null);
    setPendingEngage(null);
    if (closeMap) setMapOpen(false);
    setLoading(false);
  }

  useEffect(() => () => {
    travelLifecycleRef.current.generation += 1;
    abortActiveTravel("Travel abandoned because the application closed.");
    for (const waiter of travelMarchWaitersRef.current.values()) {
      waiter.resolve?.("cancelled");
    }
    travelMarchWaitersRef.current.clear();
  }, []);

  function setStoryFollow(next) {
    storyFollowRef.current = next;
    setStoryFollowing((current) => current === next ? current : next);
  }

  function suspendStoryFollow() {
    if (storyFollowRef.current) setStoryFollow(false);
  }

  function pinStory(element = logRef.current) {
    if (!element) return;
    pinStoryToBottom(element);
    setStoryAtBottom(true);
  }

  // A generous tolerance here — this drives the Latest button, which should
  // only appear once the reader has drifted meaningfully from the bottom, not
  // the instant a pixel of scroll happens.
  const STORY_LATEST_THRESHOLD = 96;

  function syncStoryAtBottom(element = logRef.current) {
    setStoryAtBottom(storyDistanceFromBottom(element) <= STORY_LATEST_THRESHOLD);
  }

  function handleStoryWheel(event) {
    if (wheelRequestsOlder(event.deltaY)) suspendStoryFollow();
  }

  function handleStoryTouchStart(event) {
    storyTouchYRef.current = event.touches?.[0]?.clientY ?? null;
  }

  function handleStoryTouchMove(event) {
    const nextY = event.touches?.[0]?.clientY;
    const previousY = storyTouchYRef.current;
    if (touchRequestsOlder(previousY, nextY)) {
      suspendStoryFollow();
    }
    storyTouchYRef.current = Number.isFinite(nextY) ? nextY : previousY;
  }

  function handleStoryKeyDown(event) {
    if (["ArrowUp", "PageUp", "Home"].includes(event.key)) suspendStoryFollow();
  }

  function handleStoryPointerDown(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX >= bounds.right - 18) suspendStoryFollow();
  }

  function handleStoryScroll(event) {
    syncStoryAtBottom(event.currentTarget);
  }

  function scrollStoryToLatest() {
    const element = logRef.current;
    if (!element) return;
    setStoryFollow(true);
    pinStory(element);
    requestAnimationFrame(() => {
      if (storyFollowRef.current) pinStory();
    });
  }

  // Combat: `combat` holds the active turn-state (null = not fighting);
  // `pendingCombat` is a hostile encounter offering a fight before it starts.
  const [combat, setCombat] = useState(null);
  const [pendingCombat, setPendingCombat] = useState(null);
  const [pendingLoot, setPendingLoot] = useState(null); // spoils to deliberately Search
  const [pendingEngage, setPendingEngage] = useState(null); // narrator start_combat awaiting the player's go-ahead
  const combatCtxRef = useRef(null);
  // Pack + purse snapshot taken when a trader counter opens, so leaving it can
  // diff what was bought/sold and let the keeper react to the actual haul.
  const tradeStartRef = useRef(null);

  // Long-press a narration/dialogue bubble to Rewrite / Edit / Rewind it. The
  // per-turn timeline (state.turns + state.pools) is saved with the campaign, so
  // any recorded moment — including travel — stays steerable across reloads.
  // beatMenu holds the targeted beat; beatMode switches the sheet between menu and editors.
  const [beatMenu, setBeatMenu] = useState(null); // { beatId, index, turnK }
  const [beatMode, setBeatMode] = useState("menu"); // "menu" | "rewrite" | "edit"
  const [rewriteText, setRewriteText] = useState("");
  const [editText, setEditText] = useState("");

  // ----- QoL preferences (story text size etc.) applied as CSS vars on mount -----
  useEffect(() => { applyStoryFontScale(); }, []);

  // ----- Auth subscription -----
  useEffect(() => {
    let mounted = true;
    const unsubscribe = onAuthChange((u) => {
      if (!mounted) return;
      const nextUserId = u?.id ?? null;
      if (authUserIdRef.current !== nextUserId) {
        cancelTravelLifecycle();
        authUserIdRef.current = nextUserId;
        resumeAttemptedForRef.current = null;
        setResumeChecked(false);
      }
      setUser(u);
      if (!u) {
        setMenuEntered(false);
        setCurrentCampaignId(null);
        setHydrated(false);
      }
      setAuthChecked(true);
    });
    return () => { mounted = false; unsubscribe(); };
  }, []);

  // ----- Subscription check when user appears -----
  useEffect(() => {
    if (!user) { setSubChecked(false); setSubscribed(false); return; }
    let cancelled = false;
    setSubChecked(false);
    isSubscribed()
      .then((ok) => { if (!cancelled) { setSubscribed(!!ok); setSubChecked(true); } })
      .catch(() => { if (!cancelled) { setSubscribed(false); setSubChecked(true); } });
    return () => { cancelled = true; };
  }, [user?.id]);

  async function handleRecheckSubscription() {
    if (subBusy) return;
    setSubBusy(true);
    try {
      const ok = await isSubscribed();
      setSubscribed(!!ok);
      setSubChecked(true);
    } catch {
      setSubscribed(false);
      setSubChecked(true);
    } finally {
      setSubBusy(false);
    }
  }

  // A cold PWA resume used to forget that a campaign was open even though its
  // id was written to localStorage. Restore that pointer once auth/access are
  // known. A user-scoped snapshot can paint the real last scene immediately;
  // openCampaign still checks Supabase before the game becomes interactive.
  useEffect(() => {
    if (!user || !subChecked || !subscribed) return;
    if (resumeAttemptedForRef.current === user.id) {
      setResumeChecked(true);
      return;
    }
    resumeAttemptedForRef.current = user.id;

    const cached = readResumeSnapshot(user.id);
    const campaignId = cached?.campaignId || readLastCampaignId();
    if (!campaignId) {
      setResumeChecked(true);
      return;
    }

    let cancelled = false;
    setMenuEntered(true);
    openCampaign(campaignId, () => cancelled, cached)
      .finally(() => { if (!cancelled) setResumeChecked(true); });
    setResumeChecked(true);
    return () => { cancelled = true; };
    // openCampaign is a stable function declaration over this render's user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, subChecked, subscribed]);

  // ----- Fetch campaigns list when user appears -----
  useEffect(() => {
    if (!user) {
      setCampaigns([]);
      setCampaignsLoaded(false);
      campaignsPreparedRef.current = false;
      return;
    }
    // Don't touch campaigns until the subscription gate has passed — a
    // locked user shouldn't auto-create or auto-resume anything.
    if (!subscribed) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await listCampaigns();
        if (!cancelled) {
          setCampaigns(list);
          setCampaignsLoaded(true);
        }
      } catch (e) {
        if (!cancelled) {
          setCampaignError(e.message || String(e));
          setCampaignsLoaded(true); // unblock UI even on failure
        }
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, subscribed]);

  // ----- One-time legacy import on first load -----
  // The title screen now deliberately opens into the campaign library instead
  // of auto-resuming or silently creating a save. Players always choose the road
  // they are about to enter.
  useEffect(() => {
    if (campaignsPreparedRef.current || !campaignsLoaded || !user) return;
    campaignsPreparedRef.current = true;
    const snapshotCampaigns = campaigns;
    let cancelled = false;

    (async () => {
      try {
        // 1. Legacy import: if no campaigns and a legacy single-save blob exists,
        //    convert it into a campaign. Don't auto-open it — user sees it in the list.
        if (snapshotCampaigns.length === 0) {
          const legacyRaw = await storeGet(STORAGE_KEY);
          if (legacyRaw) {
            let legacy = null;
            try { legacy = JSON.parse(legacyRaw); } catch {}
            const looksLikeState = legacy?.beats
              && legacy?.character?.attributes
              && legacy?.character?.needs;
            if (looksLikeState) {
              setCampaignBusy(true);
              try {
                const charName = legacy.character.name || "Imported save";
                const migrated = convertLegacyV10ToHex(legacy);
                await saveCampaign(null, migrated, { name: charName });
                await storeDel(STORAGE_KEY);
                const refreshed = await listCampaigns();
                if (!cancelled) setCampaigns(refreshed);
              } catch (e) {
                if (!cancelled) setCampaignError(`Import failed: ${e.message || e}`);
              } finally {
                if (!cancelled) setCampaignBusy(false);
              }
              return; // stop here; user sees the campaigns list with the imported entry
            }
          }
        }

      } catch (e) {
        if (!cancelled) setCampaignError(e.message || String(e));
      }
    })();
    return () => { cancelled = true; };
    // We intentionally depend only on campaignsLoaded + user; the campaigns
    // snapshot is captured at the moment campaignsLoaded becomes true.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignsLoaded, user?.id]);

  // ----- Save on state change (debounced; when a campaign is active) -----
  // Keep a warm, user-scoped browser snapshot so an Android/PWA cold resume can
  // paint the actual last scene while Supabase is checked. Writes are trailing
  // and best-effort; the server remains authoritative unless the cache is both
  // explicitly dirty and newer than the server row.
  useEffect(() => {
    if (!hydrated || !currentCampaignId || !user?.id) return;
    const snapshot = state;
    const dirty = snapshot !== lastSyncedStateRef.current;
    clearTimeout(resumeCacheTimerRef.current);
    resumeCacheTimerRef.current = setTimeout(() => {
      writeResumeSnapshot({
        userId: user.id,
        campaignId: currentCampaignId,
        state: snapshot,
        dirty,
        serverUpdatedAt: lastServerUpdatedAtRef.current,
      });
    }, 250);
    return () => clearTimeout(resumeCacheTimerRef.current);
  }, [state, hydrated, currentCampaignId, user?.id]);

  // Autosave used to fire a full Supabase write on EVERY state change — a write
  // storm where overlapping in-flight PUTs could also land out of order and
  // clobber newer progress. Debounce to a trailing 800ms and skip the initial
  // hydration state because it is already identical to the server baseline.
  const saveTimerRef = useRef(null);
  useEffect(() => {
    if (!hydrated || !currentCampaignId || !user?.id) return;
    const id = currentCampaignId;
    const snapshot = state;
    if (snapshot === lastSyncedStateRef.current) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveCampaign(id, snapshot)
        .then((result) => {
          if (currentCampaignIdRef.current !== id || liveStateRef.current !== snapshot) return;
          lastSyncedStateRef.current = snapshot;
          lastServerUpdatedAtRef.current = result?.updatedAt ?? lastServerUpdatedAtRef.current;
          writeResumeSnapshot({
            userId: user.id,
            campaignId: id,
            state: snapshot,
            dirty: false,
            serverUpdatedAt: lastServerUpdatedAtRef.current,
          });
        })
        .catch((e) => setCampaignError(`Save failed: ${e.message || e}`));
    }, 800);
    return () => clearTimeout(saveTimerRef.current);
  }, [state, hydrated, currentCampaignId, user?.id]);

  async function flushActiveCampaign(snapshot = liveStateRef.current) {
    if (!hydrated || !currentCampaignId || !user?.id) return;
    const id = currentCampaignId;
    clearTimeout(saveTimerRef.current);
    const result = await saveCampaign(id, snapshot);
    if (currentCampaignIdRef.current === id && liveStateRef.current === snapshot) {
      lastSyncedStateRef.current = snapshot;
      lastServerUpdatedAtRef.current = result?.updatedAt ?? lastServerUpdatedAtRef.current;
      writeResumeSnapshot({
        userId: user.id,
        campaignId: id,
        state: snapshot,
        dirty: false,
        serverUpdatedAt: lastServerUpdatedAtRef.current,
      });
    }
  }

  // A mobile OS can freeze or discard the web process without waiting for the
  // 800ms autosave. Capture synchronously as the page hides, then make a
  // best-effort serialized server flush. On a later cold start the dirty cache
  // is recoverable if that network write never landed.
  useEffect(() => {
    if (!hydrated || !currentCampaignId || !user?.id) return;
    let lastFlushAt = 0;
    const persistBeforeSuspend = () => {
      const now = Date.now();
      if (now - lastFlushAt < 250) return;
      lastFlushAt = now;
      const snapshot = liveStateRef.current;
      const dirty = snapshot !== lastSyncedStateRef.current;
      clearTimeout(resumeCacheTimerRef.current);
      writeResumeSnapshot({
        userId: user.id,
        campaignId: currentCampaignId,
        state: snapshot,
        dirty,
        capturedAt: now,
        serverUpdatedAt: lastServerUpdatedAtRef.current,
      });
      if (dirty) {
        flushActiveCampaign(snapshot)
          .catch((e) => setCampaignError(`Save failed: ${e.message || e}`));
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") persistBeforeSuspend();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", persistBeforeSuspend);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", persistBeforeSuspend);
    };
    // flushActiveCampaign intentionally reads the same active campaign/user
    // represented by these dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, currentCampaignId, user?.id]);

  // ----- Follow live output only while the reader is near the bottom -----
  // A reader who scrolls upward owns the viewport until they tap Latest.
  // Reaching the bottom manually does not silently re-enable follow. Streamed
  // output can grow many times per second; each
  // visible update may re-pin only while that follow lock remains enabled.
  useEffect(() => {
    if (!storyFollowRef.current) return;
    const toBottom = () => {
      if (storyFollowRef.current) pinStory();
    };
    toBottom();
    const r = requestAnimationFrame(toBottom);
    return () => cancelAnimationFrame(r);
  }, [state.beats.length, loading, liveNarrator.thinking, liveNarrator.story]);

  // The Latest control reflects where the viewport actually is. This is
  // deliberately separate from the follow lock: reaching the bottom manually
  // hides the control, but does not re-enable automatic streaming follow.
  useEffect(() => {
    syncStoryAtBottom();
    const r = requestAnimationFrame(() => syncStoryAtBottom());
    return () => cancelAnimationFrame(r);
  }, [state.beats.length, loading, liveNarrator.thinking, liveNarrator.story]);

  // Campaign hydration is the one intentional reset: a newly opened history
  // starts at its latest beat even if the previous campaign was scrolled up.
  // useLayoutEffect (not useEffect) so this runs before the browser paints —
  // otherwise the reader sees a flash of the log at the top before it jumps.
  useLayoutEffect(() => {
    if (!hydrated || !logRef.current) return;
    setStoryFollow(true);
    pinStory();
    const r = requestAnimationFrame(() => pinStory());
    return () => cancelAnimationFrame(r);
  }, [hydrated, currentCampaignId]);

  // ----- Campaign handlers -----

  // Internal helpers shared by handlers + auto-resume. isCancelled is a getter
  // (not a snapshot) so callers from useEffect can flip cancellation atomically
  // when their cleanup fires.
  async function openCampaign(id, isCancelled = () => false, cachedSnapshot = null) {
    cancelTravelLifecycle();
    setCampaignBusy(true);
    setHydrated(false);
    setCampaignError(null);
    const warmSnapshot = cachedSnapshot?.campaignId === id
      && cachedSnapshot?.userId === user?.id
      ? cachedSnapshot
      : null;
    let warmState = null;
    if (warmSnapshot) {
      // Paint the real last scene during the network check, but leave hydrated
      // false so controls/autosave remain gated behind the resume overlay.
      warmState = prepareCampaignState(warmSnapshot.state);
      setState(warmState);
      closeBeatMenu();
      setCurrentCampaignId(id);
      rememberLastCampaignId(id);
    }
    try {
      const loaded = await loadCampaignRecord(id);
      if (isCancelled()) return;
      if (!loaded) {
        // Stale id; drop the lastOpened pointer and let the list show.
        clearCampaignResume();
        setCurrentCampaignId(null);
        const refreshed = await listCampaigns();
        if (!isCancelled()) {
          setCampaigns(refreshed);
          setCampaignsLoaded(true);
        }
        return;
      }
      const serverState = prepareCampaignState(loaded.state);
      const recoverWarmState = warmState
        && shouldRecoverResumeSnapshot(warmSnapshot, loaded.updatedAt);
      const resumedState = recoverWarmState ? warmState : serverState;
      lastSyncedStateRef.current = recoverWarmState ? serverState : resumedState;
      lastServerUpdatedAtRef.current = loaded.updatedAt;
      setState(resumedState);
      closeBeatMenu();
      setCurrentCampaignId(id);
      rememberLastCampaignId(id);
      if (user?.id) {
        writeResumeSnapshot({
          userId: user.id,
          campaignId: id,
          state: resumedState,
          dirty: !!recoverWarmState,
          serverUpdatedAt: loaded.updatedAt,
        });
      }
      setHydrated(true);
    } catch (e) {
      if (!isCancelled()) {
        setCurrentCampaignId(null);
        setCampaignError(e.message || String(e));
      }
    } finally {
      if (!isCancelled()) setCampaignBusy(false);
    }
  }

  async function createCampaign(isCancelled = () => false) {
    cancelTravelLifecycle();
    setCampaignBusy(true);
    setHydrated(false);
    setCampaignError(null);
    try {
      const fresh = makeInitialState();
      const name = fresh.character?.name || "Untitled";
      const { id, updatedAt } = await saveCampaign(null, fresh, { name });
      if (isCancelled()) return;
      lastSyncedStateRef.current = fresh;
      lastServerUpdatedAtRef.current = updatedAt;
      setState(fresh);
      closeBeatMenu();
      setCurrentCampaignId(id);
      rememberLastCampaignId(id);
      if (user?.id) {
        writeResumeSnapshot({
          userId: user.id,
          campaignId: id,
          state: fresh,
          dirty: false,
          serverUpdatedAt: updatedAt,
        });
      }
      setHydrated(true);
      // Refresh the list in the background so the new entry shows when user navigates back.
      listCampaigns().then((list) => {
        if (!isCancelled()) setCampaigns(list);
      }).catch(() => {});
    } catch (e) {
      if (!isCancelled()) setCampaignError(e.message || String(e));
    } finally {
      if (!isCancelled()) setCampaignBusy(false);
    }
  }

  function handleSelectCampaign(id) {
    openCampaign(id);
  }

  function handleNewCampaign() {
    createCampaign();
  }

  async function handleDeleteCampaign(id) {
    if (!(await askConfirm({ title: "Delete campaign", body: "Delete this campaign? This cannot be undone.", confirmLabel: "Delete", danger: true }))) return;
    if (currentCampaignId === id) cancelTravelLifecycle();
    setCampaignError(null);
    try {
      await deleteCampaign(id);
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      if (currentCampaignId === id) {
        setCurrentCampaignId(null);
        setHydrated(false);
        lastSyncedStateRef.current = null;
        lastServerUpdatedAtRef.current = null;
        clearCampaignResume();
      } else if (readLastCampaignId() === id) {
        clearCampaignResume();
      }
    } catch (e) {
      setCampaignError(`Delete failed: ${e.message || e}`);
    }
  }

  async function handleRenameCampaign(id, name) {
    setCampaignError(null);
    try {
      await renameCampaign(id, name);
      setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
    } catch (e) {
      setCampaignError(`Rename failed: ${e.message || e}`);
    }
  }

  async function handleBackToCampaigns() {
    cancelTravelLifecycle();
    try {
      await flushActiveCampaign();
    } catch (e) {
      setCampaignError(`Save failed: ${e.message || e}`);
    }
    setDeckOpen(false);
    setCurrentCampaignId(null);
    setHydrated(false);
    lastSyncedStateRef.current = null;
    lastServerUpdatedAtRef.current = null;
    clearCampaignResume();
    // Refresh list to pick up the latest last_played_at from this session.
    listCampaigns().then(setCampaigns).catch(() => {});
  }

  async function handleSignOut() {
    cancelTravelLifecycle();
    try {
      await flushActiveCampaign();
    } catch (e) {
      setCampaignError(`Save failed: ${e.message || e}`);
    }
    setDeckOpen(false);
    setMenuEntered(false);
    setCurrentCampaignId(null);
    setHydrated(false);
    // Reset in-memory game state so the next account signed in on this browser
    // can't inherit the previous user's character/beats/apiHistory (and so the
    // debounced autosave can't write user-A's state into user-B's campaign).
    setState(makeInitialState());
    setCombat(null);
    lastSyncedStateRef.current = null;
    lastServerUpdatedAtRef.current = null;
    clearCampaignResume();
    try {
      await signOut();
    } catch (e) {
      setCampaignError(`Sign-out failed: ${e.message || e}`);
    }
  }

  // ----- Game handlers (unchanged behavior, kept inline) -----

  function handleSubmit() {
    const action = input.trim();
    if (!action || loading) return;
    // The expert token opens the full-manual builder instead of chatting it out.
    if (state.created === false && action.includes("FRZKHRX")) {
      setInput("");
      setManualCreation(true);
      return;
    }
    setInput("");
    setRetry(null);
    const playerBeat = { id: `p${Date.now()}`, type: "player", content: action };
    setState((current) => ({ ...current, beats: [...current.beats, playerBeat] }));
    scrollStoryToLatest();
  }

  // Sending only queues the player's words. This explicit play step consumes every
  // trailing player bubble in order; with no queued text it lets the living scene
  // advance without assigning a choice or line of dialogue to the player.
  async function handleRunNarrator() {
    if (loading) return;
    setRetry(null);
    const message = narratorMessageForPendingPlayers(state);
    await runNarratorTurn(state, message);
  }

  // Narrator wrapper used by every turn site. The edge function emits both
  // reasoning and answer JSON chunks. advanceLiveNarrator projects only the
  // recoverable player-facing fields, and { reset } cleanly replaces retries.
  function narrate(st, msg, isCurrent = () => true, signal = null) {
    scrollStoryToLatest();
    setLiveNarrator(emptyLiveNarrator());
    return callNarrator(st, msg, (chunk) => {
      if (!isCurrent()) return;
      setLiveNarrator((current) => advanceLiveNarrator(current, chunk));
    }, { signal });
  }

  // Run a player-message turn against the narrator. On failure (dropped network,
  // backgrounded app…) the message is preserved and stashed for a one-tap Retry —
  // the typed action is never lost.
  async function runNarratorTurn(base, message) {
    setError(null);
    setLoading(true);
    try {
      const beat = await narrate(base, message);
      const next = applyBeat(base, beat);
      const recorded = recordTurn(base, message, next);
      setState((current) => {
        // Portraits are save-level presentation, not fiction state. Preserve
        // uploads made while this narrator request was in flight.
        const merged = { ...recorded, portraitOverrides: current.portraitOverrides || {} };
        liveStateRef.current = merged;
        return merged;
      });
      setRetry(null);
      // An explicit strike in the fiction hands off to the turn-based engine.
      if (beat.start_combat) setPendingEngage({ dir: beat.start_combat });
    } catch (e) {
      setError(e.message || String(e));
      setRetry({ base, message });
    } finally {
      setLoading(false);
    }
  }

  // Build a character DETERMINISTICALLY from a menu/template spec (no LLM defines
  // the sheet), then make a single narrator call only to narrate arriving in the
  // world. Reuses the engine's character_setup + inventory/worn paths so a manual
  // build is applied exactly like a narrator-finalized one.
  async function applyCharacterSetup(setup) {
    const items = Array.isArray(setup.items) ? setup.items : [];
    const added = items
      .filter((i) => i?.itemId)
      .map((i) => ({ itemId: i.itemId, quantity: Math.max(1, i.quantity || 1) }));
    const wornIds = items.filter((i) => i?.worn && i.itemId).map((i) => i.itemId);
    const skills = Array.isArray(setup.skills)
      ? setup.skills.filter((skill) => skill?.id).map((skill) => ({ ...skill }))
      : [];
    const inv = {};
    if (added.length) inv.added = added;
    if (setup.coins && (setup.coins.copper || setup.coins.silver || setup.coins.gold)) inv.coins = setup.coins;
    const discoveries = {};
    if (wornIds.length) discoveries.characters = [{ id: "wanderer", worn: wornIds }];
    if (skills.length) discoveries.skills = skills;
    const beat = {
      character_setup: {
        name: setup.name, bond: setup.bond, attributes: setup.attributes,
        abilities: setup.abilities || [], race: setup.race, subrace: setup.subrace || null,
        proficiencies: setup.proficiencies || {},
        progression: setup.progression || null,
        level: setup.level ?? null,
        racial_levels: setup.racial_levels ?? setup.racialLevels ?? null,
        profession_plan: setup.profession_plan ?? setup.professionPlan ?? null,
        signature_spell: setup.signature_spell ?? setup.signatureSpell ?? null,
        metamagic: setup.metamagic ?? setup.progressionChoices?.metamagic ?? null,
        origin: setup.origin, profession: setup.profession, archetype: setup.archetype || null, gender: setup.gender,
        age: setup.age, agingMode: setup.agingMode, lifespanMultiplier: setup.lifespanMultiplier,
        attractiveness: setup.attractiveness, appearance: setup.appearance,
        base_appearance: setup.base_appearance, knows: setup.knows || [],
        templateId: setup.templateId || null,
        portraitKey: setup.portraitKey || null,
        profile: setup.profile || null,
      },
      inventory_changes: Object.keys(inv).length ? inv : undefined,
      discoveries: Object.keys(discoveries).length ? discoveries : undefined,
    };
    // Both template and custom builds open the same way: a single narrator call
    // that arrives the character INSIDE Whitemarch (the global start), weaving in
    // their backstory. (Templates' old verbatim Drowned-Rat openings were retired
    // when the map was rebuilt around the city — see the opener below.)
    let built = applyBeat(state, beat); // created=true; identity, kit, and gear applied
    // Drop the limbo opening narration — a locally-built character skips the
    // interview entirely, so the log should begin with their arrival, not the
    // "you are a soul in the grey" intro.
    built = { ...built, beats: [] };
    setManualCreation(false);
    setCreationEntered(false);
    setState(built); // flip out of limbo at once so the chooser can't flash back while the opening loads
    const kindred = [setup.subrace, setup.race].filter(Boolean).join(" ");
    const a = setup.appearance || {};
    const looks = setup.base_appearance || [
      setup.age, a.build && `${a.build} build`, a.skin && `${a.skin} skin`,
      a.hair && `${a.hair} hair`, a.eyes && `${a.eyes} eyes`, a.facial_hair, a.marks,
    ].filter(Boolean).join(", ");
    const originStr = originLabel(setup.origin);
    const backstory = [setup.backstory, ...(Array.isArray(setup.knows) ? setup.knows : [])].filter(Boolean).join(" ");
    const calling = setup.archetype ? `${setup.archetype} ${setup.profession || "wanderer"}` : (setup.profession || "wanderer");
    const opener = `[CHARACTER CREATION] The character is fully created and LOCKED — ${setup.name}, a ${kindred} ${calling}${originStr ? ` of ${originStr} origin` : ""}. Appearance (describe FAITHFULLY; do not contradict): ${looks || "as the player envisioned"}. Drive: ${setup.bond || "their own"}.${backstory ? ` Backstory to weave in: ${backstory}` : ""} Do NOT emit character_setup, do NOT change any values, and do NOT ask any questions. OPEN THE REAL SCENE: this is their FIRST appearance in the world — do NOT mention limbo or a grey threshold. Narrate THIS character arriving INSIDE the walled capital of Whitemarch, in the press and clamour of the Grand Market's Grain Square (the city's heart, behind the Great Wall), grounding the scene in who they are, their origin, and what (from the backstory) has brought them to the city, then proceed as a normal first beat.`;
    await runNarratorTurn(built, opener);
  }

  // Threshold decisions are resolved locally against the versioned ledger.
  // The narrator can describe the consequence later, but it can never choose a
  // school, specialization, signature spell, or metamagic for the player.
  function handleProgressionChoice(professionId, choiceId, optionId) {
    setState((current) => {
      const pending = pendingProgressionChoices(current.character).find((entry) => (
        entry.id === choiceId && (!professionId || entry.professionId === professionId)
      ));
      if (!pending) return current;
      // Multi-pick grants remain pending between selections. A fast double
      // activation can therefore enqueue the same option twice before React
      // paints its disabled state; treat that second activation as a no-op.
      if ((pending.selectedOptions || []).includes(optionId)) return current;
      const character = {
        ...current.character,
        attributes: { ...(current.character.attributes || {}) },
        progression: current.character.progression,
      };
      let progression;
      if (pending.kind === "level-allocation") {
        progression = resolveLevelAllocationChoice(character, { choiceId, optionId });
      } else if (pending.kind === "branch") {
        progression = resolveProfessionChoice(character.progression, { professionId, choiceId, optionId });
      } else if (pending.kind === "racial-branch") {
        progression = resolveRacialProgressionChoice(character.progression, { choiceId, optionId });
      } else {
        progression = resolveProgressionGrantChoice(character.progression, { professionId, grantId: choiceId, optionId });
      }
      const option = (pending.options || []).find((entry) => (
        (typeof entry === "string" ? entry : (entry.id || entry.optionId)) === optionId
      ));
      const optionLabel = typeof option === "string"
        ? option.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
        : option?.name || option?.label || optionId;
      const professionLabel = String(professionId || pending.raceId || "character")
        .replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
      const choiceLabel = pending.kind === "level-allocation"
        ? `Level ${pending.level} allocated`
        : pending.kind === "racial-branch"
          ? "racial specialization"
          : pending.kind === "branch" ? "specialization" : "progression";
      const next = projectCharacterProgression({
        ...current,
        character: { ...character, progression },
        beats: [...(current.beats || []), {
          id: `progression-choice-${Date.now()}`,
          type: "growth",
          text: `${professionLabel} ${choiceLabel} — ${optionLabel}`,
        }],
      });
      liveStateRef.current = next;
      return next;
    });
  }

  function handleRetry() {
    if (!retry || loading) return;
    runNarratorTurn(retry.base, retry.message);
  }

  function beginTravelMarch(travel) {
    const id = `map-march-${Date.now()}-${travel.path.length}`;
    travelMarchWaitersRef.current.set(id, createTravelMarchWaiter());
    setTravelMarch({
      id,
      path: travel.path.map((coord) => ({ x: coord.x, y: coord.y })),
      minutes: travel.totalMins,
      intendedDest: travel.intendedDest ? { ...travel.intendedDest } : null,
      encounterAtEnd: travel.encounter || null,
      visualDone: false,
    });
    return id;
  }

  function handleTravelMarchFinish(id) {
    if (!id) return;
    setTravelMarch((current) => (
      current?.id === id ? { ...current, visualDone: true } : current
    ));
    travelMarchWaitersRef.current.get(id)?.resolve?.("finished");
  }

  async function waitForTravelMarch(id) {
    const waiter = travelMarchWaitersRef.current.get(id);
    if (!waiter) return "cancelled";
    const result = await waiter.promise;
    if (travelMarchWaitersRef.current.get(id) === waiter) {
      travelMarchWaitersRef.current.delete(id);
    }
    return result;
  }

  async function handleTravel(dest, providedPath) {
    if (loading) return;
    const cur = state.world.currentTile;
    // The travel map and the engine share one authored-route plan. Reuse the exact
    // preview when it still starts here and ends at the chosen destination;
    // otherwise recompute through the same door-aware graph.
    const previewIsCurrent = Array.isArray(providedPath) && providedPath.length > 1
      && providedPath[0]?.x === cur.x && providedPath[0]?.y === cur.y
      && providedPath[providedPath.length - 1]?.x === dest.x
      && providedPath[providedPath.length - 1]?.y === dest.y;
    const fullPath = previewIsCurrent ? providedPath : findWorldRoute(state, cur, dest);
    if (!fullPath || fullPath.length < 2) return;
    setReceipts({ tileKey: null, items: {} }); // leaving the scene ends refunds
    setError(null);
    setLoading(true);
    closeBeatMenu();
    const fromTile = getTile(state, cur.x, cur.y);
    const destTileFull = getTile(state, dest.x, dest.y);
    const fromName = currentLocationName(state);
    const toName = poiPlaceName(destTileFull.poi) || `${TERRAINS[destTileFull.terrain]?.label} (${dest.x},${dest.y})`;
    const destIsHidden = destTileFull.poi?.type === "hidden";

    // The party marches hex by hex along the route; an encounter is rolled at every
    // step and the FIRST one HALTS them at its tile. With no encounter they press on
    // to the destination (or to the MARCH_MAX safety bound, then you tap to continue).
    let legPath = fullPath.slice(0, WORLD_MARCH_LIMIT + 1);
    const pathEnc = rollPathEncounter(state, legPath);
    legPath = pathThroughEncounter(legPath, pathEnc);
    const legEnd = legPath[legPath.length - 1];
    const arrived = legEnd.x === dest.x && legEnd.y === dest.y;
    const legTile = getTile(state, legEnd.x, legEnd.y);
    const legName = arrived ? toName : (poiPlaceName(legTile.poi) || `${TERRAINS[legTile.terrain]?.label} (${legEnd.x},${legEnd.y})`);
    const isHidden = arrived && destIsHidden;
    const travelWp = activeWorldPassives(state.character, state.world.codex);
    // Slower going in the dark without light, and slower still when worn out.
    const darkTravel = isNight(state.time) && !isLit(state) && !state.character?.darkvision;
    const conds = condNames(state.character.conditions);
    const wearyMult = conds.includes("Exhausted") ? 1.5 : conds.includes("Tired") ? 1.15 : 1;
    // A ridden mount quickens the leg by its moveProfile.ground — but only over the
    // terrain it handles (a horse is no faster floundering through deep marsh).
    const groundMount = playerGroundMount(state);
    let mountMult = 1, mountNote = "";
    // An overladen mount labours — it gives no speed (engine/riding.isOverloaded).
    if (groundMount?.moveProfile && !isOverloaded(groundMount, state)) {
      const terr = groundMount.moveProfile.terrain;
      const legTerrains = new Set();
      for (let i = 1; i < legPath.length; i++) legTerrains.add(getTile(state, legPath[i].x, legPath[i].y).terrain);
      const handlesAll = terr === "any" || (Array.isArray(terr) && [...legTerrains].every((t) => terr.includes(t)));
      const g = groundMount.moveProfile.ground || 1;
      if (handlesAll && g > 1) { mountMult = 1 / g; mountNote = ` astride ${groundMount.name}`; }
    }
    // Overburdened (past your carry cap) drags every leg out (engine/weight.js).
    const overburdenedMult = state.character.overburdened ? OVERBURDENED_TRAVEL_MULT : 1;
    // Haste (and other speed boons) shorten the leg — fewer minutes for the same
    // ground, so LESS need drain, never more (engine/buffs.js).
    const speedMult = buffTravelSpeedMult(state.character.conditions);
    const rawLegMins = Math.round(pathMinutes(state, legPath) * (1 - (travelWp.travelMult || 0)) * (darkTravel ? 1.3 : 1) * wearyMult * mountMult * overburdenedMult);
    const legMins = hastedGroundMinutes(rawLegMins, speedMult);
    if (speedMult > 1) mountNote = mountNote ? `${mountNote}, hastened` : " hastened";
    const hexes = legPath.length - 1;

    // Terrain mix of this leg, for the narrator.
    const terrainCounts = {};
    for (let i = 1; i < legPath.length; i++) {
      const t = getTile(state, legPath[i].x, legPath[i].y).terrain;
      terrainCounts[t] = (terrainCounts[t] || 0) + 1;
    }
    const terrainSummary = Object.entries(terrainCounts).map(([t, n]) => `${TERRAINS[t]?.label || t} ×${n}`).join(", ");
    const routeNote = hexes > 1 ? ` Route crosses: ${terrainSummary}.` : "";

    const playerBeat = { id: `p${Date.now()}`, type: "player", content: `Travel from ${fromName} ${arrived ? "to" : "toward"} ${toName}${mountNote}.` };
    const stateWithPlayer = { ...state, beats: [...state.beats, playerBeat] };

    const generatedSite = destTileFull.poi?.generated;
    const destDescription = isHidden
      ? generatedSite
        ? `HIDDEN AUTHORED SITE — reveal the deterministic site ${JSON.stringify(generatedSite.name)} (${generatedSite.poiType}): ${generatedSite.description} Set tile_discovery EXACTLY to ${JSON.stringify({ name: generatedSite.name, poi_type: generatedSite.poiType, description: generatedSite.description })}; phrase the discovery, but do not rename or replace its canonical identity.`
        : "HIDDEN — reveal an event appropriate to the approved terrain content and set tile_discovery."
      : destTileFull.poi ? `known ${destTileFull.poi.type} (${poiPlaceName(destTileFull.poi) || destTileFull.poi.name})` : "open wilderness";

    let travelMsg;
    if (arrived) {
      travelMsg = `[PLAYER ACTION] Travel from ${fromName} (${TERRAINS[fromTile.terrain]?.label}) to ${legName} (${TERRAINS[legTile.terrain]?.label}). ${hexes} hex(es), ${legMins} min.${routeNote} Destination: ${destDescription}. Narrate the journey and ARRIVAL in one beat. Use minutes_passed = ${legMins}.`;
    } else {
      const why = pathEnc ? "where what follows stops you" : "as far as you press for now — the rest of the way still lies ahead";
      travelMsg = `[PLAYER ACTION] Travel from ${fromName} (${TERRAINS[fromTile.terrain]?.label}) toward ${toName}, getting as far as ${legName} (${TERRAINS[legTile.terrain]?.label}) — ${hexes} hex(es), ${legMins} min,${routeNote} ${why}. Narrate the journey ONLY up to ${legName} and STOP there — do NOT arrive at ${toName} (it is still ${fullPath.length - legPath.length} hex(es) on). Use minutes_passed = ${legMins}.`;
    }

    let encounterLine = "";
    if (pathEnc) {
      encounterLine = `\n\n[ENCOUNTER] kind: ${pathEnc.encounter.kind}; posture: ${pathEnc.encounter.posture}; flavor: "${pathEnc.encounter.desc}". This is what halts the party at ${legName} — weave it in as they reach there.`;
    }
    const fullMsg = travelMsg + (mountNote ? ` The party rides${mountNote}.` : "") + encounterLine;

    // Recorded with the turn so a rewrite/rewind reproduces this exact leg: the
    // route (sight), where the party actually LANDS (leg end, not the far dest),
    // and the rolled encounter. intendedDest remembers where they were bound.
    const travel = {
      fromName, toName: legName,
      dest: { x: legEnd.x, y: legEnd.y },
      path: legPath.map((p) => ({ x: p.x, y: p.y })),
      totalMins: legMins,
      encounter: pathEnc ? pathEnc.encounter : null,
      intendedDest: arrived ? null : { x: dest.x, y: dest.y },
    };

    // Keep the authoritative travel map mounted while narration starts. The
    // party pin owns only this visual route; the simulation continues to own
    // the authoritative arrival tile and save data.
    const lifecycle = captureTravelLifecycle();
    const marchId = beginTravelMarch(travel);

    await finishTravel(stateWithPlayer, fullMsg, travel, marchId, lifecycle);
  }

  // Shared tail for every travel mode: ask the narrator, land via applyTravelArrival
  // (which reveals sight by travel.mode), record the turn, offer any fight.
  function rebasePreparedTravelState(current, base, prepared) {
    if (!base || !prepared) return prepared || current;

    // Begin with the latest live state so pack/equipment changes, portraits,
    // narrator settings, memories, and any other edits made while narration was
    // in flight survive the arrival commit.
    let character = current.character;
    const resolveDelta = (prepared.character?.resolve ?? 0) - (base.character?.resolve ?? 0);
    if (resolveDelta) {
      character = {
        ...character,
        resolve: Math.max(0, (character?.resolve ?? 0) + resolveDelta),
      };
    }

    // Flying can spend companion resolve or mount hunger/sleep before the
    // narrated arrival. Reapply only those deterministic deltas to the latest
    // codex rather than replacing concurrently edited inventories or worn kit.
    const baseCharacters = base.world?.codex?.characters || {};
    const preparedCharacters = prepared.world?.codex?.characters || {};
    let characters = current.world?.codex?.characters || {};
    let charactersTouched = false;
    for (const [id, after] of Object.entries(preparedCharacters)) {
      const before = baseCharacters[id];
      const live = characters[id];
      if (!before || !live) continue;
      let rebased = live;
      const companionResolveDelta = (after.resolve ?? 0) - (before.resolve ?? 0);
      if (companionResolveDelta) {
        rebased = { ...rebased, resolve: Math.max(0, (rebased.resolve ?? 0) + companionResolveDelta) };
      }
      const needDeltas = {};
      for (const key of ["hunger", "thirst", "sleep"]) {
        const delta = (after.needs?.[key] ?? before.needs?.[key] ?? 0)
          - (before.needs?.[key] ?? 0);
        if (delta) needDeltas[key] = delta;
      }
      if (Object.keys(needDeltas).length) {
        const needs = { ...(rebased.needs || {}) };
        for (const [key, delta] of Object.entries(needDeltas)) {
          needs[key] = Math.max(0, Math.min(100, (needs[key] ?? 0) + delta));
        }
        rebased = { ...rebased, needs };
      }
      if (rebased !== live) {
        if (!charactersTouched) characters = { ...characters };
        characters[id] = rebased;
        charactersTouched = true;
      }
    }

    // Preserve the deterministic overflight sightings prepared for a flight,
    // merging them into any tile deltas created while the request was pending.
    const baseTiles = base.world?.tiles || {};
    const preparedTiles = prepared.world?.tiles || {};
    let tiles = current.world?.tiles || {};
    let tilesTouched = false;
    for (const [key, after] of Object.entries(preparedTiles)) {
      const beforeSighting = baseTiles[key]?.aerialSighting;
      const afterSighting = after?.aerialSighting;
      if (!afterSighting || (
        beforeSighting?.day === afterSighting.day
        && beforeSighting?.hour === afterSighting.hour
      )) continue;
      if (!tilesTouched) tiles = { ...tiles };
      tiles[key] = { ...(tiles[key] || {}), aerialSighting: { ...afterSighting } };
      tilesTouched = true;
    }

    const codex = charactersTouched
      ? { ...current.world.codex, characters }
      : current.world.codex;
    const world = (charactersTouched || tilesTouched)
      ? { ...current.world, codex, tiles }
      : current.world;
    const preparedBeat = prepared.beats?.[prepared.beats.length - 1];
    const beats = preparedBeat && !(current.beats || []).some((beat) => beat.id === preparedBeat.id)
      ? [...(current.beats || []), preparedBeat]
      : current.beats;

    return { ...current, character, world, beats };
  }

  async function finishTravel(stateWithPlayer, fullMsg, travel, marchId = null, lifecycle = captureTravelLifecycle()) {
    // Start observing the already-running visual fail-open gate before narration.
    // Whichever side finishes first waits only for the remainder of the other.
    const visualGate = marchId ? waitForTravelMarch(marchId) : Promise.resolve("not-needed");
    let travelBeat = null;
    let narratorEncounter = null;
    let failure = null;
    try {
      const beat = await narrate(
        stateWithPlayer,
        fullMsg,
        () => isTravelLifecycleCurrent(lifecycle),
        lifecycle.controller?.signal,
      );
      if (!isTravelLifecycleCurrent(lifecycle)) return;
      travelBeat = beat;
      narratorEncounter = beat.start_combat || null;
    } catch (e) {
      if (!isTravelLifecycleCurrent(lifecycle)) return;
      failure = e;
      // The retained map overlay would cover the error banner. Leave the attempted
      // player beat in the log, but never apply movement from a failed turn.
      setState((current) => rebasePreparedTravelState(
        current,
        lifecycle.baseState,
        stateWithPlayer,
      ));
      setMapOpen(false);
      setError(e.message || String(e));
      // A synchronous narrator/config failure can beat React's first map
      // march commit, so no mounted tween exists to release this waiter.
      // Failed travel never lands; settle its visual gate immediately.
      if (marchId) travelMarchWaitersRef.current.get(marchId)?.resolve?.("failed");
    } finally {
      await visualGate;
      if (travelLifecycleRef.current.controller === lifecycle.controller) {
        travelLifecycleRef.current.controller = null;
      }
      if (!isTravelLifecycleCurrent(lifecycle)) return;
      setTravelMarch((current) => (current?.id === marchId ? null : current));
      if (travelBeat && !failure) {
        // Commit arrival only once narration and the visible march are both
        // complete. This keeps the preview route stable under the walking pin.
        setState((current) => {
          if (!isTravelLifecycleCurrent(lifecycle)) return current;
          const rebased = rebasePreparedTravelState(
            current,
            lifecycle.baseState,
            stateWithPlayer,
          );
          const next = applyTravelArrival(rebased, travelBeat, travel);
          const landed = recordTurn(rebased, fullMsg, next, { travel });
          liveStateRef.current = landed;
          return landed;
        });
        const hostileEncounter = travel.encounter?.posture === "hostile"
          ? travel.encounter
          : null;
        if (hostileEncounter || narratorEncounter) {
          // The deterministic route roll owns precedence. A narrator combat
          // directive is used only when the route did not already halt on a
          // hostile encounter, preventing two competing combat prompts.
          setMapOpen(false);
          if (hostileEncounter) {
            setPendingEngage(null);
            setPendingCombat(hostileEncounter);
          } else {
            setPendingCombat(null);
            setPendingEngage({ dir: narratorEncounter });
          }
        }
      }
      setLoading(false);
    }
  }

  // Fly toward any tile: a single casting keeps the party aloft for an hour, covering
  // an hour of FLIGHT (FLY_TRAVEL_HEXES) over any terrain with a wide view. If the
  // destination is farther, the hour lapses and the party sets down — recast to go on.
  // No ground ambush aloft, but over dangerous country an aerial predator may force you
  // down (engine/rollAerialEncounter). Flying the PARTY costs one casting per head, the
  // resolve split across the casters who know Fly (engine/fly.js); `assignment` comes
  // from the map's Fly panel (else the auto-balanced split is used).
  async function handleFly(dest, assignment) {
    if (loading) return;
    // Two ways to take wing: a ridden FLYING MOUNT (free of resolve, but it must be
    // fed and rested — it spends its own stamina), or the Fly SPELL (one casting per
    // head, resolve split across casters). A flyer under you is preferred.
    const flightMount = playerFlightMount(state);
    const viaMount = !!flightMount;
    let plan = null, assign = null;
    if (viaMount) {
      const n = flightMount.needs || {};
      if ((n.hunger ?? 100) <= MOUNT_FLIGHT_MIN_NEED || (n.sleep ?? 100) <= MOUNT_FLIGHT_MIN_NEED) {
        setState({ ...state, beats: [...state.beats, { id: `fly${Date.now()}`, type: "narration", content: `${flightMount.name} is too spent to fly — it must feed and rest before it can bear you aloft.` }] });
        return;
      }
      // Loot piled on after mounting can push a mount past its ride capacity — it
      // can't take wing until the load comes down (engine/riding.isOverloaded).
      if (isOverloaded(flightMount, state)) {
        setState({ ...state, beats: [...state.beats, { id: `fly${Date.now()}`, type: "narration", content: `${flightMount.name} is overladen — it can't get airborne until some weight is shed.` }] });
        return;
      }
    } else {
      plan = flyMulticastPlan(state);
      if (!plan.casters.length) return; // no flyer and nobody knows Fly
      assign = assignment || plan.autoAssign;
      if (!assignmentValid(assign, plan.casters, plan.flyCost)) {
        const who = plan.casts > 1 ? "The party hasn't the resolve to take wing together." : "You haven't the resolve left to take wing.";
        setState({ ...state, beats: [...state.beats, { id: `fly${Date.now()}`, type: "narration", content: who }] });
        return;
      }
    }
    const cur = state.world.currentTile;
    // Haste lets a flight leg REACH FURTHER within ~the same hour aloft — more hexes
    // per leg, with minutes scaled back by the same factor, so the per-leg stamina/
    // need toll stays flat while distance grows (engine/buffs.js — never drains faster).
    const speedMult = buffTravelSpeedMult(state.character.conditions);
    let legPath = flightPath(cur, dest, hastedFlightHexes(FLY_TRAVEL_HEXES, speedMult));
    if (legPath.length < 2) return;
    // The only thing that can reach a flier is another flier, and only over wild,
    // dangerous country — a hit forces the party down where it strikes.
    const aerial = rollAerialEncounter(state, legPath);
    if (aerial) legPath = legPath.slice(0, aerial.atIndex + 1);
    const legEnd = legPath[legPath.length - 1];
    const arrived = legEnd.x === dest.x && legEnd.y === dest.y;
    const legTile = getTile(state, legEnd.x, legEnd.y);
    const fromName = currentLocationName(state);
    const destTile = getTile(state, dest.x, dest.y);
    const toName = poiPlaceName(destTile.poi) || `${TERRAINS[destTile.terrain]?.label} (${dest.x},${dest.y})`;
    const legName = arrived ? toName : (poiPlaceName(legTile.poi) || `${TERRAINS[legTile.terrain]?.label} (${legEnd.x},${legEnd.y})`);
    const mins = hastedFlightMinutes(flightMinutes(legPath), speedMult);
    setMapOpen(false); setReceipts({ tileKey: null, items: {} }); setError(null); setLoading(true); closeBeatMenu();

    // Pay the flight. By MOUNT: the beast spends its OWN stamina (hunger + sleep),
    // no resolve at all. By SPELL: deduct each caster's share of resolve.
    const chars = state.world.codex.characters;
    let ch = state.character;
    let updatedChars = chars, charsTouched = false;
    let perCaster = {};
    if (viaMount) {
      // Endurance scales flight stamina too — a hardy flyer (low needsDecayMult) tires slower aloft.
      const drain = Math.round((mins / 60) * MOUNT_FLIGHT_NEED_PER_HOUR * (flightMount.needsDecayMult ?? 1));
      updatedChars = { ...chars }; charsTouched = true;
      const m = chars[flightMount.id];
      const need = m.needs || { hunger: 75, thirst: 80, sleep: 80 };
      updatedChars[flightMount.id] = { ...m, needs: { ...need, hunger: Math.max(0, need.hunger - drain), sleep: Math.max(0, need.sleep - drain) } };
    } else {
      perCaster = assignmentCost(assign, plan.flyCost);
      if (perCaster.wanderer) ch = { ...state.character, resolve: Math.max(0, (state.character.resolve ?? 0) - perCaster.wanderer) };
      for (const [id, spent] of Object.entries(perCaster)) {
        if (id === "wanderer" || !chars[id]) continue;
        if (!charsTouched) { updatedChars = { ...chars }; charsTouched = true; }
        const c = chars[id];
        updatedChars[id] = { ...c, resolve: Math.max(0, (c.resolve ?? c.resolveMax ?? 0) - spent) };
      }
    }

    // Overflown settlements remember the party on the wing for a few days. A
    // generated settlement stores only the dynamic sighting delta; its terrain
    // and climate remain lazy generator output.
    const day = state.time?.day ?? 0;
    const baseTiles = state.world.tiles || {};
    let updatedTiles = baseTiles, tilesTouched = false;
    const overflownTowns = [];
    for (const p of legPath) {
      const t = getTile(state, p.x, p.y);
      if (t.terrain !== "settlement") continue;
      const key = `${p.x},${p.y}`;
      if (!tilesTouched) { updatedTiles = { ...baseTiles }; tilesTouched = true; }
      updatedTiles[key] = persistedTileDelta(t, { aerialSighting: { day } });
      const overflownName = poiPlaceName(t.poi);
      if (overflownName && !overflownTowns.includes(overflownName)) overflownTowns.push(overflownName);
    }

    const world = {
      ...state.world,
      ...(charsTouched ? { codex: { ...state.world.codex, characters: updatedChars } } : {}),
      ...(tilesTouched ? { tiles: updatedTiles } : {}),
    };

    const onDragon = viaMount && /dragon|drake|wyrm/i.test(`${flightMount.race} ${flightMount.name}`);
    const casterTally = viaMount ? [] : plan.casters.filter((c) => perCaster[c.id]).map((c) => `${c.name} ×${perCaster[c.id] / plan.flyCost}`);
    const modeNote = viaMount
      ? ` You ride ${flightMount.name} aloft — the beast's own wingbeats carry you, no spell, no resolve spent.`
      : (plan.casts > 1 ? ` The whole band takes wing — ${plan.casts} castings of Fly, woven by ${casterTally.join(", ")}.` : "");
    const townNote = overflownTowns.length
      ? ` You pass in plain sight over ${overflownTowns.join(", ")} — folk below crane upward and point${onDragon ? ", aghast, at the great wyrm passing over their roofs" : ""}; word of this will spread${onDragon ? " like wildfire" : ""}.`
      : "";
    const lapseNote = viaMount ? `${flightMount.name} tires and glides down to ${legName} to rest and feed` : "the spell lapses and the party glides down to " + legName + " to rest the working";
    const endNote = aerial
      ? `Narrate the flight until ${aerial.encounter.desc} forces the party down at ${legName} — a fight is upon you.`
      : arrived
        ? `Narrate the flight and the landing at ${toName}.`
        : `Narrate the flight; after about an hour aloft ${lapseNote} — they have NOT reached ${toName}, and must take wing again to go on.`;
    const playerBeat = { id: `p${Date.now()}`, type: "player", content: viaMount ? `Fly ${arrived ? "to" : "toward"} ${toName} on ${flightMount.name}.` : `Fly ${arrived ? "to" : "toward"} ${toName}${plan.casts > 1 ? " with the party" : ""}.` };
    const stateWithPlayer = { ...state, character: ch, world, beats: [...state.beats, playerBeat] };
    const opener = viaMount
      ? `[PLAYER ACTION] You take to the air on ${flightMount.name}, sweeping ${arrived ? `to ${legName}` : `toward ${toName} as far as ${legName}`} — ${legPath.length - 1} hex(es), ${mins} min, high over the land (crossing water, wood, and crag alike).`
      : `[PLAYER ACTION] You cast Fly and take to the air, sweeping ${arrived ? `to ${legName}` : `toward ${toName} as far as ${legName}`} — ${legPath.length - 1} hex(es), ${mins} min, high over the land (crossing water, wood, and crag alike).`;
    const costNote = viaMount ? "" : ` It cost ${plan.totalCost} resolve in total${plan.casts > 1 ? " (divided across the casters)" : ""}.`;
    const msg = `${opener}${modeNote}${townNote} ${endNote}${costNote} Use minutes_passed = ${mins}.`;
    const travel = { fromName, toName: legName, dest: { x: legEnd.x, y: legEnd.y }, path: legPath.map((p) => ({ x: p.x, y: p.y })), totalMins: mins, encounter: aerial ? aerial.encounter : null, mode: "fly", mountId: viaMount ? flightMount.id : null, intendedDest: arrived ? null : { x: dest.x, y: dest.y } };
    await finishTravel(stateWithPlayer, msg, travel);
  }

  // Cast a self-BOON (Haste, Bear's Strength): spend resolve and lay its timed
  // condition (data/conditions.js), refreshing the timer if already active. The
  // condition's engine-wired fields then drive travel speed / carry limits (and
  // the mount you ride) until it lapses — see engine/buffs.js + beat.js.
  function handleCastBuff(spellId) {
    if (loading) return;
    const spell = knownBuffSpells(state.character).find((s) => s.id === spellId);
    if (!spell) return;
    if ((state.character.resolve ?? 0) < spell.resolveCost) {
      setState({ ...state, beats: [...state.beats, { id: `buff${Date.now()}`, type: "narration", content: `You haven't the resolve to work ${spell.name}.` }] });
      return;
    }
    const name = spell.applies.condition;
    const conds = normalizeConditions(state.character.conditions).filter((c) => c.name !== name);
    conds.push({ name, remaining: spell.applies.minutes });
    const ch = { ...state.character, resolve: Math.max(0, (state.character.resolve ?? 0) - spell.resolveCost), conditions: conds };
    setState({ ...state, character: ch, beats: [...state.beats, { id: `buff${Date.now()}`, type: "narration", content: `You work ${spell.name}. ${spell.description}` }] });
  }

  // Teleport (Dimension Door / Gate): step straight to the target — no path, no
  // encounters — paid for in resolve. Eligibility (range/anchor) is gated in MapView.
  async function handleTeleport(dest, spellId) {
    if (loading) return;
    const spell = knownTravelSpells(state.character).find((s) => s.id === spellId);
    if (!spell) return;
    if ((state.character.resolve ?? 0) < spell.resolveCost) {
      setState({ ...state, beats: [...state.beats, { id: `tp${Date.now()}`, type: "narration", content: `You haven't the resolve to work ${spell.name}.` }] });
      return;
    }
    const fromName = currentLocationName(state);
    const destTile = getTile(state, dest.x, dest.y);
    const toName = poiPlaceName(destTile.poi) || `${TERRAINS[destTile.terrain]?.label} (${dest.x},${dest.y})`;
    const blind = !isSeen(state, dest.x, dest.y); // gating to a rumored place you've never seen
    setMapOpen(false); setReceipts({ tileKey: null, items: {} }); setError(null); setLoading(true); closeBeatMenu();
    const ch = { ...state.character, resolve: Math.max(0, (state.character.resolve ?? 0) - spell.resolveCost) };
    const playerBeat = { id: `p${Date.now()}`, type: "player", content: `${spell.name} to ${toName}.` };
    const stateWithPlayer = { ...state, character: ch, beats: [...state.beats, playerBeat] };
    const msg = `[PLAYER ACTION] You work ${spell.name} and step through space, arriving at ${toName}${blind ? " — a place known only by repute, so you arrive without knowing what surrounds you" : ""}. No journey, no road between. It cost ${spell.resolveCost} resolve. Narrate the rush of arrival and what greets you. Use minutes_passed = 5.`;
    const travel = { fromName, toName, dest: { x: dest.x, y: dest.y }, path: [{ x: dest.x, y: dest.y }], totalMins: 5, encounter: null, mode: "teleport" };
    await finishTravel(stateWithPlayer, msg, travel);
  }

  async function handleResetCampaign() {
    if (!(await askConfirm({ title: "Reset campaign", body: "Reset this campaign to the beginning? Your current progress here will be erased.", confirmLabel: "Reset", danger: true }))) return;
    cancelTravelLifecycle();
    setState(makeInitialState());
    closeBeatMenu();
    setDeckOpen(false);
  }

  function handleEquip(charId, itemId) {
    // Keep the one-argument form available for any legacy caller while the
    // inventory menu supplies an explicit owner id.
    const ownerId = itemId == null ? "wanderer" : charId;
    const targetItemId = itemId == null ? charId : itemId;
    setState((s) => equipItem(s, targetItemId, ownerId));
  }
  function handleUnequip(charId, itemId) {
    const ownerId = itemId == null ? "wanderer" : charId;
    const targetItemId = itemId == null ? charId : itemId;
    setState((s) => unequipItem(s, targetItemId, ownerId));
  }
  function handleTransfer(fromCharId, toCharId, itemId, quantity) {
    setState((s) => transferItem(s, fromCharId, toCharId, itemId, quantity).state);
  }

  // ----- Town buildings: trader menus (buy / sell / talk) -----

  function openShop() {
    const tile = standingTile();
    const b = buildingForTile(tile);
    if (!b) return;
    if (!isBuildingOpen(b, state.time.hour)) return; // shut for the night
    const key = standingKey();
    setShopView("trade");
    // Fresh refund slate when stepping into a different shop than last time.
    setReceipts((r) => (r.tileKey === key ? r : { tileKey: key, items: {} }));
    const inv = state.character.inventory;
    tradeStartRef.current = { qty: invQtyMap(inv.carried), copper: coinsToCopper(inv.coins) };
    setShopTile({ x: state.world.currentTile.x, y: state.world.currentTile.y });
  }

  // Leaving the counter. If anything was actually traded, the keeper reacts to the
  // whole haul in one recorded (steerable) beat — diffed from the open-time
  // snapshot so a bulk buy/sell gets a single, specific comment.
  async function closeShop() {
    const start = tradeStartRef.current;
    tradeStartRef.current = null;
    const here = shopTile;
    const tile = standingTile();
    setShopTile(null);
    if (!start || !here || loading) return;
    const building = buildingForTile(tile);
    if (!building) return;

    const codex = state.world.codex;
    const endQty = invQtyMap(state.character.inventory.carried);
    const ids = new Set([...Object.keys(start.qty), ...Object.keys(endQty)]);
    const bought = [], sold = [];
    for (const id of ids) {
      const d = (endQty[id] || 0) - (start.qty[id] || 0);
      const name = codex.items[id]?.name || id;
      if (d > 0) bought.push(`${d}× ${name}`);
      else if (d < 0) sold.push(`${-d}× ${name}`);
    }
    if (bought.length === 0 && sold.length === 0) return; // browsed, traded nothing

    const spent = start.copper - coinsToCopper(state.character.inventory.coins);
    const place = poiPlaceName(tile.poi) || building.label;
    const ledger = [
      bought.length ? `Bought: ${bought.join(", ")}` : "",
      sold.length ? `Sold: ${sold.join(", ")}` : "",
      spent > 0 ? `Net paid ${formatCopper(spent)}` : spent < 0 ? `Net earned ${formatCopper(-spent)}` : "",
    ].filter(Boolean).join(". ");

    setError(null);
    setLoading(true);
    const playerBeat = { id: `p${Date.now()}`, type: "player", content: `You settle up with ${building.keeper} at ${place}.` };
    const stateWithPlayer = { ...state, beats: [...state.beats, playerBeat] };
    setState(stateWithPlayer);
    try {
      const msg = `[TRADE] You have just finished trading with ${building.keeper} at ${place} (${building.label}). ${ledger}. Narrate a SHORT closing exchange (1–3 sentences, you may include a line of the keeper's dialogue) in which ${building.keeper} reacts to THIS specific haul: name an item or two, read what the player seems to be planning or doing from what they took or unloaded, and respond in character — offer fitting help (e.g. a healer asking if you need a hand setting that splint), a knowing remark about the trade (a doctor? an alchemist? or did you rob an apothecary?), gratitude, or wary curiosity. The coin is already settled at the counter, so do NOT tally or change it, and do not invent items beyond those listed.`;
      const beat = await narrate(stateWithPlayer, msg);
      const next = applyBeat(stateWithPlayer, beat);
      setState(recordTurn(stateWithPlayer, msg, next));
      if (beat.start_combat) setPendingEngage({ dir: beat.start_combat });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // Forge an item at a resolved tier (the minigame decided the grade). Pure
  // apply + a narration beat; returns the produced def so the forge view can
  // show the result. Materials/coin are consumed and time advances in applyForge.
  function handleForge(schematic, tier) {
    const r = applyForge(state, schematic, tier);
    if (!r.ok) { setError(r.reason || "The forge failed."); return null; }
    const beat = { id: `forge${Date.now()}`, type: "narration", content: `At the anvil you work ${r.item.name} (${tierLabel(tier)}) from raw stock — heat, hammer, quench, and a long look down the edge.` };
    setState({ ...r.state, beats: [...r.state.beats, beat] });
    return r.item;
  }

  // Bind a forge-rune: fuse two affixes on a piece of gear into one signature power.
  function handleFusion(itemId, recipeId) {
    const r = applyFusionToItem(state, itemId, recipeId);
    if (!r.ok) { setError(r.reason || "The fusion failed."); return; }
    const beat = { id: `fuse${Date.now()}`, type: "narration", content: `You set the rune against ${r.item.name} and speak the binding. The two enchantments scream, twist, and fuse into one — ${r.label}.` };
    setState({ ...r.state, beats: [...r.state.beats, beat] });
    setFusionRune(null);
  }

  // Take the next apprenticeship step (coin + days at the forge). Confirmed
  // because it jumps the calendar significantly.
  async function handleApprentice(step) {
    if (loading) return;
    if (!(await askConfirm({ title: "Apprentice to the smith", body: `Train as ${step.title}? This costs ${formatCopper(step.costCp)} and ${step.days} days bound to the forge.`, confirmLabel: "Train" }))) return;
    const r = applyApprentice(state, step);
    if (!r.ok) { setError(r.reason || "You can't pay the smith."); return; }
    const beats = [{ id: `appr${Date.now()}`, type: "narration", content: `You bind yourself to the smith as ${step.title}. The days blur into bellows-heat, ruined billets, and the slow grammar of the hammer — and you come away knowing more than you did.` }];
    if (r.spoiled?.length) beats.push({ id: `spoil${Date.now()}`, type: "spoilage", lines: r.spoiled.map((s) => `${s.quantity}× ${s.name}`) });
    setShopTile(null); // the long apprenticeship ends the visit
    setState({ ...r.state, beats: [...r.state.beats, ...beats] });
  }

  // Pay an expert to drill a proficiency a rating step (engine/training.js).
  async function handleTrain(profId) {
    if (loading || !shopTile) return;
    const tile = standingTile();
    const building = buildingForTile(tile);
    const offer = trainingOffer(state, profId, TRAIN_CAP);
    if (offer.capped) { setError("There's nothing more they can teach you."); return; }
    if (!(await askConfirm({ title: `Train ${offer.name}`, body: `Have ${building?.keeper || "the expert"} drill you in ${offer.name} (rating ${offer.cur} → ${offer.next})? This costs ${formatCopper(offer.costCp)} and ${offer.hours} hours.`, confirmLabel: "Train" }))) return;
    const r = applyTraining(state, profId, TRAIN_CAP);
    if (!r.ok) { setError(r.reason || "Training failed."); return; }
    setShopTile(null); // a long session ends the visit
    setState({ ...r.state, beats: [...r.state.beats, { id: `train${Date.now()}`, type: "narration", content: `Under ${building?.keeper || "an expert"}'s eye you drill ${r.offer.name} for hours — it sharpens from ${r.offer.cur} to ${r.offer.next}.` }] });
  }

  // Deterministic, local transactions (engine/economy.js). The shop's stock is
  // rolled from a ruleset table (engine/town-gen.js); buying records the sale so
  // stock depletes until the next restock. `bucket` ties the sale to the current
  // restock window. Each purchase is receipted so it can be refunded in full
  // while the player is still at the stall.
  function handleBuy(itemDef, priceCp, bucket) {
    const key = standingKey();
    const r = buyGood(state, { tileKey: key, bucket, itemDef, priceCp, qty: 1 });
    if (!r.ok) return;
    setState(r.state);
    setReceipts((rec) => {
      const items = rec.tileKey === key ? { ...rec.items } : {};
      items[itemDef.id] = [...(items[itemDef.id] || []), priceCp];
      return { tileKey: key, items };
    });
  }
  // Buy a mount = a DEALING, like recruiting a companion. The player approaches; the
  // stabler shows the beast, names a price, and haggles. The engine completes the
  // sale only when the narrator closes it with buy_mount:{id, priceCp} (beat.js).
  async function handleApproachMount(mountId) {
    if (loading || !shopTile) return;
    const tmpl = mountTemplate(mountId);
    if (!tmpl) return;
    const place = poiPlaceName(standingTile().poi) || "the stable";
    const coins = formatCopper(coinsToCopper(state.character.inventory.coins));
    setShopTile(null);
    setError(null);
    setLoading(true);
    const playerBeat = { id: `p${Date.now()}`, type: "player", content: `You look over ${tmpl.name} at ${place}.` };
    const stateWithPlayer = { ...state, beats: [...state.beats, playerBeat] };
    setState(stateWithPlayer);
    try {
      const msg = `[APPROACH MOUNT] At ${place} the player looks to buy a ${tmpl.tier} ${tmpl.race} — a ${tmpl.name} (id: ${tmpl.id}): "${tmpl.desc}". The stabler's LISTED price is ${formatCopper(tmpl.priceCp || 0)}. The player has ${coins} on hand. Open the dealing in the stabler's voice per the [APPROACH MOUNT] doctrine — bring the beast out and show it, name the price, and haggle. Do NOT finalize on this beat; close it with buy_mount only when a settlement is reached — coin agreed and affordable, OR a non-coin path the fiction earns (a noble's writ accepted on credit, a ruse, a quiet theft, an in-kind trade); pass {settlement,settlementNote} when it isn't coin. The beast already has a name of the stabler's giving.`;
      const beat = await narrate(stateWithPlayer, msg);
      const next = applyBeat(stateWithPlayer, beat);
      setState(recordTurn(stateWithPlayer, msg, next));
      if (beat.start_combat) setPendingEngage({ dir: beat.start_combat });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // Rename a mount anytime (the codex/Company panel). No forced naming on join —
  // beasts come named by their kind's custom; this lets the player make it theirs.
  async function handleRenameMount(id) {
    const ch = state.world.codex.characters?.[id];
    if (!ch) return;
    const chosen = await askName({ title: "Rename", body: `What will you call ${ch.name}?`, defaultValue: ch.name, placeholder: ch.name, confirmLabel: "Rename" });
    if (!chosen || chosen === ch.name) return;
    setState((cur) => {
      const c = cur.world.codex.characters[id];
      if (!c) return cur;
      return { ...cur, world: { ...cur.world, codex: { ...cur.world.codex, characters: { ...cur.world.codex.characters, [id]: { ...c, name: chosen } } } } };
    });
  }

  async function handlePortraitChange(characterId, portrait) {
    const next = withPortraitOverride(liveStateRef.current, characterId, portrait);
    liveStateRef.current = next;
    setState(next);
    try {
      // Portrait changes are deliberate save-level edits. Flush immediately so
      // upload-then-exit cannot lose them to the ordinary autosave debounce.
      await flushActiveCampaign(next);
    } catch (e) {
      setCampaignError(`Portrait save failed: ${e.message || e}`);
      throw e;
    }
  }
  // Sell one unit. A refund consumes a receipt (full price paid); a plain sale
  // uses the used-goods price the trader view computed.
  function handleSell(itemId, priceCp, isRefund) {
    const r = sellGood(state, { itemId, priceCp, qty: 1 });
    if (!r.ok) return;
    setState(r.state);
    if (isRefund) {
      setReceipts((rec) => {
        const stack = rec.items[itemId];
        if (!stack || stack.length === 0) return rec;
        return { ...rec, items: { ...rec.items, [itemId]: stack.slice(0, -1) } };
      });
    }
  }

  // Use a consumable from the pack (engine/consumables.js) — applies its effect
  // and logs a short beat of what changed.
  function handleUse(itemId) {
    const r = useConsumable(state, itemId);
    if (!r.ok) {
      if (r.reason) setState({ ...state, beats: [...state.beats, { id: `use${Date.now()}`, type: "narration", content: r.reason }] });
      return;
    }
    setState({ ...r.state, beats: [...r.state.beats, { id: `use${Date.now()}`, type: "narration", content: r.summary }] });
  }

  // Light a torch / lantern, or snuff your light — deterministic, logs a beat.
  function applyToolResult(r, close = true) {
    if (!r.ok) {
      if (r.reason) setState({ ...state, beats: [...state.beats, { id: `lit${Date.now()}`, type: "narration", content: r.reason }] });
      return;
    }
    if (close) setDeckOpen(false);
    setState({ ...r.state, beats: [...r.state.beats, { id: `lit${Date.now()}`, type: "narration", content: r.summary }] });
  }
  function handleLightTorch() { applyToolResult(lightTorch(state)); }
  function handleLightLantern() { applyToolResult(lightLantern(state)); }
  function handleExtinguish() { applyToolResult(extinguish(state), false); }

  // Bed down and rest for the chosen hours — skips time, restores the Sleep need.
  function handleRest(hours) {
    const r = applyRest(state, hours);
    if (!r.ok) {
      if (r.reason) setState({ ...state, beats: [...state.beats, { id: `rest${Date.now()}`, type: "narration", content: r.reason }] });
      return;
    }
    setDeckOpen(false);
    setState({ ...r.state, beats: [...r.state.beats, { id: `rest${Date.now()}`, type: "narration", content: r.summary }] });
  }

  // ----- Tavern quest board: tasks, day-labour, recruiting -----

  function handleAcceptTask(posting) {
    const r = acceptTask(state, posting);
    if (!r.ok) return;
    setState({ ...r.state, beats: [...r.state.beats, { id: `q${Date.now()}`, type: "narration", content: `You take down the notice — "${posting.title}", posted by ${posting.giver}. It's yours to see through.` }] });
  }
  function handleAbandonTask(id) {
    setState(abandonTask(state, id).state);
  }
  // Hire yourself out for a stretch of labour — deterministic time + coin + wear.
  function handleDayLabour(job) {
    const r = applyDayLabour(state, job);
    if (!r.ok) return;
    setShopTile(null); // a stretch of work ends the visit
    setState({ ...r.state, beats: [...r.state.beats, { id: `lab${Date.now()}`, type: "narration", content: r.summary }] });
  }
  // Recruiting is a CONVERSATION, not a button. "Approach" only opens the
  // exchange — the player must actually talk the person round. The party's
  // standing (size, best attributes, how well-armed) vs the recruit's choosiness
  // is handed to the narrator, who plays their reception and, only once genuinely
  // won over, sets recruit_companion (applied in applyBeat). Folk don't follow a
  // lone, weak wanderer.
  async function handleApproachRecruit(tmpl) {
    if (loading || !shopTile || isRecruited(state, tmpl.id)) return;
    const place = poiPlaceName(standingTile().poi) || "the tavern";
    const standing = partyStanding(state);
    const outlook = recruitOutlook(standing, tmpl.choosiness);
    setShopTile(null);
    setError(null);
    setLoading(true);
    const playerBeat = { id: `p${Date.now()}`, type: "player", content: `You cross to ${tmpl.name}, the ${tmpl.role}, to feel them out about joining you.` };
    const stateWithPlayer = { ...state, beats: [...state.beats, playerBeat] };
    setState(stateWithPlayer);
    try {
      const msg = `[APPROACH RECRUIT] At ${place} the player approaches ${tmpl.name} (id: ${tmpl.id}), a ${tmpl.race} ${tmpl.role} — "${tmpl.desc}" — who is posted as willing to take the road for ${tmpl.terms}. They are ${tmpl.choosiness}-choosiness about who they'll follow. The player's company right now reads as ${standing.descriptor}; its strongest qualities: ${standing.bestLine}. Weighing that, ${tmpl.name}'s likely reception is "${outlook}". This is a FIRST meeting: ${tmpl.name} does NOT know the player's name (a name given earlier to the innkeeper did not reach them) — they address the player by look, bearing, or role until the player offers it, and only learn it if the player actually gives it during this exchange. Open the conversation in ${tmpl.name}'s voice — size up the player and their band, state interest/terms/skepticism. Do NOT have them join yet; the player must talk them round across the exchange. Only set recruit_companion:{"id":"${tmpl.id}"} once they are GENUINELY won over by what the player says and shows — and a scornful, unimpressed prospect (a strong fighter eyeing a lone weakling) may refuse outright. Keep it grounded; let the player's words decide.`;
      const beat = await narrate(stateWithPlayer, msg);
      const next = applyBeat(stateWithPlayer, beat);
      setState(recordTurn(stateWithPlayer, msg, next));
      if (beat.start_combat) setPendingEngage({ dir: beat.start_combat });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // Part ways with a companion (they stay in the codex as a known person).
  // Parting with a companion / setting a mount loose isn't a silent toggle — it's a
  // SCENE. Open it with the narrator (PARTING doctrine): the companion answers in
  // voice, others weigh in, the party balks at ditching a sound beast — and the
  // player can argue it out. The engine only removes them when the narrator resolves
  // it with part_ways:{id}. Closes the deck and plays in the main log.
  async function handleDismiss(id) {
    if (loading) return;
    const c = state.world.codex.characters[id];
    const isMount = c?.kind === "mount";
    const name = c?.name || (isMount ? "the beast" : "your companion");
    setDeckOpen(false);
    setError(null);
    setLoading(true);
    const playerBeat = { id: `p${Date.now()}`, type: "player", content: isMount ? `You move to set ${name} loose.` : `You tell ${name} you mean to part ways.` };
    const stateWithPlayer = { ...state, beats: [...state.beats, playerBeat] };
    setState(stateWithPlayer);
    try {
      const msg = `[PLAYER ACTION] [PART WAYS] You move to ${isMount ? `set ${name} loose` : `part ways with ${name}`}. Play the scene per the PARTING doctrine — voices in character, the party weighing in${isMount ? " (and likely objecting to abandoning a sound, paid-for beast — sell it instead?)" : ""}. Do NOT remove anyone yet unless it genuinely resolves now; the player may argue. Only set part_ways:{"id":"${id}"} once the parting is truly settled.`;
      const beat = await narrate(stateWithPlayer, msg);
      const next = applyBeat(stateWithPlayer, beat);
      setState(recordTurn(stateWithPlayer, msg, next));
      if (beat.start_combat) setPendingEngage({ dir: beat.start_combat });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // Scry for a character — the narrated live reading of a hidden position
  // (engine/positions.js). Ready-made roster characters also support an approximate
  // atlas track; scrying adds the in-fiction vision. Whereabouts that were never
  // recorded read as an unsettled, clouded vision.
  async function handleScry(id) {
    if (loading) return;
    const res = scryResult(state, id);
    setDeckOpen(false);
    setError(null);
    const who = state.world.codex.characters?.[id]?.name || "them";
    if (!res) {
      setState({ ...state, beats: [...state.beats, { id: `scry${Date.now()}`, type: "narration", content: `You search the glass for ${who}, but the vision will not settle — their whereabouts escape you.` }] });
      return;
    }
    setLoading(true);
    const key = `${res.pos.x},${res.pos.y}`;
    const baseState = { ...state, world: { ...state.world, seen: { ...state.world.seen, [key]: true } } };
    const playerBeat = { id: `p${Date.now()}`, type: "player", content: `You scry for ${res.name}.` };
    const stateWithPlayer = { ...baseState, beats: [...baseState.beats, playerBeat] };
    setState(stateWithPlayer);
    try {
      const near = res.place ? `${Math.round(res.place.dist)} hex(es) from ${res.place.name}` : `open, unmapped country at (${res.pos.x},${res.pos.y})`;
      const msg = `[PLAYER ACTION] [SCRY] You work a scrying to seek ${res.name}. The vision finds them ${res.pos.exact ? "" : "roughly "}at hex (${res.pos.x},${res.pos.y}) — ${near}. Describe what shows in the glass: where ${res.name} is now, what they are about, who is near — true to what's known of them and that place. This is the ONLY way the player learns a character's whereabouts; reveal no more than the scrying shows. Use minutes_passed = 10.`;
      const beat = await narrate(stateWithPlayer, msg);
      const next = applyBeat(stateWithPlayer, beat);
      setState(recordTurn(stateWithPlayer, msg, next));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleTrackCharacter(id) {
    setState((current) => toggleTrackedCharacter(current, id));
  }

  // Seat a rider (the player "wanderer", a companion, or a smaller mount) onto a
  // mount, weight permitting; or get them off (engine/riding.js).
  function handleMount(riderId, mountId) {
    const r = mountRider(state, riderId, mountId);
    if (r.ok) setState(r.state);
  }
  function handleDismountRider(riderId) {
    const r = dismountRider(state, riderId);
    if (r.ok) setState(r.state);
  }

  // ----- Gaol: bounties + buying prisoner rights -----

  function handleAcceptBounty(b) {
    const r = acceptBounty(state, b);
    if (!r.ok) return;
    setState({ ...r.state, beats: [...r.state.beats, { id: `bty${Date.now()}`, type: "narration", content: `You take the warden's contract on ${b.name} — wanted for ${b.crime}. Dead or alive.` }] });
  }
  // Inspecting a prisoner is the start of a CONVERSATION, not a button-click
  // purchase. The player approaches the cells with the warden; the scene plays
  // and the player can haggle the rights-fee or walk away. Only when the
  // narrator emits purchase_rights:{key,agreedPriceCp} does the engine take
  // the coin and add them to the party as a bonded codex character (beat.js).
  async function handleInspectRights(p) {
    if (loading || !shopTile) return;
    const place = poiPlaceName(standingTile().poi) || "the gaol";
    setShopTile(null);
    setError(null);
    setLoading(true);
    const playerBeat = { id: `p${Date.now()}`, type: "player", content: `You step up to the warden to look closer at ${p.name}.` };
    const stateWithPlayer = { ...state, beats: [...state.beats, playerBeat] };
    setState(stateWithPlayer);
    try {
      const msg = `[INSPECT RIGHTS] At ${place} the player has walked up to the warden's desk to inspect the rights of ${p.name} (key: ${p.key}; ${p.gender}, age ${p.age}), held for ${p.crime} — ${p.desc}. The warden's asking is ${formatCopper(p.rightsCp)} (this is the OPENING price; the player has paid NOTHING yet). Open the scene: the prisoner stands in the cell or is fetched to the desk, the warden reads the charge, names the fee. Voice the prisoner sparingly during inspection — they don't speak unless addressed. The player chats in their own voice across multiple turns; the warden may lower the fee within reason, hold firm, or refuse the sale (rare). Only when the settlement is reached — coin agreed, OR a non-coin path the warden accepts in fiction (a noble's writ-of-deposit, a forged release-order, a bribe in kind, a quiet swap) — set purchase_rights:{"key":"${p.key}","agreedPriceCp":<final copper>,"settlement":"coin|writ|ruse|theft|gift|barter","settlementNote":"<one-line act; required for non-coin>"}; the engine takes coin only when settlement is coin, files the bonded codex entry with the settlement recorded, and adds the prisoner to the party. The consequence of a non-coin settlement (the writ called in, the forgery surfacing, a bribed keeper turning) is yours to play in later beats. If the player walks away without a deal, just narrate the close and emit nothing. Don't fabricate combat.`;
      const beat = await narrate(stateWithPlayer, msg);
      const next = applyBeat(stateWithPlayer, beat);
      setState(recordTurn(stateWithPlayer, msg, next));
      if (beat.start_combat) setPendingEngage({ dir: beat.start_combat });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // ----- Slave market (The Block): inspecting a captive's bond -----

  // Inspecting a captive is the start of a CONVERSATION, not a button-click
  // purchase. The player moves along the line, the Chain Factor reads the
  // slate, the captive stands counted on the platform; the player can haggle
  // the bond-price across multiple turns, or walk away. Only when the narrator
  // emits purchase_captive:{key,agreedPriceCp} does the engine take the coin
  // and add them to the party as a bonded codex character (beat.js). See THE
  // BLOCK passage in src/system-prompt.js for the four paths (keep / ransom /
  // sell-on / force-release) and the refusal-default for any freedom offer.
  async function handleInspectCaptive(c) {
    if (loading || !shopTile) return;
    const place = poiPlaceName(standingTile().poi) || "the block";
    setShopTile(null);
    setError(null);
    setLoading(true);
    const playerBeat = { id: `p${Date.now()}`, type: "player", content: `You move along the line to look closer at ${c.name}.` };
    const stateWithPlayer = { ...state, beats: [...state.beats, playerBeat] };
    setState(stateWithPlayer);
    try {
      const msg = `[INSPECT CAPTIVE] At ${place} the player has moved along the line to inspect ${c.name} (key: ${c.key}; ${c.gender}, age ${c.age}) — ${c.origin}, ${c.taken} (${c.desc}). They can ${c.skills}. Their spirit reads as ${c.spirit}. Their freedom_response cue, for if the player offers to free them: ${c.freedom_response}. The Chain Factor's asking bond is ${formatCopper(c.priceCp)} — this is the OPENING price; the player has paid NOTHING yet. Open the inspection scene: the captive stands counted on the platform, irons heated at the edge, the trader reads the slate and frames the four-factor appraisal (skills, appearance, rarity, age/condition). Voice the captive sparingly during inspection — they don't speak unless addressed. The player chats in their own voice across multiple turns; the trader may lower the bond within reason (his floor is a real one), hold firm, or refuse the sale (rare). The captive's freedom_response/refusal-doctrine stays in force for any actual offer of freedom. Only when the settlement is reached — coin agreed and the trader strikes the irons, OR a non-coin settlement the trader accepts (a noble's deposit-writ on credit, a forged seal, a ruse, a captive taken off the platform by force or sleight, an in-kind trade) per THE BLOCK doctrine — set purchase_captive:{"key":"${c.key}","agreedPriceCp":<final copper>,"settlement":"coin|writ|ruse|theft|gift|barter","settlementNote":"<one-line act-description; required for non-coin>"}; the engine takes coin only when settlement is coin, files the bonded codex entry with the settlement recorded, and adds the captive to the party — narrate the hand-off (irons struck, writ signed, captive falls in line, or whatever the act demands). The consequence of a non-coin settlement (the trader calling in the writ, an uncovered ruse souring the trader and Registry, the watch chasing a theft, a debt of service binding the player to a noble's house) is yours to play in later beats. If the player walks away without a deal, just narrate the close and emit nothing. Don't fabricate combat.`;
      const beat = await narrate(stateWithPlayer, msg);
      const next = applyBeat(stateWithPlayer, beat);
      setState(recordTurn(stateWithPlayer, msg, next));
      if (beat.start_combat) setPendingEngage({ dir: beat.start_combat });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // ----- Long-press a bubble: Rewrite / Edit / Rewind -----

  function openBeatMenu(beat, index) {
    if (!["narration", "dialogue", "player"].includes(beat.type)) return;
    const turns = state.turns || [];
    // Rewind keeps the selected bubble's turn and drops everything AFTER it. A
    // player bubble's turn is the one it kicked off; a narration/dialogue's is the
    // turn it belongs to. Rewind is possible only if a later turn exists to drop.
    const turnK = beat.type === "player" ? turnStartedAt(state, index) : turnForBeatIndex(state, index);
    const canRewind = beat.type === "player"
      ? turnK >= 0 || index + 1 < state.beats.length
      : turnK >= 0 && turnK + 1 < turns.length;
    const kind = beat.type === "player" ? "player" : "narrative";
    setBeatMenu({ beatId: beat.id, index, kind, turnK, canRewind });
    setBeatMode("menu");
    setRewriteText("");
    setEditText(beat.type === "dialogue" ? beat.line : beat.content);
  }

  function closeBeatMenu() {
    setBeatMenu(null);
    setBeatMode("menu");
    setRewriteText("");
    setEditText("");
  }

  // Rewrite the turn that produced this bubble: rewind to just before it (dropping
  // it and everything after), then re-roll that moment with the player's steer.
  async function handleRewriteBeat() {
    const menu = beatMenu;
    const feedback = rewriteText.trim();
    if (!menu || menu.kind !== "narrative" || menu.turnK < 0 || !feedback || loading) return;
    const cp = state.turns[menu.turnK];
    closeBeatMenu();
    setError(null);
    setLoading(true);
    setPendingEngage(null);
    setPendingCombat(null);
    setPendingLoot(null);
    const base = stateBeforeTurn(state, menu.turnK);
    setState(base); // roll the rejected beat (and any later ones) out of the log + memory
    try {
      const directive = `\n\n[REWRITE — author's steer] The player is exercising author's privilege over your PREVIOUS narration of this exact moment and wants it taken in a different direction. Your previous version was:\n"""\n${cp.prevText}\n"""\nWrite a NEW version of this same moment from the same game state, fully honoring the player's steer: "${feedback}". This is how the player nudges the story toward turns it would not take on its own — a trope, a twist, a character's choice. Lean into it as far as the established world, characters, and state plausibly allow, and keep continuity with everything before this moment. Your output REPLACES the previous version; do not mention that it was rewritten.`;
      const beat = await narrate(base, cp.message + directive);
      // Keep memory clean of the steer scaffolding so later turns don't treat the
      // rejected version as canon.
      beat._userMsg = cp.message;
      // A travel turn re-lands the player at the destination (and re-reveals the
      // route); any other turn just re-applies its beat.
      const next = cp.travel
        ? applyTravelArrival(base, beat, cp.travel)
        : applyBeat(base, beat);
      setState(recordTurn(base, cp.message, next, cp.travel ? { travel: cp.travel } : {}));
      if (cp.travel?.encounter?.posture === "hostile") setPendingCombat(cp.travel.encounter);
      if (beat.start_combat) setPendingEngage({ dir: beat.start_combat });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // Rewind: a player message becomes queued input again (including when it is the
  // latest completed turn); narration/dialogue keeps its whole turn and drops only
  // later turns.
  function handleRewindBeat() {
    const menu = beatMenu;
    if (!menu || !menu.canRewind || loading) return;
    closeBeatMenu();
    setPendingEngage(null);
    setPendingCombat(null);
    setPendingLoot(null);
    setState(menu.kind === "player"
      ? rewindToPlayerBeat(state, menu.index)
      : stateAfterTurn(state, menu.turnK));
  }

  // Manually edit the bubble's text in place (synced into the model's memory).
  function handleEditBeat() {
    const menu = beatMenu;
    const text = editText.trim();
    if (!menu || !text) return;
    setState((s) => editBeat(s, menu.beatId, text));
    closeBeatMenu();
  }

  // Delete just this one bubble (a stray dialogue line, an unwanted aside),
  // leaving the rest of the turn in place.
  function handleDeleteBeat() {
    const menu = beatMenu;
    if (!menu) return;
    setState((s) => deleteBeat(s, menu.beatId));
    closeBeatMenu();
  }

  // ----- Combat handlers -----

  function startCombat(enemies, context, extraOpts = {}, st = state) {
    if (!enemies || enemies.length === 0) return;
    combatCtxRef.current = context || { flavor: enemies[0].name };
    setDeckOpen(false); setMapOpen(false); setShopTile(null);
    setPendingCombat(null);
    closeBeatMenu();
    const region = regionHere(st);
    const wp = activeWorldPassives(st.character, st.world.codex);
    // Recruited companions keep their own level, attributes, and kit wherever
    // they travel; moving into a harsher region must not silently restat them.
    const allies = (st.party || [])
      .map((id) => st.world.codex.characters?.[id])
      .filter((c) => c && c.combatState?.status !== "dead")
      .map((c) => allyFromCompanion(c, st.world.codex));
    // Mounted-rider bonuses: a rider fights with their mount's charge under them.
    // The mount is also an ally here; this is the lift its rider gets (engine/combat).
    const chars = st.world.codex.characters || {};
    const carrierBonus = (entry) => (entry?.ridingOn && chars[entry.ridingOn]?.mountedBonus) || null;
    for (const a of allies) if (a.companionId) a._mountedBonus = carrierBonus(chars[a.companionId]);
    const playerMountedBonus = carrierBonus(chars.wanderer);
    setCombat(initCombat(st.character, st.world.codex, enemies, {
      seed: hashSeed([
        currentCampaignId || "local",
        st.time?.day || 0,
        st.time?.hour || 0,
        st.time?.minute || 0,
        st.world.currentTile?.x || 0,
        st.world.currentTile?.y || 0,
        st.turns?.length || st.beats?.length || 0,
        context?.flavor || enemies.map((enemy) => enemy.name).join("/"),
      ]),
      playerMountedBonus,
      maxLootTier: region.lootTier,
      region: region.level,
      ownedUniques: ownedUniqueIds(st),
      coinBonus: wp.coinBonus || 0,
      dark: inTheDark(st),
      sunlight: locationLightStatus(st).source === "daylight",
      weary: hasCondition(st.character.conditions, "Exhausted"),
      allies,
      ...extraOpts,
    }));
  }

  // Narrator-flagged combat: an explicit strike in the fiction (start_combat).
  // Built from the post-beat state `st` so a foe just added to the codex resolves.
  function startCombatFromDirective(dir, st) {
    const region = regionHere(st);
    const foes = (dir.foes && dir.foes.length) ? dir.foes : [{ kind: "bandits" }];
    const enemies = [];
    for (const f of foes) {
      const npc = f.npc_id && st.world.codex.characters[f.npc_id];
      if (npc) enemies.push(enemyFromNPC(npc, st.world.codex, { tierId: f.tier || "common" }));
      else enemies.push(...generateEnemyGroup(f.kind || "bandits", { power: region.power, maxTier: f.tier || region.enemyTier, count: f.count, name: f.name }));
    }
    if (enemies.length === 0) return;
    const ambush = dir.surprise ? (dir.initiator === "enemy" ? "enemy" : "player") : null;
    // Brawls (a barfight, "teach him a lesson") are bare-knuckle unless the
    // narrator flags it lethal; weapons can still be drawn mid-fight.
    startCombat(enemies, { flavor: dir.note || groupFlavor(enemies) }, { ambush, lethal: dir.lethal !== false }, st);
  }

  // Looking for a fight goes through the narrator — it decides whether there's
  // anyone worth fighting, or whether stirring trouble brings consequences.
  // It may (or may not) hand off to the combat engine via start_combat.
  async function handleSeekCombat() {
    if (loading || combat) return;
    setMapOpen(false);
    setError(null);
    setLoading(true);
    const playerBeat = { id: `p${Date.now()}`, type: "player", content: "You look for a fight." };
    const stateWithPlayer = { ...state, beats: [...state.beats, playerBeat] };
    setState(stateWithPlayer);
    try {
      const msg = `[PLAYER ACTION] You go looking for a fight here — sizing up who might be willing to cross blades.\n\n[SEEK COMBAT] The player is trying to pick a fight at this location. Decide naturally what it holds right now: a willing opponent (set start_combat), no one interested (start_combat null), or consequences for disturbing the peace (guards/patrons step in — start_combat against them). Respect this place's current state; do NOT invent an endless supply of enemies, and if it has already been cleared or emptied there is nothing to fight.`;
      const beat = await narrate(stateWithPlayer, msg);
      const next = applyBeat(stateWithPlayer, beat);
      setState(recordTurn(stateWithPlayer, msg, next));
      if (beat.start_combat) setPendingEngage({ dir: beat.start_combat });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleFightPending() {
    if (!pendingCombat) return;
    const region = regionHere(state);
    const enemies = generateEnemyGroup(pendingCombat.kind, { power: region.power, maxTier: region.enemyTier });
    // A carried flame in the dark gives you away — the foe gets the jump on you.
    const ambush = isBeacon(state) ? "enemy" : undefined;
    startCombat(enemies, { flavor: pendingCombat.desc || groupFlavor(enemies) }, ambush ? { ambush } : {});
  }

  // Slip past a hostile travel encounter unseen — only reliable when you're
  // hidden in the dark (no flame). Logs the moment; never starts the fight.
  function handleSlipAway() {
    if (!pendingCombat) return;
    setPendingCombat(null);
    if (isHidden(state)) {
      setState((s) => ({ ...s, beats: [...s.beats, { id: `slip${Date.now()}`, type: "narration", content: "Unseen in the dark, you hold still and let the danger pass — then melt away the other direction." }] }));
    }
  }

  // Begin combat the player has agreed to via the engage prompt.
  function handleEngage() {
    if (!pendingEngage || combat) return;
    const dir = pendingEngage.dir;
    setPendingEngage(null);
    startCombatFromDirective(dir, state);
  }

  async function handleResolveCombat() {
    if (!combat) return;
    const cs = combat;
    const ctx = combatCtxRef.current || {};
    const next = applyCombatResult(state, cs, ctx);
    // A defeat by a legendary-tier+ foe is a real, final death; any other defeat is
    // a survivable scenario (robbed, abducted, enslaved…).
    const epicDeath = cs.phase === "defeat" && isEpicEncounter(cs) && (cs.lethal || cs.escalated);
    setState(next);
    setCombat(null);
    combatCtxRef.current = null;
    // Spoils aren't auto-taken — offer a deliberate Search the fallen (never when dead).
    if (!epicDeath && next.pendingLoot) setPendingLoot({ ...next.pendingLoot, lethal: cs.lethal });

    // The story always continues from the result, so the player can react.
    setError(null);
    setLoading(true);
    try {
      const place = currentLocationName(next);
      let msg;
      if (epicDeath) {
        msg = `[DEATH] You have fallen — slain by ${ctx.flavor || "a foe far beyond your strength"} at ${place}. This is the end of ${next.character.name || "the Wanderer"}'s story, and it must land like one: narrate a single, unflinching final passage — the killing blow given its full weight, what you did with your last breath, and the silence after. Make it heroic, terrible, and earned. This death is PERMANENT: offer no rescue, no miraculous reprieve, no "but somehow you survive." End the tale.`;
      } else if (cs.phase === "defeat") {
        const wasLethal = cs.lethal || cs.escalated;
        msg = `[DEFEATED] You were beaten ${wasLethal ? "down with weapons drawn" : "senseless in a bare-knuckle brawl"} by ${ctx.flavor || "your foe"} at ${place} and lost consciousness — you are NOT dead, and this is not where your story ends. Choose a fate that fits WHO beat you and WHERE, then narrate the player waking to face it: robbed of coin and goods (inventory_changes), beaten and thrown out, hauled to the watch or thrown in a cell, or abducted and moved elsewhere (tile_move) — dragged off by goblins to their warren, pressed into a labor gang or a ship's galley, sold to slavers, held for ransom, or left for dead in a ditch but breathing. ${wasLethal ? "Weapons were out, so the aftermath can be brutal — grave wounds, a maiming, waking somewhere far worse." : "It was only fists, so keep it a humbling, not a maiming."} Apply wounds as conditions, location_update if the place changed, and inventory_changes for what was taken. Death-and-reload is not the goal; the player survives to claw their way back.`;
      } else {
        const result = cs.phase === "victory" ? "You won — every foe is slain or down."
          : cs.phase === "resolved" ? "The fight ended without a slaughter — see the report for each foe's fate (yielded / fled / knocked out)."
          : "You broke off and fled the fight.";
        msg = `[COMBAT OVER] ${result} At ${place}. Narrate the immediate aftermath STRICTLY from the [COMBAT REPORT] — name the actual foe(s) and their exact fates, the room's reaction, your state — then leave the moment open for the player to react. A foe that yielded is present, beaten, and at your mercy: refer to THEM by name; do NOT introduce or substitute a different character to take the foe's place. Do not restart combat.`;
      }
      const beat = await narrate(next, msg);
      const after = applyBeat(next, beat);
      if (epicDeath) {
        const ended = {
          cause: "fallen in battle",
          foe: ctx.flavor || "a foe beyond their strength",
          place, day: after.time?.day || null,
        };
        setState({ ...recordTurn(next, msg, after), ended });
      } else {
        setState(recordTurn(next, msg, after));
        if (beat.start_combat) setPendingEngage({ dir: beat.start_combat });
      }
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // Deliberately search the fallen: grant the spoils, then let the narrator
  // narrate it and adjudicate the fallout (it takes time; robbing corpses in
  // public draws the watch).
  async function handleLootFallen() {
    const manifest = pendingLoot;
    if (!manifest || loading) return;
    setPendingLoot(null);
    const { state: looted, taken } = applyLoot(state, manifest);
    setState(looted);
    setError(null);
    setLoading(true);
    try {
      const place = currentLocationName(looted);
      const msg = `[LOOTED] You take the time to search the ${manifest.deadCount > 1 ? `${manifest.deadCount} bodies` : "body"} and come away with: ${taken || "little of worth"}. This happens at ${place} and takes several minutes in plain sight. Narrate it, and adjudicate the fallout — rifling a corpse in a public, lawful place draws horror and the watch; in the wilds or a den, no one cares. Apply consequences (location_update, conditions, start_combat with guards, or tile_move) as fits.`;
      const beat = await narrate(looted, msg);
      const after = applyBeat(looted, beat);
      setState(recordTurn(looted, msg, after));
      if (beat.start_combat) setPendingEngage({ dir: beat.start_combat });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  const onCombatPlayCard = (cardUid, targetUid) => setCombat((c) => (c ? playCard(c, cardUid, targetUid) : c));
  const onCombatTarget = (uid) => setCombat((c) => (c ? setTarget(c, uid) : c));
  const onCombatEndTurn = () => setCombat((c) => (c ? endPlayerTurn(c) : c));
  const onCombatFlee = () => setCombat((c) => (c ? playerFlee(c) : c));
  const onCombatStandDown = () => setCombat((c) => (c ? playerStandDown(c) : c));
  const onCombatCeasefire = () => setCombat((c) => (c ? playerCeasefire(c) : c));

  // ----- Render flow -----

  const sceneTile = getTile(state, state.world.currentTile.x, state.world.currentTile.y);
  const sceneVisual = biomeVisual(sceneBiomeId((getBiomeById(sceneTile.regionId) || getBiome(state.world.currentTile.x, state.world.currentTile.y, state.world.seed)).id, sceneTile));

  if (!authChecked) {
    return <CenteredLoader title="Waking the realm" detail="Restoring your session" />;
  }

  function handleUpdateNarratorSettings(nextSettings) {
    setState((current) => ({
      ...current,
      narratorSettings: normalizeNarratorSettings(nextSettings),
    }));
  }

  function handleUpdateMemories(nextMemories) {
    setState((current) => ({
      ...current,
      memories: normalizeMemoryBank(nextMemories),
    }));
  }

  function handleUpdateCharacterMemories(characterId, nextMemories) {
    setState((current) => {
      const character = current.world?.codex?.characters?.[characterId];
      if (!character) return current;
      return {
        ...current,
        world: {
          ...current.world,
          codex: {
            ...current.world.codex,
            characters: {
              ...current.world.codex.characters,
              [characterId]: {
                ...character,
                memories: normalizeMemoryBank(nextMemories, MEMORY_CAP),
              },
            },
          },
        },
      };
    });
  }
  if (!user) return <AuthScreen />;
  if (!subChecked) {
    return <CenteredLoader title="Checking your passage" detail="Confirming access to the realm" />;
  }
  if (!subscribed) {
    return (
      <SubscriptionScreen
        email={user.email}
        onRecheck={handleRecheckSubscription}
        onSignOut={handleSignOut}
        busy={subBusy}
      />
    );
  }
  if (!resumeChecked) {
    return <CenteredLoader title="Finding your journey" detail="Looking for your last open campaign" />;
  }
  if (!menuEntered) {
    return (
      <TitleScreen
        email={user.email}
        onStart={() => setMenuEntered(true)}
        onSignOut={handleSignOut}
        busy={!campaignsLoaded || campaignBusy}
        error={campaignError}
      />
    );
  }
  if ((!campaignsLoaded || campaignBusy) && !currentCampaignId) {
    return (
      <CenteredLoader
        title={campaignBusy ? "Opening your journey" : "Gathering your journeys"}
        detail={campaignBusy ? "Restoring your latest save" : "Loading saved campaigns"}
      />
    );
  }
  if (!currentCampaignId) {
    return (
      <>
        <CampaignsList
          campaigns={campaigns}
          email={user.email}
          onSelect={handleSelectCampaign}
          onNew={handleNewCampaign}
          onDelete={handleDeleteCampaign}
          onRename={handleRenameCampaign}
          onBack={() => setMenuEntered(false)}
          onSignOut={handleSignOut}
          busy={campaignBusy}
          error={campaignError}
        />
        {/* The confirm dialog must render here too — otherwise Delete on the
            campaigns screen sets the dialog state but nothing shows it (the main
            game's ConfirmDialog is past this early return). */}
        {confirmDialog && (
          <ConfirmDialog
            title={confirmDialog.title}
            body={confirmDialog.body}
            confirmLabel={confirmDialog.confirmLabel}
            cancelLabel={confirmDialog.cancelLabel}
            danger={confirmDialog.danger}
            onResolve={(v) => { confirmDialog.resolve(v); setConfirmDialog(null); }}
          />
        )}
      </>
    );
  }

  // The run has ended — the player fell in an epic encounter. A memorial replaces
  // the game; the only way on is back to the campaigns list.
  if (state.ended) {
    return <GameOverScreen state={state} onExit={handleBackToCampaigns} />;
  }

  // A wired town building (poi.service) at the player's current tile, if any —
  // surfaces an "Enter" affordance to open its menu. Hidden during combat.
  const buildingHere = combat ? null : buildingForTile(standingTile());
  const buildingOpenNow = buildingHere ? isBuildingOpen(buildingHere, state.time.hour) : false;
  // Creation hub: a fresh, untouched limbo shows the templates-vs-limbo chooser.
  // Once the player picks the freeform path (creationEntered) or has already
  // spoken a line, the normal limbo interview takes over.
  const inLimbo = state.created === false;
  const showCreationHub = inLimbo && !creationEntered && !state.beats.some((b) => b.type === "player");
  const queuedPlayerCount = pendingPlayerBeats(state).length;
  const readyAdvancements = state.created === false ? 0 : (pendingLevelAllocations(state.character)?.unspentLevels || 0);
  const advancementNeedsChoice = state.created !== false && pendingProgressionChoices(state.character)
    .some((choice) => choice.kind !== "level-allocation");
  return (
    <div className="game-shell" style={{
      backgroundColor: "var(--scene-deep)",
      height: "100dvh", width: "100%", maxWidth: combat ? "1440px" : "640px", margin: "0 auto",
      display: "flex", flexDirection: "column", position: "relative", overflow: "hidden",
      "--scene-primary": sceneVisual.primary,
      "--scene-accent": sceneVisual.accent,
      "--scene-highlight": sceneVisual.secondary,
      "--scene-deep": sceneVisual.deep,
    }}>
      {/* Limbo (character creation) shows the ethereal between-place backdrop with
          the HUD hidden; the real world shows the scene backdrop + full HUD. */}
      {state.created === false ? <InitialBackdrop /> : <SceneBackdrop state={state} />}
      {campaignBusy && <JourneyResumeOverlay />}
      <div className="game-hud-layer">
        {state.created !== false && (
          <div className="story-hud">
            <CompactHeader
              state={state}
              onMap={() => setMapOpen(true)}
              onOpenDeck={() => { setDeckPage("character"); setDeckOpen(true); }}
            />
            <VitalsStrip state={state} onExtinguish={handleExtinguish} />
          </div>
        )}
        {/* In the freeform limbo interview, keep a character-panel button so the
            player can audit the (still-forming) sheet and leave without getting
            stuck — the hub has its own controls, so it's hidden there. */}
        {inLimbo && !showCreationHub && (
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 14px 0" }}>
            <button onClick={() => { setDeckPage("character"); setDeckOpen(true); }} aria-label="Character" style={{
              width: "38px", height: "38px", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
              backgroundColor: "rgba(20,29,29,0.6)", border: `1px solid rgba(215,167,111,0.35)`, cursor: "pointer",
            }}>
              <Icon name="character" size={21} />
            </button>
          </div>
        )}
        <div className="story-log-frame">
          <div
            ref={logRef}
            className="story-log"
            onWheelCapture={handleStoryWheel}
            onTouchStart={handleStoryTouchStart}
            onTouchMove={handleStoryTouchMove}
            onTouchEnd={() => { storyTouchYRef.current = null; }}
            onTouchCancel={() => { storyTouchYRef.current = null; }}
            onScroll={handleStoryScroll}
            onKeyDownCapture={handleStoryKeyDown}
            onPointerDownCapture={handleStoryPointerDown}
          >
            {state.beats.map((b, i) => <BeatRender key={b.id} beat={b} onMenu={() => openBeatMenu(b, i)} />)}
            {loading && <LiveNarratorStream thinking={liveNarrator.thinking} story={liveNarrator.story} />}
            {error && (
              <ErrorBanner>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "space-between" }}>
                  <span style={{ minWidth: 0 }}>{error}</span>
                  {retry && (
                    <button onClick={handleRetry} disabled={loading} style={{
                      flexShrink: 0, padding: "6px 14px", borderRadius: 10,
                      backgroundColor: "rgba(215,167,111,0.18)", color: colors.parchmentLight,
                      border: "1px solid rgba(215,167,111,0.4)", fontSize: "12px", fontWeight: 800,
                      cursor: loading ? "default" : "pointer", fontFamily: "inherit", opacity: loading ? 0.5 : 1,
                    }}>Retry</button>
                  )}
                </div>
              </ErrorBanner>
            )}
            {campaignError && <ErrorBanner>{campaignError}</ErrorBanner>}
          </div>
          {!storyFollowing && !storyAtBottom && (
            <button type="button" className="story-jump-latest" onClick={scrollStoryToLatest} aria-label="Jump to latest story output">
              <span>↓</span> Latest
            </button>
          )}
        </div>
        {state.created !== false && pendingCombat && !combat && (
          <div className="fade-in" style={{
            margin: "0 12px 8px", padding: "11px 14px",
            backgroundColor: "rgba(35,15,15,0.7)", border: `1px solid rgba(239,68,68,0.4)`,
            borderRadius: 14, display: "flex", alignItems: "center", gap: "10px",
            boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "8px", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800, color: "#fca5a5", marginBottom: "2px" }}>Hostile</div>
              <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "14px", color: "#fde8e4", lineHeight: 1.3 }}>{pendingCombat.desc}</div>
            </div>
            <button onClick={handleFightPending} style={{
              padding: "9px 16px", borderRadius: 12, backgroundColor: colors.gold, color: colors.ink,
              border: "none", fontSize: "13px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
            }}>{isBeacon(state) ? "Fight (seen!)" : "Fight"}</button>
            <button onClick={handleSlipAway} style={{
              padding: "9px 12px", borderRadius: 12, backgroundColor: "transparent", color: "rgba(215,167,111,0.7)",
              border: `1px solid rgba(215,167,111,0.25)`, fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
            }}>{isHidden(state) ? "Slip away" : "Avoid"}</button>
          </div>
        )}
        {state.created !== false && pendingEngage && !combat && (
          <div className="fade-in" style={{
            margin: "0 12px 8px", padding: "11px 14px",
            backgroundColor: "rgba(35,15,15,0.7)", border: `1px solid rgba(239,68,68,0.45)`,
            borderRadius: 14, display: "flex", alignItems: "center", gap: "10px",
            boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "8px", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800, color: "#fca5a5", marginBottom: "2px" }}>
                {pendingEngage.dir?.initiator === "enemy" ? "Under attack" : "To arms"}
              </div>
              <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "14px", color: "#fde8e4", lineHeight: 1.3 }}>
                {pendingEngage.dir?.note || "Blades are about to be drawn."}
              </div>
            </div>
            <button onClick={handleEngage} style={{
              padding: "9px 16px", borderRadius: 12, backgroundColor: colors.gold, color: colors.ink,
              border: "none", fontSize: "13px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
            }}>{pendingEngage.dir?.initiator === "enemy" ? "Defend" : "Engage"}</button>
            {pendingEngage.dir?.initiator !== "enemy" && (
              <button onClick={() => setPendingEngage(null)} style={{
                padding: "9px 12px", borderRadius: 12, backgroundColor: "transparent", color: "rgba(215,167,111,0.7)",
                border: `1px solid rgba(215,167,111,0.25)`, fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
              }}>Hold</button>
            )}
          </div>
        )}
        {state.created !== false && pendingLoot && !combat && (
          <div className="fade-in" style={{
            margin: "0 12px 8px", padding: "11px 14px",
            backgroundColor: "rgba(20,29,29,0.8)", border: `1px solid rgba(215,167,111,0.4)`,
            borderRadius: 14, display: "flex", alignItems: "center", gap: "10px",
            boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "8px", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800, color: colors.gold, marginBottom: "2px" }}>The fallen</div>
              <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "14px", color: colors.parchmentLight, lineHeight: 1.3 }}>
                {pendingLoot.deadCount > 1 ? `${pendingLoot.deadCount} bodies lie` : "A body lies"} where they fell. Searching takes time — and watching eyes.
              </div>
            </div>
            <button onClick={handleLootFallen} disabled={loading} style={{
              padding: "9px 16px", borderRadius: 12, backgroundColor: colors.gold, color: colors.ink,
              border: "none", fontSize: "13px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit", flexShrink: 0, opacity: loading ? 0.5 : 1,
            }}>Search</button>
            <button onClick={() => setPendingLoot(null)} style={{
              padding: "9px 12px", borderRadius: 12, backgroundColor: "transparent", color: "rgba(215,167,111,0.7)",
              border: `1px solid rgba(215,167,111,0.25)`, fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
            }}>Leave</button>
          </div>
        )}
        {state.created !== false && buildingHere && !shopTile && (
          <div className="fade-in" style={{
            margin: "0 12px 8px", padding: "11px 14px",
            backgroundColor: "rgba(20,29,29,0.8)", border: `1px solid rgba(215,167,111,0.4)`,
            borderRadius: 14, display: "flex", alignItems: "center", gap: "10px",
            boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "8px", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800, color: buildingOpenNow ? colors.gold : "rgba(215,167,111,0.55)", marginBottom: "2px" }}>
                {buildingHere.marketTierLabel ? `${buildingHere.marketTierLabel} · ` : ""}
                {buildingHere.kind === "trader" ? "Trader" : buildingHere.kind === "smith" ? "Smith" : buildingHere.kind === "tavern" ? "Tavern" : buildingHere.kind === "gaol" ? "Gaol" : buildingHere.kind === "slavemarket" ? "Auction" : buildingHere.kind === "stable" ? "Stable" : "Building"}
              </div>
              <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "14px", color: colors.parchmentLight, lineHeight: 1.3 }}>
                {buildingOpenNow
                  ? `${buildingHere.label} — ${(buildingHere.kind === "tavern" || buildingHere.kind === "gaol") ? "read the board." : buildingHere.kind === "slavemarket" ? "look over the lots." : "step up to the counter."}`
                  : `${buildingHere.label} is shut — it opens at ${String(buildingHours(buildingHere).open).padStart(2, "0")}:00.`}
              </div>
            </div>
            <button onClick={buildingOpenNow ? openShop : undefined} disabled={!buildingOpenNow} style={{
              padding: "9px 16px", borderRadius: 12,
              backgroundColor: buildingOpenNow ? colors.gold : "rgba(215,167,111,0.12)",
              color: buildingOpenNow ? colors.ink : "rgba(215,167,111,0.45)",
              border: "none", fontSize: "13px", fontWeight: 800,
              cursor: buildingOpenNow ? "pointer" : "not-allowed", fontFamily: "inherit", flexShrink: 0,
            }}>{buildingOpenNow ? "Enter" : "Closed"}</button>
          </div>
        )}
        <InputBar
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          onRun={handleRunNarrator}
          queuedCount={queuedPlayerCount}
          loading={loading}
          advancementCount={readyAdvancements}
          advancementNeedsChoice={advancementNeedsChoice}
          onOpenProgression={() => { setDeckPage("progression"); setDeckOpen(true); }}
        />
      </div>

      {beatMenu && (
        <BeatActionSheet
          mode={beatMode}
          kind={beatMenu.kind}
          canRewrite={beatMenu.kind === "narrative" && beatMenu.turnK >= 0}
          canRewind={beatMenu.canRewind}
          loading={loading}
          rewriteText={rewriteText}
          editText={editText}
          onRewriteText={setRewriteText}
          onEditText={setEditText}
          onChooseRewrite={() => setBeatMode("rewrite")}
          onChooseEdit={() => setBeatMode("edit")}
          onRewind={handleRewindBeat}
          onDelete={handleDeleteBeat}
          onSubmitRewrite={handleRewriteBeat}
          onSubmitEdit={handleEditBeat}
          onClose={closeBeatMenu}
        />
      )}

      {showCreationHub && (
        <CreationHub
          onPickTemplate={applyCharacterSetup}
          onCustom={() => setCreationEntered(true)}
          onQuit={handleBackToCampaigns}
          busy={loading}
        />
      )}
      {manualCreation && (
        <ManualCreation
          onBegin={applyCharacterSetup}
          onCancel={() => setManualCreation(false)}
          onQuit={() => { setManualCreation(false); handleBackToCampaigns(); }}
          busy={loading}
        />
      )}
      {deckOpen && (
        <PanelDeck
          state={state}
          user={user}
          initialPage={deckPage}
          onClose={() => setDeckOpen(false)}
          handlers={{
            // Party
            onDismiss: handleDismiss, onMount: handleMount, onDismount: handleDismountRider,
            // Character
            onCastBuff: handleCastBuff, onReset: handleResetCampaign,
            onBackToCampaigns: handleBackToCampaigns,
            onSignOut: handleSignOut,
            onLinkEmail: linkEmail,
            onScry: handleScry, onTrackCharacter: handleTrackCharacter, onRenameMount: handleRenameMount,
            onPortraitChange: handlePortraitChange,
            onChooseProgression: handleProgressionChoice,
            // Settings
            onUpdateNarratorSettings: handleUpdateNarratorSettings,
            onUpdateMemories: handleUpdateMemories,
            onUpdateCharacterMemories: handleUpdateCharacterMemories,
            // Inventory
            onEquip: handleEquip, onUnequip: handleUnequip, onUse: handleUse,
            onTransfer: handleTransfer,
            onLightTorch: handleLightTorch, onLightLantern: handleLightLantern,
            onRest: (h) => { setDeckOpen(false); handleRest(h); },
            onBindRune: (id) => { setDeckOpen(false); setFusionRune(id); },
          }}
        />
      )}
      {fusionRune && (
        <RuneFusionView
          runeName={state.world.codex.items?.[fusionRune]?.name || itemTemplate(fusionRune)?.name || "Forge-Rune"}
          options={fusionOptionsForRune(state, fusionRune)}
          onFuse={handleFusion}
          onClose={() => setFusionRune(null)}
        />
      )}
      {mapOpen && (
        <WorldExploration
          state={state}
          onClose={() => {
            if (!travelMarch?.id) setMapOpen(false);
          }}
          onTravel={handleTravel}
          travelMarch={travelMarch}
          onTravelMarchFinish={handleTravelMarchFinish}
          onFly={handleFly}
          onTeleport={handleTeleport}
          onSeekCombat={handleSeekCombat}
          loading={loading}
        />
      )}
      {shopTile && (() => {
        const tile = standingTile();
        const building = buildingForTile(tile);
        if (!building) return null;
        const key = standingKey();
        if (shopView === "forge" && building.forge) {
          return (
            <ForgeView
              state={state}
              building={building}
              schematics={schematicsForBuilding(building)}
              rank={blacksmithRank(state)}
              onApprentice={handleApprentice}
              onForge={handleForge}
              onBack={() => setShopView("trade")}
              onClose={closeShop}
              loading={loading}
            />
          );
        }
        if (building.kind === "tavern") {
          const board = generateBoard(key, state.time.day);
          return (
            <QuestBoardView
              state={state}
              building={building}
              board={board}
              onAccept={handleAcceptTask}
              onAbandon={handleAbandonTask}
              onLabour={handleDayLabour}
              onRecruit={handleApproachRecruit}
              onClose={() => setShopTile(null)}
              loading={loading}
            />
          );
        }
        if (building.kind === "gaol") {
          const board = generateGaol(key, state.time.day);
          return (
            <PrisonView
              state={state}
              building={building}
              board={board}
              onAccept={handleAcceptBounty}
              onAbandon={handleAbandonTask}
              onInspectRights={handleInspectRights}
              onClose={() => setShopTile(null)}
              loading={loading}
            />
          );
        }
        if (building.kind === "slavemarket") {
          const board = generateSlaveMarket(key, state.time.day);
          return (
            <SlaveMarketView
              state={state}
              building={building}
              board={board}
              tileKey={key}
              onInspect={handleInspectCaptive}
              onClose={() => setShopTile(null)}
              loading={loading}
            />
          );
        }
        if (building.kind === "stable") {
          const stock = rollShopStock(building, key, state.time.day);
          // Mounts are gated by REGION (the stable's biome), with a per-tile
          // override; the signature is always in, the rest seed-roll per window.
          const biome = getBiome(shopTile.x, shopTile.y, state.world.seed);
          const stockEntry = tile.poi?.mounts || stableStockFor(biome.id);
          const mounts = rollStableMounts(stockEntry, key, state.time.day);
          return (
            <StableView
              state={state}
              building={building}
              tileKey={key}
              stock={stock}
              mounts={mounts}
              onClose={closeShop}
              onBuy={handleBuy}
              onApproachMount={handleApproachMount}
              loading={loading}
            />
          );
        }
        if (building.kind === "trader" || building.kind === "smith") {
          const stock = rollShopStock(building, key, state.time.day);
          return (
            <TraderView
              state={state}
              building={building}
              tileKey={key}
              stock={stock}
              receipts={receipts.tileKey === key ? receipts.items : {}}
              onClose={closeShop}
              onBuy={handleBuy}
              onSell={handleSell}
              onForge={building.forge ? () => setShopView("forge") : undefined}
              onTrain={handleTrain}
              loading={loading}
            />
          );
        }
        return null;
      })()}
      {combat && (
        <CombatView
          combat={combat}
          onPlayCard={onCombatPlayCard}
          onSetTarget={onCombatTarget}
          onEndTurn={onCombatEndTurn}
          onFlee={onCombatFlee}
          onStandDown={onCombatStandDown}
          onCeasefire={onCombatCeasefire}
          onResolve={handleResolveCombat}
        />
      )}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          body={confirmDialog.body}
          confirmLabel={confirmDialog.confirmLabel}
          cancelLabel={confirmDialog.cancelLabel}
          danger={confirmDialog.danger}
          onResolve={(v) => { confirmDialog.resolve(v); setConfirmDialog(null); }}
        />
      )}
      {namePrompt && (
        <NamePrompt
          title={namePrompt.title}
          body={namePrompt.body}
          defaultValue={namePrompt.defaultValue}
          placeholder={namePrompt.placeholder}
          confirmLabel={namePrompt.confirmLabel}
          onResolve={(v) => { namePrompt.resolve(v); setNamePrompt(null); }}
        />
      )}
    </div>
  );
}
