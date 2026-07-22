import { FLY_REVEAL_RADIUS, SIGHT_RADIUS } from "../config.js";
import { sightRadius } from "./light.js";
import { computeSightFromRadius, getTile, persistedTileDelta } from "./world.js";

export function applyTravelPosition(base, travel) {
  let next = {
    ...base,
    world: {
      ...base.world,
      currentTile: { x: travel.dest.x, y: travel.dest.y },
    },
  };
  const path = travel.path || [];
  const radius = travel.mode === "fly" ? FLY_REVEAL_RADIUS : sightRadius(next);

  if (path.length > 1) {
    const tiles = { ...next.world.tiles };
    let seen = next.world.seen;
    for (let index = 1; index < path.length; index += 1) {
      const coord = path[index];
      const key = `${coord.x},${coord.y}`;
      if (!tiles[key]) tiles[key] = persistedTileDelta(getTile(base, coord.x, coord.y));
      seen = computeSightFromRadius(coord.x, coord.y, radius, seen);
    }
    next = { ...next, world: { ...next.world, tiles, seen } };
  }

  const destinationTile = getTile(base, travel.dest.x, travel.dest.y);
  if (destinationTile?.vistaRadius && destinationTile.vistaRadius > 0) {
    const vistaRadius = radius >= SIGHT_RADIUS ? destinationTile.vistaRadius : radius;
    const seen = computeSightFromRadius(
      travel.dest.x,
      travel.dest.y,
      vistaRadius,
      next.world.seen,
    );
    next = { ...next, world: { ...next.world, seen } };
  }

  return next;
}
