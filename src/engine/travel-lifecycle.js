export const TRAVEL_MARCH_FAIL_OPEN_MS = 7_000;

export function isTravelLifecycleTokenCurrent(lifecycle, generation, campaignId) {
  return !!lifecycle
    && lifecycle.generation === generation
    && lifecycle.campaignId === campaignId
    && !lifecycle.controller?.signal?.aborted;
}

export function travelHaltBeat(travel, id = `travel-halt-${Date.now()}`) {
  const encounter = travel?.encounter;
  if (!encounter) return null;
  const encounterKind = String(encounter.kind || "unexpected encounter").replace(/-/g, " ");
  return {
    id,
    type: "travel_halt",
    location: travel.toName || `(${travel.dest?.x},${travel.dest?.y})`,
    encounterKind,
    posture: encounter.posture || "neutral",
    description: encounter.desc || `${encounterKind} block the route.`,
  };
}

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

export async function settleTravelLifecycle({
  visual,
  narration,
  onArrival,
  onNarration,
  onNarrationError,
}) {
  // Attach both handlers before awaiting the renderer so an early narrator
  // failure is owned by this lifecycle rather than becoming an unhandled
  // rejection while the party pin is still marching.
  const narrationOutcome = Promise.resolve(narration).then(
    (value) => ({ ok: true, value }),
    (error) => ({ ok: false, error }),
  );
  const visualResult = await visual;
  if (visualResult === "cancelled") {
    return { status: "cancelled", visual: visualResult, narration: await narrationOutcome };
  }

  await onArrival?.(visualResult);
  const outcome = await narrationOutcome;
  if (outcome.ok) {
    await onNarration?.(outcome.value);
    return { status: "narrated", visual: visualResult, narration: outcome.value };
  }

  await onNarrationError?.(outcome.error);
  return { status: "narration-error", visual: visualResult, error: outcome.error };
}
