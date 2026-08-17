import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";

import { STORAGE_KEY, SIGHT_RADIUS, FLY_TRAVEL_HEXES, FLY_REVEAL_RADIUS, OVERBURDENED_TRAVEL_MULT, MOUNT_FLIGHT_NEED_PER_HOUR, MOUNT_FLIGHT_MIN_NEED, WORLD_MARCH_LIMIT } from "./config.js";
import { TERRAINS } from "./data/terrains.js";
import {
  makeInitialState,
  makeNewCampaignState,
  migrateCodex,
  resetCampaignState,
} from "./data/initial-state.js";

import { storeGet, storeDel } from "./engine/storage.js";
import { callNarrator } from "./engine/api-supabase.js";
import { buildNarratorProjection, narratorTurnPolicy } from "./engine/narrator-projection.js";
import { specializedNarratorPolicyOptions } from "./engine/narrator-specialized-policy.js";
import { onAuthChange, signOut, linkEmail, isSubscribed } from "./engine/auth-supabase.js";
import { listCampaigns, loadCampaignRecord, saveCampaign, deleteCampaign, renameCampaign } from "./engine/campaigns-supabase.js";
import {
  clearCampaignResume,
  prepareWarmCampaignState,
  readLastCampaignId,
  readResumeSnapshot,
  rememberLastCampaignId,
  shouldRecoverResumeSnapshot,
  writeResumeSnapshot,
} from "./engine/campaign-resume.js";
import { applyBeat as applyEngineBeat } from "./engine/beat.js";
import {
  applyCompiledNarratorPresentation,
  applyCompiledNarratorStoryPresentation,
  applyCompiledNarratorTurn as applyBeat,
} from "./engine/narrator-turn-application.js";
import {
  deleteBeat, editBeat, narratorMessageForPendingPlayers, pendingPlayerBeats,
  canRewindToTurn, finalizeTurnCheckpoint, recordTurn, rewindToPlayerBeat, startTurnCheckpoint,
  stateBeforeTurn, stateAfterTurn, turnForBeatIndex, turnStartedAt,
} from "./engine/timeline.js";
import { withPortraitOverride } from "./engine/portrait-overrides.js";
import { applyStoryFontScale } from "./engine/preferences.js";
import {
  createTravelMarchWaiter,
  isTravelLifecycleTokenCurrent,
  settleTravelLifecycle,
  travelHaltBeat,
} from "./engine/travel-lifecycle.js";
import {
  applyTravelNarrationPresentation,
  authoritativeTravelDiscovery,
  prepareTravelSettlement,
  publicTravelLocationName,
  replayTravelSettlement,
  travelDiscoveryFromRevealedTile,
} from "./engine/travel-settlement.js";
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
import { rollRoadEvent } from "./engine/road-events.js";
import { ROAD_OFFERS } from "./data/road-events.js";
import { describeLegStop, describePassage, legCamps, planLeg, travelHaltSummary } from "./engine/expedition.js";
import { SPAWN_TABLES } from "./data/spawn-tables.js";
import { getBiome, getBiomeById } from "./data/biomes.js";
import { ECOLOGIES } from "./data/continent.js";
import { biomeVisual, sceneBiomeId } from "./data/visual-assets.js";
import { generateEnemyGroup, enemyFromNPC } from "./data/bestiary.js";
import { regionDifficulty } from "./data/regions.js";
import { hashSeed } from "./engine/combat-rng.js";
import { applyLoot, lootCtx, rollLoot } from "./engine/combat-loot.js";
import {
  emptyMechanicsSidecar,
  hasMechanicsSidecar,
  upgradeCampaignPayload,
} from "./engine/campaign-migration.js";
import { admitTowEncounter, admissionPlayerNotice } from "./gameplay/tow/admission.js";
import { applyCharacterBootstrap, compileCharacterBootstrap } from "./gameplay/tow/character-bootstrap.js";
import { isTowBuild } from "./gameplay/tow/build.js";
import { MOVING_FORMATION_RULES_VERSION } from "./gameplay/tow/formation.js";
import { claimReward, compileRewardOffer, rerollRewardOffer, rewardSeedFor } from "./gameplay/tow/rewards.js";
import { getSkill, replacementSkillIds, SKILL_SLOTS } from "./gameplay/tow/skills.js";
import { refusalNotice } from "./gameplay/campaign/command-gateway.js";
import {
  claimPresentation,
  completePresentation,
  enqueuePresentation,
  releasePresentation,
  requeueAbandonedPresentations,
} from "./gameplay/campaign/presentation-outbox.js";
import {
  buildCombatChronicle,
  chronicleSummary,
  renderCombatChronicle,
} from "./gameplay/tow/chronicle.js";
import { dispatchTowPlayerAction } from "./gameplay/tow/commands.js";
import { combatItemsFromInventory } from "./gameplay/tow/combat-items.js";
import { DEFAULT_PRACTICE_ALLY_GROUP_ID } from "./gameplay/tow/practice-scenarios.js";
import { sealTowTerminalReceipt, worldFatesByParticipant } from "./gameplay/tow/outcomes.js";
import { decodeTowSession } from "./gameplay/tow/persistence.js";
import {
  createTowSession,
  markTowSessionSettled,
  spendTowSessionStream,
  streamSequencer,
} from "./gameplay/tow/session.js";
import { towEnemyFromBestiary, towPlayerFromCharacter } from "./gameplay/tow/solitaire-bridge.js";
import { towBuildForCharacter } from "./gameplay/tow/professions.js";
import { activeTowItemIds, effectiveTowBuild } from "./gameplay/tow/start-items.js";
import {
  characterSetupForArchetype,
  createDefaultArchetypeDraft,
  getStartingArchetype,
  practiceBuildForArchetypeDraft,
  practiceSkillRaritiesForArchetypeDraft,
} from "./gameplay/tow/starting-archetypes.js";
import { settleTowEncounter } from "./gameplay/tow/settlement.js";
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
import { weaponPresentationForCharacter } from "./gameplay/tow/weapon-presentation.js";
import { poiPlaceName } from "./engine/location.js";
import {
  claimRunReward,
  refreshRunReward,
  resolveRunCommand,
} from "./gameplay/run/state.js";
import { REFERENCE_GAMEPLAY_PREVIEW_ENABLED } from "./gameplay/reference/release-gate.js";
import {
  closeReferenceGameplay,
  openReferenceGameplay,
  readReferenceGameplay,
  startReferenceGatekeeperTrial,
  transitionReferenceGameplay,
} from "./gameplay/run/campaign-boundary.js";
import { adaptNarratorCombatStart } from "./gameplay/production/combat-adapter.js";
import {
  readProductionCombatSession,
  startProductionCombatSession,
  transitionProductionCombatSession,
} from "./gameplay/production/combat-session.js";
import { settleProductionCombat } from "./gameplay/production/combat-settlement.js";
import {
  createPendingCombatHandoff,
  readPendingCombatDirective,
  readPendingCombatHandoff,
} from "./gameplay/production/pending-directive.js";
import {
  createPendingTravelCombat,
  readPendingTravelCombat,
} from "./gameplay/production/pending-travel-combat.js";

import { CompactHeader } from "./components/CompactHeader.jsx";
import { TowCombatView } from "./components/combat/TowCombatView.jsx";
import { resolvePlayerCombatCutout } from "./components/combat/tow-combat-art.js";
import ProductionCombatView from "./components/combat/ProductionCombatView.jsx";
import { ReferenceCombatView } from "./components/combat/ReferenceCombatView.jsx";
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
import { QuickStartLane } from "./components/creation/QuickStartLane.jsx";
import { PracticeFight } from "./components/creation/PracticeFight.jsx";
import { JourneyLoader, JourneyResumeOverlay } from "./components/JourneyLoader.jsx";
import { emptyLiveNarrator } from "./engine/live-narrator.js";
import { buildChatContextSections } from "./components/chatContextModel.js";
import { getNarratorModel, narratorModelLabel } from "./engine/narrator-models.js";
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
  const cur = state.world.currentTile;
  const tile = getTile(state, cur.x, cur.y);
  if (tile.status?.depopulated) return null;
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
// Tiers are a world concept, not a Tower of Winter one, so the encounter itself does not
// carry them — the foes it was built from do, and they are kept alongside it.
function isEpicEncounter(_encounter, context = {}) {
  return (context.sources || []).some((e) => tierOrder(e.tier) >= tierOrder("legendary"));
}

// Snapshot a pack as { itemId: quantity } so two snapshots can be diffed into a
// bought/sold list (used to flavor the trader's parting reaction).
function invQtyMap(carried) {
  const m = {};
  for (const c of carried || []) m[c.itemId] = (m[c.itemId] || 0) + c.quantity;
  return m;
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

export function prepareCampaignState(loaded) {
  const upgraded = upgradeCampaignPayload(loaded);
  if (!upgraded.ok || !upgraded.writable) {
    const error = new Error(`Campaign migration failed: ${upgraded.reason || "unwritable-payload"}`);
    error.code = "CAMPAIGN_MIGRATION_FAILED";
    error.reason = upgraded.reason || "unwritable-payload";
    throw error;
  }
  // Pull forward any codex entries (races, professions, named NPCs) added to
  // initial-state.js since the snapshot was written.
  const migrated = migrateCodex(upgraded.state);
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

// One ordinary narrator application seam for both the UI and regression tests.
// The imported alias is intentionally the compiled-turn gate, never beat.js.
export function applyNarratorTurnResult(base, message, turn, current = base, extra = {}) {
  const applied = extra.policyOptions?.route === "combat-aftermath"
    ? applyCompiledNarratorStoryPresentation(base, turn)
    : applyBeat(base, turn, { acceptTerminalEffect: extra.acceptTerminalEffect === true });
  const recorded = recordTurn(base, message, applied, extra);
  return {
    ...recorded,
    // Portraits are save-level presentation, not fiction state. A valid request
    // may land after an upload without rolling that upload back.
    portraitOverrides: current.portraitOverrides || {},
  };
}

export function narratorCombatHandoff(turn) {
  const directive = turn?.start_combat;
  if (!directive) return null;
  return {
    mode: directive.initiator === "player" ? "pending" : "immediate",
    directive,
  };
}

export function pendingEngageForNarratorTurn(turn) {
  const handoff = narratorCombatHandoff(turn);
  return handoff?.mode === "pending" ? handoff.directive : null;
}

const TERMINAL_EFFECT_BY_ROUTE = Object.freeze({
  "mount-negotiation": ["buy_mount", "Confirm mount transaction"],
  "recruitment-negotiation": ["recruit_companion", "Confirm recruitment"],
  "party-departure": ["part_ways", "Confirm departure"],
  "rights-negotiation": ["purchase_rights", "Confirm rights transaction"],
  "captive-negotiation": ["purchase_captive", "Confirm captive transaction"],
});

export function narratorTerminalEffectConfirmation(policyOptions, turn) {
  const [effect, title] = TERMINAL_EFFECT_BY_ROUTE[policyOptions?.route] || [];
  const proposal = effect ? turn?.[effect] : null;
  if (!proposal) return null;
  const target = proposal.id || proposal.key;
  const price = Number.isInteger(proposal.priceCp)
    ? proposal.priceCp
    : (Number.isInteger(proposal.agreedPriceCp) ? proposal.agreedPriceCp : null);
  const settlement = typeof proposal.settlement === "string" ? proposal.settlement : null;
  return {
    title,
    body: [
      `Apply the proposed ${effect.replaceAll("_", " ")} for ${target}?`,
      price == null ? null : `Exact price: ${price} copper.`,
      settlement ? `Settlement: ${settlement}.` : null,
    ].filter(Boolean).join(" "),
    confirmLabel: "Accept",
  };
}

function sameNarratorCommitState(base, current) {
  if (!base || !current) return false;
  const keys = new Set([...Object.keys(base), ...Object.keys(current)]);
  for (const key of keys) {
    // Portrait uploads are presentation-only and are explicitly merged at commit.
    if (key === "portraitOverrides") continue;
    if (!Object.is(base[key], current[key])) return false;
  }
  return true;
}

export function isNarratorRequestFresh({
  request,
  activeRequest,
  currentCampaignId,
  currentUserId,
  currentState,
  response,
}) {
  if (!request || activeRequest !== request) return false;
  if (request.campaignId !== currentCampaignId || request.userId !== currentUserId) return false;
  const responseRevision = response?._stateRevision ?? response?.state_revision;
  if (responseRevision !== request.stateRevision) return false;
  if (buildNarratorProjection(currentState).stateRevision !== request.stateRevision) return false;
  return sameNarratorCommitState(request.baseState, currentState);
}

export function invalidateNarratorRequest(activeRequestRef, reason = "Narrator request cancelled.") {
  const request = activeRequestRef.current;
  // Drop identity first: even a transport that ignores AbortSignal can no longer
  // commit or clear UI belonging to a later request.
  activeRequestRef.current = null;
  if (request?.controller && !request.controller.signal.aborted) {
    request.controller.abort(new Error(reason));
  }
}

function checkpointPolicyOptions(checkpoint) {
  if (checkpoint?.policyOptions?.route) return checkpoint.policyOptions;
  if (checkpoint?.travel) return { route: "travel-presentation" };
  // Legacy checkpoints predate policyOptions. Their original engine-authored
  // prompt can still recover specialized route + exact target constraints.
  try {
    return specializedNarratorPolicyOptions(checkpoint?.message);
  } catch {
    return {};
  }
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
  // One controlled character-start draft. It remains here while practice temporarily
  // replaces the chooser, so returning from a fight preserves archetype, face, and name.
  const [startDraft, setStartDraft] = useState(() => createDefaultArchetypeDraft());
  // A practice receipt is disposable by design and must never reach campaign persistence.
  const [practiceDraft, setPracticeDraft] = useState(null);
  const [quickStartError, setQuickStartError] = useState(null);
  // Who this tab is, for the presentation lease. Stable for the tab's lifetime so a claim it
  // holds is recognisably its own, and a claim it left behind expires like anyone else's.
  const presentationOwnerRef = useRef(`tab-${Math.random().toString(36).slice(2, 10)}`);
  const [fusionRune, setFusionRune] = useState(null); // forge-rune id being bound in the fusion ritual
  const [mapOpen, setMapOpen] = useState(false);
  // Ground travel is narrated and animated concurrently. Canonical world
  // state still lands only through finishTravel; this object is transient UI
  // state and is deliberately excluded from campaign persistence.
  const [travelMarch, setTravelMarch] = useState(null);
  // Where the last leg ended and why, shown on the map itself. Arrival used to
  // close the map, which put the player back in the chat at a hex they never
  // chose to stop at; leaving the map is their decision now.
  const [travelHalt, setTravelHalt] = useState(null);
  const travelMarchWaitersRef = useRef(new Map());
  const travelMarchSequenceRef = useRef(0);
  // Non-travel narrator calls use the same identity discipline as travel: only
  // the active request for this exact user/campaign/base state may commit.
  const narratorRequestSequenceRef = useRef(0);
  const activeNarratorRequestRef = useRef(null);
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
    for (const waiter of travelMarchWaitersRef.current.values()) {
      waiter.resolve?.("cancelled");
    }
    travelMarchWaitersRef.current.clear();
    travelLifecycleRef.current.generation += 1;
    travelLifecycleRef.current.controller = controller;
    return {
      generation: travelLifecycleRef.current.generation,
      campaignId: currentCampaignIdRef.current,
      baseState,
      controller,
    };
  }

  function isTravelLifecycleCurrent(lifecycle) {
    return isTravelLifecycleTokenCurrent(
      lifecycle,
      travelLifecycleRef.current.generation,
      currentCampaignIdRef.current,
    );
  }

  function abortActiveTravel(reason = "Travel cancelled.") {
    const controller = travelLifecycleRef.current.controller;
    travelLifecycleRef.current.controller = null;
    if (controller && !controller.signal.aborted) controller.abort(new Error(reason));
  }

  function cancelTravelLifecycle({ closeMap = true, preserveEncounter = false } = {}) {
    travelLifecycleRef.current.generation += 1;
    abortActiveTravel();
    for (const waiter of travelMarchWaitersRef.current.values()) {
      waiter.resolve?.("cancelled");
    }
    travelMarchWaitersRef.current.clear();
    setTravelMarch(null);
    setTravelHalt(null);
    setLiveNarrator(emptyLiveNarrator());
    if (!preserveEncounter) {
      setPendingCombat(null);
      setPendingEngage(null);
    }
    if (closeMap) setMapOpen(false);
    setLoading(false);
  }

  function beginNarratorRequest(baseState) {
    invalidateNarratorRequest(activeNarratorRequestRef, "Narrator request superseded.");
    const controller = new AbortController();
    narratorRequestSequenceRef.current += 1;
    const request = {
      id: narratorRequestSequenceRef.current,
      campaignId: currentCampaignIdRef.current,
      userId: authUserIdRef.current,
      baseState,
      stateRevision: buildNarratorProjection(baseState).stateRevision,
      controller,
    };
    activeNarratorRequestRef.current = request;
    return request;
  }

  function narratorRequestIsCurrent(request, response, currentState = liveStateRef.current) {
    return isNarratorRequestFresh({
      request,
      activeRequest: activeNarratorRequestRef.current,
      currentCampaignId: currentCampaignIdRef.current,
      currentUserId: authUserIdRef.current,
      currentState,
      response,
    });
  }

  function cancelNarratorRequest(reason = "Narrator request cancelled.") {
    invalidateNarratorRequest(activeNarratorRequestRef, reason);
    setLiveNarrator(emptyLiveNarrator());
    setLoading(false);
    setRetry(null);
  }

  useEffect(() => () => {
    invalidateNarratorRequest(
      activeNarratorRequestRef,
      "Narrator request abandoned because the application closed.",
    );
    travelLifecycleRef.current.generation += 1;
    abortActiveTravel("Travel abandoned because the application closed.");
    for (const waiter of travelMarchWaitersRef.current.values()) {
      waiter.resolve?.("cancelled");
    }
    travelMarchWaitersRef.current.clear();
  }, []);

  // A halt describes the leg just walked. Closing the map — by any route, not
  // just the halt card's own button — ends that moment, so reopening later must
  // not greet the player with a stale stop.
  useEffect(() => {
    if (!mapOpen) setTravelHalt(null);
  }, [mapOpen]);

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

  // Combat: the fight is durable campaign state, not component state. It used to be a
  // `useState` for the encounter beside a `useRef` for its context, and both were gone the
  // moment the page reloaded — the fight with them, and with the context the ability to
  // settle the fight correctly at all. `pendingCombat` is still a hostile encounter
  // offering a fight before one has been admitted.
  const [pendingLoot, setPendingLoot] = useState(null); // spoils to deliberately Search
  const [productionCombatFeedback, setProductionCombatFeedback] = useState(null);
  const [referenceGameplayFeedback, setReferenceGameplayFeedback] = useState(null);
  const [referencePersistenceFeedback, setReferencePersistenceFeedback] = useState(null);
  const [towCombatFeedback, setTowCombatFeedback] = useState(null);
  // An aftermath scene that failed to arrive. The settlement is already applied and the
  // factual report is already in the story, so this costs prose and nothing else.
  const [pendingAftermath, setPendingAftermath] = useState(null);

  // The saved fight is decoded on every read rather than trusted. A payload that fails the
  // codec becomes a visible, recoverable error — never a silent "no combat in progress",
  // which to the player is indistinguishable from the engine eating their encounter.
  const storedTowCombat = state.mechanics?.tow?.activeCombat ?? null;
  const towCombat = useMemo(
    () => (storedTowCombat == null
      ? { ok: false, reason: "no-active-tow-combat", session: null }
      : decodeTowSession(storedTowCombat)),
    [storedTowCombat],
  );
  const combatSession = towCombat.ok ? towCombat.session : null;
  // A settled session stays in state as the durable record that this fight is finished —
  // that is what a reload between the last blow and the aftermath needs to land on — but it
  // is no longer a fight, so nothing that asks "are we fighting" may see it.
  const combat = combatSession && combatSession.status !== "settled"
    ? combatSession.encounter
    : null;
  const towCombatInvalid = storedTowCombat != null && !towCombat.ok;

  // An owed scene is a fact about the campaign, not about this tab. Reading it off the queue
  // rather than off component state is what makes the offer survive a reload — otherwise the
  // job sits there, durable and invisible, with nothing to trigger it.
  const owedPresentation = useMemo(
    () => (state.presentationJobs || []).find(
      (job) => job.status === "pending" || job.status === "failed",
    ) ?? null,
    [state.presentationJobs],
  );

  const referenceGameplaySave = state.referenceGameplaySave;
  const referenceGameplayAttempt = state.referenceGameplayAttempt;
  const referenceGameplayCampaignSeed = state.referenceGameplayCampaignSeed;
  const referenceGameplayWorld = state.world;
  const referenceGameplay = useMemo(
    () => (REFERENCE_GAMEPLAY_PREVIEW_ENABLED
      ? readReferenceGameplay(
        {
          referenceGameplaySave,
          referenceGameplayAttempt,
          referenceGameplayCampaignSeed,
          world: referenceGameplayWorld,
        },
        { campaignId: currentCampaignId || "local-campaign" },
      )
      : { ok: false, reason: "reference-gameplay-preview-disabled", run: null }),
    [
      referenceGameplayAttempt,
      referenceGameplayCampaignSeed,
      referenceGameplaySave,
      referenceGameplayWorld,
      currentCampaignId,
    ],
  );
  const referenceRun = referenceGameplay.ok ? referenceGameplay.run : null;
  const referenceGameplayInvalid = referenceGameplaySave != null && !referenceGameplay.ok;
  const referenceGameplayOpen = Boolean(
    REFERENCE_GAMEPLAY_PREVIEW_ENABLED && referenceRun && state.referenceGameplayOpen !== false,
  );
  const activeProductionCombatSession = state.activeCombatSession;
  const productionCombat = useMemo(() => {
    if (activeProductionCombatSession == null) {
      return { ok: false, reason: "no-active-production-combat", session: null };
    }
    const opened = readProductionCombatSession(activeProductionCombatSession);
    if (!opened.ok) return opened;
    if (currentCampaignId && opened.session.campaignId !== currentCampaignId) {
      return { ok: false, reason: "production-combat-campaign-mismatch", session: null };
    }
    return opened;
  }, [activeProductionCombatSession, currentCampaignId]);
  const productionCombatSession = productionCombat.ok ? productionCombat.session : null;
  const productionCombatInvalid = activeProductionCombatSession != null && !productionCombat.ok;
  const pendingCombatDirectiveValue = state.pendingCombatDirective;
  const pendingCombatDirective = useMemo(
    () => (pendingCombatDirectiveValue == null
      ? { ok: false, reason: "no-pending-combat-directive", handoff: null }
      : readPendingCombatHandoff(pendingCombatDirectiveValue, {
        campaignId: currentCampaignId || "local-campaign",
        state,
      })),
    [pendingCombatDirectiveValue, currentCampaignId, state],
  );
  const pendingEngage = pendingCombatDirective.ok
    ? { dir: pendingCombatDirective.handoff.directive }
    : null;
  const pendingCombatDirectiveInvalid = pendingCombatDirectiveValue != null
    && !pendingCombatDirective.ok;
  const pendingTravelCombatValue = state.pendingTravelCombat;
  const pendingTravelCombat = useMemo(
    () => (pendingTravelCombatValue == null
      ? { ok: false, reason: "no-pending-travel-combat", pending: null }
      : readPendingTravelCombat(pendingTravelCombatValue, {
        campaignId: currentCampaignId || "local-campaign",
        state,
      })),
    [pendingTravelCombatValue, currentCampaignId, state],
  );
  const pendingCombat = pendingTravelCombat.ok
    ? { ...pendingTravelCombat.pending, posture: "hostile" }
    : null;
  const pendingTravelCombatInvalid = pendingTravelCombatValue != null && !pendingTravelCombat.ok;
  const productionCombatOpen = Boolean(productionCombatSession || productionCombatInvalid);
  const exclusiveGameplayOpen = referenceGameplayOpen || productionCombatOpen;
  const referenceRunSettled = referenceRun?.status === "completed"
    || referenceRun?.status === "defeated";
  const referenceGameplayWasOpenRef = useRef(referenceGameplayOpen);
  useEffect(() => {
    const wasOpen = referenceGameplayWasOpenRef.current;
    referenceGameplayWasOpenRef.current = referenceGameplayOpen;
    if (!wasOpen || referenceGameplayOpen) return undefined;
    const frame = requestAnimationFrame(() => {
      document.querySelector("[data-reference-trial-return-focus]")?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [referenceGameplayOpen]);
  useLayoutEffect(() => {
    if (!exclusiveGameplayOpen) return undefined;
    const ownedBackgrounds = new Map();
    const claimBackground = (element) => {
      if (!(element instanceof HTMLElement)
        || element.classList.contains("reference-combat")
        || element.classList.contains("production-combat")
        || element.classList.contains("production-combat-recovery")
        || ownedBackgrounds.has(element)) return;
      ownedBackgrounds.set(element, {
        hadInert: element.hasAttribute("inert"),
        hadHidden: element.hasAttribute("hidden"),
        ariaHidden: element.getAttribute("aria-hidden"),
      });
      element.setAttribute("inert", "");
      element.setAttribute("hidden", "");
      element.setAttribute("aria-hidden", "true");
    };
    const gameShell = document.querySelector(".game-shell");
    if (gameShell) {
      for (const child of gameShell.children) claimBackground(child);
    }
    const applicationRoot = gameShell?.closest("#root") || gameShell?.parentElement;
    for (const child of document.body.children) {
      if (child !== applicationRoot) claimBackground(child);
    }
    const globalSurfaces = document.querySelector("[data-app-global-surfaces]");
    claimBackground(globalSurfaces);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) claimBackground(node);
      }
    });
    if (gameShell) observer.observe(gameShell, { childList: true });
    observer.observe(document.body, { childList: true });
    return () => {
      observer.disconnect();
      for (const [element, previous] of ownedBackgrounds) {
        if (!previous.hadInert) element.removeAttribute("inert");
        if (!previous.hadHidden) element.removeAttribute("hidden");
        if (previous.ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", previous.ariaHidden);
      }
    };
  }, [exclusiveGameplayOpen]);
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
  const [contextPreviewOpen, setContextPreviewOpen] = useState(false);

  // ----- QoL preferences (story text size etc.) applied as CSS vars on mount -----
  useEffect(() => { applyStoryFontScale(); }, []);

  // ----- Auth subscription -----
  useEffect(() => {
    let mounted = true;
    const unsubscribe = onAuthChange((u) => {
      if (!mounted) return;
      const nextUserId = u?.id ?? null;
      if (authUserIdRef.current !== nextUserId) {
        cancelNarratorRequest("Narrator request cancelled because the signed-in user changed.");
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
                const migrated = prepareCampaignState(convertLegacyV10ToHex(legacy));
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
      const cached = writeResumeSnapshot({
        userId: user.id,
        campaignId: currentCampaignId,
        state: snapshot,
        dirty,
        serverUpdatedAt: lastServerUpdatedAtRef.current,
      });
      if (REFERENCE_GAMEPLAY_PREVIEW_ENABLED && snapshot.referenceGameplaySave) {
        setReferencePersistenceFeedback(cached
          ? null
          : "Browser recovery cache could not be updated. Progress is not durable until server autosave succeeds.");
      }
    }, 250);
    return () => clearTimeout(resumeCacheTimerRef.current);
  }, [state, hydrated, currentCampaignId, user?.id]);

  function recordSuccessfulCampaignSave({ id, userId, snapshot, updatedAt }) {
    if (currentCampaignIdRef.current !== id || authUserIdRef.current !== userId) return null;
    lastSyncedStateRef.current = snapshot;
    lastServerUpdatedAtRef.current = updatedAt ?? lastServerUpdatedAtRef.current;
    const latestState = liveStateRef.current;
    const latestIsSavedSnapshot = latestState === snapshot;
    const cached = writeResumeSnapshot({
      userId,
      campaignId: id,
      state: latestState,
      dirty: !latestIsSavedSnapshot,
      serverUpdatedAt: lastServerUpdatedAtRef.current,
    });
    return { cached, latestIsSavedSnapshot, latestState };
  }

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
          const recorded = recordSuccessfulCampaignSave({
            id,
            userId: user.id,
            snapshot,
            updatedAt: result?.updatedAt,
          });
          if (REFERENCE_GAMEPLAY_PREVIEW_ENABLED && recorded?.latestState.referenceGameplaySave) {
            setReferencePersistenceFeedback(recorded.cached
              ? null
              : recorded.latestIsSavedSnapshot
                ? "Browser recovery cache could not be updated. Server autosave succeeded, but cold browser recovery is unavailable."
                : "Browser recovery cache could not be rebased after an earlier autosave succeeded. Newer progress is not durable until its server autosave succeeds.");
          }
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
    recordSuccessfulCampaignSave({
      id,
      userId: user.id,
      snapshot,
      updatedAt: result?.updatedAt,
    });
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
    cancelNarratorRequest("Narrator request cancelled because the campaign changed.");
    cancelTravelLifecycle();
    setPracticeDraft(null);
    setQuickStartError(null);
    setStartDraft(createDefaultArchetypeDraft());
    setCampaignBusy(true);
    setHydrated(false);
    setCampaignError(null);
    const warmSnapshot = cachedSnapshot?.campaignId === id
      && cachedSnapshot?.userId === user?.id
      ? cachedSnapshot
      : null;
    let warmState = null;
    try {
      warmState = prepareWarmCampaignState(warmSnapshot, prepareCampaignState);
      if (warmState) {
        // Paint the real last scene during the network check, but leave hydrated
        // false so controls/autosave remain gated behind the resume overlay.
        setState(warmState);
        closeBeatMenu();
        setCurrentCampaignId(id);
        rememberLastCampaignId(id);
      }
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
    cancelNarratorRequest("Narrator request cancelled because a new campaign is opening.");
    cancelTravelLifecycle();
    setCampaignBusy(true);
    setHydrated(false);
    setCampaignError(null);
    try {
      const fresh = makeNewCampaignState();
      const name = fresh.character?.name || "Untitled";
      const { id, updatedAt } = await saveCampaign(null, fresh, { name });
      if (isCancelled()) return;
      lastSyncedStateRef.current = fresh;
      lastServerUpdatedAtRef.current = updatedAt;
      setState(fresh);
      setPracticeDraft(null);
      setQuickStartError(null);
      setStartDraft(createDefaultArchetypeDraft());
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
    if (currentCampaignId === id) {
      cancelNarratorRequest("Narrator request cancelled because the campaign was deleted.");
      cancelTravelLifecycle();
    }
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
    cancelNarratorRequest("Narrator request cancelled while leaving the campaign.");
    cancelTravelLifecycle();
    try {
      await flushActiveCampaign();
    } catch (e) {
      setCampaignError(`Save failed: ${e.message || e}`);
    }
    setDeckOpen(false);
    setPracticeDraft(null);
    setQuickStartError(null);
    setStartDraft(createDefaultArchetypeDraft());
    setCurrentCampaignId(null);
    setHydrated(false);
    lastSyncedStateRef.current = null;
    lastServerUpdatedAtRef.current = null;
    clearCampaignResume();
    // Refresh list to pick up the latest last_played_at from this session.
    listCampaigns().then(setCampaigns).catch(() => {});
  }

  async function handleSignOut() {
    cancelNarratorRequest("Narrator request cancelled during sign-out.");
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
    // debounced autosave can't write user-A's state into user-B's campaign). The fight
    // goes with it, because the fight is part of that state now rather than beside it.
    setState(makeInitialState());
    setTowCombatFeedback(null);
    setPendingAftermath(null);
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

  // Narrator wrapper used by every turn site. Capture one authoritative
  // projection and engine-owned capability policy before any network work. Raw
  // answer JSON stays private until the complete turn passes compilation.
  function narrate(
    st,
    msg,
    isCurrent = () => true,
    signal = null,
    policyOptions = {},
    canonicalUserMsg = msg,
  ) {
    scrollStoryToLatest();
    setLiveNarrator(emptyLiveNarrator());
    const projection = buildNarratorProjection(st);
    const turnPolicy = narratorTurnPolicy(msg, st, policyOptions);
    return callNarrator(st, msg, undefined, {
      signal,
      projection,
      turnPolicy,
      canonicalUserMsg,
    });
  }

  async function narrateSpecialized(st, msg, issuedPolicyOptions = null) {
    const request = beginNarratorRequest(st);
    const policyOptions = issuedPolicyOptions || specializedNarratorPolicyOptions(msg);
    try {
      const beat = await narrate(
        st,
        msg,
        () => activeNarratorRequestRef.current === request,
        request.controller.signal,
        policyOptions,
      );
      let current = liveStateRef.current;
      if (!narratorRequestIsCurrent(request, beat, current)) return { beat: null, policyOptions };
      const confirmation = narratorTerminalEffectConfirmation(policyOptions, beat);
      const acceptTerminalEffect = confirmation ? await askConfirm(confirmation) : false;
      if (confirmation) {
        current = liveStateRef.current;
        if (!narratorRequestIsCurrent(request, beat, current)) return { beat: null, policyOptions };
      }
      const next = applyNarratorTurnResult(st, msg, beat, current, {
        policyOptions,
        acceptTerminalEffect,
      });
      liveStateRef.current = next;
      setState(next);
      return { beat, policyOptions, state: next };
    } catch (error) {
      if (!narratorRequestIsCurrent(
        request,
        { _stateRevision: request.stateRevision },
        liveStateRef.current,
      )) return { beat: null, policyOptions };
      throw error;
    } finally {
      if (activeNarratorRequestRef.current === request) activeNarratorRequestRef.current = null;
    }
  }

  // Run a player-message turn against the narrator. On failure (dropped network,
  // backgrounded app…) the message is preserved and stashed for a one-tap Retry —
  // the typed action is never lost.
  async function runNarratorTurn(base, message) {
    const request = beginNarratorRequest(base);
    const policyOptions = base.narratorTurnContinuation || {};
    setError(null);
    setLoading(true);
    try {
      const beat = await narrate(
        base,
        message,
        () => activeNarratorRequestRef.current === request,
        request.controller.signal,
        policyOptions,
      );
      let current = liveStateRef.current;
      if (!narratorRequestIsCurrent(request, beat, current)) return;
      const confirmation = narratorTerminalEffectConfirmation(policyOptions, beat);
      const acceptTerminalEffect = confirmation ? await askConfirm(confirmation) : false;
      if (confirmation) {
        current = liveStateRef.current;
        if (!narratorRequestIsCurrent(request, beat, current)) return;
      }
      const next = applyNarratorTurnResult(base, message, beat, current, {
        policyOptions,
        acceptTerminalEffect,
      });
      liveStateRef.current = next;
      setState(next);
      setRetry(null);
      // An explicit strike in the fiction hands off to the turn-based engine.
      const combatHandoff = narratorCombatHandoff(beat);
      if (combatHandoff?.mode === "immediate") {
        setPendingEngage(null);
        startCombatFromDirective(combatHandoff.directive, next);
      } else if (combatHandoff) {
        setPendingEngage({ dir: combatHandoff.directive });
      }
    } catch (e) {
      // Navigation, sign-out, reset, or any local state edit invalidates this
      // request. Its abort/error belongs to the abandoned branch, not the UI now.
      if (!narratorRequestIsCurrent(
        request,
        { _stateRevision: request.stateRevision },
        liveStateRef.current,
      )) return;
      setError(e.message || String(e));
      setRetry({ base, message });
    } finally {
      if (activeNarratorRequestRef.current === request) {
        activeNarratorRequestRef.current = null;
        setLoading(false);
      }
    }
  }

  // Commit one deterministic identity + TOW bootstrap transaction. The arrival is local
  // and immediate: a narrator outage can never return a finished character to limbo or
  // leave a background-only frame at the start of a campaign.
  function applyCharacterSetup(setup, bootstrapReceipt = null) {
    const base = liveStateRef.current;
    const appliedBootstrap = bootstrapReceipt
      ? applyCharacterBootstrap(base.mechanics, bootstrapReceipt)
      : { ok: true, mechanics: base.mechanics };
    if (!appliedBootstrap.ok) {
      setQuickStartError(`That beginning could not be committed: ${appliedBootstrap.reason}.`);
      return false;
    }
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
        combatArchetypeId: setup.combatArchetypeId || null,
        progressionModel: setup.progressionModel || null,
        towBaseStats: setup.towBaseStats || null,
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
    const archetype = getStartingArchetype(setup.combatArchetypeId);
    const arrival = {
      id: `character-arrival:${bootstrapReceipt?.id || Date.now()}`,
      type: "narration",
      content: `${setup.name} enters Whitemarch through the press of the Grand Market, where Grain Square rings with cart wheels, hawkers, temple bells, and a hundred roads arguing over where they begin. ${archetype ? `The ${archetype.name} kit sits as it should: ${archetype.tagline}` : "Their chosen kit is settled and ready."}\n\nNo grey threshold waits behind them. The city is already moving, and the next choice is theirs.`,
    };
    let built = applyEngineBeat(base, beat);
    built = {
      ...built,
      mechanics: appliedBootstrap.mechanics,
      beats: [arrival],
    };
    liveStateRef.current = built;
    setQuickStartError(null);
    setPracticeDraft(null);
    setState(built);
    return true;
  }

  // Threshold decisions are resolved locally against the versioned ledger.
  // The narrator can describe the consequence later, but it can never choose a
  // school, specialization, signature spell, or metamagic for the player.
  function handleProgressionChoice(professionId, choiceId, optionId) {
    setState((current) => {
      if (current.character?.progressionModel === "tow-archetype") return current;
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
    travelMarchSequenceRef.current += 1;
    const id = `map-march-${travelMarchSequenceRef.current}`;
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
    setTravelHalt(null);
    setLoading(true);
    closeBeatMenu();
    const fromTile = getTile(state, cur.x, cur.y);
    const destTileFull = getTile(state, dest.x, dest.y);
    const fromName = publicTravelLocationName(fromTile, cur);
    const destIsHidden = destTileFull.poi?.type === "hidden";
    const toName = publicTravelLocationName(destTileFull, dest);

    // The route is split into the legs a traveller would actually walk. A leg runs
    // until something really interrupts it — arrival, or the party running out of
    // rations, water or rest — and camps through however many nights that takes;
    // fords, borders and nightfall are walked past rather than stopped at. The
    // party marches hex by hex along the leg, and an encounter that will not let
    // them by cuts the leg at its tile.
    const leg = planLeg(state, fullPath, 0, { maxSteps: WORLD_MARCH_LIMIT });
    let legPath = leg.path;
    const road = rollPathEncounter(state, legPath);
    const pathEnc = road.halt;
    legPath = pathThroughEncounter(legPath, pathEnc);
    // Rolled on the ground actually walked, so an encounter that cut the leg
    // short also cuts off the road ahead of it that the party never reached.
    const roadEvent = rollRoadEvent(state, legPath);
    if (roadEvent?.event.stops) legPath = pathThroughEncounter(legPath, roadEvent);
    // What the leg passed is only true of ground actually walked.
    const passage = legPath.length < leg.path.length ? "" : describePassage(leg);
    const legEnd = legPath[legPath.length - 1];
    const arrived = legEnd.x === dest.x && legEnd.y === dest.y;
    const legTile = getTile(state, legEnd.x, legEnd.y);
    const legName = arrived ? toName : publicTravelLocationName(legTile, legEnd);
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
      const handlesAll = terr === "any" || (Array.isArray(terr) && [...legTerrains].every((terrain) => (
        terr.includes(terrain)
        || (terrain === "reedfield" && (terr.includes("plains") || terr.includes("marsh")))
      )));
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
    // Nights are counted off the authoritative leg time, not the planner's
    // estimate, so a hastened or mounted march camps fewer times for the same
    // ground. The clock the party lives through is the marching plus the camps.
    const camps = legCamps(legMins);
    const campNote = camps.nights
      ? ` The party camps ${camps.nights === 1 ? "one night" : `${camps.nights} nights`} on the way.`
      : "";

    // Terrain mix of this leg, for the narrator.
    const terrainCounts = {};
    for (let i = 1; i < legPath.length; i++) {
      const t = getTile(state, legPath[i].x, legPath[i].y).terrain;
      terrainCounts[t] = (terrainCounts[t] || 0) + 1;
    }
    const terrainSummary = Object.entries(terrainCounts).map(([t, n]) => `${TERRAINS[t]?.label || t} ×${n}`).join(", ");
    const routeNote = hexes > 1 ? ` Route crosses: ${terrainSummary}.` : "";
    // Ambient landscape the party went by, so a quiet leg still has something to
    // narrate without inventing a site.
    const passageNote = passage ? ` The way passes ${passage}.` : "";

    const playerBeat = { id: `p${Date.now()}`, type: "player", content: `Travel from ${fromName} ${arrived ? "to" : "toward"} ${toName}${mountNote}.` };
    const stateWithPlayer = { ...state, beats: [...state.beats, playerBeat] };

    const discovery = authoritativeTravelDiscovery(legTile);
    const destDescription = isHidden
      ? discovery
        ? `HIDDEN AUTHORED SITE — the engine reveals ${JSON.stringify(discovery.name)} (${discovery.poi_type}): ${discovery.description}. Phrase the discovery, but do not rename or replace its canonical identity or emit mechanics for it.`
        : "HIDDEN — the destination remains unidentified; narrate only the visible terrain without inventing or naming a site."
      : destTileFull.poi ? `known ${destTileFull.poi.type} (${poiPlaceName(destTileFull.poi) || destTileFull.poi.name})` : "open wilderness";

    let travelMsg;
    if (arrived) {
      // Keeps the richer road context from the exploration work (passage, camps, and
      // the engine's own reason for stopping) while adopting the narrator rework's
      // contract: the engine has already settled travel time, so the model reports none.
      travelMsg = `[PLAYER ACTION] Travel from ${fromName} (${TERRAINS[fromTile.terrain]?.label}) to ${legName} (${TERRAINS[legTile.terrain]?.label}). ${hexes} hex(es), ${legMins} min on the road.${routeNote}${passageNote}${campNote} Destination: ${destDescription}. Narrate the journey and ARRIVAL in one beat. Time is already settled; emit minutes_passed = 0.`;
    } else {
      const why = pathEnc ? "where what follows stops you"
        : roadEvent?.event.stops ? "where the road itself is closed to you by what follows"
          : describeLegStop(leg);
      travelMsg = `[PLAYER ACTION] Travel from ${fromName} (${TERRAINS[fromTile.terrain]?.label}) toward ${toName}, getting as far as ${legName} (${TERRAINS[legTile.terrain]?.label}) — ${hexes} hex(es), ${legMins} min on the road,${routeNote}${passageNote}${campNote} ${why}. Narrate the journey ONLY up to ${legName} and STOP there — do NOT arrive at ${toName} (it is still ${fullPath.length - legPath.length} hex(es) on). Time is already settled; emit minutes_passed = 0.`;
    }

    let encounterLine = "";
    if (pathEnc) {
      encounterLine = `\n\n[ENCOUNTER] kind: ${pathEnc.encounter.kind}; posture: ${pathEnc.encounter.posture}; flavor: "${pathEnc.encounter.desc}". This is what halts the party at ${legName} — weave it in as they reach there.`;
    }
    // Everything the leg met and got past. Without this the narrator has no way
    // to know a near miss happened; with it phrased as a halt, it would invent a
    // stop the engine never made.
    if (road.met.length) {
      const met = road.met
        .map((hit) => `${hit.encounter.kind} (${hit.encounter.posture}, ${hit.outcome}): "${hit.encounter.desc}"`)
        .join("; ");
      encounterLine += `\n\n[PASSED] The march went on through these — ${met}. None of them stopped the party: narrate them in passing, as moments along the way, and do NOT end the journey at any of them.`;
    }
    // Who else was on this road and what they want. The offer is the point: it
    // gives the player something to answer rather than something to read.
    if (roadEvent) {
      const { label, detail, offer, stops } = roadEvent.event;
      encounterLine += `\n\n[ROAD] ${label} — ${detail} On offer: ${offer} (${ROAD_OFFERS[offer]}). ${stops
        ? `The road does not open again until the party deals with this, so it is what ends the march at ${legName}.`
        : "This does not stop the march. Narrate it as met along the way and leave the party room to answer it or ride on."}`;
    }
    const fullMsg = travelMsg + (mountNote ? ` The party rides${mountNote}.` : "") + encounterLine;

    // Recorded with the turn so a rewrite/rewind reproduces this exact leg: the
    // route (sight), where the party actually LANDS (leg end, not the far dest),
    // and the rolled encounter. intendedDest remembers where they were bound.
    const travel = {
      fromName, toName: legName,
      dest: { x: legEnd.x, y: legEnd.y },
      path: legPath.map((p) => ({ x: p.x, y: p.y })),
      totalMins: camps.elapsedMinutes,
      encounter: pathEnc ? pathEnc.encounter : null,
      met: road.met.map((hit) => ({ encounter: hit.encounter, outcome: hit.outcome })),
      roadEvent: roadEvent ? roadEvent.event : null,
      discovery,
      intendedDest: arrived ? null : { x: dest.x, y: dest.y },
    };

    // Keep the authoritative travel map mounted while narration starts. The
    // party pin owns only this visual route; the simulation continues to own
    // the authoritative arrival tile and save data.
    const halt = travelHaltSummary({
      leg,
      legPath,
      fullPathLength: fullPath.length,
      arrived,
      where: legName,
      destination: toName,
      hexes,
      minutes: legMins,
      nights: camps.nights,
      encounter: pathEnc?.encounter || null,
      met: road.met,
      roadEvent: roadEvent?.event || null,
      intendedDest: arrived ? null : { x: dest.x, y: dest.y },
    });

    const lifecycle = captureTravelLifecycle();
    const marchId = beginTravelMarch(travel);

    await finishTravel(stateWithPlayer, fullMsg, travel, { marchId, lifecycle, halt });
  }

  // Shared tail for every travel mode. Visual completion performs the one
  // authoritative travel transaction; narration that finishes later can only
  // append story/history and must never replay time, costs, survival, or movement.
  async function finishTravel(stateWithPlayer, fullMsg, travel, {
    marchId = null,
    lifecycle = captureTravelLifecycle(),
    halt = null,
  } = {}) {
    const visualGate = marchId ? waitForTravelMarch(marchId) : Promise.resolve("not-needed");
    const policyOptions = { route: "travel-presentation" };
    const narration = Promise.resolve().then(() => narrate(
      stateWithPlayer,
      fullMsg,
      () => isTravelLifecycleCurrent(lifecycle),
      lifecycle.controller?.signal,
      policyOptions,
    ));
    const hostileEncounter = travel.encounter?.posture === "hostile"
      ? travel.encounter
      : null;
    let checkpointBase = null;
    let recordedTravel = travel;
    let turnIndex = -1;

    try {
      await settleTravelLifecycle({
        visual: visualGate,
        narration,
        onArrival: () => {
          if (!isTravelLifecycleCurrent(lifecycle)) return;
          const settlement = prepareTravelSettlement(
            liveStateRef.current,
            lifecycle.baseState,
            stateWithPlayer,
            travel,
          );
          checkpointBase = settlement.checkpointBase;
          recordedTravel = { ...travel, preparedDelta: settlement.preparedDelta };
          const haltBeat = travelHaltBeat(
            travel,
            `travel-halt-${marchId || travelMarchSequenceRef.current}`,
          );
          const arrived = haltBeat && !(settlement.state.beats || []).some((beat) => beat.id === haltBeat.id)
            ? { ...settlement.state, beats: [...(settlement.state.beats || []), haltBeat] }
            : settlement.state;
          const checkpointed = startTurnCheckpoint(checkpointBase, fullMsg, arrived, {
            travel: recordedTravel,
            policyOptions,
          });
          turnIndex = checkpointed.turns.length - 1;
          liveStateRef.current = checkpointed;
          setState(checkpointed);
          setTravelMarch((current) => (current?.id === marchId ? null : current));
          if (hostileEncounter) {
            // The fight prompt lives in the chat column, so this one halt still
            // has to pull the player out of the map — hiding a required
            // decision behind an open map would be worse than the interruption.
            setMapOpen(false);
            setTravelHalt(null);
            setPendingEngage(null);
            setPendingCombat(hostileEncounter);
          } else {
            setTravelHalt(halt);
          }
        },
        onNarration: (travelBeat) => {
          if (!isTravelLifecycleCurrent(lifecycle) || turnIndex < 0) return;
          const presented = applyCompiledNarratorPresentation(
            liveStateRef.current,
            travelBeat,
            applyTravelNarrationPresentation,
            stateWithPlayer,
          );
          const completed = finalizeTurnCheckpoint(presented, turnIndex);
          liveStateRef.current = completed;
          setState(completed);

        },
        onNarrationError: (error) => {
          if (!isTravelLifecycleCurrent(lifecycle)) return;
          setError(error.message || String(error));
        },
      });
    } finally {
      if (travelLifecycleRef.current.controller === lifecycle.controller) {
        travelLifecycleRef.current.controller = null;
      }
      if (!isTravelLifecycleCurrent(lifecycle)) return;
      setTravelMarch((current) => (current?.id === marchId ? null : current));
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
    const fromName = publicTravelLocationName(getTile(state, cur.x, cur.y), cur);
    const destTile = getTile(state, dest.x, dest.y);
    const toName = publicTravelLocationName(destTile, dest);
    const legName = arrived ? toName : publicTravelLocationName(legTile, legEnd);
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
      const overflownName = t.poi?.type === "hidden" ? null : poiPlaceName(t.poi);
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
    const travel = { fromName, toName: legName, dest: { x: legEnd.x, y: legEnd.y }, path: legPath.map((p) => ({ x: p.x, y: p.y })), totalMins: mins, encounter: aerial ? aerial.encounter : null, mode: "fly", mountId: viaMount ? flightMount.id : null, discovery: authoritativeTravelDiscovery(legTile), intendedDest: arrived ? null : { x: dest.x, y: dest.y } };
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
    const cur = state.world.currentTile;
    const fromName = publicTravelLocationName(getTile(state, cur.x, cur.y), cur);
    const destTile = getTile(state, dest.x, dest.y);
    const toName = publicTravelLocationName(destTile, dest);
    const blind = !isSeen(state, dest.x, dest.y); // gating to a rumored place you've never seen
    setMapOpen(false); setReceipts({ tileKey: null, items: {} }); setError(null); setLoading(true); closeBeatMenu();
    const ch = { ...state.character, resolve: Math.max(0, (state.character.resolve ?? 0) - spell.resolveCost) };
    const playerBeat = { id: `p${Date.now()}`, type: "player", content: `${spell.name} to ${toName}.` };
    const stateWithPlayer = { ...state, character: ch, beats: [...state.beats, playerBeat] };
    const msg = `[PLAYER ACTION] You work ${spell.name} and step through space, arriving at ${toName}${blind ? " — a place known only by repute, so you arrive without knowing what surrounds you" : ""}. No journey, no road between. It cost ${spell.resolveCost} resolve. Narrate the rush of arrival and what greets you. Use minutes_passed = 5.`;
    const travel = { fromName, toName, dest: { x: dest.x, y: dest.y }, path: [{ x: dest.x, y: dest.y }], totalMins: 5, encounter: null, mode: "teleport", discovery: authoritativeTravelDiscovery(destTile) };
    await finishTravel(stateWithPlayer, msg, travel);
  }

  async function handleResetCampaign() {
    if (!(await askConfirm({ title: "Reset campaign", body: "Reset this campaign to the beginning? Your current progress here will be erased.", confirmLabel: "Reset", danger: true }))) return;
    cancelNarratorRequest("Narrator request cancelled because the campaign was reset.");
    cancelTravelLifecycle();
    setState((current) => resetCampaignState(current));
    setPracticeDraft(null);
    setQuickStartError(null);
    setStartDraft(createDefaultArchetypeDraft());
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
      const { beat, policyOptions } = await narrateSpecialized(stateWithPlayer, msg);
      if (!beat) return;
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
      const { beat, policyOptions } = await narrateSpecialized(stateWithPlayer, msg);
      if (!beat) return;
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
    // Only a rest the engine actually committed restores Resolve. Opening the rest screen
    // does not, and neither does a night the narrator merely described.
    setState(withTowMechanics(
      { ...r.state, beats: [...r.state.beats, { id: `rest${Date.now()}`, type: "narration", content: r.summary }] },
      { readiness: {}, companionReadiness: {} },
    ));
  }

  // Making camp where a march ran out. The road gives nothing back on its own,
  // so this is the only thing that puts a spent party back on its feet — and it
  // costs the night it takes, on the same clock everything else runs on. The map
  // stays open: bedding down is part of the journey, not a trip back to camp.
  function handleHaltMakeCamp(hours = 8) {
    const r = applyRest(state, hours);
    if (!r.ok) {
      // A party with no bedroll cannot make camp, and the halt card is the only
      // thing on screen — the narration beat behind the map would never be read,
      // so the refusal goes back to where the button was pressed.
      if (r.reason) setTravelHalt((current) => (current ? { ...current, campBlocked: r.reason } : current));
      return;
    }
    setState(withTowMechanics(
      { ...r.state, beats: [...r.state.beats, { id: `camp${Date.now()}`, type: "narration", content: r.summary }] },
      { readiness: {}, companionReadiness: {} },
    ));
    // The halt still names where the party stands and what lies ahead; what it
    // must stop saying is that they are spent, because they no longer are.
    setTravelHalt((current) => (current ? { ...current, spentNeed: null, campBlocked: null, camped: true } : current));
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
      const { beat, policyOptions } = await narrateSpecialized(stateWithPlayer, msg);
      if (!beat) return;
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
      const { beat, policyOptions } = await narrateSpecialized(stateWithPlayer, msg);
      if (!beat) return;
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
      const msg = `[PLAYER ACTION] [SCRY] (id: ${id}) You work a scrying to seek ${res.name}. The vision finds them ${res.pos.exact ? "" : "roughly "}at hex (${res.pos.x},${res.pos.y}) — ${near}. Describe what shows in the glass: where ${res.name} is now, what they are about, who is near — true to what's known of them and that place. This is the ONLY way the player learns a character's whereabouts; reveal no more than the scrying shows. Use minutes_passed = 10.`;
      const { beat, policyOptions } = await narrateSpecialized(stateWithPlayer, msg);
      if (!beat) return;
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

  function handleSetCombatFormation(cells) {
    setState((current) => {
      const known = new Set([
        "wanderer",
        ...partyMembers(current)
          .filter((member) => member.kind !== "mount")
          .map((member) => member.id),
      ]);
      const supplied = Array.isArray(cells) ? cells : [];
      const seen = new Set();
      const normalized = Array.from({ length: 9 }, (_, index) => {
        const id = supplied[index];
        if (typeof id !== "string" || !known.has(id) || seen.has(id)) return null;
        seen.add(id);
        return id;
      });
      if (!seen.has("wanderer")) {
        const open = normalized.indexOf(null);
        normalized[open >= 0 ? open : 0] = "wanderer";
      }
      const next = withTowMechanics(current, {
        formation: { version: 1, cells: normalized },
      });
      liveStateRef.current = next;
      return next;
    });
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
      const { beat, policyOptions } = await narrateSpecialized(stateWithPlayer, msg);
      if (!beat) return;
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
      const { beat, policyOptions } = await narrateSpecialized(stateWithPlayer, msg);
      if (!beat) return;
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
    // A rewrite rolls the world back. It may not roll back across a settlement, a
    // bootstrap, or a death: those are locked receipts, and reconstructing the codex past
    // one would resurrect a foe the world still records as dead.
    const rewindable = canRewindToTurn(state, menu.turnK);
    if (!rewindable.ok) {
      closeBeatMenu();
      setError("That moment is behind something already settled — the story can be retold from here, but not taken back past it.");
      return;
    }
    const cp = state.turns[menu.turnK];
    const legacyTravelDiscovery = cp.travel && !cp.travel.discovery
      ? travelDiscoveryFromRevealedTile(getTile(state, cp.travel.dest.x, cp.travel.dest.y))
      : null;
    const replayTravel = cp.travel && legacyTravelDiscovery
      ? { ...cp.travel, discovery: legacyTravelDiscovery }
      : cp.travel;
    closeBeatMenu();
    setError(null);
    setLoading(true);
    setPendingEngage(null);
    setPendingCombat(null);
    setPendingLoot(null);
    // A rewrite rolls the turn back, so a combat handoff offered by the discarded beat
    // must go with it, and the live ref has to follow the rollback.
    const base = { ...stateBeforeTurn(state, menu.turnK), pendingCombatDirective: null };
    liveStateRef.current = base;
    setState(base); // roll the rejected beat (and any later ones) out of the log + memory
    const request = beginNarratorRequest(base);
    try {
      const directive = `\n\n[REWRITE — author's steer] The player is exercising author's privilege over your PREVIOUS narration of this exact moment and wants it taken in a different direction. Your previous version was:\n"""\n${cp.prevText}\n"""\nWrite a NEW version of this same moment from the same game state, fully honoring the player's steer: "${feedback}". This is how the player nudges the story toward turns it would not take on its own — a trope, a twist, a character's choice. Lean into it as far as the established world, characters, and state plausibly allow, and keep continuity with everything before this moment. Your output REPLACES the previous version; do not mention that it was rewritten.`;
      const rewritePolicyOptions = checkpointPolicyOptions(cp);
      const beat = await narrate(
        base,
        cp.message + directive,
        () => activeNarratorRequestRef.current === request,
        request.controller.signal, rewritePolicyOptions, cp.message,
      );
      const current = liveStateRef.current;
      if (!narratorRequestIsCurrent(request, beat, current)) return;
      // A travel rewrite replays the same deterministic costs and settlement from
      // the true departure checkpoint, then replaces only the narrator presentation.
      let next;
      if (replayTravel) {
        const settled = replayTravelSettlement(base, replayTravel);
        const haltBeat = travelHaltBeat(replayTravel, `travel-halt-rewrite-${Date.now()}`);
        const halted = haltBeat
          ? { ...settled, beats: [...settled.beats, haltBeat] }
          : settled;
        next = applyCompiledNarratorPresentation(halted, beat, applyTravelNarrationPresentation, base);
      } else {
        next = applyBeat(base, beat);
      }
      const recorded = recordTurn(base, cp.message, next, {
        ...(replayTravel ? { travel: replayTravel } : {}),
        policyOptions: rewritePolicyOptions,
      });
      liveStateRef.current = recorded;
      setState(recorded);
      if (replayTravel?.encounter?.posture === "hostile") setPendingCombat(replayTravel.encounter);
      if (!replayTravel?.encounter && beat.start_combat) setPendingEngage({ dir: beat.start_combat });
    } catch (e) {
      if (!narratorRequestIsCurrent(
        request,
        { _stateRevision: request.stateRevision },
        liveStateRef.current,
      )) return;
      setError(e.message || String(e));
    } finally {
      if (activeNarratorRequestRef.current === request) {
        activeNarratorRequestRef.current = null;
        setLoading(false);
      }
    }
  }

  // Rewind: a player message becomes queued input again (including when it is the
  // latest completed turn); narration/dialogue keeps its whole turn and drops only
  // later turns.
  function handleRewindBeat() {
    const menu = beatMenu;
    if (!menu || !menu.canRewind || loading) return;
    // Same boundary as a rewrite: presentation may be replayed from a locked receipt, the
    // mechanic behind it may not be undone.
    const target = menu.kind === "player" ? turnForBeatIndex(state, menu.index) : menu.turnK;
    const rewindable = canRewindToTurn(state, target);
    if (!rewindable.ok) {
      closeBeatMenu();
      setError("That moment is behind something already settled — the story can be retold from here, but not taken back past it.");
      return;
    }
    closeBeatMenu();
    setPendingEngage(null);
    setPendingCombat(null);
    setPendingLoot(null);
    const rewound = menu.kind === "player"
      ? rewindToPlayerBeat(state, menu.index)
      : stateAfterTurn(state, menu.turnK);
    setState({ ...rewound, pendingCombatDirective: null });
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

  // ----- Deterministic reference-run handlers -----

  function commitReferenceGameplay(transition) {
    const result = transitionReferenceGameplay(liveStateRef.current, transition, {
      campaignId: currentCampaignId || "local-campaign",
      previewEnabled: REFERENCE_GAMEPLAY_PREVIEW_ENABLED,
    });
    if (!result.ok) {
      setReferenceGameplayFeedback(`Trial update rejected: ${result.reason}.`);
      return result;
    }
    setReferenceGameplayFeedback(null);
    setCampaignError(null);
    liveStateRef.current = result.state;
    setState(result.state);
    return result;
  }

  function setPendingCombat(encounter) {
    setState((current) => {
      if (encounter == null && current.pendingTravelCombat == null) return current;
      let pending = null;
      if (encounter != null) {
        const created = createPendingTravelCombat({
          campaignId: currentCampaignId || "local-campaign",
          state: current,
          encounter,
        });
        if (!created.ok) {
          queueMicrotask(() => setError(`Travel combat handoff rejected: ${created.reason}.`));
          return current;
        }
        pending = created.pending;
      }
      const next = { ...current, pendingTravelCombat: pending };
      liveStateRef.current = next;
      return next;
    });
  }

  function setPendingEngage(nextPending) {
    const rawDirective = nextPending?.dir ?? null;
    let ownedDirective = null;
    if (rawDirective !== null) {
      const opened = readPendingCombatDirective(rawDirective);
      if (!opened.ok) {
        setError(`Combat handoff rejected: ${opened.reason}.`);
        return false;
      }
      ownedDirective = opened.directive;
    }
    setState((current) => {
      if (ownedDirective === null && current.pendingCombatDirective == null) return current;
      let handoff = null;
      if (ownedDirective !== null) {
        const created = createPendingCombatHandoff({
          campaignId: currentCampaignId || "local-campaign",
          state: current,
          directive: ownedDirective,
        });
        if (!created.ok) {
          queueMicrotask(() => setError(`Combat handoff rejected: ${created.reason}.`));
          return current;
        }
        handoff = created.handoff;
      }
      const next = { ...current, pendingCombatDirective: handoff };
      liveStateRef.current = next;
      return next;
    });
    return true;
  }

  function handleStartReferenceTrial() {
    if (!REFERENCE_GAMEPLAY_PREVIEW_ENABLED || loading || combat || referenceGameplayOpen || productionCombatOpen) return;
    setMapOpen(false);
    setDeckOpen(false);
    setShopTile(null);
    setPendingCombat(null);
    setPendingEngage(null);
    setPendingLoot(null);
    setError(null);
    setReferenceGameplayFeedback(null);
    const referenceBase = { ...liveStateRef.current, pendingCombatDirective: null };
    const result = startReferenceGatekeeperTrial(referenceBase, {
      campaignId: currentCampaignId || "local-campaign",
      previewEnabled: REFERENCE_GAMEPLAY_PREVIEW_ENABLED,
      replaceInvalid: referenceGameplayInvalid,
    });
    if (!result.ok) {
      setCampaignError(`Reference preview could not start: ${result.reason}.`);
      return;
    }
    setCampaignError(null);
    liveStateRef.current = result.state;
    setState(result.state);
  }

  function handleOpenReferenceTrial() {
    if (!REFERENCE_GAMEPLAY_PREVIEW_ENABLED || loading || combat || productionCombatOpen) return;
    setError(null);
    setReferenceGameplayFeedback(null);
    setState((current) => openReferenceGameplay(current, {
      campaignId: currentCampaignId || "local-campaign",
      previewEnabled: REFERENCE_GAMEPLAY_PREVIEW_ENABLED,
    }));
  }

  function handleReferenceCommand(command) {
    commitReferenceGameplay((run) => resolveRunCommand(run, command));
  }

  function handleReferenceRefresh(request) {
    commitReferenceGameplay((run) => refreshRunReward(run, request));
  }

  function handleReferenceClaim(request) {
    commitReferenceGameplay((run) => claimRunReward(run, request));
  }

  function handleCloseReferenceTrial() {
    setReferenceGameplayFeedback(null);
    setState((current) => closeReferenceGameplay(current, {
      campaignId: currentCampaignId || "local-campaign",
    }));
  }

  function handleProductionCombatCommand(command) {
    const opened = readProductionCombatSession(liveStateRef.current.activeCombatSession);
    if (!opened.ok || opened.session.campaignId !== (currentCampaignId || "local-campaign")) {
      setProductionCombatFeedback(`Combat update rejected: ${opened.reason || "production-combat-campaign-mismatch"}.`);
      return;
    }
    const result = transitionProductionCombatSession(opened.session, command);
    if (!result.ok) {
      setProductionCombatFeedback(`Combat update rejected: ${result.reason}.`);
      return;
    }
    const next = { ...liveStateRef.current, activeCombatSession: result.session };
    setProductionCombatFeedback(null);
    setCampaignError(null);
    liveStateRef.current = next;
    setState(next);
  }

  function handleProductionCombatSettlement() {
    const result = settleProductionCombat(liveStateRef.current, {
      campaignId: currentCampaignId || "local-campaign",
    });
    if (!result.ok) {
      setProductionCombatFeedback(`Combat aftermath rejected: ${result.reason}.`);
      return;
    }
    setProductionCombatFeedback(null);
    setCampaignError(null);
    liveStateRef.current = result.state;
    setState(result.state);
  }

  function handleReplaceInvalidProductionCombat() {
    if (!productionCombatInvalid) return;
    const next = {
      ...liveStateRef.current,
      activeCombatSession: null,
      beats: [
        ...(liveStateRef.current.beats || []),
        {
          id: `production-combat-recovery:${liveStateRef.current.productionCombatSequence || 0}`,
          type: "narration",
          content: "The interrupted fight could not be reconstructed. Its invalid recovery record was discarded explicitly; no outcome was applied.",
        },
      ],
    };
    setProductionCombatFeedback(null);
    liveStateRef.current = next;
    setState(next);
  }

  function handleDiscardInvalidPendingCombat() {
    if (!pendingCombatDirectiveInvalid) return;
    const next = {
      ...liveStateRef.current,
      pendingCombatDirective: null,
      beats: [
        ...(liveStateRef.current.beats || []),
        {
          id: `pending-combat-recovery:${liveStateRef.current.productionCombatSequence || 0}`,
          type: "narration",
          content: "The malformed combat handoff was discarded explicitly; no combat outcome was applied.",
        },
      ],
    };
    setProductionCombatFeedback(null);
    liveStateRef.current = next;
    setState(next);
  }

  /**
   * Try a Quick Start build before committing to it.
   *
   * Compiles the template through the one bootstrap compiler and hands the receipt to a
   * practice fight. Nothing is written: no campaign, no draft mutation, no save.
   */
  function handleQuickStartPractice(draft, scenarioId, allyGroupId) {
    const compiled = compileCharacterBootstrap({
      archetypeId: draft.archetypeId,
      origin: "archetype",
      build: practiceBuildForArchetypeDraft(draft),
    });
    if (!compiled.ok) {
      setQuickStartError(`That build could not be compiled: ${compiled.reason}.`);
      return;
    }
    setQuickStartError(null);
    setPracticeDraft({
      receipt: compiled.receipt,
      scenarioId,
      allyGroupId: allyGroupId ?? DEFAULT_PRACTICE_ALLY_GROUP_ID,
      skillRarities: practiceSkillRaritiesForArchetypeDraft(draft),
      keepsakeId: draft.keepsakeId,
    });
  }

  function handleArchetypeBegin(draft) {
    const setup = characterSetupForArchetype(draft);
    if (!setup) {
      setQuickStartError("That character could not be prepared for Whitemarch.");
      return;
    }
    const compiled = compileCharacterBootstrap({
      archetypeId: draft.archetypeId,
      origin: "archetype",
    });
    if (!compiled.ok) {
      setQuickStartError(`That archetype could not be compiled: ${compiled.reason}.`);
      return;
    }
    applyCharacterSetup(setup, compiled.receipt);
  }

  // ----- Legacy combat handlers (retained until parity gates pass) -----

  function startCombat(enemies, context, extraOpts = {}, st = state) {
    if (!enemies || enemies.length === 0) return;
    if (enemies.length > 9) {
      setError("This formation can field at most nine foes. Split this encounter into waves before it begins.");
      return;
    }
    if (st.pendingTravelCombat != null || st.pendingCombatDirective != null) {
      const cleared = {
        ...st,
        pendingTravelCombat: null,
        pendingCombatDirective: null,
      };
      liveStateRef.current = cleared;
      setState(cleared);
    }
    setDeckOpen(false); setMapOpen(false); setShopTile(null);
    closeBeatMenu();
    const region = regionHere(st);
    const wp = activeWorldPassives(st.character, st.world.codex);
    const seed = hashSeed([
      currentCampaignId || "local",
      st.time?.day || 0,
      st.time?.hour || 0,
      st.time?.minute || 0,
      st.world.currentTile?.x || 0,
      st.world.currentTile?.y || 0,
      st.turns?.length || st.beats?.length || 0,
      context?.flavor || enemies.map((enemy) => enemy.name).join("/"),
    ]);
    // The encounter still carries only actors and a build; the spoils context and the codex
    // identities of the foes are the session's, so the kernel never learns about regions,
    // loot tiers or NPC ids — and, unlike the ref they used to live in, they survive a
    // reload, which is the difference between settling this fight correctly and not at all.
    const actorIds = enemies.map((_, index) => `foe-${index}`);
    const lethal = extraOpts.lethal !== false;
    // Nothing walks into a fight unaccounted for. Conditions become opening statuses, so a
    // bleeding character bleeds; anything the encounter deliberately does not carry is
    // recorded by name; and anything it genuinely cannot run stops the fight with a reason
    // instead of quietly making the player stronger than the world described.
    // Mounts carry you, they do not fight for you — the plan keeps them as support
    // modifiers rather than actors — so only the people come to the battle line.
    const companions = partyMembers(st).map((member) => ({
      ...member,
      combatCapable: member.kind !== "mount",
    }));
    const admission = admitTowEncounter({
      character: st.character,
      party: companions,
      enemies,
    });
    if (!admission.supported) {
      const reasons = admission.blockers.map((entry) => entry.code).join(", ");
      setError(`This fight cannot be run yet: ${reasons}.`);
      return;
    }
    const player = towPlayerFromCharacter(st.character, st.world.codex, { id: "wanderer" });
    // The fight opens with the character's current Resolve baked into genesis, so replay
    // reproduces exactly how spent every combatant was when the exchange began.
    // New starts own a durable, level-free build. Older campaigns keep their broad-
    // profession fallback until they are explicitly migrated. Worn equipment is folded in
    // only here, so unequipping a relic removes its TOW trait or fusion immediately.
    const durableBuild = isTowBuild(st.mechanics?.build)
      ? st.mechanics.build
      : towBuildForCharacter(st.character);
    const campaignBuild = effectiveTowBuild(
      durableBuild,
      activeTowItemIds(st.character, st.world.codex),
      st.world.codex,
    );
    const campaignFormation = st.mechanics?.tow?.formation?.cells || [];
    const admittedById = new Map(admission.allies.map((entry) => [entry.companionId, entry]));
    const requestedCompanions = campaignFormation
      .filter((id) => id && id !== "wanderer" && admittedById.has(id));
    const fieldedCompanionIds = [...new Set(requestedCompanions)].slice(0, 8);
    const fieldedIdSet = new Set(fieldedCompanionIds);
    const fieldedAllies = admission.allies.filter(({ companionId }) => fieldedIdSet.has(companionId));
    const heldBackAllies = admission.allies.filter(({ companionId }) => !fieldedIdSet.has(companionId));
    // Each admitted companion crosses the same bridge the player does and brings their own
    // package, so an ally fights like themselves rather than like a copy of the protagonist.
    let allies;
    try {
      allies = fieldedAllies.map(({ companionId, entity, openingStatuses }) => {
        const actor = towPlayerFromCharacter(entity, st.world.codex, { id: `ally-${companionId}` });
        const build = effectiveTowBuild(
          towBuildForCharacter(entity),
          activeTowItemIds(entity, st.world.codex),
          st.world.codex,
        );
        return {
          ...actor,
          statuses: [...actor.statuses, ...openingStatuses],
          // Resolve comes from the companion actor snapshot, so nobody can launder scarcity
          // merely by joining another encounter.
          build,
        };
      });
    } catch (error) {
      setError(`A companion could not take the field: ${error?.message || error}.`);
      return;
    }
    const opened = createTowSession({
      sessionId: `${currentCampaignId || "local"}:combat:${seed}`,
      rootSeed: seed,
      mode: "campaign",
      player: { ...player, statuses: [...player.statuses, ...admission.openingStatuses] },
      allies,
      enemies: enemies.map((enemy, index) => towEnemyFromBestiary(enemy, { id: actorIds[index] })),
      formations: {
        // New fights opt into deterministic round-boundary formation movement. The session
        // keeps v1 snapshots static so an older recorded fight still replays byte for byte.
        version: MOVING_FORMATION_RULES_VERSION,
        player: Array.from({ length: 9 }, (_, index) => {
          const campaignEntityId = campaignFormation[index] || null;
          if (campaignEntityId === "wanderer") return "wanderer";
          return fieldedIdSet.has(campaignEntityId) ? `ally-${campaignEntityId}` : null;
        }),
      },
      build: {
        ...campaignBuild,
        combatItems: combatItemsFromInventory(st.character.inventory),
      },
      context: {
        directiveId: context?.directiveId ?? null,
        source: { kind: context?.sourceKind || "narrator", note: context?.flavor || enemies[0].name },
        location: currentLocationName(st),
        campaignRevision: st.turns?.length || st.beats?.length || 0,
        participantBindings: Object.fromEntries([
          ...enemies.map((enemy, index) => [
            actorIds[index],
            { campaignEntityId: enemy.npcId ?? null, lethal: null },
          ]),
          // Allies are bound to their codex entry the same way foes are, so a companion who
          // falls is recorded against the person they actually are.
          ...fieldedAllies.map(({ companionId }) => [
            `ally-${companionId}`,
            { campaignEntityId: companionId, lethal: null },
          ]),
        ]),
        hostilityFacts: {
          initiator: extraOpts.ambush === "enemy" ? "enemy" : "player",
          surprise: Boolean(extraOpts.ambush),
        },
        detectionFacts: { hidden: isHidden(st) },
        lethalPolicy: lethal ? "lethal" : "nonlethal",
        // Whether this fight can kill the player is decided here, before the first blow,
        // and written into the admission. It used to be worked out at settlement from the
        // foes' tiers — which meant the answer to "can I die here" was only available after
        // dying, and could in principle have come out differently than when the player
        // agreed to the fight.
        playerStakes: lethal && isEpicEncounter(null, { sources: enemies }) ? "lethal" : "survivable",
        retreatPolicy: "allowed",
        lootPolicy: {
          maxLootTier: region.lootTier,
          region: region.level,
          coinBonus: wp.coinBonus || 0,
          ownedUniqueIds: ownedUniqueIds(st),
          sources: Object.fromEntries(enemies.map((enemy, index) => [actorIds[index], {
            kind: enemy.kind ?? null,
            maxLootTier: enemy.maxLootTier ?? null,
            tier: enemy.tier ?? null,
          }])),
        },
        rewardPolicy: { proficiencyId: null },
        admission: { version: admission.version, notes: admission.notes },
      },
    });
    if (!opened.ok) {
      setError(`The fight could not start: ${opened.reason}.`);
      return;
    }
    const formationNotice = heldBackAllies.length > 0
      ? `${heldBackAllies.map(({ entity }) => entity.name).join(", ")} remain in reserve; the formation holds nine combatants.`
      : null;
    const notice = [admissionPlayerNotice(admission), formationNotice].filter(Boolean).join(" ");
    const committed = commitTowSession(opened.session);
    // A companion who stays out of a fight is a fact the player should be told, not one
    // they have to notice by counting who is swinging.
    if (notice) {
      const withNotice = {
        ...committed,
        beats: [
          ...(committed.beats || []),
          { id: `tow-combat:${opened.session.sessionId}:companions`, type: "narration", content: notice },
        ],
      };
      liveStateRef.current = withNotice;
      setState(withNotice);
    }
  }

  // A malformed sidecar is worse than a missing one: the campaign migration replaces it,
  // and replacing it would take the fight with it. So the slot is always written onto a
  // well-formed sidecar, whether or not this campaign has been migrated yet.
  function withTowMechanics(base, patch) {
    const sidecar = hasMechanicsSidecar(base) ? base.mechanics : emptyMechanicsSidecar();
    return {
      ...base,
      mechanics: { ...sidecar, tow: { ...(sidecar.tow || {}), ...patch } },
    };
  }

  function withTowCombat(base, session) {
    return withTowMechanics(base, { activeCombat: session });
  }

  // Discarding an unreadable fight is the player's explicit act, never the engine's quiet
  // one, and it says so in the story: an outcome nobody can reconstruct must not be applied,
  // but the campaign should not pretend the encounter never happened either.
  function handleDiscardInvalidTowCombat() {
    if (!towCombatInvalid) return;
    const base = liveStateRef.current;
    const next = withTowCombat({
      ...base,
      beats: [
        ...(base.beats || []),
        {
          id: `tow-combat-recovery:${base.beats?.length || 0}`,
          type: "narration",
          content: "The record of that fight could not be read back. It was discarded explicitly; no outcome, wound, or spoil was applied.",
        },
      ],
    }, null);
    setTowCombatFeedback(null);
    liveStateRef.current = next;
    setState(next);
  }

  /** Write a session into durable campaign state. The only path a fight is saved through. */
  function commitTowSession(session) {
    const next = withTowCombat(liveStateRef.current, session);
    setTowCombatFeedback(null);
    liveStateRef.current = next;
    setState(next);
    return next;
  }

  function tryStartProductionCombat({ enemies, directive, sourceKind, st }) {
    // The Tower of Winter rebuild ships dark until a whole fight works on it. Until then
    // the deterministic loop is a two-action placeholder, so letting it claim a live
    // encounter would put a worse fight in front of the player than the one it replaces.
    // Pending handoffs are still persisted either way — that part is a straight fix for
    // an offered fight being lost on reload, and it is safe with the loop switched off.
    if (!REFERENCE_GAMEPLAY_PREVIEW_ENABLED) return { status: "fallback", reason: "preview-disabled" };
    const adapted = adaptNarratorCombatStart({
      campaignId: currentCampaignId || "local-campaign",
      state: st,
      directive,
      enemies,
      sourceKind,
    });
    if (!adapted.ok) return { status: "fallback", reason: adapted.reason };
    const started = startProductionCombatSession(adapted.input);
    if (!started.ok) {
      setError(`Deterministic combat could not start: ${started.reason}.`);
      return { status: "rejected", reason: started.reason };
    }
    const next = {
      ...st,
      activeCombatSession: started.session,
      pendingCombatDirective: null,
      pendingTravelCombat: null,
      productionCombatSequence: adapted.nextSequence,
    };
    setDeckOpen(false);
    setMapOpen(false);
    setShopTile(null);
    closeBeatMenu();
    setProductionCombatFeedback(null);
    setError(null);
    liveStateRef.current = next;
    setState(next);
    return { status: "started", reason: null };
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
    const production = tryStartProductionCombat({
      enemies,
      directive: dir,
      sourceKind: "narrator",
      st,
    });
    if (production.status !== "fallback") return;
    const ambush = dir.surprise ? (dir.initiator === "enemy" ? "enemy" : "player") : null;
    // Brawls (a barfight, "teach him a lesson") are bare-knuckle unless the
    // narrator flags it lethal; weapons can still be drawn mid-fight.
    startCombat(
      enemies,
      { flavor: dir.note || groupFlavor(enemies), sourceKind: "narrator" },
      { ambush, lethal: dir.lethal !== false },
      st,
    );
  }

  // Looking for a fight is resolved by the engine first. The narrator renders the
  // selected local foe (or the objective absence of one) but cannot swap targets
  // or mint a start_combat directive after seeing provider-facing prose.
  async function handleSeekCombat() {
    if (loading || combat) return;
    setMapOpen(false);
    setError(null);
    setLoading(true);
    const playerBeat = { id: `p${Date.now()}`, type: "player", content: "You look for a fight." };
    const stateWithPlayer = { ...state, beats: [...state.beats, playerBeat] };
    setState(stateWithPlayer);
    try {
      const soughtKind = pickHostileKind(stateWithPlayer);
      const verdict = soughtKind
        ? `The engine selected a local ${soughtKind} encounter. Render signs of that exact threat and leave the decision to engage open.`
        : "The engine found no eligible local foe because this place is empty or cleared. Render that absence and leave the moment open.";
      const msg = `[PLAYER ACTION] You go looking for a fight here — sizing up who might be willing to cross blades.\n\n[SEEK COMBAT — ENGINE VERDICT] ${verdict} Do not emit start_combat; combat handoff is already engine-owned.`;
      const { beat, policyOptions } = await narrateSpecialized(stateWithPlayer, msg);
      if (!beat) return;
      if (soughtKind) {
        setPendingEngage({
          dir: {
            initiator: "player",
            surprise: false,
            lethal: true,
            foes: [{ kind: soughtKind, count: 1 }],
            note: `You find signs of ${soughtKind} nearby.`,
          },
        });
      }
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleFightPending() {
    if (!pendingCombat) return;
    if (loading) cancelTravelLifecycle({ preserveEncounter: true });
    const current = liveStateRef.current;
    const region = regionHere(current);
    const enemies = generateEnemyGroup(pendingCombat.kind, { power: region.power, maxTier: region.enemyTier });
    // A carried flame in the dark gives you away — the foe gets the jump on you.
    const ambush = isBeacon(current) ? "enemy" : undefined;
    const note = pendingCombat.desc || groupFlavor(enemies);
    const production = tryStartProductionCombat({
      enemies,
      directive: {
        initiator: ambush ? "enemy" : "player",
        surprise: Boolean(ambush),
        lethal: true,
        foes: [{
          npc_id: null,
          kind: pendingCombat.kind,
          name: enemies.length === 1 ? enemies[0].name : null,
          tier: null,
          count: enemies.length,
        }],
        note,
      },
      sourceKind: "travel",
      st: current,
    });
    if (production.status !== "fallback") return;
    startCombat(enemies, { flavor: note, sourceKind: "travel" }, ambush ? { ambush } : {}, current);
  }

  // Slip past a hostile travel encounter unseen — only reliable when you're
  // hidden in the dark (no flame). Logs the moment; never starts the fight.
  function handleSlipAway() {
    if (!pendingCombat) return;
    if (loading) cancelTravelLifecycle({ preserveEncounter: true });
    setPendingCombat(null);
    if (isHidden(state)) {
      setState((s) => ({ ...s, beats: [...s.beats, { id: `slip${Date.now()}`, type: "narration", content: "Unseen in the dark, you hold still and let the danger pass — then melt away the other direction." }] }));
    }
  }

  // Begin combat the player has agreed to via the engage prompt.
  function handleEngage() {
    if (loading || !pendingEngage || combat || productionCombatOpen) return;
    const dir = pendingEngage.dir;
    const base = { ...liveStateRef.current, pendingCombatDirective: null };
    liveStateRef.current = base;
    setState(base);
    startCombatFromDirective(dir, base);
  }

  async function handleResolveCombat() {
    // Already settled means the campaign has this fight's outcome; running again would
    // narrate a second aftermath for one fight.
    if (!combatSession || combatSession.status === "settled") return;
    const session = combatSession;
    const cs = session.encounter;
    const ctx = session.context;
    const receipt = session.terminalReceipt || sealTowTerminalReceipt(session).session?.terminalReceipt;
    if (!receipt) {
      setTowCombatFeedback("The fight is not over yet.");
      return;
    }
    // Whether this death is permanent was decided at admission and written into the
    // receipt. It is read here, never re-derived — the player agreed to those stakes before
    // the first blow, and nothing about how the fight went may change them afterwards.
    const epicDeath = receipt.playerWorldFate === "dead";
    const lethal = ctx.lethalPolicy !== "nonlethal";
    const place = ctx.location || currentLocationName(state);
    const flavor = ctx.source.note;
    const npcIds = Object.fromEntries(
      Object.entries(ctx.participantBindings)
        .filter(([, binding]) => binding.campaignEntityId)
        .map(([actorId, binding]) => [actorId, binding.campaignEntityId]),
    );
    const settled = settleTowEncounter(state, cs, {
      encounterId: session.sessionId,
      proficiencyId: ctx.rewardPolicy.proficiencyId,
      npcIds,
      lethal,
      // Per-participant fates win over the blanket flag: one duel inside a brawl can be
      // real while the rest is fists, and the codex has to record each person correctly.
      worldFates: worldFatesByParticipant(receipt),
    });
    if (!settled.ok && settled.reason !== "tow-encounter-already-settled") {
      setError(`The fight could not be settled: ${settled.reason}.`);
      return;
    }
    let next = settled.ok ? settled.state : state;
    // Spoils are rolled from the foes that actually fell, and are never auto-taken —
    // the player still chooses to search them.
    //
    // The roll spends the session's own named loot stream rather than a global generator,
    // so the same fight yields the same spoils however many times it is settled, and what
    // was spent is recorded on the session instead of being lost to Math.random.
    let closing = session;
    if (cs.phase === "victory" && !epicDeath) {
      const fallen = cs.enemyIds
        .filter((enemyId) => cs.actors[enemyId].hp <= 0)
        .map((enemyId) => ctx.lootPolicy.sources[enemyId])
        .filter(Boolean);
      if (fallen.length > 0) {
        const spoils = streamSequencer(session.streams.loot);
        const manifest = rollLoot(fallen, {
          maxLootTier: ctx.lootPolicy.maxLootTier,
          region: ctx.lootPolicy.region,
          owned: new Set(ctx.lootPolicy.ownedUniqueIds),
          coinBonus: ctx.lootPolicy.coinBonus,
          random: spoils.random,
        });
        const spent = spendTowSessionStream(closing, "loot", spoils.endpoint());
        if (spent.ok) closing = spent.session;
        next = { ...next, pendingLoot: manifest };
      }
    }
    // A win the build keeps something from. The offer is drawn from the session's own
    // reward stream, so the three choices are reproducible from the fight that earned them
    // — and, like the spoils, what the draw spent is written back rather than forgotten.
    let pendingReward = next.pendingReward ?? null;
    if (cs.phase === "victory" && !epicDeath && next.mechanics?.build) {
      const rewards = streamSequencer(closing.streams.rewards);
      const seed = rewardSeedFor(closing.sessionId, closing.streams.rewards);
      const compiled = compileRewardOffer(next.mechanics.build, {
        sourceReceiptId: closing.sessionId,
        seed,
      });
      // No eligible reward is a real state, not a failure: a build at every cap has earned
      // being told so rather than being handed an empty offer.
      if (compiled.ok) pendingReward = compiled.offer;
      const spentRewards = spendTowSessionStream(closing, "rewards", rewards.endpoint());
      if (spentRewards.ok) closing = spentRewards.session;
    }

    // The session stays in state, marked settled, so a reload between here and the
    // aftermath lands on a fight that is already decided and already folded in — the
    // settlement receipt refuses a second attempt either way.
    const closed = markTowSessionSettled(closing, closing.sessionId);
    next = withTowMechanics(
      // A permanent death ends the run before anything is narrated. Presentation renders a
      // fact that is already canonical; it never gets to decide one.
      epicDeath ? { ...next, ended: true, pendingReward } : { ...next, pendingReward },
      {
        activeCombat: closed.ok ? closed.session : null,
        // Scarcity is already settled onto each participant's Resolve. Emptying the v1 maps
        // prevents a migrated campaign from carrying a second, hidden economy.
        readiness: {},
        companionReadiness: {},
      },
    );
    // The report the aftermath prompt has always claimed to be narrating from. It is
    // recorded as a beat before a word is generated, so the player is told exactly what
    // happened whether or not any narration ever arrives.
    const chronicle = buildCombatChronicle(session, receipt, {
      settlementId: session.sessionId,
      playerEndpoint: {
        vitality: next.character?.vitality ?? null,
        conditions: [...(next.character?.conditions || [])],
      },
    });
    const report = renderCombatChronicle(chronicle);

    // The whole prompt is built before anything is committed, because it *is* the debt: the
    // job carries the exact text a worker will send, so a scene resumed after a crash asks
    // for the same thing the original attempt would have.
    let msg;
    if (epicDeath) {
      msg = `${report}

[DEATH — ENGINE SETTLED] Permanent death against ${flavor || "a foe far beyond the player's strength"} at ${place} is already canonical. Narrate one external, unflinching final scene from the combat report: the foe, the killing blow, witnesses, and the silence after. Do not invent player speech, a last voluntary action, intent, emotion, or internal conclusion. Do not rescue, revise, or apply mechanics.`;
    } else if (cs.phase === "defeat") {
      // Lethality lives on the admission, not on the encounter. Reading it off the
      // encounter always yielded undefined, so every defeat was narrated as a
      // bare-knuckle beating even when the fight was fought with drawn steel.
      msg = `${report}

[DEFEATED — ENGINE SETTLED] The engine-settled defeat is final: ${flavor || "the foe"} left the player unconscious at ${place}; the player survives there with canonical vitality and conditions already applied, while inventory and location remain unchanged. ${lethal ? "Weapons were drawn; render the grave wounds already recorded." : "It was a bare-knuckle defeat; keep the external aftermath restrained."} Narrate only the foe, witnesses, surroundings, and passage of the immediate moment. Do not invent player speech, consent, intent, emotion, waking action, or any mechanical consequence.`;
    } else {
      const outcomeLine = cs.phase === "victory"
        ? "You won — every foe is slain or down."
        : "You broke contact and escaped; the foes remain alive and the fight has no victor.";
      msg = `${report}

[COMBAT OVER] ${outcomeLine} At ${place}. Narrate the immediate aftermath STRICTLY from the [COMBAT REPORT] — name the actual foe(s) and their exact fates, the room's reaction, your state — then leave the moment open for the player to react. A foe that yielded is present, beaten, and at your mercy: refer to THEM by name; do NOT introduce or substitute a different character to take the foe's place. Do not restart combat.`;
    }

    // The scene is owed, and the debt is written down in the same commit as the receipt.
    // A crash between settling and narrating now costs the prose and not the outcome: the
    // next load finds the job and pays it.
    const queued = enqueuePresentation(next.presentationJobs || [], {
      kind: "combat-aftermath",
      route: "combat-aftermath",
      sourceReceiptId: session.sessionId,
      stateRevision: next.beats?.length ?? 0,
      payload: { message: msg, chronicleChecksum: chronicle?.checksum ?? null },
    });
    next = {
      ...next,
      presentationJobs: queued.queue,
      beats: [
        ...(next.beats || []),
        {
          id: `tow-combat:${session.sessionId}:chronicle`,
          type: "narration",
          content: chronicleSummary(chronicle),
        },
      ],
    };
    liveStateRef.current = next;
    setState(next);
    setTowCombatFeedback(null);
    if (!epicDeath && next.pendingLoot) setPendingLoot({ ...next.pendingLoot, lethal });

    // The story always continues from the result, so the player can react. The worker owns
    // the call now: it claims the job first, so an interrupted attempt is recoverable rather
    // than lost.
    setError(null);
    await runPresentationWorker();
  }

  /**
   * Pay one owed scene.
   *
   * Claims the job before calling anything, so an attempt that dies mid-flight leaves a
   * claimed job with an expiring lease rather than a debt nobody knows about. On success the
   * response is applied to the exact attempt that asked for it; on failure the job goes back
   * to the queue with its error recorded, and the campaign still owns the settlement.
   */
  async function runPresentationWorker() {
    if (loading) return;
    const base = liveStateRef.current;
    const now = Date.now();
    const pending = requeueAbandonedPresentations(base.presentationJobs || [], now);
    const job = pending.find((entry) => entry.status === "pending");
    if (!job) return;

    const claimed = claimPresentation(pending, job.id, { owner: presentationOwnerRef.current, now });
    if (!claimed.ok) return;

    const withClaim = { ...liveStateRef.current, presentationJobs: claimed.queue };
    liveStateRef.current = withClaim;
    setState(withClaim);
    setPendingAftermath(null);
    setLoading(true);
    try {
      const { beat } = await narrateSpecialized(
        liveStateRef.current,
        claimed.job.payload.message,
        { route: claimed.job.route },
      );
      const done = completePresentation(liveStateRef.current.presentationJobs || [], {
        jobId: claimed.job.id,
        attemptId: claimed.job.attemptId,
      });
      const settledState = { ...liveStateRef.current, presentationJobs: done.queue };
      liveStateRef.current = settledState;
      setState(settledState);
      if (beat?.start_combat) setPendingEngage({ dir: beat.start_combat });
    } catch (e) {
      const released = releasePresentation(liveStateRef.current.presentationJobs || [], {
        jobId: claimed.job.id,
        attemptId: claimed.job.attemptId,
        errorCode: "presentation-failed",
      });
      const failedState = { ...liveStateRef.current, presentationJobs: released.queue };
      liveStateRef.current = failedState;
      setState(failedState);
      setPendingAftermath({ reason: e.message || String(e) });
      setError(null);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Take one of the three, or spend the reroll.
   *
   * Both write through the reward module rather than editing the build here, so the engine
   * rules — caps, slots, one claim per offer — hold whatever the UI does. A refusal is shown
   * rather than swallowed: a reward the player thought they took and did not get is worse
   * than one they were told they could not have.
   */
  function handleClaimReward(candidateId, replacingId = null) {
    const base = liveStateRef.current;
    const offer = base.pendingReward;
    if (!offer || !base.mechanics?.build) return;
    const claimed = claimReward(base.mechanics.build, offer, candidateId, { replacingId });
    if (!claimed.ok) {
      setError(`That reward could not be taken: ${claimed.reason}.`);
      return;
    }
    const next = {
      ...base,
      pendingReward: null,
      mechanics: { ...base.mechanics, build: claimed.build },
      beats: [
        ...(base.beats || []),
        {
          id: `tow-reward:${offer.id}`,
          type: "growth",
          text: `You come away from that fight the better for it: ${
            offer.candidates.find((entry) => entry.id === candidateId)?.name || candidateId
          }.`,
        },
      ],
    };
    setError(null);
    liveStateRef.current = next;
    setState(next);
  }

  function handleRerollReward() {
    const base = liveStateRef.current;
    const offer = base.pendingReward;
    if (!offer || !base.mechanics?.build) return;
    const rerolled = rerollRewardOffer(base.mechanics.build, offer);
    if (!rerolled.ok) {
      setError(`That offer could not be rerolled: ${rerolled.reason}.`);
      return;
    }
    const next = { ...base, pendingReward: rerolled.offer };
    setError(null);
    liveStateRef.current = next;
    setState(next);
  }

  /** Ask again for a scene that failed to arrive. Settlement is untouched either way. */
  async function handleRetryAftermath() {
    if (loading) return;
    setPendingAftermath(null);
    await runPresentationWorker();
  }

  /**
   * Decline the scene for good.
   *
   * The debt is durable, so declining has to clear it rather than hide the banner — a job
   * left pending would offer itself again on the next load, which is nagging rather than
   * resilience. The settlement and the factual Chronicle are untouched.
   */
  function handleDismissAftermath() {
    setPendingAftermath(null);
    const base = liveStateRef.current;
    const next = {
      ...base,
      presentationJobs: (base.presentationJobs || []).filter(
        (job) => job.status !== "pending" && job.status !== "failed",
      ),
    };
    liveStateRef.current = next;
    setState(next);
  }

  // Deliberately search the fallen: grant the spoils, then let the narrator
  // narrate it and adjudicate the fallout (it takes time; robbing corpses in
  // public draws the watch).
  async function handleLootFallen() {
    const manifest = pendingLoot;
    if (!manifest || loading) return;
    setPendingLoot(null);
    const { state: looted, taken } = applyLoot(state, manifest);
    liveStateRef.current = looted;
    setState(looted);
    setError(null);
    setLoading(true);
    try {
      const place = currentLocationName(looted);
      const msg = `[LOOTED] You take the time to search the ${manifest.deadCount > 1 ? `${manifest.deadCount} bodies` : "body"} and come away with: ${taken || "little of worth"}. This happens at ${place} and takes several minutes in plain sight. Narrate it, and adjudicate the fallout — rifling a corpse in a public, lawful place draws horror and the watch; in the wilds or a den, no one cares. Apply consequences (location_update, conditions, start_combat with guards, or tile_move) as fits.`;
      const policyOptions = { route: "loot-fallout" };
      const { beat } = await narrateSpecialized(looted, msg, policyOptions);
      if (!beat) return;
      if (beat.start_combat) setPendingEngage({ dir: beat.start_combat });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // Every input the player gives a fight becomes an identified command against a known
  // revision. The ID makes a double-tap free; the revision makes a swing at a fight that has
  // already moved on impossible. Neither was true when a click called the reducer directly.
  function dispatchCombatCommand(input) {
    const current = decodeTowSession(liveStateRef.current.mechanics?.tow?.activeCombat ?? null);
    if (!current.ok) {
      setTowCombatFeedback(`The fight could not be read: ${current.reason}.`);
      return;
    }
    const session = current.session;
    // The ID is minted from the live session, not from the render this click came off. Two
    // clicks landing in the same frame both read the committed revision, so neither is
    // mistaken for a repeat of the other — and what stops a double-tap becoming two swings
    // is the turn budget the encounter already enforces, not a dropped command.
    const actorId = input.actorId ?? session.encounter.playerId;
    const result = dispatchTowPlayerAction(session, {
      ...input,
      id: [
        session.sessionId,
        session.revision,
        input.type,
        actorId,
        input.skillId,
        input.itemId,
        input.anchorCell?.side,
        input.anchorCell?.index,
      ]
        .filter((part) => part !== null && part !== undefined)
        .join(":"),
      expectedRevision: session.revision,
      actorId,
    });
    if (!result.ok) {
      setTowCombatFeedback(`That move was refused: ${result.reason}.`);
      return;
    }
    if (result.duplicate) return;
    setTowCombatFeedback(null);
    // A finished fight seals its verdict in the same commit that finishes it, so a reload
    // between the last blow and the settlement lands on a decided fight rather than one
    // that has to be judged again.
    const sealed = result.session.encounter.phase === "player"
      ? { ok: true, session: result.session }
      : sealTowTerminalReceipt(result.session);
    commitTowSession(sealed.ok ? sealed.session : result.session);
  }

  const onCombatUseSkill = (skillId, targetId, actorId, anchorCell = null) => dispatchCombatCommand({
    type: "use-skill",
    skillId,
    targetId: targetId ?? null,
    actorId: actorId ?? null,
    anchorCell,
  });
  const onCombatUseItem = (itemId, targetId, actorId) => dispatchCombatCommand({
    type: "use-item",
    itemId,
    targetId: targetId ?? null,
    actorId: actorId ?? null,
  });
  const onCombatStandDown = (actorId) => dispatchCombatCommand({
    type: "stand-down",
    actorId: actorId ?? null,
  });
  const onCombatRetreat = (actorId) => dispatchCombatCommand({
    type: "attempt-retreat",
    actorId: actorId ?? null,
  });

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
  // Every unfinished campaign returns to the same deterministic archetype start. Legacy
  // limbo beats may remain in an old save, but no route renders or resumes that interview.
  const inLimbo = state.created === false;
  const showCreationHub = inLimbo;
  const queuedPlayerCount = pendingPlayerBeats(state).length;
  // This derived preview deliberately is not a hook: auth, subscription, title,
  // campaign-list, and game-over screens all return above this point. Keeping a
  // hook here would change Solitaire's hook count when a session opens (#310).
  const contextPreview = buildChatContextSections({ state, draft: input });
  const usesTowArchetypeProgression = state.character?.progressionModel === "tow-archetype";
  const readyAdvancements = state.created === false || usesTowArchetypeProgression
    ? 0
    : (pendingLevelAllocations(state.character)?.unspentLevels || 0);
  const advancementNeedsChoice = state.created !== false && !usesTowArchetypeProgression && pendingProgressionChoices(state.character)
    .some((choice) => choice.kind !== "level-allocation");
  const gameSurfaceBlocked = referenceGameplayOpen || showCreationHub;
  return (
    <div className="game-shell" style={{
      backgroundColor: "var(--scene-deep)",
      height: "100dvh", width: "100%", maxWidth: (combat || referenceGameplayOpen) ? "1440px" : "640px", margin: "0 auto",
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
      <div
        className="game-hud-layer"
        inert={gameSurfaceBlocked ? "" : undefined}
        aria-hidden={gameSurfaceBlocked ? true : undefined}
      >
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
        {REFERENCE_GAMEPLAY_PREVIEW_ENABLED
          && state.created !== false
          && !loading
          && !combat
          && !referenceGameplayOpen
          && !pendingCombat
          && !pendingEngage
          && !pendingLoot && (
          <aside className="reference-trial-launcher" aria-label="Tower of Winter developer preview">
            <div>
              <span>Developer sandbox · disabled by default</span>
              <strong>Winter Trial · The Gatekeeper</strong>
              <small>Reference-only preview · not the production combat path</small>
            </div>
            {referenceGameplayInvalid ? (
              <>
                <div>
                  <span>Reference trial save unavailable</span>
                  <strong>Stored trial progress could not be restored</strong>
                  <small>{referenceGameplay.reason}</small>
                </div>
                <button type="button" onClick={handleStartReferenceTrial}>Replace invalid save</button>
              </>
            ) : referenceRun ? (
              <button
                type="button"
                data-reference-trial-return-focus
                onClick={handleOpenReferenceTrial}
              >
                {referenceRunSettled ? "Review" : "Resume"}
              </button>
            ) : (
              <button type="button" onClick={handleStartReferenceTrial}>Begin</button>
            )}
            {referenceRunSettled && (
              <button type="button" className="reference-trial-launcher__secondary" onClick={handleStartReferenceTrial}>
                New trial
              </button>
            )}
            {referencePersistenceFeedback && (
              <p className="reference-trial-launcher__feedback" role="alert">
                {referencePersistenceFeedback}
              </p>
            )}
          </aside>
        )}
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
        {state.created !== false && pendingCombatDirectiveInvalid && !combat && (
          <div className="pending-combat-recovery fade-in" role="alert" style={{
            margin: "0 12px 8px", padding: "11px 14px",
            backgroundColor: "rgba(35,15,15,0.82)", border: "1px solid rgba(239,68,68,0.5)",
            borderRadius: 14, display: "flex", alignItems: "center", gap: "10px",
            boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "8px", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800, color: "#fca5a5", marginBottom: "2px" }}>
                Invalid combat handoff
              </div>
              <div style={{ fontSize: "13px", color: "#fde8e4", lineHeight: 1.35 }}>
                The saved encounter cannot be trusted ({pendingCombatDirective.reason}). No combat has started.
              </div>
            </div>
            <button type="button" onClick={handleDiscardInvalidPendingCombat} style={{
              padding: "9px 12px", borderRadius: 12, backgroundColor: colors.gold, color: colors.ink,
              border: "none", fontSize: "13px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
            }}>
              Discard invalid handoff
            </button>
          </div>
        )}
        {state.created !== false && owedPresentation && !combat && (
          <div className="tow-aftermath-retry fade-in" role="status" style={{
            margin: "0 12px 8px", padding: "11px 14px",
            backgroundColor: "rgba(20,29,29,0.82)", border: "1px solid rgba(215,167,111,0.4)",
            borderRadius: 14, display: "flex", alignItems: "center", gap: "10px",
            boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "8px", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800, color: colors.gold, marginBottom: "2px" }}>
                Aftermath unwritten
              </div>
              <div style={{ fontSize: "13px", color: "#e8e2d4", lineHeight: 1.35 }}>
                The fight is settled and its outcome is recorded above — only the telling of it
                failed ({pendingAftermath?.reason || owedPresentation.lastErrorCode || "no reason recorded"}).
              </div>
            </div>
            <button type="button" onClick={handleRetryAftermath} disabled={loading} style={{
              padding: "9px 12px", borderRadius: 12, backgroundColor: colors.gold, color: colors.ink,
              border: "none", fontSize: "13px", fontWeight: 800, cursor: loading ? "wait" : "pointer", fontFamily: "inherit", flexShrink: 0, opacity: loading ? 0.55 : 1,
            }}>
              Tell it again
            </button>
            <button type="button" onClick={handleDismissAftermath} disabled={loading} style={{
              padding: "9px 12px", borderRadius: 12, backgroundColor: "transparent", color: "rgba(215,167,111,0.7)",
              border: `1px solid rgba(215,167,111,0.25)`, fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
            }}>
              Leave it
            </button>
          </div>
        )}
        {state.created !== false && (towCombatInvalid || towCombatFeedback) && !combat && (
          <div className="tow-combat-recovery fade-in" role="alert" style={{
            margin: "0 12px 8px", padding: "11px 14px",
            backgroundColor: "rgba(35,15,15,0.82)", border: "1px solid rgba(239,68,68,0.5)",
            borderRadius: 14, display: "flex", alignItems: "center", gap: "10px",
            boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "8px", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800, color: "#fca5a5", marginBottom: "2px" }}>
                {towCombatInvalid ? "Unreadable saved fight" : "Combat"}
              </div>
              <div style={{ fontSize: "13px", color: "#fde8e4", lineHeight: 1.35 }}>
                {towCombatInvalid
                  ? `The saved fight cannot be trusted (${towCombat.reason}). Nothing has been applied to the campaign.`
                  : towCombatFeedback}
              </div>
            </div>
            {towCombatInvalid && (
              <button type="button" onClick={handleDiscardInvalidTowCombat} style={{
                padding: "9px 12px", borderRadius: 12, backgroundColor: colors.gold, color: colors.ink,
                border: "none", fontSize: "13px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
              }}>
                Discard unreadable fight
              </button>
            )}
          </div>
        )}
        {state.created !== false && state.lastIntentRefusals?.length > 0 && (
          <div className="tow-intent-refusals fade-in" role="status" style={{
            margin: "0 12px 8px", padding: "9px 14px",
            backgroundColor: "rgba(35,25,15,0.75)", border: "1px solid rgba(215,167,111,0.35)",
            borderRadius: 12, fontSize: "12px", color: "#e8dcc4", lineHeight: 1.4,
          }}>
            {refusalNotice(state.lastIntentRefusals)}
          </div>
        )}
        {state.created !== false && state.pendingReward && !combat && (
          <div className="tow-reward fade-in" role="group" aria-label="Reward" style={{
            margin: "0 12px 8px", padding: "11px 14px",
            backgroundColor: "rgba(20,29,29,0.85)", border: `1px solid ${colors.gold}55`,
            borderRadius: 14, boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
          }}>
            <div style={{ fontSize: "8px", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800, color: colors.gold, marginBottom: "6px" }}>
              What you take from it
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {state.pendingReward.candidates.map((candidate) => {
                const buildSkills = state.mechanics?.build?.skills || [];
                const candidateSkill = candidate.kind === "skill" ? getSkill(candidate.id) : null;
                const replacements = candidateSkill
                  ? replacementSkillIds(buildSkills, candidateSkill)
                  : [];
                const requiresReplacement = candidate.kind === "skill"
                  && (candidate.requiresReplacement === true || buildSkills.length >= SKILL_SLOTS);
                if (!requiresReplacement) {
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      className="tow-reward__choice"
                      onClick={() => handleClaimReward(candidate.id)}
                      style={{
                        flex: "1 1 9rem", padding: "9px 12px", borderRadius: 12,
                        backgroundColor: "transparent", color: colors.parchment,
                        border: `1px solid ${colors.gold}55`, fontFamily: "inherit",
                        fontSize: "13px", textAlign: "left", cursor: "pointer",
                      }}
                    >
                      <strong style={{ display: "block" }}>{candidate.name}</strong>
                      <span style={{ fontSize: "11px", color: colors.parchmentMuted }}>{candidate.detail}</span>
                    </button>
                  );
                }
                return (
                  <div
                    key={candidate.id}
                    className="tow-reward__replacement"
                    role="group"
                    aria-label={`Choose an ability for ${candidate.name} to replace`}
                    style={{
                      flex: "1 1 15rem", padding: "9px 12px", borderRadius: 12,
                      border: `1px solid ${colors.gold}55`, color: colors.parchment,
                    }}
                  >
                    <strong style={{ display: "block", fontSize: "13px" }}>{candidate.name}</strong>
                    <span style={{ display: "block", fontSize: "11px", color: colors.parchmentMuted }}>{candidate.detail}</span>
                    <span style={{ display: "block", marginTop: "7px", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: colors.gold }}>
                      Replace the compatible equipped ability
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "5px" }}>
                      {replacements.map((skillId) => (
                        <button
                          key={skillId}
                          type="button"
                          onClick={() => handleClaimReward(candidate.id, skillId)}
                          style={{
                            padding: "6px 8px", borderRadius: 8, border: `1px solid ${colors.gold}44`,
                            background: "rgba(215,167,111,0.08)", color: colors.parchment,
                            fontFamily: "inherit", fontSize: "11px", cursor: "pointer",
                          }}
                        >
                          {getSkill(skillId)?.name || skillId}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {state.pendingReward.rerollsRemaining > 0 && (
              <button type="button" onClick={handleRerollReward} style={{
                marginTop: "6px", padding: "6px 0", border: "none", background: "transparent",
                color: "rgba(215,167,111,0.75)", fontFamily: "inherit", fontSize: "12px",
                textDecoration: "underline", cursor: "pointer",
              }}>
                Look again
              </button>
            )}
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
            <button onClick={handleEngage} disabled={loading} style={{
              padding: "9px 16px", borderRadius: 12, backgroundColor: colors.gold, color: colors.ink,
              border: "none", fontSize: "13px", fontWeight: 800, cursor: loading ? "wait" : "pointer", fontFamily: "inherit", flexShrink: 0, opacity: loading ? 0.55 : 1,
            }}>{pendingEngage.dir?.initiator === "enemy" ? "Defend" : "Engage"}</button>
            {pendingEngage.dir?.initiator !== "enemy" && (
              <button onClick={() => setPendingEngage(null)} disabled={loading} style={{
                padding: "9px 12px", borderRadius: 12, backgroundColor: "transparent", color: "rgba(215,167,111,0.7)",
                border: `1px solid rgba(215,167,111,0.25)`, fontSize: "13px", fontWeight: 700, cursor: loading ? "wait" : "pointer", fontFamily: "inherit", flexShrink: 0, opacity: loading ? 0.55 : 1,
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
          contextPreview={contextPreview}
          contextOpen={contextPreviewOpen}
          activeModel={narratorModelLabel(getNarratorModel())}
          onContextOpenChange={setContextPreviewOpen}
        />
      </div>

      {beatMenu && (
        <BeatActionSheet
          mode={beatMode}
          kind={beatMenu.kind}
          canRewrite={beatMenu.kind === "narrative" && beatMenu.turnK >= 0}
          canRewind={beatMenu.canRewind}
          turnK={beatMenu.turnK}
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


      {/* One reversible authored-character start. Practice temporarily covers it; the
          controlled draft remains in App, so returning restores the same preview. */}
      {showCreationHub && practiceDraft && (
        <PracticeFight
          receipt={practiceDraft.receipt}
          scenarioId={practiceDraft.scenarioId}
          allyGroupId={practiceDraft.allyGroupId}
          skillRarities={practiceDraft.skillRarities}
          keepsakeId={practiceDraft.keepsakeId}
          onExit={() => setPracticeDraft(null)}
        />
      )}
      {showCreationHub && !practiceDraft && (
        <QuickStartLane
          draft={startDraft}
          onDraftChange={setStartDraft}
          busy={loading}
          error={quickStartError}
          onPractice={handleQuickStartPractice}
          onBegin={handleArchetypeBegin}
          onQuit={handleBackToCampaigns}
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
            onDismiss: handleDismiss,
            onMount: handleMount,
            onDismount: handleDismountRider,
            onSetFormation: handleSetCombatFormation,
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
          travelHalt={travelHalt}
          onHaltPressOn={(intendedDest) => { setTravelHalt(null); handleTravel(intendedDest); }}
          onHaltDismiss={() => setTravelHalt(null)}
          onFly={handleFly}
          onTeleport={handleTeleport}
          onSeekCombat={handleSeekCombat}
          onHaltMakeCamp={handleHaltMakeCamp}
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
      {productionCombatSession && (
        <ProductionCombatView
          session={productionCombatSession}
          error={productionCombatFeedback || campaignError}
          onCommand={handleProductionCombatCommand}
          onSettle={handleProductionCombatSettlement}
        />
      )}
      {productionCombatInvalid && (
        <div
          className="production-combat-recovery"
          role="dialog"
          aria-modal="true"
          aria-labelledby="production-combat-recovery-title"
        >
          <section>
            <h1 id="production-combat-recovery-title">Combat recovery failed</h1>
            <p role="alert">The saved fight was rejected: {productionCombat.reason}.</p>
            <p>No victory, defeat, reward, injury, or named-foe outcome has been applied.</p>
            <button type="button" onClick={handleReplaceInvalidProductionCombat}>
              Discard invalid combat record
            </button>
          </section>
        </div>
      )}
      {referenceGameplayOpen && referenceRun && !productionCombatOpen && (
        <ReferenceCombatView
          run={referenceRun}
          feedback={referenceGameplayFeedback || campaignError || referencePersistenceFeedback}
          returnFocusSelector="[data-reference-trial-return-focus]"
          onCommand={handleReferenceCommand}
          onRefresh={handleReferenceRefresh}
          onClaim={handleReferenceClaim}
          onExit={handleCloseReferenceTrial}
        />
      )}
      {combat && !exclusiveGameplayOpen && (
        <TowCombatView
          encounter={combat}
          note={combatSession?.context?.source?.note}
          playerPortraitKey={state.character?.portraitKey}
          sceneArt={sceneVisual}
          artFor={(actor) => {
            if (actor.id === combat.playerId || actor.side === "enemy") return null;
            const companionId = combatSession?.context?.participantBindings?.[actor.id]?.campaignEntityId;
            const companion = companionId ? state.world.codex.characters?.[companionId] : null;
            return resolvePlayerCombatCutout(companion?.portraitKey, companion);
          }}
          weaponFor={(actor) => {
            if (actor.id === combat.playerId) {
              return weaponPresentationForCharacter(state.character, state.world.codex);
            }
            const companionId = combatSession?.context?.participantBindings?.[actor.id]?.campaignEntityId;
            const companion = companionId ? state.world.codex.characters?.[companionId] : null;
            return weaponPresentationForCharacter(companion, state.world.codex);
          }}
          onUseSkill={onCombatUseSkill}
          onUseItem={onCombatUseItem}
          onStandDown={onCombatStandDown}
          onRetreat={onCombatRetreat}
          onSettle={handleResolveCombat}
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
