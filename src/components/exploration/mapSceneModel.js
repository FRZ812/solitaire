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
// Hexes the party has actually stood on. The map is charted everywhere, so this
// no longer decides what may be drawn — it is only the warm tint that makes the
// atlas a record of where the journey has been.
function wasWalked(cell) {
  return !!cell.visited;
}

// What the party can claim about a site it has not entered: "rumoured" carries a
// name, "silhouette" only a shape, "" nothing at all — which now means only the
// places that keep themselves off the map.
function worldSiteKnowledge(cell) {
  const poi = cell.tile?.poi;
  if (!poi) return null;
  if (poi.type !== "hidden") return { grade: "discovered" };
  const generated = poi.generated;
  if (!generated) return null;
  const grade = siteKnowledgeGrade(generated.sighting);
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
  // An exact fix is drawn on the hex it names, so it needs that hex on screen.
  // An uncertain one is a circle over open country and does not.
  if (exact && !cells.some((cell) => cell.key === coordinateKey(pos))) return null;
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
  const cellKeys = new Set(cells.map((cell) => cell.key));
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
    // The stage's own chrome still wants the plain yes/no, and it comes from the
    // survival layer so the sky can never disagree with the clock.
    night: isNight({ hour: Math.floor(lit / 60) }),
    // The whole line the party intends to walk, including the part that runs off
    // past anywhere they have been. Not knowing what is out there was never a
    // reason to be unable to point at it: a course set for a town four days away
    // is still a course, and drawing half of it made the map look broken.
    // Segments break only where a hex falls outside the drawn window.
    route: (journey?.legPath || []).map((point) => {
      const key = coordinateKey(point);
      return cellKeys.has(key) ? key : null;
    }),
    cells: cells.map((cell) => {
      const walked = wasWalked(cell);
      const knowledge = worldSiteKnowledge(cell);
      const poiName = worldPoiName(cell, knowledge);
      return {
        key: cell.key,
        x: cell.x,
        y: cell.y,
        col: cell.col,
        row: cell.row,
        overscan: !!cell.overscan,
        // The continent is charted. Terrain, routes, sites and the scenery along
        // them are all public; what the party has to earn is not the sight of a
        // place but the visit to it, which is what `visited` still records.
        terrain: cell.tile?.terrain || "impassable",
        explored: true,
        seen: true,
        visible: true,
        visibility: walked ? "walked" : "charted",
        visited: walked,
        interactive: !cell.overscan && !!cell.passable && !cell.current,
        // Ambient landscape detail: barns, milestones, fords, sheepfolds. This is
        // what keeps open country from reading as empty, so it travels with every
        // charted cell rather than only the ones already walked.
        scenery: (cell.tile?.scenery || []).map((entry) => entry.label),
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
