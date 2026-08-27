// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { openLabSession } from "./CombatLab.jsx";
import {
  eventTouchesStatus,
  TowCombatView,
  towSkillDetail,
} from "./TowCombatView.jsx";
import { combatCueTimeline } from "./tow-combat-feedback.js";
import { resolveTowAbilityArt } from "./tow-combat-ability-art.js";
import {
  createSkillState,
  getSkill,
  maxRankOf,
  skillIds,
} from "../../gameplay/tow/skills.js";
import { abilityTargeting } from "../../gameplay/tow/ability-targeting.js";
import { createTowEncounter, useSkill } from "../../gameplay/tow/encounter.js";
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
  it.each([
    ["mortal-blow", 1, "Deal 210% ATK damage"],
    ["blade-one-flash", 1, "Doom equal to 1000% ATK"],
    ["priestess-doom", 1, "to 200%"],
    ["witch-limited-life-sentence", 1, "Deal 666 damage after 2 turns"],
    ["blade-latent-power", 1, "Deal 9999 damage after 4 turns"],
    ["witch-forbidden-ritual", 1, "Gain 35% of maximum health for 4 turns"],
  ])("presents %s from source without a generic cap", (skillId, rank, sourceText) => {
    const detail = towSkillDetail(getSkill(skillId), createSkillState(skillId, rank));

    expect(detail).toContain(sourceText);
    expect(detail).not.toContain("Resolve combat:");
    expect(detail).not.toContain("capped at");
  });

  it("states one-turn decay protection on freshly granted statuses", () => {
    const detail = towSkillDetail(
      getSkill("arctic-gather-strength"),
      createSkillState("arctic-gather-strength", 1),
    );

    expect(detail).toContain("persists through its first turn end before normal decay");
  });

  it("states Forbidden Ritual's fatal expiration instead of a misleading damage number", () => {
    const detail = towSkillDetail(
      getSkill("witch-forbidden-ritual"),
      createSkillState("witch-forbidden-ritual", 1),
    );

    expect(detail).toContain("then fall to 0 health when it expires");
    expect(detail).not.toContain("die when");
    expect(detail).not.toContain("suffer 9999 damage");
  });

  it("states the source-authored self target for First Aid", () => {
    const detail = towSkillDetail(
      getSkill("first-aid"),
      createSkillState("first-aid", 1),
    );

    expect(detail).toContain("Target: self");
  });

  it("states the complete battlefield footprint for area abilities", () => {
    const detail = towSkillDetail(
      getSkill("clocktower-chain-explosion"),
      createSkillState("clocktower-chain-explosion", 1),
    );

    expect(detail).toContain("Target: enemy field");
    expect(detail).toContain("Area: target row and column");
  });

  it("states the authored base cooldown even while the ability is ready", () => {
    const detail = towSkillDetail(
      getSkill("clocktower-chain-explosion"),
      createSkillState("clocktower-chain-explosion", 1),
    );

    expect(detail).toContain("Cooldown: 3 rounds");
  });

  it("states Ward refresh and expiry semantics on every defensive ability", () => {
    const detail = towSkillDetail(
      getSkill("block"),
      createSkillState("block", 1),
    );

    expect(detail).toContain("Ward refreshes instead of stacking");
    expect(detail).toContain("expires after the opposing command window");
  });

  it("projects target, footprint, cooldown, and Ward rules for every live ability rank", () => {
    for (const skillId of skillIds()) {
      const definition = getSkill(skillId);
      const targeting = abilityTargeting(definition);
      for (let rank = 1; rank <= definition.rankCount; rank += 1) {
        const detail = towSkillDetail(definition, createSkillState(skillId, rank));
        expect(detail, `${skillId}@${rank}`).toContain("Target:");
        expect(detail, `${skillId}@${rank}`).toContain("Cooldown:");
        if (targeting.footprint !== "single") {
          expect(detail, `${skillId}@${rank}`).toContain("Area:");
        }
        if (targeting.anchorSide === "ally") {
          expect(detail, `${skillId}@${rank}`).toContain("Target: one ally (including you)");
          expect(detail, `${skillId}@${rank}`).not.toContain("yourself");
        }
        if (definition.effects.some((effect) => effect.type === "shield")) {
          expect(detail, `${skillId}@${rank}`).toContain("Ward refreshes instead of stacking");
        }
      }
    }
  });

  it("links every authoritative status-change event back to the affected status panel", () => {
    expect(eventTouchesStatus({
      type: "skill-status-scaled",
      targetId: "foe",
      statuses: ["burn", "poison"],
    }, "foe", "burn")).toBe(true);
    expect(eventTouchesStatus({
      type: "skill-status-modified",
      targetId: "hero",
      status: "initiative",
    }, "hero", "initiative")).toBe(true);
    expect(eventTouchesStatus({
      type: "skill-cleanse",
      targetId: "hero",
      statuses: ["bleed", "burn"],
    }, "hero", "bleed")).toBe(true);
    expect(eventTouchesStatus({
      type: "initiative-converted",
      actorId: "hero",
    }, "hero", "priority")).toBe(true);
    expect(eventTouchesStatus({
      type: "initiative-converted",
      actorId: "hero",
    }, "hero", "initiative")).toBe(true);
  });

  it("disables a contextual no-op before the player tries to pay for it", async () => {
    const base = openLabSession({ packageId: "rogue", scenarioId: "training-yard" }).session.encounter;
    const encounter = replaceSkill(base, "emergency-evasion", "priestess-instant-heal");
    const mounted = await renderView({ encounter });
    const heal = mounted.querySelector("[data-skill-id='priestess-instant-heal']");

    expect(heal.getAttribute("aria-disabled")).toBe("true");
    expect(heal.getAttribute("aria-label")).toContain("no useful effect");
  });

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
    expect(evasion.querySelector(".tow-combat__action-cost")?.textContent).toBe("3RP");
    expect(block.getAttribute("aria-label")).toMatch(/1 Resolve/i);
    expect(actions.map((action) => action.textContent).join("")).not.toContain("∞");
    expect(actions.every((action) => action.querySelector(".tow-combat__sr-only")?.textContent)).toBe(true);
    expect(actions.every((action) => action.classList.contains("production-combat__action"))).toBe(true);
    const resolve = mounted.querySelector(".tow-formation-unit__meter--resolve[role='meter']");
    expect(resolve).toBeTruthy();
    expect(resolve.getAttribute("aria-label")).toMatch(/Resolve$/);
    expect(resolve.getAttribute("aria-valuenow")).toBe(resolve.getAttribute("aria-valuemax"));
    expect(resolve.querySelector(".tow-formation-unit__meter-value")?.textContent).toContain("+1/basic");
    expect(resolve.querySelector(".tow-formation-unit__meter-value")?.textContent).not.toContain("/r");
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
    expect(cooling.querySelector(".tow-combat__action-cost")?.textContent).toBe("2RP");
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

  it("attaches each incoming intent to its declaring enemy and marks the threatened unit", async () => {
    const encounter = openLabSession({ packageId: "rogue", scenarioId: "training-yard" }).session.encounter;
    const mounted = await renderView({ encounter });
    const intent = mounted.querySelector("[data-testid='tow-enemy-intent']");
    expect(intent).toBeTruthy();
    expect(mounted.querySelector(".tow-combat__formation-intents")).toBeNull();
    const sourceCell = formationCellForActor(encounter, intent.dataset.enemyId);
    expect(intent.closest(".tow-formation-cell")).toBe(cellElement(mounted, sourceCell));
    expect(intent.closest(".tow-formation-cell").dataset.side).toBe("enemy");
    const intentArt = intent.querySelector(".tow-combat__intent-sigil img");
    expect(intentArt).toBeTruthy();
    const abilityId = intent.getAttribute("data-ability-id");
    expect(intentArt.getAttribute("src")).toBe(resolveTowAbilityArt(getSkill(abilityId)));
    expect(intentArt.getAttribute("src")).not.toContain("svg");
    expect(intent.getAttribute("aria-label")).toMatch(/(?:damage|hits of).*targeting/i);
    expect(intent.querySelector(".tow-combat__intent-source")).toBeNull();
    expect(intent.querySelector(".tow-combat__intent-target")).toBeNull();
    expect(intent.querySelector(".tow-combat__intent-name")).toBeNull();
    expect(intent.children).toHaveLength(2);
    expect(mounted.querySelector(".tow-combat__telegraph")).toBeNull();
    expect(mounted.querySelector(".tow-combat__incoming")).toBeNull();
    expect(mounted.querySelector(".tow-combat__exchange")).toBeNull();
    const targetCell = formationCellForActor(encounter, encounter.playerId);
    expect(targetCell).toBeTruthy();
    expect(cellElement(mounted, targetCell).classList.contains("is-intent-target")).toBe(true);
  });

  it("keeps the pre-move battlefield through contact, then settles movement without a fake VFX cue", async () => {
    vi.useFakeTimers();
    const base = openLabSession({ packageId: "rogue", scenarioId: "training-yard" }).session.encounter;
    const onUseSkill = vi.fn();
    const mounted = await renderView({ encounter: base, onUseSkill });
    const playerCell = formationCellForActor(base, base.playerId);
    const candidates = [playerCell.index - 3, playerCell.index + 3];
    const toCell = candidates.find((index) => (
      index >= 0
      && index < 9
      && !base.formations.player[index]
    ));
    expect(toCell).toBeTypeOf("number");
    const attack = base.enemyAttacks[base.enemyIds[0]][0];
    const attackEvent = {
      sequence: base.sequence + 1,
      type: "enemy-attack",
      enemyId: base.enemyIds[0],
      targetId: base.playerId,
      attackId: attack.id,
      hits: [{
        index: 0,
        damage: 1,
        toHp: 1,
        absorbed: 0,
        critical: false,
        dodged: false,
      }],
    };
    const movementEvent = {
      sequence: base.sequence + 2,
      type: "formation-moved",
      round: base.round + 1,
      phase: "round-open",
      moves: [{
        actorId: base.playerId,
        side: "player",
        fromCell: playerCell.index,
        toCell,
      }],
    };
    const finalPlayerFormation = [...base.formations.player];
    finalPlayerFormation[playerCell.index] = null;
    finalPlayerFormation[toCell] = base.playerId;
    const next = {
      ...base,
      round: base.round + 1,
      sequence: movementEvent.sequence,
      actors: {
        ...base.actors,
        [base.playerId]: {
          ...base.actors[base.playerId],
          hp: base.actors[base.playerId].hp - 1,
        },
      },
      formations: {
        ...base.formations,
        player: finalPlayerFormation,
      },
      events: [...base.events, attackEvent, movementEvent],
    };
    const movementCue = combatCueTimeline(next, [attackEvent, movementEvent])
      .find((cue) => cue.kind === "movement");
    const focusedAction = mounted.querySelector(".tow-combat__action");
    focusedAction.focus();

    await act(async () => root.render(viewElement(next, { onUseSkill })));

    const battlefield = mounted.querySelector(".tow-formation-battlefield");
    expect(mounted.querySelector(".tow-combat").getAttribute("aria-busy")).toBe("true");
    expect(focusedAction.disabled).toBe(false);
    // Incoming contact/movement cues are cosmetics: they dim the scene and mark the
    // surface busy but never disarm the next command.
    expect(focusedAction.getAttribute("aria-disabled")).toBe("false");
    await act(async () => focusedAction.click());
    expect(onUseSkill).toHaveBeenCalledTimes(1);
    expect(battlefield.dataset.movementPhase).toBe("pending");
    const playerHealthLabel = `${base.actors[base.playerId].name} health`;
    expect(cellElement(mounted, playerCell).querySelector(`[aria-label='${playerHealthLabel}']`))
      .toBeTruthy();
    expect(cellElement(mounted, playerCell).classList.contains("is-intent-target")).toBe(true);
    expect(cellElement(mounted, { side: "player", index: toCell })
      .querySelector(`[aria-label='${playerHealthLabel}']`)).toBeNull();
    expect(mounted.querySelectorAll(".tow-combat__effect")).toHaveLength(1);
    expect(mounted.querySelector(".tow-combat__effect--movement")).toBeNull();
    expect(mounted.querySelector("[data-testid='tow-combat-vfx-canvas']").dataset.cueCount).toBe("1");
    expect(document.activeElement).toBe(focusedAction);

    await act(async () => vi.advanceTimersByTime(movementCue.delayMs));
    const destination = cellElement(mounted, { side: "player", index: toCell });
    expect(battlefield.dataset.movementPhase).toBe("settling");
    expect(destination.querySelector(`[aria-label='${playerHealthLabel}']`)).toBeTruthy();
    expect(destination.classList.contains("is-intent-target")).toBe(true);
    expect(destination.querySelector(".tow-formation-cell__move-marker")).toBeTruthy();
    expect(mounted.querySelectorAll("[data-testid='tow-enemy-intent']")).toHaveLength(1);
    expect(document.activeElement).toBe(focusedAction);

    await act(async () => vi.advanceTimersByTime(movementCue.durationMs));
    expect(battlefield.dataset.movementPhase).toBe("settled");
    expect(destination.querySelector(".tow-formation-cell__move-marker")).toBeNull();
  });

  it("targets the current actor position while movement presentation is pending", async () => {
    vi.useFakeTimers();
    const opened = openLabSession({ packageId: "rogue", scenarioId: "formation-drill" }).session.encounter;
    const replacedId = opened.build.skills[2].id;
    const base = replaceSkill(opened, replacedId, "demon-shoot");
    const enemyId = base.formations.enemy[3];
    expect(enemyId).toBeTruthy();
    expect(base.formations.enemy[0]).toBeNull();
    const movementEvent = {
      sequence: base.sequence + 1,
      type: "formation-moved",
      round: base.round + 1,
      phase: "round-open",
      moves: [{ actorId: enemyId, side: "enemy", fromCell: 3, toCell: 0 }],
    };
    const enemyFormation = [...base.formations.enemy];
    enemyFormation[3] = null;
    enemyFormation[0] = enemyId;
    const next = {
      ...base,
      round: base.round + 1,
      sequence: movementEvent.sequence,
      actors: {
        ...base.actors,
        ...Object.fromEntries(base.enemyIds.map((id) => [id, {
          ...base.actors[id],
          statuses: base.actors[id].statuses.filter((status) => status.type !== "priority"),
        }])),
      },
      formations: { ...base.formations, enemy: enemyFormation },
      events: [...base.events, movementEvent],
    };
    const onUseSkill = vi.fn();
    const mounted = await renderView({ encounter: base, onUseSkill });

    await act(async () => root.render(viewElement(next, { onUseSkill })));
    expect(cellElement(mounted, { side: "enemy", index: 3 })
      .querySelector(`[data-actor-id='${enemyId}']`)).toBeTruthy();

    const action = mounted.querySelector("[data-skill-id='demon-shoot']");
    expect(action.getAttribute("aria-label")).toContain("Tap to use");
    await act(async () => action.click());

    expect(mounted.querySelector("[data-testid='tow-target-confirmation']")).toBeTruthy();
    expect(mounted.querySelector(".tow-formation-battlefield").dataset.movementPhase).toBe("idle");
    const currentCell = cellElement(mounted, { side: "enemy", index: 0 });
    expect(currentCell.querySelector(`[data-actor-id='${enemyId}']`)).toBeTruthy();
    expect(cellElement(mounted, { side: "enemy", index: 3 })
      .querySelector(`[data-actor-id='${enemyId}']`)).toBeNull();
    expect(currentCell.classList.contains("is-valid-anchor")).toBe(true);

    await act(async () => currentCell.click());
    expect(onUseSkill).toHaveBeenCalledWith(
      "demon-shoot",
      enemyId,
      next.playerId,
      { side: "enemy", index: 0 },
    );
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
    expect(intent.querySelector(".tow-combat__intent-target")).toBeNull();
  });

  it("names every target in area-intent badge copy", async () => {
    const base = openLabSession({ packageId: "rogue", scenarioId: "formation-drill" }).session.encounter;
    const sourceId = base.enemyIds[0];
    const skillId = "priestess-divine-barrier";
    const enemyFormation = [sourceId, base.enemyIds[1], base.enemyIds[2], ...Array(6).fill(null)];
    const next = {
      ...base,
      formations: { ...base.formations, enemy: enemyFormation },
      enemyBuilds: {
        ...base.enemyBuilds,
        [sourceId]: { ...base.enemyBuilds[sourceId], skills: [createSkillState(skillId)] },
      },
      enemyAttacks: {
        ...base.enemyAttacks,
        [sourceId]: [{
          id: skillId,
          skillId,
          name: getSkill(skillId).name,
          hits: 1,
          damage: 0,
          kind: "ward",
          target: "self",
        }],
      },
      intents: {
        ...base.intents,
        [sourceId]: { ...base.intents[sourceId], attackId: skillId, targetId: sourceId },
      },
    };
    const mounted = await renderView({ encounter: next });
    const names = base.enemyIds.map((id) => base.actors[id].name).join(", ");
    const intent = mounted.querySelector(`[data-testid='tow-enemy-intent'][data-enemy-id='${sourceId}']`);

    expect(intent.getAttribute("aria-label")).toContain(`targeting ${names}`);
    expect(intent.getAttribute("title")).toContain(names);
  });

  it("renders two logical 3x3 formations with compact HP and Resolve on occupied cells", async () => {
    const encounter = openLabSession({ packageId: "rogue", scenarioId: "training-yard" }).session.encounter;
    const playerId = encounter.playerId;
    const withStatus = {
      ...encounter,
      actors: {
        ...encounter.actors,
        [playerId]: {
          ...encounter.actors[playerId],
          statuses: [...encounter.actors[playerId].statuses, { type: "paralyze", count: 2 }],
        },
      },
    };
    const mounted = await renderView({ encounter: withStatus });
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
    expect(occupied.every((cell) => cell.querySelector(".tow-formation-unit__name") === null)).toBe(true);
    expect(occupied.every((cell) => {
      const vitals = cell.querySelector(".tow-formation-unit__vitals");
      return [...vitals.children].map((node) => node.classList[1]).join("|")
        === "tow-formation-unit__meter--hp|tow-formation-unit__meter--resolve";
    })).toBe(true);
    const playerCell = cellElement(mounted, formationCellForActor(withStatus, playerId));
    expect(playerCell.querySelector(".tow-formation-statuses")).toBeTruthy();
    expect(playerCell.querySelectorAll(".tow-formation-status")).toHaveLength(1);
    expect(empty.every((cell) => [
      "is-valid-anchor",
      "is-affected",
      "is-selected-anchor",
      "is-intent-target",
    ].every((state) => !cell.classList.contains(state)))).toBe(true);
  });

  it("names the current commander directly on the battlefield", async () => {
    const encounter = openLabSession({ packageId: "rogue", scenarioId: "training-yard" }).session.encounter;
    const mounted = await renderView({ encounter });
    const active = mounted.querySelector(".tow-formation-unit.is-active");

    expect(active).toBeTruthy();
    expect(active.querySelector(".tow-formation-unit__active-label")?.textContent)
      .toContain(encounter.actors[encounter.playerId].name);
    expect(active.querySelector(".tow-formation-unit__active-label")?.textContent)
      .toContain("Acting");
  });

  it("uses board combatants for selection and opens a complete stat-and-ability dossier", async () => {
    const encounter = openLabSession({ packageId: "rogue", scenarioId: "training-yard" }).session.encounter;
    const mounted = await renderView({ encounter });
    const playerCell = cellElement(mounted, formationCellForActor(encounter, encounter.playerId));

    expect(mounted.querySelector(".tow-combat__command-heading")).toBeNull();
    expect(mounted.querySelector(".tow-combat__commanders")).toBeNull();
    expect(mounted.querySelector(".tow-combat__action-hint")).toBeNull();
    await act(async () => playerCell.click());

    const dossier = mounted.querySelector("[data-testid='tow-combat-dossier']");
    expect(dossier).toBeTruthy();
    expect(dossier.getAttribute("aria-labelledby")).toBeTruthy();
    expect(dossier.textContent).toContain(encounter.actors[encounter.playerId].name);
    expect(dossier.textContent).toContain("Combat profile");
    expect(dossier.textContent).toContain("Attack");
    expect(dossier.textContent).toContain("Defense");
    expect(dossier.querySelectorAll(".tow-combat__dossier-abilities article"))
      .toHaveLength(encounter.build.skills.length);
    expect(dossier.querySelector(".tow-combat__dossier-ability-art img")).toBeTruthy();

    await act(async () => dossier.querySelector("button[aria-label^='Close ']").click());
    expect(mounted.querySelector("[data-testid='tow-combat-dossier']")).toBeNull();
  });

  it("gives the nested dossier modal focus entry, containment, inert background, and restoration", async () => {
    const encounter = openLabSession({ packageId: "rogue", scenarioId: "training-yard" }).session.encounter;
    const mounted = await renderView({ encounter });
    const playerCell = cellElement(mounted, formationCellForActor(encounter, encounter.playerId));

    await act(async () => playerCell.click());
    const dossier = mounted.querySelector("[data-testid='tow-combat-dossier']");
    const close = dossier.querySelector("button[aria-label^='Close ']");
    const modalLayer = dossier.closest(".tow-combat__dossier-backdrop");
    const background = [...modalLayer.parentElement.children].filter((child) => child !== modalLayer);

    expect(document.activeElement).toBe(close);
    expect(background.length).toBeGreaterThan(0);
    expect(background.every((child) => (
      child.hasAttribute("inert") && child.getAttribute("aria-hidden") === "true"
    ))).toBe(true);

    const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    await act(async () => close.dispatchEvent(tab));
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);

    const reverseTab = new KeyboardEvent("keydown", {
      key: "Tab", shiftKey: true, bubbles: true, cancelable: true,
    });
    await act(async () => close.dispatchEvent(reverseTab));
    expect(reverseTab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);

    await act(async () => close.dispatchEvent(new KeyboardEvent(
      "keydown", { key: "Escape", bubbles: true, cancelable: true },
    )));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(mounted.querySelector("[data-testid='tow-combat-dossier']")).toBeNull();
    expect(document.activeElement).toBe(playerCell);
    expect(background.every((child) => (
      !child.hasAttribute("inert") && child.getAttribute("aria-hidden") !== "true"
    ))).toBe(true);
  });

  it("focuses the legal anchor and restores the initiating action on Cancel or Escape", async () => {
    const opening = openLabSession({
      packageId: "rogue",
      scenarioId: "formation-drill",
    }).session.encounter;
    const encounter = {
      ...opening,
      actors: {
        ...opening.actors,
        ...Object.fromEntries(opening.enemyIds.map((enemyId) => [
          enemyId,
          {
            ...opening.actors[enemyId],
            statuses: opening.actors[enemyId].statuses.filter(({ type }) => type !== "priority"),
          },
        ])),
      },
    };
    const skillId = "strike";
    const expectedAnchors = legalSkillAnchors(
      encounter,
      skillId,
      encounter.playerId,
    );
    const mounted = await renderView({ encounter, onUseSkill: vi.fn() });
    const initiatingAction = mounted.querySelector(`[data-skill-id='${skillId}']`);

    expect(expectedAnchors.length).toBeGreaterThan(1);
    expect(mounted.querySelectorAll(".tow-formation-cell.is-valid-anchor")).toHaveLength(0);
    initiatingAction.focus();
    await act(async () => initiatingAction.click());

    expect(mounted.querySelector("[data-testid='tow-target-confirmation']")).toBeTruthy();
    expect(mounted.querySelector("[data-testid='tow-target-confirmation']")
      .compareDocumentPosition(mounted.querySelector(".tow-combat__actions"))
      & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(cellCoordinates([...mounted.querySelectorAll(".tow-formation-cell.is-valid-anchor")]))
      .toEqual(expectedAnchors);
    expect(mounted.querySelector(".tow-combat__target-commit").disabled).toBe(true);
    expect(document.activeElement).toBe(mounted.querySelector(
      ".tow-formation-cell.is-valid-anchor:not(:disabled)",
    ));

    await act(async () => mounted.querySelector(".tow-combat__target-cancel").click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(mounted.querySelector("[data-testid='tow-target-confirmation']")).toBeNull();
    expect(mounted.querySelectorAll(
      ".tow-formation-cell.is-valid-anchor, .tow-formation-cell.is-affected, .tow-formation-cell.is-selected-anchor",
    )).toHaveLength(0);
    expect(document.activeElement).toBe(initiatingAction);

    await act(async () => initiatingAction.click());
    const focusedAnchor = mounted.querySelector(".tow-formation-cell.is-valid-anchor:not(:disabled)");
    expect(document.activeElement).toBe(focusedAnchor);
    await act(async () => focusedAnchor.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
    ));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(mounted.querySelector("[data-testid='tow-target-confirmation']")).toBeNull();
    expect(document.activeElement).toBe(initiatingAction);
  });

  it("previews the complete cross footprint on focus and keeps it after target selection", async () => {
    const opening = openLabSession({
      packageId: "rogue",
      scenarioId: "formation-drill",
    }).session.encounter;
    const base = {
      ...opening,
      actors: {
        ...opening.actors,
        ...Object.fromEntries(opening.enemyIds.map((enemyId) => [
          enemyId,
          {
            ...opening.actors[enemyId],
            statuses: [
              ...opening.actors[enemyId].statuses.filter(({ type }) => type !== "priority"),
              { type: "doom", count: 10 },
            ],
          },
        ])),
      },
    };
    const skillId = "clocktower-chain-explosion";
    const encounter = replaceSkill(base, "emergency-evasion", skillId);
    const anchors = legalSkillAnchors(encounter, skillId, encounter.playerId);
    const firstPreview = resolveSkillTargets(encounter, skillId, encounter.playerId, {
      anchorCell: anchors[0],
    });
    const onUseSkill = vi.fn();
    const mounted = await renderView({ encounter, onUseSkill });

    expect(anchors.length).toBeGreaterThan(1);
    expect(firstPreview.ok).toBe(true);
    expect(firstPreview.targetIds.length).toBeGreaterThan(1);

    await act(async () => mounted.querySelector(`[data-skill-id='${skillId}']`).click());

    const focusedAnchor = document.activeElement;
    expect(cellCoordinates([focusedAnchor])).toEqual([anchors[0]]);
    expect(focusedAnchor.classList.contains("is-preview-anchor")).toBe(true);
    expect(mounted.querySelectorAll(".tow-formation-cell.is-selected-anchor")).toHaveLength(0);
    expect(cellCoordinates([...mounted.querySelectorAll(".tow-formation-cell.is-affected")]))
      .toEqual(firstPreview.affectedCells);

    await act(async () => focusedAnchor.click());

    expect(focusedAnchor.classList.contains("is-selected-anchor")).toBe(true);
    expect(cellCoordinates([...mounted.querySelectorAll(".tow-formation-cell.is-affected")]))
      .toEqual(firstPreview.affectedCells);
    expect(mounted.querySelector(".tow-combat__target-commit").disabled).toBe(false);
    expect(onUseSkill).not.toHaveBeenCalled();
  });

  it("auto-commits a full-field ability without redundant anchors or confirmation", async () => {
    vi.useFakeTimers();
    try {
      const opening = openLabSession({ packageId: "rogue", scenarioId: "formation-drill" }).session.encounter;
      const base = {
        ...opening,
        actors: {
          ...opening.actors,
          ...Object.fromEntries(opening.enemyIds.map((enemyId) => [
            enemyId,
            {
              ...opening.actors[enemyId],
              statuses: opening.actors[enemyId].statuses.filter(({ type }) => type !== "priority"),
            },
          ])),
        },
      };
      const skillId = "demon-arrow-rain";
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
      expect(preview.targetIds.length).toBeGreaterThan(1);

      await act(async () => mounted.querySelector(`[data-skill-id='${skillId}']`).click());

      // Full-field abilities have no anchor decision to make: they commit instantly
      // while the cosmetic windup plays.
      expect(onUseSkill).toHaveBeenCalledTimes(1);
      expect(onUseSkill).toHaveBeenCalledWith(
        skillId,
        preview.primaryTargetId,
        encounter.playerId,
        anchors[0],
      );
      expect(mounted.querySelector("[data-testid='tow-target-confirmation']")).toBeNull();
      expect(mounted.querySelectorAll(
        ".tow-formation-cell.is-valid-anchor, .tow-formation-cell.is-affected, .tow-formation-cell.is-selected-anchor",
      )).toHaveLength(0);
      expect(mounted.querySelector(".tow-combat").dataset.presentationPhase).toBe("windup");

      await act(async () => vi.runAllTimersAsync());
      expect(onUseSkill).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("auto-commits a single recipient after the player chooses among legal anchors", async () => {
    vi.useFakeTimers();
    try {
      const opening = openLabSession({
        packageId: "rogue",
        scenarioId: "roadside-ambush",
      }).session.encounter;
      const encounter = {
        ...opening,
        actors: {
          ...opening.actors,
          ...Object.fromEntries(opening.enemyIds.map((enemyId) => [
            enemyId,
            {
              ...opening.actors[enemyId],
              statuses: opening.actors[enemyId].statuses.filter(({ type }) => type !== "priority"),
            },
          ])),
        },
      };
      const skillId = "strike";
      const anchors = legalSkillAnchors(encounter, skillId, encounter.playerId);
      const chosenAnchor = anchors.at(-1);
      const preview = resolveSkillTargets(encounter, skillId, encounter.playerId, {
        anchorCell: chosenAnchor,
      });
      const onUseSkill = vi.fn();
      const mounted = await renderView({ encounter, onUseSkill });
      const action = mounted.querySelector("[data-skill-id='strike']");

      expect(anchors.length).toBeGreaterThan(1);
      expect(preview.targetIds).toHaveLength(1);
      expect(action.getAttribute("aria-disabled")).toBe("false");
      await act(async () => action.click());
      expect(mounted.querySelector("[data-testid='tow-target-confirmation']")).toBeTruthy();

      await act(async () => cellElement(mounted, chosenAnchor).click());

      expect(mounted.querySelector("[data-testid='tow-target-confirmation']")).toBeNull();
      expect(mounted.querySelector(".tow-combat").dataset.presentationPhase).toBe("windup");
      expect(cellElement(mounted, chosenAnchor).classList.contains("is-selected-anchor")).toBe(true);
      expect(cellElement(mounted, chosenAnchor).classList.contains("is-affected")).toBe(true);
      // The anchor choice commits immediately; only the cosmetic recovery remains.
      expect(onUseSkill).toHaveBeenCalledTimes(1);
      expect(onUseSkill).toHaveBeenCalledWith(
        skillId,
        preview.primaryTargetId,
        encounter.playerId,
        chosenAnchor,
      );

      await act(async () => vi.runAllTimersAsync());
      expect(onUseSkill).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("accepts the next legal target while the previous action is still resolving visually", async () => {
    vi.useFakeTimers();
    try {
      const opening = openLabSession({
        packageId: "rogue",
        scenarioId: "roadside-ambush",
      }).session.encounter;
      const encounter = {
        ...opening,
        turn: { ...opening.turn, actionsRemaining: 2 },
        actors: {
          ...opening.actors,
          ...Object.fromEntries(opening.enemyIds.map((enemyId) => [
            enemyId,
            {
              ...opening.actors[enemyId],
              statuses: opening.actors[enemyId].statuses.filter(({ type }) => type !== "priority"),
            },
          ])),
        },
      };
      const firstAnchor = legalSkillAnchors(encounter, "strike", encounter.playerId).at(-1);
      const firstPreview = resolveSkillTargets(encounter, "strike", encounter.playerId, {
        anchorCell: firstAnchor,
      });
      const onUseSkill = vi.fn();
      const mounted = await renderView({ encounter, onUseSkill });

      await act(async () => mounted.querySelector("[data-skill-id='strike']").click());
      await act(async () => cellElement(mounted, firstAnchor).click());
      expect(onUseSkill).toHaveBeenCalledTimes(1);

      const resolved = useSkill(
        encounter,
        "strike",
        firstPreview.primaryTargetId,
        encounter.playerId,
        firstAnchor,
      );
      expect(resolved.ok).toBe(true);
      await act(async () => root.render(viewElement(resolved.state, { onUseSkill })));
      expect(mounted.querySelector(".tow-combat").dataset.presentationPhase).toBe("resolve");

      const nextAnchor = legalSkillAnchors(resolved.state, "strike", encounter.playerId)[0];
      await act(async () => mounted.querySelector("[data-skill-id='strike']").click());
      await act(async () => cellElement(mounted, nextAnchor).click());

      expect(onUseSkill).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
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
      .toEqual(["0ms", "210ms"]);
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

      await act(async () => vi.advanceTimersByTime(210));
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
      // The outcome is canonical on arrival; the reveal hold only lets the final contact
      // cues land before the tally replaces the field.
      expect(combat.dataset.presentationPhase).toBe("resolution-hold");
      expect(combat.getAttribute("aria-busy")).toBe("true");
      expect(mounted.querySelector(".tow-combat__outcome")).toBeNull();
      expect(mounted.querySelector(".tow-combat__command")).toBeTruthy();
      expect(mounted.querySelectorAll(".tow-combat__effect")).toHaveLength(2);
      expect(enemyUnit.classList.contains("is-down")).toBe(false);

      await act(async () => vi.advanceTimersByTime(829));
      expect(mounted.querySelector(".tow-combat__outcome")).toBeNull();
      expect(enemyUnit.classList.contains("is-down")).toBe(true);
      expect(enemyUnit.querySelector(".tow-formation-unit__down-label")?.textContent)
        .toBe("Defeated");

      await act(async () => vi.advanceTimersByTime(1));
      expect(mounted.querySelector(".tow-combat__outcome")).toBeTruthy();
      expect(enemyUnit.classList.contains("is-down")).toBe(true);
      expect(mounted.querySelector(".tow-formation-unit.is-active")).toBeNull();
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
    // A lone legal target commits instantly; the windup is cosmetic.
    expect(onUseSkill).toHaveBeenCalledTimes(1);
    expect(mounted.querySelector("[data-testid='tow-target-confirmation']")).toBeNull();
    expect(mounted.querySelector(".tow-combat").dataset.presentationPhase).toBe("windup");
    await act(async () => vi.advanceTimersByTime(5000));
    expect(onUseSkill).toHaveBeenCalledTimes(1);
  });

  it.each(["paralyze", "stun", "sleep", "confuse"])(
    "shows %s control in the rail and forfeits the locked command immediately",
    async (controlType) => {
      vi.useFakeTimers();
      try {
        const base = openLabSession({ packageId: "rogue", scenarioId: "training-yard" }).session.encounter;
        const controlled = {
          ...base,
          actors: {
            ...base.actors,
            [base.playerId]: {
              ...base.actors[base.playerId],
              statuses: [...base.actors[base.playerId].statuses, { type: controlType, count: 1 }],
            },
          },
        };
        const onStandDown = vi.fn();
        const mounted = await renderView({ encounter: controlled, onStandDown });
        expect(mounted.querySelector(".tow-combat__command").classList.contains("is-forced")).toBe(true);
        expect(mounted.querySelector(".tow-combat__command-heading")).toBeNull();
        expect(mounted.querySelector(".tow-combat__action-hint")).toBeNull();
        expect(mounted.querySelector(".tow-combat__command .tow-combat__sr-only").textContent)
          .toContain(`${controlType.replace(/\b\w/g, (letter) => letter.toUpperCase())}. No player input.`);
        // No read hold: a window the player could never use is handed straight back.
        expect(onStandDown).toHaveBeenCalledTimes(1);
        expect(onStandDown).toHaveBeenCalledWith(base.playerId);
        await act(async () => vi.runAllTimersAsync());
        expect(onStandDown).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it("keeps same-ability Priority actions interactive before self-Paralyze", async () => {
    const opened = createTowEncounter({
      seed: "priority-before-control-ui",
      player: {
        id: "clocktower",
        name: "Clocktower",
        maxHp: 100,
        resolve: 12,
        resolveMax: 12,
        stats: { attack: 12, defense: 8, critRate: 0, dodgeRate: 0 },
      },
      enemies: [{
        id: "dummy",
        name: "Dummy",
        maxHp: 100,
        stats: { attack: 1, defense: 0, critRate: 0, dodgeRate: 0 },
      }],
      build: {
        traits: {},
        skills: [
          { id: "clocktower-time-machine", rank: 1 },
          { id: "strike", rank: 1 },
        ],
      },
    });
    const cast = useSkill(opened, "clocktower-time-machine");
    expect(cast.ok).toBe(true);
    const onStandDown = vi.fn();
    const mounted = await renderView({ encounter: cast.state, onStandDown });
    const strike = [...mounted.querySelectorAll(".production-combat__action")]
      .find((button) => button.dataset.skillId === "strike");

    expect(strike).toBeTruthy();
    expect(strike.disabled).toBe(false);
    expect(onStandDown).not.toHaveBeenCalled();
  });

  it("forfeits a forced window once per revision under Strict Mode", async () => {
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

      // Strict Mode's double effect run must not double-forfeit the window.
      expect(onStandDown).toHaveBeenCalledTimes(1);
      const revised = { ...forced, sequence: forced.sequence + 1 };
      await act(async () => root.render(
        <React.StrictMode>
          {viewElement(revised, { onStandDown })}
        </React.StrictMode>,
      ));

      // A new command revision is one fresh forfeit; rerenders of the same one are not.
      await act(async () => vi.advanceTimersByTime(1000));
      expect(onStandDown).toHaveBeenCalledTimes(2);
      expect(onStandDown).toHaveBeenNthCalledWith(1, base.playerId);
      await act(async () => vi.runAllTimersAsync());
      expect(onStandDown).toHaveBeenCalledTimes(2);
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

      // A lone legal target commits instantly; the windup is cosmetic.
      expect(onUseSkill).toHaveBeenCalledTimes(1);
      expect(onUseSkill).toHaveBeenCalledWith(
        "strike",
        preview.primaryTargetId,
        encounter.playerId,
        anchorCell,
      );
      expect(mounted.querySelector("[data-testid='tow-target-confirmation']")).toBeNull();
      expect(mounted.querySelector(".tow-combat").dataset.presentationPhase).toBe("windup");
      expect(mounted.querySelector("[data-testid='tow-action-beat']")).toBeNull();
      expect(strike.classList.contains("is-committed")).toBe(true);
      expect(cellElement(mounted, anchorCell).classList.contains("is-selected-anchor")).toBe(true);
      expect(cellElement(mounted, anchorCell).classList.contains("is-affected")).toBe(true);

      await act(async () => vi.advanceTimersByTime(5000));
      expect(onUseSkill).toHaveBeenCalledTimes(1);
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

      // The mythical cut-in names the ability while the command has already committed;
      // the field answers underneath the one-bounded-beat overlay.
      const declaration = mounted.querySelector("[data-testid='tow-mythical-declaration']");
      expect(declaration).toBeTruthy();
      expect(declaration.querySelector("img")?.getAttribute("src")).toMatch(/\.(?:png|webp)$/);
      expect(declaration.textContent).toMatch(/Mythical/i);
      expect(declaration.textContent).toContain("Penetration");
      expect(onUseSkill).toHaveBeenCalledTimes(1);
      expect(onUseSkill).toHaveBeenCalledWith(
        "penetration",
        preview.primaryTargetId,
        encounter.playerId,
        anchorCell,
      );

      await act(async () => vi.advanceTimersByTime(1119));
      expect(mounted.querySelector("[data-testid='tow-mythical-declaration']")).toBeTruthy();

      await act(async () => vi.advanceTimersByTime(1));
      expect(mounted.querySelector("[data-testid='tow-mythical-declaration']")).toBeNull();

      await act(async () => vi.advanceTimersByTime(5000));
      expect(onUseSkill).toHaveBeenCalledTimes(1);
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
