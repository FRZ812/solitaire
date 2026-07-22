import { REALMS } from "../../data/continent.js";
import { realmIdAt } from "../../engine/world-generation.js";
import { clampTravelMapZoom } from "./travelMapModel.js";

function coordinateFromKey(key) {
  const [x, y] = String(key).split(",").map(Number);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function mappedCoordinates(state) {
  const keys = new Set();
  for (const [key, seen] of Object.entries(state.world?.seen || {})) {
    if (seen) keys.add(key);
  }
  for (const key of Object.keys(state.world?.tiles || {})) keys.add(key);
  const party = state.world?.currentTile;
  if (party) keys.add(`${party.x},${party.y}`);
  return [...keys].map(coordinateFromKey).filter(Boolean);
}

export function buildRegionSelectorModel(state, { selectedCoord = null } = {}) {
  const seed = state.world?.seed;
  const party = state.world?.currentTile || { x: 0, y: 0 };
  const currentRealmId = realmIdAt(party.x, party.y, seed);
  const inspected = selectedCoord || party;
  const selectedRealmId = realmIdAt(inspected.x, inspected.y, seed);
  const chartedByRealm = new Map();
  for (const coord of mappedCoordinates(state)) {
    const realmId = realmIdAt(coord.x, coord.y, seed);
    chartedByRealm.set(realmId, (chartedByRealm.get(realmId) || 0) + 1);
  }

  const entries = REALMS.map((realm) => {
    const chartedHexes = chartedByRealm.get(realm.id) || 0;
    const current = realm.id === currentRealmId;
    const known = current || chartedHexes > 0;
    return {
      id: realm.id,
      direction: realm.direction,
      name: realm.name,
      shortName: realm.shortName,
      biomeId: realm.biomeId,
      biomeName: realm.biomeName,
      center: { x: realm.center.x, y: realm.center.y },
      description: known ? realm.description : "Beyond the party's mapped knowledge.",
      current,
      selected: realm.id === selectedRealmId,
      known,
      chartedHexes,
      capitalName: known ? realm.capital?.name || null : null,
      factionName: known ? realm.faction?.name || null : null,
    };
  });

  return { currentRealmId, selectedRealmId, entries };
}

export function regionCameraTarget(entry, cameraHistory = {}) {
  const remembered = cameraHistory?.[entry.id];
  if (remembered && Number.isFinite(remembered.x) && Number.isFinite(remembered.y)) {
    return {
      x: remembered.x,
      y: remembered.y,
      zoom: clampTravelMapZoom(remembered.zoom ?? 1),
    };
  }
  return { x: entry.center.x, y: entry.center.y, zoom: 1 };
}
