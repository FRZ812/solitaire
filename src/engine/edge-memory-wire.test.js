// The Edge side of typed memory.
//
// A memory used to be a bare string: `{fact}` in, `{fact}` out. A string is not about
// anyone, so nothing downstream could recall it when the person it concerned walked back
// into the room, recognise a rephrasing as the same memory, or tell a character's belief
// apart from something that actually happened.
//
// These run against the real Edge module rather than a copy, because a wire contract that is
// tested against a reimplementation of itself is not tested at all.

import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

const moduleUrl = new URL("../../supabase/functions/narrate/memory-wire.ts", import.meta.url);

async function wire() {
  return import("../../supabase/functions/narrate/memory-wire.ts");
}

function proposal(overrides = {}) {
  return {
    kind: "person",
    subject_ids: ["hale"],
    text: "Hale keeps the toll bridge and remembers a slight.",
    ...overrides,
  };
}

describe("the module exists where the Edge expects it", () => {
  it("is a separate file, so it can be tested without starting a server", () => {
    expect(existsSync(moduleUrl)).toBe(true);
  });
});

describe("reading a proposal", () => {
  it("accepts a well-formed one and projects it to camelCase", async () => {
    // The wire speaks snake_case and the browser speaks camelCase. Projecting here, once,
    // means the browser never has to know the wire's spelling.
    const { asMemoryProposal } = await wire();
    const read = asMemoryProposal(proposal());
    expect(read.error).toBeUndefined();
    expect(read.proposal).toEqual({
      kind: "person",
      subjectIds: ["hale"],
      scopeIds: ["campaign"],
      text: "Hale keeps the toll bridge and remembers a slight.",
      evidence: [],
    });
  });

  it("refuses a memory about nobody", async () => {
    const { asMemoryProposal } = await wire();
    expect((await wire()).asMemoryProposal(proposal({ subject_ids: [] })).error)
      .toContain("subject_ids");
    expect(asMemoryProposal({ kind: "person", text: "A fact." }).error).toContain("subject_ids");
  });

  it("refuses the vocabulary it replaced", async () => {
    // A stray `content` or `relevance` is a previous shape arriving late. Accepting it
    // quietly is how two vocabularies end up on one wire with nobody sure which is
    // authoritative.
    const { asMemoryProposal } = await wire();
    expect(asMemoryProposal({ ...proposal(), content: "x" }).error).toContain("unknown field content");
    expect(asMemoryProposal({ ...proposal(), relevance: 5 }).error).toContain("unknown field relevance");
    expect(asMemoryProposal({ ...proposal(), entities: ["hale"] }).error).toContain("unknown field entities");
  });

  it("names the field it got wrong, so the model can fix the next call", async () => {
    // A bare "invalid" teaches it nothing; the tool result is the only feedback it gets.
    const { asMemoryProposal, MEMORY_KINDS } = await wire();
    const error = asMemoryProposal(proposal({ kind: "prophecy" })).error;
    expect(error).toContain("kind must be one of");
    for (const kind of MEMORY_KINDS) expect(error).toContain(kind);
  });

  it("refuses empty text and arguments that are not an object", async () => {
    const { asMemoryProposal } = await wire();
    expect(asMemoryProposal(proposal({ text: "   " })).error).toContain("no text given");
    expect(asMemoryProposal(null).error).toContain("not an object");
    expect(asMemoryProposal([proposal()]).error).toContain("not an object");
  });
});

describe("the line between a view and a fact", () => {
  it("lets a belief or a grudge rest on nothing", async () => {
    // These are explicitly one character's perspective, so they need no proof.
    const { asMemoryProposal } = await wire();
    expect(asMemoryProposal(proposal({ kind: "belief" })).proposal).toBeTruthy();
    expect(asMemoryProposal(proposal({ kind: "grudge" })).proposal).toBeTruthy();
  });

  it("makes an event name the receipt it happened in", async () => {
    // Otherwise a narrator's guess about someone's motives returns next turn as established
    // fact and is never questioned again.
    const { asMemoryProposal } = await wire();
    expect(asMemoryProposal(proposal({ kind: "event" })).error).toContain("must cite a receipt");
    expect(asMemoryProposal(proposal({
      kind: "event",
      evidence_refs: [{ kind: "turn", id: "turn-42" }],
    })).error).toContain("must cite a receipt");
    expect(asMemoryProposal(proposal({
      kind: "event",
      evidence_refs: [{ kind: "receipt", id: "combat-1" }],
    })).proposal).toBeTruthy();
  });

  it("makes a promise or a relationship cite the turn it was made in", async () => {
    // One nobody can point at is one the narrator invented this turn.
    const { asMemoryProposal } = await wire();
    expect(asMemoryProposal(proposal({ kind: "promise" })).error).toContain("cite the turn");
    expect(asMemoryProposal(proposal({ kind: "relationship" })).error).toContain("cite the turn");
    expect(asMemoryProposal(proposal({
      kind: "promise",
      evidence_refs: [{ kind: "dialogue", id: "turn-42" }],
    })).proposal).toBeTruthy();
  });

  it("refuses evidence it cannot read", async () => {
    const { asMemoryProposal } = await wire();
    expect(asMemoryProposal(proposal({ evidence_refs: [{ kind: "vibes", id: "x" }] })).error)
      .toContain("evidence kind must be one of");
    expect(asMemoryProposal(proposal({ evidence_refs: [{ kind: "turn" }] })).error)
      .toContain("evidence id");
    expect(asMemoryProposal(proposal({ evidence_refs: "turn-42" })).error)
      .toContain("evidence_refs must be a short list");
  });
});

describe("bounds", () => {
  it("caps subjects, scopes and evidence rather than trusting the model", async () => {
    const { asMemoryProposal, MAX_MEMORY_SUBJECTS, MAX_MEMORY_EVIDENCE } = await wire();
    const manySubjects = Array.from({ length: MAX_MEMORY_SUBJECTS + 1 }, (_, i) => `npc-${i}`);
    expect(asMemoryProposal(proposal({ subject_ids: manySubjects })).error).toContain("subject_ids");
    const manyRefs = Array.from({ length: MAX_MEMORY_EVIDENCE + 1 }, (_, i) => ({ kind: "turn", id: `t-${i}` }));
    expect(asMemoryProposal(proposal({ evidence_refs: manyRefs })).error).toContain("short list");
  });

  it("trims text to the recorded limit rather than storing an essay", async () => {
    const { asMemoryProposal, MAX_MEMORY_FACT_LENGTH } = await wire();
    const read = asMemoryProposal(proposal({ text: "x".repeat(MAX_MEMORY_FACT_LENGTH * 3) }));
    expect(read.proposal.text.length).toBe(MAX_MEMORY_FACT_LENGTH);
  });

  it("drops duplicate ids without complaint", async () => {
    const { asMemoryProposal } = await wire();
    expect(asMemoryProposal(proposal({ subject_ids: ["hale", "hale"] })).proposal.subjectIds)
      .toEqual(["hale"]);
  });
});

describe("the tool the model is shown", () => {
  it("asks for the typed shape and nothing else", async () => {
    const { MEMORY_TOOL, MEMORY_KINDS } = await wire();
    const params = MEMORY_TOOL.function.parameters;
    expect(MEMORY_TOOL.function.name).toBe("remember");
    expect(params.additionalProperties).toBe(false);
    expect(Object.keys(params.properties).sort())
      .toEqual(["evidence_refs", "kind", "scope_ids", "subject_ids", "text"]);
    expect(params.required.sort()).toEqual(["kind", "subject_ids", "text"]);
    expect(params.properties.kind.enum).toEqual([...MEMORY_KINDS]);
    // The retired field is gone from what the model is offered, not merely rejected later.
    expect(Object.keys(params.properties)).not.toContain("fact");
  });

  it("tells the model why subjects matter", async () => {
    const { MEMORY_TOOL } = await wire();
    expect(MEMORY_TOOL.function.parameters.properties.subject_ids.description)
      .toContain("recalled");
  });
});

describe("the streamed event", () => {
  it("carries the typed proposal", async () => {
    const { asMemoryProposal, toMemoryEvent } = await wire();
    const { proposal: read } = asMemoryProposal(proposal());
    const event = toMemoryEvent(read);
    expect(event.startsWith("data: ")).toBe(true);
    expect(event.endsWith("\n\n")).toBe(true);
    const body = JSON.parse(event.slice(6).trim());
    expect(body.type).toBe("memory_delta");
    expect(body.proposal).toEqual(read);
  });

  it("keeps `fact` alongside it for a server-first rollout", async () => {
    // The Edge deploys before the clients do, and an older client reads only `fact`. It is
    // the proposal's own text, so the two can never disagree.
    const { asMemoryProposal, toMemoryEvent } = await wire();
    const { proposal: read } = asMemoryProposal(proposal());
    const body = JSON.parse(toMemoryEvent(read).slice(6).trim());
    expect(body.fact).toBe(read.text);
  });
});

describe("through the real provider loop", () => {
  // The wire is only correct if a tool round actually produces the event, so this drives the
  // production loop with a stubbed provider rather than calling the resolver directly.
  async function runTurn(toolArguments) {
    const { asMemoryProposal, memoryFingerprint, toMemoryEvent } = await wire();
    const { streamProviderToolLoop } = await import(
      "../../supabase/functions/narrate/provider-loop.ts"
    );

    const rounds = [
      // Round one: the model calls `remember`.
      [
        { choices: [{ delta: { tool_calls: [{ index: 0, id: "call-1", type: "function", function: { name: "remember", arguments: toolArguments } }] }, finish_reason: null }] },
        { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
      ],
      // Round two: it finishes.
      [
        { choices: [{ delta: { content: "{}" }, finish_reason: null }] },
        { choices: [{ delta: {}, finish_reason: "stop" }] },
      ],
    ];
    let round = 0;
    const known = new Set();
    const results = [];

    const stream = streamProviderToolLoop({
      messages: [{ role: "user", content: "go" }],
      request: { apiKey: "k", model: "m", effort: null },
      tools: [],
      maxRounds: 3,
      requestRound: async () => new Response(
        [...rounds[round++].map((c) => `data: ${JSON.stringify(c)}\n\n`), "data: [DONE]\n\n"].join(""),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      ),
      resolveToolCall(toolCall) {
        if (toolCall.name !== "remember") return null;
        let parsed = null;
        try {
          parsed = JSON.parse(toolCall.arguments || "{}");
        } catch {
          const refusal = "ignored: arguments were not valid JSON";
          results.push(refusal);
          return { result: refusal };
        }
        const read = asMemoryProposal(parsed);
        if (!read.proposal) {
          results.push(read.error);
          return { result: read.error };
        }
        const key = memoryFingerprint(read.proposal.text);
        const duplicate = !!key && known.has(key);
        if (key && !duplicate) known.add(key);
        const result = duplicate ? "ignored: already recorded" : "recorded";
        results.push(result);
        return { result, ...(key && !duplicate ? { events: [toMemoryEvent(read.proposal)] } : {}) };
      },
    });

    const body = await new Response(stream).text();
    const events = body.split("\n\n").filter(Boolean).map((frame) => {
      try {
        return JSON.parse(frame.replace(/^data:\s*/, ""));
      } catch {
        return null;
      }
    }).filter(Boolean);
    return { events, results };
  }

  it("streams a typed memory_delta for a well-formed call", async () => {
    const { events, results } = await runTurn(JSON.stringify({
      kind: "person",
      subject_ids: ["hale"],
      text: "Hale keeps the toll bridge.",
    }));
    expect(results).toEqual(["recorded"]);
    const memory = events.find((event) => event.type === "memory_delta");
    expect(memory.proposal).toMatchObject({ kind: "person", subjectIds: ["hale"] });
    expect(memory.fact).toBe("Hale keeps the toll bridge.");
  });

  it("streams nothing and explains itself for a malformed call", async () => {
    // The refusal reaches the model as its tool result; nothing reaches the client.
    const { events, results } = await runTurn(JSON.stringify({
      kind: "person", subject_ids: ["hale"], text: "A fact.", relevance: 9,
    }));
    expect(results[0]).toContain("unknown field relevance");
    expect(events.some((event) => event.type === "memory_delta")).toBe(false);
  });

  it("does not canonize the retired bare-fact shape", async () => {
    const { events, results } = await runTurn(JSON.stringify({
      fact: "The ferryman owes the player passage.",
    }));
    expect(results[0]).toContain("unknown field fact");
    expect(events.some((event) => event.type === "memory_delta")).toBe(false);
  });

  it("streams nothing when the arguments are not JSON at all", async () => {
    const { events, results } = await runTurn("{not json");
    expect(results).toEqual(["ignored: arguments were not valid JSON"]);
    expect(events.some((event) => event.type === "memory_delta")).toBe(false);
  });
});

describe("the retired bare-fact shape", () => {
  it("is rejected instead of promoted to arbitrary legacy canon", async () => {
    const { asMemoryProposal } = await wire();
    const read = asMemoryProposal({ fact: "The ferryman owes the player passage." });
    expect(read.proposal).toBeUndefined();
    expect(read.error).toContain("unknown field fact");
  });

  it("refuses a bare fact with nothing in it", async () => {
    const { asMemoryProposal } = await wire();
    expect(asMemoryProposal({ fact: "   " }).error).toContain("unknown field fact");
  });

  it("accepts only that exact shape, never a confused mixture", async () => {
    // `fact` beside typed fields is a muddled call, not an old one, and reading it as either
    // would be a guess.
    const { asMemoryProposal } = await wire();
    expect(asMemoryProposal({ fact: "x", kind: "person" }).error).toContain("unknown field fact");
    expect(asMemoryProposal({ ...proposal(), fact: "x" }).error).toContain("unknown field fact");
  });

  it("is offered to nobody: the tool asks only for the typed shape", async () => {
    // Accepted on the way in, never advertised. A fresh client's model is never told `fact`
    // exists, so the reader only ever serves browsers that predate this change.
    const { MEMORY_TOOL } = await wire();
    const params = MEMORY_TOOL.function.parameters;
    expect(Object.keys(params.properties)).not.toContain("fact");
    expect(JSON.stringify(params)).not.toContain("legacy-canonical");
  });
});
