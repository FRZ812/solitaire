// @vitest-environment jsdom
import React, { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { claimRunReward, createArcticKnightGatekeeperRun, resolveRunCommand } from "../../gameplay/run/state.js";
import { ReferenceCombatView } from "./ReferenceCombatView.jsx";

function command(run, actionId, targetId) {
  return {
    expectedRunSequence: run.sequence,
    type: "use-action",
    actorId: run.encounter.playerId,
    actionId,
    targetId,
  };
}

function rewardRun() {
  let run = createArcticKnightGatekeeperRun({
    runId: "ui-preview",
    seed: "ui-seed",
  });
  while (run.phase === "encounter") {
    const evasion = run.encounter.actors[run.encounter.playerId].skills
      .find(({ id }) => id === "emergency-evasion");
    if (evasion.usesRemaining > 0) {
      run = resolveRunCommand(run, {
        expectedRunSequence: run.sequence,
        type: "use-skill",
        actorId: run.encounter.playerId,
        skillId: "emergency-evasion",
        targetId: run.encounter.playerId,
      }).state;
    }
    run = resolveRunCommand(run, command(run, "basic-attack", "gatekeeper")).state;
  }
  return run;
}

describe("ReferenceCombatView", () => {
  function ReducerHarness({ initialRun }) {
    const [run, setRun] = React.useState(initialRun);
    return (
      <ReferenceCombatView
        run={run}
        onCommand={(request) => setRun((current) => resolveRunCommand(current, request).state)}
        onRefresh={vi.fn()}
        onClaim={vi.fn()}
        onExit={vi.fn()}
      />
    );
  }

  it("renders explicit intent, actions, and finite skill state without deck or AP mechanics", () => {
    const run = createArcticKnightGatekeeperRun({ runId: "ui", seed: 1447 });
    const html = renderToStaticMarkup(
      <ReferenceCombatView
        run={run}
        onCommand={vi.fn()}
        onRefresh={vi.fn()}
        onClaim={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    expect(html).toContain("The Gatekeeper");
    expect(html).toContain("Declared intent");
    expect(html).toMatch(/Gatekeeper (Strike|Sweeping Strike)/);
    expect(html).toContain("Attack");
    expect(html).toContain("Defense");
    expect(html).toContain("Emergency Evasion");
    expect(html).toContain("4 uses left");
    expect(html).toContain("Sleep Bomb");
    expect(html).toContain("Ready");
    expect(html).toContain("Developer sandbox");
    expect(html).toContain("browser cache and server durability follow autosave and can fail");
    expect(html).toContain("Leave trial");
    expect(html).not.toContain("Save &amp; leave");
    expect(html).not.toContain("Deck");
    expect(html).not.toContain("Action points");
    expect(html).toContain('aria-label="Arctic Knight vitality"');
    expect(html).toContain('aria-label="The Gatekeeper vitality"');
    expect(html).toContain('role="status"');
    expect(html).toContain("Reference trial view: Encounter");
    expect(html).toContain("Current build");
    expect(html).toContain("<span>Attack</span> <b>8</b>");
    expect(html).toContain("<span>Defense</span> <b>2</b>");
    expect(html).toContain("No traits acquired");
    expect(html).toContain("No items equipped");
    expect(html).toContain("No active fusions");
  });

  it("surfaces rejected transitions and persistence failures inside the modal", () => {
    const html = renderToStaticMarkup(
      <ReferenceCombatView
        run={createArcticKnightGatekeeperRun({ runId: "ui-feedback", seed: 1447 })}
        feedback="Move rejected: stale run state."
        onCommand={vi.fn()}
        onRefresh={vi.fn()}
        onClaim={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Move rejected: stale run state.");
  });

  it("renders the provisional-baseline three-choice reward draft and refresh budget", () => {
    const run = rewardRun();
    const html = renderToStaticMarkup(
      <ReferenceCombatView
        run={run}
        onCommand={vi.fn()}
        onRefresh={vi.fn()}
        onClaim={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    expect(html).toContain("Choose one reward");
    for (const rewardId of run.rewardOffer.choices) {
      expect(html).toContain(rewardId);
    }
    expect(html).toContain("Refresh · 1 remaining");
    expect(html).toContain(`Offer revision ${run.rewardOffer.revision}`);
  });

  it("emits optimistic run and offer revisions from interactive controls", () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);
    const onCommand = vi.fn();
    const onRefresh = vi.fn();
    const onClaim = vi.fn();
    const onExit = vi.fn();
    const run = createArcticKnightGatekeeperRun({ runId: "ui-events", seed: 1447 });

    act(() => root.render(
      <ReferenceCombatView
        run={run}
        onCommand={onCommand}
        onRefresh={onRefresh}
        onClaim={onClaim}
        onExit={onExit}
      />,
    ));
    const attack = [...container.querySelectorAll("button")]
      .find((button) => button.textContent.includes("Attack"));
    act(() => attack.click());
    expect(onCommand).toHaveBeenCalledWith({
      expectedRunSequence: run.sequence,
      type: "use-action",
      actorId: run.encounter.playerId,
      actionId: "basic-attack",
      targetId: run.encounter.enemyIds[0],
    });
    const emergencyEvasion = [...container.querySelectorAll("button")]
      .find((button) => button.textContent.includes("Emergency Evasion"));
    act(() => emergencyEvasion.click());
    expect(onCommand).toHaveBeenNthCalledWith(2, {
      expectedRunSequence: run.sequence,
      type: "use-skill",
      actorId: run.encounter.playerId,
      skillId: "emergency-evasion",
      targetId: run.encounter.playerId,
    });
    const leave = [...container.querySelectorAll("button")]
      .find((button) => button.textContent.includes("Leave trial"));
    act(() => leave.click());
    expect(onExit).toHaveBeenCalledOnce();

    const offered = rewardRun();
    act(() => root.render(
      <ReferenceCombatView
        run={offered}
        onCommand={onCommand}
        onRefresh={onRefresh}
        onClaim={onClaim}
        onExit={vi.fn()}
      />,
    ));
    const refresh = [...container.querySelectorAll("button")]
      .find((button) => button.textContent.includes("Refresh"));
    act(() => refresh.click());
    expect(onRefresh).toHaveBeenCalledWith({
      offerId: offered.rewardOffer.offerId,
      expectedRevision: offered.rewardOffer.revision,
      expectedRunSequence: offered.sequence,
    });

    const reward = [...container.querySelectorAll("button")]
      .find((button) => button.textContent.includes(offered.rewardOffer.choices[0]));
    act(() => reward.click());
    expect(onClaim).toHaveBeenCalledWith({
      offerId: offered.rewardOffer.offerId,
      expectedRevision: offered.rewardOffer.revision,
      expectedRunSequence: offered.sequence,
      rewardId: offered.rewardOffer.choices[0],
    });
    act(() => root.unmount());
  });

  it("drives the real run reducer and announces defense and damage outcomes", () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);
    const run = createArcticKnightGatekeeperRun({ runId: "ui-reducer", seed: 1447 });

    act(() => root.render(<ReducerHarness initialRun={run} />));
    const defend = [...container.querySelectorAll("button")]
      .find((button) => button.textContent.includes("Defense"));
    act(() => defend.click());

    const trace = container.querySelector('[aria-label="Encounter event trace"]');
    expect(trace.textContent).toContain("Arctic Knight gains 5 guard.");
    expect(trace.textContent).toMatch(/The Gatekeeper deals \d+ damage to Arctic Knight\./);
    expect(trace.querySelector('[aria-live="polite"]')).not.toBeNull();
    act(() => root.unmount());
  });

  it("traps keyboard focus inside the replacement view and restores the launcher focus", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const launcher = document.createElement("button");
    launcher.textContent = "Open trial";
    const container = document.createElement("div");
    document.body.append(launcher, container);
    launcher.focus();
    const root = createRoot(container);
    const run = createArcticKnightGatekeeperRun({ runId: "ui-focus", seed: 1447 });

    act(() => root.render(
      <ReferenceCombatView
        run={run}
        onCommand={vi.fn()}
        onRefresh={vi.fn()}
        onClaim={vi.fn()}
        onExit={vi.fn()}
      />,
    ));
    const view = container.querySelector('[role="dialog"]');
    const focusable = [...view.querySelectorAll("button:not(:disabled), summary")];
    expect(view.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(view);

    focusable.at(-1).focus();
    focusable.at(-1).dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(focusable[0]);
    focusable[0].focus();
    focusable[0].dispatchEvent(new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
    }));
    expect(document.activeElement).toBe(focusable.at(-1));

    act(() => root.render(
      <ReferenceCombatView
        run={rewardRun()}
        onCommand={vi.fn()}
        onRefresh={vi.fn()}
        onClaim={vi.fn()}
        onExit={vi.fn()}
      />,
    ));
    expect(document.activeElement).toBe(view);
    expect(view.textContent).toContain("Choose one reward");

    act(() => root.unmount());
    await act(async () => { await Promise.resolve(); });
    expect(document.activeElement).toBe(launcher);
    launcher.remove();
    container.remove();
  });

  it("renders an explicit evidence gap when a refreshable reward draft is unavailable", () => {
    const gap = JSON.parse(JSON.stringify(rewardRun()));
    gap.phase = "content-gap";
    gap.status = "blocked";
    gap.rewardOffer = null;
    const html = renderToStaticMarkup(
      <ReferenceCombatView
        run={gap}
        onCommand={vi.fn()}
        onRefresh={vi.fn()}
        onClaim={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    expect(html).toContain("Reward eligibility is exhausted");
    expect(html).toContain("without inventing rewards");
  });

  it("renders settled run state after optimistic reward application", () => {
    const offered = rewardRun();
    const rewardId = offered.rewardOffer.choices[0];
    const complete = claimRunReward(offered, {
      offerId: offered.rewardOffer.offerId,
      expectedRevision: offered.rewardOffer.revision,
      expectedRunSequence: offered.sequence,
      rewardId,
    }).state;
    const html = renderToStaticMarkup(
      <ReferenceCombatView
        run={complete}
        onCommand={vi.fn()}
        onRefresh={vi.fn()}
        onClaim={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    expect(html).toContain("Gatekeeper trial complete");
    expect(html).toContain("Preview reward recorded only in this reference trial");
    expect(html).toContain("Browser and server persistence may still be pending");
    expect(html).not.toContain("Reward applied to this reference run");
    expect(html).toContain("Further Act 1 content remains unresolved");
    expect(html).toContain(rewardId);
    expect(html).toContain("Return to Solitaire");
  });
});
