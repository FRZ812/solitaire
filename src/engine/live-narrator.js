import { extractJSON } from "./json.js";
import { storyFromResponse } from "./narrative-sequence.js";

export function emptyLiveNarrator() {
  return { raw: "", thinking: false, story: [] };
}

function storyLength(story) {
  return story.reduce((total, item) => (
    total + (item.type === "dialogue"
      ? item.name.length + item.line.length
      : item.text.length)
  ), 0);
}

function visibleStory(parsed, previous) {
  const hasPlayerFacingField = Array.isArray(parsed?.story)
    || typeof parsed?.narration === "string"
    || Array.isArray(parsed?.dialogues)
    || !!parsed?.dialogue;
  if (!hasPlayerFacingField) return previous;
  const next = storyFromResponse(parsed);

  // A chunk can end halfway through an escape or key. extractJSON deliberately
  // returns null in those instants; never let a temporary repair gap make text
  // already visible to the player jump backwards.
  return storyLength(next) > storyLength(previous) ? next : previous;
}

export function advanceLiveNarrator(current, chunk) {
  if (chunk?.reset) return emptyLiveNarrator();
  if (!chunk?.thinking && !chunk?.text) return current;

  const next = {
    ...current,
    // Provider reasoning is private. Retain only an activity bit for the UI.
    thinking: chunk.thinking ? true : current.thinking,
    raw: chunk.text ? current.raw + chunk.text : current.raw,
  };

  if (!chunk.text) return next;
  const parsed = extractJSON(next.raw);
  if (!parsed) return next;

  next.story = visibleStory(parsed, current.story);
  return next;
}
