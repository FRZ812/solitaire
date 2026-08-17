// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  normalizePartyFormation,
  PartyFormationEditor,
} from "./PartyFormationEditor.jsx";

let root;
let container;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  container?.remove();
  root = null;
  container = null;
});

async function renderEditor(props = {}) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<PartyFormationEditor {...props} />));
  return container;
}

describe("party formation editor", () => {
  it("always includes the Wanderer and normalizes the formation to nine unique current members", async () => {
    const members = [{ id: "kestrel", name: "Kestrel" }];
    expect(normalizePartyFormation(
      ["wanderer", "kestrel", "wanderer", "departed", "kestrel"],
      members,
    )).toEqual(["wanderer", "kestrel", null, null, null, null, null, null, null]);

    const mounted = await renderEditor({ members, formation: ["kestrel"] });
    expect(mounted.querySelectorAll(".party-formation-editor__cell")).toHaveLength(9);
    expect([...mounted.querySelectorAll(".party-formation-editor__row-label")].map((label) => label.textContent))
      .toEqual(["Front", "Middle", "Rear"]);
    expect([...mounted.querySelectorAll(".party-formation-editor__chip strong")].map((name) => name.textContent))
      .toEqual(["You", "Kestrel"]);
    expect(mounted.querySelector("[data-cell-index='8']").disabled).toBe(true);
  });

  it("swaps occupied positions and places a roster-selected reserve into an empty cell", async () => {
    const onChange = vi.fn();
    const mounted = await renderEditor({
      members: [
        { id: "wanderer", name: "Alden" },
        { id: "kestrel", name: "Kestrel" },
        { id: "sable", name: "Sable" },
      ],
      formation: ["wanderer", "kestrel"],
      onChange,
    });

    const first = mounted.querySelector("[data-cell-index='0']");
    const second = mounted.querySelector("[data-cell-index='1']");
    await act(async () => first.click());
    expect(first.getAttribute("aria-pressed")).toBe("true");
    await act(async () => second.click());
    expect(onChange).toHaveBeenNthCalledWith(
      1,
      ["kestrel", "wanderer", null, null, null, null, null, null, null],
    );

    const sable = [...mounted.querySelectorAll(".party-formation-editor__chip")]
      .find((chip) => chip.textContent.includes("Sable"));
    await act(async () => sable.click());
    const empty = mounted.querySelector("[data-cell-index='2']");
    expect(empty.disabled).toBe(false);
    await act(async () => empty.click());
    expect(onChange).toHaveBeenNthCalledWith(
      2,
      ["wanderer", "kestrel", "sable", null, null, null, null, null, null],
    );
  });
});
