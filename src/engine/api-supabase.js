// Web-mode narrator call: invokes the `narrate` edge function and accumulates
// the streamed text before parsing JSON. The edge function normalises whatever
// upstream provider it uses (currently Gemini) into Anthropic-style SSE
// (content_block_delta / text_delta), so this client stays provider-agnostic.
// Buffering for now — typewriter rendering can subscribe to the same stream
// later without changing the function shape.
import { HISTORY_LIMIT } from "../config.js";
import { supabase } from "./supabase-client.js";
import { buildStateContext } from "./api.js";
import { extractJSON } from "./json.js";

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
    }),
  });

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => "");
    let parsed; try { parsed = JSON.parse(errText); } catch {}
    const detail = parsed?.error || parsed?.detail || errText.slice(0, 200);
    throw new Error(`narrate ${response.status}: ${detail}`);
  }

  const text = await accumulateAnthropicSSE(response.body);
  const userMsg = `${state_context}\n\n${userMsgRaw}`;
  const parsed = extractJSON(text);
  if (!parsed) return { narration: text || "(The narrator stumbles.)", minutes_passed: 1, _raw: text, _userMsg: userMsg };
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
