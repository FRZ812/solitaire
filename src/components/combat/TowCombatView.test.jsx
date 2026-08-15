// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { openLabSession } from "./CombatLab.jsx";
import { TowCombatView } from "./TowCombatView.jsx";
import { resolveTowAbilityArt } from "./tow-combat-ability-art.js";
import { getSkill } from "../../gameplay/tow/skills.js";

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
    const resolve = mounted.querySelector(".tow-combat__bar--resolve[role='meter']");
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
    const item = mounted.querySelector(".tow-combat__item");
    expect(item.textContent).toContain("Fire Pot");
    expect(item.textContent).toContain("150% ATK");
    await act(async () => item.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onUseItem).toHaveBeenCalledWith("fire-pot", "foe-0", "wanderer");
  });

  it("moves the incoming attack to one compact icon above the enemy", async () => {
    const mounted = await renderView();
    const intent = mounted.querySelector("[data-testid='tow-enemy-intent']");
    expect(intent).toBeTruthy();
    expect(intent.closest(".tow-combat__threat")).toBeTruthy();
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
    expect(mounted.querySelector(".tow-combat__plate--hero .tow-combat__record-trigger")).toBeTruthy();
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

  it("shows active statuses as tappable icon art with persistent mechanical details", async () => {
    const base = openLabSession({ packageId: "rogue", scenarioId: "training-yard" }).session.encounter;
    const enemyId = base.enemyIds[0];
    const sequence = base.sequence + 1;
    const next = {
      ...base,
      sequence,
      actors: {
        ...base.actors,
        [base.playerId]: {
          ...base.actors[base.playerId],
          statuses: [
            { type: "initiative", count: 37 },
            { type: "burn", count: 4 },
          ],
        },
        [enemyId]: {
          ...base.actors[enemyId],
          statuses: [{ type: "initiative", count: 45 }],
        },
      },
      events: [
        ...base.events,
        {
          sequence,
          type: "trait-fired",
          actorId: base.playerId,
          traitId: "gale",
          status: "initiative",
          amount: 37,
        },
      ],
    };
    const mounted = await renderView({ encounter: next });
    const buttons = [...mounted.querySelectorAll(".tow-combat__plate--hero .tow-combat__status-button")];

    expect(buttons).toHaveLength(2);
    expect(buttons.every((button) => {
      const art = button.querySelector(".tow-combat__status-art");
      return art
        && art.style.getPropertyValue("--tow-status-icon").includes(".png")
        && /^(?:0|100)% (?:0|100)%$/.test(art.style.getPropertyValue("--tow-status-icon-position"));
    })).toBe(true);
    expect(buttons.map((button) => button.getAttribute("aria-label")))
      .toEqual(expect.arrayContaining([
        expect.stringMatching(/Initiative, 37 stacks/i),
        expect.stringMatching(/Burn, 4 stacks/i),
      ]));

    const initiative = buttons.find((button) => /Initiative/.test(button.getAttribute("aria-label")));
    await act(async () => initiative.click());
    const detail = mounted.querySelector("[data-testid='tow-status-details']");
    expect(detail).toBeTruthy();
    expect(detail.textContent).toContain("Initiative");
    expect(detail.textContent).toContain("100 Initiative converts into 1 Priority");
    expect(detail.textContent).toContain("Your Gale grants 37 Initiative");
    expect(initiative.getAttribute("aria-expanded")).toBe("true");

    await act(async () => initiative.click());
    expect(mounted.querySelector("[data-testid='tow-status-details']")).toBeNull();

    const enemyInitiative = mounted.querySelector(".tow-combat__plate--enemy .tow-combat__status-button");
    await act(async () => enemyInitiative.click());
    const enemyDetail = mounted.querySelector("[data-testid='tow-status-details']");
    expect(enemyDetail.classList.contains("tow-combat__status-details--intent-safe")).toBe(true);
    expect(mounted.querySelector("[data-testid='tow-enemy-intent']")).toBeTruthy();
  });

  it("moves readable receipts behind the compact combat-log icon", async () => {
    const mounted = await renderView();
    const trigger = mounted.querySelector(".tow-combat__plate--hero .tow-combat__record-trigger");
    expect(trigger).toBeTruthy();
    expect(mounted.querySelector(".tow-combat__record-list")).toBeNull();
    await act(async () => trigger.click());
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(mounted.querySelector(".tow-combat__plate--hero .tow-combat__record-list")?.textContent.length)
      .toBeGreaterThan(20);
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
      const meter = mounted.querySelector(".tow-combat__plate--enemy [role='meter']");
      expect(meter.getAttribute("aria-valuenow")).toBe(String(startingHp));

      await act(async () => vi.advanceTimersByTime(150));
      expect(meter.getAttribute("aria-valuenow")).toBe(String(startingHp - 4));

      await act(async () => vi.advanceTimersByTime(155));
      expect(meter.getAttribute("aria-valuenow")).toBe(String(startingHp - 9));
    } finally {
      vi.useRealTimers();
    }
  });

  it("spends Protection on each contact beat instead of after the whole ability", async () => {
    vi.useFakeTimers();
    try {
      const opened = openLabSession({ packageId: "rogue", scenarioId: "training-yard" }).session.encounter;
      const heroId = opened.playerId;
      const enemyId = opened.enemyIds[0];
      const base = {
        ...opened,
        actors: {
          ...opened.actors,
          [heroId]: { ...opened.actors[heroId], statuses: [{ type: "protection", count: 3 }] },
        },
      };
      const mounted = await renderView({ encounter: base });
      const sequence = base.sequence + 1;
      const next = {
        ...base,
        sequence,
        actors: {
          ...base.actors,
          [heroId]: { ...base.actors[heroId], statuses: [{ type: "protection", count: 1 }] },
        },
        events: [
          ...base.events,
          {
            sequence,
            type: "enemy-attack",
            enemyId,
            targetId: heroId,
            attackId: base.enemyAttacks[enemyId][0].id,
            hits: [
              {
                index: 0, damage: 4, toHp: 4, absorbed: 0, critical: false, dodged: false,
                statusChanges: {
                  attacker: [],
                  defender: [{ type: "protection", before: 3, after: 2 }],
                },
              },
              {
                index: 1, damage: 5, toHp: 5, absorbed: 0, critical: false, dodged: false,
                statusChanges: {
                  attacker: [],
                  defender: [{ type: "protection", before: 2, after: 1 }],
                },
              },
            ],
          },
        ],
      };

      await act(async () => root.render(viewElement(next)));
      const protectionCount = () => mounted
        .querySelector(".tow-combat__plate--hero .tow-combat__status-button[aria-label^='Protection']")
        ?.querySelector("strong")?.textContent;
      expect(protectionCount()).toBe("3");

      await act(async () => vi.advanceTimersByTime(150));
      expect(protectionCount()).toBe("2");

      await act(async () => vi.advanceTimersByTime(155));
      expect(protectionCount()).toBe("1");
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
      const threat = mounted.querySelector(".tow-combat__threat");
      expect(combat.dataset.presentationPhase).toBe("resolution-hold");
      expect(combat.getAttribute("aria-busy")).toBe("true");
      expect(mounted.querySelector(".tow-combat__outcome")).toBeNull();
      expect(mounted.querySelector(".tow-combat__command")).toBeTruthy();
      expect(mounted.querySelectorAll(".tow-combat__effect")).toHaveLength(2);
      expect(threat.classList.contains("is-down")).toBe(false);
      expect([...mounted.querySelectorAll(".tow-combat__action")].every((button) => button.disabled)).toBe(true);

      await act(async () => vi.advanceTimersByTime(1604));
      expect(mounted.querySelector(".tow-combat__outcome")).toBeNull();
      expect(threat.classList.contains("is-down")).toBe(false);

      await act(async () => vi.advanceTimersByTime(1));
      expect(mounted.querySelector(".tow-combat__outcome")).toBeTruthy();
      expect(mounted.querySelector(".tow-combat__threat").classList.contains("is-down")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("declares enemy actions with the same translucent icon-and-name language", async () => {
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
    expect(declaration.querySelector(".tow-combat__declaration-sigil img")).toBeTruthy();
    expect(container.querySelector(".tow-combat__action-beat-copy")).toBeNull();
  });

  it("uses authored ability artwork rather than VFX SVGs in the declaration plane", async () => {
    vi.useFakeTimers();
    try {
      const mounted = await renderView();
      const action = mounted.querySelector(".tow-combat__action");
      const commandArt = action.querySelector(".tow-combat__ability-art img").getAttribute("src");
      await act(async () => action.click());
      const declarationArt = mounted
        .querySelector("[data-testid='tow-action-beat'] .tow-combat__declaration-sigil img")
        .getAttribute("src");
      expect(declarationArt).toBe(commandArt);
      expect(declarationArt).not.toContain("data:image/svg+xml");
    } finally {
      vi.useRealTimers();
    }
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
      expect(mounted.querySelector(".tow-combat__status-button[aria-label^='Paralyze']")).toBeTruthy();
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

  it("puts current and maximum health inside each health bar", async () => {
    const mounted = await renderView();
    const bars = [...mounted.querySelectorAll(".tow-combat__bar")];
    expect(bars.length).toBeGreaterThanOrEqual(2);
    expect(bars.every((bar) => /\d+\s*\/\s*\d+/.test(bar.querySelector(".tow-combat__bar-value")?.textContent)))
      .toBe(true);
    expect(mounted.querySelector(".tow-combat__hp")).toBeNull();
  });

  it("commits one command through anticipation, contact, and recovery", async () => {
    vi.useFakeTimers();
    try {
      const onUseSkill = vi.fn();
      const mounted = await renderView({ onUseSkill });
      const action = mounted.querySelector(".tow-combat__action");

      await act(async () => {
        action.click();
        action.click();
      });

      expect(onUseSkill).not.toHaveBeenCalled();
      expect(mounted.querySelector(".tow-combat").dataset.presentationPhase).toBe("windup");
      expect(mounted.querySelector("[data-testid='tow-action-beat']")).toBeTruthy();
      expect(mounted.querySelector("[data-testid='tow-action-beat'] .tow-combat__declaration-sigil img")
        .getAttribute("src"))
        .toBe(action.querySelector(".tow-combat__ability-art img").getAttribute("src"));
      expect(action.classList.contains("is-committed")).toBe(true);
      expect(action.disabled).toBe(false);
      expect([...mounted.querySelectorAll(".tow-combat__action")]
        .filter((button) => button !== action)
        .every((button) => button.disabled)).toBe(true);
      expect(mounted.querySelector("[data-testid='tow-action-beat']").textContent).not.toContain("Consequence");
      expect(mounted.querySelector(".tow-combat__action-beat-copy")).toBeNull();

      await act(async () => vi.advanceTimersByTime(600));
      expect(onUseSkill).toHaveBeenCalledTimes(1);
      expect(onUseSkill).toHaveBeenCalledWith("strike", "foe-0", "wanderer");
      expect(mounted.querySelector(".tow-combat").dataset.presentationPhase).toBe("resolve");
      expect(mounted.querySelector("[data-testid='tow-action-beat']")?.textContent).toMatch(/Strike|Slash/);
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
