// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup as renderServerMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InputBar, NarratorPickerPanel } from "./primitives.jsx";

function renderStatic(node) {
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: undefined });
  try {
    return renderServerMarkup(node);
  } finally {
    Object.defineProperty(globalThis, "document", documentDescriptor);
  }
}

describe("InputBar", () => {
  it("integrates the expandable context inspector into the composer surface", () => {
    const preview = {
      total: 14_200,
      deferredTokens: 38_700,
      availableSkills: [],
      sections: [
        { id: "system", label: "Core prompt", description: "Compact rules", content: "Rules", tokens: 2_000, percent: 14, color: "#b667d8" },
      ],
    };
    const html = renderStatic(
      <InputBar
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        onRun={() => {}}
        loading={false}
        contextPreview={preview}
        contextOpen
        activeModel="DeepSeek V4 Pro"
        onToggleContext={() => {}}
      />,
    );

    const surface = html.indexOf('class="story-input__surface is-context-open"');
    const trigger = html.indexOf('class="story-input__context"');
    const inspector = html.indexOf('id="chat-context-inspector"');
    const composer = html.indexOf('class="story-input__composer"');
    expect(surface).toBeGreaterThan(-1);
    expect(trigger).toBeGreaterThan(surface);
    expect(inspector).toBeGreaterThan(trigger);
    expect(composer).toBeGreaterThan(inspector);
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-controls="chat-context-inspector"');
    expect(html).toContain('id="chat-context-trigger"');
    expect(html).toContain("14.2k estimated tokens");
    expect(html).toContain("Sent next request");
    expect(html).toContain("Sent with next request");
  });

  it("dismisses with Escape and click-away, preserves inside clicks, and restores trigger focus", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const preview = {
      total: 1_200,
      deferredTokens: 0,
      availableSkills: [],
      sections: [{ id: "system", label: "Core prompt", description: "Rules", content: "Rules", tokens: 1_200, percent: 100, color: "#b667d8" }],
    };
    function Harness() {
      const [open, setOpen] = React.useState(true);
      return (
        <>
          <InputBar
            value=""
            onChange={() => {}}
            onSubmit={() => {}}
            onRun={() => {}}
            contextPreview={preview}
            contextOpen={open}
            onContextOpenChange={setOpen}
          />
          <button id="outside" type="button">Outside</button>
          <div role="dialog" aria-modal="true"><button id="dialog-action" type="button">Dialog action</button></div>
        </>
      );
    }

    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(<Harness />));

    const trigger = host.querySelector("#chat-context-trigger");
    const field = host.querySelector(".story-input__field");
    await act(async () => field.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(host.querySelector("#chat-context-inspector")).not.toBeNull();

    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(host.querySelector("#chat-context-inspector")).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await act(async () => trigger.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(host.querySelector("#chat-context-inspector")).not.toBeNull();
    await act(async () => host.querySelector("#dialog-action").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(host.querySelector("#chat-context-inspector")).not.toBeNull();
    await act(async () => host.querySelector("#outside").dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(host.querySelector("#chat-context-inspector")).toBeNull();

    await act(async () => root.unmount());
    host.remove();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it("shows one send action while the textarea contains a draft", () => {
    const html = renderStatic(
      <InputBar
        value="I wait."
        onChange={() => {}}
        onSubmit={() => {}}
        onRun={() => {}}
        queuedCount={2}
        loading={false}
      />,
    );

    expect(html).toContain('aria-label="Queue message"');
    expect(html).toContain('class="story-input__action is-send"');
    expect(html).toContain('data-game-icon="send"');
    expect(html).not.toContain('aria-label="Run narrator with 2 queued messages"');
    expect(html).not.toContain('class="story-input__action is-play"');
    expect(html).toContain("Ctrl ↵ to queue");
  });

  it("turns the same action into play when the textarea is empty", () => {
    const html = renderStatic(
      <InputBar value="" onChange={() => {}} onSubmit={() => {}} onRun={() => {}} queuedCount={2} loading={false} />,
    );

    expect(html).toContain('aria-label="Run narrator with 2 queued messages"');
    expect(html).toContain('class="story-input__action is-play"');
    expect(html).toContain('data-game-icon="play"');
    expect(html).toContain('story-input__queued-count');
    expect(html).not.toContain('class="story-input__action is-send"');
  });

  it("allows continuing with no queued player action", () => {
    const html = renderStatic(
      <InputBar value="" onChange={() => {}} onSubmit={() => {}} onRun={() => {}} queuedCount={0} loading={false} />,
    );

    expect(html).toContain('aria-label="Continue story without a new action"');
  });

  it("keeps an earned advancement visible above chat and uses the generated icon", () => {
    const html = renderStatic(
      <InputBar
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        onRun={() => {}}
        loading={true}
        advancementCount={2}
        onOpenProgression={() => {}}
      />,
    );

    expect(html).toContain('class="story-input__advancement"');
    expect(html).toContain('aria-label="2 advancements ready. Open Progression."');
    expect(html).toContain('data-game-icon="progression"');
    expect(html).toContain("Open Progression");
    expect(html).not.toContain('class="story-input__advancement" disabled');
  });

  it("continues prompting when a specialization or grant choice remains", () => {
    const html = renderStatic(
      <InputBar
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        onRun={() => {}}
        loading={false}
        advancementNeedsChoice={true}
        onOpenProgression={() => {}}
      />,
    );

    expect(html).toContain('aria-label="Finish advancement. Open Progression."');
    expect(html).toContain("Finish advancement");
    expect(html).not.toContain('<b aria-hidden="true">0</b>');
  });

  it("shows an explicit close action with useful price and intelligence columns", () => {
    const html = renderStatic(
      <NarratorPickerPanel
        model="deepseek/deepseek-v4-flash-0731"
        effort="max"
        query=""
        sort="price-asc"
        onQueryChange={() => {}}
        onSortChange={() => {}}
        onChooseModel={() => {}}
        onChooseEffort={() => {}}
        onClose={() => {}}
      />,
    );

    expect(html).toContain('aria-label="Choose narrator model"');
    expect(html).toContain('aria-label="Close narrator picker"');
    expect(html).toContain("Narrator model");
    expect(html).toContain("PRICE");
    expect(html).toContain("INTELLIGENCE");
    expect(html).toContain('aria-label="Sort narrator models"');
    expect(html).toContain('<option value="price-asc" selected="">Price · low first</option>');
    expect(html).toContain('class="narrator-picker__column narrator-picker__column--price"');
    expect(html).toContain("Free primary");
    expect(html).toContain("$0.09 / $0.18 fallback");
    expect(html).toContain("272K+ $0.20 / $0.90");
    expect(html).toContain("200K+ $4.00 / $12.00");
    expect(html).toMatch(/aria-label="GPT-5\.6 Luna\.[^"]*\$0\.125 cache write[^"]*272K\+ \$0\.20 \/ \$0\.90/);
    expect(html).toMatch(/aria-label="GPT-5\.6 Terra\.[^"]*\$1\.25 cache write[^"]*272K\+ \$2\.00 \/ \$9\.00/);
    expect(html).toMatch(/aria-label="Grok 4\.5\.[^"]*200K\+ \$4\.00 \/ \$12\.00/);
    const visiblePriceCells = [...html.matchAll(/<span class="narrator-picker__price">([\s\S]*?)<\/span>/g)]
      .map((match) => match[1])
      .join(" ");
    expect(visiblePriceCells).not.toContain("cached input");
    expect(visiblePriceCells).not.toContain("cache write");
    expect(html).toContain("$0.09 / $0.18");
    expect(html).toContain("$0.72 / $1.80");
    expect(html).toContain("DeepSeek V4 Flash");
    expect(html).not.toContain("DeepSeek V4 Flash 0731");
    expect(html).not.toContain("DeepSeek V4 Pro");
    expect(html).not.toContain("Qwen 3.7 Flash");
    expect(html).not.toContain(">Hy3<");
    expect(html).toContain("Artificial Analysis");
    expect(html).toContain("49.9");
    expect(html).toContain("57.1");
    expect(html).toContain("Unrated");
    expect(html).toContain('<details class="narrator-picker__effort-panel">');
    expect(html).toContain("Advanced settings");
    expect(html).toContain("Thinking effort");
    expect(html).toContain('type="range"');
    expect(html).toContain('class="narrator-picker__effort-control" style="--effort-progress:100%"');
    expect(html).toContain('aria-valuetext="Max"');
    expect(html).toContain(">XHigh<");
    expect(html).toContain(">Max<");
    expect(html).toContain("token-budget models translate the same scale proportionally");

    expect(html).not.toContain("narrator-picker__handle");
    expect(html).not.toContain("narrator-picker__mode");
    expect(html).not.toContain("narrator-picker__filters");
    expect(html).not.toContain("narrator-picker__route-bar");
    expect(html).not.toContain("narrator-picker__capability");
    expect(html).not.toContain("OPENROUTER ROUTE");
    expect(html).not.toContain("OPENAI ROUTE");
    expect(html).not.toContain("REASONING</span>");
  });

  it("searches the narrator provider notes as well as model labels", () => {
    const html = renderStatic(
      <NarratorPickerPanel
        model="moonshotai/kimi-k3"
        effort="max"
        query="Moonshot"
        onQueryChange={() => {}}
        onChooseModel={() => {}}
        onChooseEffort={() => {}}
        onClose={() => {}}
      />,
    );

    expect(html).toContain("Kimi K3");
    expect(html).not.toContain("GLM 5.2");
  });

  it("discloses semantic effort fallback in visible and accessible picker text", () => {
    const html = renderStatic(
      <NarratorPickerPanel
        model="x-ai/grok-4.5"
        effort="max"
        query=""
        onQueryChange={() => {}}
        onChooseModel={() => {}}
        onChooseEffort={() => {}}
        onClose={() => {}}
      />,
    );

    expect(html).toContain("Max → High");
    expect(html).toContain('aria-valuetext="Max → High"');
  });
});
