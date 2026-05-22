import React, { useState, useEffect, useRef } from "react";

import { STORAGE_KEY } from "./config.js";
import { TERRAINS } from "./data/terrains.js";
import { makeInitialState, migrateCodex } from "./data/initial-state.js";

import { storeGet, storeDel } from "./engine/storage.js";
import { callNarrator } from "$api";
import { onAuthChange, signOut, linkEmail, isSubscribed } from "$auth";
import { listCampaigns, loadCampaign, saveCampaign, deleteCampaign, renameCampaign } from "$campaigns";
import { applyBeat } from "./engine/beat.js";
import { buildStateContext } from "./engine/api.js";
import { recordTurn, stateBeforeTurn, turnForBeatIndex, editBeat } from "./engine/timeline.js";
import { equipItem, unequipItem } from "./engine/inventory.js";
import { buyGood, sellGood, formatCopper, coinsToCopper } from "./engine/economy.js";
import { useConsumable } from "./engine/consumables.js";
import { applyForge, applyApprentice, blacksmithRank } from "./engine/forge.js";
import { generateBoard, acceptTask, abandonTask, applyDayLabour } from "./engine/quests.js";
import { generateGaol, acceptBounty, buyPrisonerRights } from "./engine/gaol.js";
import { recruitCompanion, dismissCompanion, isRecruited, partyMembers } from "./engine/party.js";
import { applyTraining, trainingOffer } from "./engine/training.js";
import { buildingForTile, isBuildingOpen, buildingHours, TRAIN_CAP } from "./data/town.js";
import { schematicsForBuilding } from "./data/schematics.js";
import { tierLabel, tierOrder } from "./data/tiers.js";
import { rollShopStock } from "./engine/town-gen.js";
import {
  getTile, currentLocationName,
  squareToAxial, computeSightFrom, computeSightFromRadius,
  findPath, pathMinutes,
} from "./engine/world.js";
import { rollPathEncounter } from "./engine/encounters.js";
import { SPAWN_TABLES } from "./data/spawn-tables.js";
import { getBiome } from "./data/biomes.js";
import { generateEnemyGroup, enemyFromNPC } from "./data/bestiary.js";
import { regionDifficulty } from "./data/regions.js";
import { generateEnvironment } from "./data/environment.js";
import { initCombat, playerAct, playerTalk, playerUseEnvironment, playerDrawWeapon, setTarget, endTurn, playerFlee, applyCombatResult, applyLoot } from "./engine/combat.js";
import { activeWorldPassives } from "./engine/combat-stats.js";

import { CompactHeader } from "./components/CompactHeader.jsx";
import { CombatView } from "./components/combat/CombatView.jsx";
import { VitalsStrip, InputBar, LoadingDots, ErrorBanner } from "./components/primitives.jsx";
import { BeatActionSheet } from "./components/BeatActionSheet.jsx";
import { colors } from "./components/tokens.js";
import { BeatRender } from "./components/beats/BeatRender.jsx";
import { MenuSheet } from "./components/MenuSheet.jsx";
import { MapView } from "./components/MapView.jsx";
import { TraderView } from "./components/TraderView.jsx";
import { ForgeView } from "./components/ForgeView.jsx";
import { QuestBoardView } from "./components/QuestBoardView.jsx";
import { PrisonView } from "./components/PrisonView.jsx";
import { PartyView } from "./components/PartyView.jsx";
import { ConfirmDialog } from "./components/ConfirmDialog.jsx";
import { CodexView } from "./components/CodexView.jsx";
import { AuthScreen } from "./components/AuthScreen.jsx";
import { SubscriptionScreen } from "./components/SubscriptionScreen.jsx";
import { CampaignsList } from "./components/CampaignsList.jsx";
import { GameOverScreen } from "./components/GameOverScreen.jsx";
import { InitialBackdrop } from "./components/InitialBackdrop.jsx";
import { SceneBackdrop } from "./components/SceneBackdrop.jsx";

const LAST_OPENED_KEY = "solitaire-last-campaign-v12";

// Difficulty profile of the current location (region-gated, not level-scaled).
function regionHere(state) {
  const cur = state.world.currentTile;
  return regionDifficulty(cur.x, cur.y);
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
  const extras = getBiome(cur.x, cur.y).extraSpawns?.[tile.terrain] || [];
  return [...base.entries, ...extras].filter((e) => e.posture === "hostile");
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
  // Multi-tile travel: mark intermediate path tiles as visited and refresh sight
  // from each so the player's seen area expands along the route.
  if (path.length > 2) {
    const newTiles = { ...next.world.tiles };
    let newSeen = next.world.seen;
    for (let i = 1; i < path.length - 1; i++) {
      const p = path[i];
      const k = `${p.x},${p.y}`;
      if (!newTiles[k]) newTiles[k] = getTile(base, p.x, p.y);
      newSeen = computeSightFrom(p.x, p.y, newSeen);
    }
    next = { ...next, world: { ...next.world, tiles: newTiles, seen: newSeen } };
  }
  // Vista: arriving at a tile with vistaRadius reveals a wide hex.
  const destTile = getTile(base, travel.dest.x, travel.dest.y);
  if (destTile?.vistaRadius && destTile.vistaRadius > 0) {
    const wider = computeSightFromRadius(travel.dest.x, travel.dest.y, destTile.vistaRadius, next.world.seen);
    next = { ...next, world: { ...next.world, seen: wider } };
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

function CenteredLoader() {
  return (
    <div style={{
      backgroundColor: colors.inkDeep,
      height: "100dvh", width: "100%",
      maxWidth: "480px", margin: "0 auto",
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative",
      overflow: "hidden",
    }}>
      <InitialBackdrop />
      <div style={{ position: "relative", zIndex: 1 }}>
        <LoadingDots />
      </div>
    </div>
  );
}

export function Solitaire() {
  // Auth
  const [user, setUser] = useState(__SOLITAIRE_MODE__ === "web" ? null : { id: "artifact" });
  const [authChecked, setAuthChecked] = useState(__SOLITAIRE_MODE__ !== "web");

  // Subscription gate (web only). Artifact mode is always allowed.
  const [subChecked, setSubChecked] = useState(__SOLITAIRE_MODE__ !== "web");
  const [subscribed, setSubscribed] = useState(__SOLITAIRE_MODE__ !== "web");
  const [subBusy, setSubBusy] = useState(false);

  // Campaigns
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoaded, setCampaignsLoaded] = useState(false);
  const [currentCampaignId, setCurrentCampaignId] = useState(null);
  const [campaignBusy, setCampaignBusy] = useState(false);
  const [campaignError, setCampaignError] = useState(null);
  const autoResumedRef = useRef(false);

  // Game
  const [state, setState] = useState(makeInitialState());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [codexOpen, setCodexOpen] = useState(false);
  const [partyOpen, setPartyOpen] = useState(false);
  const [shopTile, setShopTile] = useState(null); // {x,y} of an open building, or null
  const [shopView, setShopView] = useState("trade"); // "trade" | "forge" within a building
  // Recent purchases at the current shop, for full refunds until you leave the
  // scene: { tileKey, items: { [itemId]: [pricePaid, ...] } }.
  const [receipts, setReceipts] = useState({ tileKey: null, items: {} });
  // Themed confirm dialog (replaces window.confirm). askConfirm() resolves a
  // promise when the player chooses; the component is rendered near the root.
  const [confirmDialog, setConfirmDialog] = useState(null);
  function askConfirm(opts) {
    return new Promise((resolve) => setConfirmDialog({ ...opts, resolve }));
  }
  const [hydrated, setHydrated] = useState(false);
  const logRef = useRef(null);

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

  // ----- Auth subscription (web mode) -----
  useEffect(() => {
    if (__SOLITAIRE_MODE__ !== "web") return;
    let mounted = true;
    const unsubscribe = onAuthChange((u) => {
      if (!mounted) return;
      setUser(u);
      setAuthChecked(true);
    });
    return () => { mounted = false; unsubscribe(); };
  }, []);

  // ----- Subscription check when user appears (web mode) -----
  useEffect(() => {
    if (__SOLITAIRE_MODE__ !== "web") return;
    if (!user) { setSubChecked(false); setSubscribed(false); return; }
    let cancelled = false;
    setSubChecked(false);
    isSubscribed()
      .then((ok) => { if (!cancelled) { setSubscribed(!!ok); setSubChecked(true); } })
      .catch(() => { if (!cancelled) { setSubscribed(false); setSubChecked(true); } });
    return () => { cancelled = true; };
  }, [user]);

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

  // ----- Fetch campaigns list when user appears -----
  useEffect(() => {
    if (!user) {
      setCampaigns([]);
      setCampaignsLoaded(false);
      autoResumedRef.current = false;
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
  }, [user, subscribed]);

  // ----- Auto-resume / legacy-import on first load -----
  useEffect(() => {
    if (autoResumedRef.current || !campaignsLoaded || !user) return;
    autoResumedRef.current = true;
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

        const isCancelled = () => cancelled;

        // 2. Standard auto-resume: open the last-opened campaign if it still exists.
        const lastOpened = localStorage.getItem(LAST_OPENED_KEY);
        if (lastOpened && snapshotCampaigns.some((c) => c.id === lastOpened)) {
          await openCampaign(lastOpened, isCancelled);
          return;
        }

        // 3. First-launch auto-create: no campaigns at all → make one and dive in.
        if (snapshotCampaigns.length === 0) {
          await createCampaign(isCancelled);
          return;
        }

        // 4. Otherwise: campaigns exist but no lastOpened → stay on list.
      } catch (e) {
        if (!cancelled) setCampaignError(e.message || String(e));
      }
    })();
    return () => { cancelled = true; };
    // We intentionally depend only on campaignsLoaded + user; the campaigns
    // snapshot is captured at the moment campaignsLoaded becomes true.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignsLoaded, user]);

  // ----- Save on state change (when a campaign is active) -----
  useEffect(() => {
    if (!hydrated || !currentCampaignId) return;
    let cancelled = false;
    saveCampaign(currentCampaignId, state).catch((e) => {
      if (!cancelled) setCampaignError(`Save failed: ${e.message || e}`);
    });
    return () => { cancelled = true; };
  }, [state, hydrated, currentCampaignId]);

  // ----- Scroll the beat log -----
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [state.beats.length, loading]);

  // ----- Campaign handlers -----

  // Internal helpers shared by handlers + auto-resume. isCancelled is a getter
  // (not a snapshot) so callers from useEffect can flip cancellation atomically
  // when their cleanup fires.
  async function openCampaign(id, isCancelled = () => false) {
    setCampaignBusy(true);
    setHydrated(false);
    setCampaignError(null);
    try {
      const loaded = await loadCampaign(id);
      if (isCancelled()) return;
      if (!loaded) {
        // Stale id; drop the lastOpened pointer and let the list show.
        localStorage.removeItem(LAST_OPENED_KEY);
        const refreshed = await listCampaigns();
        if (!isCancelled()) setCampaigns(refreshed);
        return;
      }
      // Pull forward any codex entries (races, professions, named NPCs)
      // added to initial-state.js since this campaign was last opened.
      // Doesn't touch the player's own discoveries.
      const migrated = migrateCodex(loaded);
      setState(migrated);
      closeBeatMenu();
      setCurrentCampaignId(id);
      localStorage.setItem(LAST_OPENED_KEY, id);
      setHydrated(true);
    } catch (e) {
      if (!isCancelled()) setCampaignError(e.message || String(e));
    } finally {
      if (!isCancelled()) setCampaignBusy(false);
    }
  }

  async function createCampaign(isCancelled = () => false) {
    setCampaignBusy(true);
    setHydrated(false);
    setCampaignError(null);
    try {
      const fresh = makeInitialState();
      const name = fresh.character?.name || "Untitled";
      const { id } = await saveCampaign(null, fresh, { name });
      if (isCancelled()) return;
      setState(fresh);
      closeBeatMenu();
      setCurrentCampaignId(id);
      localStorage.setItem(LAST_OPENED_KEY, id);
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
    setCampaignError(null);
    try {
      await deleteCampaign(id);
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      if (currentCampaignId === id) {
        setCurrentCampaignId(null);
        setHydrated(false);
        localStorage.removeItem(LAST_OPENED_KEY);
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

  function handleBackToCampaigns() {
    setMenuOpen(false);
    setCurrentCampaignId(null);
    setHydrated(false);
    localStorage.removeItem(LAST_OPENED_KEY);
    // Refresh list to pick up the latest last_played_at from this session.
    listCampaigns().then(setCampaigns).catch(() => {});
  }

  async function handleSignOut() {
    setMenuOpen(false);
    setCurrentCampaignId(null);
    setHydrated(false);
    localStorage.removeItem(LAST_OPENED_KEY);
    try {
      await signOut();
    } catch (e) {
      setCampaignError(`Sign-out failed: ${e.message || e}`);
    }
  }

  // ----- Game handlers (unchanged behavior, kept inline) -----

  async function handleSubmit() {
    const action = input.trim();
    if (!action || loading) return;
    setInput("");
    setError(null);
    setLoading(true);
    const playerBeat = { id: `p${Date.now()}`, type: "player", content: action };
    const stateWithPlayer = { ...state, beats: [...state.beats, playerBeat] };
    setState(stateWithPlayer);
    try {
      const message = `[PLAYER ACTION] ${action}`;
      const beat = await callNarrator(stateWithPlayer, message);
      const next = applyBeat(stateWithPlayer, beat);
      setState(recordTurn(stateWithPlayer, message, next));
      // An explicit strike in the fiction hands off to the turn-based engine.
      if (beat.start_combat) setPendingEngage({ dir: beat.start_combat });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleTravel(dest, providedPath) {
    if (loading) return;
    const cur = state.world.currentTile;
    const path = providedPath || findPath(state, cur, dest);
    if (!path || path.length < 2) return;
    const fromTile = getTile(state, cur.x, cur.y);
    const toTile = getTile(state, dest.x, dest.y);
    setMapOpen(false);
    setReceipts({ tileKey: null, items: {} }); // leaving the scene ends refunds
    setError(null);
    setLoading(true);
    closeBeatMenu();
    const fromName = currentLocationName(state);
    const toName = toTile.poi?.name || `${TERRAINS[toTile.terrain]?.label} (${dest.x},${dest.y})`;
    const isHidden = toTile.poi?.type === "hidden";
    const travelWp = activeWorldPassives(state.character, state.world.codex);
    const totalMins = Math.max(1, Math.round(pathMinutes(state, path) * (1 - (travelWp.travelMult || 0))));
    const hexes = path.length - 1;

    // Summarize the route's terrain mix for the narrator.
    const terrainCounts = {};
    for (let i = 1; i < path.length; i++) {
      const tile = getTile(state, path[i].x, path[i].y);
      terrainCounts[tile.terrain] = (terrainCounts[tile.terrain] || 0) + 1;
    }
    const terrainSummary = Object.entries(terrainCounts)
      .map(([t, n]) => `${TERRAINS[t]?.label || t} ×${n}`)
      .join(", ");

    const playerBeat = { id: `p${Date.now()}`, type: "player", content: `Travel from ${fromName} to ${toName}.` };
    const stateWithPlayer = { ...state, beats: [...state.beats, playerBeat] };
    setState(stateWithPlayer);

    // One encounter roll for the whole journey (Phase 3 decision 1a).
    const pathEnc = isHidden ? null : rollPathEncounter(state, path);

    const destDescription = isHidden
      ? "HIDDEN — generate a random event appropriate to the terrain. Set tile_discovery."
      : toTile.poi
        ? `known ${toTile.poi.type} (${toTile.poi.name})`
        : "open wilderness";

    let travelMsg;
    if (hexes === 1) {
      travelMsg = `[PLAYER ACTION] Travel from ${fromName} (${TERRAINS[fromTile.terrain]?.label}) to ${toName} (${TERRAINS[toTile.terrain]?.label}). Estimated time: ${totalMins} minutes. Destination type: ${destDescription}. Narrate journey + arrival in one beat. Use minutes_passed = ${totalMins}.`;
    } else {
      travelMsg = `[PLAYER ACTION] Travel from ${fromName} (${TERRAINS[fromTile.terrain]?.label}) to ${toName} (${TERRAINS[toTile.terrain]?.label}). Total: ${hexes} hexes, ${totalMins} minutes. Route crosses: ${terrainSummary}. Destination type: ${destDescription}. Narrate the whole journey in a single beat — brief sensory passes through each terrain, then arrival. Use minutes_passed = ${totalMins}.`;
    }

    let encounterLine = "";
    if (pathEnc) {
      const encTile = getTile(state, pathEnc.atTile.x, pathEnc.atTile.y);
      const encTerrainLabel = TERRAINS[encTile.terrain]?.label?.toLowerCase() || "wilderness";
      const placement = hexes === 1
        ? "during the journey or arrival"
        : `partway along, at a ${encTerrainLabel} stretch`;
      encounterLine = `\n\n[ENCOUNTER] kind: ${pathEnc.encounter.kind}; posture: ${pathEnc.encounter.posture}; flavor: "${pathEnc.encounter.desc}". Weave this into the journey ${placement}.`;
    }

    const fullMsg = travelMsg + encounterLine;

    // Everything needed to reproduce this journey if the player later rewrites it,
    // and to undo it cleanly on a rewind: the route (sight), the destination
    // (arrival + vista), and the rolled encounter (re-offer a fight). Recorded
    // with the turn so travel moments are steerable like any other.
    const travel = {
      fromName, toName,
      dest: { x: dest.x, y: dest.y },
      path: path.map((p) => ({ x: p.x, y: p.y })),
      totalMins,
      encounter: pathEnc ? pathEnc.encounter : null,
    };

    try {
      const beat = await callNarrator(stateWithPlayer, fullMsg);
      const next = applyTravelArrival(stateWithPlayer, beat, travel);
      setState(recordTurn(stateWithPlayer, fullMsg, next, { travel }));
      // A hostile encounter along the way offers a fight once the player lands.
      if (travel.encounter && travel.encounter.posture === "hostile") {
        setPendingCombat(travel.encounter);
      }
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleResetCampaign() {
    if (!(await askConfirm({ title: "Reset campaign", body: "Reset this campaign to the beginning? Your current progress here will be erased.", confirmLabel: "Reset", danger: true }))) return;
    setState(makeInitialState());
    closeBeatMenu();
    setMenuOpen(false);
  }

  function handleEquip(itemId) { setState((s) => equipItem(s, itemId)); }
  function handleUnequip(itemId) { setState((s) => unequipItem(s, itemId)); }

  // ----- Town buildings: trader menus (buy / sell / talk) -----

  function openShop() {
    const cur = state.world.currentTile;
    const b = buildingForTile(getTile(state, cur.x, cur.y));
    if (b && !isBuildingOpen(b, state.time.hour)) return; // shut for the night
    const key = `${cur.x},${cur.y}`;
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
    setShopTile(null);
    if (!start || !here || loading) return;
    const tile = getTile(state, here.x, here.y);
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
    const place = tile.poi?.name || building.label;
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
      const beat = await callNarrator(stateWithPlayer, msg);
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

  // Take the next apprenticeship step (coin + days at the forge). Confirmed
  // because it jumps the calendar significantly.
  async function handleApprentice(step) {
    if (loading) return;
    if (!(await askConfirm({ title: "Apprentice to the smith", body: `Train as ${step.title}? This costs ${formatCopper(step.costCp)} and ${step.days} days bound to the forge.`, confirmLabel: "Train" }))) return;
    const r = applyApprentice(state, step);
    if (!r.ok) { setError(r.reason || "You can't pay the smith."); return; }
    const beat = { id: `appr${Date.now()}`, type: "narration", content: `You bind yourself to the smith as ${step.title}. The days blur into bellows-heat, ruined billets, and the slow grammar of the hammer — and you come away knowing more than you did.` };
    setShopTile(null); // the long apprenticeship ends the visit
    setState({ ...r.state, beats: [...r.state.beats, beat] });
  }

  // Pay an expert to drill a proficiency a rating step (engine/training.js).
  async function handleTrain(profId) {
    if (loading || !shopTile) return;
    const tile = getTile(state, shopTile.x, shopTile.y);
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
    const key = `${state.world.currentTile.x},${state.world.currentTile.y}`;
    const r = buyGood(state, { tileKey: key, bucket, itemDef, priceCp, qty: 1 });
    if (!r.ok) return;
    setState(r.state);
    setReceipts((rec) => {
      const items = rec.tileKey === key ? { ...rec.items } : {};
      items[itemDef.id] = [...(items[itemDef.id] || []), priceCp];
      return { tileKey: key, items };
    });
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
    if (!r.ok) return;
    setState({ ...r.state, beats: [...r.state.beats, { id: `use${Date.now()}`, type: "narration", content: r.summary }] });
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
  // Recruiting brings a real, persistent person into the party (engine/party.js
  // files them into the codex and adds them to state.party). After the
  // deterministic add, the narrator plays the brief joining scene.
  async function handleRecruit(tmpl) {
    if (loading || !shopTile || isRecruited(state, tmpl.id)) return;
    const body = tmpl.feeCp
      ? `Take ${tmpl.name} the ${tmpl.role} into your company? They ask ${formatCopper(tmpl.feeCp)} up front, then ${tmpl.terms}.`
      : `Take ${tmpl.name} the ${tmpl.role} into your company? Their terms: ${tmpl.terms}.`;
    if (!(await askConfirm({ title: `Recruit ${tmpl.name}`, body, confirmLabel: "Recruit" }))) return;
    const r = recruitCompanion(state, tmpl);
    if (!r.ok) { setError(r.reason || "They won't join."); return; }
    const place = getTile(state, shopTile.x, shopTile.y).poi?.name || "the tavern";
    setShopTile(null);
    setError(null);
    setLoading(true);
    const playerBeat = { id: `p${Date.now()}`, type: "player", content: `You take ${tmpl.name} on. They join your company.` };
    const stateWithPlayer = { ...r.state, beats: [...r.state.beats, playerBeat] };
    setState(stateWithPlayer);
    try {
      const msg = `[PLAYER ACTION] At ${place} you have just recruited ${tmpl.name}, a ${tmpl.race} ${tmpl.role} (${tmpl.desc}). They are now a COMPANION travelling with you — already established in the codex and your party; do NOT undo it. Narrate the brief moment they take up with you: a term struck, a handshake, a first word between you. Keep it to a sentence or three. From now on they are present in scenes and act and speak on their own.`;
      const beat = await callNarrator(stateWithPlayer, msg);
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
  async function handleDismiss(id) {
    const c = state.world.codex.characters[id];
    if (!(await askConfirm({ title: "Part ways", body: `Tell ${c?.name || "this companion"} you're parting ways? They'll go their own road — you can find them again.`, confirmLabel: "Part ways", danger: true }))) return;
    setState(dismissCompanion(state, id).state);
  }

  // ----- Gaol: bounties + buying prisoner rights -----

  function handleAcceptBounty(b) {
    const r = acceptBounty(state, b);
    if (!r.ok) return;
    setState({ ...r.state, beats: [...r.state.beats, { id: `bty${Date.now()}`, type: "narration", content: `You take the warden's contract on ${b.name} — wanted for ${b.crime}. Dead or alive.` }] });
  }
  // Buying rights is a coin transaction; the custody scene is narrated.
  async function handleBuyRights(p) {
    if (loading || !shopTile) return;
    if (!(await askConfirm({ title: "Buy prisoner's rights", body: `Pay ${formatCopper(p.rightsCp)} to the warden for the rights to ${p.name} (held for ${p.crime})? Their fate becomes yours.`, confirmLabel: "Pay" }))) return;
    const r = buyPrisonerRights(state, p);
    if (!r.ok) { setError(r.reason || "You can't pay the warden."); return; }
    const place = getTile(state, shopTile.x, shopTile.y).poi?.name || "the gaol";
    setShopTile(null);
    setError(null);
    setLoading(true);
    const playerBeat = { id: `p${Date.now()}`, type: "player", content: `You pay the warden for the rights to ${p.name}.` };
    const stateWithPlayer = { ...r.state, beats: [...r.state.beats, playerBeat] };
    setState(stateWithPlayer);
    try {
      const msg = `[PLAYER ACTION] At ${place} you have just paid the warden ${formatCopper(p.rightsCp)} for the rights to ${p.name}, held for ${p.crime} (${p.desc}). The coin is already settled — do not re-tally it. Play the moment the warden hands them over: who ${p.name} is, how they react, and leave it open for the player to decide their fate (free them, press them to service, ransom them, or take them elsewhere to sell). Don't fabricate combat.`;
      const beat = await callNarrator(stateWithPlayer, msg);
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
    if (beat.type !== "narration" && beat.type !== "dialogue") return;
    setBeatMenu({ beatId: beat.id, index, turnK: turnForBeatIndex(state, index) });
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
    if (!menu || menu.turnK < 0 || !feedback || loading) return;
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
      const beat = await callNarrator(base, cp.message + directive);
      // Keep memory clean of the steer scaffolding so later turns don't treat the
      // rejected version as canon.
      beat._userMsg = `${buildStateContext(base)}\n\n${cp.message}`;
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

  // Rewind the story to just before this bubble — drop it and everything after.
  function handleRewindBeat() {
    const menu = beatMenu;
    if (!menu || menu.turnK < 0 || loading) return;
    closeBeatMenu();
    setPendingEngage(null);
    setPendingCombat(null);
    setPendingLoot(null);
    setState(stateBeforeTurn(state, menu.turnK));
  }

  // Manually edit the bubble's text (synced into the model's memory).
  function handleEditBeat() {
    const menu = beatMenu;
    const text = editText.trim();
    if (!menu || !text) return;
    setState((s) => editBeat(s, menu.beatId, text));
    closeBeatMenu();
  }

  // ----- Combat handlers -----

  function startCombat(enemies, context, extraOpts = {}, st = state) {
    if (!enemies || enemies.length === 0) return;
    combatCtxRef.current = context || { flavor: enemies[0].name };
    setMenuOpen(false); setMapOpen(false); setCodexOpen(false); setShopTile(null);
    setPendingCombat(null);
    closeBeatMenu();
    const region = regionHere(st);
    const wp = activeWorldPassives(st.character, st.world.codex);
    const cur = st.world.currentTile;
    const terrain = getTile(st, cur.x, cur.y).terrain;
    setCombat(initCombat(st.character, st.world.codex, enemies, {
      maxLootTier: region.lootTier,
      region: region.level,
      ownedUniques: ownedUniqueIds(st),
      coinBonus: wp.coinBonus || 0,
      environment: generateEnvironment(terrain),
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
      const beat = await callNarrator(stateWithPlayer, msg);
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
    startCombat(enemies, { flavor: pendingCombat.desc || groupFlavor(enemies) });
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
      const beat = await callNarrator(next, msg);
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
      const beat = await callNarrator(looted, msg);
      const after = applyBeat(looted, beat);
      setState(recordTurn(looted, msg, after));
      if (beat.start_combat) setPendingEngage({ dir: beat.start_combat });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  const onCombatAct = (abilityId) => setCombat((c) => (c ? playerAct(c, abilityId, c.target) : c));
  const onCombatTalk = (intent) => setCombat((c) => (c ? playerTalk(c, intent, c.target) : c));
  const onCombatEnvironment = (id) => setCombat((c) => (c ? playerUseEnvironment(c, id, c.target) : c));
  const onCombatDraw = () => setCombat((c) => (c ? playerDrawWeapon(c) : c));
  const onCombatTarget = (idx) => setCombat((c) => (c ? setTarget(c, idx) : c));
  const onCombatEndTurn = () => setCombat((c) => (c ? endTurn(c) : c));
  const onCombatFlee = () => setCombat((c) => (c ? playerFlee(c) : c));

  // ----- Render flow -----

  if (!authChecked) return <CenteredLoader />;
  if (!user) return <AuthScreen />;
  if (__SOLITAIRE_MODE__ === "web" && !subChecked) return <CenteredLoader />;
  if (__SOLITAIRE_MODE__ === "web" && !subscribed) {
    return (
      <SubscriptionScreen
        email={user.email}
        onRecheck={handleRecheckSubscription}
        onSignOut={handleSignOut}
        busy={subBusy}
      />
    );
  }
  if (!campaignsLoaded || campaignBusy) return <CenteredLoader />;
  if (!currentCampaignId) {
    return (
      <CampaignsList
        campaigns={campaigns}
        onSelect={handleSelectCampaign}
        onNew={handleNewCampaign}
        onDelete={handleDeleteCampaign}
        onRename={handleRenameCampaign}
        onSignOut={__SOLITAIRE_MODE__ === "web" ? handleSignOut : undefined}
        busy={campaignBusy}
        error={campaignError}
      />
    );
  }

  // The run has ended — the player fell in an epic encounter. A memorial replaces
  // the game; the only way on is back to the campaigns list.
  if (state.ended) {
    return <GameOverScreen state={state} onExit={handleBackToCampaigns} />;
  }

  // A wired town building (poi.service) at the player's current tile, if any —
  // surfaces an "Enter" affordance to open its menu. Hidden during combat.
  const buildingHere = combat ? null : buildingForTile(getTile(state, state.world.currentTile.x, state.world.currentTile.y));
  const buildingOpenNow = buildingHere ? isBuildingOpen(buildingHere, state.time.hour) : false;

  return (
    <div style={{
      backgroundColor: colors.ink,
      height: "100dvh", width: "100%", maxWidth: "640px", margin: "0 auto",
      display: "flex", flexDirection: "column", position: "relative", overflow: "hidden",
    }}>
      <SceneBackdrop state={state} />
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
        <CompactHeader
          state={state}
          onMap={() => setMapOpen(true)}
          onMenu={() => setMenuOpen(true)}
          onParty={() => setPartyOpen(true)}
        />
        <VitalsStrip character={state.character} />
        <div ref={logRef} style={{ flex: 1, overflowY: "auto", padding: "14px 18px 10px 18px", WebkitOverflowScrolling: "touch" }}>
          {state.beats.map((b, i) => <BeatRender key={b.id} beat={b} onMenu={() => openBeatMenu(b, i)} />)}
          {loading && <LoadingDots />}
          {error && <ErrorBanner>{error}</ErrorBanner>}
          {campaignError && <ErrorBanner>{campaignError}</ErrorBanner>}
        </div>
        {pendingCombat && !combat && (
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
            }}>Fight</button>
            <button onClick={() => setPendingCombat(null)} style={{
              padding: "9px 12px", borderRadius: 12, backgroundColor: "transparent", color: "rgba(215,167,111,0.7)",
              border: `1px solid rgba(215,167,111,0.25)`, fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
            }}>Avoid</button>
          </div>
        )}
        {pendingEngage && !combat && (
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
        {pendingLoot && !combat && (
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
        {buildingHere && !shopTile && (
          <div className="fade-in" style={{
            margin: "0 12px 8px", padding: "11px 14px",
            backgroundColor: "rgba(20,29,29,0.8)", border: `1px solid rgba(215,167,111,0.4)`,
            borderRadius: 14, display: "flex", alignItems: "center", gap: "10px",
            boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "8px", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800, color: buildingOpenNow ? colors.gold : "rgba(215,167,111,0.55)", marginBottom: "2px" }}>
                {buildingHere.kind === "trader" ? "Trader" : buildingHere.kind === "smith" ? "Smith" : buildingHere.kind === "tavern" ? "Tavern" : buildingHere.kind === "gaol" ? "Gaol" : "Building"}
              </div>
              <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "14px", color: colors.parchmentLight, lineHeight: 1.3 }}>
                {buildingOpenNow
                  ? `${buildingHere.label} — ${(buildingHere.kind === "tavern" || buildingHere.kind === "gaol") ? "read the board." : "step up to the counter."}`
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
        <InputBar value={input} onChange={setInput} onSubmit={handleSubmit} loading={loading} />
      </div>

      {beatMenu && (
        <BeatActionSheet
          mode={beatMode}
          canRewindRewrite={beatMenu.turnK >= 0}
          loading={loading}
          rewriteText={rewriteText}
          editText={editText}
          onRewriteText={setRewriteText}
          onEditText={setEditText}
          onChooseRewrite={() => setBeatMode("rewrite")}
          onChooseEdit={() => setBeatMode("edit")}
          onRewind={handleRewindBeat}
          onSubmitRewrite={handleRewriteBeat}
          onSubmitEdit={handleEditBeat}
          onClose={closeBeatMenu}
        />
      )}

      {menuOpen && (
        <MenuSheet
          state={state}
          user={user}
          onClose={() => setMenuOpen(false)}
          onEquip={handleEquip}
          onUnequip={handleUnequip}
          onUse={handleUse}
          onReset={handleResetCampaign}
          onOpenCodex={() => { setMenuOpen(false); setCodexOpen(true); }}
          onBackToCampaigns={handleBackToCampaigns}
          onSignOut={__SOLITAIRE_MODE__ === "web" ? handleSignOut : undefined}
          onLinkEmail={__SOLITAIRE_MODE__ === "web" ? linkEmail : undefined}
        />
      )}
      {mapOpen && (
        <MapView
          state={state}
          onClose={() => setMapOpen(false)}
          onTravel={handleTravel}
          onSeekCombat={handleSeekCombat}
          loading={loading}
        />
      )}
      {codexOpen && (
        <CodexView state={state} onClose={() => setCodexOpen(false)} />
      )}
      {partyOpen && (
        <PartyView state={state} onDismiss={handleDismiss} onClose={() => setPartyOpen(false)} />
      )}
      {shopTile && (() => {
        const tile = getTile(state, shopTile.x, shopTile.y);
        const building = buildingForTile(tile);
        if (!building) return null;
        const key = `${shopTile.x},${shopTile.y}`;
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
              onRecruit={handleRecruit}
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
              onBuyRights={handleBuyRights}
              onClose={() => setShopTile(null)}
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
          onAct={onCombatAct}
          onTalk={onCombatTalk}
          onEnvironment={onCombatEnvironment}
          onDraw={onCombatDraw}
          onSetTarget={onCombatTarget}
          onEndTurn={onCombatEndTurn}
          onFlee={onCombatFlee}
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
    </div>
  );
}
