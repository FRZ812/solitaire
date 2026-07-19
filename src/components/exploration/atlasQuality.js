// Quality tiers for the 3D world atlas. A tier is a frozen bundle of render
// settings resolved once per atlas mount: either forced by the player's
// "Map detail" preference or picked from coarse device signals. Tiers only
// shape presentation (grid stride, shadows, effects, prop density, pixel
// budgets) — terrain content stays deterministic and identical across tiers.
import {
  ATLAS_3D_FINE_TERRAIN_STRIDE,
  ATLAS_3D_TERRAIN_STRIDE,
} from "./worldAtlas3dModel.js";

export const ATLAS_QUALITY_TIERS = Object.freeze({
  high: Object.freeze({
    id: "high",
    terrainStride: ATLAS_3D_FINE_TERRAIN_STRIDE,
    shadowMapSize: 2048,
    postFx: "full",
    ambientFx: "full",
    propDensity: 1,
    pixelBudget: 1_800_000,
    dprCap: 1.65,
  }),
  medium: Object.freeze({
    id: "medium",
    terrainStride: ATLAS_3D_TERRAIN_STRIDE,
    shadowMapSize: 1024,
    postFx: "grade",
    ambientFx: "water",
    propDensity: 0.55,
    pixelBudget: 900_000,
    dprCap: 1.3,
  }),
  low: Object.freeze({
    id: "low",
    terrainStride: ATLAS_3D_TERRAIN_STRIDE,
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
