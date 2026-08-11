import { describe, expect, it } from "vitest";
import { specializedNarratorPolicyOptions } from "./narrator-specialized-policy.js";

describe("specialized narrator policy routing", () => {
  it.each([
    ["[TRADE] settled", { route: "trade-presentation" }],
    ["[APPROACH MOUNT] beast (id: ash-runner)", {
      route: "mount-negotiation",
      effectConstraints: { buy_mount: { fields: { id: "ash-runner" } } },
    }],
    ["[APPROACH RECRUIT] prospect (id: mara-vale)", {
      route: "recruitment-negotiation",
      effectConstraints: {
        recruit_companion: { fields: { id: "mara-vale" } },
        relationship_changes: { eachFields: { id: "mara-vale" } },
        memory_updates: { eachFields: { id: "mara-vale" } },
      },
    }],
    ['[PLAYER ACTION] [PART WAYS] settle part_ways:{"id":"mara-vale"}', {
      route: "party-departure",
      effectConstraints: {
        part_ways: { fields: { id: "mara-vale" } },
        relationship_changes: { eachFields: { id: "mara-vale" } },
        memory_updates: { eachFields: { id: "mara-vale" } },
      },
    }],
    ["[PLAYER ACTION] [SCRY] vision (id: remote-rook)", {
      route: "scry-presentation",
      storyCharacterIds: ["remote-rook"],
    }],
    ['[INSPECT RIGHTS] settle purchase_rights:{"key":"bond-7"}', {
      route: "rights-negotiation",
      effectConstraints: { purchase_rights: { fields: { key: "bond-7" } } },
    }],
    ['[INSPECT CAPTIVE] settle purchase_captive:{"key":"lot-4"}', {
      route: "captive-negotiation",
      effectConstraints: { purchase_captive: { fields: { key: "lot-4" } } },
    }],
    ["[PLAYER ACTION] You go looking for a fight here", { route: "combat-search-presentation" }],
  ])("derives a bounded policy from a trusted engine prompt", (message, expected) => {
    expect(specializedNarratorPolicyOptions(message)).toEqual(expected);
  });

  it("fails closed when a target-bearing route omits its engine target", () => {
    expect(() => specializedNarratorPolicyOptions("[APPROACH MOUNT] missing id"))
      .toThrow("missing its engine-issued target");
    expect(() => specializedNarratorPolicyOptions("[PLAYER ACTION] [SCRY] missing id"))
      .toThrow("missing its engine-issued target");
  });

  it("does not classify arbitrary player prose", () => {
    expect(() => specializedNarratorPolicyOptions("I buy a horse"))
      .toThrow("missing an engine-issued route");
  });
});
