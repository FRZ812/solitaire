import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  CONTINENT,
  CONTINENT_HOT_SPRINGS,
} from "../../data/continent.js";
import {
  atlasEastFloraVariant,
  batchLandmarkMeshGroup,
  createHotSprings,
  createLandmarkMeshGroup,
  createMountainClouds,
  createRibbonMesh,
  createInsetLake,
  REALM_SETTLEMENT_COLORS,
} from "./WorldAtlas3DScene.jsx";

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
    expect(mesh.geometry.index.count).toBe(1_200);
    expect(mesh.renderOrder).toBe(1);
    expect(roadMesh.renderOrder).toBe(2);
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
      expect(cloud.geometry.getAttribute("position").count).toBe(4);
      expect(cloud.material).toBeInstanceOf(THREE.MeshBasicMaterial);
      expect(cloud.material.color.getHex()).toBe(0xe8eef2);
      expect(cloud.material.transparent).toBe(true);
      expect(cloud.material.opacity).toBeGreaterThanOrEqual(0.35);
      expect(cloud.material.opacity).toBeLessThanOrEqual(0.55);
      expect(cloud.material.side).toBe(THREE.DoubleSide);
      expect(cloud.material.depthWrite).toBe(false);
      expect(cloud.position.y).toBeGreaterThanOrEqual(22);
      expect(cloud.position.y).toBeLessThanOrEqual(28);

      const position = cloud.geometry.getAttribute("position");
      const halfWidth = cloud.geometry.parameters.width / 2;
      const halfDepth = cloud.geometry.parameters.height / 2;
      const displacements = [];
      for (let vertex = 0; vertex < position.count; vertex += 1) {
        displacements.push(
          Math.abs(Math.abs(position.getX(vertex)) - halfWidth),
          Math.abs(Math.abs(position.getZ(vertex)) - halfDepth),
        );
      }
      expect(Math.max(...displacements)).toBeLessThanOrEqual(2.001);
      expect(Math.max(...displacements)).toBeGreaterThan(0.05);
    }

    for (const count of clusterCounts.values()) {
      expect(count).toBeGreaterThanOrEqual(4);
      expect(count).toBeLessThanOrEqual(8);
    }
  });

  it("pairs each teal hot-spring pool with a camera-billboarded steam plane", () => {
    const group = createHotSprings(THREE, CONTINENT.seed);

    expect(group.name).toBe("atlas-hot-springs");
    expect(group.children).toHaveLength(CONTINENT_HOT_SPRINGS.length * 2);

    for (const spring of CONTINENT_HOT_SPRINGS) {
      const pool = group.getObjectByName(`atlas-hot-spring-${spring.id}`);
      const steam = group.getObjectByName(`atlas-hot-spring-steam-${spring.id}`);

      expect(pool.geometry.type).toBe("CircleGeometry");
      expect(pool.geometry.parameters.radius).toBe(Math.max(1.5, spring.radius));
      expect(pool.geometry.parameters.segments).toBe(24);
      expect(pool.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect(pool.material.color.getHex()).toBe(0x4dbcb0);
      expect(pool.material.opacity).toBe(0.72);
      expect(pool.material.transparent).toBe(true);
      expect(pool.material.depthWrite).toBe(false);

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
    expect(mesh.geometry.type).toBe("CircleGeometry");
    expect(mesh.material.color.getHex()).toBe(0x327c99);
    expect(mesh.material.depthWrite).toBe(false);
    expect(Math.max(...localHeights) - Math.min(...localHeights)).toBeLessThan(1e-7);
    expect(mesh.userData.waterHeight).toBe(mesh.position.y);
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
      SphereGeometry: 13,
    });
    expect(colorHexes(pagoda)).toEqual(new Set([0x887a6c, 0x2e2010, 0x2e2820, 0x8a7030]));
    expect(pagoda.children.filter((child) => (
      child.geometry.type === "CylinderGeometry" && child.geometry.parameters.radialSegments === 4
    ))).toHaveLength(3);

    expect(village.userData.landmarkKind).toBe("village");
    expect(geometryTypeCounts(village)).toEqual({
      BoxGeometry: 5,
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
});
