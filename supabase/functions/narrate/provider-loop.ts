export type ProviderToolCall = {
  id: string;
  name: string;
  arguments: string;
};

export type ProviderToolResolution = {
  result: string;
  events?: string[];
};

type ProviderRoundResponse = {
  ok: boolean;
  body: ReadableStream<Uint8Array> | null;
  status: number;
  text(): Promise<string>;
};

type ProviderRequestBase = {
  apiKey: string;
  model: string;
  effort: unknown;
};

type ProviderRoundRequest = ProviderRequestBase & {
  messages: Array<Record<string, unknown>>;
  tools: Array<Record<string, unknown>>;
  toolChoice: "auto" | "none";
  signal?: AbortSignal;
};

type ProviderLoopOptions = {
  requestRound: (request: ProviderRoundRequest) => Promise<ProviderRoundResponse>;
  request: ProviderRequestBase;
  messages: Array<Record<string, unknown>>;
  tools: Array<Record<string, unknown>>;
  maxRounds: number;
  maxProviderBytes?: number;
  maxProviderRequestBytes?: number;
  signal?: AbortSignal;
  resolveToolCall: (toolCall: ProviderToolCall) => ProviderToolResolution | null;
};

type ProviderLoopLifecycle = {
  activeReader: ReadableStreamDefaultReader<Uint8Array> | null;
};

type ToolCallAcc = ProviderToolCall;

type RoundResult = {
  text: string;
  toolCalls: ToolCallAcc[];
  finishReason: string | null;
  reasoningDetails: unknown[];
};

function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => typeof part === "object" && part && "text" in part
      ? String((part as { text?: unknown }).text || "")
      : "")
    .join("");
}

function toAnthropicEvent(type: "text_delta" | "thinking_delta", value: string) {
  if (!value) return "";
  const delta = type === "text_delta" ? { type, text: value } : { type, thinking: value };
  return `data: ${JSON.stringify({ type: "content_block_delta", delta })}\n\n`;
}

function toRoundResetEvent() {
  return `data: ${JSON.stringify({ type: "narrator_round_reset" })}\n\n`;
}

// Reads one OpenRouter SSE response to completion, forwarding text/thinking
// deltas live and accumulating streamed tool-call fragments by index.
async function pumpOpenRouterRound(
  body: ReadableStream<Uint8Array>,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  maxProviderBytes: number,
  lifecycle: ProviderLoopLifecycle,
): Promise<RoundResult> {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const reader = body.getReader();
  lifecycle.activeReader = reader;
  let buffer = "";
  let text = "";
  let receivedBytes = 0;
  let sawTerminalMarker = false;
  let finishReason: string | null = null;
  const reasoningDetails: unknown[] = [];
  const toolCallsByIndex = new Map<number, ToolCallAcc>();

  const consumeFrame = (frame: string) => {
    if (sawTerminalMarker) {
      throw new Error("Provider stream continued after its terminal marker.");
    }
    const lines = frame.split(/\r?\n/).filter(Boolean);
    if (lines.length !== 1) {
      throw new Error("Provider stream contained an invalid SSE frame.");
    }
    const line = lines[0];
    if (!line.startsWith("data:")) {
      throw new Error("Provider stream contained an invalid SSE frame.");
    }
    const payload = line.slice(5).trim();
    if (!payload) return;
    if (payload === "[DONE]") {
      sawTerminalMarker = true;
      return;
    }
    let chunk: Record<string, unknown>;
    try {
      chunk = JSON.parse(payload);
      if (!chunk || typeof chunk !== "object" || Array.isArray(chunk)) throw new Error();
    } catch {
      throw new Error("Provider stream contained malformed JSON.");
    }
    if (Object.prototype.hasOwnProperty.call(chunk, "error")) {
      throw new Error("Provider stream reported an error.");
    }
    {
      const choices = Array.isArray(chunk.choices) ? chunk.choices : [];
      const choice = choices[0] && typeof choices[0] === "object"
        ? choices[0] as Record<string, unknown>
        : {};
      const delta = choice.delta && typeof choice.delta === "object"
        ? choice.delta as Record<string, unknown>
        : {};
      if (typeof choice.finish_reason === "string") finishReason = choice.finish_reason;

      const reasoning = toText(delta.reasoning ?? delta.reasoning_content);
      const content = toText(delta.content);
      text += content;
      if (Array.isArray(delta.reasoning_details)) {
        reasoningDetails.push(...delta.reasoning_details);
      }
      const thinkingEvent = toAnthropicEvent("thinking_delta", reasoning);
      const textEvent = toAnthropicEvent("text_delta", content);
      if (thinkingEvent) controller.enqueue(encoder.encode(thinkingEvent));
      if (textEvent) controller.enqueue(encoder.encode(textEvent));

      if (Array.isArray(delta.tool_calls)) {
        for (const toolCall of delta.tool_calls) {
          if (!toolCall || typeof toolCall !== "object") {
            throw new Error("Provider stream contained an invalid event shape.");
          }
          const call = toolCall as Record<string, unknown>;
          const index = typeof call.index === "number" ? call.index : 0;
          const existing = toolCallsByIndex.get(index) || { id: "", name: "", arguments: "" };
          if (typeof call.id === "string") existing.id = call.id;
          const fn = call.function && typeof call.function === "object"
            ? call.function as Record<string, unknown>
            : {};
          if (typeof fn.name === "string") existing.name = fn.name;
          if (typeof fn.arguments === "string") existing.arguments += fn.arguments;
          toolCallsByIndex.set(index, existing);
        }
      }
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > maxProviderBytes) {
        await reader.cancel().catch(() => {});
        throw new Error("Provider response exceeded the byte limit.");
      }
      buffer += decoder.decode(value, { stream: true });
      while (true) {
        const separator = /\r?\n\r?\n/.exec(buffer);
        if (!separator || separator.index === undefined) break;
        const frame = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator[0].length);
        if (frame) consumeFrame(frame);
      }
    }
    buffer += decoder.decode();
    if (buffer) {
      throw new Error("Provider stream ended with an unterminated SSE frame.");
    }
    if (!sawTerminalMarker) {
      throw new Error("Provider stream ended without a terminal marker.");
    }
  } catch (error) {
    await reader.cancel(error).catch(() => {});
    throw error;
  } finally {
    reader.releaseLock?.();
    if (lifecycle.activeReader === reader) lifecycle.activeReader = null;
  }

  return {
    text,
    toolCalls: [...toolCallsByIndex.values()],
    finishReason,
    reasoningDetails,
  };
}

// Runs a bounded provider/tool loop. Tool calls are enabled only before the
// final round, which is always reserved for a complete structured answer.
export function streamProviderToolLoop(options: ProviderLoopOptions) {
  const encoder = new TextEncoder();
  const abortController = new AbortController();
  const lifecycle: ProviderLoopLifecycle = { activeReader: null };
  let downstreamCancelled = false;
  const cancelActiveWork = async (reason: unknown) => {
    if (!abortController.signal.aborted) abortController.abort(reason);
    await lifecycle.activeReader?.cancel(reason).catch(() => {});
  };
  const onExternalAbort = () => {
    void cancelActiveWork(options.signal?.reason);
  };
  if (options.signal?.aborted) abortController.abort(options.signal.reason);
  else options.signal?.addEventListener("abort", onExternalAbort, { once: true });
  const maxRounds = Math.max(1, Math.trunc(options.maxRounds));
  const maxProviderBytes = Number.isFinite(options.maxProviderBytes)
    ? Math.max(1, Math.trunc(options.maxProviderBytes as number))
    : 2_000_000;
  const maxProviderRequestBytes = Number.isFinite(options.maxProviderRequestBytes)
    ? Math.max(1, Math.trunc(options.maxProviderRequestBytes as number))
    : 2_000_000;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const messages = [...options.messages];
      try {
        for (let round = 0; round < maxRounds; round++) {
          const finalRound = round === maxRounds - 1;
          const roundRequest = {
            ...options.request,
            messages,
            tools: options.tools,
            toolChoice: finalRound ? "none" : "auto",
            signal: abortController.signal,
          } as ProviderRoundRequest;
          const { apiKey: _apiKey, signal: _signal, ...providerBodyInput } = roundRequest;
          void _apiKey;
          void _signal;
          if (encoder.encode(JSON.stringify(providerBodyInput)).byteLength > maxProviderRequestBytes) {
            throw new Error("Provider request exceeded the byte limit.");
          }
          const upstream = await options.requestRound(roundRequest);

          if (!upstream.ok || !upstream.body) {
            console.error("OpenRouter narrator request failed", upstream.status);
            throw new Error("narrator provider request failed");
          }

          const { text, toolCalls, finishReason, reasoningDetails } = await pumpOpenRouterRound(
            upstream.body,
            controller,
            encoder,
            maxProviderBytes,
            lifecycle,
          );
          if (finishReason !== "tool_calls") {
            if (finishReason !== "stop") {
              throw new Error("Provider stream ended with a non-success finish reason.");
            }
            break;
          }
          if (finalRound) {
            throw new Error("Provider emitted tool calls during the reserved final round.");
          }

          if (toolCalls.length === 0) {
            throw new Error("Provider emitted an empty tool-call finish.");
          }
          const resolvedCalls = toolCalls.map((toolCall, index) => {
            const normalizedCall = {
              ...toolCall,
              id: toolCall.id || `narrator-tool-${round}-${index}`,
            };
            const resolution = options.resolveToolCall(normalizedCall);
            if (!resolution) {
              throw new Error("Provider emitted an unresolved tool call.");
            }
            return { toolCall: normalizedCall, resolution };
          });

          // Text emitted before a tool call is not the final JSON document.
          // Reset the browser accumulator before streaming the follow-up round.
          controller.enqueue(encoder.encode(toRoundResetEvent()));
          messages.push({
            role: "assistant",
            content: text || null,
            ...(reasoningDetails.length ? { reasoning_details: reasoningDetails } : {}),
            tool_calls: resolvedCalls.map(({ toolCall }) => ({
              id: toolCall.id,
              type: "function",
              function: { name: toolCall.name, arguments: toolCall.arguments },
            })),
          });
          for (const { toolCall, resolution } of resolvedCalls) {
            for (const event of resolution.events || []) {
              controller.enqueue(encoder.encode(event));
            }
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: resolution.result,
            });
          }
        }
      } catch (error) {
        if (!downstreamCancelled) {
          controller.error(abortController.signal.aborted ? abortController.signal.reason : error);
        }
        return;
      } finally {
        options.signal?.removeEventListener("abort", onExternalAbort);
      }
      if (!downstreamCancelled) controller.close();
    },
    async cancel(reason) {
      downstreamCancelled = true;
      options.signal?.removeEventListener("abort", onExternalAbort);
      await cancelActiveWork(reason);
    },
  });
}
