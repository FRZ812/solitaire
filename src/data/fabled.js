// Continental campaign goals known through common legend. Unlike the retired
// blank-world setup these are real stable coordinates, though reaching one is a
// journey of hundreds of six-kilometre travel cells through fixed danger bands.

import { landmarksByKnowledge } from "./continent.js";

export const FABLED = Object.fromEntries(
  landmarksByKnowledge("legend").map((landmark) => [landmark.id, {
    id: landmark.id,
    name: landmark.name,
    kind: landmark.kind,
    coord: { ...landmark.coord },
    regionId: landmark.regionId,
    direction: landmark.direction,
    description: landmark.description,
  }]),
);

export function summarizeFabled() {
  return Object.values(FABLED)
    .map((f) => `${f.name} (${f.kind}, ${f.direction})`)
    .join("; ");
}

export const FABLED_BY_COORD = {};
for (const f of Object.values(FABLED)) {
  FABLED_BY_COORD[`${f.coord.x},${f.coord.y}`] = f;
}
