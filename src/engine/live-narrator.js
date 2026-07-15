import { extractJSON } from "./json.js";

export function emptyLiveNarrator() {
  return { raw: "", thinking: "", narration: "", dialogues: [] };
}

function dialogueLength(dialogues) {
  return dialogues.reduce((total, dialogue) => total + dialogue.name.length + dialogue.line.length, 0);
}

function visibleDialogues(parsed, previous) {
  if (!Array.isArray(parsed?.dialogues)) return previous;
  const next = parsed.dialogues
    .filter((dialogue) => dialogue && (typeof dialogue.name === "string" || typeof dialogue.line === "string"))
    .map((dialogue) => ({
      name: typeof dialogue.name === "string" ? dialogue.name : "",
      line: typeof dialogue.line === "string" ? dialogue.line : "",
    }))
    .filter((dialogue) => dialogue.name || dialogue.line);

  // A chunk can end halfway through an escape or key. extractJSON deliberately
  // returns null in those instants; never let a temporary repair gap make text
  // already visible to the player jump backwards.
  return dialogueLength(next) > dialogueLength(previous) ? next : previous;
}

export function advanceLiveNarrator(current, chunk) {
  if (chunk?.reset) return emptyLiveNarrator();
  if (!chunk?.thinking && !chunk?.text) return current;

  const next = {
    ...current,
    thinking: chunk.thinking ? current.thinking + chunk.thinking : current.thinking,
    raw: chunk.text ? current.raw + chunk.text : current.raw,
  };

  if (!chunk.text) return next;
  const parsed = extractJSON(next.raw);
  if (!parsed) return next;

  if (typeof parsed.narration === "string" && parsed.narration.length >= current.narration.length) {
    next.narration = parsed.narration;
  }
  next.dialogues = visibleDialogues(parsed, current.dialogues);
  return next;
}
