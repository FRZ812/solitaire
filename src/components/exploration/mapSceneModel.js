import { poiPlaceName } from "../../engine/location.js";
import { PLACE_VIEW_COLS, PLACE_VIEW_ROWS } from "./placeModel.js";

function coordinateKey(point) {
  return `${point.x},${point.y}`;
}

function worldPoiName(cell) {
  if (!cell.seen || cell.tile?.poi?.type === "hidden") return "";
  return poiPlaceName(cell.tile?.poi) || "";
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
      quest: !!cell.quest,
      marker_color: cell.quest ? "#f8d56a" : "#e9ae55",
    })),
  };
}

export function buildCityMapScene({ model, current, selected, districtColors, night = false }) {
  const currentPoint = model.layout[current.id];
  const selectedPoint = selected ? model.layout[selected.id] : null;
  return {
    version: 1,
    mode: "city",
    columns: PLACE_VIEW_COLS,
    rows: PLACE_VIEW_ROWS,
    current_key: currentPoint ? `${currentPoint.x},${currentPoint.y}` : "",
    selected_key: selectedPoint ? `${selectedPoint.x},${selectedPoint.y}` : "",
    night,
    route: model.routeCellKeys || [],
    cells: model.viewport.map((cell) => ({
      key: cell.key,
      x: cell.x,
      y: cell.y,
      col: cell.col,
      row: cell.row,
      surface: cell.surface,
      seen: true,
      visited: true,
      interactive: !!cell.node && !cell.current,
      poi_name: cell.node?.name || "",
      quest: false,
      marker_color: districtColors[cell.node?.district] || "#e9ae55",
    })),
  };
}
