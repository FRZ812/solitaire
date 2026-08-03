// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { DestinationPanel, TravelHaltCard } from "./WorldExploration.jsx";

const RAN_DRY = {
  arrived: false,
  where: "a stand of birches",
  destination: "Falford",
  hexes: 6,
  minutes: 430,
  nights: 2,
  remaining: 11,
  boundaryKind: "supplies",
  reason: "The rations are gone. Going on from here means going on hungry.",
  passed: ["a plank bridge", "a wayside shrine"],
  posture: null,
  intendedDest: { x: 12, y: -3 },
};

async function mount(node) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(node));
  return {
    host,
    click: (selector) => act(async () => host.querySelector(selector).dispatchEvent(new MouseEvent("click", { bubbles: true }))),
    unmount: async () => {
      await act(async () => root.unmount());
      host.remove();
      delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    },
  };
}

describe("travel halt card", () => {
  it("says where the leg ended, why, and what it cost", async () => {
    const view = await mount(<TravelHaltCard halt={RAN_DRY} onPressOn={() => {}} onDismiss={() => {}} />);

    expect(view.host.querySelector("h2").textContent).toBe("a stand of birches");
    expect(view.host.textContent).toContain("The packs run dry");
    expect(view.host.textContent).toContain("The rations are gone.");
    expect(view.host.textContent).toContain("7 h 10 min");
    // Nights camped are part of what the march cost, not a stop of their own.
    expect(view.host.textContent).toContain("Camped");
    expect(view.host.textContent).toContain("nights");
    expect(view.host.textContent).toContain("a plank bridge, a wayside shrine");
    await view.unmount();
  });

  it("hands the next decision back rather than taking it", async () => {
    const pressedOn = [];
    const dismissals = [];
    const view = await mount(
      <TravelHaltCard
        halt={RAN_DRY}
        onPressOn={(dest) => pressedOn.push(dest)}
        onDismiss={() => dismissals.push(true)}
      />,
    );

    await view.click(".rpg-travel-button");
    expect(pressedOn).toEqual([{ x: 12, y: -3 }]);

    // The player came here to travel, so the only other way out is the map itself.
    const secondary = [...view.host.querySelectorAll(".rpg-halt-secondary")];
    expect(secondary.map((button) => button.textContent)).toEqual(["Stay on the map"]);
    for (const button of secondary) {
      await act(async () => button.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    }
    expect(dismissals.length).toBe(1);
    await view.unmount();
  });

  it("offers no onward march once the party has arrived", async () => {
    const arrived = {
      ...RAN_DRY,
      arrived: true,
      where: "Falford",
      destination: null,
      nights: 0,
      remaining: 0,
      boundaryKind: "destination",
      reason: "",
      intendedDest: null,
    };
    const view = await mount(<TravelHaltCard halt={arrived} onPressOn={() => {}} onDismiss={() => {}} />);

    expect(view.host.querySelector(".rpg-travel-button")).toBeNull();
    expect(view.host.textContent).not.toContain("Camped");
    expect(view.host.textContent).toContain("Arrival");
    expect(view.host.textContent).toContain("You have come the whole way.");
    await view.unmount();
  });

  it("takes over the command panel so the old destination cannot be re-committed", async () => {
    const state = { character: { name: "Wren", race: "Human", resolve: 4 }, world: { travelPace: "steady" } };
    const model = { origin: { x: 0, y: 0 }, current: { tile: {} }, byKey: new Map(), viewport: [] };
    const selection = { x: 4, y: 1, key: "4,1", seen: true, visited: false, tile: { terrain: "plains" } };
    const panel = (halt) => (
      <DestinationPanel
        state={state}
        model={model}
        selection={selection}
        selectedName="Falford"
        journey={null}
        canGroundTravel
        routeMinutes={0}
        risk={0}
        focusBiome={{ name: "Moorland" }}
        focusVisual={{ image: "", accent: "#fff", mood: "" }}
        halt={halt}
        onHaltPressOn={() => {}}
        onHaltDismiss={() => {}}
        onClear={() => {}}
        onTravel={() => {}}
        onSetTravelPace={() => {}}
        canFly={false}
        teleOption={null}
        onFly={() => {}}
        onTeleport={() => {}}
        flightMount={null}
        flyPlan={{ casters: [], totalCost: 0 }}
        resolve={4}
        loading={false}
      />
    );

    const without = await mount(panel(null));
    expect(without.host.querySelector(".rpg-command-actions")).not.toBeNull();
    expect(without.host.querySelector(".rpg-travel-halt")).toBeNull();
    await without.unmount();

    const halted = await mount(panel(RAN_DRY));
    expect(halted.host.querySelector(".rpg-travel-halt")).not.toBeNull();
    expect(halted.host.querySelector(".rpg-command-actions")).toBeNull();
    expect(halted.host.textContent).not.toContain("March toward");
    await halted.unmount();
  });
});
