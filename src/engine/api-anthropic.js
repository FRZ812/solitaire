// Artifact-mode narrator call: posts directly to api.anthropic.com. The
// artifact pane provides subscription auth; outside the artifact this fails
// without an API key. The web build uses api-supabase.js instead.
import { MODEL, HISTORY_LIMIT } from "../config.js";
import { SYSTEM_PROMPT } from "../system-prompt.js";
import { buildStateContext } from "./api.js";
import { extractJSON } from "./json.js";

export async function callNarrator(state, userMsgRaw) {
  const userMsg = `${buildStateContext(state)}\n\n${userMsgRaw}`;
  const trimmedHistory = state.apiHistory.slice(-HISTORY_LIMIT);
  const messages = [...trimmedHistory, { role: "user", content: userMsg }];
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, system: SYSTEM_PROMPT, messages }),
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    let parsed; try { parsed = JSON.parse(errText); } catch {}
    const detail = parsed?.error?.message || errText.slice(0, 200);
    throw new Error(`API ${response.status}: ${detail}`);
  }
  const data = await response.json();
  const text = (data.content || []).map(c => c.type === "text" ? c.text : "").join("");
  const parsed = extractJSON(text);
  if (!parsed) return { narration: text || "(The narrator stumbles.)", minutes_passed: 1, _raw: text, _userMsg: userMsg };
  return { ...parsed, _raw: text, _userMsg: userMsg };
}
