// Web-mode narrator call. Invokes the public.narrate Postgres RPC (see
// supabase/migrations/*_narrate_rpc.sql) which enforces auth + the manual
// subscription allowlist and calls Gemini server-side. The whole backend is
// managed from the Supabase SQL editor — no edge function to deploy.
//
// The RPC returns the model's text in one shot; we extract the JSON the same
// way the streaming path did, so the rest of the engine is unchanged.
import { HISTORY_LIMIT } from "../config.js";
import { supabase } from "./supabase-client.js";
import { buildStateContext } from "./api.js";
import { extractJSON } from "./json.js";

export async function callNarrator(state, userMsgRaw) {
  const state_context = buildStateContext(state);
  const trimmedHistory = state.apiHistory.slice(-HISTORY_LIMIT);

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("not authenticated");

  // supabase-js attaches the user's JWT automatically, so auth.uid() and the
  // subscription check resolve inside the function.
  const { data, error } = await supabase.rpc("narrate", {
    state_context,
    user_msg: userMsgRaw,
    history: trimmedHistory,
  });

  if (error) {
    // Surface the gate states cleanly. PostgREST maps our RAISE errcodes:
    // 28000 → not authenticated, 42501 → subscription required.
    const msg = error.message || String(error);
    if (/subscription required/i.test(msg)) throw new Error("subscription required");
    if (/not authenticated/i.test(msg)) throw new Error("not authenticated");
    throw new Error(`narrate: ${msg}`);
  }

  const text = typeof data === "string" ? data : String(data ?? "");
  const userMsg = `${state_context}\n\n${userMsgRaw}`;
  const parsed = extractJSON(text);
  if (!parsed) {
    return { narration: text || "(The narrator stumbles.)", minutes_passed: 1, _raw: text, _userMsg: userMsg };
  }
  return { ...parsed, _raw: text, _userMsg: userMsg };
}
