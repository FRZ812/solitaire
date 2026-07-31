import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../hooks/useInstallPrompt.js", () => ({
  useInstallPrompt: () => ({ canInstall: true, promptInstall: vi.fn() }),
}));

import { InstallPill } from "./InstallPill.jsx";

describe("PWA install affordance", () => {
  it("stays out of the full-screen exploration controls", () => {
    const html = renderToStaticMarkup(<InstallPill />);
    const css = readFileSync(new URL("./game-theme.css", import.meta.url), "utf8");

    expect(html).toContain('class="install-pill"');
    expect(css).toMatch(/body:has\(\.exploration-shell\) \.install-pill\s*\{[^}]*visibility:\s*hidden[^}]*pointer-events:\s*none/s);
  });
});