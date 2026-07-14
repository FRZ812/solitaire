export const STORY_BOTTOM_THRESHOLD = 72;

export function storyDistanceFromBottom(element) {
  if (!element) return Infinity;
  return Math.max(0, element.scrollHeight - element.clientHeight - element.scrollTop);
}

export function storyShouldFollow(element, threshold = STORY_BOTTOM_THRESHOLD) {
  return storyDistanceFromBottom(element) <= threshold;
}

export function pinStoryToBottom(element) {
  if (!element) return;
  element.scrollTop = element.scrollHeight;
}
