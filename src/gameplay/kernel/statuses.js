const CONTROL_STATUSES = new Set(["sleep", "paralysis", "stun"]);

export function hasStatus(actor, type) {
  return (actor.statuses || []).some((status) => status.type === type);
}

export function applyStatus(actor, status) {
  if (!status?.type) throw new TypeError("invalid-status");
  if (CONTROL_STATUSES.has(status.type) && hasStatus(actor, "unstoppable")) {
    return { applied: false, reason: "unstoppable" };
  }
  const next = JSON.parse(JSON.stringify(status));
  const index = (actor.statuses || []).findIndex((entry) => entry.type === status.type);
  if (index >= 0) actor.statuses[index] = next;
  else actor.statuses.push(next);
  return { applied: true, status: next };
}

export function removeStatus(actor, type) {
  const index = (actor.statuses || []).findIndex((status) => status.type === type);
  if (index < 0) return null;
  return actor.statuses.splice(index, 1)[0];
}
