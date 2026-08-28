// Prose that is owed, written down before anyone tries to write it.
//
// A settlement and the scene describing it happen at different times and with different
// reliability. The settlement is local, instant and certain; the scene is a network call to
// a model that can be slow, can fail, and can come back after the player has already moved
// on. Treating them as one step means every way the second can fail becomes a way the first
// can be lost.
//
// So the debt is recorded. Settlement enqueues a job in the same state commit that writes
// its receipt, and a worker claims that job before calling anything. Four consequences,
// each of which is a bug that would otherwise be found in production:
//
//   A crash mid-call leaves a claimed job with an expired lease, which the next load picks
//   up — rather than a fight that settled and then said nothing forever.
//
//   A second tab cannot start the same call, because claiming is a compare-and-set against
//   a lease that has not expired.
//
//   A response that arrives after the state has moved on cannot apply, because completing
//   names the exact attempt it belongs to and the revision it was issued against.
//
//   A response that arrives twice applies once.
//
// Time is passed in rather than read. A lease is a deadline, and a module that reads the
// clock itself cannot be tested against the edges that matter — the moment before expiry
// and the moment after.

import { cloneJsonData } from "../kernel/json-data.js";
import { gameplayChecksum } from "../kernel/replay.js";

export const PRESENTATION_JOB_VERSION = 1;

/** How long a claim holds before another worker may take the job. */
export const PRESENTATION_LEASE_MS = 90_000;

/** Give up after this many attempts rather than looping on a provider that will not answer. */
export const MAX_PRESENTATION_ATTEMPTS = 5;

/** Keep the queue bounded; a runaway producer must not grow a save without limit. */
export const MAX_PRESENTATION_JOBS = 64;

export const PRESENTATION_KINDS = Object.freeze(["character-arrival", "combat-aftermath"]);
export const PRESENTATION_ROUTE_BY_KIND = Object.freeze({
  "character-arrival": "character-arrival",
  "combat-aftermath": "combat-aftermath",
});
export const PRESENTATION_STATUSES = Object.freeze([
  "pending",
  "in-flight",
  "presented",
  "failed",
]);

const JOB_KEYS = Object.freeze([
  "attemptId",
  "attempts",
  "id",
  "kind",
  "lastErrorCode",
  "leaseExpiresAt",
  "leaseOwner",
  "payload",
  "route",
  "sourceReceiptId",
  "stateRevision",
  "status",
  "version",
].sort());

function exactKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const own = Object.keys(value).sort();
  return own.length === keys.length && own.every((key, index) => key === keys[index]);
}

function identifier(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 256;
}

export function isPresentationJob(value) {
  if (!exactKeys(value, JOB_KEYS)) return false;
  return value.version === PRESENTATION_JOB_VERSION
    && identifier(value.id)
    && PRESENTATION_KINDS.includes(value.kind)
    && value.route === PRESENTATION_ROUTE_BY_KIND[value.kind]
    && identifier(value.sourceReceiptId)
    && Number.isSafeInteger(value.stateRevision)
    && value.stateRevision >= 0
    && Number.isSafeInteger(value.attempts)
    && value.attempts >= 0
    && (value.attemptId === null || identifier(value.attemptId))
    && (value.leaseOwner === null || identifier(value.leaseOwner))
    && (value.leaseExpiresAt === null || Number.isSafeInteger(value.leaseExpiresAt))
    && (value.lastErrorCode === null || identifier(value.lastErrorCode))
    && PRESENTATION_STATUSES.includes(value.status)
    && value.payload !== undefined;
}

/**
 * The identity of one job.
 *
 * Derived from the receipt it is owed for and the revision it was owed at, so enqueuing the
 * same debt twice produces the same id and the queue can refuse the duplicate rather than
 * narrating one fight twice.
 */
export function presentationJobId({ kind, sourceReceiptId, stateRevision }) {
  return `presentation-${gameplayChecksum({ kind, sourceReceiptId, stateRevision })}`;
}

/**
 * Record a debt.
 *
 * Called in the same state commit as the receipt it belongs to — that is the whole point,
 * and why this returns a new queue rather than performing any I/O of its own.
 */
export function enqueuePresentation(queue, { kind, route, sourceReceiptId, stateRevision, payload }) {
  const jobs = Array.isArray(queue) ? queue : [];
  if (!PRESENTATION_KINDS.includes(kind)) {
    return { ok: false, reason: "invalid-presentation-kind", queue: jobs, job: null };
  }
  if (route !== PRESENTATION_ROUTE_BY_KIND[kind]) {
    return { ok: false, reason: "invalid-presentation-route", queue: jobs, job: null };
  }
  if (!identifier(sourceReceiptId)) {
    return { ok: false, reason: "invalid-presentation-source", queue: jobs, job: null };
  }
  if (!Number.isSafeInteger(stateRevision) || stateRevision < 0) {
    return { ok: false, reason: "invalid-presentation-revision", queue: jobs, job: null };
  }

  const id = presentationJobId({ kind, sourceReceiptId, stateRevision });
  const existing = jobs.find((job) => job.id === id);
  // The same debt recorded twice is the same debt. Returning the original rather than a
  // second copy is what stops a retried settlement queueing a second scene.
  if (existing) return { ok: true, reason: null, queue: jobs, job: existing, duplicate: true };

  if (jobs.length >= MAX_PRESENTATION_JOBS) {
    return { ok: false, reason: "presentation-queue-full", queue: jobs, job: null };
  }

  let job;
  try {
    job = cloneJsonData({
      version: PRESENTATION_JOB_VERSION,
      id,
      kind,
      route,
      sourceReceiptId,
      stateRevision,
      attempts: 0,
      attemptId: null,
      leaseOwner: null,
      leaseExpiresAt: null,
      lastErrorCode: null,
      status: "pending",
      payload: payload ?? null,
    }, "invalid-presentation-payload");
  } catch {
    return { ok: false, reason: "invalid-presentation-payload", queue: jobs, job: null };
  }
  if (!isPresentationJob(job)) {
    return { ok: false, reason: "invalid-presentation-job", queue: jobs, job: null };
  }
  return { ok: true, reason: null, queue: [...jobs, job], job, duplicate: false };
}

function leaseExpired(job, now) {
  return job.leaseExpiresAt === null || job.leaseExpiresAt <= now;
}

/**
 * Whether this job is available to be worked on right now.
 *
 * A pending job always is. An in-flight job is only available once its lease has expired,
 * which is what turns a crash into a retry and what stops a second tab racing a live call.
 */
export function isClaimable(job, now) {
  if (job.status === "presented" || job.status === "failed") return false;
  if (job.attempts >= MAX_PRESENTATION_ATTEMPTS) return false;
  if (job.status === "pending") return true;
  return job.status === "in-flight" && leaseExpired(job, now);
}

/** The next job worth working on, oldest first so a backlog drains in order. */
export function nextClaimablePresentation(queue, now) {
  return (queue || []).find((job) => isClaimable(job, now)) || null;
}

/**
 * Take a job, atomically.
 *
 * Compare-and-set against the lease: a worker can only claim what is claimable at the
 * instant it asks, so two workers reading the same queue cannot both proceed. The returned
 * attempt id is what the eventual response must name to be accepted.
 */
export function claimPresentation(queue, jobId, { owner, now, leaseMs = PRESENTATION_LEASE_MS }) {
  const jobs = Array.isArray(queue) ? queue : [];
  const index = jobs.findIndex((job) => job.id === jobId);
  if (index < 0) return { ok: false, reason: "unknown-presentation-job", queue: jobs, job: null };
  if (!identifier(owner)) return { ok: false, reason: "invalid-lease-owner", queue: jobs, job: null };
  if (!Number.isSafeInteger(now)) return { ok: false, reason: "invalid-clock", queue: jobs, job: null };

  const job = jobs[index];
  if (job.status === "presented") {
    return { ok: false, reason: "presentation-already-presented", queue: jobs, job };
  }
  if (job.attempts >= MAX_PRESENTATION_ATTEMPTS) {
    return { ok: false, reason: "presentation-attempts-exhausted", queue: jobs, job };
  }
  if (job.status === "in-flight" && !leaseExpired(job, now)) {
    // Someone else holds it and is presumably still working. Taking it here is how a
    // response gets applied twice.
    return { ok: false, reason: "presentation-lease-held", queue: jobs, job };
  }

  const attempts = job.attempts + 1;
  const claimed = {
    ...job,
    status: "in-flight",
    attempts,
    // The previous attempt is a durable generation seed for explicit retries. Including it
    // prevents a retry from recreating the exhausted attempt id even when owner, count, and
    // claim time are identical.
    attemptId: `attempt-${gameplayChecksum({
      id: job.id,
      owner,
      attempts,
      claimedAt: now,
      previousAttemptId: job.attemptId,
    })}`,
    leaseOwner: owner,
    leaseExpiresAt: now + leaseMs,
    lastErrorCode: null,
  };
  return {
    ok: true,
    reason: null,
    queue: jobs.map((entry, at) => (at === index ? claimed : entry)),
    job: claimed,
  };
}

/**
 * Apply a response to the exact attempt that asked for it.
 *
 * Every part of the key is load-bearing. The job id says which debt, the attempt id says
 * which call, and the state revision says the world has not moved underneath the answer.
 * A response failing any of them is late, duplicated, or for a state that no longer exists,
 * and applying it would put prose in front of a player describing something else.
 */
export function completePresentation(queue, { jobId, attemptId, stateRevision }) {
  const jobs = Array.isArray(queue) ? queue : [];
  const index = jobs.findIndex((job) => job.id === jobId);
  if (index < 0) return { ok: false, reason: "unknown-presentation-job", queue: jobs, job: null };

  const job = jobs[index];
  if (job.status === "presented") {
    // Already done. A duplicate response is absorbed rather than refused, because the
    // caller's intent — this scene is presented — is already satisfied.
    return { ok: true, reason: null, queue: jobs, job, duplicate: true };
  }
  if (job.status !== "in-flight") {
    return { ok: false, reason: "presentation-not-in-flight", queue: jobs, job };
  }
  if (job.attemptId !== attemptId) {
    return { ok: false, reason: "presentation-attempt-mismatch", queue: jobs, job };
  }
  if (!Number.isSafeInteger(stateRevision) || stateRevision !== job.stateRevision) {
    return { ok: false, reason: "presentation-state-moved", queue: jobs, job };
  }

  const presented = {
    ...job,
    status: "presented",
    leaseOwner: null,
    leaseExpiresAt: null,
    lastErrorCode: null,
  };
  return {
    ok: true,
    reason: null,
    queue: jobs.map((entry, at) => (at === index ? presented : entry)),
    job: presented,
    duplicate: false,
  };
}

/**
 * Hand a job back after a failed attempt.
 *
 * Back to pending while attempts remain, and failed once they do not — at which point the
 * campaign still owns the settlement and the player still has the factual record. A
 * presentation that never arrives costs prose; it must never cost the outcome.
 */
export function releasePresentation(queue, { jobId, attemptId, errorCode = "presentation-failed" }) {
  const jobs = Array.isArray(queue) ? queue : [];
  const index = jobs.findIndex((job) => job.id === jobId);
  if (index < 0) return { ok: false, reason: "unknown-presentation-job", queue: jobs, job: null };

  const job = jobs[index];
  if (job.status === "presented") return { ok: true, reason: null, queue: jobs, job, duplicate: true };
  if (job.status !== "in-flight") {
    return { ok: false, reason: "presentation-not-in-flight", queue: jobs, job };
  }
  if (attemptId !== undefined && job.attemptId !== attemptId) {
    return { ok: false, reason: "presentation-attempt-mismatch", queue: jobs, job };
  }

  const exhausted = job.attempts >= MAX_PRESENTATION_ATTEMPTS;
  const released = {
    ...job,
    status: exhausted ? "failed" : "pending",
    attemptId: exhausted ? job.attemptId : null,
    leaseOwner: null,
    leaseExpiresAt: null,
    lastErrorCode: identifier(errorCode) ? errorCode : "presentation-failed",
  };
  return {
    ok: true,
    reason: null,
    queue: jobs.map((entry, at) => (at === index ? released : entry)),
    job: released,
  };
}

/** Give an exhausted job one explicit, user-requested attempt without reopening a loop. */
export function retryFailedPresentation(queue, jobId) {
  const jobs = Array.isArray(queue) ? queue : [];
  const index = jobs.findIndex((job) => job.id === jobId);
  if (index < 0) return { ok: false, reason: "unknown-presentation-job", queue: jobs, job: null };
  const job = jobs[index];
  if (job.status !== "failed") {
    return { ok: false, reason: "presentation-not-failed", queue: jobs, job };
  }
  const retried = {
    ...job,
    status: "pending",
    attempts: MAX_PRESENTATION_ATTEMPTS - 1,
    // Keep the exhausted attempt id as the next claim's durable generation seed. Older saved
    // failed jobs did not retain one, so derive a retry-only seed that cannot be an attempt id.
    // Completion and release both require in-flight status, so stale responses cannot consume
    // the seed while the retried job is pending.
    attemptId: job.attemptId || `retry-seed-${gameplayChecksum({
      id: job.id,
      attempts: job.attempts,
      lastErrorCode: job.lastErrorCode,
    })}`,
    leaseOwner: null,
    leaseExpiresAt: null,
    lastErrorCode: null,
  };
  return {
    ok: true,
    reason: null,
    queue: jobs.map((entry, at) => (at === index ? retried : entry)),
    job: retried,
  };
}

/**
 * What a reload should do to a queue it just read.
 *
 * An in-flight job whose lease has expired belonged to a process that is gone; it goes back
 * to pending so it can be picked up. One whose lease is still live belongs to someone else
 * and is left exactly as it is.
 */
export function requeueAbandonedPresentations(queue, now) {
  const jobs = Array.isArray(queue) ? queue : [];
  return jobs.map((job) => {
    if (job.status !== "in-flight" || !leaseExpired(job, now)) return job;
    return {
      ...job,
      status: "pending",
      attemptId: null,
      leaseOwner: null,
      leaseExpiresAt: null,
      lastErrorCode: job.lastErrorCode ?? "presentation-lease-expired",
    };
  });
}

/** Drop finished work so a long campaign's queue does not grow forever. */
export function prunePresentations(queue, { keepFailed = true } = {}) {
  return (queue || []).filter((job) => (
    job.status !== "presented" && (keepFailed || job.status !== "failed")
  ));
}
