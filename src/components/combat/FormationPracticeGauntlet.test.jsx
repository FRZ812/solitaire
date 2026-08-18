// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { compileCharacterBootstrap } from "../../gameplay/tow/character-bootstrap.js";
import {
  createPracticeSession,
  getPracticeAllyGroup,
  getPracticeScenario,
} from "../../gameplay/tow/practice-scenarios.js";
import { legalSkillAnchors, resolveSkillTargets } from "../../gameplay/tow/targeting.js";
import { PracticeFight } from "../creation/PracticeFight.jsx";
import { TowCombatView } from "./TowCombatView.jsx";

let root;
let container;
let originalMatchMedia;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  originalMatchMedia = globalThis.matchMedia;
  globalThis.matchMedia = (query) => ({
    matches: query === "(prefers-reduced-motion: reduce)",
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.clearAllTimers();
  vi.useRealTimers();
});

afterAll(() => {
  if (originalMatchMedia) globalThis.matchMedia = originalMatchMedia;
  else delete globalThis.matchMedia;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

function receiptFor(archetypeId) {
  const compiled = compileCharacterBootstrap({ archetypeId, origin: "archetype" });
  expect(compiled.ok).toBe(true);
  return compiled.receipt;
}

async function render(element) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(element));
  return container;
}

async function click(element) {
  expect(element).toBeTruthy();
  await act(async () => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

function cellsFor(mounted, side) {
  return [...mounted.querySelectorAll(`.tow-formation-cell[data-side='${side}']`)];
}

function actionableButton(mounted) {
  return [...mounted.querySelectorAll(".production-combat__action")]
    .find((button) => !button.disabled && button.getAttribute("aria-disabled") !== "true");
}

async function chooseAndConfirm(mounted, action) {
  await click(action);
  const confirmation = mounted.querySelector("[data-testid='tow-target-confirmation']");
  if (!confirmation) return false;

  let commit = confirmation.querySelector(".tow-combat__target-commit");
  if (commit.disabled) {
    const anchor = [...mounted.querySelectorAll(".tow-formation-cell.is-valid-anchor")]
      .find((cell) => !cell.disabled);
    expect(anchor).toBeTruthy();
    await click(anchor);
    const revisedConfirmation = mounted.querySelector("[data-testid='tow-target-confirmation']");
    if (!revisedConfirmation) return false;
    commit = revisedConfirmation.querySelector(".tow-combat__target-commit");
  }
  expect(commit.disabled).toBe(false);
  await click(commit);
  return true;
}

function visibleVitalSnapshot(mounted) {
  return [...mounted.querySelectorAll(".tow-formation-cell.has-unit")]
    .map((cell) => ({
      side: cell.dataset.side,
      index: Number(cell.dataset.cellIndex),
      values: [...cell.querySelectorAll(".tow-formation-unit__meter-value")]
        .map((value) => value.textContent.trim()),
    }))
    .sort((left, right) => (
      left.side.localeCompare(right.side) || left.index - right.index
    ));
}

describe("formation practice combat gauntlet", () => {
  it("presents a bounded 3v3 field with exact vitals and actor-owned accessible intents", async () => {
    const receipt = receiptFor("knight");
    const allyGroup = getPracticeAllyGroup("expedition-trio");
    const scenario = getPracticeScenario("formation-drill");
    const practice = createPracticeSession(receipt, scenario.id, 0, {
      allyGroupId: allyGroup.id,
    });
    expect(practice.ok).toBe(true);

    const mounted = await render(
      <PracticeFight
        receipt={receipt}
        scenarioId={scenario.id}
        allyGroupId={allyGroup.id}
        onExit={() => {}}
      />,
    );

    const battlefield = mounted.querySelector("[aria-label='Battle formations']");
    const occupiedActorCount = 1 + allyGroup.allies.length + scenario.enemies.length;
    expect(battlefield).toBeTruthy();
    expect(battlefield.querySelectorAll(".tow-formation-unit")).toHaveLength(occupiedActorCount);

    for (const side of ["enemy", "player"]) {
      const grid = battlefield.querySelector(`[aria-label='${side === "enemy" ? "Enemy" : "Player"} formation']`);
      const cells = cellsFor(battlefield, side);
      const occupied = cells.filter((cell) => cell.classList.contains("has-unit"));
      const empty = cells.filter((cell) => cell.classList.contains("is-empty"));

      expect(grid).toBeTruthy();
      expect(cells).toHaveLength(9);
      expect(cells.map((cell) => Number(cell.dataset.cellIndex))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
      expect(cells.every((cell) => (
        Number(cell.dataset.row) >= 0
        && Number(cell.dataset.row) <= 2
        && Number(cell.dataset.column) >= 0
        && Number(cell.dataset.column) <= 2
      ))).toBe(true);
      expect(occupied).toHaveLength(3);
      expect(empty).toHaveLength(6);
      expect(occupied.every((cell) => cell.querySelectorAll(":scope > .tow-formation-unit").length === 1))
        .toBe(true);
      expect(empty.every((cell) => !cell.querySelector(".tow-formation-unit"))).toBe(true);
    }

    const occupied = [...battlefield.querySelectorAll(".tow-formation-cell.has-unit")];
    for (const cell of occupied) {
      const meters = [...cell.querySelectorAll("[role='meter']")];
      expect(meters).toHaveLength(2);
      expect(cell.querySelector(".tow-formation-unit__figure img")).toBeTruthy();
      for (const meter of meters) {
        const current = meter.getAttribute("aria-valuenow");
        const maximum = meter.getAttribute("aria-valuemax");
        expect(meter.querySelector(".tow-formation-unit__meter-label")?.textContent).toMatch(/^(?:HP|RP)$/);
        expect(meter.querySelector(".tow-formation-unit__meter-value")?.textContent.trim())
          .toBe(`${current}/${maximum}`);
        expect(cell.getAttribute("aria-label")).toContain(current);
      }
    }

    const intents = [...battlefield.querySelectorAll("[data-testid='tow-enemy-intent']")];
    expect(mounted.querySelector("[aria-label='Enemy intentions']")).toBeNull();
    expect(intents).toHaveLength(scenario.enemies.length);
    for (const intent of intents) {
      const sourceId = intent.dataset.enemyId;
      const source = practice.session.encounter.actors[sourceId];
      expect(source).toBeTruthy();
      expect(intent.getAttribute("role")).toBe("img");
      expect(intent.getAttribute("aria-label")).toContain(source.name);
      expect(intent.getAttribute("aria-label")).toMatch(/(?:damage|effect).*(?:targeting|used on)/i);
      expect(intent.closest(".tow-formation-grid")?.getAttribute("aria-label"))
        .toBe("Enemy formation");
      expect(intent.closest(".tow-formation-cell")?.classList.contains("has-unit")).toBe(true);
    }
  });

  it("switches commanders, auto-commits one recipient, and confirms a multi-recipient footprint", async () => {
    vi.useFakeTimers();
    const receipt = receiptFor("berserker");
    const encounter = createPracticeSession(receipt, "formation-drill", 0, {
      allyGroupId: "expedition-trio",
    }).session.encounter;
    const onUseSkill = vi.fn();
    const mounted = await render(
      <TowCombatView
        encounter={encounter}
        onUseSkill={onUseSkill}
        onStandDown={() => {}}
        onSettle={() => {}}
      />,
    );

    const berserkerSkills = encounter.build.skills.map((skill) => skill.id);
    expect([...mounted.querySelectorAll(".production-combat__action")]
      .map((button) => button.dataset.skillId)).toEqual(berserkerSkills);

    const paladin = encounter.actors["practice-ally-paladin"];
    const paladinCell = cellsFor(mounted, "player")
      .find((cell) => cell.getAttribute("aria-label").includes(paladin.name));
    await click(paladinCell);
    expect(mounted.querySelector("[data-testid='tow-combat-dossier']").textContent)
      .toContain(paladin.name);
    expect([...mounted.querySelectorAll(".production-combat__action")]
      .map((button) => button.dataset.skillId))
      .toEqual(encounter.allyBuilds[paladin.id].skills.map((skill) => skill.id));
    await click(mounted.querySelector("[data-testid='tow-combat-dossier'] button[aria-label^='Close ']"));

    const playerCell = cellsFor(mounted, "player")
      .find((cell) => cell.getAttribute("aria-label").includes(encounter.actors[encounter.playerId].name));
    await click(playerCell);
    await click(mounted.querySelector("[data-testid='tow-combat-dossier'] button[aria-label^='Close ']"));

    const singleSkillId = "north-king-cleave";
    const singleAnchor = legalSkillAnchors(encounter, singleSkillId, encounter.playerId);
    const singlePreview = resolveSkillTargets(encounter, singleSkillId, encounter.playerId, {
      anchorCell: singleAnchor[0],
    });
    expect(singleAnchor).toHaveLength(1);
    expect(singlePreview.targetIds).toHaveLength(1);
    await click(mounted.querySelector(`[data-skill-id='${singleSkillId}']`));
    expect(mounted.querySelector("[data-testid='tow-target-confirmation']")).toBeNull();
    await act(async () => vi.runAllTimersAsync());
    expect(onUseSkill).toHaveBeenLastCalledWith(
      singleSkillId,
      singlePreview.primaryTargetId,
      encounter.playerId,
      singleAnchor[0],
    );

    const areaSkillId = "north-king-earthquake";
    const areaAnchor = legalSkillAnchors(encounter, areaSkillId, encounter.playerId);
    const areaPreview = resolveSkillTargets(encounter, areaSkillId, encounter.playerId, {
      anchorCell: areaAnchor[0],
    });
    expect(areaAnchor).toHaveLength(1);
    expect(areaPreview.targetIds).toHaveLength(3);
    await click(mounted.querySelector(`[data-skill-id='${areaSkillId}']`));
    const confirmation = mounted.querySelector("[data-testid='tow-target-confirmation']");
    expect(confirmation).toBeTruthy();
    expect(confirmation.textContent).toContain("3 targets");
    expect(confirmation.querySelector(".tow-combat__target-commit").disabled).toBe(false);
    expect(mounted.querySelectorAll(".tow-formation-cell.is-affected"))
      .toHaveLength(areaPreview.affectedCells.length);
    expect(onUseSkill).toHaveBeenCalledTimes(1);
    await click(confirmation.querySelector(".tow-combat__target-commit"));
    await act(async () => vi.runAllTimersAsync());
    expect(onUseSkill).toHaveBeenLastCalledWith(
      areaSkillId,
      areaPreview.primaryTargetId,
      encounter.playerId,
      areaAnchor[0],
    );
  });

  it("survives repeated party and enemy exchanges without desync, then restores the same fight on retry", async () => {
    vi.useFakeTimers();
    const receipt = receiptFor("knight");
    const mounted = await render(
      <PracticeFight
        receipt={receipt}
        scenarioId="formation-drill"
        allyGroupId="expedition-trio"
        onExit={() => {}}
      />,
    );
    const openingVitals = visibleVitalSnapshot(mounted);
    const roundsSeen = new Set([1]);
    let committedActions = 0;

    for (let step = 0; step < 120 && mounted.querySelector(".tow-combat"); step += 1) {
      const action = actionableButton(mounted);
      if (action) {
        await chooseAndConfirm(mounted, action);
        committedActions += 1;
      }
      await act(async () => vi.runAllTimersAsync());

      const alert = mounted.querySelector(".tow-combat__alert[role='alert']");
      expect(alert?.textContent || "").not.toMatch(/refused|auto-advance|intent-desync/i);
      const round = Number(mounted.querySelector(".tow-combat__round > strong")?.textContent);
      if (Number.isSafeInteger(round)) roundsSeen.add(round);
    }

    expect(committedActions).toBeGreaterThanOrEqual(6);
    expect(Math.max(...roundsSeen)).toBeGreaterThanOrEqual(3);
    const result = mounted.querySelector(".practice-fight--result");
    expect(result).toBeTruthy();
    expect(result.querySelector(".practice-fight__receipt").textContent).toContain("verified");
    expect(result.querySelector(".practice-fight__receipt").textContent).toContain("Expedition trio");
    expect(result.querySelectorAll(".practice-fight__actions button")).toHaveLength(3);

    await click([...result.querySelectorAll("button")]
      .find((button) => button.textContent.trim() === "Retry same seed"));
    const retried = mounted.querySelector(".tow-combat");
    expect(retried).toBeTruthy();
    expect(retried.querySelector(".tow-combat__round > strong").textContent).toBe("1");
    expect(visibleVitalSnapshot(retried)).toEqual(openingVitals);
    expect(retried.querySelector(".tow-combat__alert")).toBeNull();
  }, 30_000);
});
