// Run an abort-aware async task with one deterministic deadline. The timeout
// promise rejects even if an upstream task ignores AbortSignal, while aborting
// still gives fetch/stream readers a chance to stop their underlying work.
function abortReason(signal, fallback = "Request cancelled.") {
  if (signal?.reason instanceof Error) return signal.reason;
  if (signal?.reason != null) return new Error(String(signal.reason));
  return new Error(fallback);
}

export async function withAbortTimeout(
  task,
  timeoutMs,
  timeoutMessage = "Request timed out.",
  parentSignal = null,
) {
  if (parentSignal?.aborted) throw abortReason(parentSignal);

  const controller = new AbortController();
  const duration = Number(timeoutMs);
  let timeoutId = 0;
  let rejectParentAbort = null;
  const parentAbort = parentSignal
    ? new Promise((_, reject) => { rejectParentAbort = reject; })
    : null;
  const onParentAbort = () => {
    const error = abortReason(parentSignal);
    if (!controller.signal.aborted) controller.abort(error);
    rejectParentAbort?.(error);
  };
  parentSignal?.addEventListener("abort", onParentAbort, { once: true });

  const racers = [Promise.resolve().then(() => task(controller.signal))];
  if (parentAbort) racers.push(parentAbort);
  if (Number.isFinite(duration) && duration > 0) {
    racers.push(new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        const error = new Error(timeoutMessage);
        if (!controller.signal.aborted) controller.abort(error);
        reject(error);
      }, duration);
    }));
  }

  try {
    return await Promise.race(racers);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    parentSignal?.removeEventListener("abort", onParentAbort);
  }
}
