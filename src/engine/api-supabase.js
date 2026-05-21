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

// onProgress (optional): called with { thinking, text } chunks as they
// stream in from the edge function. `thinking` chunks fire as Gemini emits
// reasoning summaries; `text` chunks fire as the answer JSON streams. Both
// are partial — concatenate to build the full string. The final narrator
// beat is returned from this function after the stream completes.
export async function callNarrator(state, userMsgRaw, onProgress) {
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

  const { text, thinking } = await accumulateAnthropicSSE(response.body, onProgress);
  const userMsg = `${state_context}\n\n${userMsgRaw}`;
  const parsed = extractJSON(text);
  if (!parsed) {
    return { narration: text || "(The narrator stumbles.)", minutes_passed: 1, _raw: text, _thinking: thinking, _userMsg: userMsg };
  }
  return { ...parsed, _raw: text, _thinking: thinking, _userMsg: userMsg };
}

async function accumulateAnthropicSSE(body, onProgress) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let thinking = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Match both LF and CRLF event delimiters — the edge function should
    // emit LF, but Gemini upstream sometimes leaks CRLF and we want to
    // stay tolerant.
    let m;
    while ((m = buffer.match(/\r?\n\r?\n/))) {
      const rawEvent = buffer.slice(0, m.index);
      buffer = buffer.slice(m.index + m[0].length);
      const dataPayload = rawEvent
        .split(/\r?\n/)
        .filter(l => l.startsWith("data:"))
        .map(l => l.slice(5).trimStart())
        .join("\n");
      if (!dataPayload) continue;
      try {
        const evt = JSON.parse(dataPayload);
        if (evt.type === "content_block_delta") {
          if (evt.delta?.type === "text_delta") {
            text += evt.delta.text;
            onProgress?.({ text: evt.delta.text });
          } else if (evt.delta?.type === "thinking_delta") {
            thinking += evt.delta.thinking;
            onProgress?.({ thinking: evt.delta.thinking });
          }
        }
      } catch {
        // skip malformed events
      }
    }
  }
  return { text, thinking };
}
