// Legacy handcrafted river overlays. Avarra's continental Whitewend, Tannic,
// Bannerflow, and lakes now live in data/continent.js and are rasterized lazily
// by engine/world-generation.js. This sparse registry remains for editor or
// campaign-specific water features that must override the generated base.
export const RIVERS = [];

export const RIVER_BY_COORD = {};
for (const r of RIVERS) {
  for (const p of r.path) {
    RIVER_BY_COORD[`${p.x},${p.y}`] = r;
  }
}
