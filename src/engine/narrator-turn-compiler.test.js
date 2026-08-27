import { describe, expect, it } from "vitest";
import { resolveNarratorIntents } from "../gameplay/campaign/command-gateway.js";
import { readPendingCombatDirective } from "../gameplay/production/pending-directive.js";
import { compileNarratorCandidate } from "./narrator-turn-compiler.js";

function candidate(overrides = {}) {
  return {
    contract_version: 2,
    state_revision: "turn-7",
    story: [{ type: "dialogue", speaker: { kind: "character", id: "mara" }, line: "Drink up." }],
    minutes_passed: 0,
    roll: null,
    encounter: null,
    vitality_change: 0,
    resolve_change: 0,
    new_conditions: null,
    tile_discovery: null,
    tile_move: null,
    start_combat: null,
    assassination: null,
    location_update: null,
    discoveries: null,
    inventory_changes: null,
    knowledge_updates: null,
    attribute_changes: null,
    needs_changes: null,
    recruit_companion: null,
    grant_mount: null,
    buy_mount: null,
    purchase_captive: null,
    purchase_rights: null,
    part_ways: null,
    party_removals: null,
    companion_gear: null,
    relationship_changes: null,
    memory_updates: null,
    progression_focus: null,
    character_setup: null,
    player_update: null,
    ...overrides,
  };
}

function completeNewCharacter(overrides = {}) {
  return {
    id: "bram-holt",
    name: "Bram Holt",
    race: "human",
    gender: "male",
    level: 2,
    racial_levels: 0,
    profession_plan: [{ profession: "warrior", specialization: "wagoner", levels: 2 }],
    origin: "central",
    age: 38,
    agingMode: "mortal",
    attractiveness: 5,
    appearance: {
      skin: "weathered tan",
      hair: "black shot with grey",
      eyes: "brown",
      build: "broad",
      facial_hair: "stubble",
      marks: "scarred forearm",
    },
    attributes: { body: 3, reflex: 2, vigor: 3, mind: 1, wit: 2, presence: 1 },
    base_appearance: "Broad and weathered, with a scar along one forearm.",
    description: "A wagoner accustomed to repairs on bad roads.",
    worn: [],
    knows: ["The wagon's rear wheel has a cracked spoke."],
    ...overrides,
  };
}

const projection = {
  contractVersion: 2,
  stateRevision: "turn-7",
  playerId: "wanderer",
  characters: {
    wanderer: { id: "wanderer", kind: "player", name: "Quendar Voss" },
    mara: { id: "mara", kind: "npc", name: "Mara Vale", tier: "rare" },
  },
  presentSpeakerIds: ["mara"],
  assassinationAttempts: { mara: { methods: ["basic", "execute"] } },
  assassinationTargets: { mara: { methods: ["basic", "execute"] } },
  currentTile: { x: 3, y: 4, day: 9 },
};

const presentationOnly = { allowedEffects: [] };

describe("compileNarratorCandidate", () => {
  it("accepts a narrator-resolved death only through the exact stat-and-ability capability", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({
        story: [{
          type: "beat",
          cue: { kind: "character", actor_id: "mara", action: "dies", target_id: null, manner: null },
        }],
        assassination: {
          target_id: "mara", method: "execute", outcome: "killed", surprise: null,
        },
      }),
      projection,
      turnPolicy: { allowedEffects: ["assassination"] },
    });

    expect(result).toEqual({
      ok: true,
      turn: expect.objectContaining({
        assassination: {
          target_id: "mara", method: "execute", outcome: "killed", surprise: null,
        },
        start_combat: null,
        story: [{ type: "beat", actorId: "mara", text: "Mara Vale dies." }],
      }),
    });
  });

  it("rejects a closed character action after that canonical actor dies in the same story", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({
        story: [
          {
            type: "beat",
            cue: { kind: "character", actor_id: "mara", action: "dies", target_id: null, manner: null },
          },
          {
            type: "beat",
            cue: { kind: "character", actor_id: "mara", action: "stands", target_id: null, manner: null },
          },
        ],
        assassination: {
          target_id: "mara", method: "execute", outcome: "killed", surprise: null,
        },
      }),
      projection,
      turnPolicy: { allowedEffects: ["assassination"] },
    });

    expect(result).toMatchObject({
      ok: false,
      violations: expect.arrayContaining([
        expect.objectContaining({ code: "DEAD_CHARACTER_ACTION", path: "/story/1/cue/actor_id" }),
      ]),
    });
  });

  it("rejects assassination death outside the exact target/method capability", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({
        story: [{
          type: "beat",
          cue: { kind: "character", actor_id: "mara", action: "dies", target_id: null, manner: null },
        }],
        assassination: {
          target_id: "mara", method: "not-owned", outcome: "killed", surprise: null,
        },
      }),
      projection,
      turnPolicy: { allowedEffects: ["assassination"] },
    });

    expect(result).toMatchObject({
      ok: false,
      violations: expect.arrayContaining([
        expect.objectContaining({ code: "ASSASSINATION_GUARD", path: "/assassination/method" }),
      ]),
    });
  });

  it("requires a matching closed death cue and forbids a simultaneous combat handoff", () => {
    const withoutReceipt = compileNarratorCandidate({
      candidate: candidate({
        story: [{
          type: "beat",
          cue: { kind: "character", actor_id: "mara", action: "dies", target_id: null, manner: null },
        }],
      }),
      projection,
      turnPolicy: { allowedEffects: ["assassination"] },
    });
    const withCombat = compileNarratorCandidate({
      candidate: candidate({
        story: [{
          type: "beat",
          cue: { kind: "character", actor_id: "mara", action: "dies", target_id: null, manner: null },
        }],
        assassination: {
          target_id: "mara", method: "basic", outcome: "killed", surprise: null,
        },
        start_combat: {
          initiator: "player",
          surprise: true,
          lethal: true,
          foes: [{ npc_id: "mara", kind: "guard", name: "Mara Vale" }],
          note: "The attempt becomes a fight.",
        },
      }),
      projection,
      turnPolicy: { allowedEffects: ["assassination", "start_combat"] },
    });

    expect(withoutReceipt).toMatchObject({
      ok: false,
      violations: expect.arrayContaining([
        expect.objectContaining({ code: "ASSASSINATION_PRESENTATION" }),
      ]),
    });
    expect(withCombat).toMatchObject({
      ok: false,
      violations: expect.arrayContaining([
        expect.objectContaining({ code: "ASSASSINATION_CONFLICT" }),
      ]),
    });
  });

  it("permits an assassination attempt to end without death or combat", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({
        story: [{ type: "beat", cue: { kind: "scene", event: "silence-settles" } }],
      }),
      projection,
      turnPolicy: { allowedEffects: ["assassination"] },
    });

    expect(result.ok).toBe(true);
    expect(result.turn.assassination).toBeNull();
    expect(result.turn.start_combat).toBeNull();
  });

  it("materializes combat only for a guarded assassination attempt marked detected", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({
        assassination: {
          target_id: "mara", method: "basic", outcome: "detected-combat", surprise: true,
        },
      }),
      projection,
      turnPolicy: { allowedEffects: ["assassination"] },
    });

    expect(result).toEqual({
      ok: true,
      turn: expect.objectContaining({
        assassination: {
          target_id: "mara", method: "basic", outcome: "detected-combat", surprise: true,
        },
        start_combat: {
          initiator: "enemy",
          surprise: true,
          lethal: true,
          foes: [{ npc_id: "mara", kind: "npc", name: "Mara Vale", tier: "rare", count: 1 }],
          note: "Mara Vale survives the assassination attempt and fights back.",
        },
      }),
    });
  });

  it("settles a guarded survived-undetected outcome without materializing combat", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({
        assassination: {
          target_id: "mara", method: "basic", outcome: "survived-undetected", surprise: null,
        },
      }),
      projection,
      turnPolicy: { allowedEffects: ["assassination"] },
    });

    expect(result.ok).toBe(true);
    expect(result.turn.start_combat).toBeNull();
    expect(result.turn.assassination.outcome).toBe("survived-undetected");
  });

  it("rejects legacy model-adjudicated combat effects at the wire boundary", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({
        combat_effect: {
          narration: "The adventurer accepts the opening and drives the blade home.",
          target: "Mara Vale",
          kind: "attack",
          magnitude: "major",
          damage_type: "physical",
          status: null,
          social: null,
        },
      }),
      projection,
      turnPolicy: { allowedEffects: ["combat_effect"] },
    });

    expect(result).toMatchObject({
      ok: false,
      violations: expect.arrayContaining([
        expect.objectContaining({ code: "SCHEMA_UNKNOWN_KEY", path: "/combat_effect" }),
      ]),
    });
  });

  it.each([
    ["an unsupported initiator", { initiator: "narrator" }],
    ["an expanded foe count beyond the handoff limit", { foes: [{ npc_id: "mara", kind: "npc", name: "Mara Vale", tier: "rare", count: 17 }] }],
    ["an unknown foe tier", { foes: [{ npc_id: "mara", kind: "npc", name: "Mara Vale", tier: "cosmic", count: 1 }] }],
    ["an oversized note", { note: "x".repeat(2_001) }],
  ])("rejects start_combat with %s before minting a compiled turn", (_label, override) => {
    const startCombat = {
      initiator: "player",
      surprise: false,
      lethal: true,
      foes: [{ npc_id: "mara", kind: "npc", name: "Mara Vale", tier: "rare", count: 1 }],
      note: "Blades are drawn.",
      ...override,
    };
    const result = compileNarratorCandidate({
      candidate: candidate({ start_combat: startCombat }),
      projection,
      turnPolicy: { id: "loot-fallout", allowedEffects: ["start_combat"] },
    });

    expect(result).toMatchObject({
      ok: false,
      violations: expect.arrayContaining([
        expect.objectContaining({ code: "COMBAT_HANDOFF", path: "/start_combat" }),
      ]),
    });
  });

  it("guarantees every compiled start_combat value is accepted by the persisted handoff boundary", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({
        start_combat: {
          initiator: "player",
          surprise: false,
          lethal: true,
          foes: [{ npc_id: "mara", kind: "npc", name: "Mara Vale", tier: "rare", count: 1 }],
          note: "Blades are drawn.",
        },
      }),
      projection,
      turnPolicy: { id: "loot-fallout", allowedEffects: ["start_combat"] },
    });

    expect(result.ok).toBe(true);
    expect(readPendingCombatDirective(result.turn.start_combat)).toMatchObject({ ok: true });
  });

  it("rejects owner-refused mechanics before story or raw history can be branded for application", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({
        memory_updates: [{ id: "mara", adds: ["a", "b", "c", "d", "e"] }],
      }),
      projection,
      turnPolicy: { id: "general-action", allowedEffects: ["memory_updates"] },
      state: {
        character: { vitality: 10, vitalityMax: 10, resolve: 5, resolveMax: 5 },
        party: [],
        world: { codex: { characters: projection.characters, items: {} } },
      },
      metadata: { raw: "provider output that must not persist" },
    });

    expect(result).toMatchObject({
      ok: false,
      violations: expect.arrayContaining([
        expect.objectContaining({
          code: "OWNER_REFUSAL",
          path: "/memory_updates",
          message: expect.stringContaining("too-many-memories"),
        }),
      ]),
    });
  });

  it("validates typed memory proposals before minting them as trusted metadata", () => {
    const state = {
      character: { vitality: 10, vitalityMax: 10, resolve: 5, resolveMax: 5 },
      party: [],
      world: { codex: { characters: projection.characters, items: {} } },
    };
    const result = compileNarratorCandidate({
      candidate: candidate(),
      projection,
      turnPolicy: presentationOnly,
      state,
      metadata: {
        memories: ["arbitrary flat canon"],
        memoryProposals: [{
          kind: "belief",
          subjectIds: ["mara"],
          scopeIds: ["campaign"],
          text: "Mara believes the old road is watched.",
          evidence: [],
        }],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.turn._memoryProposals).toEqual([{
      kind: "belief",
      subjectIds: ["mara"],
      scopeIds: ["campaign"],
      text: "Mara believes the old road is watched.",
      evidence: [],
    }]);
    expect(result.turn._memories).toEqual(["Mara believes the old road is watched."]);
    expect(result.turn._memories).not.toContain("arbitrary flat canon");
  });

  it("rejects receipt evidence that is not bound to an accepted intent receipt", () => {
    const state = {
      character: { vitality: 10, vitalityMax: 10, resolve: 5, resolveMax: 5 },
      party: [],
      world: { codex: { characters: projection.characters, items: {} } },
    };
    const result = compileNarratorCandidate({
      candidate: candidate(),
      projection,
      turnPolicy: presentationOnly,
      state,
      metadata: {
        memoryProposals: [{
          kind: "event",
          subjectIds: ["mara"],
          scopeIds: ["campaign"],
          text: "Mara surrendered the bridge.",
          evidence: [{ kind: "receipt", id: "intent-forged" }],
        }],
      },
    });

    expect(result).toMatchObject({
      ok: false,
      violations: expect.arrayContaining([
        expect.objectContaining({ code: "MEMORY_PROVENANCE", path: "/_memoryProposals/0" }),
      ]),
    });
  });

  it("accepts receipt evidence bound to the gateway decision for this candidate", () => {
    const state = {
      character: { vitality: 10, vitalityMax: 10, resolve: 5, resolveMax: 5 },
      party: [],
      world: { codex: { characters: projection.characters, items: {} } },
    };
    const turn = candidate({
      assassination: {
        target_id: "mara", method: "basic", outcome: "survived-undetected", surprise: null,
      },
    });
    const turnPolicy = { id: "general-action", allowedEffects: ["assassination"] };
    const receiptId = resolveNarratorIntents(state, turn, {
      stateRevision: projection.stateRevision,
      turnPolicy,
    }).receipts.find(({ field }) => field === "assassination").id;
    const result = compileNarratorCandidate({
      candidate: turn,
      projection,
      turnPolicy,
      state,
      metadata: {
        memoryProposals: [{
          kind: "event",
          subjectIds: ["mara"],
          scopeIds: ["campaign"],
          text: "Mara survived the attempt without raising an alarm.",
          evidence: [{ kind: "receipt", id: receiptId }],
        }],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.turn._memoryProposals[0].evidence).toEqual([{ kind: "receipt", id: receiptId }]);
  });

  it("derives a present NPC speaker's display identity from the authoritative projection", () => {
    const result = compileNarratorCandidate({ candidate: candidate(), projection, turnPolicy: presentationOnly });

    expect(result).toEqual({
      ok: true,
      turn: expect.objectContaining({
        story: [{ type: "dialogue", speakerId: "mara", name: "Mara Vale", line: "Drink up." }],
      }),
    });
    expect(Object.isFrozen(result.turn)).toBe(true);
  });

  it("derives a closed character action's portrait actor from the authoritative projection", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({
        story: [{
          type: "beat",
          cue: {
            kind: "character",
            actor_id: "mara",
            action: "waits",
            target_id: null,
            manner: "quietly",
          },
        }],
      }),
      projection,
      turnPolicy: presentationOnly,
    });

    expect(result).toEqual({
      ok: true,
      turn: expect.objectContaining({
        story: [{ type: "beat", actorId: "mara", text: "Mara Vale waits quietly." }],
      }),
    });
  });

  it("does not turn an engine-authorized remote scry target into a present dialogue speaker", () => {
    const remoteProjection = {
      ...projection,
      characters: {
        ...projection.characters,
        "remote-rook": { id: "remote-rook", kind: "npc", name: "Remote Rook" },
      },
    };
    const result = compileNarratorCandidate({
      candidate: candidate({
        story: [{ type: "dialogue", speaker: { kind: "character", id: "remote-rook" }, line: "The mirror clouds." }],
      }),
      projection: remoteProjection,
      turnPolicy: { allowedEffects: [], storyCharacterIds: ["remote-rook"] },
    });

    expect(result).toMatchObject({
      ok: false,
      violations: expect.arrayContaining([
        expect.objectContaining({ code: "INVALID_SPEAKER", path: "/story/0/speaker" }),
      ]),
    });
  });

  it("admits an engine-authorized remote scry target as a canonical narrative reference", () => {
    const remoteProjection = {
      ...projection,
      characters: {
        ...projection.characters,
        "remote-rook": { id: "remote-rook", kind: "npc", name: "Remote Rook" },
      },
    };
    const result = compileNarratorCandidate({
      candidate: candidate({
        story: [{
          type: "beat",
          cue: {
            kind: "character",
            actor_id: "remote-rook",
            action: "waits",
            target_id: null,
            manner: "quietly",
          },
        }],
      }),
      projection: remoteProjection,
      turnPolicy: { allowedEffects: [], storyCharacterIds: ["remote-rook"] },
    });

    expect(result).toEqual({
      ok: true,
      turn: expect.objectContaining({
        story: [{ type: "beat", actorId: "remote-rook", text: "Remote Rook waits quietly." }],
      }),
    });
  });

  it.each([
    "You agree to the bargain, sign the writ, and surrender the key.",
    '"I agree," you say before handing over the key.',
    "Quendar Voss decides the bargain is fair and signs the writ.",
    "The adventurer accepts the bargain and places the key on the table.",
  ])("rejects narrator prose that authors player agency: %s", (text) => {
    const result = compileNarratorCandidate({
      candidate: candidate({ story: [{ type: "beat", text, character_ids: [] }] }),
      projection,
      turnPolicy: presentationOnly,
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: "PLAYER_SOVEREIGNTY",
      path: "/story/0/text",
    }));
  });

  it("compiles a closed scene cue into engine-owned presentation text", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({
        story: [{ type: "beat", cue: { kind: "scene", event: "wind-rises" } }],
      }),
      projection,
      turnPolicy: presentationOnly,
    });

    expect(result).toEqual({
      ok: true,
      turn: expect.objectContaining({
        story: [{ type: "beat", text: "Wind rises through the scene." }],
      }),
    });
  });

  it("rejects the player as a structured presentation actor or target", () => {
    for (const cue of [
      { kind: "character", actor_id: "player", action: "waits", target_id: null, manner: null },
      { kind: "character", actor_id: "mara", action: "approaches", target_id: "player", manner: null },
    ]) {
      const result = compileNarratorCandidate({
        candidate: candidate({ story: [{ type: "beat", cue }] }),
        projection,
        turnPolicy: presentationOnly,
      });

      expect(result.ok).toBe(false);
      expect(result.violations).toContainEqual(expect.objectContaining({
        code: "UNKNOWN_CHARACTER_REF",
      }));
    }
  });

  it.each([
    ["missing cue", { type: "beat" }, "SCHEMA_TYPE", "/story/0/cue"],
    ["scalar cue", { type: "beat", cue: "wind-rises" }, "SCHEMA_TYPE", "/story/0/cue"],
    ["unknown cue kind", { type: "beat", cue: { kind: "player", event: "wind-rises" } }, "SCHEMA_TYPE", "/story/0/cue/kind"],
    ["unknown scene event", { type: "beat", cue: { kind: "scene", event: "player-agrees" } }, "SCHEMA_TYPE", "/story/0/cue/event"],
    ["unknown scene field", { type: "beat", cue: { kind: "scene", event: "wind-rises", text: "hidden" } }, "SCHEMA_UNKNOWN_KEY", "/story/0/cue/text"],
    ["unknown character action", { type: "beat", cue: { kind: "character", actor_id: "mara", action: "accepts", target_id: null, manner: null } }, "SCHEMA_TYPE", "/story/0/cue/action"],
    ["missing character target", { type: "beat", cue: { kind: "character", actor_id: "mara", action: "waits", manner: null } }, "UNKNOWN_CHARACTER_REF", "/story/0/cue/target_id"],
    ["target on untargeted action", { type: "beat", cue: { kind: "character", actor_id: "mara", action: "waits", target_id: "mara", manner: null } }, "SCHEMA_TYPE", "/story/0/cue/target_id"],
    ["unknown character manner", { type: "beat", cue: { kind: "character", actor_id: "mara", action: "waits", target_id: null, manner: "obediently" } }, "SCHEMA_TYPE", "/story/0/cue/manner"],
  ])("fails closed for malformed structured presentation: %s", (_label, storyItem, code, path) => {
    expect(() => compileNarratorCandidate({
      candidate: candidate({ story: [storyItem] }),
      projection,
      turnPolicy: presentationOnly,
    })).not.toThrow();

    const result = compileNarratorCandidate({
      candidate: candidate({ story: [storyItem] }),
      projection,
      turnPolicy: presentationOnly,
    });
    expect(result.ok).toBe(false);
    expect(result.violations).toContainEqual(expect.objectContaining({ code, path }));
  });

  it("still permits canonical NPC dialogue to address the player without speaking for them", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({
        story: [{
          type: "dialogue",
          speaker: { kind: "character", id: "mara" },
          line: "Will you hear my offer?",
        }],
      }),
      projection,
      turnPolicy: presentationOnly,
    });

    expect(result.ok).toBe(true);
    expect(result.turn.story).toEqual([{
      type: "dialogue",
      speakerId: "mara",
      name: "Mara Vale",
      line: "Will you hear my offer?",
    }]);
  });

  it("rejects a fresh network response using the legacy wire contract", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({ contract_version: 1 }),
      projection,
      turnPolicy: presentationOnly,
    });

    expect(result).toEqual({
      ok: false,
      violations: [expect.objectContaining({ code: "SCHEMA_VERSION", path: "/contract_version" })],
    });
  });

  it("rejects unknown top-level fields rather than silently extending model authority", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({ quest_completed: "crown-the-wanderer" }),
      projection,
      turnPolicy: presentationOnly,
    });

    expect(result).toEqual({
      ok: false,
      violations: [expect.objectContaining({ code: "SCHEMA_UNKNOWN_KEY", path: "/quest_completed" })],
    });
  });

  it("requires every top-level field in the versioned response envelope", () => {
    const missingStory = candidate();
    delete missingStory.story;

    const result = compileNarratorCandidate({ candidate: missingStory, projection, turnPolicy: presentationOnly });

    expect(result).toEqual({
      ok: false,
      violations: expect.arrayContaining([
        expect.objectContaining({ code: "SCHEMA_MISSING_KEY", path: "/story" }),
      ]),
    });
  });

  it("rejects a response that is not bound to the captured state revision", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({ state_revision: "turn-6" }),
      projection,
      turnPolicy: presentationOnly,
    });

    expect(result).toEqual({
      ok: false,
      violations: [expect.objectContaining({ code: "STALE_STATE", path: "/state_revision" })],
    });
  });

  it("rejects an empty story before any renderer or reducer sees it", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({ story: [] }),
      projection,
      turnPolicy: presentationOnly,
    });

    expect(result).toEqual({
      ok: false,
      violations: [expect.objectContaining({ code: "SCHEMA_TYPE", path: "/story" })],
    });
  });

  it("rejects unknown story node types instead of silently dropping them", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({ story: [{ type: "choice", options: ["Go"] }] }),
      projection,
      turnPolicy: presentationOnly,
    });

    expect(result).toEqual({
      ok: false,
      violations: [expect.objectContaining({ code: "SCHEMA_TYPE", path: "/story/0/type" })],
    });
  });

  it("rejects model-authored dialogue display names from the recursive schema", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({ story: [{
        type: "dialogue",
        speaker: { kind: "character", id: "mara" },
        name: "Bram",
        line: "Drink up.",
      }] }),
      projection,
      turnPolicy: presentationOnly,
    });

    expect(result).toEqual({
      ok: false,
      violations: [expect.objectContaining({ code: "SCHEMA_UNKNOWN_KEY", path: "/story/0/name" })],
    });
  });

  it("rejects empty dialogue before rendering", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({
        story: [{ type: "dialogue", speaker: { kind: "character", id: "mara" }, line: "" }],
      }),
      projection,
      turnPolicy: presentationOnly,
    });

    expect(result).toEqual({
      ok: false,
      violations: [expect.objectContaining({ code: "SCHEMA_TYPE", path: "/story/0/line" })],
    });
  });

  it("rejects narration that structurally references an undeclared character", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({ story: [{
        type: "beat",
        cue: {
          kind: "character",
          actor_id: "bram",
          action: "works",
          target_id: null,
          manner: null,
        },
      }] }),
      projection,
      turnPolicy: presentationOnly,
    });

    expect(result).toEqual({
      ok: false,
      violations: [expect.objectContaining({ code: "UNKNOWN_CHARACTER_REF", path: "/story/0/cue/actor_id" })],
    });
  });

  it("admits a complete same-response character before resolving their dialogue", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({
        story: [{
          type: "dialogue",
          speaker: { kind: "character", id: "bram-holt" },
          line: "Give me a moment.",
        }],
        discoveries: {
          characters: [completeNewCharacter()],
          races: [], items: [], spells: [], skills: [],
        },
      }),
      projection,
      turnPolicy: { allowedEffects: ["discoveries"] },
    });

    expect(result).toEqual({
      ok: true,
      turn: expect.objectContaining({
        story: [{
          type: "dialogue",
          speakerId: "bram-holt",
          name: "Bram Holt",
          line: "Give me a moment.",
        }],
        discoveries: expect.objectContaining({
          characters: [expect.objectContaining({
            id: "bram-holt",
            at: { x: 3, y: 4, day: 9 },
          })],
        }),
      }),
    });
  });

  it("rejects unknown nested fields in a new character definition", () => {
    const character = completeNewCharacter({
      profession_plan: [{ profession: "warrior", specialization: "wagoner", levels: 2, godhood: true }],
    });
    const result = compileNarratorCandidate({
      candidate: candidate({
        discoveries: { characters: [character], races: [], items: [], spells: [], skills: [] },
      }),
      projection,
      turnPolicy: { allowedEffects: ["discoveries"] },
    });

    expect(result).toEqual({
      ok: false,
      violations: [expect.objectContaining({
        code: "SCHEMA_UNKNOWN_KEY",
        path: "/discoveries/characters/0/profession_plan/0/godhood",
      })],
    });
  });

  it("rejects an effect class that the engine did not issue for this turn", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({
        inventory_changes: {
          added: [{ itemId: "hardtack", quantity: 1 }],
          removed: [],
          coins: { copper: 0, silver: 0, gold: 0 },
        },
      }),
      projection,
      turnPolicy: presentationOnly,
    });

    expect(result).toEqual({
      ok: false,
      violations: [expect.objectContaining({ code: "ILLEGAL_EFFECT", path: "/inventory_changes" })],
    });
  });

  it("does not treat prototype-chain names as canonical character ids", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({ recruit_companion: { id: "constructor" } }),
      projection,
      turnPolicy: { allowedEffects: ["recruit_companion"] },
    });

    expect(result).toEqual({
      ok: false,
      violations: expect.arrayContaining([
        expect.objectContaining({ code: "UNKNOWN_CHARACTER_REF", path: "/recruit_companion/id" }),
      ]),
    });
  });

  it("reports malformed engine effect authorization instead of throwing", () => {
    const compile = () => compileNarratorCandidate({
      candidate: candidate(),
      projection,
      turnPolicy: { allowedEffects: { injected: true } },
    });

    expect(compile).not.toThrow();
    expect(compile()).toEqual({
      ok: false,
      violations: expect.arrayContaining([
        expect.objectContaining({ code: "MALFORMED_CAPABILITY", path: "/turn_policy/allowedEffects" }),
      ]),
    });
  });

  it.each([
    [[], "/turn_policy/effectConstraints"],
    [{ buy_mount: 7 }, "/turn_policy/effectConstraints/buy_mount"],
    [{ buy_mount: { fields: [] } }, "/turn_policy/effectConstraints/buy_mount/fields"],
    [{ relationship_changes: { eachFields: "mara" } }, "/turn_policy/effectConstraints/relationship_changes/eachFields"],
  ])("reports malformed engine effect constraints instead of throwing", (effectConstraints, path) => {
    const compile = () => compileNarratorCandidate({
      candidate: candidate(),
      projection,
      turnPolicy: { allowedEffects: Object.keys(effectConstraints), effectConstraints },
    });

    expect(compile).not.toThrow();
    expect(compile()).toMatchObject({
      ok: false,
      violations: expect.arrayContaining([
        expect.objectContaining({ code: "MALFORMED_CAPABILITY", path }),
      ]),
    });
  });

  it("rejects unknown allowed effects and malformed continuation authority", () => {
    for (const turnPolicy of [
      { allowedEffects: ["constructor"] },
      { allowedEffects: [], continuation: { terminalEffect: "__proto__" } },
    ]) {
      const result = compileNarratorCandidate({ candidate: candidate(), projection, turnPolicy });
      expect(result).toEqual({
        ok: false,
        violations: expect.arrayContaining([
          expect.objectContaining({ code: "MALFORMED_CAPABILITY" }),
        ]),
      });
    }
  });

  it.each([
    ["races", null, "/discoveries/races/0"],
    ["items", { id: "only-an-id" }, "/discoveries/items/0/name"],
    ["items", { id: "__proto__", name: "Poison", kind: "other", appearance: "plain", description: "bad" }, "/discoveries/items/0/id"],
    ["spells", { id: "spark", name: "Spark", description: "A spark.", acquisition: 7 }, "/discoveries/spells/0/acquisition"],
    ["skills", { id: "watch", name: "Watch", description: "Remain alert.", tier: "impossible" }, "/discoveries/skills/0/tier"],
  ])("rejects malformed or unsafe %s discovery entries", (collection, entry, path) => {
    const discoveries = { characters: [], races: [], items: [], spells: [], skills: [] };
    discoveries[collection] = [entry];
    const result = compileNarratorCandidate({
      candidate: candidate({ discoveries }),
      projection,
      turnPolicy: { allowedEffects: ["discoveries"] },
    });

    expect(result).toEqual({
      ok: false,
      violations: expect.arrayContaining([
        expect.objectContaining({ code: "SCHEMA_TYPE", path }),
      ]),
    });
  });

  it("rejects a catalog item addition that the reducer would silently drop", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({
        inventory_changes: {
          added: [{ itemId: "invented-crownblade", quantity: 1 }],
          removed: [],
          coins: { copper: 0, silver: 0, gold: 0 },
        },
      }),
      projection,
      turnPolicy: { allowedEffects: ["inventory_changes"] },
    });

    expect(result).toEqual({
      ok: false,
      violations: [expect.objectContaining({
        code: "REDUCER_PRECONDITION",
        path: "/inventory_changes/added/0/itemId",
      })],
    });
  });

  it("rejects a canonical character departure that the reducer would ignore because they are not in the party", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({ part_ways: { id: "remote" } }),
      projection: {
        ...projection,
        characters: {
          ...projection.characters,
          remote: { id: "remote", kind: "npc", name: "Remote Rook" },
        },
        partyIds: ["mara"],
      },
      turnPolicy: { allowedEffects: ["part_ways"] },
    });

    expect(result).toEqual({
      ok: false,
      violations: [expect.objectContaining({
        code: "REDUCER_PRECONDITION",
        path: "/part_ways/id",
      })],
    });
  });

  it("rejects an unknown mount that the reducer would silently drop", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({ grant_mount: { id: "invented-sky-stag", name: "Gale" } }),
      projection,
      turnPolicy: { allowedEffects: ["grant_mount"] },
    });

    expect(result).toEqual({
      ok: false,
      violations: [expect.objectContaining({
        code: "REDUCER_PRECONDITION",
        path: "/grant_mount/id",
      })],
    });
  });

  it("rejects a coin settlement that the reducer would silently drop as unaffordable", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({
        buy_mount: {
          id: "horse",
          priceCp: 100,
          name: "Ash",
          settlement: "coin",
          settlementNote: "",
        },
      }),
      projection: { ...projection, availableCopper: 0, partyIds: [] },
      turnPolicy: { allowedEffects: ["buy_mount"] },
    });

    expect(result).toEqual({
      ok: false,
      violations: expect.arrayContaining([
        expect.objectContaining({ code: "REDUCER_PRECONDITION", path: "/buy_mount/priceCp" }),
      ]),
    });
  });

  it("rejects character setup after creation because the reducer would silently ignore it", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({ character_setup: { name: "Replacement" } }),
      projection: { ...projection, created: true },
      turnPolicy: { allowedEffects: ["character_setup"] },
    });

    expect(result).toEqual({
      ok: false,
      violations: expect.arrayContaining([expect.objectContaining({
        code: "REDUCER_PRECONDITION",
        path: "/character_setup",
      })]),
    });
  });

  it("rejects a granted scalar effect outside its engine-issued value constraint", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({ minutes_passed: 11 }),
      projection,
      turnPolicy: {
        ...presentationOnly,
        allowedEffects: ["minutes_passed"],
        effectConstraints: { minutes_passed: { equals: 10 } },
      },
    });

    expect(result).toEqual({
      ok: false,
      violations: [expect.objectContaining({
        code: "CAPABILITY_CONSTRAINT",
        path: "/minutes_passed",
      })],
    });
  });

  it("rejects an object effect targeting an entity outside its engine-issued constraint", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({ buy_mount: { id: "pony" } }),
      projection,
      turnPolicy: {
        ...presentationOnly,
        allowedEffects: ["buy_mount"],
        effectConstraints: { buy_mount: { fields: { id: "horse" } } },
      },
    });

    expect(result).toEqual({
      ok: false,
      violations: expect.arrayContaining([expect.objectContaining({
        code: "CAPABILITY_CONSTRAINT",
        path: "/buy_mount/id",
      })]),
    });
  });

  it("rejects an array effect entry outside its engine-issued target constraint", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({ relationship_changes: [{ id: "other-npc", delta: 1 }] }),
      projection: {
        ...projection,
        characters: {
          ...projection.characters,
          "other-npc": { id: "other-npc", name: "Other NPC" },
        },
      },
      turnPolicy: {
        ...presentationOnly,
        allowedEffects: ["relationship_changes"],
        effectConstraints: { relationship_changes: { eachFields: { id: "mara" } } },
      },
    });

    expect(result).toEqual({
      ok: false,
      violations: [expect.objectContaining({
        code: "CAPABILITY_CONSTRAINT",
        path: "/relationship_changes/0/id",
      })],
    });
  });

  it("rejects malformed top-level effect shapes before reducer access", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({ minutes_passed: "five" }),
      projection,
      turnPolicy: { allowedEffects: ["minutes_passed"] },
    });

    expect(result).toEqual({
      ok: false,
      violations: [expect.objectContaining({ code: "SCHEMA_TYPE", path: "/minutes_passed" })],
    });
  });

  it.each([
    ["encounter", { type: [], note: "An ambush." }, "/encounter/type"],
    ["tile_move", { x: "three", y: 4 }, "/tile_move/x"],
    ["tile_discovery", { name: "Citadel", poi_type: "palace", description: "Stone." }, "/tile_discovery/poi_type"],
    ["location_update", { status: "normal", depopulated: "yes", note: "Quiet." }, "/location_update/depopulated"],
    ["start_combat", { initiator: "player", surprise: false, lethal: true, foes: "wolves", note: "" }, "/start_combat/foes"],
    ["buy_mount", { id: 42 }, "/buy_mount/id"],
    ["buy_mount", { id: "horse", priceCp: "free", settlement: "coin", settlementNote: "" }, "/buy_mount/priceCp"],
    ["grant_mount", { id: "griffon", name: 42 }, "/grant_mount/name"],
    ["purchase_rights", { key: "" }, "/purchase_rights/key"],
    ["purchase_rights", { key: "", agreedPriceCp: 1, settlement: "free", settlementNote: "" }, "/purchase_rights/settlement"],
    ["roll", { label: "Check", formula: "d20", dc: "hard", value: 12, outcome: "Success" }, "/roll/dc"],
    ["new_conditions", [{ name: "Dazed", duration_minutes: "soon" }], "/new_conditions/0/duration_minutes"],
    ["attribute_changes", { body: "stronger" }, "/attribute_changes/body"],
    ["needs_changes", { hunger: "full" }, "/needs_changes/hunger"],
    ["companion_gear", [{ id: "mara", add: "iron-sword", remove: [] }], "/companion_gear/0/add"],
    ["character_setup", { name: { injected: true } }, "/character_setup/name"],
    ["player_update", { name: { injected: true }, bond: [] }, "/player_update/name"],

    ["relationship_changes", [{ id: "mara", delta: "warmer" }], "/relationship_changes/0/delta"],
    ["memory_updates", [{ id: "mara", adds: "one fact" }], "/memory_updates/0/adds"],
    ["party_removals", [{ id: "mara", reason: "teleported" }], "/party_removals/0/reason"],
    ["inventory_changes", { added: [{ itemId: "rope", quantity: 0 }], removed: [], coins: {} }, "/inventory_changes/added/0/quantity"],
  ])("rejects malformed nested %s values before reducer access", (effect, value, path) => {
    const result = compileNarratorCandidate({
      candidate: candidate({ [effect]: value }),
      projection,
      turnPolicy: { allowedEffects: [effect] },
    });

    expect(result).toEqual({
      ok: false,
      violations: expect.arrayContaining([
        expect.objectContaining({ code: "SCHEMA_TYPE", path }),
      ]),
    });
  });

  it.each([
    "knowledge_updates",
    "party_removals",
    "companion_gear",
    "relationship_changes",
    "memory_updates",
  ])("reports malformed %s collections instead of throwing during reference validation", (effect) => {
    const compile = () => compileNarratorCandidate({
      candidate: candidate({ [effect]: "not-an-array" }),
      projection,
      turnPolicy: { allowedEffects: [effect] },
    });

    expect(compile).not.toThrow();
    expect(compile()).toEqual({
      ok: false,
      violations: expect.arrayContaining([
        expect.objectContaining({ code: "SCHEMA_TYPE", path: `/${effect}` }),
      ]),
    });
  });

  it.each([
    ["roll", { roll: { label: "Check", formula: "d20", dc: 10, value: 12, outcome: "Success", admin: true } }, "/roll/admin"],
    ["start combat foe", { start_combat: { initiator: "enemy", surprise: false, lethal: true, foes: [{ npc_id: "mara", kind: "human", name: "Mara", admin: true }], note: "Attack" } }, "/start_combat/foes/0/admin"],
    ["inventory entry", { inventory_changes: { added: [{ itemId: "torch", quantity: 1, admin: true }], removed: [], coins: { copper: 0, silver: 0, gold: 0 } } }, "/inventory_changes/added/0/admin"],
    ["knowledge update", { knowledge_updates: [{ id: "mara", adds: ["A fact"], admin: true }] }, "/knowledge_updates/0/admin"],
    ["party removal", { party_removals: [{ id: "mara", reason: "left", admin: true }] }, "/party_removals/0/admin"],

  ])("rejects unknown recursive %s fields", (_label, effects, path) => {
    const result = compileNarratorCandidate({
      candidate: candidate(effects),
      projection,
      turnPolicy: { allowedEffects: Object.keys(effects) },
    });

    expect(result).toEqual({
      ok: false,
      violations: [expect.objectContaining({ code: "SCHEMA_UNKNOWN_KEY", path })],
    });
  });

  it("rejects effect character ids outside the canonical registry", () => {
    const result = compileNarratorCandidate({
      candidate: candidate({ knowledge_updates: [{ id: "ghost", adds: ["A fact"] }] }),
      projection,
      turnPolicy: { allowedEffects: ["knowledge_updates"] },
    });

    expect(result).toEqual({
      ok: false,
      violations: [expect.objectContaining({
        code: "UNKNOWN_CHARACTER_REF",
        path: "/knowledge_updates/0/id",
      })],
    });
  });
});
