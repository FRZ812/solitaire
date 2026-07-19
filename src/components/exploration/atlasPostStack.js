// Minimal, self-contained post-processing stack for the 3D atlas. Deliberately
// not built on three/examples EffectComposer: the scene module receives the
// THREE namespace as a parameter so three stays a lazy chunk, and example
// modules would drag it into the static graph.
//
// Pipeline (mode "full"): scene → multisampled linear half-float target →
// half-res two-pass tilt-shift blur → composite (grade + vignette + focus-band
// DoF mix + ACES tone map + sRGB encode) to the canvas. Mode "grade" skips the
// blur and band mix. three skips its own tone mapping/encode for render-target
// passes (verified in-source), so the composite performs both.

const BLUR_SHADER = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uSource;
uniform vec2 uDirection;
void main() {
  vec3 sum = texture2D(uSource, vUv).rgb * 0.227027;
  vec2 off1 = uDirection * 1.3846154;
  vec2 off2 = uDirection * 3.2307692;
  sum += texture2D(uSource, vUv + off1).rgb * 0.3162162;
  sum += texture2D(uSource, vUv - off1).rgb * 0.3162162;
  sum += texture2D(uSource, vUv + off2).rgb * 0.0702703;
  sum += texture2D(uSource, vUv - off2).rgb * 0.0702703;
  gl_FragColor = vec4(sum, 1.0);
}
`;

const COMPOSITE_SHADER = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBlur;
uniform float uExposure;
uniform float uDofStrength;
uniform float uFocusHalfBand;
uniform float uVignette;
uniform float uSaturation;
uniform float uContrast;
uniform float uUseBlur;

vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}

vec3 acesFilmic(vec3 color) {
  const mat3 ACESInputMat = mat3(
    vec3(0.59719, 0.07600, 0.02840),
    vec3(0.35458, 0.90834, 0.13383),
    vec3(0.04823, 0.01566, 0.83777)
  );
  const mat3 ACESOutputMat = mat3(
    vec3(1.60475, -0.10208, -0.00327),
    vec3(-0.53108, 1.10813, -0.07276),
    vec3(-0.07367, -0.00605, 1.07602)
  );
  color = ACESInputMat * (color * (uExposure / 0.6));
  color = RRTAndODTFit(color);
  return clamp(ACESOutputMat * color, 0.0, 1.0);
}

vec3 linearToSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

void main() {
  vec3 color = texture2D(uScene, vUv).rgb;
  if (uUseBlur > 0.5 && uDofStrength > 0.001) {
    // Screen-space focus band around the camera target: sharp in the middle,
    // miniature-blurred toward the top and bottom edges.
    float distance = abs(vUv.y - 0.5);
    float mask = smoothstep(uFocusHalfBand, uFocusHalfBand * 2.4, distance) * uDofStrength;
    color = mix(color, texture2D(uBlur, vUv).rgb, mask);
  }
  // Gentle painterly grade in linear light.
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luma), color, uSaturation);
  color = (color - 0.18) * uContrast + 0.18;
  color *= vec3(1.012, 1.0, 0.992);
  color = acesFilmic(max(color, vec3(0.0)));
  vec2 centered = vUv - 0.5;
  float vignette = 1.0 - dot(centered, centered) * uVignette;
  color *= clamp(vignette, 0.0, 1.0);
  gl_FragColor = vec4(linearToSRGB(color), 1.0);
}
`;

const QUAD_VERTEX_SHADER = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

function createFullscreenQuad(THREE, material) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
  );
  geometry.setAttribute(
    "uv",
    new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2),
  );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  const holder = new THREE.Scene();
  holder.add(mesh);
  return { holder, mesh, geometry };
}

export function createAtlasPostStack(THREE, renderer, scene, camera, mode) {
  if (mode !== "full" && mode !== "grade") return null;
  const fullDof = mode === "full";
  const passCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const blurMaterial = new THREE.RawShaderMaterial({
    vertexShader: QUAD_VERTEX_SHADER,
    fragmentShader: BLUR_SHADER,
    uniforms: {
      uSource: { value: null },
      uDirection: { value: new THREE.Vector2(0, 0) },
    },
    depthTest: false,
    depthWrite: false,
  });
  const compositeMaterial = new THREE.RawShaderMaterial({
    vertexShader: QUAD_VERTEX_SHADER,
    fragmentShader: COMPOSITE_SHADER,
    uniforms: {
      uScene: { value: null },
      uBlur: { value: null },
      uExposure: { value: 1 },
      uDofStrength: { value: 0 },
      uFocusHalfBand: { value: 0.3 },
      uVignette: { value: 0.38 },
      uSaturation: { value: 0.99 },
      uContrast: { value: 1.035 },
      uUseBlur: { value: fullDof ? 1 : 0 },
    },
    depthTest: false,
    depthWrite: false,
  });
  const blurQuad = createFullscreenQuad(THREE, blurMaterial);
  const compositeQuad = createFullscreenQuad(THREE, compositeMaterial);

  let sceneTarget = null;
  let blurA = null;
  let blurB = null;
  let targetWidth = 0;
  let targetHeight = 0;
  let logicalWidth = 0;
  let logicalHeight = 0;
  let logicalPixelRatio = 1;
  let disabled = false;
  const supportsHalfFloat = renderer.extensions?.has?.("EXT_color_buffer_float") === true;
  const targetType = supportsHalfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const sampleCount = renderer.capabilities?.isWebGL2 === false ? 0 : 4;

  function disposeTargets() {
    sceneTarget?.dispose();
    blurA?.dispose();
    blurB?.dispose();
    sceneTarget = null;
    blurA = null;
    blurB = null;
  }

  function setSize(width, height, pixelRatio) {
    logicalWidth = width;
    logicalHeight = height;
    logicalPixelRatio = pixelRatio;
    if (disabled) return false;
    const bufferWidth = Math.max(1, Math.round(width * pixelRatio));
    const bufferHeight = Math.max(1, Math.round(height * pixelRatio));
    if (bufferWidth === targetWidth && bufferHeight === targetHeight && sceneTarget) return true;
    disposeTargets();
    targetWidth = bufferWidth;
    targetHeight = bufferHeight;
    try {
      sceneTarget = new THREE.WebGLRenderTarget(bufferWidth, bufferHeight, {
        type: targetType,
        samples: sampleCount,
        depthBuffer: true,
      });
      if (fullDof) {
        const halfWidth = Math.max(1, Math.round(bufferWidth / 2));
        const halfHeight = Math.max(1, Math.round(bufferHeight / 2));
        const options = { type: targetType, depthBuffer: false };
        blurA = new THREE.WebGLRenderTarget(halfWidth, halfHeight, options);
        blurB = new THREE.WebGLRenderTarget(halfWidth, halfHeight, options);
      }
      return true;
    } catch {
      disposeTargets();
      disabled = true;
      renderer.setRenderTarget(null);
      return false;
    }
  }

  // The blur spreads with zoom: at fit zoom the whole continent stays sharp,
  // and pushing in narrows the focus band into the miniature look.
  function setZoomStrength(zoomRatio) {
    const strength = Math.min(1, Math.max(0, (zoomRatio - 2.1) / 4.4));
    const eased = strength * strength * (3 - 2 * strength);
    compositeMaterial.uniforms.uDofStrength.value = eased * 0.56;
    compositeMaterial.uniforms.uFocusHalfBand.value = 0.35 - eased * 0.12;
  }

  function render() {
    if (disabled || !sceneTarget) return false;
    try {
      renderer.setRenderTarget(sceneTarget);
      renderer.render(scene, camera);
      if (fullDof && compositeMaterial.uniforms.uDofStrength.value > 0.001) {
        blurMaterial.uniforms.uSource.value = sceneTarget.texture;
        blurMaterial.uniforms.uDirection.value.set(1 / Math.max(1, blurA.width), 0);
        renderer.setRenderTarget(blurA);
        renderer.render(blurQuad.holder, passCamera);
        blurMaterial.uniforms.uSource.value = blurA.texture;
        blurMaterial.uniforms.uDirection.value.set(0, 1 / Math.max(1, blurA.height));
        renderer.setRenderTarget(blurB);
        renderer.render(blurQuad.holder, passCamera);
        compositeMaterial.uniforms.uBlur.value = blurB.texture;
      }
      compositeMaterial.uniforms.uScene.value = sceneTarget.texture;
      compositeMaterial.uniforms.uExposure.value = renderer.toneMappingExposure;
      renderer.setRenderTarget(null);
      renderer.render(compositeQuad.holder, passCamera);
      return true;
    } catch {
      renderer.setRenderTarget(null);
      disposeTargets();
      disabled = true;
      return false;
    }
  }

  function reset() {
    disposeTargets();
    disabled = false;
    targetWidth = 0;
    targetHeight = 0;
    return logicalWidth > 0 && logicalHeight > 0
      ? setSize(logicalWidth, logicalHeight, logicalPixelRatio)
      : true;
  }

  function dispose() {
    disposeTargets();
    blurMaterial.dispose();
    compositeMaterial.dispose();
    blurQuad.geometry.dispose();
    compositeQuad.geometry.dispose();
  }

  return {
    mode,
    activeMode: () => (disabled ? "off" : mode),
    render,
    reset,
    setSize,
    setZoomStrength,
    dispose,
  };
}
