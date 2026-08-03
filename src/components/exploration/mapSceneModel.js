import { poiPlaceName } from "../../engine/location.js";
import { skyAt, wrapDay } from "../../engine/daylight.js";
import { isNight } from "../../engine/light.js";
import { buildingForService } from "../../data/town.js";
import { poiIconKeyForTile } from "../../data/poi-icons.js";
import { siteKnowledgeGrade } from "../../engine/world-sighting.js";
import { ATLAS_ROUTES, ATLAS_WALLS, ATLAS_WATERWAYS, buildAtlasPlaces } from "./mapAtlasModel.js";
import { lodShowsPlace, lodShowsVectorRoutes, lodTier } from "./mapLod.js";

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

// What the party can currently claim about a generated site it has not entered:
// "rumoured" carries a name, "silhouette" only a shape, "" nothing at all.
function worldSiteKnowledge(cell, explored = wasExplored(cell)) {
  const poi = cell.tile?.poi;
  if (!poi) return null;
  if (poi.type !== "hidden") return explored ? { grade: "discovered" } : null;
  const generated = poi.generated;
  if (!generated) return null;
  const grade = siteKnowledgeGrade(generated.sighting, { distance: cell.distance, explored });
  return grade ? { grade, generated } : null;
}

function worldPoiName(cell, knowledge = worldSiteKnowledge(cell)) {
  if (!knowledge) return "";
  if (knowledge.grade === "discovered") return poiPlaceName(cell.tile?.poi) || "";
  return knowledge.grade === "rumoured" ? (knowledge.generated.name || "") : "";
}

function worldPoiIcon(cell, knowledge = worldSiteKnowledge(cell)) {
  if (!knowledge) return "";
  if (knowledge.grade !== "discovered") return knowledge.generated.sighting?.mapIcon || "";
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

const NOON_MINUTE = 12 * 60;

export function buildWorldMapScene({ state, model, selection, journey, marchFrame = null, trackedCharacter = null, skyMinutes = NOON_MINUTE }) {
  const cells = model.renderViewport || model.viewport || [];
  const exploredKeys = new Set(cells.filter(wasExplored).map((cell) => cell.key));
  const stride = Math.max(1, Math.round(model.stride) || 1);
  const tier = lodTier(stride);
  // Once hexes stop being individually legible, authored geography carries the
  // map instead: continuous road and river ribbons in place of sampled road
  // hexes, and named places that no sample would have landed on.
  const vector = lodShowsVectorRoutes(tier);
  // The hour the map is lit by, which during a march is ahead of the clock the
  // rest of the game reads: `state.time` only moves once the travel beat lands.
  const lit = wrapDay(skyMinutes);
  return {
    version: 1,
    mode: "world",
    stride,
    tier,
    origin: { x: model.origin.x, y: model.origin.y },
    // Walls last, so a road reaching a gate passes under the wall rather than over it.
    ribbons: vector ? [...ATLAS_WATERWAYS, ...ATLAS_ROUTES, ...ATLAS_WALLS] : [],
    places: vector && state
      ? buildAtlasPlaces(state).filter((place) => lodShowsPlace(tier, place))
      : [],
    current_key: model.current.key,
    selected_key: selection?.key || "",
    party_march: marchFrame,
    tracked_character: renderTrackedCharacter(trackedCharacter, cells),
    sky_minutes: lit,
    sky: skyAt(lit),
    // Fog and the stage's own chrome still want the plain yes/no, and it comes
    // from the survival layer so the veil can never disagree with the grade.
    night: isNight({ hour: Math.floor(lit / 60) }),
    route: (journey?.legPath || []).map((point) => {
      const key = coordinateKey(point);
      return exploredKeys.has(key) ? key : null;
    }),
    cells: cells.map((cell) => {
      const explored = wasExplored(cell);
      const visible = !!cell.visible;
      const knowledge = worldSiteKnowledge(cell, explored);
      const poiName = worldPoiName(cell, knowledge);
      return {
        key: cell.key,
        x: cell.x,
        y: cell.y,
        col: cell.col,
        row: cell.row,
        overscan: !!cell.overscan,
        // Base geography is public from the start; exploration still gates POIs,
        // routes, entities, interaction, and the brighter mapped treatment.
        terrain: cell.tile?.terrain || "impassable",
        explored,
        seen: !!cell.seen,
        visible,
        visibility: visible ? "visible" : (explored ? "remembered" : "unknown"),
        visited: !!cell.visited,
        interactive: !cell.overscan && explored && !!cell.passable && !cell.current,
        // Ambient landscape detail. Carried on the scene so the hex inspector and
        // the travel log have something true to say about ground that holds no
        // site; the canvas does not draw it, since ambient density belongs with
        // the zoom tiers rather than at one fixed scale.
        scenery: explored ? (cell.tile?.scenery || []).map((entry) => entry.label) : [],
        poi_name: poiName,
        poi_icon: worldPoiIcon(cell, knowledge),
        poi_knowledge: knowledge?.grade || "",
        poi_market_tier: knowledge?.grade === "discovered" ? (cell.tile?.poi?.marketTier || "") : "",
        quest: !!cell.quest,
        marker_color: cell.quest ? "#f8d56a" : "#e9ae55",
      };
    }),
  };
}
