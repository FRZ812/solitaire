import { describe, expect, it } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import { applyBeat } from "./beat.js";
import {
  deleteBeat,
  editBeat,
  narratorMessageForPendingPlayers,
  pendingPlayerBeats,
  recordTurn,
  rewindToPlayerBeat,
  turnStartedAt,
} from "./timeline.js";

function completedTurn(playerLines = ["Wait here."]) {
  const initial = { ...makeInitialState(), created: true };
  const playerBeats = playerLines.map((content, index) => ({ id: `p${index}`, type: "player", content }));
  const base = { ...initial, beats: [...initial.beats, ...playerBeats] };
  const response = {
    story: [
      { type: "beat", text: "The keeper looks toward the door." },
      { type: "dialogue", name: "Keeper", line: "As you like." },
      { type: "beat", text: "Rain gathers in the sill." },
    ],
    _userMsg: "queued prompt",
  };
  response._raw = JSON.stringify(response);
  const next = applyBeat(base, response);
  return { base, recorded: recordTurn(base, "queued prompt", next), playerBeats };
}

describe("queued player messages and rewind", () => {
  it("treats every queued player bubble as input to the completed turn", () => {
    const { recorded, playerBeats } = completedTurn(["Wait here.", "And bar the door."]);
    const indices = playerBeats.map((beat) => recorded.beats.findIndex((item) => item.id === beat.id));

    expect(indices.map((index) => turnStartedAt(recorded, index))).toEqual([0, 0]);
  });

  it("rewinds the latest player bubble into pending input without requiring new text", () => {
    const { recorded, playerBeats } = completedTurn();
    const index = recorded.beats.findIndex((beat) => beat.id === playerBeats[0].id);
    const rewound = rewindToPlayerBeat(recorded, index);

    expect(rewound.beats.at(-1)).toMatchObject({ type: "player", content: "Wait here." });
    expect(pendingPlayerBeats(rewound).map((beat) => beat.content)).toEqual(["Wait here."]);
    expect(rewound.beats.some((beat) => beat.content === "The keeper looks toward the door.")).toBe(false);
    expect(rewound.turns).toEqual([]);
  });

  it("restores a companion removed and marked dead by the narrator", () => {
    const initial = { ...makeInitialState(), created: true };
    const recruited = applyBeat(initial, { recruit_companion: { id: "bram" } });
    const playerBeat = { id: "p-death", type: "player", content: "I pull Bram clear." };
    const base = { ...recruited, beats: [...recruited.beats, playerBeat] };
    const response = {
      story: [{ type: "beat", text: "The stones fall before you can reach him." }],
      party_removals: [{ id: "bram", reason: "dead" }],
      _raw: "{}",
      _userMsg: "queued prompt",
    };
    const recorded = recordTurn(base, "queued prompt", applyBeat(base, response));
    const playerIndex = recorded.beats.findIndex((beat) => beat.id === playerBeat.id);

    expect(recorded.party).not.toContain("bram");
    expect(recorded.world.codex.characters.bram.combatState?.status).toBe("dead");

    const rewound = rewindToPlayerBeat(recorded, playerIndex);
    expect(rewound.party).toContain("bram");
    expect(rewound.world.codex.characters.bram.combatState).toBeUndefined();
    expect(pendingPlayerBeats(rewound).map((beat) => beat.content)).toEqual(["I pull Bram clear."]);
  });

  it("builds one chronological narrator prompt from multiple queued bubbles", () => {
    const initial = { ...makeInitialState(), created: true };
    const queued = {
      ...initial,
      beats: [
        ...initial.beats,
        { id: "p1", type: "player", content: "I take the parcel." },
        { id: "p2", type: "player", content: "Then I ask who sent it." },
      ],
    };

    expect(narratorMessageForPendingPlayers(queued)).toContain("1. I take the parcel.\n2. Then I ask who sent it.");
    expect(narratorMessageForPendingPlayers(initial)).toMatch(/^\[CONTINUE STORY\]/);
  });
});

describe("ordered story timeline editing", () => {
  it("edits and deletes the matching ordered story entries in model history", () => {
    const { recorded } = completedTurn();
    const narration = recorded.beats.find((beat) => beat.content === "The keeper looks toward the door.");
    const dialogue = recorded.beats.find((beat) => beat.line === "As you like.");

    const edited = editBeat(recorded, narration.id, "The keeper watches the rain.");
    const afterEdit = JSON.parse(edited.apiHistory.findLast((entry) => entry.role === "assistant").content);
    expect(afterEdit.story[0].text).toBe("The keeper watches the rain.");

    const deleted = deleteBeat(edited, dialogue.id);
    const afterDelete = JSON.parse(deleted.apiHistory.findLast((entry) => entry.role === "assistant").content);
    expect(afterDelete.story.map((item) => item.type)).toEqual(["beat", "beat"]);
  });
});
