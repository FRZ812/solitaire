// Web-mode narrator call. Invokes the `narrate` Supabase Edge Function,
// which gates on auth + the manual subscription allowlist (server-side),
// calls Gemini, and re-emits the stream as Anthropic-style SSE
// (content_block_delta / text_delta). The client buffers the whole stream
// then parses JSON; the engine is unchanged.
//
// The system prompt is bundled in the web client (src/system-prompt.js) —
// single source of truth, no mirror file on the function side.
import { HISTORY_LIMIT } from "../config.js";
import { supabase } from "./supabase-client.js";
import { buildStateContext } from "./api.js";
import { extractJSON } from "./json.js";
import { SYSTEM_PROMPT } from "../system-prompt.js";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/narrate`;

export async function callNarrator(state, userMsgRaw) {
  const state_context = buildStateContext(state);
  const trimmedHistory = state.apiHistory.slice(-HISTORY_LIMIT);

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("not authenticated");

  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
      "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      state_context,
      user_msg: userMsgRaw,
      history: trimmedHistory,
      system_prompt: SYSTEM_PROMPT,
    }),
  });

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => "");
    let parsed; try { parsed = JSON.parse(errText); } catch {}
    const detail = parsed?.error || parsed?.detail || errText.slice(0, 200);
    // Surface gate states cleanly.
    if (response.status === 402) throw new Error("subscription required");
    if (response.status === 401) throw new Error("not authenticated");
    throw new Error(`narrate ${response.status}: ${detail}`);
  }

  const text = await accumulateAnthropicSSE(response.body);
  const userMsg = `${state_context}\n\n${userMsgRaw}`;
  const parsed = extractJSON(text);
  if (!parsed) {
    return { narration: text || "(The narrator stumbles.)", minutes_passed: 1, _raw: text, _userMsg: userMsg };
  }
  return { ...parsed, _raw: text, _userMsg: userMsg };
}

async function accumulateAnthropicSSE(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const dataPayload = rawEvent
        .split("\n")
        .filter(l => l.startsWith("data:"))
        .map(l => l.slice(5).trimStart())
        .join("\n");
      if (!dataPayload) continue;
      try {
        const evt = JSON.parse(dataPayload);
        if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
          text += evt.delta.text;
        }
      } catch {
        // skip malformed events
      }
    }
  }
  return text;
}
