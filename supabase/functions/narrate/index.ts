// deno-lint-ignore no-import-prefix -- Supabase Edge resolves this pinned JSR import directly.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { streamProviderToolLoop } from "./provider-loop.ts";
import { requestNarratorRound, selectedModel } from "./routing.ts";
import { finalizeBoundedNarratorSSE, readBoundedJsonRequest } from "./transport-limits.ts";
import {
  asOptionalInstructionLibrary,
  instructionToolFor,
  prepareInstructionRouting,
  resolveInstructionToolCall,
  type InstructionSkill,
} from "./tools.ts";

const MAX_FIELD_LENGTH = 120_000;
// Accept the retired monolith during a rolling Edge/client deployment. New
// clients still send the compact prompt enforced in the browser contract.
const MAX_SYSTEM_PROMPT_LENGTH = 200_000;
const MAX_MEMORY_FACT_LENGTH = 600;
const MAX_EXISTING_MEMORIES = 80;
const MAX_REQUEST_BYTES = 2_000_000;
const MAX_STREAM_BYTES = 2_000_000;

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

// Bound provider round-trips without truncating model output. The final round
// disables tools so every accepted turn has a chance to finish its JSON.
const MAX_PROVIDER_ROUNDS = 5;

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

function toMemoryEvent(fact: string) {
  return `data: ${JSON.stringify({ type: "memory_delta", fact })}\n\n`;
}


// Drives the full narrator turn through the executable, unit-tested provider
// loop. Skill and memory state live for exactly one narrator attempt.
function streamNarratorTurn(opts: {
  apiKey: string;
  model: string;
  effort: unknown;
  messages: Array<Record<string, unknown>>;
  memoryMode: MemoryMode;
  existingMemories: string[];
  instructionLibrary: InstructionSkill[];
  preloadedSkillIds: string[];
  signal: AbortSignal;
}) {
  const knownMemoryKeys = new Set(opts.existingMemories.map(memoryFingerprint).filter(Boolean));
  const loadedSkillIds = new Set<string>(opts.preloadedSkillIds);
  const tools = [
    ...(opts.instructionLibrary.length ? [instructionToolFor(opts.instructionLibrary)] : []),
    ...(opts.memoryMode === "manual" ? [] : [memoryToolFor(opts.memoryMode)]),
  ];

  return streamProviderToolLoop({
    requestRound: requestNarratorRound,
    request: {
      apiKey: opts.apiKey,
      model: opts.model,
      effort: opts.effort,
    },
    messages: opts.messages,
    tools,
    maxRounds: MAX_PROVIDER_ROUNDS,
    signal: opts.signal,
    resolveToolCall(toolCall) {
      const instructionResult = resolveInstructionToolCall(
        toolCall,
        opts.instructionLibrary,
        loadedSkillIds,
      );
      if (instructionResult.recognized) {
        return { result: instructionResult.result };
      }
      if (toolCall.name !== "remember" || opts.memoryMode === "manual") return null;

      let fact = "";
      try {
        fact = normalizeMemoryFact(JSON.parse(toolCall.arguments || "{}").fact);
      } catch {
        // Malformed arguments produce a bounded tool result, never an event.
      }
      const key = memoryFingerprint(fact);
      const isDuplicate = !!key && knownMemoryKeys.has(key);
      if (fact && key && !isDuplicate) knownMemoryKeys.add(key);
      const result = !fact
        ? "ignored: no fact given"
        : isDuplicate
          ? "ignored: already recorded"
          : "recorded";
      return {
        result,
        ...(fact && key && !isDuplicate ? { events: [toMemoryEvent(fact)] } : {}),
      };
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);

  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) return json({ error: "OPENROUTER_API_KEY is not configured" }, 500);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "not authenticated" }, 401);
  const accessToken = authorization.replace(/^Bearer\s+/i, "");
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
    payload = await readBoundedJsonRequest(request, MAX_REQUEST_BYTES);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid JSON";
    return json({ error: message === "Narrator request exceeded the byte limit." ? message : "invalid JSON" }, 400);
  }

  let stateContext: string;
  let userMessage: string;
  let systemPrompt: string;
  let instructionLibrary: InstructionSkill[];
  let routing: ReturnType<typeof prepareInstructionRouting>;
  try {
    stateContext = stringField(payload.state_context, "state_context");
    userMessage = stringField(payload.user_msg, "user_msg");
    systemPrompt = stringField(payload.system_prompt, "system_prompt", MAX_SYSTEM_PROMPT_LENGTH);
    instructionLibrary = asOptionalInstructionLibrary(payload.narrator_skills);
    routing = prepareInstructionRouting(
      instructionLibrary,
      payload.allowed_narrator_skills,
      payload.required_narrator_skills,
    );
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "invalid request" }, 400);
  }

  const model = selectedModel(payload.model);
  const memoryMode = selectedMemoryMode(payload.memory_mode);
  const existingMemories = asExistingMemories(payload.existing_memories);
  const messages = [
    {
      role: "system",
      content: routing.preloadedContent
        ? `${systemPrompt}\n\nENGINE-PRELOADED REQUIRED NARRATOR DOCTRINE\n${routing.preloadedContent}`
        : systemPrompt,
    },
    ...asHistory(payload.history),
    { role: "user", content: `${stateContext}\n\n${userMessage}` },
  ];

  const providerStream = streamNarratorTurn({
    apiKey,
    model,
    effort: payload.reasoning_effort,
    messages,
    memoryMode,
    existingMemories,
    instructionLibrary: routing.instructionLibrary,
    preloadedSkillIds: routing.preloadedSkillIds,
    signal: request.signal,
  });
  return new Response(finalizeBoundedNarratorSSE(providerStream, MAX_STREAM_BYTES), {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
