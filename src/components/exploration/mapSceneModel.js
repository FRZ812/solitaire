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

export function buildWorldMapScene({ model, selection, journey, night = false }) {
  return {
    version: 1,
    mode: "world",
    origin: { x: model.origin.x, y: model.origin.y },
    current_key: model.current.key,
    selected_key: selection?.key || "",
    night,
    route: (journey?.legPath || []).map(coordinateKey),
    cells: model.viewport.map((cell) => {
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
