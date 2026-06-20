// Web-mode narrator call. Invokes the `narrate` Supabase Edge Function,
// which gates on auth + the manual subscription allowlist (server-side),
// calls DeepSeek, and re-emits the stream as Anthropic-style SSE
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

// Retry hint prepended to userMsgRaw on attempt 1 when attempt 0's narration
// arrived truncated (mid-stream cut by the model's safety filter, not the
// token budget — server-side limit is 64k). Nudges the model to be terser.
const RETRY_HINT_1 =
  "[RETRY HINT: your previous response was cut short mid-stream; deliver this beat more concisely (target ≤ 300 words narration), same intent.]";

// Stronger nudge on attempt 2: ask for a paraphrase in different words at an
// even tighter budget. The [PLAYER ACTION] input is procedurally generated
// and unlikely to be the trigger, so both retries act on the output side.
const RETRY_HINT_2 =
  "[RETRY HINT 2: previous attempt still cut short. Paraphrase your intended beat in different words — terse (≤ 150 words narration), avoid graphic embellishment, preserve the core action. Output well-formed JSON within budget.]";

// onProgress (optional): called with { thinking, text } chunks as they
// stream in from the edge function. `thinking` chunks fire as DeepSeek emits
// its reasoning trace; `text` chunks fire as the answer JSON streams. Both
// are partial — concatenate to build the full string. The final narrator
// beat is returned from this function after the stream completes.
//
// Retry policy on truncation: attempt 0 is the original call. If it parses
// cleanly, return immediately. If it arrives truncated (extractJSON salvage
// path or unparseable text), silently re-call with RETRY_HINT_1 prepended.
// If that retry also truncates, call once more with RETRY_HINT_2. After at
// most three calls per turn, return the best-of-three by narration text
// length (tie-breaks favor the later attempt, since it was asked for the
// tersest output). onProgress fires through ALL attempts — the user may
// see a "second take" replace the first if they're watching the stream.
// !response.ok errors are NEVER retried (auth/server, not truncation) on
// attempt 0; on attempts 1/2 they're caught so we don't lose attempt 0's
// partial result.
export async function callNarrator(state, userMsgRaw, onProgress) {
  const state_context = buildStateContext(state);
  const trimmedHistory = state.apiHistory.slice(-HISTORY_LIMIT);

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("not authenticated");

  // Attempt 0: original call. Any thrown error (auth, subscription, server)
  // propagates up — these aren't truncation and aren't worth retrying.
  const attempt0 = await runOneAttempt({
    session, state_context, history: trimmedHistory, userMsgRaw, onProgress,
  });
  if (!attempt0.result._truncated) return attempt0.result;

  // Attempt 1: hint retry. History is the SAME as attempt 0 — don't poison
  // the next turn with the failed attempt's prefix. Errors fall back to
  // attempt 0 so we don't lose its partial salvage.
  let attempt1 = null;
  try {
    attempt1 = await runOneAttempt({
      session, state_context, history: trimmedHistory,
      userMsgRaw: `${RETRY_HINT_1}\n${userMsgRaw}`,
      onProgress,
    });
    if (!attempt1.result._truncated) return attempt1.result;
  } catch {
    // Network/server hiccup mid-retry — fall back to best of what we have.
    return attempt0.result;
  }

  // Attempt 2: paraphrase retry. Same fallback discipline.
  let attempt2 = null;
  try {
    attempt2 = await runOneAttempt({
      session, state_context, history: trimmedHistory,
      userMsgRaw: `${RETRY_HINT_2}\n${userMsgRaw}`,
      onProgress,
    });
    if (!attempt2.result._truncated) return attempt2.result;
  } catch {
    // Pick best of what we have so far.
    return pickBest([attempt0.result, attempt1.result]);
  }

  // All three truncated — return the best (longest narration). On a tie,
  // pickBest returns the LATER attempt (terser hint was honored).
  return pickBest([attempt0.result, attempt1.result, attempt2.result]);
}

// Picks the attempt with the longest narration string. Ties go to the later
// attempt in the array (later = stronger retry hint, so likelier to be the
// version the model meant to land on).
function pickBest(results) {
  let best = results[0];
  let bestLen = (best?.narration || "").length;
  for (let i = 1; i < results.length; i++) {
    const r = results[i];
    const len = (r?.narration || "").length;
    if (len >= bestLen) { best = r; bestLen = len; }
  }
  return best;
}

// One round-trip to the narrate edge function. Returns the parsed beat
// (with _truncated flag if salvaged) wrapped as { result }. Throws on
// !response.ok or missing body — the caller decides whether to retry.
async function runOneAttempt({ session, state_context, history, userMsgRaw, onProgress }) {
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
      history,
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
    // Total parse failure — treat as a truncation so the retry loop can try
    // again; if all attempts fail this way we surface the raw text.
    return {
      result: {
        narration: text || "(The narrator stumbles.)",
        minutes_passed: 1,
        _truncated: true,
        _raw: text, _thinking: thinking, _userMsg: userMsg,
      },
    };
  }
  return { result: { ...parsed, _raw: text, _thinking: thinking, _userMsg: userMsg } };
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

    // Match both LF and CRLF event delimiters — the edge function emits LF,
    // but upstream providers sometimes leak CRLF and we want to stay tolerant.
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
