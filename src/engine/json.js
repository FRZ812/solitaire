// Strips code fences, finds the outermost { ... } if needed. If the response
// was truncated mid-stream (model hit a safety filter / token limit / network
// blip) the JSON will be missing its closing brace and the narration string
// will be unclosed; we best-effort repair both so the player sees as much of
// the narration as the narrator actually produced, marked _truncated.
export function extractJSON(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json|```/g, "").trim();
  try { return JSON.parse(cleaned); } catch {}

  const start = cleaned.indexOf("{");
  if (start === -1) return null;
  const body = cleaned.slice(start);

  const end = body.lastIndexOf("}");
  if (end > 0) {
    try { return JSON.parse(body.slice(0, end + 1)); } catch {}
  }

  const repaired = repairTruncatedJSON(body);
  if (repaired != null) {
    try {
      const parsed = JSON.parse(repaired);
      parsed._truncated = true;
      return parsed;
    } catch {}
  }
  return null;
}

// Close any unclosed string, then balance trailing braces/brackets. Conservative —
// strips a dangling comma before appending closers so we don't leave invalid
// `, }` syntax. Returns the repaired string, or null if there's nothing to repair.
function repairTruncatedJSON(body) {
  if (!body || body[0] !== "{") return null;
  let inString = false;
  let escape = false;
  let truncatedStringIsKey = false;
  const containers = [];
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (escape) { escape = false; continue; }
    if (inString) {
      if (c === "\\") escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    const top = containers[containers.length - 1];
    if (c === '"') {
      inString = true;
      truncatedStringIsKey = top?.type === "object" && top.expectKey;
    } else if (c === "{") {
      containers.push({ type: "object", expectKey: true });
    } else if (c === "[") {
      containers.push({ type: "array" });
    } else if (c === "}" || c === "]") {
      containers.pop();
    } else if (c === ":" && top?.type === "object") {
      top.expectKey = false;
    } else if (c === "," && top?.type === "object") {
      top.expectKey = true;
    }
  }
  if (containers.length === 0 && !inString) return null;
  let repaired = body;
  if (inString) repaired += '"';
  repaired = repaired.replace(/,\s*$/, "");
  // A truncation mid-key (e.g. `"foo` with no colon) leaves a hanging string;
  // append a placeholder value so the brace-close below produces valid JSON.
  if (inString && truncatedStringIsKey) repaired += ":null";
  while (containers.length > 0) repaired += containers.pop().type === "object" ? "}" : "]";
  return repaired;
}
