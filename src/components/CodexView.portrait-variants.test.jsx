// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createPortraitVariantToken } from "./character-portrait-assets.js";
import { CharacterPortraitEditor } from "./CodexView.jsx";

const entry = { id: "demon-king", name: "The Demon King" };
const runtimePortraitCases = [
  {
    label: "companion",
    entry: { id: "senna", kind: "companion", portraitKey: "companion:senna", name: "Senna Rell" },
    token: "builtin:companion:senna:v2",
  },
  {
    label: "day-stamped bonded character",
    entry: { id: "bonded-harl-17", kind: "bonded", portraitKey: "bonded:harl", name: "Harl" },
    token: "builtin:bonded:harl:v2",
  },
  {
    label: "wanted character",
    entry: { id: "wanted-vane", kind: "wanted", portraitKey: "wanted:vane", name: "Goodwife Vane" },
    token: "builtin:wanted:vane:v2",
  },
  {
    label: "mount",
    entry: { id: "dragon", kind: "mount", portraitKey: "mount:dragon", name: "Dragon" },
    token: "builtin:mount:dragon:v2",
  },
  {
    label: "legacy TOW alias",
    entry: { id: "knight", portraitKey: "tow:arctic-knight", name: "Arctic Knight" },
    token: "builtin:tow:knight:v2",
  },
];
let root;
let host;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  host?.remove();
  root = null;
  host = null;
});

describe("Codex portrait choices", () => {
  it("renders a compact accessible two-choice control for complete portrait pairs", () => {
    const selected = createPortraitVariantToken(entry, 2);
    const html = renderToStaticMarkup(
      <CharacterPortraitEditor entry={entry} portraitOverride={selected} onPortraitChange={() => {}} />,
    );

    expect(html.match(/data-portrait-choice=/g)).toHaveLength(2);
    expect(html).toContain('role="group" aria-label="Portrait choice for The Demon King"');
    expect(html).toContain('aria-label="The Demon King portrait 1" aria-pressed="false"');
    expect(html).toContain('aria-label="The Demon King portrait 2" aria-pressed="true"');
    expect(html).toContain('data-portrait-variant-token="builtin:codex:demon-king:v2"');
    expect(html).toContain("Upload portrait");
    expect(html).toContain("Use original");
  });

  it("keeps uploaded portraits separate from authored selection for a canonicalized TOW alias", () => {
    const towAlias = runtimePortraitCases.find(({ label }) => label === "legacy TOW alias").entry;
    const html = renderToStaticMarkup(
      <CharacterPortraitEditor
        entry={towAlias}
        portraitOverride="data:image/webp;base64,QUJDRA=="
        onPortraitChange={() => {}}
      />,
    );

    expect(html.match(/aria-pressed="false"/g)).toHaveLength(2);
    expect(html).toContain('data-portrait-variant-token="builtin:tow:knight:v2"');
    expect(html).toContain("Change upload");
    expect(html).toContain("Use original");
  });

  it("persists canonical tokens for acquired character, mount, and TOW record shapes", async () => {
    const onPortraitChange = vi.fn();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(
      <>
        {runtimePortraitCases.map(({ label, entry: runtimeEntry }) => (
          <CharacterPortraitEditor
            key={label}
            entry={runtimeEntry}
            onPortraitChange={onPortraitChange}
          />
        ))}
      </>,
    ));

    for (const { entry: runtimeEntry, token } of runtimePortraitCases) {
      const group = [...host.querySelectorAll('[role="group"]')]
        .find((candidate) => candidate.getAttribute("aria-label") === `Portrait choice for ${runtimeEntry.name}`);
      const choice = group?.querySelector('[data-portrait-choice="2"]');
      expect(choice?.getAttribute("data-portrait-variant-token")).toBe(token);

      await act(async () => choice.click());
      expect(onPortraitChange).toHaveBeenLastCalledWith(runtimeEntry.id, token);
    }

    expect(onPortraitChange).toHaveBeenCalledTimes(runtimePortraitCases.length);
  });

  it("persists a stable built-in token when a thumbnail is chosen", async () => {
    const onPortraitChange = vi.fn();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(
      <CharacterPortraitEditor entry={entry} onPortraitChange={onPortraitChange} />,
    ));

    await act(async () => host.querySelector('[data-portrait-choice="2"]').click());

    expect(onPortraitChange).toHaveBeenCalledOnce();
    expect(onPortraitChange).toHaveBeenCalledWith("demon-king", "builtin:codex:demon-king:v2");
  });
});
