import React, { useState, useEffect, useRef } from "react";

import { STORAGE_KEY } from "./config.js";
import { TERRAINS } from "./data/terrains.js";
import { makeInitialState, migrateCodex } from "./data/initial-state.js";

import { storeGet, storeDel } from "./engine/storage.js";
import { callNarrator } from "$api";
import { onAuthChange, signOut, linkEmail, isSubscribed } from "$auth";
import { listCampaigns, loadCampaign, saveCampaign, deleteCampaign, renameCampaign } from "$campaigns";
import { applyBeat } from "./engine/beat.js";
import { equipItem, unequipItem } from "./engine/inventory.js";
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
import { colors } from "./components/tokens.js";
import { BeatRender } from "./components/beats/BeatRender.jsx";
import { MenuSheet } from "./components/MenuSheet.jsx";
import { MapView } from "./components/MapView.jsx";
import { CodexView } from "./components/CodexView.jsx";
import { AuthScreen } from "./components/AuthScreen.jsx";
import { SubscriptionScreen } from "./components/SubscriptionScreen.jsx";
import { CampaignsList } from "./components/CampaignsList.jsx";
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
  const [hydrated, setHydrated] = useState(false);
  const logRef = useRef(null);

  // Combat: `combat` holds the active turn-state (null = not fighting);
  // `pendingCombat` is a hostile encounter offering a fight before it starts.
  const [combat, setCombat] = useState(null);
  const [pendingCombat, setPendingCombat] = useState(null);
  const [pendingLoot, setPendingLoot] = useState(null); // spoils to deliberately Search
  const combatCtxRef = useRef(null);

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
    if (!window.confirm("Delete this campaign? This cannot be undone.")) return;
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
      const beat = await callNarrator(stateWithPlayer, `[PLAYER ACTION] ${action}`);
      const next = applyBeat(stateWithPlayer, beat);
      setState(next);
      // An explicit strike in the fiction hands off to the turn-based engine.
      if (beat.start_combat) startCombatFromDirective(beat.start_combat, next);
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
    setError(null);
    setLoading(true);
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

    try {
      const beat = await callNarrator(stateWithPlayer, fullMsg);
      if (!beat.minutes_passed || Math.abs(beat.minutes_passed - totalMins) > totalMins * 0.5) {
        beat.minutes_passed = totalMins;
      }
      setState((s) => {
        let next = applyBeat(s, beat, {
          travelFrom: fromName,
          travelTo: toName,
          travelToCoords: { x: dest.x, y: dest.y },
        });
        // Multi-tile travel: mark intermediate path tiles as visited and refresh
        // sight from each so the player's seen area expands along the route.
        if (hexes > 1) {
          const newTiles = { ...next.world.tiles };
          let newSeen = next.world.seen;
          for (let i = 1; i < path.length - 1; i++) {
            const p = path[i];
            const k = `${p.x},${p.y}`;
            if (!newTiles[k]) newTiles[k] = getTile(s, p.x, p.y);
            newSeen = computeSightFrom(p.x, p.y, newSeen);
          }
          next = { ...next, world: { ...next.world, tiles: newTiles, seen: newSeen } };
        }
        // Vista: arriving at a tile with vistaRadius reveals a wide hex.
        const destTileNow = getTile(s, dest.x, dest.y);
        if (destTileNow?.vistaRadius && destTileNow.vistaRadius > 0) {
          const wider = computeSightFromRadius(dest.x, dest.y, destTileNow.vistaRadius, next.world.seen);
          next = { ...next, world: { ...next.world, seen: wider } };
        }
        return next;
      });
      // A hostile encounter along the way offers a fight once the player lands.
      if (pathEnc && pathEnc.encounter.posture === "hostile") {
        setPendingCombat(pathEnc.encounter);
      }
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleResetCampaign() {
    if (!window.confirm("Reset this campaign to the beginning? Your current progress here will be erased.")) return;
    setState(makeInitialState());
    setMenuOpen(false);
  }

  function handleEquip(itemId) { setState((s) => equipItem(s, itemId)); }
  function handleUnequip(itemId) { setState((s) => unequipItem(s, itemId)); }

  // ----- Combat handlers -----

  function startCombat(enemies, context, extraOpts = {}, st = state) {
    if (!enemies || enemies.length === 0) return;
    combatCtxRef.current = context || { flavor: enemies[0].name };
    setMenuOpen(false); setMapOpen(false); setCodexOpen(false);
    setPendingCombat(null);
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
      else enemies.push(...generateEnemyGroup(f.kind || "bandits", { power: region.power, maxTier: f.tier || region.enemyTier }));
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
      setState(next);
      if (beat.start_combat) startCombatFromDirective(beat.start_combat, next);
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

  async function handleResolveCombat() {
    if (!combat) return;
    const cs = combat;
    const ctx = combatCtxRef.current || {};
    const next = applyCombatResult(state, cs, ctx);
    setState(next);
    setCombat(null);
    combatCtxRef.current = null;
    // Spoils aren't auto-taken — offer a deliberate Search the fallen.
    if (next.pendingLoot) setPendingLoot({ ...next.pendingLoot, lethal: cs.lethal });

    // Defeat isn't game-over — hand the aftermath to the narrator.
    if (cs.phase === "defeat") {
      setError(null);
      setLoading(true);
      try {
        const place = currentLocationName(next);
        const wasLethal = cs.lethal || cs.escalated;
        const msg = `[DEFEATED] You were beaten ${wasLethal ? "down with weapons drawn" : "senseless in a bare-knuckle brawl"} by ${ctx.flavor || "your foe"} at ${place} and lost consciousness — you are NOT dead. ${wasLethal ? "This was a bloody, weapons-out fight, so the aftermath can be harsher (grave wounds, captured, left for dead but breathing)." : "It was only fists, so this is a humbling, not a killing — expect to be thrown out, robbed of loose coin, or hauled off to sober up."} Decide a fitting non-lethal aftermath for who beat you and where: robbed (inventory_changes), hauled to the watch/jailed, thrown out, or captured and moved (tile_move). Apply wounds as conditions and location_update if the place changed. The player wakes to face what's left; death-and-reload is not the goal.`;
        const beat = await callNarrator(next, msg);
        const after = applyBeat(next, beat);
        setState(after);
        if (beat.start_combat) startCombatFromDirective(beat.start_combat, after);
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
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
      setState(after);
      if (beat.start_combat) startCombatFromDirective(beat.start_combat, after);
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
        />
        <VitalsStrip character={state.character} />
        <div ref={logRef} style={{ flex: 1, overflowY: "auto", padding: "14px 18px 10px 18px", WebkitOverflowScrolling: "touch" }}>
          {state.beats.map((b) => <BeatRender key={b.id} beat={b} />)}
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
        <InputBar value={input} onChange={setInput} onSubmit={handleSubmit} loading={loading} />
      </div>

      {menuOpen && (
        <MenuSheet
          state={state}
          user={user}
          onClose={() => setMenuOpen(false)}
          onEquip={handleEquip}
          onUnequip={handleUnequip}
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
    </div>
  );
}
