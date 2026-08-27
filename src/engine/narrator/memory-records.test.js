import { describe, expect, it } from "vitest";
import {
  DEFAULT_MEMORY_POLICY,
  MEMORY_KINDS,
  NARRATOR_MEMORY_VERSION,
  NO_MEMORY_POLICY,
  acceptMemoryProposals,
  deriveSalience,
  foldMemory,
  memoryKey,
  migrateLegacyMemories,
  mintMemory,
  retrieveMemories,
  validateMemoryProposal,
} from "./memory-records.js";

function proposal(overrides = {}) {
  return {
    kind: "person",
    subjectIds: ["hale"],
    scopeIds: ["campaign"],
    text: "Hale keeps the toll bridge and remembers a slight.",
    evidenceRefs: [{ kind: "turn", id: "turn-42" }],
    ...overrides,
  };
}

function accepted(overrides = {}) {
  return validateMemoryProposal(proposal(overrides)).proposal;
}

describe("what the model may propose", () => {
  it("accepts a well-formed proposal", () => {
    const checked = validateMemoryProposal(proposal());
    expect(checked.ok).toBe(true);
    expect(checked.proposal.subjectIds).toEqual(["hale"]);
  });

  it("refuses a memory about nobody", () => {
    // A string about no one cannot be retrieved by relevance, which is the whole problem
    // the typed bank exists to fix.
    expect(validateMemoryProposal(proposal({ subjectIds: [] })).reason).toBe("memory-about-nobody");
  });

  it("refuses a memory about someone the world has never heard of", () => {
    const checked = validateMemoryProposal(proposal({ subjectIds: ["invented"] }), DEFAULT_MEMORY_POLICY, {
      knownSubjectIds: ["hale"],
    });
    expect(checked).toMatchObject({ ok: false, reason: "memory-about-a-stranger" });
  });

  it("refuses a promise nobody can point at", () => {
    // A promise with no evidence is a promise the narrator invented this turn.
    expect(validateMemoryProposal(proposal({ kind: "promise", evidenceRefs: [] })).reason)
      .toBe("memory-without-evidence");
  });

  it("refuses a canonical event with no receipt behind it", () => {
    // An event is the only kind that reads as something that happened, so it is the only
    // kind that has to be anchored to something the engine issued.
    expect(validateMemoryProposal(proposal({ kind: "event" })).reason)
      .toBe("canonical-event-without-receipt");
    expect(validateMemoryProposal(proposal({
      kind: "event",
      evidenceRefs: [{ kind: "receipt", id: "combat-1" }],
    })).ok).toBe(true);
  });

  it("binds receipt evidence to ids the engine accepted when that ledger is available", () => {
    const forged = validateMemoryProposal(proposal({
      kind: "event",
      evidenceRefs: [{ kind: "receipt", id: "intent-forged" }],
    }), DEFAULT_MEMORY_POLICY, { acceptedReceiptIds: ["intent-accepted"] });
    expect(forged).toMatchObject({ ok: false, reason: "memory-receipt-not-accepted" });

    const bound = validateMemoryProposal(proposal({
      kind: "event",
      evidenceRefs: [{ kind: "receipt", id: "intent-accepted" }],
    }), DEFAULT_MEMORY_POLICY, { acceptedReceiptIds: ["intent-accepted"] });
    expect(bound.ok).toBe(true);
  });

  it("lets a belief stand as a perspective without a receipt", () => {
    // A belief is explicitly one character's view, so it does not need to be true.
    expect(validateMemoryProposal(proposal({ kind: "belief", evidenceRefs: [] })).ok).toBe(true);
  });

  it("refuses empty or oversized text", () => {
    expect(validateMemoryProposal(proposal({ text: "   " })).reason).toBe("empty-memory-text");
    expect(validateMemoryProposal(proposal({ text: "x".repeat(5_000) })).reason)
      .toBe("memory-text-too-long");
  });

  it("refuses a kind nobody defined", () => {
    expect(validateMemoryProposal(proposal({ kind: "prophecy" })).reason).toBe("unknown-memory-kind");
    expect(MEMORY_KINDS).toContain("grudge");
  });
});

describe("route policy", () => {
  it("writes nothing on a route with no policy", () => {
    // Silence is the safe default for a side channel.
    expect(validateMemoryProposal(proposal(), NO_MEMORY_POLICY).reason)
      .toBe("kind-not-allowed-on-route");
  });

  it("keeps a negotiation from filing memories about someone else", () => {
    const policy = { ...DEFAULT_MEMORY_POLICY, allowedSubjectIds: ["hale"] };
    expect(validateMemoryProposal(proposal({ subjectIds: ["hale"] }), policy).ok).toBe(true);
    expect(validateMemoryProposal(proposal({ subjectIds: ["marsh"] }), policy))
      .toMatchObject({ ok: false, reason: "subject-not-allowed-on-route" });
  });

  it("refuses evidence of a kind the route cannot cite", () => {
    const policy = { ...DEFAULT_MEMORY_POLICY, allowedEvidenceKinds: ["receipt"] };
    expect(validateMemoryProposal(proposal(), policy))
      .toMatchObject({ ok: false, reason: "evidence-kind-not-allowed" });
  });

  it("caps how many one turn may write", () => {
    const many = Array.from({ length: 10 }, (_, i) => proposal({ subjectIds: [`npc-${i}`] }));
    const result = acceptMemoryProposals([], many, { revision: 1 });
    expect(result.accepted).toHaveLength(DEFAULT_MEMORY_POLICY.maxWrites);
    // Reported, not silently kept — the caller can see what it lost.
    expect(result.refused.every((entry) => entry.reason === "memory-write-limit")).toBe(true);
  });
});

describe("what only the engine decides", () => {
  it("mints the id, salience, status and pinning itself", () => {
    const record = mintMemory(accepted(), { revision: 7, sourceReceiptId: "r1" });
    expect(record.version).toBe(NARRATOR_MEMORY_VERSION);
    expect(record.status).toBe("active");
    expect(record.pinned).toBe(false);
    expect(record.createdStateRevision).toBe(7);
    expect(record.sourceReceiptId).toBe("r1");
    expect(record.salience).toBeGreaterThan(0);
  });

  it("ignores anything the proposal tried to say about those", () => {
    // A model that can set its own salience can make anything the most important thing it
    // knows; one that can set `pinned` can make it permanent.
    const smuggled = validateMemoryProposal({
      ...proposal(), salience: 100, pinned: true, status: "resolved", id: "chosen-by-the-model",
    });
    const record = mintMemory(smuggled.proposal, { revision: 1 });
    expect(record.id).not.toBe("chosen-by-the-model");
    expect(record.pinned).toBe(false);
    expect(record.status).toBe("active");
    expect(record.salience).toBe(deriveSalience(smuggled.proposal));
  });

  it("weighs anchored evidence above assertion, and a perspective below a fact", () => {
    const anchored = deriveSalience(validateMemoryProposal(proposal({
      kind: "event", evidenceRefs: [{ kind: "receipt", id: "combat-1" }],
    })).proposal);
    const asserted = deriveSalience(accepted());
    const perspective = deriveSalience(validateMemoryProposal(proposal({
      kind: "grudge", evidenceRefs: [],
    })).proposal);
    expect(anchored).toBeGreaterThan(asserted);
    expect(asserted).toBeGreaterThan(perspective);
  });
});

describe("the bank does not just grow", () => {
  it("supersedes a matching memory instead of appending a rephrasing", () => {
    // Nine near-identical sentences about the same grudge is what a flat list produces.
    const first = mintMemory(accepted(), { revision: 1 });
    const restated = mintMemory(
      validateMemoryProposal(proposal({ text: "Hale still has not forgiven it." })).proposal,
      { revision: 5 },
    );
    const folded = foldMemory([first], restated);
    expect(folded.bank).toHaveLength(1);
    expect(folded.superseded).toBe(first.id);
    expect(folded.bank[0].summary).toBe("Hale still has not forgiven it.");
  });

  it("keeps when a thing was first known, not when it was last mentioned", () => {
    const first = mintMemory(accepted(), { revision: 1 });
    const restated = mintMemory(accepted(), { revision: 9 });
    expect(foldMemory([first], restated).bank[0].createdStateRevision).toBe(1);
  });

  it("keeps a memory pinned when the narrator restates it", () => {
    const pinned = { ...mintMemory(accepted(), { revision: 1 }), pinned: true };
    expect(foldMemory([pinned], mintMemory(accepted(), { revision: 5 })).bank[0].pinned).toBe(true);
  });

  it("reinforces rather than downgrades when evidence improves", () => {
    const weak = mintMemory(validateMemoryProposal(proposal({ kind: "belief", evidenceRefs: [] })).proposal, { revision: 1 });
    const strong = mintMemory(validateMemoryProposal(proposal({
      kind: "belief", evidenceRefs: [{ kind: "receipt", id: "r1" }],
    })).proposal, { revision: 2 });
    expect(foldMemory([weak], strong).bank[0].salience)
      .toBeGreaterThanOrEqual(weak.salience);
  });

  it("treats a different kind about the same person as a different memory", () => {
    const person = mintMemory(accepted(), { revision: 1 });
    const grudge = mintMemory(
      validateMemoryProposal(proposal({ kind: "grudge", evidenceRefs: [] })).proposal,
      { revision: 1 },
    );
    expect(memoryKey(person)).not.toBe(memoryKey(grudge));
    expect(foldMemory([person], grudge).bank).toHaveLength(2);
  });
});

describe("old memories coming in", () => {
  it("becomes an event without pretending its provenance is stronger than it was", () => {
    // They were trusted before there was a way to check, and that is different from having
    // been checked.
    const migrated = migrateLegacyMemories(["The player burned the bridge.", "  "], { revision: 3 });
    expect(migrated).toHaveLength(1);
    expect(migrated[0].kind).toBe("event");
    expect(migrated[0].evidence[0].kind).toBe("legacy-canonical");
    expect(migrated[0].scopeIds).toEqual(["campaign"]);
  });
});

describe("retrieval", () => {
  function bank() {
    return acceptMemoryProposals([], [
      proposal({ subjectIds: ["hale"], text: "Hale keeps the bridge." }),
      proposal({ subjectIds: ["marsh"], text: "Marsh sells rope." }),
      proposal({ subjectIds: ["distant"], text: "Someone far away." }),
    ], { revision: 10 }).bank;
  }

  it("puts who the turn is about first", () => {
    const found = retrieveMemories(bank(), { subjectIds: ["marsh"], revision: 10 });
    expect(found[0].subjectIds).toEqual(["marsh"]);
  });

  it("keeps a pinned memory near the top even when it is not the subject", () => {
    const pinned = bank().map((entry, index) => (index === 2 ? { ...entry, pinned: true } : entry));
    expect(retrieveMemories(pinned, { subjectIds: [], revision: 10 })[0].pinned).toBe(true);
  });

  it("leaves resolved and superseded memories out of the prompt", () => {
    // They are kept for history, not for prompting.
    const withDead = bank().map((entry, index) => (
      index === 0 ? { ...entry, status: "resolved" } : entry
    ));
    expect(retrieveMemories(withDead, { subjectIds: ["hale"], revision: 10 })).toHaveLength(2);
  });

  it("is deterministic and bounded", () => {
    const source = bank();
    expect(retrieveMemories(source, { subjectIds: ["hale"], limit: 2 }))
      .toEqual(retrieveMemories(source, { subjectIds: ["hale"], limit: 2 }));
    expect(retrieveMemories(source, { limit: 2 })).toHaveLength(2);
  });
});

describe("accepting a whole turn", () => {
  it("writes the good ones and reports the rest", () => {
    const result = acceptMemoryProposals([], [
      proposal(),
      proposal({ kind: "promise", evidenceRefs: [] }),
      proposal({ subjectIds: [] }),
    ], { revision: 4 });
    expect(result.accepted).toHaveLength(1);
    expect(result.refused.map((entry) => entry.reason))
      .toEqual(["memory-without-evidence", "memory-about-nobody"]);
  });

  it("writes nothing at all on a route that may not remember", () => {
    const result = acceptMemoryProposals([], [proposal()], { policy: NO_MEMORY_POLICY });
    expect(result.bank).toEqual([]);
    expect(result.accepted).toEqual([]);
  });

  it("leaves the original bank untouched", () => {
    const before = acceptMemoryProposals([], [proposal()], { revision: 1 }).bank;
    const snapshot = JSON.stringify(before);
    acceptMemoryProposals(before, [proposal({ subjectIds: ["marsh"] })], { revision: 2 });
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});
