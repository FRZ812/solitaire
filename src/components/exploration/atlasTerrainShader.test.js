import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { atlas3dAxialToScene } from "./worldAtlas3dModel.js";
import { atlasWorldLightState } from "./WorldAtlas3DScene.jsx";
import {
  atlasTerrainShaderLocalHour,
  enhanceAtlasTerrainMaterial,
  setAtlasTerrainWorldTime,
} from "./atlasTerrainShader.js";

function compileStub(material) {
  const shader = {
    uniforms: {},
    vertexShader: `
#include <common>
void main() {
  #include <color_vertex>
}
`,
    fragmentShader: `
#include <common>
void main() {
  #include <color_fragment>
  #include <lights_fragment_end>
}
`,
  };
  material.onBeforeCompile(shader);
  return shader;
}

describe("atlas terrain shader", () => {
  it("injects AO, slope, shore, macro detail, and corrected axial longitude on detailed tiers", () => {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true });
    const noise = new THREE.Texture();
    const uniforms = enhanceAtlasTerrainMaterial(THREE, material, noise, {
      id: "high",
      ambientFx: "full",
    });
    const shader = compileStub(material);

    expect(material.defines).toMatchObject({
      ATLAS_USE_AO: 1,
      ATLAS_USE_MACRO: 1,
      ATLAS_USE_SLOPE: 1,
      ATLAS_USE_SHORE: 1,
      ATLAS_USE_CLOUDS: 1,
    });
    expect(shader.uniforms.uAtlasNoise).toBe(uniforms.uAtlasNoise);
    expect(shader.vertexShader).toContain("float axialX = worldXZ.x - axialY * 0.5");
    expect(shader.vertexShader).toContain("attribute float atlasAo");
    expect(shader.vertexShader).toContain("dawnPhase");
    expect(shader.fragmentShader).toContain("float rockMask");
    expect(shader.fragmentShader).toContain("reflectedLight.directDiffuse");
    expect(material.customProgramCacheKey()).toContain("high");
  });

  it("strips terrain texture and AO features from the low tier", () => {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true });
    enhanceAtlasTerrainMaterial(THREE, material, new THREE.Texture(), {
      id: "low",
      ambientFx: "off",
    });

    expect(material.defines).toMatchObject({
      ATLAS_USE_AO: 0,
      ATLAS_USE_MACRO: 0,
      ATLAS_USE_SLOPE: 0,
      ATLAS_USE_SHORE: 0,
      ATLAS_USE_CLOUDS: 0,
    });
  });

  it("keeps GPU longitude and world-time uniforms aligned with the campaign light model", () => {
    const uniforms = {
      uWorldDay: { value: 0 },
      uWorldHour: { value: 0 },
    };
    const time = { day: 37, hour: 23, minute: 42 };
    setAtlasTerrainWorldTime(uniforms, time);
    expect(uniforms.uWorldDay.value).toBe(37);
    expect(uniforms.uWorldHour.value).toBeCloseTo(23.7, 8);

    for (const coord of [
      { x: -430, y: -320 },
      { x: 0, y: 0 },
      { x: 390, y: 280 },
    ]) {
      const scene = atlas3dAxialToScene(coord);
      expect(atlasTerrainShaderLocalHour(time, { x: scene.x, z: scene.z }))
        .toBeCloseTo(atlasWorldLightState(time, coord).localHour, 8);
    }
  });
});
