import { HISTORY_LIMIT } from "../config.js";

export const HISTORY_CHAR_BUDGET = 80_000;

const LEGACY_USER_MARKERS = [
  "[CHARACTER CREATION]",
  "[PLAYER ACTION]",
  "[CONTINUE STORY]",
  "[TRADE]",
  "[APPROACH MOUNT]",
  "[APPROACH RECRUIT]",
  "[INSPECT RIGHTS]",
  "[INSPECT CAPTIVE]",
  "[DEATH]",
  "[DEFEATED]",
  "[COMBAT OVER]",
  "[LOOTED]",
];

// Older saves stored the entire (very large) state_context in every user history
// entry. New calls need only the original action because the latest state_context
// is supplied once, separately. Strip the legacy prefix lazily so existing saves
// become efficient without a destructive migration.
export function compactLegacyUserMessage(content) {
  if (typeof content !== "string" || !content.startsWith("[PLAYER —")) return content;
  const memoryBankAt = content.indexOf("[MEMORY BANK —");
  if (memoryBankAt < 0) return content;
  let firstActionAt = -1;
  for (const marker of LEGACY_USER_MARKERS) {
    const at = content.indexOf(`\n\n${marker}`, memoryBankAt);
    if (at >= 0 && (firstActionAt < 0 || at < firstActionAt)) firstActionAt = at;
  }
  return firstActionAt >= 0 ? content.slice(firstActionAt + 2) : content;
}

export function prepareNarratorHistory(history, limit = HISTORY_LIMIT, charBudget = HISTORY_CHAR_BUDGET) {
  const valid = (Array.isArray(history) ? history : []).flatMap((entry) => {
    if (!entry || (entry.role !== "user" && entry.role !== "assistant") || typeof entry.content !== "string") return [];
    const content = entry.role === "user" ? compactLegacyUserMessage(entry.content) : entry.content;
    return content.trim() ? [{ role: entry.role, content }] : [];
  }).slice(-Math.max(0, limit));

  // Select complete conversational groups from newest to oldest. This avoids a
  // dangling assistant response when the character budget cuts the window.
  const groups = [];
  for (const entry of valid) {
    if (entry.role === "user" || groups.length === 0) groups.push([entry]);
    else groups[groups.length - 1].push(entry);
  }
  const selected = [];
  let chars = 0;
  for (let i = groups.length - 1; i >= 0; i--) {
    const groupChars = groups[i].reduce((sum, entry) => sum + entry.content.length, 0);
    if (selected.length && chars + groupChars > charBudget) break;
    selected.unshift(groups[i]);
    chars += groupChars;
  }
  const flattened = selected.flat().slice(-Math.max(0, limit));
  while (flattened[0]?.role === "assistant") flattened.shift();
  return flattened;
}
