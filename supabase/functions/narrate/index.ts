import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "deepseek/deepseek-v4-pro";
const MAX_OUTPUT_TOKENS = 4000;
const MAX_FIELD_LENGTH = 120_000;
const MAX_SYSTEM_PROMPT_LENGTH = 200_000;
const MAX_MEMORY_FACT_LENGTH = 600;
const MAX_EXISTING_MEMORIES = 80;

const ALLOWED_MODELS = new Set([
  "poolside/laguna-s-2.1:free",
  "poolside/laguna-s-2.1",
  "tencent/hy3:free",
  "tencent/hy3",
  "deepseek/deepseek-v4-pro",
  "deepseek/deepseek-v4-flash",
  "moonshotai/kimi-k3",
  "z-ai/glm-5.2",
  "x-ai/grok-4.5",
  "minimax/minimax-m3",
]);

const MODEL_FALLBACKS = new Map<string, string[]>([
  ["poolside/laguna-s-2.1:free", ["poolside/laguna-s-2.1"]],
  ["tencent/hy3:free", ["tencent/hy3"]],
]);

const REASONING_MODELS = new Set([
  "deepseek/deepseek-v4-pro",
  "deepseek/deepseek-v4-flash",
  "z-ai/glm-5.2",
  "minimax/minimax-m3",
]);

// A real function-call tool (not a JSON response field) — this is the
// narrator's dedicated long-term memory, distinct from the rolling
// apiHistory window (which drops old turns) and from the per-character
// BONDS & MEMORIES already threaded through state_context (those are
// relationship-scoped; this is world/plot-scoped). Facts recorded here are
// echoed back to the client as a memory_delta event, persisted client-side
// in state.memories, and re-injected into every future state_context
// (see summarizeMemoryBank in src/engine/api.js) — so it survives long
// after the turn it was recorded in has scrolled out of history.
const MEMORY_TOOL = {
  type: "function",
  function: {
    name: "remember",
    description: "Permanently record a durable fact worth recalling long after this turn scrolls out of the conversation window — a promise made, a secret learned, an unresolved thread, a plot-critical detail. Call this whenever something happens that the story will need much later. Keep the fact short, self-contained, and in third person. Don't call it for anything trivial, already recorded, or already tracked elsewhere (inventory, quests, relationships).",
    parameters: {
      type: "object",
      properties: {
        fact: { type: "string", description: "A concise, self-contained statement of the fact to remember (one or two sentences)." },
      },
      required: ["fact"],
    },
  },
};

// Guards against a pathological loop where every round calls remember and
// never produces narrative text — after this many rounds we stop asking and
// let whatever streamed so far stand.
const MAX_TOOL_ROUNDS = 3;

type MemoryMode = "balanced" | "essential" | "manual";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function stringField(value: unknown, name: string, maxLength = MAX_FIELD_LENGTH) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  if (value.length > maxLength) throw new Error(`${name} is too large`);
  return value;
}

function asHistory(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(-24).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { role, content } = entry as { role?: unknown; content?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof content !== "string" || !content.trim()) return [];
    return [{ role, content: content.slice(0, MAX_FIELD_LENGTH) }];
  });
}

function normalizeMemoryFact(value: unknown) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, MAX_MEMORY_FACT_LENGTH)
    : "";
}

function memoryFingerprint(value: unknown) {
  return normalizeMemoryFact(value).normalize("NFKC").toLocaleLowerCase().replace(/[.!?]+$/g, "");
}

function asExistingMemories(value: unknown) {
  if (!Array.isArray(value)) return [];
  const facts: string[] = [];
  const seen = new Set<string>();
  for (const candidate of value.slice(-MAX_EXISTING_MEMORIES)) {
    const fact = normalizeMemoryFact(candidate);
    const key = memoryFingerprint(fact);
    if (!fact || !key || seen.has(key)) continue;
    seen.add(key);
    facts.push(fact);
  }
  return facts;
}

function selectedMemoryMode(value: unknown): MemoryMode {
  return value === "essential" || value === "manual" ? value : "balanced";
}

function memoryToolFor(mode: MemoryMode) {
  if (mode !== "essential") return MEMORY_TOOL;
  return {
    ...MEMORY_TOOL,
    function: {
      ...MEMORY_TOOL.function,
      description: `${MEMORY_TOOL.function.description} ESSENTIAL-ONLY mode is active: use this only for a fact likely to matter many turns from now, and batch independent facts in parallel.`,
    },
  };
}

function selectedModel(value: unknown) {
  return typeof value === "string" && ALLOWED_MODELS.has(value) ? value : DEFAULT_MODEL;
}

function selectedModels(model: string) {
  return [model, ...(MODEL_FALLBACKS.get(model) || [])];
}

function selectedReasoning(model: string, effort: unknown) {
  if (!REASONING_MODELS.has(model)) return undefined;
  if (effort !== "high" && effort !== "max") return undefined;
  return { effort: effort === "max" ? "xhigh" : "high" };
}

function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => typeof part === "object" && part && "text" in part ? String((part as { text?: unknown }).text || "") : "")
    .join("");
}

function toAnthropicEvent(type: "text_delta" | "thinking_delta", value: string) {
  if (!value) return "";
  const delta = type === "text_delta" ? { type, text: value } : { type, thinking: value };
  return `data: ${JSON.stringify({ type: "content_block_delta", delta })}\n\n`;
}

function toMemoryEvent(fact: string) {
  return `data: ${JSON.stringify({ type: "memory_delta", fact })}\n\n`;
}

type ToolCallAcc = { id: string; name: string; arguments: string };

// Reads one OpenRouter SSE response to completion, forwarding text/thinking
// deltas live onto `controller`, and accumulating any streamed tool_calls
// (which arrive as fragments keyed by index — id/name on the first fragment,
// arguments trickling in across subsequent ones). Returns what the round
// produced so the caller can decide whether to loop for another round.
async function pumpOpenRouterRound(
  body: ReadableStream<Uint8Array>,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
): Promise<{ text: string; toolCalls: ToolCallAcc[]; finishReason: string | null }> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = "";
  let text = "";
  let finishReason: string | null = null;
  const toolCallsByIndex = new Map<number, ToolCallAcc>();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const chunk = JSON.parse(payload);
          const choice = chunk?.choices?.[0] || {};
          const delta = choice.delta || {};
          if (choice.finish_reason) finishReason = choice.finish_reason;

          const reasoning = toText(delta.reasoning ?? delta.reasoning_content);
          const content = toText(delta.content);
          text += content;
          const thinkingEvent = toAnthropicEvent("thinking_delta", reasoning);
          const textEvent = toAnthropicEvent("text_delta", content);
          if (thinkingEvent) controller.enqueue(encoder.encode(thinkingEvent));
          if (textEvent) controller.enqueue(encoder.encode(textEvent));

          if (Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const index = typeof tc.index === "number" ? tc.index : 0;
              const existing = toolCallsByIndex.get(index) || { id: "", name: "", arguments: "" };
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.name = tc.function.name;
              if (tc.function?.arguments) existing.arguments += tc.function.arguments;
              toolCallsByIndex.set(index, existing);
            }
          }
        } catch {
          // Ignore malformed provider chunks; a later valid delta may still complete the beat.
        }
      }
    }
  } finally {
    reader.releaseLock?.();
  }

  return { text, toolCalls: [...toolCallsByIndex.values()], finishReason };
}

// Drives the full narrator turn: calls OpenRouter, and whenever the model
// calls `remember`, emits a memory_delta event for the client, appends the
// tool call + a synthetic tool result onto the message list, and loops for
// another round so the model can continue narrating. Bounded by
// MAX_TOOL_ROUNDS so a pathological remember-only loop can't hang the request.
function streamNarratorTurn(opts: {
  apiKey: string;
  models: string[];
  reasoning?: { effort: string };
  messages: Array<Record<string, unknown>>;
  memoryMode: MemoryMode;
  existingMemories: string[];
}) {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const messages = [...opts.messages];
      const knownMemoryKeys = new Set(opts.existingMemories.map(memoryFingerprint).filter(Boolean));
      const toolsEnabled = opts.memoryMode !== "manual";
      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const upstream = await fetch(OPENROUTER_URL, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${opts.apiKey}`,
              "Content-Type": "application/json",
              "X-Title": "Solitaire",
            },
            body: JSON.stringify({
              models: opts.models,
              stream: true,
              max_tokens: MAX_OUTPUT_TOKENS,
              messages,
              ...(toolsEnabled ? {
                tools: [memoryToolFor(opts.memoryMode)],
                tool_choice: "auto",
                parallel_tool_calls: true,
              } : {}),
              ...(opts.reasoning ? { reasoning: opts.reasoning } : {}),
            }),
          });

          if (!upstream.ok || !upstream.body) {
            const detail = (await upstream.text()).slice(0, 500);
            console.error("OpenRouter narrator request failed", upstream.status, detail);
            throw new Error("narrator provider request failed");
          }

          const { text, toolCalls, finishReason } = await pumpOpenRouterRound(upstream.body, controller, encoder);
          const rememberCalls = toolCalls.filter((tc) => tc.name === "remember");

          // No tool call this round (or none we recognize) — the model gave
          // its final narrative answer, nothing more to loop for.
          if (!rememberCalls.length || finishReason !== "tool_calls") break;
          messages.push({
            role: "assistant",
            content: text || null,
            tool_calls: rememberCalls.map((tc) => ({
              id: tc.id,
              type: "function",
              function: { name: tc.name, arguments: tc.arguments },
            })),
          });
          for (const tc of rememberCalls) {
            let fact = "";
            try { fact = normalizeMemoryFact(JSON.parse(tc.arguments || "{}").fact); } catch { /* malformed args — skip */ }
            const key = memoryFingerprint(fact);
            const isDuplicate = !!key && knownMemoryKeys.has(key);
            if (fact && key && !isDuplicate) {
              knownMemoryKeys.add(key);
              controller.enqueue(encoder.encode(toMemoryEvent(fact)));
            }
            const result = !fact ? "ignored: no fact given" : isDuplicate ? "ignored: already recorded" : "recorded";
            messages.push({ role: "tool", tool_call_id: tc.id, content: result });
          }
          // Record calls made in the final budgeted round, then stop without
          // opening a provider request that cannot be followed through.
          if (round === MAX_TOOL_ROUNDS - 1) break;
        }
      } catch (error) {
        controller.error(error);
        return;
      }
      controller.close();
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);

  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) return json({ error: "OPENROUTER_API_KEY is not configured" }, 500);

  const authorization = request.headers.get("Authorization");
  const accessToken = authorization?.replace(/^Bearer\s+/i, "");
  if (!accessToken || accessToken === authorization) return json({ error: "not authenticated" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !supabaseKey) return json({ error: "Supabase function environment is incomplete" }, 500);

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) return json({ error: "not authenticated" }, 401);

  const { data: subscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("is_subscribed")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (subscriptionError) return json({ error: "subscription lookup failed" }, 500);
  if (!subscription?.is_subscribed) return json({ error: "subscription required" }, 402);

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }

  let stateContext: string;
  let userMessage: string;
  let systemPrompt: string;
  try {
    stateContext = stringField(payload.state_context, "state_context");
    userMessage = stringField(payload.user_msg, "user_msg");
    systemPrompt = stringField(payload.system_prompt, "system_prompt", MAX_SYSTEM_PROMPT_LENGTH);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "invalid request" }, 400);
  }

  const model = selectedModel(payload.model);
  const models = selectedModels(model);
  const reasoning = selectedReasoning(model, payload.reasoning_effort);
  const memoryMode = selectedMemoryMode(payload.memory_mode);
  const existingMemories = asExistingMemories(payload.existing_memories);
  const messages = [
    { role: "system", content: systemPrompt },
    ...asHistory(payload.history),
    { role: "user", content: `${stateContext}\n\n${userMessage}` },
  ];

  return new Response(streamNarratorTurn({ apiKey, models, reasoning, messages, memoryMode, existingMemories }), {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
