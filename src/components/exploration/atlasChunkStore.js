import { CONTINENT } from "../../data/continent.js";
import {
  ATLAS_3D_CHUNK_SIZE,
  atlas3dChunkForAxial,
  atlas3dChunkKey,
} from "./worldAtlas3dModel.js";

export const ATLAS_CHUNK_STREAM_MARGIN = 1;

function finite(value, fallback = 0) {
  const resolved = Number(value);
  return Number.isFinite(resolved) ? resolved : fallback;
}

function nonNegativeInteger(value, fallback, label) {
  const resolved = value == null ? fallback : Number(value);
  if (!Number.isInteger(resolved) || resolved < 0) {
    throw new TypeError(`${label} must be a non-negative integer`);
  }
  return resolved;
}

function requestCoordinates(cxOrChunk, cy, lod) {
  const chunk = cxOrChunk && typeof cxOrChunk === "object"
    ? cxOrChunk
    : { cx: cxOrChunk, cy, lod };
  const resolvedLod = nonNegativeInteger(chunk.lod, 0, "lod");
  if (resolvedLod > 1) throw new RangeError("lod must be 0 or 1");
  return {
    cx: Number(chunk.cx),
    cy: Number(chunk.cy),
    lod: resolvedLod,
  };
}

export function atlasChunkRequestKey(cxOrChunk, cy, lod = 0) {
  const chunk = requestCoordinates(cxOrChunk, cy, lod);
  return `${atlas3dChunkKey(chunk.cx, chunk.cy)}|${chunk.lod}`;
}

export function atlasChunkDistance(a, b) {
  const dx = Number(a?.cx) - Number(b?.cx);
  const dy = Number(a?.cy) - Number(b?.cy);
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
    throw new TypeError("atlasChunkDistance requires two chunk coordinates");
  }
  return (Math.abs(dx) + Math.abs(dy) + Math.abs(dx + dy)) / 2;
}

function normalizeRect(rect) {
  const xmin = Number(rect?.xmin ?? rect?.xMin ?? rect?.left);
  const xmax = Number(rect?.xmax ?? rect?.xMax ?? rect?.right);
  const ymin = Number(rect?.ymin ?? rect?.yMin ?? rect?.top);
  const ymax = Number(rect?.ymax ?? rect?.yMax ?? rect?.bottom);
  if (![xmin, xmax, ymin, ymax].every(Number.isFinite)) {
    throw new TypeError("An atlas chunk camera rect needs finite bounds");
  }
  return {
    xmin: Math.min(xmin, xmax),
    xmax: Math.max(xmin, xmax),
    ymin: Math.min(ymin, ymax),
    ymax: Math.max(ymin, ymax),
  };
}

function clippedRect(rect, marginChunks, bounds) {
  const margin = marginChunks * ATLAS_3D_CHUNK_SIZE;
  const expanded = {
    xmin: rect.xmin - margin,
    xmax: rect.xmax + margin,
    ymin: rect.ymin - margin,
    ymax: rect.ymax + margin,
  };
  if (!bounds) return expanded;
  if (expanded.xmax < bounds.xmin
    || expanded.xmin > bounds.xmax
    || expanded.ymax < bounds.ymin
    || expanded.ymin > bounds.ymax) return null;
  return {
    xmin: Math.max(expanded.xmin, bounds.xmin),
    xmax: Math.min(expanded.xmax, bounds.xmax),
    ymin: Math.max(expanded.ymin, bounds.ymin),
    ymax: Math.min(expanded.ymax, bounds.ymax),
  };
}

function aheadAmount(chunk, center, velocity) {
  const vx = finite(velocity?.x);
  const vy = finite(velocity?.y);
  const velocityLength = Math.hypot(vx, vy);
  const dx = chunk.cx - center.cx;
  const dy = chunk.cy - center.cy;
  const chunkLength = Math.hypot(dx, dy);
  if (velocityLength < 1e-6 || chunkLength < 1e-6) return 0;
  return (dx * vx + dy * vy) / (chunkLength * velocityLength);
}

function spiralAngle(chunk, center) {
  const dx = chunk.cx - center.cx;
  const dy = chunk.cy - center.cy;
  // Convert axial chunk coordinates to a 2D point before sorting around each
  // ring. This gives stable clockwise traversal without coupling to Three.js.
  const x = dx + dy * 0.5;
  const y = dy * Math.sqrt(3) * 0.5;
  const angle = Math.atan2(y, x);
  return angle < 0 ? angle + Math.PI * 2 : angle;
}

/**
 * Build the deterministic worker request plan for a camera's axial footprint.
 * The visible rect is padded by a chunk margin, clipped to the authored atlas,
 * assigned one of two mesh LODs, then ordered in outward rings. Camera velocity
 * only breaks nearby priority ties; it never changes geography or LOD.
 */
export function desiredAtlasChunks({
  rect,
  cameraRect,
  focus,
  camera,
  velocity = null,
  lod0Radius = 1,
  marginChunks = ATLAS_CHUNK_STREAM_MARGIN,
  aheadBias = 0.45,
  bounds = CONTINENT.bounds,
} = {}) {
  const normalized = normalizeRect(rect ?? cameraRect);
  const resolvedMargin = nonNegativeInteger(marginChunks, ATLAS_CHUNK_STREAM_MARGIN, "marginChunks");
  const resolvedRadius = nonNegativeInteger(lod0Radius, 1, "lod0Radius");
  const streamingRect = clippedRect(normalized, resolvedMargin, bounds);
  if (!streamingRect) return [];

  const requestedFocus = focus ?? camera;
  const centerCoord = requestedFocus
      && Number.isFinite(requestedFocus.x)
      && Number.isFinite(requestedFocus.y)
    ? requestedFocus
    : {
      x: (normalized.xmin + normalized.xmax) / 2,
      y: (normalized.ymin + normalized.ymax) / 2,
    };
  const center = atlas3dChunkForAxial(centerCoord);
  const min = atlas3dChunkForAxial({ x: streamingRect.xmin, y: streamingRect.ymin });
  const max = atlas3dChunkForAxial({ x: streamingRect.xmax, y: streamingRect.ymax });
  const chunks = [];

  for (let cy = min.cy; cy <= max.cy; cy += 1) {
    for (let cx = min.cx; cx <= max.cx; cx += 1) {
      const chunk = { cx, cy };
      const distance = atlasChunkDistance(chunk, center);
      const lod = distance <= resolvedRadius ? 0 : 1;
      const ahead = aheadAmount(chunk, center, velocity);
      chunks.push({
        key: atlas3dChunkKey(cx, cy),
        requestKey: atlasChunkRequestKey(cx, cy, lod),
        cx,
        cy,
        lod,
        distance,
        ahead,
        angle: spiralAngle(chunk, center),
        effectiveDistance: distance - ahead * finite(aheadBias, 0.45),
      });
    }
  }

  chunks.sort((a, b) => (
    a.effectiveDistance - b.effectiveDistance
    || a.distance - b.distance
    || b.ahead - a.ahead
    || a.angle - b.angle
    || a.cy - b.cy
    || a.cx - b.cx
  ));

  return chunks.map((chunk, index) => ({
    key: chunk.key,
    requestKey: chunk.requestKey,
    cx: chunk.cx,
    cy: chunk.cy,
    lod: chunk.lod,
    distance: chunk.distance,
    ahead: chunk.ahead,
    // Higher numeric priorities are processed first by the persistent worker.
    priority: (chunks.length - index) * 1000 - chunk.lod,
  }));
}

export const planAtlasChunks = desiredAtlasChunks;

function chunkPayloadKey(chunk) {
  return atlasChunkRequestKey(chunk?.cx, chunk?.cy, chunk?.lod);
}

/**
 * Small state container for the scene's streaming boundary. It deliberately
 * owns no Workers, Three objects, or animation frames, which keeps request
 * planning, LRU behavior, and the one-item upload queue deterministic in tests.
 */
export function createAtlasChunkStore(options = {}) {
  const {
    lod0Radius = 1,
    marginChunks = ATLAS_CHUNK_STREAM_MARGIN,
    bounds = CONTINENT.bounds,
  } = options;
  const configuredCapacity = options.capacity
    ?? options.chunkCacheSize
    ?? options.cacheSize
    ?? options.cache
    ?? 64;
  const cacheCapacity = Math.max(1, nonNegativeInteger(configuredCapacity, 64, "capacity"));
  let desired = new Map();
  const pending = new Map();
  const cache = new Map();
  const presented = new Map();
  const uploadQueue = [];
  const queued = new Set();
  let accessClock = 0;

  function touch(entry) {
    entry.lastUsed = ++accessClock;
  }

  function queueUpload(requestKey) {
    if (queued.has(requestKey) || presented.get(requestKey.split("|")[0]) === requestKey) return;
    const entry = cache.get(requestKey);
    if (!entry || !desired.has(requestKey)) return;
    queued.add(requestKey);
    uploadQueue.push(requestKey);
  }

  function removeQueued(requestKey) {
    if (!queued.delete(requestKey)) return;
    for (let index = uploadQueue.length - 1; index >= 0; index -= 1) {
      if (uploadQueue[index] === requestKey) uploadQueue.splice(index, 1);
    }
  }

  function evictOverflow() {
    const removed = [];
    while (cache.size > cacheCapacity) {
      const candidates = [...cache.entries()];
      candidates.sort((a, b) => {
        const aDesired = desired.get(a[0]);
        const bDesired = desired.get(b[0]);
        const aProtection = aDesired ? 2 : Number(presented.get(a[1].geoKey) === a[0]);
        const bProtection = bDesired ? 2 : Number(presented.get(b[1].geoKey) === b[0]);
        return aProtection - bProtection
          // If a tier cannot retain an unusually large desired window, keep
          // the center/ahead requests and shed the lowest worker priority.
          || (aDesired && bDesired ? aDesired.priority - bDesired.priority : 0)
          || a[1].lastUsed - b[1].lastUsed
          || a[0].localeCompare(b[0]);
      });
      const [requestKey, entry] = candidates[0];
      cache.delete(requestKey);
      removeQueued(requestKey);
      const wasPresented = presented.get(entry.geoKey) === requestKey;
      if (wasPresented) presented.delete(entry.geoKey);
      const eviction = {
        key: requestKey,
        geoKey: entry.geoKey,
        chunk: entry.chunk,
        wasPresented,
      };
      removed.push(eviction);
    }
    return removed;
  }

  function update(input) {
    const nextPlan = desiredAtlasChunks({
      ...input,
      lod0Radius: input?.lod0Radius ?? lod0Radius,
      marginChunks: input?.marginChunks ?? marginChunks,
      bounds: input?.bounds ?? bounds,
    });
    const previous = desired;
    const next = new Map(nextPlan.map((request) => [request.requestKey, request]));
    const desiredGeoKeys = new Set(nextPlan.map((request) => request.key));
    const requests = [];
    const cancels = [];
    const reprioritize = [];
    const removals = [];

    for (const [requestKey, request] of pending) {
      const nextRequest = next.get(requestKey);
      if (!nextRequest) {
        pending.delete(requestKey);
        cancels.push(request);
      } else if (nextRequest.priority !== request.priority) {
        pending.set(requestKey, nextRequest);
        reprioritize.push(nextRequest);
      }
    }

    desired = next;
    for (const request of nextPlan) {
      const entry = cache.get(request.requestKey);
      if (entry) {
        touch(entry);
        queueUpload(request.requestKey);
      } else if (!pending.has(request.requestKey)) {
        requests.push(request);
      }
    }

    for (const [geoKey, requestKey] of [...presented]) {
      // Keep an existing LOD visible while its replacement for the same
      // geographic chunk streams. It is retired atomically by takeUpload().
      if (desiredGeoKeys.has(geoKey)) continue;
      presented.delete(geoKey);
      const entry = cache.get(requestKey);
      removals.push({ key: requestKey, geoKey, chunk: entry?.chunk ?? null });
    }

    for (const requestKey of previous.keys()) {
      if (!next.has(requestKey)) removeQueued(requestKey);
    }

    const evicted = evictOverflow();
    return {
      desired: nextPlan,
      requests,
      cancels,
      reprioritize,
      removals,
      evicted,
    };
  }

  function markPending(request) {
    const requestKey = request?.requestKey || chunkPayloadKey(request);
    if (cache.has(requestKey) || pending.has(requestKey)) return false;
    pending.set(requestKey, { ...request, requestKey });
    return true;
  }

  function reject(requestOrChunk) {
    const requestKey = requestOrChunk?.requestKey || chunkPayloadKey(requestOrChunk);
    return pending.delete(requestKey);
  }

  function resolve(chunk) {
    const requestKey = chunkPayloadKey(chunk);
    const geoKey = atlas3dChunkKey(chunk.cx, chunk.cy);
    pending.delete(requestKey);
    const entry = { chunk, geoKey, lastUsed: 0 };
    touch(entry);
    cache.set(requestKey, entry);
    queueUpload(requestKey);
    return { stored: true, evicted: evictOverflow() };
  }

  function get(requestOrChunk) {
    const requestKey = typeof requestOrChunk === "string"
      ? requestOrChunk
      : requestOrChunk?.requestKey || chunkPayloadKey(requestOrChunk);
    const entry = cache.get(requestKey);
    if (!entry) return null;
    touch(entry);
    return entry.chunk;
  }

  function takeUpload() {
    while (uploadQueue.length) {
      const requestKey = uploadQueue.shift();
      queued.delete(requestKey);
      const request = desired.get(requestKey);
      const entry = cache.get(requestKey);
      if (!request || !entry) continue;
      touch(entry);
      const replaceKey = presented.get(entry.geoKey) || null;
      presented.set(entry.geoKey, requestKey);
      return {
        key: requestKey,
        geoKey: entry.geoKey,
        chunk: entry.chunk,
        replaceKey: replaceKey === requestKey ? null : replaceKey,
      };
    }
    return null;
  }

  function clear() {
    const removed = [...cache.entries()].map(([key, entry]) => ({
      key,
      geoKey: entry.geoKey,
      chunk: entry.chunk,
      wasPresented: presented.get(entry.geoKey) === key,
    }));
    desired = new Map();
    pending.clear();
    cache.clear();
    presented.clear();
    uploadQueue.length = 0;
    queued.clear();
    return removed;
  }

  function snapshot() {
    return {
      desired: desired.size,
      pending: pending.size,
      cache: cache.size,
      presented: presented.size,
      uploads: queued.size,
      desiredKeys: [...desired.keys()],
      pendingKeys: [...pending.keys()],
      cacheKeys: [...cache.keys()],
    };
  }

  return Object.freeze({
    update,
    setDesired: update,
    markPending,
    reject,
    resolve,
    enqueueUpload: resolve,
    get,
    takeUpload,
    clear,
    snapshot,
  });
}
