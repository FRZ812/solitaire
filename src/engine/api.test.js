import { describe, expect, it } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import { buildStateContext } from "./api.js";
import { applyBeat } from "./beat.js";

describe("narrator party context", () => {
  it("lists top-level party members with ids usable by narrator actions", () => {
    const recruited = applyBeat(
      { ...makeInitialState(), created: true },
      { recruit_companion: { id: "bram" } },
    );

    const context = buildStateContext(recruited);

    expect(context).toContain("[COMPANIONS — travelling with you: Bram Holt (id: bram;");
    expect(context).toContain("use their listed id in party_removals");
  });
});
