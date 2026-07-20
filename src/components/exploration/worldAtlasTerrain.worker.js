import {
  ATLAS_3D_RENDER_VERSION,
  buildAtlas3dChunk,
} from "./worldAtlas3dModel.js";

const queue = new Map();
const cancelled = new Set();
let initializedSeed = null;
let sequence = 0;
let scheduled = false;
let activeId = null;

function transferableBuffers(chunk) {
  const buffers = new Set();
  for (const value of Object.values(chunk || {})) {
    if (!ArrayBuffer.isView(value)) continue;
    const buffer = value.buffer;
    if (buffer instanceof ArrayBuffer && buffer.byteLength > 0) buffers.add(buffer);
  }
  return [...buffers];
}

function nextJob() {
  return [...queue.values()].sort((a, b) => (
    b.priority - a.priority
    || a.sequence - b.sequence
    || a.cy - b.cy
    || a.cx - b.cx
    || a.lod - b.lod
  ))[0] || null;
}

function scheduleNext() {
  if (scheduled || activeId != null || queue.size === 0) return;
  scheduled = true;
  // Yield between chunks so cancel and priority updates posted during a throw
  // pan are handled before the next deterministic build begins.
  setTimeout(processNext, 0);
}

function processNext() {
  scheduled = false;
  const job = nextJob();
  if (!job) return;
  queue.delete(job.id);
  if (cancelled.delete(job.id)) {
    scheduleNext();
    return;
  }

  activeId = job.id;
  try {
    const chunk = buildAtlas3dChunk(initializedSeed, job.cx, job.cy, job.lod);
    if (!cancelled.delete(job.id)) {
      self.postMessage(
        { type: "chunk", id: job.id, chunk },
        transferableBuffers(chunk),
      );
    }
  } catch (error) {
    if (!cancelled.delete(job.id)) {
      self.postMessage({
        type: "error",
        id: job.id,
        message: error?.message || "The terrain chunk could not be generated.",
      });
    }
  } finally {
    activeId = null;
    scheduleNext();
  }
}

function initialize(message) {
  if (message.version !== ATLAS_3D_RENDER_VERSION
    || (typeof message.seed !== "string" && !Number.isFinite(message.seed))) {
    self.postMessage({
      type: "error",
      id: message.id,
      message: "The terrain worker received invalid initialization data.",
    });
    return;
  }
  initializedSeed = message.seed;
  queue.clear();
  cancelled.clear();
  self.postMessage({
    type: "ready",
    version: ATLAS_3D_RENDER_VERSION,
    seed: initializedSeed,
  });
}

function enqueue(message) {
  if (initializedSeed == null || !message.id) {
    self.postMessage({
      type: "error",
      id: message.id,
      message: "The terrain worker has not been initialized.",
    });
    return;
  }
  if (!Number.isInteger(message.cx)
    || !Number.isInteger(message.cy)
    || !Number.isInteger(message.lod)
    || (message.lod !== 0 && message.lod !== 1)) {
    self.postMessage({
      type: "error",
      id: message.id,
      message: "The terrain worker received an invalid chunk request.",
    });
    return;
  }
  if (activeId === message.id) return;
  const existing = queue.get(message.id);
  queue.set(message.id, {
    id: message.id,
    cx: message.cx,
    cy: message.cy,
    lod: message.lod,
    priority: Number.isFinite(message.priority) ? message.priority : 0,
    sequence: existing?.sequence ?? sequence++,
  });
  cancelled.delete(message.id);
  scheduleNext();
}

function cancel(message) {
  if (!message.id) return;
  queue.delete(message.id);
  if (activeId === message.id) cancelled.add(message.id);
}

self.onmessage = (event) => {
  const message = event?.data || {};
  if (message.type === "init") initialize(message);
  else if (message.type === "chunk") enqueue(message);
  else if (message.type === "cancel") cancel(message);
};
