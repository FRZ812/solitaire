import { describe, expect, it } from "vitest";
import { CONTINENT } from "../../data/continent.js";
import {
  ATLAS_3D_RENDER_VERSION,
  atlas3dAxialToScene,
  atlas3dCameraFrame,
  atlas3dFitZoom,
  atlas3dProject,
  atlas3dSceneToAxial,
  atlas3dScreenToGround,
  atlas3dTerrainHeightAt,
  buildAtlas3dTerrainData,
  centerAtlas3dCamera,
  clampAtlas3dCamera,
  fitAtlas3dCamera,
  panAtlas3dCamera,
  zoomAtlas3dCamera,
} from "./worldAtlas3dModel.js";
import { clampAtlasCamera } from "./worldAtlasModel.js";

const VIEWPORT = { width: 960, height: 540 };

describe("true 3D atlas spatial model", () => {
  it("round-trips the authoritative axial plane without the former CSS skew", () => {
    for (const coord of [
      { x: 0, y: 0 },
      { x: 131, y: -96 },
      { x: CONTINENT.bounds.xmin, y: CONTINENT.bounds.ymax },
    ]) {
      const scene = atlas3dAxialToScene(coord);
      const back = atlas3dSceneToAxial(scene);
      expect(back.x).toBeCloseTo(coord.x, 8);
      expect(back.y).toBeCloseTo(coord.y, 8);
    }
  });

  it("projects and picks the camera target through a real perspective frame", () => {
    const camera = clampAtlasCamera({ x: 0, y: 0, zoom: 3 }, VIEWPORT);
    const target = atlas3dScreenToGround(camera, VIEWPORT, { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 });
    const screen = atlas3dProject(camera, VIEWPORT, target, target.height);
    expect(screen.x).toBeCloseTo(VIEWPORT.width / 2, 3);
    expect(screen.y).toBeCloseTo(VIEWPORT.height / 2, 3);
    expect(screen.visible).toBe(true);
  });

  it("keeps the ground below an off-center cursor fixed while dollying", () => {
    const camera = clampAtlasCamera({ x: 20, y: -35, zoom: 2.8 }, VIEWPORT);
    const anchor = { x: 280, y: 190 };
    const before = atlas3dScreenToGround(camera, VIEWPORT, anchor);
    const zoomed = zoomAtlas3dCamera(camera, VIEWPORT, 1.7, anchor);
    const after = atlas3dProject(
      zoomed,
      VIEWPORT,
      before,
      atlas3dTerrainHeightAt(before, CONTINENT.seed),
      CONTINENT.seed,
    );
    expect(Math.hypot(after.x - anchor.x, after.y - anchor.y)).toBeLessThan(1);
  });

  it("keeps the camera above raised terrain at maximum zoom", () => {
    const viewport = { width: 560, height: 300 };
    const focus = { x: 342, y: -316 };
    const camera = clampAtlasCamera({
      x: focus.x + focus.y * 0.5,
      y: focus.y * Math.sqrt(3) / 2 * 0.76,
      zoom: 26,
    }, viewport);
    const frame = atlas3dCameraFrame(camera, viewport, CONTINENT.seed);
    const footprint = atlas3dSceneToAxial(frame.position);
    const terrainBelowCamera = atlas3dTerrainHeightAt(footprint, CONTINENT.seed);
    expect(frame.position.y - terrainBelowCamera).toBeGreaterThanOrEqual(2.99);
  });

  it("keeps a real terrain point beneath the zoom anchor", () => {
    const camera = clampAtlasCamera({ x: 0, y: 0, zoom: 2.8 }, VIEWPORT);
    const coord = { x: 156, y: -134 };
    const terrainHeight = atlas3dTerrainHeightAt(coord, CONTINENT.seed);
    const ground = { ...coord, scene: atlas3dAxialToScene(coord), height: terrainHeight };
    const anchor = atlas3dProject(camera, VIEWPORT, coord, terrainHeight, CONTINENT.seed);
    const zoomed = zoomAtlas3dCamera(camera, VIEWPORT, 1.7, anchor, CONTINENT.seed, () => ground);
    const after = atlas3dProject(zoomed, VIEWPORT, coord, terrainHeight, CONTINENT.seed);
    expect(Math.hypot(after.x - anchor.x, after.y - anchor.y)).toBeLessThan(1);
  });

  it("damps zoom correction across steep target-height changes", () => {
    const camera = { x: -160, y: -120, zoom: 12 };
    const scene = { x: -134.67, z: -166.85 };
    const coord = atlas3dSceneToAxial(scene);
    const terrainHeight = atlas3dTerrainHeightAt(coord, CONTINENT.seed);
    const ground = { ...coord, scene, height: terrainHeight };
    const anchor = atlas3dProject(camera, VIEWPORT, coord, terrainHeight, CONTINENT.seed);
    const zoomed = zoomAtlas3dCamera(camera, VIEWPORT, 1.7, anchor, CONTINENT.seed, () => ground);
    const after = atlas3dProject(zoomed, VIEWPORT, coord, terrainHeight, CONTINENT.seed);
    expect(Math.hypot(after.x - anchor.x, after.y - anchor.y)).toBeLessThan(1);
  });

  it("keeps a distant coastal water anchor stable through a large zoom", () => {
    const camera = { x: 322.8252451401204, y: -146.91075002774596, zoom: 13.78598650433123 };
    const anchor = { x: 886.9094589725137, y: 56.50194658432156 };
    const ground = {
      x: 490.76733212614454,
      y: -257.1755222872934,
      scene: { x: 362.1795709824978, z: -222.72053553232715 },
      height: -1.55,
    };
    const zoomed = zoomAtlas3dCamera(
      camera,
      VIEWPORT,
      1.5206303971935995,
      anchor,
      CONTINENT.seed,
      () => ground,
    );
    const after = atlas3dProject(zoomed, VIEWPORT, ground, ground.height, CONTINENT.seed);
    expect(Math.hypot(after.x - anchor.x, after.y - anchor.y)).toBeLessThan(1);
  });

  it("keeps a high ridge fixed through a small zoom-out", () => {
    const camera = { x: 182.69049272639677, y: -216.51922262272785, zoom: 5.775092225277389 };
    const anchor = { x: 285.02564303576946, y: 300.99339455366135 };
    const scene = { x: 155.88798613763035, z: -262.13104625359045 };
    const ground = {
      ...atlas3dSceneToAxial(scene),
      scene,
      height: 19.414583542807875,
    };
    const zoomed = zoomAtlas3dCamera(
      camera,
      VIEWPORT,
      0.9356320800538926,
      anchor,
      CONTINENT.seed,
      () => ground,
    );
    const after = atlas3dProject(zoomed, VIEWPORT, ground, ground.height, CONTINENT.seed);
    expect(Math.hypot(after.x - anchor.x, after.y - anchor.y)).toBeLessThan(1);
    expect(zoomed.targetHeight).toBeCloseTo(atlas3dCameraFrame(camera, VIEWPORT).target.y, 8);
  });

  it("keeps a near-horizon water point fixed through a zoom-in", () => {
    const camera = { x: 66.8259469838813, y: -234.0718390752227, zoom: 9.246612178420586 };
    const anchor = { x: 652.7866018563509, y: 2.8576104808598757 };
    const scene = { x: 91.90460577283721, z: -358.65768135500707 };
    const ground = { ...atlas3dSceneToAxial(scene), scene, height: -1.55 };
    const zoomed = zoomAtlas3dCamera(
      camera,
      VIEWPORT,
      1.2253781665223273,
      anchor,
      CONTINENT.seed,
      () => ground,
    );
    const after = atlas3dProject(zoomed, VIEWPORT, ground, ground.height, CONTINENT.seed);
    expect(Math.hypot(after.x - anchor.x, after.y - anchor.y)).toBeLessThan(1);
    expect(zoomed.targetHeight).toBeCloseTo(atlas3dCameraFrame(camera, VIEWPORT).target.y, 8);
  });

  it("keeps the grabbed terrain point beneath a dragged pointer", () => {
    const camera = { x: 0, y: 0, zoom: 2.5 };
    const coord = { x: 74, y: -52 };
    const terrainHeight = atlas3dTerrainHeightAt(coord, CONTINENT.seed);
    const ground = { ...coord, scene: atlas3dAxialToScene(coord), height: terrainHeight };
    const anchor = atlas3dProject(camera, VIEWPORT, coord, terrainHeight, CONTINENT.seed);
    const delta = { x: -20, y: 15 };
    const panned = panAtlas3dCamera(
      camera,
      VIEWPORT,
      delta.x,
      delta.y,
      CONTINENT.seed,
      () => ground,
      anchor,
    );
    const after = atlas3dProject(panned, VIEWPORT, coord, terrainHeight, CONTINENT.seed);
    expect(Math.hypot(after.x - anchor.x - delta.x, after.y - anchor.y - delta.y)).toBeLessThan(1);
  });

  it("keeps a grabbed water point stable across a steep camera-height boundary", () => {
    const camera = { x: 76.3401, y: -86.3236, zoom: 1.78894 };
    const anchor = { x: 845.1937, y: 114.0546 };
    const delta = { x: 3.2819162296981, y: -29.09613510089964 };
    const ground = {
      x: 470.2549171457393,
      y: -297.2291001851514,
      scene: { x: 321.6403670531636, z: -257.4079515043311 },
      height: -1.55,
    };
    const panned = panAtlas3dCamera(
      camera,
      VIEWPORT,
      delta.x,
      delta.y,
      CONTINENT.seed,
      () => ground,
      anchor,
    );
    const after = atlas3dProject(panned, VIEWPORT, ground, ground.height, CONTINENT.seed);
    expect(Math.hypot(after.x - anchor.x - delta.x, after.y - anchor.y - delta.y)).toBeLessThan(1);
  });

  it("keeps an off-center coastal water point fixed through a downward drag", () => {
    const camera = { x: 265.6154970393982, y: -186.39357984733772, zoom: 3.5120515377199832 };
    const anchor = { x: 702.8368930425495, y: 169.00848167017102 };
    const delta = { x: -4.101750068366528, y: 35.15628867549822 };
    const scene = { x: 335.6379863306885, z: -286.30047665070515 };
    const ground = { ...atlas3dSceneToAxial(scene), scene, height: -1.55 };
    const panned = panAtlas3dCamera(
      camera,
      VIEWPORT,
      delta.x,
      delta.y,
      CONTINENT.seed,
      () => ground,
      anchor,
    );
    const after = atlas3dProject(panned, VIEWPORT, ground, ground.height, CONTINENT.seed);
    expect(Math.hypot(after.x - anchor.x - delta.x, after.y - anchor.y - delta.y)).toBeLessThan(1);
    expect(panned.targetHeight).toBeCloseTo(atlas3dCameraFrame(camera, VIEWPORT).target.y, 8);
  });

  it("fits the perspective terrain inside the viewport", () => {
    const terrain = buildAtlas3dTerrainData(CONTINENT.seed, 24);
    const camera = fitAtlas3dCamera({ x: 0, y: 0, zoom: 1 }, VIEWPORT, CONTINENT.seed);
    expect(camera.zoom).toBeCloseTo(atlas3dFitZoom(VIEWPORT, CONTINENT.seed), 8);
    for (let vertex = 0; vertex < terrain.positions.length / 3; vertex += 1) {
      const coord = atlas3dSceneToAxial({
        x: terrain.positions[vertex * 3],
        z: terrain.positions[vertex * 3 + 2],
      });
      const screen = atlas3dProject(
        camera,
        VIEWPORT,
        coord,
        terrain.positions[vertex * 3 + 1],
        CONTINENT.seed,
      );
      expect(screen.x).toBeGreaterThanOrEqual(0);
      expect(screen.x).toBeLessThanOrEqual(VIEWPORT.width);
      expect(screen.y).toBeGreaterThanOrEqual(0);
      expect(screen.y).toBeLessThanOrEqual(VIEWPORT.height);
    }
  });

  it("allows portrait vertical panning and north-south centering at opening zoom", () => {
    const viewport = { width: 390, height: 667 };
    const fitted = fitAtlas3dCamera({ x: 0, y: 0, zoom: 1 }, viewport, CONTINENT.seed);
    const opening = clampAtlas3dCamera({
      ...fitted,
      zoom: atlas3dFitZoom(viewport, CONTINENT.seed) * 2.35,
    }, viewport, CONTINENT.seed);
    const anchor = { x: viewport.width / 2, y: viewport.height / 2 };
    const openingFrame = atlas3dCameraFrame(opening, viewport, CONTINENT.seed);
    const groundScene = { x: openingFrame.target.x, z: openingFrame.target.z };
    const ground = {
      ...atlas3dSceneToAxial(groundScene),
      scene: groundScene,
      height: openingFrame.target.y,
    };
    const panned = panAtlas3dCamera(
      opening,
      viewport,
      0,
      20,
      CONTINENT.seed,
      () => ground,
      anchor,
    );
    const after = atlas3dProject(panned, viewport, ground, ground.height, CONTINENT.seed);
    expect(Math.hypot(after.x - anchor.x, after.y - anchor.y - 20)).toBeLessThan(1);
    expect(Math.abs(panned.y - opening.y)).toBeGreaterThan(1);

    const middleX = (CONTINENT.bounds.xmin + CONTINENT.bounds.xmax) / 2;
    const north = centerAtlas3dCamera(opening, viewport, {
      x: middleX,
      y: CONTINENT.bounds.ymin,
    }, opening.zoom, CONTINENT.seed);
    const south = centerAtlas3dCamera(opening, viewport, {
      x: middleX,
      y: CONTINENT.bounds.ymax,
    }, opening.zoom, CONTINENT.seed);
    expect(Math.abs(north.y - south.y)).toBeGreaterThan(100);
  });

  it("builds deterministic terrain and vegetation buffers independent of any camera", () => {
    const first = buildAtlas3dTerrainData(CONTINENT.seed, 96);
    const second = buildAtlas3dTerrainData(CONTINENT.seed, 96);
    expect(first.version).toBe(ATLAS_3D_RENDER_VERSION);
    expect(first.positions).toEqual(second.positions);
    expect(first.colors).toEqual(second.colors);
    expect(first.indices).toEqual(second.indices);
    expect(first.trees).toEqual(second.trees);
    expect(first.positions.length).toBe(first.rows * first.columns * 3);
    expect(first.indices.length).toBe((first.rows - 1) * (first.columns - 1) * 6);
    expect(first.trees.length).toBeGreaterThan(0);
    expect(Math.max(...first.positions.filter((_, index) => index % 3 === 1))).toBeGreaterThan(8);
    expect(Math.min(...first.positions.filter((_, index) => index % 3 === 1))).toBeLessThan(0);
  });

  it("places overlays on the same piecewise-linear surface as the terrain mesh", () => {
    const stride = 96;
    const terrain = buildAtlas3dTerrainData(CONTINENT.seed, stride);
    const row = Math.floor((terrain.rows - 1) / 2);
    const column = Math.floor((terrain.columns - 1) / 2);
    const heightAtVertex = (vertex) => terrain.positions[vertex * 3 + 1];
    const aIndex = row * terrain.columns + column;
    const bIndex = aIndex + 1;
    const cIndex = aIndex + terrain.columns;
    const dIndex = cIndex + 1;
    const a = atlas3dSceneToAxial({
      x: terrain.positions[aIndex * 3],
      z: terrain.positions[aIndex * 3 + 2],
    });
    const d = atlas3dSceneToAxial({
      x: terrain.positions[dIndex * 3],
      z: terrain.positions[dIndex * 3 + 2],
    });

    for (const [u, v] of [[0.32, 0.41], [0.72, 0.63]]) {
      const coord = {
        x: a.x + (d.x - a.x) * u,
        y: a.y + (d.y - a.y) * v,
      };
      const expected = u + v <= 1
        ? heightAtVertex(aIndex)
          + (heightAtVertex(bIndex) - heightAtVertex(aIndex)) * u
          + (heightAtVertex(cIndex) - heightAtVertex(aIndex)) * v
        : heightAtVertex(bIndex) * (1 - v)
          + heightAtVertex(cIndex) * (1 - u)
          + heightAtVertex(dIndex) * (u + v - 1);
      expect(atlas3dTerrainHeightAt(coord, CONTINENT.seed, stride)).toBeCloseTo(expected, 5);
    }
  });
});
