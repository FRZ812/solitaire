import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  CONTINENT,
  CONTINENT_HOT_SPRINGS,
  LANDMARKS,
} from "../../data/continent.js";
import {
  atlasEastFloraVariant,
  atlasPropDetailVisible,
  atlasWorldLightState,
  batchLandmarkMeshGroup,
  createAtlasChunkPropBatch,
  createAtlasTerrainGeometry,
  createEnvironsGroup,
  createFieldGroup,
  createHotSprings,
  createLandmarkMeshGroup,
  createMountainClouds,
  createRockGroup,
  createRibbonMesh,
  createInsetLake,
  createVegetationGroup,
  createWhitewendCityRiver,
  whitewendCityWaterPath,
  REALM_SETTLEMENT_COLORS,
  atlas3dStreamFailureDisposition,
  atlas3dStreamingRect,
} from "./WorldAtlas3DScene.jsx";
import {
  atlas3dChunkForAxial,
  atlas3dCameraFrame,
  atlas3dFitZoom,
  atlas3dHotSpringSurfaceHeight,
  atlas3dLakeSurfaceHeight,
  atlas3dTerrainHeightAt,
  atlas3dWhitewendSurfaceHeight,
  atlas3dWindowFloor,
  buildAtlas3dChunk,
  clampAtlas3dCamera,
  registerAtlas3dChunkHeights,
  releaseAtlas3dChunkHeights,
} from "./worldAtlas3dModel.js";
import { desiredAtlasChunks } from "./atlasChunkStore.js";
import { setDressingForChunk } from "../../engine/atlas-set-dressing.js";

function ribbonWidthAt(position, sampleIndex) {
  const offset = sampleIndex * 6;
  return Math.hypot(
    position.array[offset] - position.array[offset + 3],
    position.array[offset + 2] - position.array[offset + 5],
  );
}

function centerAt(position, sampleIndex) {
  const offset = sampleIndex * 6;
  return {
    x: (position.array[offset] + position.array[offset + 3]) / 2,
    z: (position.array[offset + 2] + position.array[offset + 5]) / 2,
  };
}

function geometryTypeCounts(group) {
  return group.children.reduce((counts, child) => {
    const type = child.geometry?.type;
    if (type) counts[type] = (counts[type] || 0) + 1;
    return counts;
  }, {});
}

function colorHexes(group) {
  return new Set(group.children.map((child) => child.material?.color?.getHex()));
}

describe("WorldAtlas3DScene rendering helpers", () => {
  it("escalates non-cancellation stream failures after first paint", () => {
    const error = new Error("chunk timed out");
    expect(atlas3dStreamFailureDisposition(error, {
      ready: true,
      pendingCount: 4,
      uploadCount: 2,
    })).toBe("fatal");
    expect(atlas3dStreamFailureDisposition(
      Object.assign(new Error("cancelled"), { name: "AbortError" }),
      { ready: true },
    )).toBe("ignore");
    expect(atlas3dStreamFailureDisposition(error, {
      ready: false,
      pendingCount: 1,
      uploadCount: 0,
    })).toBe("wait");
    expect(atlas3dStreamFailureDisposition(error, {
      ready: false,
      pendingCount: 0,
      uploadCount: 0,
    })).toBe("startup");
  });

  it("samples ribbons through a 200-division Catmull-Rom curve and widens rivers toward the mouth", () => {
    class TrackedCatmullRomCurve3 extends THREE.CatmullRomCurve3 {
      static constructorCalls = [];
      static sampleCalls = [];

      constructor(...args) {
        super(...args);
        TrackedCatmullRomCurve3.constructorCalls.push(args);
      }

      getPoints(divisions) {
        TrackedCatmullRomCurve3.sampleCalls.push(divisions);
        return super.getPoints(divisions);
      }
    }

    const path = [
      { x: -120, y: -90 },
      { x: -35, y: -20 },
      { x: 30, y: 105 },
      { x: 175, y: 35 },
    ];
    const mesh = createRibbonMesh({ ...THREE, CatmullRomCurve3: TrackedCatmullRomCurve3 }, path, {
      seed: CONTINENT.seed,
      width: 1.9,
      widthStart: 1.4,
      widthEnd: 2.6,
      color: 0x65bfd2,
      water: true,
    });
    const roadMesh = createRibbonMesh(THREE, path, {
      seed: CONTINENT.seed,
      width: 1.9,
      color: 0xe7bd6f,
    });
    const position = mesh.geometry.getAttribute("position");

    expect(TrackedCatmullRomCurve3.constructorCalls).toHaveLength(1);
    expect(TrackedCatmullRomCurve3.constructorCalls[0][0]).toHaveLength(path.length);
    expect(TrackedCatmullRomCurve3.constructorCalls[0][1]).toBe(false);
    expect(TrackedCatmullRomCurve3.constructorCalls[0][2]).toBe("centripetal");
    expect(TrackedCatmullRomCurve3.sampleCalls).toEqual([200]);
    expect(position.count).toBe(402);
    expect(mesh.geometry.getAttribute("uv").count).toBe(position.count);
    expect(mesh.geometry.getAttribute("normal").count).toBe(position.count);
    expect(mesh.geometry.index.count).toBe(1_200);
    expect(mesh.renderOrder).toBe(1);
    expect(roadMesh.renderOrder).toBe(2);
    expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(mesh.receiveShadow).toBe(true);
    expect(roadMesh.receiveShadow).toBe(true);
    expect(ribbonWidthAt(position, 0)).toBeCloseTo(1.4, 4);
    expect(ribbonWidthAt(position, 100)).toBeCloseTo(2.0, 4);
    expect(ribbonWidthAt(position, 200)).toBeCloseTo(2.6, 4);

    const halfway = centerAt(position, 100);
    const straightHalfway = {
      x: (centerAt(position, 0).x + centerAt(position, 200).x) / 2,
      z: (centerAt(position, 0).z + centerAt(position, 200).z) / 2,
    };
    expect(Math.hypot(halfway.x - straightHalfway.x, halfway.z - straightHalfway.z)).toBeGreaterThan(10);
  });

  it("binds normalized worker AO and shore data to the terrain geometry", () => {
    const data = {
      positions: new Float32Array([
        0, 0, 0,
        1, 0, 0,
        0, 0, 1,
        1, 0, 1,
      ]),
      colors: new Float32Array(12).fill(0.5),
      ao: new Uint8Array([64, 128, 192, 255]),
      shore: new Uint8Array([255, 192, 64, 0]),
      indices: new Uint32Array([0, 2, 1, 1, 2, 3]),
    };
    const geometry = createAtlasTerrainGeometry(THREE, data);

    expect(geometry.getAttribute("atlasAo").array).toBe(data.ao);
    expect(geometry.getAttribute("atlasAo").normalized).toBe(true);
    expect(geometry.getAttribute("shore").array).toBe(data.shore);
    expect(geometry.getAttribute("shore").normalized).toBe(true);
    expect(geometry.getAttribute("normal").count).toBe(4);
    expect(geometry.getAttribute("uv").count).toBe(4);
    expect(geometry.index.array).toBe(data.indices);
  });

  it("bounds the live 3D footprint and batches a deterministic chunk's props into one draw surface", () => {
    for (const viewport of [
      { width: 960, height: 540 },
      { width: 390, height: 720 },
    ]) {
      const camera = clampAtlas3dCamera({
        ...CONTINENT.start.coord,
        zoom: atlas3dWindowFloor(viewport),
      }, viewport);
      const rect = atlas3dStreamingRect(camera, viewport);
      const plan = desiredAtlasChunks({ rect, focus: camera, lod0Radius: 2 });
      const frame = atlas3dCameraFrame(camera, viewport);

      expect(camera.zoom / atlas3dFitZoom(viewport)).toBeGreaterThan(8);
      expect(frame.visibleWidth).toBeLessThanOrEqual(128);
      expect(rect.xmax - rect.xmin).toBeLessThanOrEqual(132);
      expect(rect.ymax - rect.ymin).toBeLessThanOrEqual(132);
      expect(plan.length).toBeLessThanOrEqual(64);
    }

    const center = atlas3dChunkForAxial(CONTINENT.start.coord);
    const chunk = buildAtlas3dChunk(CONTINENT.seed, center.cx, center.cy, 0);
    const props = createAtlasChunkPropBatch(THREE, chunk, CONTINENT.seed, {
      id: "high",
      propDensity: 1,
      chunkPropCap: 120,
    });

    expect(props.userData.count).toBeLessThanOrEqual(120);
    expect(props.children).toHaveLength(props.userData.count ? 1 : 0);
    if (props.children.length) {
      expect(props.children[0].isBatchedMesh).toBe(true);
      expect(props.children[0].maxInstanceCount).toBe(props.userData.count);
    }
  });

  it("seats generated LOD 1 dressing on the active displayed triangle surface", () => {
    const chunk = buildAtlas3dChunk(CONTINENT.seed, 14, -14, 1);
    const dressing = setDressingForChunk(CONTINENT.seed, chunk.cx, chunk.cy, { scatterCap: 8 });
    expect(dressing).toHaveLength(1);
    expect(registerAtlas3dChunkHeights(chunk)).toBe(true);
    try {
      const props = createAtlasChunkPropBatch(THREE, chunk, CONTINENT.seed, {
        id: "high",
        propDensity: 1,
        chunkPropCap: 120,
      });
      const batch = props.getObjectByName("atlas-chunk-prop-batch");
      const transform = new THREE.Matrix4();
      const position = new THREE.Vector3();
      batch.getMatrixAt(0, transform);
      position.setFromMatrixPosition(transform);
      const expectedOffset = dressing[0].kind === "bridge" ? 0.25 : 0.04;

      expect(props.userData.dressingCount).toBe(1);
      expect(position.y).toBeCloseTo(
        atlas3dTerrainHeightAt(dressing[0], CONTINENT.seed) + expectedOffset,
        5,
      );
    } finally {
      releaseAtlas3dChunkHeights(chunk);
    }
  });

  it("partitions deterministic species-aware tree instances into core and detail LODs", () => {
    const treeData = new Float32Array([
      10, 2, 10, 1, 0, 1, 0, 0,
      20, 3, 20, 1, 0.2, 0.94, 0, 1,
      30, 1, 30, 0.9, 0.4, 0.92, 3, 2,
      40, 2, 40, 1.1, 0.6, 1, 2, 3,
      50, 2, 50, 1.05, 0.8, 0.96, 2, 4,
    ]);
    const group = createVegetationGroup(THREE, treeData, CONTINENT.seed, { id: "high", propDensity: 1 });
    const core = group.getObjectByName("atlas-vegetation-core");
    const detail = group.getObjectByName("atlas-vegetation-detail");

    expect(group.userData.treeCounts.total).toBe(5);
    expect(group.userData.treeCounts.conifer).toBe(1);
    expect(group.userData.treeCounts.broadleaf).toBe(1);
    expect(group.userData.treeCounts.scrub).toBe(1);
    expect(group.userData.treeCounts.cherry).toBe(1);
    expect(group.userData.treeCounts.ginkgo).toBe(1);
    expect(group.userData.treeCounts.core + group.userData.treeCounts.detail).toBe(5);
    expect(group.userData.detailGroup).toBe(detail);
    expect(detail.visible).toBe(false);
    expect([...core.children, ...detail.children].every((child) => child.isInstancedMesh)).toBe(true);
  });

  it("uses hysteresis for prop detail and permanently suppresses it on low quality", () => {
    expect(atlasPropDetailVisible(false, 2.19, "high")).toBe(false);
    expect(atlasPropDetailVisible(false, 2.2, "high")).toBe(true);
    expect(atlasPropDetailVisible(true, 1.81, "medium")).toBe(true);
    expect(atlasPropDetailVisible(true, 1.8, "medium")).toBe(false);
    expect(atlasPropDetailVisible(true, 5, "low")).toBe(false);
  });

  it("builds instanced rocks, furrowed fields, and settlement outskirts from worker records", () => {
    const rocks = createRockGroup(THREE, new Float32Array([
      1, 2, 3, 1, 0, 0,
      4, 2, 6, 1.2, 0.4, 1,
      8, 3, 9, 0.8, 0.8, 2,
    ]), CONTINENT.seed, { propDensity: 1 });
    const fields = createFieldGroup(THREE, new Float32Array([
      5, 1, 7, 6, 3, 0.3, 2,
    ]), CONTINENT.seed, { propDensity: 1 });
    const environs = createEnvironsGroup(THREE, new Float32Array([
      2, 1, 4, 1, 0.2, 0,
      6, 1, 8, 1.2, 0.7, 1,
    ]), CONTINENT.seed, { propDensity: 1 });

    expect(rocks.userData.count).toBe(3);
    expect(rocks.children).toHaveLength(3);
    expect(rocks.children.every((child) => child.isInstancedMesh)).toBe(true);
    expect(fields.userData.count).toBe(1);
    expect(fields.children[0]).toBeInstanceOf(THREE.InstancedMesh);
    expect(fields.children[0].material.map).toBeInstanceOf(THREE.DataTexture);
    expect(fields.children[0].material.polygonOffset).toBe(true);
    expect(fields.userData.disposables).toEqual([fields.children[0].material.map]);
    expect(environs.userData.count).toBe(2);
    expect(environs.children).toHaveLength(2);
    expect(environs.children.every((child) => child.isInstancedMesh)).toBe(true);
  });

  it("builds deterministic irregular cloud clusters at the mountain cloud ceiling", () => {
    const first = createMountainClouds(THREE, CONTINENT.seed);
    const second = createMountainClouds(THREE, CONTINENT.seed);
    const clusterCounts = new Map();

    expect(first.name).toBe("atlas-mountain-clouds");
    expect(first.children.length).toBeGreaterThan(0);
    expect(second.children.map((cloud) => cloud.position.toArray()))
      .toEqual(first.children.map((cloud) => cloud.position.toArray()));

    for (const cloud of first.children) {
      const match = cloud.name.match(/^atlas-mountain-cloud-(\d+)-\d+$/);
      expect(match).not.toBeNull();
      clusterCounts.set(match[1], (clusterCounts.get(match[1]) || 0) + 1);

      expect(cloud).toBeInstanceOf(THREE.Mesh);
      expect(cloud.geometry.type).toBe("PlaneGeometry");
      expect(cloud.geometry.getAttribute("position").count).toBe(20);
      expect(cloud.geometry.parameters.widthSegments).toBe(4);
      expect(cloud.geometry.parameters.heightSegments).toBe(3);
      expect(cloud.material).toBeInstanceOf(THREE.MeshBasicMaterial);
      expect(cloud.material.color.getHex()).toBe(0xe8eef2);
      expect(cloud.material.map).toBeInstanceOf(THREE.DataTexture);
      expect(cloud.material.map).toBe(first.userData.disposables[0]);
      expect(cloud.material.transparent).toBe(true);
      expect(cloud.material.opacity).toBeGreaterThanOrEqual(0.075);
      expect(cloud.material.opacity).toBeLessThanOrEqual(0.14);
      expect(cloud.material.alphaTest).toBe(0.03);
      expect(cloud.material.side).toBe(THREE.DoubleSide);
      expect(cloud.material.depthWrite).toBe(false);
      expect(cloud.position.y).toBeGreaterThan(25);
    }

    for (const count of clusterCounts.values()) {
      expect(count).toBeGreaterThanOrEqual(4);
      expect(count).toBeLessThanOrEqual(8);
    }
  });

  it("pairs each teal hot-spring pool with a camera-billboarded steam plane", () => {
    const group = createHotSprings(THREE, CONTINENT.seed);

    expect(group.name).toBe("atlas-hot-springs");
    expect(group.children).toHaveLength(CONTINENT_HOT_SPRINGS.length * 3);

    for (const spring of CONTINENT_HOT_SPRINGS) {
      const pool = group.getObjectByName(`atlas-hot-spring-${spring.id}`);
      const rim = group.getObjectByName(`atlas-hot-spring-rim-${spring.id}`);
      const steam = group.getObjectByName(`atlas-hot-spring-steam-${spring.id}`);

      expect(pool.geometry.type).toBe("BufferGeometry");
      expect(pool.geometry.getAttribute("position").count).toBe(29);
      expect(pool.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect(pool.material.color.getHex()).toBe(0x55d8c5);
      expect(pool.material.opacity).toBe(0.92);
      expect(pool.material.transparent).toBe(true);
      expect(pool.material.depthWrite).toBe(false);
      expect(pool.userData.irregularShoreline).toBe(true);
      expect(pool.position.y).toBe(atlas3dHotSpringSurfaceHeight(spring, CONTINENT.seed));

      expect(rim.geometry.type).toBe("BufferGeometry");
      expect(rim.geometry.getAttribute("position").count).toBe(56);
      expect(rim.material.color.getHex()).toBe(0x586052);

      expect(steam.geometry.type).toBe("PlaneGeometry");
      expect(steam.material).toBeInstanceOf(THREE.MeshBasicMaterial);
      expect(steam.material.color.getHex()).toBe(0xe8eef2);
      expect(steam.material.opacity).toBe(0.18);
      expect(steam.material.side).toBe(THREE.DoubleSide);
      expect(steam.material.depthWrite).toBe(false);
      expect(steam.userData.billboard).toBe(true);
      expect(steam.renderOrder).toBe(3);
      expect(steam.position.x).toBe(pool.position.x);
      expect(steam.position.z).toBe(pool.position.z);
      expect(steam.position.y - pool.position.y).toBeCloseTo(2, 8);
    }
  });

  it("keeps inset lake water level while seating it below the surrounding shore", () => {
    const lake = { id: "test-lake", center: { x: 135, y: 40 }, radius: 8 };
    const mesh = createInsetLake(THREE, lake, CONTINENT.seed);
    const position = mesh.geometry.getAttribute("position");
    const localHeights = Array.from({ length: position.count }, (_, index) => position.getY(index));

    expect(mesh.name).toBe("atlas-lake-test-lake");
    expect(mesh.geometry.type).toBe("BufferGeometry");
    expect(mesh.material.color.getHex()).toBe(0x1f7195);
    expect(mesh.material.depthWrite).toBe(false);
    expect(Math.max(...localHeights) - Math.min(...localHeights)).toBeLessThan(1e-7);
    expect(mesh.userData.waterHeight).toBe(mesh.position.y);
    expect(mesh.position.y).toBe(atlas3dLakeSurfaceHeight(lake, CONTINENT.seed));
    expect(mesh.userData.irregularShoreline).toBe(true);
    const radii = Array.from({ length: position.count - 1 }, (_, index) => Math.hypot(
      position.getX(index + 1),
      position.getZ(index + 1),
    ));
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(0.1);
    const shoreline = mesh.getObjectByName("atlas-lake-test-lake-shoreline");
    expect(shoreline.geometry.getAttribute("position").count).toBe(72);
    expect(mesh.renderOrder).toBe(1);
  });

  it("keeps pagodas, villages, and the Caer Selenya wonder visually distinct", () => {
    const group = createLandmarkMeshGroup(THREE, CONTINENT.seed);
    const pagoda = group.getObjectByName("atlas-landmark-temple-still-waters");
    const village = group.getObjectByName("atlas-landmark-alderfield");
    const wonder = group.getObjectByName("atlas-landmark-caer-selenya");
    const city = group.getObjectByName("atlas-landmark-northstar-castle");

    expect(pagoda.userData.landmarkKind).toBe("pagoda");
    expect(geometryTypeCounts(pagoda)).toEqual({
      BoxGeometry: 4,
      CylinderGeometry: 4,
      SphereGeometry: 16,
    });
    expect(colorHexes(pagoda)).toEqual(new Set([0x887a6c, 0x2e2010, 0x2e2820, 0x8a7030, 0x6d552d]));
    expect(pagoda.children.filter((child) => (
      child.geometry.type === "CylinderGeometry" && child.geometry.parameters.radialSegments === 4
    ))).toHaveLength(3);

    expect(village.userData.landmarkKind).toBe("village");
    expect(geometryTypeCounts(village)).toEqual({
      BoxGeometry: 8,
      ConeGeometry: 2,
      CylinderGeometry: 3,
    });
    expect(village.children.filter((child) => (
      child.geometry.type === "BoxGeometry" && Math.abs(child.rotation.z) > 0.1
    ))).toHaveLength(2);
    expect(village.children.filter((child) => (
      child.geometry.type === "CylinderGeometry" && child.geometry.parameters.openEnded
    ))).toHaveLength(1);

    const cityHeightRatio = Math.max(...city.children
      .filter((child) => child.geometry.type === "CylinderGeometry")
      .map((child) => child.geometry.parameters.height))
      / Math.max(...city.children
        .filter((child) => child.geometry.type === "BoxGeometry")
        .map((child) => child.geometry.parameters.height));
    const wonderHeightRatio = Math.max(...wonder.children
      .filter((child) => child.geometry.type === "CylinderGeometry")
      .map((child) => child.geometry.parameters.height))
      / Math.max(...wonder.children
        .filter((child) => child.geometry.type === "BoxGeometry")
        .map((child) => child.geometry.parameters.height));

    expect(wonder.userData.landmarkKind).toBe("wonder");
    expect(wonderHeightRatio).toBeCloseTo(cityHeightRatio * 1.25, 8);
    expect(wonderHeightRatio).toBeGreaterThan(1.4);
    expect(village.userData.miniatureScale).toBe(0.92);
    expect(new THREE.Box3().setFromObject(village).getSize(new THREE.Vector3()).y).toBeGreaterThan(3);
  });

  it("builds a streamed landmark only after its owning chunk provides the exact surface", () => {
    const landmark = LANDMARKS.find((entry) => entry.id === "frostgate");
    const owner = atlas3dChunkForAxial(landmark.coord);
    const chunk = buildAtlas3dChunk(CONTINENT.seed, owner.cx, owner.cy, 0);
    expect(registerAtlas3dChunkHeights(chunk)).toBe(true);
    try {
      const group = createLandmarkMeshGroup(
        THREE,
        CONTINENT.seed,
        (entry) => entry.id === landmark.id,
      );
      expect(group.children).toHaveLength(1);
      expect(group.children[0].name).toBe(`atlas-landmark-${landmark.id}`);
      expect(group.children[0].position.y).toBeCloseTo(
        atlas3dTerrainHeightAt(landmark.coord, CONTINENT.seed),
        7,
      );
    } finally {
      releaseAtlas3dChunkHeights(chunk);
    }
  });

  it("derives longitude-aware daylight from the persistent campaign clock", () => {
    const noon = atlasWorldLightState({ day: 1, hour: 12, minute: 0 }, { x: 0, y: 0 });
    const fallback = atlasWorldLightState(null, { x: 0, y: 0 });
    const west = atlasWorldLightState({ day: 1, hour: 12, minute: 0 }, { x: CONTINENT.bounds.xmin, y: 0 });
    const east = atlasWorldLightState({ day: 1, hour: 12, minute: 0 }, { x: CONTINENT.bounds.xmax, y: 0 });
    const dawn = atlasWorldLightState({ day: 1, hour: 6, minute: 0 }, { x: 0, y: 0 });
    const dusk = atlasWorldLightState({ day: 1, hour: 20, minute: 0 }, { x: 0, y: 0 });
    const night = atlasWorldLightState({ day: 1, hour: 2, minute: 0 }, { x: 0, y: 0 });

    expect(noon.phase).toBe("day");
    expect(noon.daylight).toBe(1);
    expect(fallback.localHour).toBe(noon.localHour);
    expect(east.localHour - west.localHour).toBeCloseTo(6, 8);
    expect(dawn.phase).toBe("dawn");
    expect(dusk.phase).toBe("dusk");
    expect(night.phase).toBe("night");
    expect(night.daylight).toBe(0);
  });

  it("gives settlements a realm-specific stone and roof palette", () => {
    const group = createLandmarkMeshGroup(THREE, CONTINENT.seed);
    const landmarkIds = {
      central: "alderfield",
      north: "northstar-castle",
      east: "tellmar",
      south: "asalan",
      west: "caer-selenya",
    };

    for (const [realmId, landmarkId] of Object.entries(landmarkIds)) {
      const colors = colorHexes(group.getObjectByName(`atlas-landmark-${landmarkId}`));
      const palette = REALM_SETTLEMENT_COLORS[realmId];
      expect(colors, realmId).toContain(palette.stone);
      expect(colors, realmId).toContain(palette.roof);
    }
  });

  it("batches decorative landmark pieces by shared material for live rendering", () => {
    const source = createLandmarkMeshGroup(THREE, CONTINENT.seed);
    const sourceMeshCount = [];
    source.traverse((child) => { if (child.isMesh) sourceMeshCount.push(child); });
    const batched = batchLandmarkMeshGroup(THREE, source);

    expect(sourceMeshCount.length).toBeGreaterThan(500);
    expect(batched.userData.sourceMeshCount).toBe(sourceMeshCount.length);
    expect(batched.userData.batchCount).toBe(batched.children.length);
    expect(batched.children.length).toBeLessThan(30);
    expect(batched.children.every((child) => (
      child.isMesh
        && child.geometry.index === null
        && child.geometry.getAttribute("position").count > 0
        && child.geometry.boundingSphere
    ))).toBe(true);
  });

  it("classifies eastern flora by deterministic noise within its regional bounds", () => {
    const cherryCoord = { x: 320, y: -150 };
    const ginkgoCoord = { x: 335, y: 55 };
    const outsideEastBounds = { x: 20, y: -200 };

    expect(atlasEastFloraVariant(cherryCoord, CONTINENT.seed)).toBe("cherry");
    expect(atlasEastFloraVariant(ginkgoCoord, CONTINENT.seed)).toBe("ginkgo");
    expect(atlasEastFloraVariant(outsideEastBounds, CONTINENT.seed)).toBe("standard");
    expect(atlasEastFloraVariant(cherryCoord, CONTINENT.seed))
      .toBe(atlasEastFloraVariant(cherryCoord, CONTINENT.seed));
    expect(atlasEastFloraVariant(ginkgoCoord, CONTINENT.seed))
      .toBe(atlasEastFloraVariant(ginkgoCoord, CONTINENT.seed));
  });

  it("lays the Whitewend city river as a flat water surface along the authored channel", () => {
    const path = whitewendCityWaterPath();
    expect(path).not.toBeNull();
    // The authored city has a main channel plus the two tails.
    expect(path.centerline.length).toBeGreaterThan(8);
    expect(path.cellCount).toBeGreaterThan(path.centerline.length);

    const river = createWhitewendCityRiver(THREE, CONTINENT.seed);
    expect(river).not.toBeNull();
    expect(river.children.length).toBeGreaterThanOrEqual(1);
    const surface = atlas3dWhitewendSurfaceHeight(CONTINENT.seed);
    // Every water vertex sits exactly on the shared flat water level.
    river.traverse((child) => {
      if (!child.isMesh) return;
      const positions = child.geometry.getAttribute("position");
      for (let index = 0; index < positions.count; index += 1) {
        expect(positions.getY(index)).toBeCloseTo(surface, 5);
      }
    });
    expect(river.userData.waterHeight).toBe(surface);
    expect(river.userData.disposables.length).toBeGreaterThan(0);
  });
});
