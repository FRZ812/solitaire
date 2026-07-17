import { describe, expect, it } from "vitest";
import {
  LAST_OPENED_KEY,
  clearCampaignResume,
  readLastCampaignId,
  readResumeSnapshot,
  rememberLastCampaignId,
  shouldRecoverResumeSnapshot,
  writeResumeSnapshot,
} from "./campaign-resume.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

const state = {
  character: { name: "Mara" },
  world: { currentTile: { x: 1, y: 2 } },
  beats: [],
};

describe("campaign resume cache", () => {
  it("keeps the active campaign pointer and a user-scoped warm snapshot", () => {
    const storage = memoryStorage();
    expect(writeResumeSnapshot({
      userId: "user-a",
      campaignId: "campaign-1",
      state,
      dirty: false,
      capturedAt: 123,
      serverUpdatedAt: "2026-07-17T00:00:00.000Z",
    }, storage)).toBe(true);

    expect(readLastCampaignId(storage)).toBe("campaign-1");
    expect(readResumeSnapshot("user-a", storage)).toMatchObject({
      campaignId: "campaign-1",
      capturedAt: 123,
      dirty: false,
      state,
    });
    expect(readResumeSnapshot("user-b", storage)).toBeNull();
  });

  it("recovers only a dirty snapshot that is newer than the server row", () => {
    const dirty = {
      dirty: true,
      capturedAt: Date.parse("2026-07-17T10:01:00.000Z"),
      serverUpdatedAt: "2026-07-17T10:00:00.000Z",
    };
    expect(shouldRecoverResumeSnapshot(dirty, "2026-07-17T10:00:00.000Z")).toBe(true);
    expect(shouldRecoverResumeSnapshot(dirty, "2026-07-17T10:02:00.000Z")).toBe(false);
    expect(shouldRecoverResumeSnapshot({ ...dirty, dirty: false }, "2026-07-17T10:00:00.000Z")).toBe(false);
  });

  it("ignores malformed snapshots and clears all resume state", () => {
    const storage = memoryStorage();
    rememberLastCampaignId("campaign-2", storage);
    storage.setItem("solitaire-resume-snapshot-v12", "{broken");

    expect(readLastCampaignId(storage)).toBe("campaign-2");
    expect(readResumeSnapshot("user-a", storage)).toBeNull();

    clearCampaignResume(storage);
    expect(storage.getItem(LAST_OPENED_KEY)).toBeNull();
    expect(readResumeSnapshot("user-a", storage)).toBeNull();
  });
});
