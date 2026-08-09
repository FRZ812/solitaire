import { describe, expect, it } from "vitest";
import { createRng, nextInt } from "./rng.js";

describe("seeded gameplay RNG", () => {
  it("distinguishes supplementary Unicode code points", () => {
    expect(createRng("act:😀")).not.toEqual(createRng("act:😁"));
  });

  it("pins the existing ASCII seed stream", () => {
    const first = nextInt(createRng("act-1"), 1, 100);
    const second = nextInt(first.rng, 1, 100);

    expect({ first: first.value, second: second.value, state: second.rng.state }).toEqual({
      first: 49,
      second: 64,
      state: 323664835,
    });
  });
});
