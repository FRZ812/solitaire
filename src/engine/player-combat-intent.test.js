import { describe, expect, it } from "vitest";
import { playerCombatDirective } from "./player-combat-intent.js";

const projection = {
  playerId: "wanderer",
  partyIds: [],
  combatTargetIds: ["bram", "mara"],
  characters: {
    wanderer: { id: "wanderer", name: "Quendar Voss", kind: "player" },
    bram: { id: "bram", name: "Bram Holt", kind: "npc", tier: "common" },
    mara: { id: "mara", name: "Mara Vale", kind: "npc", tier: "rare" },
  },
};

describe("playerCombatDirective", () => {
  it("turns an explicit attack against an exact present target into an engine-owned combat directive", () => {
    expect(playerCombatDirective("I attack Bram Holt.", projection)).toEqual({
      initiator: "player",
      surprise: false,
      lethal: true,
      foes: [{
        npc_id: "bram",
        kind: "npc",
        name: "Bram Holt",
        tier: "common",
        count: 1,
      }],
      note: "You commit to combat with Bram Holt.",
    });
  });

  it("resolves an unnamed explicit attack only when the scene has one exact combat target", () => {
    const oneTarget = { ...projection, combatTargetIds: ["mara"] };

    expect(playerCombatDirective("I attack.", oneTarget)?.foes).toEqual([{
      npc_id: "mara",
      kind: "npc",
      name: "Mara Vale",
      tier: "rare",
      count: 1,
    }]);
    expect(playerCombatDirective("I attack.", projection)).toBeNull();
  });

  it("keeps threats, negation, quoted speech, unknown targets, and ambiguous targets in narration", () => {
    for (const message of [
      "I do not attack Bram Holt.",
      "I might attack Bram Holt.",
      "Bram says I attack Mara Vale.",
      "I attack a stranger.",
      "I attack Bram Holt and Mara Vale.",
      "I attack Bram Holt and a stranger.",
      "I attack the masked stranger with Bram Holt.",
      "I attack Bram Holt if he draws steel.",
      "I attack Bram Holt? No.",
    ]) {
      expect(playerCombatDirective(message, projection), message).toBeNull();
    }
  });

  it("accepts an exact target after an ordinary attack preposition", () => {
    expect(playerCombatDirective("I strike at Bram Holt!", projection)?.foes)
      .toEqual([{ npc_id: "bram", kind: "npc", name: "Bram Holt", tier: "common", count: 1 }]);
  });

  it("marks an explicit nonlethal strike without letting the model choose lethality", () => {
    expect(playerCombatDirective("I punch Mara Vale.", projection)).toMatchObject({
      initiator: "player",
      surprise: false,
      lethal: false,
      foes: [{ npc_id: "mara", count: 1 }],
    });
  });
});
