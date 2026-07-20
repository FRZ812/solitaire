import { describe, expect, it } from "vitest";
import {
  atlasChunkRequestKey,
  createAtlasChunkStore,
  desiredAtlasChunks,
} from "./atlasChunkStore.js";

const LOCAL_BOUNDS = Object.freeze({ xmin: -240, xmax: 240, ymin: -240, ymax: 240 });

function chunk(cx, cy, lod = 0) {
  return { cx, cy, lod, marker: `${cx},${cy}|${lod}` };
}

describe("atlas chunk request planning", () => {
  it("pads the camera rect by a chunk and assigns the configured LOD ring", () => {
    const desired = desiredAtlasChunks({
      rect: { xmin: 1, xmax: 23, ymin: 1, ymax: 23 },
      focus: { x: 1, y: 1 },
      marginChunks: 1,
      lod0Radius: 1,
      bounds: LOCAL_BOUNDS,
    });

    expect(desired).toHaveLength(9);
    expect(desired[0]).toMatchObject({ cx: 0, cy: 0, lod: 0 });
    expect(desired.find((entry) => entry.cx === 1 && entry.cy === 0)?.lod).toBe(0);
    expect(desired.find((entry) => entry.cx === 1 && entry.cy === 1)?.lod).toBe(1);
    expect(new Set(desired.map((entry) => entry.requestKey)).size).toBe(desired.length);
  });

  it("uses velocity as an ahead bias while keeping an outward-ring order", () => {
    const desired = desiredAtlasChunks({
      rect: { xmin: -23, xmax: 47, ymin: 1, ymax: 23 },
      focus: { x: 1, y: 1 },
      velocity: { x: 8, y: 0 },
      marginChunks: 0,
      lod0Radius: 2,
      bounds: LOCAL_BOUNDS,
    });
    const east = desired.findIndex((entry) => entry.cx === 1 && entry.cy === 0);
    const west = desired.findIndex((entry) => entry.cx === -1 && entry.cy === 0);

    expect(desired[0]).toMatchObject({ cx: 0, cy: 0 });
    expect(east).toBeGreaterThanOrEqual(0);
    expect(west).toBeGreaterThanOrEqual(0);
    expect(east).toBeLessThan(west);
    expect(desired[east].priority).toBeGreaterThan(desired[west].priority);
  });

  it("clips padded requests to the authored atlas bounds", () => {
    const desired = desiredAtlasChunks({
      rect: { xmin: 220, xmax: 235, ymin: 220, ymax: 235 },
      marginChunks: 2,
      bounds: { xmin: 0, xmax: 239, ymin: 0, ymax: 239 },
    });
    expect(desired.every((entry) => entry.cx >= 0 && entry.cx <= 9)).toBe(true);
    expect(desired.every((entry) => entry.cy >= 0 && entry.cy <= 9)).toBe(true);
  });
});

describe("atlas chunk residency store", () => {
  it("tracks pending work and cancels requests that leave the desired window", () => {
    const store = createAtlasChunkStore({ capacity: 4, marginChunks: 0, bounds: LOCAL_BOUNDS });
    const first = store.update({
      rect: { xmin: 1, xmax: 23, ymin: 1, ymax: 23 },
      focus: { x: 1, y: 1 },
    });
    expect(first.requests).toHaveLength(1);
    expect(store.markPending(first.requests[0])).toBe(true);

    const moved = store.update({
      rect: { xmin: 49, xmax: 71, ymin: 1, ymax: 23 },
      focus: { x: 49, y: 1 },
    });
    expect(moved.cancels).toHaveLength(1);
    expect(moved.cancels[0].requestKey).toBe(first.requests[0].requestKey);
    expect(moved.requests).toHaveLength(1);
  });

  it("yields at most one queued GPU upload per dequeue", () => {
    const store = createAtlasChunkStore({ capacity: 4, marginChunks: 0, bounds: LOCAL_BOUNDS });
    const update = store.update({
      rect: { xmin: 1, xmax: 23, ymin: 1, ymax: 23 },
      focus: { x: 1, y: 1 },
    });
    store.markPending(update.requests[0]);
    store.resolve(chunk(0, 0, 0));

    expect(store.snapshot()).toMatchObject({ pending: 0, cache: 1, uploads: 1 });
    expect(store.takeUpload()).toMatchObject({
      key: atlasChunkRequestKey(0, 0, 0),
      chunk: { marker: "0,0|0" },
      replaceKey: null,
    });
    expect(store.takeUpload()).toBeNull();
  });

  it("keeps the presented LOD until its replacement is ready", () => {
    const store = createAtlasChunkStore({ capacity: 4, marginChunks: 0, bounds: LOCAL_BOUNDS });
    store.update({
      rect: { xmin: 1, xmax: 23, ymin: 1, ymax: 23 },
      focus: { x: 1, y: 1 },
      lod0Radius: 0,
    });
    store.resolve(chunk(0, 0, 0));
    expect(store.takeUpload()?.replaceKey).toBeNull();

    const changed = store.update({
      rect: { xmin: 1, xmax: 23, ymin: 1, ymax: 23 },
      focus: { x: 49, y: 1 },
      lod0Radius: 0,
    });
    expect(changed.removals).toEqual([]);
    expect(changed.requests[0]).toMatchObject({ cx: 0, cy: 0, lod: 1 });
    store.resolve(chunk(0, 0, 1));
    expect(store.takeUpload()).toMatchObject({
      key: atlasChunkRequestKey(0, 0, 1),
      replaceKey: atlasChunkRequestKey(0, 0, 0),
    });
  });

  it("evicts the least-recently-used non-visible payload at its tier capacity", () => {
    const store = createAtlasChunkStore({ capacity: 2, marginChunks: 0, bounds: LOCAL_BOUNDS });
    store.resolve(chunk(0, 0));
    store.resolve(chunk(1, 0));
    expect(store.get(atlasChunkRequestKey(0, 0, 0))).toMatchObject({ marker: "0,0|0" });
    const resolved = store.resolve(chunk(2, 0));

    expect(store.snapshot().cacheKeys).toEqual([
      atlasChunkRequestKey(0, 0, 0),
      atlasChunkRequestKey(2, 0, 0),
    ]);
    expect(resolved.evicted).toEqual([
      expect.objectContaining({ key: atlasChunkRequestKey(1, 0, 0), wasPresented: false }),
    ]);
  });

  it("protects the highest-priority center when a desired window exceeds capacity", () => {
    const store = createAtlasChunkStore({ capacity: 1, marginChunks: 0, bounds: LOCAL_BOUNDS });
    const update = store.update({
      rect: { xmin: 1, xmax: 71, ymin: 1, ymax: 23 },
      focus: { x: 1, y: 1 },
      lod0Radius: 0,
    });
    for (const request of update.requests) store.resolve(chunk(request.cx, request.cy, request.lod));

    expect(store.snapshot().cacheKeys).toEqual([atlasChunkRequestKey(0, 0, 0)]);
  });
});
