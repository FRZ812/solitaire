export function storyDistanceFromBottom(element) {
  if (!element) return Infinity;
  return Math.max(0, element.scrollHeight - element.clientHeight - element.scrollTop);
}

export function wheelRequestsOlder(deltaY) {
  return Number.isFinite(deltaY) && deltaY < 0;
}

export function touchRequestsOlder(previousY, nextY, tolerance = 0.5) {
  return Number.isFinite(previousY) && Number.isFinite(nextY) && nextY > previousY + tolerance;
}

export function pinStoryToBottom(element) {
  if (!element) return 0;
  element.scrollTop = element.scrollHeight;
  return element.scrollTop;
}
