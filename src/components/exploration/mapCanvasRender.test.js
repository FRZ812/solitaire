import { describe, expect, it } from "vitest";
import { makeInitialState } from "../../data/initial-state.js";
import { buildExplorationModel } from "./hexMapModel.js";
import { buildMapLayout } from "./mapGeometry.js";
import { travelMapLod } from "./mapLod.js";
import { buildWorldMapScene } from "./mapSceneModel.js";
import { travelMapRenderDimensions, travelMapViewportDimensions } from "./travelMapModel.js";
import { renderMap } from "./MapCanvas.jsx";

// A recording 2D context. Canvas has no headless renderer here, so the next best
// verification is that the whole draw path executes and emits the operations the
// zoom tier calls for.
function recordingContext() {
  const ops = [];
  const record = (name) => (...args) => { ops.push({ name, args }); };
  return {
    ops,
    canvas: { width: 900, height: 600 },
    arc: record("arc"),
    beginPath: record("beginPath"),
    clearRect: record("clearRect"),
    clip: record("clip"),
    closePath: record("closePath"),
    createRadialGradient: () => ({ addColorStop: record("addColorStop") }),
    drawImage: record("drawImage"),
    ellipse: record("ellipse"),
    fill: record("fill"),
    fillRect: record("fillRect"),
    fillText: (text, ...rest) => { ops.push({ name: "fillText", args: [text, ...rest] }); },
    lineTo: record("lineTo"),
    measureText: (text) => ({ width: String(text).length * 6 }),
    moveTo: record("moveTo"),
    quadraticCurveTo: record("quadraticCurveTo"),
    restore: record("restore"),
    save: record("save"),
    setLineDash: record("setLineDash"),
    setTransform: record("setTransform"),
    stroke: record("stroke"),
    strokeText: record("strokeText"),
    translate: record("translate"),
  };
}

function sceneAtZoom(zoom) {
  const state = makeInitialState();
  const dimensions = travelMapViewportDimensions({ width: 900, height: 600 }, zoom);
  const model = buildExplorationModel(state, {
    center: state.world.currentTile,
    dimensions,
    renderDimensions: travelMapRenderDimensions(dimensions),
  });
  return buildWorldMapScene({ state, model, selection: null, journey: null });
}

function render(scene) {
  const context = recordingContext();
  const layout = buildMapLayout(scene, 900, 600);
  renderMap(context, scene, layout, null, {}, "", 900, 600);
  return { context, layout, ops: context.ops };
}

describe("map canvas render path", () => {
  it("draws the party's own valley with hex furniture intact", () => {
    const scene = sceneAtZoom(1);
    expect(scene.tier).toBe("local");

    const { ops, layout } = render(scene);
    expect(layout.entries.length).toBeGreaterThan(0);
    expect(ops.filter((op) => op.name === "stroke").length).toBeGreaterThan(0);
    expect(ops.filter((op) => op.name === "clearRect")).toHaveLength(1);
  });

  it("renders the whole continent through the same path, without hex outlines", () => {
    const local = sceneAtZoom(1);
    const continental = sceneAtZoom(travelMapLod(0).zoom);
    expect(continental.tier).toBe("continent");

    // The cost argument for stride sampling. The window grows to its ceiling and
    // stops; everything past that is bought with stride, so the cell count stays
    // in the same order of magnitude while the ground covered grows a thousandfold.
    const groundOf = (scene) => scene.cells.length * scene.stride ** 2;
    expect(continental.cells.length).toBeLessThan(local.cells.length * 4);
    expect(groundOf(continental)).toBeGreaterThan(groundOf(local) * 700);

    const far = render(continental);
    // Every hex outline is one extra stroke per cell; dropping them at this tier
    // is what lets terrain read as continuous masses.
    expect(far.ops.filter((op) => op.name === "stroke").length)
      .toBeLessThan(render(local).ops.filter((op) => op.name === "stroke").length);
  });

  it("names authored places on the atlas that no sampled hex would have carried", () => {
    const scene = sceneAtZoom(travelMapLod(0).zoom);
    const labels = render(scene).ops.filter((op) => op.name === "fillText").map((op) => op.args[0]);

    expect(scene.places.length).toBeGreaterThan(0);
    // A landmark occupies one hex out of the 784 each continental sample stands
    // for, so if these are drawn at all they came from the authored layer.
    expect(labels).toContain("Whitemarch");
    expect(labels.length).toBeGreaterThan(0);
  });

  it("survives a scene with nothing in it rather than throwing at the caller", () => {
    const empty = { version: 1, mode: "world", stride: 1, tier: "local", origin: { x: 0, y: 0 }, cells: [], route: [] };
    const context = recordingContext();
    expect(() => renderMap(context, empty, buildMapLayout(empty, 900, 600), null, {}, "", 900, 600)).not.toThrow();
  });
});
