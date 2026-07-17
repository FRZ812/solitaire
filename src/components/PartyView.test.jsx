import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PartyView } from "./PartyView.jsx";

const companion = (id, overrides = {}) => ({
  id,
  name: id === "veteran" ? "Vera" : "Darin",
  kind: "companion",
  race: "human",
  profession: "fighter",
  attributes: {},
  conditions: [],
  worn: [],
  inventory: { carried: [] },
  ...overrides,
});

describe("PartyView profession identity", () => {
  it("renders the public Warrior name for stored fighter ids and retains an existing specialization", () => {
    const state = {
      party: ["veteran", "duelist"],
      world: {
        codex: {
          characters: {
            wanderer: { id: "wanderer", name: "You", worn: [] },
            veteran: companion("veteran"),
            duelist: companion("duelist", { archetype: "duelist" }),
          },
          items: {},
        },
      },
    };

    const html = renderToStaticMarkup(
      <PartyView state={state} onDismiss={() => {}} onMount={() => {}} onDismount={() => {}} />,
    );

    expect(html).toContain("human · Warrior");
    expect(html).toContain("human · Warrior · Duelist");
    expect(html).not.toMatch(/human · fighter/i);
  });
});
