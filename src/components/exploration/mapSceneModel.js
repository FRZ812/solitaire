import { poiPlaceName } from "../../engine/location.js";
import { buildingForService } from "../../data/town.js";
import { poiIconKeyForTile } from "../../data/poi-icons.js";

function coordinateKey(point) {
  return `${point.x},${point.y}`;
}
function worldPoiName(cell) {
  if (!cell.seen || cell.tile?.poi?.type === "hidden") return "";
  return poiPlaceName(cell.tile?.poi) || "";
}

function worldPoiIcon(cell) {
  if (!worldPoiName(cell)) return "";
  const serviceIcon = buildingForService(cell.tile?.poi?.service)?.icon || null;
  return poiIconKeyForTile(cell.tile, serviceIcon) || "";
}

export function buildWorldMapScene({ model, selection, journey, night = false }) {
  return {
    version: 1,
    mode: "world",
    origin: { x: model.origin.x, y: model.origin.y },
    current_key: model.current.key,
    selected_key: selection?.key || "",
    night,
    route: (journey?.legPath || []).map(coordinateKey),
    cells: model.viewport.map((cell) => ({
      key: cell.key,
      x: cell.x,
      y: cell.y,
      col: cell.col,
      row: cell.row,
      // Unknown geography is normalized before it reaches any renderer. Fog
      // can never disclose a hidden road, river, or settlement.
      terrain: cell.seen ? (cell.tile?.terrain || "impassable") : "impassable",
      seen: !!cell.seen,
      visited: !!cell.visited,
      interactive: !!cell.seen && !!cell.passable && !cell.current,
      poi_name: worldPoiName(cell),
      poi_icon: worldPoiIcon(cell),
      poi_market_tier: worldPoiName(cell) ? (cell.tile?.poi?.marketTier || "") : "",
      quest: !!cell.quest,
      marker_color: cell.quest ? "#f8d56a" : "#e9ae55",
    })),
  };
}
