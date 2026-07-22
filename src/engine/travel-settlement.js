import { itemTemplate } from "../data/catalog.js";
import { TERRAINS } from "../data/terrains.js";
import { applyBeat } from "./beat.js";
import { poiPlaceName } from "./location.js";
import { mergeMemoryBank } from "./memory.js";
import { storyFromResponse } from "./narrative-sequence.js";
import { applyTravelPosition } from "./travel-position.js";
import { getTile } from "./world.js";

export function publicLocationPresentation(tile, coord = null) {
  const hidden = tile?.poi?.type === "hidden";
  const terrain = TERRAINS[tile?.terrain]?.label || "Wilderness";
  const placeName = hidden ? null : poiPlaceName(tile?.poi);
  const district = hidden
    ? null
    : tile?.districtName || tile?.district || tile?.poi?.districtName || tile?.poi?.parentName || null;
  return {
    hidden,
    terrain,
    name: placeName || (coord ? `${terrain} (${coord.x},${coord.y})` : terrain),
    title: placeName || terrain,
    district,
    description: hidden ? (TERRAINS[tile?.terrain]?.flavor || null) : (tile?.poi?.description || TERRAINS[tile?.terrain]?.flavor || null),
    marketTier: hidden ? null : tile?.poi?.marketTier || null,
  };
}

export function publicTravelLocationName(tile, coord = null) {
  return publicLocationPresentation(tile, coord).name;
}

export function authoritativeTravelDiscovery(tile) {
  const poi = tile?.poi;
  if (poi?.type !== "hidden") return null;
  const generated = poi.generated;
  const name = generated?.name || poi.name || poi.partName || null;
  const poiType = generated?.poiType || poi.revealType || poi.poiType || poi.poi_type || "landmark";
  if (!name) return null;
  return {
    name,
    poi_type: poiType,
    description: generated?.description || poi.description || `You discover ${name}.`,
  };
}

export function travelDiscoveryFromRevealedTile(tile) {
  const poi = tile?.poi;
  const name = poi?.type !== "hidden" ? poiPlaceName(poi) : null;
  if (!name) return null;
  return {
    name,
    poi_type: poi.type || "landmark",
    description: poi.description || `You discover ${name}.`,
  };
}

function deterministicTravelDiscovery(state, travel) {
  if (travel?.discovery) return travel.discovery;
  const tile = getTile(state, travel.dest.x, travel.dest.y);
  return authoritativeTravelDiscovery(tile);
}

export function deterministicTravelBeat(state, travel) {
  const discovery = deterministicTravelDiscovery(state, travel);
  return {
    minutes_passed: travel.totalMins,
    ...(discovery ? { tile_discovery: discovery } : {}),
  };
}

// Apply the complete authoritative journey exactly once: elapsed time, survival,
// destination materialization, sight/reveal, and deterministic ancient-site cache.
export function applyTravelArrival(base, beat, travel) {
  const travelBeat = { ...beat, minutes_passed: travel.totalMins };
  let next = applyBeat(base, travelBeat, {
    travelFrom: travel.fromName,
    travelTo: travel.toName,
    travelToCoords: { x: travel.dest.x, y: travel.dest.y },
  });
  next = applyTravelPosition(next, travel);
  const destTile = getTile(base, travel.dest.x, travel.dest.y);

  const cacheKey = `${travel.dest.x},${travel.dest.y}`;
  const looted = next.world.lootedCaches || {};
  const tmpl = destTile?.cache?.itemId ? itemTemplate(destTile.cache.itemId) : null;
  if (tmpl && !looted[cacheKey]) {
    const runeId = destTile.cache.itemId;
    const carried = next.character.inventory.carried.map((entry) => ({ ...entry }));
    const existing = carried.find((entry) => entry.itemId === runeId);
    if (existing) existing.quantity += 1;
    else carried.push({ itemId: runeId, quantity: 1 });
    const now = Date.now();
    next = {
      ...next,
      beats: [
        ...next.beats,
        { id: `cache${now}`, type: "narration", content: `Among the old stones something waits, left for whoever should find it: a ${tmpl.name}. You take it.` },
        { id: `cachei${now}`, type: "inventory_delta", lines: [`+1× ${tmpl.name}`] },
      ],
      character: { ...next.character, inventory: { ...next.character.inventory, carried } },
      world: {
        ...next.world,
        codex: { ...next.world.codex, items: { ...next.world.codex.items, [runeId]: tmpl } },
        lootedCaches: { ...looted, [cacheKey]: true },
      },
    };
  }
  return next;
}

// Merge spell/mount costs prepared before narration into the latest live state.
// This runs once, immediately before canonical settlement; narration never calls it.
export function preparedTravelDelta(base, prepared) {
  if (!base || !prepared) return {};
  const delta = {
    playerResolve: (prepared.character?.resolve ?? 0) - (base.character?.resolve ?? 0),
    characters: {},
    aerialSightings: {},
  };

  const baseCharacters = base.world?.codex?.characters || {};
  for (const [id, after] of Object.entries(prepared.world?.codex?.characters || {})) {
    const before = baseCharacters[id];
    if (!before) continue;
    const characterDelta = {};
    const resolve = (after.resolve ?? 0) - (before.resolve ?? 0);
    if (resolve) characterDelta.resolve = resolve;
    const needs = {};
    for (const key of ["hunger", "thirst", "sleep"]) {
      const value = (after.needs?.[key] ?? before.needs?.[key] ?? 0)
        - (before.needs?.[key] ?? 0);
      if (value) needs[key] = value;
    }
    if (Object.keys(needs).length) characterDelta.needs = needs;
    if (Object.keys(characterDelta).length) delta.characters[id] = characterDelta;
  }

  const baseTiles = base.world?.tiles || {};
  for (const [key, after] of Object.entries(prepared.world?.tiles || {})) {
    const before = baseTiles[key]?.aerialSighting;
    const sighting = after?.aerialSighting;
    if (!sighting || (before?.day === sighting.day && before?.hour === sighting.hour)) continue;
    delta.aerialSightings[key] = { ...sighting };
  }
  return delta;
}

export function applyPreparedTravelDelta(current, delta = {}) {
  let character = current.character;
  if (delta.playerResolve) {
    character = {
      ...character,
      resolve: Math.max(0, (character?.resolve ?? 0) + delta.playerResolve),
    };
  }

  let characters = current.world?.codex?.characters || {};
  let charactersTouched = false;
  for (const [id, change] of Object.entries(delta.characters || {})) {
    const live = characters[id];
    if (!live) continue;
    let next = live;
    if (change.resolve) {
      next = { ...next, resolve: Math.max(0, (next.resolve ?? 0) + change.resolve) };
    }
    if (change.needs) {
      const needs = { ...(next.needs || {}) };
      for (const [key, value] of Object.entries(change.needs)) {
        needs[key] = Math.max(0, Math.min(100, (needs[key] ?? 0) + value));
      }
      next = { ...next, needs };
    }
    if (next !== live) {
      if (!charactersTouched) characters = { ...characters };
      characters[id] = next;
      charactersTouched = true;
    }
  }

  let tiles = current.world?.tiles || {};
  let tilesTouched = false;
  for (const [key, sighting] of Object.entries(delta.aerialSightings || {})) {
    if (!tilesTouched) tiles = { ...tiles };
    tiles[key] = { ...(tiles[key] || {}), aerialSighting: { ...sighting } };
    tilesTouched = true;
  }

  const codex = charactersTouched
    ? { ...current.world.codex, characters }
    : current.world.codex;
  const world = (charactersTouched || tilesTouched)
    ? { ...current.world, codex, tiles }
    : current.world;
  return { ...current, character, world };
}

export function rebasePreparedTravelState(current, base, prepared) {
  if (!base || !prepared) return prepared || current;
  const rebased = applyPreparedTravelDelta(current, preparedTravelDelta(base, prepared));
  const preparedBeat = prepared.beats?.[prepared.beats.length - 1];
  const beats = preparedBeat && !(rebased.beats || []).some((beat) => beat.id === preparedBeat.id)
    ? [...(rebased.beats || []), preparedBeat]
    : rebased.beats;
  return { ...rebased, beats };
}

export function prepareTravelSettlement(current, base, prepared, travel) {
  const preparedDelta = preparedTravelDelta(base, prepared);
  const preparedLiveState = rebasePreparedTravelState(current, base, prepared);
  const checkpointBase = {
    ...base,
    // Rewrites keep the player's travel bubble queued but restore every mechanic,
    // cost, clock, and world field to its true departure value.
    beats: preparedLiveState.beats,
  };
  return {
    checkpointBase,
    preparedDelta,
    state: applyTravelArrival(preparedLiveState, deterministicTravelBeat(preparedLiveState, travel), travel),
  };
}

export function replayTravelSettlement(base, travel) {
  const prepared = applyPreparedTravelDelta(base, travel?.preparedDelta);
  return applyTravelArrival(prepared, deterministicTravelBeat(prepared, travel), travel);
}

// Travel narration is presentation, not a second mechanics transaction. The
// deterministic journey has already settled by the time this runs.
export function applyTravelNarrationPresentation(state, beat) {
  const story = storyFromResponse(beat).filter((item) => (
    item.type === "beat" ? !!item.text : !!item.name && !!item.line
  ));
  const stamp = Date.now();
  const storyBeats = story.map((item, index) => {
    const shared = {
      thinking: index === 0 ? (beat._thinking || null) : null,
      model: index === 0 ? (beat._model || null) : null,
      truncated: index === story.length - 1 && !!beat._truncated,
    };
    return item.type === "beat"
      ? { id: `n${stamp}-${index}`, type: "narration", content: item.text, ...shared }
      : { id: `d${stamp}-${index}`, type: "dialogue", name: item.name, line: item.line, ...shared };
  });
  const apiHistory = [...(state.apiHistory || [])];
  if (beat._userMsg) apiHistory.push({ role: "user", content: beat._userMsg });
  if (beat._raw) apiHistory.push({ role: "assistant", content: beat._raw });
  return {
    ...state,
    beats: [...(state.beats || []), ...storyBeats],
    apiHistory,
    memories: mergeMemoryBank(state.memories, beat._memories),
  };
}
