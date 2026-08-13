import { describe, expect, it } from "vitest";
import {
  MAX_PRESENTATION_ATTEMPTS,
  MAX_PRESENTATION_JOBS,
  PRESENTATION_LEASE_MS,
  claimPresentation,
  completePresentation,
  enqueuePresentation,
  isClaimable,
  isPresentationJob,
  nextClaimablePresentation,
  presentationJobId,
  prunePresentations,
  releasePresentation,
  requeueAbandonedPresentations,
} from "./presentation-outbox.js";

const T0 = 1_000_000;

function queueWithJob(overrides = {}) {
  const result = enqueuePresentation([], {
    kind: "combat-aftermath",
    route: "combat-aftermath",
    sourceReceiptId: "settle-1",
    stateRevision: 7,
    payload: { report: "..." },
    ...overrides,
  });
  return result;
}

describe("recording the debt", () => {
  it("writes a well-formed job", () => {
    const { ok, job } = queueWithJob();
    expect(ok).toBe(true);
    expect(isPresentationJob(job)).toBe(true);
    expect(job.status).toBe("pending");
    expect(job.attempts).toBe(0);
    expect(job.leaseOwner).toBe(null);
  });

  it("gives the same debt the same identity", () => {
    const first = queueWithJob();
    const second = enqueuePresentation(first.queue, {
      kind: "combat-aftermath",
      route: "combat-aftermath",
      sourceReceiptId: "settle-1",
      stateRevision: 7,
      payload: { report: "different prose, same debt" },
    });
    // A retried settlement must not queue a second scene for the same fight.
    expect(second.duplicate).toBe(true);
    expect(second.queue).toHaveLength(1);
    expect(second.job.id).toBe(first.job.id);
  });

  it("separates the same receipt at a different revision", () => {
    expect(presentationJobId({ kind: "combat-aftermath", sourceReceiptId: "s", stateRevision: 1 }))
      .not.toBe(presentationJobId({ kind: "combat-aftermath", sourceReceiptId: "s", stateRevision: 2 }));
  });

  it("refuses a debt it cannot describe", () => {
    expect(queueWithJob({ kind: "nonsense" }).reason).toBe("invalid-presentation-kind");
    expect(queueWithJob({ sourceReceiptId: "" }).reason).toBe("invalid-presentation-source");
    expect(queueWithJob({ stateRevision: -1 }).reason).toBe("invalid-presentation-revision");
    expect(queueWithJob({ payload: { bad: Number.POSITIVE_INFINITY } }).reason)
      .toBe("invalid-presentation-payload");
  });

  it("keeps the queue bounded", () => {
    let queue = [];
    for (let index = 0; index < MAX_PRESENTATION_JOBS; index += 1) {
      queue = enqueuePresentation(queue, {
        kind: "combat-aftermath",
        route: "combat-aftermath",
        sourceReceiptId: `settle-${index}`,
        stateRevision: index,
        payload: null,
      }).queue;
    }
    expect(enqueuePresentation(queue, {
      kind: "combat-aftermath", route: "combat-aftermath",
      sourceReceiptId: "one-too-many", stateRevision: 999, payload: null,
    }).reason).toBe("presentation-queue-full");
  });
});

describe("claiming before calling", () => {
  it("takes a pending job and issues an attempt", () => {
    const { queue, job } = queueWithJob();
    const claimed = claimPresentation(queue, job.id, { owner: "tab-a", now: T0 });
    expect(claimed.ok).toBe(true);
    expect(claimed.job.status).toBe("in-flight");
    expect(claimed.job.attempts).toBe(1);
    expect(claimed.job.leaseOwner).toBe("tab-a");
    expect(claimed.job.leaseExpiresAt).toBe(T0 + PRESENTATION_LEASE_MS);
    expect(claimed.job.attemptId).toMatch(/^attempt-[0-9a-f]{16}$/);
  });

  it("refuses a second worker while the lease is live", () => {
    // Two tabs reading the same queue must not both call the provider.
    const { queue, job } = queueWithJob();
    const first = claimPresentation(queue, job.id, { owner: "tab-a", now: T0 });
    const second = claimPresentation(first.queue, job.id, { owner: "tab-b", now: T0 + 1 });
    expect(second).toMatchObject({ ok: false, reason: "presentation-lease-held" });
    expect(second.queue).toEqual(first.queue);
  });

  it("lets another worker take it the instant the lease expires", () => {
    const { queue, job } = queueWithJob();
    const first = claimPresentation(queue, job.id, { owner: "tab-a", now: T0 });
    const atExpiry = T0 + PRESENTATION_LEASE_MS;
    expect(claimPresentation(first.queue, job.id, { owner: "tab-b", now: atExpiry - 1 }).ok)
      .toBe(false);
    const taken = claimPresentation(first.queue, job.id, { owner: "tab-b", now: atExpiry });
    expect(taken.ok).toBe(true);
    expect(taken.job.attempts).toBe(2);
    // A fresh attempt id, so the first worker's answer can no longer be applied.
    expect(taken.job.attemptId).not.toBe(first.job.attemptId);
  });

  it("gives up rather than looping on a provider that will not answer", () => {
    let { queue, job } = queueWithJob();
    for (let attempt = 0; attempt < MAX_PRESENTATION_ATTEMPTS; attempt += 1) {
      const claimed = claimPresentation(queue, job.id, { owner: "tab-a", now: T0 });
      expect(claimed.ok, `attempt ${attempt}`).toBe(true);
      queue = releasePresentation(claimed.queue, {
        jobId: job.id, attemptId: claimed.job.attemptId, errorCode: "provider-unavailable",
      }).queue;
    }
    expect(queue[0].status).toBe("failed");
    expect(queue[0].lastErrorCode).toBe("provider-unavailable");
    expect(claimPresentation(queue, job.id, { owner: "tab-a", now: T0 }))
      .toMatchObject({ ok: false, reason: "presentation-attempts-exhausted" });
  });

  it("finds the oldest job worth working on", () => {
    let queue = queueWithJob().queue;
    queue = enqueuePresentation(queue, {
      kind: "character-arrival", route: "character-arrival",
      sourceReceiptId: "arrive-1", stateRevision: 1, payload: null,
    }).queue;
    expect(nextClaimablePresentation(queue, T0).sourceReceiptId).toBe("settle-1");
    const claimed = claimPresentation(queue, queue[0].id, { owner: "a", now: T0 });
    // The first is now held, so the worker moves on rather than blocking.
    expect(nextClaimablePresentation(claimed.queue, T0).sourceReceiptId).toBe("arrive-1");
  });
});

describe("applying the answer", () => {
  it("accepts a response naming the exact attempt", () => {
    const { queue, job } = queueWithJob();
    const claimed = claimPresentation(queue, job.id, { owner: "tab-a", now: T0 });
    const done = completePresentation(claimed.queue, {
      jobId: job.id, attemptId: claimed.job.attemptId, stateRevision: 7,
    });
    expect(done.ok).toBe(true);
    expect(done.job.status).toBe("presented");
    expect(done.job.leaseOwner).toBe(null);
  });

  it("refuses a response from an attempt that has been superseded", () => {
    // The late answer: a first worker's call returns after its lease expired and someone
    // else took the job. Applying it would show prose for a call nobody is waiting on.
    const { queue, job } = queueWithJob();
    const first = claimPresentation(queue, job.id, { owner: "tab-a", now: T0 });
    const second = claimPresentation(first.queue, job.id, {
      owner: "tab-b", now: T0 + PRESENTATION_LEASE_MS,
    });
    expect(completePresentation(second.queue, {
      jobId: job.id, attemptId: first.job.attemptId, stateRevision: 7,
    })).toMatchObject({ ok: false, reason: "presentation-attempt-mismatch" });
  });

  it("refuses a response issued against a state that has moved", () => {
    const { queue, job } = queueWithJob();
    const claimed = claimPresentation(queue, job.id, { owner: "tab-a", now: T0 });
    expect(completePresentation(claimed.queue, {
      jobId: job.id, attemptId: claimed.job.attemptId, stateRevision: 9,
    })).toMatchObject({ ok: false, reason: "presentation-state-moved" });
  });

  it("absorbs a duplicate response rather than presenting twice", () => {
    const { queue, job } = queueWithJob();
    const claimed = claimPresentation(queue, job.id, { owner: "tab-a", now: T0 });
    const done = completePresentation(claimed.queue, {
      jobId: job.id, attemptId: claimed.job.attemptId, stateRevision: 7,
    });
    const again = completePresentation(done.queue, {
      jobId: job.id, attemptId: claimed.job.attemptId, stateRevision: 7,
    });
    expect(again).toMatchObject({ ok: true, duplicate: true });
    expect(again.queue).toEqual(done.queue);
  });

  it("cannot be claimed again once presented", () => {
    const { queue, job } = queueWithJob();
    const claimed = claimPresentation(queue, job.id, { owner: "tab-a", now: T0 });
    const done = completePresentation(claimed.queue, {
      jobId: job.id, attemptId: claimed.job.attemptId, stateRevision: 7,
    });
    expect(claimPresentation(done.queue, job.id, { owner: "tab-b", now: T0 + 1 }))
      .toMatchObject({ ok: false, reason: "presentation-already-presented" });
    expect(isClaimable(done.job, T0 + 1)).toBe(false);
  });
});

describe("what a reload does to it", () => {
  it("picks up work abandoned by a process that is gone", () => {
    // The crash case: settled, claimed, then the tab died mid-call. Without this the fight
    // settles and then says nothing, forever.
    const { queue, job } = queueWithJob();
    const claimed = claimPresentation(queue, job.id, { owner: "dead-tab", now: T0 });
    const resumed = requeueAbandonedPresentations(claimed.queue, T0 + PRESENTATION_LEASE_MS);
    expect(resumed[0].status).toBe("pending");
    expect(resumed[0].leaseOwner).toBe(null);
    expect(resumed[0].lastErrorCode).toBe("presentation-lease-expired");
    // The attempt count is kept, so a job that keeps crashing still gives up eventually.
    expect(resumed[0].attempts).toBe(1);
  });

  it("leaves a live lease belonging to someone else alone", () => {
    const { queue, job } = queueWithJob();
    const claimed = claimPresentation(queue, job.id, { owner: "other-tab", now: T0 });
    expect(requeueAbandonedPresentations(claimed.queue, T0 + 1)).toEqual(claimed.queue);
  });

  it("leaves presented and failed work alone", () => {
    const { queue, job } = queueWithJob();
    const claimed = claimPresentation(queue, job.id, { owner: "a", now: T0 });
    const done = completePresentation(claimed.queue, {
      jobId: job.id, attemptId: claimed.job.attemptId, stateRevision: 7,
    });
    expect(requeueAbandonedPresentations(done.queue, T0 + 10 ** 9)).toEqual(done.queue);
  });

  it("resumes exactly once after a crash", () => {
    const { queue, job } = queueWithJob();
    const claimed = claimPresentation(queue, job.id, { owner: "dead-tab", now: T0 });
    const afterReload = requeueAbandonedPresentations(claimed.queue, T0 + PRESENTATION_LEASE_MS);
    const retaken = claimPresentation(afterReload, job.id, {
      owner: "new-tab", now: T0 + PRESENTATION_LEASE_MS,
    });
    const done = completePresentation(retaken.queue, {
      jobId: job.id, attemptId: retaken.job.attemptId, stateRevision: 7,
    });
    expect(done.ok).toBe(true);
    // And the dead tab's answer, if it ever arrives, still cannot apply.
    expect(completePresentation(done.queue, {
      jobId: job.id, attemptId: claimed.job.attemptId, stateRevision: 7,
    })).toMatchObject({ duplicate: true });
  });
});

describe("keeping the queue small", () => {
  it("drops presented work and keeps failures by default", () => {
    const { queue, job } = queueWithJob();
    const claimed = claimPresentation(queue, job.id, { owner: "a", now: T0 });
    const done = completePresentation(claimed.queue, {
      jobId: job.id, attemptId: claimed.job.attemptId, stateRevision: 7,
    });
    expect(prunePresentations(done.queue)).toEqual([]);
  });

  it("can be told to drop failures too", () => {
    let { queue, job } = queueWithJob();
    for (let attempt = 0; attempt < MAX_PRESENTATION_ATTEMPTS; attempt += 1) {
      const claimed = claimPresentation(queue, job.id, { owner: "a", now: T0 });
      queue = releasePresentation(claimed.queue, {
        jobId: job.id, attemptId: claimed.job.attemptId,
      }).queue;
    }
    expect(prunePresentations(queue)).toHaveLength(1);
    expect(prunePresentations(queue, { keepFailed: false })).toEqual([]);
  });
});
