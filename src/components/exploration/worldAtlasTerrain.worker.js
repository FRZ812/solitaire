import { buildAtlas3dTerrainData } from "./worldAtlas3dModel.js";

self.onmessage = (event) => {
  const terrain = buildAtlas3dTerrainData(event.data.seed, event.data.stride);
  self.postMessage(terrain, [
    terrain.positions.buffer,
    terrain.colors.buffer,
    terrain.coastal.buffer,
    terrain.ao.buffer,
    terrain.shore.buffer,
    terrain.indices.buffer,
    terrain.trees.buffer,
  ]);
};
