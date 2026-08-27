/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import { MenuSheet } from "./MenuSheet.jsx";

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

describe("character Resolve explanation", () => {
  it("describes recovery as a free-basic trigger, never passive turn income", async () => {
    const state = makeInitialState();
    state.character.attributes.presence = 5;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<MenuSheet state={state} />));

    const trigger = container.querySelector("button[aria-label^='Learn about Resolve']");
    expect(trigger).toBeTruthy();
    await act(async () => trigger.click());

    expect(document.body.textContent).toContain("1 back after a free basic ability");
    expect(document.body.textContent).not.toContain("back each turn");
  });
});
