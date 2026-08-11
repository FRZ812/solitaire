// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { makeInitialState } from "./data/initial-state.js";
import { LAST_OPENED_KEY, readResumeSnapshot } from "./engine/campaign-resume.js";
import { startReferenceGatekeeperTrial } from "./gameplay/run/campaign-boundary.js";
import { Solitaire } from "./App.jsx";

const harness = vi.hoisted(() => {
  vi.stubEnv("VITE_ENABLE_REFERENCE_GAMEPLAY_PREVIEW", "true");
  return {
    serverState: null,
    saveError: null,
    failBrowserStorage: false,
    saveCampaign: vi.fn(),
    loadCampaignRecord: vi.fn(),
    listCampaigns: vi.fn(),
  };
});

vi.mock("./engine/auth-supabase.js", () => ({
  isSubscribed: vi.fn(async () => true),
  linkEmail: vi.fn(async () => {}),
  onAuthChange: (listener) => {
    queueMicrotask(() => listener({ id: "browser-user", email: "browser@example.test" }));
    return () => {};
  },
  signOut: vi.fn(async () => {}),
}));

vi.mock("./engine/campaigns-supabase.js", () => ({
  deleteCampaign: vi.fn(async () => {}),
  listCampaigns: harness.listCampaigns,
  loadCampaignRecord: harness.loadCampaignRecord,
  renameCampaign: vi.fn(async () => {}),
  saveCampaign: harness.saveCampaign,
}));

function playableCampaign() {
  const state = makeInitialState();
  state.created = true;
  return state;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

async function waitFor(assertion, timeout = 4000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = assertion();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  }
  if (lastError) throw lastError;
  throw new Error("Timed out waiting for browser integration state");
}

function buttonByText(container, text) {
  return Array.from(container.querySelectorAll("button"))
    .find((button) => button.textContent.includes(text));
}

async function click(element) {
  expect(element).toBeTruthy();
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

let storageSetItem;
let mountedRoot = null;
let mountedContainer = null;

async function mountCampaign() {
  mountedContainer = document.createElement("div");
  document.body.appendChild(mountedContainer);
  mountedRoot = createRoot(mountedContainer);
  await act(async () => { mountedRoot.render(<Solitaire />); });
  await waitFor(() => mountedContainer.querySelector(".game-shell"));
  return mountedContainer;
}

async function unmountCampaign() {
  if (mountedRoot) await act(async () => { mountedRoot.unmount(); });
  mountedContainer?.remove();
  mountedRoot = null;
  mountedContainer = null;
}

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  storageSetItem = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function setItem(key, value) {
    if (harness.failBrowserStorage && key === "solitaire-resume-snapshot-v12") {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    }
    return storageSetItem.call(this, key, value);
  });
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(LAST_OPENED_KEY, "browser-campaign");
  harness.serverState = playableCampaign();
  harness.saveError = null;
  harness.failBrowserStorage = false;
  harness.listCampaigns.mockReset().mockResolvedValue([
    { id: "browser-campaign", name: "Browser campaign", schema_version: "v12" },
  ]);
  harness.loadCampaignRecord.mockReset().mockImplementation(async () => ({
    state: cloneJson(harness.serverState),
    updatedAt: "2026-08-10T12:00:00.000Z",
  }));
  harness.saveCampaign.mockReset().mockImplementation(async (id, state) => {
    if (harness.saveError) throw harness.saveError;
    harness.serverState = cloneJson(state);
    return { id, updatedAt: "2026-08-10T12:00:01.000Z" };
  });
});

afterEach(async () => {
  await unmountCampaign();
  vi.clearAllTimers();
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

describe("reference gameplay at the real App browser boundary", () => {
  it("persists an accepted move, resumes it after reload, and reports browser/server write failures", async () => {
    let container = await mountCampaign();
    await click(await waitFor(() => buttonByText(container, "Begin")));
    await waitFor(() => container.querySelector('[role="dialog"][aria-label="Tower of Winter reference combat"]'));

    const portalSurface = document.createElement("div");
    portalSurface.dataset.testPortalSurface = "true";
    const escapedControl = document.createElement("button");
    escapedControl.type = "button";
    escapedControl.textContent = "Escaped portal control";
    portalSurface.appendChild(escapedControl);
    document.body.appendChild(portalSurface);
    await waitFor(() => (
      portalSurface.hasAttribute("inert")
      && portalSurface.getAttribute("aria-hidden") === "true"
    ));
    expect(portalSurface.hasAttribute("hidden")).toBe(true);

    await click(container.querySelector(".reference-action"));
    const enemyMeter = await waitFor(() => container.querySelector('[aria-label="The Gatekeeper vitality"]'));
    const hpAfterAttack = enemyMeter.getAttribute("aria-valuenow");

    await waitFor(() => {
      const snapshot = readResumeSnapshot("browser-user");
      return snapshot?.state?.referenceGameplaySave?.runState?.sequence === 1;
    });
    await waitFor(() => harness.saveCampaign.mock.calls.some(([, state]) => (
      state.referenceGameplaySave?.runState?.sequence === 1
    )));

    await unmountCampaign();
    expect(portalSurface.hasAttribute("inert")).toBe(false);
    expect(portalSurface.hasAttribute("aria-hidden")).toBe(false);
    expect(portalSurface.hasAttribute("hidden")).toBe(false);
    portalSurface.remove();
    container = await mountCampaign();
    const resumedDialog = await waitFor(() => container.querySelector('[role="dialog"]'));
    expect(resumedDialog.querySelector('[aria-label="The Gatekeeper vitality"]')
      .getAttribute("aria-valuenow")).toBe(hpAfterAttack);

    harness.failBrowserStorage = true;
    await click(container.querySelector(".reference-action"));
    await click(buttonByText(container, "Leave trial"));
    await waitFor(() => {
      const alert = container.querySelector('[role="alert"]');
      return alert?.textContent.includes("Browser recovery cache could not be updated") && alert;
    });

    harness.failBrowserStorage = false;
    await click(buttonByText(container, "Resume"));
    await waitFor(() => container.querySelector('[role="dialog"]'));
    harness.saveError = new Error("offline persistence probe");
    await click(container.querySelectorAll(".reference-action")[1]);
    await waitFor(() => {
      const alert = container.querySelector('[role="alert"]');
      return alert?.textContent.includes("Save failed: offline persistence probe") && alert;
    }, 5000);
  }, 45_000);

  it("does not open a foreign valid save and requires explicit replacement", async () => {
    const foreign = startReferenceGatekeeperTrial(playableCampaign(), {
      campaignId: "foreign-campaign",
      previewEnabled: true,
    });
    harness.serverState = { ...foreign.state, referenceGameplayAttempt: "corrupt" };

    const container = await mountCampaign();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.textContent).toContain("reference-gameplay-lineage-mismatch");

    const replaceButton = buttonByText(container, "Replace invalid save");
    replaceButton.focus();
    await click(replaceButton);
    await waitFor(() => container.querySelector('[role="dialog"]'));
    expect(container.textContent).toContain("Developer sandbox");

    await click(buttonByText(container, "Leave trial"));
    const resumeButton = await waitFor(() => buttonByText(container, "Resume"));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    expect(document.activeElement).toBe(resumeButton);
  }, 45_000);

  it("rebases newer dirty recovery state when an older in-flight autosave succeeds", async () => {
    const pendingSaves = [];
    harness.saveCampaign.mockImplementation((id, state) => new Promise((resolve) => {
      pendingSaves.push({ id, state: cloneJson(state), resolve });
    }));

    const container = await mountCampaign();
    await click(await waitFor(() => buttonByText(container, "Begin")));
    await waitFor(() => pendingSaves.length === 1);

    await click(container.querySelector(".reference-action"));
    await waitFor(() => (
      readResumeSnapshot("browser-user")?.state?.referenceGameplaySave?.runState?.sequence === 1
    ));

    await act(async () => {
      pendingSaves[0].resolve({
        id: "browser-campaign",
        updatedAt: "2026-08-10T12:00:01.000Z",
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      const cached = readResumeSnapshot("browser-user");
      return cached?.dirty === true
        && cached.serverUpdatedAt === "2026-08-10T12:00:01.000Z"
        && cached.state.referenceGameplaySave.runState.sequence === 1;
    });
  }, 45_000);
});
