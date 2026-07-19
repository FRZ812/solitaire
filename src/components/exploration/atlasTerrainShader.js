// GPU enhancement layer for the atlas terrain material. Injected through
// onBeforeCompile so three's MeshStandardMaterial keeps handling lights,
// shadows, fog, and tone mapping — the patch only:
//   1. moves the per-vertex day/night longitude relighting (formerly a CPU
//      loop over every terrain vertex per world-time tick) into the vertex
//      stage, mirroring atlasWorldLightState's daylight math exactly, and
//   2. adds fragment-level detail: macro albedo breakup at continent scale,
//      a wet band along the shoreline, and a cloud-shadow hook the ambient
//      loop can drive.
// Determinism note: everything here derives from existing deterministic
// inputs (world position, shore attribute, the seeded noise texture).
import { CONTINENT } from "../../data/continent.js";

const BOUNDS_CENTER_X = (CONTINENT.bounds.xmin + CONTINENT.bounds.xmax) / 2;
const BOUNDS_WIDTH_X = CONTINENT.bounds.xmax - CONTINENT.bounds.xmin;
const TIMEZONE_SPAN_HOURS = 6;
const SQRT_THREE_OVER_TWO = Math.sqrt(3) / 2;

const VERTEX_DECLARATIONS = `
uniform float uWorldDay;
uniform float uWorldHour;
varying vec2 vAtlasWorld;
varying float vAtlasShore;
varying float vAtlasAo;
varying float vAtlasSlope;
attribute float shore;
attribute float atlasAo;

void atlasSolarAt(
  vec2 worldXZ,
  out float localHour,
  out float sunrise,
  out float sunset,
  out float daylight
) {
  float axialY = worldXZ.y / ${SQRT_THREE_OVER_TWO.toFixed(8)};
  // Scene X is sheared by axial Y (x = axialX + axialY / 2). Recover the
  // authoritative axial longitude before applying the six-hour time span.
  float axialX = worldXZ.x - axialY * 0.5;
  localHour = uWorldHour
    + (axialX - ${BOUNDS_CENTER_X.toFixed(4)}) / ${BOUNDS_WIDTH_X.toFixed(4)} * ${TIMEZONE_SPAN_HOURS.toFixed(1)};
  localHour = mod(mod(localHour, 24.0) + 24.0, 24.0);
  float calendarDay = mod(mod(269.0 + uWorldDay - 1.0, 360.0) + 360.0, 360.0);
  float seasonalTilt = sin((calendarDay - 80.0) / 360.0 * 6.2831853);
  float latitude = clamp((-axialY / 400.0 + 1.0) / 2.0, 0.0, 1.0) * 2.0 - 1.0;
  float daylightShift = latitude * seasonalTilt * 4.0;
  sunrise = 6.0 - daylightShift / 2.0;
  sunset = 20.0 + daylightShift / 2.0;
  float dawn = smoothstep(0.0, 1.0, (localHour - (sunrise - 0.8)) / 1.45);
  float dusk = 1.0 - smoothstep(0.0, 1.0, (localHour - (sunset - 0.65)) / 1.45);
  daylight = clamp(dawn * dusk, 0.0, 1.0);
}
`;

const VERTEX_TINT = `
{
  vAtlasWorld = vec2(position.x, position.z);
  vAtlasShore = shore;
  vAtlasAo = atlasAo;
  vAtlasSlope = 1.0 - clamp(normal.y, 0.0, 1.0);
  float localHour;
  float sunrise;
  float sunset;
  float daylight;
  atlasSolarAt(vAtlasWorld, localHour, sunrise, sunset, daylight);
  float night = 1.0 - daylight;
  bool dawnPhase = localHour >= sunrise - 1.0 && localHour < sunrise + 1.1;
  bool duskPhase = localHour >= sunset - 1.1 && localHour < sunset + 1.0;
  float warmth = daylight < 0.82 && (dawnPhase || duskPhase)
    ? clamp(1.0 - abs(daylight - 0.48) / 0.48, 0.0, 1.0) * 0.09
    : 0.0;
  // Preserve enough albedo for moonlit miniature detail instead of letting
  // two lighting passes collapse the landscape into a black silhouette.
  float brightness = 0.58 + daylight * 0.42;
  vColor.r = min(1.0, vColor.r * brightness + warmth * 0.7 + night * 0.012);
  vColor.g = min(1.0, vColor.g * brightness + warmth * 0.28 + night * 0.035);
  vColor.b = min(1.0, vColor.b * brightness + night * 0.085);
}
`;

const FRAGMENT_DECLARATIONS = `
uniform sampler2D uAtlasNoise;
uniform vec2 uCloudOffset;
uniform float uCloudStrength;
varying vec2 vAtlasWorld;
varying float vAtlasShore;
varying float vAtlasAo;
varying float vAtlasSlope;
`;

const FRAGMENT_DETAIL = `
{
#if ATLAS_USE_MACRO == 1
  // Continent-scale albedo breakup keeps far zoom from reading as flat fills.
  vec3 macroNoise = texture2D(uAtlasNoise, vAtlasWorld * 0.0016).rgb;
  float weave = texture2D(uAtlasNoise, vAtlasWorld * 0.011 + vec2(0.37, 0.61)).g;
  diffuseColor.rgb *= 0.945 + macroNoise.r * 0.085 + weave * 0.03;
#endif
#if ATLAS_USE_SLOPE == 1
  // Steep normals reveal irregular stone and scree without flattening every
  // mountain into one gray material. The independent blue noise channel keeps
  // the breakup from correlating with the bump/macro samples.
  float scree = texture2D(uAtlasNoise, vAtlasWorld * 0.018 + vec2(0.13, 0.79)).b;
  float rockMask = smoothstep(0.18, 0.68, vAtlasSlope)
    * smoothstep(0.28, 0.78, scree + vAtlasSlope * 0.45);
  vec3 rockTint = vec3(0.35, 0.32, 0.28);
  diffuseColor.rgb = mix(
    diffuseColor.rgb,
    diffuseColor.rgb * 0.64 + rockTint * 0.36,
    rockMask * 0.58
  );
#endif
#if ATLAS_USE_SHORE == 1
  // Damp, darkened ground hugging the waterline sells the shore transition.
  float wet = smoothstep(0.55, 0.96, vAtlasShore);
  diffuseColor.rgb *= 1.0 - wet * 0.16;
#endif
#if ATLAS_USE_CLOUDS == 1
  // Drifting cloud shadows (driven by the ambient loop; strength 0 when off).
  if (uCloudStrength > 0.001) {
    float cloud = texture2D(uAtlasNoise, vAtlasWorld * 0.0011 + uCloudOffset).g;
    float shade = smoothstep(0.52, 0.86, cloud) * uCloudStrength;
    diffuseColor.rgb *= 1.0 - shade;
  }
#endif
}
`;

const FRAGMENT_AO = `
#if ATLAS_USE_AO == 1
  // AO is already tempered into the worker colors for the direct-render
  // fallback. The shader adds a restrained lighting-space pass so valleys and
  // forest floors stay grounded under the brighter miniature light rig.
  float atlasOcclusion = clamp(vAtlasAo, 0.0, 1.0);
  reflectedLight.directDiffuse *= mix(0.84, 1.0, atlasOcclusion);
  reflectedLight.indirectDiffuse *= mix(0.7, 1.0, atlasOcclusion);
#endif
`;

export function enhanceAtlasTerrainMaterial(THREE, material, noiseTexture, quality = null) {
  const tier = quality?.id || "high";
  const detailed = tier !== "low";
  const uniforms = {
    uWorldDay: { value: 1 },
    uWorldHour: { value: 12 },
    uAtlasNoise: { value: noiseTexture },
    uCloudOffset: { value: new THREE.Vector2(0, 0) },
    uCloudStrength: { value: 0 },
  };
  material.defines = {
    ...(material.defines || {}),
    ATLAS_USE_AO: detailed ? 1 : 0,
    ATLAS_USE_MACRO: detailed ? 1 : 0,
    ATLAS_USE_SLOPE: detailed ? 1 : 0,
    ATLAS_USE_SHORE: detailed ? 1 : 0,
    ATLAS_USE_CLOUDS: quality?.ambientFx === "full" ? 1 : 0,
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERTEX_DECLARATIONS}`)
      .replace("#include <color_vertex>", `#include <color_vertex>\n${VERTEX_TINT}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAGMENT_DECLARATIONS}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n${FRAGMENT_DETAIL}`)
      .replace("#include <lights_fragment_end>", `#include <lights_fragment_end>\n${FRAGMENT_AO}`);
  };
  // The injected source is static per module version; share one program.
  material.customProgramCacheKey = () => `atlas-terrain-enhanced-v2-${tier}`;
  return uniforms;
}

export function setAtlasTerrainWorldTime(uniforms, time) {
  if (!uniforms) return;
  const hour = Number.isFinite(Number(time?.hour)) ? Number(time.hour) : 12;
  const minute = Number.isFinite(Number(time?.minute)) ? Number(time.minute) : 0;
  uniforms.uWorldDay.value = Math.max(1, Number(time?.day) || 1);
  uniforms.uWorldHour.value = hour + minute / 60;
}

// Pure mirror of the vertex shader's scene-to-axial longitude conversion.
// Kept exported so parity with the campaign light model remains testable when
// either projection or timezone math changes.
export function atlasTerrainShaderLocalHour(time, worldXZ) {
  const hour = Number.isFinite(Number(time?.hour)) ? Number(time.hour) : 12;
  const minute = Number.isFinite(Number(time?.minute)) ? Number(time.minute) : 0;
  const axialY = (Number(worldXZ?.z) || 0) / SQRT_THREE_OVER_TWO;
  const axialX = (Number(worldXZ?.x) || 0) - axialY * 0.5;
  const localHour = hour + minute / 60
    + (axialX - BOUNDS_CENTER_X) / BOUNDS_WIDTH_X * TIMEZONE_SPAN_HOURS;
  return ((localHour % 24) + 24) % 24;
}
