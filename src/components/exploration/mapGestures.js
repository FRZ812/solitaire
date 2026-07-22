export function dragPreviewOffset(start, current) {
  if (!start || !current) return { x: 0, y: 0 };
  return {
    x: (Number(current.x) || 0) - (Number(start.x) || 0),
    y: (Number(current.y) || 0) - (Number(start.y) || 0),
  };
}

export function pinchDistance(points) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const [first, second] = points;
  const distance = Math.hypot(Number(second?.x) - Number(first?.x), Number(second?.y) - Number(first?.y));
  return Number.isFinite(distance) ? distance : null;
}

export function pinchZoomFactor(previousDistance, nextDistance) {
  const previous = Number(previousDistance);
  const next = Number(nextDistance);
  if (!Number.isFinite(previous) || previous <= 0 || !Number.isFinite(next) || next <= 0) return 1;
  return Math.max(0.8, Math.min(1.25, next / previous));
}
