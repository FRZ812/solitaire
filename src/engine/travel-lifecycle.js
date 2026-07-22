export const TRAVEL_MARCH_FAIL_OPEN_MS = 7_000;

export function createTravelMarchWaiter({
  timeoutMs = TRAVEL_MARCH_FAIL_OPEN_MS,
  setTimer = (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimer = (handle) => globalThis.clearTimeout(handle),
} = {}) {
  let settled = false;
  let timerHandle = null;
  let settle;
  const promise = new Promise((resolve) => {
    settle = (result) => {
      if (settled) return false;
      settled = true;
      if (timerHandle !== null) clearTimer(timerHandle);
      resolve(result);
      return true;
    };
  });

  timerHandle = setTimer(() => settle("timeout"), timeoutMs);
  return { promise, resolve: settle };
}
