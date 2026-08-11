import { describe, expect, it } from "vitest";
import { REFERENCE_POLICY } from "./policy.js";

describe("public-evidence reference policy", () => {
  it("versions the hardened provisional baseline", () => {
    expect(REFERENCE_POLICY.id).toBe("tow-1.4.16-public-evidence-v2");
  });

  it("labels unverified turn and loadout structure as inferred policy gaps", () => {
    expect(REFERENCE_POLICY.turnOrderEvidence).toBe("inferred-policy-gap");
    expect(REFERENCE_POLICY.intentVisibilityEvidence).toBe("inferred-policy-gap");
    expect(REFERENCE_POLICY.skills).toEqual({
      loadoutCapacity: 3,
      loadoutCapacityEvidence: "inferred-policy-gap",
    });
  });
});
