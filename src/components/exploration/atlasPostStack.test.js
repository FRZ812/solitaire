import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createAtlasPostStack } from "./atlasPostStack.js";

function rendererStub(render = vi.fn()) {
  return {
    capabilities: { isWebGL2: true },
    extensions: { has: vi.fn(() => true) },
    toneMappingExposure: 0.92,
    setRenderTarget: vi.fn(),
    render,
  };
}

describe("atlas post stack", () => {
  it("runs scene, two blur passes, and the final composite in full mode", () => {
    const renderer = rendererStub();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const stack = createAtlasPostStack(THREE, renderer, scene, camera, "full");

    expect(stack.setSize(320, 180, 1.5)).toBe(true);
    stack.setZoomStrength(7);
    expect(stack.render()).toBe(true);
    expect(renderer.render).toHaveBeenCalledTimes(4);
    expect(renderer.render.mock.calls[0]).toEqual([scene, camera]);
    expect(stack.activeMode()).toBe("full");
    stack.dispose();
  });

  it("uses only grade/composite passes in medium mode", () => {
    const renderer = rendererStub();
    const stack = createAtlasPostStack(
      THREE,
      renderer,
      new THREE.Scene(),
      new THREE.PerspectiveCamera(),
      "grade",
    );

    stack.setSize(320, 180, 1);
    expect(stack.render()).toBe(true);
    expect(renderer.render).toHaveBeenCalledTimes(2);
    expect(stack.activeMode()).toBe("grade");
    stack.dispose();
  });

  it("falls back to direct rendering after a post pass fails and can reset after context restore", () => {
    let fail = true;
    const renderer = rendererStub(vi.fn(() => {
      if (fail) {
        fail = false;
        throw new Error("framebuffer unavailable");
      }
    }));
    const stack = createAtlasPostStack(
      THREE,
      renderer,
      new THREE.Scene(),
      new THREE.PerspectiveCamera(),
      "grade",
    );

    stack.setSize(240, 135, 1);
    expect(stack.render()).toBe(false);
    expect(stack.activeMode()).toBe("off");
    expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(null);
    expect(stack.reset()).toBe(true);
    expect(stack.activeMode()).toBe("grade");
    expect(stack.render()).toBe(true);
    stack.dispose();
  });

  it("preserves the direct path for off mode", () => {
    expect(createAtlasPostStack(
      THREE,
      rendererStub(),
      new THREE.Scene(),
      new THREE.PerspectiveCamera(),
      "off",
    )).toBeNull();
  });
});
