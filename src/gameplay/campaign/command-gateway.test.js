import { describe, expect, it } from "vitest";
import {
  INTENT_STATUS,
  MAX_ATTRIBUTE_DELTA,
  MAX_NARRATED_MINUTES,
  OWNER_MODE,
  PASS_THROUGH_REASONS,
  ROUTE_INTENT_ALLOWLISTS,
  routeAllows,
  gatewayCoverage,
  refusalNotice,
  resolveNarratorIntents,
  unownedIntentFields,
} from "./command-gateway.js";
import { intentFields } from "./narrator-field-inventory.js";

function campaign(overrides = {}) {
  return {
    created: true,
    character: { vitality: 20, vitalityMax: 30, attributes: { body: 2 } },
    world: {
      codex: {
        characters: {
          hale: { id: "hale", name: "Hale", combatState: { status: "ok" } },
          corpse: { id: "corpse", name: "Corpse", combatState: { status: "dead" } },
        },
      },
    },
    ...overrides,
  };
}

function turnWith(fields = {}) {
  return { contract_version: 1, state_revision: 1, story: [], ...fields };
}

function receiptFor(result, field) {
  return result.receipts.find((entry) => entry.field === field);
}

describe("every mechanical field crosses the door", () => {
  it("issues a receipt for each one, present or not", () => {
    // Coverage is complete from the first commit: a path where half the fields are policed
    // and half are not is worse than either end, because nobody can tell which is which.
    const result = resolveNarratorIntents(campaign(), turnWith());
    expect(result.receipts).toHaveLength(intentFields().length);
    expect(result.receipts.every((entry) => entry.field && entry.id)).toBe(true);
  });

  it("marks an absent field absent rather than silently skipping it", () => {
    const result = resolveNarratorIntents(campaign(), turnWith());
    expect(receiptFor(result, "minutes_passed").status).toBe(INTENT_STATUS.ABSENT);
  });

  it("leaves a clean turn untouched", () => {
    const turn = turnWith({ minutes_passed: 30 });
    const result = resolveNarratorIntents(campaign(), turn);
    expect(result.refused).toBe(false);
    expect(result.turn).toBe(turn);
  });

  it("gives every field an owner of one kind or the other", () => {
    expect(unownedIntentFields()).toEqual([]);
  });
});

describe("time", () => {
  it("allows a beat-sized passage", () => {
    const result = resolveNarratorIntents(campaign(), turnWith({ minutes_passed: 240 }));
    expect(receiptFor(result, "minutes_passed").status).toBe(INTENT_STATUS.APPLIED);
  });

  it("refuses a beat that would skip past a day of hunger and danger", () => {
    const result = resolveNarratorIntents(
      campaign(), turnWith({ minutes_passed: MAX_NARRATED_MINUTES + 1 }),
    );
    expect(receiptFor(result, "minutes_passed"))
      .toMatchObject({ status: INTENT_STATUS.REFUSED, reason: "time-exceeds-one-beat" });
    // Stripped, so it never reaches the reducer — the refusal is a refusal.
    expect(result.turn.minutes_passed).toBe(null);
  });

  it("refuses a value that is not a whole number of minutes", () => {
    expect(receiptFor(resolveNarratorIntents(campaign(), turnWith({ minutes_passed: 1.5 })), "minutes_passed").reason)
      .toBe("time-not-an-integer");
    expect(receiptFor(resolveNarratorIntents(campaign(), turnWith({ minutes_passed: -5 })), "minutes_passed").reason)
      .toBe("time-not-an-integer");
  });
});

describe("health", () => {
  it("allows a wound and a survivable recovery", () => {
    expect(receiptFor(resolveNarratorIntents(campaign(), turnWith({ vitality_change: -5 })), "vitality_change").status)
      .toBe(INTENT_STATUS.APPLIED);
    expect(receiptFor(resolveNarratorIntents(campaign(), turnWith({ vitality_change: 8 })), "vitality_change").status)
      .toBe(INTENT_STATUS.APPLIED);
  });

  it("refuses healing past the ceiling, so a beat is not a heal button", () => {
    const result = resolveNarratorIntents(campaign(), turnWith({ vitality_change: 50 }));
    expect(receiptFor(result, "vitality_change"))
      .toMatchObject({ status: INTENT_STATUS.REFUSED, reason: "vitality-above-maximum" });
    expect(result.turn.vitality_change).toBe(null);
  });

  it("refuses a loss larger than the whole pool", () => {
    expect(receiptFor(resolveNarratorIntents(campaign(), turnWith({ vitality_change: -400 })), "vitality_change").reason)
      .toBe("vitality-loss-exceeds-pool");
  });
});

describe("conditions", () => {
  it("allows an authored one", () => {
    const result = resolveNarratorIntents(campaign(), turnWith({ new_conditions: ["Bleeding"] }));
    expect(receiptFor(result, "new_conditions").status).toBe(INTENT_STATUS.APPLIED);
  });

  it("refuses one nobody wrote", () => {
    // Conditions are combat modifiers now. An invented name would block the next fight
    // outright, which is a strange way to discover the narrator made up a disease.
    const result = resolveNarratorIntents(
      campaign(), turnWith({ new_conditions: ["Bleeding", "Spectral Ennui"] }),
    );
    expect(receiptFor(result, "new_conditions"))
      .toMatchObject({ status: INTENT_STATUS.REFUSED, reason: "unauthored-condition" });
    expect(receiptFor(result, "new_conditions").unknown).toEqual(["Spectral Ennui"]);
    expect(result.turn.new_conditions).toBe(null);
  });

  it("reads a condition however the narrator shaped it", () => {
    const result = resolveNarratorIntents(
      campaign(), turnWith({ new_conditions: [{ name: "Poisoned" }] }),
    );
    expect(receiptFor(result, "new_conditions").status).toBe(INTENT_STATUS.APPLIED);
  });
});

describe("attributes", () => {
  it("allows a nudge", () => {
    const result = resolveNarratorIntents(campaign(), turnWith({ attribute_changes: { body: 1 } }));
    expect(receiptFor(result, "attribute_changes").status).toBe(INTENT_STATUS.APPLIED);
  });

  it("refuses a rewrite", () => {
    // Attributes feed every derived combat stat through the bridge; this is the most
    // load-bearing field in the contract.
    const result = resolveNarratorIntents(
      campaign(), turnWith({ attribute_changes: { body: MAX_ATTRIBUTE_DELTA + 3 } }),
    );
    expect(receiptFor(result, "attribute_changes"))
      .toMatchObject({ status: INTENT_STATUS.REFUSED, reason: "attribute-delta-too-large" });
  });
});

describe("death", () => {
  it("allows killing someone who is alive and real", () => {
    const result = resolveNarratorIntents(
      campaign(), turnWith({ assassination: { target_id: "hale", outcome: "killed" } }),
    );
    expect(receiptFor(result, "assassination").status).toBe(INTENT_STATUS.APPLIED);
  });

  it("refuses killing someone who does not exist", () => {
    const result = resolveNarratorIntents(
      campaign(), turnWith({ assassination: { target_id: "nobody", outcome: "killed" } }),
    );
    expect(receiptFor(result, "assassination"))
      .toMatchObject({ status: INTENT_STATUS.REFUSED, reason: "unknown-assassination-target" });
    expect(result.turn.assassination).toBe(null);
  });

  it("refuses killing someone already dead", () => {
    const result = resolveNarratorIntents(
      campaign(), turnWith({ assassination: { target_id: "corpse", outcome: "killed" } }),
    );
    expect(receiptFor(result, "assassination").reason).toBe("target-already-dead");
  });

  it("lets a survived attempt through", () => {
    const result = resolveNarratorIntents(
      campaign(), turnWith({ assassination: { target_id: "hale", outcome: "survived" } }),
    );
    expect(receiptFor(result, "assassination").status).toBe(INTENT_STATUS.APPLIED);
  });
});

describe("creation", () => {
  it("refuses a second start for a character who already exists", () => {
    const result = resolveNarratorIntents(
      campaign({ created: true }), turnWith({ character_setup: { name: "Someone Else" } }),
    );
    expect(receiptFor(result, "character_setup"))
      .toMatchObject({ status: INTENT_STATUS.REFUSED, reason: "character-already-created" });
  });

  it("allows the first one", () => {
    const result = resolveNarratorIntents(
      campaign({ created: false }), turnWith({ character_setup: { name: "Wanderer" } }),
    );
    expect(receiptFor(result, "character_setup").status).toBe(INTENT_STATUS.APPLIED);
  });
});

describe("what is not yet policed says so", () => {
  it("passes a field through and records it", () => {
    const result = resolveNarratorIntents(
      campaign(), turnWith({ player_update: { name: "A New Name" } }),
    );
    expect(receiptFor(result, "player_update").status).toBe(INTENT_STATUS.PASSED_THROUGH);
    expect(result.turn.player_update).toBeTruthy();
  });

  it("gives every pass-through a reason worth reading", () => {
    // Shrinking this list is the work; enumerating it is what makes the work reviewable.
    for (const [field, reason] of Object.entries(PASS_THROUGH_REASONS)) {
      expect(reason.length, field).toBeGreaterThan(40);
    }
  });

  it("reports coverage as a number rather than a feeling", () => {
    const coverage = gatewayCoverage();
    expect(coverage.total).toBe(intentFields().length);
    expect(coverage.enforced.length + coverage.passThrough.length).toBe(coverage.total);
    expect(coverage.fraction).toBeGreaterThan(0);
    // The fields most able to break the game are the ones enforced first.
    for (const field of [
      "minutes_passed", "vitality_change", "new_conditions", "attribute_changes",
      "assassination", "character_setup", "needs_changes", "memory_updates",
      "relationship_changes", "party_removals", "resolve_change", "part_ways",
      "recruit_companion", "buy_mount", "purchase_captive", "inventory_changes",
      "tile_move", "tile_discovery", "location_update", "discoveries", "knowledge_updates",
    ]) {
      expect(coverage.enforced, field).toContain(field);
    }
    // Precise rather than round: every field is enforced or has an entry saying why not, so
    // the two lists must together be the whole contract with nothing falling between them.
    expect(coverage.passThrough.sort()).toEqual(Object.keys(PASS_THROUGH_REASONS).sort());
    expect(coverage.enforced.length).toBeGreaterThanOrEqual(25);
    expect(coverage.fraction).toBeGreaterThan(0.9);
  });
});

describe("telling the player", () => {
  it("names what was trimmed", () => {
    const result = resolveNarratorIntents(
      campaign(), turnWith({ minutes_passed: 99_999, vitality_change: 400 }),
    );
    const notice = refusalNotice(result.refusals);
    expect(notice).toContain("minutes_passed");
    expect(notice).toContain("vitality_change");
  });

  it("says nothing when nothing was trimmed", () => {
    expect(refusalNotice([])).toBe(null);
    expect(refusalNotice(null)).toBe(null);
  });
});

describe("receipts", () => {
  it("are identified by their own content", () => {
    const first = resolveNarratorIntents(campaign(), turnWith({ minutes_passed: 30 }));
    const second = resolveNarratorIntents(campaign(), turnWith({ minutes_passed: 30 }));
    expect(receiptFor(second, "minutes_passed").id).toBe(receiptFor(first, "minutes_passed").id);
    const different = resolveNarratorIntents(campaign(), turnWith({ minutes_passed: 31 }));
    // Same field, same verdict, same revision — the id tracks the decision, not the value.
    expect(receiptFor(different, "minutes_passed").status).toBe(INTENT_STATUS.APPLIED);
  });

  it("carry the revision they were decided against", () => {
    const result = resolveNarratorIntents(campaign(), turnWith({ minutes_passed: 30 }), {
      stateRevision: 42,
    });
    expect(receiptFor(result, "minutes_passed").stateRevision).toBe(42);
  });
});

describe("the owner modes are the whole design", () => {
  it("has exactly two", () => {
    expect(Object.values(OWNER_MODE).sort()).toEqual(["enforced", "pass-through"]);
  });
});

describe("the owners promoted from pass-through", () => {
  it("lets a meal restore a real amount and refuses writing off the road", () => {
    expect(receiptFor(resolveNarratorIntents(campaign(), turnWith({ needs_changes: { hunger: 30 } })), "needs_changes").status)
      .toBe(INTENT_STATUS.APPLIED);
    const result = resolveNarratorIntents(campaign(), turnWith({ needs_changes: { hunger: 100 } }));
    expect(receiptFor(result, "needs_changes"))
      .toMatchObject({ status: INTENT_STATUS.REFUSED, reason: "need-delta-too-large" });
    expect(result.turn.needs_changes).toBe(null);
  });

  it("refuses a need nobody tracks", () => {
    expect(receiptFor(resolveNarratorIntents(campaign(), turnWith({ needs_changes: { morale: 5 } })), "needs_changes").reason)
      .toBe("unknown-need");
  });

  it("bounds how much of the memory bank one beat may claim", () => {
    expect(receiptFor(resolveNarratorIntents(campaign(), turnWith({ memory_updates: ["A thing happened."] })), "memory_updates").status)
      .toBe(INTENT_STATUS.APPLIED);
    const flood = resolveNarratorIntents(
      campaign(), turnWith({ memory_updates: ["a", "b", "c", "d", "e", "f"] }),
    );
    expect(receiptFor(flood, "memory_updates").reason).toBe("too-many-memories");
  });

  it("refuses an empty memory rather than storing a blank", () => {
    expect(receiptFor(resolveNarratorIntents(campaign(), turnWith({ memory_updates: ["   "] })), "memory_updates").reason)
      .toBe("empty-memory");
  });

  it("lets a conversation shift standing but not convert an enemy", () => {
    expect(receiptFor(resolveNarratorIntents(campaign(), turnWith({ relationship_changes: [{ id: "hale", delta: 8 }] })), "relationship_changes").status)
      .toBe(INTENT_STATUS.APPLIED);
    expect(receiptFor(resolveNarratorIntents(campaign(), turnWith({ relationship_changes: [{ id: "hale", delta: 90 }] })), "relationship_changes").reason)
      .toBe("relationship-delta-too-large");
  });

  it("refuses removing a companion who was never in the party", () => {
    const withParty = campaign({ party: ["hale"] });
    expect(receiptFor(resolveNarratorIntents(withParty, turnWith({ party_removals: ["hale"] })), "party_removals").status)
      .toBe(INTENT_STATUS.APPLIED);
    const result = resolveNarratorIntents(withParty, turnWith({ party_removals: ["a-stranger"] }));
    expect(receiptFor(result, "party_removals"))
      .toMatchObject({ status: INTENT_STATUS.REFUSED, reason: "removing-someone-not-in-the-party" });
    expect(result.turn.party_removals).toBe(null);
  });
});

describe("purchases, party and items", () => {
  function rich(overrides = {}) {
    return campaign({
      character: {
        vitality: 20, vitalityMax: 30, resolve: 4, resolveMax: 8,
        attributes: { body: 2 },
        inventory: { coins: { gold: 5 } },
      },
      party: ["hale"],
      ...overrides,
    });
  }

  it("lets the narrator haggle but not agree to money nobody has", () => {
    // The negotiation is the narrator's job; a price the purse has never held is not.
    const cheap = resolveNarratorIntents(rich(), turnWith({
      buy_mount: { id: "pony", priceCp: 100, settlement: "coin" },
    }));
    expect(receiptFor(cheap, "buy_mount").status).toBe(INTENT_STATUS.APPLIED);

    const dear = resolveNarratorIntents(rich(), turnWith({
      buy_mount: { id: "pony", priceCp: 999_999, settlement: "coin" },
    }));
    expect(receiptFor(dear, "buy_mount"))
      .toMatchObject({ status: INTENT_STATUS.REFUSED, reason: "cannot-afford" });
    expect(dear.turn.buy_mount).toBe(null);
  });

  it("still allows a non-coin settlement the purse could never cover", () => {
    // A writ, a ruse or a debt of service is exactly how the world lets a poor player buy
    // someone's freedom. Only coin has to be in the purse.
    const result = resolveNarratorIntents(rich(), turnWith({
      purchase_captive: { key: "mara", agreedPriceCp: 999_999, settlement: "writ", settlementNote: "a noble's deposit" },
    }));
    expect(receiptFor(result, "purchase_captive").status).toBe(INTENT_STATUS.APPLIED);
  });

  it("refuses recruiting or parting with the wrong people", () => {
    expect(receiptFor(resolveNarratorIntents(rich(), turnWith({ recruit_companion: { id: "hale" } })), "recruit_companion").reason)
      .toBe("already-in-the-party");
    expect(receiptFor(resolveNarratorIntents(rich(), turnWith({ part_ways: { id: "hale" } })), "part_ways").status)
      .toBe(INTENT_STATUS.APPLIED);
    expect(receiptFor(resolveNarratorIntents(rich(), turnWith({ part_ways: { id: "ghost" } })), "part_ways").reason)
      .toBe("parting-from-someone-not-in-the-party");
  });

  it("refuses an item nobody catalogued", () => {
    // Items are combat stats through the bridge, so an invented id is an invented weapon.
    const result = resolveNarratorIntents(rich(), turnWith({
      inventory_changes: { added: [{ itemId: "sword-of-plot-convenience", quantity: 1 }] },
    }));
    expect(receiptFor(result, "inventory_changes"))
      .toMatchObject({ status: INTENT_STATUS.REFUSED, reason: "uncatalogued-item" });
  });

  it("allows a loot-minted instance that carries its own entry", () => {
    const result = resolveNarratorIntents(rich(), turnWith({
      inventory_changes: { added: [{ itemId: "rare-blade-a1b2", quantity: 1, entry: { id: "rare-blade-a1b2", name: "Keen Blade" } }] },
    }));
    expect(receiptFor(result, "inventory_changes").status).toBe(INTENT_STATUS.APPLIED);
  });

  it("bounds the spendable pool like the health one", () => {
    expect(receiptFor(resolveNarratorIntents(rich(), turnWith({ resolve_change: 2 })), "resolve_change").status)
      .toBe(INTENT_STATUS.APPLIED);
    expect(receiptFor(resolveNarratorIntents(rich(), turnWith({ resolve_change: 40 })), "resolve_change").reason)
      .toBe("resolve-above-maximum");
  });

  it("refuses a growth steer the progression system does not understand", () => {
    expect(receiptFor(resolveNarratorIntents(rich(), turnWith({ progression_focus: "martial" })), "progression_focus").reason)
      .toBe("unknown-progression-focus");
    expect(receiptFor(resolveNarratorIntents(rich(), turnWith({ progression_focus: "racial" })), "progression_focus").status)
      .toBe(INTENT_STATUS.APPLIED);
  });
});

describe("the map", () => {
  it("lets the player move somewhere the world is", () => {
    expect(receiptFor(resolveNarratorIntents(campaign(), turnWith({ tile_move: { x: 12, y: -30 } })), "tile_move").status)
      .toBe(INTENT_STATUS.APPLIED);
  });

  it("refuses moving off the edge of the world", () => {
    // The travel lifecycle owns what a journey costs; the gateway owns that the destination
    // is somewhere the generator ever made.
    const result = resolveNarratorIntents(campaign(), turnWith({ tile_move: { x: 99_999, y: 0 } }));
    expect(receiptFor(result, "tile_move"))
      .toMatchObject({ status: INTENT_STATUS.REFUSED, reason: "off-the-map" });
    expect(result.turn.tile_move).toBe(null);
  });

  it("refuses revealing a place that does not exist", () => {
    expect(receiptFor(resolveNarratorIntents(campaign(), turnWith({ tile_discovery: { x: -99_999, y: 0 } })), "tile_discovery").reason)
      .toBe("off-the-map");
  });

  it("refuses a location update with no name", () => {
    // A named place becomes fact for every later prompt; an unnamed one says nothing while
    // still overwriting where the player is.
    expect(receiptFor(resolveNarratorIntents(campaign(), turnWith({ location_update: { note: "somewhere" } })), "location_update").reason)
      .toBe("location-without-a-name");
    expect(receiptFor(resolveNarratorIntents(campaign(), turnWith({ location_update: { name: "The Broken Wheel" } })), "location_update").status)
      .toBe(INTENT_STATUS.APPLIED);
  });
});

describe("what becomes fact for every later prompt", () => {
  it("allows a scene's worth of discoveries and refuses an encyclopedia", () => {
    const scene = resolveNarratorIntents(campaign(), turnWith({
      discoveries: { races: [{ id: "fen-folk", name: "Fen Folk" }] },
    }));
    expect(receiptFor(scene, "discoveries").status).toBe(INTENT_STATUS.APPLIED);

    const flood = resolveNarratorIntents(campaign(), turnWith({
      discoveries: { races: Array.from({ length: 40 }, (_, i) => ({ id: `race-${i}` })) },
    }));
    expect(receiptFor(flood, "discoveries"))
      .toMatchObject({ status: INTENT_STATUS.REFUSED, reason: "too-many-discoveries" });
    expect(flood.turn.discoveries).toBe(null);
  });

  it("refuses a discovery that would shadow a catalogued item", () => {
    // Otherwise narrator-authored stats stand in for real gear everywhere the catalogue is
    // read, including the combat bridge.
    const result = resolveNarratorIntents(campaign(), turnWith({
      discoveries: { items: [{ id: "iron-dagger", name: "Iron Dagger" }] },
    }));
    expect(receiptFor(result, "discoveries"))
      .toMatchObject({ status: INTENT_STATUS.REFUSED, reason: "discovery-shadows-catalogue-item" });
  });

  it("refuses filing knowledge about someone the codex has never heard of", () => {
    // How a hallucinated character acquires a history that later prompts read back as fact.
    const known = resolveNarratorIntents(campaign(), turnWith({
      knowledge_updates: [{ id: "hale", adds: ["Owes the player a debt."] }],
    }));
    expect(receiptFor(known, "knowledge_updates").status).toBe(INTENT_STATUS.APPLIED);

    const stranger = resolveNarratorIntents(campaign(), turnWith({
      knowledge_updates: [{ id: "someone-invented", adds: ["Is secretly a king."] }],
    }));
    expect(receiptFor(stranger, "knowledge_updates"))
      .toMatchObject({ status: INTENT_STATUS.REFUSED, reason: "knowledge-about-a-stranger" });
    expect(stranger.turn.knowledge_updates).toBe(null);
  });
});

describe("what a route is even allowed to ask for", () => {
  it("lets an aftermath narrator tell the story and change nothing", () => {
    // The exit gate this exists for. The fight is settled, the Chronicle is written, and the
    // prompt says not to apply mechanics — but saying it is instruction, and instruction is
    // not enforcement. An empty allowlist makes it true.
    const result = resolveNarratorIntents(
      campaign(),
      turnWith({ vitality_change: 5, minutes_passed: 10, new_conditions: ["Bleeding"] }),
      { route: "combat-aftermath" },
    );
    for (const field of ["vitality_change", "minutes_passed", "new_conditions"]) {
      expect(receiptFor(result, field), field)
        .toMatchObject({ status: INTENT_STATUS.REFUSED, reason: "not-allowed-on-route" });
      expect(result.turn[field], field).toBe(null);
    }
    expect(ROUTE_INTENT_ALLOWLISTS["combat-aftermath"]).toEqual([]);
  });

  it("refuses on scope before it ever asks whether the value was legal", () => {
    // A perfectly legal five-minute passage is still refused on a route with no business
    // moving the clock, and the reason says which of the two it was.
    const result = resolveNarratorIntents(
      campaign(), turnWith({ minutes_passed: 5 }), { route: "trade-presentation" },
    );
    expect(receiptFor(result, "minutes_passed").reason).toBe("not-allowed-on-route");
  });

  it("lets looting a body have consequences, because its prompt invites them", () => {
    const result = resolveNarratorIntents(
      campaign(),
      turnWith({ new_conditions: ["Bleeding"], attribute_changes: { body: 1 } }),
      { route: "loot-fallout" },
    );
    expect(receiptFor(result, "new_conditions").status).toBe(INTENT_STATUS.APPLIED);
    // But only the consequences it invites; growth is not one of them.
    expect(receiptFor(result, "attribute_changes").reason).toBe("not-allowed-on-route");
  });

  it("leaves the main story turn unconstrained", () => {
    // Narrowing where the game is actually played belongs to the owners, not a blanket list.
    expect(routeAllows(null, "minutes_passed")).toBe(true);
    expect(routeAllows("some-unlisted-route", "vitality_change")).toBe(true);
    const result = resolveNarratorIntents(campaign(), turnWith({ minutes_passed: 30 }));
    expect(receiptFor(result, "minutes_passed").status).toBe(INTENT_STATUS.APPLIED);
  });

  it("names every constrained route deliberately", () => {
    // A route appears here only when its scope has been read off its own prompt.
    expect(Object.keys(ROUTE_INTENT_ALLOWLISTS).sort()).toEqual([
      "combat-aftermath", "combat-search-presentation", "loot-fallout",
      "scry-presentation", "trade-presentation",
    ]);
  });
});
