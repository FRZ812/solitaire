import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { SYSTEM_PROMPT } from "./system-prompt.ts";

const MODEL = "claude-opus-4-7";
const HISTORY_LIMIT = 100;
const MAX_BODY_BYTES = 1_000_000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST")    return json({ error: "method not allowed" }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY not configured on the edge function" }, 500);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: "body too large" }, 413);

  let body: any;
  try { body = JSON.parse(raw); } catch { return json({ error: "invalid JSON" }, 400); }

  const { state_context, user_msg, history } = body ?? {};
  if (typeof state_context !== "string" || typeof user_msg !== "string" || !Array.isArray(history)) {
    return json({ error: "expected { state_context: string, user_msg: string, history: array }" }, 400);
  }

  const trimmedHistory = history.slice(-HISTORY_LIMIT);
  const messages = [...trimmedHistory, { role: "user", content: `${state_context}\n\n${user_msg}` }];

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      stream: true,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    return json({ error: `anthropic ${upstream.status}`, detail: errText.slice(0, 500) }, 502);
  }

  return new Response(upstream.body, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
});
