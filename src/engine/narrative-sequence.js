// Player-facing narrator output is one chronological sequence. New responses use
// `story`; the legacy narration/dialogues pair remains readable so existing saves,
// retries, and model history do not disappear after the format migration.
export function storyFromResponse(response) {
  if (Array.isArray(response?.story)) {
    return response.story.map(normalizeStoryItem).filter(Boolean);
  }

  const story = [];
  if (typeof response?.narration === "string") {
    story.push({ type: "beat", text: response.narration });
  }
  const dialogues = Array.isArray(response?.dialogues)
    ? response.dialogues
    : (response?.dialogue ? [response.dialogue] : []);
  for (const dialogue of dialogues) {
    const item = normalizeStoryItem({ type: "dialogue", ...dialogue });
    if (item) story.push(item);
  }
  return story;
}

export function storyTextLength(response) {
  return storyFromResponse(response).reduce((total, item) => (
    total + (item.type === "dialogue"
      ? item.name.length + item.line.length
      : item.text.length)
  ), 0);
}

function normalizeStoryItem(item) {
  if (!item || typeof item !== "object") return null;
  if (item.type === "beat" || item.type === "narration") {
    const text = typeof item.text === "string"
      ? item.text
      : (typeof item.content === "string" ? item.content : null);
    const actorId = typeof item.actor_id === "string"
      ? item.actor_id
      : (typeof item.actorId === "string" ? item.actorId : "");
    return text == null ? null : {
      type: "beat",
      text,
      ...(actorId ? { actor_id: actorId } : {}),
    };
  }
  if (item.type === "dialogue" || item.type === "dialog") {
    const name = typeof item.name === "string" ? item.name : "";
    const line = typeof item.line === "string" ? item.line : "";
    const speakerId = typeof item.speaker_id === "string"
      ? item.speaker_id
      : (typeof item.speakerId === "string" ? item.speakerId : "");
    return (name || line) ? {
      type: "dialogue",
      ...(speakerId ? { speaker_id: speakerId } : {}),
      name,
      line,
    } : null;
  }
  return null;
}
