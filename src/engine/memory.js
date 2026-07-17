import { MEMORY_BANK_LIMIT } from "../config.js";

export const MEMORY_TEXT_LIMIT = 600;

// Memory is intentionally stored as plain campaign data. Keeping the canonical
// representation small and deterministic makes it safe to edit in the UI and
// cheap to inject into every narrator request.
export function cleanMemoryText(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, MEMORY_TEXT_LIMIT);
}

export function memoryFingerprint(value) {
  return cleanMemoryText(value)
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[.!?]+$/g, "");
}

export function mergeMemoryBank(current = [], incoming = [], limit = MEMORY_BANK_LIMIT) {
  const merged = [];
  const seen = new Set();
  for (const candidate of [...(current || []), ...(incoming || [])]) {
    const fact = cleanMemoryText(candidate);
    const key = memoryFingerprint(fact);
    if (!fact || !key || seen.has(key)) continue;
    seen.add(key);
    merged.push(fact);
  }
  return merged.slice(-Math.max(0, limit));
}

export function normalizeMemoryBank(memories, limit = MEMORY_BANK_LIMIT) {
  return mergeMemoryBank([], Array.isArray(memories) ? memories : [], limit);
}

export function summarizeMemoryBank(memories) {
  const normalized = normalizeMemoryBank(memories);
  if (!normalized.length) return "(nothing recorded yet)";
  return normalized.map((memory) => `- ${memory}`).join("\n");
}
