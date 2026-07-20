import { describe, expect, it } from "vitest";
import { CONTINENT } from "../../data/continent.js";
import {
  ATLAS_3D_CHUNK_SIZE,
  ATLAS_3D_MAX_ZOOM,
  ATLAS_3D_RENDER_VERSION,
  ATLAS_3D_WINDOW_SPAN,
  atlas3dChunkForAxial,
  atlas3dChunkKey,
  atlas3dChunkRect,
  atlas3dCameraFrame,
  atlas3dFitZoom,
  atlas3dSceneToAxial,
  atlas3dTerrainHeightAt,
  atlas3dWindowFloor,
  buildAtlas3dChunk,
  clampAtlas3dCamera,
  fitAtlas3dCamera,
  registerAtlas3dChunkHeights,
  releaseAtlas3dChunkHeights,
} from "./worldAtlas3dModel.js";

const SEED = CONTINENT.seed;
const VIEWPORT = { width: 1024, height: 640 };

function bytes(view) {
  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
}

function expectPayloadBytesEqual(actual, expected) {
  for (const key of [
    "heights",
    "positions",
    "colors",
    "coastal",
    "ao",
    "shore",
    "indices",
    "trees",
    "rocks",
    "fields",
    "environs",
  ]) {
    expect(bytes(actual[key]), key).toEqual(bytes(expected[key]));
  }
}

function edgeVertex(chunk, edge, offset) {
  const { columns } = chunk;
  const row = edge === "left" || edge === "right" ? offset : edge === "bottom" ? columns - 1 : 0;
  const column = edge === "top" || edge === "bottom" ? offset : edge === "right" ? columns - 1 : 0;
  return row * columns + column;
}

function perimeterVertices(columns) {
  const result = [];
  for (let column = 0; column < columns; column += 1) result.push(column);
  for (let row = 1; row < columns; row += 1) result.push(row * columns + columns - 1);
  for (let column = columns - 2; column >= 0; column -= 1) {
    result.push((columns - 1) * columns + column);
  }
  for (let row = columns - 2; row > 0; row -= 1) result.push(row * columns);
  return result;
}

function renderedSurfaceHeightAt(chunk, coord) {
  const localX = Math.max(0, Math.min(chunk.span, coord.x - chunk.origin.x));
  const localY = Math.max(0, Math.min(chunk.span, coord.y - chunk.origin.y));
  const cellCount = chunk.span / chunk.stride;
  const column = Math.min(cellCount - 1, Math.floor(localX / chunk.stride));
  const row = Math.min(cellCount - 1, Math.floor(localY / chunk.stride));
  const u = (localX - column * chunk.stride) / chunk.stride;
  const v = (localY - row * chunk.stride) / chunk.stride;
  const a = chunk.positions[(row * chunk.columns + column) * 3 + 1];
  const b = chunk.positions[(row * chunk.columns + column + 1) * 3 + 1];
  const c = chunk.positions[((row + 1) * chunk.columns + column) * 3 + 1];
  const d = chunk.positions[((row + 1) * chunk.columns + column + 1) * 3 + 1];
  return u + v <= 1
    ? a + (b - a) * u + (c - a) * v
    : b * (1 - v) + c * (1 - u) + d * (u + v - 1);
}

describe("atlas 3D chunks", () => {
  it("uses canonical generation chunks for negative and positive axial coordinates", () => {
    expect(ATLAS_3D_CHUNK_SIZE).toBe(CONTINENT.chunkSize);
    expect(ATLAS_3D_WINDOW_SPAN).toBe(128);
    expect(atlas3dChunkKey(-1, 2)).toBe("-1,2");
    expect(atlas3dChunkForAxial({ x: -0.01, y: 24 })).toEqual({ cx: -1, cy: 1 });
    expect(atlas3dChunkRect(-1, 1)).toMatchObject({
      cx: -1,
      cy: 1,
      xmin: -ATLAS_3D_CHUNK_SIZE,
      xmax: 0,
      ymin: ATLAS_3D_CHUNK_SIZE,
      ymax: ATLAS_3D_CHUNK_SIZE * 2,
    });
  });

  it("caps the regular 3D camera at a 128-hex window while retaining an explicit paper fit", () => {
    const fit = atlas3dFitZoom(VIEWPORT, SEED);
    const floor = atlas3dWindowFloor(VIEWPORT, SEED);
    const clamped = clampAtlas3dCamera({ x: 0, y: 0, zoom: fit }, VIEWPORT, SEED);
    const paperFit = fitAtlas3dCamera({ x: 0, y: 0, zoom: fit }, VIEWPORT, SEED);
    expect(floor).toBeGreaterThan(fit * 8);
    expect(floor).toBeLessThan(fit * 10);
    expect(floor).toBeLessThan(ATLAS_3D_MAX_ZOOM);
    expect(clamped.zoom).toBeCloseTo(floor, 8);
    expect(paperFit.zoom).toBeCloseTo(fit, 8);
  });

  it("builds byte-identical payloads independent of chunk build order", () => {
    const leftFirst = buildAtlas3dChunk(SEED, 0, 0, 0);
    const rightSecond = buildAtlas3dChunk(SEED, 1, 0, 0);
    const rightFirst = buildAtlas3dChunk(SEED, 1, 0, 0);
    const leftSecond = buildAtlas3dChunk(SEED, 0, 0, 0);

    expect(leftFirst.version).toBe(ATLAS_3D_RENDER_VERSION);
    expect(leftFirst.empty).toBe(false);
    expect(rightFirst.empty).toBe(false);
    expectPayloadBytesEqual(leftFirst, leftSecond);
    expectPayloadBytesEqual(rightFirst, rightSecond);
  });

  it.each([0, 1])("keeps every shared-edge attribute exact at LOD %i", (lod) => {
    const left = buildAtlas3dChunk(SEED, 0, 0, lod);
    const right = buildAtlas3dChunk(SEED, 1, 0, lod);
    const componentWidths = { positions: 3, colors: 3, coastal: 1, ao: 1, shore: 1 };

    for (let offset = 0; offset < left.columns; offset += 1) {
      const leftVertex = edgeVertex(left, "right", offset);
      const rightVertex = edgeVertex(right, "left", offset);
      for (const [key, width] of Object.entries(componentWidths)) {
        const leftValues = left[key].slice(leftVertex * width, leftVertex * width + width);
        const rightValues = right[key].slice(rightVertex * width, rightVertex * width + width);
        expect(bytes(leftValues), `${key} edge ${offset}`).toEqual(bytes(rightValues));
      }
      const fullRow = offset * (lod === 1 ? 2 : 1);
      expect(left.heights[fullRow * 25 + 24]).toBe(right.heights[fullRow * 25]);
    }
  });

  it("decimates LOD 1 from the exact LOD 0 lattice", () => {
    const fine = buildAtlas3dChunk(SEED, 0, 0, 0);
    const coarse = buildAtlas3dChunk(SEED, 0, 0, 1);

    expect(fine.heights).toEqual(coarse.heights);
    expect(fine.columns).toBe(25);
    expect(coarse.columns).toBe(13);
    for (let row = 0; row < coarse.columns; row += 1) {
      for (let column = 0; column < coarse.columns; column += 1) {
        const coarseVertex = (row * coarse.columns + column) * 3;
        const fineVertex = ((row * 2) * fine.columns + column * 2) * 3;
        expect(coarse.positions.slice(coarseVertex, coarseVertex + 3))
          .toEqual(fine.positions.slice(fineVertex, fineVertex + 3));
      }
    }
  });

  it.each([0, 1])("adds a complete downward skirt ring at LOD %i", (lod) => {
    const chunk = buildAtlas3dChunk(SEED, 0, 0, lod);
    const perimeter = perimeterVertices(chunk.columns);
    const expectedPerimeter = perimeter.length;
    const surfaceIndexCount = (chunk.columns - 1) ** 2 * 6;

    expect(chunk.skirtVertexOffset).toBe(chunk.surfaceVertexCount);
    expect(chunk.skirtVertexCount).toBe(expectedPerimeter);
    expect(chunk.positions.length / 3).toBe(chunk.surfaceVertexCount + expectedPerimeter);
    expect(chunk.indices.length).toBe(surfaceIndexCount + expectedPerimeter * 6);
    for (let index = 0; index < expectedPerimeter; index += 1) {
      const surfaceVertex = perimeter[index];
      const skirtVertex = chunk.skirtVertexOffset + index;
      expect(chunk.positions[skirtVertex * 3]).toBe(chunk.positions[surfaceVertex * 3]);
      expect(chunk.positions[skirtVertex * 3 + 2]).toBe(chunk.positions[surfaceVertex * 3 + 2]);
      expect(chunk.positions[surfaceVertex * 3 + 1] - chunk.positions[skirtVertex * 3 + 1])
        .toBeCloseTo(chunk.skirtDepth, 6);
    }
  });

  it("registers loaded stride-1 heights for overlay sampling and releases them", () => {
    const chunk = buildAtlas3dChunk("chunk-height-registry", 0, 0, 0);
    expect(chunk.empty).toBe(false);
    const coord = { x: 7.25, y: 9.5 };
    const modified = { ...chunk, heights: chunk.heights.slice() };
    modified.heights.fill(17.25);

    expect(registerAtlas3dChunkHeights(modified)).toBe(true);
    expect(atlas3dTerrainHeightAt(coord, modified.seed)).toBeCloseTo(17.25, 8);
    expect(releaseAtlas3dChunkHeights(modified)).toBe(true);
    expect(atlas3dTerrainHeightAt(coord, modified.seed)).not.toBeCloseTo(17.25, 4);
  });

  it("samples registered LOD 1 heights from the exact displayed triangles", () => {
    const chunk = buildAtlas3dChunk(SEED, 14, -14, 1);
    const probes = [
      { x: chunk.origin.x + 1.25, y: chunk.origin.y + 1.5 },
      { x: chunk.origin.x + 7.75, y: chunk.origin.y + 10.4 },
      { x: chunk.origin.x + 13.2, y: chunk.origin.y + 17.6 },
      { x: chunk.origin.x + 22.8, y: chunk.origin.y + 23.1 },
    ];

    expect(registerAtlas3dChunkHeights(chunk)).toBe(true);
    for (const coord of probes) {
      expect(atlas3dTerrainHeightAt(coord, chunk.seed))
        .toBeCloseTo(renderedSurfaceHeightAt(chunk, coord), 6);
    }
    expect(releaseAtlas3dChunkHeights(chunk)).toBe(true);
  });

  it("seats LOD 1 prop records on the same coarse presentation surface", () => {
    const chunk = buildAtlas3dChunk(SEED, 0, 0, 1);
    expect(chunk.trees.length).toBeGreaterThan(0);
    expect(registerAtlas3dChunkHeights(chunk)).toBe(true);

    for (let offset = 0; offset < chunk.trees.length; offset += 8) {
      const coord = atlas3dSceneToAxial({ x: chunk.trees[offset], z: chunk.trees[offset + 2] });
      expect(chunk.trees[offset + 1]).toBeCloseTo(renderedSurfaceHeightAt(chunk, coord), 5);
    }
    for (let offset = 0; offset < chunk.rocks.length; offset += 6) {
      const coord = atlas3dSceneToAxial({ x: chunk.rocks[offset], z: chunk.rocks[offset + 2] });
      expect(chunk.rocks[offset + 1]).toBeCloseTo(renderedSurfaceHeightAt(chunk, coord), 5);
    }
    for (let offset = 0; offset < chunk.fields.length; offset += 7) {
      const coord = atlas3dSceneToAxial({ x: chunk.fields[offset], z: chunk.fields[offset + 2] });
      expect(chunk.fields[offset + 1] - 0.12)
        .toBeCloseTo(renderedSurfaceHeightAt(chunk, coord), 5);
    }
    for (let offset = 0; offset < chunk.environs.length; offset += 6) {
      const coord = atlas3dSceneToAxial({ x: chunk.environs[offset], z: chunk.environs[offset + 2] });
      expect(chunk.environs[offset + 1]).toBeCloseTo(renderedSurfaceHeightAt(chunk, coord), 5);
    }
    expect(releaseAtlas3dChunkHeights(chunk)).toBe(true);
  });

  it("uses the owning neighbor's LOD at a shared edge and falls back deterministically", () => {
    const left = buildAtlas3dChunk(SEED, 0, 0, 0);
    const right = buildAtlas3dChunk(SEED, 1, 0, 1);
    const edge = { x: right.origin.x, y: right.origin.y + 9.35 };
    const insideLeft = { x: edge.x - 1e-5, y: edge.y };

    expect(registerAtlas3dChunkHeights(left)).toBe(true);
    expect(registerAtlas3dChunkHeights(right)).toBe(true);
    expect(atlas3dTerrainHeightAt(insideLeft, SEED))
      .toBeCloseTo(renderedSurfaceHeightAt(left, insideLeft), 6);
    expect(atlas3dTerrainHeightAt(edge, SEED))
      .toBeCloseTo(renderedSurfaceHeightAt(right, edge), 6);

    expect(releaseAtlas3dChunkHeights(right)).toBe(true);
    expect(atlas3dTerrainHeightAt(edge, SEED))
      .toBeCloseTo(renderedSurfaceHeightAt(left, edge), 6);
    expect(releaseAtlas3dChunkHeights(left)).toBe(true);
  });

  it("keeps cached LOD swaps and revisits presentation-authoritative", () => {
    const fine = buildAtlas3dChunk(SEED, 14, -14, 0);
    const coarse = buildAtlas3dChunk(SEED, 14, -14, 1);
    const coord = { x: coarse.origin.x + 22.8, y: coarse.origin.y + 23.1 };
    const fineHeight = renderedSurfaceHeightAt(fine, coord);
    const coarseHeight = renderedSurfaceHeightAt(coarse, coord);
    expect(Math.abs(fineHeight - coarseHeight)).toBeGreaterThan(1);

    expect(registerAtlas3dChunkHeights(fine)).toBe(true);
    expect(atlas3dTerrainHeightAt(coord, SEED)).toBeCloseTo(fineHeight, 6);
    expect(registerAtlas3dChunkHeights(coarse)).toBe(true);
    expect(atlas3dTerrainHeightAt(coord, SEED)).toBeCloseTo(coarseHeight, 6);
    expect(releaseAtlas3dChunkHeights(fine)).toBe(false);
    expect(atlas3dTerrainHeightAt(coord, SEED)).toBeCloseTo(coarseHeight, 6);

    expect(registerAtlas3dChunkHeights(fine)).toBe(true);
    expect(releaseAtlas3dChunkHeights(coarse)).toBe(false);
    expect(atlas3dTerrainHeightAt(coord, SEED)).toBeCloseTo(fineHeight, 6);
    expect(releaseAtlas3dChunkHeights(fine)).toBe(true);
  });

  it("invalidates fixed-camera frame clearance when the presented height surface changes", () => {
    const seed = "chunk-camera-frame-revision";
    const chunk = buildAtlas3dChunk(seed, 0, 0, 1);
    const camera = { x: 7.25, y: 9.5, zoom: 12 };
    const viewport = { width: 800, height: 500 };
    const before = atlas3dCameraFrame(camera, viewport, seed);
    const raised = { ...chunk, heights: chunk.heights.slice() };
    raised.heights.fill(17.25);

    expect(registerAtlas3dChunkHeights(raised)).toBe(true);
    const presented = atlas3dCameraFrame(camera, viewport, seed);
    expect(presented).not.toBe(before);
    expect(presented.target.y).toBeCloseTo(17.25, 8);

    expect(releaseAtlas3dChunkHeights(raised)).toBe(true);
    const released = atlas3dCameraFrame(camera, viewport, seed);
    expect(released).not.toBe(presented);
    expect(released.target.y).not.toBeCloseTo(17.25, 4);
  });

  it("returns an allocation-light empty payload for all-ocean chunks", () => {
    const ocean = buildAtlas3dChunk(SEED, 100, 100, 0);
    expect(ocean.empty).toBe(true);
    expect(ocean.heights).toHaveLength(0);
    expect(ocean.positions).toHaveLength(0);
    expect(ocean.indices).toHaveLength(0);
    expect(ocean.trees).toHaveLength(0);
  });
});
