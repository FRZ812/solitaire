// Stable places known by ordinary reputation. They are visible in the atlas
// before being visited, but fog still hides the intervening terrain.

import { landmarksByKnowledge } from "./continent.js";

export const RUMORED = {};
for (const landmark of landmarksByKnowledge("rumor")) {
  RUMORED[`${landmark.coord.x},${landmark.coord.y}`] = {
    id: landmark.id,
    name: landmark.name,
    kind: landmark.kind,
    regionId: landmark.regionId,
    direction: landmark.direction,
    description: landmark.description,
  };
}

export function getRumored(x, y) {
  return RUMORED[`${x},${y}`] || null;
}
