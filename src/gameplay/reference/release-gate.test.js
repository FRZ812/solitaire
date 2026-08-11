import { describe, expect, it } from "vitest";
import {
  REFERENCE_GAMEPLAY_PREVIEW_ENV,
  referenceGameplayPreviewEnabled,
} from "./release-gate.js";

describe("reference gameplay release gate", () => {
  it("is disabled unless the exact build-time preview flag is true", () => {
    expect(REFERENCE_GAMEPLAY_PREVIEW_ENV).toBe("VITE_ENABLE_REFERENCE_GAMEPLAY_PREVIEW");
    expect(referenceGameplayPreviewEnabled({})).toBe(false);
    expect(referenceGameplayPreviewEnabled({ VITE_ENABLE_REFERENCE_GAMEPLAY_PREVIEW: "false" })).toBe(false);
    expect(referenceGameplayPreviewEnabled({ VITE_ENABLE_REFERENCE_GAMEPLAY_PREVIEW: true })).toBe(false);
    expect(referenceGameplayPreviewEnabled({ VITE_ENABLE_REFERENCE_GAMEPLAY_PREVIEW: "true" })).toBe(true);
  });

  it("fails closed without executing an accessor-backed flag", () => {
    let getterCalls = 0;
    const environment = {};
    Object.defineProperty(environment, "VITE_ENABLE_REFERENCE_GAMEPLAY_PREVIEW", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return "true";
      },
    });

    expect(referenceGameplayPreviewEnabled(environment)).toBe(false);
    expect(getterCalls).toBe(0);
  });
});
