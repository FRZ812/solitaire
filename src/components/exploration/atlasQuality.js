// Quality tiers for the 3D world atlas. A tier is a frozen bundle of render
// settings resolved once per atlas mount: either forced by the player's
// "Map detail" preference or picked from coarse device signals. Terrain is
// always generated from the same stride-one lattice; tiers only decide how
// much of its LOD0 mesh and deterministic set dressing remain resident.

export const ATLAS_QUALITY_TIERS = Object.freeze({
  high: Object.freeze({
    id: "high",
    lod0Radius: 2,
    chunkCacheSize: 96,
    chunkPropCap: 320,
    shadowMapSize: 2048,
    postFx: "full",
    ambientFx: "full",
    propDensity: 1,
    pixelBudget: 1_800_000,
    dprCap: 1.65,
  }),
  medium: Object.freeze({
    id: "medium",
    lod0Radius: 1,
    chunkCacheSize: 64,
    chunkPropCap: 200,
    shadowMapSize: 1024,
    postFx: "grade",
    ambientFx: "water",
    propDensity: 0.55,
    pixelBudget: 900_000,
    dprCap: 1.3,
  }),
  low: Object.freeze({
    id: "low",
    lod0Radius: 0,
    chunkCacheSize: 48,
    chunkPropCap: 100,
    proceduralOnly: true,
    shadowMapSize: 0,
    postFx: "off",
    ambientFx: "off",
    propDensity: 0.3,
    pixelBudget: 700_000,
    dprCap: 1.15,
  }),
});

export function detectAtlasQualitySignals() {
  if (typeof window === "undefined") {
    return { viewportMin: 1080, dpr: 1, cores: 4, memory: 8 };
  }
  return {
    viewportMin: Math.min(window.innerWidth || 0, window.innerHeight || 0) || 1080,
    dpr: window.devicePixelRatio || 1,
    cores: navigator?.hardwareConcurrency || 4,
    memory: navigator?.deviceMemory || 8,
  };
}

// Conservative auto heuristic: phones and small windows land on medium (the
// established mobile pixel budget), clearly weak hardware lands on low, and
// everything else gets the full diorama. A forced mode always wins.
export function resolveAtlasQuality(override = "auto", signals = detectAtlasQualitySignals()) {
  if (override && override !== "auto" && ATLAS_QUALITY_TIERS[override]) {
    return ATLAS_QUALITY_TIERS[override];
  }
  const { viewportMin, cores, memory } = signals;
  if (cores <= 2 || memory <= 2) return ATLAS_QUALITY_TIERS.low;
  if (viewportMin < 720) return ATLAS_QUALITY_TIERS.medium;
  return ATLAS_QUALITY_TIERS.high;
}
