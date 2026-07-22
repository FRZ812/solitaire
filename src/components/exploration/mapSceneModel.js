import { poiPlaceName } from "../../engine/location.js";
import { buildingForService } from "../../data/town.js";
import { poiIconKeyForTile } from "../../data/poi-icons.js";

function coordinateKey(point) {
  return `${point.x},${point.y}`;
}
function wasExplored(cell) {
  // `seen` is the accumulated sight history, while `visited` is the durable
  // record of hexes the party actually crossed. Treat either as mapped so a
  // visited tile can never fall back under black fog if an older save has an
  // incomplete sight set.
  return !!cell.explored || !!cell.visible || !!cell.seen || !!cell.visited;
}

function worldPoiName(cell, explored = wasExplored(cell)) {
  if (!explored || cell.tile?.poi?.type === "hidden") return "";
  return poiPlaceName(cell.tile?.poi) || "";
}

function worldPoiIcon(cell, poiName = worldPoiName(cell)) {
  if (!poiName) return "";
  const serviceIcon = buildingForService(cell.tile?.poi?.service)?.icon || null;
  return poiIconKeyForTile(cell.tile, serviceIcon) || "";
}

function renderTrackedCharacter(trackedCharacter, cells) {
  const pos = trackedCharacter?.pos;
  if (!Number.isFinite(pos?.x) || !Number.isFinite(pos?.y)) return null;
  const exact = pos.exact === true;
  const trackedCell = cells.find((cell) => cell.key === coordinateKey(pos));
  if (exact && (!trackedCell || !wasExplored(trackedCell))) return null;
  return {
    id: String(trackedCharacter.id || ""),
    name: String(trackedCharacter.name || "Tracked lead"),
    pos: { x: pos.x, y: pos.y },
    exact,
    uncertainty_radius: exact ? 0 : Math.max(2, Number(pos.uncertaintyRadius) || 4),
  };
}

export function buildWorldMapScene({ model, selection, journey, marchFrame = null, trackedCharacter = null, night = false }) {
  const cells = model.viewport || [];
  const exploredKeys = new Set(cells.filter(wasExplored).map((cell) => cell.key));
  return {
    version: 1,
    mode: "world",
    origin: { x: model.origin.x, y: model.origin.y },
    current_key: model.current.key,
    selected_key: selection?.key || "",
    party_march: marchFrame,
    tracked_character: renderTrackedCharacter(trackedCharacter, cells),
    night,
    route: (journey?.legPath || []).map((point) => {
      const key = coordinateKey(point);
      return exploredKeys.has(key) ? key : null;
    }),
    cells: cells.map((cell) => {
      const explored = wasExplored(cell);
      const visible = !!cell.visible;
      const poiName = worldPoiName(cell, explored);
      return {
        key: cell.key,
        x: cell.x,
        y: cell.y,
        col: cell.col,
        row: cell.row,
        // Unknown geography is normalized before it reaches any renderer. Fog
        // can never disclose a hidden road, river, or settlement.
        terrain: explored ? (cell.tile?.terrain || "impassable") : "impassable",
        explored,
        seen: !!cell.seen,
        visible,
        visibility: visible ? "visible" : (explored ? "remembered" : "unknown"),
        visited: !!cell.visited,
        interactive: explored && !!cell.passable && !cell.current,
        poi_name: poiName,
        poi_icon: worldPoiIcon(cell, poiName),
        poi_market_tier: poiName ? (cell.tile?.poi?.marketTier || "") : "",
        quest: !!cell.quest,
        marker_color: cell.quest ? "#f8d56a" : "#e9ae55",
      };
    }),
  };
}
