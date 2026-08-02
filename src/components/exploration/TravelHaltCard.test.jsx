// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { DestinationPanel, TravelHaltCard } from "./WorldExploration.jsx";

const NIGHTFALL = {
  arrived: false,
  where: "a stand of birches",
  destination: "Falford",
  hexes: 6,
  minutes: 430,
  remaining: 11,
  boundaryKind: "nightfall",
  reason: "The light goes. This is as far as the day carries you.",
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
    const view = await mount(<TravelHaltCard halt={NIGHTFALL} onPressOn={() => {}} onCamp={() => {}} onDismiss={() => {}} onLeave={() => {}} />);

    expect(view.host.querySelector("h2").textContent).toBe("a stand of birches");
    expect(view.host.textContent).toContain("The day runs out");
    expect(view.host.textContent).toContain("The light goes.");
    expect(view.host.textContent).toContain("7 h 10 min");
    expect(view.host.textContent).toContain("a plank bridge, a wayside shrine");
    await view.unmount();
  });

  it("hands the next decision back rather than taking it", async () => {
    const pressedOn = [];
    const camps = [];
    const dismissals = [];
    const departures = [];
    const view = await mount(
      <TravelHaltCard
        halt={NIGHTFALL}
        onPressOn={(dest) => pressedOn.push(dest)}
        onCamp={() => camps.push(true)}
        onDismiss={() => dismissals.push(true)}
        onLeave={() => departures.push(true)}
      />,
    );

    await view.click(".rpg-travel-button");
    expect(pressedOn).toEqual([{ x: 12, y: -3 }]);

    const secondary = [...view.host.querySelectorAll(".rpg-halt-secondary")];
    expect(secondary.map((button) => button.textContent)).toEqual([
      "Make camp until morning",
      "Stay on the map",
      "Back to the story",
    ]);
    for (const button of secondary) {
      await act(async () => button.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    }
    expect([camps.length, dismissals.length, departures.length]).toEqual([1, 1, 1]);
    await view.unmount();
  });

  it("offers no onward march once the party has arrived", async () => {
    const arrived = {
      ...NIGHTFALL,
      arrived: true,
      where: "Falford",
      destination: null,
      remaining: 0,
      boundaryKind: "destination",
      reason: "",
      intendedDest: null,
    };
    const view = await mount(<TravelHaltCard halt={arrived} onPressOn={() => {}} onCamp={() => {}} onDismiss={() => {}} onLeave={() => {}} />);

    expect(view.host.querySelector(".rpg-travel-button")).toBeNull();
    // Camp belongs to a leg cut short by the dark, not to reaching the door.
    expect(view.host.textContent).not.toContain("Make camp");
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
        onHaltCamp={() => {}}
        onHaltDismiss={() => {}}
        onHaltLeave={() => {}}
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

    const halted = await mount(panel(NIGHTFALL));
    expect(halted.host.querySelector(".rpg-travel-halt")).not.toBeNull();
    expect(halted.host.querySelector(".rpg-command-actions")).toBeNull();
    expect(halted.host.textContent).not.toContain("March toward");
    await halted.unmount();
  });
});
