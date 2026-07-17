export const LAST_OPENED_KEY = "solitaire-last-campaign-v12";

const RESUME_SNAPSHOT_KEY = "solitaire-resume-snapshot-v12";
const RESUME_SNAPSHOT_VERSION = 1;

function browserStorage(storage) {
  if (storage) return storage;
  try { return globalThis.localStorage; } catch { return null; }
}

function looksLikeCampaignState(state) {
  return !!(
    state
    && typeof state === "object"
    && state.character
    && state.world?.currentTile
    && Array.isArray(state.beats)
  );
}

export function readLastCampaignId(storage) {
  try {
    const value = browserStorage(storage)?.getItem(LAST_OPENED_KEY);
    return typeof value === "string" && value.trim() ? value : null;
  } catch {
    return null;
  }
}

export function rememberLastCampaignId(campaignId, storage) {
  if (!campaignId) return;
  try { browserStorage(storage)?.setItem(LAST_OPENED_KEY, campaignId); } catch {}
}

export function readResumeSnapshot(userId, storage) {
  if (!userId) return null;
  try {
    const raw = browserStorage(storage)?.getItem(RESUME_SNAPSHOT_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw);
    if (
      snapshot?.version !== RESUME_SNAPSHOT_VERSION
      || snapshot.userId !== userId
      || typeof snapshot.campaignId !== "string"
      || !snapshot.campaignId
      || !looksLikeCampaignState(snapshot.state)
      || !Number.isFinite(snapshot.capturedAt)
    ) return null;
    return snapshot;
  } catch {
    return null;
  }
}

export function writeResumeSnapshot({
  userId,
  campaignId,
  state,
  dirty = true,
  capturedAt = Date.now(),
  serverUpdatedAt = null,
}, storage) {
  if (!userId || !campaignId || !looksLikeCampaignState(state)) return false;
  const target = browserStorage(storage);
  rememberLastCampaignId(campaignId, target);
  try {
    target?.setItem(RESUME_SNAPSHOT_KEY, JSON.stringify({
      version: RESUME_SNAPSHOT_VERSION,
      userId,
      campaignId,
      capturedAt,
      serverUpdatedAt,
      dirty: !!dirty,
      state,
    }));
    return true;
  } catch {
    // The Supabase save remains authoritative if storage is unavailable or the
    // browser quota is full. Keeping resume caching best-effort prevents a
    // storage failure from interrupting play. Remove an older snapshot so it
    // cannot be mistaken for the latest dirty state on a future launch.
    try { target?.removeItem(RESUME_SNAPSHOT_KEY); } catch {}
    return false;
  }
}

export function shouldRecoverResumeSnapshot(snapshot, serverUpdatedAt) {
  if (!snapshot?.dirty) return false;
  if (snapshot.serverUpdatedAt && serverUpdatedAt) {
    // Recover only when the dirty local state was based on this exact server
    // revision. If the row changed elsewhere, the newer server version wins.
    return snapshot.serverUpdatedAt === serverUpdatedAt;
  }
  const serverTime = Date.parse(serverUpdatedAt || "");
  if (!Number.isFinite(serverTime)) return true;
  return snapshot.capturedAt > serverTime;
}

export function clearCampaignResume(storage) {
  const target = browserStorage(storage);
  try { target?.removeItem(LAST_OPENED_KEY); } catch {}
  try { target?.removeItem(RESUME_SNAPSHOT_KEY); } catch {}
}
