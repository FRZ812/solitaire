import { describe, expect, it } from "vitest";
import {
  CONTINENT,
  CONTINENT_HOT_SPRINGS,
  CONTINENT_LAKES,
  NORTHERN_RIDGES,
} from "../../data/continent.js";
import { surveyAtlas } from "../../engine/world-generation.js";
import {
  ATLAS_3D_CAMERA_COAST_INSET,
  ATLAS_3D_ENVIRON_RECORD_STRIDE,
  ATLAS_3D_FIELD_RECORD_STRIDE,
  ATLAS_3D_FIT_PITCH_DEG,
  ATLAS_3D_NEAR_PITCH_DEG,
  ATLAS_3D_RENDER_VERSION,
  ATLAS_3D_ROCK_RECORD_STRIDE,
  ATLAS_3D_TREE_RECORD_STRIDE,
  ATLAS_3D_TREE_SPECIES,
  atlas3dAxialToScene,
  atlas3dBaseTerrainHeight,
  atlas3dCameraFrame,
  atlas3dFitZoom,
  atlas3dHotSpringSurfaceHeight,
  atlas3dLakeSurfaceHeight,
  atlas3dProject,
  atlas3dPitchFor,
  atlas3dSceneToAxial,
  atlas3dScreenToGround,
  atlas3dTerrainColor,
  atlas3dTerrainHeight,
  atlas3dTerrainHeightAt,
  atlas3dWindowFloor,
  buildAtlas3dChunk,
  centerAtlas3dCamera,
  clampAtlas3dCamera,
  fitAtlas3dCamera,
  panAtlas3dCamera,
  northernRidgeElevationBoostAt,
  registerAtlas3dChunkHeights,
  releaseAtlas3dChunkHeights,
  zoomAtlas3dCamera,
} from "./worldAtlas3dModel.js";

const VIEWPORT = { width: 960, height: 540 };

describe("true 3D atlas spatial model", () => {
  it("eases camera pitch monotonically from overview to close diorama", () => {
    const fit = 0.45;
    const degrees = [fit, fit * 2, fit * 7, 26].map((zoom) => (
      atlas3dPitchFor(zoom, fit) * 180 / Math.PI
    ));
    expect(degrees[0]).toBeCloseTo(ATLAS_3D_FIT_PITCH_DEG, 8);
    expect(degrees[1]).toBeGreaterThan(degrees[0]);
    expect(degrees[2]).toBeGreaterThan(degrees[1]);
    expect(degrees[3]).toBeCloseTo(ATLAS_3D_NEAR_PITCH_DEG, 8);
  });

  it("raises continuous relief instead of fixed per-category steps", () => {
    const heightFor = (terrain, elevation) => (
      atlas3dTerrainHeight({ land: true, terrain, elevation })
    );
    // Relief tracks the elevation field continuously within each category…
    expect(heightFor("mountains", 0.9)).toBeGreaterThan(heightFor("mountains", 0.7));
    expect(heightFor("mountains", 0.7)).toBeGreaterThan(heightFor("mountains", 0.5));
    expect(heightFor("hills", 0.7)).toBeGreaterThan(heightFor("hills", 0.45));
    // …and the fixed category pedestals are gone entirely at their threshold.
    expect(heightFor("mountains", 0.5) - heightFor("plains", 0.5)).toBe(0);
    expect(heightFor("hills", 0.38) - heightFor("plains", 0.38)).toBe(0);
    // …and the terrain ceiling still clamps.
    expect(heightFor("mountains", 2)).toBe(42);
  });

  it("adds the authored northern ridge elevation without duplicating overlaps", () => {
    const coord = NORTHERN_RIDGES[0].waypoints[1];
    const sample = { land: true, terrain: "plains", elevation: 0.5 };
    expect(northernRidgeElevationBoostAt(coord)).toBeCloseTo(0.18, 8);
    // The authored boost dominates the gap; deterministic erosion octaves
    // jitter the exact figure by roughly a unit either way.
    expect(atlas3dTerrainHeight(sample, coord) - atlas3dTerrainHeight(sample))
      .toBeGreaterThan(2.5);
  });

  it("uses continuous northern relief instead of terrain-category spikes", () => {
    const coord = { x: 180, y: -350 };
    const shared = { land: true, realmId: "north", elevation: 0.72 };
    const heights = ["plains", "hills", "mountains", "forest"].map((terrain) => (
      atlas3dTerrainHeight({ ...shared, terrain }, coord)
    ));

    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1e-8);
    expect(heights[0]).toBeGreaterThan(3.5);
    expect(heights[0]).toBeLessThan(30);
  });

  it("does not cut frozen northern terrain across the eastern realm at y=-170", () => {
    const sample = { land: true, realmId: "east", terrain: "plains", elevation: 0.52 };
    const above = { x: 300, y: -169 };
    const below = { x: 300, y: -170 };
    const aboveHeight = atlas3dBaseTerrainHeight(sample, above);
    const belowHeight = atlas3dBaseTerrainHeight(sample, below);
    const aboveColor = atlas3dTerrainColor(sample, above, aboveHeight);
    const belowColor = atlas3dTerrainColor(sample, below, belowHeight);

    expect(Math.abs(aboveHeight - belowHeight)).toBeLessThan(0.5);
    expect(Math.hypot(...aboveColor.map((channel, index) => channel - belowColor[index])))
      .toBeLessThan(0.02);
  });

  it("recesses every authored lake and hot spring beneath its shared level surface", () => {
    for (const [feature, surfaceHeight] of [
      ...CONTINENT_LAKES.map((lake) => [lake, atlas3dLakeSurfaceHeight(lake, CONTINENT.seed)]),
      ...CONTINENT_HOT_SPRINGS.map((spring) => [spring, atlas3dHotSpringSurfaceHeight(spring, CONTINENT.seed)]),
    ]) {
      const centerScene = atlas3dAxialToScene(feature.center);
      const centerSample = surveyAtlas(feature.center.x, feature.center.y, CONTINENT.seed);
      expect(atlas3dTerrainHeight(centerSample, feature.center, CONTINENT.seed))
        .toBeLessThan(surfaceHeight - 0.25);

      for (let index = 0; index < 24; index += 1) {
        const angle = index / 24 * Math.PI * 2;
        const coord = atlas3dSceneToAxial({
          x: centerScene.x + Math.cos(angle) * feature.radius * 0.95,
          z: centerScene.z + Math.sin(angle) * feature.radius * 0.95,
        });
        const sample = surveyAtlas(coord.x, coord.y, CONTINENT.seed);
        expect(atlas3dTerrainHeight(sample, coord, CONTINENT.seed)).toBeLessThan(surfaceHeight - 0.25);
      }

      const outside = atlas3dSceneToAxial({
        x: centerScene.x + feature.radius + 20,
        z: centerScene.z,
      });
      const outsideSample = surveyAtlas(outside.x, outside.y, CONTINENT.seed);
      expect(atlas3dTerrainHeight(outsideSample, outside, CONTINENT.seed))
        .toBeCloseTo(atlas3dBaseTerrainHeight(outsideSample, outside), 8);
    }
  });

  it("applies deterministic snow-cap and sandy coastline color tiers", () => {
    const coord = { x: 24, y: -42 };
    const mountain = { land: true, terrain: "mountains", elevation: 1, realmId: "north" };
    const unsnowed = atlas3dTerrainColor(mountain, coord, 30, CONTINENT.seed);
    const snowed = atlas3dTerrainColor(mountain, coord, 32, CONTINENT.seed);
    const snowTarget = [0xd8 / 255, 0xdd / 255, 0xd0 / 255];
    const distanceToSnow = (channels) => Math.hypot(
      channels[0] - snowTarget[0],
      channels[1] - snowTarget[1],
      channels[2] - snowTarget[2],
    );
    expect(distanceToSnow(snowed)).toBeLessThan(distanceToSnow(unsnowed));

    const plain = { land: true, terrain: "plains", elevation: 0.4, realmId: "central" };
    const inland = atlas3dTerrainColor(plain, coord, 7, CONTINENT.seed, false);
    const coast = atlas3dTerrainColor(plain, coord, 7, CONTINENT.seed, true);
    const sandTarget = [0xb8 / 255, 0xa8 / 255, 0x70 / 255];
    coast.forEach((channel, index) => {
      expect(channel).toBeCloseTo(inland[index] * 0.6 + sandTarget[index] * 0.4, 8);
    });
  });

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

  it("keeps the camera target in authoritative axial coordinates", () => {
    const coord = { x: 131, y: -96 };
    const camera = centerAtlas3dCamera(
      fitAtlas3dCamera({ x: 0, y: 0, zoom: 1 }, VIEWPORT),
      VIEWPORT,
      coord,
      4,
    );
    const frame = atlas3dCameraFrame(camera, VIEWPORT);
    const target = atlas3dSceneToAxial({ x: frame.target.x, z: frame.target.z });

    expect(camera.x).toBeCloseTo(coord.x, 8);
    expect(camera.y).toBeCloseTo(coord.y, 8);
    expect(target.x).toBeCloseTo(camera.x, 8);
    expect(target.y).toBeCloseTo(camera.y, 8);
  });

  it("clamps extreme axial centers by the zoom footprint plus a coastal inset", () => {
    const zoom = 26;
    const fit = atlas3dFitZoom(VIEWPORT, CONTINENT.seed);
    const visibleFraction = fit / zoom;
    const halfFootprint = {
      x: ((CONTINENT.bounds.xmax - CONTINENT.bounds.xmin) * visibleFraction
        + ATLAS_3D_CAMERA_COAST_INSET * 2) / 2,
      y: ((CONTINENT.bounds.ymax - CONTINENT.bounds.ymin) * visibleFraction
        + ATLAS_3D_CAMERA_COAST_INSET * 2) / 2,
    };
    const northEast = clampAtlas3dCamera({
      x: Number.POSITIVE_INFINITY,
      y: Number.NEGATIVE_INFINITY,
      zoom,
      targetHeight: 0.4,
    }, VIEWPORT);
    const southWest = clampAtlas3dCamera({
      x: Number.NEGATIVE_INFINITY,
      y: Number.POSITIVE_INFINITY,
      zoom,
      targetHeight: 0.4,
    }, VIEWPORT);

    expect(northEast.x).toBeCloseTo(CONTINENT.bounds.xmax - halfFootprint.x, 8);
    expect(northEast.y).toBeCloseTo(CONTINENT.bounds.ymin + halfFootprint.y, 8);
    expect(southWest.x).toBeCloseTo(CONTINENT.bounds.xmin + halfFootprint.x, 8);
    expect(southWest.y).toBeCloseTo(CONTINENT.bounds.ymax - halfFootprint.y, 8);
    expect(northEast.x).toBeLessThan(CONTINENT.bounds.xmax - ATLAS_3D_CAMERA_COAST_INSET);
    expect(northEast.y).toBeGreaterThan(CONTINENT.bounds.ymin + ATLAS_3D_CAMERA_COAST_INSET);
  });

  it("projects and picks the camera target through a real perspective frame", () => {
    const camera = clampAtlas3dCamera({ x: 0, y: 0, zoom: 3 }, VIEWPORT);
    const target = atlas3dScreenToGround(camera, VIEWPORT, { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 });
    const screen = atlas3dProject(camera, VIEWPORT, target, target.height);
    expect(screen.x).toBeCloseTo(VIEWPORT.width / 2, 3);
    expect(screen.y).toBeCloseTo(VIEWPORT.height / 2, 3);
    expect(screen.visible).toBe(true);
  });

  it("keeps the ground below an off-center cursor fixed while dollying", () => {
    const camera = clampAtlas3dCamera({ x: 20, y: -35, zoom: 2.8 }, VIEWPORT);
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
    const camera = clampAtlas3dCamera({
      x: focus.x,
      y: focus.y,
      zoom: 26,
    }, viewport);
    const frame = atlas3dCameraFrame(camera, viewport, CONTINENT.seed);
    const footprint = atlas3dSceneToAxial(frame.position);
    const terrainBelowCamera = atlas3dTerrainHeightAt(footprint, CONTINENT.seed);
    expect(frame.position.y - terrainBelowCamera).toBeGreaterThanOrEqual(2.99);
  });

  it("keeps a real terrain point beneath the zoom anchor", () => {
    const camera = clampAtlas3dCamera({ x: 0, y: 0, zoom: 2.8 }, VIEWPORT);
    const coord = { x: 156, y: -134 };
    const terrainHeight = atlas3dTerrainHeightAt(coord, CONTINENT.seed);
    const ground = { ...coord, scene: atlas3dAxialToScene(coord), height: terrainHeight };
    const anchor = atlas3dProject(camera, VIEWPORT, coord, terrainHeight, CONTINENT.seed);
    const zoomed = zoomAtlas3dCamera(camera, VIEWPORT, 1.7, anchor, CONTINENT.seed, () => ground);
    const after = atlas3dProject(zoomed, VIEWPORT, coord, terrainHeight, CONTINENT.seed);
    expect(Math.hypot(after.x - anchor.x, after.y - anchor.y)).toBeLessThan(1);
  });

  it("damps zoom correction across steep target-height changes", () => {
    const camera = { x: -68.8394311805854, y: -182.3211376388292, zoom: 12 };
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
    const camera = { x: 434.42914129192167, y: -223.20779230360253, zoom: 13.78598650433123 };
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
    const camera = { x: 347.1739551816079, y: -328.9669249104222, zoom: 5.775092225277389 };
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

  it("keeps an off-domain near-horizon zoom bounded to the authored camera domain", () => {
    const camera = { x: 244.64363027307945, y: -355.6353665783963, zoom: 9.246612178420586 };
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
    expect(ground.y).toBeLessThan(CONTINENT.bounds.ymin);
    expect(zoomed.x).toBeGreaterThanOrEqual(CONTINENT.bounds.xmin);
    expect(zoomed.x).toBeLessThanOrEqual(CONTINENT.bounds.xmax);
    expect(zoomed.y).toBeGreaterThanOrEqual(CONTINENT.bounds.ymin);
    expect(zoomed.y).toBeLessThanOrEqual(CONTINENT.bounds.ymax);
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
    const camera = { x: 141.91767065449682, y: -131.15514130899365, zoom: 1.78894 };
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
    const camera = clampAtlas3dCamera({
      x: 407.2133700658172,
      y: -283.195746052838,
      zoom: atlas3dWindowFloor(VIEWPORT) * 1.2,
    }, VIEWPORT);
    const delta = { x: -4.101750068366528, y: 35.15628867549822 };
    const scene = { x: 335.6379863306885, z: -286.30047665070515 };
    const ground = { ...atlas3dSceneToAxial(scene), scene, height: -1.55 };
    const anchor = atlas3dProject(camera, VIEWPORT, ground, ground.height, CONTINENT.seed);
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
    const camera = fitAtlas3dCamera({ x: 0, y: 0, zoom: 1 }, VIEWPORT, CONTINENT.seed);
    expect(camera.zoom).toBeCloseTo(atlas3dFitZoom(VIEWPORT, CONTINENT.seed), 8);
    const sampleAxis = (min, max, stride) => {
      const values = [];
      for (let value = min; value <= max; value += stride) values.push(value);
      if (values.at(-1) !== max) values.push(max);
      return values;
    };
    for (const y of sampleAxis(CONTINENT.bounds.ymin, CONTINENT.bounds.ymax, 24)) {
      for (const x of sampleAxis(CONTINENT.bounds.xmin, CONTINENT.bounds.xmax, 24)) {
        const coord = { x, y };
        const height = atlas3dTerrainHeight(surveyAtlas(x, y, CONTINENT.seed), coord, CONTINENT.seed);
        const screen = atlas3dProject(camera, VIEWPORT, coord, height, CONTINENT.seed);
        expect(screen.x).toBeGreaterThanOrEqual(0);
        expect(screen.x).toBeLessThanOrEqual(VIEWPORT.width);
        expect(screen.y).toBeGreaterThanOrEqual(0);
        expect(screen.y).toBeLessThanOrEqual(VIEWPORT.height);
      }
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

  it("builds deterministic streamed chunk buffers independent of any camera", () => {
    const coords = [[0, 0], [-1, -1], [4, 0]];
    const first = coords.map(([cx, cy]) => buildAtlas3dChunk(CONTINENT.seed, cx, cy, 0));
    const second = coords.map(([cx, cy]) => buildAtlas3dChunk(CONTINENT.seed, cx, cy, 0));

    for (let index = 0; index < first.length; index += 1) {
      const chunk = first[index];
      const repeat = second[index];
      expect(chunk.version).toBe(ATLAS_3D_RENDER_VERSION);
      expect(chunk.empty).toBe(false);
      expect(chunk.positions).toEqual(repeat.positions);
      expect(chunk.colors).toEqual(repeat.colors);
      expect(chunk.coastal).toEqual(repeat.coastal);
      expect(chunk.ao).toEqual(repeat.ao);
      expect(chunk.shore).toEqual(repeat.shore);
      expect(chunk.indices).toEqual(repeat.indices);
      expect(chunk.trees).toEqual(repeat.trees);
      expect(chunk.rocks).toEqual(repeat.rocks);
      expect(chunk.fields).toEqual(repeat.fields);
      expect(chunk.environs).toEqual(repeat.environs);
      expect(chunk.surfaceVertexCount).toBe(chunk.rows * chunk.columns);
      expect(chunk.positions.length).toBe((chunk.surfaceVertexCount + chunk.skirtVertexCount) * 3);
      expect(chunk.coastal).toBeInstanceOf(Uint8Array);
      expect(chunk.coastal.length).toBe(chunk.positions.length / 3);
      expect(chunk.ao).toBeInstanceOf(Uint8Array);
      expect(chunk.ao.length).toBe(chunk.positions.length / 3);
      expect(chunk.ao.every((value) => value > 0)).toBe(true);
      expect(chunk.shore).toBeInstanceOf(Uint8Array);
      expect(chunk.shore.length).toBe(chunk.positions.length / 3);
      expect(chunk.indices.length).toBeGreaterThan((chunk.rows - 1) * (chunk.columns - 1) * 6);
      expect(chunk.trees.length % ATLAS_3D_TREE_RECORD_STRIDE).toBe(0);
      expect(chunk.rocks.length % ATLAS_3D_ROCK_RECORD_STRIDE).toBe(0);
      expect(chunk.fields.length % ATLAS_3D_FIELD_RECORD_STRIDE).toBe(0);
      expect(chunk.environs.length % ATLAS_3D_ENVIRON_RECORD_STRIDE).toBe(0);
    }

    const species = new Set();
    for (const chunk of first) {
      for (let offset = 0; offset < chunk.trees.length; offset += ATLAS_3D_TREE_RECORD_STRIDE) {
        species.add(chunk.trees[offset + 7]);
      }
    }
    expect(species).toContain(ATLAS_3D_TREE_SPECIES.cherry);
    expect(species).toContain(ATLAS_3D_TREE_SPECIES.ginkgo);
    expect(first.some((chunk) => chunk.rocks.length > 0)).toBe(true);
    expect(first.some((chunk) => chunk.fields.length > 0)).toBe(true);
    expect(first.some((chunk) => chunk.environs.length > 0)).toBe(true);
    const heights = first.flatMap((chunk) => (
      Array.from(chunk.positions).filter((_, component) => component % 3 === 1)
    ));
    expect(Math.max(...heights)).toBeGreaterThan(8);
    expect(Math.min(...heights)).toBeLessThan(0);
  });

  it("activates overlay heights only when a streamed chunk is presented", () => {
    const seed = 987654321;
    const chunk = buildAtlas3dChunk(seed, 0, 0, 1);
    const local = { x: 6, y: 8 };
    const coord = { x: chunk.origin.x + local.x, y: chunk.origin.y + local.y };
    const analyticHeight = atlas3dTerrainHeightAt(coord, seed);
    const displayedHeight = 17.25;
    const payload = {
      ...chunk,
      heights: chunk.heights.slice(),
      positions: chunk.positions.slice(),
    };
    payload.heights[local.y * 25 + local.x] = displayedHeight;
    const meshVertex = (local.y / chunk.stride) * chunk.columns + local.x / chunk.stride;
    payload.positions[meshVertex * 3 + 1] = displayedHeight;

    expect(atlas3dTerrainHeightAt(coord, seed)).toBeCloseTo(analyticHeight, 8);
    expect(registerAtlas3dChunkHeights(payload)).toBe(true);
    expect(atlas3dTerrainHeightAt(coord, seed)).toBeCloseTo(displayedHeight, 5);
    expect(releaseAtlas3dChunkHeights(payload)).toBe(true);
    expect(atlas3dTerrainHeightAt(coord, seed)).toBeCloseTo(analyticHeight, 8);
  });

  it("includes clipped domain-edge land in the exact three-hex coastline band", () => {
    const chunk = buildAtlas3dChunk(CONTINENT.seed, -1, -17, 0);
    const northernLandVertices = [];
    for (let vertex = 0; vertex < chunk.surfaceVertexCount; vertex += 1) {
      const coord = atlas3dSceneToAxial({
        x: chunk.positions[vertex * 3],
        z: chunk.positions[vertex * 3 + 2],
      });
      if (Math.abs(coord.y - CONTINENT.bounds.ymin) < 0.001
        && surveyAtlas(coord.x, coord.y, CONTINENT.seed).land) {
        northernLandVertices.push(vertex);
      }
    }

    expect(northernLandVertices.length).toBeGreaterThan(0);
    expect(northernLandVertices.every((vertex) => chunk.coastal[vertex] === 1)).toBe(true);
  });

  it("places overlays on the same piecewise-linear surface as the presented chunk", () => {
    const chunk = buildAtlas3dChunk(CONTINENT.seed, 0, 0, 1);
    const row = 4;
    const column = 5;
    const heightAtVertex = (vertex) => chunk.positions[vertex * 3 + 1];
    const aIndex = row * chunk.columns + column;
    const bIndex = aIndex + 1;
    const cIndex = aIndex + chunk.columns;
    const dIndex = cIndex + 1;
    const a = atlas3dSceneToAxial({
      x: chunk.positions[aIndex * 3],
      z: chunk.positions[aIndex * 3 + 2],
    });
    const d = atlas3dSceneToAxial({
      x: chunk.positions[dIndex * 3],
      z: chunk.positions[dIndex * 3 + 2],
    });

    expect(registerAtlas3dChunkHeights(chunk)).toBe(true);
    try {
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
        expect(atlas3dTerrainHeightAt(coord, CONTINENT.seed)).toBeCloseTo(expected, 5);
      }
    } finally {
      releaseAtlas3dChunkHeights(chunk);
    }
  });

  it("sculpts the authored Whitemarch city into the city chunks' terrain", () => {
    // The city (radius 12) spans chunks (-1,-1), (0,-1), (-1,0), (0,0); each
    // chunk stores heights relative to its own origin at stride 1.
    const chunks = [[0, 0], [-1, 0], [0, -1], [-1, -1]]
      .map(([cx, cy]) => buildAtlas3dChunk(CONTINENT.seed, cx, cy, 0));
    for (const chunk of chunks) expect(chunk.empty).toBe(false);
    const heightAt = (x, y) => {
      for (const chunk of chunks) {
        const column = x - chunk.origin.x;
        const row = y - chunk.origin.y;
        if (column >= 0 && row >= 0 && column < chunk.columns && row < chunk.rows) {
          return chunk.heights[row * chunk.columns + column];
        }
      }
      throw new Error(`no city chunk covers ${x},${y}`);
    };

    // The Whitewend river carves a channel below the surrounding wards.
    const riverBed = heightAt(4, -4);
    const westBank = heightAt(2, -4);
    const eastBank = heightAt(7, -4);
    expect(riverBed).toBeLessThan(Math.min(westBank, eastBank) - 0.4);

    // The wall ring at radius 10 stands above the wards immediately inside it.
    expect(heightAt(0, 10)).toBeGreaterThan(heightAt(0, 8) + 0.3);
    expect(heightAt(10, 0)).toBeGreaterThan(heightAt(8, 0) + 0.3);
    expect(heightAt(-10, 0)).toBeGreaterThan(heightAt(-8, 0) + 0.3);

    // Built-up wards are flattened toward a plateau: distant street tiles
    // inside the walls sit much closer in height than raw erosion would allow.
    expect(Math.abs(heightAt(-2, 1) - heightAt(-6, 4))).toBeLessThan(1.5);
    expect(Math.abs(heightAt(0, 0) - heightAt(7, 0))).toBeLessThan(1.5);
  });
});
