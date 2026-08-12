// The register is only worth having if it cannot drift from the contract it describes.
//
// Every field is derived from the live narrator response keys rather than from a copy, so
// adding one to the schema without deciding what it is fails here — which is the same
// property that made the Phase 0 compatibility matrix worth building, for the same reason.

import { describe, expect, it } from "vitest";
import { NARRATOR_RESPONSE_KEYS } from "../../engine/narrator-turn-compiler.js";
import {
  FIELD_DISPOSITION,
  NARRATOR_FIELD_INVENTORY,
  intentFields,
  isValidDisposition,
  narratorFieldDisposition,
  presentationFields,
  staleInventoryFields,
  unclassifiedFields,
} from "./narrator-field-inventory.js";

describe("the register covers the contract exactly", () => {
  it("classifies every field the narrator can return", () => {
    // The migration cannot be finished if new fields can appear unreviewed.
    expect(unclassifiedFields(NARRATOR_RESPONSE_KEYS)).toEqual([]);
  });

  it("names nothing the contract no longer has", () => {
    expect(staleInventoryFields(NARRATOR_RESPONSE_KEYS)).toEqual([]);
  });

  it("gives each field exactly one disposition", () => {
    const seen = new Set();
    for (const row of NARRATOR_FIELD_INVENTORY) {
      expect(seen.has(row.field), row.field).toBe(false);
      seen.add(row.field);
      expect(isValidDisposition(row.disposition), row.field).toBe(true);
    }
    expect(seen.size).toBe(NARRATOR_RESPONSE_KEYS.length);
  });
});

describe("every classification says why", () => {
  it("gives a real reason, not a label", () => {
    for (const row of NARRATOR_FIELD_INVENTORY) {
      expect(row.reason.length, row.field).toBeGreaterThan(40);
    }
  });

  it("names an owner for everything that has to be resolved by one", () => {
    // An intent with no owner is a migration nobody can start.
    for (const row of NARRATOR_FIELD_INVENTORY) {
      if (row.disposition !== FIELD_DISPOSITION.INTENT) continue;
      expect(row.owner, row.field).toBeTruthy();
      expect(row.owner, row.field).toMatch(/\//);
    }
  });

  it("gives presentation fields no owner, because they resolve nothing", () => {
    for (const row of NARRATOR_FIELD_INVENTORY) {
      if (row.disposition !== FIELD_DISPOSITION.PRESENTATION) continue;
      expect(row.owner, row.field).toBe(null);
    }
  });
});

describe("the shape of the migration", () => {
  it("leaves prose as the only thing the narrator owns outright", () => {
    // If this list ever grows, something mechanical has been reclassified as harmless.
    expect(presentationFields().sort()).toEqual(["contract_version", "story"]);
  });

  it("holds the engine's own output one-way", () => {
    for (const field of ["state_revision", "roll", "encounter"]) {
      expect(narratorFieldDisposition(field).disposition).toBe(FIELD_DISPOSITION.PROJECTION);
    }
  });

  it("puts everything that touches durable state behind an owner", () => {
    // The fields most worth being sure about: each one is a way to change the world.
    for (const field of [
      "minutes_passed", "vitality_change", "new_conditions", "tile_move",
      "assassination", "inventory_changes", "attribute_changes", "recruit_companion",
      "character_setup",
    ]) {
      expect(narratorFieldDisposition(field).disposition, field)
        .toBe(FIELD_DISPOSITION.INTENT);
    }
  });

  it("routes the fields that already have engine owners to those owners", () => {
    // Combat admission, the bootstrap compiler and typed memory are built; the register
    // points at them rather than inventing parallel owners.
    expect(narratorFieldDisposition("start_combat").owner).toBe("gameplay/tow/admission.js");
    expect(narratorFieldDisposition("character_setup").owner)
      .toBe("gameplay/tow/character-bootstrap.js");
    expect(narratorFieldDisposition("memory_updates").owner).toBe("engine/memory.js");
  });

  it("is most of the contract, which is the point", () => {
    // Roughly nine in ten fields are mechanical. That ratio is the argument for the gateway:
    // the narrator's response is overwhelmingly a set of state writes wearing prose.
    expect(intentFields().length).toBeGreaterThan(NARRATOR_RESPONSE_KEYS.length * 0.7);
  });

  it("has nothing retired yet, and will say so when it does", () => {
    const retired = NARRATOR_FIELD_INVENTORY
      .filter((row) => row.disposition === FIELD_DISPOSITION.RETIRED);
    expect(retired.every((row) => row.reason.length > 40)).toBe(true);
  });
});

describe("lookups", () => {
  it("answers for a known field and refuses an unknown one", () => {
    expect(narratorFieldDisposition("story").disposition).toBe(FIELD_DISPOSITION.PRESENTATION);
    expect(narratorFieldDisposition("not_a_field")).toBe(null);
  });

  it("notices a field the contract gained", () => {
    expect(unclassifiedFields([...NARRATOR_RESPONSE_KEYS, "grant_wish"])).toEqual(["grant_wish"]);
  });
});
