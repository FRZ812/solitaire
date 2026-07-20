const clampUnit = (value) => Math.min(1, Math.max(0, value));

/**
 * A gentle cubic ease that keeps atlas movement readable at both ends.
 */
export function easeAtlasTween(progress) {
  const t = clampUnit(Number.isFinite(progress) ? progress : 0);
  return t < 0.5
    ? 4 * t * t * t
    : 1 - ((-2 * t + 2) ** 3) / 2;
}

function atlasTweenNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

const DEFAULT_SCHEDULER = Object.freeze({
  now: atlasTweenNow,
  request(callback) {
    if (typeof globalThis.requestAnimationFrame === "function") {
      return globalThis.requestAnimationFrame(callback);
    }
    return globalThis.setTimeout(() => callback(atlasTweenNow()), 16);
  },
  cancel(frame) {
    if (typeof globalThis.cancelAnimationFrame === "function") {
      globalThis.cancelAnimationFrame(frame);
      return;
    }
    globalThis.clearTimeout(frame);
  },
});

/**
 * Run a cancellable atlas animation.
 *
 * `onUpdate` receives `(easedProgress, rawProgress)`. The returned controller
 * can cancel without completing, or finish immediately at the destination.
 * Supplying a scheduler (`now`, `request`, `cancel`) makes the animation fully
 * deterministic in tests and keeps the production path on requestAnimationFrame.
 */
export function createAtlasTween({
  duration = 0,
  easing = easeAtlasTween,
  onUpdate = () => {},
  onFinish = () => {},
  onCancel = () => {},
  reducedMotion = false,
  scheduler = DEFAULT_SCHEDULER,
} = {}) {
  const tweenDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const clock = scheduler?.now;
  const requestFrame = scheduler?.request;
  const cancelFrame = scheduler?.cancel;

  if (typeof clock !== "function" || typeof requestFrame !== "function" || typeof cancelFrame !== "function") {
    throw new TypeError("atlas tween scheduler must provide now, request, and cancel functions");
  }
  if (typeof easing !== "function" || typeof onUpdate !== "function" || typeof onFinish !== "function" || typeof onCancel !== "function") {
    throw new TypeError("atlas tween callbacks and easing must be functions");
  }

  let status = "running";
  let frame = null;
  let rawProgress = 0;
  let value = 0;
  const startedAt = clock();

  function easedValue(progress) {
    const eased = easing(progress);
    return clampUnit(Number.isFinite(eased) ? eased : progress);
  }

  function emit(progress) {
    rawProgress = clampUnit(progress);
    value = easedValue(rawProgress);
    onUpdate(value, rawProgress);
  }

  function cancelScheduledFrame() {
    if (frame === null) return;
    cancelFrame(frame);
    frame = null;
  }

  function complete(reason) {
    if (status !== "running") return false;
    cancelScheduledFrame();
    if (rawProgress < 1) emit(1);
    status = "finished";
    onFinish({ reason, progress: rawProgress, value });
    return true;
  }

  function cancel() {
    if (status !== "running") return false;
    cancelScheduledFrame();
    status = "cancelled";
    onCancel({ reason: "cancelled", progress: rawProgress, value });
    return true;
  }

  function finish() {
    return complete("finished");
  }

  function tick(timestamp) {
    if (status !== "running") return;
    frame = null;
    const now = Number.isFinite(timestamp) ? timestamp : clock();
    const nextProgress = clampUnit(Math.max(0, now - startedAt) / tweenDuration);
    if (nextProgress > rawProgress) emit(nextProgress);
    if (status !== "running") return;
    if (rawProgress >= 1) complete("completed");
    else frame = requestFrame(tick);
  }

  const controller = Object.freeze({
    cancel,
    finish,
    get progress() { return rawProgress; },
    get running() { return status === "running"; },
    get status() { return status; },
    get value() { return value; },
  });

  if (reducedMotion || tweenDuration === 0) {
    emit(1);
    status = "finished";
    onFinish({ reason: "completed", progress: rawProgress, value });
  } else {
    emit(0);
    frame = requestFrame(tick);
  }

  return controller;
}
