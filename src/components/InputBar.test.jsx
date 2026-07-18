import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InputBar } from "./primitives.jsx";

describe("InputBar", () => {
  it("shows one send action while the textarea contains a draft", () => {
    const html = renderToStaticMarkup(
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
    const html = renderToStaticMarkup(
      <InputBar value="" onChange={() => {}} onSubmit={() => {}} onRun={() => {}} queuedCount={2} loading={false} />,
    );

    expect(html).toContain('aria-label="Run narrator with 2 queued messages"');
    expect(html).toContain('class="story-input__action is-play"');
    expect(html).toContain('data-game-icon="play"');
    expect(html).toContain('story-input__queued-count');
    expect(html).not.toContain('class="story-input__action is-send"');
  });

  it("allows continuing with no queued player action", () => {
    const html = renderToStaticMarkup(
      <InputBar value="" onChange={() => {}} onSubmit={() => {}} onRun={() => {}} queuedCount={0} loading={false} />,
    );

    expect(html).toContain('aria-label="Continue story without a new action"');
  });

  it("keeps an earned advancement visible above chat and uses the generated icon", () => {
    const html = renderToStaticMarkup(
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
    const html = renderToStaticMarkup(
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
});
