// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { openLabSession } from "./CombatLab.jsx";
import { TowCombatView } from "./TowCombatView.jsx";
import { resolveTowAbilityArt } from "./tow-combat-ability-art.js";
import {
  createSkillState,
  getSkill,
  maxRankOf,
} from "../../gameplay/tow/skills.js";
import {
  encounterFormations,
  formationCellForActor,
  legalSkillAnchors,
  resolveSkillTargets,
} from "../../gameplay/tow/targeting.js";

let root;
let container;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.useRealTimers();
});

async function renderView(props = {}) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const encounter = openLabSession({ packageId: "rogue", scenarioId: "training-yard" }).session.encounter;
  await act(async () => root.render(
    <TowCombatView
      encounter={encounter}
      onUseSkill={() => {}}
      onStandDown={() => {}}
      onSettle={() => {}}
      {...props}
    />,
  ));
  return container;
}

function viewElement(encounter, props = {}) {
  return (
    <TowCombatView
      encounter={encounter}
      onUseSkill={() => {}}
      onStandDown={() => {}}
      onSettle={() => {}}
      {...props}
    />
  );
}

function cellElement(mounted, { side, index }) {
  return mounted.querySelector(
    `.tow-formation-cell[data-side='${side}'][data-cell-index='${index}']`,
  );
}

function cellCoordinates(elements) {
  return elements.map((element) => ({
    side: element.dataset.side,
    index: Number(element.dataset.cellIndex),
  }));
}

function replaceSkill(encounter, replacedId, skillId, rank = 1) {
  return {
    ...encounter,
    build: {
      ...encounter.build,
      skills: encounter.build.skills.map((state) => (
        state.id === replacedId ? createSkillState(skillId, rank) : state
      )),
    },
  };
}

describe("compact combat HUD", () => {
  it("keeps full-art abilities clean while showing Resolve prices at the lower right", async () => {
    const mounted = await renderView();
    const actions = [...mounted.querySelectorAll(".tow-combat__action")];
    const strike = mounted.querySelector("[data-skill-id='strike']");
    const block = mounted.querySelector("[data-skill-id='block']");
    const evasion = mounted.querySelector("[data-skill-id='emergency-evasion']");
    expect(actions.length).toBeGreaterThan(1);
    expect(actions.every((action) => action.querySelector(".tow-combat__ability-art img"))).toBe(true);
    expect(mounted.querySelector(".tow-combat__ability-art-name")).toBeNull();
    expect(mounted.querySelector(".tow-combat__action-charge")).toBeNull();
    expect(mounted.querySelector(".tow-combat__action-swift")).toBeNull();
    expect(strike.querySelector(".tow-combat__action-cost")).toBeNull();
    expect(block.querySelector(".tow-combat__action-cost")?.textContent).toBe("1RP");
    expect(evasion.querySelector(".tow-combat__action-cost")?.textContent).toBe("4RP");
    expect(block.getAttribute("aria-label")).toMatch(/1 Resolve/i);
    expect(actions.map((action) => action.textContent).join("")).not.toContain("∞");
    expect(actions.every((action) => action.querySelector(".tow-combat__sr-only")?.textContent)).toBe(true);
    expect(actions.every((action) => action.classList.contains("production-combat__action"))).toBe(true);
    const resolve = mounted.querySelector(".tow-formation-unit__meter--resolve[role='meter']");
    expect(resolve).toBeTruthy();
    expect(resolve.getAttribute("aria-label")).toMatch(/Resolve$/);
    expect(resolve.getAttribute("aria-valuenow")).toBe(resolve.getAttribute("aria-valuemax"));
  });

  it("shows captured charges only while resuming a legacy encounter", async () => {
    const base = openLabSession({ packageId: "fighter", scenarioId: "training-yard" }).session.encounter;
    const { resolve: _resolve, resolveMax: _resolveMax, ...legacyPlayer } = base.actors[base.playerId];
    const legacy = {
      ...base,
      actors: { ...base.actors, [base.playerId]: legacyPlayer },
      build: {
        ...base.build,
        skills: base.build.skills.map((skill) => (
          skill.id === "block" ? { ...skill, usesRemaining: 2 } : skill
        )),
      },
    };
    const mounted = await renderView({ encounter: legacy });
    const block = mounted.querySelector("[data-skill-id='block']");
    expect(block.querySelector(".tow-combat__action-cost--legacy")?.textContent).toBe("2/30");
    expect(block.getAttribute("aria-label")).toMatch(/2 of 30 legacy uses remaining/i);
    expect(mounted.querySelector(`[aria-label='${legacyPlayer.name} Resolve']`)).toBeNull();
  });

  it("darkens a cooling skill and gives its centered cooldown precedence over uses", async () => {
    const base = openLabSession({ packageId: "wizard", scenarioId: "training-yard" }).session.encounter;
    const withRapidCooling = (cooldownRemaining) => ({
      ...base,
      build: {
        ...base.build,
        skills: base.build.skills.map((skill) => (
          skill.id === "rapid-cooling"
            ? { ...skill, usesRemaining: 4, cooldownRemaining }
            : skill
        )),
      },
    });

    const mounted = await renderView({ encounter: withRapidCooling(2) });
    let cooling = mounted.querySelector("[data-skill-id='rapid-cooling']");
    expect(cooling.classList.contains("is-on-cooldown")).toBe(true);
    expect(cooling.querySelector(".tow-combat__action-cooldown")?.textContent).toBe("2");
    expect(cooling.querySelector(".tow-combat__action-cost")).toBeNull();
    expect(cooling.getAttribute("aria-label")).toMatch(/Cooldown, 2 turns remaining/i);

    await act(async () => root.render(viewElement(withRapidCooling(0))));
    cooling = mounted.querySelector("[data-skill-id='rapid-cooling']");
    expect(cooling.classList.contains("is-on-cooldown")).toBe(false);
    expect(cooling.querySelector(".tow-combat__action-cooldown")).toBeNull();
    expect(cooling.querySelector(".tow-combat__action-cost")?.textContent).toBe("3RP");
  });

  it("offers the snapshotted keepsake as a one-action satchel command", async () => {
    const base = openLabSession({ packageId: "rogue", scenarioId: "training-yard" }).session.encounter;
    const encounter = {
      ...base,
      build: { ...base.build, combatItems: [{ id: "fire-pot", quantity: 1 }] },
    };
    const onUseItem = vi.fn();
    const mounted = await renderView({ encounter, onUseItem });
    const trigger = mounted.querySelector(".tow-combat__satchel-trigger");
    expect(trigger.getAttribute("aria-label")).toContain("1 consumable carried");
    expect(mounted.querySelector(".tow-combat__satchel-panel")).toBeNull();
    await act(async () => trigger.click());
    const item = mounted.querySelector(".tow-combat__satchel-item");
    expect(item.textContent).toContain("Fire Pot");
    expect(item.textContent).toContain("150% ATK");
    expect(item.querySelector(".tow-combat__satchel-art img")?.getAttribute("src"))
      .toMatch(/fire-pot-v1\.webp$/);
    await act(async () => item.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onUseItem).toHaveBeenCalledWith("fire-pot", "foe-0", "wanderer");
    expect(mounted.querySelector(".tow-combat__satchel-panel")).toBeNull();
  });

  it("keeps a growing consumable inventory behind one compact bag trigger", async () => {
    const base = openLabSession({ packageId: "rogue", scenarioId: "training-yard" }).session.encounter;
    const encounter = {
      ...base,
      build: {
        ...base.build,
        combatItems: [
          { id: "crimson-vial", quantity: 2 },
          { id: "lucid-tonic", quantity: 1 },
          { id: "warding-ash", quantity: 3 },
          { id: "fire-pot", quantity: 1 },
        ],
      },
    };
    const mounted = await renderView({ encounter, onUseItem: vi.fn() });
    expect(mounted.querySelectorAll(".tow-combat__satchel-trigger")).toHaveLength(1);
    expect(mounted.querySelector(".tow-combat__satchel-trigger").textContent).toBe("7");
    await act(async () => mounted.querySelector(".tow-combat__satchel-trigger").click());
    expect(mounted.querySelectorAll(".tow-combat__satchel-item")).toHaveLength(4);
    expect(mounted.querySelector(".tow-combat__satchel-panel header").textContent)
      .toContain("4 kinds · 7 total");
  });

  it("moves the incoming attack to one compact intent rail and marks its formation cell", async () => {
    const encounter = openLabSession({ packageId: "rogue", scenarioId: "training-yard" }).session.encounter;
    const mounted = await renderView({ encounter });
    const intent = mounted.querySelector("[data-testid='tow-enemy-intent']");
    expect(intent).toBeTruthy();
    expect(intent.closest(".tow-combat__formation-intents")).toBeTruthy();
    const intentArt = intent.querySelector(".tow-combat__intent-sigil img");
    expect(intentArt).toBeTruthy();
    const abilityId = intent.getAttribute("data-ability-id");
    expect(intentArt.getAttribute("src")).toBe(resolveTowAbilityArt(getSkill(abilityId)));
    expect(intentArt.getAttribute("src")).not.toContain("svg");
    expect(intent.getAttribute("aria-label")).toMatch(/(?:damage|hits of).*targeting/i);
    expect(intent.querySelector(".tow-combat__intent-target")?.textContent).toMatch(/^→\s+/);
    expect(intent.querySelector(".tow-combat__intent-name")?.textContent.length).toBeGreaterThan(0);
    expect(mounted.querySelector(".tow-combat__telegraph")).toBeNull();
    expect(mounted.querySelector(".tow-combat__incoming")).toBeNull();
    expect(mounted.querySelector(".tow-combat__exchange")).toBeNull();
    const targetCell = formationCellForActor(encounter, encounter.playerId);
    expect(targetCell).toBeTruthy();
    expect(cellElement(mounted, targetCell).classList.contains("is-intent-target")).toBe(true);
  });

  it("reads a defensive enemy declaration as ward on self instead of fake damage", async () => {
    const base = openLabSession({ packageId: "rogue", scenarioId: "training-yard" }).session.encounter;
    const enemyId = base.enemyIds[0];
    const block = base.enemyAttacks[enemyId].find((entry) => entry.skillId === "arctic-block");
    const next = {
      ...base,
      intents: {
        ...base.intents,
        [enemyId]: { ...base.intents[enemyId], attackId: block.id, targetId: enemyId },
      },
    };
    const mounted = await renderView({ encounter: next });
    const intent = mounted.querySelector("[data-testid='tow-enemy-intent']");
    expect(intent.getAttribute("aria-label")).toMatch(/Block, ward effect, used on self/i);
    expect(intent.querySelector("strong").textContent).toBe("WARD");
    expect(intent.querySelector(".tow-combat__intent-target").textContent).toBe("Self");
  });

  it("renders two logical 3x3 formations with compact HP and Resolve on occupied cells", async () => {
    const encounter = openLabSession({ packageId: "rogue", scenarioId: "training-yard" }).session.encounter;
    const mounted = await renderView({ encounter });
    const cells = [...mounted.querySelectorAll(".tow-formation-cell")];
    const occupied = cells.filter((cell) => cell.classList.contains("has-unit"));
    const empty = cells.filter((cell) => cell.classList.contains("is-empty"));
    const expectedOccupied = 1 + encounter.allyIds.length + encounter.enemyIds.length;

    expect(cells).toHaveLength(18);
    expect(occupied).toHaveLength(expectedOccupied);
    expect(empty).toHaveLength(18 - expectedOccupied);
    expect(occupied.every((cell) => (
      cell.querySelectorAll(".tow-formation-unit__meter--hp[role='meter']").length === 1
      && cell.querySelectorAll(".tow-formation-unit__meter--resolve[role='meter']").length === 1
    ))).toBe(true);
    expect(occupied.every((cell) => cell.querySelector(".tow-formation-unit__figure"))).toBe(true);
    expect(empty.every((cell) => [
      "is-valid-anchor",
      "is-affected",
      "is-selected-anchor",
      "is-intent-target",
    ].every((state) => !cell.classList.contains(state)))).toBe(true);
  });

  it("reveals only exact legal anchors, previews an empty area cell, and clears them on Cancel", async () => {
    const base = openLabSession({ packageId: "rogue", scenarioId: "training-yard" }).session.encounter;
    const encounter = replaceSkill(base, "emergency-evasion", "north-king-whirlwind");
    const formations = encounterFormations(encounter);
    const expectedAnchors = legalSkillAnchors(
      encounter,
      "north-king-whirlwind",
      encounter.playerId,
    );
    const emptyAnchor = expectedAnchors.find(({ side, index }) => !formations[side][index]);
    const mounted = await renderView({ encounter, onUseSkill: vi.fn() });

    expect(emptyAnchor).toBeTruthy();
    expect(mounted.querySelectorAll(".tow-formation-cell.is-valid-anchor")).toHaveLength(0);
    await act(async () => mounted.querySelector("[data-skill-id='north-king-whirlwind']").click());

    expect(mounted.querySelector("[data-testid='tow-target-confirmation']")).toBeTruthy();
    expect(cellCoordinates([...mounted.querySelectorAll(".tow-formation-cell.is-valid-anchor")]))
      .toEqual(expectedAnchors);
    expect(mounted.querySelector(".tow-combat__target-commit").disabled).toBe(true);

    await act(async () => cellElement(mounted, emptyAnchor).click());
    const preview = resolveSkillTargets(
      encounter,
      "north-king-whirlwind",
      encounter.playerId,
      { anchorCell: emptyAnchor },
    );
    expect(cellElement(mounted, emptyAnchor).classList.contains("is-selected-anchor")).toBe(true);
    expect(cellCoordinates([...mounted.querySelectorAll(".tow-formation-cell.is-affected")]))
      .toEqual(preview.affectedCells);
    expect(mounted.querySelector(".tow-combat__target-commit").disabled).toBe(false);

    await act(async () => mounted.querySelector(".tow-combat__target-cancel").click());
    expect(mounted.querySelector("[data-testid='tow-target-confirmation']")).toBeNull();
    expect(mounted.querySelectorAll(
      ".tow-formation-cell.is-valid-anchor, .tow-formation-cell.is-affected, .tow-formation-cell.is-selected-anchor",
    )).toHaveLength(0);
  });

  it("keeps a single-anchor multi-recipient ability behind footprint confirmation", async () => {
    const base = openLabSession({ packageId: "rogue", scenarioId: "training-yard" }).session.encounter;
    const skillId = "north-king-natures-intervention";
    const encounter = replaceSkill(base, "emergency-evasion", skillId);
    const anchors = legalSkillAnchors(encounter, skillId, encounter.playerId);
    const preview = resolveSkillTargets(
      encounter,
      skillId,
      encounter.playerId,
      { anchorCell: anchors[0] },
    );
    const onUseSkill = vi.fn();
    const mounted = await renderView({ encounter, onUseSkill });

    expect(anchors).toHaveLength(1);
    expect(preview.ok).toBe(true);
    expect(preview.targetIds).toHaveLength(2);

    await act(async () => mounted.querySelector(`[data-skill-id='${skillId}']`).click());

    expect(onUseSkill).not.toHaveBeenCalled();
    expect(mounted.querySelector("[data-testid='tow-target-confirmation']")).toBeTruthy();
    expect(mounted.querySelector(".tow-combat__target-commit").disabled).toBe(false);
    const affectedCells = cellCoordinates([
      ...mounted.querySelectorAll(".tow-formation-cell.is-affected"),
    ]);
    expect(affectedCells).toHaveLength(preview.affectedCells.length);
    expect(affectedCells).toEqual(expect.arrayContaining(preview.affectedCells));
  });

  it("renders every multi-hit contact in its own staggered effect lane", async () => {
    const base = openLabSession({ packageId: "rogue", scenarioId: "training-yard" }).session.encounter;
    await renderView({ encounter: base });
    const sequence = base.sequence + 1;
    const next = {
      ...base,
      sequence,
      events: [
        ...base.events,
        {
          sequence,
          type: "skill-damage",
          actorId: base.playerId,
          targetId: base.enemyIds[0],
          skillId: "strike",
          hits: [
            { index: 0, damage: 4, toHp: 4, absorbed: 0, critical: false, dodged: false },
            { index: 1, damage: 5, toHp: 5, absorbed: 0, critical: false, dodged: false },
          ],
        },
      ],
    };
    await act(async () => root.render(viewElement(next)));

    const effects = [...container.querySelectorAll(".tow-combat__effect")];
    expect(effects).toHaveLength(2);
    expect(effects.map((effect) => effect.dataset.hitIndex)).toEqual(["0", "1"]);
    expect(effects.map((effect) => effect.dataset.hitCount)).toEqual(["2", "2"]);
    expect(effects.map((effect) => effect.dataset.effectLane)).toEqual(["0", "1"]);
    expect(effects.map((effect) => effect.style.getPropertyValue("--tow-effect-delay")))
      .toEqual(["0ms", "155ms"]);
    expect(effects.every((effect) => effect.dataset.vfxSource === "imagegen-flipbook")).toBe(true);
    expect(effects.map((effect) => effect.dataset.vfxChoreography)).toEqual([
      "combo-left",
      "combo-right",
    ]);
    expect(new Set(effects.map((effect) => effect.dataset.vfxSignature)).size).toBe(2);
    expect(effects.every((effect) => !effect.querySelector(".tow-combat__effect-asset"))).toBe(true);
    expect(effects.every((effect) => !effect.querySelector(".tow-combat__effect-signature"))).toBe(true);
    expect(container.querySelector("[data-testid='tow-combat-vfx-canvas']")).toMatchObject({
      dataset: expect.objectContaining({
        renderer: "imagegen-flipbook",
        frameCount: "9",
        fps: "18",
        cueCount: "2",
        flipbookCount: "2",
      }),
    });
  });

  it("drains health once per resolved hit instead of collapsing the total", async () => {
    vi.useFakeTimers();
    try {
      const base = openLabSession({ packageId: "rogue", scenarioId: "training-yard" }).session.encounter;
      const enemyId = base.enemyIds[0];
      const startingHp = base.actors[enemyId].hp;
      const mounted = await renderView({ encounter: base });
      const sequence = base.sequence + 1;
      const next = {
        ...base,
        sequence,
        actors: {
          ...base.actors,
          [enemyId]: { ...base.actors[enemyId], hp: startingHp - 9 },
        },
        events: [
          ...base.events,
          {
            sequence,
            type: "skill-damage",
            actorId: base.playerId,
            targetId: enemyId,
            skillId: "strike",
            hits: [
              { index: 0, damage: 4, toHp: 4, absorbed: 0, critical: false, dodged: false },
              { index: 1, damage: 5, toHp: 5, absorbed: 0, critical: false, dodged: false },
            ],
          },
        ],
      };

      await act(async () => root.render(viewElement(next)));
      const meter = mounted.querySelector(
        `.tow-formation-unit__meter--hp[aria-label='${base.actors[enemyId].name} health']`,
      );
      expect(meter.getAttribute("aria-valuenow")).toBe(String(startingHp));

      await act(async () => vi.advanceTimersByTime(150));
      expect(meter.getAttribute("aria-valuenow")).toBe(String(startingHp - 4));

      await act(async () => vi.advanceTimersByTime(155));
      expect(meter.getAttribute("aria-valuenow")).toBe(String(startingHp - 9));
    } finally {
      vi.useRealTimers();
    }
  });

  it("finishes a lethal action before revealing the combat outcome", async () => {
    vi.useFakeTimers();
    try {
      const base = openLabSession({ packageId: "rogue", scenarioId: "training-yard" }).session.encounter;
      const enemyId = base.enemyIds[0];
      const startingHp = base.actors[enemyId].hp;
      const firstHit = Math.min(4, startingHp);
      const secondHit = startingHp - firstHit;
      const mounted = await renderView({ encounter: base });
      const sequence = base.sequence + 1;
      const victory = {
        ...base,
        phase: "victory",
        sequence,
        actors: {
          ...base.actors,
          [enemyId]: { ...base.actors[enemyId], hp: 0 },
        },
        events: [
          ...base.events,
          {
            sequence,
            type: "skill-damage",
            actorId: base.playerId,
            targetId: enemyId,
            skillId: "strike",
            hits: [
              { index: 0, damage: firstHit, toHp: firstHit, absorbed: 0, critical: false, dodged: false },
              { index: 1, damage: secondHit, toHp: secondHit, absorbed: 0, critical: false, dodged: false },
            ],
          },
        ],
      };

      await act(async () => root.render(viewElement(victory)));
      const combat = mounted.querySelector(".tow-combat");
      const enemyCell = cellElement(mounted, formationCellForActor(base, enemyId));
      const enemyUnit = enemyCell.querySelector(".tow-formation-unit");
      expect(combat.dataset.presentationPhase).toBe("resolution-hold");
      expect(combat.getAttribute("aria-busy")).toBe("true");
      expect(mounted.querySelector(".tow-combat__outcome")).toBeNull();
      expect(mounted.querySelector(".tow-combat__command")).toBeTruthy();
      expect(mounted.querySelectorAll(".tow-combat__effect")).toHaveLength(2);
      expect(enemyUnit.classList.contains("is-down")).toBe(false);
      expect([...mounted.querySelectorAll(".tow-combat__action")].every((button) => button.disabled)).toBe(true);

      await act(async () => vi.advanceTimersByTime(1604));
      expect(mounted.querySelector(".tow-combat__outcome")).toBeNull();
      expect(enemyUnit.classList.contains("is-down")).toBe(true);

      await act(async () => vi.advanceTimersByTime(1));
      expect(mounted.querySelector(".tow-combat__outcome")).toBeTruthy();
      expect(enemyUnit.classList.contains("is-down")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("declares enemy actions with a lightweight name cue instead of a floating ability card", async () => {
    const base = openLabSession({ packageId: "rogue", scenarioId: "training-yard" }).session.encounter;
    await renderView({ encounter: base });
    const enemyId = base.enemyIds[0];
    const attack = base.enemyAttacks[enemyId][0];
    const sequence = base.sequence + 1;
    const next = {
      ...base,
      sequence,
      events: [
        ...base.events,
        {
          sequence,
          type: "enemy-attack",
          enemyId,
          targetId: base.playerId,
          attackId: attack.id,
          hits: [{ index: 0, damage: attack.damage, toHp: attack.damage, absorbed: 0, critical: false, dodged: false }],
        },
      ],
    };
    await act(async () => root.render(viewElement(next)));

    const declaration = container.querySelector(".tow-combat__declaration--enemy");
    expect(declaration).toBeTruthy();
    expect(declaration.textContent).toContain(attack.name);
    expect(declaration.querySelector(".tow-combat__declaration-sigil")).toBeTruthy();
    expect(declaration.querySelector(".tow-combat__declaration-sigil img")).toBeNull();
    expect(container.querySelector(".tow-combat__action-beat-copy")).toBeNull();
  });

  it("keeps authored Strike art restrained and skips confirmation for its only target", async () => {
    vi.useFakeTimers();
    const onUseSkill = vi.fn();
    const mounted = await renderView({ onUseSkill });
    const strike = mounted.querySelector("[data-skill-id='strike']");
    const commandArt = strike.querySelector(".tow-combat__ability-art img").getAttribute("src");

    await act(async () => strike.click());

    expect(commandArt).toMatch(/\.(?:png|webp)$/);
    expect(onUseSkill).not.toHaveBeenCalled();
    expect(mounted.querySelector("[data-testid='tow-target-confirmation']")).toBeNull();
    expect(mounted.querySelector(".tow-combat").dataset.presentationPhase).toBe("windup");
    expect(mounted.querySelector("[data-testid='tow-action-beat']")).toBeNull();
    await act(async () => vi.advanceTimersByTime(5000));
    expect(onUseSkill).toHaveBeenCalledTimes(1);
  });

  it("shows control in the rail and automatically forfeits the locked command", async () => {
    vi.useFakeTimers();
    try {
      const base = openLabSession({ packageId: "rogue", scenarioId: "training-yard" }).session.encounter;
      const controlled = {
        ...base,
        actors: {
          ...base.actors,
          [base.playerId]: {
            ...base.actors[base.playerId],
            statuses: [...base.actors[base.playerId].statuses, { type: "paralyze", count: 1 }],
          },
        },
      };
      const onStandDown = vi.fn();
      const mounted = await renderView({ encounter: controlled, onStandDown });
      expect(mounted.querySelector(".tow-combat__command").classList.contains("is-forced")).toBe(true);
      expect(mounted.querySelector(".tow-combat__command-heading").textContent)
        .toContain("Paralyze · turn forfeited");
      expect(mounted.querySelector(".tow-combat__action-hint").textContent)
        .toContain("No input needed");
      expect(onStandDown).not.toHaveBeenCalled();
      await act(async () => vi.advanceTimersByTime(899));
      expect(onStandDown).not.toHaveBeenCalled();
      await act(async () => vi.advanceTimersByTime(1));
      expect(onStandDown).toHaveBeenCalledTimes(1);
      expect(onStandDown).toHaveBeenCalledWith(base.playerId);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels a stale forced-window timer and dispatches once under Strict Mode", async () => {
    vi.useFakeTimers();
    try {
      const base = openLabSession({ packageId: "rogue", scenarioId: "training-yard" }).session.encounter;
      const enemyId = base.enemyIds[0];
      const forced = {
        ...base,
        actors: {
          ...base.actors,
          [enemyId]: {
            ...base.actors[enemyId],
            statuses: [...base.actors[enemyId].statuses, { type: "priority", count: 1 }],
          },
        },
      };
      const onStandDown = vi.fn();
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
      await act(async () => root.render(
        <React.StrictMode>
          {viewElement(forced, { onStandDown })}
        </React.StrictMode>,
      ));

      await act(async () => vi.advanceTimersByTime(450));
      const revised = { ...forced, sequence: forced.sequence + 1 };
      await act(async () => root.render(
        <React.StrictMode>
          {viewElement(revised, { onStandDown })}
        </React.StrictMode>,
      ));

      // The first encounter's timer would have fired here if the revision change had left
      // it behind. The current revision receives one fresh read hold instead.
      await act(async () => vi.advanceTimersByTime(451));
      expect(onStandDown).not.toHaveBeenCalled();
      await act(async () => vi.advanceTimersByTime(449));
      expect(onStandDown).toHaveBeenCalledTimes(1);
      expect(onStandDown).toHaveBeenCalledWith(base.playerId);
      await act(async () => vi.runAllTimersAsync());
      expect(onStandDown).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("dispatches one legal target without showing a redundant confirmation", async () => {
    vi.useFakeTimers();
    try {
      const encounter = openLabSession({ packageId: "rogue", scenarioId: "training-yard" }).session.encounter;
      const onUseSkill = vi.fn();
      const mounted = await renderView({ encounter, onUseSkill });
      const strike = mounted.querySelector("[data-skill-id='strike']");
      const anchorCell = legalSkillAnchors(encounter, "strike", encounter.playerId)[0];
      const preview = resolveSkillTargets(encounter, "strike", encounter.playerId, { anchorCell });

      await act(async () => strike.click());

      expect(onUseSkill).not.toHaveBeenCalled();
      expect(mounted.querySelector("[data-testid='tow-target-confirmation']")).toBeNull();
      expect(mounted.querySelector(".tow-combat").dataset.presentationPhase).toBe("windup");
      expect(mounted.querySelector("[data-testid='tow-action-beat']")).toBeNull();
      expect(strike.classList.contains("is-committed")).toBe(true);

      await act(async () => vi.advanceTimersByTime(5000));
      expect(onUseSkill).toHaveBeenCalledTimes(1);
      expect(onUseSkill).toHaveBeenCalledWith(
        "strike",
        preview.primaryTargetId,
        encounter.playerId,
        anchorCell,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("holds a promoted flexible Mythical behind a full-screen portrait declaration", async () => {
    vi.useFakeTimers();
    try {
      const base = openLabSession({ packageId: "rogue", scenarioId: "training-yard" }).session.encounter;
      const encounter = replaceSkill(
        base,
        "emergency-evasion",
        "penetration",
        maxRankOf("penetration"),
      );
      const onUseSkill = vi.fn();
      const mounted = await renderView({
        encounter,
        onUseSkill,
        artFor: () => "/test-assets/mythical-portrait.webp",
      });
      const anchorCell = legalSkillAnchors(encounter, "penetration", encounter.playerId)[0];
      const preview = resolveSkillTargets(
        encounter,
        "penetration",
        encounter.playerId,
        { anchorCell },
      );

      await act(async () => mounted.querySelector("[data-skill-id='penetration']").click());

      const declaration = mounted.querySelector("[data-testid='tow-mythical-declaration']");
      expect(declaration).toBeTruthy();
      expect(declaration.querySelector("img")?.getAttribute("src")).toMatch(/\.(?:png|webp)$/);
      expect(declaration.textContent).toMatch(/Mythical/i);
      expect(declaration.textContent).toContain("Penetration");
      expect(onUseSkill).not.toHaveBeenCalled();

      await act(async () => vi.advanceTimersByTime(1119));
      expect(mounted.querySelector("[data-testid='tow-mythical-declaration']")).toBeTruthy();
      expect(onUseSkill).not.toHaveBeenCalled();

      await act(async () => vi.advanceTimersByTime(1));
      expect(mounted.querySelector("[data-testid='tow-mythical-declaration']")).toBeNull();
      expect(onUseSkill).not.toHaveBeenCalled();

      await act(async () => vi.advanceTimersByTime(5000));
      expect(onUseSkill).toHaveBeenCalledTimes(1);
      expect(onUseSkill).toHaveBeenCalledWith(
        "penetration",
        preview.primaryTargetId,
        encounter.playerId,
        anchorCell,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("replaces the decorative title with a working exit control when supplied", async () => {
    const onEscape = vi.fn();
    const mounted = await renderView({ onEscape, escapeLabel: "Leave practice" });
    expect(mounted.textContent).not.toContain("The clash");
    const leave = [...mounted.querySelectorAll("button")]
      .find((button) => button.textContent.includes("Leave practice"));
    expect(leave).toBeTruthy();
    await act(async () => leave.click());
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("offers retreat in every active fight with the current calculated chance", async () => {
    const onRetreat = vi.fn();
    const mounted = await renderView({ onRetreat });
    const retreat = [...mounted.querySelectorAll("button")]
      .find((button) => button.textContent.includes("Retreat"));
    expect(retreat).toBeTruthy();
    expect(retreat.textContent).toMatch(/Retreat\s*·\s*\d+%/);
    expect(retreat.getAttribute("aria-label")).toMatch(/chance.*Spends .* action on failure/i);
    await act(async () => retreat.click());
    expect(onRetreat).toHaveBeenCalledWith("wanderer");
  });

  it("lets Escape dismiss details first and leave only on the next press", async () => {
    vi.useFakeTimers();
    try {
      const onEscape = vi.fn();
      const mounted = await renderView({ onEscape });
      const action = mounted.querySelector(".tow-combat__action");
      await act(async () => {
        action.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
        vi.advanceTimersByTime(450);
      });
      const details = mounted.querySelector("[data-testid='tow-skill-details']");
      expect(details).toBeTruthy();
      expect(details.textContent).toContain("Common");
      expect(details.textContent).not.toMatch(/rank\s+\d|\d\s*\/\s*\d/i);
      await act(async () => mounted.querySelector(".tow-combat").dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
      ));
      expect(mounted.querySelector("[data-testid='tow-skill-details']")).toBeNull();
      expect(onEscape).not.toHaveBeenCalled();
      await act(async () => mounted.querySelector(".tow-combat").dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
      ));
      expect(onEscape).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
