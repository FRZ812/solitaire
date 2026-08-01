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
};

type ProviderLoopOptions = {
  requestRound: (request: ProviderRoundRequest) => Promise<ProviderRoundResponse>;
  request: ProviderRequestBase;
  messages: Array<Record<string, unknown>>;
  tools: Array<Record<string, unknown>>;
  maxRounds: number;
  resolveToolCall: (toolCall: ProviderToolCall) => ProviderToolResolution | null;
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
): Promise<RoundResult> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = "";
  let text = "";
  let finishReason: string | null = null;
  const reasoningDetails: unknown[] = [];
  const toolCallsByIndex = new Map<number, ToolCallAcc>();

  const consumeLine = (line: string) => {
    if (!line.startsWith("data:")) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    try {
      const chunk = JSON.parse(payload);
      const choice = chunk?.choices?.[0] || {};
      const delta = choice.delta || {};
      if (choice.finish_reason) finishReason = choice.finish_reason;

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
          const index = typeof toolCall.index === "number" ? toolCall.index : 0;
          const existing = toolCallsByIndex.get(index) || { id: "", name: "", arguments: "" };
          if (toolCall.id) existing.id = toolCall.id;
          if (toolCall.function?.name) existing.name = toolCall.function.name;
          if (toolCall.function?.arguments) existing.arguments += toolCall.function.arguments;
          toolCallsByIndex.set(index, existing);
        }
      }
    } catch {
      // Ignore malformed provider chunks; a later valid delta may still finish.
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const line of lines) consumeLine(line);
    }
    buffer += decoder.decode();
    if (buffer) consumeLine(buffer);
  } finally {
    reader.releaseLock?.();
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
  const maxRounds = Math.max(1, Math.trunc(options.maxRounds));

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const messages = [...options.messages];
      try {
        for (let round = 0; round < maxRounds; round++) {
          const finalRound = round === maxRounds - 1;
          const upstream = await options.requestRound({
            ...options.request,
            messages,
            tools: options.tools,
            toolChoice: finalRound ? "none" : "auto",
          });

          if (!upstream.ok || !upstream.body) {
            const detail = (await upstream.text()).slice(0, 500);
            console.error("OpenRouter narrator request failed", upstream.status, detail);
            throw new Error("narrator provider request failed");
          }

          const { text, toolCalls, finishReason, reasoningDetails } = await pumpOpenRouterRound(
            upstream.body,
            controller,
            encoder,
          );
          if (finalRound || finishReason !== "tool_calls") break;

          const resolvedCalls = toolCalls.flatMap((toolCall, index) => {
            const normalizedCall = {
              ...toolCall,
              id: toolCall.id || `narrator-tool-${round}-${index}`,
            };
            const resolution = options.resolveToolCall(normalizedCall);
            return resolution ? [{ toolCall: normalizedCall, resolution }] : [];
          });
          if (!resolvedCalls.length) break;

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
        controller.error(error);
        return;
      }
      controller.close();
    },
  });
}
